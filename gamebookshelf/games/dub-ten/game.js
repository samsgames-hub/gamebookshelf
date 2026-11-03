/* DUB TEN — a freeski park game. Kickers, rails, a superpipe and a big air; spins, flips, corks and grabs scored as lines.
   Three.js r128. Every model, texture and sound is generated at load. */
(()=>{'use strict';
const $=id=>document.getElementById(id),R=Math.random,rr=(a,b)=>a+R()*(b-a),ri=n=>R()*n|0,pick=a=>a[R()*a.length|0],clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
const TAU=Math.PI*2,PI=Math.PI,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const wrapA=a=>{a=(a+PI)%TAU;if(a<0)a+=TAU;return a-PI};
const smin=(a,b,k)=>{const h=clamp(.5+.5*(b-a)/k,0,1);return lerp(b,a,h)-k*h*(1-h)};
// ---------------- deterministic noise ----------------
const hash2=(x,y,s)=>{let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,982451653))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
function vn2(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const fmt=n=>Math.round(n).toLocaleString('en-US');
// ---------------- GEAR (looks only: nothing here changes how the rider skis) ----------------
const JACKETS=[
 {id:'j0',name:'Fog',c:0xd7dde4,c2:0x8b95a3,cost:0},{id:'j1',name:'Safety',c:0xff6a1f,c2:0x1d2433,cost:0},{id:'j2',name:'Glacier',c:0x2f7de1,c2:0xe9eef5,cost:0},
 {id:'j3',name:'Moss',c:0x5d6b3a,c2:0xd9c79a,cost:600},{id:'j4',name:'Bubblegum',c:0xf27fb2,c2:0x2a2440,cost:900},{id:'j5',name:'Highlighter',c:0xd8f23a,c2:0x1b1f27,cost:1200},
 {id:'j6',name:'Oxblood',c:0x7a1f2b,c2:0xf0e6d8,cost:1500},{id:'j7',name:'Midnight',c:0x1b2236,c2:0x5ec8ff,cost:2200},{id:'j8',name:'Camo snow',c:0xe9ecef,c2:0x8f9aa6,cost:3000,pat:'camo'},
 {id:'j9',name:'Sunset fade',c:0xff9a3c,c2:0x7b3fd0,cost:4500,pat:'fade'},{id:'j10',name:'Gold medal',c:0xe8b53a,c2:0x1d1d1d,cost:9000}];
const PANTS=[
 {id:'p0',name:'Charcoal',c:0x1f2229,cost:0},{id:'p1',name:'Sand',c:0xcdb894,cost:0},{id:'p2',name:'Olive',c:0x4b5434,cost:400},{id:'p3',name:'White',c:0xeceff2,cost:800},
 {id:'p4',name:'Navy',c:0x1e2a48,cost:800},{id:'p5',name:'Plaid red',c:0xa8272e,cost:1600,pat:'plaid'},{id:'p6',name:'Lilac',c:0xb7a4e8,cost:1800}];
const HEADS=[
 {id:'h0',name:'Park helmet',kind:'helmet',c:0x15171c,cost:0},{id:'h1',name:'White helmet',kind:'helmet',c:0xf1f2f4,cost:0},{id:'h2',name:'Orange beanie',kind:'beanie',c:0xff6a1f,cost:300},
 {id:'h3',name:'Grey beanie',kind:'beanie',c:0x8f97a3,cost:300},{id:'h4',name:'Teal helmet',kind:'helmet',c:0x1aa39a,cost:900},{id:'h5',name:'Chrome helmet',kind:'helmet',c:0xc9d1da,cost:2600,chrome:1}];
const LENSES=[{id:'l0',name:'Fire',c:0xff8a2a,cost:0},{id:'l1',name:'Ice',c:0x5ec8ff,cost:0},{id:'l2',name:'Smoke',c:0x30343a,cost:300},{id:'l3',name:'Rose',c:0xff5aa0,cost:600},{id:'l4',name:'Emerald',c:0x2fd17a,cost:900}];
const SKIS=[
 {id:'s0',name:'Stock twin',base:0xf0f0f0,a:0x1d2433,b:0xff6a1f,art:'stripe',cost:0},{id:'s1',name:'Night lane',base:0x15171c,a:0x5ec8ff,b:0xffffff,art:'chev',cost:0},
 {id:'s2',name:'Wood core',base:0xb07a45,a:0x3b2414,b:0xf2e2c4,art:'wood',cost:700},{id:'s3',name:'Dye job',base:0xffffff,a:0x1e5bff,b:0x1e5bff,art:'drip',cost:1400},
 {id:'s4',name:'Peaks',base:0x203a5c,a:0xffffff,b:0xffc93c,art:'peaks',cost:2000},{id:'s5',name:'Check',base:0xf2f2f2,a:0x111111,b:0xff3b3b,art:'check',cost:3200},{id:'s6',name:'Molten',base:0x1a0d08,a:0xff5a1f,b:0xffd23f,art:'flame',cost:6000}];
const GEAR={jacket:JACKETS,pants:PANTS,head:HEADS,lens:LENSES,ski:SKIS};
// ---------------- KEYS (rebindable) ----------------
const ACTIONS=[
 ['left','Carve left, spin left','KeyA'],['right','Carve right, spin right','KeyD'],['fwd','Tuck, frontflip','KeyW'],['back','Brake, backflip','KeyS'],
 ['rollL','Air roll left','ArrowLeft'],['rollR','Air roll right','ArrowRight'],['rodeo','Rodeo (spin and flip)','ArrowUp'],
 ['pop','Load and pop','Space'],['mute','Mute grab','ShiftLeft'],['tail','Tail grab','KeyQ'],['japan','Japan grab','KeyE'],['butter','Butter','KeyB'],
 ['skip','Skip the lift','KeyF'],['restart','Restart (hold)','KeyR'],['cam','Camera','KeyC'],['pause','Pause','Escape']];
const DEFKEYS={};ACTIONS.forEach(a=>DEFKEYS[a[0]]=a[2]);
// ---------------- SAVE ----------------
const SAVEKEY='dubten1';
const DEF={tickets:0,runs:0,airTime:0,bestTrick:{pts:0,name:''},parks:{},
 look:{jacket:'j1',pants:'p0',head:'h0',lens:'l0',ski:'s0',poles:1},own:['j0','j1','j2','p0','p1','h0','h1','l0','l1','s0','s1'],
 keys:Object.assign({},DEFKEYS),seenHelp:0,
 set:{master:8,music:5,sfx:8,q:2,qa:true,fov:74,camDist:1,camH:1,units:'kmh',shake:1,mute:0,hints:true,assist:true,fpCam:false}};
let save=JSON.parse(JSON.stringify(DEF));
try{const s=JSON.parse(localStorage.getItem(SAVEKEY)||'{}');if(s&&typeof s==='object'){
 for(const k of['tickets','runs','airTime'])if(Number.isFinite(s[k]))save[k]=Math.max(0,+s[k]);
 if(s.bestTrick&&Number.isFinite(s.bestTrick.pts))save.bestTrick={pts:+s.bestTrick.pts,name:String(s.bestTrick.name||'').slice(0,80)};
 if(s.parks&&typeof s.parks==='object')for(const k in s.parks){const p=s.parks[k];if(p&&Number.isFinite(p.best))save.parks[k]={best:+p.best,runs:+p.runs||0,trick:String(p.trick||'').slice(0,80),trickPts:+p.trickPts||0}}
 if(Array.isArray(s.own))save.own=[...new Set(DEF.own.concat(s.own.filter(x=>typeof x==='string')))];
 if(s.look&&typeof s.look==='object')for(const k in DEF.look){const v=s.look[k];if(k==='poles')save.look.poles=v?1:0;else if(GEAR[k]&&GEAR[k].some(g=>g.id===v)&&save.own.includes(v))save.look[k]=v}
 if(s.keys&&typeof s.keys==='object')for(const k in DEFKEYS)if(typeof s.keys[k]==='string'&&s.keys[k].length<24)save.keys[k]=s.keys[k];
 save.seenHelp=s.seenHelp?1:0;
 if(s.set&&typeof s.set==='object')for(const k in DEF.set)if(k in s.set&&typeof s.set[k]===typeof DEF.set[k])save.set[k]=s.set[k]}}catch(e){}
save.set.q=clamp(save.set.q|0,0,2);save.set.fov=clamp(save.set.fov,60,95);save.set.camDist=clamp(save.set.camDist,.7,1.5);save.set.camH=clamp(save.set.camH,.6,1.6);
const store=()=>{try{localStorage.setItem(SAVEKEY,JSON.stringify(save))}catch(e){}};
const gear=(k)=>GEAR[k].find(g=>g.id===save.look[k])||GEAR[k][0];
const isTouch=(()=>{try{return matchMedia('(hover: none) and (pointer: coarse)').matches}catch(e){return false}})();
// ---------------- AUDIO ----------------
const AU={ctx:null,loops:{}};
function audioInit(){if(AU.ctx){if(AU.ctx.state==='suspended')AU.ctx.resume();return}try{const C=new(window.AudioContext||window.webkitAudioContext)();AU.ctx=C;
 const comp=C.createDynamicsCompressor();comp.threshold.value=-15;comp.ratio.value=3.2;comp.connect(C.destination);
 AU.master=C.createGain();AU.master.connect(comp);AU.sfx=C.createGain();AU.sfx.connect(AU.master);AU.mus=C.createGain();AU.mus.connect(AU.master);
 const len=C.sampleRate*2.6|0,ir=C.createBuffer(2,len,C.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(R()*2-1)*Math.pow(1-i/len,3.2)}
 AU.verb=C.createConvolver();AU.verb.buffer=ir;AU.send=C.createGain();AU.send.gain.value=.28;AU.send.connect(AU.verb);AU.verb.connect(AU.master);
 const nb=C.createBuffer(1,C.sampleRate*3,C.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=R()*2-1;AU.noise=nb;
 let b0=0,b1=0,b2=0;const pb=C.createBuffer(1,C.sampleRate*4,C.sampleRate),pd=pb.getChannelData(0);for(let i=0;i<pd.length;i++){const w=R()*2-1;b0=.99765*b0+w*.099;b1=.963*b1+w*.2965;b2=.57*b2+w*1.0526;pd[i]=(b0+b1+b2+w*.1848)*.18}AU.pink=pb;
 const bb=C.createBuffer(1,C.sampleRate*4,C.sampleRate),bd=bb.getChannelData(0);let l=0;for(let i=0;i<bd.length;i++){l=(l+.02*(R()*2-1))/1.02;bd[i]=l*3.2}AU.brown=bb;
 // grind: noise through a comb of metal resonances
 const loop=(buf,type,f,q,dest)=>{const s=C.createBufferSource();s.buffer=buf;s.loop=true;const fl=C.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=C.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(dest||AU.sfx);s.start(0,R()*2);return{s,f:fl,g}};
 AU.loops.wind=loop(AU.pink,'bandpass',420,.7);AU.loops.carve=loop(AU.noise,'bandpass',2600,1.1);AU.loops.skid=loop(AU.pink,'bandpass',900,.9);AU.loops.hiss=loop(AU.pink,'lowpass',1400,.5);
 const gr=loop(AU.noise,'bandpass',2100,9);const gr2=C.createBiquadFilter();gr2.type='peaking';gr2.frequency.value=3400;gr2.Q.value=12;gr2.gain.value=14;gr.f.disconnect();gr.f.connect(gr2);gr2.connect(gr.g);AU.loops.grind=gr;
 AU.loops.box=loop(AU.pink,'bandpass',700,2.2);AU.loops.crowd=loop(AU.pink,'bandpass',1100,.6);
 setVol();Music.start()}catch(e){AU.ctx=null}}
function setVol(){if(!AU.ctx)return;const s=save.set,t=AU.ctx.currentTime;AU.master.gain.setTargetAtTime(s.mute?0:s.master/10,t,.05);AU.sfx.gain.setTargetAtTime(s.sfx/10,t,.05);AU.mus.gain.setTargetAtTime(s.music/10*.55,t,.05)}
function loopSet(n,gain,freq,k){const L=AU.loops[n];if(!L||!AU.ctx)return;const t=AU.ctx.currentTime;L.g.gain.setTargetAtTime(gain,t,k||.06);if(freq&&L.f)L.f.frequency.setTargetAtTime(freq,t,k||.06)}
function out(g,v){g.connect(AU.sfx);if(v){const s=AU.ctx.createGain();s.gain.value=v;g.connect(s);s.connect(AU.send)}}
function tone(f,d,type,vol,f2,o={}){const C=AU.ctx;if(!C)return;const t=C.currentTime+(o.at||0),os=C.createOscillator(),g=C.createGain();os.type=type||'sine';os.frequency.setValueAtTime(f,t);if(f2)os.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+d);
 if(o.det)os.detune.value=o.det;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(o.a||.004));g.gain.exponentialRampToValueAtTime(.0001,t+d);os.connect(g);out(g,o.wet??.3);os.start(t);os.stop(t+d+.05)}
function noise(d,vol,ft,f0,f1,q,o={}){const C=AU.ctx;if(!C)return;const t=C.currentTime+(o.at||0),s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain();s.buffer=o.buf||AU.noise;s.playbackRate.value=o.rate||1;
 f.type=ft;f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+d);f.Q.value=q||1;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(o.a||.003));g.gain.exponentialRampToValueAtTime(.0001,t+d);
 s.connect(f);f.connect(g);out(g,o.wet??.3);s.start(t,R()*1.5);s.stop(t+d+.05)}
const nf=n=>440*Math.pow(2,(n-69)/12);
const SFX={
 pop(k){k=clamp(k||.6,.2,1.2);noise(.16,.42*k,'bandpass',900,2600,1.3,{wet:.06});tone(150,.12,'sine',.25*k,70,{wet:0})},
 load(){noise(.25,.12,'lowpass',600,300,.7,{wet:0,buf:AU.pink})},
 land(k){k=clamp(k||.5,.15,1.6);tone(64,.22,'sine',.55*k,36,{wet:.04});noise(.32*k+.12,.5*k,'lowpass',2200,320,.7,{wet:.12,buf:AU.pink})},
 crash(){tone(58,.5,'sine',.85,26,{wet:.1});noise(.95,.85,'lowpass',2400,170,.6,{wet:.25,buf:AU.pink});noise(.5,.35,'highpass',3000,800,.7,{at:.12,wet:.1})},
 railOn(box){if(box){tone(180,.12,'square',.08,120,{wet:.1});noise(.12,.3,'bandpass',800,500,2,{wet:.1})}else{tone(1320,.35,'triangle',.08,1240,{wet:.3});tone(2210,.3,'sine',.05,0,{wet:.3});noise(.1,.35,'bandpass',3200,2400,4,{wet:.1})}},
 swap(){noise(.07,.22,'bandpass',3000,1800,3,{wet:.05});tone(520,.06,'square',.04,380,{wet:0})},
 grab(){noise(.18,.12,'bandpass',1400,700,1.2,{wet:.05,buf:AU.pink})},
 trick(n){n=clamp(n|0,1,6);const sc=[0,4,7,11,14,19];for(let i=0;i<Math.min(5,n+1);i++)tone(nf(72+sc[i]),.45,'triangle',.09,0,{at:i*.055,wet:.45})},
 bank(m){const b=72+Math.min(7,m|0);tone(nf(b),.25,'sine',.13,0,{wet:.4});tone(nf(b+7),.3,'sine',.11,0,{at:.07,wet:.4});tone(nf(b+12),.5,'sine',.1,0,{at:.14,wet:.5})},
 lost(){tone(nf(64),.3,'triangle',.1,nf(58),{wet:.3});tone(nf(60),.4,'triangle',.08,nf(52),{at:.1,wet:.3})},
 click(){tone(950,.045,'triangle',.07,0,{wet:0})},
 hover(){tone(1500,.025,'sine',.025,0,{wet:0})},
 buy(){tone(nf(72),.2,'triangle',.12,0,{wet:.3});tone(nf(79),.3,'triangle',.12,0,{at:.08,wet:.3});tone(nf(84),.45,'triangle',.12,0,{at:.16,wet:.4})},
 whoosh(){noise(.5,.3,'bandpass',500,2000,1,{wet:.2,buf:AU.pink})},
 cheer(k){k=clamp(k||.6,.2,1.2);noise(1.6,.18*k,'bandpass',1200,900,.5,{wet:.4,buf:AU.pink,a:.15});for(let i=0;i<5;i++)noise(.08,.06*k,'bandpass',2600+R()*1200,0,6,{at:.1+R()*.9,wet:.3})},
 horn(){tone(nf(55),.9,'sawtooth',.05,0,{wet:.4});tone(nf(62),.9,'sawtooth',.04,0,{wet:.4})},
 start(){tone(nf(67),.18,'triangle',.11,0,{wet:.4});tone(nf(67),.18,'triangle',.11,0,{at:.5,wet:.4});tone(nf(79),.5,'triangle',.13,0,{at:1,wet:.5})}};
const sfx=(n,...a)=>{if(AU.ctx&&SFX[n])try{SFX[n](...a)}catch(e){}};
// ---------------- MUSIC: a dusty, swung boom-bap loop that fills in once you drop in ----------------
const Music=(()=>{let on=false,next=0,step=0,timer=0,bar=0,level=0,target=0;
 const BPM=86,SP=60/BPM/4,SW=.17;
 // Dm9  G13  Cmaj9  A7(b9)
 const CH=[[50,53,57,60,64],[43,53,57,59,64],[48,52,55,59,62],[45,49,55,58,64]],BASS=[38,43,36,33];
 function rhodes(n,t,d,v){const C=AU.ctx,o=C.createOscillator(),m=C.createOscillator(),mg=C.createGain(),g=C.createGain(),f=C.createBiquadFilter();
  o.type='sine';o.frequency.value=nf(n);m.type='sine';m.frequency.value=nf(n)*2;mg.gain.setValueAtTime(nf(n)*1.1,t);mg.gain.exponentialRampToValueAtTime(nf(n)*.08,t+.5);m.connect(mg);mg.connect(o.frequency);
  f.type='lowpass';f.frequency.value=1800;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.008);g.gain.exponentialRampToValueAtTime(v*.35,t+.4);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(f);f.connect(AU.mus);const s=C.createGain();s.gain.value=.35;f.connect(s);s.connect(AU.send);o.start(t);m.start(t);o.stop(t+d+.05);m.stop(t+d+.05)}
 function bass(n,t,d){const C=AU.ctx,o=C.createOscillator(),g=C.createGain(),f=C.createBiquadFilter();o.type='triangle';o.frequency.value=nf(n);f.type='lowpass';f.frequency.value=420;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.2,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(f);f.connect(g);g.connect(AU.mus);o.start(t);o.stop(t+d+.05)}
 function kick(t,v){const C=AU.ctx,o=C.createOscillator(),g=C.createGain();o.frequency.setValueAtTime(110,t);o.frequency.exponentialRampToValueAtTime(42,t+.16);g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.32);o.connect(g);g.connect(AU.mus);o.start(t);o.stop(t+.36)}
 function snare(t,v){const C=AU.ctx,s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain();s.buffer=AU.noise;f.type='bandpass';f.frequency.value=1700;f.Q.value=.7;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.2);s.connect(f);f.connect(g);g.connect(AU.mus);const r=C.createGain();r.gain.value=.4;g.connect(r);r.connect(AU.send);s.start(t,R());s.stop(t+.22);
  const o=C.createOscillator(),og=C.createGain();o.frequency.setValueAtTime(190,t);o.frequency.exponentialRampToValueAtTime(140,t+.08);og.gain.setValueAtTime(v*.5,t);og.gain.exponentialRampToValueAtTime(.0001,t+.1);o.connect(og);og.connect(AU.mus);o.start(t);o.stop(t+.12)}
 function hat(t,v){const C=AU.ctx,s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain();s.buffer=AU.noise;f.type='highpass';f.frequency.value=7500;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.05);s.connect(f);f.connect(g);g.connect(AU.mus);s.start(t,R());s.stop(t+.07)}
 function crackle(t){const C=AU.ctx,s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain();s.buffer=AU.noise;f.type='highpass';f.frequency.value=2500;g.gain.setValueAtTime(.02+R()*.03,t);g.gain.exponentialRampToValueAtTime(.0001,t+.012);s.connect(f);f.connect(g);g.connect(AU.mus);s.start(t,R()*2);s.stop(t+.02)}
 function sched(){const C=AU.ctx;if(!C||!on)return;level+=(target-level)*.08;while(next<C.currentTime+.25){const i=step%16,t=next+(i%2?SP*SW:0),ch=CH[bar%4];
  if(i===0){ch.forEach((n,k)=>rhodes(n+12,t+k*.012,SP*15,.035))}
  if(i===10&&bar%2===1)ch.slice(2).forEach((n,k)=>rhodes(n+12,t+k*.01,SP*5,.022));
  if(level>.2){if(i===0||i===7||i===10)kick(t,.3*level);if(i===4||i===12)snare(t,.16*level);if(i%2===0)hat(t,.04*level);else if(R()<.4)hat(t,.018*level);
   if(i===0)bass(BASS[bar%4],t,SP*6);if(i===7)bass(BASS[bar%4]+(bar%2?7:12),t,SP*3);if(i===10)bass(BASS[bar%4],t,SP*5)}
  if(R()<.25)crackle(t+R()*SP);
  next+=SP;step++;if(step%16===0)bar++}}
 return{start(){if(on||!AU.ctx)return;on=true;next=AU.ctx.currentTime+.1;timer=setInterval(sched,60)},set(v){target=v}}})();

function MODLIB(){
// ================= SCULPT: signed-distance modelling + surface-nets mesher =================
const SDF=(()=>{
const hash=(x,y,z)=>{let h=(x*374761393+y*668265263+z*1274126177)|0;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295};
const sm=t=>t*t*(3-2*t);
function noise(x,y,z){const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),xf=sm(x-xi),yf=sm(y-yi),zf=sm(z-zi);
const a=hash(xi,yi,zi),b=hash(xi+1,yi,zi),c=hash(xi,yi+1,zi),d=hash(xi+1,yi+1,zi),e=hash(xi,yi,zi+1),f=hash(xi+1,yi,zi+1),g=hash(xi,yi+1,zi+1),h=hash(xi+1,yi+1,zi+1);
const x1=a+(b-a)*xf,x2=c+(d-c)*xf,x3=e+(f-e)*xf,x4=g+(h-g)*xf,y1=x1+(x2-x1)*yf,y2=x3+(x4-x3)*yf;return y1+(y2-y1)*zf}
const fbm=(x,y,z)=>noise(x,y,z)*.6+noise(x*2.03+7,y*2.03,z*2.03)*.28+noise(x*4.1,y*4.1+3,z*4.1)*.12;
function rotM(e){if(!e)return null;const[a,b,c]=e,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cc=Math.cos(c),sc=Math.sin(c);
// R = Rz*Ry*Rx (local->world); store transpose for world->local
const m=[cb*cc,sa*sb*cc-ca*sc,ca*sb*cc+sa*sc,cb*sc,sa*sb*sc+ca*cc,ca*sb*sc-sa*cc,-sb,sa*cb,ca*cb];return[m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]]}
// primitive constructors -> {f(x,y,z), bb:[minx,miny,minz,maxx,maxy,maxz]}
function mk(o,f,bb){o.f=f;o.bb=bb;o.k=o.k??0.03;o.op=o.op||0;o.b=o.b??0;o.z=o.z??0;o.n=o.n||0;return o}
function local(c,rot){const M=rotM(rot);if(!M)return(x,y,z,out)=>{out[0]=x-c[0];out[1]=y-c[1];out[2]=z-c[2]};
return(x,y,z,out)=>{const a=x-c[0],b=y-c[1],d=z-c[2];out[0]=M[0]*a+M[1]*b+M[2]*d;out[1]=M[3]*a+M[4]*b+M[5]*d;out[2]=M[6]*a+M[7]*b+M[8]*d}}
const T=[0,0,0];
const S=(c,r,o={})=>mk(o,(x,y,z)=>Math.hypot(x-c[0],y-c[1],z-c[2])-r,[c[0]-r,c[1]-r,c[2]-r,c[0]+r,c[1]+r,c[2]+r]);
const E=(c,rd,o={})=>{const L=local(c,o.rot),m=Math.max(...rd);return mk(o,(x,y,z)=>{L(x,y,z,T);const a=T[0]/rd[0],b=T[1]/rd[1],d=T[2]/rd[2],k0=Math.sqrt(a*a+b*b+d*d),k1=Math.sqrt(a*a/(rd[0]*rd[0])+b*b/(rd[1]*rd[1])+d*d/(rd[2]*rd[2]));return k1<1e-9?-Math.min(...rd):k0*(k0-1)/k1},[c[0]-m,c[1]-m,c[2]-m,c[0]+m,c[1]+m,c[2]+m])};
const C=(a,b,ra,rb,o={})=>{rb=rb??ra;const bx=b[0]-a[0],by=b[1]-a[1],bz=b[2]-a[2],l2=bx*bx+by*by+bz*bz||1e-9,m=Math.max(ra,rb);
return mk(o,(x,y,z)=>{const px=x-a[0],py=y-a[1],pz=z-a[2];let t=(px*bx+py*by+pz*bz)/l2;t=t<0?0:t>1?1:t;return Math.hypot(px-bx*t,py-by*t,pz-bz*t)-(ra+(rb-ra)*t)},
[Math.min(a[0],b[0])-m,Math.min(a[1],b[1])-m,Math.min(a[2],b[2])-m,Math.max(a[0],b[0])+m,Math.max(a[1],b[1])+m,Math.max(a[2],b[2])+m])};
const B=(c,h,r,o={})=>{r=r||0;const L=local(c,o.rot),m=Math.hypot(...h);return mk(o,(x,y,z)=>{L(x,y,z,T);const qx=Math.abs(T[0])-h[0]+r,qy=Math.abs(T[1])-h[1]+r,qz=Math.abs(T[2])-h[2]+r;
return Math.hypot(Math.max(qx,0),Math.max(qy,0),Math.max(qz,0))+Math.min(Math.max(qx,qy,qz),0)-r},[c[0]-m,c[1]-m,c[2]-m,c[0]+m,c[1]+m,c[2]+m])};
// cylinder along local Y (use rot to orient), radius r, half height h, edge round rr
const Y=(c,r,h,rr,o={})=>{rr=rr||0;const L=local(c,o.rot),m=Math.hypot(r,h);return mk(o,(x,y,z)=>{L(x,y,z,T);const dx=Math.hypot(T[0],T[2])-r+rr,dy=Math.abs(T[1])-h+rr;
return Math.min(Math.max(dx,dy),0)+Math.hypot(Math.max(dx,0),Math.max(dy,0))-rr},[c[0]-m,c[1]-m,c[2]-m,c[0]+m,c[1]+m,c[2]+m])};
// torus around local Y
const TO=(c,R,r,o={})=>{const L=local(c,o.rot),m=R+r;return mk(o,(x,y,z)=>{L(x,y,z,T);return Math.hypot(Math.hypot(T[0],T[2])-R,T[1])-r},[c[0]-m,c[1]-m,c[2]-m,c[0]+m,c[1]+m,c[2]+m])};
// chain of tapered capsules through points (tentacles/fingers); bones array optional per segment
function chain(pts,r0,r1,o={},bones){const out=[];for(let i=0;i<pts.length-1;i++){const t0=i/(pts.length-1),t1=(i+1)/(pts.length-1);out.push(C(pts[i],pts[i+1],r0+(r1-r0)*t0,r0+(r1-r0)*t1,Object.assign({},o,{b:bones?bones[i]:o.b})))}return out}
const smin=(a,b,k)=>{if(k<=0)return Math.min(a,b);const h=Math.max(k-Math.abs(a-b),0)/k;return Math.min(a,b)-h*h*k*.25};
const smax=(a,b,k)=>-smin(-a,-b,k);
function field(model){const P=model.prims,nf=model.nf||6,na=model.noise||0,mg=(model.h||.04)*2;
return(x,y,z)=>{let d=1e9,nz=-1;for(let i=0;i<P.length;i++){const p=P[i],bb=p.bb;
if(p.op===0){const lb=Math.max(bb[0]-x,x-bb[3],bb[1]-y,y-bb[4],bb[2]-z,z-bb[5])-p.n;if(lb-d>p.k+mg)continue;
let di=p.f(x,y,z);if(p.n){if(nz<0)nz=fbm(x*nf,y*nf,z*nf);di-=p.n*(nz-.5)}d=smin(d,di,p.k)}
else if(p.op===1){const lb=Math.max(bb[0]-x,x-bb[3],bb[1]-y,y-bb[4],bb[2]-z,z-bb[5]);if(lb>p.k+mg)continue;d=smax(d,-p.f(x,y,z),p.k)}
else d=smax(d,p.f(x,y,z),p.k)}return d}}
// classify a surface point: which prim owns it (for zone + bone weights)
function owner(model,x,y,z){const P=model.prims;let best=-1,bd=1e9,carve=-1,cd=1e9;
for(let i=0;i<P.length;i++){const p=P[i];if(p.op===1){if(p.z<0)continue;const di=Math.abs(p.f(x,y,z));if(di<cd){cd=di;carve=i}continue}if(p.op!==0)continue;const di=p.f(x,y,z);if(di<bd){bd=di;best=i}}
if(carve>=0&&cd<Math.abs(bd)-.002)return carve;return best}
// ------------- surface nets -------------
const EDGES=[];for(let i=0;i<8;i++)for(let j=0;j<3;j++){const p=i^(1<<j);if(i<=p)EDGES.push(i,p)}
const ETAB=new Int32Array(256);for(let i=0;i<256;i++){let em=0;for(let j=0;j<24;j+=2){const a=!!(i&(1<<EDGES[j])),b=!!(i&(1<<EDGES[j+1]));em|=a!==b?(1<<(j>>1)):0}ETAB[i]=em}
function build(model){const t0=Date.now(),h=model.h||.04,F=field(model),P=model.prims;
let bb=[1e9,1e9,1e9,-1e9,-1e9,-1e9];P.forEach(p=>{if(p.op!==0)return;for(let i=0;i<3;i++){bb[i]=Math.min(bb[i],p.bb[i]);bb[i+3]=Math.max(bb[i+3],p.bb[i+3])}});
const pad=h*3+(model.noise||0);const ox=bb[0]-pad,oy=bb[1]-pad,oz=bb[2]-pad,nx=Math.ceil((bb[3]-bb[0]+2*pad)/h)+1,ny=Math.ceil((bb[4]-bb[1]+2*pad)/h)+1,nz=Math.ceil((bb[5]-bb[2]+2*pad)/h)+1;
const G=new Float32Array(nx*ny*nz),cs=4,cx=Math.ceil((nx-1)/cs)+1,cy=Math.ceil((ny-1)/cs)+1,cz=Math.ceil((nz-1)/cs)+1,Gc=new Float32Array(cx*cy*cz),H=h*cs;
let n=0;for(let z=0;z<cz;z++)for(let y=0;y<cy;y++)for(let x=0;x<cx;x++)Gc[n++]=F(ox+x*H,oy+y*H,oz+z*H);const th=H*1.9;n=0;
for(let z=0;z<nz;z++){const z0=Math.min(cz-2,(z/cs)|0),fz=z/cs-z0;for(let y=0;y<ny;y++){const y0=Math.min(cy-2,(y/cs)|0),fy=y/cs-y0;for(let x=0;x<nx;x++,n++){const x0=Math.min(cx-2,(x/cs)|0),fx=x/cs-x0,i0=x0+y0*cx+z0*cx*cy;
const c00=Gc[i0]+(Gc[i0+1]-Gc[i0])*fx,c10=Gc[i0+cx]+(Gc[i0+cx+1]-Gc[i0+cx])*fx,c01=Gc[i0+cx*cy]+(Gc[i0+cx*cy+1]-Gc[i0+cx*cy])*fx,c11=Gc[i0+cx*cy+cx]+(Gc[i0+cx*cy+cx+1]-Gc[i0+cx*cy+cx])*fx;
const c0=c00+(c10-c00)*fy,c1=c01+(c11-c01)*fy,dc=c0+(c1-c0)*fz;G[n]=Math.abs(dc)>th?dc:F(ox+x*h,oy+y*h,oz+z*h)}}}
const sx=1,sy=nx,sz=nx*ny,cell=new Int32Array(nx*ny*nz).fill(-1),pos=[],quads=[],g=new Float32Array(8),co=[0,sx,sy,sx+sy,sz,sz+sx,sz+sy,sz+sx+sy];
for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){const m=x+y*sy+z*sz;let mask=0;for(let i=0;i<8;i++){g[i]=G[m+co[i]];if(g[i]<0)mask|=1<<i}
if(mask===0||mask===255)continue;const em=ETAB[mask];let vx=0,vy=0,vz=0,ec=0;
for(let i=0;i<12;i++){if(!(em&(1<<i)))continue;const e0=EDGES[2*i],e1=EDGES[2*i+1],a=g[e0],b=g[e1],t=a/(a-b);
vx+=(e0&1)*(1-t)+(e1&1)*t;vy+=((e0>>1)&1)*(1-t)+((e1>>1)&1)*t;vz+=((e0>>2)&1)*(1-t)+((e1>>2)&1)*t;ec++}
cell[m]=pos.length/3;pos.push(ox+(x+vx/ec)*h,oy+(y+vy/ec)*h,oz+(z+vz/ec)*h);
const cc=[x,y,z],st=[sx,sy,sz];for(let i=0;i<3;i++){if(!(em&(1<<i)))continue;const iu=(i+1)%3,iv=(i+2)%3;if(cc[iu]===0||cc[iv]===0)continue;const du=st[iu],dv=st[iv];
if(mask&1)quads.push(cell[m],cell[m-du],cell[m-du-dv],cell[m-dv]);else quads.push(cell[m],cell[m-dv],cell[m-du-dv],cell[m-du])}}
const nv=pos.length/3,N=new Float32Array(nv*3),Cl=new Float32Array(nv*3),Z=new Uint8Array(nv),SI=new Uint16Array(nv*4),SW=new Float32Array(nv*4),e=h*.5;
const pal=model.pal,ws=model.ws||.06,nb=model.nb||1,bw=new Float32Array(nb),ao=model.ao??1,aoS=model.aoS||h*1.5,cv=model.cv??.12,cf=model.cf||3;
const ds=new Float32Array(P.length);for(let v=0;v<nv;v++){const x=pos[3*v],y=pos[3*v+1],z=pos[3*v+2];const f1=F(x+e,y-e,z-e),f2=F(x-e,y-e,z+e),f3=F(x-e,y+e,z-e),f4=F(x+e,y+e,z+e);let gx=f1-f2-f3+f4,gy=-f1-f2+f3+f4,gz=-f1+f2-f3+f4;const gl=Math.hypot(gx,gy,gz)||1;gx/=gl;gy/=gl;gz/=gl;N[3*v]=gx;N[3*v+1]=gy;N[3*v+2]=gz;
let best=-1,bd=1e9,carve=-1,cd=1e9,dmin=1e9;for(let i=0;i<P.length;i++){const p=P[i];if(p.op===1){ds[i]=1e9;if(p.z<0)continue;const di=Math.abs(p.f(x,y,z));if(di<cd){cd=di;carve=i}continue}if(p.op!==0){ds[i]=1e9;continue}const di=p.f(x,y,z);ds[i]=di;if(di<bd){bd=di;best=i}}dmin=bd;
const ow=carve>=0&&cd<Math.abs(bd)-.002?carve:best,pr=P[ow]||P[0],zone=pr.z<0?0:pr.z;Z[v]=zone;
// baked ambient occlusion
let occ=0;if(ao){for(let i=1;i<=3;i++){const dd=aoS*i;occ+=(dd-F(x+gx*dd,y+gy*dd,z+gz*dd))/Math.pow(2,i)/aoS}occ=Math.max(0,Math.min(1,1-occ*.55*ao))}else occ=1;
const col=(pr.col)||pal[zone]||[.5,.5,.5],vr=1+cv*(fbm(x*cf+11,y*cf,z*cf)-.5)*2;Cl[3*v]=col[0]*vr*occ;Cl[3*v+1]=col[1]*vr*occ;Cl[3*v+2]=col[2]*vr*occ;
// skin weights
if(nb>1){bw.fill(0);
for(let i=0;i<P.length;i++){if(ds[i]>=1e8)continue;const w=Math.exp(-(ds[i]-dmin)/ws);const bi=P[i].b;if(w>bw[bi])bw[bi]=w}
const top=[];for(let i=0;i<nb;i++)if(bw[i]>.02)top.push(i);top.sort((a,b)=>bw[b]-bw[a]);let s=0;for(let i=0;i<4&&i<top.length;i++)s+=bw[top[i]];
for(let i=0;i<4;i++){if(i<top.length){SI[4*v+i]=top[i];SW[4*v+i]=bw[top[i]]/s}}}else SW[4*v]=1}
// triangles grouped by zone
const nz2=Math.max(...Object.keys(pal).map(Number))+1,groups=Array.from({length:nz2},()=>[]),dist=(a,b)=>Math.hypot(pos[3*a]-pos[3*b],pos[3*a+1]-pos[3*b+1],pos[3*a+2]-pos[3*b+2]);
for(let q=0;q<quads.length;q+=4){const a=quads[q],b=quads[q+1],c=quads[q+2],d=quads[q+3],tris=dist(a,c)<dist(b,d)?[a,b,c,a,c,d]:[a,b,d,b,c,d];
for(let t=0;t<6;t+=3){const za=Z[tris[t]],zb=Z[tris[t+1]],zc=Z[tris[t+2]],zz=za===zb||za===zc?za:zb===zc?zb:Math.max(za,zb,zc);groups[zz].push(tris[t],tris[t+1],tris[t+2])}}
const idx=[],grp=[];groups.forEach((gr,i)=>{grp.push([idx.length,gr.length,i]);for(const k of gr)idx.push(k)});
return{pos:new Float32Array(pos),nor:N,col:Cl,zone:Z,si:SI,sw:SW,idx:nv>65535?new Uint32Array(idx):new Uint16Array(idx),groups:grp,nv,nt:idx.length/3,ms:Date.now()-t0,bounds:[ox,oy,oz,ox+nx*h,oy+ny*h,oz+nz*h]}}
return{S,E,C,B,Y,TO,chain,build,noise,fbm,field}})();

