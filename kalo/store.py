"""CRUD for all user data — port of ``lib/store.js``.

Every method goes through a :class:`~kalo.supabase.SupabaseDB` built with the
*signed-in user's* JWT, so Supabase Row Level Security still decides which
rows come back. Compared with the original:

* ``delete_meal`` / ``delete_routine`` now filter on ``user_id`` explicitly
  instead of relying solely on RLS to catch an unscoped delete.
* ``select(..., single=True)`` returns ``None`` for no row rather than
  raising, which the original's ``.single()`` did.
"""

from __future__ import annotations

from datetime import date as calendar_date, datetime, timedelta
from typing import Any

from .nutrition import today
from .supabase import SupabaseDB

__all__ = ["Store", "empty_hist"]


def _blank() -> dict[str, Any]:
    return {"k": 0, "p": 0, "c": 0, "f": 0, "w": 0, "g": 2000, "wk": 0, "b": 0}


def empty_hist() -> dict[str, Any]:
    """Fresh per-day aggregate bucket (kcal, macros, water, workouts)."""
    return _blank()


class Store:
    def __init__(self, db: SupabaseDB, user_id: str):
        self.db = db
        self.user_id = user_id

    # ─── Profile ───

    async def get_profile(self) -> dict[str, Any] | None:
        return await self.db.select("profiles", filters={"id": f"eq.{self.user_id}"}, single=True)

    async def update_profile(self, updates: dict[str, Any]) -> None:
        row = {**updates, "id": self.user_id, "updated_at": datetime.now().astimezone().isoformat()}
        await self.db.upsert("profiles", row, on_conflict="id")

    # ─── Daily logs ───

    async def get_daily_log(self, date: str) -> dict[str, Any] | None:
        return await self.db.select(
            "daily_logs",
            filters={"user_id": f"eq.{self.user_id}", "date": f"eq.{date}"},
            single=True,
        )

    async def upsert_daily_log(self, date: str, updates: dict[str, Any]) -> None:
        row = {
            "user_id": self.user_id,
            "date": date,
            **updates,
            "updated_at": datetime.now().astimezone().isoformat(),
        }
        await self.db.upsert("daily_logs", row, on_conflict="user_id,date")

    # ─── Meals ───

    async def get_meals(self, date: str) -> list[dict[str, Any]]:
        return await self.db.select(
            "meals",
            filters={"user_id": f"eq.{self.user_id}", "date": f"eq.{date}"},
            order="created_at.asc",
        )

    async def add_meal(self, meal: dict[str, Any]) -> dict[str, Any] | None:
        row = {
            "user_id": self.user_id,
            "date": today(),
            "name": str(meal.get("name") or "")[:200],
            "kcal": int(meal.get("kcal") or 0),
            "protein_g": int(meal.get("p") or 0),
            "carbs_g": int(meal.get("c") or 0),
            "fat_g": int(meal.get("f") or 0),
        }
        return await self.db.insert("meals", row)

    async def add_meals(self, meals: list[dict[str, Any]], day: str | None = None) -> list[dict[str, Any]]:
        """Insert several meals in one round trip (the original looped)."""
        rows = []
        date = day or today()
        for meal in meals:
            rows.append(
                {
                    "user_id": self.user_id,
                    "date": date,
                    "name": str(meal.get("name") or "")[:200],
                    "kcal": int(meal.get("kcal") or 0),
                    "protein_g": int(meal.get("p") or 0),
                    "carbs_g": int(meal.get("c") or 0),
                    "fat_g": int(meal.get("f") or 0),
                }
            )
        if not rows:
            return []
        data = await self.db._request(
            "POST", "meals", body=rows, headers={"Prefer": "return=representation"}
        )
        return data if isinstance(data, list) else [data]

    async def delete_meal(self, meal_id: str) -> list[Any]:
        return await self.db.delete("meals", {"id": f"eq.{meal_id}", "user_id": f"eq.{self.user_id}"})

    # ─── History (last N days, aggregated) ───

    async def get_history(
        self, days: int = 7, current_day: calendar_date | None = None
    ) -> dict[str, dict[str, Any]]:
        current_day = current_day or datetime.now().astimezone().date()
        since = (current_day - timedelta(days=max(0, days - 1))).isoformat()
        logs = await self.db.select("daily_logs", filters={"user_id": f"eq.{self.user_id}", "date": f"gte.{since}"})
        meals = await self.db.select(
            "meals",
            filters={"user_id": f"eq.{self.user_id}", "date": f"gte.{since}"},
            columns="date,kcal,protein_g,carbs_g,fat_g",
        )

        hist: dict[str, dict[str, Any]] = {}
        for m in meals:
            bucket = hist.setdefault(str(m.get("date")), _blank())
            bucket["k"] += m.get("kcal") or 0
            bucket["p"] += m.get("protein_g") or 0
            bucket["c"] += m.get("carbs_g") or 0
            bucket["f"] += m.get("fat_g") or 0

        for log in logs:
            bucket = hist.setdefault(str(log.get("date")), _blank())
            bucket["w"] = log.get("water_ml") or 0
            bucket["wk"] = log.get("workout_sessions") or 0
            bucket["b"] = log.get("workout_kcal") or 0

        return hist

    # ─── Routines ───

    async def get_saved_routines(self) -> list[dict[str, Any]]:
        return await self.db.select(
            "routines", filters={"user_id": f"eq.{self.user_id}"}, order="created_at.asc"
        )

    async def save_routine(self, name: str, items: list[dict[str, Any]]) -> None:
        """Upsert by name — matches the original's select-then-write."""
        name = str(name).strip()[:80]
        if not name:
            return
        existing = await self.db.select(
            "routines",
            filters={"user_id": f"eq.{self.user_id}", "name": f"eq.{name}"},
            single=True,
        )
        now = datetime.now().astimezone().isoformat()
        if existing:
            await self.db.update(
                "routines", {"items": items, "updated_at": now}, {"id": f"eq.{existing['id']}"}
            )
        else:
            await self.db.insert("routines", {"user_id": self.user_id, "name": name, "items": items})

    async def delete_routine(self, routine_id: str) -> list[Any]:
        return await self.db.delete(
            "routines", {"id": f"eq.{routine_id}", "user_id": f"eq.{self.user_id}"}
        )

    # ─── Current routine ───

    async def get_current_routine(self) -> dict[str, Any]:
        data = await self.db.select(
            "current_routine", filters={"user_id": f"eq.{self.user_id}"}, single=True
        )
        if not data:
            return {"name": "", "items": []}
        return {
            "name": data.get("name") or "",
            "items": data.get("items") or [],
        }

    async def save_current_routine(self, name: str, items: list[dict[str, Any]]) -> None:
        row = {
            "user_id": self.user_id,
            "name": str(name)[:80],
            "items": items,
            "updated_at": datetime.now().astimezone().isoformat(),
        }
        await self.db.upsert("current_routine", row, on_conflict="user_id")
