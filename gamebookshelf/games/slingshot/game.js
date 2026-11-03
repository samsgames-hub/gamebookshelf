/* SLINGSHOT — orbit, let go, get caught by the next planet. Canvas 2D. */
(()=>{'use strict';
const $=id=>document.getElementById(id),cv=$('c'),x=cv.getContext('2d'),R=Math.random,TAU=Math.PI*2,clamp=(v,a,b)=>v<a?a:v>b?b:v;
let W=0,Hh=0,S=1,dpr=1;// world units: the play column is 600 wide
function resize(){dpr=Math.min(devicePixelRatio||1,2);W=innerWidth;Hh=innerHeight;cv.width=W*dpr;cv.height=Hh*dpr;S=Math.min(W/600,Hh/900)*1.0}
addEventListener('resize',resize);resize();
let best=0;try{best=+localStorage.getItem('slingshot1')||0}catch(e){}
const G={state:'start',score:0,stars:0,camY:0,t:0,shake:0};
let planets=[],stars=[],parts=[],trail=[],ship=null,bg=[];
const HUES=[195,280,330,30,140,55,250];
for(let i=0;i<160;i++)bg.push({x:R()*600-300,y:R()*1400,z:.2+R()*.8,s:R()*1.6+.3});
function addPlanet(y,i){const r=22+R()*24+(i>12?R()*8:0),last=planets[planets.length-1];let px=(R()-.5)*420;if(last&&Math.abs(px-last.x)<90)px=last.x+(px>last.x?1:-1)*(90+R()*60);px=clamp(px,-230,230);
 const mv=i>6&&R()<Math.min(.6,(i-6)*.05);planets.push({x:px,y,r,orb:r+26,hue:HUES[i%HUES.length],mv:mv?(60+R()*60)*(R()<.5?-1:1):0,ph:R()*TAU,x0:px,id:i,ring:R()<.3});
 if(i>0&&R()<.75){const a=planets[planets.length-2];if(a){const t=.35+R()*.3;stars.push({x:a.x+(px-a.x)*t+(R()-.5)*60,y:a.y+(y-a.y)*t,got:false})}}}
function reset(){planets=[];stars=[];parts=[];trail=[];let y=0;for(let i=0;i<12;i++){addPlanet(y,i);y+=250+Math.min(80,i*4)+R()*60}
 const p=planets[0];p.x=0;p.x0=0;p.mv=0;ship={mode:'orbit',p,a:-Math.PI/2,dir:1,w:2.4,x:0,y:0,vx:0,vy:0,ft:0};G.score=0;G.stars=0;G.camY=0;$('score').textContent='0';$('sub').textContent=''}
// ---------------- audio ----------------
let AC=null;const audio=()=>{if(AC){AC.state==='suspended'&&AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}};
function tone(f,d,v,type,f2){if(!AC)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d+.05)}
function burst(px,py,hue,n,sp){for(let i=0;i<n;i++){const a=R()*TAU,s=sp*(.3+R());parts.push({x:px,y:py,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:.5+R()*.6,t:0,hue})}}
// ---------------- play ----------------
function release(){if(ship.mode!=='orbit')return;const p=ship.p,sp=ship.w*p.orb*1.12+120;ship.mode='fly';ship.vx=-Math.sin(ship.a)*sp*ship.dir;ship.vy=Math.cos(ship.a)*sp*ship.dir;ship.ft=0;ship.from=p;tone(520,.12,.06,'triangle',300)}
function capture(p){const dx=ship.x-p.x,dy=ship.y-p.y,a=Math.atan2(dy,dx),cr=dx*ship.vy-dy*ship.vx;ship.mode='orbit';ship.p=p;ship.a=a;ship.dir=cr>0?1:-1;ship.w=clamp(2.2+G.score*.04,2.2,3.6);
 if(p.id>(ship.best||0)){ship.best=p.id;G.score=p.id;$('score').textContent=G.score;tone(440+G.score*12,.25,.08,'sine');burst(ship.x,ship.y,p.hue,14,90);
  while(planets[planets.length-1].id<p.id+8){const l=planets[planets.length-1];addPlanet(l.y+250+Math.min(110,l.id*4)+R()*70,l.id+1)}}}
function die(why){G.state='over';G.shake=.5;burst(ship.x,ship.y,40,40,220);tone(160,.5,.1,'sawtooth',60);ship.mode='dead';const sc=G.score+G.stars*0;
 if(G.score>best){best=G.score;try{localStorage.setItem('slingshot1',best)}catch(e){}}
 setTimeout(()=>{$('oT').textContent=why;$('oS').textContent=G.score;$('oB').textContent=(G.stars?G.stars+' stars collected. ':'')+'Best: '+best;$('over').classList.remove('hide')},700)}
function start(){audio();$('over').classList.add('hide');$('start').classList.add('hide');reset();G.state='play'}
function input(e){if(e&&e.target&&e.target.tagName==='BUTTON')return;audio();if(G.state==='start'){start();return}if(G.state==='over'){if(!$('over').classList.contains('hide'))start();return}release()}
addEventListener('pointerdown',input);addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(!e.repeat)input(e)}});$('again').onclick=()=>start();
$('bestS').textContent=best?'Best: '+best+' planets':'';
function step(dt){G.t+=dt;
 for(const p of planets)if(p.mv){p.x=p.x0+Math.sin(G.t*p.mv/120+p.ph)*90}
 if(ship.mode==='orbit'){const p=ship.p;ship.a+=ship.w*ship.dir*dt;ship.x=p.x+Math.cos(ship.a)*p.orb;ship.y=p.y+Math.sin(ship.a)*p.orb}
 else if(ship.mode==='fly'){ship.ft+=dt;
  // a gentle pull from nearby planets bends the path a little
  for(const p of planets){if(p===ship.from&&ship.ft<.25)continue;const dx=p.x-ship.x,dy=p.y-ship.y,d2=dx*dx+dy*dy,inf=(p.orb+70)*(p.orb+70);if(d2<inf){const d=Math.sqrt(d2),f=90000/d2;ship.vx+=dx/d*f*dt;ship.vy+=dy/d*f*dt}}
  ship.x+=ship.vx*dt;ship.y+=ship.vy*dt;
  for(const p of planets){if(p===ship.from&&ship.ft<.25)continue;const d=Math.hypot(ship.x-p.x,ship.y-p.y);if(d<p.r+3){die('Crashed into a planet');return}if(d<p.orb+4&&ship.ft>.08){capture(p);break}}
  for(const s of stars)if(!s.got&&Math.hypot(s.x-ship.x,s.y-ship.y)<22){s.got=true;G.stars++;$('sub').textContent=G.stars+(G.stars>1?' stars':' star');tone(990,.18,.06,'triangle');burst(s.x,s.y,50,10,80)}
  const sx=ship.x*S,sy=(ship.y-G.camY)*S;if(Math.abs(sx)>W/2+60||sy<-Hh*.45-80||ship.ft>4)die('Lost in space')}
 if(ship.mode!=='dead'){trail.push({x:ship.x,y:ship.y});if(trail.length>40)trail.shift()}
 const target=(ship.mode==='orbit'?ship.p.y:ship.y)+140;G.camY+=(target-G.camY)*(1-Math.exp(-3*dt));
 for(let i=parts.length-1;i>=0;i--){const q=parts[i];q.t+=dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.98;q.vy*=.98;if(q.t>q.life)parts.splice(i,1)}
 G.shake=Math.max(0,G.shake-dt)}
