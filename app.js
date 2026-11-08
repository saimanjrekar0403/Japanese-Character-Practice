const app = document.getElementById('app');
const title = document.getElementById('title');
const settingsBtn = document.getElementById('settingsBtn');

/* ---------- ICONS (blocky line icons) ---------- */
const ICONS = {
  home:    '<path d="M3 11L12 3L21 11M5 10V21H19V10M10 21V14H14V21"/>',
  sliders: '<path d="M3 6H21M3 12H21M3 18H21"/><rect x="14" y="3" width="5" height="6" fill="currentColor" stroke="none"/><rect x="5" y="9" width="5" height="6" fill="currentColor" stroke="none"/><rect x="14" y="15" width="5" height="6" fill="currentColor" stroke="none"/>',
  sound:   '<path d="M3 9H8L13 4V20L8 15H3Z"/><path d="M17 9V15M20.5 6V18"/>',
  undo:    '<path d="M9 4L4 9L9 14M4 9H16V20H11"/>',
  trash:   '<path d="M4 6H20M9 6V3H15V6M6 6V21H18V6M10 10V17M14 10V17"/>',
  check:   '<path d="M4 12L10 18L20 6"/>'
};
function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;
}

document.getElementById('homeBtn').innerHTML = icon('home');
settingsBtn.innerHTML = icon('sliders');


/* ---------- THEME (auto / light / dark) ---------- */

let redrawHook = null;  // the practice screen sets this so the ink recolours when the theme changes

function applyTheme() {
  const pref = localStorage.getItem('theme') || 'auto';
  const systemDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const dark = pref === 'dark' || (pref === 'auto' && systemDark);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (redrawHook) redrawHook();
}
// if your phone switches between light/dark while the app is open, follow it (in auto mode)
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();

/* ---------- HELPERS ---------- */

async function loadJSON(path) {
  const res = await fetch(path);
  return res.json();
}

// set the header title, and show the ⚙️ button only when asked
function setHeader(text, showGear) {
  title.textContent = text;
  settingsBtn.style.display = showGear ? '' : 'none';
}

/* ---------- HOME SCREEN ---------- */

async function showHome() {
  redrawHook = null;
  setHeader('Hiragana', true);
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

/* ---------- SETTINGS SCREEN ---------- */

function showSettings() {
  redrawHook = null;
  setHeader('Settings', false);
  app.innerHTML = `
    <div class="settings">
      <h2>Theme</h2>
      <div class="theme-options">
        <button class="theme-btn" data-theme-choice="auto">Auto</button>
        <button class="theme-btn" data-theme-choice="light">Light</button>
        <button class="theme-btn" data-theme-choice="dark">Dark</button>
      </div>
    </div>`;

  const buttons = app.querySelectorAll('.theme-btn');

  function markSelected() {
    const pref = localStorage.getItem('theme') || 'auto';
    buttons.forEach(b => b.classList.toggle('selected', b.dataset.themeChoice === pref));
  }

  buttons.forEach(b => {
    b.onclick = () => {
      localStorage.setItem('theme', b.dataset.themeChoice);  // saved on this phone
      applyTheme();
      markSelected();
    };
  });
  markSelected();
}

/* ---------- PRACTICE SCREEN ---------- */

async function showPractice(id) {
  setHeader(`${id} series`, false);
  const series = await loadJSON(`data/hiragana/${id}.json`);
  const chars = series.chars;

  app.innerHTML = `
    <div class="practice">
      <div class="slots">
        ${chars.map((c, i) => `<div class="slot" id="slot${i}"><svg viewBox="0 0 1 1"></svg></div>`).join('')}
      </div>
      <div class="canvas-col">
        <div class="topbar">
          <span id="prompt"></span>
          <button class="sound-btn" id="soundBtn" title="Play sound">${icon('sound')}</button>
        </div>
        <div class="pad"><canvas id="canvas"></canvas></div>
        <div class="tools">
          <button class="tool-btn" id="undoBtn">${icon('undo')} Undo</button>
          <button class="tool-btn" id="clearBtn">${icon('trash')} Clear</button>
          <button class="tool-btn" id="doneBtn">${icon('check')} Done</button>
        </div>
      </div>
    </div>`;
  setupPractice(chars);
}

function setupPractice(chars) {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const promptEl = document.getElementById('prompt');

  const done = chars.map(() => null);  // done[i] = the strokes you drew for box i (null = not done yet)
  let strokes = [];                    // strokes on the big canvas right now
  let current = null;
  let target = 0;                      // which box you're writing now (-1 = everything is done)

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
  redrawHook = redraw;  // so a theme change recolours the ink

  function point(e) {
    return [e.offsetX / canvas.clientWidth, e.offsetY / canvas.clientHeight];
  }

  // Shrink a drawing into one of the small boxes (as an SVG)
  function drawSlot(i, strokeList) {
    const svg = document.querySelector(`#slot${i} svg`);
    svg.innerHTML = strokeList.map(s => {
      const pts = s.length === 1 ? [s[0], s[0]] : s;   // a single tap becomes a dot
      return `<polyline points="${pts.map(p => p.join(',')).join(' ')}" />`;
    }).join('');
  }

  // the first box that's still empty (-1 if all are done)
  function firstEmpty() {
    return done.findIndex(d => d === null);
  }

  function playSound() {
    if (target === -1) return;
    const audio = new Audio(`audio/${chars[target].romaji}.mp3`);
    audio.play().catch(() => {});
  }

  // Update the prompt + highlighted box, then play the sound
  function showTarget() {
    chars.forEach((_, i) =>
      document.getElementById(`slot${i}`).classList.toggle('active', i === target));
    if (target === -1) {
      promptEl.textContent = 'Series complete! 🎉';
    } else {
      promptEl.textContent = `Write: ${chars[target].romaji}`;
      playSound();
    }
  }

  canvas.addEventListener('pointerdown', e => {
    if (target === -1) return;                 // all done: tap a box to redo one
    canvas.setPointerCapture(e.pointerId);
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

  // Tap a box to redo it
  chars.forEach((_, i) => {
    document.getElementById(`slot${i}`).onclick = () => {
      if (i === target) { playSound(); return; }              // same box: just replay the sound
      if (done[i] === null && i !== firstEmpty()) return;     // can't skip ahead
      target = i;
      strokes = [];
      redraw();
      showTarget();
    };
  });

  document.getElementById('undoBtn').onclick = () => { strokes.pop(); redraw(); };
  document.getElementById('clearBtn').onclick = () => { strokes = []; redraw(); };
  document.getElementById('soundBtn').onclick = playSound;

  document.getElementById('doneBtn').onclick = () => {
    if (target === -1 || strokes.length === 0) return;
    done[target] = strokes;       // remember it
    drawSlot(target, strokes);    // your drawing goes into the box (replacing the old one if redoing)
    strokes = [];
    redraw();
    target = firstEmpty();        // jump to the first box still empty (or -1 if all done)
    showTarget();
  };

  showTarget();
}

/* ---------- ROUTER ---------- */

function route() {
  const parts = location.hash.split('/');   // "#/practice/ha" -> ["#", "practice", "ha"]
  if (parts[1] === 'practice') showPractice(parts[2]);
  else if (parts[1] === 'settings') showSettings();
  else showHome();
}

document.getElementById('homeBtn').onclick = () => { location.hash = '#/'; };
settingsBtn.onclick = () => { location.hash = '#/settings'; };
window.addEventListener('hashchange', route);
route();