/* SLINGSHOT — orbit a planet, let go, get caught by the next one. Canvas 2D; planets, sound and music are generated in code. */
(()=>{'use strict';
const $=id=>document.getElementById(id),cv=$('c'),x=cv.getContext('2d'),R=Math.random,TAU=Math.PI*2,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,rr=(a,b)=>a+R()*(b-a);

/* ================= save ================= */
const KEY='slingshot2';
let S={best:0,stars:0,runs:0,up:{magnet:0,thrust:0,tractor:0,shield:0},skin:'probe',skins:['probe'],missions:[],mlv:{},set:{vol:80,mus:55,mute:false,shake:true,aim:'early',low:false}};
try{const o=JSON.parse(localStorage.getItem(KEY)||'null');if(o)S=Object.assign(S,o,{set:Object.assign(S.set,o.set||{}),up:Object.assign(S.up,o.up||{})});else S.best=+localStorage.getItem('slingshot1')||0}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};

/* ================= screen ================= */
let W=0,Hh=0,SC=1,dpr=1;
function resize(){dpr=Math.min(devicePixelRatio||1,S.set.low?1:2);W=innerWidth;Hh=innerHeight;cv.width=W*dpr|0;cv.height=Hh*dpr|0;SC=Math.min(W/600,Hh/900)}
addEventListener('resize',resize);resize();
const halfW=()=>W/2/SC,halfH=()=>Hh/2/SC;

/* ================= content ================= */
const SECTORS=[{at:0,n:'Home System',h:228},{at:12,n:'Asteroid Belt',h:28},{at:25,n:'Gas Giants',h:285},{at:40,n:'Black Hole Cluster',h:200},{at:60,n:'Deep Space',h:165},{at:85,n:'The Edge',h:330}];
const secOf=i=>{let k=0;SECTORS.forEach((s,j)=>{if(i>=s.at)k=j});return k};
const SKINS=[
 {id:'probe',n:'Pathfinder',d:'The standard deep-space probe.',cost:0,body:'#e9eef8',acc:'#6be3ff',trail:[107,227,255]},
 {id:'comet',n:'Comet',d:'Burns hot. Orange plasma trail.',cost:60,body:'#ffd9b0',acc:'#ff8a3d',trail:[255,150,60]},
 {id:'viper',n:'Viper',d:'Sleek racing hull, green ion wake.',cost:120,body:'#d8ffe4',acc:'#3dff8a',trail:[80,255,140]},
 {id:'aurora',n:'Aurora',d:'Leaves a shimmering violet wake.',cost:200,body:'#efe0ff',acc:'#b77bff',trail:[190,130,255]},
 {id:'royal',n:'Sovereign',d:'Gold plating. Very official.',cost:320,body:'#fff3c4',acc:'#ffc93d',trail:[255,210,80]},
 {id:'phantom',n:'Phantom',d:'Stealth black hull, white-hot trail.',cost:500,body:'#33384a',acc:'#ffffff',trail:[240,245,255]}];
const UPS=[
 {id:'thrust',n:'Thrusters',d:'One more course correction each flight.',costs:[30,75,150],ic:'🔥'},
 {id:'magnet',n:'Star Magnet',d:'Pull in stars from further away.',costs:[25,60,120],ic:'🧲'},
 {id:'tractor',n:'Tractor Beam',d:'Planets catch you from further out.',costs:[40,90,170],ic:'🛰️'},
 {id:'shield',n:'Shield',d:'Survive a crash. One charge per launch, two at level 2.',costs:[120,260],ic:'🛡️'}];
const skin=()=>SKINS.find(s=>s.id===S.skin)||SKINS[0];

/* ================= planets (painted once onto their own canvas) ================= */
function paintPlanet(p){const pad=1.45,sz=Math.ceil(p.r*pad*2*2),c=document.createElement('canvas');c.width=c.height=sz;const g=c.getContext('2d'),m=sz/2,r=p.r*2;
 const atm=g.createRadialGradient(m,m,r*.9,m,m,r*pad);atm.addColorStop(0,`hsla(${p.hue},90%,70%,.45)`);atm.addColorStop(1,`hsla(${p.hue},90%,60%,0)`);g.fillStyle=atm;g.fillRect(0,0,sz,sz);
 g.save();g.beginPath();g.arc(m,m,r,0,TAU);g.clip();
 const T=p.type,h=p.hue;
 if(T==='gas'){for(let y=-r;y<r;y+=rr(4,11)*2){g.fillStyle=`hsl(${h+rr(-14,14)},${rr(40,70)}%,${rr(40,68)}%)`;g.fillRect(m-r,m+y,r*2,rr(6,18)*2)}
  if(R()<.6){g.fillStyle=`hsla(${h-20},70%,45%,.85)`;g.beginPath();g.ellipse(m+rr(-.3,.3)*r,m+rr(.1,.4)*r,r*.22,r*.12,0,0,TAU);g.fill()}}
 else{const base={rock:`hsl(${h},22%,46%)`,ice:`hsl(195,45%,82%)`,lava:'#3b1a14',ocean:`hsl(205,65%,42%)`,moon:'#9a9ca4'}[T];g.fillStyle=base;g.fillRect(0,0,sz,sz);
  for(let i=0;i<260;i++){g.fillStyle=`rgba(${R()<.5?'0,0,0':'255,255,255'},${rr(.02,.08)})`;g.beginPath();g.arc(rr(0,sz),rr(0,sz),rr(2,r*.25),0,TAU);g.fill()}
  if(T==='ocean'){for(let i=0;i<7;i++){g.fillStyle=`hsl(${rr(90,130)},40%,${rr(32,44)}%)`;g.beginPath();const cx=rr(m-r,m+r),cy=rr(m-r,m+r);for(let k=0;k<9;k++){const a=k/9*TAU,q=r*rr(.1,.3);g.lineTo(cx+Math.cos(a)*q,cy+Math.sin(a)*q)}g.fill()}
   g.strokeStyle='rgba(255,255,255,.55)';g.lineCap='round';for(let i=0;i<9;i++){g.lineWidth=rr(2,6);g.beginPath();const cy=rr(m-r,m+r),cx=rr(m-r,m+r);g.arc(cx,cy,rr(r*.15,r*.4),rr(0,3),rr(3,6));g.stroke()}}
  if(T==='rock'||T==='moon'){for(let i=0;i<(T==='moon'?14:8);i++){const cx=rr(m-r,m+r),cy=rr(m-r,m+r),q=rr(r*.05,r*.2);g.fillStyle='rgba(0,0,0,.22)';g.beginPath();g.arc(cx,cy,q,0,TAU);g.fill();g.strokeStyle='rgba(255,255,255,.18)';g.lineWidth=2;g.beginPath();g.arc(cx-q*.15,cy-q*.15,q,Math.PI*.9,Math.PI*1.7);g.stroke()}}
  if(T==='ice'){g.strokeStyle='rgba(120,170,210,.5)';for(let i=0;i<10;i++){g.lineWidth=rr(1,3);g.beginPath();g.moveTo(rr(0,sz),rr(0,sz));g.lineTo(rr(0,sz),rr(0,sz));g.stroke()}g.fillStyle='rgba(255,255,255,.6)';g.fillRect(0,0,sz,m-r*.75);g.fillRect(0,m+r*.78,sz,sz)}
  if(T==='lava'){g.strokeStyle='#ff6a1a';g.shadowColor='#ff9a3a';g.shadowBlur=12;for(let i=0;i<12;i++){g.lineWidth=rr(1.5,4);g.beginPath();let px=rr(m-r,m+r),py=rr(m-r,m+r);g.moveTo(px,py);for(let k=0;k<5;k++){px+=rr(-r*.25,r*.25);py+=rr(-r*.25,r*.25);g.lineTo(px,py)}g.stroke()}g.shadowBlur=0}}
 const sh=g.createRadialGradient(m-r*.45,m-r*.45,r*.1,m-r*.1,m-r*.1,r*1.25);sh.addColorStop(0,'rgba(255,255,255,.22)');sh.addColorStop(.45,'rgba(0,0,0,0)');sh.addColorStop(1,'rgba(0,0,10,.72)');g.fillStyle=sh;g.fillRect(0,0,sz,sz);
 g.restore();p.img=c;p.isz=sz/2}
function paintRock(a){const sz=Math.ceil(a.r*4),c=document.createElement('canvas');c.width=c.height=sz;const g=c.getContext('2d'),m=sz/2;g.fillStyle='#6d6258';g.beginPath();for(let k=0;k<10;k++){const t=k/10*TAU,q=a.r*2*rr(.75,1);g.lineTo(m+Math.cos(t)*q,m+Math.sin(t)*q)}g.closePath();g.fill();
 g.save();g.clip();for(let i=0;i<5;i++){g.fillStyle='rgba(0,0,0,.25)';g.beginPath();g.arc(rr(0,sz),rr(0,sz),rr(2,a.r*.6),0,TAU);g.fill()}const sh=g.createLinearGradient(0,0,sz,sz);sh.addColorStop(0,'rgba(255,255,255,.25)');sh.addColorStop(1,'rgba(0,0,0,.5)');g.fillStyle=sh;g.fillRect(0,0,sz,sz);g.restore();a.img=c}

/* ================= state ================= */
let planets=[],stars=[],rocks=[],holes=[],trail=[],ship=null;
const G={state:'menu',score:0,camY:0,t:0,shake:0,freeze:0,paused:false,sec:0};
const RUN={stars:0,skips:0,fixes:0,used:0,shield:0,maxSec:0};
const P=[];for(let i=0;i<420;i++)P.push({on:false});let pi=0;
function burst(px,py,col,n,sp,life,size){for(let i=0;i<n;i++){const o=P[pi=(pi+1)%P.length],a=R()*TAU,s=sp*(.25+R());o.on=true;o.x=px;o.y=py;o.vx=Math.cos(a)*s;o.vy=Math.sin(a)*s;o.t=0;o.life=(life||.7)*(.6+R()*.6);o.c=col;o.s=size||3}}

function pickType(i,sec){const r=R();if(i===0)return'ocean';
 if(sec===2)return r<.55?'gas':r<.75?'moon':'ice';if(sec===1)return r<.45?'rock':r<.7?'moon':'lava';if(sec===3)return r<.35?'lava':r<.6?'ice':r<.8?'rock':'moon';
 return['rock','ice','ocean','lava','gas','moon'][Math.floor(r*6)]}
const HUE={rock:25,ice:195,ocean:205,lava:18,moon:230};
function addPlanet(y,i){const sec=secOf(i),type=pickType(i,sec),last=planets[planets.length-1];
 let r=type==='gas'?rr(46,60):type==='moon'?rr(14,19):rr(22,40)+(i>12?R()*6:0);
 let px=(R()-.5)*420;if(last&&Math.abs(px-last.x)<90)px=last.x+(px>last.x?1:-1)*(90+R()*60);px=clamp(px,-230,230);
 const mvChance=Math.min(sec>=4?.75:.55,(i-6)*.05),mv=i>6&&R()<mvChance;
 const p={x:px,y,r,orb:r+(type==='gas'?30:26),type,hue:type==='gas'?rr(0,360):HUE[type],mv:mv?(60+R()*60)*(R()<.5?-1:1):0,amp:sec>=4?120:90,ph:R()*TAU,x0:px,id:i,ring:type==='gas'?R()<.7:R()<.15,spin:type==='moon'?1.35:1};
 paintPlanet(p);planets.push(p);
 if(last){/* stars along the way */
  if(R()<.75){const t=rr(.35,.65);stars.push({x:last.x+(px-last.x)*t+(R()-.5)*60,y:last.y+(y-last.y)*t,got:false,ph:R()*6})}
  /* asteroids crossing the gap */
  if(i>=12&&R()<Math.min(.65,.3+(i-12)*.015)){const n=2+(i>30?1:0)+(R()<.4?1:0),y0=last.y+last.orb+30,y1=y-p.orb-30;if(y1>y0)for(let k=0;k<n;k++){const a={x:rr(-300,300),y:rr(y0,y1),r:rr(11,19),vx:rr(35,80)*(R()<.5?-1:1)*(1+sec*.08),rot:R()*6,vr:rr(-2,2)};paintRock(a);rocks.push(a)}}
  /* black holes off to one side of the path, with a couple of tempting stars nearby */
  if(i>=40&&R()<.24&&!(holes.length&&holes[holes.length-1].id===i-1)){const mx=(last.x+px)/2,my=(last.y+y)/2,side=mx>0?-1:1,hx=clamp(mx+side*rr(150,210),-270,270);holes.push({x:hx,y:my,core:17,pull:210,k:rr(5.2e6,6.4e6),id:i});
   for(let k=0;k<2;k++)stars.push({x:lerp(mx,hx,rr(.35,.55)),y:my+rr(-50,50),got:false,ph:R()*6})}
 }}
function reset(){planets=[];stars=[];rocks=[];holes=[];trail=[];P.forEach(o=>o.on=false);let y=0;for(let i=0;i<12;i++){addPlanet(y,i);y+=gapAfter(i)}
 const p=planets[0];p.x=0;p.x0=0;p.mv=0;ship={mode:'orbit',p,a:-Math.PI/2,dir:1,w:2.4,x:0,y:0,vx:0,vy:0,ft:0,best:0,from:p,fx:0};
 Object.assign(G,{score:0,camY:0,freeze:0,sec:0});Object.assign(RUN,{stars:0,skips:0,used:0,fixes:1+S.up.thrust,shield:S.up.shield,maxSec:0});
 $('score').textContent='0';$('sub').textContent=SECTORS[0].n;$('starsNow').textContent='0';hudFix()}
function gapAfter(i){return 250+Math.min(110,i*4)+R()*70+(planets[planets.length-1]&&planets[planets.length-1].type==='gas'?30:0)}
function hudFix(){$('fixes').innerHTML=Array.from({length:Math.max(RUN.fixes,1+S.up.thrust)},(_,i)=>'<i class="'+(i<RUN.fixes?'':'off')+'"></i>').join('')+(RUN.shield?'<span style="width:6px"></span>'+'<i class="sh"></i>'.repeat(RUN.shield):'')}

/* ================= audio ================= */
let AC=null,master,sfxG,musG,NB,dly;
function audio(){if(AC){if(AC.state==='suspended')AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return}
 master=AC.createGain();sfxG=AC.createGain();musG=AC.createGain();dly=AC.createDelay();dly.delayTime.value=.36;const fb=AC.createGain();fb.gain.value=.38;const dl=AC.createBiquadFilter();dl.frequency.value=2200;
 musG.connect(master);musG.connect(dly);dly.connect(dl);dl.connect(fb);fb.connect(dly);dl.connect(master);sfxG.connect(master);master.connect(AC.destination);
 NB=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=R()*2-1;mus.next=AC.currentTime+.1;applyVol()}
function applyVol(){if(!AC)return;master.gain.value=S.set.mute?0:1;sfxG.gain.value=S.set.vol/100*.9;musG.gain.setTargetAtTime(S.set.mus/100*.4*(G.state==='play'&&!G.paused?1:.5),AC.currentTime,.3)}
function tone(f,d,v,type,at,f2){if(!AC)return;const t=AC.currentTime+(at||0),o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(sfxG);o.start(t);o.stop(t+d+.05)}
function noise(d,v,f,type,at,f2){if(!AC)return;const t=AC.currentTime+(at||0),s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=NB;fl.type=type||'lowpass';fl.frequency.setValueAtTime(f,t);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(fl);fl.connect(g);g.connect(sfxG);s.start(t,R()*.5);s.stop(t+d+.05)}
const SFX={
 release(){noise(.35,.25,400,'bandpass',0,2400);tone(300,.2,.05,'triangle',0,600)},
 capture(n){const f=330*Math.pow(2,(n%12)/12);tone(f,.4,.12,'sine');tone(f*1.5,.35,.06,'triangle',.05);tone(f*2,.5,.04,'sine',.1)},
 star(){tone(1320,.15,.07,'triangle');tone(1980,.2,.05,'sine',.05)},
 skip(){[0,4,7,12].forEach((s,i)=>tone(523*Math.pow(2,s/12),.3,.09,'triangle',i*.06))},
 fix(){noise(.4,.35,1200,'bandpass',0,300);tone(120,.3,.1,'sawtooth',0,70)},
 crash(){noise(1,.6,1500,'lowpass',0,80);tone(120,.8,.25,'sawtooth',0,30);tone(60,1,.3,'sine',.05,25)},
 lost(){tone(500,1.2,.1,'sine',0,80);tone(750,1.2,.05,'triangle',.1,120)},
 hole(){tone(90,1.5,.25,'sine',0,20);noise(1.5,.4,600,'lowpass',0,40)},
 shield(){tone(880,.25,.1,'square',0,440);noise(.3,.3,3000,'highpass')},
 sector(){[0,7,12,16,19].forEach((s,i)=>tone(392*Math.pow(2,s/12),.6,.07,'triangle',i*.09))},
 click(){tone(800,.05,.05,'triangle')},
 mission(){[0,7,12].forEach((s,i)=>tone(660*Math.pow(2,s/12),.3,.09,'triangle',i*.08))},
 buy(){[0,4,7,12].forEach((s,i)=>tone(880*Math.pow(2,s/12),.18,.07,'square',i*.05))}};
/* music: slow minor progression, arpeggio through a delay, a bass pulse that joins in later sectors */
const CH=[[57,60,64,67],[53,57,60,64],[55,59,62,66],[52,55,59,62]],mus={next:0,step:0},mf=n=>440*Math.pow(2,(n-69)/12);
function mt(f,t,d,v,type,cut){const o=AC.createOscillator(),g=AC.createGain(),fl=AC.createBiquadFilter();o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=cut;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+Math.min(.4,d*.3));g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(fl);fl.connect(g);g.connect(musG);o.start(t);o.stop(t+d+.05)}
function music(){if(!AC||AC.state!=='running')return;const sp=60/96/2,lv=G.state==='play'?G.sec:0;
 while(mus.next<AC.currentTime+.25){const t=mus.next,s=mus.step,ch=CH[(s>>4)%4];
  if(s%16==0){ch.forEach(n=>mt(mf(n-12),t,sp*16.5,.035,'sawtooth',700));mt(mf(ch[0]-24),t,sp*16,.08,'sine',300)}
  if(s%2==0){const n=ch[[0,1,2,3,2,1,0,2][(s>>1)%8]]+12;mt(mf(n),t,sp*2.2,.03,'triangle',2600)}
  if(lv>=1&&s%4==0)mt(mf(ch[0]-24),t,sp*1.8,.07,'square',220);
  if(lv>=2&&s%8==4){const b=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();b.buffer=NB;f.type='highpass';f.frequency.value=6000;g.gain.setValueAtTime(.05,t);g.gain.exponentialRampToValueAtTime(.0001,t+.08);b.connect(f);f.connect(g);g.connect(musG);b.start(t,R()*.5);b.stop(t+.1)}
  mus.next+=sp;mus.step++}}

