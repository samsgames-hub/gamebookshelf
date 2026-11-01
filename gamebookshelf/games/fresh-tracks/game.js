/* FRESH TRACKS — downhill snowboarding on an endless procedural mountain. Three.js r128, every asset generated at load. */
(()=>{'use strict';
const $=id=>document.getElementById(id),R=Math.random,rr=(a,b)=>a+R()*(b-a),ri=n=>R()*n|0,pick=a=>a[R()*a.length|0],clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
const TAU=Math.PI*2,PI=Math.PI,sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const wrapA=a=>{a=(a+PI)%TAU;if(a<0)a+=TAU;return a-PI};
// ---------------- deterministic noise ----------------
const hash2=(x,y,s)=>{let h=(Math.imul(x,374761393)+Math.imul(y,668265263)+Math.imul(s,982451653))|0;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296};
function vn2(x,y,s){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi,u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf),a=hash2(xi,yi,s),b=hash2(xi+1,yi,s),c=hash2(xi,yi+1,s),d=hash2(xi+1,yi+1,s);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
// ---------------- SAVE ----------------
const BOARDS=[
 {id:'rental',name:'Rental',desc:'Forgiving and steady. A fine place to start.',cost:0,top:1,grip:1,spin:1,pop:1,col:0x3a6ea5,acc:0xf2f2f2},
 {id:'carver',name:'Carver',desc:'Long and stiff. Higher top speed and sharp turns.',cost:2500,top:1.1,grip:1.25,spin:.92,pop:.95,col:0xc23b22,acc:0x111111},
 {id:'park',name:'Park Twin',desc:'Short and playful. Faster spins and softer landings.',cost:4000,top:.97,grip:.95,spin:1.3,pop:1.12,col:0x7b3fd0,acc:0xffd23a},
 {id:'powder',name:'Powder Fish',desc:'Floats through rough snow and lands big airs.',cost:6500,top:1.04,grip:1.05,spin:1.08,pop:1.25,col:0x0f8f74,acc:0xe8f6ff},
 {id:'pro',name:'Pro Model',desc:'Fast, grippy and quick in the air. Earned, not given.',cost:12000,top:1.16,grip:1.2,spin:1.28,pop:1.2,col:0x151515,acc:0xff6a00}];
const OUTFITS=[
 {id:'classic',name:'Glacier',jacket:0x1f6fd1,pants:0x22262e,helmet:0xf2f2f2,cost:0},
 {id:'ember',name:'Ember',jacket:0xe0502a,pants:0x2b2f38,helmet:0x1b1b1b,cost:0},
 {id:'lime',name:'Highlighter',jacket:0xb6e02a,pants:0x1d2430,helmet:0x2a2a2a,cost:1500},
 {id:'rose',name:'Alpenglow',jacket:0xf06a9a,pants:0xf2f2f2,helmet:0xffffff,cost:3000},
 {id:'stealth',name:'Night Shift',jacket:0x16181d,pants:0x0e0f12,helmet:0x111111,cost:5000},
 {id:'gold',name:'Champion',jacket:0xf0b429,pants:0x222222,helmet:0xf0b429,cost:15000}];
const DEF={credits:0,best:0,bestDist:0,bestTrick:0,bestTrickName:'',runs:0,totalDist:0,board:'rental',outfit:'classic',own:['rental','classic','ember'],
 set:{master:8,music:5,sfx:8,q:2,shake:1,mute:0,tod:'random',units:'kmh',invert:0}};
let save=JSON.parse(JSON.stringify(DEF));
try{const s=JSON.parse(localStorage.getItem('freshtracks1')||'{}');if(s&&typeof s==='object'){
 for(const k of['credits','best','bestDist','bestTrick','runs','totalDist'])if(Number.isFinite(s[k]))save[k]=Math.max(0,+s[k]);
 if(typeof s.bestTrickName==='string')save.bestTrickName=s.bestTrickName.slice(0,60);
 if(Array.isArray(s.own))save.own=[...new Set(DEF.own.concat(s.own.filter(x=>typeof x==='string')))];
 if(BOARDS.some(b=>b.id===s.board)&&save.own.includes(s.board))save.board=s.board;
 if(OUTFITS.some(b=>b.id===s.outfit)&&save.own.includes(s.outfit))save.outfit=s.outfit;
 if(s.set&&typeof s.set==='object')for(const k in DEF.set)if(k in s.set&&typeof s.set[k]===typeof DEF.set[k])save.set[k]=s.set[k]}}catch(e){}
try{if(!localStorage.getItem('freshtracks1')&&matchMedia('(hover: none) and (pointer: coarse)').matches)save.set.q=0}catch(e){}
save.set.q=clamp(save.set.q|0,0,2);
const store=()=>{try{localStorage.setItem('freshtracks1',JSON.stringify(save))}catch(e){}};
const boardDef=()=>BOARDS.find(b=>b.id===save.board)||BOARDS[0],outfitDef=()=>OUTFITS.find(b=>b.id===save.outfit)||OUTFITS[0];
// ---------------- AUDIO ----------------
const AU={ctx:null,loops:{}};
function audioInit(){if(AU.ctx){if(AU.ctx.state==='suspended')AU.ctx.resume();return}try{const C=new(window.AudioContext||window.webkitAudioContext)();AU.ctx=C;
 const comp=C.createDynamicsCompressor();comp.threshold.value=-16;comp.ratio.value=3.5;comp.connect(C.destination);
 AU.master=C.createGain();AU.master.connect(comp);AU.sfx=C.createGain();AU.sfx.connect(AU.master);AU.mus=C.createGain();AU.mus.connect(AU.master);
 const len=C.sampleRate*3|0,ir=C.createBuffer(2,len,C.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(R()*2-1)*Math.pow(1-i/len,3.5)}
 AU.verb=C.createConvolver();AU.verb.buffer=ir;AU.send=C.createGain();AU.send.gain.value=.3;AU.send.connect(AU.verb);AU.verb.connect(AU.master);
 const nb=C.createBuffer(1,C.sampleRate*3,C.sampleRate),nd=nb.getChannelData(0);let b0=0,b1=0,b2=0;
 for(let i=0;i<nd.length;i++){const w=R()*2-1;nd[i]=w}AU.noise=nb;
 const pb=C.createBuffer(1,C.sampleRate*4,C.sampleRate),pd=pb.getChannelData(0);for(let i=0;i<pd.length;i++){const w=R()*2-1;b0=.99765*b0+w*.099;b1=.963*b1+w*.2965;b2=.57*b2+w*1.0526;pd[i]=(b0+b1+b2+w*.1848)*.18}AU.pink=pb;
 const bb=C.createBuffer(1,C.sampleRate*4,C.sampleRate),bd=bb.getChannelData(0);let l=0;for(let i=0;i<bd.length;i++){l=(l+.02*(R()*2-1))/1.02;bd[i]=l*3.2}AU.brown=bb;
 // continuous loops: wind, carve, slide hiss, avalanche rumble
 const loop=(buf,type,f,q,dest)=>{const s=C.createBufferSource();s.buffer=buf;s.loop=true;const fl=C.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;const g=C.createGain();g.gain.value=0;s.connect(fl);fl.connect(g);g.connect(dest||AU.sfx);s.start(0,R()*2);return{s,f:fl,g}};
 AU.loops.wind=loop(AU.pink,'bandpass',400,.7);AU.loops.carve=loop(AU.noise,'bandpass',3200,1.4);AU.loops.hiss=loop(AU.pink,'lowpass',900,.5);AU.loops.rumble=loop(AU.brown,'lowpass',140,.8);
 const sub=C.createOscillator();sub.type='sine';sub.frequency.value=34;const sg=C.createGain();sg.gain.value=0;sub.connect(sg);sg.connect(AU.sfx);sub.start();AU.loops.sub={g:sg};
 setVol();Music.start()}catch(e){AU.ctx=null}}
function setVol(){if(!AU.ctx)return;const s=save.set,t=AU.ctx.currentTime;AU.master.gain.setTargetAtTime(s.mute?0:s.master/10,t,.05);AU.sfx.gain.setTargetAtTime(s.sfx/10,t,.05);AU.mus.gain.setTargetAtTime(s.music/10*.5,t,.05)}
function loopSet(n,gain,freq,k){const L=AU.loops[n];if(!L||!AU.ctx)return;const t=AU.ctx.currentTime;L.g.gain.setTargetAtTime(gain,t,k||.08);if(freq&&L.f)L.f.frequency.setTargetAtTime(freq,t,k||.08)}
function out(g,v){g.connect(AU.sfx);if(v){const s=AU.ctx.createGain();s.gain.value=v;g.connect(s);s.connect(AU.send)}}
function tone(f,d,type,vol,f2,o={}){const C=AU.ctx;if(!C)return;const t=C.currentTime+(o.at||0),os=C.createOscillator(),g=C.createGain();os.type=type||'sine';os.frequency.setValueAtTime(f,t);if(f2)os.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+d);
 if(o.det)os.detune.value=o.det;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(o.a||.004));g.gain.exponentialRampToValueAtTime(.0001,t+d);os.connect(g);out(g,o.wet??.3);os.start(t);os.stop(t+d+.05)}
function noise(d,vol,ft,f0,f1,q,o={}){const C=AU.ctx;if(!C)return;const t=C.currentTime+(o.at||0),s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain();s.buffer=o.buf||AU.noise;s.playbackRate.value=o.rate||1;
 f.type=ft;f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+d);f.Q.value=q||1;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(o.a||.003));g.gain.exponentialRampToValueAtTime(.0001,t+d);
 s.connect(f);f.connect(g);out(g,o.wet??.3);s.start(t,R()*1.5);s.stop(t+d+.05)}
const PENTA=[0,2,4,7,9,12,14,16,19,21];const nf=n=>440*Math.pow(2,(n-9)/12);
const SFX={
 jump(p){noise(.28,.35*(p||1),'bandpass',1200,3600,1.2,{wet:.1});noise(.12,.25,'lowpass',500,200,.8,{wet:0})},
 land(k){k=clamp(k||.5,.15,1.5);tone(70,.25,'sine',.6*k,38,{wet:.05});noise(.35*k+.1,.55*k,'lowpass',1800,300,.7,{wet:.12,buf:AU.pink})},
 crash(){tone(60,.5,'sine',.9,28,{wet:.1});noise(.9,.9,'lowpass',2400,180,.6,{wet:.25,buf:AU.pink});noise(.5,.4,'highpass',3000,800,.7,{at:.1,wet:.1})},
 trick(n){n=clamp(n|0,1,6);for(let i=0;i<Math.min(4,n+1);i++)tone(nf(PENTA[i*2]+60),.5,'triangle',.12,0,{at:i*.07,wet:.45})},
 combo(m){tone(nf(64+Math.min(m,10)),.22,'sine',.14,0,{wet:.4});tone(nf(71+Math.min(m,10)),.3,'sine',.1,0,{at:.06,wet:.4})},
 near(){noise(.3,.32,'bandpass',900,4200,3,{wet:.05})},
 gate(){tone(nf(76),.7,'sine',.16,0,{wet:.6});tone(nf(83),.8,'sine',.12,0,{at:.08,wet:.6});tone(nf(88),.9,'sine',.08,0,{at:.16,wet:.6})},
 boost(){noise(.6,.4,'bandpass',600,2400,1.5,{wet:.2});tone(180,.5,'sawtooth',.06,520,{wet:.2})},
 click(){tone(900,.05,'triangle',.08,0,{wet:0})},
 buy(){tone(nf(72),.2,'triangle',.12,0,{wet:.3});tone(nf(79),.3,'triangle',.12,0,{at:.08,wet:.3});tone(nf(84),.45,'triangle',.12,0,{at:.16,wet:.4})},
 warn(){tone(140,.5,'sawtooth',.08,90,{wet:.3})},
 whoosh(){noise(.5,.35,'bandpass',500,2000,1,{wet:.2,buf:AU.pink})},
 start(){tone(nf(60),.3,'triangle',.12,0,{wet:.4});tone(nf(67),.3,'triangle',.12,0,{at:.12,wet:.4});tone(nf(72),.6,'triangle',.14,0,{at:.24,wet:.5})}};
const sfx=(n,...a)=>{if(AU.ctx&&SFX[n])try{SFX[n](...a)}catch(e){}};
// ---------------- MUSIC: a slow, warm generative loop ----------------
const Music=(()=>{let on=false,next=0,step=0,timer=0,bar=0,intensity=0;
 const BPM=92,SP=60/BPM/4;
 const CH=[[57,60,64,67,71],[53,57,60,64,69],[48,52,55,59,64],[55,59,62,66,71]];// Am9 Fmaj9 Cmaj7 G(add)
 function pad(notes,t,d){const C=AU.ctx;notes.slice(0,4).forEach((n,i)=>{for(const det of[-7,7]){const o=C.createOscillator(),g=C.createGain(),f=C.createBiquadFilter();o.type='sawtooth';o.frequency.value=nf(n-12);o.detune.value=det;f.type='lowpass';f.frequency.setValueAtTime(500,t);f.frequency.linearRampToValueAtTime(900+intensity*500,t+d*.5);f.frequency.linearRampToValueAtTime(500,t+d);f.Q.value=.6;
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.022,t+d*.3);g.gain.linearRampToValueAtTime(.0001,t+d);o.connect(f);f.connect(g);g.connect(AU.mus);const s=C.createGain();s.gain.value=.5;g.connect(s);s.connect(AU.send);o.start(t);o.stop(t+d+.1)}})}
 function pluck(n,t,v){const C=AU.ctx,o=C.createOscillator(),g=C.createGain();o.type='triangle';o.frequency.value=nf(n);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+.5);o.connect(g);g.connect(AU.mus);const s=C.createGain();s.gain.value=.6;g.connect(s);s.connect(AU.send);o.start(t);o.stop(t+.6)}
 function kick(t){const C=AU.ctx,o=C.createOscillator(),g=C.createGain();o.frequency.setValueAtTime(120,t);o.frequency.exponentialRampToValueAtTime(40,t+.18);g.gain.setValueAtTime(.32,t);g.gain.exponentialRampToValueAtTime(.0001,t+.3);o.connect(g);g.connect(AU.mus);o.start(t);o.stop(t+.35)}
 function hat(t,v){const C=AU.ctx,s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain();s.buffer=AU.noise;f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.06);s.connect(f);f.connect(g);g.connect(AU.mus);s.start(t,R());s.stop(t+.08)}
 function sched(){const C=AU.ctx;if(!C||!on)return;while(next<C.currentTime+.25){const t=next,i=step%16,ch=CH[bar%4];
  if(i===0)pad(ch,t,SP*16);
  if(intensity>.15){if(i%4===0)kick(t);if(i%4===2)hat(t,.05);if(i%2===1&&intensity>.5)hat(t,.025)}
  const arp=[0,2,4,3,1,2,4,3];if(i%2===0&&(intensity>.05||i%4===0))pluck(ch[arp[(i/2)%8]]+12,t,.035+intensity*.03);
  next+=SP;step++;if(step%16===0)bar++}
 }
 return{start(){if(on||!AU.ctx)return;on=true;next=AU.ctx.currentTime+.1;timer=setInterval(sched,60)},set(v){intensity=v}}})();

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
// Snowboarder in riding stance. Board runs along +X (nose), rider faces +Z (toe edge). Regular stance: left foot forward.
// bones: 0 hips 1 spine 2 chest 3 neck 4 head | R arm 5 6 7 | L arm 8 9 10 | R leg 11 12 13 | L leg 14 15 16
const J={hips:[0,.9,-.03],spine:[0,1.06,-.01],chest:[0,1.26,.02],neck:[0,1.44,.03],head:[0,1.56,.04],
 shR:[-.19,1.37,.01],elR:[-.25,1.1,-.01],wrR:[-.29,.87,.0],shL:[.19,1.37,.01],elL:[.27,1.11,.07],wrL:[.35,.91,.15],
 hpR:[-.1,.88,-.03],knR:[-.24,.5,.13],anR:[-.27,.1,-.01],toR:[-.25,.04,.13],hpL:[.1,.88,-.03],knL:[.24,.5,.13],anL:[.27,.1,-.01],toL:[.31,.04,.12]};
