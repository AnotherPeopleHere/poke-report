/* ===== Gruppo: shared database of the group's tournaments, matchups and lists ===== */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = App.esc, T = App.T, DL = window.DeckLab;
const pct = (p,dec=0) => (p*100).toLocaleString('it-IT',{maximumFractionDigits:dec,minimumFractionDigits:dec})+'%';
function hue(s){ let h=0; for(const ch of String(s)) h=(h*31+ch.charCodeAt(0))%360; return h; }
// photo of a member, looked up by id or by display name
const memberBy = x => cache && cache.members.find(m=>m.id===x || (m.display_name||'Amico')===x);
const av = n => { const m=memberBy(n); return App.avatar(m ? (m.display_name||'Amico') : n, m && m.avatar_url); };
const key = s => App.archKey(s);
let cache = null, loading = false;
const F = {player:'', deck:'', period:'', bo:'', src:'', arch:'', side:'played', tab:'over', fopen:false};   // filters and explorer state (kept for the visit)

function state(html){ $('#gBody').innerHTML = html; }
async function load(){
  if(App.page!=='gruppo') return;
  if(!App.sb){ state('<div class="empty-state"><b>Il gruppo non è ancora attivo</b>Serve l’accesso con l’account per condividere i risultati con gli amici.</div>'); return; }
  if(!App.Store.user){ state('<div class="empty-state"><b>Accedi per vedere il gruppo</b>Entra con la tua email, poi inserisci lo stesso codice gruppo dei tuoi amici.<br><br><button class="btn primary" type="button" data-acct>Accedi</button></div>'); return; }
  const p = App.Store.profile || {};
  if(!p.group_code){ state('<div class="empty-state"><b>Non sei ancora in un gruppo</b>Scegli un codice (es. “amici-pokemon-torino”) e condividilo con i tuoi amici: chi lo inserisce entra nel gruppo.<br><br><button class="btn primary" type="button" data-acct>Imposta il codice gruppo</button></div>'); return; }
  if(loading) return; loading = true;
  if(!cache) state('<p class="src">Carico il gruppo…</p>');
  try{ cache = await App.Store.group();
    // live tournaments of friends: shown on their own (rounds and record, no deck) and kept out of the statistics
    cache.live = cache.tournaments.filter(t=>t.ongoing); cache.tournaments = cache.tournaments.filter(t=>!t.ongoing); render(); }
  catch(e){ console.error(e); state('<div class="empty-state"><b>Non riesco a caricare il gruppo</b>Controlla la connessione e riprova.</div>'); }
  loading = false;
}