/* ================= missions ================= */
const MK={
 reach:{t:n=>'Reach planet '+n,run:1,tiers:[5,10,15,25,35,50,70,90]},
 stars:{t:n=>'Collect '+n+' stars in one launch',run:1,tiers:[3,6,10,15,22,30]},
 skips:{t:n=>n==1?'Skip past a planet':'Skip '+n+' planets in one launch',run:1,tiers:[1,2,4,6,9]},
 sector:{t:n=>'Reach the '+SECTORS[n].n,run:1,tiers:[1,2,3,4,5]},
 clean:{t:n=>'Reach planet '+n+' without a course correction',run:1,tiers:[6,12,20,30]},
 runs:{t:n=>'Launch '+n+' times',run:0,tiers:[3,5,8]}};
function newMission(skip){const keys=Object.keys(MK).filter(k=>!S.missions.some(m=>m.k===k)&&k!==skip),k=keys[Math.floor(R()*keys.length)],lv=S.mlv[k]||0,tr=MK[k].tiers;
 if(k==='sector'&&lv>=tr.length)return newMission('sector');
 const n=Math.round(tr[Math.min(lv,tr.length-1)]*(lv>=tr.length?1+(lv-tr.length+1)*.25:1));return{k,n,p:0,r:10+Math.min(lv,8)*6+(k==='reach'||k==='clean'?8:0)}}
