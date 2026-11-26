/* ===== Consigli: decks in form, exotic picks, picks for your playstyle ===== */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s==null?'':s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const R = JSON.parse(document.getElementById('recoData').textContent);
const MONTHS = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const fmtDate = d => { if(!d) return ''; const [y,m,dd]=d.split('-'); return (dd?+dd+' ':'')+MONTHS[+m-1]+' '+y; };
const pct = (p,dec=1) => p==null ? '—' : (p*100).toLocaleString('it-IT',{maximumFractionDigits:dec,minimumFractionDigits:dec})+'%';
function hue(s){ let h=0; for(const ch of s) h=(h*31+ch.charCodeAt(0))%360; return h; }
const STYLE_IT = {aggro:'Aggro', controllo:'Controllo', spread:'Spread', evoluzione:'Evoluzione', toolbox:'Toolbox', mill:'Mill', midrange:'Midrange'};
const STYLE_DESC = {aggro:'Pokémon Base che attaccano subito', controllo:'blocca, cura e logora l’avversario', spread:'danni sparsi sulla panchina avversaria', evoluzione:'si costruisce con le evoluzioni di Fase 2', toolbox:'tanti Pokémon diversi per ogni situazione', mill:'scarta il mazzo avversario', midrange:'equilibrato, senza un piano estremo'};
const DIFF_IT = ['','Semplice','Media','Complessa'];

const QUIZ = [
  {k:'pace', q:'Che ritmo di partita ti piace?', opts:[['fast','Veloce: attaccare subito e chiudere presto'],['mid','Equilibrato: adattarmi alla partita'],['slow','Lento: controllare e logorare l’avversario']]},
  {k:'complex', q:'Quanto vuoi che sia impegnativo da giocare?', opts:[['1','Semplice: piano chiaro e lineare'],['2','Medio'],['3','Complesso: tante scelte e combo']]},
  {k:'evo', q:'Ti piace costruire evoluzioni (Fase 1 e 2, Rare Candy)?', opts:[['yes','Sì, mi piace il setup'],['any','Indifferente'],['no','No, preferisco i Pokémon Base']]},
  {k:'tricks', q:'Ti divertono i trucchi: danni sparsi, blocchi, scartare il mazzo avversario?', opts:[['yes','Sì, mi piacciono le strategie insolite'],['any','Ogni tanto'],['no','No, preferisco picchiare forte']]},
];
function prefs(){ const p=App.prefs(); if(!p.playstyle) p.playstyle={}; if(p.withDragapult==null) p.withDragapult=false; return p; }
function fit(a){
  const ps = prefs().playstyle, st = a.style.styles; let s = 0, n = 0;
  if(ps.pace){ n++; s += ps.pace==='fast' ? (st.includes('aggro')?1: st.includes('controllo')?-.6:0)
                     : ps.pace==='slow' ? (st.includes('controllo')||st.includes('mill')?1: st.includes('aggro')?-.6:0)
                     : (st.includes('midrange')||st.includes('toolbox')?.6:.2); }
  if(ps.complex){ n++; const d=+ps.complex; s += 1 - Math.abs(d - a.style.difficulty)*.7; }
  if(ps.evo){ n++; s += ps.evo==='yes' ? (st.includes('evoluzione')?1:-.3) : ps.evo==='no' ? (st.includes('evoluzione')?-.8:.6) : 0; }
  if(ps.tricks){ n++; const tricky = st.some(x=>['spread','controllo','mill'].includes(x)); s += ps.tricks==='yes' ? (tricky?1:-.2) : ps.tricks==='no' ? (tricky?-.6:.5) : 0; }
  return n ? s/n : null;
}
function myWeakness(){
  const opp = new Map();
  (App.data.tournaments||[]).forEach(t=>(t.rounds||[]).forEach(x=>{ if(!x.opp) return; const g=(x.games||[]).filter(y=>y&&y.res); let r=x.r;
    if(g.length){ const w=g.filter(y=>y.res==='W').length, l=g.filter(y=>y.res==='L').length; r = w>l?'W':l>w?'L':'T'; }
    const o=opp.get(x.opp.toLowerCase())||{name:x.opp,W:0,L:0}; if(r==='W') o.W++; if(r==='L') o.L++; opp.set(x.opp.toLowerCase(),o); }));
  return [...opp.values()].filter(o=>o.W+o.L>=2 && o.L>o.W);
}
const pool = () => R.archetypes.filter(a=>a.recommendable && (prefs().withDragapult || !a.excluded));
const fieldTop = () => R.top.filter(t=>prefs().withDragapult || !/dragapult/.test(t.id)).slice(0,5);
const drag = R.archetypes.filter(a=>/dragapult/.test(a.id)).sort((a,b)=>b.players-a.players)[0];