const bones=[{p:J.hips,parent:-1},{p:J.spine,parent:0},{p:J.chest,parent:1},{p:J.neck,parent:2},{p:J.head,parent:3},
 {p:J.shR,parent:2},{p:J.elR,parent:5},{p:J.wrR,parent:6},{p:J.shL,parent:2},{p:J.elL,parent:8},{p:J.wrL,parent:9},
 {p:J.hpR,parent:0},{p:J.knR,parent:11},{p:J.anR,parent:12},{p:J.hpL,parent:0},{p:J.knL,parent:14},{p:J.anL,parent:15}];
function rider(){const P=[],JK=0,HL=1,GG=2,PT=3,DK=4;
 // torso: insulated jacket, slightly bulky
 P.push(E(J.hips,[.165,.12,.13],{b:0,z:PT,k:.06}));
 P.push(E(add(J.spine,[0,.01,0]),[.175,.15,.135],{b:1,z:JK,k:.07}));
 P.push(E(add(J.chest,[0,.02,.01]),[.215,.17,.145],{b:2,z:JK,k:.07}));
 P.push(E(add(J.hips,[0,.1,0]),[.19,.055,.15],{b:1,z:JK,k:.04}));// jacket hem
 P.push(E(add(J.chest,[0,.17,-.09]),[.14,.08,.08],{b:2,z:JK,k:.05}));// hood bunched at the back
 P.push(C(add(J.chest,[0,-.12,.15]),add(J.chest,[0,.15,.14]),.012,.012,{b:2,z:DK,k:.01}));// zip
 P.push(E(add(J.chest,[.12,-.02,.12]),[.05,.035,.02],{b:2,z:DK,k:.015}));// chest pocket
 // neck gaiter + head
 P.push(C(add(J.neck,[0,-.05,0]),add(J.head,[0,-.03,.01]),.072,.068,{b:3,z:PT,k:.04}));
 P.push(E(add(J.head,[0,-.04,.055]),[.085,.065,.07],{b:4,z:PT,k:.03}));
 P.push(E(add(J.head,[0,.07,-.005]),[.138,.135,.152],{b:4,z:HL,k:.015}));// helmet
 P.push(E(add(J.head,[0,.17,-.03]),[.06,.03,.1],{b:4,z:HL,k:.03}));// helmet ridge
 P.push(TO(add(J.head,[0,.045,-.01]),.142,.016,{b:4,z:DK,k:.01}));// goggle strap
 P.push(E(add(J.head,[0,.035,.115]),[.118,.052,.05],{b:4,z:DK,k:.012}));// goggle frame
 P.push(E(add(J.head,[0,.035,.137]),[.104,.042,.035],{b:4,z:GG,k:.008}));// lens
 for(const s of[-1,1])P.push(E(add(J.head,[s*.135,.0,-.01]),[.03,.055,.055],{b:4,z:HL,k:.01}));// ear pads
 // arms
 for(const n of['R','L']){const ua=n==='R'?5:8,sh=J['sh'+n],el=J['el'+n],wr=J['wr'+n],d=nrm(sub(wr,el));
  P.push(E(sh,[.085,.085,.085],{b:ua,z:JK,k:.05}));
  P.push(C(sh,el,.072,.062,{b:ua,z:JK,k:.04}));P.push(C(el,wr,.06,.054,{b:ua+1,z:JK,k:.035}));
  P.push(C(add(wr,mul(d,-.02)),add(wr,mul(d,.015)),.058,.058,{b:ua+2,z:DK,k:.02}));// cuff
  const hc=add(wr,mul(d,.075));P.push(E(hc,[.052,.06,.04],{b:ua+2,z:DK,k:.025,rot:[0,0,Math.atan2(d[0],-d[1])]}));// glove
  P.push(E(add(hc,[n==='R'?.03:-.03,.02,.035]),[.02,.035,.02],{b:ua+2,z:DK,k:.02}))}
 // legs: baggy pants, boots strapped to the board
 for(const n of['R','L']){const lg=n==='R'?11:14,hp=J['hp'+n],kn=J['kn'+n],an=J['an'+n],to=J['to'+n];
  P.push(C(hp,kn,.1,.08,{b:lg,z:PT,k:.06}));P.push(E(kn,[.075,.075,.075],{b:lg+1,z:PT,k:.04}));P.push(C(kn,add(an,[0,.06,0]),.077,.07,{b:lg+1,z:PT,k:.04}));
  const bc=mix(an,to,.4);P.push(E(add(bc,[0,.02,0]),[.068,.085,.15],{b:lg+2,z:DK,k:.03,rot:[0,Math.atan2(to[0]-an[0],to[2]-an[2]),0]}));
  P.push(E(add(an,[0,.12,0]),[.072,.07,.075],{b:lg+2,z:DK,k:.03}))}
 return{prims:P,h:.016,bones,nb:bones.length,J,pal:{0:[.92,.92,.92],1:[.95,.95,.95],2:[.9,.9,.9],3:[.92,.92,.92],4:[.13,.135,.15]},ao:1,cv:.05}}
// rocks: lumpy, faceted granite with snow sitting on top (snow is added in the shader by normal)
function rock(seed){const P=[],r=(i)=>{const x=Math.sin(seed*91.7+i*12.9898)*43758.5453;return x-Math.floor(x)};
 P.push(E([0,.2,0],[1,.75,.85],{k:.2,rot:[r(1)*.4,r(2)*3,r(3)*.3]}));
 for(let i=0;i<4+seed%3;i++)P.push(E([(r(i*4+5)-.5)*1.3,.15+r(i*4+6)*.5,(r(i*4+7)-.5)*1.1],[.35+r(i*4+8)*.5,.3+r(i*4+9)*.35,.35+r(i*4+10)*.4],{k:.25,rot:[r(i)*2,r(i+1)*3,r(i+2)*2]}));
 P.push(B([0,-.6,0],[3,.6,3],0,{op:1,k:.05}));
 return{prims:P,h:.07,noise:.12,nf:2.2,pal:{0:[.42,.42,.44]},ao:1,cv:.25,cf:1.6}}
const list={rider,rock0:()=>rock(1),rock1:()=>rock(2),rock2:()=>rock(5)};
return{list,J}})();

return{SDF,MODELS}}
// ================= RENDERER + POST PROCESSING =================
const ren=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',stencil:false});
ren.outputEncoding=THREE.LinearEncoding;ren.toneMapping=THREE.NoToneMapping;ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;ren.autoClear=false;
ren.domElement.id='gl';document.body.prepend(ren.domElement);
const isGL2=ren.capabilities.isWebGL2,HDR=(isGL2&&ren.extensions.has('EXT_color_buffer_float'))||(!isGL2&&ren.extensions.has('OES_texture_half_float')&&ren.extensions.has('EXT_color_buffer_half_float'));
const FT=HDR?THREE.HalfFloatType:THREE.UnsignedByteType;
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xbfd2e6,.0035);
const cam=new THREE.PerspectiveCamera(70,1,.1,3200);scene.add(cam);
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
sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-42,right:42,top:42,bottom:-42,near:1,far:260});sun.shadow.bias=-.0004;sun.shadow.normalBias=.04;sun.shadow.radius=2.5;
const hemi=new THREE.HemisphereLight(0x9cc0ff,0xdfe8f5,1);scene.add(hemi);
const skyU={sunDir:{value:new THREE.Vector3(0,1,0)},zen:{value:new THREE.Color()},hor:{value:new THREE.Color()},haze:{value:new THREE.Color()},sunCol:{value:new THREE.Color()},time:{value:0},cloud:{value:.3},stars:{value:0},camPos:{value:new THREE.Vector3()}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(2800,48,24),new THREE.ShaderMaterial({uniforms:skyU,vertexShader:SH.skyV,fragmentShader:SH.skyF,side:THREE.BackSide,depthWrite:false,fog:false}));sky.frustumCulled=false;sky.renderOrder=-10;scene.add(sky);
// time-of-day looks: sun elevation/azimuth (deg), colours, light, fog, grading, weather
const TOD={
 dawn:{name:'Dawn',el:7,az:-125,zen:0x2f4f8f,hor:0xf3b49a,haze:0xe7c6c2,sun:0xffb27a,sunI:2.6,sky:0x8ea6e0,gnd:0xe8d6e6,hemiI:.62,fog:0xe5c9c7,fogD:.0032,cloud:.32,snow:0,exp:.66,sat:1.08,gain:[1.03,.99,.98],lift:[.01,.0,.02],stars:.15},
 day:{name:'Bluebird',el:34,az:148,zen:0x1048aa,hor:0xa8c8ec,haze:0xd0e0f0,sun:0xfff6e8,sunI:3.2,sky:0x8fb8ff,gnd:0xe6eef8,hemiI:.6,fog:0xc6dbef,fogD:.0022,cloud:.28,snow:0,exp:.52,sat:1.06,gain:[1,1,1.01],lift:[0,0,.01],stars:0},
 golden:{name:'Golden hour',el:10,az:128,zen:0x2d5a9e,hor:0xffd8b0,haze:0xeadcce,sun:0xffc07a,sunI:3,sky:0x8aa6d8,gnd:0xf0e0d0,hemiI:.6,fog:0xead8c8,fogD:.0021,cloud:.36,snow:0,exp:.62,sat:1.12,gain:[1.04,1,.95],lift:[.01,.005,0],stars:0},
 storm:{name:'Snowstorm',el:30,az:160,zen:0x8a96a6,hor:0xc3ccd6,haze:0xc8d0da,sun:0xdfe6f0,sunI:.9,sky:0xbcc8d8,gnd:0xd8dee6,hemiI:1.25,fog:0xc4ccd6,fogD:.0125,cloud:.95,snow:1,exp:.66,sat:.85,gain:[.98,1,1.02],lift:[.02,.02,.03],stars:0},
 dusk:{name:'Blue hour',el:-3,az:165,zen:0x0e1a3a,hor:0x5b6fa8,haze:0x6d7aa6,sun:0x8aa0ff,sunI:.55,sky:0x4a5f9c,gnd:0x8a96c0,hemiI:.9,fog:0x56648f,fogD:.0034,cloud:.22,snow:0,exp:.95,sat:1,gain:[.96,.99,1.06],lift:[0,.005,.03],stars:.9}};
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
 const g=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshBasicMaterial({color:new THREE.Color(T.gnd).multiplyScalar(.9*T.hemiI)}));g.rotation.x=-PI/2;g.position.y=-8;es.add(g);
 const pm=new THREE.PMREMGenerator(ren);if(scene.environment)scene.environment.dispose();scene.environment=pm.fromScene(es,.02,.1,1000).texture;pm.dispose();m.geometry.dispose();m.material.dispose();g.geometry.dispose()}
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
 // snow: wind ripples (sastrugi) + fine grain
 const W=512,H1=tileNoise(W,[3,7,17,41,97,211],11),H2=new Float32Array(W*W);for(let j=0;j<W;j++)for(let i=0;i<W;i++){const r=Math.sin((j/W*6+H1[j*W+i]*2.6)*TAU)*.5+.5;H2[j*W+i]=H1[j*W+i]*.78+r*r*r*.22}
 TX.snowN=tex(normalMapFrom(H2,W,3.4));
 const H3=tileNoise(W,[16,48,96],29);TX.grainN=tex(normalMapFrom(H3,W,1.6));
 // soft particle sprite
 TX.puff=new THREE.CanvasTexture(cv(64,64,(x,w,h)=>{const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.45,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}));
 TX.flake=new THREE.CanvasTexture(cv(32,32,(x)=>{const g=x.createRadialGradient(16,16,0,16,16,16);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.3,'rgba(255,255,255,.8)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,32,32)}));
 // board top sheet graphic
 TX.boardTop=b=>{const c=cv(512,96,(x,w,h)=>{const col=new THREE.Color(b.col),acc=new THREE.Color(b.acc);x.fillStyle='#'+col.getHexString();x.fillRect(0,0,w,h);
  x.globalAlpha=.9;x.fillStyle='#'+acc.getHexString();for(let i=0;i<7;i++){x.beginPath();x.moveTo(60+i*58,0);x.lineTo(90+i*58,0);x.lineTo(40+i*58,h);x.lineTo(10+i*58,h);x.fill()}
  x.globalAlpha=1;x.fillStyle='rgba(0,0,0,.35)';x.fillRect(0,h-6,w,6);x.fillRect(0,0,w,6);x.font='bold 30px sans-serif';x.fillStyle='rgba(255,255,255,.85)';x.textAlign='center';x.fillText(b.name.toUpperCase(),w/2,h/2+11)});
  const t=new THREE.CanvasTexture(c);t.encoding=THREE.sRGBEncoding;t.anisotropy=4;return t};
}

// ================= MOUNTAIN: height field, features, chunk streaming =================
// The rider descends toward -Z. s = -z is distance down the mountain, u = lateral offset from the run's centre line.
const TER={seed:1,ph:[],feats:[],featEnd:0,dropPre:[],chunks:new Map(),STEP:1.25,L:50,HALF:150,AHEAD:10,BEHIND:2,queue:[]};
function terSeed(seed){TER.seed=seed|0;const r=mulberry(seed);TER.ph=[0,1,2,3,4,5,6,7].map(()=>r()*TAU);TER.rnd=mulberry(seed*7+3);TER.feats=[{t:'kick',s:78,u:0,w:6.5,H:2.1,len:12,deck:5,land:13}];TER.featEnd=95;TER.y0=0;TER.y0=-ybase(0);
 TER.chunks.forEach(c=>disposeChunk(c));TER.chunks.clear();TER.queue=[];ensureFeatures(700)}
const cx=s=>60*Math.sin(s/430+TER.ph[0])+26*Math.sin(s/165+TER.ph[1])-60*Math.sin(TER.ph[0])-26*Math.sin(TER.ph[1]);
const grade=s=>.34+.09*Math.sin(s/280+TER.ph[2])+.05*Math.sin(s/97+TER.ph[3]);
const ybase=s=>-(.34*s-.09*280*Math.cos(s/280+TER.ph[2])-.05*97*Math.cos(s/97+TER.ph[3]))+TER.y0;
const halfW=s=>58+18*Math.sin(s/310+TER.ph[4]);
// features: kickers, rollers, cornice drops, gates
const kicker=(r,s,u,sz)=>({t:'kick',s,u,w:rr2(r,5.2,7.2)+sz*.6,H:[rr2(r,1.3,1.8),rr2(r,2,2.6),rr2(r,2.8,3.6)][sz],len:[rr2(r,8,10),rr2(r,10,12.5),rr2(r,13,16)][sz],deck:[rr2(r,1.5,3.5),rr2(r,3,6),rr2(r,6,10)][sz],land:[rr2(r,9,12),rr2(r,12,15),rr2(r,16,20)][sz]});
function ensureFeatures(sMax){const r=TER.rnd;while(TER.featEnd<sMax){let s=TER.featEnd+rr2(r,38,80);const W=halfW(s),roll=r();
  if(roll<.24&&s>150){// a park line: three table tops in a row, small to big
   const u=(r()*2-1)*W*.2;let ss=s;for(let i=0;i<3;i++){const k=kicker(r,ss,u+(r()-.5)*3,i);TER.feats.push(k);ss+=k.len+k.deck+k.land+rr2(r,14,22)}s=ss-20}
  else if(roll<.62){const n=r()<.4?2:1;for(let i=0;i<n;i++){const u=n===1?(r()*2-1)*W*.28:(i?1:-1)*rr2(r,9,W*.4),sz=r()<.3?2:r()<.55?1:0;TER.feats.push(kicker(r,s+i*rr2(r,3,10),u,sz))}}
  else if(roll<.65&&s>260){TER.feats.push({t:'drop',s,H:rr2(r,2.6,5.2),H2:rr2(r,1.2,2.6)})}
  else if(roll<.86){const n=2+(r()*3|0);for(let i=0;i<n;i++)TER.feats.push({t:'roll',s:s+i*rr2(r,14,20),u:(r()*2-1)*W*.3,w:W*rr2(r,.5,.9),H:rr2(r,1,2.1),len:rr2(r,4.2,6)})}
  if(r()<.55){const sg=s+rr2(r,30,55);TER.feats.push({t:'gate',s:sg,u:(r()*2-1)*halfW(sg)*.5,gap:rr2(r,6,8)})}
  TER.featEnd=s}
 TER.feats.sort((a,b)=>a.s-b.s);TER.drops=TER.feats.filter(f=>f.t==='drop');TER.fbin=new Map();TER.feats.forEach((f,i)=>{if(f.t==='gate')return;const b0=Math.floor((f.s-30)/25),b1=Math.floor((f.s+45)/25);for(let b=b0;b<=b1;b++){if(!TER.fbin.has(b))TER.fbin.set(b,[]);TER.fbin.get(b).push(f)}})}
function rr2(r,a,b){return a+r()*(b-a)}
// analytic height at (x, s)
function heightS(x,s){const c=cx(s),u=x-c,W=halfW(s);let y=ybase(s);
 const a=Math.abs(u)-W;if(a>0)y+=.0065*a*a+.12*a;
 y+=.0011*u*u+.05*u*Math.sin(s/210+TER.ph[5]);
 y+=2.6*(vn2(x/44,s/44,TER.seed)-.5)*2+.55*(vn2(x/9.5,s/9.5,TER.seed+9)-.5)*2*sstep(10,60,s);
 for(const d of TER.drops){if(d.s-8>s)break;y+=.6*sstep(d.s-8,d.s,s)*(1-sstep(d.s,d.s+.4,s))-d.H*sstep(d.s,d.s+2.4,s)-d.H2*sstep(d.s+2.4,d.s+22,s)}
 const bin=TER.fbin.get(Math.floor(s/25));if(bin)for(const f of bin){
  if(f.t==='kick'){const d=s-f.s,end=f.deck+f.land;if(d<-f.len||d>end)continue;const lu=Math.abs(u-f.u),fall=1-sstep(f.w,f.w+2.2,lu);if(fall<=0)continue;
   const top=f.H+grade(f.s)*f.deck*.85;let h;if(d<0){const t=1+d/f.len;h=f.H*Math.pow(t,1.7)}else if(d<f.deck)h=f.H+grade(f.s)*d*.85;else{const t=(d-f.deck)/f.land;h=top*(1-t*t*(3-2*t))}y+=h*fall}
  else if(f.t==='roll'){const d=(s-f.s)/f.len;if(d<-3||d>3)continue;const lu=Math.abs(u-f.u),fall=1-sstep(f.w*.7,f.w,lu);y+=f.H*Math.exp(-d*d)*fall}}
 return y}
// height exactly as the rendered mesh shows it (lattice + same triangle split)
function groundH(x,z){const S=TER.STEP,gx=x/S,gz=z/S,i=Math.floor(gx),j=Math.floor(gz),fx=gx-i,fz=gz-j;
 const h00=heightS(i*S,-j*S),h11=heightS((i+1)*S,-(j+1)*S);
 if(fx>fz){const h10=heightS((i+1)*S,-j*S);return h00+(h10-h00)*fx+(h11-h10)*fz}
 const h01=heightS(i*S,-(j+1)*S);return h00+(h11-h01)*fx+(h01-h00)*fz}
function groundN(x,z,out){const e=.6,hx=groundH(x+e,z)-groundH(x-e,z),hz=groundH(x,z+e)-groundH(x,z-e);return out.set(-hx/(2*e),1,-hz/(2*e)).normalize()}
// smooth normal from the analytic field (for physics we use a wider stencil to avoid lattice jitter)
function fieldN(x,s,out,e){e=e||.8;const hx=heightS(x+e,s)-heightS(x-e,s),hz=heightS(x,s-e)-heightS(x,s+e);return out.set(-hx/(2*e),1,-hz/(2*e)).normalize()}
// --------- materials ---------
const MAT={};
function snowMaterial(){const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.62,metalness:0,normalMap:TX.snowN,normalScale:new THREE.Vector2(.85,.85),envMapIntensity:.35});
 m.userData.u={sunView:{value:new THREE.Vector3()},sunCol:{value:new THREE.Color()},spark:{value:1.4}};
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,m.userData.u);
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWP=(modelMatrix*vec4(transformed,1.)).xyz;');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;uniform vec3 sunView;uniform vec3 sunCol;uniform float spark;')
   .replace('#include <tonemapping_fragment>',`{vec3 cp=floor(vWP*16.);float hs=fract(sin(dot(cp,vec3(12.9898,78.233,37.719)))*43758.5453);
    vec3 Vd=normalize(vViewPosition);vec3 Hh=normalize(sunView+Vd);vec3 fn=normalize(normal+(vec3(fract(hs*13.1),fract(hs*71.7),fract(hs*37.3))-.5)*.9);
    float nl=max(dot(normal,sunView),0.);float lit=clamp(dot(reflectedLight.directDiffuse,vec3(.333))/max(nl*dot(sunCol*diffuseColor.rgb,vec3(.333)),1e-3),0.,1.);
    float sp=pow(max(dot(fn,Hh),0.),1400.)*step(.55,hs)*lit*smoothstep(80.,6.,length(vViewPosition));gl_FragColor.rgb+=mix(sunCol,vec3(dot(sunCol,vec3(.333))),.7)*sp*spark*30.;}
    #include <tonemapping_fragment>`)};
 m.customProgramCacheKey=()=>'snow1';return m}
