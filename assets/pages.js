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
const archIcon = name => { const h=DL.archSprites ? DL.archSprites(name) : ''; return h ? `<span class="dsp">${h}</span>` : avatar(name); };
const archLink = (name, url) => `<span class="arch">${archIcon(name)}${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(name)}</a>`:`<span class="t">${esc(name)}</span>`}</span>`;
const metaUrl = name => { const m = META.find(x=>x.name.toLowerCase()===String(name).toLowerCase()); return m ? m.url : ''; };

/* ---------- META ---------- */
const RECO_M = J('recoData');
// archetype sprites: the Limitless icons (the same pixel art Limitless and Trainer Hill show); a lettered dot if one is missing
const sprites = (icons, name) => (icons&&icons.length) ? `<span class="sprs" title="${esc(name)}">${icons.slice(0,2).map(ic=>`<img src="https://r2.limitlesstcg.net/pokemon/gen9/${esc(ic)}.png" alt="" loading="lazy" onerror="this.remove()">`).join('')}</span>` : avatar(name);
const archS = (name, icons, url) => `<span class="arch">${sprites(icons,name)}${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${esc(name)}</a>`:`<span class="t">${esc(name)}</span>`}</span>`;
const iconKey = icons => (icons||[]).slice().sort().join('+');
const ONLINE = new Map((RECO_M.archetypes||[]).map(a=>[iconKey(a.icons), a]));
function usageTrend(icons){
  const a=ONLINE.get(iconKey(icons)); if(!a || a.sharePrev==null || a.players<30) return '';
  const d=a.share7-a.sharePrev, t=`Tornei online: ${pct(a.sharePrev,1)} → ${pct(a.share7,1)}`;
  if(Math.abs(d) < .005) return `<span class="utr flat" title="${t}">–</span>`;
  return `<span class="utr ${d>0?'up':'down'}" title="${t}">${d>0?'↗':'↘'}</span>`;
}
let metaAll = false, regPick = 'all', trendPick = null;
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
    <td class="n rank"><span class="rk">${usageTrend(m.icons)}${m.rank}</span></td><td>${archS(m.name,m.icons,m.url)}</td>
    <td><div style="display:flex;align-items:center;gap:8px"><div class="bar" style="flex:1"><b style="width:${m.share/mx*100}%"></b></div><span class="num" style="font-size:12px;min-width:48px;text-align:right">${pct(m.share/100,2)}</span></div></td>
    <td class="n">${m.points.toLocaleString('it-IT')}</td></tr>`).join('')}</tbody>`;
  $('#metaMore').textContent = metaAll ? 'Mostra i primi 15' : `Mostra tutti (${META.length})`;
  // phone: compact rows (rank and trend, sprites and name, share bar)
  $('#metaRowsM').innerHTML = rows.map(m=>`<a class="mrow" href="${esc(m.url)}" target="_blank" rel="noopener"><span class="mr-k num">${usageTrend(m.icons)}${m.rank}</span>
      <span class="mr-n">${archS(m.name,m.icons,'')}</span><span class="mr-s num">${pct(m.share/100,1)}</span><span class="mr-bar"><i style="width:${m.share/mx*100}%"></i></span></a>`).join('');
  renderRegional(); renderTrends();
}
/* one Regional at a time (or all of them together) */
function renderRegional(){
  const sel=$('#regSel');
  sel.innerHTML = `<option value="all">Tutti gli ultimi ${TOURS.length} (top 8 sommate)</option>` + TOURS.map((t,i)=>`<option value="${i}">${esc(t.name)} · ${fmtDate(t.date)}</option>`).join('');
  sel.value = regPick;
  const summary = list => { const m=new Map(); list.forEach(p=>{ const c=m.get(p.deck)||{deck:p.deck,icons:p.icons,n:0,wins:0}; c.n++; if(p.rank===1) c.wins++; m.set(p.deck,c); });
    return [...m.values()].sort((a,b)=>b.n-a.n||b.wins-a.wins||a.deck.localeCompare(b.deck)); };
  if(regPick==='all'){
    const all=TOURS.flatMap(t=>t.top), cl=summary(all);
    $('#regMeta').textContent = `${TOURS.length} tornei · ${all.length} posti`;
    $('#regBody').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Variante</th><th class="n">Top 8</th><th class="n">Vittorie</th></tr></thead><tbody>${cl.slice(0,14).map(c=>`<tr><td>${archS(c.deck,c.icons,'')}</td><td class="n">${c.n}</td><td class="n">${c.wins||'—'}</td></tr>`).join('')}</tbody></table></div>
      <p class="src" style="margin-top:8px">Nomi delle varianti come li riporta Limitless nelle classifiche. Scegli un torneo qui sopra per vederne la top 8.</p>`;
    return;
  }
  const t=TOURS[+regPick]; if(!t){ regPick='all'; return renderRegional(); }
  $('#regMeta').textContent = `${t.country} · ${t.players.toLocaleString('it-IT')} giocatori`;
  $('#regBody').innerHTML = `<div class="reg-chips">${summary(t.top).map(c=>`<span class="chip">${sprites(c.icons,c.deck)}${esc(c.deck)} <b>×${c.n}</b></span>`).join('')}</div>
    <ol class="reg-top">${t.top.map(p=>`<li class="${p.rank===1?'win':''}"><span class="rank">${p.rank}</span>${archS(p.deck,p.icons,'')}<span class="p">${esc(p.player)}</span></li>`).join('')}</ol>
    <a class="link" href="${esc(t.url)}" target="_blank" rel="noopener" style="font-size:13px">Classifica completa su Limitless ↗</a>`;
}
App.metaTab = k => { const pg=$('#pg-meta'); if(k){ pg.dataset.mtab=k; window.scrollTo({top:0}); } return pg.dataset.mtab; };
$('#regSel').addEventListener('change',e=>{ regPick=e.target.value; renderRegional(); });
/* card trends inside each deck (online lists, this week against the week before) */
function renderTrends(){
  const list=(RECO_M.archetypes||[]).filter(a=>a.cards && (a.cards.up.length||a.cards.down.length)).sort((a,b)=>b.share7-a.share7);
  if(!list.length){ $('#trendPanel').hidden=true; return; }
  $('#trendPanel').hidden=false;
  if(!trendPick || !list.some(a=>a.id===trendPick)) trendPick=list[0].id;
  $('#trendMeta').textContent = 'quanto spesso una carta è nelle liste, questa settimana contro la precedente · tornei online';
  const a=list.find(x=>x.id===trendPick);
  const delta = x => x.sharePrev==null ? '' : (d => Math.abs(d)<.005 ? '<span class="utr flat">–</span>' : `<span class="utr ${d>0?'up':'down'}">${d>0?'↗':'↘'}</span>`)(x.share7-x.sharePrev);
  $('#trendDrop').innerHTML = `<button type="button" class="adrop-btn" aria-haspopup="listbox" aria-expanded="false">${sprites(a.icons,a.name)}<span class="nm">${esc(a.name)}</span><span class="sh">${pct(a.share7,1)} del meta</span></button>
    <div class="adrop-menu" hidden><input type="search" class="adrop-q" placeholder="Cerca un archetipo…" aria-label="Cerca un archetipo">
      <ul role="listbox" aria-label="Archetipo">${list.map(x=>`<li role="option" tabindex="-1" data-tp="${esc(x.id)}" data-q="${esc(x.name.toLowerCase())}" aria-selected="${x.id===trendPick}">${sprites(x.icons,x.name)}<span class="nm">${esc(x.name)}</span>${delta(x)}<span class="sh">${pct(x.share7,1)}</span></li>`).join('')}</ul>
      <p class="adrop-none src" hidden>Nessun archetipo trovato.</p></div>`;
  const c=a.cards, d=a.sharePrev==null?null:a.share7-a.sharePrev;
  const tile = r => { const card=DL.BY_KEY.get(r.set+'-'+r.num) || DL.byName(r.name);
    const face = card ? DL.cardFace(card,'',{inner:`<span class="tc-d ${r.delta>0?'up':'down'}">${r.delta>0?'↑ +':'↓ −'}${Math.round(Math.abs(r.delta)*100)}%</span>`}) : `<div class="card tc-miss"><span>${esc(r.name)}</span></div>`;
    return `<div class="tc" title="${esc(r.name)}: ${pct(r.prev,0)} → ${pct(r.now,0)} delle liste${r.avg?` · ${String(r.avg).replace('.',',')} copie in media`:''}">${face}
      <div class="tc-n"><span>${esc(r.name)}</span><small>${pct(r.now,0)} delle liste</small></div></div>`; };
  const group = (label, rows, cls) => rows.length ? `<div class="tc-grp"><h4 class="${cls}">${label}</h4><div class="tc-grid">${rows.map(tile).join('')}</div></div>` : '';
  $('#trendBody').innerHTML = `<div class="tc-head"><a class="link" href="${esc(a.url)}" target="_blank" rel="noopener">Liste su Limitless ↗</a>
      ${d==null?'':`<span class="tc-share">utilizzo ${pct(a.sharePrev,1)} → ${pct(a.share7,1)} ${Math.abs(d)<.0005?'<b class="src">stabile</b>':`<b class="${d>=0?'good':'bad'}">${d>=0?'↑ +':'↓ −'}${(Math.abs(d)*100).toLocaleString('it-IT',{maximumFractionDigits:1})}</b>`}</span>`}
      <span class="src">${c.lists} liste questa settimana, ${c.listsPrev} la precedente</span></div>
    <div class="tc-cols">${group('In crescita', c.up, 'up')}${group('In calo', c.down, 'down')}</div>`;
}
/* archetype picker: a dropdown with sprites, usage and a search box */
const dropEl = () => $('#trendDrop');
function dropOpen(open){ const d=dropEl(), m=d.querySelector('.adrop-menu'), b=d.querySelector('.adrop-btn'); if(!m) return;
  m.hidden=!open; b.setAttribute('aria-expanded',open); d.classList.toggle('open',open);
  if(open){ const q=m.querySelector('.adrop-q'); q.value=''; m.querySelectorAll('li').forEach(li=>li.hidden=false); m.querySelector('.adrop-none').hidden=true;
    const sel=m.querySelector('[aria-selected="true"]'); if(sel) sel.scrollIntoView({block:'nearest'}); if(matchMedia('(hover:hover)').matches) q.focus(); } }
$('#trendDrop').addEventListener('click',e=>{
  if(e.target.closest('.adrop-btn')){ dropOpen(dropEl().querySelector('.adrop-menu').hidden); return; }
  const li=e.target.closest('[data-tp]'); if(li){ trendPick=li.dataset.tp; dropOpen(false); renderTrends(); dropEl().querySelector('.adrop-btn').focus(); }
});
$('#trendDrop').addEventListener('input',e=>{ if(!e.target.classList.contains('adrop-q')) return; const q=e.target.value.trim().toLowerCase(); let n=0;
  dropEl().querySelectorAll('li').forEach(li=>{ const ok=!q||li.dataset.q.includes(q); li.hidden=!ok; if(ok) n++; }); dropEl().querySelector('.adrop-none').hidden=!!n; });
$('#trendDrop').addEventListener('keydown',e=>{
  const m=dropEl().querySelector('.adrop-menu'); if(!m) return;
  if(e.key==='Escape' && !m.hidden){ dropOpen(false); dropEl().querySelector('.adrop-btn').focus(); e.preventDefault(); return; }
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){ if(m.hidden){ dropOpen(true); e.preventDefault(); return; }
    const items=[...m.querySelectorAll('li:not([hidden])')], i=items.indexOf(document.activeElement);
    const nx=items[e.key==='ArrowDown' ? Math.min(items.length-1,i+1) : Math.max(0,i-1)]; if(nx){ nx.focus(); e.preventDefault(); } }
  if(e.key==='Enter'){ const li=document.activeElement.closest&&document.activeElement.closest('li[data-tp]') || (document.activeElement.classList.contains('adrop-q') && m.querySelector('li:not([hidden])'));
    if(li){ e.preventDefault(); li.click(); } }
});
document.addEventListener('click',e=>{ if(!e.target.closest('#trendDrop')) dropOpen(false); });
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
    <h4>${esc(n.title)}</h4><p>${esc(n.summary)}</p><span class="go">Leggi su ${esc(n.source)} ↗</span><span class="nchev" aria-hidden="true">›</span></a>`).join('');
}
$('#newsChips').addEventListener('click',e=>{ const b=e.target.closest('[data-cat]'); if(!b) return; newsCat=b.dataset.cat; renderNews(); });
// phone: a news item opens on the first tap (summary and link), the link then goes to the article
$('#newsGrid').addEventListener('click',e=>{ if(!matchMedia('(max-width:760px)').matches) return; const n=e.target.closest('.news'); if(!n) return;
  if(n.classList.contains('open') && e.target.closest('.go')) return;
  e.preventDefault(); const was=n.classList.contains('open'); document.querySelectorAll('#newsGrid .news.open').forEach(x=>x.classList.remove('open')); if(!was) n.classList.add('open'); });

