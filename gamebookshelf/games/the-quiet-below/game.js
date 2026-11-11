(function(){'use strict';
/* THE QUIET BELOW — a survival-horror campaign. Plain JS, no dependencies. */
const TAU=Math.PI*2,T=48;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
const randi=(a,b)=>Math.floor(rand(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const dist=(ax,ay,bx,by)=>Math.hypot(bx-ax,by-ay);
const angDiff=(a,b)=>{let d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d;};
const $=id=>document.getElementById(id);
function rng(seed){let s=seed>>>0;return()=>{s=(s+0x6D2B79F5)>>>0;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}

const canvas=$('game'),ctx=canvas.getContext('2d');
let W=0,H=0,DPR=1,zoom=1,UI=1;

/* ---------- persistent store ---------- */
const SAVE_KEY='quietbelow_v1';
const store={settings:{master:.8,music:.6,sfx:.9,mute:false,shake:true,quality:'high'},codex:[],endings:[],bestTime:null,holdoutBest:0,cleared:0,run:null,v:0};
function loadStore(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(s){Object.assign(store.settings,s.settings||{});for(const k of['codex','endings','bestTime','holdoutBest','cleared','run','v'])if(s[k]!==undefined)store[k]=s[k];}}catch(e){}}
function saveStore(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(store));}catch(e){}}
loadStore();

/* ---------- input ---------- */
const keys={},pressed={};
const mouse={x:0,y:0,down:false,rdown:false,wx:0,wy:0,moved:false};
const touch={on:false,mv:{id:null,ox:0,oy:0,x:0,y:0},aim:{id:null,ox:0,oy:0,x:0,y:0}};
addEventListener('keydown',e=>{
  if(['Tab','Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(!keys[e.code])pressed[e.code]=true;keys[e.code]=true;audio.init();onKey(e.code);
});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;mouse.down=false;mouse.rdown=false;if(G.state==='play')pauseGame();});
canvas.addEventListener('mousemove',e=>{mouse.x=e.clientX*DPR;mouse.y=e.clientY*DPR;mouse.moved=true;});
canvas.addEventListener('mousedown',e=>{audio.init();mouse.x=e.clientX*DPR;mouse.y=e.clientY*DPR;if(e.button===0){mouse.down=true;pressed.Mouse0=true;}if(e.button===2){mouse.rdown=true;pressed.Mouse2=true;}});
addEventListener('mouseup',e=>{if(e.button===0)mouse.down=false;if(e.button===2)mouse.rdown=false;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{pressed[e.deltaY>0?'WheelDown':'WheelUp']=true;},{passive:true});
addEventListener('touchstart',()=>{if(!touch.on){touch.on=true;mouse.moved=false;document.body.classList.add('touch');if(G.showMap===undefined)G.showMap=false;}},{capture:true,passive:true});
function stickOf(t){return t.clientX<innerWidth/2?touch.mv:touch.aim;}
canvas.addEventListener('touchstart',e=>{e.preventDefault();audio.init();if(!touch.on){touch.on=true;document.body.classList.add('touch');}
  for(const t of e.changedTouches){const s=stickOf(t);if(s.id===null){s.id=t.identifier;s.ox=t.clientX;s.oy=t.clientY;s.x=0;s.y=0;}}},{passive:false});
canvas.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches){for(const s of[touch.mv,touch.aim]){if(s.id===t.identifier){let x=(t.clientX-s.ox)/56,y=(t.clientY-s.oy)/56;const m=Math.hypot(x,y);if(m>1){x/=m;y/=m;}s.x=x;s.y=y;}}}},{passive:false});
function touchEnd(e){for(const t of e.changedTouches){for(const s of[touch.mv,touch.aim]){if(s.id===t.identifier){s.id=null;s.x=0;s.y=0;}}}}
canvas.addEventListener('touchend',touchEnd);canvas.addEventListener('touchcancel',touchEnd);
document.querySelectorAll('.tbtn').forEach(b=>{const k=b.dataset.k;
  b.addEventListener('touchstart',e=>{e.preventDefault();e.stopPropagation();audio.init();if(!keys[k])pressed[k]=true;keys[k]=true;onKey(k);b.classList.add('on');},{passive:false});
  const up=e=>{e.preventDefault();keys[k]=false;b.classList.remove('on');};b.addEventListener('touchend',up);b.addEventListener('touchcancel',up);});

/* ---------- audio ---------- */
const audio={ctx:null,master:null,musicG:null,sfxG:null,noiseBuf:null,
  init(){
    if(this.ctx){if(this.ctx.state==='suspended')this.ctx.resume();return;}
    try{const AC=window.AudioContext||window.webkitAudioContext;this.ctx=new AC();}catch(e){return;}
    const c=this.ctx;this.master=c.createGain();const comp=c.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=5;
    this.master.connect(comp);comp.connect(c.destination);
    this.musicG=c.createGain();this.sfxG=c.createGain();this.musicG.connect(this.master);this.sfxG.connect(this.master);
    const len=c.sampleRate*2,buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.noiseBuf=buf;
    this.applyVol();music.start();
  },
  applyVol(){if(!this.ctx)return;const s=store.settings;this.master.gain.value=s.mute?0:s.master;this.musicG.gain.value=s.music;this.sfxG.gain.value=s.sfx;}
};
function sfxOut(pan){const c=audio.ctx;if(!pan||!c.createStereoPanner)return audio.sfxG;const p=c.createStereoPanner();p.pan.value=pan;p.connect(audio.sfxG);return p;}
function tone(type,f0,f1,dur,vol,pan,delay,dest){const c=audio.ctx;if(!c||vol<=0)return;const t=c.currentTime+(delay||0);const o=c.createOscillator(),g=c.createGain();o.type=type;
  o.frequency.setValueAtTime(Math.max(1,f0),t);if(f1!==f0)o.frequency.exponentialRampToValueAtTime(Math.max(1,f1),t+dur);
  g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(vol,t+Math.min(0.01,dur*.3));g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g);g.connect(dest||sfxOut(pan));o.start(t);o.stop(t+dur+.05);}
function noise(dur,vol,f0,f1,q,ftype,pan,delay,dest){const c=audio.ctx;if(!c||vol<=0)return;const t=c.currentTime+(delay||0);const s=c.createBufferSource();s.buffer=audio.noiseBuf;s.loop=true;
  const f=c.createBiquadFilter();f.type=ftype||'lowpass';f.Q.value=q||.7;f.frequency.setValueAtTime(f0,t);if(f1!==f0)f.frequency.exponentialRampToValueAtTime(Math.max(20,f1),t+dur);
  const g=c.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(vol,t+Math.min(.01,dur*.2));g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  s.connect(f);f.connect(g);g.connect(dest||sfxOut(pan));s.start(t,Math.random()*1.5);s.stop(t+dur+.05);}
const sfxLast={};
function sfx(name,x,y){
  const c=audio.ctx;if(!c||c.state!=='running')return;const now=c.currentTime;if(sfxLast[name]&&now-sfxLast[name]<.035)return;sfxLast[name]=now;
  let v=1,p=0;if(x!==undefined&&G.p){const dx=x-G.p.x,d=Math.hypot(dx,y-G.p.y);v=clamp(1-d/1000,0,1);v*=v;p=clamp(dx/420,-1,1);if(v<.01)return;}
  switch(name){
    case'pistol':noise(.16,.9*v,3200,500,.7,'lowpass',p);tone('square',220,50,.09,.5*v,p);noise(.5,.16*v,900,200,.5,'lowpass',p,.02);break;
    case'pistol_s':noise(.09,.4*v,1800,600,1,'bandpass',p);tone('sine',160,60,.06,.25*v,p);break;
    case'shotgun':noise(.32,1*v,2400,220,.6,'lowpass',p);tone('sawtooth',130,30,.2,.7*v,p);noise(.9,.22*v,700,120,.4,'lowpass',p,.03);noise(.06,.3,1500,900,2,'bandpass',0,.3);noise(.06,.3,1100,1500,2,'bandpass',0,.45);break;
    case'carbine':noise(.12,.8*v,4000,700,.7,'lowpass',p);tone('square',180,60,.07,.45*v,p);noise(.3,.1*v,800,200,.5,'lowpass',p,.02);break;
    case'empty':tone('square',900,700,.03,.15);break;
    case'reload':noise(.05,.25,2000,1200,3,'bandpass');noise(.05,.3,1400,2200,3,'bandpass',0,.4);break;
    case'reloaded':tone('square',500,300,.03,.12);noise(.05,.3,1800,2600,3,'bandpass');break;
    case'swing':noise(.2,.35,500,2400,1.2,'bandpass');break;
    case'chop':noise(.1,.7,900,200,.8,'lowpass');tone('sine',140,50,.12,.6);break;
    case'hit':noise(.07,.45*v,1400,300,.8,'lowpass',p);tone('sine',180,70,.08,.35*v,p);break;
    case'kill':noise(.25,.5*v,700,120,.7,'lowpass',p);tone('sawtooth',160,40,.35,.3*v,p);break;
    case'hurt':noise(.18,.7,800,200,.7,'lowpass');tone('sawtooth',200,70,.22,.5);break;
    case'step':noise(.05,.11*v,rand(300,500),150,.8,'lowpass',p);break;
    case'stepsnow':noise(.09,.13*v,rand(900,1500),500,.9,'bandpass',p);break;
    case'estep':noise(.05,.1*v,260,120,.8,'lowpass',p);break;
    case'door':noise(.35,.35*v,300,1600,1.5,'bandpass',p);tone('sine',90,60,.3,.25*v,p);break;
    case'denied':tone('square',180,170,.12,.25);tone('square',140,130,.16,.25,0,.14);break;
    case'pickup':tone('triangle',660,990,.09,.25);tone('triangle',990,1320,.1,.2,0,.07);break;
    case'key':tone('triangle',880,880,.08,.25);tone('triangle',1320,1320,.16,.25,0,.09);break;
    case'log':tone('square',520,520,.04,.1);tone('square',780,780,.05,.1,0,.06);noise(.2,.08,3000,2000,2,'bandpass',0,.05);break;
    case'radio':noise(.12,.12,2400,2400,3,'bandpass');tone('sine',1100,1100,.07,.12,0,.1);break;
    case'blip':tone('square',rand(640,700),640,.018,.03);break;
    case'ui':tone('triangle',520,620,.05,.15);break;
    case'uiok':tone('triangle',520,780,.08,.2);tone('triangle',780,1040,.1,.15,0,.06);break;
    case'heal':tone('sine',330,660,.3,.25);noise(.25,.12,2500,4000,2,'bandpass');break;
    case'flare':noise(1.2,.3*v,3500,1800,1,'bandpass',p);tone('sawtooth',90,70,.5,.12*v,p);break;
    case'growl':tone('sawtooth',rand(70,95),45,.5,.32*v,p);noise(.45,.2*v,500,200,2,'bandpass',p);break;
    case'alert':tone('sawtooth',130,260,.18,.3*v,p);tone('sawtooth',260,90,.4,.3*v,p,.16);noise(.5,.2*v,900,400,2,'bandpass',p);break;
    case'skitter':noise(.05,.18*v,2600,1800,4,'bandpass',p);noise(.05,.18*v,2200,1600,4,'bandpass',p,.07);noise(.05,.16*v,2700,1700,4,'bandpass',p,.13);break;
    case'shriek':tone('sawtooth',700,1700,.35,.4*v,p);tone('square',1750,900,.9,.3*v,p,.3);tone('sawtooth',1220,2100,.8,.22*v,p,.2);noise(1.1,.25*v,3000,5000,3,'bandpass',p);break;
    case'spit':noise(.2,.35*v,600,1800,2,'bandpass',p);tone('sine',300,120,.18,.25*v,p);break;
    case'splat':noise(.15,.4*v,1200,250,.8,'lowpass',p);break;
    case'roar':tone('sawtooth',90,50,.9,.5*v,p);tone('square',64,38,.9,.35*v,p);noise(.9,.35*v,400,150,1.5,'bandpass',p);break;
    case'slam':noise(.5,.9*v,500,60,.6,'lowpass',p);tone('sine',90,28,.5,.9*v,p);break;
    case'machine':tone('sawtooth',40,75,1.6,.4);noise(2,.3,200,900,1,'lowpass');tone('square',75,78,1.2,.18,0,1.4);break;
    case'breaker':noise(.08,.6,2500,600,1,'lowpass');tone('square',60,60,.5,.25,0,.05);break;
    case'alarm':tone('square',620,620,.22,.16);tone('square',470,470,.22,.16,0,.26);break;
    case'boom':noise(1.6,1,900,40,.5,'lowpass');tone('sine',70,22,1.4,1);break;
    case'bossdie':tone('sawtooth',400,30,2.4,.5);noise(2.4,.6,2000,80,.6,'lowpass');tone('sine',880,110,2,.25);break;
    case'hum':tone('sine',68,66,1.8,.3*v,p);tone('sine',102,99,1.8,.16*v,p);break;
    case'steam':noise(1.5,.32*v,3200,5200,.8,'highpass',p);noise(1.5,.14*v,900,700,1,'bandpass',p);break;
    case'glass':noise(.07,.22*v,5200,3000,2,'bandpass',p);noise(.05,.16*v,7000,4200,3,'bandpass',p,.035);break;
    case'beat':tone('sine',70,40,.12,.5);tone('sine',64,38,.12,.35,0,.22);break;
  }
}
const music={on:false,tension:0,tt:0,next:0,beat:0,nextPing:0,bus:null,windG:null,filt:null,
  start(){const c=audio.ctx;if(this.on||!c)return;this.on=true;
    const g=c.createGain();g.gain.value=.15;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=170;f.Q.value=2;
    [55,55.4,82.4,110.3].forEach((fr,i)=>{const o=c.createOscillator();o.type=i<2?'sawtooth':'triangle';o.frequency.value=fr;const og=c.createGain();og.gain.value=i<2?.5:.25;o.connect(og);og.connect(f);o.start();});
    const l=c.createOscillator();l.frequency.value=.07;const lg=c.createGain();lg.gain.value=70;l.connect(lg);lg.connect(f.frequency);l.start();
    f.connect(g);g.connect(audio.musicG);
    const n=c.createBufferSource();n.buffer=audio.noiseBuf;n.loop=true;const wf=c.createBiquadFilter();wf.type='bandpass';wf.frequency.value=420;wf.Q.value=.8;
    const wg=this.windG=c.createGain();wg.gain.value=.05;n.connect(wf);wf.connect(wg);wg.connect(audio.musicG);n.start();
    const l2=c.createOscillator();l2.frequency.value=.11;const l2g=c.createGain();l2g.gain.value=220;l2.connect(l2g);l2g.connect(wf.frequency);l2.start();
    const d=c.createDelay(1);d.delayTime.value=.42;const fb=c.createGain();fb.gain.value=.45;d.connect(fb);fb.connect(d);const dg=c.createGain();dg.gain.value=.5;d.connect(dg);dg.connect(audio.musicG);
    this.bus=c.createGain();this.bus.connect(audio.musicG);this.bus.connect(d);
    this.filt=c.createBiquadFilter();this.filt.type='lowpass';this.filt.frequency.value=420;this.filt.connect(audio.musicG);
    this.next=c.currentTime+.1;this.nextPing=c.currentTime+2;
  },
  wind(v){if(this.windG)this.windG.gain.setTargetAtTime(v,audio.ctx.currentTime,.8);},
  ping(f,t,v){const c=audio.ctx;const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0.0001,t);g.gain.linearRampToValueAtTime(v,t+.02);g.gain.exponentialRampToValueAtTime(0.0001,t+2.6);o.connect(g);g.connect(this.bus);o.start(t);o.stop(t+2.7);},
  update(dt){const c=audio.ctx;if(!this.on||!c||c.state!=='running')return;
    this.tension+=(this.tt-this.tension)*Math.min(1,dt*1.3);const now=c.currentTime,tv=this.tension;
    if(now>this.nextPing){const sc=[220,261.6,293.7,329.6,392,440,523.3];const f=pick(sc)*(Math.random()<.3?.5:1);this.ping(f,now+.05,.07*(1-tv*.6));if(Math.random()<.4)this.ping(f*1.5,now+.4,.035);this.nextPing=now+rand(3.5,8);}
    const step=.214;if(this.next<now)this.next=now+.03;
    while(this.next<now+.15){
      if(tv>.08){const b=this.beat%16,t=this.next-now;const mul=(b===6||b===14)?1.19:(b===11)?.89:1;
        tone('sawtooth',55*mul,55*mul,.17,tv*.5,0,t,this.filt);
        if(b%4===0)tone('sine',120,40,.2,tv*.55,0,t,audio.musicG);
        if(b%4===2&&tv>.45)noise(.07,tv*.16,3000,1500,1,'highpass',0,t,audio.musicG);
        if(tv>.75&&b%2===1)noise(.03,tv*.07,6000,5000,1,'highpass',0,t,audio.musicG);
      }
      this.beat++;this.next+=step;
    }
  }
};

/* ================= STORY DATA ================= */
const WHO={
  REYES:{n:'REYES · AURELIAN DISPATCH',c:'#ffb14a'},BRANDT:{n:'DR. ILSE BRANDT',c:'#7fe3d0'},MARROW:{n:'MARROW',c:'#e6edf3'},
  HALVARD:{n:'DIRECTOR HALVARD',c:'#3fffd0'},CARROW:{n:'V. CARROW · MERIDIAN',c:'#c9a0ff'},SYS:{n:'STATION SYSTEM',c:'#ff6a4a'},AAS:{n:'BENEDIKT AAS · COOK',c:'#e8c98a'}
};
const INTRO=[
  ['EAST ANTARCTICA · 78° SOUTH','June 23rd. Midwinter.\nThe sun set in April. It will not rise again until August.'],
  ['HALVARD DEEP FIELD STATION','The station sits on three kilometres of ice. Beneath the ice is Lake Sørensen — liquid water, sealed from the sky for fourteen million years.\n\nThirty-one people stayed the winter to drill into it.'],
  ['NINETEEN DAYS OF SILENCE','On June 4th the station stopped answering the radio. No distress call. No beacon. The carrier signal is still up.\n\nSomeone just isn\'t talking.'],
  ['RESCUE TWO','Camp Aurelian sent the only aircraft that could fly the dark. Four crew. Ninety minutes out, the whiteout took the tail rotor.'],
  ['WARRANT OFFICER KIT MARROW','Search and rescue. Eleven winters on the ice.\n\nYou are the one who woke up.']
];
const LOGS={
  manifest:{t:'Flight Manifest — Rescue Two',a:'Camp Aurelian Flight Ops',d:'June 23',x:'CREW: Dahl, H. (pilot). Okoro, S. (flight medic). Pell, A. (winch). Marrow, K. (SAR tech).\n\nTASKING: Welfare check, Halvard Deep Field Station. 31 souls, 19 days no contact. Requested by Meridian Polar Consortium.\n\nNOTE FROM CLIENT: Crew are not to enter Lab Wing C without liaison clearance. Any biological material found on site remains Consortium property.\n\nHandwritten underneath, Dahl\'s writing: "Who asks for a rescue and then tells you which rooms not to rescue?"'},
  gennote:{t:'Note Taped to the Generator',a:'Benedikt Aas, station cook',d:'June 9',x:'If you are reading this, the main bus is off ON PURPOSE.\n\nThey come to noise. The generator, the snowcat, us. Duke was the first to stop talking. Then he stood at the drill hall door for two days, facing it, like a dog waiting on someone.\n\nI shut the power down tonight. It is quieter and they have mostly stopped walking.\n\nStart this machine and you had better be ready to run.\n\n— Benny'},
  snowcat:{t:'Vehicle Log — Snowcat 2',a:'Jonas Weller, comms',d:'June 8',x:'Tried to take the cat to the coast. Eleven hundred kilometres, I know. I would rather die driving.\n\nFuel pump relays are gone. Both cats. The Director pulled them himself and he does not hide it.\n\nHe says nobody leaves until the sample is on an aircraft. He says it the way you would mention the weather.'},
  roster:{t:'Winter-Over Roster',a:'Station office',d:'June',x:'31 names, typed. Most have a pencil stroke through them.\n\nIn the margin someone has been keeping count:\n\nQUIET: 11\nMISSING: 6\nUS: 14\n\nThe last line has been rubbed out and rewritten three times. It currently reads:\n\nUS: 5'},
  aasjournal:{t:'Personal Journal',a:'Benedikt Aas',d:'June 11',x:'Counted nine of them in the corridor this morning. Every one facing east-south-east. I checked against the fire plan. They are facing the borehole. Different rooms, different walls between, all pointed at the same spot like compass needles.\n\nIlse says for them it is downhill. She says it is the direction home is in.\n\nI asked whose home. She did not answer, and Ilse always answers.'},
  whiteboard:{t:'Mess Hall Whiteboard',a:'Survivors',d:'undated',x:'RULES\n\n1. SOCKS ONLY. No boots indoors.\n2. NO GENERATOR.\n3. No torches in their faces. The eyes react.\n4. If one of them SCREAMS you have ten seconds. Use them.\n5. Do not call them by their names. It does not help, and you will want it to.'},
  med1:{t:'Medical Log',a:'Dr. Priya Raman',d:'June 5',x:'Six drill crew presenting together. Hyperacusis — severe sensitivity to sound. Progressive mutism. Core temperature 31°C and yet they are on their feet, which should not be possible.\n\nFine grey filaments visible in the cornea under the slit lamp.\n\nThey are not in pain. I have asked. They do not seem to be anywhere near pain.\n\nThey are listening to something.'},
  med2:{t:'Medical Log',a:'Dr. Priya Raman',d:'June 7',x:'Okafor flinched at a pen click from two rooms away.\n\nIn silence they stand still. I have walked past four of them in my socks and none turned. A dropped tray brought every one of them through the door.\n\nA torch held on the eyes does the same thing after a second or so — the filaments in the cornea react to bright light. A quick sweep is tolerated. Do not hold it on them.\n\nI have requested quarantine and evacuation. The Director has declined both.'},
  memo:{t:'Memo to All Staff',a:'Dir. Aksel Halvard',d:'June 6',x:'Colleagues,\n\nThe illness among drill staff is a routine winter virus aggravated by fatigue. Dr. Raman is managing it.\n\nThe sample return timeline is unchanged. Meridian\'s aircraft will arrive at first flying weather.\n\nSpeculation damages morale. Unauthorised radio traffic will be treated as a disciplinary matter.\n\nWe are here to do something that has never been done. Please remember that.'},
  comms:{t:'Unsent Message — Comms Console',a:'Jonas Weller',d:'June 9',x:'MAYDAY MAYDAY MAYDAY Halvard Station to any station.\n\nEleven crew infected with unknown organism from the borehole. Director is concealing it. We need evacuation and we need it sealed.\n\n[TRANSMIT FAILED — NO ANTENNA]\n\nHe cut the feed at the mast junction. The carrier is still up, so Aurelian thinks we are fine and just being rude.\n\nMy lab-wing card is in the top drawer if anyone still wants to try Ilse\'s way.'},
  assay:{t:'S-7 Initial Assay',a:'Dr. Ilse Brandt',d:'June 4',x:'Sample S-7, lake water, 3,104 m.\n\nFilamentous structures, 2–4 microns. Every strand sequenced so far is genetically identical. Every strand conducts.\n\nI expected a lake full of microbes. That is not what this is.\n\nThe lake is not full of life. The lake is one life.\n\nI am calling it the Lattice until someone senior tells me to stop.'},
  behaviour:{t:'S-7 Behaviour Notes',a:'Dr. Ilse Brandt',d:'June 6',x:'It grows toward vibration. A tuning fork beside the dish and the filaments lean to it inside a minute.\n\nOf course they do. There is no light down there. No chemistry worth following. For an organism in a sealed, black lake, sound is the only sense there is.\n\nIt has had fourteen million years of silence with only itself to listen to.\n\nThen we arrived with a hot-water drill.'},
  host:{t:'Host Colonisation',a:'Dr. Ilse Brandt',d:'June 8',x:'Route in: aerosolised meltwater from the drill return hose.\n\nIt takes the auditory nerve first. Then motor cortex. Metabolism falls to almost nothing — that is why the cold does not kill them.\n\nPriya keeps saying "the bodies." They are not bodies. Hearts beat. Eyes track.\n\nThey are instruments. It is using them to hear the surface.\n\nThe thin ones with the split jaws are the worst. One call from those and every instrument in the building turns.'},
  compound:{t:'Compound 12',a:'Dr. Ilse Brandt',d:'June 10',x:'Antifungal plus a calcium channel blocker. Slows filament conduction by about 80%. It is not a cure. It is a pause.\n\nDosed a subject at 0400.\n\nYes. The subject is me. Day six since exposure and I can still say my own name out loud.\n\nSmall victories.'},
  carrow:{t:'RE: RE: Status of S-7',a:'Vivian Carrow, Meridian Polar Consortium',d:'June 9',x:'Aksel,\n\nThe board regards S-7\'s neural regeneration properties as the most valuable biological discovery of this century.\n\nPreservation of a viable sample is priority one.\n\nPersonnel matters are to be handled locally and are not to be discussed on open channels. Our aircraft will come when the sample is ready to travel, and not before.\n\nI trust that is clear.\n\nV.'},
  coldtag:{t:'Cold Storage Tag',a:'Lab Wing C',d:'June 5',x:'S-7 VIABLE CORE — TRANSIT CANISTER\n\nStore at 4°C.\nDo not agitate.\nDo not expose to sound above 60 dB.\n\nUnderneath, in marker: "Empty. He took it back down with him. He said it was homesick."'},
  drill1:{t:'Drill Log',a:'Chief Oduya "Duke" Okafor',d:'June 3',x:'2,987 metres.\n\nTomorrow we touch water that nothing has touched since before there were people. The lads want to sign the casing before it goes down. I said yes.\n\nHalvard came out and stood by the rig for an hour without a word. His wife died in the spring. I think this hole is the only thing holding the man up.'},
  drill2:{t:'Drill Log',a:'Chief Oduya "Duke" Okafor',d:'June 4',x:'Breakthrough at 14:10.\n\nPressure surge on the return line. Hose came off the reel and soaked six of us before we got it shut. Water was full of grey thread, fine as hair.\n\nFelt something when we broke through. In my teeth. Like a note too low to hear.\n\nCan still feel it now, writing this. It is not unpleasant.'},
  halvardtape:{t:'Audio Transcript',a:'Dir. Aksel Halvard',d:'June 10',x:'"...it is not killing them. Listen to me. An organism that rebuilds nerve tissue. Do you understand what that is?\n\nMarit could not hold a spoon by the end. Eleven months. I fed her.\n\nI am not sealing that hole, Priya. I am not doing it. You can write that down."\n\n[A second voice, inaudible.]\n\n"Then they will be the price of it. Something like this always has a price."'},
  lifttag:{t:'Lift Maintenance Placard',a:'Meridian Engineering',d:'—',x:'CAISSON SCUTTLE SYSTEM\n\nThermal charges ×12 fitted at the wellhead under the Antarctic Treaty environmental protocol, to seal the borehole and protect Lake Sørensen from contamination by surface organisms.\n\nINTERLOCK: charges will not arm while a core is seated in the wellhead.\n\nScratched below with a knife: "Nobody thought about contamination coming the other way."'},
  scrawl:{t:'Written on the Drill Casing',a:'unknown',d:'undated',x:'Thirty-one signatures in paint marker, from the day before breakthrough. Jokes. A drawing of a penguin.\n\nOver the top of them, bigger, in something darker:\n\nIT CAN HEAR THE DRILL\nIT THINKS THE DRILL IS A VOICE\nIT IS ANSWERING'},
  brandttape:{t:'Recorder Taped to the Lift Rail',a:'Dr. Ilse Brandt',d:'June 20',x:'"For whoever goes down.\n\nI have not been honest about how far along I am. When I miss a dose I can hear the lake from my lab. Three kilometres of ice and I can hear it.\n\nIt is not angry. Please understand that before you do what you have to do. It is not anything we have a word for.\n\nIt is lonely the way gravity is heavy."'},
  notebook1:{t:'Caisson Notebook',a:'Dir. Aksel Halvard',d:'June 12',x:'Came down alone. Sat by the wellhead and spoke to it. Felt foolish for perhaps a minute.\n\nIt learned my name before I had finished saying it. The water said it back — not a voice, a pressure, a shape in the chest.\n\nThen it said Marit\'s.\n\nI never told it about Marit.'},
  notebook2:{t:'Caisson Notebook',a:'Dir. Aksel Halvard',d:'June 15',x:'Eleven of the crew came down the shaft on their own. Two hours on the ladder, no gloves. They stand in the west gallery and hum.\n\nI have stopped taking Ilse\'s compound. It is like listening to an orchestra through a wall.\n\nSomeone ought to hear this properly.'},
  acoustic:{t:'Acoustic Survey Printout',a:'Hydrophone array',d:'June 4 – 18',x:'BASELINE: 17 Hz, continuous. Stable for the entire survey record.\n\nJUNE 4 +: pattern changes. Matches drill motor rhythm.\n\nJUNE 9 +: matches cadence of human speech. No words. Only the rise and fall.\n\nJUNE 16 +: thirty-one distinct cadences catalogued.\n\nPencilled at the bottom: "It is practising."'},
  carrowmsg:{t:'Priority Message to Rescue Two',a:'Vivian Carrow',d:'June 23',x:'Warrant Officer Marrow,\n\nI am told you have reached the station. That is remarkable and I mean it.\n\nA Consortium aircraft is holding at the coast. It will launch the moment you confirm that the S-7 core is in your possession and intact.\n\nTo be plain, since we are both practical people: it will not launch otherwise.\n\nBring it home and you will never need to work another winter.'},
  lastfile:{t:'Brandt — Last File',a:'Dr. Ilse Brandt',d:'June 23',x:'Everything is on the comms server. Priya\'s logs. Jonas\'s mayday. Carrow\'s orders. The formula for Compound 12.\n\nIf you have gathered enough of it, the mast can push it out on the open band. Every station on the continent will have it before Meridian can pick up a telephone.\n\nCarrow can out-lawyer one rescue tech.\n\nShe cannot out-lawyer every radio in the southern hemisphere.'}
};
const BENNY_END={scuttle:'You do not make the walk alone. Benedikt Aas carries the flares and says nothing at all for forty kilometres. At Depot Nine he takes his boots off before he goes inside.',
  extract:'Benedikt Aas sat across from you the whole flight with his hands over his ears. He would not look at the canister. He would not look at you either.',
  transmit:'Benedikt Aas reads the names at the inquiry, all thirty-one, from memory. He opens a restaurant in Tromsø the following year. It is, people say, a very quiet place.'};
let LOG_ORDER=Object.keys(LOGS);
const TESTIMONY_NEED=24;
const ENDINGS={
  scuttle:{t:'ENDING · SILENCE',x:'Twelve thermal charges fire in sequence. Three kilometres of meltwater shaft closes like a wound.\n\nYou walk forty kilometres to the fuel cache at Depot Nine. Aurelian finds you three days later, frostbitten and still carrying the ice axe.\n\nThe Consortium inquiry records a catastrophic equipment failure. Thirty-one names go on a brass plate in Hobart. Yours is not asked for, and you do not offer it.\n\nUnder the ice, something that learned thirty-one voices has them still. It will not hear another for a very long time.\n\nYou tell yourself that is mercy. Most nights you believe it.'},
  extract:{t:'ENDING · VIABLE',x:'The aircraft lands on skis exactly when Carrow said it would. Nobody aboard asks what happened to the station. They ask whether the canister was kept cold.\n\nYou are paid. You sign what you are told to sign.\n\nEighteen months later Meridian announces human trials of a therapy for degenerative nerve disease. The share price triples. You watch it on a television in a bar in Christchurch.\n\nOn the flight north, you noticed the loadmaster had stopped talking somewhere over the Southern Ocean.\n\nYou told yourself he was tired.\n\nHe was sitting very still, facing the cargo.'},
  transmit:{t:'ENDING · OPEN BAND',x:'The mast lights up for the first time in nineteen days. Raman\'s logs, Weller\'s mayday, Carrow\'s orders and the formula for Compound 12 go out on every frequency the station has.\n\nThen the charges fire, and the hole is closed.\n\nVostok hears it. McMurdo hears it. A Chilean trawler hears it. By the time Meridian\'s lawyers wake up, it is in nine languages.\n\nThe Consortium does not survive the inquiry. Lake Sørensen becomes a protected site. Nobody drills.\n\nThe last thing on the tape is Ilse Brandt saying her own name, clearly, twice.\n\nOnce a year a hydrophone on the surface records a hum at 17 hertz. Some years, the technicians say, it sounds like it is counting.'}
};

/* ================= GAME DATA ================= */
const WEAP={
  pistol:{id:'pistol',name:'P9 SERVICE PISTOL',mag:12,rate:.2,dmg:27,pellets:1,spread:.03,noise:540,reload:1.25,ammo:'a9',auto:false,range:900,shake:3,snd:'pistol',len:13},
  shotgun:{id:'shotgun',name:'M590 SHOTGUN',mag:6,rate:.85,dmg:14,pellets:8,spread:.15,noise:800,reload:2.1,ammo:'sh',auto:false,range:520,shake:9,snd:'shotgun',len:26},
  carbine:{id:'carbine',name:'K2 CARBINE',mag:24,rate:.105,dmg:22,pellets:1,spread:.055,noise:660,reload:1.8,ammo:'rf',auto:true,range:1000,shake:3.5,snd:'carbine',len:24}
};
const AMMO_NAME={a9:'9mm',sh:'12g',rf:'5.56'};
const UPGRADES=[
  {id:'supp',n:'Suppressor',d:'Pistol shots are far quieter.',c:[70]},
  {id:'soles',n:'Felt Overboots',d:'Footsteps make 35% less noise per level.',c:[50,90]},
  {id:'parka',n:'Armoured Parka',d:'+25 max health per level.',c:[60,100,150]},
  {id:'lens',n:'Wide Lens',d:'Wider, longer flashlight beam.',c:[50,90]},
  {id:'axe',n:'Weighted Axe',d:'+40% axe damage per level.',c:[50,90]},
  {id:'mags',n:'Extended Magazines',d:'+33% magazine size, all firearms.',c:[80]},
  {id:'choke',n:'Shotgun Choke',d:'Tighter spread, +20% pellet damage.',c:[90]},
  {id:'medic',n:'Trauma Kit',d:'Medkits heal 50% more.',c:[70]},
  {id:'pouch',n:'Flare Pouch',d:'Carry +2 flares per level, and restock 2 now.',c:[40,70]},
  {id:'lungs',n:'Conditioning',d:'+40% stamina and faster recovery.',c:[60]}
];
const DIFFS={
  story:{n:'STORY',d:'Tougher skin, duller ears. For the lore.',hp:.8,dmg:.55,hear:.85,loot:1.4},
  standard:{n:'STANDARD',d:'The intended experience.',hp:1,dmg:1,hear:1,loot:1},
  whiteout:{n:'WHITEOUT',d:'They hear everything. Supplies are thin.',hp:1.25,dmg:1.45,hear:1.25,loot:.7}
};
const ET={
  husk:{r:14,hp:62,spd:100,dmg:14,name:'Husk'},
  crawler:{r:11,hp:34,spd:205,dmg:9,name:'Crawler'},
  screamer:{r:13,hp:44,spd:78,dmg:8,name:'Caller'},
  spitter:{r:15,hp:74,spd:72,dmg:14,name:'Spitter'},
  brute:{r:23,hp:360,spd:86,dmg:26,name:'Brute'},
  boss:{r:56,hp:1250,spd:0,dmg:20,name:'The Chorus'}
};

/* ---------- level builder ---------- */
function Builder(w,h,fill){this.w=w;this.h=h;this.g=new Array(w*h).fill(fill);this.ents=[];this.start=[1,1];this.spawns=[];}
Builder.prototype={
  set(x,y,c){if(x>=0&&y>=0&&x<this.w&&y<this.h)this.g[y*this.w+x]=c;},
  get(x,y){return(x<0||y<0||x>=this.w||y>=this.h)?' ':this.g[y*this.w+x];},
  fill(x,y,w,h,c){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.set(i,j,c);},
  room(x,y,w,h,c){for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)this.set(i,j,(i===x||j===y||i===x+w-1||j===y+h-1)?'#':(c||'.'));},
  blob(cx,cy,r,c){for(let j=Math.floor(cy-r);j<=Math.ceil(cy+r);j++)for(let i=Math.floor(cx-r);i<=Math.ceil(cx+r);i++){if(i<1||j<1||i>this.w-2||j>this.h-2)continue;if((i-cx)*(i-cx)+(j-cy)*(j-cy)<=r*r)this.set(i,j,c||',');}},
  cave(pts,r,c){for(let k=0;k<pts.length-1;k++){const a=pts[k],b=pts[k+1],n=Math.ceil(dist(a[0],a[1],b[0],b[1])*2);for(let s=0;s<=n;s++)this.blob(lerp(a[0],b[0],s/n),lerp(a[1],b[1],s/n),r,c);}},
  props(c,l){for(const p of l)this.set(p[0],p[1],c);},
  door(x,y,lock){this.set(x,y,'.');this.ents.push({k:'door',x,y,lock:lock||null});},
  en(type,l){for(const p of l)this.ents.push({k:'enemy',type,x:p[0],y:p[1]});},
  item(type,l,id){for(const p of l)this.ents.push({k:'item',type,x:p[0],y:p[1],id});},
  light(kind,l,powered){for(const p of l)this.ents.push({k:'light',kind,x:p[0],y:p[1],powered:!!powered});},
  log(id,x,y){this.ents.push({k:'item',type:'log',id,x,y});},
  use(id,x,y,label,kind,enabled){this.ents.push({k:'use',id,x,y,label,kind:kind||'console',enabled:enabled!==false});},
  radio(id,x,y,r){this.ents.push({k:'radio',id,x,y,r:r||130});}
};

