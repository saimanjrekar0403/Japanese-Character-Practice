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
  check:   '<path d="M4 12L10 18L20 6"/>',
  camera:  '<path d="M3 8H7L9 5H15L17 8H21V19H3Z"/><rect x="9" y="10" width="6" height="6"/>',
  close:   '<path d="M5 5L19 19M19 5L5 19"/>'
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
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
applyTheme();

/* ---------- INSTALL (first-open popup + settings button) ---------- */

let deferredPrompt = null;   // Chrome gives us this when the app can be installed
let installHook = null;      // the settings screen sets this so its install box updates itself

const isStandalone = () =>
  matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);   // iPads that pretend to be Macs

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();          // hide Chrome's own mini-bar, we show our own popup
  deferredPrompt = e;
  maybeShowFirstOpenPopup();
  if (installHook) installHook();
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  closeModal();
  if (installHook) installHook();
});

async function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();           // Chrome's real install dialog
  await deferredPrompt.userChoice;   // wait for the answer
  deferredPrompt = null;             // an event can only be used once
  if (installHook) installHook();
}

function closeModal() {
  const m = document.querySelector('.modal-backdrop');
  if (m) m.remove();
}

function showInstallPopup() {
  if (isStandalone() || document.querySelector('.modal-backdrop')) return;
  const canInstall = !!deferredPrompt;
  if (!canInstall && !isIOS()) return;   // nothing we can offer in this browser

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <h2>Install this app</h2>
      ${canInstall
        ? `<p>Add it to your home screen so it opens like a normal app and works offline.</p>
           <div class="modal-actions">
             <button class="tool-btn" id="installYes">Install</button>
             <button class="tool-btn" id="installNo">Not now</button>
           </div>`
        : `<ol>
             <li>Open this page in <b>Safari</b></li>
             <li>Tap the <b>Share</b> button</li>
             <li>Tap <b>Add to Home Screen</b></li>
           </ol>
           <div class="modal-actions">
             <button class="tool-btn" id="installNo">Got it</button>
           </div>`}
    </div>`;
  document.body.appendChild(backdrop);

  backdrop.onclick = e => { if (e.target === backdrop) closeModal(); };   // tap outside to close
  document.getElementById('installNo').onclick = closeModal;
  const yes = document.getElementById('installYes');
  if (yes) yes.onclick = () => { closeModal(); installApp(); };
}

// shows the popup only the very first time, and only if installing is possible
function maybeShowFirstOpenPopup() {
  if (localStorage.getItem('installPopupSeen')) return;
  if (isStandalone()) return;
  if (!deferredPrompt && !isIOS()) return;
  localStorage.setItem('installPopupSeen', '1');
  showInstallPopup();
}

// the Install section inside the settings screen
function renderInstall() {
  const box = document.getElementById('installBox');
  if (!box) return;   // not on the settings screen right now
  if (isStandalone()) {
    box.innerHTML = `<h2>Install</h2><p class="hint">This app is installed ✓</p>`;
  } else if (deferredPrompt) {
    box.innerHTML = `<h2>Install</h2><button class="theme-btn" id="installBtn">Install app</button>`;
    document.getElementById('installBtn').onclick = installApp;
  } else if (isIOS()) {
    box.innerHTML = `<h2>Install</h2><button class="theme-btn" id="installBtn">How to install</button>`;
    document.getElementById('installBtn').onclick = showInstallPopup;
  } else {
    box.innerHTML = `<h2>Install</h2><p class="hint">Open your browser's menu and choose "Install app" or "Add to Home screen".</p>`;
  }
}

/* ---------- PROGRESS (saved on this phone, resets at 3 AM IST) ---------- */

const RESET_HOUR = 3;   // change this later if you want a different reset time

function dayKey() {
  // IST is UTC+5:30. Shift the clock so "midnight" lands at RESET_HOUR.
  const shifted = new Date(Date.now() + 5.5 * 3600e3 - RESET_HOUR * 3600e3);
  return shifted.toISOString().slice(0, 10);   // e.g. "2026-11-08"
}

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem('progress'));
    if (p && p.day === dayKey() && p.done) return p;
  } catch (e) {}
  return { day: dayKey(), done: {} };   // new day (or nothing saved yet): start fresh
}

function saveProgress(p) {
  try { localStorage.setItem('progress', JSON.stringify(p)); } catch (e) {}
}

// keep saved drawings small: 3 decimals is plenty
function roundStrokes(strokes) {
  return strokes.map(s => s.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]));
}

/* ---------- HELPERS ---------- */

async function loadJSON(path) {
  const res = await fetch(path);
  return res.json();
}

function setHeader(text, showGear) {
  title.textContent = text;
  settingsBtn.style.display = showGear ? '' : 'none';
}

