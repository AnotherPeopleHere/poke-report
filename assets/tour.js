/* ===== Guided tour: a "?" in the header opens a step-by-step guide of the page you are on.
   Each step lights up one part of the page with a short explanation. Steps whose element is not on screen are skipped
   (e.g. the editor steps while you are on the list of decks). The "?" has a small dot until you have seen that page's guide. */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = App.esc;
const phone = () => matchMedia('(max-width:760px)').matches;

const TOURS = {
  home: [
    ['#wgrid', 'La tua plancia', 'La Home è fatta di widget: mazzo in lavorazione, rendimento, meta, notizie, Championship Points e altro.'],
    ['#bEditHome', 'Personalizza', 'Aggiungi, togli, riordina e allarga i widget. La disposizione resta salvata nel tuo profilo.'],
    ['#acct', 'Il tuo account', 'Accedi con la tua email: mazzi, tornei e preferenze si salvano online e li ritrovi su ogni dispositivo. Qui imposti anche nome, foto e codice gruppo.'],
    ['#wfab', 'Il menu', 'Tocca il tasto Home per aprire la ruota delle sezioni. Puoi anche tenerlo premuto e scorrere col dito fino alla sezione: quando lo lasci, ci vai.'],
    ['#bnav', 'Le sezioni', 'Dal telefono ti muovi con questa barra. In “Altro” trovi Gruppo, Notizie, Consigli e Metafy.'],
    ['#sitenav', 'Le sezioni', 'Da qui raggiungi tutte le pagine del sito.'],
  ],
  deck: [
    ['#libNew', 'Nuovo mazzo', 'Crea un mazzo da zero, oppure parti dal mazzo di esempio.'],
    ['#libImport', 'Importa', 'Incolla una lista da Pokémon TCG Live (anche in italiano) oppure carica un’immagine del mazzo, come l’export di Limitless o una foto.'],
    ['#libGrid .libcard', 'I tuoi mazzi', 'Ogni mazzo mostra se è legale e quante carte ha. Tocca gli sprite per sceglierli, la stella per il mazzo preferito.'],
    ['#q', 'Cerca le carte', 'Scrivi il nome in inglese o in italiano. Sotto filtri per tipo di carta ed energia; nei filtri avanzati trovi stadio, regole e set.'],
    ['#results', 'Card pool', 'Premi + per aggiungere una carta, oppure trascinala nel mazzo. Tocca una carta per la sua scheda; con il tasto destro (o tenendola premuta sul telefono) la vedi a schermo intero.'],
    ['#deckScroll', 'Il mazzo', 'Le carte sono raggruppate per tipo. Con − e + cambi le copie; il sito controlla da solo la legalità (60 carte, massimo 4 copie, una ACE SPEC).'],
    ['#detail', 'Scheda della carta', 'Testo completo, debolezza e ritirata. Con le frecce scegli la versione della carta che preferisci.'],
    ['#bExport', 'Esporta', 'Copia la lista per TCG Live o scarica un’immagine del mazzo da condividere.'],
    ['#bStats', 'Statistiche', 'Rischio di mulligan, probabilità di pescare le carte chiave e una mano di prova.'],
  ],
  meta: [
    ['#metaKpis', 'Il meta in breve', 'L’archetipo più forte, quanti ce ne sono e i Regional analizzati, dai dati di Limitless.'],
    ['#metaTable', 'Archetipi più forti', 'Quota sui punti dei tornei maggiori. La freccia accanto alla posizione dice se è in crescita o in calo nei tornei online.'],
    ['#regSel', 'Analizza un Regional', 'Scegli un evento per vederne la top 8, o “Tutti gli ultimi” per il riepilogo.'],
    ['#trendDrop', 'Cosa cambia nei mazzi', 'Scegli un archetipo: vedi le carte che le liste giocano di più o di meno rispetto alla settimana scorsa.'],
  ],
  consigli: [
    ['label[for=recoDrag]', 'Dragapult', 'Dragapult è escluso dai consigli: con questo interruttore lo includi.'],
    ['#quiz', 'Il tuo stile', 'Rispondi a poche domande: il sito ti propone i mazzi più adatti a come ti piace giocare.'],
    ['#recoForm', 'In forma adesso', 'I mazzi che vincono di più nei tornei online delle ultime settimane.'],
    ['#recoExotic', 'Pick esotiche', 'Mazzi poco giocati che però vincono più della media.'],
  ],
  news: [
    ['#newsChips', 'Categorie', 'Filtra le notizie per tipo: espansioni, prodotti, competitivo e altro.'],
    ['#newsGrid', 'Notizie', 'Aggiornate ogni mattina da PokéBeach, Limitless e dal sito ufficiale italiano. Tocca una notizia per l’articolo completo.'],
  ],
  tornei: [
    ['#bAddT', 'Nuovo torneo', 'Registra un torneo round per round: Bo1 o Bo3, chi ha iniziato, ID e BYE, top cut e note.'],
    ['#bTL', 'Importa da TCG Live', 'Incolla il registro di una partita di TCG Live: il sito riconosce mazzi, risultato e chi ha iniziato.'],
    ['#bQuick', 'Partita veloce', 'Per segnare in un attimo una partita giocata, senza un torneo.'],
    ['#tKpis', 'Il tuo rendimento', 'Record, percentuali di vittoria, primo e secondo. Le sessioni TCG Live non contano come tornei.'],
    ['#tMatch', 'Matchup', 'Come va contro ogni archetipo avversario.'],
    ['#tLast', 'Ultimi risultati', 'Tocca un risultato per saltare al torneo nello storico completo.'],
  ],
  gruppo: [
    ['#gProfile', 'Il tuo gruppo', 'Inserisci lo stesso codice gruppo dei tuoi amici per condividere tornei e liste.'],
    ['.gfbtn', 'Filtri', 'Filtra per giocatore, mazzo, periodo, tornei o partite TCG Live, Bo1 o Bo3.'],
    ['.gfilters', 'Filtri', 'Filtra per giocatore, mazzo, periodo, tornei o partite TCG Live, Bo1 o Bo3.'],
    ['#bnMore', 'Sezioni del gruppo', 'Tocca qui per passare da Panoramica a Matchup, Giocatori e Tornei.'],
    ['#wfab', 'Sezioni del gruppo', 'Apri la ruota con il tasto Home: sopra trovi Panoramica, Matchup, Giocatori e Tornei.'],
    ['#gExplorer', 'Esplora un archetipo', 'Tocca un archetipo per vedere i suoi matchup nel gruppo; “Statistiche complete” mostra tutti i dettagli.'],
  ],
  metafy: [
    ['#coachList', 'Coach', 'I giocatori in top 8 nei Regional recenti che offrono coaching su Metafy.'],
    ['#linkForm', 'I tuoi link', 'Salva i link ai coach o ai contenuti che segui: li ritrovi anche nel widget della Home.'],
  ],
};