while(S.missions.length<3)S.missions.push(newMission());
function drawMissions(el){el.innerHTML='<h3>Missions</h3>'+S.missions.map(m=>'<div class="mi'+(m.p>=m.n?' done':'')+'"><span>'+MK[m.k].t(m.n)+'</span><small>'+(m.p>=m.n?'✓ +'+m.r:(MK[m.k].run?'':m.p+'/'+m.n+' · ')+'<i class="star"></i> '+m.r)+'</small></div>').join('')}
function progress(k,v){S.missions.forEach(m=>{if(m.k!==k||m.p>=m.n)return;m.p=MK[k].run?Math.max(m.p,v):m.p+1;if(m.p>=m.n){S.stars+=m.r;toast('Mission done: '+MK[k].t(m.n)+'  +'+m.r+' ★');SFX.mission()}})}
function rollMissions(){S.missions=S.missions.map(m=>{if(m.p>=m.n){S.mlv[m.k]=(S.mlv[m.k]||0)+1;return newMission(m.k)}if(MK[m.k].run)m.p=0;return m})}

/* ================= feedback helpers ================= */
let toastT=0;function toast(t){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),2300)}
function announce(t,sm){const e=$('event');e.innerHTML=t+(sm?'<small>'+sm+'</small>':'');e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),sm?1900:900)}
function shake(v){if(S.set.shake)G.shake=Math.max(G.shake,v)}
function flash(v){const f=$('flash');f.style.transition='none';f.style.opacity=v;requestAnimationFrame(()=>{f.style.transition='opacity .4s';f.style.opacity=0})}
function popScore(){const s=$('score');s.classList.add('pop');setTimeout(()=>s.classList.remove('pop'),120)}

