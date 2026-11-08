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

// PRACTICE SCREEN: placeholder for now
function showPractice(id) {
  title.textContent = `${id} series`;
  app.innerHTML = `<p style="padding:12px">Practice screen for "${id}" coming soon ✍️</p>`;
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