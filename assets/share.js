/* ===== Tournament summary as a picture, to share (WhatsApp and the like) or download.
   1080x1350 (the portrait format that chats show whole): name, date, your deck with its sprites, record, placement,
   then the rounds one under the other with the opponent's sprites and the result. Always drawn in the dark style. */
(function(){
"use strict";
const esc = App.esc, T = App.T, DL = window.DeckLab;
const W = 1080, H = 1350, PAD = 72;
const C = {bg1:'#101218', bg2:'#1b1f2a', panel:'#20242f', line:'#2c3140', fg:'#f2f3f6', muted:'#9aa0ae', acc:'#f4c94a',
  W:'#2fae6b', L:'#e0505e', T:'#7b8294', drop:'#e08a2c'};
const F = (w, px, fam) => `${w} ${px}px ${fam==='mono'?'"JetBrains Mono",ui-monospace,monospace':fam==='body'?'Inter,system-ui,sans-serif':'Outfit,"Trebuchet MS",sans-serif'}`;

const load = src => new Promise(ok => { if(!src){ ok(null); return; } const im=new Image(); im.crossOrigin='anonymous'; im.onload=()=>ok(im); im.onerror=()=>ok(null); im.src=src; });
// the sprites of an archetype name, as images (the same ones the site shows)
async function sprites(name){ const html=name && DL.archSprites ? DL.archSprites(name) : ''; const L=[...html.matchAll(/src="([^"]+)"/g)].map(m=>m[1]).slice(0,2);
  return (await Promise.all(L.map(load))).filter(Boolean); }
function rr(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function fit(g, text, max){ if(g.measureText(text).width<=max) return text; let t=text; while(t.length>1 && g.measureText(t+'…').width>max) t=t.slice(0,-1); return t+'…'; }
function wrap(g, text, max, lines){ const words=String(text).split(/\s+/), out=[]; let cur='';
  words.forEach(w=>{ const t=cur?cur+' '+w:w; if(g.measureText(t).width>max && cur){ out.push(cur); cur=w; } else cur=t; }); if(cur) out.push(cur);
  if(out.length>lines){ out.length=lines; out[lines-1]=fit(g, out[lines-1]+' …', max); } return out; }
function drawSpr(g, ims, x, y, size){ // two sprites side by side in a slot as wide as two, one centred
  const step=size*.82, total=ims.length>1?size+step:size, x0=x+((size+step)-total)/2;
  ims.forEach((im,i)=>g.drawImage(im, x0+i*step, y, size, size)); }
function pill(g, x, y, w, h, kind, text){ g.fillStyle = kind==='W'?C.W : kind==='L'?C.L : kind==='X'?'#3a3f4e' : C.T; rr(g,x,y,w,h,h*.28); g.fill();
  g.fillStyle='#fff'; g.font=F(800, h*.46, 'mono'); g.textAlign='center'; g.textBaseline='middle'; g.fillText(text, x+w/2, y+h/2+1); g.textAlign='left'; g.textBaseline='alphabetic'; }

async function render(t){
  await (document.fonts && document.fonts.ready);
  const c=document.createElement('canvas'); c.width=W; c.height=H; const g=c.getContext('2d'); g.imageSmoothingQuality='high';
  const bg=g.createLinearGradient(0,0,0,H); bg.addColorStop(0,C.bg1); bg.addColorStop(1,C.bg2); g.fillStyle=bg; g.fillRect(0,0,W,H);
  // accent glow in the corner
  const gl=g.createRadialGradient(W,0,0,W,0,620); gl.addColorStop(0,'rgba(244,201,74,.18)'); gl.addColorStop(1,'rgba(244,201,74,0)'); g.fillStyle=gl; g.fillRect(0,0,W,H);

  const [logo, mine] = await Promise.all([load('assets/logo-96.png'), sprites(t.deckName)]);
  const rounds=t.rounds||[], oppS=await Promise.all(rounds.map(x=>x.bye?[]:sprites(x.opp)));
  let y=PAD;
  // brand
  if(logo) g.drawImage(logo, PAD, y-6, 56, 56);
  g.fillStyle=C.fg; g.font=F(800,30); g.fillText('Poke Report', PAD+70, y+30);
  g.fillStyle=C.muted; g.font=F(500,22,'body'); g.textAlign='right'; g.fillText('Riepilogo torneo', W-PAD, y+30); g.textAlign='left';
  y+=150;
  // name, date, type, players
  g.fillStyle=C.fg; g.font=F(800,66); const nl=wrap(g, t.name||'Torneo', W-2*PAD, 2); nl.forEach((l,i)=>g.fillText(l, PAD, y+i*72)); y+=(nl.length-1)*72;
  const who=(App.Store.profile && App.Store.profile.display_name) || '';
  const sub=[T.fmtDate(t.date), t.type, t.players?`${t.players} giocatori`:'', who].filter(Boolean).join(' · ');
  g.fillStyle=C.muted; g.font=F(500,28,'body'); g.fillText(fit(g,sub,W-2*PAD), PAD, y+50); y+=92;

  // deck and record
  const boxH=220; g.fillStyle=C.panel; rr(g,PAD,y,W-2*PAD,boxH,28); g.fill();
  const r=T.record(t), n=r.W+r.L+r.T, wr=n?Math.round(r.W/n*100):null;
  if(mine.length) drawSpr(g, mine, PAD+28, y+34, 108);
  g.fillStyle=C.muted; g.font=F(600,22,'body'); g.fillText('MAZZO', PAD+28, y+boxH-56);
  g.fillStyle=C.fg; g.font=F(700,30); g.fillText(fit(g, t.deckName||'—', 330), PAD+28, y+boxH-22);
  const rx=PAD+420;
  g.fillStyle=C.muted; g.font=F(600,22,'body'); g.fillText('RECORD', rx, y+56);
  g.fillStyle=C.fg; g.font=F(800,104); g.fillText(T.recStr(r), rx-4, y+158);
  g.fillStyle=wr==null?C.muted:wr>=55?C.W:wr<45?C.L:C.muted; g.font=F(700,28,'body'); g.fillText(wr==null?'':`${wr}% vittorie`, rx, y+boxH-22);
  // badges: placement, top cut, drop
  let bx=W-PAD-28; const badge=(text, col)=>{ g.font=F(800,26,'body'); const w=g.measureText(text).width+36; bx-=w; g.fillStyle=col; rr(g,bx,y+28,w,48,24); g.fill(); g.fillStyle=col===C.acc?'#1b1606':'#fff'; g.fillText(text,bx+18,y+61); bx-=12; };
  if(t.placement) badge(`${t.placement}°${t.players?' su '+t.players:''}`, C.acc);
  if(t.topcut || t.cut==='made') badge(t.cutSize?`Top ${t.cutSize}`:'Top cut', C.W);
  if(t.dropped) badge(`Drop R${t.dropped}`, C.drop);
  y+=boxH+40;

  // rounds
  g.fillStyle=C.muted; g.font=F(600,22,'body'); g.fillText(`ROUND · ${rounds.length}`, PAD, y+8); y+=26;
  const room=H-PAD-56-y, rowH=Math.max(52, Math.min(84, Math.floor(room/Math.max(1,rounds.length)))), show=Math.min(rounds.length, Math.floor(room/rowH));
  const spr=Math.round(rowH*.7);
  for(let i=0;i<show;i++){ const x=rounds[i], ry=y+i*rowH, res=T.roundRes(x);
    if(i) { g.fillStyle=C.line; g.fillRect(PAD, ry, W-2*PAD, 2); }
    g.fillStyle=C.muted; g.font=F(700,Math.round(rowH*.34),'mono'); g.textBaseline='middle'; g.fillText(`R${i+1}`, PAD, ry+rowH/2+2);
    if(oppS[i] && oppS[i].length) drawSpr(g, oppS[i], PAD+82, ry+(rowH-spr)/2, spr);
    g.fillStyle=x.bye?C.muted:C.fg; g.font=F(600,Math.round(rowH*.4),'body');
    g.fillText(fit(g, x.bye?'Nessun avversario':(x.opp||'Avversario non segnato'), W-2*PAD-82-spr*1.9-150), PAD+82+spr*1.85, ry+rowH/2+2); g.textBaseline='alphabetic';
    const ph=Math.round(rowH*.62), pw=x.bye||x.id?ph*1.6:ph;
    pill(g, W-PAD-pw, ry+(rowH-ph)/2, pw, ph, x.bye?'W':x.id?'X':res||'T', x.bye?'BYE':x.id?'ID':(T.GL[res]||'·'));
    if(t.cutFrom && +t.cutFrom===i+1){ g.fillStyle=C.acc; g.fillRect(PAD, ry-1, W-2*PAD, 3); } }
  if(show<rounds.length){ g.fillStyle=C.muted; g.font=F(500,24,'body'); g.fillText(`+ altri ${rounds.length-show} round`, PAD, y+show*rowH+30); }
  // footer
  g.fillStyle=C.muted; g.font=F(500,22,'body'); g.textAlign='center'; g.fillText('anotherpeoplehere.github.io/poke-report', W/2, H-PAD+30); g.textAlign='left';
  return c;
}

/* ---------- the pop-up: the picture, then share or download ---------- */
App.shareTournament = async (t, opts={}) => {
  const d=document.getElementById('dlg2'), body=document.getElementById('dlg2Body');
  body.innerHTML = `<div class="dlg-h"><div><h2>${opts.title?esc(opts.title):'Condividi il torneo'}</h2><p class="hint" style="margin:2px 0 0">Un’immagine con record e round, pronta da mandare al gruppo.</p></div><button class="xclose" type="button" value="close" aria-label="Chiudi">✕</button></div>
    <div class="sh-prev" id="shPrev"><span class="src">Preparo l’immagine…</span></div>
    <div class="row"><button type="button" class="btn" id="shDl" disabled>Scarica</button><span></span><button type="button" class="btn primary" id="shGo" disabled>Condividi</button></div>`;
  d.classList.add('sheet'); if(!d.open) d.showModal(); d.addEventListener('close',()=>d.classList.remove('sheet'),{once:true});
  let blob=null; const name=`torneo-${String(t.name||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'riepilogo'}.png`;
  try{ const c=await render(t); blob=await new Promise(ok=>c.toBlob(ok,'image/png'));
    const url=URL.createObjectURL(blob); document.getElementById('shPrev').innerHTML=`<img src="${url}" alt="Riepilogo del torneo ${esc(t.name)}">`; }
  catch(e){ console.error(e); document.getElementById('shPrev').innerHTML='<span class="src">Non sono riuscito a creare l’immagine.</span>'; return; }
  const file=new File([blob], name, {type:'image/png'}), canShare=navigator.canShare && navigator.canShare({files:[file]});
  const dl=document.getElementById('shDl'), go=document.getElementById('shGo'); dl.disabled=false; go.disabled=false;
  if(!canShare){ go.textContent='Scarica l’immagine'; dl.hidden=true; }
  const download=()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); };
  dl.onclick=download;
  go.onclick=async()=>{ if(!canShare) return download(); try{ await navigator.share({files:[file], title:t.name, text:`${t.name} · ${T.recStr(T.record(t))}`}); }catch(e){ if(e && e.name!=='AbortError') download(); } };
};
App.tournamentImage = render;
})();
