(function(){
"use strict";
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const store = { get(k,d){ try{ const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }catch(e){ return d; } }, set(k,v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} } };


/* data */
const RAW = JSON.parse(document.getElementById('cardData').textContent);
const SAMPLE = JSON.parse(document.getElementById('sampleData').textContent);
const TYPE_IT = {Grass:'Erba',Fire:'Fuoco',Water:'Acqua',Lightning:'Lampo',Psychic:'Psico',Fighting:'Lotta',Darkness:'Oscurità',Metal:'Metallo',Dragon:'Drago',Colorless:'Incolore',Fairy:'Folletto'};
const TYPE_L = {Grass:'G',Fire:'R',Water:'W',Lightning:'L',Psychic:'P',Fighting:'F',Darkness:'D',Metal:'M',Dragon:'N',Colorless:'C',Fairy:'Y'};
const SUB_IT = {'Supporter':'Aiuto','Item':'Strumento','Pokémon Tool':'Oggetto Pokémon','Stadium':'Stadio','Basic':'Base','Stage 1':'Fase 1','Stage 2':'Fase 2','Special':'Speciale'};
const keyCount = new Map();
const CARDS = RAW.map(r=>{
  let k = r.p[0][0]+'-'+r.p[0][1]; const n = (keyCount.get(k)||0)+1; keyCount.set(k,n); if(n>1) k += '~'+n;
  const c = {key:k, name:r.n, sup:r.s, sub:r.st, hp:r.hp, types:r.t, from:r.ef, abilities:r.ab, attacks:r.at, weak:r.w, res:r.r, retreat:r.rc, rules:r.ru, mark:r.rm, dex:r.dex, prints:r.p, im:r.im||''};
  c.lname = c.name.toLowerCase();
  c.ltext = [...c.abilities.map(a=>a[0]+' '+a[1]), ...c.attacks.map(a=>a[0]+' '+a[3]), ...c.rules].join(' ').toLowerCase();
  c.isBasicEnergy = c.sup==='E' && c.sub.includes('Basic');
  c.isAce = c.sub.includes('ACE SPEC');
  c.trainerKind = c.sup==='T' ? (c.sub.includes('Supporter')?'Supporter':c.sub.includes('Stadium')?'Stadium':c.sub.includes('Pokémon Tool')?'Tool':'Item') : null;
  c.color = c.sup==='P' ? (c.types[0]||'Colorless') : c.sup==='T' ? c.trainerKind : (c.isBasicEnergy ? c.name.replace(' Energy','') : 'Energy');
  c.date = c.prints.reduce((m,p)=>p[3]>m?p[3]:m,'');
  return c;
});
const BY_KEY = new Map(CARDS.map(c=>[c.key,c]));
const PRINT_IDX = new Map(); CARDS.forEach(c=>c.prints.forEach(p=>PRINT_IDX.set((p[0]+' '+p[1]).toUpperCase(), c)));
// a card's key is its newest print, so it changes when a card is reprinted: keys saved earlier still resolve through the print index
const KEY_GET = BY_KEY.get.bind(BY_KEY);
BY_KEY.get = k => KEY_GET(k) || (m => m ? PRINT_IDX.get((m[1]+' '+m[2]).toUpperCase()) : undefined)(/^(.+)-([^-~]+)(?:~\d+)?$/.exec(String(k)));
BY_KEY.has = k => !!BY_KEY.get(k);
const BY_NAME = new Map(); CARDS.forEach(c=>{ const l=c.lname; if(!BY_NAME.has(l)) BY_NAME.set(l,c); });
const ARCHS = (()=>{ try{ return JSON.parse(document.getElementById('recoData').textContent).archetypes||[]; }catch(e){ return []; } })();
const nameWords = n => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(Boolean);
$('#poolCount').textContent = CARDS.length.toLocaleString('it-IT');

/* state */
const clean = d => ({id:d.id||null, name:d.name||'Senza nome', cards:(d.cards||[]).map(k=>BY_KEY.get(k)).filter(Boolean).map(c=>c.key)});
const sampleDeck = () => ({name:SAMPLE.name, cards:SAMPLE.cards.slice()});
let deck = clean(store.get('sdl.current', null) || sampleDeck());
let selected = BY_KEY.get(deck.cards.find(k=>BY_KEY.get(k).name.endsWith(' ex'))||deck.cards[0]) || CARDS[0];
let starters = new Set(store.get('sdl.starters', []));
let view = store.get('sdl.view','grid');
let kind = '', typeSel = new Set(), shown = 120, lastHand = null, dview = 'lib', pendingView = null;
const history = [];

/* filter widgets */
Object.keys(TYPE_IT).forEach(t=>{ if(!CARDS.some(c=>c.types.includes(t))) return;
  $('#typeBtns').insertAdjacentHTML('beforeend',`<button class="tbtn ty-${t}" data-type="${t}" aria-pressed="false" title="${TYPE_IT[t]}" aria-label="Tipo ${TYPE_IT[t]}">${TYPE_L[t]}</button>`); });
const setsSeen = new Map(); CARDS.forEach(c=>c.prints.forEach(p=>{ if(!setsSeen.has(p[0])) setsSeen.set(p[0],[p[2],p[3]]); }));
[...setsSeen].sort((a,b)=>b[1][1].localeCompare(a[1][1])).forEach(([code,[name]])=>$('#fSet').insertAdjacentHTML('beforeend',`<option value="${esc(code)}">${esc(name)} (${esc(code)})</option>`));
const ADV = ['qText','fStage','fRule','fMark','fSet','hpMin','rcMax'];
const advCount = () => ADV.filter(id=>{ const el=$('#'+id); return el.type==='checkbox'? el.checked : el.value!==''; }).length;

function filtered(){
  const q = $('#q').value.trim().toLowerCase(), qt = $('#qText').checked;
  const stage=$('#fStage').value, rule=$('#fRule').value, mark=$('#fMark').value, set=$('#fSet').value;
  const hpMin=parseInt($('#hpMin').value), rcMax=parseInt($('#rcMax').value);
  const words = q ? q.split(/\s+/) : [];
  let out = CARDS.filter(c=>{
    if(words.length && !words.every(w=>c.lname.includes(w) || (qt && c.ltext.includes(w)))) return false;
    if(kind==='P' && c.sup!=='P') return false;
    if(kind==='E' && c.sup!=='E') return false;
    if(kind && kind!=='P' && kind!=='E' && !(c.sup==='T' && c.sub.includes(kind))) return false;
    if(typeSel.size && !(c.types.some(t=>typeSel.has(t)) || (c.isBasicEnergy && typeSel.has(c.color)))) return false;
    if(stage && !(c.sup==='P' && c.sub.includes(stage))) return false;
    if(rule==='ability' && !c.abilities.length) return false;
    if(rule && rule!=='ability' && !c.sub.includes(rule)) return false;
    if(mark && c.mark!==mark) return false;
    if(set && !c.prints.some(p=>p[0]===set)) return false;
    if(!isNaN(hpMin) && !(c.hp>=hpMin)) return false;
    if(!isNaN(rcMax) && !(c.sup==='P' && c.retreat<=rcMax)) return false;
    return true;
  });
  const s=$('#sort').value, byName=(a,b)=>a.name.localeCompare(b.name);
  if(s==='hp') out.sort((a,b)=>b.hp-a.hp||byName(a,b));
  else if(s==='dex') out.sort((a,b)=>(a.dex||9999)-(b.dex||9999)||byName(a,b));
  else if(s==='date') out.sort((a,b)=>b.date.localeCompare(a.date)||byName(a,b));
  else if(q){ const rank=c=>c.lname===q?0:c.lname.startsWith(q)?1:c.lname.includes(q)?2:3; out.sort((a,b)=>rank(a)-rank(b)||byName(a,b)); }
  else out.sort((a,b)=>supOrder(a)-supOrder(b)||byName(a,b));
  return out;
}
const supOrder = c => c.sup==='P'?0:c.sup==='T'?1:2;
function stageOf(c){ return c.sub.includes('Stage 2')?'Stage 2':c.sub.includes('Stage 1')?'Stage 1':c.sub.includes('Basic')?'Basic':''; }
function tags(c){
  let t=''; if(c.sub.includes('ex')) t+='<span class="tag ex">ex</span>'; if(c.sub.includes('MEGA')) t+='<span class="tag ex">Mega</span>';
  if(c.isAce) t+='<span class="tag ace">ACE SPEC</span>'; if(c.sub.includes('Ancient')) t+='<span class="tag">Antico</span>'; if(c.sub.includes('Future')) t+='<span class="tag">Futuro</span>';
  return t;
}
function subline(c){
  if(c.sup==='P') return `<span class="dot ty-${c.color}">${TYPE_L[c.color]||''}</span>${SUB_IT[stageOf(c)]||''} · <span class="num">${c.hp} PS</span>${c.abilities.length?' · Abilità':''} ${tags(c)}<span class="tag">${esc(c.prints[0][0])} ${c.mark||'—'}</span>`;
  if(c.sup==='T') return `${c.sub.filter(s=>!['ACE SPEC','Ancient','Future'].includes(s)).map(s=>SUB_IT[s]||s).join(' · ')} ${tags(c)}<span class="tag">${c.mark||'—'}</span>`;
  return c.isBasicEnergy ? 'Energia base · nessun limite di copie' : `Energia speciale ${tags(c)}<span class="tag">${c.mark||'—'}</span>`;
}
const count = c => deck.cards.reduce((n,k)=>n+(BY_KEY.get(k).name===c.name?1:0),0);
const countKey = k => deck.cards.reduce((n,x)=>n+(x===k?1:0),0);
function renderResults(){
  const list = filtered();
  $('#resCount').textContent = list.length.toLocaleString('it-IT') + (list.length===1?' carta':' carte');
  const n=advCount(); $('#advCnt').hidden=!n; $('#advCnt').textContent=n;
  $('#results').innerHTML = list.slice(0,shown).map(c=>{ const own=countKey(c.key);
    return `<li class="res${c===selected?' sel':''}" data-key="${esc(c.key)}" draggable="true">
      <span class="mini ty-${c.color}">${scan(c,false,'m-img')}</span><span class="nm">${esc(c.name)}</span>
      <span class="acts">${own?`<span class="owned">×${own}</span>`:''}<button class="add" data-add="${esc(c.key)}" title="Aggiungi al mazzo" aria-label="Aggiungi ${esc(c.name)} al mazzo">+</button></span>
      <span class="sub">${subline(c)}</span></li>`; }).join('')
    + (list.length>shown ? `<li><button class="more" id="more">Mostra altre ${Math.min(120,list.length-shown)} carte</button></li>` : '')
    + (list.length ? '' : '<li class="empty" style="margin:14px">Nessuna carta corrisponde alla ricerca.<br><button class="reset" type="button" data-reset>Azzera i filtri</button></li>');
}
let tmr; const onFilter = () => { shown=120; clearTimeout(tmr); tmr=setTimeout(renderResults,110); };
['q','sort',...ADV].forEach(id=>$('#'+id).addEventListener('input',onFilter));
$('#kindChips').addEventListener('click',e=>{ const b=e.target.closest('[data-kind]'); if(!b) return; kind=b.dataset.kind; document.querySelectorAll('#kindChips [data-kind]').forEach(x=>x.setAttribute('aria-pressed',x===b)); onFilter(); });
$('#typeBtns').addEventListener('click',e=>{ const b=e.target.closest('[data-type]'); if(!b) return; const t=b.dataset.type; typeSel.has(t)?typeSel.delete(t):typeSel.add(t); b.setAttribute('aria-pressed',typeSel.has(t)); onFilter(); });
$('#advToggle').addEventListener('click',()=>{ const a=$('#adv'); a.hidden=!a.hidden; $('#advToggle').setAttribute('aria-expanded',!a.hidden); store.set('sdl.adv',!a.hidden); });
if(store.get('sdl.adv',false)){ $('#adv').hidden=false; $('#advToggle').setAttribute('aria-expanded','true'); }
function resetFilters(){ ADV.forEach(id=>{ const el=$('#'+id); if(el.type==='checkbox') el.checked=false; else el.value=''; }); $('#q').value=''; kind=''; typeSel.clear();
  document.querySelectorAll('#kindChips [data-kind]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.kind==='')); document.querySelectorAll('#typeBtns [data-type]').forEach(x=>x.setAttribute('aria-pressed','false')); onFilter(); }
$('#resetF').addEventListener('click',resetFilters);
$('#results').addEventListener('click',e=>{
  if(e.target.closest('[data-reset]')){ resetFilters(); return; }
  if(e.target.closest('#more')){ shown+=120; renderResults(); return; }
  const a=e.target.closest('[data-add]'); if(a){ addCard(a.dataset.add); return; }
  const li=e.target.closest('.res'); if(li){ select(BY_KEY.get(li.dataset.key)); }
});
$('#results').addEventListener('dblclick',e=>{ const li=e.target.closest('.res'); if(li && !e.target.closest('button')) addCard(li.dataset.key); });

/* deck ops */
function snapshot(label){ history.push({deck:JSON.stringify(deck),label}); if(history.length>60) history.shift(); $('#bUndo').disabled=false; }
function undo(){ const h=history.pop(); if(!h) return; deck=JSON.parse(h.deck); $('#deckName').value=deck.name; $('#bUndo').disabled=!history.length; changed(); toast(`Annullato: ${h.label}`); }
function canAdd(c){
  if(deck.cards.length>=60) return 'Il mazzo ha già 60 carte';
  if(!c.isBasicEnergy && count(c)>=4) return `Hai già 4 carte chiamate “${c.name}”`;
  if(c.isAce && deck.cards.some(k=>BY_KEY.get(k).isAce)) return 'Puoi avere una sola carta ACE SPEC nel mazzo';
  return '';
}
function addCard(key){
  const c=BY_KEY.get(key); if(!c) return;
  const err=canAdd(c); if(err){ toast(err); return; }
  snapshot(`aggiunta di ${c.name}`); deck.cards.push(key); changed(); toast(`${c.name} aggiunta (${countKey(key)})`, true);
}
function removeOne(key){ const i=deck.cards.lastIndexOf(key); if(i<0) return; const c=BY_KEY.get(key); snapshot(`rimozione di ${c.name}`); deck.cards.splice(i,1); changed(); toast(`${c.name} tolta`, true); }
function rootOf(c){ let nm=c.name, from=c.from, guard=0; while(from && guard++<3){ nm=from; const p=BY_NAME.get(from.toLowerCase()); from=p?p.from:''; } return nm; }
function grouped(cards){
  const m=new Map(); (cards||deck.cards).forEach(k=>m.set(k,(m.get(k)||0)+1));
  const m2=new Map(); m.forEach((q,k)=>{ const c=BY_KEY.get(k); if(c) m2.set(c,(m2.get(c)||0)+q); });
  const arr=[...m2].map(([c,q])=>({c,q}));
  // keep evolution lines together; bigger lines first
  const lineSize=new Map(); arr.forEach(({c,q})=>{ if(c.sup==='P'){ const r=rootOf(c); lineSize.set(r,(lineSize.get(r)||0)+q); } });
  const lineRank=new Map([...lineSize].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([r],i)=>[r,i]));
  const stageN = c => c.sub.includes('Stage 2')?2:c.sub.includes('Stage 1')?1:0;
  const tOrd = {Supporter:0,Item:1,Tool:2,Stadium:3};
  arr.sort((a,b)=>supOrder(a.c)-supOrder(b.c) || (a.c.sup==='T' ? tOrd[a.c.trainerKind]-tOrd[b.c.trainerKind] : 0) || (a.c.sup==='E' ? (a.c.isBasicEnergy-b.c.isBasicEnergy) : 0)
    || (a.c.sup==='P' ? lineRank.get(rootOf(a.c))-lineRank.get(rootOf(b.c)) || stageN(a.c)-stageN(b.c) : 0) || b.q-a.q || a.c.name.localeCompare(b.c.name));
  return arr;
}

/* validation */
function validate(cards){
  const issues=[], bad=new Set(), cs=(cards||deck.cards).map(k=>BY_KEY.get(k)).filter(Boolean), n=cs.length;
  if(n!==60) issues.push(n<60 ? `Il mazzo ha ${n} carte: ne servono esattamente 60 (mancano ${60-n})` : `Il mazzo ha ${n} carte: ne servono esattamente 60`);
  const byName=new Map(); cs.forEach(c=>{ if(!c.isBasicEnergy) byName.set(c.name,(byName.get(c.name)||0)+1); });
  byName.forEach((q,nm)=>{ if(q>4){ issues.push(`${q} carte chiamate “${nm}”: massimo 4`); cs.filter(c=>c.name===nm).forEach(c=>bad.add(c.key)); } });
  const aces=cs.filter(c=>c.isAce); if(aces.length>1){ issues.push(`${aces.length} carte ACE SPEC: massimo 1 in tutto il mazzo`); aces.forEach(c=>bad.add(c.key)); }
  const rad=cs.filter(c=>c.sub.includes('Radiant')); if(rad.length>1){ issues.push('Massimo 1 Pokémon Radioso'); rad.forEach(c=>bad.add(c.key)); }
  if(n && !cs.some(c=>c.sup==='P' && c.sub.includes('Basic'))) issues.push('Serve almeno un Pokémon Base');
  return {issues,bad};
}

/* card face (js) */
// official card scans from the pokemontcg.io / scrydex CDNs; the drawn template stays underneath as fallback
// chosen version (print) of each card, saved in the user's preferences: {cardKey: "SET NUM"}
function artOf(c){ const a=(App.prefs().art||{})[c.key]; return (a && c.prints.find(p=>p[0]+' '+p[1]===a)) || c.prints[0]; }
const imOf = c => artOf(c)[6] || (artOf(c)===c.prints[0] ? c.im : '') || '';
function setArt(c, p){ const pr=App.prefs(), art=pr.art||(pr.art={}); if(p===c.prints[0]) delete art[c.key]; else art[c.key]=p[0]+' '+p[1]; App.Store.savePrefs(); }
function imgUrl(c, big){ const m=imOf(c); if(!m) return '';
  return m.startsWith('x:') ? `https://images.scrydex.com/pokemon/${m.slice(2)}/${big?'large':'small'}` : `https://images.pokemontcg.io/${m}${big?'_hires':''}.png`; }
const scan = (c, big, cls) => imOf(c) ? `<img class="${cls}" src="${imgUrl(c,big)}" alt="" crossorigin="anonymous" loading="lazy" decoding="async" draggable="false" onerror="this.remove()">` : '';
function costDots(cost, big){ return cost.map(t=>`<i class="ty-${t}" title="${TYPE_IT[t]||t}"${big?' style="width:14px;height:14px;border-radius:50%;display:inline-block"':''}></i>`).join(''); }
function cardFace(c, attrs, extra){
  let top, art, mid='', foot;
  if(c.sup==='P'){
    top = `<span class="c-name">${esc(c.name)}</span><span class="c-hp">${c.hp}</span><span class="dot ty-${c.color}">${TYPE_L[c.color]||''}</span>`;
    art = `<span class="c-sym ty-${c.color}">${TYPE_L[c.color]||''}</span><span class="c-stage">${SUB_IT[stageOf(c)]||''}</span>${c.sub.includes('ex')?'<span class="c-ex">ex</span>':''}`;
    const rows = [...c.abilities.slice(0,1).map(a=>`<span><em style="font-style:normal;color:#c8343f;font-weight:800">AB</em> ${esc(a[0])}</span>`), ...c.attacks.slice(0,2).map(a=>`<span>${a[1].map(t=>`<i class="ty-${t}"></i>`).join('')} ${esc(a[0])}<b>${esc(a[2])}</b></span>`)];
    mid = rows.length ? `<span class="c-atk">${rows.join('')}</span>` : '';
    foot = `Rit. ${c.retreat}${c.weak.length?' · Deb. '+esc(TYPE_IT[c.weak[0].split(' ')[0]]||''):''}`;
  } else if(c.sup==='T'){
    top = `<span class="c-name">${esc(c.name)}</span>`;
    art = `<span class="c-sym ty-${c.color}" style="font-size:12px">${{Supporter:'AIU',Item:'STR',Tool:'OGG',Stadium:'STA'}[c.trainerKind]}</span>${c.isAce?'<span class="c-ace">ACE SPEC</span>':''}`;
    foot = SUB_IT[c.sub.find(s=>SUB_IT[s])]||'Allenatore';
  } else {
    top = `<span class="c-name">${esc(c.name)}</span>`;
    art = `<span class="c-sym ty-${c.isBasicEnergy?c.color:'Energy'}">${c.isBasicEnergy?(TYPE_L[c.color]||'E'):'★'}</span>${c.isAce?'<span class="c-ace">ACE SPEC</span>':''}`;
    foot = c.isBasicEnergy?'Energia base':'Energia speciale';
  }
  return `<div class="card ty-${c.color}${c.sup!=='P'?' trainer':''}${extra&&extra.cls?' '+extra.cls:''}" ${attrs||''} title="${esc(c.name)}">
    <span class="c-top">${top}</span><span class="c-art">${art}</span>${mid}<span class="c-foot">${foot}</span>${scan(c,extra&&extra.big,'c-img')}${extra&&extra.inner||''}</div>`;
}

/* deck sorted by card kind: Pokémon, Supporters, Items, Tools, Stadiums, Energy */
const KINDS=[['P','Pokémon'],['Supporter','Aiuti'],['Item','Strumenti'],['Tool','Oggetti Pokémon'],['Stadium','Stadi'],['E','Energie']];
const kindOf = c => c.sup==='T' ? (c.trainerKind||'Item') : c.sup;
function byKind(cards){ const g=grouped(cards); return KINDS.map(([k,label])=>{ const items=g.filter(x=>kindOf(x.c)===k); return {k,label,items,n:items.reduce((a,x)=>a+x.q,0)}; }).filter(x=>x.items.length); }
function kindGrid(cards){
  return byKind(cards).map(s=>`<div class="st-sec"><b>${s.label} <span class="hint num">${s.n}</span></b><div class="grid kgrid">${s.items.map(({c,q})=>cardFace(c,'',{inner:`<span class="q">${q}</span>`})).join('')}</div></div>`).join('');
}
/* PNG of the deck: card scans in sections, with the number of copies on each card */
async function deckImage(cards){
  // 16:9 picture, minimal: dark background, cards in kind order (Pokémon, Supporters, Items, Tools, Stadiums, Energy),
  // centred rows, the number of copies in a hexagon badge on each card
  const items=byKind(cards).flatMap(s=>s.items), n=items.length, W=1920, H=1080, PAD=56, GAP=10, R=88/63;
  let best={cw:0,cols:8};
  for(let cols=4; cols<=16; cols++){ const rows=Math.ceil(n/cols); const cw=Math.min((W-2*PAD-(cols-1)*GAP)/cols, (H-2*PAD-(rows-1)*GAP)/rows/R); if(cw>best.cw) best={cw,cols}; }
  const cols=best.cols, cw=Math.floor(best.cw), ch=Math.round(cw*R), rows=Math.ceil(n/cols);
  const load = c => !imOf(c) ? Promise.resolve(null) : fetch(imgUrl(c,cw>200),{mode:'cors',cache:'reload'}).then(r=>{ if(!r.ok) throw 0; return r.blob(); }).then(b=>createImageBitmap(b)).catch(()=>null);
  const imgs=await Promise.all(items.map(x=>load(x.c)));
  const DISP=getComputedStyle(document.documentElement).getPropertyValue('--display').trim()||'sans-serif';
  const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d');
  x.fillStyle='#1b1b1e'; x.fillRect(0,0,W,H);
  x.fillStyle='rgba(255,255,255,.035)';   // faint diamond texture
  for(let yy=0; yy<H+24; yy+=24) for(let xx=(yy/24)%2?12:0; xx<W+24; xx+=24){ x.beginPath(); x.moveTo(xx,yy-5); x.lineTo(xx+5,yy); x.lineTo(xx,yy+5); x.lineTo(xx-5,yy); x.fill(); }
  const rr=(px,py,w,h,r)=>{ x.beginPath(); x.moveTo(px+r,py); x.arcTo(px+w,py,px+w,py+h,r); x.arcTo(px+w,py+h,px,py+h,r); x.arcTo(px,py+h,px,py,r); x.arcTo(px,py,px+w,py,r); x.closePath(); };
  const top=Math.round((H-(rows*ch+(rows-1)*GAP))/2), rad=Math.max(4,cw*.045);
  items.forEach(({c,q},i)=>{
    const row=Math.floor(i/cols), inRow=Math.min(cols,n-row*cols), col=i%cols;
    const left=Math.round((W-(inRow*cw+(inRow-1)*GAP))/2), cx=left+col*(cw+GAP), cy=top+row*(ch+GAP), im=imgs[i];
    x.save(); x.shadowColor='rgba(0,0,0,.45)'; x.shadowBlur=10; x.shadowOffsetY=3; rr(cx,cy,cw,ch,rad); x.fillStyle='#2a2b31'; x.fill(); x.restore();
    x.save(); rr(cx,cy,cw,ch,rad); x.clip();
    if(im) x.drawImage(im,cx,cy,cw,ch);
    else { x.fillStyle='#fff'; x.font=`700 ${Math.round(cw*.1)}px ${DISP}`; const words=c.name.split(' '); let line='', ly=cy+cw*.18;
      words.forEach(w=>{ if(x.measureText(line+w).width>cw*.84 && line){ x.fillText(line.trim(),cx+cw*.08,ly); ly+=cw*.13; line=''; } line+=w+' '; }); x.fillText(line.trim(),cx+cw*.08,ly); }
    x.restore();
    // hexagon badge, centred near the bottom of the card
    const hr=cw*.17, hx=cx+cw/2, hy=cy+ch*.83;
    x.beginPath(); for(let k=0;k<6;k++){ const a=Math.PI/3*k-Math.PI/2; x.lineTo(hx+hr*Math.cos(a), hy+hr*Math.sin(a)); } x.closePath();
    const gr=x.createLinearGradient(0,hy-hr,0,hy+hr); gr.addColorStop(0,'#c8333f'); gr.addColorStop(1,'#8e1d27'); x.fillStyle=gr;
    x.save(); x.shadowColor='rgba(0,0,0,.5)'; x.shadowBlur=8; x.fill(); x.restore();
    x.lineWidth=Math.max(1.5,cw*.012); x.strokeStyle='rgba(255,255,255,.85)'; x.stroke();
    x.fillStyle='#fff'; x.font=`800 ${Math.round(hr*1.15)}px ${DISP}`; x.textAlign='center'; x.textBaseline='middle'; x.fillText(String(q),hx,hy+hr*.06); x.textAlign='left'; x.textBaseline='alphabetic';
  });
  return new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error('png')),'image/png'));
}
const fileName = n => (String(n||'mazzo').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w-]+/g,'-').replace(/^-+|-+$/g,'')||'mazzo')+'.png';
/* image tab used by the export dialog and the group's list pop-up */
function imagePanel(el, cards, title, sub){
  el.innerHTML=`<div class="ex-prev"><span class="hint">Preparo l'immagine…</span></div>
    <div class="row"><span class="hint ex-msg"></span><button type="button" class="btn ex-share" hidden>Condividi</button><button type="button" class="btn primary ex-dl" disabled>Scarica immagine</button></div>`;
  deckImage(cards).then(blob=>{
    const url=URL.createObjectURL(blob), file=new File([blob],fileName(title),{type:'image/png'});
    el.querySelector('.ex-prev').innerHTML=`<img src="${url}" alt="Immagine del mazzo ${esc(title)}">`;
    const dl=el.querySelector('.ex-dl'); dl.disabled=false;
    dl.addEventListener('click',()=>{ const a=document.createElement('a'); a.href=url; a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); });
    if(navigator.canShare && navigator.canShare({files:[file]})){ const sh=el.querySelector('.ex-share'); sh.hidden=false; sh.addEventListener('click',()=>navigator.share({files:[file],title}).catch(()=>{})); }
    if(cards.some(k=>{ const c=BY_KEY.get(k); return c && !imOf(c); })) el.querySelector('.ex-msg').textContent='Alcune carte non hanno la scansione: compaiono con il nome.';
  }).catch(()=>{ el.querySelector('.ex-prev').innerHTML='<span class="hint">Non sono riuscito a creare l’immagine. Controlla la connessione e riprova.</span>'; });
}

