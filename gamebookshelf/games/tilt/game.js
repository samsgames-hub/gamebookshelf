/* TILT — steer a ball down an endless neon slope. Three.js r128, everything generated in code. */
(()=>{'use strict';
const $=id=>document.getElementById(id),R=Math.random,clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
let best=0;try{best=+localStorage.getItem('tilt1')||0}catch(e){}
const ren=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});ren.setPixelRatio(Math.min(devicePixelRatio,1.5));document.body.prepend(ren.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x0a0716);scene.fog=new THREE.Fog(0x0a0716,30,120);
const cam=new THREE.PerspectiveCamera(70,1,.1,200);
function resize(){ren.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.fov=innerWidth<innerHeight?84:70;cam.updateProjectionMatrix()}addEventListener('resize',resize);resize();
// a starfield and a far grid floor for depth
const sg=new THREE.BufferGeometry(),sp=[];for(let i=0;i<900;i++)sp.push((R()-.5)*300,R()*120-20,(R()-.5)*300);sg.setAttribute('position',new THREE.Float32BufferAttribute(sp,3));
const starsM=new THREE.Points(sg,new THREE.PointsMaterial({color:0x8a7cff,size:.6,fog:false}));scene.add(starsM);
// ---------------- track ----------------
const TILE=new THREE.MeshBasicMaterial({color:0x1d1545}),EDGE=new THREE.LineBasicMaterial({color:0x00f0d0}),HAZ=new THREE.MeshBasicMaterial({color:0xff2d75}),HAZE=new THREE.LineBasicMaterial({color:0xffb3cc}),WALL=new THREE.MeshBasicMaterial({color:0x2a1d5e,transparent:true,opacity:.55});
const boxG=new THREE.BoxGeometry(1,1,1),edgeG=new THREE.EdgesGeometry(boxG);
let segs=[],obs=[],nextZ=0,lastX=0,lastY=0,difficulty=0;
function addSeg(len,w,dx,slope,o){const z0=nextZ,x=lastX+dx,y0=lastY,seg={z0,z1:z0+len,x,w,y0,slope,objs:[],walls:!!(o&&o.walls)};
 const g=new THREE.Group(),m=new THREE.Mesh(boxG,TILE),e=new THREE.LineSegments(edgeG,EDGE);for(const k of[m,e]){k.scale.set(w,.4,len);g.add(k)}
 // grid lines across the tile
 const lines=[];for(let t=2;t<len;t+=2)lines.push(-w/2,.21,t-len/2,w/2,.21,t-len/2);const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));g.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x38c7b8,transparent:true,opacity:.55})));
 g.position.set(x,y0-slope*len/2-.2,z0+len/2);g.rotation.x=Math.atan(slope);scene.add(g);seg.g=g;
 if(seg.walls)for(const sd of[-1,1]){const wm=new THREE.Mesh(boxG,WALL),we=new THREE.LineSegments(edgeG,EDGE);for(const k of[wm,we]){k.scale.set(.3,1.2,len);k.position.set(sd*(w/2+.15),.6,0);g.add(k)}}
 segs.push(seg);nextZ=seg.z1;lastX=x;lastY=y0-slope*len;return seg}
