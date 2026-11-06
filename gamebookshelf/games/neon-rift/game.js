/* NEON RIFT — 3D roguelite arena shooter (Three.js r128). All models are sculpted procedurally at load time. */
(()=>{'use strict';
let _rng=Math.random;
const $=id=>document.getElementById(id),R=()=>_rng(),rr=(a,b)=>a+R()*(b-a),ri=n=>R()*n|0,pick=a=>a[R()*a.length|0],clamp=(v,a,b)=>v<a?a:v>b?b:v,lerp=(a,b,t)=>a+(b-a)*t,damp=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
const TAU=Math.PI*2;
// ---------------- SAVE ----------------
const DEF={cores:0,best:0,bestWave:0,bestCombo:0,bossKills:0,runs:0,up:{hp:0,dmg:0,spd:0,xp:0,sh:0,dash:0},set:{sens:4,master:8,music:5,sfx:8,fov:85,q:2,qa:1,shake:1,mute:0,bright:5}};
let save=JSON.parse(JSON.stringify(DEF));
try{const s=JSON.parse(localStorage.getItem('neonrift2')||localStorage.getItem('neonrift')||'{}');if(s&&typeof s==='object'){
for(const k of['cores','best','bestWave','bestCombo','bossKills','runs'])if(Number.isFinite(s[k]))save[k]=Math.max(0,s[k]|0);
if(s.up&&typeof s.up==='object')for(const k in DEF.up)if(Number.isFinite(s.up[k]))save.up[k]=clamp(s.up[k]|0,0,10);
if(s.set&&typeof s.set==='object')for(const k in DEF.set)if(Number.isFinite(+s.set[k]))save.set[k]=+s.set[k];
if(typeof s.set?.q==='string')save.set.q=s.set.q==='Low'?0:2}}catch(e){}
try{if(!localStorage.getItem('neonrift2')&&(('ontouchstart' in window)||navigator.maxTouchPoints>0))save.set.q=0}catch(e){}save.set.q=clamp(save.set.q|0,0,2);
const store=()=>{try{localStorage.setItem('neonrift2',JSON.stringify(save))}catch(e){}};
// ---------------- AUDIO ----------------
const AU={ctx:null};
function audioInit(){if(AU.ctx)return;try{const C=new(window.AudioContext||window.webkitAudioContext)();AU.ctx=C;
const comp=C.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=4;comp.connect(C.destination);
AU.master=C.createGain();AU.master.connect(comp);AU.sfx=C.createGain();AU.sfx.connect(AU.master);AU.mus=C.createGain();AU.mus.connect(AU.master);
const len=C.sampleRate*2.4|0,ir=C.createBuffer(2,len,C.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<len;i++)d[i]=(R()*2-1)*Math.pow(1-i/len,3.2)}
AU.verb=C.createConvolver();AU.verb.buffer=ir;AU.send=C.createGain();AU.send.gain.value=.28;AU.send.connect(AU.verb);AU.verb.connect(AU.master);
const nb=C.createBuffer(1,C.sampleRate*2,C.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=R()*2-1;AU.noise=nb;setVol();music()}catch(e){AU.ctx=null}}
function setVol(){if(!AU.ctx)return;const s=save.set,t=AU.ctx.currentTime;AU.master.gain.setTargetAtTime(s.mute?0:s.master/10,t,.05);AU.sfx.gain.setTargetAtTime(s.sfx/10,t,.05);AU.mus.gain.setTargetAtTime(s.music/10*.55,t,.05)}
function out(g,v){g.connect(AU.sfx);if(v){const s=AU.ctx.createGain();s.gain.value=v;g.connect(s);s.connect(AU.send)}}
function tone(f,d,type,vol,f2,o={}){const C=AU.ctx;if(!C)return;const t=C.currentTime+(o.at||0),os=C.createOscillator(),g=C.createGain();os.type=type||'sine';os.frequency.setValueAtTime(f,t);if(f2)os.frequency.exponentialRampToValueAtTime(Math.max(20,f2),t+d);
if(o.det)os.detune.value=o.det;g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(o.a||.004));g.gain.exponentialRampToValueAtTime(.0001,t+d);os.connect(g);out(g,o.wet??.3);os.start(t);os.stop(t+d+.05)}
function noise(d,vol,ft,f0,f1,q,o={}){const C=AU.ctx;if(!C)return;const t=C.currentTime+(o.at||0),s=C.createBufferSource(),f=C.createBiquadFilter(),g=C.createGain();s.buffer=AU.noise;s.playbackRate.value=o.rate||1;
f.type=ft;f.frequency.setValueAtTime(f0,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+d);f.Q.value=q||1;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(vol,t+(o.a||.003));g.gain.exponentialRampToValueAtTime(.0001,t+d);
s.connect(f);f.connect(g);out(g,o.wet??.35);s.start(t,R()*1.5);s.stop(t+d+.05)}
const SFX={rifle(){noise(.11,.5,'bandpass',2600,700,.9);tone(170,.09,'square',.18,55);tone(2400,.04,'sawtooth',.05,900)},
shotgun(){noise(.42,.95,'lowpass',4200,250,.6);tone(95,.3,'sine',.9,38);noise(.08,.4,'highpass',3000,0,1,{at:.0})},
rail(){tone(2400,.5,'sawtooth',.22,180);tone(90,.4,'sine',.8,30);noise(.35,.6,'highpass',5000,1200,1)},
railCharge(){tone(200,.45,'sawtooth',.12,1800,{a:.2})},
rocket(){noise(.7,.5,'bandpass',900,220,1.6);tone(140,.45,'triangle',.35,55)},
void(){tone(70,1.1,'sawtooth',.5,24);tone(140,.9,'sine',.5,35);noise(.6,.4,'lowpass',600,80,2)},
boom(b){noise(1.4*(b||1),1,'lowpass',1400,70,.5,{wet:.6});tone(58,1*(b||1),'sine',1,22,{wet:.4})},
hit(){tone(1300,.04,'square',.06,700,{wet:0})},crit(){tone(1900,.07,'square',.08,1200,{wet:0});tone(2600,.05,'sine',.06,0,{at:.03,wet:0})},
head(){tone(2200,.08,'triangle',.12,1400,{wet:0});noise(.05,.2,'highpass',5000,0,1,{wet:0})},
kill(){tone(420,.12,'triangle',.12,900,{wet:.1})},
hurt(){noise(.25,.6,'lowpass',900,200,1);tone(110,.2,'sawtooth',.25,60)},
shield(){tone(900,.2,'sine',.2,300);noise(.15,.3,'bandpass',3000,1500,4)},
reload(){noise(.05,.4,'highpass',2500,0,2,{wet:.1});tone(300,.05,'square',.12,0,{wet:.1});noise(.05,.35,'highpass',2000,0,2,{at:.35,wet:.1});tone(200,.06,'square',.12,0,{at:.36,wet:.1})},
empty(){tone(900,.03,'square',.08,0,{wet:0})},
magOut(){noise(.07,.4,'highpass',2600,0,1.5,{wet:.1});tone(420,.05,'square',.12,0,{wet:.1});noise(.12,.25,'bandpass',900,400,2,{at:.12,wet:.2})},
magIn(){tone(150,.07,'square',.3,0,{wet:.1});noise(.06,.5,'bandpass',1800,900,1.5,{wet:.1})},
bolt(){noise(.04,.45,'highpass',3200,0,1,{wet:.1});tone(620,.04,'square',.12,0,{wet:.1});noise(.04,.45,'highpass',2600,0,1,{at:.1,wet:.1});tone(380,.05,'square',.14,0,{at:.1,wet:.1})},
shell(){tone(950,.04,'triangle',.14,0,{wet:.1});noise(.04,.3,'highpass',4200,0,1,{wet:.1})},
pump(){noise(.09,.55,'bandpass',1300,600,2,{wet:.15});noise(.09,.55,'bandpass',1600,700,2,{at:.13,wet:.15});tone(200,.05,'square',.15,0,{at:.13,wet:.1})},
cellOut(){tone(1300,.35,'sine',.16,180);noise(.08,.3,'highpass',3000,0,1,{wet:.1})},
cellIn(){tone(180,.45,'sine',.16,1700);tone(150,.05,'square',.22,0,{wet:.1});noise(.05,.35,'highpass',2500,0,1,{wet:.1})},
slide(){noise(.3,.28,'bandpass',500,1300,3,{wet:.15})},clack(){tone(140,.08,'square',.3,0,{wet:.1});noise(.06,.45,'highpass',2000,0,1,{wet:.1})},
vent(){noise(.7,.45,'highpass',3500,700,1,{wet:.3})},slam(){tone(95,.16,'sine',.6,40,{wet:.2});noise(.08,.45,'lowpass',900,0,1,{wet:.2})},
vcharge(){tone(60,.6,'sawtooth',.25,240,{a:.2});tone(120,.6,'sine',.2,480,{a:.2})},
dash(){noise(.25,.5,'bandpass',600,2400,1.5);tone(300,.2,'sine',.15,700)},jump(){noise(.12,.25,'lowpass',500,200,1,{wet:.1})},land(){tone(80,.12,'sine',.3,40,{wet:.1})},
lvl(){[523,659,784,1046].forEach((f,i)=>tone(f,.35,'triangle',.18,0,{at:i*.07}))},
pickup(){tone(700,.15,'sine',.2,1400);tone(1050,.2,'sine',.12,2100,{at:.06})},xp(){tone(1200+R()*400,.06,'sine',.06,0,{wet:.1})},
swap(){noise(.08,.3,'highpass',2000,0,1,{wet:.1});tone(220,.06,'square',.08,0,{at:.05,wet:.1})},
eshot(){tone(500,.15,'sawtooth',.06,180,{wet:.4})},click(){tone(1200,.03,'square',.06,0,{wet:0})},
warn(){tone(300,.25,'sawtooth',.18,0);tone(300,.25,'sawtooth',.18,0,{at:.3})},
roar(){noise(1.6,.9,'lowpass',500,90,3,{wet:.6});tone(55,1.6,'sawtooth',.5,30,{wet:.5});tone(82,1.4,'sawtooth',.35,40,{det:12,wet:.5})},
slam(){noise(.9,1,'lowpass',600,50,.7,{wet:.6});tone(45,.8,'sine',1,20)},
spawn(){tone(180,.5,'sine',.15,700,{wet:.6});noise(.4,.2,'bandpass',1200,300,3,{wet:.6})}};
SFX.coin=()=>{tone(1900,.07,'square',.035,0,{wet:.12});tone(2850,.12,'sine',.05,0,{at:.035,wet:.2})};
SFX.buy=()=>{noise(.06,.25,'highpass',3000,0,1,{wet:.1});[880,1320,1760].forEach((f,i)=>tone(f,.16,'triangle',.12,0,{at:.05+i*.05,wet:.25}));tone(140,.12,'square',.12,60)};
SFX.door=()=>{noise(1.1,.4,'lowpass',900,140,1.2,{wet:.4});tone(70,.9,'sawtooth',.18,45,{wet:.3});noise(.12,.3,'bandpass',2400,0,2,{at:.95,wet:.2})};
SFX.scope=()=>{tone(1400,.03,'square',.05,0,{wet:0});noise(.09,.12,'bandpass',4200,1800,3,{at:.02,wet:0})};
SFX.unscope=()=>{noise(.06,.09,'bandpass',2600,1200,3,{wet:0})};
const play=(n,a)=>{if(AU.ctx&&SFX[n])try{SFX[n](a)}catch(e){}};
// ambient score: drone pad + pulse
let musT=null;function music(){const C=AU.ctx;if(!C)return;
const pad=C.createBiquadFilter();pad.type='lowpass';pad.frequency.value=500;pad.Q.value=3;const pg=C.createGain();pg.gain.value=.08;pad.connect(pg);pg.connect(AU.mus);const ps=C.createGain();ps.gain.value=.5;pg.connect(ps);ps.connect(AU.verb);
const lfo=C.createOscillator(),lg=C.createGain();lfo.frequency.value=.05;lg.gain.value=280;lfo.connect(lg);lg.connect(pad.frequency);lfo.start();
[55,55.4,82.4,110.3].forEach((f,i)=>{const o=C.createOscillator();o.type=i<2?'sawtooth':'triangle';o.frequency.value=f;o.connect(pad);o.start()});AU.pad=pad;
let step=0;const seq=[0,0,7,0,3,0,10,7],base=55;musT=setInterval(()=>{if(!AU.ctx||AU.ctx.state!=='running')return;const intense=G&&G.mode==='play'?(G.boss?2:1):0;if(!intense){step++;return}
const n=seq[step%8],t=C.currentTime,o=C.createOscillator(),f=C.createBiquadFilter(),g=C.createGain();o.type='sawtooth';o.frequency.value=base*Math.pow(2,n/12)*(step%16<8?1:2);f.type='lowpass';f.frequency.setValueAtTime(intense>1?2200:1200,t);f.frequency.exponentialRampToValueAtTime(120,t+.22);f.Q.value=6;
g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(intense>1?.16:.1,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+.25);o.connect(f);f.connect(g);g.connect(AU.mus);o.start(t);o.stop(t+.3);
if(step%4===0){const k=C.createOscillator(),kg=C.createGain();k.frequency.setValueAtTime(110,t);k.frequency.exponentialRampToValueAtTime(40,t+.15);kg.gain.setValueAtTime(intense>1?.35:.22,t);kg.gain.exponentialRampToValueAtTime(.0001,t+.2);k.connect(kg);kg.connect(AU.mus);k.start(t);k.stop(t+.25)}
step++},intenseMs())}
const intenseMs=()=>140;
let G=null;// game state (assigned later)

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

// ================= MODEL LIBRARY (sculpted with SDF) =================
const MODELS=(()=>{const{S,E,C,B,Y,TO,chain}=SDF;
const add=(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],mul=(a,k)=>[a[0]*k,a[1]*k,a[2]*k],lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t],sc=(p,k)=>p.map(v=>v*k);
const D2R=Math.PI/180;
// ---------- humanoid rig ----------
// bone ids: 0 hips 1 spine 2 chest 3 neck 4 head | R arm 5 6 7 | L arm 8 9 10 | R leg 11 12 13 | L leg 14 15 16
function rig(o){const k=o.s||1,ap=(o.armAng||40)*D2R,sw=(o.sw||.2),ul=(o.ua||.3),fl=(o.fa||.27),hl=o.hl||.17,dig=o.dig;
const J={hips:[0,.98,0],spine:[0,1.15,0],chest:[0,1.36,0],neck:[0,1.56,0],head:[0,1.68,.02]};
for(const s of[-1,1]){const n=s<0?'R':'L',sh=[s*sw,1.49,0],dir=[s*Math.sin(ap),-Math.cos(ap),0],el=add(sh,mul(dir,ul)),wr=add(el,mul(dir,fl));
J['sh'+n]=sh;J['el'+n]=el;J['wr'+n]=wr;J['ht'+n]=add(wr,mul(dir,hl));J['dir'+n]=dir;
if(dig){J['hp'+n]=[s*.11,.98,0];J['kn'+n]=[s*.13,.62,.16];J['an'+n]=[s*.13,.2,-.1];J['to'+n]=[s*.13,.03,.12]}
else{J['hp'+n]=[s*(o.hw||.1),.95,0];J['kn'+n]=[s*((o.hw||.1)+.015),.52,.02];J['an'+n]=[s*((o.hw||.1)+.025),.09,-.02];J['to'+n]=[s*((o.hw||.1)+.03),.04,.15]}}
for(const key in J)if(!key.startsWith('dir'))J[key]=sc(J[key],k);
const bones=[{p:J.hips,parent:-1},{p:J.spine,parent:0},{p:J.chest,parent:1},{p:J.neck,parent:2},{p:J.head,parent:3},
{p:J.shR,parent:2},{p:J.elR,parent:5},{p:J.wrR,parent:6},{p:J.shL,parent:2},{p:J.elL,parent:8},{p:J.wrL,parent:9},
{p:J.hpR,parent:0},{p:J.knR,parent:11},{p:J.anR,parent:12},{p:J.hpL,parent:0},{p:J.knL,parent:14},{p:J.anL,parent:15}];
return{J,bones,k}}
// base body; t = thickness multiplier, returns prims
function body(J,k,o){const t=o.t||1,P=[],z=o.suit??0,bk=o.bulk||1;
P.push(E(J.hips,sc([.16*bk,.12,.12],k*t),{b:0,z,k:.06*k}));
P.push(E(add(J.spine,[0,.02*k,0]),sc([.14*bk,.13,.1],k*t),{b:1,z,k:.06*k}));
P.push(E(add(J.chest,[0,.02*k,.01*k]),sc([.2*bk,.16,.12*bk],k*t),{b:2,z,k:.06*k}));
P.push(C(add(J.neck,[0,-.04*k,0]),add(J.head,[0,-.02*k,0]),.055*k*t,.05*k*t,{b:3,z,k:.04*k}));
for(const n of['R','L']){const s=n==='R'?-1:1,ua=n==='R'?5:8;
P.push(E(add(J['sh'+n],[s*.02*k,0,0]),sc([.08,.075,.075],k*t*bk),{b:ua,z,k:.05*k}));
P.push(C(J['sh'+n],J['el'+n],.06*k*t*bk,.045*k*t,{b:ua,z,k:.035*k}));
P.push(C(J['el'+n],J['wr'+n],.047*k*t*bk,.036*k*t,{b:ua+1,z,k:.03*k}));
const hd=J['dir'+n],hc=add(J['wr'+n],mul(hd,.075*k*(o.hand||1)));P.push(B(hc,sc([.04,.06,.022],k*(o.hand||1)),.018*k,{b:ua+2,z:o.glove??z,k:.03*k,rot:[0,0,Math.atan2(-hd[0],-hd[1])*-1]}));
const lg=n==='R'?11:14;P.push(C(J['hp'+n],J['kn'+n],.085*k*t*bk,.06*k*t,{b:lg,z,k:.05*k}));P.push(C(J['kn'+n],J['an'+n],.058*k*t,.042*k*t,{b:lg+1,z,k:.03*k}));
P.push(E(lerp(J['an'+n],J['to'+n],.45),sc([.055,.045,.12],k*(o.foot||1)),{b:lg+2,z:o.boot??z,k:.03*k}))}
return P}
function finish(m){m.nb=m.bones?m.bones.length:1;return m}
// ---------- enemies ----------
function soldier(){const{J,bones,k}=rig({s:1.02}),P=body(J,k,{suit:3,boot:3,glove:3,t:1.12});const A=1,G=2;
P.push(E(add(J.head,[0,.08,.0]),[.125,.135,.14],{b:4,z:A,k:.015}));
P.push(E(add(J.head,[0,.075,.085]),[.105,.042,.078],{b:4,z:G,k:.008}));for(const s of[-1,1])P.push(E(add(J.head,[s*.12,.06,-.01]),[.03,.06,.06],{b:4,z:A,k:.01}));P.push(E(add(J.head,[0,.17,-.02]),[.03,.03,.12],{b:4,z:A,k:.02}));
P.push(B(add(J.head,[0,-.02,.1]),[.06,.04,.04],.03,{b:4,z:A,k:.02}));
P.push(E(add(J.chest,[0,.04,.035]),[.215,.17,.14],{b:2,z:A,k:.015}));P.push(TO(add(J.chest,[0,-.03,.03]),.2,.006,{op:1,b:2,z:3,k:.004}));
for(let i=0;i<2;i++)for(const s of[-1,1])P.push(E(add(J.spine,[s*.055,.05-i*.08,.075]),[.05,.035,.04],{b:1,z:A,k:.012}));
P.push(B(add(J.chest,[0,0,-.13]),[.14,.15,.07],.04,{b:2,z:A,k:.02}));P.push(B(add(J.chest,[0,0,-.2]),[.11,.12,.012],.01,{op:1,b:2,z:3,k:.005}));
P.push(C(add(J.chest,[-.07,-.08,-.21]),add(J.chest,[-.07,.1,-.21]),.022,.022,{b:2,z:G,k:.01}),C(add(J.chest,[.07,-.08,-.21]),add(J.chest,[.07,.1,-.21]),.022,.022,{b:2,z:G,k:.01}));
P.push(Y(add(J.hips,[0,.05,0]),.17,.035,.015,{b:0,z:A,k:.01}));
for(const n of['R','L']){const s=n==='R'?-1:1,ua=n==='R'?5:8,lg=n==='R'?11:14;
P.push(E(add(J['sh'+n],[s*.04,.06,0]),[.12,.07,.11],{b:ua,z:A,k:.015,rot:[0,0,-s*.5]}));
P.push(C(lerp(J['el'+n],J['wr'+n],.15),lerp(J['el'+n],J['wr'+n],.8),.055,.048,{b:ua+1,z:A,k:.012}));
P.push(E(lerp(J['hp'+n],J['kn'+n],.45),[.1,.17,.1],{b:lg,z:A,k:.012}));
P.push(S(add(J['kn'+n],[0,0,.05]),.06,{b:lg+1,z:A,k:.015}));
P.push(C(add(lerp(J['kn'+n],J['an'+n],.15),[0,0,.035]),add(lerp(J['kn'+n],J['an'+n],.8),[0,0,.03]),.06,.05,{b:lg+1,z:A,k:.012}))}
return finish({h:.024,bones,prims:P,pal:[[.3,.32,.35],[.55,.57,.6],[0,0,0],[.12,.13,.15]],ws:.05,J})}
function elite(){const{J,bones,k}=rig({s:1.22,dig:1,sw:.22,armAng:38}),P=body(J,k,{suit:0,t:1.05,boot:3,foot:1.3});const A=1,G=2;
const hd=J.head;P.push(E(add(hd,[0,.07,-.04]),[.1,.11,.17],{b:4,z:0,k:.04,rot:[.35,0,0]}));
P.push(E(add(hd,[0,.13,-.06]),[.07,.06,.2],{b:4,z:A,k:.015,rot:[.5,0,0]}));
for(const s of[-1,1]){P.push(...chain([add(hd,[s*.05,.0,.1]),add(hd,[s*.08,-.07,.17]),add(hd,[s*.05,-.14,.2])],.022,.01,{b:4,z:0,k:.02}));
P.push(...chain([add(hd,[s*.03,-.03,.08]),add(hd,[s*.05,-.11,.12]),add(hd,[s*.025,-.17,.11])],.018,.008,{b:4,z:0,k:.02}));
P.push(S(add(hd,[s*.045,.07,.1]),.018,{b:4,z:G,k:.005}))}
P.push(E(add(J.chest,[0,.04,.04]),[.24,.18,.15],{b:2,z:A,k:.015}));P.push(E(add(J.chest,[0,.1,.13]),[.05,.09,.04],{b:2,z:G,k:.01}));
P.push(E(add(J.chest,[0,.12,-.1]),[.22,.1,.12],{b:2,z:A,k:.02}));
for(const n of['R','L']){const s=n==='R'?-1:1,ua=n==='R'?5:8,lg=n==='R'?11:14;
P.push(E(add(J['sh'+n],[s*.06,.09,-.01]),[.17,.07,.14],{b:ua,z:A,k:.015,rot:[0,0,-s*.55]}));
P.push(E(add(J['sh'+n],[s*.12,.16,-.05]),[.03,.12,.07],{b:ua,z:A,k:.02,rot:[-.4,0,-s*.5]}));
P.push(C(lerp(J['el'+n],J['wr'+n],.1),lerp(J['el'+n],J['wr'+n],.85),.06,.05,{b:ua+1,z:A,k:.012}));
P.push(E(lerp(J['hp'+n],J['kn'+n],.5),[.11,.2,.11],{b:lg,z:A,k:.015,rot:[-.4,0,0]}));
P.push(C(lerp(J['kn'+n],J['an'+n],.05),lerp(J['kn'+n],J['an'+n],.75),.065,.045,{b:lg+1,z:A,k:.015}));
P.push(C(J['an'+n],J['to'+n],.04,.03,{b:lg+2,z:3,k:.02}))}
P.push(B(add(J.hips,[0,-.06,.1]),[.12,.16,.02],.02,{b:0,z:3,k:.02,rot:[-.15,0,0]}));
return finish({h:.024,bones,prims:P,pal:[[.32,.24,.42],[.42,.36,.6],[0,0,0],[.1,.08,.13]],ws:.055,cv:.18,J})}
function assassin(){const{J,bones,k}=rig({s:1.05,sw:.18,ua:.32,fa:.3}),P=body(J,k,{suit:3,t:.85,bulk:.9});const A=1,G=2;
const hd=J.head;P.push(E(add(hd,[0,.06,-.02]),[.12,.14,.15],{b:4,z:3,k:.02}));
P.push(E(add(hd,[0,.06,.17]),[.075,.1,.07],{op:1,b:4,z:3,k:.02}));P.push(E(add(hd,[0,.045,.05]),[.07,.095,.085],{b:4,z:0,k:.01}));
for(const s of[-1,1])P.push(E(add(hd,[s*.03,.07,.125]),[.022,.01,.012],{b:4,z:G,k:.004,rot:[0,0,s*.3]}));
P.push(E(add(J.chest,[0,.1,-.04]),[.24,.09,.15],{b:2,z:3,k:.04}));
P.push(B(add(J.chest,[0,0,.06]),[.15,.13,.06],.05,{b:2,z:A,k:.015}));
for(const n of['R','L']){const s=n==='R'?-1:1,ua=n==='R'?5:8,el=J['el'+n],wr=J['wr'+n],d=J['dir'+n];
P.push(C(lerp(el,wr,.1),lerp(el,wr,.9),.05,.045,{b:ua+1,z:A,k:.01}));
P.push(...chain([lerp(el,wr,.2),add(add(wr,mul(d,.18)),[s*.06,0,.02]),add(add(wr,mul(d,.45)),[s*.1,0,.03])],.025,.004,{b:ua+1,z:G,k:.006}));
P.push(...chain([lerp(el,wr,.25),add(add(wr,mul(d,.15)),[s*.07,0,0]),add(add(wr,mul(d,.4)),[s*.11,0,.0])],.03,.006,{b:ua+1,z:A,k:.008}))}
return finish({h:.02,bones,prims:P,pal:[[.5,.48,.5],[.22,.22,.26],[0,0,0],[.08,.08,.1]],ws:.05,J})}
function brute(){const{J,bones,k}=rig({s:1.45,sw:.27,ua:.36,fa:.36,hl:.2,armAng:30,hw:.2}),P=body(J,k,{suit:0,t:1.25,bulk:1.35,hand:1.6,foot:1.3});const A=1,G=2;
P[1].n=.02*k;P[2].n=.025*k;P[0].n=.02*k;
P.push(E(add(J.chest,sc([0,.05,-.05],k)),sc([.28,.18,.17],k),{b:2,z:0,k:.08*k,n:.025*k}));
P.push(E(add(J.head,sc([0,.0,.07],k)),sc([.1,.1,.1],k),{b:4,z:0,k:.05*k,n:.01*k}));
P.push(E(add(J.head,sc([0,-.05,.13],k)),sc([.085,.045,.07],k),{b:4,z:0,k:.04*k}));P.push(E(add(J.head,sc([0,.05,.14],k)),sc([.09,.025,.04],k),{b:4,z:0,k:.03*k}));
for(const s of[-1,1]){P.push(S(add(J.head,sc([s*.04,.025,.165],k)),.014*k,{b:4,z:G,k:.002}));P.push(C(add(J.head,sc([s*.05,-.07,.17],k)),add(J.head,sc([s*.07,.0,.21],k)),.014*k,.004*k,{b:4,z:3,k:.01*k}))}
P.push(E(add(J.head,sc([0,.09,.02],k)),sc([.11,.06,.12],k),{b:4,z:A,k:.015*k}));
P.push(B(add(J.chest,sc([0,.1,-.17],k)),sc([.26,.18,.07],k),.05*k,{b:2,z:A,k:.02*k,rot:[-.3,0,0]}));
for(let i=0;i<3;i++)P.push(Y(add(J.chest,sc([-.12+i*.12,.1,-.25],k)),.025*k,.06*k,.01*k,{b:2,z:G,k:.01*k,rot:[1.3,0,0]}));
P.push(B(add(J.chest,sc([0,.02,.11],k)),sc([.22,.12,.06],k),.05*k,{b:2,z:A,k:.02*k}));
for(const n of['R','L']){const s=n==='R'?-1:1,ua=n==='R'?5:8,lg=n==='R'?11:14;
P.push(E(add(J['sh'+n],sc([s*.06,.08,-.01],k)),sc([.16,.09,.15],k),{b:ua,z:A,k:.015*k,rot:[0,0,-s*.45]}));
for(let i=0;i<3;i++)P.push(C(add(J['sh'+n],sc([s*(.05+i*.05),.15-i*.02,-.06],k)),add(J['sh'+n],sc([s*(.06+i*.06),.27-i*.03,-.1],k)),.02*k,.006*k,{b:ua,z:A,k:.01*k}));
P.push(E(lerp(J['el'+n],J['wr'+n],.55),sc([.085,.12,.085],k),{b:ua+1,z:0,k:.05*k,rot:[0,0,s*.55],n:.015*k}));
P.push(B(add(J['wr'+n],mul(J['dir'+n],.09*k)),sc([.075,.055,.075],k),.03*k,{b:ua+2,z:A,k:.02*k,rot:[0,0,s*.5]}));
P.push(C(lerp(J['kn'+n],J['an'+n],.1),lerp(J['kn'+n],J['an'+n],.7),.07*k,.06*k,{b:lg+1,z:A,k:.015*k}))}
return finish({h:.03,bones,prims:P,pal:[[.3,.28,.26],[.26,.28,.31],[0,0,0],[.1,.1,.1]],ws:.07,noise:.03,nf:5,cv:.2,J})}
function drone(){const P=[],A=1,G=2,D=3;
P.push(E([0,0,0],[.32,.26,.38],{b:0,z:A,k:.02}));P.push(TO([0,0,0],.32,.018,{op:1,z:-1,b:0,k:.01,rot:[Math.PI/2,0,0]}));
P.push(S([0,0,.36],.15,{op:1,b:0,z:-1,k:.02}));P.push(S([0,0,.3],.12,{b:0,z:G,k:.004}));
P.push(TO([0,0,.33],.15,.02,{b:0,z:D,k:.01,rot:[Math.PI/2,0,0]}));
for(const s of[-1,1]){P.push(Y([s*.36,0,-.05],.07,.11,.02,{b:0,z:D,k:.02,rot:[0,0,Math.PI/2]}));P.push(Y([s*.47,0,-.05],.05,.012,.004,{b:0,z:G,k:.004,rot:[0,0,Math.PI/2]}));
P.push(B([s*.2,.24,-.12],[.015,.08,.14],.01,{b:0,z:A,k:.03,rot:[-.3,0,-s*.5]}))}
const bones=[{p:[0,0,0],parent:-1}];
for(let t=0;t<3;t++){const a=t/3*Math.PI*2+Math.PI/2,x=Math.cos(a)*.12,z=Math.sin(a)*.12-.08;const pts=[[x,-.18,z],[x*1.3,-.42,z*1.2-.05],[x*1.5,-.66,z*1.3-.1],[x*1.4,-.88,z*1.3-.12]];
const b0=bones.length;for(let i=0;i<3;i++)bones.push({p:pts[i],parent:i?b0+i-1:0});P.push(...chain(pts,.035,.012,{z:D,k:.02},[b0,b0+1,b0+2]));P.push(S(pts[3],.02,{b:b0+2,z:G,k:.005}))}
return finish({h:.018,bones,prims:P,pal:[[.3,.3,.32],[.62,.63,.66],[0,0,0],[.13,.13,.15]],ws:.04,cv:.08})}
function crawler(){const P=[],G=2,A=1;const bones=[{p:[0,.45,0],parent:-1},{p:[0,.5,.38],parent:0},{p:[0,.5,-.3],parent:0}];
P.push(E([0,.45,.05],[.26,.18,.32],{b:0,z:A,k:.06,n:.015}));P.push(E([0,.55,-.55],[.36,.3,.48],{b:2,z:0,k:.08,n:.03}));
for(let i=0;i<4;i++)P.push(E([(i%2?1:-1)*.16,.72-i*.02,-.4-i*.12],[.08,.06,.08],{b:2,z:G,k:.03}));
P.push(E([0,.48,.48],[.16,.13,.17],{b:1,z:A,k:.04}));for(const s of[-1,1]){P.push(...chain([[s*.08,.42,.58],[s*.14,.36,.72],[s*.07,.3,.82]],.03,.01,{b:1,z:0,k:.02}));P.push(S([s*.07,.55,.6],.025,{b:1,z:G,k:.004}))}
for(let i=0;i<6;i++){const s=i<3?-1:1,j=i%3,zz=.3-j*.3,b0=bones.length;const p0=[s*.2,.45,zz],p1=[s*.62,.82,zz+(j-1)*.18],p2=[s*1.0,0,zz+(j-1)*.35];
bones.push({p:p0,parent:0},{p:p1,parent:b0});P.push(C(p0,p1,.06,.04,{b:b0,z:A,k:.03}),C(p1,p2,.04,.012,{b:b0+1,z:0,k:.02}),S(p1,.05,{b:b0,z:A,k:.02}))}
return finish({h:.026,bones,prims:P,pal:[[.28,.32,.18],[.2,.22,.14],[0,0,0],[.1,.1,.08]],ws:.06,noise:.02,nf:7,cv:.25})}
function tank(){const P=[],A=1,G=2;const bones=[{p:[0,1.4,0],parent:-1},{p:[0,2.25,-.1],parent:0}];
P.push(E([0,1.35,0],[.95,.58,1.3],{b:0,z:0,k:.1,n:.03}));
for(let i=0;i<5;i++)P.push(E([0,1.72+Math.sin(i*.8)*.08,.95-i*.48],[1.05-Math.abs(i-2)*.08,.42,.42],{b:0,z:A,k:.008,rot:[.25,0,0]}));
for(const s of[-1,1])for(let i=0;i<3;i++)P.push(E([s*.95,1.45,.6-i*.6],[.18,.32,.34],{b:0,z:A,k:.01,rot:[0,0,s*.35]}));
P.push(E([0,1.25,1.25],[.42,.34,.3],{b:0,z:0,k:.1,n:.02}));P.push(E([0,1.28,1.5],[.3,.05,.06],{b:0,z:G,k:.02}));
P.push(B([0,1.45,1.3],[.48,.18,.25],.12,{b:0,z:A,k:.04,rot:[-.3,0,0]}));
P.push(E([0,2.25,-.1],[.42,.24,.5],{b:1,z:A,k:.03}));P.push(Y([0,2.3,.9],.13,.95,.03,{b:1,z:A,k:.04,rot:[Math.PI/2,0,0]}));
P.push(Y([0,2.3,1.82],.09,.1,.01,{op:1,b:1,z:-1,k:.01,rot:[Math.PI/2,0,0]}));P.push(Y([0,2.3,1.78],.08,.02,.005,{b:1,z:G,k:.005,rot:[Math.PI/2,0,0]}));
for(let i=0;i<3;i++)P.push(TO([0,2.3,.3+i*.35],.16,.035,{b:1,z:G,k:.01,rot:[Math.PI/2,0,0]}));
for(let i=0;i<4;i++){const sx=i%2?1:-1,sz=i<2?1:-1,b0=bones.length;const p0=[sx*.85,1.35,sz*.8],p1=[sx*1.55,1.15,sz*1.25],p2=[sx*1.55,0,sz*1.35];
bones.push({p:p0,parent:0},{p:p1,parent:b0});P.push(C(p0,p1,.32,.24,{b:b0,z:A,k:.08}),C(p1,p2,.22,.16,{b:b0+1,z:0,k:.06,n:.02}),E([p2[0],.12,p2[2]+sz*.05],[.28,.14,.34],{b:b0+1,z:A,k:.05}))}
return finish({h:.06,bones,prims:P,pal:[[.3,.26,.22],[.28,.33,.34],[0,0,0],[.1,.1,.1]],ws:.1,noise:.03,nf:4,cv:.15})}
// ---------- bosses ----------
function titan(){const{J,bones,k}=rig({s:4.3,sw:.24,armAng:35}),P=body(J,k,{suit:3,t:1.15,bulk:1.2,hand:1.3,foot:1.2});const A=1,G=2,h=J.head;
P.push(E(add(h,sc([0,.08,.0],k)),sc([.13,.14,.15],k),{b:4,z:A,k:.015*k}));
P.push(B(add(h,sc([0,.07,.15],k)),sc([.085,.014,.04],k),.006*k,{op:1,b:4,z:G,k:.004*k}));P.push(B(add(h,sc([0,.0,.14],k)),sc([.012,.06,.03],k),.005*k,{op:1,b:4,z:G,k:.004*k}));
for(let i=0;i<5;i++){const a=(i-2)*.38;P.push(C(add(h,sc([Math.sin(a)*.1,.18,Math.cos(a)*.06-.02],k)),add(h,sc([Math.sin(a)*.15,.36-Math.abs(i-2)*.05,Math.cos(a)*.06-.06],k)),.025*k,.004*k,{b:4,z:A,k:.01*k}))}
P.push(E(add(J.chest,sc([0,.04,.04],k)),sc([.24,.19,.15],k),{b:2,z:A,k:.015*k}));P.push(E(add(J.chest,sc([0,.0,-.05],k)),sc([.22,.17,.13],k),{b:2,z:A,k:.02*k}));for(const s of[-1,1])for(let i=0;i<2;i++)P.push(E(add(J.hips,sc([s*.1,-.08-i*.09,.05],k)),sc([.08,.07,.1],k),{b:s<0?11:14,z:A,k:.008*k,rot:[-.15,0,s*.15]}));
P.push(S(add(J.chest,sc([0,.05,.17],k)),.065*k,{op:1,b:2,z:-1,k:.01*k}));P.push(S(add(J.chest,sc([0,.05,.14],k)),.055*k,{b:2,z:G,k:.004*k}));
P.push(B(add(J.spine,sc([0,0,.07],k)),sc([.17,.07,.08],k),.04*k,{b:1,z:A,k:.02*k}));
P.push(B(add(J.hips,sc([0,-.12,.11],k)),sc([.13,.16,.02],k),.02*k,{b:0,z:3,k:.02*k,rot:[-.12,0,0]}));
for(const n of['R','L']){const s=n==='R'?-1:1,ua=n==='R'?5:8,lg=n==='R'?11:14;
P.push(E(add(J['sh'+n],sc([s*.06,.08,0],k)),sc([.17,.1,.15],k),{b:ua,z:A,k:.012*k,rot:[0,0,-s*.5]}));
P.push(E(add(J['sh'+n],sc([s*.04,.14,0],k)),sc([.14,.06,.13],k),{b:ua,z:A,k:.012*k,rot:[0,0,-s*.35]}));
P.push(C(lerp(J['el'+n],J['wr'+n],.1),lerp(J['el'+n],J['wr'+n],.9),.065*k,.055*k,{b:ua+1,z:A,k:.012*k}));
P.push(E(lerp(J['hp'+n],J['kn'+n],.4),sc([.12,.2,.12],k),{b:lg,z:A,k:.015*k}));P.push(S(add(J['kn'+n],sc([0,0,.06],k)),.07*k,{b:lg+1,z:A,k:.015*k}));
P.push(C(add(lerp(J['kn'+n],J['an'+n],.1),sc([0,0,.04],k)),add(lerp(J['kn'+n],J['an'+n],.85),sc([0,0,.03],k)),.068*k,.058*k,{b:lg+1,z:A,k:.012*k}))}
return finish({h:.085,bones,prims:P,pal:[[.3,.3,.32],[.36,.33,.3],[0,0,0],[.12,.1,.1]],ws:.18,cv:.15,J})}
function warden(){const P=[],A=1,G=2,R=3;const bones=[{p:[0,3,0],parent:-1},{p:[0,4.4,0],parent:0},{p:[0,5.4,.1],parent:1}];
P.push(C([0,1.2,0],[0,4.2,0],.25,.85,{b:0,z:R,k:.3,n:.06}));P.push(E([0,4.6,0],[.95,.7,.65],{b:1,z:R,k:.25}));
P.push(E([0,5.45,.05],[.48,.55,.5],{b:2,z:R,k:.1}));P.push(E([0,5.38,.32],[.32,.4,.32],{op:1,b:2,z:-1,k:.06}));
P.push(E([0,5.36,.18],[.25,.32,.2],{b:2,z:3,k:.04}));for(const s of[-1,1])P.push(E([s*.1,5.42,.36],[.05,.025,.02],{b:2,z:G,k:.01}));
P.push(E([0,4.65,.42],[.35,.3,.12],{b:1,z:A,k:.04}));P.push(S([0,4.65,.5],.12,{b:1,z:G,k:.01}));
for(const s of[-1,1]){const b0=bones.length,sh=[s*.85,4.75,0],el=[s*1.55,3.9,.3],wr=[s*1.95,3.1,.55];bones.push({p:sh,parent:1},{p:el,parent:b0},{p:wr,parent:b0+1});
P.push(E(sh,[.38,.3,.32],{b:b0,z:A,k:.08}),C(sh,el,.2,.17,{b:b0,z:R,k:.08}),C(el,wr,.17,.3,{b:b0+1,z:R,k:.06}),C(add(el,[s*.05,-.1,.05]),add(wr,[0,-.05,.03]),.12,.12,{op:1,b:b0+1,z:-1,k:.03}));
for(let f=0;f<4;f++){const a=(f-1.5)*.35,base=add(wr,[s*.05,-.1,.0]);P.push(...chain([base,add(base,[s*(.15+Math.sin(a)*.05),-.35,Math.sin(a)*.25]),add(base,[s*(.1+Math.sin(a)*.05),-.75,Math.sin(a)*.4+.1])],.045,.01,{b:b0+2,z:A,k:.02}))}}
for(let t=0;t<6;t++){const a=t/6*Math.PI*2,x=Math.cos(a),z=Math.sin(a),b0=bones.length,pts=[[x*.4,1.6,z*.4],[x*.75,1.0,z*.75],[x*.95,.45,z*.95],[x*1.25,.0,z*1.25]];
for(let i=0;i<3;i++)bones.push({p:pts[i],parent:i?b0+i-1:0});P.push(...chain(pts,.2,.03,{z:R,k:.1},[b0,b0+1,b0+2]))}
return finish({h:.07,bones,prims:P,pal:[[.3,.3,.32],[.5,.45,.32],[0,0,0],[.09,.08,.12]],ws:.14,noise:.05,nf:2.5,cv:.18})}
function core(){const P=[],A=1,G=2;const bones=[{p:[0,0,0],parent:-1},{p:[0,4.2,0],parent:0}];
P.push(Y([0,.5,0],2.6,.5,.15,{b:0,z:A,k:.1}));P.push(Y([0,1.1,0],1.9,.2,.08,{b:0,z:A,k:.1}));
P.push(E([0,4.2,0],[2.0,2.4,2.0],{b:1,z:0,k:.2,n:.25}));P.push(S([0,4.4,1.75],.75,{op:1,b:1,z:-1,k:.15}));P.push(S([0,4.4,1.25],.75,{b:1,z:G,k:.02}));
for(let i=0;i<7;i++){const a=i/7*Math.PI*2;P.push(E([Math.cos(a)*1.55,4.2+Math.sin(i*2.3)*.8,Math.sin(a)*1.55],[.22,.22,.22],{b:1,z:G,k:.15}))}
for(let i=0;i<3;i++)P.push(TO([0,4.2,0],2.35,.12,{b:1,z:A,k:.08,rot:[Math.PI/2+(i-1)*.7,i*1.1,0]}));
for(let i=0;i<8;i++){const a=i/8*Math.PI*2;P.push(...chain([[Math.cos(a)*2.3,1.1,Math.sin(a)*2.3],[Math.cos(a)*2.7,3.0,Math.sin(a)*2.7],[Math.cos(a)*2.4,5.5,Math.sin(a)*2.4],[Math.cos(a)*1.2,7.0,Math.sin(a)*1.2]],.16,.08,{b:0,z:A,k:.08}))}
for(let t=0;t<6;t++){const a=(t+.5)/6*Math.PI*2,x=Math.cos(a),z=Math.sin(a),b0=bones.length,pts=[[x*1.8,3.4,z*1.8],[x*3.0,2.4,z*3.0],[x*4.0,1.0,z*4.0],[x*4.8,0,z*4.8]];
for(let i=0;i<3;i++)bones.push({p:pts[i],parent:i?b0+i-1:1});P.push(...chain(pts,.38,.1,{z:0,k:.25,n:.06},[b0,b0+1,b0+2]))}
return finish({h:.14,bones,prims:P,pal:[[.42,.18,.14],[.3,.28,.26],[0,0,0],[.1,.1,.1]],ws:.25,noise:.25,nf:1.6,cv:.25})}
// ---------- props ----------
function shard(){return finish({h:.012,prims:[C([0,-.25,0],[0,.25,0],.09,.0,{z:2,k:.02}),C([0,-.25,0],[0,-.42,0],.09,.0,{z:2,k:.02})],pal:[[1,1,1],[1,1,1],[0,0,0]],ao:0})}
function gem(){return finish({h:.008,prims:[E([0,0,0],[.07,.16,.07]),E([.05,-.03,0],[.04,.1,.04],{rot:[0,0,.6]}),E([-.04,-.04,.02],[.035,.08,.035],{rot:[0,0,-.5]})],pal:[[1,1,1]],ao:0,cv:0})}
function sword(){const P=[],A=1,G=2;P.push(B([0,0,0],[.06,.9,.012],.006,{z:A,k:.005}));P.push(C([0,-.9,0],[0,-1.05,0],.06,.0,{z:A,k:.01}));P.push(B([0,0,.012],[.012,.8,.006],.003,{op:1,z:G,k:.002}));
P.push(B([0,.92,0],[.2,.03,.035],.015,{z:A,k:.01}));P.push(C([0,.95,0],[0,1.25,0],.025,.025,{z:3,k:.01}));P.push(S([0,1.28,0],.04,{z:A,k:.01}));
return finish({h:.018,prims:P,pal:[[.3,.3,.3],[.55,.55,.6],[0,0,0],[.12,.08,.06]]})}
// ---------- first-person weapons (forward -Z, up +Y, grip at origin) ----------
const PI2=Math.PI/2,ZR={rot:[PI2,0,0]};const zr=o=>Object.assign({rot:[PI2,0,0]},o);
function grip(P,z0){P.push(B([0,-.055,.045+(z0||0)],[.016,.058,.026],.013,{z:0,k:.006,rot:[-.28,0,0]}));for(let i=0;i<4;i++)P.push(B([0,-.025-i*.022,.07+(z0||0)-i*.006],[.02,.004,.012],.003,{op:1,z:3,k:.002,rot:[-.28,0,0]}));
P.push(TO([0,-.01,-.005+(z0||0)],.024,.0045,{z:1,k:.003,rot:[0,0,PI2]}));P.push(C([0,.0,-.008+(z0||0)],[0,-.02,-.004+(z0||0)],.004,.003,{z:1,k:.002}))}
function rifle(){const P=[];
P.push(B([0,.058,-.04],[.026,.024,.2],.008,{z:1,k:.006}));P.push(B([0,.012,-.06],[.024,.03,.12],.009,{z:0,k:.008}));
P.push(B([.027,.06,-.06],[.002,.006,.1],.002,{op:1,z:2,k:.002}));P.push(B([-.027,.06,-.06],[.002,.006,.1],.002,{op:1,z:2,k:.002}));
P.push(B([0,.05,-.31],[.029,.034,.11],.012,{z:0,k:.006}));for(let i=0;i<5;i++)for(const s of[-1,1])P.push(B([s*.03,.05,-.24-i*.032],[.008,.016,.009],.004,{op:1,z:3,k:.003}));
P.push(Y([0,.055,-.45],.0105,.05,.002,zr({z:1,k:.003})));P.push(Y([0,.055,-.52],.017,.032,.004,zr({z:1,k:.003})));for(let i=0;i<3;i++)P.push(B([0,.055,-.5-i*.018],[.03,.004,.005],.001,{op:1,z:3,k:.002}));
P.push(B([0,.088,-.1],[.011,.006,.21],.002,{z:1,k:.003}));for(let i=0;i<20;i++)P.push(B([0,.095,-.29+i*.02],[.014,.003,.004],.001,{op:1,z:3,k:.001}));
P.push(B([0,.112,-.04],[.017,.02,.035],.006,{z:0,k:.004}));P.push(Y([0,.118,-.085],.016,.012,.003,zr({z:1,k:.003})));P.push(Y([0,.118,-.085],.012,.03,.002,zr({op:1,z:3,k:.002})));P.push(S([0,.118,-.075],.003,{z:2,k:.001}));
grip(P,0);
P.push(B([0,-.055,-.075],[.015,.05,.028],.006,{z:1,k:.004,rot:[.18,0,0],part:'mag'}));P.push(B([0,-.105,-.088],[.016,.012,.03],.006,{z:1,k:.004,rot:[.3,0,0],part:'mag'}));P.push(B([.016,-.05,-.075],[.002,.03,.012],.002,{op:1,z:2,k:.001,rot:[.18,0,0],part:'mag'}));P.push(B([0,-.003,-.072],[.017,.008,.03],.003,{z:3,k:.003}));
P.push(B([0,.035,.19],[.02,.036,.09],.01,{z:0,k:.008}));P.push(B([0,.03,.19],[.03,.017,.05],.008,{op:1,z:-1,k:.004}));P.push(B([0,.03,.285],[.022,.046,.012],.008,{z:3,k:.004}));
return finish({h:.0048,prims:P,pal:[[.075,.08,.085],[.2,.21,.23],[0,0,0],[.03,.03,.035]],ao:1,aoS:.006,cv:.05,cf:30,
rh:{p:[0,-.03,.045],r:[-.28,0,0]},lh:{p:[0,.022,-.3],r:[-PI2,Math.PI,0]},muzzle:[0,.055,-.56]})}
function shotgun(){const P=[];
P.push(B([0,.035,-.01],[.03,.048,.14],.012,{z:1,k:.006}));P.push(B([.031,.05,-.03],[.002,.012,.05],.003,{op:1,z:3,k:.002}));
P.push(Y([0,.06,-.33],.017,.22,.003,zr({z:1,k:.004})));P.push(Y([0,.018,-.29],.016,.17,.003,zr({z:1,k:.004})));
for(let i=0;i<3;i++){P.push(TO([0,.06,-.17-i*.05],.021,.0045,zr({z:1,k:.003})));P.push(TO([0,.06,-.195-i*.05],.019,.004,zr({z:2,k:.002})))}
P.push(B([0,.018,-.3],[.03,.027,.08],.012,{z:0,k:.006,part:'pump'}));for(let i=0;i<6;i++)P.push(TO([0,.018,-.245-i*.022],.033,.0045,zr({op:1,z:3,k:.003,part:'pump'})));P.push(B([0,-.016,-.05],[.012,.004,.04],.002,{op:1,z:3,k:.002}));
P.push(Y([0,.06,-.56],.022,.02,.005,zr({z:1,k:.003})));P.push(Y([0,.06,-.58],.012,.03,.002,zr({op:1,z:2,k:.002})));
P.push(B([0,.085,-.53],[.003,.008,.005],.002,{z:1,k:.002}));grip(P,.01);
P.push(B([0,.025,.2],[.023,.04,.1],.014,{z:0,k:.008,rot:[-.08,0,0]}));P.push(B([0,.012,.3],[.025,.052,.014],.008,{z:3,k:.004,rot:[-.08,0,0]}));
return finish({h:.005,prims:P,pal:[[.08,.075,.07],[.19,.2,.21],[0,0,0],[.03,.03,.03]],ao:1,aoS:.006,cv:.05,cf:30,
rh:{p:[0,-.03,.055],r:[-.28,0,0]},lh:{p:[0,.004,-.3],r:[-PI2,Math.PI,0]},muzzle:[0,.06,-.6]})}
function launcher(){const P=[];
P.push(Y([0,.07,-.1],.055,.42,.012,zr({z:3,k:.006})));P.push(Y([0,.07,-.5],.044,.08,.005,zr({op:1,z:0,k:.004})));P.push(Y([0,.07,.35],.042,.06,.005,zr({op:1,z:0,k:.004})));
P.push(Y([0,.07,-.47],.062,.03,.008,zr({z:1,k:.004})));P.push(Y([0,.07,.3],.064,.035,.008,zr({z:1,k:.004})));P.push(Y([0,.07,.0],.06,.02,.006,zr({z:1,k:.004})));
P.push(C([0,.07,-.44],[0,.07,-.36],.03,.03,{z:2,k:.01,part:'ammo'}));P.push(S([0,.07,-.44],.03,{z:2,k:.005,part:'ammo'}));
P.push(B([-.07,.11,-.12],[.016,.026,.055],.006,{z:0,k:.004}));P.push(Y([-.07,.112,-.18],.012,.01,.002,zr({z:2,k:.002})));P.push(B([-.05,.1,-.12],[.012,.008,.02],.003,{z:1,k:.004}));
for(let i=0;i<4;i++)P.push(TO([0,.07,-.32+i*.18],.056,.004,zr({op:1,z:0,k:.002})));
grip(P,.0);P.push(B([0,.005,.0],[.02,.02,.06],.008,{z:1,k:.006}));
P.push(B([0,-.035,-.24],[.014,.045,.018],.01,{z:0,k:.006,rot:[.1,0,0]}));P.push(B([0,.01,-.24],[.02,.015,.035],.006,{z:1,k:.006}));
return finish({h:.0058,prims:P,pal:[[.07,.07,.07],[.18,.19,.2],[0,0,0],[.2,.22,.15]],ao:1,aoS:.007,cv:.06,cf:20,
rh:{p:[0,-.03,.045],r:[-.28,0,0]},lh:{p:[0,-.04,-.24],r:[-.1,0,0]},muzzle:[0,.07,-.6]})}
function railgun(){const P=[];
P.push(B([0,.035,.0],[.03,.046,.17],.012,{z:0,k:.006}));for(const s of[-1,1])P.push(B([0,.075+s*.022,-.3],[.013,.008,.27],.003,{z:1,k:.003}));
P.push(B([0,.075,-.25],[.006,.014,.24],.002,{z:2,k:.002}));
for(let i=0;i<4;i++){P.push(TO([0,.075,-.12-i*.1],.042,.008,zr({z:1,k:.004})));P.push(TO([0,.075,-.12-i*.1],.042,.004,zr({op:1,z:2,k:.002})))}
P.push(Y([0,.115,.02],.016,.11,.004,zr({z:3,k:.005,part:'cell'})));for(let i=0;i<4;i++)P.push(B([.016,.115,-.06+i*.05],[.004,.006,.012],.002,{op:1,z:2,k:.002,part:'cell'}));P.push(B([0,.094,.02],[.012,.006,.1],.003,{z:1,k:.004}));
P.push(B([0,.035,-.17],[.026,.02,.05],.008,{z:1,k:.004}));grip(P,.0);
P.push(C([0,.05,.16],[0,.04,.3],.012,.012,{z:1,k:.006}));P.push(C([0,-.0,.12],[0,-.02,.3],.01,.01,{z:1,k:.006}));P.push(B([0,.012,.31],[.02,.05,.012],.008,{z:3,k:.006}));
return finish({h:.005,prims:P,pal:[[.12,.125,.135],[.3,.31,.33],[0,0,0],[.05,.05,.06]],ao:1,aoS:.006,cv:.05,cf:30,
rh:{p:[0,-.03,.045],r:[-.28,0,0]},lh:{p:[0,.03,-.17],r:[-PI2,Math.PI,0]},muzzle:[0,.075,-.58]})}
function voidgun(){const P=[];
P.push(E([0,.05,-.08],[.07,.065,.13],{z:1,k:.02}));for(let i=0;i<4;i++)P.push(B([0,.05,-.13+i*.035],[.08,.05,.008],.004,{op:1,z:-1,k:.006}));
P.push(S([0,.05,-.08],.05,{z:2,k:.004,part:'core'}));P.push(E([0,.045,.11],[.04,.05,.11],{z:0,k:.03}));
for(let i=0;i<3;i++){const a=i/3*Math.PI*2+PI2;P.push(...chain([[Math.cos(a)*.05,.05+Math.sin(a)*.05,-.17],[Math.cos(a)*.065,.05+Math.sin(a)*.065,-.27],[Math.cos(a)*.03,.05+Math.sin(a)*.03,-.38]],.016,.004,{z:1,k:.01}))}
P.push(S([0,.05,-.33],.018,{z:2,k:.004}));grip(P,.03);P.push(E([0,-.02,-.22],[.02,.04,.03],{z:0,k:.02}));
return finish({h:.005,prims:P,pal:[[.07,.06,.09],[.2,.17,.24],[0,0,0],[.05,.04,.07]],ao:1,aoS:.006,cv:.08,cf:20,
rh:{p:[0,-.03,.075],r:[-.28,0,0]},lh:{p:[0,-.02,-.22],r:[-.15,0,0]},muzzle:[0,.05,-.4]})}
// gloved hand gripping a vertical bar along local Y (front = -Z, back of hand toward +X); wrist at hand.wrist
function hand(){const P=[],G=3,SK=0,A=1,NAIL=[.62,.42,.38];
// grip cross-section ~ ellipse (a: sideways, b: front/back); points around it offset outward by off
const ea=.0175,eb=.027,rad=(t)=>1/Math.sqrt(Math.pow(Math.cos(t)/ea,2)+Math.pow(Math.sin(t)/eb,2));
const at=(t,y,off)=>{const r=rad(t)+off;return[r*Math.cos(t),y,-r*Math.sin(t)]};
const walk=(t,y,off,L)=>{let p0=at(t,y,off),d=0;while(d<L){const t2=t+.01,p1=at(t2,y,off);d+=Math.hypot(p1[0]-p0[0],p1[2]-p0[2]);t=t2;p0=p1}return t};
const D=Math.PI/180;
// palm pad wrapped around the back/right of the grip + heel
P.push(E(at(-28*D,.004,.011),[.012,.041,.022],{rot:[0,-28*D,0],z:G,k:.012}));P.push(E(at(-68*D,.0,.012),[.013,.043,.024],{rot:[0,-68*D,0],z:G,k:.012}));
P.push(E(at(-108*D,-.014,.012),[.014,.036,.02],{rot:[0,-108*D,0],z:G,k:.012}));
// back-of-hand knuckle guard

// fingers: [y, proximal, middle, distal, radius scale]
const F=[[.029,.04,.024,.019,1],[.009,.044,.027,.02,1.03],[-.011,.041,.025,.019,.98],[-.03,.032,.019,.017,.86]];
for(const[y,l1,l2,l3,sc]of F){const off=.0088*sc,t0=-10*D,t1=walk(t0,y,off,l1),t2=walk(t1,y,off,l2),t3=walk(t2,y,off,l3);
const p0=at(t0,y,off+.002),p1=at(t1,y-.001,off),p2=at(t2,y-.002,off),p3=at(t3,y-.002,off-.001),r1=.0093*sc,r2=.0084*sc,r3=.0076*sc;
P.push(C(p0,p1,r1,r1*.95,{z:G,k:.004}));P.push(S(p0,r1*1.15,{z:G,k:.006}));P.push(E(at(-16*D,y,.021),[.0035,.0075*sc,.008],{rot:[0,-16*D,0],z:A,k:.004}));P.push(S(p1,r1*1.02,{z:SK,k:.003}));
P.push(C(p1,p2,r2,r2*.95,{z:SK,k:.003}));P.push(S(p2,r2*1.02,{z:SK,k:.003}));P.push(C(p2,p3,r3,r3*.9,{z:SK,k:.003}));
const tn=(t2+t3)/2+4*D;P.push(E(at(tn,y-.002,off+r3*.72),[.0022,.0058*sc,.0068*sc],{rot:[0,tn,0],z:SK,k:.0015,col:NAIL}))}
// thumb: thenar pad + three segments wrapping over the back-left of the grip
P.push(E(at(-122*D,.0,.011),[.011,.021,.016],{rot:[0,-122*D,0],z:G,k:.01}));
const th=[at(-128*D,.008,.016),at(-162*D,.026,.012),at(170*D,.036,.0105),at(140*D,.04,.0095)];
P.push(C(th[0],th[1],.0115,.0108,{z:G,k:.006}));P.push(S(th[1],.0112,{z:SK,k:.003}));P.push(C(th[1],th[2],.0104,.0097,{z:SK,k:.003}));P.push(C(th[2],th[3],.0097,.0085,{z:SK,k:.003}));
P.push(E(at(152*D,.0405,.0095+.0068),[.0024,.0062,.0074],{rot:[0,152*D,0],z:SK,k:.0015,col:NAIL}));
// wrist + glove cuff
const wr=[.036,-.05,.062];P.push(C(at(-100*D,-.024,.012),wr,.021,.023,{z:G,k:.012}));P.push(Y([.034,-.046,.058],.026,.009,.004,{z:A,k:.004,rot:[.85,0,-.3]}));
return finish({h:.0026,prims:P,pal:[[.52,.36,.29],[.2,.21,.22],[0,0,0],[.06,.058,.055]],ao:1,aoS:.004,cv:.07,cf:45,wrist:wr})}
// forearm from wrist (origin) to elbow along +Y
function arm(){const P=[],SK=0,A=1,G=2,CL=3;
P.push(E([0,.035,0],[.026,.05,.021],{z:SK,k:.02}));P.push(C([0,.06,0],[0,.24,0],.028,.041,{z:SK,k:.02}));P.push(E([.007,.2,.003],[.039,.09,.033],{z:SK,k:.025}));
P.push(E([-.013,.16,-.004],[.025,.075,.025],{z:SK,k:.02}));P.push(C([0,.12,.0],[0,.13,.0],.0,.0,{z:SK,k:.01}));
P.push(C([0,.26,0],[0,.42,0],.05,.054,{z:CL,k:.015,n:.004}));P.push(TO([0,.255,0],.049,.014,{z:CL,k:.012,n:.003}));
P.push(B([0,.055,.023],[.012,.013,.006],.004,{z:A,k:.003}));P.push(B([0,.055,.028],[.008,.009,.002],.0015,{op:1,z:G,k:.001}));P.push(TO([0,.055,0],.027,.0035,{z:CL,k:.004}));
return finish({h:.0045,prims:P,pal:[[.52,.36,.29],[.2,.21,.22],[0,0,0],[.14,.15,.12]],ao:1,aoS:.005,cv:.07,cf:30,nf:60})}
function rocket(){const P=[];P.push(Y([0,0,0],.034,.15,.006,zr({z:3,k:.006})));P.push(C([0,0,-.15],[0,0,-.25],.034,.004,{z:1,k:.008}));P.push(C([0,0,-.2],[0,0,-.255],.016,.003,{z:2,k:.004}));
P.push(TO([0,0,-.1],.034,.004,zr({op:1,z:2,k:.002})));P.push(Y([0,0,.17],.026,.025,.004,zr({z:1,k:.004})));P.push(Y([0,0,.19],.018,.02,.002,zr({op:1,z:3,k:.002})));
for(let i=0;i<4;i++){const a=i*PI2+Math.PI/4;P.push(B([Math.cos(a)*.045,Math.sin(a)*.045,.13],[.0045,.022,.035],.003,{z:1,k:.004,rot:[0,0,a+PI2]}))}
return finish({h:.0045,prims:P,pal:[[.1,.1,.1],[.24,.25,.27],[0,0,0],[.2,.22,.15]],ao:1,aoS:.005,cv:.05,cf:25})}
const only=(f,part)=>()=>{const s=f();s.prims=s.prims.filter(p=>p.part===part);return s},without=f=>()=>{const s=f();s.prims=s.prims.filter(p=>!p.part);return s};
const list={rifle:without(rifle),rifle_mag:only(rifle,'mag'),shotgun:without(shotgun),shotgun_pump:only(shotgun,'pump'),launcher:without(launcher),launcher_ammo:only(launcher,'ammo'),railgun:without(railgun),railgun_cell:only(railgun,'cell'),voidgun:without(voidgun),voidgun_core:only(voidgun,'core'),rocket,hand,arm,soldier,elite,assassin,brute,drone,crawler,tank,titan,warden,core,shard,gem,sword};
return{list,rig}})();

return{SDF,MODELS}}
// ================= RENDERER + POST PROCESSING =================
const ren=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance',stencil:false});
ren.outputEncoding=THREE.LinearEncoding;ren.toneMapping=THREE.NoToneMapping;ren.shadowMap.enabled=true;ren.shadowMap.type=THREE.PCFSoftShadowMap;ren.autoClear=false;
ren.domElement.id='gl';document.body.prepend(ren.domElement);
const isGL2=ren.capabilities.isWebGL2,HDR=(isGL2&&ren.extensions.has('EXT_color_buffer_float'))||(!isGL2&&ren.extensions.has('OES_texture_half_float')&&ren.extensions.has('EXT_color_buffer_half_float'));
const FT=HDR?THREE.HalfFloatType:THREE.UnsignedByteType;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x020306);scene.fog=new THREE.FogExp2(0x05070c,.018);
const cam=new THREE.PerspectiveCamera(85,1,.05,400);cam.rotation.order='YXZ';scene.add(cam);
const vmScene=new THREE.Scene(),vmCam=new THREE.PerspectiveCamera(62,1,.01,10);
const SH={
quadV:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
bright:'uniform sampler2D t;uniform float th;varying vec2 vUv;void main(){vec3 c=min(texture2D(t,vUv).rgb,vec3(24.));float l=max(max(c.r,c.g),c.b);gl_FragColor=vec4(c*max(l-th,0.)/max(l,1e-4),1.);}',
down:'uniform sampler2D t;uniform vec2 px;varying vec2 vUv;void main(){vec4 s=texture2D(t,vUv)*4.;s+=texture2D(t,vUv-px);s+=texture2D(t,vUv+px);s+=texture2D(t,vUv+vec2(px.x,-px.y));s+=texture2D(t,vUv+vec2(-px.x,px.y));gl_FragColor=s*.125;}',
up:'uniform sampler2D t;uniform sampler2D tAdd;uniform vec2 px;uniform float k;varying vec2 vUv;void main(){vec4 s=texture2D(t,vUv+vec2(-px.x*2.,0.));s+=texture2D(t,vUv+vec2(-px.x,px.y))*2.;s+=texture2D(t,vUv+vec2(0.,px.y*2.));s+=texture2D(t,vUv+vec2(px.x,px.y))*2.;s+=texture2D(t,vUv+vec2(px.x*2.,0.));s+=texture2D(t,vUv+vec2(px.x,-px.y))*2.;s+=texture2D(t,vUv+vec2(0.,-px.y*2.));s+=texture2D(t,vUv+vec2(-px.x,-px.y))*2.;gl_FragColor=s/12.*k+texture2D(tAdd,vUv);}',
comp:`uniform sampler2D tScene;uniform sampler2D tBloom;uniform float bloom;uniform float exposure;uniform float vig;uniform float dmg;uniform float low;uniform float ca;uniform float fade;uniform float time;uniform float sat;uniform vec3 tint;varying vec2 vUv;
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){vec2 dc=vUv-.5;float r2=dot(dc,dc);vec3 col;
if(ca>0.){vec2 o=dc*ca*(.3+r2*2.);col=vec3(texture2D(tScene,vUv+o).r,texture2D(tScene,vUv).g,texture2D(tScene,vUv-o).b);}else col=texture2D(tScene,vUv).rgb;
col+=texture2D(tBloom,vUv).rgb*bloom;col*=exposure*tint;col=aces(col);float l=dot(col,vec3(.299,.587,.114));col=mix(vec3(l),col,sat);
col=pow(col,vec3(1./2.2));col+=vec3(-.012,.004,.018)*(1.-l);col*=1.-vig*r2*1.5;
float e=smoothstep(.06,.5,r2*2.2);col=mix(col,vec3(.55,0.,.02),e*clamp(dmg+low*(.45+.35*sin(time*5.)),0.,1.)*.75);
col*=1.-fade;gl_FragColor=vec4(col,1.);}`,
partV:'attribute float psize;attribute vec4 pcol;uniform float scale;varying vec4 vC;void main(){vC=pcol;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=min(psize*scale/max(-mv.z,.05),600.);gl_Position=projectionMatrix*mv;}',
partF:'uniform sampler2D map;varying vec4 vC;void main(){vec4 t=texture2D(map,gl_PointCoord);gl_FragColor=vec4(vC.rgb*t.rgb,vC.a*t.a);}',
shaftV:'varying float vY;varying vec3 vN;varying vec3 vV;void main(){vY=uv.y;vec4 wp=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}',
shaftF:'uniform vec3 color;uniform float op;varying float vY;varying vec3 vN;varying vec3 vV;void main(){float f=pow(abs(dot(normalize(vN),normalize(vV))),2.);float a=op*f*smoothstep(0.,.4,vY)*(.35+.65*vY);gl_FragColor=vec4(color*a,1.);}',
ringF:'uniform float prog;uniform vec3 color;uniform float time;varying vec2 vUv;void main(){vec2 p=vUv*2.-1.;float r=length(p);if(r>1.)discard;float edge=smoothstep(.9,.96,r)*(1.-smoothstep(.985,1.,r));float pulse=.6+.4*sin(time*24.);float fill=step(r,prog);float front=smoothstep(prog-.05,prog,r)*fill;float grid=step(.92,fract(r*7.-time*1.5))*.25;vec3 c=color*(edge*2.8*pulse+fill*(.22+grid)+front*1.8);gl_FragColor=vec4(c,1.);}',
ringV:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
fresV:'varying vec3 vN;varying vec3 vV;void main(){vec4 wp=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=normalize(cameraPosition-wp.xyz);gl_Position=projectionMatrix*viewMatrix*wp;}',
fresF:'uniform vec3 color;uniform float pw;uniform float time;varying vec3 vN;varying vec3 vV;void main(){float f=pow(1.-abs(dot(normalize(vN),normalize(vV))),pw);gl_FragColor=vec4(color*f*(1.+.25*sin(time*3.)),1.);}'};
const quadCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1),quadScene=new THREE.Scene(),quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),null);quad.frustumCulled=false;quadScene.add(quad);
const SM=(f,u)=>new THREE.ShaderMaterial({uniforms:u,vertexShader:SH.quadV,fragmentShader:f,depthTest:false,depthWrite:false});
const black=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1,THREE.RGBAFormat);black.needsUpdate=true;
const PP={bright:SM(SH.bright,{t:{value:null},th:{value:1}}),down:SM(SH.down,{t:{value:null},px:{value:new THREE.Vector2()}}),up:SM(SH.up,{t:{value:null},tAdd:{value:null},px:{value:new THREE.Vector2()},k:{value:1}}),
comp:SM(SH.comp,{tScene:{value:null},tBloom:{value:black},bloom:{value:.2},exposure:{value:1.05},vig:{value:.55},dmg:{value:0},low:{value:0},ca:{value:0},fade:{value:0},time:{value:0},sat:{value:1.08},tint:{value:new THREE.Vector3(1,1,1)}}),rt:null,mips:[],ups:[]};
const rtOpt=d=>({minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,format:THREE.RGBAFormat,type:FT,depthBuffer:!!d,stencilBuffer:false});
function setupPost(){const q=save.set.q,base=q===0?1:Math.min(devicePixelRatio,q===2?1.75:1.25),cpr=Math.max(.35,base*PERF.scale),pr=cpr;
const w=Math.max(2,innerWidth*pr|0),h=Math.max(2,innerHeight*pr|0);ren.setPixelRatio(cpr);ren.setSize(innerWidth,innerHeight,false);ren.domElement.style.width='100%';ren.domElement.style.height='100%';
if(PP.rt)PP.rt.dispose();PP.mips.forEach(r=>r.dispose());PP.ups.forEach(r=>r.dispose());PP.mips=[];PP.ups=[];
if(isGL2&&q>0&&THREE.WebGLMultisampleRenderTarget){PP.rt=new THREE.WebGLMultisampleRenderTarget(w,h,rtOpt(1));PP.rt.samples=q===2?4:2}else PP.rt=new THREE.WebGLRenderTarget(w,h,rtOpt(1));
if(q>0){let bw=w>>1,bh=h>>1;const n=q===2?6:5;for(let i=0;i<n;i++){PP.mips.push(new THREE.WebGLRenderTarget(Math.max(1,bw),Math.max(1,bh),rtOpt(0)));if(i>0)PP.ups.push(new THREE.WebGLRenderTarget(Math.max(1,bw),Math.max(1,bh),rtOpt(0)));bw>>=1;bh>>=1}}
cam.aspect=vmCam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();vmCam.updateProjectionMatrix();PP.comp.uniforms.tBloom.value=black;
ren.shadowMap.enabled=q>0;sun.castShadow=q>0;sun.shadow.mapSize.set(q===2?2048:1024,q===2?2048:1024);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}
if(PART)PART.forEach(p=>p.mat.uniforms.scale.value=h/(2*Math.tan(cam.fov*Math.PI/360)))}
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
const LAD_AUTO=[[2,1],[2,.85],[1,.85],[1,.72],[0,.72],[0,.6],[0,.5]];
const LAD_FIX={2:[[2,1],[2,.85],[2,.72],[2,.6],[2,.5]],1:[[1,1],[1,.85],[1,.72],[1,.6],[1,.5]],0:[[0,.75],[0,.65],[0,.55],[0,.5]]};
function perfInit(first){if(first){PERF.tier=gpuTier();
  // cheaper shadow filtering on modest chips: four taps instead of sixteen
  if(PERF.tier<2){const C=THREE.ShaderChunk,src=C.shadowmap_pars_fragment,a=src.indexOf('#if defined( SHADOWMAP_TYPE_PCF )\n'),b=src.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )',a);
   if(a>=0&&b>a){C.shadowmap_pars_fragment=src.slice(0,a)+'#if defined( SHADOWMAP_TYPE_PCF )\n vec2 tS=vec2(.7*shadowRadius)/shadowMapSize;\n shadow=(texture2DCompare(shadowMap,shadowCoord.xy+vec2(-tS.x,-tS.y),shadowCoord.z)+texture2DCompare(shadowMap,shadowCoord.xy+vec2(tS.x,-tS.y),shadowCoord.z)+texture2DCompare(shadowMap,shadowCoord.xy+vec2(-tS.x,tS.y),shadowCoord.z)+texture2DCompare(shadowMap,shadowCoord.xy+vec2(tS.x,tS.y),shadowCoord.z))*.25;\n'+src.slice(b);ren.shadowMap.type=THREE.PCFShadowMap}}}
 PERF.probe=null;PERF.fails={};PERF.floorUntil=0;PERF.floorWait=45e3;
 if(save.set.qa!==false&&save.set.qa!==0){PERF.ladder=LAD_AUTO;const t=PERF.tier;PERF.lvl=t>=2?0:t===1?2:t===0?4:6;PERF.top=t>=2?0:t===1?1:t===0?3:4}
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
function pass(mat,target){quad.material=mat;ren.setRenderTarget(target);ren.render(quadScene,quadCam)}
function renderFrame(showVM){ren.setRenderTarget(PP.rt);ren.clear();ren.render(scene,cam);if(showVM){ren.clearDepth();ren.render(vmScene,vmCam)}
const U=PP.comp.uniforms;U.tScene.value=PP.rt.texture;
if(PP.mips.length){PP.bright.uniforms.t.value=PP.rt.texture;PP.bright.uniforms.th.value=HDR?1.0:.82;pass(PP.bright,PP.mips[0]);
for(let i=1;i<PP.mips.length;i++){const s=PP.mips[i-1];PP.down.uniforms.t.value=s.texture;PP.down.uniforms.px.value.set(1/s.width,1/s.height);pass(PP.down,PP.mips[i])}
let src=PP.mips[PP.mips.length-1];for(let i=PP.mips.length-2;i>=1;i--){const tgt=PP.ups[i-1];PP.up.uniforms.t.value=src.texture;PP.up.uniforms.tAdd.value=PP.mips[i].texture;PP.up.uniforms.px.value.set(1/src.width,1/src.height);PP.up.uniforms.k.value=1;pass(PP.up,tgt);src=tgt}
U.tBloom.value=src.texture}else U.tBloom.value=black;
pass(PP.comp,null)}
// ================= ENVIRONMENT LIGHTING =================
const hemi=new THREE.HemisphereLight(0x5a6c96,0x0c0a10,.75);scene.add(hemi);
const sun=new THREE.DirectionalLight(0x9fb6ff,1.25);sun.position.set(8,40,6);sun.target.position.set(0,0,0);scene.add(sun,sun.target);
sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:5,far:80});sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;sun.shadow.radius=2;
let PART=null;
function buildEnvMap(){const es=new THREE.Scene(),bm=new THREE.MeshBasicMaterial({color:0x06080d,side:THREE.BackSide});es.add(new THREE.Mesh(new THREE.BoxGeometry(60,20,60),bm));
const panel=(c,k,x,y,z,w,h,ry,rx)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(k),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.set(rx||0,ry||0,0);es.add(m)};
panel(0x9fb6ff,6,0,9.9,0,16,16,0,Math.PI/2);for(let i=0;i<4;i++){const a=i*Math.PI/2;panel(i%2?0x00e5ff:0xff2a8a,3,Math.sin(a)*29.5,3,Math.cos(a)*29.5,40,.6,a);panel(0xffa040,1.5,Math.sin(a)*29.5,8,Math.cos(a)*29.5,30,.4,a)}
panel(0xff2a8a,4,0,1,0,3,3,0,Math.PI/2);const pm=new THREE.PMREMGenerator(ren);const t=pm.fromScene(es,.04).texture;pm.dispose();scene.environment=t;vmScene.environment=t;return t}
// ================= TEXTURES =================
function cv(w,h,f){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');f(x,w,h);return c}
function tex(c,rep,srgb){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;if(rep)t.repeat.set(rep[0],rep[1]);t.anisotropy=Math.min(8,ren.capabilities.getMaxAnisotropy());if(srgb)t.encoding=THREE.sRGBEncoding;return t}
function normalFrom(hc,str){const w=hc.width,h=hc.height,src=hc.getContext('2d').getImageData(0,0,w,h).data,o=document.createElement('canvas');o.width=w;o.height=h;const ox=o.getContext('2d'),img=ox.createImageData(w,h),d=img.data;
const H=(x,y)=>src[(((y+h)%h)*w+((x+w)%w))*4]/255;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(H(x+1,y)-H(x-1,y))*str,dy=(H(x,y+1)-H(x,y-1))*str,l=Math.hypot(dx,dy,1),i=(y*w+x)*4;
d[i]=(-dx/l*.5+.5)*255;d[i+1]=(dy/l*.5+.5)*255;d[i+2]=(1/l*.5+.5)*255;d[i+3]=255}ox.putImageData(img,0,0);return o}
const seeded=s=>()=>(s=(s*16807)%2147483647)/2147483647;
function blotch(x,w,h,n,a,col,rnd){for(let i=0;i<n;i++){const px=rnd()*w,py=rnd()*h,r=rnd()*w*.25+w*.05,g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,col.replace('A',a*rnd()));g.addColorStop(1,col.replace('A',0));x.fillStyle=g;x.fillRect(0,0,w,h)}}
function makeTextures(){const T={},r1=seeded(7);
// floor: big beveled plates
const FL=1024,plates=(x,mode)=>{x.fillStyle=mode==='h'?'#888':mode==='r'?'#8a8a8a':'#2a2f37';x.fillRect(0,0,FL,FL);const P=FL/2;
for(let i=0;i<2;i++)for(let j=0;j<2;j++){const px=i*P,py=j*P;if(mode==='h'){const g=x.createLinearGradient(0,0,0,1);x.fillStyle='#000';x.fillRect(px,py,P,P);for(let b=0;b<10;b++){const v=40+b*20;x.fillStyle=`rgb(${v},${v},${v})`;x.fillRect(px+b,py+b,P-2*b,P-2*b)}
x.fillStyle='#aaa';x.fillRect(px+24,py+24,P-48,P-48);if((i+j)%2===0){x.fillStyle='#8a8a8a';for(let k=0;k<6;k++)x.fillRect(px+60,py+70+k*64,P-120,14)}
x.fillStyle='#606060';for(const[a,b]of[[30,30],[P-30,30],[30,P-30],[P-30,P-30]]){x.beginPath();x.arc(px+a,py+b,9,0,TAU);x.fill()}}
else if(mode==='c'){x.fillStyle=(i+j)%2?'#3a4049':'#3f454e';x.fillRect(px+4,py+4,P-8,P-8);x.fillStyle='#22262c';x.fillRect(px,py,P,5);x.fillRect(px,py,5,P);
if((i+j)%2===0){x.fillStyle='#343a42';for(let k=0;k<6;k++)x.fillRect(px+60,py+70+k*64,P-120,14)}x.fillStyle='#4a4f57';for(const[a,b]of[[30,30],[P-30,30],[30,P-30],[P-30,P-30]]){x.beginPath();x.arc(px+a,py+b,8,0,TAU);x.fill()}}
else{x.fillStyle=(i+j)%2?'#7a7a7a':'#929292';x.fillRect(px,py,P,P);x.fillStyle='#b0b0b0';x.fillRect(px,py,P,8);x.fillRect(px,py,8,P)}}
const rn=seeded(mode==='h'?3:mode==='r'?5:9);if(mode==='c'){blotch(x,FL,FL,26,.18,'rgba(0,0,0,A)',rn);blotch(x,FL,FL,10,.08,'rgba(120,140,160,A)',rn)}if(mode==='r')blotch(x,FL,FL,30,.25,'rgba(40,40,40,A)',rn)};
const fh=cv(FL,FL,x=>plates(x,'h'));T.floorN=tex(normalFrom(fh,3),[15,15]);T.floor=tex(cv(FL,FL,x=>plates(x,'c')),[15,15],1);T.floorR=tex(cv(FL,FL,x=>plates(x,'r')),[15,15]);
// wall panels
const WW=1024,WH=512,wall=(x,mode)=>{x.fillStyle=mode==='h'?'#777':'#2c3139';x.fillRect(0,0,WW,WH);const cols=4,rows=2,pw=WW/cols,ph=WH/rows;
for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const px=i*pw,py=j*ph;if(mode==='h'){x.fillStyle='#333';x.fillRect(px,py,pw,ph);x.fillStyle='#999';x.fillRect(px+6,py+6,pw-12,ph-12);x.fillStyle='#6a6a6a';x.fillRect(px+30,py+30,pw-60,ph-60);
if(j===1&&i%2===0){x.fillStyle='#222';for(let k=0;k<7;k++)x.fillRect(px+50,py+60+k*22,pw-100,9)}}
else{x.fillStyle=(i+j)%2?'#323842':'#363c46';x.fillRect(px+6,py+6,pw-12,ph-12);x.fillStyle='#262b32';x.fillRect(px+30,py+30,pw-60,ph-60);x.fillStyle='#2e343c';x.fillRect(px+34,py+34,pw-68,ph-68);
if(j===1&&i%2===0){x.fillStyle='#0d0f12';for(let k=0;k<7;k++)x.fillRect(px+50,py+60+k*22,pw-100,9)}if(j===0&&i===1){x.fillStyle='#c8a227';x.font='bold 34px Arial';x.fillText('R-07',px+44,py+80)}}}
if(mode==='c')blotch(x,WW,WH,20,.2,'rgba(0,0,0,A)',seeded(11))};
const wh=cv(WW,WH,x=>wall(x,'h'));T.wallN=tex(normalFrom(wh,2.5),[7.5,3.5]);T.wall=tex(cv(WW,WH,x=>wall(x,'c')),[7.5,3.5],1);
// crate
const crate=(x,mode)=>{const S=512;x.fillStyle=mode==='h'?'#555':'#3b4a3a';x.fillRect(0,0,S,S);if(mode==='h'){x.fillStyle='#bbb';x.fillRect(0,0,S,40);x.fillRect(0,S-40,S,40);x.fillRect(0,0,40,S);x.fillRect(S-40,0,40,S);x.save();x.translate(S/2,S/2);x.rotate(Math.PI/4);x.fillRect(-S*.7,-20,S*1.4,40);x.restore();x.fillStyle='#777';x.fillRect(60,60,S-120,S-120);return}
const g=x.createLinearGradient(0,0,S,S);g.addColorStop(0,'#46553f');g.addColorStop(1,'#34412f');x.fillStyle=g;x.fillRect(0,0,S,S);x.fillStyle='#2a3326';x.fillRect(0,0,S,40);x.fillRect(0,S-40,S,40);x.fillRect(0,0,40,S);x.fillRect(S-40,0,40,S);
x.save();x.translate(S/2,S/2);x.rotate(Math.PI/4);x.fillRect(-S*.7,-20,S*1.4,40);x.restore();x.fillStyle='rgba(230,220,190,.75)';x.font='bold 54px Arial';x.textAlign='center';x.fillText('RFT-'+(100+ri(800)),S/2,S/2+130);
x.fillStyle='#d8a020';for(let i=0;i<5;i++){x.beginPath();x.moveTo(40+i*30,40);x.lineTo(60+i*30,40);x.lineTo(40,60+i*30);x.lineTo(40,40+i*30);x.fill()}blotch(x,S,S,10,.25,'rgba(0,0,0,A)',seeded(13))};
T.crateN=tex(normalFrom(cv(512,512,x=>crate(x,'h')),2.5));T.crate=tex(cv(512,512,x=>crate(x,'c')),null,1);
// barrel
T.barrel=tex(cv(256,512,x=>{x.fillStyle='#7a1712';x.fillRect(0,0,256,512);x.fillStyle='#5a0f0c';for(const y of[60,250,440])x.fillRect(0,y,256,18);x.fillStyle='#e0b020';x.fillRect(0,150,256,70);x.fillStyle='#111';for(let i=0;i<8;i++){x.beginPath();x.moveTo(i*40,150);x.lineTo(i*40+20,150);x.lineTo(i*40-10,220);x.lineTo(i*40-30,220);x.fill()}blotch(x,256,512,12,.3,'rgba(0,0,0,A)',seeded(17))}),null,1);
// hazard stripes
T.hazard=tex(cv(256,64,x=>{x.fillStyle='#d9a21b';x.fillRect(0,0,256,64);x.fillStyle='#121212';for(let i=-2;i<10;i++){x.beginPath();x.moveTo(i*32,0);x.lineTo(i*32+16,0);x.lineTo(i*32-16,64);x.lineTo(i*32-32,64);x.fill()}}),[4,1],1);
// soft glow sprite / flare / smoke / scorch / grating
T.glow=new THREE.CanvasTexture(cv(128,128,(x,w)=>{const g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.55)');g.addColorStop(.6,'rgba(255,255,255,.12)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128)}));
T.flare=new THREE.CanvasTexture(cv(128,128,x=>{x.translate(64,64);for(let i=0;i<6;i++){x.rotate(Math.PI/3);const g=x.createLinearGradient(0,0,60,0);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.moveTo(0,-5);x.lineTo(62,0);x.lineTo(0,5);x.fill()}const g=x.createRadialGradient(0,0,0,0,0,40);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(-64,-64,128,128)}));
T.smoke=new THREE.CanvasTexture(cv(128,128,x=>{const rn=seeded(21);for(let i=0;i<14;i++){const px=40+rn()*48,py=40+rn()*48,r=20+rn()*24,g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,128,128)}}));
T.scorch=new THREE.CanvasTexture(cv(128,128,x=>{const g=x.createRadialGradient(64,64,0,64,64,62);g.addColorStop(0,'rgba(0,0,0,.95)');g.addColorStop(.35,'rgba(10,8,6,.7)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,128,128)}));
T.beam=new THREE.CanvasTexture(cv(16,64,x=>{const g=x.createLinearGradient(0,0,0,64);g.addColorStop(0,'rgba(255,255,255,0)');g.addColorStop(.5,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,16,64)}));
T.grate=tex(cv(128,128,x=>{x.fillStyle='#000';x.fillRect(0,0,128,128);x.fillStyle='#fff';for(let i=0;i<128;i+=16){x.fillRect(i,0,4,128);x.fillRect(0,i,128,3)}}),[1,1]);
// nebula rift sky
T.sky=new THREE.CanvasTexture(cv(1024,512,(x,w,h)=>{x.fillStyle='#03030a';x.fillRect(0,0,w,h);const rn=seeded(31);
for(let i=0;i<40;i++){const px=rn()*w,py=h*.15+rn()*h*.6,r=60+rn()*220,c=rn()<.5?'120,40,200':rn()<.5?'20,140,220':'220,40,120',g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`rgba(${c},${.08+rn()*.12})`);g.addColorStop(1,`rgba(${c},0)`);x.fillStyle=g;x.fillRect(0,0,w,h)}
for(let i=0;i<900;i++){const v=rn();x.fillStyle=`rgba(255,255,255,${v*v})`;x.fillRect(rn()*w,rn()*h,v>.95?2:1,v>.95?2:1)}
x.strokeStyle='rgba(255,180,255,.9)';x.lineWidth=3;x.shadowColor='#ff40ff';x.shadowBlur=30;x.beginPath();let px=w*.3,py=h*.42;x.moveTo(px,py);for(let i=0;i<30;i++){px+=w*.014;py+=(rn()-.5)*24;x.lineTo(px,py)}x.stroke();x.lineWidth=1.5;x.stroke()}));T.sky.encoding=THREE.sRGBEncoding;
return T}
function signTex(text,color,w=1024,h=256,font=120){return new THREE.CanvasTexture(cv(w,h,x=>{x.fillStyle='#000';x.fillRect(0,0,w,h);x.font=`bold ${font}px "Rajdhani","Arial Narrow",Arial`;x.textAlign='center';x.textBaseline='middle';
x.shadowColor=color;x.shadowBlur=40;x.fillStyle=color;x.fillText(text,w/2,h/2);x.shadowBlur=12;x.fillStyle='#fff';x.globalAlpha=.85;x.fillText(text,w/2,h/2)}))}
function screenTex(seed,col){const rn=seeded(seed);return new THREE.CanvasTexture(cv(512,320,x=>{x.fillStyle='#02060a';x.fillRect(0,0,512,320);x.strokeStyle=col;x.globalAlpha=.9;x.lineWidth=2;x.strokeRect(10,10,492,300);x.font='20px monospace';x.fillStyle=col;
for(let i=0;i<9;i++){x.globalAlpha=.4+rn()*.6;x.fillText(['RIFT FLUX','CORE TEMP','CONTAINMENT','SECTOR 07','GRAV FIELD','ANOMALY','POWER BUS','VOID INDEX','SHIELD NET'][i]+'  '+(rn()*999|0).toString().padStart(3,'0')+'.'+(rn()*99|0),24,44+i*30)}
x.globalAlpha=.8;for(let i=0;i<10;i++){const bh=20+rn()*120;x.fillRect(330+i*16,290-bh,10,bh)}x.beginPath();for(let i=0;i<40;i++)x.lineTo(330+i*4,80+Math.sin(i*.6)*20+rn()*10);x.stroke()}))}
// ================= SCULPTED MODEL STREAMING (web workers) =================
const MOD={geo:{},meta:{},done:0,total:0,queue:[],busy:new Map(),workers:[],lib:null,cb:[]};
const MORDER=['rifle','rifle_mag','hand','arm','drone','soldier','gem','shotgun','shotgun_pump','railgun','railgun_cell','launcher','launcher_ammo','rocket','voidgun','voidgun_core','crawler','assassin','brute','elite','tank','shard','sword','titan','warden','core'];
function geoFrom(m,skinned){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.pos,3));g.setAttribute('normal',new THREE.BufferAttribute(m.nor,3));g.setAttribute('color',new THREE.BufferAttribute(m.col,3));
if(skinned){g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(m.si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(m.sw,4))}
g.setIndex(new THREE.BufferAttribute(m.idx,1));m.groups.forEach(([s,c,z])=>{if(c>0)g.addGroup(s,c,z)});g.computeBoundingSphere();g.computeBoundingBox();return g}
function onModel(n,meta,m){MOD.meta[n]=meta;MOD.geo[n]=geoFrom(m,meta.nb>1);MOD.done++;const cbs=MOD.cb.filter(c=>c.n===n);MOD.cb=MOD.cb.filter(c=>c.n!==n);cbs.forEach(c=>c.f())}
const whenModel=(n,f)=>{if(MOD.geo[n])f();else MOD.cb.push({n,f})};
const MH=n=>PERF.tier<1&&!/^(rifle|hand|arm|shotgun|railgun|launcher|voidgun|sword|gem|rocket)/.test(n)?1.45:1;
function pumpModels(){for(const w of MOD.workers){if(MOD.busy.has(w)||!MOD.queue.length)continue;const n=MOD.queue.shift();MOD.busy.set(w,n);w.postMessage({n,h:MH(n)})}}
function mainThreadModels(){if(!MOD.lib)MOD.lib=MODLIB();const step=()=>{if(!MOD.queue.length)return;const n=MOD.queue.shift();try{const spec=MOD.lib.MODELS.list[n]();if(MH(n)!==1)spec.h=(spec.h||.04)*MH(n);const m=MOD.lib.SDF.build(spec);onModel(n,{bones:spec.bones||null,nb:spec.nb,rh:spec.rh,lh:spec.lh,muzzle:spec.muzzle,wrist:spec.wrist,J:spec.J||null},m)}catch(e){console.error(e)}setTimeout(step,0)};step()}
function startModels(){MOD.queue=MORDER.slice();MOD.total=MOD.queue.length;
const src='const L=('+MODLIB.toString()+')();onmessage=e=>{const n=e.data.n,hs=e.data.h||1;const spec=L.MODELS.list[n]();if(hs!==1)spec.h=(spec.h||.04)*hs;const m=L.SDF.build(spec);const meta={bones:spec.bones||null,nb:spec.nb,rh:spec.rh,lh:spec.lh,muzzle:spec.muzzle,wrist:spec.wrist,J:spec.J||null};postMessage({n:n,meta:meta,m:m},[m.pos.buffer,m.nor.buffer,m.col.buffer,m.si.buffer,m.sw.buffer,m.idx.buffer])};';
try{const url=URL.createObjectURL(new Blob([src],{type:'text/javascript'})),nw=clamp((navigator.hardwareConcurrency||4)-1,1,4);
for(let i=0;i<nw;i++){const w=new Worker(url);w.onmessage=e=>{MOD.busy.delete(w);onModel(e.data.n,e.data.meta,e.data.m);pumpModels()};
w.onerror=ev=>{ev.preventDefault&&ev.preventDefault();const n=MOD.busy.get(w);MOD.busy.delete(w);MOD.workers=MOD.workers.filter(x=>x!==w);if(n)MOD.queue.unshift(n);try{w.terminate()}catch(e){}if(!MOD.workers.length&&!MOD.fallback){MOD.fallback=1;mainThreadModels()}else pumpModels()};MOD.workers.push(w)}
pumpModels()}catch(e){MOD.fallback=1;mainThreadModels()}}

// ================= ARENA: "RIFT CONTAINMENT HALL" =================
const A=30,HT=14,SKY=9;// half size, ceiling height, skylight half size
const W={ob:[],solid:[],props:[],layouts:[],L:null,strips:[],stripsB:[],lights:[],doors:[],gens:[],signs:[],theme:0,crates:[],barrels:[],group:new THREE.Group()};scene.add(W.group);
let TX=null;
const glowMat=(c,k,o={})=>new THREE.MeshBasicMaterial(Object.assign({color:new THREE.Color(c).multiplyScalar(k)},o));
const std=(o)=>new THREE.MeshStandardMaterial(o);
function mesh(g,m,x,y,z,o={}){const me=new THREE.Mesh(g,m);me.position.set(x,y,z);if(o.ry)me.rotation.y=o.ry;if(o.rx)me.rotation.x=o.rx;if(o.rz)me.rotation.z=o.rz;me.castShadow=o.cast??true;me.receiveShadow=o.recv??true;(o.parent||W.group).add(me);if(o.solid)W.solid.push(me);return me}
function bevelBox(w,h,d,b){const s=new THREE.Shape(),hw=w/2-b,hh=h/2-b;s.moveTo(-hw,-hh-b);s.lineTo(hw,-hh-b);s.quadraticCurveTo(hw+b,-hh-b,hw+b,-hh);s.lineTo(hw+b,hh);s.quadraticCurveTo(hw+b,hh+b,hw,hh+b);s.lineTo(-hw,hh+b);s.quadraticCurveTo(-hw-b,hh+b,-hw-b,hh);s.lineTo(-hw-b,-hh);s.quadraticCurveTo(-hw-b,-hh-b,-hw,-hh-b);
const g=new THREE.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b*.9,bevelSegments:2,curveSegments:3});g.translate(0,0,-(d-2*b)/2);g.computeVertexNormals();return g}
// box UVs so textures map per face on ExtrudeGeometry
function boxUV(g,w,h,d){const p=g.attributes.position,n=g.attributes.normal,uv=new Float32Array(p.count*2);for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),ax=Math.abs(n.getX(i)),ay=Math.abs(n.getY(i)),az=Math.abs(n.getZ(i));
let u,v;if(ax>=ay&&ax>=az){u=z/d+.5;v=y/h+.5}else if(ay>=az){u=x/w+.5;v=z/d+.5}else{u=x/w+.5;v=y/h+.5}uv[2*i]=u;uv[2*i+1]=v}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));return g}
const THEMES=[{a:0x16e8ff,b:0xff2a8a,c:0xffa640,fog:0x04070d,sun:0x9fb6ff},{a:0xffa640,b:0x3dffc8,c:0xff4040,fog:0x0a0706,sun:0xffd2a0},{a:0x8a6cff,b:0x30ff90,c:0x16e8ff,fog:0x06050c,sun:0xb8a6ff},{a:0xff3a24,b:0xffb030,c:0xff3a24,fog:0x0c0405,sun:0xffb09a}];
let MAT={};
function buildWorld(){TX=makeTextures();buildEnvMap();
MAT={floor:std({map:TX.floor,normalMap:TX.floorN,roughnessMap:TX.floorR,roughness:1,metalness:.55,envMapIntensity:.7}),
wall:std({map:TX.wall,normalMap:TX.wallN,roughness:.55,metalness:.65,envMapIntensity:.6}),
metal:std({color:0x2c3139,roughness:.32,metalness:.9,envMapIntensity:1}),dark:std({color:0x14171c,roughness:.55,metalness:.8,envMapIntensity:.6}),
paint:std({color:0x3a4048,roughness:.6,metalness:.4}),hazard:std({map:TX.hazard,roughness:.6,metalness:.3}),
crate:std({map:TX.crate,normalMap:TX.crateN,roughness:.7,metalness:.25,envMapIntensity:.5}),barrel:std({map:TX.barrel,roughness:.45,metalness:.5}),
grate:std({color:0x30353d,alphaMap:TX.grate,alphaTest:.5,side:THREE.DoubleSide,roughness:.4,metalness:.9}),concrete:std({color:0x4a4d52,roughness:.85,metalness:.05,map:TX.wall})};
// floor
const fl=mesh(new THREE.PlaneGeometry(2*A,2*A),MAT.floor,0,0,0,{rx:-Math.PI/2,cast:false,solid:1});fl.userData.floor=1;
// walls
for(let i=0;i<4;i++){const a=i*Math.PI/2,sx=Math.sin(a),sz=Math.cos(a);const w=mesh(new THREE.PlaneGeometry(2*A,HT),MAT.wall,-sx*A,HT/2,-sz*A,{ry:a,cast:false,solid:1});
mesh(new THREE.BoxGeometry(2*A,.6,.5),MAT.dark,-sx*(A-.2),.3,-sz*(A-.2),{ry:a});mesh(new THREE.BoxGeometry(2*A,.5,.6),MAT.dark,-sx*(A-.25),HT-.25,-sz*(A-.25),{ry:a});
const pipe=mesh(new THREE.CylinderGeometry(.22,.22,2*A,12),MAT.metal,-sx*(A-.55),11,-sz*(A-.55));pipe.rotation.set(0,a,Math.PI/2);
const pipe2=mesh(new THREE.CylinderGeometry(.12,.12,2*A,10),MAT.dark,-sx*(A-.45),11.55,-sz*(A-.45));pipe2.rotation.set(0,a,Math.PI/2)}
// buttresses + light strips + catwalk
const bs=new THREE.Shape();bs.moveTo(0,0);bs.lineTo(1.4,0);bs.lineTo(1.4,.7);bs.lineTo(.95,3);bs.lineTo(.7,HT);bs.lineTo(0,HT);
const bg=new THREE.ExtrudeGeometry(bs,{depth:.8,bevelEnabled:true,bevelThickness:.05,bevelSize:.05,bevelSegments:2});bg.translate(0,0,-.4);bg.computeVertexNormals();
const stripG=new THREE.BoxGeometry(5.6,.07,.07),sA=glowMat(0x16e8ff,4),sB=glowMat(0xff2a8a,3.2);W.stripMatA=sA;W.stripMatB=sB;
for(let i=0;i<4;i++){const a=i*Math.PI/2,sx=Math.sin(a),sz=Math.cos(a),tx=Math.cos(a),tz=-Math.sin(a);
for(let k=-4;k<=4;k++){const t=k*7.5,px=-sx*A+tx*t,pz=-sz*A+tz*t;if(Math.abs(t)>27)continue;const b=mesh(bg,MAT.metal,px,0,pz);b.rotation.y=a-Math.PI/2;if(Math.abs(t)>4)W.ob.push({x:px+sx*.8,z:pz+sz*.8,r:.85,h:20});
if(k<4&&Math.abs(t+3.75)>4){const c=t+3.75;mesh(stripG,sA,-sx*(A-.08)+tx*c,3.1,-sz*(A-.08)+tz*c,{ry:a,cast:false});mesh(stripG,sB,-sx*(A-.08)+tx*c,9.3,-sz*(A-.08)+tz*c,{ry:a,cast:false})}}
// catwalk
const cw=mesh(new THREE.PlaneGeometry(2*A-4.4,2.2),MAT.grate,-sx*(A-1.6),7,-sz*(A-1.6),{cast:true});cw.rotation.order='YXZ';cw.rotation.set(-Math.PI/2,a,0);
const rail=mesh(new THREE.BoxGeometry(2*A-4.6,.06,.06),MAT.metal,-sx*(A-2.7),8.05,-sz*(A-2.7),{ry:a});mesh(new THREE.BoxGeometry(2*A-4.6,.04,.04),MAT.metal,-sx*(A-2.7),7.55,-sz*(A-2.7),{ry:a});
for(let k=-8;k<=8;k++){const t=k*3.2;mesh(new THREE.CylinderGeometry(.03,.03,1.05,6),MAT.metal,-sx*(A-2.7)+tx*t,7.52,-sz*(A-2.7)+tz*t,{cast:false})}
mesh(new THREE.BoxGeometry(2*A-4.4,.16,.12),MAT.dark,-sx*(A-2.7),6.95,-sz*(A-2.7),{ry:a})}
// doors (enemy spawn gates)
const fs=new THREE.Shape();fs.moveTo(-3.6,0);fs.lineTo(3.6,0);fs.lineTo(3.6,6.8);fs.lineTo(-3.6,6.8);fs.lineTo(-3.6,0);const hole=new THREE.Path();hole.moveTo(-2.6,0);hole.lineTo(2.6,0);hole.lineTo(2.6,5.4);hole.lineTo(1.9,6);hole.lineTo(-1.9,6);hole.lineTo(-2.6,5.4);hole.lineTo(-2.6,0);fs.holes.push(hole);
const fg=new THREE.ExtrudeGeometry(fs,{depth:.7,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:2});fg.computeVertexNormals();
const names=['SECTOR A','SECTOR B','SECTOR C','SECTOR D'];
for(let i=0;i<4;i++){const a=i*Math.PI/2,sx=Math.sin(a),sz=Math.cos(a);const d={x:-sx*(A-1.6),z:-sz*(A-1.6),a,open:0,t:0};
const f=mesh(fg,MAT.metal,-sx*(A-.05),0,-sz*(A-.05),{ry:a});f.position.y=0;
const pg=new THREE.Group();pg.position.set(-sx*(A-.35),0,-sz*(A-.35));pg.rotation.y=a;W.group.add(pg);
d.L=mesh(new THREE.BoxGeometry(2.62,5.95,.25),MAT.paint,-1.3,2.98,0,{parent:pg});d.R=mesh(new THREE.BoxGeometry(2.62,5.95,.25),MAT.paint,1.3,2.98,0,{parent:pg});
for(const p of[d.L,d.R]){const hz=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.5),MAT.hazard);hz.position.set(0,-1.6,.13);p.add(hz);const hz2=hz.clone();hz2.position.y=1.9;p.add(hz2)}
d.lamp=mesh(new THREE.BoxGeometry(1.4,.14,.14),glowMat(0x33ff66,4),0,6.35,.3,{parent:pg,cast:false});d.name=names[i];
d.glow=mesh(new THREE.PlaneGeometry(5.3,5.9),new THREE.MeshBasicMaterial({map:TX.glow,color:new THREE.Color(0x7dffb0).multiplyScalar(2.2),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}),0,2.95,-.28,{parent:pg,cast:false,recv:false});d.glow.visible=false;
d.core=mesh(new THREE.PlaneGeometry(5.1,5.7),new THREE.MeshBasicMaterial({color:new THREE.Color(0x1a4a3a)}),0,2.9,-.3,{parent:pg,cast:false,recv:false});d.core.visible=false;
const sg=new THREE.Mesh(new THREE.PlaneGeometry(4,1),new THREE.MeshBasicMaterial({map:signTex(names[i],'#ffb347',1024,256,140),color:new THREE.Color(2.2,2.2,2.2),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));sg.position.set(0,7.6,.45);pg.add(sg);
W.doors.push(d)}
// ceiling with skylight
const cm=std({color:0x0e1014,roughness:.8,metalness:.6});const cs=(w,d,x,z)=>mesh(new THREE.BoxGeometry(w,.4,d),cm,x,HT+.2,z,{cast:true,solid:1});
cs(2*A,A-SKY,0,-(A+SKY)/2);cs(2*A,A-SKY,0,(A+SKY)/2);cs(A-SKY,2*SKY,-(A+SKY)/2,0);cs(A-SKY,2*SKY,(A+SKY)/2,0);
for(let k=-4;k<=4;k++){mesh(new THREE.BoxGeometry(.5,.8,2*A),MAT.dark,k*7.5,HT-.4,0,{cast:true,recv:false});mesh(new THREE.BoxGeometry(2*A,.6,.4),MAT.dark,0,HT-.95,k*7.5,{cast:true,recv:false})}
const sky=new THREE.Mesh(new THREE.SphereGeometry(190,48,24),new THREE.MeshBasicMaterial({map:TX.sky,side:THREE.BackSide,fog:false,color:new THREE.Color(1.6,1.6,1.8)}));sky.rotation.x=.3;scene.add(sky);W.sky=sky;
// skylight volumetric shaft
const shaft=mesh(new THREE.CylinderGeometry(SKY*1.25,SKY*1.75,HT,4,1,true),new THREE.ShaderMaterial({uniforms:{color:{value:new THREE.Color(0x7d96ff)},op:{value:.11}},vertexShader:SH.shaftV,fragmentShader:SH.shaftF,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,side:THREE.DoubleSide}),0,HT/2,0,{cast:false});shaft.rotation.y=Math.PI/4;W.shaft=shaft;
// shared layout lights (fixed count so materials never recompile)
W.coreLight=new THREE.PointLight(0xff2a8a,3,34,1.6);W.coreLight.position.set(0,4.4,0);scene.add(W.coreLight);
for(let i=0;i<4;i++){const l=new THREE.PointLight(0x16e8ff,1.6,16,1.5);scene.add(l);W.gens.push({light:l,coil:[]})}
// central reactor (used by several layouts)
W.reactor=new THREE.Group();W.group.add(W.reactor);const RP={parent:W.reactor};
const rp=[[4.4,0],[4.4,.3],[4,.45],[3.9,.9],[3.2,1.05],[3,1.6],[2.2,1.8],[1.6,2.1],[1.2,2.4],[0,2.5]].map(p=>new THREE.Vector2(p[0],p[1]));W.reactorSolid=mesh(new THREE.LatheGeometry(rp,48),MAT.metal,0,0,0,RP);
const hz=mesh(new THREE.RingGeometry(4.7,5.1,72),MAT.hazard,0,.012,0,{rx:-Math.PI/2,cast:false,parent:W.reactor});hz.material=MAT.hazard.clone();hz.material.polygonOffset=true;hz.material.polygonOffsetFactor=-2;
W.coreMat=glowMat(0xff2a8a,5);W.core=mesh(new THREE.IcosahedronGeometry(1.5,4),W.coreMat,0,4.4,0,{cast:false,parent:W.reactor});
W.shell=mesh(new THREE.SphereGeometry(2.1,32,24),new THREE.ShaderMaterial({uniforms:{color:{value:new THREE.Color(0xff3aa0).multiplyScalar(2.2)},pw:{value:2.2},time:{value:0}},vertexShader:SH.fresV,fragmentShader:SH.fresF,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}),0,4.4,0,{cast:false,parent:W.reactor});
W.rings=[];for(let i=0;i<3;i++){const r=mesh(new THREE.TorusGeometry(2.7+i*.35,.13,12,64),MAT.metal,0,4.4,0,RP);r.rotation.set(Math.PI/2+(i-1)*.6,i*.9,0);W.rings.push(r)}
for(let i=0;i<4;i++){const a=i/4*TAU;const c=new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a)*3.6,.9,Math.sin(a)*3.6),new THREE.Vector3(Math.cos(a)*3.2,2.6,Math.sin(a)*3.2),new THREE.Vector3(Math.cos(a)*2.1,3.6,Math.sin(a)*2.1)]);mesh(new THREE.TubeGeometry(c,16,.18,10),MAT.dark,0,0,0,RP)}
W.beam=mesh(new THREE.CylinderGeometry(.45,.8,16,24,1,true),new THREE.ShaderMaterial({uniforms:{color:{value:new THREE.Color(0xff5ab8)},op:{value:1.2}},vertexShader:SH.shaftV,fragmentShader:SH.shaftF,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,side:THREE.DoubleSide}),0,14,0,{cast:false,parent:W.reactor});W.beam.rotation.x=Math.PI;
buildLayouts(sA,sB);
// terminals
const ts=new THREE.Shape();ts.moveTo(0,0);ts.lineTo(.9,0);ts.lineTo(.9,.9);ts.lineTo(.55,1.25);ts.lineTo(0,1.25);ts.lineTo(0,0);const tg=new THREE.ExtrudeGeometry(ts,{depth:1.6,bevelEnabled:true,bevelThickness:.03,bevelSize:.03,bevelSegments:1});tg.translate(0,0,-.8);
const scr=['#4dfcff','#ffb347','#7dff9a'];
for(let i=0;i<8;i++){const wi=i%4,a=wi*Math.PI/2,sx=Math.sin(a),sz=Math.cos(a),tx=Math.cos(a),tz=-Math.sin(a),t=(i<4?-1:1)*11.25,px=-sx*(A-.1)+tx*t,pz=-sz*(A-.1)+tz*t;
const tm=mesh(tg,MAT.paint,px,0,pz,{solid:1});tm.rotation.y=a-Math.PI/2;W.ob.push({x:px+sx*.5,z:pz+sz*.5,r:1,h:1.3});
const sc=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.42),new THREE.MeshBasicMaterial({map:screenTex(i+3,scr[i%3]),color:new THREE.Color(1.6,1.6,1.6)}));sc.position.set(.73,1.08,0);sc.rotation.set(0,Math.PI/2,0);sc.rotateX(-.79);tm.add(sc)}
// neon signs
const signs=[['RIFT CONTAINMENT','#ff3aa0'],['SECTOR 07','#4dfcff'],['⚠ HIGH ENERGY ⚠','#ffb347'],['NO UNAUTHORIZED ENTRY','#7dff9a']];
for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4,wi=i,aw=wi*Math.PI/2,sx=Math.sin(aw),sz=Math.cos(aw),tx=Math.cos(aw),tz=-Math.sin(aw),t=15;
const s=new THREE.Mesh(new THREE.PlaneGeometry(9,2.2),new THREE.MeshBasicMaterial({map:signTex(signs[i][0],signs[i][1],1400,340,150),color:new THREE.Color(2.4,2.4,2.4),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));
s.position.set(-sx*(A-.12)+tx*t,10.5,-sz*(A-.12)+tz*t);s.rotation.y=aw;W.group.add(s);W.signs.push(s)}
// floor guide lines
for(let i=0;i<4;i++){const a=i*Math.PI/2;const l=mesh(new THREE.PlaneGeometry(.1,20),glowMat(0x16e8ff,1.4),Math.sin(a)*16,.015,Math.cos(a)*16,{rx:-Math.PI/2,cast:false,recv:false});l.rotation.z=a;W.strips.push(l)}
// dust motes
const N=700,dp=new Float32Array(N*3),dc=new Float32Array(N*4),ds=new Float32Array(N);for(let i=0;i<N;i++){dp[3*i]=rr(-A,A);dp[3*i+1]=rr(0,HT);dp[3*i+2]=rr(-A,A);dc.set([.6,.7,.9,.25+R()*.3],4*i);ds[i]=rr(.04,.09)}
const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(dp,3));dg.setAttribute('pcol',new THREE.BufferAttribute(dc,4));dg.setAttribute('psize',new THREE.BufferAttribute(ds,1));
const dm=new THREE.ShaderMaterial({uniforms:{map:{value:TX.glow},scale:{value:400}},vertexShader:SH.partV,fragmentShader:SH.partF,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false});W.dust=new THREE.Points(dg,dm);W.dust.frustumCulled=false;scene.add(W.dust);
W.shellOb=W.ob.length;W.shellSolid=W.solid.slice();setLayout(0)}
// randomized cover layout per run
function layout(boss){for(const p of W.props){W.group.remove(p);const i=W.solid.indexOf(p);if(i>=0)W.solid.splice(i,1)}W.props=[];W.crates=[];W.barrels=[];W.ob.length=W.staticOb;
const crateG=[boxUV(bevelBox(1.3,1.3,1.3,.06),1.3,1.3,1.3),boxUV(bevelBox(.9,.9,.9,.05),.9,.9,.9)];const barG=new THREE.LatheGeometry([[0,0],[.42,0],[.45,.05],[.45,.25],[.48,.3],[.45,.35],[.45,.95],[.48,1],[.45,1.05],[.45,1.25],[.42,1.3],[0,1.3]].map(p=>new THREE.Vector2(p[0],p[1])),24);
const coverG=bevelBox(3.2,1.15,.7,.12);
const free=(x,z,r)=>Math.hypot(x,z)>(boss?13:6.5)&&Math.hypot(x,z)<(boss?20:99)&&W.ob.every(o=>Math.hypot(o.x-x,o.z-z)>o.r+r+1.2)&&Math.abs(x)<A-3&&Math.abs(z)<A-3&&!W.doors.some(d=>Math.hypot(d.x-x,d.z-z)<5)&&Math.hypot(x,z-20)>3;
let tries=0,clusters=0;while(clusters<(boss?5:11)&&tries++<400){const a=R()*TAU,rad=rr(7.5,25),x=Math.cos(a)*rad,z=Math.sin(a)*rad;if(!free(x,z,2))continue;clusters++;const kind=R();
if(kind<.35){const c=mesh(coverG,MAT.concrete,x,.575,z,{ry:R()*Math.PI,solid:1});W.props.push(c);const ca=c.rotation.y,ux=Math.cos(ca),uz=-Math.sin(ca);for(const t of[-1.1,0,1.1])W.ob.push({x:x+ux*t,z:z+uz*t,r:.62,h:1.15})}
else{const n=1+ri(3);for(let k=0;k<n;k++){const big=R()<.6,s=big?1.3:.9,ox=k?rr(-1.4,1.4):0,oz=k?rr(-1.4,1.4):0;if(k&&!free(x+ox,z+oz,.4)&&k>0)continue;
const c=mesh(crateG[big?0:1],MAT.crate,x+ox,s/2,z+oz,{ry:R()*TAU,solid:1});const cr={m:c,hp:big?60:35,x:x+ox,z:z+oz,r:s*.62,h:s,kind:'crate'};c.userData.prop=cr;W.props.push(c);W.crates.push(cr);W.ob.push(cr);
if(big&&R()<.35){const c2=mesh(crateG[1],MAT.crate,x+ox,1.3+.45,z+oz,{ry:R()*TAU,solid:1});const c2r={m:c2,hp:30,x:x+ox,z:z+oz,r:0,h:2.2,kind:'crate',top:1};cr.h=2.2;cr.topC=c2r;c2.userData.prop=c2r;W.props.push(c2);W.crates.push(c2r)}}
if(R()<.55){const bx=x+rr(-1.8,1.8),bz=z+rr(-1.8,1.8);if(free(bx,bz,.3)||true){const b=mesh(barG,MAT.barrel,bx,0,bz,{ry:R()*TAU,solid:1});const br={m:b,hp:20,x:bx,z:bz,r:.5,h:1.3,kind:'barrel'};b.userData.prop=br;W.props.push(b);W.barrels.push(br);W.ob.push(br)}}}}}
function setTheme(i){W.theme=i;const t=THEMES[i];W.stripMatA.color.set(t.a).multiplyScalar(4);W.stripMatB.color.set(t.b).multiplyScalar(3.2);scene.fog.color.set(t.fog);sun.color.set(t.sun);W.gens.forEach(g=>{g.light.color.set(g.fixedColor??t.a);g.coil.forEach(c=>c.material.color.set(t.a).multiplyScalar(3.5))})}

// ================= ARENA LAYOUTS =================
const LAYOUTS=[];
function buildLayouts(sA,sB){const pillarProf=[[1.5,0],[1.5,.35],[1.3,.5],[1.3,.7],[1.08,.95],[1,1.2],[1,12.5],[1.1,12.7],[1.32,13.1],[1.32,13.6],[1.05,13.8],[1,14]].map(p=>new THREE.Vector2(p[0],p[1]));
const pillarG=new THREE.LatheGeometry(pillarProf,40),ringG=new THREE.TorusGeometry(1.02,.045,8,48),stripG=new THREE.BoxGeometry(.1,9.5,.05);
const mk=(name,theme,reactor,f)=>{const L={name,theme,reactor,group:new THREE.Group(),ob:[],solid:[],lights:[],core:{p:[0,4.4,0],c:0xff2a8a,k:3},fog:.018,anim:null,center:[]};L.group.visible=false;W.group.add(L.group);
L.m=(g,m,x,y,z,o={})=>{const me=mesh(g,m,x,y,z,Object.assign({},o,{parent:L.group,solid:0}));if(o.solid)L.solid.push(me);return me};f(L);W.layouts.push(L)};
const pillar=(L,x,z,c)=>{L.m(pillarG,MAT.metal,x,0,z,{solid:1});L.ob.push({x,z,r:1.45,h:20});for(const y of[1.25,12.3]){const r=L.m(ringG,c?sA:sB,x,y,z,{cast:false});r.rotation.x=Math.PI/2}
for(let k=0;k<4;k++){const b=k/4*TAU;L.m(stripG,glowMat(c?0x16e8ff:0xff2a8a,.9),x+Math.cos(b)*1.01,6.8,z+Math.sin(b)*1.01,{ry:-b+Math.PI/2,cast:false})}};
// 1) CONTAINMENT HALL — pillar ring, reactor, corner generators
mk('CONTAINMENT HALL',-1,true,L=>{for(let i=0;i<8;i++){const a=i/8*TAU+TAU/16;pillar(L,Math.cos(a)*17,Math.sin(a)*17,i%2)}
for(let i=0;i<8;i++){const a0=i/8*TAU+TAU/16,a1=(i+1)/8*TAU+TAU/16,p0=new THREE.Vector3(Math.cos(a0)*17,12,Math.sin(a0)*17),p1=new THREE.Vector3(Math.cos(a1)*17,12,Math.sin(a1)*17),m=p0.clone().lerp(p1,.5);m.y=9.4;
L.m(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0,p0.clone().lerp(m,.55).setY(10.6),m,p1.clone().lerp(m,.55).setY(10.6),p1]),24,.05,6),MAT.dark,0,0,0,{cast:false})}
const gp=[[1.5,0],[1.5,.4],[1.2,.6],[1.2,1.2],[1.35,1.3],[1.35,1.5],[1.1,1.6],[1.1,3.6],[1.35,3.7],[1.35,3.9],[1,4.1],[.6,4.4],[.3,4.5]].map(p=>new THREE.Vector2(p[0],p[1])),gg=new THREE.LatheGeometry(gp,32);
for(let i=0;i<4;i++){const x=(i%2?1:-1)*23.5,z=(i<2?1:-1)*23.5;L.m(gg,MAT.metal,x,0,z,{solid:1});L.ob.push({x,z,r:1.6,h:4.6});
for(let k=0;k<4;k++){const c=L.m(new THREE.TorusGeometry(1.14,.07,8,40),glowMat(0x16e8ff,3.5),x,1.9+k*.45,z,{cast:false});c.rotation.x=Math.PI/2;W.gens[i].coil.push(c)}
L.m(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x,4.3,z),new THREE.Vector3(x,7,z),new THREE.Vector3(x+(x>0?1:-1)*3,9,z+(z>0?1:-1)*3),new THREE.Vector3(x+(x>0?1:-1)*5.8,9.5,z+(z>0?1:-1)*5.8)]),30,.28,10),MAT.dark,0,0,0);
L.lights.push({p:[x*.92,3,z*.92],c:null,k:1.6})}});
// 2) FOUNDRY — molten pit, smelter towers, crane
mk('THE FOUNDRY',1,false,L=>{L.core={p:[0,1.6,0],c:0xff6a1a,k:4.5};L.fog=.02;
const rim=[[6.3,0],[6.3,.7],[6.0,.95],[5.6,1.0],[5.4,.8],[5.3,.4]].map(p=>new THREE.Vector2(p[0],p[1]));L.m(new THREE.LatheGeometry(rim,64),MAT.metal,0,0,0,{solid:1});L.ob.push({x:0,z:0,r:6.2,h:1.1});
const lavaM=glowMat(0xff5a10,3.2);L.lava=L.m(new THREE.CircleGeometry(5.35,64),lavaM,0,.42,0,{rx:-Math.PI/2,cast:false,recv:false});L.lavaM=lavaM;
const crust=L.m(new THREE.RingGeometry(2.2,4.6,48,1),std({color:0x241612,roughness:.95,metalness:.1}),0,.45,0,{rx:-Math.PI/2,cast:false});crust.rotation.z=.4;crust.scale.set(1,.7,1);
const hz=L.m(new THREE.RingGeometry(6.6,7.1,72),MAT.hazard.clone(),0,.012,0,{rx:-Math.PI/2,cast:false});hz.material.polygonOffset=true;hz.material.polygonOffsetFactor=-2;
const tower=bevelBox(3.4,13.6,3.4,.15),winG=new THREE.PlaneGeometry(1.6,1.1),winM=glowMat(0xff7a20,4);
for(let i=0;i<4;i++){const x=(i%2?1:-1)*12.5,z=(i<2?1:-1)*12.5;L.m(tower,MAT.concrete,x,6.8,z,{solid:1});L.ob.push({x,z,r:2.35,h:20});
L.m(new THREE.BoxGeometry(3.6,.5,3.6),MAT.hazard,x,1.3,z);L.m(new THREE.BoxGeometry(3.7,.3,3.7),MAT.dark,x,4.6,z);
for(const[fx,fz,ry]of[[0,-1,Math.PI],[0,1,0],[-1,0,-Math.PI/2],[1,0,Math.PI/2]]){if(fx*x>0||fz*z>0)continue;L.m(winG,winM,x+fx*1.72,2.6,z+fz*1.72,{ry,cast:false})}
L.m(new THREE.CylinderGeometry(.45,.45,HT-13.6+.2,14),MAT.dark,x+.8,13.6+(HT-13.6)/2,z+.8);L.lights.push({p:[x*.78,2.6,z*.78],c:0xff7a20,k:2})}
L.m(new THREE.BoxGeometry(2*A-1,.8,.9),MAT.hazard,0,11.6,0,{cast:true});L.crane=new THREE.Group();L.group.add(L.crane);const CP={parent:L.crane};mesh(new THREE.BoxGeometry(1.6,1.1,1.6),MAT.metal,0,10.7,0,CP);
mesh(new THREE.CylinderGeometry(.04,.04,6,6),MAT.dark,0,7.2,0,CP);const hook=mesh(new THREE.TorusGeometry(.45,.1,8,20,Math.PI*1.4),MAT.metal,0,3.9,0,CP);hook.rotation.z=Math.PI*.8;
L.anim=(dt,t)=>{L.lavaM.color.setRGB(3.2+Math.sin(t*1.7)*.6,.9+Math.sin(t*2.3)*.2,.12);if(R()<.5){const a=R()*TAU,r=R()*5;PA&&PA.emit(Math.cos(a)*r,.5,Math.sin(a)*r,rr(-.3,.3),rr(1.5,3.5),rr(-.3,.3),rr(1,2),rr(.06,.14),3,1.1,.25,1,-.04,-.3,.2)}}});
// 3) CRYSTAL RIFT — rift crystals everywhere, glowing tear in the middle
mk('CRYSTAL RIFT',2,false,L=>{L.core={p:[0,5,0],c:0x9a4bff,k:4.5};L.fog=.024;
const cg=new THREE.OctahedronGeometry(1,0),cm=std({color:0x5a2cc8,emissive:0x3a10a0,emissiveIntensity:1.6,roughness:.12,metalness:.2,envMapIntensity:1.4}),cm2=std({color:0x1a8fa6,emissive:0x0a5a70,emissiveIntensity:1.4,roughness:.15,metalness:.2,envMapIntensity:1.4});
const cluster=(cx,cz,n,sz,mat)=>{for(let i=0;i<n;i++){const a=i/n*TAU+R(),d=i?rr(.4,1.1)*sz:0,h=(i?rr(1.6,3.2):3.8)*sz,c=L.m(cg,mat,cx+Math.cos(a)*d,h*.45,cz+Math.sin(a)*d,{solid:1});c.scale.set(.42*sz,h,.42*sz);c.rotation.set(Math.sin(a)*.35*(i?1:.2),R()*TAU,Math.cos(a)*.35*(i?1:.2))}};
const n0=L.group.children.length;cluster(0,0,7,1.25,cm);L.center=L.group.children.slice(n0);L.ob.push({x:0,z:0,r:2.8,h:9});
const tear=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.flare,color:new THREE.Color(0xc070ff).multiplyScalar(4),blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));tear.position.set(0,7.5,0);tear.scale.set(2.5,6,1);L.group.add(tear);L.tear=tear;
for(let i=0;i<6;i++){const a=i/6*TAU+TAU/12,r=i%2?15:19,x=Math.cos(a)*r,z=Math.sin(a)*r;cluster(x,z,4+ri(3),.8,i%2?cm2:cm);L.ob.push({x,z,r:1.8,h:6});if(i<4)L.lights.push({p:[x,2.5,z],c:i%2?0x2ad8ff:0x9a4bff,k:2})}
L.anim=(dt,t)=>{L.tear.material.rotation=t*.3;L.tear.scale.set(2.5+Math.sin(t*2)*.3,6+Math.sin(t*1.3)*.6,1);if(R()<.4){const a=R()*TAU,r=rr(1,4);PA&&PA.emit(Math.cos(a)*r,rr(1,9),Math.sin(a)*r,-Math.cos(a)*.6,rr(-.2,.2),-Math.sin(a)*.6,1.5,.12,1.6,.6,3,1,0,0,0)}}});
// 4) PILLAR FOREST — dense grid of pillars around the reactor
mk('PILLAR FOREST',-1,true,L=>{L.fog=.02;for(const x of[-21,-7,7,21])for(const z of[-21,-7,7,21])pillar(L,x,z,(x+z)/14%2);
for(const[x,z]of[[14,0],[-14,0],[0,14],[0,-14]])L.lights.push({p:[x,3.2,z],c:null,k:1.7})});
// 5) THE VAULT — dedicated boss chamber: open floor, obelisk ring, sealing glyphs
mk('THE VAULT',3,false,L=>{L.boss=1;L.core={p:[0,8,0],c:0xff2a1a,k:3.2};L.fog=.021;
const ob=bevelBox(1.7,11,1.7,.12),gm=glowMat(0xff3a24,3.2),gm2=glowMat(0xffb030,2.4),sg=new THREE.BoxGeometry(.08,8.5,.08);
for(let i=0;i<8;i++){const a=i/8*TAU+TAU/16,x=Math.cos(a)*23,z=Math.sin(a)*23;const o=L.m(ob,MAT.dark,x,5.5,z,{solid:1});o.rotation.y=-a;L.ob.push({x,z,r:1.3,h:20});
for(const s of[-1,1]){const st=L.m(sg,gm,x+Math.sin(a)*.86*s,5.5,z-Math.cos(a)*.86*s,{cast:false});st.rotation.y=-a}
L.m(new THREE.BoxGeometry(2.3,.5,2.3),MAT.hazard,x,.25,z,{ry:-a})}
for(const[r0,r1,m]of[[9.6,10.1,gm],[17.4,17.8,gm2],[4.2,4.5,gm2]]){const r=L.m(new THREE.RingGeometry(r0,r1,96),m,0,.02,0,{rx:-Math.PI/2,cast:false,recv:false})}
for(let i=0;i<12;i++){const a=i/12*TAU,b=L.m(new THREE.PlaneGeometry(.18,7.2),gm,Math.cos(a)*13.8,.021,Math.sin(a)*13.8,{rx:-Math.PI/2,cast:false,recv:false});b.rotation.z=-a+Math.PI/2}
for(const[x,z]of[[16,16],[-16,16],[16,-16],[-16,-16]])L.lights.push({p:[x,3,z],c:0xff3a24,k:2.2});
L.anim=(dt,t)=>{gm.color.setRGB(3.2+Math.sin(t*1.6)*.8,.55,.35)}});}
let lastLayout=-1;
function setLayout(i){if(W.L)W.L.group.visible=false;const L=W.L=W.layouts[i];L.group.visible=true;W.reactor.visible=L.reactor;
W.ob.length=W.shellOb;if(L.reactor)W.ob.push({x:0,z:0,r:4.3,h:2.4});W.ob.push(...L.ob);W.staticOb=W.ob.length;
W.solid=W.shellSolid.concat(L.solid);if(L.reactor)W.solid.push(W.reactorSolid);
W.coreLight.position.fromArray(L.reactor?[0,4.4,0]:L.core.p);W.coreLight.color.set(L.reactor?0xff2a8a:L.core.c);W.coreBase=L.reactor?3:L.core.k;
W.gens.forEach((g,k)=>{const q=L.lights[k];g.light.position.fromArray(q.p);g.light.intensity=q.k;g.fixedColor=q.c});scene.fog.density=L.fog;lastLayout=i}
function rollRP(boss){const ids=W.layouts.map((L,i)=>i).filter(i=>!!W.layouts[i].boss===!!boss&&(boss||i!==lastLayout));const li=ids[Math.random()*ids.length|0],L=W.layouts[li];return{li,th:L.theme>=0?L.theme:Math.random()*3|0,seed:Math.random()*1e9|0,boss:boss?1:0}}
function applyRP(rp){setLayout(rp.li);withSeed(rp.seed,()=>layout(!!rp.boss));setTheme(rp.th);NET.curRP=rp}
function pickLayout(boss){const ids=W.layouts.map((L,i)=>i).filter(i=>!!W.layouts[i].boss===!!boss&&(boss||i!==lastLayout));const i=pick(ids);setLayout(i);const th=W.L.theme>=0?W.L.theme:ri(3);return th}

// ================= EFFECTS: particles, tracers, decals, lights, sprites =================
class PSys{constructor(n,blend,map){this.n=n;this.i=0;this.pos=new Float32Array(n*3);this.col=new Float32Array(n*4);this.size=new Float32Array(n);this.vel=new Float32Array(n*3);this.life=new Float32Array(n);this.max=new Float32Array(n);this.a0=new Float32Array(n);this.grow=new Float32Array(n);this.grav=new Float32Array(n);this.drag=new Float32Array(n);
const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(this.pos,3).setUsage(THREE.DynamicDrawUsage));g.setAttribute('pcol',new THREE.BufferAttribute(this.col,4).setUsage(THREE.DynamicDrawUsage));g.setAttribute('psize',new THREE.BufferAttribute(this.size,1).setUsage(THREE.DynamicDrawUsage));
this.mat=new THREE.ShaderMaterial({uniforms:{map:{value:map},scale:{value:400}},vertexShader:SH.partV,fragmentShader:SH.partF,blending:blend,transparent:true,depthWrite:false});this.pts=new THREE.Points(g,this.mat);this.pts.frustumCulled=false;this.g=g;scene.add(this.pts);this.alive=0}
emit(x,y,z,vx,vy,vz,life,size,r,g,b,a,grow,grav,drag){const i=this.i;this.i=(i+1)%this.n;this.pos[3*i]=x;this.pos[3*i+1]=y;this.pos[3*i+2]=z;this.vel[3*i]=vx;this.vel[3*i+1]=vy;this.vel[3*i+2]=vz;this.life[i]=this.max[i]=life;this.size[i]=size;this.col[4*i]=r;this.col[4*i+1]=g;this.col[4*i+2]=b;this.col[4*i+3]=a;this.a0[i]=a;this.grow[i]=grow||0;this.grav[i]=grav||0;this.drag[i]=drag||0}
update(dt){const P=this.pos,V=this.vel,L=this.life;let any=0;for(let i=0;i<this.n;i++){if(L[i]<=0)continue;any=1;L[i]-=dt;if(L[i]<=0){this.size[i]=0;this.col[4*i+3]=0;continue}const d=1-this.drag[i]*dt;V[3*i]*=d;V[3*i+1]=V[3*i+1]*d-this.grav[i]*dt;V[3*i+2]*=d;
P[3*i]+=V[3*i]*dt;P[3*i+1]+=V[3*i+1]*dt;P[3*i+2]+=V[3*i+2]*dt;if(P[3*i+1]<.03&&this.grav[i]>0){P[3*i+1]=.03;V[3*i+1]*=-.35;V[3*i]*=.6;V[3*i+2]*=.6}this.size[i]+=this.grow[i]*dt;const t=L[i]/this.max[i];this.col[4*i+3]=this.a0[i]*(t<.7?t/.7:1)}
if(any||this.alive){this.g.attributes.position.needsUpdate=this.g.attributes.pcol.needsUpdate=this.g.attributes.psize.needsUpdate=true}this.alive=any}
clear(){this.life.fill(0);this.size.fill(0)}}
let PA,PS;const LP=[];const FX={tracers:[],decals:[],di:0,rings:[],sprites:[]};
const v3=()=>new THREE.Vector3(),_v=v3(),_v2=v3(),_v3=v3(),_q=new THREE.Quaternion(),_m=new THREE.Matrix4(),_up=new THREE.Vector3(0,1,0);
function initFX(){PA=new PSys(3000,THREE.AdditiveBlending,TX.glow);PS=new PSys(900,THREE.NormalBlending,TX.smoke);PART=[PA,PS,{mat:W.dust.material}];
// muzzle and blast flashes: two lights instead of four on weak chips (every light is paid for on every lit pixel)
for(let i=0;i<(PERF.tier<1?2:4);i++){const l=new THREE.PointLight(0xffffff,0,12,2);scene.add(l);LP.push({l,t:0,d:1,k:0})}
const tg=new THREE.PlaneGeometry(1,1);for(let i=0;i<48;i++){const m=new THREE.Mesh(tg,new THREE.MeshBasicMaterial({map:TX.beam,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.matrixAutoUpdate=false;m.visible=false;m.frustumCulled=false;scene.add(m);FX.tracers.push({m,t:0,d:.1})}
const dg=new THREE.PlaneGeometry(1,1);for(let i=0;i<70;i++){const m=new THREE.Mesh(dg,new THREE.MeshBasicMaterial({map:TX.scorch,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-4,opacity:.9}));m.visible=false;scene.add(m);FX.decals.push(m)}
const rg=new THREE.RingGeometry(.85,1,64);for(let i=0;i<8;i++){const m=new THREE.Mesh(rg,new THREE.MeshBasicMaterial({color:0xffffff,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.visible=false;scene.add(m);FX.rings.push({m,t:0,d:1,r:1})}}
function flash(p,color,k,dist,dur){let best=LP[0];for(const s of LP)if(s.t<=0||s.t/s.d<best.t/best.d)best=s;best.l.position.copy(p);best.l.color.set(color);best.l.distance=dist||12;best.k=k;best.t=best.d=dur||.12}
function tracer(a,b,color,w,dur){const t=FX.tracers.find(x=>x.t<=0)||FX.tracers[0];const len=a.distanceTo(b);if(len<.01)return;_v.subVectors(b,a).normalize();_v2.subVectors(cam.position,a).normalize();_v3.crossVectors(_v,_v2).normalize();if(_v3.lengthSq()<.5)_v3.set(0,1,0);const n=new THREE.Vector3().crossVectors(_v,_v3);
t.m.matrix.makeBasis(_v.clone().multiplyScalar(len),_v3.clone().multiplyScalar(w),n);t.m.matrix.setPosition(a.clone().lerp(b,.5));t.m.visible=true;t.m.material.color.set(color).multiplyScalar(4);t.m.material.opacity=1;t.t=t.d=dur||.09}
function decal(p,n,s){const m=FX.decals[FX.di++%FX.decals.length];m.position.copy(p).addScaledVector(n,.012);m.lookAt(_v.copy(p).add(n));m.rotateZ(R()*TAU);m.scale.setScalar(s);m.visible=true}
function shock(p,color,r,dur){const s=FX.rings.find(x=>x.t<=0)||FX.rings[0];s.m.position.set(p.x,.08,p.z);s.m.material.color.set(color).multiplyScalar(3);s.r=r;s.t=s.d=dur||.5;s.m.visible=true}
function sparks(p,color,n,sp,life,size){const c=new THREE.Color(color);for(let i=0;i<n;i++){const u=rr(-1,1),th=R()*TAU,s=Math.sqrt(1-u*u),v=sp*rr(.3,1);PA.emit(p.x,p.y,p.z,s*Math.cos(th)*v,u*v+sp*.3,s*Math.sin(th)*v,life*rr(.5,1),size*rr(.6,1.2),c.r*3,c.g*3,c.b*3,1,-size*.5,9,1.5)}}
function glowPuff(p,color,size,life,k){const c=new THREE.Color(color);PA.emit(p.x,p.y,p.z,0,0,0,life,size,c.r*(k||3),c.g*(k||3),c.b*(k||3),1,size*1.5,0,0)}
function smoke(p,n,size,life,dark){for(let i=0;i<n;i++){const g=dark?.04:.12;PS.emit(p.x+rr(-.3,.3),p.y+rr(-.2,.3),p.z+rr(-.3,.3),rr(-.6,.6),rr(.4,1.4),rr(-.6,.6),life*rr(.7,1.2),size*rr(.7,1.2),g,g,g*1.1,dark?.55:.35,size*.8,-.2,.8)}}
function impact(p,n,color,big){sparks(p,color,big?14:6,big?7:4,.35,.12);glowPuff(p,color,big?.9:.4,.12);if(big)smoke(p,2,.6,1);if(n)decal(p,n,big?.5:.18)}
function explosion(p,radius,color){const c=color||0xff7a2a;glowPuff(p,0xffd9a0,radius*1.4,.18,5);glowPuff(p,c,radius*2.2,.35,3);sparks(p,c,40,radius*4,.8,.22);sparks(p,0xffe0a0,20,radius*6,.5,.1);
for(let i=0;i<14;i++){const a=R()*TAU,u=R(),v=radius*rr(1,3);PA.emit(p.x,p.y+.2,p.z,Math.cos(a)*v*(1-u),u*v*1.3,Math.sin(a)*v*(1-u),rr(.4,.8),rr(.5,1.1)*radius*.5,2.5,1.1,.3,1,radius*.6,1,2)}
smoke(p,10,radius*.8,2.4,1);flash(p,c,8,radius*5,.35);shock(p,c,radius*1.4,.45);if(p.y<1.2)decal(_v2.set(p.x,0,p.z),_up,radius*1.1);addShake(Math.min(1,.9*radius/Math.max(3,cam.position.distanceTo(p))));play('boom',radius>4?1.4:1)}
function updateFX(dt){PA.update(dt);PS.update(dt);for(const s of LP){if(s.t>0){s.t-=dt;s.l.intensity=s.k*Math.max(0,s.t/s.d)}else s.l.intensity=0}
for(const t of FX.tracers)if(t.t>0){t.t-=dt;t.m.material.opacity=Math.max(0,t.t/t.d);if(t.t<=0)t.m.visible=false}
for(const s of FX.rings)if(s.t>0){s.t-=dt;const k=1-s.t/s.d;s.m.scale.setScalar(.2+s.r*k*2.2);s.m.material.opacity=1-k;if(s.t<=0)s.m.visible=false}}
// sprites (projectiles, pickups)
const spritePool=[];function sprite(color,k,size,tex){let s=spritePool.pop();if(!s){s=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.glow,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));}s.material.map=tex||TX.glow;s.material.color.set(color).multiplyScalar(k);s.material.opacity=1;s.scale.setScalar(size);s.visible=true;scene.add(s);return s}
function freeSprite(s){scene.remove(s);spritePool.push(s)}

// ================= GAME STATE =================
G={mode:'menu',boss:null,wave:0,spawnQ:[],spawnT:0,score:0,kills:0,combo:0,comboT:0,bestCombo:0,t0:0,time:0,bosses:0,ts:1,slow:0,shake:0,evt:'',evtT:0,breather:0,waveClear:0,frz:0,grav:0,ovc:0};
const P={pos:v3(),vel:v3(),yaw:0,pitch:0,rec:0,recY:0,onG:1};
const WEP=[{n:'PULSE RIFLE',m:'rifle',rate:.092,dmg:19,mag:32,pel:1,sp:.011,rl:1.45,c:0x46e6ff,auto:1,kick:.012,vk:.03,tw:.025,snd:'rifle',sub:'Full-auto · hold right-click to scope'},
{n:'PLASMA SHOTGUN',m:'shotgun',rate:.72,dmg:15,mag:6,pel:9,sp:.072,rl:1.9,c:0xff8a2a,kick:.055,vk:.11,tw:.03,snd:'shotgun',sub:'9 plasma pellets, brutal up close'},
{n:'RAILGUN',m:'railgun',rate:1.25,dmg:160,mag:5,pel:1,sp:0,rl:2.1,c:0x8fb6ff,pierce:1,charge:.42,kick:.05,vk:.12,tw:.16,snd:'rail',sub:'Charged beam pierces every target'},
{n:'ROCKET LAUNCHER',m:'launcher',rate:1.0,dmg:90,mag:4,pel:1,sp:0,rl:2.3,c:0xff5a2a,proj:'rocket',splash:5.5,kick:.07,vk:.14,snd:'rocket',sub:'Explosive rockets, 5.5m blast'},
{n:'VOID CANNON',m:'voidgun',rate:1.6,dmg:250,mag:3,pel:1,sp:0,rl:2.8,c:0xb04bff,proj:'void',splash:7.5,kick:.09,vk:.16,snd:'void',sub:'Dark-energy singularity'}];
const ET={drone:{hp:28,sp:6.5,xp:1,r:.6,sc:10,gc:0x16e8ff,fly:1},soldier:{hp:70,sp:4.2,xp:2,r:.5,sc:20,gc:0xffa640},assassin:{hp:60,sp:5.2,xp:3,r:.5,sc:30,gc:0xc070ff},
crawler:{hp:38,sp:5.6,xp:2,r:.9,sc:15,gc:0x9aff3a},brute:{hp:340,sp:2.9,xp:6,r:1.15,sc:60,gc:0xff5a2a},tank:{hp:620,sp:1.9,xp:9,r:2.1,sc:90,gc:0xff8a20},elite:{hp:360,sp:5,xp:10,r:.65,sc:120,gc:0xffd84a},
titan:{hp:4600,sp:3.2,xp:45,r:2.6,sc:1500,gc:0xff7a30,boss:'RIFT TITAN'},warden:{hp:5200,sp:3,xp:55,r:2.2,sc:2000,gc:0x6ab8ff,boss:'VOID WARDEN'},core:{hp:6400,sp:0,xp:70,r:4.4,sc:3000,gc:0xff3a6a,boss:'THE CORE'}};
const EN=[],EB=[],PR=[],GEMS=[],PUS=[],TEL=[],HB=[];let gemIM=null;
const GOLD={drone:2,soldier:4,assassin:6,crawler:3,brute:12,tank:18,elite:22,titan:150,warden:170,core:190};
const PRICE=[0,45,150,300,550];
const HUMAN={soldier:1,assassin:1,brute:1,elite:1,titan:1};
// ---------- online co-op ----------
const NET={on:false,host:false,client:false,final:false,wasOnline:false,tgt:null,hurt:{},hurtSrc:{},remote:{},ready:{},goNow:false,iReady:false,readyT:0,nid:0,byId:{},map:{},deadN:new Set(),stT:0,snT:0,huT:0,dT:0,laser:null,la:0,startRP:null,curRP:null,killBy:null,downed:false};
const NRN=()=>window.NRNet;const r2=v=>Math.round(v*100)/100;const ETK=()=>Object.keys(ET);
function mul32(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function withSeed(seed,f){const o=_rng;_rng=mul32(seed);try{return f()}finally{_rng=o}}
// ---------- shake ----------
function addShake(k){if(save.set.shake)G.shake=Math.min(1.2,G.shake+k)}
// ---------- view model ----------
const VM={g:new THREE.Group(),guns:[],cur:-1,sw:0,swayX:0,swayY:0,kick:0,bob:0,mf:null,light:null,ready:0,base:{p:[.17,-.17,-.5],r:[.02,.13,0],s:.85}};
vmScene.add(VM.g);{const h=new THREE.HemisphereLight(0x8aa0d0,0x151018,.9);vmScene.add(h);const d=new THREE.DirectionalLight(0xffffff,1.6);d.position.set(-1,2,1.5);vmScene.add(d);const d2=new THREE.DirectionalLight(0x6688ff,.6);d2.position.set(2,-.5,-1);vmScene.add(d2);
VM.light=new THREE.PointLight(0xffaa66,0,3,2);VM.light.position.set(.1,-.05,-.9);vmScene.add(VM.light);VM.amb=h}
const vmMats=c=>[std({vertexColors:true,roughness:.55,metalness:.18,envMapIntensity:.6}),std({vertexColors:true,roughness:.26,metalness:.92,envMapIntensity:1.3}),new THREE.MeshBasicMaterial({color:new THREE.Color(c).multiplyScalar(3.5)}),std({vertexColors:true,roughness:.85,metalness:.1,envMapIntensity:.3})];
const VPART={rifle:'rifle_mag',shotgun:'shotgun_pump',launcher:'launcher_ammo',railgun:'railgun_cell',voidgun:'voidgun_core'};
function buildVM(i){const w=WEP[i],pn=VPART[w.m];if(VM.guns[i]||!MOD.geo[w.m]||!MOD.geo[pn]||!MOD.geo.hand||!MOD.geo.arm||(w.m==='launcher'&&!MOD.geo.rocket))return;const meta=MOD.meta[w.m],g=new THREE.Group(),b=VM.base;
const gm=vmMats(w.c),gun=new THREE.Mesh(MOD.geo[w.m],gm);g.add(gun);const handM=VM.skin||(VM.skin=[std({vertexColors:true,roughness:.6,metalness:0,envMapIntensity:.35}),std({vertexColors:true,roughness:.3,metalness:.9,envMapIntensity:1.2}),new THREE.MeshBasicMaterial({color:new THREE.Color(0x46e6ff).multiplyScalar(3)}),std({vertexColors:true,roughness:.85,metalness:.05,envMapIntensity:.3})]),armM=handM;
const pg=MOD.geo[pn],c=pg.boundingBox.getCenter(new THREE.Vector3()),piv=new THREE.Group(),pm=new THREE.Mesh(pg,gm);piv.position.copy(c);pm.position.copy(c).negate();piv.add(pm);g.add(piv);
let held=null;if(w.m==='shotgun'){held=new THREE.Group();const sb=new THREE.Mesh(new THREE.CylinderGeometry(.0095,.0095,.05,14),std({color:0x8a1712,roughness:.5,metalness:.1}));const sc=new THREE.Mesh(new THREE.CylinderGeometry(.0105,.0105,.013,14),std({color:0xc79a45,roughness:.25,metalness:1}));sc.position.y=.031;held.add(sb,sc);held.rotation.x=Math.PI/2;g.add(held)}
if(w.m==='launcher'){held=new THREE.Mesh(MOD.geo.rocket,vmMats(0xff5a2a));g.add(held)}if(held)held.visible=false;
const rh=new THREE.Mesh(MOD.geo.hand,handM);rh.position.fromArray(meta.rh.p);rh.rotation.fromArray(meta.rh.r);g.add(rh);
const lh=new THREE.Mesh(MOD.geo.hand,handM);lh.position.fromArray(meta.lh.p);lh.rotation.fromArray(meta.lh.r);g.add(lh);
const mk=(hand,elb)=>{const arm=new THREE.Mesh(MOD.geo.arm,armM);g.add(arm);return{arm,hand,elb:new THREE.Vector3().fromArray(elb)}};
const mf=new THREE.Sprite(new THREE.SpriteMaterial({map:TX.flare,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,color:new THREE.Color(w.c).lerp(new THREE.Color(0xffffff),.5).multiplyScalar(5)}));mf.position.fromArray(meta.muzzle);mf.scale.setScalar(.22);mf.visible=false;g.add(mf);
g.userData={gun,mf,part:piv,p0:c.clone(),held,arms:[mk(rh,[.38,-.5,.1]),mk(lh,[-.26,-.55,-.18])],lh,lh0:lh.position.clone(),lhR0:lh.rotation.clone(),muzzle:new THREE.Vector3().fromArray(meta.muzzle),wrist:new THREE.Vector3().fromArray(MOD.meta.hand.wrist),lastRl:0};
g.scale.setScalar(b.s);g.visible=false;VM.g.add(g);VM.guns[i]=g}
// ---- reload animations (t: 0..1 progress). Each poses the part, the left hand and the whole gun (o offsets) ----
const seg=(t,a,b)=>clamp((t-a)/(b-a),0,1),ss=x=>x*x*(3-2*x),bell=(t,a,b)=>Math.sin(seg(t,a,b)*Math.PI);const _h1=v3(),_h2=v3(),PALMDN=new THREE.Euler(Math.PI/2,0,0),PALMUP=new THREE.Euler(-Math.PI/2,Math.PI,0);
const tiltK=(t,a,b)=>ss(seg(t,0,a))*(1-ss(seg(t,b,1)));
const RANIM={
rifle(t,u,o){const k=tiltK(t,.14,.86);o.rz=-.42*k;o.rx=-.06*k;o.y=.075*k;o.x=-.05*k;o.z=.02*k;o.rx-=bell(t,.7,.78)*.07;const P0=u.p0,pp=u.part.position;
if(t<.44){const m=seg(t,.14,.36);pp.set(P0.x+m*.02,P0.y-m*m*.5,P0.z+m*.07);u.part.rotation.x=m*1.1;u.part.visible=m<.98}else{const m=1-ss(seg(t,.46,.7));pp.set(P0.x,P0.y-m*.34,P0.z+m*.08);u.part.rotation.x=m*.3}
_h1.set(pp.x,pp.y-.058,pp.z-.004);if(t<.24)return;if(t<.46)u.lh.position.lerpVectors(u.lh0,_h2.set(u.lh0.x-.02,-.44,P0.z+.07),ss(seg(t,.24,.42)));else if(t<.78)u.lh.position.copy(_h1);else u.lh.position.lerpVectors(_h2.set(P0.x,P0.y-.058,P0.z-.004),u.lh0,ss(seg(t,.78,.95)))},
shotgun(t,u,o){const k=tiltK(t,.12,.88);o.rz=-.5*k;o.rx=-.06*k;o.y=.075*k;o.x=-.05*k;o.z=.02*k;const port=_h1.set(0,-.04,-.05),below=_h2.set(-.01,-.32,-.02);
if(t<.14)u.lh.position.lerpVectors(u.lh0,below,ss(seg(t,.03,.14)));
else if(t<.74){const n=Math.floor((t-.14)/.2),s=(t-.14-n*.2)/.2,up=s<.55?ss(s/.55):1-ss((s-.55)/.45);u.lh.position.lerpVectors(below,port,up);u.lh.rotation.copy(PALMUP);if(s<.55){u.held.visible=true;u.held.position.copy(u.lh.position).add(_h2.set(0,.032,.01))}}
else if(t<.8)u.lh.position.lerpVectors(below,u.lh0,ss(seg(t,.74,.8)));
else{const off=bell(t,.8,.95)*.075;u.part.position.z=u.p0.z+off;u.lh.position.copy(u.lh0);u.lh.position.z+=off}},
railgun(t,u,o){const k=tiltK(t,.12,.88);o.rz=.3*k;o.rx=.05*k;o.y=.03*k;o.x=-.05*k;const P0=u.p0,pp=u.part.position;
if(t<.5){const e=seg(t,.12,.4),f=Math.max(0,e-.35);pp.set(P0.x,P0.y+ss(seg(t,.12,.22))*.06+f*.7,P0.z+f*.6);u.part.rotation.x=e*.9;u.part.visible=e<.97}else{const m=1-ss(seg(t,.5,.72));pp.set(P0.x,P0.y+m*.17,P0.z+m*.06)}
if(t<.3)return;if(t>.36&&t<.86)u.lh.rotation.copy(PALMDN);_h1.set(pp.x,pp.y+.05,pp.z);if(t<.5)u.lh.position.lerpVectors(u.lh0,_h2.set(P0.x-.04,P0.y+.22,P0.z+.06),ss(seg(t,.3,.48)));else if(t<.78)u.lh.position.copy(_h1);else u.lh.position.lerpVectors(_h2.set(P0.x,P0.y+.05,P0.z),u.lh0,ss(seg(t,.78,.95)));
VM.glow=bell(t,.72,.9)},
launcher(t,u,o){const k=tiltK(t,.12,.88);o.y=.02*k;o.x=-.11*k;o.rx=.05*k;o.rz=.25*k;o.ry=.3*k;const r=u.held;
if(t>.18&&t<.8){r.visible=true;if(t<.42){const m=ss(seg(t,.18,.42));r.position.set(0,lerp(-.38,.07,m),lerp(.75,.62,m))}else r.position.set(0,.07,lerp(.62,.2,ss(seg(t,.42,.78))));r.rotation.set(0,0,0)}
u.part.visible=P.ammo[P.cw]>0||t>.8;if(t<.1)return;if(t<.85)u.lh.rotation.copy(PALMUP);
if(t<.2)u.lh.position.lerpVectors(u.lh0,_h2.set(0,-.42,.85),ss(seg(t,.1,.2)));else if(t<.8)u.lh.position.copy(r.position).add(_h2.set(0,-.045,.17));else u.lh.position.lerpVectors(_h2.set(0,.025,.37),u.lh0,ss(seg(t,.8,.95)))},
voidgun(t,u,o){const k=tiltK(t,.12,.88);o.rz=.3*k;o.rx=.04*k;o.y=.04*k;o.x=-.05*k;o.rx-=bell(t,.54,.62)*.08;
const sc=t<.4?1-ss(seg(t,.08,.35)):t<.62?0:t<.82?ss(seg(t,.62,.78))*1.3:lerp(1.3,1,seg(t,.82,.92));u.part.scale.setScalar(Math.max(.001,sc));u.part.visible=sc>.01;VM.glow=bell(t,.62,.85);
if(t>.1&&t<.4&&R()<.6){muzzleWorld(_h1);PS.emit(_h1.x,_h1.y,_h1.z,rr(-.3,.3),rr(.3,.9),rr(-.3,.3),.9,.25,.25,.1,.35,.5,.6,-.2,.5);PA.emit(_h1.x,_h1.y,_h1.z,rr(-.5,.5),rr(.2,.8),rr(-.5,.5),.4,.12,1.6,.4,3,1,-.1,0,1)}
if(t<.34)return;if(t<.72)u.lh.rotation.copy(PALMDN);if(t<.5)u.lh.position.lerpVectors(u.lh0,_h2.set(0,.17,-.05),ss(seg(t,.34,.5)));else if(t<.72)u.lh.position.lerpVectors(_h2.set(0,.17,-.05),_h1.set(0,.105,-.08),ss(seg(t,.5,.56)));else u.lh.position.lerpVectors(_h1.set(0,.105,-.08),u.lh0,ss(seg(t,.72,.9)))}};
const RSND={rifle:[[.16,'magOut'],[.7,'magIn'],[.9,'bolt']],shotgun:[[.25,'shell'],[.45,'shell'],[.65,'shell'],[.8,'pump']],railgun:[[.14,'cellOut'],[.7,'cellIn']],launcher:[[.44,'slide'],[.78,'clack']],voidgun:[[.1,'vent'],[.55,'slam'],[.62,'vcharge']]};
const _w=v3(),_e=v3(),_d=v3();
function fitArms(g){VM.g.updateMatrixWorld(true);const inv=_m.copy(g.matrixWorld).invert();
for(const a of g.userData.arms){_w.copy(g.userData.wrist).applyMatrix4(a.hand.matrix);_e.copy(a.elb).applyMatrix4(inv);// elbow (view space) -> gun space
_d.subVectors(_e,_w);const L=_d.length();a.arm.position.copy(_w);a.arm.quaternion.setFromUnitVectors(_up,_d.normalize());a.arm.scale.set(1,L/.4,1)}}
function updateVM(dt,moving){const i=P.cw;for(let k=0;k<WEP.length;k++)buildVM(k);VM.guns.forEach((g,k)=>{if(g)g.visible=k===i});const g=VM.guns[i];if(!g)return;const b=VM.base,u=g.userData;
VM.swayX=damp(VM.swayX,0,10,dt);VM.swayY=damp(VM.swayY,0,10,dt);VM.kick=damp(VM.kick,0,12,dt);VM.sw=damp(VM.sw,0,8,dt);if(moving)VM.bob+=dt*(P.sprint?13:9.5);
const bobA=moving&&P.onG?1:0,bx=Math.sin(VM.bob)*.012*bobA,by=-Math.abs(Math.cos(VM.bob))*.012*bobA;
const w=WEP[i],rl=P.rl>0?1-P.rl/P.rlt:0,o=VM.o||(VM.o={});o.x=o.y=o.z=o.rx=o.ry=o.rz=0;VM.glow=0;
u.part.position.copy(u.p0);u.part.rotation.set(0,0,0);u.part.scale.setScalar(1);u.part.visible=true;u.lh.position.copy(u.lh0);u.lh.rotation.copy(u.lhR0);if(u.held)u.held.visible=false;
if(rl>0){RANIM[w.m](rl,u,o);for(const[t,n]of RSND[w.m])if(u.lastRl<t&&rl>=t)play(n)}else{if(w.m==='launcher')u.part.visible=P.ammo[i]>0;
if(w.m==='shotgun'&&VM.pumpT>0){VM.pumpT-=dt;const k=1-VM.pumpT/.5,off=Math.sin(clamp((k-.2)/.8,0,1)*Math.PI)*.075;u.part.position.z+=off;u.lh.position.z+=off}}u.lastRl=rl;
VM.g.position.set(b.p[0]+bx-VM.swayX*.02+o.x,b.p[1]+by-VM.swayY*.02-VM.sw*.35+o.y,b.p[2]+VM.kick*.6+o.z);if(P.adsK>0){const a=Math.min(1,P.adsK*1.6);VM.g.position.x*=1-a;VM.g.position.y+=(-.07-VM.g.position.y)*a*.8;VM.g.position.z+=.08*a}
VM.g.rotation.set(b.r[0]+VM.kick*2+VM.sw*-.8+VM.swayY*.03+o.rx,b.r[1]+VM.swayX*.04+o.ry,b.r[2]+(P.sprint?.2:0)+o.rz);
g.position.set(0,0,0);fitArms(g);
u.mf.visible=VM.mft>0;if(VM.mft>0){VM.mft-=dt;u.mf.material.rotation=R()*TAU;u.mf.scale.setScalar(.16+R()*.14)}VM.light.intensity=VM.mft>0?3:0;
u.gun.material[2].color.set(WEP[i].c).multiplyScalar(3.5+(WEP[i].charge&&P.charge>0?P.charge*14:0)+VM.glow*12)}
function muzzleWorld(out){const g=VM.guns[P.cw];if(!g)return out.copy(cam.position);g.updateMatrixWorld(true);out.copy(g.userData.muzzle).applyMatrix4(g.matrixWorld);out.z*=1.0;return cam.localToWorld(out)}
// ---------- enemies ----------
const BONECACHE={};
function creatureMats(type,elite){const gc=elite?0xff2a2a:ET[type].gc;const m=[std({vertexColors:true,roughness:.7,metalness:.08,envMapIntensity:.45,skinning:true}),std({vertexColors:true,roughness:.3,metalness:.85,envMapIntensity:1.1,skinning:true}),
new THREE.MeshBasicMaterial({color:new THREE.Color(gc).multiplyScalar(4),skinning:true}),std({vertexColors:true,roughness:.85,metalness:.15,envMapIntensity:.3,skinning:true})];if(type==='assassin')m.forEach(x=>{x.transparent=true});return m}
const hbGeo=new THREE.SphereGeometry(1,8,6),hbMat=new THREE.MeshBasicMaterial({visible:false});
function addHB(e,bone,c,s,part){const meta=MOD.meta[e.type],bp=meta.bones[bone].p,h=new THREE.Mesh(hbGeo,hbMat);h.position.set(c[0]-bp[0],c[1]-bp[1],c[2]-bp[2]);h.scale.set(s[0],s[1],s[2]);h.userData={e,part};e.bones[bone].add(h);e.hb.push(h);HB.push(h)}
function hitboxes(e){const t=e.type,J=MOD.meta[t].J,a=(p,o)=>[p[0]+o[0],p[1]+o[1],p[2]+o[2]];
if(J){const k=t==='titan'?4.3:t==='brute'?1.45:t==='elite'?1.22:1,S=v=>v.map(x=>x*k);
addHB(e,2,a(J.chest,S([0,.02,0])),S([.24,.2,.17]),'body');addHB(e,0,a(J.hips,S([0,0,0])),S([.2,.15,.15]),'body');addHB(e,1,J.spine,S([.17,.12,.13]),'body');addHB(e,4,a(J.head,S([0,.07,.02])),S([.13,.15,.14]),t==='titan'?'body':'head');
for(const n of['R','L']){const lg=n==='R'?11:14;const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2];addHB(e,lg,mid(J['hp'+n],J['kn'+n]),S([.1,.22,.1]),'body');addHB(e,lg+1,mid(J['kn'+n],J['an'+n]),S([.08,.22,.08]),'body');
const ua=n==='R'?5:8;addHB(e,ua,mid(J['sh'+n],J['el'+n]),S([.08,.16,.08]),'body')}
if(t==='titan')addHB(e,2,a(J.chest,S([0,.05,.13])),S([.08,.08,.08]),'weak')}
else if(t==='drone'){addHB(e,0,[0,0,0],[.34,.28,.4],'body');addHB(e,0,[0,0,.3],[.14,.14,.12],'weak')}
else if(t==='crawler'){addHB(e,0,[0,.45,.05],[.3,.22,.35],'body');addHB(e,2,[0,.55,-.55],[.38,.32,.5],'body');addHB(e,1,[0,.48,.48],[.17,.15,.18],'head')}
else if(t==='tank'){addHB(e,0,[0,1.5,0],[1.15,.75,1.45],'body');addHB(e,0,[0,1.25,1.3],[.45,.35,.35],'head');addHB(e,1,[0,2.3,.4],[.35,.3,.7],'weak')}
else if(t==='warden'){addHB(e,0,[0,2.6,0],[.75,1.6,.75],'body');addHB(e,1,[0,4.6,0],[.95,.7,.7],'body');addHB(e,2,[0,5.45,.05],[.5,.55,.5],'body');addHB(e,1,[0,4.65,.5],[.22,.22,.18],'weak')}
else if(t==='core'){addHB(e,1,[0,4.2,0],[2.05,2.45,2.05],'body');addHB(e,1,[0,4.4,1.6],[.75,.75,.5],'weak');addHB(e,0,[0,.7,0],[2.7,.7,2.7],'body')}}
function makeCreature(type,elite){const meta=MOD.meta[type],geo=MOD.geo[type];if(!geo)return null;const bones=meta.bones.map(()=>new THREE.Bone());
meta.bones.forEach((b,i)=>{const pp=b.parent>=0?meta.bones[b.parent].p:[0,0,0];bones[i].position.set(b.p[0]-pp[0],b.p[1]-pp[1],b.p[2]-pp[2]);if(b.parent>=0)bones[b.parent].add(bones[i])});
const mats=creatureMats(type,elite),sm=new THREE.SkinnedMesh(geo,mats);sm.add(bones[0]);sm.updateMatrixWorld(true);sm.bind(new THREE.Skeleton(bones));sm.castShadow=true;sm.receiveShadow=true;sm.frustumCulled=false;
const g=new THREE.Group();g.add(sm);return{g,sm,bones,mats,rest:bones.map(b=>b.position.clone())}}
function attach(e){const t=e.type,J=MOD.meta[t].J;
if((t==='soldier')&&MOD.geo.rifle){const r=new THREE.Mesh(MOD.geo.rifle,vmMats(0xffa640));r.position.set(-.16,-.12,.32);r.rotation.y=Math.PI;r.scale.setScalar(1.05);e.bones[2].add(r);r.castShadow=true}
if((t==='elite'||t==='titan')&&MOD.geo.sword){const s=t==='titan'?3.3:.62,sw=new THREE.Mesh(MOD.geo.sword,t==='elite'?[std({color:0x222}),new THREE.MeshBasicMaterial({color:new THREE.Color(0xffe27a).multiplyScalar(5)}),new THREE.MeshBasicMaterial({color:new THREE.Color(0xffffff).multiplyScalar(6)}),std({color:0x111})]:vmMats(0xff7a30));
const k=t==='titan'?4.3:1.22,d=J.dirR,ho=new THREE.Vector3(d[0],d[1],d[2]).multiplyScalar(.08*k*(t==='titan'?1.3:1));sw.scale.setScalar(s);sw.rotation.set(Math.PI/2+.5,0,0);sw.position.copy(ho).sub(new THREE.Vector3(0,1.08*s,0).applyEuler(sw.rotation));e.bones[7].add(sw);sw.castShadow=true;e.sword=sw}
if(t==='warden'){const h=new THREE.Mesh(new THREE.TorusGeometry(1.05,.07,10,64),new THREE.MeshBasicMaterial({color:new THREE.Color(0x9ad0ff).multiplyScalar(4)}));h.position.set(0,.35,-.55);e.bones[2].add(h);e.halo=h;
e.shards=[];if(MOD.geo.shard)for(let i=0;i<5;i++){const s=new THREE.Mesh(MOD.geo.shard,new THREE.MeshBasicMaterial({color:new THREE.Color(0x7ac8ff).multiplyScalar(3.5)}));s.scale.setScalar(2.2);e.g.add(s);e.shards.push(s)}}
if(t==='elite'){e.shieldM=new THREE.Mesh(new THREE.SphereGeometry(1.25,24,16),new THREE.ShaderMaterial({uniforms:{color:{value:new THREE.Color(0xffd84a).multiplyScalar(2)},pw:{value:2.5},time:{value:0}},vertexShader:SH.fresV,fragmentShader:SH.fresF,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));e.shieldM.position.y=1.5;e.g.add(e.shieldM)}}
function spawnE(type,o={}){if(!MOD.geo[type])return null;const d=ET[type],c=makeCreature(type,o.elite);if(!c)return null;const boss=!!d.boss;
const scale=1+G.wave*.1,hp=d.hp*(boss?1.3*(1+G.bosses*.5):scale)*(o.elite?1.8:1)*(G.mods.hp||1)*(NET.host?1+.65*(NRN().count()-1):1);
const e=Object.assign(c,{type,hp,mhp:hp,sp:d.sp*(o.elite?1.15:1)*(G.mods.sp||1),xp:d.xp*(o.elite?2:1),r:d.r,boss,elite:!!o.elite,cd:rr(1,2.5),ph:R()*10,phase:0,fl:0,flinch:0,hb:[],yaw:0,vx:0,vz:0,y:0,st:'idle',stg:0,pz:0,mpz:hp*.08,ph2:1,atk:0,spd:0,hit:0,cloak:0,shield:type==='elite'?140*scale:0,dead:0,intro:boss?2.8:.6,alpha:1,charge:0,leapT:0,burst:0,bt:0,chg:0,lunge:0,aim:0,look:0,shT:0,laser:null,leap:null});
let x,z;if(boss){x=0;z=type==='core'?0:-16}else if(o.pos){x=o.pos.x;z=o.pos.z}else if(R()<.55&&W.doors.some(q=>Math.hypot(q.x-P.pos.x,q.z-P.pos.z)>14)){const dr=pick(W.doors.filter(q=>Math.hypot(q.x-P.pos.x,q.z-P.pos.z)>14));x=dr.x;z=dr.z;dr.open=1.6;dr.t=0}else{for(let i=0;i<20;i++){const a=R()*TAU,r=rr(14,26);x=Math.cos(a)*r;z=Math.sin(a)*r;if(Math.hypot(x-P.pos.x,z-P.pos.z)>12&&W.ob.every(q=>Math.hypot(q.x-x,q.z-z)>q.r+e.r))break}}
e.g.position.set(x,type==='core'?.9:0,z);e.yaw=Math.atan2(P.pos.x-x,P.pos.z-z);e.g.rotation.y=e.yaw;scene.add(e.g);hitboxes(e);attach(e);EN.push(e);if(NET.host){e.nid=++NET.nid;NET.byId[e.nid]=e}
const sp=new THREE.Vector3(x,1.2,z);sparks(sp,d.gc,24,5,.6,.18);glowPuff(sp,d.gc,3,.4);play('spawn');
if(boss){G.boss=e;e.g.position.y=type==='core'?-6:-9;bossIntro(e)}return e}
function freeE(e){if(e.nid){delete NET.byId[e.nid];delete NET.map[e.nid]}scene.remove(e.g);e.mats.forEach(m=>m.dispose());for(const h of e.hb){const i=HB.indexOf(h);if(i>=0)HB.splice(i,1)}const i=EN.indexOf(e);if(i>=0)EN.splice(i,1)}
// procedural animation
function animE(e,dt,moveSp){const B=e.bones,t=e.type,rest=e.rest;e.phase+=dt*(1.5+moveSp*1.6);const s=Math.sin(e.phase),c=Math.cos(e.phase),m=clamp(moveSp/Math.max(1,e.sp),0,1.3),br=Math.sin(G.time*2+e.ph);
const fl=e.flinch;e.flinch=Math.max(0,fl-dt*6);
if(HUMAN[t]){const k=t==='titan'?4.3:t==='brute'?1.45:1;B[0].position.y=rest[0].y+Math.abs(c)*.045*k*m-(e.stg>0?.35*k:0);B[0].rotation.y=s*.08*m;
B[11].rotation.x=-s*.55*m-(e.stg>0?.9:0);B[14].rotation.x=s*.55*m-(e.stg>0?.9:0);B[12].rotation.x=Math.max(0,c)*.9*m+(e.stg>0?1.5:0);B[15].rotation.x=Math.max(0,-c)*.9*m+(e.stg>0?1.5:0);
B[13].rotation.x=B[16].rotation.x=e.stg>0?-.6:0;
B[1].rotation.x=-fl*.35+br*.02+(e.stg>0?.45:0)+(t==='brute'?.25:0);B[2].rotation.x=br*.03;B[2].rotation.y=-s*.1*m;B[4].rotation.x=-fl*.3;B[4].rotation.y=e.look||0;
const down=t==='brute'?.2:.55;let rx=-.2*m*s,lx=.2*m*s,rz=down,lz=-down,re=0,le=0;
if(t==='soldier'){rx=-1.15;rz=.35;re=-.55;lx=-1.25;lz=-.75;le=-.8}
else if(t==='elite'){rx=-.5+s*.2*m;rz=.25;re=-.4;lx=.3*s*m;lz=-.5;le=-.2}
else if(t==='assassin'){rx=-.5+s*.4*m;rz=.6;lx=-.5-s*.4*m;lz=-.6;re=le=-.6;B[1].rotation.x+=.35}
const atk=e.atk;if(atk>0){const p=atk;if(t==='titan'){rx=-2.6*p+(e.st==='rec'?1.4:0);rz=.2;re=-.4*p}else{rx=-2.2*p;lx=-2.2*p;re=le=-.4}}
if(t==='titan'&&e.st==='wind'){rx=-2.9;rz=.15;re=-.5}if(t==='titan'&&e.st==='rec'){rx=-.4;rz=.3;re=-.2}
B[5].rotation.set(rx,0,rz);B[8].rotation.set(lx,0,lz);B[6].rotation.x=re;B[9].rotation.x=le;if(e.stg>0){B[5].rotation.set(-.2,0,.9);B[8].rotation.set(-.2,0,-.9)}}
else if(t==='drone'){for(let i=1;i<10;i++){const k=(i-1)%3;B[i].rotation.x=Math.sin(G.time*3+i+e.ph)*.35*(k+1)*.5+.3*m;B[i].rotation.z=Math.cos(G.time*2.3+i)*.25}B[0].rotation.x=-fl*.6+m*.2}
else if(t==='crawler'){for(let i=0;i<6;i++){const fb=3+i*2,off=(i%2===(i<3?0:1))?0:Math.PI,side=i<3?1:-1,q=e.phase*2.2+off;B[fb].rotation.y=Math.sin(q)*.35*m;B[fb].rotation.z=side*Math.max(0,Math.cos(q))*.35*m;B[fb+1].rotation.z=side*(-Math.max(0,Math.cos(q))*.3*m)}B[2].rotation.x=br*.05;B[1].rotation.x=-fl*.4+(e.atk>0?-.4:0)}
else if(t==='tank'){for(let i=0;i<4;i++){const fb=2+i*2,q=e.phase+(i===0||i===3?0:Math.PI);B[fb].rotation.x=Math.sin(q)*.18*m;B[fb].rotation.z=Math.max(0,Math.cos(q))*.15*m*(i%2?-1:1)}B[0].position.y=rest[0].y+Math.abs(c)*.05*m;B[1].rotation.x=-(e.aim||0);B[1].rotation.y=0}
else if(t==='warden'){B[0].position.y=rest[0].y+Math.sin(G.time*1.3)*.25;for(let i=3;i<9;i++)B[i].rotation.z=0;const up=e.st==='wind'?1:0;B[3].rotation.set(-.4*up+br*.05,0,.5*up+.1);B[6].rotation.set(-.4*up+br*.05,0,-.5*up-.1);B[4].rotation.x=-.5*up;B[7].rotation.x=-.5*up;
for(let i=9;i<B.length;i++)B[i].rotation.set(Math.sin(G.time*2+i)*.18,0,Math.cos(G.time*1.7+i*1.3)*.18);B[2].rotation.x=-fl*.3+(e.stg>0?.5:0);B[1].rotation.x=e.stg>0?.4:0;
if(e.halo)e.halo.rotation.z+=dt*.8;e.shards&&e.shards.forEach((s,i)=>{const a=G.time*.8+i/e.shards.length*TAU;s.position.set(Math.cos(a)*3.4,4.6+Math.sin(G.time*2+i)*.6,Math.sin(a)*3.4);s.rotation.set(a,a*1.3,0)})}
else if(t==='core'){const pulse=1+Math.sin(G.time*(e.ph2*2+2))*.04+(e.st==='wind'?.06:0);B[1].scale.set(pulse,pulse,pulse);for(let i=2;i<B.length;i++)B[i].rotation.set(Math.sin(G.time*1.5+i)*.15,0,Math.cos(G.time*1.2+i*.7)*.15)}
// hit flash / cloak
const f=e.fl>0?e.fl/.08:0;e.fl-=dt;const em=e.stg>0?.25:0;for(const i of[0,1,3]){e.mats[i].emissive.setRGB(f*1.2+(e.stg>0?.05:0),f*1.2+em*.3,f*1.2+em);if(e.type==='assassin')e.mats[i].opacity=e.alpha}
if(e.type==='assassin')e.mats[2].opacity=e.alpha,e.mats[2].transparent=true;
if(e.st==='wind'){e.mats[2].color.set(0xff3010).multiplyScalar(3+Math.sin(G.time*30)*2.5)}else if(e.stg>0)e.mats[2].color.set(0x4060ff).multiplyScalar(4);else e.mats[2].color.set(e.elite?0xff2a2a:ET[t].gc).multiplyScalar(4)}

// ================= COMBAT / AI =================
function pushOut(o,r){for(const b of W.ob){if(b.dead||!b.r)continue;const dx=o.x-b.x,dz=o.z-b.z,d=Math.hypot(dx,dz),m=r+b.r;if(d<m&&d>1e-4){o.x=b.x+dx/d*m;o.z=b.z+dz/d*m}}const L=A-.7;o.x=clamp(o.x,-L,L);o.z=clamp(o.z,-L,L)}
function steer(e,dx,dz){const p=e.g.position;let ax=dx,az=dz;
for(const b of W.ob){if(b.dead||!b.r)continue;const ox=b.x-p.x,oz=b.z-p.z,ah=ox*dx+oz*dz;if(ah<0||ah>4.5)continue;const lat=ox*-dz+oz*dx,m=b.r+e.r+.45;if(Math.abs(lat)<m){const k=(m-Math.abs(lat))/m*(1-ah/4.5)*1.8,sg=lat>0?-1:1;ax+=-dz*sg*k;az+=dx*sg*k}}
for(const o of EN){if(o===e)continue;const ox=p.x-o.g.position.x,oz=p.z-o.g.position.z,d=Math.hypot(ox,oz),m=e.r+o.r+.3;if(d<m&&d>1e-3){ax+=ox/d*(m-d)*2;az+=oz/d*(m-d)*2}}
const l=Math.hypot(ax,az)||1;return[ax/l,az/l]}
const angD=(a,b)=>{let d=b-a;while(d>Math.PI)d-=TAU;while(d<-Math.PI)d+=TAU;return d};
const rc=new THREE.Raycaster();
const _lf=v3(),_ld=v3();function los(from,to){_lf.copy(from);_ld.subVectors(to,_lf);const L=_ld.length();rc.set(_lf,_ld.normalize());rc.far=L;return rc.intersectObjects(W.solid,false).length===0}
const eye=()=>_v3.set(P.pos.x,P.pos.y+1.5,P.pos.z);
// enemy projectile
function eShot(from,to,speed,dmg,color,size,o={}){const v=new THREE.Vector3().subVectors(to,from).normalize().multiplyScalar(speed);if(o.spread){v.x+=rr(-1,1)*o.spread;v.y+=rr(-1,1)*o.spread*.5;v.z+=rr(-1,1)*o.spread}
ebAdd(from,v,dmg,color,size,o.splash||0,o.grav||0);if(NET.host)NRN().ev({k:'es',p:[r2(from.x),r2(from.y),r2(from.z)],v:[r2(v.x),r2(v.y),r2(v.z)],d:dmg,c:color,z:size,sl:o.splash||0,g:o.grav||0})}
function ebAdd(from,v,dmg,color,size,splash,grav){const s=sprite(color,4,size);s.position.copy(from);const cc=new THREE.Color(color).multiplyScalar(1.5);EB.push({p:from.clone(),v,dmg,life:6,s,c:color,cc:[cc.r,cc.g,cc.b],r:size*.35,splash,grav});play('eshot')}
function hurtE(e,dmg,part,point,o={}){if(e.dead||e.intro>0)return 0;let d=o.net?dmg:dmg*P.dm*(G.ovc||1),crit=false;
if(!o.net){if(part==='head'){d*=2;crit=true}else if(part==='weak'){d*=e.boss?2:2.5;crit=true}if(R()<P.crit){d*=2;crit=true}}
if(NET.client){if(!e.nid)return 0;NRN().cev({k:'hit',n:e.nid,d:Math.round(d*10)/10});let sh=e.boss?d*(e.st==='rec'?1.4:.42):d;if(e.shield>0)sh=Math.max(0,sh-e.shield);if(G.my)G.my.dmg+=sh;e.hp=Math.max(1,e.hp-sh);e.fl=.08;if(!e.boss)e.flinch=Math.min(1,e.flinch+.6);if(e.type==='assassin')e.alpha=1;if(point&&sh>0){dmgNum(point,sh,crit);hitMark(crit,false)}play(part==='head'?'head':crit?'crit':'hit');return sh}
if(e.boss)d*=e.st==='rec'?1.4:.42;
if(e.shield>0){const a=Math.min(e.shield,d);e.shield-=a;d-=a;e.shT=4;if(e.shieldM)e.shieldM.material.uniforms.color.value.set(0xffffff).multiplyScalar(3);if(point)sparks(point,0xffd84a,6,4,.3,.1)}
e.hp-=d;if(!o.net&&G.my)G.my.dmg+=Math.max(0,d);e.fl=.08;if(!e.boss)e.flinch=Math.min(1,e.flinch+.6);if(e.type==='assassin')e.alpha=1;
if(!o.net){if(point&&d>0){dmgNum(point,d,crit);hitMark(crit,false)}play(part==='head'?'head':crit?'crit':'hit')}if(e.hp<=0){killE(e,point);if(!o.net)hitMark(crit,true)}return d}
function killE(e,point){e.dead=1;if(NET.host&&e.nid)NRN().ev({k:'kill',n:e.nid,by:NET.killBy||NRN().me});const p=e.g.position.clone();p.y+=e.type==='drone'?e.y:e.boss?4:1;const d=ET[e.type];
const robot=e.type==='drone'||e.type==='tank'||e.type==='titan';sparks(p,d.gc,e.boss?120:30,e.boss?14:7,.9,e.boss?.4:.18);glowPuff(p,d.gc,e.boss?9:2.4,.3,4);smoke(p,e.boss?20:5,e.boss?3:1,2,1);
if(!robot)for(let i=0;i<18;i++)PS.emit(p.x,p.y,p.z,rr(-3,3),rr(1,5),rr(-3,3),rr(.6,1.1),rr(.15,.3),.06,.03,.05,.9,.2,12,.5);
flash(p,d.gc,e.boss?10:4,e.boss?30:10,.3);if(robot||e.boss)explosion(p,e.boss?6:1.6,d.gc);
G.kills++;if(!NET.client&&!NET.killBy&&G.my)G.my.k++;G.combo++;G.comboT=3.2;G.bestCombo=Math.max(G.bestCombo,G.combo);const pts=Math.round(d.sc*mult()*(e.elite?2:1));G.score+=pts;feed(e.type,pts,e.elite);
if(G.combo===10||G.combo===25||G.combo===50||G.combo===100){FACE.react('grin');banner('COMBO x'+G.combo,'',1.2);play('lvl')}
if(P.vamp)P.hp=Math.min(P.mhp,P.hp+P.vamp);
for(let i=0;i<e.xp;i++)dropGem(p);dropGold(p,Math.round(GOLD[e.type]*(e.elite?2:1)*(1+G.wave*.03)));if(!e.boss){if(R()<.09)dropPU(p);else if(R()<.07)dropHealth(p)}else{dropPU(p);dropHealth(p);dropHealth(p)}
if(e.boss){const bn=ET[e.type].boss;setTimeout(()=>bossStats(bn),2600);FACE.react('grin');G.boss=null;clrT();G.bosses++;save.bossKills++;G.slow=1.4;banner('GREAT ENEMY FELLED','+'+pts,3);hudBoss(null);bossEnd(e);play('roar')}
freeE(e)}
const mult=()=>1+Math.min(4,Math.floor(G.combo/5)*.5);
// ---------- telegraphs ----------
const BDM=()=>2.2*(1+G.bosses*.2);// boss damage multiplier (scales with each boss felled)
const telPool=[];function tel(x,z,r,t,dmg,owner,cb,color){if(owner&&owner.boss)dmg*=BDM();if(NET.host&&owner!=='net')NRN().ev({k:'tel',x:r2(x),z:r2(z),r,t,d:dmg,c:color||0xff3a1a});let m=telPool.pop();if(!m){m=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({uniforms:{prog:{value:0},color:{value:new THREE.Color()},time:{value:0}},vertexShader:SH.ringV,fragmentShader:SH.ringF,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-3}));m.rotation.x=-Math.PI/2}
m.material.uniforms.color.value.set(color||0xff3a1a);m.position.set(x,.05,z);m.scale.setScalar(r);scene.add(m);TEL.push({m,x,z,r,t,t0:t,dmg,owner,cb});play('warn')}
function clrT(owner){for(let i=TEL.length-1;i>=0;i--)if(!owner||TEL[i].owner===owner){scene.remove(TEL[i].m);telPool.push(TEL[i].m);TEL.splice(i,1)}}
function updTel(dt){for(let i=TEL.length-1;i>=0;i--){const q=TEL[i];q.t-=dt;const u=q.m.material.uniforms;u.prog.value=1-q.t/q.t0;u.time.value=G.time;
if(q.t<=0){const p=_v.set(q.x,.3,q.z);sparks(p,0xffa050,26,q.r*2.2,.6,.2);smoke(p,4,q.r*.5,1.5,1);shock(p,0xff6a30,q.r,.45);decal(_v2.set(q.x,0,q.z),_up,q.r*.8);play('slam');addShake(Math.min(.7,6/Math.max(4,Math.hypot(P.pos.x-q.x,P.pos.z-q.z))));
if(Math.hypot(P.pos.x-q.x,P.pos.z-q.z)<q.r&&P.pos.y<1.4)dmgP(q.dmg,q);if(!NET.client)for(const e of EN)if(!e.boss&&Math.hypot(e.g.position.x-q.x,e.g.position.z-q.z)<q.r)hurtE(e,q.dmg*.5,'body');q.cb&&q.cb();scene.remove(q.m);telPool.push(q.m);TEL.splice(i,1)}}}
// ---------- boss behaviour ----------
const WAVES=[];let waveMesh=null;
function bossIntro(e){G.bossIntroT=e.intro;hudBoss(e);play('roar');addShake(.8);banner(ET[e.type].boss,'GREAT ENEMY',2.8);
if(e.type==='core'){W.core.visible=W.shell.visible=false;W.rings.forEach(r=>r.visible=false);W.L.center.forEach(m=>m.visible=false);if(W.L.tear)W.L.tear.visible=false;W.coreLight.color.set(0xff2a2a);W.coreBase=5;scene.fog.color.set(0x1a0505);scene.fog.density=.022}
if(e.type==='warden'){scene.fog.density=.022}}
function bossEnd(e){if(e.type==='core'){W.core.visible=W.shell.visible=true;W.rings.forEach(r=>r.visible=true);W.L.center.forEach(m=>m.visible=true);if(W.L.tear)W.L.tear.visible=true;W.coreLight.color.set(W.L.reactor?0xff2a8a:W.L.core.c);W.coreBase=W.L.reactor?3:W.L.core.k}setTheme(W.theme);scene.fog.density=W.L.fog;G.grav=0}
function bossAI(e,dt,d,ux,uz){const p=e.g.position,ph=e.hp<e.mhp*.33?3:e.hp<e.mhp*.66?2:1,t=e.type;
if(ph>e.ph2){e.ph2=ph;if(NET.host)NRN().ev({k:'ban',t:'PHASE '+ph,s:t==='titan'?'THE TITAN RAGES':t==='warden'?'THE VOID DEEPENS':'MELTDOWN IMMINENT',d:2});banner('PHASE '+ph,t==='titan'?'THE TITAN RAGES':t==='warden'?'THE VOID DEEPENS':'MELTDOWN IMMINENT',2);play('roar');shock(p,ET[t].gc,10,.8);addShake(.8);clrT(e);e.st='idle';e.cd=1.5;e.laser=null;
if(d<9){P.vel.x+=-ux*18;P.vel.z+=-uz*18;P.vel.y=6;P.onG=0}if(t==='core'&&ph===3){scene.fog.color.set(0x2a0606)}}
if(e.stg>0){e.stg-=dt;e.st='idle';e.cd=1.2;return}
if(e.laser){const L=e.laser;L.t-=dt;const target=Math.atan2(P.pos.x-L.o.x,P.pos.z-L.o.z);L.a+=clamp(angD(L.a,target),-L.w*dt,L.w*dt);if(L.spin)L.a+=L.spin*dt;
const len=L.len,ex=L.o.x+Math.sin(L.a)*len,ez=L.o.z+Math.cos(L.a)*len,end=_v2.set(ex,L.y1,ez);laserFX(L.o,end,L.c);
// distance from player to beam segment (xz) + height test
const px=P.pos.x-L.o.x,pz=P.pos.z-L.o.z,bx=ex-L.o.x,bz=ez-L.o.z,tt=clamp((px*bx+pz*bz)/(bx*bx+bz*bz),0,1),dd=Math.hypot(px-bx*tt,pz-bz*tt),hy=L.o.y+(L.y1-L.o.y)*tt;
if(dd<.9&&Math.abs(P.pos.y+.9-hy)<1.4)dmgP(L.dps*dt,{x:L.o.x,z:L.o.z},1);if(R()<.5)sparks(_v.set(ex,Math.max(.1,L.y1),ez),L.c,2,4,.3,.15);if(L.t<=0){e.laser=null;laserFX(null)}}
if(e.st==='wind'){e.wt-=dt;e.atk=Math.min(1,e.atk+dt*2);if(e.wt<=0){e.st='rec';e.rt=1.7;e.atk=0}return}
if(e.st==='rec'){e.rt-=dt;if(e.rt<=0){e.st='idle';e.cd=Math.max(.5,1.3-.3*(ph-1))}return}
if(e.cd>0||e.laser)return;const r=R(),px=P.pos.x,pz=P.pos.z;let wind=1.25;
if(t==='titan'){const fx=Math.sin(e.yaw),fz=Math.cos(e.yaw);
if(ph>=2&&r<.22){e.laser={o:new THREE.Vector3(p.x,7.6,p.z),a:Math.atan2(px-p.x,pz-p.z)-.9*(R()<.5?1:-1),w:.75+ph*.15,t:2.6,len:40,y1:0,dps:30*BDM(),c:0xff3a1a};banner('','',0);play('rail');wind=.6}
else if(ph>=2&&r<.42){for(let i=0;i<5+ph*2;i++){const a=R()*TAU,rad=rr(0,9);tel(px+Math.cos(a)*rad,pz+Math.sin(a)*rad,2.8,1.2+i*.18,22,e,null,0xff7a1a)}if(ph===3&&R()<.5)for(let i=0;i<2;i++)G.spawnQ.push('drone');wind=1.4}
else if(r<.6){tel(p.x+fx*5,p.z+fz*5,6.8,1.25,34,e)}
else if(r<.8){for(let i=1;i<4;i++)tel(p.x+ux*i*4.6,p.z+uz*i*4.6,3.9,.95+i*.25,26,e)}
else{const tx=px,tz=pz;tel(tx,tz,6.2,1.5,36,e,()=>{p.x=clamp(tx,-A+4,A-4);p.z=clamp(tz,-A+4,A-4);pushOut(p,e.r)});e.leap={t:1.5,t0:1.5,fx:p.x,fz:p.z,tx,tz};wind=1.5}}
else if(t==='warden'){if(r<.3){const n=5+ph*2;for(let v=0;v<ph;v++)setTimeout(()=>{if(e.dead||G.mode!=='play')return;for(let i=0;i<n;i++){const a=Math.atan2(P.pos.x-p.x,P.pos.z-p.z)+(i-(n-1)/2)*.16;eShot(_v.set(p.x,4.6,p.z),_v2.set(p.x+Math.sin(a)*20,1.2,p.z+Math.cos(a)*20),14,12*BDM(),0x7ac8ff,.9)}},v*500);wind=.9}
else if(r<.55){for(let i=0;i<3+ph;i++)tel(px+rr(-9,9),pz+rr(-9,9),3.9,1.4+i*.1,28,e,null,0x7a5aff)}
else if(r<.75){G.grav=1.7;tel(p.x,p.z,9.5,1.7,36,e,null,0x5a8aff);bannerAll('','GRAVITY WELL — DASH OUT!',1.4);wind=1.7}
else if(r<.9||ph<2){burstAt(p,0x7ac8ff);const a=R()*TAU,rad=rr(9,16);p.x=clamp(px+Math.cos(a)*rad,-A+5,A-5);p.z=clamp(pz+Math.sin(a)*rad,-A+5,A-5);pushOut(p,e.r);burstAt(p,0x7ac8ff);play('spawn');e.cd=.6;return}
else{for(let i=0;i<3;i++){const a=R()*TAU;portal(px+Math.cos(a)*8,pz+Math.sin(a)*8,i<2?'crawler':'assassin')}wind=1}}
else{if(r<.28){for(let i=0;i<2+ph*2;i++)tel(px+rr(-10,10),pz+rr(-10,10),4,1.3+i*.15,28,e,null,0xff2a4a)}
else if(r<.5){const n=10+ph*4;for(let i=0;i<n;i++){const a=i/n*TAU+G.time;eShot(_v.set(Math.sin(a)*4.6,1.3,Math.cos(a)*4.6),_v2.set(Math.sin(a)*30,1.3,Math.cos(a)*30),9,10*BDM(),0xff3a6a,.8)}}
else if(r<.7){groundWave(0,0,11+ph,24*BDM(),0xff3a6a);bannerAll('','JUMP THE SHOCKWAVE!',1.2)}
else if(r<.85||ph<3){for(let k=0;k<3;k++){const a=R()*TAU;for(let i=1;i<4;i++)tel(Math.sin(a)*(3+i*4),Math.cos(a)*(3+i*4),3.6,1.1+i*.2,26,e,null,0xff2a4a)}if(ph>=2&&R()<.5)for(let i=0;i<3;i++)G.spawnQ.push('crawler')}
else{e.laser={o:new THREE.Vector3(0,1.15,0),a:R()*TAU,w:0,spin:(R()<.5?1:-1)*1.1,t:5,len:30,y1:1.15,dps:40*BDM(),c:0xff2a4a};bannerAll('','JUMP OVER THE BEAM!',1.4);wind=.8}}
e.st='wind';e.wt=wind;e.atk=0}
function burstAt(p,c){sparks(_v.set(p.x,3,p.z),c,50,9,.7,.25);glowPuff(_v,c,6,.4,4)}
function portal(x,z,type){const p=_v.set(x,1.5,z);glowPuff(p,0x9a5aff,4,1,3);sparks(p,0x9a5aff,30,5,.8,.2);setTimeout(()=>{if(G.mode==='play'||G.mode==='levelup'){const e=spawnE(type,{pos:{x,z}})}},700)}
function groundWave(x,z,speed,dmg,c){if(NET.host)NRN().ev({k:'gw',x:r2(x),z:r2(z),s:speed,d:dmg,c});if(!waveMesh){waveMesh=[];for(let i=0;i<3;i++){const m=new THREE.Mesh(new THREE.TorusGeometry(1,.18,8,128),new THREE.MeshBasicMaterial({color:0xffffff,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false}));m.rotation.x=Math.PI/2;m.visible=false;scene.add(m);waveMesh.push(m)}}
const m=waveMesh.find(q=>!q.visible)||waveMesh[0];m.visible=true;m.material.color.set(c).multiplyScalar(4);m.position.set(x,.35,z);WAVES.push({m,x,z,r:4.5,speed,dmg,hit:0});play('slam')}
function updWaves(dt){for(let i=WAVES.length-1;i>=0;i--){const w=WAVES[i];w.r+=w.speed*dt;w.m.scale.set(w.r,w.r,1.6);w.m.material.opacity=clamp(1.4-w.r/40,0,1);const d=Math.hypot(P.pos.x-w.x,P.pos.z-w.z);
if(!w.hit&&Math.abs(d-w.r)<.8&&P.pos.y<.55){w.hit=1;dmgP(w.dmg,w)}if(w.r>44){w.m.visible=false;WAVES.splice(i,1)}}}
let laserMesh=null;function laserFX(a,b,c){if(!laserMesh){laserMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:TX.beam,blending:THREE.AdditiveBlending,transparent:true,depthWrite:false,side:THREE.DoubleSide}));laserMesh.matrixAutoUpdate=false;laserMesh.frustumCulled=false;scene.add(laserMesh)}
if(!a){laserMesh.visible=false;return}laserMesh.visible=true;const len=a.distanceTo(b);_v.subVectors(b,a).normalize();_d.subVectors(cam.position,a).normalize();_e.crossVectors(_v,_d).normalize();const n=_w.crossVectors(_v,_e);
laserMesh.matrix.makeBasis(_v.clone().multiplyScalar(len),_e.clone().multiplyScalar(.9+Math.sin(G.time*40)*.15),n);laserMesh.matrix.setPosition(_d.copy(a).lerp(b,.5));laserMesh.material.color.set(c).multiplyScalar(5);flash(b,c,3,8,.05)}
// ---------- enemy update ----------
function updE(e,dt){const p=e.g.position,dx=P.pos.x-p.x,dz=P.pos.z-p.z,d=Math.hypot(dx,dz)||1,ux=dx/d,uz=dz/d,t=e.type;e.cd-=dt;e.hit-=dt;
if(e.intro>0){e.intro-=dt;if(e.boss){const base=t==='core'?.9:0,k=1-clamp(e.intro/2.6,0,1);p.y=lerp(t==='core'?-6:-9,base,1-Math.pow(1-k,3));if(R()<.6)sparks(_v.set(p.x+rr(-3,3),.2,p.z+rr(-3,3)),ET[t].gc,2,6,.6,.2);addShake(.02)}
animE(e,dt,0);return}
let mx=0,mz=0,k=1,sp=e.sp*(G.frz>0?.35:1),face=true;
if(t==='drone'){const rad=d>11?1:d<7?-.8:0,s=Math.sin(e.ph*.7);mx=ux*rad-uz*s;mz=uz*rad+ux*s;e.y=damp(e.y,2.6+Math.sin(e.ph*1.7)*.7,3,dt);
if(e.cd<0&&d<30){e.cd=rr(1.8,2.6);eShot(_v.set(p.x,p.y+e.y,p.z).addScaledVector(_d.set(ux,0,uz),.5),eye(),15,6,0x16e8ff,.5)}}
else if(t==='soldier'){const rad=d>16?1:d<9?-.7:0,s=Math.sin(e.ph*.55);mx=ux*rad-uz*s*.9;mz=uz*rad+ux*s*.9;
if(e.burst>0){e.bt-=dt;if(e.bt<=0){e.burst--;e.bt=.13;eShot(_v.set(p.x,1.3,p.z).addScaledVector(_d.set(ux,0,uz),.9),eye(),24,6,0xffa640,.4,{spread:.6})}}
else if(e.cd<0&&d<34){e.cd=rr(2.2,3);if(los(_v.set(p.x,1.5,p.z),eye().clone())){e.burst=3;e.bt=0}}}
else if(t==='assassin'){const near=d<4.5;e.alpha=damp(e.alpha,near||e.fl>0?1:.08,6,dt);mx=ux-uz*Math.sin(e.ph*3)*.4;mz=uz+ux*Math.sin(e.ph*3)*.4;k=near?1.15:1;
if(e.cd<0&&d>6){e.cd=rr(4.8,6.2);burstAt(p,0xc070ff);const a=Math.atan2(-Math.sin(P.yaw),-Math.cos(P.yaw))+Math.PI+rr(-.8,.8);p.x=P.pos.x+Math.sin(a)*rr(4,6);p.z=P.pos.z+Math.cos(a)*rr(4,6);pushOut(p,e.r);burstAt(p,0xc070ff);play('spawn')}
if(d<2.2&&e.hit<=0){e.hit=.9;e.atk=1;dmgP(12,p)}}
else if(t==='crawler'){const s=Math.sin(e.ph*4);mx=ux-uz*s*.4;mz=uz+ux*s*.4;if(e.leapT>0){e.leapT-=dt;k=1.9;e.y=Math.sin((1-e.leapT/.6)*Math.PI)*1.4}else e.y=0;
if(e.cd<0&&d>3.5&&d<8){e.cd=rr(4,6);e.leapT=.6}if(d<1.7&&e.hit<=0){e.hit=.6;e.atk=1;dmgP(8,p)}}
else if(t==='brute'){mx=ux;mz=uz;if(e.charge>0){e.charge-=dt;mx=e.cx;mz=e.cz;k=3.4;if(R()<.4)smoke(_v.set(p.x,.2,p.z),1,.6,.8);if(d<2.4&&e.hit<=0){e.hit=1;dmgP(24,p);P.vel.x+=e.cx*14;P.vel.z+=e.cz*14;P.vel.y=5;P.onG=0;e.charge=0;addShake(.5)}}
else if(e.cd<0&&d>5&&d<16){e.cd=rr(4,6);e.charge=1.25;e.cx=ux;e.cz=uz;play('roar')}if(d<2.7&&e.hit<=0&&e.charge<=0){e.hit=1.2;e.atk=1;setTimeout(()=>{if(!e.dead&&Math.hypot(P.pos.x-p.x,P.pos.z-p.z)<3.2)dmgP(20,p);shock(p,0xff5a2a,3,.4)},350)}}
else if(t==='tank'){const rad=d>19?1:d<12?-.5:0;mx=ux*rad;mz=uz*rad;e.aim=damp(e.aim||0,Math.atan2(1,d)*.5,3,dt);
if(e.chg>0){e.chg-=dt;e.mats[2].color.set(0xffa040).multiplyScalar(4+(1-e.chg)*10);if(e.chg<=0){const f=_v.set(p.x,2.3,p.z).addScaledVector(_d.set(ux,0,uz),2);eShot(f,eye(),18,24,0xff8a20,1.3,{splash:3.5});flash(f,0xff8a20,5,10,.15);addShake(.15)}}
else if(e.cd<0&&d<40){e.cd=rr(3.2,4.2);e.chg=1}}
else if(t==='elite'){const rad=d>14?1:d<8?-.6:0,s=Math.sin(e.ph*.8);mx=ux*rad-uz*s;mz=uz*rad+ux*s;e.shT=(e.shT||0)-dt;if(e.shT<=0&&e.shield<140)e.shield=Math.min(140,e.shield+dt*25);
if(e.shieldM){e.shieldM.visible=e.shield>1;e.shieldM.material.uniforms.color.value.lerp(new THREE.Color(0xffd84a).multiplyScalar(1.6),dt*4);e.shieldM.material.uniforms.time.value=G.time}
if(e.cd<0&&d<30){e.cd=rr(1.7,2.3);for(let i=-1;i<=1;i++){const a=Math.atan2(ux,uz)+i*.12;eShot(_v.set(p.x,1.7,p.z),_v2.set(p.x+Math.sin(a)*d,1.2,p.z+Math.cos(a)*d),19,9,0xffd84a,.5)}}
if(d<3.5&&e.hit<=0){e.hit=1.4;e.atk=1;e.lunge=.25;setTimeout(()=>{if(!e.dead&&Math.hypot(P.pos.x-p.x,P.pos.z-p.z)<2.8)dmgP(18,p)},220)}if(e.lunge>0){e.lunge-=dt;mx=ux;mz=uz;k=3}}
else{// bosses
if(e.leap){const L=e.leap;L.t-=dt;const u=1-L.t/L.t0;p.x=lerp(L.fx,L.tx,u);p.z=lerp(L.fz,L.tz,u);p.y=Math.sin(u*Math.PI)*7;if(L.t<=0){p.y=0;e.leap=null}animE(e,dt,0);faceTo(e,ux,uz,dt*3);return}
bossAI(e,dt,d,ux,uz);if(t==='titan'||t==='warden'){if(e.st==='idle'&&e.stg<=0&&d>(t==='warden'?14:6)){mx=ux;mz=uz;if(t==='warden'){mx-=uz*.6;mz+=ux*.6}}k=e.ph2>=3?1.35:1}face=e.stg<=0&&t!=='core'}
e.atk=Math.max(0,e.atk-dt*(e.boss?0:2.5));
let ms=0;if(mx||mz){const s=steer(e,mx,mz),l=Math.min(1,Math.hypot(mx,mz));e.vx=damp(e.vx,s[0]*sp*k*l,6,dt);e.vz=damp(e.vz,s[1]*sp*k*l,6,dt)}else{e.vx=damp(e.vx,0,6,dt);e.vz=damp(e.vz,0,6,dt)}
if(t!=='core'){p.x+=e.vx*dt;p.z+=e.vz*dt;pushOut(p,e.r)}ms=Math.hypot(e.vx,e.vz);
if(t==='drone'||t==='crawler')e.sm.position.y=e.y;if(t==='drone'){p.y=0}
if(face)faceTo(e,ux,uz,dt*(e.boss?2:6));e.look=clamp(angD(e.yaw,Math.atan2(ux,uz)),-.6,.6);animE(e,dt,ms)}
function faceTo(e,ux,uz,k){e.yaw+=angD(e.yaw,Math.atan2(ux,uz))*Math.min(1,k);e.g.rotation.y=e.yaw}
// projectiles
function updEB(dt){for(let i=EB.length-1;i>=0;i--){const b=EB[i];b.v.y-=b.grav*dt;b.p.addScaledVector(b.v,dt);b.s.position.copy(b.p);b.life-=dt;if(R()<.7)PA.emit(b.p.x,b.p.y,b.p.z,0,0,0,.25,b.r*1.6,b.cc[0],b.cc[1],b.cc[2],.7,-.5,0,0);
let hit=false;const dy=b.p.y-(P.pos.y+1),dd=Math.hypot(b.p.x-P.pos.x,dy*.8,b.p.z-P.pos.z);if(dd<.6+b.r){dmgP(b.dmg,b.p);hit=true}
if(b.p.y<.05||Math.abs(b.p.x)>A-.1||Math.abs(b.p.z)>A-.1||b.p.y>HT)hit=true;if(!hit)for(const o of W.ob)if(!o.dead&&o.r&&b.p.y<(o.h||20)&&Math.hypot(b.p.x-o.x,b.p.z-o.z)<o.r){hit=true;if(o.kind)hurtProp(o,b.dmg*.5,b.p);break}
if(hit||b.life<=0){impact(b.p,null,b.c,b.splash>0);if(b.splash){explosion(b.p,b.splash*.6,b.c);const d=Math.hypot(b.p.x-P.pos.x,b.p.z-P.pos.z);if(d<b.splash&&d>=.6+b.r)dmgP(b.dmg*.6*(1-d/b.splash),b.p)}freeSprite(b.s);EB.splice(i,1)}}}
// ---------- player weapons ----------
const rocketG=new THREE.CylinderGeometry(.06,.08,.5,10);rocketG.rotateX(Math.PI/2);let rocketMats=null;
function fire(){const w=WEP[P.cw];P.next=w.rate/P.rm;if(w.m==='shotgun'){VM.pumpT=.5;setTimeout(()=>play('pump'),170)}P.ammo[P.cw]--;VM.kick+=w.vk;VM.mft=.05;const ak=1-.5*P.adsK;P.rec+=w.kick*(1+R()*.3)*ak;P.recY+=rr(-1,1)*w.kick*.4*ak;play(w.snd);addShake(w.vk*.6*ak);
cam.updateMatrixWorld();const mz=muzzleWorld(v3());flash(mz,w.c,2.5,9,.06);const dir=v3();cam.getWorldDirection(dir);
const pel=w.pel+(P.proj>0?(w.pel>1?P.proj*2:P.proj):0);
for(let i=0;i<pel;i++){const d=dir.clone();const s=(w.sp+(i>0&&w.pel===1?.03:0)+(P.moving?.006:0))*(1-.88*P.adsK);if(s>0){d.x+=rr(-1,1)*s;d.y+=rr(-1,1)*s;d.z+=rr(-1,1)*s;d.normalize()}
if(w.proj){rc.set(cam.position,d);rc.far=200;const h=rc.intersectObjects(HB.concat(W.solid),false)[0],aim=h?h.point:cam.position.clone().addScaledVector(d,200);const v=aim.clone().sub(mz).normalize();
const pr={p:mz.clone(),v:v.multiplyScalar(w.proj==='rocket'?40:24),w,life:4,kind:w.proj};pr.s=sprite(w.c,w.proj==='void'?3:5,w.proj==='void'?1.3:.7);if(w.proj==='rocket'){pr.m=MOD.geo.rocket?new THREE.Mesh(MOD.geo.rocket,rocketMats||(rocketMats=vmMats(0xff5a2a))):new THREE.Mesh(rocketG,MAT.metal);pr.m.scale.setScalar(1.4);pr.flip=!!MOD.geo.rocket;scene.add(pr.m)}
if(w.proj==='void'){pr.core=sprite(0x000000,1,.5);pr.core.material.blending=THREE.NormalBlending;pr.core.material.color.set(0x050008)}PR.push(pr);continue}
rc.set(cam.position,d);rc.far=150;const hits=rc.intersectObjects(HB.concat(W.solid),false);let end=null,done=new Set();
for(const h of hits){const ud=h.object.userData;if(ud.e){if(done.has(ud.e))continue;done.add(ud.e);hurtE(ud.e,w.dmg,ud.part,h.point);impact(h.point,null,ET[ud.e.type].gc,w.pierce);if(!w.pierce){end=h.point;break}continue}
end=h.point;const n=h.face?h.face.normal.clone().transformDirection(h.object.matrixWorld):_up;if(ud.prop)hurtProp(ud.prop,w.dmg*P.dm,h.point);impact(h.point,n,w.c,w.pierce);break}
if(!end)end=cam.position.clone().addScaledVector(d,150);tracer(mz,end,w.c,w.pierce?.22:w.pel>1?.035:.045,w.pierce?.35:.08);if(w.pierce){for(let k=0;k<20;k++){const q=mz.clone().lerp(end,R());PA.emit(q.x,q.y,q.z,rr(-.3,.3),rr(-.3,.3),rr(-.3,.3),rr(.3,.7),rr(.1,.25),1.2,1.6,3,1,.2,0,1)}}}
if(P.ammo[P.cw]<=0)setTimeout(()=>{if(P.ammo[P.cw]<=0)reload()},180)}
function reload(){const w=WEP[P.cw];if(P.rl>0||P.ammo[P.cw]>=Math.round(w.mag*P.mag))return;P.rl=P.rlt=w.rl/P.rls;P.charge=0;mdown=mdown?2:0}
function updPR(dt){for(let i=PR.length-1;i>=0;i--){const q=PR[i],step=q.v.length()*dt,prev=q.p.clone();q.p.addScaledVector(q.v,dt);q.life-=dt;q.s.position.copy(q.p);if(q.core)q.core.position.copy(q.p);
if(q.m){q.m.position.copy(q.p);q.m.lookAt(_v.copy(q.p).add(q.v));if(q.flip)q.m.rotateY(Math.PI)}if(q.kind==='rocket'){PS.emit(prev.x,prev.y,prev.z,rr(-.3,.3),rr(-.1,.4),rr(-.3,.3),1.4,.35,.25,.25,.27,.45,1.2,-.1,.5);PA.emit(prev.x,prev.y,prev.z,0,0,0,.12,.5,3,1.4,.4,1,-1,0,0)}
else{for(let k=0;k<2;k++)PA.emit(q.p.x+rr(-.3,.3),q.p.y+rr(-.3,.3),q.p.z+rr(-.3,.3),rr(-1,1),rr(-1,1),rr(-1,1),.4,.4,1.2,.4,2.4,1,-.6,0,1)}
rc.set(prev,_v.copy(q.v).normalize());rc.far=step+.3;const h=rc.intersectObjects(HB.concat(W.solid),false)[0];let hitP=h?h.point:null;
if(!hitP)for(const e of EN){const ep=e.g.position,hy=e.boss?4:1;if(Math.hypot(q.p.x-ep.x,q.p.y-(ep.y+hy),q.p.z-ep.z)<e.r+.5){hitP=q.p.clone();break}}
if(!hitP&&(q.p.y<.05||q.life<=0))hitP=q.p.clone();
if(hitP){boom(hitP,q.w.splash,q.w.dmg,q.w.c,h&&h.object.userData.e?h.object.userData:null);freeSprite(q.s);if(q.core)freeSprite(q.core);if(q.m)scene.remove(q.m);PR.splice(i,1)}}}
function boom(p,rad,dmg,c,direct){explosion(p,rad*.55,c);if(c===0xb04bff){glowPuff(p,0x6a00ff,rad*2,.6,2);sparks(p,0xb04bff,60,rad*3,1,.3)}
for(const e of EN.slice()){const ep=e.g.position,hy=e.boss?3:1,d=Math.hypot(p.x-ep.x,p.y-(ep.y+hy),p.z-ep.z)-e.r;if(d<rad){const part=direct&&direct.e===e?direct.part:'body';hurtE(e,dmg*(d<=0?1:Math.pow(1-d/rad,.6)),part,_v.set(ep.x,ep.y+hy,ep.z))}}
for(const pr of W.crates.concat(W.barrels))if(!pr.dead&&Math.hypot(p.x-pr.x,p.z-pr.z)<rad)hurtProp(pr,dmg,null);const dp=Math.hypot(p.x-P.pos.x,p.y-(P.pos.y+.9),p.z-P.pos.z);if(dp<rad*.7)dmgP(12*(1-dp/(rad*.7)),p)}
function hurtProp(pr,dmg,point){if(pr.dead)return;pr.hp-=dmg;if(point)sparks(point,pr.kind==='barrel'?0xffa040:0xc8b080,5,3,.3,.1);if(pr.hp>0)return;pr.dead=1;
W.group.remove(pr.m);const si=W.solid.indexOf(pr.m);if(si>=0)W.solid.splice(si,1);const p=_v.set(pr.x,pr.top?1.8:.6,pr.z).clone();
if(pr.kind==='barrel'){setTimeout(()=>boom(p,5,75,0xff7a2a),60)}else{for(let i=0;i<24;i++)PS.emit(p.x+rr(-.5,.5),p.y+rr(-.4,.4),p.z+rr(-.5,.5),rr(-4,4),rr(1,6),rr(-4,4),rr(.8,1.4),rr(.12,.3),.18,.2,.13,1,0,14,.3);smoke(p,4,.8,1.2);play('hit');
if(R()<.3)dropHealth(p);else if(R()<.14)dropPU(p);if(pr.topC&&!pr.topC.dead){pr.topC.hp=0;hurtProp(pr.topC,1,null)}}}
// ---------- player damage ----------
function dmgP(d,src,silent){if(NET.tgt){if(!silent){NET.hurt[NET.tgt]=(NET.hurt[NET.tgt]||0)+d;NET.hurtSrc[NET.tgt]=src}return}if(P.inv>0||G.mode!=='play'||P.dead)return;if(P.shieldPU>0){if(!silent)play('shield');return}P.sd=4;const a=Math.min(P.sh,d);P.sh-=a;P.hp-=d-a;FACE.react('hurt',d>=20||d>=P.mhp*.2?1:0);if(H.face){H.face.classList.add('hit');clearTimeout(H.faceT);H.faceT=setTimeout(()=>H.face.classList.remove('hit'),90)}G.dmgFX=Math.min(1,G.dmgFX+.35+d/40);if(!silent){addShake(.25+d/60);play(a>=d?'shield':'hurt')}
if(src&&src.x!==undefined)dmgDir(Math.atan2(src.x-P.pos.x,src.z-P.pos.z));if(P.hp<=0){P.hp=0;die()}}
// ---------- pickups ----------
function dropGem(p){if(!MOD.geo.gem){addXP(1);return}if(!gemIM){gemIM=new THREE.InstancedMesh(MOD.geo.gem,new THREE.MeshBasicMaterial({color:new THREE.Color(0x3dff9a).multiplyScalar(2.6)}),400);gemIM.frustumCulled=false;gemIM.count=0;scene.add(gemIM)}
if(GEMS.length>=400){addXP(1);return}GEMS.push({p:new THREE.Vector3(p.x+rr(-.6,.6),p.y,p.z+rr(-.6,.6)),v:new THREE.Vector3(rr(-3,3),rr(3,6),rr(-3,3)),t:rr(0,6),age:0})}
const _o=new THREE.Object3D();
const COINS=[];let coinIM=null,coinSndT=0;
function dropGold(p,v){if(!coinIM){const g=new THREE.CylinderGeometry(.19,.19,.05,18);g.rotateX(Math.PI/2);coinIM=new THREE.InstancedMesh(g,std({color:0xffc23a,metalness:1,roughness:.28,emissive:0xff9a10,emissiveIntensity:.9}),300);coinIM.frustumCulled=false;coinIM.count=0;scene.add(coinIM)}
const n=Math.min(8,Math.max(1,Math.ceil(v/4)));let left=v;for(let i=0;i<n;i++){const cv=i===n-1?left:Math.floor(v/n);left-=cv;if(COINS.length>=300){addGold(cv);continue}COINS.push({p:new THREE.Vector3(p.x+rr(-.4,.4),Math.max(.4,p.y),p.z+rr(-.4,.4)),v:new THREE.Vector3(rr(-3.5,3.5),rr(4,7),rr(-3.5,3.5)),t:rr(0,6),age:0,val:cv})}}
function addGold(v){if(v<=0)return;G.gold+=v;G.goldTot+=v;G.goldPop=.25}
function updCoins(dt){if(!coinIM)return;coinSndT-=dt;const vac=G.exit>=0;for(let i=COINS.length-1;i>=0;i--){const c=COINS[i];c.age+=dt;c.t+=dt;const tp=_v.set(P.pos.x,P.pos.y+1,P.pos.z),d=c.p.distanceTo(tp);
if((d<6||vac||P.mag2>0)&&c.age>.5){c.v.lerp(tp.sub(c.p).normalize().multiplyScalar(vac?24:16),dt*6)}else{c.v.y-=16*dt;c.v.x*=1-dt*2;c.v.z*=1-dt*2}c.p.addScaledVector(c.v,dt);if(c.p.y<.2){c.p.y=.2;c.v.y*=-.35;c.v.x*=.7;c.v.z*=.7}
if(d<1.2&&c.age>.4){COINS.splice(i,1);addGold(c.val);if(coinSndT<=0){play('coin');coinSndT=.06}PA.emit(c.p.x,c.p.y,c.p.z,0,1.2,0,.25,.45,3,2.2,.6,1,1,0,0)}}
coinIM.count=COINS.length;COINS.forEach((c,i)=>{_o.position.copy(c.p);_o.position.y+=c.age>.8?Math.sin(c.t*4)*.06:0;_o.rotation.set(0,c.t*5,0);_o.scale.setScalar(1);_o.updateMatrix();coinIM.setMatrixAt(i,_o.matrix)});coinIM.instanceMatrix.needsUpdate=true}
function updGems(dt){if(!gemIM)return;const mag=P.mag2>0;for(let i=GEMS.length-1;i>=0;i--){const g=GEMS[i];g.age+=dt;g.t+=dt;const tp=_v.set(P.pos.x,P.pos.y+1,P.pos.z),d=g.p.distanceTo(tp);
if(d<(mag?60:5)&&g.age>.4){g.v.lerp(tp.sub(g.p).normalize().multiplyScalar(18),dt*6)}else{g.v.y-=14*dt;g.v.x*=1-dt*2;g.v.z*=1-dt*2}g.p.addScaledVector(g.v,dt);if(g.p.y<.25){g.p.y=.25;g.v.y*=-.3}
if(d<1.1&&g.age>.3){GEMS.splice(i,1);addXP(1);play('xp');PA.emit(g.p.x,g.p.y,g.p.z,0,1,0,.25,.5,.5,3,1.5,1,1,0,0)}}
gemIM.count=GEMS.length;GEMS.forEach((g,i)=>{_o.position.copy(g.p);_o.position.y+=Math.sin(g.t*3)*.08;_o.rotation.set(0,g.t*2.5,.3);_o.scale.setScalar(1.3);_o.updateMatrix();gemIM.setMatrixAt(i,_o.matrix)});gemIM.instanceMatrix.needsUpdate=true}
const PUT=[['OVERDRIVE',0xffe14a,'Double fire rate'],['BERSERKER',0xff3a3a,'Triple damage'],['SHIELD',0x4ab8ff,'Invulnerable'],['MAGNET',0x3dff9a,'XP comes to you'],['FREEZE',0x9af0ff,'Enemies slowed'],['NUKE',0xff8a2a,'Obliterate nearby foes']];
const puTex={};function puIcon(k){if(puTex[k])return puTex[k];const c=new THREE.Color(PUT[k][1]).getStyle();return puTex[k]=new THREE.CanvasTexture(cv(128,128,x=>{x.translate(64,64);x.strokeStyle=c;x.fillStyle=c;x.lineWidth=7;x.shadowColor=c;x.shadowBlur=14;x.beginPath();x.arc(0,0,52,0,TAU);x.stroke();x.lineWidth=8;x.lineJoin='round';x.beginPath();
if(k===0){x.moveTo(8,-38);x.lineTo(-18,4);x.lineTo(2,4);x.lineTo(-8,38);x.lineTo(20,-6);x.lineTo(0,-6);x.closePath();x.fill()}
else if(k===1){for(const o of[-16,0,16]){x.moveTo(o-10,-26);x.lineTo(o+10,26)}x.stroke()}
else if(k===2){for(let i=0;i<6;i++){const a=i/6*TAU-Math.PI/2;x.lineTo(Math.cos(a)*30,Math.sin(a)*30)}x.closePath();x.stroke()}
else if(k===3){x.arc(0,-2,22,Math.PI,0,true);x.moveTo(-22,-2);x.lineTo(-22,-28);x.moveTo(22,-2);x.lineTo(22,-28);x.stroke()}
else if(k===4){for(let i=0;i<3;i++){const a=i/3*Math.PI;x.moveTo(Math.cos(a)*32,Math.sin(a)*32);x.lineTo(-Math.cos(a)*32,-Math.sin(a)*32)}x.stroke()}
else{for(let i=0;i<3;i++){const a=i/3*TAU-Math.PI/2;x.moveTo(0,0);x.arc(0,0,32,a-.5,a+.5);x.closePath()}x.fill();x.beginPath();x.fillStyle='#000';x.arc(0,0,9,0,TAU);x.fill()}}))}
const hpTex=()=>puTex.hp||(puTex.hp=new THREE.CanvasTexture(cv(128,128,x=>{x.translate(64,64);x.fillStyle='#4dff88';x.shadowColor='#4dff88';x.shadowBlur=16;x.fillRect(-12,-36,24,72);x.fillRect(-36,-12,72,24)})));
function dropPU(p){const k=ri(6);const s=sprite(0xffffff,2.2,1.1,puIcon(k)),gl=sprite(PUT[k][1],1.6,2.4);PUS.push({p:new THREE.Vector3(p.x,1.1,p.z),k,s,gl,life:22})}
function dropHealth(p){const s=sprite(0xffffff,2,.8,hpTex()),gl=sprite(0x4dff88,1.2,1.6);PUS.push({p:new THREE.Vector3(p.x+rr(-.5,.5),.9,p.z+rr(-.5,.5)),k:-1,s,gl,life:25})}
function updPU(dt){for(let i=PUS.length-1;i>=0;i--){const u=PUS[i];u.life-=dt;const y=u.p.y+Math.sin(G.time*3+i)*.15;u.s.position.set(u.p.x,y,u.p.z);u.gl.position.set(u.p.x,y,u.p.z);const blink=u.life<4&&Math.sin(G.time*20)>0;u.s.visible=u.gl.visible=!blink;
if(Math.hypot(P.pos.x-u.p.x,P.pos.z-u.p.z)<1.5&&P.pos.y<2.5){getPU(u.k);u.life=0}if(u.life<=0){freeSprite(u.s);freeSprite(u.gl);PUS.splice(i,1)}}}
function getPU(k){play('pickup');FACE.react('grin');if(k<0){P.hp=Math.min(P.mhp,P.hp+25);feed('','+25 HEALTH',0,'#4dff88');return}const n=PUT[k][0];banner('',n+' — '+PUT[k][2],1.4);P.pu[k]=k===5?0:10;
if(k===4){G.frz=8;if(NET.client)NRN().cev({k:'frz'})}if(k===2)P.shieldPU=8;if(k===3)P.mag2=10;if(k===5){addShake(.8);explosion(_v.set(P.pos.x,1,P.pos.z),5,0xff8a2a);for(const e of EN.slice())if(!e.boss&&e.g.position.distanceTo(P.pos)<22)hurtE(e,9999,'body',e.g.position.clone().setY(1));else if(e.boss&&e.g.position.distanceTo(P.pos)<22)hurtE(e,250,'body',e.g.position.clone().setY(3))}}
function addXP(n){P.xp+=n*P.xpMul;if(P.xp>=P.need&&G.mode==='play')levelUp()}

// ================= PLAYER / WAVES / PROGRESSION =================
const keys={};let mdown=0;
const flashL=new THREE.SpotLight(0xdfe8ff,1.3,38,.42,.55,1.4);cam.add(flashL);flashL.position.set(.3,-.2,0);cam.add(flashL.target);flashL.target.position.set(0,-.3,-6);
SFX.step=()=>noise(.07,.09,'lowpass',380,120,1,{wet:.05});
function newRun(){if(G.boss)bossEnd(G.boss);evtEnd();for(const e of EN.slice())freeE(e);EN.length=0;EB.forEach(b=>freeSprite(b.s));EB.length=0;PR.forEach(q=>{freeSprite(q.s);q.core&&freeSprite(q.core);q.m&&scene.remove(q.m)});PR.length=0;
GEMS.length=0;PUS.forEach(u=>{freeSprite(u.s);freeSprite(u.gl)});PUS.length=0;clrT();WAVES.forEach(w=>w.m.visible=false);WAVES.length=0;laserFX(null);PA.clear();PS.clear();FX.decals.forEach(m=>m.visible=false);
const u=save.up;Object.assign(P,{hp:100+u.hp*20,mhp:100+u.hp*20,msh:60*(1+u.sh*.15),sh:60*(1+u.sh*.15),sd:0,lvl:1,xp:0,need:6,cw:0,last:0,ammo:WEP.map(w=>w.mag),rl:0,rlt:1,next:0,charge:0,dashMax:1+u.dash,dashC:1+u.dash,dashT:0,inv:0,
dm:1+u.dmg*.1,rm:1,sm:1+u.spd*.06,crit:.05,mag:1,xpMul:1+u.xp*.1,proj:0,rls:1,vamp:0,pu:[0,0,0,0,0,0],shieldPU:0,mag2:0,dead:0,own:[1,0,0,0,0],ads:0,adsK:0,adsOn:0,onG:1,sprint:0,moving:0,rec:0,recY:0,yaw:0,pitch:0,stepT:0,fovK:0,odOn:false,bzOn:false});
P.pos.set(0,0,21);P.vel.set(0,0,0);Object.assign(G,{boss:null,wave:0,spawnQ:[],spawnT:0,score:0,kills:0,combo:0,comboT:0,bestCombo:0,t0:performance.now(),time:0,bosses:0,ts:1,slow:0,shake:0,evt:'',evtT:0,breather:2.2,waveClear:1,frz:0,grav:0,ovc:1,dmgFX:0,mods:{},fade:0,my:{k:0,dmg:0,rev:0},endless:0,xtAsked:0,gold:0,goldTot:0,goldPop:0,exit:-1,entry:-1,rooms:1,tf:0,shopOn:0,medN:0,tuneN:0,picks:[],resumed:0});
COINS.length=0;if(coinIM)coinIM.count=0;applyRP(NET.on&&NET.startRP?NET.startRP:rollRP(false));hudBoss(null);P.ammo=WEP.map(w=>Math.round(w.mag*P.mag));VM.cur=-1}
function tryDash(){if(P.dashC<1||P.dead)return;P.dashC--;const f=(keys.KeyW?1:0)-(keys.KeyS?1:0)+(mv.y<-.3?1:mv.y>.3?-1:0),s=(keys.KeyD?1:0)-(keys.KeyA?1:0)+(mv.x>.3?1:mv.x<-.3?-1:0);let dx=-Math.sin(P.yaw)*f+Math.cos(P.yaw)*s,dz=-Math.cos(P.yaw)*f-Math.sin(P.yaw)*s;
if(!f&&!s){dx=-Math.sin(P.yaw);dz=-Math.cos(P.yaw)}const l=Math.hypot(dx,dz);P.vel.x=dx/l*27;P.vel.z=dz/l*27;P.inv=.32;P.fovK=1;play('dash');for(let i=0;i<14;i++)PA.emit(P.pos.x+rr(-.4,.4),P.pos.y+rr(.3,1.6),P.pos.z+rr(-.4,.4),-dx/l*4,0,-dz/l*4,.35,.3,.4,1.6,3,.8,-.5,0,2)}
const mv={x:0,y:0};
function updP(dt){if(P.dead)return;const f=(keys.KeyW?1:0)-(keys.KeyS?1:0)-mv.y,s=(keys.KeyD?1:0)-(keys.KeyA?1:0)+mv.x;let wx=-Math.sin(P.yaw)*f+Math.cos(P.yaw)*s,wz=-Math.cos(P.yaw)*f-Math.sin(P.yaw)*s;const wl=Math.hypot(wx,wz);if(wl>1){wx/=wl;wz/=wl}
const adsC=P.ads&&WEP[P.cw].m==='rifle'&&P.rl<=0&&VM.sw<.5;P.adsK=damp(P.adsK,adsC?1:0,adsC?13:18,dt);if(adsC!==!!P.adsOn){P.adsOn=adsC;play(adsC?'scope':'unscope')}
P.sprint=keys.ShiftLeft&&f>0&&P.inv<=0&&!adsC?1:0;const spd=7.2*P.sm*(P.sprint?1.32:1)*(G.grav>0?.75:1)*(1-.4*P.adsK),acc=P.onG?11:3;
P.vel.x=damp(P.vel.x,wx*spd,P.inv>0?1.5:acc,dt);P.vel.z=damp(P.vel.z,wz*spd,P.inv>0?1.5:acc,dt);
if(G.grav>0&&G.boss){G.grav-=dt;const b=G.boss.g.position,dx=b.x-P.pos.x,dz=b.z-P.pos.z,d=Math.hypot(dx,dz)||1;P.vel.x+=dx/d*9*dt;P.vel.z+=dz/d*9*dt;if(R()<.5)PA.emit(P.pos.x+rr(-3,3),rr(.2,2),P.pos.z+rr(-3,3),dx/d*6,0,dz/d*6,.4,.2,.6,.8,3,.8,0,0,0)}
P.vel.y-=24*dt;P.pos.addScaledVector(P.vel,dt);if(P.pos.y<=0){if(!P.onG&&P.vel.y<-6){play('land');VM.kick+=.05}P.pos.y=0;P.vel.y=0;P.onG=1;if(keys.Space){P.vel.y=8.4;P.onG=0;play('jump')}}else P.onG=0;
pushOut(P.pos,.5);P.moving=Math.hypot(P.vel.x,P.vel.z)>2&&P.onG;if(P.moving){P.stepT-=dt*(P.sprint?1.4:1);if(P.stepT<=0){P.stepT=.36;play('step')}}
P.inv-=dt;P.dashT+=dt;if(P.dashC<P.dashMax&&P.dashT>1.6){P.dashC++;P.dashT=0}if(P.dashC>=P.dashMax)P.dashT=0;
P.sd-=dt;if(P.sd<=0&&P.sh<P.msh)P.sh=Math.min(P.msh,P.sh+dt*32);
// recoil recovery
P.rec=damp(P.rec,0,7,dt);P.recY=damp(P.recY,0,7,dt);P.fovK=damp(P.fovK,0,5,dt);
const bob=P.moving?Math.sin(VM.bob*2)*.035:0;cam.position.set(P.pos.x,P.pos.y+1.65+bob,P.pos.z);
let sx=0,sy=0;if(G.shake>0){const k=G.shake*G.shake;sx=(R()-.5)*k*.12;sy=(R()-.5)*k*.12;G.shake=Math.max(0,G.shake-dt*1.8)}
const br=P.adsK*(P.moving?.0035:.0012);cam.rotation.set(clamp(P.pitch+P.rec,-1.5,1.5)+sy+Math.sin(G.time*1.3)*br,P.yaw+P.recY+sx+Math.sin(G.time*.9+1)*br,sx*.5);const fov=(save.set.fov+P.fovK*10+(P.sprint?5:0))*(1-.6*P.adsK);if(Math.abs(cam.fov-fov)>.05){cam.fov=P.adsK>.02&&P.adsK<.98?fov:damp(cam.fov,fov,10,dt);cam.updateProjectionMatrix()}
// weapon
const w=WEP[P.cw];P.next-=dt;if(P.rl>0){P.rl-=dt;if(P.rl<=0)P.ammo[P.cw]=Math.round(w.mag*P.mag)}
const can=P.next<=0&&P.rl<=0&&P.ammo[P.cw]>0&&VM.sw<.2;
if(w.charge){if(mdown&&can){if(P.charge===0)play('railCharge');P.charge+=dt;if(P.charge>=w.charge){fire();P.charge=0;mdown=w.auto?mdown:2}}else if(!mdown)P.charge=0}
else if(mdown&&can&&(w.auto||mdown===1)){fire();if(!w.auto)mdown=2}
if(mdown===1&&P.ammo[P.cw]<=0&&P.rl<=0&&P.next<=0){play('empty');P.next=.3;reload()}
// power-ups
for(let i=0;i<6;i++)if(P.pu[i]>0){P.pu[i]-=dt;if(P.pu[i]<=0)P.pu[i]=0}
const od=P.pu[0]>0,bz=P.pu[1]>0;if(od!==!!P.odOn){P.rm*=od?2:.5;P.odOn=od}if(bz!==!!P.bzOn){P.dm*=bz?3:1/3;P.bzOn=bz}P.shieldPU-=dt;P.mag2-=dt}
let lockMsgT=0;function cycleW(dir){for(let k=1;k<WEP.length;k++){const j=(P.cw+dir*k+WEP.length*k)%WEP.length;if(P.own[j]){switchW(j);return}}}
function switchW(i){if(i===P.cw||i<0||i>=WEP.length||P.dead)return;if(!P.own[i]){if(performance.now()-lockMsgT>900){lockMsgT=performance.now();play('empty');feed('',WEP[i].n+' LOCKED · ◉'+PRICE[i]+' AT THE ARMORY',0,'#ffcf4a')}return}P.last=P.cw;P.cw=i;P.rl=0;P.charge=0;VM.sw=1;P.next=Math.max(P.next,.25);play('swap')}
// ---------- waves ----------
function nextWave(){G.wave++;const w=G.wave,boss=w%5===0;G.spawnQ=[];G.mods={};evtEnd();
if(boss){const bt=['titan','warden','core'][((w/5)-1)%3];G.spawnQ.push(bt);banner('WAVE '+w,'BOSS INCOMING — '+ET[bt].boss,3.2);play('warn');setTimeout(()=>play('roar'),400)}
else{const pool=['drone','drone','soldier'];if(w>=2)pool.push('soldier');if(w>=3)pool.push('crawler','crawler');if(w>=4)pool.push('assassin');if(w>=6)pool.push('brute');if(w>=7)pool.push('tank');if(w>=9)pool.push('assassin','brute');
const n=Math.min(42,5+Math.round(w*2.3));for(let i=0;i<n;i++)G.spawnQ.push(pick(pool));if(w>=4)for(let i=0;i<Math.floor(w/4);i++)G.spawnQ.push('elite');
if(w>=10){G.mods.hp=1+(w-9)*.08;G.mods.sp=Math.min(1.25,1+(w-9)*.02)}G.spawnQ.sort(()=>R()-.5);
G.eliteChance=w>=6?.04+w*.006:0;banner('WAVE '+w,w===1?'SECTOR — '+W.L.name:w===3?'NEW THREAT: VOID CRAWLERS':w===4?'NEW THREAT: ASSASSINS & ELITES':w===6?'NEW THREAT: BRUTES':w===7?'NEW THREAT: TANKS':'HOSTILES INBOUND',2.4);play('warn');
if(w>=3&&R()<.45)setTimeout(()=>{if(G.mode==='play'||G.mode==='levelup')evtStart()},3000)}G.waveClear=0;if(NET.host)NRN().ev({k:'wave',w:G.wave,bt:H.banT.textContent,bs:H.banS.textContent})}
function updSpawns(dt){if(NET.client){if(G.breather>0)G.breather-=dt;if(G.exit>=0&&!P.dead){const d=W.doors[G.exit];if(Math.hypot(P.pos.x-d.x,P.pos.z-d.z)<2.6)enterTransit()}return}if(G.breather>0){G.breather-=dt;if(G.breather<=0)nextWave();return}G.spawnT-=dt;const cap=save.set.q===0?9:save.set.q===1?12:15;
if(G.spawnQ.length&&G.spawnT<=0&&EN.length<cap){const t=G.spawnQ[G.spawnQ.length-1];if(MOD.geo[t]){G.spawnQ.pop();spawnE(t,{elite:!ET[t].boss&&t!=='elite'&&R()<(G.eliteChance||0)});G.spawnT=ET[t].boss?2:rr(.45,.9)}else{G.spawnQ.unshift(G.spawnQ.pop());G.spawnT=.3}}
if(!G.waveClear&&!G.spawnQ.length&&!EN.length&&!G.boss){G.waveClear=1;const bonus=100*G.wave;G.score+=bonus;P.hp=Math.min(P.mhp,P.hp+P.mhp*.15);play('lvl');evtEnd();
let bi=0,bd=-1;W.doors.forEach((d,i)=>{const dd=Math.hypot(d.x-P.pos.x,d.z-P.pos.z);if(i!==G.entry&&dd>bd){bd=dd;bi=i}});G.exit=bi;P.mag2=Math.max(P.mag2,3);G.nextRP=rollRP((G.wave+1)%5===0);if(G.wave>=50&&!G.endless&&!G.xtAsked){G.xtAsked=1;setTimeout(xtOffer,1800)}if(NET.host){NRN().ev({k:'clear',ex:bi,rp:G.nextRP,b:bonus});NET.ready={};NET.readyT=0}
setTimeout(()=>{if(G.exit>=0)play('door')},700);banner('ROOM CLEARED','+'+bonus+' BONUS · EXIT OPEN — '+W.doors[bi].name,3)}
if(G.exit>=0&&!P.dead){const d=W.doors[G.exit];if(Math.hypot(P.pos.x-d.x,P.pos.z-d.z)<2.6)enterTransit()}}
function enterTransit(){const d=W.doors[G.exit];G.mode='transit';G.tf=0;G.shopOn=0;G.noPause=1;mdown=0;P.ads=0;play('door');G.exitDir=new THREE.Vector3(Math.sign(d.x)*(Math.abs(d.x)>1?1:0),0,Math.sign(d.z)*(Math.abs(d.z)>1?1:0));document.exitPointerLock&&document.exitPointerLock()}
function buildRoom(){const boss=(G.wave+1)%5===0;EB.forEach(b=>freeSprite(b.s));EB.length=0;PR.forEach(q=>{freeSprite(q.s);q.core&&freeSprite(q.core);q.m&&scene.remove(q.m)});PR.length=0;clrT();WAVES.forEach(w=>w.m.visible=false);WAVES.length=0;laserFX(null);
for(const c of COINS)addGold(c.val);COINS.length=0;if(GEMS.length){const n=GEMS.length;GEMS.length=0;P.xp+=n*P.xpMul}PUS.forEach(u=>{freeSprite(u.s);freeSprite(u.gl)});PUS.length=0;FX.decals.forEach(m=>m.visible=false);PA.clear();PS.clear();
const rp=G.nextRP||rollRP(boss);G.nextRP=null;applyRP(rp);if(NET.host)NRN().setMeta({rp,w:G.wave});const ex=G.exit;G.exit=-1;const en=(ex+2)%4,d=W.doors[en];G.entry=en;W.doors.forEach(q=>{q.open=0;q.t=0});d.t=1;d.open=1.2;
const ix=-Math.sign(d.x)*(Math.abs(d.x)>1?1:0),iz=-Math.sign(d.z)*(Math.abs(d.z)>1?1:0),sl=netSlot();P.pos.set(d.x+ix*3-iz*sl*1.7,0,d.z+iz*3+ix*sl*1.7);P.vel.set(0,0,0);P.yaw=Math.atan2(-ix,-iz);P.pitch=0;G.rooms++;G.nextBoss=!!rp.boss}
function leaveTransit(){if(G.mode!=='transit')return;if(NET.on&&!NET.goNow){if(!NET.iReady){NET.iReady=true;play('click');if(NET.client)NRN().cev({k:'rdy'});else NET.ready[NRN().me]=1}shopTeam();if(NET.host)netCheckGo();return}$('shop').classList.add('hide');$('hud').classList.remove('hide');$('touch')&&$('touch').classList.remove('hide');G.shopOn=0;G.mode='play';G.noPause=0;G.waveClear=0;G.breather=G.nextBoss?2.6:2.2;G.spawnQ=[];
banner(G.nextBoss?'⚠ BOSS VAULT':W.L.name,G.nextBoss?'A GREAT ENEMY STIRS':'ROOM '+G.rooms+' · WAVE '+(G.wave+1),2.4);play(G.nextBoss?'roar':'door');lockPointer()}
// ---------- arena events ----------
function evtStart(name){if(G.boss)return;G.evt=name||pick(['VOID STORM','OVERCHARGE','SWARM','BLACKOUT','CORE MELTDOWN']);if(NET.host)NRN().ev({k:'evt',n:G.evt});G.evtT=0;const sub={'VOID STORM':'Rift lightning strikes the arena','OVERCHARGE':'Energy surges — your damage +50%','SWARM':'A horde pours through the rift','BLACKOUT':'Main power lost','CORE MELTDOWN':'The reactor is going critical'}[G.evt];banner('⚠ '+G.evt,sub,2.6);play('warn');
if(G.evt==='OVERCHARGE')G.ovc=1.5;if(G.evt==='SWARM')for(let i=0;i<12;i++)G.spawnQ.push(i%3?'crawler':'drone');
if(G.evt==='BLACKOUT'){hemi.intensity=.06;sun.intensity=.15;W.stripMatA.color.multiplyScalar(.05);W.stripMatB.color.multiplyScalar(.05);W.gens.forEach(g=>g.light.color.set(0xff1a1a));flashL.intensity=2.4}
if(G.evt==='CORE MELTDOWN'){scene.fog.color.set(0x220606);W.coreLight.color.set(0xff3010);W.coreMat.color.set(0xff3010).multiplyScalar(6)}}
function evtEnd(){if(!G.evt)return;if(NET.host)NRN().ev({k:'evtEnd'});G.evt='';G.ovc=1;hemi.intensity=.75;sun.intensity=1.25;flashL.intensity=1.3;setTheme(W.theme);W.coreLight.color.set(W.L.reactor?0xff2a8a:W.L.core.c);W.coreMat.color.set(0xff2a8a).multiplyScalar(5)}
function updEvt(dt){if(!G.evt||NET.client)return;G.evtT-=dt;if(G.evtT>0)return;
if(G.evt==='VOID STORM'){G.evtT=1.3;const x=clamp(P.pos.x+rr(-7,7),-A+2,A-2),z=clamp(P.pos.z+rr(-7,7),-A+2,A-2);tel(x,z,2.7,1.15,15,'storm',()=>{tracer(_v.set(x,HT,z),_v2.set(x,0,z),0xb070ff,.6,.2);flash(_v2,0xb070ff,6,12,.2)},0x9a5aff)}
else if(G.evt==='CORE MELTDOWN'){G.evtT=3.2;const a=R()*TAU,r=rr(6,14);tel(Math.cos(a)*r,Math.sin(a)*r,3.5,1.4,20,'melt',null,0xff3010);if(R()<.3)G.spawnQ.push('crawler')}
else if(G.evt==='OVERCHARGE'){G.evtT=.1;const k=3+Math.sin(G.time*8)*1.5;W.stripMatA.color.set(THEMES[W.theme].a).multiplyScalar(k*1.5)}else G.evtT=1}
// ---------- leveling ----------
const UPS=[{n:'+20% Damage',d:'Every weapon hits harder',f:()=>P.dm*=1.2,r:0},{n:'+15% Fire Rate',d:'Faster trigger cycling',f:()=>P.rm*=1.15,r:0},{n:'+25% Move Speed',d:'Outrun anything',f:()=>P.sm*=1.25,r:1},
{n:'+20% Max Health',d:'Heals the bonus amount',f:()=>{P.mhp=Math.round(P.mhp*1.2);P.hp=Math.min(P.mhp,P.hp+P.mhp*.2)},r:0},{n:'+25% Shield',d:'Stronger energy shield',f:()=>{P.msh*=1.25;P.sh=P.msh},r:0},
{n:'+10% Critical Chance',d:'Crits deal double damage',f:()=>P.crit+=.1,r:1},{n:'+1 Projectile',d:'Extra pellets, rays and rockets',f:()=>P.proj++,r:2},{n:'+30% XP Gain',d:'Level up faster',f:()=>P.xpMul*=1.3,r:0},
{n:'+20% Reload Speed',d:'Swap mags in a blink',f:()=>P.rls*=1.2,r:0},{n:'+1 Dash Charge',d:'Chain dashes together',f:()=>{P.dashMax++;P.dashC++},r:2},{n:'Vampiric Rounds',d:'Heal 3 HP on every kill',f:()=>P.vamp+=3,r:1},
{n:'+30% Magazine',d:'More shots before reloading',f:()=>{P.mag*=1.3},r:0}];
function levelUp(){FACE.react('grin');G.mode='levelup';G.noPause=1;document.exitPointerLock&&document.exitPointerLock();P.lvl++;P.xp-=P.need;P.need=Math.round(P.need*1.35+3);play('lvl');mdown=0;
const opts=UPS.slice().sort(()=>R()-.5).slice(0,3);showLevelUp(opts)}
function pickUp(o){o.f();(G.picks=G.picks||[]).push(UPS.indexOf(o));G.mode='play';hideLevelUp();lockPointer();if(P.xp>=P.need)setTimeout(()=>{if(G.mode==='play')levelUp()},300)}
function die(){if(P.dead)return;if(NET.on&&!NET.final){P.dead=1;P.hp=0;NET.downed=true;mdown=0;P.ads=0;banner('YOU ARE DOWN','A TEAMMATE CAN REVIVE YOU — OR YOU REDEPLOY NEXT ROOM',4);play('roar');if(NET.host)netAllDeadCheck();return}P.dead=1;G.mode='dead';G.noPause=1;mdown=0;const t=Math.round((performance.now()-G.t0)/1000),cores=Math.floor(G.score/120)+G.wave*3+G.bosses*15;
save.cores+=cores;save.best=Math.max(save.best,G.score);save.bestWave=Math.max(save.bestWave,G.wave);save.bestCombo=Math.max(save.bestCombo,G.bestCombo);save.runs++;store();play('roar');
G.deathT=0;G.death={t,cores};setTimeout(()=>{document.exitPointerLock&&document.exitPointerLock();showDeath(G.death)},1600)}

// ================= HUD =================
const H={};const hc={};
function hudInit(){['hud','gold','goldN','wp','wpD','scope','score','kills','combo','cmbN','cmbM','cmbT','waveN','waveS','boss','bossN','bossH','bossP','bossS','bossPh','feed','pus','shN','shB','hpN','hpB','hpG','dashP','wName','ammo','magN','rlB','slots','lvl','xpB','banner','banT','banS','xh','hm','dd','nums','chg','evtTag'].forEach(id=>H[id]=$(id));H.lock=$('lockHint');H.face=$('face');FACE.init($('faceC'));
H.slots.innerHTML=WEP.map((w,i)=>`<div class="slot" data-i="${i}"><svg viewBox="0 0 64 24">${ICON[i]}</svg><span>${i+1}</span><em></em></div>`).join('');
H.slots.querySelectorAll('.slot').forEach(s=>s.addEventListener('click',()=>switchW(+s.dataset.i)));
H.num=[];for(let i=0;i<28;i++){const d=document.createElement('div');d.className='dnum';H.nums.appendChild(d);H.num.push({d,t:0,x:0,y:0,p:new THREE.Vector3()})}
H.dirs=[];for(let i=0;i<6;i++){const d=document.createElement('div');d.className='ddir';H.dd.appendChild(d);H.dirs.push({d,t:0,a:0})}}
const ICON=['<path d="M2 9h40l4-3h8v4h8v3H44l-6 3v6h-5l-1-5H22l-2 4h-5l1-6H2z"/>','<path d="M2 8h46v3h12v3H48v2H30l-4 6h-6l3-6H8l-2 3H2z"/>','<path d="M2 7h60v2H40v2h22v2H40v2H24l-3 6h-6l2-6H2z"/>','<path d="M4 5h48l6 3v7l-6 3H40v4h-6v-4H22l-2 5h-6l2-5H4z"/>','<path d="M2 12c4-8 18-10 28-8l10-3 4 4 18 2-18 4-6 3 4 5h-6l-4-4c-6 3-20 3-30-3z"/>'];
const set=(k,el,v,f)=>{if(hc[k]!==v){hc[k]=v;f?f(el,v):el.textContent=v}};
const pct=(el,v)=>el.style.width=(v*100).toFixed(1)+'%';
function hudUpdate(dt){const w=WEP[P.cw];
set('score',H.score,G.score.toLocaleString());set('kills',H.kills,G.kills);
const cm=G.combo>1;H.combo.classList.toggle('on',cm);if(cm){set('cmb',H.cmbN,'x'+G.combo);set('cmm',H.cmbM,mult().toFixed(1)+'× SCORE');pct(H.cmbT,G.comboT/3.2);H.combo.classList.toggle('hot',G.combo>=25)}
set('wave',H.waveN,String(G.wave).padStart(2,'0'));const left=G.spawnQ.length+EN.length;set('wl',H.waveS,G.boss?'BOSS ENGAGED':G.exit>=0?'ROOM CLEAR — REACH THE EXIT':G.breather>0?'NEXT WAVE '+Math.ceil(G.breather):left+' HOSTILES');
set('evt',H.evtTag,G.evt?'⚠ '+G.evt:'');const lk=G.mode==='play'&&!isTouch&&!document.pointerLockElement;H.lock.classList.toggle('on',lk&&!G.freeAim);
set('sh',H.shN,Math.ceil(P.sh));pct(H.shB,P.sh/P.msh);set('hp',H.hpN,Math.ceil(P.hp));pct(H.hpB,P.hp/P.mhp);H.hpG.style.width=(parseFloat(H.hpG.style.width||'100')>P.hp/P.mhp*100?Math.max(P.hp/P.mhp*100,parseFloat(H.hpG.style.width||'100')-dt*25):P.hp/P.mhp*100)+'%';
H.hud.classList.toggle('low',P.hp<P.mhp*.3);H.hud.classList.toggle('shbroke',P.sh<1);
set('dash',H.dashP,P.dashC+'/'+P.dashMax+'|'+(P.dashC<P.dashMax?Math.floor(P.dashT/1.6*10):10),(el)=>{let s='';for(let i=0;i<P.dashMax;i++)s+=`<i class="${i<P.dashC?'on':''}" style="--f:${i===P.dashC?P.dashT/1.6:i<P.dashC?1:0}"></i>`;el.innerHTML=s});
set('wn',H.wName,w.n);const mag=Math.round(w.mag*P.mag);set('am',H.ammo,P.rl>0?'--':P.ammo[P.cw]);set('mg',H.magN,'/ '+mag);H.ammo.classList.toggle('lowa',P.ammo[P.cw]<=Math.ceil(mag*.25)&&P.rl<=0);
pct(H.rlB,P.rl>0?1-P.rl/P.rlt:w.charge&&P.charge>0?P.charge/w.charge:P.ammo[P.cw]/mag);H.rlB.parentNode.classList.toggle('reloading',P.rl>0);
set('slot',H.slots,P.cw,(el,v)=>el.querySelectorAll('.slot').forEach((s,i)=>s.classList.toggle('on',i===v)));
set('own',H.slots,P.own.join(''),(el)=>el.querySelectorAll('.slot').forEach((s,i)=>{s.classList.toggle('lock',!P.own[i]);s.querySelector('em').textContent=P.own[i]?'':'◉'+PRICE[i]}));
set('gold',H.goldN,G.gold.toLocaleString());G.goldPop=Math.max(0,(G.goldPop||0)-dt);H.gold.classList.toggle('pop',G.goldPop>0);
const sk=clamp((P.adsK-.45)*4,0,1);H.scope.style.opacity=sk.toFixed(2);H.xh.style.opacity=(1-clamp(P.adsK*2.5,0,1)).toFixed(2);
if(G.exit>=0&&G.mode==='play'){const d=W.doors[G.exit];_v.set(d.x,3.2,d.z).project(cam);let x=_v.x,y=_v.y;const beh=_v.z>1;if(beh){x=-x;y=-y}const m=Math.max(Math.abs(x),Math.abs(y));if(beh||m>.9){x=x/m*.9;y=y/m*.9}y=clamp(y,-.42,.82);x=clamp(x,-.9,.9);
H.wp.style.display='block';H.wp.style.transform=`translate(${(x*.5+.5)*innerWidth}px,${(-y*.5+.5)*innerHeight}px) translate(-50%,-50%)`;set('wpd',H.wpD,Math.round(Math.hypot(P.pos.x-d.x,P.pos.z-d.z))+'m')}else H.wp.style.display='none';
faceUpd(dt);set('lv',H.lvl,'LV '+P.lvl);pct(H.xpB,clamp(P.xp/P.need,0,1));
let pu='';for(let i=0;i<6;i++)if(P.pu[i]>0)pu+=`<div class="pu" style="--c:#${new THREE.Color(PUT[i][1]).getHexString()}"><b>${PUT[i][0]}</b><i><u style="width:${P.pu[i]/10*100}%"></u></i></div>`;set('pu',H.pus,pu,(el,v)=>el.innerHTML=v);
// crosshair
const spread=8+(w.sp*260)+P.rec*240+(P.moving?6:0)+(P.onG?0:8);H.xh.style.setProperty('--s',spread.toFixed(1)+'px');set('xc',H.xh,w.pel>1?'sg':w.charge?'rg':'',(el,v)=>el.className=v);
H.chg.style.setProperty('--c',w.charge?(P.charge/w.charge).toFixed(3):0);
if(G.boss){const b=G.boss;pct(H.bossH,Math.max(0,b.hp/b.mhp));H.boss.classList.toggle('stag',b.st==='rec');set('bs',H.bossS,b.intro>0?'':b.st==='wind'?'ATTACK INCOMING':b.st==='rec'?'RECOVERING — OPEN TO DAMAGE':'',null);set('bph',H.bossPh,b.ph2,(el,v)=>el.innerHTML='<i class="on"></i>'+(v>=2?'<i class="on"></i>':'<i></i>')+(v>=3?'<i class="on"></i>':'<i></i>'))}
// floating numbers
for(const n of H.num){if(n.t<=0)continue;n.t-=dt;_v.copy(n.p);_v.y+=(1-n.t)*.8;_v.project(cam);if(_v.z>1||n.t<=0){n.d.style.opacity=0;continue}n.d.style.transform=`translate(${(_v.x*.5+.5)*innerWidth}px,${(-_v.y*.5+.5)*innerHeight}px) translate(-50%,-50%) scale(${.8+Math.min(.5,n.t)})`;n.d.style.opacity=Math.min(1,n.t*2.5)}
for(const d of H.dirs){if(d.t<=0)continue;d.t-=dt;const rel=d.a-(P.yaw+Math.PI);d.d.style.transform=`translate(-50%,-50%) rotate(${-rel}rad)`;d.d.style.opacity=Math.min(1,d.t*1.5)}
if(G.banT>0){G.banT-=dt;if(G.banT<=0)H.banner.classList.remove('show')}}
function bannerAll(t,s,d){banner(t,s,d);if(NET.host)NRN().ev({k:'ban',t,s,d})}
function banner(t,s,d){if(!H.banner)return;if(t)H.banT.textContent=t;else H.banT.textContent='';H.banS.textContent=s||'';H.banner.style.setProperty('--d',(d||2)+'s');H.banner.classList.remove('show');void H.banner.offsetWidth;H.banner.classList.add('show');H.banner.classList.toggle('sub',!t);G.banT=d||2}
let numI=0;function dmgNum(p,d,crit){const n=H.num[numI++%H.num.length];n.p.copy(p);n.t=1;n.d.textContent=Math.round(d);n.d.className='dnum'+(crit?' crit':'')+(d>=100?' big':'')}
let hmT=null;function hitMark(crit,kill){H.hm.className='';void H.hm.offsetWidth;H.hm.className='on'+(crit?' crit':'')+(kill?' kill':'');if(kill)play('kill')}
function faceUpd(dt){const tier=FACE.update(dt,{hp:P.hp,mhp:P.mhp,firing:mdown&&G.mode==='play'&&P.rl<=0,god:P.shieldPU>0,dead:P.dead});if(tier!==undefined)H.face.className='pnl t'+tier+(P.shieldPU>0?' god':'')}
function dmgDir(a){const rel=a-(P.yaw+Math.PI),sd=Math.sin(-rel);if(Math.abs(sd)>.35)FACE.react('look',sd>0?1:-1);const d=H.dirs.find(x=>x.t<=0)||H.dirs[0];d.a=a;d.t=1.2}
const NAMES={drone:'RIFT DRONE',soldier:'RIFT TROOPER',assassin:'ASSASSIN',crawler:'VOID CRAWLER',brute:'BRUTE',tank:'TANK',elite:'ELITE',titan:'RIFT TITAN',warden:'VOID WARDEN',core:'THE CORE'};
function feed(type,val,elite,col){const d=document.createElement('div');d.className='kf';d.innerHTML=type?`<span>${elite?'<em>ELITE</em> ':''}${NAMES[type]}</span><b>+${val}</b>`:`<b style="color:${col||'#fff'}">${val}</b>`;H.feed.prepend(d);while(H.feed.children.length>6)H.feed.lastChild.remove();setTimeout(()=>d.classList.add('out'),2200);setTimeout(()=>d.remove(),2700)}
function hudBoss(e){if(!H.boss)return;H.boss.classList.toggle('hide',!e);if(e){H.bossN.textContent=ET[e.type].boss;hc.bph=null}}

// ================= HUD FACE (original pixel-art marine; reacts like a classic status-bar face) =================
const FACE=(()=>{const W=40,H=48;
const C={o:'#140b07',sk:'#c98a60',skL:'#e2a87c',skS:'#9c623f',skD:'#6d3f27',st:'#7d5137',hm:'#3b4352',hmL:'#5a6578',hmD:'#20262f',hmE:'#141922',vis:'#46e6ff',visD:'#1a8fa6',ew:'#efe6dc',ir:'#3d6f9e',pu:'#0d1116',br:'#3a2216',lip:'#7a3424',lipD:'#4a1a12',th:'#f2efe6',bl:'#b3121a',blD:'#6e0a0e',blL:'#e0342c',bru:'#6a4a72',sw:'#b9707e',gold:'#ffd85a',col:'#2c333f',colL:'#4a5566'};
function draw(ctx,tier,expr,look,blink,t){const img=ctx.createImageData(W,H),d=img.data;let pale=tier>=3?.18+(tier-3)*.12:0;if(expr==='dead')pale=.45;
const hex={};const rgb=c=>hex[c]||(hex[c]=[parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]);
const px=(x,y,c,skin)=>{x|=0;y|=0;if(x<0||y<0||x>=W||y>=H)return;let[r,g,b]=rgb(c);if(skin&&pale){const l=(r+g+b)/3;r=r+(l*1.05-r)*pale;g=g+(l*1.02-g)*pale;b=b+(l*1.08-b)*pale}const i=(y*W+x)*4;d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255};
const rect=(x,y,w,h,c,s)=>{for(let j=0;j<h;j++)for(let i=0;i<w;i++)px(x+i,y+j,c,s)};
const ell=(cx,cy,rx,ry,f)=>{for(let y=Math.floor(cy-ry);y<=cy+ry;y++)for(let x=Math.floor(cx-rx);x<=cx+rx;x++){const u=(x+.5-cx)/rx,v=(y+.5-cy)/ry;if(u*u+v*v<=1)f(x,y,u,v)}};
const lx=look;// -1 left, 0 center, 1 right (screen)
// neck + armored collar
rect(14,40,12,6,C.skS,1);for(let x=6;x<34;x++){const k=Math.abs(x-20);rect(x,44+(k>10?-1:0),1,4,k<4?C.colL:C.col)}rect(6,43,28,1,C.o);
// face
ell(20+lx*.6,28,12.5,15.5,(x,y,u,v)=>{const sh=u+lx*.25;let c=sh<-.45?C.skL:sh>.55?C.skS:C.sk;if(v>.72&&Math.abs(u)<.6)c=C.skS;if(sh>.8||v>.93)c=C.skD;px(x,y,c,1)});
ell(20+lx*.6,28,13.2,16.2,(x,y,u,v)=>{if(u*u+v*v>.86){const i=(y*W+x)*4;if(d[i+3]===0)px(x,y,C.o)}});
// stubble on jaw
for(let y=33;y<43;y++)for(let x=9;x<32;x++){const i=(y*W+x)*4;if(d[i+3]&&((x+y)%2===0)&&!(y<36&&Math.abs(x-20-lx)<4)){const u=(x-20)/12,v=(y-28)/15;if(u*u+v*v<.95&&v>.3)px(x,y,C.st,1)}}
// ears under helmet guards
// helmet dome + guards
ell(20,15,15,11.5,(x,y,u,v)=>{if(y>17+Math.abs(u)*3)return;const sh=u+lx*.2;px(x,y,sh<-.5?C.hmL:sh>.55?C.hmD:C.hm)});
for(const s of[-1,1]){const gx=s<0?5:31;for(let y=14;y<30;y++)for(let i=0;i<4;i++){const x=gx+i;px(x,y,i===(s<0?0:3)?C.hmE:s<0?C.hmL:C.hmD)}rect(gx,30,4,1,C.hmE)}
for(let x=6;x<35;x++){const u=(x-20)/15;const y=Math.round(17+Math.abs(u)*3);px(x,y,C.hmE);px(x,y-1,C.hmD)}
rect(12+lx,10,16,2,C.visD);rect(13+lx,10,14,1,C.vis);px(11+lx,11,C.hmE);px(28+lx,11,C.hmE);
for(let x=9;x<32;x+=4)px(x,6+Math.abs(x-20)/5,C.hmL);
// brows
const angry=expr==='pain'||expr==='rampage'||expr==='ouch',sad=tier>=3&&expr==='idle';
for(const s of[-1,1]){const bx=s<0?11:23;for(let i=0;i<7;i++){const yy=19+(angry?(s<0?i*.35-1:(6-i)*.35-1):sad?(s<0?(6-i)*.25:i*.25):0);px(bx+i+lx,yy,C.br,0);px(bx+i+lx,yy+1,C.skS,1)}}
// eyes
const eyeY=22;for(const s of[-1,1]){const ex=(s<0?12:23)+lx;const swollen=(s<0&&tier>=3)||(tier>=4&&s>0&&expr!=='god');
if(expr==='dead'){for(let i=0;i<5;i++){px(ex+i,eyeY+(i%2),C.o)}continue}
const closed=blink||expr==='pain'||swollen&&tier>=4;
if(closed){rect(ex,eyeY+1,6,1,C.o);rect(ex,eyeY,6,1,C.skS,1);if(swollen){rect(ex-1,eyeY-1,8,2,C.sw,1);rect(ex,eyeY+2,6,1,C.bru,1)}continue}
const open=swollen?1:expr==='ouch'?3:2;rect(ex,eyeY,6,open,C.ew);rect(ex,eyeY-1,6,1,C.o);if(open<3)rect(ex,eyeY+open,6,1,C.skS,1);
if(swollen){rect(ex-1,eyeY-2,8,2,C.sw,1);rect(ex,eyeY+open,6,2,C.bru,1)}
const pxp=ex+2+look+(expr==='ouch'?0:0);if(expr==='god'){rect(ex+1,eyeY,4,open,C.gold)}else{rect(pxp,eyeY,2,open,C.ir);px(pxp+(look>0?1:0),eyeY,C.pu);if(open>1)px(pxp+(look>0?1:0),eyeY+1,C.pu)}}
// nose
const nx=19+lx*1.4;for(let y=23;y<31;y++){px(nx+2,y,C.skS,1);if(y>26)px(nx+3,y,C.skD,1)}px(nx-1,30,C.skS,1);px(nx,31,C.skD,1);px(nx+3,31,C.skD,1);px(nx+1,30,C.skL,1);
// mouth
const mx=15+Math.round(lx*1.2),my=35;
if(expr==='grin'||expr==='god'){rect(mx,my,11,3,C.lipD);rect(mx+1,my,9,2,C.th);for(let i=1;i<10;i+=2)px(mx+i,my+1,'#cfcabd');px(mx-1,my-1,C.lipD);px(mx+11,my-1,C.lipD);rect(mx+1,my+3,9,1,C.lip,1)}
else if(expr==='pain'||expr==='rampage'){rect(mx,my-1,11,4,C.lipD);rect(mx+1,my,9,2,C.th);for(let i=2;i<10;i+=2){px(mx+i,my,C.lipD);px(mx+i,my+1,C.lipD)}rect(mx+1,my+3,9,1,C.lip,1)}
else if(expr==='ouch'){ell(mx+5.5,my+1.5,3,2.6,(x,y,u,v)=>px(x,y,u*u+v*v>.55?C.lipD:'#2a0a08'));}
else if(expr==='dead'){ell(mx+5.5,my+1.5,3.4,2.2,(x,y)=>px(x,y,'#1c0806'));rect(mx+2,my+3,7,1,C.lip,1)}
else{rect(mx+1,my,9,1,C.lipD);rect(mx+2,my+1,7,1,C.lip,1);px(mx,my+(tier>=3?1:0),C.lipD);px(mx+10,my+(tier>=3?1:0),C.lipD)}
// scar (character detail)
px(26+lx,26,C.skD,1);px(27+lx,27,C.skD,1);px(27+lx,28,C.skD,1);
// injuries by tier
const B=(x,y,c)=>px(x+lx,y,c||C.bl);
if(tier>=1){B(25,18);B(25,19);B(26,20,C.blD);rect(12+lx,25,4,1,C.bru,1)}
if(tier>=2){for(let y=32;y<35;y++)B(nx+1-lx+(y>33?-1:0),y);B(nx-lx,34,C.blD);B(10,29);B(11,30);B(11,31,C.blD);px(30,24,'#cfe4f0');px(30,25,'#cfe4f0')}
if(tier>=3){for(let y=20;y<34;y++)if(y%3)B(28-(y>27?1:0),y,y%5?C.bl:C.blD);B(mx+3-lx,my+2);B(mx+4-lx,my+3,C.blD);rect(9+lx,32,3,2,C.bl);B(16,18,C.blL);B(17,18)}
if(tier>=4||expr==='dead'){for(let x=10;x<31;x++)if((x*7)%5<3)B(x,18+((x*3)%3),x%3?C.bl:C.blD);for(let y=26;y<40;y++)if(y%2)B(10+(y%3),y);rect(21+lx,38,3,4,C.blD);B(14,40);B(26,41,C.blD)}
ctx.putImageData(img,0,0)}
// ---- state machine ----
const S={cv:null,ctx:null,look:0,lookT:0,expr:'idle',exprT:0,blinkT:2,blink:0,fireT:0,key:'',hpPrev:100};
function init(cv){S.cv=cv;S.ctx=cv.getContext('2d');cv.width=W;cv.height=H}
function tierOf(hp,mhp){const f=hp/mhp;return f>.8?0:f>.6?1:f>.4?2:f>.2?3:4}
function react(kind,dir){if(kind==='hurt'){S.expr=dir>.5?'ouch':'pain';S.exprT=dir>.5?.7:.4}else if(kind==='grin'){S.expr='grin';S.exprT=1.4}else if(kind==='look'){S.look=dir;S.lookT=1.1}}
function update(dt,st){if(!S.ctx)return;S.lookT-=dt;S.exprT-=dt;S.blinkT-=dt;
if(S.lookT<=0){S.look=R()<.5?0:R()<.5?-1:1;S.lookT=rr(.8,1.8)}if(S.blinkT<=0){S.blink=S.blink?0:1;S.blinkT=S.blink?.12:rr(2,4.5)}
if(st.firing)S.fireT+=dt;else S.fireT=0;let expr=S.exprT>0?S.expr:'idle';if(expr==='idle'&&S.fireT>1.2)expr='rampage';if(st.god)expr='god';if(st.dead)expr='dead';
const tier=st.dead?4:tierOf(st.hp,st.mhp),key=tier+expr+S.look+(S.blink&&expr!=='dead'?1:0);if(key===S.key)return;S.key=key;draw(S.ctx,tier,expr,expr==='dead'?0:S.look,S.blink&&expr!=='dead'&&expr!=='god',0);return tier}
return{init,update,react,draw,tierOf,W,H}})();

// ================= MENUS / INPUT =================
// touch-only = phones/tablets. Hybrid laptops & PCs with touch/pen drivers still use mouse + pointer lock.
const isTouch=!!(window.matchMedia&&matchMedia('(hover: none) and (pointer: coarse)').matches);
let lockErr=0,lastFail=0;
function onLockFail(){const n=performance.now();if(n-lastFail<400)return;lastFail=n;lockErr++;if(lockErr>=2&&!G.freeAim){G.freeAim=1;banner('','MOUSE LOCK BLOCKED — AIMING WITHOUT LOCK',3)}}
const SCR=['menu','upg','rec','set','pause','lvlup','dead','shop','online','xt'];
function show(id){SCR.forEach(s=>$(s).classList.toggle('hide',s!==id));if(id==='menu')menuStats()}
function lockPointer(){if(isTouch||document.pointerLockElement===ren.domElement)return;try{const r=ren.domElement.requestPointerLock&&ren.domElement.requestPointerLock();if(r&&r.catch)r.catch(onLockFail)}catch(e){onLockFail()}}
function startGame(){lockPointer();audioInit();if(AU.ctx&&AU.ctx.state==='suspended')AU.ctx.resume();newRun();G.mode='play';G.noPause=0;show(null);$('hud').classList.remove('hide');$('touch')&&$('touch').classList.remove('hide');play('click')}
function pauseGame(){if(G.mode!=='play')return;G.mode='pause';mdown=0;show('pause')}
function resume(){G.mode='play';G.noPause=0;show(null);lockPointer()}
function toMenu(){if(NET.on)netLeave();clearPings();if(G.boss)bossEnd(G.boss);evtEnd();for(const e of EN.slice())freeE(e);clrT();laserFX(null);G.boss=null;G.mode='menu';$('hud').classList.add('hide');$('touch')&&$('touch').classList.add('hide');show('menu');document.exitPointerLock&&document.exitPointerLock()}
function menuStats(){resumeBtn();$('coreN').textContent=save.cores.toLocaleString()}
function showLevelUp(opts){$('lvlN').textContent='LEVEL '+P.lvl;const c=$('cards');c.innerHTML='';const rn=['COMMON','RARE','EPIC'];
opts.forEach((o,i)=>{const b=document.createElement('button');b.className='card r'+o.r;b.innerHTML=`<em>${rn[o.r]}</em><b>${o.n}</b><span>${o.d}</span><kbd>${i+1}</kbd>`;b.onclick=()=>pickUp(o);c.appendChild(b)});G.lvOpts=opts;show('lvlup')}
function hideLevelUp(){show(null)}
const SUP=[{id:'med',n:'Field Medkit',d:'Restore 50% health and full shield',c:()=>30+G.medN*15,f:()=>{P.hp=Math.min(P.mhp,P.hp+P.mhp*.5);P.sh=P.msh;G.medN++}},
{id:'tune',n:'Weapon Tuning',d:'+10% damage for every gun this run',c:()=>80+G.tuneN*60,f:()=>{P.dm*=1.1;G.tuneN++}}];
function openShop(){const nb=G.nextBoss;$('shopNext').innerHTML=nb?'<em class="red">⚠ NEXT: BOSS VAULT</em> — '+ET[['titan','warden','core'][((G.wave+1)/5-1)%3]].boss:'NEXT: '+W.L.name+' · WAVE '+(G.wave+1);shopUI();show('shop');$('hud').classList.add('hide');$('touch')&&$('touch').classList.add('hide')}
function shopUI(){$('shopGold').textContent=G.gold.toLocaleString();
$('shopGuns').innerHTML=WEP.map((w,i)=>{const own=P.own[i],c=PRICE[i];return`<button class="gun${own?' own':G.gold<c?' poor':''}" data-i="${i}"><svg viewBox="0 0 64 24">${ICON[i]}</svg><b>${w.n}</b><span>${w.sub}</span><div class="st"><i>DMG ${w.dmg}${w.pel>1?'×'+w.pel:''}</i><i>MAG ${w.mag}</i></div><em>${own?'OWNED':'◉ '+c}</em></button>`}).join('')+
SUP.map(u=>`<button class="gun sup${G.gold<u.c()?' poor':''}" data-s="${u.id}"><b>${u.n}</b><span>${u.d}</span><em>◉ ${u.c()}</em></button>`).join('');
$('shopGuns').querySelectorAll('.gun').forEach(b=>b.onclick=()=>{if(b.dataset.s){const u=SUP.find(x=>x.id===b.dataset.s),c=u.c();if(G.gold>=c){G.gold-=c;u.f();play('buy')}else play('empty');shopUI();return}
const i=+b.dataset.i;if(P.own[i])return;if(G.gold>=PRICE[i]){G.gold-=PRICE[i];P.own[i]=1;P.ammo[i]=Math.round(WEP[i].mag*P.mag);P.last=P.cw;P.cw=i;VM.cur=-1;play('buy');FACE.react('grin')}else play('empty');shopUI()})}
function showDeath(d){lbDeath(d);$('bAgain').textContent=d.saved?'SPEND RIFT CORES':'PLAY AGAIN';$('deadSaved').classList.toggle('hide',!d.saved);$('dKick').textContent=d.win?'ESCAPE POD SECURED':'SIGNAL LOST';$('dTitle').textContent=d.win?'EXTRACTED':'YOU DIED';$('dead').classList.toggle('win',!!d.win);$('deadStats').innerHTML=[['SCORE',G.score.toLocaleString()],['WAVE',G.wave],['KILLS',G.kills],['ROOMS',G.rooms],['GOLD LOOTED','◉ '+G.goldTot],['BOSSES',G.bosses],['BEST COMBO','x'+G.bestCombo],['TIME',Math.floor(d.t/60)+':'+String(d.t%60).padStart(2,'0')]].map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
$('deadCores').innerHTML=`+${d.cores} <small>RIFT CORES</small>`+(d.win?`<div class="nb xtb">INCLUDES +${d.bonus} EXTRACTION BONUS</div>`:'')+(G.score>=save.best&&G.score>0?'<div class="nb">NEW BEST SCORE</div>':'');$('hud').classList.add('hide');$('touch')&&$('touch').classList.add('hide');show('dead')}
const UPG=[['hp','Vitality','+20 starting health'],['dmg','Firepower','+10% starting damage'],['spd','Mobility','+6% movement speed'],['xp','Insight','+10% XP gain'],['sh','Bulwark','+15% shield strength'],['dash','Momentum','+1 dash charge',3]];
function upgUI(){$('upCores').textContent=save.cores.toLocaleString();$('upList').innerHTML=UPG.map(([k,n,d,mx])=>{const l=save.up[k],max=mx||10,cost=Math.round(12*Math.pow(1.45,l));return`<button class="upc${l>=max?' max':save.cores<cost?' poor':''}" data-k="${k}"><b>${n}</b><span>${d}</span><div class="pips">${Array.from({length:max},(_,i)=>`<i class="${i<l?'on':''}"></i>`).join('')}</div><em>${l>=max?'MAXED':'◆ '+cost}</em></button>`}).join('');
$('upList').querySelectorAll('.upc').forEach(b=>b.onclick=()=>{const k=b.dataset.k,u=UPG.find(x=>x[0]===k),l=save.up[k],cost=Math.round(12*Math.pow(1.45,l));if(l<(u[3]||10)&&save.cores>=cost){save.cores-=cost;save.up[k]++;store();play('pickup');upgUI()}else play('empty')})}
function recUI(){lbLoad($('lbList'));$('recList').innerHTML=[['BEST SCORE',save.best.toLocaleString()],['HIGHEST WAVE',save.bestWave],['BEST COMBO','x'+save.bestCombo],['BOSSES FELLED',save.bossKills],['RUNS',save.runs],['EXTRACTIONS',save.extracts||0],['RIFT CORES',save.cores.toLocaleString()]].map(r=>`<div><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}
let setFrom='menu';
function setUI(){const s=save.set;for(const k of['master','music','sfx','sens','fov','bright']){const el=$('s_'+k);el.value=s[k];$('v_'+k).textContent=s[k]}$('s_q').value=s.qa!==false&&s.qa!==0?'a':String(s.q);$('qinfo').textContent=perfLabel();$('s_shake').checked=!!s.shake;$('s_mute').checked=!!s.mute}
function bindUI(){$('bPlay').onclick=()=>{if(!$('bPlay').disabled)startGame()};$('bResume50').onclick=()=>{if(!$('bPlay').disabled)resumeRun()};$('bUpg').onclick=()=>{upgUI();show('upg');play('click')};$('bRec').onclick=()=>{recUI();show('rec');play('click')};$('bSet').onclick=()=>{setFrom='menu';setUI();show('set');play('click')};
document.querySelectorAll('.back').forEach(b=>b.onclick=()=>{play('click');show(b.closest('#set')&&setFrom==='pause'?'pause':'menu')});
$('bResume').onclick=resume;$('lbSend').onclick=lbSend;$('xtPod').onclick=()=>xtChoose('pod');$('xtEnd').onclick=()=>xtChoose('endless');$('bGo').onclick=leaveTransit;$('bSet2').onclick=()=>{setFrom='pause';setUI();show('set')};$('bQuit').onclick=toMenu;$('bAgain').onclick=()=>{if(G.death&&G.death.saved&&!NET.on){play('click');upgUI();show('upg');return}if(NET.on&&NET.final){if(NET.host)netRestart()}else if(NET.wasOnline){NET.wasOnline=false;openOnline()}else startGame()};$('bMenu').onclick=toMenu;
for(const k of['master','music','sfx','sens','fov','bright'])$('s_'+k).oninput=e=>{save.set[k]=+e.target.value;$('v_'+k).textContent=save.set[k];if(k==='fov'){cam.fov=save.set.fov;cam.updateProjectionMatrix()}setVol();store()};
$('s_q').onchange=e=>{const v=e.target.value;if(v==='a')save.set.qa=1;else{save.set.qa=0;save.set.q=+v}perfInit(false);store();setupPost();$('qinfo').textContent=perfLabel();scene.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true)})};
$('s_shake').onchange=e=>{save.set.shake=e.target.checked?1:0;store()};$('s_mute').onchange=e=>{save.set.mute=e.target.checked?1:0;setVol();store()};
document.querySelectorAll('button').forEach(b=>b.addEventListener('mouseenter',()=>play('click')));
addEventListener('keydown',e=>{keys[e.code]=1;if(e.code==='Space'||e.code.startsWith('Arrow'))e.preventDefault();
if(G.mode==='levelup'&&/Digit[123]/.test(e.code)&&G.lvOpts){pickUp(G.lvOpts[+e.code.slice(5)-1]);return}
if(G.mode==='transit'&&G.shopOn&&(e.code==='Enter'||e.code==='KeyE')){leaveTransit();return}
if(G.mode!=='play')return;if(e.code==='Escape'&&!document.pointerLockElement){pauseGame();return}if(/Digit[1-5]/.test(e.code))switchW(+e.code.slice(5)-1);if(e.code==='KeyQ')switchW(P.last);if(e.code==='KeyR')reload();if(e.code==='KeyT'&&!e.repeat)wheelOpen();if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!e.repeat)tryDash();if(e.code==='KeyP')pauseGame()});
addEventListener('keyup',e=>{keys[e.code]=0;if(e.code==='KeyT')wheelClose()});
addEventListener('mousedown',e=>{if(e.button===1&&G.mode==='play'){e.preventDefault();doPing('smart')}if(e.button===0&&G.mode==='play'&&(document.pointerLockElement||isTouch||G.freeAim))mdown=1;if(e.button===2&&G.mode==='play')P.ads=1});addEventListener('mouseup',e=>{if(e.button===0)mdown=0;if(e.button===2)P.ads=0});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('wheel',e=>{if(G.mode==='play')cycleW(e.deltaY>0?1:-1)},{passive:true});
// Chrome sometimes reports one huge bogus movement while the pointer is locked (common on trackpads and right after locking),
// which snapped the view. Drop the first events after a lock and any single reading far bigger than recent movement.
const ML={skip:0,avg:6};
function lookDelta(e){let dx=e.movementX||0,dy=e.movementY||0;if(ML.skip>0){ML.skip--;return null}
const m=Math.hypot(dx,dy),lim=Math.max(140,ML.avg*7);if(m>lim||Math.abs(dx)>innerWidth*.35||Math.abs(dy)>innerHeight*.35)return null;
ML.avg+=(Math.min(m,60)-ML.avg)*.08;return[dx,dy]}
addEventListener('mousemove',e=>{if(G.mode==='play'&&(document.pointerLockElement||G.freeAim)){const d=lookDelta(e);if(!d)return;if(PW.open){PW.dx+=d[0];PW.dy+=d[1];wheelUI();return}const k=save.set.sens*.00055*(1-.55*P.adsK);P.yaw-=d[0]*k;P.pitch=clamp(P.pitch-d[1]*k,-1.5,1.5);VM.swayX+=clamp(d[0],-60,60)*.02;VM.swayY+=clamp(-d[1],-60,60)*.02}});
ren.domElement.addEventListener('mousedown',e=>{if(G.mode==='play'&&!document.pointerLockElement&&!isTouch){lockPointer();if(!G.freeAim)e.stopPropagation()}});
document.addEventListener('pointerlockerror',onLockFail);
document.addEventListener('pointerlockchange',()=>{ML.skip=2;if(document.pointerLockElement){G.noPause=0;lockErr=0}else if(G.mode==='play'&&!G.noPause&&!isTouch)pauseGame()});
addEventListener('blur',()=>{for(const k in keys)keys[k]=0;mdown=0;P.ads=0;if(G.mode==='play'&&!isTouch)pauseGame()});
addEventListener('resize',()=>setupPost());
if(isTouch)touchUI();else addEventListener('touchstart',()=>{if(!$('touch')){touchUI();if(G.mode==='play')$('touch').classList.remove('hide')}},{once:true,passive:true})}
function touchUI(){const t=document.createElement('div');t.id='touch';t.className='hide';document.body.appendChild(t);
const btn=(txt,cls,down,up)=>{const b=document.createElement('div');b.className='tb '+cls;b.textContent=txt;b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();down()},{passive:false});b.addEventListener('touchend',e=>{e.preventDefault();e.stopPropagation();up&&up()},{passive:false});t.appendChild(b)};
btn('FIRE','fire',()=>mdown=1,()=>mdown=0);btn('JUMP','jump',()=>keys.Space=1,()=>keys.Space=0);btn('DASH','dash',()=>G.mode==='play'&&tryDash());btn('R','rel',()=>G.mode==='play'&&reload());btn('⇄','swp',()=>G.mode==='play'&&cycleW(1));btn('SCOPE','scp',()=>{if(G.mode==='play')P.ads=P.ads?0:1});btn('II','pau',()=>pauseGame());btn('PING','png',()=>G.mode==='play'&&doPing('smart'));
const stick=document.createElement('div');stick.className='stick';stick.innerHTML='<i></i>';t.appendChild(stick);
let jt=null,lt=null,jx=0,jy=0,lx=0,ly=0;const cv=ren.domElement;
cv.addEventListener('touchstart',e=>{e.preventDefault();for(const q of e.changedTouches){if(q.clientX<innerWidth*.45&&jt===null){jt=q.identifier;jx=q.clientX;jy=q.clientY;stick.style.cssText=`left:${jx}px;top:${jy}px;opacity:1`}else if(lt===null){lt=q.identifier;lx=q.clientX;ly=q.clientY}}},{passive:false});
cv.addEventListener('touchmove',e=>{e.preventDefault();for(const q of e.changedTouches){if(q.identifier===jt){mv.x=clamp((q.clientX-jx)/55,-1,1);mv.y=clamp((q.clientY-jy)/55,-1,1);stick.firstChild.style.transform=`translate(${mv.x*30}px,${mv.y*30}px)`}
else if(q.identifier===lt&&G.mode==='play'){const k=save.set.sens*.0016*(1-.55*P.adsK);P.yaw-=(q.clientX-lx)*k;P.pitch=clamp(P.pitch-(q.clientY-ly)*k,-1.5,1.5);lx=q.clientX;ly=q.clientY}}},{passive:false});
const end=e=>{for(const q of e.changedTouches){if(q.identifier===jt){jt=null;mv.x=mv.y=0;stick.style.opacity=0}if(q.identifier===lt)lt=null}};cv.addEventListener('touchend',end);cv.addEventListener('touchcancel',end)}

// ================= ONLINE CO-OP =================
function netSlot(){if(!NET.on)return 0;const ids=Object.keys(NRN().players).sort((a,b)=>(NRN().players[a].j||0)-(NRN().players[b].j||0)),i=Math.max(0,ids.indexOf(NRN().me));return i-(ids.length-1)/2}
// host: enemies chase whichever player is closest; AI code reads P, so swap in the target's position while it thinks
function hostUpdE(e,dt){const p=e.g.position;e.tgT=(e.tgT||0)-dt;if(e.tgT<=0){e.tgT=1;let best=null,bd=P.dead?1e9:Math.hypot(P.pos.x-p.x,P.pos.z-p.z);for(const id in NET.remote){const r=NET.remote[id];if(r.dead||!r.has||r.tr)continue;const d=Math.hypot(r.pos.x-p.x,r.pos.z-p.z);if(d<bd){bd=d;best=id}}e.tg=best}
const r=e.tg&&NET.remote[e.tg];if(!r||r.dead||r.tr){updE(e,dt);return}
const sp=P.pos,sy=P.yaw,sv=P.vel,so=P.onG;P.pos=r.pos;P.yaw=r.yaw;P.vel=r.vel;NET.tgt=e.tg;try{updE(e,dt)}finally{P.pos=sp;P.yaw=sy;P.vel=sv;P.onG=so;NET.tgt=null}}
// client: enemies follow the host's snapshots
function netUpdE(e,dt){const p=e.g.position;if(e.tx===undefined){animE(e,dt,0);return}const ox=p.x,oz=p.z,k=1-Math.exp(-14*dt);p.x+=(e.tx-p.x)*k;p.z+=(e.tz-p.z)*k;p.y+=(e.ty-p.y)*k;e.yaw+=angD(e.yaw,e.tyaw)*k;e.g.rotation.y=e.yaw;
const ms=Math.min(12,Math.hypot(p.x-ox,p.z-oz)/Math.max(dt,1e-3));e.y=damp(e.y||0,e.ny||0,12,dt);if(e.type==='drone'||e.type==='crawler')e.sm.position.y=e.y;
if(e.shieldM){e.shieldM.visible=e.shield>1;e.shieldM.material.uniforms.time.value=G.time}e.atk=Math.max(0,(e.atk||0)-dt*2.5);animE(e,dt,e.intro>0?0:ms)}
function applySnap(h){if(!NET.client||G.mode==='menu'||G.mode==='dead')return;const TI=ETK(),now=performance.now();G.grav=h.gv||0;if(h.fz)G.frz=Math.max(G.frz,.3);
if(G.mode!=='transit'){const seen=new Set();for(const a of h.e||[]){const[nid,ti,x,z,y,yaw,hp,mhp,fl,ey,al]=a;seen.add(nid);let e=NET.map[nid];
if(!e){if(NET.deadN.has(nid))continue;const type=TI[ti];if(!type||!MOD.geo[type])continue;e=spawnE(type,{pos:{x,z},elite:!!(fl&1),net:1});if(!e)continue;e.nid=nid;NET.map[nid]=e;e.g.position.set(x,y,z);e.yaw=yaw}
e.tx=x;e.tz=z;e.ty=y;e.tyaw=yaw;e.hp=hp;e.mhp=mhp;e.intro=fl&2?1:0;e.shield=fl&4?100:0;e.st=fl&8?'wind':fl&16?'rec':'idle';e.ny=ey;e.alpha=al/10;e.seen=now;if(e.boss&&h.ph)e.ph2=h.ph}
for(const id in NET.map){const e=NET.map[id];if(!seen.has(+id)&&now-(e.seen||0)>1500){if(G.boss===e){G.boss=null;hudBoss(null);bossEnd(e)}freeE(e)}}}
NET.laser=h.l||null}
function clientLaser(dt){const L=NET.laser;if(!L){if(NET.hadL){laserFX(null);NET.hadL=0}return}NET.hadL=1;NET.la+=angD(NET.la,L[3])*Math.min(1,dt*12);if(Math.abs(angD(NET.la,L[3]))>1)NET.la=L[3];
const o=_v4.set(L[0],L[1],L[2]),a=NET.la,ex=o.x+Math.sin(a)*L[4],ez=o.z+Math.cos(a)*L[4];laserFX(o,_v5.set(ex,L[5],ez),L[6]);
if(G.mode!=='play'||P.dead)return;const px=P.pos.x-o.x,pz=P.pos.z-o.z,bx=ex-o.x,bz=ez-o.z,tt=clamp((px*bx+pz*bz)/(bx*bx+bz*bz),0,1),dd=Math.hypot(px-bx*tt,pz-bz*tt),hy=o.y+(L[5]-o.y)*tt;if(dd<.9&&Math.abs(P.pos.y+.9-hy)<1.4)dmgP(L[7]*dt,{x:o.x,z:o.z},1)}
const _v4=new THREE.Vector3(),_v5=new THREE.Vector3();
function onNetEv(m){if(!NET.client)return;const k=m.k;
if(k==='kill'){const e=NET.map[m.n];NET.deadN.add(m.n);if(e&&!e.dead){killE(e,e.g.position.clone());if(m.by===NRN().me){hitMark(false,true);G.my.k++}}delete NET.map[m.n]}
else if(G.mode==='menu'||G.mode==='dead')return;
else if(k==='es'){ebAdd(_v4.set(m.p[0],m.p[1],m.p[2]),new THREE.Vector3(m.v[0],m.v[1],m.v[2]),m.d,m.c,m.z,m.sl,m.g)}
else if(k==='tel')tel(m.x,m.z,m.r,m.t,m.d,'net',null,m.c);
else if(k==='gw')groundWave(m.x,m.z,m.s,m.d,m.c);
else if(k==='ban')banner(m.t,m.s,m.d);
else if(k==='evt')evtStart(m.n);
else if(k==='evtEnd')evtEnd();
else if(k==='wave'){G.wave=m.w;G.waveClear=0;G.exit=-1;G.breather=0;banner(m.bt,m.bs,2.6);play('warn');if(m.w%5===0)setTimeout(()=>play('roar'),400)}
else if(k==='clear'){G.waveClear=1;G.exit=m.ex;G.nextRP=m.rp;G.score+=m.b||0;if(!P.dead)P.hp=Math.min(P.mhp,P.hp+P.mhp*.15);P.mag2=Math.max(P.mag2,3);play('lvl');evtEnd();setTimeout(()=>{if(G.exit>=0)play('door')},700);banner('ROOM CLEARED','+'+(m.b||0)+' BONUS · EXIT OPEN — '+W.doors[m.ex].name,3);NET.iReady=false;if(G.wave>=50&&!G.endless&&!G.xtAsked){G.xtAsked=1;setTimeout(xtOffer,1800)}}
else if(k==='go')netGo();
else if(k==='hurt'){if(m.to===NRN().me)dmgP(m.d,{x:m.x,z:m.z})}
else if(k==='over')netFinal();
else if(k==='rev'){if(m.to===NRN().me)selfRevive(m.by)}
else if(k==='ping'){if(m.by!==NRN().me)addPing(m)}
else if(k==='xt')xtApply(m.c)}
function onNetCev(m,from){if(!NET.host)return;if(m.k==='hit'){const e=NET.byId[m.n];if(e&&!e.dead){NET.killBy=from;hurtE(e,m.d,'body',null,{net:1});NET.killBy=null}}else if(m.k==='rdy'){NET.ready[from]=1;netCheckGo()}else if(m.k==='frz')G.frz=8;else if(m.k==='rev'){if(m.to===NRN().me)selfRevive(from);else NRN().ev({k:'rev',to:m.to,by:from})}else if(m.k==='ping'){const p=Object.assign({},m,{by:from});NRN().ev(p);addPing(p)}}
function selfRevive(by){if(!P.dead||NET.final||!NET.on)return;P.dead=0;P.hp=Math.round(P.mhp*.4);P.sh=P.msh*.5;P.inv=2;NET.downed=false;const nm=(NRN().players[by]||{}).n;banner('REVIVED',nm?nm+' GOT YOU BACK UP':'BACK ON YOUR FEET',2.2);play('lvl');FACE.react('grin')}
const REV_T=3;
function netRevive(rdt){const el=$('rev');let best=null,bd=2.6;if(!P.dead&&G.mode==='play')for(const id in NET.remote){const r=NET.remote[id];if(!r.dead||!r.has||r.tr)continue;const d=Math.hypot(r.pos.x-P.pos.x,r.pos.z-P.pos.z);if(d<bd){bd=d;best=id}}
for(const id in NET.remote){const r=NET.remote[id];if(id===best){r.revT=(r.revT||0)+rdt;if(r.revT>=REV_T&&!(r.revSent>performance.now()-4000)){r.revSent=performance.now();r.revT=0;G.my.rev++;if(NET.host)NRN().ev({k:'rev',to:id,by:NRN().me});else NRN().cev({k:'rev',to:id});play('pickup');sparks(_v4.set(r.pos.x,1,r.pos.z),0x7dffb0,30,5,.6,.2)}}else r.revT=Math.max(0,(r.revT||0)-rdt*2)}
if(!el)return;const r=best&&NET.remote[best];if(r&&!(r.revSent>performance.now()-4000)){el.classList.remove('hide');el.querySelector('b').textContent='REVIVING '+(r.name||'TEAMMATE');el.querySelector('u').style.width=(clamp(r.revT/REV_T,0,1)*100).toFixed(0)+'%'}else el.classList.add('hide')}
function shopTeam(){if(!NET.on)return;const ids=Object.keys(NRN().players),n=ids.length,rd=ids.filter(id=>id===NRN().me?NET.iReady:NET.host?NET.ready[id]||(NRN().states[id]||{}).d:(NRN().states[id]||{}).r).length;
$('bGo').textContent=NET.iReady?'WAITING FOR TEAM ('+rd+'/'+n+')':'READY ▸ ('+rd+'/'+n+' READY)'}
function netCheckGo(){if(!NET.host||!NET.on||(G.exit<0&&G.mode!=='transit'))return;const ids=Object.keys(NRN().players);if(!ids.length)return;let all=true,any=false;
for(const id of ids){const st=NRN().states[id]||{},rd=id===NRN().me?(NET.iReady||P.dead):(NET.ready[id]||st.d);if(rd)any=true;else all=false}
if(all||(any&&NET.readyT>45&&ids.some(id=>id===NRN().me?NET.iReady:NET.ready[id]))){NRN().ev({k:'go'});netGo()}}
function netGo(){NET.goNow=true;const was=G.mode;if(was==='transit'){if(!G.shopOn){G.shopOn=1;buildRoom()}leaveTransit()}else if(G.mode!=='menu'&&G.mode!=='dead'){if(G.mode==='levelup'){hideLevelUp()}buildRoom();G.mode='play';G.waveClear=0;G.breather=G.nextBoss?2.6:2.2;G.tf=1;banner(G.nextBoss?'⚠ BOSS VAULT':W.L.name,'ROOM '+G.rooms,2.4)}
if(P.dead){P.dead=0;P.hp=Math.round(P.mhp*.6);P.sh=P.msh;P.inv=2;NET.downed=false;banner('REDEPLOYED','BACK IN THE FIGHT',2)}
NET.goNow=false;NET.iReady=false;NET.ready={};NET.readyT=0;NET.deadN.clear();for(const id in NET.map){freeE(NET.map[id])}NET.map={};$('bGo').textContent='ENTER NEXT ROOM ▸'}
function netAllDeadCheck(){if(!NET.host||NET.final)return;let alive=!P.dead;for(const id of Object.keys(NRN().players)){if(id===NRN().me)continue;const st=NRN().states[id];if(st&&!st.d)alive=true}if(!alive){NRN().ev({k:'over'});netFinal()}}
function netFinal(){if(NET.final)return;NET.final=true;P.dead=0;die();setTimeout(netDeathUI,1700)}
function netDeathUI(){if(!NET.on||!NET.final)return;const a=$('bAgain');a.textContent=NET.host?'RESTART MISSION':'WAITING FOR HOST…';a.disabled=!NET.host;$('bMenu').textContent='LEAVE ROOM'}
function netRestart(){if(!NET.host||!NRN().on)return;play('click');NET.startRP=rollRP(false);NRN().start({rp:NET.startRP,w:0});netBegin({rp:NET.startRP})}
function flushHurt(){for(const id in NET.hurt){const d=NET.hurt[id],s=NET.hurtSrc[id]||{};if(d>0)NRN().ev({k:'hurt',to:id,d:Math.round(d*10)/10,x:r2(s.x||0),z:r2(s.z||0)})}NET.hurt={};NET.hurtSrc={}}
function sendSnap(){const TI=ETK(),b=G.boss,L=b&&b.laser;NRN().snap({w:G.wave,gv:G.grav>0?r2(G.grav):0,fz:G.frz>0?1:0,ph:b?b.ph2:0,
e:EN.filter(e=>!e.dead&&e.nid).map(e=>{const p=e.g.position;return[e.nid,TI.indexOf(e.type),r2(p.x),r2(p.z),r2(p.y),r2(e.yaw),Math.ceil(e.hp),Math.ceil(e.mhp),(e.elite?1:0)|(e.intro>0?2:0)|(e.shield>1?4:0)|(e.st==='wind'?8:0)|(e.st==='rec'?16:0),r2(e.y||0),Math.round((e.alpha===undefined?1:e.alpha)*10)]}),
l:L?[r2(L.o.x),r2(L.o.y),r2(L.o.z),r2(L.a),L.len,r2(L.y1),L.c,L.dps]:0})}
function sendState(){NRN().state({x:r2(P.pos.x),y:r2(P.pos.y),z:r2(P.pos.z),yw:r2(P.yaw),pt:r2(P.pitch),w:P.cw,f:mdown&&G.mode==='play'&&P.rl<=0&&P.ammo[P.cw]>0&&!P.dead?1:0,hp:Math.ceil(P.hp),mh:Math.round(P.mhp),d:P.dead?1:0,tr:G.mode==='transit'?1:0,r:NET.iReady?1:0,n:NRN().name,st:[G.my.k,Math.round(G.my.dmg),G.my.rev]})}
// teammates: soldier models in your colors with name tags
function nameTag(t){const c=document.createElement('canvas');c.width=256;c.height=64;const x=c.getContext('2d');x.font='700 34px Rajdhani,Arial,sans-serif';x.textAlign='center';x.lineWidth=6;x.strokeStyle='rgba(0,0,0,.8)';x.strokeText(t,128,44);x.fillStyle='#5ff2ff';x.fillText(t,128,44);
const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),depthTest:false,transparent:true}));s.scale.set(1.6,.4,1);s.renderOrder=5;return s}
function mkAvatar(r){if(!MOD.geo.soldier||r.av)return;const c=makeCreature('soldier',false);if(!c)return;const a=Object.assign(c,{type:'soldier',sp:4.2,ph:R()*10,phase:0,flinch:0,stg:0,look:0,fl:0,st:'idle',atk:0,elite:false,alpha:1,hb:[],y:0});
a.mats[0].color.set(0x9fd0dc);a.mats[3].color.set(0x6a8a96);attach(a);a.tag=nameTag(r.name||'PLAYER');a.tag.position.y=2.35;a.g.add(a.tag);a.g.position.copy(r.pos);scene.add(a.g);r.av=a}
function dropAvatar(r){if(r.av){scene.remove(r.av.g);r.av.mats.forEach(m=>m.dispose());r.av=null}}
function netStates(st){const me=NRN().me;for(const id in st){if(id===me)continue;const v=st[id];if(!v)continue;let r=NET.remote[id];if(!r){r=NET.remote[id]={pos:new THREE.Vector3(v.x,v.y,v.z),vel:new THREE.Vector3(),tp:new THREE.Vector3(),yaw:v.yw,pitch:0,fireT:0,name:v.n}}
r.tp.set(v.x,v.y,v.z);r.tyaw=v.yw;r.pitch=v.pt;r.dead=!!v.d;r.tr=!!v.tr;r.fire=!!v.f;r.w=v.w|0;r.hp=v.hp;r.mh=v.mh;r.name=v.n||r.name;r.has=true;r.rd=!!v.r}
for(const id in NET.remote)if(!st[id]||!NRN().players[id]){dropAvatar(NET.remote[id]);delete NET.remote[id]}if(NET.host)netCheckGo();if(G.shopOn)shopTeam()}
function netAvatars(dt){const k=1-Math.exp(-12*dt);for(const id in NET.remote){const r=NET.remote[id];if(!r.has)continue;const ox=r.pos.x,oz=r.pos.z;r.pos.lerp(r.tp,k);if(r.pos.distanceTo(r.tp)>8)r.pos.copy(r.tp);r.yaw+=angD(r.yaw,r.tyaw)*k;
if(!r.av)mkAvatar(r);const a=r.av;if(!a)continue;const show=G.mode!=='menu'&&!r.tr;a.g.visible=show;if(!show)continue;
a.g.position.set(r.pos.x,r.pos.y+(r.dead?-.75:0),r.pos.z);a.yaw=r.yaw+Math.PI;a.g.rotation.set(0,a.yaw,r.dead?1.4:0);const ms=Math.hypot(r.pos.x-ox,r.pos.z-oz)/Math.max(dt,1e-3);animE(a,dt,r.dead?0:Math.min(8,ms));a.mats[2].color.set(r.dead?0x553333:0x46e6ff).multiplyScalar(r.dead?1:4);
if(r.fire&&!r.dead){r.fireT-=dt;if(r.fireT<=0){const w=WEP[r.w]||WEP[0];r.fireT=Math.max(.08,w.rate*1.05);const cp=Math.cos(r.pitch),dir=_v4.set(-Math.sin(r.yaw)*cp,Math.sin(r.pitch),-Math.cos(r.yaw)*cp),st=_v5.set(r.pos.x,r.pos.y+1.45,r.pos.z).addScaledVector(dir,.7).clone();
rc.set(st,dir);rc.far=60;const h=rc.intersectObjects(HB.concat(W.solid),false)[0],end=h?h.point:st.clone().addScaledVector(dir,60);tracer(st,end,w.c,w.pel>1?.035:.04,.08);flash(st,w.c,1.5,6,.05);if(st.distanceTo(P.pos)<30&&!(r.sndT>0)){play(w.snd);r.sndT=.12}}}r.sndT=(r.sndT||0)-dt}}
function teamHUD(){const el=$('team');if(!el)return;if(!NET.on){el.classList.add('hide');return}el.classList.remove('hide');let h='';for(const id in NET.remote){const r=NET.remote[id];if(!r.has)continue;const f=clamp((r.hp||0)/(r.mh||100),0,1);h+=`<div class="tm${r.dead?' down':''}"><b>${(r.name||'PLAYER').replace(/[<>&]/g,'')}</b><i><u style="width:${f*100}%"></u></i><span>${r.dead?'DOWN':r.tr?'AT EXIT':Math.ceil(r.hp||0)}</span></div>`}
if(el.innerHTML!==h)el.innerHTML=h}
function netTick(rdt,dt){if(!NRN().on){return}NET.stT-=rdt;if(NET.stT<=0){NET.stT=1/15;sendState()}
if(NET.host){NET.snT-=rdt;if(NET.snT<=0){NET.snT=.1;sendSnap()}NET.huT-=rdt;if(NET.huT<=0){NET.huT=.1;flushHurt()}NET.dT-=rdt;if(NET.dT<=0){NET.dT=.5;if(G.mode!=='menu'&&G.mode!=='dead')netAllDeadCheck();if(G.exit>=0)NET.readyT+=.5;netCheckGo()}}
else clientLaser(dt);netAvatars(rdt);netRevive(rdt);NET.hudT=(NET.hudT||0)-rdt;if(NET.hudT<=0){NET.hudT=.2;teamHUD()}
if(P.dead&&G.mode==='play'){cam.position.y=damp(cam.position.y,P.pos.y+6,1.4,rdt);cam.rotation.x=damp(cam.rotation.x,-1.15,1.4,rdt)}
NRN().flush(performance.now())}
function clearPings(){PINGS.forEach(p=>p.el.remove());PINGS.length=0;const b=$('bstats');if(b)b.classList.add('hide')}
function netBegin(meta){clearPings();$('bAgain').textContent='PLAY AGAIN';$('bAgain').disabled=false;$('bMenu').textContent='MAIN MENU';NET.on=true;NET.host=NRN().isHost;NET.client=!NET.host;NET.final=false;NET.downed=false;NET.map={};NET.byId={};NET.deadN.clear();NET.ready={};NET.iReady=false;NET.goNow=false;NET.nid=0;
for(const id in NET.remote)dropAvatar(NET.remote[id]);NET.remote={};NET.startRP=meta&&meta.rp?meta.rp:null;startGame();if(NET.client&&meta&&meta.w)G.wave=meta.w;netStates(NRN().states)}
function netLeave(){$('bAgain').textContent='PLAY AGAIN';$('bAgain').disabled=false;$('bMenu').textContent='MAIN MENU';for(const id in NET.remote)dropAvatar(NET.remote[id]);NET.remote={};if(NRN())NRN().leave();NET.on=false;NET.host=false;NET.client=false;NET.startRP=null;laserFX(null);teamHUD()}
function onlineMsg(t,bad){const m=$('onMsg');m.textContent=t||'';m.classList.toggle('red',!!bad)}
function lobbyUI(){const N=NRN(),inL=N&&N.on;$('onJoin').classList.toggle('hide',!!inL);$('onLobby').classList.toggle('hide',!inL);if(!inL)return;$('onCodeBig').textContent=N.code;
const ids=Object.keys(N.players).sort((a,b)=>(N.players[a].j||0)-(N.players[b].j||0));$('onPlayers').innerHTML=ids.map(id=>`<div><b>${String(N.players[id].n||'PLAYER').replace(/[<>&]/g,'')}</b><span>${id===N.host?'HOST':''}${id===N.me?' · YOU':''}${N.isHost&&id!==N.me?`<button class="kick" data-k="${id}">KICK</button>`:''}</span></div>`).join('')+`<div class="dim">${ids.length}/4 PLAYERS</div>`;
$('onStart').classList.toggle('hide',!N.isHost);onlineMsg(N.isHost?'Share the code. Start when everyone is in.':'Waiting for the host to start the mission…')}
function openOnline(code){show('online');const nm=$('onName');try{nm.value=nm.value||localStorage.getItem('nr-name')||''}catch(e){}if(code)$('onCode').value=code;lobbyUI();
if(!NRN()){onlineMsg('Online play isn’t available here.',1);return}if(!(NRN().on))onlineMsg('Connecting…');NRN().init().then(ok=>{if(!NRN().on)onlineMsg(ok?'Create a room, join an open one below, or enter a friend\u2019s code.':NRN().err,!ok);if(ok&&!NET.listUn)NET.listUn=NRN().listWatch(renderRooms)})}
function renderRooms(v){const el=$('onRooms');if(!el)return;const now=Date.now(),rows=Object.entries(v||{}).filter(([c,r])=>r&&/^[A-Z]{4}$/.test(c)&&now-(r.t||0)<300000&&c!==NRN().code).sort((a,b)=>(b[1].t||0)-(a[1].t||0)).slice(0,8);
const esc=t=>String(t||'PLAYER').replace(/[<>&"]/g,'');el.innerHTML=rows.length?rows.map(([c,r])=>{const full=(r.n||1)>=4;return`<div class="rm"><div><b>${esc(r.h)}\u2019S ROOM</b><span>${Math.min(4,r.n||1)}/4 \u00b7 ${r.st==='play'?'IN MISSION':'IN LOBBY'} \u00b7 ${c}</span></div><button data-c="${c}" ${full?'disabled':''}>${full?'FULL':'JOIN'}</button></div>`}).join(''):'<div class="dim">No open rooms right now. Create one and tick \u201clist my room\u201d so others can find it.</div>'}
function netUI(){const N=NRN();$('bOnline').onclick=()=>{play('click');audioInit();openOnline()};
const nameOf=()=>{let n=($('onName').value||'').trim().slice(0,14).toUpperCase()||'PLAYER';try{localStorage.setItem('nr-name',n)}catch(e){}return n};
$('onCreate').onclick=async()=>{if(!N)return;play('click');onlineMsg('Creating room…');if(await N.create(nameOf(),$('onPub').checked))lobbyUI();else onlineMsg(N.err,1)};
$('onPlayers').addEventListener('click',e=>{const b=e.target.closest('button[data-k]');if(!b)return;play('click');N.kick(b.dataset.k)});
$('onRooms').addEventListener('click',e=>{const b=e.target.closest('button[data-c]');if(!b||b.disabled)return;$('onCode').value=b.dataset.c;$('onJoinB').click()});
$('onJoinB').onclick=async()=>{if(!N)return;play('click');onlineMsg('Joining…');if(await N.join($('onCode').value,nameOf()))lobbyUI();else onlineMsg(N.err,1)};
$('onCode').addEventListener('keydown',e=>{if(e.key==='Enter')$('onJoinB').click()});
$('onCopy').onclick=()=>{const u=N.invite();try{navigator.clipboard.writeText(u).then(()=>onlineMsg('Invite link copied: '+u),()=>onlineMsg(u))}catch(e){onlineMsg(u)}};
$('onStart').onclick=()=>{play('click');NET.startRP=rollRP(false);N.start({rp:NET.startRP,w:0});netBegin({rp:NET.startRP})};
$('onLeave').onclick=()=>{play('click');netLeave();lobbyUI();onlineMsg('Left the room.')};$('onBack').onclick=()=>{play('click');if(N&&N.on&&!NET.on){netLeave()}show('menu')};
if(!N)return;N.listen('players',()=>{if(G.mode==='menu')lobbyUI();if(NET.host){netCheckGo();netAllDeadCheck()}});
N.listen('started',m=>{if(!N.isHost&&(!NET.on||NET.final)){netBegin(m)}});
N.listen('late',(h,m)=>{if(!NET.on)netBegin(m)});
N.listen('states',st=>{if(NET.on)netStates(st)});N.listen('snap',h=>applySnap(h));N.listen('ev',onNetEv);N.listen('cev',onNetCev);
N.listen('conn',c=>{if(NET.on)banner('',c?'RECONNECTED':'CONNECTION LOST — RECONNECTING…',2)});
N.listen('closed',why=>{const inGame=NET.on;netLeave();if(inGame&&G.mode!=='menu'&&G.mode!=='dead'){banner('HOST LEFT',why||'THE ROOM WAS CLOSED',3);setTimeout(()=>{if(G.mode!=='menu')toMenu()},3000)}else{lobbyUI();onlineMsg(why||'The room was closed.',1)}});
const q=new URLSearchParams(location.search).get('room');if(q)setTimeout(()=>{openOnline(q.toUpperCase());$('onName').focus()},300)}

// ================= PINGS, BOSS STATS, EXTRACTION =================
const PINGS=[];let pingT=0;
SFX.ping=()=>{tone(1320,.08,'sine',.12,0,{wet:.2});tone(1760,.14,'sine',.08,0,{at:.07,wet:.3})};
const PW={open:false,dx:0,dy:0,sel:''};const PWS=[['go','GO HERE'],['enemy','ENEMY'],['help','NEED HELP'],['danger','WATCH OUT']];
function wheelPick(){const m=Math.hypot(PW.dx,PW.dy);if(m<28)return'';const a=Math.atan2(PW.dy,PW.dx);return Math.abs(a)<Math.PI/4?'enemy':a>=Math.PI/4&&a<=3*Math.PI/4?'help':a<=-Math.PI/4&&a>=-3*Math.PI/4?'go':'danger'}
function wheelUI(){PW.sel=wheelPick();document.querySelectorAll('#pwheel [data-t]').forEach(el=>el.classList.toggle('on',el.dataset.t===PW.sel))}
function wheelOpen(){if(G.mode!=='play'||P.dead)return;PW.open=true;PW.dx=PW.dy=0;PW.t0=performance.now();wheelUI();const w=$('pwheel');w&&w.classList.remove('hide')}
function wheelClose(){if(!PW.open)return;PW.open=false;const w=$('pwheel');w&&w.classList.add('hide');if(G.mode!=='play')return;doPing(PW.sel||'smart')}
function doPing(type){if(P.dead||performance.now()-pingT<600)return;pingT=performance.now();cam.updateMatrixWorld();const dir=_v4;cam.getWorldDirection(dir);rc.set(cam.position,dir);rc.far=140;
const h=rc.intersectObjects(HB.concat(W.solid),false)[0];let pt=h?h.point:cam.position.clone().addScaledVector(dir,40);const en=!!(h&&h.object.userData.e);
let t=type==='smart'||!type?(en?'enemy':'go'):type;if(t==='help')pt=P.pos.clone();
const m={k:'ping',x:r2(pt.x),y:r2(pt.y),z:r2(pt.z),e:t==='enemy'?1:0,t,n:NET.on?NRN().name:'YOU',by:NET.on?NRN().me:'me'};addPing(m);if(NET.host)NRN().ev(m);else if(NET.client)NRN().cev(m)}
function addPing(m){const box=$('pings');if(!box)return;const t=m.t||(m.e?'enemy':'go'),nm=String(m.n||'PING').replace(/[<>&]/g,''),lab=t==='enemy'?'ENEMY':t==='help'?(m.by===(NET.on?NRN().me:'me')?'NEED HELP':nm+' NEEDS HELP'):t==='danger'?'WATCH OUT':nm;
const el=document.createElement('div');el.className='ping '+t;el.innerHTML=`<i></i><b>${lab}</b><span></span>`;box.appendChild(el);
PINGS.push({x:m.x,y:m.y,z:m.z,t:t==='help'?9:7,el});while(PINGS.length>6){const o=PINGS.shift();o.el.remove()}play('ping');if(t==='help'||t==='danger')setTimeout(()=>play('ping'),140);const s=sprite(t==='enemy'?0xff3d4f:t==='help'?0x7dffb0:t==='danger'?0xffa640:0x5ff2ff,4,1.2);s.position.set(m.x,m.y+.2,m.z);setTimeout(()=>freeSprite(s),900)}
function updPings(dt){for(let i=PINGS.length-1;i>=0;i--){const p=PINGS[i];p.t-=dt;if(p.t<=0||G.mode==='menu'){p.el.remove();PINGS.splice(i,1);continue}
_v5.set(p.x,p.y+.6,p.z).project(cam);let x=_v5.x,y=_v5.y;const beh=_v5.z>1;if(beh){x=-x;y=-y}const mm=Math.max(Math.abs(x),Math.abs(y));if(beh||mm>.92){x=x/mm*.92;y=y/mm*.92}y=clamp(y,-.42,.86);
p.el.style.transform=`translate(${(x*.5+.5)*innerWidth}px,${(-y*.5+.5)*innerHeight}px) translate(-50%,-100%)`;p.el.style.opacity=Math.min(1,p.t);p.el.querySelector('span').textContent=Math.round(Math.hypot(P.pos.x-p.x,P.pos.z-p.z))+'m'}}
function bossStats(name){const el=$('bstats');if(!el||G.mode==='menu')return;const rows=[[NET.on?NRN().name:'YOU',G.my.k,Math.round(G.my.dmg),G.my.rev,1]];
if(NET.on)for(const id in NET.remote){const r=NET.remote[id],st=(NRN().states[id]||{}).st||[0,0,0];rows.push([r.name||'PLAYER',st[0],st[1],st[2],0])}
const top=Math.max(...rows.map(r=>r[2]));el.innerHTML=`<div class="kick">GREAT ENEMY FELLED</div><h3>${name}</h3><table><tr><th></th><th>KILLS</th><th>DAMAGE</th>${NET.on?'<th>REVIVES</th>':''}</tr>${rows.map(r=>`<tr class="${r[4]?'me':''}"><td>${String(r[0]).replace(/[<>&]/g,'')}${rows.length>1&&r[2]===top&&top>0?' <em>MVP</em>':''}</td><td>${r[1]}</td><td>${r[2].toLocaleString()}</td>${NET.on?`<td>${r[3]}</td>`:''}</tr>`).join('')}</table>`;
el.classList.remove('hide','out');void el.offsetWidth;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.classList.add('hide'),500)},8000)}
function mkPod(){const g=new THREE.Group(),hull=std({color:0xd9dee6,metalness:.85,roughness:.28}),dark=std({color:0x18202a,metalness:.6,roughness:.5}),gl=glowMat(0x5ff2ff,4),fl=glowMat(0xffa640,5);
const add=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=true;g.add(o);return o};
add(new THREE.CylinderGeometry(1.05,1.3,3.1,28),hull,0,1.95,0);add(new THREE.SphereGeometry(1.05,28,12,0,TAU,0,Math.PI/2),hull,0,3.5,0);add(new THREE.CylinderGeometry(1.4,1.55,.5,28),dark,0,.4,0);
const ring=add(new THREE.TorusGeometry(1.1,.06,8,40),gl,0,2.7,0);ring.rotation.x=Math.PI/2;add(new THREE.BoxGeometry(.95,.36,.12),gl,0,3,1.0);
for(let i=0;i<3;i++){const a=i/3*TAU,f=add(new THREE.BoxGeometry(.14,1.5,1),dark,Math.cos(a)*1.3,.95,Math.sin(a)*1.3);f.rotation.y=-a}
for(let i=0;i<8;i++){const a=i/8*TAU;add(new THREE.BoxGeometry(.05,2.4,.05),dark,Math.cos(a)*1.11,2,Math.sin(a)*1.11)}
const noz=add(new THREE.CylinderGeometry(.75,.95,.22,24),fl,0,.08,0),L=new THREE.PointLight(0xffa640,0,16,2);L.position.y=-.4;g.add(L);g.userData={noz,L,fl};scene.add(g);return g}
function startPod(){const f=_v4.set(-Math.sin(P.yaw),0,-Math.cos(P.yaw)),px=clamp(P.pos.x+f.x*7,-A+5,A-5),pz=clamp(P.pos.z+f.z*7,-A+5,A-5);
const pod=mkPod();pod.position.set(px,18,pz);const away=_v5.set(P.pos.x-px,0,P.pos.z-pz);if(away.lengthSq()<.1)away.set(0,0,1);away.normalize();
const side=Math.random()<.5?1:-1,cx=clamp(px+away.x*9-away.z*5*side,-A+2,A-2),cz=clamp(pz+away.z*9+away.x*5*side,-A+2,A-2);G.xt={t:0,pod,cp:new THREE.Vector3(cx,3.4,cz),landed:0,lift:0,done:0};$('hud').classList.add('hide');clearPings();document.exitPointerLock&&document.exitPointerLock()}
function podFlame(p,k){const n=SET_LOW()?2:5;for(let i=0;i<n;i++){const a=R()*TAU,r=R()*.6;PA.emit(p.x+Math.cos(a)*r,p.y-.1,p.z+Math.sin(a)*r,rr(-.6,.6),-rr(6,11)*k,rr(-.6,.6),rr(.25,.45),rr(.25,.5),4,1.6,.4,1,1.6,0,.5)}}
function SET_LOW(){return save.set.q===0}
function updPod(dt){const X=G.xt;if(!X||!X.pod)return;X.t+=dt;const t=X.t,pod=X.pod,u=pod.userData,p=pod.position;
if(t<1.5){const k=1-Math.pow(1-t/1.5,3);p.y=lerp(18,0,k);u.L.intensity=6;podFlame(p,1);if(t>1.35&&!X.landed){X.landed=1;smoke(_v4.set(p.x,.3,p.z),18,1.6,1.6,false);sparks(_v4.set(p.x,.2,p.z),0xffa640,40,9,.6,.25);addShake(.6);play('slam');banner('ESCAPE POD DOWN','BOARDING…',1.6)}}
else if(t<2.8){p.y=Math.sin(t*20)*.01;u.L.intensity=damp(u.L.intensity,1.5,3,dt);if(R()<dt*8)smoke(_v4.set(p.x+rr(-1,1),.2,p.z+rr(-1,1)),1,.8,1.2,false)}
else{const s=t-2.8;if(!X.lift){X.lift=1;play('rocket');setTimeout(()=>play('roar'),120);addShake(1);banner('LIFT-OFF','HEADING HOME',2)}p.y=s*s*5.5+s*1.5;u.L.intensity=14;podFlame(p,1.6);
if(R()<dt*30)smoke(_v4.set(p.x+rr(-.4,.4),Math.max(.3,p.y-1),p.z+rr(-.4,.4)),1,1.2,1.8,false);addShake(.02*Math.max(0,2-s));pod.rotation.y+=dt*.4}
u.fl.color.setRGB(5,2.2+Math.sin(t*40)*.6,.6);cam.position.lerp(X.cp,1-Math.exp(-2.2*dt));cam.position.y=Math.max(cam.position.y,1.6);if(t>2.8)X.cp.y=damp(X.cp.y,Math.min(9,3.2+(t-2.8)*2),1.5,dt);
cam.lookAt(p.x,p.y+2,p.z);G.tf=clamp((t-4.6)/.9,0,1);if(t>5.6&&!X.done){X.done=1;endRun()}}
const lbEsc=t=>String(t||'PLAYER').replace(/[<>&"]/g,'');
function lbRows(list,mine){if(!list)return'<div class="dim">The leaderboard can’t be reached right now.</div>';if(!list.length)return'<div class="dim">No endless runs yet. Hold out past wave 50 and keep fighting to claim the top spot.</div>';
return list.map((e,i)=>`<div class="lbr${e.id===mine?' me':''}"><em>#${i+1}</em><b>${lbEsc(e.n)}</b><span>WAVE ${e.w}</span><small>${(e.s||0).toLocaleString()}</small></div>`).join('')}
function lbLoad(el){if(!el)return;if(!window.NRNet){el.innerHTML=lbRows(null);return}el.innerHTML='<div class="dim">Loading…</div>';NRNet.lbGet().then(l=>{el.innerHTML=lbRows(l,NRNet.uid())})}
function lbDeath(d){const box=$('lbBox');if(!box)return;const ok=G.endless&&G.wave>50&&window.NRNet;box.classList.toggle('hide',!ok);if(!ok)return;
try{$('lbName').value=$('lbName').value||localStorage.getItem('nr-name')||''}catch(e){}$('lbSend').disabled=false;$('lbSend').textContent='SUBMIT RUN';$('lbRes').innerHTML='<div class="dim">Endless run: wave '+G.wave+'. Submit it to the leaderboard?</div>'}
function lbSend(){const n=($('lbName').value||'').trim().slice(0,14).toUpperCase()||'PLAYER';try{localStorage.setItem('nr-name',n)}catch(e){}const b=$('lbSend');b.disabled=true;b.textContent='SENDING…';play('click');
NRNet.lbSubmit(n,G.wave,G.score).then(r=>{b.textContent=r==='new'?'SUBMITTED':r==='kept'?'YOUR BEST STANDS':'FAILED';if(!r){b.disabled=false;$('lbRes').innerHTML='<div class="dim">Couldn’t reach the leaderboard. Try again.</div>';return}
NRNet.lbGet().then(l=>{$('lbRes').innerHTML=lbRows(l,NRNet.uid())})})}
function saveRun(t){save.run={v:1,wave:G.wave,score:G.score,kills:G.kills,rooms:G.rooms,bosses:G.bosses,bestCombo:G.bestCombo,gold:G.gold,goldTot:G.goldTot,own:P.own.slice(),cw:P.own[P.cw]?P.cw:0,
lvl:P.lvl,xp:P.xp,need:P.need,picks:(G.picks||[]).slice(),medN:G.medN,tuneN:G.tuneN,time:t,my:Object.assign({},G.my),at:Date.now()};store()}
function resumeRun(){const r=save.run;if(!r)return;startGame();
Object.assign(G,{wave:r.wave,score:r.score,kills:r.kills,rooms:r.rooms,bosses:r.bosses,bestCombo:r.bestCombo,gold:r.gold,goldTot:r.goldTot,medN:r.medN||0,tuneN:r.tuneN||0,picks:(r.picks||[]).slice(),my:Object.assign({k:0,dmg:0,rev:0},r.my),endless:1,xtAsked:1,resumed:1,t0:performance.now()-(r.time||0)*1000,breather:3.5,waveClear:1});
Object.assign(P,{own:r.own.slice(),lvl:r.lvl,xp:r.xp,need:r.need});for(const i of G.picks)if(UPS[i])UPS[i].f();for(let i=0;i<G.tuneN;i++)P.dm*=1.1;
P.hp=P.mhp;P.sh=P.msh;P.dashC=P.dashMax;P.cw=P.own[r.cw]?r.cw:0;P.ammo=WEP.map(w=>Math.round(w.mag*P.mag));VM.cur=-1;
save.run=null;store();banner('BACK IN THE RIFT','WAVE '+(G.wave+1)+' · ENDLESS · YOUR GEAR IS RESTORED',3.2);play('roar')}
function resumeBtn(){const b=$('bResume50');if(!b)return;const r=save.run;b.classList.toggle('hide',!r);if(r)b.innerHTML=`RESUME RUN <small>WAVE ${r.wave+1} · ${r.own.filter(Boolean).length} GUNS · LV ${r.lvl}</small>`}
function xtCores(){return Math.floor(G.score/120)+G.wave*3+G.bosses*15}
function xtOffer(){if(G.endless||G.mode==='menu'||G.mode==='dead')return;const host=!NET.on||NET.host,base=xtCores(),bonus=base+250;G.xtBonus=bonus;
$('xtBonus').textContent='+'+(base+bonus).toLocaleString();$('xtBtns').classList.toggle('hide',!host);$('xtWait').classList.toggle('hide',host);
G.mode='decide';mdown=0;G.noPause=1;document.exitPointerLock&&document.exitPointerLock();show('xt');$('hud').classList.add('hide');play('lvl')}
function xtChoose(c){if(NET.on&&!NET.host)return;play('click');if(NET.host)NRN().ev({k:'xt',c});xtApply(c)}
function xtApply(c){if(G.mode==='menu'||G.mode==='dead')return;show(null);$('hud').classList.remove('hide');
if(c==='endless'){G.endless=1;G.xtAsked=1;G.mode='play';G.noPause=0;lockPointer();banner('ENDLESS MODE','THE RIFT NEVER CLOSES — HOW FAR CAN YOU GO?',3);play('roar');return}
G.mode='extract';G.tf=0;P.ads=0;mdown=0;startPod();banner('ESCAPE POD INBOUND','STAND CLEAR OF THE LANDING ZONE',2.2);play('warn')}
function endRun(){if(G.mode==='dead')return;if(G.xt&&G.xt.pod){scene.remove(G.xt.pod);G.xt.pod=null}P.dead=1;G.mode='dead';G.noPause=1;mdown=0;const t=Math.round((performance.now()-G.t0)/1000),base=xtCores(),bonus=G.xtBonus||base+250,cores=base+bonus;
save.cores+=cores;save.best=Math.max(save.best,G.score);save.bestWave=Math.max(save.bestWave,G.wave);save.bestCombo=Math.max(save.bestCombo,G.bestCombo);save.runs++;save.extracts=(save.extracts||0)+1;store();play('lvl');
const saved=!NET.on;if(saved)saveRun(t);G.death={t,cores,bonus,win:1,saved};if(NET.on)NET.final=true;document.exitPointerLock&&document.exitPointerLock();showDeath(G.death);if(NET.on)netDeathUI()}

// ================= MAIN LOOP =================
let last=performance.now(),flick=0;
function worldAnim(dt,t){W.core.rotation.y+=dt*.5;W.core.rotation.x+=dt*.2;const pulse=1+Math.sin(t*2.2)*.06;W.core.scale.setScalar(pulse);W.rings.forEach((r,i)=>{r.rotation.z+=dt*(.25+i*.15)*(i%2?-1:1);r.rotation.y+=dt*.1});
W.shell.material.uniforms.time.value=t;W.coreLight.intensity=(W.coreBase||3)+Math.sin(t*2.2)*.6;if(W.L&&W.L.anim)W.L.anim(dt,t);if(W.L&&W.L.crane)W.L.crane.position.x=Math.sin(t*.12)*18;W.sky.rotation.y+=dt*.004;
W.gens.forEach((g,i)=>g.coil.forEach((c,k)=>{const v=.5+.5*Math.sin(t*4-k*.9+i);c.scale.setScalar(1+v*.03)}));
flick-=dt;if(flick<=0){flick=rr(3,9);const s=pick(W.signs);if(s){s.material.opacity=.15;setTimeout(()=>s.material.opacity=1,60+R()*120);setTimeout(()=>s.material.opacity=.3,220);setTimeout(()=>s.material.opacity=1,300)}}
const dp=W.dust.geometry.attributes.position;for(let i=0;i<dp.count;i++){let y=dp.array[3*i+1]+dt*.12;if(y>HT)y=0;dp.array[3*i+1]=y;dp.array[3*i]+=Math.sin(t*.3+i)*dt*.05}dp.needsUpdate=true;
W.doors.forEach((d,i)=>{const ex=G.exit===i;d.open-=dt;d.t=damp(d.t,d.open>0||ex?1:0,ex?2:3,dt);d.L.position.x=-1.3-d.t*2.5;d.R.position.x=1.3+d.t*2.5;d.glow.visible=d.core.visible=ex&&d.t>.05;if(ex)d.glow.material.opacity=.7+Math.sin(t*4)*.3;d.lamp.material.color.set(ex?0x7dffb0:d.open>0?0xff2a1a:0x2a6a40).multiplyScalar(ex?4+Math.sin(t*8)*2.5:4)})}
function loop(now){requestAnimationFrame(loop);const raw=(now-last)/1000||.016,rdt=Math.min(.05,raw);last=now;perfTick(raw);
if(G.slow>0){G.slow-=rdt;G.ts=damp(G.ts,.22,10,rdt)}else G.ts=damp(G.ts,1,3,rdt);const dt=rdt*G.ts,playing=G.mode==='play';
const t=performance.now()/1000;worldAnim(rdt,t);
if(G.mode==='extract')updPod(rdt);
if(playing||(NET.on&&(G.mode==='levelup'||G.mode==='pause'||G.mode==='decide'))){G.time+=dt;if(playing)updP(dt);updSpawns(dt);for(const e of EN.slice())if(!e.dead){if(NET.client)netUpdE(e,dt);else if(NET.host)hostUpdE(e,dt);else updE(e,dt)}updEB(dt);updPR(dt);updTel(dt);updWaves(dt);updGems(dt);updCoins(dt);updPU(dt);updEvt(dt);G.frz-=dt;
if(G.comboT>0){G.comboT-=dt;if(G.comboT<=0)G.combo=0}}
else if(G.mode==='transit'){G.tf=Math.min(1,G.tf+rdt*1.8);if(G.exitDir&&G.tf<1){cam.position.addScaledVector(G.exitDir,rdt*5)}if(G.tf>=1&&!G.shopOn){G.shopOn=1;buildRoom();cam.position.set(P.pos.x,P.pos.y+1.65,P.pos.z);cam.rotation.set(0,P.yaw,0);openShop()}}
else if(G.mode==='dead'){G.deathT+=rdt;faceUpd(rdt);cam.position.y=damp(cam.position.y,P.pos.y+.35,2,rdt);cam.rotation.z=damp(cam.rotation.z,.5,2,rdt);for(const e of EN)animE(e,rdt,0);G.fade=clamp((G.deathT-.3)*.5,0,.65)}
else if(G.mode==='menu'){const a=t*.06;cam.position.set(Math.sin(a)*21,6.5+Math.sin(t*.2),Math.cos(a)*21);cam.lookAt(0,4.5,0);if(cam.fov!==save.set.fov){cam.fov=save.set.fov;cam.updateProjectionMatrix()}
const ld=MOD.done/MOD.total,ess=['rifle','rifle_mag','hand','arm','drone','soldier'].every(n=>MOD.geo[n]);$('loadB').style.width=(ld*100).toFixed(0)+'%';$('loadT').textContent=ld<1?'SCULPTING ASSETS '+MOD.done+'/'+MOD.total:'ALL SYSTEMS READY';$('load').classList.toggle('done',ld>=1);
$('bPlay').disabled=!ess;$('bPlay').textContent=ess?'PLAY':'LOADING…'}
if(playing||G.mode==='levelup'||G.mode==='pause'||G.mode==='dead'){for(const e of EN)if(G.mode!=='play'&&G.mode!=='dead')e.g.updateMatrixWorld()}
if(NET.on)netTick(rdt,dt);if(PINGS.length)updPings(rdt);
updateFX(G.mode==='menu'?rdt:dt);
const showVM=(playing||G.mode==='levelup'||G.mode==='pause'||G.mode==='transit')&&!P.dead;if(showVM)updateVM(playing?rdt:0,P.moving);
G.dmgFX=Math.max(0,(G.dmgFX||0)-rdt*1.6);const U=PP.comp.uniforms;U.time.value=t;U.exposure.value=.55+save.set.bright*.1;U.dmg.value=G.dmgFX*.8;U.low.value=(playing||G.mode==='dead')&&P.hp<P.mhp*.3?1-P.hp/(P.mhp*.3):0;U.ca.value=.004+G.dmgFX*.02+(P.fovK||0)*.01;if(G.mode!=='transit'&&G.mode!=='extract'&&G.tf>0)G.tf=Math.max(0,G.tf-rdt*1.4);U.fade.value=G.mode==='dead'?G.fade:(G.tf||0);
U.sat.value=G.mode==='dead'?.25:G.frz>0&&playing?.7:1.08;U.tint.value.set(G.frz>0&&playing?.85:1,G.frz>0&&playing?.95:1,G.frz>0&&playing?1.2:1);
if(playing||G.mode==='levelup'||G.mode==='pause'||G.mode==='transit')hudUpdate(playing?rdt:0);document.body.classList.toggle('aim',playing&&!isTouch);
renderFrame(showVM&&P.adsK<.6)}
function init(){perfInit(true);PERF.hook=qc=>{if(qc)scene.traverse(o=>{if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true)});const e=document.getElementById('qinfo');if(e)e.textContent=perfLabel()};hudInit();buildWorld();initFX();setupPost();layout();setTheme(0);bindUI();netUI();show('menu');startModels();requestAnimationFrame(loop);
window.__NR={resumeRun,UPS,startPod,doPing,bossStats,xtOffer,xtChoose,PINGS,setLayout,dmgP,NET,netGo,rollRP,applyRP,withSeed,G,P,EN,W,COINS,hurtE,VM,WEP,PRICE,switchW,leaveTransit,enterTransit,dropGold,MOD,ren,scene,cam,sun,save,renderFrame,setupPost,newRun,spawnE,updateVM,PERF,perfSet,perfInit}}
try{init()}catch(e){console.error(e);const el=document.getElementById('err');if(el){el.style.display='block';el.textContent='Startup error: '+e.message}}
})();

