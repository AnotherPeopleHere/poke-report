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
    <button type="button" class="wh-c" aria-label="Chiudi il menu"><span class="wh-x">✕</span><span class="wh-sel"></span></button>
  </div>`;
document.body.append(ov, fab);
const ring=ov.querySelector('.wh-ring'), sel=ov.querySelector('.wh-sel');
let open=false, hot=-1;

function show(){ if(open) return; open=true; fab.classList.remove('away'); ov.hidden=false; requestAnimationFrame(()=>ov.classList.add('on')); fab.classList.add('on'); fab.setAttribute('aria-expanded','true'); drawSub(); mark(); }
function hide(){ if(!open) return; open=false; ov.classList.remove('on'); fab.classList.remove('on'); fab.setAttribute('aria-expanded','false'); light(-1); setTimeout(()=>{ if(!open) ov.hidden=true; },260); }
function light(i){ if(i===hot) return; hot=i; ov.querySelectorAll('.wh-s').forEach((g,k)=>g.classList.toggle('hot',k===i));
  ov.classList.toggle('picking', i>=0); sel.innerHTML = i>=0 ? `<svg class="i"><use href="#${slices[i].it[1]}"/></svg><b>${slices[i].it[2]}</b>` : '';
}
function mark(){ ov.querySelectorAll('.wh-s').forEach((g,k)=>g.classList.toggle('cur', slices[k].it[0]===App.page)); }
function go(i){ const p=slices[i].it[0]; hide(); if(location.hash.replace('#','')!==p) location.hash=p; else window.scrollTo({top:0,behavior:'smooth'}); }
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
function drawSub(){ const box=document.getElementById('whSub'); const src=document.getElementById('bmoreSub');
  box.innerHTML = App.page==='gruppo' && src ? src.innerHTML : ''; }
document.getElementById('whSub').addEventListener('click',e=>{ const b=e.target.closest('[data-gtab]'); if(!b) return; const t=document.querySelector(`#bmoreSub [data-gtab="${b.dataset.gtab}"]`); if(t) t.click(); hide(); });
App.on(w=>{ if(w==='page'){ mark(); hide(); } });
})();
