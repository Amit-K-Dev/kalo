"use client";
import { useState, useEffect } from "react";
import { getBmi } from "@/lib/store";

export default function BmiTab({ heightCm, weightKg, onUpdate }) {
  const [h, setH] = useState(heightCm || "");
  const [w, setW] = useState(weightKg || "");
  const [bmiData, setBmiData] = useState(null);

  useEffect(() => {
    let current = true;
    if (!(+h > 0 && +w > 0)) {
      return () => { current = false; };
    }
    const timer = setTimeout(async () => {
      try {
        const result = await getBmi(+h, +w);
        if (current) setBmiData(result);
      } catch {
        if (current) setBmiData(null);
      }
    }, 180);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [h, w]);

  const visibleBmi = +h > 0 && +w > 0 ? bmiData : null;

  const handleChange = (newH, newW) => {
    setH(newH);
    setW(newW);
    if (+newH > 0 && +newW > 0) {
      onUpdate(+newH, +newW);
    }
  };

  return (
    <section className="bmi-section">
      <div className="card">
        <div className="mu">Body Mass Index</div>
        <div className="row">
          <div>
            <label style={{ marginTop: 8 }}>Height (cm)</label>
            <input type="number" inputMode="decimal" value={h}
              onChange={e => handleChange(e.target.value, w)} />
          </div>
          <div>
            <label style={{ marginTop: 8 }}>Weight (kg)</label>
            <input type="number" inputMode="decimal" value={w}
              onChange={e => handleChange(h, e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <span className="big">{visibleBmi ? visibleBmi.bmi.toFixed(1) : "--"}</span>{" "}
          <span style={{ fontWeight: 700, fontSize: 18, color: visibleBmi ? visibleBmi.category[1] : "var(--mu)" }}>
            {visibleBmi ? visibleBmi.category[0] : ""}
          </span>
        </div>

        <div className="gauge">
          <i style={{ width: "14%", background: "#4f9ad9" }} />
          <i style={{ width: "26%", background: "#3fb27f" }} />
          <i style={{ width: "20%", background: "#f0a63a" }} />
          <i style={{ width: "40%", background: "#d2473c" }} />
          <u style={{ left: visibleBmi ? Math.max(0, Math.min(100, (visibleBmi.bmi - 15) / 25 * 100)) + "%" : "0%" }} />
        </div>

        {visibleBmi && (
          <div className="mu">
            Healthy weight for {h} cm: {visibleBmi.lo.toFixed(1)}–{visibleBmi.hi.toFixed(1)} kg.{" "}
            {+w > visibleBmi.hi
              ? `That's about ${(+w - visibleBmi.hi).toFixed(1)} kg above the range.`
              : +w < visibleBmi.lo
              ? `That's about ${(visibleBmi.lo - +w).toFixed(1)} kg below the range.`
              : "You're inside the range."}
          </div>
        )}

        <div className="mu" style={{ marginTop: 10 }}>
          Underweight under 18.5 · Normal 18.5–24.9 · Overweight 25–29.9 · Obese 30+.
          BMI doesn&apos;t separate muscle from fat, so muscular people can read high.
        </div>
      </div>
    </section>
  );
}
