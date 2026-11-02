/* SWITCHBACK — mountain road racing. Three.js r128; every model, texture and sound is generated at load. */
(()=>{'use strict';
const $=id=>document.getElementById(id),R=Math.random,rr=(a,b)=>a+R()*(b-a),clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
const TAU=Math.PI*2,PI=Math.PI,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const wrapA=a=>{a=(a+PI)%TAU;if(a<0)a+=TAU;return a-PI};
// ---------------- deterministic noise ----------------
const hash2=(x,y,s)=>{let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,982451653))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
function vn2(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function fbm2(x,y,s,o){let t=0,a=.5,n=0;for(let i=0;i<(o||5);i++){t+=a*vn2(x,y,s+i*31);n+=a;x=x*2.03+1.7;y=y*2.03+9.2;a*=.5}return t/n}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// ---------------- CARS, PAINT, TRACKS ----------------
// shape: proportions for the lofted body. power in kW, mass in kg.
const CARS=[
 {id:'gt',name:'Vento GT',desc:'Front-engine coupe. Balanced, quick and easy to place in a corner.',drive:'RWD',power:330,mass:1420,grip:1.0,brake:1,top:79,steer:.62,down:.0011,
  shape:{L:4.55,W:1.95,H:1.24,hood:.98,belt:.86,roof:1.24,nose:.62,tail:1.0,ws:.36,rw:.72,cabF:.36,cabR:.72,flare:.06,wing:0,ride:.13},paint:0,lockText:''},
 {id:'rally',name:'Rallye 4',desc:'All-wheel-drive hatch. Grips on anything and jumps out of corners.',drive:'AWD',power:250,mass:1230,grip:1.06,brake:1.02,top:68,steer:.68,down:.0008,
  shape:{L:4.05,W:1.86,H:1.42,hood:1.02,belt:.96,roof:1.42,nose:.7,tail:1.12,ws:.33,rw:.34,cabF:.33,cabR:.86,flare:.09,wing:1,ride:.17},paint:1,lockText:''},
 {id:'muscle',name:'Stallion 8',desc:'Big V8, long hood, lively rear. Fastest in a straight line, a handful on the brakes.',drive:'RWD',power:410,mass:1640,grip:.95,brake:.93,top:84,steer:.58,down:.0006,
  shape:{L:4.85,W:1.98,H:1.3,hood:1.04,belt:.92,roof:1.3,nose:.82,tail:1.04,ws:.3,rw:.5,cabF:.44,cabR:.74,flare:.05,wing:2,ride:.14},paint:2,lockText:'Finish on the podium in any race to unlock.'},
 {id:'apex',name:'Apex P1',desc:'Mid-engine hypercar with real downforce. Brakes late, turns hard, punishes mistakes.',drive:'RWD',power:520,mass:1320,grip:1.12,brake:1.12,top:92,steer:.6,down:.0019,
  shape:{L:4.6,W:2.04,H:1.14,hood:.86,belt:.8,roof:1.14,nose:.5,tail:.98,ws:.42,rw:.24,cabF:.34,cabR:.64,flare:.11,wing:3,ride:.1},paint:3,lockText:'Win a race on three different tracks to unlock.'}];
const PAINTS=[{n:'Signal red',c:0xb0121a},{n:'Glacier white',c:0xe8eaec},{n:'Racing green',c:0x0e3b26},{n:'Electric blue',c:0x1546c8},{n:'Graphite',c:0x2a2c30},{n:'Saffron',c:0xe3a100},{n:'Lime',c:0x6fbf1a},{n:'Plum',c:0x4a1e5a}];
const TRACKS=[
 {id:'eagle',name:'Eagle Pass',seed:7301,tod:'day',biome:'alpine',size:560,pts:13,elev:150,desc:'Fast sweepers and two hairpins over a high alpine pass.'},
 {id:'larch',name:'Larch Lake',seed:4419,tod:'golden',biome:'lake',size:520,pts:15,elev:110,desc:'Lakeside straights, then a climb through the larch forest.'},
 {id:'frost',name:'Frost Ridge',seed:9127,tod:'overcast',biome:'winter',size:470,pts:16,elev:170,desc:'Snow banks and cold tarmac. Grip is lower, so brake early.'},
 {id:'devil',name:'Devil’s Stair',seed:2213,tod:'night',biome:'alpine',size:440,pts:18,elev:190,desc:'A ladder of switchbacks up the mountain, raced by headlight.'}];
const DIFF=[{n:'Easy',sk:[.8,.88]},{n:'Normal',sk:[.9,.97]},{n:'Hard',sk:[.98,1.04]}];
// ---------------- SAVE ----------------
const DEF={car:'gt',paint:{gt:0,rally:1,muscle:2,apex:3},rec:{},wins:[],podium:0,races:0,
 set:{master:8,music:4,sfx:8,q:2,units:'kmh',cam:0,assist:1,diff:1,laps:3,tod:'track',shake:1}};
let save=JSON.parse(JSON.stringify(DEF));
try{const s=JSON.parse(localStorage.getItem('switchback1')||'{}');if(s&&typeof s==='object'){
 if(CARS.some(c=>c.id===s.car))save.car=s.car;
 if(s.paint&&typeof s.paint==='object')for(const c of CARS)if(Number.isInteger(s.paint[c.id])&&s.paint[c.id]>=0&&s.paint[c.id]<PAINTS.length)save.paint[c.id]=s.paint[c.id];
 if(s.rec&&typeof s.rec==='object')for(const t of TRACKS){const r=s.rec[t.id];if(r&&typeof r==='object'){const o={};for(const k of['lap','race'])if(Number.isFinite(r[k])&&r[k]>0)o[k]=r[k];if(Number.isFinite(r.pos))o.pos=r.pos|0;
  if(Array.isArray(r.ghost)&&r.ghost.length<20000&&r.ghost.every(Number.isFinite))o.ghost=r.ghost;save.rec[t.id]=o}}
 if(Array.isArray(s.wins))save.wins=[...new Set(s.wins.filter(w=>TRACKS.some(t=>t.id===w)))];
 for(const k of['podium','races'])if(Number.isFinite(s[k]))save[k]=Math.max(0,s[k]|0);
 if(s.set&&typeof s.set==='object')for(const k in DEF.set)if(k in s.set&&typeof s.set[k]===typeof DEF.set[k])save.set[k]=s.set[k]}}catch(e){}
try{if(!localStorage.getItem('switchback1')&&matchMedia('(hover: none) and (pointer: coarse)').matches)save.set.q=0}catch(e){}
save.set.q=clamp(save.set.q|0,0,2);save.set.diff=clamp(save.set.diff|0,0,2);if(![2,3,5].includes(save.set.laps))save.set.laps=3;
const store=()=>{try{localStorage.setItem('switchback1',JSON.stringify(save))}catch(e){}};
const unlocked=id=>id==='muscle'?save.podium>0:id==='apex'?save.wins.length>=3:true;
const carDef=()=>CARS.find(c=>c.id===save.car&&unlocked(c.id))||CARS[0];
// ---------------- AUDIO ----------------
const AU={ctx:null,loops:{}};
function audioInit(){if(AU.ctx){if(AU.ctx.state==='suspended')AU.ctx.resume();return}try{const C=new(window.AudioContext||window.webkitAudioContext)();AU.ctx=C;
 const comp=C.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.connect(C.destination);
 AU.master=C.createGain();AU.master.connect(comp);AU.sfx=C.createGain();AU.sfx.connect(AU.master);AU.mus=C.createGain();AU.mus.connect(AU.master);
 const len=C.sampleRate*2|0,ir=C.createBuffer(2,len,C.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(R()*2-1)*Math.pow(1-i/len,4)}
 AU.verb=C.createConvolver();AU.verb.buffer=ir;AU.send=C.createGain();AU.send.gain.value=.25;AU.send.connect(AU.verb);AU.verb.connect(AU.master);
 const nb=C.createBuffer(1,C.sampleRate*3,C.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=R()*2-1;AU.noise=nb;
 let b0=0,b1=0,b2=0;const pb=C.createBuffer(1,C.sampleRate*4,C.sampleRate),pd=pb.getChannelData(0);for(let i=0;i<pd.length;i++){const w=R()*2-1;b0=.99765*b0+w*.099;b1=.963*b1+w*.2965;b2=.57*b2+w*1.0526;pd[i]=(b0+b1+b2+w*.1848)*.18}AU.pink=pb;
 const bb=C.createBuffer(1,C.sampleRate*4,C.sampleRate),bd=bb.getChannelData(0);let l=0;for(let i=0;i<bd.length;i++){l=(l+.02*(R()*2-1))/1.02;bd[i]=l*3.2}AU.brown=bb;
 const loop=(buf,type,f,q)=>{const s=C.createBufferSource();s.buffer=buf;s.loop=true;const fl=C.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=C.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(AU.sfx);s.start(0,R()*2);return{s,f:fl,g}};
 AU.loops.wind=loop(AU.pink,'lowpass',700,.5);AU.loops.screech=loop(AU.noise,'bandpass',1500,4);AU.loops.screech2=loop(AU.noise,'bandpass',2600,6);
 AU.loops.gravel=loop(AU.brown,'lowpass',420,.7);AU.loops.scrape=loop(AU.noise,'highpass',2500,.8);AU.loops.road=loop(AU.brown,'lowpass',160,.6);
 AU.eng=engineVoice(1);AU.eng2=engineVoice(.55);
 setVol();Music.start()}catch(e){AU.ctx=null}}
function setVol(){if(!AU.ctx)return;const s=save.set,t=AU.ctx.currentTime;AU.master.gain.setTargetAtTime(s.master/10,t,.05);AU.sfx.gain.setTargetAtTime(s.sfx/10,t,.05);AU.mus.gain.setTargetAtTime(s.music/10*.45,t,.05)}
function loopSet(n,gain,freq,k){const L=AU.loops[n];if(!L||!AU.ctx)return;const t=AU.ctx.currentTime;L.g.gain.setTargetAtTime(gain,t,k||.06);if(freq&&L.f)L.f.frequency.setTargetAtTime(freq,t,k||.06)}
// engine: three detuned oscillators at the firing frequency, soft-clipped and filtered by load
function engineVoice(vol){const C=AU.ctx,o1=C.createOscillator(),o2=C.createOscillator(),o3=C.createOscillator(),ws=C.createWaveShaper(),lp=C.createBiquadFilter(),g=C.createGain(),og=C.createGain();
 o1.type='sawtooth';o2.type='square';o3.type='sawtooth';o3.detune.value=7;const curve=new Float32Array(256);for(let i=0;i<256;i++){const x=i/128-1;curve[i]=Math.tanh(x*2.4)}ws.curve=curve;
 const g1=C.createGain(),g2=C.createGain(),g3=C.createGain();g1.gain.value=.5;g2.gain.value=.35;g3.gain.value=.22;o1.connect(g1);o2.connect(g2);o3.connect(g3);g1.connect(ws);g2.connect(ws);g3.connect(ws);
 const ns=C.createBufferSource();ns.buffer=AU.noise;ns.loop=true;const nf=C.createBiquadFilter();nf.type='bandpass';nf.Q.value=1.2;const ngain=C.createGain();ngain.gain.value=0;ns.connect(nf);nf.connect(ngain);ngain.connect(lp);
 ws.connect(lp);lp.type='lowpass';lp.Q.value=1.1;lp.connect(g);g.gain.value=0;g.connect(og);og.gain.value=vol;og.connect(AU.sfx);[o1,o2,o3].forEach(o=>{o.frequency.value=40;o.start()});ns.start();
 return{set(rpm,load,cyl,on){const t=C.currentTime,f=Math.max(18,rpm/60*cyl/2);o1.frequency.setTargetAtTime(f,t,.025);o2.frequency.setTargetAtTime(f*.5,t,.025);o3.frequency.setTargetAtTime(f*2.01,t,.025);
   nf.frequency.setTargetAtTime(f*3.2,t,.03);ngain.gain.setTargetAtTime(.25*load,t,.05);lp.frequency.setTargetAtTime(380+load*2600+rpm*.25,t,.04);g.gain.setTargetAtTime((+on||0)*(.07+load*.09)*(.75+rpm/9000*.5),t,.06)}}}
function out(g,v){g.connect(AU.sfx);if(v){const s=AU.ctx.createGain();s.gain.value=v;g.connect(s);s.connect(AU.send)}}
function tone(f,d,type,vol,f2,o={}){const C=AU.ctx;if(!C)return;const t=C.currentTime+(o.at||0),os=C.createOscillator(),g=C.createGain();os.type=type||'sine';os.frequency.setValueAtTime(f,t);if(f2)os.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+d);
 g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(o.a||.004));g.gain.exponentialRampToValueAtTime(.0001,t+d);os.connect(g);out(g,o.wet??.25);os.start(t);os.stop(t+d+.05)}
function noise(d,vol,ft,f0,f1,q,o={}){const C=AU.ctx;if(!C)return;const t=C.currentTime+(o.at||0),s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain();s.buffer=o.buf||AU.noise;
 f.type=ft;f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+d);f.Q.value=q||1;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(o.a||.003));g.gain.exponentialRampToValueAtTime(.0001,t+d);
 s.connect(f);f.connect(g);out(g,o.wet??.25);s.start(t,R()*1.5);s.stop(t+d+.05)}
const nf=n=>440*Math.pow(2,(n-9)/12);
const SFX={
 beep(){tone(660,.22,'square',.09,0,{wet:.1})},go(){tone(990,.7,'square',.1,0,{wet:.2});tone(1980,.5,'sine',.05,0,{wet:.2})},
 shift(){noise(.07,.18,'bandpass',900,400,2,{wet:0});tone(120,.08,'square',.05,60,{wet:0})},
 pop(){noise(.09,.35,'lowpass',1400,200,1,{wet:.05});tone(70,.1,'sine',.25,40,{wet:0})},
 hit(k){k=clamp(k||.5,.1,1.6);tone(85,.3,'sine',.7*k,35,{wet:.05});noise(.35*k+.1,.6*k,'lowpass',2200,250,.7,{wet:.15,buf:AU.pink});noise(.2,.3*k,'highpass',4000,1500,.8,{wet:.05})},
 tap(k){noise(.12,.25*clamp(k,.1,1),'bandpass',1200,500,1.4,{wet:.05})},
 nitro(){noise(.7,.4,'bandpass',500,2600,1.4,{wet:.15});tone(160,.6,'sawtooth',.05,420,{wet:.1})},
 lap(){tone(nf(76),.35,'triangle',.12,0,{wet:.4});tone(nf(83),.5,'triangle',.11,0,{at:.1,wet:.4})},
 best(){[76,80,83,88].forEach((n,i)=>tone(nf(n),.6,'triangle',.1,0,{at:i*.08,wet:.45}))},
 finish(){[64,67,71,76,79,83].forEach((n,i)=>tone(nf(n),.9,'triangle',.11,0,{at:i*.09,wet:.5}))},
 click(){tone(900,.05,'triangle',.07,0,{wet:0})},warn(){tone(220,.4,'sawtooth',.07,160,{wet:.2})},
 pass(){tone(nf(83),.18,'sine',.08,0,{wet:.3})}};
const sfx=(n,...a)=>{if(AU.ctx&&SFX[n])try{SFX[n](...a)}catch(e){}};
// ---------------- MUSIC: driving loop, quieter while racing ----------------
const Music=(()=>{let on=false,next=0,step=0,bar=0,intensity=0;
 const BPM=118,SP=60/BPM/4,CH=[[45,52,57,60,64],[41,48,53,57,60],[48,55,60,64,67],[43,50,55,59,62]];
 function pad(ch,t,d){const C=AU.ctx;ch.slice(2,5).forEach(n=>{for(const det of[-8,8]){const o=C.createOscillator(),g=C.createGain(),f=C.createBiquadFilter();o.type='sawtooth';o.frequency.value=nf(n);o.detune.value=det;f.type='lowpass';f.frequency.value=700+intensity*700;
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.016,t+d*.25);g.gain.linearRampToValueAtTime(.0001,t+d);o.connect(f);f.connect(g);g.connect(AU.mus);const s=C.createGain();s.gain.value=.4;g.connect(s);s.connect(AU.send);o.start(t);o.stop(t+d+.1)}})}
 function bass(n,t){const C=AU.ctx,o=C.createOscillator(),g=C.createGain(),f=C.createBiquadFilter();o.type='sawtooth';o.frequency.value=nf(n-12);f.type='lowpass';f.frequency.setValueAtTime(900,t);f.frequency.exponentialRampToValueAtTime(160,t+.18);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.11,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.connect(f);f.connect(g);g.connect(AU.mus);o.start(t);o.stop(t+.3)}
 function kick(t){const C=AU.ctx,o=C.createOscillator(),g=C.createGain();o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(42,t+.16);g.gain.setValueAtTime(.34,t);g.gain.exponentialRampToValueAtTime(.0001,t+.28);o.connect(g);g.connect(AU.mus);o.start(t);o.stop(t+.3)}
 function hit(t,v,hp,d){const C=AU.ctx,s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain();s.buffer=AU.noise;f.type='highpass';f.frequency.value=hp;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(f);f.connect(g);g.connect(AU.mus);s.start(t,R());s.stop(t+d+.02)}
 function sched(){const C=AU.ctx;if(!C||!on)return;while(next<C.currentTime+.25){const t=next,i=step%16,ch=CH[bar%4];
  if(i===0)pad(ch,t,SP*16);if(i%4===0)kick(t);if(i===4||i===12)hit(t,.12,1800,.14);if(i%2===1)hit(t,.035,7500,.05);
  if([0,3,6,8,10,14].includes(i))bass(ch[i===10?1:0],t);
  next+=SP;step++;if(step%16===0)bar++}}
 return{start(){if(on||!AU.ctx)return;on=true;next=AU.ctx.currentTime+.1;setInterval(sched,60)},set(v){intensity=v}}})();

// ================= RENDERER + POST PROCESSING =================
const ren=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',stencil:false});
ren.outputEncoding=THREE.LinearEncoding;ren.toneMapping=THREE.NoToneMapping;ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;ren.autoClear=false;
ren.domElement.id='gl';document.body.prepend(ren.domElement);
const isGL2=ren.capabilities.isWebGL2,HDR=(isGL2&&ren.extensions.has('EXT_color_buffer_float'))||(!isGL2&&ren.extensions.has('OES_texture_half_float')&&ren.extensions.has('EXT_color_buffer_half_float'));
const FT=HDR?THREE.HalfFloatType:THREE.UnsignedByteType;
// aerial perspective: a long exponential tail instead of the squared fog, so far ridges stay readable
THREE.ShaderChunk.fog_fragment=THREE.ShaderChunk.fog_fragment.replace('float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );','float fogFactor = 1.0 - exp( - pow( fogDensity * fogDepth, 1.25 ) );');
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xbfd2e6,.0004);
const cam=new THREE.PerspectiveCamera(62,1,.2,9000);scene.add(cam);
const SH={
quadV:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
bright:'uniform sampler2D t;uniform float th;varying vec2 vUv;void main(){vec3 c=min(texture2D(t,vUv).rgb,vec3(30.));float l=max(max(c.r,c.g),c.b);gl_FragColor=vec4(c*max(l-th,0.)/max(l,1e-4),1.);}',
down:'uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){vec4 s=texture2D(t,vUv)*4.;s+=texture2D(t,vUv-px);s+=texture2D(t,vUv+px);s+=texture2D(t,vUv+vec2(px.x,-px.y));s+=texture2D(t,vUv+vec2(-px.x,px.y));gl_FragColor=s*.125;}',
up:'uniform sampler2D t;uniform sampler2D tAdd;uniform vec2 px;uniform float k;varying vec2 vUv;void main(){vec4 s=texture2D(t,vUv+vec2(-px.x*2.,0.));s+=texture2D(t,vUv+vec2(-px.x,px.y))*2.;s+=texture2D(t,vUv+vec2(0.,px.y*2.));s+=texture2D(t,vUv+vec2(px.x,px.y))*2.;s+=texture2D(t,vUv+vec2(px.x*2.,0.));s+=texture2D(t,vUv+vec2(px.x,-px.y))*2.;s+=texture2D(t,vUv+vec2(0.,-px.y*2.));s+=texture2D(t,vUv+vec2(-px.x,-px.y))*2.;gl_FragColor=s/12.+texture2D(tAdd,vUv)*k;}',
comp:`uniform sampler2D tScene;uniform sampler2D tBloom;uniform float bloom;uniform float exposure;uniform float vig;uniform float speed;uniform float fade;uniform float white;uniform float sat;uniform vec3 lift;uniform vec3 gain;varying vec2 vUv;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 dc=vUv-.5;float r2=dot(dc,dc);vec3 col=texture2D(tScene,vUv).rgb;
 if(speed>.01){vec2 dir=dc*speed*.05*smoothstep(.02,.25,r2);vec3 acc=col;for(int i=1;i<6;i++){float f=float(i)/5.;acc+=texture2D(tScene,vUv-dir*f).rgb;}col=acc/6.;}
 col+=texture2D(tBloom,vUv).rgb*bloom;col*=exposure;col=aces(col);float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,sat);
 col=pow(col,vec3(1./2.2));col=col*gain+lift*(1.-col);col*=1.-vig*r2*1.4;col=mix(col,vec3(1.),white);col*=1.-fade;gl_FragColor=vec4(col,1.);}`,
partV:'attribute float psize;attribute vec4 pcol;uniform float scale;varying vec4 vC;void main(){vC=pcol;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(psize*scale/max(-mv.z,.05),900.);gl_Position=projectionMatrix*mv;}',
partF:'uniform sampler2D map;varying vec4 vC;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC.rgb*t.rgb,vC.a*t.a);}',
skyV:'varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;gl_Position.z=gl_Position.w*.99999;}',
skyF:`uniform vec3 sunDir;uniform vec3 zen;uniform vec3 hor;uniform vec3 haze;uniform vec3 sunCol;uniform float time;uniform float cloud;uniform float stars;uniform vec3 camPos;varying vec3 vW;
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
void main(){vec3 d=normalize(vW-camPos);float h=d.y,sa=max(dot(d,sunDir),0.);
 vec3 c=mix(hor,zen,pow(clamp(h,0.,1.),.42));c=mix(c,haze,smoothstep(.06,-.12,h));
 c+=sunCol*(pow(sa,6.)*.22+pow(sa,48.)*.6+pow(sa,600.)*2.5);
 c+=sunCol*smoothstep(.99955,.99975,sa)*22.;
 if(h>-.02&&cloud>0.){vec2 uv=d.xz/(h+.18)*1.6+vec2(time*.004,time*.002);float n=fbm(uv);float cov=smoothstep(1.-cloud,1.-cloud+.35,n);
  float lit=.55+.45*fbm(uv+sunDir.xz*.15);vec3 cc=mix(hor*.9,vec3(1.)*(.75+.5*sunCol*pow(sa,4.)),lit);c=mix(c,cc,cov*smoothstep(-.02,.12,h)*.92);}
 if(stars>0.&&h>0.){vec2 g=floor(d.xz/(h+.3)*220.);float s=step(.9975,h21(g));c+=vec3(s*stars*(.6+.4*sin(time*3.+h21(g+1.)*40.)));}
 gl_FragColor=linearToOutputTexel(vec4(c,1.));}`};
const quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1),quadScene=new THREE.Scene(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null);quad.frustumCulled=false;quadScene.add(quad);
const SM=(f,u)=>new THREE.ShaderMaterial({uniforms:u,vertexShader:SH.quadV,fragmentShader:f,depthTest:false,depthWrite:false});
const black=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1,THREE.RGBAFormat);black.needsUpdate=true;
const PP={bright:SM(SH.bright,{t:{value:null},th:{value:1}}),down:SM(SH.down,{t:{value:null},px:{value:new THREE.Vector2()}}),up:SM(SH.up,{t:{value:null},tAdd:{value:null},px:{value:new THREE.Vector2()},k:{value:1}}),
 comp:SM(SH.comp,{tScene:{value:null},tBloom:{value:black},bloom:{value:.1},exposure:{value:.75},vig:{value:.5},speed:{value:0},fade:{value:0},white:{value:0},sat:{value:1.05},lift:{value:new THREE.Vector3()},gain:{value:new THREE.Vector3(1,1,1)}}),rt:null,mips:[],ups:[]};
const rtOpt=d=>({minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,type:FT,depthBuffer:!!d,stencilBuffer:false});
let PART=null;
function setupPost(){const q=save.set.q,cpr=q===0?1:Math.min(devicePixelRatio,q===2?1.75:1.25),pr=cpr*(q===0?.75:1);
 const w=Math.max(2,innerWidth*pr|0),h=Math.max(2,innerHeight*pr|0);ren.setPixelRatio(cpr);ren.setSize(innerWidth,innerHeight,false);ren.domElement.style.width='100%';ren.domElement.style.height='100%';
 if(PP.rt)PP.rt.dispose();PP.mips.forEach(r=>r.dispose());PP.ups.forEach(r=>r.dispose());PP.mips=[];PP.ups=[];
 if(isGL2&&q>0&&THREE.WebGLMultisampleRenderTarget){PP.rt=new THREE.WebGLMultisampleRenderTarget(w,h,rtOpt(1));PP.rt.samples=q===2?4:2}else PP.rt=new THREE.WebGLRenderTarget(w,h,rtOpt(1));
 if(q>0){let bw=w>>1,bh=h>>1;const n=q===2?6:5;for(let i=0;i<n;i++){PP.mips.push(new THREE.WebGLRenderTarget(Math.max(1,bw),Math.max(1,bh),rtOpt(0)));if(i>0)PP.ups.push(new THREE.WebGLRenderTarget(Math.max(1,bw),Math.max(1,bh),rtOpt(0)));bw>>=1;bh>>=1}}
 cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();PP.comp.uniforms.tBloom.value=black;
 ren.shadowMap.enabled=true;sun.castShadow=true;const sz=q===2?2048:q===1?1536:1024;sun.shadow.mapSize.set(sz,sz);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}
 if(PART)PART.forEach(p=>p.mat.uniforms.scale.value=h/(2*Math.tan(cam.fov*Math.PI/360)))}
