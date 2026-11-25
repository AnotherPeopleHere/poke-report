/* ===== Poke Report core: theme, storage (Supabase or this browser), account, router ===== */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const ls = { get(k,d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };
const clone = o => JSON.parse(JSON.stringify(o));

/* theme */
function applyTheme(t){
  if(t==='light'||t==='dark') document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme');
  document.querySelectorAll('[data-theme-set]').forEach(b=>{ const on=b.dataset.themeSet===t; b.setAttribute('aria-pressed',on); b.setAttribute('aria-checked',on); });
}
applyTheme(ls.get('hub.theme','system'));
$('#theme').addEventListener('click',e=>{ const b=e.target.closest('[data-theme-set]'); if(!b) return; ls.set('hub.theme',b.dataset.themeSet); applyTheme(b.dataset.themeSet); });

/* ---------- Supabase client (only when configured) ---------- */
const CFG = window.HUB_CONFIG || {};
const sb = (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase)
  ? window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {auth:{flowType:'pkce', persistSession:true, autoRefreshToken:true, detectSessionInUrl:true}})
  : null;

/* ---------- archetype names ----------
   The same deck can be typed in many ways ("N's Zoroark", "N’s Zoroark ex", "n's zoroark EX"): compare names by a key
   without case, accents, apostrophe style, punctuation and the "ex" suffix, and show the name used by the meta report. */
