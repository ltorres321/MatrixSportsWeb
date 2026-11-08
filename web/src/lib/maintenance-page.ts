// Fully self-contained HTML for maintenance mode -- no React, no
// Supabase, no data fetching. proxy.ts returns this directly when
// MAINTENANCE_MODE is set, before it ever calls updateSession(), so
// an unreachable Supabase project can't take this page down with it.
export const MAINTENANCE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Matrix Sports Analytics -- Offline</title>
<style>
  html, body {
    margin: 0;
    height: 100%;
    background: #030603;
    overflow: hidden;
    font-family: 'Share Tech Mono', 'Courier New', monospace;
  }
  #rain {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
  .wrap {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24px;
  }
  .panel {
    background: rgba(3, 6, 3, 0.72);
    border: 1px solid #0d7a2e;
    box-shadow: 0 0 24px rgba(0, 255, 65, 0.25);
    border-radius: 6px;
    padding: 40px 48px;
    max-width: 560px;
  }
  h1 {
    color: #00ff41;
    font-size: clamp(22px, 4vw, 34px);
    letter-spacing: 2px;
    margin: 0 0 12px;
    text-shadow: 0 0 12px rgba(0, 255, 65, 0.6);
  }
  p {
    color: #c8ffd4;
    font-size: clamp(14px, 2vw, 17px);
    line-height: 1.6;
    margin: 0 0 6px;
  }
  .dim {
    color: #0d7a2e;
    font-size: 13px;
    margin-top: 18px;
  }
</style>
</head>
<body>
<canvas id="rain"></canvas>
<div class="wrap">
  <div class="panel">
    <h1>THE MATRIX HAS YOU, NEO.</h1>
    <p>Our systems are temporarily offline.</p>
    <p>We'll be back online shortly.</p>
    <div class="dim">matrixsports.net</div>
  </div>
</div>
<script>
(function () {
  var canvas = document.getElementById('rain');
  var ctx = canvas.getContext('2d');
  var glyphs = 'アイウエオカキクケコサシスセソ01アイウエオ'.split('');
  var fontSize = 16;
  var columns = 0;
  var drops = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = Math.floor(canvas.width / fontSize);
    drops = new Array(columns).fill(0).map(function () { return Math.random() * -50; });
  }

  function draw() {
    ctx.fillStyle = 'rgba(3, 6, 3, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = fontSize + 'px monospace';
    for (var i = 0; i < drops.length; i++) {
      var glyph = glyphs[Math.floor(Math.random() * glyphs.length)];
      var x = i * fontSize;
      var y = drops[i] * fontSize;
      ctx.fillStyle = Math.random() > 0.97 ? '#c8ffd4' : '#00ff41';
      ctx.fillText(glyph, x, y);
      if (y > canvas.height && Math.random() > 0.975) {
        drops[i] = 0;
      }
      drops[i]++;
    }
  }

  resize();
  window.addEventListener('resize', resize);
  setInterval(draw, 50);
})();
</script>
</body>
</html>
`;
