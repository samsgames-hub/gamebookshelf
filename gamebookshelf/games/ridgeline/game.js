'use strict';
(function () {
// =====================================================================
//  RIDGELINE — off-road hill climbing
// =====================================================================
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const TAU = Math.PI * 2;
const isTouch = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
if (isTouch) document.body.classList.add('touch');
let errShown = false;
window.addEventListener('error', e => { if (errShown) return; errShown = true; const b = $('err'); b.textContent = 'Something went wrong: ' + (e.message || 'unknown error') + '. Reload the page to keep playing.'; b.className = ''; });
const store = {
  get(k, d) { try { const v = localStorage.getItem('ridgeline.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ridgeline.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
};
const fmt = n => Math.round(n).toLocaleString('en-US');
function hash(i, s) { let h = Math.imul((i | 0) ^ (s | 0), 2654435761); h ^= h >>> 13; h = Math.imul(h, 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function vnoise(x, s) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i, s), hash(i + 1, s), u) * 2 - 1; }
function fbm(x, s, oct) { let a = 1, f = 1, t = 0, n = 0; for (let k = 0; k < oct; k++) { t += vnoise(x * f, s + k * 131) * a; n += a; a *= .5; f *= 2.03; } return t / n; }

// ---------------------------------------------------------------- data
const REGIONS = [
  { id: 'highland', name: 'Highland Trail', desc: 'Rolling meadows, pine forest, creeks and log bridges at golden hour.', need: 0, seed: 1173, mult: 1,
    sky: ['#f7c98a', '#e7a173', '#7f8db2', '#4c5f8f'], sun: { x: .76, y: .34, c: '255,214,150', r: 90 }, night: false, weather: null,
    hills: ['#9aa0bf', '#7a8aa3', '#4e6a55'], trees: 'pine', treeCol: ['#3c5741', '#2c4532', '#1f3524'],
    top: '#6c9a37', top2: '#8fbd4f', dirt: '#6d4b2e', deep: '#3d2a1a', rock: '#8a7b68', mu: 1.0, surf: 'grass',
    amp: [4.2, 12], fq: [.024, .055], rough: .3, feats: { ramp: 3, step: 1, bridge: 2, stream: 2, mud: 2, rocks: 1 } },
  { id: 'canyon', name: 'Red Canyon', desc: 'Sandstone ledges, deep sand and long drops under a hard desert sun.', need: 1500, seed: 9041, mult: 1.35,
    sky: ['#fbe0b4', '#f0b47c', '#8ab4d8', '#4f86c2'], sun: { x: .3, y: .2, c: '255,240,200', r: 70 }, night: false, weather: null,
    hills: ['#d39a77', '#b9714c', '#8c4a30'], trees: 'cactus', treeCol: ['#6d7a45', '#566238', '#43502c'],
    top: '#c9874f', top2: '#dfa269', dirt: '#a0553a', deep: '#6b3324', rock: '#b77a55', mu: .95, surf: 'dirt',
    amp: [4.5, 15], fq: [.02, .05], rough: .38, feats: { ramp: 3, step: 4, bridge: 0, stream: 0, sand: 3, rocks: 2 } },
  { id: 'glacier', name: 'Glacier Pass', desc: 'Packed snow, sheet ice and cornice drops as the light fades.', need: 2000, seed: 5521, mult: 1.7,
    sky: ['#e5b9a8', '#9b8fb4', '#4b5a8a', '#1f2a4f'], sun: { x: .82, y: .52, c: '255,190,170', r: 60 }, night: false, weather: 'snow', aurora: true,
    hills: ['#c3cde6', '#8fa1c4', '#5f7398'], trees: 'snowpine', treeCol: ['#45576a', '#34475a', '#263849'],
    top: '#e8eef6', top2: '#ffffff', dirt: '#6c7684', deep: '#3e4653', rock: '#8a95a5', mu: .62, surf: 'snow',
    amp: [4.5, 14], fq: [.022, .052], rough: .32, feats: { ramp: 3, step: 2, bridge: 1, stream: 0, ice: 3, rocks: 1 } },
  { id: 'quarry', name: 'Night Quarry', desc: 'Loose gravel, sheer pit walls and rain, lit only by your headlights.', need: 2500, seed: 7777, mult: 2.1,
    sky: ['#2b2f3a', '#1b1f2a', '#10131b', '#080a10'], sun: { x: .2, y: .18, c: '210,220,255', r: 26, moon: true }, night: true, weather: 'rain',
    hills: ['#272c38', '#1d212b', '#161920'], trees: 'rig', treeCol: ['#1a1d24', '#15181e', '#101217'],
    top: '#8a8579', top2: '#a39e90', dirt: '#5d574e', deep: '#36322c', rock: '#77716a', mu: .82, surf: 'gravel',
    amp: [4.6, 16], fq: [.022, .056], rough: .4, feats: { ramp: 4, step: 3, bridge: 1, stream: 1, mud: 2, rocks: 2 } }
];
const SURF = { // mu factor, drag, particle color
  grass: { mu: 1, drag: 0, col: '#6d5434' }, dirt: { mu: 1, drag: 0, col: '#b4774c' }, snow: { mu: 1, drag: .2, col: '#f4f7fb' }, gravel: { mu: 1, drag: .05, col: '#9a958a' },
  mud: { mu: .55, drag: 1.4, col: '#4a3624' }, sand: { mu: .62, drag: 1.6, col: '#e0b07a' }, ice: { mu: .3, drag: 0, col: '#d8ecff' },
  wood: { mu: .9, drag: 0, col: '#7a5a3a' }, water: { mu: .75, drag: 2.2, col: '#bfe0ff' }, rock: { mu: 1.1, drag: 0, col: '#9a8a78' }
};
const SURF_IDS = ['base', 'mud', 'sand', 'ice', 'wood', 'water', 'rock'];
const SURF_NAMES = ['', 'mud', 'sand', 'ice', 'wood', 'water', 'rock'];
const CQ = { d: 0, px: 0, py: 0, nx: 0, ny: 1 };
const VEH = {
  scout: { name: 'Scout 4x4', price: 0, desc: 'A tough little pickup. Four-wheel drive, a sensible tank and a snorkel for the creeks.',
    mass: 1500, len: 4.6, hgt: 1.6, wm: 80, R: .43, anchors: [[-1.42, -.28], [1.4, -.28]], rest: .5, travel: .3, k: 52000, c: 5200,
    torque: 1550, vmax: 23, drive: [1, 1], grip: 1, fuel: 1, air: 3600, col: '#3f5d3b', col2: '#d9cfb8',
    pts: [[-2.35, -.32], [2.32, -.28], [2.4, .08], [-2.36, .52], [0, -.42], [-1.45, -.38], [1.35, -.36], [2.15, .45]],
    roof: [[.62, 1.24], [-.46, 1.27], [.1, 1.3]], exhaust: [-2.3, -.25], lamp: [2.3, .28], tail: [-2.34, .32] },
  buggy: { name: 'Trail Buggy', price: 6000, desc: 'Light tube-frame racer with long-travel shocks. Fast and airborne, rear-wheel drive.',
    mass: 950, len: 4.2, hgt: 1.5, wm: 60, R: .47, anchors: [[-1.38, -.18], [1.42, -.18]], rest: .62, travel: .45, k: 30000, c: 3000,
    torque: 1900, vmax: 31, drive: [1, 0], grip: 1.05, fuel: .8, air: 2600, col: '#d9662a', col2: '#262626',
    pts: [[-2.05, -.22], [2.12, -.2], [2.2, .2], [-2.1, .55], [0, -.3], [1.2, -.26], [-1.3, -.25]],
    roof: [[-.55, 1.28], [.45, 1.26], [-.05, 1.3]], exhaust: [-2.05, .25], lamp: [2.15, .3], tail: [-2.08, .4] },
  crawler: { name: 'Rock Crawler', price: 14000, desc: 'Short, heavy and geared to climb walls. Huge tires, enormous torque, no top speed.',
    mass: 1750, len: 3.8, hgt: 1.8, wm: 120, R: .62, anchors: [[-1.12, -.12], [1.12, -.12]], rest: .55, travel: .45, k: 48000, c: 5600,
    torque: 3300, vmax: 15.5, drive: [1, 1], grip: 1.28, fuel: 1.05, air: 4200, col: '#e2b625', col2: '#1d1d1d',
    pts: [[-1.85, -.15], [1.9, -.12], [1.95, .35], [-1.9, .6], [0, -.3], [.9, -.2], [-.9, -.2]],
    roof: [[-.5, 1.42], [.55, 1.4], [0, 1.45]], exhaust: [-1.8, .1], lamp: [1.95, .5], tail: [-1.9, .45] },
  expedition: { name: 'Expedition Truck', price: 28000, desc: 'A heavy overlander with a camper box and a giant fuel tank. Built to go the distance.',
    mass: 3200, len: 6, hgt: 2.4, wm: 150, R: .52, anchors: [[-1.95, -.36], [1.8, -.36]], rest: .58, travel: .34, k: 105000, c: 11500,
    torque: 3900, vmax: 22, drive: [1, 1], grip: 1.02, fuel: 1.9, air: 7500, col: '#b9a57d', col2: '#e9e4d8',
    pts: [[-3.05, -.36], [2.55, -.32], [2.6, .2], [-3.05, 1.0], [0, -.48], [-2, -.44], [1.75, -.42], [2.4, .7]],
    roof: [[-2.9, 2.0], [-.5, 2.0], [1.05, 1.45], [-1.7, 2.02]], exhaust: [-.4, -.4], lamp: [2.55, .38], tail: [-3.06, .3] }
};
const VEH_ORDER = ['scout', 'buggy', 'crawler', 'expedition'];
const UPS = [
  { id: 'eng', name: 'Engine', sub: 'more torque and top speed', base: 290 },
  { id: 'sus', name: 'Suspension', sub: 'stiffer, steadier, more travel', base: 260 },
  { id: 'tire', name: 'Tires', sub: 'more grip on every surface', base: 270 },
  { id: 'tank', name: 'Fuel tank', sub: 'drive further between cans', base: 310 }
];
const MAXLV = 10;
const upCost = (u, lv) => Math.round(u.base * Math.pow(1.52, lv) / 10) * 10;

// ---------------------------------------------------------------- save
const DEF_SET = { master: .8, music: .45, sfx: .85, mute: false, shake: true, low: false, mph: false };
const SET = Object.assign({}, DEF_SET, store.get('settings', {}));
const DEF_SAVE = { cash: 0, owned: ['scout'], veh: 'scout', region: 'highland', best: {}, up: {}, tut: 0, total: 0, runs: 0 };
const SAVE = Object.assign({}, DEF_SAVE, store.get('save', {}));
VEH_ORDER.forEach(v => { SAVE.up[v] = Object.assign({ eng: 0, sus: 0, tire: 0, tank: 0 }, SAVE.up[v] || {}); });
if (!VEH[SAVE.veh]) SAVE.veh = 'scout';
if (!REGIONS.find(r => r.id === SAVE.region)) SAVE.region = 'highland';
const persist = () => store.set('save', SAVE), persistSet = () => store.set('settings', SET);
const regionById = id => REGIONS.find(r => r.id === id);
function regionUnlocked(i) { if (i === 0) return true; const prev = REGIONS[i - 1]; return (SAVE.best[prev.id] || 0) >= REGIONS[i].need; }

// =====================================================================
//  AUDIO
// =====================================================================
const AU = { ctx: null, duck: 1, demo: false };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  let c; try { c = new AC(); } catch (e) { return; }
  AU.ctx = c;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .25;
  AU.master = c.createGain(); comp.connect(AU.master); AU.master.connect(c.destination);
  AU.sfx = c.createGain(); AU.sfx.connect(comp);
  AU.mus = c.createGain(); AU.mus.connect(comp);
  AU.verb = c.createConvolver(); AU.verb.buffer = impulse(c, 2.2, 3); const vo = c.createGain(); vo.gain.value = .25; AU.verb.connect(vo); vo.connect(comp);
  AU.sv = c.createGain(); AU.sv.gain.value = .25; AU.sv.connect(AU.verb);
  AU.mv = c.createGain(); AU.mv.gain.value = .35; AU.mv.connect(AU.verb);
  const len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; AU.noise = nb;
  AU.dist = c.createWaveShaper(); AU.dist.curve = shaper(6); AU.dist.oversample = '2x';
  buildEngine(); applyAudio(); Music.start();
}
function impulse(c, dur, decay) { const len = Math.floor(c.sampleRate * dur), b = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
function shaper(k) { const n = 1024, cu = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; cu[i] = (1 + k) * x / (1 + k * Math.abs(x)); } return cu; }
function applyAudio() {
  if (!AU.ctx) return; const t = AU.ctx.currentTime;
  AU.master.gain.setTargetAtTime(SET.mute ? 0 : SET.master, t, .03);
  AU.sfx.gain.setTargetAtTime(SET.sfx * (AU.demo ? .3 : 1), t, .1);
  AU.mus.gain.setTargetAtTime(SET.music * .85 * AU.duck, t, .3);
}
function envG(g, t, a, peak, dec) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); }
function route(n, pan, verb, bus) { const c = AU.ctx; let o = n; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); n.connect(p); o = p; } o.connect(bus || AU.sfx); if (verb) o.connect(bus === AU.mus ? AU.mv : AU.sv); }
function tone(type, f, t, a, peak, dec, f2, bus, verb = true, pan = 0) { const c = AU.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dec); o.connect(g); envG(g, t, a, peak, dec); route(g, pan, verb, bus); o.start(t); o.stop(t + a + dec + .05); }
function noiseB(t, dur, type, f, q, peak, a, bus, verb = true, pan = 0) { const c = AU.ctx, s = c.createBufferSource(); s.buffer = AU.noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); s.connect(fl); fl.connect(g); envG(g, t, a, peak, dur); route(g, pan, verb, bus); s.start(t, Math.random() * 1.4); s.stop(t + a + dur + .05); }
// ---- continuous engine + tyre sound
function buildEngine() {
  const c = AU.ctx, E = AU.eng = {};
  E.o1 = c.createOscillator(); E.o1.type = 'sawtooth';
  E.o2 = c.createOscillator(); E.o2.type = 'square';
  E.o3 = c.createOscillator(); E.o3.type = 'sawtooth';
  E.mix = c.createGain(); E.mix.gain.value = .5;
  const g2 = c.createGain(), g3 = c.createGain(); g2.gain.value = .55; g3.gain.value = .3;
  E.o1.connect(E.mix); E.o2.connect(g2); g2.connect(E.mix); E.o3.connect(g3); g3.connect(E.mix);
  E.ws = c.createWaveShaper(); E.ws.curve = shaper(4);
  E.lp = c.createBiquadFilter(); E.lp.type = 'lowpass'; E.lp.frequency.value = 600; E.lp.Q.value = 1.4;
  E.g = c.createGain(); E.g.gain.value = 0;
  E.mix.connect(E.ws); E.ws.connect(E.lp); E.lp.connect(E.g); E.g.connect(AU.sfx);
  // intake rasp
  E.ns = c.createBufferSource(); E.ns.buffer = AU.noise; E.ns.loop = true;
  E.nf = c.createBiquadFilter(); E.nf.type = 'bandpass'; E.nf.frequency.value = 300; E.nf.Q.value = 2;
  E.ng = c.createGain(); E.ng.gain.value = 0; E.ns.connect(E.nf); E.nf.connect(E.ng); E.ng.connect(AU.sfx);
  // tyres on the ground
  E.ts = c.createBufferSource(); E.ts.buffer = AU.noise; E.ts.loop = true;
  E.tf = c.createBiquadFilter(); E.tf.type = 'bandpass'; E.tf.frequency.value = 700; E.tf.Q.value = .6;
  E.tg = c.createGain(); E.tg.gain.value = 0; E.ts.connect(E.tf); E.tf.connect(E.tg); E.tg.connect(AU.sfx);
  // rain / wind ambience
  E.as = c.createBufferSource(); E.as.buffer = AU.noise; E.as.loop = true;
  E.af = c.createBiquadFilter(); E.af.type = 'highpass'; E.af.frequency.value = 1500;
  E.ag = c.createGain(); E.ag.gain.value = 0; E.as.connect(E.af); E.af.connect(E.ag); E.ag.connect(AU.sfx);
  [E.o1, E.o2, E.o3, E.ns, E.ts, E.as].forEach(o => o.start());
  E.rpm = 0;
}
function engineSound(on, rpm, thr, tyre, tyreF, amb, ambF) {
  const E = AU.eng; if (!E) return; const t = AU.ctx.currentTime;
  const f = 24 + rpm * 92;
  E.o1.frequency.setTargetAtTime(f, t, .03); E.o2.frequency.setTargetAtTime(f * .5, t, .03); E.o3.frequency.setTargetAtTime(f * 1.503, t, .03);
  E.lp.frequency.setTargetAtTime(260 + thr * 1500 + rpm * 900, t, .05);
  E.g.gain.setTargetAtTime(on ? .07 + thr * .09 + rpm * .05 : 0, t, .06);
  E.nf.frequency.setTargetAtTime(f * 3.2, t, .05); E.ng.gain.setTargetAtTime(on ? thr * .05 * (.4 + rpm) : 0, t, .06);
  E.tg.gain.setTargetAtTime(SET.low ? tyre * .5 : tyre, t, .08); E.tf.frequency.setTargetAtTime(tyreF, t, .1);
  E.ag.gain.setTargetAtTime(amb, t, .5); E.af.frequency.setTargetAtTime(ambF, t, .5);
}
const SFX = {
  ok() { return !!AU.ctx; },
  ui() { if (!this.ok()) return; const t = AU.ctx.currentTime + .005; tone('triangle', 880, t, .002, .06, .06, 0, AU.sfx, false); tone('sine', 1320, t + .02, .002, .03, .05, 0, AU.sfx, false); },
  thump(s) { if (!this.ok()) return; const t = AU.ctx.currentTime + .005, v = clamp((s - 28) / 110, .08, 1); tone('sine', 85, t, .004, .45 * v, .2, 40); noiseB(t, .12, 'lowpass', 500, .7, .3 * v, .003); },
  scrape(s) { if (!this.ok()) return; const t = AU.ctx.currentTime + .005, v = clamp(s / 8, .05, .8); noiseB(t, .18, 'bandpass', rand(2200, 3400), 3, .25 * v, .01); tone('sawtooth', rand(500, 800), t, .01, .03 * v, .15, 300); },
  crash() { if (!this.ok()) return; const t = AU.ctx.currentTime + .005; noiseB(t, .6, 'lowpass', 1800, .5, .9, .004); tone('sine', 70, t, .005, .8, .6, 30); noiseB(t + .02, .35, 'bandpass', 3200, 1.5, .4, .002); for (let i = 0; i < 6; i++) tone('sine', rand(2500, 5200), t + .05 + i * .04 + Math.random() * .03, .001, .08, .12); },
  fuel() { if (!this.ok()) return; const t = AU.ctx.currentTime + .01; [420, 360, 300].forEach((f, i) => tone('sine', f, t + i * .07, .005, .22, .1, f * .6)); tone('triangle', 660, t + .24, .005, .12, .4); tone('triangle', 990, t + .3, .005, .1, .5); },
  cash() { if (!this.ok()) return; const t = AU.ctx.currentTime + .01; tone('triangle', 1318, t, .002, .12, .18); tone('triangle', 1976, t + .06, .002, .1, .35); },
  camp() { if (!this.ok()) return; const t = AU.ctx.currentTime + .01; [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, t + i * .09, .005, .14, .9)); },
  bonus() { if (!this.ok()) return; const t = AU.ctx.currentTime + .01; tone('sawtooth', 300, t, .02, .05, .3, 900, AU.sfx, true); tone('triangle', 880, t + .1, .004, .1, .3); },
  splash() { if (!this.ok()) return; const t = AU.ctx.currentTime + .01; noiseB(t, .45, 'bandpass', 900, .6, .4, .02); noiseB(t + .05, .3, 'highpass', 3000, .5, .18, .02); },
  warn() { if (!this.ok()) return; const t = AU.ctx.currentTime + .01; tone('square', 880, t, .003, .05, .08, 0, AU.sfx, false); tone('square', 880, t + .14, .003, .05, .08, 0, AU.sfx, false); },
  start() { if (!this.ok()) return; const t = AU.ctx.currentTime + .01; for (let i = 0; i < 5; i++) tone('sawtooth', 38 + i * 2, t + i * .09, .01, .07, .07, 0, AU.sfx, false); tone('sawtooth', 55, t + .48, .02, .12, .3, 90, AU.sfx, false); },
  shift() { if (!this.ok()) return; const t = AU.ctx.currentTime + .005; noiseB(t, .05, 'bandpass', 1500, 2, .05, .002); },
  range() { if (!this.ok()) return; const t = AU.ctx.currentTime + .005; tone('square', 140, t, .003, .06, .07, 0, AU.sfx, false); noiseB(t + .03, .05, 'bandpass', 900, 3, .1, .002); },
  lose() { if (!this.ok()) return; const t = AU.ctx.currentTime + .05; [330, 294, 247].forEach((f, i) => tone('triangle', f, t + i * .18, .01, .12, .5)); },
  best() { if (!this.ok()) return; const t = AU.ctx.currentTime + .05; [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, t + i * .1, .005, .14, .7)); }
};
// ---------------------------------------------------------------- music: desert rock
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const Music = {
  on: false, step: 0, next: 0, bpm: 100, timer: 0,
  bars: [40, 36, 43, 38, 40, 36, 38, 38], // E C G D E C D D
  lead: [[64, 0], [67, 2], [69, 3], [71, 4], [69, 6], [67, 7], [64, 10], [62, 12], [64, 14]],
  start() { if (this.on || !AU.ctx) return; this.on = true; this.next = AU.ctx.currentTime + .2; this.timer = setInterval(() => this.tick(), 40); },
  tick() { const c = AU.ctx; if (!c || c.state !== 'running') return; const e8 = 60 / this.bpm / 2; while (this.next < c.currentTime + .2) { this.play(this.step, this.next, e8); this.next += e8; this.step = (this.step + 1) % 128; } },
  play(s, t, e8) {
    const B = AU.mus, bar = (s >> 3) % 8, e = s & 7, root = this.bars[bar], loop = s >> 6;
    // drums
    if (e === 0 || e === 3 || e === 4) { tone('sine', 120, t, .003, .5, .16, 42, B, false); noiseB(t, .02, 'lowpass', 1500, .5, .1, .001, B, false); }
    if (e === 2 || e === 6) { noiseB(t, .16, 'bandpass', 1900, .8, .2, .002, B, true); tone('triangle', 190, t, .002, .12, .08, 140, B, false); }
    noiseB(t, e === 7 && bar % 2 ? .18 : .035, 'highpass', 7500, .7, e % 2 ? .03 : .05, .001, B, false, .2);
    if (s % 64 === 0) noiseB(t, 1.2, 'highpass', 5000, .4, .08, .003, B, true);
    // bass: driving eighths
    const bn = root - 12 + (e === 6 ? 7 : e === 7 ? 12 : 0);
    { const o = AU.ctx.createOscillator(), g = AU.ctx.createGain(), lp = AU.ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(bn); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 3; o.connect(lp); lp.connect(g); envG(g, t, .005, .2, e8 * .85); route(g, 0, false, B); o.start(t); o.stop(t + e8); }
    // rhythm guitar: power chord stabs
    if (e === 0 || e === 3 || e === 4 || e === 6) {
      const long = e === 0 || e === 4, dur = long ? e8 * 1.7 : e8 * .6;
      const lp = AU.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2000; const g = AU.ctx.createGain();
      const ws = AU.ctx.createWaveShaper(); ws.curve = AU.dist.curve; ws.connect(lp); lp.connect(g); envG(g, t, .004, long ? .05 : .035, dur); route(g, 0, true, B);
      [root, root + 7, root + 12].forEach((n, k) => { const o = AU.ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n + 12) * (1 + (k - 1) * .002); const og = AU.ctx.createGain(); og.gain.value = .35; o.connect(og); og.connect(ws); o.start(t); o.stop(t + dur + .05); });
    }
    // slide lead, every other loop, second half
    if (loop % 2 === 1 && bar >= 4) {
      const pos = (bar - 4) * 8 + e;
      for (const [n, at] of this.lead) if (at * 2 === pos) {
        const o = AU.ctx.createOscillator(), vib = AU.ctx.createOscillator(), vg = AU.ctx.createGain(), g = AU.ctx.createGain();
        o.type = 'triangle'; o.frequency.setValueAtTime(mtof(n - 1), t); o.frequency.exponentialRampToValueAtTime(mtof(n), t + .08);
        vib.frequency.value = 5.5; vg.gain.value = mtof(n) * .012; vib.connect(vg); vg.connect(o.frequency);
        o.connect(g); envG(g, t, .02, .05, e8 * 3.2); route(g, .15, true, B); o.start(t); vib.start(t); o.stop(t + e8 * 3.5); vib.stop(t + e8 * 3.5);
      }
    }
  }
};

