"use client";
import { useState } from "react";
export default function GoalTab({ profile, plan, plans, tdee, onCalculate, onPlanSelect, planOptions }) {
  const [sex, setSex] = useState(profile?.sex || "m");
  const [age, setAge] = useState(profile?.age || 30);
  const [ht, setHt] = useState(profile?.height_cm || 172);
  const [wt, setWt] = useState(profile?.weight_kg || 70);
  const [act, setAct] = useState(profile?.activity_factor || 1.55);
  const [showRes, setShowRes] = useState(tdee > 0);
  const [msg, setMsg] = useState("");

  const handleCalc = async () => {
    if (!(wt > 0 && ht > 0 && age > 0)) return;
    await onCalculate(sex, age, ht, wt, act);
    setShowRes(true);
    setMsg("");
  };

  return (
    <section className="goal-section">
      <div className="card">
        {msg && <div className="mu" style={{ marginBottom: 8 }}>{msg}</div>}
        <div className="row">
          <div>
            <label style={{ marginTop: 0 }}>Sex</label>
            <select value={sex} onChange={e => setSex(e.target.value)}>
              <option value="m">Male</option>
              <option value="f">Female</option>
            </select>
          </div>
          <div>
            <label style={{ marginTop: 0 }}>Age</label>
            <input type="number" value={age} onChange={e => setAge(+e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div>
            <label>Height (cm)</label>
            <input type="number" value={ht} onChange={e => setHt(+e.target.value)} />
          </div>
          <div>
            <label>Weight (kg)</label>
            <input type="number" value={wt} onChange={e => setWt(+e.target.value)} />
          </div>
        </div>
        <label>Activity</label>
        <select value={act} onChange={e => setAct(+e.target.value)}>
          <option value={1.2}>Sedentary</option>
          <option value={1.375}>Light (1–3 days/wk)</option>
          <option value={1.55}>Moderate (3–5 days/wk)</option>
          <option value={1.725}>Very active (6–7 days/wk)</option>
        </select>
        <button className="btn" onClick={handleCalc}>Calculate my plans</button>
      </div>

      {showRes && tdee > 0 && (
        <div className="card">
          <div className="mu">Maintenance (TDEE)</div>
          <div className="big">{tdee} kcal</div>
          <div className="mu" style={{ margin: "12px 0 8px" }}>Choose your plan. Tap one to set it as your daily goal.</div>
          {plans.map(p => {
            const c = planOptions[p.id];
            if (!c) return null;
            return (
              <button key={p.id} className={"plan" + (plan === p.id ? " on" : "")}
                onClick={() => onPlanSelect(p.id)}>
                <div className="h">
                  <span>{p.n}</span>
                  <span className="k">{c.kcal} kcal</span>
                </div>
                <div className="mu">{p.d}</div>
                <div className="mu">Protein {c.P} g · Carbs {c.C} g · Fat {c.F} g</div>
              </button>
            );
          })}
          <div className="mu">Uses the Mifflin-St Jeor equation. Estimates only, not medical advice.</div>
        </div>
      )}
    </section>
  );
}