const archKey = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’‘`´]/g,"'")
  .replace(/[-_/.,;:+&()]+/g,' ').split(/\s+/).filter(w=>w && w!=='ex').join(' ');
const ARCH = new Map();
['metaData','recoData'].forEach(id=>{ try{ const d=JSON.parse(document.getElementById(id).textContent);
  (Array.isArray(d)?d:d.archetypes||[]).forEach(a=>{ const k=archKey(a.name); if(k && !ARCH.has(k)) ARCH.set(k,a.name); }); }catch(e){} });
const archCanon = s => { const t=String(s||'').trim().replace(/\s+/g,' '), k=archKey(t); if(ARCH.has(k)) return ARCH.get(k);
  // a name typed short ("Zoroark") that is part of exactly one known archetype's name
  const w=k.split(' ').filter(x=>x.length>2 && x!=='mega'); if(!w.length) return t;
  const hits=[...new Set([...ARCH.values()])].filter(n=>{ const nw=archKey(n).split(' '); return w.every(x=>nw.includes(x)) && nw.length<=w.length+1; });
  return hits.length===1 ? hits[0] : t; };
const canonT = t => { if(!t) return t;
  // with a list attached, the archetype comes from the cards (like Limitless); otherwise from the name typed
  const fromList = t.list && window.DeckLab && window.DeckLab.archOf ? window.DeckLab.archOf(t.list, t.deckName) : '';
  if(fromList){ if(t.deckName && archCanon(t.deckName)!==archCanon(fromList)) t.deckTyped=t.deckName; t.deckName=archCanon(fromList); }
  else if(t.deckName) t.deckName=archCanon(t.deckName); (t.rounds||[]).forEach(r=>{ if(r && r.opp) r.opp=archCanon(r.opp); }); return t; };

// save pending preferences when the page is hidden or closed
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') Store.flushPrefs(); });
addEventListener('pagehide',()=>Store.flushPrefs());

// the opening animation greets signed-in users by name: remember it in this browser (it runs before the account loads)
function rememberWho(){ try{ if(Store.user && Store.profile && Store.profile.display_name) localStorage.setItem('pr.who', Store.profile.display_name); }catch(_){} }

/* ---------- phone bottom navigation: "Altro" sheet ---------- */
function bmoreOpen(open){ const m=document.getElementById('bmore'), b=document.getElementById('bnMore'); if(!m) return;
  if(open){ m.hidden=false; requestAnimationFrame(()=>m.classList.add('open')); } else { m.classList.remove('open'); setTimeout(()=>{ if(!m.classList.contains('open')) m.hidden=true; },220); }
  if(b) b.setAttribute('aria-expanded', open); }
document.addEventListener('click',e=>{
  if(e.target.closest('#bnMore')){ bmoreOpen(document.getElementById('bmore').hidden); return; }
  const m=document.getElementById('bmore'); if(m && !m.hidden && (e.target===m || e.target.closest('#bmore a'))) bmoreOpen(false);
});
document.addEventListener('keydown',e=>{ if(e.key==='Escape') bmoreOpen(false); });

/* ---------- storage ---------- */
const Store = {
  mode:'local', user:null, profile:null,
  local(){ return {prefs:ls.get('hub.prefs',null), decks:ls.get('hub.decks',[]), tournaments:ls.get('hub.tournaments',[]).map(canonT)}; },
  async load(){
    if(!sb || !this.user) { this.mode='local'; return this.local(); }
    const uid = this.user.id;
    try{
      const [p,d,t] = await Promise.all([
        sb.from('profiles').select('*').eq('id',uid).maybeSingle(),
        sb.from('decks').select('*').eq('user_id',uid),
        sb.from('tournaments').select('*').eq('user_id',uid)]);
      if(p.error||d.error||t.error) throw (p.error||d.error||t.error);
      this.mode='cloud';
      this.profile = p.data || null;
      const out = {prefs: (p.data && p.data.prefs) || null,
        decks: (d.data||[]).map(r=>({id:r.id, name:r.name, cards:r.cards||[], updated:Date.parse(r.updated_at)||0})),
        tournaments: (t.data||[]).map(r=>canonT({...r.data, id:r.id}))};
      if(!this.profile) await this.saveProfile({display_name: (this.user.email||'').split('@')[0], prefs: out.prefs||{}});
      // first sign-in on this browser: move what was stored locally into the account
      const loc = this.local();
      if(!ls.get('hub.migrated.'+uid,false) && (loc.decks.length || loc.tournaments.length)){
        for(const x of loc.decks) if(!out.decks.some(y=>y.id===x.id)){ out.decks.push(x); await this.put('decks',x); }
        for(const x of loc.tournaments) if(!out.tournaments.some(y=>y.id===x.id)){ out.tournaments.push(x); await this.put('tournaments',x); }
        if(!out.prefs && loc.prefs){ out.prefs = loc.prefs; await this.saveProfile({prefs:loc.prefs}); }
        App.toast('Ho copiato sul tuo account i dati che avevi in questo browser.');
      }
      ls.set('hub.migrated.'+uid,true);
      return out;
    }catch(e){
      console.error(e); this.mode='local'; this.failed=true;
      App.toast('Non riesco a leggere i dati dal tuo account: per ora uso quelli di questo browser.');
      return this.local();
    }
  },
  async put(coll, obj){
    if(this.mode==='cloud'){
      const uid=this.user.id; let row;
      if(coll==='decks') row={user_id:uid, id:obj.id, name:obj.name, cards:obj.cards, updated_at:new Date().toISOString()};
      else { const {id, ...data} = clone(obj); row={user_id:uid, id, date:obj.date||null, data, updated_at:new Date().toISOString()}; }
      const {error} = await sb.from(coll).upsert(row, {onConflict:'user_id,id'});
      if(error){ console.error(error); App.toast('Non sono riuscito a salvare: controlla la connessione e riprova.'); return false; }
      return true;
    }
    ls.set('hub.'+coll, App.data[coll]); return true;
  },
  async del(coll, id){
    if(this.mode==='cloud'){
      const {error} = await sb.from(coll).delete().eq('user_id',this.user.id).eq('id',id);
      if(error){ console.error(error); App.toast('Non sono riuscito a eliminare: riprova.'); return false; }
      return true;
    }
    ls.set('hub.'+coll, App.data[coll]); return true;
  },
  async saveProfile(patch){
    if(!sb || !this.user) return false;
    const row = {id:this.user.id, ...(this.profile||{}), ...patch, updated_at:new Date().toISOString()};
    const {data, error} = await sb.from('profiles').upsert(row).select().maybeSingle();
    if(error){ console.error(error); App.toast('Non sono riuscito a salvare il profilo.'); return false; }
    this.profile = data || row; rememberWho(); return true;
  },
  _pt:null,
  savePrefs(){
    clearTimeout(this._pt);
    this._pf = () => { this._pf=null; const snap = clone(App.data.prefs||{});
      if(this.mode==='cloud') this.saveProfile({prefs:snap}); else ls.set('hub.prefs', snap); };
    this._pt = setTimeout(()=>this._pf && this._pf(), 600);
  },
  flushPrefs(){ clearTimeout(this._pt); if(this._pf) this._pf(); },
  /* group: members who share the same group code and their tournaments (row-level security decides what is visible) */
  async group(){
    if(this.mode!=='cloud' || !this.profile || !this.profile.group_code) return null;
    let m = await sb.from('profiles').select('id,display_name,share_stats,avatar_url').eq('group_code', this.profile.group_code);
    if(m.error && /avatar_url/.test(m.error.message||'')) m = await sb.from('profiles').select('id,display_name,share_stats').eq('group_code', this.profile.group_code);
    if(m.error) throw m.error;
    const ids = (m.data||[]).map(x=>x.id);
    const t = ids.length ? await sb.from('tournaments').select('user_id,id,data').in('user_id', ids) : {data:[]};
    if(t.error) throw t.error;
    return {members:m.data||[], tournaments:(t.data||[]).map(r=>canonT({...r.data, id:r.id, user_id:r.user_id}))};
  }
};

const App = window.App = {
  ls, Store, sb, archKey, archCanon, canonT, bmoreOpen, data:{prefs:null, decks:[], tournaments:[]}, page:'home', ready:false,
  _subs:[], on(fn){ this._subs.push(fn); }, emit(what){ this._subs.forEach(f=>{ try{ f(what); }catch(e){ console.error(e); } }); },
  uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); },
  toast(msg){ const t=$('#toast'); if(!t) return; t.innerHTML=''; const s=document.createElement('span'); s.textContent=msg; t.appendChild(s); t.hidden=false; clearTimeout(App._tt); App._tt=setTimeout(()=>t.hidden=true,3600); },
  prefs(){ if(!this.data.prefs) this.data.prefs={}; return this.data.prefs; },
  esc
};

/* ---------- router ---------- */
const PAGES = ['home','deck','meta','consigli','news','tornei','gruppo','metafy'];
function route(){
  let p = location.hash.replace('#','') || 'home';
  if(!PAGES.includes(p)) p='home';
  App.page = p;
  document.querySelectorAll('.page').forEach(s=>s.classList.toggle('on', s.dataset.page===p));
  document.querySelectorAll('#sitenav a, #bnav a, #bmore a').forEach(a=>{ if(a.dataset.p===p) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  // the 5th item shows the current "more" page (its icon and name); on the group page it also opens its sections
  const MORE={gruppo:['i-group','Gruppo'],news:['i-news','Notizie'],consigli:['i-star','Consigli'],metafy:['i-coach','Metafy']};
  const more=document.getElementById('bnMore'); if(more){ const m=MORE[p]; more.classList.toggle('on', !!m); more.classList.toggle('has-sub', p==='gruppo');
    more.querySelector('use').setAttribute('href','#'+(m?m[0]:'i-more')); more.querySelector('.bn-l').textContent = m?m[1]:'Altro'; if(p!=='gruppo') more.querySelector('.bn-sub').textContent=''; }
  const sub=document.getElementById('bmoreSub'); if(sub) sub.hidden = p!=='gruppo';
  bmoreOpen(false);
  document.body.classList.toggle('on-deck', p==='deck');
  moveIndicator(true);
  App.emit('page');
  window.scrollTo({top:0});
}
window.addEventListener('hashchange', route);
// "Annulla" / "Chiudi" always close a dialog, even when a required field is still empty
document.addEventListener('click', e=>{
  const b = e.target.closest('dialog button[value="close"]');
  if(!b) return;
  e.preventDefault(); const d = b.closest('dialog'); if(d && d.open) d.close();
}, true);
// on phones wide tables become one small card per row: give every cell its column title
function labelTables(){
  document.querySelectorAll('table.stack').forEach(t=>{
    const heads=[...t.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    if(!heads.length) return;
    t.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>{ if(td.dataset.l===undefined) td.dataset.l = td.colSpan>1 ? '' : (heads[i]||''); }));
  });
}
let labelQueued=false;
new MutationObserver(()=>{ if(labelQueued) return; labelQueued=true; requestAnimationFrame(()=>{ labelQueued=false; labelTables(); }); }).observe(document.body,{childList:true,subtree:true});
function moveIndicator(scroll){
  const nav=$('#sitenav'); if(!nav) return;
  let ind=nav.querySelector('.ind'); if(!ind){ ind=document.createElement('span'); ind.className='ind'; ind.setAttribute('aria-hidden','true'); nav.prepend(ind); }
  const a=nav.querySelector('a[aria-current="page"]'); if(!a) return;
  ind.style.width=a.offsetWidth+'px'; ind.style.transform=`translateX(${a.offsetLeft}px)`;
  if(!nav.classList.contains('ready')) requestAnimationFrame(()=>requestAnimationFrame(()=>nav.classList.add('ready')));
  if(scroll && nav.scrollWidth>nav.clientWidth){
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    nav.scrollTo({left:a.offsetLeft-(nav.clientWidth-a.offsetWidth)/2, behavior: reduce?'auto':'smooth'});
  }
}
// keep the indicator on its link when the layout changes (window size, web fonts loading)
window.addEventListener('resize',()=>moveIndicator(false));
if(document.fonts && document.fonts.ready) document.fonts.ready.then(()=>moveIndicator(false));
App.route = route;

/* ---------- profile photos ---------- */
function hue(s){ let h=0; for(const ch of String(s||'')) h=(h*31+ch.charCodeAt(0))%360; return h; }
// a person's photo, or their initial on a colour derived from the name
App.avatar = (name, url, size) => {
  const st = size ? `width:${size}px;height:${size}px;font-size:${Math.round(size*.42)}px;` : '';
  if(url) return `<img class="av av-img" src="${esc(url)}" alt="" loading="lazy" style="${st}">`;
  return `<span class="av" style="${st}background:hsl(${hue(name)} 55% 45%)">${esc(String(name||'?').trim().charAt(0).toUpperCase()||'?')}</span>`;
};
// square-crop and shrink a picture on the device before uploading it (keeps uploads to a few KB)
async function squareImage(file, side, crop){
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height), cv = document.createElement('canvas'); cv.width = cv.height = side;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingQuality = 'high';
  const c = crop || {x:(bmp.width - s)/2, y:(bmp.height - s)/2, s};   // the square chosen in the editor, or the centre
  ctx.drawImage(bmp, c.x, c.y, c.s, c.s, 0, 0, side, side); if(bmp.close) bmp.close();
  let blob = await new Promise(r => cv.toBlob(r, 'image/webp', .86));
  if(!blob || blob.type !== 'image/webp') blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .88));   // Safari without WebP encoding
  return blob;
}
/* photo editor: drag to move, slider (or wheel / pinch) to zoom; resolves with the square to keep, in pixels of the original */
function cropEditor(file){
  return new Promise(async resolve=>{
    let bmp; try{ bmp = await createImageBitmap(file); }catch(e){ App.toast('Non riesco ad aprire questa immagine'); return resolve(null); }
    const W=bmp.width, H=bmp.height, url=URL.createObjectURL(file), box=document.createElement('div'); box.className='crop';
    box.innerHTML=`<div class="crop-in"><b>Posiziona la foto</b><span class="hint">Trascina per spostarla, usa il cursore per ingrandirla.</span>
      <div class="crop-v"><img src="${url}" alt="" draggable="false"></div>
      <input type="range" class="crop-z" min="1" max="4" step="0.01" value="1" aria-label="Ingrandimento">
      <div class="row"><button type="button" class="btn" data-c="no">Annulla</button><button type="button" class="btn primary" data-c="ok">Usa questa foto</button></div></div>`;
    $('#dlg2Body').appendChild(box);
    const v=box.querySelector('.crop-v'), im=box.querySelector('img'), zr=box.querySelector('.crop-z');
    let V=0, base=1, z=1, ox=0, oy=0;
    const clamp=()=>{ const sc=base*z; ox=Math.min(0,Math.max(V-W*sc,ox)); oy=Math.min(0,Math.max(V-H*sc,oy)); };
    const draw=()=>{ const sc=base*z; clamp(); im.style.width=W*sc+'px'; im.style.height=H*sc+'px'; im.style.transform=`translate(${ox}px,${oy}px)`; };
    const init=()=>{ V=v.clientWidth; base=V/Math.min(W,H); ox=(V-W*base)/2; oy=(V-H*base)/2; draw(); };
    requestAnimationFrame(init);
    const zoomTo=(nz,cx,cy)=>{ nz=Math.min(4,Math.max(1,nz)); const a=base*z, b=base*nz; ox=cx-(cx-ox)*b/a; oy=cy-(cy-oy)*b/a; z=nz; zr.value=z; draw(); };
    zr.addEventListener('input',()=>zoomTo(+zr.value,V/2,V/2));
    v.addEventListener('wheel',e=>{ e.preventDefault(); const r=v.getBoundingClientRect(); zoomTo(z*(e.deltaY<0?1.08:1/1.08),e.clientX-r.left,e.clientY-r.top); },{passive:false});
    const pts=new Map(); let last=null, pinch=0;
    v.addEventListener('pointerdown',e=>{ v.setPointerCapture(e.pointerId); pts.set(e.pointerId,[e.clientX,e.clientY]); last=[e.clientX,e.clientY]; });
    v.addEventListener('pointermove',e=>{ if(!pts.has(e.pointerId)) return; pts.set(e.pointerId,[e.clientX,e.clientY]);
      if(pts.size===2){ const [a,b]=[...pts.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]); if(pinch){ const r=v.getBoundingClientRect(); zoomTo(z*d/pinch,(a[0]+b[0])/2-r.left,(a[1]+b[1])/2-r.top); } pinch=d; return; }
      ox+=e.clientX-last[0]; oy+=e.clientY-last[1]; last=[e.clientX,e.clientY]; draw(); });
    const up=e=>{ pts.delete(e.pointerId); pinch=0; if(pts.size===1) last=[...pts.values()][0]; };
    v.addEventListener('pointerup',up); v.addEventListener('pointercancel',up);
    const end=val=>{ box.remove(); URL.revokeObjectURL(url); if(bmp.close) bmp.close(); resolve(val); };
    box.addEventListener('click',e=>{ const b=e.target.closest('[data-c]'); if(!b) return; if(b.dataset.c==='no') return end(null);
      const sc=base*z; end({x:-ox/sc, y:-oy/sc, s:V/sc}); });
  });
}
const AVATAR_BUCKET = 'avatars';
const avatarPath = url => { const m = String(url||'').match(/\/storage\/v1\/object\/public\/avatars\/(.+?)(\?|$)/); return m ? decodeURIComponent(m[1]) : null; };
async function uploadAvatar(file, crop){
  if(!/^image\//.test(file.type)) throw new Error('Scegli un file immagine (JPG, PNG, WebP, HEIC…).');
  const blob = await squareImage(file, 256, crop);
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${Store.user.id}/avatar-${Date.now()}.${ext}`;
  const up = await sb.storage.from(AVATAR_BUCKET).upload(path, blob, {contentType: blob.type, cacheControl: '31536000', upsert: false});
  if(up.error) throw up.error;
  const url = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
  const old = avatarPath(Store.profile && Store.profile.avatar_url);
  const ok = await Store.saveProfile({avatar_url: url});
  if(!ok){ await sb.storage.from(AVATAR_BUCKET).remove([path]); throw new Error('profile'); }
  if(old && old !== path) sb.storage.from(AVATAR_BUCKET).remove([old]);
  return url;
}
async function removeAvatar(){
  const old = avatarPath(Store.profile && Store.profile.avatar_url);
  const ok = await Store.saveProfile({avatar_url: null});
  if(ok && old) await sb.storage.from(AVATAR_BUCKET).remove([old]);
  return ok;
}

