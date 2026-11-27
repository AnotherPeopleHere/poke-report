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
// the deck of a live tournament is private: kept in this browser and in a hidden row of your decks (only you can read it),
// so you find it on every device, while friends see the tournament without it
const getDeck = id => { try{ const v=JSON.parse(localStorage.getItem(keyOf(id))||'null'); if(v) return v; }catch(e){} return (App.Store.liveDecks||{})[id] || {}; };
const setDeck = (id,v) => { try{ v ? localStorage.setItem(keyOf(id), JSON.stringify(v)) : localStorage.removeItem(keyOf(id)); }catch(e){}
  const S=App.Store; if(S.mode!=='cloud') return; S.liveDecks=S.liveDecks||{};
  if(v){ S.liveDecks[id]=v; S.put('decks',{id:'live:'+id, name:v.deckName||'', cards:[v.deckId||'']}); } else { delete S.liveDecks[id]; S.del('decks','live:'+id); } };
const DL = window.DeckLab;
// sprites of the deck you are playing (the saved deck's archetype, or the name you typed)
function deckSpr(dk){ const d=App.data.decks.find(x=>x.id===dk.deckId); const n=dk.deckName||(d?d.name:'');
  return (DL.archSprites && (DL.archSprites(n) || (d && DL.archOf && DL.archSprites(DL.archOf(d.cards, n))))) || ''; }

