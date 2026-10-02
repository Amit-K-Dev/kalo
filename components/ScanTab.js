"use client";
import { useState, useRef, useCallback } from "react";

function toB64(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const m = 1280, k = Math.min(1, m / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      res(c.toDataURL("image/jpeg", 0.8).split(",")[1]);
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("img")); };
    im.src = url;
  });
}

export default function ScanTab({ onAddMeals }) {
  const [photo, setPhoto] = useState(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [hint, setHint] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const fcamRef = useRef(null);
  const fgalRef = useRef(null);

  const handleFile = useCallback((f) => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhoto(f || null);
    setError("");
    setShowResults(false);
    setFound([]);
    if (f) {
      setPhotoUrl(URL.createObjectURL(f));
    } else {
      setPhotoUrl("");
    }
  }, [photoUrl]);

  const analyze = async () => {
    if (!photo) return;
    setError("");
    setShowResults(false);
    setLoading(true);
    try {
      const b64 = await toB64(photo);
      const h = hint.trim();
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `You are a nutrition estimator. Identify every distinct food and drink in the photo. For each, estimate the WEIGHT in grams of the portion shown (for drinks use ml as grams), using visual cues such as plate or bowl size, utensils, hands, packaging and typical serving sizes. Then give nutrition per 100 g of that food as prepared. If there is no food, return {"items":[]}.${h ? `\nThe person adds: """${h}"""` : ""}\nRespond with ONLY JSON: {"items":[{"name":"food name","grams":number,"kcal100":number,"p100":number,"c100":number,"f100":number}]}`,
          image: { data: b64 }
        })
      });
      if (!r.ok) throw { code: r.status === 429 ? "rate_limited" : r.status === 413 ? "image_rejected" : "error" };
      const data = await r.json();
      const items = ((data && data.items) || []).filter(i => i && i.name && +i.grams > 0);
      if (!items.length) {
        setError("I couldn't spot any food. Try a closer, brighter shot.");
        setLoading(false);
        return;
      }
      setFound(items.map(i => ({
        name: String(i.name),
        g: Math.round(+i.grams || 0),
        k: +i.kcal100 || 0, p: +i.p100 || 0, c: +i.c100 || 0, f: +i.f100 || 0
      })));
      setShowResults(true);
    } catch (e) {
      const msg = e?.code === "rate_limited" ? "Too many requests. Try again in a bit."
        : e?.code === "image_rejected" ? "That image couldn't be read. Try another photo."
        : "Couldn't analyze that photo. Try again.";
      setError(msg);
    }
    setLoading(false);
  };

  const calc = (it) => {
    const r = it.g / 100;
    return { kcal: Math.round(it.k * r), p: Math.round(it.p * r), c: Math.round(it.c * r), f: Math.round(it.f * r) };
  };

  const totals = () => {
    const a = found.map(calc);
    return { kcal: a.reduce((x, y) => x + y.kcal, 0), p: a.reduce((x, y) => x + y.p, 0), c: a.reduce((x, y) => x + y.c, 0), f: a.reduce((x, y) => x + y.f, 0) };
  };

  const updateGrams = (idx, g) => {
    setFound(prev => prev.map((it, i) => i === idx ? { ...it, g: Math.max(0, g) } : it));
  };

  const handleAddAll = () => {
    const items = found.filter(i => i.g > 0).map(i => {
      const c = calc(i);
      return { name: `${i.name} (${i.g} g)`, kcal: c.kcal, p: c.p, c: c.c, f: c.f };
    });
    onAddMeals(items);
    setHint("");
    handleFile(null);
  };

  const t = totals();

  return (
    <section className="scan-section">
      <div className="card">
        <input type="file" ref={fcamRef} accept="image/*" capture="environment" className="hide"
          onChange={() => { if (fcamRef.current.files[0]) { handleFile(fcamRef.current.files[0]); setTimeout(analyze, 100); } }} />
        <input type="file" ref={fgalRef} accept="image/*" className="hide"
          onChange={() => { if (fgalRef.current.files[0]) { handleFile(fgalRef.current.files[0]); setTimeout(analyze, 100); } }} />

        {!photo ? (
          <div>
            <button className="snap" onClick={() => fcamRef.current?.click()}>
              <span>📷</span>Tap to take a photo
              <div className="mu" style={{ fontWeight: 400 }}>Opens your phone camera</div>
            </button>
            <button className="btn2" onClick={() => fgalRef.current?.click()}>🖼 Choose from gallery</button>
            <div className="mu" style={{ marginTop: 10 }}>
              Tip: shoot from above in good light, with a fork or your hand in frame for scale.
            </div>
          </div>
        ) : (
          <div>
            <div className={`pv${loading ? " scanning" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="Meal photo" />
            </div>
            <label>Anything the camera can&apos;t see? (optional)</label>
            <input value={hint} onChange={e => setHint(e.target.value)} placeholder="e.g. cooked in 1 tbsp oil, small bowl" />
            <button className="btn" onClick={analyze} disabled={loading}>
              {loading ? "Detecting food…" : "Detect food & calories"}
            </button>
            <button className="btn2" onClick={() => { setHint(""); handleFile(null); }}>Retake</button>
          </div>
        )}
        {error && <div className="err">{error}</div>}
      </div>

      {showResults && (
        <div className="card">
          <div className="mu">Detected in your photo</div>
          <div><span className="big">{t.kcal}</span> <span className="mu">kcal</span></div>
          <div className="macros">
            <span>P <b>{t.p}</b>g</span>
            <span>C <b>{t.c}</b>g</span>
            <span>F <b>{t.f}</b>g</span>
          </div>
          <div className="mu" style={{ margin: "8px 0 2px" }}>
            Adjust the amount of each item if the estimate is off. Calories update instantly.
          </div>
          {found.map((it, i) => {
            const c = calc(it);
            return (
              <div className="sc" key={i}>
                <div className="top">
                  <span>{it.name}</span>
                  <span>{c.kcal} kcal</span>
                </div>
                <div className="amt">
                  <button className="st" onClick={() => updateGrams(i, it.g - 10)}>−</button>
                  <input type="number" inputMode="numeric" value={it.g}
                    onChange={e => updateGrams(i, +e.target.value || 0)} />
                  <button className="st" onClick={() => updateGrams(i, it.g + 10)}>+</button>
                  <span className="u">g · P{c.p} C{c.c} F{c.f}</span>
                </div>
              </div>
            );
          })}
          <button className="btn" onClick={handleAddAll}>Add to today&apos;s log</button>
        </div>
      )}
    </section>
  );
}