// =====================================================================
//  TERRAIN
// =====================================================================
const DX = .5, OFF = 60; // sample i is at x = (i - OFF) * DX
class Terrain {
  constructor(reg) {
    this.reg = reg; this.h = []; this.v = []; this.s = [];
    this.feats = []; this.bridges = []; this.waters = []; this.fuel = []; this.caches = []; this.camps = []; this.deco = [];
    this.plan();
    this.n = 0; this.gen(400);
  }
  plan() {
    const R = this.reg, r = rng(R.seed), F = R.feats, kinds = [];
    for (const k in F) for (let i = 0; i < F[k]; i++) kinds.push(k);
    let x = 60;
    while (x < 40000) {
      const d = clamp(x / 3200, 0, 1);
      const nextCamp = Math.ceil(x / 1000) * 1000;
      const k = kinds[Math.floor(r() * kinds.length)];
      let len = 0;
      if (Math.abs(x - nextCamp) < 40 || Math.abs(x - (nextCamp - 1000)) < 30) { x += 45; continue; }
      if (k === 'ramp') { len = 5 + r() * 5; this.feats.push({ t: 'ramp', x, len, h: 1 + r() * (1 + d * 1.6) }); len += 8; }
      else if (k === 'step') { const up = r() < .55, hh = up ? .45 + r() * (.3 + d * .35) : -(.5 + r() * (.5 + d * 1.2)); this.feats.push({ t: 'step', x, w: .7 + r() * .8 - d * .2, h: hh }); len = 4; }
      else if (k === 'rocks') { len = 12 + r() * 14; this.feats.push({ t: 'rocks', x, len, a: .25 + d * .45, s: Math.floor(r() * 1e6) }); }
      else if (k === 'bridge') { len = 14 + r() * 12 + d * 8; this.feats.push({ t: 'bridge', x, len, depth: 4 + r() * 4 }); }
      else if (k === 'stream') { len = 8 + r() * 6; this.feats.push({ t: 'stream', x, len, depth: .55 + r() * .25 }); }
      else { len = 14 + r() * 22 + d * 15; this.feats.push({ t: 'zone', x, len, surf: SURF_IDS.indexOf(k) }); }
      x += len + lerp(55, 22, d) + r() * lerp(60, 30, d);
    }
    for (let c = 1; c <= 40; c++) this.camps.push({ x: c * 1000, got: false });
    // props
    let fx = 140; while (fx < 40000) { this.fuel.push({ x: fx, got: false }); fx += 130 + fx * .06 + r() * 35; }
    let cx = 70 + r() * 60; while (cx < 40000) { this.caches.push({ x: cx, got: false, val: 25 + Math.floor(cx / 400) * 15 }); cx += 85 + r() * 110; }
    const clearOf = x => !this.feats.some(f => (f.t === 'bridge' || f.t === 'stream' || f.t === 'ramp') && x > f.x - 3 && x < f.x + (f.len || 0) + 3);
    const shift = arr => arr.forEach(p => { let k = 0; while (!clearOf(p.x) && k++ < 40) p.x += 3; });
    shift(this.fuel); shift(this.caches);
  }
  base(x) {
    const R = this.reg, d = clamp(x / 3200, 0, 1), A = lerp(R.amp[0], R.amp[1], d) * (1 + Math.max(0, x - 3200) / 16000);
    const f1 = R.fq[0], f2 = R.fq[1];
    let y = A * .62 * fbm(x * f1, R.seed, 3) + A * .38 * fbm(x * f2, R.seed + 77, 2) + R.rough * (1 + d) * fbm(x * .4, R.seed + 501, 2);
    y += x * .012; // the trail slowly climbs
    return y * smooth((x - 8) / 45);
  }
  gen(toX) {
    const R = this.reg;
    while ((this.n - OFF) * DX < toX) {
      const i = this.n, x = (i - OFF) * DX;
      let y = this.base(x), sv = 0, vis = null;
      if (x < 0) y = this.base(0) + (-x) * (-x) * .08;
      let acc = 0;
      for (const f of this.feats) {
        if (f.x > x + 40) break;
        if (f.t === 'step') acc += f.h * smooth((x - f.x) / f.w);
        else if (f.t === 'ramp' && x >= f.x && x <= f.x + f.len + 2.5) { const u = x - f.x; y += u <= f.len ? f.h * Math.pow(u / f.len, 1.3) : f.h * (1 - (u - f.len) / 2.5); }
        else if (f.t === 'rocks' && x >= f.x && x <= f.x + f.len) { const u = (x - f.x) / f.len; y += f.a * Math.sin(u * Math.PI) * (Math.abs(vnoise(x * 1.7, f.s)) * 1.2 + .3 * vnoise(x * 3.1, f.s + 9)); sv = 6; }
        else if (f.t === 'zone' && x >= f.x && x <= f.x + f.len) sv = f.surf;
        else if (f.t === 'stream' && x >= f.x && x <= f.x + f.len) { const u = (x - f.x) / f.len; y -= f.depth * Math.pow(Math.sin(u * Math.PI), .8); sv = 5; }
        else if (f.t === 'bridge' && x >= f.x && x <= f.x + f.len) { sv = 4; }
      }
      y += acc;
      // camps are flat
      for (const c of this.camps) { if (Math.abs(x - c.x) < 30) { if (c.h === undefined) c.h = this.baseAt(c.x); y = lerp(y, c.h, smooth(1 - (Math.abs(x - c.x) - 12) / 18)); break; } if (c.x > x + 30) break; }
      this.h[i] = y; this.s[i] = sv; this.v[i] = y;
      this.n++;
    }
    // bridges: straight decks over ravines (collision) with deep visual ground beneath
    for (const f of this.feats) {
      if (f.t !== 'bridge' || f.done || (f.x + f.len - (-OFF * DX)) / DX + 2 > this.n) continue;
      const i0 = Math.round(f.x / DX) + OFF, i1 = Math.round((f.x + f.len) / DX) + OFF, h0 = this.h[i0], h1 = this.h[i1];
      for (let i = i0; i <= i1; i++) { const u = (i - i0) / (i1 - i0), deck = lerp(h0, h1, u); this.v[i] = Math.min(this.h[i], deck) - f.depth * Math.pow(Math.sin(u * Math.PI), .6); this.h[i] = deck; this.s[i] = 4; }
      f.h0 = h0; f.h1 = h1; f.i0 = i0; f.i1 = i1; f.done = true; this.bridges.push(f);
    }
    for (const f of this.feats) {
      if (f.t !== 'stream' || f.done || (f.x + f.len) / DX + OFF + 2 > this.n) continue;
      const i0 = Math.round(f.x / DX) + OFF, i1 = Math.round((f.x + f.len) / DX) + OFF;
      f.level = Math.min(this.h[i0], this.h[i1]) - .12; f.done = true; this.waters.push(f);
    }
  }
  baseAt(x) { // terrain before camp flattening (used once per camp)
    let y = this.base(x), acc = 0;
    for (const f of this.feats) { if (f.x > x) break; if (f.t === 'step') acc += f.h * smooth((x - f.x) / f.w); }
    return y + acc;
  }
  ensure(x) { if ((this.n - OFF) * DX < x + 6) this.gen(x + 320); }
  idx(x) { return x / DX + OFF; }
  height(x) { this.ensure(x); let f = this.idx(x); if (f < 0) f = 0; const i = Math.floor(f), t = f - i; return this.h[i] + (this.h[i + 1] - this.h[i]) * t; }
  vis(x) { this.ensure(x); let f = this.idx(x); if (f < 0) f = 0; const i = Math.floor(f), t = f - i; return this.v[i] + (this.v[i + 1] - this.v[i]) * t; }
  surfAt(x) { this.ensure(x); const i = clamp(Math.round(this.idx(x)), 0, this.n - 1), s = this.s[i]; return s === 0 ? this.reg.surf : SURF_NAMES[s]; }
  // closest point on the polyline to a circle centre
  closest(cx, cy, r) {
    this.ensure(cx + r + 2);
    const i0 = Math.max(0, Math.floor(this.idx(cx - r - .6))), i1 = Math.min(this.n - 2, Math.ceil(this.idx(cx + r + .6)));
    let best = 1e9, bx = 0, by = 0, bnx = 0, bny = 1;
    for (let i = i0; i <= i1; i++) {
      const ax = (i - OFF) * DX, ay = this.h[i], ex = DX, ey = this.h[i + 1] - ay;
      let t = ((cx - ax) * ex + (cy - ay) * ey) / (ex * ex + ey * ey); t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + ex * t, qy = ay + ey * t, dx = cx - qx, dy = cy - qy, d2 = dx * dx + dy * dy;
      if (d2 < best) { best = d2; bx = qx; by = qy; const l = Math.hypot(ex, ey); bnx = -ey / l; bny = ex / l; }
    }
    const d = Math.sqrt(best);
    const below = cy < this.height(cx);
    let nx, ny;
    if (below || d < 1e-6) { nx = bnx; ny = bny; }
    else { nx = (cx - bx) / d; ny = (cy - by) / d; }
    CQ.d = below ? -d : d; CQ.px = bx; CQ.py = by; CQ.nx = nx; CQ.ny = ny; return CQ;
  }
  normalAt(x) { const a = this.height(x - .3), b = this.height(x + .3), l = Math.hypot(.6, b - a); return [-(b - a) / l, .6 / l]; }
}
const TERRAINS = {};
const terrainFor = reg => (TERRAINS[reg.id] = TERRAINS[reg.id] || new Terrain(reg));

