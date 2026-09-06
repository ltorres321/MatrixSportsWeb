// Shared digital-rain canvas background, used by index.html, home.html
// and signup.html. Purely decorative.

(function digitalRain() {
  const canvas = document.getElementById("rain");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const glyphs = "アイウエオカキクケコサシスセソ01アイウエオ".split("");
  const fontSize = 16;
  let columns, drops;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = Math.floor(canvas.width / fontSize);
    drops = new Array(columns).fill(0).map(() => Math.random() * -50);
  }

  function draw() {
    ctx.fillStyle = "rgba(3, 6, 3, 0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `${fontSize}px monospace`;
    for (let i = 0; i < drops.length; i++) {
      const glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      ctx.fillStyle = Math.random() > 0.97 ? "#c8ffd4" : "#00ff41";
      ctx.fillText(glyph, x, y);

      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  window.addEventListener("resize", resize);
  resize();
  setInterval(draw, 50);
})();
