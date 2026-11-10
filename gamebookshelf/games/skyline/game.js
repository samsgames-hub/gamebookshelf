/* SKYLINE — build a skyscraper one sliding floor at a time. Three.js r128; textures, sound and music are all generated in code. */
(()=>{'use strict';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,rnd=(a,b)=>a+Math.random()*(b-a);
const H=1,START=3,SPEED0=2.6,PERFECT=.1;

/* ================= save data ================= */
const SAVE_KEY='skyline2';
let S={best:0,coins:0,owned:['brick'],style:'brick',runs:0,missions:[],set:{vol:80,mus:55,mute:false,shake:true,low:false}};
try{const o=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(o)S=Object.assign(S,o,{set:Object.assign(S.set,o.set||{})});else{const b=+localStorage.getItem('skyline1')||0;S.best=b}}catch(e){}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(S))}catch(e){}}

/* ================= renderer ================= */
const ren=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
ren.outputEncoding=THREE.sRGBEncoding;ren.shadowMap.type=THREE.PCFSoftShadowMap;
document.body.prepend(ren.domElement);
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xffc38a,24,62);
const cam=new THREE.OrthographicCamera(-1,1,1,-1,-200,300);
const hemi=new THREE.HemisphereLight(0xfff1e0,0x4a5a7a,.75);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,1.15);sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.5,far:60});sun.shadow.bias=-.0006;scene.add(sun,sun.target);
function applyQuality(){const low=S.set.low;ren.setPixelRatio(Math.min(devicePixelRatio,low?1:1.75));ren.shadowMap.enabled=!low;sun.castShadow=!low;scene.traverse(o=>{if(o.material){const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(x=>x.needsUpdate=true)}});city.count=low?50:CITY_N;resize()}

