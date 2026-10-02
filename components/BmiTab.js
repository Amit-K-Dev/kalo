"use client";
import { useState, useEffect } from "react";
import { calcBMI } from "@/lib/nutrition";

export default function BmiTab({ heightCm, weightKg, onUpdate }) {
  const [h, setH] = useState(heightCm || "");
  const [w, setW] = useState(weightKg || "");

  useEffect(() => {
    if (heightCm) setH(heightCm);
    if (weightKg) setW(weightKg);
  }, [heightCm, weightKg]);

  const bmiData = calcBMI(+h, +w);

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
          <span className="big">{bmiData ? bmiData.bmi.toFixed(1) : "--"}</span>{" "}
          <span style={{ fontWeight: 700, fontSize: 18, color: bmiData ? bmiData.category[1] : "var(--mu)" }}>
            {bmiData ? bmiData.category[0] : ""}
          </span>
        </div>

        <div className="gauge">
          <i style={{ width: "14%", background: "#4f9ad9" }} />
          <i style={{ width: "26%", background: "#3fb27f" }} />
          <i style={{ width: "20%", background: "#f0a63a" }} />
          <i style={{ width: "40%", background: "#d2473c" }} />
          <u style={{ left: bmiData ? Math.max(0, Math.min(100, (bmiData.bmi - 15) / 25 * 100)) + "%" : "0%" }} />
        </div>

        {bmiData && (
          <div className="mu">
            Healthy weight for {h} cm: {bmiData.lo.toFixed(1)}–{bmiData.hi.toFixed(1)} kg.{" "}
            {+w > bmiData.hi
              ? `That's about ${(+w - bmiData.hi).toFixed(1)} kg above the range.`
              : +w < bmiData.lo
              ? `That's about ${(bmiData.lo - +w).toFixed(1)} kg below the range.`
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