function pass(mat,target){quad.material=mat;ren.setRenderTarget(target);ren.render(quadScene,quadCam)}
function renderFrame(){ren.setRenderTarget(PP.rt);ren.clear();ren.render(scene,cam);
 const U=PP.comp.uniforms;U.tScene.value=PP.rt.texture;
 if(PP.mips.length){PP.bright.uniforms.t.value=PP.rt.texture;PP.bright.uniforms.th.value=HDR?4.5:.95;pass(PP.bright,PP.mips[0]);
  for(let i=1;i<PP.mips.length;i++){const s=PP.mips[i-1];PP.down.uniforms.t.value=s.texture;PP.down.uniforms.px.value.set(1/s.width,1/s.height);pass(PP.down,PP.mips[i])}
  let src=PP.mips[PP.mips.length-1];for(let i=PP.mips.length-2;i>=1;i--){const tgt=PP.ups[i-1];PP.up.uniforms.t.value=src.texture;PP.up.uniforms.tAdd.value=PP.mips[i].texture;PP.up.uniforms.px.value.set(1/src.width,1/src.height);PP.up.uniforms.k.value=1;pass(PP.up,tgt);src=tgt}
  U.tBloom.value=src.texture}else U.tBloom.value=black;
 pass(PP.comp,null)}
// ================= SKY, SUN, ATMOSPHERE =================
const sun=new THREE.DirectionalLight(0xffffff,3);scene.add(sun,sun.target);
sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:400});sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;sun.shadow.radius=2.5;
const hemi=new THREE.HemisphereLight(0x9cc0ff,0xdfe8f5,1);scene.add(hemi);
const skyU={sunDir:{value:new THREE.Vector3(0,1,0)},zen:{value:new THREE.Color()},hor:{value:new THREE.Color()},haze:{value:new THREE.Color()},sunCol:{value:new THREE.Color()},time:{value:0},cloud:{value:.3},stars:{value:0},camPos:{value:new THREE.Vector3()}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(2800,48,24),new THREE.ShaderMaterial({uniforms:skyU,vertexShader:SH.skyV,fragmentShader:SH.skyF,side:THREE.BackSide,depthWrite:false,fog:false}));sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);
// time-of-day looks: sun elevation/azimuth (deg), colours, light, fog, grading, weather
const TOD={
 day:{name:'Midday',el:46,az:150,zen:0x0f45a6,hor:0xa6c6ea,haze:0xcfdeef,sun:0xfff4e4,sunI:3.3,sky:0x93b6f0,gnd:0x7d8a5c,hemiI:.62,fog:0xb9cde6,fogD:.00034,cloud:.3,snow:0,exp:.56,sat:1.08,gain:[1,1,1.01],lift:[0,0,.01],stars:0,head:0},
 golden:{name:'Golden hour',el:9,az:118,zen:0x2a5596,hor:0xffcf9e,haze:0xe9d2bb,sun:0xffb86b,sunI:3.1,sky:0x8aa3d4,gnd:0x8a7a52,hemiI:.58,fog:0xe2c9ae,fogD:.0004,cloud:.34,snow:0,exp:.64,sat:1.13,gain:[1.05,1,.94],lift:[.012,.004,0],stars:0,head:0},
 overcast:{name:'Snow cloud',el:28,az:160,zen:0x8792a3,hor:0xc5ced8,haze:0xccd4dd,sun:0xe2e8f0,sunI:1.05,sky:0xc0cbda,gnd:0xb8c0cc,hemiI:1.25,fog:0xc4ccd6,fogD:.0011,cloud:.92,snow:.35,exp:.66,sat:.9,gain:[.98,1,1.02],lift:[.02,.02,.03],stars:0,head:.4},
 dusk:{name:'Blue hour',el:-2,az:165,zen:0x0f1c3e,hor:0x5f72a8,haze:0x6b78a2,sun:0x95a8ff,sunI:.6,sky:0x51659e,gnd:0x3a4258,hemiI:.85,fog:0x56638c,fogD:.0005,cloud:.22,snow:0,exp:1.05,sat:1.02,gain:[.96,.99,1.06],lift:[0,.005,.03],stars:.8,head:1},
 night:{name:'Night',el:38,az:-40,zen:0x02050d,hor:0x0d1626,haze:0x111a2b,sun:0x9fb4ff,sunI:.32,sky:0x22304f,gnd:0x0d1018,hemiI:.55,fog:0x0b111c,fogD:.0006,cloud:.18,snow:0,exp:1.5,sat:.95,gain:[.95,.99,1.08],lift:[0,.004,.018],stars:1,head:1}};
const TOD_KEYS=['day','golden','overcast','dusk','night'];
let todKey='day',T=TOD.day;
const sunVec=new THREE.Vector3();
function setTOD(k){todKey=TOD[k]?k:'day';T=TOD[todKey];const el=Math.max(T.el,4)*PI/180,az=T.az*PI/180;
 sunVec.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).normalize();
 const vis=T.el<0?new THREE.Vector3(Math.sin(az)*Math.cos(.05),Math.sin(T.el*PI/180),Math.cos(az)*Math.cos(.05)).normalize():sunVec;
 skyU.sunDir.value.copy(vis);skyU.zen.value.set(T.zen);skyU.hor.value.set(T.hor);skyU.haze.value.set(T.haze);skyU.sunCol.value.set(T.sun);skyU.cloud.value=T.cloud;skyU.stars.value=T.stars;
 sun.color.set(T.sun);sun.intensity=T.sunI;hemi.color.set(T.sky);hemi.groundColor.set(T.gnd);hemi.intensity=T.hemiI;
 scene.fog.color.set(T.fog);scene.fog.density=T.fogD;
 const U=PP.comp.uniforms;U.exposure.value=T.exp;U.sat.value=T.sat;U.gain.value.fromArray(T.gain);U.lift.value.fromArray(T.lift);
 buildEnvMap()}
function buildEnvMap(){const es=new THREE.Scene(),m=new THREE.Mesh(new THREE.SphereGeometry(100,32,16),new THREE.ShaderMaterial({uniforms:Object.assign({},skyU,{camPos:{value:new THREE.Vector3()},time:{value:0}}),vertexShader:SH.skyV.replace('gl_Position.z=gl_Position.w*.99999;',''),fragmentShader:SH.skyF,side:THREE.BackSide}));es.add(m);
 const g=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshBasicMaterial({color:new THREE.Color(T.gnd).multiplyScalar(.7*T.hemiI)}));g.rotation.x=-PI/2;g.position.y=-3;es.add(g);
 // a dark band of distant forest and mountains on the horizon so car paint does not mirror an empty sky
 const band=new THREE.Mesh(new THREE.CylinderGeometry(90,90,16,48,1,true),new THREE.MeshBasicMaterial({color:new THREE.Color(T.fog).lerp(new THREE.Color(0x2a3326),.55).multiplyScalar(T.hemiI*.9),side:THREE.BackSide}));band.position.y=2;es.add(band);
 const pm=new THREE.PMREMGenerator(ren);if(scene.environment)scene.environment.dispose();scene.environment=pm.fromScene(es,.02,.1,1000).texture;pm.dispose();m.geometry.dispose();m.material.dispose();g.geometry.dispose();band.geometry.dispose()}
// ================= TEXTURES =================
function cv(w,h,f){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');f(x,w,h);return c}
function tex(c,rep,srgb){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy());if(srgb)t.encoding=THREE.sRGBEncoding;return t}
// tileable height -> normal map
function normalMapFrom(H,w,str){const c=document.createElement('canvas');c.width=c.height=w;const x=c.getContext('2d'),img=x.createImageData(w,w),d=img.data;
 const h=(i,j)=>H[((j+w)%w)*w+((i+w)%w)];for(let j=0;j<w;j++)for(let i=0;i<w;i++){const dx=(h(i+1,j)-h(i-1,j))*str,dy=(h(i,j+1)-h(i,j-1))*str,l=Math.hypot(dx,dy,1),k=(j*w+i)*4;d[k]=(-dx/l*.5+.5)*255;d[k+1]=(dy/l*.5+.5)*255;d[k+2]=(1/l*.5+.5)*255;d[k+3]=255}
 x.putImageData(img,0,0);return c}
function tileNoise(w,octaves,seed){const H=new Float32Array(w*w);let amp=1,tot=0;for(let o=0;o<octaves.length;o++){const f=octaves[o],a=1/(o+1)**1.1;tot+=a;
 for(let j=0;j<w;j++)for(let i=0;i<w;i++){const u=i/w*f,v=j/w*f,xi=Math.floor(u),yi=Math.floor(v),xf=u-xi,yf=v-yi,s1=xf*xf*(3-2*xf),s2=yf*yf*(3-2*yf),
  g=(x,y)=>hash2(((x%f)+f)%f,((y%f)+f)%f,seed+o*7),A=g(xi,yi),Bq=g(xi+1,yi),Cq=g(xi,yi+1),Dq=g(xi+1,yi+1);H[j*w+i]+=a*(A+(Bq-A)*s1+(Cq-A)*s2+(A-Bq-Cq+Dq)*s1*s2)}}
 for(let i=0;i<H.length;i++)H[i]/=tot;return H}
const TX={};
function makeTextures(){
 const W=512;
 // asphalt: aggregate grain, sealed patches and fine cracks; tiles every 4 m
 const Hg=tileNoise(W,[24,64,160,320],7),Hp=tileNoise(W,[3,6],19);
 TX.asphaltN=tex(normalMapFrom(Hg.map((v,i)=>v*.9+Hp[i]*.15),W,5.5));
 TX.asphalt=tex(cv(W,W,(x,w,h)=>{const img=x.createImageData(w,h),d=img.data,r=mulberry(77);
  for(let i=0;i<w*h;i++){const g=Hg[i],p=Hp[i];let v=58+g*34+(p-.5)*26;const sp=r();if(sp>.985)v+=40*r();else if(sp<.02)v-=22;d[i*4]=v*.98;d[i*4+1]=v;d[i*4+2]=v*1.03;d[i*4+3]=255}
  x.putImageData(img,0,0);x.strokeStyle='rgba(20,20,22,.55)';x.lineWidth=1.2;for(let k=0;k<7;k++){let px=r()*w,py=r()*h,a=r()*TAU;x.beginPath();x.moveTo(px,py);for(let s=0;s<14;s++){a+=(r()-.5)*1.2;px+=Math.cos(a)*9;py+=Math.sin(a)*9;x.lineTo(px,py)}x.stroke()}}),null,true);
 // ground detail: grass blades and soil clumps
 const Hgr=tileNoise(W,[32,90,220],41);TX.grassN=tex(normalMapFrom(Hgr,W,2.6));
 const Hr=tileNoise(W,[5,13,33,80],53);TX.rockN=tex(normalMapFrom(Hr,W,4.5));
 const H1=tileNoise(W,[3,7,17,41,97,211],11);TX.snowN=tex(normalMapFrom(H1,W,2.6));
 // soft particle sprite (smoke, dust, spray)
 TX.puff=new THREE.CanvasTexture(cv(64,64,(x)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.45,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}));
 TX.spark=new THREE.CanvasTexture(cv(32,32,(x)=>{const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,230,180,.9)');g.addColorStop(1,'rgba(255,140,40,0)');x.fillStyle=g;x.fillRect(0,0,32,32)}));
 // corner chevrons and race banners
 TX.chevron=tex(cv(256,128,(x,w,h)=>{x.fillStyle='#111';x.fillRect(0,0,w,h);x.fillStyle='#f4c400';for(let i=0;i<3;i++){const o=28+i*72;x.beginPath();x.moveTo(o,14);x.lineTo(o+40,64);x.lineTo(o,114);x.lineTo(o+22,114);x.lineTo(o+62,64);x.lineTo(o+22,14);x.fill()}x.strokeStyle='#ddd';x.lineWidth=6;x.strokeRect(3,3,w-6,h-6)}),null,true);
 TX.banner=tex(cv(1024,128,(x,w,h)=>{x.fillStyle='#14161b';x.fillRect(0,0,w,h);for(let i=0;i<2;i++){const ox=i?w-140:0;for(let a=0;a<4;a++)for(let b=0;b<8;b++){x.fillStyle=(a+b)%2?'#f2f2f2':'#111';x.fillRect(ox+a*35,b*16,35,16)}}
  x.fillStyle='#f6f6f6';x.font='italic 800 84px "Saira Condensed",Impact,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('SWITCHBACK',w/2,h/2+4);x.fillStyle='#ffc21a';x.fillRect(150,h-12,w-300,6)}),null,true);
 TX.board=tex(cv(512,256,(x,w,h)=>{x.fillStyle='#f2f2f2';x.fillRect(0,0,w,h);x.fillStyle='#c5161d';x.fillRect(0,0,w,40);x.fillRect(0,h-40,w,40);x.fillStyle='#111';x.font='800 120px "Saira Condensed",Impact,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('SLOW',w/2,h/2+6)}),null,true);
}

// ================= TRACK: closed mountain circuit, terrain, roadside =================
// Samples every DS metres along the centre line. Forward F=(tx,tz); right R=(rx,rz)=(-tz,tx). Curvature > 0 turns right.
const TRK={def:null,N:0,L:0,DS:1,W:6,RAIL:3.3,ready:false,objs:[]};
const DS=1;
function wrapI(i){const N=TRK.N;i%=N;return i<0?i+N:i}
// ---------- centre line ----------
function crSpline(P,per){// closed centripetal Catmull-Rom, returns dense polyline
 const out=[],n=P.length;
 for(let i=0;i<n;i++){const p0=P[(i-1+n)%n],p1=P[i],p2=P[(i+1)%n],p3=P[(i+2)%n];
  const d=(a,b)=>Math.pow(Math.hypot(b[0]-a[0],b[1]-a[1]),.5)||1e-3,t0=0,t1=t0+d(p0,p1),t2=t1+d(p1,p2),t3=t2+d(p2,p3);
  for(let k=0;k<per;k++){const t=t1+(t2-t1)*k/per,A=(a,b,ta,tb)=>[a[0]*(tb-t)/(tb-ta)+b[0]*(t-ta)/(tb-ta),a[1]*(tb-t)/(tb-ta)+b[1]*(t-ta)/(tb-ta)];
   const A1=A(p0,p1,t0,t1),A2=A(p1,p2,t1,t2),A3=A(p2,p3,t2,t3),B1=A(A1,A2,t0,t2),B2=A(A2,A3,t1,t3);out.push(A(B1,B2,t1,t2))}}
 return out}
function resample(pts,ds){const n=pts.length,cum=[0];for(let i=1;i<=n;i++){const a=pts[i-1],b=pts[i%n];cum.push(cum[i-1]+Math.hypot(b[0]-a[0],b[1]-a[1]))}
 const L=cum[n],N=Math.round(L/ds),out=[];let j=0;for(let k=0;k<N;k++){const s=k*L/N;while(cum[j+1]<s)j++;const t=(s-cum[j])/(cum[j+1]-cum[j]||1),a=pts[j],b=pts[(j+1)%n];out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t])}return{pts:out,L}}
function curvOf(P){const n=P.length,k=new Float32Array(n);for(let i=0;i<n;i++){const a=P[(i-2+n)%n],b=P[i],c=P[(i+2)%n];const a1=Math.atan2(b[1]-a[1],b[0]-a[0]),a2=Math.atan2(c[1]-b[1],c[0]-b[0]);
 k[i]=wrapA(a2-a1)/(Math.hypot(b[0]-a[0],b[1]-a[1])*.5+Math.hypot(c[0]-b[0],c[1]-b[1])*.5)}return k}
function layout(def,seed){const r=mulberry(seed),n=def.pts,ctrl=[];const a0=r()*TAU,sx=1.15+r()*.3,sz=2.3-sx;
 for(let i=0;i<n;i++){const a=a0+i/n*TAU+(r()-.5)*TAU/n*.5;let rad=def.size*(.46+.54*r());if(r()<.22)rad*=.62;ctrl.push([Math.cos(a)*rad*sx,Math.sin(a)*rad*sz])}
 if(r()<.5)ctrl.reverse();
 let pts=resample(crSpline(ctrl,30),2).pts;
 // relax corners tighter than an 18 m radius
 for(let it=0;it<500;it++){const k=curvOf(pts);let bad=0;const nx=pts.map(p=>p.slice());for(let i=0;i<pts.length;i++)if(Math.abs(k[i])>1/18){bad++;const a=pts[(i-3+pts.length)%pts.length],b=pts[(i+3)%pts.length];nx[i][0]=lerp(pts[i][0],(a[0]+b[0])/2,.35);nx[i][1]=lerp(pts[i][1],(a[1]+b[1])/2,.35)}pts=nx;if(!bad)break}
 const rs=resample(pts,DS);if(rs.L<2100||rs.L>4300)return null;
 // the road must never come near another part of itself
 const P=rs.pts,N=P.length,cell=24,hsh=new Map();P.forEach((p,i)=>{const k=Math.floor(p[0]/cell)+','+Math.floor(p[1]/cell);if(!hsh.has(k))hsh.set(k,[]);hsh.get(k).push(i)});
 for(let i=0;i<N;i+=2){const p=P[i],cx=Math.floor(p[0]/cell),cz=Math.floor(p[1]/cell);for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){const L=hsh.get((cx+a)+','+(cz+b));if(!L)continue;
  for(const j of L){let d=Math.abs(i-j);d=Math.min(d,N-d);if(d<110)continue;if(Math.hypot(P[j][0]-p[0],P[j][1]-p[1])<46)return null}}}
 const k=curvOf(P);let mx=0;for(const v of k)mx=Math.max(mx,Math.abs(v));if(mx>1/15)return null;
 return rs}
// ---------- terrain height (before the road is cut in) ----------
const ridge=(x,z,s)=>{const n=1-Math.abs(vn2(x,z,s)*2-1);return n*n};
function H0(x,z){const d=TRK.def,s=TRK.seed,e=d.elev;
 let h=e*(fbm2(x/950+3.1,z/950-7.7,s,4)-.5)*2.2+e*.3*(ridge(x/360,z/360,s+5)-.3)+e*.08*(vn2(x/90,z/90,s+9)-.5);
 const q=Math.hypot((x-TRK.cx)/TRK.ex,(z-TRK.cz)/TRK.ez);
 // the circuit sits in a basin ringed by real mountains
 const rim=sstep(1.2,3.2,q);h+=rim*(120+e*.6)+sstep(3.2,9,q)*(fbm2(x/1600,z/1600,s+11,5)*1300+ridge(x/800,z/800,s+13)*700);
 if(d.biome==='lake')h-=95*(1-sstep(.15,.62,q))*sstep(-.2,.4,vn2(x/400,z/400,s+3)+.2);
 return h}
// ---------- build ----------
function genTrack(def){TRK.objs.forEach(o=>{scene.remove(o);o.traverse(m=>{if(m.geometry)m.geometry.dispose()})});TRK.objs=[];
 TRK.def=def;let seed=def.seed,rs=null;for(let k=0;k<400&&!rs;k++)rs=layout(def,seed+k*7919),seed+=0;
 if(!rs){for(let k=400;k<2000&&!rs;k++)rs=layout(def,def.seed+k*7919)}
 // start the lap on the straightest stretch, so the grid is not in a corner
 {const k0=curvOf(rs.pts),n0=k0.length;let best=1e9,bi=0;for(let i=0;i<n0;i+=5){let sum=0;for(let d=-260;d<=70;d+=5)sum+=Math.abs(k0[(i+d+n0)%n0]);if(sum<best){best=sum;bi=i}}rs.pts=rs.pts.slice(bi).concat(rs.pts.slice(0,bi))}
 const P=rs.pts,N=P.length;TRK.N=N;TRK.L=rs.L;TRK.DS=rs.L/N;TRK.seed=def.seed;TRK.W=def.biome==='winter'?5.6:6;
 let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;P.forEach(p=>{mnx=Math.min(mnx,p[0]);mxx=Math.max(mxx,p[0]);mnz=Math.min(mnz,p[1]);mxz=Math.max(mxz,p[1])});
 TRK.cx=(mnx+mxx)/2;TRK.cz=(mnz+mxz)/2;TRK.ex=(mxx-mnx)/2+60;TRK.ez=(mxz-mnz)/2+60;TRK.box=[mnx,mxx,mnz,mxz];
 const A=k=>new Float32Array(N);['px','py','pz','tx','tz','rx','rz','bank','curv','line','vt','wear'].forEach(k=>TRK[k]=A());
 for(let i=0;i<N;i++){TRK.px[i]=P[i][0];TRK.pz[i]=P[i][1]}
 for(let i=0;i<N;i++){const a=P[(i-1+N)%N],b=P[(i+1)%N],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;TRK.tx[i]=dx/l;TRK.tz[i]=dz/l;TRK.rx[i]=-dz/l;TRK.rz[i]=dx/l}
 const kc=curvOf(P);let ks=smoothC(kc,6,2);TRK.curv.set(ks);
 // elevation: follow the land, then smooth and cap the grade
 let y=new Float32Array(N);for(let i=0;i<N;i++)y[i]=H0(P[i][0],P[i][1]);
 y=smoothC(y,45,3);const gmax=def.biome==='winter'?.075:.09;
 // keep the shape of the land but squash it until no slope is steeper than gmax
 {const m=gmax*TRK.DS,d=new Float32Array(N);for(let i=0;i<N;i++)d[i]=y[(i+1)%N]-y[i];
  for(let it=0;it<80;it++){let sum=0;for(let i=0;i<N;i++){d[i]=clamp(d[i],-m,m);sum+=d[i]}if(Math.abs(sum)<1e-4)break;let room=0;for(let i=0;i<N;i++)room+=sum>0?d[i]+m:m-d[i];for(let i=0;i<N;i++)d[i]-=sum*(sum>0?d[i]+m:m-d[i])/room}
  const y0=y[0];y[0]=y0;for(let i=1;i<N;i++)y[i]=y[i-1]+d[i-1]}
 y=smoothC(y,6,2);if(def.biome==='lake'){TRK.water=Math.min(...y)-5.5}
 TRK.py.set(y);TRK.ypp=new Float32Array(N);for(let i=0;i<N;i++)TRK.ypp[i]=(y[(i+3)%N]-2*y[i]+y[(i-3+N)%N])/(9*TRK.DS*TRK.DS);TRK.ypp=smoothC(TRK.ypp,3,1);
 for(let i=0;i<N;i++)TRK.bank[i]=clamp(-TRK.curv[i]*2.2,-.07,.07);
 TRK.bank.set(smoothC(TRK.bank,20,2));
 racingLine();buildDistanceMap();buildTerrain();buildRoad();buildRails();buildGantry();buildSigns();scatterProps();
 if(def.biome==='lake')buildWater();if(def.biome==='winter')buildSnowBanks();
 if(farMts){scene.remove(farMts);farMts.children.forEach(c=>c.geometry.dispose())}buildFarMountains();
 TRK.ready=true}
function smoothC(a,w,passes){let x=Float32Array.from(a);const N=x.length;for(let p=0;p<passes;p++){const o=new Float32Array(N);let s=0;for(let k=-w;k<=w;k++)s+=x[(k+N)%N];for(let i=0;i<N;i++){o[i]=s/(2*w+1);s+=x[(i+w+1)%N]-x[(i-w+N)%N]}x=o}return x}
// ---------- racing line (minimum curvature by relaxation) and a target speed for every metre ----------
function racingLine(){const N=TRK.N,W=TRK.W-1.35,u=new Float32Array(N),k=10;
 for(let it=0;it<260;it++){for(let i=0;i<N;i++){const a=(i-k+N)%N,b=(i+k)%N;
  const mx=(TRK.px[a]+TRK.rx[a]*u[a]+TRK.px[b]+TRK.rx[b]*u[b])/2,mz=(TRK.pz[a]+TRK.rz[a]*u[a]+TRK.pz[b]+TRK.rz[b]*u[b])/2;
  const want=(mx-TRK.px[i])*TRK.rx[i]+(mz-TRK.pz[i])*TRK.rz[i];u[i]=clamp(lerp(u[i],want,.5),-W,W)}}
 TRK.line.set(smoothC(u,3,1));
 const LP=[];for(let i=0;i<N;i++)LP.push([TRK.px[i]+TRK.rx[i]*TRK.line[i],TRK.pz[i]+TRK.rz[i]*TRK.line[i]]);
 const kl=smoothC(curvOf(LP),5,2);TRK.lineK=kl;
 const g=9.81,mu=TRK.def.biome==='winter'?.82:.98,vmax=95;const v=new Float32Array(N);
 for(let i=0;i<N;i++)v[i]=Math.min(vmax,Math.sqrt(mu*g/Math.max(1e-4,Math.abs(kl[i]))));
 for(let p=0;p<3;p++){for(let i=N-1;i>=0;i--){const j=(i+1)%N;v[i]=Math.min(v[i],Math.sqrt(v[j]*v[j]+2*7.5*mu*TRK.DS))}}
 TRK.vt.set(v);for(let i=0;i<N;i++)TRK.wear[i]=clamp(Math.abs(kl[i])*40-.15,0,1);TRK.wear.set(smoothC(TRK.wear,25,2))}
// ---------- locating things on the road ----------
function trackLocate(x,z,hint,out){const N=TRK.N;let i;
 if(hint==null||hint<0){let best=1e18;i=0;for(let k=0;k<N;k+=4){const d=(x-TRK.px[k])**2+(z-TRK.pz[k])**2;if(d<best){best=d;i=k}}}else i=hint;
 for(let it=0;it<6;it++){const al=(x-TRK.px[i])*TRK.tx[i]+(z-TRK.pz[i])*TRK.tz[i];const st=Math.round(al/TRK.DS);if(!st)break;i=wrapI(i+clamp(st,-60,60))}
 let al=(x-TRK.px[i])*TRK.tx[i]+(z-TRK.pz[i])*TRK.tz[i];if(al<0){i=wrapI(i-1);al=(x-TRK.px[i])*TRK.tx[i]+(z-TRK.pz[i])*TRK.tz[i]}
 const j=wrapI(i+1),f=clamp(al/TRK.DS,0,1),rx=lerp(TRK.rx[i],TRK.rx[j],f),rz=lerp(TRK.rz[i],TRK.rz[j],f);
 const cx=lerp(TRK.px[i],TRK.px[j],f),cz=lerp(TRK.pz[i],TRK.pz[j],f),u=(x-cx)*rx+(z-cz)*rz;
 out=out||{};out.i=i;out.f=f;out.u=u;out.s=(i+f)*TRK.DS;out.y0=lerp(TRK.py[i],TRK.py[j],f);out.bank=lerp(TRK.bank[i],TRK.bank[j],f);out.tx=lerp(TRK.tx[i],TRK.tx[j],f);out.tz=lerp(TRK.tz[i],TRK.tz[j],f);return out}
// surface height across the road: banked asphalt, then a verge that falls away gently
function surfY(L,u){const W=TRK.W,b=Math.tan(L.bank);if(Math.abs(u)<=W)return L.y0+u*b;const e=L.y0+Math.sign(u)*W*b,a=Math.abs(u)-W;return e-Math.min(a,1.2)*.06-Math.max(0,a-1.2)*.065}
// ---------- distance map: nearest road sample for ground near the road ----------
function buildDistanceMap(){const C=4,R=80,[mnx,mxx,mnz,mxz]=TRK.box,ox=mnx-R-8,oz=mnz-R-8,nx=Math.ceil((mxx-mnx+2*R+16)/C),nz=Math.ceil((mxz-mnz+2*R+16)/C);
 const D=new Float32Array(nx*nz).fill(1e9),I=new Int32Array(nx*nz).fill(-1),rc=Math.ceil(R/C);
 for(let i=0;i<TRK.N;i+=2){const px=TRK.px[i],pz=TRK.pz[i],gi=Math.floor((px-ox)/C),gj=Math.floor((pz-oz)/C);
  for(let b=-rc;b<=rc;b++)for(let a=-rc;a<=rc;a++){const ci=gi+a,cj=gj+b;if(ci<0||cj<0||ci>=nx||cj>=nz)continue;const wx=ox+(ci+.5)*C,wz=oz+(cj+.5)*C,d=(wx-px)**2+(wz-pz)**2;const k=cj*nx+ci;if(d<D[k]){D[k]=d;I[k]=i}}}
 TRK.dm={C,ox,oz,nx,nz,I,R}}
const _L={},_L2={};
function nearRoad(x,z,out){const m=TRK.dm,ci=Math.floor((x-m.ox)/m.C),cj=Math.floor((z-m.oz)/m.C);if(ci<0||cj<0||ci>=m.nx||cj>=m.nz)return null;const i=m.I[cj*m.nx+ci];if(i<0)return null;return trackLocate(x,z,i,out)}
// ground height with the road cut in (cuttings and embankments)
function groundAt(x,z){const h=H0(x,z),L=nearRoad(x,z,_L);if(!L)return h;const W=TRK.W,a=Math.abs(L.u),e=W+4.6;
 const ey=surfY(L,Math.sign(L.u)*Math.min(a,e))-.3;if(a<=e)return ey;
 const dh=h-ey,bw=14+Math.abs(dh)*1.15;return lerp(ey,h,sstep(e,e+bw,a))}
// ---------- terrain mesh: fine near the circuit, coarser toward the mountains ----------
const MAT={};
function terrainMaterial(){const b=TRK.def.biome,m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.92,metalness:0,normalMap:b==='winter'?TX.snowN:TX.grassN,normalScale:new THREE.Vector2(.9,.9),envMapIntensity:.35});
 m.userData.u={baseY:{value:0}};m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,m.userData.u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vWN=normalize(mat3(modelMatrix)*objectNormal);')
  .replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_UV\nvUv=(modelMatrix*vec4(position,1.)).xz*.09;\n#endif');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;varying vec3 vWN;uniform float baseY;\nfloat th(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float tn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(th(i),th(i+vec2(1,0)),f.x),mix(th(i+vec2(0,1)),th(i+vec2(1,1)),f.x),f.y);}')
   .replace('#include <color_fragment>',`#include <color_fragment>
    {float n1=tn(vWP.xz*.035),n2=tn(vWP.xz*.21),n3=tn(vWP.xz*1.3);float m=.78+.3*n1+.14*n2+.1*n3;diffuseColor.rgb*=m;
     float steep=1.-normalize(vWN).y;float rk=smoothstep(.36,.55,steep+(n2-.5)*.18);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.2,.19,.18)*(.75+.5*n2)*(.8+.3*n3),rk*${b==='winter'?'.85':'1.'});
     float alt=vWP.y-baseY,hi=smoothstep(170.,420.,alt);
     if(hi>0.){float g1=tn(vWP.xz*.0045+vec2(vWP.y*.003,0.)),g2=tn(vWP.xz*.018+vec2(0.,vWP.y*.01)),g3=tn(vWP.xz*.07);
      float rockA=smoothstep(.42,.62,g1*.55+g2*.35+g3*.1+steep*.9-.1);vec3 rockC=vec3(.11,.105,.1)*(.7+.6*g2)*(.85+.3*g3);
      float snowA=clamp(smoothstep(.45,.6,(alt-450.)/500.+g1*.5+g2*.25-steep*.9)*(1.-rockA*.85),0.,1.);
      vec3 c=mix(diffuseColor.rgb,rockC,rockA*hi);c=mix(c,vec3(.82,.84,.88)*(.92+.1*g3),snowA*hi);diffuseColor.rgb=c;}}`)};
 m.customProgramCacheKey=()=>'terr'+b;return m}
function gridAxis(a0,a1,step,far,nOut){// inner range uniform, outer cells growing to 'far'
 const n=Math.ceil((a1-a0)/step),xs=[];for(let k=nOut;k>=1;k--){const t=k/nOut;xs.push(a0-(far)*t*t)}for(let i=0;i<=n;i++)xs.push(a0+(a1-a0)*i/n);for(let k=1;k<=nOut;k++){const t=k/nOut;xs.push(a1+far*t*t)}return xs}
function buildTerrain(){const [mnx,mxx,mnz,mxz]=TRK.box,q=save.set.q,st=q===0?7:q===1?5.5:4.5,M=330;
 const xs=gridAxis(mnx-M,mxx+M,st,6000,46),zs=gridAxis(mnz-M,mxz+M,st,6000,46),nx=xs.length,nz=zs.length;
 const P=new Float32Array(nx*nz*3),Cc=new Float32Array(nx*nz*3),Hh=new Float32Array(nx*nz),b=TRK.def.biome,s=TRK.seed;
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const x=xs[i],z=zs[j],k=j*nx+i;const h=groundAt(x,z);Hh[k]=h;P[k*3]=x;P[k*3+1]=h;P[k*3+2]=z}
 TRK.terr={xs,zs,nx,nz,H:Hh};
 const I=new Uint32Array((nx-1)*(nz-1)*6);let o=0;for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,c=a+nx;I[o++]=a;I[o++]=c;I[o++]=a+1;I[o++]=a+1;I[o++]=c;I[o++]=c+1}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setIndex(new THREE.BufferAttribute(I,1));g.computeVertexNormals();
 const N=g.attributes.normal.array,base=Math.min(...TRK.py);
 for(let k=0;k<nx*nz;k++){const x=P[k*3],z=P[k*3+2],h=Hh[k],ny=N[k*3+1],n1=vn2(x/140,z/140,s+21),n2=vn2(x/30,z/30,s+22),alt=h-base;
  const L=nearRoad(x,z,_L2),du=L?Math.abs(L.u)-TRK.W:999;let r,gg,bb;
  if(b==='winter'){const v=.82+.1*n1;r=v*.96;gg=v*.98;bb=v;const forest=sstep(.45,.7,n1)*sstep(.75,.9,ny)*(du>12?1:0);r=lerp(r,.55,forest*.3);gg=lerp(gg,.6,forest*.3);bb=lerp(bb,.66,forest*.3)}
  else{// meadow grass, darker forest floor, dry slopes, snow on the high peaks
   const dry=sstep(.45,.75,n1*.7+n2*.4),forest=sstep(.42,.62,fbm2(x/260,z/260,s+31,3))*(du>10?1:0);
   r=lerp(.085,.17,dry);gg=lerp(.16,.19,dry);bb=lerp(.04,.068,dry);r=lerp(r,.07,forest*.8);gg=lerp(gg,.1,forest*.8);bb=lerp(bb,.05,forest*.8);
   if(b==='lake'){r*=1.08;gg*=1.02}
   if(L&&du<9){const v=sstep(9,4.6,du);r=lerp(r,.34,v*.7);gg=lerp(gg,.31,v*.7);bb=lerp(bb,.26,v*.7)}
   if(TRK.water!=null){const sh=sstep(TRK.water+2.5,TRK.water-.5,h);r=lerp(r,.36,sh);gg=lerp(gg,.32,sh);bb=lerp(bb,.24,sh)}}
  Cc[k*3]=r;Cc[k*3+1]=gg;Cc[k*3+2]=bb}
 g.setAttribute('color',new THREE.BufferAttribute(Cc,3));
 const uv=new Float32Array(nx*nz*2);g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 MAT.terrain=MAT.terrain&&MAT.terrain.userData.b===b?MAT.terrain:terrainMaterial();MAT.terrain.userData.b=b;MAT.terrain.userData.u.baseY.value=base;
 const mesh=new THREE.Mesh(g,MAT.terrain);mesh.receiveShadow=true;mesh.frustumCulled=false;addObj(mesh)}
