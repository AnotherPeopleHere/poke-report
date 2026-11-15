/* ===== Gruppo: shared database of the group's tournaments, matchups and lists ===== */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = App.esc, T = App.T, DL = window.DeckLab;
const pct = (p,dec=0) => (p*100).toLocaleString('it-IT',{maximumFractionDigits:dec,minimumFractionDigits:dec})+'%';
function hue(s){ let h=0; for(const ch of String(s)) h=(h*31+ch.charCodeAt(0))%360; return h; }
const av = n => `<span class="av" style="background:hsl(${hue(n)} 55% 45%)">${esc(String(n||'?').charAt(0).toUpperCase())}</span>`;
const key = s => String(s||'').trim().toLowerCase();
let cache = null, loading = false;
const F = {player:'', deck:'', period:'', bo:'', arch:'', side:'played'};   // filters and explorer state (kept for the visit)

function state(html){ $('#gBody').innerHTML = html; }
async function load(){
  if(App.page!=='gruppo') return;
  if(!App.sb){ state('<div class="empty-state"><b>Il gruppo non è ancora attivo</b>Serve l’accesso con l’account per condividere i risultati con gli amici.</div>'); return; }
  if(!App.Store.user){ state('<div class="empty-state"><b>Accedi per vedere il gruppo</b>Entra con la tua email, poi inserisci lo stesso codice gruppo dei tuoi amici.<br><br><button class="btn primary" type="button" data-acct>Accedi</button></div>'); return; }
  const p = App.Store.profile || {};
  if(!p.group_code){ state('<div class="empty-state"><b>Non sei ancora in un gruppo</b>Scegli un codice (es. “amici-pokemon-torino”) e condividilo con i tuoi amici: chi lo inserisce entra nel gruppo.<br><br><button class="btn primary" type="button" data-acct>Imposta il codice gruppo</button></div>'); return; }
  if(loading) return; loading = true;
  if(!cache) state('<p class="src">Carico il gruppo…</p>');
  try{ cache = await App.Store.group(); render(); }
  catch(e){ console.error(e); state('<div class="empty-state"><b>Non riesco a caricare il gruppo</b>Controlla la connessione e riprova.</div>'); }
  loading = false;
}

/* ---------- data shaping ---------- */
const nameOf = id => { const m=cache.members.find(x=>x.id===id); return (m && m.display_name) || 'Amico'; };
function inPeriod(date){
  if(!F.period) return true;
  if(F.period==='season') return String(date) >= '2026-09-01';
  return (Date.now() - new Date(date)) / 864e5 <= +F.period;
}
function roundsOf(list){
  const out = [];
  list.forEach(t=>(t.rounds||[]).forEach((x,i)=>{
    const games = (x.games||[]).filter(g=>g && g.res);
    out.push({t, player:t.user_id, deck:(t.deckName||'').trim(), opp:(x.opp||'').trim(), bo:x.bo==='bo3'?'bo3':'bo1', games, res:T.roundRes(x), n:i+1});
  }));
  return out;
}
function filteredTournaments(){
  return cache.tournaments.filter(t => (!F.player || t.user_id===F.player) && (!F.deck || key(t.deckName)===key(F.deck)) && inPeriod(t.date));
}
function filteredRounds(){ return roundsOf(filteredTournaments()).filter(r => !F.bo || r.bo===F.bo); }
function agg(rounds){
  const a = {R:0,W:0,L:0,T:0, gW:0,gL:0,gT:0, fW:0,fN:0, sW:0,sN:0, b1W:0,b1N:0, b3W:0,b3N:0};
  rounds.forEach(r=>{
    if(!r.res) return;
    a.R++; a[r.res]++;
    if(r.bo==='bo3'){ a.b3N++; if(r.res==='W') a.b3W++; } else { a.b1N++; if(r.res==='W') a.b1W++; }
    r.games.forEach(g=>{ a['g'+g.res]++; if(g.first==='F'){ a.fN++; if(g.res==='W') a.fW++; } if(g.first==='S'){ a.sN++; if(g.res==='W') a.sW++; } });
  });
  return a;
}
const rate = (w,n) => n ? pct(w/n) : '—';
const rateCls = (w,n) => !n ? 'muted' : w/n>=.55 ? 'good' : w/n<.45 ? 'bad' : '';
const cell = (w,n,title) => `<td class="n ${rateCls(w,n)}" title="${title||''}${n?` (${w} su ${n})`:''}">${rate(w,n)}</td>`;
const STAT_HEAD = '<th class="n">Round</th><th class="n">Record</th><th class="n">Vittorie</th><th class="n">Game</th><th class="n" title="Game vinti andando per primo">Primo</th><th class="n" title="Game vinti andando per secondo">Secondo</th><th class="n">Bo1</th><th class="n">Bo3</th>';
const statCells = a => `<td class="n">${a.R}</td><td class="n">${a.W}-${a.L}-${a.T}</td>${cell(a.W,a.R,'Round vinti')}<td class="n">${a.gW+a.gL+a.gT?a.gW+'-'+a.gL+(a.gT?'-'+a.gT:''):'—'}</td>${cell(a.fW,a.fN,'Game vinti da primo')}${cell(a.sW,a.sN,'Game vinti da secondo')}${cell(a.b1W,a.b1N,'Round Bo1 vinti')}${cell(a.b3W,a.b3N,'Round Bo3 vinti')}`;
function groupBy(rounds, fn){ const m=new Map(); rounds.forEach(r=>{ const k=fn(r); if(!k) return; if(!m.has(k)) m.set(k,[]); m.get(k).push(r); }); return [...m].map(([k,rs])=>({k, a:agg(rs)})).sort((x,y)=>y.a.R-x.a.R || (y.a.W/y.a.R)-(x.a.W/x.a.R)); }