// ================= MODEL LIBRARY (sculpted with signed distance fields) =================
const MODELS=(()=>{const{S,E,C,B,Y,TO}=SDF;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],nrm=a=>{const l=Math.hypot(...a)||1;return[a[0]/l,a[1]/l,a[2]/l]};
// Skier standing on skis that run along +Z (tips forward). Feet at y=0.
// bones: 0 hips 1 spine 2 chest 3 neck 4 head | R arm 5 6 7 | L arm 8 9 10 | R leg 11 12 13 | L leg 14 15 16
const J={hips:[0,.93,-.02],spine:[0,1.09,-.01],chest:[0,1.29,0],neck:[0,1.47,.01],head:[0,1.6,.02],
 shR:[-.2,1.39,-.01],elR:[-.27,1.13,.03],wrR:[-.3,.9,.12],shL:[.2,1.39,-.01],elL:[.27,1.13,.03],wrL:[.3,.9,.12],
 hpR:[-.1,.91,-.02],knR:[-.11,.51,.06],anR:[-.11,.11,-.02],toR:[-.11,.04,.13],hpL:[.1,.91,-.02],knL:[.11,.51,.06],anL:[.11,.11,-.02],toL:[.11,.04,.13]};
const bones=[{p:J.hips,parent:-1},{p:J.spine,parent:0},{p:J.chest,parent:1},{p:J.neck,parent:2},{p:J.head,parent:3},
 {p:J.shR,parent:2},{p:J.elR,parent:5},{p:J.wrR,parent:6},{p:J.shL,parent:2},{p:J.elL,parent:8},{p:J.wrL,parent:9},
 {p:J.hpR,parent:0},{p:J.knR,parent:11},{p:J.anR,parent:12},{p:J.hpL,parent:0},{p:J.knL,parent:14},{p:J.anL,parent:15}];
// zones: 0 jacket, 1 jacket accent, 2 pants, 3 dark (gloves, boots), 4 skin
function skier(){const P=[],JK=0,AC=1,PT=2,DK=3,SK=4;
 // a long, baggy park jacket that hangs to mid-thigh
 P.push(E(add(J.hips,[0,.02,0]),[.19,.13,.15],{b:0,z:JK,k:.06}));
 P.push(E(add(J.hips,[0,-.1,-.005]),[.205,.09,.16],{b:0,z:JK,k:.05}));// hem flare
 P.push(E(add(J.spine,[0,.0,0]),[.19,.15,.145],{b:1,z:JK,k:.07}));
 P.push(E(add(J.chest,[0,.02,.005]),[.225,.17,.15],{b:2,z:JK,k:.07}));
 P.push(E(add(J.chest,[0,.115,-.005]),[.232,.06,.142],{b:2,z:AC,k:.012}));// accent yoke across the shoulders, kept crisp
 P.push(E(add(J.chest,[0,.16,-.1]),[.15,.09,.085],{b:2,z:AC,k:.05}));// hood
 P.push(C(add(J.chest,[0,-.14,.152]),add(J.chest,[0,.15,.142]),.011,.011,{b:2,z:DK,k:.01}));// zip
 for(const s of[-1,1])P.push(E(add(J.spine,[s*.13,-.08,.128]),[.06,.045,.022],{b:1,z:JK,k:.006}));// hand pockets
 // neck gaiter and face
 P.push(C(add(J.neck,[0,-.05,0]),add(J.head,[0,-.04,.005]),.072,.068,{b:3,z:AC,k:.04}));
 P.push(E(add(J.head,[0,-.04,.05]),[.082,.065,.07],{b:4,z:AC,k:.03}));// gaiter over the chin
 P.push(E(add(J.head,[0,.05,0]),[.105,.12,.115],{b:4,z:SK,k:.02}));// head (covered by headwear)
 P.push(E(add(J.head,[0,.04,.1]),[.06,.04,.03],{b:4,z:SK,k:.02}));// nose/cheeks
 // arms: puffy sleeves, cuffs, gloves
 for(const n of['R','L']){const ua=n==='R'?5:8,sh=J['sh'+n],el=J['el'+n],wr=J['wr'+n],d=nrm(sub(wr,el)),sx=n==='R'?-1:1;
  P.push(E(sh,[.088,.088,.088],{b:ua,z:JK,k:.03}));
  P.push(C(sh,el,.075,.066,{b:ua,z:JK,k:.045}));P.push(C(el,wr,.064,.056,{b:ua+1,z:JK,k:.04}));
  P.push(C(add(wr,mul(d,-.03)),add(wr,mul(d,.01)),.06,.06,{b:ua+2,z:AC,k:.02}));// cuff
  const hc=add(wr,mul(d,.07));P.push(E(hc,[.05,.06,.045],{b:ua+2,z:DK,k:.025}));// glove
  P.push(E(add(hc,[-sx*.035,.0,.03]),[.02,.04,.02],{b:ua+2,z:DK,k:.02}))}// thumb
 // baggy pants over the boots, boots clipped into bindings
 for(const n of['R','L']){const lg=n==='R'?11:14,hp=J['hp'+n],kn=J['kn'+n],an=J['an'+n],to=J['to'+n],sx=n==='R'?-1:1;
  P.push(C(hp,kn,.105,.088,{b:lg,z:PT,k:.06}));P.push(E(add(kn,[0,0,.01]),[.08,.075,.08],{b:lg+1,z:PT,k:.035}));
  P.push(C(kn,add(an,[0,.12,0]),.082,.078,{b:lg+1,z:PT,k:.04}));P.push(E(add(an,[0,.15,0]),[.095,.06,.1],{b:lg+1,z:PT,k:.04}));// cuff bunched over the boot
  P.push(E(add(kn,[sx*.05,.1,.02]),[.035,.07,.05],{b:lg,z:PT,k:.03}));// cargo pocket
  const bc=mix(an,to,.45);P.push(B(add(bc,[0,.035,.01]),[.055,.045,.15],.035,{b:lg+2,z:DK,k:.02}));
  P.push(E(add(an,[0,.09,-.01]),[.068,.07,.085],{b:lg+2,z:DK,k:.03}))}
 return{prims:P,h:.016,bones,nb:bones.length,J,pal:{0:[.92,.92,.92],1:[.95,.95,.95],2:[.92,.92,.92],3:[.14,.145,.16],4:[.86,.68,.55]},ao:1,cv:.05}}
// headwear sculpted around the head joint, rigid; origin at the head joint
function helmet(){const P=[],SH=0,LN=1,DK=2;
 P.push(E([0,.07,-.005],[.135,.13,.148],{z:SH,k:.015}));P.push(E([0,.17,-.035],[.06,.028,.1],{z:SH,k:.03}));
 P.push(B([0,.0,0],[.3,.06,.3],0,{op:1,k:.02,rot:[-.15,0,0]}));// cut the rim
 for(const s of[-1,1])P.push(E([s*.128,.0,-.005],[.03,.06,.06],{z:SH,k:.01}));
 P.push(TO([0,.045,-.01],.145,.017,{z:DK,k:.01}));P.push(E([0,.04,.118],[.122,.055,.05],{z:DK,k:.012}));P.push(E([0,.04,.142],[.11,.045,.036],{z:LN,k:.008}));
 return{prims:P,h:.012,pal:{0:[.95,.95,.95],1:[.95,.95,.95],2:[.13,.135,.15]},ao:1,cv:.04}}
function beanie(){const P=[],SH=0,LN=1,DK=2;
 P.push(E([0,.08,-.01],[.122,.13,.13],{z:SH,k:.015}));P.push(TO([0,.0,-.01],.118,.03,{z:SH,k:.02}));// folded cuff
 P.push(S([0,.235,-.02],.04,{z:SH,k:.03}));// pom
 P.push(TO([0,.035,-.01],.128,.014,{z:DK,k:.01}));P.push(E([0,.035,.112],[.118,.052,.048],{z:DK,k:.012}));P.push(E([0,.035,.135],[.106,.042,.034],{z:LN,k:.008}));
 return{prims:P,h:.012,pal:{0:[.95,.95,.95],1:[.95,.95,.95],2:[.13,.135,.15]},ao:1,cv:.04,noise:.004,nf:60}}
const list={skier,helmet,beanie};
return{list,J}})();

