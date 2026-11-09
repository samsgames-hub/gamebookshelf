/* TUMBLER — crack the daily safe. Plain JS + SVG; sound and music generated with Web Audio. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
/* ---------- the eight symbols, in dial order (the last sits next to the first) ---------- */
const SYM=[
 {n:'Crown',c:'#f2c94c',s:'<path d="M3 18V7l5 4 4-7 4 7 5-4v11z"/><rect x="3" y="19" width="18" height="2.5" rx="1"/><circle cx="12" cy="13.5" r="1.6" fill="#7a4d0c"/>'},
 {n:'Key',c:'#e0b064',s:'<path d="M7.5 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" fill-rule="evenodd"/><path d="M12 10.8h10v2.4h-2v3h-2.4v-3h-1.6v2h-2.4v-2H12z"/>'},
 {n:'Star',c:'#fff1b8',s:'<path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z"/>'},
 {n:'Moon',c:'#a9c6ff',s:'<path d="M15 2.5a9.5 9.5 0 1 0 6.8 15.6A7.6 7.6 0 0 1 15 2.5z"/>'},
 {n:'Anchor',c:'#c9d1db',s:'<g fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="12" cy="4.6" r="2.2"/><path d="M12 7v14M7.5 10.5h9M4 13.5c0 4.5 3.6 7.5 8 7.5s8-3 8-7.5"/></g>'},
 {n:'Bell',c:'#e3994a',s:'<path d="M12 2.5c-3.6 0-6.2 2.9-6.2 6.7V14l-2.3 3.2h17L18.2 14V9.2c0-3.8-2.6-6.7-6.2-6.7z"/><circle cx="12" cy="19.8" r="2.2"/>'},
 {n:'Gem',c:'#6be3ff',s:'<path d="M6 3h12l4 6-10 13L2 9z"/><path d="M2 9h20M9 3l3 6 3-6M12 9v13" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/>'},
 {n:'Clover',c:'#6fd17c',s:'<circle cx="12" cy="7" r="3.8"/><circle cx="7" cy="12" r="3.8"/><circle cx="17" cy="12" r="3.8"/><circle cx="12" cy="15.5" r="3.4"/><path d="M12 15l3 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'}];
