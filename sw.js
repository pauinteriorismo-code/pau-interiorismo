// PAU INTERIORISMO - Service Worker LIMPIO
// Este SW no cachea nada y se autodestruye para no interferir con la app

self.addEventListener(‘install’, function(e) {
// Activar inmediatamente sin esperar
self.skipWaiting();
});

self.addEventListener(‘activate’, function(e) {
e.waitUntil(
Promise.all([
// Limpiar TODAS las cachés
caches.keys().then(function(keys) {
return Promise.all(keys.map(function(k) {
return caches.delete(k);
}));
}),
// Tomar control de todas las páginas
self.clients.claim()
])
);
});

// NO interceptar fetch - dejar pasar todo directamente
// Esto es CRÍTICO para que Supabase funcione en iOS Safari
self.addEventListener(‘fetch’, function(e) {
// Pass through - no caché, no interceptación
return;
});