// ---------------- draw ----------------
function draw(){const k=S*dpr;x.setTransform(1,0,0,1,0,0);const g=x.createLinearGradient(0,0,0,cv.height);const lift=clamp(G.camY/12000,0,1);g.addColorStop(0,`hsl(${235-lift*40},45%,${9+lift*4}%)`);g.addColorStop(1,'#05070f');x.fillStyle=g;x.fillRect(0,0,cv.width,cv.height);
 const sh=G.shake*8*(R()-.5);x.setTransform(k,0,0,-k,cv.width/2+sh*dpr,cv.height/2+(-G.camY+0)*k*0+0);
 // world -> screen: y up; camera centred on camY
 x.translate(0,-G.camY);
 for(const s of bg){const yy=((s.y+G.camY*s.z*.6)%1400+1400)%1400+G.camY-700;x.fillStyle=`rgba(220,230,255,${.25+s.z*.5})`;x.fillRect(s.x*1.6,yy*s.z+(1-s.z)*G.camY,s.s,s.s)}
 for(const p of planets){if(Math.abs(p.y-G.camY)>900)continue;
  x.strokeStyle=`hsla(${p.hue},90%,70%,.18)`;x.lineWidth=1.5/S;x.setLineDash([4/S,6/S]);x.beginPath();x.arc(p.x,p.y,p.orb,0,TAU);x.stroke();x.setLineDash([]);
  const gr=x.createRadialGradient(p.x-p.r*.35,p.y+p.r*.35,p.r*.1,p.x,p.y,p.r);gr.addColorStop(0,`hsl(${p.hue},85%,72%)`);gr.addColorStop(1,`hsl(${p.hue},70%,32%)`);x.fillStyle=gr;x.beginPath();x.arc(p.x,p.y,p.r,0,TAU);x.fill();
  if(p.ring){x.strokeStyle=`hsla(${p.hue+30},80%,80%,.7)`;x.lineWidth=3/S;x.beginPath();x.ellipse(p.x,p.y,p.r*1.6,p.r*.42,.35,0,TAU);x.stroke()}}
 for(const s of stars){if(s.got)continue;x.save();x.translate(s.x,s.y);x.rotate(G.t*1.5);x.fillStyle='#ffe36b';x.beginPath();for(let i=0;i<10;i++){const r=i%2?5:12,a=i/10*TAU;x.lineTo(Math.cos(a)*r,Math.sin(a)*r)}x.fill();x.restore()}
 for(let i=1;i<trail.length;i++){const a=trail[i-1],b=trail[i];x.strokeStyle=`rgba(107,227,255,${i/trail.length*.8})`;x.lineWidth=(i/trail.length)*7;x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke()}
 if(ship.mode!=='dead'){x.fillStyle='#ffffff';x.beginPath();x.arc(ship.x,ship.y,7,0,TAU);x.fill();x.fillStyle='rgba(107,227,255,.35)';x.beginPath();x.arc(ship.x,ship.y,14,0,TAU);x.fill()}
 for(const q of parts){x.fillStyle=`hsla(${q.hue},90%,70%,${1-q.t/q.life})`;x.fillRect(q.x-2,q.y-2,4,4)}}
reset();let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.033,(now-last)/1000);last=now;if(G.state==='play'||G.state==='over')step(dt);else{G.t+=dt;if(ship.mode==='orbit'){ship.a+=ship.w*dt;ship.x=ship.p.x+Math.cos(ship.a)*ship.p.orb;ship.y=ship.p.y+Math.sin(ship.a)*ship.p.orb;trail.push({x:ship.x,y:ship.y});if(trail.length>40)trail.shift()}}draw()}
requestAnimationFrame(loop);
window.__SL={G,get ship(){return ship},get planets(){return planets},release,start};
})();