const seenKey = p => 'pr.tour.'+p;
const seen = p => { try{ return !!localStorage.getItem(seenKey(p)); }catch(e){ return true; } };
const visible = el => { if(!el) return false; const r=el.getBoundingClientRect(); return r.width>4 && r.height>4 && getComputedStyle(el).visibility!=='hidden'; };

/* "?" button in the header */
const btn=document.createElement('button');
btn.type='button'; btn.id='tourBtn'; btn.className='tour-btn'; btn.title='Guida a questa pagina'; btn.setAttribute('aria-label','Guida a questa pagina'); btn.textContent='?';
const theme=document.getElementById('theme'); theme.parentNode.insertBefore(btn, theme);
const mark=()=>btn.classList.toggle('new', !!TOURS[App.page] && !seen(App.page));
App.on(w=>{ if(w==='page') mark(); }); mark();
btn.addEventListener('click',()=>start(App.page));

/* the tour */
let steps=[], at=0, ov=null;
function start(page){
  const all=(TOURS[page]||[]);
  steps=all.filter(([sel])=>visible(document.querySelector(sel))).filter((s,i,a)=>a.findIndex(x=>x[1]===s[1])===i);
  if(!steps.length){ App.toast('Per questa pagina non c’è ancora una guida'); return; }
  try{ localStorage.setItem(seenKey(page),'1'); }catch(e){} mark();
  if(!ov){ ov=document.createElement('div'); ov.className='tour'; ov.innerHTML='<div class="tour-hole"></div><div class="tour-tip" role="dialog" aria-live="polite"></div>'; document.body.appendChild(ov);
    ov.addEventListener('click',e=>{ const b=e.target.closest('[data-t]'); if(b){ const a=b.dataset.t; if(a==='next') go(at+1); else if(a==='prev') go(at-1); else end(); return; } if(!e.target.closest('.tour-tip')) end(); });
    document.addEventListener('keydown',e=>{ if(!ov.classList.contains('on')) return; if(e.key==='Escape') end(); if(e.key==='ArrowRight') go(at+1); if(e.key==='ArrowLeft') go(at-1); });
    addEventListener('resize',()=>{ if(ov.classList.contains('on')) place(); }); }
  ov.hidden=false; requestAnimationFrame(()=>ov.classList.add('on')); go(0);
}
function go(i){
  if(i>=steps.length) return end(); at=Math.max(0,i);
  const [sel,title,text]=steps[at], el=document.querySelector(sel);
  el.scrollIntoView({block: el.getBoundingClientRect().height>innerHeight*.6 ? 'start' : 'center', behavior:'smooth'});
  ov.querySelector('.tour-tip').innerHTML=`<div class="tt-h"><b>${esc(title)}</b><span class="num">${at+1}/${steps.length}</span></div><p>${esc(text)}</p>
    <div class="tt-a"><button type="button" class="btn small" data-t="end">Chiudi</button><span></span>${at?'<button type="button" class="btn small" data-t="prev">Indietro</button>':''}<button type="button" class="btn small primary" data-t="next">${at===steps.length-1?'Fine':'Avanti'}</button></div>`;
  setTimeout(place, 320); place();
}
function place(){
  const el=document.querySelector(steps[at][0]); if(!el) return;
  const r=el.getBoundingClientRect(), pad=6, hole=ov.querySelector('.tour-hole'), tip=ov.querySelector('.tour-tip');
  const top=Math.max(4,r.top-pad), bottom=Math.min(innerHeight-4,r.bottom+pad);
  Object.assign(hole.style,{left:(r.left-pad)+'px', top:top+'px', width:(r.width+pad*2)+'px', height:Math.max(20,bottom-top)+'px'});
  const tw=Math.min(340, innerWidth-24), th=tip.offsetHeight||150;
  let x=Math.min(Math.max(12, r.left+r.width/2-tw/2), innerWidth-tw-12), y = bottom+12;
  if(y+th > innerHeight-12) y = top-th-12;
  if(y < 12) y = Math.max(12, innerHeight-th-(phone()?100:20));   // the element fills the screen: keep the box at the bottom
  Object.assign(tip.style,{left:x+'px', top:y+'px', width:tw+'px'});
}
function end(){ if(!ov) return; ov.classList.remove('on'); setTimeout(()=>{ if(!ov.classList.contains('on')) ov.hidden=true; },220); }
App.tour = start;
})();