/* render deck */
function renderDeck(){
  const {issues,bad}=validate(), n=deck.cards.length;
  const st=$('#status'); st.className='status '+(issues.length?'bad':'ok');
  st.innerHTML = issues.length ? `<svg class="i"><use href="#i-warn"/></svg>${issues.length} ${issues.length===1?'problema':'problemi'}` : `<svg class="i"><use href="#i-ok"/></svg>Legale`;
  const il=$('#issues'); il.className='issues '+(issues.length?'bad':'ok');
  il.innerHTML = issues.length ? issues.map(i=>`<div><svg class="i"><use href="#i-warn"/></svg>${esc(i)}</div>`).join('') : `<div><svg class="i"><use href="#i-ok"/></svg>Mazzo legale per il formato Standard</div>`;
  $('#tabCount').textContent=n;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===view));
  const cs=deck.cards.map(k=>BY_KEY.get(k)), p=cs.filter(c=>c.sup==='P').length, t=cs.filter(c=>c.sup==='T').length, e=n-p-t;
  const ok=n===60;
  let html = `<div class="deckhead"><span class="meter"><span class="cnt${ok?'':' bad'}">${n}</span><span class="track"><b class="${ok?'':'bad'}" style="width:${Math.min(100,n/60*100)}%"></b></span><span class="lim">/ 60</span></span>
    <span class="breakdown"><span>Pokémon <b>${p}</b></span><span>Allenatori <b>${t}</b></span><span>Energie <b>${e}</b></span></span></div>`;
  const g=grouped();
  if(!n) html += `<div class="section"><div class="empty">Il mazzo è vuoto. Trascina qui le carte o usa <b>+</b> nell'elenco.<br>Un mazzo Standard ha esattamente 60 carte.</div></div>`;
  [['P','Pokémon'],['T','Allenatori'],['E','Energie']].forEach(([s,label])=>{
    const items=g.filter(x=>x.c.sup===s); if(!items.length) return;
    const tot=items.reduce((a,x)=>a+x.q,0);
    let body;
    if(view==='grid') body=`<div class="grid">${items.map(({c,q})=>cardFace(c,`data-key="${esc(c.key)}" tabindex="0" role="button" draggable="true"`,{cls:bad.has(c.key)?'illegal':'',inner:`<span class="q">${q}</span><span class="ctl"><button type="button" data-minus="${esc(c.key)}" aria-label="Togli una copia di ${esc(c.name)}">−</button><button type="button" data-plus="${esc(c.key)}" aria-label="Aggiungi una copia di ${esc(c.name)}">+</button></span>`})).join('')}</div>`;
    else body=`<ul class="dlist">${items.map(({c,q})=>`<li data-key="${esc(c.key)}" class="${bad.has(c.key)?'illegal':''}" draggable="true"><span class="q">${q}</span><span class="cbar ty-${c.color}"></span><span class="nm">${esc(c.name)}<small>${esc(artOf(c)[0]+' '+artOf(c)[1])}</small></span><span class="ctl"><button type="button" data-minus="${esc(c.key)}" aria-label="Togli una copia di ${esc(c.name)}">−</button><button type="button" data-plus="${esc(c.key)}" aria-label="Aggiungi una copia di ${esc(c.name)}">+</button></span></li>`).join('')}</ul>`;
    html += `<div class="section"><div class="sec-h"><h3>${label}</h3><span class="num">${tot}</span></div>${body}</div>`;
  });
  const sc=$('#deckScroll'), top=sc.scrollTop; sc.innerHTML=html; sc.scrollTop=top;
}
$('#deckScroll').addEventListener('click',e=>{
  const mi=e.target.closest('[data-minus]'); if(mi){ e.stopPropagation(); removeOne(mi.dataset.minus); return; }
  const pl=e.target.closest('[data-plus]'); if(pl){ e.stopPropagation(); addCard(pl.dataset.plus); return; }
  const t=e.target.closest('[data-key]'); if(t) select(BY_KEY.get(t.dataset.key));
});
$('#deckScroll').addEventListener('keydown',e=>{ const t=e.target.closest('.card[data-key]'); if(!t) return;
  if(e.key==='Enter'||e.key===' '){ e.preventDefault(); select(BY_KEY.get(t.dataset.key)); }
  if(e.key==='Delete'||e.key==='Backspace'||e.key==='-'){ e.preventDefault(); removeOne(t.dataset.key); }
  if(e.key==='+'){ e.preventDefault(); addCard(t.dataset.key); } });