function rockMaterial(){const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.85,metalness:0,envMapIntensity:.4});
 m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWN;varying vec3 vWP2;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWP2=(modelMatrix*vec4(transformed,1.)).xyz;\nvWN=normalize(mat3(modelMatrix)*objectNormal);');
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWN;varying vec3 vWP2;')
   .replace('#include <color_fragment>','#include <color_fragment>\n{float n=fract(sin(dot(floor(vWP2*3.),vec3(12.98,78.23,37.71)))*43758.5);float sn=smoothstep(.45,.7,normalize(vWN).y+n*.15);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.94,.96,1.),sn);}')};
 m.customProgramCacheKey=()=>'rock1';return m}
function treeMaterial(){const m=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.9,metalness:0,envMapIntensity:.3});
 m.userData.u={time:{value:0}};
 m.onBeforeCompile=sh=>{Object.assign(sh.uniforms,m.userData.u);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float time;').replace('#include <begin_vertex>',`#include <begin_vertex>
   #ifdef USE_INSTANCING
   vec3 ip=vec3(instanceMatrix[3][0],0.,instanceMatrix[3][2]);float sw=sin(time*1.3+ip.x*.13+ip.z*.11)*.012*transformed.y*transformed.y*.08;transformed.x+=sw;transformed.z+=sw*.6;
   #endif`)};
 m.customProgramCacheKey=()=>'tree1';return m}