return{SDF,MODELS}}
// ================= RENDERER + POST PROCESSING =================
const ren=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',stencil:false});
ren.outputEncoding=THREE.LinearEncoding;ren.toneMapping=THREE.NoToneMapping;ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;ren.autoClear=false;
ren.domElement.id='gl';document.body.prepend(ren.domElement);
const isGL2=ren.capabilities.isWebGL2,HDR=(isGL2&&ren.extensions.has('EXT_color_buffer_float'))||(!isGL2&&ren.extensions.has('OES_texture_half_float')&&ren.extensions.has('EXT_color_buffer_half_float'));
const FT=HDR?THREE.HalfFloatType:THREE.UnsignedByteType;
// aerial perspective: a long exponential tail instead of the squared fog, so far ridges stay readable
THREE.ShaderChunk.fog_fragment=THREE.ShaderChunk.fog_fragment.replace('float fogFactor = 1.0 - exp( - fogDensity * fogDensity * fogDepth * fogDepth );','float fogFactor = 1.0 - exp( - pow( fogDensity * fogDepth, 1.25 ) );');
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xbfd2e6,.0004);
const cam=new THREE.PerspectiveCamera(62,1,.3,5200);scene.add(cam);
const SH={
quadV:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
bright:'uniform sampler2D t;uniform float th;varying vec2 vUv;void main(){vec3 c=min(texture2D(t,vUv).rgb,vec3(30.));float l=max(max(c.r,c.g),c.b);gl_FragColor=vec4(c*max(l-th,0.)/max(l,1e-4),1.);}',
down:'uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){vec4 s=texture2D(t,vUv)*4.;s+=texture2D(t,vUv-px);s+=texture2D(t,vUv+px);s+=texture2D(t,vUv+vec2(px.x,-px.y));s+=texture2D(t,vUv+vec2(-px.x,px.y));gl_FragColor=s*.125;}',
up:'uniform sampler2D t;uniform sampler2D tAdd;uniform vec2 px;uniform float k;varying vec2 vUv;void main(){vec4 s=texture2D(t,vUv+vec2(-px.x*2.,0.));s+=texture2D(t,vUv+vec2(-px.x,px.y))*2.;s+=texture2D(t,vUv+vec2(0.,px.y*2.));s+=texture2D(t,vUv+vec2(px.x,px.y))*2.;s+=texture2D(t,vUv+vec2(px.x*2.,0.));s+=texture2D(t,vUv+vec2(px.x,-px.y))*2.;s+=texture2D(t,vUv+vec2(0.,-px.y*2.));s+=texture2D(t,vUv+vec2(-px.x,-px.y))*2.;gl_FragColor=s/12.+texture2D(tAdd,vUv)*k;}',
comp:`uniform sampler2D tScene;uniform vec2 rpx;uniform float aa;uniform sampler2D tBloom;uniform float bloom;uniform float exposure;uniform float vig;uniform float speed;uniform float fade;uniform float white;uniform float sat;uniform vec3 lift;uniform vec3 gain;varying vec2 vUv;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
vec3 fxaa(vec2 uv){vec3 c=texture2D(tScene,uv).rgb;if(aa<.5)return c;vec3 L=vec3(.299,.587,.114);
 float lc=dot(min(c,vec3(4.)),L),ln=dot(min(texture2D(tScene,uv+vec2(0.,-rpx.y)).rgb,vec3(4.)),L),ls=dot(min(texture2D(tScene,uv+vec2(0.,rpx.y)).rgb,vec3(4.)),L),le=dot(min(texture2D(tScene,uv+vec2(rpx.x,0.)).rgb,vec3(4.)),L),lw=dot(min(texture2D(tScene,uv+vec2(-rpx.x,0.)).rgb,vec3(4.)),L);
 float mn=min(lc,min(min(ln,ls),min(le,lw))),mx=max(lc,max(max(ln,ls),max(le,lw)));if(mx-mn<max(.04,mx*.12))return c;
 vec2 d=vec2(-((ln+ls)-(le+lw)),((ln+le)-(ls+lw)));float rd=1./(min(abs(d.x),abs(d.y))+max((ln+ls+le+lw)*.03,.002));d=clamp(d*rd,vec2(-6.),vec2(6.))*rpx;
 vec3 a=.5*(texture2D(tScene,uv-d*.17).rgb+texture2D(tScene,uv+d*.17).rgb),b=a*.5+.25*(texture2D(tScene,uv-d*.5).rgb+texture2D(tScene,uv+d*.5).rgb);float lb=dot(min(b,vec3(4.)),L);return(lb<mn||lb>mx)?a:b;}
void main(){vec2 dc=vUv-.5;float r2=dot(dc,dc);vec3 col=fxaa(vUv);
 if(speed>.01){vec2 dir=dc*speed*.05*smoothstep(.02,.25,r2);vec3 acc=col;for(int i=1;i<8;i++){float f=float(i)/7.;acc+=texture2D(tScene,vUv-dir*f).rgb;}col=acc/8.;}
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
 comp:SM(SH.comp,{rpx:{value:new THREE.Vector2(1,1)},aa:{value:0},tScene:{value:null},tBloom:{value:black},bloom:{value:.1},exposure:{value:.75},vig:{value:.5},speed:{value:0},fade:{value:0},white:{value:0},sat:{value:1.05},lift:{value:new THREE.Vector3()},gain:{value:new THREE.Vector3(1,1,1)}}),rt:null,mips:[],ups:[]};
const rtOpt=d=>({minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,type:FT,depthBuffer:!!d,stencilBuffer:false});
let PART=null;
function setupPost(){const q=save.set.q,base=q===0?1:Math.min(devicePixelRatio,q===2?1.75:1.25),cpr=Math.max(.35,base*PERF.scale),pr=cpr;
 const w=Math.max(2,innerWidth*pr|0),h=Math.max(2,innerHeight*pr|0);ren.setPixelRatio(cpr);ren.setSize(innerWidth,innerHeight,false);ren.domElement.style.width='100%';ren.domElement.style.height='100%';
 if(PP.rt)PP.rt.dispose();PP.mips.forEach(r=>r.dispose());PP.ups.forEach(r=>r.dispose());PP.mips=[];PP.ups=[];
 if(isGL2&&q>0&&THREE.WebGLMultisampleRenderTarget){PP.rt=new THREE.WebGLMultisampleRenderTarget(w,h,rtOpt(1));PP.rt.samples=q===2?4:2}else PP.rt=new THREE.WebGLRenderTarget(w,h,rtOpt(1));
 if(isGL2){PP.rt.depthTexture=new THREE.DepthTexture(w,h,THREE.UnsignedIntType)}
 if(q>0){let bw=w>>1,bh=h>>1;const n=q===2?6:5;for(let i=0;i<n;i++){PP.mips.push(new THREE.WebGLRenderTarget(Math.max(1,bw),Math.max(1,bh),rtOpt(0)));if(i>0)PP.ups.push(new THREE.WebGLRenderTarget(Math.max(1,bw),Math.max(1,bh),rtOpt(0)));bw>>=1;bh>>=1}}
 cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();PP.comp.uniforms.tBloom.value=black;PP.comp.uniforms.rpx.value.set(1/w,1/h);PP.comp.uniforms.aa.value=q<2?1:0;
 ren.shadowMap.enabled=true;sun.castShadow=true;const sz=q===2?2048:1024;sun.shadow.mapSize.set(sz,sz);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}
 if(PART)PART.forEach(p=>p.mat.uniforms.scale.value=h/(2*Math.tan(cam.fov*Math.PI/360)))}
function pass(mat,target){quad.material=mat;ren.setRenderTarget(target);ren.render(quadScene,quadCam)}
function renderFrame(){ren.setRenderTarget(PP.rt);ren.clear();ren.render(scene,cam);
 const U=PP.comp.uniforms;U.tScene.value=PP.rt.texture;
 if(PP.mips.length){PP.bright.uniforms.t.value=PP.rt.texture;PP.bright.uniforms.th.value=HDR?4.5:.95;pass(PP.bright,PP.mips[0]);
  for(let i=1;i<PP.mips.length;i++){const s=PP.mips[i-1];PP.down.uniforms.t.value=s.texture;PP.down.uniforms.px.value.set(1/s.width,1/s.height);pass(PP.down,PP.mips[i])}
  let src=PP.mips[PP.mips.length-1];for(let i=PP.mips.length-2;i>=1;i--){const tgt=PP.ups[i-1];PP.up.uniforms.t.value=src.texture;PP.up.uniforms.tAdd.value=PP.mips[i].texture;PP.up.uniforms.px.value.set(1/src.width,1/src.height);PP.up.uniforms.k.value=1;pass(PP.up,tgt);src=tgt}
  U.tBloom.value=src.texture}else U.tBloom.value=black;
 pass(PP.comp,null)}
// ================= PERFORMANCE =================
// Auto quality: start from what the graphics chip can do, then hold the frame rate by trading resolution first and effects second.
const PERF={tier:2,gpu:'',lvl:0,top:0,ladder:[[2,1]],ema:16.7,bad:0,good:0,cool:2,probe:null,floorUntil:0,floorWait:45e3,floorEma:0,fails:{},scale:1,hook:null};
function gpuTier(){let s='';try{const gl=ren.getContext(),x=gl.getExtension('WEBGL_debug_renderer_info');s=String((x&&gl.getParameter(x.UNMASKED_RENDERER_WEBGL))||gl.getParameter(gl.RENDERER)||'')}catch(e){}PERF.gpu=s;
 let touch=false;try{touch=matchMedia('(hover: none) and (pointer: coarse)').matches}catch(e){}const cores=navigator.hardwareConcurrency||4,mem=navigator.deviceMemory||8;let t;
 if(/swiftshader|llvmpipe|softpipe|software|basic render/i.test(s))t=-1;
 else if(/radeon(\(tm\))? r[2-7]\b|hd graphics|uhd graphics|mali|adreno|powervr|videocore|vivante|tegra|gt [1-7][0-4]0\b/i.test(s))t=0;
 else if(/rtx|gtx ?(9[5-9]0|10[5-8]0|16[5-6]0)|radeon rx|radeon pro|arc a[57]\d\d|titan|quadro/i.test(s))t=2;
 else if(/iris|xe graphics|arc|radeon|vega|apple|geforce|nvidia|intel/i.test(s))t=1;
 else t=1;
 if(touch)t=Math.min(t,0);if(cores<=2||mem<=2)t=Math.min(t,0);else if(cores<=4&&mem<=4)t=Math.min(t,1);
 return t}
const LAD_AUTO=[[2,1],[2,.85],[1,1],[1,.85],[0,1],[0,.85],[0,.72],[0,.6],[0,.5]];
const LAD_FIX={2:[[2,1],[2,.85],[2,.72],[2,.6],[2,.5]],1:[[1,1],[1,.85],[1,.72],[1,.6],[1,.5]],0:[[0,.75],[0,.65],[0,.55],[0,.5]]};
function perfInit(first){if(first){PERF.tier=gpuTier();
  // cheaper shadow filtering on modest chips: four taps instead of sixteen
  if(PERF.tier<2){const C=THREE.ShaderChunk,src=C.shadowmap_pars_fragment,a=src.indexOf('#if defined( SHADOWMAP_TYPE_PCF )\n'),b=src.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )',a);
   if(a>=0&&b>a){C.shadowmap_pars_fragment=src.slice(0,a)+'#if defined( SHADOWMAP_TYPE_PCF )\n vec2 tS=vec2(.7*shadowRadius)/shadowMapSize;\n shadow=(texture2DCompare(shadowMap,shadowCoord.xy+vec2(-tS.x,-tS.y),shadowCoord.z)+texture2DCompare(shadowMap,shadowCoord.xy+vec2(tS.x,-tS.y),shadowCoord.z)+texture2DCompare(shadowMap,shadowCoord.xy+vec2(-tS.x,tS.y),shadowCoord.z)+texture2DCompare(shadowMap,shadowCoord.xy+vec2(tS.x,tS.y),shadowCoord.z))*.25;\n'+src.slice(b);ren.shadowMap.type=THREE.PCFShadowMap}}}
 PERF.probe=null;PERF.fails={};PERF.floorUntil=0;PERF.floorWait=45e3;
 if(save.set.qa!==false&&save.set.qa!==0){PERF.ladder=LAD_AUTO;const t=PERF.tier;PERF.lvl=t>=2?0:t===1?2:t===0?5:7;PERF.top=t>=2?0:t===1?1:t===0?3:5}
 else{PERF.ladder=LAD_FIX[save.set.q]||LAD_FIX[1];PERF.lvl=0;PERF.top=0}
 const L=PERF.ladder[PERF.lvl];save.set.q=L[0];PERF.scale=L[1];PERF.cool=2;PERF.bad=PERF.good=0}
function perfSet(i){i=clamp(i,0,PERF.ladder.length-1);const L=PERF.ladder[i],qc=save.set.q!==L[0];PERF.lvl=i;save.set.q=L[0];PERF.scale=L[1];setupPost();if(PERF.hook)PERF.hook(qc);PERF.cool=1.5;PERF.bad=PERF.good=0}
function perfLabel(){const n=['Low','Medium','High'][save.set.q];return n+' quality, '+Math.round(PERF.scale*100)+'% resolution'+(save.set.qa!==false&&save.set.qa!==0?' (set automatically)':'')}
// called once per frame with the real, unclamped frame time in seconds
function perfTick(dt){const now=performance.now();
 if(dt>.2||document.hidden){PERF.cool=Math.max(PERF.cool,.5);return}
 if(PERF.cool>0){PERF.cool-=dt;if(PERF.cool<=0)PERF.ema=dt*1000;return}
 PERF.ema+=(dt*1000-PERF.ema)*.06;const P=PERF.probe;
 // after stepping down, keep the change only if it actually helped; a capped or CPU-bound machine gains nothing from blur
 if(P){P.t+=dt;if(P.t>2.5){PERF.probe=null;if(PERF.ema>P.prev*.88){perfSet(P.from);PERF.floorUntil=now+PERF.floorWait;PERF.floorWait=Math.min(PERF.floorWait*2,6e5);PERF.floorEma=P.prev}}return}
 if(PERF.ema>22){PERF.bad+=dt;PERF.good=0}else{PERF.bad=Math.max(0,PERF.bad-dt);PERF.good=PERF.ema<17.6?PERF.good+dt:0}
 if(PERF.bad>1.5&&PERF.lvl<PERF.ladder.length-1&&!(now<PERF.floorUntil&&PERF.ema<PERF.floorEma*1.3)){const from=PERF.lvl,prev=PERF.ema;PERF.fails[from]=now;perfSet(from+1);PERF.probe={from,prev,t:0}}
 else if(PERF.good>8&&PERF.lvl>PERF.top&&now-(PERF.fails[PERF.lvl-1]||-1e9)>9e4)perfSet(PERF.lvl-1)}
// ================= SKY, SUN, ATMOSPHERE =================
const sun=new THREE.DirectionalLight(0xffffff,3);scene.add(sun,sun.target);
sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-55,right:55,top:55,bottom:-55,near:1,far:400});sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;sun.shadow.radius=2.5;
const hemi=new THREE.HemisphereLight(0x9cc0ff,0xdfe8f5,1);scene.add(hemi);
const skyU={sunDir:{value:new THREE.Vector3(0,1,0)},zen:{value:new THREE.Color()},hor:{value:new THREE.Color()},haze:{value:new THREE.Color()},sunCol:{value:new THREE.Color()},time:{value:0},cloud:{value:.3},stars:{value:0},camPos:{value:new THREE.Vector3()}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(2800,48,24),new THREE.ShaderMaterial({uniforms:skyU,vertexShader:SH.skyV,fragmentShader:SH.skyF,side:THREE.BackSide,depthWrite:false,fog:false}));sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);
// time-of-day looks: sun elevation/azimuth (deg), colours, light, fog, grading, weather, floodlights
const TOD={
 day:{name:'Bluebird',el:44,az:200,zen:0x0d47b0,hor:0xa9c9ee,haze:0xd2e1f1,sun:0xfff3e2,sunI:3.7,sky:0x8fb2ee,gnd:0x6f7f99,hemiI:.46,fog:0xbfd3ea,fogD:.00042,cloud:.22,snow:0,exp:.54,sat:1.08,gain:[1,1,1.01],lift:[0,0,.012],stars:0,lamps:0},
 sunrise:{name:'First light',el:7,az:105,zen:0x23498e,hor:0xffc79a,haze:0xf0cdb8,sun:0xffae6a,sunI:3.4,sky:0x8ea6d8,gnd:0x6e6a78,hemiI:.48,fog:0xdcc4b6,fogD:.00036,cloud:.3,snow:0,exp:.62,sat:1.12,gain:[1.05,.99,.95],lift:[.014,.004,0],stars:0,lamps:0},
 golden:{name:'Late session',el:12,az:250,zen:0x2a5596,hor:0xffd2a2,haze:0xe9d6c0,sun:0xffbe72,sunI:3.5,sky:0x8aa3d4,gnd:0x6f6878,hemiI:.46,fog:0xdccab4,fogD:.00034,cloud:.32,snow:0,exp:.62,sat:1.12,gain:[1.04,1,.95],lift:[.012,.004,0],stars:0,lamps:0},
 storm:{name:'Snowing',el:30,az:190,zen:0x8a95a6,hor:0xc8d1db,haze:0xcfd7e0,sun:0xe6ebf2,sunI:1.0,sky:0xc4cedb,gnd:0xbcc4cf,hemiI:1.3,fog:0xc7cfd9,fogD:.0016,cloud:.94,snow:.55,exp:.68,sat:.9,gain:[.98,1,1.02],lift:[.02,.02,.03],stars:0,lamps:0},
 night:{name:'Floodlit night',el:34,az:-30,zen:0x03060f,hor:0x111b2f,haze:0x16203a,sun:0x9fb4ff,sunI:.6,sky:0x2a3a62,gnd:0x141a26,hemiI:.3,fog:0x0e1626,fogD:.0009,cloud:.16,snow:.18,exp:1.2,sat:1,gain:[1,.99,1.04],lift:[.004,.006,.02],stars:1,lamps:1}};
let todKey='day',T=TOD.day;
const sunVec=new THREE.Vector3();
function setTOD(k){todKey=TOD[k]?k:'day';T=TOD[todKey];const el=Math.max(T.el,4)*PI/180,az=T.az*PI/180;
 sunVec.set(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).normalize();
 skyU.sunDir.value.copy(sunVec);skyU.zen.value.set(T.zen);skyU.hor.value.set(T.hor);skyU.haze.value.set(T.haze);skyU.sunCol.value.set(T.sun);skyU.cloud.value=T.cloud;skyU.stars.value=T.stars;
 sun.color.set(T.sun);sun.intensity=T.sunI;hemi.color.set(T.sky);hemi.groundColor.set(T.gnd);hemi.intensity=T.hemiI*(PERF.tier<1?1.3:1);
 scene.fog.color.set(T.fog);scene.fog.density=T.fogD;
 const U=PP.comp.uniforms;U.exposure.value=T.exp;U.sat.value=T.sat;U.gain.value.fromArray(T.gain);U.lift.value.fromArray(T.lift);
 LAMP.on=T.lamps;LAMPU.lampOn.value=T.lamps;buildEnvMap()}
// ---------------- floodlights: the nearest lamp heads light everything that is "lampified", without real light objects ----------------
const NL=8,LAMP={heads:[],on:0},LAMPU={lampP:{value:Array.from({length:NL},()=>new THREE.Vector4())},lampC:{value:new THREE.Color(1,.93,.82)},lampK:{value:1/520},lampOn:{value:0}};
function lampify(m){m.onBeforeCompile=(sh)=>{Object.assign(sh.uniforms,LAMPU);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform vec4 lampP['+NL+'];uniform vec3 lampC;uniform float lampK;uniform float lampOn;')
   .replace('#include <lights_fragment_end>','#include <lights_fragment_end>\nif(lampOn>0.){vec3 li=vec3(0.);for(int i=0;i<'+NL+';i++){vec3 L=lampP[i].xyz-geometry.position;float d2=dot(L,L);li+=lampP[i].w/(1.+d2*lampK)*max(dot(geometry.normal,L*inversesqrt(d2)),0.);}reflectedLight.directDiffuse+=li*lampC*BRDF_Diffuse_Lambert(material.diffuseColor);}');
  if(m.userData.obc)m.userData.obc(sh)};m.customProgramCacheKey=()=>'lamp'+(m.userData.key||'');return m}
const _lv=new THREE.Vector3();
function updateLamps(cx,cz){if(!LAMP.on)return;const H=LAMP.heads;if(!H.length)return;
 const best=[];for(const h of H){const d=(h.x-cx)*(h.x-cx)+(h.z-cz)*(h.z-cz);if(best.length<NL||d<best[best.length-1].d){best.push({h,d});best.sort((a,b)=>a.d-b.d);if(best.length>NL)best.pop()}}
 const A=LAMPU.lampP.value;for(let i=0;i<NL;i++){const b=best[i];if(!b){A[i].set(0,0,0,0);continue}_lv.set(b.h.x,b.h.y,b.h.z).applyMatrix4(cam.matrixWorldInverse);A[i].set(_lv.x,_lv.y,_lv.z,b.h.i*(1-sstep(140*140,190*190,b.d)))}}
// materials that keep their reflections when the scene-wide environment is switched off on weak chips
let ENVTEX=null;const ENVMATS=new Set();function envOwn(m){ENVMATS.add(m);if(PERF.tier<1&&ENVTEX)m.envMap=ENVTEX;return m}
function buildEnvMap(){const es=new THREE.Scene(),m=new THREE.Mesh(new THREE.SphereGeometry(100,32,16),new THREE.ShaderMaterial({uniforms:Object.assign({},skyU,{camPos:{value:new THREE.Vector3()},time:{value:0}}),vertexShader:SH.skyV.replace('gl_Position.z=gl_Position.w*.99999;',''),fragmentShader:SH.skyF,side:THREE.BackSide}));es.add(m);
 const g=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshBasicMaterial({color:new THREE.Color(0xf4f7fb).multiplyScalar((T.lamps?.25:.9)*T.hemiI)}));g.rotation.x=-PI/2;g.position.y=-3;es.add(g);
 const band=new THREE.Mesh(new THREE.CylinderGeometry(90,90,14,48,1,true),new THREE.MeshBasicMaterial({color:new THREE.Color(T.fog).lerp(new THREE.Color(0x1f2a24),.5).multiplyScalar(T.hemiI*.9),side:THREE.BackSide}));band.position.y=1;es.add(band);
 if(T.lamps)for(let i=0;i<10;i++){const l=new THREE.Mesh(new THREE.SphereGeometry(2.2,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color(6,5.4,4.6)}));const a=i/10*TAU;l.position.set(Math.cos(a)*80,22,Math.sin(a)*80);es.add(l)}
 const pm=new THREE.PMREMGenerator(ren);if(ENVTEX)ENVTEX.dispose();ENVTEX=pm.fromScene(es,.02,.1,1000).texture;scene.environment=PERF.tier<1?null:ENVTEX;
 ENVMATS.forEach(m=>{const e=PERF.tier<1?ENVTEX:null;if(!!m.envMap!==!!e)m.needsUpdate=true;m.envMap=e});pm.dispose();es.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose()})}
// ================= TEXTURES =================
function cv(w,h,f){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');f(x,w,h);return c}
function tex(c,rep,srgb){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy());if(srgb)t.encoding=THREE.sRGBEncoding;return t}
function normalMapFrom(H,w,str,hgt){hgt=hgt||w;const c=document.createElement('canvas');c.width=w;c.height=hgt;const x=c.getContext('2d'),img=x.createImageData(w,hgt),d=img.data;
 const h=(i,j)=>H[((j+hgt)%hgt)*w+((i+w)%w)];for(let j=0;j<hgt;j++)for(let i=0;i<w;i++){const dx=(h(i+1,j)-h(i-1,j))*str,dy=(h(i,j+1)-h(i,j-1))*str,l=Math.hypot(dx,dy,1),k=(j*w+i)*4;d[k]=(-dx/l*.5+.5)*255;d[k+1]=(dy/l*.5+.5)*255;d[k+2]=(1/l*.5+.5)*255;d[k+3]=255}
 x.putImageData(img,0,0);return c}
function tileNoise(w,octaves,seed){const H=new Float32Array(w*w);let tot=0;for(let o=0;o<octaves.length;o++){const f=octaves[o],a=1/(o+1)**1.1;tot+=a;
 for(let j=0;j<w;j++)for(let i=0;i<w;i++){const u=i/w*f,v=j/w*f,xi=Math.floor(u),yi=Math.floor(v),xf=u-xi,yf=v-yi,s1=xf*xf*(3-2*xf),s2=yf*yf*(3-2*yf),
  g=(x,y)=>hash2(((x%f)+f)%f,((y%f)+f)%f,seed+o*7),A=g(xi,yi),Bq=g(xi+1,yi),Cq=g(xi,yi+1),Dq=g(xi+1,yi+1);H[j*w+i]+=a*(A+(Bq-A)*s1+(Cq-A)*s2+(A-Bq-Cq+Dq)*s1*s2)}}
 for(let i=0;i<H.length;i++)H[i]/=tot;return H}
const TX={};
function makeTextures(){const W=512;
 // groomed snow: corduroy ridges running down the fall line (texture v), crystals and a little wind texture. Tiles every 4 m.
 const Hn=tileNoise(W,[4,9,23,57,131],11),Hf=tileNoise(W,[64,160,320],29),Hc=new Float32Array(W*W);
 for(let j=0;j<W;j++)for(let i=0;i<W;i++){const k=j*W+i,w=Math.sin(i/W*TAU*36+Hn[k]*2.2);Hc[k]=(.5+.5*Math.sign(w)*Math.pow(Math.abs(w),.55))*.55+Hn[k]*.35+Hf[k]*.25}
 TX.cordN=tex(normalMapFrom(Hc,W,3.2));
 TX.snowN=tex(normalMapFrom(Hn.map((v,i)=>v*.8+Hf[i]*.35),W,2.6));
 TX.puff=new THREE.CanvasTexture(cv(64,64,(x)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.45,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}));
 TX.spark=new THREE.CanvasTexture(cv(32,32,(x)=>{const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,240,210,.9)');g.addColorStop(1,'rgba(255,200,120,0)');x.fillStyle=g;x.fillRect(0,0,32,32)}));
 // orange B-net: knotted mesh with transparency
 TX.net=tex(cv(128,128,(x,w,h)=>{x.clearRect(0,0,w,h);x.strokeStyle='rgba(255,98,26,1)';x.lineWidth=5;for(let i=-1;i<3;i++){x.beginPath();x.moveTo(i*64,0);x.lineTo(i*64+128,128);x.stroke();x.beginPath();x.moveTo(i*64+128,0);x.lineTo(i*64,128);x.stroke()}
  x.fillStyle='#ff7a33';for(let i=0;i<3;i++)for(let j=0;j<3;j++){x.beginPath();x.arc(i*64,j*64,4,0,TAU);x.fill()}}),[1,1]);
 // wood planks for the start house and rail decks
 TX.wood=tex(cv(256,256,(x,w,h)=>{const r=mulberry(5);for(let i=0;i<8;i++){const c=110+r()*40;x.fillStyle=`rgb(${c},${c*.7|0},${c*.45|0})`;x.fillRect(0,i*32,w,32);x.strokeStyle='rgba(40,24,12,.6)';x.lineWidth=2;x.beginPath();x.moveTo(0,i*32);x.lineTo(w,i*32);x.stroke();
  for(let k=0;k<26;k++){x.strokeStyle=`rgba(60,36,18,${.08+r()*.12})`;x.lineWidth=1;x.beginPath();const y=i*32+r()*32;x.moveTo(0,y);x.bezierCurveTo(w*.3,y+r()*6-3,w*.6,y+r()*6-3,w,y+r()*4-2);x.stroke()}}}),null,true);
 // event banner
 TX.banner=tex(cv(1024,128,(x,w,h)=>{x.fillStyle='#ff5a1f';x.fillRect(0,0,w,h);x.fillStyle='#1d2433';x.fillRect(0,h-14,w,14);x.fillStyle='#fff';x.font='800 78px Archivo,"Arial Black",sans-serif';x.textAlign='center';x.textBaseline='middle';
  for(let i=0;i<2;i++){x.save();x.translate(w/4+i*w/2,h/2-4);x.scale(1.15,1);x.fillText('DUB TEN',0,0);x.restore()}}),null,true);
 TX.bannerB=tex(cv(1024,128,(x,w,h)=>{x.fillStyle='#1d2433';x.fillRect(0,0,w,h);x.fillStyle='#1e5bff';x.fillRect(0,0,w,10);x.fillStyle='#f3f6f8';x.font='700 64px Archivo,"Arial Black",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('Freestyle terrain  ·  ride in control',w/2,h/2+4)}),null,true);
 TX.finish=tex(cv(1024,160,(x,w,h)=>{for(let i=0;i<32;i++)for(let j=0;j<5;j++){x.fillStyle=(i+j)%2?'#f3f6f8':'#1d2433';x.fillRect(i*32,j*32,32,32)}x.fillStyle='#ff5a1f';x.fillRect(220,20,w-440,h-40);x.fillStyle='#fff';x.font='800 92px Archivo,"Arial Black",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('FINISH',w/2,h/2+4)}),null,true);
 // round park sign: orange oval (freestyle terrain)
 TX.sign=tex(cv(256,256,(x,w,h)=>{x.clearRect(0,0,w,h);x.fillStyle='#ff5a1f';x.beginPath();x.ellipse(128,128,118,82,0,0,TAU);x.fill();x.strokeStyle='#fff';x.lineWidth=8;x.stroke();x.fillStyle='#fff';x.font='800 64px Archivo,"Arial Black",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('PARK',128,132)}),null,true);
}

// ================= PARKS: layout, analytic snow surface, rails =================
// The course runs down -Z: s = -z is distance along the course, the centerline sits at x = cx(s).
// Snow height = base slope + bank shaping + groomed undulation + the tallest feature at that point.
const PK={def:null,len:0,S0:-80,ys:null,cxs:null,ws:null,n:0,feats:[],rails:[],bk:[],BK:8,seed:1,lamps:[],cams:[],start:null,finishS:0,pipe:null};
const KICK={// ramp angle is relative to the slope; landing angle is absolute; tables are built nearly level
 XS:{lip:.9,ang:22,table:4,land:24,wr:4.6,wt:6.2,wl:8.5},
 S:{lip:1.3,ang:25,table:6.5,land:26,wr:5,wt:7,wl:10},
 M:{lip:1.85,ang:28,table:9.5,land:28,wr:5.6,wt:8,wl:12},
 L:{lip:2.55,ang:31,table:13,land:30,wr:6,wt:9,wl:13.5},
 XL:{lip:3.3,ang:33,table:17,land:31,wr:6.6,wt:10,wl:15},
 MEGA:{lip:4.4,ang:35,table:22,land:33,wr:7.4,wt:12,wl:19}};
// ---------------- base shape ----------------
function parkIdx(s){return clamp(s-PK.S0,0,PK.n-1.001)}
function ybaseS(s){const f=parkIdx(s),i=f|0,t=f-i;return PK.ys[i]+(PK.ys[i+1]-PK.ys[i])*t}
function cxS(s){const f=parkIdx(s),i=f|0,t=f-i;return PK.cxs[i]+(PK.cxs[i+1]-PK.cxs[i])*t}
function halfW(s){const f=parkIdx(s),i=f|0,t=f-i;return PK.ws[i]+(PK.ws[i+1]-PK.ws[i])*t}
function slopeAt(s){return(ybaseS(s-1)-ybaseS(s+1))/2}
function bankH(u,s,x,z){const W=halfW(s),a=Math.abs(u);let y=-.00042*u*u;
 if(a>W){const d=a-W;y+=d*d*.05+d*.1+(vn2(x*.045,z*.045,PK.seed+3)-.5)*Math.min(d,30)*.35+(d>45?(d-45)*(d-45)*.03:0)}return y}
function microH(x,z){return(vn2(x/24,z/24,PK.seed)-.5)*.55+(vn2(x/7.5,z/7.5,PK.seed+1)-.5)*.1}
// ---------------- features ----------------
function frameAt(s,u){const c=cxS(s),dc=(cxS(s+2)-cxS(s-2))/4;let dx=dc,dz=-1;const l=Math.hypot(dx,dz);dx/=l;dz/=l;return{o:{x:c+u,z:-s},d:{x:dx,z:dz},l:{x:-dz,z:dx}}}
function toLocal(f,x,z,out){const rx=x-f.o.x,rz=z-f.o.z;out.a=rx*f.d.x+rz*f.d.z;out.b=rx*f.l.x+rz*f.l.z;return out}
function toWorld(f,a,b,out){out.x=f.o.x+a*f.d.x+b*f.l.x;out.z=f.o.z+a*f.d.z+b*f.l.z;return out}
function regFeat(f){f.id=PK.feats.length;PK.feats.push(f);
 // bucket by s: corners of the local box
 let s0=1e9,s1=-1e9;const w={x:0,z:0};for(const a of[f.a0-12,f.a1+12])for(const b of[-f.bw-12,f.bw+12]){toWorld(f,a,b,w);s0=Math.min(s0,-w.z);s1=Math.max(s1,-w.z)}
 f.s0=s0;f.s1=s1;for(let k=Math.floor((s0-PK.S0)/PK.BK);k<=Math.floor((s1-PK.S0)/PK.BK);k++){if(k<0)continue;(PK.bk[k]||(PK.bk[k]=[])).push(f)}return f}
// table profile with side walls: P(a) height along the axis, W(a) top width
function tableFeat(type,s,u,P,Wt,da,sideK,extra){const fr=frameAt(s,u);let hm=0,wm=0;for(let i=0;i<P.length;i++){hm=Math.max(hm,P[i]);wm=Math.max(wm,Wt[i])}
 return regFeat(Object.assign(fr,{type,P,Wt,da,a0:0,a1:(P.length-1)*da,bw:wm/2+hm/sideK+.5,side:sideK,hmax:hm,fn:tableFn},extra||{}))}
function tableFn(f,a,b){if(a<=f.a0||a>=f.a1)return 0;const fi=a/f.da,i=fi|0,t=fi-i,p=f.P[i]+(f.P[i+1]-f.P[i])*t,w=f.Wt[i]+(f.Wt[i+1]-f.Wt[i])*t;
 const side=p+(w*.5-Math.abs(b))*f.side;if(side<=-.5)return 0;return Math.max(0,smin(p,side,.4))}
function kicker(s,u,size,opt){const p=Object.assign({},KICK[size]||size,opt||{});
 // average slope under the feature, so the table can be level in the world while the profile stays relative to the base
 // slope under the takeoff and table, and separately under the landing, so a landing can run onto a steeper hill
 const pre=KICK[size]||size,tabEnd=(pre.lip/(1-Math.cos((opt&&opt.ang||pre.ang)*PI/180)))*Math.sin((opt&&opt.ang||pre.ang)*PI/180)+(opt&&opt.table||pre.table);
 let bs=0;for(let i=0;i<6;i++)bs+=Math.atan(slopeAt(s+tabEnd*i/5));bs/=6;let bl=0;for(let i=0;i<6;i++)bl+=Math.atan(slopeAt(s+tabEnd+4+i*4));bl/=6;
 const al=p.ang*PI/180,R=p.lip/(1-Math.cos(al)),Lr=R*Math.sin(al),Lb=p.lipBack??.8,ht=p.lip-(p.drop??.32),Rk=p.knR??4.5;
 const tt=Math.max(0,bs-(p.tabAbs??2)*PI/180),br=Math.max(.07,p.land*PI/180-bl);
 let Rt=p.trR??16;const a1=Lr,a2=a1+Lb,a3=a2+p.table,h3=ht+p.table*Math.tan(tt),a4=a3+Rk*(Math.sin(tt)+Math.sin(br)),f4=h3+Rk*(Math.cos(br)-Math.cos(tt));
 let f5=Rt*(1-Math.cos(br));if(f5>f4*.5){Rt=f4*.5/(1-Math.cos(br));f5=f4*.5}
 const a5=a4+(f4-f5)/Math.tan(br),a6=a5+Rt*Math.sin(br),da=.05,N=Math.ceil(a6/da)+2,P=new Float32Array(N),W=new Float32Array(N);
 for(let i=0;i<N;i++){const a=i*da;let h;
  if(a<=a1)h=R-Math.sqrt(Math.max(0,R*R-a*a));else if(a<=a2){const t=(a-a1)/Lb;h=lerp(p.lip,ht,.5-.5*Math.cos(PI*t))}else if(a<=a3)h=ht+(a-a2)*Math.tan(tt);
  else if(a<=a4){const sp=clamp(Math.sin(tt)-(a-a3)/Rk,-1,1),ph=Math.asin(sp);h=h3+Rk*(Math.cos(ph)-Math.cos(tt))}
  else if(a<=a5)h=f4-(a-a4)*Math.tan(br);else if(a<=a6){const t=a6-a;h=Rt-Math.sqrt(Math.max(0,Rt*Rt-t*t))}else h=0;P[i]=Math.max(0,h);
  W[i]=a<a1?p.wr:a<a1+1.4?lerp(p.wr,p.wt,sstep(a1,a1+1.4,a)):a<a3?p.wt:lerp(p.wt,p.wl,sstep(a3,a5,a))}
 return tableFeat('kick',s,u,P,W,da,p.side||1.15,{lip:p.lip,lipA:a1,knA:a3,landA:a5,endA:a6,ang:p.ang,wr:p.wr,size:typeof size==='string'?size:'K',tableA:a2,name:p.name||'',landAbs:p.land})}
function wedge(s,u,h,ang,w,back){const al=ang*PI/180,R=h/(1-Math.cos(al)),Lr=R*Math.sin(al),Lb=h/Math.tan((back||35)*PI/180),da=.05,N=Math.ceil((Lr+Lb)/da)+2,P=new Float32Array(N),W=new Float32Array(N);
 for(let i=0;i<N;i++){const a=i*da;P[i]=a<=Lr?R-Math.sqrt(Math.max(0,R*R-a*a)):Math.max(0,h-(a-Lr)/Lb*h);W[i]=w}
 return tableFeat('wedge',s,u,P,W,da,1.3,{lipA:Lr,lip:h,wr:w})}
function deck(s,u,h,len,land,w,wl){return kicker(s,u,{lip:h,ang:16,table:len,land:land||29,wr:w||4,wt:w||4,wl:wl||(w||4)+2,drop:0,lipBack:.01,knR:3,trR:10,side:1.25})}
function rollers(s,u,n,h,L,w){const da=.05,N=Math.ceil(n*L/da)+2,P=new Float32Array(N),W=new Float32Array(N);for(let i=0;i<N;i++){const a=i*da,t=(a%L)/L;P[i]=a>n*L?0:h*Math.pow(Math.sin(PI*t),2);W[i]=w}return tableFeat('roll',s,u,P,W,da,.9)}
function pad(s,u,len,w){const fr=frameAt(s,u);return regFeat(Object.assign(fr,{type:'pad',a0:-2,a1:len+2,bw:w/2+1,hmax:0,fn:()=>0}))}
// superpipe: walls built on both sides of a flat bottom, faded in at the top
function pipe(s,len,o){const F=o.flat||16,r=o.r||6.4,hw=o.hw||6.7,dk=o.deck||4,fr=frameAt(s,0),db=.02,bmax=F/2+r+.4+dk+hw/0.9+1,N=Math.ceil(bmax/db)+2,PB=new Float32Array(N);
 const th=84*PI/180,dm=r*Math.sin(th),fm=r*(1-Math.cos(th)),ext=.45;
 for(let i=0;i<N;i++){const b=i*db,d=b-F/2;let h;
  if(d<=0)h=0;else if(d<=dm)h=r-Math.sqrt(Math.max(0,r*r-d*d));else if(d<=dm+ext)h=lerp(fm,hw,(d-dm)/ext);else if(d<=dm+ext+dk)h=hw;else h=Math.max(0,hw-(d-dm-ext-dk)*.9);PB[i]=h}
 const f=regFeat(Object.assign(fr,{type:'pipe',PB,db,a0:-6,a1:len,bw:bmax,hmax:hw,F,r,hw,dm,deckB:F/2+dm+ext,fin:o.fin||22,fn:pipeFn}));PK.pipe=f;return f}
function pipeFn(f,a,b){if(a<=f.a0||a>=f.a1)return 0;const fi=Math.abs(b)/f.db;if(fi>=f.PB.length-1)return 0;const i=fi|0,t=fi-i,h=f.PB[i]+(f.PB[i+1]-f.PB[i])*t;
 const fade=sstep(-6,f.fin,a)*(1-sstep(f.a1-8,f.a1,a));return h*fade}
// a snow deck with a rail or box on it: flat across the table, then down the landing (and out onto the snow when kinked)
function deckRail(s,u,o){const f=kicker(s,u,{lip:o.h||1.1,ang:o.ang||20,table:o.len||7.5,land:o.land||29,wr:o.w||4.2,wt:o.w||4.2,wl:(o.w||4.2)+2,drop:0,lipBack:.01,knR:3,trR:10,side:1.25});
 const a0=f.lipA+.35,a1=o.kink?f.endA+(o.kink||4):f.knA+(f.landA-f.knA)*(o.down??.8);rail(s,u,o.kind||'rail',[[a0,o.clr||.48],[a1,o.clr||.48]],{name:o.name,col:o.col});return f}
// a wedge to pop from, then a rail that follows the slope
function popRail(s,u,o){const w=wedge(s,u,o.h||.75,o.ang||26,o.w||3.6),Lb=(o.h||.75)/Math.tan(35*PI/180),a0=w.lipA+Lb+.15;
 rail(s,u,o.kind||'rail',[[a0,(o.h||.75)-.04],[a0+(o.len||12),(o.h||.75)-.12]],{name:o.name,col:o.col});return w}
// a box or rail that starts at snow level
function rideOn(s,u,o){rail(s,u,o.kind||'box',[[0,.04],[1.4,o.clr||.45],[o.len||11,o.clr||.45]],{ride:true,arc:o.arc||0,name:o.name,col:o.col})}
// approach speeds that land a straight air on the landing, from a quick ballistic sweep along the kicker's axis
function kickWindow(f){const w={x:0,z:0},Y=a=>{toWorld(f,a,0,w);return H(w.x,w.z)},yl=Y(f.lipA-.02),th=Math.atan2(Y(f.lipA-.02)-Y(f.lipA-.35),.33);let lo=0,hi=0;
 // window of speeds at the lip; the HUD projects the rider's speed forward to the lip
 for(let v0=5;v0<=34;v0+=.25){let x=0,y=yl,vx=v0*Math.cos(th),vy=v0*Math.sin(th),hit=0;
  for(let t=0;t<6;t+=.02){const s=Math.hypot(vx,vy),k=1-.0011*s*.02;vx*=k;vy=vy*k-G9*.02;x+=vx*.02;y+=vy*.02;if(t>.1&&y<=Y(f.lipA+x)){hit=f.lipA+x;break}}
  const ok=hit>f.knA+1.5&&hit<f.landA+1;if(ok&&!lo)lo=v0;if(ok)hi=v0;else if(lo&&hit>f.landA+1)break}
 f.win=lo?[lo,hi]:null;f.lipY=yl}
// projected speed at a kicker's lip from where the rider is now: height gained or lost, snow friction and drag
function lipSpeed(f,p,v,d){const L=toWorld(f,f.lipA,0,{x:0,z:0}),n=Math.max(1,Math.ceil(d/1.5));let v2=v*v,py=p.y;
 for(let i=1;i<=n;i++){const t=i/n,x=lerp(p.x,L.x,t),z=lerp(p.z,L.z,t),y=i===n?f.lipY:H(x,z),ds=Math.hypot(x-lerp(p.x,L.x,(i-1)/n),z-lerp(p.z,L.z,(i-1)/n),y-py);v2+=2*(G9*(py-y)-(.05*G9+.0052*v2)*ds);if(v2<0)v2=0;py=y}
 return Math.sqrt(v2)}
// popping within a ski length of a kicker's lip
function nearLip(p){for(const f of PK.feats){if(f.type!=='kick')continue;toLocal(f,p.x,p.z,_L);if(_L.a>f.lipA-1.9&&_L.a<f.lipA+.25&&Math.abs(_L.b)<f.wr*.5+.4)return f}return null}
// the kicker in the rider's lane ahead, if any
function kickAhead(p){let best=null,bd=1e9;for(const f of PK.feats){if(f.type!=='kick'||!f.win)continue;toLocal(f,p.x,p.z,_L);const d=f.lipA-_L.a;if(d<1||d>70||Math.abs(_L.b)>f.wr*.5+2)continue;if(d<bd){bd=d;best=f}}return best?{f:best,d:bd}:null}
// ---------------- height query ----------------
const _L={a:0,b:0},FH={m:1,f:null};
function featH(x,z){const s=-z,k=Math.floor((s-PK.S0)/PK.BK),B=PK.bk[k];let best=0,m=1,bf=null;if(!B){FH.m=1;FH.f=null;return 0}
 for(let i=0;i<B.length;i++){const f=B[i];toLocal(f,x,z,_L);const da=Math.max(f.a0-_L.a,_L.a-f.a1,0),db=Math.max(Math.abs(_L.b)-f.bw,0);
  if(da>10||db>10)continue;const dist=da+db;m=Math.min(m,sstep(0,10,dist));if(dist>0)continue;const v=f.fn(f,_L.a,_L.b);if(v>best){best=v;bf=f}}
 FH.m=m;FH.f=bf;return best}
function baseH(x,z){const s=-z;return ybaseS(s)+bankH(x-cxS(s),s,x,z)}
function H(x,z){const f=featH(x,z);return baseH(x,z)+microH(x,z)*FH.m*(PK.def.micro??1)+f}
const _n=new THREE.Vector3();
function Hn(x,z,out,e){e=e||.12;const hx=H(x+e,z)-H(x-e,z),hz=H(x,z+e)-H(x,z-e);return(out||_n).set(-hx/(2*e),1,-hz/(2*e)).normalize()}
// ---------------- rails, boxes and tubes: polylines a fixed clearance above the snow ----------------
// pts: [[a, clearance], ...] along the local axis; kinds: rail (round bar), box (flat top), tube (fat round)
function rail(s,u,kind,pts,o){o=o||{};const fr=frameAt(s,u);PK.rails.push({fr,kind,pts,w:o.w||(kind==='box'?.5:kind==='tube'?.36:.07),col:o.col??(kind==='box'?0xff5a1f:0xd0d4da),name:o.name||(kind==='box'?'Box':kind==='tube'?'Tube':'Rail'),arc:o.arc||0,ride:!!o.ride,start:pts[0][0],end:pts[pts.length-1][0]});
 pad(s+pts[0][0]-1,u,pts[pts.length-1][0]-pts[0][0]+2,2.5)}
function bakeRails(){const w={x:0,z:0};
 for(const r of PK.rails){const pts=r.pts,a0=pts[0][0],a1=pts[pts.length-1][0],n=Math.max(2,Math.ceil((a1-a0)/.25)),P=new Float32Array((n+1)*3);
  const clr=a=>{for(let i=0;i<pts.length-1;i++){if(a<=pts[i+1][0]){const t=(a-pts[i][0])/(pts[i+1][0]-pts[i][0]||1);return lerp(pts[i][1],pts[i+1][1],t)}}return pts[pts.length-1][1]};
  const raw=[];for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;toWorld(r.fr,a,0,w);const arc=r.arc?Math.sin(PI*i/n)*r.arc:0;raw.push([w.x,H(w.x,w.z)+clr(a)+arc,w.z])}
  // smooth the snow wobble out of the rail line but keep deliberate kinks
  for(let it=0;it<3;it++)for(let i=1;i<n;i++){const k=raw[i];k[1]=k[1]*.5+(raw[i-1][1]+raw[i+1][1])*.25}
  for(let i=0;i<=n;i++){P[i*3]=raw[i][0];P[i*3+1]=raw[i][1];P[i*3+2]=raw[i][2]}
  const L=new Float32Array(n+1);for(let i=1;i<=n;i++)L[i]=L[i-1]+Math.hypot(P[i*3]-P[i*3-3],P[i*3+1]-P[i*3-2],P[i*3+2]-P[i*3-1]);
  let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9,mny=1e9,mxy=-1e9;for(let i=0;i<=n;i++){mnx=Math.min(mnx,P[i*3]);mxx=Math.max(mxx,P[i*3]);mny=Math.min(mny,P[i*3+1]);mxy=Math.max(mxy,P[i*3+1]);mnz=Math.min(mnz,P[i*3+2]);mxz=Math.max(mxz,P[i*3+2])}
  Object.assign(r,{P,n,L,len:L[n],bb:[mnx-1.5,mny-2,mnz-1.5,mxx+1.5,mxy+2.5,mxz+1.5]})}}
// closest point on any rail to p; returns {r,i,t,d,y,dist along}
const RQ={r:null,i:0,t:0,dh:0,y:0,s:0,tx:0,ty:0,tz:0};
function railNear(p,maxH){let best=null,bd=1e9;
 for(const r of PK.rails){const b=r.bb;if(p.x<b[0]||p.x>b[3]||p.z<b[2]||p.z>b[5]||p.y<b[1]||p.y>b[4])continue;const P=r.P;
  for(let i=0;i<r.n;i++){const ax=P[i*3],ay=P[i*3+1],az=P[i*3+2],bx=P[i*3+3],by=P[i*3+4],bz=P[i*3+5],ex=bx-ax,ez=bz-az,l2=ex*ex+ez*ez||1e-6;let t=((p.x-ax)*ex+(p.z-az)*ez)/l2;t=clamp(t,0,1);
   const cx=ax+ex*t,cz=az+ez*t,dh=Math.hypot(p.x-cx,p.z-cz);if(dh>(maxH||1)+r.w)continue;if(dh<bd){bd=dh;best=r;Object.assign(RQ,{r,i,t,dh,y:ay+(by-ay)*t,s:r.L[i]+(r.L[i+1]-r.L[i])*t})}}}
 if(!best)return null;const P=best.P,i=RQ.i,ex=P[i*3+3]-P[i*3],ey=P[i*3+4]-P[i*3+1],ez=P[i*3+5]-P[i*3+2],l=Math.hypot(ex,ey,ez)||1;RQ.tx=ex/l;RQ.ty=ey/l;RQ.tz=ez/l;return RQ}
// position on rail r at distance s along it
function railAt(r,s,out,tan){s=clamp(s,0,r.len);let i=0;const L=r.L;let lo=0,hi=r.n;while(hi-lo>1){const m=(lo+hi)>>1;if(L[m]<=s)lo=m;else hi=m}i=lo;const t=(s-L[i])/((L[i+1]-L[i])||1),P=r.P;
 out.set(P[i*3]+(P[i*3+3]-P[i*3])*t,P[i*3+1]+(P[i*3+4]-P[i*3+1])*t,P[i*3+2]+(P[i*3+5]-P[i*3+2])*t);if(tan)tan.set(P[i*3+3]-P[i*3],P[i*3+4]-P[i*3+1],P[i*3+5]-P[i*3+2]).normalize();return out}
// ---------------- park definitions ----------------
// segs: [length, slope deg] starting at S0; width: [[s, half width]]; curve: [[s, centerline x]]
const PARKS=[
 {id:'night',name:'Night Shift',tod:'night',tag:'Floodlit slopestyle',blurb:'Three lanes of jumps, two rail zones and a pile of rollers under the lights. The open session park.',len:930,
  segs:[[22,4],[16,25],[60,12.5],[200,13],[160,12],[220,13.5],[160,12.5],[90,6],[200,3]],width:[[-80,14],[-30,16],[20,32],[880,32],[940,28],[1200,40]],curve:[[-80,0],[200,0],[420,10],[650,-6],[900,0],[1200,0]],
  build(){
   // rail zone one: ride-on box, flat-down rail on a deck, pop-on down rail
   rideOn(36,-14,{kind:'box',len:11,name:'Flat box',col:0x1e5bff});
   deckRail(30,0,{h:1.05,len:7.5,name:'Flat-down rail'});
   popRail(34,14,{h:.75,len:12,name:'Down rail'});
   // first jump line
   kicker(118,-17,'S');kicker(112,0,'M');kicker(106,17,'L');
   rollers(76,-27,2,.7,8,6);
   kicker(222,-10,'M');kicker(214,10,'L');
   // rail zone two: rainbow box, kinked rail, long tube
   rideOn(322,-16,{kind:'box',len:11,arc:.9,clr:.5,name:'Rainbow box',col:0xffd23f});
   deckRail(312,0,{h:1.2,len:6.5,land:30,kink:5,name:'Kinked rail'});
   rideOn(324,16,{kind:'tube',len:13,clr:.6,name:'Tube',col:0x2fd17a});
   // rollers and a butter pad
   rollers(408,-12,3,1.05,9,7);rollers(404,12,4,.55,6.5,9);
   kicker(492,-11,'L');kicker(484,11,'XL',{name:'Lot Nine'});
   kicker(606,0,'XL',{name:'Floodlight'});kicker(612,-20,'M');
   popRail(714,-13,{h:.8,len:15,name:'Long down rail'});
   deckRail(708,13,{h:1.15,len:8,kind:'box',name:'Flat-down box',col:0xff5a1f});
   kicker(800,0,'XL',{name:'Money booter'});kicker(806,-21,'S');kicker(806,21,'M');
   PK.finishS=900}},
 {id:'ridge',name:'Ridgeline',tag:'Pro kicker line',blurb:'Four big kickers in a row on a steep ridge at sunrise, with two rail decks between. Bring speed.',tod:'sunrise',len:820,
  segs:[[22,4],[18,27],[70,14],[260,14.5],[200,14],[160,14.5],[100,6],[200,3]],width:[[-80,14],[-30,16],[20,24],[790,24],[860,30],[1200,40]],curve:[[-80,0],[150,0],[360,-12],[560,8],[800,0],[1200,0]],
  build(){
   rideOn(42,-9,{kind:'rail',len:12,clr:.45,name:'Ride-on rail'});deckRail(36,8,{h:1.1,len:8,kind:'box',name:'Flat-down box',col:0x1e5bff});
   kicker(140,0,'L',{name:'Sunup'});
   kicker(268,0,'XL',{name:'The Shelf'});
   deckRail(384,-9,{h:1.2,len:9,land:31,name:'Flat-down rail'});popRail(388,9,{h:.8,len:12,kind:'tube',name:'Down tube',col:0xff5a1f});
   kicker(500,0,'XL',{name:'Dub Deck',table:19});
   kicker(640,0,'MEGA',{name:'Last Call',table:20});
   PK.finishS=790}},
 {id:'forest',name:'Forest Line',tag:'Woodland rail park',blurb:'A narrow line through the pines in falling snow. Rail after rail with jumps in between, built for linking long lines.',tod:'storm',len:860,
  segs:[[22,4],[16,24],[80,12],[240,12.5],[220,12],[180,12.5],[90,6],[200,3]],width:[[-80,13],[-30,15],[20,22],[830,22],[880,28],[1200,40]],curve:[[-80,0],[120,0],[260,-14],[420,6],[600,-10],[800,0],[1200,0]],micro:.7,
  build(){
   rideOn(30,-7,{kind:'box',len:10,name:'Wide box',col:0x2fd17a});popRail(26,7,{h:.7,len:11,name:'Down rail'});
   kicker(92,0,'M');
   deckRail(150,-7,{h:1.1,len:7,kind:'box',name:'Flat-down box',col:0xffd23f});rideOn(156,8,{kind:'rail',len:12,clr:.45,name:'Ride-on rail'});
   kicker(222,-3,'L',{name:'Pine Gap'});
   rideOn(290,-8,{kind:'tube',len:12,clr:.6,arc:.7,name:'Rainbow tube',col:0xff5a1f});deckRail(286,8,{h:1.2,len:6.5,land:30,kink:5,name:'Kinked rail'});
   rollers(342,0,3,.9,8.5,8);
   kicker(410,0,'L',{name:'The Clearing'});
   popRail(474,-7,{h:.8,len:14,name:'Long down rail'});rideOn(478,7,{kind:'box',len:12,clr:.5,name:'Long box',col:0x1e5bff});
   kicker(540,-4,'XL',{name:'Big Pine'});
   deckRail(612,0,{h:1.15,len:8,name:'Flat-down rail'});
   rideOn(668,-8,{kind:'box',len:10,arc:.8,clr:.5,name:'Rainbow box',col:0xf27fb2});popRail(664,8,{h:.75,len:12,kind:'tube',name:'Down tube',col:0x2fd17a});
   kicker(730,0,'L',{name:'Last Run'});
   PK.finishS=830}},
 {id:'bigair',name:'Big Air',tag:'One huge jump',blurb:'A scaffold inrun and the biggest kicker on the mountain. Learn a trick here, then go bigger.',tod:'golden',len:260,
  segs:[[30,3],[70,32],[26,10],[44,10],[60,31],[70,7],[200,2]],width:[[-80,9],[-12,10],[10,18],[200,26],[300,40]],curve:[[-80,0],[300,0]],micro:.4,
  build(){kicker(50,0,'MEGA',{name:'Big Air',table:22,land:37,wl:22,wt:13,tabAbs:0,trR:30});PK.finishS=215;PK.def.tower=1}},
 {id:'pipe',name:'Superpipe',tag:'22 foot halfpipe',blurb:'A long, steep superpipe with tall walls. Ride up the walls, go above the lip and spin back in.',tod:'day',len:270,
  segs:[[18,4],[22,21],[300,17],[80,5],[200,2]],width:[[-80,30],[300,30]],curve:[[-80,0],[400,0]],micro:.15,
  build(){pipe(-14,250,{flat:15,r:5.3,hw:5.6,deck:4.5,fin:16});PK.finishS=240}}];
function buildPark(id){const def=PARKS.find(p=>p.id===id)||PARKS[0];PK.def=def;PK.feats=[];PK.rails=[];PK.bk=[];PK.lamps=[];PK.cams=[];PK.pipe=null;PK.seed=(def.id.charCodeAt(0)*31+def.id.length)|0;
 const end=def.len+260;PK.n=Math.ceil(end-PK.S0)+2;PK.ys=new Float32Array(PK.n);PK.cxs=new Float32Array(PK.n);PK.ws=new Float32Array(PK.n);
 // slope table (deg per metre), smoothed so section changes are gentle rolls rather than creases
 const sl=new Float32Array(PK.n);let s=PK.S0,k=0;for(const[L,d]of def.segs){for(let i=0;i<L&&k<PK.n;i++,k++)sl[k]=Math.tan(d*PI/180)}while(k<PK.n){sl[k]=sl[k-1]||0;k++}
 const sm=new Float32Array(PK.n),R=def.id==='bigair'?5:9;for(let i=0;i<PK.n;i++){let a=0,c=0;for(let j=-R;j<=R;j++){const q=clamp(i+j,0,PK.n-1),w=1-Math.abs(j)/(R+1);a+=sl[q]*w;c+=w}sm[i]=a/c}
 PK.ys[0]=0;for(let i=1;i<PK.n;i++)PK.ys[i]=PK.ys[i-1]-sm[i];
 const ctl=(arr,s)=>{if(s<=arr[0][0])return arr[0][1];for(let i=0;i<arr.length-1;i++)if(s<=arr[i+1][0]){const t=(s-arr[i][0])/(arr[i+1][0]-arr[i][0]);return lerp(arr[i][1],arr[i+1][1],.5-.5*Math.cos(PI*t))}return arr[arr.length-1][1]};
 for(let i=0;i<PK.n;i++){const s=PK.S0+i;PK.cxs[i]=ctl(def.curve,s);PK.ws[i]=ctl(def.width,s)}
 PK.len=def.len;PK.finishS=def.len-30;def.build();bakeRails();for(const f of PK.feats)if(f.type==='kick')kickWindow(f);
 PK.start={s:-62,x:cxS(-62)};return def}

// ================= WORLD: snow meshes, features, rails, scenery =================
const WORLD={root:null,chunks:[],feats:[],rails:[],treeChunks:[],chairs:null,chairT:[],lift:null,crowd:null,glows:null,mats:{},t:0};
const MAT={};
// groomed snow: corduroy normal map mixed with plain wind-packed snow outside the piste, sparkle, floodlight shading
function snowMaterial(key){const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.66,metalness:0,normalMap:TX.cordN,normalScale:new THREE.Vector2(.7,.7),envMapIntensity:.32});
 m.userData.u={sunView:{value:new THREE.Vector3()},sunCol:{value:new THREE.Color()},spark:{value:1.3},snowN2:{value:TX.snowN}};m.userData.key='snow'+(key||'');
 m.userData.obc=sh=>{Object.assign(sh.uniforms,m.userData.u);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nattribute float groom;varying float vGroom;varying vec3 vWP;')
   .replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;vGroom=groom;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying float vGroom;varying vec3 vWP;uniform vec3 sunView;uniform vec3 sunCol;uniform float spark;uniform sampler2D snowN2;')
   .replace('#include <normal_fragment_maps>',`{vec3 nA=texture2D(normalMap,vUv).xyz,nB=texture2D(snowN2,vUv*.61+vec2(.37,.11)).xyz;vec3 mapN=mix(nB,nA,clamp(vGroom,0.,1.))*2.-1.;mapN.xy*=normalScale*(1.-.45*smoothstep(25.,90.,length(vViewPosition)));normal=perturbNormal2Arb(-vViewPosition,normal,mapN,faceDirection);}`)
   .replace('#include <tonemapping_fragment>',`{vec3 cp=floor(vWP*15.);float hs=fract(sin(dot(cp,vec3(12.9898,78.233,37.719)))*43758.5453);
    vec3 Vd=normalize(vViewPosition);vec3 Hh=normalize(sunView+Vd);vec3 fn=normalize(normal+(vec3(fract(hs*13.1),fract(hs*71.7),fract(hs*37.3))-.5)*.9);
    float sp=pow(max(dot(fn,Hh),0.),1200.)*step(.6,hs)*smoothstep(60.,5.,length(vViewPosition));gl_FragColor.rgb+=mix(sunCol,vec3(dot(sunCol,vec3(.333))),.7)*sp*spark*18.;}
    #include <tonemapping_fragment>`)};
 lampify(m);return m}