/* sky: gradient sphere from sunset to starry night as the tower climbs */
const skyU={top:{value:new THREE.Color()},bot:{value:new THREE.Color()},stars:{value:0}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(150,32,16),new THREE.ShaderMaterial({uniforms:skyU,side:THREE.BackSide,depthWrite:false,fog:false,
 vertexShader:'varying vec3 vP;void main(){vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:'uniform vec3 top;uniform vec3 bot;uniform float stars;varying vec3 vP;float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}void main(){vec3 d=normalize(vP);float t=smoothstep(-.3,.8,d.y);vec3 c=mix(bot,top,t);float s=step(.996,h(floor(d*260.)))*stars*smoothstep(.1,.5,d.y);gl_FragColor=vec4(c+s,1.);}'}));
sky.renderOrder=-1;scene.add(sky);
const SKY=[[0xffc38a,0x6a7fb8],[0xff9a7a,0x3d4f8f],[0xb06fa8,0x232c5e],[0x4b3f7e,0x121a3a],[0x1e2250,0x05081a]];
let night=0;const _c=new THREE.Color();
function skyAt(n){const f=clamp(n/60,0,1)*(SKY.length-1),i=Math.min(SKY.length-2,f|0),t=f-i;
 skyU.bot.value.set(SKY[i][0]).lerp(_c.set(SKY[i+1][0]),t);skyU.top.value.set(SKY[i][1]).lerp(_c.set(SKY[i+1][1]),t);skyU.stars.value=clamp((n-30)/30,0,1);
 night=clamp((n-12)/40,0,1);scene.fog.color.copy(skyU.bot.value);
 hemi.intensity=lerp(.75,.45,night);sun.intensity=lerp(1.15,.55,night);sun.color.setHSL(.08,lerp(.4,.1,night),lerp(.85,.75,night));
 for(const k in MAT){MAT[k].side.emissiveIntensity=MAT[k].lit+night*1.4}}

/* ================= facade textures (drawn on canvases) ================= */
function canvasTex(w,h,draw){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t}
function noiseFill(x,w,h,base,amt){x.fillStyle=base;x.fillRect(0,0,w,h);const id=x.getImageData(0,0,w,h),d=id.data;for(let i=0;i<d.length;i+=4){const n=(Math.random()-.5)*amt;d[i]+=n;d[i+1]+=n;d[i+2]+=n}x.putImageData(id,0,0)}
/* one texture tile = 1 unit wide x 1 floor tall, with two windows */
function facade(st){
 const map=canvasTex(128,64,(x,w,h)=>{noiseFill(x,w,h,st.wall,st.grain);
  if(st.brick){x.strokeStyle='rgba(0,0,0,.18)';x.lineWidth=1;for(let y=0;y<h;y+=6){x.beginPath();x.moveTo(0,y+.5);x.lineTo(w,y+.5);x.stroke();for(let xx=(y/6)%2?0:8;xx<w;xx+=16){x.beginPath();x.moveTo(xx+.5,y);x.lineTo(xx+.5,y+6);x.stroke()}}}
  x.fillStyle=st.slab;x.fillRect(0,0,w,7);x.fillStyle='rgba(255,255,255,.12)';x.fillRect(0,7,w,1);
  for(let i=0;i<2;i++){const wx=10+i*64,ww=st.wide?52:44,wy=16,wh=40;x.fillStyle=st.frame;x.fillRect(wx-3,wy-3,ww+6,wh+6);
   const g=x.createLinearGradient(wx,wy,wx+ww,wy+wh);g.addColorStop(0,st.glass[0]);g.addColorStop(1,st.glass[1]);x.fillStyle=g;x.fillRect(wx,wy,ww,wh);
   x.fillStyle='rgba(255,255,255,.18)';x.beginPath();x.moveTo(wx,wy+wh);x.lineTo(wx+ww*.35,wy);x.lineTo(wx+ww*.5,wy);x.lineTo(wx+ww*.15,wy+wh);x.fill();
   x.fillStyle=st.frame;x.fillRect(wx+ww/2-1.5,wy,3,wh)}
  if(st.trim){x.fillStyle=st.trim;x.fillRect(0,58,w,6)}});
 map.encoding=THREE.sRGBEncoding;
 /* lit windows: a wider tile (4 units) so not every window is lit the same */
 const em=canvasTex(512,64,(x,w,h)=>{x.fillStyle='#000';x.fillRect(0,0,w,h);for(let i=0;i<8;i++){if(Math.random()<.35)continue;const wx=10+i*64,ww=st.wide?52:44;x.fillStyle=st.lit;x.globalAlpha=rnd(.55,1);x.fillRect(wx,16,ww,40)}x.globalAlpha=1;if(st.neon){x.fillStyle=st.neon;x.fillRect(0,0,w,3);x.fillRect(0,61,w,3)}});
 em.repeat.x=.25;
 const side=new THREE.MeshStandardMaterial({map,emissiveMap:em,emissive:new THREE.Color(st.litc||0xffd27a),emissiveIntensity:st.base||0,roughness:st.rough,metalness:st.metal});
 const roof=new THREE.MeshStandardMaterial({map:canvasTex(64,64,(x,w,h)=>{noiseFill(x,w,h,st.roof,26);x.strokeStyle='rgba(0,0,0,.25)';x.strokeRect(2,2,w-4,h-4)}),roughness:.9});
 roof.map.encoding=THREE.sRGBEncoding;
 return {side,roof,lit:st.base||0,arr:[side,side,roof,roof,side,side]};
}
const STYLES=[
 {id:'brick',n:'Brownstone',d:'Warm red brick and white frames.',cost:0,wall:'#a8503a',grain:30,brick:1,slab:'#d9cdbd',frame:'#efe6d8',glass:['#28344c','#4b5d80'],lit:'#ffd27a',roof:'#6b6966',rough:.85,metal:0},
 {id:'glass',n:'Glass Tower',d:'Blue curtain wall that catches the sky.',cost:120,wall:'#3d6390',grain:8,slab:'#9fb4c8',frame:'#c9d7e6',glass:['#5a8fc4','#a8d1f2'],wide:1,lit:'#fff0c8',roof:'#56616e',rough:.25,metal:.55},
 {id:'concrete',n:'Brutalist',d:'Raw concrete slabs with deep windows.',cost:200,wall:'#a7a199',grain:40,slab:'#8a847b',frame:'#5d5952',glass:['#20262e','#3b4652'],lit:'#ffe2a8',roof:'#77726b',rough:.95,metal:0},
 {id:'deco',n:'Art Deco',d:'Cream stone with gold trim, 1930s style.',cost:350,wall:'#e3d6b8',grain:18,slab:'#c9a24c',frame:'#8c6a24',glass:['#2a2f3d','#55607a'],trim:'#c9a24c',lit:'#ffd890',roof:'#8a7d64',rough:.6,metal:.15},
 {id:'neon',n:'Neon District',d:'Dark glass edged in glowing cyan.',cost:500,wall:'#1b1f2e',grain:10,slab:'#2b3046',frame:'#0e1019',glass:['#141a2a','#273356'],wide:1,lit:'#44e6ff',litc:0x44e6ff,neon:'#44e6ff',base:.9,roof:'#22273a',rough:.35,metal:.4},
 {id:'gold',n:'Gilded Spire',d:'Polished gold. For people who have made it.',cost:900,wall:'#c79a3a',grain:12,slab:'#f2d27a',frame:'#7a5512',glass:['#3a2c14','#6e5326'],wide:1,lit:'#fff1b8',roof:'#9a7a30',rough:.25,metal:.85}];
const MAT={};STYLES.forEach(s=>MAT[s.id]=facade(s));
const GOLD=facade({wall:'#e7b53c',grain:10,slab:'#fff1b0',frame:'#a87b16',glass:['#fff2c0','#ffd76a'],wide:1,lit:'#fff6d0',roof:'#d4a23a',rough:.2,metal:.9,base:.6});MAT.__gold=GOLD;

/* box with UVs scaled so windows keep their size whatever the floor's width */
/* windows are placed from world coordinates, so they line up from floor to floor */
function floorGeo(w,d,x,z){const g=new THREE.BoxGeometry(w,H,d),uv=g.attributes.uv,pos=g.attributes.position,off=Math.floor(Math.random()*4);
 for(let f=0;f<6;f++){if(f==2||f==3)continue;for(let v=0;v<4;v++){const i=f*4+v;uv.setX(i,(f<2?pos.getZ(i)+z:pos.getX(i)+x)+off+.25)}}uv.needsUpdate=true;return g}
function makeBlock(w,d,x,y,z,gold){const m=new THREE.Mesh(floorGeo(w,d,x,z),(gold?GOLD:MAT[S.style]).arr);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;scene.add(m);return m}
function kill(m){scene.remove(m);m.geometry.dispose()}

/* ================= the street, the lobby and the city around it ================= */
const ground=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshStandardMaterial({color:0x3a3f4a,roughness:1,map:canvasTex(256,256,(x,w,h)=>{noiseFill(x,w,h,'#3d424c',18);x.fillStyle='#2b2f37';x.fillRect(0,100,w,56);x.fillRect(100,0,56,h);x.fillStyle='#d8cfa0';for(let i=0;i<w;i+=24){x.fillRect(i,126,12,3);x.fillRect(126,i,3,12)}})}));
ground.material.map.repeat.set(20,20);ground.material.map.encoding=THREE.sRGBEncoding;ground.rotation.x=-Math.PI/2;ground.position.y=-1.5;ground.receiveShadow=true;scene.add(ground);
const lobby=new THREE.Mesh(new THREE.BoxGeometry(START+.6,1,START+.6),new THREE.MeshStandardMaterial({color:0x2b3550,roughness:.7}));lobby.position.y=-1;lobby.receiveShadow=lobby.castShadow=true;scene.add(lobby);
const CITY_N=110,cityMat=facade({wall:'#4c5568',grain:14,slab:'#5d6679',frame:'#3a4150',glass:['#1d2433','#2f3a50'],lit:'#ffd890',roof:'#3a404d',rough:.9,metal:0});
const city=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),cityMat.side,CITY_N);
{const m=new THREE.Matrix4(),q=new THREE.Quaternion(),c=new THREE.Color();let i=0;while(i<CITY_N){const a=Math.random()*Math.PI*2,r=rnd(9,48);if(Math.abs(Math.cos(a)*r)<8&&Math.abs(Math.sin(a)*r)<8)continue;
 const h=rnd(2,6)+(r>22?rnd(2,10):rnd(0,4)),w=rnd(2.5,5),x=Math.round(Math.cos(a)*r/7)*7+rnd(-1,1),z=Math.round(Math.sin(a)*r/7)*7+rnd(-1,1);
 m.compose(new THREE.Vector3(x,h/2-1.5,z),q,new THREE.Vector3(w,h,w));city.setMatrixAt(i,m);city.setColorAt(i,c.setHSL(rnd(.55,.65),rnd(.05,.2),rnd(.5,.8)));i++}}
