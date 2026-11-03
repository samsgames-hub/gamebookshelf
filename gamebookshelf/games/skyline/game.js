/* SKYLINE — stack sliding blocks into a tower. Three.js r128, everything generated in code. */
(()=>{'use strict';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t;
const H=1,START=3,SPEED0=2.6;
let best=0;try{best=+localStorage.getItem('skyline1')||0}catch(e){}
// ---------------- renderer ----------------
const ren=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});ren.setPixelRatio(Math.min(devicePixelRatio,1.75));ren.outputEncoding=THREE.sRGBEncoding;ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(ren.domElement);
const scene=new THREE.Scene();
const cam=new THREE.OrthographicCamera(-1,1,1,-1,-100,200);
const hemi=new THREE.HemisphereLight(0xfff1e0,0x4a5a7a,.75);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,1.15);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.5,far:60});sun.shadow.bias=-.0006;scene.add(sun,sun.target);
// sky: a big gradient sphere that shifts from dusk to night as the tower climbs
const skyU={top:{value:new THREE.Color()},bot:{value:new THREE.Color()},stars:{value:0}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(90,32,16),new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,
 vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform vec3 top;uniform vec3 bot;uniform float stars;varying vec3 vP;float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}void main(){vec3 d=normalize(vP);float t=smoothstep(-.3,.8,d.y);vec3 c=mix(bot,top,t);float s=step(.996,h(floor(d*260.)))*stars*smoothstep(.1,.5,d.y);gl_FragColor=vec4(c+s,1.);}'}));
sky.renderOrder=-1;scene.add(sky);
const SKY=[[0xffc38a,0x6a7fb8],[0xff9a7a,0x3d4f8f],[0xb06fa8,0x232c5e],[0x4b3f7e,0x121a3a],[0x1e2250,0x05081a]];
function skyAt(n){const f=clamp(n/60,0,1)*(SKY.length-1),i=Math.min(SKY.length-2,f|0),t=f-i;skyU.bot.value.set(SKY[i][0]).lerp(new THREE.Color(SKY[i+1][0]),t);skyU.top.value.set(SKY[i][1]).lerp(new THREE.Color(SKY[i+1][1]),t);skyU.stars.value=clamp((n-30)/30,0,1)}
// ---------------- blocks ----------------
const boxGeo=new THREE.BoxGeometry(1,1,1);
const colorAt=n=>new THREE.Color().setHSL(((.06+n*.018)%1),.62,.62);
function makeBlock(w,d,x,y,z,n){const m=new THREE.Mesh(boxGeo,new THREE.MeshStandardMaterial({color:colorAt(n),roughness:.55,metalness:.05}));m.scale.set(w,H,d);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);return m}
const base=new THREE.Mesh(new THREE.BoxGeometry(START,8,START),new THREE.MeshStandardMaterial({color:0x2b3550,roughness:.8}));base.position.y=-4.5;base.receiveShadow=true;scene.add(base);
let stack=[],moving=null,falls=[],G={state:'start',score:0,combo:0,t:0,dir:0,speed:SPEED0,camY:0,shake:0};
function reset(){for(const b of stack)scene.remove(b.m);for(const f of falls)scene.remove(f.m);stack=[];falls=[];
 const m=makeBlock(START,START,0,0,0,0);stack.push({m,w:START,d:START,x:0,z:0});G.score=0;G.combo=0;G.speed=SPEED0;G.dir=0;$('score').textContent='0';skyAt(0);spawn()}
function spawn(){const top=stack[stack.length-1],n=stack.length,axis=n%2,y=n*H,range=4.2;
 const m=makeBlock(top.w,top.d,axis?top.x:-range,y,axis?-range:top.z,n);moving={m,w:top.w,d:top.d,x:axis?top.x:-range,z:axis?-range:top.z,axis,t:0,range,dir:1};G.speed=Math.min(5.2,SPEED0+n*.045)}
// ---------------- audio ----------------
let AC=null;function audio(){if(AC){if(AC.state==='suspended')AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}}
function tone(f,d,v,type){if(!AC)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type=type||'triangle';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d+.05)}
const SCALE=[0,2,4,7,9,12,14,16,19,21,24];const note=i=>261.6*Math.pow(2,SCALE[Math.min(i,SCALE.length-1)]/12);
// ---------------- placing ----------------
function place(){if(!moving)return;const top=stack[stack.length-1],M=moving,ax=M.axis;
 const off=ax?M.z-top.z:M.x-top.x,size=ax?top.d:top.w,over=Math.abs(off);
 if(over>=size){// missed entirely: the block falls and the game ends
  falls.push({m:M.m,vx:ax?0:Math.sign(off)*1.5,vz:ax?Math.sign(off)*1.5:0,vy:0,rx:(Math.random()-.5)*3,rz:(Math.random()-.5)*3});moving=null;gameOver();return}
 let w=M.w,d=M.d,x=M.x,z=M.z;
 if(over<.1){// perfect: snap onto the block below, and grow back a little after a streak
  G.combo++;x=top.x;z=top.z;if(G.combo>=3){if(ax)d=Math.min(START,d+.15);else w=Math.min(START,w+.15)}tone(note(G.combo),.35,.12);ripple(top,x,z,w,d);showCombo()}
 else{G.combo=0;const keep=size-over;
  if(ax){const nz=top.z+off/2;const cut=over,cz=nz+Math.sign(off)*(keep/2+cut/2);fallPiece(w,cut,x,M.m.position.y,cz,ax,off);d=keep;z=nz}
  else{const nx=top.x+off/2;const cut=over,cx=nx+Math.sign(off)*(keep/2+cut/2);fallPiece(cut,d,cx,M.m.position.y,z,ax,off);w=keep;x=nx}
  tone(220,.15,.08,'square');hideCombo()}
 M.m.scale.set(w,H,d);M.m.position.set(x,M.m.position.y,z);stack.push({m:M.m,w,d,x,z});moving=null;G.score++;$('score').textContent=G.score;G.shake=.12;skyAt(G.score);spawn()}