function std(p,env){const m=new THREE.MeshStandardMaterial(p);if(env!==false)envOwn(m);return lampify(m)}
// ---------------- terrain chunks (base snow, no features) ----------------
function terrainH(x,z){featH(x,z);return baseH(x,z)+microH(x,z)*FH.m*(PK.def.micro??1)}
function uSamples(W,fine){const u=[0];let a=0;const ins=W+18;while(a<ins){a+=fine;u.push(a)}let st=2;while(a<260){a+=st;u.push(a);st=Math.min(st*1.22,14)}const out=[];for(let i=u.length-1;i>0;i--)out.push(-u[i]);return out.concat(u)}
function buildChunk(s0,s1,fine){// one lateral sampling for every chunk, so neighbouring chunks share their seam vertices (no cracks)
 let W=0;for(let s=PK.S0;s<=PK.len+240;s+=5)W=Math.max(W,halfW(s));const U=uSamples(W,fine),nu=U.length,ns=Math.max(2,Math.round((s1-s0)/fine)+1),N=nu*ns;
 const P=new Float32Array(N*3),Nr=new Float32Array(N*3),C=new Float32Array(N*3),UV=new Float32Array(N*2),Gm=new Float32Array(N),I=[];const e=.6;
 for(let j=0;j<ns;j++){const s=s0+(s1-s0)*j/(ns-1),c=cxS(s),w=halfW(s);for(let i=0;i<nu;i++){const k=j*nu+i,u=U[i],x=c+u,z=-s,y=terrainH(x,z);
  P[k*3]=x;P[k*3+1]=y;P[k*3+2]=z;const hx=terrainH(x+e,z)-terrainH(x-e,z),hz=terrainH(x,z+e)-terrainH(x,z-e),l=Math.hypot(hx,2*e,hz);Nr[k*3]=-hx/l;Nr[k*3+1]=2*e/l;Nr[k*3+2]=-hz/l;
  const off=sstep(w-1,w+6,Math.abs(u)),n1=vn2(x*.06,z*.06,PK.seed+9);const v=1-off*(.05+.06*n1);
  // wind-scoured rock shows through on the steep banks
  const n2=vn2(x*.11,z*.11,PK.seed+17),rock=off*sstep(.8,.55,Nr[k*3+1]+(n2-.5)*.35)*sstep(.35,.6,n2*.7+n1*.5),rc=.3+.12*n1;
  C[k*3]=lerp(v*.985,rc*1.05,rock);C[k*3+1]=lerp(v*.99,rc,rock);C[k*3+2]=lerp(v,rc*.95,rock);Gm[k]=(1-off)*(1-rock);UV[k*2]=x/4;UV[k*2+1]=s/4}}
 for(let j=0;j<ns-1;j++)for(let i=0;i<nu-1;i++){const a=j*nu+i,b=a+nu;I.push(a,b,a+1,b,b+1,a+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(Nr,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));
 g.setAttribute('uv',new THREE.BufferAttribute(UV,2));g.setAttribute('groom',new THREE.BufferAttribute(Gm,1));g.setIndex(N>65535?new THREE.Uint32BufferAttribute(I,1):new THREE.Uint16BufferAttribute(I,1));g.computeBoundingSphere();
 const m=new THREE.Mesh(g,MAT.snow);m.receiveShadow=true;return m}
// ---------------- park features ----------------
function featMesh(f){const isPipe=f.type==='pipe',A=[],B=[];
 if(isPipe){for(let a=f.a0;a<=f.a1+.01;a+=PERF.tier<1?2.2:1.4)A.push(a);A.push(f.a1)}
 else{let a=f.a0-.6;const lo=PERF.tier<1,hot=[f.lipA,f.knA,f.tableA].filter(v=>v!==undefined);while(a<=f.a1+.6){A.push(a);const near=hot.some(h=>Math.abs(a-h)<.8);a+=near?(lo?.14:.09):(f.type==='roll'?.3:lo?.55:.4)}}
 if(isPipe){const bs=[0];let b=0;while(b<f.bw){const st=b<f.F/2-1?1:b<f.deckB+.3?.12:b<f.deckB+4.6?.6:1;b+=st;bs.push(b)}for(let i=bs.length-1;i>0;i--)B.push(-bs[i]);B.push(...bs)}
 else{const nc=PERF.tier<1?24:36;for(let i=0;i<=nc;i++)B.push(i/nc*2-1)}// table features: columns are fractions of each row's own width
 const na=A.length,nb=B.length,N=na*nb,P=new Float32Array(N*3),Nr=new Float32Array(N*3),C=new Float32Array(N*3),UV=new Float32Array(N*2),Gm=new Float32Array(N),I=[],w={x:0,z:0},nv=new THREE.Vector3();
 const rowW=a=>{if(isPipe||!f.P)return 1;const fi=clamp(a/f.da,0,f.P.length-1)|0,fj=clamp((a+1)/f.da,0,f.P.length-1)|0,fk=clamp((a-1)/f.da,0,f.P.length-1)|0;const h=Math.max(f.P[fi],f.P[fj],f.P[fk]),wd=Math.max(f.Wt[fi],f.Wt[fj],f.Wt[fk]);return wd*.5+h/f.side+.8};
 for(let j=0;j<na;j++){const rw=rowW(A[j]);for(let i=0;i<nb;i++){const k=j*nb+i,a=A[j],b=isPipe||!f.P?B[i]:B[i]*rw;toWorld(f,a,b,w);const fh=f.fn(f,a,b);let y=H(w.x,w.z);if(fh<.015)y-=.05;
  P[k*3]=w.x;P[k*3+1]=y;P[k*3+2]=w.z;Hn(w.x,w.z,nv,isPipe?.05:.07);Nr[k*3]=nv.x;Nr[k*3+1]=nv.y;Nr[k*3+2]=nv.z;
  let dye=0;if(f.type==='kick'){const wr=f.wr*.5-.15;if(a>f.lipA-.24&&a<f.lipA-.02&&Math.abs(b)<wr)dye=1;if(a>f.knA+.3&&a<f.knA+.5&&Math.abs(b)<f.Wt[Math.min(f.Wt.length-1,(f.knA/f.da)|0)]*.5-.4)dye=1}
  else if(f.type==='wedge'){if(a>f.lipA-.2&&a<f.lipA&&Math.abs(b)<f.wr*.5-.1)dye=1}
  else if(isPipe){const d=Math.abs(b)-f.deckB;if(d>-.02&&d<.22&&a>f.fin)dye=1}
  const sh=1-.04*vn2(w.x*.2,w.z*.2,7),wall=sstep(.93,.55,nv.y);C[k*3]=dye?.1:sh*(.985-.2*wall);C[k*3+1]=dye?.32:sh*(.99-.15*wall);C[k*3+2]=dye?.95:sh*(1-.07*wall);Gm[k]=1;UV[k*2]=b/4;UV[k*2+1]=a/4}}
 for(let j=0;j<na-1;j++)for(let i=0;i<nb-1;i++){const a=j*nb+i,b=a+nb;I.push(a,b,a+1,b,b+1,a+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setAttribute('normal',new THREE.BufferAttribute(Nr,3));g.setAttribute('color',new THREE.BufferAttribute(C,3));
 g.setAttribute('uv',new THREE.BufferAttribute(UV,2));g.setAttribute('groom',new THREE.BufferAttribute(Gm,1));g.setIndex(N>65535?new THREE.Uint32BufferAttribute(I,1):new THREE.Uint16BufferAttribute(I,1));g.computeBoundingSphere();
 const m=new THREE.Mesh(g,MAT.snow);m.receiveShadow=true;m.castShadow=!isPipe&&f.hmax>.5&&save.set.q>0;return m}
// ---------------- rails ----------------
function tubeAlong(P,n,rad,seg,yoff){const V=[],Nn=[],UVs=[],I=[];const t=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),b1=new THREE.Vector3(),b2=new THREE.Vector3();
 for(let i=0;i<=n;i++){const j=Math.min(i,n-1),k=Math.max(i-1,0);t.set(P[(j+1)*3]-P[k*3],P[(j+1)*3+1]-P[k*3+1],P[(j+1)*3+2]-P[k*3+2]).normalize();b1.crossVectors(t,up).normalize();b2.crossVectors(b1,t).normalize();
  for(let q=0;q<=seg;q++){const a=q/seg*TAU,cx=Math.cos(a),sy=Math.sin(a),nx=b1.x*cx+b2.x*sy,ny=b1.y*cx+b2.y*sy,nz=b1.z*cx+b2.z*sy;V.push(P[i*3]+nx*rad,P[i*3+1]+ny*rad-yoff,P[i*3+2]+nz*rad);Nn.push(nx,ny,nz);UVs.push(q/seg,i/n)}}
 for(let i=0;i<n;i++)for(let q=0;q<seg;q++){const a=i*(seg+1)+q,b=a+seg+1;I.push(a,b,a+1,b,b+1,a+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(V,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(Nn,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UVs,2));g.setIndex(I);return g}
function boxAlong(r){// flat top, metal edges, solid side skirts down into the snow
 const P=r.P,n=r.n,hw=.24,V=[],Nn=[],Cc=[],I=[],t=new THREE.Vector3(),lat=new THREE.Vector3(),col=new THREE.Color(r.col),top=new THREE.Color(0xe9ecef),edge=new THREE.Color(0x9aa3ad);
 const quad=(a,b,c,d,nrm,cl)=>{const o=V.length/3;for(const p of[a,b,c,d]){V.push(p[0],p[1],p[2]);Nn.push(nrm[0],nrm[1],nrm[2]);Cc.push(cl.r,cl.g,cl.b)}I.push(o,o+1,o+2,o,o+2,o+3)};
 for(let i=0;i<n;i++){const ax=P[i*3],ay=P[i*3+1],az=P[i*3+2],bx=P[i*3+3],by=P[i*3+4],bz=P[i*3+5];t.set(bx-ax,0,bz-az).normalize();lat.set(-t.z,0,t.x);
  const L=(x,y,z,s)=>[x+lat.x*s,y,z+lat.z*s],gA=H(ax,az)-.15,gB=H(bx,bz)-.15;
  quad(L(ax,ay,az,-hw),L(bx,by,bz,-hw),L(bx,by,bz,hw),L(ax,ay,az,hw),[0,1,0],top);
  for(const sd of[-1,1]){const e0=L(ax,ay,az,sd*hw),e1=L(bx,by,bz,sd*hw),e2=L(bx,by-.05,bz,sd*(hw+.01)),e3=L(ax,ay-.05,az,sd*(hw+.01));quad(e0,e3,e2,e1,[lat.x*sd,0,lat.z*sd],edge);
   const s0=L(ax,ay-.05,az,sd*(hw+.01)),s1=L(bx,by-.05,bz,sd*(hw+.01)),s2=L(bx,gB,bz,sd*(hw+.04)),s3=L(ax,gA,az,sd*(hw+.04));quad(s0,s3,s2,s1,[lat.x*sd,0,lat.z*sd],col)}}
 // end caps
 for(const e of[0,n]){const x=P[e*3],y=P[e*3+1],z=P[e*3+2],k=e?n-1:0;t.set(P[(k+1)*3]-P[k*3],0,P[(k+1)*3+2]-P[k*3+2]).normalize();lat.set(-t.z,0,t.x);const g=H(x,z)-.15,sg=e?1:-1;
  const a=[x-lat.x*hw,y,z-lat.z*hw],b=[x+lat.x*hw,y,z+lat.z*hw],c=[x+lat.x*hw,g,z+lat.z*hw],d=[x-lat.x*hw,g,z-lat.z*hw];quad(a,b,c,d,[t.x*sg,0,t.z*sg],col)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(V,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(Nn,3));g.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));g.setIndex(I);return g}
function buildRails(grp){const posts=[];
 for(const r of PK.rails){let mesh;
  if(r.kind==='box'){mesh=new THREE.Mesh(boxAlong(r),MAT.box)}
  else{const rad=r.kind==='tube'?.19:.042;mesh=new THREE.Mesh(tubeAlong(r.P,r.n,rad,r.kind==='tube'?14:10,rad),r.kind==='tube'?std({color:r.col,roughness:.35,metalness:.2}):MAT.steel);
   const step=r.kind==='tube'?2:2.3,cnt=Math.max(2,Math.round(r.len/step));for(let i=0;i<=cnt;i++){const p=railAt(r,r.len*i/cnt,new THREE.Vector3()),g=H(p.x,p.z);posts.push([p.x,g-.2,p.z,p.y-(r.kind==='tube'?.3:.05)-g+.2])}}
  mesh.castShadow=true;mesh.receiveShadow=true;grp.add(mesh)}
 if(posts.length){const pg=new THREE.CylinderGeometry(.045,.055,1,8);pg.translate(0,.5,0);const im=new THREE.InstancedMesh(pg,MAT.steelDark,posts.length),M=new THREE.Matrix4();
  posts.forEach((p,i)=>{M.makeScale(1,Math.max(.05,p[3]),1);M.setPosition(p[0],p[1],p[2]);im.setMatrixAt(i,M)});im.castShadow=true;grp.add(im)}}
// ---------------- trees ----------------
function branchAtlas(){const W=1024,H=512;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');const r=mulberry(4242);
 const greens=['#14301f','#1a3a25','#21452c','#2a5233','#183424','#0f2618'];
 for(let tile=0;tile<4;tile++){const ox=(tile%2)*512,oy=(tile>>1)*256,snowy=[.75,.45,.9,.25][tile];x.save();x.translate(ox,oy);x.beginPath();x.rect(0,0,512,256);x.clip();
  const droop=r()*30+10,stem=t=>[8+t*490,128+Math.sin(t*1.4)*droop*t-10*t];
  const twigs=[];for(let t=0;t<1;t+=.045+r()*.02){const [sx,sy]=stem(t);for(const sd of[-1,1]){const len=(1-t*.75)*(70+r()*40),a=sd*(.55+r()*.45)+(r()-.5)*.2;twigs.push([sx,sy,a,len,t])}}
  // needles: many short dark strokes along stem + twigs
  const needles=(x0,y0,ang,len,dens)=>{const n=Math.floor(len*dens);for(let i=0;i<n;i++){const t=i/n,px=x0+Math.cos(ang)*len*t,py=y0+Math.sin(ang)*len*t;for(const sd of[-1,1]){const na=ang+sd*(.9+r()*.5),nl=7+r()*7*(1-t*.5);x.strokeStyle=greens[(r()*greens.length)|0];x.globalAlpha=.85+r()*.15;x.lineWidth=1.3+r()*1.2;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(na)*nl,py+Math.sin(na)*nl);x.stroke()}}};
  x.lineCap='round';
  for(const [sx,sy,a,len] of twigs){x.strokeStyle='#3b2d22';x.lineWidth=2;x.globalAlpha=1;x.beginPath();x.moveTo(sx,sy);x.lineTo(sx+Math.cos(a)*len,sy+Math.sin(a)*len);x.stroke()}
  x.strokeStyle='#4a3627';x.lineWidth=5;x.beginPath();for(let t=0;t<=1;t+=.05){const [px,py]=stem(t);t?x.lineTo(px,py):x.moveTo(px,py)}x.stroke();
  for(const [sx,sy,a,len] of twigs)needles(sx,sy,a,len,1.3);
  for(let t=0;t<1;t+=.01){const [px,py]=stem(t);needles(px,py,-1.2,10,1.2)}
  // snow sitting on the upper side of the bough
  x.globalAlpha=1;for(let i=0;i<260*snowy;i++){const tw=twigs[(r()*twigs.length)|0],t=r(),px=tw[0]+Math.cos(tw[2])*tw[3]*t,py=tw[1]+Math.sin(tw[2])*tw[3]*t-4,rad=(5+r()*11)*(1-tw[4]*.5);
   const g=x.createRadialGradient(px,py-rad*.3,rad*.1,px,py,rad);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.7,'rgba(226,236,248,.95)');g.addColorStop(1,'rgba(200,215,235,0)');x.fillStyle=g;x.beginPath();x.ellipse(px,py,rad*1.3,rad*.75,tw[2]*.3,0,TAU);x.fill()}
  x.restore()}
 const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t}
function cardTreeGeo(variant){const P=[],N=[],UV=[],Cc=[],I=[],r=mulberry(variant*977+13);let vi=0;const H=10;
 const tiles=[[0,.5],[.5,.5],[0,0],[.5,0]],snowT=variant===1?[1,3]:[0,2];
 const quad=(p0,p1,p2,p3,tile,shade0,shade1,center)=>{const [u0,v0]=tiles[tile];const pts=[p0,p1,p2,p3],uvs=[[u0,v0],[u0+.5,v0],[u0+.5,v0+.5],[u0,v0+.5]],sh=[shade0,shade1,shade1,shade0];
  for(let i=0;i<4;i++){const p=pts[i];P.push(p[0],p[1],p[2]);let nx=p[0]-center[0],ny=(p[1]-center[1])*.5+1.3,nz=p[2]-center[2];const l=Math.hypot(nx,ny,nz)||1;N.push(nx/l,ny/l,nz/l);UV.push(uvs[i][0],uvs[i][1]);Cc.push(sh[i],sh[i],sh[i])}
  I.push(vi,vi+1,vi+2,vi,vi+2,vi+3);vi+=4};
 // trunk
 const ts=8;for(let i=0;i<ts;i++){const a=i/ts*TAU,b=(i+1)/ts*TAU,r0=.24,r1=.05,c0=[.23,.17,.12];
  const q=[[Math.cos(a)*r0,0,Math.sin(a)*r0],[Math.cos(b)*r0,0,Math.sin(b)*r0],[Math.cos(b)*r1,H*.95,Math.sin(b)*r1],[Math.cos(a)*r1,H*.95,Math.sin(a)*r1]];
  for(let k=0;k<4;k++){P.push(...q[k]);const ang=k===1||k===2?b:a;N.push(Math.cos(ang),0,Math.sin(ang));UV.push(.99,.99);Cc.push(c0[0]*1.6,c0[1]*1.6,c0[2]*1.6)}I.push(vi,vi+2,vi+1,vi,vi+3,vi+2);vi+=4}
 const tiers=variant===1?12:15,per=variant===1?5:6;let rot=r()*TAU;
 for(let k=0;k<tiers;k++){const f=k/(tiers-1),y=H*(.1+.84*f),L=(variant===1?H*.26:H*.3)*Math.pow(1-f,variant===1?.9:1.05)+.35,droop=L*(.32-f*.15),w=L*.42;
  rot+=2.39996;const yc=y-L*.3;
  for(let b=0;b<per;b++){const a=rot+b/per*TAU+(r()-.5)*.4,ca=Math.cos(a),sa=Math.sin(a),px=-sa,pz=ca;const tile=snowT[(r()*2)|0];
   const base=[ca*.1,y,sa*.1],tip=[ca*L,y-droop,sa*L],sh0=.42+.25*f,sh1=.85+.15*f;
   for(const tilt of[.42,-.25]){const ux=px*w*.5,uy=tilt*w,uz=pz*w*.5;
    quad([base[0]-ux,base[1]-uy*.3,base[2]-uz],[tip[0]-ux,tip[1]-uy,tip[2]-uz],[tip[0]+ux,tip[1]+uy,tip[2]+uz],[base[0]+ux,base[1]+uy*.3,base[2]+uz],tile,sh0,sh1,[0,yc,0])}}}
 // spire
 for(let i=0;i<3;i++){const a=i/3*PI,ca=Math.cos(a)*.55,sa=Math.sin(a)*.55;quad([-ca,H*.86,-sa],[ca,H*.86,sa],[ca*.2,H*1.03,sa*.2],[-ca*.2,H*1.03,-sa*.2],snowT[0],.7,.9,[0,H*.9,0])}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));g.setIndex(I);g.computeBoundingSphere();return g}
function treeMats(atlas){const m=new THREE.MeshStandardMaterial({map:atlas,alphaTest:.45,side:THREE.DoubleSide,vertexColors:true,roughness:.92,metalness:0,envMapIntensity:.45});
 m.userData.u={time:{value:0}};
 const wind=sh=>{Object.assign(sh.uniforms,m.userData.u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float time;').replace('#include <begin_vertex>',`#include <begin_vertex>
   #ifdef USE_INSTANCING
   vec3 ip=vec3(instanceMatrix[3][0],0.,instanceMatrix[3][2]);float sw=sin(time*1.1+ip.x*.13+ip.z*.11)*.0016*transformed.y*transformed.y;transformed.x+=sw;transformed.z+=sw*.6;
   #endif`)};
 m.onBeforeCompile=wind;m.customProgramCacheKey=()=>'treecard';
 const d=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:atlas,alphaTest:.45,side:THREE.DoubleSide});return{m,d}}
// render a near tree from the side into a texture, used as a camera-facing card far away
function bakeImpostor(geo,mat){const W=256,Hh=512,rt=new THREE.WebGLRenderTarget(W,Hh,{format:THREE.RGBAFormat,type:THREE.UnsignedByteType,minFilter:THREE.LinearMipmapLinearFilter,magFilter:THREE.LinearFilter,generateMipmaps:true});
 const sc=new THREE.Scene();const mesh=new THREE.Mesh(geo,mat);sc.add(mesh);sc.add(new THREE.HemisphereLight(0xe8f0ff,0xa0aabb,1.6));const dl=new THREE.DirectionalLight(0xffffff,1.9);dl.position.set(3,8,6);sc.add(dl);
 const oc=new THREE.OrthographicCamera(-3.6,3.6,10.6,-.6,.1,50);oc.position.set(0,5,20);oc.lookAt(0,5,0);
 const prevT=ren.getRenderTarget(),pc=new THREE.Color();ren.getClearColor(pc);const pa=ren.getClearAlpha();ren.setClearColor(0x2d4433,0);ren.setRenderTarget(rt);ren.clear();ren.render(sc,oc);ren.setRenderTarget(prevT);ren.setClearColor(pc,pa);
 const t=rt.texture;t.encoding=THREE.LinearEncoding;return t}
function impostorMat(tex){const m=new THREE.MeshStandardMaterial({map:tex,color:new THREE.Color(.78,.9,.8),alphaTest:.3,roughness:.95,metalness:0,envMapIntensity:.3,side:THREE.DoubleSide});
 m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
   #ifdef USE_INSTANCING
   vec3 ipn=vec3(instanceMatrix[3][0],0.,instanceMatrix[3][2]);vec3 tcn=cameraPosition-ipn;float angn=atan(tcn.x,tcn.z);float cn=cos(angn),snn=sin(angn);objectNormal=vec3(objectNormal.x*cn+objectNormal.z*snn,objectNormal.y,-objectNormal.x*snn+objectNormal.z*cn);
   #endif`).replace('#include <begin_vertex>',`#include <begin_vertex>
   #ifdef USE_INSTANCING
   transformed=vec3(transformed.x*cn+transformed.z*snn,transformed.y,-transformed.x*snn+transformed.z*cn);
   #endif`)};
 m.customProgramCacheKey=()=>'impostor';return m}