// --------- trees: spruce built from needle-textured branch cards, with baked impostors for distance ---------
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
function impostorMat(tex){const m=new THREE.MeshStandardMaterial({map:tex,alphaTest:.3,roughness:.95,metalness:0,envMapIntensity:.3,side:THREE.DoubleSide});
 m.onBeforeCompile=sh=>{sh.vertexShader=sh.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
   #ifdef USE_INSTANCING
   vec3 ipn=vec3(instanceMatrix[3][0],0.,instanceMatrix[3][2]);vec3 tcn=cameraPosition-ipn;float angn=atan(tcn.x,tcn.z);float cn=cos(angn),snn=sin(angn);objectNormal=vec3(objectNormal.x*cn+objectNormal.z*snn,objectNormal.y,-objectNormal.x*snn+objectNormal.z*cn);
   #endif`).replace('#include <begin_vertex>',`#include <begin_vertex>
   #ifdef USE_INSTANCING
   transformed=vec3(transformed.x*cn+transformed.z*snn,transformed.y,-transformed.x*snn+transformed.z*cn);
   #endif`)};
 m.customProgramCacheKey=()=>'impostor';return m}
function impostorGeo(){const g=new THREE.PlaneGeometry(7.2,11.2);g.translate(0,5,0);const n=g.attributes.normal;for(let i=0;i<n.count;i++)n.setXYZ(i,0,.45,.89);return g}
function snagGeo(){const P=[],Cc=[],I=[];let vi=0;const col=[.32,.29,.26],vtx=(x,y,z)=>{P.push(x,y,z);Cc.push(...col);return vi++};
 const cyl=(a,b,r0,r1)=>{const n=6,d=new THREE.Vector3().subVectors(b,a),u=new THREE.Vector3(1,0,0);if(Math.abs(d.clone().normalize().x)>.9)u.set(0,0,1);const s1=new THREE.Vector3().crossVectors(d,u).normalize(),s2=new THREE.Vector3().crossVectors(d,s1).normalize();
  const base=vi;for(let i=0;i<n;i++){const t=i/n*TAU,o=s1.clone().multiplyScalar(Math.cos(t)).add(s2.clone().multiplyScalar(Math.sin(t)));vtx(a.x+o.x*r0,a.y+o.y*r0,a.z+o.z*r0);vtx(b.x+o.x*r1,b.y+o.y*r1,b.z+o.z*r1)}
  for(let i=0;i<n;i++){const a0=base+i*2,b0=base+((i+1)%n)*2;I.push(a0,b0,a0+1,b0,b0+1,a0+1)}};
 const V=(x,y,z)=>new THREE.Vector3(x,y,z);cyl(V(0,0,0),V(.1,7.5,.05),.2,.05);const r=mulberry(99);for(let i=0;i<9;i++){const y=2+i*.55,a=r()*TAU,l=.6+r()*1.1*(1-i/10);cyl(V(0,y,0),V(Math.cos(a)*l,y+.25+r()*.3,Math.sin(a)*l),.05,.015)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('color',new THREE.Float32BufferAttribute(Cc,3));g.setIndex(I);g.computeVertexNormals();return g}
// --------- instanced props (trees, rocks, flags) ---------
const PROPS={types:{},hash:new Map(),CELL:8};
function propType(name,geo,mat,max,shadow){const im=new THREE.InstancedMesh(geo,mat,max);im.count=0;im.castShadow=shadow;im.receiveShadow=true;im.frustumCulled=false;scene.add(im);PROPS.types[name]={im,max,geo,mat}}
function buildProps(){const tm=treeMaterial();MAT.tree=tm;MAT.rock=rockMaterial();
 const atlas=branchAtlas(),TM=treeMats(atlas);MAT.treeCard=TM.m;const gA=cardTreeGeo(0),gB=cardTreeGeo(1);
 propType('pineA',gA,TM.m,1800,true);propType('pineB',gB,TM.m,1200,true);PROPS.types.pineA.im.customDepthMaterial=TM.d;PROPS.types.pineB.im.customDepthMaterial=TM.d;
 propType('snag',snagGeo(),tm,500,true);
 const ig=impostorGeo();propType('farA',ig,impostorMat(bakeImpostor(gA,TM.m)),7000,false);propType('farB',ig,impostorMat(bakeImpostor(gB,TM.m)),4000,false);
 const rg=new THREE.DodecahedronGeometry(1,1);propType('rock0',rg,MAT.rock,900,true);propType('rock1',rg,MAT.rock,900,true);propType('rock2',rg,MAT.rock,900,true);
 // gate flags + kicker markers
 const pole=new THREE.CylinderGeometry(.035,.035,2.2,6);pole.translate(0,1.1,0);propType('pole',pole,new THREE.MeshStandardMaterial({color:0x222222,roughness:.4,metalness:.6}),400,true);
 const fl=new THREE.PlaneGeometry(.75,.5,4,2);fl.translate(.4,1.85,0);propType('flagG',fl,new THREE.MeshStandardMaterial({color:0xffc21a,emissive:0x553300,roughness:.6,side:THREE.DoubleSide}),200,true);
 const lip=new THREE.PlaneGeometry(1,.16);lip.rotateX(-PI/2);propType('lip',lip,new THREE.MeshStandardMaterial({color:0x1f5bd8,roughness:.8,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3}),300,false);
 propType('flagO',fl,new THREE.MeshStandardMaterial({color:0xff5a14,emissive:0x331000,roughness:.6,side:THREE.DoubleSide}),400,true)}
function setRockGeo(i,geo){const t=PROPS.types['rock'+i];if(!t)return;const g=geo.clone();g.deleteAttribute('skinIndex');g.deleteAttribute('skinWeight');g.clearGroups();t.im.geometry=g;t.geo=g}
// --------- chunk generation ---------
function chunkKey(k){return k}
function genChunk(k){const S=TER.STEP,L=TER.L,s0=k*L,s1=s0+L,smid=(s0+s1)/2;ensureFeatures(s1+400);
 const xc=Math.round(cx(smid)/S)*S,nx=Math.round(TER.HALF*2/S)+1,nz=Math.round(L/S)+1,x0=xc-TER.HALF,j0=Math.round(-s0/S);
 const pos=new Float32Array(nx*nz*3),nor=new Float32Array(nx*nz*3),col=new Float32Array(nx*nz*3),uv=new Float32Array(nx*nz*2),Hh=new Float32Array((nx+2)*(nz+2));
 for(let j=-1;j<=nz;j++)for(let i=-1;i<=nx;i++){Hh[(j+1)*(nx+2)+(i+1)]=heightS(x0+i*S,s0+j*S)}
 const hh=(i,j)=>Hh[(j+1)*(nx+2)+(i+1)];
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const v=j*nx+i,x=x0+i*S,s=s0+j*S,y=hh(i,j);pos[v*3]=x;pos[v*3+1]=y;pos[v*3+2]=-s;
  let ax=(hh(i+1,j)-hh(i-1,j))/(2*S),az=-(hh(i,j+1)-hh(i,j-1))/(2*S);const l=Math.hypot(ax,1,az);const ny=1/l;nor[v*3]=-ax/l;nor[v*3+1]=ny;nor[v*3+2]=-az/l;
  // exposed rock on steep faces, faint blue in wind-scoured hollows
  const steep=sstep(.7,.52,ny),n=vn2(x/6,s/6,TER.seed+21),rock=steep*sstep(.45,.7,n);const blue=.03*(1-n);
  col[v*3]=lerp(1-blue*1.4,.34,rock);col[v*3+1]=lerp(1-blue*.6,.33,rock);col[v*3+2]=lerp(1,.35,rock);
  uv[v*2]=x/5.5;uv[v*2+1]=s/5.5}
 const idx=new (nx*nz>65535?Uint32Array:Uint16Array)((nx-1)*(nz-1)*6);let q=0;
 // split each quad along the same diagonal used by groundH(): lattice (i,j)->(i+1,j+1) in world x / world z
 for(let j=0;j<nz-1;j++)for(let i=0;i<nx-1;i++){const a=j*nx+i,b=a+1,c=a+nx,d=c+1;// a=(i,s) b=(i+1,s) c=(i,s+S) d=(i+1,s+S); world z grid index increases toward -s, so z-lattice j' = -(s)/S
  idx[q++]=c;idx[q++]=a;idx[q++]=b;idx[q++]=c;idx[q++]=b;idx[q++]=d}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.setIndex(new THREE.BufferAttribute(idx,1));g.computeBoundingSphere();
 const mesh=new THREE.Mesh(g,MAT.snow);mesh.receiveShadow=true;mesh.castShadow=save.set.q>0;scene.add(mesh);
 // props
 const props=[],r=mulberry(TER.seed*1000+k*17+5),C=7;
 for(let s=s0;s<s1;s+=C)for(let x=x0+4;x<x0+TER.HALF*2-4;x+=C){const px=x+r()*C,ps=s+r()*C,u=px-cx(ps),W=halfW(ps),au=Math.abs(u),fr=vn2(px/95,ps/95,TER.seed+3),glade=vn2(ps/380,0,TER.seed+5);
  let dens=au<W?(.012+.6*sstep(.55,1.05,au/W)*(.35+fr)+(glade>.68?.22*fr:0)):(.55+.35*fr);
  if(clearing(px,ps))dens=0;const rv=r();
  if(rv<dens){const y=heightS(px,ps);
   const sc=.65+r()*.75*(au<W?1:1.2),tp=r()<.06?'snag':r()<.42?'pineB':'pineA';props.push({t:tp,x:px,y:y-.15,z:-ps,s:sc,ry:r()*TAU,rad:(tp==='snag'?.35:.75)*sc,h:10*sc})}
  else if(rv<dens+(au<W?.006:.02)+(sstep(.5,.75,fr)*.01)){const y=heightS(px,ps),sc=.5+r()*r()*2.2;props.push({t:'rock'+(r()*3|0),x:px,y:y-.25*sc,z:-ps,s:sc,ry:r()*TAU,rad:.95*sc,h:.95*sc})}}
 // feature dressing
 for(const f of TER.feats){if(f.s<s0||f.s>=s1)continue;
  if(f.t==='gate'){for(const sd of[-1,1]){const x=cx(f.s)+f.u+sd*f.gap/2,y=heightS(x,f.s);props.push({t:'pole',x,y,z:-f.s,s:1,ry:0,rad:.25,h:2.2,gate:f});props.push({t:'flagG',x,y,z:-f.s,s:1,ry:sd<0?PI:0,rad:0,h:0})}}
  if(f.t==='kick'){const lx=cx(f.s)+f.u;props.push({t:'lip',x:lx,y:heightS(lx,f.s-.15)+.02,z:-(f.s-.15),s:1,sx:f.w*2,ry:0,rad:0,h:0});
   for(const sd of[-1,1]){const x=cx(f.s)+f.u+sd*(f.w+1.6),s=f.s-2,y=heightS(x,s);props.push({t:'pole',x,y,z:-s,s:.9,ry:0,rad:.2,h:2});props.push({t:'flagO',x,y,z:-s,s:.9,ry:sd<0?PI:0,rad:0,h:0})}}
  if(f.t==='drop'){const W=halfW(f.s);for(let u=-W;u<=W;u+=W/3){const x=cx(f.s)+u,s=f.s-9,y=heightS(x,s);props.push({t:'pole',x,y,z:-s,s:1,ry:0,rad:.2,h:2.2});props.push({t:'flagO',x,y,z:-s,s:1,ry:R()*TAU,rad:0,h:0})}}}
 // a few old tracks from earlier riders, softened by wind
 let oldT=null;if(k>0&&r()<.55){const P=[],UV=[],N=[],I=[];let vi=0;const nT=1+(r()*3|0);
  for(let tI=0;tI<nT;tI++){const ph=r()*TAU,amp=rr2(r,4,12),wl=rr2(r,22,40),off=(r()*2-1)*halfW(smid)*.6;let prev=null;
   for(let ss=s0;ss<=s1+.01;ss+=1.25){const u=off+Math.sin(ss/wl*TAU+ph)*amp,x=cx(ss)+u,y=heightS(x,ss)+.035;const du=Math.cos(ss/wl*TAU+ph)*amp*TAU/wl,dx=cx(ss+.5)-cx(ss-.5)+du;const l=Math.hypot(dx,1);const lx=1/l,lz=dx/l;
    for(const sd of[-1,1]){P.push(x+lx*.13*sd,y,-ss+lz*.13*sd);UV.push(sd>0?1:0,ss*.5);N.push(0,1,0)}
    if(prev!==null)I.push(prev,prev+1,vi,prev+1,vi+1,vi);prev=vi;vi+=2}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(UV,2));g.setAttribute('normal',new THREE.Float32BufferAttribute(N,3));g.setIndex(I);g.computeBoundingSphere();
  oldT=new THREE.Mesh(g,MAT.oldTrack||(MAT.oldTrack=(()=>{const m=TRK.mesh.material.clone();m.color.set(0xeef3fa);m.normalScale.set(.55,.55);return m})()));oldT.receiveShadow=true;scene.add(oldT)}
 const ch={k,mesh,props,s0,s1,oldT};TER.chunks.set(k,ch);
 for(const p of props){if(!p.rad)continue;const key=Math.floor(p.x/PROPS.CELL)+','+Math.floor(p.z/PROPS.CELL);let a=PROPS.hash.get(key);if(!a)PROPS.hash.set(key,a=[]);a.push(p)}
 PROPS.dirty=true;return ch}
function clearing(x,s){const u=x-cx(s);for(const f of TER.feats){if(f.s>s+40)break;if(f.s<s-40)continue;const d=s-f.s;
  if(f.t==='kick'&&d>-f.len-16&&d<f.deck+f.land+10&&Math.abs(u-f.u)<f.w+7)return true;
  if(f.t==='drop'&&d>-14&&d<28&&Math.abs(u)<halfW(s)+2)return true;
  if(f.t==='gate'&&Math.abs(d)<6&&Math.abs(u-f.u)<f.gap/2+3)return true;
  if(f.t==='roll'&&Math.abs(d)<f.len*2&&Math.abs(u-f.u)<f.w)return true}return s<30&&Math.abs(u)<30}
function disposeChunk(c){scene.remove(c.mesh);c.mesh.geometry.dispose();if(c.oldT){scene.remove(c.oldT);c.oldT.geometry.dispose()}for(const p of c.props){if(!p.rad)continue;const key=Math.floor(p.x/PROPS.CELL)+','+Math.floor(p.z/PROPS.CELL),a=PROPS.hash.get(key);if(a){const i=a.indexOf(p);if(i>=0)a.splice(i,1);if(!a.length)PROPS.hash.delete(key)}}PROPS.dirty=true}
const _m4=new THREE.Matrix4(),_q=new THREE.Quaternion(),_e=new THREE.Euler(),_v=new THREE.Vector3(),_sv=new THREE.Vector3();
const LOD={x:0,z:0,R:95};
function rebuildProps(){for(const n in PROPS.types)PROPS.types[n].im.count=0;
 const keys=[...TER.chunks.keys()].sort((a,b)=>a-b);LOD.x=PH.pos.x;LOD.z=PH.pos.z;const R2=LOD.R*LOD.R;
 for(const k of keys)for(const p of TER.chunks.get(k).props){let t=p.t;if((t==='pineA'||t==='pineB')&&((p.x-LOD.x)**2+(p.z-LOD.z)**2>R2))t=t==='pineA'?'farA':'farB';const T=PROPS.types[t];if(!T||T.im.count>=T.max)continue;
  _e.set(0,t==='farA'||t==='farB'?0:p.ry,0);_q.setFromEuler(_e);_sv.set(p.sx||p.s,p.s,p.s);_m4.compose(_v.set(p.x,p.y,p.z),_q,_sv);T.im.setMatrixAt(T.im.count++,_m4)}
 for(const n in PROPS.types)PROPS.types[n].im.instanceMatrix.needsUpdate=true;PROPS.dirty=false}
function updateChunks(s,sync){const kc=Math.floor(s/TER.L),want=[];for(let k=Math.max(0,kc-TER.BEHIND);k<=kc+TER.AHEAD;k++)want.push(k);
 for(const [k,c] of TER.chunks)if(k<kc-TER.BEHIND||k>kc+TER.AHEAD+1){disposeChunk(c);TER.chunks.delete(k)}
 const missing=want.filter(k=>!TER.chunks.has(k)).sort((a,b)=>a-b);
 if(sync)missing.forEach(genChunk);else if(missing.length)genChunk(missing[0]);
 if(PROPS.dirty||(PH.pos.x-LOD.x)**2+(PH.pos.z-LOD.z)**2>18*18)rebuildProps()}
// obstacles near a point
function nearProps(x,z,r,cb){const C=PROPS.CELL,i0=Math.floor((x-r)/C),i1=Math.floor((x+r)/C),j0=Math.floor((z-r)/C),j1=Math.floor((z+r)/C);for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){const a=PROPS.hash.get(i+','+j);if(a)for(const p of a)cb(p)}}
// --------- far mountains (a ring that travels with the camera) ---------
let farMts=null;
// A real 3D range: a polar height field (ridged multifractal) around the camera, lit in HDR like the near terrain.
// Built at "virtual" scale and shrunk toward the eye so it fits inside the camera's far plane without changing how it looks.
function farRange(sd){const NA=960,NR=104,R0=1500,R1=8200,K=.36,EY=140,P=new Float32Array((NA+1)*NR*3),H=new Float32Array((NA+1)*NR),V=new Float32Array((NA+1)*NR),Cc=new Float32Array((NA+1)*NR*3),I=[];
 const seed=TER.seed+sd;
 const rmf=(x,z)=>{let sum=0,amp=1,f=1,w=1,nm=0;for(let o=0;o<7;o++){let n=1-Math.abs(vn2(x*f+o*7.3,z*f-o*3.1,seed+o*17)*2-1);n*=n;n*=w;w=clamp(n*1.7,0,1);sum+=n*amp;nm+=amp;amp*=.52;f*=2.03}return sum/nm};
 for(let i=0;i<=NA;i++){const a=i/NA*TAU,ca=Math.cos(a),sa=Math.sin(a);
  for(let k=0;k<NR;k++){const t=k/(NR-1),r=R0*Math.pow(R1/R0,t),x=ca*r,z=sa*r,id=i*NR+k;
   const wx=x+(vn2(x/1900,z/1900,seed+5)-.5)*900,wz=z+(vn2(x/1900,z/1900,seed+6)-.5)*900,big=vn2(x/6500,z/6500,seed+3),m=rmf(wx/2400,wz/2400),env=sstep(0,.3,t)*(.55+.45*sstep(.25,.7,t));
   let h=-560+env*(240+Math.pow(m,1.3)*1900*(.5+.7*big))+(vn2(x/420,z/420,seed+9)-.5)*120*env;
   H[id]=h;V[id]=m;P[id*3]=x*K;P[id*3+1]=(h-EY)*K;P[id*3+2]=z*K}}
 for(let i=0;i<NA;i++)for(let k=0;k<NR-1;k++){const a=i*NR+k,b=(i+1)*NR+k;I.push(a,b,a+1,b,b+1,a+1)}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();
 const N=g.attributes.normal.array;
 for(let id=0;id<H.length;id++){const ny=N[id*3+1],h=H[id],x=P[id*3]/K,z=P[id*3+2]/K,n1=vn2(x/170,z/170,seed+21);
  // base ground (rock, forest on the low flanks); snow is decided per pixel in the shader so its edges stay crisp
  const forest=(1-sstep(-220,40,h+(n1-.5)*160))*sstep(.55,.75,ny);
  Cc[id*3]=forest;Cc[id*3+1]=n1;Cc[id*3+2]=0}
 g.setAttribute('color',new THREE.BufferAttribute(Cc,3));
 const sky=new THREE.Color(T.sky).multiplyScalar(T.hemiI),gnd=new THREE.Color(T.gnd).multiplyScalar(T.hemiI),hz=new THREE.Color(T.fog).lerp(new THREE.Color(T.hor),.55);
 const m=new THREE.ShaderMaterial({uniforms:{sunDir:skyU.sunDir,sunCol:skyU.sunCol,sunI:{value:T.sunI},skyC:{value:sky},gndC:{value:gnd},hzC:{value:hz},fd:{value:T.fogD*.038/K},inv:{value:1/K}},vertexColors:true,fog:false,
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
function buildFarMountains(){farMts=new THREE.Group();farMts.add(farRange(31));scene.add(farMts)}

// ================= PARTICLES, TRACKS, WEATHER =================
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
let SPRAY,AVA,FLAKES;
const snowTint=new THREE.Color(1,1,1);
function initFX(){SPRAY=new PSys(2600,TX.puff);AVA=new PSys(900,TX.puff);PART=[SPRAY,AVA];initFlakes();initTrack()}
function spray(x,y,z,vx,vy,vz,n,spd,size,life){for(let i=0;i<n;i++){const a=R()*TAU,u=R();SPRAY.emit(x+rr(-.15,.15),y+rr(0,.1),z+rr(-.15,.15),vx+Math.cos(a)*spd*u,vy+R()*spd*.8,vz+Math.sin(a)*spd*u,rr(.5,1)*(life||1.1),size*rr(.5,.9),size*rr(1.6,2.6),snowTint.r,snowTint.g,snowTint.b,rr(.35,.6),1.6,3.5)}}
// ---- falling snow that wraps around the camera ----
const FL={n:0,geo:null,pts:null,base:null,amount:0};
function initFlakes(){const n=4000;FL.n=n;FL.base=new Float32Array(n*4);for(let i=0;i<n;i++){FL.base[i*4]=R();FL.base[i*4+1]=R();FL.base[i*4+2]=R();FL.base[i*4+3]=R()}
 const g=new THREE.BufferGeometry();FL.pos=new THREE.BufferAttribute(new Float32Array(n*3),3);FL.pos.setUsage(THREE.DynamicDrawUsage);g.setAttribute('position',FL.pos);
 FL.mat=new THREE.PointsMaterial({map:TX.flake,size:.09,transparent:true,depthWrite:false,opacity:.9,color:0xffffff,sizeAttenuation:true});FL.pts=new THREE.Points(g,FL.mat);FL.pts.frustumCulled=false;FL.pts.renderOrder=6;scene.add(FL.pts)}
function updateFlakes(t,wind){const amt=FL.amount;FL.pts.visible=amt>0;if(!amt)return;const n=Math.floor(FL.n*amt),B=36,P=FL.pos.array,cpx=cam.position.x,cpy=cam.position.y,cpz=cam.position.z;
 for(let i=0;i<FL.n;i++){const k=i*3;if(i>=n){P[k+1]=-1e5;continue}const b=FL.base,j=i*4,fall=t*(1.1+b[j+3]*.9);
  let x=b[j]*B+wind.x*t+Math.sin(t*.7+b[j+3]*20)*.6,y=b[j+1]*B-fall,z=b[j+2]*B+wind.z*t;
  x=((x-cpx)%B+B*1.5)%B-B/2+cpx;y=((y-cpy)%B+B*1.5)%B-B/2+cpy;z=((z-cpz)%B+B*1.5)%B-B/2+cpz;P[k]=x;P[k+1]=y;P[k+2]=z}
 FL.pos.needsUpdate=true}
// ---- fresh tracks carved behind the board ----
const TRK={max:1400,n:0,pos:null,uv:null,last:null,dist:0,brk:true};
function initTrack(){const n=TRK.max;const g=new THREE.BufferGeometry();TRK.pos=new THREE.BufferAttribute(new Float32Array(n*2*3),3);TRK.uv=new THREE.BufferAttribute(new Float32Array(n*2*2),2);TRK.nor=new THREE.BufferAttribute(new Float32Array(n*2*3),3);
 [TRK.pos,TRK.uv,TRK.nor].forEach(a=>a.setUsage(THREE.DynamicDrawUsage));g.setAttribute('position',TRK.pos);g.setAttribute('uv',TRK.uv);g.setAttribute('normal',TRK.nor);
 const idx=new Uint16Array((n-1)*6);for(let i=0;i<n-1;i++){const a=i*2;idx.set([a,a+1,a+2,a+1,a+3,a+2],i*6)}g.setIndex(new THREE.BufferAttribute(idx,1));g.setDrawRange(0,0);
 // groove profile -> normal map + tint
 const W=64,c=cv(W,8,(x)=>{const img=x.createImageData(W,8);for(let i=0;i<W;i++){const u=i/(W-1)*2-1,dh=-2*u*2.2,l=Math.hypot(dh,1);for(let j=0;j<8;j++){const k=(j*W+i)*4;img.data[k]=(-dh/l*.5+.5)*255;img.data[k+1]=128;img.data[k+2]=(1/l*.5+.5)*255;img.data[k+3]=255}}x.putImageData(img,0,0)});
 const nt=new THREE.CanvasTexture(c);nt.wrapT=THREE.RepeatWrapping;
 const m=new THREE.MeshStandardMaterial({color:0xdde6f2,roughness:.4,metalness:0,normalMap:nt,normalScale:new THREE.Vector2(1,1),polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,envMapIntensity:.6});
 TRK.mesh=new THREE.Mesh(g,m);TRK.mesh.frustumCulled=false;TRK.mesh.receiveShadow=true;scene.add(TRK.mesh)}
function trackReset(){TRK.n=0;TRK.brk=true;TRK.last=null;TRK.mesh.geometry.setDrawRange(0,0)}
const _tl=new THREE.Vector3();
function trackAdd(p,lat,nrm,width,on){// lat: unit lateral vector in the ground plane
 if(!on){if(!TRK.brk&&TRK.n>0&&TRK.last){trackPush(TRK.last,lat,nrm,0);trackFlush()}TRK.brk=true;return}
 if(TRK.last&&!TRK.brk&&p.distanceToSquared(TRK.last)<.35*.35)return;
 if(TRK.brk){trackPush(p,lat,nrm,0);TRK.brk=false}else if(TRK.last)TRK.dist+=p.distanceTo(TRK.last);
 trackPush(p,lat,nrm,width);TRK.last=(TRK.last||new THREE.Vector3()).copy(p);trackFlush()}
function trackPush(p,lat,nrm,w){if(TRK.n>=TRK.max){const P=TRK.pos.array,U=TRK.uv.array,N=TRK.nor.array,sh=200;P.copyWithin(0,sh*6);U.copyWithin(0,sh*4);N.copyWithin(0,sh*6);TRK.n-=sh}
 const i=TRK.n,P=TRK.pos.array,U=TRK.uv.array,N=TRK.nor.array;for(let s=0;s<2;s++){const k=(i*2+s)*3,sd=s?1:-1;P[k]=p.x+lat.x*w*sd+nrm.x*.03;P[k+1]=p.y+lat.y*w*sd+nrm.y*.03;P[k+2]=p.z+lat.z*w*sd+nrm.z*.03;N[k]=nrm.x;N[k+1]=nrm.y;N[k+2]=nrm.z;U[(i*2+s)*2]=s;U[(i*2+s)*2+1]=TRK.dist*.5}TRK.n++}
function trackFlush(){TRK.pos.needsUpdate=TRK.uv.needsUpdate=TRK.nor.needsUpdate=true;TRK.mesh.geometry.setDrawRange(0,Math.max(0,(TRK.n-1)*6))}

// ================= RIDER: model, procedural animation, physics =================
const RD={root:new THREE.Group(),body:new THREE.Group(),boardG:new THREE.Group(),sm:null,bones:null,rest:null,mats:null,ready:false};
scene.add(RD.root);RD.root.add(RD.body);RD.body.add(RD.boardG);
function buildBoard(){while(RD.boardG.children.length)RD.boardG.remove(RD.boardG.children[0]);const b=boardDef();
 const L=1.56,hw=.135,nw=.148,sh=new THREE.Shape(),N=40;const pts=[];
 for(let i=0;i<=N;i++){const t=i/N,x=-L/2+.16+t*(L-.32),w=hw+(nw-hw)*Math.pow(Math.abs(t*2-1),2);pts.push([x,w])}
 sh.moveTo(pts[0][0],-pts[0][1]);for(const p of pts)sh.lineTo(p[0],-p[1]);
 for(let i=0;i<=12;i++){const a=-PI/2+i/12*PI;sh.lineTo(L/2-.16+Math.cos(a)*.16,Math.sin(a)*nw)}
 for(let i=pts.length-1;i>=0;i--)sh.lineTo(pts[i][0],pts[i][1]);
 for(let i=0;i<=12;i++){const a=PI/2+i/12*PI;sh.lineTo(-L/2+.16+Math.cos(a)*.16,Math.sin(a)*nw)}
 const g=new THREE.ExtrudeGeometry(sh,{depth:.016,bevelEnabled:true,bevelThickness:.004,bevelSize:.004,bevelSegments:1,curveSegments:4});
 g.rotateX(-PI/2);const P=g.attributes.position;for(let i=0;i<P.count;i++){const x=P.getX(i),ax=Math.abs(x)-.6;if(ax>0)P.setY(i,P.getY(i)+ax*ax*1.5)}g.computeVertexNormals();
 const uv=g.attributes.uv;for(let i=0;i<uv.count;i++){uv.setXY(i,(uv.getX(i)+L/2)/L,(uv.getY(i)+nw)/(2*nw))}
 const top=new THREE.MeshStandardMaterial({map:TX.boardTop(b),roughness:.35,metalness:.1,envMapIntensity:.8}),edge=new THREE.MeshStandardMaterial({color:0x222428,roughness:.3,metalness:.8});
 const m=new THREE.Mesh(g,[top,edge]);m.castShadow=true;m.position.y=.005;RD.boardG.add(m);
 // bindings: base plate, highback, straps
 const bm=new THREE.MeshStandardMaterial({color:0x15161a,roughness:.5,metalness:.2}),am=new THREE.MeshStandardMaterial({color:b.acc,roughness:.4,metalness:.3});
 for(const fx of[.25,-.25]){const ang=fx>0?.26:-.1,bg=new THREE.Group();bg.position.set(fx,.024,0);bg.rotation.y=-ang;RD.boardG.add(bg);
  const base=new THREE.Mesh(new THREE.BoxGeometry(.13,.02,.26),bm);bg.add(base);const hb=new THREE.Mesh(new THREE.BoxGeometry(.12,.17,.02),bm);hb.position.set(0,.09,-.13);hb.rotation.x=-.2;bg.add(hb);
  for(const z of[-.03,.07]){const st=new THREE.Mesh(new THREE.BoxGeometry(.15,.035,.05),am);st.position.set(0,.09-z*.3,z);bg.add(st)}bg.traverse(o=>{if(o.isMesh)o.castShadow=true})}}
function riderMats(){const o=outfitDef(),std=p=>new THREE.MeshStandardMaterial(Object.assign({vertexColors:true,skinning:true},p));
 return[std({color:o.jacket,roughness:.62,metalness:0,envMapIntensity:.5}),std({color:o.helmet,roughness:.28,metalness:.05,envMapIntensity:1}),
  std({color:0xff9a3a,roughness:.07,metalness:1,envMapIntensity:1.1,emissive:0x1a0800}),std({color:o.pants,roughness:.85,metalness:0,envMapIntensity:.35}),std({color:0xffffff,roughness:.7,metalness:0,envMapIntensity:.3})]}
function buildRider(){const meta=MOD.meta.rider,geo=MOD.geo.rider;if(!geo)return;if(RD.sm){RD.body.remove(RD.sm);}
 const bones=meta.bones.map(()=>new THREE.Bone());meta.bones.forEach((b,i)=>{const pp=b.parent>=0?meta.bones[b.parent].p:[0,0,0];bones[i].position.set(b.p[0]-pp[0],b.p[1]-pp[1],b.p[2]-pp[2]);if(b.parent>=0)bones[b.parent].add(bones[i])});
 RD.mats=riderMats();const sm=new THREE.SkinnedMesh(geo,RD.mats);sm.add(bones[0]);sm.updateMatrixWorld(true);sm.bind(new THREE.Skeleton(bones));sm.castShadow=true;sm.receiveShadow=true;sm.frustumCulled=false;
 RD.body.add(sm);RD.sm=sm;RD.bones=bones;RD.rest=bones.map(b=>b.position.clone());RD.J=meta.J;RD.ready=true;
 const J=meta.J,v=a=>new THREE.Vector3(a[0],a[1],a[2]);
 RD.leg={R:{hp:v(J.hpR),kn:v(J.knR),an:v(J.anR),b:[11,12,13],pole:new THREE.Vector3(-.25,0,1)},L:{hp:v(J.hpL),kn:v(J.knL),an:v(J.anL),b:[14,15,16],pole:new THREE.Vector3(.25,0,1)}};
 RD.arm={R:{sh:v(J.shR),el:v(J.elR),wr:v(J.wrR),b:[5,6,7],pole:new THREE.Vector3(0,-.3,-1)},L:{sh:v(J.shL),el:v(J.elL),wr:v(J.wrL),b:[8,9,10],pole:new THREE.Vector3(0,-.3,-1)}};
 RD.hips0=v(J.hips)}
function refreshLook(){if(RD.ready){const m=riderMats();RD.sm.material=m;RD.mats=m}buildBoard()}
// ---- two-bone IK (all vectors in the space of the chain's parent bone) ----
const _a=new THREE.Vector3(),_b=new THREE.Vector3(),_k=new THREE.Vector3(),_p=new THREE.Vector3(),_d=new THREE.Vector3(),_qa=new THREE.Quaternion(),_qb=new THREE.Quaternion(),_qi=new THREE.Quaternion();
function ik2(root,mid,end,target,pole,b1,b2,qParent,out){// root/mid/end rest positions; returns knee pos in out
 const l1=root.distanceTo(mid),l2=mid.distanceTo(end);_d.subVectors(target,root);let d=_d.length();d=clamp(d,Math.abs(l1-l2)+1e-3,l1+l2-1e-3);_d.normalize();
 const x=(l1*l1-l2*l2+d*d)/(2*d),h=Math.sqrt(Math.max(0,l1*l1-x*x));_p.copy(pole).addScaledVector(_d,-pole.dot(_d)).normalize();
 _k.copy(root).addScaledVector(_d,x).addScaledVector(_p,h);if(out)out.copy(_k);
 const tgt=_b.copy(root).addScaledVector(_d,d);
 _a.subVectors(mid,root).normalize();_qa.setFromUnitVectors(_a,_b.subVectors(_k,root).normalize());b1.quaternion.copy(_qa);
 _a.subVectors(end,mid).normalize();_b.subVectors(tgt.copy(root).addScaledVector(_d,d),_k).normalize();_qi.copy(_qa).invert();_b.applyQuaternion(_qi);_qb.setFromUnitVectors(_a,_b);b2.quaternion.copy(_qb);
 return _qa}
const _t=new THREE.Vector3(),_hq=new THREE.Quaternion(),_e1=new THREE.Euler(),_q3=new THREE.Quaternion();
// pose parameters, smoothed every frame
const POSE={style:1,crouch:0,lean:0,twist:0,look:.95,armL:0,armR:0,grab:0,grabType:0,tuck:0,flail:0,wob:0,brake:0,arms:0};
function poseRider(dt,t){if(!RD.ready)return;const B=RD.bones,P=POSE;
 for(let i=0;i<B.length;i++){B[i].position.copy(RD.rest[i]);B[i].quaternion.identity()}
 const c=P.crouch,hipDrop=c*.17+P.tuck*.1+P.grab*.5;
 B[0].position.y-=hipDrop;B[0].position.z+=P.lean*.08-c*.02;B[0].rotation.set(P.lean*.12,P.twist*.25,0);
 // legs: feet stay planted on the bindings
 _hq.copy(B[0].quaternion).invert();
 for(const n of['R','L']){const L=RD.leg[n],tgt=_t.copy(L.an).sub(RD.hips0).sub(_a.set(B[0].position.x-RD.rest[0].x,B[0].position.y-RD.rest[0].y,B[0].position.z-RD.rest[0].z)).applyQuaternion(_hq);
  const hp=_b.copy(L.hp).sub(RD.hips0),kn=_p.copy(L.kn).sub(RD.hips0),an=_d.copy(L.an).sub(RD.hips0);
  const hpv=hp.clone(),knv=kn.clone(),anv=an.clone();ik2(hpv,knv,anv,tgt,L.pole,B[L.b[0]],B[L.b[1]]);
  _q3.copy(B[0].quaternion).multiply(B[L.b[0]].quaternion).multiply(B[L.b[1]].quaternion).invert();B[L.b[2]].quaternion.copy(_q3)}
 // torso: loose and a little hunched, shoulders opened toward the nose, head watching the line
 const sw=Math.abs(P.style),fw=P.lean*.3+c*.2+P.tuck*.42+.04*sw+P.grab*.66,br=Math.sin(t*1.6)*.015;
 B[0].rotation.y+=.14*sw;
 B[1].rotation.set(fw*.5+br,P.twist*.3+.08*sw,P.wob*.04);B[2].rotation.set(fw*.5,P.twist*.45+.26*sw,-P.wob*.06+.04*sw);
 B[3].rotation.set(-fw*.35+.05,P.look*.3,0);B[4].rotation.set(-fw*.3+.14-P.tuck*.1,P.look*.55,-.06*sw);
 // arms hang relaxed; they swing gently with the carve, tuck in for speed
 const ab=P.arms,cv=P.twist,sl=Math.sin(t*1.3)*.03,sr=Math.sin(t*1.1+1.4)*.03;
 B[8].rotation.set(-.12*ab-P.tuck*.95+sl-Math.max(0,-cv)*.25,0,.24*ab-P.armL+Math.max(0,cv)*.18);B[9].rotation.set(-.45*ab-.45*P.tuck,0,.12);
 B[5].rotation.set(.12*ab-P.tuck*.8+sr+Math.max(0,cv)*.22,0,-.2*ab+P.armR-Math.max(0,-cv)*.15);B[6].rotation.set(-.35*ab-.4*P.tuck,0,-.1);
 if(P.flail>0){const f=P.flail;B[5].rotation.z+=Math.sin(t*13)*1.2*f;B[8].rotation.z+=Math.sin(t*11+2)*1.2*f;B[6].rotation.x+=Math.sin(t*9)*.8*f;B[9].rotation.x+=Math.cos(t*10)*.8*f;B[4].rotation.x+=Math.sin(t*7)*.3*f}
 if(P.grab>.01){// reach toward a point on the board with the chosen hand
  const g=P.grab,side=P.grabType;// 0 indy (back hand, toe edge) 1 melon (front hand, heel edge) 2 nose 3 tail
  const n=side===1||side===2?'L':'R',A=RD.arm[n];const target=side===0?_t.set(-.02,.06,.17):side===1?_t.set(.05,.06,-.16):side===2?_t.set(.66,.12,0):_t.set(-.66,.12,0);
  B[0].updateMatrixWorld(true);const chest=B[2];chest.updateMatrixWorld(true);
  // target into chest space
  const tw=target.clone();RD.body.localToWorld(tw);const tl=chest.worldToLocal(tw);
  const sh=_a.copy(A.sh).sub(new THREE.Vector3(...RD.J.chest)),el=_b.copy(A.el).sub(new THREE.Vector3(...RD.J.chest)),wr=_p.copy(A.wr).sub(new THREE.Vector3(...RD.J.chest));
  const s0=sh.clone(),e0=el.clone(),w0=wr.clone();const qs=B[A.b[0]].quaternion.clone(),qe=B[A.b[1]].quaternion.clone();
  ik2(s0,e0,w0,tl,A.pole,B[A.b[0]],B[A.b[1]]);B[A.b[0]].quaternion.slerp(qs,1-g);B[A.b[1]].quaternion.slerp(qe,1-g)}
 // a grab pulls the board up to the hand rather than dropping the body down to the board
 RD.body.position.y+=P.grab*.38}
// ================= PHYSICS =================
const PH={pos:new THREE.Vector3(),vel:new THREE.Vector3(),n:new THREE.Vector3(0,1,0),psi:0,ground:true,air:0,spin:0,flip:0,spinV:0,flipV:0,charge:0,edge:0,steer:0,crash:0,crashAx:new THREE.Vector3(),crashRot:new THREE.Quaternion(),
 boost:0,boosting:false,grabT:0,grabType:0,takeoffPsi:0,maxH:0,takeoffY:0,lastLand:0,top:0,airMax:0,switch:false,brake:0,skid:0,tuck:0,impact:0,lean:0,yawVis:0,wob:0};
const G9=9.81,_g=new THREE.Vector3(0,-G9,0),_dir=new THREE.Vector3(),_lat=new THREE.Vector3(),_tmp=new THREE.Vector3(),_n2=new THREE.Vector3();
function phReset(s,u){const x=cx(s)+(u||0);PH.pos.set(x,heightS(x,s),-s);PH.vel.set(0,0,-4);PH.psi=0;PH.ground=true;PH.air=0;PH.spin=PH.flip=PH.spinV=PH.flipV=0;PH.crash=0;PH.boost=.35;PH.charge=0;PH.edge=PH.steer=0;PH.grabT=0;PH.top=0;PH.switch=false;PH.tuck=0;PH.impact=0;PH.lean=0;fieldN(x,s,PH.n)}
function boardAxis(out){return out.set(Math.sin(PH.psi),0,-Math.cos(PH.psi))}
function physics(dt,inp,ev){const b=boardDef(),p=PH.pos,v=PH.vel;const s=-p.z;
 if(PH.crash>0){// tumbling: slide down the slope, losing speed
  PH.crash-=dt;fieldN(p.x,s,PH.n);_tmp.copy(_g).addScaledVector(PH.n,-_g.dot(PH.n));v.addScaledVector(_tmp,dt*.5);v.multiplyScalar(Math.exp(-2.4*dt));
  p.addScaledVector(v,dt);const h=heightS(p.x,-p.z);if(p.y<h){p.y=h;const vn=v.dot(PH.n);if(vn<0)v.addScaledVector(PH.n,-vn)}else v.y-=G9*dt;
  if(PH.crash<=0){PH.crash=0;PH.ground=true;p.y=heightS(p.x,-p.z);const sp=Math.hypot(v.x,v.z);PH.psi=sp>.5?Math.atan2(v.x,-v.z):0;PH.spin=PH.flip=0;ev.recover=1}
  return}
 // steering input smoothing
 PH.steer=damp(PH.steer,inp.x,inp.x?9:12,dt);
 if(PH.ground){
  fieldN(p.x,s,PH.n);const n=PH.n;
  boardAxis(_dir);_dir.addScaledVector(n,-_dir.dot(n)).normalize();let fwd=v.dot(_dir);PH.switch=fwd<0;if(fwd<0)_dir.negate(),fwd=-fwd;
  _lat.crossVectors(n,_dir).normalize();
  // gravity along the slope
  _tmp.copy(_g).addScaledVector(n,-_g.dot(n));v.addScaledVector(_tmp,dt);
  // decompose
  let vl=v.dot(_dir),vt=v.dot(_lat);const sp0=Math.hypot(vl,vt);
  const brake=inp.y>.3?inp.y:0;PH.brake=damp(PH.brake,brake,8,dt);PH.tuck=damp(PH.tuck,inp.y<-.3&&!PH.charge?1:0,5,dt);
  const grip=(9.5*b.grip)*(1-PH.brake*.55);const vt2=vt*Math.exp(-grip*dt);
  vl=Math.sign(vl||1)*Math.sqrt(Math.max(0,vl*vl+(vt*vt-vt2*vt2)*.86));vt=vt2;
  // friction, drag, braking, boost
  const cosT=n.y,sp=Math.hypot(vl,vt);let dec=.04*G9*cosT+(.0062-.0026*PH.tuck)*sp*sp/(b.top*b.top)+PH.brake*7.5;
  PH.boosting=inp.boost&&PH.boost>.02&&!PH.brake;if(PH.boosting){PH.boost=Math.max(0,PH.boost-dt*.28);vl+=Math.sign(vl||1)*6.5*dt*(sp<40?1:0)}
  const nv=Math.max(0,sp-dec*dt),k=sp>1e-4?nv/sp:0;vl*=k;vt*=k;
  v.copy(_dir).multiplyScalar(vl).addScaledVector(_lat,vt);
  // steering: tighter at low speed; carving tilts the rider into the turn
  const spd=Math.abs(vl),rate=(2.5*b.grip)/(1+spd*.045)*(1+PH.brake*.6);PH.psi+=PH.steer*rate*dt;
  if(spd<1.2&&!inp.x)PH.psi=lerp(PH.psi,PH.psi+wrapA(Math.atan2(-(cx(s+5)-cx(s))/5,1)-PH.psi),dt*.4);
  PH.lean=damp(PH.lean,clamp(PH.steer*rate*spd/G9*.9,-.85,.85),10,dt);PH.skid=Math.abs(vt);
  // jump charging
  if(inp.jump){PH.charge=Math.min(1,PH.charge+dt*2.2)}
  else if(PH.charge>0){const pop=(3.4+PH.charge*3.2)*b.pop;v.addScaledVector(n,pop);PH.ground=false;PH.air=0;PH.charge=0;ev.jump=pop;startAir()}
  // move and keep contact
  p.addScaledVector(v,dt);
  if(PH.ground){const h=heightS(p.x,-p.z),gap=p.y-h;fieldN(p.x,-p.z,_n2);
   const thr=.5*G9*_n2.y*dt*dt*1.6+.004;
   if(gap>thr&&v.dot(_n2)>-.2){PH.ground=false;PH.air=0;startAir();ev.lift=1}
   else{p.y=h;const vn=v.dot(_n2);if(vn<0)v.addScaledVector(_n2,-vn)}}
  PH.top=Math.max(PH.top,v.length())}
 else{// airborne
  PH.air+=dt;v.addScaledVector(_g,dt);const sp=v.length();v.multiplyScalar(1-.0018*sp*dt);
  const sr=8.2*b.spin,fr=6.6*b.spin;PH.spinV=damp(PH.spinV,inp.x*sr,7,dt);const fl=save.set.invert?-inp.y:inp.y;PH.flipV=damp(PH.flipV,PH.air>.12?-fl*fr:0,6,dt);
  // gentle auto-straighten when not spinning, so near-misses land
  if(!inp.x&&PH.air>.25){const tgt=Math.round(PH.spin/PI)*PI,e=tgt-PH.spin;if(Math.abs(e)<.5)PH.spinV+=e*6*dt*60*.05}
  if(!inp.y&&PH.air>.25){const tgt=Math.round(PH.flip/TAU)*TAU,e=tgt-PH.flip;if(Math.abs(e)<.6)PH.flipV+=e*5*dt*60*.05}
  PH.spin+=PH.spinV*dt;PH.flip+=PH.flipV*dt;
  if(inp.boost&&PH.air>.08){PH.grabT+=dt;if(PH.grabT<dt*1.5)PH.grabType=inp.x<-.3?2:inp.x>.3?3:inp.y>.3?1:0}
  else if(PH.grabT>0)PH.grabT=-Math.abs(PH.grabT);// released
  p.addScaledVector(v,dt);PH.maxH=Math.max(PH.maxH,p.y-heightS(p.x,-p.z));
  const h=heightS(p.x,-p.z);if(p.y<=h){p.y=h;land(ev)}}}
function startAir(){PH.spin=0;PH.flip=0;PH.spinV=0;PH.flipV=0;PH.grabT=0;PH.maxH=0;PH.takeoffPsi=PH.psi;PH.takeoffY=PH.pos.y;PH.charge=0}
function land(ev){const v=PH.vel,s=-PH.pos.z;fieldN(PH.pos.x,s,PH.n);const n=PH.n;
 const vn=-v.dot(n);v.addScaledVector(n,vn);// keep only the along-slope part
 const sp=Math.hypot(v.x,v.z),vpsi=sp>.5?Math.atan2(v.x,-v.z):PH.psi;
 const yaw=PH.takeoffPsi+PH.spin,ali=Math.abs(wrapA((yaw-vpsi)*2))/2,flipR=Math.abs(wrapA(PH.flip));
 const grabbed=Math.abs(PH.grabT)>.18,stillGrab=PH.grabT>0;
 const ok=ali<.62&&flipR<.95&&vn<17&&!stillGrab;
 PH.ground=true;PH.psi=yaw;PH.impact=clamp(vn/10,0,1.2);
 ev.land={ok,sketch:ali>.38||flipR>.6,air:PH.air,spin:PH.spin,flip:PH.flip,grab:grabbed?Math.abs(PH.grabT):0,grabType:PH.grabType,height:PH.maxH,vn,switch:Math.abs(wrapA(yaw-vpsi))>PI/2};
 if(ok){v.multiplyScalar(1-clamp(vn*.012,0,.25)-(ev.land.sketch?.12:0));const al=Math.round((yaw-vpsi)/PI)*PI;PH.psi=vpsi+al}
 else crash(.8);
 PH.spin=PH.flip=PH.spinV=PH.flipV=0;PH.grabT=0;PH.air=0}
function crash(sev,bounce){if(PH.crash>0)return;PH.crash=1.35+sev*.5;PH.ground=true;PH.crashAx.set(rr(-1,1),rr(-.4,.4),rr(-1,1)).normalize();PH.flip=PH.spin=0;
 if(bounce){PH.vel.multiplyScalar(-.15);PH.vel.addScaledVector(bounce,2.5)}else PH.vel.multiplyScalar(.55);PH.charge=0;PH.grabT=0;PH.boosting=false;PH.crashSev=sev}

// ================= GAME RULES: scoring, tricks, obstacles, gates, avalanche =================
const G={mode:'menu',run:null,t:0,paused:false};
function newRunState(kind){return{kind,t:0,score:0,dist:0,s0:0,mult:1,comboT:0,tricks:0,best:{pts:0,name:''},top:0,airTotal:0,gates:0,gatesSeen:0,nears:0,crashes:0,
 av:{on:kind==='avalanche',s:-140,v:0,start:3.5,warned:false},lastS:0,over:false,overT:0,cause:'',gateIdx:0,msgCool:0}}
const GRAB=['Indy','Melon','Nose grab','Tail grab'];
function trickName(L){const parts=[];const sp=Math.round(Math.abs(L.spin)/PI)*180,fl=Math.round(Math.abs(L.flip)/TAU);
 if(fl>0)parts.push((fl===2?'Double ':fl>=3?'Triple ':'')+(L.flip>0?'Frontflip':'Backflip'));
 if(sp>=180)parts.unshift((L.spin>0?'Frontside ':'Backside ')+sp);
 if(L.grab>0)parts.push(GRAB[L.grabType]);
 if(!parts.length)parts.push(L.height>4?'Huge air':L.height>2?'Big air':'Air');
 let name=parts.join(' ');if(L.switch&&sp>=180&&(sp/180)%2===1)name+=' to switch';return{name,sp,fl}}
function trickPoints(L,tn){let p=0;p+=tn.sp/180*110*(tn.sp>=720?1.4:1);p+=tn.fl*650;if(L.grab>0)p+=150+Math.min(900,L.grab*420);
 p+=Math.max(0,L.air-.45)*90+Math.max(0,L.height-1.8)*35;if(tn.sp&&tn.fl)p*=1.25;if(L.sketch)p*=.5;return Math.round(p/10)*10}
function addScore(pts,label,big){const r=G.run;if(!r)return;const m=r.mult;r.score+=pts*m;r.comboT=4.5;r.mult=Math.min(10,r.mult+(big?2:1));if(r.mult>m)sfx('combo',r.mult);
 HUDpop(label,pts,m,big);PH.boost=Math.min(1,PH.boost+Math.min(.45,pts/2600)+.03)}
function gameEvents(ev,dt){const r=G.run;if(!r)return;
 if(ev.jump)sfx('jump',clamp(ev.jump/6,.5,1.2));
 if(ev.land){const L=ev.land;
  if(L.ok){sfx('land',clamp(L.vn/9,.25,1.2));const big=L.air>.55||L.height>1.4;r.airTotal+=L.air;
   if(big){const tn=trickName(L),pts=trickPoints(L,tn);if(pts>=60){addScore(pts,tn.name+(L.sketch?' (sketchy)':''),pts>900);sfx('trick',(tn.sp/180|0)+tn.fl*2+(L.grab?1:0));if(pts>r.best.pts)r.best={pts,name:tn.name}}}
   CAM.shake=Math.max(CAM.shake,clamp(L.vn/14,0,.5));const p=PH.pos;spray(p.x,p.y,p.z,PH.vel.x*.4,1,PH.vel.z*.4,Math.min(60,12+L.vn*5|0),3+L.vn*.3,.5)}
  else crashed('Wiped out on the landing')}
 if(ev.recover){r.mult=1;r.comboT=0}
}
function crashed(why){const r=G.run;r.crashes++;r.mult=1;r.comboT=0;sfx('crash');CAM.shake=.9;HUDmsg(why,1.4,'bad');const p=PH.pos;spray(p.x,p.y+.3,p.z,PH.vel.x*.3,2,PH.vel.z*.3,90,5,.8,1.4)}
// obstacles, gates and near misses
const _bn=new THREE.Vector3();
function checkProps(dt){const p=PH.pos,r=G.run,sp=PH.vel.length();if(PH.crash>0)return;
 nearProps(p.x,p.z,4,pr=>{const dx=p.x-pr.x,dz=p.z-pr.z,d=Math.hypot(dx,dz),rad=pr.rad;
  const above=p.y-pr.y;if(above>pr.h*(pr.t.startsWith('rock')?.82:.97))return;
  if(pr.t==='pole'){if(d<rad+.25&&!pr.hit){pr.hit=1;PH.vel.multiplyScalar(.85);sfx('whoosh');HUDmsg('Clipped a flag',1,'')}return}
  if(d<rad+.3){_bn.set(dx/(d||1),0,dz/(d||1));crash(1,_bn);crashed(pr.t.startsWith('rock')?'Hit a rock':'Hit a tree');return}
  if(r&&d<rad+1.7&&sp>12&&!pr.nm){pr.nm=1;r.nears++;sfx('near');addScore(100,'Close call',false)}})}
function checkGates(){const r=G.run;if(!r)return;const s=-PH.pos.z;
 for(const f of TER.feats){if(f.t!=='gate'||f.done)continue;if(f.s>s)break;if(f.s<r.lastS-1){f.done=1;continue}
  f.done=1;r.gatesSeen++;const u=PH.pos.x-cx(f.s);if(Math.abs(u-f.u)<=f.gap/2+.3&&PH.crash<=0){r.gates++;sfx('gate');PH.boost=Math.min(1,PH.boost+.22);addScore(250,'Gate',false)}else HUDmsg('Missed the gate',1.1,'')}}
function updateAvalanche(dt){const r=G.run,a=r.av;if(!a.on)return 0;const s=-PH.pos.z;
 if(r.t<a.start){a.s=Math.min(a.s,s-140);return 999}
 if(!a.warned){a.warned=true;HUDmsg('Avalanche! Keep moving',2.4,'warn');sfx('warn')}
 const tt=r.t-a.start;a.v=Math.min(32,12+tt*.12);a.s+=a.v*dt;const gap=s-a.s;if(gap>230)a.s=s-230;
 if(gap<0&&!r.over){endRun('Caught by the avalanche')}
 // billowing front
 const near=gap<320,n=near?Math.round((gap<120?26:12)*dt*60/2):0;
 for(let i=0;i<n;i++){const ss=a.s+rr(-6,3),W=halfW(ss)+14,x=cx(ss)+rr(-W,W),y=heightS(x,ss);
  AVA.emit(x,y+rr(0,6)+R()*R()*16,-ss,rr(-2,2),rr(2,7),-a.v*rr(.6,1.05),rr(2.2,3.6),rr(6,10),rr(18,32),snowTint.r*.96,snowTint.g*.97,snowTint.b,rr(.55,.85),.35,-.6)}
 return gap}
function endRun(cause){const r=G.run;if(r.over)return;r.over=true;r.cause=cause;r.overT=0;sfx('crash');PH.crash=0;if(cause.includes('avalanche')){PP.comp.uniforms.white.value=.0}
 const credits=Math.floor(r.score/12+r.dist/4);r.credits=credits;save.credits+=credits;save.runs++;save.totalDist+=r.dist|0;
 r.newBest=r.score>save.best;if(r.newBest)save.best=Math.floor(r.score);if(r.dist>save.bestDist)save.bestDist=Math.floor(r.dist),r.newDist=true;
 if(r.best.pts>save.bestTrick){save.bestTrick=r.best.pts;save.bestTrickName=r.best.name}store();
 setTimeout(()=>{if(G.run===r)showResults(r)},cause.includes('avalanche')?2200:300)}
function updateRun(dt){const r=G.run;if(!r||r.over)return;r.t+=dt;const s=-PH.pos.z;
 r.dist=Math.max(r.dist,s-r.s0);r.top=Math.max(r.top,PH.vel.length());
 // distance points
 const ds=Math.max(0,s-r.lastS);r.score+=ds;r.lastS=Math.max(r.lastS,s);
 if(PH.ground&&PH.crash<=0)r.comboT-=dt;if(r.comboT<=0&&r.mult>1){r.mult=1}
 checkProps(dt);checkGates();
 // coaching for the first features
 if(!r.coachJ){for(const f of TER.feats){if(f.s<s)continue;if(f.s>s+40)break;if(f.t==='kick'&&f.s-s>18){r.coachJ=1;HUDhint(isTouch?'Jump ahead: hold JUMP, let go at the lip':'Jump ahead: hold Space, let go at the lip',3.5);break}}}
 if(!r.coachA&&!PH.ground&&PH.air>.35){r.coachA=1;HUDhint(isTouch?'In the air: ◀ ▶ spin · ▲ ▼ flip · GRAB':'In the air: A / D spin · W / S flip · Shift grab',3.5)}
 {const d=TER.drops.find(d=>!d.warned&&d.s>s+20&&d.s<s+45);if(d){d.warned=1;HUDmsg('Cliff drop ahead',1.8,'warn')}}
 return updateAvalanche(dt)}

// ================= INPUT =================
const KEYS={};const TOUCH={};const INP={x:0,y:0,jump:false,boost:false};
const isTouch=matchMedia('(hover: none) and (pointer: coarse)').matches;
addEventListener('keydown',e=>{if(e.repeat&&KEYS[e.code])return;KEYS[e.code]=true;audioInit();
 if(e.code==='Escape'||e.code==='KeyP'){if(G.mode==='play'&&!G.run.over)togglePause();else if(G.mode==='paused')togglePause()}
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)&&G.mode==='play')e.preventDefault()});
addEventListener('keyup',e=>{KEYS[e.code]=false});
addEventListener('blur',()=>{for(const k in KEYS)KEYS[k]=false;if(G.mode==='play'&&!G.run.over)togglePause()});
function readInput(){const k=KEYS;let x=(k.KeyD||k.ArrowRight?1:0)-(k.KeyA||k.ArrowLeft?1:0),y=(k.KeyS||k.ArrowDown?1:0)-(k.KeyW||k.ArrowUp?1:0);
 let jump=!!k.Space,boost=!!(k.ShiftLeft||k.ShiftRight);
 x+=(TOUCH.right?1:0)-(TOUCH.left?1:0);y+=(TOUCH.down?1:0)-(TOUCH.up?1:0);jump=jump||!!TOUCH.jump;boost=boost||!!TOUCH.boost;
 const pads=navigator.getGamepads?navigator.getGamepads():[];for(const p of pads){if(!p)continue;const ax=p.axes[0]||0,ay=p.axes[1]||0;if(Math.abs(ax)>.2)x+=ax;if(Math.abs(ay)>.35)y+=ay;
  const bt=i=>p.buttons[i]&&p.buttons[i].pressed;if(bt(14))x-=1;if(bt(15))x+=1;if(bt(12))y-=1;if(bt(13))y+=1;if(bt(0))jump=true;if(bt(7)||bt(5)||bt(2))boost=true;if(bt(9)&&!readInput.st&&G.mode!=='menu'){togglePause()}readInput.st=bt(9)}
 INP.x=clamp(x,-1,1);INP.y=clamp(y,-1,1);INP.jump=jump;INP.boost=boost;return INP}
document.querySelectorAll('#touch button').forEach(b=>{const k=b.dataset.k;const on=e=>{e.preventDefault();TOUCH[k]=true;b.classList.add('on');audioInit()},off=e=>{e.preventDefault();TOUCH[k]=false;b.classList.remove('on')};
 b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('pointerleave',off)});
if(isTouch)document.body.classList.add('touch');
// ================= HUD =================
const H={};['hud','score','mult','combo','dist','speed','unit','hAva','avaFill','avaM','hBoost','boostFill','pops','msg','hint','touch'].forEach(i=>H[i]=$(i));
let msgT=0,hintT=0;
function HUDpop(label,pts,m,big){const d=document.createElement('div');d.className='pop'+(big?' big':'');d.textContent=label;const sm=document.createElement('small');sm.textContent='+'+pts.toLocaleString()+(m>1?' ×'+m:'');d.appendChild(sm);H.pops.appendChild(d);while(H.pops.children.length>3)H.pops.firstChild.remove();setTimeout(()=>d.remove(),1900)}
function HUDmsg(t,dur,cls){H.msg.textContent=t;H.msg.className='on '+(cls||'');msgT=dur||1.5}
function HUDhint(t,dur){H.hint.textContent=t;H.hint.className='on';hintT=dur||4}
const spdK=()=>save.set.units==='mph'?2.237:3.6;
function hudUpdate(dt,gap){const r=G.run;if(!r)return;
 H.score.textContent=Math.floor(r.score).toLocaleString();H.mult.textContent='×'+r.mult;H.combo.style.width=(r.mult>1?clamp(r.comboT/4.5,0,1)*100:0)+'%';
 H.dist.textContent=Math.floor(r.dist).toLocaleString();H.speed.textContent=Math.round(PH.vel.length()*spdK());H.unit.textContent=save.set.units==='mph'?'mph':'km/h';
 H.hAva.classList.toggle('hide',!r.av.on);if(r.av.on){const g=gap>900?250:gap;H.avaFill.style.transform='scaleX('+clamp(g/250,0,1)+')';H.avaM.textContent=gap>900?'—':Math.max(0,Math.floor(g))+' m';H.hAva.classList.toggle('near',g<60)}
 H.boostFill.style.width=PH.boost*100+'%';H.hBoost.classList.toggle('on',PH.boosting);
 if(msgT>0){msgT-=dt;if(msgT<=0)H.msg.className=''}if(hintT>0){hintT-=dt;if(hintT<=0)H.hint.className=''}}
// ================= MENUS =================
const SCREENS=['menu','gear','records','settings','help','pause','results'];let backTo='menu';
function show(id){SCREENS.forEach(s=>$(s).classList.toggle('hide',s!==id));if(id==='menu'){$('credits').textContent=Math.floor(save.credits).toLocaleString()}}
function hideAll(){SCREENS.forEach(s=>$(s).classList.add('hide'))}
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>{sfx('click');if(backTo==='pause'){show('pause')}else show('menu')});
$('bRun').onclick=()=>{audioInit();sfx('start');startRun('avalanche')};$('bFree').onclick=()=>{audioInit();sfx('start');startRun('free')};
$('bGear').onclick=()=>{audioInit();sfx('click');backTo='menu';gearTab='boards';renderGear();show('gear')};
$('bRec').onclick=()=>{audioInit();sfx('click');backTo='menu';renderRecords();show('records')};
$('bSet').onclick=()=>{audioInit();sfx('click');backTo='menu';loadSettings();show('settings')};
$('bHelp').onclick=()=>{audioInit();sfx('click');backTo='menu';show('help')};
$('bResume').onclick=()=>togglePause();$('bRestart').onclick=()=>{hideAll();startRun(G.run.kind)};$('bQuit').onclick=()=>toMenu();
$('bPSet').onclick=()=>{backTo='pause';loadSettings();show('settings')};
$('bAgain').onclick=()=>{sfx('start');startRun(G.run.kind)};$('bMenu2').onclick=()=>toMenu();$('pauseBtn').onclick=()=>togglePause();
let gearTab='boards';
document.querySelectorAll('#gear .tab').forEach(t=>t.onclick=()=>{gearTab=t.dataset.t;document.querySelectorAll('#gear .tab').forEach(x=>x.classList.toggle('on',x===t));renderGear();sfx('click')});
function renderGear(){$('credits2').textContent=Math.floor(save.credits).toLocaleString();const L=$('gearList');L.innerHTML='';
 const items=gearTab==='boards'?BOARDS:OUTFITS,cur=gearTab==='boards'?save.board:save.outfit;
 for(const it of items){const own=save.own.includes(it.id),c=document.createElement('div');c.className='card'+(it.id===cur?' sel':'');
  const sw=document.createElement('div');sw.className='swatch';const col=a=>'#'+new THREE.Color(a).getHexString();
  sw.style.background=gearTab==='boards'?`repeating-linear-gradient(115deg,${col(it.col)} 0 18px,${col(it.acc)} 18px 24px)`:`linear-gradient(90deg,${col(it.jacket)} 0 60%,${col(it.pants)} 60% 85%,${col(it.helmet)} 85%)`;c.appendChild(sw);
  const h=document.createElement('h3');h.textContent=it.name;c.appendChild(h);
  if(it.desc){const p=document.createElement('p');p.textContent=it.desc;c.appendChild(p)}else{const p=document.createElement('p');p.textContent='Jacket, pants and helmet colours.';c.appendChild(p)}
  if(gearTab==='boards')for(const [k,lab] of[['top','Speed'],['grip','Grip'],['spin','Spin'],['pop','Pop']]){const s=document.createElement('div');s.className='stat';s.innerHTML='<span>'+lab+'</span><i style="width:'+Math.round((it[k]-.8)/.55*100)+'%"></i>';c.appendChild(s)}
  const b=document.createElement('button');b.className='btn'+(own&&it.id!==cur?'':' ');
  if(it.id===cur){b.textContent='Equipped';b.disabled=true}else if(own){b.textContent='Equip';b.onclick=()=>{if(gearTab==='boards')save.board=it.id;else save.outfit=it.id;store();refreshLook();renderGear();sfx('click')}}
  else{b.textContent='Unlock for '+it.cost.toLocaleString();b.className='btn primary';if(save.credits<it.cost){b.disabled=true;b.textContent=it.cost.toLocaleString()+' credits'}else b.onclick=()=>{save.credits-=it.cost;save.own.push(it.id);if(gearTab==='boards')save.board=it.id;else save.outfit=it.id;store();refreshLook();renderGear();sfx('buy')}}
  c.appendChild(b);L.appendChild(c)}}