/* ================= play ================= */
function release(){if(ship.mode!=='orbit')return;const p=ship.p,sp=ship.w*p.orb*1.12+120;ship.mode='fly';ship.nw=0;ship.vx=-Math.sin(ship.a)*sp*ship.dir;ship.vy=Math.cos(ship.a)*sp*ship.dir;ship.ft=0;ship.from=p;SFX.release();burst(ship.x,ship.y,skin().acc,10,60,.4,2.5)}
function correct(){if(ship.mode!=='fly'||RUN.fixes<=0||ship.ft<.05)return;
 const va=Math.atan2(ship.vy,ship.vx),sp=Math.hypot(ship.vx,ship.vy);let bestP=null,bd=1e9;
 for(const p of planets){if(p===ship.from||p.id<=ship.from.id)continue;const dx=p.x-ship.x,dy=p.y-ship.y,d=Math.hypot(dx,dy);let da=Math.atan2(dy,dx)-va;da=Math.atan2(Math.sin(da),Math.cos(da));if(Math.abs(da)>1.3||d>900)continue;const sc=d*(1+Math.abs(da));if(sc<bd){bd=sc;bestP=p}}
 if(!bestP){if(!ship.nw){ship.nw=1;tone(140,.12,.08,'square');toast('No planet ahead to steer toward')}return}
 /* aim at the near edge of its orbit, not the planet itself */
 const dx=bestP.x-ship.x,dy=bestP.y-ship.y,d=Math.hypot(dx,dy),aimA=Math.atan2(dy,dx)+(d>bestP.orb?Math.asin(clamp((bestP.orb-6)/d,-1,1))*(((ship.vx*dy-ship.vy*dx)>0)?-1:1)*.85:0);
 let da=aimA-va;da=Math.atan2(Math.sin(da),Math.cos(da));const na=va+clamp(da,-.42,.42),ns=Math.max(sp,260)*1.06;
 ship.vx=Math.cos(na)*ns;ship.vy=Math.sin(na)*ns;ship.fx=.35;RUN.fixes--;RUN.used++;hudFix();SFX.fix();shake(.12);burst(ship.x,ship.y,'#ffb347',18,140,.5,3)}
