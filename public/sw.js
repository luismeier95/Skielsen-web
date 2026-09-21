/* SKIELSEN PWA service worker · 15.1.112
   Intentionally no offline cache yet: this enables install/app display mode without
   introducing stale tournament runtime assets. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