/* ---------- TOURNAMENTS ---------- */
const TYPES = ['League Challenge','League Cup','Regional','Special Event','International','Mondiali','Torneo online','TCG Live','Torneo locale / amichevole'];
function record(t){
  if(t.rounds && t.rounds.length){ const r={W:0,L:0,T:0}; t.rounds.forEach(x=>{ const k=roundRes(x); if(k) r[k]++; }); return r; }
  const m=t.manual||{}; return {W:+m.W||0,L:+m.L||0,T:+m.T||0};
}
const games = r => r.W+r.L+r.T;
const wr = r => games(r) ? r.W/games(r) : 0;
const recStr = r => `${r.W}-${r.L}-${r.T}`;
const GL = {W:'V',L:'S',T:'P'};
const resL = x => x.bye ? 'BYE' : x.id ? 'ID' : GL[roundRes(x)||'T'];
const BIG_EVENTS = ['League Cup','Regional','Special Event','International','Mondiali'];
// TCG Live sessions (imported logs, quick matches) are games on the simulator: their results count, but they are not tournaments
const isLiveT = t => t.type==='TCG Live';
const tCount = (n,live) => `${n}${live?`<small class="lv">+ ${live} live</small>`:''}`;
function roundRes(x){ if(x.bye) return 'W'; if(x.id) return 'T';   // BYE: a win with no opponent   // ID: intentional draw, counts as a tie with no games
  const g=(x.games||[]).filter(y=>y&&y.res); if(!g.length) return x.r||null; const w=g.filter(y=>y.res==='W').length, l=g.filter(y=>y.res==='L').length; return w>l?'W':l>w?'L':'T'; }
function normRound(x){ const bo=x.bo==='bo3'?'bo3':'bo1', n=bo==='bo3'?3:1;
  const games=(x.games&&x.games.length?x.games:(x.r?[{first:null,res:x.r}]:[])).slice(0,n).map(g=>({first:g.first||null,res:g.res||null}));
  while(games.length<n) games.push({first:null,res:null}); return {opp:x.opp||'', bo, games, note:x.note||'', src:x.src, h:x.h, id:!!x.id, bye:!!x.bye}; }
