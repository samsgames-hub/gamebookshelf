'use strict';
(function () {
// =====================================================================
//  CORNER POCKET — 8-ball & 9-ball pool
// =====================================================================
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
const isTouch = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
if (isTouch) document.body.classList.add('touch');

let errShown = false;
window.addEventListener('error', e => {
  if (errShown) return; errShown = true;
  const b = $('err'); b.textContent = 'Something went wrong: ' + (e.message || 'unknown error') + '. Reload the page to keep playing.'; b.className = '';
});

const store = {
  get(k, d) { try { const v = localStorage.getItem('cornerpocket.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cornerpocket.' + k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
};

// ---------------------------------------------------------------- data
const BALL_HEX = ['#f3eee0', '#f0b51a', '#1b44ad', '#cf2a20', '#52247c', '#ec6814', '#14703a', '#7a1a1f', '#141414',
  '#f0b51a', '#1b44ad', '#cf2a20', '#52247c', '#ec6814', '#14703a', '#7a1a1f'];
const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BALL_RGB = BALL_HEX.map(hex2rgb);

const CUES = {
  house:  { name: 'House Cue',     price: 0,    guide: 1.0,  power: 1.0,  spin: .62, c: ['#d8b27a', '#4a2c18', '#6d4a2c', '#cfc6b5'], desc: 'Straight enough. The tip has seen better days.' },
  maple:  { name: 'Maple Classic', price: 300,  guide: 1.35, power: 1.05, spin: .78, c: ['#e3c28c', '#2a1a10', '#1d1d1d', '#e8e0cf'], desc: 'A solid hard-rock maple player with an Irish linen wrap.' },
  birds:  { name: 'Birdseye Pro',  price: 900,  guide: 1.7,  power: 1.1,  spin: .9,  c: ['#ecd3a2', '#5a1b16', '#26201a', '#efe6d2'], desc: 'Low-deflection shaft and a crisp layered tip.' },
  carbon: { name: 'Carbon Break',  price: 1800, guide: 1.8,  power: 1.25, spin: .95, c: ['#2b2e33', '#14161a', '#3a3f46', '#9aa3ad'], desc: 'Carbon fiber shaft built to break racks open.' },
  gold:   { name: 'Kane Gold',     price: 3600, guide: 2.2,  power: 1.2,  spin: 1.0, c: ['#ead6aa', '#120d09', '#2b2014', '#d6b26a'], desc: 'The house champion\'s own design, gold rings and ebony points.' }
};
const CLOTHS = {
  emerald: { name: 'Emerald',         price: 0,   c: '#1b6a45' },
  blue:    { name: 'Tournament Blue', price: 150, c: '#1c4f86' },
  wine:    { name: 'Burgundy',        price: 300, c: '#6c1d2b' },
  slate:   { name: 'Slate',           price: 500, c: '#2f383e' },
  camel:   { name: 'Camel',           price: 800, c: '#8c6c3f' }
};
const LADDER = [
  { name: 'Danny Moss',      nick: 'The Regular',  skill: .1,  game: '8', race: 2, prize: 60,   col: '#56707f', bio: 'Plays every Thursday, never practices. Leaves a lot of easy shots.' },
  { name: 'Rita Cole',       nick: 'Bar-Box Rita', skill: .26, game: '8', race: 2, prize: 120,  col: '#8a4a5e', bio: 'Grew up on the small tables. Pots the simple ones, struggles with position.' },
  { name: 'Hank Haskins',    nick: 'Two-Rail',     skill: .4,  game: '9', race: 2, prize: 200,  col: '#6c6a3e', bio: 'Old school. Loves a bank shot and will try one when he shouldn\'t.' },
  { name: 'Marco Vell',      nick: 'The Hustler',  skill: .52, game: '8', race: 3, prize: 320,  col: '#3d5f8e', bio: 'Starts slow on purpose. Do not let him get comfortable.' },
  { name: 'June Park',       nick: 'Ice',          skill: .64, game: '9', race: 3, prize: 500,  col: '#3a7a74', bio: 'Never smiles, never rushes, almost never misses a straight-in.' },
  { name: 'Leon Achterberg', nick: 'The Professor',skill: .75, game: '8', race: 3, prize: 750,  col: '#5a4a7c', bio: 'Plays safe when he has to. Thinks three balls ahead.' },
  { name: 'Lou Tanaka',      nick: 'Big Lou',      skill: .86, game: '9', race: 3, prize: 1100, col: '#8b5a2b', bio: 'Breaks like a cannon. If something drops, he runs out.' },
  { name: 'Victor Kane',     nick: 'House Champion', skill: .95, game: '8', race: 4, prize: 2000, col: '#a8323a', bio: 'Owns the hall. Nobody has taken a match off him in years.' }
];
const LEVELS = [
  { name: 'Rookie', skill: .1, prize: 15, sub: 'learning the game' },
  { name: 'Regular', skill: .4, prize: 35, sub: 'pots the easy ones' },
  { name: 'Shark', skill: .7, prize: 60, sub: 'plays position' },
  { name: 'Pro', skill: .93, prize: 100, sub: 'rarely misses' },
  { name: 'Friend', skill: -1, prize: 0, sub: 'two players, one device' }
];

// ---------------------------------------------------------------- settings & save
const DEF_SET = { master: .8, music: .45, sfx: .9, mute: false, shake: true, low: false };
const SET = Object.assign({}, DEF_SET, store.get('settings', {}));
const DEF_SAVE = { money: 100, cues: ['house'], cue: 'house', cloths: ['emerald'], cloth: 'emerald', ladder: 0, beaten: [], speedBest: null, speedMedals: 0, tut: 0,
  stats: { won: 0, lost: 0, potted: 0, bestRun: 0 } };
const SAVE = Object.assign({}, DEF_SAVE, store.get('save', {}));
SAVE.stats = Object.assign({}, DEF_SAVE.stats, SAVE.stats || {});
if (!CUES[SAVE.cue]) SAVE.cue = 'house';
if (!CLOTHS[SAVE.cloth]) SAVE.cloth = 'emerald';
const persist = () => store.set('save', SAVE);
const persistSet = () => store.set('settings', SET);

// =====================================================================
//  AUDIO (all generated with Web Audio)
// =====================================================================
const AU = { ctx: null, duck: 1, demo: false };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  let c; try { c = new AC(); } catch (e) { return; }
  AU.ctx = c;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .25;
  AU.master = c.createGain(); comp.connect(AU.master); AU.master.connect(c.destination);
  AU.sfx = c.createGain(); AU.sfx.connect(comp);
  AU.mus = c.createGain(); AU.mus.connect(comp);
  AU.verb = c.createConvolver(); AU.verb.buffer = impulse(c, 1.9, 2.6);
  const vOut = c.createGain(); vOut.gain.value = .3; AU.verb.connect(vOut); vOut.connect(comp);
  AU.sv = c.createGain(); AU.sv.gain.value = .3; AU.sv.connect(AU.verb);
  AU.mv = c.createGain(); AU.mv.gain.value = .55; AU.mv.connect(AU.verb);
  const len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  AU.noise = nb;
  // rolling-on-cloth rumble
  const src = c.createBufferSource(); src.buffer = nb; src.loop = true;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300; lp.Q.value = .3;
  AU.roll = c.createGain(); AU.roll.gain.value = 0;
  src.connect(lp); lp.connect(AU.roll); AU.roll.connect(AU.sfx); src.start();
  applyAudio();
  Music.start();
}
function impulse(c, dur, decay) {
  const len = Math.floor(c.sampleRate * dur), b = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
  return b;
}
function applyAudio() {
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime;
  AU.master.gain.setTargetAtTime(SET.mute ? 0 : SET.master, t, .03);
  AU.sfx.gain.setTargetAtTime(SET.sfx * (AU.demo ? .35 : 1), t, .05);
  AU.mus.gain.setTargetAtTime(SET.music * .72 * AU.duck, t, .25);
}
function envG(g, t, a, peak, dec) {
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(.0001, t + a + dec);
}
function route(node, pan, verb, bus) {
  const c = AU.ctx; let n = node;
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); node.connect(p); n = p; }
  n.connect(bus || AU.sfx); if (verb) n.connect(bus === AU.mus ? AU.mv : AU.sv);
}
function tone(type, f, t, a, peak, dec, pan, f2, bus, verb = true) {
  const c = AU.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dec);
  o.connect(g); envG(g, t, a, peak, dec); route(g, pan, verb, bus);
  o.start(t); o.stop(t + a + dec + .05);
}
function noiseB(t, dur, type, f, q, peak, a, pan, bus, verb = true) {
  const c = AU.ctx, s = c.createBufferSource(); s.buffer = AU.noise;
  const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  const g = c.createGain(); s.connect(fl); fl.connect(g); envG(g, t, a, peak, dur); route(g, pan, verb, bus);
  s.start(t, Math.random() * 1.5); s.stop(t + a + dur + .05);
}
const SFX = {
  clack(s, pan) {
    if (!AU.ctx) return; const t = AU.ctx.currentTime + .005, v = clamp(s / 3.2, .025, 1), f = rand(2700, 3500);
    tone('sine', f, t, .001, .32 * v, .05, pan); tone('sine', f * 1.51, t, .001, .14 * v, .032, pan);
    tone('triangle', f * .41, t, .001, .1 * v, .06, pan); noiseB(t, .014, 'highpass', 5200, .7, .22 * v, .001, pan);
  },
  rail(s, pan) {
    if (!AU.ctx) return; const t = AU.ctx.currentTime + .005, v = clamp(s / 2.6, .03, 1);
    noiseB(t, .1, 'lowpass', 420, .9, .5 * v, .003, pan); tone('sine', 105, t, .003, .32 * v, .09, pan, 62);
  },
  strike(s) {
    if (!AU.ctx) return; const t = AU.ctx.currentTime + .005, v = clamp(s / 6, .14, 1);
    tone('sine', 1250, t, .001, .26 * v, .03); tone('triangle', 560, t, .001, .22 * v, .055);
    noiseB(t, .025, 'bandpass', 2400, 1.3, .28 * v, .001); tone('sine', 190, t, .002, .18 * v, .07, 0, 120);
  },
  pocket(s, pan) {
    if (!AU.ctx) return; const t = AU.ctx.currentTime + .01, v = clamp(s / 2 + .35, .35, 1);
    tone('sine', 160, t, .004, .5 * v, .17, pan, 52); noiseB(t, .07, 'lowpass', 700, .7, .32 * v, .002, pan);
    for (let k = 0; k < 3; k++) noiseB(t + .07 + k * .045 + Math.random() * .02, .025, 'bandpass', rand(800, 1500), 4, .14 * v, .001, pan);
    noiseB(t + .16, .55, 'lowpass', 260, .5, .14 * v, .09, pan);
  },
  ui() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .005; tone('sine', 1500, t, .002, .07, .05, 0, 0, AU.sfx, false); tone('sine', 2250, t, .002, .035, .04, 0, 0, AU.sfx, false); },
  chalk() { if (!AU.ctx) return; const t = AU.ctx.currentTime; noiseB(t, .12, 'bandpass', 3600, .8, .05, .02); },
  coin() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .01; [1047, 1319, 1568, 2093].forEach((f, i) => tone('sine', f, t + i * .06, .003, .1, .35)); },
  foul() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .01; tone('triangle', 233, t, .005, .14, .22); tone('triangle', 175, t + .13, .005, .14, .32); },
  good() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .01; tone('sine', 784, t, .004, .08, .25); tone('sine', 1175, t + .07, .004, .07, .35); },
  win() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .02; [349, 440, 523, 659, 784].forEach((f, i) => epNote(f, t + i * .07, .14, 1.8, AU.sfx)); },
  lose() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .02; [392, 349, 311, 262].forEach((f, i) => epNote(f, t + i * .16, .12, 1.2, AU.sfx)); },
  setRoll(v) { if (!AU.ctx) return; AU.roll.gain.setTargetAtTime(SET.low ? 0 : clamp(v, 0, .3), AU.ctx.currentTime, .06); }
};
// electric piano voice (2-op FM)
function epNote(f, t, vol, dur, bus) {
  const c = AU.ctx, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
  car.type = 'sine'; mod.type = 'sine'; car.frequency.value = f; mod.frequency.value = f;
  mg.gain.setValueAtTime(f * 1.6, t); mg.gain.exponentialRampToValueAtTime(f * .08, t + .35);
  mod.connect(mg); mg.connect(car.frequency); car.connect(g);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  route(g, 0, true, bus || AU.mus);
  car.start(t); mod.start(t); car.stop(t + dur + .05); mod.stop(t + dur + .05);
}
// ---------------------------------------------------------------- music: slow swing trio
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const Music = {
  on: false, step: 0, next: 0, bpm: 84, timer: 0,
  // eight bars: Fmaj7 D7 Gm7 C7 Am7 D7 Gm7-C7 Fmaj7
  bars: [[41, 'M'], [38, 'D'], [43, 'm'], [36, 'D'], [45, 'm'], [38, 'D'], [43, 'm', 36, 'D'], [41, 'M']],
  start() { if (this.on || !AU.ctx) return; this.on = true; this.next = AU.ctx.currentTime + .15; this.step = 0; this.timer = setInterval(() => this.tick(), 40); },
  chordAt(bar, beat) { const b = this.bars[bar % 8]; return (b.length > 2 && beat >= 2) ? [b[2], b[3]] : [b[0], b[1]]; },
  tick() {
    const c = AU.ctx; if (!c || c.state !== 'running') return;
    const beat = 60 / this.bpm;
    while (this.next < c.currentTime + .2) {
      this.play(this.step, this.next, beat);
      this.next += (this.step % 2 === 0 ? .64 : .36) * beat;
      this.step = (this.step + 1) % 64;
    }
  },
  play(s, t, beat) {
    const bar = s >> 3, e = s & 7, q = e >> 1, off = e & 1;
    const [root, kind] = this.chordAt(bar, q);
    const B = AU.mus;
    // walking bass on quarters
    if (!off) {
      let n;
      if (q === 0) n = root;
      else if (q === 1) n = root + (kind === 'm' ? 3 : 4) + (Math.random() < .4 ? 3 : 0);
      else if (q === 2) n = root + 7 + (Math.random() < .3 ? 2 : 0);
      else { const nx = this.chordAt(bar + 1, 0)[0]; n = nx + (Math.random() < .5 ? 1 : -1); }
      while (n > 50) n -= 12; while (n < 31) n += 12;
      const o = AU.ctx.createOscillator(), o2 = AU.ctx.createOscillator(), g = AU.ctx.createGain(), lp = AU.ctx.createBiquadFilter();
      o.type = 'triangle'; o2.type = 'sine'; o.frequency.value = mtof(n); o2.frequency.value = mtof(n) * .5;
      lp.type = 'lowpass'; lp.frequency.value = 650;
      o.connect(lp); o2.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3, t + .012); g.gain.exponentialRampToValueAtTime(.07, t + .3); g.gain.exponentialRampToValueAtTime(.0001, t + beat * .95);
      route(g, 0, false, B); o.start(t); o2.start(t); o.stop(t + beat); o2.stop(t + beat);
    }
    // ride: 1, 2, (and of 2), 3, 4, (and of 4)
    if (!off || q === 1 || q === 3) {
      const acc = !off && (q === 1 || q === 3);
      noiseB(t, off ? .1 : .22, 'highpass', 7200, .5, acc ? .05 : .035, .002, .25, B, true);
      tone('square', 5400 + Math.random() * 120, t, .001, .006, .12, .25, 0, B, false);
    }
    // hi-hat pedal + brush on 2 and 4
    if (!off && (q === 1 || q === 3)) {
      noiseB(t, .035, 'highpass', 8500, .7, .03, .001, -.2, B, false);
      noiseB(t, .2, 'bandpass', 1900, .6, .028, .025, -.1, B, true);
    }
    if (!off && (q === 0 || q === 2)) tone('sine', 85, t, .003, .07, .11, 0, 45, B, false);
    // comping: charleston (1 and the and of 2)
    if ((e === 0) || (e === 3 && Math.random() < .8) || (e === 6 && Math.random() < .25)) {
      const iv = kind === 'M' ? [4, 7, 11, 14] : kind === 'm' ? [3, 7, 10, 14] : [4, 9, 10, 14];
      let base = root + 12; while (base < 50) base += 12; while (base > 58) base -= 12;
      const vol = e === 0 ? .045 : .035;
      iv.forEach((i, k) => epNote(mtof(base + i), t + k * .008, vol, beat * (e === 0 ? 1.7 : 1.1), B));
    }
  }
};

