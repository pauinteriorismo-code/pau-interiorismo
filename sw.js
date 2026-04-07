// PAU Interiorismo — Service Worker v2
const CACHE = 'pau-v2';

// Al instalar: cachear el HTML principal
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/']))
  );
  self.skipWaiting();
});

// Al activar: limpiar cachés viejas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: primero red, si falla cachée (app disponible offline)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // No cachear peticiones a Supabase
  if (e.request.url.includes('supabase.co')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// Notificaciones push (cuando llegue una desde el servidor)
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || '🔔 PAU Interiorismo';
  const options = {
    body: data.body || 'Tienes un aviso pendiente',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'pau-aviso',
    requireInteraction: true,
    data: { url: data.url || '/' }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Al pulsar la notificación: abrir la app en la sección de agenda
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Si ya hay una ventana abierta, enfocarla
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ action: 'navAgenda' });
          return;
        }
      }
      // Si no, abrir una nueva
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
