/* ===== Import a deck from a picture: OCR in the browser (Tesseract.js, loaded only when used), then a review screen =====
   Two readers:
   - grid: digital exports like Limitless (cards in rows on a dark background): every card is read on its own,
     its name from the top strip and the number of copies from the badge, so names and counts stay together;
   - photo: anything else: the whole picture is read, card names are matched and copies counted from the
     partly hidden names of stacked cards. Counts are often wrong here: the review screen is where they get fixed. */
(function(){
"use strict";
const $ = s => document.querySelector(s);
const DL = window.DeckLab, esc = App.esc;
const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/';
const TESS_OPTS = { workerPath: TESS+'worker.min.js', corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  langPath: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int' };

/* ---------- name dictionary (English and Italian names), fuzzy matching ---------- */
const fold = s => String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’`´]/g,"'").replace(/[^a-z0-9' ]+/g,' ').replace(/\s+/g,' ').trim();
let DICT = null, TRI = null;
const grams = s => { const t=' '+s+' ', g=new Set(); for(let i=0;i<t.length-2;i++) g.add(t.slice(i,i+3)); return g; };
function buildDict(){
  if(DICT) return;
  const map = new Map(), add = (k,c) => { k=fold(k); if(k.length>=4 && !map.has(k)) map.set(k,c); };
  DL.CARDS.forEach(c => add(c.name, c));
  for(const l in (DL.NAMES||{})) for(const k in DL.NAMES[l]){ const c=DL.byName(DL.NAMES[l][k]); if(c) add(k,c); }
  // OCR often drops the stylised "ex": "Mega Absol" still means "Mega Absol ex" when no plain card has that name
  [...map].forEach(([k,c]) => { if(/ ex$/.test(k)){ const b=k.slice(0,-3); if(b.length>=4 && !map.has(b)) map.set(b,c); } });
  DICT = [...map].map(([k,c]) => ({k, c, g:grams(k)}));
  TRI = new Map(); DICT.forEach((e,i) => e.g.forEach(g => { if(!TRI.has(g)) TRI.set(g,[]); TRI.get(g).push(i); }));
}
function lev(a,b){ const m=a.length, n=b.length; if(!m) return n; if(!n) return m; let p=Array.from({length:n+1},(_,j)=>j), q=new Array(n+1);
  for(let i=1;i<=m;i++){ q[0]=i; for(let j=1;j<=n;j++) q[j]=Math.min(p[j]+1,q[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); [p,q]=[q,p]; } return p[n]; }
function best(s){
  s=fold(s); if(s.length<4) return null;
  const g=grams(s), cnt=new Map(); g.forEach(x => (TRI.get(x)||[]).forEach(i => cnt.set(i,(cnt.get(i)||0)+1)));
  let top=null;
  [...cnt].map(([i,n]) => [i, 2*n/(g.size+DICT[i].g.size)]).filter(x=>x[1]>=.35).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([i]) => {
    const e=DICT[i], sim=1-lev(s,e.k)/Math.max(s.length,e.k.length); if(!top || sim>top.sim) top={c:e.c, k:e.k, sim}; });
  if(!top) return null;
  return top.sim >= (top.k.length<=5 ? .9 : .8) ? top : null;
}
// best card named in a line of text: try every run of 1..5 words
function matchLine(text){
  const w=fold(text).split(' ').filter(Boolean); let top=null;
  for(let i=0;i<w.length;i++) for(let n=1;n<=5 && i+n<=w.length;n++){ const r=best(w.slice(i,i+n).join(' ')); if(r && (!top || r.sim>top.sim || (r.sim===top.sim && r.k.length>top.k.length))) top=r; }
  return top;
}

/* ---------- image helpers ---------- */
function loadImage(file){ return new Promise((res,rej)=>{ const u=URL.createObjectURL(file), im=new Image(); im.onload=()=>res(im); im.onerror=rej; im.src=u; }); }
function canvasOf(img, maxSide){ const s=Math.min(1, maxSide/Math.max(img.naturalWidth||img.width, img.naturalHeight||img.height));
  const c=document.createElement('canvas'); c.width=Math.round((img.naturalWidth||img.width)*s); c.height=Math.round((img.naturalHeight||img.height)*s);
  c.getContext('2d').drawImage(img,0,0,c.width,c.height); return c; }
// a region of the picture, enlarged to `h` pixels high, as grey (or a custom per-pixel function)
function crop(src, x, y, w, h, outH, px){
  const s=outH/h, c=document.createElement('canvas'); c.width=Math.max(1,Math.round(w*s)); c.height=Math.round(outH);
  const g=c.getContext('2d'); g.imageSmoothingQuality='high'; g.drawImage(src,x,y,w,h,0,0,c.width,c.height);
  const d=g.getImageData(0,0,c.width,c.height), a=d.data;
  for(let i=0;i<a.length;i+=4){ const v = px ? px(a[i],a[i+1],a[i+2]) : (a[i]*.3+a[i+1]*.59+a[i+2]*.11); a[i]=a[i+1]=a[i+2]=v; }
  g.putImageData(d,0,0); return c;
}

/* ---------- grid of cards on a dark background (Limitless and similar exports) ---------- */
function findGrid(c){
  const W=c.width, H=c.height, d=c.getContext('2d').getImageData(0,0,W,H).data;
  const card = new Uint8Array(W*H);
  for(let i=0,p=0;i<d.length;i+=4,p++){ const r=d[i],g=d[i+1],b=d[i+2], mx=Math.max(r,g,b), mn=Math.min(r,g,b); card[p] = (mx>85 || mx-mn>45) ? 1 : 0; }
  const runs = (len, other, at) => { const prof=new Float32Array(len); for(let a=0;a<len;a++){ let s=0; for(let b=0;b<other;b++) s+=at(a,b); prof[a]=s/other; }
    const out=[]; let st=-1; for(let a=0;a<=len;a++){ const on = a<len && prof[a]>.12; if(on && st<0) st=a; if(!on && st>=0){ if(a-st>len*.04) out.push([st,a]); st=-1; } } return out; };
  const cols = runs(W, H, (x,y)=>card[y*W+x]), rows = runs(H, W, (y,x)=>card[y*W+x]);
  if(cols.length<3 || !rows.length) return null;
  const ws=cols.map(r=>r[1]-r[0]), mw=ws.reduce((a,b)=>a+b,0)/ws.length;
  if(ws.some(w=>Math.abs(w-mw)>mw*.18)) return null;
  const cells=[];
  rows.forEach(([y0,y1]) => { const h=y1-y0, ratio=h/mw; if(ratio<1.2 || ratio>1.6) return;
    cols.forEach(([x0,x1]) => { let s=0, n=0; for(let y=y0;y<y1;y+=3) for(let x=x0;x<x1;x+=3){ s+=card[y*W+x]; n++; } if(s/n>.6) cells.push({x:x0,y:y0,w:x1-x0,h}); }); });
  return cells.length>=4 ? cells : null;
}
const HUES = [['Grass',115],['Fire',8],['Water',205],['Lightning',50],['Psychic',285],['Fighting',28],['Darkness',185],['Metal',null]];
function energyByColour(src, cell){
  const g=src.getContext('2d').getImageData(Math.round(cell.x+cell.w*.25), Math.round(cell.y+cell.h*.3), Math.round(cell.w*.5), Math.round(cell.h*.4)).data;
  let sx=0, sy=0, sat=0, n=0;
  for(let i=0;i<g.length;i+=16){ const r=g[i]/255, gg=g[i+1]/255, b=g[i+2]/255, mx=Math.max(r,gg,b), mn=Math.min(r,gg,b), dd=mx-mn; n++; sat+=dd; if(dd<.12) continue;
    let h = mx===r ? ((gg-b)/dd)%6 : mx===gg ? (b-r)/dd+2 : (r-gg)/dd+4; h*=60; sx+=Math.cos(h*Math.PI/180)*dd; sy+=Math.sin(h*Math.PI/180)*dd; }
  if(sat/n < .12) return 'Metal';
  const hue=(Math.atan2(sy,sx)*180/Math.PI+360)%360;
  let top=null; HUES.forEach(([t,h])=>{ if(h==null) return; const dist=Math.min(Math.abs(hue-h),360-Math.abs(hue-h)); if(!top||dist<top[1]) top=[t,dist]; }); return top[0];
}
const basicEnergy = t => DL.byName(t+' Energy');

/* ---------- card fingerprints (same maths as scripts/build_hashes.py): match a cell to a known scan ---------- */
let HASHES=null;
async function hashes(){ if(!HASHES){ const r=await fetch('data/hashes.json?v='+Math.floor(Date.now()/864e5)); HASHES=Object.entries(await r.json()).map(([k,h])=>[k, BigInt('0x'+h.slice(0,16)), BigInt('0x'+h.slice(16))]); } return HASHES; }
function fingerprint(src, cell){
  const W=120, H=168, d=src.getContext('2d').getImageData(Math.round(cell.x),Math.round(cell.y),Math.round(cell.w),Math.round(cell.h)), sw=d.width, sh=d.height, a=d.data;
  const g=new Float32Array(W*H);   // box resize to 120x168 of the grey picture
  for(let y=0;y<H;y++){ const ya=Math.floor(y*sh/H), yb=Math.max(ya+1,Math.floor((y+1)*sh/H));
    for(let x=0;x<W;x++){ const xa=Math.floor(x*sw/W), xb=Math.max(xa+1,Math.floor((x+1)*sw/W)); let s=0,n=0;
      for(let yy=ya;yy<yb;yy++) for(let xx=xa;xx<xb;xx++){ const i=(yy*sw+xx)*4; s+=(a[i]*299+a[i+1]*587+a[i+2]*114)/1000; n++; } g[y*W+x]=Math.round(s/n); } }
  const dh=(x0,y0,x1,y1)=>{ const X0=Math.floor(x0*W),X1=Math.floor(x1*W),Y0=Math.floor(y0*H),Y1=Math.floor(y1*H); let bits=0n;
    for(let j=0;j<8;j++){ const ya=Y0+Math.floor((Y1-Y0)*j/8), yb=Math.max(ya+1,Y0+Math.floor((Y1-Y0)*(j+1)/8)); const row=[];
      for(let i=0;i<9;i++){ const xa=X0+Math.floor((X1-X0)*i/9), xb=Math.max(xa+1,X0+Math.floor((X1-X0)*(i+1)/9)); let s=0,n=0; for(let y=ya;y<yb;y++) for(let x=xa;x<xb;x++){ s+=g[y*W+x]; n++; } row.push(s/n); }
      for(let i=0;i<8;i++) bits=(bits<<1n)|(row[i]>row[i+1]?1n:0n); } return bits; };
  return [dh(.04,.03,.96,.97), dh(.08,.11,.92,.48)];
}
const pop = v => { let n=0; while(v){ v&=v-1n; n++; } return n; };
function nearest(fp, H){ let top=null; for(const [k,a,b] of H){ const d=pop(a^fp[0])+pop(b^fp[1]); if(!top||d<top.d) top={k,d}; } return top; }

/* ---------- OCR ---------- */
let workerP = null;
function worker(progress){
  if(!workerP) workerP = new Promise((res,rej)=>{ if(window.Tesseract) return res(); const s=document.createElement('script'); s.src=TESS+'tesseract.min.js'; s.onload=res; s.onerror=()=>rej(new Error('ocr')); document.head.appendChild(s); })
    .then(()=>window.Tesseract.createWorker('eng', 1, {...TESS_OPTS, logger:m=>{ if(m.status==='loading language traineddata' || m.status==='initializing tesseract') progress && progress('Preparo il lettore di testo…'); }}));
  workerP.catch(()=>{ workerP=null; });
  return workerP;
}

async function readGrid(w, src, cells, progress){
  const found=[]; let H=null; try{ H=await hashes(); }catch(e){}
  for(let i=0;i<cells.length;i++){
    const c=cells[i]; progress(`Leggo la carta ${i+1} di ${cells.length}…`, (i+1)/cells.length);
    await w.setParameters({tessedit_pageseg_mode:'6', tessedit_char_whitelist:''});
    let top=null, raw='';
    // name strip (Pokémon: first line; Trainers and Energy: second line). Grey, then only the brightest pixels
    // (white names with an outline on full-art cards), then inverted
    for(const px of [null, (r,g,b)=>Math.min(r,g,b)>205?0:255, (r,g,b)=>255-(r*.3+g*.59+b*.11)]){
      const im=crop(src, c.x+c.w*.03, c.y+c.h*.015, c.w*.78, c.h*.13, 110, px);
      const t=(await w.recognize(im)).data.text; raw+=' '+t; t.split('\n').forEach(l=>{ const m=matchLine(l); if(m && (!top || m.sim>top.sim)) top=m; }); if(top && top.sim>.95) break; }
    // the picture itself: nearest known scan (very reliable on digital exports)
    const nh = H ? nearest(fingerprint(src,c), H) : null, byHash = nh && DL.byPrint(nh.k);
    let card = top && top.c, sure = !!(top && top.sim>.9);
    if(byHash && (nh.d<=24 || (!card && nh.d<=34))){ if(!(card && sure && card.name!==byHash.name && nh.d>18)){ card=byHash; sure = sure || nh.d<=24; } }
    if((!card || (card.sup==='E' && !card.isBasicEnergy && top.sim<.9)) && /ener|basic|basi/i.test(raw)){ const e=basicEnergy(energyByColour(src,c)); if(e) card=e; }
    // copies: white digit in a badge near the bottom middle of the card
    await w.setParameters({tessedit_pageseg_mode:'8', tessedit_char_whitelist:'0123456789'});
    const badge=crop(src, c.x+c.w*.3, c.y+c.h*.72, c.w*.4, c.h*.25, 90, (r,g,b)=>Math.min(r,g,b)>165?0:255);
    let dg=((await w.recognize(badge)).data.text||'').replace(/\D/g,'');
    if(!dg){ await w.setParameters({tessedit_pageseg_mode:'10'}); dg=((await w.recognize(crop(src, c.x+c.w*.36, c.y+c.h*.76, c.w*.28, c.h*.18, 80, (r,g,b)=>Math.min(r,g,b)>150?0:255))).data.text||'').replace(/\D/g,''); } if(dg.length>1 && !(card && card.isBasicEnergy)) dg=dg[0];   // stray marks read as extra digits
    const n=parseInt(dg,10);
    if(window.SCAN_DEBUG) console.log('CELL',i,card&&card.name,'hash',nh&&nh.k,nh&&nh.d,'ocr',top&&top.k);
    if(card) found.push({c:card, q:(n>0 && n<=60) ? n : 1, sure: sure && n>0});
  }
  return found;
}
async function readPhoto(w, img, progress){
  progress('Leggo la foto…', .5);
  await w.setParameters({tessedit_pageseg_mode:'11', tessedit_char_whitelist:''});
  const c=canvasOf(img, 2400), g=crop(c,0,0,c.width,c.height,c.height);
  const lines=(await w.recognize(g)).data.lines.map(l=>l.text.trim()).filter(t=>t.length>=3);
  const hits=new Map(), used=new Set();
  lines.forEach((t,i)=>{ const m=matchLine(t); if(m){ used.add(i); const h=hits.get(m.c.key)||{c:m.c,q:0,sure:m.sim>.9}; h.q++; hits.set(m.c.key,h); } });
  // stacked copies show only the start of the name ("Ultra B", "Ultra"): count those fragments too
  const keys=[...hits.values()].map(h=>({h, k:fold(h.c.name)}));
  lines.forEach((t,i)=>{ if(used.has(i)) return; const f=fold(t); if(f.length<4) return;
    const cand=keys.filter(({k})=>{ const p=k.slice(0,f.length); return k.startsWith(f) || (f.length>=5 && lev(f,p)<=1); }); if(cand.length===1) cand[0].h.q++; });
  // the same picture in 6 enlarged pieces: small or blurry names are easier to read (only to find more cards, not to count)
  const W=img.naturalWidth, Hh=img.naturalHeight, tiles=[];
  for(let j=0;j<2;j++) for(let i=0;i<3;i++) tiles.push([i*W/3-W*.04, j*Hh/2-Hh*.05, W/3+W*.08, Hh/2+Hh*.1]);
  for(let t=0;t<tiles.length;t++){ progress(`Leggo la foto più da vicino (${t+1}/${tiles.length})…`, .5+.5*(t+1)/tiles.length);
    const [x,y,w0,h0]=tiles[t], x0=Math.max(0,x), y0=Math.max(0,y), tw=Math.min(W-x0,w0), th=Math.min(Hh-y0,h0);
    const tl=crop(img, x0, y0, tw, th, th*1800/Math.max(tw,1));
    (await w.recognize(tl)).data.lines.forEach(l=>{ const m=matchLine(l.text); if(m && !hits.has(m.c.key)) hits.set(m.c.key,{c:m.c,q:1,sure:false}); }); }
  return [...hits.values()].map(h=>({...h, q:Math.min(h.c.isBasicEnergy?60:4, h.q)}));
}

/* ---------- review screen ---------- */
function review(found, fileName){
  const rows=new Map(); found.forEach(f=>{ const r=rows.get(f.c.key); if(r){ r.q+=f.q; r.sure=r.sure&&f.sure; } else rows.set(f.c.key,{...f}); });
  const names=[...new Set(DL.CARDS.map(c=>c.name))].sort();
  const dlg=$('#dlg2'), body=$('#dlg2Body');
  const draw=()=>{ const L=[...rows.values()], n=L.reduce((a,r)=>a+r.q,0);
    $('#scList').innerHTML = L.length ? L.map(r=>`<li data-k="${esc(r.c.key)}"><span class="sc-img">${DL.thumb(r.c)}</span><span class="sc-n">${esc(r.c.name)}${r.sure?'':' <span class="sc-chk" title="Riconoscimento incerto: controlla">da controllare</span>'}</span>
        <span class="sc-q"><button type="button" data-sq="-1" aria-label="Una copia in meno">−</button><b class="num">${r.q}</b><button type="button" data-sq="1" aria-label="Una copia in più">+</button></span><button type="button" class="xbtn" data-sx aria-label="Togli ${esc(r.c.name)}">✕</button></li>`).join('')
      : '<li class="hint">Nessuna carta riconosciuta: aggiungile qui sotto.</li>';
    $('#scTot').textContent=`${n}/60 carte`; $('#scTot').className='num '+(n===60?'good':'badc'); };
  body.innerHTML = `<div class="dlg-h"><div><h2>Controlla le carte trovate</h2><p class="hint" style="margin:2px 0 0">Correggi le quantità, togli quello che non c'entra e aggiungi le carte mancanti. Le Energie base nelle foto spesso non si leggono: aggiungile qui.</p></div>
      <button class="xclose" type="button" value="close" aria-label="Chiudi">✕</button></div>
    <ul class="sc-list" id="scList"></ul>
    <div class="sc-add"><input id="scAdd" list="scNames" placeholder="Aggiungi una carta (nome in inglese o italiano)" autocomplete="off"><button type="button" class="btn small" id="scAddB">Aggiungi</button><datalist id="scNames">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist></div>
    <div class="row"><span id="scTot"></span><input id="scName" placeholder="Nome del mazzo" value="${esc(fileName)}" style="flex:1;min-width:120px"><button class="btn" value="close">Annulla</button><button type="button" class="btn primary" id="scOk">Crea il mazzo</button></div>`;
  dlg.classList.add('sheet'); dlg.showModal(); dlg.addEventListener('close',()=>dlg.classList.remove('sheet'),{once:true}); draw();
  const add=()=>{ const v=$('#scAdd').value.trim(); if(!v) return; const c=DL.byName(v); if(!c){ App.toast('Carta non trovata tra quelle legali'); return; }
    const r=rows.get(c.key); if(r) r.q++; else rows.set(c.key,{c,q:1,sure:true}); $('#scAdd').value=''; draw(); };
  $('#scAddB').addEventListener('click',add); $('#scAdd').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } });
  $('#scList').addEventListener('click',e=>{ const li=e.target.closest('li[data-k]'); if(!li) return; const r=rows.get(li.dataset.k);
    if(e.target.closest('[data-sx]')) rows.delete(li.dataset.k); else { const b=e.target.closest('[data-sq]'); if(!b) return; r.q=Math.max(1,r.q+(+b.dataset.sq)); r.sure=true; } draw(); });
  $('#scOk').addEventListener('click',()=>{ const L=[...rows.values()]; if(!L.length){ App.toast('Aggiungi almeno una carta'); return; }
    const text=L.map(r=>`${r.q} ${r.c.name} ${r.c.prints[0][0]} ${r.c.prints[0][1]}`).join('\n'); dlg.close(); DL.importList(text, $('#scName').value.trim()||'Mazzo da immagine'); location.hash='deck'; });
}

/* ---------- entry point ---------- */
async function fromImage(file){
  if(!file || !/^image\//.test(file.type)){ App.toast('Scegli un’immagine (PNG o JPG)'); return; }
  buildDict();
  const dlg=$('#dlg2'), body=$('#dlg2Body');
  body.innerHTML=`<h2>Leggo l'immagine</h2><p class="hint" id="scMsg">Preparo il lettore di testo… la prima volta ci vuole qualche secondo.</p><div class="sc-bar"><b id="scBar"></b></div>`;
  if(!dlg.open) dlg.showModal();
  const progress=(m,p)=>{ const a=$('#scMsg'); if(a) a.textContent=m; const b=$('#scBar'); if(b && p!=null) b.style.width=Math.round(p*100)+'%'; };
  try{
    const img=await loadImage(file), w=await worker(progress);
    const src=canvasOf(img, 2000), cells=findGrid(canvasOf(img, 1200));
    let found;
    if(cells){ const s=src.width/canvasOf(img,1200).width; found=await readGrid(w, src, cells.map(c=>({x:c.x*s,y:c.y*s,w:c.w*s,h:c.h*s})), progress); }
    else found=await readPhoto(w, img, progress);
    review(found, file.name.replace(/\.[a-z]+$/i,'').replace(/[_-]+/g,' '));
  }catch(e){ console.error(e); body.innerHTML=`<h2>Non sono riuscito a leggere l'immagine</h2><p class="hint">Controlla la connessione (il lettore di testo si scarica la prima volta) e riprova.</p><div class="row"><button class="btn" value="close">Chiudi</button></div>`; }
}
DL.fromImage = fromImage;
DL._scan = {findGrid, crop, canvasOf, matchLine, buildDict, loadImage, worker};   // for tests
})();
