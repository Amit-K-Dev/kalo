// SVG stick-figure generator — extracted from original Kalo

const L = { t: 34, u: 28, s: 28, a: 19, f: 19 };

function pts(p0) {
  const p = p0.slice();
  if (p[1] === p[3] && p[2] === p[4]) { p[3] -= 8; p[4] -= 6; }
  if (p[5] === p[7] && p[6] === p[8]) { p[7] -= 5; p[8] -= 3; }
  const r = d => d * Math.PI / 180;
  const v = (a, l) => [Math.sin(r(a)) * l, Math.cos(r(a)) * l];
  const td = [Math.sin(r(p[0])), -Math.cos(r(p[0]))];
  const N = [td[0] * L.t, td[1] * L.t];
  const H = [0, 0];
  const hd = [N[0] + td[0] * 11, N[1] + td[1] * 11];
  const lim = (o, a, b, l1, l2) => {
    const k = [o[0] + v(a, l1)[0], o[1] + v(a, l1)[1]];
    return [o, k, [k[0] + v(b, l2)[0], k[1] + v(b, l2)[1]]];
  };
  const q = {
    N, H, hd,
    arms: [lim(N, p[1], p[2], L.a, L.f), lim(N, p[3], p[4], L.a, L.f)],
    legs: [lim(H, p[5], p[6], L.u, L.s), lim(H, p[7], p[8], L.u, L.s)]
  };
  const all = [N, H, ...q.arms.flat(), ...q.legs.flat(), [hd[0], hd[1] + 8]];
  q.my = Math.max(...all.map(x => x[1]));
  return q;
}

export function generateFigureSVG(A, B) {
  const P = [pts(A), pts(B)];
  let x0 = 1e9, x1 = -1e9, y0 = 1e9;
  P.forEach(p => {
    [p.N, p.H, ...p.arms.flat(), ...p.legs.flat(),
      [p.hd[0] - 8, p.hd[1]], [p.hd[0] + 8, p.hd[1]], [p.hd[0], p.hd[1] - 8]
    ].forEach(q => {
      const x = q[0] - p.H[0], y = q[1] - p.my;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y);
    });
  });
  const w = x1 - x0, h = -y0, s = Math.min(128 / w, 84 / h, 1.3);
  const ox = 80 - (x0 + w / 2) * s, oy = 104 - (0) * s;
  const grp = (p, c) => {
    const T = q => [(ox + s * (q[0] - p.H[0])).toFixed(1), (oy + s * (q[1] - p.my)).toFixed(1)];
    const pl = (a, col, o, wd) => `<polyline points="${a.map(T).join(" ")}" stroke="${col}" opacity="${o}" stroke-width="${(wd * s).toFixed(1)}"/>`;
    const hc = T(p.hd);
    return `<g class="${c}" fill="none" stroke-linecap="round" stroke-linejoin="round">${pl(p.arms[1], "var(--ac)", .45, 5)}${pl(p.legs[1], "var(--tx)", .4, 6)}${pl([p.H, p.N], "var(--ac)", 1, 7)}${pl(p.legs[0], "var(--tx)", 1, 6)}${pl(p.arms[0], "var(--ac)", 1, 5)}<circle cx="${hc[0]}" cy="${hc[1]}" r="${(8 * s).toFixed(1)}" fill="var(--card)" stroke="var(--tx)" stroke-width="2.5"/></g>`;
  };
  return `<svg viewBox="0 0 160 120" role="img"><line x1="14" y1="${oy + 3}" x2="146" y2="${oy + 3}" stroke="var(--ln)" stroke-width="3" stroke-linecap="round"/>${grp(P[0], "fa")}${grp(P[1], "fb")}</svg>`;
}

// Memoized figure cache
const figCache = {};
export function getFigureSVG(exerciseId, poseA, poseB) {
  if (!figCache[exerciseId]) {
    figCache[exerciseId] = generateFigureSVG(poseA, poseB);
  }
  return figCache[exerciseId];
}