function impostorGeo(){const g=new THREE.PlaneGeometry(7.2,11.2);g.translate(0,5,0);const n=g.attributes.normal;for(let i=0;i<n.count;i++)n.setXYZ(i,0,.45,.89);return g}
// trees: the row along the run edge uses needle-card spruces when the camera is near; everything else is a baked camera-facing card
function buildTrees(grp){const r=mulberry(PK.seed*7+3),CL=60,lift=PK.def.liftU,thin=PERF.tier<1?.75:1;
 if(!MAT.treeCard){const atlas=branchAtlas(),TM=treeMats(atlas);MAT.treeCard=TM.m;MAT.treeDepth=TM.d;MAT.gA=cardTreeGeo(0);MAT.gB=cardTreeGeo(1);MAT.impA=impostorMat(bakeImpostor(MAT.gA,TM.m));MAT.impB=impostorMat(bakeImpostor(MAT.gB,TM.m));MAT.impG=impostorGeo();for(const[m,k]of[[MAT.treeCard,'tc'],[MAT.impA,'ia'],[MAT.impB,'ib']]){m.userData.obc=m.onBeforeCompile;m.userData.key=k;lampify(m)}}
 const mk=(g,mat,M,card)=>{const im=new THREE.InstancedMesh(g,mat,M.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();M.forEach((t,i)=>{e.set(0,card?t[4]:0,0);q.setFromEuler(e);m.compose(new THREE.Vector3(t[0],t[1],t[2]),q,new THREE.Vector3(t[3],t[3]*(.92+.16*((i*13)%7)/7),t[3]));im.setMatrixAt(i,m)});im.computeBoundingSphere&&im.computeBoundingSphere();return im};
 for(let s0=PK.S0;s0<PK.len+220;s0+=CL){const E=[[],[]],F=[[],[]];for(let s=s0;s<s0+CL;s+=2.8){const W=halfW(s),c=cxS(s);for(const sd of[-1,1]){let u=W+4.5+r()*3;while(u<W+170){const dens=(u<W+14?.8:u<W+50?.5:.28)*thin;
    if(r()<dens){const x=c+sd*u+(r()-.5)*2,z=-s+(r()-.5)*2.4;const uu=x-c;if(!(lift!==undefined&&Math.abs(uu-lift)<9)){const sc=.8+r()*.65,t=[x,terrainH(x,z)-.25,z,sc,r()*TAU],v=r()<.6?0:1;(u<W+15?E:F)[v].push(t)}}u+=2.2+r()*3.6+(u-W)*.05}}}
  const c={s:s0+CL/2,edge:[],edgeImp:[],far:[]};
  for(const v of[0,1]){if(E[v].length){const card=mk(v?MAT.gB:MAT.gA,MAT.treeCard,E[v],1);card.castShadow=save.set.q>0;card.customDepthMaterial=MAT.treeDepth;const imp=mk(MAT.impG,v?MAT.impB:MAT.impA,E[v],0);imp.visible=false;grp.add(card,imp);c.edge.push(card);c.edgeImp.push(imp)}
   if(F[v].length){const imp=mk(MAT.impG,v?MAT.impB:MAT.impA,F[v],0);grp.add(imp);c.far.push(imp)}}
  WORLD.treeChunks.push(c)}}
function updateTreeLOD(cs){const R=PERF.tier<1?75:PERF.tier<2?120:170;for(const c of WORLD.treeChunks){const near=Math.abs(c.s-cs)<R;c.edge.forEach(m=>m.visible=near);c.edgeImp.forEach(m=>m.visible=!near)}}
// ---------------- fences, floodlights, lift, start, finish ----------------
function buildFences(grp){const V=[],UV=[],I=[];const post=[];
 for(const sd of[-1,1]){let prev=null;for(let s=-40;s<=PK.finishS+30;s+=5){const u=sd*(halfW(s)+1.6),x=cxS(s)+u,z=-s,y=terrainH(x,z);post.push([x,y,z]);
  const o=V.length/3;V.push(x,y-.1,z,x,y+1.35,z);UV.push(s/2.2,0,s/2.2,1.2);if(prev!==null)I.push(prev,prev+1,o,prev+1,o+1,o);prev=o}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(V,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setIndex(I);g.computeVertexNormals();
 const m=new THREE.Mesh(g,lampify(new THREE.MeshStandardMaterial({map:TX.net,alphaTest:.4,side:THREE.DoubleSide,roughness:.8,emissive:0x2a0a00})));grp.add(m);
 const pg=new THREE.CylinderGeometry(.03,.03,1.5,5);pg.translate(0,.7,0);const im=new THREE.InstancedMesh(pg,MAT.steelDark,post.length),M=new THREE.Matrix4();post.forEach((p,i)=>{M.makeTranslation(p[0],p[1],p[2]);im.setMatrixAt(i,M)});grp.add(im)}
function buildLights(grp){if(!T.lamps)return;const poles=[],heads=[];
 for(let s=-30;s<=PK.finishS+20;s+=44){for(const sd of[-1,1]){const ss=s+(sd>0?22:0),W=halfW(ss),u=sd*(W+5.5),x=cxS(ss)+u,z=-ss,y=terrainH(x,z);poles.push([x,y,z]);
  for(const k of[-1,1]){const hx=x-sd*.9,hy=y+15.2,hz=z+k*1.1;heads.push([hx,hy,hz,sd]);LAMP.heads.push({x:x-sd*13,y:y+12,z:hz,i:6.5})}}}
 const pg=new THREE.CylinderGeometry(.16,.24,15.5,7);pg.translate(0,7.75,0);let im=new THREE.InstancedMesh(pg,MAT.steelDark,poles.length);const M=new THREE.Matrix4();poles.forEach((p,i)=>{M.makeTranslation(p[0],p[1],p[2]);im.setMatrixAt(i,M)});grp.add(im);
 const hg=new THREE.BoxGeometry(.9,.55,.9);const hm=new THREE.MeshBasicMaterial({color:new THREE.Color(5,4.6,3.9)});im=new THREE.InstancedMesh(hg,hm,heads.length);heads.forEach((h,i)=>{M.makeRotationZ(h[3]*.5);M.setPosition(h[0],h[1],h[2]);im.setMatrixAt(i,M)});grp.add(im);
 // glare sprites
 const gp=new Float32Array(heads.length*3);heads.forEach((h,i)=>{gp[i*3]=h[0]-h[3]*.3;gp[i*3+1]=h[1]-.2;gp[i*3+2]=h[2]});const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.BufferAttribute(gp,3));
 const gm=new THREE.PointsMaterial({map:TX.spark,color:new THREE.Color(2.2,1.9,1.5),size:5,sizeAttenuation:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,fog:false});const pts=new THREE.Points(gg,gm);pts.frustumCulled=false;grp.add(pts);WORLD.glows=pts;
 // soft light cones in the falling snow
 if(PERF.tier>=1){const cg=new THREE.ConeGeometry(6,14,16,1,true);cg.translate(0,-7,0);const cc=new Float32Array(cg.attributes.position.count*3);for(let i=0;i<cg.attributes.position.count;i++){const y=cg.attributes.position.getY(i);const a=clamp((y+14)/14,0,1);cc[i*3]=cc[i*3+1]=cc[i*3+2]=a*a}cg.setAttribute('color',new THREE.BufferAttribute(cc,3));
  const cm=new THREE.MeshBasicMaterial({color:new THREE.Color(.05,.045,.035),vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,fog:false});
  const ci=new THREE.InstancedMesh(cg,cm,heads.length),q=new THREE.Quaternion(),e=new THREE.Euler();heads.forEach((h,i)=>{e.set(0,0,h[3]*.62);q.setFromEuler(e);M.compose(new THREE.Vector3(h[0],h[1]-.3,h[2]),q,new THREE.Vector3(1,1,1));ci.setMatrixAt(i,M)});grp.add(ci)}}
function buildLift(grp){const lu=PK.def.liftU;if(lu===undefined)return;const pts=[];for(let s=PK.finishS+60;s>=-90;s-=58){const x=cxS(s)+lu,z=-s;pts.push(new THREE.Vector3(x,terrainH(x,z),z))}
 const tg=new THREE.CylinderGeometry(.35,.45,11,8);tg.translate(0,5.5,0);const arm=new THREE.BoxGeometry(5.2,.3,.3);arm.translate(0,10.8,0);
 const ti=new THREE.InstancedMesh(tg,MAT.steelDark,pts.length),ai=new THREE.InstancedMesh(arm,MAT.steelDark,pts.length),M=new THREE.Matrix4();pts.forEach((p,i)=>{M.makeTranslation(p.x,p.y,p.z);ti.setMatrixAt(i,M);ai.setMatrixAt(i,M)});grp.add(ti,ai);
 // two cables: up line and down line, sagging between towers
 const lines=[];for(const side of[-2.3,2.3]){const C=[];for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1];for(let k=0;k<8;k++){const t=k/8;C.push(new THREE.Vector3(lerp(a.x,b.x,t)+side,lerp(a.y,b.y,t)+10.6-Math.sin(PI*t)*1.1,lerp(a.z,b.z,t)))}}const l=pts[pts.length-1];C.push(new THREE.Vector3(l.x+side,l.y+10.6,l.z));lines.push(C)}
 lines.forEach(C=>{const g=new THREE.BufferGeometry().setFromPoints(C);grp.add(new THREE.Line(g,new THREE.LineBasicMaterial({color:0x111318})))});
 // chairs
 const cg=new THREE.BoxGeometry(1.6,.12,.6);cg.translate(0,-2.1,0);const bk=new THREE.BoxGeometry(1.6,.6,.08);bk.translate(0,-1.8,-.28);const hg=new THREE.BoxGeometry(.05,2.1,.05);hg.translate(0,-1.05,0);
 const merged=mergeGeos([cg,bk,hg]),n=Math.max(6,Math.floor(lines[0].length/3));const ci=new THREE.InstancedMesh(merged,MAT.chair,n*2);grp.add(ci);WORLD.chairs={im:ci,lines,n}}
function mergeGeos(gs){const P=[],N=[],I=[];let o=0;for(const g of gs){const gi=g.index?g:null;const p=g.attributes.position.array,nn=g.attributes.normal.array;for(let i=0;i<p.length;i++){P.push(p[i]);N.push(nn[i])}const idx=g.index.array;for(let i=0;i<idx.length;i++)I.push(idx[i]+o);o+=p.length/3}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setIndex(I);return g}
function updateChairs(t){const C=WORLD.chairs;if(!C)return;const M=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler();
 C.lines.forEach((L,li)=>{const n=C.n;for(let k=0;k<n;k++){let f=((k/n)+t*.004*(li?1:-1))%1;if(f<0)f+=1;const x=f*(L.length-1),i=Math.floor(x),tt=x-i,a=L[i],b=L[Math.min(L.length-1,i+1)];
  e.set(0,0,0);q.setFromEuler(e);M.compose(new THREE.Vector3(lerp(a.x,b.x,tt),lerp(a.y,b.y,tt),lerp(a.z,b.z,tt)),q,new THREE.Vector3(1,1,1));C.im.setMatrixAt(li*n+k,M)}});C.im.instanceMatrix.needsUpdate=true}
function signTex(text,sub){return tex(cv(512,256,(x,w,h)=>{x.fillStyle='#ff5a1f';x.beginPath();x.ellipse(256,128,244,118,0,0,TAU);x.fill();x.strokeStyle='#fff';x.lineWidth=12;x.stroke();x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';
 x.font='800 68px Archivo,"Arial Black",sans-serif';const tw=x.measureText(text).width;x.save();x.translate(256,sub?112:128);const sc=Math.min(1,400/tw);x.scale(sc*1.1,1);x.fillText(text,0,0);x.restore();if(sub){x.font='600 38px Archivo,Arial,sans-serif';x.fillText(sub,256,182)}}),null,true)}
function buildDressing(grp){const r=mulberry(PK.seed+11),M=new THREE.Matrix4(),w={x:0,z:0};
 const SZ={XS:'Extra small',S:'Small',M:'Medium',L:'Large',XL:'Extra large',MEGA:'Huge'};
 // name signs and lip markers beside kickers
 const markers=[];
 for(const f of PK.feats){if(f.type!=='kick'||f.lip<1.2)continue;const side=f.o.x-cxS(-f.o.z)>2?1:-1;toWorld(f,-2,(f.wr*.5+2.2)*-side,w);const y=terrainH(w.x,w.z);
  const sg=new THREE.Mesh(new THREE.PlaneGeometry(1.8,.9),std({map:signTex(f.name||SZ[f.size]||'Jump',f.name?SZ[f.size]:''),roughness:.6,transparent:true,alphaTest:.3,side:THREE.DoubleSide},false));sg.position.set(w.x,y+1.9,w.z);sg.rotation.y=Math.atan2(-f.d.x,-f.d.z);grp.add(sg);
  const pst=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,1.6,5),MAT.steelDark);pst.position.set(w.x,y+.8,w.z);grp.add(pst);
  for(const sd of[-1,1]){toWorld(f,f.lipA-.3,sd*(f.wr*.5+.15),w);markers.push([w.x,H(w.x,w.z),w.z,0]);toWorld(f,f.knA+.4,sd*(f.Wt[Math.min(f.Wt.length-1,(f.knA/f.da)|0)]*.5+.1),w);markers.push([w.x,H(w.x,w.z),w.z,1])}
  // TV camera for replays, beside the landing looking back at the lip
  toWorld(f,f.knA+6,-side*(f.Wt[Math.min(f.Wt.length-1,(f.knA/f.da)|0)]*.5+7),w);PK.cams.push({x:w.x,y:H(w.x,w.z)+2.2+f.lip*.4,z:w.z,fx:toWorld(f,f.knA,0,{x:0,z:0}),s:-w.z})}
 for(const rl of PK.rails){const p=railAt(rl,rl.len*.5,new THREE.Vector3()),tn=new THREE.Vector3();railAt(rl,rl.len*.5,new THREE.Vector3(),tn);PK.cams.push({x:p.x-tn.z*6,y:p.y+1.4,z:p.z+tn.x*6,fx:{x:p.x,z:p.z},s:-p.z})}
 if(markers.length){const g=new THREE.CylinderGeometry(.03,.03,1.2,5);g.translate(0,.6,0);const im=new THREE.InstancedMesh(g,std({color:0xff5a1f,roughness:.5,emissive:0x220800}),markers.length);markers.forEach((m,i)=>{M.makeTranslation(m[0],m[1],m[2]);im.setMatrixAt(i,m[3]?(M.makeTranslation(m[0],m[1],m[2]),M):M)});grp.add(im)}
 // start house and gate
 const ss=PK.start.s-12,sx=cxS(ss),sy=terrainH(sx,-ss);const hut=new THREE.Group();hut.position.set(sx-6,sy,-ss);grp.add(hut);
 const box=new THREE.Mesh(new THREE.BoxGeometry(6,3.4,5),std({map:TX.wood,roughness:.85},false));box.position.y=1.7;hut.add(box);
 const roof=new THREE.Mesh(new THREE.CylinderGeometry(.01,4.6,1.6,4,1),std({color:0x2a2f38,roughness:.7},false));roof.rotation.y=PI/4;roof.position.y=4.2;roof.scale.set(1.05,1,.9);hut.add(roof);
 const bn=new THREE.Mesh(new THREE.PlaneGeometry(5.6,.7),std({map:TX.banner,roughness:.7},false));bn.position.set(0,2.6,2.52);hut.add(bn);
 const gs=PK.start.s+8,gx=cxS(gs),gw=halfW(gs);for(const sd of[-1,1]){const x=gx+sd*(Math.min(gw,9)),y=terrainH(x,-gs);const p=new THREE.Mesh(new THREE.BoxGeometry(.35,4.2,.35),MAT.steelDark);p.position.set(x,y+2.1,-gs);grp.add(p)}
 const gbt=TX.banner.clone();gbt.needsUpdate=true;gbt.repeat.set(2,1);const gb=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(gw,9)*2,1.1),std({map:gbt,side:THREE.DoubleSide,roughness:.7},false));gb.position.set(gx,terrainH(gx,-gs)+3.8,-gs);grp.add(gb);
 // finish arch, corral and crowd
 const fs=PK.finishS,fx=cxS(fs),fw=Math.min(halfW(fs),16),fy=terrainH(fx,-fs);for(const sd of[-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(.8,5.4,.8),std({color:0x1d2433,roughness:.6},false));p.position.set(fx+sd*fw,terrainH(fx+sd*fw,-fs)+2.7,-fs);grp.add(p)}
 const fb=new THREE.Mesh(new THREE.PlaneGeometry(fw*2,1.6),std({map:TX.finish,side:THREE.DoubleSide,roughness:.7},false));fb.position.set(fx,fy+5,-fs);grp.add(fb);
 const people=[];for(let i=0;i<70;i++){const sd=i%2?1:-1,s=fs+8+r()*40,u=sd*(halfW(s)+2.4+r()*4),x=cxS(s)+u,z=-s;people.push([x,terrainH(x,z),z,r()])}
 if(PK.def.id==='bigair'||PK.def.id==='pipe'){for(let i=0;i<60;i++){const sd=i%2?1:-1,s=40+r()*120,u=sd*(halfW(s)+2.4+r()*5),x=cxS(s)+u,z=-s;people.push([x,terrainH(x,z),z,r()])}}
 const pg=new THREE.CylinderGeometry(.22,.26,1.6,6);pg.translate(0,.85,0);const cols=new Float32Array(people.length*3),pal=[0xff5a1f,0x1e5bff,0xd8f23a,0xf2f2f2,0x1d2433,0xf27fb2,0x2fd17a,0xffd23f];
 const ci=new THREE.InstancedMesh(pg,std({color:0xffffff,roughness:.8},false),people.length);people.forEach((p,i)=>{M.makeTranslation(p[0],p[1],p[2]);ci.setMatrixAt(i,M);ci.setColorAt(i,new THREE.Color(pal[(p[3]*pal.length)|0]))});grp.add(ci);WORLD.crowd={im:ci,people}}
function updateCrowd(t){const C=WORLD.crowd;if(!C)return;const M=new THREE.Matrix4();C.people.forEach((p,i)=>{const b=Math.max(0,Math.sin(t*(4+p[3]*3)+p[3]*20))*.12*(WORLD.cheer||0);M.makeTranslation(p[0],p[1]+b,p[2]);C.im.setMatrixAt(i,M)});C.im.instanceMatrix.needsUpdate=true}
let farMts=null;
function farRange(sd){const NA=PERF.tier<1?360:PERF.tier<2?600:960,NR=PERF.tier<1?48:PERF.tier<2?72:104,R0=1500,R1=8200,K=.36,EY=140,P=new Float32Array((NA+1)*NR*3),Hh=new Float32Array((NA+1)*NR),Cc=new Float32Array((NA+1)*NR*3),I=[];
 const seed=PK.seed+sd;
 const rmf=(x,z)=>{let sum=0,amp=1,f=1,w=1,nm=0;for(let o=0;o<7;o++){let n=1-Math.abs(vn2(x*f+o*7.3,z*f-o*3.1,seed+o*17)*2-1);n*=n;n*=w;w=clamp(n*1.7,0,1);sum+=n*amp;nm+=amp;amp*=.52;f*=2.03}return sum/nm};
 for(let i=0;i<=NA;i++){const a=i/NA*TAU,ca=Math.cos(a),sa=Math.sin(a);
  for(let k=0;k<NR;k++){const t=k/(NR-1),r=R0*Math.pow(R1/R0,t),x=ca*r,z=sa*r,id=i*NR+k;
   const wx=x+(vn2(x/1900,z/1900,seed+5)-.5)*900,wz=z+(vn2(x/1900,z/1900,seed+6)-.5)*900,big=vn2(x/6500,z/6500,seed+3),m=rmf(wx/2400,wz/2400),env=sstep(0,.3,t)*(.55+.45*sstep(.25,.7,t));
   const h=-560+env*(240+Math.pow(m,1.3)*1900*(.5+.7*big))+(vn2(x/420,z/420,seed+9)-.5)*120*env;Hh[id]=h;P[id*3]=x*K;P[id*3+1]=(h-EY)*K;P[id*3+2]=z*K}}
 for(let i=0;i<NA;i++)for(let k=0;k<NR-1;k++){const a=i*NR+k,b=(i+1)*NR+k;I.push(a,b,a+1,b,b+1,a+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();const N=g.attributes.normal.array;
 for(let id=0;id<Hh.length;id++){const ny=N[id*3+1],h=Hh[id],x=P[id*3]/K,z=P[id*3+2]/K,n1=vn2(x/170,z/170,seed+21);const forest=(1-sstep(-220,40,h+(n1-.5)*160))*sstep(.55,.75,ny);Cc[id*3]=forest;Cc[id*3+1]=n1;Cc[id*3+2]=0}
 g.setAttribute('color',new THREE.BufferAttribute(Cc,3));
 const sky=new THREE.Color(T.sky).multiplyScalar(T.hemiI),gnd=new THREE.Color(T.gnd).multiplyScalar(T.hemiI),hz=new THREE.Color(T.fog).lerp(new THREE.Color(T.hor),.55);
 const m=new THREE.ShaderMaterial({uniforms:{sunDir:skyU.sunDir,sunCol:skyU.sunCol,sunI:{value:T.sunI},skyC:{value:sky},gndC:{value:gnd},hzC:{value:hz},fd:{value:T.fogD*.038/K*(T.lamps?.6:1)},inv:{value:1/K}},vertexColors:true,fog:false,
  vertexShader:'varying vec3 vC;varying vec3 vN;varying vec3 vP;void main(){vC=color;vN=normal;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'uniform vec3 sunDir;uniform vec3 sunCol;uniform float sunI;uniform vec3 skyC;uniform vec3 gndC;uniform vec3 hzC;uniform float fd;uniform float inv;varying vec3 vC;varying vec3 vN;varying vec3 vP;'+
  'float h2(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y);}'+
  'float fb(vec2 p){float s=0.,a=.5;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.07+vec2(3.1,1.7);a*=.5;}return s;}'+
  'void main(){vec3 n=normalize(vN);vec3 w=vP*inv;w.y+=140.;float l=max(dot(n,sunDir),0.);'+
  'float nn=fb(w.xz/260.),n2=fb(w.xz/48.+w.y/90.),st=vn(vec2(w.y/14.,w.x/700.+w.z/700.));'+
  'float sl=n.y+(nn-.5)*.42+(n2-.5)*.22+smoothstep(200.,1600.,w.y)*.08;float snow=smoothstep(.6,.66,sl);'+
  'vec3 rock=vec3(1.07,1.02,.96)*(.07+.06*n2+.05*st);vec3 alb=mix(rock,vec3(.055,.08,.065),vC.r*(1.-snow*.7));alb=mix(alb,vec3(.84,.86,.9)*(.95+.08*nn),snow);'+
  'vec3 amb=mix(gndC,skyC,n.y*.5+.5)*.8;vec3 c=alb*(sunCol*sunI*l+amb);'+
  'float d=length(vP);vec3 v=vP/d;float f=1.-exp(-pow(d*fd,1.2));float sv=max(dot(v,sunDir),0.);vec3 hz=hzC*(1.+.9*pow(sv,6.))+sunCol*.15*pow(sv,24.);'+
  'c=mix(c,hz,clamp(f,0.,1.));c=mix(c,hzC,smoothstep(-260.,-560.,w.y));gl_FragColor=linearToOutputTexel(vec4(c,1.));}'});
 const mesh=new THREE.Mesh(g,m);mesh.frustumCulled=false;mesh.renderOrder=-9;return mesh}
function initMats(){if(MAT.snow)return;MAT.snow=snowMaterial();MAT.steel=std({color:0xd7dce2,roughness:.22,metalness:1,envMapIntensity:1});MAT.steelDark=std({color:0x30343b,roughness:.5,metalness:.6});
 MAT.box=std({vertexColors:true,roughness:.4,metalness:.15});MAT.tree=std({vertexColors:true,roughness:.92,metalness:0,envMapIntensity:.25},false);MAT.chair=std({color:0x1d2433,roughness:.6,metalness:.3})}
function clearWorld(){if(WORLD.root){scene.remove(WORLD.root);WORLD.root.traverse(o=>{if(o.geometry)o.geometry.dispose()})}WORLD.chunks=[];WORLD.treeChunks=[];WORLD.chairs=null;WORLD.crowd=null;WORLD.glows=null;LAMP.heads=[];
 if(farMts){scene.remove(farMts);farMts.children.forEach(c=>{c.geometry.dispose();c.material.dispose()});farMts=null}}
function buildWorld(id){clearWorld();const def=buildPark(id);setTOD(def.tod);initMats();def.liftU=def.liftU??-(Math.max(...def.width.map(w=>w[1]))+26);
 const root=new THREE.Group();WORLD.root=root;scene.add(root);const fine=PERF.tier<1?1.7:1.3,CL=40;
 for(let s=PK.S0;s<PK.len+240;s+=CL){const m=buildChunk(s,s+CL,fine);root.add(m);WORLD.chunks.push(m)}
 for(const f of PK.feats)if(f.type!=='pad'){const m=featMesh(f);root.add(m);WORLD.feats.push(m)}
 buildRails(root);buildTrees(root);buildFences(root);buildLights(root);buildLift(root);buildDressing(root);
 farMts=new THREE.Group();farMts.add(farRange(31));scene.add(farMts);
 MAT.snow.userData.u.sunCol.value.copy(sun.color).multiplyScalar(sun.intensity*.3);return def}

// ================= PARTICLES, SKI TRACKS, SNOWFALL =================
class PSys{constructor(n,map,blend,depthTest){this.n=n;this.p=new Float32Array(n*3);this.v=new Float32Array(n*3);this.life=new Float32Array(n);this.max=new Float32Array(n);this.s0=new Float32Array(n);this.s1=new Float32Array(n);this.c=new Float32Array(n*4);this.drag=new Float32Array(n);this.grav=new Float32Array(n);this.i=0;
 const g=new THREE.BufferGeometry();this.pa=new THREE.BufferAttribute(new Float32Array(n*3),3);this.sa=new THREE.BufferAttribute(new Float32Array(n),1);this.ca=new THREE.BufferAttribute(new Float32Array(n*4),4);
 [this.pa,this.sa,this.ca].forEach(a=>a.setUsage(THREE.DynamicDrawUsage));g.setAttribute('position',this.pa);g.setAttribute('psize',this.sa);g.setAttribute('pcol',this.ca);
 this.mat=new THREE.ShaderMaterial({uniforms:{map:{value:map},scale:{value:600}},vertexShader:SH.partV,fragmentShader:SH.partF,transparent:true,depthWrite:false,depthTest:depthTest!==false,blending:blend||THREE.NormalBlending});
 this.pts=new THREE.Points(g,this.mat);this.pts.frustumCulled=false;this.pts.renderOrder=5;scene.add(this.pts);this.live=0}
 emit(x,y,z,vx,vy,vz,life,s0,s1,r,g,b,a,drag,grav){const i=this.i;this.i=(i+1)%this.n;const k=i*3;this.p[k]=x;this.p[k+1]=y;this.p[k+2]=z;this.v[k]=vx;this.v[k+1]=vy;this.v[k+2]=vz;this.life[i]=this.max[i]=life;this.s0[i]=s0;this.s1[i]=s1;const c=i*4;this.c[c]=r;this.c[c+1]=g;this.c[c+2]=b;this.c[c+3]=a;this.drag[i]=drag||0;this.grav[i]=grav||0}
 update(dt){const P=this.pa.array,S=this.sa.array,C=this.ca.array;let live=0;
  for(let i=0;i<this.n;i++){if(this.life[i]<=0){S[i]=0;continue}live++;this.life[i]-=dt;const t=1-Math.max(0,this.life[i])/this.max[i],k=i*3,d=Math.exp(-this.drag[i]*dt);
   this.v[k]*=d;this.v[k+1]=this.v[k+1]*d-this.grav[i]*dt;this.v[k+2]*=d;this.p[k]+=this.v[k]*dt;this.p[k+1]+=this.v[k+1]*dt;this.p[k+2]+=this.v[k+2]*dt;
   P[k]=this.p[k];P[k+1]=this.p[k+1];P[k+2]=this.p[k+2];S[i]=this.life[i]>0?lerp(this.s0[i],this.s1[i],t):0;const c=i*4,fa=t<.12?t/.12:1-sstep(.4,1,t);C[c]=this.c[c];C[c+1]=this.c[c+1];C[c+2]=this.c[c+2];C[c+3]=this.c[c+3]*fa}
  this.live=live;this.pa.needsUpdate=this.sa.needsUpdate=this.ca.needsUpdate=true}
 clear(){this.life.fill(0)}}
let SPRAY=null;
function initFX(){if(SPRAY)return;TX.flake=new THREE.CanvasTexture(cv(16,16,(x)=>{const g=x.createRadialGradient(8,8,0,8,8,8);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,16,16)}));
 SPRAY=new PSys(PERF.tier<1?900:2200,TX.puff);PART=[SPRAY];initFlakes();TRACKS.push(new Track(),new Track())}
function spray(x,y,z,vx,vy,vz,n,spd,size,life){const c=T.lamps?.75:1;for(let i=0;i<n;i++){const a=R()*TAU,u=R();SPRAY.emit(x+rr(-.12,.12),y+rr(0,.08),z+rr(-.12,.12),vx+Math.cos(a)*spd*u,vy+R()*spd*.8,vz+Math.sin(a)*spd*u,life*rr(.6,1.2),size*.5,size*rr(1.2,2.2),c,c,c*1.02,rr(.35,.75),2.2,3.5)}}
const FL={n:0,geo:null,pts:null,base:null,amount:0};
function initFlakes(){const n=4000;FL.n=n;FL.base=new Float32Array(n*4);for(let i=0;i<n;i++){FL.base[i*4]=R();FL.base[i*4+1]=R();FL.base[i*4+2]=R();FL.base[i*4+3]=R()}
 const g=new THREE.BufferGeometry();FL.pos=new THREE.BufferAttribute(new Float32Array(n*3),3);FL.pos.setUsage(THREE.DynamicDrawUsage);g.setAttribute('position',FL.pos);
 FL.mat=new THREE.PointsMaterial({map:TX.flake,size:.06,transparent:true,depthWrite:false,opacity:.9,color:0xffffff,sizeAttenuation:true});FL.pts=new THREE.Points(g,FL.mat);FL.pts.frustumCulled=false;FL.pts.renderOrder=6;scene.add(FL.pts)}
function updateFlakes(t,wind){const amt=FL.amount;FL.pts.visible=amt>0;if(!amt)return;const n=Math.floor(FL.n*amt),B=36,P=FL.pos.array,cpx=cam.position.x,cpy=cam.position.y,cpz=cam.position.z;
 for(let i=0;i<FL.n;i++){const k=i*3;if(i>=n){P[k+1]=-1e5;continue}const b=FL.base,j=i*4,fall=t*(1.1+b[j+3]*.9);
  let x=b[j]*B+wind.x*t+Math.sin(t*.7+b[j+3]*20)*.6,y=b[j+1]*B-fall,z=b[j+2]*B+wind.z*t;
  x=((x-cpx)%B+B*1.5)%B-B/2+cpx;y=((y-cpy)%B+B*1.5)%B-B/2+cpy;z=((z-cpz)%B+B*1.5)%B-B/2+cpz;P[k]=x;P[k+1]=y;P[k+2]=z}
 FL.pos.needsUpdate=true}
// ---- two grooves carved by the skis ----
class Track{constructor(){const n=this.max=1600;this.n=0;this.last=null;this.brk=true;this.dist=0;const g=new THREE.BufferGeometry();
  this.pos=new THREE.BufferAttribute(new Float32Array(n*2*3),3);this.uv=new THREE.BufferAttribute(new Float32Array(n*2*2),2);this.nor=new THREE.BufferAttribute(new Float32Array(n*2*3),3);
  [this.pos,this.uv,this.nor].forEach(a=>a.setUsage(THREE.DynamicDrawUsage));g.setAttribute('position',this.pos);g.setAttribute('uv',this.uv);g.setAttribute('normal',this.nor);
  const idx=new Uint16Array((n-1)*6);for(let i=0;i<n-1;i++){const a=i*2;idx.set([a,a+1,a+2,a+1,a+3,a+2],i*6)}g.setIndex(new THREE.BufferAttribute(idx,1));g.setDrawRange(0,0);
  if(!TX.groove){const W=32,c=cv(W,4,(x)=>{const img=x.createImageData(W,4);for(let i=0;i<W;i++){const u=i/(W-1)*2-1,dh=-2*u*2.4,l=Math.hypot(dh,1);for(let j=0;j<4;j++){const k=(j*W+i)*4;img.data[k]=(-dh/l*.5+.5)*255;img.data[k+1]=128;img.data[k+2]=(1/l*.5+.5)*255;img.data[k+3]=255}}x.putImageData(img,0,0)});TX.groove=new THREE.CanvasTexture(c);TX.groove.wrapT=THREE.RepeatWrapping}
  const m=lampify(new THREE.MeshStandardMaterial({color:0xdfe7f2,roughness:.35,metalness:0,normalMap:TX.groove,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,envMapIntensity:.6}));
  this.mesh=new THREE.Mesh(g,m);this.mesh.frustumCulled=false;this.mesh.receiveShadow=true;scene.add(this.mesh)}
 reset(){this.n=0;this.brk=true;this.last=null;this.mesh.geometry.setDrawRange(0,0)}
 add(p,lat,nrm,w,on){if(!on){if(!this.brk&&this.n>0&&this.last){this.push(this.last,lat,nrm,0);this.flush()}this.brk=true;return}
  if(this.last&&!this.brk&&p.distanceToSquared(this.last)<.3*.3)return;if(this.brk){this.push(p,lat,nrm,0);this.brk=false}else if(this.last)this.dist+=p.distanceTo(this.last);
  this.push(p,lat,nrm,w);this.last=(this.last||new THREE.Vector3()).copy(p);this.flush()}
 push(p,lat,nrm,w){if(this.n>=this.max){const P=this.pos.array,U=this.uv.array,N=this.nor.array,sh=200;P.copyWithin(0,sh*6);U.copyWithin(0,sh*4);N.copyWithin(0,sh*6);this.n-=sh}
  const i=this.n,P=this.pos.array,U=this.uv.array,N=this.nor.array;for(let s=0;s<2;s++){const k=(i*2+s)*3,sd=s?1:-1;P[k]=p.x+lat.x*w*sd+nrm.x*.02;P[k+1]=p.y+lat.y*w*sd+nrm.y*.02;P[k+2]=p.z+lat.z*w*sd+nrm.z*.02;N[k]=nrm.x;N[k+1]=nrm.y;N[k+2]=nrm.z;U[(i*2+s)*2]=s;U[(i*2+s)*2+1]=this.dist*.5}this.n++}
 flush(){this.pos.needsUpdate=this.uv.needsUpdate=this.nor.needsUpdate=true;this.mesh.geometry.setDrawRange(0,Math.max(0,(this.n-1)*6))}}
const TRACKS=[];
const _tp=new THREE.Vector3(),_tlat=new THREE.Vector3();
function updateTracks(){const on=PH.ground&&!PH.crash&&!PH.rail&&PH.speed>1;_tlat.crossVectors(PH.n,PH.dir).normalize();
 for(let i=0;i<2;i++){const sd=i?-1:1;_tp.copy(PH.pos).addScaledVector(_tlat,sd*SKI_X);TRACKS[i].add(_tp,_tlat,PH.n,.045+PH.skid*.12,on)}}
function fxGround(dt){if(!PH.ground||PH.crash||PH.rail)return;const sp=PH.speed,sk=PH.skid+PH.brake*.8,p=PH.pos;
 if(sp>3&&(sk>.12||Math.abs(PH.edge)>.5)){const n=Math.min(8,(sk*10+Math.abs(PH.edge)*2)*dt*60*.5|0)+(R()<.5?1:0);const lat=_tlat.crossVectors(PH.n,PH.dir).normalize(),sd=Math.sign(PH.edge||1);
  spray(p.x,p.y+.05,p.z,PH.vel.x*.4+lat.x*sd*-2.5,1.4,PH.vel.z*.4+lat.z*sd*-2.5,n,1.6,.35,.7)}}
function fxLand(k){const p=PH.pos;spray(p.x,p.y+.05,p.z,PH.vel.x*.25,1.2,PH.vel.z*.25,Math.round(18+k*30),3,.5,.9)}

// ================= SKIER: model, skis, poles, gear, procedural animation =================
// RD.root sits at the feet (the ski bases) and carries the body orientation; everything else is local to it.
const RD={root:new THREE.Group(),sm:null,bones:null,rest:null,mats:null,ready:false,skis:[],poles:[],headG:null,J:null};
scene.add(RD.root);
const SKI_L=1.78,SKI_X=.115;
function skiTexture(d){return tex(cv(512,64,(x,w,h)=>{const A='#'+new THREE.Color(d.a).getHexString(),Bc='#'+new THREE.Color(d.b).getHexString(),base='#'+new THREE.Color(d.base).getHexString();x.fillStyle=base;x.fillRect(0,0,w,h);
 const r=mulberry(d.id.length*17+d.art.length);
 if(d.art==='stripe'){x.fillStyle=A;x.fillRect(0,h*.36,w,h*.28);x.fillStyle=Bc;x.fillRect(w*.08,0,26,h);x.fillRect(w*.88,0,26,h)}
 else if(d.art==='chev'){x.fillStyle=A;for(let i=0;i<9;i++){const o=i*58;x.beginPath();x.moveTo(o,0);x.lineTo(o+24,h/2);x.lineTo(o,h);x.lineTo(o+12,h);x.lineTo(o+36,h/2);x.lineTo(o+12,0);x.fill()}}
 else if(d.art==='wood'){for(let i=0;i<40;i++){x.strokeStyle=`rgba(60,36,18,${.15+r()*.25})`;x.lineWidth=1+r()*2;x.beginPath();const y=r()*h;x.moveTo(0,y);x.bezierCurveTo(w*.3,y+r()*14-7,w*.7,y+r()*14-7,w,y+r()*10-5);x.stroke()}x.fillStyle=Bc;x.fillRect(w*.45,h*.2,w*.1,h*.6)}
 else if(d.art==='drip'){x.fillStyle=A;for(let i=0;i<34;i++){const px=r()*w,len=10+r()*40;x.fillRect(px,0,5+r()*6,len);x.beginPath();x.arc(px+5,len,6,0,TAU);x.fill()}}
 else if(d.art==='peaks'){x.fillStyle=A;x.beginPath();x.moveTo(0,h);for(let i=0;i<=16;i++)x.lineTo(i*w/16,i%2?h*.25:h*.85);x.lineTo(w,h);x.fill();x.fillStyle=Bc;x.beginPath();x.arc(w*.7,h*.3,8,0,TAU);x.fill()}
 else if(d.art==='check'){for(let i=0;i<32;i++)for(let j=0;j<4;j++)if((i+j)%2){x.fillStyle=A;x.fillRect(i*16,j*16,16,16)}x.fillStyle=Bc;x.fillRect(0,h*.45,w,h*.1)}
 else if(d.art==='flame'){const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,A);g.addColorStop(.5,Bc);g.addColorStop(1,A);x.fillStyle=g;for(let i=0;i<20;i++){const px=i*26;x.beginPath();x.moveTo(px,h);x.quadraticCurveTo(px+8,h*.3,px+13,0);x.quadraticCurveTo(px+18,h*.4,px+26,h);x.fill()}}
 x.fillStyle='rgba(255,255,255,.85)';x.font='800 24px Archivo,"Arial Black",sans-serif';x.textAlign='center';x.textBaseline='middle';x.save();x.translate(w*.5,h*.5);x.scale(1.3,1);x.fillText('DUB TEN',0,0);x.restore()}),null,true)}
