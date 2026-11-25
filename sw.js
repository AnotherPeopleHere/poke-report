/* Service worker: only for notifications (the live tournament). It does not cache anything. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const id = (e.notification.data || {}).id;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    const c = all.find(w => w.url.startsWith(self.registration.scope));
    if(c){ await c.focus(); c.postMessage({type:'live', id}); return; }
    await self.clients.openWindow(self.registration.scope + '?live=' + encodeURIComponent(id || '') + '#tornei');
  })());
});