function terrainH(x,z){const t=TRK.terr;if(!t)return groundAt(x,z);// bilinear on the built grid, so props sit on what you see
 const bs=(a,v)=>{let lo=0,hi=a.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(a[m]<=v)lo=m;else hi=m}return lo};
 const i=bs(t.xs,x),j=bs(t.zs,z);if(i<0||j<0||i>=t.nx-1||j>=t.nz-1)return H0(x,z);const fx=(x-t.xs[i])/(t.xs[i+1]-t.xs[i]),fz=(z-t.zs[j])/(t.zs[j+1]-t.zs[j]);
 const h00=t.H[j*t.nx+i],h10=t.H[j*t.nx+i+1],h01=t.H[(j+1)*t.nx+i],h11=t.H[(j+1)*t.nx+i+1];
 return fx+fz<1?h00+(h10-h00)*fx+(h01-h00)*fz:h11+(h01-h11)*(1-fx)+(h10-h11)*(1-fz)}
function addObj(o){scene.add(o);TRK.objs.push(o);return o}
// ---------- road surface ----------
function roadMaterial(){const b=TRK.def.biome,m=new THREE.MeshStandardMaterial({color:0xffffff,map:TX.asphalt,normalMap:TX.asphaltN,normalScale:new THREE.Vector2(.55,.55),roughness:.82,metalness:0,envMapIntensity:.55});
 m.userData.u={W:{value:TRK.W},L:{value:TRK.L},snow:{value:b==='winter'?1:0},wet:{value:0}};
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,m.userData.u);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 rd;attribute vec2 wr;varying vec2 vRd;varying vec2 vWr;').replace('#include <uv_vertex>','#include <uv_vertex>\nvRd=rd;vWr=wr;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vRd;varying vec2 vWr;uniform float W;uniform float L;uniform float snow;uniform float wet;\nfloat rh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float rn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(rh(i),rh(i+vec2(1,0)),f.x),mix(rh(i+vec2(0,1)),rh(i+vec2(1,1)),f.x),f.y);}')
   .replace('#include <map_fragment>',`#include <map_fragment>
    float u=vRd.x,s=vRd.y,au=abs(u);float aa=fwidth(u)*.8+.002,as=fwidth(s)*.8+.002;
    float n1=rn(vec2(u*.6,s*.05)),n2=rn(vec2(u*3.,s*.4));
    // rubbered-in racing line and patchy repairs
    float wear=vWr.y*exp(-pow(u-vWr.x,2.)/2.4);diffuseColor.rgb*=1.-wear*.42;diffuseColor.rgb*=.92+.16*rn(vec2(u*.15,s*.012));
    float paint=0.;
    paint=max(paint,smoothstep(.08+aa,.08,abs(au-(W-.42)))*(.8+.2*n2));
    float dash=step(fract(s/12.),.38);paint=max(paint,smoothstep(.07+aa,.07,au)*dash*.85);
    float ss=mod(s,L);float chk=step(ss,1.3)+step(L-.2,ss);float cq=mod(floor(u/.65)+floor(ss/.65),2.);
    float grid=0.;for(int k=0;k<6;k++){float gs=L-10.-float(k)*8.;float gu=(mod(float(k),2.)<.5?-1.:1.)*2.6;float du=abs(u-gu),ds=ss-gs;
     grid=max(grid,smoothstep(.07+as,.07,abs(ds))*step(du,1.25));grid=max(grid,smoothstep(.06+aa,.06,abs(du-1.25))*step(-.0,ds)*step(ds,1.6));}
    paint=max(paint,grid*.9);
    paint*=.75+.25*n1;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.78,.78,.76),paint);
    if(chk>.5){diffuseColor.rgb=mix(vec3(.82),vec3(.03),cq);}
    float sn=snow*smoothstep(W-1.4,W+.2,au+ (n1-.5)*1.4+(n2-.5)*.5);sn=max(sn,snow*smoothstep(.62,.8,rn(vec2(u*.35,s*.03))*.7+n2*.35)*.85);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.88,.92),sn);
    float roadPaint=paint;`)
   .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.62,roadPaint);roughnessFactor=mix(roughnessFactor,.45,sn);roughnessFactor=mix(roughnessFactor,.12,wet*(1.-sn));')};
 m.customProgramCacheKey=()=>'road'+b;return m}
function vergeMaterial(){const b=TRK.def.biome,m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,normalMap:b==='winter'?TX.snowN:TX.rockN,normalScale:new THREE.Vector2(.8,.8),roughness:.95,envMapIntensity:.3});
 m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 rd;varying vec2 vRd;').replace('#include <uv_vertex>','#include <uv_vertex>\nvRd=rd;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vRd;\nfloat vh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float vnn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(vh(i),vh(i+vec2(1,0)),f.x),mix(vh(i+vec2(0,1)),vh(i+vec2(1,1)),f.x),f.y);}')
   .replace('#include <color_fragment>','#include <color_fragment>\n{float n=vnn(vRd*vec2(2.,.7)),g=vnn(vRd*9.);diffuseColor.rgb*=.75+.35*n+.2*g;}')};
 m.customProgramCacheKey=()=>'verge'+b;return m}
function buildRoad(){const N=TRK.N,W=TRK.W;const us=[-W,-W*.5,-W*.2,0,W*.2,W*.5,W],C=us.length;
 const P=new Float32Array(N*C*3),RD=new Float32Array(N*C*2),WR=new Float32Array(N*C*2),UV=new Float32Array(N*C*2),I=[];
 const L={};for(let i=0;i<N;i++){L.y0=TRK.py[i];L.bank=TRK.bank[i];for(let c=0;c<C;c++){const u=us[c],k=i*C+c;P[k*3]=TRK.px[i]+TRK.rx[i]*u;P[k*3+1]=surfY(L,u);P[k*3+2]=TRK.pz[i]+TRK.rz[i]*u;
  RD[k*2]=u;RD[k*2+1]=i*TRK.DS;WR[k*2]=TRK.line[i];WR[k*2+1]=TRK.wear[i];UV[k*2]=u/4;UV[k*2+1]=i*TRK.DS/4}}
 for(let i=0;i<N;i++){const j=(i+1)%N;for(let c=0;c<C-1;c++){const a=i*C+c,b=j*C+c;I.push(a,a+1,b,a+1,b+1,b)}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('rd',new THREE.BufferAttribute(RD,2));g.setAttribute('wr',new THREE.BufferAttribute(WR,2));g.setAttribute('uv',new THREE.BufferAttribute(UV,2));g.setIndex(I);g.computeVertexNormals();
 // the seam at the start line: carry s past L so stripes stay continuous
 MAT.road=roadMaterial();const road=new THREE.Mesh(g,MAT.road);road.receiveShadow=true;road.frustumCulled=false;addObj(road);
 // verges both sides
 const vs=[W,W+1.2,W+2.6,W+4.7],VC=vs.length,VP=new Float32Array(N*VC*2*3),VCo=new Float32Array(N*VC*2*3),VR=new Float32Array(N*VC*2*2),VI=[],b=TRK.def.biome;
 for(let side=0;side<2;side++){const sg=side?1:-1;for(let i=0;i<N;i++){L.y0=TRK.py[i];L.bank=TRK.bank[i];for(let c=0;c<VC;c++){const u=vs[c]*sg,k=(side*N+i)*VC+c;
  VP[k*3]=TRK.px[i]+TRK.rx[i]*u;VP[k*3+1]=surfY(L,u)+(c===0?-.012:c===VC-1?-.28:0);VP[k*3+2]=TRK.pz[i]+TRK.rz[i]*u;const n=vn2(i*.05,c+side*5,TRK.seed+71);
  const gr=c<=1?1:sstep(.5,.2,n);let col=b==='winter'?[.86,.88,.92]:[lerp(.17,.4,gr),lerp(.22,.37,gr),lerp(.08,.31,gr)];VCo.set(col,k*3);VR[k*2]=u;VR[k*2+1]=i*TRK.DS}}
  for(let i=0;i<N;i++){const j=(i+1)%N;for(let c=0;c<VC-1;c++){const a=(side*N+i)*VC+c,bq=(side*N+j)*VC+c;if(side)VI.push(a,a+1,bq,a+1,bq+1,bq);else VI.push(a,bq,a+1,a+1,bq,bq+1)}}}
 const vg=new THREE.BufferGeometry();vg.setAttribute('position',new THREE.BufferAttribute(VP,3));vg.setAttribute('color',new THREE.BufferAttribute(VCo,3));vg.setAttribute('rd',new THREE.BufferAttribute(VR,2));vg.setIndex(VI);vg.computeVertexNormals();
 MAT.verge=vergeMaterial();const verge=new THREE.Mesh(vg,MAT.verge);verge.receiveShadow=true;verge.frustumCulled=false;addObj(verge);
 buildCurbs()}
// red and white kerbs at the apex and exit of tighter corners
function buildCurbs(){const N=TRK.N,W=TRK.W,segs=[];let i0=-1;
 for(let i=0;i<=N;i++){const k=Math.abs(TRK.lineK[i%N]);if(k>1/95&&i<N){if(i0<0)i0=i}else if(i0>=0){if(i-i0>8)segs.push([i0,i-1]);i0=-1}}
 const P=[],Cc=[],I=[];let vi=0;const prof=[[-.3,0],[-.05,.045],[.35,.06],[.75,.035],[.95,-.02]];TRK.curbs=new Uint8Array(N);
 const strip=(a,b,side)=>{for(let ii=a;ii<=b;ii++){const i=wrapI(ii);TRK.curbs[i]|=side>0?1:2;const L={y0:TRK.py[i],bank:TRK.bank[i]};const red=Math.floor(ii*TRK.DS/1.5)%2;
  for(const [du,dy] of prof){const u=side*(W+du);P.push(TRK.px[i]+TRK.rx[i]*u,surfY(L,side*Math.min(W,W+du))+dy+.01,TRK.pz[i]+TRK.rz[i]*u);Cc.push(...(red?[.62,.04,.04]:[.85,.85,.83]))}}
  const n=b-a+1,C=prof.length;for(let r=0;r<n-1;r++)for(let c=0;c<C-1;c++){const p=vi+r*C+c,q=p+C;if(side>0)I.push(p,p+1,q,p+1,q+1,q);else I.push(p,q,p+1,p+1,q,q+1)}vi+=n*C};
 for(const [a,b] of segs){const mid=(a+b)>>1,sg=Math.sign(TRK.lineK[mid])||1,len=b-a;strip(a-6,b+6,sg);strip(mid+len*.25|0,b+30,-sg)}
 if(!P.length)return;const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));g.setIndex(I);g.computeVertexNormals();
 const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.6,envMapIntensity:.5,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));m.receiveShadow=true;m.castShadow=false;m.frustumCulled=false;addObj(m)}
// ---------- guardrails ----------
function buildRails(){const N=TRK.N,W=TRK.W,R=W+TRK.RAIL,step=2;
 const prof=[[0,.46],[.07,.52],[.03,.6],[.07,.68],[0,.76]];const P=[],I=[];let vi=0;
 for(let side=-1;side<=1;side+=2){const start=vi;for(let i=0;i<N;i+=step){const L={y0:TRK.py[i],bank:TRK.bank[i]};const u=side*R,y=surfY(L,u);
   for(const [d,h] of prof){const uu=side*(R+d);P.push(TRK.px[i]+TRK.rx[i]*uu,y+h,TRK.pz[i]+TRK.rz[i]*uu)}}
  const n=Math.floor((N-1)/step)+1,C=prof.length;for(let r=0;r<n;r++){const r2=(r+1)%n;for(let c=0;c<C-1;c++){const p=start+r*C+c,q=start+r2*C+c;if(side>0)I.push(p,q,p+1,p+1,q,q+1);else I.push(p,p+1,q,p+1,q+1,q)}}vi+=n*C}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();
 const steel=new THREE.MeshStandardMaterial({color:0xa9b1b8,metalness:.85,roughness:.36,envMapIntensity:1.1,side:THREE.DoubleSide});
 const rail=new THREE.Mesh(g,steel);rail.castShadow=true;rail.receiveShadow=true;rail.frustumCulled=false;addObj(rail);
 const post=new THREE.BoxGeometry(.1,.82,.16);post.translate(0,.41,0);const cnt=Math.ceil(N/4)*2,im=new THREE.InstancedMesh(post,new THREE.MeshStandardMaterial({color:0x8f979e,metalness:.7,roughness:.5}),cnt);
 const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();let k=0;
 for(let side=-1;side<=1;side+=2)for(let i=0;i<N;i+=4){const L={y0:TRK.py[i],bank:TRK.bank[i]},u=side*(R+.12);e.set(0,-Math.atan2(TRK.tz[i],TRK.tx[i]),0);q.setFromEuler(e);
  m4.compose(new THREE.Vector3(TRK.px[i]+TRK.rx[i]*u,surfY(L,side*R)-.05,TRK.pz[i]+TRK.rz[i]*u),q,new THREE.Vector3(1,1,1));im.setMatrixAt(k++,m4)}
 im.count=k;im.castShadow=true;im.receiveShadow=true;im.frustumCulled=false;addObj(im)}
// ---------- start gantry with countdown lights ----------
const GANTRY={lamps:[],mat:null};
function buildGantry(){const i=0,W=TRK.W,g=new THREE.Group(),ang=-Math.atan2(TRK.tz[i],TRK.tx[i]);g.position.set(TRK.px[i],TRK.py[i],TRK.pz[i]);g.rotation.y=ang;
 const metal=new THREE.MeshStandardMaterial({color:0x2b2f36,metalness:.6,roughness:.45}),span=W+2.4;
 for(const s of[-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(.5,7,.5),metal);p.position.set(0,3.5,s*span);p.castShadow=true;g.add(p)}
 const beam=new THREE.Mesh(new THREE.BoxGeometry(.9,1.25,span*2+.5),metal);beam.position.set(0,6.7,0);beam.castShadow=true;g.add(beam);
 const bm=new THREE.MeshStandardMaterial({map:TX.banner,roughness:.5,emissive:0xffffff,emissiveMap:TX.banner,emissiveIntensity:.15});
 for(const s of[-1,1]){const b=new THREE.Mesh(new THREE.PlaneGeometry(span*2-.6,1.1),bm);b.position.set(s*.46,6.7,0);b.rotation.y=s*PI/2;g.add(b)}
 GANTRY.lamps=[];for(let k=0;k<5;k++){const m=new THREE.MeshStandardMaterial({color:0x111111,emissive:0x000000,roughness:.3});const l=new THREE.Mesh(new THREE.SphereGeometry(.2,12,8),m);l.position.set(-.5,6.1,(k-2)*.6);g.add(l);GANTRY.lamps.push(m)}
 addObj(g)}
function gantryLights(n,green){GANTRY.lamps.forEach((m,k)=>{if(green){m.emissive.setRGB(.2,3,.4)}else if(k<n){m.emissive.setRGB(6,.15,.1)}else m.emissive.setRGB(0,0,0)})}
// ---------- signs: chevrons on the outside of tight corners, SLOW boards before hairpins ----------
function buildSigns(){const N=TRK.N,W=TRK.W,items=[],slow=[];
 for(let i=0;i<N;i+=14){const k=TRK.lineK[i];if(Math.abs(k)>1/70){const side=-Math.sign(k);items.push([i,side,k>0?1:-1])}}
 for(let i=0;i<N;i+=4){const k=Math.abs(TRK.lineK[i]);if(k>1/32){const j=wrapI(i-110);if(!slow.some(s=>Math.abs(s-j)<200&&Math.abs(s-j)<N-200))slow.push(j)}}
 const mat=new THREE.MeshStandardMaterial({map:TX.chevron,roughness:.5,side:THREE.DoubleSide,emissive:0xffffff,emissiveMap:TX.chevron,emissiveIntensity:T.head?.25:.04});
 const geo=new THREE.PlaneGeometry(1.2,.6);geo.translate(0,1.25,0);const im=new THREE.InstancedMesh(geo,mat,items.length+2);
 const pg=new THREE.CylinderGeometry(.04,.04,1,6);pg.translate(0,.5,0);const posts=new THREE.InstancedMesh(pg,new THREE.MeshStandardMaterial({color:0x6b7076,metalness:.6,roughness:.5}),items.length*2+slow.length*2+4);
 const sm=new THREE.MeshStandardMaterial({map:TX.board,roughness:.5,emissive:0xffffff,emissiveMap:TX.board,emissiveIntensity:T.head?.25:.04});const sg=new THREE.PlaneGeometry(1.6,.8);sg.translate(0,1.7,0);const slowIm=new THREE.InstancedMesh(sg,sm,slow.length+1);
 const m4=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();let k=0,pk=0;
 for(const [i,side,dir] of items){const u=side*(W+TRK.RAIL+.8),L={y0:TRK.py[i],bank:TRK.bank[i]},y=surfY(L,side*(W+TRK.RAIL))-.1,a=Math.atan2(TRK.tz[i],TRK.tx[i]);
  e.set(0,-a+PI/2,0);q.setFromEuler(e);m4.compose(new THREE.Vector3(TRK.px[i]+TRK.rx[i]*u,y,TRK.pz[i]+TRK.rz[i]*u),q,new THREE.Vector3(dir,1,1));im.setMatrixAt(k++,m4);
  e.set(0,0,0);q.setFromEuler(e);m4.compose(new THREE.Vector3(TRK.px[i]+TRK.rx[i]*u,y,TRK.pz[i]+TRK.rz[i]*u),q,new THREE.Vector3(1,1.25,1));posts.setMatrixAt(pk++,m4)}
 let sk=0;for(const i of slow){const side=-Math.sign(TRK.lineK[wrapI(i+110)])||1,u=-side*(W+TRK.RAIL+.9),L={y0:TRK.py[i],bank:TRK.bank[i]},y=surfY(L,-side*(W+TRK.RAIL))-.1,a=Math.atan2(TRK.tz[i],TRK.tx[i]);
  e.set(0,-a+PI/2,0);q.setFromEuler(e);m4.compose(new THREE.Vector3(TRK.px[i]+TRK.rx[i]*u,y,TRK.pz[i]+TRK.rz[i]*u),q,new THREE.Vector3(1,1,1));slowIm.setMatrixAt(sk++,m4);
  for(const o of[-.6,.6]){e.set(0,0,0);q.setFromEuler(e);m4.compose(new THREE.Vector3(TRK.px[i]+TRK.rx[i]*u+TRK.tx[i]*o,y,TRK.pz[i]+TRK.rz[i]*u+TRK.tz[i]*o),q,new THREE.Vector3(1,1.4,1));posts.setMatrixAt(pk++,m4)}}
 im.count=k;slowIm.count=sk;posts.count=pk;[im,slowIm,posts].forEach(x=>{x.castShadow=true;x.frustumCulled=false;addObj(x)})}