function renderRecords(){const L=$('recList'),u=save.set.units==='mph';const rows=[['Best score',Math.floor(save.best).toLocaleString()],['Longest run',Math.floor(save.bestDist).toLocaleString()+' m'],['Best trick',save.bestTrickName?save.bestTrickName+' ('+save.bestTrick.toLocaleString()+')':'None yet'],['Runs',save.runs],['Distance ridden',(save.totalDist/1000).toFixed(1)+' km'],['Credits',Math.floor(save.credits).toLocaleString()]];
 L.innerHTML='';for(const [a,b] of rows){const dt=document.createElement('dt');dt.textContent=a;const dd=document.createElement('dd');dd.textContent=b;L.appendChild(dt);L.appendChild(dd)}}
function loadSettings(){const s=save.set;$('sMaster').value=s.master;$('sMusic').value=s.music;$('sSfx').value=s.sfx;$('sQ').value=s.q;$('sTod').value=s.tod;$('sUnits').value=s.units;$('sShake').checked=!!s.shake;$('sInvert').checked=!!s.invert}
[['sMaster','master'],['sMusic','music'],['sSfx','sfx']].forEach(([id,k])=>$(id).oninput=e=>{save.set[k]=+e.target.value;setVol();store()});
$('sQ').onchange=e=>{save.set.q=+e.target.value;store();setupPost();applyQuality()};$('sTod').onchange=e=>{save.set.tod=e.target.value;store();if(G.mode==='menu')menuScene()};
$('sUnits').onchange=e=>{save.set.units=e.target.value;store()};$('sShake').onchange=e=>{save.set.shake=e.target.checked?1:0;store()};$('sInvert').onchange=e=>{save.set.invert=e.target.checked?1:0;store()};
function showResults(r){const u=spdK();$('rTitle').textContent=r.newBest?'New best score!':'Run over';$('rCause').textContent=r.cause;
 const rows=[['Score',Math.floor(r.score).toLocaleString()],['Distance',Math.floor(r.dist).toLocaleString()+' m'+(r.newDist?'  (record)':'')],['Top speed',Math.round(r.top*u)+(save.set.units==='mph'?' mph':' km/h')],['Best trick',r.best.name?r.best.name:'—'],['Air time',r.airTotal.toFixed(1)+' s'],['Gates',r.gates+' of '+r.gatesSeen],['Close calls',r.nears],['Crashes',r.crashes]];
 const L=$('rStats');L.innerHTML='';for(const [a,b] of rows){const dt=document.createElement('dt');dt.textContent=a;const dd=document.createElement('dd');dd.textContent=b;L.appendChild(dt);L.appendChild(dd)}
 $('rCred').textContent='+'+r.credits.toLocaleString()+' credits for gear. You have '+Math.floor(save.credits).toLocaleString()+'.';
 G.mode='results';H.hud.classList.add('hide');H.touch.classList.add('hide');show('results')}