$('#deck .pane-h').addEventListener('click',e=>{ const b=e.target.closest('[data-view]'); if(!b) return; view=b.dataset.view; store.set('sdl.view',view); renderDeck(); });

/* drag & drop */
let drag=null;
document.addEventListener('dragstart',e=>{
  const res=e.target.closest&&e.target.closest('.res'), tile=e.target.closest&&e.target.closest('#deckScroll [data-key]');
  if(res) drag={from:'pool',key:res.dataset.key}; else if(tile){ drag={from:'deck',key:tile.dataset.key}; tile.classList.add('dragging'); } else return;
  e.dataTransfer.effectAllowed='copyMove'; try{ e.dataTransfer.setData('text/plain',drag.key); }catch(_){}
});
document.addEventListener('dragend',()=>{ drag=null; $('#deckScroll').classList.remove('drop'); document.querySelectorAll('.dragging').forEach(x=>x.classList.remove('dragging')); });
$('#deckScroll').addEventListener('dragover',e=>{ if(drag&&drag.from==='pool'){ e.preventDefault(); $('#deckScroll').classList.add('drop'); } });
$('#deckScroll').addEventListener('dragleave',e=>{ if(!$('#deckScroll').contains(e.relatedTarget)) $('#deckScroll').classList.remove('drop'); });
$('#deckScroll').addEventListener('drop',e=>{ if(!drag||drag.from!=='pool') return; e.preventDefault(); $('#deckScroll').classList.remove('drop'); addCard(drag.key); drag=null; });
$('#pool').addEventListener('dragover',e=>{ if(drag&&drag.from==='deck') e.preventDefault(); });
$('#pool').addEventListener('drop',e=>{ if(drag&&drag.from==='deck'){ e.preventDefault(); removeOne(drag.key); drag=null; } });

