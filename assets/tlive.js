/* ===== Live tournament: register rounds one by one while you play (made for the phone), then close it.
   While it is in progress the tournament is saved with t.ongoing = true and WITHOUT the deck: friends in the group see
   the rounds and the record, not what you are playing. The deck stays in this browser (localStorage pr.live.<id>)
   and is written into the tournament only when you close it. Also: the "Registra" sheet of the phone. */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = App.esc, T = App.T;
const today = () => new Date().toISOString().slice(0,10);
const keyOf = id => 'pr.live.'+id;
const getDeck = id => { try{ return JSON.parse(localStorage.getItem(keyOf(id))||'null')||{}; }catch(e){ return {}; } };
const setDeck = (id,v) => { try{ v ? localStorage.setItem(keyOf(id), JSON.stringify(v)) : localStorage.removeItem(keyOf(id)); }catch(e){} };
const live = () => App.data.tournaments.filter(t=>t.ongoing);
const GL = T.GL, pill = x => { const r=T.roundRes(x); return `<span class="res-pill ${r||'T'}${x.id||x.bye?' id':''}">${x.bye?'BYE':x.id?'ID':r?GL[r]:'·'}</span>`; };
const dlg = $('#dlg2'), body = $('#dlg2Body');
function sheet(cls){ dlg.classList.add('sheet', cls); dlg.addEventListener('close',()=>dlg.classList.remove(cls),{once:true}); if(!dlg.open) dlg.showModal(); }
async function save(t){ const i=App.data.tournaments.findIndex(x=>x.id===t.id); if(i>=0) App.data.tournaments[i]=t; else App.data.tournaments.push(t); App.renderAll(); return App.Store.put('tournaments', t); }
const clean = x => { const o={opp:x.bye?'':(x.opp||'').trim(), bo:x.bo, games:x.id||x.bye?[]:x.games, r:T.roundRes(x)}; if(x.id) o.id=true; if(x.bye) o.bye=true; if(x.note&&x.note.trim()) o.note=x.note.trim(); return o; };

/* ---------- "Registra" sheet (phone) and desktop button ---------- */
function regSheet(){
  body.innerHTML = `<div class="dlg-h"><h2>Registra</h2><button class="xclose" type="button" value="close" aria-label="Chiudi">✕</button></div>
    <div class="reg-list">
      <button type="button" class="reg-i live" data-r="live"><svg class="i"><use href="#i-trophy"/></svg><span><b>Torneo live</b><small>Segna i round mentre giochi, poi chiudi il torneo</small></span></button>
      <button type="button" class="reg-i" data-r="add"><svg class="i"><use href="#i-plus"/></svg><span><b>Torneo completo</b><small>Un torneo già giocato, tutto in una volta</small></span></button>
      <button type="button" class="reg-i" data-r="quick"><svg class="i"><use href="#i-plus"/></svg><span><b>Partita veloce</b><small>Una singola partita, senza torneo</small></span></button>
      <button type="button" class="reg-i" data-r="tl"><svg class="i"><use href="#i-in"/></svg><span><b>Importa da TCG Live</b><small>Incolla il registro di una partita</small></span></button>
    </div>`;
  sheet('regdlg');
  body.querySelector('.reg-list').addEventListener('click',e=>{ const b=e.target.closest('[data-r]'); if(!b) return; const r=b.dataset.r; dlg.close();
    setTimeout(()=>{ if(r==='live') startForm(); else if(r==='add') $('#bAddT').click(); else if(r==='quick') $('#bQuick').click(); else $('#bTL').click(); }, 280); });
}
$('#tRegM').addEventListener('click',regSheet);
const dl=document.createElement('button'); dl.type='button'; dl.className='btn'; dl.id='bLiveT'; dl.innerHTML='<svg class="i"><use href="#i-trophy"/></svg>Torneo live';
$('#bAddT').parentNode.insertBefore(dl, $('#bAddT')); dl.addEventListener('click',()=>startForm());