function capture(p){const dx=ship.x-p.x,dy=ship.y-p.y,a=Math.atan2(dy,dx),cr=dx*ship.vy-dy*ship.vx;ship.mode='orbit';ship.p=p;ship.a=a;ship.dir=cr>0?1:-1;ship.w=clamp(2.2+G.score*.035,2.2,3.6)*p.spin;
 if(p.id>ship.best){const jump=p.id-ship.best;ship.best=p.id;G.score=p.id;$('score').textContent=G.score;popScore();SFX.capture(G.score);burst(ship.x,ship.y,`hsl(${p.hue},90%,70%)`,22,110,.6);G.freeze=.05;shake(.1);
  if(jump>1){RUN.skips+=jump-1;const b=2*(jump-1);RUN.stars+=b;S.stars+=b;$('starsNow').textContent=RUN.stars;announce(jump>2?'Double skip!':'Skip!','+'+b+' stars');SFX.skip();progress('skips',RUN.skips)}
  progress('reach',G.score);if(RUN.used===0)progress('clean',G.score);
  const sec=secOf(p.id);if(sec>G.sec){G.sec=sec;RUN.maxSec=sec;RUN.fixes=Math.min(5,RUN.fixes+1);hudFix();announce(SECTORS[sec].n,'Sector '+(sec+1)+' · +1 course correction');SFX.sector();flash(.15);$('sub').textContent=SECTORS[sec].n;progress('sector',sec)}
  while(planets[planets.length-1].id<p.id+8){const l=planets[planets.length-1];addPlanet(l.y+gapAfter(l.id),l.id+1)}
  /* forget what is far behind */
  const cut=p.y-1400;planets=planets.filter(q=>q.y>cut||q===p);stars=stars.filter(s=>s.y>cut);rocks=rocks.filter(r=>r.y>cut);holes=holes.filter(h=>h.y>cut)}}
function useShield(){if(RUN.shield<=0)return false;RUN.shield--;hudFix();SFX.shield();flash(.2);shake(.25);toast('Shield absorbed the hit');burst(ship.x,ship.y,'#8dffb0',30,160,.6);return true}
function die(why,kind){G.state='over';ship.mode='dead';shake(.6);flash(kind==='lost'?.05:.35);
 if(kind==='lost')SFX.lost();else if(kind==='hole')SFX.hole();else{SFX.crash();burst(ship.x,ship.y,'#ffb347',50,240,.9,4);burst(ship.x,ship.y,'#ffffff',20,120,.5,2)}
 S.runs++;progress('runs',S.runs);const nb=G.score>S.best;if(nb)S.best=G.score;save();applyVol();
 setTimeout(()=>{if(G.state!=='over')return;$('oT').textContent=nb&&G.score>0?'New record!':why;$('oS').textContent=G.score;$('oSec').textContent='planets · reached the '+SECTORS[RUN.maxSec].n;
  $('oStats').innerHTML='<div><b>+'+RUN.stars+'</b>Stars</div><div><b>'+RUN.skips+'</b>Skips</div><div><b>'+RUN.used+'</b>Corrections used</div><div><b>'+S.best+'</b>Best</div>';
  drawMissions($('missionsOver'));rollMissions();save();show('over');if(nb&&G.score>0)SFX.sector()},1000)}

function step(dt){G.t+=dt;
 for(const p of planets)if(p.mv)p.x=p.x0+Math.sin(G.t*p.mv/120+p.ph)*p.amp;
 const hw=halfW()+40;for(const a of rocks){a.x+=a.vx*dt;a.rot+=a.vr*dt;if(a.x>hw)a.x=-hw;if(a.x<-hw)a.x=hw}
 if(ship.mode==='orbit'){const p=ship.p;ship.a+=ship.w*ship.dir*dt;ship.x=p.x+Math.cos(ship.a)*p.orb;ship.y=p.y+Math.sin(ship.a)*p.orb}
 else if(ship.mode==='fly'){ship.ft+=dt;ship.fx=Math.max(0,ship.fx-dt);
  for(const p of planets){if(p===ship.from&&ship.ft<.25)continue;const dx=p.x-ship.x,dy=p.y-ship.y,d2=dx*dx+dy*dy,inf=(p.orb+70)*(p.orb+70);if(d2<inf){const d=Math.sqrt(d2),f=90000/d2;ship.vx+=dx/d*f*dt;ship.vy+=dy/d*f*dt}}
  for(const h of holes){const dx=h.x-ship.x,dy=h.y-ship.y,d2=dx*dx+dy*dy;if(d2<h.pull*h.pull){const d=Math.sqrt(d2),f=h.k/Math.max(d2,400);ship.vx+=dx/d*f*dt;ship.vy+=dy/d*f*dt;if(d<h.core){die('Swallowed by a black hole','hole');return}}}
  ship.x+=ship.vx*dt;ship.y+=ship.vy*dt;
  const tb=S.up.tractor*5;
  for(const p of planets){if(p===ship.from&&ship.ft<.25)continue;const d=Math.hypot(ship.x-p.x,ship.y-p.y);
   if(d<p.r+3){if(useShield()){capture(p);break}die('Crashed into a planet','crash');return}
   if(d<p.orb+4+tb&&ship.ft>.08){capture(p);break}}
  if(ship.mode==='fly')for(const a of rocks){if(Math.hypot(a.x-ship.x,a.y-ship.y)<a.r+5){if(useShield()){a.y=-1e9;break}die('Hit an asteroid','crash');return}}
  const sx=ship.x,sy=ship.y-G.camY;if(Math.abs(sx)>halfW()+60||sy<-halfH()-80||ship.ft>5)die('Lost in space','lost')}
 const mr=22+S.up.magnet*14;
 if(ship.mode==='fly'||ship.mode==='orbit')for(const s of stars){if(s.got)continue;const d=Math.hypot(s.x-ship.x,s.y-ship.y);
  if(d<mr+30&&S.up.magnet){s.x+=(ship.x-s.x)*Math.min(1,dt*6);s.y+=(ship.y-s.y)*Math.min(1,dt*6)}
  if(d<mr){s.got=true;RUN.stars++;S.stars++;$('starsNow').textContent=RUN.stars;SFX.star();burst(s.x,s.y,'#ffe36b',12,90,.5);progress('stars',RUN.stars)}}
 if(ship.mode!=='dead'){trail.push(ship.x,ship.y);if(trail.length>80)trail.splice(0,2)}
 if(ship.mode==='fly'&&R()<.6){const o=P[pi=(pi+1)%P.length],sp=Math.hypot(ship.vx,ship.vy)||1;o.on=true;o.x=ship.x-ship.vx/sp*8;o.y=ship.y-ship.vy/sp*8;o.vx=-ship.vx*.15+rr(-20,20);o.vy=-ship.vy*.15+rr(-20,20);o.t=0;o.life=.35;o.c=ship.fx>0?'#ffb347':skin().acc;o.s=2.5}
 const target=(ship.mode==='orbit'?ship.p.y:ship.mode==='dead'?G.camY-160:ship.y)+160;G.camY+=(target-G.camY)*(1-Math.exp(-3*dt));
 for(const o of P){if(!o.on)continue;o.t+=dt;o.x+=o.vx*dt;o.y+=o.vy*dt;o.vx*=.97;o.vy*=.97;if(o.t>o.life)o.on=false}
 G.shake=Math.max(0,G.shake-dt*1.4)}

