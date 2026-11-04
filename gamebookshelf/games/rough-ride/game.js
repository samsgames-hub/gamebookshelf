/* ROUGH RIDE — a 2D stunt truck. Position-based physics: the body is four linked points, the wheels hang off it on springs. */
(()=>{'use strict';
const $=id=>document.getElementById(id),cv=$('c'),x=cv.getContext('2d'),clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,TAU=Math.PI*2;
const NLV=25;let prog={done:{},best:{}};try{const s=JSON.parse(localStorage.getItem('roughride1')||'{}');if(s.done)prog=s}catch(e){}
const save=()=>{try{localStorage.setItem('roughride1',JSON.stringify(prog))}catch(e){}};
let W=0,Hh=0,dpr=1;function resize(){dpr=Math.min(devicePixelRatio||1,2);W=innerWidth;Hh=innerHeight;cv.width=W*dpr;cv.height=Hh*dpr}addEventListener('resize',resize);resize();
try{if(matchMedia('(hover: none) and (pointer: coarse)').matches)document.body.classList.add('touch')}catch(e){}
// ---------------- levels ----------------
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// layout variant per level, each one checked to be beatable by an autopilot
const SALT=[0,3,0,0,0,0,1,1,0,1,0,3,0,4,3,0,0,4,4,3,1,5,4,2,11,13];
function buildLevel(n){const r=rng(n*1013+7+(SALT[n]||0)*7777),d=Math.min(1,(n-1)/(NLV-1)),polys=[];let px=-10,py=0,cur=[[-30,8],[-30,0],[px,py]];
 const go=(dx,dy)=>{px+=dx;py+=dy;cur.push([px,py])},flat=l=>go(l,0),newPoly=(gap,dy)=>{polys.push(cur);px+=gap;py+=dy;cur=[[px,py-30],[px,py]]};
 flat(22);const pieces=6+Math.floor(n*.6);
 for(let i=0;i<pieces;i++){const k=r();
  if(k<.22){// rolling hills
   const h=.8+r()*(1.2+d*3),L=12+r()*10;for(let t=1;t<=12;t++){const a=t/12;cur.push([px+a*L,py+Math.sin(a*Math.PI)*h])}px+=L}
  else if(k<.4){// ramp and a gap
   const rh=1.2+r()*(1.5+d*1.5),rl=5+r()*3;go(rl,rh);const gap=3.5+r()*(2+d*4),drop=-(r()*2+d*2);newPoly(gap,drop-rh*.4);flat(2);go(6,-1.2-r()*1.5);flat(6)}
  else if(k<.55){// steps up
   const st=1+Math.floor(r()*3);for(let s=0;s<st;s++){go(1.1+.4*(1-d),.4+d*.3);flat(3+r()*2)}}
  else if(k<.68){// steps down
   const st=1+Math.floor(r()*3);for(let s=0;s<st;s++){go(.5,-(.6+d*.8));flat(3+r()*2)}}
  else if(k<.8){// steep climb and descent
   const h=2.5+r()*(2+d*3.5);go(Math.max(8,h*1.7),h);flat(2+r()*3);go(Math.max(10,h*1.8),-h*.9)}
  else if(k<.9){// pit with a narrow bridge of planks
   newPoly(1.6+d*1.2,0);flat(3);newPoly(1.4+d*1.4,0);flat(4+r()*3)}
  else{// bumps
   for(let b=0;b<4;b++){go(1.8,.4+d*.5);go(1.8,-.4-d*.5);flat(1)}}
  flat(4+r()*4)}
 flat(8);const fx=px;flat(30);cur.push([px,py-30]);polys.push(cur);
 return{polys,finish:fx,n}}
// ---------------- truck ----------------
const P=[],S=[];let L=null,car=null,G={state:'menu',t:0,lv:1,flipT:0,shake:0,camX:0,camY:0,zoom:38};
function pt(px,py,m,r){const p={x:px,y:py,ox:px,oy:py,m:m||1,r:r||0,ground:false,nx:0,ny:1};P.push(p);return p}
function stick(a,b,k){S.push({a,b,len:Math.hypot(a.x-b.x,a.y-b.y),k:k??1})}
function spawn(){P.length=0;S.length=0;const y0=1.5,c={};
 c.b=[pt(-1.6,y0+.25,1),pt(1.6,y0+.25,1),pt(1.4,y0+1.05,.5),pt(-1.3,y0+1.1,.5)];// rear bottom, front bottom, front top, rear top
 for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)stick(c.b[i],c.b[j],1);
 c.w=[pt(-1.2,y0-.35,1.6,.56),pt(1.25,y0-.35,1.6,.56)];c.wa=[0,0];c.ww=[0,0];
 // each wheel hangs from both bottom corners on soft links (the suspension)
 for(const w of c.w){stick(w,c.b[0],.35);stick(w,c.b[1],.35);stick(w,c.b[3],.12);stick(w,c.b[2],.12)}
 car=c;G.flipT=0}
// ---------------- collision with the ground ----------------
function closest(px,py,out){let bd=1e9;for(const poly of L.polys){if(px<poly[0][0]-2&&px<poly[poly.length-1][0]-2)continue;for(let i=0;i<poly.length-1;i++){const a=poly[i],b=poly[i+1];if(Math.max(a[0],b[0])<px-3||Math.min(a[0],b[0])>px+3)continue;
  const ex=b[0]-a[0],ey=b[1]-a[1],l2=ex*ex+ey*ey||1e-9;let t=((px-a[0])*ex+(py-a[1])*ey)/l2;t=clamp(t,0,1);const cx=a[0]+ex*t,cy=a[1]+ey*t,d=Math.hypot(px-cx,py-cy);
  if(d<bd){bd=d;out.x=cx;out.y=cy;const l=Math.sqrt(l2);// normal points to the side of the segment the point is on (ground surfaces run left to right, so "up" is the left normal)
   let nx=-ey/l,ny=ex/l;if((px-cx)*nx+(py-cy)*ny<0&&d>1e-4){nx=(px-cx)/d;ny=(py-cy)/d}out.nx=nx;out.ny=ny}}}out.d=bd;return out}
const C={x:0,y:0,nx:0,ny:1,d:0};
function collide(p,isWheel,wi){const c=closest(p.x,p.y,C),r=p.r||.08;p.ground=false;
 // which side are we on? signed distance along the normal
 const sd=(p.x-c.x)*c.nx+(p.y-c.y)*c.ny;if(c.d<r||sd<0){const push=r-sd;p.x+=c.nx*push;p.y+=c.ny*push;p.ground=true;p.nx=c.nx;p.ny=c.ny;
  // friction: velocity along the surface follows the wheel's rim speed (or just drags, for the body)
  const vx=p.x-p.ox,vy=p.y-p.oy,tx=c.ny,ty=-c.nx,vt=vx*tx+vy*ty,vn=vx*c.nx+vy*c.ny;
  let target=isWheel?-car.ww[wi]*p.r*DT:0,mu=isWheel?.85:.35;const nvt=lerp(vt,target,mu);
  if(isWheel){car.ww[wi]=lerp(car.ww[wi],-vt/(p.r*DT),.35)}
  const nvn=Math.max(vn,0)*.1;p.ox=p.x-(tx*nvt+c.nx*nvn);p.oy=p.y-(ty*nvt+c.ny*nvn)}}
// ---------------- input ----------------
const K={};addEventListener('keydown',e=>{K[e.code]=true;if(e.code==='KeyR'&&G.state==='play')startLevel(G.lv);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space'].includes(e.code))e.preventDefault();if((e.code==='Enter'||e.code==='Space')&&!$('win').classList.contains('hide'))startLevel(Math.min(NLV,G.lv+1))});addEventListener('keyup',e=>K[e.code]=false);
const T={};for(const [id,k] of [['pg','gas'],['pb','brake']]){const el=$(id);el.addEventListener('pointerdown',e=>{T[k]=true;audio();e.preventDefault()});for(const ev of['pointerup','pointercancel','pointerleave'])el.addEventListener(ev,()=>T[k]=false)}
// ---------------- audio ----------------
let AC=null,eng=null;function audio(){if(AC){AC.state==='suspended'&&AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),o2=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();o.type='sawtooth';o2.type='square';o2.detune.value=-1200;f.type='lowpass';f.frequency.value=500;g.gain.value=0;o.connect(f);o2.connect(f);f.connect(g);g.connect(AC.destination);o.start();o2.start();eng={o,o2,g,f}}catch(e){}}
function tone(fr,d,v,type){if(!AC)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type||'triangle';o.frequency.value=fr;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d+.05)}
// ---------------- simulation ----------------
const DT=1/120,GRAV=-22;
function sim(){const gas=K.ArrowRight||K.KeyD||T.gas?1:0,brk=K.ArrowLeft||K.KeyA||T.brake?1:0,c=car;
 const onGround=c.w[0].ground||c.w[1].ground;G.airT=onGround?0:(G.airT||0)+DT;
 // motor: wheels spin up toward a top speed; brake/reverse spins them the other way
 for(let i=0;i<2;i++){const tw=gas?-34:brk?16:c.ww[i]*.995;c.ww[i]=lerp(c.ww[i],tw,gas||brk?(onGround?.04:.08):.01);c.wa[i]+=c.ww[i]*DT}
 // air control: tip the body
 if(!onGround&&(gas||brk)&&G.airT>.12){const b=c.b,cx=(b[0].x+b[1].x+b[2].x+b[3].x)/4,cy=(b[0].y+b[1].y+b[2].y+b[3].y)/4,dir=gas?-1:1;// gas tips the nose down, brake tips it up
  // current spin of the body; push it toward a capped lean rate
  let num=0,den=0;for(const p of b){const rx=p.x-cx,ry=p.y-cy,vx=p.x-p.ox,vy=p.y-p.oy;num+=rx*vy-ry*vx;den+=rx*rx+ry*ry}const w=num/den/DT;
  if(w*dir<3.2){const k=7*DT*DT;for(const p of b){const rx=p.x-cx,ry=p.y-cy;p.x+=-ry*dir*k;p.y+=rx*dir*k}}}
 for(const p of P){const vx=(p.x-p.ox)*.999,vy=(p.y-p.oy)*.999;p.ox=p.x;p.oy=p.y;p.x+=vx;p.y+=vy+GRAV*DT*DT}
 for(let it=0;it<10;it++){for(const s of S){const dx=s.b.x-s.a.x,dy=s.b.y-s.a.y,d=Math.hypot(dx,dy)||1e-6,df=(d-s.len)/d*s.k,ia=1/s.a.m,ib=1/s.b.m,sm=ia+ib;s.a.x+=dx*df*ia/sm;s.a.y+=dy*df*ia/sm;s.b.x-=dx*df*ib/sm;s.b.y-=dy*df*ib/sm}
  collide(c.w[0],true,0);collide(c.w[1],true,1);for(const p of c.b)collide(p,false)}
 // roof on the ground means a flip
 const roof=c.b[2].ground||c.b[3].ground,b=c.b,up=(b[3].x-b[0].x+b[2].x-b[1].x)*0,ang=Math.atan2(b[1].y-b[0].y,b[1].x-b[0].x);
 if(roof||Math.abs(ang)>2.3&&(b[0].ground||b[1].ground))G.flipT+=DT;else G.flipT=Math.max(0,G.flipT-DT*2);
 if(G.flipT>.5)fail('Flipped!');
 const mx=(b[0].x+b[1].x)/2,my=(b[0].y+b[1].y)/2;if(my<-25)fail('Fell in!');
 if(mx>L.finish)win();
 if(eng){eng.g.gain.value=G.state==='play'?.035:0;const rpm=Math.abs(c.ww[0]+c.ww[1])*.5;eng.o.frequency.value=40+rpm*3+(gas?20:0);eng.o2.frequency.value=40+rpm*3;eng.f.frequency.value=300+rpm*25}}
function startLevel(n){audio();G.lv=n;L=buildLevel(n);spawn();G.state='play';G.t=0;G.camX=0;G.camY=2;['menu','win','fail'].forEach(i=>$(i).classList.add('hide'));$('hud').classList.remove('hide');$('lv').textContent='Level '+n}
function win(){if(G.state!=='play')return;G.state='win';const t=G.t;prog.done[G.lv]=1;if(!prog.best[G.lv]||t<prog.best[G.lv])prog.best[G.lv]=+t.toFixed(2);save();[523,659,784].forEach((f,i)=>setTimeout(()=>tone(f,.3,.12),i*110));
 $('wT').textContent=G.lv===NLV?'You beat every level!':'Made it!';$('wS').textContent=`Level ${G.lv} in ${t.toFixed(1)} s. Best: ${prog.best[G.lv].toFixed(1)} s.`;$('wN').style.display=G.lv<NLV?'':'none';setTimeout(()=>$('win').classList.remove('hide'),500)}
function fail(why){if(G.state!=='play')return;G.state='fail';G.shake=.4;tone(110,.4,.15,'sawtooth');$('fT').textContent=why;setTimeout(()=>$('fail').classList.remove('hide'),600)}
function menu(){G.state='menu';$('hud').classList.add('hide');['win','fail'].forEach(i=>$(i).classList.add('hide'));const g=$('grid');g.innerHTML='';
 for(let i=1;i<=NLV;i++){const b=document.createElement('button');b.textContent=i;const open=i===1||prog.done[i-1]||prog.done[i];b.disabled=!open;if(prog.done[i])b.classList.add('done');b.onclick=()=>startLevel(i);b.setAttribute('aria-label','Level '+i+(prog.done[i]?', done':''));g.appendChild(b)}$('menu').classList.remove('hide');if(!L){L=buildLevel(1);spawn()}}
$('rs').onclick=()=>startLevel(G.lv);$('mn').onclick=menu;$('wN').onclick=()=>startLevel(Math.min(NLV,G.lv+1));$('wR').onclick=()=>startLevel(G.lv);$('fR').onclick=()=>startLevel(G.lv);$('fM').onclick=menu;
// ---------------- drawing ----------------
function draw(){const k=G.zoom*dpr*Math.min(1.25,Math.max(.75,Math.min(W/1100,Hh/640)));x.setTransform(1,0,0,1,0,0);
 const g=x.createLinearGradient(0,0,0,cv.height);g.addColorStop(0,'#5ec2ff');g.addColorStop(1,'#d7f1ff');x.fillStyle=g;x.fillRect(0,0,cv.width,cv.height);
 // far hills (parallax)
 for(const [par,col,amp,yo] of [[.2,'#a5dcc4',60,.55],[.4,'#7cc8a0',80,.68]]){x.fillStyle=col;x.beginPath();x.moveTo(0,cv.height);for(let sx=0;sx<=cv.width+20;sx+=20){const wx=(sx/dpr+G.camX*k/dpr*par)/90;x.lineTo(sx,cv.height*yo-Math.sin(wx)*amp*dpr*.6-Math.sin(wx*2.3+1)*amp*dpr*.3)}x.lineTo(cv.width,cv.height);x.fill()}
 const sh=G.shake>0?(Math.random()-.5)*G.shake*20:0;x.setTransform(k,0,0,-k,cv.width/2-G.camX*k+sh,cv.height*.58+G.camY*k);
 // ground
 for(const poly of L.polys){x.beginPath();x.moveTo(poly[0][0],poly[0][1]-40);for(const p of poly)x.lineTo(p[0],p[1]);x.lineTo(poly[poly.length-1][0],poly[poly.length-1][1]-40);x.closePath();x.fillStyle='#8a5a3b';x.fill();
  x.beginPath();for(let i=1;i<poly.length-1;i++){const p=poly[i];i===1?x.moveTo(p[0],p[1]):x.lineTo(p[0],p[1])}x.strokeStyle='#5bbf4a';x.lineWidth=.45;x.lineJoin='round';x.stroke();x.strokeStyle='#3f8f33';x.lineWidth=.12;x.stroke()}
 // finish flag
 const fy=(()=>{const c=closest(L.finish,50,{x:0,y:0,nx:0,ny:1,d:0});return c.y})();x.fillStyle='#26201a';x.fillRect(L.finish-.06,fy,.12,4.2);for(let i=0;i<4;i++)for(let j=0;j<3;j++){x.fillStyle=(i+j)%2?'#fff':'#26201a';x.fillRect(L.finish+.06+i*.4,fy+3+j*.4,.4,.4)}
 // truck
 const c=car,b=c.b;x.lineJoin='round';
 for(let i=0;i<2;i++){const w=c.w[i];x.save();x.translate(w.x,w.y);x.rotate(c.wa[i]);x.fillStyle='#2a2522';x.beginPath();x.arc(0,0,w.r,0,TAU);x.fill();x.fillStyle='#c9c2b8';x.beginPath();x.arc(0,0,w.r*.45,0,TAU);x.fill();x.strokeStyle='#2a2522';x.lineWidth=.07;x.beginPath();x.moveTo(-w.r*.45,0);x.lineTo(w.r*.45,0);x.moveTo(0,-w.r*.45);x.lineTo(0,w.r*.45);x.stroke();x.restore();
  x.strokeStyle='#555';x.lineWidth=.12;x.beginPath();x.moveTo(w.x,w.y);const m=i?b[1]:b[0];x.lineTo(lerp(m.x,w.x,.1),lerp(m.y,w.y,.1)+.0);x.stroke()}
 const ang=Math.atan2(b[1].y-b[0].y,b[1].x-b[0].x),cxm=(b[0].x+b[1].x)/2,cym=(b[0].y+b[1].y)/2;x.save();x.translate(cxm,cym);x.rotate(ang);
 x.fillStyle='#ff5d3a';x.strokeStyle='#26201a';x.lineWidth=.12;x.beginPath();x.moveTo(-1.7,0);x.lineTo(1.75,0);x.lineTo(1.75,.55);x.lineTo(1.1,.6);x.lineTo(.6,1.15);x.lineTo(-.35,1.15);x.lineTo(-.45,.6);x.lineTo(-1.7,.6);x.closePath();x.fill();x.stroke();
 x.fillStyle='#bfe8ff';x.beginPath();x.moveTo(.0,.68);x.lineTo(.95,.68);x.lineTo(.55,1.05);x.lineTo(.0,1.05);x.closePath();x.fill();x.fillStyle='#ffd54a';x.fillRect(1.55,.18,.22,.18);x.fillStyle='#fff';x.fillRect(-1.5,.2,1,.12);x.restore()}
let last=performance.now(),acc=0;
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;
 if(G.manual){}else if(G.state==='play'){acc+=dt;while(acc>=DT){acc-=DT;sim();if(G.state!=='play')break}G.t+=dt;$('tm').textContent=G.t.toFixed(1)+' s'}else if(G.state==='fail'||G.state==='win'){acc+=dt;while(acc>=DT){acc-=DT;const s=G.state;G.state='coast';sim();G.state=s}}
 G.shake=Math.max(0,G.shake-dt);
 if(car){const b=car.b,mx=(b[0].x+b[1].x)/2,my=(b[0].y+b[1].y)/2,vx=(b[0].x-b[0].ox)/DT;G.camX=lerp(G.camX,mx+clamp(vx*.35,-4,6),1-Math.exp(-4*dt));G.camY=lerp(G.camY,my,1-Math.exp(-3*dt));G.zoom=lerp(G.zoom,clamp(42-Math.abs(vx)*.6,26,42),1-Math.exp(-1.5*dt))}
 draw()}
menu();requestAnimationFrame(loop);
window.__RR={G,K,sim,SALT,buildLevel,get car(){return car},get L(){return L},startLevel};
})();