function togglePause(){if(G.mode==='play'){G.mode='paused';show('pause');if(AU.ctx)AU.ctx.suspend()}else if(G.mode==='paused'){G.mode='play';hideAll();if(AU.ctx)AU.ctx.resume()}}

// ================= MODEL STREAMING (sculpted in background workers) =================
const MOD={geo:{},meta:{},done:0,total:0,queue:[],busy:new Map(),workers:[],lib:null,cb:[]};
const MORDER=['rider','rock0','rock1','rock2'];
function geoFrom(m,skinned){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(m.nor,3));g.setAttribute('color',new THREE.BufferAttribute(m.col,3));
 if(skinned){g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(m.si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(m.sw,4))}
 g.setIndex(new THREE.BufferAttribute(m.idx,1));m.groups.forEach(([s,c,z])=>{if(c>0)g.addGroup(s,c,z)});g.computeBoundingSphere();g.computeBoundingBox();return g}
function onModel(n,meta,m){MOD.meta[n]=meta;MOD.geo[n]=geoFrom(m,meta.nb>1);MOD.done++;
 if(n==='rider'){buildRider();if(G.mode==='menu')menuIdle()}
 if(n.startsWith('rock'))setRockGeo(+n[4],MOD.geo[n])}
function pumpModels(){for(const w of MOD.workers){if(MOD.busy.has(w)||!MOD.queue.length)continue;const n=MOD.queue.shift();MOD.busy.set(w,n);w.postMessage(n)}}
function mainThreadModels(){if(!MOD.lib)MOD.lib=MODLIB();const step=()=>{if(!MOD.queue.length)return;const n=MOD.queue.shift();try{const spec=MOD.lib.MODELS.list[n](),m=MOD.lib.SDF.build(spec);onModel(n,{bones:spec.bones||null,nb:spec.nb,J:spec.J||null},m)}catch(e){console.error(e)}setTimeout(step,0)};step()}
function startModels(){MOD.queue=MORDER.slice();MOD.total=MOD.queue.length;
 const src='const L=('+MODLIB.toString()+')();onmessage=e=>{const n=e.data;const spec=L.MODELS.list[n]();const m=L.SDF.build(spec);const meta={bones:spec.bones||null,nb:spec.nb,J:spec.J||null};postMessage({n:n,meta:meta,m:m},[m.pos.buffer,m.nor.buffer,m.col.buffer,m.si.buffer,m.sw.buffer,m.idx.buffer])};';
 try{const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'})),nw=clamp((navigator.hardwareConcurrency||4)-1,1,3);
  for(let i=0;i<nw;i++){const w=new Worker(url);w.onmessage=e=>{MOD.busy.delete(w);onModel(e.data.n,e.data.meta,e.data.m);pumpModels()};
   w.onerror=ev=>{ev.preventDefault&&ev.preventDefault();const n=MOD.busy.get(w);MOD.busy.delete(w);MOD.workers=MOD.workers.filter(x=>x!==w);if(n)MOD.queue.unshift(n);try{w.terminate()}catch(e){}if(!MOD.workers.length&&!MOD.fallback){MOD.fallback=1;mainThreadModels()}else pumpModels()};MOD.workers.push(w)}
  pumpModels()}catch(e){MOD.fallback=1;mainThreadModels()}}