/* ---------- round timer: counts down (50 minutes Bo3, 25 Bo1); kept in the tournament so the notification and other devices know it ---------- */
// minutes of a round: 50 Bo3 and 25 Bo1 unless you changed them (remembered on this device)
const DUR = bo => { let m=0; try{ m=+localStorage.getItem('pr.tdur.'+(bo==='bo3'?'bo3':'bo1'))||0; }catch(e){} return (m || (bo==='bo3'?50:25))*60000; };
const tmLeft = tm => !tm ? 0 : Math.max(0, tm.run ? tm.end-Date.now() : tm.left);
const tmFmt = ms => { const s=Math.ceil(ms/1000), m=Math.floor(s/60); return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
const tmNew = bo => ({dur:DUR(bo), left:DUR(bo), run:false, at:Date.now()});
function tmToggle(tm){ const now=Date.now(); return tm.run ? {...tm, run:false, left:Math.max(0,tm.end-now), at:now} : {...tm, run:true, end:now+tmLeft(tm), at:now}; }
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
let cur=null, edit=-1, tick=0, tmEdit=false;
// opponents to pick with one tap: the ones you meet most, then the strongest of the meta
function oppChips(){ const cnt=new Map(); App.data.tournaments.forEach(x=>(x.rounds||[]).forEach(r=>{ const o=(r.opp||'').trim(); if(o) cnt.set(o,(cnt.get(o)||0)+1); }));
  const mine=[...cnt].sort((a,b)=>b[1]-a[1]).map(x=>x[0]); const out=[]; [...mine, ...T.metaNames()].forEach(n=>{ if(out.length<8 && !out.some(o=>App.archKey(o)===App.archKey(n))) out.push(n); }); return out; }
function view(id){
  const t=App.data.tournaments.find(x=>x.id===id); if(!t) return;
  if(edit<0 || edit>t.rounds.length) edit=t.rounds.length;
  const base = edit<t.rounds.length ? t.rounds[edit] : {opp:'', bo:t.bo||'bo1'};
  cur = T.normRound({...base}); if(base.id) cur.id=true; if(base.bye) cur.bye=true; if(base.note) cur.note=base.note;
  if(!t.timer) t.timer=tmNew(t.bo);
  const r=T.record(t), dk=getDeck(t.id), sp=deckSpr(dk), wait=App.Store.pending && App.Store.pending(t.id);
  const opps=[...new Set([...T.metaNames(), ...App.data.tournaments.flatMap(x=>(x.rounds||[]).map(y=>y.opp)).filter(Boolean)])];
  body.innerHTML = `<div class="lv-head"><span class="live-badge">● In corso</span>${wait?'<span class="lv-wait" title="Salvato su questo dispositivo: parte appena torna la rete">⏳ in attesa di rete</span>':''}<button class="xclose" type="button" value="close" aria-label="Chiudi">✕</button></div>
    <div class="lv-title"><div class="lv-tn"><h2>${esc(t.name)}</h2><p class="hint">${esc(T.fmtDate(t.date))}${t.type?' · '+esc(t.type):''}</p></div>
      ${dk.deckName||sp?`<div class="lv-deck" title="Lo vedi solo tu finché il torneo è in corso"><span class="lv-dspr">${sp||'<span class="lv-dq">?</span>'}</span><small>${esc(dk.deckName||'')} 🔒</small></div>`:''}</div>
    <div class="lv-body">
      <div class="lv-sum"><b class="num">${T.recStr(r)}</b><div class="lv-pills">${t.rounds.map((x,i)=>`<button type="button" data-er="${i}" class="lv-r${i===edit?' on':''}" title="Round ${i+1}${x.opp?' contro '+esc(x.opp):''}">${pill(x)}<small>R${i+1}</small></button>`).join('')}<button type="button" data-er="${t.rounds.length}" class="lv-r add${edit===t.rounds.length?' on':''}"><span class="res-pill">+</span><small>R${t.rounds.length+1}</small></button></div></div>
      <div class="lv-timer" id="lvTimer"></div>
      <div class="lv-round" id="lvRound"></div>
    </div>
    <div class="row lv-foot"><button type="button" class="btn small lv-drop" id="lvDrop">Annulla torneo</button><span></span><button type="button" class="btn lv-end" id="lvEnd">Termina torneo</button></div>
    <datalist id="lvOpps">${opps.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`;
  sheet('livedlg');
  drawRound(t); drawTimer(t);
  clearInterval(tick); tick=setInterval(()=>{ if(!dlg.open || !document.getElementById('lvTimer')){ clearInterval(tick); return; } drawTimer(t, true); },1000);
  body.querySelector('.lv-pills').onclick=e=>{ const b=e.target.closest('[data-er]'); if(!b) return; edit=+b.dataset.er; view(t.id); };
  // two taps: the first turns the button into a coloured "tap again" (red to cancel, green to close)
  const twice=(b, label, go)=>{ if(!b.dataset.c){ b.dataset.c=1; b.textContent=label; b.classList.add('armed'); setTimeout(()=>{ if(b.isConnected && b.dataset.c){ delete b.dataset.c; b.classList.remove('armed'); b.textContent=b.id==='lvEnd'?'Termina torneo':'Annulla torneo'; } },4000); return; } go(); };
  $('#lvEnd').onclick=e=>twice(e.currentTarget,'Confermi? Termina',()=>endForm(t));
  $('#lvDrop').onclick=e=>twice(e.currentTarget,'Confermi? Annulla',async()=>{
    App.data.tournaments=App.data.tournaments.filter(x=>x.id!==t.id); setDeck(t.id,null); dlg.close(); App.renderAll(); await App.Store.del('tournaments',t.id); App.toast('Torneo annullato'); notify(); });
}
function drawTimer(t, only){
  const box=document.getElementById('lvTimer'); if(!box) return; const tm=t.timer, left=tmLeft(tm), over=tm.run && left<=0;
  if(only){ const v=box.querySelector('.lt-v'); if(v){ v.textContent=over?'Tempo!':tmFmt(left); box.classList.toggle('over',over); } if(over) ring(t); return; }
  box.className='lv-timer'+(tm.run?' run':'')+(over?' over':'')+(tmEdit?' edit':'');
  const mins=Math.round(tm.dur/60000);
  box.innerHTML=`<span class="lt-l">⏱ Round ${t.rounds.length+1}<small>${tm.run?'tocca ❚❚ per la pausa':'tocca il tempo per cambiarlo'}</small></span><button type="button" class="lt-v num" data-tm="edit" ${tm.run?'disabled':''} aria-label="Cambia la durata">${over?'Tempo!':tmFmt(left)}</button>
    <button type="button" class="lt-b" data-tm="go" aria-label="${tm.run?'Pausa':'Avvia il timer'}">${tm.run?'❚❚':'▶'}</button><button type="button" class="lt-b" data-tm="reset" aria-label="Azzera il timer">↺</button>
    ${tmEdit && !tm.run?`<div class="lt-ed"><span class="src">Durata del round</span><div class="lt-pre">${[20,25,30,40,50,60].map(m=>`<button type="button" data-min="${m}" aria-pressed="${m===mins}">${m}′</button>`).join('')}</div>
      <div class="lt-fine"><button type="button" class="lt-b" data-step="-1" aria-label="Un minuto in meno">−</button><b class="num">${mins} min</b><button type="button" class="lt-b" data-step="1" aria-label="Un minuto in più">+</button></div>
      <span class="src">Resta come durata predefinita per i ${t.bo==='bo3'?'Bo3':'Bo1'} su questo dispositivo.</span></div>`:''}`;
  box.onclick=async e=>{
    const mn=e.target.closest('[data-min]'), st=e.target.closest('[data-step]');
    if(mn || st){ const m=Math.max(1,Math.min(120, mn ? +mn.dataset.min : Math.round(t.timer.dur/60000)+(+st.dataset.step)));
      try{ localStorage.setItem('pr.tdur.'+(t.bo==='bo3'?'bo3':'bo1'), m); }catch(_){}
      t.timer={dur:m*60000, left:m*60000, run:false, at:Date.now()}; drawTimer(t); await save(t); notify(); return; }
    const b=e.target.closest('[data-tm]'); if(!b) return;
    if(b.dataset.tm==='edit'){ tmEdit=!tmEdit; drawTimer(t); return; }
    tmEdit=false; t.timer = b.dataset.tm==='go' ? tmToggle(t.timer) : tmNew(t.bo);
    drawTimer(t); await save(t); notify(); armAlarm(); };
}
function drawRound(t){
  const x=cur, n=edit+1, box=$('#lvRound'), mode=x.bye?'bye':x.id?'id':x.bo, isNew=edit>=t.rounds.length, quick=isNew && x.bo==='bo1' && !x.bye && !x.id;
  const os=x.opp && DL.archSprites ? DL.archSprites(x.opp) : '';
  box.innerHTML = `<h3>Round ${n}${!isNew?' <span class="src">· modifica</span>':''}</h3>
    <div class="lv-oppw"><span class="lv-ospr">${os}</span><input class="lv-opp" id="lvOpp" list="lvOpps" placeholder="${x.bye?'Nessun avversario (BYE)':'Archetipo avversario'}" value="${esc(x.opp||'')}" ${x.bye?'disabled':''} autocomplete="off"></div>
    ${x.bye?'':`<div class="lv-chips">${oppChips().map(o=>`<button type="button" data-o="${esc(o)}" aria-pressed="${App.archKey(o)===App.archKey(x.opp||'')}"><span class="sprs">${DL.archSprites?DL.archSprites(o):''}</span>${esc(o)}</button>`).join('')}</div>`}
    <div class="seg lv-mode">${[['bo1','Bo1'],['bo3','Bo3'],['id','ID'],['bye','BYE']].map(([k,l])=>`<button type="button" data-m="${k}" aria-pressed="${mode===k}">${l}</button>`).join('')}</div>
    ${x.bye||x.id ? `<p class="hint">${x.bye?'Turno senza avversario: vale come vittoria.':'Pareggio concordato: vale come pareggio.'}</p>` :
      x.games.map((g,j)=>`<div class="lv-g"><span class="src">${x.bo==='bo3'?'Game '+(j+1):'Partita'}</span>
        <div class="seg">${[['F','Primo'],['S','Secondo']].map(([k,l])=>`<button type="button" data-f="${j}:${k}" aria-pressed="${g.first===k}">${l}</button>`).join('')}</div>
        <div class="lv-wlt">${['W','L','T'].map(k=>`<button type="button" class="${k}" data-g="${j}:${k}" aria-pressed="${g.res===k}">${GL[k]}</button>`).join('')}</div></div>`).join('')}
    <input class="lv-note" id="lvNote" placeholder="Nota (facoltativa): es. ha giocato Iono a 2 premi" value="${esc(x.note||'')}" autocomplete="off">
    ${quick?'<p class="hint lv-qh">Tocca il risultato per salvare il round.</p>':`<button type="button" class="btn primary lv-save" id="lvSave">${!isNew?'Salva modifiche':'Salva round '+n}</button>`}`;
  box.onclick=e=>{
    const o=e.target.closest('[data-o]'); if(o){ x.opp=o.dataset.o; drawRound(t); return; }
    const m=e.target.closest('[data-m]'); if(m){ const k=m.dataset.m; x.id=k==='id'; x.bye=k==='bye'; if(k==='bo1'||k==='bo3'){ const o=x.opp, nt=x.note; Object.assign(x, T.normRound({...x, bo:k})); x.opp=o; x.note=nt; x.id=false; x.bye=false; } if(x.bye) x.opp=''; drawRound(t); return; }
    const f=e.target.closest('[data-f]'); if(f){ const [j,k]=f.dataset.f.split(':'); const g=x.games[+j]; g.first=g.first===k?null:k; drawRound(t); return; }
    const g=e.target.closest('[data-g]'); if(g){ const [j,k]=g.dataset.g.split(':'); const gm=x.games[+j]; gm.res=gm.res===k?null:k; drawRound(t);
      if(quick && gm.res) setTimeout(()=>saveRound(t),180); return; }   // Bo1: one tap on the result saves the round
    if(e.target.closest('#lvSave')) saveRound(t);
  };
  box.oninput=e=>{ if(e.target.id==='lvOpp'){ x.opp=e.target.value; const sp=box.querySelector('.lv-ospr'); if(sp) sp.innerHTML=x.opp&&DL.archSprites?DL.archSprites(x.opp):''; } if(e.target.id==='lvNote') x.note=e.target.value; };
}
async function saveRound(t){
  const x=cur; if(!x.bye && !x.id && !T.roundRes(x)){ App.toast('Segna il risultato di almeno una partita'); return; }
  const isNew=edit>=t.rounds.length;
  if(!isNew) t.rounds[edit]=clean(x); else t.rounds.push(clean(x));
  if(x.bo==='bo3'||x.bo==='bo1') t.bo=x.bo;
  if(isNew) t.timer=tmNew(t.bo);   // next round: a fresh timer, ready to start
  edit=t.rounds.length; await save(t); view(t.id); notify();
  if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
  if(isNew) App.toast(`Round ${t.rounds.length} salvato: ${x.bye?'BYE':x.id?'ID':GL[T.roundRes(x)]||''}`);
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
// the preview opens in the middle of the screen over a dimmed page that cannot be touched or scrolled until it closes
const pov=document.createElement('div'); pov.className='live-pov'; pov.hidden=true; document.body.appendChild(pov);
const prev=document.createElement('div'); prev.className='live-prev'; prev.setAttribute('role','dialog'); prev.setAttribute('aria-label','Anteprima del torneo in corso'); pov.appendChild(prev);
pov.addEventListener('touchmove',e=>{ if(!e.target.closest('.lp-rounds')) e.preventDefault(); },{passive:false});
function showPrev(open){ const t=live()[0]; if(!open || !t){ if(pov.hidden) return; pov.classList.remove('on'); document.documentElement.classList.remove('wheel-lock'); setTimeout(()=>{ if(!pov.classList.contains('on')) pov.hidden=true; },200); clearInterval(prevT); return; }
  const dk=getDeck(t.id), sp=deckSpr(dk), last=t.rounds[t.rounds.length-1], tm=t.timer;
  prev.innerHTML=`<div class="lp-h"><span class="live-badge">● In corso</span><span class="src">${esc(T.fmtDate(t.date))}</span></div>
    <div class="lp-t"><div><b>${esc(t.name)}</b><span class="src">${dk.deckName?esc(dk.deckName)+' 🔒':''}</span></div><span class="lv-dspr">${sp}</span></div>
    <div class="lp-r"><span class="src">Record</span><b class="num">${T.recStr(T.record(t))}</b></div>
    ${t.rounds.length?`<ol class="lp-rounds">${t.rounds.map((x,i)=>`<li><span class="lp-rn num">R${i+1}</span><span class="sprs">${x.opp&&DL.archSprites?DL.archSprites(x.opp):''}</span><span class="lp-o">${x.bye?'<span class="src">Nessun avversario</span>':x.opp?esc(x.opp):'<span class="src">Avversario non segnato</span>'}</span>${pill(x)}</li>`).join('')}</ol>`:'<p class="src" style="margin:0">Nessun round registrato ancora.</p>'}
    <div class="lp-n"><span>Round ${t.rounds.length+1}${last&&last.opp?` <span class="src">· ultimo vs ${esc(last.opp)}</span>`:''}</span>${tm?`<b class="num lp-tm${tm.run?' run':''}">${lpTime(tm)}</b>`:''}</div>
    <button type="button" class="btn primary lp-go">Apri il torneo</button>`;
  pov.hidden=false; document.documentElement.classList.add('wheel-lock'); requestAnimationFrame(()=>requestAnimationFrame(()=>pov.classList.add('on')));
  clearInterval(prevT); prevT=setInterval(()=>{ const e=prev.querySelector('.lp-tm'); if(!e || pov.hidden){ clearInterval(prevT); return; } const tt=live()[0]; if(tt&&tt.timer) e.textContent=lpTime(tt.timer); },1000); }
let prevT=0;
const lpTime = tm => tm.run ? (tmLeft(tm)>0 ? tmFmt(tmLeft(tm)) : 'Tempo!') : '❚❚ '+tmFmt(tmLeft(tm));
pillEl.addEventListener('click',e=>{ e.stopPropagation(); showPrev(pov.hidden); });
prev.addEventListener('click',e=>{ if(e.target.closest('.lp-go')){ const t=live()[0]; showPrev(false); if(t) App.liveView(t.id); } });
pov.addEventListener('click',e=>{ if(e.target===pov) showPrev(false); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') showPrev(false); });
App.on(w=>{ if(w==='page') showPrev(false); });
function drawPill(){ const t=live()[0], open=dlg.open && dlg.classList.contains('livedlg');
  pillEl.hidden=!t || open; if(!t || open) showPrev(false); if(!t) return;
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
// the deck's sprites drawn into one small picture, for the notification icon (only on your phone)
const iconCache={};
async function deckIcon(t){ const dk=getDeck(t.id), k=dk.deckName||dk.deckId||''; if(!k) return 'assets/icon-192.png'; if(iconCache[k]) return iconCache[k];
  const srcs=[...(deckSpr(dk).matchAll(/src="([^"]+)"/g))].map(m=>m[1]).slice(0,2); if(!srcs.length) return 'assets/icon-192.png';
  try{ const imgs=await Promise.all(srcs.map(u=>new Promise((ok,ko)=>{ const im=new Image(); im.onload=()=>ok(im); im.onerror=ko; im.src=u; })));
    const c=document.createElement('canvas'); c.width=c.height=192; const g=c.getContext('2d'); g.imageSmoothingQuality='high';
    if(imgs.length===1) g.drawImage(imgs[0],16,16,160,160); else { g.drawImage(imgs[0],0,40,112,112); g.drawImage(imgs[1],80,40,112,112); }
    return iconCache[k]=c.toDataURL('image/png'); }catch(e){ return 'assets/icon-192.png'; } }
// same text as the service worker writes when you use the buttons of the notification
function noteOpts(t, icon){ const last=t.rounds[t.rounds.length-1], lr=last?T.roundRes(last):null, tm=t.timer||tmNew(t.bo);
  const info={id:t.id, name:t.name, rec:T.recStr(T.record(t)), n:t.rounds.length+1, last:last?`${last.bye?'BYE':last.id?'ID':GL[lr]||'—'}${last.opp?' vs '+last.opp:''}`:'', timer:tm};
  return {tag:'pr-live-'+t.id, renotify:false, silent:true, requireInteraction:true, data:info, icon, badge:'assets/favicon-64.png'}; }
async function notify(){
  if(!canNotify() || !wantsNotify() || Notification.permission!=='granted') return;
  const r=await swReg(); if(!r) return; const L=live();
  (await r.getNotifications()).filter(n=>String(n.tag).startsWith('pr-live') && !L.some(t=>n.tag==='pr-live-'+t.id)).forEach(n=>n.close());
  for(const t of L){ const o=noteOpts(t, await deckIcon(t)), d=o.data, tm=d.timer, l=tmLeft(tm), hm=ts=>new Date(ts).toTimeString().slice(0,5);
    const time = tm.run ? (l>0 ? `⏱ ${tmFmt(l)} · fine alle ${hm(tm.end)}` : '⏱ Tempo scaduto') : (l<tm.dur ? `⏸ In pausa · ${tmFmt(l)}` : `⏱ ${tmFmt(l)} · timer fermo`);
    await r.showNotification(`● LIVE · ${d.name} · Round ${d.n}`, {...o, body:`Record ${d.rec}${d.last?` · ultimo round: ${d.last}`:''}\n${time}`,
      actions:[{action:'timer', title: tm.run ? '❚❚ Pausa' : '▶ Avvia timer'}, {action:'open', title:'Apri'}]}); }
}
/* ---------- time is up: vibration, a notification with sound and a message (while the app is open or still alive in the background) ---------- */
let alarmT=0; const rang=new Set();
function armAlarm(){ clearTimeout(alarmT); let next=null;
  live().forEach(t=>{ const tm=t.timer; if(tm && tm.run){ const ms=tm.end-Date.now(); if(ms>0 && (!next || ms<next.ms)) next={t, ms}; else if(ms<=0) ring(t); } });
  if(next) alarmT=setTimeout(()=>{ ring(App.data.tournaments.find(x=>x.id===next.t.id)||next.t); armAlarm(); }, next.ms+200); }
async function ring(t){ const tm=t&&t.timer; if(!tm || !tm.run || tmLeft(tm)>0) return; const k=t.id+':'+tm.end; if(rang.has(k)) return; rang.add(k);
  if(navigator.vibrate) try{ navigator.vibrate([300,120,300,120,600]); }catch(e){}
  App.toast(`⏰ Tempo scaduto · Round ${t.rounds.length+1}`);
  if(canNotify() && wantsNotify() && Notification.permission==='granted'){ const r=await swReg(); if(r) r.showNotification(`⏰ Tempo scaduto · Round ${t.rounds.length+1}`, {tag:'pr-live-end-'+t.id, body:`${t.name}: si gioca il tempo supplementare. Tocca per segnare il round.`, vibrate:[300,120,300,120,600], silent:false, renotify:true, data:{id:t.id}, icon:'assets/icon-192.png', badge:'assets/favicon-64.png'}); } }
App.on(w=>{ if(w==='data') armAlarm(); });
// the notification is redrawn once a minute while the timer runs (with the app open); when closed it shows the end time, which stays right
setInterval(()=>{ if(live().some(t=>t.timer&&t.timer.run)) notify(); },60000);
// play/pause pressed in the notification: the service worker tells the app, or the app reads it when it opens again
function adoptTimer(id, tm){ const t=App.data.tournaments.find(x=>x.id===id); if(!t || !tm || (t.timer && t.timer.at>=tm.at)) return;
  t.timer=tm; save(t); if(dlg.open && dlg.classList.contains('livedlg')) drawTimer(t); armAlarm(); }
async function syncFromNotes(){ if(!canNotify()) return; const r=await navigator.serviceWorker.getRegistration(); if(!r) return;
  (await r.getNotifications()).forEach(n=>{ const d=n.data||{}; if(String(n.tag).startsWith('pr-live') && d.id) adoptTimer(d.id, d.timer); }); }
App.on(w=>{ if(w==='data') syncFromNotes(); });
document.addEventListener('visibilitychange',()=>{ if(!document.hidden) syncFromNotes(); });
App.on(w=>{ if(w==='data') notify(); });
if(canNotify()){
  navigator.serviceWorker.addEventListener('message',e=>{ if(e.data && e.data.type==='timer'){ adoptTimer(e.data.id, e.data.timer); return; } if(e.data && e.data.type==='live'){ location.hash='tornei'; const id=e.data.id||(live()[0]||{}).id; if(id) setTimeout(()=>App.liveView(id),200); } });
  if(wantsNotify()) swReg();
}
// opened from a notification while the app was closed
const qid=new URLSearchParams(location.search).get('live');
if(qid){ history.replaceState(null,'',location.pathname+location.hash); const go=()=>{ const t=live().find(x=>x.id===qid)||live()[0]; if(t) App.liveView(t.id); }; setTimeout(go,600); App.on(w=>{ if(w==='data' && !dlg.open) go(); }); }
})();