function skiGeo(){// twin tip with rocker: width profile, tips rise, slight camber underfoot
 const N=60,M=6,P=[],UV=[],I=[],L=SKI_L,half=L/2;
 const wid=z=>{const a=Math.abs(z)/half;if(a<.78)return .048+.016*Math.pow(a/.78,2);const t=(a-.78)/.22;return(.064)*Math.sqrt(Math.max(0,1-t*t*t))+.002},rise=z=>{const a=Math.abs(z)/half;return a>.66?Math.pow((a-.66)/.34,2)*.11:0};
 for(let i=0;i<=N;i++){const z=-half+L*i/N,w=wid(z),y=rise(z)+.004;for(let j=0;j<=M;j++){const x=-w+2*w*j/M;P.push(x,y+.014,z);UV.push(i/N,j/M)}}
 const top=P.length/3;for(let i=0;i<=N;i++){const z=-half+L*i/N,w=wid(z),y=rise(z)+.004;for(let j=0;j<=M;j++){const x=-w+2*w*j/M;P.push(x,y,z);UV.push(i/N,j/M)}}
 for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=i*(M+1)+j,b=a+M+1;I.push(a,a+1,b,b,a+1,b+1);const c=top+a,d=top+b;I.push(c,d,c+1,d,d+1,c+1)}
 for(let i=0;i<N;i++){for(const j of[0,M]){const a=i*(M+1)+j,b=a+M+1,c=top+a,d=top+b;if(j===0)I.push(a,b,c,b,d,c);else I.push(a,c,b,b,c,d)}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setIndex(I);g.computeVertexNormals();return g}
function buildSkis(){RD.skis.forEach(s=>RD.root.remove(s.g));RD.skis=[];const d=gear('ski'),top=envOwn(lampify(new THREE.MeshStandardMaterial({map:skiTexture(d),roughness:.32,metalness:.05,envMapIntensity:.9})));
 const bind=lampify(envOwn(new THREE.MeshStandardMaterial({color:0x17191e,roughness:.45,metalness:.4}))),brake=lampify(envOwn(new THREE.MeshStandardMaterial({color:0xb8bec6,roughness:.3,metalness:.9}))),geo=skiGeo();
 for(const sd of[-1,1]){const g=new THREE.Group(),m=new THREE.Mesh(geo,top);m.castShadow=true;g.add(m);
  const toe=new THREE.Mesh(new THREE.BoxGeometry(.08,.05,.09),bind);toe.position.set(0,.04,.16);const heel=new THREE.Mesh(new THREE.BoxGeometry(.085,.07,.11),bind);heel.position.set(0,.05,-.13);
  const br=new THREE.Mesh(new THREE.BoxGeometry(.12,.01,.06),brake);br.position.set(0,.03,-.2);g.add(toe,heel,br);[toe,heel].forEach(o=>o.castShadow=true);
  g.position.set(sd*-SKI_X,0,.03);RD.root.add(g);RD.skis.push({g,sd,base:g.position.clone()})}}
function buildPoles(){RD.poles.forEach(p=>p.parent&&p.parent.remove(p));RD.poles=[];if(!RD.ready)return;
 const sh=lampify(envOwn(new THREE.MeshStandardMaterial({color:0xc7ccd3,roughness:.28,metalness:.9}))),grip=lampify(new THREE.MeshStandardMaterial({color:0x15171b,roughness:.7})),bk=lampify(new THREE.MeshStandardMaterial({color:0x1d2433,roughness:.6}));
 for(const n of[7,10]){const g=new THREE.Group();const s=new THREE.Mesh(new THREE.CylinderGeometry(.009,.007,1.12,6),sh);s.position.y=-.56;const gr=new THREE.Mesh(new THREE.CylinderGeometry(.02,.017,.14,8),grip);gr.position.y=-.02;
  const b=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,.012,10),bk);b.position.y=-1.02;g.add(s,gr,b);g.traverse(o=>{if(o.isMesh)o.castShadow=true});RD.bones[n].add(g);g.position.set(0,0,.07);g.visible=!!save.look.poles;RD.poles.push(g)}}
function skierMats(){const j=gear('jacket'),p=gear('pants'),sk=(c,o)=>lampify(envOwn(new THREE.MeshStandardMaterial(Object.assign({color:c,vertexColors:true,skinning:true,roughness:.7,metalness:0,envMapIntensity:.45},o||{}))));
 const jm=sk(j.c,{roughness:.62});if(j.pat){jm.userData.key='pat'+j.pat;jm.userData.u={c2:{value:new THREE.Color(j.c2)}};const pat=j.pat==='camo'?1:j.pat==='fade'?2:3;
  jm.userData.obc=sh=>{Object.assign(sh.uniforms,jm.userData.u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>','#include <begin_vertex>\nvOP=position;');
   sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vOP;uniform vec3 c2;float h3(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,37.719)))*43758.5453);}float n3(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}')
    .replace('#include <color_fragment>','#include <color_fragment>\n'+(pat===1?'{float n=n3(vOP*9.)*.6+n3(vOP*21.)*.4;diffuseColor.rgb=mix(diffuseColor.rgb,c2*vColor,smoothstep(.52,.56,n));}':pat===2?'diffuseColor.rgb=mix(diffuseColor.rgb,c2*vColor,smoothstep(.95,1.45,vOP.y));':'{float a=step(.5,fract(vOP.x*14.)),b=step(.5,fract(vOP.y*14.));diffuseColor.rgb=mix(diffuseColor.rgb,c2*vColor,.35*(a+b));}'))}}
 return[jm,sk(j.c2,{roughness:.66}),sk(p.c,{roughness:.86,envMapIntensity:.3}),sk(0xffffff,{roughness:.55,envMapIntensity:.5}),sk(0xffffff,{roughness:.6,envMapIntensity:.2})]}
function buildHead(){if(RD.headG){RD.headG.parent&&RD.headG.parent.remove(RD.headG)}if(!RD.ready)return;const h=gear('head'),l=gear('lens'),geo=MOD.geo[h.kind==='beanie'?'beanie':'helmet'];if(!geo)return;
 const shell=lampify(envOwn(new THREE.MeshStandardMaterial({color:h.c,vertexColors:true,roughness:h.kind==='beanie'?.95:h.chrome?.12:.3,metalness:h.chrome?1:.05,envMapIntensity:h.chrome?1.2:.8}))),
  lens=lampify(envOwn(new THREE.MeshStandardMaterial({color:l.c,vertexColors:true,roughness:.05,metalness:1,envMapIntensity:1.4,emissive:new THREE.Color(l.c).multiplyScalar(.05)}))),dk=lampify(new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.6}));
 const m=new THREE.Mesh(geo,[shell,lens,dk]);m.castShadow=true;RD.bones[4].add(m);RD.headG=m}
function buildSkier(){const meta=MOD.meta.skier,geo=MOD.geo.skier;if(!geo)return;if(RD.sm)RD.root.remove(RD.sm);
 const bones=meta.bones.map(()=>new THREE.Bone());meta.bones.forEach((b,i)=>{const pp=b.parent>=0?meta.bones[b.parent].p:[0,0,0];bones[i].position.set(b.p[0]-pp[0],b.p[1]-pp[1],b.p[2]-pp[2]);if(b.parent>=0)bones[b.parent].add(bones[i])});
 RD.mats=skierMats();const sm=new THREE.SkinnedMesh(geo,RD.mats);sm.add(bones[0]);sm.updateMatrixWorld(true);sm.bind(new THREE.Skeleton(bones));sm.castShadow=true;sm.receiveShadow=true;sm.frustumCulled=false;
 RD.root.add(sm);RD.sm=sm;RD.bones=bones;RD.rest=bones.map(b=>b.position.clone());RD.J=meta.J;RD.ready=true;
 const J=meta.J,v=a=>new THREE.Vector3(a[0],a[1],a[2]);
 RD.leg={R:{hp:v(J.hpR),kn:v(J.knR),an:v(J.anR),b:[11,12,13],pole:new THREE.Vector3(0,0,1),ski:1},L:{hp:v(J.hpL),kn:v(J.knL),an:v(J.anL),b:[14,15,16],pole:new THREE.Vector3(0,0,1),ski:0}};
 RD.arm={R:{sh:v(J.shR),el:v(J.elR),wr:v(J.wrR),b:[5,6,7],pole:new THREE.Vector3(-.4,-.2,-1).normalize()},L:{sh:v(J.shL),el:v(J.elL),wr:v(J.wrL),b:[8,9,10],pole:new THREE.Vector3(.4,-.2,-1).normalize()}};
 RD.hips0=v(J.hips);RD.chest0=v(J.chest);buildHead();buildPoles()}
function refreshLook(){if(RD.ready){const m=skierMats();RD.sm.material=m;RD.mats=m;buildHead();RD.poles.forEach(p=>p.visible=!!save.look.poles)}buildSkis()}
// ---- two-bone IK (vectors in the space of the chain's parent bone) ----
const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_k=new THREE.Vector3(),_p=new THREE.Vector3(),_d=new THREE.Vector3(),_qa=new THREE.Quaternion(),_qb=new THREE.Quaternion(),_qi=new THREE.Quaternion();
function ik2(root,mid,end,target,pole,b1,b2){const l1=root.distanceTo(mid),l2=mid.distanceTo(end);_d.subVectors(target,root);let d=_d.length();d=clamp(d,Math.abs(l1-l2)+1e-3,l1+l2-1e-3);_d.normalize();
 const x=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-x*x));_p.copy(pole).addScaledVector(_d,-pole.dot(_d)).normalize();_k.copy(root).addScaledVector(_d,x).addScaledVector(_p,h);
 _a.subVectors(mid,root).normalize();_qa.setFromUnitVectors(_a,_b.subVectors(_k,root).normalize());b1.quaternion.copy(_qa);
 _a.subVectors(end,mid).normalize();_b.copy(root).addScaledVector(_d,d).sub(_k).normalize();_qi.copy(_qa).invert();_b.applyQuaternion(_qi);_qb.setFromUnitVectors(_a,_b);b2.quaternion.copy(_qb)}
// pose parameters, smoothed every frame by the physics/animation layer
const POSE={crouch:.12,tuck:0,lean:0,edge:0,twist:0,look:0,grab:0,grabType:0,air:0,flail:0,wob:0,rail:0,butter:0,load:0,wind:0,absorb:0,arms:1,tweak:0,lift:0,brake:0,idle:0,skiSplay:0};
const _t=new THREE.Vector3(),_hq=new THREE.Quaternion(),_q3=new THREE.Quaternion(),_q4=new THREE.Quaternion(),_e=new THREE.Euler(),_m4=new THREE.Matrix4(),_v1=new THREE.Vector3(),_v2=new THREE.Vector3();
// grab targets on the skis, in root space: mute = front hand across to the outside of the ski ahead of the boot; tail = back of the ski; japan = tip pulled up behind
function poseSkier(dt,t){if(!RD.ready)return;const B=RD.bones,P=POSE;
 for(let i=0;i<B.length;i++){B[i].position.copy(RD.rest[i]);B[i].quaternion.identity()}
 // ---- skis: in the air they float up toward the grab; tweaks, butters and splay ----
 const g=P.grab,gt=P.grabType,air=P.air;
 for(const s of RD.skis){const sd=s.sd;s.g.position.copy(s.base);s.g.rotation.set(0,0,0);
  const lift=air*.1+g*(gt===3?.42:.36)+P.lift*.05;s.g.position.y+=lift;s.g.position.x+=sd*-P.skiSplay*.05;
  // edge into the carve
  s.g.rotation.z=-P.edge*.75;
  if(gt===1&&g>0){s.g.rotation.x=-g*.25;s.g.rotation.y=sd*g*.08}
  if(gt===2&&g>0){s.g.rotation.x=g*.5;s.g.position.z-=g*.08}
  if(gt===3&&g>0){s.g.rotation.x=-g*.75;s.g.rotation.z+=sd*g*.25;s.g.position.z-=g*.32;s.g.rotation.y=-sd*g*.35}
  if(P.butter){s.g.rotation.x=-P.butter*.32;s.g.position.y+=Math.abs(P.butter)*.1}
  if(P.tweak)s.g.rotation.y+=sd*P.tweak*.2;s.g.updateMatrix()}
 // ---- hips: drop with crouch, grabs pull the knees up rather than the body down ----
 const c=clamp(P.crouch+P.absorb*.6+P.load*.55+P.tuck*.7,0,1.25),drop=c*.3+P.tuck*.05,fwd=c*.07+P.tuck*.08;
 B[0].position.y-=drop;B[0].position.z-=fwd*.6;B[0].position.y+=g*.12+air*.05;
 _e.set(P.tuck*.35+c*.15+P.butter*.25,P.twist*.3,P.lean*.08);B[0].quaternion.setFromEuler(_e);
 _hq.copy(B[0].quaternion).invert();
 for(const n of['R','L']){const L=RD.leg[n],s=RD.skis[L.ski];
  // ankle target: the binding point on the ski, lifted to ankle height
  _t.set(0,.11,-.05).applyMatrix4(s.g.matrix);_t.sub(RD.hips0).sub(_a.set(B[0].position.x-RD.rest[0].x,B[0].position.y-RD.rest[0].y,B[0].position.z-RD.rest[0].z)).applyQuaternion(_hq);
  const hp=_v1.copy(L.hp).sub(RD.hips0),kn=_v2.copy(L.kn).sub(RD.hips0),an=_k.copy(L.an).sub(RD.hips0);ik2(hp.clone(),kn.clone(),an.clone(),_t.clone(),_p.set(n==='R'?-.15:.15,0,1).normalize(),B[L.b[0]],B[L.b[1]]);
  _q4.setFromRotationMatrix(_m4.extractRotation(s.g.matrix));_q3.copy(B[0].quaternion).multiply(B[L.b[0]].quaternion).multiply(B[L.b[1]].quaternion).invert().multiply(_q4);B[L.b[2]].quaternion.copy(_q3)}
 // ---- torso ----
 const lean=P.tuck*.55+c*.28+g*.5+P.load*.15,br=Math.sin(t*1.7)*.012*P.idle;
 _e.set(lean*.45+br,P.twist*.35+P.wind*.35,-P.lean*.05+P.wob*.05);B[1].quaternion.setFromEuler(_e);
 _e.set(lean*.35,P.twist*.4+P.wind*.55,-P.lean*.06-P.wob*.06);B[2].quaternion.setFromEuler(_e);
 _e.set(-lean*.4+.06,P.look*.35-P.twist*.3-P.wind*.4,0);B[3].quaternion.setFromEuler(_e);_e.set(-lean*.35+.1,P.look*.5-P.twist*.3-P.wind*.4,0);B[4].quaternion.setFromEuler(_e);
 // ---- arms: hands forward holding poles; out wide on rails and in the air; tucked for speed ----
 const ab=P.arms,rl=P.rail,aw=clamp(air*.6+rl,0,1),sl=Math.sin(t*1.3)*.03;
 for(const n of['R','L']){const A=RD.arm[n],sx=n==='R'?-1:1,b0=B[A.b[0]],b1=B[A.b[1]];
  _e.set(-.35*ab-P.tuck*.85+sl+aw*.15-P.load*.5,sx*(-.15-P.tuck*.2),sx*(.25+aw*.95+P.flail*Math.sin(t*12+sx)*.9));b0.quaternion.setFromEuler(_e);
  _e.set(-.75*ab+P.tuck*-.6+aw*.35+P.flail*Math.cos(t*10)*.6,0,sx*.1);b1.quaternion.setFromEuler(_e)}
 if(g>.01){// reach for the ski with the grabbing hand
  const n=gt===1?'L':gt===2?'R':'R',A=RD.arm[n],s=RD.skis[gt===1?0:gt===2?1:1];
  _t.set(gt===1?.06:0,.06,gt===1?.38:gt===2?-.62:.62).applyMatrix4(s.g.matrix);
  RD.sm.updateMatrixWorld(true);const tw=_t.clone();RD.root.localToWorld(tw);const chest=B[2];chest.updateMatrixWorld(true);const tl=chest.worldToLocal(tw);
  const sh=A.sh.clone().sub(RD.chest0),el=A.el.clone().sub(RD.chest0),wr=A.wr.clone().sub(RD.chest0),qs=B[A.b[0]].quaternion.clone(),qe=B[A.b[1]].quaternion.clone();
  ik2(sh,el,wr,tl,A.pole,B[A.b[0]],B[A.b[1]]);B[A.b[0]].quaternion.slerp(qs,1-g);B[A.b[1]].quaternion.slerp(qe,1-g)}
 // ---- poles: hang back from the hands, pointing down and behind ----
 RD.root.updateMatrixWorld(true);
 for(let i=0;i<RD.poles.length;i++){const pl=RD.poles[i],wr=B[i?10:7];wr.updateMatrixWorld(true);wr.getWorldQuaternion(_q3);
  const sx=i?1:-1,back=lerp(.55,.15,P.tuck)+aw*.3,dir=_v1.set(sx*(.12+aw*.3),-1,-back).normalize();// in root space
  _q4.setFromUnitVectors(_v2.set(0,-1,0),dir);RD.root.getWorldQuaternion(_hq);_q4.premultiply(_hq);_q3.invert().multiply(_q4);pl.quaternion.copy(_q3)}}

// ================= PHYSICS: carving, popping, air rotation, rails, butters, landings =================
// Fixed 120 Hz steps. On snow PH.pos is the ski bases; in the air the body's centre of mass flies and the feet hang below it.
const G9=11.2,COM=.86,DT=1/120;// a little heavier than real gravity: snappier, less floaty airs
const PH={pos:new THREE.Vector3(),vel:new THREE.Vector3(),com:new THREE.Vector3(),n:new THREE.Vector3(0,1,0),dir:new THREE.Vector3(0,0,-1),q:new THREE.Quaternion(),
 ground:true,airT:0,offT:0,sw:false,steer:0,edge:0,brake:0,tuck:0,skid:0,load:0,wind:0,coyote:0,popped:false,
 rail:null,railCool:0,lastRail:null,butter:null,butterCool:0,crash:null,speed:0,top:0,landT:9,impact:0,sketch:0,lastFeat:null,
 // air trick state
 phi:0,phiV:0,psi:0,psiV:0,beta:0,tilt:0,tiltV:0,tiltMax:0,corked:false,flipKind:'',spinIn:0,flipIn:0,rotInT:0,qBase:new THREE.Quaternion(),toQ:new THREE.Quaternion(),
 takeoffSw:false,maxH:0,toY:0,grab:0,grabHeld:{1:0,2:0,3:0},grabOrder:[],lastGrab:0,landPred:null,ttl:9,windT:0,butterAir:false};
const _g=new THREE.Vector3(0,-G9,0),_v=new THREE.Vector3(),_w=new THREE.Vector3(),_u=new THREE.Vector3(),_f=new THREE.Vector3(),_l=new THREE.Vector3(),_n3=new THREE.Vector3(),_q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_m=new THREE.Matrix4(),UP=new THREE.Vector3(0,1,0),_x=new THREE.Vector3();
function basisQ(fwd,up,out){// body frame: +Z forward, +Y up, +X left
 _u.copy(up).normalize();_f.copy(fwd).addScaledVector(_u,-fwd.dot(_u));if(_f.lengthSq()<1e-8)_f.set(0,0,-1).addScaledVector(_u,_u.z);_f.normalize();_l.crossVectors(_u,_f);_m.makeBasis(_l,_u,_f);return out.setFromRotationMatrix(_m)}
function phReset(s,u,spd){const x=cxS(s)+(u||0),z=-s;PH.pos.set(x,H(x,z),z);Hn(x,z,PH.n);const dn=_v.set(cxS(s+3)-cxS(s),0,-3).normalize();PH.dir.copy(dn).addScaledVector(PH.n,-dn.dot(PH.n)).normalize();
 PH.vel.copy(PH.dir).multiplyScalar(spd||0);Object.assign(PH,{ground:true,airT:0,offT:0,sw:false,steer:0,edge:0,brake:0,tuck:0,load:0,wind:0,rail:null,butter:null,crash:null,top:0,landT:9,phi:0,psi:0,phiV:0,psiV:0,tilt:0,corked:false,grab:0,popped:false,railCool:0,butterCool:0,sketch:0});
 basisQ(PH.dir,PH.n,PH.q)}
// ---------------- snow ----------------
function stepGround(I,ev){const p=PH.pos,v=PH.vel,n=Hn(p.x,p.z,PH.n),dir=PH.dir;
 dir.addScaledVector(n,-dir.dot(n)).normalize();
 // gravity along the skis pulls fully; across them the edges hold, except on very steep walls, when skidding or buttering
 {const gt=_w.copy(_g).addScaledVector(n,-_g.dot(n)),ga=gt.dot(dir),slip=PH.butter?1:clamp(.12+.7*PH.skid+.9*sstep(.55,.2,n.y),0,1);v.addScaledVector(dir,ga*DT).addScaledVector(gt.addScaledVector(dir,-ga),slip*DT)}
 const sp0=v.length(),fwdDot=v.dot(dir);PH.sw=sp0>1.2?fwdDot<0:PH.sw;const aim=_f.copy(dir).multiplyScalar(PH.sw?-1:1);// direction the skis say we should travel
 // steering rotates the skis about the snow normal; quicker at low speed
 const bt=PH.butter;PH.steer=damp(PH.steer,I.steer,I.steer?10:14,DT);
 const brk=!bt&&I.back>.2&&!I.pop?I.back:0;PH.brake=damp(PH.brake,brk,7,DT);PH.tuck=damp(PH.tuck,!bt&&I.fwd>.2&&!I.pop?1:0,5,DT);
 let rate=(2.6/(1+sp0*.06))*(1+PH.brake*.5);if(bt)rate=4.2;
 dir.applyAxisAngle(n,-PH.steer*rate*DT);
 // hockey stop: skis swing across the fall of travel
 if(PH.brake>.05&&sp0>1){const lat=_l.crossVectors(n,v).normalize(),side=Math.sign(lat.dot(dir)||1),tgt=_x.copy(v).normalize().applyAxisAngle(n,side*1.25);dir.lerp(tgt,1-Math.exp(-PH.brake*6*DT)).addScaledVector(n,-dir.dot(n)).normalize()}
 // grip: carve the velocity toward the skis; skidding scrubs speed
 const vt=_w.copy(v).addScaledVector(n,-v.dot(n)),spd=vt.length();let skid=0;
 if(spd>.3&&!bt){aim.copy(dir).multiplyScalar(vt.dot(dir)<0?-1:1);const ang=vt.angleTo(aim);skid=Math.sin(Math.min(ang,PI/2));
  const grip=(PH.brake>.1?3.2:7.5)*DT,turn=Math.min(ang,grip*(1+spd*.02));if(ang>1e-4){_x.crossVectors(vt,aim).normalize();vt.applyAxisAngle(_x,turn)}
  const loss=skid*(PH.brake>.1?7:5)*DT*Math.min(1,spd/4);vt.multiplyScalar(Math.max(0,spd-loss)/spd)}
 PH.skid=damp(PH.skid,skid,10,DT);
 // friction and air drag; tucking cuts drag; butters drag a little
 const s2=vt.length(),dec=(.05+(bt?.06:0))*G9*n.y+(.0052-.0024*PH.tuck)*s2*s2+PH.brake*6.5*Math.min(1,s2/3);const ns=Math.max(0,s2-dec*DT);if(s2>1e-5)vt.multiplyScalar(ns/s2);
 if(s2<.6&&I.fwd>.2&&!bt)vt.addScaledVector(aim.copy(dir).multiplyScalar(PH.sw?-1:1),2.2*DT);// skate/pole push at a standstill
 v.copy(vt);PH.edge=damp(PH.edge,clamp(PH.steer*rate*Math.min(s2,20)/G9*.9,-1,1),9,DT);
 // butters: B presses the nose (or the tail with S); A/D spin on the snow; release rebounds
 PH.butterCool=Math.max(0,PH.butterCool-DT);
 if(!bt&&I.butter&&PH.butterCool<=0&&s2>2){PH.butter={t:0,tail:I.back>.2,rot:0,yaw0:headingOf(dir),last:headingOf(dir)};ev.butterOn=1}
 if(PH.butter){const b=PH.butter;b.t+=DT;const h=headingOf(dir);b.rot+=wrapA(h-b.last);b.last=h;if(!I.butter||b.t>1.5){ev.butterOff=b;PH.butter=null;PH.butterCool=1;if(b.t>.25){v.addScaledVector(n,1.4+Math.min(b.t,1)*1.4);PH.popped=true;ev.pop=.5}}}
 // pop: hold to load (and wind up with A/D), release to jump
 if(I.pop&&!PH.butter){PH.load=Math.min(1,PH.load+DT*2.3);PH.wind=clamp(PH.wind+I.steer*DT*2.4,-1,1);if(!I.steer)PH.wind=damp(PH.wind,PH.wind,1,DT)}
 if(I.popRel&&PH.load>0){const k=.35+PH.load*.65,perf=nearLip(p)&&PH.load>.5;if(perf){v.addScaledVector(n,.9);ev.perfect=1;PH.perfect=1}v.addScaledVector(n,1.2+k*2.5);ev.pop=k;PH.popped=true;PH.spinIn=PH.wind;PH.load=0}
 if(!I.pop&&!I.popRel){PH.load=Math.max(0,PH.load-DT*4);PH.wind=damp(PH.wind,0,4,DT)}
 // move, then follow the snow or leave it
 p.addScaledVector(v,DT);const h=H(p.x,p.z),n2=Hn(p.x,p.z,_n3),gap=p.y-h;
 const vtn=v.dot(n2),t=_w.copy(v).addScaledVector(n2,-vtn);const tl=t.length();let leave=false;
 if(PH.popped&&vtn>.5)leave=true;
 else if(tl>4){t.multiplyScalar(1/tl);const look=Math.min(.05,.3/tl),q=_x.copy(p).addScaledVector(t,tl*look);q.y=Math.max(q.y,h+t.y*tl*look);const drop=q.y-H(q.x,q.z),bal=.5*G9*n2.y*look*look;if(drop>bal+.007)leave=true}
 if(gap>.25)leave=true;
 if(leave){PH.ground=false;takeoff(ev);return}
 p.y=h;n.copy(n2);// keep speed through smooth transitions, absorb real impacts
 if(Math.abs(vtn)<2.5){const s=v.length();v.addScaledVector(n2,-vtn);const l=v.length();if(l>1e-4)v.multiplyScalar(s/l)}else{v.addScaledVector(n2,-vtn);ev.thud=Math.abs(vtn)}
 PH.popped=false;PH.offT=0;
 // ride onto a box or rail from the snow
 if(PH.railCool<=0){const rq=railNear(p,.6);if(rq&&rq.r.ride&&rq.dh<rq.r.w+.12&&p.y-rq.y>-.25&&p.y-rq.y<.22)railOn(rq,ev)}
 basisQ(dir,_w.copy(n).lerp(UP,.15),PH.q);
 if(PH.butter){_q.setFromAxisAngle(_l.set(1,0,0),PH.butter.tail?-.18:.18);PH.q.multiply(_q)}}
function headingOf(d){return Math.atan2(d.x,d.z)}
// ---------------- takeoff ----------------
function takeoff(ev){const p=PH.pos,n=PH.n;
 // off a steep wall (the pipe): keep the climb and the run along the wall, drop the drift out over the deck, lean a touch back in
 if(n.y<.4){// across the pipe (or across the wall's fall line), toward the middle
  const P=PK.pipe;let nh;if(P){toLocal(P,p.x,p.z,_L);nh=_w.set(P.l.x,0,P.l.z).multiplyScalar(-Math.sign(_L.b||1))}else{nh=_w.set(n.x,0,n.z).normalize()}
  const inw=PH.vel.dot(nh),T=2*Math.max(PH.vel.y,1.5)/G9;PH.vel.addScaledVector(nh,1.05/T-inw)}PH.com.copy(p).addScaledVector(n,COM);PH.airT=0;PH.offT=0;PH.coyote=PH.popped?0:.12;
 basisQ(PH.dir,n,PH.qBase);PH.phi=0;PH.psi=0;PH.tilt=0;PH.tiltMax=0;PH.psiV=0;PH.tiltV=0;PH.beta=0;PH.corked=false;PH.flipKind='';PH.rotInT=0;PH.maxH=0;PH.toY=p.y;
 PH.phiV=-PH.spinIn*5.2;PH.spinIn=0;PH.phi0=0;PH.fromRail=false;PH.wind=0;PH.takeoffSw=PH.sw;PH.grabHeld={1:0,2:0,3:0};PH.grabOrder=[];PH.grab=0;PH.butterAir=false;PH.butter=null;
 featH(p.x,p.z);PH.lastFeat=FH.f;PH.landPred=null;PH.vpPrev=null;ev.takeoff=1}