// top cut: t.cut = 'none' | 'missed' | 'made'; when made, t.cutSize (4..64) and t.cutFrom (first round of the cut, 1-based)
const cutOf = t => t.cut || (t.topcut ? 'made' : 'none');
const cutLabel = t => t.cutSize ? 'Top '+t.cutSize : 'Top cut';
const cutSep = (t,i) => cutOf(t)==='made' && +t.cutFrom===i+1 && i>0 ? `<span class="cut-sep" title="Da qui inizia il top cut">${esc(cutLabel(t))}</span>` : '';
function matchList(t){
  return `<ul class="mlist">${t.rounds.map((x,i)=>{ const rr=roundRes(x)||'T', g=(x.games||[]).find(y=>y&&y.first), gt=x.bo==='bo3'?gameText(x):'';
    return `${cutSep(t,i)?`<li class="cut-li">${cutSep(t,i)}</li>`:''}<li><span class="res-pill ${rr}${x.id||x.bye?' id':''}">${resL(x)}</span><span class="mv">${t.type==='TCG Live'?'':'R'+(i+1)+' · '}${x.bye?'<b>BYE</b>':`vs <b>${esc(x.opp||'avversario non segnato')}</b>`}${g&&x.bo!=='bo3'?` <span class="src">· ${g.first==='F'?'per primo':'per secondo'}</span>`:''}${gt?` <span class="src">· ${esc(gt)}</span>`:''}</span>${x.note?`<span class="mnote">${esc(x.note)}</span>`:''}</li>`; }).join('')}</ul>`;
}
function gameText(x){ return (x.games||[]).map((g,j)=>g.res?`G${j+1} ${GL[g.res]}${g.first?(g.first==='F'?' da primo':' da secondo'):''}`:'').filter(Boolean).join(', '); }
function tFiltered(){
  const deck = $('#tFilter').value, per = $('#tPeriod').value, now = new Date();
  return App.data.tournaments.filter(t=>{
    if(t.ongoing) return false;   // live tournament: shown in its own box until closed
    if(deck && t.deckName!==deck) return false;
    if(per==='season' && t.date < '2026-09-01') return false;
    if(per && per!=='season' && (now - new Date(t.date))/864e5 > +per) return false;
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date) || (b.created||0)-(a.created||0));
}
function stats(list){
  const tot={W:0,L:0,T:0}; list.forEach(t=>{ const r=record(t); tot.W+=r.W; tot.L+=r.L; tot.T+=r.T; });
  const byDeck=new Map(), byOpp=new Map(), g={W:0,L:0,T:0}, first={W:0,L:0,T:0}, second={W:0,L:0,T:0};
  list.forEach(t=>{ const r=record(t), d=byDeck.get(t.deckName)||{name:t.deckName,n:0,live:0,W:0,L:0,T:0,best:null}; if(isLiveT(t)) d.live++; else d.n++; d.W+=r.W; d.L+=r.L; d.T+=r.T; if(t.placement && (!d.best||+t.placement<d.best)) d.best=+t.placement; byDeck.set(t.deckName,d);
    (t.rounds||[]).forEach(x=>{ if(x.bye || x.id) return;   // BYE and ID: no game against a deck, so not a matchup
      const k=(x.opp||'Sconosciuto').trim()||'Sconosciuto', o=byOpp.get(k)||{name:k,W:0,L:0,T:0,gW:0,gL:0,gT:0}, rr=roundRes(x); if(rr) o[rr]++;
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
    <div><span>Tornei</span><b>${list.filter(t=>!isLiveT(t)).length}</b><small>${s.cuts} top cut${list.some(isLiveT)?` · + ${list.filter(isLiveT).length} ${list.filter(isLiveT).length===1?'sessione':'sessioni'} TCG Live`:''}</small></div>
    <div><span>Record</span><b class="num" style="font-family:var(--display)">${recStr(s.tot)}</b><small>${games(s.tot)} partite</small></div>
    <div><span>Vittorie</span><b>${games(s.tot)?pct(wr(s.tot)):'—'}</b><small>pareggi contati come non vinte</small></div>
    <div><span>Partite singole (game)</span><b class="num" style="font-family:var(--display)">${recStr(s.g)}</b><small>${games(s.g)?pct(wr(s.g),0)+' vinte':'segna i game nei round'}</small></div>
    <div><span>Andando primo</span><b>${games(s.first)?pct(wr(s.first),0):'—'}</b><small>${games(s.first)?recStr(s.first)+' in '+games(s.first)+' game':'nessun dato'}</small></div>
    <div><span>Andando secondo</span><b>${games(s.second)?pct(wr(s.second),0):'—'}</b><small>${games(s.second)?recStr(s.second)+' in '+games(s.second)+' game':'nessun dato'}</small></div>
    <div><span>Miglior piazzamento</span><b>${s.best?esc(s.best.placement)+'°':'—'}</b><small>${s.best?esc(s.best.name):'registra la posizione finale'}</small></div>`;
  // phone: one summary card instead of seven tiles, compact rows instead of tables
  const real=list.filter(t=>!isLiveT(t)).length, lv=list.length-real, p0=games(s.tot)?wr(s.tot):null;
  $('#tSum').innerHTML = `<div class="ts-top"><div><span class="src">Record</span><b class="ts-rec num">${recStr(s.tot)}</b></div>
      <div class="ts-wr ${p0==null?'':p0>=.55?'good':p0<.45?'bad':''}"><b>${p0==null?'—':pct(p0,0)}</b><span class="src">vittorie</span></div></div>
    <div class="ts-strip">
      <div><span>Tornei</span><b>${real}</b>${lv?`<small>+ ${lv} live</small>`:''}</div>
      <div><span>Game</span><b class="num">${recStr(s.g)}</b></div>
      <div><span>Da primo</span><b>${games(s.first)?pct(wr(s.first),0):'—'}</b></div>
      <div><span>Da secondo</span><b>${games(s.second)?pct(wr(s.second),0):'—'}</b></div>
      <div><span>Top cut</span><b>${s.cuts}</b></div>
      <div><span>Migliore</span><b>${s.best?esc(s.best.placement)+'°':'—'}</b></div></div>`;
  const nf=[$('#tFilter').value,$('#tPeriod').value].filter(Boolean).length; $('#tFiltN').hidden=!nf; $('#tFiltN').textContent=nf;
  const mrow = (name, r, extra) => { const n=games(r), p=n?wr(r):null, cls=p==null?'':p>=.55?'good':p<.45?'bad':'';
    return `<div class="grow"><span class="gr-n">${archLink(name||'—','')}${extra?`<small class="src">${extra}</small>`:''}</span><span class="gr-r num">${recStr(r)}</span><span class="gr-bar"><i class="${cls}" style="width:${p==null?0:Math.round(p*100)}%"></i></span><b class="gr-w num ${cls}">${p==null?'—':pct(p,0)}</b></div>`; };
  $('#tDecksM').innerHTML = s.byDeck.length ? s.byDeck.map(d=>mrow(d.name, d, `${d.n} ${d.n===1?'torneo':'tornei'}${d.live?` + ${d.live} live`:''}${d.best?` · migliore ${d.best}°`:''}`)).join('') : '<p class="src">Nessun torneo nel filtro scelto.</p>';
  $('#tMatchM').innerHTML = s.byOpp.length ? s.byOpp.map(o=>mrow(o.name, o, o.gW+o.gL+o.gT?`game ${o.gW}-${o.gL}${o.gT?'-'+o.gT:''}`:'')).join('') : '<p class="src">Registra i round con l’archetipo avversario per vedere i matchup.</p>';
  if(App.renderLiveBox) App.renderLiveBox();
  if(!App.data.tournaments.length){
    const empty = `<div class="empty-state"><b>Nessun torneo registrato</b>Premi “Nuovo torneo” per aggiungere il primo: mazzo, round e risultato.</div>`;
    $('#tLast').innerHTML = empty; $('#tLastMeta').textContent=''; $('#tDecks').innerHTML=''; $('#tMatch').innerHTML=''; $('#tList').innerHTML = '';
    return;
  }
  // the latest results, compact; the full history is further down
  const LAST=6, last=list.slice(0,LAST);
  $('#tLastMeta').textContent = list.length>LAST ? `${LAST} di ${list.length}` : '';
  $('#tLast').innerHTML = last.length ? `<ul class="tlast">${last.map(t=>{ const r=record(t), p=wr(r), n=games(r), [y,m,d]=t.date.split('-');
      return `<li><button type="button" data-goto-t="${esc(t.id)}" title="Apri nello storico">
        <span class="tl-d"><b>${+d}</b>${MONTHS[+m-1]}</span>
        <span class="tl-m"><span class="tl-n">${esc(t.name)}</span><span class="tl-s">${archIcon(t.deckName||'—')}<span>${esc(t.deckName||'—')}</span>${t.placement?` · ${esc(t.placement)}°`:''}</span></span>
        <span class="tl-r ${!n?'':p>=.55?'good':p<.45?'bad':''}"><b class="num">${recStr(r)}</b><small>${n?pct(p,0):'—'}</small></span></button></li>`; }).join('')}</ul>
      <button type="button" class="btn small tl-all" id="tToList">Vai allo storico completo${list.length>LAST?` (${list.length})`:''} ↓</button>`
    : '<p class="src">Nessun torneo nel filtro scelto.</p>';
  $('#tDecks').innerHTML = s.byDeck.length ? `<thead><tr><th>Mazzo</th><th class="n">Tornei</th><th class="n">Record</th><th class="n">Vittorie</th><th class="n">Top</th></tr></thead><tbody>${s.byDeck.map(d=>`<tr><td>${archLink(d.name||'—',metaUrl(d.name))}</td><td class="n">${tCount(d.n,d.live)}</td><td class="n">${recStr(d)}</td>${wrCell(d)}<td class="n">${d.best?d.best+'°':'—'}</td></tr>`).join('')}</tbody>` : '';
  $('#tMatch').innerHTML = s.byOpp.length ? `<thead><tr><th>Avversario</th><th class="n">Round</th><th class="n">Record</th><th class="n">Vittorie</th><th class="n">Game</th></tr></thead><tbody>${s.byOpp.map(o=>`<tr><td>${archLink(o.name,metaUrl(o.name))}</td><td class="n">${games(o)}</td><td class="n">${recStr(o)}</td>${wrCell(o)}<td class="n">${o.gW+o.gL+o.gT?o.gW+'-'+o.gL+'-'+o.gT:'—'}</td></tr>`).join('')}</tbody>`
    : '<tbody><tr><td class="src">Registra i round con l\'archetipo avversario per vedere i matchup.</td></tr></tbody>';
  $('#tList').innerHTML = list.map(t=>{ const r=record(t), [y,m,d]=t.date.split('-');
    return `<div class="trow" data-tid="${esc(t.id)}"><div class="date"><b>${+d}</b>${MONTHS[+m-1]} ${y.slice(2)}</div>
      <div style="min-width:0"><h4>${esc(t.name)}</h4><div class="sub"><span class="badge">${esc(t.type)}</span>${archLink(t.deckName||'—','')}${t.placement?`<span>${esc(t.placement)}°${t.players?' su '+esc(t.players):''}</span>`:''}${cutOf(t)==='made'?`<span class="badge w">${esc(cutLabel(t))}</span>`:''}</div>
        ${t.rounds&&t.rounds.length ? (t.type==='TCG Live' || t.rounds.some(x=>x.note) ? matchList(t) : `<div class="sub" style="margin-top:6px;gap:3px">${t.rounds.map((x,i)=>{ const rr=roundRes(x)||'T', gt=gameText(x); return `${cutSep(t,i)}<span class="res-pill ${rr}${x.id||x.bye?' id':''}" title="Round ${i+1}${x.bo==='bo3'?' (Bo3)':''} contro ${esc(x.opp||'?')}: ${x.bye?'BYE (vittoria senza avversario)':x.id?'ID (pareggio concordato)':GL[rr]}${gt?' · '+esc(gt):''}">${resL(x)}</span>`; }).join('')}</div>`) : ''}
        ${t.notes?`<div class="sub tnote" style="margin-top:4px">${esc(t.notes)}</div>`:''}</div><span class="tchev" aria-hidden="true">›</span>
      <div class="recbox"><div class="rec num">${recStr(r)}<small>${games(r)?pct(wr(r),0)+' vittorie':'nessuna partita'}</small></div>
        <div class="ops"><button class="btn small" type="button" data-edit="${esc(t.id)}">Modifica</button><button class="btn small" type="button" data-del="${esc(t.id)}">Elimina</button></div></div></div>`; }).join('') || '<p class="src">Nessun torneo nel filtro scelto.</p>';
}
['#tFilter','#tPeriod'].forEach(s=>$(s).addEventListener('change',renderTornei));
// phone: one section at a time (chosen from the wheel), filters behind a button, history rows that open on tap
App.tornTab = k => { const pg=$('#pg-tornei'); if(k){ pg.dataset.ttab=k; window.scrollTo({top:0}); } return pg.dataset.ttab; };
$('#tFiltBtn').addEventListener('click',e=>{ const on=!$('#pg-tornei').classList.contains('fopen'); $('#pg-tornei').classList.toggle('fopen',on); e.currentTarget.setAttribute('aria-expanded',on); });
$('#tList').addEventListener('click',e=>{ if(!matchMedia('(max-width:760px)').matches || e.target.closest('button,a')) return; const r=e.target.closest('.trow'); if(r) r.classList.toggle('open'); },true);
// "Ultimi risultati": jump to the history, or to one tournament in it (briefly highlighted)
$('#tLast').addEventListener('click',e=>{
  if(e.target.closest('#tToList')){ $('#tStorico').scrollIntoView({behavior:'smooth',block:'start'}); return; }
  const b=e.target.closest('[data-goto-t]'); if(!b) return;
  const row=document.querySelector(`#tList .trow[data-tid="${CSS.escape(b.dataset.gotoT)}"]`); if(!row) return;
  row.scrollIntoView({behavior:'smooth',block:'center'}); row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
});
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
  let cut = cutOf(t);
  const prevDeck = t.deckId||'', hadList = Array.isArray(t.list) && t.list.length>0;
  const decks = App.data.decks.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const archNames = [...new Set([...META.map(m=>m.name), ...App.data.tournaments.flatMap(x=>(x.rounds||[]).map(r=>r.opp)).filter(Boolean)])];
  body2.innerHTML = `<h2>${isNew?'Nuovo torneo':'Modifica torneo'}</h2>
    <div class="form">
      <label class="full">Nome dell'evento<input id="fName" required placeholder="es. League Cup Milano" value="${esc(t.name)}"></label>
      <label>Data<input id="fDate" type="date" value="${esc(t.date)}"></label>
      <label>Tipo<select id="fType">${TYPES.map(x=>`<option ${x===t.type?'selected':''}>${esc(x)}</option>`).join('')}</select></label>
      <label>Mazzo salvato<select id="fDeck"><option value="">— Nessuno / scrivo l'archetipo —</option>${decks.map(d=>`<option value="${esc(d.id)}" ${d.id===t.deckId?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label>
      ${hadList && t.deckId ? `<label class="switch inline full" for="fRelist"><input type="checkbox" id="fRelist" role="switch"><span class="track" aria-hidden="true"></span><span>Aggiorna la lista con la versione attuale del mazzo <small class="src">(ora è quella salvata${t.listDate?' il '+fmtDate(t.listDate):''} con il torneo)</small></span></label>` : ''}
      <label>Archetipo giocato<input id="fArch" list="archList" placeholder="es. Dragapult ex" value="${esc(t.deckName)}"></label>
      <label>Posizione finale<input id="fPlace" type="number" min="1" placeholder="es. 5" value="${esc(t.placement)}"></label>
      <label class="full">Formato dei round<span class="seg" id="fBo"><button type="button" data-tbo="bo1" aria-pressed="${t.bo==='bo1'}">Bo1 · partita secca</button><button type="button" data-tbo="bo3" aria-pressed="${t.bo==='bo3'}">Bo3 · al meglio di tre</button></span><small class="src">Vale per i nuovi round; ogni round si può cambiare.</small></label>
      <label>Giocatori<input id="fPlayers" type="number" min="2" placeholder="es. 64" value="${esc(t.players)}"></label>
      <label class="full">Top cut<span class="seg" id="fCutSeg">${[['none','Non c’era'],['missed','C’era, non passato'],['made','Passato']].map(([k,l])=>`<button type="button" data-cut="${k}" aria-pressed="${cut===k}">${l}</button>`).join('')}</span></label>
      <div class="full cut-more" id="fCutMore"${cut==='made'?'':' hidden'}>
        <label>Taglio<select id="fCutSize"><option value="">—</option>${[4,8,16,32,64].map(n=>`<option value="${n}" ${+t.cutSize===n?'selected':''}>Top ${n}</option>`).join('')}</select></label>
        <label id="fCutFromL">Primo round del top cut<select id="fCutFrom"></select></label></div>
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
        <div class="rh"><span class="n">R${i+1}</span><input list="archList" data-opp="${i}" ${x.bye?'disabled ':''}placeholder="${x.bye?'Nessun avversario (BYE)':'Archetipo avversario'}" value="${esc(x.opp)}" aria-label="Avversario round ${i+1}">
          <span class="seg">${['bo1','bo3'].map(b=>`<button type="button" data-bo="${i}:${b}" aria-pressed="${!x.id&&!x.bye&&x.bo===b}">${b==='bo1'?'Bo1':'Bo3'}</button>`).join('')}<button type="button" data-rid="${i}" aria-pressed="${!!x.id}" title="Pareggio concordato (Intentional Draw)">ID</button><button type="button" data-rbye="${i}" aria-pressed="${!!x.bye}" title="Turno senza avversario: vale come vittoria">BYE</button></span>
          <button type="button" class="xbtn" data-rmr="${i}" aria-label="Togli round ${i+1}">✕</button></div>
        ${x.bye ? '<div class="rres">Turno senza avversario: conta come vittoria, senza game giocati. Risultato del round: <span class="res-pill W id">BYE</span></div>' : x.id ? '<div class="rres">Pareggio concordato: conta come pareggio, senza game giocati. Risultato del round: <span class="res-pill T id">ID</span></div>' : x.games.map((g,j)=>`<div class="gm"><span class="n">${x.bo==='bo3'?'Game '+(j+1):'Partita'}</span>
          <span class="seg">${[['F','Primo'],['S','Secondo']].map(([k,l])=>`<button type="button" data-first="${i}:${j}:${k}" aria-pressed="${g.first===k}">${l}</button>`).join('')}</span>
          <span class="wlt">${['W','L','T'].map(k=>`<button type="button" class="${k}" data-g="${i}:${j}:${k}" aria-pressed="${g.res===k}" title="${{W:'Vinta',L:'Persa',T:'Pareggio'}[k]}">${GL[k]}</button>`).join('')}</span></div>`).join('')}
        ${x.id||x.bye?'':`<div class="rres">${x.bo==='bo3'?'Segna solo i game giocati.':''} Risultato del round: ${rr?`<span class="res-pill ${rr}">${GL[rr]}</span>`:'<span class="src">da segnare</span>'}</div>`}
        <input class="rnote" data-note="${i}" maxlength="300" placeholder="Nota sul round (facoltativa)" value="${esc(x.note||'')}" aria-label="Nota round ${i+1}"></div>`; }).join('')}</div>
      <button type="button" class="btn small" id="addR" style="margin-top:8px"><svg class="i"><use href="#i-plus"/></svg>Aggiungi round</button>
      <span class="src" style="margin-left:8px">${(()=>{ const r=record({rounds:t.rounds}); return t.rounds.length?`Record ${recStr(r)}`:'Primo/Secondo = chi ha iniziato · V vinta, S persa, P pareggio'; })()}</span>`;
  };
  const drawCutFrom = () => { const sel=$('#fCutFrom'); if(!sel) return; const cur=+t.cutFrom||0;
    sel.innerHTML = `<option value="">${t.rounds.length?'— scegli —':'aggiungi prima i round'}</option>` + t.rounds.map((x,i)=>`<option value="${i+1}" ${cur===i+1?'selected':''}>R${i+1}${x.opp?' · vs '+esc(x.opp):''}</option>`).join('');
    $('#fCutFromL').hidden = mode==='manual'; };
  const _draw = drawRounds; const drawAll = () => { _draw(); drawCutFrom(); };
  drawAll();
  $('#fCutFrom').addEventListener('change',e=>{ t.cutFrom = +e.target.value || ''; });
  $('#fCutSize').addEventListener('change',e=>{ t.cutSize = +e.target.value || ''; });
  body2.onclick = e => {
    const cb=e.target.closest('[data-cut]'); if(cb){ cut=cb.dataset.cut; body2.querySelectorAll('[data-cut]').forEach(b=>b.setAttribute('aria-pressed',b===cb)); $('#fCutMore').hidden = cut!=='made'; return; }
    const md=e.target.closest('[data-mode]'); if(md){ mode=md.dataset.mode; if(mode==='manual' && !t.manual) t.manual=record({rounds:t.rounds}); body2.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b===md)); drawAll(); return; }
    const tb=e.target.closest('[data-tbo]'); if(tb){ t.bo=tb.dataset.tbo; body2.querySelectorAll('[data-tbo]').forEach(b=>b.setAttribute('aria-pressed',b===tb)); return; }
    const rid=e.target.closest('[data-rid]'); if(rid){ const x=t.rounds[+rid.dataset.rid]; x.id=!x.id; if(x.id) x.bye=false; drawAll(); return; }
    const rby=e.target.closest('[data-rbye]'); if(rby){ const x=t.rounds[+rby.dataset.rbye]; x.bye=!x.bye; if(x.bye){ x.id=false; x.opp=''; } drawAll(); return; }
    const bo=e.target.closest('[data-bo]'); if(bo){ const [i,v]=bo.dataset.bo.split(':'); const x=t.rounds[+i]; x.bo=v; x.id=false; x.bye=false; t.rounds[+i]=normRound(x); drawAll(); return; }
    const fi=e.target.closest('[data-first]'); if(fi){ const [i,j,k]=fi.dataset.first.split(':'); const g=t.rounds[+i].games[+j]; g.first = g.first===k?null:k;
      if(k && t.rounds[+i].bo==='bo3' && +j===0 && g.first){ /* game 2 usually starts with the loser of game 1: leave to the player */ } drawAll(); return; }
    const gr=e.target.closest('[data-g]'); if(gr){ const [i,j,k]=gr.dataset.g.split(':'); const g=t.rounds[+i].games[+j]; g.res = g.res===k?null:k; drawAll(); return; }
    if(e.target.closest('#addR')){ t.rounds.push(normRound({opp:'',bo:t.bo})); drawAll(); const ins=body2.querySelectorAll('[data-opp]'); ins[ins.length-1].focus(); return; }
    const rm=e.target.closest('[data-rmr]'); if(rm){ t.rounds.splice(+rm.dataset.rmr,1); drawAll(); return; }
  };
  body2.oninput = e => { const o=e.target.closest('[data-opp]'); if(o) t.rounds[+o.dataset.opp].opp=o.value;
    const nt=e.target.closest('[data-note]'); if(nt) t.rounds[+nt.dataset.note].note=nt.value;
    if(['mW','mL','mT'].includes(e.target.id)) t.manual={W:+$('#mW').value||0,L:+$('#mL').value||0,T:+$('#mT').value||0}; };
  $('#fType').addEventListener('change',e=>{ if(!t.rounds.length){ t.bo = BIG_EVENTS.includes(e.target.value)?'bo3':'bo1'; body2.querySelectorAll('[data-tbo]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tbo===t.bo)); } });
  $('#fDeck').addEventListener('change',e=>{ const d=decks.find(x=>x.id===e.target.value); if(d && !$('#fArch').value) $('#fArch').value=d.name; });
  $('#fSave').addEventListener('click',async ()=>{
    const name=$('#fName').value.trim(); if(!name){ $('#fMsg').textContent='Dai un nome al torneo.'; $('#fName').focus(); return; }
    const deckId=$('#fDeck').value, d=decks.find(x=>x.id===deckId);
    Object.assign(t,{name, date:$('#fDate').value||new Date().toISOString().slice(0,10), type:$('#fType').value, deckId, deckName:$('#fArch').value.trim()||(d?d.name:''),
      placement:$('#fPlace').value, players:$('#fPlayers').value, notes:$('#fNotes').value.trim(), cut, topcut: cut==='made'});
    if(cut==='made'){ t.cutSize = +$('#fCutSize').value || ''; t.cutFrom = mode==='rounds' ? (+$('#fCutFrom').value || '') : ''; if(t.cutFrom && t.cutFrom>t.rounds.length) t.cutFrom=''; }
    else { delete t.cutSize; delete t.cutFrom; }
    // keep a copy of the list played, so friends in the group can see it (saved decks stay private)
    // the list is a snapshot taken when the tournament is saved: later edits to the deck don't change it,
    // unless another deck is chosen or the player asks to refresh it
    const relist = $('#fRelist') && $('#fRelist').checked;
    if(d){ if(!hadList || deckId!==prevDeck || relist){ t.list = d.cards.slice(); t.listDate = new Date().toISOString().slice(0,10); } }
    else if(!deckId){ delete t.list; delete t.listDate; }
    if(mode==='manual'){ t.rounds=[]; t.manual=t.manual||{W:0,L:0,T:0}; } else { t.manual=null; t.rounds=t.rounds.map(x=>{ const o={opp:x.bye?'':(x.opp||'').trim(), bo:x.bo, games:x.id||x.bye?[]:x.games, r:roundRes(x)}; if(x.id) o.id=true; if(x.bye) o.bye=true; if(x.note&&x.note.trim()) o.note=x.note.trim(); if(x.src) o.src=x.src; if(x.h) o.h=x.h; return o; }); }
    App.canonT(t);
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
    <a class="btn small" href="${esc(c.url)}" target="_blank" rel="noopener">Profilo ↗</a></div>`).join('')
    + (COACHES.length>6 ? `<button type="button" class="btn small coach-more m-only" id="coachMore">Mostra tutti (${COACHES.length})</button>` : '');
  $('#coachMore')?.addEventListener('click',e=>{ const l=$('#coachList'), o=l.classList.toggle('all'); e.currentTarget.textContent = o ? 'Mostra meno' : `Mostra tutti (${COACHES.length})`; });
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
/* Championship Points: typed in by the user (Play! Pokémon has no public API), kept in the preferences with a short history */
const cpData = () => App.prefs().cp || null;
// PokéData (community site that mirrors the official CP leaderboard): a link that opens it already filtered on the player's name
const PD_REGIONS = ['Europe','US and Canada','Latin America','Oceania','Middle East and South Africa'];
const pdUrl = d => `https://www.pokedata.ovh/2027/?game=TCG&region=${encodeURIComponent(d.region||'Europe').replace(/%20/g,'+')}&division=Masters&search=${encodeURIComponent(d.player||'')}`;
const LB = 'https://championships.pokemon.com/it-it/competitors/leaderboards?pillar=tcg&division=masters&region=global';
let cpEditing = false;
function cpWidget(){
  const d=cpData();
  const form = (d) => `<form class="cp-form" id="cpForm">
      <label class="cp-wide">Nome su Play! Pokémon<input id="cpPlayer" autocomplete="off" placeholder="es. Mario Rossi" value="${esc(d&&d.player||'')}"></label>
      <label class="cp-wide">Regione<select id="cpRegion">${PD_REGIONS.map(r=>`<option ${((d&&d.region)||'Europe')===r?'selected':''}>${r}</option>`).join('')}</select></label>
      <label>Punti TCG attuali<input id="cpTotal" type="number" min="0" inputmode="numeric" required placeholder="es. 245" value="${d?d.total:''}"></label>
      <label>Posizione in classifica<input id="cpRank" type="number" min="1" inputmode="numeric" placeholder="facoltativa, es. 1520" value="${d&&d.rank||''}"></label>
      <label>Obiettivo<input id="cpGoal" type="number" min="1" inputmode="numeric" placeholder="facoltativo, es. 500" value="${d&&d.goal||''}"></label>
      <div class="cp-acts">${d?'<button type="button" class="btn small" data-cp="cancel">Annulla</button>':''}<button class="btn small primary" type="submit">Salva</button></div></form>
    <p class="src" style="margin:6px 0 0">Li trovi nell’app Play! Pokémon, su PokéData o nella <a class="link" href="${LB}" target="_blank" rel="noopener">classifica ufficiale ↗</a>.</p>`;
  if(!d || cpEditing) return form(d);
  const h=d.history||[], prev=h.length>1?h[h.length-2]:null, diff=prev?d.total-prev.total:0, goal=+d.goal||0, pr=goal?Math.min(1,d.total/goal):0;
  return `<div class="cp-top"><div><span class="cp-n num">${d.total.toLocaleString('it-IT')}</span><span class="cp-u">CP</span></div>
      ${diff?`<span class="cp-diff ${diff>0?'up':'down'}">${diff>0?'+':''}${diff} dall’ultima volta</span>`:''}
      <button type="button" class="btn small" data-cp="edit" style="margin-left:auto">Aggiorna</button></div>
    ${d.rank?`<div class="cp-rank">Posizione in classifica <b class="num">${(+d.rank).toLocaleString('it-IT')}°</b>${(()=>{ const pr=(d.history||[]).filter(x=>x.rank).slice(-2); if(pr.length<2) return ''; const dd=pr[0].rank-pr[1].rank; return dd? ` <span class="cp-diff ${dd>0?'up':'down'}">${dd>0?'↑ '+dd:'↓ '+(-dd)}</span>`:''; })()}</div>`:''}
    ${goal?`<div class="cp-bar" title="${Math.round(pr*100)}% dell’obiettivo"><b style="width:${pr*100}%"></b></div>
      <div class="cp-goal src">${d.total>=goal?'<b style="color:var(--ok)">Obiettivo raggiunto!</b>':`Mancano <b>${(goal-d.total).toLocaleString('it-IT')}</b> punti all’obiettivo di ${goal.toLocaleString('it-IT')}`}</div>`:''}
    ${h.length>1?`<div class="cp-spark">${(()=>{ const pts=h.slice(-8), mx=Math.max(...pts.map(x=>x.total),1); return pts.map(x=>`<i style="height:${Math.max(6,x.total/mx*100)}%" title="${fmtDate(x.date)}: ${x.total} CP"></i>`).join(''); })()}</div>`:''}
    <div class="cp-links">${d.player?`<a class="btn small" href="${esc(pdUrl(d))}" target="_blank" rel="noopener">Cercami su PokéData ↗</a>`:''}<a class="link" href="${LB}" target="_blank" rel="noopener">Classifica ufficiale ↗</a></div>
    <p class="src" style="margin:4px 0 0">Aggiornati al ${fmtDate(d.updated)}</p>`;
}
function cpSave(total, goal, rank, player, region){
  const p=App.prefs(), today=new Date().toISOString().slice(0,10), d=p.cp||{history:[]};
  d.total=total; d.goal=goal||null; d.rank=rank||null; d.player=player||''; d.region=region||'Europe'; d.updated=today; d.history=(d.history||[]).filter(x=>x.date!==today).concat([rank?{date:today,total,rank}:{date:today,total}]).slice(-24);
  p.cp=d; App.Store.savePrefs(); cpEditing=false; renderHome(); App.toast('Championship Points salvati');
}
const NOTE_MAX = 600;
const W = {
  notes:{title:'Note', desc:'Un promemoria tutto tuo: liste da provare, matchup, cose da ricordare', go:null, render:()=>{ const t=App.prefs().notes||'';
    return `<textarea class="wnote" id="wNote" maxlength="${NOTE_MAX}" placeholder="Scrivi qui le tue note: le ritrovi su ogni dispositivo.">${esc(t)}</textarea><div class="wnote-c src"><span id="wNoteS"></span><span id="wNoteN">${t.length}/${NOTE_MAX}</span></div>`; }},
  cp:{title:'Championship Points', desc:'I tuoi punti Play! Pokémon del GCC e l’obiettivo', go:null, render:cpWidget},
  quick:{title:'Accesso rapido', desc:'Scorciatoie alle sezioni del sito', go:null, render:()=>`<div class="qlinks">
    <a href="#deck"><svg class="i"><use href="#i-grid"/></svg>I miei mazzi</a><a href="#tornei"><svg class="i"><use href="#i-trophy"/></svg>Registra un torneo</a>
    <a href="#meta"><svg class="i"><use href="#i-chart"/></svg>Meta report</a><a href="#news"><svg class="i"><use href="#i-news"/></svg>Notizie</a></div>`},
  deck:{title:'Mazzo in lavorazione', desc:'Il mazzo aperto nel deck builder e la sua legalità', go:'#deck', render:()=>{
    const d=DL.getDeck(), v=DL.validate(), cs=d.cards.map(k=>DL.BY_KEY.get(k)), p=cs.filter(c=>c.sup==='P').length, t=cs.filter(c=>c.sup==='T').length;
    const stars=[...new Set(cs.filter(c=>c.sup==='P'&&(c.sub.includes('ex')||c.sub.includes('Stage 2'))).map(c=>c.name))].slice(0,3);
    return `<div style="display:flex;align-items:center;gap:8px"><b style="font-family:var(--display);font-size:20px">${esc(d.name)}</b><span class="status ${v.issues.length?'bad':'ok'}" style="margin-left:auto">${v.issues.length?v.issues.length+' problemi':'Legale'}</span></div>
      <div class="mini-stats"><div><span>Carte</span><b>${cs.length}/60</b></div><div><span>Pokémon</span><b>${p}</b></div><div><span>Allenatori</span><b>${t}</b></div></div>
      ${stars.length?`<p class="src" style="margin:0">Attaccanti: ${stars.map(esc).join(', ')}</p>`:''}${v.issues[0]?`<p class="src" style="margin:0;color:var(--bad)">${esc(v.issues[0])}</p>`:''}`; }},
  decks:{title:'I miei mazzi', desc:'Mazzi salvati nel deck builder', go:'#deck', render:()=>{ const L=App.data.decks.slice().sort((a,b)=>(b.updated||0)-(a.updated||0)).slice(0,5);
    return L.length ? `<table class="tbl"><tbody>${L.map(d=>`<tr><td>${archLink(d.name,'')}</td><td class="n">${d.cards.length} carte</td><td class="n"><button class="btn small" type="button" data-opendeck="${esc(d.id)}">Apri</button></td></tr>`).join('')}</tbody></table>` : '<p class="src">Nessun mazzo salvato. Nel deck builder usa “Mazzi” → “Salva”.</p>'; }},
  perf:{title:'Il mio rendimento', desc:'Record e percentuale di vittorie nei tornei', go:'#tornei', render:()=>{ const s=stats(App.data.tournaments.filter(t=>!t.ongoing));
    if(!App.data.tournaments.length) return '<p class="src">Ancora nessun torneo. <a class="link" href="#tornei">Registra il primo</a>.</p>';
    const fav = s.byDeck[0];
    return `<div class="mini-stats"><div><span>Tornei</span><b>${App.data.tournaments.filter(t=>!isLiveT(t)).length}</b></div><div><span>Record</span><b class="num" style="font-family:var(--display)">${recStr(s.tot)}</b></div><div><span>Vittorie</span><b>${games(s.tot)?pct(wr(s.tot),0):'—'}</b></div></div>
      ${fav?`<p class="src" style="margin:0">Mazzo più giocato: <b style="color:var(--fg)">${esc(fav.name||'—')}</b> (${fav.n} ${fav.n===1?'torneo':'tornei'}${fav.live?` + ${fav.live} live`:''}, ${games(fav)?pct(wr(fav),0):'—'})</p>`:''}`; }},
  recent:{title:'Ultimi tornei giocati', desc:'I tuoi tornei più recenti', go:'#tornei', render:()=>{ const L=App.data.tournaments.filter(t=>!t.ongoing).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);
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
    return `<table class="tbl" style="table-layout:fixed"><colgroup><col><col style="width:60px"><col style="width:54px"></colgroup><thead><tr><th>Mazzo</th><th class="n">Vince</th><th class="n">Quota</th></tr></thead><tbody>${form.map(a=>row(a,'')).join('')}${ex.map(a=>row(a,'esotica')).join('')}</tbody></table>`; }},
  metafy:{title:'Coach e link', desc:'I tuoi link Metafy salvati', go:'#metafy', render:()=>{ const L=App.prefs().links||[];
    return L.length ? L.slice(0,5).map(l=>`<a class="btn small" style="margin:0 6px 6px 0" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)} ↗</a>`).join('') : `<p class="src">Salva i tuoi coach nella pagina <a class="link" href="#metafy">Metafy</a>.</p>`; }}
};
const DEFAULT = [{id:'quick'},{id:'cp'},{id:'notes'},{id:'deck'},{id:'perf'},{id:'reco'},{id:'meta'},{id:'news'},{id:'regionals'},{id:'recent'}];
const layout = () => { const p=App.prefs(); if(!Array.isArray(p.widgets)) p.widgets = DEFAULT.map(x=>({...x}));
  if(!p.cpOffered){ p.cpOffered=true; if(!p.widgets.some(w=>w.id==='cp')) p.widgets.splice(1,0,{id:'cp'}); }   // new widget: shown once to existing users too
  p.widgets = p.widgets.filter(w=>W[w.id]); return p.widgets; };
// desktop: free columns (each widget remembers its column, stacked in order, no overlaps); phone: one list
const homeCols = () => { const w=$('#wgrid').clientWidth||innerWidth; return innerWidth<=900 ? 1 : Math.max(2, Math.min(4, Math.floor((w+14)/334))); };
let lastCols=0;
function wHtml(w,i,L,cols){ const def=W[w.id]; let inner; try{ inner=def.render(); }catch(e){ inner='<p class="src">Contenuto non disponibile.</p>'; }
  const same = cols>1 ? L.map((x,k)=>[x,k]).filter(([x])=>x.col===w.col).map(([,k])=>k) : L.map((x,k)=>k), pos=same.indexOf(i);
  return `<section class="widget${w.wide&&cols===1?' wide':''}" data-w="${i}" data-wid="${w.id}"><header><span class="wgrip" aria-hidden="true" title="Trascina per spostare">⋮⋮</span><h3>${esc(def.title)}</h3>${def.go?`<a class="link go" href="${def.go}">Apri →</a>`:''}
      <span class="wctl"><button type="button" data-wa="up" aria-label="Sposta su" ${pos===0?'disabled':''}>↑</button><button type="button" data-wa="down" aria-label="Sposta giù" ${pos===same.length-1?'disabled':''}>↓</button>${cols===1?'<button type="button" data-wa="wide" aria-label="Allarga o stringi">⇔</button>':''}<button type="button" class="rm" data-wa="rm" aria-label="Togli il widget">✕</button></span></header>${inner}</section>`; }
function renderHome(){
  const L = layout(), cols = homeCols(); lastCols=cols;
  const g=$('#wgrid'); g.classList.toggle('wcols', cols>1); g.style.setProperty('--wc', cols);
  if(!L.length){ g.innerHTML='<div class="empty-state"><b>La plancia è vuota</b>Premi “Personalizza” e aggiungi i widget che ti servono.</div>'; }
  else if(cols===1) g.innerHTML = L.map((w,i)=>wHtml(w,i,L,1)).join('');
  else { L.forEach((w,i)=>{ if(w.col==null || w.col>=cols) w.col = w.col==null ? i%cols : w.col%cols; });
    g.innerHTML = Array.from({length:cols},(_,c)=>`<div class="wcol" data-col="${c}">${L.map((w,i)=>w.col===c?wHtml(w,i,L,cols):'').join('')}<div class="wcol-drop">Trascina qui un widget</div></div>`).join(''); }
  const used = new Set(L.map(w=>w.id));
  $('#wcat').innerHTML = Object.entries(W).filter(([id])=>!used.has(id)).map(([id,d])=>`<button type="button" data-addw="${id}" class="wcat-i"><b>+ ${esc(d.title)}</b><span>${esc(d.desc)}</span></button>`).join('') || '<p class="src">Hai già aggiunto tutti i widget.</p>';
}
let noteT=null;
$('#wgrid').addEventListener('input',e=>{ if(e.target.id!=='wNote') return; const v=e.target.value.slice(0,NOTE_MAX);
  $('#wNoteN').textContent=`${v.length}/${NOTE_MAX}`; $('#wNoteS').textContent='Salvataggio…'; clearTimeout(noteT);
  noteT=setTimeout(()=>{ App.prefs().notes=v; App.Store.savePrefs(); const s=$('#wNoteS'); if(s) s.textContent='Salvato'; }, 700); });
$('#wgrid').addEventListener('submit',e=>{ if(e.target.id!=='cpForm') return; e.preventDefault();
  const t=Math.max(0,Math.round(+$('#cpTotal').value||0)), g=Math.round(+$('#cpGoal').value||0), r=Math.round(+$('#cpRank').value||0); cpSave(t, g>0?g:null, r>0?r:null, $('#cpPlayer').value.trim(), $('#cpRegion').value); });
$('#wgrid').addEventListener('click',e=>{
  const cp=e.target.closest('[data-cp]'); if(cp){ cpEditing = cp.dataset.cp==='edit'; renderHome(); if(cpEditing) setTimeout(()=>{ const i=$('#cpTotal'); if(i){ i.focus(); i.select(); } },30); return; }
  const od=e.target.closest('[data-opendeck]'); if(od){ DL.openDeck(App.data.decks.find(d=>d.id===od.dataset.opendeck)); location.hash='deck'; return; }
  const b=e.target.closest('[data-wa]'); if(!b) return; const i=+b.closest('[data-w]').dataset.w, L=layout();
  // up/down: swap with the previous/next widget of the same column (desktop) or of the list (phone)
  const same = lastCols>1 ? L.map((x,k)=>[x,k]).filter(([x])=>x.col===L[i].col).map(([,k])=>k) : L.map((x,k)=>k), pos=same.indexOf(i);
  const sw = j => { if(j==null) return; [L[i],L[j]]=[L[j],L[i]]; };
  if(b.dataset.wa==='up') sw(same[pos-1]);
  if(b.dataset.wa==='down') sw(same[pos+1]);
  if(b.dataset.wa==='wide') L[i].wide=!L[i].wide;
  if(b.dataset.wa==='rm') L.splice(i,1);
  // slide the widgets to their new places (FLIP: remember positions, re-render, animate from the old ones)
  const before=new Map([...document.querySelectorAll('#wgrid .widget')].map(el=>[L.find((x,k)=>k===+el.dataset.w)?.id||el.querySelector('h3').textContent, el.getBoundingClientRect()]));
  const moved=L[i]&&L[i].id;
  App.Store.savePrefs(); renderHome();
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelectorAll('#wgrid .widget').forEach(el=>{
    const id=L[+el.dataset.w]&&L[+el.dataset.w].id, r0=before.get(id); if(!r0) return; const r1=el.getBoundingClientRect(), dx=r0.left-r1.left, dy=r0.top-r1.top;
    if(!dx && !dy) return; el.style.transition='none'; el.style.transform=`translate(${dx}px,${dy}px)`; if(id===moved) el.classList.add('wmoving');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ el.style.transition='transform .35s cubic-bezier(.2,.8,.2,1)'; el.style.transform=''; setTimeout(()=>{ el.style.transition=''; el.classList.remove('wmoving'); },380); })); });
  if(b.dataset.wa!=='rm'){ const m=document.querySelector(`#wgrid .widget[data-w="${L.findIndex(x=>x.id===moved)}"]`); if(m && matchMedia('(max-width:760px)').matches) setTimeout(()=>m.scrollIntoView({block:'nearest',behavior:'smooth'}),360); }
});
$('#wcat').addEventListener('click',e=>{ const b=e.target.closest('[data-addw]'); if(!b) return;
  const L0=layout(), cnt=Array.from({length:Math.max(1,lastCols)},(_,c)=>L0.filter(x=>x.col===c).length);   // new widget: in the shortest column
  layout().push(lastCols>1?{id:b.dataset.addw, col:cnt.indexOf(Math.min(...cnt))}:{id:b.dataset.addw}); App.Store.savePrefs(); renderHome(); });
/* drag and drop while customising: drag a widget onto another to swap them, onto the panel above to remove it,
   or drag a widget from the panel into the grid to add it there. Mouse and touch (pointer events). */
let drag=null;
function dropTarget(x,y){ const el=document.elementFromPoint(x,y); if(!el) return null;
  const w=el.closest('#wgrid .widget'); if(w){ const r=w.getBoundingClientRect(), col=w.closest('.wcol'); return {kind:'w', el:w, i:+w.dataset.w, col:col?+col.dataset.col:null, before:y<r.top+r.height/2}; }
  const c=el.closest('#wgrid .wcol'); if(c) return {kind:'col', el:c, col:+c.dataset.col};
  if(el.closest('#wgrid')) return {kind:'end', el:$('#wgrid')};
  if(el.closest('#addPanel')) return {kind:'rm', el:$('#addPanel')};
  return null; }
function dragStart(e, src){
  if(!document.body.classList.contains('editing') || e.button>0 || matchMedia('(max-width:760px)').matches) return;   // phone: arrows only, so scrolling stays easy
  if(e.target.closest('button:not(.wcat-i),a,input,textarea,select')) return;
  const r=src.getBoundingClientRect();
  drag={src, x0:e.clientX, y0:e.clientY, dx:e.clientX-r.left, dy:e.clientY-r.top, w:r.width, h:Math.min(r.height,260), on:false, add:src.dataset.addw||null, i:src.dataset.w!=null?+src.dataset.w:null, tgt:null};
}
function dragMove(e){
  if(!drag) return;
  if(!drag.on){ if(Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0)<8) return; drag.on=true;
    const g=drag.src.cloneNode(true); g.classList.add('wghost'); g.style.width=drag.w+'px'; g.style.height=drag.h+'px'; document.body.appendChild(g); drag.g=g; drag.src.classList.add('wdragging'); document.body.classList.add('wdrag'); }
  e.preventDefault();
  drag.g.style.transform=`translate(${e.clientX-drag.dx}px,${e.clientY-drag.dy}px) rotate(1.5deg)`;
  const t=dropTarget(e.clientX,e.clientY);
  document.querySelectorAll('.wdrop').forEach(x=>x.classList.remove('wdrop'));
  document.querySelectorAll('.wdrop-b,.wdrop-a').forEach(x=>x.classList.remove('wdrop-b','wdrop-a'));
  if(t && !(t.kind==='w' && t.i===drag.i) && !(t.kind==='rm' && drag.add)){ if(t.kind==='w' && t.col!=null) t.el.classList.add(t.before?'wdrop-b':'wdrop-a'); else t.el.classList.add('wdrop'); }
  drag.tgt=t;
}
function dragEnd(){
  if(!drag) return; const d=drag; drag=null;
  document.querySelectorAll('.wdrop,.wdrop-b,.wdrop-a').forEach(x=>x.classList.remove('wdrop','wdrop-b','wdrop-a')); document.body.classList.remove('wdrag');
  if(!d.on) return; d.g.remove(); d.src.classList.remove('wdragging');
  const L=layout(), t=d.tgt; if(!t) return;
  // desktop columns: place the widget before/after the one it was dropped on, or at the end of a column
  if(lastCols>1 && (t.kind==='col' || (t.kind==='w' && t.col!=null))){
    if(t.kind==='w' && t.i===d.i) return;
    let item; if(d.add) item={id:d.add}; else { item=L.splice(d.i,1)[0]; }
    item.col=t.col;
    if(t.kind==='col'){ let at=-1; L.forEach((x,k)=>{ if(x.col===t.col) at=k; }); L.splice(at+1,0,item); }
    else { const tgt=d.add||d.i>t.i ? t.i : t.i-1; L.splice(t.before?tgt:tgt+1,0,item); }
    App.Store.savePrefs(); renderHome(); window.__wdragClick=Date.now(); return;
  }
  if(d.add){ const item={id:d.add}; if(t.kind==='w') L.splice(t.i,0,item); else if(t.kind==='end') L.push(item); else return; }
  else if(t.kind==='rm') L.splice(d.i,1);
  else if(t.kind==='w' && t.i!==d.i) [L[d.i],L[t.i]]=[L[t.i],L[d.i]];
  else if(t.kind==='end'){ const [x]=L.splice(d.i,1); L.push(x); }
  else return;
  App.Store.savePrefs(); renderHome(); window.__wdragClick=Date.now();
}
$('#wgrid').addEventListener('pointerdown',e=>{ const w=e.target.closest('.widget'); if(w) dragStart(e,w); });
$('#wcat').addEventListener('pointerdown',e=>{ const b=e.target.closest('[data-addw]'); if(b) dragStart(e,b); });
addEventListener('pointermove',dragMove,{passive:false}); addEventListener('pointerup',dragEnd); addEventListener('pointercancel',dragEnd);
$('#wcat').addEventListener('click',e=>{ if(Date.now()-(window.__wdragClick||0)<300) e.stopImmediatePropagation(); },true);
addEventListener('resize',()=>{ if(App.page==='home' && homeCols()!==lastCols) renderHome(); });
// while customising, a floating "Fatto" stays at the top right once the real button has scrolled away
const fDone=document.createElement('button'); fDone.type='button'; fDone.className='btn primary wdone-float'; fDone.innerHTML='<svg class="i"><use href="#i-ok"/></svg>Fatto';
document.body.appendChild(fDone); fDone.addEventListener('click',()=>$('#bEditHome').click());
let editVisible=true;
new IntersectionObserver(es=>{ editVisible=es[0].isIntersecting; syncDone(); },{threshold:0}).observe($('#bEditHome'));
function syncDone(){ fDone.classList.toggle('on', document.body.classList.contains('editing') && !editVisible && App.page==='home'); }
App.on(w=>{ if(w==='page') syncDone(); });
$('#bEditHome').addEventListener('click',()=>{ const on=document.body.classList.toggle('editing'); setTimeout(syncDone); $('#bEditHome span').textContent = on?'Fatto':'Personalizza'; $('#bEditHome').classList.toggle('primary',on); });

/* ---------- wiring ---------- */
function renderAll(){ renderHome(); renderTornei(); renderMetafy(); }
App.renderAll = renderAll;
renderMeta(); renderNews();
// tournaments registered before lists were copied: attach the list of the saved deck they used
async function attachLists(){
  for(const t of App.data.tournaments){
    if(t.list || !t.deckId) continue;
    const d=App.data.decks.find(x=>x.id===t.deckId); if(!d || !d.cards.length) continue;
    t.list=d.cards.slice(); await App.Store.put('tournaments', t);
  }
}
App.on(what=>{ if(what==='data'){ renderAll(); DL.onData && DL.onData(); attachLists(); } if(what==='deck' && App.page==='home') renderHome(); if(what==='page' && App.page==='home') renderHome(); });
App.T = {stats, record, roundRes, wr, games, recStr, normRound, cutOf, GL, BIG_EVENTS, TYPES, archLink, fmtDate, metaNames:()=>META.map(m=>m.name)};
})();