// strokes -> the SVG lines used in the small boxes and the screenshot view
function strokesToPolylines(strokeList) {
  return strokeList.map(s => {
    const pts = s.length === 1 ? [s[0], s[0]] : s;   // a single tap becomes a dot
    return `<polyline points="${pts.map(p => p.join(',')).join(' ')}" />`;
  }).join('');
}

// current date + time in IST, e.g. "8 Nov 2026, 10:42:15 pm"
function nowIST() {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
  });
}

/* ---------- FULL CHART (all series together, for screenshots) ---------- */

// Which of the 5 columns (a i u e o) each character sits in. Default: all 5 columns.
// Each inner list is one row of the chart, filled with the series' characters in order.
const CHART_LAYOUT = {
  ya: [[0, 2, 4]],      // や _ ゆ _ よ
  wa: [[0, 4], [0]]     // わ _ _ _ を, then ん on its own row
};

async function openChart() {
  const ids = await loadJSON('data/hiragana/index.json');
  const allSeries = await Promise.all(ids.map(id => loadJSON(`data/hiragana/${id}.json`)));
  const done = loadProgress().done;
  let mode = 'writing';   // 'writing' = your drawings, 'printed' = typed characters

  // one entry per box: the character, or null for an empty spot in the chart
  const cells = [];
  allSeries.forEach((series, i) => {
    const layout = CHART_LAYOUT[ids[i]] || [[0, 1, 2, 3, 4]];
    let used = 0;   // how many characters of this series are already placed
    for (const row of layout) {
      for (let col = 0; col < 5; col++) {
        const at = row.indexOf(col);
        cells.push(at === -1 ? null : series.chars[used + at]);
      }
      used += row.length;
    }
  });

  const box = document.createElement('div');
  box.className = 'shot';   // same full-screen page as the single-series screenshot view
  box.innerHTML = `
    <button class="shot-close" aria-label="Close">${icon('close')}</button>
    <div class="shot-time"></div>
    <div class="theme-options">
      <button class="theme-btn" data-mode="writing">My writing</button>
      <button class="theme-btn" data-mode="printed">Printed</button>
    </div>
    <div class="chart"></div>`;
  app.appendChild(box);

  const chart = box.querySelector('.chart');
  const modeBtns = box.querySelectorAll('[data-mode]');

  function draw() {
    chart.innerHTML = cells.map(c => {
      if (!c) return '<div class="chart-cell gap"></div>';
      if (mode === 'printed') return `<div class="chart-cell"><span class="kana">${c.kana}</span></div>`;
      const s = done[c.romaji];
      return `<div class="chart-cell"><svg viewBox="0 0 1 1">${s ? strokesToPolylines(s) : ''}</svg></div>`;
    }).join('');
    modeBtns.forEach(b => b.classList.toggle('selected', b.dataset.mode === mode));
  }
  modeBtns.forEach(b => { b.onclick = () => { mode = b.dataset.mode; draw(); }; });
  draw();

  // live date + time
  const timeEl = box.querySelector('.shot-time');
  const tick = () => { timeEl.textContent = `${nowIST()} IST`; };
  tick();
  const timer = setInterval(() => {
    if (!box.isConnected) clearInterval(timer);   // screen was left: stop the clock
    else tick();
  }, 1000);

  box.querySelector('.shot-close').onclick = () => { clearInterval(timer); box.remove(); };
}


/* ---------- HOME SCREEN ---------- */

