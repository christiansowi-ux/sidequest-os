/* Sidequest OS — service worker
   Strategie: Netzwerk-zuerst für die App-Seite (immer die neueste Version, wenn online),
   Cache-zuerst nur als Offline-Fallback. Assets: stale-while-revalidate. */
const CACHE = "sidequest-os-v5";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg", "./icon-maskable.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isAppShell(req) {
  if (req.mode === "navigate") return true;
  const url = new URL(req.url);
  return url.pathname.endsWith("/") || url.pathname.endsWith("index.html");
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // App-Seite: Netzwerk zuerst, damit Updates sofort ankommen
  if (isAppShell(req)) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", clone));
        }
        return res;
      }).catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Übrige Assets: aus Cache liefern, im Hintergrund aktualisieren
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
