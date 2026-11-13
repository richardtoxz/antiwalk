const CACHE_NAME = 'transporte-df-v2';
const STATIC_ASSETS = ['/manifest.json', '/favicon.ico', '/icon-192x192.png', '/icon-512x512.png', '/apple-icon.png'];
const MAX_ASSETS = 120;
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.allSettled(['/', ...STATIC_ASSETS].map(url => cache.add(url)))));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names.filter(name => name.startsWith('transporte-df-') && name !== CACHE_NAME).map(name => caches.delete(name)))).then(() => self.clients.claim()));
});
async function save(cache, request, response) {
  if (!response.ok || response.type === 'opaque') return;
  await cache.put(request, response.clone());
  const keys = await cache.keys();
  if (keys.length > MAX_ASSETS) await Promise.all(keys.slice(0, keys.length - MAX_ASSETS).map(key => cache.delete(key)));
}
async function navigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(request, { signal: controller.signal });
    await save(cache, '/', response);
    return response;
  } catch {
    return (await cache.match('/')) || new Response('Abra o aplicativo com conexão para preparar o acesso offline.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } finally { clearTimeout(timer); }
}
async function asset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await save(cache, request, response);
  return response;
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Live API streams, maps, third-party requests and development modules pass through.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.searchParams.has('_rsc')) return;
  if (request.mode === 'navigate' && url.pathname === '/') event.respondWith(navigation(request));
  else if (STATIC_ASSETS.includes(url.pathname) || /^\/(assets\/|_next\/static\/)/.test(url.pathname)) event.respondWith(asset(request));
});