async function showHome() {
  redrawHook = null;
  setHeader('ひらがな', true);
  app.innerHTML = '';

  const progress = loadProgress();
  const ids = await loadJSON('data/hiragana/index.json');
  const grid = document.createElement('div');
  grid.className = 'grid';

  for (const id of ids) {
    const series = await loadJSON(`data/hiragana/${id}.json`);
    const total = series.chars.length;
    const count = series.chars.filter(c => progress.done[c.romaji]).length;

    const btn = document.createElement('button');
    // green = all done, red = nothing done, yellow = some done
    btn.className = 'series-btn ' + (count === total ? 'done' : count === 0 ? 'todo' : 'partial');
    btn.innerHTML = `${series.chars[0].kana}<span class="count">${count}/${total}</span>`;
    btn.onclick = () => { location.hash = `#/practice/${id}`; };
    grid.appendChild(btn);
  }
  app.appendChild(grid);
  const wrap = document.createElement('div');
  wrap.className = 'all-wrap';
  wrap.innerHTML = `<button class="tool-btn all-btn">${icon('camera')} All characters</button>`;
  wrap.querySelector('button').onclick = openChart;
  app.appendChild(wrap);
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
      <div id="installBox"></div>
    </div>`;

  const buttons = app.querySelectorAll('.theme-btn[data-theme-choice]');

  function markSelected() {
    const pref = localStorage.getItem('theme') || 'auto';
    buttons.forEach(b => b.classList.toggle('selected', b.dataset.themeChoice === pref));
  }

  buttons.forEach(b => {
    b.onclick = () => {
      localStorage.setItem('theme', b.dataset.themeChoice);
      applyTheme();
      markSelected();
    };
  });
  markSelected();

  installHook = renderInstall;   // keeps the install box up to date
  renderInstall();
}

/* ---------- PRACTICE SCREEN ---------- */

async function showPractice(id) {
  const series = await loadJSON(`data/hiragana/${id}.json`);
  const chars = series.chars;
  setHeader(`${chars[0].kana}行`, false);   // e.g. あ行, か行, は行

  app.innerHTML = `
    <div class="practice">
      <div class="left-col">
        <div class="slots">
          ${chars.map((c, i) => `<div class="slot" id="slot${i}"><svg viewBox="0 0 1 1"></svg></div>`).join('')}
        </div>
        <button class="tool-btn shot-open" id="shotBtn">${icon('camera')} Screenshot</button>
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
  const col = document.querySelector('.canvas-col');

  // load what you already did today (null = not done yet)
  const saved = loadProgress().done;
  const done = chars.map(c => saved[c.romaji] || null);

  let strokes = [];   // strokes on the big canvas right now
  let current = null;
  let target = done.findIndex(d => d === null);   // which box you're writing (-1 = everything is done)

  // Size the canvas for sharp lines. Called every time the canvas becomes visible,
  // because a hidden canvas has size 0.
  function sizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

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

  // Shrink a drawing into one of the small boxes
  function drawSlot(i, strokeList) {
    document.querySelector(`#slot${i} svg`).innerHTML = strokesToPolylines(strokeList);
  }

  // the first box that's still empty (-1 if all are done)
  function firstEmpty() {
    return done.findIndex(d => d === null);
  }

  function playSound() {
    if (target === -1) return;
    const audio = new Audio(`audio/${chars[target].romaji}.mp3`);   // file name only, never shown
    audio.play().catch(() => {});
  }

  // Update the highlighted box and show/hide the canvas
  function showTarget() {
    chars.forEach((_, i) =>
      document.getElementById(`slot${i}`).classList.toggle('active', i === target));

    if (target === -1) {
      col.classList.add('finished');            // hides canvas + buttons
      promptEl.textContent = 'Series complete! 🎉 Tap a box to redo it';
    } else {
      col.classList.remove('finished');
      sizeCanvas();
      redraw();
      promptEl.textContent = '';                // no hint text on purpose
      playSound();
    }
  }

  // Full-screen page with all your drawings + live date/time, made for screenshots
  function openShot() {
    const box = document.createElement('div');
    box.className = 'shot';
    box.innerHTML = `
      <button class="shot-close" aria-label="Close">${icon('close')}</button>
      <div class="shot-time"></div>
      <div class="shot-grid">
        ${done.map(s => `<div class="shot-box"><svg viewBox="0 0 1 1">${s ? strokesToPolylines(s) : ''}</svg></div>`).join('')}
      </div>`;
    app.appendChild(box);

    const timeEl = box.querySelector('.shot-time');
    const tick = () => { timeEl.textContent = `${nowIST()} IST`; };
    tick();
    const timer = setInterval(() => {
      if (!box.isConnected) clearInterval(timer);   // screen was left: stop the clock
      else tick();
    }, 1000);

    box.querySelector('.shot-close').onclick = () => { clearInterval(timer); box.remove(); };
  }

  canvas.addEventListener('pointerdown', e => {
    if (target === -1) return;
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
      showTarget();
    };
  });

  document.getElementById('undoBtn').onclick = () => { strokes.pop(); redraw(); };
  document.getElementById('clearBtn').onclick = () => { strokes = []; redraw(); };
  document.getElementById('soundBtn').onclick = playSound;
  document.getElementById('shotBtn').onclick = openShot;

  document.getElementById('doneBtn').onclick = () => {
    if (target === -1 || strokes.length === 0) return;
    const rounded = roundStrokes(strokes);
    done[target] = rounded;
    drawSlot(target, rounded);

    const p = loadProgress();                   // save it (also handles the day changing mid-session)
    p.done[chars[target].romaji] = rounded;
    saveProgress(p);

    strokes = [];
    target = firstEmpty();                      // next empty box, or -1 if everything is done
    showTarget();
  };

  // show your saved drawings in the boxes, then start
  done.forEach((s, i) => { if (s) drawSlot(i, s); });
  showTarget();
}

/* ---------- ROUTER ---------- */

function route() {
  const parts = location.hash.split('/');
  if (parts[1] === 'practice') showPractice(parts[2]);
  else if (parts[1] === 'settings') showSettings();
  else showHome();
}

document.getElementById('homeBtn').onclick = () => { location.hash = '#/'; };
settingsBtn.onclick = () => { location.hash = '#/settings'; };
window.addEventListener('hashchange', route);
route();
setTimeout(maybeShowFirstOpenPopup, 800);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
}