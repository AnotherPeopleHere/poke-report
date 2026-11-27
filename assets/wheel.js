/* ===== Phone navigation: a Poké Ball wheel. One Home button at the bottom; pressing it raises a ring of sections.
   Tap a section to go there; the centre (X) or a tap outside closes it. Home is the bottom slice.
   The button hides while scrolling down and comes back when scrolling up.
   To go back to the previous bottom bar, remove this file from the list of scripts in index.html. */
(function(){
"use strict";
const ITEMS = [   // clockwise from the bottom-left; Home fills the bottom
  ['deck','i-grid','Mazzi'], ['meta','i-chart','Meta'], ['consigli','i-star','Consigli'], ['news','i-news','Notizie'],
  ['tornei','i-trophy','Tornei'], ['gruppo','i-group','Gruppo'], ['metafy','i-coach','Metafy']];
const HOME = ['home','i-home','Home'];
const GAP = 90;                                  // degrees of the bottom slice (Home)
const R = 1, RI = .46;                            // outer and inner radius (fractions of the wheel radius)
const deg = a => a*Math.PI/180;
// angles measured clockwise from the top
const span = (360-GAP)/ITEMS.length, start = 180+GAP/2;
const slices = ITEMS.map((it,i)=>({it, a0:start+i*span, a1:start+(i+1)*span})).concat([{it:HOME, a0:180-GAP/2, a1:180+GAP/2, home:true}]);
const pt = (a,r) => [Math.sin(deg(a))*r*100, -Math.cos(deg(a))*r*100];
function arc(a0,a1){ const [x0,y0]=pt(a0,R),[x1,y1]=pt(a1,R),[x2,y2]=pt(a1,RI),[x3,y3]=pt(a0,RI), big=(a1-a0)>180?1:0;
  return `M${x0} ${y0}A${R*100} ${R*100} 0 ${big} 1 ${x1} ${y1}L${x2} ${y2}A${RI*100} ${RI*100} 0 ${big} 0 ${x3} ${y3}Z`; }

document.body.classList.add('wheelnav');
const fab=document.createElement('button'); fab.type='button'; fab.id='wfab'; fab.className='wfab'; fab.setAttribute('aria-label','Menu delle sezioni'); fab.setAttribute('aria-expanded','false');
fab.innerHTML='<svg class="i"><use href="#i-home"/></svg>';
const ov=document.createElement('div'); ov.id='wheel'; ov.className='wheel'; ov.hidden=true;
ov.innerHTML=`<div class="wh-sub" id="whSub"></div>
  <div class="wh-ring" role="menu" aria-label="Sezioni">
    <svg viewBox="-104 -104 208 208" aria-hidden="true">
      <defs><clipPath id="whTop"><rect x="-110" y="-110" width="220" height="110"/></clipPath></defs>
      <circle r="103" class="wh-rim"/>
      ${slices.map((s,i)=>{ const mid=(s.a0+s.a1)/2, [ix,iy]=pt(mid,(R+RI)/2), top=Math.cos(deg(mid))>0;
        return `<g class="wh-s${top?' top':''}${s.home?' home':''}" data-i="${i}"><path d="${arc(s.a0+.6,s.a1-.6)}"/>
          <use href="#${s.it[1]}" x="${ix-9}" y="${iy-13}" width="18" height="18"/><text x="${ix}" y="${iy+13}">${s.it[2]}</text></g>`; }).join('')}
    </svg>
    <button type="button" class="wh-c" aria-label="Chiudi il menu"><span class="wh-mon" id="whMon"></span><span class="wh-x">✕</span><span class="wh-sel"></span></button>
  </div>`;
document.body.append(ov, fab);

/* favourite Pokémon (chosen in the profile): shown animated in the centre of the open wheel, above the X */
// full Pokédex (data/pokedex.json, built from PokeAPI): [english, italian, showdown id, PokeAPI id]
let DEX=null;
async function monList(){ if(!DEX){ const r=await fetch('data/pokedex.json?v=1'); DEX=(await r.json()).map(([n,it,sd,id])=>({n,it,sd,id})); } return DEX; }
function monImg(m){ const id=m.sd || String(m.n).toLowerCase().replace(/[^a-z0-9]/g,''), pid=m.id||m.dex;
  return `<img src="https://play.pokemonshowdown.com/sprites/ani/${id}.gif" alt="${App.esc(m.n)}" data-fb="https://play.pokemonshowdown.com/sprites/gen5/${id}.png" data-fb2="${pid?`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pid}.png`:''}"
    onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.dataset.fb='';}else if(this.dataset.fb2){this.src=this.dataset.fb2;this.dataset.fb2='';}else this.remove()">`; }
// rebuilt only when the favourite changes: the animated sprite is not reloaded and decoded at every opening
let monKey=null;
function drawMon(){ const m=App.prefs().favMon, k=m?(m.sd||m.n):''; ov.classList.toggle('has-mon', !!m); if(k===monKey) return; monKey=k; document.getElementById('whMon').innerHTML = m ? monImg(m) : ''; }
// desktop: the favourite Pokémon next to each page title; remembered for the opening animation too
function mascots(){ const m=App.prefs().favMon;
  // remember it for the opening animation (only set here: prefs may not be loaded yet; the profile's "Togli" clears it)
  try{ if(m && m.sd) localStorage.setItem('pr.mon', JSON.stringify({sd:m.sd, id:m.id||m.dex})); }catch(_){}
  document.querySelectorAll('.page .pg-head h2, #greet').forEach(h=>{ let s=h.querySelector('.mascot'); if(!m){ if(s) s.remove(); return; }
    if(!s){ s=document.createElement('span'); s.className='mascot'; s.setAttribute('aria-hidden','true'); h.appendChild(s); }
    if(s.dataset.sd!==m.sd){ s.dataset.sd=m.sd; s.innerHTML=monImg(m); } }); }
App.drawMascots=mascots;
App.monList=monList; App.monImg=monImg; App.drawMon=drawMon;
const ring=ov.querySelector('.wh-ring'), sel=ov.querySelector('.wh-sel');
let open=false, hot=-1;

function show(){ if(open) return; open=true; pend=null; lock(true); fab.classList.remove('away'); drawSub(); drawMon(); mark(); ov.hidden=false; fab.classList.add('on'); fab.setAttribute('aria-expanded','true');
  requestAnimationFrame(()=>requestAnimationFrame(()=>ov.classList.add('on'))); }   // contents ready before the first frame of the animation
function hide(){ if(!open) return; open=false; pend=null; lock(false); ov.classList.remove('on'); fab.classList.remove('on'); fab.setAttribute('aria-expanded','false'); light(-1); setTimeout(()=>{ if(!open) ov.hidden=true; },260); }
function light(i){ if(i===hot) return; hot=i; ov.querySelectorAll('.wh-s').forEach((g,k)=>g.classList.toggle('hot',k===i));
  ov.classList.toggle('picking', i>=0); sel.innerHTML = i>=0 ? `<svg class="i"><use href="#${slices[i].it[1]}"/></svg><b>${slices[i].it[2]}</b>` : '';
}
function mark(){ const p=pend||App.page; ov.querySelectorAll('.wh-s').forEach((g,k)=>g.classList.toggle('cur', slices[k].it[0]===p)); }
// while the wheel is open the page behind stays still: no scrolling, no taps (the overlay already takes the taps)
let pend=null;   // section picked on the wheel whose sub-menu is showing: the page changes only when a sub-section is chosen
function lock(on){ document.documentElement.classList.toggle('wheel-lock', on); }
ov.addEventListener('touchmove',e=>{ if(!e.target.closest('.wh-sub .bsub')) e.preventDefault(); },{passive:false});
ov.addEventListener('wheel',e=>e.preventDefault(),{passive:false});
const HAS_SUB = new Set(['gruppo','tornei','meta','consigli']);   // sections with their own sub-menu: the wheel stays open on it
let keep=false;
function go(i){ const p=slices[i].it[0];
  if(HAS_SUB.has(p)){ light(-1); pend=p; drawSub(); mark(); return; }   // show its sub-sections; the page opens when one is chosen
  hide(); if(location.hash.replace('#','')!==p) location.hash=p; else window.scrollTo({top:0,behavior:'smooth'}); }
function sliceAt(x,y){
  const r=ring.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2, dx=x-cx, dy=y-cy, d=Math.hypot(dx,dy)/(r.width/2);
  if(d<RI*.75 || d>R*1.3) return -1;
  let a=Math.atan2(dx,-dy)*180/Math.PI; if(a<0) a+=360;
  return slices.findIndex(s=>{ const a0=((s.a0%360)+360)%360, a1=((s.a1%360)+360)%360; return a0<a1 ? (a>=a0&&a<a1) : (a>=a0||a<a1); });
}
// taps only (a long press triggers system features on some phones, e.g. Samsung's search)
fab.addEventListener('click',()=>{ open ? hide() : show(); });
ring.addEventListener('click',e=>{ if(e.target.closest('.wh-c')) return; const i=sliceAt(e.clientX,e.clientY); if(i>=0){ light(i); setTimeout(()=>go(i),120); } });
fab.addEventListener('contextmenu',e=>e.preventDefault()); ring.addEventListener('contextmenu',e=>e.preventDefault());
// the button hides while scrolling down and comes back when scrolling up
let lastY=scrollY;
addEventListener('scroll',()=>{ const y=scrollY, d=y-lastY; if(Math.abs(d)<6) return;
  fab.classList.toggle('away', d>0 && y>80 && !open); lastY=y; },{passive:true});
ov.querySelector('.wh-c').addEventListener('click',hide);
ov.addEventListener('click',e=>{ if(e.target===ov) hide(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') hide(); });
// keyboard: the slices are reachable with Tab when the wheel is open
ov.querySelectorAll('.wh-s').forEach((g,i)=>{ g.setAttribute('tabindex','0'); g.setAttribute('role','menuitem'); g.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); go(i); } }); });