// =====================================================================
//  PHYSICS — rigid chassis, sprung wheel bodies, sequential impulses
// =====================================================================
const GRAV = 9.81, PDT = 1 / 240, ITERS = 10, BETA = .22, SLOP = .004;
function body(m, I) { return { x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0, m, im: 1 / m, I, iI: 1 / I }; }
function buildVehicle(id, T, x0, stock) {
  const d = VEH[id], up = stock ? { eng: 0, sus: 0, tire: 0, tank: 0 } : SAVE.up[id];
  const ch = body(d.mass, d.mass * (d.len * d.len + d.hgt * d.hgt) / 12 * .85);
  const gy = T.height(x0);
  ch.x = x0; ch.y = gy + d.R + d.rest + .3 - d.anchors[0][1];
  const V = {
    id, d, ch, wh: [], spin: [0, 0], cont: [null, null], comp: [0, 0],
    k: d.k * (1 + .07 * up.sus), c: d.c * (1 + .1 * up.sus), travel: d.travel * (1 + .05 * up.sus), rest: d.rest,
    torque: d.torque * (1 + .12 * up.eng), vmax: d.vmax * (1 + .04 * up.eng), grip: d.grip * (1 + .055 * up.tire),
    fuelMax: 100 * d.fuel * (1 + .17 * up.tank), air: d.air * (1 + .05 * up.sus), stable: .4 + up.sus * .06
  };
  V.fuel = V.fuelMax;
  d.anchors.forEach(an => {
    const w = body(d.wm, .62 * d.wm * d.R * d.R);
    w.x = ch.x + an[0]; w.y = ch.y + an[1] - d.rest; V.wh.push(w);
  });
  return V;
}
const lw = (b, lx, ly) => { const c = Math.cos(b.a), s = Math.sin(b.a); return [b.x + c * lx - s * ly, b.y + s * lx + c * ly]; };
function applyAt(b, ix, iy, rx, ry) { b.vx += ix * b.im; b.vy += iy * b.im; b.w += (rx * iy - ry * ix) * b.iI; }
function physStep(V, T, inp, dt, ev) {
  const ch = V.ch, W = V.wh, d = V.d;
  const ca = Math.cos(ch.a), sa = Math.sin(ch.a), tx = ca, ty = sa, nx = sa, ny = -ca;
  ch.vy -= GRAV * dt; W[0].vy -= GRAV * dt; W[1].vy -= GRAV * dt;
  // aero drag
  const sp = Math.hypot(ch.vx, ch.vy), drag = .9 * sp * dt * ch.im;
  ch.vx -= ch.vx * drag; ch.vy -= ch.vy * drag;
  // suspension (spring + damper) and joint geometry
  const J = V._j || (V._j = [{}, {}]);
  for (let i = 0; i < 2; i++) {
    const w = W[i], an = d.anchors[i], j = J[i];
    const px = ch.x + ca * an[0] - sa * an[1], py = ch.y + sa * an[0] + ca * an[1];
    const dx = w.x - px, dy = w.y - py;
    j.ext = dx * nx + dy * ny; j.perr = dx * tx + dy * ty;
    j.rcx = w.x - ch.x; j.rcy = w.y - ch.y; j.jl = 0;
    const vpx = ch.vx - ch.w * j.rcy, vpy = ch.vy + ch.w * j.rcx;
    const rate = (w.vx - vpx) * nx + (w.vy - vpy) * ny;
    const F = -V.k * (j.ext - V.rest) - V.c * rate;
    const imp = F * dt;
    w.vx += imp * nx * w.im; w.vy += imp * ny * w.im;
    applyAt(ch, -imp * nx, -imp * ny, j.rcx, j.rcy);
    V.comp[i] = clamp((V.rest - j.ext) / V.travel, -1, 1);
  }
  // contacts (detected from positions before solving)
  const C = V._c || (V._c = []); C.length = 0;
  const pool = V._p || (V._p = Array.from({ length: 40 }, () => ({}))); let pi = 0;
  const mk = (b, wheel, nx_, ny_, rx, ry, pen, mu, surf, chassis) => { const c = pool[pi++] || {}; c.b = b; c.wheel = wheel; c.nx = nx_; c.ny = ny_; c.rx = rx; c.ry = ry; c.pen = pen; c.mu = mu; c.jn = 0; c.jt = 0; c.surf = surf; c.chassis = chassis; return c; };
  let grounded = 0;
  for (let i = 0; i < 2; i++) {
    const w = W[i], q = T.closest(w.x, w.y, d.R);
    const pen = d.R - q.d;
    V.cont[i] = null;
    if (pen > -.01) {
      const surf = T.surfAt(w.x), S = SURF[surf];
      const c = mk(w, i, q.nx, q.ny, -q.nx * d.R, -q.ny * d.R, pen, V.grip * T.reg.mu * S.mu, surf, false);
      if (pen > 0) { C.push(c); grounded++; V.cont[i] = c; }
    }
  }
  // drive, brakes, engine braking
  const fwd = ch.vx * tx + ch.vy * ty;
  const low = inp.low, Tq = V.torque * (low ? 2.05 : 1) * (V.fuel > 0 ? 1 : 0), vmax = V.vmax * (low ? .45 : 1);
  let thr = 0;
  for (let i = 0; i < 2; i++) {
    const w = W[i];
    const rel = w.w - ch.w, surfV = -rel * d.R;
    let T_ = 0;
    if (inp.gas && d.drive[i]) {
      const fall = clamp(1 - Math.pow(Math.max(0, surfV) / vmax, 2), 0, 1);
      T_ = -Tq * fall; thr = 1;
    } else if (inp.brake) {
      if (fwd > .9 || (!d.drive[i])) {
        const max = 5200 * dt * w.iI, dv = -rel;
        const chg = clamp(dv, -max, max);
        T_ = chg * w.I / dt;
      } else if (d.drive[i]) { const fall = clamp(1 - Math.pow(Math.max(0, -surfV) / 7, 2), 0, 1); T_ = Tq * .7 * fall; thr = .7; }
    } else {
      T_ = -rel * w.I * 1.6; // engine braking / rolling resistance
    }
    w.w += T_ * dt * w.iI; ch.w -= T_ * dt * ch.iI;
    // soft surfaces bog the wheels down
    if (V.cont[i]) { const S = SURF[V.cont[i].surf]; if (S.drag) { w.w *= 1 - S.drag * .35 * dt; w.vx *= 1 - S.drag * .25 * dt; } }
  }
  V.thr = thr;
  // air control: gas tips the nose up, brake tips it down
  const airborne = grounded === 0;
  if (airborne) { const dir = (inp.gas ? 1 : 0) - (inp.brake ? 1 : 0); ch.w += dir * V.air * dt * ch.iI; ch.w *= 1 - .25 * dt; }
  else { // a little help staying on four wheels (tyre scrub & driver weight)
    ch.w *= 1 - V.stable * .6 * dt;
  }
  // chassis points against the ground
  let crash = false, scrape = 0;
  const chk = (pts, roof) => {
    for (const p of pts) {
      const wx = ch.x + ca * p[0] - sa * p[1], wy = ch.y + sa * p[0] + ca * p[1];
      const h = T.height(wx);
      if (wy < h) {
        if (roof) { crash = true; }
        const [gnx, gny] = T.normalAt(wx);
        const pen = (h - wy) * gny;
        C.push(mk(ch, -1, gnx, gny, wx - ch.x, wy - ch.y, pen, .55, null, true));
        scrape = Math.max(scrape, Math.abs(fwd));
      }
    }
  };
  chk(d.pts, false); chk(d.roof, true);
  // solve
  for (let it = 0; it < ITERS; it++) {
    for (let i = 0; i < 2; i++) {
      const w = W[i], j = J[i];
      // keep the wheel on its suspension axis
      let vpx = ch.vx - ch.w * j.rcy, vpy = ch.vy + ch.w * j.rcx;
      let cd = (w.vx - vpx) * tx + (w.vy - vpy) * ty;
      const rt = j.rcx * ty - j.rcy * tx;
      let K = w.im + ch.im + rt * rt * ch.iI;
      let lam = -(cd + j.perr * BETA / dt) / K;
      w.vx += lam * tx * w.im; w.vy += lam * ty * w.im; applyAt(ch, -lam * tx, -lam * ty, j.rcx, j.rcy);
      // travel limits
      const lo = V.rest - V.travel, hi = V.rest + .14;
      if (j.ext < lo || j.ext > hi) {
        vpx = ch.vx - ch.w * j.rcy; vpy = ch.vy + ch.w * j.rcx;
        cd = (w.vx - vpx) * nx + (w.vy - vpy) * ny;
        const rn = j.rcx * ny - j.rcy * nx; K = w.im + ch.im + rn * rn * ch.iI;
        const err = j.ext < lo ? (lo - j.ext) : (hi - j.ext);
        lam = -(cd - err * BETA / dt) / K;
        const old = j.jl; j.jl = j.ext < lo ? Math.max(0, old + lam) : Math.min(0, old + lam); lam = j.jl - old;
        w.vx += lam * nx * w.im; w.vy += lam * ny * w.im; applyAt(ch, -lam * nx, -lam * ny, j.rcx, j.rcy);
      }
    }
    for (const c of C) {
      const b = c.b;
      const vx = b.vx - b.w * c.ry, vy = b.vy + b.w * c.rx;
      const vn = vx * c.nx + vy * c.ny;
      const rn = c.rx * c.ny - c.ry * c.nx, Kn = b.im + rn * rn * b.iI;
      let lam = -(vn - Math.max(0, c.pen - SLOP) * BETA / dt) / Kn;
      const old = c.jn; c.jn = Math.max(0, old + lam); lam = c.jn - old;
      applyAt(b, c.nx * lam, c.ny * lam, c.rx, c.ry);
      const tX = -c.ny, tY = c.nx;
      const vx2 = b.vx - b.w * c.ry, vy2 = b.vy + b.w * c.rx, vt = vx2 * tX + vy2 * tY;
      const rtt = c.rx * tY - c.ry * tX, Kt = b.im + rtt * rtt * b.iI;
      let lt = -vt / Kt; const ot = c.jt, mx = c.mu * c.jn; c.jt = clamp(ot + lt, -mx, mx); lt = c.jt - ot;
      applyAt(b, tX * lt, tY * lt, c.rx, c.ry);
    }
  }
  // integrate
  ch.x += ch.vx * dt; ch.y += ch.vy * dt; W[0].x += W[0].vx * dt; W[0].y += W[0].vy * dt; W[1].x += W[1].vx * dt; W[1].y += W[1].vy * dt;
  ch.a += ch.w * dt;
  V.spin[0] += W[0].w * dt; V.spin[1] += W[1].w * dt;
  // feedback events
  for (const c of C) { if (!c.chassis && c.jn / dt > d.mass * 32) ev.thump = Math.max(ev.thump || 0, c.jn / dt / d.mass); }
  if (scrape > 1) ev.scrape = Math.max(ev.scrape || 0, scrape);
  if (crash) ev.crash = true;
  V.grounded = grounded;
  V.chassisHit = C.some(c => c.chassis);
}