// ---------------- air ----------------
const SPIN_MAX=8.6,FLIP_MAX=7.4,ROLL_MAX=6.4;
// after letting go: keep turning to the next half spin (or full flip) and stop on it, slowing only as much as needed
function settle(x,v,tgt){const e=tgt-x,ae=Math.abs(e);if(ae<1e-3)return 0;const s=Math.sign(e),sp=Math.min(Math.max(Math.abs(v)*(Math.sign(v)===s?1:0),2.2),Math.sqrt(2*22*ae));return Math.min(sp,ae/DT)*s}
function stepAir(I,ev){const v=PH.vel,c=PH.com;PH.airT+=DT;
 v.addScaledVector(_g,DT);v.multiplyScalar(1-.0011*v.length()*DT);c.addScaledVector(v,DT);
 // late pop off the lip (coyote time) and loading in the air
 if(PH.coyote>0){PH.coyote-=DT;if(I.pop){PH.load=Math.min(1,PH.load+DT*2.3);PH.wind=clamp(PH.wind+I.steer*DT*2.4,-1,1)}
  if(I.popRel&&PH.load>0){const k=.35+PH.load*.65;if(PH.airT<.06&&PH.load>.5&&PH.lastFeat&&PH.lastFeat.type==='kick'){v.addScaledVector(_u.set(0,1,0).applyQuaternion(PH.qBase),.9);ev.perfect=1;PH.perfect=1}v.addScaledVector(_u.set(0,1,0).applyQuaternion(PH.qBase),1.3+k*2.4);ev.pop=k;PH.load=0;PH.phiV-=PH.wind*5.2;PH.wind=0;PH.coyote=0}}
 else PH.load=Math.max(0,PH.load-DT*3);
 // rotation inputs
 const spinIn=I.steer,flipIn=I.back-I.fwd,rollIn=(I.rollR?1:0)-(I.rollL?1:0),rodeo=I.rodeo;let rot=false;
 const early=PH.airT<.22;
 if(early&&(spinIn||Math.abs(PH.phiV)>2)&&(flipIn>.3||rodeo)&&!PH.flipKind){PH.corked=true}
 if(!PH.flipKind){if(flipIn>.3&&!rodeo)PH.flipKind='back';else if(flipIn<-.3&&!rodeo)PH.flipKind='front';else if(rodeo)PH.flipKind=flipIn<-.3?'misty':'rodeo';else if(rollIn&&!spinIn&&Math.abs(PH.phiV)<1.5)PH.flipKind='roll'}
 // spin (yaw about the body frame's up)
 if(spinIn){const tilted=PH.flipKind&&!PH.corked&&PH.flipKind!=='roll'&&Math.abs(PH.psi)>.5;PH.phiV=damp(PH.phiV,-spinIn*SPIN_MAX*(tilted?.35:1)*(PH.grab>.5?1.08:1),6,DT);PH.spinT=PH.airT;rot=true}
 else{const tgt=(PH.phiV>.8?Math.ceil(PH.phi/PI-.12):PH.phiV<-.8?Math.floor(PH.phi/PI+.12):Math.round(PH.phi/PI))*PI;PH.phiV=settle(PH.phi,PH.phiV,tgt)}
 // flips (back/front about the lateral axis, rodeo/misty about a diagonal, roll about the forward axis)
 const fk=PH.flipKind;let fIn=0;if(fk==='back'||fk==='rodeo')fIn=flipIn>.3||rodeo?1:0;else if(fk==='front'||fk==='misty')fIn=flipIn<-.3||(rodeo&&flipIn<-.3)?-1:0;else if(fk==='roll')fIn=rollIn;
 PH.beta=fk==='roll'?PI/2*Math.sign(rollIn||PH.psiV||1):fk==='rodeo'||fk==='misty'?PI/4*Math.sign(PH.phiV||spinIn||1):0;
 if(fk&&fIn){PH.psiV=damp(PH.psiV,fIn*(fk==='roll'?ROLL_MAX:FLIP_MAX),5,DT);rot=true}
 else{const tgt=(PH.psiV>.8?Math.ceil(PH.psi/TAU-.1):PH.psiV<-.8?Math.floor(PH.psi/TAU+.1):Math.round(PH.psi/TAU))*TAU;PH.psiV=settle(PH.psi,PH.psiV,tgt)}
 // flatspin: an air roll held while spinning lays the body over, then it comes back
 if(rollIn&&fk!=='roll'&&Math.abs(PH.phiV)>2){PH.tilt=damp(PH.tilt,rollIn*1.15,4,DT);rot=true}else PH.tilt=damp(PH.tilt,0,4.5,DT);PH.tiltMax=Math.max(PH.tiltMax,Math.abs(PH.tilt));
 if(rot)PH.rotInT=PH.airT;
 // landing prediction and assist
 if(((PH.airT*120)|0)%6===0)predictLanding();
 const lp=PH.landPred;PH.ttl=lp?lp.t:9;
 if(save.set.assist&&lp&&lp.t<.42&&PH.airT-PH.rotInT>.12){const k=DT*(1-lp.t/.42)*3.4,ep=Math.round(PH.phi/PI)*PI-PH.phi,eq=Math.round(PH.psi/TAU)*TAU-PH.psi;PH.phi+=clamp(ep,-k,k);PH.psi+=clamp(eq,-k,k)}
 PH.phi+=PH.phiV*DT;PH.psi+=PH.psiV*DT;
 // the body frame levels out in flight and leans into the landing slope just before touchdown
 _u.set(0,1,0).applyQuaternion(PH.qBase);const tgtUp=lp&&lp.t<.55?lp.n:UP,kb=lp&&lp.t<.55?7:2.6;_w.copy(_u).lerp(tgtUp,1-Math.exp(-kb*DT)).normalize();_q.setFromUnitVectors(_u,_w);PH.qBase.premultiply(_q);
 // the frame turns with the direction of travel (seen from its own up), so the body keeps its angle to the trajectory: pipe airs come back down pointing down the wall
 {const U=_u.set(0,1,0).applyQuaternion(PH.qBase),vp=_v.copy(v).addScaledVector(U,-v.dot(U));if(vp.length()>2){vp.normalize();if(PH.vpPrev){const pv=PH.vpPrev,c=clamp(pv.dot(vp),-1,1),s=_x.crossVectors(pv,vp).dot(U),a=Math.atan2(s,c);if(Math.abs(a)>1e-5){_q.setFromAxisAngle(U,a);PH.qBase.premultiply(_q)}}else PH.vpPrev=new THREE.Vector3();PH.vpPrev.copy(vp)}}
 composeAirQ(PH.q);
 // grabs
 const gk=I.mute?1:I.tail?2:I.japan?3:0;if(gk&&gk!==PH.lastGrab){ev.grab=gk;if(!PH.grabOrder.includes(gk))PH.grabOrder.push(gk)}PH.lastGrab=gk;
 if(gk){PH.grabHeld[gk]+=DT;PH.grab=gk}else PH.grab=0;
 if(I.butter)PH.butterAir=true;
 // height above the snow
 const gy=H(c.x,c.z);PH.maxH=Math.max(PH.maxH,c.y-COM-gy);
 // feet position for the visual root
 _u.set(0,1,0).applyQuaternion(PH.q);PH.pos.copy(c).addScaledVector(_u,-COM);
 // rails
 PH.railCool=Math.max(0,PH.railCool-DT);
 if(PH.railCool<=0&&v.y<2.5){_x.copy(c);_x.y-=COM;const rq=railNear(_x,.7);if(rq){const dy=_x.y-rq.y;const vh=Math.hypot(v.x,v.z),along=Math.abs(v.x*rq.tx+v.z*rq.tz)/Math.max(.1,Math.hypot(rq.tx,rq.tz));
  if(rq.dh<rq.r.w+.28&&dy>-.35&&dy<.5&&along>vh*.45&&vh>2){railOn(rq,ev);return}}}
 // touchdown
 _u.set(0,1,0).applyQuaternion(PH.qBase);_x.copy(c).addScaledVector(_u,-COM);const gh=H(_x.x,_x.z);
 if(_x.y<=gh&&PH.airT>.03){Hn(_x.x,_x.z,_n3);const vn=PH.vel.dot(_n3);if(vn<-.6||PH.airT>.16&&vn<.4)land(ev,_n3);else c.y+=gh-_x.y}}
function composeAirQ(out){// base frame * spin about up * flip about the (rotating) axis * flatspin lay-over
 out.copy(PH.qBase);_q.setFromAxisAngle(UP,PH.phi);out.multiply(_q);
 const b=PH.beta;_x.set(Math.cos(b),0,Math.sin(b));_q.setFromAxisAngle(_x,-PH.psi);out.multiply(_q);
 if(PH.tilt){_q.setFromAxisAngle(_x.set(0,0,1),PH.tilt);out.multiply(_q)}return out}
function predictLanding(){const c=_v.copy(PH.com),v=_w.copy(PH.vel);let t=0;for(let i=0;i<60;i++){const dt=.035;v.y-=G9*dt;c.addScaledVector(v,dt);t+=dt;const h=H(c.x,c.z);if(c.y-COM<=h){PH.landPred={t,n:Hn(c.x,c.z,new THREE.Vector3()),x:c.x,z:c.z};return}}PH.landPred=null}
// ---------------- landing ----------------
function land(ev,n){const v=PH.vel,q=PH.q;PH.pos.copy(PH.com).addScaledVector(n,-COM);PH.pos.y=H(PH.pos.x,PH.pos.z);PH.n.copy(n);
 const F=_f.set(0,0,1).applyQuaternion(q),U=_u.set(0,1,0).applyQuaternion(q),vt=_w.copy(v).addScaledVector(n,-v.dot(n)),Ft=_x.copy(F).addScaledVector(n,-F.dot(n));
 const vn=-v.dot(n),spd=vt.length();let eY=0,sw=false;if(spd>1.5&&Ft.lengthSq()>1e-4){const a=Ft.angleTo(vt);sw=a>PI/2;eY=sw?PI-a:a}
 // tilt error: how far the trick rotation leaves the body from upright, plus a little of any lag in the auto-levelling frame
 const tq=_q2.setFromAxisAngle(UP,PH.phi);_q.setFromAxisAngle(_v.set(Math.cos(PH.beta),0,Math.sin(PH.beta)),-PH.psi);tq.multiply(_q);if(PH.tilt){_q.setFromAxisAngle(_v.set(0,0,1),PH.tilt);tq.multiply(_q)}
 const trickTilt=_v.set(0,1,0).applyQuaternion(tq).angleTo(UP),baseErr=_l.set(0,1,0).applyQuaternion(PH.qBase).angleTo(n);
 const eT=trickTilt+baseErr*.35,flipErr=Math.abs(wrapA(PH.psi)),deg=180/PI;
 let quality='clean';if(eY*deg>58||eT*deg>62||vn>16.5)quality='crash';else if(eY*deg>24||eT*deg>30||vn>11.5)quality='sketchy';
 ev.land={quality,perfect:PH.perfect||0,phi0:PH.phi0||0,eY:eY*deg,eT:eT*deg,vn,sw,air:PH.airT,maxH:PH.maxH,phi:PH.phi,phi0:PH.phi0||0,psi:PH.psi,beta:PH.beta,tilt:PH.tiltMax,corked:PH.corked,kind:PH.flipKind,toSw:PH.takeoffSw,grabs:Object.assign({},PH.grabHeld),grabOrder:PH.grabOrder.slice(),butter:PH.butterAir,feat:PH.lastFeat,spd};
 if(quality==='crash'){startCrash(ev,vn);return}
 // the skis settle along the travel direction (forward or switch)
 Ft.copy(F).addScaledVector(n,-F.dot(n));if(Ft.lengthSq()<1e-4)Ft.copy(vt);Ft.normalize();PH.dir.copy(Ft);PH.sw=sw;
 const loss=Math.max(0,vn-3)*.18+(quality==='sketchy'?.12*spd:0);v.addScaledVector(n,-v.dot(n));const l=v.length();if(l>1e-3)v.multiplyScalar(Math.max(0,l-loss)/l);
 PH.ground=true;PH.airT=0;PH.perfect=0;PH.phi=PH.psi=PH.phiV=PH.psiV=PH.tilt=0;PH.impact=clamp(vn/10,0,1)+.15;PH.sketch=quality==='sketchy'?1:0;PH.landT=0;PH.popped=false;PH.load=0;
 if(PH.butterAir&&quality==='clean'){PH.butter={t:0,tail:false,rot:0,yaw0:headingOf(PH.dir),last:headingOf(PH.dir)}}
 basisQ(PH.dir,n,PH.q)}
// ---------------- rails ----------------
function railOn(rq,ev){const r=rq.r,v=PH.vel,tdir=_v.set(rq.tx,rq.ty,rq.tz),along=v.dot(tdir),sgn=along>=0?1:-1;
 // the skis' angle to the rail, snapped to a quarter turn
 const F=_f.set(0,0,1).applyQuaternion(PH.ground?PH.q:composeAirQ(_q2)),yawB=Math.atan2(F.x,F.z),yawR=Math.atan2(tdir.x*sgn,tdir.z*sgn),rel=wrapA(yawB-yawR),slot=Math.round(rel/(PI/2));
 let sl=slot;if(sl===0&&INP.steer)sl=-Math.sign(INP.steer);const wasAir=!PH.ground;PH.rail={r,s:rq.s,sgn,v:Math.abs(along),slot:sl,yaw:rel,yawV:0,t:0,swaps:0,on:{phi:wasAir?PH.phi-(PH.phi0||0):0,air:wasAir,tSlot:sl,rel},len0:rq.s,dist:0,sw:Math.abs(sl)===2,cool:0};
 PH.ground=false;PH.airT=0;PH.load=0;ev.railOn=PH.rail;
 PH.phi=PH.psi=PH.phiV=PH.psiV=PH.tilt=0}
function stepRail(I,ev){const R=PH.rail,r=R.r;R.t+=DT;const tan=_v;railAt(r,R.s,PH.pos,tan);tan.multiplyScalar(R.sgn);
 R.v+=(-G9*tan.y-(r.kind==='box'?.09:.055)*G9*Math.sqrt(Math.max(0,1-tan.y*tan.y)))*DT;R.v=Math.max(R.v,.6);R.s+=R.v*R.sgn*DT;R.dist+=R.v*DT;
 // swaps: A/D rotate the skis a quarter turn, two per rail
 R.cool=Math.max(0,R.cool-DT);const st=I.steerTap;if(st&&R.cool<=0&&R.swaps<2&&R.t>.1){R.slot+=st>0?-1:1;R.swaps++;R.cool=.22;ev.swap=1}
 R.yaw=damp(R.yaw,R.slot*PI/2,16,DT);
 PH.vel.copy(tan).multiplyScalar(R.v);
 const yawR=Math.atan2(tan.x,tan.z);_f.set(Math.sin(yawR+R.yaw),0,Math.cos(yawR+R.yaw));basisQ(_f,UP,PH.q);
 PH.dir.copy(_f);PH.com.copy(PH.pos).addScaledVector(UP,COM);
 const off=R.s<=0||R.s>=r.len;if(I.popRel&&R.t>.1||off){const k=I.popRel?1:0;PH.vel.y+=k?3:.5;ev.railOff={R,pop:k};PH.lastRail=r;PH.rail=null;PH.railCool=.35;
  // leave facing along the rail (forward or switch); the slide angle becomes where the spin starts, so spinning out counts and lands straight
  const skiYaw=yawR+R.yaw,fwdYaw=Math.abs(wrapA(skiYaw-yawR))<=PI/2?yawR:yawR+PI;_x.set(Math.sin(fwdYaw),0,Math.cos(fwdYaw));basisQ(_x,UP,PH.qBase);
  PH.ground=false;PH.com.copy(PH.pos).addScaledVector(UP,COM);PH.airT=0;PH.coyote=0;PH.phi=wrapA(skiYaw-fwdYaw);PH.phi0=PH.phi;PH.psi=0;PH.phiV=k&&I.steer?-I.steer*4:-PH.phi*5;PH.psiV=0;PH.tilt=0;PH.tiltMax=0;PH.corked=false;PH.flipKind='';PH.rotInT=0;PH.maxH=0;
  PH.takeoffSw=fwdYaw!==yawR;PH.grabHeld={1:0,2:0,3:0};PH.grabOrder=[];PH.landPred=null;PH.lastFeat=null;PH.fromRail=true;PH.butterAir=false;PH.vpPrev=null;ev.takeoff=1}}
// ---------------- crashes ----------------
function startCrash(ev,vn){const v=PH.vel;PH.crash={t:0,w:new THREE.Vector3(rr(-6,6),rr(-4,4),rr(-6,6)),settle:0};PH.ground=false;PH.rail=null;PH.butter=null;v.multiplyScalar(.7);ev.crash=vn||1}
function stepCrash(I,ev){const C=PH.crash,v=PH.vel,c=PH.com;C.t+=DT;
 v.addScaledVector(_g,DT);c.addScaledVector(v,DT);const h=H(c.x,c.z),n=Hn(c.x,c.z,_n3);
 if(c.y<h+.3){c.y=h+.3;const vn=v.dot(n);if(vn<0)v.addScaledVector(n,-vn*1.2);v.multiplyScalar(Math.exp(-2.2*DT));C.w.multiplyScalar(Math.exp(-3*DT));C.settle+=DT}
 const wl=C.w.length();if(wl>1e-3){_q.setFromAxisAngle(_x.copy(C.w).normalize(),wl*DT);PH.q.premultiply(_q)}
 PH.pos.copy(c);PH.pos.y-=.3;
 if(C.t>2.2||C.settle>1.4&&v.length()<2.5){const s=-c.z;PH.crash=null;phReset(s,c.x-cxS(s),Math.min(v.length(),4));ev.recover=1}}
// ---------------- step ----------------
function physicsStep(I,ev){if(PH.crash)stepCrash(I,ev);else if(PH.rail)stepRail(I,ev);else if(PH.ground)stepGround(I,ev);else stepAir(I,ev);
 PH.speed=PH.vel.length();PH.top=Math.max(PH.top,PH.speed);PH.landT+=DT;PH.railCool=Math.max(0,PH.railCool-(PH.ground?DT:0))}

// ================= TRICKS: naming, scoring, lines =================
// Rotation base 500 x turns^2 (spin turns and flips: the larger plus half the smaller). Each different grab held 0.25 s adds 100 and
// a quarter of the rotation base. Switch x1.25, off-axis x1.3, clean landing +150 and x1.15. Repeats within the last three airs pay
// 75%, 55%, 40%. Each extra link in a line adds 0.25 to the line multiplier; landing on snow and riding out banks it, a crash loses it.
const GRABN={1:'Mute',2:'Tail',3:'Japan'};
const TK={line:null,recent:[],run:null};
function newRun(){return{score:0,lines:0,bestLine:0,best:{pts:0,name:''},tricks:0,clean:0,crashes:0,air:0,maxAir:0,maxH:0,top:0,parts:{tricks:0,grabs:0,rails:0,landings:0,butters:0},log:[],t:0}}
function lineNew(){return{items:[],sum:0,links:0,timer:0,open:false}}
function lineMult(L){return 1+.25*Math.max(0,L.links-1)}
function lineTotal(L){return Math.round(L.sum*lineMult(L))}
function repeatFactor(key){let c=0;for(const k of TK.recent)if(k===key)c++;TK.recent.push(key);if(TK.recent.length>3)TK.recent.shift();return[1,.75,.55,.4][Math.min(c,3)]}
function rotBase(spinDeg,flips){const s=spinDeg/360,f=flips,T=Math.max(s,f)+.5*Math.min(s,f);return 500*T*T}
function airTrick(L){// from a landing event
 const dphi=Math.abs(L.phi-(L.phi0||0)),spin=Math.round(dphi/PI)*180,flips=Math.round(Math.abs(L.psi)/TAU),grabs=L.grabOrder.filter(g=>L.grabs[g]>=.25);
 let kind='',off=false;
 if(flips===0){if(L.tilt>.6&&spin>=360){kind='Flatspin';off=true}}
 else{const k=L.kind,mult=['','','Double ','Triple ','Quad '][Math.min(flips,4)];let base;
  if(k==='roll')base=spin>=360?'Flatspin':'Sideflip';else if(k==='rodeo')base='Rodeo';else if(k==='misty')base='Misty';
  else if(k==='back')base=spin>=180?(L.corked?'Cork':'Rodeo'):'Backflip';else if(k==='front')base=spin>=180?'Misty':'Frontflip';else base='Flip';
  kind=mult+base;off=spin>=180||k==='roll'||k==='rodeo'||k==='misty'}
 let name=(L.toSw?'Switch ':'')+(kind?kind+(spin>=180&&!/flip$/i.test(kind)?' '+spin:''):(spin?String(spin):''));
 if(!name.trim()||name==='Switch ')name=(L.toSw?'Switch ':'')+(grabs.length?'':'Straight air');
 if(grabs.length)name=(name.trim()?name.trim()+' ':'')+grabs.map(g=>GRABN[g]).join(' to ');
 name=name.replace(/\s+/g,' ').trim();
 const rb=rotBase(spin,flips),gb=grabs.length,grabT=grabs.reduce((a,g)=>a+L.grabs[g],0);
 let rot=rb*(1+.25*gb),gr=100*gb+280*grabT,air=45*L.air+12*Math.max(0,L.maxH);
 let m=1;if(L.toSw||L.sw)m*=1.25;if(off)m*=1.3;
 const dir=L.phi<0?'R':'L',key=[spin,flips,L.kind,dir,L.toSw?1:0].join('|');const rep=(spin||flips)?repeatFactor(key):1;
 rot*=m*rep;gr*=m*rep;let land=0,q=1;if(L.quality==='clean'){land=150;q=1.15}else q=.75;
 const stomp=L.quality==='clean'&&L.eY<7&&L.eT<9&&L.air>.6,bonus=(stomp?250:0)+(L.perfect?150:0);land+=bonus;const pts=(rot+gr+air)*q+land;const big=spin>=720||flips>=1;
 return{stomp,perfect:!!L.perfect,name,pts:Math.round(pts),parts:{tricks:rot*q,grabs:gr*q,landings:air*q+land},spin,flips,off,grabs,rep,key,big,quality:L.quality,link:L.air>.9||spin>=180||flips>0||gb>0}}
function railTrick(R,outSpin){const r=R.r,slide=Math.abs(R.slot%2)===1?'Slide':'Zero Spin',onDeg=Math.round(Math.abs(R.on.phi)/(PI/2))*90;
 let name='';if(R.on.air&&onDeg>=180)name+=onDeg+' On ';else if(R.sw)name+='Switch ';name+=slide;if(R.swaps)name+=R.swaps>1?' to Double Swap':' to Swap';
 const out=Math.round(Math.abs(outSpin||0)/(PI/2))*90;if(out>=180)name+=' '+out+' Out';name+=' on the '+r.name.toLowerCase();
 const kindK=r.kind==='rail'?1.1:r.kind==='tube'?1.05:1,spinP=onDeg>=180?rotBase(onDeg-90,0)*.8:0,outP=out>=180?rotBase(out-90,0)*.8:0;
 let pts=(120+85*R.dist+160*R.swaps+spinP+outP)*kindK*(R.sw?1.25:1);const rep=repeatFactor('rail|'+r.name+'|'+slide+'|'+onDeg);pts*=rep;
 return{name,pts:Math.round(pts),parts:{rails:pts},big:onDeg>=270||out>=270,link:true}}
function butterTrick(b){const deg=Math.round(Math.abs(b.rot)/PI)*180,name=(b.tail?'Tail':'Nose')+' Butter'+(deg?' '+deg:'');let pts=90*b.t+(deg?rotBase(deg,0)*.5:0);pts*=repeatFactor('butter|'+deg+'|'+(b.tail?1:0));return{name,pts:Math.round(pts),parts:{butters:pts},link:true}}
// ---- line flow ----
function lineAdd(tr){const run=TK.run;if(!run)return;if(!TK.line)TK.line=lineNew();const L=TK.line;
 L.items.push(tr);L.sum+=tr.pts;if(tr.link)L.links++;L.open=true;L.timer=6;L.parts=L.parts||{};for(const k in tr.parts)L.parts[k]=(L.parts[k]||0)+tr.parts[k];
 run.tricks++;if(tr.pts>run.best.pts)run.best={pts:tr.pts,name:tr.name};HUD.trick(tr,lineMult(L),lineTotal(L));sfx('trick',tr.big?5:tr.pts>1500?3:1);if(tr.big)WORLD.cheer=1.5}
function lineBank(reason){const L=TK.line,run=TK.run;if(!L||!L.items.length||!run){TK.line=null;return}const tot=lineTotal(L),m=lineMult(L);
 run.score+=tot;run.lines++;run.bestLine=Math.max(run.bestLine,tot);for(const k in L.parts)run.parts[k]+=L.parts[k]*m;run.log.push({items:L.items.map(i=>i.name),tot,m});
 HUD.bank(tot,m,L.items.length);sfx('bank',L.items.length);TK.line=null}
function lineLose(){const L=TK.line;if(L&&L.items.length){HUD.lost(lineTotal(L));sfx('lost')}TK.line=null}
function lineTick(dt){const L=TK.line;if(!L)return;if(PH.ground&&!PH.rail&&!PH.crash&&!PH.butter){L.timer-=dt;if(L.timer<=0)lineBank('time')}HUD.line(L,lineMult(L),lineTotal(L))}
// ---- physics events -> tricks ----
let railPend=null;
function trickEvents(ev){const run=TK.run;if(!run)return;
 if(ev.land){const L=ev.land;run.air+=L.air;run.maxAir=Math.max(run.maxAir,L.air);run.maxH=Math.max(run.maxH,L.maxH);
  if(L.quality==='crash'){railPend=null;return}
  if(railPend){const rt=railTrick(railPend,L.phi-(L.phi0||0));railPend=null;lineAdd(rt);if(L.quality==='clean')run.clean++;return}
  const tr=airTrick(L);if(L.quality==='clean')run.clean++;
  if(tr.link)lineAdd(tr);
  if(L.quality==='sketchy')HUD.flash('Sketchy landing','warn');else if(tr.link&&tr.stomp)HUD.flash(tr.perfect?'Perfect pop, stomped it':'Stomped it','good');else if(tr.link&&tr.perfect)HUD.flash('Perfect pop','good')}
 if(ev.railOn&&railPend){lineAdd(railTrick(railPend,0));railPend=null}
 if(ev.railOff){railPend=ev.railOff.R}
 if(ev.butterOff&&ev.butterOff.t>.4){lineAdd(butterTrick(ev.butterOff))}
 if(ev.crash){run.crashes++;railPend=null;lineLose();HUD.flash('Crashed','bad')}}

// ================= INPUT =================
const KEYS={},TOUCH={};const INP={steer:0,fwd:0,back:0,rollL:false,rollR:false,rodeo:false,pop:false,popRel:false,mute:false,tail:false,japan:false,butter:false,steerTap:0};
let popWas=false,steerWas=0,rebinding=null;
const keyName=c=>c?c.replace(/^Key/,'').replace(/^Digit/,'').replace('ShiftLeft','Left Shift').replace('ShiftRight','Right Shift').replace('ArrowLeft','Left arrow').replace('ArrowRight','Right arrow').replace('ArrowUp','Up arrow').replace('ArrowDown','Down arrow').replace('ControlLeft','Left Ctrl').replace('Escape','Esc'):'';
addEventListener('keydown',e=>{audioInit();if(rebinding){e.preventDefault();if(e.code!=='Escape')save.keys[rebinding]=e.code;rebinding=null;store();renderKeys();return}
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(e.code))e.preventDefault();KEYS[e.code]=true;if(!e.repeat)onKeyPress(e.code)});
addEventListener('keyup',e=>{KEYS[e.code]=false});
addEventListener('blur',()=>{for(const k in KEYS)KEYS[k]=false});
const act=a=>!!KEYS[save.keys[a]]||(a==='mute'&&KEYS.ShiftRight)||(a==='pause'&&KEYS.KeyP);
function padState(){const ps=navigator.getGamepads?navigator.getGamepads():[];for(const p of ps){if(p&&p.connected&&p.mapping==='standard')return p}return null}
function readInput(){const P=padState(),b=i=>P&&P.buttons[i]&&P.buttons[i].pressed,ax=i=>P?(Math.abs(P.axes[i])>.22?P.axes[i]:0):0;
 let steer=(act('right')?1:0)-(act('left')?1:0)+ax(0)+(TOUCH.steer||0);steer=clamp(steer,-1,1);
 const fwd=Math.max(act('fwd')?1:0,b(7)?1:0,b(5)?1:0,ax(1)<-.4?1:0,TOUCH.fwd?1:0),back=Math.max(act('back')?1:0,b(6)?1:0,ax(1)>.4?1:0,TOUCH.back?1:0);
 const pop=act('pop')||b(0)||!!TOUCH.pop;
 INP.steer=steer;INP.fwd=fwd;INP.back=back;INP.rollL=act('rollL')||ax(2)<-.5||!!TOUCH.rollL;INP.rollR=act('rollR')||ax(2)>.5||!!TOUCH.rollR;INP.rodeo=act('rodeo')||b(1)||ax(3)<-.5||!!TOUCH.rodeo;
 INP.mute=act('mute')||b(4)||!!TOUCH.mute;INP.tail=act('tail')||b(2)||!!TOUCH.tail;INP.japan=act('japan')||b(3)||!!TOUCH.japan;INP.butter=act('butter')||b(10)||!!TOUCH.butter;
 INP.popRel=popWas&&!pop;INP.pop=pop;popWas=pop;const sd=steer>.5?1:steer<-.5?-1:0;INP.steerTap=sd&&sd!==steerWas?sd:0;steerWas=sd;
 if(P){if(b(9)&&!PADB.s)onKeyPress(save.keys.pause);PADB.s=b(9);if(b(8)&&!PADB.v)KEYS.__restart=1;if(!b(8))KEYS.__restart=0;PADB.v=b(8);if(b(0)&&!PADB.a&&G.mode!=='ride')onKeyPress('Enter');PADB.a=b(0)}}
const PADB={};
function onKeyPress(code){if(code===save.keys.pause||code==='KeyP'){if(G.mode==='ride'||G.mode==='lift')togglePause();else if(G.mode==='paused')togglePause();else if(SCREEN.cur&&SCREEN.cur!=='menu'&&SCREEN.cur!=='results')back();return}
 if(G.mode==='lift'&&(code===save.keys.skip||code==='Space'||code==='Enter')){skipLift();return}
 if(G.mode==='ride'&&code===save.keys.cam){CAMV.mode=(CAMV.mode+1)%2;HUD.flash(CAMV.mode?'Head cam':'Chase cam','info');return}
 if(G.mode==='replay'){if(code==='Space')REPLAY.paused=!REPLAY.paused;if(code===save.keys.cam)REPLAY.cam=(REPLAY.cam+1)%3;if(code==='ArrowLeft')REPLAY.t=Math.max(0,REPLAY.t-2);if(code==='ArrowRight')REPLAY.t+=2;if(code==='ArrowDown')REPLAY.speed=REPLAY.speed===1?.35:1;if(code===save.keys.pause||code==='Enter')endReplay();return}
 if(code==='Enter'&&SCREEN.cur==='menu'){clickSfx();openParks();return}
 if(code==='Enter'&&SCREEN.cur==='results'){clickSfx();startRun(G.park);return}}
// touch controls: steer pad on the left, action buttons on the right
function initTouch(){if(!isTouch)return;document.body.classList.add('touch');const pad=$('tPad');let id=null,x0=0,y0=0;
 const upd=(x,y)=>{const dx=clamp((x-x0)/60,-1,1),dy=clamp((y-y0)/60,-1,1);TOUCH.steer=Math.abs(dx)>.15?dx:0;TOUCH.fwd=dy<-.45;TOUCH.back=dy>.45;$('tKnob').style.transform=`translate(${dx*40}px,${dy*40}px)`};
 pad.addEventListener('touchstart',e=>{const t=e.changedTouches[0];id=t.identifier;const r=pad.getBoundingClientRect();x0=r.left+r.width/2;y0=r.top+r.height/2;upd(t.clientX,t.clientY);e.preventDefault()},{passive:false});
 pad.addEventListener('touchmove',e=>{for(const t of e.changedTouches)if(t.identifier===id)upd(t.clientX,t.clientY);e.preventDefault()},{passive:false});
 const end=e=>{for(const t of e.changedTouches)if(t.identifier===id){id=null;TOUCH.steer=0;TOUCH.fwd=TOUCH.back=false;$('tKnob').style.transform=''}};pad.addEventListener('touchend',end);pad.addEventListener('touchcancel',end);
 document.querySelectorAll('[data-t]').forEach(b=>{const k=b.dataset.t;b.addEventListener('touchstart',e=>{TOUCH[k]=true;b.classList.add('on');audioInit();e.preventDefault()},{passive:false});const off=e=>{TOUCH[k]=false;b.classList.remove('on')};b.addEventListener('touchend',off);b.addEventListener('touchcancel',off)})}
// ================= HUD =================
const HUD=(()=>{let flashT=0,popT=0,bankT=0,hintT=0;const el={};
 function init(){['hud','hScore','hLine','hItems','hMult','hTotal','hTimer','hPop','hPopName','hPopPts','hLive','hSpin','hChips','hSpeed','hUnit','hFlash','hHint','hProg','hProgFill','hBank','hGuide','hGuideWin','hGuideMe','hGuideTxt'].forEach(k=>el[k]=$(k))}
 function trick(tr,m,tot){el.hPopName.textContent=tr.name;el.hPopPts.textContent='+'+fmt(tr.pts)+(tr.quality==='sketchy'?' (sketchy)':'');el.hPop.className='show'+(tr.big?' big':'');popT=2.1;void el.hPop.offsetWidth}
 function line(L,m,tot){if(!L||!L.items.length){el.hLine.classList.remove('show');return}el.hLine.classList.add('show');
  const names=L.items.slice(-4).map(i=>i.name);if(el.hItems.dataset.n!==String(L.items.length)){el.hItems.innerHTML='';names.forEach(n=>{const d=document.createElement('div');d.textContent=n;el.hItems.appendChild(d)});el.hItems.dataset.n=L.items.length}
  el.hMult.textContent='×'+m.toFixed(2).replace(/\.?0+$/,'');el.hTotal.textContent=fmt(tot);el.hTimer.style.transform=`scaleX(${clamp(L.timer/6,0,1)})`}
 function bank(tot,m,n){el.hBank.innerHTML='';const a=document.createElement('b');a.textContent='+'+fmt(tot);const s=document.createElement('span');s.textContent=n>1?`Line banked, ${n} tricks at ×${m.toFixed(2).replace(/\.?0+$/,'')}`:'Banked';el.hBank.append(a,s);el.hBank.className='show';bankT=2;el.hLine.classList.remove('show');el.hItems.dataset.n=''}
 function lost(tot){flash(`Line lost: ${fmt(tot)}`,'bad')}
 function flash(t,cls){el.hFlash.textContent=t;el.hFlash.className='show '+(cls||'');flashT=1.6}
 function hint(t,d){if(!save.set.hints)return;el.hHint.textContent=t;el.hHint.className='show';hintT=d||4}
 function live(){const air=!PH.ground&&!PH.crash&&!PH.rail;if(!air||PH.airT<.18){el.hLive.className='';return}
  const deg=Math.round(Math.abs(PH.phi-(PH.phi0||0))*180/PI/10)*10,fl=Math.round(Math.abs(PH.psi)/TAU*4)/4,chips=[],parts=[];if(deg>=90)parts.push(String(deg));if(fl>=.25)parts.push(fl+(fl>1?' flips':' flip'));let main=parts.join(' + ');
  if(PH.grab)chips.push(GRABN[PH.grab]);const ng=PH.grabOrder.filter(g=>PH.grabHeld[g]>=.25).length;if(ng)chips.push('grab ×'+(1+.25*ng).toFixed(2).replace(/0$/,''));
  if(PH.corked||PH.flipKind==='rodeo'||PH.flipKind==='misty'||PH.tiltMax>.6||PH.flipKind==='roll')chips.push('off-axis ×1.3');if(PH.takeoffSw)chips.push('switch ×1.25');chips.push(PH.airT.toFixed(1)+' s');
  el.hSpin.textContent=main;el.hChips.textContent=chips.join('   ');el.hLive.className='show'}
 function update(dt){if(flashT>0){flashT-=dt;if(flashT<=0)el.hFlash.className=''}if(popT>0){popT-=dt;if(popT<=0)el.hPop.className=''}if(bankT>0){bankT-=dt;if(bankT<=0)el.hBank.className=''}if(hintT>0){hintT-=dt;if(hintT<=0)el.hHint.className=''}
  const run=TK.run;if(run){el.hScore.textContent=fmt(run.score)}const mph=save.set.units==='mph';el.hSpeed.textContent=Math.round(PH.speed*(mph?2.237:3.6));el.hUnit.textContent=mph?'mph':'km/h';
  el.hProgFill.style.transform=`scaleX(${clamp((-PH.pos.z-PK.start.s)/(PK.finishS-PK.start.s),0,1)})`;live()
  // speed guide: the window of approach speeds that clears the table and lands on the landing
  const k=PH.ground&&!PH.rail&&!PH.crash?kickAhead(PH.pos):null;if(k&&k.d<55){const w=k.f.win,lo=w[0]-4,hi=w[1]+4,sp=lipSpeed(k.f,PH.pos,PH.speed,k.d),x=v=>clamp((v-lo)/(hi-lo),0,1)*100;
   el.hGuideWin.style.left=x(w[0])+'%';el.hGuideWin.style.width=(x(w[1])-x(w[0]))+'%';el.hGuideMe.style.left=x(sp)+'%';const st=sp<w[0]?'slow':sp>w[1]?'fast':'good';
   el.hGuideTxt.textContent=st==='good'?'Good speed':st==='slow'?'Too slow: tuck with W':'Too fast: brake with S';el.hGuide.className='show '+st}else el.hGuide.className=''}
 return{init,trick,line,bank,lost,flash,hint,update,small(){}}})();
