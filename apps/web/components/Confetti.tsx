"use client";

import { useEffect, useRef } from "react";

/**
 * Self-contained celebratory confetti — a single full-screen <canvas> burst with
 * gravity, drift and fade. No dependency, no DOM churn beyond one canvas. Fires
 * once on mount and tears itself down after ~3.4s. No-ops under reduced motion.
 *
 * Used by the live room when the viewer wins a lot.
 */
const COLORS = ["#E7B24B", "#F2C97A", "#E03B4B", "#27C779", "#74E7AC", "#F2F4F8"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vrot: number;
  color: string;
  shape: 0 | 1; // rect | circle
}

export function Confetti({ count = 170 }: { count?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = window.innerWidth;
    let H = window.innerHeight;
    const resize = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // Two bursts from the lower corners arcing up + a top sprinkle.
    const particles: Particle[] = [];
    const spawn = (n: number, ox: number, oy: number, spread: number, up: number) => {
      for (let i = 0; i < n; i++) {
        const a = (Math.random() - 0.5) * spread - Math.PI / 2;
        const speed = 6 + Math.random() * 9;
        particles.push({
          x: ox,
          y: oy,
          vx: Math.cos(a) * speed,
          vy: Math.sin(a) * speed - up,
          size: 5 + Math.random() * 7,
          rot: Math.random() * Math.PI,
          vrot: (Math.random() - 0.5) * 0.4,
          color: COLORS[(Math.random() * COLORS.length) | 0]!,
          shape: Math.random() > 0.5 ? 0 : 1,
        });
      }
    };
    spawn(Math.round(count * 0.4), W * 0.12, H * 0.9, 1.1, 4);
    spawn(Math.round(count * 0.4), W * 0.88, H * 0.9, 1.1, 4);
    spawn(Math.round(count * 0.2), W * 0.5, -10, 1.6, -2);

    const gravity = 0.16;
    const drag = 0.992;
    const start = performance.now();
    const DURATION = 3400;
    let raf = 0;

    const tick = (t: number) => {
      const elapsed = t - start;
      const fade = elapsed > DURATION - 900 ? Math.max(0, (DURATION - elapsed) / 900) : 1;
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.vy += gravity;
        p.vx *= drag;
        p.vy *= drag;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 0) {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (elapsed < DURATION) {
        raf = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [count]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[90]"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
