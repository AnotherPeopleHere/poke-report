/* ===== Standard Hub pages: home widgets, meta, news, tournaments, Metafy ===== */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const J = id => JSON.parse(document.getElementById(id).textContent);
const META = J('metaData'), TOURS = J('tourData'), NEWS = J('newsData'), COACHES = J('coachData'), SNAP = J('snapData');
const DL = window.DeckLab;
const MONTHS = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
function fmtDate(d){ if(!d) return ''; const [y,m,dd] = d.split('-'); return (dd? +dd+' ':'') + MONTHS[+m-1] + ' ' + y; }
const pct = (p,dec=1) => (p*100).toLocaleString('it-IT',{maximumFractionDigits:dec,minimumFractionDigits:dec})+'%';
function hue(s){ let h=0; for(const ch of s) h=(h*31+ch.charCodeAt(0))%360; return h; }
const avatar = (name, size) => `<span class="av" style="background:hsl(${hue(name)} 55% 45%)${size?`;width:${size}px;height:${size}px`:''}">${esc(name.replace(/^(Mega |N's |Rocket's |Marnie's |Cynthia's |Hop's |Lillie's )/,'').charAt(0))}</span>`;
const archLink = (name, url) => `<span class="arch">${avatar(name)}${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(name)}</a>`:`<span class="t">${esc(name)}</span>`}</span>`;
const metaUrl = name => { const m = META.find(x=>x.name.toLowerCase()===String(name).toLowerCase()); return m ? m.url : ''; };

/* ---------- META ---------- */
let metaAll = false;
function renderMeta(){
  $('#metaDate').textContent = fmtDate(SNAP.metaDate||SNAP.date);
  const top = META[0], players = TOURS.reduce((a,t)=>a+t.players,0);
  $('#metaKpis').innerHTML = `
    <div><span>Archetipo n° 1</span><b>${esc(top.name)}</b><small>${pct(top.share/100,1)} dei punti</small></div>
    <div><span>Archetipi con punti</span><b>${META.length}</b><small>nel formato attuale</small></div>
    <div><span>Regional analizzati</span><b>${TOURS.length}</b><small>${fmtDate(TOURS[TOURS.length-1].date)} – ${fmtDate(TOURS[0].date)}</small></div>
    <div><span>Giocatori in quei Regional</span><b>${players.toLocaleString('it-IT')}</b><small>Masters, sul totale iscritti</small></div>`;
  const rows = (metaAll ? META : META.slice(0,15));
  const mx = META[0].share;
  $('#metaTable').innerHTML = `<thead><tr><th class="n">#</th><th>Archetipo</th><th style="width:34%">Quota</th><th class="n">Punti</th></tr></thead><tbody>${rows.map(m=>`<tr>
    <td class="n rank">${m.rank}</td><td>${archLink(m.name,m.url)}</td>
    <td><div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><b style="width:${m.share/mx*100}%"></b></div><span class="num" style="font-size:12px;min-width:48px;text-align:right">${pct(m.share/100,2)}</span></div></td>
    <td class="n">${m.points.toLocaleString('it-IT')}</td></tr>`).join('')}</tbody>`;
  $('#metaMore').textContent = metaAll ? 'Mostra i primi 15' : `Mostra tutti (${META.length})`;
  const conv = new Map();
  TOURS.forEach(t=>t.top.forEach(p=>{ const c = conv.get(p.deck)||{deck:p.deck,top8:0,wins:0}; c.top8++; if(p.rank===1) c.wins++; conv.set(p.deck,c); }));
  const cl = [...conv.values()].sort((a,b)=>b.top8-a.top8||b.wins-a.wins||a.deck.localeCompare(b.deck));
  $('#convMeta').textContent = `${TOURS.length} tornei · ${TOURS.length*8} posti`;
  $('#convTable').innerHTML = `<thead><tr><th>Variante</th><th class="n">Top 8</th><th class="n">Vittorie</th></tr></thead><tbody>${cl.slice(0,14).map(c=>`<tr><td>${archLink(c.deck,'')}</td><td class="n">${c.top8}</td><td class="n">${c.wins||'—'}</td></tr>`).join('')}</tbody>`;
  $('#tcards').innerHTML = TOURS.map(t=>`<article class="tcard">
    <div><h4><a class="link" style="color:inherit" href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.name)} ↗</a></h4>
    <div class="meta">${fmtDate(t.date)} · ${t.country} · ${t.players.toLocaleString('it-IT')} giocatori</div></div>
    <ol>${t.top.map(p=>`<li class="${p.rank===1?'win':''}"><span class="rank">${p.rank}</span>${archLink(p.deck,'')}<span class="p">${esc(p.player)}</span></li>`).join('')}</ol></article>`).join('');
}
$('#metaMore').addEventListener('click',()=>{ metaAll=!metaAll; renderMeta(); });

