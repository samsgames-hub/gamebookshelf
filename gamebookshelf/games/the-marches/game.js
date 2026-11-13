/* IRONOATH: THE MARCHES — open-world medieval action game. Three.js r128, all art and audio generated in code. */
(() => {
'use strict';
const T = THREE;
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
function rng32(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const h2 = (x, y) => { let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) | 0; n = Math.imul(n ^ n >>> 13, 1274126177); return ((n ^ n >>> 16) >>> 0) / 4294967296; };
function noise2(x, y) { const xi = Math.floor(x), yi = Math.floor(y), tx = smooth(x - xi), ty = smooth(y - yi); return lerp(lerp(h2(xi, yi), h2(xi + 1, yi), tx), lerp(h2(xi, yi + 1), h2(xi + 1, yi + 1), tx), ty); }
function fbm(x, y, o = 4) { let s = 0, a = .5, n = 0; for (let i = 0; i < o; i++) { s += noise2(x, y) * a; n += a; x *= 2.03; y *= 2.03; a *= .5; } return s / n; }
const angDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const fmtTime = s => `${(s / 60) | 0}:${String((s | 0) % 60).padStart(2, '0')}`;

/* ================= Save ================= */
const SAVE_KEY = 'marches_save_v1';
const store = { settings: { master: .8, music: .5, sfx: .9, mute: false, shake: true, low: false, sens: 1 }, game: null, best: 0 };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) { Object.assign(store.settings, s.settings || {}); store.game = s.game || null; store.best = s.best || 0; } } catch (e) { /* storage unavailable */ }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } }
const S = store.settings;

/* ================= Audio ================= */
const AU = { ctx: null };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const c = AU.ctx = new C();
    AU.master = c.createGain(); AU.master.connect(c.destination); AU.mus = c.createGain(); AU.mus.connect(AU.master); AU.sfx = c.createGain(); AU.sfx.connect(AU.master);
    const len = c.sampleRate * 2 | 0, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; AU.noise = buf;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; const dg = c.createGain(); dg.gain.value = 0; lp.connect(dg); dg.connect(AU.mus);
    for (const f of [73.42, 110, 146.6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = rand(-6, 6); o.connect(lp); o.start(); }
    dg.gain.linearRampToValueAtTime(.06, c.currentTime + 3);
    const ws = c.createBufferSource(); ws.buffer = buf; ws.loop = true; const wf = AU.windF = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = .6; const wg = AU.windG = c.createGain(); wg.gain.value = .035; ws.connect(wf); wf.connect(wg); wg.connect(AU.sfx); ws.start();
    applyVolumes();
  } catch (e) { AU.ctx = null; }
}
function applyVolumes() { if (!AU.ctx) return; AU.master.gain.value = S.mute ? 0 : S.master; AU.mus.gain.value = S.music * .8; AU.sfx.gain.value = S.sfx; }
function tone(type, f0, f1, dur, vol, delay = 0, dest) { const c = AU.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(dest || AU.sfx); o.start(t); o.stop(t + dur + .03); }
function noise(dur, vol, type, f0, f1, q = 1, delay = 0, dest) { const c = AU.ctx, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = AU.noise; s.loop = true; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.02, dur * .3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(dest || AU.sfx); s.start(t, Math.random()); s.stop(t + dur + .03); }
const ok = () => AU.ctx && G.mode !== 'title';
const SFX = {
  swing(h) { if (!ok()) return; noise(h ? .28 : .17, h ? .3 : .2, 'bandpass', h ? 360 : 700, h ? 1500 : 2200, 1.4); },
  clang(p = 1, v = .2) { if (!ok()) return; const b = rand(520, 640) * p; for (const [r, a, d] of [[1, 1, .28], [2.76, .6, .22], [5.4, .4, .16], [8.93, .25, .1]]) tone('square', b * r, b * r * .995, d, v * a * .5); noise(.07, v * 1.4, 'highpass', 3000, 5000, .7); },
  parry() { if (!ok()) return; const b = rand(1180, 1320); for (const [r, a, d] of [[1, 1, .9], [2.41, .6, .7], [3.9, .4, .45]]) tone('sine', b * r, b * r * .99, d, .2 * a); noise(.06, .35, 'highpass', 4000, 6000, .7); },
  hit(h) { if (!ok()) return; tone('sine', h ? 150 : 180, 45, h ? .26 : .16, h ? .7 : .45); noise(h ? .2 : .12, h ? .5 : .36, 'lowpass', h ? 1400 : 1800, 200, .8); },
  hurt() { if (!ok()) return; tone('sine', 130, 40, .3, .7); noise(.25, .5, 'lowpass', 1100, 150, .8); SFX.clang(.6, .08); },
  step(w) { if (!ok()) return; noise(.07, w ? .05 : .09, 'lowpass', w ? 900 : 420, 140, .8); },
  roll() { if (!ok()) return; noise(.3, .22, 'bandpass', 260, 800, .9); },
  cue() { if (!ok()) return; tone('sine', 1900, 1900, .07, .14); },
  warn() { if (!ok()) return; tone('sawtooth', 180, 120, .3, .12); noise(.3, .15, 'bandpass', 300, 200, 3); },
  growl() { if (!ok()) return; tone('sawtooth', 95, 70, .4, .1); noise(.4, .16, 'bandpass', 240, 160, 5); },
  squeal() { if (!ok()) return; tone('sawtooth', 420, 260, .3, .08); noise(.3, .12, 'bandpass', 900, 500, 4); },
  bow() { if (!ok()) return; tone('triangle', 240, 110, .12, .25); noise(.12, .12, 'highpass', 2500, 4000, 1); },
  thud() { if (!ok()) return; noise(.08, .25, 'lowpass', 900, 300, 1); },
  death() { if (!ok()) return; tone('sine', 110, 32, .6, .7); noise(.5, .45, 'lowpass', 900, 90, .7); },
  click() { if (!AU.ctx) return; tone('triangle', 520, 330, .07, .25); noise(.03, .12, 'bandpass', 1800, 1200, 2); },
  coin() { if (!AU.ctx) return; tone('sine', 1320, 1320, .12, .2); tone('sine', 1760, 1760, .22, .18, .07); },
  deny() { if (!AU.ctx) return; tone('square', 140, 110, .12, .12); },
  chest() { if (!ok()) return; noise(.35, .2, 'bandpass', 500, 220, 3); tone('triangle', 392, 392, .18, .16, .25); tone('triangle', 587, 587, .3, .16, .4); },
  pickup() { if (!ok()) return; tone('triangle', 660, 880, .12, .16); },
  heal() { if (!ok()) return; tone('sine', 440, 660, .5, .14); tone('sine', 660, 990, .5, .1, .15); },
  shrine() { if (!ok()) return; for (const [f, d] of [[294, 0], [440, .2], [587, .4], [880, .6]]) tone('sine', f, f, 1.2, .14, d); },
  level() { if (!AU.ctx) return; [[293.7, 0], [440, .14], [587.3, .28], [740, .42]].forEach(([f, d]) => { tone('sawtooth', f, f, .3, .09, d); tone('square', f * 2, f * 2, .3, .03, d); }); },
  fanfare() { if (!AU.ctx) return; [[293.7, 0], [440, .16], [587.3, .32], [587.3, .5]].forEach(([f, d], i) => { tone('sawtooth', f, f, i === 3 ? .8 : .2, .11, d); tone('square', f * 1.5, f * 1.5, i === 3 ? .8 : .2, .04, d); }); },
  dirge() { if (!AU.ctx) return; [[220, 0], [196, .35], [174.6, .7], [146.8, 1.05]].forEach(([f, d], i) => tone('triangle', f, f, i === 3 ? 1.4 : .5, .16, d)); },
  bird() { if (!ok()) return; const f = rand(2200, 3400); for (let i = 0; i < 3; i++) tone('sine', f, f * rand(1.1, 1.4), .09, .03, i * .13); },
  cricket() { if (!ok()) return; for (let i = 0; i < 4; i++) tone('square', 4200, 4200, .03, .012, i * .07); },
};
const MUS = { mode: 'menu', next: 0, step: 0 };
const SC = [0, 2, 3, 5, 7, 9, 10];
const dfreq = (deg, oct = 0) => 146.83 * Math.pow(2, (SC[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7)) / 12 + oct);
const PHR = [[4, null, 4, 5, 4, 2, null, 0], [2, null, 4, 2, 1, 0, null, -1], [7, null, 6, 4, 5, 4, 2, null], [0, 1, 2, null, 4, 2, 1, 0], [4, 5, 7, null, 8, 7, 5, 4], [2, 4, 2, 1, 0, null, 0, null]];
const SEQ = [0, 1, 0, 3, 2, 1, 4, 5], ROOT = [0, 0, -1, 0, 2, -1, -3, 0];
function pluck(f, t, v, dur = .42) { const c = AU.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + .004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); for (const [ty, m, d] of [['triangle', 1, 0], ['sawtooth', 1, 5], ['sine', 2, 0]]) { const o = c.createOscillator(); o.type = ty; o.frequency.value = f * m; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + .03); } lp.connect(g); g.connect(AU.mus); }
function musicTick() {
  if (!AU.ctx || AU.ctx.state !== 'running') return; const t = AU.ctx.currentTime, battle = MUS.mode === 'battle';
  if (MUS.next < t) MUS.next = t + .06;
  while (MUS.next < t + .3) {
    const s = MUS.step % 64, bar = (s / 8) | 0, i = s % 8, at = MUS.next, deg = PHR[SEQ[bar]][i], root = ROOT[bar];
    if (deg !== null && (battle || i % 2 === 0 || bar % 2 === 1)) pluck(dfreq(deg, battle ? 1 : 0), at, battle ? .11 : .08, battle ? .3 : .7);
    if (i === 0) pluck(dfreq(root, -1), at, .15, .9); if (i === 4) pluck(dfreq(root + 4, -1), at, .09, .6);
    if (battle) { if (i === 0 || i === 3 || i === 6) { tone('sine', i === 0 ? 95 : 120, 48, .2, i === 0 ? .5 : .3, at - t, AU.mus); noise(.09, i === 0 ? .2 : .12, 'lowpass', 700, 200, .8, at - t, AU.mus); } if (i % 2 === 1) noise(.035, .05, 'highpass', 5000, 5000, .8, at - t, AU.mus); }
    MUS.next += 60 / (battle ? 124 : 72) / 2; MUS.step++;
  }
}

/* ================= World data ================= */
const WORLD = 320, RES = 2, N = WORLD * 2 / RES + 1;
const CAMPS = [{ n: "Miller's Ford Camp", x: 150, z: -60, tier: 0 }, { n: 'Hollow Wood Camp', x: -170, z: -110, tier: 1 }, { n: 'Stonefield Camp', x: -60, z: 190, tier: 2 }];
const KEEP = { x: 180, z: 140, half: 17 };
const FIRES = [{ n: 'Greywatch Camp', x: 0, z: 0 }, { n: 'Lakeside Fire', x: -150, z: 5 }, { n: "Pilgrim's Rest", x: 115, z: 95 }];
const SHRINES = [{ x: 60, z: -150, buff: 'hp', t: '+20 maximum health' }, { x: -235, z: 40, buff: 'stam', t: '+25 maximum stamina' }, { x: 35, z: 112, buff: 'dmg', t: '+12% damage' }, { x: 232, z: -120, buff: 'band', t: '+2 bandage capacity, and 2 bandages' }];
const DENS = [{ x: -60, z: -90 }, { x: 90, z: -170 }, { x: -185, z: 160 }, { x: 150, z: 55 }];
const BOARS = [{ x: -30, z: 100 }, { x: 45, z: -65 }];
const LAKES = [{ x: -120, z: 62, r: 46 }, { x: 95, z: 8, r: 18 }];
const CHESTS = [
  { x: 26, z: -22, loot: { w: 'axe', g: 20 } }, { x: -60, z: 20, loot: { a: 'gambeson' } }, { x: 105, z: -40, loot: { b: 2, g: 40 } }, { x: -115, z: -45, loot: { w: 'longsword' } },
  { x: 15, z: 150, loot: { a: 'mail' } }, { x: -215, z: 100, loot: { w: 'mace' } }, { x: 215, z: 20, loot: { g: 80, b: 1 } }, { x: -20, z: -215, loot: { a: 'brig' } },
  { x: 130, z: -215, loot: { w: 'poleaxe' } }, { x: -195, z: -160, loot: { a: 'plate' } },
  { x: CAMPS[0].x + 5, z: CAMPS[0].z - 4, loot: { g: 60, b: 2 } }, { x: CAMPS[1].x + 5, z: CAMPS[1].z - 4, loot: { g: 100, b: 2 } }, { x: CAMPS[2].x + 5, z: CAMPS[2].z - 4, loot: { w: 'greatsword', g: 60 } },
];
const WEAPONS = {
  sword: { n: 'Arming Sword', dmg: 18, reach: 2.3, spd: 1, len: .85, kind: 'sword' }, axe: { n: 'Bearded Axe', dmg: 23, reach: 2.2, spd: .93, len: .8, kind: 'axe' },
  longsword: { n: 'Longsword', dmg: 28, reach: 2.7, spd: .95, len: 1.12, kind: 'sword' }, mace: { n: 'War Mace', dmg: 33, reach: 2.3, spd: .88, len: .8, kind: 'mace' },
  poleaxe: { n: 'Poleaxe', dmg: 38, reach: 3.4, spd: .78, len: 1.7, kind: 'pole' }, greatsword: { n: 'Greatsword', dmg: 46, reach: 3.1, spd: .72, len: 1.42, kind: 'sword' },
};
const ARMORS = {
  tunic: { n: "Traveller's Tunic", def: 0, col: 0x6e5c44, limb: 0x4a4034 }, gambeson: { n: 'Gambeson', def: .12, col: 0x9a8a62, limb: 0x7d7052 }, mail: { n: 'Mail Hauberk', def: .24, col: 0x6f757f, limb: 0x5c626b, metal: 1 },
  brig: { n: 'Brigandine', def: .33, col: 0x6a3328, limb: 0x70757e, metal: 1 }, plate: { n: 'Full Plate', def: .44, col: 0xaab3bf, limb: 0x98a1ae, metal: 1 },
};
const flats = [];
const PATHS = [];
function mkPath(a, b, seed) { const d = Math.hypot(b.x - a.x, b.z - a.z), n = Math.max(2, Math.round(d / 10)), nx = -(b.z - a.z) / d, nz = (b.x - a.x) / d, pts = []; for (let i = 0; i <= n; i++) { const t = i / n, w = (fbm(t * 3 + seed, seed * 1.7, 2) - .5) * 26 * Math.sin(t * Math.PI); pts.push([lerp(a.x, b.x, t) + nx * w, lerp(a.z, b.z, t) + nz * w]); } PATHS.push(pts); }
mkPath(FIRES[0], CAMPS[0], 1); mkPath(FIRES[0], CAMPS[1], 2); mkPath(FIRES[0], CAMPS[2], 3); mkPath(FIRES[0], FIRES[1], 4); mkPath(FIRES[0], FIRES[2], 5); mkPath(CAMPS[0], FIRES[2], 6); mkPath(FIRES[2], { x: KEEP.x - 22, z: KEEP.z }, 7);
function baseH(x, z) {
  let h = fbm(x * .007 + 3.1, z * .007 + 7.7) * 26 - 7 + (fbm(x * .035, z * .035, 3) - .5) * 4;
  if (h < 1.6) h = 1.6 + (h - 1.6) * .3;
  const r = Math.hypot(x, z); if (r > 265) h += (r - 265) * (r - 265) * .03;
  const dk = Math.hypot(x - KEEP.x, z - KEEP.z); h += 9 * Math.exp(-dk * dk / 3200);
  for (const L of LAKES) { const d = Math.hypot(x - L.x, z - L.z); if (d < L.r + 16) h = lerp(h, -3.5, smooth(clamp((L.r + 16 - d) / 16, 0, 1))); }
  return h;
}
const addFlat = (x, z, r) => flats.push({ x, z, r, y: Math.max(1.5, baseH(x, z)) });
FIRES.forEach((f, i) => addFlat(f.x, f.z, i ? 13 : 24)); CAMPS.forEach(c => addFlat(c.x, c.z, 27)); addFlat(KEEP.x, KEEP.z, 36); SHRINES.forEach(s => addFlat(s.x, s.z, 9)); DENS.forEach(d => addFlat(d.x, d.z, 11)); CHESTS.forEach(c => addFlat(c.x, c.z, 4));
function rawH(x, z) { let h = baseH(x, z); for (const f of flats) { const d = Math.hypot(x - f.x, z - f.z); if (d < f.r) h = lerp(h, f.y, smooth(clamp((f.r - d) / (f.r * .45), 0, 1))); } return h; }
const HM = new Float32Array(N * N), PD = new Float32Array(N * N);
for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) {
  const x = -WORLD + ix * RES, z = -WORLD + iz * RES; HM[iz * N + ix] = rawH(x, z);
  let best = 99; for (const p of PATHS) for (let i = 1; i < p.length; i++) { const ax = p[i - 1][0], az = p[i - 1][1], bx = p[i][0] - ax, bz = p[i][1] - az; if (Math.abs(x - ax) > 30 || Math.abs(z - az) > 30) continue; const t = clamp(((x - ax) * bx + (z - az) * bz) / (bx * bx + bz * bz), 0, 1), d = Math.hypot(x - ax - bx * t, z - az - bz * t); if (d < best) best = d; }
  PD[iz * N + ix] = best;
}
function grid(A, x, z) { const fx = clamp((x + WORLD) / RES, 0, N - 1.001), fz = clamp((z + WORLD) / RES, 0, N - 1.001), ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * N + ix; return (A[i] * (1 - tx) + A[i + 1] * tx) * (1 - tz) + (A[i + N] * (1 - tx) + A[i + N + 1] * tx) * tz; }
const H = (x, z) => grid(HM, x, z), pathD = (x, z) => grid(PD, x, z);
const slope = (x, z) => Math.hypot(H(x + 2, z) - H(x - 2, z), H(x, z + 2) - H(x, z - 2)) / 4;
const forest = (x, z) => fbm(x * .011 + 50, z * .011 + 20, 3);
function landColor(x, z, h, sl, pd, o) {
  const n = fbm(x * .05 + 11, z * .05 + 3, 2), f = forest(x, z);
  let r = lerp(.23, .37, n), g = lerp(.36, .46, n), b = lerp(.12, .18, n);
  if (f > .5) { const k = clamp((f - .5) * 5, 0, 1) * .6; r = lerp(r, .18, k); g = lerp(g, .27, k); b = lerp(b, .11, k); }
  if (h > 14) { const k = clamp((h - 14) / 8, 0, 1); r = lerp(r, .44, k); g = lerp(g, .44, k); b = lerp(b, .42, k); }
  if (sl > .55) { const k = clamp((sl - .55) * 3, 0, 1); r = lerp(r, .41, k); g = lerp(g, .38, k); b = lerp(b, .34, k); }
  if (pd < 3.4) { const k = clamp(1 - (pd - 1.2) / 2.2, 0, 1); r = lerp(r, .45, k); g = lerp(g, .36, k); b = lerp(b, .24, k); }
  if (h < .9) { const k = clamp((.9 - h) / .8, 0, 1); r = lerp(r, .62, k); g = lerp(g, .56, k); b = lerp(b, .4, k); }
  if (h < -.6) { const k = clamp((-.6 - h) / 2, 0, 1); r = lerp(r, .18, k); g = lerp(g, .25, k); b = lerp(b, .23, k); }
  o[0] = r; o[1] = g; o[2] = b;
}
const nearPOI = (x, z, pad) => flats.some(f => Math.hypot(x - f.x, z - f.z) < f.r + pad);

