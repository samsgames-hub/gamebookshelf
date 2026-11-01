// Renders the Fresh Tracks banner and tile from the live game build, so the launcher art always matches the game.
const fs=require('fs');let PP=null,PW=null;try{PP=require('puppeteer-core')}catch(e){PW=require('playwright').chromium}
const exe=process.env.CHROME||['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium-browser','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const URL=process.env.KEYART_URL||'http://localhost:8000/games/fresh-tracks/',OUT=process.env.KEYART_OUT||'gamebookshelf/assets/';
const base={tod:'day',lift:2.4,spin:.35,grab:1,side:1.6,up:1.4,ahead:6,ly:.6};
const shots=[['fresh-tracks-hero.webp',1600,680,{...base,back:3.8,shift:4.2,fov:46}],['fresh-tracks-tile.webp',800,450,{...base,back:3.6,shift:1.1,fov:48}]];
async function stage(o){const F=window.__FT;F.save.set.q=2;F.save.set.shake=false;dispatchEvent(new Event('resize'));
 F.CAM.hook=null;F.TER.BEHIND=7;F.save.set.tod=o.tod;const MR=Math.random;let k=1;Math.random=()=>{k=(k*16807)%2147483647;return k/2147483647};F.startRun('free');Math.random=MR;
 for(let i=0;i<60*30;i++){const P=F.PH.pos,s=-P.z,u=P.x-F.cx(s+6);const x=Math.max(-1,Math.min(1,-u*.15-F.PH.psi*1.2));
  F.sim(1/60,{x:F.PH.ground?x:0,y:F.PH.ground?-.6:0,jump:false,boost:!F.PH.ground});if(!F.PH.ground&&F.PH.air>.3&&F.PH.vel.y<.3&&F.PH.pos.y-F.heightS(P.x,-P.z)>1.6)break}
 F.setForce({x:0,y:0,jump:false,boost:true});const P=F.PH.pos.clone();P.y+=o.lift;F.PH.air=1;F.PH.spin=o.spin;F.PH.grabT=1;F.PH.grabType=0;F.PH.flip=0;
 F.CAM.hook=()=>{F.PH.pos.copy(P);F.PH.vel.set(0,0,0);for(let j=0;j<40;j++)F.updateRiderVisual(1/60,j/60);const s=-P.z,fx=F.cx(s+3)-F.cx(s-3),fz=-6,fl=Math.hypot(fx,fz),f=[fx/fl,fz/fl],r=[-f[1],f[0]];
  F.CAM.pos.set(P.x-f[0]*o.back+r[0]*o.side,P.y+o.up,P.z-f[1]*o.back+r[1]*o.side);F.CAM.look.set(P.x+f[0]*o.ahead-r[0]*o.shift,P.y+o.ly,P.z+f[1]*o.ahead-r[1]*o.shift);F.CAM.fov=o.fov};
 ['hud','hint','msg','menu','touch'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add('hide')});
 for(let n=0;n<4;n++)await new Promise(r=>requestAnimationFrame(r));
 return await new Promise(r=>requestAnimationFrame(()=>r(F.ren.domElement.toDataURL('image/webp',.86))))}
(async()=>{const args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
 const b=PP?await PP.launch({executablePath:exe,headless:true,protocolTimeout:600000,args}):await PW.launch({args});
 for(const [name,W,H,o] of shots){const p=PP?await b.newPage():await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});if(PP)await p.setViewport({width:W,height:H,deviceScaleFactor:1});
  p.on('pageerror',e=>console.log('page error:',e.message));p.setDefaultTimeout&&p.setDefaultTimeout(600000);
  await p.goto(URL,{waitUntil:'load',timeout:180000});const ready=()=>window.__FT&&window.__FT.MOD.geo.rider;
  if(PP)await p.waitForFunction(ready,{timeout:400000,polling:1000});else await p.waitForFunction(ready,null,{timeout:400000,polling:1000});
  const url=await p.evaluate(stage,o);const buf=Buffer.from(url.split(',')[1],'base64');if(buf.length<8000||!url.startsWith('data:image/webp'))throw new Error('bad render for '+name);
  fs.writeFileSync(OUT+name,buf);console.log('wrote',OUT+name,buf.length,'bytes');await p.close()}
 await b.close()})().catch(e=>{console.error(e);process.exit(1)});
