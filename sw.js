// PAU INTERIORISMO — Service Worker ELIMINADOR
// Este archivo se desinstala a sí mismo permanentemente
// para liberar todas las peticiones de red que estaban bloqueadas

self.addEventListener(‘install’, function(e) {
console.log(’[SW] Instalando versión limpia…’);
self.skipWaiting(); // Activar inmediatamente
});

self.addEventListener(‘activate’, function(e) {
console.log(’[SW] Activando — eliminando service worker permanentemente…’);
e.waitUntil(
caches.keys().then(function(keys) {
return Promise.all(keys.map(function(k) {
console.log(’[SW] Eliminando caché:’, k);
return caches.delete(k);
}));
}).then(function() {
return self.clients.matchAll({ includeUncontrolled: true });
}).then(function(clients) {
// Desregistrar este service worker
return self.registration.unregister();
}).then(function() {
// Recargar todas las páginas para que carguen sin SW
return self.clients.matchAll({ includeUncontrolled: true });
}).then(function(clients) {
clients.forEach(function(client) {
console.log(’[SW] Recargando cliente:’, client.url);
client.navigate(client.url);
});
})
);
});

// NO interceptar fetch — dejar pasar todo
self.addEventListener(‘fetch’, function(e) {
return; // Sin respondWith = el navegador hace la petición normal
});
