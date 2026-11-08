const CACHE = 'hiragana-v1';   // bump the number if you ever want to force a full refresh

const SHELL = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.json',
  'data/hiragana/index.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'icons/favicon-48.png'
];

// INSTALL: save the app files, plus every series file and every audio file
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const urls = [...SHELL];
    try {
      const ids = await (await fetch('data/hiragana/index.json', { cache: 'no-cache' })).json();
      for (const id of ids) {
        const file = `data/hiragana/${id}.json`;
        urls.push(file);
        const series = await (await fetch(file, { cache: 'no-cache' })).json();
        for (const c of series.chars) urls.push(`audio/${c.romaji}.mp3`);
      }
    } catch (e) {}
    // one by one, so a single missing file can't break the whole install
    await Promise.allSettled(urls.map(u => cache.add(new Request(u, { cache: 'reload' }))));
    self.skipWaiting();
  })());
});

// ACTIVATE: throw away older saved versions
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

// iPhones ask audio files for "a slice at a time", so offline we have to hand out slices
async function rangeResponse(request, response) {
  const buf = await response.arrayBuffer();
  const m = /bytes=(\d+)-(\d*)/.exec(request.headers.get('range'));
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`,
      'Content-Length': end - start + 1
    }
  });
}

// FETCH: online = newest file (and save a copy); offline = the saved copy
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  event.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.status === 200) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    } catch (err) {
      let cached = await caches.match(req, { ignoreSearch: true });
      if (!cached && req.mode === 'navigate') cached = await caches.match('index.html');
      if (!cached) return Response.error();
      if (req.headers.has('range')) return rangeResponse(req, cached);
      return cached;
    }
  })());
});