const NS=10;
/* ---------- themes: every day the keypad carries a different set of ten, always in a fixed order ---------- */
const disc=(c,extra)=>'<svg viewBox="0 0 24 24"><defs><radialGradient id="g'+c.slice(1)+'" cx="35%" cy="30%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="'+c+'"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient></defs>'+(extra||'')+'<circle cx="12" cy="12" r="8.5" fill="'+c+'"/><circle cx="12" cy="12" r="8.5" fill="url(#g'+c.slice(1)+')"/></svg>';
const NUMW=['Zero','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];
const THEMES=[
 {id:'num',n:'Digits 0 to 9',up:'higher',down:'lower',vault:'The Bank Vault',items:[0,1,2,3,4,5,6,7,8,9].map(v=>({t:String(v),w:NUMW[v],c:`hsl(${44-v*3},${70+v*2}%,${80-v*3}%)`}))},
 {id:'roman',n:'Roman numerals I to X',up:'higher',down:'lower',vault:'The Legion Treasury',items:['I','II','III','IV','V','VI','VII','VIII','IX','X'].map((v,i)=>({t:v,w:v+' ('+(i+1)+')',c:'#f0c46a'}))},
 {id:'greek',n:'Greek letters α to κ',up:'later',down:'earlier',vault:'The Museum Vault',items:['α','β','γ','δ','ε','ζ','η','θ','ι','κ'].map((v,i)=>({t:v,w:['Alpha','Beta','Gamma','Delta','Epsilon','Zeta','Eta','Theta','Iota','Kappa'][i],c:'#e9dcb8'}))},
 {id:'letters',n:'Letters A to J',up:'later',down:'earlier',vault:'The Library Safe',items:'ABCDEFGHIJ'.split('').map(v=>({t:v,w:v,c:'#e7e2d4'}))},
 {id:'coin',n:'Money, smallest to biggest',up:'bigger',down:'smaller',vault:"The Collector's Safe",items:['1¢','5¢','10¢','25¢','50¢','$1','$2','$5','$10','$20'].map((v,i)=>({t:v,w:v,c:i<1?'#d58a52':i<5?'#d9dde3':i<7?'#f0cb5a':'#7fd49a'}))},
 {id:'planet',n:'The Sun outwards to Pluto',up:'further out',down:'closer in',vault:'The Space Station Locker',showW:1,items:[['Sun','#ffb52e'],['Mercury','#9c8f86'],['Venus','#e3c07a'],['Earth','#3f86d6'],['Mars','#d0603f'],['Jupiter','#d6a77a'],['Saturn','#e8cf8f'],['Uranus','#8fdde3'],['Neptune','#4a66e0'],['Pluto','#c7b29a']].map((v,i)=>({ic:disc(v[1],i===6?'<ellipse cx="12" cy="12" rx="11.5" ry="3.4" fill="none" stroke="#f4e3b0" stroke-width="1.4" transform="rotate(-20 12 12)"/>':''),w:v[0]}))},
 {id:'cards',n:'Cards, Ace up to 10',up:'higher',down:'lower',vault:'The Card Room Safe',items:['A','2','3','4','5','6','7','8','9','10'].map((v,i)=>({t:v+'♠',w:(i?v:'Ace')+' of spades',c:'#f1ece0'}))},
 {id:'floors',n:'Hotel floors, B2 up to 7',up:'higher',down:'lower',vault:'The Hotel Safe',items:['B2','B1','G','1','2','3','4','5','6','7'].map((v,i)=>({t:v,w:i<2?'Basement '+(2-i):i===2?'Ground floor':'Floor '+v,c:i<2?'#9fb4d8':i===2?'#ffd76a':'#f1ece0'}))}];
let TH=THEMES[0];
const face=i=>{const it=TH.items[i];if(it.ic)return '<span class="fc">'+it.ic+(TH.showW?'<span class="w">'+it.w+'</span>':'')+'</span>';return '<span class="fc"><span class="tx l'+Math.min(4,it.t.length)+'" style="color:'+it.c+'">'+it.t+'</span></span>'};
const svg=face;
function themeOfDay(day){const block=Math.floor((day-1)/THEMES.length),order=[...THEMES.keys()],r=mulberry(hash('tumbler2-themes-'+block));for(let i=order.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[order[i],order[j]]=[order[j],order[i]]}return THEMES[order[(day-1)%THEMES.length]]}
/* green: right; amber: one step away; dark: further. Every miss also says which way to go. */
const judge=(g,code)=>g.map((v,i)=>v===code[i]?2:Math.abs(v-code[i])===1?1:0);
const dirs=(g,code)=>g.map((v,i)=>Math.sign(code[i]-v));

/* ---------- save ---------- */
const KEY='tumbler1';
let S={daily:{},stats:{played:0,wins:0,streak:0,max:0,dist:[0,0,0,0,0,0,0,0],lastWin:-9,lastDay:-9},pstats:{played:0,wins:0,streak:0,max:0},practice:null,set:{vol:80,mus:40,mute:false,shake:true,cb:false,notes:true,diff:'5'},seenHelp:false};
try{const o=JSON.parse(localStorage.getItem(KEY)||'null');if(o)S=Object.assign(S,o,{set:Object.assign(S.set,o.set||{}),stats:Object.assign(S.stats,o.stats||{})})}catch(e){}
if(S.v!==2){S.v=2;S.daily={};S.practice=null}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};

/* ---------- daily puzzle from the date ---------- */
const EPOCH=new Date(2026,10,9);
function dayIndex(d){d=d||new Date();const a=new Date(d.getFullYear(),d.getMonth(),d.getDate());return Math.round((a-EPOCH)/864e5)+1}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function makeCode(n,rnd){const p=[...Array(NS).keys()];for(let i=p.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[p[i],p[j]]=[p[j],p[i]]}return p.slice(0,n)}
const TODAY=dayIndex();
if(S.stats.lastWin<TODAY-1&&S.stats.streak)S.stats.streak=0; /* a missed day breaks the streak */