/* ---------- account UI ---------- */
function renderAccount(){
  const b=$('#acct');
  if(!sb){ b.innerHTML='<i></i><span>Dati in questo browser</span>'; b.className='sync'; b.title='Accesso non ancora configurato: i dati restano in questo browser.'; return; }
  if(Store.user){ const p=Store.profile||{}, n=p.display_name||Store.user.email; b.className='sync cloud has-av'; b.innerHTML=`${App.avatar(n, p.avatar_url, 26)}<span>${esc(n)}</span>`; b.title='Il tuo profilo e il gruppo'; }
  else { b.className='sync'; b.innerHTML='<i></i><span>Accedi</span>'; b.title='Accedi per salvare i dati sul tuo account e vedere il gruppo'; }
}
/* settings shared by the profile and the sign-in dialog: theme, opening animation, guides */
function settingsHtml(){
  const th=ls.get('hub.theme','system'), intro=ls.get('pr.noIntro',false)!==true;
  return `<section class="pf-sec"><h3>Impostazioni</h3>
    <div class="pf-row"><div><b>Tema</b><span class="hint">Vale su questo dispositivo.</span></div>
      <span class="seg" id="pfTheme">${[['light','i-sun','Chiaro'],['system','i-auto','Sistema'],['dark','i-moon','Scuro']].map(([k,ic,l])=>`<button type="button" data-theme-set="${k}" aria-pressed="${th===k}"><svg class="i"><use href="#${ic}"/></svg>${l}</button>`).join('')}</span></div>
    <label class="switch inline pf-sw" for="pfIntro"><input type="checkbox" id="pfIntro" role="switch"${intro?' checked':''}><span class="track" aria-hidden="true"></span><span><b>Animazione d'apertura</b><small class="hint">Il Pokédex che si apre all'avvio</small></span></label>
    <label class="switch inline pf-sw" for="pfDot"><input type="checkbox" id="pfDot" role="switch"${ls.get('pr.noTourDot',false)!==true?' checked':''}><span class="track" aria-hidden="true"></span><span><b>Segnala le guide da vedere</b><small class="hint">Il puntino colorato sul “?” delle pagine</small></span></label>
    <div class="pf-row"><div><b>Guide delle pagine</b><span class="hint">Segna di nuovo tutte le guide come da vedere.</span></div><button type="button" class="btn small" id="pfTours">Mostra di nuovo</button></div>
  </section>`;
}
function bindSettings(){
  $('#pfTheme').addEventListener('click',e=>{ const b=e.target.closest('[data-theme-set]'); if(!b) return; ls.set('hub.theme',b.dataset.themeSet); applyTheme(b.dataset.themeSet); });
  $('#pfIntro').addEventListener('change',e=>ls.set('pr.noIntro',!e.target.checked));
  $('#pfDot').addEventListener('change',e=>{ ls.set('pr.noTourDot',!e.target.checked); App.emit('page'); });
  $('#pfTours').addEventListener('click',()=>{ try{ Object.keys(localStorage).filter(k=>k.startsWith('pr.tour.')).forEach(k=>localStorage.removeItem(k)); }catch(_){} App.emit('page'); App.toast('Le guide sono di nuovo da vedere'); });
}
function accountDialog(){
  const d=$('#dlg2'), body=$('#dlg2Body');
  if(!sb){ body.innerHTML=`<h2>Account</h2><p>L’accesso non è ancora attivo su questo sito: mazzi e tornei restano salvati in questo browser.</p><div class="row"><button class="btn" value="close">Chiudi</button></div>`; d.showModal(); return; }
  if(!Store.user){
    body.innerHTML=`<h2>Accedi</h2>
      <p class="hint">Inserisci la tua email: ti mandiamo un link per entrare, senza password. Aprilo su questo stesso dispositivo e browser.</p>
      <div class="form"><label class="full">Email<input id="lgMail" type="email" autocomplete="email" placeholder="nome@esempio.it"></label></div>
      <div class="row"><span class="hint" id="lgMsg"></span><button class="btn" value="close">Annulla</button><button class="btn primary" type="button" id="lgGo">Mandami il link</button></div>
      <div class="pf-body" style="margin-top:12px">${settingsHtml()}</div>`;
    d.showModal(); bindSettings();
    $('#lgGo').addEventListener('click', async ()=>{
      const email=$('#lgMail').value.trim(); if(!/^\S+@\S+\.\S+$/.test(email)){ $('#lgMsg').textContent='Controlla l’indirizzo email.'; return; }
      $('#lgGo').disabled=true; $('#lgMsg').textContent='Invio in corso…';
      const {error} = await sb.auth.signInWithOtp({email, options:{emailRedirectTo: location.origin + location.pathname}});
      $('#lgGo').disabled=false;
      $('#lgMsg').textContent = error ? (/rate|limit/i.test(error.message)?'Troppe richieste: riprova tra qualche minuto.':'Non sono riuscito a inviare il link: riprova.') : 'Fatto! Controlla la posta (anche lo spam) e apri il link.';
    });
    return;
  }
  const p=Store.profile||{};
  body.innerHTML=`<div class="dlg-h"><div class="pf-head"><div class="pf-av" id="pfAv">${App.avatar(p.display_name||Store.user.email, p.avatar_url, 64)}</div>
      <div><h2>${esc(p.display_name||'Il tuo profilo')}</h2><p class="hint">${esc(Store.user.email)}</p></div></div>
      <button class="xclose" type="button" value="close" aria-label="Chiudi">✕</button></div>
    <div class="pf-body">
    <section class="pf-sec"><h3>Profilo</h3>
      <div class="pf-row"><div><b>Foto</b><span class="hint">La vedono i tuoi amici nel gruppo, ritagliata al centro.</span><span class="hint" id="pfAvMsg" aria-live="polite"></span></div>
        <div class="pf-btns"><label class="btn small" for="pfFile"><svg class="i"><use href="#i-img"/></svg><span id="pfPick">${p.avatar_url?'Cambia':'Scegli'}</span></label>
          <input type="file" id="pfFile" accept="image/*" hidden><button class="btn small" type="button" id="pfRm"${p.avatar_url?'':' hidden'}>Rimuovi</button></div></div>
      <div class="form">
      <label class="full">Nome visibile agli amici<input id="pfName" maxlength="40" value="${esc(p.display_name||'')}"></label>
      <label class="full">Pokémon preferito <small class="src">(compare all'apertura, accanto ai titoli e nel menu a ruota)</small>
        <span class="pf-mon"><span id="pfMonPrev"></span><input id="pfMon" list="pfMonList" autocomplete="off" placeholder="Cerca un Pokémon (nome italiano o inglese)…" value="${esc((App.prefs().favMon||{}).n||'')}"><button type="button" class="btn small" id="pfMonX"${App.prefs().favMon?'':' hidden'}>Togli</button></span>
        <datalist id="pfMonList"></datalist></label>
      </div>
    </section>
    <section class="pf-sec"><h3>Gruppo</h3><div class="form">
      <label class="full">Codice del gruppo<input id="pfGroup" maxlength="40" placeholder="es. amici-pokemon-torino" value="${esc(p.group_code||'')}"><small class="src">Chi inserisce lo stesso codice entra nel tuo gruppo e vede la classifica. Sceglilo difficile da indovinare e condividilo solo con i tuoi amici.</small></label>
      <label class="switch inline full" for="pfShare"><input type="checkbox" id="pfShare" role="switch"${p.share_stats!==false?' checked':''}><span class="track" aria-hidden="true"></span><span>Mostra i miei tornei al gruppo</span></label>
    </div></section>
    ${settingsHtml()}
    </div>
    <div class="row"><button class="btn" type="button" id="pfOut">Esci</button><span class="hint" id="pfMsg"></span><button class="btn" value="close">Chiudi</button><button class="btn primary" type="button" id="pfSave">Salva</button></div>`;
  d.classList.add('sheet'); d.addEventListener('close',()=>d.classList.remove('sheet'),{once:true}); bindSettings();
  d.showModal();
  $('#pfSave').addEventListener('click', async ()=>{
    const group=$('#pfGroup').value.trim().toLowerCase().replace(/\s+/g,'-');
    const ok = await Store.saveProfile({display_name:$('#pfName').value.trim()||null, group_code:group||null, share_stats:$('#pfShare').checked});
    if(ok){ d.close(); renderAccount(); App.toast('Profilo salvato'); App.emit('group'); }
  });
  $('#pfOut').addEventListener('click', async ()=>{ await sb.auth.signOut(); d.close(); });
  const monPrev=()=>{ const m=App.prefs().favMon; $('#pfMonPrev').innerHTML = m && App.monImg ? App.monImg(m) : ''; $('#pfMonX').hidden=!m; };
  monPrev();
  let DEX=[]; if(App.monList) App.monList().then(L=>{ DEX=L; const o=[]; L.forEach(m=>{ o.push(`<option value="${esc(m.n)}">`); if(m.it!==m.n) o.push(`<option value="${esc(m.it)}">`); }); $('#pfMonList').innerHTML=o.join(''); }).catch(()=>{});
  $('#pfMon').addEventListener('change',()=>{ const v=$('#pfMon').value.trim().toLowerCase(); const m=DEX.find(x=>x.n.toLowerCase()===v||x.it.toLowerCase()===v);
    if(!m){ if(v) App.toast('Pokémon non trovato: sceglilo dai suggerimenti'); return; } App.prefs().favMon={n:m.n, sd:m.sd, id:m.id}; App.Store.savePrefs(); monPrev(); App.drawMascots&&App.drawMascots(); });
  $('#pfMonX').addEventListener('click',()=>{ delete App.prefs().favMon; try{ localStorage.removeItem('pr.mon'); }catch(_){} App.Store.savePrefs(); $('#pfMon').value=''; monPrev(); App.drawMascots&&App.drawMascots(); });
  const avMsg = t => { $('#pfAvMsg').textContent = t; };
  const refreshPhoto = () => { const q=Store.profile||{}; $('#pfAv').innerHTML = App.avatar(q.display_name||Store.user.email, q.avatar_url, 64);
    $('#pfPick').textContent = q.avatar_url ? 'Cambia' : 'Scegli'; $('#pfRm').hidden = !q.avatar_url; renderAccount(); App.emit('group'); };
  $('#pfFile').addEventListener('change', async e=>{
    const f=e.target.files[0]; e.target.value=''; if(!f) return;
    if(f.size > 25e6){ avMsg('La foto è troppo grande (massimo 25 MB).'); return; }
    if(!/^image\//.test(f.type)){ avMsg('Scegli un file immagine (JPG, PNG, WebP, HEIC…).'); return; }
    const crop = await cropEditor(f); if(!crop) return;   // the user positions the photo first
    $('#pfAv').classList.add('busy'); avMsg('Carico la foto…');
    try{ await uploadAvatar(f, crop); refreshPhoto(); avMsg('Foto aggiornata.'); }
    catch(err){ console.error(err); avMsg(err && err.message && /immagine/.test(err.message) ? err.message : (err && /bucket|not found|policy|row-level/i.test(err.message||'') ? 'Le foto non sono ancora attive su questo sito.' : 'Non sono riuscito a caricare la foto: riprova.')); }
    $('#pfAv').classList.remove('busy');
  });
  $('#pfRm').addEventListener('click', async ()=>{ avMsg('Rimuovo…'); if(await removeAvatar()){ refreshPhoto(); avMsg('Foto rimossa.'); } else avMsg('Non sono riuscito a rimuoverla: riprova.'); });
}
$('#acct').addEventListener('click', accountDialog);
App.accountDialog = accountDialog;

/* ---------- boot ---------- */
App.boot = async function(){
  App.data = Store.local(); renderAccount(); App.ready = true; App.emit('data');
  if(!sb) return;
  const {data} = await sb.auth.getSession();
  if(data && data.session){ Store.user = data.session.user; App.data = await Store.load(); rememberWho(); renderAccount(); App.emit('data'); }
  sb.auth.onAuthStateChange(async (ev, session)=>{
    const u = session ? session.user : null;
    if((u && Store.user && u.id===Store.user.id) || (!u && !Store.user)) return;
    Store.user = u; Store.profile = null;
    App.data = await Store.load(); rememberWho(); if(!u){ try{ localStorage.removeItem('pr.who'); localStorage.removeItem('pr.mon'); }catch(_){} } renderAccount(); App.emit('data'); App.emit('group');
    if(u) App.toast('Accesso effettuato'); else App.toast('Sei uscito: ora vedi i dati di questo browser.');
  });
};
})();
