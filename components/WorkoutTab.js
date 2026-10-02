"use client";
import { useState, useMemo, useCallback } from "react";
import { EX, CATS, TPL, getExercise, getUnit, estimateWorkout } from "@/lib/exercises";
import { getFigureSVG } from "@/lib/figures";

export default function WorkoutTab({ curRoutine, savedRoutines, weightKg, onRoutineChange, onSaveRoutine, onDeleteRoutine, onWorkoutDone }) {
  const [filt, setFilt] = useState("All");
  const [saveMsg, setSaveMsg] = useState("");
  const [doneMsg, setDoneMsg] = useState("");
  const cur = curRoutine.items || [];
  const routineName = curRoutine.name || "";

  const setCur = useCallback((items) => {
    onRoutineChange(routineName, items);
  }, [routineName, onRoutineChange]);

  const setName = useCallback((name) => {
    onRoutineChange(name, cur);
  }, [cur, onRoutineChange]);

  const addEx = (id) => {
    const existing = cur.find(x => x.id === id);
    if (existing) {
      setCur(cur.map(x => x.id === id ? { ...x, sets: x.sets + 1 } : x));
    } else {
      const e = getExercise(id);
      if (e) setCur([...cur, { id, sets: e[5], reps: e[6] }]);
    }
  };

  const est = estimateWorkout(cur, weightKg);

  const handleSave = async () => {
    if (!cur.length) return;
    const name = routineName.trim() || "My routine";
    await onSaveRoutine(name, JSON.parse(JSON.stringify(cur)));
    setSaveMsg("Saved ✓");
    setTimeout(() => setSaveMsg(""), 1500);
  };

  const handleDone = async () => {
    if (!cur.length) return;
    await onWorkoutDone();
    setDoneMsg("Logged ✓ Nice work!");
    setTimeout(() => setDoneMsg(""), 2000);
  };

  const handleLoad = (r) => {
    onRoutineChange(r.name, JSON.parse(JSON.stringify(r.items)));
    window.scrollTo(0, 0);
  };

  const handleClear = () => {
    onRoutineChange("", []);
  };

  const handleTemplate = (tpl) => {
    const items = tpl[1].map(id => {
      const e = getExercise(id);
      return { id, sets: e[5], reps: e[6] };
    });
    if (!routineName) onRoutineChange(tpl[0], items);
    else setCur(items);
  };

  return (
    <section>
      <div className="card">
        <div className="mu">My routine</div>
        <input value={routineName} onChange={e => setName(e.target.value)}
          placeholder="Routine name, e.g. Push day" style={{ margin: "8px 0" }} />
        <div className="mu">Quick start</div>
        <div className="chips2">
          {TPL.map(t => (
            <button key={t[0]} className="chip" onClick={() => handleTemplate(t)}>{t[0]}</button>
          ))}
        </div>

        {cur.length === 0 ? (
          <div className="mu" style={{ margin: "10px 0" }}>
            Empty. Pick a quick start or tap Add on any exercise below.
          </div>
        ) : (
          cur.map((it, i) => {
            const e = getExercise(it.id);
            if (!e) return null;
            const rs = e[7] === "min" ? 1 : e[7] === "sec" ? 5 : 1;
            return (
              <div className="ri" key={i}>
                <span dangerouslySetInnerHTML={{ __html: getFigureSVG(e[0], e[8], e[9]) }} />
                <div className="in">
                  <b>{e[1]}</b>
                  <div className="ctl">
                    <button onClick={() => setCur(cur.map((x, j) => j === i ? { ...x, sets: Math.max(1, x.sets - 1) } : x))}>−</button>
                    <span>{it.sets} sets</span>
                    <button onClick={() => setCur(cur.map((x, j) => j === i ? { ...x, sets: x.sets + 1 } : x))}>+</button>
                    <span>×</span>
                    <button onClick={() => setCur(cur.map((x, j) => j === i ? { ...x, reps: Math.max(1, x.reps - rs) } : x))}>−</button>
                    <span>{it.reps} {getUnit(e)}</span>
                    <button onClick={() => setCur(cur.map((x, j) => j === i ? { ...x, reps: x.reps + rs } : x))}>+</button>
                  </div>
                  <div className="ctl">
                    <button onClick={() => {
                      if (i > 0) {
                        const n = [...cur];
                        [n[i - 1], n[i]] = [n[i], n[i - 1]];
                        setCur(n);
                      }
                    }}>↑</button>
                    <button onClick={() => {
                      if (i < cur.length - 1) {
                        const n = [...cur];
                        [n[i + 1], n[i]] = [n[i], n[i + 1]];
                        setCur(n);
                      }
                    }}>↓</button>
                    <button onClick={() => setCur(cur.filter((_, j) => j !== i))}>✕</button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {cur.length > 0 && (
          <div className="mu" style={{ marginTop: 8 }}>
            {cur.length} exercises · about {est.min} min · ~{est.kc} kcal burned (rough estimate)
          </div>
        )}

        <button className="btn" onClick={handleSave} disabled={!cur.length}>
          {saveMsg || "Save routine"}
        </button>
        <button className="btn2" onClick={handleDone} disabled={!cur.length}>
          {doneMsg || "✓ Mark today's workout as done"}
        </button>
        <button className="btn2" onClick={handleClear}>Clear</button>
      </div>

      {savedRoutines.length > 0 && (
        <div className="card">
          <div className="mu">Saved routines</div>
          {savedRoutines.map(r => {
            const t = estimateWorkout(r.items, weightKg);
            return (
              <div className="sv" key={r.id}>
                <div>
                  <b>{r.name}</b>
                  <div className="mu">{r.items.length} exercises · ~{t.min} min</div>
                </div>
                <div>
                  <button onClick={() => handleLoad(r)}>Load</button>
                  <button onClick={() => onDeleteRoutine(r.id)} aria-label="Delete routine">✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card">
        <div className="mu">Exercise library · tap Add to build your routine</div>
        <div className="chips2">
          {CATS.map(c => (
            <button key={c} className={"chip" + (c === filt ? " on" : "")} onClick={() => setFilt(c)}>{c}</button>
          ))}
        </div>
        <div className="grid">
          {EX.filter(e => filt === "All" || e[2] === filt).map((e, ix) => (
            <div key={e[0]} className="ex" style={{ "--i": ix % 12 }}>
              <span dangerouslySetInnerHTML={{ __html: getFigureSVG(e[0], e[8], e[9]) }} />
              <b>{e[1]}</b>
              <div className="mu">{e[2]} · {e[3]}</div>
              <div className="mu">{e[4]}</div>
              <button onClick={() => addEx(e[0])}>
                + Add · {e[5]}×{e[6]}{e[7] === "reps" ? "" : " " + e[7]}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