// ================= CAMERA =================
const CAM={pos:new THREE.Vector3(),look:new THREE.Vector3(),dir:new THREE.Vector3(0,0,-1),shake:0,fov:68,orbit:0};
const _cd=new THREE.Vector3(),_cl=new THREE.Vector3(),_ct=new THREE.Vector3();
function camFollow(dt,snap){const p=PH.pos,v=PH.vel,sp=Math.hypot(v.x,v.z);
 if(sp>1.5)_cd.set(v.x/sp,0,v.z/sp);else boardAxis(_cd);if(PH.switch&&sp<1.5)_cd.negate();
 CAM.dir.lerp(_cd,snap?1:1-Math.exp(-(PH.ground?3.2:1.4)*dt)).normalize();
 const crash=PH.crash>0,dist=(crash?8.5:5.1)+Math.min(sp,40)*.05,hgt=(crash?3.6:1.85)+Math.min(sp,40)*.018;
 _ct.copy(p).addScaledVector(CAM.dir,-dist);_ct.y=Math.max(p.y,_ct.y)+hgt;
 const gh=heightS(_ct.x,-_ct.z)+1.3;if(_ct.y<gh)_ct.y=gh;
 if(snap)CAM.pos.copy(_ct);else{CAM.pos.x=damp(CAM.pos.x,_ct.x,7,dt);CAM.pos.z=damp(CAM.pos.z,_ct.z,7,dt);CAM.pos.y=damp(CAM.pos.y,_ct.y,PH.ground?6:3.5,dt)}
 const gh2=heightS(CAM.pos.x,-CAM.pos.z)+1.1;if(CAM.pos.y<gh2)CAM.pos.y=gh2;
 _cl.copy(p).addScaledVector(CAM.dir,5).add(_ct.set(0,1.1,0));if(snap)CAM.look.copy(_cl);else CAM.look.lerp(_cl,1-Math.exp(-8*dt));
 const tf=66+clamp(sp-8,0,30)*.62+(PH.boosting?5:0);CAM.fov=damp(CAM.fov,tf,3,dt)}
