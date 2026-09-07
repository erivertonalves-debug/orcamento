// Service worker: guarda o "esqueleto" do app em cache pra abrir mais rápido e
// funcionar offline. Nunca intercepta pedidos pra outros sites (Google Drive,
// Tesseract, fontes) — esses sempre vão direto pra rede.
//
// IMPORTANTE: o CACHE_NAME muda toda vez que o app muda de verdade (ex: v2, v3...).
// Isso força o navegador a jogar fora o cache antigo e buscar tudo de novo na rede
// — sem isso, quem já tinha aberto o site antes fica preso numa versão antiga do
// index.html mesmo depois de você subir um arquivo novo pro GitHub.
const CACHE_NAME = 'orcamento-shell-v2';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {}) // não trava a instalação se algum arquivo não existir ainda
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return; // deixa passar direto (Drive, CDNs, etc.)
  if (event.request.method !== 'GET') return;

  const isShellDoc = event.request.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');

  if (isShellDoc) {
    // network-first: sempre tenta buscar a versão mais nova do app na rede;
    // só usa o cache (offline) se a rede falhar de verdade.
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // demais arquivos do shell (ícones, manifest): cache-first, atualiza em segundo plano
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