/* ================= Renderer & scene ================= */
const cv = $('game');
const renderer = new T.WebGLRenderer({ canvas: cv, antialias: !S.low, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = !S.low; renderer.shadowMap.type = T.PCFSoftShadowMap;
const scene = new T.Scene(); scene.fog = new T.Fog(0xb9d4e8, 50, 250);
const camera = new T.PerspectiveCamera(58, 1, .3, 1400);
const hemi = new T.HemisphereLight(0xcfe2ff, 0x4a4a38, .75); scene.add(hemi);
const sun = new T.DirectionalLight(0xfff2dd, 1); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = sun.shadow.camera.bottom = -42; sun.shadow.camera.right = sun.shadow.camera.top = 42; sun.shadow.camera.near = 10; sun.shadow.camera.far = 260; sun.shadow.bias = -.0006; scene.add(sun, sun.target);
const lantern = new T.PointLight(0xffb060, 0, 16, 1.6); scene.add(lantern);
const fireLight = new T.PointLight(0xff8a3c, 1.4, 26, 1.5); scene.add(fireLight);
function resize() { const w = Math.max(200, innerWidth), h = Math.max(200, innerHeight); renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, S.low ? 1 : 1.75)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = h > w ? 72 : 58; camera.updateProjectionMatrix(); }
function canvasTex(size, paint, rep) { const c = document.createElement('canvas'); c.width = c.height = size; paint(c.getContext('2d'), size); const t = new T.CanvasTexture(c); if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep, rep); } t.anisotropy = 4; return t; }
const speck = (g, s, n, cols, r, mn = 1, mx = 3) => { for (let i = 0; i < n; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; g.fillRect(r() * s, r() * s, mn + r() * (mx - mn), mn + r() * (mx - mn)); } };
const TEX = {
  ground: canvasTex(256, (g, s) => { const r = rng32(1); g.fillStyle = '#d9d9d9'; g.fillRect(0, 0, s, s); speck(g, s, 5000, ['#bdbdbd', '#f2f2f2', '#c9c9c9', '#e6e6e6', '#a9a9a9'], r, 1, 4); for (let i = 0; i < 500; i++) { g.strokeStyle = r() < .5 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.2)'; g.beginPath(); const x = r() * s, y = r() * s; g.moveTo(x, y); g.lineTo(x + (r() - .5) * 5, y - 3 - r() * 7); g.stroke(); } }, 1),
  stone: canvasTex(256, (g, s) => { const r = rng32(2); g.fillStyle = '#5d5a55'; g.fillRect(0, 0, s, s); for (let y = 0, row = 0; y < s; y += 32, row++) for (let x = -(row % 2) * 32; x < s; x += 64) { const v = 120 + r() * 40 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 10})`; g.fillRect(x + 2, y + 2, 60, 28); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x + 2, y + 2, 60, 3); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + 2, y + 26, 60, 4); } speck(g, s, 2500, ['rgba(0,0,0,.12)', 'rgba(255,255,255,.08)', 'rgba(60,80,40,.14)'], r, 1, 5); }, 1),
  wood: canvasTex(128, (g, s) => { const r = rng32(3); g.fillStyle = '#6b4a2c'; g.fillRect(0, 0, s, s); for (let x = 0; x < s; x += 16) { g.fillStyle = `rgb(${96 + r() * 30 | 0},${66 + r() * 20 | 0},${38 + r() * 14 | 0})`; g.fillRect(x + 1, 0, 14, s); } for (let i = 0; i < 260; i++) { g.strokeStyle = r() < .6 ? 'rgba(0,0,0,.2)' : 'rgba(255,220,170,.12)'; const x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 2, y + 6 + r() * 22); g.stroke(); } }, 1),
  cloth: canvasTex(64, (g, s) => { const r = rng32(4); g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, s, s); for (let i = 0; i < s; i += 2) { g.fillStyle = `rgba(0,0,0,${.04 + r() * .08})`; g.fillRect(i, 0, 1, s); g.fillRect(0, i, s, 1); } }, 2),
  grass: canvasTex(128, (g, s) => { const r = rng32(5); g.clearRect(0, 0, s, s); for (let i = 0; i < 26; i++) { const x = 8 + r() * (s - 16), h = s * (.45 + r() * .5), w = 3 + r() * 4, lean = (r() - .5) * 26; g.fillStyle = `rgb(${70 + r() * 50 | 0},${120 + r() * 60 | 0},${40 + r() * 30 | 0})`; g.beginPath(); g.moveTo(x - w, s); g.quadraticCurveTo(x + lean * .3, s - h * .6, x + lean, s - h); g.quadraticCurveTo(x + lean * .5, s - h * .5, x + w, s); g.fill(); } }),
  glow: canvasTex(64, (g, s) => { const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.35, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); }),
  cloud: canvasTex(128, (g, s) => { const r = rng32(6); for (let i = 0; i < 16; i++) { const x = 20 + r() * (s - 40), y = 44 + r() * 40, rad = 14 + r() * 22, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, s, s); } }),
  slash: canvasTex(128, (g, s) => { g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineCap = 'round'; for (let i = 0; i < 5; i++) { g.lineWidth = 9 - i * 1.6; g.globalAlpha = .25 + i * .15; g.beginPath(); g.arc(s / 2, s * .95, s * .78 - i * 2, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); } }),
};
const MX = (x, y, z, sx = 1, sy = sx, sz = sx, ry = 0, rx = 0, rz = 0) => new T.Matrix4().compose(new T.Vector3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), new T.Vector3(sx, sy, sz));
const C3 = hex => { const c = new T.Color(hex); return [c.r, c.g, c.b]; };
function merge(list) {
  let n = 0; const parts = list.map(([g, m, c]) => { const q = g.index ? g.toNonIndexed() : g.clone(); if (m) q.applyMatrix4(m); n += q.attributes.position.count; return [q, typeof c === 'number' ? C3(c) : c]; });
  const p = new Float32Array(n * 3), nr = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const [q, c] of parts) { const cnt = q.attributes.position.count; p.set(q.attributes.position.array, o * 3); nr.set(q.attributes.normal.array, o * 3); for (let i = 0; i < cnt; i++) col.set(c, (o + i) * 3); o += cnt; q.dispose(); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(p, 3)); g.setAttribute('normal', new T.BufferAttribute(nr, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); return g;
}
const SEG = S.low ? 9 : 16;
const GEO = { box: new T.BoxGeometry(1, 1, 1), cyl: new T.CylinderGeometry(1, 1, 1, SEG), taper: new T.CylinderGeometry(.62, 1, 1, SEG), cone: new T.ConeGeometry(1, 1, SEG), sph: new T.SphereGeometry(1, SEG + 4, SEG - 2), dome: new T.SphereGeometry(1, SEG + 4, 9, 0, Math.PI * 2, 0, Math.PI * .58), torus: new T.TorusGeometry(1, .14, 8, SEG + 8) };
const lathe = (pts, seg = SEG) => new T.LatheGeometry(pts.map(q => new T.Vector2(Math.max(q[0], 1e-4), q[1])), seg);
const CAPS = new Map();
function capsule(r0, r1, len) { // rounded limb hanging down from the origin
  const k = r0 + ',' + r1 + ',' + len; if (CAPS.has(k)) return CAPS.get(k); const p = [], n = 6;
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI / 2; p.push([r1 * Math.cos(a), -len + r1 * Math.sin(a)]); }
  for (let i = 1; i <= n; i++) { const a = i / n * Math.PI / 2; p.push([r0 * Math.cos(a), r0 * Math.sin(a)]); }
  const g = lathe(p); CAPS.set(k, g); return g;
}
function blob(detail, amp, seed, freq = 1.4) { // smooth lumpy sphere for foliage and stones
  const g = new T.IcosahedronGeometry(1, detail), pp = g.attributes.position, nn = g.attributes.normal;
  for (let i = 0; i < pp.count; i++) { const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), d = 1 + (fbm(x * freq + seed + 9, y * freq * .8 + z * freq + seed, 3) - .5) * 2 * amp; pp.setXYZ(i, x * d, y * d, z * d); const l = Math.hypot(x, y * .85, z) || 1; nn.setXYZ(i, x / l, y * .85 / l, z / l); }
  return g;
}
const FOLG = blob(2, .2, 3), ROCKG = blob(2, .28, 17, 1.1), ROCK2 = blob(1, .22, 41, 1.3);
renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
const STD = [];
const std = o => { const m = new T.MeshStandardMaterial(o); STD.push(m); return m; };
const MAT = {
  land: std({ vertexColors: true, map: TEX.ground, roughness: 1, metalness: 0 }), vc: std({ vertexColors: true, roughness: .88, metalness: 0 }), foliage: std({ vertexColors: true, roughness: .95, metalness: 0 }),
  cloth: std({ vertexColors: true, roughness: .8, metalness: 0 }), clothDS: std({ vertexColors: true, roughness: .85, metalness: 0, side: T.DoubleSide }), metal: std({ vertexColors: true, roughness: .3, metalness: .82 }), rock: std({ color: 0xffffff, map: TEX.stone, roughness: .95, metalness: 0 }),
  stone: std({ map: TEX.stone, color: 0xd8d2c8, roughness: .95 }), wood: std({ map: TEX.wood, roughness: .9 }),
  white: new T.MeshBasicMaterial({ color: 0xffffff }), dark: std({ color: 0x1c1a18, roughness: .8 }),
};
MAT.vcShiny = MAT.metal; MAT.vcFlat = MAT.foliage;
{ // image-based light so metal armour reflects the sky
  const es = new T.Scene(), sg = new T.SphereGeometry(10, 32, 16), cc = new Float32Array(sg.attributes.position.count * 3), top = new T.Color(0x6f9fe0), hor = new T.Color(0xe4ecf0), gr = new T.Color(0x4e4a3c), t = new T.Color();
  for (let i = 0; i < sg.attributes.position.count; i++) { const y = sg.attributes.position.getY(i) / 10; if (y >= 0) t.copy(hor).lerp(top, Math.pow(y, .55)); else t.copy(hor).lerp(gr, Math.min(1, -y * 4)); cc.set([t.r, t.g, t.b], i * 3); }
  sg.setAttribute('color', new T.BufferAttribute(cc, 3)); const sun2 = new T.Mesh(new T.SphereGeometry(1.2, 12, 8), new T.MeshBasicMaterial({ color: 0xffffff })); sun2.position.set(5, 6, 3);
  es.add(new T.Mesh(sg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })), sun2);
  const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, .04).texture; pm.dispose();
}
/* terrain */
{
  const pos = new Float32Array(N * N * 3), col = new Float32Array(N * N * 3), uv = new Float32Array(N * N * 2), c = [0, 0, 0];
  for (let iz = 0; iz < N; iz++) for (let ix = 0; ix < N; ix++) { const i = iz * N + ix, x = -WORLD + ix * RES, z = -WORLD + iz * RES, h = HM[i]; pos[i * 3] = x; pos[i * 3 + 1] = h; pos[i * 3 + 2] = z; uv[i * 2] = x / 7; uv[i * 2 + 1] = z / 7; landColor(x, z, h, slope(x, z), PD[i], c); col.set(c, i * 3); }
  const idx = new Uint32Array((N - 1) * (N - 1) * 6); let k = 0; for (let iz = 0; iz < N - 1; iz++) for (let ix = 0; ix < N - 1; ix++) { const a = iz * N + ix, b = a + 1, cc = a + N, d = cc + 1; idx[k++] = a; idx[k++] = cc; idx[k++] = b; idx[k++] = b; idx[k++] = cc; idx[k++] = d; }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2)); g.setIndex(new T.BufferAttribute(idx, 1)); g.computeVertexNormals();
  const m = new T.Mesh(g, MAT.land); m.receiveShadow = true; scene.add(m);
}
const water = new T.Mesh(new T.PlaneGeometry(760, 760), new T.MeshPhongMaterial({ color: 0x2f6170, transparent: true, opacity: .8, shininess: 120, specular: 0xaaccdd })); water.rotation.x = -Math.PI / 2; scene.add(water);
/* map image */
const mapImg = document.createElement('canvas'); mapImg.width = mapImg.height = 320;
{ const g = mapImg.getContext('2d'), d = g.createImageData(320, 320), c = [0, 0, 0]; for (let y = 0; y < 320; y++) for (let x = 0; x < 320; x++) { const wx = -WORLD + x * 2, wz = -WORLD + y * 2, i = y * N + x, h = HM[i]; landColor(wx, wz, h, 0, PD[i], c); const sh = clamp(.82 + (h - HM[Math.min(N * N - 1, i + N + 1)]) * .12, .55, 1.15), o = (y * 320 + x) * 4; if (h < 0) { c[0] = .2; c[1] = .36; c[2] = .44; } d.data[o] = c[0] * 255 * sh * 1.35; d.data[o + 1] = c[1] * 255 * sh * 1.25; d.data[o + 2] = c[2] * 255 * sh * 1.2; d.data[o + 3] = 255; } g.putImageData(d, 0, 0); }
/* sky */
const sky = new T.Mesh(new T.SphereGeometry(1100, 24, 12), new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false, depthWrite: false })); sky.geometry.setAttribute('color', new T.BufferAttribute(new Float32Array(sky.geometry.attributes.position.count * 3), 3)); scene.add(sky);
const sunDisc = new T.Sprite(new T.SpriteMaterial({ map: TEX.glow, color: 0xfff0c0, fog: false, depthWrite: false, blending: T.AdditiveBlending })); sunDisc.scale.set(220, 220, 1); scene.add(sunDisc);
const clouds = []; { const r = rng32(9); for (let i = 0; i < 14; i++) { const s = new T.Sprite(new T.SpriteMaterial({ map: TEX.cloud, fog: false, depthWrite: false, transparent: true, opacity: .85 })); s.position.set((r() - .5) * 1500, 220 + r() * 120, (r() - .5) * 1500); const k = 260 + r() * 260; s.scale.set(k, k * .42, 1); scene.add(s); clouds.push(s); } }
const cTop = new T.Color(), cHor = new T.Color(), cTmp = new T.Color();
const SKY = { dayT: new T.Color(0x3b74c4), dayH: new T.Color(0xb7d2e6), duskT: new T.Color(0x2b2f5c), duskH: new T.Color(0xe7955a), nightT: new T.Color(0x04060e), nightH: new T.Color(0x10182a) };
let skyKey = -1;
function updateSky(tod, px, pz) {
  const ang = (tod - .25) * Math.PI * 2, sy = Math.sin(ang), sx = Math.cos(ang), day = smooth(clamp((sy + .08) / .34, 0, 1)), dusk = clamp(1 - Math.abs(sy) * 3.2, 0, 1);
  cTop.copy(SKY.nightT).lerp(SKY.dayT, day).lerp(SKY.duskT, dusk * .55); cHor.copy(SKY.nightH).lerp(SKY.dayH, day).lerp(SKY.duskH, dusk * .8);
  const key = Math.round(tod * 2000); if (key !== skyKey) { skyKey = key; const p = sky.geometry.attributes.position, c = sky.geometry.attributes.color; for (let i = 0; i < p.count; i++) { const t = clamp(p.getY(i) / 500, 0, 1); cTmp.copy(cHor).lerp(cTop, Math.pow(t, .6)); c.setXYZ(i, cTmp.r, cTmp.g, cTmp.b); } c.needsUpdate = true; }
  scene.fog.color.copy(cHor); renderer.setClearColor(cHor);
  const night = 1 - day; sun.intensity = lerp(.16, 1.05, day); sun.color.setHex(0xfff2dd).lerp(cTmp.setHex(0xff9a55), dusk * .7).lerp(cTmp.setHex(0x8fa6d8), night);
  hemi.intensity = lerp(.22, .5, day); hemi.color.copy(cHor).lerp(cTmp.setHex(0xffffff), .35);
  const dx = sy > -.05 ? sx : .35, dy = sy > -.05 ? Math.max(.12, sy) : .8, dz = .45, l = Math.hypot(dx, dy, dz);
  sun.position.set(px + dx / l * 120, H(px, pz) + dy / l * 120, pz + dz / l * 120); sun.target.position.set(px, H(px, pz), pz);
  sunDisc.position.set(px + sx * 900, sy * 900, pz + .45 * 900 * .5); sunDisc.material.opacity = clamp(sy * 4 + .5, 0, 1); sunDisc.material.color.setHex(0xfff0c0).lerp(cTmp.setHex(0xff9050), dusk);
  sky.position.set(px, 0, pz); lantern.intensity = night * .9; const ei = lerp(.12, .85, day); if (STD[0].envMapIntensity !== ei) for (const m of STD) m.envMapIntensity = ei;
  for (const c of clouds) { c.position.x += .02; if (c.position.x > 800) c.position.x = -800; c.material.color.copy(cHor).lerp(cTmp.setHex(0xffffff), day * .7); c.material.opacity = lerp(.25, .85, day); }
  return night;
}

/* ================= Collision ================= */
const CG = new Map(), BOXES = [];
function addCircle(x, z, r) { const k = ((Math.floor(x / 8) + 64) << 8) | (Math.floor(z / 8) + 64); let a = CG.get(k); if (!a) { a = []; CG.set(k, a); } a.push(x, z, r); }
function resolve(p, rad) {
  const cx = Math.floor(p.x / 8) + 64, cz = Math.floor(p.z / 8) + 64;
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) { const a = CG.get(((cx + dx) << 8) | (cz + dz)); if (!a) continue; for (let i = 0; i < a.length; i += 3) { const ex = p.x - a[i], ez = p.z - a[i + 1], rr = rad + a[i + 2], d2 = ex * ex + ez * ez; if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2); p.x = a[i] + ex / d * rr; p.z = a[i + 1] + ez / d * rr; } } }
  for (const b of BOXES) { if (b.off) continue; const nx = clamp(p.x, b.x0, b.x1), nz = clamp(p.z, b.z0, b.z1), ex = p.x - nx, ez = p.z - nz, d2 = ex * ex + ez * ez; if (d2 >= rad * rad) continue; if (d2 > 1e-6) { const d = Math.sqrt(d2); p.x = nx + ex / d * rad; p.z = nz + ez / d * rad; } else { const l = p.x - b.x0, r = b.x1 - p.x, t = p.z - b.z0, bt = b.z1 - p.z, m = Math.min(l, r, t, bt); if (m === l) p.x = b.x0 - rad; else if (m === r) p.x = b.x1 + rad; else if (m === t) p.z = b.z0 - rad; else p.z = b.z1 + rad; } }
  const r = Math.hypot(p.x, p.z); if (r > 292) { p.x *= 292 / r; p.z *= 292 / r; }
}
function moveActor(p, dx, dz, rad) { if (H(p.x + dx, p.z) > -.75) p.x += dx; if (H(p.x, p.z + dz) > -.75) p.z += dz; resolve(p, rad); p.y = H(p.x, p.z); }

/* ================= Vegetation & props ================= */
function instanced(geo, mat, mats, shadow = true, cols) { const m = new T.InstancedMesh(geo, mat, mats.length); const wh = new T.Color(1, 1, 1); mats.forEach((x, i) => { m.setMatrixAt(i, x); m.setColorAt(i, cols ? cols[i] : wh); }); m.castShadow = shadow; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); return m; }
const logMats = [], rockMats = [], rockCols = [];
{
  const r = rng32(77), pines = [], oaks = [], pc = [], oc = [];
  const pineG = merge([[GEO.taper, MX(0, 1.5, 0, .24, 3, .24), 0x4a3423], [GEO.cone, MX(0, 2.7, 0, 2.1, 2.2, 2.1), 0x21402a], [GEO.cone, MX(0, 3.8, 0, 1.8, 2.1, 1.8), 0x264a2e], [GEO.cone, MX(0, 4.9, 0, 1.45, 2, 1.45), 0x2b5233], [GEO.cone, MX(0, 5.9, 0, 1.1, 1.9, 1.1), 0x305a37], [GEO.cone, MX(0, 6.9, 0, .7, 1.6, .7), 0x356039]]);
  const oakG = merge([[GEO.taper, MX(0, 1.5, 0, .36, 3, .36), 0x4f3a28], [GEO.taper, MX(.55, 3, .1, .13, 1.6, .13, 0, 0, -.7), 0x4f3a28], [GEO.taper, MX(-.5, 3.1, -.2, .12, 1.5, .12, .4, 0, .75), 0x4f3a28],
    [FOLG, MX(0, 4.3, 0, 2.2, 1.75, 2.2), 0x3d6a2c], [FOLG, MX(1.45, 3.75, .5, 1.45, 1.25, 1.45, 1), 0x4a7833], [FOLG, MX(-1.3, 3.85, -.6, 1.55, 1.3, 1.55, 2), 0x365f28], [FOLG, MX(.3, 5.3, .2, 1.4, 1.1, 1.4, 3), 0x4f8037], [FOLG, MX(-.3, 4, 1.3, 1.2, 1, 1.2, 4), 0x42702f]]);
  for (let i = 0; i < 5200 && pines.length + oaks.length < 950; i++) {
    const a = r() * 6.283, d = Math.sqrt(r()) * 300, x = Math.cos(a) * d, z = Math.sin(a) * d, f = forest(x, z), h = H(x, z);
    if (!(f > .5 || r() < .05) || h < .9 || h > 24 || slope(x, z) > .7 || pathD(x, z) < 4.5 || nearPOI(x, z, 3)) continue;
    const s = .8 + r() * .8, m = MX(x, h - .15, z, s, s * (.9 + r() * .4), s, r() * 6.28), col = new T.Color().setHSL(0, 0, .82 + r() * .3);
    if (fbm(x * .02 + 5, z * .02, 2) > .5 || h > 12) { pines.push(m); pc.push(col); } else { oaks.push(m); oc.push(col); }
    addCircle(x, z, .42 * s);
  }
  instanced(pineG, MAT.foliage, pines, true, pc); instanced(oakG, MAT.foliage, oaks, true, oc);
  for (let i = 0; i < 900 && rockMats.length < 150; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * 295, x = Math.cos(a) * d, z = Math.sin(a) * d, h = H(x, z); if (h < .4 || pathD(x, z) < 4 || nearPOI(x, z, 2)) continue; const s = .5 + r() * r() * 2.4; rockMats.push(MX(x, h + s * .2, z, s * (1 + r() * .6), s * (.6 + r() * .5), s, r() * 6.28, r() * .5)); rockCols.push(new T.Color().setHSL(.08, .05, .36 + r() * .16)); addCircle(x, z, s * .9); }
}
function addRock(x, z, s, r) { rockMats.push(MX(x, H(x, z) + s * .25, z, s * (1 + r() * .5), s * (.7 + r() * .5), s, r() * 6.28, r() * .4)); rockCols.push(new T.Color().setHSL(.08, .05, .34 + r() * .14)); addCircle(x, z, s * .95); }
/* grass ring that follows the player */
const GRN = S.low ? 34 : 56, GSP = 1.7;
const grassG = (() => { const a = new T.PlaneGeometry(1.3, .8); a.translate(0, .4, 0); const b = a.clone(); b.rotateY(Math.PI / 2); return merge([[a, null, [1, 1, 1]], [b, null, [1, 1, 1]]]); })();
grassG.setAttribute('uv', new T.BufferAttribute(new Float32Array([0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 1, 1]), 2));
const grass = new T.InstancedMesh(grassG, new T.MeshLambertMaterial({ map: TEX.grass, alphaTest: .45, side: T.DoubleSide }), GRN * GRN); grass.frustumCulled = false; grass.receiveShadow = true; scene.add(grass);
let grassCell = '';
const gM = new T.Matrix4(), gC = new T.Color(), gQ = new T.Quaternion(), gE = new T.Euler(), gP = new T.Vector3(), gS = new T.Vector3();
function updateGrass(px, pz) {
  const cx = Math.round(px / GSP), cz = Math.round(pz / GSP), key = cx + ',' + cz; if (key === grassCell) return; grassCell = key; let i = 0;
  for (let a = 0; a < GRN; a++) for (let b = 0; b < GRN; b++, i++) {
    const gx = cx + a - GRN / 2, gz = cz + b - GRN / 2, j1 = h2(gx, gz), j2 = h2(gz + 91, gx - 37), x = (gx + j1 - .5) * GSP, z = (gz + j2 - .5) * GSP, h = H(x, z);
    const okk = h > .8 && h < 16 && pathD(x, z) > 2.6 && j1 * j2 < .6 && !nearPOI(x, z, -3) && Math.hypot(a - GRN / 2, b - GRN / 2) < GRN / 2;
    const s = okk ? .7 + j2 * .9 : 0; gE.set(0, j1 * 6.28, 0); gQ.setFromEuler(gE); gP.set(x, h - .04, z); gS.set(s, s * (.7 + j1 * .7), s); gM.compose(gP, gQ, gS); grass.setMatrixAt(i, gM);
    const f = forest(x, z) > .5 ? .7 : 1; gC.setRGB((.85 + j1 * .3) * f, (.95 + j2 * .2) * f, .7 * f); grass.setColorAt(i, gC);
  }
  grass.instanceMatrix.needsUpdate = true; if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
}
/* structures */
const mesh = (geo, mat, x, y, z, sx = 1, sy = sx, sz = sx, ry = 0, parent = scene) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
const clothMat = hex => new T.MeshLambertMaterial({ color: hex, map: TEX.cloth, side: T.DoubleSide });
const fires = [], interact = [];
function buildFire(f, i) {
  const y = H(f.x, f.z), r = rng32(100 + i);
  for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283; mesh(ROCK2, MAT.stone, f.x + Math.cos(a) * .85, y + .12, f.z + Math.sin(a) * .85, .24 + r() * .1); }
  for (let k = 0; k < 3; k++) { const m = mesh(GEO.cyl, MAT.wood, f.x, y + .22, f.z, .09, 1.3, .09, k * 2.1); m.rotation.z = 1.2; }
  const fl = []; for (let k = 0; k < 3; k++) { const s = new T.Sprite(new T.SpriteMaterial({ map: TEX.glow, color: [0xff5a1a, 0xffa030, 0xffe9a0][k], blending: T.AdditiveBlending, depthWrite: false })); s.position.set(f.x, y + .55 + k * .12, f.z); scene.add(s); fl.push(s); }
  addCircle(f.x, f.z, .9); fires.push({ x: f.x, z: f.z, y, fl, lit: true });
  interact.push({ type: 'fire', x: f.x, z: f.z, i, label: 'Rest at ' + f.n });
}
function tent(x, z, ry, col) { const y = H(x, z), m = mesh(GEO.cone, clothMat(col), x, y + 1.25, z, 2.3, 2.5, 2.3, ry); m.geometry = TENTG; addCircle(x, z, 1.8); mesh(GEO.cyl, MAT.wood, x, y + 1.3, z, .05, 2.8, .05); }
const TENTG = (() => { const g = lathe([[0, .5], [.1, .46], [.55, .05], [1, -.5], [0, -.5]], 18); return g; })();
function banner(x, z, col) { const y = H(x, z); mesh(GEO.cyl, MAT.wood, x, y + 2.4, z, .06, 4.8, .06); const c = mesh(new T.PlaneGeometry(1.1, 1.9), clothMat(col), x + .62, y + 3.7, z); c.castShadow = false; return c; }
const campBanners = [];
FIRES.forEach(buildFire);
tent(-6, -5, .6, 0x9a9078); tent(5.5, -6.5, -.4, 0x8a8468); banner(3, 4, 0x27406b);
mesh(GEO.box, MAT.wood, -3.5, H(-3.5, 4) + .4, 4, .9, .8, .9, .3); mesh(GEO.box, MAT.wood, -4.6, H(-4.6, 4.6) + .3, 4.6, .7, .6, .7, -.2); addCircle(-3.9, 4.2, 1);
CAMPS.forEach((c, ci) => {
  const r = rng32(200 + ci), y = H(c.x, c.z), gate = Math.atan2(-c.z, -c.x);
  for (let a = 0; a < 6.283; a += .058) { if (Math.abs(angDiff(a, gate)) < .32) continue; const x = c.x + Math.cos(a) * 16, z = c.z + Math.sin(a) * 16, hh = 2.6 + r() * .7; logMats.push(MX(x, H(x, z) + hh / 2 - .2, z, .22, hh, .22, r() * 6.28, (r() - .5) * .08, (r() - .5) * .08)); addCircle(x, z, .42); }
  for (let k = 0; k < 3; k++) { const a = gate + Math.PI + (k - 1) * .9; tent(c.x + Math.cos(a) * 10, c.z + Math.sin(a) * 10, r() * 3, [0x6b4a3a, 0x5a5340, 0x70402c][k]); }
  buildFire({ x: c.x, z: c.z, n: '' }, 10 + ci); interact.pop();
  campBanners.push(banner(c.x + Math.cos(gate) * 17.5, c.z + Math.sin(gate) * 17.5 + 2.5, 0x8f1f18));
});
/* keep */
const gate = {};
{
  const K = KEEP, y = H(K.x, K.z), hf = K.half, th = 2.4, wh = 7;
  const wall = (x0, x1, z0, z1) => { const m = mesh(GEO.box, MAT.stone, (x0 + x1) / 2, y + wh / 2 - .4, (z0 + z1) / 2, x1 - x0, wh, z1 - z0); BOXES.push({ x0, x1, z0, z1 }); return m; };
  wall(K.x - hf, K.x + hf, K.z - hf - th, K.z - hf); wall(K.x - hf, K.x + hf, K.z + hf, K.z + hf + th); wall(K.x + hf, K.x + hf + th, K.z - hf, K.z + hf);
  wall(K.x - hf - th, K.x - hf, K.z - hf, K.z - 3.2); wall(K.x - hf - th, K.x - hf, K.z + 3.2, K.z + hf);
  mesh(GEO.box, MAT.stone, K.x - hf - th / 2, y + wh - 1.2, K.z, th, 2, 6.4);
  gate.mesh = mesh(GEO.box, MAT.wood, K.x - hf - th / 2, y + 2.3, K.z, .5, 5.4, 6.4); gate.box = { x0: K.x - hf - th, x1: K.x - hf, z0: K.z - 3.2, z1: K.z + 3.2 }; BOXES.push(gate.box);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const tx = K.x + sx * (hf + th / 2), tz = K.z + sz * (hf + th / 2); mesh(GEO.cyl, MAT.stone, tx, y + 4.6, tz, 3.1, 10, 3.1); mesh(GEO.cone, MAT.dark, tx, y + 11.2, tz, 3.6, 3.4, 3.6); addCircle(tx, tz, 3.2); }
  for (let k = -3; k <= 3; k++) for (const s of [-1, 1]) { mesh(GEO.box, MAT.stone, K.x + k * 4.6, y + wh, K.z + s * (hf + th / 2), 2.2, 1.3, th); }
  banner(K.x - hf - 4, K.z - 5, 0x22262e); banner(K.x - hf - 4, K.z + 5, 0x22262e);
}
/* shrines, dens, chests */
const shrineRunes = [];
SHRINES.forEach((s, i) => {
  const r = rng32(300 + i), y = H(s.x, s.z);
  for (let k = 0; k < 5; k++) { const a = k / 5 * 6.283 + .3, x = s.x + Math.cos(a) * 3.2, z = s.z + Math.sin(a) * 3.2, m = mesh(ROCKG, MAT.stone, x, y + 1.1, z, .55, 1.5 + r() * .5, .38, -a + 1.57); m.rotation.z = (r() - .5) * .25; addCircle(x, z, .55); }
  mesh(GEO.box, MAT.stone, s.x, y + .45, s.z, 1.3, .9, 1.3, .4); addCircle(s.x, s.z, .9);
  const rune = new T.Sprite(new T.SpriteMaterial({ map: TEX.glow, color: 0x8fd0ff, blending: T.AdditiveBlending, depthWrite: false })); rune.position.set(s.x, y + 1.5, s.z); rune.scale.set(1.6, 1.6, 1); scene.add(rune); shrineRunes.push(rune);
  interact.push({ type: 'shrine', x: s.x, z: s.z, i, label: 'Pray at the standing stones' });
});
DENS.forEach((d, i) => { const r = rng32(400 + i); for (let k = 0; k < 5; k++) { const a = 2 + k * .7; addRock(d.x + Math.cos(a) * 6, d.z + Math.sin(a) * 6, 1.6 + r() * 1.4, r); } });
instanced(merge([[GEO.taper, MX(0, 0, 0, .95, 1, .95), 0x8a6a48], [GEO.cone, MX(0, .56, 0, .95, .12, .95), 0x6e5236]]), MAT.vc, logMats); instanced(ROCKG, MAT.rock, rockMats, true, rockCols);
const chestG = { base: merge([[GEO.box, MX(0, .26, 0, .95, .5, .6), 0x6a4a2a], [GEO.box, MX(-.36, .26, 0, .08, .54, .64), 0x2a2623], [GEO.box, MX(.36, .26, 0, .08, .54, .64), 0x2a2623]]), lid: merge([[GEO.box, MX(0, .1, .3, .95, .2, .6), 0x7a5632], [GEO.box, MX(-.36, .1, .3, .08, .24, .64), 0x2a2623], [GEO.box, MX(.36, .1, .3, .08, .24, .64), 0x2a2623], [GEO.box, MX(0, .04, .62, .14, .16, .05), 0xc9a24a]]) };
const chests = CHESTS.map((c, i) => {
  const g = new T.Group(), y = H(c.x, c.z); g.position.set(c.x, y, c.z); g.rotation.y = h2(i, 7) * 6.28; const b = new T.Mesh(chestG.base, MAT.vc), lid = new T.Mesh(chestG.lid, MAT.vc); lid.position.set(0, .5, -.3); b.castShadow = lid.castShadow = true; g.add(b, lid); scene.add(g);
  const glow = new T.Sprite(new T.SpriteMaterial({ map: TEX.glow, color: 0xffd76a, blending: T.AdditiveBlending, depthWrite: false, opacity: .5 })); glow.position.set(c.x, y + 1.1, c.z); glow.scale.set(1.5, 1.5, 1); scene.add(glow);
  addCircle(c.x, c.z, .7); const o = { type: 'chest', x: c.x, z: c.z, i, lid, glow, label: 'Open the chest', open: false }; interact.push(o); return o;
});
const herbG = merge([[GEO.cone, MX(0, .22, 0, .1, .45, .1), 0x3f7a35], [GEO.cone, MX(.12, .17, .05, .08, .34, .08, 0, 0, -.5), 0x4a8a3c], [GEO.cone, MX(-.1, .17, -.06, .08, .34, .08, 0, 0, .5), 0x3a7030], [GEO.sph, MX(0, .47, 0, .07), 0xf2ecff], [GEO.sph, MX(.2, .34, .08, .055), 0xe9dcff], [GEO.sph, MX(-.17, .34, -.1, .055), 0xffffff]]);
const herbs = []; { const r = rng32(555); for (let i = 0; i < 4000 && herbs.length < 36; i++) { const x = (r() - .5) * 520, z = (r() - .5) * 520, h = H(x, z); if (h < 1 || h > 15 || Math.hypot(x, z) > 270 || nearPOI(x, z, 4) || pathD(x, z) < 3) continue; herbs.push({ type: 'herb', x, z, i: herbs.length, label: 'Gather herbs', gone: false }); } }
const herbMesh = instanced(herbG, MAT.vc, herbs.map(h => MX(h.x, H(h.x, h.z), h.z, 1.5)), false); herbs.forEach(h => interact.push(h));

/* ================= Character models ================= */
const STEEL = 0x9aa3b0;
const HCACHE = new Map();
const dk = (hex, k) => { const c = new T.Color(hex).multiplyScalar(k); return [c.r, c.g, c.b]; };
const LIMBS = new Map();
function limbG(r0, r1, len, bulge = 0, bpos = .6) { // tapered limb with a muscle swell, hanging down from the origin
  const k = [r0, r1, len, bulge, bpos].join(); if (LIMBS.has(k)) return LIMBS.get(k); const p = [], n = 5, rad = t => lerp(r1, r0, t) + bulge * Math.exp(-((t - bpos) ** 2) / .045);
  for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i / n * Math.PI / 2; p.push([r1 * Math.cos(a), -len + r1 * Math.sin(a)]); }
  for (let i = 1; i < 12; i++) { const t = i / 12; p.push([rad(t), -len + t * len]); }
  for (let i = 0; i <= n; i++) { const a = i / n * Math.PI / 2; p.push([r0 * Math.cos(a), r0 * Math.sin(a)]); }
  const g = lathe(p); LIMBS.set(k, g); return g;
}
const CAPEG = (() => { const g = new T.CylinderGeometry(.21, .4, 1.08, 14, 6, true, Math.PI * .56, Math.PI * .88); g.translate(0, -.54, 0); const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) { const y = pp.getY(i), x = pp.getX(i); pp.setZ(i, pp.getZ(i) * .62 + Math.sin(x * 14) * .012 * (-y)); } g.computeVertexNormals(); return g; })();
const RING = (r0, r1, h) => lathe([[0, 0], [r0, 0], [r1, -h], [0, -h]]);
function humanoid(o) {
  const M = !!o.metal, sk = o.skin || 0xc79a78, hs = o.helmCol || STEEL, parts = [], key = JSON.stringify(o), plate = M && o.plate !== false, trim = o.trim || 0xd9b65a;
  const Pm = (name, list, parent) => { for (const kind of [0, 1, 2]) { const l = list.filter(e => (e[3] === 2 ? 2 : e[3] ? 1 : 0) === kind); if (!l.length) continue; const k = key + name + kind; let geo = HCACHE.get(k); if (!geo) { geo = merge(l); HCACHE.set(k, geo); } const m = new T.Mesh(geo, kind === 1 ? MAT.metal : kind === 2 ? MAT.clothDS : MAT.cloth); m.castShadow = true; m.receiveShadow = true; parent.add(m); parts.push(m); } };
  const g = new T.Group(), body = new T.Group(); body.position.y = .96; g.add(body);
  const hips = [[GEO.sph, MX(0, -.03, 0, .2, .14, .145), o.limb, M], [GEO.torus, MX(0, .05, 0, .215, .158, .22, 0, Math.PI / 2), 0x2b1c10], [lathe([[0, .02], [.03, .02], [.035, -.02], [0, -.02]], 6), MX(0, .05, .16, 1, 1, 1, 0, Math.PI / 2), 0xc9a24a, true],
    [lathe([[0, 0], [.205, 0], [.226, -.17], [.25, -.34], [0, -.34]]), MX(0, .02, 0, 1, 1, .74), o.coat ? o.cloth : o.skirt || o.cloth], [GEO.sph, MX(.17, -.03, .06, .05, .065, .035), 0x5a3e24], [GEO.sph, MX(.17, .02, .065, .052, .015, .036), 0x4a321c]];
  if (plate) for (let k = 0; k < 3; k++) hips.push([RING(.214 + k * .012, .228 + k * .012, .07), MX(0, .02 - k * .06, 0, 1, 1, .74), o.body, true]);
  if (o.scabbard) hips.push([GEO.cyl, MX(-.2, -.3, -.06, .03, .7, .016, 0, .35, .12), 0x2a1c12], [GEO.cyl, MX(-.17, .04, .05, .026, .06, .026, 0, .35, .12), trim, true]);
  Pm('hips', hips, body);
  const torso = new T.Group(); torso.position.y = .08; body.add(torso);
  const tl = [[lathe([[0, -.02], [.198, -.02], [.212, .1], [.246, .29], [.238, .42], [.17, .54], [.08, .6], [0, .6]]), MX(0, 0, 0, 1, 1, .68), o.body, M], [GEO.cyl, MX(0, .63, 0, .066, .1, .066), M ? 0x50555e : sk, M]];
  if (M) tl.push([lathe([[0, .52], [.15, .52], [.17, .56], [.1, .64], [0, .64]]), MX(0, 0, 0, 1, 1, .8), o.body, true]);
  if (plate && !o.coat) tl.push([GEO.box, MX(0, .26, .163, .016, .36, .02), o.body, true], [GEO.box, MX(0, .44, .12, .2, .012, .05), dk(o.body, 1.2), true]);
  if (o.coat) tl.push([lathe([[0, -.035], [.212, -.035], [.228, .12], [.255, .3], [.25, .4], [0, .4]]), MX(0, 0, 0, 1, 1, .705), o.cloth], 
    [lathe([[0, .07], [.05, .05], [.06, -.03], [0, -.09]], 4), MX(0, .25, .18, 1, 1, .2, Math.PI / 4), trim]);
  else if (!M) tl.push([GEO.torus, MX(0, .3, 0, .215, .16, .12, 0, Math.PI / 2, .5), dk(o.body, .6)], [GEO.torus, MX(0, .14, 0, .214, .156, .08, 0, Math.PI / 2), dk(o.body, .7)], [GEO.sph, MX(.06, .3, .158, .02, .02, .01), 0x8a7050], [GEO.sph, MX(-.04, .18, .16, .02, .02, .01), 0x8a7050], [GEO.sph, MX(.02, .42, .145, .018, .018, .01), 0x8a7050]);
  if (o.helm === 'hood') tl.push([lathe([[0, .17], [.13, .15], [.27, .02], [.29, -.06], [0, -.06]]), MX(0, .5, -.01, 1, 1, .78), o.hood || o.cloth]);
  if (o.quiver) tl.push([GEO.cyl, MX(.08, .32, -.2, .06, .55, .06, 0, .2, -.35), 0x5a3e24], [GEO.torus, MX(.08, .32, -.2, .06, .06, .3, 0, Math.PI / 2 + .2, -.35), 0x3a2814]); for (let k = 0; k < (o.quiver ? 5 : 0); k++) tl.push([GEO.cone, MX(.13 + k * .012, .62, -.25 + (k % 2) * .02, .02, .1, .006, 0, .2, -.35), 0xe8e0cc]);
  Pm('torso', tl, torso);
  let cape = null; if (o.cape) { cape = new T.Group(); cape.position.set(0, .56, -.04); torso.add(cape); Pm('cape', [[CAPEG, null, dk(o.cloth, .78), 2], [GEO.torus, MX(0, 0, 0, .215, .15, .16, 0, Math.PI / 2), trim]], cape); }
  const head = new T.Group(); head.position.y = .64; torso.add(head);
  const hl = [], face = () => hl.push([GEO.sph, MX(0, .13, 0, .108, .125, .112), sk], [GEO.sph, MX(0, .075, .03, .085, .07, .085), sk], [GEO.sph, MX(.108, .13, -.005, .02, .034, .016), dk(sk, .9)], [GEO.sph, MX(-.108, .13, -.005, .02, .034, .016), dk(sk, .9)],
    [GEO.sph, MX(.038, .148, .098, .016, .012, .008), 0xf0ebe0], [GEO.sph, MX(-.038, .148, .098, .016, .012, .008), 0xf0ebe0], [GEO.sph, MX(.038, .148, .104, .008, .009, .004), 0x1a1210], [GEO.sph, MX(-.038, .148, .104, .008, .009, .004), 0x1a1210],
    [GEO.box, MX(.04, .172, .1, .04, .009, .01, 0, 0, -.12), 0x2a1c12], [GEO.box, MX(-.04, .172, .1, .04, .009, .01, 0, 0, .12), 0x2a1c12], [GEO.sph, MX(0, .118, .113, .018, .032, .024), dk(sk, .92)], [GEO.box, MX(0, .072, .1, .036, .006, .01), dk(sk, .6)]);
  if (o.helm === 'great') hl.push([lathe([[0, .33], [.09, .32], [.14, .27], [.152, .2], [.152, .0], [.138, -.04], [0, -.04]]), null, hs, true], [GEO.box, MX(0, .17, .148, .19, .022, .02), 0x050506], [GEO.box, MX(0, .11, .148, .022, .1, .02), 0x050506], [GEO.box, MX(0, .16, .15, .02, .34, .016), 0xb9953f, true], [GEO.torus, MX(0, .2, 0, .153, .153, .12, 0, Math.PI / 2), 0xb9953f, true], [GEO.torus, MX(0, .02, 0, .14, .14, .1, 0, Math.PI / 2), 0xb9953f, true],
    [limbG(.045, .012, .36, .015, .7), MX(0, .37, -.02, 1, 1, 1, 0, 1.15), o.cloth], [limbG(.04, .01, .32, .012, .7), MX(.03, .37, -.03, 1, 1, 1, .15, 1.5), dk(o.cloth, .8)], [limbG(.035, .01, .28, .01, .7), MX(-.03, .37, -.03, 1, 1, 1, -.15, 1.35), dk(o.cloth, .9)]);
  else if (o.helm === 'bascinet') hl.push([GEO.sph, MX(0, .15, -.01, .145, .17, .155), hs, true], [GEO.cone, MX(0, .1, .16, .1, .2, .09, 0, Math.PI / 2), hs, true], [GEO.box, MX(0, .15, .145, .16, .016, .05), 0x050506], [GEO.box, MX(0, .2, .02, .012, .1, .25, 0, -.3), hs, true],
    [lathe([[0, .06], [.15, .06], [.2, -.04], [.22, -.1], [0, -.1]]), MX(0, 0, -.01, 1, 1, .92), 0x6a707a, true], [GEO.sph, MX(.13, .12, .07, .022), 0xb9953f, true], [GEO.sph, MX(-.13, .12, .07, .022), 0xb9953f, true]);
  else if (o.helm === 'kettle') { face(); hl.push([GEO.dome, MX(0, .17, 0, .135, .13, .135), hs, true], [lathe([[0, .2], [.13, .2], [.235, .16], [.24, .15], [.13, .175], [0, .175]], SEG + 6), MX(0, -.02, 0), hs, true], [GEO.box, MX(0, .26, 0, .01, .05, .25), hs, true], [GEO.torus, MX(0, .18, 0, .136, .136, .08, 0, Math.PI / 2), dk(hs, .7), true], [lathe([[0, .05], [.13, .05], [.17, -.06], [.18, -.1], [0, -.1]]), MX(0, 0, -.02, 1, 1, .9), 0x50555e, true]); }
  else if (o.helm === 'hood') { face(); hl.push([GEO.sph, MX(0, .155, -.03, .146, .16, .15), o.hood || o.cloth], [GEO.torus, MX(0, .14, .02, .12, .14, .25, 0, .25), dk(o.hood || o.cloth, .8)], [GEO.cone, MX(0, .19, -.13, .05, .14, .05, 0, -1.25), o.hood || o.cloth]); }
  else { face(); hl.push([GEO.dome, MX(0, .16, -.015, .122, .1, .125, 0, -.25), o.hair || 0x3a2a1c], [GEO.sph, MX(0, .13, -.06, .11, .1, .08), o.hair || 0x3a2a1c]); }
  if (o.beard) hl.push([GEO.sph, MX(0, .05, .07, .085, .075, .06), o.beard], [GEO.box, MX(0, .088, .108, .06, .014, .014), o.beard]);
  Pm('head', hl, head);
  const arm = (sx, nm) => {
    const sh = new T.Group(); sh.position.set(sx * .3, .5, 0); torso.add(sh);
    const u = [[limbG(.064, .054, .27, .008, .55), null, o.limb, M]];
    if (M) u.push([GEO.dome, MX(sx * .015, .01, 0, .125, .105, .125, 0, 0, -sx * .25), o.body, true], [GEO.dome, MX(sx * .03, -.035, 0, .118, .085, .118, 0, 0, -sx * .45), o.body, true], [GEO.torus, MX(sx * .03, -.08, 0, .085, .085, .14, 0, Math.PI / 2), dk(o.body, 1.2), true]);
    else u.push([GEO.sph, MX(0, -.01, 0, .085, .08, .085), dk(o.body, .9)]);
    Pm(nm + 'u', u, sh);
    const el = new T.Group(); el.position.y = -.34; sh.add(el);
    const f = [[GEO.sph, MX(0, 0, 0, .066), M ? o.body : o.limb, M], [limbG(.058, .046, .25, .01, .75), MX(0, -.02, 0), o.limb, M], [RING(.058, .07, .07), MX(0, -.235, 0), M ? STEEL : 0x3a2a1e, M],
      [GEO.sph, MX(0, -.33, .01, .05, .066, .046), M ? STEEL : 0x3a2a1e, M], [GEO.sph, MX(sx * -.03, -.31, .035, .018, .03, .018), M ? STEEL : 0x3a2a1e, M]];
    if (plate) f.push([GEO.cyl, MX(sx * .055, 0, -.01, .05, .012, .05, 0, 0, Math.PI / 2), o.body, true]);
    Pm(nm + 'f', f, el);
    const hand = new T.Group(); hand.position.y = -.34; el.add(hand); return { sh, el, hand };
  };
  const leg = (sx, nm) => {
    const hp = new T.Group(); hp.position.set(sx * .11, -.07, 0); body.add(hp);
    const t = [[limbG(.095, .07, .36, .012, .7), null, o.limb, M]]; if (plate) t.push([GEO.dome, MX(0, -.06, .05, .1, .14, .07, 0, Math.PI / 2 + .25), o.body, true]);
    Pm(nm + 't', t, hp);
    const kn = new T.Group(); kn.position.y = -.43; hp.add(kn);
    const sn = [[GEO.sph, MX(0, 0, .015, .076, .07, .072), M ? o.body : o.limb, M], [limbG(.068, .052, .3, .014, .72), MX(0, -.02, 0), o.limb, M], [GEO.sph, MX(0, -.405, .055, .07, .058, .145), M ? STEEL : 0x2a2019, M], [GEO.cyl, MX(0, -.36, 0, .062, .08, .062), M ? STEEL : 0x2a2019, M], [GEO.torus, MX(0, -.31, 0, .064, .064, .18, 0, Math.PI / 2), M ? STEEL : 0x3a2a1e, M]];
    if (plate) sn.push([GEO.cyl, MX(sx * .065, .0, .0, .055, .012, .055, 0, 0, Math.PI / 2), o.body, true], [GEO.dome, MX(0, -.1, .045, .055, .12, .04, 0, Math.PI / 2), o.body, true]);
    else sn.push([GEO.box, MX(0, -.415, -.01, .1, .012, .25), 0x15100c]);
    Pm(nm + 's', sn, kn);
    return { hp, kn };
  };
  const aR = arm(-1, 'ar'), aL = arm(1, 'al'), lR = leg(-1, 'lr'), lL = leg(1, 'll');
  g.scale.setScalar(o.scale || 1);
  return { g, body, torso, head, aR, aL, lR, lL, parts, cape, human: true };
}
const BLADE = (() => { const g = new T.CylinderGeometry(.8, 1, 1, 4); g.rotateY(Math.PI / 4); return g; })(), BTIP = (() => { const g = new T.ConeGeometry(1, 1, 4); g.rotateY(Math.PI / 4); return g; })();
function headShape(k) { const sh = new T.Shape(); sh.moveTo(0, .05); sh.lineTo(.07, .045); sh.quadraticCurveTo(.13, .1, .19, .1); sh.quadraticCurveTo(.25, -.03, .19, -.18); sh.quadraticCurveTo(.12, -.15, .07, -.05); sh.lineTo(0, -.05); sh.closePath(); const g = new T.ExtrudeGeometry(sh, { depth: .014, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 2, curveSegments: 10 }); g.translate(0, 0, -.007); g.rotateY(-Math.PI / 2); g.scale(k, k, k); return g; }
const AXEH = headShape(1), POLEH = headShape(1.35);
const BOWG = (() => { const R = 1.2, a = .95, g = new T.TorusGeometry(R, .017, 6, 26, a); g.rotateZ(-a / 2); g.rotateY(-Math.PI / 2); g.translate(0, 0, -R); return g; })();
const WCACHE = new Map();
function weaponMesh(kind, len, dark) {
  const k = kind + len + dark; let geos = WCACHE.get(k);
  if (!geos) {
    const st = dark ? 0x60666f : 0xd5dbe3, wd = 0x5b4028, gd = 0xb9953f, l = [], shaft = (ext = .2, r = .021) => l.push([GEO.cyl, MX(0, len / 2 - ext / 2, 0, r, len + ext, r), wd], [GEO.cyl, MX(0, -.05, 0, r * 1.15, .14, r * 1.15), 0x2a1a10]);
    if (kind === 'sword') l.push([GEO.cyl, MX(0, -.02, 0, .019, .22, .019), 0x3a2516], [GEO.sph, MX(0, -.15, 0, .036), gd, true], [capsule(.02, .02, .24), MX(.12, .1, 0, 1, 1, 1, 0, 0, Math.PI / 2), gd, true], [GEO.sph, MX(0, .1, 0, .03, .03, .02), gd, true],
      [BLADE, MX(0, .12 + len / 2, 0, .045, len, .011), st, true], [BTIP, MX(0, .12 + len + .06, 0, .036, .12, .009), st, true], [GEO.box, MX(0, .12 + len * .4, 0, .008, len * .75, .013), dk(st, .75), true]);
    else if (kind === 'axe') { shaft(); l.push([AXEH, MX(0, len - .1, .01), st, true], [GEO.cyl, MX(0, len - .1, 0, .03, .12, .03), st, true]); }
    else if (kind === 'mace') { shaft(); l.push([GEO.sph, MX(0, len, 0, .06), st, true], [GEO.cone, MX(0, len + .09, 0, .025, .08, .025), st, true]); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; l.push([lathe([[0, .08], [.01, .07], [.06, 0], [.01, -.07], [0, -.08]], 4), MX(Math.cos(a) * .05, len, Math.sin(a) * .05, .7, 1, .18, -a), st, true]); } }
    else if (kind === 'pole') { shaft(.5, .022); l.push([POLEH, MX(0, len - .1, .01), st, true], [GEO.cone, MX(0, len + .17, 0, .028, .34, .028), st, true], [GEO.cone, MX(0, len - .1, -.1, .02, .16, .02, 0, -Math.PI / 2), st, true], [GEO.cyl, MX(0, len - .1, 0, .032, .2, .032), st, true]); }
    else if (kind === 'maul') { shaft(.4, .028); l.push([GEO.cyl, MX(0, len, 0, .11, .34, .11, 0, Math.PI / 2), st, true], [GEO.torus, MX(0, len, .12, .11, .11, .2), dk(st, .6), true], [GEO.torus, MX(0, len, -.12, .11, .11, .2), dk(st, .6), true]); }
    else l.push([BOWG, null, 0x6b4a2c], [GEO.cyl, MX(0, 0, -.134, .004, 1.1, .004), 0xe8e0cc], [GEO.cyl, MX(0, 0, 0, .026, .18, .026), 0x2a1a10]);
    geos = [false, true].map(m => { const q = l.filter(e => !!e[3] === m); return q.length ? merge(q) : null; }); WCACHE.set(k, geos);
  }
  const grp = new T.Group(); geos.forEach((q, i) => { if (!q) return; const m = new T.Mesh(q, i ? MAT.metal : MAT.cloth); m.castShadow = true; grp.add(m); }); grp.rotation.x = kind === 'bow' ? 0 : 1.25; return grp;
}
function quadruped(k) {
  const wolf = k === 'wolf', c = wolf ? 0x55585d : 0x4a3628, c2 = wolf ? 0x36383c : 0x2e2018, bel = wolf ? 0x8a8984 : 0x5e4632, parts = [], L = wolf ? 1.1 : 1.25, hg = wolf ? .62 : .6, w = wolf ? .34 : .52, h = wolf ? .4 : .55;
  const Pm = (nm, list, parent) => { const kk = k + nm; let geo = HCACHE.get(kk); if (!geo) { geo = merge(list); HCACHE.set(kk, geo); } const m = new T.Mesh(geo, MAT.cloth); m.castShadow = true; parent.add(m); parts.push(m); return m; };
  const g = new T.Group(), body = new T.Group(); body.position.y = hg; g.add(body);
  const bl = wolf ? [[GEO.sph, MX(0, .02, .18, w * .55, h * .62, L * .34), c], [GEO.sph, MX(0, .02, -.2, w * .44, h * .44, L * .32), c], [GEO.sph, MX(0, -.06, .14, w * .42, h * .42, L * .28), bel],
    [FOLG, MX(0, .12, .36, w * .62, h * .62, L * .2), dk(c, 1.12)], [FOLG, MX(0, .1, .02, w * .42, h * .32, L * .36), c2], [FOLG, MX(0, .11, -L * .62, .09, .09, .3, 0, -.75), c], [FOLG, MX(0, -.03, -L * .78, .07, .07, .16, 0, -.95), c2]]
    : [[GEO.sph, MX(0, 0, -.05, w * .5, h * .48, L * .52), c], [GEO.sph, MX(0, .06, L * .26, w * .58, h * .6, L * .3), c], [GEO.sph, MX(0, -.08, 0, w * .4, h * .34, L * .44), bel], [GEO.sph, MX(0, .12, .05, w * .38, h * .3, L * .45), c2], [limbG(.025, .01, .2), MX(0, .05, -L * .5, 1, 1, 1, 0, -2.6), c2]];
  if (!wolf) for (let i = 0; i < 11; i++) bl.push([GEO.cone, MX(0, h * .5 - .02 + Math.sin(i / 10 * Math.PI) * .04, L * (.36 - i * .07), .03, .15 - Math.abs(i - 4) * .008, .03, 0, -.35), c2]);
  Pm('b', bl, body);
  const head = new T.Group(); head.position.set(0, wolf ? .22 : .12, L * .5); body.add(head);
  const hl = wolf ? [[GEO.sph, MX(0, 0, .04, .12, .12, .14), c], [limbG(.07, .035, .22, 0), MX(0, -.03, .08, 1, .85, 1, 0, -Math.PI / 2), c], [limbG(.05, .03, .2, 0), MX(0, -.07, .07, 1, .5, 1, 0, -Math.PI / 2), bel], [GEO.sph, MX(0, -.015, .33, .028, .024, .02), 0x151210],
    [GEO.sph, MX(.058, .045, .14, .02, .016, .012, -.3), 0xd8a030], [GEO.sph, MX(-.058, .045, .14, .02, .016, .012, .3), 0xd8a030], [GEO.sph, MX(.062, .045, .148, .009), 0x0a0806], [GEO.sph, MX(-.062, .045, .148, .009), 0x0a0806],
    [lathe([[0, .16], [.03, .12], [.05, 0], [0, 0]], 6), MX(.07, .08, -.01, 1, 1, .5, -.4, -.2, -.3), c2], [lathe([[0, .16], [.03, .12], [.05, 0], [0, 0]], 6), MX(-.07, .08, -.01, 1, 1, .5, .4, -.2, .3), c2]]
    : [[GEO.sph, MX(0, 0, .06, .13, .14, .16), c], [limbG(.085, .075, .2, 0), MX(0, -.04, .1, 1, 1, .9, 0, -Math.PI / 2), c], [GEO.cyl, MX(0, -.04, .37, .065, .03, .05, 0, Math.PI / 2), 0x6a4a3a], [GEO.sph, MX(.02, -.04, .386, .01), 0x151210], [GEO.sph, MX(-.02, -.04, .386, .01), 0x151210],
    [GEO.sph, MX(.07, .05, .15, .016), 0x1a140c], [GEO.sph, MX(-.07, .05, .15, .016), 0x1a140c], [GEO.cone, MX(.08, .15, .0, .05, .13, .03, 0, -.3, -.4), c2], [GEO.cone, MX(-.08, .15, .0, .05, .13, .03, 0, -.3, .4), c2],
    [limbG(.016, .006, .13), MX(.07, -.05, .3, 1, 1, 1, 0, -2.4), 0xe8e0cc], [limbG(.016, .006, .13), MX(-.07, -.05, .3, 1, 1, 1, 0, -2.4), 0xe8e0cc]];
  Pm('h', hl, head);
  const legs = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const lg = new T.Group(); lg.position.set(sx * w * .3, -.04, sz * L * .32); body.add(lg); const ul = .27, a1 = sz > 0 ? -.08 : .5, a2 = sz > 0 ? .05 : -.62, ex = 0, ey = -ul * Math.cos(a1), ez = -ul * Math.sin(a1), ll = wolf ? .3 : .26;
    const fx = ey - ll * Math.cos(a2), fz = ez - ll * Math.sin(a2);
    Pm('l' + sz, [[limbG(wolf ? .075 : .09, .045, ul, .015, .7), MX(0, 0, 0, 1, 1, 1, 0, a1), c], [GEO.sph, MX(ex, ey, ez, .046), c2], [limbG(.042, .034, ll, .006, .8), MX(ex, ey, ez, 1, 1, 1, 0, a2), c2], [GEO.sph, MX(0, fx - .02, fz + .035, .048, .028, .065), wolf ? c2 : 0x1a120c]], lg); legs.push(lg);
  }
  return { g, body, head, legs, parts };
}
const POSES = {
  wind1: { aRx: -3.5, aRe: -.4, lean: -.12, yaw: .25 }, strike1: { aRx: -.9, aRe: -.1, lean: .35, yaw: -.3 },
  wind2: { aRx: -1.5, aRe: -.4, yaw: 1.05, aRz: -.5 }, strike2: { aRx: -1.4, aRe: -.1, yaw: -.95, aRz: .25 },
  wind3: { aRx: .35, aRe: -2.0, yaw: .5 }, strike3: { aRx: -1.5, aRe: -.05, yaw: -.25, lean: .3 },
  windH: { aRx: -3.9, aRe: -.5, aLx: -3.6, aLe: -.6, lean: -.3 }, strikeH: { aRx: -.7, aRe: -.05, aLx: -.9, aLe: -.2, lean: .55 },
  block: { aRx: -1.35, aRe: -1.2, aRz: .5, aLx: -1.25, aLe: -1.4, wp: .15 }, hit: { lean: -.4, aRx: .3, aLx: .3 },
  aim: { aLx: -1.5, aLe: 0, aRx: -1.4, aRe: -1.7, yaw: .9 }, heal: { aLx: -1.2, aLe: -1.7, lean: .2 }, stagger: { lean: -.3, aRx: .4, aRe: -.2, aLx: .3, head: .4 },
};
function animHuman(m, pose, mv, phase, dt, sprint) {
  const s = Math.sin(phase), p = pose ? POSES[pose] : null, k = 1 - Math.exp(-(p ? 24 : 12) * dt);
  const sm = (o, ax, v) => { o.rotation[ax] += (v - o.rotation[ax]) * k; };
  sm(m.lL.hp, 'x', s * .8 * mv); sm(m.lR.hp, 'x', -s * .8 * mv); sm(m.lL.kn, 'x', Math.max(0, Math.sin(phase + 1.2)) * 1.1 * mv); sm(m.lR.kn, 'x', Math.max(0, Math.sin(phase + 1.2 + Math.PI)) * 1.1 * mv);
  sm(m.torso, 'x', (p && p.lean !== undefined ? p.lean : .1 * mv * (sprint ? 2 : 1))); sm(m.torso, 'y', p && p.yaw || 0);
  sm(m.aR.sh, 'x', p && p.aRx !== undefined ? p.aRx : -.22 + s * .45 * mv); sm(m.aR.el, 'x', p && p.aRe !== undefined ? p.aRe : -.45); sm(m.aR.sh, 'z', p && p.aRz || 0);
  sm(m.aL.sh, 'x', p && p.aLx !== undefined ? p.aLx : .05 - s * .5 * mv); sm(m.aL.el, 'x', p && p.aLe !== undefined ? p.aLe : -.3);
  sm(m.head, 'x', p && p.head || 0);
  if (m.wp && m.wpKind !== 'bow') sm(m.wp, 'x', p && p.wp !== undefined ? p.wp : 1.25);
  m.body.position.y = .96 - Math.abs(Math.cos(phase)) * .035 * mv;
  if (m.cape) { const want = -(.06 + mv * (sprint ? .7 : .35)) - Math.sin(phase * 2) * .04 * mv + Math.sin(G.real * 1.7) * .02; m.cape.rotation.x += (want - m.cape.rotation.x) * Math.min(1, dt * 6); }
}

/* ================= Effects ================= */
const PN = 420, pPos = new Float32Array(PN * 3).fill(-999), pCol = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN), pGrav = new Float32Array(PN); let pI = 0;
const pGeo = new T.BufferGeometry(); pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new T.BufferAttribute(pCol, 3));
const pts = new T.Points(pGeo, new T.PointsMaterial({ size: .16, vertexColors: true, map: TEX.glow, transparent: true, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
function spawnP(x, y, z, vx, vy, vz, life, c, grav = 9) { const i = pI; pI = (pI + 1) % PN; pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; pVel[i * 3] = vx; pVel[i * 3 + 1] = vy; pVel[i * 3 + 2] = vz; pLife[i] = life; pGrav[i] = grav; pCol[i * 3] = c[0]; pCol[i * 3 + 1] = c[1]; pCol[i * 3 + 2] = c[2]; }
function burst(x, y, z, n, c, sp = 4, up = 2, grav = 9) { if (S.low) n = Math.ceil(n / 2); for (let i = 0; i < n; i++) spawnP(x + rand(-.1, .1), y + rand(-.1, .1), z + rand(-.1, .1), rand(-sp, sp), rand(-sp * .3, sp) + up, rand(-sp, sp), rand(.25, .7), c, grav); }
const SPARK = [1, .8, .35], GOLD = [1, .82, .3], BLOOD = [.55, .05, .04], DUST = [.5, .45, .36], RED = [1, .2, .1], BLUE = [.55, .8, 1], LEAF = [.3, .5, .2];
function updateParticles(dt) { for (let i = 0; i < PN; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; if (pLife[i] <= 0) { pPos[i * 3 + 1] = -999; continue; } pVel[i * 3 + 1] -= pGrav[i] * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; } pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; }
const slashFx = new T.Mesh(new T.PlaneGeometry(3.4, 3.4), new T.MeshBasicMaterial({ map: TEX.slash, transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, opacity: 0 })); scene.add(slashFx); let slashT = 0;
function showSlash(pos, yaw, type, reach) { slashFx.position.set(pos.x + Math.sin(yaw) * .3, pos.y + 1.15, pos.z + Math.cos(yaw) * .3); slashFx.rotation.set(0, 0, 0); slashFx.rotation.order = 'YXZ'; slashFx.rotation.y = yaw + Math.PI; slashFx.rotation.x = type === 2 ? -Math.PI / 2 + .15 : -.5; slashFx.rotation.z = type === 1 ? .5 : type === 2 ? 0 : -.3; slashFx.scale.setScalar(reach / 2.4); slashT = .16; }
const ftPool = []; for (let i = 0; i < 10; i++) { const el = document.createElement('div'); el.className = 'ft'; $('floats').appendChild(el); ftPool.push({ el, life: 0, pos: new T.Vector3() }); } let ftI = 0;
function floatText(pos, s, color = '#fff', y = 2.2) { const f = ftPool[ftI]; ftI = (ftI + 1) % ftPool.length; f.pos.set(pos.x, pos.y + y, pos.z); f.life = 1.1; f.el.textContent = s; f.el.style.color = color; f.el.style.display = 'block'; }
const v3 = new T.Vector3();
function updateFloats(dt) { for (const f of ftPool) { if (f.life <= 0) continue; f.life -= dt; f.pos.y += dt * .9; if (f.life <= 0) { f.el.style.display = 'none'; continue; } v3.copy(f.pos).project(camera); if (v3.z > 1) { f.el.style.display = 'none'; continue; } f.el.style.display = 'block'; f.el.style.transform = `translate(-50%,-50%) translate(${((v3.x + 1) / 2 * innerWidth).toFixed(1)}px,${((1 - v3.y) / 2 * innerHeight).toFixed(1)}px)`; f.el.style.opacity = Math.min(1, f.life * 2.5).toFixed(2); } }
function toast(html, cls = '') { const d = document.createElement('div'); d.className = 'toast ' + cls; d.innerHTML = html; const box = $('toasts'); box.appendChild(d); while (box.children.length > 5) box.removeChild(box.firstChild); setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 4800); }
function shake(v) { G.shake = Math.max(G.shake, v); }

/* ================= Player ================= */
const G = { mode: 'title', panel: null, time: 0, real: 0, hitstop: 0, shake: 0, hurt: 0, flash: 0, tod: .32, night: 0, camYaw: Math.PI, camPitch: .32, camDist: 6.4, combatT: 0, hintI: 0, hintT: 3, saveT: 0, camps: [false, false, false], bossDead: false, won: false, nearest: null, stepT: 0 };
const P = { pos: new T.Vector3(0, 0, 7), yaw: Math.PI, state: 'idle', t: 0, dur: 0, alive: true, hp: 100, maxHp: 100, stam: 100, maxStam: 100, stamDelay: 0, level: 1, xp: 0, gold: 0, band: 2, bandCap: 3, herbs: 0, weapons: ['sword'], armors: ['tunic'], weapon: 'sword', armor: 'tunic', sharpen: 0, shrines: [], dmgBuff: 1, blocking: false, blockStart: -9, lastBlockEnd: -9, parryWin: .34, invuln: 0, combo: 0, atk: null, hitDone: false, phase: 0, mv: 0, kb: new T.Vector3(), rollX: 0, rollZ: 0, fire: 0, kills: 0, time: 0, ripT: 0, flashT: 0, m: null, sprint: false };
const xpNeed = l => Math.round(90 * Math.pow(l, 1.45));
function buildPlayerModel() {
  if (P.m) scene.remove(P.m.g); const a = ARMORS[P.armor], w = WEAPONS[P.weapon];
  const m = humanoid({ body: a.col, limb: a.limb, cloth: 0x27406b, metal: a.metal, plate: P.armor === 'plate' || P.armor === 'brig', coat: P.armor !== 'tunic', cape: P.armor === 'plate' || P.armor === 'brig', scabbard: 1, helm: P.armor === 'tunic' ? 'none' : P.armor === 'gambeson' ? 'kettle' : 'bascinet' });
  m.wp = weaponMesh(w.kind, w.len); m.aR.hand.add(m.wp); P.m = m; scene.add(m.g);
}
function setP(st, dur = 0) { P.state = st; P.t = 0; P.dur = dur; }
function gainXp(n) { P.xp += n; while (P.xp >= xpNeed(P.level)) { P.xp -= xpNeed(P.level); P.level++; P.maxHp += 10; P.hp = P.maxHp; toast(`<b>Level ${P.level}</b> — health and damage increased`, 'gold'); SFX.level(); burst(P.pos.x, P.pos.y + 1.2, P.pos.z, 30, GOLD, 3, 3, 2); } }
const playerDmg = () => WEAPONS[P.weapon].dmg * (1 + .05 * (P.level - 1)) * (1 + .08 * P.sharpen) * P.dmgBuff;
const ATKS = { l1: { wind: .15, act: .1, rec: .26, mul: 1, st: 9, arc: 1.15, pose: 1, next: 'l2' }, l2: { wind: .14, act: .1, rec: .28, mul: 1, st: 9, arc: 1.5, pose: 2, next: 'l3' }, l3: { wind: .18, act: .1, rec: .4, mul: 1.5, st: 11, arc: .8, pose: 3, reach: .5 }, hv: { wind: .5, act: .12, rec: .5, mul: 2.5, st: 22, arc: 1.3, pose: 'H', heavy: true } };
function startAttack(key) {
  const d = ATKS[key]; if (P.stam < d.st * .6) { SFX.deny(); floatText(P.pos, 'WINDED', '#9bd07f'); return false; }
  P.stam = Math.max(0, P.stam - d.st); P.stamDelay = .6; const sp = WEAPONS[P.weapon].spd;
  P.atk = { key, wind: d.wind / sp, act: d.act, rec: d.rec / sp, mul: d.mul, arc: d.arc, pose: d.pose, next: d.next, heavy: !!d.heavy, reach: WEAPONS[P.weapon].reach + (d.reach || 0), phase: 0 };
  setP('attack'); P.hitDone = false;
  let best = null, bd = 99; for (const e of enemies) { if (e.dead || !e.active) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, dd = Math.hypot(dx, dz); if (dd < P.atk.reach + 3.5 && dd < bd && Math.abs(angDiff(Math.atan2(dx, dz), G.camYaw)) < 1.9) { bd = dd; best = e; } }
  P.yaw = best ? Math.atan2(best.pos.x - P.pos.x, best.pos.z - P.pos.z) : (inp.mx || inp.mz ? P.yaw : G.camYaw);
  return true;
}
function playerStrike() {
  const a = P.atk; let any = false; SFX.swing(a.heavy); showSlash(P.pos, P.yaw, a.pose === 2 ? 2 : a.pose === 3 ? 3 : 1, a.reach);
  for (const e of enemies) {
    if (e.dead || !e.active) continue; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z, d = Math.hypot(dx, dz);
    if (d > a.reach + e.K.rad || Math.abs(angDiff(Math.atan2(dx, dz), P.yaw)) > a.arc) continue;
    let dmg = playerDmg() * a.mul * rand(.92, 1.08), rip = false; if (P.ripT > 0) { dmg *= 1.6; rip = true; }
    e.damage(dmg, dx / (d || 1), dz / (d || 1), a.heavy); any = true; if (rip) floatText(e.pos, 'RIPOSTE', '#ffd98a', 2.6);
  }
  if (any) { P.ripT = 0; G.hitstop = a.heavy ? .11 : .06; shake(a.heavy ? .7 : .3); }
}
function hitPlayer(dmg, e, o = {}) {
  if (!P.alive || G.mode !== 'play') return false;
  if (P.invuln > 0) { floatText(P.pos, 'DODGED', '#cfd6df'); return false; }
  const dir = Math.atan2(e.pos.x - P.pos.x, e.pos.z - P.pos.z), facing = Math.abs(angDiff(dir, P.yaw)) < 1.8, hx = P.pos.x + Math.sin(dir) * .5, hz = P.pos.z + Math.cos(dir) * .5;
  if (P.blocking && facing && !o.unblockable) {
    if (!o.ranged && e.stagger && G.time - P.blockStart <= P.parryWin) { e.stagger(1.4); P.ripT = 2.2; P.stam = Math.min(P.maxStam, P.stam + 15); burst(hx, P.pos.y + 1.3, hz, 26, [1, .95, .75], 6, 2); SFX.parry(); G.hitstop = .13; G.flash = .5; shake(.5); floatText(P.pos, 'PARRY', '#fff2c0', 2.5); return false; }
    P.stam -= dmg * (o.ranged ? .5 : 1.1); P.stamDelay = .8; burst(hx, P.pos.y + 1.3, hz, 10, SPARK, 5, 2); SFX.clang(1, .2); shake(.2); dmg *= .12;
    if (P.stam <= 0) { P.stam = 0; P.stamDelay = 1.2; P.blocking = false; setP('hit', .7); floatText(P.pos, 'GUARD BROKEN', '#ff8a70', 2.5); }
    else { P.hp -= dmg * (1 - ARMORS[P.armor].def); P.kb.set(-Math.sin(dir) * 2, 0, -Math.cos(dir) * 2); if (P.hp <= 0) playerDie(); return false; }
  } else if (P.blocking && o.unblockable) floatText(P.pos, 'CANNOT BLOCK', '#ff8a70', 2.5);
  dmg *= 1 - ARMORS[P.armor].def; P.hp -= dmg; G.hurt = Math.min(1, .45 + dmg / 40); P.flashT = .08; P.kb.set(-Math.sin(dir) * (o.knock || 5), 0, -Math.cos(dir) * (o.knock || 5));
  SFX.hurt(); shake(.6); G.hitstop = .05; burst(hx, P.pos.y + 1.2, hz, 12, BLOOD, 3, 1.5);
  if (P.state !== 'roll' && P.state !== 'dead') { P.blocking = false; setP('hit', o.knock ? .5 : .3); }
  if (P.hp <= 0) playerDie();
  return true;
}
function playerDie() { if (!P.alive) return; P.hp = 0; P.alive = false; setP('dead'); SFX.death(); G.hitstop = .2; shake(1); setTimeout(() => { if (!P.alive && G.mode === 'play') showDeath(); }, 2200); }
const inp = { mx: 0, mz: 0, sprint: false, block: false, buf: null, bufT: 0, keys: {} };
function press(a) { inp.buf = a; inp.bufT = G.time; }
function updatePlayer(dt) {
  const m = P.m; P.t += dt; P.time += dt; if (P.invuln > 0) P.invuln -= dt; if (P.ripT > 0) P.ripT -= dt;
  if (P.flashT > 0) { P.flashT -= dt; const on = P.flashT > 0; for (const q of m.parts) { if (on && !q.userData.m) { q.userData.m = q.material; q.material = MAT.white; } else if (!on && q.userData.m) { q.material = q.userData.m; q.userData.m = null; } } }
  if (P.kb.lengthSq() > .01) { moveActor(P.pos, P.kb.x * dt, P.kb.z * dt, .45); P.kb.multiplyScalar(Math.exp(-9 * dt)); }
  const fx = Math.sin(G.camYaw), fz = Math.cos(G.camYaw), wx = fx * inp.mz - fz * inp.mx, wz = fz * inp.mz + fx * inp.mx, mag = Math.min(1, Math.hypot(wx, wz));
  if (inp.buf && G.time - inp.bufT > .3) inp.buf = null;
  let pose = null, moving = 0; P.sprint = false;
  if (P.state === 'dead') { m.g.rotation.x += (-1.5 - m.g.rotation.x) * Math.min(1, dt * 5); m.g.position.set(P.pos.x, P.pos.y + .12, P.pos.z); return; }
  const wantBlock = inp.block && (P.state === 'idle'); if (wantBlock && !P.blocking) { P.blockStart = G.time - (G.time - P.lastBlockEnd > .18 ? 0 : 9); } if (!wantBlock && P.blocking) P.lastBlockEnd = G.time; P.blocking = wantBlock;
  switch (P.state) {
    case 'idle': {
      const b = inp.buf;
      if (b) { inp.buf = null;
        if (b === 'roll') { if (P.stam >= 12) { P.stam = Math.max(0, P.stam - 20); P.stamDelay = .6; P.blocking = false; setP('roll', .52); P.invuln = .36; const l = mag > .1 ? 1 / Math.hypot(wx, wz) : 0; P.rollX = l ? wx * l : Math.sin(P.yaw); P.rollZ = l ? wz * l : Math.cos(P.yaw); P.yaw = Math.atan2(P.rollX, P.rollZ); SFX.roll(); burst(P.pos.x, P.pos.y + .2, P.pos.z, 6, DUST, 1.5, .5, 1); break; } SFX.deny(); floatText(P.pos, 'WINDED', '#9bd07f'); }
        else if (b === 'light') { if (startAttack('l1')) break; }
        else if (b === 'heavy') { if (startAttack('hv')) break; }
        else if (b === 'heal') { if (P.band > 0 && P.hp < P.maxHp) { P.band--; setP('heal', 1.1); SFX.heal(); break; } SFX.deny(); toast(P.band ? 'You are not wounded.' : 'No bandages left. Gather herbs or search chests.'); }
      }
      if (mag > .05) {
        P.sprint = inp.sprint && !P.blocking && P.stam > 1; const sp = P.blocking ? 2.3 : P.sprint ? 8.4 : 5.4;
        moveActor(P.pos, wx / Math.max(mag, 1e-3) * mag * sp * dt, wz / Math.max(mag, 1e-3) * mag * sp * dt, .45); moving = mag * (P.sprint ? 1 : P.blocking ? .45 : .75);
        if (!P.blocking) P.yaw += angDiff(Math.atan2(wx, wz), P.yaw) * Math.min(1, dt * 12); P.phase += dt * (P.sprint ? 13 : P.blocking ? 6 : 10) * mag;
        if (P.sprint) { P.stam -= 9 * dt; P.stamDelay = .4; }
        G.stepT -= dt * (P.sprint ? 1.5 : 1) * mag; if (G.stepT <= 0) { G.stepT = .34; SFX.step(H(P.pos.x, P.pos.z) < .3); if (P.sprint) spawnP(P.pos.x, P.pos.y + .1, P.pos.z, rand(-.5, .5), .8, rand(-.5, .5), .5, DUST, 1); }
      }
      if (P.blocking) { P.yaw += angDiff(G.camYaw, P.yaw) * Math.min(1, dt * 14); pose = 'block'; }
      break;
    }
    case 'attack': {
      const a = P.atk, lunge = a.heavy ? 3 : 2.4;
      if (a.phase === 0) { pose = 'wind' + a.pose; if (P.t > a.wind * .5) moveActor(P.pos, Math.sin(P.yaw) * lunge * dt, Math.cos(P.yaw) * lunge * dt, .45); if (P.t >= a.wind) { a.phase = 1; P.t = 0; } }
      else if (a.phase === 1) { pose = 'strike' + a.pose; moveActor(P.pos, Math.sin(P.yaw) * lunge * dt, Math.cos(P.yaw) * lunge * dt, .45); if (!P.hitDone) { P.hitDone = true; playerStrike(); } if (P.t >= a.act) { a.phase = 2; P.t = 0; } }
      else { pose = P.t < a.rec * .5 ? 'strike' + a.pose : null; if (inp.buf === 'light' && a.next && P.t > a.rec * .3) { inp.buf = null; if (startAttack(a.next)) break; } if (inp.buf === 'roll' && P.t > a.rec * .3) { setP('idle'); break; } if (P.t >= a.rec) setP('idle'); }
      break;
    }
    case 'roll': { const k = P.t / P.dur, sp = 11 * (1 - k * .6); moveActor(P.pos, P.rollX * sp * dt, P.rollZ * sp * dt, .45); if (P.t >= P.dur) setP('idle'); break; }
    case 'hit': pose = 'hit'; if (P.t >= P.dur) setP('idle'); break;
    case 'heal': pose = 'heal'; if (mag > .05) { moveActor(P.pos, wx * 2 * dt, wz * 2 * dt, .45); moving = .4; P.phase += dt * 6; } if (P.t >= P.dur) { const h = P.maxHp * .45; P.hp = Math.min(P.maxHp, P.hp + h); floatText(P.pos, '+' + Math.round(h), '#9bd07f'); burst(P.pos.x, P.pos.y + 1.2, P.pos.z, 14, [.5, 1, .5], 1.5, 2, 1); setP('idle'); } break;
    default: break;
  }
  if (P.stamDelay > 0) P.stamDelay -= dt; else if (P.state !== 'attack' && P.state !== 'roll' && !P.sprint) P.stam = Math.min(P.maxStam, P.stam + (P.blocking ? 8 : 26) * dt);
  P.mv += (moving - P.mv) * Math.min(1, dt * 10);
  animHuman(m, pose, P.mv, P.phase, dt, P.sprint);
  m.g.position.copy(P.pos); m.g.rotation.y = P.yaw; m.g.rotation.x = 0;
  if (P.state === 'roll') { const k = P.t / P.dur; m.body.rotation.x = k * Math.PI * 2; m.body.position.y = .55 + Math.abs(Math.cos(k * Math.PI)) * .3; } else m.body.rotation.x = 0;
}

/* ================= Enemies ================= */
const KIND = {
  wolf: { n: 'Wolf', hp: 40, dmg: 9, spd: 6.8, reach: 1.7, wind: .45, rec: .75, cd: [.9, 1.7], xp: 16, gold: [0, 2], aggro: 19, rad: .5, quad: 1 },
  boar: { n: 'Wild Boar', hp: 72, dmg: 15, spd: 3.6, reach: 1.6, wind: .8, rec: 1.4, cd: [1.4, 2.4], xp: 24, gold: [0, 0], aggro: 7.5, rad: .6, quad: 1, charge: 1 },
  bandit: { n: 'Bandit', hp: 62, dmg: 11, spd: 4.4, reach: 2.3, wind: .62, rec: .6, cd: [.9, 1.9], xp: 30, gold: [4, 10], aggro: 23, rad: .45, block: .2 },
  archer: { n: 'Bandit Archer', hp: 44, dmg: 12, spd: 4.1, reach: 1.8, wind: 1.0, rec: .5, cd: [1.7, 2.8], xp: 32, gold: [4, 10], aggro: 32, rad: .45, ranged: 1 },
  brute: { n: 'Bandit Brute', hp: 165, dmg: 24, spd: 3.4, reach: 2.9, wind: 1.05, rec: 1.0, cd: [1.4, 2.2], xp: 90, gold: [15, 30], aggro: 23, rad: .6, scale: 1.28, heavy: 1, poise: 1 },
  boss: { n: 'The Black Constable', hp: 580, dmg: 25, spd: 4.6, reach: 3.2, wind: .64, rec: .7, cd: [.7, 1.4], xp: 500, gold: [150, 150], aggro: 30, rad: .65, scale: 1.38, boss: 1, poise: 1, block: .3 },
};
const enemies = [];
class Enemy {
  constructor(kind, x, z, group, tier = 0) {
    const K = this.K = KIND[kind]; this.kind = kind; this.group = group; group.m.push(this); this.camp = group.camp === undefined ? -1 : group.camp;
    this.home = { x, z }; this.pos = new T.Vector3(); this.kb = new T.Vector3(); this.maxHp = K.hp * (1 + .3 * tier); this.dmg = K.dmg * (1 + .22 * tier); this.seed = rand(9);
    let m;
    if (K.quad) m = quadruped(kind);
    else {
      const o = kind === 'boss' ? { body: 0x3b3e48, limb: 0x2f3239, cloth: 0x7a1512, metal: 1, coat: 1, cape: 1, scabbard: 1, helm: 'great', helmCol: 0x3b3e48, scale: K.scale }
        : kind === 'brute' ? { body: 0x5a4030, limb: 0x4a3626, cloth: 0x3a2a20, helm: 'kettle', scale: K.scale, trim: 0x2a2019, beard: 0x2a1c12 }
        : kind === 'archer' ? { body: 0x4c5a38, limb: 0x3f4a30, cloth: 0x3a4a2c, helm: 'hood', hood: 0x34432a, trim: 0x34432a, quiver: 1 }
        : { body: 0x6e4a2e, limb: 0x54402c, cloth: pick([0x5a2a22, 0x4a3a2a, 0x3a3a3a]), helm: Math.random() < .5 ? 'hood' : 'kettle', trim: 0x2a2019, beard: Math.random() < .5 ? pick([0x3a2a1c, 0x5a3a20, 0x2a2420]) : 0 };
      m = humanoid(o);
      if (kind === 'archer') { m.wp = weaponMesh('bow', 1); m.wpKind = 'bow'; m.aL.hand.add(m.wp); }
      else { m.wp = kind === 'boss' ? weaponMesh('sword', 1.45, true) : kind === 'brute' ? weaponMesh('maul', 1.15) : Math.random() < .5 ? weaponMesh('sword', .85) : weaponMesh('axe', .8); m.aR.hand.add(m.wp); }
    }
    this.m = m; scene.add(m.g);
    this.barB = new T.Sprite(new T.SpriteMaterial({ color: 0x140c0a, depthTest: false })); this.barF = new T.Sprite(new T.SpriteMaterial({ color: K.boss ? 0xc9a24a : 0xc23a2c, depthTest: false })); this.barB.scale.set(1.2, .12, 1); this.barF.center.set(0, .5); this.barB.renderOrder = 9; this.barF.renderOrder = 10; scene.add(this.barB, this.barF);
    enemies.push(this); this.reset();
  }
  reset() { this.hp = this.maxHp; this.pos.set(this.home.x, H(this.home.x, this.home.z), this.home.z); this.yaw = rand(6.28); this.state = 'idle'; this.t = 0; this.cd = rand(.5, 1.5); this.dead = false; this.deadT = 0; this.active = false; this.wt = rand(1, 4); this.wx = this.home.x; this.wz = this.home.z; this.mv = 0; this.phase = rand(6); this.flashT = 0; this.hitDone = false; this.cued = false; this.atk = 1; this.enraged = false; this.kb.set(0, 0, 0); this.m.g.visible = false; this.m.g.rotation.set(0, 0, 0); this.barB.visible = this.barF.visible = false; this.seen = false; }
  kill() { this.dead = true; this.deadT = 99; this.m.g.visible = false; this.barB.visible = this.barF.visible = false; }
  set(s) { this.state = s; this.t = 0; }
  stagger(d) { if (this.dead) return; this.set('stagger'); this.dur = this.K.boss ? d * .7 : d; this.kb.set(-Math.sin(this.yaw) * 3, 0, -Math.cos(this.yaw) * 3); }
  alert() { for (const e of this.group.m) if (!e.dead && e.state === 'idle') { e.set('chase'); e.seen = true; } if (this.kind === 'wolf') SFX.growl(); }
  damage(dmg, dx, dz, heavy) {
    if (this.dead) return; const K = this.K, y = this.pos.y + (K.quad ? .6 : 1.2 * (K.scale || 1));
    if (this.state === 'idle' || this.state === 'return') this.alert();
    if (K.block && this.state === 'chase' && !heavy && Math.random() < K.block) { dmg *= .25; burst(this.pos.x, y, this.pos.z, 10, SPARK, 5, 2); SFX.clang(1, .2); floatText(this.pos, 'BLOCKED', '#cfd6df', 2.4); }
    else { burst(this.pos.x, y, this.pos.z, heavy ? 16 : 9, BLOOD, 3, 2); SFX.hit(heavy); }
    if (this.state === 'stagger') dmg *= 1.3;
    this.hp -= dmg; this.flashT = .08; this.kb.set(dx * (heavy ? 7 : 4) / (K.poise ? 2.5 : 1), 0, dz * (heavy ? 7 : 4) / (K.poise ? 2.5 : 1)); floatText(this.pos, String(Math.round(dmg)), heavy ? '#ffd98a' : '#fff', K.quad ? 1.3 : 2.1);
    if (this.hp <= 0) return this.die();
    if (this.state !== 'stagger' && (!K.poise || (heavy && !K.boss && this.state !== 'strike'))) { this.set('hit'); }
  }
  die() {
    const K = this.K; this.dead = true; this.deadT = 0; this.hp = 0; this.barB.visible = this.barF.visible = false; SFX.death(); P.kills++; G.hitstop = Math.max(G.hitstop, K.boss ? .3 : .1); shake(K.boss ? 1.2 : .5);
    const gold = Math.round(rand(K.gold[0], K.gold[1])); if (gold) { P.gold += gold; floatText(this.pos, `+${gold} gold`, '#f0d58a', 1.2); SFX.coin(); }
    if (!K.quad && Math.random() < .2 && P.band < P.bandCap) { P.band++; toast('Found a <b>bandage</b> on the body.'); }
    gainXp(K.xp);
    if (this.camp >= 0 && !G.camps[this.camp] && this.group.m.every(e => e.dead)) campCleared(this.camp);
    if (K.boss) bossSlain();
  }
}
function campCleared(i) {
  G.camps[i] = true; campBanners[i].material.color.setHex(0x27406b); toast(`<b>${CAMPS[i].n} cleared.</b> ${G.camps.filter(Boolean).length} of 3 camps taken.`, 'gold'); SFX.fanfare(); gainXp(80 + 40 * i); P.gold += 30;
  if (G.camps.every(Boolean)) { openGate(); toast('The gate of the <b>Black Keep</b> stands open.', 'gold'); }
  saveGame();
}
function openGate() { gate.mesh.visible = false; gate.box.off = true; }
function bossSlain() { G.bossDead = true; saveGame(); setTimeout(() => { if (G.mode === 'play') showWin(); }, 3200); }
const mkGroup = camp => ({ m: [], camp });
function spawnAll() {
  const r = rng32(900), ring = (kind, c, n, rad, g, tier) => { for (let i = 0; i < n; i++) { const a = r() * 6.283, d = rad * (.4 + r() * .6); new Enemy(kind, c.x + Math.cos(a) * d, c.z + Math.sin(a) * d, g, tier); } };
  DENS.forEach((d, i) => ring('wolf', d, i === 3 ? 4 : 3, 6, mkGroup(), i > 1 ? 1 : 0));
  BOARS.forEach(b => ring('boar', b, 3, 9, mkGroup(), 0));
  CAMPS.forEach((c, i) => { const g = mkGroup(i); ring('bandit', c, i === 2 ? 4 : 3, 9, g, i); ring('archer', c, i ? 2 : 1, 11, g, i); if (i) ring('brute', c, i, 4, g, i); });
  ring('bandit', { x: 78, z: -30 }, 2, 3, mkGroup(), 0);
  const kg = mkGroup(); kg.boss = true; new Enemy('boss', KEEP.x + 4, KEEP.z, kg, 0); ring('bandit', { x: KEEP.x - 6, z: KEEP.z }, 2, 6, kg, 2);
}
function resetEnemies() { for (const e of enemies) { if ((e.camp >= 0 && G.camps[e.camp]) || (e.group.boss && G.bossDead)) e.kill(); else e.reset(); } for (const a of arrows) { a.life = 0; a.m.visible = false; } }
const tipOf = e => { const s = e.K.scale || 1; return [e.pos.x + Math.sin(e.yaw) * .7 * s, e.pos.y + (e.K.quad ? .7 : 1.9 * s), e.pos.z + Math.cos(e.yaw) * .7 * s]; };
let attackers = 0;
function updateEnemy(e, dt) {
  const K = e.K, m = e.m, dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz), toP = Math.atan2(dx, dz);
  if (e.dead) { if (e.deadT > 8) return; e.deadT += dt; if (K.quad) m.g.rotation.z += (1.5 - m.g.rotation.z) * Math.min(1, dt * 6); else m.g.rotation.x += (-1.5 - m.g.rotation.x) * Math.min(1, dt * 5); m.g.position.y = e.pos.y + (K.quad ? .1 : .12) - Math.max(0, e.deadT - 5) * .5; if (e.deadT > 8) m.g.visible = false; return; }
  e.active = d < 120 || e.state !== 'idle'; m.g.visible = e.active; if (!e.active) return;
  e.t += dt; e.cd -= dt; let moveX = 0, moveZ = 0, spd = 0, pose = null;
  if (e.flashT > 0) { e.flashT -= dt; const on = e.flashT > 0; for (const q of m.parts) { if (on && !q.userData.m) { q.userData.m = q.material; q.material = MAT.white; } else if (!on && q.userData.m) { q.material = q.userData.m; q.userData.m = null; } } }
  if (e.kb.lengthSq() > .01) { moveActor(e.pos, e.kb.x * dt, e.kb.z * dt, K.rad); e.kb.multiplyScalar(Math.exp(-8 * dt)); }
  const face = (a, r = 10) => { e.yaw += angDiff(a, e.yaw) * Math.min(1, dt * r); };
  const hd = Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z);
  switch (e.state) {
    case 'idle': {
      e.wt -= dt; if (e.wt <= 0) { e.wt = rand(2.5, 6); const a = rand(6.28), r = rand(1, 6); e.wx = e.home.x + Math.cos(a) * r; e.wz = e.home.z + Math.sin(a) * r; }
      const wx = e.wx - e.pos.x, wz = e.wz - e.pos.z, wd = Math.hypot(wx, wz); if (wd > .6) { moveX = wx / wd; moveZ = wz / wd; spd = K.spd * .3; face(Math.atan2(wx, wz), 4); }
      if (P.alive && G.mode === 'play' && d < K.aggro * (G.night > .5 && K.quad ? 1.25 : 1)) e.alert();
      break;
    }
    case 'return': { const wx = e.home.x - e.pos.x, wz = e.home.z - e.pos.z, wd = Math.hypot(wx, wz); e.hp = Math.min(e.maxHp, e.hp + e.maxHp * .2 * dt); if (wd < 2) { e.set('idle'); break; } moveX = wx / wd; moveZ = wz / wd; spd = K.spd; face(Math.atan2(wx, wz)); break; }
    case 'chase': {
      if (!P.alive || hd > 62 || d > 70) { e.set('return'); break; }
      if (K.boss && !e.enraged && e.hp < e.maxHp * .5) { e.enraged = true; floatText(e.pos, 'ENRAGED', '#ff5a3c', 3); SFX.warn(); shake(.5); }
      const sp = K.spd * (e.enraged ? 1.25 : 1); face(toP);
      if (K.ranged) { if (d < 8) { moveX = -dx / d; moveZ = -dz / d; spd = sp; } else if (d > 25) { moveX = dx / d; moveZ = dz / d; spd = sp; } if (e.cd <= 0 && d < 32 && d > 4) { e.set('wind'); e.cued = false; } break; }
      if (K.charge) { if (d > 9) { moveX = dx / d; moveZ = dz / d; spd = sp; } if (e.cd <= 0 && d < 11) { e.set('wind'); e.cued = false; SFX.squeal(); } break; }
      const want = K.quad ? 3.4 : K.reach * .8;
      if (d > want) { moveX = dx / d; moveZ = dz / d; spd = sp * (K.quad ? 1 : d > 8 ? 1.25 : 1); }
      if (e.cd <= 0) {
        if (K.boss && d > 5 && d < 11 && Math.random() < dt * 1.5) { e.atk = 'leap'; e.set('wind'); e.cued = false; SFX.warn(); }
        else if (d < (K.quad ? 4.4 : K.reach * .96) && (attackers < 2 || K.boss)) { e.atk = K.boss ? (Math.random() < .45 ? 'combo' : 1) : Math.random() < .5 ? 1 : 2; e.second = false; e.set('wind'); e.cued = false; attackers++; if (K.heavy) SFX.warn(); }
      }
      break;
    }
    case 'wind': {
      const unb = K.heavy || e.atk === 'leap', w = (e.atk === 'leap' ? .85 : e.second ? .38 : K.wind) / (e.enraged ? 1.2 : 1); if (e.t < w * .75 || !K.quad) face(toP, K.heavy ? 5 : 9);
      pose = K.ranged ? 'aim' : unb ? 'windH' : e.atk === 2 ? 'wind2' : 'wind1';
      if (unb && Math.random() < dt * 40) { const tp = tipOf(e); spawnP(tp[0], tp[1], tp[2], rand(-1, 1), rand(0, 2), rand(-1, 1), .4, RED, 0); }
      if (!e.cued && !unb && !K.charge && w - e.t <= P.parryWin - .03) { e.cued = true; const tp = tipOf(e); burst(tp[0], tp[1], tp[2], 12, GOLD, 2.5, 1, 0); if (d < 30) SFX.cue(); }
      if (e.t >= w) { e.set('strike'); e.hitDone = false; e.sx = dx / (d || 1); e.sz = dz / (d || 1); if (K.ranged) { fireArrow(e); SFX.bow(); } else if (!K.quad) SFX.swing(unb); if (e.atk === 'leap') { e.lx = e.pos.x; e.lz = e.pos.z; e.tx = P.pos.x - e.sx * 1.5; e.tz = P.pos.z - e.sz * 1.5; } }
      break;
    }
    case 'strike': {
      if (K.ranged) { pose = 'aim'; if (e.t > .3) { e.set('recover'); } break; }
      if (K.quad) { const dur = K.charge ? 1.1 : .34, v = K.charge ? 11 : 12.5; moveActor(e.pos, e.sx * v * dt, e.sz * v * dt, K.rad); e.yaw = Math.atan2(e.sx, e.sz); e.mv = 1; if (!e.hitDone && d < (K.charge ? 1.5 : 1.35)) { e.hitDone = true; hitPlayer(e.dmg, e, { knock: K.charge ? 11 : 0 }); } if (e.t >= dur) e.set('recover'); break; }
      if (e.atk === 'leap') { const k = Math.min(1, e.t / .42); e.pos.x = lerp(e.lx, e.tx, k); e.pos.z = lerp(e.lz, e.tz, k); resolve(e.pos, K.rad); e.pos.y = H(e.pos.x, e.pos.z) + Math.sin(k * Math.PI) * 2.2; pose = k < .7 ? 'windH' : 'strikeH'; if (k >= 1 && !e.hitDone) { e.hitDone = true; burst(e.pos.x, e.pos.y + .2, e.pos.z, 30, DUST, 5, 1.5, 3); shake(.8); SFX.hit(true); if (d < 3.6) hitPlayer(e.dmg * 1.4, e, { unblockable: true, knock: 9 }); } if (e.t > .7) e.set('recover'); break; }
      pose = K.heavy ? 'strikeH' : e.atk === 2 ? 'strike2' : 'strike1';
      if (!e.hitDone && e.t >= .09) { e.hitDone = true; if (d < K.reach * (K.scale || 1) * .9 + .6 && Math.abs(angDiff(toP, e.yaw)) < 1.05) hitPlayer(e.dmg, e, { unblockable: !!K.heavy, knock: K.heavy ? 8 : 0 }); if (K.heavy) { burst(e.pos.x + Math.sin(e.yaw) * 2, e.pos.y + .2, e.pos.z + Math.cos(e.yaw) * 2, 16, DUST, 3, 1, 3); shake(.4); } }
      if (e.t >= .32) { if (e.atk === 'combo' && !e.second && e.state === 'strike') { e.second = true; e.atk = 2; e.set('wind'); e.cued = false; e.atkKeep = true; } else e.set('recover'); }
      break;
    }
    case 'recover': if (!K.quad && e.t < .2) pose = K.heavy ? 'strikeH' : 'strike1'; if (e.t >= K.rec / (e.enraged ? 1.3 : 1)) { e.set('chase'); e.cd = rand(K.cd[0], K.cd[1]) / (e.enraged ? 1.4 : 1); } break;
    case 'hit': pose = 'hit'; if (e.t >= .3) e.set('chase'); break;
    case 'stagger': pose = 'stagger'; if (e.t >= e.dur) { e.set('chase'); e.cd = .4; } break;
    default: break;
  }
  if (spd > 0) {
    for (const o of enemies) { if (o === e || o.dead || !o.active) continue; const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z, od = ox * ox + oz * oz; if (od < 2.2 && od > .0001) { const l = Math.sqrt(od); moveX += ox / l * .9; moveZ += oz / l * .9; } }
    const l = Math.hypot(moveX, moveZ) || 1; moveActor(e.pos, moveX / l * spd * dt, moveZ / l * spd * dt, K.rad); e.phase += dt * spd * (K.quad ? 2.6 : 2.2);
  } else if (e.state !== 'strike') e.pos.y = H(e.pos.x, e.pos.z);
  const pd = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z), mn = K.rad + .45; if (pd < mn && pd > .001 && e.state !== 'strike') { e.pos.x -= (P.pos.x - e.pos.x) / pd * (mn - pd); e.pos.z -= (P.pos.z - e.pos.z) / pd * (mn - pd); }
  e.mv += ((spd > 0 || (K.quad && e.state === 'strike') ? Math.min(1, spd / K.spd + .3) : 0) - e.mv) * Math.min(1, dt * 10);
  m.g.position.copy(e.pos); m.g.rotation.y = e.yaw;
  if (K.quad) { const s = Math.sin(e.phase); m.legs[0].rotation.x = s * .8 * e.mv; m.legs[3].rotation.x = s * .8 * e.mv; m.legs[1].rotation.x = -s * .8 * e.mv; m.legs[2].rotation.x = -s * .8 * e.mv; const crouch = e.state === 'wind' ? Math.min(1, e.t * 4) : 0; m.body.position.y = (e.kind === 'wolf' ? .62 : .6) - crouch * .16; m.body.rotation.x += ((e.state === 'strike' && !K.charge ? -.35 : crouch * .2) - m.body.rotation.x) * Math.min(1, dt * 12); m.head.rotation.x = crouch * .4 + Math.sin(G.time * 2 + e.seed) * .05; }
  else animHuman(m, pose, e.mv, e.phase, dt, false);
  const show = e.seen && e.state !== 'idle' || e.hp < e.maxHp; e.barB.visible = e.barF.visible = show && !K.boss;
  if (show && !K.boss) { const y = e.pos.y + (K.quad ? 1.25 : 2.15 * (K.scale || 1)); e.barB.position.set(e.pos.x, y, e.pos.z); v3.set(1, 0, 0).applyQuaternion(camera.quaternion); e.barF.position.set(e.pos.x - v3.x * .58, y, e.pos.z - v3.z * .58); e.barF.scale.set(1.16 * Math.max(.001, e.hp / e.maxHp), .08, 1); }
}
/* arrows */
const arrowG = merge([[GEO.cyl, MX(0, 0, 0, .012, .85, .012, 0, Math.PI / 2), 0x6b4a2c], [GEO.cone, MX(0, 0, .45, .03, .1, .03, 0, Math.PI / 2), 0xc8d0da], [GEO.box, MX(0, 0, -.38, .09, .01, .12), 0xe8e0cc]]);
const arrows = []; for (let i = 0; i < 14; i++) { const m = new T.Mesh(arrowG, MAT.vc); m.visible = false; scene.add(m); arrows.push({ m, vel: new T.Vector3(), life: 0, stuck: false, dmg: 0, src: null }); }
function fireArrow(e) {
  const a = arrows.find(q => q.life <= 0) || arrows[0], s = e.K.scale || 1; a.m.position.set(e.pos.x + Math.sin(e.yaw) * .5, e.pos.y + 1.45 * s, e.pos.z + Math.cos(e.yaw) * .5);
  const dist = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z), tf = dist / 34; v3.set(P.pos.x + P.vx * tf * .7, P.pos.y + 1.15, P.pos.z + P.vz * tf * .7).sub(a.m.position).normalize();
  a.vel.copy(v3).multiplyScalar(34); a.vel.y += 3 * tf; a.life = 3; a.stuck = false; a.dmg = e.dmg; a.src = e; a.m.visible = true;
}
function updateArrows(dt) {
  for (const a of arrows) {
    if (a.life <= 0) continue; a.life -= dt; if (a.life <= 0) { a.m.visible = false; continue; } if (a.stuck) continue;
    a.vel.y -= 6 * dt; a.m.position.addScaledVector(a.vel, dt); v3.copy(a.m.position).add(a.vel); a.m.lookAt(v3);
    const p = a.m.position; if (p.y < H(p.x, p.z)) { a.stuck = true; a.life = 5; SFX.thud(); continue; }
    if (P.alive && Math.hypot(p.x - P.pos.x, p.z - P.pos.z) < .6 && Math.abs(p.y - P.pos.y - 1) < 1.1) { hitPlayer(a.dmg, { pos: a.src.pos }, { ranged: true }); a.life = 0; a.m.visible = false; }
  }
}

/* ================= World interaction ================= */
const chestOpen = CHESTS.map(() => false);
function grantLoot(l) {
  const out = [];
  if (l.w && !P.weapons.includes(l.w)) { P.weapons.push(l.w); out.push(`<b>${WEAPONS[l.w].n}</b>`); if (WEAPONS[l.w].dmg > WEAPONS[P.weapon].dmg) { P.weapon = l.w; buildPlayerModel(); out[out.length - 1] += ' (equipped)'; } }
  if (l.a && !P.armors.includes(l.a)) { P.armors.push(l.a); out.push(`<b>${ARMORS[l.a].n}</b>`); if (ARMORS[l.a].def > ARMORS[P.armor].def) { P.armor = l.a; buildPlayerModel(); out[out.length - 1] += ' (equipped)'; } }
  if (l.g) { P.gold += l.g; out.push(`${l.g} gold`); } if (l.b) { P.band = Math.min(P.bandCap, P.band + l.b); out.push(`${l.b} bandage${l.b > 1 ? 's' : ''}`); }
  return out.join(', ');
}
function doInteract(o) {
  if (o.type === 'chest') { o.open = true; chestOpen[o.i] = true; o.glow.visible = false; SFX.chest(); burst(o.x, H(o.x, o.z) + .7, o.z, 24, GOLD, 2.5, 3, 3); toast('Chest: ' + grantLoot(CHESTS[o.i].loot), 'gold'); gainXp(25); saveGame(); }
  else if (o.type === 'herb') { o.gone = true; herbMesh.setMatrixAt(o.i, MX(0, -50, 0, .001)); herbMesh.instanceMatrix.needsUpdate = true; SFX.pickup(); P.herbs++; burst(o.x, H(o.x, o.z) + .4, o.z, 8, LEAF, 1.5, 2, 4); if (P.herbs >= 3) { P.herbs -= 3; if (P.band < P.bandCap) { P.band++; toast('Three herbs bound into a <b>bandage</b>.'); } else { P.gold += 10; toast('Pouch is full of bandages. Sold the herbs for 10 gold.'); } } else toast(`Herbs gathered (${P.herbs}/3 for a bandage).`); }
  else if (o.type === 'shrine') { const s = SHRINES[o.i]; P.shrines.push(o.i); shrineRunes[o.i].visible = false; applyShrine(s.buff, true); SFX.shrine(); burst(o.x, H(o.x, o.z) + 1.5, o.z, 40, BLUE, 3, 3, 1); toast(`The stones answer: <b>${s.t}</b>.`, 'gold'); gainXp(40); saveGame(); }
  else if (o.type === 'fire') { P.fire = o.i; openRest(); }
}
function applyShrine(b, fresh) { if (b === 'hp') { P.maxHp += 20; if (fresh) P.hp += 20; } else if (b === 'stam') P.maxStam += 25; else if (b === 'dmg') P.dmgBuff *= 1.12; else { P.bandCap += 2; if (fresh) P.band = Math.min(P.bandCap, P.band + 2); } }
const usable = o => o.type === 'chest' ? !o.open : o.type === 'herb' ? !o.gone : o.type === 'shrine' ? !P.shrines.includes(o.i) : true;
function findNearest() { let best = null, bd = 2.9; for (const o of interact) { const d = Math.hypot(o.x - P.pos.x, o.z - P.pos.z); if (d < bd && usable(o)) { bd = d; best = o; } } if (best !== G.nearest) { G.nearest = best; const p = $('prompt'); if (best && P.alive) { p.innerHTML = `<b>${isTouch() ? 'USE' : 'E'}</b> ${best.label}`; p.classList.remove('hidden'); } else p.classList.add('hidden'); } }

/* ================= Save / load ================= */
function saveGame() {
  if (G.mode !== 'play' || !P.alive) return;
  store.game = { p: { x: P.pos.x, z: P.pos.z, yaw: P.yaw, hp: P.hp, level: P.level, xp: P.xp, gold: P.gold, band: P.band, herbs: P.herbs, weapons: P.weapons, armors: P.armors, weapon: P.weapon, armor: P.armor, sharpen: P.sharpen, shrines: P.shrines, fire: P.fire, kills: P.kills, time: P.time }, camps: G.camps, bossDead: G.bossDead, won: G.won, chests: chestOpen, herbs: herbs.map(h => h.gone), tod: G.tod };
  persist();
}
function startGame(load) {
  const s = load ? store.game : null, d = s ? s.p : {};
  Object.assign(P, { state: 'idle', t: 0, alive: true, maxHp: 100, maxStam: 100, bandCap: 3, dmgBuff: 1, blocking: false, invuln: 0, combo: 0, mv: 0, ripT: 0, flashT: 0, vx: 0, vz: 0,
    level: d.level || 1, xp: d.xp || 0, gold: d.gold || 0, band: d.band === undefined ? 2 : d.band, herbs: d.herbs || 0, weapons: (d.weapons || ['sword']).slice(), armors: (d.armors || ['tunic']).slice(), weapon: d.weapon || 'sword', armor: d.armor || 'tunic', sharpen: d.sharpen || 0, shrines: (d.shrines || []).slice(), fire: d.fire || 0, kills: d.kills || 0, time: d.time || 0 });
  P.maxHp = 100 + 10 * (P.level - 1); P.shrines.forEach(i => applyShrine(SHRINES[i].buff, false)); P.hp = s ? Math.min(P.maxHp, d.hp) : P.maxHp; P.stam = P.maxStam; P.kb.set(0, 0, 0);
  P.pos.set(s ? d.x : 0, 0, s ? d.z : 7); P.pos.y = H(P.pos.x, P.pos.z); P.yaw = s ? d.yaw : Math.PI;
  G.camps = s ? s.camps.slice() : [false, false, false]; G.bossDead = !!(s && s.bossDead); G.won = !!(s && s.won); G.tod = s ? s.tod : .32; G.camYaw = P.yaw; G.camPitch = .3; G.hitstop = 0; G.shake = 0; G.hurt = 0; G.hintI = 0; G.hintT = s ? 9999 : 2; G.nearest = null; G.combatT = 0;
  chests.forEach((c, i) => { c.open = chestOpen[i] = !!(s && s.chests[i]); c.lid.rotation.x = c.open ? -1.9 : 0; c.glow.visible = !c.open; });
  herbs.forEach((h, i) => { h.gone = !!(s && s.herbs[i]); herbMesh.setMatrixAt(i, h.gone ? MX(0, -50, 0, .001) : MX(h.x, H(h.x, h.z), h.z, 1.5)); }); herbMesh.instanceMatrix.needsUpdate = true;
  shrineRunes.forEach((r, i) => { r.visible = !P.shrines.includes(i); }); campBanners.forEach((b, i) => b.material.color.setHex(G.camps[i] ? 0x27406b : 0x8f1f18));
  const open = G.camps.every(Boolean); gate.mesh.visible = !open; gate.box.off = open;
  buildPlayerModel(); resetEnemies(); G.mode = 'play'; closePanel(); showHud(true); MUS.mode = 'menu'; grassCell = '';
  if (!s) { toast('You wake at <b>Greywatch Camp</b>. Three bandit camps hold the Marches, and their master sits in the Black Keep.', 'gold'); saveGame(); }
}

/* ================= UI ================= */
const isTouch = () => document.body.classList.contains('touch');
const PANELS = ['sTitle', 'sHow', 'sSet', 'sPause', 'sInv', 'sMap', 'sRest', 'sDead', 'sWin'];
let backTo = null;
function openPanel(id) { PANELS.forEach(p => $(p).classList.toggle('hidden', p !== id)); G.panel = id; if (document.pointerLockElement) document.exitPointerLock(); inp.mx = inp.mz = 0; inp.block = inp.sprint = false; inp.keys = {}; }
function closePanel() { PANELS.forEach(p => $(p).classList.add('hidden')); G.panel = null; }
function showHud(v) { for (const id of ['hud', 'mini', 'obj', 'toasts', 'floats']) $(id).classList.toggle('hidden', !v); $('touch').classList.toggle('hidden', !(v && isTouch())); if (!v) { $('prompt').classList.add('hidden'); $('hint').classList.add('hidden'); $('boss').classList.add('hidden'); } }
function toTitle() { saveGame(); G.mode = 'title'; showHud(false); $('bCont').classList.toggle('hidden', !store.game); $('record').textContent = store.best ? `Fastest victory: ${fmtTime(store.best)}` : ''; openPanel('sTitle'); MUS.mode = 'menu'; if (P.m) P.m.g.visible = false; }
function objective() { const n = G.camps.filter(Boolean).length; return G.bossDead ? 'The Marches are free. Roam as you please.' : n < 3 ? `Clear the bandit camps (${n}/3)` : 'Enter the Black Keep and slay the Constable'; }
function statsHtml() { return `<div><span>Time</span><b>${fmtTime(P.time)}</b></div><div><span>Level</span><b>${P.level}</b></div><div><span>Foes slain</span><b>${P.kills}</b></div><div><span>Chests found</span><b>${chestOpen.filter(Boolean).length}/${CHESTS.length}</b></div>`; }
function showDeath() { $('deadSub').textContent = `You wake again at ${FIRES[P.fire].n}, a quarter of your gold lighter.`; $('deadStats').innerHTML = statsHtml(); SFX.dirge(); openPanel('sDead'); }
function respawn() { const f = FIRES[P.fire]; P.gold = Math.floor(P.gold * .75); P.alive = true; P.hp = P.maxHp; P.stam = P.maxStam; setP('idle'); P.pos.set(f.x + 2.2, 0, f.z + 2.2); P.pos.y = H(P.pos.x, P.pos.z); P.kb.set(0, 0, 0); P.m.g.rotation.x = 0; resetEnemies(); closePanel(); saveGame(); }
function showWin() { if (!G.won) { G.won = true; if (!store.best || P.time < store.best) store.best = Math.round(P.time); } saveGame(); $('winStats').innerHTML = statsHtml(); SFX.fanfare(); openPanel('sWin'); }
function openRest() { P.hp = P.maxHp; P.stam = P.maxStam; resetEnemies(); saveGame(); SFX.heal(); renderRest(); openPanel('sRest'); }
function renderRest() {
  $('restSub').textContent = `${FIRES[P.fire].n}. Wounds bound, and the wilds stir again. Progress saved.`; $('restGold').textContent = P.gold;
  const sc = 60 * (P.sharpen + 1), box = $('restOpts'); box.innerHTML = '';
  const opt = (name, desc, cost, can, fn) => { const b = document.createElement('button'); b.className = 'card' + (can && P.gold >= cost ? '' : ' poor'); b.innerHTML = `<div class="cn">${name}</div><div class="cd">${desc}</div><div class="cc"><span class="coin"></span>${cost}</div>`; b.onclick = () => { if (!can || P.gold < cost) { SFX.deny(); return; } P.gold -= cost; fn(); SFX.coin(); saveGame(); renderRest(); }; box.appendChild(b); };
  opt('Bandage', `Mends 45% of your health. You carry ${P.band} of ${P.bandCap}.`, 20, P.band < P.bandCap, () => { P.band++; });
  opt('Whetstone', P.sharpen >= 5 ? 'Your blade is as keen as it can be.' : `+8% damage, permanently. Rank ${P.sharpen} of 5.`, sc, P.sharpen < 5, () => { P.sharpen++; });
}
function renderInv() {
  const mk = (list, cur, tbl, stat, set) => list.map(k => `<button class="row${k === cur ? ' on' : ''}" data-k="${k}"><span>${tbl[k].n}</span><i>${stat(tbl[k])}</i></button>`).join('');
  $('invW').innerHTML = mk(P.weapons, P.weapon, WEAPONS, w => `${w.dmg} dmg · ${w.spd >= .95 ? 'fast' : w.spd >= .85 ? 'steady' : 'slow'} · reach ${w.reach.toFixed(1)}`);
  $('invA').innerHTML = mk(P.armors, P.armor, ARMORS, a => `${Math.round(a.def * 100)}% protection`);
  $('invW').querySelectorAll('.row').forEach(b => b.onclick = () => { P.weapon = b.dataset.k; buildPlayerModel(); SFX.click(); renderInv(); });
  $('invA').querySelectorAll('.row').forEach(b => b.onclick = () => { P.armor = b.dataset.k; buildPlayerModel(); SFX.click(); renderInv(); });
  $('invStats').innerHTML = `<div><span>Level</span><b>${P.level}</b></div><div><span>Health</span><b>${Math.round(P.hp)}/${P.maxHp}</b></div><div><span>Damage</span><b>${Math.round(playerDmg())}</b></div><div><span>Gold</span><b>${P.gold}</b></div><div><span>Bandages</span><b>${P.band}/${P.bandCap}</b></div><div><span>Herbs</span><b>${P.herbs}/3</b></div>`;
}
function drawIcons(g, toX, toY, big) {
  const ic = (x, z, col, r, sq) => { const px = toX(x), py = toY(z); g.fillStyle = '#000'; g.beginPath(); sq ? g.rect(px - r - 1, py - r - 1, r * 2 + 2, r * 2 + 2) : g.arc(px, py, r + 1.2, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); sq ? g.rect(px - r, py - r, r * 2, r * 2) : g.arc(px, py, r, 0, 7); g.fill(); };
  const s = big ? 1.4 : 1; FIRES.forEach(f => ic(f.x, f.z, '#ff9a3c', 3.4 * s)); CAMPS.forEach((c, i) => ic(c.x, c.z, G.camps[i] ? '#4f8a3c' : '#c23a2c', 4.4 * s, true)); ic(KEEP.x, KEEP.z, G.bossDead ? '#4f8a3c' : '#101010', 5 * s, true);
  if (big) { SHRINES.forEach((q, i) => { if (P.shrines.includes(i)) ic(q.x, q.z, '#8fd0ff', 3); }); chests.forEach(c => { if (c.open) ic(c.x, c.z, '#8a7a5a', 2.4); }); }
}
function renderMap() {
  const c = $('mapCv'), g = c.getContext('2d'), s = c.width; g.imageSmoothingEnabled = true; g.drawImage(mapImg, 0, 0, s, s); const tx = x => (x + WORLD) / (WORLD * 2) * s, tz = tx;
  drawIcons(g, tx, tz, true); g.save(); g.translate(tx(P.pos.x), tz(P.pos.z)); g.rotate(Math.PI - P.yaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 7); g.lineTo(0, 3); g.lineTo(-6, 7); g.closePath(); g.fill(); g.stroke(); g.restore();
}
const mini = $('mini'), mg = mini.getContext('2d');
function drawMini() {
  const s = mini.width, R = 85, g = mg; g.save(); g.clearRect(0, 0, s, s); g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 2, 0, 7); g.clip();
  g.drawImage(mapImg, (P.pos.x + WORLD) / 2 - R / 2, (P.pos.z + WORLD) / 2 - R / 2, R, R, 0, 0, s, s);
  const k = s / (R * 2), cl = (x, z) => { let dx = (x - P.pos.x) * k, dz = (z - P.pos.z) * k; const d = Math.hypot(dx, dz), m = s / 2 - 9; if (d > m) { dx *= m / d; dz *= m / d; } return [s / 2 + dx, s / 2 + dz]; };
  const pt = (x, z, col, r, sq) => { const [px, py] = cl(x, z); g.fillStyle = '#000'; g.beginPath(); sq ? g.rect(px - r - 1, py - r - 1, r * 2 + 2, r * 2 + 2) : g.arc(px, py, r + 1, 0, 7); g.fill(); g.fillStyle = col; g.beginPath(); sq ? g.rect(px - r, py - r, r * 2, r * 2) : g.arc(px, py, r, 0, 7); g.fill(); };
  FIRES.forEach(f => { if (Math.hypot(f.x - P.pos.x, f.z - P.pos.z) < 95) pt(f.x, f.z, '#ff9a3c', 3); }); CAMPS.forEach((c, i) => pt(c.x, c.z, G.camps[i] ? '#4f8a3c' : '#c23a2c', 4, true)); if (G.camps.every(Boolean) || Math.hypot(KEEP.x - P.pos.x, KEEP.z - P.pos.z) < 95) pt(KEEP.x, KEEP.z, G.bossDead ? '#4f8a3c' : '#101010', 4.5, true);
  for (const c of chests) if (!c.open && Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < 45) pt(c.x, c.z, '#ffd76a', 2.4);
  for (const e of enemies) if (!e.dead && e.active && e.state !== 'idle' && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 80) pt(e.pos.x, e.pos.z, '#ff5040', 2);
  g.translate(s / 2, s / 2); g.rotate(Math.PI - P.yaw); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
  g.strokeStyle = '#7a6230'; g.lineWidth = 3; g.beginPath(); g.arc(s / 2, s / 2, s / 2 - 2, 0, 7); g.stroke(); g.fillStyle = '#e8dcc0'; g.font = '11px Georgia'; g.textAlign = 'center'; g.fillText('N', s / 2, 13);
}
const hc = {};
const setTxt = (id, v) => { if (hc[id] !== v) { hc[id] = v; $(id).textContent = v; } };
const setBar = (id, v) => { v = clamp(v, 0, 1); if (hc[id] !== v) { hc[id] = v; $(id).style.transform = `scaleX(${v.toFixed(4)})`; } };
function updateHud() {
  $('hurt').style.opacity = Math.max(0, G.hurt).toFixed(2); $('flash').style.opacity = Math.max(0, G.flash * .4).toFixed(2);
  if (G.mode !== 'play') return;
  setBar('hpFill', P.hp / P.maxHp); setBar('stFill', P.stam / P.maxStam); setBar('xpFill', P.xp / xpNeed(P.level)); setTxt('lvl', 'Lv ' + P.level); setTxt('goldV', String(P.gold)); setTxt('bandV', `${P.band}/${P.bandCap}`); setTxt('herbV', `${P.herbs}/3`); setTxt('objT', objective()); setTxt('hpT', `${Math.max(0, Math.round(P.hp))} / ${P.maxHp}`);
  const b = enemies.find(e => e.K.boss && !e.dead && e.state !== 'idle' && e.state !== 'return'); $('boss').classList.toggle('hidden', !b); if (b) setBar('bossFill', b.hp / b.maxHp);
  drawMini();
}
const HINTS = [['<b>WASD</b> to move, mouse to look. Click the game to capture the mouse. Hold <b>Shift</b> to sprint.', 'Left stick to move. Drag the right side of the screen to look.'], ['<b>Left click</b> to strike — click again to chain three cuts. <b>F</b> is a heavy blow.', '<b>ATK</b> to strike — tap again to chain. <b>HVY</b> is a heavy blow.'], ['Hold <b>right click</b> or <b>Q</b> to block. Press it when a weapon <b>flashes gold</b> to parry.', 'Hold <b>BLK</b> to block. Press it when a weapon <b>flashes gold</b> to parry.'], ['<b>Space</b> rolls through danger. A <b>red glow</b> cannot be blocked — roll.', '<b>ROLL</b> through danger. A <b>red glow</b> cannot be blocked.'], ['<b>R</b> uses a bandage. <b>E</b> opens chests, gathers herbs and rests at fires.', '<b>HEAL</b> uses a bandage. <b>USE</b> opens chests, gathers herbs and rests at fires.'], ['<b>Tab</b> opens your pack, <b>M</b> the map. Red squares on the map are bandit camps.', 'The bag and map buttons are at the top. Red squares on the map are bandit camps.']];
function updateHints(dt) { const h = $('hint'); if (G.hintI > HINTS.length) return; G.hintT -= dt; if (G.hintT > 0) return; if (G.hintI === HINTS.length) { h.classList.add('hidden'); G.hintI++; return; } h.innerHTML = HINTS[G.hintI++][isTouch() ? 1 : 0]; h.classList.remove('hidden'); G.hintT = 8.5; }

/* ---------- buttons & settings ---------- */
function bind(id, fn) { $(id).addEventListener('click', () => { audioInit(); SFX.click(); fn(); }); }
bind('bNew', () => startGame(false)); bind('bCont', () => startGame(true));
bind('bHow', () => { backTo = 'sTitle'; openPanel('sHow'); }); bind('bSet', () => { backTo = 'sTitle'; openPanel('sSet'); });
bind('bHowBack', () => backTo ? openPanel(backTo) : closePanel()); bind('bSetBack', () => backTo ? openPanel(backTo) : closePanel());
bind('bResume', closePanel); bind('bPHow', () => { backTo = 'sPause'; openPanel('sHow'); }); bind('bPSet', () => { backTo = 'sPause'; openPanel('sSet'); }); bind('bQuit', toTitle);
bind('bInvBack', closePanel); bind('bMapBack', closePanel); bind('bRestBack', closePanel); bind('bRespawn', respawn); bind('bDeadTitle', () => { respawn(); toTitle(); }); bind('bWinGo', closePanel); bind('bWinTitle', toTitle);
bind('tBag', () => { renderInv(); openPanel('sInv'); }); bind('tMap', () => { renderMap(); openPanel('sMap'); }); bind('tPause', () => openPanel('sPause'));
function syncSettings() { $('vMaster').value = S.master * 100; $('vMusic').value = S.music * 100; $('vSfx').value = S.sfx * 100; $('vSens').value = S.sens * 50; $('cMute').checked = S.mute; $('cShake').checked = S.shake; $('cLow').checked = S.low; }
syncSettings();
for (const [id, key, k] of [['vMaster', 'master', 100], ['vMusic', 'music', 100], ['vSfx', 'sfx', 100], ['vSens', 'sens', 50]]) $(id).addEventListener('input', e => { S[key] = e.target.value / k; applyVolumes(); persist(); });
$('cMute').addEventListener('change', e => { S.mute = e.target.checked; applyVolumes(); persist(); }); $('cShake').addEventListener('change', e => { S.shake = e.target.checked; persist(); });
$('cLow').addEventListener('change', e => { S.low = e.target.checked; persist(); renderer.shadowMap.enabled = !S.low; sun.castShadow = !S.low; MAT.land.needsUpdate = true; resize(); toast('Reload the page to fully apply the quality setting.'); });

/* ---------- input ---------- */
const KEY = { KeyW: 'f', KeyS: 'b', KeyA: 'l', KeyD: 'r', ShiftLeft: 'sprint', ShiftRight: 'sprint', KeyQ: 'block', Space: 'roll', KeyJ: 'light', KeyF: 'heavy', KeyK: 'heavy', KeyE: 'use', KeyR: 'heal', ArrowLeft: 'cl', ArrowRight: 'cr', ArrowUp: 'cu', ArrowDown: 'cd' };
let lockLost = 0;
function axes() { const k = inp.keys; if (inp.stick) return; inp.mz = (k.f ? 1 : 0) - (k.b ? 1 : 0); inp.mx = (k.r ? 1 : 0) - (k.l ? 1 : 0); inp.sprint = !!k.sprint; }
addEventListener('keydown', e => {
  audioInit();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.mode === 'play') { if (G.panel === 'sDead' || G.panel === 'sWin') return; if (G.panel) { if (performance.now() - lockLost > 350) closePanel(); } else openPanel('sPause'); } else if (G.panel === 'sHow' || G.panel === 'sSet') openPanel('sTitle'); e.preventDefault(); return; }
  if (G.mode !== 'play') return;
  if (e.code === 'Tab' || e.code === 'KeyI') { e.preventDefault(); if (G.panel === 'sInv') closePanel(); else if (!G.panel) { renderInv(); openPanel('sInv'); } return; }
  if (e.code === 'KeyM') { if (G.panel === 'sMap') closePanel(); else if (!G.panel) { renderMap(); openPanel('sMap'); } return; }
  const a = KEY[e.code]; if (!a || G.panel) return; e.preventDefault(); if (e.repeat) return;
  if (a === 'block') { inp.block = true; } else if (a === 'use') { if (G.nearest && P.alive && P.state === 'idle') doInteract(G.nearest); } else if (a === 'roll' || a === 'light' || a === 'heavy' || a === 'heal') press(a); else { inp.keys[a] = true; axes(); }
});
addEventListener('keyup', e => { const a = KEY[e.code]; if (!a) return; if (a === 'block') inp.block = false; else { inp.keys[a] = false; axes(); } });
const look = (dx, dy, k = 1) => { G.camYaw -= dx * .0026 * S.sens * k; G.camPitch = clamp(G.camPitch + dy * .002 * S.sens * k, -.25, 1.15); };
let dragging = false;
cv.addEventListener('mousedown', e => { audioInit(); if (G.mode !== 'play' || G.panel) return; if (document.pointerLockElement !== cv && cv.requestPointerLock) { try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => { }); } catch (er) { /* ignore */ } } dragging = true; if (e.button === 0) press('light'); else if (e.button === 2) inp.block = true; });
addEventListener('mouseup', e => { dragging = false; if (e.button === 2) inp.block = false; });
addEventListener('mousemove', e => { if (G.mode !== 'play' || G.panel) return; if (document.pointerLockElement === cv || dragging) look(e.movementX || 0, e.movementY || 0); });
cv.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== cv && G.mode === 'play' && !G.panel && P.alive) { lockLost = performance.now(); openPanel('sPause'); } });
addEventListener('touchstart', () => { if (!isTouch()) { document.body.classList.add('touch'); if (G.mode === 'play') $('touch').classList.remove('hidden'); } }, { passive: true });
if (window.matchMedia && matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
{ // touch stick + look
  const zone = $('stickZone'), knob = $('stickKnob'), base = $('stickBase'); let sid = null, sx = 0, sy = 0, lid = null, lx = 0, ly = 0;
  zone.addEventListener('pointerdown', e => { audioInit(); sid = e.pointerId; sx = e.clientX; sy = e.clientY; inp.stick = true; base.style.left = sx - 55 + 'px'; base.style.top = sy - 55 + 'px'; base.style.display = 'block'; try { zone.setPointerCapture(sid); } catch (er) { /* ignore */ } e.preventDefault(); });
  zone.addEventListener('pointermove', e => { if (e.pointerId !== sid) return; let dx = e.clientX - sx, dy = e.clientY - sy; const d = Math.hypot(dx, dy), m = 48; if (d > m) { dx *= m / d; dy *= m / d; } knob.style.transform = `translate(${dx}px,${dy}px)`; inp.mx = dx / m; inp.mz = -dy / m; inp.sprint = d > m * 1.05; });
  const end = e => { if (e.pointerId !== sid) return; sid = null; inp.stick = false; inp.mx = inp.mz = 0; inp.sprint = false; base.style.display = 'none'; knob.style.transform = ''; };
  zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; });
  cv.addEventListener('pointermove', e => { if (e.pointerId !== lid) return; look(e.clientX - lx, e.clientY - ly, 2.2); lx = e.clientX; ly = e.clientY; });
  cv.addEventListener('pointerup', e => { if (e.pointerId === lid) lid = null; }); cv.addEventListener('pointercancel', e => { if (e.pointerId === lid) lid = null; });
  document.querySelectorAll('.tb').forEach(b => { const a = b.dataset.act; const dn = e => { e.preventDefault(); audioInit(); b.classList.add('on'); if (a === 'block') inp.block = true; else if (a === 'use') { if (G.nearest && P.alive && P.state === 'idle') doInteract(G.nearest); } else press(a); }; const up = e => { e.preventDefault(); b.classList.remove('on'); if (a === 'block') inp.block = false; }; b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up); });
}
addEventListener('blur', () => { inp.keys = {}; inp.mx = inp.mz = 0; inp.block = false; if (G.mode === 'play' && !G.panel && P.alive) openPanel('sPause'); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play' && !G.panel && P.alive) openPanel('sPause'); });
addEventListener('resize', resize);

/* ================= Loop ================= */
const STEP = 1 / 60; let acc = 0, last = 0, ambT = 3;
const DBG = window.__marches = { G, P, inp, enemies, store, speed: 1, H, startGame, CHESTS, CAMPS, KEEP, scene, camera, FIRES, SHRINES, interact, hitPlayer, buildPlayerModel };
function step(dt) {
  G.time += dt; G.tod = (G.tod + dt / 620) % 1; const ox = P.pos.x, oz = P.pos.z;
  if (inp.keys.cl) G.camYaw += 2.2 * dt; if (inp.keys.cr) G.camYaw -= 2.2 * dt; if (inp.keys.cu) G.camPitch = clamp(G.camPitch + dt, -.25, 1.15); if (inp.keys.cd) G.camPitch = clamp(G.camPitch - dt, -.25, 1.15);
  updatePlayer(dt); P.vx = (P.pos.x - ox) / dt; P.vz = (P.pos.z - oz) / dt;
  attackers = 0; let fight = false; for (const e of enemies) if (!e.dead && (e.state === 'wind' || e.state === 'strike') && !e.K.ranged) attackers++;
  for (const e of enemies) { updateEnemy(e, dt); if (!e.dead && e.active && e.state !== 'idle' && e.state !== 'return') fight = true; }
  updateArrows(dt); updateParticles(dt); findNearest();
  for (const c of chests) if (c.open && c.lid.rotation.x > -1.9) c.lid.rotation.x = Math.max(-1.9, c.lid.rotation.x - dt * 4);
  G.combatT = fight ? 3 : G.combatT - dt; MUS.mode = G.combatT > 0 ? 'battle' : 'menu';
  G.saveT += dt; if (G.saveT > 30 && !fight) { G.saveT = 0; saveGame(); }
  if (slashT > 0) { slashT -= dt; slashFx.material.opacity = Math.max(0, slashT / .16) * .8; }
  updateHints(dt); if (DBG.onStep) DBG.onStep(dt);
}
const camT = new T.Vector3();
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts; G.real += dt; musicTick();
  const playing = G.mode === 'play' && !G.panel;
  if (playing) { if (G.hitstop > 0) G.hitstop -= dt; else { acc += dt * DBG.speed; let n = 0; while (acc >= STEP && n < 5 * DBG.speed) { step(STEP); acc -= STEP; n++; } if (acc > STEP) acc = 0; } G.shake = Math.max(0, G.shake - dt * 3.2); if (G.hurt > 0) G.hurt -= dt * 1.5; if (G.flash > 0) G.flash -= dt * 4; }
  let cx, cz;
  if (G.mode === 'title') { const a = G.real * .06; cx = 0; cz = 0; camera.position.set(Math.sin(a) * 26, H(0, 0) + 9, Math.cos(a) * 26); camera.lookAt(0, H(0, 0) + 2, 0); G.tod = .3 + (G.real * .004) % .4; }
  else {
    cx = P.pos.x; cz = P.pos.z; const dist = (innerHeight > innerWidth ? 7.6 : 6.4), cp = Math.cos(G.camPitch), sh = S.shake ? G.shake : 0;
    camT.set(cx, P.pos.y + 1.6, cz); let px = cx - Math.sin(G.camYaw) * cp * dist, pz = cz - Math.cos(G.camYaw) * cp * dist, py = camT.y + Math.sin(G.camPitch) * dist; const gh = Math.max(H(px, pz), 0) + .5; if (py < gh) py = gh;
    camera.position.set(px + (Math.random() - .5) * sh * .5, py + (Math.random() - .5) * sh * .4, pz + (Math.random() - .5) * sh * .5); camera.lookAt(camT);
  }
  G.night = updateSky(G.tod, cx, cz); updateGrass(cx, cz); water.position.set(cx, Math.sin(G.real * .6) * .04, cz);
  let nf = fires[0], nd = 1e9; for (const f of fires) { const d = (f.x - cx) * (f.x - cx) + (f.z - cz) * (f.z - cz); if (d < nd) { nd = d; nf = f; } f.fl.forEach((s, k) => { const fl = 1 + Math.sin(G.real * (9 + k * 4) + f.x) * .16; s.scale.set((1.3 - k * .3) * fl, (1.8 - k * .4) * fl, 1); }); }
  fireLight.position.set(nf.x, nf.y + 1.2, nf.z); fireLight.intensity = 1.2 + Math.sin(G.real * 11) * .2 + G.night * .8; lantern.position.set(cx, (G.mode === 'title' ? H(0, 0) : P.pos.y) + 2.2, cz);
  if (Math.random() < dt * 14 && nd < 2500) spawnP(nf.x + rand(-.2, .2), nf.y + .6, nf.z + rand(-.2, .2), rand(-.3, .3), rand(1, 2.4), rand(-.3, .3), rand(.5, 1.1), SPARK, -1);
  if (G.mode === 'title') updateParticles(dt);
  if (AU.ctx && G.mode === 'play') { ambT -= dt; if (ambT <= 0) { ambT = rand(2.5, 7); if (G.night > .6) SFX.cricket(); else SFX.bird(); } AU.windG.gain.value = .03 + (P.sprint ? .03 : 0); }
  for (const r of shrineRunes) if (r.visible) r.material.opacity = .6 + Math.sin(G.real * 2) * .3;
  renderer.render(scene, camera); updateFloats(playing ? dt : 0); updateHud();
}
resize(); spawnAll(); toTitle(); requestAnimationFrame(frame);
})();