/* inspector */
function openDrawer(){ const d=$('#inspect'); d.classList.add('open'); d.setAttribute('aria-hidden','false'); $('#drawerBack').hidden=!mq.matches; }
function closeDrawer(){ const d=$('#inspect'); d.classList.remove('open'); d.setAttribute('aria-hidden','true'); $('#drawerBack').hidden=true; document.querySelectorAll('.res.sel').forEach(x=>x.classList.remove('sel')); }
$('#drawerClose').addEventListener('click',closeDrawer);
$('#drawerBack').addEventListener('click',closeDrawer);
function select(c){ selected=c; renderDetail(); openDrawer(); document.querySelectorAll('.res.sel').forEach(x=>x.classList.remove('sel')); const li=document.querySelector(`.res[data-key="${CSS.escape(c.key)}"]`); if(li) li.classList.add('sel'); }
function wr(list){ return list.length ? list.map(x=>{ const [t,v]=x.split(' '); return `<span class="dot ty-${t}">${TYPE_L[t]||''}</span>${esc(v)}`; }).join(' ') : '—'; }
const ltUrl = p => `https://limitlesstcg.com/cards/${encodeURIComponent(p[0])}/${encodeURIComponent(p[1])}`;
function renderDetail(){
  const c=selected, n=c.isBasicEnergy?countKey(c.key):count(c), lim=c.isBasicEnergy?null:4;
  const typeLine = c.sup==='P' ? `Pokémon ${SUB_IT[stageOf(c)]||''}${c.from?` · si evolve da ${esc(c.from)}`:''}` : c.sup==='T' ? `Allenatore · ${c.sub.map(s=>SUB_IT[s]||s).join(' · ')}` : (c.isBasicEnergy?'Energia base':'Energia speciale');
  const chips = c.sup==='P' ? `<span class="chip"><span class="dot ty-${c.color}">${TYPE_L[c.color]}</span><b>${TYPE_IT[c.color]||c.color}</b></span><span class="chip">PS <b class="num">${c.hp}</b></span>${tags(c)}` : tags(c);
  const blocks = [
    ...c.abilities.map(a=>`<div class="blk"><div class="bh"><span class="ab">${esc(a[2]==='Ability'?'Abilità':a[2])}</span>${esc(a[0])}</div><p>${esc(a[1])}</p></div>`),
    ...c.attacks.map(a=>`<div class="blk"><div class="bh"><span class="cost">${costDots(a[1],true)}</span>${esc(a[0])}<span class="dmg">${esc(a[2])}</span></div>${a[3]?`<p>${esc(a[3])}</p>`:''}</div>`),
    ...(c.sup!=='P' ? c.rules.map(r=>`<div class="blk"><p style="margin:0">${esc(r)}</p></div>`) : c.rules.map(r=>`<div class="blk rule">${esc(r)}</div>`))
  ].join('');
  const wrrBlock = c.sup==='P' ? `<div class="wrr"><div><span>Debolezza</span><b>${wr(c.weak)}</b></div><div><span>Resistenza</span><b>${wr(c.res)}</b></div><div><span>Ritirata</span><b>${c.retreat?costDots(Array(c.retreat).fill('Colorless'),true):'0'}</b></div></div>` : '';
  const pips = lim ? `<span class="copies">${Array.from({length:4},(_,i)=>`<i class="${i<n?'on':''}"></i>`).join('')}<span class="num" style="margin-left:4px">${n}/4</span></span>` : `<span class="copies num">${n} nel mazzo</span>`;
  const vers=c.prints.filter(p=>p[6]), cur=artOf(c), vi=vers.indexOf(cur);
  const picker = vers.length>1 ? `<div class="art-pick"><button type="button" data-art="-1" aria-label="Versione precedente">‹</button><span title="${esc(cur[2]+(cur[4]?' · '+cur[4]:''))}"><b class="num">${esc(cur[0])} ${esc(cur[1])}</b><small>${vi<0?'—':vi+1}/${vers.length}</small></span><button type="button" data-art="1" aria-label="Versione successiva">›</button></div>` : '';
  $('#detail').innerHTML = `<div class="big"><div class="big-l">${cardFace(c,'',{big:true})}${picker}</div><div style="min-width:0">
      <h2 class="cd-name">${esc(c.name)}</h2><div class="cd-type">${typeLine}</div>
      <div class="cd-stats">${chips}</div>
      <div class="cd-stats"><span class="chip">Regulation <b>${c.mark||'—'}</b></span><span class="chip"><b class="num">${esc(artOf(c)[0])} ${esc(artOf(c)[1])}</b></span></div>
      <div class="cd-stats"><a class="lt-link" href="${ltUrl(artOf(c))}" target="_blank" rel="noopener">Vedi la carta su Limitless ↗</a></div>
    </div></div>
    <div class="blocks">${blocks}</div>${wrrBlock}
    <div class="cd-acts"><button type="button" class="btn small primary" data-d="add">+ Aggiungi</button><button type="button" class="btn small" data-d="rm" ${countKey(c.key)?'':'disabled'}>− Togli</button>${pips}</div>
    ${c.sup==='P' && count(c)!==countKey(c.key) ? `<p class="hint">Il limite di 4 copie vale per il nome: conta anche altre versioni di “${esc(c.name)}” nel mazzo.</p>` : ''}
    <details class="prints"><summary>${c.prints.length} ${c.prints.length===1?'stampa':'stampe'} di questa carta</summary><table>${c.prints.map(p=>`<tr><td class="c"><a href="${ltUrl(p)}" target="_blank" rel="noopener" title="Apri su Limitless">${esc(p[0])} ${esc(p[1])} ↗</a></td><td>${esc(p[2])}</td><td>${esc(p[4]||'')}</td><td class="c">${esc(p[5]||'—')}</td></tr>`).join('')}</table></details>`;
}
$('#detail').addEventListener('click',e=>{
  const ar=e.target.closest('[data-art]'); if(ar){ const c=selected, vers=c.prints.filter(p=>p[6]); if(vers.length<2) return;
    const i=vers.indexOf(artOf(c)), n=vers.length; setArt(c, vers[((i<0?0:i)+(+ar.dataset.art)+n)%n]);
    renderDetail(); renderDeck(); const y=$('#results').parentElement.scrollTop; renderResults(); $('#results').parentElement.scrollTop=y; return; }
  const b=e.target.closest('[data-d]'); if(!b) return; if(b.dataset.d==='add') addCard(selected.key); else removeOne(selected.key); });