function camApply(dt,t){if(CAM.hook)CAM.hook();cam.position.copy(CAM.pos);cam.lookAt(CAM.look);
 if(CAM.shake>0&&save.set.shake){const k=CAM.shake*CAM.shake*.35;cam.rotation.x+=(R()-.5)*k*.12;cam.rotation.y+=(R()-.5)*k*.12;cam.position.y+=(R()-.5)*k*.3}CAM.shake=Math.max(0,CAM.shake-dt*1.6);
 if(Math.abs(cam.fov-CAM.fov)>.05){cam.fov=CAM.fov;cam.updateProjectionMatrix();if(PART)PART.forEach(p=>p.mat.uniforms.scale.value=PP.rt.height/(2*Math.tan(cam.fov*PI/360)))}}
// ================= RIDER VISUAL =================
const _bx=new THREE.Vector3(),_by=new THREE.Vector3(),_bz=new THREE.Vector3(),_mb=new THREE.Matrix4(),_qr=new THREE.Quaternion(),_qx=new THREE.Quaternion(),_up=new THREE.Vector3(0,1,0),_ax=new THREE.Vector3(),_upS=new THREE.Vector3(0,1,0);
const VIS={crashQ:new THREE.Quaternion(),impact:0};
function updateRiderVisual(dt,t){const air=!PH.ground;
 _upS.lerp(air?_up:PH.n,1-Math.exp(-(air?2:14)*dt)).normalize();
 const yaw=air?PH.takeoffPsi+PH.spin:PH.psi;_bx.set(Math.sin(yaw),0,-Math.cos(yaw));_bx.addScaledVector(_upS,-_bx.dot(_upS)).normalize();_by.copy(_upS);_bz.crossVectors(_bx,_by).normalize();
 _mb.makeBasis(_bx,_by,_bz);RD.root.quaternion.setFromRotationMatrix(_mb);RD.root.position.copy(PH.pos);
 // edge lean, flips, tumbling
 const lean=(PH.switch?-1:1)*PH.lean*(air?.2:1)-PH.brake*.35*(PH.switch?-1:1);
 RD.body.quaternion.setFromAxisAngle(_ax.set(1,0,0),lean);
 if(air&&PH.flip){_qx.setFromAxisAngle(_ax.set(0,0,1),-PH.flip);RD.body.position.set(0,.85,0);RD.body.quaternion.multiply(_qx);RD.body.position.sub(_ct.set(0,.85,0).applyQuaternion(RD.body.quaternion))}
 else RD.body.position.set(0,0,0);
 if(PH.crash>0){const w=6*Math.min(1,PH.crash);_qx.setFromAxisAngle(PH.crashAx,w*dt);VIS.crashQ.premultiply(_qx);RD.body.quaternion.multiply(VIS.crashQ);RD.body.position.y=.4}
 else VIS.crashQ.slerp(_qr.identity(),1-Math.exp(-10*dt));
 // pose targets
 VIS.impact=Math.max(VIS.impact-dt*2.5,0);if(PH.impact>0){VIS.impact=Math.max(VIS.impact,PH.impact);PH.impact=0}
 const P=POSE,sp=PH.vel.length();
 P.crouch=damp(P.crouch,clamp(PH.charge*.5+VIS.impact*.55+(air?.06:0)+(air&&PH.grabT>0?.5:0)+PH.brake*.15+Math.abs(PH.steer)*.05,0,1),12,dt);
 P.tuck=damp(P.tuck,PH.tuck*(air?0:1),6,dt);P.lean=damp(P.lean,-PH.brake*.8+(air?.15:0),6,dt);P.twist=damp(P.twist,(PH.switch?-1:1)*PH.steer*.5,6,dt);
 P.look=damp(P.look,PH.switch?-1.05:.95,5,dt);P.style=damp(P.style,PH.switch?-1:1,5,dt);P.arms=damp(P.arms,1-P.tuck,6,dt);
 const grabbing=air&&PH.grabT>0;P.grab=damp(P.grab,grabbing?1:0,grabbing?14:8,dt);if(grabbing)P.grabType=PH.grabType;
 P.flail=damp(P.flail,PH.crash>0?1:0,8,dt);P.wob=Math.sin(t*2.3)*.5;
 if(air&&!grabbing){P.armL=Math.sin(PH.air*6)*.15;P.armR=-Math.sin(PH.air*6)*.15}else{P.armL=P.armR=0}
 poseRider(dt,t)}
// ================= RUN FLOW =================
const TODS=['dawn','day','day','golden','golden','storm','dusk'];
function pickTOD(){return save.set.tod!=='random'?save.set.tod:pick(TODS)}
function setWeather(){FL.amount=T.snow?1:(R()<.25?.22:.05);PP.comp.uniforms.white.value=0;
 snowTint.copy(new THREE.Color(T.sun).multiplyScalar(T.sunI*.3)).add(new THREE.Color(T.sky).multiplyScalar(T.hemiI*.95));FL.mat.color.copy(snowTint).multiplyScalar(.85)}
function applyQuality(){const q=save.set.q;TER.AHEAD=q===0?6:q===1?8:10;LOD.R=q===0?55:q===1?78:95;PROPS.dirty=true;if(MAT.snow)MAT.snow.userData.u.spark.value=q===0?.8:1.4;
 ['pineA','pineB','snag'].forEach(n=>{if(PROPS.types[n])PROPS.types[n].im.castShadow=q>0});TER.chunks.forEach(c=>c.mesh.castShadow=q>0)}
function startRun(kind){hideAll();G.run=newRunState(kind);const seed=(Math.random()*1e9)|0;setTOD(pickTOD());terSeed(seed);if(farMts){scene.remove(farMts);farMts.children.forEach(c=>c.geometry.dispose())}buildFarMountains();
 updateChunks(0,true);phReset(3,0);trackReset();SPRAY.clear();AVA.clear();setWeather();camFollow(1/60,true);G.mode='play';G.t=0;
 H.hud.classList.remove('hide');if(isTouch)H.touch.classList.remove('hide');H.pops.innerHTML='';
 HUDhint(isTouch?'Steer with ◀ ▶, hold JUMP and let go to jump':'A / D to carve · W to tuck · hold Space and let go to jump',5);
 HUDmsg(kind==='avalanche'?'Drop in!':'Free ride',1.4,'');Music.set(.4)}
function toMenu(){G.mode='menu';G.run=null;H.hud.classList.add('hide');H.touch.classList.add('hide');menuScene();show('menu');if(AU.ctx&&AU.ctx.state==='suspended')AU.ctx.resume();Music.set(.05)}
function menuScene(){setTOD(save.set.tod!=='random'?save.set.tod:'golden');terSeed(5150);if(farMts){scene.remove(farMts);farMts.children.forEach(c=>c.geometry.dispose())}buildFarMountains();updateChunks(0,true);phReset(10,-3);PH.vel.set(0,0,0);PH.psi=-.5;trackReset();SPRAY.clear();AVA.clear();setWeather();FL.amount=Math.max(FL.amount,.08);menuIdle()}
function menuIdle(){if(!RD.ready)return;POSE.crouch=.03;POSE.look=.95}
// ================= MAIN LOOP =================
let last=performance.now(),acc=0,frameT=0;const EV={};
function loop(now){requestAnimationFrame(loop);let dt=Math.min(.05,(now-last)/1000);last=now;frameT+=dt;const t=frameT;
 try{step(dt,t)}catch(e){console.error(e);const b=$('err');b.className='';b.textContent='Something went wrong: '+e.message}}
let FORCE=null;
function step(dt,t,norender){let gap=999;
 if(G.mode==='play'||G.mode==='results'){const r=G.run;const inp=FORCE||(G.mode==='play'&&!r.over?readInput():{x:0,y:0,jump:false,boost:false});
  if(G.mode==='play'){const n=Math.ceil(dt/(1/120)),h=dt/n;for(const k in EV)delete EV[k];for(let i=0;i<n;i++){const ev={};physics(h,inp,ev);gameEvents(ev,h);if(ev.land&&!ev.land.ok)break}
   gap=updateRun(dt);G.t+=dt}
  else{PH.vel.multiplyScalar(Math.exp(-1.5*dt))}
  rideFX(dt,inp,gap);updateRiderVisual(dt,t);camFollow(dt);
  if(r.over&&r.cause.includes('avalanche')){r.overT+=dt;PP.comp.uniforms.white.value=clamp(r.overT/1.6,0,.96);CAM.shake=Math.max(CAM.shake,.6)}
  hudUpdate(dt,gap)}
 else if(G.mode==='menu'){CAM.orbit+=dt*.06;const p=PH.pos,a=CAM.orbit;CAM.pos.set(p.x+Math.sin(a)*7.5,p.y+2.2+Math.sin(a*.7)*.6,p.z+Math.cos(a)*7.5);const gh=heightS(CAM.pos.x,-CAM.pos.z)+1;if(CAM.pos.y<gh)CAM.pos.y=gh;CAM.look.set(p.x,p.y+1.1,p.z);CAM.fov=damp(CAM.fov,55,2,dt);
  PH.ground=true;fieldN(p.x,-p.z,PH.n);updateRiderVisual(dt,t);loopSet('wind',.04,300);['carve','hiss','rumble'].forEach(n=>loopSet(n,0));loopSet('sub',0);
  const lf=$('loadFill');if(lf){const pct=MOD.total?MOD.done/MOD.total:0;lf.style.width=pct*100+'%';const ok=!!MOD.geo.rider;$('bRun').disabled=$('bFree').disabled=!ok;$('load').classList.toggle('hide',MOD.done>=MOD.total)}}
 // world
 const s=-PH.pos.z;updateChunks(s,false);
 sky.position.copy(cam.position);skyU.camPos.value.copy(cam.position);skyU.time.value=t;
 if(farMts)farMts.position.copy(cam.position);
 sun.position.copy(PH.pos).addScaledVector(sunVec,140);sun.target.position.copy(PH.pos);
 if(MAT.snow){const u=MAT.snow.userData.u;u.sunView.value.copy(sunVec).transformDirection(cam.matrixWorldInverse);u.sunCol.value.copy(sun.color).multiplyScalar(sun.intensity)}
 if(MAT.tree)MAT.tree.userData.u.time.value=t;if(MAT.treeCard)MAT.treeCard.userData.u.time.value=t;
 updateFlakes(t,_ct.set(T.snow?3:.6,0,T.snow?-1:0));SPRAY.update(dt);AVA.update(dt);
 camApply(dt,t);if(!norender)renderFrame()}
function sim(sec,inp,dt){dt=dt||1/60;FORCE=inp;const n=Math.round(sec/dt);for(let i=0;i<n;i++){frameT+=dt;step(dt,frameT,true)}FORCE=null}
const _sl=new THREE.Vector3(),_sp=new THREE.Vector3();
function rideFX(dt,inp,gap){const p=PH.pos,v=PH.vel,sp=v.length(),on=PH.ground&&PH.crash<=0;
 boardAxis(_dir);_dir.addScaledVector(PH.n,-_dir.dot(PH.n)).normalize();_sl.crossVectors(PH.n,_dir).normalize();
 trackAdd(p,_sl,PH.n,.15,on&&sp>.5);
 if(on&&sp>2){const carve=Math.abs(PH.steer)*sp/12+PH.skid*.35+PH.brake*sp*.12+(sp>22?.25:0),n=Math.min(9,Math.floor(carve*dt*60*.9+R()));
  for(let i=0;i<n;i++){const side=PH.steer>0?1:-1,back=rr(-.6,.2);_sp.copy(p).addScaledVector(_dir,back).addScaledVector(_sl,side*rr(.05,.2));
   SPRAY.emit(_sp.x,_sp.y+.05,_sp.z,v.x*.55-_sl.x*side*sp*.12+rr(-.6,.6),rr(.6,1.8)+sp*.05,v.z*.55-_sl.z*side*sp*.12+rr(-.6,.6),rr(.5,1.1),rr(.12,.25),rr(.6,1.2),snowTint.r,snowTint.g,snowTint.b,rr(.25,.45),2.2,4)}}
 // audio
 if(AU.ctx){const air=!PH.ground,k=clamp(sp/30,0,1.3);loopSet('wind',.04+k*k*.32+(air?.06:0),280+sp*28);
  loopSet('carve',on?clamp(Math.abs(PH.steer)*sp/28+PH.skid/7+PH.brake*.5,0,1)*.28:0,2400+sp*45);loopSet('hiss',on?clamp(sp/22,0,1)*.2:0,500+sp*22);
  const near=G.run&&G.run.av.on&&gap<400?Math.pow(clamp(1-gap/320,0,1),1.6):0;loopSet('rumble',near*1.1,120+near*120,.2);loopSet('sub',near*.4,0,.2);
  if(near>.6)CAM.shake=Math.max(CAM.shake,(near-.6)*.8);Music.set(clamp(.3+k*.4+near*.3,0,1))}}
// ================= INIT =================
function init(){makeTextures();MAT.snow=snowMaterial();buildProps();initFX();buildBoard();setupPost();applyQuality();
 addEventListener('resize',setupPost);startModels();toMenu();requestAnimationFrame(loop);
 window.__FT={sim,setForce:f=>{FORCE=f},scene,sun,hemi,ren,PP,MAT,G,PH,TER,CAM,RD,MOD,startRun,toMenu,physics,heightS,cx,halfW,INP,step,save,setTOD,POSE,updateRiderVisual,SPRAY,PROPS,TRK}}
try{if(!window.THREE)throw new Error('3D engine missing');init()}catch(e){console.error(e);const b=$('err');b.className='';b.textContent=(e.message==='3D engine missing'?'Couldn’t load the 3D engine. Check your internet connection and reload.':'Your browser couldn’t start the game ('+e.message+').')}
})();