function card(a, reason){
  const tr = a.trend==null ? '' : a.trend>0.01 ? `<span class="tchg up" title="Ultimi 7 giorni rispetto ai precedenti">▲ ${pct(a.trend,1)}</span>` : a.trend<-0.01 ? `<span class="tchg down" title="Ultimi 7 giorni rispetto ai precedenti">▼ ${pct(-a.trend,1)}</span>` : '<span class="tchg">stabile</span>';
  const vsDrag = drag && a.id!==drag.id ? a.vs.find(v=>v.id===drag.id) : null;
  const vs = a.vs.filter(v=>!/dragapult/.test(v.id) || prefs().withDragapult).slice(0,4);
  const f = fit(a);
  return `<article class="reco">
    <header>${(()=>{ const sp=window.DeckLab&&DeckLab.archSprites?DeckLab.archSprites(a.name):'';   // the deck's pixel sprites (up to two), or its initial
      return sp ? `<span class="rsp">${sp}</span>` : `<span class="av" style="background:hsl(${hue(a.name)} 55% 45%)">${esc(a.name.replace(/^(Mega |N's |Rocket's |Marnie's |Cynthia's |Hop's |Lillie's |Ethan's |Team Rocket's )/,'').charAt(0))}</span>`; })()}
      <div style="min-width:0"><h4>${esc(a.name)}</h4><div class="src">${pct(a.share,1)} dei giocatori · ${a.games.toLocaleString('it-IT')} partite</div></div>
      <div class="wrbig" title="Vittorie nelle partite non-mirror, corrette per il numero di partite"><b>${pct(a.wrAdj,1)}</b><span>vittorie</span></div></header>
    ${reason?`<p class="why">${reason}</p>`:''}
    <div class="tags">${a.style.styles.map(s=>`<span class="stag" title="${esc(STYLE_DESC[s]||'')}">${STYLE_IT[s]||s}</span>`).join('')}<span class="stag diff">${'●'.repeat(a.style.difficulty)}${'○'.repeat(3-a.style.difficulty)} ${DIFF_IT[a.style.difficulty]}</span>${a.style.singlePrize?'<span class="stag">Un solo Premio</span>':''}${tr}${f!=null?`<span class="stag fit" title="Affinità con il tuo stile">Affinità ${Math.round((f+1)/2*100)}%</span>`:''}</div>
    ${vsDrag?`<div class="vsd ${vsDrag.wr>=.5?'good':'bad'}">Contro Dragapult: <b>${pct(vsDrag.wr,0)}</b> <span class="src">(${vsDrag.games} partite)</span></div>`:''}
    ${vs.length?`<table class="tbl mini"><tbody>${vs.map(v=>`<tr><td>vs ${esc(v.name)}</td><td class="n"><span class="bar" style="display:inline-block;width:60px;vertical-align:middle"><b style="width:${v.wr*100}%;background:${v.wr>=.55?'var(--ok)':v.wr<.45?'var(--bad)':'var(--muted)'}"></b></span></td><td class="n">${pct(v.wr,0)}</td><td class="n src">${v.games}</td></tr>`).join('')}</tbody></table>`:''}
    <div class="acts">${a.list?`<button class="btn small primary" type="button" data-import="${esc(a.id)}">Apri la lista nel deck builder</button>`:''}<a class="btn small" href="${esc(a.url)}" target="_blank" rel="noopener">Liste su Limitless ↗</a></div>
    ${a.list?`<p class="src" style="margin:0">Lista di ${esc(a.list.player)} (${esc(a.list.record)}) a ${esc(a.list.tournament)}, ${fmtDate(a.list.date)}</p>`:''}
  </article>`;
}

