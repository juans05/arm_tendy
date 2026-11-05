// Service worker mínimo: permite instalar ARM como app. No guarda datos en caché (la bandeja siempre es en vivo).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