scene.add(city);
/* clouds you pass on the way up */
const cloudTex=canvasTex(128,64,(x,w,h)=>{for(let i=0;i<9;i++){const cx=rnd(25,103),cy=rnd(24,40),r=rnd(12,24),g=x.createRadialGradient(cx,cy,0,cx,cy,r);g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h)}});
const clouds=[];for(let i=0;i<16;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:cloudTex,transparent:true,depthWrite:false,opacity:.8,fog:false}));const k=rnd(10,20);s.scale.set(k,k/2,1);s.position.set(rnd(-40,40),18+i*7+rnd(-3,3),rnd(-40,40));s.userData.v=rnd(.4,1.2)*(Math.random()<.5?1:-1);scene.add(s);clouds.push(s)}
/* blinking aircraft-warning light on top of the tower */
const beacon=new THREE.Mesh(new THREE.SphereGeometry(.09,8,8),new THREE.MeshBasicMaterial({color:0xff3030}));scene.add(beacon);

/* ================= particles (pooled) ================= */
const PN=260,parts=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({vertexColors:false}),PN);parts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const P=[];for(let i=0;i<PN;i++)P.push({on:false,p:new THREE.Vector3(),v:new THREE.Vector3(),life:0,max:1,s:.1,c:new THREE.Color()});
let pi=0;const _m=new THREE.Matrix4(),_q=new THREE.Quaternion(),_v=new THREE.Vector3(),_s=new THREE.Vector3();
parts.setColorAt(0,new THREE.Color(1,1,1));parts.frustumCulled=false;scene.add(parts);
function burst(x,y,z,n,col,spd,size,up){for(let k=0;k<n;k++){const o=P[pi=(pi+1)%PN];o.on=true;o.p.set(x+rnd(-.2,.2),y,z+rnd(-.2,.2));const a=Math.random()*Math.PI*2,s=rnd(.4,1)*spd;o.v.set(Math.cos(a)*s,rnd(.2,1)*(up||spd),Math.sin(a)*s);o.life=o.max=rnd(.4,.9);o.s=size*rnd(.6,1.3);o.c.set(col)}}
function edgeBurst(t,n,col){const hw=t.w/2,hd=t.d/2,y=t.m.position.y-H/2;for(let k=0;k<n;k++){const side=k%4,u=Math.random()*2-1;const x=t.x+(side<2?(side?hw:-hw):u*hw),z=t.z+(side<2?u*hd:(side==2?hd:-hd));burst(x,y,z,1,col,1.6,.08,1.4)}}

/* ================= audio: Web Audio sounds and a generated music loop ================= */
let AC=null,master,sfxG,musG,NB;
function audio(){if(AC){if(AC.state==='suspended')AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return}
 master=AC.createGain();sfxG=AC.createGain();musG=AC.createGain();sfxG.connect(master);musG.connect(master);master.connect(AC.destination);
 NB=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;applyVol();mus.next=AC.currentTime+.1}
function applyVol(){if(!AC)return;const m=S.set.mute?0:1;master.gain.value=m;sfxG.gain.value=S.set.vol/100*.9;musG.gain.setTargetAtTime(S.set.mus/100*.5*(G.state==='play'?1:.45),AC.currentTime,.3)}
function tone(f,d,v,type,at,slide){if(!AC)return;const t=AC.currentTime+(at||0),o=AC.createOscillator(),g=AC.createGain();o.type=type||'triangle';o.frequency.setValueAtTime(f,t);if(slide)o.frequency.exponentialRampToValueAtTime(slide,t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(sfxG);o.start(t);o.stop(t+d+.05)}
function noise(d,v,f,q,at,type){if(!AC)return;const t=AC.currentTime+(at||0),s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=NB;fl.type=type||'lowpass';fl.frequency.value=f;fl.Q.value=q||1;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(fl);fl.connect(g);g.connect(sfxG);s.start(t,Math.random()*.5);s.stop(t+d+.05)}
const SCALE=[0,2,4,7,9,12,14,16,19,21,24,26,28];const note=i=>392*Math.pow(2,SCALE[Math.min(i,SCALE.length-1)]/12);
const SFX={
 thud(){tone(110,.18,.35,'sine',0,55);noise(.12,.25,600,1)},
 cut(){noise(.25,.35,1800,.7,0,'bandpass');tone(180,.12,.12,'square',0,90);noise(.4,.15,300,1,.05)},
 perfect(c){tone(note(c),.5,.16,'triangle');tone(note(c)*2,.35,.05,'sine',.02);tone(note(c+2),.4,.07,'triangle',.06)},
 gold(){[0,4,7,12,16].forEach((s,i)=>tone(523*Math.pow(2,s/12),.35,.12,'triangle',i*.06))},
 coin(){tone(1320,.08,.06,'square');tone(1760,.12,.05,'square',.05)},
 grow(){tone(660,.2,.07,'sine',0,990)},
 fall(){noise(1.2,.4,220,.8);tone(140,.9,.18,'sawtooth',0,40);tone(90,1.1,.15,'sine',.15,35)},
 click(){tone(700,.05,.06,'triangle')},
 mission(){[0,7,12].forEach((s,i)=>tone(660*Math.pow(2,s/12),.3,.1,'triangle',i*.08))},
 wind(){noise(1.6,.18,500,.6,0,'bandpass')}
};
/* music: four-chord progression with a soft pad, a plucked arpeggio, and drums that join as you climb */
const CH=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]],mus={next:0,step:0};const mf=n=>440*Math.pow(2,(n-69)/12);
function musTone(f,t,d,v,type,cut){const o=AC.createOscillator(),g=AC.createGain(),fl=AC.createBiquadFilter();o.type=type;o.frequency.value=f;fl.type='lowpass';fl.frequency.value=cut;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+Math.min(.3,d*.3));g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(fl);fl.connect(g);g.connect(musG);o.start(t);o.stop(t+d+.05)}
function musHit(t,v,f,d,type){const s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=NB;fl.type=type;fl.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(fl);fl.connect(g);g.connect(musG);s.start(t,Math.random()*.5);s.stop(t+d+.02)}
function music(){if(!AC||AC.state!=='running')return;const sp=60/88/2;
 while(mus.next<AC.currentTime+.25){const t=mus.next,s=mus.step,bar=(s>>3)%4,ch=CH[bar],lvl=G.state==='play'?G.score:0;
  if(s%8==0)ch.forEach(n=>musTone(mf(n),t,sp*8.2,.05,'sawtooth',900+night*300));
  if(s%8==0)musTone(mf(ch[0]-12),t,sp*7,.09,'sine',400);
  const ar=[0,1,2,1,2,0,1,2][s%8];musTone(mf(ch[ar]+12+(s%16>7?7:0)),t,sp*1.6,.035,'triangle',2400);
  if(lvl>=8&&s%4==0){const o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(45,t+.15);g.gain.setValueAtTime(.18,t);g.gain.exponentialRampToValueAtTime(.0001,t+.2);o.connect(g);g.connect(musG);o.start(t);o.stop(t+.25)}
  if(lvl>=20&&s%2==1)musHit(t,.04,7000,.05,'highpass');
  if(lvl>=35&&s%8==4)musHit(t,.09,1800,.14,'bandpass');
  mus.next+=sp;mus.step++}}