/* ---------- render ---------- */
function options(list, sel, all){ return `<option value="">${all}</option>`+list.map(([v,l])=>`<option value="${esc(v)}" ${v===sel?'selected':''}>${esc(l)}</option>`).join(''); }
function render(){
  const {members, tournaments} = cache, code = App.Store.profile.group_code;
  const decks = [...new Set(tournaments.map(t=>(t.deckName||'').trim()).filter(Boolean))].sort();
  const allRounds = roundsOf(tournaments);
  const archs = [...new Map([...allRounds.map(r=>r.opp), ...allRounds.map(r=>r.deck)].filter(Boolean).map(n=>[key(n),n])).values()].sort((a,b)=>a.localeCompare(b));
  if(F.arch && !archs.some(a=>key(a)===key(F.arch))) F.arch='';
  const ts = filteredTournaments(), rs = filteredRounds(), a = agg(rs);
  const players = members.map(m=>[m.id, m.display_name||'Amico']);
  state(`
    <div class="gfilters panel">
      <label>Giocatore<select data-f="player">${options(players, F.player, 'Tutto il gruppo')}</select></label>
      <label>Mazzo giocato<select data-f="deck">${options(decks.map(d=>[d,d]), F.deck, 'Tutti i mazzi')}</select></label>
      <label>Periodo<select data-f="period">${options([['90','Ultimi 3 mesi'],['365','Ultimi 12 mesi'],['season','Stagione 2026-27']], F.period, 'Sempre')}</select></label>
      <label>Formato<select data-f="bo">${options([['bo1','Solo Bo1'],['bo3','Solo Bo3']], F.bo, 'Bo1 e Bo3')}</select></label>
      <span class="gcode" title="Codice del gruppo">${esc(code)} · ${members.length} ${members.length===1?'membro':'membri'}</span>
    </div>
    <div class="kpis">
      <div><span>Tornei</span><b>${ts.length}</b><small>${a.R} round registrati</small></div>
      <div><span>Round vinti</span><b class="${rateCls(a.W,a.R)}">${rate(a.W,a.R)}</b><small>record ${a.W}-${a.L}-${a.T}</small></div>
      <div><span>Game vinti</span><b class="${rateCls(a.gW,a.gW+a.gL+a.gT)}">${rate(a.gW,a.gW+a.gL+a.gT)}</b><small>${a.gW}-${a.gL}${a.gT?'-'+a.gT:''} nei game</small></div>
      <div><span>Andando primo</span><b class="${rateCls(a.fW,a.fN)}">${rate(a.fW,a.fN)}</b><small>${a.fN} game</small></div>
      <div><span>Andando secondo</span><b class="${rateCls(a.sW,a.sN)}">${rate(a.sW,a.sN)}</b><small>${a.sN} game</small></div>
      <div><span>Bo1 · Bo3</span><b>${rate(a.b1W,a.b1N)} · ${rate(a.b3W,a.b3N)}</b><small>round vinti per formato</small></div>
    </div>
    <div class="panel" id="gExplorer">
      <h3>Esplora un archetipo <span class="meta">i filtri qui sopra valgono anche qui</span></h3>
      <div class="gexp-bar">
        <select data-f="arch" aria-label="Archetipo da esplorare">${options(archs.map(x=>[x,x]), F.arch, 'Scegli un archetipo…')}</select>
        <div class="seg" role="tablist" aria-label="Punto di vista">
          <button type="button" data-side="played" aria-pressed="${F.side==='played'}">Quando lo giochiamo</button>
          <button type="button" data-side="faced" aria-pressed="${F.side==='faced'}">Quando lo affrontiamo</button>
        </div>
      </div>
      <div id="gExpBody">${explorer(rs)}</div>
    </div>
    <div class="panel"><h3>Giocatori e liste <span class="meta">mazzo più giocato da ognuno, nel periodo scelto</span></h3>${playersTable(members, tournaments)}</div>
    <div class="panel"><h3>Tornei del gruppo <span class="meta">${ts.length} nei filtri scelti</span></h3>${recent(ts)}</div>`);
}
function explorer(rs){
  if(!F.arch){
    const faced = groupBy(rs, r=>r.opp);
    return faced.length ? `<p class="src" style="margin:0 0 8px">Gli archetipi che il gruppo incontra di più. Scegline uno qui sopra per i dettagli, o tocca una riga.</p>
      <div class="tbl-wrap"><table class="tbl gtbl"><thead><tr><th>Avversario</th>${STAT_HEAD}</tr></thead><tbody>${faced.map(x=>`<tr class="pick" data-arch="${esc(x.k)}"><td><b>${esc(x.k)}</b></td>${statCells(x.a)}</tr>`).join('')}</tbody></table></div>`
      : '<p class="src">Nessun round con l’archetipo avversario nei filtri scelti. Nel registro tornei segna l’avversario di ogni round.</p>';
  }
  const A = key(F.arch);
  if(F.side==='played'){
    const mine = rs.filter(r=>key(r.deck)===A), tot = agg(mine);
    if(!mine.length) return `<p class="src">Nessuno del gruppo ha giocato ${esc(F.arch)} nei filtri scelti.</p>`;
    const vs = groupBy(mine, r=>r.opp||'Avversario non segnato'), by = groupBy(mine, r=>nameOf(r.player));
    return `<div class="tbl-wrap"><table class="tbl gtbl"><thead><tr><th>${esc(F.arch)} contro…</th>${STAT_HEAD}</tr></thead><tbody>
        <tr class="tot"><td>Totale</td>${statCells(tot)}</tr>${vs.map(x=>`<tr><td>${esc(x.k)}</td>${statCells(x.a)}</tr>`).join('')}</tbody></table></div>
      <h4 class="gsub">Chi lo gioca</h4><div class="tbl-wrap"><table class="tbl gtbl"><thead><tr><th>Giocatore</th>${STAT_HEAD}</tr></thead><tbody>${by.map(x=>`<tr><td><span class="arch">${av(x.k)}<span class="t">${esc(x.k)}</span></span></td>${statCells(x.a)}</tr>`).join('')}</tbody></table></div>`;
  }
  const vsIt = rs.filter(r=>key(r.opp)===A), tot = agg(vsIt);
  if(!vsIt.length) return `<p class="src">Nessuno del gruppo ha affrontato ${esc(F.arch)} nei filtri scelti.</p>`;
  const withDeck = groupBy(vsIt, r=>r.deck||'Mazzo non segnato'), by = groupBy(vsIt, r=>nameOf(r.player));
  return `<div class="tbl-wrap"><table class="tbl gtbl"><thead><tr><th>Contro ${esc(F.arch)} con…</th>${STAT_HEAD}</tr></thead><tbody>
      <tr class="tot"><td>Totale del gruppo</td>${statCells(tot)}</tr>${withDeck.map(x=>`<tr><td>${esc(x.k)}</td>${statCells(x.a)}</tr>`).join('')}</tbody></table></div>
    <h4 class="gsub">Giocatore per giocatore</h4><div class="tbl-wrap"><table class="tbl gtbl"><thead><tr><th>Giocatore</th>${STAT_HEAD}</tr></thead><tbody>${by.map(x=>`<tr><td><span class="arch">${av(x.k)}<span class="t">${esc(x.k)}</span></span></td>${statCells(x.a)}</tr>`).join('')}</tbody></table></div>`;
}
function favorite(userId, tournaments){
  const mine = tournaments.filter(t=>t.user_id===userId && (t.deckName||'').trim() && inPeriod(t.date));
  if(!mine.length) return null;
  const m = new Map(); mine.forEach(t=>{ const k=t.deckName.trim(); if(!m.has(k)) m.set(k,[]); m.get(k).push(t); });
  const [name, list] = [...m].sort((x,y)=>y[1].length-x[1].length || String(y[1][0].date).localeCompare(String(x[1][0].date)))[0];
  const withList = list.filter(t=>Array.isArray(t.list) && t.list.length).sort((x,y)=>String(y.date).localeCompare(String(x.date)))[0];
  return {name, n:list.length, a:agg(roundsOf(list).filter(r=>!F.bo || r.bo===F.bo)), list: withList ? withList.list : null, from: withList};
}
function playersTable(members, tournaments){
  const me = App.Store.user.id;
  const rows = members.map(m=>({m, f:favorite(m.id, tournaments), total:tournaments.filter(t=>t.user_id===m.id && inPeriod(t.date)).length}));
  return `<div class="tbl-wrap"><table class="tbl gtbl"><thead><tr><th>Giocatore</th><th class="n">Tornei</th><th>Mazzo più giocato</th><th class="n">Con quel mazzo</th><th class="n">Vittorie</th><th></th></tr></thead><tbody>${rows.map(({m,f,total})=>`<tr${m.id===me?' class="me"':''}>
      <td><span class="arch">${av(m.display_name)}<span class="t">${esc(m.display_name||'Amico')}${m.id===me?' <span class="badge">tu</span>':''}</span></span>${m.share_stats===false?'<div class="src">non condivide i tornei</div>':''}</td>
      <td class="n">${total}</td><td>${f?esc(f.name):'<span class="src">—</span>'}</td><td class="n">${f?f.n+' tornei':'—'}</td>${f?cell(f.a.W,f.a.R,'Round vinti'):'<td class="n muted">—</td>'}
      <td class="n">${f&&f.list?`<button class="btn small" type="button" data-list="${esc(m.id)}">Vedi lista</button>`:f?'<span class="src" title="Nel registro tornei scegli il mazzo salvato usato, così la lista viene condivisa">lista non collegata</span>':''}</td></tr>`).join('')}</tbody></table></div>`;
}
function recent(ts){
  const list = ts.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12);
  return list.length ? `<div class="tbl-wrap"><table class="tbl gtbl"><thead><tr><th>Torneo</th><th>Giocatore</th><th>Mazzo</th><th class="n">Record</th><th class="n">Pos.</th></tr></thead><tbody>${list.map(t=>{ const r=T.record(t);
    return `<tr><td><b style="font-weight:600">${esc(t.name)}</b><div class="src">${esc(t.date)} · ${esc(t.type||'')}</div></td><td>${esc(nameOf(t.user_id))}</td><td>${esc(t.deckName||'—')}</td><td class="n">${T.recStr(r)}</td><td class="n">${t.placement?esc(t.placement)+'°':'—'}</td></tr>`; }).join('')}</tbody></table></div>`
    : '<p class="src">Nessun torneo nei filtri scelti.</p>';
}