// ================= MENUS =================
const SCREEN={cur:null,stack:[]};const SCREENS=['menu','parks','locker','records','settings','help','pause','results','loading'];
function show(id){SCREENS.forEach(s=>{const e=$(s);if(e)e.classList.toggle('hide',s!==id)});SCREEN.cur=id;$('hud').classList.toggle('hide',!(G.mode==='ride'||G.mode==='lift'));document.body.dataset.screen=id||'';
 if(id==='menu'){$('mTickets').textContent=fmt(save.tickets);Music.set(.1)}}
function hideAll(){show(null)}
function back(){clickSfx();const prev=SCREEN.stack.pop();if(G.mode==='paused')show('pause');else show(prev||'menu')}
function go(id){SCREEN.stack.push(SCREEN.cur);show(id)}
const clickSfx=()=>{audioInit();sfx('click')};
function bindUI(){document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>{clickSfx();const t=b.dataset.go;if(t==='parks')openParks();else if(t==='locker')openLocker();else if(t==='records')openRecords();else if(t==='settings'){loadSettings();go('settings')}else go(t)});
 document.querySelectorAll('[data-back]').forEach(b=>b.onclick=back);
 $('pResume').onclick=()=>{clickSfx();togglePause()};$('pRestart').onclick=()=>{clickSfx();startRun(G.park)};$('pSettings').onclick=()=>{clickSfx();loadSettings();SCREEN.stack.push('pause');show('settings')};$('pQuit').onclick=()=>{clickSfx();toBasecamp()};
 $('rAgain').onclick=()=>{clickSfx();startRun(G.park)};$('rParks').onclick=()=>{clickSfx();toBasecamp();openParks()};$('rHome').onclick=()=>{clickSfx();toBasecamp()};$('rReplay').onclick=()=>{clickSfx();startReplay()};
 document.querySelectorAll('button').forEach(b=>b.addEventListener('mouseenter',()=>{if(AU.ctx)sfx('hover')}));
 // settings
 const S=save.set,num=(id,k,f)=>{$(id).oninput=e=>{S[k]=+e.target.value;if(f)f();store()}};
 num('sMaster','master',setVol);num('sMusic','music',setVol);num('sSfx','sfx',setVol);num('sFov','fov');num('sCam','camDist');
 $('sQ').onchange=e=>{const v=e.target.value;if(v==='a')S.qa=true;else{S.qa=false;S.q=+v}perfInit(false);store();setupPost();applyQuality();$('sQinfo').textContent=perfLabel()};
 $('sUnits').onchange=e=>{S.units=e.target.value;store()};$('sAssist').onchange=e=>{S.assist=e.target.checked;store()};$('sHints').onchange=e=>{S.hints=e.target.checked;store()};$('sShake').onchange=e=>{S.shake=e.target.checked?1:0;store()};
 $('sMute').onchange=e=>{S.mute=e.target.checked?1:0;setVol();store()};$('kReset').onclick=()=>{save.keys=Object.assign({},DEFKEYS);store();renderKeys()};
 initTouch()}
function loadSettings(){const S=save.set;$('sMaster').value=S.master;$('sMusic').value=S.music;$('sSfx').value=S.sfx;$('sFov').value=S.fov;$('sCam').value=S.camDist;$('sQ').value=S.qa?'a':String(S.q);$('sQinfo').textContent=perfLabel();
 $('sUnits').value=S.units;$('sAssist').checked=S.assist;$('sHints').checked=S.hints;$('sShake').checked=!!S.shake;$('sMute').checked=!!S.mute;renderKeys()}
function renderKeys(){const L=$('keyList');L.innerHTML='';for(const[a,label]of ACTIONS){const r=document.createElement('div');r.className='krow';const s=document.createElement('span');s.textContent=label;const b=document.createElement('button');b.className='key'+(rebinding===a?' wait':'');b.textContent=rebinding===a?'Press a key':keyName(save.keys[a]);b.onclick=()=>{rebinding=a;renderKeys()};r.append(s,b);L.appendChild(r)}}
// ---- park select: one lift ticket per park ----
function openParks(){const L=$('parkList');L.innerHTML='';
 for(const p of PARKS){const rec=save.parks[p.id],t=document.createElement('article');t.className='ticket t-'+p.id;
  const kick=p.id==='pipe'?'Superpipe':p.id==='bigair'?'1 kicker':'';
  t.innerHTML=`<div class="tk-top"><span class="tk-tod"></span><span class="tk-len"></span></div><h3></h3><p class="tk-tag"></p><p class="tk-blurb"></p><dl><div><dt>Best</dt><dd class="tk-best"></dd></div><div><dt>Runs</dt><dd class="tk-runs"></dd></div></dl><div class="tk-code"></div><button class="btn go">Ride</button>`;
  t.querySelector('h3').textContent=p.name;t.querySelector('.tk-tag').textContent=p.tag;t.querySelector('.tk-blurb').textContent=p.blurb;t.querySelector('.tk-tod').textContent=TOD[p.tod].name;t.querySelector('.tk-len').textContent=(p.len/1000).toFixed(2)+' km';
  t.querySelector('.tk-best').textContent=rec?fmt(rec.best):'No runs yet';t.querySelector('.tk-runs').textContent=rec?rec.runs:'0';
  t.querySelector('.go').onclick=()=>{clickSfx();startRun(p.id)};t.onclick=e=>{if(e.target.tagName!=='BUTTON'){clickSfx();startRun(p.id)}};L.appendChild(t)}
 go('parks')}
// ---- locker ----
let lockerCat='jacket';
function openLocker(){renderLocker();go('locker');G.lockerView=1}
function renderLocker(){$('lTickets').textContent=fmt(save.tickets);document.querySelectorAll('#lTabs button').forEach(b=>{b.classList.toggle('on',b.dataset.cat===lockerCat);b.onclick=()=>{clickSfx();lockerCat=b.dataset.cat;renderLocker()}});
 const L=$('lItems');L.innerHTML='';for(const g of GEAR[lockerCat]){const own=save.own.includes(g.id),on=save.look[lockerCat]===g.id,b=document.createElement('button');b.className='item'+(on?' on':'')+(own?'':' locked');
  const sw=document.createElement('i');const c=x=>'#'+new THREE.Color(x).getHexString();sw.style.background=lockerCat==='ski'?`linear-gradient(90deg,${c(g.base)} 0 40%,${c(g.a)} 40% 70%,${c(g.b)} 70%)`:g.c2!==undefined?`linear-gradient(135deg,${c(g.c)} 0 60%,${c(g.c2)} 60%)`:c(g.c);
  const n=document.createElement('span');n.textContent=g.name;const s=document.createElement('small');s.textContent=on?'Wearing':own?'Owned':fmt(g.cost)+' tickets';b.append(sw,n,s);
  b.onclick=()=>{if(own){save.look[lockerCat]=g.id;store();refreshLook();clickSfx()}else if(save.tickets>=g.cost){save.tickets-=g.cost;save.own.push(g.id);save.look[lockerCat]=g.id;store();refreshLook();sfx('buy')}else{sfx('lost');HUD.flash&&0;b.classList.add('nope');setTimeout(()=>b.classList.remove('nope'),400)}renderLocker()};L.appendChild(b)}
 $('lPoles').checked=!!save.look.poles;$('lPoles').onchange=e=>{save.look.poles=e.target.checked?1:0;store();refreshLook()}}
// ---- records ----
function openRecords(){const L=$('recList');L.innerHTML='';const row=(a,b)=>{const d=document.createElement('div');d.className='rrow';const x=document.createElement('span'),y=document.createElement('b');x.textContent=a;y.textContent=b;d.append(x,y);L.appendChild(d)};
 for(const p of PARKS){const r=save.parks[p.id];row(p.name,r?fmt(r.best):'No runs yet')}
 row('Best trick',save.bestTrick.pts?`${save.bestTrick.name} (${fmt(save.bestTrick.pts)})`:'None yet');row('Runs',fmt(save.runs));row('Time in the air',(save.airTime/60).toFixed(1)+' min');row('Tickets',fmt(save.tickets));go('records')}
// ---- results ----
function showResults(run,newBest,earned){const P=run.parts,R=$('resRows');R.innerHTML='';$('rTitle').textContent=newBest?'New park best':'Run complete';$('rPark').textContent=PK.def.name;$('rScore').textContent=fmt(run.score);
 const rows=[['Tricks',P.tricks],['Grabs',P.grabs],['Rails',P.rails],['Butters',P.butters],['Air and landings',P.landings]];for(const[a,b]of rows){const d=document.createElement('div');d.className='rrow';const x=document.createElement('span'),y=document.createElement('b');x.textContent=a;y.textContent=fmt(b);d.append(x,y);R.appendChild(d)}
 const S=$('resStats');S.innerHTML='';const mph=save.set.units==='mph';
 for(const[a,b]of[['Best trick',run.best.pts?run.best.name:'None'],['Best line',fmt(run.bestLine)],['Clean landings',run.clean+' of '+(run.clean+run.crashes)],['Longest air',run.maxAir.toFixed(1)+' s'],['Top speed',Math.round(run.top*(mph?2.237:3.6))+(mph?' mph':' km/h')],['Tickets earned','+'+fmt(earned)]]){const d=document.createElement('div');const x=document.createElement('dt'),y=document.createElement('dd');x.textContent=a;y.textContent=b;d.append(x,y);S.appendChild(d)}
 show('results')}
function togglePause(){if(G.mode==='ride'||G.mode==='lift'){G.prevMode=G.mode;G.mode='paused';show('pause');if(AU.ctx)AU.ctx.suspend()}else if(G.mode==='paused'){G.mode=G.prevMode||'ride';hideAll();$('hud').classList.remove('hide');if(AU.ctx)AU.ctx.resume();G.last=performance.now()}}

// ================= MODEL STREAMING (sculpted in background workers) =================
const MOD={geo:{},meta:{},done:0,total:0,queue:[],busy:new Map(),workers:[],lib:null};
const MORDER=['skier','helmet','beanie'];
function geoFrom(m,skinned){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(m.nor,3));g.setAttribute('color',new THREE.BufferAttribute(m.col,3));
 if(skinned){g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(m.si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(m.sw,4))}
 g.setIndex(new THREE.BufferAttribute(m.idx,1));m.groups.forEach(([s,c,z])=>{if(c>0)g.addGroup(s,c,z)});g.computeBoundingSphere();return g}
function onModel(n,meta,m){MOD.meta[n]=meta;MOD.geo[n]=geoFrom(m,meta.nb>1);MOD.done++;const lb=$('loadBar');if(lb)lb.style.transform=`scaleX(${MOD.done/MOD.total})`;
 if(n==='skier')buildSkier();if(n==='helmet'||n==='beanie')buildHead();if(MOD.done>=MOD.total&&G.mode==='boot'){G.mode='menu';show('menu');menuView()}}
function pumpModels(){for(const w of MOD.workers){if(MOD.busy.has(w)||!MOD.queue.length)continue;const n=MOD.queue.shift();MOD.busy.set(w,n);w.postMessage({n,h:1})}}
function mainThreadModels(){if(!MOD.lib)MOD.lib=MODLIB();const step=()=>{if(!MOD.queue.length)return;const n=MOD.queue.shift();try{const spec=MOD.lib.MODELS.list[n]();const m=MOD.lib.SDF.build(spec);onModel(n,{bones:spec.bones||null,nb:spec.nb,J:spec.J||null},m)}catch(e){console.error(e)}setTimeout(step,0)};step()}
function startModels(){MOD.queue=MORDER.slice();MOD.total=MOD.queue.length;
 const src='const L=('+MODLIB.toString()+')();onmessage=e=>{const n=e.data.n;const spec=L.MODELS.list[n]();spec.h*=e.data.h||1;const m=L.SDF.build(spec);const meta={bones:spec.bones||null,nb:spec.nb,J:spec.J||null};postMessage({n:n,meta:meta,m:m},[m.pos.buffer,m.nor.buffer,m.col.buffer,m.si.buffer,m.sw.buffer,m.idx.buffer])};';
 try{const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'})),nw=clamp((navigator.hardwareConcurrency||4)-1,1,3);
  for(let i=0;i<nw;i++){const w=new Worker(url);w.onmessage=e=>{MOD.busy.delete(w);onModel(e.data.n,e.data.meta,e.data.m);pumpModels()};
   w.onerror=ev=>{ev.preventDefault&&ev.preventDefault();const n=MOD.busy.get(w);MOD.busy.delete(w);MOD.workers=MOD.workers.filter(x=>x!==w);if(n)MOD.queue.unshift(n);try{w.terminate()}catch(e){}if(!MOD.workers.length&&!MOD.fallback){MOD.fallback=1;mainThreadModels()}else pumpModels()};MOD.workers.push(w)}
  pumpModels()}catch(e){MOD.fallback=1;mainThreadModels()}}
// ================= GAME STATE =================
const G={mode:'boot',park:null,t:0,last:0,acc:0,finishT:0,restartT:0,prevMode:null,lockerView:0,liftT:0,slow:1};
function applyQuality(){scene.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true)});updateTreeLOD(-PH.pos.z)}
function loadPark(id){if(G.park===id&&WORLD.root)return;G.park=id;buildWorld(id);TRACKS.forEach(t=>t.reset());SPRAY.clear();FL.amount=T.snow;$('hParkName').textContent=PK.def.name}
function startRun(id){loadPark(id);save.lastPark=id;store();hideAll();TK.run=newRun();TK.line=null;TK.recent=[];railPend=null;TRACKS.forEach(t=>t.reset());SPRAY.clear();
 phReset(PK.start.s,0,0);G.finishT=0;G.restartT=0;G.mode='lift';G.liftT=0;G.slow=1;REPLAY.frames=[];REPLAY.rec=0;CAMV.snap=true;
 $('hud').classList.remove('hide');$('hLift').className='show';HUD.hint(isTouch?'Tap anywhere to drop in':'Press F or Space to drop in',6);Music.set(.35);audioInit()}
function skipLift(){if(G.mode!=='lift')return;G.mode='ride';$('hLift').className='';sfx('start');Music.set(.8);
 // a shove off the start deck
 PH.vel.copy(PH.dir).multiplyScalar(4.5);if(!save.seenHelp){save.seenHelp=1;store();HUD.hint('Hold Space to load a pop and release at the lip. A and D spin, W and S flip, Shift, Q and E grab.',8)}}
function toBasecamp(){G.mode='menu';TK.run=null;TK.line=null;if(AU.ctx&&AU.ctx.state==='suspended')AU.ctx.resume();SCREEN.stack=[];show('menu');menuView()}
function menuView(){phReset(PK.start.s,0,0);CAMV.snap=true}
function finishRun(){const run=TK.run;if(!run||G.finishT)return;lineBank('finish');G.finishT=.001;run.top=PH.top;
 const id=PK.def.id,rec=save.parks[id]||{best:0,runs:0,trick:'',trickPts:0},newBest=run.score>rec.best&&run.score>0;rec.runs++;if(newBest)rec.best=Math.round(run.score);if(run.best.pts>rec.trickPts){rec.trickPts=run.best.pts;rec.trick=run.best.name}save.parks[id]=rec;
 if(run.best.pts>save.bestTrick.pts)save.bestTrick={pts:run.best.pts,name:run.best.name};const earned=Math.round(run.score/250+15+run.clean*3);save.tickets+=earned;save.runs++;save.airTime+=run.air;store();
 sfx('horn');sfx('cheer',1);WORLD.cheer=3;G.res={run,newBest,earned}}
// ================= CAMERA =================
const CAMV={pos:new THREE.Vector3(),look:new THREE.Vector3(),yaw:0,snap:true,mode:0,orbit:0,orbitP:0,drag:false,fov:74,shake:0};
addEventListener('contextmenu',e=>{if(G.mode==='ride')e.preventDefault()});
addEventListener('mousedown',e=>{if(e.button===2)CAMV.drag=true});addEventListener('mouseup',e=>{if(e.button===2)CAMV.drag=false});
addEventListener('mousemove',e=>{if(CAMV.drag){CAMV.orbit=clamp(CAMV.orbit-e.movementX*.006,-PI,PI);CAMV.orbitP=clamp(CAMV.orbitP+e.movementY*.004,-.4,.9)}});
const _cv=new THREE.Vector3(),_ct=new THREE.Vector3(),_cd=new THREE.Vector3();
function camChase(dt){const p=PH.crash?PH.com:PH.pos,v=PH.vel,sp=Math.hypot(v.x,v.z);let hd=sp>1.5?Math.atan2(v.x,v.z):headingOf(PH.dir)+(PH.sw?PI:0);
 if(CAMV.snap)CAMV.yaw=hd;else CAMV.yaw+=wrapA(hd-CAMV.yaw)*(1-Math.exp(-(PH.ground?4.5:2.2)*dt));
 if(!CAMV.drag){CAMV.orbit=damp(CAMV.orbit,0,2.5,dt);CAMV.orbitP=damp(CAMV.orbitP,0,2.5,dt)}
 const far=CAMV.mode===1,air=!PH.ground&&!PH.rail?1:0,d=(far?6.8:3.5+Math.min(sp,30)*.035+air*1.4)*save.set.camDist,hgt=(far?2.6:1.35+air*.6)*save.set.camH+CAMV.orbitP*d*.6,yaw=CAMV.yaw+CAMV.orbit;
 _cv.set(p.x-Math.sin(yaw)*d,0,p.z-Math.cos(yaw)*d);const g=H(_cv.x,_cv.z);_cv.y=Math.max(p.y+hgt,g+.7);
 _ct.set(p.x+Math.sin(yaw)*2.2,p.y+(PH.ground?.9:.6),p.z+Math.cos(yaw)*2.2);
 if(CAMV.snap){CAMV.pos.copy(_cv);CAMV.look.copy(_ct);CAMV.snap=false}else{const k=1-Math.exp(-(air?5:9)*dt);CAMV.pos.lerp(_cv,k);CAMV.look.lerp(_ct,1-Math.exp(-14*dt))}
 CAMV.pos.y=Math.max(CAMV.pos.y,H(CAMV.pos.x,CAMV.pos.z)+.5);
 CAMV.fov=damp(CAMV.fov,save.set.fov+Math.min(sp,40)*.35,3,dt)}
function camApply(){cam.position.copy(CAMV.pos);if(CAMV.shake>0&&save.set.shake){cam.position.x+=(R()-.5)*CAMV.shake*.12;cam.position.y+=(R()-.5)*CAMV.shake*.12}cam.lookAt(CAMV.look);if(Math.abs(cam.fov-CAMV.fov)>.05){cam.fov=CAMV.fov;cam.updateProjectionMatrix()}}
function camMenu(t,dt){const p=PH.pos,locker=SCREEN.cur==='locker',a=locker?t*.25+PI*.9:t*.07+.6,d=locker?3.2:7.5,hh=locker?1.1:2.6;
 _cv.set(p.x+Math.sin(a)*d,p.y+hh,p.z+Math.cos(a)*d);_cv.y=Math.max(_cv.y,H(_cv.x,_cv.z)+.6);_ct.set(p.x+(locker?.5:0),p.y+(locker?.95:1.3),p.z);
 if(CAMV.snap){CAMV.pos.copy(_cv);CAMV.look.copy(_ct);CAMV.snap=false}else{CAMV.pos.lerp(_cv,1-Math.exp(-3*dt));CAMV.look.lerp(_ct,1-Math.exp(-3*dt))}CAMV.fov=damp(CAMV.fov,locker?40:55,3,dt)}
// ================= REPLAY =================
const REPLAY={frames:[],rec:0,t:0,speed:1,paused:false,cam:0,end:0,camI:-1};
function recordFrame(){const P=POSE;REPLAY.frames.push([PH.pos.x,PH.pos.y,PH.pos.z,PH.q.x,PH.q.y,PH.q.z,PH.q.w,P.crouch,P.tuck,P.edge,P.grab,P.grabType,P.air,P.rail,P.butter,P.flail,P.load,P.absorb,PH.vel.x,PH.vel.z,PH.speed,P.twist]);if(REPLAY.frames.length>30*240)REPLAY.frames.shift()}
function startReplay(){if(REPLAY.frames.length<10)return;G.mode='replay';REPLAY.t=0;REPLAY.paused=false;REPLAY.speed=1;REPLAY.cam=0;REPLAY.end=REPLAY.frames.length/30;hideAll();$('replayBar').classList.remove('hide');CAMV.snap=true;Music.set(.5)}
function endReplay(){G.mode='results';$('replayBar').classList.add('hide');show('results')}
const _rq=new THREE.Quaternion(),_rq2=new THREE.Quaternion();
function replayStep(dt,t){if(!REPLAY.paused)REPLAY.t+=dt*REPLAY.speed;if(REPLAY.t>=REPLAY.end){REPLAY.t=REPLAY.end;REPLAY.paused=true}const F=REPLAY.frames,x=clamp(REPLAY.t*30,0,F.length-1.001),i=x|0,k=x-i,a=F[i],b=F[i+1]||a;
 PH.pos.set(lerp(a[0],b[0],k),lerp(a[1],b[1],k),lerp(a[2],b[2],k));_rq.set(a[3],a[4],a[5],a[6]);_rq2.set(b[3],b[4],b[5],b[6]);PH.q.copy(_rq).slerp(_rq2,k);
 const keys=['crouch','tuck','edge','grab','grabType','air','rail','butter','flail','load','absorb'];keys.forEach((n,j)=>POSE[n]=j===4?a[7+j]:lerp(a[7+j],b[7+j],k));POSE.twist=a[21];PH.vel.set(lerp(a[18],b[18],k),0,lerp(a[19],b[19],k));PH.speed=a[20];
 RD.root.position.copy(PH.pos);RD.root.quaternion.copy(PH.q);poseSkier(dt,t);
 $('rbTime').textContent=REPLAY.t.toFixed(1)+' / '+REPLAY.end.toFixed(1)+' s';$('rbCam').textContent=['Chase','Drone','TV'][REPLAY.cam];$('rbFill').style.transform=`scaleX(${REPLAY.t/REPLAY.end})`;
 const p=PH.pos;if(REPLAY.cam===0){PH.ground=true;PH.rail=null;PH.crash=null;camChase(dt)}
 else if(REPLAY.cam===1){const a=t*.35;_cv.set(p.x+Math.sin(a)*9,p.y+5,p.z+Math.cos(a)*9);_ct.set(p.x,p.y+.9,p.z);CAMV.pos.lerp(_cv,1-Math.exp(-4*dt));CAMV.look.lerp(_ct,1-Math.exp(-8*dt));CAMV.fov=damp(CAMV.fov,55,3,dt)}
 else{let best=null,bd=1e9;for(const c of PK.cams){const d=Math.hypot(c.x-p.x,c.z-p.z);if(d<bd){bd=d;best=c}}if(!best||bd>70){_cv.set(p.x+8,p.y+3,p.z+6)}else _cv.set(best.x,best.y,best.z);CAMV.pos.copy(_cv);_ct.set(p.x,p.y+.9,p.z);CAMV.look.lerp(_ct,1-Math.exp(-12*dt));CAMV.fov=damp(CAMV.fov,clamp(30+bd*.6,22,60),4,dt)}}
// ================= RIDER VISUAL =================
const DBG={pose:null};
const _rv=new THREE.Vector3(),_rqe=new THREE.Quaternion();
function updateRiderVisual(dt,t){const P=POSE,air=!PH.ground&&!PH.rail&&!PH.crash;
 RD.root.position.copy(PH.pos);RD.root.quaternion.copy(PH.q);
 if(PH.ground&&!PH.crash){_rqe.setFromAxisAngle(_rv.set(0,0,1),-PH.edge*.42*(PH.sw?-1:1));RD.root.quaternion.multiply(_rqe)}
 P.crouch=damp(P.crouch,PH.ground?.14+PH.speed*.004+PH.skid*.15+PH.sketch*.3:.2,6,dt);P.tuck=damp(P.tuck,PH.tuck*(PH.ground?1:0),6,dt);P.edge=damp(P.edge,PH.ground?PH.edge:0,8,dt);
 P.load=damp(P.load,PH.load,12,dt);P.wind=damp(P.wind,-PH.wind*.8,8,dt);P.air=damp(P.air,air?1:0,6,dt);P.rail=damp(P.rail,PH.rail?1:0,10,dt);P.butter=damp(P.butter,PH.butter?(PH.butter.tail?-1:1):0,10,dt);
 PH.impact=Math.max(0,PH.impact-dt*2.2);P.absorb=PH.impact;PH.sketch=Math.max(0,PH.sketch-dt*1.2);P.flail=damp(P.flail,PH.crash?1:PH.sketch*.7,6,dt);
 if(air&&PH.grab){P.grabType=PH.grab;P.grab=damp(P.grab,1,14,dt)}else P.grab=damp(P.grab,0,10,dt);
 P.idle=PH.speed<.5?1:0;let tw=0;if(PH.ground&&PH.speed>2){const vd=_rv.copy(PH.vel).normalize(),a=Math.atan2(vd.x,vd.z),b=headingOf(PH.dir)+(PH.sw?PI:0);tw=clamp(wrapA(a-b),-1.2,1.2)}P.twist=damp(P.twist,tw*.6,8,dt);
 if(DBG.pose)Object.assign(P,DBG.pose);
 poseSkier(dt,t);
 if(PH.crash){const k=.6;RD.root.position.y+=0}}
// ================= SOUND MIX =================
function updateAudio(dt){if(!AU.ctx)return;const sp=PH.speed,g=PH.ground&&!PH.crash&&!PH.rail,riding=G.mode==='ride'||G.mode==='lift';
 loopSet('wind',riding?Math.min(.5,sp*sp*.0006+(!g?.06:0)):0,300+sp*18);
 loopSet('carve',riding&&g?Math.min(.32,sp*.012*(.4+Math.abs(PH.edge))):0,1800+sp*40+Math.abs(PH.edge)*900);
 loopSet('skid',riding&&g?Math.min(.5,(PH.skid*1.2+PH.brake)*sp*.03):0,700+PH.skid*600);
 const r=PH.rail;loopSet('grind',riding&&r&&r.r.kind!=='box'?.12+Math.min(.18,r.v*.012):0,1800+(r?r.v*60:0));loopSet('box',riding&&r&&r.r.kind==='box'?.3:0);
 const fd=Math.abs(-PH.pos.z-PK.finishS);loopSet('crowd',(riding||G.mode==='results')?clamp(1-fd/160,0,1)*.12+(WORLD.cheer||0)*.08:0)}
// ================= MAIN LOOP =================
let simT=0;const EV={};
function clearEv(){for(const k in EV)delete EV[k]}
function handleEvents(){const ev=EV;
 if(ev.pop)sfx('pop',ev.pop);if(ev.land){const L=ev.land;if(L.quality!=='crash'){sfx('land',.35+L.vn/12);fxLand(clamp(L.vn/10,0,1));CAMV.shake=Math.max(CAMV.shake,clamp(L.vn/14,0,.8))}}
 if(ev.crash){sfx('crash');CAMV.shake=1;fxLand(1)}if(ev.railOn)sfx('railOn',ev.railOn.r.kind==='box');if(ev.swap)sfx('swap');if(ev.grab)sfx('grab');if(ev.thud&&ev.thud>4)sfx('land',ev.thud/14);
 trickEvents(ev)}
function loop(now){requestAnimationFrame(loop);const raw=(now-G.last)/1000||.016;G.last=now;const dt=Math.min(.05,raw);if(G.mode!=='paused')perfTick(raw);G.t+=dt;const t=G.t;
 readInput();
 if(G.mode==='ride'){
  // hold restart
  if(act('restart')||KEYS.__restart){G.restartT+=dt;$('hRestart').style.transform=`scaleX(${G.restartT/1})`;if(G.restartT>1){startRun(G.park);return}}else{G.restartT=0;$('hRestart').style.transform='scaleX(0)'}
  const sd=dt*G.slow;G.acc+=sd;let first=true;let steps=0;
  while(G.acc>=DT&&steps<12){G.acc-=DT;steps++;clearEv();const I=INP;if(!first){I.popRel=false;I.steerTap=0}first=false;physicsStep(I,EV);handleEvents();
   // fences keep you in the park
   const s=-PH.pos.z,u=PH.pos.x-cxS(s),W=halfW(s)+1.2;if(Math.abs(u)>W&&!PH.crash&&s>-30&&s<PK.finishS+20){const sg=Math.sign(u);PH.pos.x=cxS(s)+sg*W;if(PH.ground){const vx=PH.vel.x;if(vx*sg>0){PH.vel.x=-vx*.3;PH.vel.multiplyScalar(.85);sfx('land',.3)}}else PH.com.x=PH.pos.x}
  }
  REPLAY.rec+=sd;while(REPLAY.rec>=1/30){REPLAY.rec-=1/30;recordFrame()}
  lineTick(sd);TK.run.t+=sd;TK.run.top=Math.max(TK.run.top,PH.speed);
  if(-PH.pos.z>PK.finishS&&!G.finishT)finishRun();
  if(G.finishT){G.finishT+=dt;G.slow=damp(G.slow,.35,3,dt);if(G.finishT>2.4){G.mode='results';G.slow=1;showResults(G.res.run,G.res.newBest,G.res.earned);$('hud').classList.add('hide')}}
  updateRiderVisual(dt,t);camChase(dt);updateTracks();fxGround(dt);HUD.update(dt);
 }else if(G.mode==='lift'){G.liftT+=dt;updateRiderVisual(dt,t);camMenu(t,dt);HUD.update(dt);if(TOUCH.pop||TOUCH.steer)skipLift();if(G.liftT>8)skipLift()}
 else if(G.mode==='replay'){replayStep(dt,t)}
 else if(G.mode==='menu'||G.mode==='boot'||G.mode==='results'){if(G.mode!=='results'){PH.vel.set(0,0,0);updateRiderVisual(dt,t);camMenu(t,dt)}}
 CAMV.shake=Math.max(0,CAMV.shake-dt*2.5);WORLD.cheer=Math.max(0,(WORLD.cheer||0)-dt*.6);
 if(G.mode!=='paused'){camApply();SPRAY&&SPRAY.update(dt);updateFlakes(t,_cd.set(.6,0,-.4));updateChairs(t);updateCrowd(t);updateAudio(dt)}
 // lights and shadows follow the action
 const cs=-PH.pos.z;if(((t*4)|0)!==G.lodT){G.lodT=(t*4)|0;updateTreeLOD(cs)}
 sun.position.copy(PH.pos).addScaledVector(sunVec,120);sun.target.position.copy(PH.pos);sun.target.updateMatrixWorld();
 if(farMts)farMts.position.copy(cam.position);skyU.camPos.value.copy(cam.position);skyU.time.value=t;
 cam.updateMatrixWorld();updateLamps(cam.position.x,cam.position.z);
 MAT.snow&&MAT.snow.userData.u.sunView.value.copy(sunVec).transformDirection(cam.matrixWorldInverse);
 if(G.mode!=='paused')renderFrame()}
// ================= BOOT =================
function init(){makeTextures();perfInit(true);PERF.hook=qc=>{if(qc)applyQuality();const e=$('sQinfo');if(e)e.textContent=perfLabel()};setupPost();HUD.init();bindUI();initFX();buildSkis();
 const first=save.lastPark&&PARKS.some(p=>p.id===save.lastPark)?save.lastPark:'night';loadPark(first);phReset(PK.start.s,0,0);show('loading');startModels();
 addEventListener('resize',()=>setupPost());document.addEventListener('visibilitychange',()=>{if(document.hidden&&G.mode==='ride')togglePause()});
 G.last=performance.now();requestAnimationFrame(loop);
 window.__DT={applyQuality,sun,sunVec,farMts:()=>farMts,skyU,updateLamps,DBG,SCREEN,lipSpeed,kickAhead,phReset,handleEvents,clearEv,lineTick,HUD,finishRun,PARKS,KICK,featH,FH,G,PH,PK,TK,POSE,RD,INP,KEYS,save,startRun,skipLift,physicsStep,H,Hn,cam,ren,scene,renderFrame,setupPost,PERF,perfSet,perfInit,EV,WORLD,CAMV,REPLAY,startReplay,TOUCH,railNear,MOD}}
const fontsReady=document.fonts&&document.fonts.load?Promise.race([document.fonts.load('800 40px Archivo'),new Promise(r=>setTimeout(r,1800))]):Promise.resolve();
fontsReady.then(init,init);
})();