// =====================================================================
//  GAME STATE
// =====================================================================
const G = {
  mode: 'demo', state: 'idle', reg: REGIONS[0], T: null, V: null, acc: 0, t: 0,
  dist: 0, startX: 0, cash: 0, earn: null, air: 0, airRot: 0, low: false, over: null, paused: false,
  cam: { x: 0, y: 0, s: 40, vx: 0 }, shake: 0, hitStop: 0, slow: 1, stillT: 0, warnT: 0, lastBest: 0, gear: 1, rpm: 0, runT: 0
};
const INP = { gas: false, brake: false, low: false };
/* weekly tournament: one trail and one stock vehicle for everyone, all week (see /shared/tour.js) */
function tourSetup() {
  const r = GBTour.rng('ridgeline'), base = REGIONS[Math.floor(r() * REGIONS.length)], veh = VEH_ORDER[Math.floor(r() * 3)];
  const reg = Object.assign({}, base, { id: 'tour' + GBTour.week(), seed: 1000 + Math.floor(r() * 90000), name: base.name + ' (tournament)' });
  return { reg, veh };
}
function startRun(mode) {
  G.mode = mode; G.tour = mode === 'tour' && window.GBTour ? (G.tour && G.tour.reg.id === 'tour' + GBTour.week() ? G.tour : tourSetup()) : null;
  G.reg = mode === 'demo' ? REGIONS[0] : G.tour ? G.tour.reg : regionById(SAVE.region);
  G.T = terrainFor(G.reg);
  // reset the props for a fresh run
  G.T.fuel.forEach(p => { p.got = false; }); G.T.caches.forEach(p => { p.got = false; }); G.T.camps.forEach(p => { p.got = false; });
  G.V = buildVehicle(mode === 'demo' ? 'scout' : G.tour ? G.tour.veh : SAVE.veh, G.T, 2, !!G.tour);
  G.startX = G.V.ch.x; G.dist = 0; G.cash = 0; G.earn = { dist: 0, cache: 0, air: 0, flip: 0, camp: 0 };
  G.air = 0; G.airRot = 0; G.low = false; INP.low = false; G.over = null; G.state = 'run'; G.acc = 0; G.stillT = 0; G.warnT = 0; G.runT = 0;
  G.best = SAVE.best[G.reg.id] || 0; G.bestHit = false;
  G.cam.x = G.V.ch.x + 4; G.cam.y = G.V.ch.y; G.slow = 1; G.paused = false;
  PARTS.forEach(p => { p.on = false; });
  AU.demo = mode === 'demo'; AU.duck = mode === 'demo' ? 1 : .8; applyAudio();
  if (mode !== 'demo') { SFX.start(); hud(true); coach(); }
}
function addCash(kind, v, label, sub) {
  v = Math.round(v); if (v <= 0) return;
  G.cash += v; G.earn[kind] += v;
  if (label && G.mode !== 'demo') pop(label, sub || '+$' + fmt(v));
}
function endRun(reason) {
  if (G.state !== 'run') return;
  G.state = 'ending'; G.over = reason; G.endT = reason === 'crash' ? 1.6 : 1.1;
  if (G.mode === 'demo') { G.endT = 1.2; return; }
  const distCash = Math.floor(G.dist * G.reg.mult);
  G.earn.dist = distCash; G.cash += distCash;
  const prevBest = G.tour ? GBTour.myBest('ridgeline') : SAVE.best[G.reg.id] || 0, isBest = G.dist > prevBest;
  if (isBest && !G.tour) SAVE.best[G.reg.id] = Math.floor(G.dist);
  if (G.tour) { G.tourRes = null; const d = Math.floor(G.dist); GBTour.submit('ridgeline', d, G.runT).then(r => { G.tourRes = r; if (G.state === 'over') tourRow(); }); }
  SAVE.cash += G.cash; SAVE.total += G.dist; SAVE.runs++; persist();
  G.result = { isBest, prevBest };
  if (reason === 'crash') { SFX.crash(); G.hitStop = .08; G.shake = 18; G.slow = .35; }
  else SFX.lose();
}
function showOver() {
  G.state = 'over';
  const r = G.result, reasons = { crash: 'Rolled it', fuel: 'Out of fuel', quit: 'Run ended', stuck: 'Stuck' };
  $('oTitle').textContent = reasons[G.over] || 'Run over';
  $('oSub').textContent = G.reg.name + ' · ' + VEH[G.tour ? G.tour.veh : SAVE.veh].name + (G.tour ? ' (stock)' : '');
  $('oDist').innerHTML = fmt(G.dist) + '<small>m</small>';
  const E = G.earn, rows = [
    ['Distance (' + G.reg.mult + '× trail bonus)', '$' + fmt(E.dist)], ['Supply caches', '$' + fmt(E.cache)], ['Air time', '$' + fmt(E.air)], ['Flips', '$' + fmt(E.flip)], ['Base camps', '$' + fmt(E.camp)]
  ].filter(x => x[1] !== '$0' || x[0].startsWith('Distance'));
  $('oKV').innerHTML = (r.isBest ? `<tr><td>Best on this trail</td><td style="color:var(--green)">New record!</td></tr>` : `<tr><td>Best on this trail</td><td>${fmt(r.prevBest)} m</td></tr>`) +
    rows.map(x => `<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`).join('') + `<tr class="tot"><td>Earned</td><td>$${fmt(G.cash)}</td></tr><tr><td>Bank</td><td>$${fmt(SAVE.cash)}</td></tr>`;
  const ni = REGIONS.findIndex(x => x.id === G.reg.id) + 1;
  if (ni < REGIONS.length && !G.unlockShown && regionUnlocked(ni) && r.prevBest < REGIONS[ni].need) { $('oKV').innerHTML += `<tr><td colspan="2" style="color:var(--green);text-align:left">${REGIONS[ni].name} is now open!</td></tr>`; }
  if (r.isBest) SFX.best();
  show('over'); if (G.tour) tourRow();
}

// =====================================================================
//  UPDATE
// =====================================================================
function autopilot(V, T) {
  const ch = V.ch, [gnx, gny] = T.normalAt(ch.x), slope = Math.atan2(-gnx, gny), rel = ch.a - slope;
  const sp = Math.hypot(ch.vx, ch.vy);
  let gas = true, brake = false;
  if (!V.grounded) {
    const ax = ch.x + ch.vx * .5, [nx2, ny2] = T.normalAt(ax), s2 = Math.atan2(-nx2, ny2), e = ch.a - s2;
    gas = e < -.12; brake = e > .18;
  } else {
    if (rel > .5) { gas = false; brake = rel > .7; }
    if (rel < -.6) gas = true;
  }
  INP.low = V.grounded && sp < 2.5 && slope > .35;
  return { gas, brake, low: INP.low };
}
let keyGas = false, keyBrake = false, touchGas = false, touchBrake = false;
function update(dt) {
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 40);
  updateParts(dt);
  if (!G.V || G.paused || G.state === 'over' || G.state === 'idle') return;
  if (G.hitStop > 0) { G.hitStop -= dt; return; }
  const V = G.V, T = G.T, ch = V.ch;
  let inp;
  if (G.mode === 'demo') inp = autopilot(V, T);
  else if (G.state === 'run') inp = { gas: keyGas || touchGas, brake: keyBrake || touchBrake, low: G.low };
  else inp = { gas: false, brake: false, low: G.low };
  if (V.fuel <= 0) inp.gas = inp.gas && false;
  const sdt = dt * G.slow;
  G.acc += sdt;
  const ev = {};
  let n = 0;
  while (G.acc >= PDT && n < 12) { physStep(V, T, inp, PDT, ev); G.acc -= PDT; n++; }
  if (n >= 12) G.acc = 0;
  G.runT += sdt;
  // fuel
  if (G.state === 'run') V.fuel = Math.max(0, V.fuel - (.3 + .7 * V.thr) * (100 / 17) * sdt);
  const sp = Math.hypot(ch.vx, ch.vy);
  // distance & camps
  G.dist = Math.max(G.dist, ch.x - G.startX);
  if (G.state === 'run') {
    if (!G.bestHit && G.best > 50 && G.dist > G.best && G.mode !== 'demo') { G.bestHit = true; pop('New record', 'past ' + fmt(G.best) + ' m'); SFX.best(); }
    for (const p of T.fuel) { if (p.got) continue; if (p.x > ch.x + 4) break; if (Math.abs(p.x - ch.x) < V.d.len * .55) { p.got = true; V.fuel = V.fuelMax; SFX.fuel(); burst(p.x, T.vis(p.x) + .4, '#ff5b3a', 14); if (G.mode !== 'demo') pop('Fuel'); } }
    for (const p of T.caches) { if (p.got) continue; if (p.x > ch.x + 4) break; if (Math.abs(p.x - ch.x) < V.d.len * .55) { p.got = true; SFX.cash(); burst(p.x, T.vis(p.x) + .4, '#f2a33a', 10); addCash('cache', p.val, 'Supply cache'); } }
    for (const c of T.camps) { if (c.got) continue; if (c.x > ch.x) break; c.got = true; const k = c.x / 1000; SFX.camp(); addCash('camp', 250 * k * G.reg.mult, 'Base camp ' + k, '+$' + fmt(250 * k * G.reg.mult)); if (G.mode !== 'demo') banner('Base camp ' + k, fmt(c.x) + ' m'); }
  }
  // air time & flips
  if (!V.grounded && !V.chassisHit) { G.air += sdt; G.airRot += ch.w * sdt; }
  else {
    if (G.state === 'run' && G.air > .75) {
      const flips = Math.floor((Math.abs(G.airRot) + .6) / TAU), up = Math.cos(ch.a) > .5;
      if (flips > 0 && up) { addCash('flip', 160 * flips, (flips > 1 ? flips + '× ' : '') + (G.airRot > 0 ? 'Backflip' : 'Front flip')); SFX.bonus(); }
      else if (G.air > .9) { addCash('air', 18 * G.air * G.air + 10, 'Air ' + G.air.toFixed(1) + 's'); SFX.bonus(); }
    }
    G.air = 0; G.airRot = 0;
  }
  // feedback
  if (ev.thump) { SFX.thump(ev.thump); if (ev.thump > 60) G.shake = Math.max(G.shake, Math.min(9, ev.thump / 12)); for (let i = 0; i < 2; i++) { const c = V.cont[i]; if (c) burst(V.wh[i].x, V.wh[i].y - V.d.R, SURF[c.surf].col, 8); } }
  if (ev.scrape && Math.random() < .25) { SFX.scrape(ev.scrape); for (let k = 0; k < 3; k++) spawn(ch.x + rand(-1, 1), T.height(ch.x) + .05, rand(-3, 3) - ch.vx * .2, rand(1, 3), .4, .05, '#ffd27a', 0, 'spark'); }
  if (ev.crash && G.state === 'run') { endRun('crash'); for (let k = 0; k < 30; k++) spawn(ch.x + rand(-1.5, 1.5), ch.y + rand(-.5, .5), rand(-5, 5), rand(0, 6), rand(.6, 1.4), rand(.05, .12), k % 3 ? '#555' : '#ffd27a', 9.8, k % 3 ? 'debris' : 'spark'); }
  // water splash
  for (const wt of T.waters) { if (wt.x > ch.x + 4) break; if (ch.x > wt.x - 2 && ch.x < wt.x + wt.len + 2) { if (!wt.splashT || G.runT - wt.splashT > 1.5) { if (sp > 3) { wt.splashT = G.runT; SFX.splash(); burst(ch.x, wt.level, '#cfe8ff', 26, 7); } } } }
  // tyre dust & exhaust
  for (let i = 0; i < 2; i++) {
    const c = V.cont[i], w = V.wh[i];
    if (c && !SET.low || (c && Math.random() < .4)) {
      const slipV = Math.abs(-((w.w - ch.w) * V.d.R) - (ch.vx * Math.cos(ch.a) + ch.vy * Math.sin(ch.a)));
      const amt = (sp * .05 + slipV * .12) * (G.reg.night ? .6 : 1);
      if (Math.random() < amt) spawn(w.x - .2, w.y - V.d.R + .1, -ch.vx * .2 - rand(0, 2) - slipV * .3, rand(.5, 2.4), rand(.5, 1.1), rand(.18, .4), SURF[c.surf].col, -.4, 'dust');
    }
  }
  if (V.thr && Math.random() < .5 && V.fuel > 0) { const [ex, ey] = lw(ch, V.d.exhaust[0], V.d.exhaust[1]); spawn(ex, ey, -Math.cos(ch.a) * 2 + ch.vx * .6, .6 + ch.vy * .3, rand(.5, .9), rand(.12, .2), 'rgba(90,90,90,.5)', -.6, 'smoke'); }
  // engine audio
  const wr = Math.abs((V.wh[0].w + V.wh[1].w) * .5 - ch.w) * V.d.R, vm = V.vmax * (G.low ? .45 : 1);
  const frac = clamp(wr / vm, 0, 1.08), gears = 5, gi = Math.min(gears - 1, Math.floor(frac * gears));
  const target = .18 + .78 * clamp(frac * gears - gi, 0, 1) * (gi === 0 ? 1 : .75) + (gi > 0 ? .2 : 0);
  if (gi !== G.gear && G.state === 'run') { if (gi > G.gear) SFX.shift(); G.gear = gi; }
  G.rpm = lerp(G.rpm, V.fuel > 0 ? clamp(target + (V.thr && !V.grounded ? .35 : 0), .12, 1) : Math.max(0, G.rpm - dt), clamp(dt * 10, 0, 1));
  const surf = V.cont[0] ? V.cont[0].surf : V.cont[1] ? V.cont[1].surf : null;
  const tyre = surf ? clamp(sp / 20, 0, .22) : 0, tf = { grass: 600, dirt: 900, snow: 2600, gravel: 1500, mud: 400, sand: 700, ice: 3500, wood: 500, water: 1100, rock: 1200 }[surf] || 700;
  const amb = G.mode === 'demo' ? 0 : G.reg.weather === 'rain' ? .07 : G.reg.weather === 'snow' ? .03 : .015;
  engineSound(G.state === 'run' || G.state === 'ending' ? V.fuel > 0 || G.rpm > .05 : false, G.rpm, V.thr, tyre, tf, amb, G.reg.weather === 'rain' ? 2500 : 700);
  // end conditions
  if (G.state === 'run') {
    if (V.fuel <= 0) {
      if (sp < .35) G.stillT += dt; else G.stillT = 0;
      if (G.stillT > 1.6) endRun('fuel');
    } else if (sp < .25 && Math.cos(ch.a) < -.2) { G.stillT += dt; if (G.stillT > 1.5) endRun('crash'); }
    else G.stillT = 0;
    if (G.mode !== 'demo') {
      const low = V.fuel / V.fuelMax < .2 && V.fuel > 0;
      $('warn').classList.toggle('hide', !low); $('fuelBox').classList.toggle('low', low);
      if (low) { G.warnT -= dt; if (G.warnT <= 0) { SFX.warn(); G.warnT = 1.4; } }
    }
    if (ch.y < T.height(ch.x) - 6) endRun('crash');
  }
  if (G.state === 'ending') {
    G.endT -= dt; G.slow = lerp(G.slow, G.over === 'crash' ? .25 : 1, dt * 3);
    if (G.endT <= 0) { if (G.mode === 'demo') startRun('demo'); else { G.slow = 1; hud(false); showOver(); } }
  }
  // camera
  const C = G.cam;
  const baseS = Math.min(VW / 25, VH / 13) * (VW < 700 ? 1.15 : 1);
  const tS = baseS * lerp(1, .7, clamp(sp / 28, 0, 1));
  C.s = lerp(C.s, tS, clamp(dt * 1.5, 0, 1));
  const tx = ch.x + clamp(ch.vx * .45, -4, 9) + 3.5, ty = ch.y + clamp(ch.vy * .2, -3, 3) + 1.2;
  C.x = lerp(C.x, tx, clamp(dt * 4, 0, 1)); C.y = lerp(C.y, ty, clamp(dt * 3.2, 0, 1));
  if (G.mode !== 'demo' && G.state === 'run') hudTick();
}