/* ================= missions ================= */
const MK={
 floor:{t:n=>'Build '+n+' floors in one tower',run:1,tiers:[10,15,20,30,40,50,65,80]},
 perf:{t:n=>'Land '+n+' Perfects in one tower',run:1,tiers:[3,6,10,15,22,30]},
 streak:{t:n=>'Get a '+n+'-Perfect streak',run:1,tiers:[2,3,5,7,10]},
 gold:{t:n=>n==1?'Land a gold floor':'Land '+n+' gold floors in one tower',run:1,tiers:[1,2,3,5]},
 coins:{t:n=>'Earn '+n+' coins in one tower',run:1,tiers:[20,40,70,110,160]},
 runs:{t:n=>'Build '+n+' towers',run:0,tiers:[3,5,8]}};
function newMission(skip){const keys=Object.keys(MK).filter(k=>!S.missions.some(m=>m.k===k)&&k!==skip);const k=keys[Math.floor(Math.random()*keys.length)];
 const lv=(S.mlv=S.mlv||{})[k]||0,tiers=MK[k].tiers,n=tiers[Math.min(lv,tiers.length-1)]*(lv>=tiers.length?1+(lv-tiers.length+1)*.25:1)|0;
 return {k,n,p:0,r:15+Math.min(lv,8)*8+(k==='floor'||k==='streak'?10:0)}}
while(S.missions.length<3)S.missions.push(newMission());
function mText(m){return MK[m.k].t(m.n)}
function drawMissions(el){el.innerHTML='<h3>Missions</h3>'+S.missions.map(m=>'<div class="mi'+(m.p>=m.n?' done':'')+'"><span>'+mText(m)+'</span><small>'+(m.p>=m.n?'✓ +'+m.r:(MK[m.k].run?'':m.p+'/'+m.n+' · ')+'<i class="coin"></i> '+m.r)+'</small></div>').join('')}
function progress(k,v){S.missions.forEach(m=>{if(m.k!==k||m.p>=m.n)return;m.p=MK[k].run?Math.max(m.p,v):m.p+1;if(m.p>=m.n){R.coins+=m.r;S.coins+=m.r;toast('Mission done: '+mText(m)+'  +'+m.r);SFX.mission()}})}
function rollMissions(){S.missions=S.missions.map(m=>{if(m.p>=m.n){S.mlv[m.k]=(S.mlv[m.k]||0)+1;return newMission(m.k)}if(MK[m.k].run)m.p=0;return m})}

