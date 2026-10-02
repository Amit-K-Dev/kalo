"use client";

export function fireConfetti() {
  if (typeof window === "undefined") return;
  const RM = window.matchMedia("(prefers-reduced-motion:reduce)").matches;
  if (RM) return;
  const c = document.createElement("canvas");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:99";
  c.width = innerWidth;
  c.height = innerHeight;
  document.body.append(c);
  const g = c.getContext("2d");
  const cols = ["#3ddc97", "#7c5cff", "#26c6da", "#ffd166", "#ff6b6b"];
  const P = Array.from({ length: 150 }, () => ({
    x: innerWidth / 2, y: innerHeight * .35,
    vx: (Math.random() - .5) * 15, vy: -Math.random() * 13 - 4,
    s: 4 + Math.random() * 5, r: Math.random() * 6,
    vr: (Math.random() - .5) * .4,
    c: cols[Math.random() * 5 | 0]
  }));
  let t = 0;
  (function f() {
    t++;
    g.clearRect(0, 0, c.width, c.height);
    P.forEach(p => {
      p.vy += .35; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r);
      g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6);
      g.restore();
    });
    if (t < 140) requestAnimationFrame(f); else c.remove();
  })();
}