// =====================================================================
//  RENDERING
// =====================================================================
const cv = $('cv'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1;
const light = document.createElement('canvas'), lctx = light.getContext('2d');
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, SET.low ? 1 : 1.75);
  VW = innerWidth; VH = innerHeight;
  cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  light.width = Math.round(VW / 2); light.height = Math.round(VH / 2);
  patCache = {}; skyCache = null;
}
window.addEventListener('resize', resize);
// ---------- textures
let patCache = {};
function groundTex(reg) {
  if (patCache[reg.id]) return patCache[reg.id];
  const c = document.createElement('canvas'); c.width = c.height = 256; const t = c.getContext('2d');
  t.fillStyle = reg.dirt; t.fillRect(0, 0, 256, 256);
  const im = t.getImageData(0, 0, 256, 256), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  t.putImageData(im, 0, 0);
  for (let i = 0; i < 260; i++) { t.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.18)' : 'rgba(255,240,220,.08)'; t.fillRect(Math.random() * 256, Math.random() * 256, rand(1, 3), rand(1, 2)); }
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = rand(3, 11), ro = rand(0, 3);
    t.globalAlpha = rand(.35, .7);
    t.fillStyle = 'rgba(0,0,0,.35)'; t.beginPath(); t.ellipse(x + 1, y + 1.5, r, r * rand(.45, .7), ro, 0, TAU); t.fill();
    t.fillStyle = reg.rock; t.beginPath(); t.ellipse(x, y, r, r * rand(.45, .7), ro, 0, TAU); t.fill();
    t.fillStyle = 'rgba(255,255,255,.12)'; t.beginPath(); t.ellipse(x - r * .25, y - r * .2, r * .45, r * .22, ro, 0, TAU); t.fill();
    t.globalAlpha = 1;
  }
  for (let i = 0; i < 40; i++) { t.strokeStyle = 'rgba(0,0,0,.12)'; t.lineWidth = rand(1, 2); t.beginPath(); const y = Math.random() * 256; t.moveTo(0, y); t.bezierCurveTo(80, y + rand(-8, 8), 170, y + rand(-8, 8), 256, y); t.stroke(); }
  return (patCache[reg.id] = c);
}
let skyCache = null;
function drawSky(reg) {
  if (!skyCache || skyCache.id !== reg.id || skyCache.w !== cv.width) {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const t = c.getContext('2d');
    const g = t.createLinearGradient(0, c.height, 0, 0);
    reg.sky.forEach((col, i) => g.addColorStop(i / (reg.sky.length - 1), col));
    t.fillStyle = g; t.fillRect(0, 0, c.width, c.height);
    const s = reg.sun, sx = s.x * c.width, sy = s.y * c.height, R = s.r * DPR;
    if (reg.night || reg.aurora) for (let i = 0; i < 220; i++) { const x = Math.random() * c.width, y = Math.random() * c.height * .65; t.fillStyle = `rgba(255,255,255,${rand(.2, .9) * (reg.night ? 1 : .5)})`; t.fillRect(x, y, rand(.6, 1.8) * DPR, rand(.6, 1.8) * DPR); }
    const gl = t.createRadialGradient(sx, sy, 0, sx, sy, R * 6); gl.addColorStop(0, `rgba(${s.c},.55)`); gl.addColorStop(.25, `rgba(${s.c},.18)`); gl.addColorStop(1, `rgba(${s.c},0)`);
    t.fillStyle = gl; t.fillRect(0, 0, c.width, c.height);
    t.fillStyle = `rgb(${s.c})`; t.beginPath(); t.arc(sx, sy, R * (s.moon ? 1 : .55), 0, TAU); t.fill();
    if (s.moon) { t.fillStyle = 'rgba(30,35,50,.25)'; t.beginPath(); t.arc(sx - R * .3, sy - R * .1, R * .25, 0, TAU); t.arc(sx + R * .35, sy + R * .3, R * .18, 0, TAU); t.fill(); }
    skyCache = { id: reg.id, w: cv.width, c };
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(skyCache.c, 0, 0);
  if (reg.aurora) {
    const tm = performance.now() / 1000;
    ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      for (let x = 0; x <= cv.width; x += 20 * DPR) { const y = cv.height * (.16 + k * .05) + Math.sin(x / (240 * DPR) + tm * .3 + k) * 30 * DPR + Math.sin(x / (90 * DPR) + tm * .7) * 8 * DPR; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.strokeStyle = k === 1 ? 'rgba(120,255,190,.07)' : 'rgba(110,200,255,.06)'; ctx.lineWidth = 46 * DPR; ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
function drawClouds(reg, C) {
  if (reg.night) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (let k = 0; k < 7; k++) {
    const base = k * 900 + 300, px = ((base - C.x * 6) % (VW + 900) + VW + 900) % (VW + 900) - 450;
    const py = VH * (.12 + (k % 3) * .08), s = .7 + (k % 4) * .25;
    ctx.fillStyle = reg.id === 'canyon' ? 'rgba(255,250,240,.5)' : 'rgba(255,240,230,.42)';
    for (let j = 0; j < 5; j++) { ctx.beginPath(); ctx.ellipse(px + j * 46 * s, py + Math.sin(j * 1.7) * 8 * s, 60 * s, 24 * s, 0, 0, TAU); ctx.fill(); }
  }
}
function drawLayers(reg, C) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const layers = [[.07, .5, 150, .075], [.18, .6, 95, .11], [.36, .7, 60, .16]];
  layers.forEach(([p, hy, amp, fq], k) => {
    const yb = VH * hy - (C.y - 3) * C.s * p * .45;
    ctx.fillStyle = reg.hills[k];
    ctx.beginPath(); ctx.moveTo(0, VH);
    const pts = [];
    for (let sx = -8; sx <= VW + 8; sx += 8) {
      const u = C.x * p * 2.2 + (sx - VW / 2) / C.s * 2.2 * (.6 + p);
      const y = yb - (fbm(u * fq, reg.seed + k * 17, 4) * .5 + .5) * amp * (VW / 1400 + .4) - (reg.id === 'canyon' && k < 2 ? Math.max(0, fbm(u * fq * .5, 33, 2)) * amp * 1.4 : 0);
      pts.push(sx, y); ctx.lineTo(sx, y);
    }
    ctx.lineTo(VW + 8, VH); ctx.closePath(); ctx.fill();
    // atmospheric haze on the ridge
    const hz = ctx.createLinearGradient(0, yb - amp * 1.2, 0, VH);
    hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, reg.night ? 'rgba(0,0,0,.25)' : 'rgba(255,240,225,.12)');
    ctx.fillStyle = hz; ctx.fill();
    if (k > 0) { // silhouettes on the ridge
      ctx.fillStyle = reg.treeCol[k];
      let lastCell = null;
      for (let i = 0; i < pts.length; i += 2) {
        const sx = pts[i], u = C.x * p * 2.2 + (sx - VW / 2) / C.s * 2.2 * (.6 + p);
        const cell = Math.floor(u / (k === 1 ? 1.5 : 1.1));
        if (cell === lastCell) continue; lastCell = cell;
        if (hash(cell, reg.seed + k) > (reg.trees === 'cactus' ? .93 : reg.trees === 'rig' ? .97 : .62)) continue;
        const h = (8 + hash(cell, 9) * 16) * (k === 2 ? 1.6 : 1);
        silhouette(ctx, reg.trees, sx, pts[i + 1] + 3, h);
      }
    }
  });
}
function silhouette(t, kind, x, y, h) {
  if (kind === 'pine' || kind === 'snowpine') { t.beginPath(); t.moveTo(x, y - h); t.lineTo(x + h * .32, y); t.lineTo(x - h * .32, y); t.closePath(); t.fill(); }
  else if (kind === 'cactus') { const w = h * .12; t.fillRect(x - w / 2, y - h, w, h); t.fillRect(x - w * 2.2, y - h * .62, w, h * .3); t.fillRect(x + w * 1.2, y - h * .75, w, h * .35); t.fillRect(x - w * 2.2, y - h * .38, w * 3, w * .8); }
  else if (kind === 'rig') { t.fillRect(x - 1, y - h * 1.6, 2, h * 1.6); t.fillRect(x - h * .5, y - h * 1.6, h * .9, 2); }
}
// world transform: x right, y up
function setW(C) {
  const s = C.s * DPR, sx = G.shake && SET.shake ? rand(-1, 1) * G.shake : 0, sy = G.shake && SET.shake ? rand(-1, 1) * G.shake : 0;
  ctx.setTransform(s, 0, 0, -s, (VW / 2 - C.x * C.s + sx) * DPR, (VH * .56 + C.y * C.s + sy) * DPR);
}
const toScreen = (C, x, y) => [VW / 2 + (x - C.x) * C.s, VH * .56 - (y - C.y) * C.s];
function drawTerrain(reg, T, C) {
  const x0 = C.x - VW / 2 / C.s - 2, x1 = C.x + VW / 2 / C.s + 2, yBot = C.y - VH / C.s - 5;
  T.ensure(x1 + 10);
  const i0 = Math.max(0, Math.floor(T.idx(x0))), i1 = Math.min(T.n - 1, Math.ceil(T.idx(x1)));
  // ravines and water under the bridges
  const P = new Path2D();
  P.moveTo((i0 - OFF) * DX, yBot);
  for (let i = i0; i <= i1; i++) P.lineTo((i - OFF) * DX, T.v[i]);
  P.lineTo((i1 - OFF) * DX, yBot); P.closePath();
  const pat = ctx.createPattern(groundTex(reg), 'repeat');
  try { pat.setTransform(new DOMMatrix().scale(1 / 40, -1 / 40)); } catch (e) { /* unscaled pattern */ }
  ctx.fillStyle = pat; ctx.fill(P);
  // deeper strata
  ctx.save(); ctx.clip(P);
  ctx.fillStyle = reg.deep; ctx.globalAlpha = .55;
  ctx.beginPath(); ctx.moveTo((i0 - OFF) * DX, yBot);
  for (let i = i0; i <= i1; i += 2) ctx.lineTo((i - OFF) * DX, T.v[i] - 2.4 - .6 * vnoise(i * .07, 3));
  ctx.lineTo((i1 - OFF) * DX, yBot); ctx.fill();
  ctx.globalAlpha = .35; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.moveTo((i0 - OFF) * DX, yBot);
  for (let i = i0; i <= i1; i += 2) ctx.lineTo((i - OFF) * DX, T.v[i] - 6);
  ctx.lineTo((i1 - OFF) * DX, yBot); ctx.fill();
  ctx.restore(); ctx.globalAlpha = 1;
  // water in ravines & streams
  for (const b of T.bridges) {
    if (b.x > x1 || b.x + b.len < x0) continue;
    let lvl = 1e9; for (let i = b.i0; i <= b.i1; i++) lvl = Math.min(lvl, T.v[i]); lvl += .8;
    waterRect(b.x, b.x + b.len, lvl, T, reg);
  }
  for (const w of T.waters) { if (w.x > x1 || w.x + w.len < x0) continue; waterRect(w.x - .5, w.x + w.len + .5, w.level, T, reg); }
  // surface band
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const band = (col, wdt, off) => {
    ctx.strokeStyle = col; ctx.lineWidth = wdt; ctx.beginPath();
    let pen = false;
    for (let i = i0; i <= i1; i++) {
      if (T.s[i] === 4) { pen = false; continue; }
      const x = (i - OFF) * DX, y = T.v[i] - off;
      if (!pen) { ctx.moveTo(x, y); pen = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  band(reg.top, .55, .18); band(reg.top2, .14, .03);
  // special surfaces
  const zcol = { 1: '#4b3622', 2: '#e2b57a', 3: '#cfe8ff', 5: '#7a6a52', 6: reg.rock };
  ctx.lineWidth = .5;
  for (let i = i0; i < i1; i++) {
    const s = T.s[i]; if (!s || s === 4) continue;
    ctx.strokeStyle = zcol[s]; ctx.beginPath(); ctx.moveTo((i - OFF) * DX, T.v[i] - .16); ctx.lineTo((i + 1 - OFF) * DX, T.v[i + 1] - .16); ctx.stroke();
    if (s === 3) { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = .08; ctx.beginPath(); ctx.moveTo((i - OFF) * DX, T.v[i] - .02); ctx.lineTo((i + 1 - OFF) * DX, T.v[i + 1] - .02); ctx.stroke(); ctx.lineWidth = .5; }
  }
  // grass tufts / pebbles along the edge
  if (!SET.low) {
    ctx.fillStyle = reg.top2;
    for (let i = i0; i <= i1; i++) {
      if (T.s[i] || hash(i, 5) > .35) continue;
      const x = (i - OFF) * DX + hash(i, 6) * .4, y = T.v[i];
      if (reg.surf === 'grass') { ctx.beginPath(); ctx.moveTo(x - .08, y); ctx.lineTo(x, y + .18 + hash(i, 7) * .15); ctx.lineTo(x + .08, y); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(x, y - .04, .1 + hash(i, 8) * .08, .06, 0, 0, TAU); ctx.fillStyle = reg.rock; ctx.fill(); }
    }
  }
  // bridges
  for (const b of T.bridges) {
    if (b.x > x1 || b.x + b.len < x0) continue;
    const x0b = b.x, x1b = b.x + b.len, y0 = b.h0, y1 = b.h1;
    const posts = Math.max(3, Math.round(b.len / 3));
    ctx.strokeStyle = '#3b2a1a'; ctx.lineWidth = .22;
    for (let k = 0; k <= posts; k++) { const u = k / posts, x = lerp(x0b, x1b, u), y = lerp(y0, y1, u); ctx.beginPath(); ctx.moveTo(x, y - .5); ctx.lineTo(x, y + 1.2); ctx.stroke(); }
    for (let x = x0b; x < x1b; x += .45) { const y = lerp(y0, y1, (x - x0b) / b.len); ctx.fillStyle = hash(Math.round(x * 3), 4) > .5 ? '#7d5a36' : '#6b4b2c'; ctx.fillRect(x, y - .28, .42, .28); }
    ctx.strokeStyle = '#c9b48a'; ctx.lineWidth = .06;
    ctx.beginPath(); for (let k = 0; k <= 30; k++) { const u = k / 30, x = lerp(x0b, x1b, u), y = lerp(y0, y1, u) + 1.1 - Math.sin(u * Math.PI * posts) ** 2 * .25; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    // under-deck support beams
    ctx.strokeStyle = '#2b1e12'; ctx.lineWidth = .18; ctx.beginPath(); ctx.moveTo(x0b, y0 - .3); ctx.lineTo(x1b, y1 - .3); ctx.stroke();
  }
}
function waterRect(xa, xb, lvl, T, reg) {
  const g = ctx.createLinearGradient(0, lvl, 0, lvl - 3);
  g.addColorStop(0, reg.night ? 'rgba(60,80,110,.75)' : reg.id === 'glacier' ? 'rgba(150,200,230,.85)' : 'rgba(70,120,150,.82)'); g.addColorStop(1, 'rgba(20,40,60,.95)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(xa, lvl);
  for (let x = xa; x <= xb; x += .5) ctx.lineTo(x, Math.min(lvl, T.vis(x)));
  ctx.lineTo(xb, lvl); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = .05; ctx.beginPath();
  const tm = performance.now() / 1000;
  for (let x = xa; x <= xb; x += .25) { const y = lvl + Math.sin(x * 3 + tm * 2) * .03; if (T.vis(x) < lvl) { x === xa ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } }
  ctx.stroke();
}
function drawProps(reg, T, C) {
  const x0 = C.x - VW / 2 / C.s - 6, x1 = C.x + VW / 2 / C.s + 6;
  // trees just behind the trail
  if (reg.trees !== 'rig') {
    for (let cell = Math.floor(x0 / 5); cell <= x1 / 5; cell++) {
      if (hash(cell, reg.seed + 3) > (reg.trees === 'cactus' ? .2 : .45)) continue;
      const x = cell * 5 + hash(cell, 4) * 4, s = T.surfAt(x); if (s === 'wood' || s === 'water') continue;
      const y = T.vis(x) - .15, h = 4 + hash(cell, 5) * 5;
      drawTree(reg, x, y, h, hash(cell, 6));
    }
  }
  // distance signs
  for (let m = Math.ceil(x0 / 100) * 100; m <= x1; m += 100) {
    if (m <= 0 || m % 1000 === 0) continue;
    const y = T.vis(m);
    ctx.fillStyle = '#4a3523'; ctx.fillRect(m - .06, y - .2, .12, 1.5);
    ctx.fillStyle = '#e8dcc0'; ctx.fillRect(m - .45, y + 1.05, .9, .42); ctx.strokeStyle = '#4a3523'; ctx.lineWidth = .05; ctx.strokeRect(m - .45, y + 1.05, .9, .42);
    textAt(C, m, y + 1.26, String(m), 11, '#3a2a1a');
  }
  // best distance flag
  if (G.best > 30 && G.mode !== 'demo') {
    const bx = G.startX + G.best, y = T.vis(bx);
    if (bx > x0 && bx < x1) {
      ctx.fillStyle = '#ddd'; ctx.fillRect(bx - .04, y, .08, 3.2);
      const wv = Math.sin(performance.now() / 300) * .08;
      ctx.fillStyle = '#e2553f'; ctx.beginPath(); ctx.moveTo(bx + .04, y + 3.2); ctx.lineTo(bx + 1.2, y + 2.95 + wv); ctx.lineTo(bx + .04, y + 2.6); ctx.fill();
      textAt(C, bx, y + 3.55, 'BEST', 12, '#fff', true);
    }
  }
  // camps
  for (const c of T.camps) {
    if (c.x < x0 - 10 || c.x > x1 + 10) continue;
    const y = T.vis(c.x);
    tent(c.x - 6, T.vis(c.x - 6), 2.6, '#c8642f'); tent(c.x + 5, T.vis(c.x + 5), 2.2, '#3f6b8a');
    ctx.fillStyle = '#cfcfcf'; ctx.fillRect(c.x - .05, y, .1, 6);
    const tm = performance.now() / 1000;
    ctx.fillStyle = c.got ? '#8fd16a' : '#f2a33a'; ctx.beginPath(); ctx.moveTo(c.x + .05, y + 6);
    for (let k = 0; k <= 6; k++) ctx.lineTo(c.x + .05 + k * .35, y + 6 - .02 * k + Math.sin(tm * 4 - k) * .12);
    for (let k = 6; k >= 0; k--) ctx.lineTo(c.x + .05 + k * .35, y + 5.1 - .02 * k + Math.sin(tm * 4 - k) * .12);
    ctx.fill();
    // campfire
    const fx = c.x - 2.5, fy = T.vis(fx);
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(fx - .4, fy, .8, .12);
    for (let k = 0; k < 3; k++) { ctx.fillStyle = k ? 'rgba(255,190,60,.8)' : 'rgba(255,90,30,.85)'; ctx.beginPath(); ctx.ellipse(fx + Math.sin(tm * 9 + k) * .05, fy + .3 + k * .05, .22 - k * .06, .4 - k * .1 + Math.sin(tm * 13 + k) * .05, 0, 0, TAU); ctx.fill(); }
    textAt(C, c.x, y + 7, 'BASE CAMP ' + c.x / 1000, 15, '#fff', true);
  }
  // fuel & caches
  for (const p of T.fuel) { if (p.got || p.x < x0) continue; if (p.x > x1) break; jerrycan(p.x, T.height(p.x)); }
  for (const p of T.caches) { if (p.got || p.x < x0) continue; if (p.x > x1) break; crate(p.x, T.height(p.x)); }
}
function drawTree(reg, x, y, h, r) {
  const k = reg.treeCol;
  if (reg.trees === 'cactus') {
    ctx.fillStyle = k[0]; const w = .32; ctx.fillRect(x - w / 2, y, w, h * .55);
    ctx.fillRect(x - .7, y + h * .25, .26, h * .18); ctx.fillRect(x - .7, y + h * .22, .55, .22); ctx.fillRect(x + .44, y + h * .3, .26, h * .14); ctx.fillRect(x + .2, y + h * .3, .5, .2);
    return;
  }
  ctx.fillStyle = '#3a2a1c'; ctx.fillRect(x - .12, y, .24, h * .3);
  for (let i = 0; i < 4; i++) {
    const yy = y + h * (.22 + i * .2), w = h * (.36 - i * .07);
    ctx.fillStyle = k[i % 2 ? 1 : 0]; ctx.beginPath(); ctx.moveTo(x - w, yy); ctx.lineTo(x + w, yy); ctx.lineTo(x, yy + h * .34); ctx.fill();
    if (reg.trees === 'snowpine') { ctx.fillStyle = 'rgba(240,246,255,.85)'; ctx.beginPath(); ctx.moveTo(x - w * .55, yy + h * .16); ctx.lineTo(x, yy + h * .34); ctx.lineTo(x + w * .5, yy + h * .17); ctx.lineTo(x, yy + h * .24); ctx.fill(); }
  }
}
function tent(x, y, s, col) {
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x, y + s * .9); ctx.lineTo(x + s, y); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + s * .9); ctx.lineTo(x + s, y); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.moveTo(x - s * .25, y); ctx.lineTo(x, y + s * .5); ctx.lineTo(x + s * .1, y); ctx.fill();
}
function jerrycan(x, y) {
  const b = Math.sin(performance.now() / 400 + x) * .03;
  ctx.save(); ctx.translate(x, y + b);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, .02, .4, .07, 0, 0, TAU); ctx.fill();
  const g = ctx.createLinearGradient(-.3, 0, .3, 0); g.addColorStop(0, '#9e1d12'); g.addColorStop(.45, '#e0402a'); g.addColorStop(1, '#7c140b');
  ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-.28, .02, .56, .7, .06) : ctx.rect(-.28, .02, .56, .7); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .03; ctx.beginPath(); ctx.moveTo(-.2, .12); ctx.lineTo(.2, .6); ctx.moveTo(.2, .12); ctx.lineTo(-.2, .6); ctx.stroke();
  ctx.fillStyle = '#5a0d07'; ctx.fillRect(-.18, .72, .3, .1); ctx.fillStyle = '#d6d0c4'; ctx.fillRect(.14, .7, .1, .14);
  ctx.restore();
  if (G.reg.night) glowAt(x, y + .4, 2.2, 'rgba(255,90,60,.35)');
}
function crate(x, y) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, .02, .5, .08, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#9a7246'; ctx.fillRect(-.36, 0, .72, .62);
  ctx.strokeStyle = '#5e4326'; ctx.lineWidth = .06; ctx.strokeRect(-.36, 0, .72, .62); ctx.beginPath(); ctx.moveTo(-.36, 0); ctx.lineTo(.36, .62); ctx.stroke();
  ctx.fillStyle = '#6b6b6b'; ctx.fillRect(.25, .62, .04, 1.1);
  const tm = performance.now() / 260;
  ctx.fillStyle = '#f2a33a'; ctx.beginPath(); ctx.moveTo(.29, 1.72); ctx.lineTo(.8, 1.6 + Math.sin(tm) * .04); ctx.lineTo(.29, 1.45); ctx.fill();
  ctx.restore();
  if (G.reg.night) glowAt(x, y + .6, 2, 'rgba(255,170,60,.3)');
}
const GLOWS = [];
function glowAt(x, y, r, col) { GLOWS.push([x, y, r, col]); }
function textAt(C, x, y, s, px, col, bold) {
  const [sx, sy] = toScreen(C, x, y);
  ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.font = `${bold ? 700 : 600} ${px}px Oswald, "Arial Narrow", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (bold) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillText(s, sx + 1, sy + 1); }
  ctx.fillStyle = col; ctx.fillText(s, sx, sy);
  ctx.restore();
}

// ---------- vehicles
function wheel(t, R, ang, style) {
  t.save(); t.rotate(ang);
  t.fillStyle = '#161514'; t.beginPath(); t.arc(0, 0, R, 0, TAU); t.fill();
  const lugs = style === 'crawler' ? 14 : 18;
  t.fillStyle = '#26231f';
  for (let i = 0; i < lugs; i++) { t.save(); t.rotate(i / lugs * TAU); t.fillRect(R * .86, -R * .09, R * .16, R * .18); t.restore(); }
  t.strokeStyle = '#2f2c28'; t.lineWidth = R * .06; t.beginPath(); t.arc(0, 0, R * .78, 0, TAU); t.stroke();
  const rr = R * (style === 'crawler' ? .5 : .56);
  const g = t.createRadialGradient(-rr * .3, rr * .3, rr * .1, 0, 0, rr);
  g.addColorStop(0, style === 'buggy' ? '#5a5a5a' : '#d9d6cf'); g.addColorStop(1, style === 'buggy' ? '#1c1c1c' : '#6d6a63');
  t.fillStyle = g; t.beginPath(); t.arc(0, 0, rr, 0, TAU); t.fill();
  t.fillStyle = style === 'buggy' ? '#111' : '#3a3833';
  const sp = style === 'expedition' ? 8 : 6;
  for (let i = 0; i < sp; i++) { t.save(); t.rotate(i / sp * TAU); t.beginPath(); t.ellipse(rr * .55, 0, rr * .22, rr * .12, 0, 0, TAU); t.fill(); t.restore(); }
  t.fillStyle = '#8c887f'; t.beginPath(); t.arc(0, 0, rr * .22, 0, TAU); t.fill();
  t.restore();
}
function strut(t, x0, y0, x1, y1, w, col) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  t.strokeStyle = '#9a9a9a'; t.lineWidth = w * .35; t.beginPath(); t.moveTo(x0, y0); t.lineTo(x1, y1); t.stroke();
  t.strokeStyle = '#3a3a3a'; t.lineWidth = w * .7; t.beginPath(); t.moveTo(x0 + ux * L * .45, y0 + uy * L * .45); t.lineTo(x1 - ux * L * .1, y1 - uy * L * .1); t.stroke();
  t.strokeStyle = col; t.lineWidth = w * .22; t.beginPath();
  const coils = 7;
  for (let k = 0; k <= coils * 2; k++) { const u = .08 + k / (coils * 2) * .7, s = k % 2 ? 1 : -1; const px = x0 + dx * u + nx * w * .5 * s, py = y0 + dy * u + ny * w * .5 * s; k ? t.lineTo(px, py) : t.moveTo(px, py); }
  t.stroke();
}
function poly(t, pts) { t.beginPath(); pts.forEach((p, i) => i ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1])); t.closePath(); }
function paint(t, col, y0, y1) { const g = t.createLinearGradient(0, y1, 0, y0); g.addColorStop(0, shade(col, 1.25)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, .6)); return g; }
const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const r = clamp(Math.round((n >> 16) * k), 0, 255), g = clamp(Math.round(((n >> 8) & 255) * k), 0, 255), b = clamp(Math.round((n & 255) * k), 0, 255); return `rgb(${r},${g},${b})`; };
function glass(t, pts) { poly(t, pts); const g = t.createLinearGradient(0, 0, .6, 1.3); g.addColorStop(0, '#1d2a33'); g.addColorStop(.55, '#33505f'); g.addColorStop(1, '#14202a'); t.fillStyle = g; t.fill(); t.save(); t.clip(); t.fillStyle = 'rgba(255,255,255,.14)'; t.beginPath(); t.moveTo(-2, 0); t.lineTo(-1.6, 0); t.lineTo(1, 2); t.lineTo(.6, 2); t.fill(); t.restore(); }
function helmet(t, x, y, col) { t.fillStyle = col; t.beginPath(); t.arc(x, y, .17, 0, TAU); t.fill(); t.fillStyle = '#111'; t.beginPath(); t.ellipse(x + .08, y + .01, .09, .06, 0, 0, TAU); t.fill(); }
function drawBody(t, id, V, brake, lightsOn) {
  const d = VEH[id], c1 = d.col, c2 = d.col2;
  if (id === 'scout') {
    poly(t, [[-2.36, -.34], [2.3, -.3], [2.4, .06], [2.22, .44], [1.06, .56], [.62, 1.24], [-.46, 1.27], [-.56, .54], [-2.36, .5]]);
    t.fillStyle = paint(t, c1, -.34, 1.27); t.fill();
    glass(t, [[.5, 1.14], [-.36, 1.16], [-.42, .66], [.88, .64]]);
    t.strokeStyle = 'rgba(0,0,0,.35)'; t.lineWidth = .03; t.beginPath(); t.moveTo(.06, 1.15); t.lineTo(.06, -.2); t.moveTo(-.5, .55); t.lineTo(-.5, -.25); t.stroke();
    t.fillStyle = 'rgba(0,0,0,.45)'; t.fillRect(.25, .38, .22, .05);
    t.fillStyle = shade(c1, .7); t.fillRect(-2.36, .38, 1.8, .14); // bed rail
    t.fillStyle = '#1b1b1b'; t.beginPath(); t.arc(-1.45, .62, .36, 0, Math.PI); t.fill(); // spare in bed
    t.fillStyle = '#2b2b2b'; t.fillRect(2.18, -.34, .26, .42); t.fillRect(-2.44, -.3, .14, .4); // bumpers
    t.strokeStyle = '#2b2b2b'; t.lineWidth = .07; t.beginPath(); t.moveTo(2.3, .06); t.lineTo(2.35, .4); t.stroke();
    t.strokeStyle = '#1c1c1c'; t.lineWidth = .1; t.beginPath(); t.moveTo(1.55, .5); t.lineTo(1.0, .62); t.lineTo(.68, 1.3); t.stroke(); // snorkel
    t.fillStyle = '#1c1c1c'; t.fillRect(-.4, 1.27, 1.0, .06); t.fillStyle = '#f5f0d8'; for (let k = 0; k < 3; k++) t.fillRect(-.3 + k * .3, 1.33, .18, .09); // light bar
    t.fillStyle = 'rgba(0,0,0,.32)'; t.beginPath(); t.arc(-1.42, -.28, .56, 0, Math.PI); t.arc(1.4, -.28, .56, 0, Math.PI); t.fill(); // wheel arches
    t.fillStyle = c2; t.fillRect(-1.95, .05, 3.6, .08); // stripe
  } else if (id === 'buggy') {
    t.strokeStyle = '#1d1d1d'; t.lineWidth = .09; t.lineJoin = 'round';
    t.beginPath(); t.moveTo(-1.9, -.15); t.lineTo(-.6, 1.25); t.lineTo(.5, 1.25); t.lineTo(1.4, .4); t.lineTo(2.1, .15); t.moveTo(-.6, 1.25); t.lineTo(-.2, -.15); t.moveTo(.5, 1.25); t.lineTo(.3, -.15); t.moveTo(-2, .45); t.lineTo(-.6, 1.25); t.stroke();
    poly(t, [[-2.05, -.22], [2.15, -.2], [2.22, .18], [1.3, .5], [.35, .45], [-.3, .25], [-1.2, .35], [-2.1, .55]]);
    t.fillStyle = paint(t, c1, -.22, .55); t.fill();
    t.fillStyle = '#2a2a2a'; poly(t, [[-2.05, .3], [-1.3, .32], [-1.25, .9], [-1.95, .85]]); t.fill(); // engine
    t.fillStyle = '#555'; for (let k = 0; k < 4; k++) t.fillRect(-1.9 + k * .16, .88, .1, .12);
    t.fillStyle = '#1a1a1a'; t.beginPath(); t.arc(-2.15, .6, .3, 0, TAU); t.fill(); // spare
    t.fillStyle = '#c9c4b8'; t.fillRect(-.35, .2, .55, .16); // seat
    t.fillStyle = '#2d3b4f'; t.fillRect(-.15, .35, .22, .45); // driver torso
    helmet(t, .0, .95, '#f0f0f0');
    t.strokeStyle = '#2d3b4f'; t.lineWidth = .08; t.beginPath(); t.moveTo(.05, .65); t.lineTo(.5, .62); t.stroke();
    t.fillStyle = 'rgba(255,255,255,.85)'; t.fillRect(-1.6, -.05, 2.2, .06);
  } else if (id === 'crawler') {
    t.strokeStyle = '#111'; t.lineWidth = .1; t.lineJoin = 'round';
    t.beginPath(); t.moveTo(-1.7, .3); t.lineTo(-.55, 1.42); t.lineTo(.55, 1.4); t.lineTo(1.6, .45); t.moveTo(-.55, 1.42); t.lineTo(-.5, .2); t.moveTo(.55, 1.4); t.lineTo(.5, .2); t.stroke();
    poly(t, [[-1.88, -.15], [1.9, -.12], [1.96, .32], [1.2, .5], [.6, .62], [-1.1, .62], [-1.9, .6]]);
    t.fillStyle = paint(t, c1, -.15, .62); t.fill();
    glass(t, [[.48, 1.28], [-.45, 1.3], [-.45, .66], [.48, .66]]);
    helmet(t, -.05, .95, '#d23b2a');
    t.fillStyle = '#1a1a1a'; t.fillRect(1.82, -.2, .28, .5); t.fillStyle = '#777'; t.beginPath(); t.arc(1.98, .05, .1, 0, TAU); t.fill(); // winch
    t.fillStyle = 'rgba(0,0,0,.4)'; t.fillRect(-1.88, .25, 3.84, .06);
    t.fillStyle = '#111'; for (let k = 0; k < 3; k++) { t.beginPath(); t.arc(-.3 + k * .3, 1.5, .08, 0, TAU); t.fill(); }
  } else if (id === 'expedition') {
    poly(t, [[-3.06, -.38], [2.55, -.34], [2.62, .2], [2.45, .72], [1.75, .78], [1.05, 1.5], [-.3, 1.52], [-.32, .78], [-3.06, .8]]);
    t.fillStyle = paint(t, c1, -.38, 1.52); t.fill();
    poly(t, [[-3.0, .72], [-.45, .72], [-.45, 2.0], [-2.9, 2.02], [-3.0, 1.9]]);
    t.fillStyle = paint(t, c2, .72, 2.02); t.fill();
    t.strokeStyle = 'rgba(0,0,0,.18)'; t.lineWidth = .03; for (let k = 1; k < 5; k++) { t.beginPath(); t.moveTo(-3, .72 + k * .26); t.lineTo(-.45, .72 + k * .26); t.stroke(); }
    glass(t, [[-2.5, 1.75], [-1.6, 1.75], [-1.6, 1.25], [-2.5, 1.25]]); glass(t, [[-1.2, 1.75], [-.75, 1.75], [-.75, 1.25], [-1.2, 1.25]]);
    glass(t, [[.95, 1.4], [-.2, 1.42], [-.2, .9], [1.35, .88]]);
    t.fillStyle = '#2a2a2a'; t.fillRect(-2.95, 2.02, 2.4, .08); t.fillStyle = '#4f5a3a'; t.fillRect(-2.6, 2.1, 1.6, .3); // roof tent
    t.fillStyle = '#7a2a1d'; for (let k = 0; k < 2; k++) t.fillRect(-1.0 + k * .32, .05, .26, .55); // jerrycans
    t.strokeStyle = '#555'; t.lineWidth = .05; t.beginPath(); for (let k = 0; k < 6; k++) { t.moveTo(-3.1, .9 + k * .2); t.lineTo(-2.95, .9 + k * .2); } t.moveTo(-3.1, .85); t.lineTo(-3.1, 2.0); t.stroke();
    t.fillStyle = '#2b2b2b'; t.fillRect(2.45, -.36, .26, .5); t.fillRect(-3.12, -.36, .16, .45);
    t.fillStyle = 'rgba(0,0,0,.32)'; t.beginPath(); t.arc(-1.95, -.36, .64, 0, Math.PI); t.arc(1.8, -.36, .64, 0, Math.PI); t.fill();
  }
  // lights
  t.fillStyle = lightsOn ? '#fff8d8' : '#e9e2c4'; t.beginPath(); t.ellipse(d.lamp[0], d.lamp[1], .07, .11, 0, 0, TAU); t.fill();
  t.fillStyle = brake ? '#ff3a28' : '#8a1c14'; t.fillRect(d.tail[0] - .03, d.tail[1] - .08, .08, .16);
}
function drawVehicle(t, V, brake) {
  const ch = V.ch, d = V.d, id = V.id;
  // suspension behind the body
  t.save(); t.translate(ch.x, ch.y); t.rotate(ch.a);
  for (let i = 0; i < 2; i++) {
    const w = V.wh[i], dx = w.x - ch.x, dy = w.y - ch.y, c = Math.cos(-ch.a), s = Math.sin(-ch.a);
    const lx = c * dx - s * dy, ly = s * dx + c * dy;
    strut(t, d.anchors[i][0], d.anchors[i][1] + .15, lx, ly, .16, id === 'crawler' ? '#d23b2a' : id === 'buggy' ? '#e2b625' : '#c94b2a');
  }
  drawBody(t, id, V, brake, G.reg.night);
  t.restore();
  for (let i = 0; i < 2; i++) { const w = V.wh[i]; t.save(); t.translate(w.x, w.y); wheel(t, d.R, V.spin[i], id); t.restore(); }
}

// ---------- particles
const PARTS = []; for (let i = 0; i < 320; i++) PARTS.push({ on: false });
function spawn(x, y, vx, vy, life, size, col, grav, kind) {
  if (SET.low && Math.random() < .5) return;
  for (const p of PARTS) if (!p.on) { p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.col = col; p.g = grav; p.kind = kind; return; }
}
function burst(x, y, col, n, up = 4) { for (let i = 0; i < n; i++) spawn(x, y, rand(-3, 3), rand(1, up), rand(.4, .9), rand(.08, .2), col, 9.8, 'chip'); }
function updateParts(dt) {
  for (const p of PARTS) {
    if (!p.on) continue; p.life -= dt; if (p.life <= 0) { p.on = false; continue; }
    p.vy -= p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'dust' || p.kind === 'smoke') { p.vx *= 1 - 1.5 * dt; p.vy *= 1 - 1.2 * dt; }
    if (p.kind !== 'dust' && p.kind !== 'smoke' && G.T && p.y < G.T.vis(p.x)) { p.y = G.T.vis(p.x); p.vy *= -.3; p.vx *= .6; }
  }
}
function drawParts() {
  for (const p of PARTS) {
    if (!p.on) continue;
    const a = p.life / p.max;
    if (p.kind === 'dust' || p.kind === 'smoke') { ctx.globalAlpha = a * (p.kind === 'smoke' ? .5 : .55); ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (2 - a), 0, TAU); ctx.fill(); }
    else if (p.kind === 'spark') { ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = .04; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); ctx.stroke(); }
    else { ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.col; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  }
  ctx.globalAlpha = 1;
}
const WX = []; for (let i = 0; i < 160; i++) WX.push({ x: Math.random(), y: Math.random(), s: rand(.5, 1.5) });
function drawWeather(reg, dt) {
  if (!reg.weather || G.mode === 'demo' && SET.low) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const n = SET.low ? 60 : WX.length, vx = G.V ? G.V.ch.vx : 0;
  if (reg.weather === 'snow') {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < n; i++) { const w = WX[i]; w.y += dt * .06 * w.s; w.x += dt * (-.01 - vx * .002 + Math.sin(w.y * 20 + i) * .01); w.x = (w.x + 1) % 1; w.y %= 1; ctx.beginPath(); ctx.arc(w.x * VW, w.y * VH, 1.2 * w.s + .4, 0, TAU); ctx.fill(); }
  } else {
    ctx.strokeStyle = 'rgba(180,200,230,.35)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const w = WX[i]; w.y += dt * 1.4 * w.s; w.x -= dt * (.05 + vx * .004); w.x = (w.x + 1) % 1; w.y %= 1; const x = w.x * VW, y = w.y * VH; ctx.moveTo(x, y); ctx.lineTo(x - 4 - vx * .3, y + 16 * w.s); }
    ctx.stroke();
  }
}
function drawNight(reg, C, V) {
  if (!reg.night) return;
  const w = light.width, h = light.height, k = w / VW;
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = 'rgba(4,6,14,.86)'; lctx.fillRect(0, 0, w, h);
  lctx.globalCompositeOperation = 'destination-out';
  const hole = (x, y, r, a) => { const g = lctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); lctx.fillStyle = g; lctx.beginPath(); lctx.arc(x, y, r, 0, TAU); lctx.fill(); };
  if (V) {
    const ch = V.ch, [lx, ly] = lw(ch, V.d.lamp[0], V.d.lamp[1]), [sx, sy] = toScreen(C, lx, ly);
    const ang = -ch.a, L = 26 * C.s * k, spread = .36;
    const g = lctx.createRadialGradient(sx * k, sy * k, 0, sx * k, sy * k, L);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.6, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = g; lctx.beginPath(); lctx.moveTo(sx * k, sy * k); lctx.arc(sx * k, sy * k, L, ang - spread, ang + spread); lctx.closePath(); lctx.fill();
    const [cx, cy] = toScreen(C, ch.x, ch.y); hole(cx * k, cy * k, 6 * C.s * k, .8);
  }
  for (const gl of GLOWS) { const [sx, sy] = toScreen(C, gl[0], gl[1]); hole(sx * k, sy * k, gl[2] * C.s * k * 1.6, .9); }
  if (G.T) for (const c of G.T.camps) { if (Math.abs(c.x - C.x) > 60) continue; const [sx, sy] = toScreen(C, c.x - 2.5, G.T.vis(c.x - 2.5) + .5); hole(sx * k, sy * k, 10 * C.s * k, .95); }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(light, 0, 0, cv.width, cv.height);
  // visible beam in the rain
  if (V) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalCompositeOperation = 'lighter';
    const ch = V.ch, [lx, ly] = lw(ch, V.d.lamp[0], V.d.lamp[1]), [sx, sy] = toScreen(C, lx, ly), ang = -ch.a, L = 22 * C.s;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, L); g.addColorStop(0, 'rgba(255,240,200,.22)'); g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.arc(sx, sy, L, ang - .3, ang + .3); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
}
function render(dt) {
  const reg = G.reg, C = G.cam, V = G.V;
  GLOWS.length = 0;
  drawSky(reg); drawClouds(reg, C); drawLayers(reg, C);
  if (!G.T) return;
  setW(C);
  drawProps(reg, G.T, C);
  drawTerrain(reg, G.T, C);
  if (V) {
    // soft shadow under the chassis
    const gy = G.T.vis(V.ch.x), hgt = V.ch.y - gy;
    ctx.fillStyle = `rgba(0,0,0,${clamp(.35 - hgt * .05, 0, .35)})`; ctx.beginPath(); ctx.ellipse(V.ch.x, gy + .02, V.d.len * .5, .14, 0, 0, TAU); ctx.fill();
    drawVehicle(ctx, V, (keyBrake || touchBrake) && G.mode !== 'demo');
  }
  drawParts();
  drawNight(reg, C, V);
  drawWeather(reg, dt);
  // vignette
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!vig || vig.w !== cv.width) { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const t = c.getContext('2d'); const g = t.createRadialGradient(c.width / 2, c.height * .55, c.height * .35, c.width / 2, c.height / 2, c.width * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.45)'); t.fillStyle = g; t.fillRect(0, 0, c.width, c.height); vig = { w: cv.width, c }; }
  ctx.drawImage(vig.c, 0, 0);
}
let vig = null;

// =====================================================================
//  HUD
// =====================================================================
const gctx = $('gaugeC').getContext('2d');
let hudT = 0;
function hud(on) { $('hud').classList.toggle('hide', !on); $('touch').classList.toggle('hide', !on || !isTouch); if (!on) { $('warn').classList.add('hide'); $('coach').classList.add('hide'); } }
function hudTick() {
  const V = G.V; if (!V) return;
  $('fuelF').style.width = (V.fuel / V.fuelMax * 100).toFixed(1) + '%';
  $('dist').textContent = fmt(G.dist) + ' m';
  $('distSub').textContent = G.best ? (G.dist > G.best ? 'New best!' : 'Best ' + fmt(G.best) + ' m') : G.reg.name;
  $('campF').style.width = ((G.dist % 1000) / 10) + '%';
  $('cash').textContent = '$' + fmt(G.cash);
  const sp = Math.hypot(V.ch.vx, V.ch.vy) * 3.6 * (SET.mph ? .6214 : 1);
  $('spd').textContent = Math.round(sp);
  // rpm gauge
  const w = 260, h = 150, cx = w / 2, cy = 132, r = 112;
  gctx.clearRect(0, 0, w, h);
  gctx.lineCap = 'round';
  gctx.lineWidth = 12; gctx.strokeStyle = 'rgba(15,12,10,.7)'; gctx.beginPath(); gctx.arc(cx, cy, r, Math.PI, TAU); gctx.stroke();
  gctx.strokeStyle = 'rgba(226,85,63,.8)'; gctx.lineWidth = 12; gctx.beginPath(); gctx.arc(cx, cy, r, Math.PI + Math.PI * .85, TAU); gctx.stroke();
  const rp = clamp(G.rpm, 0, 1);
  const gg = gctx.createLinearGradient(0, 0, w, 0); gg.addColorStop(0, '#f2a33a'); gg.addColorStop(1, '#ffe0a8');
  gctx.strokeStyle = gg; gctx.lineWidth = 8; gctx.beginPath(); gctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * rp); gctx.stroke();
  const rt = (G.low ? 'LOW' : 'HIGH') + ' · ' + (G.gear + 1); if (rt !== hudTick.rt) { hudTick.rt = rt; $('range').textContent = rt; }
}
function pop(t, sub) {
  const box = $('pops'), d = document.createElement('div'); d.innerHTML = t + (sub ? `<small>${sub}</small>` : '');
  box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => d.remove(), 1650);
}
let banTO = 0;
function banner(t, s) { $('banT').textContent = t; $('banS').textContent = s || ''; const b = $('banner'); b.classList.remove('hide'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(banTO); banTO = setTimeout(() => b.classList.add('hide'), 2200); }
function coach() {
  const c = $('coach');
  if (SAVE.tut >= 2) { c.classList.add('hide'); return; }
  c.innerHTML = isTouch ? 'Hold <b>Gas</b> to drive · <b>Brake</b> to slow and reverse · in the air, gas tips back, brake tips forward'
    : '<b>&rarr;</b> gas · <b>&larr;</b> brake / reverse · in the air, gas tips back, brake tips forward · <b>Shift</b> low range';
  c.classList.remove('hide');
  clearTimeout(coach.to); coach.to = setTimeout(() => c.classList.add('hide'), 9000);
  SAVE.tut++; persist();
}
function setRange(low, quiet) {
  G.low = low; if (!quiet) SFX.range();
  const r = $('range'); r.textContent = low ? 'LOW' : 'HIGH'; hudTick.rt = ''; r.classList.toggle('low', low); $('tRange').classList.toggle('on', low);
  if (G.mode !== 'demo' && !quiet) pop(low ? 'Low range' : 'High range');
}

// =====================================================================
//  INPUT
// =====================================================================
const inRun = () => !document.body.classList.contains('inmenu') && (G.mode === 'run' || G.mode === 'tour') && G.state === 'run';
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'range') return;
  audioInit();
  const k = e.code;
  if (k === 'ArrowRight' || k === 'KeyD' || k === 'ArrowUp' || k === 'KeyW') { keyGas = true; e.preventDefault(); }
  if (k === 'ArrowLeft' || k === 'KeyA' || k === 'ArrowDown' || k === 'KeyS') { keyBrake = true; e.preventDefault(); }
  if ((k === 'ShiftLeft' || k === 'ShiftRight' || k === 'KeyL') && !e.repeat && inRun()) setRange(!G.low);
  if (k === 'Escape' || k === 'KeyP') { if (inRun() || (G.paused && (G.mode === 'run' || G.mode === 'tour'))) togglePause(); else if (k === 'Escape') goBack(); }
  if (k === 'KeyR' && inRun()) endRun('quit');
  if (k === 'KeyM') { SET.mute = !SET.mute; persistSet(); applyAudio(); syncSettings(); }
  if (k === 'Space') e.preventDefault();
});
window.addEventListener('keyup', e => {
  const k = e.code;
  if (k === 'ArrowRight' || k === 'KeyD' || k === 'ArrowUp' || k === 'KeyW') keyGas = false;
  if (k === 'ArrowLeft' || k === 'KeyA' || k === 'ArrowDown' || k === 'KeyS') keyBrake = false;
});
const pedal = (id, set) => {
  const el = $(id);
  el.addEventListener('pointerdown', e => { audioInit(); set(true); el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (er) { /* gone */ } e.preventDefault(); });
  const up = () => { set(false); el.classList.remove('on'); };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('lostpointercapture', up);
};
pedal('tGas', v => { touchGas = v; }); pedal('tBrake', v => { touchBrake = v; });
$('tRange').addEventListener('pointerdown', e => { audioInit(); if (inRun()) setRange(!G.low); e.preventDefault(); });
cv.addEventListener('pointerdown', () => audioInit());
window.addEventListener('blur', () => { keyGas = keyBrake = touchGas = touchBrake = false; if (inRun()) togglePause(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (inRun()) togglePause(); if (AU.ctx && AU.ctx.state === 'running') AU.ctx.suspend(); }
  else if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume();
});

// =====================================================================
//  MENUS
// =====================================================================
const PANELS = ['menu', 'regions', 'garage', 'settings', 'help', 'pause', 'over'];
let nav = [];
function show(id, push = true) {
  PANELS.forEach(p => $(p).classList.toggle('hide', p !== id));
  if (push && nav[nav.length - 1] !== id) nav.push(id);
  if (id === 'menu') { nav = ['menu']; refreshMenu(); }
  if (id === 'regions') buildRegions();
  if (id === 'garage') buildGarage();
  if (id === 'settings') syncSettings();
}
function hideAll() { PANELS.forEach(p => $(p).classList.add('hide')); }
function goBack() { if (nav.length <= 1) return; nav.pop(); SFX.ui(); show(nav[nav.length - 1], false); }
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', goBack));
function refreshMenu() {
  if ($('bTour') && window.GBTour) { const t = tourSetup(), b = GBTour.myBest('ridgeline'); $('bTour').innerHTML = '🏆 Weekly tournament<small>' + t.reg.name.replace(' (tournament)', '') + ' · stock ' + VEH[t.veh].name + (b ? ' · your best ' + fmt(b) + ' m' : '') + ' · ends in ' + GBTour.left() + '</small>'; }
  $('mCash').textContent = '$' + fmt(SAVE.cash);
  const r = regionById(SAVE.region);
  $('mInfo').textContent = r.name + ' · best ' + fmt(SAVE.best[r.id] || 0) + ' m · ' + VEH[SAVE.veh].name;
}
function toMenu() {
  G.paused = false; G.tour = null; if ($('oTour')) $('oTour').classList.add('hide'); hud(false); document.body.classList.add('inmenu');
  $('banner').classList.add('hide');
  startRun('demo'); show('menu');
}
function tourRow() {
  const el = $('oTour'); if (!el) return; el.classList.remove('hide'); const r = G.tourRes;
  el.innerHTML = !r ? 'Saving your tournament score…' : (r.improved ? 'New personal best this week! ' : '') + 'Your best: <b>' + fmt(r.best) + ' m</b>' + (r.online ? ' · rank <b>#' + r.rank + '</b> of ' + r.of : ' (offline, saved on this device)') + '<br><a href="/tournament/">Leaderboard and your name</a> · ends in ' + GBTour.left();
}
function driveTour() {
  hideAll(); nav = []; document.body.classList.remove('inmenu');
  startRun('tour');
  setRange(false, true); $('pops').innerHTML = '';
  banner('Weekly tournament', G.reg.name.replace(' (tournament)', '') + ' · stock ' + VEH[G.tour.veh].name);
}
function drive() {
  hideAll(); nav = []; document.body.classList.remove('inmenu');
  startRun('run');
  setRange(false, true); $('pops').innerHTML = '';
  banner(G.reg.name, VEH[SAVE.veh].name + (G.best ? ' · best ' + fmt(G.best) + ' m' : ''));
}
$('bDrive').onclick = () => { SFX.ui(); drive(); };
$('bRegion').onclick = () => { SFX.ui(); show('regions'); };
$('bGarage').onclick = () => { SFX.ui(); gSel = SAVE.veh; show('garage'); };
$('bSet').onclick = () => { SFX.ui(); show('settings'); };
$('bHelp').onclick = () => { SFX.ui(); show('help'); };
$('gDrive').onclick = () => { SFX.ui(); if (SAVE.owned.includes(gSel)) { SAVE.veh = gSel; persist(); } drive(); };
$('oAgain').onclick = () => { SFX.ui(); if (G.mode === 'tour') driveTour(); else drive(); };
if ($('bTour')) $('bTour').onclick = () => { SFX.ui(); driveTour(); };
$('oMenu').onclick = () => { SFX.ui(); toMenu(); };
$('oGarage').onclick = () => { SFX.ui(); toMenu(); gSel = SAVE.veh; show('garage'); };
// ---------- regions
function regionPreview(cvs, reg) {
  const t = cvs.getContext('2d'), w = cvs.width = 440, h = cvs.height = 120;
  const g = t.createLinearGradient(0, h, 0, 0); reg.sky.forEach((c, i) => g.addColorStop(i / (reg.sky.length - 1), c)); t.fillStyle = g; t.fillRect(0, 0, w, h);
  t.fillStyle = `rgba(${reg.sun.c},.9)`; t.beginPath(); t.arc(reg.sun.x * w, reg.sun.y * h * 1.4, 9, 0, TAU); t.fill();
  reg.hills.forEach((c, k) => { t.fillStyle = c; t.beginPath(); t.moveTo(0, h); for (let x = 0; x <= w; x += 6) t.lineTo(x, h * (.45 + k * .13) - (fbm(x * .012 * (k + 1), reg.seed + k * 17, 3) * .5 + .5) * 30); t.lineTo(w, h); t.fill(); });
  t.fillStyle = reg.top; t.beginPath(); t.moveTo(0, h); for (let x = 0; x <= w; x += 4) t.lineTo(x, h * .86 - fbm(x * .02, reg.seed, 3) * 12); t.lineTo(w, h); t.fill();
  t.fillStyle = reg.dirt; t.fillRect(0, h * .95, w, h * .05);
}
function buildRegions() {
  const el = $('regionList'); el.innerHTML = '';
  REGIONS.forEach((r, i) => {
    const ok = regionUnlocked(i), b = document.createElement('button');
    b.className = 'card' + (ok ? '' : ' locked') + (SAVE.region === r.id ? ' sel' : '');
    b.innerHTML = `<canvas></canvas>${ok ? '' : `<div class="lock">Reach ${fmt(r.need)} m on ${REGIONS[i - 1].name}</div>`}<div class="ci"><h4>${r.name}</h4><p>${r.desc}</p><div class="meta"><span>Best <b>${fmt(SAVE.best[r.id] || 0)} m</b></span><span>Cash ×${r.mult}</span></div></div>`;
    regionPreview(b.querySelector('canvas'), r);
    b.onclick = () => { if (!ok) { SFX.warn(); return; } SFX.ui(); SAVE.region = r.id; persist(); buildRegions(); refreshMenu(); };
    b.ondblclick = () => { if (ok) drive(); };
    el.appendChild(b);
  });
}
// ---------- garage
let gSel = SAVE.veh;
function drawPreview() {
  const c = $('vehC'), t = c.getContext('2d'), w = c.width, h = c.height;
  t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, w, h);
  const g = t.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a3129'); g.addColorStop(1, '#16130f'); t.fillStyle = g; t.fillRect(0, 0, w, h);
  t.fillStyle = 'rgba(255,200,140,.08)'; t.beginPath(); t.ellipse(w / 2, h * .82, w * .4, 26, 0, 0, TAU); t.fill();
  const d = VEH[gSel], s = Math.min(w / (d.len + 1.6), h / (d.hgt + 2.4));
  t.setTransform(s, 0, 0, -s, w / 2, h * .82);
  const fake = { id: gSel, d, ch: { x: 0, y: d.R + d.rest - d.anchors[0][1], a: 0 }, wh: d.anchors.map(a => ({ x: a[0], y: d.R })), spin: [.3, 1.1] };
  t.fillStyle = 'rgba(0,0,0,.5)'; t.beginPath(); t.ellipse(0, .02, d.len * .5, .1, 0, 0, TAU); t.fill();
  drawVehicleOn(t, fake);
}
function drawVehicleOn(t, V) {
  const ch = V.ch, d = V.d;
  t.save(); t.translate(ch.x, ch.y);
  for (let i = 0; i < 2; i++) strut(t, d.anchors[i][0], d.anchors[i][1] + .15, V.wh[i].x, V.wh[i].y - ch.y, .16, V.id === 'crawler' ? '#d23b2a' : V.id === 'buggy' ? '#e2b625' : '#c94b2a');
  drawBody(t, V.id, V, false, false); t.restore();
  for (let i = 0; i < 2; i++) { t.save(); t.translate(V.wh[i].x, V.wh[i].y); wheel(t, d.R, V.spin[i], V.id); t.restore(); }
}
function buildGarage() {
  $('gCash').textContent = 'Bank: $' + fmt(SAVE.cash);
  const list = $('vehList'); list.innerHTML = '';
  VEH_ORDER.forEach(id => {
    const v = VEH[id], own = SAVE.owned.includes(id), b = document.createElement('button');
    b.className = id === gSel ? 'on' : '';
    b.innerHTML = `<b>${v.name}</b><small>${own ? (SAVE.veh === id ? 'Driving' : 'Owned') : '$' + fmt(v.price)}</small>`;
    b.onclick = () => { SFX.ui(); gSel = id; if (own) { SAVE.veh = id; persist(); } buildGarage(); };
    list.appendChild(b);
  });
  const v = VEH[gSel], own = SAVE.owned.includes(gSel);
  $('vName').textContent = v.name; $('vDesc').textContent = v.desc;
  drawPreview();
  const ups = $('upList'); ups.innerHTML = '';
  UPS.forEach(u => {
    const lv = SAVE.up[gSel][u.id], cost = upCost(u, lv), d = document.createElement('div'); d.className = 'up';
    d.innerHTML = `<div class="ut"><b>${u.name}</b><small>${u.sub}</small><div class="pips">${Array.from({ length: MAXLV }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
      <button ${!own || lv >= MAXLV || SAVE.cash < cost ? 'disabled' : ''}>${lv >= MAXLV ? 'Max' : '$' + fmt(cost)}</button>`;
    d.querySelector('button').onclick = () => { if (SAVE.cash < cost || lv >= MAXLV) return; SAVE.cash -= cost; SAVE.up[gSel][u.id]++; persist(); SFX.cash(); buildGarage(); refreshMenu(); };
    ups.appendChild(d);
  });
  const vb = $('vBuy');
  if (own) { vb.textContent = SAVE.veh === gSel ? 'Driving this one' : 'Drive this one'; vb.disabled = SAVE.veh === gSel; vb.onclick = () => { SAVE.veh = gSel; persist(); SFX.ui(); buildGarage(); refreshMenu(); }; }
  else { vb.textContent = 'Buy for $' + fmt(v.price); vb.disabled = SAVE.cash < v.price; vb.onclick = () => { if (SAVE.cash < v.price) return; SAVE.cash -= v.price; SAVE.owned.push(gSel); SAVE.veh = gSel; persist(); SFX.camp(); buildGarage(); refreshMenu(); }; }
}
// ---------- settings
function syncSettings() { $('sMaster').value = SET.master; $('sMusic').value = SET.music; $('sSfx').value = SET.sfx; $('sMute').checked = SET.mute; $('sShake').checked = SET.shake; $('sLow').checked = SET.low; $('sMph').checked = SET.mph; }
[['sMaster', 'master'], ['sMusic', 'music'], ['sSfx', 'sfx']].forEach(([id, k]) => $(id).addEventListener('input', e => { SET[k] = +e.target.value; persistSet(); applyAudio(); }));
$('sMute').onchange = e => { SET.mute = e.target.checked; persistSet(); applyAudio(); };
$('sShake').onchange = e => { SET.shake = e.target.checked; persistSet(); };
$('sLow').onchange = e => { SET.low = e.target.checked; persistSet(); resize(); };
$('sMph').onchange = e => { SET.mph = e.target.checked; persistSet(); };
let resetArm = 0;
$('sReset').onclick = () => {
  if (Date.now() - resetArm > 3000) { resetArm = Date.now(); $('sReset').textContent = 'Click again to erase cash, vehicles and records'; return; }
  Object.keys(SAVE).forEach(k => delete SAVE[k]); Object.assign(SAVE, JSON.parse(JSON.stringify(DEF_SAVE)));
  VEH_ORDER.forEach(v => { SAVE.up[v] = { eng: 0, sus: 0, tire: 0, tank: 0 }; }); persist();
  $('sReset').textContent = 'Progress reset'; refreshMenu();
};
// ---------- pause
function togglePause() {
  G.paused = !G.paused;
  if (G.paused) { $('pauseInfo').textContent = G.reg.name + ' · ' + fmt(G.dist) + ' m'; show('pause'); AU.duck = .3; keyGas = keyBrake = touchGas = touchBrake = false; engineSound(false, 0, 0, 0, 700, 0, 700); }
  else { hideAll(); nav = []; AU.duck = .8; }
  applyAudio();
}
$('pResume').onclick = () => { SFX.ui(); togglePause(); };
$('pRestart').onclick = () => { SFX.ui(); G.paused = false; AU.duck = .8; applyAudio(); if (G.mode === 'tour') driveTour(); else drive(); };
$('pSet').onclick = () => { SFX.ui(); show('settings'); };
$('pHelp').onclick = () => { SFX.ui(); show('help'); };
$('pQuit').onclick = () => { SFX.ui(); G.paused = false; hideAll(); endRun('quit'); G.endT = .01; };
$('bHudPause').onclick = () => { audioInit(); if (inRun()) togglePause(); };

// =====================================================================
//  LOOP
// =====================================================================
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now; if (dt > .05) dt = .05; if (dt < 0) dt = 0;
  update(dt); render(dt);
}
window.__rl = { G, SAVE, SET, update, render, startRun, drive, autopilot, VEH, REGIONS, terrainFor, SFX, Music, AU, engineSound, setKeys: (g, b) => { keyGas = g; keyBrake = b; } };
resize();
toMenu();
requestAnimationFrame(frame);
})();
try { if (/[?&]tour/.test(location.search)) { const b = document.getElementById('bTour'); if (b) b.classList.add('pulse'); } } catch (e) { }