/* ================= game state ================= */
let stack=[],moving=null,falls=[],rings=[];
const G={state:'menu',score:0,combo:0,t:0,speed:SPEED0,camY:0,shake:0,freeze:0,wind:0,paused:false};
const R={coins:0,perf:0,streak:0,gold:0};
/* ---- modes: Classic, Daily tower (same tower for everyone, changes at midnight) and Crosswind ---- */
const EPOCH=new Date(2026,10,9);
function dayIndex(){const d=new Date(),a=new Date(d.getFullYear(),d.getMonth(),d.getDate());return Math.round((a-EPOCH)/864e5)+1}
function hashS(t){let h=2166136261;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const TODAY=dayIndex();
/* tell the site's daily page this daily was played */
function markDaily(game,score){try{const k='gbs-daily',d=JSON.parse(localStorage.getItem(k)||'{}');d[TODAY]=d[TODAY]||{};if(d[TODAY][game]===undefined)d[TODAY][game]=score;const ks=Object.keys(d).filter(x=>/^\d+$/.test(x)).map(Number).sort((a,b)=>a-b);while(ks.length>60)delete d[ks.shift()];localStorage.setItem(k,JSON.stringify(d))}catch(e){}}

const MODS={fast:{n:'Rush hour',d:'floors slide 25% faster'},narrow:{n:'Tight lot',d:'you start on a narrower lot'},goldrush:{n:'Gold rush',d:'a gold floor every 5 floors'},gusty:{n:'Gusty day',d:'wind from the first floor'},nogrow:{n:'No second chances',d:'Perfect streaks never grow floors back'},cross:{n:'Crosswind',d:'floors come in at an angle'}};
function dailyMods(){const r=mulberry(hashS('skyline-'+TODAY)),k=Object.keys(MODS),a=k.splice(Math.floor(r()*k.length),1)[0];let b=k[Math.floor(r()*k.length)];if(a==='narrow'&&b==='nogrow'||a==='nogrow'&&b==='narrow')b='goldrush';return[a,b]}
let MODE={id:'classic',mods:[]};
const has=k=>MODE.mods.includes(k);
if(S.dlast!==undefined&&S.dlast<TODAY-1)S.dstreak=0;
const FLOORS=[[0,'Lobby'],[5,'Offices'],[15,'Upper offices'],[25,'Sky lobby'],[35,'Hotel floors'],[45,'Observation deck'],[55,'Penthouses'],[70,'The spire'],[90,'Above the clouds']];
function tourMods(){if(!window.GBTour)return['gusty'];const r=GBTour.rng('skyline'),k=Object.keys(MODS),a=k.splice(Math.floor(r()*k.length),1)[0];let b=k[Math.floor(r()*k.length)];if(a==='narrow'&&b==='nogrow'||a==='nogrow'&&b==='narrow')b='goldrush';return[a,b]}
function modeTag(){return MODE.id==='tour'?'Tournament wk '+GBTour.week()+' · ':MODE.id==='daily'?'Daily #'+TODAY+' · ':MODE.id==='cross'?'Crosswind · ':''}
function floorName(n){let s='';for(const f of FLOORS)if(n>=f[0])s=f[1];return s}
function reset(){G.base=has('narrow')?2.3:START;stack.forEach(b=>kill(b.m));falls.forEach(f=>kill(f.m));rings.forEach(r=>{scene.remove(r.m);r.m.geometry.dispose()});if(moving)kill(moving.m);
 stack=[];falls=[];rings=[];moving=null;const m=makeBlock(G.base,G.base,0,0,0);stack.push({m,w:G.base,d:G.base,x:0,z:0});
 Object.assign(G,{score:0,combo:0,speed:SPEED0,wind:0,freeze:0});Object.assign(R,{coins:0,perf:0,streak:0,gold:0});
 $('score').textContent='0';$('coinsNow').textContent='0';$('floorName').textContent=modeTag()+floorName(0);skyAt(0);spawn()}
function isGold(n){return has('goldrush')?n>=5&&n%5===0:n>=8&&n%9===0}
const windAt=()=>has('gusty')?1:25;
function spawn(){const top=stack[stack.length-1],n=stack.length,axis=n%2,y=n*H,range=4.4,gold=isGold(n);
 if(has('cross')){const dz=n%2?1:-1,x0=top.x-range,z0=top.z-range*dz,m=makeBlock(top.w,top.d,x0,y,z0,gold);
  moving={m,w:top.w,d:top.d,x:x0,z:z0,cross:true,dz,ox:top.x,oz:top.z,t:0,range,dir:1,gold}}
 else{const m=makeBlock(top.w,top.d,axis?top.x:-range,y,axis?-range:top.z,gold);
  moving={m,w:top.w,d:top.d,x:axis?top.x:-range,z:axis?-range:top.z,axis,t:0,range,dir:1,gold}}
 G.speed=Math.min(5.6,SPEED0+n*.05)*(has('fast')?1.25:1);
 if(n===windAt()&&has('gusty'))announce('Gusty day');else if(n===25)announce('The wind is picking up');if(n===50)announce('Gale force winds');if(gold)announce('Gold floor!',1)}
function announce(t,short){const e=$('event');e.textContent=t;e.classList.add('on');clearTimeout(e._t);e._t=setTimeout(()=>e.classList.remove('on'),short?900:1600);if(/wind/i.test(t))SFX.wind()}
let toastT=0;function toast(t){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>e.classList.remove('on'),2200)}
function addCoins(n){R.coins+=n;S.coins+=n;$('coinsNow').textContent=R.coins;progress('coins',R.coins)}
function shake(v){if(S.set.shake)G.shake=Math.max(G.shake,v)}
function flash(v){const f=$('flash');f.style.transition='none';f.style.opacity=v;requestAnimationFrame(()=>{f.style.transition='opacity .35s';f.style.opacity=0})}

function place(){if(!moving||G.state!=='play'||G.paused)return;if(moving.cross)return placeCross();const top=stack[stack.length-1],M=moving,ax=M.axis;
 const off=ax?M.z-top.z:M.x-top.x,size=ax?top.d:top.w,over=Math.abs(off);
 if(over>=size){falls.push({m:M.m,vx:ax?0:Math.sign(off)*1.5,vz:ax?Math.sign(off)*1.5:0,vy:0,rx:(Math.random()-.5)*3,rz:(Math.random()-.5)*3});moving=null;gameOver();return}
 let w=M.w,d=M.d,x=M.x,z=M.z,perfect=over<PERFECT,grew=false;
 if(perfect){G.combo++;R.perf++;R.streak=Math.max(R.streak,G.combo);x=top.x;z=top.z;
  if(G.combo>=3&&!has('nogrow')){grew=true;if(ax)d=Math.min(G.base,d+.15);else w=Math.min(G.base,w+.15)}
  SFX.perfect(G.combo);if(grew)SFX.grow();G.freeze=.06;shake(.18);flash(.12);showCombo();
  addCoins(1+(G.combo>=3?Math.min(G.combo-2,4):0));progress('perf',R.perf);progress('streak',R.streak)}
 else{G.combo=0;const keep=size-over;
  if(ax){const nz=top.z+off/2,cz=nz+Math.sign(off)*(keep/2+over/2);fallPiece(w,over,x,M.m.position.y,cz,ax,off,M.gold);d=keep;z=nz}
  else{const nx=top.x+off/2,cx=nx+Math.sign(off)*(keep/2+over/2);fallPiece(over,d,cx,M.m.position.y,z,ax,off,M.gold);w=keep;x=nx}
  SFX.cut();SFX.thud();shake(.12+over*.15);hideCombo()}
 landed(M,w,d,x,z,perfect)}
function landed(M,w,d,x,z,perfect){kill(M.m);const m=makeBlock(w,d,x,M.m.position.y,z,M.gold);m.scale.y=.75;m.userData.sq=0;
 const nb={m,w,d,x,z};stack.push(nb);moving=null;G.score++;addCoins(1);
 if(M.gold){R.gold++;progress('gold',R.gold);const g=perfect?15:6;addCoins(g);SFX.gold();toast('Gold floor  +'+g+' coins');burst(x,m.position.y+.5,z,40,0xffd166,3,.12,4)}
 if(perfect){ripple(x,z,w,d,M.gold?0xffd166:0xffffff);edgeBurst(nb,26,0xffffff)}else edgeBurst(nb,14,0xd8cdbd);
 const sc=$('score');sc.textContent=G.score;sc.classList.add('pop');setTimeout(()=>sc.classList.remove('pop'),120);
 $('floorName').textContent=modeTag()+floorName(G.score);progress('floor',G.score);skyAt(G.score);spawn()}