/* ---------- game state ---------- */
let mode='daily',P=null,cur=[],sel=0,busy=false;
function dailyPuzzle(){const d=S.daily;if(d.day!==TODAY){S.daily={day:TODAY,guesses:[],done:false,won:false}}return{kind:'daily',code:makeCode(5,mulberry(hash('tumbler2-'+TODAY))),n:5,max:6,st:S.daily,th:themeOfDay(TODAY)}}
function practicePuzzle(fresh){const n=+S.set.diff;if(fresh||!S.practice||S.practice.done&&fresh!==false){S.practice={code:makeCode(n,Math.random),n,guesses:[],done:false,won:false,th:S.set.pth&&S.set.pth!=='random'?S.set.pth:THEMES[Math.floor(Math.random()*THEMES.length)].id}}const p=S.practice;return{kind:'practice',code:p.code,n:p.n,max:{4:7,5:6,6:5}[p.n],st:p,th:THEMES.find(t=>t.id===p.th)||THEMES[0]}}
function load(m){mode=m;document.querySelectorAll('#modes button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
 P=m==='daily'?dailyPuzzle():practicePuzzle(S.practice&&S.practice.done?true:undefined);
 TH=P.th;cur=Array(P.n).fill(null);sel=0;document.body.classList.remove('open');drawHelp();
 $('sub').textContent=(m==='daily'?'#'+TODAY+' · ':'Practice · ')+TH.vault;$('themeTag').textContent=TH.n+(m==='practice'?' · '+{4:'Easy',5:'Normal',6:'Hard'}[P.n]:'');
 render();msg(P.st.done?(P.st.won?'Opened in '+P.st.guesses.length+'. Come back tomorrow for a new safe.':'The code was shown below. New safe tomorrow.'):'');
 if(P.st.done){if(P.st.won)document.body.classList.add('open');if(!P.st.won)revealCode()}save()}

/* ---------- rendering ---------- */
/* size the slots and the dial so the safe and dial always fit the screen */
function fit(){const side=innerWidth>=820&&innerHeight<=860,W=side?520:Math.min(innerWidth,560)-24,H=innerHeight,n=P?P.n:5,root=document.documentElement.style;
 let kk=Math.floor(Math.min(64,((side?380:Math.min(W,440))-4*8)/5)),s=Math.floor(Math.min(60,(W-60-(n-1)*8)/n));
 root.setProperty('--k',kk+'px');
 for(let k=0;k<40;k++){root.setProperty('--s',s+'px');const kb=Math.max($('keys').getBoundingClientRect().bottom,$('door').getBoundingClientRect().bottom+30);if(kb<=H-8||s<=24)break;s-=2;if(s<40&&kk>44){kk-=4;root.setProperty('--k',kk+'px')}}}
addEventListener('resize',fit);
function render(){const b=$('board'),st=P.st;let h='';
 for(let r=0;r<P.max;r++){h+='<div class="row" data-r="'+r+'">';
  for(let i=0;i<P.n;i++){
   if(r<st.guesses.length){const g=st.guesses[r],f=judge(g,P.code)[i],dr=dirs(g,P.code)[i];h+='<div class="slot '+['d','a','g'][f]+'">'+svg(g[i])+(f<2?'<span class="ar '+(dr>0?'up':'dn')+'" title="'+(dr>0?TH.up:TH.down)+'">'+(dr>0?'▲':'▼')+'</span>':'')+'</div>'}
   else if(r===st.guesses.length&&!st.done){h+='<div class="slot cur'+(i===sel?' sel':'')+'" data-i="'+i+'">'+(cur[i]!==null?svg(cur[i]):'')+'</div>'}
   else h+='<div class="slot" style="opacity:.55"></div>'}
  h+='</div>'}
 b.innerHTML=h;b.querySelectorAll('.slot.cur').forEach(s=>s.onclick=()=>{sel=+s.dataset.i;sfx.tick();render()});
 drawRing();fit();$('bEnter').disabled=st.done||cur.some(v=>v===null);$('bClear').disabled=st.done;
 if(st.done){$('bEnter').textContent=P.kind==='practice'?'Next safe':'Results';$('bEnter').disabled=false}else $('bEnter').textContent='Try it'}
/* which items can each dial still be, given every clue so far? */
function possible(i){const st=P.st,lockedElsewhere=new Set();
 st.guesses.forEach(g=>judge(g,P.code).forEach((f,j)=>{if(f===2&&j!==i)lockedElsewhere.add(g[j])}));
 const out=[];for(let v=0;v<NS;v++){if(lockedElsewhere.has(v))continue;let ok=true;
  for(const g of st.guesses){const f=judge([g[i]],[v])[0],d=Math.sign(v-g[i]),F=judge(g,P.code)[i],D=dirs(g,P.code)[i];if(f!==F||(F<2&&d!==D)){ok=false;break}}
  if(ok)out.push(v)}return out}
function drawRing(){const r=$('ring'),st=P.st,notes=S.set.notes&&!st.done&&st.guesses.length;const pos=notes?possible(sel):null;
 let head=st.done?(st.won?'Safe open':'Locked out'):'Dial '+(sel+1);
 if(pos)head+=pos.length===1?' must be <b>'+TH.items[pos[0]].w+'</b>':pos.length<=4?' could be <b>'+pos.map(v=>TH.items[v].w).join(', ')+'</b>':' · '+pos.length+' options left';
 let h='<div class="ph">'+head+'</div><div class="pg">';
 for(let i=0;i<NS;i++){const used=cur.includes(i)&&cur[sel]!==i,out=pos&&!pos.includes(i);
  h+='<button class="key'+(used?' used':'')+(out?' out':'')+(cur[sel]===i?' on':'')+'" data-s="'+i+'" aria-label="'+TH.items[i].w+'" title="'+TH.items[i].w+'">'+svg(i)+'<span class="k">'+i+'</span></button>'}
 h+='</div><div class="pe"><span>▼ '+TH.down+'</span><span>'+TH.up+' ▲</span></div>';
 r.innerHTML=h;r.querySelectorAll('.key').forEach(b=>b.onclick=e=>{e.stopPropagation();pick(+b.dataset.s)})}
function msg(t){$('msg').innerHTML=t}
let tT=0;function toast(t){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(tT);tT=setTimeout(()=>e.classList.remove('on'),1800)}

/* ---------- input ---------- */
function pick(s){if(P.st.done||busy)return;audio();const other=cur.indexOf(s);if(other>=0&&other!==sel)cur[other]=null;cur[sel]=s;sfx.click(s);
 const nx=cur.findIndex((v,i)=>v===null&&i>sel),any=cur.findIndex(v=>v===null);sel=nx>=0?nx:any>=0?any:sel;render();bump(s)}
function bump(s){const el=document.querySelector('.slot.cur[data-i="'+cur.indexOf(s)+'"]');if(el){el.classList.add('pop');setTimeout(()=>el.classList.remove('pop'),160)}}
function turn(d){if(P.st.done||busy)return;audio();let v=cur[sel]===null?(d>0?0:NS-1):cur[sel]+d;while(v>=0&&v<NS&&cur.includes(v)&&cur.indexOf(v)!==sel)v+=d;if(v<0||v>=NS){sfx.buzz();return}cur[sel]=v;sfx.tick();render()}
function clearRow(){if(P.st.done||busy)return;if(cur[sel]!==null)cur[sel]=null;else{const last=cur.map((v,i)=>v!==null?i:-1).filter(i=>i>=0).pop();if(last!==undefined){cur[last]=null;sel=last}}sfx.tick();render()}
function submit(){if(busy)return;audio();const st=P.st;
 if(st.done){if(P.kind==='practice'){load('practice')}else showStats();return}
 if(cur.some(v=>v===null)){shakeRow();toast('Set every dial first');return}
 const g=cur.slice();st.guesses.push(g);const f=judge(g,P.code),r=st.guesses.length-1;cur=Array(P.n).fill(null);sel=0;busy=true;
 const won=f.every(v=>v===2),lost=!won&&st.guesses.length>=P.max;if(won||lost){st.done=true;st.won=won}save();
 render();sfx.clunk();
 /* flip the lamps one at a time */
 const slots=document.querySelectorAll('.row[data-r="'+r+'"] .slot');slots.forEach(s=>{s.dataset.c=s.className;s.className='slot'});
 slots.forEach((s,i)=>setTimeout(()=>{s.className=s.dataset.c+' flip';sfx.lamp(f[i],i)},180+i*230));
 setTimeout(()=>{busy=false;if(won)win(r);else if(lost)lose();else{const greens=f.filter(v=>v===2).length;msg(greens?greens+' dial'+(greens>1?'s':'')+' locked in.':'No dials right yet. Follow the arrows.')}},180+P.n*230+250)}
function shakeRow(){const row=document.querySelector('.row[data-r="'+P.st.guesses.length+'"]');if(row&&S.set.shake){row.classList.remove('shake');void row.offsetWidth;row.classList.add('shake')}sfx.buzz()}

/* ---------- endings ---------- */
function record(won){const n=P.st.guesses.length;
 if(P.kind==='daily'){const s=S.stats;if(s.lastDay===TODAY)return;s.lastDay=TODAY;s.played++;if(won){s.wins++;s.dist[n-1]++;s.streak=s.lastWin===TODAY-1?s.streak+1:1;s.lastWin=TODAY;s.max=Math.max(s.max,s.streak)}else s.streak=0}
 else{const s=S.pstats;s.played++;if(won){s.wins++;s.streak++;s.max=Math.max(s.max,s.streak)}else s.streak=0}save()}
function win(r){record(true);const row=document.querySelector('.row[data-r="'+r+'"]');row&&row.classList.add('win');
 const n=P.st.guesses.length,words=['Genius!','Masterful!','Smooth work.','Nicely done.','Got it.','Phew!','Just in time!'];
 msg(words[Math.min(n-1,words.length-1)]+' Opened in '+n+'.'+(P.kind==='daily'?' Your vault payout is ready.':''));$('vtxt').textContent=n===1?'First try!':'Opened in '+n;sfx.win();
 setTimeout(()=>{document.body.classList.add('open');sparks(60)},700);setTimeout(()=>{render();showStats()},2600)}
function lose(){record(false);sfx.alarm();if(S.set.shake){const d=$('door');d.animate([{transform:'translateX(0)'},{transform:'translateX(-10px)'},{transform:'translateX(10px)'},{transform:'translateX(-6px)'},{transform:'translateX(0)'}],{duration:450})}
 revealCode();setTimeout(()=>{render();showStats()},2200)}
function revealCode(){msg('Locked out. The combination was '+P.code.map(i=>TH.items[i].w).join(' · '))}
function sparks(n){if(!S.set.shake)return;const r=$('safe').getBoundingClientRect();for(let i=0;i<n;i++){const e=document.createElement('div');e.className='spark';e.style.background=['#ffd76a','#fff1b8','#e0a83a'][i%3];document.body.appendChild(e);
 const x=r.left+r.width/2,y=r.top+r.height*.55,a=Math.random()*Math.PI*2,s=120+Math.random()*260;
 e.animate([{transform:`translate(${x}px,${y}px) rotate(0)`,opacity:1},{transform:`translate(${x+Math.cos(a)*s}px,${y+Math.sin(a)*s-120}px) rotate(${Math.random()*720}deg)`,opacity:0}],{duration:900+Math.random()*700,easing:'cubic-bezier(.2,.7,.4,1)'}).onfinish=()=>e.remove()}}

/* ---------- vault payout: a daily win pays out in the other games on this site ----------
   The games share this website's storage, so the payout waits in 'gbs-bank' until that game is opened. */
const GAMES={skyline:{n:'Skyline',unit:'coins',k:'coins',url:'../skyline/index.html',ic:'🏙️'},slingshot:{n:'Slingshot',unit:'stars',k:'stars',url:'../slingshot/index.html',ic:'🚀'},gwf:{n:'Gamble With Friends',unit:'gold',k:'gold',url:'../gamble-with-friends/index.html',ic:'🎰'}};
function payout(){const st=S.daily;if(!st.done)return null;const n=st.guesses.length,streak=Math.min(5,Math.max(0,(S.stats.streak||1)-1));
 const base=st.won?[0,150,120,95,75,60,45][n]:15,mult=st.won?1+streak*.1:1;return{coins:Math.round(base*mult),stars:Math.round(base*mult/4),gold:Math.max(1,Math.round(base*mult/25)),streakBonus:st.won?streak*10:0}}
function claim(g){const pay=payout();if(!pay||S.claimed&&S.claimed.day===TODAY)return;let bank={};try{bank=JSON.parse(localStorage.getItem('gbs-bank')||'{}')}catch(e){}
 const k=GAMES[g].k;bank[g]=bank[g]||{};bank[g][k]=(bank[g][k]||0)+pay[k];bank[g].from='Tumbler';try{localStorage.setItem('gbs-bank',JSON.stringify(bank))}catch(e){}
 S.claimed={day:TODAY,g,amt:pay[k]};save();sfx.coins();sparks(40);showStats()}
function payoutHTML(){if(P.kind!=='daily'||!P.st.done)return'';const pay=payout(),c=S.claimed&&S.claimed.day===TODAY?S.claimed:null;
 if(c){const G2=GAMES[c.g];return '<div class="pay done"><b>Vault payout sent</b><span>+'+c.amt+' '+G2.unit+' are waiting in '+G2.n+'.'+(c.g==='gwf'?' You get it when you start or join your next game.':'')+'</span><a class="ghost" href="'+G2.url+'">Open '+G2.n+' '+G2.ic+'</a></div>'}
 return '<div class="pay"><b>'+(P.st.won?'Vault payout':'Consolation prize')+'</b><span>'+(P.st.won?'Choose where to spend it'+(pay.streakBonus?' (includes +'+pay.streakBonus+'% streak bonus)':''):'Better luck tomorrow. Pick one:')+'</span><div class="pb"><button data-claim="skyline">'+GAMES.skyline.ic+' Skyline<br><b>+'+pay.coins+' coins</b></button><button data-claim="slingshot">'+GAMES.slingshot.ic+' Slingshot<br><b>+'+pay.stars+' stars</b></button><button data-claim="gwf">'+GAMES.gwf.ic+' Gamble<br><b>+'+pay.gold+' gold</b></button></div></div>'}

/* ---------- overlays ---------- */
const OV=['oStart','oHelp','oStats','oSet'];
function open(id){OV.forEach(o=>$(o).classList.toggle('hide',o!==id));if(id==='oSet')loadSet()}
function closeAll(){OV.forEach(o=>$(o).classList.add('hide'))}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{sfx.tick();closeAll()});
OV.forEach(o=>$(o).addEventListener('pointerdown',e=>{if(e.target===$(o)&&o!=='oStart')closeAll()}));
function shareText(){const st=P.st,cb=S.set.cb,E=cb?['⬛','🟧','🟦']:['⬛','🟨','🟩'];
 return 'Tumbler #'+TODAY+' · '+TH.n+' '+(st.won?st.guesses.length:'X')+'/'+P.max+(S.stats.streak>1&&st.won?' 🔥'+S.stats.streak:'')+'\n'+st.guesses.map(g=>judge(g,P.code).map(v=>E[v]).join('')).join('\n')+'\ngamebookshelf.com'}