// =====================================================================
//  TABLE GEOMETRY (meters) — 9 ft table
// =====================================================================
const W = 2.54, H = 1.27, HW = W / 2, HH = H / 2, R = 0.028575, D = 2 * R, D2 = D * D;
const CUSH = 0.046, CM = 0.083, SM = 0.064, FR = 0.17;
const G_ = 9.81, MU_S = 0.2, MU_R = 0.0115, E_B = 0.94, E_C = 0.75, SPIN_DEC = 1.15, ENG_K = 0.11;
const HSTEP = 1 / 720;
const SEGS = [];      // physics segments [ax, ay, bx, by]
const CUSHIONS = [];  // render polygons
(function buildGeom() {
  const jc = CUSH * .9;
  const longC = [[SM - .013, HH + CUSH], [SM, HH], [HW - CM, HH], [HW - CM + jc, HH + CUSH]];
  const shortC = [[HW + CUSH, HH - CM + jc], [HW, HH - CM], [HW, -(HH - CM)], [HW + CUSH, -(HH - CM) - jc]];
  const add = poly => { CUSHIONS.push(poly); for (let i = 0; i < 3; i++) SEGS.push([poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]]); };
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) add(longC.map(p => [p[0] * sx, p[1] * sy]));
  for (const sx of [1, -1]) add(shortC.map(p => [p[0] * sx, p[1]]));
})();
const POCKETS = [
  { x: HW + .012, y: HH + .012, r: .061, ax: HW - .016, ay: HH - .016, dx: .7071, dy: .7071 },
  { x: -HW - .012, y: HH + .012, r: .061, ax: -HW + .016, ay: HH - .016, dx: -.7071, dy: .7071 },
  { x: HW + .012, y: -HH - .012, r: .061, ax: HW - .016, ay: -HH + .016, dx: .7071, dy: -.7071 },
  { x: -HW - .012, y: -HH - .012, r: .061, ax: -HW + .016, ay: -HH + .016, dx: -.7071, dy: -.7071 },
  { x: 0, y: HH + .048, r: .057, ax: 0, ay: HH + .012, dx: 0, dy: 1, side: true },
  { x: 0, y: -HH - .048, r: .057, ax: 0, ay: -HH - .012, dx: 0, dy: -1, side: true }
];
const FOOT = { x: W / 4, y: 0 }, HEAD = { x: -W / 4, y: 0 };

// =====================================================================
//  PHYSICS
//  v = linear velocity, r = "roll velocity" (surface speed from spin about
//  horizontal axes; equals v when rolling), sp = side spin surface speed.
// =====================================================================
function integ(b, h) {
  let ux = b.vx - b.rx, uy = b.vy - b.ry;
  const u = Math.sqrt(ux * ux + uy * uy), dv = MU_S * G_ * h;
  if (u > 1e-7) {
    if (u <= 3.5 * dv) { b.vx -= ux * 2 / 7; b.vy -= uy * 2 / 7; b.rx = b.vx; b.ry = b.vy; }
    else { ux /= u; uy /= u; b.vx -= dv * ux; b.vy -= dv * uy; b.rx += 2.5 * dv * ux; b.ry += 2.5 * dv * uy; }
  } else {
    const v = Math.sqrt(b.vx * b.vx + b.vy * b.vy), dr = MU_R * G_ * h;
    if (v <= dr) { b.vx = b.vy = b.rx = b.ry = 0; }
    else { const f = 1 - dr / v; b.vx *= f; b.vy *= f; b.rx = b.vx; b.ry = b.vy; }
  }
  if (b.sp) { const ds = SPIN_DEC * h; b.sp = Math.abs(b.sp) <= ds ? 0 : b.sp - Math.sign(b.sp) * ds; }
  b.x += b.vx * h; b.y += b.vy * h;
  if (b.vx === 0 && b.vy === 0 && b.rx === 0 && b.ry === 0 && b.sp === 0) b.mv = false;
}
function stepPhys(bs, h, rec, snd) {
  const n = bs.length;
  for (let i = 0; i < n; i++) { const b = bs[i]; if (b.on && b.mv) integ(b, h); }
  for (let it = 0; it < 4; it++) {
  let hitAny = false;
  for (let i = 0; i < n; i++) {
    const a = bs[i]; if (!a.on) continue;
    for (let j = i + 1; j < n; j++) {
      const b = bs[j]; if (!b.on || (!a.mv && !b.mv)) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      if (dx > D || dx < -D || dy > D || dy < -D) continue;
      const d2 = dx * dx + dy * dy; if (d2 >= D2) continue;
      const d = Math.sqrt(d2) || 1e-9, nx = dx / d, ny = dy / d, ov = (D - d) * .5;
      a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      const rvn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rvn > 0) {
        const jj = rvn * (1 + E_B) * .5;
        a.vx -= jj * nx; a.vy -= jj * ny; b.vx += jj * nx; b.vy += jj * ny;
        // a touch of collision-induced throw from cut friction
        const tx = -ny, ty = nx, vt = (a.vx - b.vx) * tx + (a.vy - b.vy) * ty;
        const thr = clamp(vt * .015, -rvn * .03, rvn * .03);
        b.vx += tx * thr; b.vy += ty * thr;
        a.mv = b.mv = true; hitAny = true;
        if (rec) {
          if (rec.first < 0 && (a.id === 0 || b.id === 0)) rec.first = a.id === 0 ? b.id : a.id;
          rec.contacts++;
        }
        if (snd) snd.push(0, rvn, (a.x + b.x) * .5);
      }
    }
  }
  if (!hitAny) break;
  }
  for (let i = 0; i < n; i++) {
    const b = bs[i]; if (!b.on || !b.mv) continue;
    const ax = Math.abs(b.x), ay = Math.abs(b.y);
    if (ax > HW - R - .003 || ay > HH - R - .003) {
      for (let k = 0; k < SEGS.length; k++) {
        const s = SEGS[k], ex = s[2] - s[0], ey = s[3] - s[1];
        let t = ((b.x - s[0]) * ex + (b.y - s[1]) * ey) / (ex * ex + ey * ey); t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = s[0] + ex * t, qy = s[1] + ey * t, dx = b.x - qx, dy = b.y - qy, d2 = dx * dx + dy * dy;
        if (d2 >= R * R) continue;
        const d = Math.sqrt(d2) || 1e-9, nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
        b.x = qx + nx * R; b.y = qy + ny * R;
        if (vn >= 0) continue;
        const tx = -ny, ty = nx;
        let vt = (b.vx * tx + b.vy * ty) * .97 + ENG_K * b.sp;
        const vno = -vn * E_C;
        b.vx = nx * vno + tx * vt; b.vy = ny * vno + ty * vt;
        const rn = b.rx * nx + b.ry * ny, rt = b.rx * tx + b.ry * ty;
        b.rx = nx * (-rn * .3) + tx * rt; b.ry = ny * (-rn * .3) + ty * rt;
        b.sp *= .65;
        if (rec) { rec.rails++; if (rec.first >= 0) rec.railAfter = true; }
        if (snd) snd.push(1, -vn, b.x);
      }
      // pocketed?
      const ax2 = Math.abs(b.x), ay2 = Math.abs(b.y);
      let pk = -1;
      if (ay2 > HH + R * .6 || ax2 > HW + R * .6) pk = nearestPocket(b.x, b.y);
      else {
        for (let p = 0; p < 4; p++) { const P = POCKETS[p], dx = b.x - P.x, dy = b.y - P.y; if (dx * dx + dy * dy < (P.r - R * .45) * (P.r - R * .45)) { pk = p; break; } }
      }
      if (pk >= 0) {
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        b.on = false; b.mv = false; b.pk = pk;
        if (rec) { rec.potted.push(b.id); if (b.id === 0) rec.scratch = true; }
        if (snd) snd.push(2, sp, b.x, b.id, pk);
      }
    }
  }
}
function nearestPocket(x, y) { let best = 0, bd = 1e9; for (let p = 0; p < 6; p++) { const d = (x - POCKETS[p].x) ** 2 + (y - POCKETS[p].y) ** 2; if (d < bd) { bd = d; best = p; } } return best; }
// adaptive sub-stepping: no ball moves more than ~0.1 R per step
function advance(bs, T, rec, snd) {
  let t = 0, guard = 0;
  while (t < T - 1e-9 && guard++ < 4000) {
    let vm = 0;
    for (let i = 0; i < bs.length; i++) { const b = bs[i]; if (b.on && b.mv) { const v = b.vx * b.vx + b.vy * b.vy; if (v > vm) vm = v; } }
    if (vm === 0 && !anyMoving(bs)) return;
    vm = Math.sqrt(vm);
    const h = Math.min(HSTEP, T - t, vm > 0 ? R * .1 / vm : HSTEP);
    stepPhys(bs, Math.max(h, 1 / 6000), rec, snd); t += h;
  }
}
const anyMoving = bs => { for (let i = 0; i < bs.length; i++) if (bs[i].on && bs[i].mv) return true; return false; };
const newRec = () => ({ first: -1, rails: 0, railAfter: false, potted: [], scratch: false, contacts: 0 });
function strikeBall(b, ang, speed, sx, sy) {
  const c = Math.cos(ang), s = Math.sin(ang);
  b.vx = c * speed; b.vy = s * speed;
  const top = 1.25 * sy; b.rx = c * speed * top; b.ry = s * speed * top;
  b.sp = -1.25 * sx * speed; b.mv = true;
}

// ---------------------------------------------------------------- orientation (render only)
function rotM(M, ax, ay, az, ang) {
  const l = Math.sqrt(ax * ax + ay * ay + az * az); if (l < 1e-9 || !ang) return;
  ax /= l; ay /= l; az /= l;
  const c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  const r00 = t * ax * ax + c, r01 = t * ax * ay - s * az, r02 = t * ax * az + s * ay;
  const r10 = t * ax * ay + s * az, r11 = t * ay * ay + c, r12 = t * ay * az - s * ax;
  const r20 = t * ax * az - s * ay, r21 = t * ay * az + s * ax, r22 = t * az * az + c;
  for (let col = 0; col < 3; col++) {
    const m0 = M[col], m1 = M[3 + col], m2 = M[6 + col];
    M[col] = r00 * m0 + r01 * m1 + r02 * m2; M[3 + col] = r10 * m0 + r11 * m1 + r12 * m2; M[6 + col] = r20 * m0 + r21 * m1 + r22 * m2;
  }
}
function orthoM(M) {
  let x0 = M[0], x1 = M[3], x2 = M[6]; let l = Math.hypot(x0, x1, x2); x0 /= l; x1 /= l; x2 /= l;
  let y0 = M[1], y1 = M[4], y2 = M[7]; const dp = x0 * y0 + x1 * y1 + x2 * y2; y0 -= dp * x0; y1 -= dp * x1; y2 -= dp * x2; l = Math.hypot(y0, y1, y2); y0 /= l; y1 /= l; y2 /= l;
  M[0] = x0; M[3] = x1; M[6] = x2; M[1] = y0; M[4] = y1; M[7] = y2;
  M[2] = x1 * y2 - x2 * y1; M[5] = x2 * y0 - x0 * y2; M[8] = x0 * y1 - x1 * y0;
}
function mkBall(id, x, y) {
  const M = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  rotM(M, rand(-1, 1), rand(-1, 1), rand(-1, 1), rand(0, TAU));
  return { id, x, y, vx: 0, vy: 0, rx: 0, ry: 0, sp: 0, on: true, mv: false, M, pk: -1, sink: 0, sinkX: 0, sinkY: 0, cv: null, dirty: true, oc: 0 };
}

// ---------------------------------------------------------------- racks
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function rack(type) {
  const bs = [mkBall(0, HEAD.x, 0)];
  const dx = D * Math.cos(Math.PI / 6) * 1.0015, dy = D * 1.0015;
  const place = (rows, ids) => {
    let k = 0;
    rows.forEach((cnt, i) => { for (let j = 0; j < cnt; j++) { const id = ids[k++]; bs.push(mkBall(id, FOOT.x + i * dx + rand(-.0002, .0002), (j - (cnt - 1) / 2) * dy + rand(-.0002, .0002))); } });
  };
  if (type === '9') {
    const mid = shuffle([2, 3, 4, 5, 6, 7, 8]);
    const ids = [1, mid[0], mid[1], mid[2], 9, mid[3], mid[4], mid[5], mid[6]];
    place([1, 2, 3, 2, 1], ids);
  } else {
    const solids = shuffle([1, 2, 3, 4, 5, 6, 7]), stripes = shuffle([9, 10, 11, 12, 13, 14, 15]);
    const ids = new Array(15).fill(0);
    ids[4] = 8;                                   // center of row 3
    const flip = Math.random() < .5;
    ids[10] = flip ? solids.pop() : stripes.pop(); // back corners: one of each
    ids[14] = flip ? stripes.pop() : solids.pop();
    const rest = shuffle(solids.concat(stripes));
    for (let i = 0; i < 15; i++) if (!ids[i]) ids[i] = rest.pop();
    place([1, 2, 3, 4, 5], ids);
  }
  return bs;
}