/* ---------- NEWS ---------- */
let newsCat = '';
function renderNews(){
  $('#newsDate').textContent = fmtDate(SNAP.newsDate||SNAP.date);
  const cats = [...new Set(NEWS.map(n=>n.cat))];
  $('#newsChips').innerHTML = ['',...cats].map(c=>`<button class="chip-btn" type="button" data-cat="${esc(c)}" aria-pressed="${c===newsCat}">${c?esc(c):'Tutte'}</button>`).join('');
  const list = NEWS.filter(n=>!newsCat||n.cat===newsCat).sort((a,b)=>b.date.localeCompare(a.date));
  $('#newsGrid').innerHTML = list.map(n=>`<a class="news" href="${esc(n.url)}" target="_blank" rel="noopener">
    <div class="top"><span class="cat cat-${esc(n.cat)}">${esc(n.cat)}</span><span>${fmtDate(n.date)}</span><span style="margin-left:auto">${esc(n.source)}</span></div>
    <h4>${esc(n.title)}</h4><p>${esc(n.summary)}</p><span class="go">Leggi su ${esc(n.source)} ↗</span></a>`).join('');
}
$('#newsChips').addEventListener('click',e=>{ const b=e.target.closest('[data-cat]'); if(!b) return; newsCat=b.dataset.cat; renderNews(); });

/* ---------- TOURNAMENTS ---------- */
const TYPES = ['League Challenge','League Cup','Regional','Special Event','International','Mondiali','Torneo online','Torneo locale / amichevole'];
function record(t){
  if(t.rounds && t.rounds.length){ const r={W:0,L:0,T:0}; t.rounds.forEach(x=>{ const k=roundRes(x); if(k) r[k]++; }); return r; }
  const m=t.manual||{}; return {W:+m.W||0,L:+m.L||0,T:+m.T||0};
}
const games = r => r.W+r.L+r.T;
const wr = r => games(r) ? r.W/games(r) : 0;
const recStr = r => `${r.W}-${r.L}-${r.T}`;
const GL = {W:'V',L:'S',T:'P'};
const BIG_EVENTS = ['League Cup','Regional','Special Event','International','Mondiali'];
function roundRes(x){ const g=(x.games||[]).filter(y=>y&&y.res); if(!g.length) return x.r||null; const w=g.filter(y=>y.res==='W').length, l=g.filter(y=>y.res==='L').length; return w>l?'W':l>w?'L':'T'; }
function normRound(x){ const bo=x.bo==='bo3'?'bo3':'bo1', n=bo==='bo3'?3:1;
  const games=(x.games&&x.games.length?x.games:(x.r?[{first:null,res:x.r}]:[])).slice(0,n).map(g=>({first:g.first||null,res:g.res||null}));
  while(games.length<n) games.push({first:null,res:null}); return {opp:x.opp||'', bo, games}; }