/* stats */
function choose(n,k){ if(k<0||k>n) return 0; k=Math.min(k,n-k); let r=1; for(let i=1;i<=k;i++) r=r*(n-k+i)/i; return r; }
const pAtLeast1 = (N,K,n) => (N<=0||K<=0) ? 0 : 1 - choose(N-K,Math.min(n,N))/choose(N,Math.min(n,N));
const pct = p => (p>0&&p<.001) ? '<0,1%' : (p*100).toLocaleString('it-IT',{maximumFractionDigits:1,minimumFractionDigits:1})+'%';
const pcell = p => `<td class="n"><span class="pb"><b style="width:${p*100}%"></b></span>${pct(p)}</td>`;
function renderStats(){
  const cs=deck.cards.map(k=>BY_KEY.get(k)), N=cs.length;
  const p=cs.filter(c=>c.sup==='P').length, t=cs.filter(c=>c.sup==='T').length, e=N-p-t;
  const basics=cs.filter(c=>c.sup==='P'&&c.sub.includes('Basic')).length;
  const mull = N ? 1-pAtLeast1(N,basics,7) : 0;
  const w=v=>N?(v/N*100)+'%':'0';
  const supp=cs.filter(c=>c.trainerKind==='Supporter').length, items=cs.filter(c=>c.trainerKind==='Item').length, tools=cs.filter(c=>c.trainerKind==='Tool').length, stad=cs.filter(c=>c.trainerKind==='Stadium').length;
  const eTypes=new Map(); cs.filter(c=>c.sup==='E').forEach(c=>eTypes.set(c.isBasicEnergy?c.color:'Speciale',(eTypes.get(c.isBasicEnergy?c.color:'Speciale')||0)+1));
  const byName=new Map(); cs.forEach(c=>byName.set(c.name,(byName.get(c.name)||0)+1));
  starters=new Set([...starters].filter(nm=>byName.has(nm)));
  const K=cs.filter(c=>starters.has(c.name)).length;
  const top=[...byName].filter(([nm,q])=>q>=2).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,6);
  const prized=(k)=>N>=6&&k? choose(N-k,6-k)/choose(N,6) : 0; // all copies prized
  const mullClass = mull<=.15?'good':mull<=.25?'warnc':'badc';
  $('#stats').innerHTML = `
    <div class="kpi"><div><span>Rischio mulligan</span><b class="${mullClass}">${pct(mull)}</b><span>${basics} Pokémon Base</span></div><div><span>Aiuti nel mazzo</span><b>${supp}</b><span>Strumenti ${items} · Ogg. ${tools} · Stadi ${stad}</span></div></div>
    <div><h3>Composizione <span class="num">${N}/60</span></h3>
      <div class="split">${p?`<span style="width:${w(p)};background:var(--t-Fire)"></span>`:''}${t?`<span style="width:${w(t)};background:var(--tr-Item)"></span>`:''}${e?`<span style="width:${w(e)};background:var(--t-Lightning)"></span>`:''}</div>
      <div class="legend"><span><i style="background:var(--t-Fire)"></i>Pokémon <b class="num">${p}</b></span><span><i style="background:var(--tr-Item)"></i>Allenatori <b class="num">${t}</b></span><span><i style="background:var(--t-Lightning)"></i>Energie <b class="num">${e}</b></span></div>
      ${eTypes.size?`<div class="legend">${[...eTypes].map(([k,v])=>`<span><i class="${k==='Speciale'?'ty-Energy':'ty-'+k}"></i>${k==='Speciale'?'Speciali':TYPE_IT[k]||k} <b class="num">${v}</b></span>`).join('')}</div>`:''}</div>
    <div class="prob"><h3>Probabilità in mano iniziale</h3>
      <table><thead><tr><th>Almeno 1 di…</th><th class="n">Mano (7)</th><th class="n">Turno 1 (8)</th><th class="n" title="Tutte le copie finiscono nelle carte Premio">Tutte premio</th></tr></thead><tbody>
      ${top.map(([nm,q])=>`<tr><td>${esc(nm)} <span class="num" style="color:var(--muted)">×${q}</span></td>${pcell(pAtLeast1(N,q,7))}${pcell(pAtLeast1(N,q,8))}<td class="n">${pct(prized(q))}</td></tr>`).join('')}
      <tr class="grp"><td>Gruppo starter <span class="num" style="color:var(--muted)">×${K}</span></td>${pcell(pAtLeast1(N,K,7))}${pcell(pAtLeast1(N,K,8))}<td class="n">${pct(prized(K))}</td></tr>
      </tbody></table>
      <div style="margin-top:8px"><select id="starterPick" aria-label="Aggiungi carta al gruppo starter"><option value="">+ Aggiungi al gruppo starter…</option>${[...byName.keys()].sort().filter(nm=>!starters.has(nm)).map(nm=>`<option>${esc(nm)}</option>`).join('')}</select></div>
      <div class="cd-stats">${[...starters].map(nm=>`<button type="button" class="chip" style="border:0;cursor:pointer" data-unstart="${esc(nm)}">${esc(nm)} ✕</button>`).join('') || '<span class="hint">Metti nel gruppo le carte con cui vuoi aprire (es. i Pokémon Base chiave e le carte che li cercano).</span>'}</div>
    </div>
    <div><h3>Mano di prova</h3>
      <button type="button" class="btn small" data-hand><svg class="i"><use href="#i-shuffle"/></svg>Pesca 7 carte e 6 Premi</button>
      <div id="handBox">${lastHand?handHtml(lastHand):''}</div></div>`;
}
function handHtml(h){
  return `${h.mull?`<p class="hint" style="margin-top:8px;color:var(--bad)">Nessun Pokémon Base: mulligan ${h.mull}× prima di questa mano.</p>`:''}
    <div class="hand-l">Mano</div><div class="hand">${h.hand.map(k=>cardFace(BY_KEY.get(k),`data-key="${esc(k)}"`)).join('')}</div>
    <div class="hand-l">Carte Premio</div><div class="hand">${h.prizes.map(k=>cardFace(BY_KEY.get(k),`data-key="${esc(k)}"`)).join('')}</div>`;
}
$('#stats').addEventListener('change',e=>{ if(e.target.id==='starterPick'&&e.target.value){ starters.add(e.target.value); store.set('sdl.starters',[...starters]); renderStats(); } });
$('#stats').addEventListener('click',e=>{
  const u=e.target.closest('[data-unstart]'); if(u){ starters.delete(u.dataset.unstart); store.set('sdl.starters',[...starters]); renderStats(); return; }
  if(e.target.closest('[data-hand]')){
    const pool=deck.cards.slice(); if(!pool.some(k=>{ const c=BY_KEY.get(k); return c.sup==='P'&&c.sub.includes('Basic'); })){ toast('Serve almeno un Pokémon Base per pescare una mano'); return; }
    let mull=0, hand;
    for(;;){ for(let i=pool.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [pool[i],pool[j]]=[pool[j],pool[i]]; }
      hand=pool.slice(0,7); if(hand.some(k=>{ const c=BY_KEY.get(k); return c.sup==='P'&&c.sub.includes('Basic'); })) break; mull++; }
    lastHand={hand,prizes:pool.slice(7,13),mull}; $('#handBox').innerHTML=handHtml(lastHand); return;
  }
  const t=e.target.closest('.card[data-key]'); if(t) select(BY_KEY.get(t.dataset.key));
});