// =====================================================================
//  RULES
// =====================================================================
const groupOf = id => id >= 1 && id <= 7 ? 'solid' : id >= 9 && id <= 15 ? 'stripe' : null;
function judge8(P, rec, st) {
  const pn = rec.potted.filter(i => i !== 0), g = st.groups[P];
  let foul = false, reason = '';
  if (rec.scratch) { foul = true; reason = 'Scratch'; }
  else if (rec.first < 0) { foul = true; reason = 'No ball hit'; }
  else if (g) {
    if (st.cleared) { if (rec.first !== 8) { foul = true; reason = 'You have to hit the 8 first'; } }
    else if (groupOf(rec.first) !== g) { foul = true; reason = rec.first === 8 ? 'Hit the 8 first' : 'Wrong ball first'; }
  } else if (rec.first === 8 && !st.brk) { foul = true; reason = 'Hit the 8 first'; }
  if (!foul && !st.brk && pn.length === 0 && !rec.railAfter) { foul = true; reason = 'No cushion after contact'; }
  const eight = pn.includes(8);
  if (eight && st.brk) return { foul, reason, respot8: true, cont: !foul && pn.length > 1, assign: null };
  if (eight) {
    if (!foul && st.cleared) return { win: true };
    return { lose: true, reason: foul ? reason + ' on the 8' : 'The 8 went down early' };
  }
  let assign = null;
  if (!foul && !g && !st.brk && pn.length) assign = groupOf(pn[0]);
  const myG = g || assign;
  const cont = !foul && (st.brk ? pn.length > 0 : myG ? pn.some(i => groupOf(i) === myG) : pn.length > 0);
  return { foul, reason, assign, cont };
}
function judge9(P, rec, st) {
  const pn = rec.potted.filter(i => i !== 0);
  let foul = false, reason = '';
  if (rec.scratch) { foul = true; reason = 'Scratch'; }
  else if (rec.first < 0) { foul = true; reason = 'No ball hit'; }
  else if (rec.first !== st.lowest) { foul = true; reason = 'You have to hit the ' + st.lowest + ' first'; }
  if (!foul && !st.brk && pn.length === 0 && !rec.railAfter) { foul = true; reason = 'No cushion after contact'; }
  if (pn.includes(9)) { if (!foul) return { win: true }; return { foul, reason, respot9: true, cont: false }; }
  return { foul, reason, cont: !foul && pn.length > 0 };
}

// =====================================================================
//  GAME STATE
// =====================================================================
const G = {
  mode: 'demo', rules: '8', players: [], turn: 0, groups: [null, null], frames: [0, 0], raceTo: 2, breaker: 0, frameNo: 1,
  balls: [], byId: {}, state: 'idle', inHand: false, kitchen: false, brk: true,
  aim: 0, power: 0, spinX: 0, spinY: 0, pull: 0, cueAlpha: 0, strikeT: 0,
  rec: null, shotSt: null, run: 0, stats: null, paused: false, hitStop: 0, shake: 0,
  speedT: 0, speedPen: 0, speedOn: false, cfg: null, wait: 0, waitFn: null, ai: null, aiPlan: null, aiT: 0, aiFrom: 0,
  placeFrom: null, placeTo: null, shots: 0, lastStrike: 0
};
const cueBall = () => G.byId[0];
function setBalls(bs) { G.balls = bs; G.byId = {}; bs.forEach(b => { G.byId[b.id] = b; }); }
const onBalls = () => G.balls.filter(b => b.on && b.id !== 0);
const lowestOn = () => { let m = 99; G.balls.forEach(b => { if (b.on && b.id > 0 && b.id < m) m = b.id; }); return m; };
const groupLeft = g => G.balls.filter(b => b.on && groupOf(b.id) === g).length;
function curCue(P) { const pl = G.players[P]; return pl && pl.ai >= 0 ? (pl.ai > .8 ? CUES.birds : CUES.maple) : CUES[SAVE.cue]; }
const maxSpeed = P => 6.2 * curCue(P).power;
const powerToSpeed = (p, P) => maxSpeed(P) * Math.pow(clamp(p, 0, 1), 1.6) * (G.brk ? 1.38 : 1);
const isAI = P => G.players[P] && G.players[P].ai >= 0;

function shotState(P) {
  const g = G.groups[P];
  return { groups: G.groups.slice(), brk: G.brk, cleared: g ? groupLeft(g) === 0 : false, lowest: lowestOn() };
}
function legalTargets(P, bs) {
  bs = bs || G.balls;
  const on = bs.filter(b => b.on && b.id !== 0).map(b => b.id);
  if (G.rules === '9') { let m = 99; on.forEach(i => { if (i < m) m = i; }); return m < 99 ? [m] : []; }
  if (G.rules !== '8') return on;
  const g = G.groups[P];
  if (!g) return on.filter(i => i !== 8);
  const mine = on.filter(i => groupOf(i) === g);
  return mine.length ? mine : on.filter(i => i === 8);
}

// =====================================================================
//  AI
// =====================================================================
function clearPath(bs, x0, y0, x1, y1, ex1, ex2) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
  for (let i = 0; i < bs.length; i++) {
    const b = bs[i]; if (!b.on || b.id === ex1 || b.id === ex2) continue;
    let t = ((b.x - x0) * dx + (b.y - y0) * dy) / L2; if (t < 0 || t > 1) { if (t < 0) t = 0; else t = 1; }
    const qx = x0 + dx * t - b.x, qy = y0 + dy * t - b.y;
    if (qx * qx + qy * qy < (D * .985) ** 2) return false;
  }
  return true;
}
const inTable = (x, y, m = 0) => Math.abs(x) < HW - R - m && Math.abs(y) < HH - R - m;
function genCands(bs, cue, targets, combos) {
  const out = [];
  const tryDirect = (t, p) => {
    const P = POCKETS[p]; let dx = P.ax - t.x, dy = P.ay - t.y; const d2 = Math.hypot(dx, dy); if (d2 < .001) return; dx /= d2; dy /= d2;
    if (P.side) { if (Math.abs(dy) < .42 || dy * P.dy < 0) return; } else if (dx * P.dx + dy * P.dy < .52) return;
    const gx = t.x - dx * D, gy = t.y - dy * D; if (!inTable(gx, gy, -.002)) return;
    let cx = gx - cue.x, cy = gy - cue.y; const d1 = Math.hypot(cx, cy); if (d1 < .001) return; cx /= d1; cy /= d1;
    const cs = cx * dx + cy * dy; if (cs < .2) return;
    if (!clearPath(bs, cue.x, cue.y, gx, gy, 0, t.id)) return;
    if (!clearPath(bs, t.x, t.y, P.ax, P.ay, t.id, 0)) return;
    const diff = d1 * .55 + d2 + (1 / cs - 1) * 1.6 + (P.side ? .25 : 0);
    out.push({ t: t.id, p, ang: Math.atan2(cy, cx), cut: cs, d1, d2, diff });
  };
  for (const id of targets) { const t = bs.find(b => b.id === id && b.on); if (!t) continue; for (let p = 0; p < 6; p++) tryDirect(t, p); }
  if (combos) {
    const L = bs.find(b => b.id === targets[0] && b.on);
    if (L) for (const X of bs) {
      if (!X.on || X.id === 0 || X.id === L.id) continue;
      for (let p = 0; p < 6; p++) {
        const P = POCKETS[p]; let dx = P.ax - X.x, dy = P.ay - X.y; const d3 = Math.hypot(dx, dy); dx /= d3; dy /= d3;
        if (P.side ? Math.abs(dy) < .45 : dx * P.dx + dy * P.dy < .55) continue;
        const gx = X.x - dx * D, gy = X.y - dy * D;
        let lx = gx - L.x, ly = gy - L.y; const d2 = Math.hypot(lx, ly); if (d2 < .001) continue; lx /= d2; ly /= d2;
        const cs2 = lx * dx + ly * dy; if (cs2 < .75) continue;
        const hx = L.x - lx * D, hy = L.y - ly * D;
        let cx = hx - cue.x, cy = hy - cue.y; const d1 = Math.hypot(cx, cy); cx /= d1; cy /= d1;
        const cs1 = cx * lx + cy * ly; if (cs1 < .5) continue;
        if (!clearPath(bs, cue.x, cue.y, hx, hy, 0, L.id) || !clearPath(bs, L.x, L.y, gx, gy, L.id, X.id) || !clearPath(bs, X.x, X.y, P.ax, P.ay, X.id, 0)) continue;
        const diff = d1 * .55 + d2 + d3 + (1 / cs1 - 1) * 1.6 + (1 / cs2 - 1) * 2.5 + 1 + (X.id === 9 ? -.6 : 0);
        out.push({ t: L.id, p, ang: Math.atan2(cy, cx), cut: cs1, d1, d2: d2 + d3, diff, combo: X.id });
      }
    }
  }
  return out;
}
function simShot(src, place, ang, speed, sx, sy, rec) {
  const bs = src.map(b => ({ id: b.id, x: b.x, y: b.y, vx: 0, vy: 0, rx: 0, ry: 0, sp: 0, on: b.on, mv: false, pk: -1 }));
  const cb = bs.find(b => b.id === 0);
  if (place) { cb.x = place.x; cb.y = place.y; cb.on = true; }
  strikeBall(cb, ang, speed, sx, sy);
  let t = 0;
  while (t < 16 && anyMoving(bs)) { advance(bs, .05, rec, null); t += .05; }
  return bs;
}
function bestEase(bs, P, groupsOverride) {
  const cue = bs.find(b => b.id === 0); if (!cue || !cue.on) return 0;
  let tg;
  const on = bs.filter(b => b.on && b.id !== 0).map(b => b.id);
  if (G.rules === '9') { let m = 99; on.forEach(i => { if (i < m) m = i; }); tg = m < 99 ? [m] : []; }
  else { const g = (groupsOverride || G.groups)[P]; if (!g) tg = on.filter(i => i !== 8); else { const mine = on.filter(i => groupOf(i) === g); tg = mine.length ? mine : on.filter(i => i === 8); } }
  const c = genCands(bs, cue, tg, false);
  let best = 99; c.forEach(k => { if (k.diff < best) best = k.diff; });
  return best < 99 ? 1 / (1 + best) : 0;
}
function* aiThink(P, skill, out) {
  const src = G.balls, cue0 = cueBall();
  const st = shotState(P);
  const targets = legalTargets(P);
  const judge = G.rules === '9' ? judge9 : judge8;
  let place = null;
  // ---- break
  if (G.brk) {
    if (G.inHand) place = { x: HEAD.x - rand(0, .05), y: rand(-.18, .18) };
    const cx = place ? place.x : cue0.x, cy = place ? place.y : cue0.y;
    const apex = src.filter(b => b.on && b.id !== 0).sort((a, b) => a.x - b.x)[0];
    const ang = Math.atan2(apex.y - cy + rand(-.004, .004), apex.x - cx);
    out.plan = { place, ang, speed: maxSpeed(P) * 1.38 * (.86 + skill * .14), sx: 0, sy: .1 + skill * .1 };
    return;
  }
  // ---- ball in hand: choose a spot
  if (G.inHand) {
    let best = null;
    for (const id of targets) {
      const t = src.find(b => b.id === id); if (!t || !t.on) continue;
      for (let p = 0; p < 6; p++) {
        const PK = POCKETS[p]; let dx = PK.ax - t.x, dy = PK.ay - t.y; const d = Math.hypot(dx, dy); dx /= d; dy /= d;
        if (PK.side ? Math.abs(dy) < .5 : dx * PK.dx + dy * PK.dy < .6) continue;
        for (const back of [.2, .32, .45]) {
          const px = t.x - dx * (D + back) + rand(-.01, .01), py = t.y - dy * (D + back) + rand(-.01, .01);
          if (!inTable(px, py, .01)) continue;
          if (G.kitchen && px > HEAD.x) continue;
          if (src.some(b => b.on && b.id !== 0 && Math.hypot(b.x - px, b.y - py) < D * 1.3)) continue;
          if (!clearPath(src, t.x, t.y, PK.ax, PK.ay, t.id, 0)) continue;
          if (!clearPath(src, px, py, t.x - dx * D, t.y - dy * D, 0, t.id)) continue;
          const sc = d + back * .5 + rand(0, .15);
          if (!best || sc < best.sc) best = { sc, x: px, y: py };
        }
      }
    }
    if (!best) {
      for (let k = 0; k < 60 && !best; k++) {
        const px = rand(-HW + .1, G.kitchen ? HEAD.x : HW - .1), py = rand(-HH + .1, HH - .1);
        if (!src.some(b => b.on && b.id !== 0 && Math.hypot(b.x - px, b.y - py) < D * 1.4)) best = { x: px, y: py };
      }
    }
    place = best ? { x: best.x, y: best.y } : { x: HEAD.x, y: 0 };
    yield;
  }
  const cue = place || { x: cue0.x, y: cue0.y };
  const bsCue = src.map(b => (b.id === 0 ? Object.assign({}, b, { x: cue.x, y: cue.y, on: true }) : b));
  let cands = genCands(bsCue, cue, targets, G.rules === '9' && skill > .5);
  cands.sort((a, b) => a.diff - b.diff);
  cands = cands.slice(0, 2 + Math.round(skill * 6));
  const sa = lerp(1.9, .07, Math.pow(skill, .8)) * Math.PI / 180;
  const evalShot = (ang, v, sx, sy, safe) => {
    const rec = newRec(), res = simShot(src, place, ang, v, sx, sy, rec), j = judge(P, rec, st);
    if (j.win) return 10000;
    if (j.lose) return -10000;
    if (j.foul) return -600;
    if (j.cont) {
      const gr = G.groups.slice(); if (j.assign) { gr[P] = j.assign; gr[1 - P] = j.assign === 'solid' ? 'stripe' : 'solid'; }
      return 300 + rec.potted.length * 10 + bestEase(res, P, gr) * 400 * skill - Math.abs(sy) * 5;
    }
    return safe ? (skill >= .45 ? 120 - bestEase(res, 1 - P) * 260 : -60) : -50 - bestEase(res, 1 - P) * 200;
  };
  const opts = [];
  const spins = skill < .45 ? [0] : skill < .8 ? [0, .55, -.55] : [0, .6, -.65, .3];
  outer: for (const c of cands) {
    const need = Math.sqrt(2 * MU_R * G_ * (c.d2 + .15)) + .35;
    const vc = need / Math.max(.25, c.cut) / .95;
    const base = clamp(Math.sqrt(vc * vc + 2 * .14 * c.d1) * 1.12 + .1, .5, maxSpeed(P));
    const speeds = skill < .4 ? [base * 1.35] : [base * 1.1, base * 1.55, base * 2.2];
    for (const v0 of speeds) for (const sy of spins) {
      const v = Math.min(v0, maxSpeed(P));
      const sc = evalShot(c.ang, v, 0, sy, false);
      opts.push({ sc, ang: c.ang, speed: v, sy, sx: 0 });
      yield;
      if (sc >= 10000 || (skill < .35 && sc > 250)) break outer;
    }
  }
  if (!opts.length || Math.max(...opts.map(o => o.sc)) < 200) {
    const tries = skill >= .45 ? 14 : 4;
    for (let k = 0; k < tries; k++) {
      const id = targets[Math.floor(Math.random() * targets.length)]; const t = src.find(b => b.id === id); if (!t) continue;
      const base = Math.atan2(t.y - cue.y, t.x - cue.x), dist = Math.hypot(t.x - cue.x, t.y - cue.y);
      const ang = base + Math.asin(clamp(rand(-.85, .85) * D / Math.max(dist, D), -1, 1)), v = rand(.9, 2.2) + dist * .6;
      opts.push({ sc: evalShot(ang, v, 0, 0, true), ang, speed: v, sy: 0, sx: 0, safe: true });
      yield;
    }
  }
  opts.sort((a, b) => b.sc - a.sc);
  let best = opts[0];
  // a good player checks that the shot still works if the stroke is slightly off
  if (skill >= .35 && opts.length && best.sc < 10000) {
    const top = opts.slice(0, skill > .75 ? 5 : 3).filter(o => o.sc > -100);
    for (const o of top) {
      const e = Math.max(sa * 1.4, .0015);
      o.rb = (o.sc + evalShot(o.ang + e, o.speed, 0, o.sy, o.safe) + evalShot(o.ang - e, o.speed, 0, o.sy, o.safe)) / 3;
      yield;
    }
    if (top.length) best = top.sort((a, b) => b.rb - a.rb)[0];
  }
  if (!best) { const t = src.find(b => b.id === targets[0]) || src.find(b => b.on && b.id); best = { ang: Math.atan2(t.y - cue.y, t.x - cue.x), speed: 2, sy: 0, sx: 0 }; }
  // human-like error
  best.ang += gauss() * sa;
  best.speed *= 1 + gauss() * lerp(.12, .025, skill);
  out.plan = { place, ang: best.ang, speed: clamp(best.speed, .3, maxSpeed(P) * 1.38), sx: best.sx, sy: best.sy };
}