// on the group page the wheel also offers the group's sections
const SUB = {gruppo:{h:'Sezioni del gruppo', fn:()=>App.groupTab, L:[['over','Panoramica'],['match','Matchup'],['players','Giocatori'],['tours','Tornei']]},
  consigli:{h:'Consigli', fn:()=>App.consTab, L:[['you','Per te'],['form','In forma'],['exotic','Esotiche'],['all','Tutti']]},
  meta:{h:'Meta report', fn:()=>App.metaTab, L:[['arch','Archetipi'],['reg','Regional'],['trend','Tendenze']]},
  tornei:{h:'I miei tornei', fn:()=>App.tornTab, L:[['over','Riepilogo'],['decks','Mazzi'],['match','Matchup'],['hist','Storico']]}};
function drawSub(){ const pg=pend||App.page, box=document.getElementById('whSub'), S=SUB[pg], fn=S&&S.fn();
  if(!S || !fn){ box.innerHTML=''; return; } const cur=fn();
  const here = pg===App.page;   // another section: nothing is marked yet, you choose where to land
  box.innerHTML = `<div class="bsub-h">${S.h}</div><div class="bsub">${S.L.map(([k,l])=>`<button type="button" data-gtab="${k}" aria-pressed="${here&&cur===k}">${l}</button>`).join('')}</div>`; }
document.getElementById('whSub').addEventListener('click',e=>{ const b=e.target.closest('[data-gtab]'); if(!b) return; const pg=pend||App.page, go2=pg!==App.page;
  SUB[pg].fn()(b.dataset.gtab); hide(); if(go2) location.hash=pg; else window.scrollTo({top:0,behavior:'smooth'}); });
// closed button: the icon of the section you are on
const ICON={home:'i-home',deck:'i-grid',meta:'i-chart',consigli:'i-star',news:'i-news',tornei:'i-trophy',gruppo:'i-group',metafy:'i-coach'};
const setIcon=()=>fab.querySelector('use').setAttribute('href','#'+(ICON[App.page]||'i-home'));
setIcon();
mascots();
App.on(w=>{ if(w==='data') mascots(); if(w==='page'){ setIcon(); mark(); if(keep){ keep=false; setTimeout(drawSub,50); } else hide(); } });
})();