/* persistence */
let saveT=null;
function persist(now){
  if(!deck.id) return;
  clearTimeout(saveT); setSaved('saving');
  saveT=setTimeout(async ()=>{
    const rec={id:deck.id, name:(deck.name||'Senza nome').trim()||'Senza nome', cards:deck.cards.slice(), updated:Date.now()};
    const ex=App.data.decks.find(d=>d.id===rec.id); if(ex) Object.assign(ex,rec); else App.data.decks.push(rec);
    App.emit('decks'); const ok=await App.Store.put('decks',rec); setSaved(ok?'saved':'error');
  }, now?0:700);
}
function setSaved(st){ const el=$('#savedState'); if(!el) return; el.className='saved '+st; el.textContent = st==='saving'?'Salvataggio…':st==='saved'?'✓ Salvato':st==='error'?'Non salvato':''; }
function changed(){
  if(window.App && App.emit) App.emit('deck');
  store.set('sdl.current',deck); persist();
  if(lastHand && !lastHand.hand.concat(lastHand.prizes).every(k=>deck.cards.includes(k))) lastHand=null;
  renderDeck(); renderDetail(); renderStats();
  document.querySelectorAll('.res').forEach(li=>{ const n=countKey(li.dataset.key), acts=li.querySelector('.acts'), o=acts.querySelector('.owned');
    if(n){ if(o) o.textContent='×'+n; else acts.insertAdjacentHTML('afterbegin',`<span class="owned">×${n}</span>`); } else if(o) o.remove(); });
}
$('#deckName').value=deck.name;
$('#deckName').addEventListener('input',e=>{ deck.name=e.target.value; store.set('sdl.current',deck); persist(); });
$('#status').addEventListener('click',()=>{ if(mq.matches) showTab('deck'); $('#issues').scrollIntoView({block:'nearest'}); });
$('#bUndo').addEventListener('click',undo);
document.addEventListener('keydown',e=>{
  if(App.page!=='deck') return;
  const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!typing&&!dlg.open){ e.preventDefault(); undo(); }
  if(e.key==='/'&&!typing&&!dlg.open){ e.preventDefault(); if(mq.matches) showTab('pool'); $('#q').focus(); }
});

/* export / import (Pokémon TCG Live text format) */
function toList(){
  const g=grouped(), sec=(s,label)=>{ const it=g.filter(x=>x.c.sup===s); if(!it.length) return ''; const tot=it.reduce((a,x)=>a+x.q,0);
    return `${label}: ${tot}\n${it.map(({c,q})=>`${q} ${c.name} ${artOf(c)[0]} ${artOf(c)[1]}`).join('\n')}\n\n`; };
  return sec('P','Pokémon')+sec('T','Trainer')+sec('E','Energy')+`Total Cards: ${deck.cards.length}\n`;
}
/* Read a deck list: Pokémon TCG Live exports (any language), Limitless lists, "4 Name", "4 Name SET 123", "4 Name SET #123". */
const NAMES = (()=>{ try{ return JSON.parse(document.getElementById('namesData').textContent); }catch(e){ return {}; } })();
const ENERGY_WORD = {g:'grass',r:'fire',w:'water',l:'lightning',p:'psychic',f:'fighting',d:'darkness',m:'metal',y:'fairy',
  grass:'grass',fire:'fire',water:'water',lightning:'lightning',psychic:'psychic',fighting:'fighting',darkness:'darkness',metal:'metal',fairy:'fairy',
  erba:'grass',fuoco:'fire',acqua:'water',lampo:'lightning',psico:'psychic',lotta:'fighting','oscurità':'darkness',oscurita:'darkness',metallo:'metal',folletto:'fairy',
  plante:'grass',feu:'fire',eau:'water','électrique':'lightning',electrique:'lightning',psy:'psychic',combat:'fighting','obscurité':'darkness',obscurite:'darkness','métal':'metal',
  planta:'grass',fuego:'fire',agua:'water','rayo':'lightning','psíquica':'psychic',psiquica:'psychic',lucha:'fighting',oscura:'darkness',
  pflanze:'grass',feuer:'fire',wasser:'water',elektro:'lightning',kampf:'fighting',finsternis:'darkness',metall:'metal'};