// =====================================================================
//  VIEW & RENDERING
// =====================================================================
const cv = $('cv'), ctx = cv.getContext('2d');
const tableCv = document.createElement('canvas');
let VW = 0, VH = 0, DPR = 1;
const view = { s: 300, cx: 0, cy: 0, rot: 0 };
let tableDirty = true, shx = 0, shy = 0;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, SET.low ? 1 : 2);
  VW = window.innerWidth; VH = window.innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  const portrait = VH > VW * 1.1;
  view.rot = portrait ? 1 : 0;
  const fw = W + 2 * FR, fh = H + 2 * FR;
  const inMenu = document.body.classList.contains('inmenu');
  const padX = portrait ? 16 : (VW < 900 ? 70 : 120), padTop = portrait ? 80 : 74, padBot = portrait ? 120 : 30;
  const aw = VW - padX * 2, ah = VH - padTop - padBot;
  view.s = portrait ? Math.min(aw / fh, ah / fw) : Math.min(aw / fw, ah / fh);
  view.cx = VW / 2; view.cy = padTop + ah / 2;
  if (inMenu && !portrait && VW > 900) { view.s = Math.min((VW * .62) / fw, (VH - 60) / fh); view.cx = VW * .6; view.cy = VH / 2; }
  tableDirty = true;
  G.balls.forEach(b => { b.dirty = true; });
}
window.addEventListener('resize', resize);
const s2w = (sx, sy) => { const dx = sx - view.cx, dy = sy - view.cy; return view.rot ? [dy / view.s, -dx / view.s] : [dx / view.s, dy / view.s]; };
const w2s = (x, y) => view.rot ? [view.cx - y * view.s, view.cy + x * view.s] : [view.cx + x * view.s, view.cy + y * view.s];
function setWorld(t, ox = 0, oy = 0) {
  const s = view.s * DPR, ex = (view.cx + ox) * DPR, ey = (view.cy + oy) * DPR;
  if (view.rot) t.setTransform(0, s, -s, 0, ex, ey); else t.setTransform(s, 0, 0, s, ex, ey);
}
const shade = (hex, k) => { const c = hex2rgb(hex); return 'rgb(' + c.map(v => clamp(Math.round(v * k), 0, 255)).join(',') + ')'; };

// ---------- textures
function mkWood() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 140; const t = c.getContext('2d');
  const g = t.createLinearGradient(0, 0, 0, 140); g.addColorStop(0, '#4a2b17'); g.addColorStop(.5, '#3b2112'); g.addColorStop(1, '#2c180c');
  t.fillStyle = g; t.fillRect(0, 0, 900, 140);
  for (let i = 0; i < 160; i++) {
    const y0 = Math.random() * 140, amp = rand(1, 6), fr = rand(.004, .02), ph = rand(0, TAU);
    t.strokeStyle = Math.random() < .6 ? `rgba(20,9,3,${rand(.12, .35)})` : `rgba(150,92,50,${rand(.06, .16)})`;
    t.lineWidth = rand(.6, 2.4); t.beginPath();
    for (let x = 0; x <= 900; x += 12) { const y = y0 + Math.sin(x * fr + ph) * amp + Math.sin(x * fr * 3.1 + ph * 2) * amp * .3; x ? t.lineTo(x, y) : t.moveTo(x, y); }
    t.stroke();
  }
  for (let i = 0; i < 7; i++) { // knots
    const x = rand(0, 900), y = rand(10, 130), r = rand(4, 12);
    const kg = t.createRadialGradient(x, y, 0, x, y, r * 2); kg.addColorStop(0, 'rgba(15,6,2,.5)'); kg.addColorStop(1, 'rgba(15,6,2,0)');
    t.fillStyle = kg; t.beginPath(); t.ellipse(x, y, r * 2.6, r, 0, 0, TAU); t.fill();
  }
  return c;
}
function mkFelt(hex) {
  const c = document.createElement('canvas'); c.width = c.height = 192; const t = c.getContext('2d');
  const im = t.createImageData(192, 192), d = im.data, [r, g, b] = hex2rgb(hex);
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 14 + (Math.random() < .02 ? 10 : 0); d[i] = r + n; d[i + 1] = g + n; d[i + 2] = b + n; d[i + 3] = 255; }
  t.putImageData(im, 0, 0); return c;
}
let woodTex = null;
function pat(t, img, scale, rot) {
  const p = t.createPattern(img, 'repeat');
  try { let m = new DOMMatrix(); if (rot) m = m.rotate(rot); m = m.scale(scale); p.setTransform(m); } catch (e) { /* older browsers: unscaled pattern */ }
  return p;
}
function buildTable() {
  tableDirty = false;
  tableCv.width = cv.width; tableCv.height = cv.height;
  const t = tableCv.getContext('2d'), cw = tableCv.width, ch = tableCv.height;
  const felt = CLOTHS[SAVE.cloth].c;
  if (!woodTex) woodTex = mkWood();
  const feltTex = mkFelt(felt);
  t.setTransform(1, 0, 0, 1, 0, 0);
  t.fillStyle = '#0a0705'; t.fillRect(0, 0, cw, ch);
  // floorboards
  t.globalAlpha = .55;
  const pw = 60 * DPR;
  for (let x = -pw; x < cw + pw; x += pw) { t.fillStyle = `rgb(${18 + Math.random() * 8},${12 + Math.random() * 5},${8 + Math.random() * 3})`; t.fillRect(x, 0, pw - 1.5 * DPR, ch); }
  t.globalAlpha = 1;
  const cx = view.cx * DPR, cy = view.cy * DPR, big = Math.max(cw, ch);
  const lg = t.createRadialGradient(cx, cy, 0, cx, cy, big * .75);
  lg.addColorStop(0, 'rgba(255,210,140,.16)'); lg.addColorStop(.45, 'rgba(90,55,25,.06)'); lg.addColorStop(1, 'rgba(0,0,0,.6)');
  t.fillStyle = lg; t.fillRect(0, 0, cw, ch);
  setWorld(t);
  // table drop shadow
  t.save(); t.shadowColor = 'rgba(0,0,0,.85)'; t.shadowBlur = 70 * DPR; t.shadowOffsetY = 14 * DPR;
  t.fillStyle = '#000'; t.beginPath(); t.roundRect ? t.roundRect(-HW - FR, -HH - FR, W + 2 * FR, H + 2 * FR, .07) : t.rect(-HW - FR, -HH - FR, W + 2 * FR, H + 2 * FR); t.fill(); t.restore();
  // wooden rails
  t.save(); t.beginPath(); t.roundRect ? t.roundRect(-HW - FR, -HH - FR, W + 2 * FR, H + 2 * FR, .07) : t.rect(-HW - FR, -HH - FR, W + 2 * FR, H + 2 * FR); t.clip();
  const ox = HW + FR, oy = HH + FR, ix = HW + CUSH, iy = HH + CUSH;
  const rails = [
    [[-ox, -oy], [ox, -oy], [ix, -iy], [-ix, -iy], 0], [[-ox, oy], [ox, oy], [ix, iy], [-ix, iy], 0],
    [[-ox, -oy], [-ix, -iy], [-ix, iy], [-ox, oy], 90], [[ox, -oy], [ix, -iy], [ix, iy], [ox, oy], 90]
  ];
  rails.forEach(r => { t.beginPath(); for (let i = 0; i < 4; i++) i ? t.lineTo(r[i][0], r[i][1]) : t.moveTo(r[i][0], r[i][1]); t.closePath(); t.fillStyle = pat(t, woodTex, .0016, r[4]); t.fill(); });
  // varnish light & bevels
  const vg = t.createRadialGradient(0, 0, .2, 0, 0, 1.7); vg.addColorStop(0, 'rgba(255,215,160,.2)'); vg.addColorStop(1, 'rgba(0,0,0,.42)');
  t.fillStyle = vg; t.fillRect(-ox, -oy, ox * 2, oy * 2);
  t.lineWidth = .006; t.strokeStyle = 'rgba(255,220,170,.18)'; t.strokeRect(-ox + .012, -oy + .012, ox * 2 - .024, oy * 2 - .024);
  t.restore();
  t.lineWidth = .004; t.strokeStyle = 'rgba(0,0,0,.6)'; t.strokeRect(-ix, -iy, ix * 2, iy * 2);
  // diamonds
  t.fillStyle = '#efe7d2';
  const dm = (x, y, horiz) => { t.save(); t.translate(x, y); if (!horiz) t.rotate(Math.PI / 2); t.beginPath(); t.moveTo(-.011, 0); t.lineTo(0, -.0055); t.lineTo(.011, 0); t.lineTo(0, .0055); t.closePath(); t.fill(); t.restore(); };
  const ry = HH + CUSH + (FR - CUSH) * .5, rx = HW + CUSH + (FR - CUSH) * .5;
  for (const k of [1, 2, 3, 5, 6, 7]) { const x = -HW + k * W / 8; dm(x, -ry, true); dm(x, ry, true); }
  for (const k of [1, 2, 3]) { const y = -HH + k * H / 4; dm(-rx, y, false); dm(rx, y, false); }
  // bed + playing surface
  t.fillStyle = shade(felt, .55); t.fillRect(-ix, -iy, ix * 2, iy * 2);
  t.fillStyle = pat(t, feltTex, .0011); t.fillRect(-HW, -HH, W, H);
  const fg = t.createRadialGradient(0, 0, .05, 0, 0, 1.45); fg.addColorStop(0, 'rgba(255,240,205,.13)'); fg.addColorStop(.6, 'rgba(0,0,0,.05)'); fg.addColorStop(1, 'rgba(0,0,0,.38)');
  t.fillStyle = fg; t.fillRect(-ix, -iy, ix * 2, iy * 2);
  // pockets
  POCKETS.forEach(P => {
    const g1 = t.createRadialGradient(P.x, P.y, P.r * .2, P.x, P.y, P.r * 1.18);
    g1.addColorStop(0, '#000'); g1.addColorStop(.72, '#060403'); g1.addColorStop(.86, '#2a1a0e'); g1.addColorStop(1, 'rgba(60,40,22,0)');
    t.fillStyle = g1; t.beginPath(); t.arc(P.x, P.y, P.r * 1.18, 0, TAU); t.fill();
    t.strokeStyle = 'rgba(120,85,50,.35)'; t.lineWidth = .003; t.beginPath(); t.arc(P.x, P.y, P.r * .98, 0, TAU); t.stroke();
  });
  // cushions
  CUSHIONS.forEach(poly => {
    t.beginPath(); poly.forEach((p, i) => i ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1]));
    // close along the rail line, outside
    const a = poly[0], b = poly[3];
    t.lineTo(b[0], b[1]); t.lineTo(a[0], a[1]); t.closePath();
    t.fillStyle = shade(felt, .8); t.fill();
    // nose highlight
    t.strokeStyle = shade(felt, 1.25); t.lineWidth = .0035; t.beginPath(); t.moveTo(poly[1][0], poly[1][1]); t.lineTo(poly[2][0], poly[2][1]); t.stroke();
    t.strokeStyle = 'rgba(0,0,0,.35)'; t.lineWidth = .002; t.beginPath(); t.moveTo(poly[0][0], poly[0][1]); t.lineTo(poly[1][0], poly[1][1]); t.moveTo(poly[2][0], poly[2][1]); t.lineTo(poly[3][0], poly[3][1]); t.stroke();
  });
  // cushion shadows on the cloth
  const shadowStrip = (x, y, w, h, gx0, gy0, gx1, gy1) => { const g = t.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(1, 'rgba(0,0,0,0)'); t.fillStyle = g; t.fillRect(x, y, w, h); };
  shadowStrip(-HW + CM, -HH, W - 2 * CM, .03, 0, -HH, 0, -HH + .03);
  shadowStrip(-HW + CM, HH - .03, W - 2 * CM, .03, 0, HH, 0, HH - .03);
  shadowStrip(-HW, -HH + CM, .03, H - 2 * CM, -HW, 0, -HW + .03, 0);
  shadowStrip(HW - .03, -HH + CM, .03, H - 2 * CM, HW, 0, HW - .03, 0);
  // markings
  t.strokeStyle = 'rgba(255,255,255,.07)'; t.lineWidth = .002; t.beginPath(); t.moveTo(HEAD.x, -HH); t.lineTo(HEAD.x, HH); t.stroke();
  t.fillStyle = 'rgba(255,255,255,.3)';
  [HEAD, FOOT, { x: 0, y: 0 }].forEach(p => { t.beginPath(); t.arc(p.x, p.y, .0035, 0, TAU); t.fill(); });
}

