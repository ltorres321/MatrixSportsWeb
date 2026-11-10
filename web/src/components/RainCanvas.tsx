"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

interface RainCanvasProps {
  theme?: "dark" | "light";
}

// Decorative digital-rain background. Direct port of the old static
// site's rain.js, just wrapped as a component so every page can drop
// it in without a separate <script> tag. Colors flip for light theme
// so the trail fades to white and glyphs stay legible instead of
// rendering bright green-on-white.
//
// Gold on an individual story article (/stories/[id]) -- "like in the
// movie" (The Matrix Resurrections' own gold-tinted code rain), a
// one-off cosmetic request for that page specifically, not a new
// site-wide theme. Checked by path rather than a prop: RainCanvas is
// rendered once in the root layout, shared by every route, so there's
// no per-page call site to pass a variant in from.
export default function RainCanvas({ theme = "dark" }: RainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const isGoldRain = /^\/stories\/[^/]+/.test(pathname ?? "");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const glyphs = "アイウエオカキクケコサシスセソ01アイウエオ".split("");
    const fontSize = 16;
    let columns = 0;
    let drops: number[] = [];

    const fadeColor = theme === "light" ? "rgba(245, 250, 247, 0.12)" : "rgba(3, 6, 3, 0.08)";
    const glyphColor = isGoldRain ? "#d4af37" : theme === "light" ? "#0d7a2e" : "#00ff41";
    const glyphHighlightColor = isGoldRain ? "#fff3b0" : theme === "light" ? "#04140a" : "#c8ffd4";

    function resize() {
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.floor(canvas.width / fontSize);
      drops = new Array(columns).fill(0).map(() => Math.random() * -50);
    }

    function draw() {
      if (!ctx || !canvas) return;
      ctx.fillStyle = fadeColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = `${fontSize}px monospace`;
      for (let i = 0; i < drops.length; i++) {
        const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        ctx.fillStyle = Math.random() > 0.97 ? glyphHighlightColor : glyphColor;
        ctx.fillText(glyph, x, y);

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }

    resize();
    window.addEventListener("resize", resize);
    const interval = setInterval(draw, 50);

    return () => {
      window.removeEventListener("resize", resize);
      clearInterval(interval);
    };
  }, [theme, isGoldRain]);

  return (
    <>
      <canvas id="rain" ref={canvasRef} />
      <div className="scanlines" aria-hidden="true" />
    </>
  );
}