/* ================= draw ================= */
const BG=[];for(let i=0;i<220;i++)BG.push({x:rr(-1,1),y:R()*1600,z:.15+R()*.85,s:R()*1.6+.4,tw:R()*6});
const NEB=[];for(let i=0;i<7;i++)NEB.push({x:rr(-1,1)*350,y:i*700+rr(0,300),r:rr(260,480),o:rr(.06,.13),dh:rr(-30,30)});
let bgHue=228,bgFrom=228,bgT=1,bgSec=0;
function skyGrad(h,a){const g=x.createLinearGradient(0,0,0,cv.height);g.addColorStop(0,`hsl(${h},45%,11%)`);g.addColorStop(1,`hsl(${h+20},50%,4%)`);x.globalAlpha=a;x.fillStyle=g;x.fillRect(0,0,cv.width,cv.height);x.globalAlpha=1}
function draw(){const k=SC*dpr,low=S.set.low;x.setTransform(1,0,0,1,0,0);
 if(bgSec!==G.sec){bgFrom=bgT<1?bgFrom:bgHue;bgSec=G.sec;bgT=0}bgHue=SECTORS[G.sec].h;bgT=Math.min(1,bgT+.012);
 skyGrad(bgFrom,1);if(bgT<1)skyGrad(bgHue,bgT);else{bgFrom=bgHue;skyGrad(bgHue,1)}
 const sh=G.shake*14,ox=(R()-.5)*sh*dpr,oy=(R()-.5)*sh*dpr;
 /* far background in screen space with parallax */
 if(!low)for(const n of NEB){const yy=((n.y-G.camY*.15)%4900+4900)%4900-1200;const sx=cv.width/2+n.x*k,sy=cv.height/2-yy*k*.5;const rg=x.createRadialGradient(sx,sy,0,sx,sy,n.r*k);rg.addColorStop(0,`hsla(${bgHue+n.dh+40},80%,55%,${n.o})`);rg.addColorStop(1,`hsla(${bgHue+n.dh+40},80%,50%,0)`);x.fillStyle=rg;x.fillRect(sx-n.r*k,sy-n.r*k,n.r*2*k,n.r*2*k)}
 const bw=cv.width,bh=cv.height;for(let i=0;i<(low?110:BG.length);i++){const s=BG[i],yy=((s.y-G.camY*s.z*.5)%1600+1600)%1600/1600*bh*1.05;const tw=.55+.45*Math.sin(G.t*2+s.tw);x.fillStyle=`rgba(225,235,255,${(.25+s.z*.6)*tw})`;x.fillRect(bw/2+s.x*bw*.55,bh-yy,s.s*dpr,s.s*dpr)}
 /* world: y up, centred on camY */
 x.setTransform(k,0,0,-k,cv.width/2+ox,cv.height/2+oy);x.translate(0,-G.camY);
 const vis=halfH()+140;
 for(const h of holes){if(Math.abs(h.y-G.camY)>vis+200)continue;
  const rg=x.createRadialGradient(h.x,h.y,h.core,h.x,h.y,h.pull);rg.addColorStop(0,'rgba(140,90,255,.25)');rg.addColorStop(.3,'rgba(80,60,200,.08)');rg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=rg;x.beginPath();x.arc(h.x,h.y,h.pull,0,TAU);x.fill();
  for(let i=0;i<3;i++){x.strokeStyle=`rgba(${255-i*40},${170-i*30},${90+i*60},${.6-i*.15})`;x.lineWidth=(4-i)/1;x.beginPath();x.ellipse(h.x,h.y,h.core*(2.1+i*.5),h.core*(.7+i*.15),G.t*(.6+i*.25),0,TAU);x.stroke()}
  x.fillStyle='#000';x.beginPath();x.arc(h.x,h.y,h.core,0,TAU);x.fill();x.strokeStyle='rgba(255,200,140,.8)';x.lineWidth=1.5;x.beginPath();x.arc(h.x,h.y,h.core+1,0,TAU);x.stroke()}
 for(const p of planets){if(Math.abs(p.y-G.camY)>vis+p.orb)continue;
  const active=ship.mode==='orbit'&&ship.p===p,nextOne=p.id===ship.best+1;
  x.strokeStyle=`hsla(${p.hue},90%,75%,${active?.35:nextOne?.5:.2})`;x.lineWidth=(nextOne?2:1.5)/SC;x.setLineDash([5/SC,7/SC]);x.lineDashOffset=-G.t*20/SC;x.beginPath();x.arc(p.x,p.y,p.orb,0,TAU);x.stroke();x.setLineDash([]);
  if(p.ring){x.strokeStyle=`hsla(${p.hue+40},70%,80%,.55)`;x.lineWidth=4;x.beginPath();x.ellipse(p.x,p.y,p.r*1.75,p.r*.45,.35,Math.PI,TAU);x.stroke()}
  x.save();x.translate(p.x,p.y);x.rotate(G.t*.05*p.spin);x.drawImage(p.img,-p.isz/2,-p.isz/2,p.isz,p.isz);x.restore();
  if(p.ring){x.strokeStyle=`hsla(${p.hue+40},70%,85%,.75)`;x.lineWidth=4;x.beginPath();x.ellipse(p.x,p.y,p.r*1.75,p.r*.45,.35,0,Math.PI);x.stroke()}}
 for(const a of rocks){if(Math.abs(a.y-G.camY)>vis)continue;x.save();x.translate(a.x,a.y);x.rotate(a.rot);x.drawImage(a.img,-a.r,-a.r,a.r*2,a.r*2);x.restore()}
 for(const s of stars){if(s.got||Math.abs(s.y-G.camY)>vis)continue;x.save();x.translate(s.x,s.y);x.rotate(G.t*1.5+s.ph);const sc=1+.12*Math.sin(G.t*5+s.ph);x.scale(sc,sc);
  if(!low){x.fillStyle='rgba(255,227,107,.18)';x.beginPath();x.arc(0,0,18,0,TAU);x.fill()}
  x.fillStyle='#ffe36b';x.beginPath();for(let i=0;i<10;i++){const r=i%2?5:12,a=i/10*TAU;x.lineTo(Math.cos(a)*r,Math.sin(a)*r)}x.fill();x.restore()}
 /* aim guide: where you would go if you let go now */
 const aimOn=S.set.aim==='always'||(S.set.aim==='early'&&G.score<5);
 if(aimOn&&ship.mode==='orbit'&&G.state==='play'){const dx=-Math.sin(ship.a)*ship.dir,dy=Math.cos(ship.a)*ship.dir;x.fillStyle='rgba(255,255,255,.5)';for(let i=1;i<14;i++){const d=i*24;x.globalAlpha=1-i/14;x.beginPath();x.arc(ship.x+dx*d,ship.y+dy*d,2.2,0,TAU);x.fill()}x.globalAlpha=1}
 const sk=skin(),tc=sk.trail;
 for(let i=2;i<trail.length;i+=2){const f=i/trail.length;x.strokeStyle=`rgba(${tc[0]},${tc[1]},${tc[2]},${f*.75})`;x.lineWidth=f*7;x.beginPath();x.moveTo(trail[i-2],trail[i-1]);x.lineTo(trail[i],trail[i+1]);x.stroke()}
 for(const o of P){if(!o.on)continue;x.globalAlpha=1-o.t/o.life;x.fillStyle=o.c;x.fillRect(o.x-o.s/2,o.y-o.s/2,o.s,o.s)}x.globalAlpha=1;
 if(ship.mode!=='dead')drawShip(sk);
}
function drawShip(sk){const ang=ship.mode==='fly'?Math.atan2(ship.vy,ship.vx):ship.a+Math.PI/2*ship.dir;
 x.save();x.translate(ship.x,ship.y);x.rotate(ang);
 if(RUN.shield&&G.state==='play'){x.strokeStyle=`rgba(141,255,176,${.35+.15*Math.sin(G.t*6)})`;x.lineWidth=1.5;x.beginPath();x.arc(0,0,15,0,TAU);x.stroke()}
 if(ship.mode==='fly'){const fl=ship.fx>0?16:9+Math.sin(G.t*40)*2;const fg=x.createLinearGradient(-6,0,-6-fl,0);fg.addColorStop(0,ship.fx>0?'#fff2c0':'#ffffff');fg.addColorStop(.4,ship.fx>0?'#ff9a2a':sk.acc);fg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=fg;x.beginPath();x.moveTo(-6,-3.5);x.lineTo(-6-fl,0);x.lineTo(-6,3.5);x.fill()}
 x.fillStyle=sk.acc;x.beginPath();x.moveTo(-5,0);x.lineTo(-9,-8);x.lineTo(-2,-4);x.closePath();x.fill();x.beginPath();x.moveTo(-5,0);x.lineTo(-9,8);x.lineTo(-2,4);x.closePath();x.fill();
 x.fillStyle=sk.body;x.beginPath();x.moveTo(11,0);x.quadraticCurveTo(4,-6,-7,-4.5);x.lineTo(-7,4.5);x.quadraticCurveTo(4,6,11,0);x.fill();
 x.fillStyle='rgba(0,0,0,.25)';x.beginPath();x.moveTo(11,0);x.quadraticCurveTo(4,6,-7,4.5);x.lineTo(-7,1);x.closePath();x.fill();
 x.fillStyle=sk.acc;x.beginPath();x.ellipse(3,0,3.2,2,0,0,TAU);x.fill();x.fillStyle='rgba(255,255,255,.8)';x.beginPath();x.ellipse(4,-.6,1.2,.7,0,0,TAU);x.fill();
 x.restore()}