/* Crosswind: the floor slides in diagonally, so the overhang is trimmed on two sides at once (an L-shaped cut) */
function placeCross(){const top=stack[stack.length-1],M=moving,ox=M.x-top.x,oz=M.z-top.z,ax=Math.abs(ox),az=Math.abs(oz);
 if(ax>=top.w||az>=top.d){falls.push({m:M.m,vx:Math.sign(ox)*1.5,vz:Math.sign(oz)*1.5,vy:0,rx:(Math.random()-.5)*3,rz:(Math.random()-.5)*3});moving=null;gameOver();return}
 let w=M.w,d=M.d,x=M.x,z=M.z;const perfect=ax<PERFECT&&az<PERFECT;
 if(perfect){G.combo++;R.perf++;R.streak=Math.max(R.streak,G.combo);x=top.x;z=top.z;let grew=false;
  if(G.combo>=3&&!has('nogrow')){grew=true;w=Math.min(G.base,w+.12);d=Math.min(G.base,d+.12)}
  SFX.perfect(G.combo);if(grew)SFX.grow();G.freeze=.06;shake(.18);flash(.12);showCombo();
  addCoins(2+(G.combo>=3?Math.min(G.combo-2,4):0));progress('perf',R.perf);progress('streak',R.streak)}
 else{G.combo=0;const kw=top.w-ax,kd=top.d-az,nx=top.x+ox/2,nz=top.z+oz/2,y=M.m.position.y;
  if(ax>.001)fallPiece(ax,M.d,nx+Math.sign(ox)*(kw/2+ax/2),y,M.z,0,ox,M.gold);
  if(az>.001)fallPiece(kw,az,nx,y,nz+Math.sign(oz)*(kd/2+az/2),1,oz,M.gold);
  w=kw;d=kd;x=nx;z=nz;SFX.cut();SFX.thud();shake(.12+(ax+az)*.1);hideCombo()}
 landed(M,w,d,x,z,perfect)}
function fallPiece(w,d,x,y,z,ax,off,gold){const m=makeBlock(w,d,x,y,z,gold);falls.push({m,vx:ax?0:Math.sign(off)*1.4,vz:ax?Math.sign(off)*1.4:0,vy:1,rx:ax?Math.sign(off)*2.5:0,rz:ax?0:-Math.sign(off)*2.5,hit:false})}
function ripple(x,z,w,d,col){const g=new THREE.EdgesGeometry(new THREE.BoxGeometry(w,.02,d)),m=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:col,transparent:true}));m.position.set(x,(stack.length-.5)*H,z);scene.add(m);rings.push({m,t:0})}
function showCombo(){const c=$('combo');c.textContent=G.combo>=3?'Perfect ×'+G.combo+' · growing':G.combo>1?'Perfect ×'+G.combo:'Perfect';c.classList.add('on')}
function hideCombo(){$('combo').classList.remove('on')}

/* ================= flow: menu, play, pause, game over ================= */
function show(id){['start','how','styles','settings','pause','over'].forEach(p=>$(p).classList.toggle('hide',p!==id))}
let back='start';
function openPanel(id){SFX.click();back=['start','pause','over'].find(p=>!$(p).classList.contains('hide'))||back;if(id==='styles')drawStyles();if(id==='settings')loadSettings();show(id)}
document.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{e.stopPropagation();audio();openPanel(b.dataset.open)});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=e=>{e.stopPropagation();SFX.click();show(back);if(back==='start')drawMenu();if(back==='over')drawMissions($('missionsOver'))});
function drawMenu(){drawMissions($('missionsStart'));if($('mTour')&&window.GBTour){const tm=tourMods(),b=GBTour.myBest('skyline');$('mTour').innerHTML='<b>🏆 Weekly tournament</b><small>'+tm.map(k=>MODS[k].n).join(' + ')+' · '+(b?'your best '+b+' · ':'')+'ends in '+GBTour.left()+'</small>'}$('bestStart').textContent=(S.best?'Tallest tower: '+S.best+' floors · ':'')+S.coins+' coins';
 const dm=dailyMods(),done=S.dday===TODAY;$('mDaily').innerHTML='<b>Daily tower #'+TODAY+(done?' · '+S.dscore+' floors':'')+'</b><small>'+dm.map(k=>MODS[k].n).join(' + ')+(S.dstreak?' · 🔥 '+S.dstreak+'-day streak':'')+'</small>';
 const un=S.best>=25||S.crossBest;$('mCross').innerHTML='<b>'+(un?'':'🔒 ')+'Crosswind</b><small>'+(un?'Floors come in at an angle'+(S.crossBest?' · best '+S.crossBest:''):'Reach floor 25 to unlock')+'</small>';$('mCross').classList.toggle('locked',!un)}