/* ---------- start ---------- */
function startForm(){
  const decks=App.data.decks.slice().sort((a,b)=>a.name.localeCompare(b.name)), fav=App.prefs().favDeck||'';
  body.innerHTML = `<div class="dlg-h"><div><h2>Torneo live</h2><p class="hint" style="margin:2px 0 0">Segni i round mentre giochi. Il gruppo vede l’andamento, ma non il tuo mazzo finché non chiudi il torneo.</p></div><button class="xclose" type="button" value="close" aria-label="Chiudi">✕</button></div>
    <div class="form">
      <label class="full">Nome dell'evento<input id="lvName" placeholder="es. League Cup Milano"></label>
      <label>Data<input id="lvDate" type="date" value="${today()}"></label>
      <label>Tipo<select id="lvType">${T.TYPES.filter(x=>x!=='TCG Live').map(x=>`<option>${esc(x)}</option>`).join('')}</select></label>
      <label>Mazzo salvato<select id="lvDeck"><option value="">— Nessuno / scrivo l'archetipo —</option>${decks.map(d=>`<option value="${esc(d.id)}" ${d.id===fav?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label>
      <label>Archetipo giocato<input id="lvArch" list="lvArchs" placeholder="es. Dragapult ex"></label>
      ${'Notification' in window?`<label class="switch inline full" for="lvNotify"><input type="checkbox" id="lvNotify" role="switch"${wantsNotify()&&Notification.permission==='granted'?' checked':''}><span class="track" aria-hidden="true"></span><span>Mostra il round in corso nelle notifiche</span></label>`:''}
    </div><datalist id="lvArchs">${T.metaNames().map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
    <div class="row"><span class="hint" id="lvMsg"></span><button class="btn" value="close">Annulla</button><button type="button" class="btn primary" id="lvGo">Inizia torneo</button></div>`;
  sheet('livedlg');
  $('#lvGo').addEventListener('click',async()=>{
    const name=$('#lvName').value.trim(); if(!name){ $('#lvMsg').textContent='Dai un nome al torneo.'; $('#lvName').focus(); return; }
    if($('#lvNotify')) await App.enableLiveNotify($('#lvNotify').checked);
    const type=$('#lvType').value, d=decks.find(x=>x.id===$('#lvDeck').value);
    const t={id:App.uid(), name, date:$('#lvDate').value||today(), type, players:'', deckId:'', deckName:'', placement:'', topcut:false, rounds:[], manual:null, notes:'', created:Date.now(), ongoing:true, bo:T.BIG_EVENTS.includes(type)?'bo3':'bo1'};
    setDeck(t.id, {deckId:d?d.id:'', deckName:$('#lvArch').value.trim()||(d?d.name:'')});
    await save(t); view(t.id); notify();
  });
}

/* ---------- the live view ---------- */
let cur=null, edit=-1;
function view(id){
  const t=App.data.tournaments.find(x=>x.id===id); if(!t) return;
  if(edit<0 || edit>t.rounds.length) edit=t.rounds.length;
  const base = edit<t.rounds.length ? t.rounds[edit] : {opp:'', bo:t.bo||'bo1'};
  cur = T.normRound({...base}); if(base.id) cur.id=true; if(base.bye) cur.bye=true;
  const r=T.record(t), dk=getDeck(t.id);
  const opps=[...new Set([...T.metaNames(), ...App.data.tournaments.flatMap(x=>(x.rounds||[]).map(y=>y.opp)).filter(Boolean)])];
  body.innerHTML = `<div class="dlg-h"><div><span class="live-badge">● In corso</span><h2>${esc(t.name)}</h2><p class="hint" style="margin:2px 0 0">${esc(T.fmtDate(t.date))}${dk.deckName?` · ${esc(dk.deckName)} <span title="Lo vedi solo tu finché il torneo è in corso">🔒</span>`:''}</p></div><button class="xclose" type="button" value="close" aria-label="Chiudi">✕</button></div>
    <div class="lv-body">
      <div class="lv-sum"><b class="num">${T.recStr(r)}</b><div class="lv-pills">${t.rounds.map((x,i)=>`<button type="button" data-er="${i}" class="lv-r${i===edit?' on':''}" title="Round ${i+1}${x.opp?' contro '+esc(x.opp):''}">${pill(x)}<small>R${i+1}</small></button>`).join('')}<button type="button" data-er="${t.rounds.length}" class="lv-r add${edit===t.rounds.length?' on':''}"><span class="res-pill">+</span><small>R${t.rounds.length+1}</small></button></div></div>
      <div class="lv-round" id="lvRound"></div>
    </div>
    <div class="row lv-foot"><button type="button" class="btn small" id="lvDrop">Annulla torneo</button><span></span><button type="button" class="btn" id="lvEnd">Termina torneo</button></div>
    <datalist id="lvOpps">${opps.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`;
  sheet('livedlg');
  drawRound(t);
  body.querySelector('.lv-pills').onclick=e=>{ const b=e.target.closest('[data-er]'); if(!b) return; edit=+b.dataset.er; view(t.id); };
  $('#lvEnd').onclick=()=>endForm(t);
  $('#lvDrop').onclick=async e=>{ const b=e.currentTarget; if(!b.dataset.c){ b.dataset.c=1; b.textContent='Sicuro? Tocca di nuovo'; b.classList.add('danger'); return; }
    App.data.tournaments=App.data.tournaments.filter(x=>x.id!==t.id); setDeck(t.id,null); dlg.close(); App.renderAll(); await App.Store.del('tournaments',t.id); App.toast('Torneo annullato'); notify(); };
}
function drawRound(t){
  const x=cur, n=edit+1, box=$('#lvRound'), mode=x.bye?'bye':x.id?'id':x.bo;
  box.innerHTML = `<h3>Round ${n}${edit<t.rounds.length?' <span class="src">· modifica</span>':''}</h3>
    <input class="lv-opp" id="lvOpp" list="lvOpps" placeholder="${x.bye?'Nessun avversario (BYE)':'Archetipo avversario'}" value="${esc(x.opp||'')}" ${x.bye?'disabled':''} autocomplete="off">
    <div class="seg lv-mode">${[['bo1','Bo1'],['bo3','Bo3'],['id','ID'],['bye','BYE']].map(([k,l])=>`<button type="button" data-m="${k}" aria-pressed="${mode===k}">${l}</button>`).join('')}</div>
    ${x.bye||x.id ? `<p class="hint">${x.bye?'Turno senza avversario: vale come vittoria.':'Pareggio concordato: vale come pareggio.'}</p>` :
      x.games.map((g,j)=>`<div class="lv-g"><span class="src">${x.bo==='bo3'?'Game '+(j+1):'Partita'}</span>
        <div class="seg">${[['F','Primo'],['S','Secondo']].map(([k,l])=>`<button type="button" data-f="${j}:${k}" aria-pressed="${g.first===k}">${l}</button>`).join('')}</div>
        <div class="lv-wlt">${['W','L','T'].map(k=>`<button type="button" class="${k}" data-g="${j}:${k}" aria-pressed="${g.res===k}">${GL[k]}</button>`).join('')}</div></div>`).join('')}
    <button type="button" class="btn primary lv-save" id="lvSave">${edit<t.rounds.length?'Salva modifiche':'Salva round '+n}</button>`;
  box.onclick=e=>{
    const m=e.target.closest('[data-m]'); if(m){ const k=m.dataset.m; x.id=k==='id'; x.bye=k==='bye'; if(k==='bo1'||k==='bo3'){ const o=x.opp; Object.assign(x, T.normRound({...x, bo:k})); x.opp=o; x.id=false; x.bye=false; } if(x.bye) x.opp=''; drawRound(t); return; }
    const f=e.target.closest('[data-f]'); if(f){ const [j,k]=f.dataset.f.split(':'); const g=x.games[+j]; g.first=g.first===k?null:k; drawRound(t); return; }
    const g=e.target.closest('[data-g]'); if(g){ const [j,k]=g.dataset.g.split(':'); const gm=x.games[+j]; gm.res=gm.res===k?null:k; drawRound(t); return; }
    if(e.target.closest('#lvSave')) saveRound(t);
  };
  box.oninput=e=>{ if(e.target.id==='lvOpp') x.opp=e.target.value; };
}
async function saveRound(t){
  const x=cur; if(!x.bye && !x.id && !T.roundRes(x)){ App.toast('Segna il risultato di almeno una partita'); return; }
  if(edit<t.rounds.length) t.rounds[edit]=clean(x); else t.rounds.push(clean(x));
  if(x.bo==='bo3'||x.bo==='bo1') t.bo=x.bo;
  edit=t.rounds.length; await save(t); view(t.id); notify();
  if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
}

/* ---------- close the tournament ---------- */
function endForm(t){
  const dk=getDeck(t.id);
  body.innerHTML = `<div class="dlg-h"><div><h2>Termina ${esc(t.name)}</h2><p class="hint" style="margin:2px 0 0">Record ${T.recStr(T.record(t))} in ${t.rounds.length} round. Dopo il salvataggio il torneo diventa normale e il gruppo vede anche il mazzo.</p></div><button class="xclose" type="button" value="close" aria-label="Chiudi">✕</button></div>
    <div class="form">
      <label>Posizione finale<input id="lvPlace" type="number" min="1" placeholder="es. 5"></label>
      <label>Giocatori<input id="lvPlayers" type="number" min="2" placeholder="es. 64"></label>
      <label class="full">Top cut<span class="seg" id="lvCut">${[['none','Non c’era'],['missed','C’era, non passato'],['made','Passato']].map(([k,l])=>`<button type="button" data-cut="${k}" aria-pressed="${k==='none'}">${l}</button>`).join('')}</span></label>
      <div class="full cut-more" id="lvCutMore" hidden>
        <label>Taglio<select id="lvCutSize"><option value="">—</option>${[4,8,16,32,64].map(n=>`<option value="${n}">Top ${n}</option>`).join('')}</select></label>
        <label>Primo round del top cut<select id="lvCutFrom"><option value="">—</option>${t.rounds.map((x,i)=>`<option value="${i+1}">R${i+1}${x.opp?' · vs '+esc(x.opp):''}</option>`).join('')}</select></label></div>
      <label class="full">Note<textarea id="lvNotes" placeholder="Cosa ha funzionato, cosa cambiare…"></textarea></label>
    </div>
    <div class="row"><button type="button" class="btn" id="lvBack">← Torna ai round</button><span></span><button type="button" class="btn primary" id="lvClose">Salva torneo</button></div>`;
  sheet('livedlg');
  let cut='none';
  $('#lvCut').onclick=e=>{ const b=e.target.closest('[data-cut]'); if(!b) return; cut=b.dataset.cut; $('#lvCut').querySelectorAll('[data-cut]').forEach(x=>x.setAttribute('aria-pressed',x===b)); $('#lvCutMore').hidden=cut!=='made'; };
  $('#lvBack').onclick=()=>view(t.id);
  $('#lvClose').onclick=async()=>{
    const d=App.data.decks.find(x=>x.id===dk.deckId);
    Object.assign(t,{placement:$('#lvPlace').value, players:$('#lvPlayers').value, notes:$('#lvNotes').value.trim(), cut, topcut:cut==='made', deckId:dk.deckId||'', deckName:dk.deckName||(d?d.name:'')});
    if(cut==='made'){ t.cutSize=+$('#lvCutSize').value||''; t.cutFrom=+$('#lvCutFrom').value||''; }
    if(d){ t.list=d.cards.slice(); t.listDate=today(); }
    delete t.ongoing; App.canonT(t);
    await save(t); setDeck(t.id,null); dlg.close(); App.toast('Torneo salvato'); edit=-1; notify();
  };
}

/* ---------- "in progress" box on the Tornei page ---------- */
App.renderLiveBox = () => { const box=$('#tLiveBox'); if(!box) return; const L=live();
  box.innerHTML = L.map(t=>`<div class="lv-box"><span class="live-badge">● In corso</span><div class="lv-bi"><b>${esc(t.name)}</b><span class="src">${T.recStr(T.record(t))} · ${t.rounds.length} round</span></div>
    <div class="lv-pills sm">${t.rounds.map(pill).join('')}</div><button type="button" class="btn primary small" data-live="${esc(t.id)}">Continua</button></div>`).join(''); };
$('#tLiveBox').addEventListener('click',e=>{ const b=e.target.closest('[data-live]'); if(b){ edit=-1; view(b.dataset.live); } });
App.on(w=>{ if(w==='data') App.renderLiveBox(); });
App.renderLiveBox();
App.liveView = id => { edit=-1; view(id); };

/* ---------- moving around the app while a tournament is live ---------- */
// a small pill on every page brings you back to the live tournament
const pillEl=document.createElement('button'); pillEl.type='button'; pillEl.className='live-pill'; pillEl.hidden=true; document.body.appendChild(pillEl);
pillEl.addEventListener('click',()=>{ const t=live()[0]; if(t) App.liveView(t.id); });
function drawPill(){ const t=live()[0], open=dlg.open && dlg.classList.contains('livedlg');
  pillEl.hidden=!t || open; if(!t) return;
  pillEl.innerHTML=`<span class="dot"></span><b>Live</b><span>${esc(t.name)}</span><span class="num">R${t.rounds.length+1} · ${T.recStr(T.record(t))}</span>`; }
App.on(w=>{ if(w==='data'||w==='page') drawPill(); });
dlg.addEventListener('close',()=>setTimeout(drawPill,260)); new MutationObserver(drawPill).observe(dlg,{attributes:true,attributeFilter:['open','class']});
drawPill();

/* ---------- notifications: the round in progress, updated after every round ---------- */
const canNotify = () => 'Notification' in window && 'serviceWorker' in navigator;
const wantsNotify = () => { try{ return localStorage.getItem('pr.liveNotify')==='true'; }catch(e){ return false; } };
async function swReg(){ try{ await navigator.serviceWorker.register('sw.js'); return await navigator.serviceWorker.ready; }catch(e){ return null; } }
App.enableLiveNotify = async on => {
  if(!on){ try{ localStorage.setItem('pr.liveNotify','false'); }catch(e){} clearNotes(); return true; }
  if(!canNotify()){ App.toast('Questo browser non supporta le notifiche'); return false; }
  const perm = Notification.permission==='granted' ? 'granted' : await Notification.requestPermission();
  if(perm!=='granted'){ App.toast('Notifiche non permesse: attivale dalle impostazioni del browser'); return false; }
  await swReg(); try{ localStorage.setItem('pr.liveNotify','true'); }catch(e){} notify(); return true;
};
async function clearNotes(){ if(!canNotify()) return; const r=await navigator.serviceWorker.getRegistration(); if(!r) return; (await r.getNotifications()).filter(n=>String(n.tag).startsWith('pr-live')).forEach(n=>n.close()); }
async function notify(){
  if(!canNotify() || !wantsNotify() || Notification.permission!=='granted') return;
  const r=await swReg(); if(!r) return; const L=live();
  (await r.getNotifications()).filter(n=>String(n.tag).startsWith('pr-live') && !L.some(t=>n.tag==='pr-live-'+t.id)).forEach(n=>n.close());
  L.forEach(t=>{ const last=t.rounds[t.rounds.length-1], lr=last?T.roundRes(last):null;
    r.showNotification(`● ${t.name} · Round ${t.rounds.length+1}`, {tag:'pr-live-'+t.id, renotify:false, silent:true, requireInteraction:true, data:{id:t.id},
      icon:'assets/icon-192.png', badge:'assets/favicon-64.png',
      body:`Record ${T.recStr(T.record(t))}${last?` · ultimo round: ${last.bye?'BYE':last.id?'ID':GL[lr]||'—'}${last.opp?' vs '+last.opp:''}`:''}\nTocca per segnare il prossimo round.`}); });
}
App.on(w=>{ if(w==='data') notify(); });
if(canNotify()){
  navigator.serviceWorker.addEventListener('message',e=>{ if(e.data && e.data.type==='live'){ location.hash='tornei'; const id=e.data.id||(live()[0]||{}).id; if(id) setTimeout(()=>App.liveView(id),200); } });
  if(wantsNotify()) swReg();
}
// opened from a notification while the app was closed
const qid=new URLSearchParams(location.search).get('live');
if(qid){ history.replaceState(null,'',location.pathname+location.hash); const go=()=>{ const t=live().find(x=>x.id===qid)||live()[0]; if(t) App.liveView(t.id); }; setTimeout(go,600); App.on(w=>{ if(w==='data' && !dlg.open) go(); }); }
})();