function showStats(){const daily=P.kind==='daily',s=daily?S.stats:S.pstats;$('stTitle').textContent=daily?'Daily statistics':'Practice statistics';
 $('stNums').innerHTML=[[s.played,'Played'],[s.played?Math.round(s.wins/s.played*100):0,'Win %'],[s.streak,daily?'Day streak':'Streak'],[s.max,'Best streak']].map(a=>'<div><b>'+a[0]+'</b>'+a[1]+'</div>').join('');
 const d=$('dist');if(daily){const dist=S.stats.dist.slice(0,6),mx=Math.max(1,...dist),me=P.st.done&&P.st.won?P.st.guesses.length:0;d.previousElementSibling.style.display='';d.innerHTML=dist.map((v,i)=>'<div class="dr">'+(i+1)+'<div class="bar'+(me===i+1?' me':'')+'" style="width:'+Math.max(8,v/mx*100)+'%">'+v+'</div></div>').join('')}
 else{d.previousElementSibling.style.display='none';d.innerHTML=''}
 let a='';if(daily&&P.st.done)a=payoutHTML()+'<button class="big" id="bShare">Share result</button><div class="cd">Next safe in<b id="cd"></b></div>';
 else if(daily)a='<p class="small">Finish today\'s safe to share your result.</p>';
 else a='<button class="big" id="bNext">Next practice safe</button>';
 $('after').innerHTML=a;$('after').querySelectorAll('[data-claim]').forEach(b=>b.onclick=()=>claim(b.dataset.claim));if($('bShare'))$('bShare').onclick=share;if($('bNext'))$('bNext').onclick=()=>{closeAll();load('practice')};tick();open('oStats')}