function start(id){G.t0=performance.now();if(id)MODE={id,mods:id==='daily'?dailyMods():id==='tour'?tourMods():id==='cross'?['cross']:[]};audio();show('');document.body.classList.add('playing');G.paused=false;reset();G.state='play';applyVol()}
function pause(on){if(G.state!=='play')return;G.paused=on;show(on?'pause':'');applyVol();if(on)SFX.click()}
function toMenu(){G.state='menu';MODE={id:'classic',mods:[]};G.paused=false;document.body.classList.remove('playing');reset();show('start');drawMenu();applyVol()}
function gameOver(){G.state='over';hideCombo();SFX.fall();shake(.5);S.runs++;progress('runs',S.runs);
 let nb=false,daily='';
 if(MODE.id==='classic'){nb=G.score>S.best&&G.score>0;if(nb)S.best=G.score}
 else if(MODE.id==='cross'){nb=G.score>(S.crossBest||0)&&G.score>0;if(nb)S.crossBest=G.score}
 else if(MODE.id==='daily'){if(S.dday!==TODAY){S.dday=TODAY;S.dscore=G.score;markDaily('skyline',G.score);S.dstreak=S.dlast===TODAY-1?(S.dstreak||0)+1:1;S.dlast=TODAY;S.dmax=Math.max(S.dmax||0,S.dstreak);daily='official'}
  nb=G.score>(S.dtop||0)&&S.dtopDay===TODAY;if(S.dtopDay!==TODAY||G.score>S.dtop){S.dtop=G.score;S.dtopDay=TODAY}}
 save();applyVol();
 setTimeout(()=>{if(G.state!=='over')return;$('overTitle').textContent=MODE.id==='tour'?'Weekly tournament':MODE.id==='daily'?'Daily tower #'+TODAY:MODE.id==='cross'?(nb?'New Crosswind record!':'Crosswind'):nb?'New tallest tower!':'Tower down';
  $('overDaily').innerHTML=MODE.id==='daily'?(daily?'Your official score for today. Day streak: <b>'+S.dstreak+'</b>':'Practice run. Today\'s official score: <b>'+S.dscore+'</b> · streak <b>'+S.dstreak+'</b>')+'<br><button class="ghost" id="shareD">Share today\'s tower</button>':'';
  if(MODE.id==='tour'&&window.GBTour){const el=$('overDaily');el.innerHTML='Saving your score…';const sc=G.score;GBTour.submit('skyline',sc,(performance.now()-(G.t0||0))/1000).then(r=>{el.innerHTML=(r.improved?'New personal best this week! ':'')+'Your best: <b>'+r.best+'</b> floors'+(r.online?' · rank <b>#'+r.rank+'</b> of '+r.of:' (offline, saved on this device)')+'<br><a class="ghost tlink" href="/tournament/">Leaderboard and your name</a> · ends in '+GBTour.left()})}
  if($('shareD'))$('shareD').onclick=e=>{e.stopPropagation();const t='Skyline daily tower #'+TODAY+': '+S.dscore+' floors'+(S.dstreak>1?' 🔥'+S.dstreak:'')+'\n'+'🏢'.repeat(Math.min(10,Math.ceil(S.dscore/10)))+'\ngamebookshelf.com';try{navigator.clipboard.writeText(t).then(()=>toast('Copied. Paste it anywhere.'),()=>toast(t))}catch(err){toast(t)}};$('overScore').textContent=G.score;
  $('overStats').innerHTML='<div><b>'+R.perf+'</b>Perfects</div><div><b>'+R.streak+'</b>Best streak</div><div><b>'+R.gold+'</b>Gold floors</div><div><b>+'+R.coins+'</b>Coins</div>';
  drawMissions($('missionsOver'));rollMissions();save();show('over');if(nb){flash(.25);SFX.gold()}},900)}
$('play').onclick=e=>{e.stopPropagation();start('classic')};$('again').onclick=e=>{e.stopPropagation();start()};
$('mDaily').onclick=e=>{e.stopPropagation();start('daily')};
if($('mTour'))$('mTour').onclick=e=>{e.stopPropagation();start('tour')};
$('mCross').onclick=e=>{e.stopPropagation();if(S.best<25&&!S.crossBest){SFX.click();toast('Reach floor 25 in a normal tower to unlock Crosswind');return}start('cross')};
$('resume').onclick=e=>{e.stopPropagation();pause(false)};$('restartP').onclick=e=>{e.stopPropagation();start()};
$('quitP').onclick=e=>{e.stopPropagation();toMenu()};$('menuO').onclick=e=>{e.stopPropagation();toMenu()};
$('pauseBtn').onclick=e=>{e.stopPropagation();audio();pause(!G.paused)};
function input(e){if(e&&e.target&&e.target.closest&&e.target.closest('.panel,button'))return;audio();if(G.state==='play'&&!G.paused)place()}
addEventListener('pointerdown',input);
addEventListener('keydown',e=>{audio();
 if(e.code==='Space'||e.code==='Enter'){e.preventDefault();if(e.repeat)return;if(G.state==='play'&&!G.paused)place();else if(G.state==='over'&&!$('over').classList.contains('hide'))start();else if(G.state==='menu'&&!$('start').classList.contains('hide'))start('classic');else if(G.paused)pause(false)}
 else if(e.code==='Escape'||e.code==='KeyP'){if(G.state==='play')pause(!G.paused)}
 else if(e.code==='KeyR'&&(G.state==='play'||G.state==='over'))start()});
addEventListener('visibilitychange',()=>{if(document.hidden&&G.state==='play'&&!G.paused)pause(true)});

/* styles shop */
function swatch(st){const c=document.createElement('canvas');c.width=56;c.height=40;const x=c.getContext('2d');x.drawImage(MAT[st.id].side.map.image,0,0,128,64,0,0,56,28);x.drawImage(MAT[st.id].side.map.image,0,0,128,64,0,20,56,28);return c.toDataURL()}
function drawStyles(){$('coinsShop').textContent=S.coins;$('styleList').innerHTML=STYLES.map(st=>{const own=S.owned.includes(st.id),on=S.style===st.id;
 return '<div class="sty'+(on?' on':'')+'"><div class="sw" style="background-image:url('+swatch(st)+')"></div><div class="tx"><b>'+st.n+'</b>'+st.d+'</div>'+(on?'<button disabled>In use</button>':own?'<button data-use="'+st.id+'">Use</button>':'<button data-buy="'+st.id+'"'+(S.coins<st.cost?' disabled':'')+'><i class="coin"></i> '+st.cost+'</button>')+'</div>'}).join('');
 $('styleList').querySelectorAll('button[data-use],button[data-buy]').forEach(b=>b.onclick=e=>{e.stopPropagation();const id=b.dataset.use||b.dataset.buy,st=STYLES.find(s=>s.id===id);
  if(b.dataset.buy){if(S.coins<st.cost)return;S.coins-=st.cost;S.owned.push(id);SFX.coin();SFX.mission()}else SFX.click();
  S.style=id;save();if(G.state!=='play'){reset()}drawStyles()})}