/* ================= flow ================= */
const PANELS=['start','how','shop','settings','pause','over'];let back='start';
function show(id){PANELS.forEach(p=>$(p).classList.toggle('hide',p!==id))}
function openPanel(id){SFX.click();back=['start','pause','over'].find(p=>!$(p).classList.contains('hide'))||back;if(id==='shop')drawShop();if(id==='settings')loadSettings();show(id)}
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{e.stopPropagation();audio();openPanel(b.dataset.open)});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=e=>{e.stopPropagation();SFX.click();show(back);if(back==='start')drawMenu();if(back==='over')drawMissions($('missionsOver'))});
function drawMenu(){drawMissions($('missionsStart'));$('bestS').textContent=(S.best?'Best: planet '+S.best+' · ':'')+S.stars+' stars to spend'}
function start(){audio();show('');document.body.classList.add('playing');G.paused=false;reset();G.state='play';applyVol()}
function pause(on){if(G.state!=='play')return;G.paused=on;show(on?'pause':'');applyVol();SFX.click()}
function toMenu(){G.state='menu';G.paused=false;document.body.classList.remove('playing');reset();show('start');drawMenu();applyVol()}
$('play').onclick=e=>{e.stopPropagation();start()};$('again').onclick=e=>{e.stopPropagation();start()};
$('resume').onclick=e=>{e.stopPropagation();pause(false)};$('restartP').onclick=e=>{e.stopPropagation();start()};
$('quitP').onclick=e=>{e.stopPropagation();toMenu()};$('menuO').onclick=e=>{e.stopPropagation();toMenu()};
$('pauseBtn').onclick=e=>{e.stopPropagation();audio();pause(!G.paused)};
function act(){if(G.state!=='play'||G.paused)return;if(ship.mode==='orbit')release();else if(ship.mode==='fly')correct()}
addEventListener('pointerdown',e=>{if(e.target.closest&&e.target.closest('.panel,button'))return;audio();act()});
addEventListener('keydown',e=>{audio();
 if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(e.repeat)return;if(G.state==='play'&&!G.paused)act();else if(G.paused)pause(false);else if(G.state==='over'&&!$('over').classList.contains('hide'))start();else if(G.state==='menu'&&!$('start').classList.contains('hide'))start()}
 else if(e.code==='Escape'||e.code==='KeyP'){if(G.state==='play')pause(!G.paused)}
 else if(e.code==='KeyR'&&(G.state==='play'||G.state==='over'))start()});