function tick(){const e=$('cd');if(!e)return;const n=new Date(),m=new Date(n.getFullYear(),n.getMonth(),n.getDate()+1),s=Math.max(0,(m-n)/1000|0);e.textContent=[s/3600|0,(s/60|0)%60,s%60].map(v=>String(v).padStart(2,'0')).join(':');if(s===0)setTimeout(()=>location.reload(),1500)}
setInterval(tick,1000);
async function share(){const t=shareText();try{if(navigator.share&&matchMedia('(pointer:coarse)').matches){await navigator.share({text:t});return}await navigator.clipboard.writeText(t);toast('Result copied. Paste it anywhere.')}catch(e){toast('Copy failed. Select and copy:');prompt('Your result',t)}sfx.tick()}

/* ---------- settings ---------- */
function applySet(){document.body.classList.toggle('cb',S.set.cb);document.body.classList.toggle('still',!S.set.shake);applyVol()}
function loadSet(){$('sPth').innerHTML='<option value="random">A different theme each safe</option>'+THEMES.map(t=>'<option value="'+t.id+'">'+t.n+'</option>').join('');$('sPth').value=S.set.pth||'random';$('sVol').value=S.set.vol;$('sMus').value=S.set.mus;$('sMute').checked=S.set.mute;$('sShake').checked=S.set.shake;$('sCB').checked=S.set.cb;$('sNotes').checked=S.set.notes;$('sDiff').value=S.set.diff}
$('sVol').oninput=e=>{S.set.vol=+e.target.value;applyVol();save()};$('sVol').onchange=()=>sfx.lamp(2,2);
$('sMus').oninput=e=>{S.set.mus=+e.target.value;applyVol();save()};
$('sMute').onchange=e=>{S.set.mute=e.target.checked;applyVol();save()};
$('sShake').onchange=e=>{S.set.shake=e.target.checked;applySet();save()};
$('sCB').onchange=e=>{S.set.cb=e.target.checked;applySet();save()};
$('sNotes').onchange=e=>{S.set.notes=e.target.checked;save();render()};
$('sPth').onchange=e=>{S.set.pth=e.target.value;save();toast('Applies to your next practice safe')};
$('sDiff').onchange=e=>{S.set.diff=e.target.value;save();if(mode==='practice'&&!S.practice.guesses.length||mode==='practice'&&S.practice.done){S.practice=null;load('practice')}else toast('Applies to your next practice safe')};