/* ---------- levels ---------- */
const LEVELS=[
/* 1 */{name:'WHITEOUT',sub:'Surface · 400 m west of Halvard Station',theme:'surface',amb:[46,58,82],size:[56,24,'^'],wind:.16,
  build(b){
    b.blob(6,5,4.2);b.cave([[6,5],[16,6],[24,8],[34,6],[44,8]],3.2);b.cave([[24,8],[20,14],[19,18]],3);
    b.cave([[44,8],[51,10],[52,17],[46,21],[30,21],[20,19]],2.4);b.fill(40,7,10,5,',');b.fill(19,13,5,7,',');
    b.room(40,1,11,6);b.room(24,12,16,8);b.room(39,12,10,8);b.room(48,13,6,6,':');
    b.door(45,6);b.door(24,16);b.door(39,16);b.door(44,12);b.door(48,16);
    b.props('H',[[3,3],[4,3],[5,3],[3,4],[4,4]]);b.start=[6,6];
    b.item('weapon',[[8,5]],'pistol');b.log('manifest',6,3);b.item('flare',[[9,7]]);b.item('a9',[[10,4]]);
    b.light('f',[[5,4]]);b.radio('husk',15,6,150);
    b.en('husk',[[27,8],[36,6],[21,16],[47,4],[30,16],[35,14],[45,16]]);
    b.props('M',[[41,2],[42,2]]);b.props('O',[[49,2],[48,2],[44,5]]);b.use('generator',42,3,'START GENERATOR','generator');
    b.log('gennote',43,3);b.item('a9',[[48,4]]);b.item('salvage',[[49,5]]);
    b.props('C',[[27,14],[28,14],[27,17],[32,13],[33,17],[34,17]]);b.props('O',[[37,13],[38,13]]);b.props('K',[[25,13],[26,13]]);
    b.log('snowcat',36,17);b.item('a9',[[37,18]]);b.item('flare',[[33,14]]);b.item('salvage',[[25,18]]);
    b.props('T',[[42,18],[43,18]]);b.props('K',[[40,13],[41,13]]);b.item('med',[[41,15]]);b.item('salvage',[[46,18]]);
    b.use('airlock',51,16,'CYCLE AIRLOCK','console');
    b.light('a',[[26,15],[36,15]],true);b.light('w',[[44,15],[45,3]],true);b.light('r',[[51,14]]);b.light('r',[[46,9]]);
    b.spawns=[[30,21],[52,10],[20,19],[34,5],[12,6]];
  },
  decor(g){drawWreck(g,4.2*T,3.9*T);},
  onStart(){
    setObj('Reach Halvard Station',[51,16]);
    scene('l1',[[5,4],'p',[27,8]],()=>{say('REYES','Rescue Two, Aurelian. Your beacon just came back up. Kit — talk to me.');
    say('MARROW','Dahl, Okoro and Pell are gone, Tomas. Aircraft is a write-off.');
    say('REYES','...Copy. Station is four hundred metres east. Find the survival kit, it\'s orange, it should have thrown clear. Then get indoors.');},{intro:[5,4],introT:2.2});
    hint('WASD move · MOUSE aim · SHIFT sprint',7,'LEFT THUMB moves · RIGHT THUMB aims · RUN to sprint');
  },
  onRadio(id){if(id==='husk'){
    scene('l1h',[[27,8]],()=>{say('REYES','Thermal shows people standing outside the station. Standing, Kit. In minus sixty.');
    say('MARROW','I see one. No hood, no gloves. He\'s just... facing the building.');});
    hint('C — SNEAK. They hunt by sound. RIGHT-CLICK — ice axe. Hit a still one from behind for a silent kill.',10,'SNEAK — they hunt by sound. AXE a still one from behind for a silent kill.');}},
  onUse(u){
    if(u.id==='generator'){u.done=true;u.enabled=false;G.flags.power=true;sfx('machine');powerOn();addShake(8);emitNoise(u.x,u.y,1500,'machine');
      for(const s of this.spawnList.slice(0,3+(G.diffId==='whiteout'?1:0))){const e=spawnEnemy('husk',s[0]*T+24,s[1]*T+24);alertEnemy(e,true);}
      scene(null,['p',[33,9]],()=>{say('MARROW','Generator\'s up. Lights are coming on.');say('REYES','Kit. Every heat signature out there just turned toward you.');});
      setObj('Get to the airlock',[51,16]);}
    if(u.id==='airlock'){if(!G.flags.power){sfx('denied');toast('NO POWER — MAIN BUS IS DEAD');if(!G.flags.told){G.flags.told=1;say('REYES','No power? There\'s a generator shed on the north side of the yard.');setObj('Restore power — generator shed, north',[42,3]);}}
      else completeLevel();}
  },
  onPickup(it){if(it.id==='pistol'){say('MARROW','Got the kit. Pistol, one magazine. Flares.');hint('LEFT-CLICK fire · R reload · G throw flare (lures them) · F flashlight',9,'Push the RIGHT THUMB to the edge to fire · FLARE lures them away');}}
},
/* 2 */{name:'THE HABITAT',sub:'Crew ring · Emergency lighting only',theme:'station',amb:[25,31,44],size:[60,31,' '],wind:.035,
  build(b){
    b.room(4,15,52,5,'.');b.room(4,6,10,10,',');b.room(13,6,10,10,',');b.room(22,4,16,12,'.');b.room(37,6,11,10,',');b.room(47,6,9,10,'.');
    b.room(4,19,12,11,',');b.room(15,19,9,11,'.');b.room(23,19,12,11,',');b.room(34,19,10,11,'.');b.room(43,19,13,11,':');b.room(55,14,5,7,':');
    for(const d of[[9,15],[17,15],[27,15],[33,15],[42,15],[9,19],[19,19],[28,19],[38,19],[49,19],[13,10],[37,10],[34,24]])b.door(d[0],d[1]);
    b.door(51,15,'yellow');b.door(55,17,'red');b.start=[6,17];
    b.props('e',[[5,7],[5,9],[5,11],[12,7],[12,9],[12,11],[14,7],[14,9],[14,11],[21,7],[21,9],[21,11]]);b.props('K',[[8,7],[9,7],[17,7]]);
    b.en('husk',[[8,10],[17,9],[18,12],[24,6],[35,9],[42,11],[20,17],[36,16],[46,18],[19,24],[31,26],[40,23]]);
    b.en('screamer',[[29,8],[52,17]]);b.en('crawler',[[12,26],[6,27],[25,27],[49,24],[53,27],[45,28]]);
    b.log('roster',10,13);b.item('a9',[[11,13],[22,21],[48,13],[44,20]]);b.item('key',[[19,8]],'yellow');b.log('aasjournal',15,13);
    b.item('salvage',[[20,13],[54,13],[5,28],[20,25],[41,27],[54,28]]);
    b.props('T',[[26,7],[27,7],[26,10],[27,10],[32,7],[33,7],[32,10],[33,10],[42,7],[8,23],[9,23],[8,24],[9,24],[28,23],[29,23],[37,22],[38,22],[37,25],[38,25],[46,22],[47,22],[48,22],[51,22],[52,22],[46,26],[47,26],[51,26],[52,26]]);
    b.log('whiteboard',30,5);b.radio('mess',30,13,150);b.item('med',[[36,5],[39,13],[22,28],[35,28]]);b.item('flare',[[23,13],[13,21],[54,20]]);
    b.props('e',[[38,8],[38,11],[46,8],[46,11]]);b.log('med1',41,8);b.log('med2',45,13);
    b.props('K',[[48,7],[49,7],[50,7]]);b.item('weapon',[[53,8]],'shotgun');b.item('sh',[[52,13],[54,10],[16,28]]);b.log('memo',51,10);
    b.props('C',[[12,16],[30,18],[44,16],[16,21],[17,21],[21,23],[22,23],[16,25],[17,26],[21,27],[13,27],[14,27]]);
    b.props('S',[[24,20],[25,20],[26,20],[33,20],[33,21]]);b.item('key',[[30,24]],'red');b.log('comms',27,24);b.props('O',[[42,20],[42,21]]);
    b.use('exit',57,17,'OPEN THE LAB WING BULKHEAD','console');b.radio('benny',41,26,105);
    b.light('a',[[10,17],[26,17],[42,17],[10,24]]);b.light('r',[[54,17],[51,9],[57,15]]);b.light('w',[[30,9],[42,10],[29,22]]);b.light('t',[[32,27],[49,25]]);
  },
  onStart(){setObj('Search the habitat for survivors',null);
    scene('l2',[[22,17],'p'],()=>{say('REYES','Kit, you\'re breaking up. That hull is eating your signal. I\'ll hold the channel open as long as I...');say('MARROW','Tomas? ...Dispatch?');},{intro:[36,16],introT:1.8});
    hint('TAB — codex. Read what the crew left behind.',7,'Pause to open the codex and read what the crew left behind.');G.npc=makeNpc(41,26);},
  onRadio(id){
    if(id==='benny'&&G.npc&&G.npc.state==='wait'){G.npc.state='follow';sfx('uiok');
      scene(null,[[41,26]],()=>{say('AAS','Don\'t— oh. Oh, you\'re real. And you\'re wearing BOOTS, you maniac. Benny. Cook. Fourteen days in a pantry.');
      say('BRANDT','Benedikt. Stay behind the rescue tech and do exactly what they do.');say('AAS','Ilse says that like I have other plans.');});
      setObj(G.p.keys.red?'Escort Benny to Lab Wing C':'Find Weller\'s red keycard — Comms Room',G.p.keys.red?[57,17]:[30,24]);hint('Benny follows you and copies your pace. Sneak and he sneaks. Keep them off him.',9);}
    if(id==='mess'){
    scene('l2m',[[30,8],[30,8],[30,24]],()=>{say('BRANDT','Stop. Stop walking. ...Good. You are the first person through that airlock in two weeks who still walks like a person.');
    say('BRANDT','Ilse Brandt. Microbiology. I\'m sealed in Lab Wing C, east end. I can see you on the mess camera.');
    say('BRANDT','The wing door takes a red card. Jonas Weller had one. Comms room, south side. Walk softly. They can\'t see worth a damn, but they hear everything.');});
    setObj('Find Weller\'s red keycard — Comms Room',[30,24]);}},
  onPickup(it){
    if(it.type==='key'&&it.id==='red'){say('BRANDT','That\'s the card. East end of the main corridor. And — whoever you are — thank you for coming.');setObj('Reach Lab Wing C — east end of corridor',[57,17]);
      if(G.npc&&G.npc.state==='wait'){say('BRANDT','One more thing. Kitchen camera, the room next to you. Someone in there is breathing. I think it is Benedikt.');setObj('Reach Lab Wing C — a survivor is in the kitchen (optional)',[41,25]);hint('OPTIONAL — reach the survivor in the kitchen and bring him to the Lab Wing door.',8);}}
    if(it.type==='key'&&it.id==='yellow')toast('SECURITY OFFICE UNLOCKED');
    if(it.id==='shotgun')say('MARROW','Twelve gauge. Loud enough to wake the whole ring. Last resort.');},
  onUse(u){if(u.id!=='exit')return;const n=G.npc;
    if(n&&n.state==='follow'){if(dist(n.x,n.y,G.p.x,G.p.y)>340){if(!G.flags.warned){G.flags.warned=1;sfx('denied');toast('BENNY IS NOT WITH YOU — USE AGAIN TO LEAVE HIM');return;}}
      else{G.upg.benny=1;G.p.salvage+=60;G.p.medkits=Math.min(5,G.p.medkits+1);}}
    completeLevel();},
  onNpcDead(){say('BRANDT','...Benedikt. No. Keep moving. Please, just keep moving.');setObj('Reach Lab Wing C — east end of corridor',[57,17]);},
  update(dt){updateNpc(dt);}
},
/* 3 */{name:'LAB WING C',sub:'Microbiology · Containment breached',theme:'lab',amb:[24,33,42],size:[58,38,' '],wind:.025,
  build(b){
    b.room(2,4,54,5,'.');b.room(50,4,6,30,'.');b.room(2,29,54,5,'.');b.fill(50,5,1,3,'.');b.fill(50,30,1,3,'.');b.fill(51,29,4,1,'.');
    b.room(2,8,16,11,',');b.room(2,18,16,12,':');b.room(17,8,15,11,',');b.room(17,18,15,12,'.');b.room(31,8,20,10,',');b.room(36,17,10,7,',');b.room(31,23,20,7,'.');b.room(50,33,6,5,':');
    b.fill(51,8,4,1,'.');b.fill(51,29,4,1,'.');
    b.props('G',[[39,17],[40,17],[41,17]]);
    for(const d of[[9,8],[24,8],[40,8],[9,29],[24,29],[40,29],[50,12],[50,26],[9,18],[24,18],[17,13]])b.door(d[0],d[1]);
    b.door(53,33,'blue');b.start=[4,6];
    b.en('husk',[[20,5],[52,14],[9,13],[15,16],[24,13],[25,25],[44,12],[36,27]]);b.en('spitter',[[44,6],[53,20],[29,16],[45,26]]);
    b.en('crawler',[[30,31],[33,30],[20,31],[7,26],[11,25],[15,20]]);b.en('screamer',[[44,31],[29,27]]);
    b.props('C',[[12,5],[36,7],[51,16],[54,24],[40,26],[41,26]]);
    b.props('T',[[5,11],[6,11],[7,11],[11,11],[12,11],[13,11],[5,15],[6,15],[12,15],[13,15],[20,10],[21,10],[22,10],[27,10],[28,10],[20,15],[21,15],[27,15],[28,15],[27,21],[28,21],[34,10],[35,10],[46,10],[47,10]]);
    b.props('S',[[5,21],[5,22],[5,23],[9,21],[9,22],[9,23],[13,21],[13,22],[13,23],[19,20],[20,20],[21,20],[19,23],[20,23],[21,23],[19,26],[20,26],[21,26]]);
    b.props('O',[[33,24],[34,24],[48,28],[47,28]]);
    b.item('vial',[[6,10],[15,27],[29,20]]);
    b.log('assay',14,9);b.log('coldtag',3,27);b.log('behaviour',19,13);b.log('host',29,13);b.log('carrow',27,22);b.log('compound',36,14);
    b.item('med',[[3,17],[48,15],[44,28]]);b.item('sh',[[3,19],[30,24],[32,28]]);b.item('a9',[[18,17],[33,15],[54,6]]);b.item('salvage',[[30,9],[18,28],[38,24],[3,32],[16,28]]);b.item('flare',[[49,24],[3,5]]);
    b.use('window',40,16,'SPEAK TO DR. BRANDT','window');b.use('exit',53,35,'EXIT TO THE STATION YARD','console');
    b.spawns=[[4,31],[30,6],[52,22],[45,31],[20,31],[52,6],[9,24]];b.light('a',[[8,6],[28,6],[46,6],[12,31],[38,31],[25,23]]);b.light('r',[[53,10],[53,28],[40,25],[52,34]]);b.light('w',[[9,12],[24,12],[40,12]]);b.light('t',[[9,25],[40,20]]);
  },
  decor(g){drawSeated(g,40.5*T,20.3*T);},
  onStart(){G.flags.vials=0;setObj('Collect Compound 12 vials (0/3)',null);
    scene('l3',[[40,20]],()=>{if(U('benny'))say('BRANDT','Benedikt is at the undercroft hatch with a fire axe and a face like thunder. Nothing is following you in. He left you his pantry stash.');
    say('BRANDT','Welcome to C Wing. Mind the ones with the swollen throats. They spit, and it burns.');
    say('BRANDT','I need three vials of Compound 12. Wet lab, cold storage, and the fridge in the server office. Bring them to my window.');},{intro:[40,20],introT:1.4});},
  onPickup(it){if(it.type==='vial'){G.flags.vials++;if(G.flags.vials>=3){setObj('BLACKOUT — reach Brandt\'s isolation window',[40,16]);G.flags.dark=1;for(const l of world.lights)if(l.kind!=='t')l.on=false;sfx('breaker');sfx('alarm');addShake(8);emitNoise(G.p.x,G.p.y,700,'machine');
      const n=G.diffId==='story'?3:G.diffId==='whiteout'?6:5;for(let i=0;i<n;i++)spawnWave(this,'crawler');
      scene(null,['p',[40,19]],()=>{say('SYS','MAIN BREAKER FAULT. WING C IS ON BATTERY. BATTERY IS AT ZERO PERCENT.');say('BRANDT','That was the breaker. The dark will not slow them down at all. Observation room. I am behind the glass. Hurry.');});
      hint('The wing is dark. Your flashlight and flares are all the light there is.',7);}else setObj('Collect Compound 12 vials ('+G.flags.vials+'/3)',null);}},
  onUse(u){
    if(u.id==='window'){if(G.flags.vials<3){toast('SHE NEEDS ALL THREE VIALS');sfx('denied');return;}
      if(!G.flags.talked){G.flags.talked=1;u.enabled=false;G.p.keys.blue=true;sfx('key');G.flags.dark=0;for(const l of world.lights)if(l.kind==='r'||l.kind==='a'){l.on=true;l.boot=.6;}sfx('breaker');
        scene(null,[[40,19],[40,19],[40,19],'p',[40,19]],()=>{say('BRANDT','Through the pass-box. Thank you. ...You\'re staring. Yes. It\'s in me too. Six days longer than anyone else who can still talk.');
        say('BRANDT','Listen. The drill hall lift goes down to the caisson, the room at the bottom of the hole. There are scuttling charges there.');
        say('BRANDT','They won\'t arm while the core is seated in the wellhead. Aksel took it down with him. Someone has to go and pull it.');
        say('MARROW','And someone is me.');say('BRANDT','Blue card is in the box. South-east door. I\'m sorry.');});
        setObj('Go to the Drill Hall — south-east door',[53,35]);}}
    if(u.id==='exit')completeLevel();}
},
/* 4 */{name:'THE DRILL HALL',sub:'Borehole head · 0 m',theme:'station',amb:[24,30,42],size:[60,40,' '],wind:.04,
  build(b){
    b.room(12,9,36,25,'.');b.room(26,33,8,6,':');b.room(25,2,10,8,':');b.room(1,14,12,12,',');b.room(47,14,12,12,',');
    b.fill(26,17,8,8,':');b.fill(28,19,4,4,'D');
    b.door(29,33);b.door(29,9,'lift');b.door(12,20);b.door(47,20);b.start=[29,36];
    b.props('C',[[16,13],[17,13],[16,14],[42,13],[43,13],[43,14],[16,28],[17,29],[42,29],[43,28],[42,28],[5,17],[54,22]]);
    b.props('K',[[20,20],[20,21],[39,20],[39,21],[2,20],[57,20]]);b.props('O',[[22,12],[37,12],[22,31],[37,31]]);b.props('M',[[13,10],[46,10],[2,18],[57,18]]);
    b.use('breakerA',3,19,'THROW BREAKER','breaker');b.use('breakerB',56,19,'THROW BREAKER','breaker');b.use('liftcall',31,11,'CALL LIFT','console');b.use('exit',29,5,'DESCEND','console',false);
    b.item('weapon',[[10,16]],'carbine');b.item('rf',[[11,16],[9,24],[45,11],[14,11],[57,24]]);
    b.en('husk',[[24,18],[24,23],[35,18],[35,23],[29,26],[30,14],[55,23]]);b.en('screamer',[[20,26]]);b.en('crawler',[[5,22],[8,17],[3,16]]);b.en('brute',[[52,19]]);b.en('spitter',[[50,16]]);
    b.item('med',[[2,24],[57,15],[45,32],[32,37]]);b.item('sh',[[14,32],[49,24],[32,35]]);b.item('a9',[[27,35],[13,21]]);b.item('flare',[[46,21],[27,37]]);b.item('salvage',[[2,15],[57,16],[38,32],[21,10],[11,24]]);
    b.log('drill1',26,16);b.log('drill2',33,24);b.log('halvardtape',6,15);b.log('lifttag',28,11);b.log('scrawl',27,20);
    b.light('a',[[18,12],[41,12],[18,30],[41,30],[29,35]]);b.light('w',[[29,17],[30,24],[6,19],[29,5]]);b.light('r',[[29,11],[52,17]]);
    b.spawns=[[29,36],[3,23],[56,23],[14,31],[45,31],[14,12],[45,13]];
  },
  decor(g){drawRig(g,30*T,21*T);},
  onStart(){G.flags.brk=0;
    if(G.mode==='holdout'){setObj('HOLDOUT — survive',null);G.flags.wave=0;G.flags.wt=4;G.p.keys.none=1;hint('Endless waves. Supplies drop between waves. Last as long as you can.',7);return;}
    setObj('Throw both breakers (0/2) — west and east annex',null);
    scene('l4',[[30,21],[29,7]],()=>{say('BRANDT','Marrow, I\'ve patched into your handset. The lift is dead until both annex breakers are thrown. West and east.');
    say('BRANDT','Then call it from the console by the cage. I should warn you. It makes a noise like the end of the world.');},{intro:[30,21],introT:1.8});},
  onUse(u){
    if(u.id==='breakerA'||u.id==='breakerB'){u.done=true;u.enabled=false;sfx('breaker');emitNoise(u.x,u.y,420,'machine');G.flags.brk++;addShake(4);
      if(G.flags.brk>=2){setObj('Call the lift — console by the cage',[31,11]);powerOn();say('BRANDT','That\'s both. Hall lights are up. Get to the console.');}
      else setObj('Throw both breakers (1/2) — west and east annex',null);}
    if(u.id==='liftcall'){if(G.flags.brk<2){sfx('denied');toast('LIFT HAS NO POWER — THROW BOTH BREAKERS');return;}
      u.enabled=false;u.done=true;sfx('machine');addShake(10);G.flags.hold=true;G.timer={t:95,label:'LIFT ARRIVING',cb:'lift'};G.flags.wt=1;G.flags.wave=0;
      emitNoise(u.x,u.y,2500,'machine');scene(null,[[29,30]],()=>{say('BRANDT','It\'s climbing. Ninety seconds. Everything in this building just heard that.');},{intro:[29,7],introT:1.4});setObj('HOLD until the lift arrives',null);}
    if(u.id==='exit')completeLevel();},
  onAlert(e){if(e.type==='brute'&&!G.flags.duke){G.flags.duke=1;scene('duke',[[(e.x-24)/T,(e.y-24)/T]],()=>{say('BRANDT','That\'s Duke Okafor. Drill chief. He was the first. Don\'t let him get a run at you — make him hit a wall.');});}},
  update(dt){
    if(G.mode==='holdout'){G.flags.wt-=dt;const alive=world.enemies.reduce((n,e)=>n+(e.dead?0:1),0);
      if(G.flags.wt<=0&&alive<4){G.flags.wave++;const w=G.flags.wave;G.flags.wt=9;toast('WAVE '+w);sfx('alarm');G.stats.score+=w*50;
        const n=4+Math.floor(w*1.6);for(let i=0;i<n;i++){const r=Math.random();let t='husk';if(w>1&&r<.3)t='crawler';if(w>2&&r>.82)t='spitter';if(w>3&&r>.93)t='screamer';if(w>4&&i===0&&w%2===1)t='brute';spawnWave(this,t);}
        if(w>1){const s=pick(this.spawnList);dropLoot(29*T+rand(-150,150),27*T+rand(-60,60),true);dropLoot(30*T+rand(-150,150),14*T,true);if(w%3===0)spawnItem('med',30*T,26*T);}}
      return;}
    if(G.flags.hold){G.flags.wt-=dt;if(G.flags.wt<=0){G.flags.wave++;const w=G.flags.wave;G.flags.wt=w<3?14:12;
      const list=w===1?['husk','husk','husk','crawler']:w===2?['husk','crawler','crawler','crawler','spitter']:w===3?['husk','husk','screamer','crawler','crawler','spitter']:w===4?['brute','husk','husk','crawler','crawler']:['husk','husk','crawler','crawler','crawler','spitter','spitter'];
      for(const t of list)spawnWave(this,t);dropLoot(29*T+rand(-200,200),27*T+rand(-80,80));dropLoot(30*T+rand(-200,200),13*T+rand(-30,30));}}
  },
  onTimer(){G.flags.hold=false;openLock('lift');const u=world.uses.find(u=>u.id==='exit');u.enabled=true;sfx('slam');addShake(12);scene(null,[[29,8]],()=>{say('BRANDT','Lift\'s up! Get in the cage. GO!');});setObj('Board the lift',[29,5]);}
},
/* 5 */{name:'THE DEEP',sub:'Caisson level · 3,104 m below the surface',theme:'ice',amb:[14,32,40],size:[60,44,'^'],wind:.02,
  build(b){
    b.blob(30,8,6.6);b.cave([[29,36],[22,33],[13,31],[8,25],[12,19],[21,17],[27,14],[30,13]],2.3);b.cave([[29,36],[37,33],[47,31],[52,24],[47,17],[39,16],[33,14],[30,13]],2.3);
    b.blob(12,19,3.8);b.blob(8,25,3);b.blob(47,31,3.4);b.blob(52,24,3);b.blob(13,31,3.2);
    b.room(26,38,8,5,':');b.door(29,38);b.start=[29,40];
    for(let k=0;k<8;k++)b.en('husk',[[12+Math.round(Math.cos(k/8*TAU)*2.6),19+Math.round(Math.sin(k/8*TAU)*2.6)]]);
    b.en('husk',[[7,24],[9,26],[21,17]]);b.en('crawler',[[37,33],[40,32],[45,31],[48,32],[49,29],[40,16],[36,15]]);b.en('spitter',[[52,24],[51,21],[24,16]]);b.en('brute',[[47,17]]);
    b.en('boss',[[30,7]]);
    b.props('C',[[14,30],[15,30]]);b.props('T',[[12,32]]);
    b.log('brandttape',31,40);b.log('notebook1',13,31);b.log('notebook2',14,32);b.log('acoustic',12,19);
    b.item('med',[[11,30],[48,17],[29,14],[27,40]]);b.item('rf',[[15,31],[53,25],[31,14],[28,41]]);b.item('sh',[[46,33],[30,15],[32,41]]);b.item('a9',[[39,17],[8,26]]);b.item('salvage',[[52,22],[8,23],[11,17]]);b.item('flare',[[22,34],[36,34]]);
    b.use('core',30,7,'PULL THE WELLHEAD CORE','core',false);b.use('exit',30,3,'RIDE THE SERVICE HOIST','console',false);b.radio('boss',30,13,170);b.radio('fork',29,35,120);
    b.light('t',[[22,33],[8,25],[12,19],[21,17],[37,33],[47,31],[52,24],[47,17],[39,16],[30,13],[25,6],[35,6],[27,11],[33,11]]);b.light('a',[[13,30]]);b.light('w',[[29,40]]);
    b.spawns=[[25,5],[35,5],[25,11],[35,11],[30,13]];
  },
  onStart(){setObj('Reach the wellhead chamber',[30,12]);
    scene('l5',['p',[13,21]],()=>{say('BRANDT','You\'re under three kilometres of ice. I\'m going to lose you soon.');
    say('BRANDT','Two galleries lead to the wellhead. West is where the choir stands. Eleven of them, perfectly still. East is... less still.');});},
  onRadio(id){
    if(id==='fork')hint('WEST: sneak past the choir. EAST: fight through. Your call.',8);
    if(id==='boss'&&!G.flags.boss){G.flags.boss=1;const e=world.enemies.find(e=>e.type==='boss');if(e){e.state='hunt';G.boss=e;}sfx('roar');addShake(10);
      scene('boss',[[30,7]],()=>{say('HALVARD','Shhh. You are so loud. All of you. So loud.');say('HALVARD','It only wanted to know what the noise was.');},{intro:[30,7],introT:2,title:'THE CHORUS'});setObj('Silence the Chorus',null);hint('It is exposed while it SINGS. Watch the ground for strikes.',8);}},
  onKill(e){if(e.type==='boss'){G.boss=null;const u=world.uses.find(u=>u.id==='core');u.enabled=true;setObj('Pull the wellhead core',[30,7]);
    scene(null,[[30,7],'p'],()=>{say('HALVARD','...Marit?');say('MARROW','It\'s done. It\'s done. Ilse, do you copy?');},{intro:[30,7],introT:2.4});}},
  onUse(u){
    if(u.id==='core'){u.enabled=false;u.done=true;G.flags.core=1;sfx('key');sfx('hum');addShake(5);world.uses.find(u=>u.id==='exit').enabled=true;setObj('Ride the service hoist to the surface',[30,3]);
      say('MARROW','Core\'s out. It\'s cold. It\'s... humming.');say('BRANDT','...copy. Interlock is clear. Come up. There\'s something I haven\'t told you.');}
    if(u.id==='exit')completeLevel();}
},
/* 6 */{name:'LAST LIGHT',sub:'Control wing · The decision',theme:'station',amb:[27,31,42],size:[58,22,' '],wind:.05,
  build(b){
    b.room(2,7,8,7,':');b.room(9,3,16,15,',');b.room(24,8,22,5,'.');b.room(28,2,9,7,'.');b.room(34,12,9,7,'.');b.room(45,3,11,15,'.');
    b.door(9,10);b.door(24,10,'choice');b.door(32,8);b.door(38,12);b.door(45,10);b.start=[5,10];
    b.props('S',[[10,4],[11,4],[23,4]]);b.props('T',[[15,10],[16,10],[17,10],[18,10]]);b.props('K',[[35,13],[36,13],[41,17]]);
    b.props('C',[[29,3],[30,3],[35,3],[48,6],[49,6],[48,13],[49,14]]);b.props('O',[[54,4],[54,16]]);
    b.use('scuttle',13,5,'SCUTTLE THE BOREHOLE','console');b.use('transmit',17,5,'OPEN BAND TRANSMISSION','console');b.use('extract',21,5,'CALL MERIDIAN EXTRACTION','console');b.use('exit',53,10,'LEAVE HALVARD STATION','console',false);
    b.log('carrowmsg',20,14);b.log('lastfile',12,14);
    b.item('med',[[10,16],[33,4],[40,14]]);b.item('a9',[[23,16],[39,16]]);b.item('rf',[[22,16],[34,6],[37,16]]);b.item('sh',[[11,16],[31,5]]);b.item('flare',[[29,7]]);b.item('salvage',[[35,7]]);
    b.en('husk',[[30,10],[40,10],[50,6],[50,14]]);
    b.light('w',[[16,8]]);b.light('a',[[16,13],[50,10],[5,10],[32,5]]);b.light('r',[[34,10],[53,8],[38,15]]);
    b.spawns=[[26,10],[44,10],[32,4],[38,15],[47,5],[47,15],[53,15],[53,5]];
  },
  onStart(){setObj('Decide the fate of the lake — Control Room',[17,6]);G.p.keys.none=1;
    scene('l6',[[17,6],[13,5],[21,5],[17,5]],()=>{say('BRANDT','You have the core.'+(U('benny')?' Benedikt is here with me, on the good side of the glass.':'')+' Then here is what you can actually do with it. Three consoles.');
    say('BRANDT','One: fire the charges. The hole closes. Nobody ever knows what was down there, or what Meridian did.');
    say('BRANDT','Two: Carrow\'s line. Hand her the core and she sends a plane. You live. So does it.');
    say('BRANDT','Three, if you found enough of what we wrote down: put all of it on the open band first. Then fire the charges.');});},
  onUse(u){
    if(u.id==='exit'){endGame(G.flags.choice);return;}
    if(G.flags.choice)return;
    const have=store.codex.length;
    if(u.id==='transmit'&&have<TESTIMONY_NEED){sfx('denied');toast('NOT ENOUGH EVIDENCE — '+have+'/'+TESTIMONY_NEED+' LOGS RECOVERED');return;}
    const txt={scuttle:['SCUTTLE THE BOREHOLE','Arm the twelve thermal charges. The lake is sealed and the truth is buried with it. You will have under two minutes to get out.'],
      transmit:['OPEN BAND TRANSMISSION','Broadcast every recovered log to the whole continent, then seal the borehole. You will have under two minutes to get out.'],
      extract:['CALL MERIDIAN EXTRACTION','Confirm the core to Vivian Carrow. An aircraft will come. The core hums — everything left in the station will follow it to the vehicle bay.']}[u.id];
    confirmBox(txt[0],txt[1],()=>this.commit(u.id));},
  commit(c){G.flags.choice=c;openLock('choice');world.uses.find(u=>u.id==='exit').enabled=true;for(const u of world.uses)if(u.id!=='exit')u.enabled=false;
    setObj('Get to the vehicle bay',[53,10]);addShake(10);G.flags.wt=.5;G.flags.wave=0;
    if(c==='extract'){sfx('hum');scene(null,['p',[26,10]],()=>{say('CARROW','Warrant Officer. I knew you were practical. Wheels up in four minutes. Do keep it cold.');say('BRANDT','...I understand. I do. Go quickly. It knows it\'s leaving.');});}
    else{sfx('alarm');G.timer={t:c==='transmit'?105:110,label:'CHARGES ARMED',cb:'boom'};
      if(c==='transmit'){scene(null,['p',[26,10]],()=>{say('SYS','UPLINK ESTABLISHED. BROADCASTING ON ALL BANDS.');say('BRANDT','It\'s going out. All of it. Oh, Jonas, it\'s going out. Now run, Marrow. Run!');});}
      else scene(null,[[26,10]],()=>{say('BRANDT','Charges are armed. Thank you. Don\'t wait for me, there\'s nothing to wait for. Run!');});}},
  update(dt){if(!G.flags.choice)return;G.flags.wt-=dt;if(G.flags.wt<=0&&G.flags.wave<6){G.flags.wave++;G.flags.wt=G.flags.choice==='extract'?7:9;
    const ex=G.flags.choice==='extract';const list=G.flags.wave===1?['husk','husk','crawler','crawler']:G.flags.wave===3?(ex?['brute','crawler','crawler','spitter']:['husk','crawler','crawler','spitter']):G.flags.wave===5&&ex?['brute','husk','husk']:['husk','crawler','crawler',ex?'screamer':'husk'];
    for(const t of list)spawnWave(this,t);if(G.timer&&G.flags.wave%2===0)sfx('alarm');}},
  onTimer(){sfx('boom');addShake(30);killPlayer('The charges fired with you still inside.');}
}];

/* ================= WORLD ================= */
const G={state:'title',mode:'story',p:null,li:0,lvl:null,flags:{},stats:{},hitStop:0,shake:0,shx:0,shy:0,cam:{x:0,y:0},diffId:'standard',diff:DIFFS.standard,upg:{},
  obj:'',objT:null,dialog:[],hintQ:[],toastQ:[],timer:null,boss:null,time:0,card:0,fade:0,dmgFx:0,noiseHud:0,low:false};
const world={w:0,h:0,g:null,sol:null,doorMap:null,doors:[],lights:[],items:[],uses:[],radios:[],enemies:[],shots:[],flares:[],hazards:[],flashes:[],rings:[],vents:[],tracers:[],
  bg:null,bgc:null,mini:null,minic:null,explored:null,px:0,py:0};
const SOL={'#':7,'^':7,' ':7,'G':5,'C':1,'T':1,'e':1,'O':1,'H':1,'K':7,'S':7,'M':7,'D':7,'~':1};
const U=id=>G.upg[id]||0;

function bm(tx,ty){if(tx<0||ty<0||tx>=world.w||ty>=world.h)return true;const i=ty*world.w+tx;if(world.sol[i]&1)return true;const d=world.doorMap[i];return d?!world.doors[d-1].open:false;}
function bs(tx,ty){if(tx<0||ty<0||tx>=world.w||ty>=world.h)return true;const i=ty*world.w+tx;if(world.sol[i]&2)return true;const d=world.doorMap[i];return d?!world.doors[d-1].open:false;}
function bb(tx,ty){if(tx<0||ty<0||tx>=world.w||ty>=world.h)return true;const i=ty*world.w+tx;if(world.sol[i]&4)return true;const d=world.doorMap[i];return d?!world.doors[d-1].open:false;}
function castRay(ox,oy,dx,dy,maxD,blk){
  let tx=Math.floor(ox/T),ty=Math.floor(oy/T);const sx=dx>0?1:-1,sy=dy>0?1:-1;
  const adx=Math.abs(dx),ady=Math.abs(dy);const tdx=adx>1e-6?T/adx:1e9,tdy=ady>1e-6?T/ady:1e9;
  let mx=adx>1e-6?(dx>0?(tx+1)*T-ox:ox-tx*T)/adx:1e9,my=ady>1e-6?(dy>0?(ty+1)*T-oy:oy-ty*T)/ady:1e9,d=0;
  for(let k=0;k<80;k++){if(mx<my){d=mx;mx+=tdx;tx+=sx;}else{d=my;my+=tdy;ty+=sy;}if(d>=maxD)return maxD;if(blk(tx,ty))return d;}
  return maxD;
}
function los(ax,ay,bx,by,blk){const d=dist(ax,ay,bx,by);if(d<1)return true;return castRay(ax,ay,(bx-ax)/d,(by-ay)/d,d,blk||bs)>=d-.5;}
function walkClear(ax,ay,bx,by,r){const d=dist(ax,ay,bx,by);if(d<1)return true;const dx=(bx-ax)/d,dy=(by-ay)/d,px=-dy*r,py=dx*r;
  return castRay(ax,ay,dx,dy,d,bm)>=d-.5&&castRay(ax+px,ay+py,dx,dy,d,bm)>=d-.5&&castRay(ax-px,ay-py,dx,dy,d,bm)>=d-.5;}
function pushOut(e,blk){let hit=false;for(let it=0;it<2;it++){const tx0=Math.floor((e.x-e.r)/T),tx1=Math.floor((e.x+e.r)/T),ty0=Math.floor((e.y-e.r)/T),ty1=Math.floor((e.y+e.r)/T);
  for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++){if(!blk(tx,ty))continue;const cx=clamp(e.x,tx*T,tx*T+T),cy=clamp(e.y,ty*T,ty*T+T);const ox=e.x-cx,oy=e.y-cy,d2=ox*ox+oy*oy;
    if(d2<e.r*e.r){hit=true;if(d2>1e-4){const d=Math.sqrt(d2),p=(e.r-d)/d;e.x+=ox*p;e.y+=oy*p;}else{const l=e.x-tx*T,r=tx*T+T-e.x,u=e.y-ty*T,dn=ty*T+T-e.y,m=Math.min(l,r,u,dn);if(m===l)e.x=tx*T-e.r;else if(m===r)e.x=tx*T+T+e.r;else if(m===u)e.y=ty*T-e.r;else e.y=ty*T+T+e.r;}}}}
  return hit;}