addEventListener('visibilitychange',()=>{if(document.hidden&&G.state==='play'&&!G.paused)pause(true)});
/* hangar */
function shipIcon(sk){const c=document.createElement('canvas');c.width=c.height=88;const g=c.getContext('2d');const sx=x;g.setTransform(3.6,0,0,3.6,44,44);
 /* draw the same probe shape */
 g.fillStyle=sk.acc;g.beginPath();g.moveTo(-5,0);g.lineTo(-9,-8);g.lineTo(-2,-4);g.fill();g.beginPath();g.moveTo(-5,0);g.lineTo(-9,8);g.lineTo(-2,4);g.fill();
 g.fillStyle=sk.body;g.beginPath();g.moveTo(11,0);g.quadraticCurveTo(4,-6,-7,-4.5);g.lineTo(-7,4.5);g.quadraticCurveTo(4,6,11,0);g.fill();g.fillStyle=sk.acc;g.beginPath();g.ellipse(3,0,3.2,2,0,0,TAU);g.fill();return c.toDataURL()}
function drawShop(){$('starsShop').textContent=S.stars;
 $('upList').innerHTML=UPS.map(u=>{const lv=S.up[u.id],max=u.costs.length,c=u.costs[lv];return '<div class="it"><div class="ic" style="font-size:22px">'+u.ic+'</div><div class="tx"><b>'+u.n+'<span class="lv">'+u.costs.map((_,i)=>'<i class="'+(i<lv?'f':'')+'"></i>').join('')+'</span></b>'+u.d+'</div>'+(lv>=max?'<button disabled>Maxed</button>':'<button data-up="'+u.id+'"'+(S.stars<c?' disabled':'')+'>★ '+c+'</button>')+'</div>'}).join('');
 $('skinList').innerHTML=SKINS.map(s=>{const own=S.skins.includes(s.id),on=S.skin===s.id;return '<div class="it'+(on?' on':'')+'"><div class="ic" style="background:#141a33 url('+shipIcon(s)+') center/contain no-repeat"></div><div class="tx"><b>'+s.n+'</b>'+s.d+'</div>'+(on?'<button disabled>Flying</button>':own?'<button data-skin="'+s.id+'">Fly</button>':'<button data-buy="'+s.id+'"'+(S.stars<s.cost?' disabled':'')+'>★ '+s.cost+'</button>')+'</div>'}).join('');
 document.querySelectorAll('#shop button[data-up],#shop button[data-skin],#shop button[data-buy]').forEach(b=>b.onclick=e=>{e.stopPropagation();
  if(b.dataset.up){const u=UPS.find(q=>q.id===b.dataset.up),c=u.costs[S.up[u.id]];if(S.stars<c)return;S.stars-=c;S.up[u.id]++;SFX.buy()}
  else if(b.dataset.buy){const s=SKINS.find(q=>q.id===b.dataset.buy);if(S.stars<s.cost)return;S.stars-=s.cost;S.skins.push(s.id);S.skin=s.id;SFX.buy()}
  else{S.skin=b.dataset.skin;SFX.click()}
  save();drawShop()})}
/* settings */
function loadSettings(){$('sVol').value=S.set.vol;$('sMus').value=S.set.mus;$('sMute').checked=S.set.mute;$('sShake').checked=S.set.shake;$('sAim').value=S.set.aim;$('sLow').checked=S.set.low}
$('sVol').oninput=e=>{S.set.vol=+e.target.value;applyVol();save()};$('sVol').onchange=()=>SFX.star();
$('sMus').oninput=e=>{S.set.mus=+e.target.value;applyVol();save()};
$('sMute').onchange=e=>{S.set.mute=e.target.checked;applyVol();save()};
$('sShake').onchange=e=>{S.set.shake=e.target.checked;save()};
$('sAim').onchange=e=>{S.set.aim=e.target.value;save()};
$('sLow').onchange=e=>{S.set.low=e.target.checked;save();resize()};

/* ================= loop: fixed 120 Hz physics ================= */
/* collect a vault payout sent from Tumbler (the daily safe on this site) */
function collectBank(){let bank;try{bank=JSON.parse(localStorage.getItem('gbs-bank')||'{}')}catch(e){return}const b=bank&&bank.slingshot;if(!b||!b.stars)return;
 const n=b.stars;S.stars+=n;delete bank.slingshot;try{localStorage.setItem('gbs-bank',JSON.stringify(bank))}catch(e){}save();drawMenu();setTimeout(()=>toast('Vault payout from Tumbler: +'+n+' stars'),600)}
reset();drawMenu();collectBank();addEventListener('focus',collectBank);
let last=performance.now(),acc=0;const FIX=1/120;
function loop(now){requestAnimationFrame(loop);let dt=Math.min(.05,(now-last)/1000);last=now;music();
 if(!G.paused){if(G.freeze>0){G.freeze-=dt;dt*=.1}
  if(G.state==='play'||G.state==='over'){acc+=dt;while(acc>=FIX){step(FIX);acc-=FIX}}
  else{G.t+=dt;ship.a+=ship.w*dt;ship.x=ship.p.x+Math.cos(ship.a)*ship.p.orb;ship.y=ship.p.y+Math.sin(ship.a)*ship.p.orb;trail.push(ship.x,ship.y);if(trail.length>80)trail.splice(0,2);G.camY+=(ship.p.y+60-G.camY)*.05}}
 draw()}
requestAnimationFrame(loop);
window.__SL={G,S,RUN,get ship(){return ship},get planets(){return planets},get rocks(){return rocks},get holes(){return holes},release,correct,start,pause,toMenu,step};
})();