/* ---------- audio ---------- */
let AC=null,master,sfxG,musG,NB;
function audio(){if(AC){if(AC.state==='suspended')AC.resume();return}try{AC=new(window.AudioContext||window.webkitAudioContext)()}catch(e){return}
 master=AC.createGain();sfxG=AC.createGain();musG=AC.createGain();sfxG.connect(master);musG.connect(master);master.connect(AC.destination);
 NB=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;applyVol();mus.next=AC.currentTime+.2}
function applyVol(){if(!AC)return;master.gain.value=S.set.mute?0:1;sfxG.gain.value=S.set.vol/100;musG.gain.value=S.set.mus/100*.35}
function tone(f,d,v,type,at,f2,dest){if(!AC)return;const t=AC.currentTime+(at||0),o=AC.createOscillator(),g=AC.createGain();o.type=type||'sine';o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(v,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g);g.connect(dest||sfxG);o.start(t);o.stop(t+d+.05)}
function noise(d,v,f,type,at,dest){if(!AC)return;const t=AC.currentTime+(at||0),s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain();s.buffer=NB;fl.type=type||'bandpass';fl.frequency.value=f;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);s.connect(fl);fl.connect(g);g.connect(dest||sfxG);s.start(t,Math.random()*.5);s.stop(t+d+.05)}
const sfx={
 tick(){noise(.03,.35,4200,'bandpass');tone(2400,.02,.05,'square')},
 click(s){noise(.04,.5,3000+s*120,'bandpass');tone(900+s*40,.05,.06,'triangle')},
 clunk(){tone(90,.25,.35,'sine',0,50);noise(.15,.5,700,'lowpass')},
 lamp(f,i){if(f===2){tone(660+i*55,.25,.12,'triangle');tone(1320+i*110,.18,.04,'sine')}else if(f===1){tone(440+i*30,.2,.09,'triangle')}else{tone(160,.12,.08,'square',0,120)}},
 buzz(){tone(140,.18,.1,'sawtooth',0,100)},
 win(){[0,4,7,12,16,19].forEach((s,i)=>tone(523*Math.pow(2,s/12),.5,.1,'triangle',i*.08));setTimeout(()=>{noise(.3,.6,900,'lowpass');tone(110,.3,.3,'sine',0,60);noise(.3,.6,900,'lowpass',.15);tone(100,.3,.3,'sine',.15,55)},650)},
 coins(){for(let i=0;i<8;i++){tone(1800+Math.random()*900,.08,.05,'square',i*.06);tone(2600,.05,.03,'sine',i*.06+.02)}},
 alarm(){for(let i=0;i<4;i++){tone(880,.18,.12,'square',i*.36,660);tone(660,.18,.12,'square',i*.36+.18,880)}}};