function addGap(len){nextZ+=len;lastY-=len*.25}
function hazard(seg,x,z,w,h,d){const g=new THREE.Group(),m=new THREE.Mesh(boxG,HAZ),e=new THREE.LineSegments(edgeG,HAZE);for(const k of[m,e]){k.scale.set(w,h,d);g.add(k)}const y=surfY(seg,z);g.position.set(x,y+h/2,z);g.rotation.x=Math.atan(seg.slope);scene.add(g);obs.push({g,x,z,w,h,d,y:y+h/2,seg})}
function surfY(s,z){return s.y0-(z-s.z0)*s.slope}
function generate(){while(nextZ<ball.z+160){difficulty=clamp(ball.z/2500,0,1);const r=R(),w=lerp(7,4,difficulty)+R()*2,len=12+R()*16,sl=.18+R()*.16+difficulty*.08,dx=(R()-.5)*3*(1+difficulty);
  if(segs.length<3){addSeg(30,7,0,.2);continue}
  if(r<.16+difficulty*.12){addGap(2.5+R()*2+difficulty*2.5);addSeg(len,w,dx*.5,sl)}
  else if(r<.26){const s=addSeg(6,w,0,-.22);addGap(3+R()*3);addSeg(len,w+1,dx,sl)}// launch ramp
  else if(r<.36)addSeg(len*1.4,Math.max(3,w-2.5),dx*.3,sl,{walls:true});
  else{const s=addSeg(len,w,dx,sl);const n=Math.floor(R()*(2+difficulty*4));for(let i=0;i<n;i++){const z=s.z0+3+R()*(len-5),hw=.8+R()*1.4;hazard(s,s.x+(R()-.5)*(w-hw),z,hw,.8+R()*1.4,.8)}
   if(difficulty>.3&&R()<.25){const z=s.z0+len*.5;hazard(s,s.x-w/4-.2,z,w/2-.6,1.2,.8)}}}
 while(segs.length&&segs[0].z1<ball.z-20){const s=segs.shift();scene.remove(s.g)}while(obs.length&&obs[0].z<ball.z-20){scene.remove(obs.shift().g)}}
// ---------------- ball ----------------
const ballM=new THREE.Mesh(new THREE.IcosahedronGeometry(.5,2),new THREE.MeshBasicMaterial({color:0xffffff}));const halo=new THREE.Mesh(new THREE.SphereGeometry(.85,16,12),new THREE.MeshBasicMaterial({color:0x00f0d0,transparent:true,opacity:.18}));scene.add(ballM,halo);
const trail=[];const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.BufferAttribute(new Float32Array(60*3),3));const trailL=new THREE.Line(tg,new THREE.LineBasicMaterial({color:0x00f0d0,transparent:true,opacity:.6}));scene.add(trailL);
const ball={x:0,y:.5,z:4,vx:0,vy:0,vz:12,ground:true,dead:false,lastGroundY:0};
const K={},T={};addEventListener('keydown',e=>{K[e.code]=true;if(e.code==='Space'&&G.state!=='play'&&(!$('over').classList.contains('hide')||G.state==='start')){e.preventDefault();start()}});addEventListener('keyup',e=>K[e.code]=false);
for(const [id,k] of [['tl','l'],['tr','r']]){const el=$(id);el.addEventListener('pointerdown',e=>{T[k]=true});for(const ev of['pointerup','pointercancel','pointerleave'])el.addEventListener(ev,()=>T[k]=false)}
const G={state:'start',t:0};
function reset(){for(const s of segs)scene.remove(s.g);for(const o of obs)scene.remove(o.g);segs=[];obs=[];nextZ=0;lastX=0;lastY=0;Object.assign(ball,{x:0,y:.5,z:4,vx:0,vy:0,vz:12,ground:true,dead:false,lastGroundY:0});trail.length=0;generate()}
let AC=null,hum=null;function audio(){if(AC){AC.state==='suspended'&&AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();o.type='sawtooth';o.frequency.value=55;f.type='lowpass';f.frequency.value=300;g.gain.value=0;o.connect(f);f.connect(g);g.connect(AC.destination);o.start();hum={o,g,f}}catch(e){}}
function tone(fr,d,v,type){if(!AC)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.setValueAtTime(fr,t);o.frequency.exponentialRampToValueAtTime(Math.max(30,fr*.4),t+d);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d+.05)}
function start(){audio();$('start').classList.add('hide');$('over').classList.add('hide');reset();G.state='play'}
$('go').onclick=start;$('again').onclick=start;$('bestS').textContent=best?'Best: '+best+' m':'';
function die(why){if(ball.dead)return;ball.dead=true;G.state='over';tone(180,.6,.15,'sawtooth');const d=Math.floor(ball.z);if(d>best){best=d;try{localStorage.setItem('tilt1',best)}catch(e){}}
 setTimeout(()=>{$('oT').textContent=why;$('oS').textContent=d+' m';$('oB').textContent='Best: '+best+' m';$('over').classList.remove('hide')},600)}
