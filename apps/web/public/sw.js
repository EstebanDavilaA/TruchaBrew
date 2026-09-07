// M42_P2 — minimal network-passthrough service worker (RA-4/RA-5).
//
// This is deliberately not an offline store — it exists only to satisfy the
// PWA installability criterion that a controlling service worker have a
// fetch handler, while providing the strongest possible no-stale-data
// guarantee: this file never reads from or writes to any storage API, so no
// request — including a live API reading — can ever be answered from a
// stored copy. Every request goes straight to the network.
//
// Do not add storage-backed request interception here. See M42_P2 spec RA-4/RA-5.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', () => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
