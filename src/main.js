import "./style.css";

const MIN_ZOOM = 20,
  MAX_ZOOM = 80;
const cam = { x: 0, y: 0, zoom: 22 };

const canvas = document.getElementById("grid");
const ctx = canvas.getContext("2d");
let W = 0,
  H = 0,
  dpr = 1,
  dirty = true,
  colors = {};

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function readColors() {
  colors = { dot: cssVar("--dot"), line: cssVar("--line") };
  dirty = true;
}

function resize() {
  const first = W === 0;
  dpr = window.devicePixelRatio || 1;
  W = canvas.clientWidth;
  H = canvas.clientHeight;

  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  if (first) {
    cam.x = -W / 2 / cam.zoom;
    cam.y = -H / 2 / cam.zoom;
  }
  dirty = true;
}

//drawing
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const z = cam.zoom;

  // dots when zoomed out, lines when zoomed in.
  const t = clamp((z - 16) / 12, 0, 1);

  //cell borders
  if (t > 0) {
    ctx.globalAlpha = t;
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = Math.floor(cam.x); (i - cam.x) * z <= W; i++) {
      const sx = Math.round((i - cam.x) * z) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
    }
    for (let j = Math.floor(cam.y); (j - cam.y) * z <= H; j++) {
      const sy = Math.round((j - cam.y) * z) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
    }
    ctx.stroke();
  }

  //when zoomed far out, skip cells so dots never crowd. 
  if (t < 1) {
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = colors.dot;
    const step = z >= 6 ? 1 : 2 ** Math.ceil(Math.log2(6 / z));
    const d = clamp(z * 0.1, 1.5, 3); // dot size in px
    const i0 = Math.floor(cam.x / step) * step;
    const j0 = Math.floor(cam.y / step) * step;
    ctx.beginPath();
    for (let i = i0; (i - cam.x) * z <= W + z; i += step) {
      for (let j = j0; (j - cam.y) * z <= H + z; j += step) {
        const sx = (i + 0.5 - cam.x) * z;
        const sy = (j + 0.5 - cam.y) * z;
        ctx.rect(sx - d / 2, sy - d / 2, d, d);
      }
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

//zoom
function zoomAt(sx, sy, factor, fromX = sx, fromY = sy) {
  const wx = fromX / cam.zoom + cam.x; 
  const wy = fromY / cam.zoom + cam.y;
  cam.zoom = clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  cam.x = wx - sx / cam.zoom; 
  cam.y = wy - sy / cam.zoom;
  dirty = true;
}

canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    let dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    const speed = e.ctrlKey ? 0.01 : 0.0015; 
    zoomAt(e.clientX, e.clientY, Math.exp(-dy * speed));
  },
  { passive: false },
);


const ptrs = new Map();
let pinchDist = 0;

canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  canvas.classList.replace("cursor-grab", "cursor-grabbing");
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});

canvas.addEventListener("pointermove", (e) => {
  const p = ptrs.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x,
    dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;

  if (ptrs.size === 1) {
    cam.x -= dx / cam.zoom;
    cam.y -= dy / cam.zoom;
    dirty = true;
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    const mx = (a.x + b.x) / 2,
      my = (a.y + b.y) / 2;
    // midpoint moved by half of this pointer's movement; zoom + pan in one step
    zoomAt(mx, my, dist / pinchDist, mx - dx / 2, my - dy / 2);
    pinchDist = dist;
  }
});

function release(e) {
  ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinchDist = 0;
  if (ptrs.size === 0) canvas.classList.replace("cursor-grabbing", "cursor-grab");
}
canvas.addEventListener("pointerup", release);
canvas.addEventListener("pointercancel", release);

// keeb
addEventListener("keydown", (e) => {
  if (e.key === "+" || e.key === "=") zoomAt(W / 2, H / 2, 1.25);
  else if (e.key === "-") zoomAt(W / 2, H / 2, 1 / 1.25);
  else if (e.key === "0") {
    cam.zoom = 20;
    cam.x = -W / 2 / cam.zoom;
    cam.y = -H / 2 / cam.zoom;
    dirty = true;
  }
});

//boot
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);
new ResizeObserver(resize).observe(canvas);
readColors();
resize();
(function frame() {
  if (dirty) {
    dirty = false;
    draw();
  }
  requestAnimationFrame(frame);
})();