// ---------- trees and rocks ----------
function branchAtlas(snowy){const W=1024,H=512;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');const r=mulberry(4242);
 const greens=snowy?['#14301f','#1a3a25','#21452c','#2a5233','#183424','#0f2618']:['#173a20','#1f4526','#28522c','#315f31','#1b3d22','#122c18'];
 for(let tile=0;tile<4;tile++){const ox=(tile%2)*512,oy=(tile>>1)*256,sn=snowy?[.75,.45,.9,.25][tile]:0;x.save();x.translate(ox,oy);x.beginPath();x.rect(0,0,512,256);x.clip();
  const droop=r()*30+10,stem=t=>[8+t*490,128+Math.sin(t*1.4)*droop*t-10*t];
  const twigs=[];for(let t=0;t<1;t+=.045+r()*.02){const [sx,sy]=stem(t);for(const sd of[-1,1]){const len=(1-t*.75)*(70+r()*40),a=sd*(.55+r()*.45)+(r()-.5)*.2;twigs.push([sx,sy,a,len,t])}}
  const needles=(x0,y0,ang,len,dens)=>{const n=Math.floor(len*dens);for(let i=0;i<n;i++){const t=i/n,px=x0+Math.cos(ang)*len*t,py=y0+Math.sin(ang)*len*t;for(const sd of[-1,1]){const na=ang+sd*(.9+r()*.5),nl=7+r()*7*(1-t*.5);x.strokeStyle=greens[(r()*greens.length)|0];x.globalAlpha=.85+r()*.15;x.lineWidth=1.3+r()*1.2;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(na)*nl,py+Math.sin(na)*nl);x.stroke()}}};
  x.lineCap='round';for(const [sx,sy,a,len] of twigs){x.strokeStyle='#3b2d22';x.lineWidth=2;x.globalAlpha=1;x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+Math.cos(a)*len,sy+Math.sin(a)*len);x.stroke()}
  x.strokeStyle='#4a3627';x.lineWidth=5;x.beginPath();for(let t=0;t<=1;t+=.05){const [px,py]=stem(t);t?x.lineTo(px,py):x.moveTo(px,py)}x.stroke();
  for(const [sx,sy,a,len] of twigs)needles(sx,sy,a,len,1.3);for(let t=0;t<1;t+=.01){const [px,py]=stem(t);needles(px,py,-1.2,10,1.2)}
  x.globalAlpha=1;for(let i=0;i<260*sn;i++){const tw=twigs[(r()*twigs.length)|0],t=r(),px=tw[0]+Math.cos(tw[2])*tw[3]*t,py=tw[1]+Math.sin(tw[2])*tw[3]*t-4,rad=(5+r()*11)*(1-tw[4]*.5);
   const g=x.createRadialGradient(px,py-rad*.3,rad*.1,px,py,rad);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.7,'rgba(226,236,248,.95)');g.addColorStop(1,'rgba(200,215,235,0)');x.fillStyle=g;x.beginPath();x.ellipse(px,py,rad*1.3,rad*.75,tw[2]*.3,0,TAU);x.fill()}
  x.restore()}
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t}
function cardTreeGeo(variant,larch){const P=[],N=[],UV=[],Cc=[],I=[],r=mulberry(variant*977+13);let vi=0;const H=larch?13:11;
 const tiles=[[0,.5],[.5,.5],[0,0],[.5,0]],tl=variant===1?[1,3]:[0,2];
 const quad=(p0,p1,p2,p3,tile,s0,s1,c)=>{const [u0,v0]=tiles[tile];const pts=[p0,p1,p2,p3],uvs=[[u0,v0],[u0+.5,v0],[u0+.5,v0+.5],[u0,v0+.5]],sh=[s0,s1,s1,s0];
  for(let i=0;i<4;i++){const p=pts[i];P.push(p[0],p[1],p[2]);let nx=p[0]-c[0],ny=(p[1]-c[1])*.5+1.3,nz=p[2]-c[2];const l=Math.hypot(nx,ny,nz)||1;N.push(nx/l,ny/l,nz/l);UV.push(uvs[i][0],uvs[i][1]);const t=larch?[1.25,1.05,.55]:[1,1,1];Cc.push(sh[i]*t[0],sh[i]*t[1],sh[i]*t[2])}
  I.push(vi,vi+1,vi+2,vi,vi+2,vi+3);vi+=4};
 const ts=8;for(let i=0;i<ts;i++){const a=i/ts*TAU,b=(i+1)/ts*TAU,r0=.26,r1=.05,c0=[.23,.17,.12];
  const q=[[Math.cos(a)*r0,0,Math.sin(a)*r0],[Math.cos(b)*r0,0,Math.sin(b)*r0],[Math.cos(b)*r1,H*.95,Math.sin(b)*r1],[Math.cos(a)*r1,H*.95,Math.sin(a)*r1]];
  for(let k=0;k<4;k++){P.push(...q[k]);const ang=k===1||k===2?b:a;N.push(Math.cos(ang),0,Math.sin(ang));UV.push(.99,.99);Cc.push(c0[0]*1.6,c0[1]*1.6,c0[2]*1.6)}I.push(vi,vi+2,vi+1,vi,vi+3,vi+2);vi+=4}
 const tiers=variant===1?12:15,per=variant===1?5:6;let rot=r()*TAU;
 for(let k=0;k<tiers;k++){const f=k/(tiers-1),y=H*(.12+.86*f),L=(variant===1?H*.25:H*.29)*Math.pow(1-f,variant===1?.9:1.05)+.5,droop=L*(.32-f*.15),w=L*.42;rot+=2.39996;const yc=y-L*.3;
  for(let b=0;b<per;b++){const a=rot+b/per*TAU+(r()-.5)*.4,ca=Math.cos(a),sa=Math.sin(a),px=-sa,pz=ca;const tile=tl[(r()*2)|0];const base=[ca*.1,y,sa*.1],tip=[ca*L,y-droop,sa*L],s0=.42+.25*f,s1=.85+.15*f;
   for(const tilt of[.42,-.25]){const ux=px*w*.5,uy=tilt*w,uz=pz*w*.5;quad([base[0]-ux,base[1]-uy*.3,base[2]-uz],[tip[0]-ux,tip[1]-uy,tip[2]-uz],[tip[0]+ux,tip[1]+uy,tip[2]+uz],[base[0]+ux,base[1]+uy*.3,base[2]+uz],tile,s0,s1,[0,yc,0])}}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));g.setIndex(I);g.computeBoundingSphere();return g}
function treeMats(atlas){const m=new THREE.MeshStandardMaterial({map:atlas,alphaTest:.45,side:THREE.DoubleSide,vertexColors:true,roughness:.92,metalness:0,envMapIntensity:.4});
 m.userData.u={time:{value:0}};m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,m.userData.u);sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=1.+.007/gl_FragCoord.w;\n#include <alphatest_fragment>');sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float time;').replace('#include <begin_vertex>',`#include <begin_vertex>
   #ifdef USE_INSTANCING
   vec3 ip=vec3(instanceMatrix[3][0],0.,instanceMatrix[3][2]);float sw=sin(time*1.1+ip.x*.13+ip.z*.11)*.0016*transformed.y*transformed.y;transformed.x+=sw;transformed.z+=sw*.6;
   #endif`)};m.customProgramCacheKey=()=>'treecard';
 const d=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:atlas,alphaTest:.45,side:THREE.DoubleSide});return{m,d}}
function bakeImpostor(geo,mat){const W=256,Hh=512,rt=new THREE.WebGLRenderTarget(W,Hh,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true});
 const sc=new THREE.Scene();sc.add(new THREE.Mesh(geo,mat));sc.add(new THREE.HemisphereLight(0xe8f0ff,0xa0aabb,1.6));const dl=new THREE.DirectionalLight(0xffffff,1.9);dl.position.set(3,8,6);sc.add(dl);
 const oc=new THREE.OrthographicCamera(-3.8,3.8,12.6,-.6,.1,50);oc.position.set(0,6,20);oc.lookAt(0,6,0);
 const prevT=ren.getRenderTarget(),pc=new THREE.Color();ren.getClearColor(pc);const pa=ren.getClearAlpha();ren.setClearColor(0x2d4433,0);ren.setRenderTarget(rt);ren.clear();ren.render(sc,oc);ren.setRenderTarget(prevT);ren.setClearColor(pc,pa);return rt.texture}