/* ---------- pathfinding (BFS from goal) ---------- */
let bfsNext=null,bfsQ=null,bfsStamp=null,bfsId=0;
function passable(tx,ty){if(tx<0||ty<0||tx>=world.w||ty>=world.h)return false;const i=ty*world.w+tx;if(world.sol[i]&1)return false;const d=world.doorMap[i];if(d){const D=world.doors[d-1];if(!D.open&&D.lock)return false;}return true;}
function findPath(sx,sy,gx,gy){
  const w=world.w,h=world.h;sx=clamp(Math.floor(sx/T),0,w-1);sy=clamp(Math.floor(sy/T),0,h-1);gx=clamp(Math.floor(gx/T),0,w-1);gy=clamp(Math.floor(gy/T),0,h-1);
  if(!passable(gx,gy)){let best=-1,bd=1e9;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){if(passable(gx+i,gy+j)){const d=i*i+j*j;if(d<bd){bd=d;best=(gy+j)*w+gx+i;}}}if(best<0)return null;gx=best%w;gy=(best/w)|0;}
  const s=sy*w+sx,g=gy*w+gx;if(s===g)return[g];
  bfsId++;let qh=0,qt=0;bfsQ[qt++]=g;bfsStamp[g]=bfsId;bfsNext[g]=-1;let found=false;
  while(qh<qt){const c=bfsQ[qh++];if(c===s){found=true;break;}const cx=c%w,cy=(c/w)|0;
    for(let k=0;k<4;k++){const nx=cx+(k===0?1:k===1?-1:0),ny=cy+(k===2?1:k===3?-1:0);if(nx<0||ny<0||nx>=w||ny>=h)continue;const n=ny*w+nx;if(bfsStamp[n]===bfsId)continue;if(n!==s&&!passable(nx,ny))continue;bfsStamp[n]=bfsId;bfsNext[n]=c;bfsQ[qt++]=n;}}
  if(!found)return null;const path=[];let c=bfsNext[s],n=0;while(c>=0&&n<60){path.push(c);c=bfsNext[c];n++;}return path;
}

/* ---------- lights ---------- */
const LK={w:{r:250,col:[255,246,228],i:.95},a:{r:230,col:[255,176,84],i:.9},r:{r:200,col:[255,64,44],i:.85},t:{r:190,col:[70,255,214],i:.62},f:{r:270,col:[255,150,60],i:1}};
function computeLight(l){const n=G.low?48:80,pts=new Float32Array(n*2);for(let k=0;k<n;k++){const a=k/n*TAU,dx=Math.cos(a),dy=Math.sin(a);const d=Math.min(l.r,castRay(l.x,l.y,dx,dy,l.r,bs)+16);pts[k*2]=l.x+dx*d;pts[k*2+1]=l.y+dy*d;}l.pts=pts;}
function relight(x,y){for(const l of world.lights)if(x===undefined||dist(l.x,l.y,x,y)<l.r+80)computeLight(l);}
function powerOn(){let k=0;for(const l of world.lights)if(l.powered&&!l.on){l.on=true;l.boot=.3+k*.25;k++;}}

/* ---------- build ---------- */
function buildWorld(def){
  const b=new Builder(def.size[0],def.size[1],def.size[2]);def.build(b);
  const w=world.w=b.w,h=world.h=b.h,n=w*h;world.g=b.g;world.sol=new Uint8Array(n);world.doorMap=new Int16Array(n);world.explored=new Uint8Array(n);
  bfsNext=new Int32Array(n);bfsQ=new Int32Array(n);bfsStamp=new Int32Array(n);bfsId=0;
  for(let i=0;i<n;i++)world.sol[i]=SOL[b.g[i]]||0;
  for(const k of['doors','lights','items','uses','radios','enemies','shots','flares','hazards','flashes','rings','tracers','vents'])world[k].length=0;
  def.spawnList=b.spawns;
  for(const e of b.ents){const cx=e.x*T+24,cy=e.y*T+24;
    if(e.k==='door'){const wl=c=>(SOL[c]||0)&2;const vert=wl(b.get(e.x-1,e.y))&&wl(b.get(e.x+1,e.y));world.doors.push({tx:e.x,ty:e.y,x:cx,y:cy,lock:e.lock,open:false,amt:0,vert:!!vert,bash:0,deny:0});world.doorMap[e.y*w+e.x]=world.doors.length;}
    else if(e.k==='enemy')spawnEnemy(e.type,cx,cy);
    else if(e.k==='item')spawnItem(e.type,cx,cy,e.id,true);
    else if(e.k==='light'){const d=LK[e.kind];world.lights.push({x:cx,y:cy,r:d.r,col:d.col,i:d.i,kind:e.kind,powered:e.powered,on:!e.powered,boot:0,ph:rand(TAU),pts:null});}
    else if(e.k==='use')world.uses.push({id:e.id,x:cx,y:cy,label:e.label,kind:e.kind,enabled:e.enabled,done:false});
    else if(e.k==='radio')world.radios.push({id:e.id,x:cx,y:cy,r:e.r,done:false});
    else if(e.k==='vent')world.vents.push({id:e.id,x:cx-e.dx*24,y:cy-e.dy*24,dx:e.dx,dy:e.dy,len:e.len*T,ph:e.ph,on:false,off:false});
  }
  world.px=b.start[0]*T+24;world.py=b.start[1]*T+24;
  renderBG(def);relight();
  world.mini=document.createElement('canvas');world.mini.width=w*3;world.mini.height=h*3;world.minic=world.mini.getContext('2d');
}

