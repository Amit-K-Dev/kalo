"use client";
import { useMemo } from "react";
import { PLANS, planCalc, dkey, waterGoal } from "@/lib/nutrition";
import { estimateWorkout } from "@/lib/exercises";

export default function HomeTab({ meals, goal, water, wg, plan, tdee, weightKg, heightCm, hist, targets, curRoutine, sumMeals, switchTab, onWaterAdd, profile }) {
  const eaten = sumMeals("kcal");
  const left = goal - eaten;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayHist = hist[todayKey] || {};

  // BMI
  const bmi = heightCm > 0 && weightKg > 0 ? weightKg / ((heightCm / 100) ** 2) : 0;
  const bmiCat = bmi < 18.5 ? ["Underweight", "#4f9ad9"] : bmi < 25 ? ["Healthy", "#3fb27f"] : bmi < 30 ? ["Overweight", "#f0a63a"] : ["Obese", "#d2473c"];

  const sess = todayHist.wk || 0;
  const circ = 326.7;

  const days = useMemo(() => [6, 5, 4, 3, 2, 1, 0].map(n => {
    const k = dkey(n);
    const e = n === 0 ? { k: eaten, w: water, g: goal, wk: todayHist.wk, b: todayHist.b } : (hist[k] || {});
    return { k, n, e };
  }), [eaten, water, goal, todayHist, hist]);

  const HistChart = ({ data, refs, colorFn }) => (
    <div className="hist">
      {days.map((d, i) => (
        <div key={d.k}>
          <i style={{
            height: data[i] > 0 ? Math.min(60, Math.max(4, data[i] / (refs[i] || 1) * 46)) + "px" : "3px",
            background: data[i] > 0 ? colorFn(data[i], refs[i]) : "var(--tr)"
          }} />
          <span style={d.n === 0 ? { fontWeight: 800 } : {}}>
            {new Date(d.k + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}
          </span>
        </div>
      ))}
    </div>
  );

  const Tile = ({ n, label, val, sub, pct, col }) => (
    <button className="tile" onClick={() => switchTab(n)}>
      <div className="mu">{label}</div>
      <div className="v" style={col ? { color: col } : {}}>{val}</div>
      <div className="bar"><i style={{ width: Math.max(0, Math.min(100, pct)) + "%", background: col || "var(--ac)" }} /></div>
      <div className="mu" style={{ fontSize: 12 }}>{sub}</div>
    </button>
  );

  const logged = days.filter(d => (+d.e.k || 0) > 0);
  const avg = logged.length ? Math.round(logged.reduce((a, d) => a + d.e.k, 0) / logged.length) : 0;
  const wk = days.reduce((a, d) => a + (+d.e.wk || 0), 0);
  const bn = days.reduce((a, d) => a + (+d.e.b || 0), 0);
  const wl = days.filter(d => (+d.e.w || 0) > 0);
  const hit = days.filter(d => (+d.e.w || 0) >= wg).length;

  return (
    <section className="home-section">
      <div className="card">
        <div className="mu">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
        <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>Your day at a glance</div>
        <div className="ringwrap">
          <svg viewBox="0 0 120 120" className="ring" aria-hidden="true">
            <defs>
              <linearGradient id="rgd" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#3ddc97" />
                <stop offset="1" stopColor="#7c5cff" />
              </linearGradient>
            </defs>
            <circle cx="60" cy="60" r="52" className="rt" />
            <circle cx="60" cy="60" r="52" className="rp" stroke="url(#rgd)"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - Math.min(1, eaten / goal))}
              style={left < 0 ? { stroke: "#ff5d5d" } : {}}
            />
          </svg>
          <div className="rc">
            <div className="rgv">{Math.abs(left)}</div>
            <div className="mu">{left >= 0 ? "kcal left" : "kcal over"}</div>
          </div>
        </div>
        <div className="g4">
          <Tile n={1} label="Calories" val={Math.abs(left).toLocaleString()}
            sub={left >= 0 ? `kcal left · ${eaten} of ${goal}` : `kcal over · goal ${goal}`}
            pct={eaten / goal * 100} col={left < 0 ? "#d2473c" : ""} />
          <Tile n={1} label="Water" val={(water / 1000).toFixed(2) + " L"}
            sub={`of ${(wg / 1000).toFixed(1)} L goal`}
            pct={water / wg * 100} col="#3b9ae1" />
          <Tile n={5} label="Workout" val={sess ? "✓ Done" : "Not yet"}
            sub={sess ? `${sess} session${sess > 1 ? "s" : ""} · ~${todayHist.b || 0} kcal` : curRoutine.items.length ? `${curRoutine.items.length} exercises ready` : "Build a routine"}
            pct={sess ? 100 : 0} col={sess ? "" : "var(--mu)"} />
          <Tile n={4} label="BMI" val={bmi ? bmi.toFixed(1) : "--"}
            sub={bmi ? bmiCat[0] : "Add height & weight"}
            pct={bmi ? (bmi - 15) / 25 * 100 : 0} col={bmi ? bmiCat[1] : "var(--mu)"} />
        </div>
      </div>

      <div className="card">
        <div className="mu">Today&apos;s macros <span>{plan ? "· " + plan.n : "· no plan yet"}</span></div>
        {["Protein", "Carbs", "Fat"].map(macro => {
          const key = macro === "Protein" ? "p" : macro === "Carbs" ? "c" : "f";
          const v = sumMeals(key);
          const t = targets ? targets[key.toUpperCase()] : null;
          return (
            <div className="mrow" key={macro}>
              <div className="top">
                <span>{macro}</span>
                <span className="mu">{v} g{t ? ` / ${t} g` : ""}</span>
              </div>
              <div className="bar"><i style={{ width: t ? Math.min(100, v / t * 100) + "%" : "0%" }} /></div>
            </div>
          );
        })}
        {!plan && <div className="mu">Pick a plan on the Meals tab to see macro targets.</div>}
      </div>

      <div className="card">
        <div className="mu">Last 7 days · calories</div>
        <HistChart
          data={days.map(d => +d.e.k || 0)}
          refs={days.map(d => +d.e.g || goal)}
          colorFn={(v, r) => v > r * 1.05 ? "#d2473c" : "var(--ac)"}
        />
        <div className="mu" style={{ marginTop: 8 }}>
          {logged.length ? `Avg ${avg} kcal/day · ${logged.length}/7 days logged · ${wk} workout${wk === 1 ? "" : "s"} (~${bn} kcal burned)` : "Log a meal to start your history."}
        </div>
        <div className="mu" style={{ marginTop: 14 }}>Last 7 days · water</div>
        <HistChart
          data={days.map(d => +d.e.w || 0)}
          refs={days.map(() => wg)}
          colorFn={() => "#3b9ae1"}
        />
        <div className="mu" style={{ marginTop: 8 }}>
          {wl.length ? `Water goal hit ${hit}/7 days` : "Tap + on the Meals tab to log water."}
        </div>
      </div>

      <div className="card">
        <div className="mu" style={{ marginBottom: 8 }}>Quick actions</div>
        <div className="g4">
          <button className="btn2" style={{ margin: 0 }} onClick={() => switchTab(1)}>🍽 Log a meal</button>
          <button className="btn2" style={{ margin: 0 }} onClick={() => switchTab(3)}>📸 Scan food</button>
          <button className="btn2" style={{ margin: 0 }} onClick={onWaterAdd}>💧 +250 ml water</button>
          <button className="btn2" style={{ margin: 0 }} onClick={() => switchTab(5)}>🏋️ Workout</button>
        </div>
      </div>
    </section>
  );
}
