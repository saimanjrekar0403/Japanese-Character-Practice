const app = document.getElementById('app');
const title = document.getElementById('title');

// Load a JSON file and give back the data
async function loadJSON(path) {
  const res = await fetch(path);
  return res.json();
}

// HOME SCREEN: one button per series, showing its first character
async function showHome() {
  title.textContent = 'Hiragana';
  app.innerHTML = '';

  const ids = await loadJSON('data/hiragana/index.json');
  const grid = document.createElement('div');
  grid.className = 'grid';

  for (const id of ids) {
    const series = await loadJSON(`data/hiragana/${id}.json`);
    const btn = document.createElement('button');
    btn.className = 'series-btn';
    btn.textContent = series.chars[0].kana;
    btn.onclick = () => { location.hash = `#/practice/${id}`; };
    grid.appendChild(btn);
  }
  app.appendChild(grid);
}

// PRACTICE SCREEN: a blank sheet you can draw on
function showPractice(id) {
  title.textContent = `${id} series`;
  app.innerHTML = `
    <div class="pad-wrap">
      <div class="pad"><canvas id="canvas"></canvas></div>
      <div>
        <button class="tool-btn" id="undoBtn">↩️ Undo</button>
        <button class="tool-btn" id="clearBtn">🗑️ Clear</button>
      </div>
    </div>`;
  setupCanvas();
}

function setupCanvas() {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  // Every stroke is a list of points. Points are saved as fractions (0 to 1)
  // of the sheet size, so they still work if the screen size changes.
  let strokes = [];
  let current = null;

  // Make the canvas sharp on phone screens
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);

  function redraw() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--ink').trim();
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of strokes) {
      ctx.beginPath();
      ctx.moveTo(stroke[0][0] * w, stroke[0][1] * h);
      for (const [x, y] of stroke) ctx.lineTo(x * w, y * h);
      ctx.stroke();
    }
  }

  function point(e) {
    return [e.offsetX / canvas.clientWidth, e.offsetY / canvas.clientHeight];
  }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId); // keep drawing even if finger slips outside
    current = [point(e)];
    strokes.push(current);
    redraw();
  });

  canvas.addEventListener('pointermove', e => {
    if (!current) return;
    current.push(point(e));
    redraw();
  });

  const endStroke = () => { current = null; };
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  document.getElementById('undoBtn').onclick = () => { strokes.pop(); redraw(); };
  document.getElementById('clearBtn').onclick = () => { strokes = []; redraw(); };
}

// ROUTER: look at the URL hash and decide which screen to show
function route() {
  const parts = location.hash.split('/');   // "#/practice/ha" -> ["#", "practice", "ha"]
  if (parts[1] === 'practice') showPractice(parts[2]);
  else showHome();
}

document.getElementById('homeBtn').onclick = () => { location.hash = '#/'; };
window.addEventListener('hashchange', route);
route();