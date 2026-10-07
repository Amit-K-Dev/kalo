"use client";
import { useState } from "react";
import { estimateMeal } from "@/lib/backend";

export default function MealsTab({ meals, goal, plan, plans, water, wg, targets, sumMeals, onAddMeals, onDeleteMeal, onWaterChange, onPlanSelect, switchTab }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const eaten = sumMeals("kcal");
  const left = goal - eaten;

  const handleEstimate = async () => {
    if (!query.trim()) return;
    setError("");
    setLoading(true);
    try {
      const data = await estimateMeal({ mode: "text", text: query });
      const items = (data && data.items) || [];
      if (!items.length) throw 0;
      await onAddMeals(items.map((it) => ({
        name: String(it.name),
        kcal: Math.round(+it.kcal || 0),
        p: Math.round(+it.p || 0),
        c: Math.round(+it.c || 0),
        f: Math.round(+it.f || 0),
      })));
      setQuery("");
    } catch (e) {
      console.error(e);
      if (e?.status === 429) {
        setError("Too many requests. Try again in a bit.");
      } else if (e?.message) {
        setError(`Error: ${e.message}`);
      } else {
        setError("Couldn't estimate that. Try rephrasing.");
      }
    }
    setLoading(false);
  };

  return (
    <section className="meals-section">
      <div className="card">
        <div className="mu">Choose your goal</div>
        <div className="chips">
          {plans.map(p => (
            <button key={p.id} className={"chip" + (plan === p.id ? " on" : "")}
              onClick={() => onPlanSelect(p.id)}>
              {p.n}
            </button>
          ))}
        </div>
        <div className="side">
          <div className="main">
            <div className="mu" style={{ marginTop: 14 }}>
              {left > 0 ? "Calories left today" : left === 0 ? "🎉 Goal reached!" : "Over your goal by"}
            </div>
            <div>
              <span className="big" style={left < 0 ? { color: "#d2473c" } : left === 0 ? { color: "var(--ac)" } : {}}>
                {Math.abs(left)}
              </span> <span className="mu">kcal</span>
            </div>
            <div className="bar">
              <i style={{
                width: Math.min(100, eaten / goal * 100) + "%",
                background: eaten > goal ? "#d2473c" : "var(--ac)"
              }} />
            </div>
            <div className="mu">{goal} goal − {eaten} eaten</div>
          </div>
          <div className="wat">
            <div className="mu">💧 Water</div>
            <div className="tube"><i style={{ height: Math.min(100, water / wg * 100) + "%" }} /></div>
            <div><b>{(water / 1000).toFixed(2)}</b><span className="mu"> / {(wg / 1000).toFixed(1)} L</span></div>
            <div className="mu" style={{ fontSize: 12 }}>
              {water >= wg ? "✅ Goal hit!" : Math.ceil((wg - water) / 250) + " glasses to go"}
            </div>
            <div className="wb">
              <button onClick={() => onWaterChange(-250)} aria-label="Remove a glass">−</button>
              <button className="wp-btn" onClick={() => onWaterChange(250)} aria-label="Add a glass">+</button>
            </div>
          </div>
        </div>
        <div className="macros">
          {[["Protein", "p", targets?.P], ["Carbs", "c", targets?.C], ["Fat", "f", targets?.F]].map(([label, key, tg]) => (
            <span key={key}>
              {tg != null ? `${label} ${Math.max(0, tg - sumMeals(key))}g left` : `${label} ${sumMeals(key)}g`}
            </span>
          ))}
        </div>
      </div>

      <div className="card">
        <label style={{ marginTop: 0 }}>Describe what you ate</label>
        <textarea value={query} onChange={e => setQuery(e.target.value)}
          placeholder="e.g. 2 scrambled eggs, a slice of sourdough with butter, and a large latte with oat milk" />
        <button className="btn" onClick={handleEstimate} disabled={loading}>
          {loading ? "Analyzing…" : "Estimate calories"}
        </button>
        <button className="btn2" onClick={() => switchTab(3)}>📸 Or scan a photo instead</button>
        {error && <div className="err">{error}</div>}
      </div>

      <div className="card">
        {meals.length === 0 && <div className="mu">No meals logged yet.</div>}
        {meals.map(m => (
          <div className="item" key={m.id}>
            <div>
              <div>{m.name}</div>
              <div className="mu">{m.kcal} kcal · P{m.protein_g} C{m.carbs_g} F{m.fat_g}</div>
            </div>
            <button className="x" onClick={() => onDeleteMeal(m.id)} aria-label="Remove">✕</button>
          </div>
        ))}
      </div>
    </section>
  );
}