/* music: quiet late-night lounge loop (rhodes chords, walking bass, brushed hats) */
const CH=[[62,65,69,72],[67,71,74,77],[60,64,67,71],[57,60,64,67]],BASS=[[50,53,57,55],[43,47,50,52],[48,52,55,57],[45,48,52,50]],mus={next:0,step:0},mf=n=>440*Math.pow(2,(n-69)/12);
function music(){if(!AC||AC.state!=='running'||S.set.mus===0)return;const sp=60/78/2;
 while(mus.next<AC.currentTime+.3){const t=mus.next,s=mus.step,bar=(s>>3)%4;
  if(s%8===0||s%8===5)CH[bar].forEach((n,k)=>{const o=AC.createOscillator(),g=AC.createGain(),fl=AC.createBiquadFilter();o.type='triangle';o.frequency.value=mf(n);fl.type='lowpass';fl.frequency.value=1400;g.gain.setValueAtTime(.0001,t+k*.012);g.gain.exponentialRampToValueAtTime(.05,t+k*.012+.02);g.gain.exponentialRampToValueAtTime(.0001,t+sp*(s%8===0?4.5:2.5));o.connect(fl);fl.connect(g);g.connect(musG);o.start(t);o.stop(t+sp*5)});
  if(s%2===0)tone(mf(BASS[bar][(s>>1)%4]),sp*1.8,.12,'sine',t-AC.currentTime,0,musG);
  if(s%2===1||s%4===0){const b=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();b.buffer=NB;f.type='highpass';f.frequency.value=7000;g.gain.setValueAtTime(s%4===2?.03:.018,t);g.gain.exponentialRampToValueAtTime(.0001,t+.09);b.connect(f);f.connect(g);g.connect(musG);b.start(t,Math.random()*.5);b.stop(t+.1)}
  mus.next+=sp;mus.step++}}
