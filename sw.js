/* Ctrl Financeiro — service worker (mesmo padrão do Wayfin, adaptado ao GitHub Pages)
 * O site roda em /DashBoard_Finam/, então TODOS os caminhos são relativos ao escopo do SW.
 * - Navegação (index.html): network-first, com fallback para o cache (abre offline).
 * - Assets do próprio site (CSS, manifest, ícones): stale-while-revalidate.
 * - Libs/fontes de CDN (Chart.js, supabase-js, SheetJS, Google Fonts): stale-while-revalidate,
 *   para o app conseguir abrir sem rede.
 * - Supabase (dados, login) e brapi: NÃO passam pelo SW — sempre rede, nunca cache.
 * Para forçar atualização do shell, incremente VERSION. */
const VERSION = 'ctrl-v1';
const SHELL = ['./', './index.html', './css/ctrl-v2.css?v=1', './manifest.json',
  './favicon-192.png', './favicon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const INDEX = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(INDEX, copy)); }
        return res;
      }).catch(() => caches.match(INDEX).then(r => r || caches.match(new URL('./', self.registration.scope).href)))
    );
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req));
  }
  // qualquer outro host (supabase.co, brapi etc.) segue direto para a rede
});