/* settings */
function loadSettings(){$('sVol').value=S.set.vol;$('sMus').value=S.set.mus;$('sMute').checked=S.set.mute;$('sShake').checked=S.set.shake;$('sLow').checked=S.set.low}
$('sVol').oninput=e=>{S.set.vol=+e.target.value;applyVol();save()};$('sVol').onchange=()=>SFX.perfect(3);
$('sMus').oninput=e=>{S.set.mus=+e.target.value;applyVol();save()};
$('sMute').onchange=e=>{S.set.mute=e.target.checked;applyVol();save()};
$('sShake').onchange=e=>{S.set.shake=e.target.checked;save()};
$('sLow').onchange=e=>{S.set.low=e.target.checked;save();applyQuality()};
['sVol','sMus','sMute','sShake','sLow'].forEach(id=>$(id).addEventListener('pointerdown',e=>e.stopPropagation()));

/* ================= loop ================= */
function resize(){const w=innerWidth,h=innerHeight,a=w/h,v=a<1?7.6:6.2;cam.left=-v*a;cam.right=v*a;cam.top=v;cam.bottom=-v;cam.updateProjectionMatrix();ren.setSize(w,h)}
addEventListener('resize',resize);
let last=performance.now();
function loop(now){requestAnimationFrame(loop);let dt=Math.min(.05,(now-last)/1000);last=now;music();
 if(G.paused){ren.render(scene,cam);return}
 G.t+=dt;
 if(G.freeze>0){G.freeze-=dt;dt*=.05}
 if(moving&&G.state==='play'){const M=moving;let sp=G.speed;
  if(G.score>=windAt()){const k=G.score>=50?.55:.35;sp*=1+k*Math.sin(G.t*1.9)*Math.sin(G.t*.73+1)}
  M.t+=dt*sp*M.dir;if(M.t>M.range*2){M.t=M.range*2;M.dir=-1}if(M.t<0){M.t=0;M.dir=1}
  const p=-M.range+M.t;if(M.cross){M.x=M.ox+p;M.z=M.oz+p*M.dz}else if(M.axis)M.z=p;else M.x=p;M.m.position.set(M.x,M.m.position.y+(G.score>=windAt()?Math.sin(G.t*9)*.002:0),M.z)}
 for(let i=falls.length-1;i>=0;i--){const f=falls[i];f.vy-=22*dt;f.m.position.x+=f.vx*dt;f.m.position.z+=f.vz*dt;f.m.position.y+=f.vy*dt;f.m.rotation.x+=f.rx*dt;f.m.rotation.z+=f.rz*dt;
  if(!f.hit&&f.m.position.y<-1){f.hit=true;burst(f.m.position.x,-1.4,f.m.position.z,10,0x9a9080,2,.12,2)}
  if(f.m.position.y<G.camY-40||f.m.position.y<-6){kill(f.m);falls.splice(i,1)}}
 for(let i=rings.length-1;i>=0;i--){const r=rings[i];r.t+=dt;const s=1+r.t*1.6;r.m.scale.set(s,1,s);r.m.material.opacity=1-r.t/.6;if(r.t>.6){scene.remove(r.m);r.m.geometry.dispose();r.m.material.dispose();rings.splice(i,1)}}
 for(const b of stack){if(b.m.userData.sq!==undefined){b.m.userData.sq+=dt*7;const t=b.m.userData.sq;b.m.scale.y=t>=1?1:1-.25*Math.cos(t*Math.PI*1.5)*Math.exp(-t*3);if(t>=1)delete b.m.userData.sq}}
 /* particles */
 let k=0;for(const o of P){if(!o.on)continue;o.life-=dt;if(o.life<=0){o.on=false;continue}o.v.y-=9*dt;o.p.addScaledVector(o.v,dt);const s=o.s*(o.life/o.max);
  _m.compose(o.p,_q,_s.set(s,s,s));parts.setMatrixAt(k,_m);parts.setColorAt(k,o.c);k++}
 parts.count=k;parts.instanceMatrix.needsUpdate=true;if(parts.instanceColor)parts.instanceColor.needsUpdate=true;
 for(const c of clouds){c.position.x+=c.userData.v*dt;if(c.position.x>50)c.position.x=-50;if(c.position.x<-50)c.position.x=50}
 /* camera rises with the tower; on game over it pulls back to show the whole thing */
 const n=stack.length,over=G.state==='over',ty=over?n*H*.5:n*H;G.camY=lerp(G.camY,ty,1-Math.exp(-3*dt));
 const zoom=over?Math.max(1,n*H/9):G.state==='menu'?2.2:1;cam.zoom=lerp(cam.zoom,1/zoom,1-Math.exp(-3*dt));cam.updateProjectionMatrix();
 const sh=G.shake>0?G.shake:0;G.shake=Math.max(0,G.shake-dt*1.2);
 const idle=G.state==='menu'?G.t*.15:0;cam.position.set(12*Math.cos(.785+idle)+rnd(-sh,sh)*.6,G.camY+12+rnd(-sh,sh)*.4,12*Math.sin(.785+idle));cam.lookAt(0,G.camY-2,0);
 sun.position.set(6,G.camY+14,4);sun.target.position.set(0,G.camY-2,0);sun.target.updateMatrixWorld();sky.position.set(0,G.camY,0);
 const tp=stack[stack.length-1];beacon.position.set(tp.x,tp.m.position.y+.6,tp.z);beacon.visible=night>.3&&(G.t%1.2)<.25&&G.state!=='play';
 ren.render(scene,cam)}
/* collect a vault payout sent from Tumbler (the daily safe on this site) */
function collectBank(){let bank;try{bank=JSON.parse(localStorage.getItem('gbs-bank')||'{}')}catch(e){return}const b=bank&&bank.skyline;if(!b||!b.coins)return;
 const n=b.coins;S.coins+=n;delete bank.skyline;try{localStorage.setItem('gbs-bank',JSON.stringify(bank))}catch(e){}save();drawMenu();setTimeout(()=>toast('Vault payout from Tumbler: +'+n+' coins'),600)}
applyQuality();reset();drawMenu();collectBank();addEventListener('focus',collectBank);skyAt(0);requestAnimationFrame(loop);
window.__SK={G,R,S,place,start,pause,toMenu,get moving(){return moving},get stack(){return stack}};

try{if(/[?&](daily|tour)/.test(location.search)){const b=document.getElementById(/tour/.test(location.search)?'mTour':'mDaily');if(b){b.classList.add('pulse');b.scrollIntoView({block:'center'})}}}catch(e){}
})();