function impostorMat(t){const m=new THREE.MeshStandardMaterial({map:t,alphaTest:.3,roughness:.95,metalness:0,envMapIntensity:.3,side:THREE.DoubleSide});
 m.onBeforeCompile=sh=>{sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=1.+.0045/gl_FragCoord.w;\n#include <alphatest_fragment>');sh.vertexShader=sh.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
   #ifdef USE_INSTANCING
   vec3 ipn=vec3(instanceMatrix[3][0],0.,instanceMatrix[3][2]);vec3 tcn=cameraPosition-ipn;float angn=atan(tcn.x,tcn.z);float cn=cos(angn),snn=sin(angn);objectNormal=vec3(objectNormal.x*cn+objectNormal.z*snn,objectNormal.y,-objectNormal.x*snn+objectNormal.z*cn);
   #endif`).replace('#include <begin_vertex>',`#include <begin_vertex>
   #ifdef USE_INSTANCING
   transformed=vec3(transformed.x*cn+transformed.z*snn,transformed.y,-transformed.x*snn+transformed.z*cn);
   #endif`)};m.customProgramCacheKey=()=>'impostor';return m}
function rockGeo(seed){const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position,r=mulberry(seed);const o=[r()*9,r()*9,r()*9];
 for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=.75+.45*fbm2(x*1.3+o[0],z*1.3+y*.7+o[1],seed,3)+.12*vn2(x*5+o[2],y*5+z*3,seed+3);p.setXYZ(i,x*n*1.2,Math.max(y*n*.75,-.3),z*n)}g.computeVertexNormals();return g}
const PROPS={trees:[],types:{},lod:{x:1e9,z:1e9}};
function scatterProps(){const b=TRK.def.biome,snowy=b==='winter',larch=b==='lake';
 if(!PROPS.built||PROPS.snowy!==snowy||PROPS.larch!==larch){for(const k in PROPS.types){scene.remove(PROPS.types[k].im)}PROPS.types={};
  const atlas=branchAtlas(snowy),TM=treeMats(atlas),gA=cardTreeGeo(0,larch),gB=cardTreeGeo(1,larch),ig=new THREE.PlaneGeometry(7.6,13.2);ig.translate(0,6,0);const nn=ig.attributes.normal;for(let i=0;i<nn.count;i++)nn.setXYZ(i,0,.45,.89);
  const add=(n,geo,mat,max,sh,dm)=>{const im=new THREE.InstancedMesh(geo,mat,max);im.count=0;im.castShadow=sh;im.receiveShadow=true;im.frustumCulled=false;if(dm)im.customDepthMaterial=dm;scene.add(im);PROPS.types[n]={im,max}};
  add('A',gA,TM.m,1400,true,TM.d);add('B',gB,TM.m,1000,true,TM.d);add('fA',ig,impostorMat(bakeImpostor(gA,TM.m)),14000,false);add('fB',ig,impostorMat(bakeImpostor(gB,TM.m)),9000,false);
  const rm=new THREE.MeshStandardMaterial({color:snowy?0x8a8d92:0x6d6a66,roughness:.88,normalMap:TX.rockN,normalScale:new THREE.Vector2(.8,.8),envMapIntensity:.4});
  for(let i=0;i<3;i++)add('r'+i,rockGeo(11+i*7),rm,700,true);MAT.treeCard=TM.m;PROPS.built=true;PROPS.snowy=snowy;PROPS.larch=larch}
 const s=TRK.seed,r=mulberry(s*3+1),[mnx,mxx,mnz,mxz]=TRK.box,M=520,C=8.5,trees=[],rocks=[];
 for(let x=mnx-M;x<mxx+M;x+=C)for(let z=mnz-M;z<mxz+M;z+=C){const px=x+r()*C,pz=z+r()*C;const L=nearRoad(px,pz,_L);const du=L?Math.abs(L.u)-TRK.W:999;if(du<TRK.RAIL+5.5)continue;
  const dens=sstep(.38,.6,fbm2(px/260,pz/260,s+31,3))+(du<40?.12:0),h=terrainH(px,pz);if(TRK.water!=null&&h<TRK.water+1.5)continue;
  const sl=Math.abs(terrainH(px+2,pz)-terrainH(px-2,pz))+Math.abs(terrainH(px,pz+2)-terrainH(px,pz-2));if(sl>3.6){if(r()<.05)rocks.push([px,h,pz,r()]);continue}
  if(h-Math.min(...[TRK.py[0]])>620&&!snowy)continue;
  if(r()<dens*.85)trees.push([px,h-.15,pz,.75+r()*.6,r()*TAU,r()<.62?0:1]);else if(r()<.012)rocks.push([px,h,pz,r()])}
 for(let i=0;i<TRK.N;i+=9){if(r()<.35){const side=r()<.5?-1:1,u=side*(TRK.W+TRK.RAIL+2+r()*6),x=TRK.px[i]+TRK.rx[i]*u,z=TRK.pz[i]+TRK.rz[i]*u;rocks.push([x,terrainH(x,z),z,r()*.6])}}
 PROPS.trees=trees;PROPS.rocks=rocks;PROPS.lod.x=1e9;placeRocks()}
const _m4=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_v=new THREE.Vector3(),_sv=new THREE.Vector3();
function placeRocks(){const c=[0,0,0];for(const [x,y,z,rnd] of PROPS.rocks){const t=PROPS.types['r'+((rnd*3)|0)];if(!t||c[(rnd*3)|0]>=t.max)continue;const sc=.6+rnd*rnd*3.2;
 _e.set(rnd*2,rnd*40,rnd*3);_q.setFromEuler(_e);_m4.compose(_v.set(x,y-sc*.25,z),_q,_sv.set(sc*1.3,sc,sc*1.1));t.im.setMatrixAt(c[(rnd*3)|0]++,_m4)}
 for(let i=0;i<3;i++){const t=PROPS.types['r'+i];t.im.count=c[i];t.im.instanceMatrix.needsUpdate=true}}
function treeLOD(cx,cz,force){const P=PROPS;if(!force&&(cx-P.lod.x)**2+(cz-P.lod.z)**2<26*26)return;P.lod.x=cx;P.lod.z=cz;const q=save.set.q,Rn=q===0?60:q===1?85:115,Rf=q===0?900:1500;
 const n={A:0,B:0,fA:0,fB:0},T=P.types;for(const [x,y,z,sc,rot,v] of P.trees){const d2=(x-cx)**2+(z-cz)**2;if(d2>Rf*Rf)continue;const near=d2<Rn*Rn,key=(near?'':'f')+(v?'B':'A'),t=T[key];if(n[key]>=t.max)continue;
  _e.set(0,near?rot:0,0);_q.setFromEuler(_e);_m4.compose(_v.set(x,y,z),_q,_sv.set(sc,sc,sc));t.im.setMatrixAt(n[key]++,_m4)}
 for(const k in n){T[k].im.count=n[k];T[k].im.instanceMatrix.needsUpdate=true}}
// ---------- lake and snow banks ----------
function buildWater(){const g=new THREE.CircleGeometry(4200,96);g.rotateX(-PI/2);const m=new THREE.MeshStandardMaterial({color:0x0b2a33,roughness:.05,metalness:.0,envMapIntensity:1.6,normalMap:TX.grassN,normalScale:new THREE.Vector2(.15,.15),transparent:false});
 m.userData.u={time:{value:0}};m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,m.userData.u);sh.fragmentShader=sh.fragmentShader.replace('#include <alphatest_fragment>','diffuseColor.a*=1.+.007/gl_FragCoord.w;\n#include <alphatest_fragment>');sh.vertexShader=sh.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_UV\nvUv=(modelMatrix*vec4(position,1.)).xz*.02;\n#endif');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform float time;').replace('#include <normal_fragment_maps>',`
   vec3 mapN=texture2D(normalMap,vUv+vec2(time*.004,time*.003)).xyz*2.-1.;vec3 mapN2=texture2D(normalMap,vUv*2.7-vec2(time*.006,-time*.002)).xyz*2.-1.;mapN=normalize(vec3((mapN.xy+mapN2.xy)*normalScale,1.));
   normal=normalize(vec3(mapN.x,mapN.z,-mapN.y)*0.+normal+vec3(mapN.x,0.,mapN.y));`)};
 MAT.water=m;const w=new THREE.Mesh(g,m);w.position.set(TRK.cx,TRK.water,TRK.cz);w.receiveShadow=true;addObj(w)}
function buildSnowBanks(){const N=TRK.N,W=TRK.W,P=[],I=[];let vi=0;const prof=[[2.6,-.05],[3.0,.35],[3.15,.55],[3.25,.25]];
 for(let side=-1;side<=1;side+=2){const st=vi;for(let i=0;i<N;i+=2){const L={y0:TRK.py[i],bank:TRK.bank[i]},n=vn2(i*.03,side*7,TRK.seed+3);for(const [d,h] of prof){const u=side*(W+d);P.push(TRK.px[i]+TRK.rx[i]*u,surfY(L,u)+h*(.6+n*.8),TRK.pz[i]+TRK.rz[i]*u)}}
  const n=Math.floor((N-1)/2)+1,C=prof.length;for(let r=0;r<n;r++){const r2=(r+1)%n;for(let c=0;c<C-1;c++){const p=st+r*C+c,q=st+r2*C+c;if(side>0)I.push(p,q,p+1,p+1,q,q+1);else I.push(p,p+1,q,p+1,q+1,q)}}vi+=n*C}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();
 const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:0xeef2f8,roughness:.6,normalMap:TX.snowN,envMapIntensity:.35}));m.receiveShadow=true;m.castShadow=true;m.frustumCulled=false;addObj(m)}
// ---------- distant range, drawn behind everything ----------
let farMts=null;
function farRange(sd){const NA=900,NR=70,R0=6800,R1=20000,K=1,EY=0,P=new Float32Array((NA+1)*NR*3),H=new Float32Array((NA+1)*NR),Cc=new Float32Array((NA+1)*NR*3),I=[];
 const seed=TRK.seed+sd,base=TRK.def.biome==='winter'?.5:1;
 const rmf=(x,z)=>{let sum=0,amp=1,f=1,w=1,nm=0;for(let o=0;o<6;o++){let n=1-Math.abs(vn2(x*f+o*7.3,z*f-o*3.1,seed+o*17)*2-1);n*=n;n*=w;w=clamp(n*1.7,0,1);sum+=n*amp;nm+=amp;amp*=.52;f*=2.03}return sum/nm};
 for(let i=0;i<=NA;i++){const a=i/NA*TAU,ca=Math.cos(a),sa=Math.sin(a);for(let k=0;k<NR;k++){const t=k/(NR-1),r=R0*Math.pow(R1/R0,t),x=ca*r,z=sa*r,id=i*NR+k;
  const wx=x+(vn2(x/2400,z/2400,seed+5)-.5)*1100,wz=z+(vn2(x/2400,z/2400,seed+6)-.5)*1100,m=rmf(wx/3000,wz/3000),big=vn2(x/8000,z/8000,seed+3);
  const h=-300+sstep(0,.2,t)*(350+Math.pow(m,1.3)*2300*(.5+.7*big));H[id]=h;P[id*3]=x*K;P[id*3+1]=h*K;P[id*3+2]=z*K}}
 for(let i=0;i<NA;i++)for(let k=0;k<NR-1;k++){const a=i*NR+k,b=(i+1)*NR+k;I.push(a,b,a+1,b,b+1,a+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();
 for(let id=0;id<H.length;id++){Cc[id*3]=0;Cc[id*3+1]=vn2(P[id*3]/K/170,P[id*3+2]/K/170,seed+21);Cc[id*3+2]=0}g.setAttribute('color',new THREE.BufferAttribute(Cc,3));
 const sky=new THREE.Color(T.sky).multiplyScalar(T.hemiI),gnd=new THREE.Color(T.gnd).multiplyScalar(T.hemiI),hz=new THREE.Color(T.fog).lerp(new THREE.Color(T.hor),.55);
 const m=new THREE.ShaderMaterial({uniforms:{sunDir:skyU.sunDir,sunCol:skyU.sunCol,sunI:{value:T.sunI},skyC:{value:sky},gndC:{value:gnd},hzC:{value:hz},fd:{value:T.fogD},inv:{value:1/K},snowB:{value:base}},vertexColors:true,fog:false,depthWrite:false,
  vertexShader:'varying vec3 vC;varying vec3 vN;varying vec3 vP;void main(){vC=color;vN=normal;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 sunDir;uniform vec3 sunCol;uniform float sunI;uniform vec3 skyC;uniform vec3 gndC;uniform vec3 hzC;uniform float fd;uniform float inv;uniform float snowB;varying vec3 vC;varying vec3 vN;varying vec3 vP;'+
  'float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}'+
  'float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.07+vec2(3.1,1.7);a*=.5;}return s;}'+
  'void main(){vec3 n=normalize(vN);vec3 w=vP*inv;float l=max(dot(n,sunDir),0.);float nn=fb(w.xz/300.),n2=fb(w.xz/55.+w.y/90.),st=vn(vec2(w.y/16.,w.x/800.+w.z/800.));'+
  'float sl=n.y+(nn-.5)*.42+(n2-.5)*.22+smoothstep(300.,1800.,w.y)*.1+(snowB-1.)*.2;float snow=smoothstep(.6,.66,sl);vec3 rock=vec3(1.07,1.02,.96)*(.07+.06*n2+.05*st);'+
  'float forest=(1.-smoothstep(-100.,250.,w.y+(nn-.5)*200.))*smoothstep(.5,.75,n.y);vec3 alb=mix(rock,vec3(.05,.075,.055),forest*(1.-snow));alb=mix(alb,vec3(.84,.86,.9)*(.95+.08*nn),snow);'+
  'vec3 amb=mix(gndC,skyC,n.y*.5+.5)*.8;vec3 c=alb*(sunCol*sunI*l+amb);float d=length(vP);vec3 v=vP/d;float f=(1.-exp(-pow(d*fd,1.25)))*mix(1.,.6,smoothstep(0.,1400.,w.y));float sv=max(dot(v,sunDir),0.);vec3 hz=hzC*(1.+.9*pow(sv,6.))+sunCol*.15*pow(sv,24.);'+
  'c=mix(c,hz,clamp(f,0.,1.));c=mix(c,hzC,smoothstep(-100.,-400.,w.y));gl_FragColor=linearToOutputTexel(vec4(c,1.));}'});
 const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=-9;return mesh}
function buildFarMountains(){farMts=new THREE.Group();farMts.add(farRange(31));scene.add(farMts)}

// ================= CARS: lofted bodies with real wheel arches, detailed wheels, lights =================
// Car space: +X forward, +Y up, +Z right. p runs 0 at the nose to 1 at the tail. Heights in metres above the road.
function profile(pts,p){// smooth curve through [p,v] pairs
 if(p<=pts[0][0])return pts[0][1];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];if(p<=b[0]){const t=(p-a[0])/(b[0]-a[0]),s=t*t*(3-2*t);return a[1]+(b[1]-a[1])*s}}return pts[pts.length-1][1]}
// Hand-drawn lines for each car. sill: underside; belt: shoulder line; top: centre-line height over hood, roof and deck; hw: half width as a share of W/2.
// cab: windshield base, windshield top, roof end, rear-glass base. gw: glass half-width at its sill and at the roof, as a share of the body half-width.
// win: side-glass span, pil: extra window pillars, doors: door seams, hl: headlight ellipse [p, a, radius p, radius a].
const BODY={
 gt:{L:4.55,W:1.95,fa:.175,ra:.775,tireR:.345,tw:.255,
  sill:[[0,.33],[.02,.25],[.06,.19],[.12,.165],[.88,.175],[.95,.22],[1,.34]],
  belt:[[0,.56],[.02,.64],[.06,.72],[.175,.835],[.38,.86],[.6,.885],[.775,.925],[.92,.93],[.985,.9],[1,.82]],
  top:[[0,.56],[.02,.645],[.06,.725],[.175,.835],[.36,.925],[.385,.935],[.545,1.235],[.6,1.26],[.65,1.245],[.7,1.17],[.87,.96],[.95,.95],[.99,.935],[1,.86]],
  hw:[[0,.72],[.02,.84],[.06,.91],[.175,.975],[.3,.955],[.45,.95],[.6,.965],[.775,1],[.9,.975],[.97,.92],[1,.84]],
  cab:[.385,.545,.65,.87],gw:[.9,.64],win:[.47,.715],pil:[],doors:[.4,.645],hl:[.035,.51,.028,.06],sideDark:0,rocker:0},
 rally:{L:4.05,W:1.86,fa:.16,ra:.8,tireR:.33,tw:.245,
  sill:[[0,.38],[.02,.3],[.06,.24],[.12,.21],[.9,.22],[.96,.27],[1,.37]],
  belt:[[0,.66],[.03,.74],[.08,.8],[.16,.85],[.35,.92],[.6,.96],[.8,.99],[.95,1],[1,.97]],
  top:[[0,.66],[.02,.76],[.07,.82],[.16,.88],[.3,.955],[.33,.965],[.52,1.37],[.58,1.41],[.82,1.39],[.86,1.33],[.955,1.06],[.99,1.03],[1,.97]],
  hw:[[0,.78],[.02,.88],[.06,.94],[.16,1],[.27,.95],[.5,.945],[.8,1],[.92,.985],[1,.93]],
  cab:[.33,.52,.82,.955],gw:[.88,.72],win:[.42,.785],pil:[.6],doors:[.345,.6],hl:[.032,.5,.03,.075],sideDark:0,rocker:1},
 muscle:{L:4.85,W:1.98,fa:.17,ra:.76,tireR:.35,tw:.275,
  sill:[[0,.4],[.02,.3],[.06,.22],[.12,.19],[.9,.2],[.96,.25],[1,.36]],
  belt:[[0,.72],[.02,.79],[.06,.83],[.17,.86],[.4,.9],[.7,.92],[.9,.94],[.99,.94],[1,.88]],
  top:[[0,.74],[.02,.83],[.06,.88],[.17,.93],[.35,.99],[.43,1.01],[.56,1.29],[.6,1.33],[.7,1.315],[.76,1.18],[.87,1.035],[.95,1.045],[.985,1.07],[.995,1.04],[1,.95]],
  hw:[[0,.86],[.015,.93],[.05,.96],[.17,.985],[.35,.97],[.6,.97],[.76,1],[.92,.99],[.98,.97],[1,.93]],
  cab:[.43,.56,.7,.87],gw:[.88,.66],win:[.5,.735],pil:[],doors:[.445,.66],hl:null,bulge:[[.06,0],[.12,.045],[.36,.05],[.42,0]],sideDark:0,rocker:0},
 apex:{L:4.6,W:2.04,fa:.18,ra:.77,tireR:.35,tw:.285,
  sill:[[0,.23],[.02,.16],[.06,.12],[.9,.13],[.96,.2],[1,.34]],
  belt:[[0,.42],[.03,.54],[.1,.7],[.18,.84],[.3,.77],[.4,.76],[.6,.84],[.77,.93],[.9,.94],[.99,.91],[1,.85]],
  top:[[0,.44],[.03,.5],[.1,.6],[.18,.665],[.3,.74],[.34,.76],[.5,1.1],[.55,1.14],[.62,1.125],[.66,1.07],[.8,.955],[.93,.935],[.99,.915],[1,.86]],
  hw:[[0,.7],[.02,.84],[.08,.93],[.18,1],[.3,.93],[.45,.88],[.6,.92],[.77,1],[.9,.98],[.98,.93],[1,.88]],
  cab:[.34,.5,.62,.8],gw:[.78,.56],win:[.43,.62],pil:[],doors:[.355,.56],hl:[.05,.6,.036,.05],sideDark:1,rocker:1}};
function carShape(def){const B=BODY[def.id],S=def.shape;S.L=B.L;S.W=B.W;S.hood=profile(B.top,B.cab[0]-.02);
 return{S,B,fa:B.fa,ra:B.ra,tireR:B.tireR,tw:B.tw,top:p=>profile(B.top,p),belt:p=>profile(B.belt,p),sill:p=>profile(B.sill,p),hw:p=>profile(B.hw,p)*B.W/2}}
// one cross-section: right half from the underside centre to the roof centre, as [z,y,a]
function section(cs,p){const B=cs.B,L=B.L,yb=cs.sill(p),yl=Math.max(cs.belt(p),yb+.14),w=cs.hw(p);let yt=Math.max(cs.top(p),yb+.16);
 // wheel arch: the well is cut into the outer part of the body only
 let lift=0;for(const ax of[B.fa,B.ra]){const dx=(p-ax)*L,R=B.tireR+.045;if(Math.abs(dx)<R)lift=Math.max(lift,B.tireR+Math.sqrt(R*R-dx*dx)-yb)}
 const ya=yb+Math.max(0,lift),zi=Math.max(.05,w-B.tw-.1),topL=yl-.03;
 const y4=Math.min(ya+.015,topL-.045),y5=Math.min(Math.max(ya+.05,yb+(yl-yb)*.42),topL-.03),y6=Math.min(Math.max(y5+.04,yb+(yl-yb)*.68),topL-.012);
 const out=[[0,yb,0],[zi,yb,.05],[zi,ya,.1],[w*.93,ya,.15],[w*.975,y4,.2],[w*.995,y5,.3],[w,y6,.4],[w*.985,topL,.46],[w*.955,yl,.5]];
 // above the shoulder: blend from a crowned hood or deck to the glasshouse
 const c=sstep(B.cab[0]-.012,B.cab[0]+.004,p)*(1-sstep(B.cab[3]-.004,B.cab[3]+.012,p));
 const Sx=w*.955,Sy=yl,Gx=lerp(w*.86,w*B.gw[0],c),Gy=lerp(yl+(yt-yl)*.45,yl+.025,c),Ex=lerp(w*.5,w*B.gw[1],c),Ey=lerp(yt-(yt-yl)*.06-.004,yt-.045,c);
 const qb=(a,b,k,t)=>(1-t)*(1-t)*a+2*(1-t)*t*k+t*t*b;
 const k1x=lerp(Sx,Gx,.35),k1y=lerp(Sy,Gy,.85);for(let i=1;i<=3;i++){const t=i/3;out.push([qb(Sx,Gx,k1x,t),qb(Sy,Gy,k1y,t),.5+t*.05])}
 let dz=Ex-Gx,dy=Ey-Gy;const dl=Math.hypot(dz,dy)||1,bl=lerp(.012,.024,c),k2x=(Gx+Ex)/2+dy/dl*bl,k2y=(Gy+Ey)/2-dz/dl*bl;
 for(let i=1;i<=8;i++){const t=i/8;out.push([qb(Gx,Ex,k2x,t),qb(Gy,Ey,k2y,t),.55+t*.25])}
 const bul=B.bulge?profile(B.bulge,p)*(1-c):0;
 for(let i=1;i<=6;i++){const th=i/6*PI/2,cz=Math.pow(Math.cos(th),2/2.2),sz=Math.pow(Math.sin(th),2/2.2),z=Ex*cz;out.push([z,Ey+(yt-Ey)*sz+bul*sstep(Ex*.62,Ex*.3,z),.8+i/6*.2])}
 return out}
function bodyGeo(cs){const B=cs.B,L=B.L,ps=[];
 // stations: even spacing plus exact breaks at the arches, glass and the ends
 for(let i=0;i<=120;i++)ps.push(i/120);for(let i=1;i<10;i++){ps.push(i*.006);ps.push(1-i*.006)}
 for(const ax of[B.fa,B.ra]){const r=(B.tireR+.045)/L;for(const s of[-1,1]){ps.push(ax+s*(r-.0006),ax+s*(r+.0006));for(let k=1;k<8;k++)ps.push(ax+s*r*k/8)}}
 for(const v of[...B.cab,...B.win,...B.doors,...B.pil])ps.push(v);ps.sort((a,b)=>a-b);
 const st=[];for(const v of ps){if(v<0||v>1)continue;if(!st.length||v-st[st.length-1]>.0009)st.push(v)}if(st[st.length-1]<1)st.push(1);
 const P=[],A=[],I=[],rings=[];
 const addRing=(pts,x,p,flipX)=>{const row=[];for(const [z,y,a] of pts){row.push(P.length/3);P.push(x,y,z);A.push(p,a,1)}for(let k=pts.length-2;k>=0;k--){const [z,y,a]=pts[k];row.push(P.length/3);P.push(x,y,-z);A.push(p,a,-1)}return row};
 for(const p of st)rings.push({p,pts:section(cs,p),row:null});
 for(const r of rings)r.row=addRing(r.pts,L/2-r.p*L,r.p);
 const quads=(r0,r1)=>{for(let k=0;k<r0.length-1;k++){const a=r0[k],b=r0[k+1],c=r1[k],d=r1[k+1];I.push(a,b,c,b,d,c)}};
 for(let i=0;i<rings.length-1;i++)quads(rings[i].row,rings[i+1].row);
 // flat-ish end faces made of shrinking rings, so the face keeps clean edges and its own markings
 for(const [ri,dir,pf] of[[0,1,-.01],[rings.length-1,-1,1.01]]){const base=rings[ri];let cy=0;base.pts.forEach(q=>cy+=q[1]);cy/=base.pts.length;let prev=base.row;
  for(const [s,dx] of[[.72,.008],[.42,.013],[.14,.015],[0,.016]]){const pts=base.pts.map(([z,y,a])=>[z*s,cy+(y-cy)*s,a]);const row=addRing(pts,L/2-base.p*L+dir*dx,pf);if(dir>0)quads(row,prev);else quads(prev,row);prev=row}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('cp',new THREE.Float32BufferAttribute(A,3));g.setIndex(I);g.computeVertexNormals();return g}
function numberTex(n){const c=cv(128,128,(x,w,h)=>{x.fillStyle='#f4f4f2';x.beginPath();x.arc(64,64,62,0,TAU);x.fill();x.lineWidth=7;x.strokeStyle='#111';x.beginPath();x.arc(64,64,56,0,TAU);x.stroke();
 x.fillStyle='#111';x.font='800 78px "Saira Condensed",Impact,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(String(n),64,70)});const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t}
// lamps, grilles and intakes differ per car; written in object space (o) and loft space (p along, a around)
const LAMPS={
 gt:{f:`grille=max(grille,ff*box(o.y,Y0B+.035,Y0B+.17,.006)*box(az,-1.,W0*.56,.01));grille=max(grille,ff*box(o.y,Y0B+.02,Y0B+.08,.006)*box(az,W0*.64,W0*.9,.01));
   hl=max(hl,ff*box(o.y,Y0T-.075,Y0T-.018,.006)*box(az,W0*.58,W0*.94,.01));`,
  r:`tl=max(tl,rf*box(o.y,YL1-.1,YL1-.045,.005)*box(az,W1*.42,W1*.97,.01));tl=max(tl,box(p,.968,1.02,.003)*box(a,.4,.5,.006)*step(W2*.55,az));grille=max(grille,rf*box(o.y,-1.,Y1B+.07,.006));`},
 rally:{f:`grille=max(grille,ff*box(o.y,Y0T-.13,Y0T-.035,.006)*box(az,-1.,W0*.5,.01));grille=max(grille,ff*box(o.y,Y0B+.03,Y0B+.17,.006)*box(az,-1.,W0*.78,.01));
   hl=max(hl,ff*box(o.y,Y0T-.12,Y0T-.02,.006)*box(az,W0*.56,W0*.93,.01));`,
  r:`tl=max(tl,rf*box(o.y,YL1-.17,YL1-.02,.006)*box(az,W1*.68,W1*.95,.01));tl=max(tl,box(p,.972,1.02,.003)*box(a,.38,.56,.006)*step(W2*.7,az));grille=max(grille,rf*box(o.y,-1.,Y1B+.08,.006));`},
 muscle:{f:`float gr=ff*box(o.y,Y0B+.1,Y0T-.05,.006)*box(az,-1.,W0*.92,.01);grille=max(grille,gr);
   vec2 lc=vec2(az-W0*.74,o.y-(Y0B+Y0T+.05)*.5);hl=max(hl,ff*(1.-smoothstep(.068,.078,length(lc))));grille=max(grille,ff*box(o.y,-1.,Y0B+.06,.006));`,
  r:`tl=max(tl,rf*box(o.y,YL1-.16,YL1-.05,.006)*box(az,W1*.1,W1*.95,.01));tl=max(tl,box(p,.975,1.02,.003)*box(a,.38,.47,.006)*step(W2*.75,az));grille=max(grille,rf*box(o.y,-1.,Y1B+.07,.006));`},
 apex:{f:`grille=max(grille,ff*box(o.y,Y0B+.015,Y0T-.05,.006)*box(az,W0*.28,W0*.92,.01));grille=max(grille,ff*box(o.y,-1.,Y0B+.03,.006));`,
  r:`tl=max(tl,rf*box(o.y,YL1-.055,YL1-.02,.004)*box(az,-1.,W1*.97,.01));tl=max(tl,box(p,.976,1.02,.003)*box(a,.44,.5,.005)*step(W2*.6,az));
   float df=rf*box(o.y,-1.,Y1B+.16,.006)*box(az,-1.,W1*.82,.01);grille=max(grille,df);fin=df*step(.82,fract(az*14.));`}};
function paintMaterial(def,cs,color,num,stripe){const B=cs.B,m=new THREE.MeshPhysicalMaterial({color:new THREE.Color(color).convertSRGBToLinear(),metalness:.25,roughness:.38,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:1.05});
 m.userData.u={brake:{value:0},head:{value:0},numT:{value:numberTex(num)},stripe:{value:new THREE.Color(stripe).convertSRGBToLinear()},hasStripe:{value:def.id==='rally'||def.id==='muscle'?1:0}};
 const f=v=>(+v).toFixed(4),pc=(B.doors[0]+B.doors[1])/2+.01,yc=(cs.sill(pc)+cs.belt(pc))/2+.03;
 const K={W0:cs.hw(0),Y0B:cs.sill(0),Y0T:cs.top(0),W1:cs.hw(1),Y1B:cs.sill(1),YL1:cs.belt(1),W2:B.W/2};
 let consts='';for(const k in K)consts+=`const float ${k}=${f(K[k])};`;
 const pil=B.pil.map(v=>`side*=1.-box(p,${f(v-.007)},${f(v+.007)},.002);`).join(''),hlE=B.hl?`hl=max(hl,(1.-smoothstep(.82,1.,length(vec2((p-${f(B.hl[0])})/${f(B.hl[2])},(a-${f(B.hl[1])})/${f(B.hl[3])}))))*(1.-rf));`:'';
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,m.userData.u);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 cp;varying vec3 vCp;varying vec3 vOP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvCp=cp;vOP=position;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vCp;varying vec3 vOP;uniform float brake;uniform float head;uniform sampler2D numT;uniform vec3 stripe;uniform float hasStripe;${consts}
   float box(float x,float a,float b,float e){return smoothstep(a-e,a+e,x)*(1.-smoothstep(b-e,b+e,x));}`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
    float p=vCp.x,a=vCp.y;vec3 o=vOP;float az=abs(o.z);float ff=step(p,-.005),rf=step(1.005,p),face=ff+rf;
    float side=box(p,${f(B.win[0])},${f(B.win[1])},.0018)*box(a,.574,.784,.004)*(1.-face);${pil}
    float shield=box(p,${f(B.cab[0]+.005)},${f(B.cab[1]-.003)},.0018)*step(.81,a)*(1.-face);
    float back=box(p,${f(B.cab[2]+.006)},${f(B.cab[3]-.008)},.0018)*step(.81,a)*(1.-face);
    float glass=max(side,max(shield,back));
    float trim=box(p,${f(B.win[0]-.006)},${f(B.win[1]+.006)},.0018)*box(a,.558,.8,.004)*(1.-glass)*(1.-face);
    float well=(1.-step(.185,a))*(1.-face);
    float grille=0.,hl=0.,tl=0.,fin=0.;${hlE}${LAMPS[def.id].f}${LAMPS[def.id].r}
    float rock=${B.rocker?'box(a,.17,.26,.006)*(1.-face)':'0.'};
    float intake=${B.sideDark?`box(p-(a-.24)*.12,.6,.685,.003)*box(a,.25,.41,.006)*(1.-face)`:'0.'};
    float seam=(smoothstep(.0028,0.,abs(p-${f(B.doors[0])}))+smoothstep(.0028,0.,abs(p-${f(B.doors[1])})))*box(a,.2,.5,.004)*(1.-face);
    float handle=box(p,${f(B.doors[1]-.05)},${f(B.doors[1]-.02)},.002)*box(o.y,${f(cs.belt(B.doors[1])-.1)},${f(cs.belt(B.doors[1])-.07)},.004)*box(a,.3,.5,.01);
    float strp=hasStripe*box(az,.07,.21,.006)*step(.47,a)*(1.-glass)*(1.-face*(1.-step(.5,o.y-${f(K.Y0B)})));
    vec2 nuv=vec2((p-${f(pc)})*${f(B.L/.21)}*-sign(o.z),(o.y-${f(yc)})/.21);float numM=step(length(nuv),1.)*box(a,.2,.48,.004)*(1.-face);
    vec3 baseC=diffuseColor.rgb;baseC=mix(baseC,stripe,strp);
    if(numM>.5){vec4 nt=texture2D(numT,nuv*.5+.5);baseC=mix(baseC,nt.rgb*nt.rgb,nt.a);}
    float dark=max(max(trim,well),max(max(grille,rock),max(intake,handle)));
    baseC=mix(baseC,vec3(.018,.02,.022),glass);baseC=mix(baseC,vec3(.022)*(1.+fin*2.),dark);
    baseC=mix(baseC,vec3(.42,.44,.47),hl);baseC=mix(baseC,vec3(.32,.012,.01),tl);baseC*=1.-seam*.75;
    float gr2=grille*(.6+.4*step(.5,fract(o.y*38.)));baseC*=1.-gr2*.35*(1.-glass);
    diffuseColor.rgb=baseC;
    roughnessFactor=mix(roughnessFactor,.04,glass);roughnessFactor=mix(roughnessFactor,.62,dark);roughnessFactor=mix(roughnessFactor,.12,max(hl,tl));
    float gm=glass;`)
   .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,0.,max(gm,dark));metalnessFactor=mix(metalnessFactor,.7,hl);')
   .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance+=vec3(1.,.97,.9)*hl*(.06+head*24.)*step(0.,vOP.x);totalEmissiveRadiance+=vec3(1.,.018,.008)*tl*(.1+head*1.1+brake*6.)*step(vOP.x,0.);')};
 m.customProgramCacheKey=()=>'paint2_'+def.id;return m}
// ---------- wheels ----------
function mergeGeos(list){let nv=0,ni=0;list.forEach(g=>{nv+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count});const P=new Float32Array(nv*3),N=new Float32Array(nv*3),I=new Uint32Array(ni);let vo=0,io=0;
 for(const g of list){const p=g.attributes.position,n=g.attributes.normal;P.set(p.array,vo*3);N.set(n.array,vo*3);if(g.index){for(let k=0;k<g.index.count;k++)I[io++]=g.index.array[k]+vo}else for(let k=0;k<p.count;k++)I[io++]=k+vo;vo+=p.count}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(N,3));g.setIndex(new THREE.BufferAttribute(I,1));return g}
const WHEEL={};
function wheelGeos(R,w,spokes){const key=R.toFixed(3)+'_'+w.toFixed(3)+'_'+spokes;if(WHEEL[key])return WHEEL[key];
 const tp=[];const rim=R*.7;// tyre cross-section from the inside bead out over the tread; the outer sidewall bulges a little
 const sec=[[rim,-w*.5],[R*.84,-w*.53],[R*.96,-w*.49],[R,-w*.4],[R,w*.4],[R*.96,w*.49],[R*.84,w*.53],[rim,w*.5]];for(const [r,y] of sec)tp.push(new THREE.Vector2(r,y));
 const tyre=new THREE.LatheGeometry(tp,48);tyre.rotateX(PI/2);
 const tpp=tyre.attributes.position;for(let i=0;i<tpp.count;i++){const x=tpp.getX(i),y=tpp.getY(i),r=Math.hypot(x,y);if(r>R*.99){const a=Math.atan2(y,x),k=1-.01*(Math.sin(a*40)>.55?1:0);tpp.setX(i,x*k);tpp.setY(i,y*k)}}tyre.computeVertexNormals();
 // rim: lip, a dished face and spokes that step back toward the hub
 const face=new THREE.LatheGeometry([new THREE.Vector2(rim*1.005,w*.36),new THREE.Vector2(rim*1.03,w*.44),new THREE.Vector2(rim*.97,w*.47),new THREE.Vector2(rim*.9,w*.4),new THREE.Vector2(rim*.86,w*.3)],32);face.rotateX(PI/2);
 const hub=new THREE.LatheGeometry([new THREE.Vector2(rim*.3,w*.1),new THREE.Vector2(rim*.27,w*.25),new THREE.Vector2(rim*.13,w*.29),new THREE.Vector2(.001,w*.3)],20);hub.rotateX(PI/2);
 const parts=[face,hub];const n=spokes,dbl=n<=6;
 for(let s=0;s<n;s++)for(const o of(dbl?[-.075,.075]:[0])){const b=new THREE.BoxGeometry(dbl?.032:.04,rim*.62,.035);const pp=b.attributes.position;for(let i=0;i<pp.count;i++){const y=pp.getY(i);pp.setZ(i,pp.getZ(i)-(1-(y+rim*.31)/(rim*.62))*w*.12)}
  b.computeVertexNormals();b.translate(0,rim*.57,w*.37);b.rotateZ(s/n*TAU+o);parts.push(b)}
 const barrel=new THREE.CylinderGeometry(rim*.97,rim*.97,w*.8,32,1,true);barrel.rotateX(PI/2);parts.push(barrel);
 const rimG=mergeGeos(parts);
 const disc=new THREE.CylinderGeometry(rim*.84,rim*.84,.028,32);disc.rotateX(PI/2);disc.translate(0,0,w*.02);
 const cal=new THREE.BoxGeometry(.13,.2,.075);cal.translate(rim*.6,rim*.22,w*.08);
 return WHEEL[key]={tyre,rim:rimG,disc,cal}}
const WMAT={tyre:null,rimS:null,rimD:null,rimG:null,disc:null,cal:null};
function wheelMats(){if(WMAT.tyre)return WMAT;WMAT.tyre=new THREE.MeshStandardMaterial({color:0x161616,roughness:.88,metalness:0,envMapIntensity:.35});
 WMAT.rimS=new THREE.MeshStandardMaterial({color:0xb4b7bc,roughness:.28,metalness:1,envMapIntensity:.9,side:THREE.DoubleSide});WMAT.rimD=new THREE.MeshStandardMaterial({color:0x26272a,roughness:.32,metalness:.85,envMapIntensity:1.1,side:THREE.DoubleSide});
 WMAT.rimG=new THREE.MeshStandardMaterial({color:0xb08a3a,roughness:.3,metalness:.9,envMapIntensity:1.1,side:THREE.DoubleSide});
 WMAT.disc=new THREE.MeshStandardMaterial({color:0x55565a,roughness:.42,metalness:.85});WMAT.cal=new THREE.MeshStandardMaterial({color:0xb81414,roughness:.4,metalness:.2});return WMAT}
// ---------- whole car ----------
const TRIM=new THREE.MeshStandardMaterial({color:0x0e0e10,roughness:.5,metalness:.25,envMapIntensity:.6});
const CHROME=new THREE.MeshStandardMaterial({color:0xd8dadd,roughness:.12,metalness:1,envMapIntensity:1.3});
let SHADOWTEX=null;
function buildCarMesh(def,paintIdx,num){const cs=carShape(def),B=cs.B,L=B.L,root=new THREE.Group(),body=new THREE.Group();root.add(body);
 const paint=PAINTS[paintIdx%PAINTS.length].c,stripeC=paint===0xe8eaec||paint===0xe3a100||paint===0x6fbf1a?0x111111:0xf2f2f2;
 const mat=paintMaterial(def,cs,paint,num,stripeC),bm=new THREE.Mesh(bodyGeo(cs),mat);
 const pm2=new THREE.MeshPhysicalMaterial({color:mat.color,metalness:mat.metalness,roughness:mat.roughness,clearcoat:1,clearcoatRoughness:.03,envMapIntensity:mat.envMapIntensity});bm.castShadow=true;bm.receiveShadow=true;body.add(bm);
 const X=p=>L/2-p*L;
 // door mirrors on short stalks
 {const pm=B.cab[0]+.035,ym=cs.belt(pm)+.08,zm=cs.hw(pm)*B.gw[0]+.075;for(const s of[-1,1]){const g=new THREE.SphereGeometry(1,14,10);g.scale(.075,.06,.11);const m=new THREE.Mesh(g,pm2);m.position.set(X(pm)-.03,ym,s*zm);m.castShadow=true;body.add(m);
  const st=new THREE.Mesh(new THREE.BoxGeometry(.05,.025,.09),TRIM);st.position.set(X(pm)+.01,ym-.03,s*(zm-.06));body.add(st)}}
 // aero and exhausts
 if(def.id==='apex'){const sp=new THREE.Mesh(new THREE.BoxGeometry(.16,.022,B.W*.84),TRIM);sp.position.set(L/2-.11,cs.sill(.01)-.015,0);body.add(sp);
  const yt=cs.top(.96);const w=new THREE.Mesh(new THREE.BoxGeometry(.34,.028,B.W*.86),TRIM);w.position.set(X(.955),yt+.22,0);w.rotation.z=-.1;w.castShadow=true;body.add(w);
  for(const s of[-1,1]){const st=new THREE.Mesh(new THREE.BoxGeometry(.12,.24,.022),TRIM);st.position.set(X(.95),yt+.11,s*B.W*.2);body.add(st);const ep=new THREE.Mesh(new THREE.BoxGeometry(.36,.1,.016),TRIM);ep.position.set(X(.955),yt+.215,s*B.W*.43);body.add(ep)}}
 if(def.id==='rally'){const w=new THREE.Mesh(new THREE.BoxGeometry(.32,.03,B.W*.72),pm2);w.position.set(X(B.cab[2]+.022),cs.top(B.cab[2])-.012,0);w.rotation.z=-.16;w.castShadow=true;body.add(w)}
 const exz=def.id==='muscle'?[-.62,-.5,.5,.62]:def.id==='apex'?[-.08,.08]:def.id==='rally'?[.55]:[-.62,-.5,.5,.62];
 for(const z of exz){const ex=new THREE.Mesh(new THREE.CylinderGeometry(.04,.042,.12,14,1,true),def.id==='apex'?TRIM:CHROME);ex.rotation.z=PI/2;ex.position.set(-L/2-.0,cs.sill(1)+(def.id==='apex'?.2:.05),z*cs.hw(1));body.add(ex)}
 // wheels: tyre outer face sits just inside the fender
 const W=wheelMats(),spokes={gt:5,rally:8,muscle:5,apex:10}[def.id],G=wheelGeos(B.tireR,B.tw,spokes),wheels=[];const rimM=def.id==='rally'&&paintIdx%2===0?W.rimG:paintIdx%2?W.rimD:W.rimS;
 for(const [ax,front] of[[B.fa,1],[B.ra,0]])for(const s of[-1,1]){const piv=new THREE.Group(),spin=new THREE.Group();piv.position.set(X(ax),B.tireR,s*(cs.hw(ax)-B.tw*.5-.025));piv.add(spin);
  const ty=new THREE.Mesh(G.tyre,W.tyre),rm=new THREE.Mesh(G.rim,rimM);ty.castShadow=true;spin.add(ty,rm);if(s<0){spin.scale.z=-1}
  const dc=new THREE.Mesh(G.disc,W.disc),cl=new THREE.Mesh(G.cal,W.cal);piv.add(dc,cl);if(s<0){dc.scale.z=-1;cl.scale.z=-1}root.add(piv);wheels.push({piv,spin,front,side:s})}
 // soft contact shadow
 if(!SHADOWTEX)SHADOWTEX=new THREE.CanvasTexture(cv(128,128,(x)=>{const g=x.createRadialGradient(64,64,10,64,64,64);g.addColorStop(0,'rgba(0,0,0,.85)');g.addColorStop(.55,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128)}));
 const sh=new THREE.Mesh(new THREE.PlaneGeometry(L*1.2,B.W*1.4),new THREE.MeshBasicMaterial({map:SHADOWTEX,transparent:true,depthWrite:false,opacity:.75,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}));sh.rotation.x=-PI/2;sh.renderOrder=1;
 return{root,body,mat,wheels,shadow:sh,cs,wheelbase:(B.ra-B.fa)*L,a:(.5-B.fa)*L,b:(B.ra-.5)*L,tireR:B.tireR}}

// ================= VEHICLE PHYSICS =================
// Planar bicycle model with load transfer, a peaky tyre curve and a friction circle; vertical motion follows the road and can leave it over crests.
const G9=9.81,PDT=1/120;
const GEARS=[0,3.3,2.25,1.68,1.32,1.07,.88],FINAL=3.7;
function makeCar(def,paint,num,isPlayer){const mesh=buildCarMesh(def,paint,num),m=def.mass,a=mesh.a,b=mesh.b;
 const car={def,mesh,isPlayer,num,m,a,b,L:a+b,h:.46,Iz:m*(a*a+b*b)*.55,rw:mesh.tireR,x:0,z:0,y:0,vyv:0,th:0,vx:0,vz:0,r:0,steer:0,rpm:900,gear:1,shiftT:0,
  thr:0,brk:0,hand:0,inSteer:0,nitro:.5,nitroOn:false,axl:0,ayl:0,slipF:0,slipR:0,grounded:true,airT:0,ti:-1,u:0,s:0,lap:0,prog:0,lastS:0,cp:0,finished:false,finishT:0,
  bestLap:0,lapStart:0,laps:[],off:0,hitCool:0,drift:0,driftPts:0,driftTime:0,kd:0,pitch:0,roll:0,heave:0,pv:0,rv:0,hv:0,spin:0,wheelSpin:0,surface:0,curb:0,scrape:0,stuck:0,wrong:0,ai:null};
 const P=def.power*1000,vt=def.top;car.kd=P*.92/(vt*vt*vt);
 scene.add(mesh.root);scene.add(mesh.shadow);return car}
function removeCar(c){scene.remove(c.mesh.root);scene.remove(c.mesh.shadow)}
// place a car on the track at distance s (metres from the line) and lateral u
const _LQ={};
function placeCar(c,s,u){const N=TRK.N,i=wrapI(Math.round(s/TRK.DS));c.x=TRK.px[i]+TRK.rx[i]*u;c.z=TRK.pz[i]+TRK.rz[i]*u;c.th=Math.atan2(TRK.tz[i],TRK.tx[i]);c.vx=c.vz=0;c.r=0;c.steer=0;c.ti=i;
 trackLocate(c.x,c.z,i,_LQ);c.y=surfY(_LQ,_LQ.u);c.vyv=0;c.grounded=true;c.u=_LQ.u;c.s=_LQ.s;c.rpm=900;c.gear=1}
// full lock at speed only asks for about as much turn as the tyres can give, so the car runs wide instead of snapping round
function steerLimit(c,v){return Math.min(c.def.steer,(c.L*1.05*c.def.grip*G9/Math.max(v*v,1)+.04)*1.2)}
function powerCurve(x){return x<.12?.42:x<.82?.42+.58*Math.sin((x-.12)/.7*PI/2):1-(x-.82)*.6}
const tyre=(x)=>{x=Math.abs(x);return x<1?1.5*x-.5*x*x*x:Math.max(.8,1-.08*(x-1))};
const tyreR=(x,hb)=>{x=Math.abs(x);return x<1?1.5*x-.5*x*x*x:Math.max(hb?.7:.88,1-(hb?.1:.05)*(x-1))};
const _Q={};
function stepCar(c,dt,race){const d=c.def,biome=TRK.def.biome;
 trackLocate(c.x,c.z,c.ti,_Q);c.ti=_Q.i;c.u=_Q.u;const W=TRK.W,au=Math.abs(_Q.u);
 const onRoad=au<=W+.15,surf=onRoad?(biome==='winter'?.84:1):(biome==='winter'?.55:.62);c.surface=onRoad?0:1;c.curb=TRK.curbs&&TRK.curbs[_Q.i]&&au>W-.4&&au<W+.9?1:0;
 const cs=Math.cos(c.th),sn=Math.sin(c.th),Fx=cs,Fz=sn,Rx=-sn,Rz=cs;
 let vx=c.vx*Fx+c.vz*Fz,vy=c.vx*Rx+c.vz*Rz;const sp=Math.hypot(c.vx,c.vz);
 // ---- controls ----
 const steerMax=steerLimit(c,Math.abs(vx));let target=c.inSteer*steerMax;
 const beta=Math.abs(vx)>4?Math.atan2(vy,Math.abs(vx)):0;if(c.isPlayer&&save.set.assist)target+=clamp(beta*.55,-.25,.25)*(1-Math.abs(c.inSteer)*.4);
 c.steer=damp(c.steer,clamp(target,-d.steer,d.steer),Math.abs(target)>Math.abs(c.steer)?11:15,dt);
 // ---- engine and gearbox ----
 const wheelRpm=Math.abs(vx)/(TAU*c.rw)*60;
 if(c.shiftT>0)c.shiftT-=dt;else{const rp=wheelRpm*GEARS[c.gear]*FINAL;if(rp>7000&&c.gear<6){c.gear++;c.shiftT=.16;if(c.isPlayer)sfx('shift')}else if(c.gear>1&&wheelRpm*GEARS[c.gear-1]*FINAL<4700){c.gear--;c.shiftT=.12}}
 if(vx<-.5&&c.brk>0)c.gear=1;
 const rpmT=clamp(wheelRpm*GEARS[c.gear]*FINAL,850,7600)+(c.thr>.1&&Math.abs(vx)<6?c.thr*2800*(1-Math.abs(vx)/6):0);c.rpm=damp(c.rpm,rpmT,c.grounded?14:4,dt);
 let P=d.power*1000*powerCurve(c.rpm/7400)*c.thr*(c.shiftT>0?.15:1);
 if(c.nitroOn&&c.nitro>0){P*=1.5;c.nitro=Math.max(0,c.nitro-dt/3.6);if(c.nitro<=0)c.nitroOn=false}
 const reverse=c.brk>.1&&vx<.8&&c.thr<.1;
 // ---- loads ----
 const down=1+d.down*.12*sp*sp,mg=c.m*G9*down,L=c.L;let Ffz=mg*c.b/L-c.m*c.axl*c.h/L,Frz=mg*c.a/L+c.m*c.axl*c.h/L;Ffz=Math.max(Ffz,mg*.15);Frz=Math.max(Frz,mg*.15);
 const mu=1.05*d.grip*surf*(c.curb?.97:1),muF=mu*Ffz,muR=mu*Frz*(c.hand>.1?.42:1);
 let Fxf=0,Fxr=0,Fyf=0,Fyr=0,Mz=0;
 if(c.grounded){
  // longitudinal
  const drive=reverse?-Math.min(4000,c.m*3):P/Math.max(Math.abs(vx),4);
  const AWD=d.drive==='AWD';let df=AWD?drive*.4:0,dr=AWD?drive*.6:drive;
  if(c.brk>0&&!reverse&&vx>.3){const B=c.m*G9*1.15*d.brake*c.brk*down;df-=B*.68;dr-=B*.32}
  if(c.hand>.1&&Math.abs(vx)>.5)dr=-Math.sign(vx)*muR*.85;
  // traction control keeps a share of the tyre for cornering (always on for rivals, optional for you)
  const tc=!c.isPlayer||save.set.assist?.9:1.02,latF=clamp((c.fyF||0)/muF,0,1),latR=clamp((c.fyR||0)/muR,0,1);
  if(df>0)df=Math.min(df,muF*tc*Math.sqrt(Math.max(.05,1-latF*latF)));if(dr>0)dr=Math.min(dr,muR*tc*Math.sqrt(Math.max(.05,1-latR*latR*(tc>1?.6:1))));
  Fxf=clamp(df,-muF,muF);Fxr=clamp(dr,-muR,muR);
  // lateral
  const lv=Math.max(Math.abs(vx),3);const af=Math.atan2(vy+c.a*c.r,lv)-c.steer*Math.sign(vx||1),ar=Math.atan2(vy-c.b*c.r,lv);
  const capF=muF*Math.sqrt(Math.max(.12,1-(Fxf/muF)**2)),capR=muR*Math.sqrt(Math.max(.12,1-(Fxr/muR)**2));
  Fyf=-Math.sign(af)*capF*tyre(af/.13);Fyr=-Math.sign(ar)*capR*tyreR(ar/(c.hand>.1?.07:.095),c.hand>.1);
  c.slipF=Math.abs(af);c.slipR=Math.abs(ar);c.fyF=Math.abs(Fyf);c.fyR=Math.abs(Fyr);
  if(Math.abs(vx)<3){// parking-speed behaviour without slip-angle blowups
   const k=1-Math.abs(vx)/3;Fyf*=1-k;Fyr*=1-k;const rT=vx*Math.tan(c.steer)/L;c.r=lerp(c.r,rT,clamp(k*12*dt,0,1));vy*=Math.exp(-10*k*dt)}
  Mz=c.a*(Fyf*Math.cos(c.steer)+Fxf*Math.sin(c.steer))-c.b*Fyr;
  // stability control: nudges the nose back toward where the car is travelling once it slides (off while the handbrake is held)
  if(Math.abs(vx)>6&&c.hand<.1){const b2=Math.atan2(vy,Math.abs(vx)),ex=b2-clamp(b2,-.07,.07),k=!c.isPlayer||save.set.assist?16:5;Mz+=c.Iz*k*ex}}
 else{c.slipF=c.slipR=0}
 // resistances: aero drag, rolling, grass drag, slope
 const drag=c.kd*sp*(c.nitroOn?.9:1),roll=c.m*G9*(onRoad?.012:.06);const grade=(TRK.py[wrapI(c.ti+2)]-TRK.py[wrapI(c.ti-2)])/(4*TRK.DS),along=Fx*_Q.tx+Fz*_Q.tz;
 let fLong=Fxf*Math.cos(c.steer)-Fyf*Math.sin(c.steer)+Fxr-roll*Math.sign(vx)*(Math.abs(vx)>.2?1:Math.abs(vx)/.2)-c.m*G9*grade*along*(c.grounded?1:0);
 let fLat=Fxf*Math.sin(c.steer)+Fyf*Math.cos(c.steer)+Fyr;
 c.axl=lerp(c.axl,fLong/c.m,.2);c.ayl=lerp(c.ayl,fLat/c.m,.2);
 const ax=fLong/c.m,ay=fLat/c.m;
 c.vx+=(Fx*ax+Rx*ay)*dt-c.vx*drag/c.m*dt;c.vz+=(Fz*ax+Rz*ay)*dt-c.vz*drag/c.m*dt;
 if(c.grounded)c.r+=Mz/c.Iz*dt;else c.r*=Math.exp(-.6*dt);
 c.r=clamp(c.r,-4,4);c.th+=c.r*dt;
 if(c.brk>.1&&Math.abs(vx)<.6&&!reverse&&c.thr<.05){c.vx*=Math.exp(-8*dt);c.vz*=Math.exp(-8*dt)}
 c.x+=c.vx*dt;c.z+=c.vz*dt;
 // ---- vertical: follow the road, fly off crests ----
 trackLocate(c.x,c.z,c.ti,_Q);c.ti=_Q.i;c.u=_Q.u;c.s=_Q.s;const gy=surfY(_Q,clamp(_Q.u,-(W+TRK.RAIL),W+TRK.RAIL));
 const grd=(TRK.py[wrapI(c.ti+1)]-TRK.py[c.ti])/TRK.DS,vAl=c.vx*_Q.tx+c.vz*_Q.tz;
 if(c.grounded){// leave the road only where it curves downward faster than gravity can follow
  if(vAl*vAl*TRK.ypp[c.ti]<-G9*1.03&&sp>15){c.grounded=false;c.vyv=vAl*grd;c.airT=0}else{c.vyv=clamp((gy-c.y)/dt,-30,30);c.y=gy}}
 if(!c.grounded){c.airT+=dt;c.vyv-=G9*dt;c.y+=c.vyv*dt;if(c.y<=gy){const imp=Math.max(0,(gy-c.y)/dt-c.vyv);c.y=gy;c.grounded=true;c.hv-=Math.min(3,imp*.25);if(c.isPlayer&&c.airT>.25)sfx('hit',clamp(imp/12,.15,.8));c.vyv=0}}
 // ---- barriers ----
 railCollide(c,race);
 c.nitro=Math.min(1,c.nitro+dt*.012)}
// guard rails: test the four body corners against the rail line
function railCollide(c,race){const lim=TRK.W+TRK.RAIL-.08,cs=Math.cos(c.th),sn=Math.sin(c.th),hl=c.def.shape.L/2,hw=c.def.shape.W/2;
 const rx=-_Q.tz,rz=_Q.tx;let worst=0,cx=0,cz=0,side=0;
 for(const [lx,lz] of[[hl,hw],[hl,-hw],[-hl,hw],[-hl,-hw]]){const ox=cs*lx-sn*lz,oz=sn*lx+cs*lz,u=c.u+ox*rx+oz*rz,pen=Math.abs(u)-lim;if(pen>worst){worst=pen;cx=ox;cz=oz;side=Math.sign(u)}}
 c.scrape=Math.max(0,c.scrape-.05);if(worst<=0)return;
 const nx=rx*side,nz=rz*side;c.x-=nx*worst;c.z-=nz*worst;c.u-=side*worst;
 const pvx=c.vx+(-c.r*cz),pvz=c.vz+(c.r*cx),vn=pvx*nx+pvz*nz;
 if(vn>0){const cr=cx*nz-cz*nx,kk=1/c.m+cr*cr/c.Iz,j=(1.3*vn)/kk;c.vx-=j*nx/c.m;c.vz-=j*nz/c.m;c.r+=(cx*(-nz*j)-cz*(-nx*j))/c.Iz*.6;
  const sp=Math.hypot(c.vx,c.vz),fr=clamp(vn*.012,0,.35);c.vx*=1-fr;c.vz*=1-fr;
  if(vn>2.5&&c.hitCool<=0){c.hitCool=.25;if(c.isPlayer){sfx('hit',clamp(vn/18,.15,1.2));CAMS.shake=Math.max(CAMS.shake,clamp(vn/20,.1,.8))}if(race)race.contact(c,vn);fxSparks(c.x+cx,c.y+.5,c.z+cz,Math.min(40,vn*3|0))}
  c.scrape=Math.min(1,c.scrape+.4)}
 const tv=c.vx*-nz+c.vz*nx;if(Math.hypot(c.vx,c.vz)>3){c.vx*=.9985;c.vz*=.9985}}
// cars against cars: three discs along each body
function carCollide(A,B,race){const dx=B.x-A.x,dz=B.z-A.z;if(dx*dx+dz*dz>49)return;let best=null,bp=0;
 const ca=Math.cos(A.th),sa=Math.sin(A.th),cb=Math.cos(B.th),sb=Math.sin(B.th),RA=A.def.shape.W*.5,RB=B.def.shape.W*.5,oa=A.def.shape.L*.3,ob=B.def.shape.L*.3;
 for(const ka of[-1,0,1])for(const kb of[-1,0,1]){const ax=A.x+ca*oa*ka,az=A.z+sa*oa*ka,bx=B.x+cb*ob*kb,bz=B.z+sb*ob*kb,d=Math.hypot(bx-ax,bz-az),pen=RA+RB-d;if(pen>bp){bp=pen;best=[ax,az,bx,bz,d]}}
 if(!best)return;const [ax,az,bx,bz,d]=best,nx=(bx-ax)/(d||1),nz=(bz-az)/(d||1),tot=A.m+B.m;
 A.x-=nx*bp*B.m/tot;A.z-=nz*bp*B.m/tot;B.x+=nx*bp*A.m/tot;B.z+=nz*bp*A.m/tot;
 const px=(ax+bx)/2,pz=(az+bz)/2,dAx=px-A.x,dAz=pz-A.z,dBx=px-B.x,dBz=pz-B.z;
 const vAx=A.vx-A.r*dAz,vAz=A.vz+A.r*dAx,vBx=B.vx-B.r*dBz,vBz=B.vz+B.r*dBx,vn=(vBx-vAx)*nx+(vBz-vAz)*nz;if(vn>=0)return;
 const crA=dAx*nz-dAz*nx,crB=dBx*nz-dBz*nx,k=1/A.m+1/B.m+crA*crA/A.Iz+crB*crB/B.Iz,j=-(1.25*vn)/k;
 A.vx-=j*nx/A.m;A.vz-=j*nz/A.m;A.r-=crA*j/A.Iz*.5;B.vx+=j*nx/B.m;B.vz+=j*nz/B.m;B.r+=crB*j/B.Iz*.5;
 const imp=-vn;if(imp>1.5){if((A.isPlayer||B.isPlayer)&&Math.max(A.hitCool,B.hitCool)<=0){sfx(imp>6?'hit':'tap',clamp(imp/14,.15,1));CAMS.shake=Math.max(CAMS.shake,clamp(imp/25,.05,.5))}A.hitCool=B.hitCool=.2;if(imp>5)fxSparks(px,(A.y+B.y)/2+.5,pz,Math.min(30,imp*2|0));if(race)race.contact(A.isPlayer?A:B,imp,true)}}

// ================= AI DRIVERS =================
// Pure-pursuit steering along the racing line, speed from the precomputed braking profile, simple lane changes to pass.
const AINAMES=['Rossi','Kovač','Lindqvist','Moreau','Hart','Nakamura','Okafor','Brandt','Silva','Varga'];
function aiInit(c,skill,name){c.ai={skill,base:skill,lane:0,laneT:0,name,stuck:0,mist:0,back:0,nitroT:R()*5}}
function sDelta(a,b){let d=b-a;const L=TRK.L;if(d>L/2)d-=L;if(d<-L/2)d+=L;return d}
function aiDrive(c,cars,dt,race){const A=c.ai,N=TRK.N,W=TRK.W,sp=Math.hypot(c.vx,c.vz);
 if(c.finished||!race.go){c.inSteer=0;c.thr=0;c.brk=race.go?.6:1;c.hand=0;c.nitroOn=false;return}
 // keep the field together a little on Easy and Normal
 const pl=race.player,gap=pl?sDelta(c.prog%TRK.L,pl.prog%TRK.L)+(Math.floor(pl.prog/TRK.L)-Math.floor(c.prog/TRK.L))*TRK.L:0;
 const rb=save.set.diff===2?0:(gap>120?.035:gap<-160?-.04:0);A.skill=damp(A.skill,A.base+rb,.5,dt);
 // lane choice: pass slower cars ahead, otherwise drift back to the line
 A.laneT-=dt;let want=A.lane;
 for(const o of cars){if(o===c)continue;const ds=sDelta(c.s,o.s);if(ds>1&&ds<24){const myU=TRK.line[c.ti]+A.lane,du=o.u-myU;if(Math.abs(du)<2.6){const left=o.u+2.8,right=o.u-2.8;want=(Math.abs(left)<W-1.4&&(o.u<0||Math.abs(right)>W-1.4))?left-TRK.line[c.ti]:right-TRK.line[c.ti];if(Math.abs(o.u-2.8)>W-1.4&&Math.abs(o.u+2.8)>W-1.4)want=A.lane}}}
 if(A.laneT<=0){A.lane=damp(A.lane,clamp(want,-3.5,3.5),want!==A.lane?1.6:.5,dt);if(Math.abs(want)<.01)A.lane=damp(A.lane,0,.8,dt)}
 const look=5.5+sp*.36,j=wrapI(c.ti+Math.round(look/TRK.DS)),u=clamp(TRK.line[j]+A.lane,-(W-1.05),W-1.05);
 const tx=TRK.px[j]+TRK.rx[j]*u,tz=TRK.pz[j]+TRK.rz[j]*u,dx=tx-c.x,dz=tz-c.z,cs=Math.cos(c.th),sn=Math.sin(c.th),lx=dx*cs+dz*sn,ly=-dx*sn+dz*cs;
 const k=2*ly/Math.max(lx*lx+ly*ly,1),steer=Math.atan(k*c.L);c.inSteer=clamp(steer/steerLimit(c,sp),-1,1);
 // speed: look a little ahead on the braking profile
 const vj=wrapI(c.ti+Math.round((4+sp*.32)/TRK.DS));let vT=Math.min(TRK.vt[vj],TRK.vt[c.ti])*A.skill*(c.def.grip*.5+.5)*(1+c.def.down*16);
 vT=Math.min(vT,c.def.top*.98);if(A.mist>0){A.mist-=dt;vT*=.8}else if(R()<dt*.004*(1.05-A.skill)*10)A.mist=rr(.5,1.4);
 const err=vT-sp;c.thr=clamp(err*.3+.25,0,1)*(c.slipR>.2?.4:1)*(1-Math.max(0,Math.abs(c.inSteer)-.6)*.8);c.brk=err<-1.2?clamp(-err*.16,0,1):0;if(c.brk>0)c.thr=0;c.hand=0;
 // a little nitro on long straights
 A.nitroT-=dt;c.nitroOn=c.nitro>.35&&TRK.vt[wrapI(c.ti+60)]>vT*1.05&&Math.abs(c.inSteer)<.2&&A.nitroT<0&&err>4;if(c.nitroOn&&c.nitro<.05)A.nitroT=rr(4,9);
 // get unstuck
 // get unstuck: no real progress for a few seconds puts the car back on the road
 A.pt=(A.pt||0)+dt;if(A.pt>3){const moved=sDelta(A.ps??c.s,c.s);if(race.go&&race.t>4&&moved<12){respawnCar(c)}A.ps=c.s;A.pt=0}}
// put a car back on the road at its current distance, facing the right way
function respawnCar(c){const s=c.s;placeCar(c,s,TRK.line[wrapI(Math.round(s/TRK.DS))]*.6);c.ghostT=2;c.nitroOn=false}

// ================= EFFECTS: tyre smoke, dust, sparks, skid marks, snowfall =================
class PSys{constructor(n,map,blend){this.n=n;this.p=new Float32Array(n*3);this.v=new Float32Array(n*3);this.life=new Float32Array(n);this.max=new Float32Array(n);this.s0=new Float32Array(n);this.s1=new Float32Array(n);this.c=new Float32Array(n*4);this.drag=new Float32Array(n);this.grav=new Float32Array(n);this.i=0;
 const g=new THREE.BufferGeometry();this.pa=new THREE.BufferAttribute(new Float32Array(n*3),3);this.sa=new THREE.BufferAttribute(new Float32Array(n),1);this.ca=new THREE.BufferAttribute(new Float32Array(n*4),4);
 [this.pa,this.sa,this.ca].forEach(a=>a.setUsage(THREE.DynamicDrawUsage));g.setAttribute('position',this.pa);g.setAttribute('psize',this.sa);g.setAttribute('pcol',this.ca);
 this.mat=new THREE.ShaderMaterial({uniforms:{map:{value:map},scale:{value:600}},vertexShader:SH.partV,fragmentShader:SH.partF,transparent:true,depthWrite:false,blending:blend||THREE.NormalBlending});
 this.pts=new THREE.Points(g,this.mat);this.pts.frustumCulled=false;this.pts.renderOrder=5;scene.add(this.pts)}
 emit(x,y,z,vx,vy,vz,life,s0,s1,r,g,b,a,drag,grav){const i=this.i;this.i=(i+1)%this.n;const k=i*3;this.p[k]=x;this.p[k+1]=y;this.p[k+2]=z;this.v[k]=vx;this.v[k+1]=vy;this.v[k+2]=vz;this.life[i]=this.max[i]=life;this.s0[i]=s0;this.s1[i]=s1;const c=i*4;this.c[c]=r;this.c[c+1]=g;this.c[c+2]=b;this.c[c+3]=a;this.drag[i]=drag||0;this.grav[i]=grav||0}
 update(dt){const P=this.pa.array,S=this.sa.array,C=this.ca.array;
  for(let i=0;i<this.n;i++){if(this.life[i]<=0){S[i]=0;continue}this.life[i]-=dt;const t=1-Math.max(0,this.life[i])/this.max[i],k=i*3,d=Math.exp(-this.drag[i]*dt);
   this.v[k]*=d;this.v[k+1]=this.v[k+1]*d-this.grav[i]*dt;this.v[k+2]*=d;this.p[k]+=this.v[k]*dt;this.p[k+1]+=this.v[k+1]*dt;this.p[k+2]+=this.v[k+2]*dt;
   P[k]=this.p[k];P[k+1]=this.p[k+1];P[k+2]=this.p[k+2];S[i]=this.life[i]>0?lerp(this.s0[i],this.s1[i],t):0;const c=i*4,fa=t<.1?t/.1:1-sstep(.35,1,t);C[c]=this.c[c];C[c+1]=this.c[c+1];C[c+2]=this.c[c+2];C[c+3]=this.c[c+3]*fa}
  this.pa.needsUpdate=this.sa.needsUpdate=this.ca.needsUpdate=true}
 clear(){this.life.fill(0)}}
let SMOKE,SPARK;
function initFX(){SMOKE=new PSys(2400,TX.puff);SPARK=new PSys(500,TX.spark,THREE.AdditiveBlending);PART=[SMOKE,SPARK];initSkids();initFlakes()}
function smokeTint(){const s=new THREE.Color(T.sky).multiplyScalar(T.hemiI*.9).add(new THREE.Color(T.sun).multiplyScalar(T.sunI*.18));return s}
let _st=new THREE.Color();
function fxSmoke(x,y,z,vx,vz,amt,dirt){if(R()>amt)return;const c=dirt?(TRK.def.biome==='winter'?[.9,.92,.96]:[.55,.47,.36]):[_st.r,_st.g,_st.b],a=dirt?.55:.42;
 SMOKE.emit(x+rr(-.2,.2),y+.15,z+rr(-.2,.2),vx*.35+rr(-.6,.6),rr(.3,1.2),vz*.35+rr(-.6,.6),rr(1.1,2.2)*(dirt?.7:1),rr(.5,.8),rr(2.6,4.2)*(dirt?.8:1),c[0],c[1],c[2],a*rr(.6,1),1.2,-.25)}
function fxSparks(x,y,z,n){for(let i=0;i<n;i++){const a=R()*TAU,s=rr(3,11);SPARK.emit(x,y,z,Math.cos(a)*s,rr(1,6),Math.sin(a)*s,rr(.2,.55),.08,.02,4,2.6,1.2,1,.6,9)}}
// ---- skid marks: a ring buffer of dark quads laid by the rear tyres ----
const SKID={max:5000,n:0,head:0};
function initSkids(){const n=SKID.max,g=new THREE.BufferGeometry();SKID.pos=new THREE.BufferAttribute(new Float32Array(n*4*3),3);SKID.al=new THREE.BufferAttribute(new Float32Array(n*4),1);
 [SKID.pos,SKID.al].forEach(a=>a.setUsage(THREE.DynamicDrawUsage));g.setAttribute('position',SKID.pos);g.setAttribute('al',SKID.al);const idx=new Uint32Array(n*6);for(let i=0;i<n;i++){const a=i*4;idx.set([a,a+1,a+2,a+1,a+3,a+2],i*6)}g.setIndex(new THREE.BufferAttribute(idx,1));
 const m=new THREE.ShaderMaterial({uniforms:{col:{value:new THREE.Color(.02,.02,.02)}},transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,
  vertexShader:'attribute float al;varying float vA;void main(){vA=al;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform vec3 col;varying float vA;void main(){gl_FragColor=vec4(col,vA);}'});
 SKID.mesh=new THREE.Mesh(g,m);SKID.mesh.frustumCulled=false;SKID.mesh.renderOrder=2;scene.add(SKID.mesh)}
function skidClear(){SKID.pos.array.fill(0);SKID.al.array.fill(0);SKID.pos.needsUpdate=SKID.al.needsUpdate=true}
function skidAdd(p0,p1,lat,w,a){const i=SKID.head;SKID.head=(i+1)%SKID.max;const P=SKID.pos.array,A=SKID.al.array,k=i*12;
 const hx=lat[0]*w/2,hz=lat[1]*w/2;P[k]=p0[0]-hx;P[k+1]=p0[1]+.02;P[k+2]=p0[2]-hz;P[k+3]=p0[0]+hx;P[k+4]=p0[1]+.02;P[k+5]=p0[2]+hz;P[k+6]=p1[0]-hx;P[k+7]=p1[1]+.02;P[k+8]=p1[2]-hz;P[k+9]=p1[0]+hx;P[k+10]=p1[1]+.02;P[k+11]=p1[2]+hz;
 A[i*4]=A[i*4+1]=A[i*4+2]=A[i*4+3]=a;SKID.pos.needsUpdate=SKID.al.needsUpdate=true}
// ---- snowfall around the camera ----
const FL={amount:0};
function initFlakes(){const n=3500;FL.n=n;FL.base=new Float32Array(n*4);for(let i=0;i<n*4;i++)FL.base[i]=R();const g=new THREE.BufferGeometry();FL.pos=new THREE.BufferAttribute(new Float32Array(n*3),3);FL.pos.setUsage(THREE.DynamicDrawUsage);g.setAttribute('position',FL.pos);
 FL.mat=new THREE.PointsMaterial({map:TX.puff,size:.12,transparent:true,depthWrite:false,opacity:.85,color:0xffffff});FL.pts=new THREE.Points(g,FL.mat);FL.pts.frustumCulled=false;scene.add(FL.pts)}
function updateFlakes(t,wx,wz){const amt=FL.amount;FL.pts.visible=amt>0;if(!amt)return;const n=Math.floor(FL.n*amt),B=40,P=FL.pos.array,cx=cam.position.x,cy=cam.position.y,cz=cam.position.z;
 for(let i=0;i<FL.n;i++){const k=i*3;if(i>=n){P[k+1]=-1e5;continue}const b=FL.base,j=i*4;let x=b[j]*B+wx*t+Math.sin(t*.7+b[j+3]*20)*.6,y=b[j+1]*B-t*(1.2+b[j+3]),z=b[j+2]*B+wz*t;
  x=((x-cx)%B+B*1.5)%B-B/2+cx;y=((y-cy)%B+B*1.5)%B-B/2+cy;z=((z-cz)%B+B*1.5)%B-B/2+cz;P[k]=x;P[k+1]=y;P[k+2]=z}FL.pos.needsUpdate=true}

// ================= RACE: grid, countdown, laps, positions, drift points, results =================
const RACE={on:false,mode:'race',cars:[],player:null,t:0,go:false,count:0,cd:0,laps:3,track:null,over:false,overT:0,finishOrder:[],ghost:null,rec:[],recT:0,
 contact(c,v,car){if(c.isPlayer){RACE.clean=0;if(v>5&&RACE.player.driftPts>0){RACE.player.driftPts=0;RACE.player.driftTime=0;HUDdrift(0,'lost')}}}};
function clearRace(){RACE.cars.forEach(removeCar);RACE.cars=[];RACE.player=null;if(RACE.ghost){scene.remove(RACE.ghost.root);RACE.ghost=null}skidClear();if(SMOKE){SMOKE.clear();SPARK.clear()}}
function startRace(track,mode){clearRace();RACE.mode=mode;RACE.track=track;RACE.laps=mode==='tt'?99:save.set.laps;
 const tod=save.set.tod==='track'?track.tod:save.set.tod;setTOD(tod);genTrack(track);FL.amount=T.snow||0;_st=smokeTint();
 const L=TRK.L,slot=k=>[L-10-k*8,(k%2?1:-1)*2.6];
 const pl=makeCar(carDef(),save.paint[carDef().id],7,true);RACE.player=pl;RACE.cars.push(pl);
 if(mode==='race'){const d=DIFF[save.set.diff],names=AINAMES.slice().sort(()=>R()-.5),pool=CARS.map(c=>c.id);
  for(let k=0;k<5;k++){const def=CARS.find(c=>c.id===pool[(k+1)%pool.length]),paint=(k*3+2)%PAINTS.length,c=makeCar(def,paint===save.paint[carDef().id]?paint+1:paint,k+1,false);
   aiInit(c,rr(d.sk[0],d.sk[1])-k*.006,names[k]);RACE.cars.push(c)}
  const order=[0,1,2,3,5,4];RACE.cars.forEach((c,i)=>{const [s,u]=slot(i===0?4:order[i-1]);placeCar(c,s,u)})}
 else{placeCar(pl,L-18,0);const g=save.rec[track.id]&&save.rec[track.id].ghost;if(g&&g.length>9){RACE.ghost=buildGhost(carDef());RACE.ghostData=g}}
 RACE.cars.forEach(c=>{c.lap=0;c.prog=c.s-L;c.lastS=c.s;c.cp=1;c.finished=false;c.laps=[];c.bestLap=0;c.nitro=.45;c.lapStart=0});
 RACE.t=0;RACE.go=false;RACE.cd=0;RACE.count=0;RACE.over=false;RACE.overT=0;RACE.finishOrder=[];RACE.clean=0;RACE.rec=[];RACE.recT=0;RACE.lastPos=6;RACE.score=0;RACE.on=true;
 gantryLights(0,false);treeLOD(pl.x,pl.z,true);camSnap();hudStart()}
// ghost for time trial: a translucent copy of the player's car
function buildGhost(def){const g=buildCarMesh(def,1,0),m=new THREE.MeshBasicMaterial({color:0x9fd4ff,transparent:true,opacity:.22,depthWrite:false});
 g.root.traverse(o=>{if(o.isMesh){o.material=m;o.castShadow=false}});scene.add(g.root);return g}
function updateRace(dt){const r=RACE;if(!r.on)return;const pl=r.player;
 // countdown: five reds, then lights out
 if(!r.go){r.cd+=dt;const n=Math.min(5,Math.floor(r.cd/.8));if(n!==r.count&&n>0&&r.cd<4.6){r.count=n;gantryLights(n,false);sfx('beep');HUDcount(n)}
  if(r.cd>=4.0+(r.goDelay||(r.goDelay=rr(.3,1)))){r.go=true;gantryLights(0,true);sfx('go');HUDcount(0);setTimeout(()=>gantryLights(0,false),2500)}}
 else r.t+=dt;
 for(const c of r.cars){c.hitCool-=dt;if(c.ghostT>0)c.ghostT-=dt;
  // laps: crossing the line forward after passing the far side of the circuit
  const L=TRK.L,s=c.s,ps=c.lastS;if(Math.abs(s-L/2)<L*.15)c.cp=1;
  if(ps>L*.8&&s<L*.2){if(c.cp){if(c.lap>=1){const lt=r.t-c.lapStart;c.laps.push(lt);if(!c.bestLap||lt<c.bestLap)c.bestLap=lt;if(c.isPlayer)onLap(lt)}c.lap++;c.lapStart=r.t;c.cp=0;
    if(c.lap>r.laps&&!c.finished){c.finished=true;c.finishT=r.t;r.finishOrder.push(c);if(c.isPlayer)playerFinished()}else if(c.isPlayer&&c.lap===r.laps&&r.laps>1&&r.mode==='race'){HUDmsg('Final lap',1.8,'gold');sfx('lap')}}}
  else if(ps<L*.2&&s>L*.8){c.lap--;c.cp=0}
  c.lastS=s;c.prog=c.lap>=1?(c.lap-1)*L+s:s-L}
 // standings
 const st=r.cars.slice().sort((a,b)=>{const fa=r.finishOrder.indexOf(a),fb=r.finishOrder.indexOf(b);if(fa>=0||fb>=0)return(fa<0?99:fa)-(fb<0?99:fb);return b.prog-a.prog});r.standing=st;
 const pos=st.indexOf(pl)+1;if(r.go&&r.mode==='race'&&pos<r.lastPos&&r.t>3){sfx('pass');pl.nitro=Math.min(1,pl.nitro+.06);HUDdrift(0,'pass')}r.lastPos=pos;r.pos=pos;
 // player extras: drift, slipstream, wrong way, ghost
 if(r.go&&!pl.finished){const sp=Math.hypot(pl.vx,pl.vz);
  const sliding=pl.grounded&&sp>11&&pl.slipR>.16&&pl.surface===0;if(sliding){pl.driftTime+=dt;pl.driftPts+=dt*sp*Math.min(pl.slipR,.7)*18;pl.nitro=Math.min(1,pl.nitro+dt*.07);pl.driftOff=0}
  else if(pl.driftPts>0){pl.driftOff=(pl.driftOff||0)+dt;if(pl.driftOff>.45){const pts=Math.round(pl.driftPts/10)*10;if(pts>=80){r.score+=pts;HUDdrift(pts,'bank')}pl.driftPts=0;pl.driftTime=0}}
  let draft=0;for(const o of r.cars){if(o===pl)continue;const ds=sDelta(pl.s,o.s);if(ds>3&&ds<16&&Math.abs(o.u-pl.u)<1.6&&sp>25)draft=1-ds/16}pl.draft=damp(pl.draft||0,draft,4,dt);if(pl.draft>.2)pl.nitro=Math.min(1,pl.nitro+dt*.03*pl.draft);
  const fwd=Math.cos(pl.th)*TRK.tx[pl.ti]+Math.sin(pl.th)*TRK.tz[pl.ti],mv=(pl.vx*TRK.tx[pl.ti]+pl.vz*TRK.tz[pl.ti]);pl.wrong=fwd<-.3&&mv<-3?(pl.wrong||0)+dt:0;
  if(r.mode==='tt'){r.recT+=dt;if(r.recT>=.1){r.recT-=.1;r.rec.push(+pl.x.toFixed(2),+pl.z.toFixed(2),+pl.th.toFixed(3))}}}
 if(r.ghost){const g=r.ghostData,lt=r.t-pl.lapStart,k=Math.floor(lt/.1)*3;if(pl.lap>=1&&k+5<g.length){const f=lt/.1%1,x=lerp(g[k],g[k+3],f),z=lerp(g[k+1],g[k+4],f),th=g[k+2]+wrapA(g[k+5]-g[k+2])*f;trackLocate(x,z,-1,_GQ);r.ghost.root.visible=true;r.ghost.root.position.set(x,surfY(_GQ,_GQ.u),z);r.ghost.root.rotation.set(0,-th,0)}else r.ghost.root.visible=false}
 if(r.over){r.overT+=dt}}
const _GQ={};
function onLap(lt){const r=RACE,rec=save.rec[r.track.id]||(save.rec[r.track.id]={});const best=!rec.lap||lt<rec.lap;
 if(best){rec.lap=lt;if(r.mode==='tt'&&r.rec.length>30){rec.ghost=r.rec.slice();r.ghostData=rec.ghost;if(!r.ghost)r.ghost=buildGhost(carDef())}store()}
 r.rec=[];r.recT=0;HUDlap(lt,best);sfx(best?'best':'lap')}
function playerFinished(){const r=RACE,pl=r.player,pos=r.finishOrder.indexOf(pl)+1;r.over=true;sfx('finish');HUDmsg(pos===1?'You win!':ordinal(pos)+' place',3,pos===1?'gold':'');
 const rec=save.rec[r.track.id]||(save.rec[r.track.id]={});if(!rec.race||pl.finishT<rec.race)rec.race=pl.finishT;if(!rec.pos||pos<rec.pos)rec.pos=pos;
 save.races++;const before=[unlocked('muscle'),unlocked('apex')];if(pos<=3)save.podium++;if(pos===1&&!save.wins.includes(r.track.id))save.wins.push(r.track.id);store();
 r.unlockMsg=[];if(!before[0]&&unlocked('muscle'))r.unlockMsg.push('Stallion 8 unlocked');if(!before[1]&&unlocked('apex'))r.unlockMsg.push('Apex P1 unlocked');
 setTimeout(()=>{if(RACE.on&&RACE.over)showResults()},3200)}
const ordinal=n=>n+(n===1?'st':n===2?'nd':n===3?'rd':'th');
function fmtT(t){if(!t||!isFinite(t))return'—';const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(2)}
// estimate where unfinished cars would end up once the player is done
function finalStandings(){const r=RACE,out=[];const L=TRK.L,tot=r.laps*L;
 for(const c of r.standing){let t=c.finishT;if(!c.finished){const left=tot-c.prog,v=Math.max(18,(c.prog+L)/Math.max(1,r.t));t=r.t+left/v}out.push({c,t,est:!c.finished})}
 out.sort((a,b)=>a.t-b.t);return out}

// ================= INPUT =================
const KEYS={},TOUCH={},INP={steer:0,thr:0,brk:0,hand:0,nitro:false};
const isTouch=matchMedia('(hover: none) and (pointer: coarse)').matches;
addEventListener('keydown',e=>{if(e.repeat&&KEYS[e.code])return;KEYS[e.code]=true;audioInit();
 if(e.code==='Escape'||e.code==='KeyP'){if(G.mode==='race')togglePause();else if(G.mode==='paused')togglePause()}
 if(G.mode==='race'){if(e.code==='KeyC')cycleCam();if(e.code==='KeyR')playerReset()}
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&G.mode==='race')e.preventDefault()});
addEventListener('keyup',e=>{KEYS[e.code]=false});
addEventListener('blur',()=>{for(const k in KEYS)KEYS[k]=false;if(G.mode==='race')togglePause()});
let padPrev={};
function readInput(dt){const k=KEYS;let st=(k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0),thr=k.KeyW||k.ArrowUp?1:0,brk=k.KeyS||k.ArrowDown?1:0,hand=k.Space?1:0,nit=!!(k.ShiftLeft||k.ShiftRight||k.KeyN);
 st+=(TOUCH.right?1:0)-(TOUCH.left?1:0);if(TOUCH.gas)thr=1;if(TOUCH.brake)brk=1;if(TOUCH.hand)hand=1;if(TOUCH.nitro)nit=true;
 let analog=false;const pads=navigator.getGamepads?navigator.getGamepads():[];
 for(const p of pads){if(!p)continue;const ax=p.axes[0]||0;if(Math.abs(ax)>.12){st=Math.sign(ax)*(Math.abs(ax)-.12)/.88;analog=true}const bt=i=>p.buttons[i]&&p.buttons[i].pressed,bv=i=>p.buttons[i]?p.buttons[i].value:0;
  if(bv(7)>.05)thr=Math.max(thr,bv(7));if(bv(6)>.05)brk=Math.max(brk,bv(6));if(bt(0))hand=1;if(bt(2)||bt(5))nit=true;if(bt(14))st-=1;if(bt(15))st+=1;
  const edge=i=>bt(i)&&!padPrev[i];if(edge(9)&&(G.mode==='race'||G.mode==='paused'))togglePause();if(edge(3)&&G.mode==='race')cycleCam();if(edge(1)&&G.mode==='race')playerReset();padPrev={};for(let i=0;i<17;i++)padPrev[i]=bt(i)}
 st=clamp(st,-1,1);INP.steer=analog?st:damp(INP.steer,st,st?(Math.sign(st)!==Math.sign(INP.steer)?14:7):10,dt);INP.thr=thr;INP.brk=brk;INP.hand=hand;INP.nitro=nit;return INP}
document.querySelectorAll('#touch [data-k]').forEach(b=>{const k=b.dataset.k;const on=e=>{e.preventDefault();TOUCH[k]=true;b.classList.add('on');audioInit()},off=e=>{e.preventDefault();TOUCH[k]=false;b.classList.remove('on')};
 b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});
if(isTouch)document.body.classList.add('touch');
// ================= HUD =================
const H={};['hud','pos','posN','lap','lapN','tCur','tBest','tTot','spd','unit','gear','rpm','nitroF','nitroB','map','msg','count','pops','drift','driftN','wrong','touch','rowBest','rowTot','lapBox'].forEach(i=>H[i]=$(i));
let msgT=0;const MAPC=H.map.getContext('2d');let mapCache=null;
function HUDmsg(t,dur,cls){H.msg.textContent=t;H.msg.className='on '+(cls||'');msgT=dur||1.5}
function HUDcount(n){H.count.className=n>0?'on':'go';H.count.querySelectorAll('i').forEach((l,k)=>l.classList.toggle('lit',n>0&&k<n));if(n===0)setTimeout(()=>{H.count.className=''},900)}
function HUDlap(t,best){const d=document.createElement('div');d.className='pop'+(best?' best':'');d.textContent=(best?'Best lap ':'Lap ')+fmtT(t);H.pops.appendChild(d);setTimeout(()=>d.remove(),2600)}
function HUDdrift(pts,kind){if(kind==='bank'){const d=document.createElement('div');d.className='pop drift';d.textContent='Drift +'+pts.toLocaleString();H.pops.appendChild(d);setTimeout(()=>d.remove(),2000)}
 else if(kind==='pass'){const d=document.createElement('div');d.className='pop pass';d.textContent='Overtake';H.pops.appendChild(d);setTimeout(()=>d.remove(),1400)}
 else if(kind==='lost'){H.drift.className=''}while(H.pops.children.length>3)H.pops.firstChild.remove()}
const spdK=()=>save.set.units==='mph'?2.237:3.6;
function hudStart(){const r=RACE;H.hud.classList.remove('hide');H.touch.classList.toggle('hide',!isTouch);H.pops.innerHTML='';H.msg.className='';
 H.lapBox.classList.toggle('hide',false);H.pos.parentElement.classList.toggle('hide',r.mode!=='race');H.lapN.textContent=r.mode==='race'?'/'+r.laps:'';H.unit.textContent=save.set.units==='mph'?'mph':'km/h';
 const rec=save.rec[r.track.id];H.tBest.textContent=fmtT(rec&&rec.lap);H.rowTot.classList.toggle('hide',r.mode!=='race');mapCache=null}
function hudUpdate(dt){const r=RACE,pl=r.player;if(!pl)return;
 H.posN.textContent=r.pos||'-';H.pos.dataset.n='/'+r.cars.length;H.lap.textContent=Math.max(1,Math.min(pl.lap,r.laps));
 H.tCur.textContent=fmtT(r.go&&pl.lap>=1?r.t-pl.lapStart:0);if(pl.bestLap){const rec=save.rec[r.track.id];H.tBest.textContent=fmtT(rec&&rec.lap)}H.tTot.textContent=fmtT(r.t);
 const sp=Math.hypot(pl.vx,pl.vz);H.spd.textContent=Math.round(sp*spdK());H.gear.textContent=(pl.vx*Math.cos(pl.th)+pl.vz*Math.sin(pl.th))<-.5&&pl.brk>0?'R':pl.gear;
 const rp=clamp((pl.rpm-800)/(7400-800),0,1);H.rpm.style.setProperty('--r',rp.toFixed(3));H.rpm.classList.toggle('red',pl.rpm>6900);
 H.nitroF.style.transform='scaleX('+pl.nitro.toFixed(3)+')';H.nitroB.classList.toggle('on',pl.nitroOn);
 if(pl.driftPts>40){H.drift.className='on';H.driftN.textContent=(Math.round(pl.driftPts/10)*10).toLocaleString()}else if(H.drift.className==='on')H.drift.className='';
 H.wrong.classList.toggle('on',(pl.wrong||0)>1.2);
 if(msgT>0){msgT-=dt;if(msgT<=0)H.msg.className=''}
 drawMap()}
function drawMap(){const cv=H.map,W=cv.width,Hh=cv.height,x=MAPC;const [mnx,mxx,mnz,mxz]=TRK.box,sc=Math.min((W-20)/(mxx-mnx),(Hh-20)/(mxz-mnz)),ox=W/2-(mnx+mxx)/2*sc,oz=Hh/2-(mnz+mxz)/2*sc;
 if(!mapCache){mapCache=document.createElement('canvas');mapCache.width=W;mapCache.height=Hh;const m=mapCache.getContext('2d');m.lineJoin='round';m.beginPath();for(let i=0;i<=TRK.N;i+=3){const k=i%TRK.N,px=TRK.px[k]*sc+ox,pz=TRK.pz[k]*sc+oz;i?m.lineTo(px,pz):m.moveTo(px,pz)}m.closePath();
  m.strokeStyle='rgba(10,12,16,.75)';m.lineWidth=9;m.stroke();m.strokeStyle='rgba(240,242,245,.92)';m.lineWidth=3.5;m.stroke();const sx=TRK.px[0]*sc+ox,sz=TRK.pz[0]*sc+oz;m.fillStyle='#ffd21f';m.fillRect(sx-4,sz-4,8,8)}
 x.clearRect(0,0,W,Hh);x.drawImage(mapCache,0,0);
 for(const c of RACE.cars){if(c===RACE.player)continue;x.fillStyle='#'+new THREE.Color(PAINTS[0].c).getHexString();x.beginPath();x.arc(c.x*sc+ox,c.z*sc+oz,4,0,TAU);x.fillStyle=c.mesh.mat.color.getStyle();x.fill();x.lineWidth=1.5;x.strokeStyle='#0b0d10';x.stroke()}
 const p=RACE.player,px=p.x*sc+ox,pz=p.z*sc+oz;x.save();x.translate(px,pz);x.rotate(p.th);x.fillStyle='#ffd21f';x.strokeStyle='#0b0d10';x.lineWidth=2;x.beginPath();x.moveTo(8,0);x.lineTo(-5,-5);x.lineTo(-2,0);x.lineTo(-5,5);x.closePath();x.stroke();x.fill();x.restore()}
// ================= MENUS =================
const SCREENS=['menu','setup','garage','records','settings','help','pause','results','loading'];let backTo='menu',setupMode='race',selTrack=0,garageSel=0;
function show(id){SCREENS.forEach(s=>$(s).classList.toggle('hide',s!==id));document.body.classList.toggle('inmenu',id!=='pause'&&id!=='results'&&id!=='loading'&&id!=null)}
function hideAll(){SCREENS.forEach(s=>$(s).classList.add('hide'));document.body.classList.remove('inmenu')}
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{sfx('click');if(backTo==='pause')show('pause');else{show('menu');menuView()}});
const click=(id,f)=>{$(id).onclick=()=>{audioInit();sfx('click');f()}};
click('bRace',()=>{setupMode='race';renderSetup();show('setup')});click('bTT',()=>{setupMode='tt';renderSetup();show('setup')});
click('bGarage',()=>{garageSel=Math.max(0,CARS.findIndex(c=>c.id===save.car));renderGarage();show('garage');garageView()});
click('bRec',()=>{renderRecords();show('records')});click('bSet',()=>{backTo='menu';loadSettings();show('settings')});click('bHelp',()=>{backTo='menu';show('help')});
// ---- race setup ----
const THUMBS={};
function trackThumb(t){if(THUMBS[t.id])return THUMBS[t.id];let rs=null;for(let k=0;k<2000&&!rs;k++)rs=layout(t,t.seed+k*7919);const c=document.createElement('canvas');c.width=240;c.height=150;const x=c.getContext('2d');
 if(rs){const P=rs.pts;let a=1e9,b=-1e9,cc=1e9,d=-1e9;P.forEach(p=>{a=Math.min(a,p[0]);b=Math.max(b,p[0]);cc=Math.min(cc,p[1]);d=Math.max(d,p[1])});const sc=Math.min(200/(b-a),110/(d-cc)),ox=120-(a+b)/2*sc,oz=75-(cc+d)/2*sc;
  x.lineJoin='round';x.beginPath();P.forEach((p,i)=>{i%4||(i?x.lineTo(p[0]*sc+ox,p[1]*sc+oz):x.moveTo(p[0]*sc+ox,p[1]*sc+oz))});x.closePath();x.strokeStyle='rgba(255,255,255,.18)';x.lineWidth=10;x.stroke();x.strokeStyle='#f3f4f6';x.lineWidth=3;x.stroke();
  x.fillStyle='#ffd21f';x.beginPath();x.arc(P[0][0]*sc+ox,P[0][1]*sc+oz,5,0,TAU);x.fill();t.len=rs.L}
 return THUMBS[t.id]=c}
function renderSetup(){$('setupTitle').textContent=setupMode==='race'?'Race':'Time trial';$('setupNote').textContent=setupMode==='race'?'Five rivals, a standing start, first to the flag.':'Just you and the clock. Beat your best lap and race its ghost.';
 const L=$('trackList');L.innerHTML='';TRACKS.forEach((t,i)=>{const b=document.createElement('button');b.className='tcard'+(i===selTrack?' sel':'');const th=trackThumb(t);const img=document.createElement('img');img.src=th.toDataURL();img.alt='';
  const rec=save.rec[t.id]||{};b.innerHTML='';b.appendChild(img);const h=document.createElement('div');h.className='tname';h.textContent=t.name;const m=document.createElement('div');m.className='tmeta';m.textContent=(t.len?(t.len/1000).toFixed(1)+' km, ':'')+TOD[t.tod].name+(save.wins.includes(t.id)?', won':'');
  const ds=document.createElement('p');ds.textContent=t.desc;const rr2=document.createElement('div');rr2.className='tmeta';rr2.textContent=rec.lap?'Best lap '+fmtT(rec.lap):'No lap set yet';b.append(h,m,ds,rr2);
  b.onclick=()=>{sfx('click');selTrack=i;renderSetup()};L.appendChild(b)});
 $('optRow').classList.toggle('tt',setupMode==='tt');
 const seg=(id,vals,cur,set)=>{const e=$(id);e.innerHTML='';vals.forEach(([v,lab])=>{const b=document.createElement('button');b.textContent=lab;b.className=v===cur?'on':'';b.onclick=()=>{sfx('click');set(v);store();renderSetup()};e.appendChild(b)})};
 seg('optTod',[['track','Track'],...TOD_KEYS.map(k=>[k,TOD[k].name])],save.set.tod,v=>save.set.tod=v);
 seg('optLaps',[[2,'2'],[3,'3'],[5,'5']],save.set.laps,v=>save.set.laps=v);seg('optDiff',DIFF.map((d,i)=>[i,d.n]),save.set.diff,v=>save.set.diff=v);
 $('setupCar').textContent=carDef().name+' in '+PAINTS[save.paint[carDef().id]].n}
click('bGo',()=>{launch(TRACKS[selTrack],setupMode)});click('setupGarage',()=>{garageSel=Math.max(0,CARS.findIndex(c=>c.id===save.car));renderGarage();show('garage');garageView();backTo='setup'});
function launch(t,mode){show('loading');$('loadName').textContent=t.name;requestAnimationFrame(()=>requestAnimationFrame(()=>{try{startRace(t,mode);hideAll();G.mode='race';Music.set(.2)}catch(e){console.error(e);$('err').className='';$('err').textContent='Could not build the track: '+e.message}}))}
// ---- garage ----
function renderGarage(){const L=$('carList');L.innerHTML='';CARS.forEach((c,i)=>{const b=document.createElement('button'),lock=!unlocked(c.id);b.className='ccard'+(i===garageSel?' sel':'')+(lock?' locked':'');
  b.innerHTML='<span class="cname"></span><span class="cdrive"></span>';b.querySelector('.cname').textContent=c.name;b.querySelector('.cdrive').textContent=lock?'Locked':c.drive+(c.id===save.car?', driving':'');
  b.onclick=()=>{sfx('click');garageSel=i;if(!lock){save.car=c.id;store()}renderGarage();garageView()};L.appendChild(b)});
 const c=CARS[garageSel],lock=!unlocked(c.id);$('cTitle').textContent=c.name;$('cDesc').textContent=lock?c.lockText:c.desc;
 const st=[['Power',c.power/520],['Grip',(c.grip-.85)/.3],['Top speed',c.top/92],['Brakes',(c.brake-.85)/.3],['Weight',c.mass/1700]];
 $('cStats').innerHTML='';st.forEach(([n,v])=>{const r=document.createElement('div');r.className='stat';r.innerHTML='<span></span><b><i></i></b>';r.firstChild.textContent=n;r.querySelector('i').style.width=(clamp(v,.08,1)*100)+'%';$('cStats').appendChild(r)});
 const P=$('paints');P.innerHTML='';PAINTS.forEach((p,i)=>{const b=document.createElement('button');b.className='sw'+(save.paint[c.id]===i?' on':'');b.style.background='#'+new THREE.Color(p.c).getHexString();b.title=p.n;b.setAttribute('aria-label',p.n);b.disabled=lock;
  b.onclick=()=>{sfx('click');save.paint[c.id]=i;store();renderGarage();garageView()};P.appendChild(b)});$('paintName').textContent=PAINTS[save.paint[c.id]].n}
$('garageBack').onclick=()=>{sfx('click');if(backTo==='setup'){backTo='menu';renderSetup();show('setup')}else{show('menu');menuView()}};
// ---- records ----
function renderRecords(){const d=$('recList');d.innerHTML='';TRACKS.forEach(t=>{const r=save.rec[t.id]||{},row=document.createElement('div');row.className='rrow';row.innerHTML='<b></b><span></span><span></span><span></span>';
 const s=row.querySelectorAll('span');row.querySelector('b').textContent=t.name;s[0].textContent='Best lap '+fmtT(r.lap);s[1].textContent='Best race '+fmtT(r.race);s[2].textContent=r.pos?'Best finish '+ordinal(r.pos):'Not raced yet';d.appendChild(row)});
 $('recSum').textContent=save.races?save.races+' race'+(save.races>1?'s':'')+' finished, '+save.podium+' podium'+(save.podium===1?'':'s')+', '+save.wins.length+' track'+(save.wins.length===1?'':'s')+' won':'Finish a race to start your record book.'}
// ---- settings ----
function loadSettings(){const s=save.set;$('sMaster').value=s.master;$('sMusic').value=s.music;$('sSfx').value=s.sfx;$('sQ').value=s.q;$('sUnits').value=s.units;$('sAssist').checked=!!s.assist;$('sShake').checked=!!s.shake}
['sMaster','sMusic','sSfx'].forEach(id=>$(id).oninput=()=>{save.set[{sMaster:'master',sMusic:'music',sSfx:'sfx'}[id]]=+$(id).value;setVol();store()});
$('sQ').onchange=()=>{save.set.q=+$('sQ').value;store();setupPost();if(TRK.ready)treeLOD(cam.position.x,cam.position.z,true)};$('sUnits').onchange=()=>{save.set.units=$('sUnits').value;store();H.unit.textContent=save.set.units==='mph'?'mph':'km/h'};
$('sAssist').onchange=()=>{save.set.assist=$('sAssist').checked?1:0;store()};$('sShake').onchange=()=>{save.set.shake=$('sShake').checked?1:0;store()};
// ---- pause and results ----
function togglePause(){if(G.mode==='race'){G.mode='paused';show('pause');$('pauseInfo').textContent=RACE.track.name+(RACE.mode==='race'?', lap '+Math.max(1,Math.min(RACE.player.lap,RACE.laps))+' of '+RACE.laps:', time trial');if(AU.ctx)AU.ctx.suspend()}
 else if(G.mode==='paused'){G.mode='race';hideAll();if(AU.ctx)AU.ctx.resume()}}
click('bResume',()=>togglePause());click('bRestart',()=>{if(AU.ctx)AU.ctx.resume();launch(RACE.track,RACE.mode)});click('bQuit',()=>{if(AU.ctx)AU.ctx.resume();toMenu()});
click('bPauseSet',()=>{backTo='pause';loadSettings();show('settings')});
function showResults(){G.mode='results';show('results');const r=RACE,fs=finalStandings(),pl=r.player,pos=fs.findIndex(e=>e.c===pl)+1;
 $('resTitle').textContent=pos===1?'Victory':ordinal(pos)+' place';$('resSub').textContent=r.track.name+', '+r.laps+' laps, '+DIFF[save.set.diff].n;
 const tb=$('resTable');tb.innerHTML='';fs.forEach((e,i)=>{const tr=document.createElement('tr');if(e.c===pl)tr.className='me';const c=e.c;
  [i+1,c.isPlayer?'You':c.ai.name,c.def.name,(e.est?'~':'')+fmtT(e.t),fmtT(c.bestLap)].forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.appendChild(td)});tb.appendChild(tr)});
 const notes=[];const rec=save.rec[r.track.id]||{};if(pl.bestLap&&rec.lap&&Math.abs(pl.bestLap-rec.lap)<1e-6)notes.push('New best lap');if(r.score>0)notes.push('Drift points '+r.score.toLocaleString());notes.push(...(r.unlockMsg||[]));$('resNotes').textContent=notes.join('. ')+(notes.length?'.':'')}
click('bAgain',()=>launch(RACE.track,RACE.mode));click('bNext',()=>{selTrack=(TRACKS.indexOf(RACE.track)+1)%TRACKS.length;launch(TRACKS[selTrack],RACE.mode)});click('bMenu',()=>toMenu());

// ================= CAMERA =================
const G={mode:'menu',t:0};
const CAMS={mode:save.set.cam|0,pos:new THREE.Vector3(),look:new THREE.Vector3(),yaw:0,fov:62,shake:0,orbit:0,hook:null};
const CAMNAMES=['Chase','Far chase','Hood','Bumper'];
function cycleCam(){CAMS.mode=(CAMS.mode+1)%4;save.set.cam=CAMS.mode;store();HUDmsg(CAMNAMES[CAMS.mode]+' camera',1)}
function camSnap(){const p=RACE.player;if(!p)return;CAMS.yaw=p.th;camFollow(1/60,true)}
const _cv=new THREE.Vector3();
function camFollow(dt,snap){const p=RACE.player;if(!p)return;const sp=Math.hypot(p.vx,p.vz),vh=sp>3?Math.atan2(p.vz,p.vx):p.th;
 let want=p.th+wrapA(vh-p.th)*clamp(sp/20,0,1)*.45;CAMS.yaw=snap?want:CAMS.yaw+wrapA(want-CAMS.yaw)*(1-Math.exp(-(p.grounded?4.2:1.5)*dt));
 const fx=Math.cos(CAMS.yaw),fz=Math.sin(CAMS.yaw),m=CAMS.mode;let fov;
 if(m<=1){const dist=(m?7.4:5.6)+sp*.012,h=(m?2.55:1.85)+sp*.004;const tx=p.x-fx*dist,tz=p.z-fz*dist;let ty=p.y+h;
  if(snap){CAMS.pos.set(tx,ty,tz);CAMS.by=ty}else{CAMS.pos.x=damp(CAMS.pos.x,tx,14,dt);CAMS.pos.z=damp(CAMS.pos.z,tz,14,dt);CAMS.by=damp(CAMS.by??ty,ty,p.grounded?9:4,dt)}
  // rise over a rival that is sitting where the camera wants to be
  let lf=0;for(const c of RACE.cars){if(c===p)continue;const d=Math.hypot(c.x-CAMS.pos.x,c.z-CAMS.pos.z);if(d<3.4)lf=Math.max(lf,(3.4-d)/3.4*1.4)}CAMS.lift=snap?lf:damp(CAMS.lift||0,lf,lf>(CAMS.lift||0)?9:2,dt);
  CAMS.pos.y=CAMS.by+CAMS.lift;const gh=terrainH(CAMS.pos.x,CAMS.pos.z)+.7;if(CAMS.pos.y<gh){CAMS.pos.y=gh;CAMS.by=Math.max(CAMS.by,gh-CAMS.lift)}
  CAMS.look.set(p.x+fx*3.2,p.y+1.05+(m?.25:0),p.z+fz*3.2);fov=60+clamp(sp-10,0,60)*.3}
 else{const cs=Math.cos(p.th),sn=Math.sin(p.th),S=p.def.shape,fwd=m===2?S.L*.12:S.L/2+.05,h=m===2?S.hood+.18:.62;
  const q=p.mesh.root.quaternion;_cv.set(fwd,h,0).applyQuaternion(q);CAMS.pos.set(p.x+_cv.x,p.y+_cv.y,p.z+_cv.z);_cv.set(fwd+20,h-.6,0).applyQuaternion(q);CAMS.look.set(p.x+_cv.x,p.y+_cv.y,p.z+_cv.z);fov=66+clamp(sp-10,0,60)*.22}
 if(p.nitroOn)fov+=7;CAMS.fov=snap?fov:damp(CAMS.fov,fov,3,dt)}
function camApply(dt){if(CAMS.hook)CAMS.hook();cam.position.copy(CAMS.pos);cam.lookAt(CAMS.look);
 const p=RACE.player;let sk=CAMS.shake;if(p&&G.mode==='race'){const sp=Math.hypot(p.vx,p.vz);sk+=(p.surface?.05:0)*sp/30+(p.curb?.04:0)+clamp((sp-45)/60,0,.03)}
 if(sk>0&&save.set.shake){cam.rotation.x+=(R()-.5)*sk*.05;cam.rotation.y+=(R()-.5)*sk*.05;cam.position.y+=(R()-.5)*sk*.08}CAMS.shake=Math.max(0,CAMS.shake-dt*1.8);
 if(Math.abs(cam.fov-CAMS.fov)>.05){cam.fov=CAMS.fov;cam.updateProjectionMatrix();if(PART)PART.forEach(p=>p.mat.uniforms.scale.value=PP.rt.height/(2*Math.tan(cam.fov*PI/360)))}}
// ================= CAR VISUALS =================
const _q1=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_ax=new THREE.Vector3(),_LV={},_LV2={};
function carVisual(c,dt){const m=c.mesh,S=c.def.shape,cs=Math.cos(c.th),sn=Math.sin(c.th),hl=S.L*.42,hw=S.W*.42;
 let pitch=c.vpitch||0,roll=c.vroll||0;
 if(c.grounded){const hy=(dx,dz)=>{trackLocate(c.x+dx,c.z+dz,c.ti,_LV);return surfY(_LV,clamp(_LV.u,-(TRK.W+TRK.RAIL),TRK.W+TRK.RAIL))};
  const f=hy(cs*hl,sn*hl),b=hy(-cs*hl,-sn*hl),l=hy(sn*hw,-cs*hw),r=hy(-sn*hw,cs*hw);pitch=Math.atan2(f-b,hl*2);roll=Math.atan2(l-r,hw*2)}
 else pitch=damp(pitch,Math.atan2(c.vyv,Math.max(8,Math.hypot(c.vx,c.vz)))*.6,1.5,dt);
 c.vpitch=pitch;c.vroll=roll;
 // suspension: springs on pitch, roll and heave
 const kp=60,cdmp=9;c.pv+=((-c.axl*.011)-c.pitch)*kp*dt-c.pv*cdmp*dt;c.pitch+=c.pv*dt;c.rv+=((c.ayl*.012)-c.roll)*kp*dt-c.rv*cdmp*dt;c.roll+=c.rv*dt;c.hv+=(-c.heave)*90*dt-c.hv*10*dt;c.heave+=c.hv*dt;
 m.root.position.set(c.x,c.y,c.z);_q1.setFromAxisAngle(_ax.set(0,1,0),-c.th);_q2.setFromAxisAngle(_ax.set(0,0,1),pitch);_q1.multiply(_q2);_q2.setFromAxisAngle(_ax.set(1,0,0),roll);_q1.multiply(_q2);m.root.quaternion.copy(_q1);
 m.body.rotation.set(c.roll*.9,0,c.pitch*.9+(c.isPlayer||1?0:0));m.body.position.y=c.heave*.5+Math.sin(G.t*40+c.num)*(c.surface?.012:0)*Math.min(1,Math.hypot(c.vx,c.vz)/10);
 const vx=c.vx*cs+c.vz*sn;c.wheelSpin-=vx/c.rw*dt*(c.hand>.1&&c.grounded?.0:1);
 for(const w of m.wheels){w.spin.rotation.z=c.wheelSpin*(w.side<0?-1:1)*(w.side<0?-1:1);if(w.front)w.piv.rotation.y=-c.steer}
 m.shadow.position.set(c.x,(c.grounded?c.y:c.y-Math.min(3,(c.y-(c.gy||c.y))))+.04,c.z);m.shadow.rotation.set(-PI/2,0,0);m.shadow.rotation.order='YXZ';m.shadow.rotation.y=-c.th;
 m.shadow.material.opacity=c.grounded?.78:.4;
 const U=m.mat.userData.u;U.brake.value=damp(U.brake.value,c.brk>.05&&c.vx*cs+c.vz*sn>.5?1:0,18,dt);U.head.value=T.head}
// ================= PLAYER HEADLIGHTS (night) =================
const HEAD=new THREE.SpotLight(0xfff2dc,0,120,.42,.55,1.3);HEAD.castShadow=false;scene.add(HEAD,HEAD.target);
function headUpdate(){const p=RACE.player;if(!p||!T.head){HEAD.intensity=0;return}const S=p.def.shape,cs=Math.cos(p.th),sn=Math.sin(p.th);
 HEAD.position.set(p.x+cs*S.L*.5,p.y+.7,p.z+sn*S.L*.5);HEAD.target.position.set(p.x+cs*30,p.y-1.2,p.z+sn*30);HEAD.intensity=60*T.head}
// ================= AUDIO + EFFECTS PER FRAME =================
const CYL={gt:8,rally:4,muscle:8,apex:10};
function audioUpdate(dt){if(!AU.ctx||!AU.eng)return;const p=RACE.player,live=G.mode==='race'||G.mode==='results'||(G.mode==='menu'&&p);
 if(!p||!live){AU.eng.set(800,0,8,0);AU.eng2.set(800,0,8,0);['wind','screech','screech2','gravel','scrape','road'].forEach(n=>loopSet(n,0));return}
 const sp=Math.hypot(p.vx,p.vz),load=clamp(p.thr*.85+(p.nitroOn?.3:0),0,1);AU.eng.set(p.rpm,load,CYL[p.def.id],G.mode==='menu'?.6:1);
 let nb=null,nd=1e9;for(const c of RACE.cars){if(c===p)continue;const d=Math.hypot(c.x-p.x,c.z-p.z);if(d<nd){nd=d;nb=c}}
 if(nb)AU.eng2.set(nb.rpm,clamp(nb.thr,0,1),CYL[nb.def.id],clamp(1-nd/70,0,1)*.9);else AU.eng2.set(800,0,8,0);
 const sl=p.grounded&&p.surface===0?clamp(Math.max(p.slipR-.1,p.slipF-.12,(p.brk>.8&&sp>8?.1:0))*2.2,0,1)*clamp(sp/10,0,1):0;
 loopSet('screech',sl*.32,1300+sl*500+Math.sin(G.t*9)*80);loopSet('screech2',sl*.12,2400+sl*300);loopSet('wind',clamp(sp/70,0,1)**2*.32,500+sp*18);
 loopSet('gravel',p.grounded&&p.surface?clamp(sp/25,0,1)*.6:0,300+sp*6);loopSet('road',p.grounded?clamp(sp/40,0,1)*.22:0,90+sp*2);loopSet('scrape',p.scrape*.4,2600)}
const SKL=new Map();
function carFX(c,dt){const sp=Math.hypot(c.vx,c.vz);if(!c.grounded||sp<2){SKL.delete(c);return}const cs=Math.cos(c.th),sn=Math.sin(c.th),S=c.def.shape,b=c.mesh.b,hw=S.W*.4;
 const rear=[[c.x-cs*b-sn*hw,c.z-sn*b+cs*hw],[c.x-cs*b+sn*hw,c.z-sn*b-cs*hw]];
 const slide=c.surface===0?clamp((c.slipR-.13)*3,0,1)+(c.hand>.1&&sp>6?.5:0)+(c.brk>.85&&sp>14?.25:0):0;
 if(slide>.05){for(const [x,z] of rear)fxSmoke(x,c.y,z,c.vx,c.vz,clamp(slide*.9,0,1)*(save.set.q?1:.5),false);
  const prev=SKL.get(c);if(prev){for(let k=0;k<2;k++){const a=prev[k],bq=[rear[k][0],c.y,rear[k][1]];const d=Math.hypot(bq[0]-a[0],bq[2]-a[2]);if(d>.4&&d<6)skidAdd(a,bq,[-sn,cs],.24,clamp(slide*.55,.1,.6))}
   if(Math.hypot(rear[0][0]-prev[0][0],rear[0][1]-prev[0][2])>.4)SKL.set(c,[[rear[0][0],c.y,rear[0][1]],[rear[1][0],c.y,rear[1][1]]])}else SKL.set(c,[[rear[0][0],c.y,rear[0][1]],[rear[1][0],c.y,rear[1][1]]])}
 else SKL.delete(c);
 if(c.surface&&sp>5)for(const [x,z] of rear)fxSmoke(x,c.y,z,c.vx,c.vz,clamp(sp/30,0,1)*.8,true);
 if(c.nitroOn&&R()<.8){const ex=c.x-cs*S.L*.5,ez=c.z-sn*S.L*.5;SPARK.emit(ex+rr(-.2,.2),c.y+.32,ez+rr(-.2,.2),c.vx*.85-cs*4,0,c.vz*.85-sn*4,rr(.06,.13),.35,.1,.6,1.2,4,1,0,0)}}
// ================= MENU BACKDROP =================
function menuCar(){const def=CARS[garageSel]||carDef();if(RACE.player&&RACE.player.def===def&&RACE.player.mesh.paintIdx===save.paint[def.id])return;
 RACE.cars.forEach(removeCar);const c=makeCar(def,save.paint[def.id],7,true);c.mesh.paintIdx=save.paint[def.id];RACE.player=c;RACE.cars=[c];placeCar(c,TRK.L-14,0);c.ti=wrapI(Math.round((TRK.L-14)/TRK.DS));carVisual(c,.016)}
function toMenu(){clearRace();RACE.on=false;G.mode='menu';H.hud.classList.add('hide');H.touch.classList.add('hide');show('menu');Music.set(.6);if(AU.ctx&&AU.ctx.state==='suspended')AU.ctx.resume();menuScene()}
function menuScene(){const t=TRACKS[0];if(!TRK.ready||TRK.def!==t){setTOD(t.tod);genTrack(t);FL.amount=0;_st=smokeTint()}garageSel=Math.max(0,CARS.findIndex(c=>c.id===carDef().id));menuCar();treeLOD(RACE.player.x,RACE.player.z,true);gantryLights(0,false);menuView()}
let viewMode='menu';function menuView(){viewMode='menu'}function garageView(){viewMode='garage';menuCar()}
function menuCam(dt){const p=RACE.player;if(!p)return;CAMS.orbit+=dt*(viewMode==='garage'?.16:.07);const a=CAMS.orbit,d=viewMode==='garage'?6.4:8.5,h=viewMode==='garage'?1.6:2.1;
 const cx=p.x+Math.cos(a+p.th)*d,cz=p.z+Math.sin(a+p.th)*d;CAMS.pos.set(cx,Math.max(p.y+h,terrainH(cx,cz)+.8),cz);
 const side=viewMode==='garage'?0:2.3;CAMS.look.set(p.x-Math.sin(a+p.th)*side*.0,p.y+.65,p.z);CAMS.fov=damp(CAMS.fov,viewMode==='garage'?40:46,3,dt);
 if(innerWidth>820){const dx=p.x-CAMS.pos.x,dz=p.z-CAMS.pos.z,l=Math.hypot(dx,dz)||1,k=viewMode==='garage'?1.6:2.6;CAMS.look.x-=-dz/l*k;CAMS.look.z-=dx/l*k}}
// ================= MAIN LOOP =================
let last=performance.now(),FORCE=null;
function loop(now){requestAnimationFrame(loop);const dt=Math.min(.05,(now-last)/1000);last=now;try{step(dt)}catch(e){console.error(e);$('err').className='';$('err').textContent='Something went wrong: '+e.message}}
function physicsTick(dt){const r=RACE,pl=r.player;const inp=FORCE||readInput(dt);
 if(pl){if(pl.finished||window.__autopilot){if(!pl.ai)aiInit(pl,pl.finished?.72:(window.__autopilot||.95),'You');aiDrive(pl,r.cars,dt,r)}else{pl.inSteer=inp.steer;pl.thr=inp.thr;pl.brk=inp.brk;pl.hand=inp.hand;if(inp.nitro&&!pl.nitroOn&&pl.nitro>.08&&r.go){pl.nitroOn=true;sfx('nitro')}if(!inp.nitro)pl.nitroOn=false}}
 for(const c of r.cars)if(c.ai&&!c.isPlayer)aiDrive(c,r.cars,dt,r);
 if(!r.go){for(const c of r.cars){c.brk=1;c.hand=1;c.nitroOn=false;c.vx=c.vz=0;c.r=0}}
 const n=Math.max(1,Math.min(8,Math.ceil(dt/PDT))),h=dt/n;
 for(let k=0;k<n;k++){for(const c of r.cars){stepCar(c,h,r);if(!r.go){c.vx=c.vz=0}}for(let i=0;i<r.cars.length;i++)for(let j=i+1;j<r.cars.length;j++){const a=r.cars[i],b=r.cars[j];if((a.ghostT||0)>0||(b.ghostT||0)>0)continue;carCollide(a,b,r)}}
 if(pl&&!pl.finished&&r.go){if(pl.ghostT>0){}}
 updateRace(dt)}
function playerReset(){const p=RACE.player;if(!p||!RACE.go||p.finished)return;respawnCar(p);HUDmsg('Back on the road',1);camSnap()}
function step(dt){G.t+=dt;const t=G.t;
 if(G.mode==='race'||G.mode==='results'){physicsTick(dt);camFollow(dt);hudUpdate(dt)}
 else if(G.mode==='menu'){const p=RACE.player;if(p){p.thr=0;p.rpm=damp(p.rpm,950+Math.sin(t*.7)*40,3,dt)}menuCam(dt)}
 for(const c of RACE.cars){carVisual(c,dt);if(G.mode!=='paused')carFX(c,dt)}
 if(G.mode!=='paused'){SMOKE.update(dt);SPARK.update(dt);updateFlakes(t,1.2,.6)}
 headUpdate();audioUpdate(dt);
 const p=RACE.player;if(p){treeLOD(p.x,p.z,false);sun.position.set(p.x+sunVec.x*220,p.y+sunVec.y*220,p.z+sunVec.z*220);sun.target.position.set(p.x,p.y,p.z);sun.target.updateMatrixWorld()}
 camApply(dt);sky.position.copy(cam.position);skyU.camPos.value.copy(cam.position);skyU.time.value=t;if(farMts)farMts.position.set(cam.position.x,0,cam.position.z);
 if(MAT.treeCard)MAT.treeCard.userData.u.time.value=t;if(MAT.water)MAT.water.userData.u.time.value=t;
 renderFrame()}
// fixed-step simulation for tests
function sim(sec,inp){FORCE=inp||null;const n=Math.round(sec*60);for(let i=0;i<n;i++){if(G.mode==='race'||G.mode==='results')physicsTick(1/60);for(const c of RACE.cars)carVisual(c,1/60)}}
// ================= START =================
function init(){makeTextures();setupPost();addEventListener('resize',setupPost);initFX();
 TRACKS.forEach(trackThumb);menuScene();show('menu');requestAnimationFrame(loop);
 window.__SW={G,RACE,TRK,CARS,TRACKS,CAMS,save,sim,step,startRace:(i,m)=>{startRace(TRACKS[i],m||'race');hideAll();G.mode='race'},toMenu,setForce:f=>{FORCE=f},setTOD,treeLOD,trackLocate,surfY,terrainH,carVisual,camFollow,renderFrame,PP,ren,scene,sun,showResults}}
try{if(!window.THREE)throw new Error('3D engine missing');init()}catch(e){console.error(e);const b=$('err');b.className='';b.textContent=(e.message==='3D engine missing'?'Couldn’t load the 3D engine. Check your internet connection and reload.':'Your browser couldn’t start the game ('+e.message+').')}
})();

