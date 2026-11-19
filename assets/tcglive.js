/* ===== Import a match from a Pokémon TCG Live battle log (exported from the match results screen) =====
   Reads who went first, who won and how, and the cards each player showed; guesses both archetypes
   from the Limitless archetypes; saves the match as a Bo1 round in a "TCG Live" session of that day. */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = App.esc, DL = window.DeckLab, T = App.T;
const RECO = JSON.parse(document.getElementById('recoData').textContent);
const META = JSON.parse(document.getElementById('metaData').textContent);
const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = s => String(s||'').trim().replace(/[.!]+$/,'').replace(/\s+(in panchina|in posizione attiva|to the bench|to the active spot|on the bench|in the active spot)$/i,'').trim();

/* ---------- parse the log ---------- */
function parseLog(text){
  const lines = text.split(/\r?\n/).map(l=>l.replace(/ /g,' ').trim()).filter(Boolean);
  const out = {players:[], handOwner:null, first:null, winner:null, concededBy:null, prizes:{}, cards:{}, turns:0, lang:null};
  const addPlayer = n => { n=n.trim(); if(n && !out.players.includes(n)){ out.players.push(n); out.cards[n]=new Set(); out.prizes[n]=0; } };
  // 1) the two players: opening hands, coin flip, turns
  for(const l of lines){
    let m;
    if((m = l.match(/^(.+?) ha pescato 7 carte come mano d[’']apertura/i))){ addPlayer(m[1]); out.lang='it'; }
    else if((m = l.match(/^(.+?) drew 7 cards for the opening hand/i))){ addPlayer(m[1]); out.lang='en'; }
    else if((m = l.match(/^Turno di (.+)$/i)) || (m = l.match(/^Turn #?\s*\d+\s*-\s*(.+?)['’]s Turn$/i))) addPlayer(m[1]);
  }
  if(out.players.length < 2) return null;
  const names = out.players.slice().sort((a,b)=>b.length-a.length).map(reEsc).join('|');
  const P = `(${names})`;
  const R = {
    first: new RegExp(`^${P} (?:ha deciso di andare per (primo|secondo)|decided to go (first|second))`, 'i'),
    turn: new RegExp(`^(?:Turno di ${P}|Turn #?\\s*\\d+\\s*-\\s*${P}['’]s Turn)$`, 'i'),
    win: new RegExp(`${P} (?:ha vinto|wins|won)\\.?\\s*$`, 'i'),
    prize: new RegExp(`^${P} (?:ha preso (?:una|\\d+) cart[ae] Premio|took (?:a|\\d+) Prize cards?)`, 'i'),
    concedeMe: /^(?:Hai concesso|You conceded)/i,
    concedeOther: new RegExp(`^${P} (?:ha concesso|conceded)`, 'i'),
    // what each player shows
    playTo: new RegExp(`^${P} (?:ha giocato|played) (.+?) (?:in panchina|in posizione attiva|to the Bench|to the Active Spot)\\.?$`, 'i'),
    play: new RegExp(`^${P} (?:ha giocato|played) (.+?)(?: nello spazio delle carte Stadio| to the Stadium spot)?\\.?$`, 'i'),
    evolve: new RegExp(`^-?\\s*${P} (?:ha fatto evolvere|evolved) (.+?) (?:in panchina |in posizione attiva |on the Bench |in the Active Spot )?(?:in|to|into) (.+?)\\.?$`, 'i'),
    attach: new RegExp(`^-?\\s*${P} (?:ha assegnato|attached) (.+?) (?:a|to) (.+?)\\.?$`, 'i'),
    drew1: new RegExp(`^-?\\s*${P} (?:ha pescato|drew) (?!\\d|una carta|a card|7 carte|7 cards)(.+?)\\.?$`, 'i'),
    used: new RegExp(`^(.+?) di ${P} (?:ha usato|è stato messo KO|è ora in posizione attiva)`, 'i'),
    usedEn: new RegExp(`^${P}['’]s (.+?) (?:used|was Knocked Out|is now in the Active Spot)`, 'i'),
    bulletSrc: new RegExp(`^-?\\s*(?:${P} (?:ha pescato|ha scartato|ha cercato|drew|discarded|searched)|\\d+ (?:carte sono state scartate da|cards were discarded from) .+? (?:di|of) ${P})`, 'i')
  };
  let bulletOwner = null, inOpening = null;
  for(const raw of lines){
    let m, l = raw;
    if(/^[•·]/.test(l)){                              // card list belonging to the previous line
      if(bulletOwner) l.replace(/^[•·]\s*/,'').split(',').forEach(c=>out.cards[bulletOwner].add(clean(c)));
      if(inOpening){ out.handOwner = inOpening; inOpening = null; }
      continue;
    }
    bulletOwner = null;
    if((m = l.match(/^(.+?) (?:ha pescato 7 carte come mano d[’']apertura|drew 7 cards for the opening hand)/i))){ inOpening = m[1].trim(); bulletOwner = inOpening; continue; }
    if(/^-\s*7 (?:carte pescate|cards drawn)/i.test(l)){ bulletOwner = inOpening; continue; }
    inOpening = null;
    if((m = l.match(R.first))){ const me=m[1], go=(m[2]||m[3]||'').toLowerCase(); out.first = /primo|first/.test(go) ? me : out.players.find(p=>p!==me); continue; }
    if((m = l.match(R.turn))){ out.turns++; if(!out.first) out.first = m[1]||m[2]; continue; }
    if(R.concedeMe.test(l)) out.concededBy = 'me';
    if((m = l.match(R.concedeOther))) out.concededBy = m[1];
    if((m = l.match(R.win))) out.winner = m[1];
    if((m = l.match(R.prize))){ out.prizes[m[1]]++; continue; }
    if((m = l.match(R.evolve))){ out.cards[m[1]].add(clean(m[2])); out.cards[m[1]].add(clean(m[3])); continue; }
    if((m = l.match(R.attach))){ out.cards[m[1]].add(clean(m[2])); out.cards[m[1]].add(clean(m[3])); continue; }
    if((m = l.match(R.playTo)) || (m = l.match(R.play))){ out.cards[m[1]].add(clean(m[2])); continue; }
    if((m = l.match(R.used))){ out.cards[m[2]].add(clean(m[1])); continue; }
    if((m = l.match(R.usedEn))){ out.cards[m[1]].add(clean(m[2])); continue; }
    if((m = l.match(R.bulletSrc))){ bulletOwner = m[1] || m[2]; }
    if((m = l.match(R.drew1))){ out.cards[m[1]].add(clean(m[2])); continue; }
  }
  // turn card names into site cards (any language), keep only what we recognise
  out.known = {};
  out.players.forEach(p=>{ const seen=new Map(); out.cards[p].forEach(n=>{ const c=DL.byName(n); if(c) seen.set(c.name,c); }); out.known[p]=[...seen.values()]; });
  return out;
}

/* ---------- guess an archetype from the Pokémon shown ---------- */
const POKEMON = DL.CARDS.filter(c=>c.sup==='P');
function family(base){
  const fam = new Set();
  POKEMON.filter(c=>c.lname.replace(/[^a-z]/g,'').includes(base)).forEach(c=>{
    fam.add(c.name); let from=c.from, g=0; while(from && g++<3){ fam.add(from); const p=POKEMON.find(x=>x.name===from); from=p?p.from:''; }
  });
  return fam;
}
const famCache = new Map();
const famOf = base => { if(!famCache.has(base)) famCache.set(base, family(base)); return famCache.get(base); };
function guessArchetypes(cards){
  const seen = new Set(cards.filter(c=>c.sup==='P').map(c=>c.name));
  if(!seen.size) return [];
  const has = n => seen.has(n);
  const scored = RECO.archetypes.map(a=>{
    let s = 0;
    (a.icons||[]).forEach(ic=>{
      const base = ic.split('-').filter(x=>!['mega','ex','alolan','galarian','hisuian','paldean'].includes(x)).join('');
      const fam = famOf(base); const direct = [...seen].some(n=>n.toLowerCase().replace(/[^a-z]/g,'').includes(base));
      if(direct) s += 4; else if([...fam].some(has)) s += 3; else s -= 1.5;
    });
    const listMons = new Set(((a.list&&a.list.lines)||[]).filter(l=>l.sec==='pokemon').map(l=>l.name));
    listMons.forEach(n=>{ if(has(n)) s += .5; });
    return {name:a.name, id:a.id, s, games:a.games||0};
  }).filter(x=>x.s>0).sort((x,y)=>y.s-x.s || y.games-x.games);
  return scored.slice(0,4);
}
function guessMyDeck(cards){
  const names = new Set(cards.map(c=>c.name)); let best=null;
  App.data.decks.forEach(d=>{ const dn=new Set(d.cards.map(k=>DL.BY_KEY.get(k)).filter(Boolean).map(c=>c.name)); let hit=0; names.forEach(n=>{ if(dn.has(n)) hit++; });
    const score = hit/Math.max(1,names.size); if(hit>=3 && (!best || score>best.score)) best={d,score}; });
  return best && best.score>=.6 ? best.d : null;
}
function hashText(t){ let h=2166136261; const s=t.replace(/\s+/g,' ').trim(); for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0).toString(36)+s.length.toString(36); }

/* ---------- save a single match into today's "TCG Live" session (one per day and deck) ---------- */
const MONTHS=['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
async function saveMatch({deck, deckName, opp, first, res, note, src, h}){
  const today = new Date(), date = today.toISOString().slice(0,10);
  deckName = App.archCanon((deckName||'').trim() || (deck?deck.name:''));
  let t = App.data.tournaments.find(x=>x.type==='TCG Live' && x.date===date && (x.deckName||'')===deckName);
  const isNew = !t;
  if(!t) t = {id:App.uid(), name:`TCG Live · ${today.getDate()} ${MONTHS[today.getMonth()]}`, date, type:'TCG Live', players:'', deckId:deck?deck.id:'', deckName, placement:'', topcut:false, rounds:[], manual:null, notes:'', created:Date.now()};
  if(deck && (!t.list || t.deckId!==deck.id)){ t.deckId = deck.id; t.list = deck.cards.slice(); t.listDate = date; }   // snapshot of the list at the first match of the day
  const round = {opp:App.archCanon(opp), bo:'bo1', games:[{first:first||null, res}], r:res, src};
  if(note && note.trim()) round.note = note.trim();
  if(h) round.h = h;
  t.rounds.push(round);
  if(isNew) App.data.tournaments.push(t);
  App.prefs().lastDeck = {name:deckName, id:deck?deck.id:''}; App.Store.savePrefs();
  App.renderAll(); const ok = await App.Store.put('tournaments', t);
  if(ok) App.toast(`Partita salvata in “${t.name}” (${T.recStr(T.record(t))})`);
  return t;
}

/* ---------- dialog ---------- */
function openImport(){
  const d=$('#dlg2'), body=$('#dlg2Body');
  body.innerHTML = `<div class="dlg-h"><div><h2>Importa partita TCG Live</h2><p class="hint" style="margin:2px 0 0">In TCG Live, a fine partita, esporta il registro della partita e incollalo qui.</p></div>
      <button class="xclose" type="button" id="tlClose" aria-label="Chiudi">✕</button></div>
    <textarea id="tlIn" placeholder="Allestimento&#10;… ha vinto il lancio della moneta.&#10;…"></textarea>
    <div id="tlOut"></div>
    <div class="row"><span class="hint" id="tlMsg"></span><button class="btn" type="button" id="tlCancel">Annulla</button><button class="btn primary" type="button" id="tlSave" disabled>Salva partita</button></div>`;
  d.classList.add('sheet'); d.showModal(); d.addEventListener('close',()=>d.classList.remove('sheet'),{once:true});
  $('#tlClose').onclick = $('#tlCancel').onclick = () => d.close();
  let st = null;
  const read = () => {
    const txt = $('#tlIn').value; $('#tlSave').disabled = true; $('#tlMsg').textContent='';
    if(txt.trim().length < 40){ $('#tlOut').innerHTML=''; return; }
    const log = parseLog(txt);
    if(!log){ $('#tlOut').innerHTML = '<p class="implist" style="margin:0"><span class="hint">Non riconosco questo testo come un registro di TCG Live. Incolla tutto il registro, dalla prima riga (“Allestimento”) all’ultima.</span></p>'; return; }
    const pref = App.prefs().tlName;
    const me = log.handOwner || (log.players.includes(pref) ? pref : null) || (log.concededBy==='me' ? log.players.find(p=>p!==log.winner) : null) || log.players[0];
    st = {log, txt, me, hash: hashText(txt)};
    st.dup = App.data.tournaments.some(t=>(t.rounds||[]).some(r=>r.h===st.hash));
    draw();
  };
  const draw = () => {
    const {log, me} = st, opp = log.players.find(p=>p!==me);
    const res = !log.winner ? null : log.winner===me ? 'W' : 'L';
    const how = log.concededBy ? (log.concededBy==='me' || log.concededBy===me ? 'ti sei arreso' : 'l’avversario si è arreso')
      : log.winner && log.prizes[log.winner]>=6 ? 'tutte le carte Premio prese' : log.winner ? 'fine partita' : '';
    const first = log.first ? (log.first===me ? 'F' : 'S') : null;
    const oppGuess = guessArchetypes(log.known[opp]||[]);
    const myDeck = guessMyDeck(log.known[me]||[]);
    const myGuess = guessArchetypes(log.known[me]||[]);
    st.res = st.res || res; st.first = st.first || first;
    if(st.oppArch === undefined) st.oppArch = oppGuess[0] ? oppGuess[0].name : '';
    if(st.deckId === undefined) st.deckId = myDeck ? myDeck.id : '';
    if(st.myArch === undefined) st.myArch = myDeck ? myDeck.name : (myGuess[0] ? myGuess[0].name : '');
    const decks = App.data.decks.slice().sort((a,b)=>a.name.localeCompare(b.name));
    const archList = [...new Set([...RECO.archetypes.map(a=>a.name), ...META.map(m=>m.name)])];
    const mons = p => (log.known[p]||[]).filter(c=>c.sup==='P').map(c=>c.name);
    $('#tlOut').innerHTML = `
      ${st.dup?'<p class="tl-warn">Questa partita risulta già importata: salvandola di nuovo verrà contata due volte.</p>':''}
      <div class="tl-sum">
        <div class="tl-res ${st.res==='W'?'w':st.res==='L'?'l':''}"><b>${st.res==='W'?'Vittoria':st.res==='L'?'Sconfitta':'Risultato non trovato'}</b><span>${esc(how)}</span></div>
        <div class="tl-facts">
          <label>Sei tu<select id="tlMe">${log.players.map(p=>`<option ${p===me?'selected':''}>${esc(p)}</option>`).join('')}</select></label>
          <label>Risultato<span class="seg"><button type="button" data-tlres="W" aria-pressed="${st.res==='W'}">Vinta</button><button type="button" data-tlres="L" aria-pressed="${st.res==='L'}">Persa</button><button type="button" data-tlres="T" aria-pressed="${st.res==='T'}">Pareggio</button></span></label>
          <label>Hai iniziato<span class="seg"><button type="button" data-tlfirst="F" aria-pressed="${st.first==='F'}">Per primo</button><button type="button" data-tlfirst="S" aria-pressed="${st.first==='S'}">Per secondo</button></span></label>
        </div>
      </div>
      <div class="form">
        <label>Il tuo mazzo salvato<select id="tlDeck"><option value="">— nessuno —</option>${decks.map(x=>`<option value="${esc(x.id)}" ${x.id===st.deckId?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
        <label>Il tuo archetipo<input id="tlMy" list="tlArchs" value="${esc(st.myArch)}" placeholder="es. Lopunny Dusknoir"></label>
        <label class="full">Mazzo dell’avversario<input id="tlOpp" list="tlArchs" value="${esc(st.oppArch)}" placeholder="Scegli o scrivi l’archetipo">
          ${oppGuess.length>1?`<span class="tl-alt">Forse: ${oppGuess.slice(0,3).map(g=>`<button type="button" class="chip-btn" data-tlopp="${esc(g.name)}">${esc(g.name)}</button>`).join('')}</span>`:''}
          <small class="src">Pokémon visti: ${mons(opp).map(esc).join(', ') || 'nessuno'}</small></label>
      </div>
      <datalist id="tlArchs">${archList.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>`;
    $('#tlSave').disabled = !st.res;
    $('#tlMsg').textContent = st.res ? '' : 'Scegli il risultato per salvare.';
  };
  $('#tlIn').addEventListener('input', read);
  $('#tlIn').addEventListener('paste', ()=>setTimeout(read,0));
  $('#tlOut').addEventListener('change', e=>{
    if(e.target.id==='tlMe'){ st.me=e.target.value; st.res=st.first=undefined; st.oppArch=st.deckId=st.myArch=undefined; draw(); }
    if(e.target.id==='tlDeck'){ st.deckId=e.target.value; const dk=App.data.decks.find(x=>x.id===st.deckId); if(dk){ st.myArch=dk.name; $('#tlMy').value=dk.name; } }
  });
  $('#tlOut').addEventListener('input', e=>{ if(e.target.id==='tlOpp') st.oppArch=e.target.value; if(e.target.id==='tlMy') st.myArch=e.target.value; });
  $('#tlOut').addEventListener('click', e=>{
    const r=e.target.closest('[data-tlres]'); if(r){ st.res=r.dataset.tlres; draw(); return; }
    const f=e.target.closest('[data-tlfirst]'); if(f){ st.first=f.dataset.tlfirst; draw(); return; }
    const o=e.target.closest('[data-tlopp]'); if(o){ st.oppArch=o.dataset.tlopp; $('#tlOpp').value=st.oppArch; }
  });
  $('#tlSave').addEventListener('click', async ()=>{
    if(!st || !st.res) return;
    App.prefs().tlName = st.me;
    const deck = App.data.decks.find(x=>x.id===st.deckId);
    d.close();
    await saveMatch({deck, deckName:st.myArch, opp:st.oppArch, first:st.first, res:st.res, src:'tcglive', h:st.hash});
  });
  setTimeout(()=>$('#tlIn').focus(), 50);
}
/* ---------- quick match: no log needed ---------- */
function openQuick(){
  const d=$('#dlg2'), body=$('#dlg2Body');
  const mine = App.data.tournaments.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date)) || (b.created||0)-(a.created||0));
  const last = App.prefs().lastDeck;
  const savedByDate = App.data.decks.slice().sort((a,b)=>(b.updated||0)-(a.updated||0)).map(x=>x.name);
  const recentDecks = [...new Set([last&&last.name, ...mine.map(t=>(t.deckName||'').trim()), ...savedByDate].filter(Boolean))].slice(0,4);
  const oppCount = new Map(); mine.slice(0,40).forEach(t=>(t.rounds||[]).forEach(r=>{ const o=(r.opp||'').trim(); if(o) oppCount.set(o,(oppCount.get(o)||0)+1); }));
  const oftenOpp = [...oppCount].sort((a,b)=>b[1]-a[1]).map(x=>x[0]).slice(0,5);
  const metaOpp = RECO.archetypes.filter(a=>a.games>=300).sort((a,b)=>b.share-a.share).map(a=>a.name).filter(n=>!oftenOpp.includes(n)).slice(0,8);
  const decks = App.data.decks.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const archList = [...new Set([...decks.map(x=>x.name), ...RECO.archetypes.map(a=>a.name), ...META.map(m=>m.name)])];
  const st = {deck: last&&last.name || recentDecks[0] || '', opp:'', first:null, res:null};
  const chips = (list, field, cur) => list.map(n=>`<button type="button" class="chip-btn" data-q${field}="${esc(n)}" aria-pressed="${n===cur}">${esc(n)}</button>`).join('');
  body.innerHTML = `<div class="dlg-h"><div><h2>Partita veloce</h2><p class="hint" style="margin:2px 0 0">Per le partite su TCG Live senza registro: mazzo, avversario, risultato.</p></div>
      <button class="xclose" type="button" id="qmClose" aria-label="Chiudi">✕</button></div>
    <div class="qm">
      <div class="qm-sec"><b>Il tuo mazzo</b>${recentDecks.length?`<div class="chips" id="qmDecks">${chips(recentDecks,'d',st.deck)}</div>`:''}
        <input id="qmDeck" list="qmArchs" placeholder="Scegli un mazzo salvato o scrivi l’archetipo" value="${esc(st.deck)}"></div>
      <div class="qm-sec"><b>Mazzo dell’avversario</b>
        ${oftenOpp.length?`<span class="hint">Incontrati spesso</span><div class="chips" id="qmOftn">${chips(oftenOpp,'o','')}</div>`:''}
        <span class="hint">Più giocati</span><div class="chips" id="qmMeta">${chips(metaOpp,'o','')}</div>
        <input id="qmOpp" list="qmArchs" placeholder="…oppure scrivilo"></div>
      <div class="qm-row">
        <div class="qm-sec"><b>Hai iniziato</b><span class="seg"><button type="button" data-qf="F" aria-pressed="false">Per primo</button><button type="button" data-qf="S" aria-pressed="false">Per secondo</button></span></div>
        <div class="qm-sec"><b>Risultato</b><div class="qm-res"><button type="button" class="W" data-qr="W" aria-pressed="false">Vinta</button><button type="button" class="L" data-qr="L" aria-pressed="false">Persa</button><button type="button" class="T" data-qr="T" aria-pressed="false">Pareggio</button></div></div>
      </div>
      <div class="qm-sec"><b>Note <span class="hint">(facoltative)</span></b><textarea id="qmNote" maxlength="300" placeholder="Es. ho perso per un brutto inizio, attento a Boss's Orders turno 2…"></textarea></div>
    </div>
    <datalist id="qmArchs">${archList.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>
    <div class="row"><span class="hint" id="qmMsg">Scegli il risultato per salvare.</span><button class="btn" type="button" id="qmCancel">Annulla</button><button class="btn primary" type="button" id="qmSave" disabled>Salva partita</button></div>`;
  d.classList.add('sheet'); d.showModal(); d.addEventListener('close',()=>d.classList.remove('sheet'),{once:true});
  $('#qmClose').onclick = $('#qmCancel').onclick = () => d.close();
  const sync = () => {
    body.querySelectorAll('[data-qd]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.qd===st.deck));
    body.querySelectorAll('[data-qo]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.qo===st.opp));
    body.querySelectorAll('[data-qf]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.qf===st.first));
    body.querySelectorAll('[data-qr]').forEach(b=>b.setAttribute('aria-pressed', b.dataset.qr===st.res));
    $('#qmSave').disabled = !st.res;
    $('#qmMsg').textContent = !st.res ? 'Scegli il risultato per salvare.' : !st.opp ? 'Consiglio: segna anche l’avversario, serve per i matchup.' : '';
  };
  body.onclick = e => {
    const dk=e.target.closest('[data-qd]'); if(dk){ st.deck=dk.dataset.qd; $('#qmDeck').value=st.deck; sync(); return; }
    const op=e.target.closest('[data-qo]'); if(op){ st.opp = st.opp===op.dataset.qo ? '' : op.dataset.qo; $('#qmOpp').value=st.opp; sync(); return; }
    const f=e.target.closest('[data-qf]'); if(f){ st.first = st.first===f.dataset.qf ? null : f.dataset.qf; sync(); return; }
    const r=e.target.closest('[data-qr]'); if(r){ st.res=r.dataset.qr; sync(); return; }
  };
  $('#qmDeck').addEventListener('input',e=>{ st.deck=e.target.value; sync(); });
  $('#qmOpp').addEventListener('input',e=>{ st.opp=e.target.value; sync(); });
  $('#qmSave').addEventListener('click', async ()=>{
    if(!st.res) return;
    const name=(st.deck||'').trim(), deck=App.data.decks.find(x=>x.name===name);
    d.close();
    await saveMatch({deck, deckName:name, opp:st.opp, first:st.first, res:st.res, note:$('#qmNote').value, src:'quick'});
  });
  sync();
}
$('#bTL').addEventListener('click', openImport);
$('#bQuick').addEventListener('click', openQuick);

App.openQuickMatch = openQuick;
App.openTcgLiveImport = openImport;
App.parseTcgLiveLog = parseLog;      // used by tests
App.guessArchetypes = guessArchetypes;
})();
