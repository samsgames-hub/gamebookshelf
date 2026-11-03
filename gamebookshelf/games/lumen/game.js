/* LUMEN — turn mirrors to bend a light beam through every crystal. Each level is generated with a guaranteed solution. */
(()=>{'use strict';
const $=id=>document.getElementById(id),cv=$('c'),x=cv.getContext('2d'),TAU=Math.PI*2;
const DX=[1,0,-1,0],DY=[0,1,0,-1];// dirs: 0 right, 1 down, 2 left, 3 up
// mirror '/' (1): right->up, up->right, left->down, down->left ; '\' (2): right->down, down->right, left->up, up->left
const BOUNCE={1:[3,2,1,0],2:[1,0,3,2]};
let L=null,level=1,won=false,glow=0,seed=1;
try{level=Math.max(1,+localStorage.getItem('lumen1')||1)}catch(e){}
function rng(s){return()=>{s|=0;s=s+0x6D2B79F5|0;let t=Math.imul(s^s>>>15,1|s);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function generate(lv){const r=rng(lv*7919+13),N=Math.min(9,5+Math.floor((lv-1)/3)),want=Math.min(5,1+Math.floor((lv+1)/2));
 for(let tries=0;tries<400;tries++){const g=Array.from({length:N},()=>Array(N).fill(0)),seen=new Set();const ey=Math.floor(r()*N);let cx=0,cy=ey,d=0,path=[],turns=0;
  let ok=true;for(let step=0;step<N*N;step++){const k=cy*N+cx;if(seen.has(k)){ok=false;break}seen.add(k);path.push([cx,cy]);
   // turn sometimes, never on the first cell
   if(step>0&&r()<.42){const nd=r()<.5?(d+1)%4:(d+3)%4,nx=cx+DX[nd],ny=cy+DY[nd];if(nx>=0&&ny>=0&&nx<N&&ny<N&&!seen.has(ny*N+nx)){g[cy][cx]=((d===0&&nd===3)||(d===3&&nd===0)||(d===2&&nd===1)||(d===1&&nd===2))?1:2;d=nd;turns++}}
   const nx=cx+DX[d],ny=cy+DY[d];if(nx<0||ny<0||nx>=N||ny>=N)break;if(seen.has(ny*N+nx)){ok=false;break}cx=nx;cy=ny}
  if(!ok||path.length<N+2||turns<Math.min(2+lv/2,7))continue;
  const plain=path.filter(([px,py],i)=>i>0&&!g[py][px]);if(plain.length<want)continue;
  const targets=[];const pick=plain.slice();for(let i=0;i<want;i++){const j=Math.floor(r()*pick.length);targets.push(pick.splice(j,1)[0])}
  // decoy mirrors off the path, then scramble every mirror
  const onPath=new Set(path.map(([a,b])=>b*N+a));let decoys=Math.floor(N*N*.12+lv*.3);while(decoys-->0){const a=Math.floor(r()*N),b=Math.floor(r()*N);if(!onPath.has(b*N+a)&&!g[b][a])g[b][a]=1+Math.floor(r()*2)}
  const sol=g.map(row=>row.slice());let flips=0;for(let b=0;b<N;b++)for(let a=0;a<N;a++)if(g[b][a]&&r()<.6){g[b][a]=3-g[b][a];if(sol[b][a]!==g[b][a])flips++}
  if(flips<2)continue;
  return{sol,N,g,ey,targets:targets.map(([a,b])=>({x:a,y:b,lit:false})),moves:0}}
 return generate(lv+1000)}
function trace(){const {N,g}=L;let cx=0,cy=L.ey,d=0;const pts=[[-.5,L.ey+.5]];const hit=new Set();
 for(let i=0;i<N*N*4;i++){pts.push([cx+.5,cy+.5]);hit.add(cy*N+cx);const m=g[cy][cx];if(m)d=BOUNCE[m][d];const nx=cx+DX[d],ny=cy+DY[d];if(nx<0||ny<0||nx>=N||ny>=N){pts.push([cx+.5+DX[d]*.6,cy+.5+DY[d]*.6]);break}cx=nx;cy=ny}
 for(const t of L.targets)t.lit=hit.has(t.y*N+t.x);return pts}
let AC=null;const audio=()=>{if(AC){AC.state==='suspended'&&AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){}};
function tone(f,d,v){if(!AC)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d+.05)}
function load(lv){level=lv;L=generate(lv);won=false;glow=0;$('lvl').textContent='Level '+lv;$('next').classList.add('hide');$('msg').textContent=L.targets.length>1?`Tap a mirror to turn it. Light all ${L.targets.length} crystals.`:'Tap a mirror to turn it. Light the crystal.';try{localStorage.setItem('lumen1',lv)}catch(e){}}
function checkWin(){trace();const n=L.targets.filter(t=>t.lit).length;if(n===L.targets.length&&!won){won=true;$('next').classList.remove('hide');$('msg').textContent=`Solved in ${L.moves} ${L.moves===1?'turn':'turns'}.`;[523,659,784,1046].forEach((f,i)=>setTimeout(()=>tone(f,.4,.08),i*90))}}
cv.addEventListener('pointerdown',e=>{audio();if(won)return;const r=cv.getBoundingClientRect(),N=L.N,cs=r.width/N,a=Math.floor((e.clientX-r.left)/cs),b=Math.floor((e.clientY-r.top)/cs);if(a<0||b<0||a>=N||b>=N)return;if(!L.g[b][a])return;
 const before=L.targets.filter(t=>t.lit).length;L.g[b][a]=3-L.g[b][a];L.moves++;tone(300+(a+b)*25,.08,.05);trace();const after=L.targets.filter(t=>t.lit).length;if(after>before)tone(880,.25,.07);checkWin()});
$('next').onclick=()=>{audio();load(level+1)};$('reset').onclick=()=>{load(level)};
addEventListener('keydown',e=>{if((e.code==='Enter'||e.code==='Space')&&won){e.preventDefault();load(level+1)}});
function draw(t){requestAnimationFrame(draw);const W=cv.width,N=L.N,cs=W/N;glow+=(won?1:0-glow)*.05;
 x.fillStyle='#1d1733';x.fillRect(0,0,W,W);
 for(let b=0;b<N;b++)for(let a=0;a<N;a++){x.fillStyle=(a+b)%2?'#221b3c':'#1f1937';x.fillRect(a*cs,b*cs,cs,cs)}
 const pts=trace();
 // beam
 x.lineCap='round';x.lineJoin='round';for(const [w,c] of [[cs*.32,'rgba(255,207,90,.12)'],[cs*.14,'rgba(255,207,90,.35)'],[cs*.05,'#fff3c4']]){x.strokeStyle=c;x.lineWidth=w;x.beginPath();pts.forEach(([px,py],i)=>{const X=px*cs,Y=py*cs;i?x.lineTo(X,Y):x.moveTo(X,Y)});x.stroke()}
 // emitter
 x.fillStyle='#ffcf5a';x.beginPath();x.moveTo(0,(L.ey+.2)*cs);x.lineTo(cs*.34,(L.ey+.5)*cs);x.lineTo(0,(L.ey+.8)*cs);x.fill();
 // crystals
 for(const c of L.targets){const X=(c.x+.5)*cs,Y=(c.y+.5)*cs,s=cs*.26,p=1+Math.sin(t/300+c.x)*.05*(c.lit?1:0);x.save();x.translate(X,Y);x.scale(p,p);x.fillStyle=c.lit?'#8ff5ff':'#3f6b8a';x.strokeStyle=c.lit?'#ffffff':'#6aa3c4';x.lineWidth=cs*.03;
  x.beginPath();x.moveTo(0,-s);x.lineTo(s*.75,0);x.lineTo(0,s);x.lineTo(-s*.75,0);x.closePath();x.fill();x.stroke();if(c.lit){x.fillStyle='rgba(143,245,255,.18)';x.beginPath();x.arc(0,0,s*1.6,0,TAU);x.fill()}x.restore()}
 // mirrors
 for(let b=0;b<N;b++)for(let a=0;a<N;a++){const m=L.g[b][a];if(!m)continue;const X=a*cs,Y=b*cs,p=cs*.18;x.strokeStyle='#e8ddff';x.lineWidth=cs*.09;x.lineCap='round';x.beginPath();
  if(m===1){x.moveTo(X+p,Y+cs-p);x.lineTo(X+cs-p,Y+p)}else{x.moveTo(X+p,Y+p);x.lineTo(X+cs-p,Y+cs-p)}x.stroke();x.strokeStyle='#8f7fc2';x.lineWidth=cs*.025;x.stroke()}
 if(glow>.01){x.fillStyle=`rgba(255,207,90,${glow*.08})`;x.fillRect(0,0,W,W)}}
load(level);requestAnimationFrame(draw);
window.__LU={get L(){return L},load,trace,checkWin,get won(){return won}};
})();
