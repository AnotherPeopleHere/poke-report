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
  const c = {key:k, name:r.n, sup:r.s, sub:r.st, hp:r.hp, types:r.t, from:r.ef, abilities:r.ab, attacks:r.at, weak:r.w, res:r.r, retreat:r.rc, rules:r.ru, mark:r.rm, dex:r.dex, prints:r.p};
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
const BY_NAME = new Map(); CARDS.forEach(c=>{ const l=c.lname; if(!BY_NAME.has(l)) BY_NAME.set(l,c); });
$('#poolCount').textContent = CARDS.length.toLocaleString('it-IT');

/* state */
const clean = d => ({name:d.name||'Senza nome', cards:(d.cards||[]).filter(k=>BY_KEY.has(k))});
const sampleDeck = () => ({name:SAMPLE.name, cards:SAMPLE.cards.slice()});
let deck = clean(store.get('sdl.current', null) || sampleDeck());
let selected = BY_KEY.get(deck.cards.find(k=>BY_KEY.get(k).name.endsWith(' ex'))||deck.cards[0]) || CARDS[0];
let starters = new Set(store.get('sdl.starters', []));
let view = store.get('sdl.view','grid');
let kind = '', typeSel = new Set(), shown = 120, lastHand = null;
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
      <span class="mini ty-${c.color}">${artSvg(c)}</span><span class="nm">${esc(c.name)}</span>
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
  const li=e.target.closest('.res'); if(li){ select(BY_KEY.get(li.dataset.key)); if(mq.matches) showTab('inspect'); }
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
function grouped(){
  const m=new Map(); deck.cards.forEach(k=>m.set(k,(m.get(k)||0)+1));
  const arr=[...m].map(([k,q])=>({c:BY_KEY.get(k),q}));
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
function validate(){
  const issues=[], bad=new Set(), cs=deck.cards.map(k=>BY_KEY.get(k)), n=cs.length;
  if(n!==60) issues.push(n<60 ? `Il mazzo ha ${n} carte: ne servono esattamente 60 (mancano ${60-n})` : `Il mazzo ha ${n} carte: ne servono esattamente 60`);
  const byName=new Map(); cs.forEach(c=>{ if(!c.isBasicEnergy) byName.set(c.name,(byName.get(c.name)||0)+1); });
  byName.forEach((q,nm)=>{ if(q>4){ issues.push(`${q} carte chiamate “${nm}”: massimo 4`); cs.filter(c=>c.name===nm).forEach(c=>bad.add(c.key)); } });
  const aces=cs.filter(c=>c.isAce); if(aces.length>1){ issues.push(`${aces.length} carte ACE SPEC: massimo 1 in tutto il mazzo`); aces.forEach(c=>bad.add(c.key)); }
  const rad=cs.filter(c=>c.sub.includes('Radiant')); if(rad.length>1){ issues.push('Massimo 1 Pokémon Radioso'); rad.forEach(c=>bad.add(c.key)); }
  if(n && !cs.some(c=>c.sup==='P' && c.sub.includes('Basic'))) issues.push('Serve almeno un Pokémon Base');
  return {issues,bad};
}

/* ---------- generated card illustrations (original, procedural; derived from card data) ---------- */
const ART = new Map();
function hashStr(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rngFrom(s){ let a=hashStr(s); return ()=>{ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
const HUE={Grass:105,Fire:16,Water:205,Lightning:48,Psychic:285,Fighting:24,Darkness:240,Metal:210,Dragon:42,Colorless:38,Fairy:330};
const SAT={Grass:55,Fire:80,Water:70,Lightning:90,Psychic:55,Fighting:45,Darkness:25,Metal:12,Dragon:60,Colorless:18,Fairy:65};
const hsl=(h,s,l,a)=>a==null?`hsl(${h} ${s}% ${l}%)`:`hsl(${h} ${s}% ${l}% / ${a})`;
const f1=n=>Math.round(n*10)/10;
function blob(cx,cy,rx,ry,r,pts,wob){
  const P=[]; for(let i=0;i<pts;i++){ const a=i/pts*Math.PI*2-Math.PI/2, k=1-wob/2+r()*wob; P.push([cx+Math.cos(a)*rx*k, cy+Math.sin(a)*ry*k]); }
  let d=''; for(let i=0;i<pts;i++){ const p=P[i], q=P[(i+1)%pts], m=[(p[0]+q[0])/2,(p[1]+q[1])/2]; d+= (i===0?`M${f1((P[pts-1][0]+p[0])/2)} ${f1((P[pts-1][1]+p[1])/2)}`:'')+`Q${f1(p[0])} ${f1(p[1])} ${f1(m[0])} ${f1(m[1])}`; }
  return d+'Z';
}
function scene(type, r){
  const h=HUE[type]??40, s=SAT[type]??30;
  let g=`<rect width="100" height="72" fill="${hsl(h,s*0.6,type==='Darkness'?22:86)}"/>`;
  g+=`<rect width="100" height="36" fill="${hsl(h,s*0.5,type==='Darkness'?14:93,.7)}"/>`;
  const ground=(l,y)=>`<path d="M0 ${y} Q25 ${y-6-r()*5} 50 ${y-1} T100 ${y-2} V72 H0Z" fill="${hsl(h,s*0.7,l)}"/>`;
  switch(type){
    case 'Grass': g+=`<ellipse cx="${20+r()*20}" cy="62" rx="40" ry="16" fill="${hsl(h,45,58)}"/><ellipse cx="${70+r()*15}" cy="64" rx="42" ry="15" fill="${hsl(h,48,47)}"/>`;
      for(let i=0;i<5;i++){ const x=r()*100,y=10+r()*30,a=r()*180; g+=`<ellipse cx="${f1(x)}" cy="${f1(y)}" rx="3.2" ry="1.4" transform="rotate(${f1(a)} ${f1(x)} ${f1(y)})" fill="${hsl(h,55,45,.55)}"/>`; } break;
    case 'Fire': for(let i=0;i<4;i++){ const x=8+i*28+r()*8, ht=18+r()*16; g+=`<path d="M${f1(x-9)} 60 Q${f1(x-8)} ${f1(60-ht*.6)} ${f1(x)} ${f1(60-ht)} Q${f1(x+3)} ${f1(60-ht*.5)} ${f1(x+9)} 60Z" fill="${hsl(28,95,60,.55)}"/>`; }
      g+=ground(42,62).replace(/hsl\([^)]*\)/,hsl(10,60,32)); break;
    case 'Water': for(let i=0;i<4;i++){ const y=40+i*8; g+=`<path d="M0 ${y} q6 -4 12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 t12.5 0 V72 H0Z" fill="${hsl(h,70,62-i*7,.75)}" transform="translate(${f1(-r()*12)} 0)"/>`; } break;
    case 'Lightning': g+=ground(70,60); for(let i=0;i<3;i++){ const x=10+i*35+r()*12; g+=`<path d="M${f1(x)} 4 l-6 14 h5 l-5 13 l12 -17 h-5 l5 -10z" fill="${hsl(52,95,55,.8)}"/>`; } break;
    case 'Psychic': for(let i=5;i>0;i--) g+=`<circle cx="50" cy="40" r="${i*9}" fill="none" stroke="${hsl(h,55,70,.5)}" stroke-width="2"/>`;
      for(let i=0;i<7;i++) g+=`<circle cx="${f1(r()*100)}" cy="${f1(r()*45)}" r="${f1(.6+r())}" fill="#fff" opacity=".8"/>`; break;
    case 'Fighting': g+=`<path d="M0 50 L18 22 L32 44 L50 18 L66 40 L82 24 L100 46 V72 H0Z" fill="${hsl(h,25,62)}"/>`+ground(40,62); break;
    case 'Darkness': g+=`<circle cx="${f1(70+r()*20)}" cy="14" r="8" fill="${hsl(50,70,85)}"/><circle cx="${f1(74+r()*20)}" cy="11" r="7" fill="${hsl(h,s*0.6,22)}"/>`;
      for(let i=0;i<9;i++) g+=`<circle cx="${f1(r()*100)}" cy="${f1(r()*36)}" r="${f1(.3+r()*.6)}" fill="#fff" opacity=".85"/>`; g+=ground(14,62); break;
    case 'Metal': for(let x=-5;x<105;x+=10) g+=`<path d="M${x} 0 V72" stroke="${hsl(h,15,72)}" stroke-width=".6"/>`; for(let y=4;y<72;y+=10) g+=`<path d="M0 ${y} H100" stroke="${hsl(h,15,72)}" stroke-width=".6"/>`; g+=ground(55,62); break;
    case 'Dragon': for(let i=0;i<3;i++) g+=`<path d="M${f1(-10+r()*20)} ${f1(14+i*12)} q30 -12 60 0 t60 0" fill="none" stroke="${hsl(35,60,70,.6)}" stroke-width="4" stroke-linecap="round"/>`; g+=ground(48,62); break;
    case 'Fairy': for(let i=0;i<6;i++){ const x=r()*100,y=r()*40; g+=`<path d="M${f1(x)} ${f1(y-2.5)} l1 1.5 l1.5 1 l-1.5 1 l-1 1.5 l-1 -1.5 l-1.5 -1 l1.5 -1z" fill="#fff" opacity=".9"/>`; } g+=ground(78,62); break;
    default: for(let i=0;i<3;i++){ const x=10+i*35+r()*10,y=10+r()*14; g+=`<g fill="#fff" opacity=".85"><circle cx="${f1(x)}" cy="${f1(y)}" r="5"/><circle cx="${f1(x+6)}" cy="${f1(y-2)}" r="6"/><circle cx="${f1(x+12)}" cy="${f1(y)}" r="5"/></g>`; } g+=ground(68,62);
  }
  return g;
}
function creature(c){
  const type=c.types[0]||'Colorless', root=rootOf(c), r=rngFrom('line:'+root), rd=rngFrom('card:'+c.name+c.key);
  const stage=c.sub.includes('Stage 2')?2:c.sub.includes('Stage 1')?1:0;
  const sc=[.68,.84,1][stage]*(c.sub.includes('ex')?1.06:1);
  let h=(HUE[type]??40)+(r()*40-20), s=Math.max(15,(SAT[type]??30)+(r()*20-10));
  if(type==='Metal'||type==='Colorless') s=10+r()*25;
  const lMain=type==='Darkness'?32:55+r()*12, body=hsl(f1(h),f1(s),f1(lMain)), dark=hsl(f1(h),f1(s),f1(lMain-18)), light=hsl(f1(h),f1(s*.6),f1(Math.min(92,lMain+28)));
  const acc=hsl(f1((h+150+r()*60)%360),70,60);
  const cx=50, cy=44-stage*1.5, rx=20*sc*(0.85+r()*0.3), ry=18.5*sc*(0.85+r()*0.3);
  const ear=Math.floor(r()*5), eyes=r()<.08?1:r()<.06?3:2, eyeR=1.6+r()*1.6, mouth=Math.floor(r()*3), tail=Math.floor(r()*4), pat=Math.floor(r()*3), wings=stage===2 && r()<.5;
  let g=`<ellipse cx="50" cy="${f1(cy+ry+3)}" rx="${f1(rx*.9)}" ry="2.6" fill="rgba(0,0,0,.22)"/>`;
  if(c.sub.includes('ex')||c.sub.includes('MEGA')) g+=`<circle cx="${cx}" cy="${f1(cy)}" r="${f1(Math.max(rx,ry)+7)}" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="2 3" opacity=".75"/><circle cx="${cx}" cy="${f1(cy)}" r="${f1(Math.max(rx,ry)+4)}" fill="${hsl(f1(h),80,80,.35)}"/>`;
  if(wings) g+=`<path d="M${f1(cx-rx*.6)} ${f1(cy-ry*.2)} Q${f1(cx-rx*2)} ${f1(cy-ry*1.6)} ${f1(cx-rx*1.9)} ${f1(cy+ry*.2)} Q${f1(cx-rx*1.2)} ${f1(cy)} ${f1(cx-rx*.6)} ${f1(cy+ry*.3)}Z" fill="${light}" stroke="${dark}" stroke-width=".8"/>`
                + `<path d="M${f1(cx+rx*.6)} ${f1(cy-ry*.2)} Q${f1(cx+rx*2)} ${f1(cy-ry*1.6)} ${f1(cx+rx*1.9)} ${f1(cy+ry*.2)} Q${f1(cx+rx*1.2)} ${f1(cy)} ${f1(cx+rx*.6)} ${f1(cy+ry*.3)}Z" fill="${light}" stroke="${dark}" stroke-width=".8"/>`;
  // tail
  const tx=cx+rx*.85, ty=cy+ry*.3;
  if(tail===1) g+=`<path d="M${f1(tx)} ${f1(ty)} l6 -3 l-2 -4 l6 -2 l-1 -5 l5 -1" fill="none" stroke="${dark}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round"/>`;
  if(tail===2) g+=`<path d="M${f1(tx)} ${f1(ty)} q8 0 9 -9" fill="none" stroke="${body}" stroke-width="3" stroke-linecap="round"/><circle cx="${f1(tx+9)}" cy="${f1(ty-10)}" r="3.2" fill="${type==='Fire'?hsl(30,95,58):acc}"/>`;
  if(tail===3) g+=`<path d="M${f1(tx-2)} ${f1(ty)} q10 4 12 -6 q-4 3 -9 1" fill="${dark}"/>`;
  // ears / horns
  const ex=rx*.55, ey=cy-ry*.75;
  if(ear===1) g+=`<path d="M${f1(cx-ex-4)} ${f1(ey+3)} L${f1(cx-ex-1)} ${f1(ey-9*sc)} L${f1(cx-ex+5)} ${f1(ey+1)}Z M${f1(cx+ex+4)} ${f1(ey+3)} L${f1(cx+ex+1)} ${f1(ey-9*sc)} L${f1(cx+ex-5)} ${f1(ey+1)}Z" fill="${dark}"/>`;
  if(ear===2) g+=`<circle cx="${f1(cx-ex)}" cy="${f1(ey)}" r="${f1(4.5*sc)}" fill="${dark}"/><circle cx="${f1(cx+ex)}" cy="${f1(ey)}" r="${f1(4.5*sc)}" fill="${dark}"/>`;
  if(ear===3) g+=`<ellipse cx="${f1(cx-ex*.7)}" cy="${f1(ey-7*sc)}" rx="2.6" ry="${f1(9*sc)}" fill="${body}" stroke="${dark}" stroke-width=".8" transform="rotate(-12 ${f1(cx-ex*.7)} ${f1(ey)})"/><ellipse cx="${f1(cx+ex*.7)}" cy="${f1(ey-7*sc)}" rx="2.6" ry="${f1(9*sc)}" fill="${body}" stroke="${dark}" stroke-width=".8" transform="rotate(12 ${f1(cx+ex*.7)} ${f1(ey)})"/>`;
  if(ear===4) g+=`<path d="M${f1(cx-3)} ${f1(cy-ry+2)} q-2 -10 -8 -12 q4 6 2 13Z M${f1(cx+3)} ${f1(cy-ry+2)} q2 -10 8 -12 q-4 6 -2 13Z" fill="${hsl(40,30,88)}" stroke="${dark}" stroke-width=".6"/>`;
  // feet
  g+=`<ellipse cx="${f1(cx-rx*.45)}" cy="${f1(cy+ry*.92)}" rx="${f1(3.6*sc+1)}" ry="2.4" fill="${dark}"/><ellipse cx="${f1(cx+rx*.45)}" cy="${f1(cy+ry*.92)}" rx="${f1(3.6*sc+1)}" ry="2.4" fill="${dark}"/>`;
  // body
  g+=`<path d="${blob(cx,cy,rx,ry,r,9,.22)}" fill="${body}" stroke="${dark}" stroke-width="1"/>`;
  if(pat===0) g+=`<ellipse cx="${cx}" cy="${f1(cy+ry*.3)}" rx="${f1(rx*.55)}" ry="${f1(ry*.45)}" fill="${light}"/>`;
  if(pat===1) for(let i=0;i<3;i++) g+=`<circle cx="${f1(cx-rx*.5+rd()*rx)}" cy="${f1(cy+rd()*ry*.5)}" r="${f1(1.4+rd()*1.6)}" fill="${dark}" opacity=".55"/>`;
  if(pat===2) g+=`<path d="M${f1(cx-rx*.7)} ${f1(cy+2)} q${f1(rx*.7)} 4 ${f1(rx*1.4)} 0" fill="none" stroke="${dark}" stroke-width="1.6" opacity=".6"/>`;
  if(c.sub.includes('Tera')) g+=`<path d="M${f1(cx-5)} ${f1(cy-ry+1)} l3 -8 l3 6 l3 -9 l3 11Z" fill="${hsl(190,80,85,.9)}" stroke="#fff" stroke-width=".6"/>`;
  if(c.sub.includes('MEGA')) g+=`<path d="M${f1(cx-6)} ${f1(cy-ry-1)} l2 -7 l4 4 l4 -4 l2 7Z" fill="${hsl(46,95,58)}" stroke="${hsl(30,80,35)}" stroke-width=".6"/>`;
  // face
  const fy=cy-ry*.18, gap=rx*.36;
  const eyeXs = eyes===1?[cx]:eyes===2?[cx-gap,cx+gap]:[cx-gap*1.2,cx,cx+gap*1.2];
  const angry = c.sub.includes('ex') && r()<.5;
  eyeXs.forEach(x=>{ g+=`<ellipse cx="${f1(x)}" cy="${f1(fy)}" rx="${f1(eyeR)}" ry="${f1(eyeR*1.15)}" fill="#fff" stroke="${dark}" stroke-width=".5"/><circle cx="${f1(x+.3)}" cy="${f1(fy+.3)}" r="${f1(eyeR*.55)}" fill="#1b1d26"/><circle cx="${f1(x+.8)}" cy="${f1(fy-.5)}" r="${f1(eyeR*.2)}" fill="#fff"/>`;
    if(angry) g+=`<path d="M${f1(x-eyeR*1.3)} ${f1(fy-eyeR*1.6)} L${f1(x+eyeR*1.1)} ${f1(fy-eyeR*.9)}" stroke="#1b1d26" stroke-width="1" ${x<cx?'':`transform="scale(-1 1) translate(${f1(-2*x)} 0)"`}/>`; });
  const my=fy+eyeR*2.3;
  if(mouth===0) g+=`<path d="M${f1(cx-3)} ${f1(my)} q3 2.6 6 0" fill="none" stroke="#1b1d26" stroke-width=".9" stroke-linecap="round"/>`;
  if(mouth===1) g+=`<path d="M${f1(cx-2.6)} ${f1(my-.4)} q2.6 4 5.2 0Z" fill="#7a2230"/>`;
  if(mouth===2) g+=`<path d="M${f1(cx-3)} ${f1(my)} h6" stroke="#1b1d26" stroke-width=".9" stroke-linecap="round"/><path d="M${f1(cx-2)} ${f1(my)} l.7 1.6 l.7 -1.6 M${f1(cx+.6)} ${f1(my)} l.7 1.6 l.7 -1.6" fill="#fff" stroke="#fff" stroke-width=".3"/>`;
  if(r()<.5) g+=`<ellipse cx="${f1(cx-gap-2.5)}" cy="${f1(my-.6)}" rx="1.8" ry="1" fill="${hsl(350,80,70,.6)}"/><ellipse cx="${f1(cx+gap+2.5)}" cy="${f1(my-.6)}" rx="1.8" ry="1" fill="${hsl(350,80,70,.6)}"/>`;
  return g;
}
function trainerArt(c){
  const r=rngFrom('tr:'+c.name), k=c.trainerKind, nm=c.lname;
  const bgH={Supporter:28,Item:215,Tool:275,Stadium:140}[k];
  let g=`<rect width="100" height="72" fill="${hsl(bgH,55,84)}"/>`;
  for(let i=0;i<10;i++) g+=`<path d="M50 40 L${f1(50+Math.cos(i/10*Math.PI*2)*90)} ${f1(40+Math.sin(i/10*Math.PI*2)*90)} L${f1(50+Math.cos((i+.5)/10*Math.PI*2)*90)} ${f1(40+Math.sin((i+.5)/10*Math.PI*2)*90)}Z" fill="${hsl(bgH,60,90,.7)}"/>`;
  if(k==='Supporter'){
    const skin=hsl(f1(20+r()*15),f1(35+r()*30),f1(45+r()*35)), hair=hsl(f1(r()*360),f1(30+r()*50),f1(18+r()*55)), outfit=hsl(f1(r()*360),55,48), hs=Math.floor(r()*4);
    g+=`<path d="M26 72 Q30 50 50 48 Q70 50 74 72Z" fill="${outfit}"/><path d="M44 50 L50 58 L56 50" fill="${hsl(0,0,96)}"/>`;
    if(hs===1) g+=`<path d="M35 32 Q34 56 40 60 L60 60 Q66 56 65 32Z" fill="${hair}"/>`;
    g+=`<rect x="46" y="42" width="8" height="8" fill="${skin}"/><ellipse cx="50" cy="33" rx="11" ry="12.5" fill="${skin}"/>`;
    g+=[`<path d="M38.5 31 Q40 18 50 18 Q61 18 61.5 31 Q56 25 50 26 Q43 25 38.5 31Z" fill="${hair}"/>`,
        `<path d="M38.5 33 Q38 18 50 18 Q62 18 61.5 33 Q58 24 50 24 Q42 24 38.5 33Z" fill="${hair}"/>`,
        `<path d="M38 30 L40 16 L45 22 L50 13 L55 22 L60 16 L62 30 Q50 22 38 30Z" fill="${hair}"/>`,
        `<circle cx="50" cy="16" r="5" fill="${hair}"/><path d="M38.5 31 Q40 19 50 19 Q61 19 61.5 31 Q50 24 38.5 31Z" fill="${hair}"/>`][hs];
    g+=`<circle cx="45.5" cy="34" r="1.3" fill="#1b1d26"/><circle cx="54.5" cy="34" r="1.3" fill="#1b1d26"/><path d="M47 39 q3 2 6 0" fill="none" stroke="#1b1d26" stroke-width=".9" stroke-linecap="round"/>`;
    if(r()<.3) g+=`<g fill="none" stroke="#1b1d26" stroke-width=".8"><circle cx="45.5" cy="34" r="3"/><circle cx="54.5" cy="34" r="3"/><path d="M48.5 34 h3"/></g>`;
    if(r()<.25) g+=`<path d="M36 26 Q50 12 64 26 Z" fill="${hsl(f1(r()*360),60,45)}"/><rect x="33" y="25" width="34" height="3" rx="1.5" fill="${hsl(f1(r()*360),60,35)}"/>`;
  } else if(k==='Item'){
    const col=hsl(f1(r()*360),70,52), col2=hsl(f1(r()*360),60,40);
    if(/ball|poffin/.test(nm)){ g+=`<circle cx="50" cy="38" r="17" fill="${col}" stroke="#1b1d26" stroke-width="1.4"/><path d="M36 28 Q50 46 66 44" fill="none" stroke="${hsl(0,0,100,.75)}" stroke-width="5" stroke-linecap="round"/><circle cx="43" cy="31" r="3" fill="#fff" opacity=".85"/>`+(/ultra/.test(nm)?`<path d="M38 52 l6 -8 l6 8 l6 -8 l6 8" fill="none" stroke="${hsl(50,95,55)}" stroke-width="2.4" stroke-linejoin="round"/>`:''); }
    else if(/candy/.test(nm)) g+=`<path d="M30 30 l8 8 l-8 8 Z M70 30 l-8 8 l8 8Z" fill="${col2}"/><ellipse cx="50" cy="38" rx="13" ry="10" fill="${col}" stroke="#1b1d26" stroke-width="1"/><path d="M42 33 q8 10 16 0" fill="none" stroke="#fff" stroke-width="1.6" opacity=".7"/>`;
    else if(/switch|cart|cyclone/.test(nm)) g+=`<path d="M28 32 H62 L56 24 M72 46 H38 L44 54" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;
    else if(/rod|stretcher|stick/.test(nm)) g+=`<path d="M30 58 L68 18" stroke="${col2}" stroke-width="4" stroke-linecap="round"/><circle cx="68" cy="18" r="4" fill="${col}"/><path d="M68 18 q8 20 -4 34" fill="none" stroke="#1b1d26" stroke-width=".6" stroke-dasharray="1.5 1.5"/>`;
    else if(/pad|gear|phone|scope|radar/.test(nm)) g+=`<rect x="36" y="20" width="28" height="38" rx="5" fill="${col2}" stroke="#1b1d26" stroke-width="1"/><rect x="40" y="25" width="20" height="22" rx="2" fill="${hsl(190,70,75)}"/><circle cx="50" cy="52" r="2.4" fill="#f4f4f6"/>`;
    else if(/energy|retrieval|search/.test(nm)) g+=`<circle cx="50" cy="38" r="15" fill="${col}"/><path d="M50 26 l-6 13 h6 l-3 11 l10 -15 h-6 l3 -9z" fill="#fff"/>`;
    else if(/potion|heal|vital|spray/.test(nm)) g+=`<rect x="44" y="18" width="12" height="8" rx="2" fill="${col2}"/><path d="M40 30 Q40 26 46 26 H54 Q60 26 60 30 V54 Q60 58 56 58 H44 Q40 58 40 54Z" fill="${col}" stroke="#1b1d26" stroke-width="1"/><rect x="43" y="38" width="14" height="9" rx="2" fill="#fff" opacity=".85"/>`;
    else { const v=Math.floor(r()*3);
      g+=[`<path d="M34 30 Q34 22 50 22 Q66 22 66 30 V54 H34Z" fill="${col}" stroke="#1b1d26" stroke-width="1"/><rect x="40" y="36" width="20" height="10" rx="2" fill="${col2}"/><path d="M42 22 q8 -8 16 0" fill="none" stroke="#1b1d26" stroke-width="1.6"/>`,
          `<rect x="32" y="28" width="36" height="24" rx="3" fill="${col}" stroke="#1b1d26" stroke-width="1"/><path d="M32 36 H68" stroke="${col2}" stroke-width="4"/><rect x="46" y="33" width="8" height="7" fill="${hsl(50,90,60)}"/>`,
          `<path d="M50 18 L64 40 L50 60 L36 40Z" fill="${col}" stroke="#1b1d26" stroke-width="1"/><path d="M50 18 L50 60 M36 40 H64" stroke="#fff" stroke-width=".8" opacity=".6"/>`][v]; }
  } else if(k==='Tool'){
    const gem=hsl(f1(r()*360),75,55);
    if(/belt/.test(nm)) g+=`<rect x="18" y="32" width="64" height="12" rx="3" fill="${hsl(25,50,35)}"/><rect x="42" y="29" width="16" height="18" rx="3" fill="none" stroke="${hsl(45,80,55)}" stroke-width="3"/>`;
    else if(/cape|cloak/.test(nm)) g+=`<path d="M38 20 H62 L72 60 Q50 54 28 60Z" fill="${gem}" stroke="#1b1d26" stroke-width="1"/><circle cx="50" cy="22" r="3" fill="${hsl(45,85,55)}"/>`;
    else g+=`<path d="M38 14 Q50 30 62 14" fill="none" stroke="${hsl(45,70,50)}" stroke-width="1.6"/><path d="M50 26 L62 40 L50 58 L38 40Z" fill="${gem}" stroke="${hsl(45,80,40)}" stroke-width="2"/><path d="M44 38 L50 30 L52 36" fill="none" stroke="#fff" stroke-width="1.2" opacity=".8"/>`;
  } else {
    const col=hsl(f1(r()*360),35,55), col2=hsl(f1(r()*360),45,40);
    g+=`<path d="M0 58 Q50 50 100 58 V72 H0Z" fill="${hsl(120,35,45)}"/>`;
    if(/tower|watchtower/.test(nm)) g+=`<path d="M42 58 L45 14 H55 L58 58Z" fill="${col}" stroke="#1b1d26" stroke-width=".8"/><path d="M40 14 H60 L56 8 H44Z" fill="${col2}"/><rect x="47.5" y="22" width="5" height="6" fill="${hsl(50,90,70)}"/>`;
    else if(/depth|cave|ruin|zone|area/.test(nm)) g+=`<path d="M10 58 Q50 4 90 58Z" fill="${col2}"/><path d="M34 58 Q50 30 66 58Z" fill="#1b1d26"/>`;
    else { const wN=2+Math.floor(r()*3); g+=`<rect x="22" y="30" width="56" height="28" fill="${col}" stroke="#1b1d26" stroke-width=".8"/><path d="M18 30 L50 14 L82 30Z" fill="${col2}"/>`;
      for(let i=0;i<wN;i++) g+=`<rect x="${f1(28+i*(44/wN))}" y="36" width="7" height="7" fill="${hsl(50,85,72)}"/>`; g+=`<rect x="45" y="46" width="10" height="12" fill="${col2}"/>`; }
  }
  return g;
}
function energyArt(c){
  const t=c.isBasicEnergy?c.color:null, h=t?(HUE[t]??40):300;
  let g=`<rect width="100" height="72" fill="${hsl(h,t?(SAT[t]??30)*.7:30,t==='Darkness'?30:72)}"/>`;
  for(let i=0;i<14;i++) g+=`<path d="M50 36 L${f1(50+Math.cos(i/14*Math.PI*2)*90)} ${f1(36+Math.sin(i/14*Math.PI*2)*90)} L${f1(50+Math.cos((i+.5)/14*Math.PI*2)*90)} ${f1(36+Math.sin((i+.5)/14*Math.PI*2)*90)}Z" fill="#fff" opacity=".18"/>`;
  return g;
}
function artSvg(c){
  if(ART.has(c.key)) return ART.get(c.key);
  let inner;
  if(c.sup==='P'){ const t=c.types[0]||'Colorless'; inner=scene(t, rngFrom('bg:'+c.key))+creature(c); }
  else if(c.sup==='T') inner=trainerArt(c);
  else inner=energyArt(c);
  const svg=`<svg class="c-svg" viewBox="0 0 100 72" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${inner}</svg>`;
  ART.set(c.key, svg); return svg;
}

/* card face (js) */
function costDots(cost, big){ return cost.map(t=>`<i class="ty-${t}" title="${TYPE_IT[t]||t}"${big?' style="width:14px;height:14px;border-radius:50%;display:inline-block"':''}></i>`).join(''); }
function cardFace(c, attrs, extra){
  let top, art, mid='', foot;
  if(c.sup==='P'){
    top = `<span class="c-name">${esc(c.name)}</span><span class="c-hp">${c.hp}</span><span class="dot ty-${c.color}">${TYPE_L[c.color]||''}</span>`;
    art = `${artSvg(c)}<span class="c-stage">${SUB_IT[stageOf(c)]||''}</span>${c.sub.includes('ex')?'<span class="c-ex">ex</span>':''}`;
    const rows = [...c.abilities.slice(0,1).map(a=>`<span><em style="font-style:normal;color:#c8343f;font-weight:800">AB</em> ${esc(a[0])}</span>`), ...c.attacks.slice(0,2).map(a=>`<span>${a[1].map(t=>`<i class="ty-${t}"></i>`).join('')} ${esc(a[0])}<b>${esc(a[2])}</b></span>`)];
    mid = rows.length ? `<span class="c-atk">${rows.join('')}</span>` : '';
    foot = `Rit. ${c.retreat}${c.weak.length?' · Deb. '+esc(TYPE_IT[c.weak[0].split(' ')[0]]||''):''}`;
  } else if(c.sup==='T'){
    top = `<span class="c-name">${esc(c.name)}</span>`;
    art = `${artSvg(c)}${c.isAce?'<span class="c-ace">ACE SPEC</span>':''}`;
    foot = SUB_IT[c.sub.find(s=>SUB_IT[s])]||'Allenatore';
  } else {
    top = `<span class="c-name">${esc(c.name)}</span>`;
    art = `${artSvg(c)}<span class="c-sym ty-${c.isBasicEnergy?c.color:'Energy'}">${c.isBasicEnergy?(TYPE_L[c.color]||'E'):'★'}</span>${c.isAce?'<span class="c-ace">ACE SPEC</span>':''}`;
    foot = c.isBasicEnergy?'Energia base':'Energia speciale';
  }
  return `<div class="card ty-${c.color}${c.sup!=='P'?' trainer':''}${extra&&extra.cls?' '+extra.cls:''}" ${attrs||''} title="${esc(c.name)}">
    <span class="c-top">${top}</span><span class="c-art">${art}</span>${mid}<span class="c-foot">${foot}</span>${extra&&extra.inner||''}</div>`;
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
    else body=`<ul class="dlist">${items.map(({c,q})=>`<li data-key="${esc(c.key)}" class="${bad.has(c.key)?'illegal':''}" draggable="true"><span class="q">${q}</span><span class="bar ty-${c.color}"></span><span class="nm">${esc(c.name)}<small>${esc(c.prints[0][0]+' '+c.prints[0][1])}</small></span><span class="ctl"><button type="button" data-minus="${esc(c.key)}" aria-label="Togli una copia di ${esc(c.name)}">−</button><button type="button" data-plus="${esc(c.key)}" aria-label="Aggiungi una copia di ${esc(c.name)}">+</button></span></li>`).join('')}</ul>`;
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
function select(c){ selected=c; renderDetail(); document.querySelectorAll('.res.sel').forEach(x=>x.classList.remove('sel')); const li=document.querySelector(`.res[data-key="${CSS.escape(c.key)}"]`); if(li) li.classList.add('sel'); }
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
  $('#detail').innerHTML = `<div class="big">${cardFace(c,'')}<div style="min-width:0">
      <h2 class="cd-name">${esc(c.name)}</h2><div class="cd-type">${typeLine}</div>
      <div class="cd-stats">${chips}</div>
      <div class="cd-stats"><span class="chip">Regulation <b>${c.mark||'—'}</b></span><span class="chip"><b class="num">${esc(c.prints[0][0])} ${esc(c.prints[0][1])}</b></span></div>
      <div class="cd-stats"><a class="lt-link" href="${ltUrl(c.prints[0])}" target="_blank" rel="noopener">Vedi la carta su Limitless ↗</a></div>
    </div></div>
    <div class="blocks">${blocks}</div>${wrrBlock}
    <div class="cd-acts"><button type="button" class="btn small primary" data-d="add">+ Aggiungi</button><button type="button" class="btn small" data-d="rm" ${countKey(c.key)?'':'disabled'}>− Togli</button>${pips}</div>
    ${c.sup==='P' && count(c)!==countKey(c.key) ? `<p class="hint">Il limite di 4 copie vale per il nome: conta anche altre versioni di “${esc(c.name)}” nel mazzo.</p>` : ''}
    <details class="prints"><summary>${c.prints.length} ${c.prints.length===1?'stampa':'stampe'} di questa carta</summary><table>${c.prints.map(p=>`<tr><td class="c"><a href="${ltUrl(p)}" target="_blank" rel="noopener" title="Apri su Limitless">${esc(p[0])} ${esc(p[1])} ↗</a></td><td>${esc(p[2])}</td><td>${esc(p[4]||'')}</td><td class="c">${esc(p[5]||'—')}</td></tr>`).join('')}</table></details>`;
}
$('#detail').addEventListener('click',e=>{ const b=e.target.closest('[data-d]'); if(!b) return; if(b.dataset.d==='add') addCard(selected.key); else removeOne(selected.key); });

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
function changed(){
  if(window.App && App.emit) App.emit('deck');
  store.set('sdl.current',deck);
  if(lastHand && !lastHand.hand.concat(lastHand.prizes).every(k=>deck.cards.includes(k))) lastHand=null;
  renderDeck(); renderDetail(); renderStats();
  document.querySelectorAll('.res').forEach(li=>{ const n=countKey(li.dataset.key), acts=li.querySelector('.acts'), o=acts.querySelector('.owned');
    if(n){ if(o) o.textContent='×'+n; else acts.insertAdjacentHTML('afterbegin',`<span class="owned">×${n}</span>`); } else if(o) o.remove(); });
}
$('#deckName').value=deck.name;
$('#deckName').addEventListener('input',e=>{ deck.name=e.target.value; store.set('sdl.current',deck); });
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
    return `${label}: ${tot}\n${it.map(({c,q})=>`${q} ${c.name} ${c.prints[0][0]} ${c.prints[0][1]}`).join('\n')}\n\n`; };
  return sec('P','Pokémon')+sec('T','Trainer')+sec('E','Energy')+`Total Cards: ${deck.cards.length}\n`;
}
function parseList(text){
  const out=[], unknown=[];
  text.split(/\r?\n/).forEach(line=>{
    const l=line.trim().replace(/^\*+\s*/,''); if(!l) return;
    if(/^(pok[eé]mon|trainer|energy|total cards)\s*[:(]/i.test(l)) return;
    const m=l.match(/^(\d+)\s*x?\s+(.+?)\s*$/i); if(!m){ unknown.push(l); return; }
    const q=+m[1]; let rest=m[2], c=null;
    const pm=rest.match(/^(.+?)\s+([A-Z0-9]{2,6})\s+([A-Za-z0-9-]+)$/);
    if(pm){ c=PRINT_IDX.get((pm[2]+' '+pm[3]).toUpperCase()); if(c && c.lname!==pm[1].toLowerCase() && !(c.isBasicEnergy)) { const byN=BY_NAME.get(pm[1].toLowerCase()); if(byN) c=byN; } if(!c) c=BY_NAME.get(pm[1].toLowerCase()); }
    if(!c){ let nm=rest.toLowerCase().replace(/^basic\s+\{?(\w)\}?\s+energy.*/,(_,x)=>({g:'grass',r:'fire',w:'water',l:'lightning',p:'psychic',f:'fighting',d:'darkness',m:'metal'}[x]||x)+' energy').replace(/^basic\s+/,''); c=BY_NAME.get(nm); }
    if(c) for(let i=0;i<q;i++) out.push(c.key); else unknown.push(l);
  });
  return {out,unknown};
}
const dlg=$('#dlg'), body=$('#dlgBody');
function openDlg(html,bind){ body.innerHTML=html; bind&&bind(); dlg.showModal(); }
$('#bExport').addEventListener('click',()=>{
  const {issues}=validate();
  openDlg(`<h2>Esporta lista</h2>
    ${issues.length?`<div class="issues bad" style="border-radius:9px;border:0"><div><svg class="i"><use href="#i-warn"/></svg>Il mazzo ha ${issues.length} ${issues.length===1?'problema':'problemi'}: puoi esportarlo comunque.</div></div>`:''}
    <p class="hint">Formato di Pokémon TCG Live: copia il testo e in TCG Live usa “Importa” nel Deck Manager. Va bene anche per iscrizioni ai tornei e siti di liste.</p>
    <textarea id="lOut" readonly>${esc(toList())}</textarea>
    <div class="row"><span class="hint" id="copyMsg"></span><button class="btn" value="close">Chiudi</button><button type="button" class="btn primary" id="copyL">Copia testo</button></div>`,
  ()=>{ $('#copyL').addEventListener('click',()=>{ const ta=$('#lOut'); navigator.clipboard.writeText(ta.value).then(()=>{ $('#copyMsg').textContent='Copiato negli appunti'; }).catch(()=>{ ta.focus(); ta.select(); $('#copyMsg').textContent='Testo selezionato: premi Ctrl+C / ⌘C'; }); }); });
});
$('#bImport').addEventListener('click',()=>{
  let fname='';
  openDlg(`<h2>Importa lista</h2>
    <p class="hint">Incolla una lista esportata da Pokémon TCG Live o da un sito di liste (una carta per riga, ad es. “4 Dreepy TWM 128”). Va bene anche solo “4 Dreepy”.</p>
    <div class="drop-file" id="dropF">Trascina qui un file .txt oppure <label for="lFile">sceglilo</label><input type="file" id="lFile" accept=".txt" hidden></div>
    <textarea id="lIn" placeholder="Pokémon: 17&#10;4 Dreepy TWM 128&#10;…"></textarea>
    <div class="row"><span class="hint" id="impMsg"></span><button class="btn" value="close">Annulla</button><button type="button" class="btn primary" id="doImp">Importa</button></div>`,
  ()=>{
    const read=f=>{ if(!f) return; fname=f.name.replace(/\.txt$/i,''); const r=new FileReader(); r.onload=()=>{ $('#lIn').value=r.result; }; r.readAsText(f); };
    $('#lFile').addEventListener('change',e=>read(e.target.files[0]));
    const d=$('#dropF'); d.addEventListener('dragover',e=>{ e.preventDefault(); d.classList.add('over'); }); d.addEventListener('dragleave',()=>d.classList.remove('over')); d.addEventListener('drop',e=>{ e.preventDefault(); d.classList.remove('over'); read(e.dataTransfer.files[0]); });
    $('#doImp').addEventListener('click',()=>{
      const {out,unknown}=parseList($('#lIn').value);
      if(!out.length){ $('#impMsg').textContent='Non ho riconosciuto nessuna carta legale in Standard.'; return; }
      snapshot('importazione'); deck={name:fname||'Mazzo importato',cards:out}; $('#deckName').value=deck.name; dlg.close(); changed();
      toast(unknown.length?`Importato. ${unknown.length} righe non riconosciute (carte fuori Standard o scritte diversamente).`:'Mazzo importato', true);
    });
  });
});
const savedDecks=()=>App.data.decks;
function openSaved(x){ snapshot('apertura mazzo'); deck=clean({name:x.name,cards:x.cards.slice()}); $('#deckName').value=deck.name; changed(); }
$('#bDecks').addEventListener('click',()=>{
  const render=()=>{ const list=savedDecks().slice().sort((a,b)=>a.name.localeCompare(b.name)); $('#dl').innerHTML = list.length ? list.map(d=>`<li><span><b>${esc(d.name||'Senza nome')}</b> <span class="hint num">${d.cards.length} carte</span></span><button type="button" class="btn small" data-load="${esc(d.id)}">Apri</button><button type="button" class="btn small" data-del="${esc(d.id)}">Elimina</button></li>`).join('') : '<li><span class="hint">Nessun mazzo salvato.</span></li>'; };
  openDlg(`<h2>I miei mazzi</h2><p class="hint">${App.Store.mode==='cloud'?'I mazzi sono salvati sul tuo account e li ritrovi anche nel registro tornei.':'I mazzi restano in questo browser. Per una copia sicura, esporta anche la lista.'}</p><ul class="decklist" id="dl"></ul>
    <div class="row"><button class="btn" value="close">Chiudi</button><button type="button" class="btn primary" id="saveCur">Salva “${esc(deck.name||'Senza nome')}”</button></div>`,
  ()=>{ render();
    $('#saveCur').addEventListener('click',async ()=>{ const nm=(deck.name||'Senza nome').trim(); const ex=savedDecks().find(d=>d.name===nm);
      const rec={id:ex?ex.id:App.uid(), name:nm, cards:deck.cards.slice(), updated:Date.now()};
      if(ex) Object.assign(ex,rec); else App.data.decks.push(rec);
      render(); App.emit('decks'); const ok=await App.Store.put('decks',rec); if(ok) toast(ex?'Mazzo aggiornato':'Mazzo salvato'); });
    $('#dl').addEventListener('click',async e=>{ const l=e.target.closest('[data-load]'), d=e.target.closest('[data-del]');
      if(l){ const x=savedDecks().find(y=>y.id===l.dataset.load); if(x){ dlg.close(); openSaved(x); } }
      if(d){ if(d.dataset.confirm){ const id=d.dataset.del; App.data.decks=App.data.decks.filter(y=>y.id!==id); render(); App.emit('decks'); await App.Store.del('decks',id); } else { d.dataset.confirm='1'; d.textContent='Conferma'; d.classList.add('primary'); } } });
  });
});
$('#bNew').addEventListener('click',()=>{
  openDlg(`<h2>Nuovo mazzo</h2><p style="margin:0">Il mazzo attuale verrà svuotato. Potrai recuperarlo con <b>Annulla</b> finché non chiudi la pagina.</p>
    <div class="row"><button class="btn" value="close">Annulla</button><button type="button" class="btn" id="loadSample">Carica l'esempio</button><button type="button" class="btn primary" id="doNew">Svuota mazzo</button></div>`,
  ()=>{ $('#doNew').addEventListener('click',()=>{ snapshot('nuovo mazzo'); deck={name:'Nuovo mazzo',cards:[]}; $('#deckName').value=deck.name; dlg.close(); changed(); $('#deckName').select(); });
    $('#loadSample').addEventListener('click',()=>{ snapshot('caricamento esempio'); deck=sampleDeck(); $('#deckName').value=deck.name; dlg.close(); changed(); }); });
});

/* tabs */
const mq=window.matchMedia('(max-width:760px)');
function showTab(t){ document.querySelectorAll('#tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.t===t)); ['pool','deck','inspect'].forEach(id=>$('#'+id).classList.toggle('on',id===t)); if(mq.matches) window.scrollTo({top:0}); }
$('#tabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b) showTab(b.dataset.t); });
function syncTabs(){ if(mq.matches) showTab('pool'); else ['pool','deck','inspect'].forEach(id=>$('#'+id).classList.add('on')); }
mq.addEventListener?mq.addEventListener('change',syncTabs):mq.addListener(syncTabs); syncTabs();

let toastT;
function toast(msg,withUndo){ const t=$('#toast'); t.innerHTML=`<span>${esc(msg)}</span>${withUndo&&history.length?'<button type="button" id="tUndo">Annulla</button>':''}`; t.hidden=false; clearTimeout(toastT); toastT=setTimeout(()=>t.hidden=true,3200); const u=$('#tUndo'); if(u) u.addEventListener('click',undo); }

window.DeckLab = { getDeck:()=>deck, validate, BY_KEY, openDeck:x=>{ if(x) openSaved(x); },
  importList:(text,name)=>{ const {out,unknown}=parseList(text); if(!out.length){ toast('Non sono riuscito a leggere la lista'); return; } snapshot('importazione'); deck={name,cards:out}; $('#deckName').value=name; changed();
    toast(unknown.length?`Lista caricata: ${unknown.length} carte non riconosciute`:`Lista di ${name} caricata`, true); } };
renderResults(); changed();
})();