function fallPiece(w,d,x,y,z,ax,off){const m=makeBlock(w,d,x,y,z,stack.length);falls.push({m,vx:ax?0:Math.sign(off)*1.2,vz:ax?Math.sign(off)*1.2:0,vy:0,rx:ax?Math.sign(off)*2.5:0,rz:ax?0:-Math.sign(off)*2.5})}
const rings=[];function ripple(top,x,z,w,d){const g=new THREE.EdgesGeometry(new THREE.BoxGeometry(w,.02,d)),m=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xffffff,transparent:true}));m.position.set(x,(stack.length-.5)*H,z);scene.add(m);rings.push({m,t:0})}
function showCombo(){const c=$('combo');c.textContent=G.combo>1?'Perfect ×'+G.combo:'Perfect';c.classList.add('on')}function hideCombo(){$('combo').classList.remove('on')}
function gameOver(){G.state='over';hideCombo();if(G.score>best){best=G.score;try{localStorage.setItem('skyline1',best)}catch(e){}}tone(130,.6,.12,'sawtooth');
 setTimeout(()=>{$('overTitle').textContent=G.score>=best&&G.score>0?'New best tower':'Tower down';$('overScore').textContent=G.score;$('overBest').textContent='Best: '+best;$('over').classList.remove('hide')},700)}
function start(){audio();$('over').classList.add('hide');document.body.classList.add('playing');reset();G.state='play'}
function input(e){if(e&&e.target&&e.target.tagName==='BUTTON')return;audio();if(G.state==='start'||G.state==='over'&&!$('over').classList.contains('hide')){start();return}if(G.state==='play')place()}
addEventListener('pointerdown',input);addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(!e.repeat)input(e)}});$('again').onclick=()=>start();
$('bestStart').textContent=best?'Best tower: '+best:'';
// ---------------- loop ----------------
function resize(){const w=innerWidth,h=innerHeight,a=w/h,v=a<1?7.2:6;cam.left=-v*a;cam.right=v*a;cam.top=v;cam.bottom=-v;cam.updateProjectionMatrix();ren.setSize(w,h)}
addEventListener('resize',resize);resize();
let last=performance.now();
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;G.t+=dt;
 if(moving&&G.state==='play'){const M=moving;M.t+=dt*G.speed*M.dir;if(M.t>M.range*2){M.t=M.range*2;M.dir=-1}if(M.t<0){M.t=0;M.dir=1}const p=-M.range+M.t;if(M.axis)M.z=p;else M.x=p;M.m.position.set(M.x,M.m.position.y,M.z)}
 for(let i=falls.length-1;i>=0;i--){const f=falls[i];f.vy-=22*dt;f.m.position.x+=f.vx*dt;f.m.position.z+=f.vz*dt;f.m.position.y+=f.vy*dt;f.m.rotation.x+=f.rx*dt;f.m.rotation.z+=f.rz*dt;if(f.m.position.y<G.camY-30){scene.remove(f.m);f.m.material.dispose();falls.splice(i,1)}}
 for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.t+=dt;const s=1+r.t*1.6;r.m.scale.set(s,1,s);r.m.material.opacity=1-r.t/.6;if(r.t>.6){scene.remove(r.m);r.m.geometry.dispose();rings.splice(i,1)}}
 // camera rises with the tower; on game over it pulls back to show the whole thing
 const n=stack.length,over=G.state==='over',ty=over?n*H*.5:n*H;G.camY=lerp(G.camY,ty,1-Math.exp(-3*dt));
 const zoom=over?Math.max(1,n*H/9):1;cam.zoom=lerp(cam.zoom,1/zoom,1-Math.exp(-3*dt));cam.updateProjectionMatrix();
 const sh=G.shake>0?(Math.random()-.5)*G.shake:0;G.shake=Math.max(0,G.shake-dt*.8);
 const idle=G.state==='start'?G.t*.2:0;cam.position.set(12*Math.cos(.785+idle)+sh,G.camY+12,12*Math.sin(.785+idle));cam.lookAt(0,G.camY-2,0);
 sun.position.set(6,G.camY+14,4);sun.target.position.set(0,G.camY-2,0);sun.target.updateMatrixWorld();sky.position.set(0,G.camY,0);
 ren.render(scene,cam)}
reset();G.state='start';requestAnimationFrame(loop);
window.__SK={G,place,start,get moving(){return moving},stack};
})();