function groundAt(x,z){for(const s of segs){if(z>=s.z0&&z<=s.z1&&Math.abs(x-s.x)<=s.w/2)return s}return null}
function step(dt){const b=ball;if(b.dead){b.vy-=30*dt;b.y+=b.vy*dt;b.z+=b.vz*.3*dt;return}
 b.vz=Math.min(48,b.vz+dt*.55);const steer=(K.KeyD||K.ArrowRight||T.r?1:0)-(K.KeyA||K.ArrowLeft||T.l?1:0);b.vx=lerp(b.vx,-steer*(7+b.vz*.18),1-Math.exp(-9*dt));
 b.x+=b.vx*dt;b.z+=b.vz*dt;b.vy-=30*dt;b.y+=b.vy*dt;
 const s=groundAt(b.x,b.z);if(s){const sy=surfY(s,b.z)+.5;if(b.y<sy){if(sy-b.y<1.2){b.y=sy;b.vy=Math.max(b.vy,-s.slope*b.vz*1);if(!b.ground&&b.lastAir>.25)tone(90,.15,.1);b.ground=true;b.lastGroundY=sy}else{die('You hit a wall')}}else if(b.y>sy+.08)b.ground=false}else b.ground=false;
 if(s&&s.walls){const lim=s.w/2-.5;if(Math.abs(b.x-s.x)>lim){b.x=s.x+Math.sign(b.x-s.x)*lim;b.vx*=-.3}}
 b.lastAir=b.ground?0:(b.lastAir||0)+dt;
 for(const o of obs){if(Math.abs(o.z-b.z)<o.d/2+.5&&Math.abs(o.x-b.x)<o.w/2+.45&&b.y-.5<o.y+o.h/2&&b.y+.5>o.y-o.h/2){die('You hit a block');return}}
 if(b.y<b.lastGroundY-14)die('You fell off');
 $('dist').textContent=Math.floor(b.z)+' m';$('spd').textContent=Math.round(b.vz*3.6)+' km/h'}
let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.033,(now-last)/1000);last=now;G.t+=dt;
 if(G.state==='play'||G.state==='over'){step(dt);if(!ball.dead)generate()}
 const b=ball;ballM.position.set(b.x,b.y,b.z);ballM.rotation.x+=b.vz*dt*2;ballM.rotation.z-=b.vx*dt*2;halo.position.copy(ballM.position);halo.scale.setScalar(1+Math.sin(G.t*8)*.06);
 trail.push(b.x,b.y,b.z);if(trail.length>180)trail.splice(0,3);const tp=tg.attributes.position.array;tp.fill(0);for(let i=0;i<trail.length;i++)tp[i]=trail[i];tg.setDrawRange(0,trail.length/3);tg.attributes.position.needsUpdate=true;
 const cz=b.z-6.5,cy=(G.state==='start'?b.y+3:Math.max(b.y,b.lastGroundY))+2.6;cam.position.x=lerp(cam.position.x,b.x*.7,1-Math.exp(-6*dt));cam.position.y=lerp(cam.position.y,cy,1-Math.exp(-5*dt));cam.position.z=cz;cam.lookAt(b.x*.8,b.y-.5,b.z+8);
 starsM.position.set(b.x,b.y,b.z);if(hum){hum.g.gain.value=G.state==='play'&&!b.dead?.03:0;hum.o.frequency.value=40+b.vz*2;hum.f.frequency.value=200+b.vz*12}
 if(G.state==='start'){ball.z+=dt*6;generate()}
 ren.render(scene,cam)}
reset();requestAnimationFrame(loop);
window.__TI={ball,G,start,get segs(){return segs},get obs(){return obs},K};
})();