function render(){
  const p = prefs(), P = pool();
  $('#recoWindow').textContent = `${R.window.tournaments} tornei online · ${R.window.matches.toLocaleString('it-IT')} partite · ${fmtDate(R.window.from)} – ${fmtDate(R.window.to)}`;
  $('#recoDrag').checked = !!p.withDragapult;
  // quiz
  // phone: one question at a time (qStep), moving on by itself after each answer
  if(qStep>=QUIZ.length) qStep=QUIZ.length-1;
  $('#quiz').innerHTML = QUIZ.map((q,i)=>`<div class="qz${i===qStep?' cur':''}"><b>${esc(q.q)}</b><div class="seg wrap">${q.opts.map(([v,l])=>`<button type="button" data-q="${q.k}:${v}" aria-pressed="${p.playstyle[q.k]===v}">${esc(l)}</button>`).join('')}</div></div>`).join('');
  const answered = Object.keys(p.playstyle).length;
  // in form
  const inForm = P.filter(a=>a.games>=300).sort((a,b)=>b.score-a.score).slice(0,4);
  $('#recoForm').innerHTML = inForm.map(a=>card(a, a.trend>0.01?'In crescita nell’ultima settimana.':'')).join('');
  // exotic
  const ex = P.filter(a=>a.exotic && !inForm.includes(a)).sort((a,b)=>b.wrAdj-a.wrAdj).slice(0,4);
  $('#recoExotic').innerHTML = ex.length ? ex.map(a=>card(a, `Lo gioca solo il ${pct(a.share,1)} dei giocatori, ma vince più della media: pochi avversari sanno come affrontarlo.`)).join('')
    : '<p class="src">Nessun mazzo raro con risultati sopra la media in questo periodo.</p>';
  // for you
  const weak = myWeakness();
  if(!answered){ $('#recoYou').innerHTML = '<div class="empty-state"><b>Rispondi al quiz qui sopra</b>Bastano quattro domande per vedere i mazzi più adatti a te.</div>'; }
  else {
    const scored = P.map(a=>{ const f=fit(a)||0; let bonus=0, help=[];
      weak.forEach(w=>{ const v=a.vs.find(x=>x.name.toLowerCase()===w.name.toLowerCase() || w.name.toLowerCase().startsWith(x.name.toLowerCase())); if(v && v.wr>=.55){ bonus+=.01; help.push(v.name); } });
      return {a, s: a.wrAdj + f*0.04 + bonus, f, help}; }).sort((x,y)=>y.s-x.s).slice(0,4);
    $('#recoYou').innerHTML = scored.map(({a,f,help})=>card(a, [f>.5?'Molto vicino al tuo stile.':f>0?'Abbastanza vicino al tuo stile.':'', help.length?`Va bene contro ${help.map(esc).join(', ')}, che nei tuoi tornei ti ha messo in difficoltà.`:''].filter(Boolean).join(' '))).join('');
  }
  // full table
  const all = R.archetypes.filter(a=>a.recommendable).sort((a,b)=>b.wrAdj-a.wrAdj);
  $('#qzNav').innerHTML = `<button type="button" class="btn small" data-qs="-1" ${qStep===0?'disabled':''}>← Indietro</button><span class="src">Domanda ${qStep+1} di ${QUIZ.length}</span><button type="button" class="btn small" data-qs="1" ${qStep===QUIZ.length-1?'disabled':''}>Avanti →</button>`;
  $('#recoRowsM').innerHTML = all.map(a=>{ const c=a.wrAdj>=.53?'good':a.wrAdj<.47?'bad':''; return `<a class="mrow${a.excluded&&!p.withDragapult?' dim':''}" href="${esc(a.url)}" target="_blank" rel="noopener"><span class="mr-k num ${c}">${pct(a.wrAdj,0)}</span>
      <span class="mr-n"><span class="arch"><span class="t">${esc(a.name)}</span></span><small class="src">${pct(a.share,1)} dei giocatori · ${a.games} partite${a.trend!=null&&Math.abs(a.trend)>=.005?` · ${a.trend>0?'↑':'↓'} ${pct(Math.abs(a.trend),1)}`:''}</small></span>
      <span class="mr-s src">${a.style.styles.slice(0,2).map(x=>STYLE_IT[x]||x).join(', ')}</span></a>`; }).join('');
  $('#recoTable').innerHTML = `<thead><tr><th>Archetipo</th><th class="n">Giocatori</th><th class="n">Partite</th><th class="n">Vittorie</th><th class="n">7 giorni</th><th>Stile</th></tr></thead><tbody>${all.map(a=>`<tr class="${a.excluded&&!p.withDragapult?'dim':''}"><td><span class="arch"><span class="av" style="background:hsl(${hue(a.name)} 55% 45%)">${esc(a.name.charAt(0))}</span><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a></span></td><td class="n">${pct(a.share,1)}</td><td class="n">${a.games}</td><td class="n" style="font-weight:600;color:${a.wrAdj>=.53?'var(--ok)':a.wrAdj<.47?'var(--bad)':'var(--fg)'}">${pct(a.wrAdj,1)}</td><td class="n">${a.trend==null?'—':(a.trend>0?'+':'')+pct(a.trend,1)}</td><td class="src">${a.style.styles.map(s=>STYLE_IT[s]||s).join(', ')}</td></tr>`).join('')}</tbody>`;
}
let qStep=0;
$('#quiz').addEventListener('click',e=>{ const b=e.target.closest('[data-q]'); if(!b) return; const [k,v]=b.dataset.q.split(':'); const ps=prefs().playstyle; ps[k] = ps[k]===v ? undefined : v; if(ps[k]===undefined) delete ps[k]; App.Store.savePrefs();
  if(ps[k]!==undefined && matchMedia('(max-width:760px)').matches && qStep<QUIZ.length-1) setTimeout(()=>{ qStep++; render(); },220); render(); });
$('#qzNav').addEventListener('click',e=>{ const b=e.target.closest('[data-qs]'); if(!b) return; qStep=Math.max(0,Math.min(QUIZ.length-1,qStep+(+b.dataset.qs))); render(); });
App.consTab = k => { const pg=document.getElementById('pg-consigli'); if(k){ pg.dataset.ctab=k; window.scrollTo({top:0}); } return pg.dataset.ctab; };
$('#recoDrag').addEventListener('change',e=>{ prefs().withDragapult = e.target.checked; App.Store.savePrefs(); render(); });
$('#pg-consigli').addEventListener('click',e=>{ const b=e.target.closest('[data-import]'); if(!b) return; const a=R.archetypes.find(x=>x.id===b.dataset.import); if(!a||!a.list) return;
  const text = a.list.lines.map(l=>`${l.q} ${l.name} ${l.set} ${l.num}`).join('\n');
  window.DeckLab.importList(text, a.name); location.hash='deck'; });
App.renderConsigli = render;
App.on(w=>{ if(w==='data' || (w==='page' && App.page==='consigli')) render(); });
render();
})();