setInterval(music,100);

/* ---------- wiring ---------- */
$('bEnter').onclick=submit;$('bClear').onclick=clearRow;
$('bHelp').onclick=()=>{audio();sfx.tick();open('oHelp')};$('bStats').onclick=()=>{audio();sfx.tick();showStats()};$('bSet').onclick=()=>{audio();sfx.tick();open('oSet')};
document.querySelectorAll('#modes button').forEach(b=>b.onclick=()=>{audio();sfx.tick();load(b.dataset.mode)});
$('sDaily').onclick=()=>{audio();closeAll();load('daily');if(!S.seenHelp){S.seenHelp=true;save();open('oHelp')}};
$('sPractice').onclick=()=>{audio();closeAll();load('practice');if(!S.seenHelp){S.seenHelp=true;save();open('oHelp')}};
$('sHow').onclick=()=>{audio();S.seenHelp=true;save();open('oHelp')};
addEventListener('keydown',e=>{const anyOpen=OV.some(o=>!$(o).classList.contains('hide'));
 if(e.key==='Escape'){e.preventDefault();if(anyOpen&&$('oStart').classList.contains('hide'))closeAll();else if(!anyOpen){updateStart();open('oStart')}else closeAll();return}
 if(anyOpen){if(e.key==='Enter'&&!$('oStart').classList.contains('hide')){audio();$('sDaily').click()}return}
 audio();
 if(/^[0-9]$/.test(e.key))pick(+e.key);
 else if(e.key==='ArrowLeft'){sel=(sel-1+P.n)%P.n;sfx.tick();render()}
 else if(e.key==='ArrowRight'){sel=(sel+1)%P.n;sfx.tick();render()}
 else if(e.key==='ArrowUp'){e.preventDefault();turn(1)}
 else if(e.key==='ArrowDown'){e.preventDefault();turn(-1)}
 else if(e.key==='Enter'){e.preventDefault();submit()}
 else if(e.key==='Backspace'||e.key==='Delete')clearRow()});
/* how-to-play illustrations */
function drawHelp(){$('demoRing').innerHTML=TH.items.map((s,i)=>'<span title="'+s.w+'">'+face(i)+'</span>').join('');$('helpTheme').textContent=TH.n;
 $('ex').innerHTML=[[4,'g',0],[2,'a',1],[8,'d',-1],[6,'a',-1],[1,'d',1]].map(a=>'<div class="slot '+a[1]+'">'+face(a[0])+(a[2]?'<span class="ar '+(a[2]>0?'up':'dn')+'">'+(a[2]>0?'▲':'▼')+'</span>':'')+'</div>').join('');
 $('exUp').textContent=TH.up;$('exDown').textContent=TH.down}
function updateStart(){const s=S.stats,d=S.daily.day===TODAY&&S.daily.done,th=themeOfDay(TODAY);$('sToday').innerHTML='Today: <b>'+th.vault+'</b><br>'+th.n+'<small>Payout: up to 150 Skyline coins, 37 Slingshot stars or 6 gold in Gamble With Friends</small>';$('sInfo').textContent='Safe #'+TODAY+(d?' · done for today':'')+(s.streak?' · '+s.streak+'-day streak':'');$('sDaily').textContent=d?'See today\'s safe':'Crack today\'s safe'}
applySet();load('daily');updateStart();open('oStart');
window.__TB={possible,get P(){return P},S,judge,pick,submit,load,get cur(){return cur},TODAY,makeCode,mulberry,hash};
})();