/* ---------- list pop-up ---------- */
function showList(userId){
  const f = favorite(userId, cache.tournaments); if(!f || !f.list) return;
  const cards = f.list.map(k=>DL.BY_KEY.get(k)).filter(Boolean);
  const counts = new Map(); cards.forEach(c=>counts.set(c.key,(counts.get(c.key)||0)+1));
  const rows = [...counts].map(([k,q])=>({c:DL.BY_KEY.get(k), q}));
  const sec = (sup,label) => { const it=rows.filter(x=>x.c.sup===sup).sort((a,b)=>b.q-a.q||a.c.name.localeCompare(b.c.name)); if(!it.length) return '';
    return `<div class="st-sec"><b>${label} <span class="hint num">${it.reduce((a,x)=>a+x.q,0)}</span></b><ul class="dlist">${it.map(({c,q})=>`<li><span class="q">${q}</span><span class="cbar ty-${c.color}"></span><span class="nm">${esc(c.name)}</span><span></span></li>`).join('')}</ul></div>`; };
  const d=$('#dlg2'), body=$('#dlg2Body');
  body.innerHTML = `<div class="dlg-h"><div><h2>${esc(f.name)}</h2><p class="hint" style="margin:2px 0 0">Lista di ${esc(nameOf(userId))} · ${cards.length} carte${f.from?` · usata a ${esc(f.from.name)} (${esc(f.from.date)})`:''}</p></div>
      <button class="xclose" type="button" id="glClose" aria-label="Chiudi la lista">✕</button></div>
    <div class="glist">${sec('P','Pokémon')}${sec('T','Allenatori')}${sec('E','Energie')}</div>
    <div class="row"><span class="hint">La copia finisce tra i tuoi mazzi: puoi modificarla senza toccare la sua.</span><button class="btn primary" type="button" id="glCopy">Copia nel mio deck builder</button></div>`;
  d.classList.add('sheet'); d.showModal();
  d.addEventListener('close',()=>d.classList.remove('sheet'),{once:true});
  $('#glClose').addEventListener('click',()=>d.close());
  $('#glCopy').addEventListener('click',()=>{
    const text = rows.map(({c,q})=>`${q} ${c.name} ${c.prints[0][0]} ${c.prints[0][1]}`).join('\n');
    d.close(); DL.importList(text, `${f.name} (di ${nameOf(userId)})`); location.hash='deck';
  });
}

/* ---------- events ---------- */
$('#pg-gruppo').addEventListener('click',e=>{
  if(e.target.closest('[data-acct]')){ App.accountDialog(); return; }
  const sd=e.target.closest('[data-side]'); if(sd){ F.side=sd.dataset.side; render(); return; }
  const pk=e.target.closest('tr.pick[data-arch]'); if(pk){ F.arch=pk.dataset.arch; render(); $('#gExplorer').scrollIntoView({behavior:'smooth',block:'start'}); return; }
  const ls=e.target.closest('[data-list]'); if(ls){ showList(ls.dataset.list); return; }
});
$('#pg-gruppo').addEventListener('change',e=>{ const s=e.target.closest('[data-f]'); if(!s) return; F[s.dataset.f]=s.value; render(); });
$('#gProfile').addEventListener('click',()=>App.accountDialog());
App.on(w=>{ if(w==='group'){ cache=null; load(); } if(w==='data' && App.page==='gruppo'){ load(); } if(w==='page' && App.page==='gruppo') load(); });
App.groupSummary = async () => { if(!cache && App.Store.profile && App.Store.profile.group_code){ try{ cache = await App.Store.group(); }catch(e){} } return cache; };
})();
