"use client";

import { useEffect, useRef } from "react";

interface RainCanvasProps {
  theme?: "dark" | "light";
}

// Decorative digital-rain background. Direct port of the old static
// site's rain.js, just wrapped as a component so every page can drop
// it in without a separate <script> tag. Colors flip for light theme
// so the trail fades to white and glyphs stay legible instead of
// rendering bright green-on-white.
//
// Gold on a "gold tier" (87%+ accuracy, see performanceTier.ts)
// weekly performance review story -- "like in the movie" (The Matrix
// Resurrections' own gold-tinted code rain), a one-off cosmetic
// request for that specific case, not a new site-wide theme. Signaled
// via document.body.dataset.rainTier (set by GoldRainTrigger, which
// the story page mounts only when its own tier is "gold") rather than
// a prop, since RainCanvas is rendered once in the root layout with
// no per-page call site to pass one in from. Read fresh inside draw()
// every tick rather than once per effect -- RainCanvas and the
// trigger mount as siblings in the layout tree, so there's no
// guaranteed ordering between their two effects; re-checking the DOM
// each tick (already running every 50ms) sidesteps that race instead
// of depending on it.
export default function RainCanvas({ theme = "dark" }: RainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

      const isGoldRain = document.body.dataset.rainTier === "gold";
      const glyphColor = isGoldRain ? "#ffd700" : theme === "light" ? "#0d7a2e" : "#00ff41";
      const glyphHighlightColor = isGoldRain ? "#fffbcc" : theme === "light" ? "#04140a" : "#c8ffd4";

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
  }, [theme]);

  return (
    <>
      <canvas id="rain" ref={canvasRef} />
      <div className="scanlines" aria-hidden="true" />
    </>
  );
}
