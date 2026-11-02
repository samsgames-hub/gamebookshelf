// Renders the Switchback banner and tile from the live game build, so the launcher art always matches the game.
const fs=require('fs');let PP=null,PW=null;try{PP=require('puppeteer-core')}catch(e){PW=require('playwright').chromium}
const exe=process.env.CHROME||['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium-browser','/usr/bin/chromium'].find(p=>fs.existsSync(p));
const URL=process.env.KEYART_URL||'http://localhost:8000/games/switchback/',OUT=process.env.KEYART_OUT||'gamebookshelf/assets/';
const base={track:0,tod:'day',secs:16,seed:7};
const shots=[['switchback-hero.webp',1600,680,{...base,ahead:-8.5,side:-2.2,up:2.6,lookA:14,lookS:-3,ly:.4,fov:44}],['switchback-tile.webp',800,450,{...base,ahead:-8.5,side:-2.6,up:2.8,lookA:14,lookS:.6,ly:.3,fov:50}]];
async function stage(o){const S=window.__SW;S.save.set.q=2;S.save.set.shake=false;S.save.set.tod=o.tod;S.save.set.diff=1;dispatchEvent(new Event('resize'));
 const MR=Math.random;let k=o.seed||1;Math.random=()=>{k=(k*16807)%2147483647;return k/2147483647};
 window.__autopilot=.97;S.startRace(o.track,'race');S.sim(o.secs);Math.random=MR;
 ['hud','touch','menu','err'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add('hide')});document.querySelectorAll('section').forEach(e=>e.classList.add('hide'));
 const pl=S.RACE.player,C=S.CAMS;
 C.hook=()=>{const cs=Math.cos(pl.th),sn=Math.sin(pl.th),fx=cs,fz=sn,rx=-sn,rz=cs;
  C.pos.set(pl.x+fx*o.ahead+rx*o.side,pl.y+o.up,pl.z+fz*o.ahead+rz*o.side);C.look.set(pl.x+fx*o.lookA+rx*o.lookS,pl.y+o.ly,pl.z+fz*o.lookA+rz*o.lookS);C.fov=o.fov};
 for(let n=0;n<6;n++){S.step(1/60);await new Promise(r=>requestAnimationFrame(r))}
 S.step(1/60);return S.ren.domElement.toDataURL('image/webp',.88)}
(async()=>{const args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];
 const b=PP?await PP.launch({executablePath:exe,headless:true,protocolTimeout:900000,args}):await PW.launch({args});
 for(const [name,W,H,o] of shots){const p=PP?await b.newPage():await b.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});if(PP)await p.setViewport({width:W,height:H,deviceScaleFactor:1});
  p.on('pageerror',e=>console.log('page error:',e.message));p.setDefaultTimeout&&p.setDefaultTimeout(900000);
  await p.goto(URL,{waitUntil:'domcontentloaded',timeout:180000});const ready=()=>!!window.__SW;
  if(PP)await p.waitForFunction(ready,{timeout:400000,polling:1000});else await p.waitForFunction(ready,null,{timeout:400000,polling:1000});
  const url=await p.evaluate(stage,o);const buf=Buffer.from(url.split(',')[1],'base64');if(buf.length<8000||!url.startsWith('data:image/webp'))throw new Error('bad render for '+name);
  fs.writeFileSync(OUT+name,buf);console.log('wrote',OUT+name,buf.length,'bytes');await p.close()}
 await b.close()})().catch(e=>{console.error(e);process.exit(1)});