const norm = s => String(s).toLowerCase().replace(/[’`´]/g,"'").replace(/\s+/g,' ').trim();
function byAnyName(raw){
  const n = norm(raw);
  for(const t of new Set([n, n.replace(/-ex\b/g,' ex'), n.replace(/ ex\b/g,'-ex')])){
    if(BY_NAME.has(t)) return BY_NAME.get(t);
    for(const l in NAMES){ const en=NAMES[l][t]; if(en && BY_NAME.has(en.toLowerCase())) return BY_NAME.get(en.toLowerCase()); }
  }
  // basic Energy in any common spelling: "Basic {G} Energy", "Energia {G} base", "Energia Erba base", "Grass Energy"
  if(/energ/.test(n)){
    const m=n.match(/\{(\w)\}/); const words=n.replace(/[{}]/g,' ').split(/[\s-]+/).filter(w=>!/^(basic|base|di|energy|energia|énergie|energie|energía|de|tipo|type)$/.test(w));
    const key = m ? ENERGY_WORD[m[1]] : (words.length===1 ? ENERGY_WORD[words[0]] : null);
    if(key && BY_NAME.has(key+' energy')) return BY_NAME.get(key+' energy');
  }
  return null;
}
function parseList(text){
  const out=[], unknown=[];
  text.split(/\r?\n/).forEach(line=>{
    const l=line.trim().replace(/^[*•\-–]+\s*/,''); if(!l) return;
    if(/^(pok[eé]mon|trainers?|allenatori|allenatore|energ\w*|total cards|carte totali|totale)\s*[:(]?\s*\d*\s*\)?$/i.test(l)) return;
    if(/^\D[^:]*:\s*\d+$/.test(l)) return; // section headers in any language, e.g. "Carte Allenatore: 14", "Totale carte: 60"
    const m=l.match(/^(\d+)\s*x?\s+(.+?)\s*$/i); if(!m){ unknown.push(l); return; }
    const q=+m[1], rest=m[2];
    let c=null;
    const pm=rest.match(/^(.+?)\s+\(?([A-Za-z0-9]{2,6}(?:-[A-Za-z0-9]{1,4})?)\s*[\s#-]\s*#?([A-Za-z]{0,4}\d{1,4}[a-z]?|[A-Z]{1,3})\)?$/);
    if(pm){
      const byPrint=PRINT_IDX.get((pm[2]+' '+pm[3].replace(/^0+(?=\d)/,'')).toUpperCase()) || PRINT_IDX.get((pm[2]+' '+pm[3]).toUpperCase());
      const byName=byAnyName(pm[1]);
      c = (byPrint && (!byName || byName.name===byPrint.name)) ? byPrint : (byName || byPrint);
    }
    if(!c) c=byAnyName(rest);
    if(c) for(let i=0;i<q;i++) out.push(c.key); else unknown.push(l);
  });
  return {out,unknown};
}
const dlg=$('#dlg'), body=$('#dlgBody');
function openDlg(html,bind){ body.innerHTML=html; bind&&bind(); dlg.showModal(); }
$('#bExport').addEventListener('click',()=>{
  const {issues}=validate();
  openDlg(`<h2>Esporta lista</h2>
    <div class="seg" id="exSeg" role="group" aria-label="Formato"><button type="button" data-ex="text" aria-pressed="true">Testo</button><button type="button" data-ex="img" aria-pressed="false">Immagine</button></div>
    ${issues.length?`<div class="issues bad" style="border-radius:9px;border:0"><div><svg class="i"><use href="#i-warn"/></svg>Il mazzo ha ${issues.length} ${issues.length===1?'problema':'problemi'}: puoi esportarlo comunque.</div></div>`:''}
 <div id="exText"><p class="hint">Formato di Pokémon TCG Live: copia il testo e in TCG Live usa “Importa” nel Deck Manager. Va bene anche per iscrizioni ai tornei e siti di liste.</p>
    <textarea id="lOut" readonly>${esc(toList())}</textarea>
    <div class="row"><span class="hint" id="copyMsg"></span><button class="btn" value="close">Chiudi</button><button type="button" class="btn primary" id="copyL">Copia testo</button></div></div>
    <div id="exImg" hidden></div>`,
  ()=>{ let made=false;
    $('#exSeg').addEventListener('click',e=>{ const b=e.target.closest('[data-ex]'); if(!b) return; const img=b.dataset.ex==='img';
      document.querySelectorAll('#exSeg [data-ex]').forEach(x=>x.setAttribute('aria-pressed',x===b)); $('#exText').hidden=img; $('#exImg').hidden=!img;
      if(img && !made){ made=true; imagePanel($('#exImg'), deck.cards.slice(), deck.name||'Mazzo', `${deck.cards.length} carte · formato Standard`); } });
    $('#copyL').addEventListener('click',()=>{ const ta=$('#lOut'); navigator.clipboard.writeText(ta.value).then(()=>{ $('#copyMsg').textContent='Copiato negli appunti'; }).catch(()=>{ ta.focus(); ta.select(); $('#copyMsg').textContent='Testo selezionato: premi Ctrl+C / ⌘C'; }); }); });
});
$('#bImport').addEventListener('click',()=>{
  let fname='';
  openDlg(`<h2>Importa lista</h2>
    <p class="hint">Incolla una lista esportata da Pokémon TCG Live o da un sito di liste (una carta per riga, ad es. “4 Dreepy TWM 128”). Va bene anche solo “4 Dreepy”, e anche con i nomi in italiano (es. “4 Arbitro UL 78”).</p>
    <div class="drop-file" id="dropF">Trascina qui un file .txt oppure <label for="lFile">sceglilo</label><input type="file" id="lFile" accept=".txt" hidden></div>
    <textarea id="lIn" placeholder="Pokémon: 17&#10;4 Dreepy TWM 128&#10;…"></textarea>
    <div class="implist" id="impList"></div>
    <div class="row"><span class="hint" id="impMsg"></span><button class="btn" value="close">Annulla</button><button type="button" class="btn primary" id="doImp">Importa</button></div>`,
  ()=>{
    const read=f=>{ if(!f) return; fname=f.name.replace(/\.txt$/i,''); const r=new FileReader(); r.onload=()=>{ $('#lIn').value=r.result; }; r.readAsText(f); };
    $('#lFile').addEventListener('change',e=>read(e.target.files[0]));
    const d=$('#dropF'); d.addEventListener('dragover',e=>{ e.preventDefault(); d.classList.add('over'); }); d.addEventListener('dragleave',()=>d.classList.remove('over')); d.addEventListener('drop',e=>{ e.preventDefault(); d.classList.remove('over'); read(e.dataTransfer.files[0]); });
    let confirmed=false;
    $('#lIn').addEventListener('input',()=>{ confirmed=false; $('#doImp').textContent='Importa'; $('#impList').innerHTML=''; });
    $('#doImp').addEventListener('click',()=>{
      const {out,unknown}=parseList($('#lIn').value);
      if(!out.length){ $('#impMsg').textContent='Non ho riconosciuto nessuna carta legale in Standard.'; return; }
      if(unknown.length && !confirmed){
        confirmed=true; $('#impMsg').textContent='';
        $('#impList').innerHTML=`<p class="hint" style="margin:0 0 4px">${unknown.length===1?'Non riconosco questa riga: forse la carta non è legale in Standard o è scritta in modo diverso. Puoi correggerla qui sopra, oppure importare il resto.':'Non riconosco queste '+unknown.length+' righe: forse le carte non sono legali in Standard o sono scritte in modo diverso. Puoi correggerle qui sopra, oppure importare il resto.'}</p><ul>${unknown.map(u=>`<li>${esc(u)}</li>`).join('')}</ul>`;
        $('#doImp').textContent=`Importa le altre ${out.length} carte`; return;
      }
      dlg.close();
      if(dview==='edit' && deck.id){ snapshot('importazione'); deck.cards=out; if(fname) deck.name=fname; $('#deckName').value=deck.name; changed(); }
      else openDeck({id:App.uid(), name:fname||'Mazzo importato', cards:out}, 'edit', true);
      toast(unknown.length?`Importato. ${unknown.length} righe non riconosciute (carte fuori Standard o scritte diversamente).`:'Mazzo importato', true);
    });
  });
});
/* ---------- library: saved decks, new deck, stats view ---------- */
const savedDecks=()=>App.data.decks;
function openDeck(x, v, isNew){
  history.length=0; $('#bUndo').disabled=true; lastHand=null;
  deck=clean({id:x.id||App.uid(), name:x.name, cards:(x.cards||[]).slice()});
  $('#deckName').value=deck.name; closeDrawer();
  if(isNew) persist(true); else setSaved('saved');
  changed(); showView(v||'edit');
}
function openSaved(x){ openDeck(x,'edit'); }
function showView(v){
  dview=v;
  [['lib','#dvLib'],['edit','#dvEdit'],['stats','#dvStats']].forEach(([k,sel])=>{ const el=$(sel); const on=k===v; el.hidden=!on; if(on){ el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); } });
  document.body.classList.toggle('deck-editing', v==='edit');
  if(v==='lib'){ closeDrawer(); renderLib(); }
  if(v==='stats'){ renderStatsView(); }
  if(v==='edit'){ syncTabs(); }
  window.scrollTo({top:0});
}
function deckSummary(d){
  const cs=d.cards.map(k=>BY_KEY.get(k)).filter(Boolean), n=cs.length;
  const p=cs.filter(c=>c.sup==='P').length, t=cs.filter(c=>c.sup==='T').length, e=n-p-t;
  const stars=[...new Map(cs.filter(c=>c.sup==='P'&&(c.sub.includes('ex')||c.sub.includes('Stage 2'))).map(c=>[c.name,c])).values()].slice(0,3);
  return {n,p,t,e,stars,issues:validate(d.cards).issues};
}
/* pixel sprites on the deck cards: up to 2 per deck, chosen by the user (saved in the preferences) or taken from the archetype */
function spriteUrls(c){
  const w=nameWords(c.name), dex=c.dex||0, fb=dex?`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${dex}.png`:'';
  if(w.includes('mega')){ const base=w.filter(x=>!['mega','ex','x','y'].includes(x)).pop(), xy=w.includes('x')?'x':w.includes('y')?'y':'';
    if(base) return [`https://play.pokemonshowdown.com/sprites/gen5/${base}-mega${xy}.png`, fb]; }
  return [fb, ''];
}
const spriteImg = c => { const [u,fb]=spriteUrls(c); return u ? `<img class="spr" src="${u}" alt="${esc(c.name)}" title="${esc(c.name)}" loading="lazy" ${fb?`data-fb="${fb}" `:''}onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.removeAttribute('data-fb');}else this.remove()">` : ''; };
function autoSprites(cards){
  const cs=cards.map(k=>BY_KEY.get(k)).filter(c=>c && c.sup==='P'), cnt=new Map(); cs.forEach(c=>cnt.set(c.name,(cnt.get(c.name)||0)+1));
  const arch=ARCHS.find(a=>a.name===archOf(cards)), out=[];
  (arch&&arch.icons||[]).forEach(ic=>{ const [base,...mods]=ic.split('-'), mega=mods.includes('mega');
    const hit=[...cnt.keys()].filter(n=>{ const w=nameWords(n); return w.includes(base) && mega===w.includes('mega'); }).sort((a,b)=>cnt.get(b)-cnt.get(a))[0];
    if(hit && !out.includes(hit)) out.push(hit); });
  if(!out.length){ const top=[...cnt.keys()].map(n=>BY_NAME.get(n.toLowerCase())).filter(Boolean)
      .sort((a,b)=>((b.sub.includes('ex')||b.sub.includes('Stage 2'))-(a.sub.includes('ex')||a.sub.includes('Stage 2'))) || cnt.get(b.name)-cnt.get(a.name))[0];
    if(top) out.push(top.name); }
  return out.slice(0,2);
}
const chosenSprites = d => { const v=((App.prefs().sprites)||{})[d.id]; return Array.isArray(v) ? v : null; };
function deckSprites(d){ return (chosenSprites(d) || autoSprites(d.cards)).map(n=>BY_NAME.get(String(n).toLowerCase())).filter(Boolean).slice(0,2); }
function pickSprites(d){
  const mons=[...new Map(d.cards.map(k=>BY_KEY.get(k)).filter(c=>c&&c.sup==='P').map(c=>[c.name,c])).values()];
  let sel=(chosenSprites(d)||deckSprites(d).map(c=>c.name)).slice(0,2);
  const draw=()=>{ $('#sprGrid').innerHTML = mons.map(c=>`<button type="button" class="spr-opt" data-spr="${esc(c.name)}" aria-pressed="${sel.includes(c.name)}">${spriteImg(c)}<span>${esc(c.name)}</span></button>`).join('');
    $('#sprMsg').textContent = sel.length ? `Scelti: ${sel.join(' e ')}` : 'Nessuno scelto: il mazzo resta senza sprite'; };
  openDlg(`<h2>Sprite del mazzo</h2><p class="hint">Scegli fino a due Pokémon da mostrare sulla scheda di “${esc(d.name)}”.</p>
    <div class="spr-grid" id="sprGrid"></div>
    <div class="row"><span class="hint" id="sprMsg"></span><button type="button" class="btn" id="sprAuto">Automatico</button><button type="button" class="btn primary" id="sprOk">Salva</button></div>`,
  ()=>{ draw();
    $('#sprGrid').addEventListener('click',e=>{ const b=e.target.closest('[data-spr]'); if(!b) return; const n=b.dataset.spr;
      sel = sel.includes(n) ? sel.filter(x=>x!==n) : [...sel, n].slice(-2); draw(); });
    const save=v=>{ const pr=App.prefs(), m=pr.sprites||(pr.sprites={}); if(v) m[d.id]=v; else delete m[d.id]; App.Store.savePrefs(); dlg.close(); renderLib(); };
    $('#sprAuto').addEventListener('click',()=>save(null)); $('#sprOk').addEventListener('click',()=>save(sel)); });
}
const fmtDay = ms => ms ? new Date(ms).toLocaleDateString('it-IT',{day:'numeric',month:'short'}) : '';
function renderLib(){
  const list=savedDecks().slice().sort((a,b)=>(b.updated||0)-(a.updated||0));
  $('#libGrid').innerHTML = list.length ? list.map(d=>{ const s=deckSummary(d), ok=!s.issues.length;
    return `<article class="libcard" data-id="${esc(d.id)}">
      <div class="lc-top"><button type="button" class="lc-spr" data-lib="sprite" title="Scegli gli sprite del mazzo" aria-label="Scegli gli sprite di ${esc(d.name)}">${deckSprites(d).map(spriteImg).join('')||'<span class="lc-spr-add">+</span>'}</button><h3>${esc(d.name||'Senza nome')}</h3><span class="status ${ok?'ok':'bad'}">${ok?'Legale':s.issues.length+(s.issues.length===1?' problema':' problemi')}</span></div>
      <div class="lc-sub">${s.n}/60 carte${d.updated?' · modificato il '+fmtDay(d.updated):''}</div>
      <div class="split" title="Pokémon ${s.p} · Allenatori ${s.t} · Energie ${s.e}">${s.p?`<span style="width:${s.p/Math.max(1,s.n)*100}%;background:var(--t-Fire)"></span>`:''}${s.t?`<span style="width:${s.t/Math.max(1,s.n)*100}%;background:var(--tr-Item)"></span>`:''}${s.e?`<span style="width:${s.e/Math.max(1,s.n)*100}%;background:var(--t-Lightning)"></span>`:''}</div>
      <div class="lc-counts"><span><i style="background:var(--t-Fire)"></i>Pokémon <b>${s.p}</b></span><span><i style="background:var(--tr-Item)"></i>Allenatori <b>${s.t}</b></span><span><i style="background:var(--t-Lightning)"></i>Energie <b>${s.e}</b></span></div>
      <div class="lc-acts"><button class="btn small primary" type="button" data-lib="edit">Modifica</button><button class="btn small" type="button" data-lib="stats"><svg class="i"><use href="#i-chart"/></svg>Statistiche</button>
        <span class="lc-more"><button class="btn small icon" type="button" data-lib="export" title="Esporta lista" aria-label="Esporta la lista di ${esc(d.name)}"><svg class="i"><use href="#i-out"/></svg></button><button class="btn small icon" type="button" data-lib="dup" title="Duplica" aria-label="Duplica ${esc(d.name)}">⧉</button><button class="btn small icon" type="button" data-lib="del" title="Elimina" aria-label="Elimina ${esc(d.name)}">✕</button></span></div>
    </article>`; }).join('')
    : `<div class="empty-state lib-empty"><b>Nessun mazzo ancora</b>Crea il tuo primo mazzo, importa una lista da TCG Live oppure parti dal mazzo di esempio.<br><br><button class="btn primary" type="button" id="libNew2">Crea il primo mazzo</button></div>`;
}
$('#libGrid').addEventListener('click',async e=>{
  if(e.target.closest('#libNew2')){ $('#libNew').click(); return; }
  const b=e.target.closest('[data-lib]'), card=e.target.closest('.libcard'); if(!card) return;
  const d=savedDecks().find(x=>x.id===card.dataset.id); if(!d) return;
  const act=b?b.dataset.lib:'edit';
  if(act==='sprite'){ pickSprites(d); return; }
  if(act==='edit'||act==='stats'){ openDeck(d, act); return; }
  if(act==='export'){ openDeck(d,'lib'); $('#bExport').click(); return; }
  if(act==='dup'){ const rec={id:App.uid(), name:d.name+' (copia)', cards:d.cards.slice(), updated:Date.now()}; App.data.decks.push(rec); renderLib(); App.emit('decks'); await App.Store.put('decks',rec); toast('Mazzo duplicato'); return; }
  if(act==='del'){
    if(!b.dataset.confirm){ b.dataset.confirm='1'; b.textContent='Elimina?'; b.classList.add('danger'); setTimeout(()=>{ if(b.isConnected){ delete b.dataset.confirm; b.textContent='✕'; b.classList.remove('danger'); } },4000); return; }
    card.classList.add('leaving'); setTimeout(async ()=>{ App.data.decks=App.data.decks.filter(x=>x.id!==d.id); if(deck.id===d.id) deck.id=null; renderLib(); App.emit('decks'); await App.Store.del('decks',d.id); toast('Mazzo eliminato'); },220);
  }
});
$('#libNew').addEventListener('click',()=>{ openDeck({id:App.uid(), name:'Nuovo mazzo', cards:[]}, 'edit', true); setTimeout(()=>$('#deckName').select(),50); });
$('#libSample').addEventListener('click',()=>{ const s=sampleDeck(); openDeck({id:App.uid(), name:s.name, cards:s.cards}, 'edit', true); });
$('#libImport').addEventListener('click',()=>$('#bImport').click());
$('#bStats').addEventListener('click',()=>showView('stats'));
document.querySelectorAll('[data-goto]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.goto)));
function renderStatsView(){
  const s=deckSummary(deck); $('#stTitle').textContent=deck.name||'Senza nome'; $('#stCount').textContent=`${s.n}/60 carte`;
  const g=grouped(), sec=(k,l)=>{ const it=g.filter(x=>x.c.sup===k); if(!it.length) return ''; return `<div class="st-sec"><b>${l} <span class="hint num">${it.reduce((a,x)=>a+x.q,0)}</span></b><ul class="dlist">${it.map(({c,q})=>`<li data-key="${esc(c.key)}"><span class="q">${q}</span><span class="cbar ty-${c.color}"></span><span class="nm">${esc(c.name)}</span><span></span></li>`).join('')}</ul></div>`; };
  $('#stList').innerHTML = s.n ? sec('P','Pokémon')+sec('T','Allenatori')+sec('E','Energie') : '<p class="hint">Il mazzo è vuoto.</p>';
  renderStats();
}
// keep the library in sync with saved decks (account load, other tabs)
App.on(w=>{ if(w==='data' && dview==='lib') renderLib(); if(w==='page' && App.page==='deck'){ showView(pendingView||'lib'); pendingView=null; } });
// an older draft without a saved copy becomes a saved deck, so nothing is lost
(function migrateDraft(){
  const d=store.get('sdl.current',null);
  if(d && !d.id && d.cards && d.cards.length && JSON.stringify(d.cards)!==JSON.stringify(SAMPLE.cards)){ deck=clean({...d, id:App.uid()}); persist(true); }
})();

/* tabs */
const mq=window.matchMedia('(max-width:760px)');
function showTab(t){ document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===t)); ['pool','deck'].forEach(id=>$('#'+id).classList.toggle('on',id===t)); if(mq.matches) window.scrollTo({top:0}); }
$('#tabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) showTab(b.dataset.t); });
function syncTabs(){ if(mq.matches) showTab(document.querySelector('#tabs [aria-selected="true"]')?.dataset.t||'pool'); else ['pool','deck'].forEach(id=>$('#'+id).classList.add('on')); }
mq.addEventListener?mq.addEventListener('change',syncTabs):mq.addListener(syncTabs); syncTabs();

let toastT;
function toast(msg,withUndo){ const t=$('#toast'); t.innerHTML=`<span>${esc(msg)}</span>${withUndo&&history.length?'<button type="button" id="tUndo">Annulla</button>':''}`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3200); const u=$('#tUndo'); if(u) u.addEventListener('click',undo); }

