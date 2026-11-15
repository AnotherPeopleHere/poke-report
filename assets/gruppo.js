/* ===== Gruppo: leaderboard and shared stats of friends who use the same group code ===== */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = App.esc, T = App.T;
const pct = (p,dec=0) => (p*100).toLocaleString('it-IT',{maximumFractionDigits:dec,minimumFractionDigits:dec})+'%';
function hue(s){ let h=0; for(const ch of String(s)) h=(h*31+ch.charCodeAt(0))%360; return h; }
const av = n => `<span class="av" style="background:hsl(${hue(n)} 55% 45%)">${esc(String(n||'?').charAt(0).toUpperCase())}</span>`;
let cache = null, loading = false;

function state(html){ $('#gBody').innerHTML = html; }
async function load(force){
  if(App.page!=='gruppo' && !force) return;
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
function render(){
  const {members, tournaments} = cache, me = App.Store.user.id, code = App.Store.profile.group_code;
  const rows = members.map(m=>{
    const ts = tournaments.filter(t=>t.user_id===m.id), s = T.stats(ts);
    const fav = s.byDeck[0];
    return {m, n:ts.length, s, fav, wr:T.wr(s.tot), games:T.games(s.tot)};
  }).sort((a,b)=>(b.games?1:0)-(a.games?1:0) || b.wr-a.wr || b.n-a.n);
  const all = T.stats(tournaments);
  const recent = tournaments.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,8);
  const name = id => { const m=members.find(x=>x.id===id); return (m && m.display_name) || 'Amico'; };
  const oppFreq = all.byOpp.slice(0,10), totOpp = all.byOpp.reduce((a,o)=>a+T.games(o),0);
  state(`
    <div class="kpis">
      <div><span>Codice gruppo</span><b style="font-size:20px">${esc(code)}</b><small>${members.length} ${members.length===1?'membro':'membri'}</small></div>
      <div><span>Tornei del gruppo</span><b>${tournaments.length}</b><small>${T.games(all.tot)} round giocati</small></div>
      <div><span>Vittorie del gruppo</span><b>${T.games(all.tot)?pct(T.wr(all.tot),1):'—'}</b><small>record ${T.recStr(all.tot)}</small></div>
      <div><span>Mazzo più giocato</span><b style="font-size:20px">${all.byDeck[0]?esc(all.byDeck[0].name||'—'):'—'}</b><small>${all.byDeck[0]?all.byDeck[0].n+' tornei':''}</small></div>
    </div>
    <div class="panel"><h3>Classifica <span class="meta">ordinata per percentuale di vittorie nei round</span></h3><div class="tbl-wrap"><table class="tbl">
      <thead><tr><th class="n">#</th><th>Giocatore</th><th class="n">Tornei</th><th class="n">Record</th><th class="n">Vittorie</th><th class="n">Game</th><th class="n">Migliore</th><th>Mazzo preferito</th></tr></thead>
      <tbody>${rows.map((r,i)=>`<tr${r.m.id===me?' class="me"':''}><td class="n rank">${r.games?i+1:'–'}</td><td><span class="arch">${av(r.m.display_name)}<span class="t">${esc(r.m.display_name||'Amico')}${r.m.id===me?' <span class="badge">tu</span>':''}</span></span></td>
        <td class="n">${r.n}</td><td class="n">${T.recStr(r.s.tot)}</td><td class="n" style="font-weight:700">${r.games?pct(r.wr):'—'}</td><td class="n">${T.games(r.s.g)?pct(T.wr(r.s.g)):'—'}</td>
        <td class="n">${r.s.best?esc(r.s.best.placement)+'°':'—'}</td><td>${r.fav?esc(r.fav.name||'—'):'<span class="src">—</span>'}</td></tr>`).join('')}</tbody></table></div>
      ${members.some(m=>m.share_stats===false)?'<p class="src" style="margin-top:8px">Chi ha scelto di non condividere i tornei compare con zero tornei.</p>':''}</div>
    <div class="cols">
      <div class="panel"><h3>Meta locale <span class="meta">gli avversari che incontrate di più</span></h3>${oppFreq.length?`<table class="tbl"><thead><tr><th>Archetipo</th><th class="n">Incontri</th><th class="n">Quota</th><th class="n">Vinti dal gruppo</th></tr></thead><tbody>${oppFreq.map(o=>`<tr><td>${esc(o.name)}</td><td class="n">${T.games(o)}</td><td class="n">${pct(T.games(o)/Math.max(1,totOpp),0)}</td><td class="n" style="font-weight:600;color:${T.wr(o)>=.55?'var(--ok)':T.wr(o)<.45?'var(--bad)':'var(--fg)'}">${pct(T.wr(o))}</td></tr>`).join('')}</tbody></table>`:'<p class="src">Quando registrate i round con l’archetipo avversario, qui vedete cosa gioca la vostra zona.</p>'}</div>
      <div class="panel"><h3>Mazzi del gruppo</h3>${all.byDeck.length?`<table class="tbl"><thead><tr><th>Mazzo</th><th class="n">Tornei</th><th class="n">Record</th><th class="n">Vittorie</th></tr></thead><tbody>${all.byDeck.map(d=>`<tr><td>${esc(d.name||'—')}</td><td class="n">${d.n}</td><td class="n">${T.recStr(d)}</td><td class="n">${T.games(d)?pct(T.wr(d)):'—'}</td></tr>`).join('')}</tbody></table>`:'<p class="src">Ancora nessun torneo registrato nel gruppo.</p>'}</div>
      <div class="panel"><h3>Ultimi tornei del gruppo</h3>${recent.length?`<table class="tbl"><tbody>${recent.map(t=>{ const r=T.record(t); return `<tr><td><b style="font-weight:600">${esc(t.name)}</b><div class="src">${esc(name(t.user_id))} · ${esc(t.deckName||'—')} · ${esc(t.date)}</div></td><td class="n">${T.recStr(r)}${t.placement?`<div class="src">${esc(t.placement)}°</div>`:''}</td></tr>`; }).join('')}</tbody></table>`:'<p class="src">Nessun torneo ancora.</p>'}</div>
    </div>`);
}
$('#pg-gruppo').addEventListener('click',e=>{ if(e.target.closest('[data-acct]')) App.accountDialog(); });
$('#gProfile').addEventListener('click',()=>App.accountDialog());
App.on(w=>{ if(w==='group'){ cache=null; load(); } if(w==='data' && App.page==='gruppo'){ load(); } if(w==='page' && App.page==='gruppo') load(); });
App.groupSummary = async () => { if(!cache && App.Store.profile && App.Store.profile.group_code){ try{ cache = await App.Store.group(); }catch(e){} } return cache; };
})();