/* ---------- background painting ---------- */
const FLOOR_T={surface:{'.':'metal',',':'snow',':':'grate'},station:{'.':'metal',',':'lino',':':'grate'},lab:{'.':'lino',',':'labtile',':':'grate'},ice:{'.':'metal',',':'ice',':':'grate'}};
const ROCK_C={surface:[[104,120,142],[30,38,52]],ice:[[62,98,116],[12,24,32]],station:[[60,70,80],[8,10,14]],lab:[[60,70,80],[8,10,14]]};
function isFloorCh(c){return c==='.'||c===','||c===':'||c===';';}
function pGlass(g,x,y,r){for(let k=0;k<9;k++){const px=x+r()*T,py=y+r()*T,s=2+r()*5,a=r()*6;g.fillStyle=r()<.5?'rgba(190,230,240,.55)':'rgba(120,170,185,.5)';g.beginPath();g.moveTo(px+Math.cos(a)*s,py+Math.sin(a)*s);g.lineTo(px+Math.cos(a+2.2)*s*.7,py+Math.sin(a+2.2)*s*.7);g.lineTo(px+Math.cos(a+4.1)*s*.9,py+Math.sin(a+4.1)*s*.9);g.fill();}g.fillStyle='rgba(255,255,255,.7)';for(let k=0;k<4;k++)g.fillRect(x+r()*T,y+r()*T,1.4,1.4);}
function pFloor(g,kind,x,y,r){
  const v=Math.floor(r()*10);
  if(kind==='metal'){g.fillStyle=`rgb(${82+v},${90+v},${102+v})`;g.fillRect(x,y,T,T);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(x,y,T,1.5);g.fillRect(x,y,1.5,T);g.fillStyle='rgba(255,255,255,.07)';g.fillRect(x,y+T-1.5,T,1.5);g.fillRect(x+T-1.5,y,1.5,T);
    g.strokeStyle='rgba(255,255,255,.06)';g.lineWidth=1.6;g.beginPath();for(let j=0;j<4;j++)for(let i=0;i<4;i++){const cx=x+6+i*12,cy=y+6+j*12;if((i+j)&1){g.moveTo(cx-3,cy-3);g.lineTo(cx+3,cy+3);}else{g.moveTo(cx+3,cy-3);g.lineTo(cx-3,cy+3);}}g.stroke();
    g.fillStyle='rgba(0,0,0,.4)';for(const p of[[5,5],[43,5],[5,43],[43,43]]){g.beginPath();g.arc(x+p[0],y+p[1],1.5,0,TAU);g.fill();}}
  else if(kind==='lino'){g.fillStyle=`rgb(${104+v},${112+v},${110+v})`;g.fillRect(x,y,T,T);g.fillStyle='rgba(0,0,0,.07)';if(((x/T+y/T)&1)===0)g.fillRect(x,y,T,T);g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x,y,T,1);g.fillRect(x,y,1,T);
    g.strokeStyle='rgba(30,30,30,.18)';g.lineWidth=1;for(let k=0;k<2;k++){if(r()<.5){g.beginPath();const sx=x+r()*T,sy=y+r()*T;g.moveTo(sx,sy);g.lineTo(sx+r()*20-10,sy+r()*20-10);g.stroke();}}}
  else if(kind==='labtile'){g.fillStyle=`rgb(${150+v},${160+v},${164+v})`;g.fillRect(x,y,T,T);g.fillStyle='rgba(40,60,70,.35)';g.fillRect(x,y,T,1.2);g.fillRect(x,y,1.2,T);g.fillRect(x+24,y,1.2,T);g.fillRect(x,y+24,T,1.2);
    g.fillStyle='rgba(255,255,255,.1)';g.fillRect(x+3,y+3,8,3);g.fillRect(x+27,y+27,8,3);}
  else if(kind==='grate'){g.fillStyle=`rgb(${50+v},${56+v},${64+v})`;g.fillRect(x,y,T,T);g.fillStyle='rgba(0,0,0,.55)';for(let j=4;j<T;j+=6)g.fillRect(x+3,y+j,T-6,2.5);g.fillStyle='rgba(255,255,255,.08)';for(let j=4;j<T;j+=6)g.fillRect(x+3,y+j+2.5,T-6,1);
    g.strokeStyle='rgba(120,130,145,.5)';g.lineWidth=2;g.strokeRect(x+1,y+1,T-2,T-2);g.fillStyle='rgba(120,130,145,.5)';g.fillRect(x+23,y,2,T);}
  else if(kind==='snow'){g.fillStyle=`rgb(${196+v},${210+v},${228+v})`;g.fillRect(x,y,T,T);
    for(let k=0;k<3;k++){g.fillStyle=`rgba(120,150,190,${.08+r()*.12})`;g.beginPath();g.ellipse(x+r()*T,y+r()*T,8+r()*18,3+r()*7,-.25+r()*.2,0,TAU);g.fill();}
    g.strokeStyle='rgba(255,255,255,.5)';g.lineWidth=1;g.beginPath();for(let k=0;k<3;k++){const sx=x+r()*T,sy=y+r()*T;g.moveTo(sx,sy);g.lineTo(sx+10+r()*14,sy-2+r()*2);}g.stroke();}
  else if(kind==='ice'){g.fillStyle=`rgb(${104+v},${150+v},${176+v})`;g.fillRect(x,y,T,T);
    for(let k=0;k<2;k++){g.fillStyle=`rgba(20,60,90,${.1+r()*.16})`;g.beginPath();g.ellipse(x+r()*T,y+r()*T,10+r()*16,6+r()*10,r()*3,0,TAU);g.fill();}
    g.strokeStyle='rgba(225,245,255,.4)';g.lineWidth=1;g.beginPath();let sx=x+r()*T,sy=y+r()*T;g.moveTo(sx,sy);for(let k=0;k<3;k++){sx+=r()*24-12;sy+=r()*24-12;g.lineTo(sx,sy);}g.stroke();
    if(r()<.25){g.strokeStyle='rgba(60,255,210,.22)';g.beginPath();sx=x+r()*T;sy=y+r()*T;g.moveTo(sx,sy);for(let k=0;k<4;k++){sx+=r()*22-11;sy+=r()*22-11;g.lineTo(sx,sy);}g.stroke();}}
  if(r()<.16&&kind!=='snow'&&kind!=='ice'){g.fillStyle=`rgba(8,10,12,${.12+r()*.22})`;g.beginPath();g.ellipse(x+r()*T,y+r()*T,6+r()*14,4+r()*10,r()*3,0,TAU);g.fill();}
}
function rr(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);g.lineTo(x+w,y+h-r);g.quadraticCurveTo(x+w,y+h,x+w-r,y+h);g.lineTo(x+r,y+h);g.quadraticCurveTo(x,y+h,x,y+h-r);g.lineTo(x,y+r);g.quadraticCurveTo(x,y,x+r,y);g.closePath();}
function ell(g,x,y,rx,ry,rot){g.beginPath();g.ellipse(x,y,rx,ry,rot||0,0,TAU);g.fill();}
function pProp(g,c,x,y,r){
  g.fillStyle='rgba(0,0,0,.4)';
  if(c==='C'){rr(g,x+5,y+7,T-6,T-6,3);g.fill();if(r()<.5){g.fillStyle='#86683f';rr(g,x+3,y+3,T-6,T-6,2);g.fill();g.strokeStyle='#5a4426';g.lineWidth=2;for(let i=1;i<4;i++){g.beginPath();g.moveTo(x+3+i*10.5,y+3);g.lineTo(x+3+i*10.5,y+T-3);g.stroke();}g.strokeStyle='#a8875a';g.lineWidth=3;g.strokeRect(x+5,y+5,T-10,T-10);g.beginPath();g.moveTo(x+6,y+6);g.lineTo(x+T-6,y+T-6);g.stroke();g.fillStyle='rgba(20,20,20,.6)';g.fillRect(x+12,y+30,16,4);}
    else{g.fillStyle=r()<.5?'#c06024':'#5d6b4a';rr(g,x+3,y+4,T-6,T-8,5);g.fill();g.fillStyle='rgba(0,0,0,.25)';for(let i=0;i<4;i++)g.fillRect(x+8+i*9,y+6,3,T-12);g.fillStyle='rgba(255,255,255,.18)';g.fillRect(x+5,y+6,T-10,3);g.fillStyle='#22252a';g.fillRect(x+10,y+T-8,7,5);g.fillRect(x+T-17,y+T-8,7,5);}}
  else if(c==='T'){rr(g,x+3,y+5,T-3,T-3,2);g.fill();g.fillStyle='#8a939c';rr(g,x+1,y+1,T-2,T-2,2);g.fill();g.fillStyle='rgba(255,255,255,.14)';g.fillRect(x+3,y+3,T-6,2);g.strokeStyle='rgba(0,0,0,.3)';g.lineWidth=1;g.strokeRect(x+1.5,y+1.5,T-3,T-3);
    const k=r();g.save();g.translate(x+24,y+24);g.rotate(r()*1-.5);if(k<.3){g.fillStyle='#e9e6da';g.fillRect(-12,-9,16,20);g.fillStyle='rgba(40,40,60,.5)';for(let i=0;i<5;i++)g.fillRect(-10,-6+i*3.5,12,1);}else if(k<.55){g.fillStyle='#1c2026';g.fillRect(-13,-10,26,18);g.fillStyle='#2f4a5c';g.fillRect(-11,-8,22,13);}else if(k<.75){g.fillStyle='#d9d9d9';g.beginPath();g.arc(6,4,6,0,TAU);g.fill();g.fillStyle='#3b2a1c';g.beginPath();g.arc(6,4,4,0,TAU);g.fill();}else if(k<.9){g.fillStyle='#39424c';g.fillRect(-14,-6,28,12);g.fillStyle='#9fd6c8';for(let i=0;i<5;i++){g.beginPath();g.arc(-10+i*5,0,1.8,0,TAU);g.fill();}}g.restore();}
  else if(c==='e'){rr(g,x+4,y+6,T-4,T-6,3);g.fill();g.fillStyle='#4a525c';rr(g,x+1,y+3,T-2,T-6,3);g.fill();g.fillStyle='#aab2ba';rr(g,x+3,y+5,T-6,T-10,3);g.fill();g.fillStyle=r()<.5?'#45607e':'#7a4338';rr(g,x+16,y+5,T-19,T-10,3);g.fill();g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x+22,y+5,2,T-10);g.fillStyle='#e4e6e8';rr(g,x+5,y+12,9,T-24,3);g.fill();}
  else if(c==='O'){g.beginPath();g.arc(x+26,y+27,19,0,TAU);g.fill();const col=r()<.5?['#a83a2c','#7e2a20']:['#2f5f8a','#234767'];g.fillStyle=col[0];g.beginPath();g.arc(x+24,y+24,19,0,TAU);g.fill();g.strokeStyle=col[1];g.lineWidth=3;g.beginPath();g.arc(x+24,y+24,14,0,TAU);g.stroke();g.fillStyle='#1e2227';g.beginPath();g.arc(x+30,y+18,3.5,0,TAU);g.fill();g.fillStyle='rgba(255,255,255,.2)';g.beginPath();g.arc(x+18,y+18,5,0,TAU);g.fill();}
  else if(c==='K'){g.fillStyle='#5f6b7a';g.fillRect(x,y,T,T);g.fillStyle='#74808f';g.fillRect(x+2,y+2,21,T-4);g.fillRect(x+25,y+2,21,T-4);g.fillStyle='rgba(0,0,0,.4)';for(let i=0;i<4;i++){g.fillRect(x+6,y+7+i*4,13,1.5);g.fillRect(x+29,y+7+i*4,13,1.5);}g.fillStyle='#c9ced4';g.fillRect(x+19,y+26,2,8);g.fillRect(x+27,y+26,2,8);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(x,y+T-4,T,4);}
  else if(c==='S'){g.fillStyle='#1b1f25';g.fillRect(x,y,T,T);g.fillStyle='#2a3038';g.fillRect(x+3,y+3,T-6,T-6);for(let j=0;j<5;j++){g.fillStyle='#14171b';g.fillRect(x+5,y+6+j*8,T-10,5);for(let i=0;i<5;i++){const q=r();g.fillStyle=q<.5?'#39ff9a':q<.8?'#ffb23a':'#20262c';g.fillRect(x+8+i*7,y+8+j*8,2,1.6);}}}
  else if(c==='M'){g.fillStyle='#586048';g.fillRect(x,y,T,T);g.fillStyle='#6c7658';g.fillRect(x+3,y+3,T-6,T-6);g.fillStyle='#1c1f1a';g.beginPath();g.arc(x+24,y+22,13,0,TAU);g.fill();g.strokeStyle='#8a9474';g.lineWidth=2;for(let i=0;i<6;i++){g.beginPath();g.moveTo(x+24,y+22);g.lineTo(x+24+Math.cos(i/6*TAU)*13,y+22+Math.sin(i/6*TAU)*13);g.stroke();}
    for(let i=0;i<6;i++){g.fillStyle=i&1?'#e0b020':'#1a1a1a';g.fillRect(x+3+i*7,y+T-8,7,5);}}
  else if(c==='G'){g.fillStyle='#39434e';g.fillRect(x,y,T,T);g.fillStyle='rgba(150,215,235,.5)';g.fillRect(x,y+15,T,18);g.fillStyle='rgba(255,255,255,.35)';g.fillRect(x,y+17,T,2);g.fillStyle='#232a32';g.fillRect(x,y+12,T,3);g.fillRect(x,y+33,T,3);}
  else if(c==='D'){g.fillStyle='#2b3139';g.fillRect(x,y,T,T);}
}
function renderBG(def){
  const w=world.w,h=world.h,theme=def.theme;const cv=world.bg=document.createElement('canvas');cv.width=w*T;cv.height=h*T;const g=world.bgc=cv.getContext('2d');
  const r=rng(def.name.length*977+w*31+h),ft=FLOOR_T[theme],rc=ROCK_C[theme];const ch=(x,y)=>(x<0||y<0||x>=w||y>=h)?' ':world.g[y*w+x];
  const nearFloor=(x,y)=>{for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const c=ch(x+i,y+j);if(c!=='#'&&c!=='^'&&c!==' ')return true;}return false;};
  const under=(x,y)=>{for(const d of[[0,1],[0,-1],[1,0],[-1,0],[1,1],[-1,-1]]){const c=ch(x+d[0],y+d[1]);if(isFloorCh(c))return c;}return'.';};
  g.fillStyle='#05070a';g.fillRect(0,0,cv.width,cv.height);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=ch(x,y),px=x*T,py=y*T;
    if(isFloorCh(c)){pFloor(g,ft[c]||ft['.'],px,py,r);if(c===';')pGlass(g,px,py,r);}
    else if(c==='#'){if(!nearFloor(x,y)){g.fillStyle='#0b0e12';g.fillRect(px,py,T,T);continue;}const v=Math.floor(r()*8);g.fillStyle=`rgb(${66+v},${75+v},${88+v})`;g.fillRect(px,py,T,T);
      g.fillStyle='rgba(255,255,255,.1)';g.fillRect(px,py,T,2);g.fillRect(px,py,2,T);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(px,py+T-2,T,2);g.fillRect(px+T-2,py,2,T);
      g.strokeStyle='rgba(0,0,0,.22)';g.lineWidth=1;g.strokeRect(px+7.5,py+7.5,T-15,T-15);g.fillStyle='rgba(0,0,0,.3)';for(const p of[[11,11],[37,11],[11,37],[37,37]]){g.beginPath();g.arc(px+p[0],py+p[1],1.4,0,TAU);g.fill();}
      const below=ch(x,y+1);if(below!=='#'&&below!==' '&&below!=='^'){g.fillStyle='#2b323c';g.fillRect(px,py+T-17,T,17);g.fillStyle='rgba(0,0,0,.3)';for(let i=3;i<T;i+=6)g.fillRect(px+i,py+T-17,2,17);g.fillStyle='rgba(190,205,225,.3)';g.fillRect(px,py+T-18,T,1.5);
        if(r()<.14){g.fillStyle='#d8b020';g.fillRect(px+10,py+T-13,28,8);g.fillStyle='#1a1a1a';g.fillRect(px+13,py+T-11,22,1.5);g.fillRect(px+13,py+T-8,14,1.5);}}}
    else if(c==='^'){if(!nearFloor(x,y)){g.fillStyle=`rgb(${rc[1][0]},${rc[1][1]},${rc[1][2]})`;g.fillRect(px,py,T,T);if(r()<.4){g.fillStyle='rgba(255,255,255,.03)';g.beginPath();g.moveTo(px+r()*T,py+r()*T);g.lineTo(px+r()*T,py+r()*T);g.lineTo(px+r()*T,py+r()*T);g.fill();}continue;}
      const v=Math.floor(r()*14);g.fillStyle=`rgb(${rc[0][0]+v},${rc[0][1]+v},${rc[0][2]+v})`;g.fillRect(px,py,T,T);
      for(let k=0;k<4;k++){g.fillStyle=r()<.5?'rgba(255,255,255,.1)':'rgba(0,10,25,.2)';g.beginPath();g.moveTo(px+r()*T,py+r()*T);g.lineTo(px+r()*T,py+r()*T);g.lineTo(px+r()*T,py+r()*T);g.fill();}
      for(const d of[[0,1,0,T-10,T,10],[0,-1,0,0,T,10],[1,0,T-10,0,10,T],[-1,0,0,0,10,T]]){const c2=ch(x+d[0],y+d[1]);if(c2!=='^'&&c2!==' '&&c2!=='#'){g.fillStyle=theme==='surface'?'rgba(235,244,255,.5)':'rgba(180,235,255,.28)';g.fillRect(px+d[2],py+d[3],d[4],d[5]);g.fillStyle='rgba(0,0,0,.35)';g.fillRect(px+(d[0]===1?T-2:d[2]),py+(d[1]===1?T-2:d[3]),d[0]?2:T,d[1]?2:T);}}}
    else if(c!==' '){pFloor(g,ft[under(x,y)]||ft['.'],px,py,r);if(c==='~'){g.fillStyle='rgba(8,44,52,.86)';g.fillRect(px,py,T,T);g.strokeStyle='rgba(120,220,220,.25)';g.lineWidth=1.2;for(let k=0;k<3;k++){const yy=py+6+r()*36,xx=px+r()*20;g.beginPath();g.moveTo(xx,yy);g.quadraticCurveTo(xx+12,yy-3,xx+24,yy);g.stroke();}}}
  }
  /* ambient occlusion on floors */
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=ch(x,y);if((SOL[c]||0)&2)continue;const px=x*T,py=y*T;const wl=(i,j)=>{const q=ch(x+i,y+j);return q==='#'||q==='^'||q===' ';};
    if(wl(0,-1)){const gr=g.createLinearGradient(0,py,0,py+20);gr.addColorStop(0,'rgba(0,0,0,.55)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(px,py,T,20);}
    if(wl(-1,0)){const gr=g.createLinearGradient(px,0,px+12,0);gr.addColorStop(0,'rgba(0,0,0,.4)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(px,py,12,T);}
    if(wl(1,0)){const gr=g.createLinearGradient(px+T,0,px+T-10,0);gr.addColorStop(0,'rgba(0,0,0,.3)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(px+T-10,py,10,T);}
    if(wl(0,1)){const gr=g.createLinearGradient(0,py+T,0,py+T-8);gr.addColorStop(0,'rgba(0,0,0,.3)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(px,py+T-8,T,8);}
  }
  /* theme dressing */
  if(theme!=='surface'){const n=Math.floor(w*h/22);for(let k=0;k<n;k++){const x=Math.floor(r()*w),y=Math.floor(r()*h);if(!isFloorCh(ch(x,y)))continue;const px=x*T+r()*T,py=y*T+r()*T;const q=r();
      if(q<.35){g.fillStyle=`rgba(190,230,245,${.07+r()*.1})`;ell(g,px,py,14+r()*26,8+r()*16,r()*3);}
      else if(q<.6&&theme!=='ice'){g.fillStyle=`rgba(60,8,8,${.25+r()*.3})`;ell(g,px,py,6+r()*16,4+r()*9,r()*3);for(let i=0;i<5;i++)ell(g,px+r()*50-25,py+r()*50-25,1+r()*3,1+r()*3);}
      else if(q<.85){g.strokeStyle=`rgba(60,255,210,${.12+r()*.2})`;g.lineWidth=1;for(let s=0;s<3;s++){g.beginPath();let sx=px,sy=py;g.moveTo(sx,sy);for(let i=0;i<6;i++){sx+=r()*26-13;sy+=r()*26-13;g.lineTo(sx,sy);}g.stroke();}}
      else{g.fillStyle='rgba(235,232,220,.75)';g.save();g.translate(px,py);g.rotate(r()*6);g.fillRect(-6,-8,12,16);g.restore();}}}
  /* props */
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const c=ch(x,y);if('CTeOKSMGD'.includes(c))pProp(g,c,x*T,y*T,r);}
  if(def.decor)def.decor(g);
}
function decal(x,y,kind,size){const g=world.bgc;if(!g)return;const s=size||1;
  if(kind==='ichor'){g.fillStyle=`rgba(10,34,32,${.5+Math.random()*.25})`;ell(g,x,y,(7+rand(9))*s,(5+rand(7))*s,rand(3));for(let i=0;i<6;i++){ell(g,x+rand(-26,26)*s,y+rand(-26,26)*s,1+rand(3),1+rand(3));}g.fillStyle='rgba(60,255,210,.25)';for(let i=0;i<3;i++)ell(g,x+rand(-10,10)*s,y+rand(-10,10)*s,1.2,1.2);}
  else if(kind==='blood'){g.fillStyle=`rgba(96,10,10,${.45+Math.random()*.25})`;ell(g,x,y,(6+rand(8))*s,(4+rand(6))*s,rand(3));for(let i=0;i<5;i++)ell(g,x+rand(-22,22)*s,y+rand(-22,22)*s,1+rand(2.5),1+rand(2.5));}
  else if(kind==='hole'){g.fillStyle='rgba(0,0,0,.7)';ell(g,x,y,2,2);g.fillStyle='rgba(255,255,255,.12)';ell(g,x-1,y-1,3.2,3.2);}
  else if(kind==='scorch'){const gr=g.createRadialGradient(x,y,2,x,y,46*s);gr.addColorStop(0,'rgba(0,0,0,.65)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-50*s,y-50*s,100*s,100*s);}
}
function drawWreck(g,x,y){
  g.save();g.translate(x,y);g.rotate(.32);
  g.fillStyle='rgba(110,140,180,.35)';g.fillRect(-520,-22,470,44);decalAt(g,0,10,90);
  g.fillStyle='#1b1d20';g.save();g.rotate(.5);g.fillRect(-150,-5,300,9);g.restore();g.save();g.rotate(-1.15);g.fillRect(-20,-5,150,9);g.restore();
  g.fillStyle='#8f2f14';g.fillRect(-150,-9,80,18);g.fillStyle='#6d220e';g.fillRect(-176,-24,30,12);
  g.fillStyle='rgba(0,0,0,.45)';ell(g,6,8,64,32);g.fillStyle='#c4481c';ell(g,0,0,62,29);g.fillStyle='#e9e3d2';g.fillRect(-40,-3,62,6);g.fillStyle='#a53b16';ell(g,-10,0,40,22);
  g.fillStyle='#15202b';g.beginPath();g.ellipse(34,0,24,20,0,-1.2,1.2);g.fill();g.fillStyle='rgba(160,210,240,.25)';g.beginPath();g.ellipse(38,-4,14,9,0,-1.2,.6);g.fill();
  g.fillStyle='#2a2d31';g.beginPath();g.arc(-4,0,9,0,TAU);g.fill();g.fillStyle='#111';g.font='bold 11px sans-serif';g.fillText('RESCUE 2',-46,-12);
  g.restore();
  for(let i=0;i<14;i++){g.fillStyle=pick(['#2a2d31','#c4481c','#51565c']);g.save();g.translate(x+rand(-150,170),y+rand(-80,110));g.rotate(rand(6));g.fillRect(-rand(2,8),-rand(1,4),rand(4,14),rand(2,6));g.restore();}
}
function decalAt(g,x,y,s){const gr=g.createRadialGradient(x,y,4,x,y,s);gr.addColorStop(0,'rgba(0,0,0,.7)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(x-s,y-s,s*2,s*2);}
function drawRig(g,x,y){
  g.save();g.translate(x,y);
  g.fillStyle='rgba(0,0,0,.5)';g.fillRect(-92,-88,192,192);g.fillStyle='#39414b';g.fillRect(-96,-96,192,192);g.fillStyle='#4a5460';g.fillRect(-88,-88,176,176);
  for(let i=0;i<16;i++){g.fillStyle=i&1?'#d9a81c':'#18191b';g.fillRect(-96+i*12,-96,12,7);g.fillRect(-96+i*12,89,12,7);g.fillRect(-96,-96+i*12,7,12);g.fillRect(89,-96+i*12,7,12);}
  g.strokeStyle='#272c33';g.lineWidth=7;for(const a of[.5,2.2,3.9,5.4]){g.beginPath();g.moveTo(Math.cos(a)*50,Math.sin(a)*50);g.lineTo(Math.cos(a)*120,Math.sin(a)*120);g.stroke();}
  g.fillStyle='#22272d';g.beginPath();g.arc(0,0,58,0,TAU);g.fill();g.strokeStyle='#7b8794';g.lineWidth=5;g.beginPath();g.arc(0,0,54,0,TAU);g.stroke();
  for(let i=0;i<12;i++){g.fillStyle='#9aa5b1';g.beginPath();g.arc(Math.cos(i/12*TAU)*54,Math.sin(i/12*TAU)*54,3.4,0,TAU);g.fill();}
  const gr=g.createRadialGradient(0,0,4,0,0,34);gr.addColorStop(0,'#000');gr.addColorStop(.75,'#03100f');gr.addColorStop(1,'#1c6a5c');g.fillStyle=gr;g.beginPath();g.arc(0,0,34,0,TAU);g.fill();
  g.fillStyle='#8d98a3';g.beginPath();g.arc(0,0,10,0,TAU);g.fill();g.fillStyle='#c9d1d8';g.beginPath();g.arc(-2,-2,5,0,TAU);g.fill();
  g.fillStyle='#b5651d';g.beginPath();g.arc(-62,-62,22,0,TAU);g.fill();g.strokeStyle='#2a2a2a';g.lineWidth=3;for(let q=6;q<22;q+=5){g.beginPath();g.arc(-62,-62,q,0,TAU);g.stroke();}
  g.fillStyle='#2f353d';g.fillRect(44,44,40,34);g.fillStyle='#39ff9a';g.fillRect(50,50,6,3);g.fillStyle='#ff5a3c';g.fillRect(60,50,6,3);
  g.restore();
}
function drawSeated(g,x,y){
  g.save();g.translate(x,y);g.fillStyle='#5a646e';g.fillRect(-150,-60,70,34);g.fillStyle='#aab2ba';g.fillRect(-146,-56,62,26);g.fillStyle='#8a939c';g.fillRect(90,-70,60,40);g.fillStyle='#1c2026';g.fillRect(102,-64,26,18);
  g.fillStyle='rgba(0,0,0,.4)';ell(g,3,4,16,19);g.fillStyle='#3d4650';ell(g,0,14,9,6);g.fillStyle='#dfe5ea';ell(g,0,0,12,16);g.fillStyle='#c9d1d8';g.fillRect(-12,-2,24,3);
  g.fillStyle='#d8c9a8';g.beginPath();g.arc(0,-3,8,0,TAU);g.fill();g.fillStyle='#b9b4a6';g.beginPath();g.arc(0,-1,8,.2,Math.PI-.2);g.fill();
  g.strokeStyle='rgba(60,255,210,.7)';g.lineWidth=1.2;g.beginPath();g.moveTo(8,-4);g.lineTo(14,-9);g.lineTo(13,-15);g.moveTo(10,2);g.lineTo(17,3);g.stroke();
  g.restore();
}
function reveal(){const p=G.p,n=40;const mark=(tx,ty)=>{if(tx<0||ty<0||tx>=world.w||ty>=world.h)return true;const i=ty*world.w+tx;if(!world.explored[i]){world.explored[i]=1;const s=world.sol[i],c=world.g[i];world.minic.fillStyle=(s&2)?(c==='^'?'#3d5668':'#6f7d8f'):world.doorMap[i]?'#d9a81c':(s&1)?'#3a4450':'#232c38';world.minic.fillRect(tx*3,ty*3,3,3);}return bs(tx,ty);};
  mark(Math.floor(p.x/T),Math.floor(p.y/T));for(let k=0;k<n;k++){const a=k/n*TAU;castRay(p.x,p.y,Math.cos(a),Math.sin(a),T*9,mark);}}

/* ================= EXPANSION: THREE MORE CHAPTERS ================= */
WHO.CORE={n:'THE CORE',c:'#3fffd0'};
Object.assign(LOGS,{
  pipes:{t:'Pipefitter\'s Note',a:'T. Lindqvist, plant operator',d:'June 8',x:'Steam main is cycling on its own since the bus went down. Three jets in the east run blow every few seconds. They will take the skin off you.\n\nThe red wheel in the hub closes the middle one. Could not reach the others.\n\nFunny thing. The Quiet come to the hiss. They stand in front of it until it stops, then they wander off again. They do not seem to mind the burns.\n\nAlso: mind the glass by the old stores. Everything down here is glass now.'},
  undermaint:{t:'Undercroft Maintenance Log',a:'Plant office',d:'June 10',x:'SUMP: flooded to the second rung. Meltwater from the drill return is coming back up the drains.\n\nPump still works. Pump is the loudest thing on this continent.\n\nWe drew straws for who starts it. Nobody started it.\n\nIf the water in the sump is moving, do not look at it for long. Lindqvist looked at it for an hour and then he walked in.'},
  raman3:{t:'Medical Log — Final Entry',a:'Dr. Priya Raman',d:'June 12',x:'Moved down here with the last of the antifungals. It is quieter under the floor.\n\nSymptoms, self: tinnitus resolving into something more like music. Loss of the urge to speak. I had to decide to write this sentence.\n\nI can hear my pen on the paper. It is very loud. I can hear it from the other side of the room.\n\nI am going to stop writing now because I can hear the pen.'},
  reyesfax:{t:'Telex Printout — Comms Hut',a:'Camp Aurelian / Halvard Station',d:'June 5 – 19',x:'AURELIAN: HALVARD, YOUR SCHEDULED CALL IS OVERDUE. STATUS?\nHALVARD: ALL WELL. WEATHER POOR. DO NOT SEND AIRCRAFT.\n\nAURELIAN: FAMILIES ASKING AFTER MIDWINTER GREETINGS. STATUS?\nHALVARD: ALL WELL. WEATHER POOR. DO NOT SEND AIRCRAFT.\n\nAURELIAN: TOMAS HERE. AKSEL, IS THAT YOU TYPING?\nHALVARD: ALL WELL. WEATHER POOR. DO NOT SEND AIRCRAFT.\n\nThe same reply, fourteen times. The last nine are stamped one second after the question.'},
  mastlog:{t:'Tag Wired to the Junction Box',a:'Jonas Weller',d:'June 9',x:'Feed cut here. Clean. Bolt cutters.\n\nHe left the cutters on top of the box. He did not even hide them. He is not hiding any of it, that is what I cannot get past. He thinks he is right.\n\nSplice kit is in the comms hut, second drawer. I am not climbing this in a sixty-knot wind. Maybe tomorrow.\n\nIf tomorrow did not happen: twist red to red, and do not stop for anything.'},
  fuelnote:{t:'Requisition — Fuel Depot',a:'Dir. Aksel Halvard',d:'June 7',x:'Effective immediately all aviation fuel is reserved for the Meridian sample flight. No fuel is to be issued to vehicles.\n\nI understand this is unpopular.\n\nI would ask each of you to consider what you would give to have one more year with someone. Then consider that we may be able to give that to everyone.\n\nA.H.\n\nBelow, in a different hand: "He has not asked what it wants."'},
  hoistlog:{t:'Hoist Service Card',a:'Meridian Engineering',d:'May 30',x:'SERVICE HOIST — KNOWN FAULT\n\nCar binds at the 2,100 m collar when the shaft ices. Do not force it.\n\nEMERGENCY EGRESS: ladderways in pump galleries 3, 2 and 1. Six hundred rungs each. Rest at every landing.\n\nPencilled underneath: "Came up this way twice in May. Counted the rungs to stay calm. Lost count both times at the same place."'},
  climber:{t:'Scratched into the Ice',a:'unknown',d:'undated',x:'Letters cut with something sharp, at about hip height, as though by someone sitting down.\n\nGOING DOWN IS EASY\nIT CARRIES YOU\n\nA little further along, the same hand:\n\nI DID NOT WANT TO. I WANT THAT WRITTEN SOMEWHERE.'},
  pumpnote:{t:'Pump Operator\'s Notebook',a:'H. Okonkwo, hot-water drill',d:'June 6',x:'We send water down at ninety degrees to keep the hole from closing. It should come back colder.\n\nSince the fourth it comes back warmer than it went down.\n\nI shut the heaters off for a full shift to check. The hole stayed open. The return line stayed warm.\n\nIt is keeping the hole open. It is doing our job for us.\n\nIt wants us to keep coming.'}
});
LOG_ORDER=['manifest','gennote','snowcat','roster','aasjournal','whiteboard','med1','med2','memo','comms','pipes','undermaint','raman3','assay','behaviour','host','compound','carrow','coldtag','reyesfax','mastlog','fuelnote','drill1','drill2','halvardtape','lifttag','scrawl','brandttape','notebook1','notebook2','acoustic','hoistlog','climber','pumpnote','carrowmsg','lastfile'];
Builder.prototype.vent=function(x,y,dx,dy,len,ph,id){this.ents.push({k:'vent',x,y,dx,dy,len,ph,id});};

const LV_UNDER={name:'THE UNDERCROFT',sub:'Service tunnels · Beneath the habitat',theme:'station',amb:[20,25,34],size:[56,31,' '],wind:.02,
  build(b){
    b.room(2,12,7,6,':');b.room(8,12,22,4,'.');b.room(14,4,12,9,',');b.room(29,10,6,8,'.');b.room(34,12,14,4,':');b.room(47,8,8,12,'.');b.room(30,17,4,8,'.');b.room(22,24,20,6,'.');
    for(const d of[[8,14],[19,12],[29,13],[34,13],[47,13],[31,17],[31,24]])b.door(d[0],d[1]);b.start=[4,14];
    b.fill(13,13,12,2,';');b.fill(31,20,2,2,';');b.fill(17,7,5,2,';');b.fill(48,10,6,2,'~');
    b.props('K',[[15,5],[16,5]]);b.props('T',[[22,5],[23,5]]);b.props('e',[[24,10]]);b.props('C',[[27,13],[24,25],[25,25],[39,28],[40,27],[3,13]]);b.props('M',[[30,28],[32,28]]);b.props('O',[[53,18],[48,9]]);
    b.en('husk',[[17,13],[22,14],[32,12],[44,13],[26,27],[37,26]]);b.en('screamer',[[21,9]]);b.en('crawler',[[16,10],[18,6],[32,22],[50,16],[52,15]]);b.en('spitter',[[39,25]]);
    b.log('raman3',23,6);b.log('pipes',30,16);b.log('undermaint',53,17);
    b.item('med',[[15,11],[53,14],[35,28]]);b.item('a9',[[20,5],[48,18],[40,25],[6,16]]);b.item('sh',[[33,16],[23,28]]);b.item('salvage',[[16,7],[49,17],[28,25],[24,11]]);b.item('flare',[[52,18],[36,25],[7,13]]);
    b.use('valve',33,11,'CLOSE STEAM VALVE','breaker');b.use('pump',31,27,'START SUMP PUMP','generator');b.use('exit',51,9,'CLIMB INTO LAB WING C','console');
    b.vent(38,13,0,1,2,0,'v1');b.vent(42,13,0,1,2,1.4,'v2');b.vent(45,13,0,1,2,2.8,'v3');
    b.radio('sump',49,13,110);b.radio('steam',35,13,90);
    b.light('a',[[5,14],[31,14],[25,26],[38,27],[50,14]]);b.light('r',[[11,13],[40,13],[31,21]]);b.light('t',[[22,8],[51,10]]);b.light('w',[[31,26]]);
    b.spawns=[[19,6],[4,14],[51,17],[36,13],[32,19],[24,26],[39,27],[10,13]];
  },
  onStart(){setObj('Find a way up into Lab Wing C',null);
    scene('under',[[31,14]],()=>{
      say('BRANDT','Change of plan. The wing\'s front bulkhead dropped when containment tripped. It is sealed from both sides.');
      say('BRANDT','There is a ladder up from the sump, east end of the undercroft. Mind the floor down there. They hear glass.');});
    hint('Broken glass is LOUD to walk on. SNEAK across it.',9);},
  onRadio(id){
    if(id==='steam')hint('Steam jets burn, and the hiss draws them. Time your run, or close a valve.',8);
    if(id==='sump'&&!G.flags.drained){scene('sump',[[51,10],[31,27]],()=>{say('MARROW','Sump\'s flooded. Ladder\'s on the far side.');say('BRANDT','Of course it is. Pump room, south of the hub. I should tell you it will not be quiet.');});setObj('Start the sump pump — south of the hub',[31,27]);}},
  onAlert(e){if(e.type==='screamer'&&!G.flags.raman){G.flags.raman=1;scene('raman',[[(e.x-24)/T,(e.y-24)/T]],()=>{say('MARROW','Her badge says RAMAN.');say('BRANDT','...Priya. Do not let her call out. Please. She would hate it.');});}},
  onUse(u){
    if(u.id==='valve'){u.done=true;u.enabled=false;sfx('breaker');emitNoise(u.x,u.y,320,'machine');const v=world.vents.find(v=>v.id==='v2');if(v)v.off=true;toast('MIDDLE STEAM JET CLOSED');}
    if(u.id==='pump'){u.done=true;u.enabled=false;sfx('machine');addShake(9);emitNoise(u.x,u.y,2200,'machine');G.flags.drain=true;G.flags.wt=1.5;G.flags.wave=0;G.timer={t:30,label:'DRAINING SUMP'};setObj('HOLD — the sump is draining',null);
      scene(null,[[31,27]],()=>{say('BRANDT','That is every pipe in the undercroft singing. Thirty seconds. Keep your back to a wall.');});}
    if(u.id==='exit')completeLevel();},
  update(dt){if(!G.flags.drain)return;G.flags.wt-=dt;if(G.flags.wt<=0){G.flags.wave++;G.flags.wt=8;const w=G.flags.wave;for(const t of(w===1?['crawler','crawler','husk']:w===2?['crawler','crawler','crawler','husk']:['crawler','crawler','husk','spitter']))spawnWave(this,t);dropLoot(31*T+rand(-150,150),26*T);}},
  onTimer(){G.flags.drain=false;G.flags.drained=1;drainWater();sfx('slam');setObj('Cross the sump and climb to Lab Wing C',[51,9]);say('BRANDT','Sump is dry. East end. Go, before they work out the noise has stopped.');}
};

const LV_MAST={name:'THE MAST',sub:'Station yard · Wind 60 knots · −61°C',theme:'surface',amb:[30,39,58],size:[60,34,'^'],wind:.24,snow:2.6,
  build(b){
    b.cave([[10,16],[18,14],[26,10],[34,8],[42,10],[50,14],[54,20]],3.4);b.cave([[18,14],[20,22],[28,27],[38,28],[48,26],[54,20]],3.2);b.cave([[34,8],[36,16],[38,28]],2.6);b.blob(44,6,3.2);b.fill(9,15,3,3,',');b.fill(37,17,3,3,',');
    b.room(2,14,7,6,':');b.room(24,1,9,6);b.room(40,15,9,7);b.room(52,22,7,7,':');
    b.door(8,16);b.door(28,6);b.door(40,18);b.door(55,22);b.start=[4,16];
    b.props('M',[[44,3],[45,3]]);b.props('T',[[27,2],[28,2]]);b.props('S',[[25,2]]);b.props('O',[[41,16],[42,16],[47,20],[18,13],[33,8],[37,21],[49,25],[27,9]]);b.props('C',[[53,23],[57,27],[3,18]]);
    b.en('husk',[[16,15],[24,12],[30,9],[40,9],[46,12],[22,23],[32,27],[44,27],[36,14],[30,3]]);b.en('crawler',[[37,19],[35,23],[45,19]]);b.en('screamer',[[50,16]]);b.en('spitter',[[28,26],[52,18]]);
    b.item('quest',[[26,4]],'splice');b.log('reyesfax',31,2);b.log('mastlog',46,6);b.log('fuelnote',46,16);
    b.item('a9',[[25,5],[42,11],[6,18]]);b.item('sh',[[44,20],[48,24]]);b.item('med',[[41,20],[20,21],[56,23]]);b.item('salvage',[[12,17],[53,15],[47,17],[31,5]]);b.item('flare',[[29,2],[34,10],[7,15]]);
    b.use('junction',44,5,'SPLICE THE MAST FEED','breaker');b.use('exit',55,25,'ENTER THE DRILL HALL','console',false);
    b.light('f',[[18,14],[33,9],[37,22],[49,26],[27,10]]);b.light('r',[[45,5]]);b.light('w',[[28,4],[44,18]]);b.light('a',[[5,16],[55,24]]);
    b.spawns=[[12,16],[24,24],[36,12],[50,12],[40,26],[30,9],[52,19],[20,15]];
  },
  decor(g){drawMast(g,45*T,3.5*T);},
  onStart(){G.flags.cold=0;setObj('Find a splice kit — comms hut, north',[26,4]);
    scene('mast',[[44,5],[44,5],'p'],()=>{
      say('BRANDT','The drill hall is across the yard. But the mast junction is on the way, and Jonas found the feed cut there.');
      say('BRANDT','Splice it and we have a radio again. I am not sending you down a hole with nobody on the surface who knows.');
      say('MARROW','It\'s minus sixty-one out there, Ilse.');},{intro:[44,5],introT:1.8});
    hint('EXPOSURE climbs in the open. Warm up at burning drums and inside huts.',10);},
  onPickup(it){if(it.type==='quest'){say('MARROW','Splice kit. Second drawer, like he said.');setObj('Splice the feed at the mast junction',[44,5]);}},
  onUse(u){
    if(u.id==='junction'){if(!G.flags.has_splice){sfx('denied');toast('YOU NEED A SPLICE KIT — COMMS HUT');return;}
      u.enabled=false;G.flags.splice=true;G.flags.wt=2;G.flags.wave=0;G.timer={t:24,label:'SPLICING FEED'};setObj('Stay at the junction until the splice holds',[44,5]);emitNoise(u.x,u.y,900,'machine');sfx('breaker');
      scene(null,[[44,5]],()=>{say('MARROW','Red to red. Do not stop for anything.');});}
    if(u.id==='exit')completeLevel();},
  update(dt){
    const p=G.p,c=world.g[Math.floor(p.y/T)*world.w+Math.floor(p.x/T)];let warm=c==='.'||c===':';if(!warm)for(const l of world.lights)if(l.kind==='f'&&dist(l.x,l.y,p.x,p.y)<175){warm=true;break;}
    const k=G.diffId==='story'?.7:G.diffId==='whiteout'?1.3:1;G.flags.cold=clamp(G.flags.cold+(warm?-.3:.036*k)*dt,0,1);
    G.hud={label:warm?'WARMING':'EXPOSURE',val:G.flags.cold,col:G.flags.cold>.75?'#ff3b2a':'#9fd4ff'};
    if(G.flags.cold>=1){G.flags.ct=(G.flags.ct||0)-dt;if(G.flags.ct<=0){G.flags.ct=.6;p.hp-=4*G.diff.dmg;G.dmgFx=Math.max(G.dmgFx,.5);sfx('beat');if(p.hp<=0)killPlayer('The cold took you. Warm up at burning drums and inside huts.');}}
    if(G.flags.splice){const u=world.uses.find(u=>u.id==='junction');if(dist(u.x,u.y,p.x,p.y)>150&&G.timer){G.timer.t=Math.min(24,G.timer.t+dt*2);G.hintT=(G.hintT||0)-dt;if(G.hintT<=0){G.hintT=3;toast('GET BACK TO THE JUNCTION');}}
      G.flags.wt-=dt;if(G.flags.wt<=0){G.flags.wave++;G.flags.wt=8;for(const t of(G.flags.wave%2?['husk','husk','crawler']:['crawler','crawler','husk']))spawnWave(this,t);if(G.flags.wave%2===0)dropLoot(44*T+rand(-60,60),7*T);}}
  },
  onTimer(){G.flags.splice=false;G.flags.radio=1;const u=world.uses.find(u=>u.id==='junction');u.done=true;world.uses.find(u=>u.id==='exit').enabled=true;sfx('uiok');setObj('Reach the Drill Hall — south-east',[55,25]);
    scene(null,[[44,5],'p',[44,5],[44,5],[44,5],'p',[44,5],[55,24]],()=>{
      say('REYES','...any station, any station, Aurelian — Kit?! Kit, we logged you as lost six hours ago.');
      say('MARROW','Not lost. Thirty-one crew, Tomas. Most of them are still walking. None of them are still people.');
      say('REYES','Then listen fast. Meridian has grounded every aircraft on the coast. They are calling it a contamination matter. Their matter.');
      say('CARROW','Warrant Officer Marrow. Vivian Carrow. This is a Consortium channel now. Mr Reyes, you may go.');
      say('CARROW','There is a core sample at the bottom of that borehole. When you are holding it, you and I will talk about aircraft.');
      say('MARROW','...Tomas? Tomas, come back.');
      say('SYS','AURELIAN DISPATCH — CARRIER LOST.');
      say('BRANDT','And now you have met Vivian. Drill hall. South-east. Go.');});}
};

const LV_CLIMB={name:'THE LONG CLIMB',sub:'Pump galleries · 2,100 m to the surface',theme:'ice',amb:[13,28,36],size:[62,30,'^'],wind:.02,starts:[[30,26],[50,26]],
  build(b){
    b.cave([[10,26],[6,20],[12,15],[7,9],[12,4]],2.3);b.blob(12,15,3);b.blob(10,26,2.6);
    b.cave([[30,26],[35,21],[27,16],[34,10],[28,5]],2.3);b.blob(27,16,3.2);b.blob(30,26,2.6);
    b.cave([[50,26],[46,20],[54,15],[48,9],[52,4]],2.4);b.blob(54,15,3.4);b.blob(50,26,2.6);b.start=[10,26];
    b.props('M',[[26,14],[27,14]]);b.props('C',[[13,17],[55,17],[29,27]]);
    b.en('crawler',[[7,20],[11,16],[8,10],[31,13],[47,19],[50,7]]);b.en('husk',[[12,6],[34,22],[28,17],[25,16],[33,11],[51,5]]);b.en('spitter',[[13,13],[47,10],[55,13]]);b.en('screamer',[[29,8]]);b.en('brute',[[53,15]]);
    b.log('hoistlog',11,27);b.log('climber',6,19);b.log('pumpnote',28,15);
    b.item('rf',[[9,24],[25,17],[56,16],[31,27]]);b.item('med',[[13,15],[35,10],[46,9],[51,27]]);b.item('sh',[[6,10],[49,24],[29,25]]);b.item('a9',[[33,25],[53,6]]);b.item('flare',[[33,23],[11,5]]);b.item('salvage',[[27,18],[55,16]]);
    b.use('ladA',12,3,'CLIMB TO GALLERY TWO','console');b.use('ladB',28,4,'CLIMB TO GALLERY ONE','console');b.use('exit',52,3,'CLIMB OUT OF THE SHAFT','console');
    b.light('t',[[6,20],[12,15],[7,9],[35,21],[27,16],[34,10],[46,20],[54,15],[48,9]]);b.light('a',[[10,26],[12,4],[30,26],[28,5],[50,26],[52,4]]);
    b.spawns=[[10,26],[30,26],[50,26],[35,21],[46,20]];
  },
  onStart(){G.flags.pulse=7;G.flags.sec=0;setObj('Climb — reach the ladder to Gallery Two',[12,3]);
    scene('climb',['p','p',[12,4]],()=>{
      say('MARROW','Hoist is jammed. Two thousand metres to go, and it\'s ladders.');
      say('BRANDT','...pump galleries. Three of them... Marrow, the core. It calls to them. When it hums, be still. Be very...');
      say('MARROW','Ilse? ...Right. Ladders.');});
    hint('The core PULSES. When the bar fills, SNEAK and stand still, or everything nearby hears it.',11);},
  climb(u,tx,ty,sec,obj,ot){const p=G.p;p.x=tx*T+24;p.y=ty*T+24;p.kx=p.ky=0;G.cam.x=p.x;G.cam.y=p.y;G.fade=1;G.flags.sec=sec;G.flags.cw=6;u.enabled=false;sfx('door');setObj(obj,ot);reveal();
    for(const e of world.enemies)if(!e.dead&&e.state==='hunt'&&dist(e.x,e.y,p.x,p.y)>900){e.state='return';e.relentless=false;}},
  onUse(u){
    if(u.id==='ladA'){this.climb(u,30,26,1,'Climb — reach the ladder to Gallery One',[28,4]);
      scene(null,['p'],()=>{say('CORE','kit. talk to me. kit. talk to me. kit.');say('MARROW','That\'s Tomas. That is Tomas\'s voice. It only ever heard him through my radio.');});}
    if(u.id==='ladB'){this.climb(u,50,26,2,'Climb out of the shaft',[52,3]);
      scene(null,['p'],()=>{say('CORE','socks only. no generator. socks only. do not call them by their names.');say('MARROW','Stop it. Stop.');say('CORE','it does not help. and you will want it to.');});}
    if(u.id==='exit')completeLevel();},
  update(dt){const p=G.p,per=G.diffId==='whiteout'?5.5:G.diffId==='story'?9:7;const o=G.flags.pulse;G.flags.pulse-=dt;
    G.hud={label:'CORE PULSE',val:1-clamp(G.flags.pulse/per,0,1),col:G.flags.pulse<1.2?'#ff3b2a':'#3fffd0'};
    if(o>1.2&&G.flags.pulse<=1.2)sfx('hum');
    if(G.flags.pulse<=0){G.flags.pulse=per;const still=p.crouch&&p.moveAmt<.25;emitNoise(p.x,p.y,still?90:560,'door');world.rings.push({x:p.x,y:p.y,R:still?90:460,t:0,life:.9,k:'scream'});floatText(p.x,p.y-30,still?'MUFFLED':'IT CALLS',still?'#7fe3d0':'#ff8a7a');if(!still)addShake(3);}
    if(G.flags.sec>0){G.flags.cw-=dt;if(G.flags.cw<=0){G.flags.cw=13;const alive=world.enemies.reduce((n,e)=>n+(!e.dead&&e.state==='hunt'?1:0),0);if(alive<5){const s=G.flags.sec===1?[30,26]:[50,26];if(dist(s[0]*T,s[1]*T,p.x,p.y)>300){const e=spawnEnemy('crawler',s[0]*T+24,s[1]*T+24);e.state='hunt';e.relentless=true;sfx('skitter',e.x,e.y);}}}}
  }
};
LEVELS.splice(2,0,LV_UNDER);LEVELS.splice(4,0,LV_MAST);LEVELS.splice(7,0,LV_CLIMB);
const CHAPTER_NUM=['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE'];
const DRILL_I=LEVELS.findIndex(l=>l.name==='THE DRILL HALL');
(function migrate(){if(store.v>=2)return;const m=[0,1,3,5,6,8];if(store.run&&store.run.level!==undefined)store.run.level=m[store.run.level]!==undefined?m[store.run.level]:0;if(store.cleared)store.cleared=m[Math.min(5,store.cleared)];store.v=2;saveStore();})();

/* ================= ENTITIES ================= */
const PMAX=420,parts=[];for(let i=0;i<PMAX;i++)parts.push({on:false,x:0,y:0,vx:0,vy:0,life:0,max:1,size:1,col:'#fff',type:0,drag:1});
let pIdx=0;
function part(x,y,vx,vy,life,size,col,type,drag){const lim=G.low?170:PMAX;if(pIdx>=lim)pIdx=0;const p=parts[pIdx++];p.on=true;p.x=x;p.y=y;p.vx=vx;p.vy=vy;p.life=p.max=life;p.size=size;p.col=col;p.type=type||0;p.drag=drag===undefined?3:drag;}
function fxIchor(x,y,a,n){for(let i=0;i<n;i++){const d=a+rand(-.7,.7),s=rand(60,300);part(x,y,Math.cos(d)*s,Math.sin(d)*s,rand(.25,.6),rand(1.5,3.6),Math.random()<.25?'#3fffd0':'#16403a',0,5);}}
function fxBlood(x,y,n){for(let i=0;i<n;i++){const d=rand(TAU),s=rand(40,220);part(x,y,Math.cos(d)*s,Math.sin(d)*s,rand(.25,.5),rand(1.5,3.2),'#a01414',0,5);}}
function fxSpark(x,y,a,n,col){for(let i=0;i<n;i++){const d=a+rand(-.9,.9),s=rand(80,420);part(x,y,Math.cos(d)*s,Math.sin(d)*s,rand(.1,.35),rand(1,2.2),col||'#ffd58a',1,4);}}
function fxSmoke(x,y,n,col){for(let i=0;i<n;i++){const d=rand(TAU),s=rand(8,50);part(x,y,Math.cos(d)*s,Math.sin(d)*s,rand(.5,1.2),rand(5,11),col||'rgba(200,210,220,.22)',2,1.5);}}
const floats=[];function floatText(x,y,t,c){if(floats.length>16)floats.shift();for(let k=0;k<4;k++)for(const f of floats)if(Math.abs(f.x-x)<70&&Math.abs(f.y-y)<15)y-=17;floats.push({x,y,t,c:c||'#e6edf3',life:1.3});}
function addShake(n){if(store.settings.shake)G.shake=Math.min(30,Math.max(G.shake,n));}

/* ---------- player ---------- */
function newPlayer(){return{x:0,y:0,r:13,a:0,hp:100,st:1,exh:0,weapons:[],cur:0,mag:{pistol:0,shotgun:0,carbine:0},ammo:{a9:0,sh:0,rf:0},flares:0,medkits:0,salvage:0,keys:{},
  crouch:false,light:true,cd:0,reload:0,melee:0,meleeHit:false,kick:0,walk:0,moveAmt:0,stepD:0,inv:0,sprinting:false,kx:0,ky:0,healFx:0,mcd:0};}
const maxHp=()=>100+25*U('parka');
const magSize=w=>Math.round(w.mag*(1+.34*U('mags')));
const maxFlares=()=>4+2*U('pouch');
const curWeap=()=>{const p=G.p;return p.weapons.length?WEAP[p.weapons[p.cur]]:null;};
function updatePlayer(dt){
  const p=G.p;let ix=0,iy=0;
  if(keys.KeyW||keys.ArrowUp)iy-=1;if(keys.KeyS||keys.ArrowDown)iy+=1;if(keys.KeyA||keys.ArrowLeft)ix-=1;if(keys.KeyD||keys.ArrowRight)ix+=1;
  let m=Math.hypot(ix,iy);if(m>1){ix/=m;iy/=m;m=1;}
  if(touch.mv.id!==null){ix=touch.mv.x;iy=touch.mv.y;m=Math.hypot(ix,iy);if(m<.15){ix=iy=m=0;}}
  if(pressed.KeyC){p.crouch=!p.crouch;sfx('ui');}
  p.exh=Math.max(0,p.exh-dt);
  let sprint=(keys.ShiftLeft||keys.ShiftRight)&&m>.1&&p.exh<=0&&p.st>0;if(sprint)p.crouch=false;p.sprinting=sprint;
  const lung=1+.4*U('lungs');
  if(sprint){p.st-=dt/(3.4*lung);if(p.st<=0){p.st=0;p.exh=1.4;}}else p.st=Math.min(1,p.st+dt/(4.2/lung));
  let spd=p.crouch?80:sprint?245:152;if(p.melee>0)spd*=.7;if(p.reload>0)spd*=.9;
  const ox=p.x,oy=p.y;p.x+=ix*spd*dt+p.kx*dt;p.y+=iy*spd*dt+p.ky*dt;p.kx*=Math.pow(.001,dt);p.ky*=Math.pow(.001,dt);pushOut(p,bm);
  if(G.boss&&!G.boss.dead){const b=G.boss,d=dist(p.x,p.y,b.x,b.y),mn=b.r+p.r-6;if(d<mn&&d>0){p.x=b.x+(p.x-b.x)/d*mn;p.y=b.y+(p.y-b.y)/d*mn;pushOut(p,bm);}}
  const moved=dist(ox,oy,p.x,p.y);p.moveAmt=lerp(p.moveAmt,m>0.05?1:0,Math.min(1,dt*10));p.walk+=moved*.085;
  if(touch.aim.id!==null){const am=Math.hypot(touch.aim.x,touch.aim.y);if(am>.2)p.a=Math.atan2(touch.aim.y,touch.aim.x);}
  else if(touch.on&&!mouse.moved){if(m>.2)p.a=Math.atan2(iy,ix);}
  else p.a=Math.atan2(mouse.wy-p.y,mouse.wx-p.x);
  p.stepD+=moved;const stride=sprint?64:p.crouch?44:54;
  if(p.stepD>stride){p.stepD=0;const snow=G.lvl.theme==='surface'&&world.g[Math.floor(p.y/T)*world.w+Math.floor(p.x/T)]===',';
    let nr=(p.crouch?26:sprint?270:118)*(1-.35*U('soles'))*(touch.on&&m<.55&&!sprint?.5:1);const glass=world.g[Math.floor(p.y/T)*world.w+Math.floor(p.x/T)]===';';if(glass){nr*=p.crouch?1.7:2.3;sfx('glass');}emitNoise(p.x,p.y,nr,'step');if(!p.crouch||Math.random()<.4)sfx(snow?'stepsnow':'step');
    if(snow){world.bgc.fillStyle='rgba(90,120,165,.28)';const s=(p.walk%2<1?1:-1)*5;ell(world.bgc,p.x-Math.sin(p.a)*s,p.y+Math.cos(p.a)*s,5,3,p.a);}}
  p.cd=Math.max(0,p.cd-dt);p.mcd=Math.max(0,p.mcd-dt);p.kick=Math.max(0,p.kick-dt*7);p.inv=Math.max(0,p.inv-dt);p.healFx=Math.max(0,p.healFx-dt);
  const w=curWeap();
  if(p.reload>0){p.reload-=dt;if(p.reload<=0&&w){const need=magSize(w)-p.mag[w.id],take=Math.min(need,p.ammo[w.ammo]);p.mag[w.id]+=take;p.ammo[w.ammo]-=take;sfx('reloaded');}}
  let sw=0;if(pressed.WheelDown||pressed.KeyX)sw=1;if(pressed.WheelUp)sw=-1;for(let i=0;i<3;i++)if(pressed['Digit'+(i+1)]&&i<p.weapons.length&&i!==p.cur){p.cur=i;p.reload=0;p.cd=.25;sfx('reload');}
  if(sw&&p.weapons.length>1){p.cur=(p.cur+sw+p.weapons.length)%p.weapons.length;p.reload=0;p.cd=.25;sfx('reload');}
  const tFire=touch.aim.id!==null&&Math.hypot(touch.aim.x,touch.aim.y)>.82;
  if(w){if((mouse.down||tFire||pressed.Mouse0)&&p.melee<=0&&p.cd<=0){const held=!pressed.Mouse0&&!w.auto;fire(w);if(held&&p.cd>0&&p.reload<=0)p.cd=Math.max(p.cd,w.rate*1.45);}}else if(pressed.Mouse0||tFire)melee();
  if(pressed.Mouse2||pressed.KeyV)melee();
  if(pressed.KeyR&&w&&p.reload<=0&&p.mag[w.id]<magSize(w)&&p.ammo[w.ammo]>0){p.reload=w.reload;sfx('reload');}
  if(pressed.KeyF){p.light=!p.light;sfx('ui');}
  if(pressed.KeyG)throwFlare();
  if(pressed.KeyQ||pressed.KeyH){if(p.medkits>0&&p.hp<maxHp()){p.medkits--;p.hp=Math.min(maxHp(),p.hp+45*(1+.5*U('medic')));p.healFx=1;sfx('heal');floatText(p.x,p.y-24,'+HEALTH','#7dff9a');}else sfx('empty');}
  if(p.melee>0){p.melee-=dt;if(!p.meleeHit&&p.melee<.3){p.meleeHit=true;let hit=false;const dmg=46*(1+.4*U('axe'));
    for(const e of world.enemies){if(e.dead)continue;const d=dist(p.x,p.y,e.x,e.y);if(d>58+e.r)continue;if(Math.abs(angDiff(p.a,Math.atan2(e.y-p.y,e.x-p.x)))>1.05&&d>e.r+16)continue;if(!los(p.x,p.y,e.x,e.y,bb)&&e.type!=='boss')continue;hurtEnemy(e,dmg,p.a,'axe');hit=true;}
    if(hit){sfx('chop');G.hitStop=Math.max(G.hitStop,.07);addShake(5);}emitNoise(p.x,p.y,hit?90:50,'step');}}
  /* interaction */
  G.prompt=null;let best=null,bd=70;
  for(const u of world.uses){if(!u.enabled)continue;const d=dist(p.x,p.y,u.x,u.y);if(d<bd){bd=d;best=u;}}
  let bl=null;if(!best){bd=58;for(const it of world.items){if(it.type!=='log')continue;const d=dist(p.x,p.y,it.x,it.y);if(d<bd){bd=d;bl=it;}}}
  if(best){G.prompt={x:best.x,y:best.y,t:best.label};if(pressed.KeyE){sfx('ui');G.lvl.onUse(best);}}
  else if(bl){G.prompt={x:bl.x,y:bl.y,t:'READ'};if(pressed.KeyE)pickLog(bl);}
  for(let i=world.items.length-1;i>=0;i--){const it=world.items[i];if(it.type==='log')continue;if(dist(p.x,p.y,it.x,it.y)<32&&pickup(it))world.items.splice(i,1);}
  for(const r of world.radios){if(!r.done&&dist(p.x,p.y,r.x,r.y)<r.r){r.done=true;if(G.lvl.onRadio)G.lvl.onRadio(r.id);}}
}
function pickLog(it){const i=world.items.indexOf(it);if(i>=0)world.items.splice(i,1);sfx('log');G.stats.logs++;if(!store.codex.includes(it.id)){store.codex.push(it.id);saveStore();}openLog(it.id,true);}
function pickup(it){const p=G.p,L=G.diff.loot;let txt='',col='#e6edf3';
  switch(it.type){
    case'a9':{const n=Math.round(8*L);p.ammo.a9+=n;txt='+'+n+' 9mm';break;}
    case'sh':{const n=Math.round(4*L);p.ammo.sh+=n;txt='+'+n+' 12g';break;}
    case'rf':{const n=Math.round(14*L);p.ammo.rf+=n;txt='+'+n+' 5.56';break;}
    case'med':if(p.medkits>=5)return false;p.medkits++;txt='+MEDKIT';col='#7dff9a';break;
    case'flare':if(p.flares>=maxFlares())return false;p.flares++;txt='+FLARE';col='#ff8a5a';break;
    case'salvage':{const n=Math.round(rand(20,32)*L);p.salvage+=n;txt='+'+n+' SALVAGE';col='#ffcf5a';break;}
    case'key':p.keys[it.id]=true;txt=it.id.toUpperCase()+' KEYCARD';col=KEYCOL[it.id];sfx('key');break;
    case'quest':G.flags['has_'+it.id]=1;txt='SPLICE KIT';col='#ffcf5a';sfx('key');break;
    case'vial':txt='COMPOUND 12';col='#7fe3d0';sfx('key');break;
    case'weapon':{if(!p.weapons.includes(it.id)){p.weapons.push(it.id);p.cur=p.weapons.length-1;p.reload=0;}const w=WEAP[it.id];p.mag[it.id]=magSize(w);p.ammo[w.ammo]+=w.mag;if(it.id==='pistol')p.flares=Math.max(p.flares,2);txt=w.name;col='#ffcf5a';sfx('key');break;}
  }
  if(it.type!=='key'&&it.type!=='vial'&&it.type!=='weapon')sfx('pickup');floatText(it.x,it.y-14,txt,col);if(G.lvl.onPickup)G.lvl.onPickup(it);return true;}
const KEYCOL={red:'#ff5040',blue:'#4aa8ff',yellow:'#ffd23a'};
function spawnItem(type,x,y,id,fixed){world.items.push({type,x,y,id,ph:rand(TAU),fixed:!!fixed});}
function fire(w){const p=G.p;if(p.reload>0||p.cd>0)return;
  if(p.mag[w.id]<=0){if(p.ammo[w.ammo]>0){p.reload=w.reload;sfx('reload');}else{sfx('empty');p.cd=.25;if(pressed.Mouse0)toast('OUT OF '+AMMO_NAME[w.ammo]+' — RIGHT-CLICK FOR THE AXE');}return;}
  p.mag[w.id]--;p.cd=w.rate;p.kick=1;G.stats.shots++;
  const ca=Math.cos(p.a),sa=Math.sin(p.a);let mx=p.x+ca*(w.len+16)-sa*4,my=p.y+sa*(w.len+16)+ca*4;if(!los(p.x,p.y,mx,my,bb)){mx=p.x;my=p.y;}
  const choke=w.id==='shotgun'&&U('choke');const spread=w.spread*(choke?.6:1)*(p.crouch?.65:1)*(p.sprinting?1.6:1);
  for(let i=0;i<w.pellets;i++)hitscan(mx,my,p.a+rand(-spread,spread),w.range,w.dmg*(choke?1.2:1));
  const supp=w.id==='pistol'&&U('supp');
  world.flashes.push({x:mx+ca*8,y:my+sa*8,r:supp?110:w.id==='shotgun'?330:250,t:0,life:.07});
  fxSpark(mx+ca*6,my+sa*6,p.a,supp?2:w.id==='shotgun'?10:5);fxSmoke(mx+ca*10,my+sa*10,w.id==='shotgun'?4:1);
  part(p.x+ca*6+sa*6,p.y+sa*6-ca*6,sa*rand(60,120)+ca*rand(-30,30),-ca*rand(60,120)+sa*rand(-30,30),.5,w.id==='shotgun'?3.4:2.2,w.id==='shotgun'?'#b3261e':'#d8b060',3,4);
  addShake(supp?1.5:w.shake);emitNoise(p.x,p.y,supp?190:w.noise,'shot');sfx(supp?'pistol_s':w.snd);
  p.kx-=ca*w.shake*8;p.ky-=sa*w.shake*8;
}
function hitscan(ox,oy,a,range,dmg){const dx=Math.cos(a),dy=Math.sin(a);let dw=castRay(ox,oy,dx,dy,range,bb),best=null,bt=dw;
  for(const e of world.enemies){if(e.dead)continue;const ex=e.x-ox,ey=e.y-oy,t=ex*dx+ey*dy;if(t<-e.r||t>bt+e.r)continue;const perp=Math.abs(ex*dy-ey*dx);if(perp>e.r+3)continue;const th=t-Math.sqrt(Math.max(0,(e.r+3)*(e.r+3)-perp*perp));if(th<bt){bt=Math.max(0,th);best=e;}}
  const hx=ox+dx*bt,hy=oy+dy*bt;if(world.tracers.length>40)world.tracers.shift();world.tracers.push({x1:ox,y1:oy,x2:hx,y2:hy,t:0});
  if(best){hurtEnemy(best,dmg*(bt>range*.7?.7:1),a,'shot');}else if(dw<range){fxSpark(hx,hy,a+Math.PI,4);if(Math.random()<.5)decal(hx-dx*2,hy-dy*2,'hole');}
}
function melee(){const p=G.p;if(p.melee>0||p.mcd>0)return;p.melee=.42;p.mcd=.55;p.meleeHit=false;sfx('swing');}
function throwFlare(){const p=G.p;if(p.flares<=0){sfx('empty');return;}p.flares--;let d=touch.on&&!mouse.moved?260:clamp(dist(p.x,p.y,mouse.wx,mouse.wy),90,400);
  d=Math.max(20,castRay(p.x,p.y,Math.cos(p.a),Math.sin(p.a),d,bm)-16);world.flares.push({x:p.x,y:p.y,sx:p.x,sy:p.y,tx:p.x+Math.cos(p.a)*d,ty:p.y+Math.sin(p.a)*d,t:0,fly:.5,life:13,nt:0,landed:false,pts:null,r:310,ph:0});sfx('swing');}
function hurtPlayer(dmg,fx,fy){const p=G.p;if(p.inv>0||G.state!=='play')return;dmg*=G.diff.dmg;p.hp-=dmg;p.inv=.4;G.dmgFx=1;addShake(9);G.hitStop=Math.max(G.hitStop,.05);sfx('hurt');fxBlood(p.x,p.y,10);decal(p.x,p.y,'blood');G.stats.hurt+=dmg;
  const d=dist(fx,fy,p.x,p.y)||1;p.kx+=(p.x-fx)/d*260;p.ky+=(p.y-fy)/d*260;if(p.hp<=0)killPlayer();}
function killPlayer(reason){const p=G.p;if(G.state!=='play')return;p.hp=0;G.stats.deaths++;decal(p.x,p.y,'blood',2);fxBlood(p.x,p.y,30);gameOver(reason);}

/* ---------- noise ---------- */
function emitNoise(x,y,r,kind){
  r*=G.diff.hear;const pn=kind==='step'||kind==='shot'||kind==='door';if(pn)G.noiseHud=Math.max(G.noiseHud,clamp(r/700,0,1));
  if(r>70&&kind!=='growl'){if(world.rings.length>14)world.rings.shift();world.rings.push({x,y,R:Math.min(r,460),t:0,life:kind==='step'?.45:.7,k:kind});}
  for(const e of world.enemies){if(e.dead||e.type==='boss')continue;
    if(e.state==='hunt'){if(kind==='lure'&&e.lost>1.2&&!e.relentless&&dist(x,y,e.x,e.y)<r){e.state='investigate';e.tx=x;e.ty=y;e.st=0;e.path=null;e.pt=0;}continue;}
    const d=dist(x,y,e.x,e.y);if(d>r)continue;const eff=los(x,y,e.x,e.y)?r:r*.6;if(d>eff)continue;
    if(kind==='scream'||(kind==='machine'&&d<eff*.6)||(kind==='shot'&&d<eff*.4)){alertEnemy(e,true);continue;}
    if(kind==='growl'&&e.state!=='dormant')continue;
    if(e.state==='dormant')sfx('growl',e.x,e.y);
    e.state='investigate';e.tx=x+rand(-18,18);e.ty=y+rand(-18,18);e.st=0;e.path=null;e.pt=0;
  }
}

/* ---------- enemies ---------- */
function spawnEnemy(type,x,y){const d=ET[type];const hp=d.hp*(type==='boss'?(G.diffId==='story'?.8:G.diffId==='whiteout'?1.2:1):G.diff.hp);
  const e={type,x,y,r:d.r,hp,maxHp:hp,a:rand(TAU),ha:0,state:'dormant',t:rand(10),st:0,atk:0,cd:rand(.5),path:null,pi:0,pt:0,tx:x,ty:y,hx:x,hy:y,flash:0,lit:0,kx:0,ky:0,ph:rand(TAU),dead:false,
    v:randi(0,3),lost:0,stun:0,walk:0,mv:0,leap:0,charge:0,wind:0,scream:0,screamCd:0,relentless:false,sing:0,bashT:0};
  e.ha=e.a;world.enemies.push(e);return e;}
function spawnWave(lvl,type){const p=G.p;let pts=lvl.spawnList.filter(s=>dist(s[0]*T,s[1]*T,p.x,p.y)>330);if(!pts.length)pts=lvl.spawnList;const s=pick(pts);
  const e=spawnEnemy(type,s[0]*T+24+rand(-14,14),s[1]*T+24+rand(-14,14));pushOut(e,bm);e.state='hunt';e.relentless=true;if(type==='screamer')e.screamCd=4;return e;}
function alertEnemy(e,loud){if(e.dead||e.state==='hunt')return;const first=e.state==='dormant';e.state='hunt';e.st=0;e.lost=0;e.path=null;e.pt=0;
  if(e.type==='boss')return;
  sfx(e.type==='crawler'?'skitter':e.type==='brute'?'roar':'alert',e.x,e.y);if(G.lvl.onAlert)G.lvl.onAlert(e);
  if(e.type==='screamer'&&e.screamCd<=0){e.scream=1.5;e.screamCd=11;}
  if(loud&&first)emitNoise(e.x,e.y,210,'growl');}
function hurtEnemy(e,dmg,a,kind){if(e.dead)return;let m=1,silent=false;
  if(kind==='axe'&&e.state!=='hunt'&&e.type!=='boss'&&e.type!=='brute'){m=3.4;silent=true;}
  if(e.type==='brute'&&e.stun>0)m*=1.7;if(e.type==='boss'){if(e.state!=='hunt')return;if(e.sing>0)m*=2;}
  e.hp-=dmg*m;e.flash=1;const kb=e.type==='boss'?0:e.type==='brute'?40:kind==='axe'?260:150;e.kx+=Math.cos(a)*kb;e.ky+=Math.sin(a)*kb;
  fxIchor(e.x,e.y,a,kind==='axe'?12:6);if(Math.random()<.4)decal(e.x+Math.cos(a)*18,e.y+Math.sin(a)*18,'ichor');sfx('hit',e.x,e.y);
  if(e.type==='boss'&&e.sing>0)floatText(e.x+rand(-30,30),e.y-40,'EXPOSED','#3fffd0');
  if(e.hp<=0)killEnemy(e,silent,a);else if(e.state!=='hunt')alertEnemy(e,true);}
function killEnemy(e,silent,a){e.dead=true;G.stats.kills++;G.stats.score+=e.type==='brute'?80:e.type==='boss'?1000:e.type==='husk'?10:20;
  drawCorpse(e);decal(e.x,e.y,'ichor',e.type==='brute'?2.2:1.4);fxIchor(e.x,e.y,a||0,e.type==='boss'?80:18);fxSmoke(e.x,e.y,3,'rgba(120,255,225,.12)');
  if(e.type==='boss'){sfx('bossdie');G.hitStop=.5;addShake(26);for(const o of world.enemies)if(!o.dead&&o!==e){o.hp=0;killEnemy(o,false,rand(TAU));}world.shots.length=0;world.hazards.length=0;}
  else{sfx('kill',e.x,e.y);G.hitStop=Math.max(G.hitStop,e.type==='brute'?.14:.055);addShake(e.type==='brute'?10:3);}
  if(silent){floatText(e.x,e.y-26,'SILENT KILL','#7fe3d0');G.stats.silent++;}else if(e.type!=='boss')emitNoise(e.x,e.y,150,'growl');
  if(e.type!=='boss'&&Math.random()<.3*G.diff.loot*(e.type==='brute'?3:1))dropLoot(e.x,e.y);
  if(G.lvl.onKill)G.lvl.onKill(e);}
function dropLoot(x,y,force){const p=G.p,o=[];if(p.weapons.includes('pistol'))o.push('a9','a9');if(p.weapons.includes('shotgun'))o.push('sh');if(p.weapons.includes('carbine'))o.push('rf','rf');
  if(G.mode!=='holdout'&&!G.boss&&!G.flags.hold)o.push('salvage','salvage');if(p.hp<maxHp()*.5)o.push('med');if(p.flares<2)o.push('flare');if(!o.length)o.push('salvage');spawnItem(pick(o),x,y);}
function steer(e,tx,ty,spd,dt){
  let gx=tx,gy=ty;
  if(!walkClear(e.x,e.y,tx,ty,e.r*.8)){
    e.pt-=dt;if(!e.path||e.pt<=0){e.path=findPath(e.x,e.y,tx,ty);e.pi=0;e.pt=.45+rand(.35);}
    if(e.path&&e.path.length){const w=world.w;let n=e.path[Math.min(e.pi,e.path.length-1)];let nx=(n%w)*T+24,ny=((n/w)|0)*T+24;
      if(dist(e.x,e.y,nx,ny)<18&&e.pi<e.path.length-1){e.pi++;n=e.path[e.pi];nx=(n%w)*T+24;ny=((n/w)|0)*T+24;}
      if(e.pi<e.path.length-1){const n2=e.path[e.pi+1],x2=(n2%w)*T+24,y2=((n2/w)|0)*T+24;if(walkClear(e.x,e.y,x2,y2,e.r*.8)){e.pi++;nx=x2;ny=y2;}}
      gx=nx;gy=ny;}
  }else e.path=null;
  const d=dist(e.x,e.y,gx,gy);if(d<2)return;const dx=(gx-e.x)/d,dy=(gy-e.y)/d;
  e.a+=angDiff(e.a,Math.atan2(dy,dx))*Math.min(1,dt*9);const ox=e.x,oy=e.y;e.x+=dx*spd*dt;e.y+=dy*spd*dt;
  if(pushOut(e,bm)){for(const D of world.doors){if(!D.open&&!D.lock&&dist(D.x,D.y,e.x,e.y)<52){D.bash+=dt;if(D.bash>.55){D.bash=0;openDoor(D,150);}}}}
  const mv=dist(ox,oy,e.x,e.y);e.walk+=mv*.09;e.mv=1;e.stepD=(e.stepD||0)+mv;if(e.stepD>70){e.stepD=0;if(e.state==='hunt')sfx('estep',e.x,e.y);}
}
function shootSpit(x,y,a,spd,dmg){if(world.shots.length>90)return;world.shots.push({x,y,vx:Math.cos(a)*spd,vy:Math.sin(a)*spd,life:4,dmg,ph:rand(TAU)});}
function updateEnemy(e,dt){
  const p=G.p,d=ET[e.type];let dp=dist(e.x,e.y,p.x,p.y);
  e.flash=Math.max(0,e.flash-dt*5);e.cd=Math.max(0,e.cd-dt);e.t+=dt;e.st+=dt;e.mv=Math.max(0,e.mv-dt*6);e.screamCd=Math.max(0,e.screamCd-dt);
  if(e.kx||e.ky){e.x+=e.kx*dt;e.y+=e.ky*dt;const f=Math.pow(.0015,dt);e.kx*=f;e.ky*=f;if(Math.abs(e.kx)+Math.abs(e.ky)<4)e.kx=e.ky=0;pushOut(e,bm);}
  if(e.type==='boss'){updateBoss(e,dt,dp);return;}
  if(e.stun>0){e.stun-=dt;return;}
  let tg=p;const npc=G.npc;if(npc&&npc.state==='follow'&&e.state==='hunt'){const dn=dist(e.x,e.y,npc.x,npc.y);if(dn<dp*.8&&dn<280){tg=npc;dp=dn;}}
  const ap=Math.atan2(tg.y-e.y,tg.x-e.x);
  if(e.state!=='hunt'){
    const prox=(p.crouch?36:p.sprinting?130:74)*(e.state==='dormant'?1:1.45)*G.diff.hear;
    if(dp<prox&&(dp<38||los(e.x,e.y,p.x,p.y)))alertEnemy(e,true);
    else if(e.state!=='dormant'&&dp<200&&Math.abs(angDiff(e.a,ap))<1.1&&los(e.x,e.y,p.x,p.y))alertEnemy(e,true);
    else if(p.light&&dp<270+60*U('lens')&&Math.abs(angDiff(p.a,ap+Math.PI))<.36&&los(e.x,e.y,p.x,p.y)){e.lit+=dt;if(e.lit>1)alertEnemy(e,true);}else e.lit=Math.max(0,e.lit-dt*.6);
    if(e.state==='hunt')return;
  }
  switch(e.state){
    case'dormant':e.a=e.ha+Math.sin(e.t*.6+e.ph)*.12;break;
    case'investigate':steer(e,e.tx,e.ty,d.spd*.58,dt);if(dist(e.x,e.y,e.tx,e.ty)<34||e.st>14){e.state='search';e.st=0;}break;
    case'search':e.a+=Math.sin(e.t*1.7)*dt*1.8;if(e.st>3.6){e.state='return';e.st=0;e.path=null;e.pt=0;}break;
    case'return':steer(e,e.hx,e.hy,d.spd*.45,dt);if(dist(e.x,e.y,e.hx,e.hy)<26||e.st>25){e.state='dormant';e.ha=e.a;}break;
    case'hunt':{
      const see=los(e.x,e.y,tg.x,tg.y);if(see)e.lost=0;else e.lost+=dt;
      if(e.lost>8&&dp>380&&!e.relentless&&!G.flags.hold){e.state='investigate';e.tx=tg.x;e.ty=tg.y;e.st=0;e.path=null;break;}
      if(e.scream>0){const o=e.scream;e.scream-=dt;e.a+=angDiff(e.a,ap)*Math.min(1,dt*6);if(o>1.05&&e.scream<=1.05){sfx('shriek',e.x,e.y);emitNoise(e.x,e.y,980,'scream');addShake(4);world.rings.push({x:e.x,y:e.y,R:420,t:0,life:.9,k:'scream'});}break;}
      if(e.type==='screamer'&&e.screamCd<=0&&see&&dp<520){e.scream=1.5;e.screamCd=11;break;}
      if(e.atk>0){e.atk-=dt;e.a+=angDiff(e.a,ap)*Math.min(1,dt*8);if(e.atk<=0){
        if(e.type==='spitter'){const lead=dp/300;shootSpit(e.x+Math.cos(e.a)*16,e.y+Math.sin(e.a)*16,Math.atan2(tg.y+0*0-e.y,tg.x-e.x)+rand(-.07,.07),300,d.dmg);sfx('spit',e.x,e.y);e.cd=2.1;}
        else{if(dp<e.r+tg.r+24&&Math.abs(angDiff(e.a,ap))<1.2){hurtT(tg,d.dmg,e.x,e.y);}e.cd=e.type==='brute'?1.2:.85;}}
        break;}
      if(e.type==='crawler'){
        if(e.leap>0){e.leap-=dt;e.x+=Math.cos(e.la)*540*dt;e.y+=Math.sin(e.la)*540*dt;e.walk+=dt*30;e.mv=1;const hw=pushOut(e,bm);if(dist(e.x,e.y,tg.x,tg.y)<e.r+tg.r+2){hurtT(tg,d.dmg,e.x,e.y);e.leap=0;}if(hw)e.leap=0;if(e.leap<=0)e.cd=1.25;break;}
        if(see&&dp<175&&dp>50&&e.cd<=0){e.leap=.3;e.la=ap;e.a=ap;sfx('skitter',e.x,e.y);break;}
      }
      if(e.type==='brute'){
        if(e.charge>0){e.charge-=dt;e.x+=Math.cos(e.la)*450*dt;e.y+=Math.sin(e.la)*450*dt;e.walk+=dt*24;e.mv=1;e.a=e.la;const hw=pushOut(e,bm);
          if(Math.random()<.5)fxSmoke(e.x,e.y,1);
          if(dist(e.x,e.y,tg.x,tg.y)<e.r+tg.r+2){hurtT(tg,34,e.x,e.y);e.charge=0;addShake(14);}
          else if(hw){e.charge=0;e.stun=1.8;sfx('slam',e.x,e.y);addShake(13);fxSpark(e.x+Math.cos(e.la)*e.r,e.y+Math.sin(e.la)*e.r,e.la+Math.PI,14);fxSmoke(e.x,e.y,8);floatText(e.x,e.y-34,'STUNNED','#ffcf5a');emitNoise(e.x,e.y,500,'door');}
          if(e.charge<=0&&e.stun<=0)e.cd=1;break;}
        if(e.wind>0){e.wind-=dt;e.a+=angDiff(e.a,ap)*Math.min(1,dt*5);if(e.wind<=0){e.charge=1.05;e.la=e.a;}break;}
        if(see&&dp>120&&dp<420&&e.cd<=0){e.wind=.8;e.cd=4.5;sfx('roar',e.x,e.y);break;}
      }
      if(e.type==='spitter'&&see&&dp<440){
        e.a+=angDiff(e.a,ap)*Math.min(1,dt*6);
        if(dp<190){const ox=e.x,oy=e.y;e.x-=Math.cos(ap)*d.spd*dt;e.y-=Math.sin(ap)*d.spd*dt;pushOut(e,bm);e.walk+=dist(ox,oy,e.x,e.y)*.09;e.mv=1;}
        else if(dp>330)steer(e,tg.x,tg.y,d.spd,dt);
        if(e.cd<=0&&los(e.x,e.y,tg.x,tg.y,bb)){e.atk=.55;}
        break;}
      if(dp<e.r+tg.r+12){if(e.cd<=0){e.atk=e.type==='brute'?.5:.32;}e.a+=angDiff(e.a,ap)*Math.min(1,dt*8);}
      else steer(e,tg.x,tg.y,d.spd*(e.type==='husk'?1+.1*Math.sin(e.t*3+e.ph):1),dt);
      break;}
  }
}
function updateBoss(e,dt,dp){
  const p=G.p;if(e.state!=='hunt'){e.a+=dt*.1;return;}
  const ph=e.hp<e.maxHp*.3?3:e.hp<e.maxHp*.62?2:1;if(ph!==e.phase){e.phase=ph;if(ph>1){sfx('roar');addShake(14);e.acd=1.2;toast(ph===2?'THE CHORUS STIRS':'THE CHORUS IS BREAKING');}}
  e.a+=angDiff(e.a,Math.atan2(p.y-e.y,p.x-e.x))*Math.min(1,dt*2);e.sing=Math.max(0,e.sing-dt);
  e.acd=(e.acd===undefined?2.2:e.acd)-dt;
  if(e.acd<=0){e.pat=((e.pat===undefined?-1:e.pat)+1)%4;const k=e.pat;
    if(k===0){const n=10+ph*4,off=rand(TAU);for(let i=0;i<n;i++)shootSpit(e.x+Math.cos(off+i/n*TAU)*e.r*.8,e.y+Math.sin(off+i/n*TAU)*e.r*.8,off+i/n*TAU,170+ph*22,10);sfx('spit');e.acd=2.3-ph*.3;}
    else if(k===1){for(let i=0;i<2+ph;i++)world.hazards.push({x:p.x+(i?rand(-110,110):0),y:p.y+(i?rand(-110,110):0),r:64,t:0,delay:.9+i*.3,dmg:18});sfx('roar',e.x,e.y);e.acd=2.5-ph*.25;}
    else if(k===2){e.sing=3.3;sfx('shriek');addShake(6);world.rings.push({x:e.x,y:e.y,R:460,t:0,life:1,k:'scream'});const alive=world.enemies.reduce((n,o)=>n+(o.dead||o===e?0:1),0);
      if(alive<6){for(let i=0;i<1+ph;i++)spawnWave(G.lvl,'crawler');if(ph===3)spawnWave(G.lvl,'husk');}for(let i=0;i<3;i++){const a=rand(TAU),d=rand(150,250);if(world.items.length<16)dropLoot(e.x+Math.cos(a)*d,e.y+Math.sin(a)*d+30);}e.acd=3.8;}
    else{e.spiral=1.5+ph*.3;e.acd=3-ph*.2;}}
  if(e.spiral>0){e.spiral-=dt;e.spt=(e.spt||0)-dt;if(e.spt<=0){e.spt=.085;const a=e.t*3.1;shootSpit(e.x+Math.cos(a)*e.r*.8,e.y+Math.sin(a)*e.r*.8,a,210,10);if(ph>1)shootSpit(e.x-Math.cos(a)*e.r*.8,e.y-Math.sin(a)*e.r*.8,a+Math.PI,210,10);if(Math.random()<.3)sfx('spit',e.x,e.y);}}
  if(dp<e.r+p.r+2)hurtPlayer(16,e.x,e.y);
}
function openDoor(d,loud){if(d.open)return;d.open=true;sfx('door',d.x,d.y);relight(d.x,d.y);if(loud)emitNoise(d.x,d.y,loud,'door');}
function openLock(name){for(const d of world.doors)if(d.lock===name){d.lock=null;openDoor(d,0);}}
const LOCKMSG={red:'RED KEYCARD REQUIRED',blue:'BLUE KEYCARD REQUIRED',yellow:'YELLOW KEYCARD REQUIRED',lift:'CAGE LOCKED — THE LIFT IS NOT HERE',choice:'SEALED — MAKE YOUR DECISION FIRST'};
function updateWorld(dt){
  const p=G.p;
  for(const d of world.doors){if(d.open){d.amt=Math.min(1,d.amt+dt*5);continue;}d.deny-=dt;d.bash=Math.max(0,d.bash-dt*.3);
    if(dist(d.x,d.y,p.x,p.y)<68){if(d.lock){if(p.keys[d.lock]){d.lock=null;openDoor(d,p.crouch?60:170);}else if(d.deny<=0){d.deny=1.8;sfx('denied');toast(LOCKMSG[d.lock]||'LOCKED');}}else openDoor(d,p.crouch?60:170);}}
  /* enemies */
  let hunting=0;const en=world.enemies;
  for(let i=0;i<en.length;i++){const e=en[i];if(e.dead)continue;if(e.state==='hunt')hunting++;else if(dist(e.x,e.y,p.x,p.y)>1500)continue;updateEnemy(e,dt);}
  for(let i=0;i<en.length;i++){const a=en[i];if(a.dead||a.type==='boss')continue;for(let j=i+1;j<en.length;j++){const b=en[j];if(b.dead)continue;const dx=b.x-a.x,dy=b.y-a.y,mn=a.r+b.r;if(Math.abs(dx)>mn||Math.abs(dy)>mn)continue;const d=Math.hypot(dx,dy);if(d<mn&&d>.01){const o=(mn-d)/d*.5;if(b.type==='boss'){a.x-=dx*o*2;a.y-=dy*o*2;}else{a.x-=dx*o;a.y-=dy*o;b.x+=dx*o;b.y+=dy*o;}}}}
  if(en.length>70||G.time%3<dt)for(let i=en.length-1;i>=0;i--)if(en[i].dead)en.splice(i,1);
  music.tt=clamp((hunting?0.35:0)+hunting*.12+(G.boss?.5:0)+(G.timer?.4:0),0,1);G.hunting=hunting;
  /* projectiles */
  for(let i=world.shots.length-1;i>=0;i--){const s=world.shots[i];s.x+=s.vx*dt;s.y+=s.vy*dt;s.life-=dt;let rm=s.life<=0;
    if(bb(Math.floor(s.x/T),Math.floor(s.y/T))){rm=true;fxIchor(s.x,s.y,Math.atan2(-s.vy,-s.vx),5);sfx('splat',s.x,s.y);}
    else if(dist(s.x,s.y,p.x,p.y)<p.r+7){rm=true;hurtPlayer(s.dmg,s.x-s.vx,s.y-s.vy);fxIchor(s.x,s.y,0,6);}
    if(rm)world.shots.splice(i,1);}
  for(let i=world.hazards.length-1;i>=0;i--){const h=world.hazards[i];h.t+=dt;if(h.t>=h.delay){if(dist(h.x,h.y,p.x,p.y)<h.r+p.r-4)hurtPlayer(h.dmg,h.x,h.y);sfx('slam',h.x,h.y);addShake(9);fxIchor(h.x,h.y,0,10);fxSmoke(h.x,h.y,8,'rgba(120,255,225,.14)');for(let k=0;k<10;k++)fxSpark(h.x,h.y,k/10*TAU,2,'#7fffe0');decal(h.x,h.y,'scorch',1.1);world.hazards.splice(i,1);}}
  for(let i=world.flares.length-1;i>=0;i--){const f=world.flares[i];f.t+=dt;f.ph+=dt*30;
    if(f.t<f.fly){const k=f.t/f.fly;f.x=lerp(f.sx,f.tx,k);f.y=lerp(f.sy,f.ty,k);}
    else{if(!f.landed){f.landed=true;f.x=f.tx;f.y=f.ty;sfx('flare',f.x,f.y);computeLight(f);}f.nt-=dt;if(f.nt<=0){f.nt=.8;emitNoise(f.x,f.y,560,'lure');}
      if(Math.random()<.6)fxSpark(f.x,f.y,rand(TAU),1,'#ff8a70');f.life-=dt;if(f.life<=0)world.flares.splice(i,1);}}
  for(let i=world.flashes.length-1;i>=0;i--){const f=world.flashes[i];f.t+=dt;if(f.t>f.life)world.flashes.splice(i,1);}
  for(let i=world.rings.length-1;i>=0;i--){const r=world.rings[i];r.t+=dt;if(r.t>r.life)world.rings.splice(i,1);}
  for(let i=world.tracers.length-1;i>=0;i--){const t=world.tracers[i];t.t+=dt;if(t.t>.07)world.tracers.splice(i,1);}
  for(let i=floats.length-1;i>=0;i--){const f=floats[i];f.life-=dt;f.y-=dt*26;if(f.life<=0)floats.splice(i,1);}
  for(const l of world.lights)if(l.boot>0)l.boot-=dt;
  const lim=G.low?170:PMAX;for(let i=0;i<lim;i++){const q=parts[i];if(!q.on)continue;q.life-=dt;if(q.life<=0){q.on=false;if(q.type===3&&world.bgc){world.bgc.fillStyle=q.col;world.bgc.fillRect(q.x-1.5,q.y-1,q.size+1,2);}continue;}const f=Math.exp(-q.drag*dt);q.vx*=f;q.vy*=f;q.x+=q.vx*dt;q.y+=q.vy*dt;}
  if(G.timer){G.timer.t-=dt;if(G.timer.t<=10&&Math.floor(G.timer.t)!==Math.floor(G.timer.t+dt))sfx('alarm');if(G.timer.t<=0){G.timer=null;G.lvl.onTimer();}}
  if(G.lvl.update)G.lvl.update(dt);
  if(G.lvl.theme==='surface'&&Math.random()<dt*14){const a=rand(TAU);}
  G.rev=(G.rev||0)-dt;if(G.rev<=0){G.rev=.15;reveal();}
  if(p.hp<maxHp()*.3){G.hb=(G.hb||0)-dt;if(G.hb<=0){G.hb=.9;sfx('beat');}}
  updateVents(dt);if(G.fade>0)G.fade=Math.max(0,G.fade-dt*2.2);
  G.noiseHud=Math.max(0,G.noiseHud-dt*.9);G.dmgFx=Math.max(0,G.dmgFx-dt*1.6);
}

/* ================= RENDER ================= */
const FH='"Bahnschrift","DIN Condensed","Oswald","Arial Narrow","Helvetica Neue",sans-serif',FM='"Consolas","SF Mono","Menlo","DejaVu Sans Mono",monospace';
const lightC=document.createElement('canvas'),lctx=lightC.getContext('2d');let LS=2;
const vigC=document.createElement('canvas'),grainC=document.createElement('canvas');
const flakes=[];for(let i=0;i<170;i++)flakes.push({x:Math.random(),y:Math.random(),z:rand(.4,1.4)});
function resize(){
  G.low=store.settings.quality==='low';DPR=G.low?1:Math.min(window.devicePixelRatio||1,2);W=canvas.width=Math.floor(innerWidth*DPR);H=canvas.height=Math.floor(innerHeight*DPR);
  zoom=DPR*Math.sqrt(innerWidth*innerHeight)/(T*15.5);zoomBase=zoom;UI=DPR*clamp(Math.min(innerWidth,innerHeight)/760,.62,1.35);
  LS=G.low?3:2;lightC.width=Math.ceil(W/LS);lightC.height=Math.ceil(H/LS);
  vigC.width=Math.ceil(W/4);vigC.height=Math.ceil(H/4);const v=vigC.getContext('2d');const gr=v.createRadialGradient(vigC.width/2,vigC.height/2,Math.min(vigC.width,vigC.height)*.35,vigC.width/2,vigC.height/2,Math.hypot(vigC.width,vigC.height)*.56);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.72)');v.fillStyle=gr;v.fillRect(0,0,vigC.width,vigC.height);
  if(!grainC.width||grainC.width!==160){grainC.width=grainC.height=160;const gg=grainC.getContext('2d'),id=gg.createImageData(160,160);for(let i=0;i<id.data.length;i+=4){const n=Math.random()*255;id.data[i]=id.data[i+1]=id.data[i+2]=n;id.data[i+3]=26;}gg.putImageData(id,0,0);}
}
addEventListener('resize',resize);
function txt(s,x,y,size,col,align,font,weight){ctx.font=(weight||'600')+' '+Math.round(size*UI)+'px '+(font||FH);ctx.fillStyle=col;ctx.textAlign=align||'left';ctx.fillText(s,x,y);}
function wrap(s,maxW){const out=[];for(const para of s.split('\n')){let line='';for(const w of para.split(' ')){const t=line?line+' '+w:w;if(ctx.measureText(t).width>maxW&&line){out.push(line);line=w;}else line=t;}out.push(line);}return out;}

/* ---------- figures ---------- */
const HUSKC=['#3d5a78','#5a6b3a','#6e3b34','#565a61'];
function filaments(g,e,n,len,alpha,dead){g.strokeStyle=`rgba(63,255,208,${alpha})`;g.lineWidth=1.2;g.beginPath();for(let i=0;i<n;i++){const a=Math.PI+(i-(n-1)/2)*.5,w=dead?0:Math.sin(e.t*2.2+i*1.9+e.ph)*.35;let x=Math.cos(a)*4,y=Math.sin(a)*4;g.moveTo(x,y);for(let s=1;s<=3;s++){const aa=a+w*s*.5+Math.sin(i*7+s)*.4;x+=Math.cos(aa)*len/3;y+=Math.sin(aa)*len/3;g.lineTo(x,y);}}g.stroke();}
function drawEnemy(g,e,dead){
  if(e.type==='boss'){drawBoss(g,e,dead);return;}
  g.save();g.translate(e.x,e.y);if(!dead){g.fillStyle='rgba(0,0,0,.35)';ell(g,2,4,e.r,e.r);}
  let sh=0;if(e.wind>0||e.lit>.25&&e.state!=='hunt')sh=Math.sin(e.t*60)*1.4;g.rotate(e.a+(dead?rand(-.4,.4):0));g.translate(sh,0);
  const hunt=e.state==='hunt'||dead,sw=Math.sin(e.walk)*5*(e.mv>0?1:0),atk=e.atk>0?1:0;g.lineCap='round';
  if(e.type==='husk'){const c=HUSKC[e.v];g.fillStyle='#22262b';ell(g,sw-1,-6,7,4.4);ell(g,-sw-1,6,7,4.4);
    g.strokeStyle=c;g.lineWidth=5.5;g.beginPath();if(dead){g.moveTo(0,-10);g.lineTo(-10,-20);g.moveTo(0,10);g.lineTo(12,19);}else if(hunt){g.moveTo(0,-10);g.lineTo(15+atk*5+sw*.4,-7-atk*6);g.moveTo(0,10);g.lineTo(15+atk*5-sw*.4,7+atk*6);}else{g.moveTo(-1,-11);g.lineTo(3,-13);g.moveTo(-1,11);g.lineTo(3,13);}g.stroke();
    g.fillStyle=c;ell(g,-1,0,9,13.5);g.fillStyle='rgba(0,0,0,.22)';ell(g,-4,0,5.5,12);g.fillStyle='rgba(200,235,240,.25)';ell(g,-3,-6,3,4);
    if(!dead){g.fillStyle='#aeb9b6';if(hunt){ell(g,17+atk*5+sw*.4,-7-atk*6,3,3);ell(g,17+atk*5-sw*.4,7+atk*6,3,3);}}
    g.fillStyle='#b4c0bd';g.beginPath();g.arc(2,(e.v-1.5)*.8,7,0,TAU);g.fill();g.fillStyle=['#2a2420','#6b5a3a','#1b1b1e','#8a8f96'][e.v];g.beginPath();g.arc(.5,(e.v-1.5)*.8,7,1.5,4.8);g.fill();
    g.save();g.translate(1,0);filaments(g,e,3,13,.55,dead);g.restore();}
  else if(e.type==='crawler'){g.strokeStyle='#4a545c';g.lineWidth=4;g.beginPath();const ph=e.walk*1.4;for(let i=0;i<4;i++){const fx=i<2?7:-8,sd=i%2?1:-1,s=Math.sin(ph+i*1.6)*6*(e.mv>0||dead?1:.2);g.moveTo(fx,sd*4);g.lineTo(fx+(i<2?8:-6)+s,sd*14);g.lineTo(fx+(i<2?13:-12)+s*1.4,sd*(16+(e.leap>0?4:0)));}g.stroke();
    g.fillStyle='#56616a';ell(g,-2,0,13,6.5);g.fillStyle='rgba(0,0,0,.25)';ell(g,-6,0,7,5);g.fillStyle='#b9c6c2';ell(g,11,0,5.5,5);g.fillStyle='#0b0f10';ell(g,14.5,0,2,3.2);
    g.save();g.translate(6,0);filaments(g,e,5,16,.7,dead);g.restore();}
  else if(e.type==='screamer'){const sc=e.scream>0&&e.scream<1.05;g.fillStyle='#1d2126';ell(g,sw,-4.5,6,3.6);ell(g,-sw,4.5,6,3.6);
    g.strokeStyle='#7d8791';g.lineWidth=4;g.beginPath();if(sc){g.moveTo(0,-8);g.lineTo(-2,-22);g.moveTo(0,8);g.lineTo(-2,22);}else{g.moveTo(0,-8);g.lineTo(9,-12);g.moveTo(0,8);g.lineTo(9,12);}g.stroke();
    g.fillStyle='#8b959f';ell(g,-1,0,6.5,10);g.fillStyle='#c6d2ce';g.beginPath();g.arc(3,0,7.5,0,TAU);g.fill();
    g.fillStyle=sc?'#3fffd0':'#0a0d0e';g.beginPath();g.moveTo(4,0);g.lineTo(11,-(sc?6:3.4));g.lineTo(11,(sc?6:3.4));g.closePath();g.fill();
    g.save();g.translate(0,0);filaments(g,e,4,15,.6,dead);g.restore();}
  else if(e.type==='spitter'){g.fillStyle='#22262b';ell(g,sw,-7,7,4.6);ell(g,-sw,7,7,4.6);g.strokeStyle='#9aa39a';g.lineWidth=6;g.beginPath();g.moveTo(0,-12);g.lineTo(8,-13);g.moveTo(0,12);g.lineTo(8,13);g.stroke();
    g.fillStyle='#9aa39a';ell(g,-1,0,12,14.5);g.fillStyle='rgba(60,70,50,.35)';ell(g,-5,3,6,8);g.fillStyle='#b9c4bf';g.beginPath();g.arc(4,0,6.5,0,TAU);g.fill();
    const gl=e.atk>0?1:.45+.2*Math.sin(e.t*3);g.fillStyle=`rgba(63,255,208,${gl})`;ell(g,10,0,4+e.atk*4,5+e.atk*4);g.fillStyle='rgba(10,40,36,.6)';ell(g,10,0,2,3);
    g.save();g.translate(-4,0);filaments(g,e,3,14,.5,dead);g.restore();}
  else if(e.type==='brute'){g.fillStyle='#1b1e22';ell(g,sw,-10,11,6.5);ell(g,-sw,10,11,6.5);
    g.strokeStyle='#9c5418';g.lineWidth=10;g.beginPath();g.moveTo(0,-18);g.lineTo(14+atk*8,-20);g.stroke();
    g.strokeStyle='#2b4f4c';g.lineWidth=14;g.beginPath();g.moveTo(0,18);g.lineTo(20+atk*10,22-atk*8);g.stroke();g.fillStyle='#3d6f69';ell(g,24+atk*10,23-atk*8,10,9);g.strokeStyle='rgba(63,255,208,.6)';g.lineWidth=1.5;g.beginPath();g.moveTo(8,18);g.lineTo(18+atk*10,26-atk*8);g.lineTo(30+atk*10,20-atk*8);g.stroke();
    g.fillStyle='#b3611e';ell(g,-2,0,17,23);g.fillStyle='rgba(0,0,0,.25)';ell(g,-8,0,9,20);g.fillStyle='#e8e2cc';g.fillRect(-4,-21,3,9);g.fillRect(-4,12,3,9);g.fillStyle='#30353c';g.fillRect(-14,-9,7,18);
    g.fillStyle='#d9d2c0';g.beginPath();g.arc(3,0,10.5,0,TAU);g.fill();g.strokeStyle='#8f8a7c';g.lineWidth=2;g.beginPath();g.moveTo(-6,0);g.lineTo(12,0);g.stroke();g.fillStyle='#14181b';g.beginPath();g.arc(5,0,8,-.9,.9);g.fill();g.strokeStyle='rgba(63,255,208,.8)';g.lineWidth=1.2;g.beginPath();g.moveTo(8,-4);g.lineTo(11,1);g.lineTo(9,5);g.stroke();
    if(e.stun>0){g.fillStyle='rgba(255,207,90,.8)';for(let i=0;i<3;i++){const a=e.t*5+i*2.1;ell(g,3+Math.cos(a)*14,Math.sin(a)*14,2,2);}}}
  if(e.flash>0&&!dead){g.globalAlpha=e.flash*.65;g.fillStyle='#fff';ell(g,0,0,e.r*.9,e.r*1.05);g.globalAlpha=1;}
  if(dead){g.fillStyle='rgba(6,14,14,.45)';ell(g,0,0,e.r*1.25,e.r*1.35);}
  g.restore();
}
function drawBoss(g,e,dead){
  g.save();g.translate(e.x,e.y);const t=dead?3:e.t;
  if(dead){decalAt(g,0,0,170);g.globalAlpha=.8;}
  for(let i=0;i<10;i++){const a=i/10*TAU+Math.sin(t*.6+i)*.16,L=(dead?70:96)+Math.sin(t*1.3+i*2)*18;const x1=Math.cos(a)*34,y1=Math.sin(a)*34,a2=a+.5*Math.sin(t+i),a3=a+.35*Math.sin(t*1.7+i*3);
    g.strokeStyle='#17302f';g.lineWidth=12;g.lineCap='round';g.beginPath();g.moveTo(x1,y1);g.quadraticCurveTo(Math.cos(a2)*L*.6,Math.sin(a2)*L*.6,Math.cos(a3)*L,Math.sin(a3)*L);g.stroke();
    g.strokeStyle='rgba(63,255,208,.35)';g.lineWidth=2;g.stroke();}
  const gr=g.createRadialGradient(-8,-8,6,0,0,60);gr.addColorStop(0,'#3d6763');gr.addColorStop(1,'#0c1a1b');g.fillStyle=gr;g.beginPath();for(let i=0;i<=18;i++){const a=i/18*TAU,r=50+6*Math.sin(t*2+i*1.7);if(i===0)g.moveTo(Math.cos(a)*r,Math.sin(a)*r);else g.lineTo(Math.cos(a)*r,Math.sin(a)*r);}g.fill();
  g.fillStyle='rgba(200,235,245,.5)';for(let i=0;i<7;i++){const a=i/7*TAU+.4;g.save();g.rotate(a);g.beginPath();g.moveTo(38,-5);g.lineTo(62,0);g.lineTo(38,5);g.fill();g.restore();}
  g.strokeStyle='rgba(63,255,208,.4)';g.lineWidth=1.5;for(let i=0;i<8;i++){const a=i/8*TAU+t*.1;g.beginPath();g.moveTo(Math.cos(a)*10,Math.sin(a)*10);g.quadraticCurveTo(Math.cos(a+.5)*30,Math.sin(a+.5)*30,Math.cos(a+.2)*46,Math.sin(a+.2)*46);g.stroke();}
  g.rotate(e.a);g.strokeStyle='#263a52';g.lineWidth=7;g.beginPath();g.moveTo(16,-14);g.lineTo(2,-26);g.moveTo(16,14);g.lineTo(2,26);g.stroke();
  g.fillStyle='#2f4866';ell(g,18,0,12,17);g.fillStyle='#c9d4d2';g.beginPath();g.arc(28,0,8.5,0,TAU);g.fill();g.fillStyle='#e9eef0';g.beginPath();g.arc(26.5,0,8.5,1.6,4.7);g.fill();
  g.fillStyle=e.sing>0?'#3fffd0':'#0a0d0e';g.beginPath();g.moveTo(30,0);g.lineTo(37,-(e.sing>0?6:2.5));g.lineTo(37,(e.sing>0?6:2.5));g.closePath();g.fill();
  if(e.flash>0&&!dead){g.globalAlpha=e.flash*.5;g.fillStyle='#fff';ell(g,0,0,52,52);}
  g.restore();
}
function drawCorpse(e){const g=world.bgc;if(!g)return;drawEnemy(g,e,true);}
function drawPlayer(g,p){
  g.save();g.translate(p.x,p.y);g.fillStyle='rgba(0,0,0,.35)';ell(g,2,4,13,13);g.rotate(p.a);if(p.crouch)g.scale(.9,.9);
  const sw=Math.sin(p.walk)*6*p.moveAmt,k=p.kick*3.5,w=curWeap();g.lineCap='round';
  g.fillStyle='#1b1e23';ell(g,sw,-6,7.5,4.6);ell(g,-sw,6,7.5,4.6);
  g.fillStyle='#2c3138';rr(g,-17,-9,10,18,3);g.fill();g.fillStyle='#4a525c';g.fillRect(-15,-6,3,12);
  g.fillStyle='#c4481c';ell(g,-1,0,9.5,14);g.fillStyle='#a53b16';ell(g,-4.5,0,5.5,12.5);g.fillStyle='#ece6cf';g.fillRect(-2,-13.4,2.4,5);g.fillRect(-2,8.4,2.4,5);
  if(p.melee>0){const t=1-p.melee/.42,sa=lerp(-1.5,1.3,Math.min(1,t*1.7));g.strokeStyle='#c4481c';g.lineWidth=6;g.beginPath();g.moveTo(1,-10);g.lineTo(9,-9);g.stroke();
    g.save();g.translate(3,7);g.rotate(sa);g.strokeStyle='#c4481c';g.lineWidth=6;g.beginPath();g.moveTo(0,0);g.lineTo(14,0);g.stroke();g.fillStyle='#22262b';ell(g,15,0,3.6,3.6);
    g.strokeStyle='#cfd4d9';g.lineWidth=2.6;g.beginPath();g.moveTo(13,0);g.lineTo(36,0);g.stroke();g.fillStyle='#ff7a1a';g.fillRect(14,-1.8,8,3.6);g.fillStyle='#e8ecef';g.beginPath();g.moveTo(31,-1.5);g.lineTo(38,-10);g.lineTo(40,-2);g.lineTo(36,4);g.lineTo(32,1.5);g.closePath();g.fill();g.restore();}
  else if(w){const fx=w.id==='pistol'?12:21;g.strokeStyle='#c4481c';g.lineWidth=6;g.beginPath();g.moveTo(2,10);g.lineTo(12-k,5);g.stroke();g.beginPath();g.moveTo(2,-10);g.lineTo(fx-k,2);g.stroke();
    g.fillStyle='#16181b';
    if(w.id==='pistol'){g.fillRect(10-k,1.4,14,4.4);g.fillStyle='#30353c';g.fillRect(12-k,2.2,10,1.3);if(U('supp')){g.fillStyle='#0d0e10';g.fillRect(24-k,1.9,10,3.4);}}
    else if(w.id==='shotgun'){g.fillRect(4-k,1.2,32,4.6);g.fillStyle='#5f4024';g.fillRect(0-k,.8,9,5.4);g.fillRect(17-k,.5,10,6);g.fillStyle='#3a3f46';g.fillRect(32-k,1.9,6,3.2);}
    else{g.fillRect(1-k,1,29,5);g.fillStyle='#2e333a';g.fillRect(12-k,-.8,9,2);g.fillRect(14-k,5.6,4.5,6.5);g.fillStyle='#0d0e10';g.fillRect(30-k,2.2,8,2.4);}
    g.fillStyle='#22262b';ell(g,12-k,5,3.4,3.4);ell(g,fx-k,2.6,3.2,3.2);
    if(p.reload>0){g.fillStyle='#ffcf5a';g.fillRect(8,9,3,5);}}
  else{g.strokeStyle='#c4481c';g.lineWidth=6;g.beginPath();g.moveTo(2,10);g.lineTo(11,9);g.stroke();g.beginPath();g.moveTo(2,-10);g.lineTo(9,-9);g.stroke();g.fillStyle='#22262b';ell(g,12,9,3.4,3.4);
    g.strokeStyle='#cfd4d9';g.lineWidth=2.6;g.beginPath();g.moveTo(10,9);g.lineTo(30,6);g.stroke();g.fillStyle='#ff7a1a';g.fillRect(11,7,7,3.4);g.fillStyle='#e8ecef';g.beginPath();g.moveTo(26,5);g.lineTo(32,-3);g.lineTo(35,4);g.lineTo(31,9);g.closePath();g.fill();}
  g.fillStyle='#8f3312';g.beginPath();g.arc(0,0,8.4,0,TAU);g.fill();g.strokeStyle='#d9cdb8';g.lineWidth=2.6;g.beginPath();g.arc(.5,0,7.4,-1.3,1.3);g.stroke();
  g.fillStyle='#14171a';rr(g,2.6,-4.6,4.4,9.2,2);g.fill();g.fillStyle='rgba(120,200,255,.55)';g.fillRect(4.6,-3.4,1.4,3);
  if(p.light){g.fillStyle='#fff7d6';g.beginPath();g.arc(-1,-9.5,2,0,TAU);g.fill();}
  if(p.inv>0){g.globalAlpha=p.inv;g.fillStyle='#ff3020';ell(g,0,0,12,14);}
  g.restore();
}
function drawItem(g,it,t){
  g.save();g.translate(it.x,it.y);g.fillStyle='rgba(0,0,0,.4)';ell(g,1,3,11,6);
  switch(it.type){
    case'a9':g.fillStyle='#b99a5a';rr(g,-9,-6,18,12,2);g.fill();g.fillStyle='#22262b';g.fillRect(-9,-2,18,4);g.fillStyle='#e8d9a0';for(let i=0;i<4;i++)ell(g,-6+i*4,-4.3,1.2,1.2);break;
    case'sh':for(let i=0;i<3;i++){g.fillStyle='#b3261e';g.fillRect(-9+i*6.5,-7,5,11);g.fillStyle='#d8b060';g.fillRect(-9+i*6.5,4,5,3.5);}break;
    case'rf':g.fillStyle='#5d6b4a';rr(g,-10,-7,20,14,2);g.fill();g.fillStyle='#d8b060';g.fillRect(-7,-4,14,2);g.fillStyle='#22262b';g.fillRect(-7,1,14,2.5);break;
    case'med':g.fillStyle='#e9ecef';rr(g,-10,-8,20,16,3);g.fill();g.fillStyle='#d42a20';g.fillRect(-2.2,-6,4.4,12);g.fillRect(-6,-2.2,12,4.4);break;
    case'flare':g.rotate(.5);g.fillStyle='#c8301f';rr(g,-11,-3,22,6,2);g.fill();g.fillStyle='#e9ecef';g.fillRect(6,-3,5,6);g.fillStyle='#22262b';g.fillRect(-11,-3,4,6);break;
    case'salvage':g.fillStyle='#8a939c';g.beginPath();g.moveTo(-9,-3);g.lineTo(-2,-8);g.lineTo(8,-5);g.lineTo(10,3);g.lineTo(1,7);g.lineTo(-8,5);g.closePath();g.fill();g.fillStyle='#555d66';g.beginPath();g.arc(1,0,3.4,0,TAU);g.fill();g.fillStyle='#ffcf5a';g.fillRect(4,-7,4,4);break;
    case'key':g.rotate(-.3);g.fillStyle=KEYCOL[it.id];rr(g,-10,-6.5,20,13,2);g.fill();g.fillStyle='rgba(255,255,255,.85)';g.fillRect(-7,-4,6,5);g.fillStyle='rgba(0,0,0,.45)';g.fillRect(-7,2.5,14,1.6);break;
    case'quest':g.fillStyle='#d9a81c';rr(g,-12,-7,24,15,2);g.fill();g.fillStyle='#16181b';g.fillRect(-12,-1,24,2.5);g.fillRect(-4,-10.5,8,3.5);g.fillStyle='#e9ecef';g.fillRect(-2,0,4,3);break;
    case'vial':g.fillStyle='#dfe6ea';rr(g,-4,-10,8,20,3);g.fill();g.fillStyle='#3fffd0';rr(g,-3,-2,6,11,2);g.fill();g.fillStyle='#22262b';g.fillRect(-4,-10,8,3.4);break;
    case'weapon':{g.rotate(-.5);g.fillStyle='#ff7a1a';rr(g,-22,-12,44,24,3);g.fill();g.fillStyle='#c25410';g.fillRect(-22,-2,44,4);g.fillStyle='#16181b';if(it.id==='pistol'){g.fillRect(-9,-6,17,5);g.fillRect(-9,-2,5,8);}else if(it.id==='shotgun'){g.fillRect(-19,-6,38,4.5);g.fillStyle='#5f4024';g.fillRect(-19,-6.5,10,6);}else{g.fillRect(-18,-6,34,5);g.fillRect(-4,-1,4.5,8);g.fillRect(-18,-7,8,3);}break;}
    case'log':g.rotate(Math.sin(it.ph)*.5);g.fillStyle='#2a3038';rr(g,-9,-11,18,22,2);g.fill();g.fillStyle='#93b7c9';g.fillRect(-7,-9,14,15);g.fillStyle='rgba(20,30,40,.7)';for(let i=0;i<4;i++)g.fillRect(-5,-7+i*3.4,10-(i%2)*3,1.3);g.fillStyle=Math.sin(t*5+it.ph)>0?'#ffb23a':'#5a4012';ell(g,0,8.4,1.4,1.4);break;
  }
  g.restore();
}
function drawUse(g,u,t){
  g.save();g.translate(u.x,u.y);const on=u.enabled,col=u.done?'#3d4650':on?'#39ff9a':'#ff5a3c';
  if(u.kind==='console'){g.fillStyle='rgba(0,0,0,.4)';rr(g,-17,-11,38,28,3);g.fill();g.fillStyle='#39424c';rr(g,-19,-14,38,28,3);g.fill();g.fillStyle='#0d1114';g.fillRect(-15,-11,30,15);g.fillStyle=col;g.globalAlpha=.85;g.fillRect(-13,-9,26,3);g.fillRect(-13,-4,16+Math.sin(t*3)*6,2);g.fillRect(-13,0,10,2);g.globalAlpha=1;g.fillStyle='#22262b';g.fillRect(-15,7,30,5);for(let i=0;i<5;i++){g.fillStyle=i===0?col:'#59636e';g.fillRect(-13+i*6,8,4,3);}}
  else if(u.kind==='generator'){g.fillStyle='#22262b';rr(g,-16,-12,32,24,3);g.fill();g.fillStyle='#d9a81c';g.fillRect(-13,-9,26,5);g.fillStyle='#16181b';for(let i=0;i<4;i++)g.fillRect(-13+i*7,-9,3.5,5);g.fillStyle=u.done?'#39ff9a':'#ff5a3c';ell(g,-7,4,3.5,3.5);g.strokeStyle='#c9ced4';g.lineWidth=3;g.beginPath();g.moveTo(5,4);g.lineTo(u.done?13:9,u.done?4:-3);g.stroke();}
  else if(u.kind==='breaker'){g.fillStyle='#4a525c';rr(g,-12,-16,24,32,2);g.fill();g.fillStyle='#d9a81c';g.fillRect(-12,-16,24,5);g.fillStyle='#16181b';g.fillRect(-4,-7,8,18);g.fillStyle=u.done?'#39ff9a':'#ff5a3c';rr(g,-6,u.done?4:-8,12,8,2);g.fill();}
  else if(u.kind==='window'){g.fillStyle='#39424c';rr(g,-12,6,24,12,2);g.fill();g.fillStyle=col;ell(g,-6,12,2.5,2.5);g.fillStyle='#16181b';for(let i=0;i<3;i++)g.fillRect(0,9+i*3,8,1.5);}
  else if(u.kind==='core'){if(on||u.done){g.fillStyle='#39424c';ell(g,0,0,20,20);g.fillStyle='#16181b';ell(g,0,0,13,13);if(!u.done){g.fillStyle='#dfe6ea';ell(g,0,0,9,9);g.fillStyle='#3fffd0';ell(g,0,0,5+Math.sin(t*4),5+Math.sin(t*4));}}}
  g.restore();
}
function drawDoor(g,d){
  const x=d.tx*T,y=d.ty*T,o=1-d.amt,lc=d.lock&&KEYCOL[d.lock]?KEYCOL[d.lock]:d.lock?'#ff5a3c':'#d9a81c';
  g.fillStyle='#22272e';if(d.vert){g.fillRect(x,y+12,T,3);g.fillRect(x,y+33,T,3);}else{g.fillRect(x+12,y,3,T);g.fillRect(x+33,y,3,T);}
  if(o<=.02)return;const half=24*o;
  for(let s=0;s<2;s++){g.save();if(d.vert)g.translate(s?x+T-half:x,y+14);else g.translate(x+14,s?y+T-half:y);
    const w=d.vert?half:20,h=d.vert?20:half;g.fillStyle='#59636f';g.fillRect(0,0,w,h);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(0,0,w,2);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(0,h-2,w,2);
    g.fillStyle=lc;if(d.vert)g.fillRect(s?0:Math.max(0,w-5),3,Math.min(5,w),h-6);else g.fillRect(3,s?0:Math.max(0,h-5),w-6,Math.min(5,h));g.restore();}
}

/* ---------- lighting ---------- */
function lightPath(pts,cx,cy){lctx.beginPath();lctx.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)lctx.lineTo(pts[i],pts[i+1]);lctx.closePath();}
function lgrad(x,y,r,c,i){const gr=lctx.createRadialGradient(x,y,2,x,y,r);gr.addColorStop(0,`rgba(${c[0]},${c[1]},${c[2]},${i})`);gr.addColorStop(.5,`rgba(${c[0]},${c[1]},${c[2]},${i*.45})`);gr.addColorStop(1,`rgba(${c[0]},${c[1]},${c[2]},0)`);return gr;}
let flRays=null;
function buildLight(x0,y0,vw,vh){
  const p=G.p,t=G.time,dk=G.flags.dark?.42:1,a=[G.lvl.amb[0]*dk|0,G.lvl.amb[1]*dk|0,G.lvl.amb[2]*dk|0],s=zoom/LS;
  lctx.setTransform(1,0,0,1,0,0);lctx.globalCompositeOperation='source-over';lctx.fillStyle=`rgb(${a[0]},${a[1]},${a[2]})`;lctx.fillRect(0,0,lightC.width,lightC.height);
  lctx.setTransform(s,0,0,s,-x0*s,-y0*s);lctx.globalCompositeOperation='lighter';
  for(const l of world.lights){if(!l.on||l.x<x0-l.r||l.x>x0+vw+l.r||l.y<y0-l.r||l.y>y0+vh+l.r)continue;let f=1;
    if(l.kind==='f')f=.78+.22*Math.sin(t*17+l.ph)*Math.sin(t*7.3);else if(l.kind==='r')f=.5+.5*Math.sin(t*2.2+l.ph);else if(l.kind==='t')f=.72+.28*Math.sin(t*1.1+l.ph);else if(Math.sin(t*29+l.ph*7)>.992)f=.35;
    if(l.boot>0)f*=Math.random()<.5?.15:1;lightPath(l.pts);lctx.fillStyle=lgrad(l.x,l.y,l.r,l.col,l.i*f);lctx.fill();}
  for(const f of world.flares){const fl=.8+.2*Math.sin(f.ph);if(f.landed&&f.pts){lightPath(f.pts);lctx.fillStyle=lgrad(f.x,f.y,f.r,[255,90,60],fl);lctx.fill();}else{lctx.fillStyle=lgrad(f.x,f.y,110,[255,90,60],.8);lctx.fillRect(f.x-110,f.y-110,220,220);}}
  for(const f of world.flashes){if(!f.pts)computeLight(f);lightPath(f.pts);lctx.fillStyle=lgrad(f.x,f.y,f.r,[255,220,160],1-f.t/f.life*.5);lctx.fill();}
  for(const sh of world.shots){lctx.fillStyle=lgrad(sh.x,sh.y,54,[70,255,214],.5);lctx.fillRect(sh.x-54,sh.y-54,108,108);}
  if(G.boss&&!G.boss.dead){const b=G.boss,r=300+(b.sing>0?120:0);lctx.fillStyle=lgrad(b.x,b.y,r,[70,255,214],.55+.15*Math.sin(t*3));lctx.fillRect(b.x-r,b.y-r,r*2,r*2);}
  for(const h of world.hazards){lctx.fillStyle=lgrad(h.x,h.y,h.r*1.6,[70,255,214],.5*h.t/h.delay);lctx.fillRect(h.x-h.r*2,h.y-h.r*2,h.r*4,h.r*4);}
  /* personal aura + flashlight */
  lctx.fillStyle=lgrad(p.x,p.y,86,[150,170,200],.42);lctx.fillRect(p.x-86,p.y-86,172,172);
  if(p.healFx>0){lctx.fillStyle=lgrad(p.x,p.y,120,[90,255,140],p.healFx*.6);lctx.fillRect(p.x-120,p.y-120,240,240);}
  if(p.light){const half=.42+.1*U('lens'),soft=.16,range=480+90*U('lens'),n=G.low?34:60;if(!flRays||flRays.length!==(n+1)*2)flRays=new Float32Array((n+1)*2);
    const ox=p.x+Math.cos(p.a)*6,oy=p.y+Math.sin(p.a)*6;let i0=-1,i1=-1;
    for(let k=0;k<=n;k++){const rel=-half-soft+(2*(half+soft))*k/n,an=p.a+rel,dx=Math.cos(an),dy=Math.sin(an);const d=Math.min(range,castRay(ox,oy,dx,dy,range,bs)+16);flRays[k*2]=ox+dx*d;flRays[k*2+1]=oy+dy*d;if(rel>=-half&&i0<0)i0=k;if(rel<=half)i1=k;}
    const fl=Math.sin(t*41)>.995?.7:1,gr=lctx.createRadialGradient(ox,oy,8,ox,oy,range);gr.addColorStop(0,`rgba(255,246,225,${.5*fl})`);gr.addColorStop(.7,`rgba(255,246,225,${.28*fl})`);gr.addColorStop(1,'rgba(255,246,225,0)');
    lctx.fillStyle=gr;lctx.beginPath();lctx.moveTo(ox,oy);for(let k=0;k<=n;k++)lctx.lineTo(flRays[k*2],flRays[k*2+1]);lctx.closePath();lctx.fill();
    lctx.beginPath();lctx.moveTo(ox,oy);for(let k=i0;k<=i1;k++)lctx.lineTo(flRays[k*2],flRays[k*2+1]);lctx.closePath();lctx.fill();}
}

/* ---------- frame ---------- */
function render(dt){
  const p=G.p,t=G.time;ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='#05070a';ctx.fillRect(0,0,W,H);
  const vw=W/zoom,vh=H/zoom,x0=G.cam.x+G.shx-vw/2,y0=G.cam.y+G.shy-vh/2;
  const WT=()=>ctx.setTransform(zoom,0,0,zoom,-x0*zoom,-y0*zoom);WT();
  const sx=Math.max(0,Math.floor(x0)),sy=Math.max(0,Math.floor(y0)),ex=Math.min(world.bg.width,Math.ceil(x0+vw)),ey=Math.min(world.bg.height,Math.ceil(y0+vh));
  if(ex>sx&&ey>sy)ctx.drawImage(world.bg,sx,sy,ex-sx,ey-sy,sx,sy,ex-sx,ey-sy);
  const vis=(x,y,m)=>x>x0-m&&x<x0+vw+m&&y>y0-m&&y<y0+vh+m;
  for(const d of world.doors)if(vis(d.x,d.y,60))drawDoor(ctx,d);
  for(const v of world.vents)drawVent(ctx,v);
  for(const u of world.uses)if(vis(u.x,u.y,60))drawUse(ctx,u,t);
  for(const it of world.items)if(vis(it.x,it.y,40))drawItem(ctx,it,t);
  for(const h of world.hazards){const k=h.t/h.delay;ctx.fillStyle=`rgba(63,255,208,${.08+.2*k})`;ell(ctx,h.x,h.y,h.r,h.r);ctx.strokeStyle='rgba(63,255,208,.8)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(h.x,h.y,h.r,0,TAU);ctx.stroke();ctx.fillStyle='rgba(63,255,208,.3)';ell(ctx,h.x,h.y,h.r*k,h.r*k);}
  const lim=G.low?170:PMAX;
  for(let i=0;i<lim;i++){const q=parts[i];if(!q.on||q.type===1)continue;const k=q.life/q.max;if(q.type===2){ctx.fillStyle=q.col;ctx.globalAlpha=k;ell(ctx,q.x,q.y,q.size*(2-k),q.size*(2-k));ctx.globalAlpha=1;}else{ctx.fillStyle=q.col;ctx.fillRect(q.x-q.size/2,q.y-q.size/2,q.size,q.size*(q.type===3?.6:1));}}
  for(const f of world.flares){ctx.fillStyle='#c8301f';ctx.save();ctx.translate(f.x,f.y-(f.landed?0:Math.sin(f.t/f.fly*Math.PI)*26));ctx.rotate(f.t*(f.landed?0:14));ctx.fillRect(-7,-2,14,4);ctx.restore();}
  for(const e of world.enemies)if(!e.dead&&vis(e.x,e.y,140))drawEnemy(ctx,e,false);
  if(G.npc&&G.npc.state!=='dead')drawNpc(ctx,G.npc,false);
  drawPlayer(ctx,p);
  for(const s of world.shots){ctx.fillStyle='#1d5a50';ell(ctx,s.x,s.y,7,7);ctx.fillStyle='#3fffd0';ell(ctx,s.x,s.y,4.5+Math.sin(t*20+s.ph),4.5);}
  /* light pass */
  buildLight(x0,y0,vw,vh);ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='multiply';ctx.drawImage(lightC,0,0,W,H);
  /* emissive pass */
  WT();ctx.globalCompositeOperation='lighter';
  for(const tr of world.tracers){ctx.strokeStyle=`rgba(255,226,160,${.8*(1-tr.t/.07)})`;ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(tr.x1,tr.y1);ctx.lineTo(tr.x2,tr.y2);ctx.stroke();}
  for(const f of world.flashes){const k=1-f.t/f.life;ctx.fillStyle=`rgba(255,220,150,${k})`;ctx.save();ctx.translate(f.x,f.y);ctx.rotate(p.a);ctx.beginPath();ctx.moveTo(-4,0);ctx.lineTo(4,-7);ctx.lineTo(22*(f.r/250),0);ctx.lineTo(4,7);ctx.closePath();ctx.fill();ctx.restore();}
  for(let i=0;i<lim;i++){const q=parts[i];if(!q.on||q.type!==1)continue;ctx.globalAlpha=q.life/q.max;ctx.fillStyle=q.col;ctx.fillRect(q.x-q.size/2,q.y-q.size/2,q.size,q.size);}ctx.globalAlpha=1;
  for(const e of world.enemies){if(e.dead||!vis(e.x,e.y,80))continue;const h=e.state==='hunt';if(!h&&!los(p.x,p.y,e.x,e.y))continue;
    if(e.type==='boss'){const r=24+(e.sing>0?26:0)+Math.sin(t*5)*4;const gr=ctx.createRadialGradient(e.x,e.y,2,e.x,e.y,r*2);gr.addColorStop(0,`rgba(63,255,208,${e.sing>0?.9:.5})`);gr.addColorStop(1,'rgba(63,255,208,0)');ctx.fillStyle=gr;ctx.fillRect(e.x-r*2,e.y-r*2,r*4,r*4);continue;}
    ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.a);const al=h?.85:.2+.4*clamp(e.lit,0,1);ctx.fillStyle=`rgba(63,255,208,${al})`;const hx=e.type==='crawler'?13:e.type==='brute'?10:6;ell(ctx,hx,-2.6,1.5,1.5);ell(ctx,hx,2.6,1.5,1.5);if(h)filaments(ctx,e,3,13,.5,false);ctx.restore();}
  for(const f of world.flares){const r=16+Math.sin(f.ph)*5;const gr=ctx.createRadialGradient(f.x,f.y,1,f.x,f.y,r);gr.addColorStop(0,'rgba(255,240,220,.95)');gr.addColorStop(1,'rgba(255,80,50,0)');ctx.fillStyle=gr;ctx.fillRect(f.x-r,f.y-r,r*2,r*2);}
  for(const it of world.items){if(!vis(it.x,it.y,30)||dist(p.x,p.y,it.x,it.y)>560||!los(p.x,p.y,it.x,it.y))continue;const c=it.type==='key'?KEYCOL[it.id]:it.type==='log'?'#ffb23a':it.type==='weapon'?'#ff7a1a':it.type==='vial'?'#3fffd0':'#cfe6ff';const k=.5+.5*Math.sin(t*3+it.ph);ctx.globalAlpha=.1+.16*k;ctx.fillStyle=c;ell(ctx,it.x,it.y,15,15);ctx.globalAlpha=.5*k;ctx.fillRect(it.x-.6,it.y-9,1.2,18);ctx.fillRect(it.x-9,it.y-.6,18,1.2);}ctx.globalAlpha=1;
  for(const u of world.uses){if(!u.enabled||!vis(u.x,u.y,40)||!los(p.x,p.y,u.x,u.y))continue;ctx.globalAlpha=.22+.12*Math.sin(t*4);ctx.fillStyle='#39ff9a';ell(ctx,u.x,u.y-3,20,14);}ctx.globalAlpha=1;
  for(const l of world.lights){if(!l.on||l.kind==='t'||!vis(l.x,l.y,20)||!los(p.x,p.y,l.x,l.y))continue;ctx.fillStyle=`rgba(${l.col[0]},${l.col[1]},${l.col[2]},.5)`;ell(ctx,l.x,l.y,l.kind==='f'?9+Math.sin(t*20)*3:3.5,l.kind==='f'?9:3.5);}
  ctx.globalCompositeOperation='source-over';
  for(const r of world.rings){const k=r.t/r.life;ctx.strokeStyle=r.k==='scream'?`rgba(63,255,208,${.55*(1-k)})`:r.k==='lure'?`rgba(255,120,90,${.2*(1-k)})`:`rgba(210,230,255,${(r.k==='step'?.1:.22)*(1-k)})`;ctx.lineWidth=r.k==='scream'?3:1.5;ctx.beginPath();ctx.arc(r.x,r.y,r.R*(.15+.85*k),0,TAU);ctx.stroke();}
  if(G.objT&&dist(p.x,p.y,G.objT[0],G.objT[1])<vw){const ox=G.objT[0],oy=G.objT[1]-34-Math.sin(t*3)*4;ctx.fillStyle='rgba(255,122,26,.9)';ctx.beginPath();ctx.moveTo(ox,oy+8);ctx.lineTo(ox-6,oy);ctx.lineTo(ox,oy-8);ctx.lineTo(ox+6,oy);ctx.closePath();ctx.fill();}
  if(G.npc&&G.npc.state==='follow'){const n=G.npc;ctx.fillStyle='rgba(8,11,15,.8)';ctx.fillRect(n.x-15,n.y-25,30,4);ctx.fillStyle=n.hp<n.maxHp*.4?'#ff3b2a':'#7dff9a';ctx.fillRect(n.x-15,n.y-25,30*clamp(n.hp/n.maxHp,0,1),4);}
  ctx.setTransform(1,0,0,1,0,0);
  const toS=(x,y)=>[(x-x0)*zoom,(y-y0)*zoom];
  for(const f of floats){const s=toS(f.x,f.y);ctx.globalAlpha=clamp(f.life*1.6,0,1);txt(f.t,s[0],s[1],13,f.c,'center',FH,'700');}ctx.globalAlpha=1;
  if(G.prompt){const s=toS(G.prompt.x,G.prompt.y-30);const label=(touch.on&&!mouse.moved?'USE':'E')+'  '+G.prompt.t;ctx.font='700 '+Math.round(13*UI)+'px '+FH;const tw=ctx.measureText(label).width+22*UI;ctx.fillStyle='rgba(8,11,15,.86)';ctx.fillRect(s[0]-tw/2,s[1]-17*UI,tw,24*UI);ctx.fillStyle='#ff7a1a';ctx.fillRect(s[0]-tw/2,s[1]-17*UI,3*UI,24*UI);txt(label,s[0]+2*UI,s[1],13,'#e6edf3','center',FH,'700');}
  /* weather + post */
  if(G.lvl.theme==='surface')drawSnow(dt,G.lvl.snow||1);
  ctx.drawImage(vigC,0,0,W,H);
  if(G.flags.cold>.3){const gr=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.28,W/2,H/2,Math.hypot(W,H)*.55);gr.addColorStop(0,'rgba(200,232,255,0)');gr.addColorStop(1,`rgba(200,232,255,${(G.flags.cold-.3)*.62})`);ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);}
  const hpk=p.hp/maxHp();if(G.dmgFx>0||hpk<.3){const a=Math.max(G.dmgFx*.36,hpk<.3?(.3-hpk)*1.2*(.6+.4*Math.sin(t*6)):0);const gr=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.3,W/2,H/2,Math.hypot(W,H)*.55);gr.addColorStop(0,'rgba(160,0,0,0)');gr.addColorStop(1,`rgba(170,10,0,${a})`);ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);}
  if(!G.low){ctx.globalAlpha=.55;const gx=-Math.floor(Math.random()*160),gy=-Math.floor(Math.random()*160);for(let y=gy;y<H;y+=320)for(let x=gx;x<W;x+=320)ctx.drawImage(grainC,x,y,320,320);ctx.globalAlpha=1;}
  drawHUD(t,x0,y0,vw,vh);
  if(G.card>0)drawCard();
  if(G.fade>0){ctx.fillStyle=`rgba(0,0,0,${clamp(G.fade,0,1)})`;ctx.fillRect(0,0,W,H);}
}
function drawSnow(dt,strength){ctx.strokeStyle='rgba(235,243,255,.55)';ctx.lineWidth=1.2*DPR;ctx.beginPath();const n=G.low?70:flakes.length;
  for(let i=0;i<n;i++){const f=flakes[i];f.x-=dt*.55*f.z*strength;f.y+=dt*.2*f.z;if(f.x<-.05)f.x=1.05;if(f.y>1.05)f.y=-.05;const x=f.x*W,y=f.y*H;ctx.moveTo(x,y);ctx.lineTo(x+14*f.z*DPR,y-5*f.z*DPR);}ctx.stroke();}
function drawCard(){const k=G.card,a=k>.9?1:k/.9;ctx.fillStyle=`rgba(3,5,8,${a})`;ctx.fillRect(0,0,W,H);const ta=clamp(Math.min((3.6-k)*2,(k-.5)*2.2),0,1);ctx.globalAlpha=ta;
  const hold=G.mode==='holdout';txt(hold?'HOLDOUT':'CHAPTER '+CHAPTER_NUM[G.li],W/2,H/2-54*UI,15,'#ff7a1a','center',FH,'700');txt(hold?'THE DRILL HALL':G.lvl.name,W/2,H/2+4*UI,54,'#e6edf3','center',FH,'700');
  ctx.fillStyle='#ff7a1a';ctx.fillRect(W/2-40*UI,H/2+24*UI,80*UI,2*UI);txt(hold?'Endless · Score attack':G.lvl.sub,W/2,H/2+56*UI,15,'#8fa3b5','center',FM,'400');ctx.globalAlpha=1;}

/* ---------- HUD ---------- */
function panel(x,y,w,h){ctx.fillStyle='rgba(8,11,15,.72)';ctx.fillRect(x,y,w,h);ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillRect(x,y,w,1*DPR);}
function drawHUD(t,x0,y0,vw,vh){
  if(G.bars>.01){const bh=H*.115*G.bars;ctx.fillStyle='#000';ctx.fillRect(0,0,W,bh);ctx.fillRect(0,H-bh,W,bh);}
  if(G.cine){drawCine(t);return;}
  const p=G.p,u=UI,m=18*u;ctx.textBaseline='alphabetic';
  /* vitals */
  let x=m,y=H-m-58*u;panel(x,y,250*u,58*u);txt('VITALS',x+10*u,y+16*u,10,'#8fa3b5','left',FH,'700');
  const hk=clamp(p.hp/maxHp(),0,1),bw=230*u;ctx.fillStyle='#1b2028';ctx.fillRect(x+10*u,y+22*u,bw,12*u);ctx.fillStyle=hk<.3?'#ff3b2a':hk<.6?'#ffb23a':'#e6edf3';ctx.fillRect(x+10*u,y+22*u,bw*hk,12*u);
  ctx.fillStyle='rgba(8,11,15,.7)';for(let i=1;i<10;i++)ctx.fillRect(x+10*u+bw*i/10,y+22*u,1.5*u,12*u);txt(Math.ceil(p.hp)+'',x+240*u,y+16*u,11,'#e6edf3','right',FM,'700');
  ctx.fillStyle='#1b2028';ctx.fillRect(x+10*u,y+38*u,bw,4*u);ctx.fillStyle=p.exh>0?'#ff5a3c':'#5ab4ff';ctx.fillRect(x+10*u,y+38*u,bw*p.st,4*u);
  txt('✚ '+p.medkits,x+10*u,y+54*u,11,p.medkits?'#7dff9a':'#566472','left',FM,'700');txt('Q',x+44*u,y+54*u,9,'#566472','left',FH);
  txt('▮ '+p.flares,x+66*u,y+54*u,11,p.flares?'#ff8a5a':'#566472','left',FM,'700');txt('G',x+100*u,y+54*u,9,'#566472','left',FH);
  txt('⬢ '+p.salvage,x+124*u,y+54*u,11,'#ffcf5a','left',FM,'700');
  let kx=x+190*u;for(const k of['red','blue','yellow'])if(p.keys[k]){ctx.fillStyle=KEYCOL[k];ctx.fillRect(kx,y+46*u,14*u,9*u);kx+=18*u;}
  /* weapon */
  const w=curWeap();x=W-m-230*u;y=H-m-58*u;panel(x,y,230*u,58*u);
  if(w){txt(w.name,x+220*u,y+16*u,10,'#8fa3b5','right',FH,'700');const mg=p.mag[w.id];txt(mg+'',x+150*u,y+46*u,32,mg===0?'#ff3b2a':'#e6edf3','right',FH,'700');txt('/ '+p.ammo[w.ammo],x+158*u,y+46*u,15,'#8fa3b5','left',FM,'700');
    if(p.reload>0){ctx.fillStyle='#ffcf5a';ctx.fillRect(x,y+56*u,230*u*(1-p.reload/w.reload),2*u);txt('RELOADING',x+10*u,y+46*u,10,'#ffcf5a','left',FH,'700');}
    else for(let i=0;i<p.weapons.length;i++)txt((i+1)+'',x+10*u+i*14*u,y+46*u,11,i===p.cur?'#ff7a1a':'#566472','left',FM,'700');}
  else{txt('ICE AXE',x+220*u,y+16*u,10,'#8fa3b5','right',FH,'700');txt('MELEE',x+220*u,y+44*u,24,'#e6edf3','right',FH,'700');}
  /* objective */
  x=m;y=m;ctx.font='600 '+Math.round(13*u)+'px '+FH;const ow=Math.max(230*u,Math.min(ctx.measureText(G.obj).width+40*u,W*.6));panel(x,y,ow,44*u);ctx.fillStyle='#ff7a1a';ctx.fillRect(x,y,3*u,44*u);
  txt(G.mode==='holdout'?'HOLDOUT · WAVE '+(G.flags.wave||0)+' · SCORE '+G.stats.score:'CH.'+(G.li+1)+' · '+G.lvl.name,x+12*u,y+16*u,10,'#8fa3b5','left',FH,'700');txt(G.obj,x+12*u,y+34*u,13,'#e6edf3','left',FH,'600');
  /* minimap */
  if(G.showMap&&world.mini){const s=128*u,mx=W-m-s,my=m;panel(mx-4*u,my-4*u,s+8*u,s+8*u);const span=34,cx=p.x/T,cy=p.y/T;ctx.save();ctx.beginPath();ctx.rect(mx,my,s,s);ctx.clip();ctx.imageSmoothingEnabled=false;
    ctx.drawImage(world.mini,(cx-span/2)*3,(cy-span/2)*3,span*3,span*3,mx,my,s,s);ctx.imageSmoothingEnabled=true;
    if(G.objT){const ox=clamp(mx+s/2+(G.objT[0]/T-cx)*s/span,mx+4*u,mx+s-4*u),oy=clamp(my+s/2+(G.objT[1]/T-cy)*s/span,my+4*u,my+s-4*u);ctx.fillStyle='#ff7a1a';ctx.fillRect(ox-3*u,oy-3*u,6*u,6*u);}
    ctx.translate(mx+s/2,my+s/2);ctx.rotate(p.a);ctx.fillStyle='#e6edf3';ctx.beginPath();ctx.moveTo(6*u,0);ctx.lineTo(-4*u,-4*u);ctx.lineTo(-4*u,4*u);ctx.closePath();ctx.fill();ctx.restore();}
  /* noise + status */
  const nw=190*u;x=W/2-nw/2;y=H-m-24*u;panel(x-10*u,y-16*u,nw+20*u,40*u);const hunted=G.hunting>0;
  txt(hunted?'HUNTED':p.crouch?'SNEAKING':'UNDETECTED',x,y-3*u,10,hunted?(Math.sin(t*10)>0?'#ff3b2a':'#ff8a7a'):p.crouch?'#7fe3d0':'#8fa3b5','left',FH,'700');txt(p.light?'LIGHT ON':'LIGHT OFF',x+nw,y-3*u,10,p.light?'#8fa3b5':'#7fe3d0','right',FH,'700');
  ctx.fillStyle='#1b2028';ctx.fillRect(x,y+4*u,nw,8*u);const nk=G.noiseHud;ctx.fillStyle=nk>.6?'#ff3b2a':nk>.25?'#ffb23a':'#7fe3d0';const bars=24;for(let i=0;i<bars;i++){if(i/bars<nk)ctx.fillRect(x+i*nw/bars,y+4*u,nw/bars-1.5*u,8*u);}
  if(G.hud){const hw=190*u,hx=W/2-hw/2,hy=H-m-78*u;panel(hx-10*u,hy-15*u,hw+20*u,30*u);txt(G.hud.label,hx,hy-3*u,10,G.hud.col,'left',FH,'700');ctx.fillStyle='#1b2028';ctx.fillRect(hx,hy+3*u,hw,6*u);ctx.fillStyle=G.hud.col;ctx.fillRect(hx,hy+3*u,hw*clamp(G.hud.val,0,1),6*u);}
  /* timer + boss */
  let ty=m+18*u;
  if(G.timer){const s=Math.max(0,Math.ceil(G.timer.t));const str=G.timer.label+'  '+Math.floor(s/60)+':'+('0'+s%60).slice(-2);ctx.font='700 '+Math.round(22*u)+'px '+FH;const tw=ctx.measureText(str).width+36*u;const tm=(m+ow>W/2-tw/2-10*u)?m+52*u:m;panel(W/2-tw/2,tm,tw,36*u);txt(str,W/2,tm+26*u,22,s<=10?'#ff3b2a':'#ffcf5a','center',FH,'700');ty=tm+18*u+46*u;}
  if(G.boss&&!G.boss.dead){const b=G.boss,bw2=Math.min(520*u,W*.6);panel(W/2-bw2/2-8*u,ty-14*u,bw2+16*u,36*u);txt('THE CHORUS  ·  DIRECTOR AKSEL HALVARD',W/2,ty,11,b.sing>0?'#3fffd0':'#8fa3b5','center',FH,'700');ctx.fillStyle='#1b2028';ctx.fillRect(W/2-bw2/2,ty+6*u,bw2,8*u);ctx.fillStyle=b.sing>0?'#3fffd0':'#1fae95';ctx.fillRect(W/2-bw2/2,ty+6*u,bw2*clamp(b.hp/b.maxHp,0,1),8*u);ty+=44*u;}
  let hbot=0;
  /* hint */
  if(G.hintCur){const h=G.hintCur,a=clamp(Math.min(h.t*3,(h.dur-h.t)*2),0,1);ctx.globalAlpha=a;ctx.font='600 '+Math.round(13*u)+'px '+FH;const mw=Math.min(W*.8,560*u),lines=wrap(h.text,mw-30*u),bh=(lines.length*19+16)*u;let hy=ty+34*u;hbot=hy+bh;panel(W/2-mw/2,hy,mw,bh);ctx.fillStyle='#7fe3d0';ctx.fillRect(W/2-mw/2,hy,3*u,bh);lines.forEach((l,i)=>txt(l,W/2,hy+(22+i*19)*u,13,'#d7f4ee','center',FH,'600'));ctx.globalAlpha=1;}
  if(G.toastCur){const a=clamp(Math.min(G.toastCur.t*5,(2.2-G.toastCur.t)*2),0,1);ctx.globalAlpha=a;const ty2=Math.max(H*.3,hbot+34*u);ctx.font='700 '+Math.round(18*u)+'px '+FH;const tw2=ctx.measureText(G.toastCur.text).width;panel(W/2-tw2/2-14*u,ty2-24*u,tw2+28*u,34*u);txt(G.toastCur.text,W/2,ty2,18,'#ffcf5a','center',FH,'700');ctx.globalAlpha=1;}
  /* dialogue */
  if(G.dlg)drawDlg(t,H-m-76*u-(G.hud?42*u:0));
  /* objective arrow */
  if(G.objT){const ox=(G.objT[0]-x0)*zoom,oy=(G.objT[1]-y0)*zoom;if(ox<40*u||oy<40*u||ox>W-40*u||oy>H-40*u){const a=Math.atan2(oy-H/2,ox-W/2),r=Math.min(W,H)*.36;ctx.save();ctx.translate(W/2+Math.cos(a)*r,H/2+Math.sin(a)*r);ctx.rotate(a);ctx.fillStyle=`rgba(255,122,26,${.6+.3*Math.sin(t*4)})`;ctx.beginPath();ctx.moveTo(14*u,0);ctx.lineTo(-6*u,-8*u);ctx.lineTo(-2*u,0);ctx.lineTo(-6*u,8*u);ctx.closePath();ctx.fill();ctx.restore();}}
  /* crosshair */
  if(!touch.on||mouse.moved){const cx=mouse.x,cy=mouse.y,g=(6+p.kick*8+(p.sprinting?6:0))*u;ctx.strokeStyle='rgba(230,237,243,.9)';ctx.lineWidth=1.6*u;ctx.beginPath();ctx.moveTo(cx-g-7*u,cy);ctx.lineTo(cx-g,cy);ctx.moveTo(cx+g,cy);ctx.lineTo(cx+g+7*u,cy);ctx.moveTo(cx,cy-g-7*u);ctx.lineTo(cx,cy-g);ctx.moveTo(cx,cy+g);ctx.lineTo(cx,cy+g+7*u);ctx.stroke();ctx.fillStyle='#ff7a1a';ctx.fillRect(cx-1.2*u,cy-1.2*u,2.4*u,2.4*u);}
  else{for(const s of[touch.mv,touch.aim]){if(s.id===null)continue;ctx.strokeStyle='rgba(230,237,243,.35)';ctx.lineWidth=2*u;ctx.beginPath();ctx.arc(s.ox*DPR,s.oy*DPR,56*DPR,0,TAU);ctx.stroke();ctx.fillStyle='rgba(255,122,26,.5)';ell(ctx,(s.ox+s.x*56)*DPR,(s.oy+s.y*56)*DPR,22*DPR,22*DPR);}}
}
/* title backdrop */
function drawTitleBG(dt){
  const t=G.time;ctx.setTransform(1,0,0,1,0,0);const sky=ctx.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#03060b');sky.addColorStop(.55,'#0a1626');sky.addColorStop(.72,'#14263a');sky.addColorStop(.721,'#1b2a3a');sky.addColorStop(1,'#070b10');ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
  const hz=H*.72;
  for(let b=0;b<3;b++){ctx.beginPath();for(let x=0;x<=W;x+=W/40){const y=H*(.16+b*.07)+Math.sin(x/W*5+t*.15+b*2)*H*.04+Math.sin(x/W*13+t*.23+b)*H*.012;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.lineTo(W,H*.5);ctx.lineTo(0,H*.5);ctx.closePath();const gr=ctx.createLinearGradient(0,H*.12,0,H*.5);gr.addColorStop(0,`rgba(60,255,200,${.07-b*.015})`);gr.addColorStop(1,'rgba(60,255,200,0)');ctx.fillStyle=gr;ctx.fill();}
  ctx.fillStyle='rgba(220,235,255,.7)';const sr=rng(7);for(let i=0;i<90;i++){const x=sr()*W,y=sr()*hz*.8,s=sr();if(Math.sin(t*(1+s*2)+i)>-.6)ctx.fillRect(x,y,(1+s)*DPR*.8,(1+s)*DPR*.8);}
  const u=Math.min(W,H)/700,bx=W*.66,by=hz;ctx.fillStyle='#070b10';
  ctx.fillRect(bx-150*u,by-34*u,120*u,26*u);ctx.fillRect(bx-20*u,by-46*u,90*u,38*u);ctx.fillRect(bx+80*u,by-30*u,70*u,22*u);for(let i=0;i<9;i++)ctx.fillRect(bx-146*u+i*36*u,by-10*u,5*u,12*u);
  ctx.beginPath();ctx.moveTo(bx+170*u,by);ctx.lineTo(bx+196*u,by-150*u);ctx.lineTo(bx+204*u,by-150*u);ctx.lineTo(bx+230*u,by);ctx.closePath();ctx.fill();ctx.fillRect(bx-2*u,by-110*u,3*u,70*u);
  ctx.strokeStyle='#070b10';ctx.lineWidth=2*u;for(let i=1;i<5;i++){ctx.beginPath();ctx.moveTo(bx+170*u+i*5*u,by-i*30*u);ctx.lineTo(bx+230*u-i*5*u,by-i*30*u);ctx.stroke();}
  ctx.fillStyle='rgba(255,176,84,.75)';ctx.fillRect(bx-130*u,by-26*u,7*u,5*u);ctx.fillStyle='rgba(255,176,84,.25)';ctx.fillRect(bx+10*u,by-34*u,7*u,5*u);
  const bl=Math.sin(t*2.4)>.3?1:0;if(bl){const gr=ctx.createRadialGradient(bx,by-112*u,1,bx,by-112*u,46*u);gr.addColorStop(0,'rgba(255,60,40,.9)');gr.addColorStop(1,'rgba(255,60,40,0)');ctx.fillStyle=gr;ctx.fillRect(bx-50*u,by-162*u,100*u,100*u);}
  const tl=ctx.createRadialGradient(bx+200*u,by,2,bx+200*u,by,90*u);tl.addColorStop(0,`rgba(63,255,208,${.22+.1*Math.sin(t*.8)})`);tl.addColorStop(1,'rgba(63,255,208,0)');ctx.fillStyle=tl;ctx.fillRect(bx+100*u,by-90*u,200*u,120*u);
  drawSnow(dt,1.4);ctx.drawImage(vigC,0,0,W,H);
}

/* ================= PAINTED PORTRAITS + STORY PANELS ================= */
const FACES={
  REYES:{bg:['#4a2c10','#120b05'],skin:'#b98660',shade:'#5e3d27',hair:'#1c1512',cloth:'#39424c',style:'short',headset:1,stubble:1},
  BRANDT:{bg:['#164540','#06100f'],skin:'#dcc6b0',shade:'#7d6a5e',hair:'#bdb49c',cloth:'#dfe5ea',style:'bob',glasses:1,fil:1,lapel:'#2b3640'},
  MARROW:{bg:['#2a3a4c','#0a0e13'],skin:'#c79f82',shade:'#6c4f3d',hair:'#3a2a20',cloth:'#c4481c',style:'hood',goggles:1},
  HALVARD:{bg:['#0e4a44','#020807'],skin:'#b4c4c0',shade:'#4e6662',hair:'#e9eef0',cloth:'#2f4866',style:'swept',beard:1,glow:1,fil:1},
  CARROW:{bg:['#35224c','#0b0712'],skin:'#e2c8b4',shade:'#86695c',hair:'#17131a',cloth:'#1a1a22',style:'bun',earring:1,lapel:'#e9e6ee'},
  AAS:{bg:['#3a3620','#0c0b07'],skin:'#d2a688',shade:'#7a563f',hair:'#7a4a2a',cloth:'#3d5a78',style:'beanie',moustache:1,apron:1}
};
const PORT={};
function portrait(who){if(!PORT[who]){const c=document.createElement('canvas');c.width=c.height=160;paintPortrait(c.getContext('2d'),who,160);PORT[who]=c;}return PORT[who];}
function paintPortrait(g,who,S){
  const f=FACES[who],k=S/100,col=WHO[who].c;g.save();g.scale(k,k);g.lineCap='round';g.lineJoin='round';
  if(who==='CORE'){g.fillStyle='#021413';g.fillRect(0,0,100,100);for(let i=7;i>0;i--){g.strokeStyle=`rgba(63,255,208,${.12+i*.09})`;g.lineWidth=2;g.beginPath();g.arc(50,50,i*6.2,0,TAU);g.stroke();}const cg=g.createRadialGradient(50,50,1,50,50,22);cg.addColorStop(0,'#eafff9');cg.addColorStop(.5,'#3fffd0');cg.addColorStop(1,'rgba(63,255,208,0)');g.fillStyle=cg;g.fillRect(20,20,60,60);g.strokeStyle='rgba(63,255,208,.6)';g.lineWidth=1;for(let i=0;i<9;i++){const a=i*.7;g.beginPath();g.moveTo(50+Math.cos(a)*14,50+Math.sin(a)*14);g.lineTo(50+Math.cos(a+.3)*30,50+Math.sin(a+.3)*30);g.lineTo(50+Math.cos(a+.1)*47,50+Math.sin(a+.1)*47);g.stroke();}g.fillStyle='rgba(0,0,0,.22)';for(let y=0;y<100;y+=3)g.fillRect(0,y,100,1);g.restore();return;}
  if(!f){g.fillStyle='#160806';g.fillRect(0,0,100,100);g.strokeStyle='#ff6a4a';g.lineWidth=4;g.beginPath();g.moveTo(50,18);g.lineTo(84,76);g.lineTo(16,76);g.closePath();g.stroke();g.fillStyle='#ff6a4a';g.fillRect(47,36,6,24);g.fillRect(47,65,6,6);
    g.fillStyle='rgba(255,106,74,.5)';for(let i=0;i<4;i++)g.fillRect(14,82+i*4,30+((i*37)%40),1.6);g.fillStyle='rgba(0,0,0,.25)';for(let y=0;y<100;y+=3)g.fillRect(0,y,100,1);g.restore();return;}
  const bg=g.createLinearGradient(0,0,0,100);bg.addColorStop(0,f.bg[0]);bg.addColorStop(1,f.bg[1]);g.fillStyle=bg;g.fillRect(0,0,100,100);
  let gr=g.createRadialGradient(68,34,2,68,34,60);gr.addColorStop(0,'rgba(255,255,255,.16)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,100,100);
  /* shoulders */
  g.fillStyle=f.cloth;g.beginPath();g.moveTo(2,100);g.quadraticCurveTo(8,74,36,69);g.lineTo(64,69);g.quadraticCurveTo(92,74,98,100);g.closePath();g.fill();
  g.fillStyle='rgba(0,0,0,.38)';g.beginPath();g.moveTo(2,100);g.quadraticCurveTo(8,74,36,69);g.lineTo(46,69);g.lineTo(40,100);g.closePath();g.fill();
  if(f.style==='hood'){g.fillStyle='#8f3312';g.beginPath();g.ellipse(50,44,33,38,0,0,TAU);g.fill();g.fillStyle='#5e2009';g.beginPath();g.ellipse(50,45,25,30,0,0,TAU);g.fill();g.strokeStyle='#d9cdb8';g.lineWidth=6;g.beginPath();g.ellipse(50,45,27,32,0,Math.PI*.9,Math.PI*2.1);g.stroke();g.strokeStyle='#b8ab94';g.lineWidth=2;for(let i=0;i<14;i++){const a=Math.PI*.9+i/13*Math.PI*1.2;g.beginPath();g.moveTo(50+Math.cos(a)*25,45+Math.sin(a)*30);g.lineTo(50+Math.cos(a)*31,45+Math.sin(a)*36);g.stroke();}}
  if(f.style==='bob'){g.fillStyle=f.hair;g.beginPath();g.moveTo(28,36);g.quadraticCurveTo(26,62,32,70);g.lineTo(40,68);g.lineTo(40,36);g.closePath();g.fill();g.beginPath();g.moveTo(72,36);g.quadraticCurveTo(75,62,68,70);g.lineTo(60,68);g.lineTo(60,36);g.closePath();g.fill();}
  /* neck + collar */
  g.fillStyle=f.shade;g.beginPath();g.moveTo(41,56);g.lineTo(59,56);g.lineTo(61,73);g.lineTo(39,73);g.closePath();g.fill();
  if(f.lapel){g.fillStyle=f.lapel;g.beginPath();g.moveTo(39,70);g.lineTo(50,90);g.lineTo(61,70);g.lineTo(56,68);g.lineTo(50,78);g.lineTo(44,68);g.closePath();g.fill();}
  if(f.apron){g.fillStyle='#e6e2d6';g.beginPath();g.moveTo(34,100);g.lineTo(38,80);g.lineTo(62,80);g.lineTo(66,100);g.closePath();g.fill();g.strokeStyle='#e6e2d6';g.lineWidth=3;g.beginPath();g.moveTo(38,80);g.lineTo(42,68);g.moveTo(62,80);g.lineTo(58,68);g.stroke();}
  if(who==='REYES'){g.strokeStyle='#22272d';g.lineWidth=2;g.beginPath();g.moveTo(50,72);g.lineTo(50,100);g.stroke();g.fillStyle='#ffb14a';g.fillRect(64,82,10,6);}
  if(who==='MARROW'){g.fillStyle='#ece6cf';g.fillRect(20,84,14,4);g.fillRect(66,84,14,4);}
  /* head */
  g.fillStyle=f.skin;g.beginPath();g.ellipse(50,42,18.5,23.5,0,0,TAU);g.fill();
  g.save();g.beginPath();g.ellipse(50,42,18.5,23.5,0,0,TAU);g.clip();g.fillStyle=f.shade;g.globalAlpha=.8;g.beginPath();g.ellipse(31,46,17,32,0,0,TAU);g.fill();g.globalAlpha=.4;g.beginPath();g.ellipse(50,70,22,10,0,0,TAU);g.fill();
  g.globalAlpha=.22;g.fillStyle='#fff';g.beginPath();g.ellipse(60,32,7,10,.3,0,TAU);g.fill();g.restore();
  g.fillStyle=f.shade;g.beginPath();g.ellipse(31.5,44,2.6,5,0,0,TAU);g.fill();g.fillStyle=f.skin;g.beginPath();g.ellipse(68.5,44,2.6,5,0,0,TAU);g.fill();
  /* hair */
  g.fillStyle=f.hair;
  if(f.style==='short'||f.style==='bob'||f.style==='bun'){g.beginPath();g.moveTo(31,40);g.quadraticCurveTo(28,15,50,15);g.quadraticCurveTo(72,15,69,40);g.quadraticCurveTo(66,27,54,26);g.quadraticCurveTo(40,25,33,33);g.closePath();g.fill();if(f.style==='bun'){g.beginPath();g.arc(50,12,7.5,0,TAU);g.fill();}}
  else if(f.style==='swept'){g.beginPath();g.moveTo(30,42);g.quadraticCurveTo(24,12,48,12);g.quadraticCurveTo(76,10,71,42);g.quadraticCurveTo(68,28,58,24);g.lineTo(52,29);g.lineTo(46,23);g.lineTo(41,29);g.quadraticCurveTo(34,30,33,36);g.closePath();g.fill();}
  else if(f.style==='beanie'){g.fillStyle='#8f2f14';g.beginPath();g.moveTo(30,34);g.quadraticCurveTo(30,10,50,10);g.quadraticCurveTo(70,10,70,34);g.closePath();g.fill();g.fillStyle='#6d220e';g.fillRect(29,28,42,8);g.fillStyle='rgba(0,0,0,.25)';for(let i=0;i<10;i++)g.fillRect(31+i*4.2,28,1.2,8);}
  else if(f.style==='hood'){g.fillStyle=f.hair;g.beginPath();g.moveTo(33,30);g.quadraticCurveTo(50,18,67,30);g.quadraticCurveTo(50,25,33,34);g.closePath();g.fill();}
  /* features */
  const ey=43;g.strokeStyle='rgba(20,14,10,.75)';g.lineWidth=1.8;g.beginPath();g.moveTo(38,ey-5);g.lineTo(46,ey-4.4);g.moveTo(54,ey-4.4);g.lineTo(62,ey-5);g.stroke();
  if(f.glow){for(const x of[42,58]){gr=g.createRadialGradient(x,ey,.5,x,ey,9);gr.addColorStop(0,'rgba(63,255,208,1)');gr.addColorStop(1,'rgba(63,255,208,0)');g.fillStyle=gr;g.fillRect(x-9,ey-9,18,18);g.fillStyle='#eafff9';g.beginPath();g.ellipse(x,ey,2.6,1.4,0,0,TAU);g.fill();}}
  else{g.fillStyle='#14100e';g.beginPath();g.ellipse(42,ey,3.1,1.7,0,0,TAU);g.ellipse(58,ey,3.1,1.7,0,0,TAU);g.fill();g.fillStyle='rgba(255,255,255,.8)';g.fillRect(58.6,ey-1,1.2,1.2);g.fillRect(42.6,ey-1,1.2,1.2);g.strokeStyle='rgba(0,0,0,.25)';g.lineWidth=1;g.beginPath();g.moveTo(38,ey+3.4);g.lineTo(46,ey+3.6);g.moveTo(54,ey+3.6);g.lineTo(62,ey+3.4);g.stroke();}
  g.strokeStyle=f.shade;g.lineWidth=1.8;g.beginPath();g.moveTo(50,ey+1);g.lineTo(47.5,ey+10);g.lineTo(51,ey+11);g.stroke();
  g.strokeStyle='rgba(60,20,16,.75)';g.lineWidth=1.8;g.beginPath();g.moveTo(44,58.5);g.quadraticCurveTo(50,who==='CARROW'?60.5:59.4,56,58.5);g.stroke();
  if(f.stubble){g.fillStyle='rgba(20,14,10,.28)';g.beginPath();g.ellipse(50,58,15,9,0,0,Math.PI);g.fill();}
  if(f.beard){g.fillStyle=f.hair;g.beginPath();g.moveTo(33,50);g.quadraticCurveTo(36,72,50,72);g.quadraticCurveTo(64,72,67,50);g.quadraticCurveTo(60,57,56,55);g.lineTo(44,55);g.quadraticCurveTo(40,57,33,50);g.closePath();g.fill();g.fillStyle='rgba(0,0,0,.2)';g.beginPath();g.ellipse(41,62,6,8,0,0,TAU);g.fill();}
  if(f.moustache){g.fillStyle=f.hair;g.beginPath();g.ellipse(50,56,8,2.6,0,0,TAU);g.fill();}
  if(f.glasses){g.strokeStyle='#22262b';g.lineWidth=1.6;g.strokeRect(36.5,ey-4.5,11,8.5);g.strokeRect(52.5,ey-4.5,11,8.5);g.beginPath();g.moveTo(47.5,ey-1);g.lineTo(52.5,ey-1);g.stroke();g.fillStyle='rgba(180,235,240,.2)';g.fillRect(53,ey-4,10,3);}
  if(f.goggles){g.fillStyle='#14171a';g.fillRect(31,24,38,8);g.fillStyle='#2e4e63';g.fillRect(34,25.5,13,5);g.fillRect(53,25.5,13,5);g.fillStyle='rgba(200,235,255,.6)';g.fillRect(55,26.5,5,1.5);g.fillRect(36,26.5,5,1.5);}
  if(f.headset){g.strokeStyle='#15181c';g.lineWidth=3.2;g.beginPath();g.arc(50,40,23,Math.PI*1.08,Math.PI*1.92);g.stroke();g.fillStyle='#15181c';g.fillRect(68,36,7,14);g.fillRect(25,36,7,14);g.lineWidth=1.8;g.beginPath();g.moveTo(71,50);g.quadraticCurveTo(70,62,57,61);g.stroke();g.fillStyle='#ffb14a';g.fillRect(70,40,3,3);}
  if(f.earring){g.fillStyle='#f3f0ea';g.beginPath();g.arc(69.5,51,1.8,0,TAU);g.fill();}
  if(f.fil){g.strokeStyle='rgba(63,255,208,.85)';g.lineWidth=1;g.beginPath();g.moveTo(66,38);g.lineTo(70,32);g.lineTo(68,26);g.moveTo(66,40);g.lineTo(73,41);g.lineTo(77,37);g.moveTo(65,48);g.lineTo(70,54);if(f.glow){g.moveTo(34,36);g.lineTo(28,30);g.lineTo(30,22);g.moveTo(36,56);g.lineTo(28,62);g.moveTo(52,22);g.lineTo(56,14);}g.stroke();}
  /* feed treatment */
  g.fillStyle=col;g.globalAlpha=.09;g.fillRect(0,0,100,100);g.globalAlpha=1;g.fillStyle='rgba(0,0,0,.2)';for(let y=0;y<100;y+=3)g.fillRect(0,y,100,1);
  gr=g.createRadialGradient(50,46,30,50,50,72);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(1,'rgba(0,0,0,.65)');g.fillStyle=gr;g.fillRect(0,0,100,100);
  g.restore();
}
function paintScene(cv,id){
  const g=cv.getContext('2d'),W=cv.width,H=cv.height,r=rng(id.length*131+id.charCodeAt(1)*977);g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.lineCap='round';
  const sky=(a,b,c)=>{const s=g.createLinearGradient(0,0,0,H);s.addColorStop(0,a);s.addColorStop(.6,b);s.addColorStop(1,c);g.fillStyle=s;g.fillRect(0,0,W,H);};
  const stars=n=>{for(let i=0;i<n;i++){g.fillStyle=`rgba(225,238,255,${.25+r()*.65})`;const s=1+r()*1.7;g.fillRect(r()*W,r()*H*.62,s,s);}};
  const aurora=(y,amp,al,col)=>{for(let b=0;b<3;b++){g.beginPath();for(let x=0;x<=W;x+=20){const yy=y+b*28+Math.sin(x/W*6+b*2+id.length)*amp+Math.sin(x/W*15+b)*amp*.3;if(x)g.lineTo(x,yy);else g.moveTo(x,yy);}g.lineTo(W,y+210);g.lineTo(0,y+210);g.closePath();const gr=g.createLinearGradient(0,y-amp,0,y+210);gr.addColorStop(0,`rgba(${col},${al})`);gr.addColorStop(1,`rgba(${col},0)`);g.fillStyle=gr;g.fill();}};
  const ground=(y,c1,c2)=>{const s=g.createLinearGradient(0,y,0,H);s.addColorStop(0,c1);s.addColorStop(1,c2);g.fillStyle=s;g.fillRect(0,y,W,H-y);g.strokeStyle='rgba(200,225,255,.13)';g.lineWidth=1.5;for(let i=0;i<46;i++){const yy=y+5+r()*(H-y),x=r()*W,l=30+180*(yy-y)/(H-y);g.beginPath();g.moveTo(x,yy);g.lineTo(x+l,yy-2);g.stroke();}};
  const snow=(n,a)=>{g.strokeStyle=`rgba(235,243,255,${a})`;g.lineWidth=1.6;g.beginPath();for(let i=0;i<n;i++){const x=r()*W,y=r()*H,z=.5+r();g.moveTo(x,y);g.lineTo(x+24*z,y-9*z);}g.stroke();};
  const glow=(x,y,rad,col,al)=>{const gr=g.createRadialGradient(x,y,1,x,y,rad);gr.addColorStop(0,`rgba(${col},${al})`);gr.addColorStop(1,`rgba(${col},0)`);g.fillStyle=gr;g.fillRect(x-rad,y-rad,rad*2,rad*2);};
  const station=(x,y,s,lit)=>{g.fillStyle='#060a0f';g.fillRect(x-150*s,y-34*s,120*s,26*s);g.fillRect(x-20*s,y-46*s,90*s,38*s);g.fillRect(x+80*s,y-30*s,70*s,22*s);for(let i=0;i<9;i++)g.fillRect(x-146*s+i*36*s,y-10*s,5*s,12*s);
    g.beginPath();g.moveTo(x+170*s,y);g.lineTo(x+196*s,y-150*s);g.lineTo(x+204*s,y-150*s);g.lineTo(x+230*s,y);g.closePath();g.fill();g.fillRect(x-2*s,y-112*s,3*s,70*s);
    if(lit){g.fillStyle='rgba(255,176,84,.9)';for(const wx of[-130,-104,-78,0,28,96,122])g.fillRect(x+wx*s,y-26*s,9*s,6*s);glow(x-60*s,y-20*s,120*s,'255,176,84',.2);}};
  const person=(x,y,s,col)=>{g.fillStyle='rgba(0,0,0,.4)';g.beginPath();g.ellipse(x+26*s,y+3*s,34*s,5*s,0,0,TAU);g.fill();g.fillStyle='#14171b';g.fillRect(x-8*s,y-30*s,7*s,32*s);g.fillRect(x+1*s,y-30*s,7*s,32*s);
    g.fillStyle=col;g.beginPath();g.moveTo(x-13*s,y-28*s);g.lineTo(x-11*s,y-66*s);g.quadraticCurveTo(x,y-74*s,x+11*s,y-66*s);g.lineTo(x+13*s,y-28*s);g.closePath();g.fill();g.fillRect(x-17*s,y-64*s,6*s,30*s);g.fillRect(x+11*s,y-64*s,6*s,30*s);
    g.fillStyle='rgba(0,0,0,.3)';g.fillRect(x-13*s,y-66*s,9*s,38*s);g.fillStyle='#2c3138';g.fillRect(x-8*s,y-62*s,16*s,22*s);g.fillStyle=col;g.beginPath();g.arc(x,y-78*s,9.5*s,0,TAU);g.fill();g.strokeStyle='#d9cdb8';g.lineWidth=2.5*s;g.beginPath();g.arc(x,y-78*s,9*s,Math.PI*1.1,Math.PI*1.9);g.stroke();};
  const hz=H*.68;
  switch(id){
    case'i0':sky('#02040a','#0a1830','#1c2f4a');stars(170);aurora(70,34,.24,'70,255,200');glow(W*.5,hz,W*.5,'90,110,190',.22);
      g.fillStyle='#0a1422';g.beginPath();g.moveTo(0,hz);for(let x=0;x<=W;x+=30)g.lineTo(x,hz-8-r()*26-(Math.abs(x-W*.22)<120?38:0)-(Math.abs(x-W*.8)<160?24:0));g.lineTo(W,hz);g.closePath();g.fill();
      ground(hz,'#22364e','#0a121c');snow(70,.25);break;
    case'i1':{sky('#02040a','#081424','#0c1c2e');stars(60);const top=H*.17,lake=H*.78;const ice=g.createLinearGradient(0,top,0,lake);ice.addColorStop(0,'#bcd5e6');ice.addColorStop(.12,'#7ea6c2');ice.addColorStop(1,'#12283a');g.fillStyle=ice;g.fillRect(0,top,W,lake-top);
      g.strokeStyle='rgba(255,255,255,.08)';g.lineWidth=1;for(let i=0;i<16;i++){const y=top+12+i*(lake-top)/16;g.beginPath();g.moveTo(0,y);for(let x=0;x<=W;x+=60)g.lineTo(x,y+Math.sin(x/170+i)*5);g.stroke();}
      g.fillStyle='#0a0d10';g.fillRect(0,lake,W,H-lake);g.fillStyle='#04201e';g.beginPath();g.moveTo(W*.18,lake+4);g.quadraticCurveTo(W*.5,lake-34,W*.82,lake+4);g.quadraticCurveTo(W*.5,H*1.02,W*.18,lake+4);g.fill();glow(W*.5,lake+18,W*.3,'63,255,208',.3);
      g.strokeStyle='rgba(63,255,208,.5)';g.lineWidth=1.2;for(let i=0;i<22;i++){let x=W*.5,y=lake+10;g.beginPath();g.moveTo(x,y);for(let s=0;s<7;s++){x+=(r()-.5)*W*.12;y+=(r()-.35)*16;g.lineTo(x,clamp(y,lake-6,H-8));}g.stroke();}
      station(W*.44,top,.42,true);g.strokeStyle='#e9eef0';g.lineWidth=2;g.setLineDash([7,5]);g.beginPath();g.moveTo(W*.44+84,top);g.lineTo(W*.44+84,lake-4);g.stroke();g.setLineDash([]);
      g.font='600 15px '+FM;g.fillStyle='rgba(230,237,243,.8)';g.textAlign='left';for(const d of[[.33,'1 000 m'],[.66,'2 000 m'],[1,'3 104 m  ·  LAKE SØRENSEN']]){const y=top+(lake-top)*d[0];g.fillRect(W*.44+92,y-1,16,2);g.fillText(d[1],W*.44+116,y+5);}
      g.fillText('HALVARD STATION',W*.44-150,top-42);break;}
    case'i2':{const wl=g.createLinearGradient(0,0,0,H);wl.addColorStop(0,'#0b1016');wl.addColorStop(1,'#05080b');g.fillStyle=wl;g.fillRect(0,0,W,H);
      g.fillStyle='#0c1c30';g.fillRect(W*.58,H*.1,W*.3,H*.42);glow(W*.73,H*.3,220,'80,120,190',.25);g.save();g.beginPath();g.rect(W*.58,H*.1,W*.3,H*.42);g.clip();snow(90,.4);g.restore();g.strokeStyle='#1c242d';g.lineWidth=10;g.strokeRect(W*.58,H*.1,W*.3,H*.42);g.beginPath();g.moveTo(W*.73,H*.1);g.lineTo(W*.73,H*.52);g.stroke();
      g.fillStyle='#151b22';g.fillRect(0,H*.66,W,H*.08);g.fillStyle='#0a0e12';g.fillRect(0,H*.74,W,H*.26);
      g.fillStyle='#1d252e';g.fillRect(W*.14,H*.36,W*.3,H*.3);g.fillStyle='#0d1216';g.fillRect(W*.16,H*.4,W*.12,H*.14);g.strokeStyle='rgba(57,255,154,.5)';g.lineWidth=2;g.beginPath();g.moveTo(W*.165,H*.47);g.lineTo(W*.275,H*.47);g.stroke();
      for(let i=0;i<4;i++){g.fillStyle='#0b0f13';g.beginPath();g.arc(W*.31+i*34,H*.44,11,0,TAU);g.fill();g.strokeStyle='#59636e';g.lineWidth=2;g.beginPath();g.moveTo(W*.31+i*34,H*.44);g.lineTo(W*.31+i*34+7,H*.44-6);g.stroke();}
      g.fillStyle='#39ff9a';g.fillRect(W*.31,H*.55,10,6);glow(W*.31+5,H*.56,70,'57,255,154',.5);g.fillStyle='#3a1410';g.fillRect(W*.34,H*.55,10,6);
      g.strokeStyle='#0b0f13';g.lineWidth=6;g.beginPath();g.arc(W*.5,H*.5,30,Math.PI,TAU);g.stroke();g.fillStyle='#0b0f13';g.fillRect(W*.5-38,H*.5,16,26);g.fillRect(W*.5+22,H*.5,16,26);
      g.fillStyle='#06090c';g.fillRect(W*.2,H*.5,W*.012,H*.5);g.beginPath();g.moveTo(W*.19,H*.52);g.quadraticCurveTo(W*.26,H*.44,W*.33,H*.52);g.lineTo(W*.33,H*.86);g.lineTo(W*.19,H*.86);g.closePath();g.globalAlpha=.9;g.fillStyle='#070a0d';g.translate(W*.4,H*.16);g.fill();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;
      g.strokeStyle='rgba(63,255,208,.45)';g.lineWidth=1.5;g.beginPath();let x=W*.02,y=H*.9;g.moveTo(x,y);for(let i=0;i<14;i++){x+=30+r()*30;y+=(r()-.5)*26;g.lineTo(x,y);}g.stroke();break;}
    case'i3':{sky('#04070b','#0a121c','#101c2a');glow(W*.5,H*.36,300,'120,150,190',.14);g.save();g.translate(W*.52,H*.38);g.rotate(.3);
      const cone=g.createLinearGradient(0,0,-60,H*.7);cone.addColorStop(0,'rgba(240,246,255,.5)');cone.addColorStop(1,'rgba(240,246,255,0)');g.fillStyle=cone;g.beginPath();g.moveTo(40,18);g.lineTo(-170,H*.7);g.lineTo(90,H*.7);g.closePath();g.fill();
      g.fillStyle='#07090c';g.beginPath();g.ellipse(0,0,96,36,0,0,TAU);g.fill();g.fillRect(-250,-12,170,16);g.beginPath();g.moveTo(-250,-12);g.lineTo(-272,-58);g.lineTo(-236,-12);g.fill();g.fillRect(-14,-58,12,26);
      g.fillStyle='rgba(20,26,34,.85)';g.beginPath();g.ellipse(-8,-60,236,11,0,0,TAU);g.fill();g.fillStyle='rgba(130,170,205,.35)';g.beginPath();g.ellipse(46,-4,34,20,0,-1.4,1.3);g.fill();
      g.fillStyle='#c4481c';g.fillRect(-60,6,96,7);g.fillStyle='#07090c';g.fillRect(-50,34,100,5);g.fillRect(-34,26,4,10);g.fillRect(30,26,4,10);g.restore();
      glow(W*.52-232,H*.38-98,46,'255,60,40',.9);g.fillStyle='rgba(255,170,90,.8)';for(let i=0;i<16;i++)g.fillRect(W*.52-250+r()*70-80,H*.38-90+r()*90-40,3,3);
      g.fillStyle='#0c151f';g.fillRect(0,H*.9,W,H*.1);snow(340,.5);snow(120,.85);break;}
    case'i4':sky('#02040a','#091526','#17283c');stars(110);aurora(60,26,.14,'70,255,200');station(W*.76,hz,.42,false);glow(W*.76,hz-48,34,'255,60,40',.95);glow(W*.76+84,hz-6,60,'63,255,208',.35);
      ground(hz,'#20324a','#090f17');glow(W*.17,hz+40,330,'255,140,50',.45);
      g.fillStyle='rgba(30,30,34,.5)';for(let i=0;i<9;i++){g.beginPath();g.ellipse(W*.15+i*14+r()*30,hz+10-i*38,40+i*12,26+i*6,0,0,TAU);g.fill();}
      g.fillStyle='#07090c';g.save();g.translate(W*.16,hz+52);g.rotate(-.2);g.beginPath();g.ellipse(0,0,96,30,0,0,TAU);g.fill();g.fillRect(60,-8,150,12);g.rotate(.9);g.fillRect(-10,-150,9,170);g.restore();
      for(let i=0;i<7;i++){g.fillStyle=i%2?'#ffb23a':'#ff6a20';g.beginPath();const fx=W*.1+i*26,fh=30+r()*50;g.moveTo(fx-12,hz+50);g.quadraticCurveTo(fx,hz+50-fh*1.6,fx+4,hz+50-fh);g.quadraticCurveTo(fx+10,hz+40,fx+14,hz+50);g.fill();}
      person(W*.5,H*.93,1.9,'#c4481c');snow(130,.4);break;
    case'e_scuttle':sky('#02040a','#0b1930','#26344a');stars(140);aurora(50,30,.2,'70,255,200');glow(W*.62,hz,W*.4,'150,170,220',.16);ground(hz,'#253850','#0a1019');
      g.fillStyle='#070b10';g.save();g.translate(W*.6,hz+4);g.rotate(.14);g.fillRect(-170,-22,90,22);g.rotate(-.34);g.fillRect(40,-26,80,24);g.restore();g.beginPath();g.moveTo(W*.66,hz+4);g.lineTo(W*.7,hz-64);g.lineTo(W*.75,hz-52);g.lineTo(W*.72,hz+4);g.fill();
      g.fillStyle='#0a121b';g.beginPath();g.ellipse(W*.62,hz+16,170,20,0,0,TAU);g.fill();glow(W*.62,hz+8,150,'255,130,60',.5);
      for(let i=0;i<16;i++){g.fillStyle=`rgba(${190+i*3},${205+i*2},${225},${.24-i*.012})`;g.beginPath();g.ellipse(W*.62+Math.sin(i*.7)*26+i*9,hz-i*22,44+i*15,30+i*7,0,0,TAU);g.fill();}
      person(W*.26,H*.95,1.7,'#c4481c');g.strokeStyle='rgba(8,14,22,.5)';g.lineWidth=3;g.setLineDash([4,16]);g.beginPath();g.moveTo(W*.29,H*.94);g.quadraticCurveTo(W*.45,H*.86,W*.58,hz+26);g.stroke();g.setLineDash([]);snow(60,.3);break;
    case'e_extract':{const wl=g.createLinearGradient(0,0,0,H);wl.addColorStop(0,'#0c1116');wl.addColorStop(1,'#040608');g.fillStyle=wl;g.fillRect(0,0,W,H);const cx=W*.56,cy=H*.48;
      g.strokeStyle='#1c252e';g.lineWidth=7;for(let i=0;i<6;i++){const k=1-i*.14,w2=W*.52*k,h2=H*.56*k;g.beginPath();g.moveTo(cx-w2,cy+h2);g.lineTo(cx-w2,cy-h2*.5);g.quadraticCurveTo(cx,cy-h2*1.25,cx+w2,cy-h2*.5);g.lineTo(cx+w2,cy+h2);g.stroke();}
      g.fillStyle='#090d11';g.beginPath();g.moveTo(0,H);g.lineTo(cx-W*.1,cy+H*.14);g.lineTo(cx+W*.1,cy+H*.14);g.lineTo(W,H);g.fill();g.strokeStyle='rgba(255,255,255,.05)';g.lineWidth=2;for(let i=-4;i<=4;i++){g.beginPath();g.moveTo(cx+i*W*.022,cy+H*.14);g.lineTo(cx+i*W*.16,H);g.stroke();}
      glow(W*.9,H*.3,150,'255,150,70',.5);g.fillStyle='#ffb070';g.beginPath();g.ellipse(W*.9,H*.3,22,30,0,0,TAU);g.fill();g.strokeStyle='#1c252e';g.lineWidth=6;g.stroke();
      glow(cx,H*.66,260,'63,255,208',.42);g.fillStyle='#252d36';g.fillRect(cx-44,H*.5,88,H*.3);g.fillStyle='#39434e';g.fillRect(cx-50,H*.48,100,14);g.fillRect(cx-50,H*.78,100,14);g.fillStyle='#04201e';g.fillRect(cx-22,H*.56,44,H*.14);
      const cg=g.createRadialGradient(cx,H*.63,2,cx,H*.63,34);cg.addColorStop(0,'#eafff9');cg.addColorStop(.4,'#3fffd0');cg.addColorStop(1,'rgba(63,255,208,0)');g.fillStyle=cg;g.fillRect(cx-22,H*.56,44,H*.14);
      g.strokeStyle='#d9a81c';g.lineWidth=5;g.beginPath();g.moveTo(cx-120,H*.86);g.lineTo(cx-36,H*.52);g.moveTo(cx+120,H*.86);g.lineTo(cx+36,H*.52);g.stroke();
      g.fillStyle='#050709';g.fillRect(W*.14,H*.62,W*.14,H*.4);g.beginPath();g.ellipse(W*.25,H*.6,34,58,.2,0,TAU);g.fill();g.beginPath();g.arc(W*.275,H*.4,24,0,TAU);g.fill();g.fillRect(W*.25,H*.7,W*.1,22);g.fillRect(W*.34,H*.7,20,H*.3);
      g.strokeStyle='rgba(63,255,208,.55)';g.lineWidth=1.5;g.beginPath();g.moveTo(W*.293,H*.38);g.lineTo(W*.31,H*.34);g.lineTo(W*.305,H*.29);g.moveTo(W*.295,H*.42);g.lineTo(W*.318,H*.43);g.stroke();break;}
    case'e_transmit':sky('#02040a','#0a1a30','#1b3048');stars(190);aurora(40,40,.3,'70,255,200');station(W*.5,hz,.6,true);
      for(let i=1;i<9;i++){g.strokeStyle=`rgba(255,177,74,${.6-i*.065})`;g.lineWidth=3;g.beginPath();g.arc(W*.5,hz-68,i*62,Math.PI*1.04,Math.PI*1.96);g.stroke();}glow(W*.5,hz-68,60,'255,200,120',.9);
      ground(hz,'#253850','#0a1019');glow(W*.5+120,hz-4,90,'255,120,50',.35);person(W*.2,H*.95,1.5,'#c4481c');snow(50,.3);break;
  }
  const v=g.createRadialGradient(W/2,H/2,H*.35,W/2,H/2,W*.62);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.7)');g.fillStyle=v;g.fillRect(0,0,W,H);
  const gr2=rng(5);for(let i=0;i<5000;i++){g.fillStyle=`rgba(${gr2()<.5?255:0},${gr2()<.5?255:0},${gr2()<.5?255:0},.035)`;g.fillRect(gr2()*W,gr2()*H,2,2);}
}

/* ================= ESCORT NPC ================= */
function makeNpc(tx,ty){return{x:tx*T+24,y:ty*T+24,r:12,a:Math.PI,hp:90,maxHp:90,state:'wait',walk:0,mv:0,inv:0,path:null,pi:0,pt:0,stepD:0};}
function updateNpc(dt){const n=G.npc,p=G.p;if(!n||n.state==='dead')return;n.inv=Math.max(0,n.inv-dt);n.mv=Math.max(0,n.mv-dt*6);
  if(n.state!=='follow'){n.a+=Math.sin(G.time*.8)*dt*.25;return;}
  const d=dist(n.x,n.y,p.x,p.y);if(d>62)steer(n,p.x,p.y,p.crouch?84:p.sprinting?225:154,dt);else n.a+=angDiff(n.a,p.a)*Math.min(1,dt*4);
  if(d<26&&d>0){n.x-=(p.x-n.x)/d*(26-d);n.y-=(p.y-n.y)/d*(26-d);pushOut(n,bm);}
  if(n.hp<n.maxHp)n.hp=Math.min(n.maxHp,n.hp+dt*1.5);}
function hurtNpc(dmg,fx,fy){const n=G.npc;if(!n||n.state!=='follow'||n.inv>0)return;n.hp-=dmg*G.diff.dmg*.6;n.inv=.6;fxBlood(n.x,n.y,8);decal(n.x,n.y,'blood');sfx('hurt',n.x,n.y);floatText(n.x,n.y-26,'BENNY IS HURT','#ff8a7a');addShake(4);
  if(n.hp<=0){n.state='dead';decal(n.x,n.y,'blood',2);world.bgc.globalAlpha=.9;drawNpc(world.bgc,n,true);world.bgc.globalAlpha=1;toast('BENNY IS GONE');if(G.lvl.onNpcDead)G.lvl.onNpcDead();}}
function hurtT(tg,dmg,fx,fy){if(tg===G.p)hurtPlayer(dmg,fx,fy);else hurtNpc(dmg,fx,fy);}
function drawNpc(g,n,dead){
  g.save();g.translate(n.x,n.y);if(!dead){g.fillStyle='rgba(0,0,0,.35)';ell(g,2,4,12,12);}g.rotate(n.a+(dead?1.3:0));g.lineCap='round';const sw=Math.sin(n.walk)*5*(n.mv>0?1:0);
  g.fillStyle='#e9e4d4';ell(g,sw,-5.5,6.5,4);ell(g,-sw,5.5,6.5,4);
  g.strokeStyle='#3d5a78';g.lineWidth=5.5;g.beginPath();if(dead){g.moveTo(0,-10);g.lineTo(-9,-19);g.moveTo(0,10);g.lineTo(11,18);}else{g.moveTo(1,-10);g.lineTo(9,-5);g.moveTo(1,10);g.lineTo(9,5);}g.stroke();
  g.fillStyle='#3d5a78';ell(g,-1,0,9,13);g.fillStyle='#e6e2d6';g.fillRect(1,-7,6,14);g.fillStyle='rgba(0,0,0,.2)';ell(g,-4.5,0,5,11.5);
  if(!dead){g.fillStyle='#d2a688';ell(g,10,-4.5,2.8,2.8);ell(g,10,4.5,2.8,2.8);g.fillStyle='#c9ced4';g.fillRect(10,3,9,3);}
  g.fillStyle='#8f2f14';g.beginPath();g.arc(0,0,7.6,0,TAU);g.fill();g.fillStyle='#d2a688';g.beginPath();g.arc(1.5,0,6.6,-1.1,1.1);g.fill();g.fillStyle='#6d220e';g.beginPath();g.arc(-1,0,3,0,TAU);g.fill();
  if(n.inv>0&&!dead){g.globalAlpha=n.inv;g.fillStyle='#ff3020';ell(g,0,0,11,13);}
  if(dead){g.fillStyle='rgba(20,4,4,.4)';ell(g,0,0,14,16);}
  g.restore();
}

/* ================= CUTSCENES ================= */
let zoomBase=1;G.bars=0;G.zk=1;G.seen={};G.pending=null;G.cine=null;
function scene(key,cams,fn,opt){opt=opt||{};
  if(G.noCine||(key&&G.seen[key])){fn();return;}if(key)G.seen[key]=1;
  const q0=G.dialog.length;fn();const lines=G.dialog.splice(q0),steps=[];
  if(opt.intro)steps.push({at:opt.intro,t:opt.introT||1.5,title:opt.title||null});
  lines.forEach((l,i)=>steps.push({at:cams[Math.min(i,cams.length-1)],say:[l.who,l.text],title:i===0&&!opt.intro?opt.title||null:null}));
  steps.push({at:'p',t:.5});
  if(G.cine){G.cine.steps.pop();for(const s of steps)G.cine.steps.push(s);return;}
  if(G.card>0){G.pending=(G.pending||[]).concat(steps);return;}
  startCine(steps);}
function startCine(steps){G.cine={steps,i:-1,t:0,dur:0,target:null,title:null};G.state='cine';G.dlg=null;mouse.down=false;for(const k in keys)keys[k]=false;cineNext();}
function cineNext(){const c=G.cine;c.i++;if(c.i>=c.steps.length){endCine();return;}const s=c.steps[c.i];c.t=0;c.title=s.title||null;
  if(s.at)c.target=s.at==='p'?null:[s.at[0]*T+24,s.at[1]*T+24];
  if(s.say){G.dlg={who:s.say[0],text:s.say[1],t:0,chars:0,dur:1e9};sfx('radio');c.dur=s.say[1].length/46+1.9+s.say[1].length*.024;}else{G.dlg=null;c.dur=s.t||1.2;}}
function endCine(){G.cine=null;G.dlg=null;G.dlgGap=.2;G.state='play';acc=0;clearPressed();}
function skipCine(){if(G.cine)endCine();}
function cineAdvance(){const c=G.cine;if(!c)return;const d=G.dlg;if(d&&d.chars<d.text.length-1){d.t=d.text.length/46+.01;d.chars=d.text.length;}else if(c.t>.25)cineNext();}
function updateCine(dt){const c=G.cine,p=G.p;c.t+=dt;const tx=c.target?c.target[0]:p.x,ty=c.target?c.target[1]:p.y,k=1-Math.pow(.03,dt);G.cam.x+=(tx-G.cam.x)*k;G.cam.y+=(ty-G.cam.y)*k;
  if(G.shake>0){G.shx=rand(-1,1)*G.shake;G.shy=rand(-1,1)*G.shake;G.shake=Math.max(0,G.shake-dt*30);}else G.shx=G.shy=0;
  const d=G.dlg;if(d){const oc=Math.floor(d.chars);d.t+=dt;d.chars=Math.min(d.text.length,d.t*46);const nc=Math.floor(d.chars);if(nc>oc&&nc%3===0)sfx('blip');}
  for(const l of world.lights)if(l.boot>0)l.boot-=dt;
  if(pressed.Mouse0)cineAdvance();if(G.cine&&G.cine===c&&c.t>=c.dur)cineNext();}
function drawDlg(t,bottom){const d=G.dlg,u=UI,wh=WHO[d.who],mw=Math.min(W*.92,700*u),ps=76*u,tx0=ps+26*u;ctx.font='400 '+Math.round(14*u)+'px '+FM;const lines=wrap(d.text,mw-tx0-18*u),sl=wrap(d.text.slice(0,Math.floor(d.chars)),mw-tx0-18*u);const bh=Math.max(ps+20*u,(lines.length*21+38)*u),bx=W/2-mw/2,by=bottom-bh,talk=d.chars<d.text.length;
  panel(bx,by,mw,bh);ctx.fillStyle=wh.c;ctx.fillRect(bx,by,3*u,bh);const px=bx+13*u,py=by+10*u;ctx.drawImage(portrait(d.who),px,py,ps,ps);
  if(talk){ctx.fillStyle='rgba(255,255,255,.07)';ctx.fillRect(px,py+((t*46*u)%ps),ps,2*u);if(Math.sin(t*37)>.93){ctx.fillStyle='rgba(255,255,255,.06)';ctx.fillRect(px,py,ps,ps);}}
  ctx.strokeStyle=wh.c;ctx.lineWidth=1.5*u;ctx.strokeRect(px,py,ps,ps);txt(wh.n,bx+tx0,by+21*u,11,wh.c,'left',FH,'700');
  ctx.lineWidth=1.2*u;ctx.beginPath();for(let i=0;i<24;i++){const hx=bx+mw-110*u+i*4*u,hh=(Math.sin(t*18+i*1.3)*.5+.5)*(talk?9:1.5)*u;ctx.moveTo(hx,by+17*u-hh);ctx.lineTo(hx,by+17*u+hh);}ctx.stroke();
  sl.forEach((l,i)=>txt(l,bx+tx0,by+(45+i*21)*u,14,'#e6edf3','left',FM,'400'));}
function drawCine(t){const c=G.cine,u=UI,bh=H*.115;
  if(c.title){ctx.globalAlpha=clamp(c.t*1.4,0,1);txt(c.title,W/2,H*.3,50,'#e6edf3','center',FH,'700');ctx.fillStyle='#3fffd0';ctx.fillRect(W/2-60*u,H*.3+16*u,120*u,2*u);txt('DIRECTOR AKSEL HALVARD',W/2,H*.3+40*u,13,'#7fe3d0','center',FM,'400');ctx.globalAlpha=1;}
  if(G.dlg)drawDlg(t,H-bh-12*u);
  txt(touch.on&&!mouse.moved?'TAP — next   ·   II — skip':'ENTER / CLICK — next   ·   ESC — skip',W-18*u,H-bh/2+4*u,11,'#66768a','right',FH,'700');}
canvas.addEventListener('touchstart',()=>{if(G.state==='cine')cineAdvance();},{passive:true});

/* ================= EXPANSION HELPERS ================= */
function updateVents(dt){const p=G.p;for(const v of world.vents){const on=!v.off&&((G.stats.time+v.ph)%4.4)<1.9;
  if(on&&!v.on){sfx('steam',v.x,v.y);emitNoise(v.x+v.dx*v.len/2,v.y+v.dy*v.len/2,250,'door');}v.on=on;if(!on)continue;
  for(let k=0;k<2;k++){const d=rand(v.len);part(v.x+v.dx*d+rand(-6,6),v.y+v.dy*d+rand(-6,6),v.dx*rand(60,160)+rand(-25,25),v.dy*rand(60,160)+rand(-25,25),rand(.3,.6),rand(6,11),'rgba(230,240,250,.3)',2,1.5);}
  const t=clamp((p.x-v.x)*v.dx+(p.y-v.y)*v.dy,0,v.len),cx=v.x+v.dx*t,cy=v.y+v.dy*t;if(dist(p.x,p.y,cx,cy)<p.r+9)hurtPlayer(9,v.x,v.y);}}
function drawVent(g,v){g.fillStyle='#22272e';g.fillRect(v.x-9,v.y-5,18,10);g.fillStyle=v.off?'#39ff9a':'#d9a81c';g.fillRect(v.x-9,v.y+3,18,3);if(v.on){g.fillStyle='rgba(235,245,255,.2)';if(v.dx)g.fillRect(v.x,v.y-9,v.len*v.dx,18);else g.fillRect(v.x-9,v.y,18,v.len*v.dy);}}
function drainWater(){const w=world.w;for(let i=0;i<world.g.length;i++){if(world.g[i]!=='~')continue;world.g[i]='.';world.sol[i]=0;const x=(i%w)*T,y=((i/w)|0)*T;pFloor(world.bgc,'metal',x,y,rng(i+7));world.bgc.fillStyle='rgba(8,34,42,.42)';world.bgc.fillRect(x,y,T,T);world.explored[i]=0;}reveal();}
function drawMast(g,x,y){g.save();g.translate(x,y);g.strokeStyle='rgba(20,24,30,.8)';g.lineWidth=2;for(const a of[.5,2.6,4.7]){g.beginPath();g.moveTo(0,0);g.lineTo(Math.cos(a)*190,Math.sin(a)*190);g.stroke();g.fillStyle='#2b3139';g.fillRect(Math.cos(a)*190-6,Math.sin(a)*190-6,12,12);}
  g.fillStyle='rgba(0,0,0,.45)';g.fillRect(-40,-34,96,84);g.fillStyle='#39414b';g.fillRect(-48,-44,96,84);g.strokeStyle='#8d98a3';g.lineWidth=4;g.strokeRect(-40,-36,80,68);g.beginPath();g.moveTo(-40,-36);g.lineTo(40,32);g.moveTo(40,-36);g.lineTo(-40,32);g.stroke();
  g.strokeStyle='#c9d1d8';g.lineWidth=2;g.strokeRect(-22,-20,44,36);g.strokeRect(-8,-8,16,12);g.fillStyle='#ff3b2a';g.beginPath();g.arc(0,-2,4,0,TAU);g.fill();
  g.fillStyle='#dfe5ea';g.beginPath();g.ellipse(54,-40,20,13,.5,0,TAU);g.fill();g.fillStyle='#8d98a3';g.beginPath();g.ellipse(56,-38,13,8,.5,0,TAU);g.fill();g.restore();}

/* ================= UI + FLOW ================= */
const screens=[...document.querySelectorAll('.screen')];
const ui={cur:null,stack:[]};
function show(id){ui.cur=id;screens.forEach(s=>s.classList.toggle('on',s.id===id));document.body.classList.toggle('playing',!id);}
function push(id){ui.stack.push(ui.cur);show(id);}
function back(){const id=ui.stack.pop();show(id===undefined?'s-title':id);if(!ui.cur&&G.state==='pause')G.state='play';}
function clearPressed(){for(const k in pressed)delete pressed[k];}
const fmtT=s=>Math.floor(s/60)+':'+('0'+Math.floor(s%60)).slice(-2);
function say(who,text){G.dialog.push({who,text});}
function hint(text,dur,alt){G.hintQ.push({text:touch.on&&alt?alt:text,t:0,dur:dur||6});}
function toast(text){G.toastCur={text,t:0};}
function setObj(text,t){G.obj=text;G.objT=t?[t[0]*T+24,t[1]*T+24]:null;}
function updateDialog(dt){
  if(!G.dlg){if(G.dialog.length){G.dlgGap=(G.dlgGap||0)-dt;if(G.dlgGap<=0){const d=G.dialog.shift();G.dlg={who:d.who,text:d.text,t:0,chars:0,dur:d.text.length/46+1.7+d.text.length*.022};sfx('radio');}}}
  else{const d=G.dlg,oc=Math.floor(d.chars);d.t+=dt;d.chars=Math.min(d.text.length,d.t*46);const nc=Math.floor(d.chars);if(nc>oc&&nc%3===0)sfx('blip');if(d.t>d.dur){G.dlg=null;G.dlgGap=.3;}}
  if(!G.hintCur){if(G.hintQ.length)G.hintCur=G.hintQ.shift();}else{G.hintCur.t+=dt;if(G.hintCur.t>G.hintCur.dur)G.hintCur=null;}
  if(G.toastCur){G.toastCur.t+=dt;if(G.toastCur.t>2.2)G.toastCur=null;}
}
function refreshTitle(){
  $('b-continue').style.display=store.run?'':'none';const hb=$('b-holdout'),un=store.cleared>=DRILL_I;hb.disabled=!un;hb.textContent=un?'HOLDOUT'+(store.holdoutBest?'  ·  BEST '+store.holdoutBest:''):'HOLDOUT  ·  reach the Drill Hall to unlock';
  $('title-foot').textContent='LOGS '+store.codex.length+'/'+LOG_ORDER.length+'   ·   ENDINGS '+store.endings.length+'/3'+(store.bestTime?'   ·   BEST TIME '+fmtT(store.bestTime):'');
}
function toTitle(){G.state='title';ui.stack.length=0;music.tt=0;music.wind(.12);refreshTitle();show('s-title');}
/* --- run management --- */
function freshStats(){return{time:0,kills:0,silent:0,shots:0,deaths:0,logs:0,hurt:0,score:0};}
function newRun(diffId){G.mode='story';G.diffId=diffId;G.diff=DIFFS[diffId];G.upg={};G.p=newPlayer();G.stats=freshStats();G.seen={};}
function snapshot(){const p=G.p;store.run={level:G.li,diff:G.diffId,upg:Object.assign({},G.upg),stats:Object.assign({},G.stats),p:{hp:p.hp,weapons:p.weapons.slice(),cur:p.cur,mag:Object.assign({},p.mag),ammo:Object.assign({},p.ammo),flares:p.flares,medkits:p.medkits,salvage:p.salvage}};saveStore();}
function restore(){const r=store.run;G.mode='story';G.diffId=DIFFS[r.diff]?r.diff:'standard';G.diff=DIFFS[G.diffId];G.upg=Object.assign({},r.upg);G.stats=Object.assign(freshStats(),r.stats);const p=G.p=newPlayer();
  p.hp=r.p.hp;p.weapons=r.p.weapons.slice();p.cur=r.p.cur;Object.assign(p.mag,r.p.mag);Object.assign(p.ammo,r.p.ammo);p.flares=r.p.flares;p.medkits=r.p.medkits;p.salvage=r.p.salvage;}
function startLevel(i){
  G.li=i;G.lvl=LEVELS[i];G.flags={};G.timer=null;G.boss=null;G.npc=null;G.pending=null;G.cine=null;G.dialog.length=0;G.dlg=null;G.hintQ.length=0;G.hintCur=null;G.toastCur=null;G.objT=null;G.obj='';G.hud=null;G.fade=0;G.hunting=0;G.hitStop=0;G.shake=0;G.dmgFx=0;G.noiseHud=0;G.prompt=null;
  for(const q of parts)q.on=false;floats.length=0;
  buildWorld(G.lvl);const p=G.p;p.x=world.px;p.y=world.py;p.keys={};p.kx=p.ky=0;p.reload=0;p.melee=0;p.cd=0;p.crouch=false;p.light=true;p.inv=0;p.st=1;p.hp=clamp(p.hp,1,maxHp());
  G.cam.x=p.x;G.cam.y=p.y;G.lvlLogs=world.items.filter(it=>it.type==='log').length;G.lvl0={kills:G.stats.kills,silent:G.stats.silent,time:G.stats.time};
  if(G.mode==='holdout'){world.items=world.items.filter(it=>it.type!=='log'&&it.type!=='weapon');world.enemies.length=0;for(const u of world.uses)u.enabled=false;powerOn();}
  else{snapshot();if(i>store.cleared){store.cleared=i;saveStore();}}
  if(G.showMap===undefined)G.showMap=true;music.wind(G.lvl.wind);music.tt=0;reveal();
  G.card=3.6;G.state='card';ui.stack.length=0;show(null);G.lvl.onStart();acc=0;
}
function completeLevel(){if(G.state!=='play')return;sfx('uiok');music.tt=0;G.state='inter';G.p.hp=Math.min(maxHp(),G.p.hp+30);buildInter();show('s-inter');}
function buildInter(){
  const p=G.p,s=G.stats,l0=G.lvl0,found=G.lvlLogs-world.items.filter(it=>it.type==='log').length;
  $('inter-name').textContent='CHAPTER '+CHAPTER_NUM[G.li]+' — '+G.lvl.name;
  $('inter-stats').innerHTML=[['TIME',fmtT(s.time-l0.time)],['KILLS',s.kills-l0.kills],['SILENT KILLS',s.silent-l0.silent],['LOGS FOUND',found+' / '+G.lvlLogs]].concat(G.li===1?[['SURVIVOR',U('benny')?'SAVED':'LOST']]:[]).map(a=>'<div><span>'+a[0]+'</span><b>'+a[1]+'</b></div>').join('');
  $('inter-salv').textContent=p.salvage;
  $('inter-shop').innerHTML=UPGRADES.map(u=>{const lv=U(u.id),mx=u.c.length,cost=u.c[lv];const pips='<i class="on"></i>'.repeat(lv)+'<i></i>'.repeat(mx-lv);
    return'<button class="upg'+(lv>=mx?' max':'')+(lv<mx&&p.salvage<cost?' poor':'')+'" data-act="buy" data-id="'+u.id+'"><div class="un">'+u.n+'<span class="pips">'+pips+'</span></div><div class="ud">'+u.d+'</div><div class="uc">'+(lv>=mx?'INSTALLED':'⬢ '+cost)+'</div></button>';}).join('');
  $('b-next').textContent='CONTINUE  →  CHAPTER '+CHAPTER_NUM[G.li+1]+': '+LEVELS[G.li+1].name;
}
function gameOver(reason){G.state='dead';music.tt=0;G.timer=null;const hold=G.mode==='holdout';
  if(hold){const sc=G.stats.score,best=sc>store.holdoutBest;if(best){store.holdoutBest=sc;}saveStore();$('dead-h').textContent='OVERRUN';$('dead-t').innerHTML='Wave <b>'+(G.flags.wave||0)+'</b> · Score <b>'+sc+'</b>'+(best?' · <b class="hl">NEW BEST</b>':' · Best '+store.holdoutBest);}
  else{if(store.run){store.run.stats.deaths=(store.run.stats.deaths||0)+1;saveStore();}$('dead-h').textContent='YOU ARE QUIET NOW';
    $('dead-t').textContent=reason||pick(['Sprinting is loud. Sneaking (C) is almost silent.','A flare (G) pulls them away from you. Throw it, then go the other way.','Held torchlight wakes them. Tap F and move in the dark.','A still one dies to a single axe blow from behind.','Brutes stun themselves on walls. Sidestep the charge.','If a Caller screams, break line of sight and relocate.']);}
  setTimeout(()=>{if(G.state==='dead')show('s-dead');},900);}
function retry(){if(G.mode==='holdout'){startHoldout();return;}restore();startLevel(store.run.level);}
function startHoldout(){G.mode='holdout';G.diffId='standard';G.diff=DIFFS.standard;G.upg={};G.stats=freshStats();const p=G.p=newPlayer();p.weapons=['pistol','shotgun','carbine'];p.cur=2;p.mag={pistol:12,shotgun:6,carbine:24};p.ammo={a9:48,sh:18,rf:96};p.flares=3;p.medkits=2;startLevel(DRILL_I);}
function endGame(choice){if(G.state!=='play')return;G.state='end';music.tt=0;G.timer=null;const s=G.stats;if(!store.endings.includes(choice))store.endings.push(choice);if(!store.bestTime||s.time<store.bestTime)store.bestTime=Math.round(s.time);
  const deaths=(store.run&&store.run.stats.deaths)||0;store.run=null;saveStore();const e=ENDINGS[choice];$('end-h').textContent=e.t;$('end-t').textContent=e.x+(U('benny')?'\n\n'+BENNY_END[choice]:'');paintScene($('end-art'),'e_'+choice);
  $('end-stats').innerHTML=[['TIME',fmtT(s.time)],['KILLS',s.kills],['SILENT',s.silent],['DEATHS',deaths],['LOGS',store.codex.length+' / '+LOG_ORDER.length],['DIFFICULTY',G.diff.n],['ENDINGS SEEN',store.endings.length+' / 3']].map(a=>'<div><span>'+a[0]+'</span><b>'+a[1]+'</b></div>').join('');
  sfx(choice==='extract'?'hum':'boom');G.fade=0;const iv=setInterval(()=>{G.fade+=.05;if(G.fade>=1){clearInterval(iv);show('s-end');G.fade=0;}},40);}
function pauseGame(){if(G.state!=='play')return;G.state='pause';ui.stack.length=0;show('s-pause');}
/* --- codex + logs --- */
function logHTML(id){const l=LOGS[id];return'<div class="log-meta">'+l.a+(l.d&&l.d!=='—'?'  ·  '+l.d:'')+'</div><h3>'+l.t+'</h3><div class="log-body">'+l.x.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</div>';}
function openLog(id){G.state='log';$('log-box').innerHTML=logHTML(id)+'<div class="log-count">RECOVERED '+store.codex.length+' / '+LOG_ORDER.length+'</div>';ui.stack.length=0;show('s-log');}
function buildCodex(sel){
  $('codex-count').textContent=store.codex.length+' / '+LOG_ORDER.length+' RECOVERED  ·  ENDINGS '+store.endings.length+' / 3';
  $('codex-list').innerHTML=LOG_ORDER.map((id,i)=>{const has=store.codex.includes(id);return'<button class="cx'+(has?'':' locked')+(id===sel?' sel':'')+'" data-act="cx" data-id="'+id+'"'+(has?'':' disabled')+'><span>'+('0'+(i+1)).slice(-2)+'</span>'+(has?LOGS[id].t:'— not recovered —')+'</button>';}).join('');
  $('codex-read').innerHTML=sel?logHTML(sel):'<div class="log-meta">HALVARD STATION ARCHIVE</div><h3>Select a recovered log</h3><div class="log-body">Thirty-six records survive across the station: journals, medical logs, drill reports, and the things people wrote when they knew nobody was coming.\n\nRecover at least '+TESTIMONY_NEED+' and a third option opens at the end.</div>';
}
function confirmBox(title,text,cb){G.state='confirm';ui.cb=cb;$('conf-h').textContent=title;$('conf-t').textContent=text;show('s-confirm');}
/* --- intro --- */
let introI=0;
function introShow(){const p=INTRO[introI];$('intro-h').textContent=p[0];$('intro-t').textContent=p[1];paintScene($('intro-art'),'i'+introI);const b=$('intro-box');b.classList.remove('in');void b.offsetWidth;b.classList.add('in');sfx('radio');}
function introNext(){introI++;if(introI>=INTRO.length){startLevel(0);}else introShow();}
/* --- actions --- */
function act(a,el){
  audio.init();
  switch(a){
    case'new':$('diff-list').innerHTML=Object.keys(DIFFS).map(k=>'<button data-act="diff" data-id="'+k+'"><b>'+DIFFS[k].n+'</b><span>'+DIFFS[k].d+'</span></button>').join('');push('s-diff');break;
    case'diff':newRun(el.dataset.id);store.run=null;introI=0;G.state='intro';ui.stack.length=0;show('s-intro');introShow();break;
    case'intronext':introNext();break;
    case'introskip':startLevel(0);break;
    case'continue':if(store.run){restore();startLevel(store.run.level);}break;
    case'holdout':if(store.cleared>=DRILL_I)startHoldout();break;
    case'codex':buildCodex();push('s-codex');break;
    case'cx':buildCodex(el.dataset.id);break;
    case'how':push('s-how');break;
    case'settings':syncSettings();push('s-settings');break;
    case'back':back();break;
    case'resume':G.state='play';show(null);clearPressed();break;
    case'closelog':G.state='play';show(null);clearPressed();break;
    case'restart':retry();break;
    case'retry':retry();break;
    case'quit':toTitle();break;
    case'next':startLevel(G.li+1);break;
    case'buy':{const u=UPGRADES.find(u=>u.id===el.dataset.id),lv=U(u.id),p=G.p;if(lv>=u.c.length||p.salvage<u.c[lv]){sfx('denied');break;}p.salvage-=u.c[lv];G.upg[u.id]=lv+1;if(u.id==='parka')p.hp+=25;if(u.id==='pouch')p.flares=Math.min(maxFlares(),p.flares+2);sfx('uiok');buildInter();break;}
    case'yes':{const cb=ui.cb;ui.cb=null;G.state='play';show(null);clearPressed();if(cb)cb();break;}
    case'no':ui.cb=null;G.state='play';show(null);clearPressed();break;
    case'erase':if(el.dataset.sure){try{localStorage.removeItem(SAVE_KEY);}catch(e){}store.codex=[];store.endings=[];store.bestTime=null;store.holdoutBest=0;store.cleared=0;store.run=null;saveStore();el.textContent='SAVE DATA ERASED';delete el.dataset.sure;refreshTitle();}else{el.dataset.sure=1;el.textContent='CLICK AGAIN TO CONFIRM';}break;
  }
  if(a!=='buy'&&a!=='erase')sfx('ui');
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b&&!b.disabled)act(b.dataset.act,b);});
function syncSettings(){const s=store.settings;$('set-master').value=s.master;$('set-music').value=s.music;$('set-sfx').value=s.sfx;$('set-mute').checked=s.mute;$('set-shake').checked=s.shake;$('set-quality').value=s.quality;const e=document.querySelector('[data-act="erase"]');e.textContent='ERASE ALL SAVE DATA';delete e.dataset.sure;}
for(const k of['master','music','sfx'])$('set-'+k).addEventListener('input',e=>{store.settings[k]=parseFloat(e.target.value);audio.applyVol();saveStore();if(k==='sfx')sfx('pickup');});
$('set-mute').addEventListener('change',e=>{store.settings.mute=e.target.checked;audio.applyVol();saveStore();});
$('set-shake').addEventListener('change',e=>{store.settings.shake=e.target.checked;saveStore();});
$('set-quality').addEventListener('change',e=>{store.settings.quality=e.target.value;saveStore();resize();if(world.bg)relight();});
function onKey(c){
  const s=G.state;
  if(s==='cine'){if(c==='Escape')skipCine();else if(c==='Enter'||c==='Space'||c==='KeyE')cineAdvance();return;}
  if(c==='Escape'||c==='KeyP'){
    if(s==='play')pauseGame();else if(ui.stack.length)back();else if(s==='pause')act('resume');else if(s==='log')act('closelog');else if(s==='intro'&&c==='Escape')act('introskip');else if(s==='confirm')act('no');
    return;}
  if(c==='KeyM'){if(s==='play')G.showMap=!G.showMap;else if(s!=='intro'){store.settings.mute=!store.settings.mute;audio.applyVol();saveStore();}}
  if(s==='play'){if(c==='Tab'||c==='KeyJ'){G.state='pause';ui.stack.length=0;show('s-pause');buildCodex();push('s-codex');}}
  else if(s==='log'&&(c==='KeyE'||c==='Enter'||c==='Space'))act('closelog');
  else if(s==='intro'&&(c==='Enter'||c==='Space'))introNext();
  else if(s==='dead'&&(c==='Enter'||c==='KeyR')&&ui.cur==='s-dead')act('retry');
  else if(s==='card'&&(c==='Enter'||c==='Space'))G.card=Math.min(G.card,.9);
  else if(s==='confirm'&&c==='Enter')act('yes');
}

/* ================= MAIN LOOP ================= */
const STEP=1/60;let last=0,acc=0;
function updateCam(dt){const p=G.p;let lx,ly;if(!touch.on||mouse.moved){lx=(mouse.x-W/2)/zoom*.22;ly=(mouse.y-H/2)/zoom*.22;}else{lx=Math.cos(p.a)*70;ly=Math.sin(p.a)*70;}
  const k=1-Math.pow(.0004,dt);G.cam.x+=(p.x+lx-G.cam.x)*k;G.cam.y+=(p.y+ly-G.cam.y)*k;
  if(G.shake>0){G.shx=rand(-1,1)*G.shake;G.shy=rand(-1,1)*G.shake;G.shake=Math.max(0,G.shake-dt*42);}else G.shx=G.shy=0;
  mouse.wx=G.cam.x+(mouse.x-W/2)/zoom;mouse.wy=G.cam.y+(mouse.y-H/2)/zoom;if(G.bot){mouse.wx=G.bot[0];mouse.wy=G.bot[1];}}
function step(dt){updatePlayer(dt);if(G.state!=='play')return;updateWorld(dt);updateDialog(dt);G.stats.time+=dt;}
function frame(ts){
  requestAnimationFrame(frame);const dt=Math.min(.1,Math.max(0,(ts-last)/1000||0));last=ts;G.time+=dt;music.update(dt);const s=G.state;G.bars+=((s==='cine'?1:0)-G.bars)*Math.min(1,dt*5);G.zk+=((s==='cine'?1.14:1)-G.zk)*Math.min(1,dt*2.5);zoom=zoomBase*G.zk;
  if(s==='play'){
    updateCam(dt);
    if(G.hitStop>0)G.hitStop-=dt;
    else{acc+=dt;let n=0;while(acc>=STEP&&n<5&&G.state==='play'){step(STEP);acc-=STEP;n++;clearPressed();}if(n>=5)acc=0;}
    render(dt);
  }else if(s==='card'){G.card-=dt;if(G.card<=0){G.card=0;G.state='play';acc=0;if(G.pending){const q=G.pending;G.pending=null;startCine(q);}}updateCam(0);render(dt);clearPressed();}
  else if(s==='cine'){updateCine(dt);render(dt);clearPressed();}
  else if((s==='pause'||s==='log'||s==='confirm'||s==='dead'||s==='end')&&world.bg&&G.p){if(s==='dead'){G.dmgFx=1;}render(0);clearPressed();}
  else{drawTitleBG(dt);clearPressed();}
}
resize();mouse.x=W/2;mouse.y=H/2;toTitle();requestAnimationFrame(frame);
if(location.protocol.indexOf('http')===0){try{const l=document.createElement('link');l.rel='manifest';l.href='manifest.json';document.head.appendChild(l);if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});}catch(e){}}
window.__QB={skipCine,hurtNpc,los,dist,WEAP,portrait,paintScene,G,world,store,LEVELS,LOGS,act,startLevel,newRun,Builder,SOL,T,keys,pressed,mouse,hurtEnemy,killEnemy,completeLevel,spawnEnemy,alertEnemy,passable,findPath,startHoldout};
})();