/* ---------- data shaping ---------- */
// TCG Live sessions (imported logs and quick matches) are not real tournaments: they are counted apart
const isLive = t => t.type==='TCG Live';
const realT = list => list.filter(t=>!isLive(t));
const liveN = list => list.length - realT(list).length;
const nT = (n,live) => !n && live ? `${live} live` : `${n} ${n===1?'torneo':'tornei'}${live?` <span class="src">+ ${live} live</span>`:''}`;
// archetype name with its pixel sprites (an empty slot keeps names aligned when no sprite is known)
const archN = (n, bold) => `<span class="arch"><span class="dsp">${DL.archSprites?DL.archSprites(n):''}</span><span class="t">${bold?`<b>${esc(n)}</b>`:esc(n)}</span></span>`;
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
    out.push({t, player:t.user_id, deck:(t.deckName||'').trim(), opp:(x.opp||'').trim(), bo:x.bo==='bo3'?'bo3':'bo1', games, res:T.roundRes(x), n:i+1, bye:!!x.bye, id:!!x.id});
  }));
  return out;
}
function filteredTournaments(){
  return cache.tournaments.filter(t => (!F.src || (F.src==='live')===isLive(t)) && (!F.player || t.user_id===F.player) && (!F.deck || key(t.deckName)===key(F.deck)) && inPeriod(t.date));
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
  const nf = ['player','deck','period','bo','src'].filter(k=>F[k]).length;
  const TABS = [['over','Panoramica'],['match','Matchup'],['players','Giocatori'],['tours','Tornei']];
  const sec = (k, html) => `<section class="gsec${F.tab===k?' on':''}" data-gsec="${k}" role="tabpanel">${html}</section>`;
  state(`
    <div class="gtop">
      <span class="gcode">${esc(code)} · ${members.length} ${members.length===1?'membro':'membri'}</span>
      <button class="btn small gfbtn" type="button" data-gfilters aria-expanded="${F.fopen}"><svg class="i"><use href="#i-filter"/></svg>Filtri${nf?` <span class="cnt">${nf}</span>`:''}</button>
    </div>
    <div class="gfilters panel${F.fopen?' open':''}">
      <label>Giocatore<select data-f="player">${options(players, F.player, 'Tutto il gruppo')}</select></label>
      <label>Mazzo giocato<select data-f="deck">${options(decks.map(d=>[d,d]), F.deck, 'Tutti i mazzi')}</select></label>
      <label>Periodo<select data-f="period">${options([['90','Ultimi 3 mesi'],['365','Ultimi 12 mesi'],['season','Stagione 2026-27']], F.period, 'Sempre')}</select></label>
      <label>Partite<select data-f="src">${options([['tour','Solo tornei'],['live','Solo partite TCG Live']], F.src, 'Tornei e partite TCG Live')}</select></label>
      <label>Formato<select data-f="bo">${options([['bo1','Solo Bo1'],['bo3','Solo Bo3']], F.bo, 'Bo1 e Bo3')}</select></label>
      <span class="gcode" title="Codice del gruppo">${esc(code)} · ${members.length} ${members.length===1?'membro':'membri'}</span>
    </div>
    <nav class="gtabs" id="gTabs" role="tablist" aria-label="Sezioni del gruppo">${TABS.map(([k,l])=>`<button type="button" role="tab" data-gtab="${k}" aria-selected="${F.tab===k}">${l}</button>`).join('')}</nav>
    ${sec('over', `${(cache.live||[]).length?`<div class="panel"><h3>Tornei in corso <span class="meta">il mazzo si vede quando il torneo finisce</span></h3><div class="glive">${cache.live.map(t=>{ const r=T.record(t);
        return `<div class="glive-i"><span class="arch">${av(t.user_id)}<span class="t"><b>${esc(nameOf(t.user_id))}</b> · ${esc(t.name)}</span></span><span class="live-badge">● ${T.recStr(r)}</span>
          <div class="lv-pills sm">${(t.rounds||[]).map(x=>{ const q=T.roundRes(x); return `<span class="res-pill ${q||'T'}${x.id||x.bye?' id':''}" title="${x.opp?esc(x.opp):''}">${x.bye?'BYE':x.id?'ID':q?({W:'V',L:'S',T:'P'})[q]:'·'}</span>`; }).join('')||'<span class="src">nessun round ancora</span>'}</div></div>`; }).join('')}</div></div>`:''}<div class="kpis">
      <div><span>Tornei</span><b>${realT(ts).length}</b><small>${liveN(ts)?`+ ${liveN(ts)} ${liveN(ts)===1?'sessione':'sessioni'} TCG Live · `:''}${a.R} round registrati</small></div>
      <div><span>Round vinti</span><b class="${rateCls(a.W,a.R)}">${rate(a.W,a.R)}</b><small>record ${a.W}-${a.L}-${a.T}</small></div>
      <div><span>Game vinti</span><b class="${rateCls(a.gW,a.gW+a.gL+a.gT)}">${rate(a.gW,a.gW+a.gL+a.gT)}</b><small>${a.gW}-${a.gL}${a.gT?'-'+a.gT:''} nei game</small></div>
      <div><span>Andando primo</span><b class="${rateCls(a.fW,a.fN)}">${rate(a.fW,a.fN)}</b><small>${a.fN} game</small></div>
      <div><span>Andando secondo</span><b class="${rateCls(a.sW,a.sN)}">${rate(a.sW,a.sN)}</b><small>${a.sN} game</small></div>
      <div><span>Bo1 · Bo3</span><b>${rate(a.b1W,a.b1N)} · ${rate(a.b3W,a.b3N)}</b><small>round vinti per formato</small></div>
    </div>`)}
    ${sec('match', `<div class="panel" id="gExplorer">
      <h3>Esplora un archetipo <span class="meta">i filtri qui sopra valgono anche qui</span></h3>
      <div class="gexp-bar">
        <select data-f="arch" aria-label="Archetipo da esplorare">${options(archs.map(x=>[x,x]), F.arch, 'Scegli un archetipo…')}</select>
        <div class="seg" role="tablist" aria-label="Punto di vista">
          <button type="button" data-side="played" aria-pressed="${F.side==='played'}">Quando lo giochiamo</button>
          <button type="button" data-side="faced" aria-pressed="${F.side==='faced'}">Quando lo affrontiamo</button>
        </div>
      </div>
      <div id="gExpBody">${explorer(rs)}</div>
    </div>`)}
    ${sec('players', `<div class="panel"><h3>Giocatori e liste <span class="meta">mazzo più giocato da ognuno, nel periodo scelto</span></h3>${playersTable(members, tournaments)}</div>`)}
    ${sec('tours', `<div class="panel"><h3>Tornei del gruppo <span class="meta">${realT(ts).length} nei filtri scelti</span></h3>${F.src==='live'?'<p class="src">Hai scelto solo le partite TCG Live: qui compaiono solo i tornei veri.</p>':recent(realT(ts))}</div>`
      + (F.src==='tour' ? '' : `<div class="panel"><h3>Sessioni TCG Live <span class="meta">partite importate o veloci, raggruppate per giorno</span></h3>${recent(ts.filter(isLive))}</div>`))}`);
  moveTabInd(false);
  drawSub();
}
// compact views: tiles to pick an archetype, then its matchups as simple rows (full stats behind a switch)
const wrPct = a => a.R ? Math.round(a.W/a.R*100) : null;
const wrCls = a => !a.R ? 'muted' : a.W/a.R>=.55 ? 'good' : a.W/a.R<.45 ? 'bad' : '';
function tiles(list){
  const all=F.tilesAll, L=all?list:list.slice(0,12);
  return `<div class="gtiles">${L.map(x=>`<button type="button" class="gtile" data-arch="${esc(x.k)}"><span class="gt-spr">${DL.archSprites?DL.archSprites(x.k):''}</span>
      <span class="gt-n">${esc(x.k)}</span><span class="gt-m">${x.a.R} round · ${x.a.W}-${x.a.L}-${x.a.T}</span>
      <b class="gt-w ${wrCls(x.a)}">${wrPct(x.a)??'—'}${x.a.R?'%':''}</b></button>`).join('')}</div>
    ${list.length>12?`<button type="button" class="btn small" data-tiles style="margin-top:10px">${all?'Mostra meno':`Mostra tutti (${list.length})`}</button>`:''}`;
}
function rows(list, head){
  if(F.full) return `<div class="tbl-wrap"><table class="tbl gtbl stack"><thead><tr><th>${head}</th>${STAT_HEAD}</tr></thead><tbody>${list.map(x=>`<tr${x.tot?' class="tot"':''}><td>${x.tot?x.k:x.pl?`<span class="arch">${av(x.k)}<span class="t">${esc(x.k)}</span></span>`:archN(x.k)}</td>${statCells(x.a)}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="grows">${list.filter(x=>!x.tot).map(x=>`<div class="grow"><span class="gr-n">${x.pl?`<span class="arch">${av(x.k)}<span class="t">${esc(x.k)}</span></span>`:archN(x.k)}</span>
      <span class="gr-r num">${x.a.W}-${x.a.L}-${x.a.T}</span><span class="gr-bar"><i style="width:${wrPct(x.a)||0}%" class="${wrCls(x.a)}"></i></span><b class="gr-w num ${wrCls(x.a)}">${wrPct(x.a)??'—'}${x.a.R?'%':''}</b></div>`).join('')}</div>`;
}
function summary(a, label){
  return `<div class="gsum"><div><span>${label}</span><b class="${wrCls(a)}">${wrPct(a)??'—'}${a.R?'%':''}</b><small>round vinti · ${a.W}-${a.L}-${a.T} in ${a.R} round</small></div>
    <div><span>Game</span><b>${a.gW+a.gL+a.gT?Math.round(a.gW/(a.gW+a.gL+a.gT)*100)+'%':'—'}</b><small>${a.gW}-${a.gL}${a.gT?'-'+a.gT:''}</small></div>
    <div><span>Primo · Secondo</span><b>${a.fN?Math.round(a.fW/a.fN*100)+'%':'—'} · ${a.sN?Math.round(a.sW/a.sN*100)+'%':'—'}</b><small>game vinti</small></div></div>`;
}
function explorer(rs){
  rs = rs.filter(r=>!r.bye && !r.id);   // BYE and ID: no game against a deck, so not a matchup
  const tgl = `<label class="switch inline gfull"><input type="checkbox" data-full${F.full?' checked':''}><span class="track" aria-hidden="true"></span><span>Statistiche complete</span></label>`;
  if(!F.arch){
    const list = F.side==='played' ? groupBy(rs, r=>r.deck) : groupBy(rs, r=>r.opp);
    return list.length ? `<p class="src" style="margin:0 0 10px">${F.side==='played'?'I mazzi giocati dal gruppo':'Gli archetipi che il gruppo incontra di più'}: tocca un archetipo per vedere i suoi matchup.</p>${tiles(list)}`
      : '<p class="src">Nessun round nei filtri scelti. Nel registro tornei segna mazzo e avversario di ogni round.</p>';
  }
  const A = key(F.arch), back = `<div class="gback"><button type="button" class="btn small" data-arch-clear>← Tutti gli archetipi</button>${tgl}</div>`;
  if(F.side==='played'){
    const mine = rs.filter(r=>key(r.deck)===A), tot = agg(mine);
    if(!mine.length) return back+`<p class="src">Nessuno del gruppo ha giocato ${esc(F.arch)} nei filtri scelti.</p>`;
    const vs = groupBy(mine, r=>r.opp||'Avversario non segnato'), by = groupBy(mine, r=>nameOf(r.player));
    return back + summary(tot, `${esc(F.arch)}`) + `<h4 class="gsub">Contro…</h4>${rows([{k:'Totale',a:tot,tot:1},...vs], `${esc(F.arch)} contro…`)}
      <h4 class="gsub">Chi lo gioca</h4>${rows(by.map(x=>({...x,pl:1})),'Giocatore')}`;
  }
  const vsIt = rs.filter(r=>key(r.opp)===A), tot = agg(vsIt);
  if(!vsIt.length) return back+`<p class="src">Nessuno del gruppo ha affrontato ${esc(F.arch)} nei filtri scelti.</p>`;
  const withDeck = groupBy(vsIt, r=>r.deck||'Mazzo non segnato'), by = groupBy(vsIt, r=>nameOf(r.player));
  return back + summary(tot, `Contro ${esc(F.arch)}`) + `<h4 class="gsub">Con quale mazzo</h4>${rows([{k:'Totale del gruppo',a:tot,tot:1},...withDeck], `Contro ${esc(F.arch)} con…`)}
    <h4 class="gsub">Giocatore per giocatore</h4>${rows(by.map(x=>({...x,pl:1})),'Giocatore')}`;
}
function favorite(userId, tournaments){
  const mine = tournaments.filter(t=>t.user_id===userId && (t.deckName||'').trim() && inPeriod(t.date) && (!F.src || (F.src==='live')===isLive(t)));
  if(!mine.length) return null;
  const m = new Map(); mine.forEach(t=>{ const k=t.deckName.trim(); if(!m.has(k)) m.set(k,[]); m.get(k).push(t); });
  const [name, list] = [...m].sort((x,y)=>realT(y[1]).length-realT(x[1]).length || y[1].length-x[1].length || String(y[1][0].date).localeCompare(String(x[1][0].date)))[0];
  const withList = list.filter(t=>Array.isArray(t.list) && t.list.length).sort((x,y)=>String(y.date).localeCompare(String(x.date)))[0];
  return {name, n:realT(list).length, live:liveN(list), a:agg(roundsOf(list).filter(r=>!F.bo || r.bo===F.bo)), list: withList ? withList.list : null, from: withList};
}
function playersTable(members, tournaments){
  const me = App.Store.user.id;
  const rows = members.map(m=>({m, f:favorite(m.id, tournaments), all:tournaments.filter(t=>t.user_id===m.id && inPeriod(t.date) && (!F.src || (F.src==='live')===isLive(t)))})).map(x=>({...x, total:realT(x.all).length, live:liveN(x.all)}));
  return `<div class="tbl-wrap d-only"><table class="tbl gtbl stack"><thead><tr><th>Giocatore</th><th class="n">Tornei</th><th>Mazzo più giocato</th><th class="n">Con quel mazzo</th><th class="n">Vittorie</th><th></th></tr></thead><tbody>${rows.map(({m,f,total,live})=>`<tr${m.id===me?' class="me"':''}>
      <td><span class="arch">${av(m.id)}<span class="t">${esc(m.display_name||'Amico')}${m.id===me?' <span class="badge">tu</span>':''}</span></span>${m.share_stats===false?'<div class="src">non condivide i tornei</div>':''}</td>
      <td class="n">${total}${live?`<div class="src">+ ${live} live</div>`:''}</td><td>${f?archN(f.name):'<span class="src">—</span>'}</td><td class="n">${f?nT(f.n,f.live):'—'}</td>${f?cell(f.a.W,f.a.R,'Round vinti'):'<td class="n muted">—</td>'}
      <td class="n">${f&&f.list?`<button class="btn small" type="button" data-list="${esc(m.id)}">Vedi lista</button>`:f?'<span class="src" title="Nel registro tornei scegli il mazzo salvato usato, così la lista viene condivisa">lista non collegata</span>':''}</td></tr>`).join('')}</tbody></table></div>
    <div class="gpl m-only">${rows.map(({m,f,total,live})=>`<div class="gpl-i${m.id===me?' me':''}">
      <div class="gpl-h"><span class="arch">${av(m.id)}<span class="t"><b>${esc(m.display_name||'Amico')}</b>${m.id===me?' <span class="badge">tu</span>':''}</span></span><span class="src">${total} ${total===1?'torneo':'tornei'}${live?` + ${live} live`:''}</span></div>
      ${m.share_stats===false?'<span class="src">non condivide i tornei</span>':f?`<div class="gpl-d">${archN(f.name)}<span class="gpl-r num">${nT(f.n,f.live)}</span><b class="gr-w num ${f.a.R?(f.a.W/f.a.R>=.55?'good':f.a.W/f.a.R<.45?'bad':''):''}">${f.a.R?Math.round(f.a.W/f.a.R*100)+'%':'—'}</b></div>
        ${f.list?`<button class="btn small" type="button" data-list="${esc(m.id)}">Vedi lista</button>`:'<span class="src">lista non collegata</span>'}`:'<span class="src">nessun torneo nel periodo</span>'}</div>`).join('')}</div>`;
}
function recent(ts){
  const list = ts.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,12);
  // phone: compact rows that open on tap
  const mob = `<div class="gtl m-only">${list.map(t=>{ const r=T.record(t), [y,m,d]=String(t.date).split('-');
    return `<div class="gtl-i"><div class="gtl-h"><span class="gtl-d"><b>${+d}</b>${['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'][+m-1]||''}</span>
        <span class="gtl-n"><b>${esc(t.name)}</b><span class="src">${esc(nameOf(t.user_id))}${t.placement?` · ${esc(t.placement)}°`:''}</span></span><b class="num">${T.recStr(r)}</b><span class="tchev">›</span></div>
      <div class="gtl-x"><span class="src">${esc(t.type||'')}</span>${t.deckName?archN(t.deckName):''}<div class="lv-pills sm">${(t.rounds||[]).map(x=>{ const q=T.roundRes(x); return `<span class="res-pill ${q||'T'}${x.id||x.bye?' id':''}" title="${x.opp?esc(x.opp):''}">${x.bye?'BYE':x.id?'ID':q?({W:'V',L:'S',T:'P'})[q]:'·'}</span>`; }).join('')}</div>
        ${Array.isArray(t.list)&&t.list.length?`<button type="button" class="btn small" data-tlist="${esc(t.id)}">Vedi lista</button>`:''}</div></div>`; }).join('')}</div>`;
  return list.length ? mob+`<div class="tbl-wrap d-only"><table class="tbl gtbl stack"><thead><tr><th>Torneo</th><th>Giocatore</th><th>Mazzo</th><th class="n">Record</th><th class="n">Pos.</th></tr></thead><tbody>${list.map(t=>{ const r=T.record(t);
    return `<tr><td><b style="font-weight:600">${esc(t.name)}</b><div class="src">${esc(t.date)} · ${esc(t.type||'')}</div></td><td class="wide">${esc(nameOf(t.user_id))}</td><td class="wide"><div class="dk">${t.deckName?archN(t.deckName):'—'}${Array.isArray(t.list)&&t.list.length?`<button type="button" class="btn small" data-tlist="${esc(t.id)}">Vedi lista</button>`:''}</div></td><td class="n">${T.recStr(r)}</td><td class="n">${t.placement?esc(t.placement)+'°':'—'}</td></tr>`; }).join('')}</tbody></table></div>`
    : '<p class="src">Nessun torneo nei filtri scelti.</p>';
}

/* ---------- list pop-up ---------- */
function showList(userId, one){
  // one tournament's list (the copy saved with that tournament), or the player's most played deck
  const f = one || favorite(userId, cache.tournaments); if(!f || !f.list) return;
  const cards = f.list.map(k=>DL.BY_KEY.get(k)).filter(Boolean);
  const counts = new Map(); cards.forEach(c=>counts.set(c.key,(counts.get(c.key)||0)+1));
  const rows = [...counts].map(([k,q])=>({c:DL.BY_KEY.get(k), q}));
  const sec = (sup,label) => { const it=rows.filter(x=>x.c.sup===sup).sort((a,b)=>b.q-a.q||a.c.name.localeCompare(b.c.name)); if(!it.length) return '';
    return `<div class="st-sec"><b>${label} <span class="hint num">${it.reduce((a,x)=>a+x.q,0)}</span></b><ul class="dlist">${it.map(({c,q})=>`<li><span class="q">${q}</span><span class="cbar ty-${c.color}"></span><span class="nm">${esc(c.name)}</span><span></span></li>`).join('')}</ul></div>`; };
  const d=$('#dlg2'), body=$('#dlg2Body');
  let gv = App.ls.get('pr.glView','img'); if(!['img','list','png'].includes(gv)) gv='img';
  body.innerHTML = `<div class="dlg-h"><div><h2>${esc(f.name)}</h2><p class="hint" style="margin:2px 0 0">Lista di ${esc(nameOf(userId))} · ${cards.length} carte${f.from?` · usata a ${esc(f.from.name)} (${esc(f.from.date)})`:''}</p></div>
      <button class="xclose" type="button" id="glClose" aria-label="Chiudi la lista">✕</button></div>
    <div class="seg" id="glSeg" role="group" aria-label="Visualizzazione"><button type="button" data-gv="img">Carte</button><button type="button" data-gv="list">Lista</button><button type="button" data-gv="png">Immagine da scaricare</button></div>
    <div class="gimg" id="glImg">${DL.kindGrid(f.list)}</div>
    <div class="glist" id="glList">${sec('P','Pokémon')}${sec('T','Allenatori')}${sec('E','Energie')}</div>
    <div id="glPng"></div>
    <div class="row"><span class="hint">La copia finisce tra i tuoi mazzi: puoi modificarla senza toccare la sua.</span><button class="btn primary" type="button" id="glCopy">Copia nel mio deck builder</button></div>`;
  d.classList.add('sheet'); d.showModal();
  d.addEventListener('close',()=>d.classList.remove('sheet'),{once:true});
  $('#glClose').addEventListener('click',()=>d.close());
  let made=false;
  const setView = v => { gv=v; App.ls.set('pr.glView',v);
    document.querySelectorAll('#glSeg [data-gv]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.gv===v));
    $('#glImg').hidden=v!=='img'; $('#glList').hidden=v!=='list'; $('#glPng').hidden=v!=='png';
    if(v==='png' && !made){ made=true; DL.imagePanel($('#glPng'), f.list, f.name, `${cards.length} carte · lista di ${nameOf(userId)}`); } };
  setView(gv);
  $('#glSeg').addEventListener('click',e=>{ const b=e.target.closest('[data-gv]'); if(b) setView(b.dataset.gv); });
  $('#glCopy').addEventListener('click',()=>{
    const text = rows.map(({c,q})=>`${q} ${c.name} ${DL.artOf(c)[0]} ${DL.artOf(c)[1]}`).join('\n');
    d.close(); DL.importList(text, `${f.name} (di ${nameOf(userId)})`); location.hash='deck';
  });
}

/* ---------- phone layout: one section at a time ---------- */
function moveTabInd(animate){
  const nav=$('#gTabs'); if(!nav) return;
  let ind=nav.querySelector('.ind'); if(!ind){ ind=document.createElement('span'); ind.className='ind'; ind.setAttribute('aria-hidden','true'); nav.prepend(ind); }
  const a=nav.querySelector('[aria-selected="true"]'); if(!a || !a.offsetWidth) return;
  if(!animate) nav.classList.remove('ready');
  ind.style.width=a.offsetWidth+'px'; ind.style.transform=`translateX(${a.offsetLeft}px)`;
  if(!animate) requestAnimationFrame(()=>requestAnimationFrame(()=>nav.classList.add('ready')));
}
// phone: the group's sections live in the bottom bar's sheet (the "Gruppo" item), not in a tab bar at the top
const TAB_L = {over:'Panoramica',match:'Matchup',players:'Giocatori',tours:'Tornei'};
function drawSub(){ const box=document.getElementById('bmoreSub'); if(!box) return;
  box.innerHTML = `<div class="bsub-h">Sezioni del gruppo</div><div class="bsub">${Object.entries(TAB_L).map(([k,l])=>`<button type="button" data-gtab="${k}" aria-pressed="${F.tab===k}">${l}</button>`).join('')}</div>`;
  const lbl=document.querySelector('#bnMore .bn-sub'); if(lbl) lbl.textContent=TAB_L[F.tab]||''; }
document.getElementById('bmoreSub')?.addEventListener('click',e=>{ const b=e.target.closest('[data-gtab]'); if(!b) return; showTab(b.dataset.gtab); App.bmoreOpen && App.bmoreOpen(false); window.scrollTo({top:0,behavior:'smooth'}); });
App.groupTab = k => { if(k) showTab(k); return F.tab; };   // used by the phone wheel menu
function showTab(k){
  F.tab=k; drawSub();
  document.querySelectorAll('#gTabs [data-gtab]').forEach(b=>b.setAttribute('aria-selected', b.dataset.gtab===k));
  document.querySelectorAll('#gBody .gsec').forEach(sct=>sct.classList.toggle('on', sct.dataset.gsec===k));
  moveTabInd(true);
  const top=$('#gTabs'); if(top && top.getBoundingClientRect().top < 0) top.scrollIntoView({block:'start', behavior:'smooth'});
}
window.addEventListener('resize',()=>moveTabInd(false));

/* ---------- events ---------- */
$('#pg-gruppo').addEventListener('click',e=>{
  const gh=e.target.closest('.gtl-h'); if(gh){ gh.parentNode.classList.toggle('open'); return; }
  if(e.target.closest('[data-acct]')){ App.accountDialog(); return; }
  const tb=e.target.closest('[data-gtab]'); if(tb){ showTab(tb.dataset.gtab); return; }
  const fb=e.target.closest('[data-gfilters]'); if(fb){ F.fopen=!F.fopen; fb.setAttribute('aria-expanded',F.fopen); $('#gBody .gfilters').classList.toggle('open',F.fopen); return; }
  const sd=e.target.closest('[data-side]'); if(sd){ F.side=sd.dataset.side; render(); return; }
  if(e.target.closest('[data-tiles]')){ F.tilesAll=!F.tilesAll; render(); return; }
  if(e.target.closest('[data-arch-clear]')){ F.arch=''; render(); $('#gExplorer').scrollIntoView({behavior:'smooth',block:'start'}); return; }
  const gt=e.target.closest('.gtile[data-arch]'); if(gt){ F.arch=gt.dataset.arch; render(); $('#gExplorer').scrollIntoView({behavior:'smooth',block:'start'}); return; }
  const pk=e.target.closest('tr.pick[data-arch]'); if(pk){ F.arch=pk.dataset.arch; render(); $('#gExplorer').scrollIntoView({behavior:'smooth',block:'start'}); return; }
  const ls=e.target.closest('[data-list]'); if(ls){ showList(ls.dataset.list); return; }
  const lt=e.target.closest('[data-tlist]'); if(lt){ const t=cache.tournaments.find(x=>x.id===lt.dataset.tlist); if(t) showList(t.user_id, {name:t.deckName||'Mazzo', list:t.list, from:t}); return; }
});
$('#pg-gruppo').addEventListener('change',e=>{ if(e.target.matches('[data-full]')){ F.full=e.target.checked; render(); return; } const s=e.target.closest('[data-f]'); if(!s) return; F[s.dataset.f]=s.value; render(); });
$('#gProfile').addEventListener('click',()=>App.accountDialog());
App.on(w=>{ if(w==='group'){ cache=null; load(); } if(w==='data' && App.page==='gruppo'){ load(); } if(w==='page' && App.page==='gruppo') load(); });
App.groupSummary = async () => { if(!cache && App.Store.profile && App.Store.profile.group_code){ try{ cache = await App.Store.group(); }catch(e){} } return cache; };
})();