// ---------- ball sprites (per-pixel shaded, rotates with the ball)
function ballSprite(b, rp) {
  const size = Math.ceil(rp * 2 + 3);
  if (!b.cv || b.cv.width !== size) { b.cv = document.createElement('canvas'); b.cv.width = b.cv.height = size; b.cx = b.cv.getContext('2d'); b.img = b.cx.createImageData(size, size); }
  const d = b.img.data, M = b.M, c = size / 2, id = b.id, col = BALL_RGB[id], stripe = id >= 9, felt = hex2rgb(CLOTHS[SAVE.cloth].c);
  // light from the lamp over the table centre
  let lwx = -b.x * .9, lwy = -b.y * .9, lwz = -1.0; const ll = Math.hypot(lwx, lwy, lwz); lwx /= ll; lwy /= ll; lwz /= ll;
  let Lx = lwx, Ly = lwy; if (view.rot) { Lx = -lwy; Ly = lwx; }
  const Lz = lwz; let hx = Lx, hy = Ly, hz = Lz - 1; const hl = Math.hypot(hx, hy, hz); hx /= hl; hy /= hl; hz /= hl;
  const inv = 1 / rp;
  for (let j = 0; j < size; j++) {
    const py = (j + .5 - c) * inv;
    for (let i = 0; i < size; i++) {
      const px = (i + .5 - c) * inv, r2 = px * px + py * py, k = (j * size + i) * 4;
      if (r2 > 1 + 2.2 * inv) { d[k + 3] = 0; continue; }
      const rr = r2 < .9995 ? r2 : .9995, nz = -Math.sqrt(1 - rr);
      let wx = px, wy = py; if (view.rot) { wx = py; wy = -px; }
      const lx = M[0] * wx + M[3] * wy + M[6] * nz, lz = M[2] * wx + M[5] * wy + M[8] * nz;
      let r, g, bb;
      if (id === 0) { r = 244; g = 240; bb = 228; }
      else if (lx > .9 || lx < -.9) { r = 246; g = 241; bb = 228; }
      else if (stripe && (lz > .55 || lz < -.55)) { r = 244; g = 239; bb = 226; }
      else { r = col[0]; g = col[1]; bb = col[2]; }
      const dif = Math.max(0, px * Lx + py * Ly + nz * Lz);
      const spc = Math.pow(Math.max(0, px * hx + py * hy + nz * hz), 60) * 1.15;
      const sh = .2 + .9 * dif;
      const rim = Math.pow(1 + nz, 3) * .3;
      r = r * sh * (1 - rim) + felt[0] * rim + spc * 255; g = g * sh * (1 - rim) + felt[1] * rim + spc * 250; bb = bb * sh * (1 - rim) + felt[2] * rim + spc * 235;
      d[k] = r > 255 ? 255 : r; d[k + 1] = g > 255 ? 255 : g; d[k + 2] = bb > 255 ? 255 : bb;
      const a = (1 - Math.sqrt(r2)) * rp + .5; d[k + 3] = a >= 1 ? 255 : a <= 0 ? 0 : a * 255;
    }
  }
  b.cx.putImageData(b.img, 0, 0);
  if (id > 0 && rp > 6) {
    const t = b.cx;
    for (const sgn of [1, -1]) {
      const nwx = M[0] * sgn, nwy = M[3] * sgn, nwz = M[6] * sgn;
      if (nwz > -.25) continue;
      const rwx = M[1] * sgn, rwy = M[4] * sgn, dwx = -M[2], dwy = -M[5];
      let sx = nwx, sy = nwy, rx = rwx, ry = rwy, dx = dwx, dy = dwy;
      if (view.rot) { sx = -nwy; sy = nwx; rx = -rwy; ry = rwx; dx = -dwy; dy = dwx; }
      const k = rp * .043;
      t.save(); t.globalAlpha = clamp((-nwz - .25) * 2.2, 0, 1);
      t.setTransform(rx * k, ry * k, dx * k, dy * k, c + sx * rp, c + sy * rp);
      t.fillStyle = '#161210'; t.font = '700 10px Arial, sans-serif'; t.textAlign = 'center'; t.textBaseline = 'middle';
      t.fillText(String(id), 0, .6);
      if (id === 6 || id === 9) { t.fillRect(-3, 4.6, 6, 1); }
      t.restore();
    }
  }
  b.dirty = false;
}

// ---------- particles
const PARTS = []; for (let i = 0; i < 140; i++) PARTS.push({ on: false });
function spawn(x, y, vx, vy, life, size, col, drag = 3) {
  for (const p of PARTS) if (!p.on) { Object.assign(p, { on: true, x, y, vx, vy, life, max: life, size, col, drag }); return; }
}
const MOTES = []; for (let i = 0; i < 36; i++) MOTES.push({ x: rand(-1.4, 1.4), y: rand(-.8, .8), vx: rand(-.01, .01), vy: rand(-.01, .01), s: rand(.6, 1.8), ph: rand(0, TAU) });

