/* Service worker: only for the notification of the live tournament. It does not cache anything.
   The notification shows the tournament, the record, the last round and the round timer, with a play/pause button
   that works even with the app closed (the new timer is kept in the notification and the app reads it when it opens). */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

const fmt = ms => { const s=Math.ceil(Math.max(0,ms)/1000), m=Math.floor(s/60); return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
const hhmm = ts => { const d=new Date(ts); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const left = tm => !tm ? 0 : Math.max(0, tm.run ? tm.end-Date.now() : tm.left);
function show(o){
  const d=o.data, tm=d.timer, l=left(tm);
  const time = !tm ? '' : tm.run ? (l>0 ? `⏱ ${fmt(l)} · fine alle ${hhmm(tm.end)}` : '⏱ Tempo scaduto') : (l<tm.dur ? `⏸ In pausa · ${fmt(l)}` : `⏱ ${fmt(l)} · timer fermo`);
  const opts = {...o, body:`Record ${d.rec}${d.last?` · ultimo round: ${d.last}`:''}\n${time}`,
    actions:[{action:'timer', title: tm && tm.run ? '❚❚ Pausa' : '▶ Avvia timer'}, {action:'open', title:'Apri'}]};
  return self.registration.showNotification(`● LIVE · ${d.name} · Round ${d.n}`, opts);
}
async function openApp(id){
  const all = await self.clients.matchAll({type:'window', includeUncontrolled:true});
  const c = all.find(w => w.url.startsWith(self.registration.scope));
  if(c){ await c.focus(); c.postMessage({type:'live', id}); return; }
  await self.clients.openWindow(self.registration.scope + '?live=' + encodeURIComponent(id || '') + '#tornei');
}
// the app asks for the notification to be drawn (or redrawn)
self.addEventListener('message', e => { if(e.data && e.data.type==='live-note') e.waitUntil(show(e.data.opts)); });
self.addEventListener('notificationclick', e => {
  const n=e.notification, d=n.data||{};
  if(e.action==='timer' && d.timer){
    const now=Date.now(), tm=d.timer, t2 = tm.run ? {...tm, run:false, left:Math.max(0,tm.end-now), at:now} : {...tm, run:true, end:now+left(tm), at:now};
    e.waitUntil((async () => {
      await show({tag:n.tag, renotify:false, silent:true, requireInteraction:true, icon:n.icon, badge:n.badge, data:{...d, timer:t2}});
      (await self.clients.matchAll({type:'window', includeUncontrolled:true})).forEach(c=>c.postMessage({type:'timer', id:d.id, timer:t2}));
    })());
    return;
  }
  n.close();
  e.waitUntil(openApp(d.id));
});