function gameText(x){ return (x.games||[]).map((g,j)=>g.res?`G${j+1} ${GL[g.res]}${g.first?(g.first==='F'?' da primo':' da secondo'):''}`:'').filter(Boolean).join(', '); }
function tFiltered(){
  const deck = $('#tFilter').value, per = $('#tPeriod').value, now = new Date();
  return App.data.tournaments.filter(t=>{
    if(deck && t.deckName!==deck) return false;
    if(per==='season' && t.date < '2026-09-01') return false;
    if(per && per!=='season' && (now - new Date(t.date))/864e5 > +per) return false;
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date) || (b.created||0)-(a.created||0));
}
function stats(list){
  const tot={W:0,L:0,T:0}; list.forEach(t=>{ const r=record(t); tot.W+=r.W; tot.L+=r.L; tot.T+=r.T; });
  const byDeck=new Map(), byOpp=new Map(), g={W:0,L:0,T:0}, first={W:0,L:0,T:0}, second={W:0,L:0,T:0};
  list.forEach(t=>{ const r=record(t), d=byDeck.get(t.deckName)||{name:t.deckName,n:0,W:0,L:0,T:0,best:null}; d.n++; d.W+=r.W; d.L+=r.L; d.T+=r.T; if(t.placement && (!d.best||+t.placement<d.best)) d.best=+t.placement; byDeck.set(t.deckName,d);
    (t.rounds||[]).forEach(x=>{ const k=(x.opp||'Sconosciuto').trim()||'Sconosciuto', o=byOpp.get(k)||{name:k,W:0,L:0,T:0,gW:0,gL:0,gT:0}, rr=roundRes(x); if(rr) o[rr]++;
      (x.games||[]).forEach(gm=>{ if(!gm||!gm.res) return; g[gm.res]++; o['g'+gm.res]++; if(gm.first==='F') first[gm.res]++; if(gm.first==='S') second[gm.res]++; });
      byOpp.set(k,o); }); });
  const best = list.filter(t=>t.placement).reduce((m,t)=>!m||+t.placement<+m.placement?t:m,null);
  return {tot, byDeck:[...byDeck.values()].sort((a,b)=>b.n-a.n), byOpp:[...byOpp.values()].sort((a,b)=>games(b)-games(a)||wr(b)-wr(a)), best, cuts:list.filter(t=>t.topcut).length, g, first, second};
}
const wrCell = r => { const p=wr(r), col = !games(r)?'var(--muted)': p>=.55?'var(--ok)':p<.45?'var(--bad)':'var(--fg)'; return `<td class="n" style="color:${col};font-weight:600">${games(r)?pct(p,0):'—'}</td>`; };
function renderTornei(){
  const sel=$('#tFilter'), cur=sel.value, names=[...new Set(App.data.tournaments.map(t=>t.deckName).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Tutti i mazzi</option>'+names.map(n=>`<option>${esc(n)}</option>`).join(''); sel.value = names.includes(cur)?cur:'';
  const list = tFiltered(), s = stats(list);
  $('#tKpis').innerHTML = `
    <div><span>Tornei</span><b>${list.length}</b><small>${s.cuts} top cut</small></div>
    <div><span>Record</span><b class="num" style="font-family:var(--display)">${recStr(s.tot)}</b><small>${games(s.tot)} partite</small></div>
    <div><span>Vittorie</span><b>${games(s.tot)?pct(wr(s.tot)):'—'}</b><small>pareggi contati come non vinte</small></div>
    <div><span>Partite singole (game)</span><b class="num" style="font-family:var(--display)">${recStr(s.g)}</b><small>${games(s.g)?pct(wr(s.g),0)+' vinte':'segna i game nei round'}</small></div>
    <div><span>Andando primo</span><b>${games(s.first)?pct(wr(s.first),0):'—'}</b><small>${games(s.first)?recStr(s.first)+' in '+games(s.first)+' game':'nessun dato'}</small></div>
    <div><span>Andando secondo</span><b>${games(s.second)?pct(wr(s.second),0):'—'}</b><small>${games(s.second)?recStr(s.second)+' in '+games(s.second)+' game':'nessun dato'}</small></div>
    <div><span>Miglior piazzamento</span><b>${s.best?esc(s.best.placement)+'°':'—'}</b><small>${s.best?esc(s.best.name):'registra la posizione finale'}</small></div>`;
  if(!App.data.tournaments.length){
    const empty = `<div class="empty-state"><b>Nessun torneo registrato</b>Premi “Nuovo torneo” per aggiungere il primo: mazzo, round e risultato.</div>`;
    $('#tTrend').innerHTML = empty; $('#tDecks').innerHTML=''; $('#tMatch').innerHTML=''; $('#tList').innerHTML = '';
    return;
  }
  const chrono = list.slice().reverse().slice(-20);
  $('#tTrend').innerHTML = chrono.length ? `<div class="trend">${chrono.map(t=>{ const r=record(t), p=wr(r); return `<div style="height:${Math.max(2,p*100)}%;background:${p>=.55?'var(--ok)':p<.45?'var(--bad)':'var(--accent)'}" title="${esc(t.name)}: ${recStr(r)}"><span>${games(r)?Math.round(p*100):'–'}</span></div>`; }).join('')}</div>
    <div class="trend-l">${chrono.map(t=>`<span>${t.date.slice(8,10)}/${t.date.slice(5,7)}</span>`).join('')}</div>` : '<p class="src">Nessun torneo nel filtro scelto.</p>';
  $('#tDecks').innerHTML = s.byDeck.length ? `<thead><tr><th>Mazzo</th><th class="n">Tornei</th><th class="n">Record</th><th class="n">Vittorie</th><th class="n">Top</th></tr></thead><tbody>${s.byDeck.map(d=>`<tr><td>${archLink(d.name||'—',metaUrl(d.name))}</td><td class="n">${d.n}</td><td class="n">${recStr(d)}</td>${wrCell(d)}<td class="n">${d.best?d.best+'°':'—'}</td></tr>`).join('')}</tbody>` : '';
  $('#tMatch').innerHTML = s.byOpp.length ? `<thead><tr><th>Avversario</th><th class="n">Round</th><th class="n">Record</th><th class="n">Vittorie</th><th class="n">Game</th></tr></thead><tbody>${s.byOpp.map(o=>`<tr><td>${archLink(o.name,metaUrl(o.name))}</td><td class="n">${games(o)}</td><td class="n">${recStr(o)}</td>${wrCell(o)}<td class="n">${o.gW+o.gL+o.gT?o.gW+'-'+o.gL+'-'+o.gT:'—'}</td></tr>`).join('')}</tbody>`
    : '<tbody><tr><td class="src">Registra i round con l\'archetipo avversario per vedere i matchup.</td></tr></tbody>';
  $('#tList').innerHTML = list.map(t=>{ const r=record(t), [y,m,d]=t.date.split('-');
    return `<div class="trow"><div class="date"><b>${+d}</b>${MONTHS[+m-1]} ${y.slice(2)}</div>
      <div style="min-width:0"><h4>${esc(t.name)}</h4><div class="sub"><span class="badge">${esc(t.type)}</span>${archLink(t.deckName||'—','')}${t.placement?`<span>${esc(t.placement)}°${t.players?' su '+esc(t.players):''}</span>`:''}${t.topcut?'<span class="badge w">Top cut</span>':''}</div>
        ${t.rounds&&t.rounds.length?`<div class="sub" style="margin-top:6px;gap:3px">${t.rounds.map((x,i)=>{ const rr=roundRes(x)||'T', gt=gameText(x); return `<span class="res-pill ${rr}" title="Round ${i+1}${x.bo==='bo3'?' (Bo3)':''} contro ${esc(x.opp||'?')}: ${GL[rr]}${gt?' · '+esc(gt):''}">${GL[rr]}</span>`; }).join('')}</div>`:''}
        ${t.notes?`<div class="sub" style="margin-top:4px">${esc(t.notes)}</div>`:''}</div>
      <div class="recbox"><div class="rec num">${recStr(r)}<small>${games(r)?pct(wr(r),0)+' vittorie':'nessuna partita'}</small></div>
        <div class="ops"><button class="btn small" type="button" data-edit="${esc(t.id)}">Modifica</button><button class="btn small" type="button" data-del="${esc(t.id)}">Elimina</button></div></div></div>`; }).join('') || '<p class="src">Nessun torneo nel filtro scelto.</p>';
}
['#tFilter','#tPeriod'].forEach(s=>$(s).addEventListener('change',renderTornei));
$('#tList').addEventListener('click',async e=>{
  const ed=e.target.closest('[data-edit]'); if(ed){ openTournament(App.data.tournaments.find(t=>t.id===ed.dataset.edit)); return; }
  const de=e.target.closest('[data-del]'); if(!de) return;
  if(!de.dataset.confirm){ de.dataset.confirm='1'; de.textContent='Conferma'; de.classList.add('primary'); setTimeout(()=>{ if(de.isConnected){ delete de.dataset.confirm; de.textContent='Elimina'; de.classList.remove('primary'); } },4000); return; }
  const id=de.dataset.del; App.data.tournaments = App.data.tournaments.filter(t=>t.id!==id); renderAll(); await App.Store.del('tournaments', id); App.toast('Torneo eliminato');
});

const dlg2 = $('#dlg2'), body2 = $('#dlg2Body');
function openTournament(t){
  const isNew = !t;
  t = t ? JSON.parse(JSON.stringify(t)) : {id:App.uid(), name:'', date:new Date().toISOString().slice(0,10), type:'League Challenge', players:'', deckId:'', deckName:'', placement:'', topcut:false, rounds:[], manual:null, notes:'', created:Date.now(), bo:'bo1'};
  if(!t.bo) t.bo = BIG_EVENTS.includes(t.type)?'bo3':'bo1';
  t.rounds = (t.rounds||[]).map(normRound);
  let mode = t.rounds.length || !t.manual ? 'rounds' : 'manual';
  const decks = App.data.decks.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const archNames = [...new Set([...META.map(m=>m.name), ...App.data.tournaments.flatMap(x=>(x.rounds||[]).map(r=>r.opp)).filter(Boolean)])];
  body2.innerHTML = `<h2>${isNew?'Nuovo torneo':'Modifica torneo'}</h2>
    <div class="form">
      <label class="full">Nome dell'evento<input id="fName" required placeholder="es. League Cup Milano" value="${esc(t.name)}"></label>
      <label>Data<input id="fDate" type="date" value="${esc(t.date)}"></label>
      <label>Tipo<select id="fType">${TYPES.map(x=>`<option ${x===t.type?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
      <label>Mazzo salvato<select id="fDeck"><option value="">— Nessuno / scrivo l'archetipo —</option>${decks.map(d=>`<option value="${esc(d.id)}" ${d.id===t.deckId?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label>
      <label>Archetipo giocato<input id="fArch" list="archList" placeholder="es. Dragapult ex" value="${esc(t.deckName)}"></label>
      <label>Posizione finale<input id="fPlace" type="number" min="1" placeholder="es. 5" value="${esc(t.placement)}"></label>
      <label class="full">Formato dei round<span class="seg" id="fBo"><button type="button" data-tbo="bo1" aria-pressed="${t.bo==='bo1'}">Bo1 · partita secca</button><button type="button" data-tbo="bo3" aria-pressed="${t.bo==='bo3'}">Bo3 · al meglio di tre</button></span><small class="src">Vale per i nuovi round; ogni round si può cambiare.</small></label>
      <label>Giocatori<input id="fPlayers" type="number" min="2" placeholder="es. 64" value="${esc(t.players)}"></label>
      <label class="chk full" style="flex-direction:row;color:var(--fg)"><input type="checkbox" id="fCut" ${t.topcut?'checked':''} style="width:auto"> Ho passato il taglio (top cut)</label>
      <div class="full"><div class="chips" id="fMode"><button type="button" class="chip-btn" data-mode="rounds" aria-pressed="${mode==='rounds'}">Round per round</button><button type="button" class="chip-btn" data-mode="manual" aria-pressed="${mode==='manual'}">Solo il record</button></div></div>
      <div class="full" id="fRoundsBox"></div>
      <label class="full">Note<textarea id="fNotes" placeholder="Cosa ha funzionato, cosa cambiare…">${esc(t.notes)}</textarea></label>
    </div>
    <datalist id="archList">${archNames.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
    <div class="row"><span class="hint" id="fMsg"></span><button class="btn" value="close">Annulla</button><button type="button" class="btn primary" id="fSave">${isNew?'Salva torneo':'Salva modifiche'}</button></div>`;
  const drawRounds = () => {
    const box = $('#fRoundsBox');
    if(mode==='manual'){ const m=t.manual||{W:0,L:0,T:0};
      box.innerHTML = `<div class="form" style="grid-template-columns:repeat(3,1fr)"><label>Vittorie<input id="mW" type="number" min="0" value="${+m.W||0}"></label><label>Sconfitte<input id="mL" type="number" min="0" value="${+m.L||0}"></label><label>Pareggi<input id="mT" type="number" min="0" value="${+m.T||0}"></label></div><p class="src" style="margin:6px 0 0">Senza i round non potrai vedere le statistiche dei matchup.</p>`; return; }
    box.innerHTML = `<div class="rounds">${t.rounds.map((x,i)=>{ const rr=roundRes(x);
      return `<div class="round2" data-i="${i}">
        <div class="rh"><span class="n">R${i+1}</span><input list="archList" data-opp="${i}" placeholder="Archetipo avversario" value="${esc(x.opp)}" aria-label="Avversario round ${i+1}">
          <span class="seg">${['bo1','bo3'].map(b=>`<button type="button" data-bo="${i}:${b}" aria-pressed="${x.bo===b}">${b==='bo1'?'Bo1':'Bo3'}</button>`).join('')}</span>
          <button type="button" class="xbtn" data-rmr="${i}" aria-label="Togli round ${i+1}">✕</button></div>
        ${x.games.map((g,j)=>`<div class="gm"><span class="n">${x.bo==='bo3'?'Game '+(j+1):'Partita'}</span>
          <span class="seg">${[['F','Primo'],['S','Secondo']].map(([k,l])=>`<button type="button" data-first="${i}:${j}:${k}" aria-pressed="${g.first===k}">${l}</button>`).join('')}</span>
          <span class="wlt">${['W','L','T'].map(k=>`<button type="button" class="${k}" data-g="${i}:${j}:${k}" aria-pressed="${g.res===k}" title="${{W:'Vinta',L:'Persa',T:'Pareggio'}[k]}">${GL[k]}</button>`).join('')}</span></div>`).join('')}
        <div class="rres">${x.bo==='bo3'?'Segna solo i game giocati.':''} Risultato del round: ${rr?`<span class="res-pill ${rr}">${GL[rr]}</span>`:'<span class="src">da segnare</span>'}</div></div>`; }).join('')}</div>
      <button type="button" class="btn small" id="addR" style="margin-top:8px"><svg class="i"><use href="#i-plus"/></svg>Aggiungi round</button>
      <span class="src" style="margin-left:8px">${(()=>{ const r=record({rounds:t.rounds}); return t.rounds.length?`Record ${recStr(r)}`:'Primo/Secondo = chi ha iniziato · V vinta, S persa, P pareggio'; })()}</span>`;
  };
  drawRounds();
  body2.onclick = e => {
    const md=e.target.closest('[data-mode]'); if(md){ mode=md.dataset.mode; if(mode==='manual' && !t.manual) t.manual=record({rounds:t.rounds}); body2.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b===md)); drawRounds(); return; }
    const tb=e.target.closest('[data-tbo]'); if(tb){ t.bo=tb.dataset.tbo; body2.querySelectorAll('[data-tbo]').forEach(b=>b.setAttribute('aria-pressed',b===tb)); return; }
    const bo=e.target.closest('[data-bo]'); if(bo){ const [i,v]=bo.dataset.bo.split(':'); const x=t.rounds[+i]; x.bo=v; t.rounds[+i]=normRound(x); drawRounds(); return; }
    const fi=e.target.closest('[data-first]'); if(fi){ const [i,j,k]=fi.dataset.first.split(':'); const g=t.rounds[+i].games[+j]; g.first = g.first===k?null:k;
      if(k && t.rounds[+i].bo==='bo3' && +j===0 && g.first){ /* game 2 usually starts with the loser of game 1: leave to the player */ } drawRounds(); return; }
    const gr=e.target.closest('[data-g]'); if(gr){ const [i,j,k]=gr.dataset.g.split(':'); const g=t.rounds[+i].games[+j]; g.res = g.res===k?null:k; drawRounds(); return; }
    if(e.target.closest('#addR')){ t.rounds.push(normRound({opp:'',bo:t.bo})); drawRounds(); const ins=body2.querySelectorAll('[data-opp]'); ins[ins.length-1].focus(); return; }
    const rm=e.target.closest('[data-rmr]'); if(rm){ t.rounds.splice(+rm.dataset.rmr,1); drawRounds(); return; }
  };
  body2.oninput = e => { const o=e.target.closest('[data-opp]'); if(o) t.rounds[+o.dataset.opp].opp=o.value;
    if(['mW','mL','mT'].includes(e.target.id)) t.manual={W:+$('#mW').value||0,L:+$('#mL').value||0,T:+$('#mT').value||0}; };
  $('#fType').addEventListener('change',e=>{ if(!t.rounds.length){ t.bo = BIG_EVENTS.includes(e.target.value)?'bo3':'bo1'; body2.querySelectorAll('[data-tbo]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tbo===t.bo)); } });
  $('#fDeck').addEventListener('change',e=>{ const d=decks.find(x=>x.id===e.target.value); if(d && !$('#fArch').value) $('#fArch').value=d.name; });
  $('#fSave').addEventListener('click',async ()=>{
    const name=$('#fName').value.trim(); if(!name){ $('#fMsg').textContent='Dai un nome al torneo.'; $('#fName').focus(); return; }
    const deckId=$('#fDeck').value, d=decks.find(x=>x.id===deckId);
    Object.assign(t,{name, date:$('#fDate').value||new Date().toISOString().slice(0,10), type:$('#fType').value, deckId, deckName:$('#fArch').value.trim()||(d?d.name:''),
      placement:$('#fPlace').value, players:$('#fPlayers').value, topcut:$('#fCut').checked, notes:$('#fNotes').value.trim()});
    if(mode==='manual'){ t.rounds=[]; t.manual=t.manual||{W:0,L:0,T:0}; } else { t.manual=null; t.rounds=t.rounds.map(x=>({opp:(x.opp||'').trim(), bo:x.bo, games:x.games, r:roundRes(x)})); }
    const i=App.data.tournaments.findIndex(x=>x.id===t.id); if(i>=0) App.data.tournaments[i]=t; else App.data.tournaments.push(t);
    dlg2.close(); renderAll(); const ok = await App.Store.put('tournaments', t); if(ok) App.toast(isNew?'Torneo salvato':'Modifiche salvate');
  });
  dlg2.showModal(); setTimeout(()=>$('#fName').focus(),30);
}
$('#bAddT').addEventListener('click',()=>openTournament(null));

/* ---------- METAFY ---------- */
function renderMetafy(){
  $('#coachList').innerHTML = COACHES.map(c=>`<div class="coach">${avatar(c.name,36).replace('class="av"','class="av"')}<div style="min-width:0"><h4>${esc(c.name)} <span class="src">${esc(c.country)}</span></h4>
    <p>${c.results.map(r=>`${r.rank}° ${esc(r.event.replace('Regional ',''))} (${esc(r.deck)})`).join(' · ')}</p></div>
    <a class="btn small" href="${esc(c.url)}" target="_blank" rel="noopener">Profilo ↗</a></div>`).join('');
  const links = App.prefs().links || [];
  $('#myLinks').innerHTML = links.length ? links.map((l,i)=>`<div class="coach">${avatar(l.name,36)}<div style="min-width:0"><h4>${esc(l.name)}</h4><p style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.url)}</p></div>
    <span style="display:flex;gap:4px"><a class="btn small" href="${esc(l.url)}" target="_blank" rel="noopener">Apri ↗</a><button class="xbtn" type="button" data-rml="${i}" aria-label="Togli ${esc(l.name)}">✕</button></span></div>`).join('')
    : '<p class="src">Nessun link salvato.</p>';
}
$('#linkForm').addEventListener('submit',e=>{ e.preventDefault(); const name=$('#lkName').value.trim(), url=$('#lkUrl').value.trim();
  if(!/^https?:\/\//i.test(url)){ App.toast('Il link deve iniziare con https://'); return; }
  const p=App.prefs(); p.links=(p.links||[]).concat([{name,url}]); App.Store.savePrefs(); $('#lkName').value=''; $('#lkUrl').value=''; renderAll(); App.toast('Link salvato'); });
$('#myLinks').addEventListener('click',e=>{ const b=e.target.closest('[data-rml]'); if(!b) return; const p=App.prefs(); p.links.splice(+b.dataset.rml,1); App.Store.savePrefs(); renderAll(); });

/* ---------- HOME WIDGETS ---------- */
const W = {
  quick:{title:'Accesso rapido', desc:'Scorciatoie alle sezioni del sito', go:null, render:()=>`<div class="qlinks">
    <a href="#deck"><svg class="i"><use href="#i-grid"/></svg>Deck builder</a><a href="#tornei"><svg class="i"><use href="#i-trophy"/></svg>Registra un torneo</a>
    <a href="#meta"><svg class="i"><use href="#i-chart"/></svg>Meta report</a><a href="#news"><svg class="i"><use href="#i-news"/></svg>Notizie</a></div>`},
  deck:{title:'Mazzo in lavorazione', desc:'Il mazzo aperto nel deck builder e la sua legalità', go:'#deck', render:()=>{
    const d=DL.getDeck(), v=DL.validate(), cs=d.cards.map(k=>DL.BY_KEY.get(k)), p=cs.filter(c=>c.sup==='P').length, t=cs.filter(c=>c.sup==='T').length;
    const stars=[...new Set(cs.filter(c=>c.sup==='P'&&(c.sub.includes('ex')||c.sub.includes('Stage 2'))).map(c=>c.name))].slice(0,3);
    return `<div style="display:flex;align-items:center;gap:8px"><b style="font-family:var(--display);font-size:20px">${esc(d.name)}</b><span class="status ${v.issues.length?'bad':'ok'}" style="margin-left:auto">${v.issues.length?v.issues.length+' problemi':'Legale'}</span></div>
      <div class="mini-stats"><div><span>Carte</span><b>${cs.length}/60</b></div><div><span>Pokémon</span><b>${p}</b></div><div><span>Allenatori</span><b>${t}</b></div></div>
      ${stars.length?`<p class="src" style="margin:0">Attaccanti: ${stars.map(esc).join(', ')}</p>`:''}${v.issues[0]?`<p class="src" style="margin:0;color:var(--bad)">${esc(v.issues[0])}</p>`:''}`; }},
  decks:{title:'I miei mazzi', desc:'Mazzi salvati nel deck builder', go:'#deck', render:()=>{ const L=App.data.decks.slice().sort((a,b)=>(b.updated||0)-(a.updated||0)).slice(0,5);
    return L.length ? `<table class="tbl"><tbody>${L.map(d=>`<tr><td>${archLink(d.name,'')}</td><td class="n">${d.cards.length} carte</td><td class="n"><button class="btn small" type="button" data-opendeck="${esc(d.id)}">Apri</button></td></tr>`).join('')}</tbody></table>` : '<p class="src">Nessun mazzo salvato. Nel deck builder usa “Mazzi” → “Salva”.</p>'; }},
  perf:{title:'Il mio rendimento', desc:'Record e percentuale di vittorie nei tornei', go:'#tornei', render:()=>{ const s=stats(App.data.tournaments);
    if(!App.data.tournaments.length) return '<p class="src">Ancora nessun torneo. <a class="link" href="#tornei">Registra il primo</a>.</p>';
    const fav = s.byDeck[0];
    return `<div class="mini-stats"><div><span>Tornei</span><b>${App.data.tournaments.length}</b></div><div><span>Record</span><b class="num" style="font-family:var(--display)">${recStr(s.tot)}</b></div><div><span>Vittorie</span><b>${games(s.tot)?pct(wr(s.tot),0):'—'}</b></div></div>
      ${fav?`<p class="src" style="margin:0">Mazzo più giocato: <b style="color:var(--fg)">${esc(fav.name||'—')}</b> (${fav.n} tornei, ${games(fav)?pct(wr(fav),0):'—'})</p>`:''}`; }},
  recent:{title:'Ultimi tornei giocati', desc:'I tuoi tornei più recenti', go:'#tornei', render:()=>{ const L=App.data.tournaments.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
    return L.length ? `<table class="tbl"><tbody>${L.map(t=>{ const r=record(t); return `<tr><td><b style="font-weight:600">${esc(t.name)}</b><div class="src">${fmtDate(t.date)} · ${esc(t.deckName||'—')}</div></td><td class="n">${recStr(r)}</td></tr>`; }).join('')}</tbody></table>` : '<p class="src">Nessun torneo registrato.</p>'; }},
  matchups:{title:'Matchup', desc:'I tuoi matchup migliori e peggiori', go:'#tornei', render:()=>{ const o=stats(App.data.tournaments).byOpp.filter(x=>games(x)>=1);
    if(!o.length) return '<p class="src">Registra i round con l\'archetipo avversario per vedere i matchup.</p>';
    const s=o.slice().sort((a,b)=>wr(b)-wr(a)||games(b)-games(a)); const best=s.slice(0,3), worst=s.slice(-3).reverse().filter(x=>!best.includes(x));
    const row=x=>`<tr><td>${archLink(x.name,'')}</td><td class="n">${recStr(x)}</td>${wrCell(x)}</tr>`;
    return `<table class="tbl"><tbody><tr><td colspan="3" class="src">Migliori</td></tr>${best.map(row).join('')}${worst.length?`<tr><td colspan="3" class="src">Peggiori</td></tr>${worst.map(row).join('')}`:''}</tbody></table>`; }},
  meta:{title:'Meta snapshot', desc:'I 6 archetipi più forti su Limitless', go:'#meta', render:()=>{ const mx=META[0].share;
    return `<table class="tbl" style="table-layout:fixed"><colgroup><col style="width:24px"><col><col style="width:26%"><col style="width:54px"></colgroup><tbody>${META.slice(0,6).map(m=>`<tr><td class="rank">${m.rank}</td><td>${archLink(m.name,m.url)}</td><td style="width:38%"><div class="bar"><b style="width:${m.share/mx*100}%"></b></div></td><td class="n">${pct(m.share/100,1)}</td></tr>`).join('')}</tbody></table><p class="src" style="margin:0">Limitless · ${fmtDate(SNAP.metaDate||SNAP.date)}</p>`; }},
  regionals:{title:'Ultimi Regional', desc:'Vincitori e mazzi dei tornei più recenti', go:'#meta', render:()=>`<table class="tbl"><tbody>${TOURS.slice(0,4).map(t=>`<tr><td><a class="link" style="color:var(--fg)" href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.name.replace('Regional ',''))}</a><div class="src">${fmtDate(t.date)} · ${t.players.toLocaleString('it-IT')} giocatori</div></td><td>${archLink(t.top[0].deck,'')}</td></tr>`).join('')}</tbody></table>`},
  news:{title:'Ultime notizie', desc:'Le notizie più recenti sul TCG', go:'#news', render:()=>`<div style="display:flex;flex-direction:column;gap:8px">${NEWS.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4).map(n=>`<a href="${esc(n.url)}" target="_blank" rel="noopener" style="text-decoration:none;color:var(--fg);display:flex;flex-direction:column;gap:2px"><span class="src"><span class="cat cat-${esc(n.cat)}">${esc(n.cat)}</span> ${fmtDate(n.date)} · ${esc(n.source)}</span><b style="font-weight:600">${esc(n.title)}</b></a>`).join('')}</div>`},
  reco:{title:'Mazzi consigliati', desc:'I mazzi in forma (Dragapult escluso) e le pick esotiche', go:'#consigli', render:()=>{ const R=J('recoData'), withD=!!App.prefs().withDragapult;
    const P=R.archetypes.filter(a=>a.recommendable&&(withD||!a.excluded)); const form=P.filter(a=>a.games>=300).sort((a,b)=>b.score-a.score).slice(0,3); const ex=P.filter(a=>a.exotic&&!form.includes(a)).sort((a,b)=>b.wrAdj-a.wrAdj).slice(0,2);
    const row=(a,tag)=>`<tr><td>${archLink(a.name,a.url)}${tag?' <span class="badge">'+tag+'</span>':''}</td><td class="n">${pct(a.wrAdj,1)}</td><td class="n src">${pct(a.share,1)}</td></tr>`;
    return `<table class="tbl" style="table-layout:fixed"><colgroup><col><col style="width:62px"><col style="width:54px"></colgroup><thead><tr><th>Mazzo</th><th class="n">Vittorie</th><th class="n">Giocato</th></tr></thead><tbody>${form.map(a=>row(a,'')).join('')}${ex.map(a=>row(a,'esotica')).join('')}</tbody></table>`; }},
  metafy:{title:'Coach e link', desc:'I tuoi link Metafy salvati', go:'#metafy', render:()=>{ const L=App.prefs().links||[];
    return L.length ? L.slice(0,5).map(l=>`<a class="btn small" style="margin:0 6px 6px 0" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ↗</a>`).join('') : `<p class="src">Salva i tuoi coach nella pagina <a class="link" href="#metafy">Metafy</a>.</p>`; }}
};
const DEFAULT = [{id:'quick'},{id:'deck'},{id:'perf'},{id:'reco'},{id:'meta'},{id:'news'},{id:'regionals'},{id:'recent'}];
const layout = () => { const p=App.prefs(); if(!Array.isArray(p.widgets)) p.widgets = DEFAULT.map(x=>({...x})); p.widgets = p.widgets.filter(w=>W[w.id]); return p.widgets; };
function renderHome(){
  const L = layout();
  $('#wgrid').innerHTML = L.map((w,i)=>{ const def=W[w.id]; let inner; try{ inner=def.render(); }catch(e){ inner='<p class="src">Contenuto non disponibile.</p>'; }
    return `<section class="widget${w.wide?' wide':''}" data-w="${i}"><header><h3>${esc(def.title)}</h3>${def.go?`<a class="link go" href="${def.go}">Apri →</a>`:''}
      <span class="wctl"><button type="button" data-wa="up" aria-label="Sposta su" ${i===0?'disabled':''}>↑</button><button type="button" data-wa="down" aria-label="Sposta giù" ${i===L.length-1?'disabled':''}>↓</button><button type="button" data-wa="wide" aria-label="Allarga o stringi">⇔</button><button type="button" class="rm" data-wa="rm" aria-label="Togli widget">✕</button></span></header>${inner}</section>`; }).join('')
    || '<div class="empty-state"><b>La plancia è vuota</b>Premi “Personalizza” e aggiungi i widget che ti servono.</div>';
  const used = new Set(L.map(w=>w.id));
  $('#wcat').innerHTML = Object.entries(W).filter(([id])=>!used.has(id)).map(([id,d])=>`<button type="button" data-addw="${id}"><b>+ ${esc(d.title)}</b><span>${esc(d.desc)}</span></button>`).join('') || '<p class="src">Hai già aggiunto tutti i widget.</p>';
}
$('#wgrid').addEventListener('click',e=>{
  const od=e.target.closest('[data-opendeck]'); if(od){ DL.openDeck(App.data.decks.find(d=>d.id===od.dataset.opendeck)); location.hash='deck'; return; }
  const b=e.target.closest('[data-wa]'); if(!b) return; const i=+b.closest('[data-w]').dataset.w, L=layout();
  if(b.dataset.wa==='up' && i>0) [L[i-1],L[i]]=[L[i],L[i-1]];
  if(b.dataset.wa==='down' && i<L.length-1) [L[i+1],L[i]]=[L[i],L[i+1]];
  if(b.dataset.wa==='wide') L[i].wide=!L[i].wide;
  if(b.dataset.wa==='rm') L.splice(i,1);
  App.Store.savePrefs(); renderHome();
});
$('#wcat').addEventListener('click',e=>{ const b=e.target.closest('[data-addw]'); if(!b) return; layout().push({id:b.dataset.addw}); App.Store.savePrefs(); renderHome(); });
$('#bEditHome').addEventListener('click',()=>{ const on=document.body.classList.toggle('editing'); $('#bEditHome span').textContent = on?'Fatto':'Personalizza'; $('#bEditHome').classList.toggle('primary',on); });

/* ---------- wiring ---------- */
function renderAll(){ renderHome(); renderTornei(); renderMetafy(); }
App.renderAll = renderAll;
renderMeta(); renderNews();
App.on(what=>{ if(what==='data'){ renderAll(); DL.onData && DL.onData(); } if(what==='deck' && App.page==='home') renderHome(); if(what==='page' && App.page==='home') renderHome(); });
App.T = {stats, record, roundRes, wr, games, recStr};
})();