/* archetype of a list, the Limitless way: the archetype's key Pokémon (its icons) must all be in the list;
   among those that fit, the most specific one wins, then the one whose sample list looks most like this one */
function iconHits(icon, mons, lenient){
  const [base,...mods] = icon.split('-'), mega = mods.includes('mega'), extra = mods.filter(m=>m!=='mega');
  // the key Pokémon (a plain icon does not match its Mega form), plus the earlier stages of its line
  const key=[...mons.keys()].filter(name=>{ const w=nameWords(name); if(!w.includes(base)) return false; if(mega!==w.includes('mega')) return false;
    return extra.every(t=>w.some(x=>x.startsWith(t))); });
  if(!key.length) return 0;
  const line=new Set(key); key.forEach(nm=>{ let c=BY_NAME.get(nm.toLowerCase()), g=0; while(c && c.from && g++<3){ line.add(c.from); c=BY_NAME.get(c.from.toLowerCase()); } });
  let n=0; mons.forEach((q,nm)=>{ if(line.has(nm)) n+=q; });
  // a single copy of a non rule-box key Pokémon is just a tech
  const kn=key.reduce((t,nm)=>t+mons.get(nm),0), box=key.some(nm=>{ const w=nameWords(nm); return w.includes('ex')||w.includes('mega'); });
  return kn>=2||box||(lenient && n>=2) ? n : 0;
}
function archOf(keys, typed){
  const cs=(keys||[]).map(k=>BY_KEY.get(k)).filter(Boolean); if(cs.length<20) return '';
  const mons=new Map(); cs.filter(c=>c.sup==='P').forEach(c=>mons.set(c.name,(mons.get(c.name)||0)+1)); if(!mons.size) return '';
  let best=null;
  ARCHS.forEach(a=>{ const icons=a.icons||[]; if(!icons.length) return;
    // the archetype written by the player only needs its key Pokémon line in the list, even as a small part of it
    const isTyped = !!typed && App.archKey(App.archCanon(typed))===App.archKey(App.archCanon(a.name));
    const hits=icons.map(ic=>iconHits(ic,mons,isTyped)); if(hits.some(h=>!h)) return;
    const sample=new Set(((a.list&&a.list.lines)||[]).filter(l=>l.sec==='pokemon').map(l=>l.name));
    let overlap=0; mons.forEach((q,nm)=>{ if(sample.has(nm)) overlap++; });
    // the archetype's key Pokémon should be a big part of the list: count their copies, then specificity and similarity
    let score = hits.reduce((x,y)=>x+y,0) + icons.length*.5 + overlap*.1 + Math.log10(1+(a.games||0))*.05;
    if(isTyped) score+=100;   // the name typed fits the list: keep it
    if(!best || score>best.score) best={name:a.name, score}; });
  return best ? best.name : '';
}
window.DeckLab = { archOf, cardFace, getDeck:()=>deck, validate, BY_KEY, CARDS, kindGrid, imagePanel, artOf, parse:t=>parseList(t), byName:byAnyName,
  openDeck:x=>{ if(x){ openDeck(x,'edit'); pendingView='edit'; } },
  importList:(text,name)=>{ const {out,unknown}=parseList(text); if(!out.length){ toast('Non sono riuscito a leggere la lista'); return; }
    openDeck({id:App.uid(), name, cards:out}, 'edit', true); pendingView='edit';
    toast(unknown.length?`Lista salvata tra i tuoi mazzi: ${unknown.length} carte non riconosciute`:`Lista di ${name} salvata tra i tuoi mazzi`); },
  onData:()=>{ if(dview==='lib') renderLib(); } };
renderResults(); changed(); showView('lib');
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && $('#inspect').classList.contains('open') && !document.querySelector('dialog[open]')) closeDrawer(); });
})();