// ---------- cue stick
function drawCue(t, bx, by, ang, pull, alpha, cue) {
  const tip = R + .006 + pull * .24, L = 1.47;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const wAt = x => .0128 + .0172 * Math.pow(clamp(x / L, 0, 1), 1.15);
  const poly = (x0, x1) => { const w0 = wAt(x0) / 2, w1 = wAt(x1) / 2; t.beginPath(); t.moveTo(x0, -w0); t.lineTo(x1, -w1); t.lineTo(x1, w1); t.lineTo(x0, w0); t.closePath(); };
  t.save(); t.globalAlpha = alpha * .45;
  t.translate(bx + .02 + bx * .02, by + .032 + by * .02); t.rotate(ang + Math.PI); t.translate(tip, 0);
  t.fillStyle = '#000'; poly(0, L); t.fill(); t.restore();
  t.save(); t.globalAlpha = alpha; t.translate(bx, by); t.rotate(ang + Math.PI); t.translate(tip, 0);
  const segs = [[0, .005, '#2f5a8a'], [.005, .028, cue.c[3]], [.028, .72, cue.c[0]], [.72, .735, '#c8c2b4'], [.735, 1.05, cue.c[1]], [1.05, 1.33, cue.c[2]], [1.33, 1.455, cue.c[1]], [1.455, L, '#0b0b0b']];
  segs.forEach(s => { t.fillStyle = s[2]; poly(s[0], s[1]); t.fill(); });
  // inlay points on the forearm
  t.fillStyle = cue === CUES.gold ? '#d6b26a' : 'rgba(240,225,195,.55)';
  for (const sg of [-1, 1]) { t.beginPath(); t.moveTo(.735, sg * wAt(.735) * .5); t.lineTo(.93, 0); t.lineTo(.735, sg * wAt(.735) * .12); t.fill(); }
  if (cue === CUES.gold) { t.fillStyle = '#d6b26a'; for (const x of [1.04, 1.335]) { poly(x, x + .008); t.fill(); } }
  // wrap texture
  t.strokeStyle = 'rgba(255,255,255,.06)'; t.lineWidth = .0012;
  for (let x = 1.055; x < 1.33; x += .009) { t.beginPath(); t.moveTo(x, -wAt(x) / 2); t.lineTo(x + .004, wAt(x) / 2); t.stroke(); }
  // cylinder shading
  const g = t.createLinearGradient(0, -.016, 0, .016);
  g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(.32, 'rgba(255,255,255,.28)'); g.addColorStop(.5, 'rgba(255,255,255,.05)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
  t.fillStyle = g; poly(0, L); t.fill();
  t.restore();
}

// ---------- aim guide
function rayCast(cx, cy, dx, dy) {
  let best = 1e9, hit = -1;
  for (const b of G.balls) {
    if (!b.on || b.id === 0) continue;
    const ox = b.x - cx, oy = b.y - cy, pr = ox * dx + oy * dy; if (pr < 0) continue;
    const pp = ox * ox + oy * oy - pr * pr; if (pp > D2) continue;
    const tt = pr - Math.sqrt(D2 - pp); if (tt < best) { best = tt; hit = b.id; }
  }
  const lx = HW - R, ly = HH - R;
  const tx = dx > 0 ? (lx - cx) / dx : dx < 0 ? (-lx - cx) / dx : 1e9, ty = dy > 0 ? (ly - cy) / dy : dy < 0 ? (-ly - cy) / dy : 1e9;
  const tr = Math.min(tx, ty);
  if (tr < best) return { t: Math.max(0, tr), hit: -1, nx: tx < ty ? -Math.sign(dx) : 0, ny: tx < ty ? 0 : -Math.sign(dy) };
  return { t: best, hit };
}
function drawGuide(t, cb, ang, cue) {
  const dx = Math.cos(ang), dy = Math.sin(ang), r = rayCast(cb.x, cb.y, dx, dy);
  const ex = cb.x + dx * r.t, ey = cb.y + dy * r.t, lw = 1.3 / view.s;
  t.save(); t.lineWidth = lw; t.setLineDash([.012, .009]); t.strokeStyle = 'rgba(255,255,255,.55)';
  t.beginPath(); t.moveTo(cb.x + dx * R, cb.y + dy * R); t.lineTo(ex, ey); t.stroke(); t.setLineDash([]);
  t.strokeStyle = 'rgba(255,255,255,.75)'; t.fillStyle = 'rgba(255,255,255,.08)';
  t.beginPath(); t.arc(ex, ey, R, 0, TAU); t.fill(); t.stroke();
  if (r.hit >= 0) {
    const ob = G.byId[r.hit]; let nx = ob.x - ex, ny = ob.y - ey; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const cosA = dx * nx + dy * ny, L1 = (.12 + .2 * cosA) * cue.guide, L2 = .16 * cue.guide * Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const legal = G.rules === 'free' || G.rules === 'speed' || legalTargets(G.turn).includes(r.hit);
    t.strokeStyle = legal ? 'rgba(255,255,255,.85)' : 'rgba(255,110,90,.9)'; t.lineWidth = lw * 1.6;
    t.beginPath(); t.moveTo(ob.x + nx * R, ob.y + ny * R); t.lineTo(ob.x + nx * (R + L1), ob.y + ny * (R + L1)); t.stroke();
    let tx = dx - cosA * nx, ty = dy - cosA * ny; const tl = Math.hypot(tx, ty);
    if (tl > .02) { tx /= tl; ty /= tl; t.strokeStyle = 'rgba(160,215,255,.6)'; t.lineWidth = lw; t.beginPath(); t.moveTo(ex, ey); t.lineTo(ex + tx * L2, ey + ty * L2); t.stroke(); }
    if (!legal) { t.strokeStyle = 'rgba(255,110,90,.9)'; t.lineWidth = lw * 1.4; t.beginPath(); t.moveTo(ex - R * .5, ey - R * .5); t.lineTo(ex + R * .5, ey + R * .5); t.moveTo(ex + R * .5, ey - R * .5); t.lineTo(ex - R * .5, ey + R * .5); t.stroke(); }
  } else if (cue.guide >= 1.6) {
    let rx = dx, ry = dy; if (r.nx) rx = -rx; else ry = -ry; const L = .14 * cue.guide;
    t.strokeStyle = 'rgba(255,255,255,.35)'; t.setLineDash([.01, .01]); t.beginPath(); t.moveTo(ex, ey); t.lineTo(ex + rx * L, ey + ry * L); t.stroke(); t.setLineDash([]);
  }
  t.restore();
}

function render(dt) {
  if (tableDirty) buildTable();
  const sh = SET.shake && G.shake > 0 ? G.shake : 0;
  shx = sh ? rand(-1, 1) * sh : 0; shy = sh ? rand(-1, 1) * sh : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(tableCv, shx * DPR, shy * DPR);
  setWorld(ctx, shx, shy);
  // ball shadows
  for (const b of G.balls) {
    if (!b.on && b.sink <= 0) continue;
    const k = b.on ? 1 : b.sink, x = b.on ? b.x : lerp(b.sinkX, b.x, k), y = b.on ? b.y : lerp(b.sinkY, b.y, k);
    const ox = x * .035 + .004, oy = y * .035 + .006;
    const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, R * 1.25);
    g.addColorStop(0, `rgba(0,0,0,${.55 * k})`); g.addColorStop(.6, `rgba(0,0,0,${.3 * k})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x + ox, y + oy, R * 1.25, 0, TAU); ctx.fill();
  }
  // guide (under the balls)
  const cb = cueBall();
  const showCue = cb && cb.on && G.cueAlpha > .01;
  if (showCue && (G.state === 'aim') && !G.placing && !isAI(G.turn)) drawGuide(ctx, cb, G.aim, curCue(G.turn));
  if (G.inHand && !G.placing && cb && cb.on && G.state === 'aim' && !isAI(G.turn) && G.mode !== 'demo') {
    const k = .5 + .5 * Math.sin(performance.now() / 260);
    ctx.strokeStyle = `rgba(214,178,106,${.35 + .45 * k})`; ctx.lineWidth = 2 / view.s; ctx.setLineDash([.008, .006]);
    ctx.beginPath(); ctx.arc(cb.x, cb.y, R * (1.55 + .15 * k), 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
  if (G.placing && cb) {
    ctx.strokeStyle = G.placeOK ? 'rgba(255,255,255,.6)' : 'rgba(255,90,70,.85)'; ctx.lineWidth = 2 / view.s;
    ctx.beginPath(); ctx.arc(cb.x, cb.y, R * 1.6, 0, TAU); ctx.stroke();
    if (G.kitchen) { ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fillRect(-HW, -HH, HEAD.x + HW, H); }
  }
  // balls
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const rp = R * view.s * DPR;
  for (const b of G.balls) {
    if (!b.on && b.sink <= 0) continue;
    if (b.dirty || b.mv || !b.cv) ballSprite(b, rp);
    let x = b.x, y = b.y, sc = 1, al = 1;
    if (!b.on) { const k = b.sink; x = lerp(b.sinkX, b.x, k); y = lerp(b.sinkY, b.y, k); sc = .55 + .45 * k; al = Math.min(1, k * 1.6); }
    const [sx, sy] = w2s(x, y), sz = b.cv.width * sc;
    ctx.globalAlpha = al;
    ctx.drawImage(b.cv, (sx + shx) * DPR - sz / 2, (sy + shy) * DPR - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
  // particles
  setWorld(ctx, shx, shy);
  for (const p of PARTS) {
    if (!p.on) continue;
    const a = p.life / p.max; ctx.globalAlpha = a * .8; ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.6 - a * .6), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // cue
  if (showCue) {
    const ai = isAI(G.turn);
    const ang = G.aim;
    const pull = G.state === 'strike' ? G.pull * clamp(G.strikeT / .07, 0, 1) : G.pull;
    drawCue(ctx, cb.x, cb.y, ang, pull, G.cueAlpha, curCue(G.turn));
    if (!ai && G.state === 'aim' && G.power > 0 && !G.placing) {
      // power readout beside the cue ball
      const [sx, sy] = w2s(cb.x, cb.y);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.font = '600 14px "Barlow Semi Condensed", Inter, sans-serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(Math.round(G.power * 100) + '%', sx + 1, sy - 22 + 1);
      ctx.fillStyle = '#f3e7cc'; ctx.fillText(Math.round(G.power * 100) + '%', sx, sy - 22);
    }
  }
  // dust motes in the lamp light
  if (!SET.low) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    for (const m of MOTES) {
      const [sx, sy] = w2s(m.x, m.y), a = (.25 + .2 * Math.sin(m.ph)) * Math.max(0, 1 - Math.hypot(m.x, m.y) / 1.3);
      ctx.fillStyle = `rgba(255,236,200,${a})`; ctx.fillRect(sx, sy, m.s, m.s);
    }
  }
}

// =====================================================================
//  GAME FLOW
// =====================================================================
function freeSpot(x, y, dirx) {
  let px = x, py = y;
  for (let k = 0; k < 80; k++) {
    if (!G.balls.some(b => b.on && Math.hypot(b.x - px, b.y - py) < D * 1.02) && inTable(px, py)) return [px, py];
    px += dirx * D * .55; if (px > HW - R) { px = x; dirx = -1; }
  }
  return [x, y + D];
}
function placeOK(x, y) {
  if (!inTable(x, y, .001)) return false;
  if (G.kitchen && x > HEAD.x) return false;
  return !G.balls.some(b => b.on && b.id !== 0 && Math.hypot(b.x - x, b.y - y) < D + .001);
}
function startMatch(cfg) {
  G.cfg = cfg; G.mode = cfg.mode; G.rules = cfg.rules; G.players = cfg.players; G.raceTo = cfg.raceTo || 1;
  G.frames = [0, 0]; G.breaker = cfg.breaker || 0; G.frameNo = 1; G.paused = false;
  G.stats = { potted: [0, 0], bestRun: [0, 0], fouls: [0, 0], shots: 0 };
  AU.demo = cfg.mode === 'demo'; AU.duck = cfg.mode === 'demo' ? 1 : .75; applyAudio();
  newFrame();
}
function newFrame() {
  const type = G.rules === '9' ? '9' : '8';
  setBalls(rack(type));
  G.turn = G.mode === 'speed' || G.mode === 'practice' ? 0 : G.breaker;
  G.groups = [null, null]; G.brk = G.rules === '8' || G.rules === '9'; G.run = 0;
  G.inHand = true; G.kitchen = G.mode !== 'practice'; G.aim = 0; G.power = 0; G.pull = 0; G.spinX = 0; G.spinY = 0;
  G.speedT = 0; G.speedPen = 0; G.speedOn = false; G.shots = 0;
  if (G.mode === 'speed') G.brk = false;
  hudFull();
  beginTurn();
}
function beginTurn() {
  G.rec = null; G.power = 0; G.pull = 0;
  const cb = cueBall();
  if (!cb.on) {
    const [x, y] = freeSpot(G.kitchen ? HEAD.x : HEAD.x, 0, -1);
    cb.x = x; cb.y = y; cb.vx = cb.vy = cb.rx = cb.ry = cb.sp = 0; cb.on = true; cb.mv = false; cb.sink = 0; cb.dirty = true;
  }
  if (G.mode === 'practice') G.inHand = true;
  hudTurn();
  if (isAI(G.turn)) {
    G.state = 'ai_think'; G.aiPlan = {}; G.ai = aiThink(G.turn, G.players[G.turn].ai, G.aiPlan); G.aiT = 0;
    document.getElementById('pl' + G.turn).classList.add('thinking');
  } else {
    G.state = 'aim';
    // point the cue at something sensible
    const tg = legalTargets(G.turn).map(i => G.byId[i]).filter(Boolean);
    if (tg.length) { tg.sort((a, b) => Math.hypot(a.x - cb.x, a.y - cb.y) - Math.hypot(b.x - cb.x, b.y - cb.y)); G.aim = Math.atan2(tg[0].y - cb.y, tg[0].x - cb.x); }
    coachUpdate();
  }
}
function fire(ang, speed, sx, sy) {
  const cb = cueBall(); const P = G.turn;
  G.shotSt = shotState(P);
  G.rec = newRec();
  strikeBall(cb, ang, speed, sx, sy);
  G.state = 'roll'; G.shots++; G.stats.shots++; G.inHand = false; G.placing = false;
  SFX.strike(speed);
  if (G.brk && speed > 5) { G.hitStop = .05; G.shake = 5; }
  for (let i = 0; i < 6; i++) spawn(cb.x - Math.cos(ang) * R, cb.y - Math.sin(ang) * R, rand(-.15, .15), rand(-.15, .15), rand(.3, .6), rand(.002, .004), '#7fb2e6');
  if (G.mode === 'speed' && !G.speedOn) G.speedOn = true;
  if (!isAI(P) && G.mode !== 'demo' && SAVE.tut < 3) { SAVE.tut++; persist(); }
  coachUpdate();
}
function endShot() {
  const rec = G.rec, P = G.turn, O = 1 - P, st = G.shotSt;
  const pn = rec.potted.filter(i => i !== 0);
  if (G.mode !== 'demo') { G.stats.potted[P] += pn.length; if (!isAI(P)) SAVE.stats.potted += pn.length; }
  G.run = pn.length && !rec.scratch ? G.run + pn.length : 0;
  if (G.run > G.stats.bestRun[P]) G.stats.bestRun[P] = G.run;
  if (G.mode === 'practice') { if (rec.scratch) toast('Scratch', 'foul'); G.inHand = true; G.kitchen = false; beginTurn(); return; }
  if (G.mode === 'speed') {
    if (rec.scratch) { G.speedPen += 5; toast('Scratch — 5 second penalty', 'foul'); SFX.foul(); G.inHand = true; G.kitchen = false; }
    hudFull();
    if (!G.balls.some(b => b.on && b.id !== 0)) return finishSpeed();
    beginTurn(); return;
  }
  const j = (G.rules === '9' ? judge9 : judge8)(P, rec, st);
  G.brk = false; G.kitchen = false;
  if (j.win) return endFrame(P, G.rules === '9' ? 'Sank the 9' : 'Sank the 8');
  if (j.lose) { SFX.foul(); return endFrame(O, j.reason); }
  if (j.respot8 || j.respot9) {
    const b = G.byId[j.respot8 ? 8 : 9]; const [x, y] = freeSpot(FOOT.x, 0, 1);
    b.x = x; b.y = y; b.on = true; b.mv = false; b.sink = 0; b.vx = b.vy = b.rx = b.ry = b.sp = 0; b.dirty = true;
    toast('The ' + b.id + ' is spotted');
  }
  if (j.assign) {
    G.groups[P] = j.assign; G.groups[O] = j.assign === 'solid' ? 'stripe' : 'solid';
    toast(G.players[P].name + (G.players[P].you ? ' are ' : ' is ') + (j.assign === 'solid' ? 'solids' : 'stripes'), 'good'); SFX.good();
  }
  if (j.foul) {
    G.stats.fouls[P]++;
    toast(j.reason + ' — ball in hand', 'foul'); SFX.foul();
    G.turn = O; G.inHand = true; G.run = 0;
  } else if (!j.cont) {
    G.turn = O; G.run = 0;
  } else if (pn.length >= 2 && G.mode !== 'demo') toast(pn.length + ' balls!', 'good');
  hudFull();
  if (G.mode === 'two' && !j.cont) toast(G.players[G.turn].name + ' to shoot');
  beginTurn();
}
function endFrame(w, why) {
  G.frames[w]++;
  const matchOver = G.frames[w] >= G.raceTo;
  hudFull();
  if (G.mode === 'demo') { G.state = 'wait'; G.wait = 2.2; G.waitFn = () => { G.breaker = 1 - G.breaker; newFrame(); }; return; }
  const you = G.players[w].you, two = G.mode === 'two';
  if (!matchOver) {
    banner(two ? G.players[w].name + ' takes the frame' : you ? 'Frame won' : 'Frame lost', why + ' · ' + G.frames[0] + '–' + G.frames[1]);
    if (you || two) SFX.good(); else SFX.foul();
    G.state = 'wait'; G.wait = 2.6; G.waitFn = () => { G.breaker = 1 - G.breaker; G.frameNo++; newFrame(); };
  } else {
    G.state = 'wait'; G.wait = 2.2; G.waitFn = () => showResult(w, why);
    banner(two ? G.players[w].name + ' wins' : you ? 'Match won' : 'Match lost', why);
    if (you || two) SFX.win(); else SFX.lose();
  }
}
function showResult(w, why) {
  G.state = 'over'; $('banner').classList.add('hide');
  const you = G.players[w].you, cfg = G.cfg;
  let prize = 0, title, sub;
  if (G.mode === 'two') { title = G.players[w].name + ' wins'; sub = G.frames[0] + '–' + G.frames[1]; }
  else {
    title = you ? 'You win' : 'You lose';
    sub = (you ? 'You beat ' : 'Beaten by ') + G.players[1].name + ' ' + G.frames[0] + '–' + G.frames[1];
    if (you) {
      SAVE.stats.won++;
      if (cfg.mode === 'career') {
        const first = !SAVE.beaten.includes(cfg.idx);
        prize = first ? cfg.prize : Math.round(cfg.prize * .4);
        if (first) SAVE.beaten.push(cfg.idx);
        SAVE.ladder = Math.max(SAVE.ladder, cfg.idx + 1);
      } else prize = cfg.prize || 0;
      SAVE.money += prize;
    } else SAVE.stats.lost++;
    SAVE.stats.bestRun = Math.max(SAVE.stats.bestRun, G.stats.bestRun[0]);
    persist();
  }
  $('rTitle').textContent = title; $('rSub').textContent = sub;
  const pr = $('rPrize');
  if (prize) { pr.textContent = '+$' + prize; pr.classList.remove('hide'); SFX.coin(); } else pr.classList.add('hide');
  const names = G.players.map(p => p.name);
  $('rKV').innerHTML = `<tr><td></td><td style="color:var(--muted);font-weight:500">${names[0]} – ${names[1]}</td></tr>` + [
    ['Balls sunk', G.stats.potted[0] + ' – ' + G.stats.potted[1]],
    ['Best run', G.stats.bestRun[0] + ' – ' + G.stats.bestRun[1]],
    ['Fouls', G.stats.fouls[0] + ' – ' + G.stats.fouls[1]],
    ['Bankroll', '$' + SAVE.money]
  ].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  const alt = $('rAlt');
  alt.classList.add('hide');
  if (cfg.mode === 'career' && you && cfg.idx + 1 < LADDER.length) { alt.textContent = 'Next: ' + LADDER[cfg.idx + 1].name; alt.classList.remove('hide'); alt.onclick = () => { SFX.ui(); openIntro(cfg.idx + 1); }; }
  $('rAgain').textContent = cfg.mode === 'career' ? (you ? 'Play again' : 'Rematch') : 'Play again';
  show('result');
}
function finishSpeed() {
  G.state = 'over'; $('banner').classList.add('hide'); G.speedOn = false;
  const total = G.speedT + G.speedPen;
  const prev = SAVE.speedBest, best = prev === null || total < prev;
  if (best) SAVE.speedBest = total;
  const medal = total < 150 ? 3 : total < 210 ? 2 : total < 300 ? 1 : 0;
  let prize = 0;
  if (medal > SAVE.speedMedals) { const pay = [0, 40, 90, 200]; for (let m = SAVE.speedMedals + 1; m <= medal; m++) prize += pay[m]; SAVE.speedMedals = medal; }
  SAVE.money += prize; persist();
  $('rTitle').textContent = fmtT(total);
  $('rSub').textContent = (best ? 'New best time! ' : 'Best ' + fmtT(prev) + '. ') + ['No medal — under 5:00 for bronze', 'Bronze medal', 'Silver medal', 'Gold medal'][medal];
  const pr = $('rPrize'); if (prize) { pr.textContent = '+$' + prize; pr.classList.remove('hide'); SFX.coin(); } else pr.classList.add('hide');
  $('rKV').innerHTML = [['Time', fmtT(G.speedT)], ['Penalties', '+' + G.speedPen + 's'], ['Shots', G.shots], ['Medal times', 'Gold 2:30 · Silver 3:30 · Bronze 5:00']].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  $('rAlt').classList.add('hide'); $('rAgain').textContent = 'Try again';
  medal ? SFX.win() : SFX.good();
  show('result');
}
const fmtT = s => { if (s === null || s === undefined) return '—'; const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };

// =====================================================================
//  UPDATE
// =====================================================================
const KEYS = {};
let spaceT = 0, spaceHeld = false;
function update(dt) {
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  for (const p of PARTS) { if (!p.on) continue; p.life -= dt; if (p.life <= 0) { p.on = false; continue; } p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; }
  for (const m of MOTES) { m.x += m.vx * dt; m.y += m.vy * dt; m.ph += dt * .7; if (Math.abs(m.x) > 1.5) m.vx *= -1; if (Math.abs(m.y) > .9) m.vy *= -1; }
  for (const b of G.balls) if (!b.on && b.sink > 0) b.sink = Math.max(0, b.sink - dt * 4.5);
  const cb = cueBall();
  const wantCue = (G.state === 'aim' || G.state === 'strike' || G.state.startsWith('ai_')) && cb && cb.on && !(G.state === 'ai_think') && !(G.placing && G.state === 'aim');
  G.cueAlpha = clamp(G.cueAlpha + (wantCue ? dt * 5 : -dt * 6), 0, 1);
  if (G.paused || G.state === 'over' || G.state === 'idle') return;
  if (G.mode === 'speed' && G.speedOn) { G.speedT += dt; $('timer').textContent = fmtT(G.speedT + G.speedPen); }
  switch (G.state) {
    case 'aim': {
      let rot = 0;
      if (KEYS.ArrowLeft || KEYS.KeyA || fineHold === -1) rot -= 1;
      if (KEYS.ArrowRight || KEYS.KeyD || fineHold === 1) rot += 1;
      if (rot) { keyAimT += dt; const sp = (KEYS.ShiftLeft || KEYS.ShiftRight) ? .012 : (keyAimT > .45 ? .5 : .08); G.aim += rot * sp * dt; mouseAimLock = true; } else keyAimT = 0;
      if (KEYS.ArrowUp || KEYS.ArrowDown || KEYS.KeyQ || KEYS.KeyE) {
        const sx = (KEYS.KeyE ? 1 : 0) - (KEYS.KeyQ ? 1 : 0), sy = (KEYS.ArrowUp ? 1 : 0) - (KEYS.ArrowDown ? 1 : 0);
        G.spinX = clamp(G.spinX + sx * dt * 1.6, -1, 1); G.spinY = clamp(G.spinY + sy * dt * 1.6, -1, 1);
        const l = Math.hypot(G.spinX, G.spinY); if (l > 1) { G.spinX /= l; G.spinY /= l; } drawSpin();
      }
      if (spaceHeld) { spaceT += dt; G.power = 1 - Math.abs(((spaceT / 1.5) % 2) - 1); G.pull = G.power; powerUI(); }
      break;
    }
    case 'strike':
      G.strikeT -= dt;
      if (G.strikeT <= 0) { const s = G.pending; G.pending = null; fire(s.ang, s.speed, s.sx, s.sy); }
      break;
    case 'roll': {
      if (G.hitStop > 0) { G.hitStop -= dt; break; }
      const snd = [];
      advance(G.balls, dt, G.rec, snd);
      let tot = 0;
      for (const b of G.balls) {
        if (!b.on || !b.mv) continue;
        const sp = Math.hypot(b.vx, b.vy); tot += sp;
        rotM(b.M, b.ry / R, -b.rx / R, b.sp / R, Math.hypot(b.ry, b.rx, b.sp) / R * dt);
        if (++b.oc % 90 === 0) orthoM(b.M);
        b.dirty = true;
      }
      SFX.setRoll(tot * .045);
      let nClack = 0;
      for (let i = 0; i < snd.length;) {
        const ty = snd[i];
        if (ty === 0) { if (nClack++ < 5) SFX.clack(snd[i + 1], snd[i + 2] / HW); i += 3; }
        else if (ty === 1) { SFX.rail(snd[i + 1], snd[i + 2] / HW); if (snd[i + 1] > 2.5 && SET.shake) G.shake = Math.max(G.shake, 1.5); i += 3; }
        else {
          const id = snd[i + 3], pk = POCKETS[snd[i + 4]], b = G.byId[id];
          SFX.pocket(snd[i + 1], pk.x / HW);
          b.sink = 1; b.sinkX = pk.x; b.sinkY = pk.y;
          for (let k = 0; k < 5; k++) spawn(pk.x + rand(-.02, .02), pk.y + rand(-.02, .02), rand(-.1, .1), rand(-.1, .1), rand(.3, .5), rand(.002, .004), 'rgba(255,240,210,.35)');
          if (G.mode !== 'demo') hudFull();
          i += 5;
        }
      }
      if (!anyMoving(G.balls) && !G.balls.some(b => !b.on && b.sink > 0)) { SFX.setRoll(0); endShot(); }
      break;
    }
    case 'ai_think': {
      G.aiT += dt;
      const t0 = performance.now();
      let done = false;
      while (performance.now() - t0 < 7) { const r = G.ai.next(); if (r.done) { done = true; break; } }
      if (done && G.aiT > .55) {
        document.getElementById('pl' + G.turn).classList.remove('thinking');
        const pl = G.aiPlan.plan;
        G.aiFrom = G.aim; G.aiT = 0;
        if (pl.place) { G.placeFrom = { x: cb.x, y: cb.y }; G.state = 'ai_place'; }
        else G.state = 'ai_aim';
      }
      break;
    }
    case 'ai_place': {
      G.aiT += dt; const k = ease(clamp(G.aiT / .55, 0, 1)), pl = G.aiPlan.plan;
      cb.x = lerp(G.placeFrom.x, pl.place.x, k); cb.y = lerp(G.placeFrom.y, pl.place.y, k); cb.dirty = true;
      if (k >= 1) { G.state = 'ai_aim'; G.aiT = 0; G.aiFrom = G.aim; }
      break;
    }
    case 'ai_aim': {
      G.aiT += dt; const pl = G.aiPlan.plan, T = .9;
      let da = pl.ang - G.aiFrom; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
      const k = ease(clamp(G.aiT / T, 0, 1));
      G.aim = G.aiFrom + da * k + Math.sin(G.aiT * 9) * .004 * (1 - k);
      if (G.aiT > T + .25) { G.state = 'ai_pull'; G.aiT = 0; G.aim = pl.ang; }
      break;
    }
    case 'ai_pull': {
      G.aiT += dt; const pl = G.aiPlan.plan; const target = clamp(pl.speed / maxSpeed(G.turn), .12, 1);
      G.pull = target * ease(clamp(G.aiT / .5, 0, 1));
      if (G.aiT > .62) { G.pending = { ang: pl.ang, speed: pl.speed, sx: pl.sx, sy: pl.sy }; G.strikeT = .07; G.state = 'strike'; }
      break;
    }
    case 'wait':
      G.wait -= dt; if (G.wait <= 0) { G.state = 'idle'; const f = G.waitFn; G.waitFn = null; f && f(); }
      break;
  }
}

// =====================================================================
//  INPUT
// =====================================================================
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ } };
let mouseAimLock = false, lockX = 0, lockY = 0, keyAimT = 0, fineHold = 0;
const INP = { mode: null, sx: 0, sy: 0, id: null };
const humanCanAct = () => G.state === 'aim' && !G.paused && !isAI(G.turn) && G.mode !== 'demo';
function aimAt(wx, wy) { const cb = cueBall(); if (!cb) return; const dx = wx - cb.x, dy = wy - cb.y; if (dx * dx + dy * dy > (R * 1.2) ** 2) G.aim = Math.atan2(dy, dx); }
function pullDist() { return clamp(Math.min(VW, VH) * .34, 130, 260); }
function tryShoot() {
  if (G.power < .035) { G.power = 0; G.pull = 0; powerUI(); return; }
  const P = G.turn, cue = curCue(P);
  G.pending = { ang: G.aim, speed: powerToSpeed(G.power, P), sx: G.spinX * cue.spin, sy: G.spinY * cue.spin };
  G.pull = Math.max(G.pull, G.power); G.strikeT = .07; G.state = 'strike'; G.power = 0; powerUI();
}
cv.addEventListener('pointerdown', e => {
  audioInit();
  if (!humanCanAct()) return;
  const [wx, wy] = s2w(e.clientX, e.clientY), cb = cueBall();
  if (G.inHand && Math.hypot(wx - cb.x, wy - cb.y) < R * 3) {
    INP.mode = 'place'; G.placing = true; G.placeOK = true; INP.id = e.pointerId; capture(cv, e); return;
  }
  if (e.pointerType === 'mouse') {
    if (e.button !== 0) return;
    INP.mode = 'pull'; INP.sx = e.clientX; INP.sy = e.clientY; G.power = 0;
  } else { INP.mode = 'touchaim'; aimAt(wx, wy); }
  INP.id = e.pointerId; capture(cv, e);
});
cv.addEventListener('pointermove', e => {
  if (!humanCanAct()) return;
  const [wx, wy] = s2w(e.clientX, e.clientY), cb = cueBall();
  if (INP.mode === 'place') {
    const x = clamp(wx, -HW + R, G.kitchen ? HEAD.x : HW - R), y = clamp(wy, -HH + R, HH - R);
    G.placeOK = placeOK(x, y);
    if (G.placeOK) { cb.x = x; cb.y = y; cb.dirty = true; }
    return;
  }
  if (INP.mode === 'pull') {
    const [csx, csy] = w2s(cb.x, cb.y), [asx, asy] = w2s(cb.x + Math.cos(G.aim), cb.y + Math.sin(G.aim));
    let dx = asx - csx, dy = asy - csy; const l = Math.hypot(dx, dy); dx /= l; dy /= l;
    const back = -((e.clientX - INP.sx) * dx + (e.clientY - INP.sy) * dy);
    G.power = clamp(back / pullDist(), 0, 1); G.pull = G.power; powerUI();
    return;
  }
  if (INP.mode === 'touchaim') { aimAt(wx, wy); return; }
  if (e.pointerType === 'mouse') {
    if (mouseAimLock && Math.hypot(e.clientX - lockX, e.clientY - lockY) < 14) return;
    mouseAimLock = false; lockX = e.clientX; lockY = e.clientY;
    aimAt(wx, wy);
  }
});
function endPointer(e) {
  if (INP.id !== null && e.pointerId !== INP.id) return;
  if (INP.mode === 'place') { G.placing = false; }
  else if (INP.mode === 'pull' && humanCanAct()) tryShoot();
  INP.mode = null; INP.id = null;
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', e => { INP.mode = null; INP.id = null; G.placing = false; G.power = 0; G.pull = 0; powerUI(); });
cv.addEventListener('contextmenu', e => { e.preventDefault(); if (INP.mode === 'pull') { INP.mode = null; G.power = 0; G.pull = 0; powerUI(); } });
cv.addEventListener('wheel', e => {
  e.preventDefault(); if (!humanCanAct()) return;
  G.aim += Math.sign(e.deltaY) * (e.shiftKey ? .0006 : .0028); mouseAimLock = true; lockX = e.clientX; lockY = e.clientY;
}, { passive: false });
// power slider
const powTrack = $('powTrack');
let sliderOn = false, sliderId = null;
function sliderSet(e) { const r = powTrack.getBoundingClientRect(); G.power = clamp((e.clientY - r.top - 14) / (r.height - 28), 0, 1); G.pull = G.power; powerUI(); }
powTrack.addEventListener('pointerdown', e => { audioInit(); if (!humanCanAct()) return; sliderOn = true; sliderId = e.pointerId; capture(powTrack, e); sliderSet(e); });
powTrack.addEventListener('pointermove', e => { if (sliderOn && e.pointerId === sliderId) sliderSet(e); });
powTrack.addEventListener('pointerup', e => { if (!sliderOn) return; sliderOn = false; if (humanCanAct()) tryShoot(); });
powTrack.addEventListener('pointercancel', () => { sliderOn = false; G.power = 0; G.pull = 0; powerUI(); });
function powerUI() { const p = G.power; $('powFill').style.height = (p * 100) + '%'; $('powKnob').style.top = `calc(${p * 100}% - ${p * 29}px + 3px)`; }
// spin pad
const spinC = $('spinC'), sctx = spinC.getContext('2d');
function drawSpin() {
  const w = spinC.width, c = w / 2, r = w * .42;
  sctx.clearRect(0, 0, w, w);
  const g = sctx.createRadialGradient(c - r * .35, c - r * .4, r * .1, c, c, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#e9e3d3'); g.addColorStop(1, '#9d9584');
  sctx.fillStyle = g; sctx.beginPath(); sctx.arc(c, c, r, 0, TAU); sctx.fill();
  sctx.strokeStyle = 'rgba(0,0,0,.18)'; sctx.lineWidth = 2; sctx.beginPath(); sctx.moveTo(c - r, c); sctx.lineTo(c + r, c); sctx.moveTo(c, c - r); sctx.lineTo(c, c + r); sctx.stroke();
  sctx.beginPath(); sctx.arc(c, c, r * .5, 0, TAU); sctx.stroke();
  const px = c + G.spinX * r * .82, py = c - G.spinY * r * .82;
  sctx.fillStyle = '#c8392e'; sctx.beginPath(); sctx.arc(px, py, w * .07, 0, TAU); sctx.fill();
  sctx.strokeStyle = '#fff'; sctx.lineWidth = 3; sctx.stroke();
}
let spinOn = false;
function spinSet(e) { const r = spinC.getBoundingClientRect(); let x = ((e.clientX - r.left) / r.width - .5) / .42 / .82 * 2 * .5, y = -((e.clientY - r.top) / r.height - .5) / .42 / .82 * 2 * .5; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } if (l < .08) { x = 0; y = 0; } G.spinX = x; G.spinY = y; drawSpin(); }
spinC.addEventListener('pointerdown', e => { audioInit(); spinOn = true; capture(spinC, e); spinSet(e); SFX.chalk(); });
spinC.addEventListener('pointermove', e => { if (spinOn) spinSet(e); });
spinC.addEventListener('pointerup', () => { spinOn = false; });
// fine aim buttons
['fL', 'fR'].forEach((id, i) => {
  const b = $(id), dir = i ? 1 : -1;
  b.addEventListener('pointerdown', e => { audioInit(); fineHold = dir; G.aim += dir * .0015; capture(b, e); });
  b.addEventListener('pointerup', () => { fineHold = 0; }); b.addEventListener('pointercancel', () => { fineHold = 0; });
});
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'range') return;
  audioInit();
  KEYS[e.code] = true;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (inGame()) { togglePause(); e.preventDefault(); } else if (e.code === 'Escape') goBack(); return; }
  if (e.code === 'KeyM') { SET.mute = !SET.mute; persistSet(); applyAudio(); syncSettings(); toast(SET.mute ? 'Sound off' : 'Sound on'); return; }
  if (!humanCanAct()) return;
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); spaceHeld = true; spaceT = 0; }
  if (e.code === 'KeyX') { G.spinX = 0; G.spinY = 0; drawSpin(); }
  if (e.code === 'KeyR' && G.mode === 'practice') { setBalls(rack(G.rules === '9' ? '9' : '8')); beginTurn(); }
  if (e.code.startsWith('Arrow')) e.preventDefault();
});
window.addEventListener('keyup', e => {
  KEYS[e.code] = false;
  if (e.code === 'Space' && spaceHeld) { spaceHeld = false; if (humanCanAct()) tryShoot(); }
});
window.addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; spaceHeld = false; fineHold = 0; if (inGame() && !G.paused) togglePause(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (inGame() && !G.paused) togglePause(); if (AU.ctx && AU.ctx.state === 'running') AU.ctx.suspend(); }
  else if (AU.ctx && AU.ctx.state === 'suspended' && AU.started !== false) AU.ctx.resume();
});

// =====================================================================
//  UI
// =====================================================================
const PANELS = ['menu', 'career', 'quick', 'intro', 'shop', 'settings', 'help', 'pause', 'result'];
let navStack = [];
function show(id, push = true) {
  PANELS.forEach(p => $(p).classList.toggle('hide', p !== id));
  if (push) { if (navStack[navStack.length - 1] !== id) navStack.push(id); }
  if (id === 'menu') { navStack = ['menu']; refreshMenu(); }
  if (id === 'career') buildLadder();
  if (id === 'shop') buildShop();
  if (id === 'settings') syncSettings();
}
function hideAll() { PANELS.forEach(p => $(p).classList.add('hide')); }
function goBack() {
  if (navStack.length <= 1) { if (G.paused) show('pause'); return; }
  navStack.pop(); const prev = navStack[navStack.length - 1];
  SFX.ui(); show(prev, false);
}
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', goBack));
const inGame = () => !document.body.classList.contains('inmenu') && G.mode !== 'demo' && G.state !== 'over';
function setMenuMode(on) {
  document.body.classList.toggle('inmenu', on);
  $('hud').classList.toggle('hide', on);
  resize();
}
function refreshMenu() {
  $('money').textContent = '$' + SAVE.money;
  const rec = [];
  rec.push('Ladder ' + Math.min(SAVE.ladder, 8) + '/8');
  if (SAVE.speedBest !== null) rec.push('Speed Pool best ' + fmtT(SAVE.speedBest));
  $('menuRec').textContent = rec.join(' · ');
}
function toMenu() {
  G.paused = false; setMenuMode(true); coachHide();
  $('banner').classList.add('hide');
  startDemo();
  show('menu');
}
function startDemo() {
  startMatch({ mode: 'demo', rules: '8', raceTo: 99, players: [{ name: 'A', ai: .78 }, { name: 'B', ai: .72 }] });
}
function you() { return { name: 'You', you: true, ai: -1, mono: 'ME', col: '#2c6e57' }; }
function launch(cfg) {
  hideAll(); navStack = []; setMenuMode(false);
  $('practiceBar').classList.toggle('hide', cfg.mode !== 'practice');
  $('speedBox').classList.toggle('hide', cfg.mode !== 'speed');
  document.querySelector('.plates').classList.toggle('hide', cfg.mode === 'speed' || cfg.mode === 'practice');
  startMatch(cfg);
  if (cfg.mode === 'speed') banner('Speed Pool', 'Sink all 15 balls. The clock starts on the break.');
  else if (cfg.mode === 'practice') banner('Practice', 'No rules. Drag the cue ball anywhere.');
  else banner(cfg.mode === 'two' ? 'Frame 1' : 'vs ' + cfg.players[1].name, (cfg.rules === '9' ? '9-ball' : '8-ball') + ' · ' + (cfg.raceTo > 1 ? 'race to ' + cfg.raceTo : 'one frame') + ' · ' + G.players[G.breaker].name + (G.players[G.breaker].you ? ' break' : ' breaks'));
}
// ---------- menu buttons
$('bCareer').onclick = () => { SFX.ui(); show('career'); };
$('bQuick').onclick = () => { SFX.ui(); buildQuick(); show('quick'); };
$('bSpeed').onclick = () => { SFX.ui(); launch({ mode: 'speed', rules: 'speed', raceTo: 1, players: [you(), { name: '', ai: -1 }] }); };
$('bPractice').onclick = () => { SFX.ui(); launch({ mode: 'practice', rules: 'free', raceTo: 1, players: [you(), { name: '', ai: -1 }] }); };
$('bShop').onclick = () => { SFX.ui(); show('shop'); };
$('bSet').onclick = () => { SFX.ui(); show('settings'); };
$('bHelp').onclick = () => { SFX.ui(); show('help'); };
$('bRe8').onclick = () => { SFX.ui(); G.rules = 'free'; setBalls(rack('8')); G.state = 'idle'; beginTurn(); };
$('bRe9').onclick = () => { SFX.ui(); G.rules = 'free'; setBalls(rack('9')); G.state = 'idle'; beginTurn(); };
$('bHudPause').onclick = () => { audioInit(); if (inGame()) togglePause(); };
// ---------- ladder
const initials = n => n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
function buildLadder() {
  const el = $('ladder'); el.innerHTML = '';
  LADDER.forEach((o, i) => {
    const beaten = SAVE.beaten.includes(i), locked = i > SAVE.ladder, next = i === SAVE.ladder;
    const d = document.createElement('button');
    d.className = 'rung' + (beaten ? ' beaten' : '') + (locked ? ' locked' : '') + (next ? ' next' : '');
    d.innerHTML = `<span class="num">${i + 1}</span><span class="mono" style="background:${o.col}">${initials(o.name)}</span>
      <span class="who"><b>${o.name}</b><small>“${o.nick}” · ${o.game}-ball · race to ${o.race}</small></span>
      <span class="st">${locked ? 'Locked' : beaten ? 'Beaten' : 'Prize'}<b>$${beaten ? Math.round(o.prize * .4) : o.prize}</b></span>`;
    d.onclick = () => { if (locked) { SFX.foul(); return; } SFX.ui(); openIntro(i); };
    el.appendChild(d);
  });
}
function openIntro(i) {
  const o = LADDER[i], beaten = SAVE.beaten.includes(i);
  $('inName').textContent = o.name; $('inNick').textContent = '“' + o.nick + '”';
  const m = $('inMono'); m.textContent = initials(o.name); m.style.background = o.col;
  $('inBio').textContent = o.bio;
  $('inKV').innerHTML = [['Game', o.game + '-ball'], ['Match', 'Race to ' + o.race], ['Prize', '$' + (beaten ? Math.round(o.prize * .4) + ' (rematch)' : o.prize)], ['Your cue', CUES[SAVE.cue].name]].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
  $('inGo').onclick = () => { SFX.ui(); startCareer(i); };
  show('intro');
}
function startCareer(i) {
  const o = LADDER[i];
  launch({ mode: 'career', idx: i, rules: o.game, raceTo: o.race, prize: o.prize, players: [you(), { name: o.name, ai: o.skill, mono: initials(o.name), col: o.col }] });
}
// ---------- quick match
let qGame = '8', qOpp = 1, qRace = 2;
function buildQuick() {
  const el = $('qOpp'); el.innerHTML = '';
  LEVELS.forEach((l, i) => {
    const b = document.createElement('button'); b.className = i === qOpp ? 'on' : '';
    b.innerHTML = `<span>${l.name}</span><small>${l.sub}${l.prize ? ' · $' + l.prize : ''}</small>`;
    b.onclick = () => { qOpp = i; SFX.ui(); buildQuick(); }; el.appendChild(b);
  });
  segBind('qGame', v => { qGame = v; }, qGame); segBind('qRace', v => { qRace = +v; }, String(qRace));
}
function segBind(id, fn, cur) {
  $(id).querySelectorAll('button').forEach(b => {
    b.classList.toggle('on', b.dataset.v === cur);
    b.onclick = () => { SFX.ui(); $(id).querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); fn(b.dataset.v); };
  });
}
$('qGo').onclick = () => {
  SFX.ui(); const L = LEVELS[qOpp];
  if (L.skill < 0) launch({ mode: 'two', rules: qGame, raceTo: qRace, players: [{ name: 'Player 1', ai: -1, mono: 'P1', col: '#2c6e57' }, { name: 'Player 2', ai: -1, mono: 'P2', col: '#7a4a2a' }] });
  else launch({ mode: 'quick', rules: qGame, raceTo: qRace, prize: L.prize * qRace, players: [you(), { name: L.name, ai: L.skill, mono: L.name.slice(0, 2).toUpperCase(), col: ['#56707f', '#6c6a3e', '#3a7a74', '#a8323a'][qOpp] }] });
};
// ---------- shop
let shopTab = 'cues';
function cueThumb(cv2, cue) {
  const w = cv2.width = 520, h = cv2.height = 56, t = cv2.getContext('2d');
  t.setTransform(w / 1.5, 0, 0, w / 1.5, -w / 1.5 * .02, h / 2);
  drawCue(t, -R - .006, 0, Math.PI, 0, 1, cue);
}
function buildShop() {
  $('shopMoney').textContent = 'Bankroll: $' + SAVE.money;
  segBind('shopTab', v => { shopTab = v; buildShop(); }, shopTab);
  const el = $('shopList'); el.innerHTML = '';
  const src = shopTab === 'cues' ? CUES : CLOTHS, owned = shopTab === 'cues' ? SAVE.cues : SAVE.cloths, eq = shopTab === 'cues' ? SAVE.cue : SAVE.cloth;
  Object.keys(src).forEach(k => {
    const it = src[k], has = owned.includes(k), on = eq === k;
    const d = document.createElement('div'); d.className = 'item' + (on ? ' eq' : '');
    let body = `<h4>${it.name}</h4>`;
    if (shopTab === 'cues') {
      body += `<canvas></canvas><p>${it.desc}</p><div class="bars"><span>Aim line</span><i><b style="width:${it.guide / 2.2 * 100}%"></b></i><span>Power</span><i><b style="width:${(it.power - .75) / .5 * 100}%"></b></i><span>Spin</span><i><b style="width:${it.spin * 100}%"></b></i></div>`;
    } else body += `<div class="swatch" style="background:${it.c}"></div>`;
    body += `<button class="${has ? '' : 'buy'}" ${on || (!has && SAVE.money < it.price) ? 'disabled' : ''}>${on ? 'Equipped' : has ? 'Equip' : 'Buy $' + it.price}</button>`;
    d.innerHTML = body;
    if (shopTab === 'cues') cueThumb(d.querySelector('canvas'), it);
    d.querySelector('button').onclick = () => {
      if (!has) { if (SAVE.money < it.price) return; SAVE.money -= it.price; owned.push(k); SFX.coin(); } else SFX.ui();
      if (shopTab === 'cues') SAVE.cue = k; else { SAVE.cloth = k; tableDirty = true; G.balls.forEach(b => { b.dirty = true; }); }
      persist(); buildShop(); refreshMenu();
    };
    el.appendChild(d);
  });
}
// ---------- settings
function syncSettings() {
  $('sMaster').value = SET.master; $('sMusic').value = SET.music; $('sSfx').value = SET.sfx;
  $('sMute').checked = SET.mute; $('sShake').checked = SET.shake; $('sLow').checked = SET.low;
}
[['sMaster', 'master'], ['sMusic', 'music'], ['sSfx', 'sfx']].forEach(([id, k]) => $(id).addEventListener('input', e => { SET[k] = +e.target.value; persistSet(); applyAudio(); }));
$('sMute').onchange = e => { SET.mute = e.target.checked; persistSet(); applyAudio(); };
$('sShake').onchange = e => { SET.shake = e.target.checked; persistSet(); };
$('sLow').onchange = e => { SET.low = e.target.checked; persistSet(); resize(); };
let resetArm = 0;
$('sReset').onclick = () => {
  if (Date.now() - resetArm > 3000) { resetArm = Date.now(); $('sReset').textContent = 'Click again to erase money, cues and ladder'; return; }
  Object.keys(SAVE).forEach(k => delete SAVE[k]); Object.assign(SAVE, JSON.parse(JSON.stringify(DEF_SAVE))); persist();
  $('sReset').textContent = 'Progress reset'; tableDirty = true; refreshMenu();
};
// ---------- pause
function togglePause() {
  if (!inGame()) return;
  G.paused = !G.paused;
  if (G.paused) { $('pauseInfo').textContent = pauseText(); show('pause'); AU.duck = .4; INP.mode = null; spaceHeld = false; G.power = 0; G.pull = 0; powerUI(); }
  else { hideAll(); navStack = []; AU.duck = .75; }
  applyAudio();
}
function pauseText() {
  if (G.mode === 'speed') return 'Speed Pool · ' + fmtT(G.speedT + G.speedPen);
  if (G.mode === 'practice') return 'Practice';
  return (G.rules === '9' ? '9-ball' : '8-ball') + ' vs ' + G.players[1].name + ' · ' + G.frames[0] + '–' + G.frames[1];
}
$('pResume').onclick = () => { SFX.ui(); togglePause(); };
$('pRestart').onclick = () => { SFX.ui(); G.paused = false; hideAll(); navStack = []; AU.duck = .75; applyAudio(); launch(G.cfg); };
$('pSet').onclick = () => { SFX.ui(); show('settings'); };
$('pHelp').onclick = () => { SFX.ui(); show('help'); };
$('pQuit').onclick = () => { SFX.ui(); toMenu(); };
$('rMenu').onclick = () => { SFX.ui(); toMenu(); };
$('rAgain').onclick = () => { SFX.ui(); launch(G.cfg); };

// ---------- HUD
function ballIcon(id, gone) {
  const c = BALL_HEX[id], bg = id >= 9 ? `linear-gradient(180deg,#f3eee0 0 24%,${c} 24% 76%,#f3eee0 76%)` : c;
  return `<i class="bi${gone ? ' gone' : ''}" data-n="${id}" style="background:${bg}"></i>`;
}
function hudFull() {
  if (G.mode === 'demo') return;
  if (G.mode === 'speed') { const left = G.balls.filter(b => b.on && b.id !== 0).length; $('left').textContent = left + (left === 1 ? ' ball left' : ' balls left'); $('timer').textContent = fmtT(G.speedT + G.speedPen); return; }
  if (G.mode === 'practice') return;
  for (let P = 0; P < 2; P++) {
    const pl = G.players[P];
    $('n' + P).textContent = pl.name;
    const m = $('m' + P); m.textContent = pl.mono || initials(pl.name); m.style.background = pl.col || '#555';
    const g = $('g' + P);
    if (G.rules === '9') {
      if (P === G.turn) { const lo = lowestOn(); g.innerHTML = lo < 99 ? '<small>on the</small> ' + ballIcon(lo) : ''; } else g.innerHTML = '';
    } else if (!G.groups[P]) g.innerHTML = '<small>open table</small>';
    else {
      const ids = G.groups[P] === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
      const left = ids.filter(i => G.byId[i] && G.byId[i].on);
      g.innerHTML = left.length ? ids.map(i => ballIcon(i, !(G.byId[i] && G.byId[i].on))).join('') : '<small>on the</small> ' + ballIcon(8);
    }
  }
  $('sc').textContent = G.frames[0] + ' – ' + G.frames[1];
  $('race').textContent = G.raceTo > 1 ? 'Race to ' + G.raceTo : (G.rules === '9' ? '9-ball' : '8-ball');
}
function hudTurn() {
  if (G.mode === 'demo') return;
  hudFull();
  $('pl0').classList.toggle('turn', G.turn === 0); $('pl1').classList.toggle('turn', G.turn === 1);
  $('pl0').classList.remove('thinking'); $('pl1').classList.remove('thinking');
  if (G.inHand && !isAI(G.turn) && G.mode !== 'practice') toast(G.kitchen ? 'Ball in hand behind the line — drag the cue ball' : 'Ball in hand — drag the cue ball anywhere', 'good');
}
function toast(msg, cls) {
  if (G.mode === 'demo') return;
  const box = $('toast'); const d = document.createElement('div'); d.textContent = msg; if (cls) d.className = cls;
  box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 360); }, 2100);
}
let banTO = 0;
function banner(t, s) { $('banT').textContent = t; $('banS').textContent = s || ''; const b = $('banner'); b.classList.remove('hide'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(banTO); banTO = setTimeout(() => b.classList.add('hide'), 2300); }
function coachUpdate() {
  if (G.mode === 'demo' || SAVE.tut >= 3 || isAI(G.turn) || G.state !== 'aim') { coachHide(); return; }
  const c = $('coach');
  c.innerHTML = isTouch ? '<b>Drag</b> on the table to aim · <b>pull the power bar down</b> and let go to shoot'
    : '<b>Point</b> to aim · <b>hold the left button and pull back</b> · let go to shoot · <b>wheel</b> for fine aim';
  c.classList.remove('hide');
}
function coachHide() { $('coach').classList.add('hide'); }

// =====================================================================
//  LOOP
// =====================================================================
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > .05) dt = .05; if (dt < 0) dt = 0;
  update(dt);
  render(dt);
}
// test hook used for automated play-testing (harmless for players)
window.__cp = { G, SAVE, update, render, advance, SFX, Music, AU, w2s, launch, you, LADDER, LEVELS, fire: (a, s, x, y) => fire(a, s, x || 0, y || 0), simShot, newRec, powerToSpeed, toMenu, startCareer };
resize(); drawSpin(); powerUI();
toMenu();
requestAnimationFrame(frame);
})();
