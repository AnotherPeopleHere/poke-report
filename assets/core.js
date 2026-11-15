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

/* ---------- storage ---------- */
const Store = {
  mode:'local', user:null, profile:null,
  local(){ return {prefs:ls.get('hub.prefs',null), decks:ls.get('hub.decks',[]), tournaments:ls.get('hub.tournaments',[])}; },
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
        tournaments: (t.data||[]).map(r=>({...r.data, id:r.id}))};
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
    this.profile = data || row; return true;
  },
  _pt:null,
  savePrefs(){
    clearTimeout(this._pt);
    this._pt = setTimeout(()=>{
      const snap = clone(App.data.prefs||{});
      if(this.mode==='cloud') this.saveProfile({prefs:snap}); else ls.set('hub.prefs', snap);
    }, 600);
  },
  /* group: members who share the same group code and their tournaments (row-level security decides what is visible) */
  async group(){
    if(this.mode!=='cloud' || !this.profile || !this.profile.group_code) return null;
    const m = await sb.from('profiles').select('id,display_name,share_stats').eq('group_code', this.profile.group_code);
    if(m.error) throw m.error;
    const ids = (m.data||[]).map(x=>x.id);
    const t = ids.length ? await sb.from('tournaments').select('user_id,id,data').in('user_id', ids) : {data:[]};
    if(t.error) throw t.error;
    return {members:m.data||[], tournaments:(t.data||[]).map(r=>({...r.data, id:r.id, user_id:r.user_id}))};
  }
};

const App = window.App = {
  ls, Store, sb, data:{prefs:null, decks:[], tournaments:[]}, page:'home', ready:false,
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
  document.querySelectorAll('#sitenav a').forEach(a=>{ if(a.dataset.p===p) a.setAttribute('aria-current','page'); else a.removeAttribute('aria-current'); });
  document.body.classList.toggle('on-deck', p==='deck');
  App.emit('page');
  window.scrollTo({top:0});
}
window.addEventListener('hashchange', route);
App.route = route;

/* ---------- account UI ---------- */
function renderAccount(){
  const b=$('#acct');
  if(!sb){ b.innerHTML='<i></i><span>Dati in questo browser</span>'; b.className='sync'; b.title='Accesso non ancora configurato: i dati restano in questo browser.'; return; }
  if(Store.user){ const n=(Store.profile&&Store.profile.display_name)||Store.user.email; b.className='sync cloud'; b.innerHTML=`<i></i><span>${esc(n)}</span>`; b.title='Il tuo profilo e il gruppo'; }
  else { b.className='sync'; b.innerHTML='<i></i><span>Accedi</span>'; b.title='Accedi per salvare i dati sul tuo account e vedere il gruppo'; }
}
function accountDialog(){
  const d=$('#dlg2'), body=$('#dlg2Body');
  if(!sb){ body.innerHTML=`<h2>Account</h2><p>L’accesso non è ancora attivo su questo sito: mazzi e tornei restano salvati in questo browser.</p><div class="row"><button class="btn" value="close">Chiudi</button></div>`; d.showModal(); return; }
  if(!Store.user){
    body.innerHTML=`<h2>Accedi</h2>
      <p class="hint">Inserisci la tua email: ti mandiamo un link per entrare, senza password. Aprilo su questo stesso dispositivo e browser.</p>
      <div class="form"><label class="full">Email<input id="lgMail" type="email" autocomplete="email" placeholder="nome@esempio.it"></label></div>
      <div class="row"><span class="hint" id="lgMsg"></span><button class="btn" value="close">Annulla</button><button class="btn primary" type="button" id="lgGo">Mandami il link</button></div>`;
    d.showModal();
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
  body.innerHTML=`<h2>Il tuo profilo</h2>
    <p class="hint">Accesso con ${esc(Store.user.email)}. Mazzi, tornei e preferenze sono salvati sul tuo account.</p>
    <div class="form">
      <label class="full">Nome visibile agli amici<input id="pfName" maxlength="40" value="${esc(p.display_name||'')}"></label>
      <label class="full">Codice del gruppo<input id="pfGroup" maxlength="40" placeholder="es. amici-pokemon-torino" value="${esc(p.group_code||'')}"><small class="src">Chi inserisce lo stesso codice entra nel tuo gruppo e vede la classifica. Sceglilo difficile da indovinare e condividilo solo con i tuoi amici.</small></label>
      <label class="chk full" style="flex-direction:row;color:var(--fg)"><input type="checkbox" id="pfShare" ${p.share_stats!==false?'checked':''} style="width:auto"> Mostra i miei tornei al gruppo</label>
    </div>
    <div class="row"><button class="btn" type="button" id="pfOut">Esci</button><span class="hint" id="pfMsg"></span><button class="btn" value="close">Chiudi</button><button class="btn primary" type="button" id="pfSave">Salva</button></div>`;
  d.showModal();
  $('#pfSave').addEventListener('click', async ()=>{
    const group=$('#pfGroup').value.trim().toLowerCase().replace(/\s+/g,'-');
    const ok = await Store.saveProfile({display_name:$('#pfName').value.trim()||null, group_code:group||null, share_stats:$('#pfShare').checked});
    if(ok){ d.close(); renderAccount(); App.toast('Profilo salvato'); App.emit('group'); }
  });
  $('#pfOut').addEventListener('click', async ()=>{ await sb.auth.signOut(); d.close(); });
}
$('#acct').addEventListener('click', accountDialog);
App.accountDialog = accountDialog;

/* ---------- boot ---------- */
App.boot = async function(){
  App.data = Store.local(); renderAccount(); App.ready = true; App.emit('data');
  if(!sb) return;
  const {data} = await sb.auth.getSession();
  if(data && data.session){ Store.user = data.session.user; App.data = await Store.load(); renderAccount(); App.emit('data'); }
  sb.auth.onAuthStateChange(async (ev, session)=>{
    const u = session ? session.user : null;
    if((u && Store.user && u.id===Store.user.id) || (!u && !Store.user)) return;
    Store.user = u; Store.profile = null;
    App.data = await Store.load(); renderAccount(); App.emit('data'); App.emit('group');
    if(u) App.toast('Accesso effettuato'); else App.toast('Sei uscito: ora vedi i dati di questo browser.');
  });
};
})();
