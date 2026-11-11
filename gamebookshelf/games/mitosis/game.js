/* MITOSIS — an online cell arena. Eat, grow, split, and don't get eaten.
   Plain canvas 2D. The arena simulation (makeSim) runs on the host's browser (or locally in solo);
   other players get a compact view string ~8 times a second and predict their own cells for snappy controls. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const NET = window.MXNet;

// ---------------- tuning ----------------
const WORLD = 6000, NP = 1000, NB = 140, NS = NP + NB, MAXC = 16, START_M = 10, SPLIT_MIN = 36, EJECT_MIN = 35, EJ_LOSS = 16, EJ_M = 12,
  VIR_M = 100, POP_M = 133, VIR_MIN = 12, VIR_MAX = 20, ARENA = 24, DT = 1 / 40, SEND = 0.125, GEN = 1296, MAXM = 10000, MAXT = 60000;
const TEAMC = ['#ff5c6c', '#4da3ff', '#5ee68a'], TEAMN = ['Red', 'Blue', 'Green'], R0 = 4300, R1 = 420;
const MODES = { ffa: ['Free-for-all', 'Everyone for themselves. Get as big as you can.'], teams: ['Teams', 'Red, Blue and Green. Teammates can’t eat each other. Feed them with W.'], royale: ['Battle Royale', 'Everyone starts tiny. The dish shrinks. Last cell alive wins the round.'] };
const ringR = tau => tau < 25 ? R0 : tau < 205 ? R1 + (R0 - R1) * Math.pow(1 - (tau - 25) / 180, 1.35) : R1;
const rOf = m => 10 * Math.sqrt(m), spdOf = m => 640 * Math.pow(m, -0.35);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, TAU = Math.PI * 2;
const b36 = n => Math.round(n).toString(36), p36 = s => parseInt(s, 36) || 0;
const clean = s => String(s || '').replace(/[|;.~]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 15);
function hash(a, b, c, d) { let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177) + Math.imul(d | 0, 951274213)) | 0; x = Math.imul(x ^ (x >>> 13), 1274126177); x = Math.imul(x ^ (x >>> 16), 2246822519); return ((x ^ (x >>> 15)) >>> 0) / 4294967296; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// where pellet slot i sits at generation g (same maths on host and clients, so pellets never need to be sent)
function pelletPos(seed, i, g, bloom, out) {
  if (i < NP) { out.x = 40 + hash(seed, i, g, 1) * (WORLD - 80); out.y = 40 + hash(seed, i, g, 2) * (WORLD - 80); out.c = (hash(seed, i, g, 3) * 8) | 0; out.on = 1; return out; }
  if (!bloom) { out.on = 0; return out; }
  const a = hash(seed, i, g + bloom.id * 7, 4) * TAU, d = Math.sqrt(hash(seed, i, g + bloom.id * 7, 5)) * 560;
  out.x = clamp(bloom.x + Math.cos(a) * d, 30, WORLD - 30); out.y = clamp(bloom.y + Math.sin(a) * d, 30, WORLD - 30); out.c = 8; out.on = 1; return out;
}

// ---------------- skins ----------------
const SKINS = [
  ['Amoeba', '#5ee6c8', '#1b9e8a', 'none'], ['Ember', '#ff8a5c', '#c4442a', 'dots'], ['Glacier', '#7cc8ff', '#2f6fd1', 'rings'], ['Chlorella', '#9be86a', '#3f9a2e', 'cells'],
  ['Plasma', '#c48bff', '#6a3ad1', 'spiral'], ['Saffron', '#ffd166', '#d18b1f', 'stripes'], ['Coral', '#ff7aa8', '#c23a6a', 'hex'], ['Abyss', '#4b6cff', '#1a2a8a', 'noise'],
  ['Bloodline', '#ff5c5c', '#9a1f2e', 'cells'], ['Tide', '#3fd8ff', '#0d7fa6', 'stripes'], ['Moss', '#b5c95a', '#5a6e1f', 'noise'], ['Nebula', '#ff9bf2', '#5b2ab3', 'dots'],
  ['Basalt', '#9aa7b8', '#3a4556', 'hex'], ['Solar', '#ffb34d', '#ff5a1f', 'rings'], ['Venom', '#d5ff4d', '#4a8a00', 'spiral'], ['Orchid', '#e0a3ff', '#9a3fd1', 'cells'],
  ['Pearl', '#f2f6ff', '#9fb2d6', 'rings'], ['Magma', '#ff6a2a', '#5a0f0f', 'noise'], ['Aurora', '#5effa8', '#5b4bff', 'stripes'], ['Onyx', '#3a3f4b', '#0b0d12', 'hex'],
  ['Biolume', '#4dfff0', '#0a3a5a', 'spiral'], ['Royal', '#ffd700', '#6a1fa6', 'dots'], ['Prism', '#ff6ad5', '#3fd8ff', 'stripes'], ['Void', '#1b1030', '#000000', 'noise']
];
const skinCache = [];
function skinArt(i) {
  if (skinCache[i]) return skinCache[i];
  const [, c1, c2, pat] = SKINS[i % SKINS.length], S = 256, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), R = rng(i * 977 + 13);
  g.globalAlpha = .22; g.fillStyle = g.strokeStyle = c2;
  if (pat === 'dots') for (let k = 0; k < 46; k++) { g.beginPath(); g.arc(R() * S, R() * S, 4 + R() * 12, 0, TAU); g.fill(); }
  else if (pat === 'rings') { g.lineWidth = 9; for (let r = 18; r < 190; r += 26) { g.beginPath(); g.arc(S / 2, S / 2, r, 0, TAU); g.stroke(); } }
  else if (pat === 'stripes') { g.lineWidth = 16; for (let x = -S; x < S * 2; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + S, S); g.stroke(); } }
  else if (pat === 'spiral') { g.lineWidth = 10; g.beginPath(); for (let a = 0; a < 26; a += .08) { const r = a * 4.8; g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r); } g.stroke(); }
  else if (pat === 'hex') { g.lineWidth = 4; const s = 22; for (let y = 0; y < S + s; y += s * 1.5) for (let x = 0; x < S + s; x += s * 1.732) { const ox = x + ((y / (s * 1.5)) & 1 ? s * .866 : 0); g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU + Math.PI / 6; g.lineTo(ox + Math.cos(a) * s * .9, y + Math.sin(a) * s * .9); } g.closePath(); g.stroke(); } }
  else if (pat === 'cells') { g.lineWidth = 5; for (let k = 0; k < 18; k++) { g.beginPath(); g.ellipse(R() * S, R() * S, 14 + R() * 24, 10 + R() * 18, R() * 3, 0, TAU); g.stroke(); } }
  else if (pat === 'noise') { for (let k = 0; k < 900; k++) { g.globalAlpha = R() * .25; g.fillRect(R() * S, R() * S, 3 + R() * 6, 3 + R() * 6); } }
  g.globalAlpha = 1;
  return (skinCache[i] = c);
}
const skinCount = () => SKINS.length;

// ---------------- save ----------------
const DEF = { name: '', skin: 0, xp: 0, set: { vol: .8, mus: .55, sfx: .85, mute: 0, shake: 1, q: 1, mass: 1 }, rec: { mass: 0, cells: 0, life: 0, top: 0, games: 0 }, mis: { day: '', list: [] }, help: 0 };
let save = JSON.parse(JSON.stringify(DEF));
try { const v = JSON.parse(localStorage.getItem('mx-save') || 'null'); if (v) save = Object.assign(save, v, { set: Object.assign({}, DEF.set, v.set), rec: Object.assign({}, DEF.rec, v.rec), mis: Object.assign({}, DEF.mis, v.mis) }); } catch (e) { }
const store = () => { try { localStorage.setItem('mx-save', JSON.stringify(save)); } catch (e) { } };
const lvlNeed = L => Math.round(110 * Math.pow(L - 1, 1.55)); // total XP needed to be level L
const levelOf = xp => { let L = 1; while (L < 40 && xp >= lvlNeed(L + 1)) L++; return L; };
const skinLevel = i => i === 0 ? 1 : i + 1;

// ---------------- missions (3 a day) ----------------
const MPOOL = [
  ['pel', 250, 'Eat 250 pellets', 120], ['pel', 600, 'Eat 600 pellets', 220], ['cells', 4, 'Eat 4 cells', 140], ['cells', 12, 'Eat 12 cells', 260],
  ['mass', 400, 'Reach 400 mass in one life', 160], ['mass', 1200, 'Reach 1,200 mass in one life', 300], ['splitK', 2, 'Catch 2 cells with a split', 220],
  ['vshots', 1, 'Shoot a virus by feeding it 7 blobs', 200], ['life', 300, 'Stay alive 5 minutes in one life', 180], ['rank', 3, 'Reach the top 3', 220], ['rank', 1, 'Reach #1 on the leaderboard', 320], ['kills', 2, 'Wipe out 2 rivals completely', 240]
];
function todayKey() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
function rollMissions() {
  const k = todayKey(); if (save.mis.day === k && save.mis.list.length) return;
  const R = rng([...k].reduce((a, c) => a * 31 + c.charCodeAt(0), 7)), used = new Set(), list = [];
  while (list.length < 3) { const i = (R() * MPOOL.length) | 0, t = MPOOL[i][0]; if (used.has(t)) continue; used.add(t); list.push({ i, p: 0, done: 0 }); }
  save.mis = { day: k, list }; store();
}
rollMissions();

// ---------------- audio (all generated) ----------------
const AU = {
  c: null, m: null, mu: null, fx: null, last: {}, step: 0, nextT: 0, chord: 0, energy: 0,
  init() {
    if (this.c) { if (this.c.state === 'suspended') this.c.resume(); return; }
    try { this.c = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.c; this.m = c.createGain(); this.m.connect(c.destination); this.mu = c.createGain(); this.fx = c.createGain();
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; this.fx.connect(comp); comp.connect(this.m);
    const rv = c.createConvolver(), len = c.sampleRate * 2.6, buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.4); }
    rv.buffer = buf; this.rv = c.createGain(); this.rv.gain.value = .32; this.rv.connect(rv); rv.connect(this.m); this.mu.connect(this.m); this.mu.connect(this.rv);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.apply(); this.nextT = c.currentTime + .1;
    setInterval(() => this.music(), 100);
  },
  apply() { if (!this.c) return; const s = save.set; this.m.gain.value = s.mute ? 0 : s.vol; this.mu.gain.value = s.mus * .5; this.fx.gain.value = s.sfx; },
  ok(k, gap) { const t = performance.now(); if (this.last[k] && t - this.last[k] < gap) return false; this.last[k] = t; return !!this.c && !save.set.mute; },
  tone(f, d, type, v, f2, at, dest) { const c = this.c, t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .008); g.gain.exponentialRampToValueAtTime(.0008, t + d); o.connect(g); g.connect(dest || this.fx); o.start(t); o.stop(t + d + .05); },
  hiss(d, f1, f2, v, q, at) { const c = this.c, t = c.currentTime + (at || 0), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; fl.type = 'bandpass'; fl.Q.value = q || 1.2; fl.frequency.setValueAtTime(f1, t); fl.frequency.exponentialRampToValueAtTime(f2, t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0008, t + d); s.connect(fl); fl.connect(g); g.connect(this.fx); s.start(t); s.stop(t + d + .05); },
  pellet(n) { if (!this.ok('p', 55)) return; const f = 520 * Math.pow(2, ((n % 12) * 2) / 12); this.tone(f, .09, 'sine', .07, f * 1.5); },
  gulp(big) { if (!this.ok('g', 70)) return; const s = clamp(big, 0, 1); this.tone(220 - s * 120, .28 + s * .2, 'sine', .35, 55); this.hiss(.22, 900, 160, .25 + s * .2, 2); this.tone(660, .12, 'triangle', .08, 990, .04); },
  split() { if (!this.ok('s', 60)) return; this.hiss(.25, 300, 2600, .28, 1.6); this.tone(330, .16, 'triangle', .12, 660); },
  eject() { if (!this.ok('e', 90)) return; this.hiss(.12, 1800, 500, .16, 2.5); this.tone(240, .08, 'sine', .1, 160); },
  merge() { if (!this.ok('m', 200)) return; this.tone(392, .3, 'sine', .12, 523); this.tone(523, .4, 'sine', .08, 784, .08); },
  pop() { if (!this.ok('v', 150)) return; this.hiss(.5, 2400, 120, .55, .8); this.tone(160, .5, 'sawtooth', .18, 40); this.tone(90, .7, 'sine', .4, 30); },
  death() { if (!this.c) return; this.tone(330, 1.1, 'triangle', .22, 82); this.tone(247, 1.3, 'sine', .2, 62, .1); this.hiss(.9, 1400, 90, .3, .7); },
  level() { if (!this.c) return; [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .5, 'triangle', .13, 0, i * .09)); },
  bloom() { if (!this.c) return; [392, 494, 587, 740].forEach((f, i) => this.tone(f, 1.1, 'sine', .1, 0, i * .14)); },
  click() { if (this.ok('c', 40)) this.tone(880, .05, 'square', .04, 660); },
  danger() { if (this.ok('d', 1400)) { this.tone(110, .5, 'sawtooth', .07, 104); } },
  music() {
    const c = this.c; if (!c) return;
    const BEAT = 60 / 84 / 2, CH = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]];
    while (this.nextT < c.currentTime + .35) {
      const t = this.nextT, st = this.step, ch = CH[this.chord], mf = n => 440 * Math.pow(2, (n - 69) / 12);
      if (st % 32 === 0) { // pad + bass on each chord
        ch.forEach((n, k) => { const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(); o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = mf(n - 12); o2.frequency.value = mf(n - 12) * 1.004; f.type = 'lowpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(900 + this.energy * 900, t + 3); f.frequency.linearRampToValueAtTime(420, t + BEAT * 32); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.045, t + 1.2); g.gain.linearRampToValueAtTime(0, t + BEAT * 32 + .3); o.connect(f); o2.connect(f); f.connect(g); g.connect(this.mu); o.start(t); o2.start(t); o.stop(t + BEAT * 32 + .5); o2.stop(t + BEAT * 32 + .5); });
        const b = c.createOscillator(), bg = c.createGain(); b.type = 'sine'; b.frequency.value = mf(ch[0] - 24); bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(.16, t + .3); bg.gain.linearRampToValueAtTime(0, t + BEAT * 32); b.connect(bg); bg.connect(this.mu); b.start(t); b.stop(t + BEAT * 32 + .1);
      }
      const dens = .28 + this.energy * .5;
      if (st % 2 === 0 && Math.random() < dens) { const n = ch[(Math.random() * 4) | 0] + (Math.random() < .5 ? 12 : 0), o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = mf(n); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05, t + .01); g.gain.exponentialRampToValueAtTime(.0008, t + .7); o.connect(g); g.connect(this.mu); o.start(t); o.stop(t + .8); }
      if (this.energy > .45 && st % 4 === 2) { const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(.025 * this.energy, t); g.gain.exponentialRampToValueAtTime(.0008, t + .05); s.connect(f); f.connect(g); g.connect(this.mu); s.start(t); s.stop(t + .08); }
      this.nextT += BEAT; this.step++; if (this.step % 32 === 0) this.chord = (this.chord + 1) % 4;
    }
  }
};

// ---------------- bots ----------------
const BOTN = ['Nucleus', 'quietgiant', 'Mitochondria', 'zeph', 'plankton_king', 'Lysosome', 'driftwood', 'ok_boomer', 'Ribo', 'kraken', 'tinyterror', 'ProtoZoe', 'blobfish', 'spore', 'Vacuole', 'HexaGone', 'SirSplitsAlot', 'cytoplasm', 'nomnom', 'paramecium', 'Big Mike', 'neon', 'flagellum', 'krill', 'Osmosis', 'Hydra', 'gobbler', 'Mika', 'Jules', 'R2', 'Tardigrade', 'eukaryote', 'leviathan', 'Diatom', 'phage', 'Oreo', 'Kai', 'Ezra', 'Bubbles', 'no u', 'Rotifer', 'Pip', 'Golgi', 'mxl', 'theo', 'Vex', 'Wren', 'Juno', 'Sable', 'Pax'];

// =====================================================================================
//  ARENA SIMULATION (host / solo / title-screen attract mode)
// =====================================================================================
function makeSim(seed, opts) {
  opts = opts || {};
  const R = rng(seed ^ 0x5bd1e995);
  const S = { mode: opts.mode || 'ffa', rd: null, teamM: [0, 0, 0], seed, t: 0, owners: [], cells: [], ej: [], vir: [], pg: new Uint16Array(NS), px: new Float32Array(NS), py: new Float32Array(NS), pc: new Uint8Array(NS), nid: 1, bloom: null, bloomNext: 50 + R() * 25, bloomN: 0, pd: [], fx: [], feed: [], lb: [], lbT: 0, sendT: 0, pfT: 0 };
  const PB = 200, PG = Math.ceil(WORLD / PB), buck = Array.from({ length: PG * PG }, () => []), bi = new Int32Array(NS).fill(-1), tmp = {};
  const bkey = (x, y) => clamp((y / PB) | 0, 0, PG - 1) * PG + clamp((x / PB) | 0, 0, PG - 1);
  function unbucket(i) { if (bi[i] < 0) return; const b = buck[bi[i]], k = b.indexOf(i); if (k >= 0) { b[k] = b[b.length - 1]; b.pop(); } bi[i] = -1; }
  function place(i) { unbucket(i); pelletPos(seed, i, S.pg[i], S.bloom, tmp); if (!tmp.on) return; S.px[i] = tmp.x; S.py[i] = tmp.y; S.pc[i] = tmp.c; const k = bkey(tmp.x, tmp.y); buck[k].push(i); bi[i] = k; }
  for (let i = 0; i < NP; i++) { S.pg[i] = (R() * GEN) | 0; place(i); }
  S.pelletOn = i => bi[i] >= 0;
  S.pfString = () => { let s = ''; for (let i = 0; i < NS; i++) s += S.pg[i].toString(36).padStart(2, '0'); return s; };

  const CG = 320, CGN = Math.ceil(WORLD / CG), cb = Array.from({ length: CGN * CGN }, () => []);
  let stamp = 1;
  function mkCell(o, x, y, m) { const c = { id: S.nid++, o: o.i, x, y, px: x, py: y, vx: 0, vy: 0, m, r: rOf(m), mergeAt: S.t + 10 + m * .02, noColl: 0, splitT: -9, dead: false, eatT: 0 }; S.cells.push(c); o.cells.push(c); return c; }
  function addVirus(x, y, vx, vy) { if (S.vir.length >= VIR_MAX) return; S.vir.push({ id: S.nid++, x, y, vx: vx || 0, vy: vy || 0, m: VIR_M, r: rOf(VIR_M), feed: 0 }); }
  function freeSpot(rad) {
    let best = null, bs = -1;
    for (let k = 0; k < 24; k++) {
      const x = 200 + R() * (WORLD - 400), y = 200 + R() * (WORLD - 400); let sc = 1e9;
      for (const c of S.cells) { if (c.m < 25) continue; const d = Math.hypot(c.x - x, c.y - y) - c.r * 1.5 - rad; if (d < sc) sc = d; }
      for (const v of S.vir) { const d = Math.hypot(v.x - x, v.y - y) - v.r - rad - 40; if (d < sc) sc = d; }
      if (sc > bs) { bs = sc; best = { x, y }; } if (sc > 700) break;
    }
    return best;
  }
  for (let k = 0; k < VIR_MIN + 3; k++) { const p = freeSpot(120); addVirus(p.x, p.y); }

  function addOwner(name, skin, bot, uid) {
    const o = { i: S.owners.length, uid: uid || '', name: clean(name) || 'cell', skin: skin | 0, bot: !!bot, cells: [], dead: true, respawnAt: 0, retire: false, gone: false,
      inp: { tx: WORLD / 2, ty: WORLD / 2, split: 0, ej: 0, rs: 0, hw: 1200, hh: 800 }, lastSplit: 0, lastRs: 0, ejT: 0, ev: [], st: null, cx: WORLD / 2, cy: WORLD / 2, total: 0, rank: 0, feedT: 0, killer: '',
      ai: bot ? { skill: .35 + R() * .65, think: R() * .2, tx: R() * WORLD, ty: R() * WORLD, wander: 0, aggro: .4 + R() * .6 } : null };
    // reuse a free slot so owner numbers stay small
    o.team = -1;
    if (S.mode === 'teams') { const n = [0, 0, 0]; for (const x of S.owners) if (!x.gone && x.team >= 0) n[x.team] += x.bot ? 1 : 1.5; o.team = n.indexOf(Math.min(...n)); }
    const free = S.owners.findIndex(x => x.gone);
    if (free >= 0) { o.i = free; S.owners[free] = o; } else S.owners.push(o);
    S.rosterDirty = true;
    return o;
  }
  function resetStats(o) { o.st = { pel: 0, cells: 0, kills: 0, splitK: 0, vshots: 0, maxM: 0, born: S.t, best: 99 }; }
  function spawn(o, carry, at) {
    const m = clamp(carry || START_M, START_M, 4000), p = at && at.x ? { x: clamp(at.x, 100, WORLD - 100), y: clamp(at.y, 100, WORLD - 100) } : freeSpot(rOf(m));
    o.cells.length = 0; o.dead = false; o.killer = ''; resetStats(o);
    if (m > 400) { const n = Math.min(4, Math.ceil(m / 400)); for (let k = 0; k < n; k++) mkCell(o, p.x + Math.cos(k / n * TAU) * 60, p.y + Math.sin(k / n * TAU) * 60, m / n); }
    else mkCell(o, p.x, p.y, m);
    o.cx = p.x; o.cy = p.y; o.inp.tx = p.x; o.inp.ty = p.y;
    if (o.ai) { o.ai.tx = p.x; o.ai.ty = p.y; }
  }
  function botFill() {
    const humans = S.owners.filter(o => !o.gone && !o.bot).length, bots = S.owners.filter(o => !o.gone && o.bot && !o.retire), want = Math.max(opts.minBots || 6, ARENA - humans);
    if (bots.length < want) for (let k = bots.length; k < want; k++) { const used = new Set(S.owners.filter(x => !x.gone).map(x => x.name)), free = BOTN.filter(n => !used.has(n)), o = addOwner(free.length ? free[(R() * free.length) | 0] : BOTN[(R() * BOTN.length) | 0], (R() * SKINS.length) | 0, true); o.respawnAt = S.t + R() * 1.5; o.initM = opts.attract || S.t < 2 ? START_M + Math.pow(R(), 2.2) * 260 : 0; }
    else if (bots.length > want) { bots.sort((a, b) => a.total - b.total); for (let k = 0; k < bots.length - want; k++) bots[k].retire = true; }
  }
  function addHuman(uid, name, skin, carry) {
    let o = S.owners.find(x => !x.gone && x.uid === uid);
    if (!o) o = addOwner(name, skin, false, uid);
    else { o.name = clean(name) || o.name; o.skin = skin | 0; S.rosterDirty = true; }
    if (carry !== undefined && !(S.mode === 'royale' && !canJoin())) spawn(o, carry && carry.m, carry); botFill(); return o;
  }
  function removeHuman(uid) { const o = S.owners.find(x => !x.gone && x.uid === uid); if (!o) return; killOwnerCells(o); o.gone = true; S.rosterDirty = true; botFill(); }
  function killOwnerCells(o) { for (const c of o.cells) c.dead = true; o.cells.length = 0; }
  function feedLine(s) { S.feed.push({ t: S.t, s }); if (S.feed.length > 30) S.feed.shift(); }

  const canJoin = () => !S.rd || (S.rd.ph === 'live' && S.t - S.rd.t0 < 25);
  const mate = (a, b) => S.mode === 'teams' && a !== b && S.owners[a] && S.owners[b] && S.owners[a].team === S.owners[b].team;
  function startRound() {
    S.rd = { ph: 'live', t0: S.t, cx: WORLD / 2 + (R() - .5) * 1400, cy: WORLD / 2 + (R() - .5) * 1400, r: R0, winner: '', endT: 0 };
    S.ej.length = 0;
    for (const o of S.owners) { if (o.gone) continue; killOwnerCells(o); o.dead = true; }
    S.cells = S.cells.filter(c => !c.dead);
    for (const o of S.owners) {
      if (o.gone) continue; if (o.retire) { o.gone = true; S.rosterDirty = true; continue; }
      const a = R() * TAU, d = Math.sqrt(R()) * R0 * .62; spawn(o, START_M, { x: S.rd.cx + Math.cos(a) * d, y: S.rd.cy + Math.sin(a) * d }); o.lastRs = o.inp.rs; o.ev.push('N');
    }
  }
  S.modeInfo = () => {
    if (S.mode === 'teams') return { mode: 'teams', tm: S.teamM.map(Math.round) };
    if (S.mode === 'royale' && S.rd) { const rd = S.rd, tau = S.t - rd.t0; return { mode: 'royale', ph: rd.ph === 'live' ? 1 : 2, cx: rd.cx, cy: rd.cy, r: rd.r, left: rd.ph === 'live' ? (tau < 25 ? 25 - tau : tau < 205 ? 205 - tau : Math.max(0, 260 - tau)) : Math.max(0, rd.endT - S.t), closing: tau >= 25 && tau < 205 ? 1 : tau >= 205 ? 2 : 0, alive: S.alive || 0, winner: rd.winner, join: canJoin() ? 1 : 0 }; }
    return { mode: 'ffa' };
  };
  function splitOwner(o, tx, ty) {
    const list = o.cells.slice().sort((a, b) => b.m - a.m); let n = o.cells.length, did = 0;
    for (const c of list) {
      if (n >= MAXC) break; if (c.m < SPLIT_MIN) continue;
      let dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy); if (d < 1) { dx = 1; dy = 0; d = 1; }
      const h = c.m / 2; c.m = h; c.r = rOf(h); c.mergeAt = S.t + 10 + h * .02;
      const nc = mkCell(o, c.x + dx / d * c.r * .5, c.y + dy / d * c.r * .5, h); const sp = 700 + 160 * Math.min(1, 60 / Math.sqrt(h));
      nc.vx = dx / d * sp; nc.vy = dy / d * sp; nc.noColl = S.t + .5; nc.splitT = S.t; c.splitT = S.t; n++; did++;
    }
    return did;
  }
  function ejectOwner(o, tx, ty) {
    let did = 0;
    for (const c of o.cells) {
      if (c.m < EJECT_MIN) continue;
      let dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy); if (d < 1) { dx = 1; dy = 0; d = 1; }
      c.m -= EJ_LOSS; c.r = rOf(c.m); const a = Math.atan2(dy, dx) + (R() - .5) * .25, er = rOf(EJ_M);
      S.ej.push({ id: S.nid++, x: c.x + Math.cos(a) * (c.r + er * .4), y: c.y + Math.sin(a) * (c.r + er * .4), vx: Math.cos(a) * 820, vy: Math.sin(a) * 820, m: EJ_M, r: er, o: o.i, sk: o.skin, t: S.t, dead: false });
      did++;
    }
    return did;
  }
  function popCell(c, v) {
    const o = S.owners[c.o]; c.m += v.m * .6; let room = MAXC - o.cells.length; if (room <= 0) { c.r = rOf(c.m); return; }
    const n = Math.min(room, 6 + Math.floor(c.m / 220)), piece = Math.min(40, c.m / (n + 2));
    for (let k = 0; k < n; k++) { const a = k / n * TAU + R() * .3, nc = mkCell(o, c.x, c.y, piece), sp = 520 + R() * 260; nc.vx = Math.cos(a) * sp; nc.vy = Math.sin(a) * sp; nc.noColl = S.t + .35; nc.mergeAt = S.t + 12; c.m -= piece; }
    c.r = rOf(c.m); c.mergeAt = S.t + 12 + c.m * .02; o.ev.push('P');
  }

  // ---------------- bot brain ----------------
  function think(o) {
    const ai = o.ai, me = o.cells.reduce((a, c) => (!a || c.m > a.m ? c : a), null); if (!me) return;
    const small = o.cells.reduce((a, c) => (!a || c.m < a.m ? c : a), null), view = me.r * 4 + 700 + ai.skill * 400;
    let fx = 0, fy = 0, threat = 0, prey = null, pv = 0, hideV = null;
    for (const c of S.cells) {
      if (c.dead || c.o === o.i || mate(c.o, o.i)) continue;
      const dx = c.x - me.x, dy = c.y - me.y, d = Math.hypot(dx, dy); if (d > view + c.r) continue;
      if (c.m > small.m * 1.25 && c.m > me.m * .7) {
        const reach = c.r + me.r + (c.m > me.m * 2.6 ? 420 : 140), close = Math.max(1, d - c.r - me.r);
        if (d < reach + 500) { const w = (c.m / me.m) * 380 / (close + 60); fx -= dx / d * w; fy -= dy / d * w; threat = Math.max(threat, w); }
      } else if (me.m >= c.m * 1.25) {
        const val = c.m / (d - me.r + 120) * (.6 + ai.aggro); if (val > pv && c.m > 2.5) { pv = val; prey = c; }
      }
    }
    for (const v of S.vir) {
      const dx = v.x - me.x, dy = v.y - me.y, d = Math.hypot(dx, dy);
      if (me.m >= POP_M && d < v.r + me.r + 160) { const w = 3.2 * (1 - (d - me.r) / (v.r + 160)); fx -= dx / d * w; fy -= dy / d * w; }
      else if (me.m < POP_M * .9 && threat > .8 && (!hideV || d < hideV.d)) hideV = { v, d };
    }
    const m = 380; if (me.x < m) fx += (m - me.x) / m * 2; if (me.x > WORLD - m) fx -= (me.x - WORLD + m) / m * 2; if (me.y < m) fy += (m - me.y) / m * 2; if (me.y > WORLD - m) fy -= (me.y - WORLD + m) / m * 2;
    let tx, ty;
    if (S.rd) { const rd = S.rd, d = Math.hypot(me.x - rd.cx, me.y - rd.cy), safe = Math.min(rd.r, ringR(S.t - rd.t0 + 12)) * .8; if (d > safe) { const w = (d - safe) / 120 + 1; fx += (rd.cx - me.x) / d * w * 3; fy += (rd.cy - me.y) / d * w * 3; threat = Math.max(threat, w); } }
    if (threat > .55 * (1.4 - ai.skill)) {
      if (hideV && ai.skill > .5) { tx = hideV.v.x; ty = hideV.v.y; }
      else { const l = Math.hypot(fx, fy) || 1; tx = me.x + fx / l * 600; ty = me.y + fy / l * 600; }
      if (threat > 3 && me.m > 90 && R() < .04 * ai.skill && o.cells.length < 3) { ejectOwner(o, me.x + fx, me.y + fy); }
    } else if (prey && pv > .02) {
      tx = prey.x + (prey.vx || 0) * .1; ty = prey.y + (prey.vy || 0) * .1;
      const d = Math.hypot(prey.x - me.x, prey.y - me.y) - me.r;
      if (me.m / 2 >= prey.m * 1.3 && d < 330 + me.r * .3 && d > 0 && o.cells.length <= 2 && threat < .2 && R() < .22 * ai.skill * ai.aggro && prey.m > 8) splitOwner(o, tx, ty);
    } else {
      // graze: best pellet patch nearby (blooms are worth a detour)
      let bd = 1e9, bx = ai.tx, by = ai.ty; const rad = 520, x0 = clamp(((me.x - rad) / PB) | 0, 0, PG - 1), x1 = clamp(((me.x + rad) / PB) | 0, 0, PG - 1), y0 = clamp(((me.y - rad) / PB) | 0, 0, PG - 1), y1 = clamp(((me.y + rad) / PB) | 0, 0, PG - 1);
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) for (const i of buck[gy * PG + gx]) { let d = Math.hypot(S.px[i] - me.x, S.py[i] - me.y); if (i >= NP) d *= .5; if (S.rd && Math.hypot(S.px[i] - S.rd.cx, S.py[i] - S.rd.cy) > S.rd.r * .9) continue; if (d < bd) { bd = d; bx = S.px[i]; by = S.py[i]; } }
      if (S.bloom && Math.hypot(S.bloom.x - me.x, S.bloom.y - me.y) < 2200 && ai.skill > .45 && bd > 160) { bx = S.bloom.x; by = S.bloom.y; }
      if (bd > 1e8) { if (S.t > ai.wander) { ai.wander = S.t + 3 + R() * 4; ai.tx = 300 + R() * (WORLD - 600); ai.ty = 300 + R() * (WORLD - 600); } bx = ai.tx; by = ai.ty; }
      const l = Math.hypot(fx, fy); tx = bx + (l > .05 ? fx / l * 200 : 0); ty = by + (l > .05 ? fy / l * 200 : 0);
    }
    // cheap reaction delay: low-skill bots steer lazily
    const k = .35 + ai.skill * .65; o.inp.tx = lerp(o.inp.tx, tx, k); o.inp.ty = lerp(o.inp.ty, ty, k);
  }

  // ---------------- one fixed step ----------------
  function eatCell(big, small) {
    small.dead = true; big.m += small.m; big.r = rOf(big.m); big.eatT = S.t;
    const bo = S.owners[big.o], so = S.owners[small.o];
    if (big.o !== small.o) {
      bo.st.cells++; if (S.t - big.splitT < 1.4) bo.st.splitK++;
      bo.ev.push('E' + b36(small.m));
      if (so && !so.dead && so.cells.every(c => c.dead)) { so.killer = bo.name; bo.st.kills++; bo.ev.push('K' + so.name); feedLine(bo.name + '~' + so.name); }
    } else bo.ev.push('M');
  }
  function step(dt) {
    S.t += dt;
    for (const o of S.owners) {
      if (o.gone) continue;
      if (o.dead) {
        if (o.bot) { if (o.retire) { o.gone = true; S.rosterDirty = true; continue; } if (S.t >= o.respawnAt && canJoin()) { if (S.rd) { const a = R() * TAU, d = Math.sqrt(R()) * S.rd.r * .6; spawn(o, START_M, { x: S.rd.cx + Math.cos(a) * d, y: S.rd.cy + Math.sin(a) * d }); } else spawn(o, o.initM || START_M); o.initM = 0; } }
        else if (o.inp.rs !== o.lastRs && canJoin()) { o.lastRs = o.inp.rs; if (S.rd) { const a = R() * TAU, d = Math.sqrt(R()) * S.rd.r * .6; spawn(o, START_M, { x: S.rd.cx + Math.cos(a) * d, y: S.rd.cy + Math.sin(a) * d }); } else spawn(o, START_M); }
        continue;
      }
      if (o.bot) { o.ai.think -= dt; if (o.ai.think <= 0) { o.ai.think = .12 + (1 - o.ai.skill) * .25; think(o); } }
      else {
        if (o.inp.split !== o.lastSplit) { const n = ((o.inp.split - o.lastSplit) % 8 + 8) % 8; o.lastSplit = o.inp.split; for (let k = 0; k < Math.min(n, 4); k++) if (splitOwner(o, o.inp.tx, o.inp.ty)) o.ev.push('S'); }
        if (o.inp.ej) { o.ejT -= dt; if (o.ejT <= 0) { o.ejT = .09; if (ejectOwner(o, o.inp.tx, o.inp.ty)) o.ev.push('J'); } }
        o.lastRs = o.inp.rs;
      }
    }
    // movement
    for (const c of S.cells) {
      if (c.dead) continue;
      const o = S.owners[c.o]; c.px = c.x; c.py = c.y;
      let dx = o.inp.tx - c.x, dy = o.inp.ty - c.y; const d = Math.hypot(dx, dy) || 1, sp = spdOf(c.m) * Math.min(1, d / (c.r * .5 + 30));
      const k = Math.exp(-dt * 3.4);
      c.x += dx / d * sp * dt + c.vx * dt; c.y += dy / d * sp * dt + c.vy * dt; c.vx *= k; c.vy *= k;
      // remote players steer their own cells on their own screen: follow their reported spot (within reason) so they never feel lag
      const rp = o.inp.pos && S.t - (o.inp.posT || 0) < .6 && o.inp.pos.get(c.id);
      if (rp) { const ex = rp.x - c.x, ey = rp.y - c.y, ed = Math.hypot(ex, ey); if (ed < 220 + c.r) { const f = 1 - Math.exp(-dt * 14); c.x += ex * f; c.y += ey * f; } }
      // the bigger you are, the faster you shrink, so nobody snowballs forever
      if (c.m > 60) c.m -= c.m * (.002 + .007 * Math.min(1, (o.total || 0) / 25000)) * dt;
      if (c.m > MAXM) { if (o.cells.length < MAXC) splitOwner(o, c.x + 1, c.y); if (c.m > MAXM) c.m = MAXM; }
      if (!(c.m > 0) || !isFinite(c.m)) c.m = START_M;
      if (S.rd && Math.hypot(c.x - S.rd.cx, c.y - S.rd.cy) > S.rd.r) { c.m -= (c.m * .09 + 6) * dt; c.hurt = S.t; if (c.m < 3) { c.dead = true; if (o.cells.every(x => x.dead)) o.killer = 'the ring'; } }
      c.r = rOf(c.m); const mg = Math.min(c.r * .65, 420); c.x = clamp(c.x, mg, WORLD - mg); c.y = clamp(c.y, mg, WORLD - mg);
    }
    // grid
    for (const b of cb) b.length = 0;
    for (const c of S.cells) { if (c.dead) continue; const x0 = clamp(((c.x - c.r) / CG) | 0, 0, CGN - 1), x1 = clamp(((c.x + c.r) / CG) | 0, 0, CGN - 1), y0 = clamp(((c.y - c.r) / CG) | 0, 0, CGN - 1), y1 = clamp(((c.y + c.r) / CG) | 0, 0, CGN - 1); for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) cb[y * CGN + x].push(c); }
    // cell vs cell
    for (const a of S.cells) {
      if (a.dead) continue; stamp++;
      const x0 = clamp(((a.x - a.r) / CG) | 0, 0, CGN - 1), x1 = clamp(((a.x + a.r) / CG) | 0, 0, CGN - 1), y0 = clamp(((a.y - a.r) / CG) | 0, 0, CGN - 1), y1 = clamp(((a.y + a.r) / CG) | 0, 0, CGN - 1);
      for (let gy = y0; gy <= y1 && !a.dead; gy++) for (let gx = x0; gx <= x1 && !a.dead; gx++) for (const b of cb[gy * CGN + gx]) {
        if (b === a || b.dead || b._s === stamp || b.id < a.id) continue; b._s = stamp;
        let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || .01, rs = a.r + b.r; if (d >= rs) continue;
        const big = a.m >= b.m ? a : b, sm = big === a ? b : a;
        if (a.o === b.o) {
          if (S.t >= a.mergeAt && S.t >= b.mergeAt) { if (d < big.r - sm.r * .2) eatCell(big, sm); }
          else if (S.t > a.noColl && S.t > b.noColl) { const ov = (rs - d), wa = b.m / (a.m + b.m), wb = 1 - wa, f = Math.min(1, ov / rs) * .5 * ov; dx /= d; dy /= d; a.x -= dx * f * wa * 2; a.y -= dy * f * wa * 2; b.x += dx * f * wb * 2; b.y += dy * f * wb * 2; }
        } else if (mate(a.o, b.o)) { if (S.t > a.noColl && S.t > b.noColl) { const ov = (rs - d), wa = b.m / (a.m + b.m), wb = 1 - wa, f = Math.min(1, ov / rs) * .35 * ov; dx /= d; dy /= d; a.x -= dx * f * wa * 2; a.y -= dy * f * wa * 2; b.x += dx * f * wb * 2; b.y += dy * f * wb * 2; } }
        else if (big.m >= sm.m * 1.25 && d < big.r - sm.r * .4) eatCell(big, sm);
        if (a.dead) break;
      }
    }
    // pellets
    const eaten = [];
    for (const c of S.cells) {
      if (c.dead) continue; const x0 = clamp(((c.x - c.r) / PB) | 0, 0, PG - 1), x1 = clamp(((c.x + c.r) / PB) | 0, 0, PG - 1), y0 = clamp(((c.y - c.r) / PB) | 0, 0, PG - 1), y1 = clamp(((c.y + c.r) / PB) | 0, 0, PG - 1), r2 = c.r * c.r;
      for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) { const b = buck[gy * PG + gx]; for (let k = b.length - 1; k >= 0; k--) { const i = b[k], dx = S.px[i] - c.x, dy = S.py[i] - c.y; if (dx * dx + dy * dy < r2) { eaten.push(i); unbucket(i); c.m += i < NP ? 1 : 3; const o = S.owners[c.o]; o.st.pel++; } } }
      c.r = rOf(c.m);
    }
    for (const i of eaten) { if (S.fx.length < 80) S.fx.push(S.px[i], S.py[i], S.pc[i]); S.pg[i] = (S.pg[i] + 1) % GEN; place(i); S.pd.push(i); }
    // ejected blobs
    for (const e of S.ej) {
      if (e.dead) continue; const k = Math.exp(-dt * 4.2); e.x = clamp(e.x + e.vx * dt, 20, WORLD - 20); e.y = clamp(e.y + e.vy * dt, 20, WORLD - 20); e.vx *= k; e.vy *= k;
      for (const v of S.vir) { if (Math.hypot(v.x - e.x, v.y - e.y) < v.r) { e.dead = true; v.feed++; v.m = VIR_M + v.feed * 6; v.r = rOf(v.m); if (v.feed >= 7) { v.feed = 0; v.m = VIR_M; v.r = rOf(v.m); const l = Math.hypot(e.vx, e.vy) || 1; addVirus(v.x, v.y, e.vx / l * 900, e.vy / l * 900); const eo = S.owners[e.o]; if (eo && eo.st) eo.st.vshots++; } break; } }
      if (e.dead) continue;
      const gx = clamp((e.x / CG) | 0, 0, CGN - 1), gy = clamp((e.y / CG) | 0, 0, CGN - 1);
      for (const c of cb[gy * CGN + gx]) { if (c.dead || c.m < EJ_M * 1.2 || (c.o === e.o && S.t - e.t < .4)) continue; if (Math.hypot(c.x - e.x, c.y - e.y) < c.r - e.r * .3) { e.dead = true; c.m += e.m; c.r = rOf(c.m); break; } }
    }
    if (S.t - (S.ejClean || 0) > 1) { S.ejClean = S.t; S.ej = S.ej.filter(e => !e.dead && S.t - e.t < 40); if (S.ej.length > 220) S.ej.splice(0, S.ej.length - 220); }
    // viruses
    for (const v of S.vir) { if (v.vx || v.vy) { const k = Math.exp(-dt * 2.6); v.x = clamp(v.x + v.vx * dt, 60, WORLD - 60); v.y = clamp(v.y + v.vy * dt, 60, WORLD - 60); v.vx *= k; v.vy *= k; if (Math.abs(v.vx) + Math.abs(v.vy) < 4) v.vx = v.vy = 0; } }
    for (let k = S.vir.length - 1; k >= 0; k--) {
      const v = S.vir[k], x0 = clamp(((v.x - v.r) / CG) | 0, 0, CGN - 1), x1 = clamp(((v.x + v.r) / CG) | 0, 0, CGN - 1), y0 = clamp(((v.y - v.r) / CG) | 0, 0, CGN - 1), y1 = clamp(((v.y + v.r) / CG) | 0, 0, CGN - 1); let hit = null;
      for (let gy = y0; gy <= y1 && !hit; gy++) for (let gx = x0; gx <= x1 && !hit; gx++) for (const c of cb[gy * CGN + gx]) if (!c.dead && c.m >= POP_M && c.m > v.m * 1.2 && Math.hypot(c.x - v.x, c.y - v.y) < c.r - v.r * .25) { hit = c; break; }
      if (hit) { S.vir.splice(k, 1); popCell(hit, v); }
    }
    if (S.vir.length < VIR_MIN && R() < dt * .5) { const p = freeSpot(120); addVirus(p.x, p.y); }
    // tidy
    if (S.cells.some(c => c.dead)) { S.cells = S.cells.filter(c => !c.dead); for (const o of S.owners) if (!o.gone && !o.dead) { o.cells = o.cells.filter(c => !c.dead); if (!o.cells.length) { o.dead = true; o.respawnAt = S.t + 2 + R() * 4; o.ev.push('D' + (o.killer || '')); } } }
    for (const o of S.owners) {
      if (o.gone || o.dead) continue; let t = 0, x = 0, y = 0; for (const c of o.cells) t += c.m;
      if (t > MAXT) { const k = MAXT / t; for (const c of o.cells) { c.m *= k; c.r = rOf(c.m); } t = MAXT; }
      t = 0; for (const c of o.cells) { t += c.m; x += c.x * c.m; y += c.y * c.m; } o.total = t; o.cx = x / t; o.cy = y / t; if (t > o.st.maxM) o.st.maxM = t;
    }
    // leaderboard + blooms
    if (S.t - S.lbT > .5) {
      S.lbT = S.t; const al = S.owners.filter(o => !o.gone && !o.dead).sort((a, b) => b.total - a.total); al.forEach((o, k) => { o.rank = k + 1; if (o.st && k + 1 < o.st.best) o.st.best = k + 1; });
      S.lb = al.slice(0, 10).map(o => [o.i, Math.round(o.total)]); S.alive = al.length;
      if (S.mode === 'teams') { S.teamM = [0, 0, 0]; for (const o of al) if (o.team >= 0) S.teamM[o.team] += o.total; }
      for (const o of S.owners) if (o.dead) o.rank = 0;
    }
    if (S.rd) {
      const rd = S.rd, tau = S.t - rd.t0; rd.r = ringR(tau);
      if (rd.ph === 'live') {
        const al = S.owners.filter(o => !o.gone && !o.dead);
        if ((tau > 27 && al.length <= 1) || tau >= 260) {
          const w = al.sort((a, b) => b.total - a.total)[0]; rd.ph = 'end'; rd.endT = S.t + 9; rd.winner = w ? w.name : '';
          for (const o of S.owners) if (!o.gone) o.ev.push('W' + rd.winner); if (w) w.ev.push('V');
        }
      } else if (S.t >= rd.endT) startRound();
    }
    if (!S.bloom && S.t > S.bloomNext) { let p = freeSpot(300); if (S.rd) { const a = R() * TAU, d = Math.sqrt(R()) * S.rd.r * .5; p = { x: clamp(S.rd.cx + Math.cos(a) * d, 400, WORLD - 400), y: clamp(S.rd.cy + Math.sin(a) * d, 400, WORLD - 400) }; } S.bloomN++; S.bloom = { id: S.bloomN, x: p.x, y: p.y, end: S.t + 32 }; for (let i = NP; i < NS; i++) place(i); for (const o of S.owners) if (!o.gone) o.ev.push('B'); }
    else if (S.bloom && S.t > S.bloom.end) { S.bloom = null; for (let i = NP; i < NS; i++) unbucket(i); S.bloomNext = S.t + 70 + R() * 40; }
  }

  // ---------------- what one player can see, as a short string ----------------
  function viewFor(o, pd, q) {
    const hw = clamp(o.inp.hw, 300, 1900 * Math.max(1, Math.sqrt(o.total / 400))), hh = clamp(o.inp.hh, 300, 1900 * Math.max(1, Math.sqrt(o.total / 400))), cx = o.dead ? o.cx : o.cx, cy = o.cy;
    const inV = (x, y, r) => Math.abs(x - cx) < hw + r && Math.abs(y - cy) < hh + r;
    const cs = [], es = [], vs = [];
    for (const c of S.cells) if (!c.dead && (c.o === o.i || inV(c.x, c.y, c.r))) cs.push(b36(c.id) + '.' + b36(c.o) + '.' + b36(c.x) + '.' + b36(c.y) + '.' + b36(c.m * 4));
    for (const e of S.ej) if (!e.dead && inV(e.x, e.y, e.r)) es.push(b36(e.id) + '.' + b36(e.x) + '.' + b36(e.y) + '.' + b36(e.sk));
    for (const v of S.vir) if (inV(v.x, v.y, v.r)) vs.push(b36(v.id) + '.' + b36(v.x) + '.' + b36(v.y) + '.' + b36(v.m));
    const st = o.st || { pel: 0, cells: 0, kills: 0, splitK: 0, vshots: 0, maxM: 0, born: S.t, best: 99 };
    const you = [o.dead ? 0 : 1, Math.round(o.total), o.rank, st.pel, st.cells, st.kills, st.splitK, st.vshots, Math.round(st.maxM), Math.round(S.t - st.born), st.best, S.alive || 0].map(b36).join('.');
    const fd = S.feed.filter(f => f.t > o.feedT).map(f => f.s).join(';'); if (S.feed.length) o.feedT = S.feed[S.feed.length - 1].t;
    const ev = o.ev.splice(0, 12).map(clean2).join(';');
    const bl = S.bloom ? [S.bloom.id, S.bloom.x, S.bloom.y, (S.bloom.end - S.t) * 10].map(b36).join('.') : '';
    const mi = S.modeInfo(); let ms = '';
    if (mi.mode === 'teams') ms = 'T.' + mi.tm.map(b36).join('.');
    else if (mi.mode === 'royale') ms = 'R.' + [mi.ph, mi.cx, mi.cy, mi.r, mi.left * 10, mi.closing, mi.alive, mi.join].map(b36).join('.') + '.' + clean(mi.winner);
    return [b36(q), b36(S.t * 1000), cs.join(';'), es.join(';'), vs.join(';'), pd, bl, you, ev, S.lb.map(([i, m]) => b36(i) + '.' + b36(m)).join(';'), fd, b36(o.i), ms].join('|');
  }
  const clean2 = s => s.replace(/[|;]/g, ' ');
  function roster() { const r = {}; for (const o of S.owners) if (!o.gone) r[o.i] = o.name + '~' + o.skin + '~' + (o.uid || '') + '~' + o.team; return r; }

  botFill();
  if (S.mode === 'royale') startRound();
  Object.assign(S, { step, addHuman, removeHuman, viewFor, roster, botFill, spawn, splitOwner, ejectOwner, place });
  return S;
}

// =====================================================================================
//  CLIENT WORLD (rebuilt from the host's view strings)
// =====================================================================================
function makeClient() {
  const C = { known: new Set(), seed: 0, pg: new Uint16Array(NS), have: false, q: -1, snaps: [], roster: {}, me: -1, you: null, bloom: null, lb: [], off: null, pred: new Map(), needPf: true, lastRecv: 0, gotFirst: false };
  C.applyPf = s => { if (!s) return; for (let i = 0; i < NS; i++) C.pg[i] = p36(s.substr(i * 2, 2)); C.have = true; C.needPf = false; };
  C.ingest = (str) => {
    const p = str.split('|'); if (p.length < 12) return;
    const q = p36(p[0]), ht = p36(p[1]);
    if (C.q >= 0 && q !== C.q + 1) C.needPf = true; // missed a pellet update: fetch the full field again
    if (q <= C.q && C.q - q < 1000) return; C.q = q;
    const now = performance.now(), sample = now - ht;
    C.off = C.off === null || sample < C.off ? sample : C.off + (sample - C.off) * .02;
    const cells = new Map();
    if (p[2]) for (const s of p[2].split(';')) { const a = s.split('.'); cells.set(p36(a[0]), { o: p36(a[1]), x: p36(a[2]), y: p36(a[3]), m: p36(a[4]) / 4 }); }
    const ej = new Map(); if (p[3]) for (const s of p[3].split(';')) { const a = s.split('.'); ej.set(p36(a[0]), { x: p36(a[1]), y: p36(a[2]), sk: p36(a[3]) }); }
    const vir = new Map(); if (p[4]) for (const s of p[4].split(';')) { const a = s.split('.'); vir.set(p36(a[0]), { x: p36(a[1]), y: p36(a[2]), m: p36(a[3]) }); }
    if (p[5]) for (const s of p[5].split(';')) { const a = s.split('.'); const i = p36(a[0]); if (i < NS) { C.pg[i] = p36(a[1]); C.changed.push(i); } }
    if (p[6]) { const a = p[6].split('.').map(p36); if (!C.bloom || C.bloom.id !== a[0]) C.bloomNew = true; C.bloom = { id: a[0], x: a[1], y: a[2], left: a[3] / 10, at: now }; } else C.bloom = null;
    const y = p[7].split('.').map(p36); C.you = { alive: y[0], mass: y[1], rank: y[2], pel: y[3], cells: y[4], kills: y[5], splitK: y[6], vshots: y[7], maxM: y[8], life: y[9], best: y[10], alive_n: y[11] };
    if (p[8]) C.events.push(...p[8].split(';'));
    C.lb = p[9] ? p[9].split(';').map(s => s.split('.').map(p36)) : [];
    if (p[10]) for (const f of p[10].split(';')) C.feed.push(f);
    C.me = p36(p[11]);
    const ms = p[12] || '';
    if (ms[0] === 'T') C.mi = { mode: 'teams', tm: ms.slice(2).split('.').map(p36) };
    else if (ms[0] === 'R') { const a = ms.slice(2).split('.'), n = a.slice(0, 8).map(p36); C.mi = { mode: 'royale', ph: n[0], cx: n[1], cy: n[2], r: n[3], left: n[4] / 10, closing: n[5], alive: n[6], join: n[7], winner: a.slice(8).join(' '), at: now }; }
    else C.mi = { mode: 'ffa' };
    C.snaps.push({ t: ht, cells, ej, vir }); if (C.snaps.length > 30) C.snaps.shift();
    C.lastRecv = now; C.gotFirst = true;
  };
  C.mergeAt = new Map(); C.events = []; C.feed = []; C.changed = []; C.ghosts = []; C.half = new Map(); C.gid = -1; C.mi = { mode: 'ffa' };
  return C;
}

// =====================================================================================
//  GAME STATE, INPUT, CAMERA
// =====================================================================================
const G = {
  state: 'menu', mode: 'attract', sim: null, cl: null, me: null, myIdx: -1, acc: 0, cam: { x: WORLD / 2, y: WORLD / 2, z: 1 }, shake: 0, hit: 0, flash: 0,
  mouse: { x: 0, y: 0 }, split: 0, rs: 0, ejHeld: false, paused: false, t: 0, lastIn: '', inT: 0, you: null, alive: false, deadAt: 0, lastMass: 0, toastT: 0, lifeXp: 0, warn: 0, dprs: 1, W: 0, H: 0,
  prevIds: new Map(), attractFollow: -1, attractT: 0, connecting: false, touch: false, jx: 0, jy: 0, jOn: false
};
window.__MX = { G, AU, get save() { return save; }, NET, makeSim, SKINS, toMenu: () => toMenu() };

function resize() {
  const dpr = Math.min(save.set.q ? 2 : 1, window.devicePixelRatio || 1); G.dpr = dpr;
  G.W = innerWidth; G.H = innerHeight; cv.width = Math.round(G.W * dpr); cv.height = Math.round(G.H * dpr); cv.style.width = G.W + 'px'; cv.style.height = G.H + 'px';
  G.base = Math.pow(Math.sqrt(G.W * G.H) / 1440, .78);
  buildVignette();
}
addEventListener('resize', resize);

// pointer
cv.addEventListener('mousemove', e => { G.mouse.x = e.clientX; G.mouse.y = e.clientY; G.touch = false; });
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  AU.init();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'play') togglePause(); else if (G.state === 'pause') togglePause(); else closeOverlays(); e.preventDefault(); return; }
  if (G.state !== 'play' || G.paused) { if (e.code === 'Enter' || e.code === 'Space') { if (G.state === 'dead' && performance.now() - G.deadAt > 900) { e.preventDefault(); respawn(); } } return; }
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) doSplit(); }
  if (e.code === 'KeyW') { G.ejHeld = true; }
});
addEventListener('keyup', e => { if (e.code === 'KeyW') G.ejHeld = false; });
addEventListener('blur', () => { G.ejHeld = false; });

// touch: drag anywhere to steer, buttons to split and eject
let tid = null;
cv.addEventListener('touchstart', e => { AU.init(); G.touch = true; const t = e.changedTouches[0]; tid = t.identifier; G.jOn = true; G.jx = t.clientX; G.jy = t.clientY; G.mouse.x = t.clientX; G.mouse.y = t.clientY; e.preventDefault(); }, { passive: false });
cv.addEventListener('touchmove', e => { for (const t of e.changedTouches) if (t.identifier === tid) { G.mouse.x = t.clientX; G.mouse.y = t.clientY; } e.preventDefault(); }, { passive: false });
cv.addEventListener('touchend', e => { for (const t of e.changedTouches) if (t.identifier === tid) { tid = null; G.jOn = false; } }, { passive: false });
const tb = (id, down, up) => { const el = $(id); el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); AU.init(); el.classList.add('on'); down(); }, { passive: false }); el.addEventListener('touchend', e => { e.preventDefault(); el.classList.remove('on'); if (up) up(); }, { passive: false }); el.addEventListener('mousedown', e => { e.preventDefault(); down(); }); el.addEventListener('mouseup', () => { if (up) up(); }); };
tb('tSplit', () => doSplit()); tb('tEject', () => { G.ejHeld = true; }, () => { G.ejHeld = false; });

function doSplit() {
  if (G.state !== 'play' || G.paused) return;
  G.split = (G.split + 1) % 8;
  if (G.sim && G.me) G.me.inp.split = G.split;
  else if (G.cl) {
    const C = G.cl, own = myCellsClient().sort((a, b) => b.m - a.m), tgt = aimTarget(); let n = own.length + C.ghosts.length, did = 0;
    for (const c of own) { if (n >= MAXC || c.m < SPLIT_MIN || C.half.has(c.id)) continue; let dx = tgt.x - c.x, dy = tgt.y - c.y, d = Math.hypot(dx, dy) || 1; const h = c.m / 2, sp = 700 + 160 * Math.min(1, 60 / Math.sqrt(h)), r = rOf(h);
      C.ghosts.push({ id: C.gid--, x: c.x + dx / d * r * .5, y: c.y + dy / d * r * .5, vx: dx / d * sp, vy: dy / d * sp, m: h, born: performance.now() }); C.half.set(c.id, { m: h, until: performance.now() + 450 }); n++; did++; }
    if (did) { AU.split(); bump(3); }
  }
}
function screenToWorld(sx, sy) { const s = G.cam.z * G.base; return { x: G.cam.x + (sx - G.W / 2) / s, y: G.cam.y + (sy - G.H / 2) / s }; }
function aimTarget() {
  if (G.paused || G.state !== 'play') return { x: G.cam.x, y: G.cam.y };
  if (G.touch) { if (!G.jOn) return { x: G.cam.x, y: G.cam.y }; const dx = G.mouse.x - G.W / 2, dy = G.mouse.y - G.H / 2, l = Math.hypot(dx, dy) || 1, s = G.cam.z * G.base, k = Math.min(1, l / 90); return { x: G.cam.x + dx / l * k * 700 / s, y: G.cam.y + dy / l * k * 700 / s }; }
  return screenToWorld(G.mouse.x, G.mouse.y);
}
function bump(n) { if (save.set.shake) G.shake = Math.max(G.shake, n); }

// =====================================================================================
//  MODES: attract (title), solo, host, client
// =====================================================================================
function startAttract() { G.mode = 'attract'; G.sim = makeSim((Math.random() * 1e9) | 0, { attract: 1, minBots: 22 }); G.cl = null; G.me = null; for (let k = 0; k < 160; k++) G.sim.step(DT); G.acc = 0; }
// ---------------- Daily Arena: same map and bots for everyone, 3 minutes, one life ----------------
const D_EPOCH = new Date(2026, 10, 9);
const TODAY = (() => { const d = new Date(), a = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return Math.round((a - D_EPOCH) / 864e5) + 1; })();
const D_LEN = 180;
function dHash(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
save.daily = save.daily || {}; if (save.daily.last !== undefined && save.daily.last < TODAY - 1) save.daily.streak = 0;
/* tell the site's daily page that this daily was played (shared by every game on gamebookshelf.com) */
function markDaily(game, score) { try { const k = 'gbs-daily', d = JSON.parse(localStorage.getItem(k) || '{}'); d[TODAY] = d[TODAY] || {}; if (d[TODAY][game] === undefined) d[TODAY][game] = score; const keys = Object.keys(d).map(Number).sort((a, b) => a - b); while (keys.length > 60) delete d[keys.shift()]; localStorage.setItem(k, JSON.stringify(d)); } catch (e) { } }
function startDaily() {
  stopNet(); G.mode = 'solo'; G.sim = makeSim(dHash('mitosis-' + TODAY), { minBots: 20, mode: 'ffa' }); G.cl = null;
  for (let k = 0; k < 120; k++) G.sim.step(DT);
  G.me = G.sim.addHuman('me', playerName(), save.skin, { m: START_M }); G.myIdx = G.me.i;
  G.daily = { t0: G.sim.t, done: false, official: save.daily.day !== TODAY };
  beginPlay(); toast('Daily Arena #' + TODAY + (G.daily.official ? ': 3 minutes, one life. Get as big as you can!' : ' (practice run): your official score is already in.'), 4);
}
function startTour() {
  if (!window.GBTour) return startDaily();
  stopNet(); G.mode = 'solo'; G.sim = makeSim(GBTour.seed('mitosis'), { minBots: 22, mode: 'ffa' }); G.cl = null;
  for (let k = 0; k < 120; k++) G.sim.step(DT);
  G.me = G.sim.addHuman('me', playerName(), save.skin, { m: START_M }); G.myIdx = G.me.i;
  G.daily = { t0: G.sim.t, done: false, official: false, tour: true };
  beginPlay(); toast('Weekly tournament: 3 minutes, one life. Your best run this week counts.', 4);
}
function dailyLeft() { return G.daily ? Math.max(0, D_LEN - (G.sim.t - G.daily.t0)) : 0; }
function dailyEnd(you, why) {
  const D = G.daily; if (!D || D.done) return; D.done = true; const score = Math.min(MAXT, Math.round((you && you.maxM) || START_M));
  if (D.tour) {
    $('dWho').textContent = 'Weekly tournament' + (why === 'time' ? ': time\'s up!' : ': eaten!'); $('dAgain').textContent = 'TRY AGAIN';
    $('dHint').innerHTML = 'Saving your score…'; if (save.name) GBTour.setName(save.name);
    GBTour.submit('mitosis', score, G.sim.t - D.t0).then(r => { $('dHint').innerHTML = (r.improved ? 'New personal best this week! ' : '') + 'Your best: <b>' + r.best.toLocaleString() + '</b> mass' + (r.online ? ' · rank <b>#' + r.rank + '</b> of ' + r.of : ' (offline, saved on this device)') + '<br><a id="dShare" href="/tournament/">See the leaderboard</a> · ends in ' + GBTour.left(); });
    return;
  }
  let line;
  if (D.official) { const s = save.daily; s.streak = s.last === TODAY - 1 ? (s.streak || 0) + 1 : 1; s.last = TODAY; s.day = TODAY; s.score = score; s.max = Math.max(s.max || 0, s.streak); store(); markDaily('mitosis', score); line = 'Official score for today: <b>' + score.toLocaleString() + '</b> · day streak <b>' + s.streak + '</b>'; }
  else line = 'Practice run: ' + score.toLocaleString() + '. Today\'s official score: <b>' + (save.daily.score || 0).toLocaleString() + '</b>';
  $('dWho').textContent = 'Daily Arena #' + TODAY + (why === 'time' ? ': time\'s up!' : ': eaten!');
  $('dAgain').textContent = 'PRACTICE AGAIN'; $('dHint').innerHTML = line + '<br><button id="dShare" type="button">Share today\'s arena</button>';
  $('dShare').onclick = () => { const t = 'Mitosis daily arena #' + TODAY + ': ' + (save.daily.score || score).toLocaleString() + ' mass' + (save.daily.streak > 1 ? ' 🔥' + save.daily.streak : '') + '\n' + '🟢'.repeat(Math.min(10, Math.max(1, Math.ceil((save.daily.score || score) / 400)))) + '\ngamebookshelf.com'; try { navigator.clipboard.writeText(t).then(() => toast('Copied. Paste it anywhere.', 2, 'good'), () => toast(t, 4)); } catch (e) { toast(t, 4); } };
}
function startSolo() { G.daily = null;
  stopNet(); G.mode = 'solo'; G.sim = makeSim((Math.random() * 1e9) | 0, { minBots: 20, mode: save.mode || 'ffa' }); G.cl = null;
  for (let k = 0; k < 120; k++) G.sim.step(DT);
  G.me = G.sim.addHuman('me', playerName(), save.skin, { m: START_M }); G.myIdx = G.me.i; beginPlay();
}
function playerName() { return clean($('nm').value) || 'Cell'; }
async function goOnline(kind, code) { G.daily = null;
  AU.init(); save.name = clean($('nm').value); store();
  showBusy(kind === 'join' ? 'Joining arena ' + code + '…' : 'Finding an arena…');
  stopNet(); let ok;
  try { ok = kind === 'join' ? await NET.join(code, playerName(), save.skin) : kind === 'private' ? await NET.create(playerName(), save.skin, false, 0, '', save.mode || 'ffa') : await NET.quick(playerName(), save.skin, 0, save.mode || 'ffa'); } catch (e) { ok = false; }
  hideBusy();
  if (!ok) {
    if (kind === 'join') { $('jErr').textContent = NET.err || 'Could not join that arena.'; openOv('joinOv'); return; }
    toast(NET.err ? NET.err + ' Playing offline with bots instead.' : 'Online arenas are busy. Playing offline with bots.', 4); startSolo(); return;
  }
  setupNetMode(true);
}
function setupNetMode(fresh, carry) {
  if (NET.isHost) {
    G.mode = 'host'; G.sim = makeSim(NET.meta.seed || 1, { minBots: 6, mode: NET.meta.mode || 'ffa' }); G.cl = null; for (let k = 0; k < 120; k++) G.sim.step(DT);
    G.me = G.sim.addHuman(NET.me, playerName(), save.skin, carry || { m: START_M }); G.myIdx = G.me.i; G.sim.q = 0;
    for (const [id, p] of Object.entries(NET.players)) if (id !== NET.me) G.sim.addHuman(id, p.n, p.s, { m: p.c || START_M });
    NET.setRoster(G.sim.roster()); NET.putPellets(G.sim.pfString());
  } else {
    G.mode = 'client'; G.sim = null; G.me = null; G.cl = makeClient(); G.myIdx = -1; G.cl.seed = NET.meta.seed || 1;
    NET.getPellets().then(s => { if (G.cl) G.cl.applyPf(s); });
  }
  if (fresh) beginPlay();
  $('room').classList.remove('hide'); updRoomBadge();
}
function stopNet() { if (NET.on) NET.leave(); $('room').classList.add('hide'); }
NET.carry = () => { // what this player keeps if the host disappears
  if (G.cl && G.cl.you && G.cl.you.alive) { const own = myCellsClient(); let x = 0, y = 0, m = 0; for (const c of own) { x += c.x * c.m; y += c.y * c.m; m += c.m; } return m ? { m: Math.round(m), x: Math.round(x / m), y: Math.round(y / m) } : 0; }
  return 0;
};
NET.listen('players', (ps, old) => {
  updRoomBadge();
  if (G.mode !== 'host' || !G.sim) return;
  for (const [id, p] of Object.entries(ps)) if (id !== NET.me) { const ex = G.sim.owners.find(o => !o.gone && o.uid === id); if (!ex) { const c = p.c && p.c.m ? p.c : { m: START_M }; G.sim.addHuman(id, p.n, p.s, c); toast(clean(p.n) + ' joined the arena', 2.5); } else if (ex.name !== clean(p.n) || ex.skin !== (p.s | 0)) { ex.name = clean(p.n); ex.skin = p.s | 0; G.sim.rosterDirty = true; } }
  for (const o of G.sim.owners) if (!o.gone && !o.bot && o.uid !== NET.me && !ps[o.uid]) { toast(o.name + ' left', 2); G.sim.removeHuman(o.uid); }
});
NET.listen('inputs', map => {
  if (G.mode !== 'host' || !G.sim) return;
  for (const [id, s] of Object.entries(map)) { const o = G.sim.owners.find(x => !x.gone && x.uid === id); if (!o || typeof s !== 'string') continue; const a = s.split(','); o.inp.tx = +a[0] || 0; o.inp.ty = +a[1] || 0; o.inp.split = (+a[2] || 0) % 8; o.inp.ej = +a[3] ? 1 : 0; o.inp.rs = +a[4] || 0; o.inp.hw = +a[5] || 1200; o.inp.hh = +a[6] || 800;
    if (a[7]) { const m = o.inp.pos = o.inp.pos || new Map(); m.clear(); for (const e of a[7].split(';')) { const q = e.split(':'); if (q.length === 3) m.set(+q[0], { x: +q[1], y: +q[2] }); } o.inp.posT = G.sim.t; } }
});
NET.listen('view', s => { if (G.cl) G.cl.ingest(s); });
NET.listen('roster', r => { if (G.cl) G.cl.roster = r; });
NET.listen('migrating', () => { toast('The host left. Moving the arena to another player…', 3); });
NET.listen('migrated', (ok, host) => {
  if (!ok) { toast('Lost the arena. Playing offline with bots.', 4); const c = NET.carry(); startSolo(); return; }
  const carry = G.cl && G.cl.you && G.cl.you.alive ? NET.carry() : null;
  setupNetMode(false, carry || undefined);
  if (NET.isHost && !carry) { /* was dead: stay on the death screen */ G.me.dead = true; G.me.cells.length = 0; G.sim.cells = G.sim.cells.filter(c => c.o !== G.me.i); }
  toast(host ? 'You are now hosting this arena.' : 'Back in the arena.', 2.5);
});
NET.listen('conn', c => toast(c ? 'Reconnected.' : 'Connection lost. Trying to reconnect…', 3));
function updRoomBadge() { if (!NET.on) return; $('roomCode').textContent = NET.code; $('roomN').textContent = NET.count() + (NET.count() === 1 ? ' player' : ' players') + (NET.isHost ? ' · you host' : ''); $('roomPub').textContent = (NET.pub ? 'Public ' : 'Private ') + MODES[(NET.meta && NET.meta.mode) || 'ffa'][0]; }

function beginPlay() {
  G.mouse.x = G.W / 2; G.mouse.y = G.H / 2; G.state = 'play'; G.paused = false; G.alive = true; G.lifeStart = performance.now(); G.deadAt = 0; G.lastRank = 0; G.lastMass = START_M; G.prevIds.clear();
  closeOverlays(); $('title').classList.add('hide'); $('death').classList.add('hide'); $('hud').classList.remove('hide'); document.body.classList.add('playing');
  if (!save.help) { save.help = 1; store(); setTimeout(() => toast(document.body.classList.contains('touch') ? 'Drag to move. SPLIT launches half of you, EJECT shoots mass.' : 'Move with the mouse. Space splits, W shoots mass.', 5), 600); }
  save.rec.games++; store();
}
function respawn() {
  if (G.state !== 'dead') return; AU.click();
  if (G.daily) { $('death').classList.add('hide'); if (G.daily.tour) startTour(); else startDaily(); return; }
  const mi = G._lastF && G._lastF.mi; if (mi && mi.mode === 'royale' && !mi.join) { toast('You’ll drop in automatically when the next round starts.', 2); return; }
  $('death').classList.add('hide'); G.state = 'play'; G.alive = true; G.lifeStart = performance.now(); G.prevIds.clear();
  if (G.sim && G.me) { G.sim.spawn(G.me, START_M); G.me.lastRs = G.rs; } else { G.rs++; G.awaitSpawn = performance.now(); }
}
function toMenu() { const wasDaily = G.daily && !G.daily.done; if (wasDaily && G.state === 'play' && G.alive) { G.daily.done = true; }
  if (G.state === 'play' && G.alive) finishLife(curYou(), '');
  stopNet(); G.state = 'menu'; G.paused = false; document.body.classList.remove('playing');
  $('hud').classList.add('hide'); $('death').classList.add('hide'); $('pause').classList.add('hide'); $('title').classList.remove('hide'); refreshTitle(); startAttract();
}
function togglePause() {
  if (G.state === 'play') { G.state = 'pause'; G.paused = true; $('pause').classList.remove('hide'); $('pNote').textContent = G.mode === 'solo' ? 'The arena is paused.' : 'This is an online arena, so it keeps going while you’re here. Your cells will hold still.'; }
  else if (G.state === 'pause') { G.state = 'play'; G.paused = false; $('pause').classList.add('hide'); }
}

// ---------------- the player's own stats ("you") ----------------
function curYou() {
  if (G.sim && G.me) { const o = G.me, st = o.st || {}; return { alive: o.dead ? 0 : 1, mass: Math.round(o.total), rank: o.rank, pel: st.pel || 0, cells: st.cells || 0, kills: st.kills || 0, splitK: st.splitK || 0, vshots: st.vshots || 0, maxM: Math.round(st.maxM || 0), life: Math.round(G.sim.t - (st.born || 0)), best: st.best || 99, alive_n: G.sim.alive || 0 }; }
  return G.cl && G.cl.you;
}
function myCellsClient() { const C = G.cl; if (!C || !C.snaps.length) return []; const s = C.snaps[C.snaps.length - 1], out = []; for (const [id, c] of s.cells) if (c.o === C.me) out.push(Object.assign({ id }, c, C.pred.get(id) ? { x: C.pred.get(id).x, y: C.pred.get(id).y } : {})); return out; }

function handleEvents(list) {
  for (const e of list) {
    const k = e[0], v = e.slice(1);
    if (k === 'E') { const m = p36(v); const big = clamp(m / 300, 0, 1); if (m >= 8) floatText('+' + Math.round(m), '#ffe27a'); AU.gulp(big); G.hit = Math.max(G.hit, m > 60 ? .07 : 0); bump(2 + big * 8); G.flash = Math.max(G.flash, .12 + big * .2); }
    else if (k === 'K') { floatText('WIPED OUT', '#ff8a8a'); toast('You wiped out ' + v + '!', 2.2, 'good'); }
    else if (k === 'P') { AU.pop(); bump(14); G.hit = .09; G.flash = .25; }
    else if (k === 'M') AU.merge();
    else if (k === 'S') { if (G.sim) { AU.split(); bump(3); } }
    else if (k === 'J') AU.eject();
    else if (k === 'B') { AU.bloom(); toast('A nutrient bloom has appeared. It’s marked on the map.', 3.5, 'bloom'); }
    else if (k === 'D') onDeath(v);
    else if (k === 'N') { if (G.state === 'dead' || G.state === 'play') { $('death').classList.add('hide'); if (G.state === 'dead') { G.state = 'play'; G.alive = true; G.lifeStart = performance.now(); } toast('New round! Grow fast before the ring closes in.', 3, 'bloom'); AU.bloom(); } }
    else if (k === 'W') { if (v && v !== playerName()) toast(v + ' wins the round!', 3); }
    else if (k === 'V') { toast('YOU WIN THE ROUND! +250 XP', 4, 'good'); AU.level(); save.xp += 250; save.rec.wins = (save.rec.wins || 0) + 1; store(); bump(10); G.flash = .4; }
  }
}
function onDeath(killer) {
  if (G.state !== 'play' && G.state !== 'pause') return;
  const you = curYou(); G.alive = false; G.state = 'dead'; G.paused = false; $('pause').classList.add('hide'); G.deadAt = performance.now();
  AU.death(); bump(18); G.flash = .5;
  finishLife(you, killer);
}
function finishLife(you, killer) {
  if (!you) return;
  if (G.mode !== 'attract' && you.maxM >= 40 && killer !== undefined) NET.hofSubmit(playerName(), Math.min(MAXT, you.maxM), G.mode === 'solo' ? 'solo' : (NET.meta && NET.meta.mode) || 'ffa').catch(() => { });
  const xp = Math.round(you.maxM / 4 + you.cells * 14 + you.kills * 40 + you.pel * .15 + you.life / 6 + (you.best <= 3 ? 60 : 0) + (you.best === 1 ? 90 : 0));
  const L0 = levelOf(save.xp); save.xp += xp; const L1 = levelOf(save.xp);
  const r = save.rec, nb = []; if (you.maxM > r.mass) { r.mass = you.maxM; nb.push('mass'); } if (you.cells > r.cells) { r.cells = you.cells; nb.push('cells'); } if (you.life > r.life) { r.life = you.life; nb.push('life'); } if (you.best === 1) r.top++;
  const done = missionTick(you, true);
  store();
  if (!killer && killer !== '') return;
  const mm = Math.floor(you.life / 60), ss = you.life % 60;
  const roy = (G._lastF && G._lastF.mi && G._lastF.mi.mode === 'royale');
  if (killer === '__time') killer = 'time';
  $('dWho').textContent = killer === 'the ring' ? 'The ring got you' : killer ? 'Eaten by ' + killer : 'You were absorbed';
  $('dAgain').textContent = roy ? 'NEXT ROUND' : 'PLAY AGAIN'; $('dHint').textContent = roy ? 'You’ll drop back in automatically when the next round starts. Keep watching!' : 'Press Space or Enter to play again.';
  $('dStats').innerHTML = [['Top mass', you.maxM.toLocaleString(), nb.includes('mass')], ['Cells eaten', you.cells, nb.includes('cells')], ['Pellets', you.pel], ['Time alive', mm + ':' + String(ss).padStart(2, '0'), nb.includes('life')], ['Best rank', you.best < 99 ? '#' + you.best : '–']].map(([a, b, n]) => `<div><span>${a}</span><b>${b}${n ? '<i>NEW BEST</i>' : ''}</b></div>`).join('');
  const L = levelOf(save.xp), cur = save.xp - lvlNeed(L), need = lvlNeed(L + 1) - lvlNeed(L);
  $('dXp').innerHTML = `<div class="xpl"><b>+${xp} XP</b><span>Level ${L}${L1 > L0 ? ' · LEVEL UP!' : ''}</span></div><div class="bar"><i style="width:${Math.round(cur / need * 100)}%"></i></div>` + (L1 > L0 && L1 <= SKINS.length ? `<p class="unl">New skin unlocked: <b>${SKINS[L1 - 1][0]}</b></p>` : '') + (done.length ? `<p class="unl">Mission complete: <b>${done.join(', ')}</b></p>` : '');
  if (L1 > L0) setTimeout(() => AU.level(), 700);
  $('death').classList.remove('hide');
  renderMissions($('dMis'));
  if (G.daily) dailyEnd(you, killer === 'time' ? 'time' : 'eaten');
}
function missionTick(you, final) {
  const done = [];
  for (const m of save.mis.list) {
    if (m.done) continue; const [k, goal, label, xp] = MPOOL[m.i]; let v = 0;
    if (k === 'pel' || k === 'cells' || k === 'kills' || k === 'splitK' || k === 'vshots') v = (m.base || 0) + (you[k] || 0);
    else if (k === 'mass') v = you.maxM; else if (k === 'life') v = you.life; else if (k === 'rank') v = you.best <= goal ? goal : 0;
    m.p = Math.max(m.p, Math.min(goal, v));
    if (m.p >= goal) { m.done = 1; save.xp += xp; done.push(label); AU.level(); toast('Mission complete: ' + label + ' (+' + xp + ' XP)', 3, 'good'); }
    if (final && (k === 'pel' || k === 'cells' || k === 'kills' || k === 'splitK' || k === 'vshots')) m.base = m.p;
  }
  return done;
}
function renderMissions(el) {
  rollMissions();
  el.innerHTML = save.mis.list.map(m => { const [, goal, label, xp] = MPOOL[m.i]; return `<div class="mis${m.done ? ' done' : ''}"><div><span>${label}</span><em>+${xp} XP</em></div><div class="bar"><i style="width:${Math.round(m.p / goal * 100)}%"></i></div></div>`; }).join('');
}

// =====================================================================================
//  RENDERING
// =====================================================================================
let vign = null;
function buildVignette() { vign = document.createElement('canvas'); vign.width = 256; vign.height = 256; const g = vign.getContext('2d'), gr = g.createRadialGradient(128, 128, 60, 128, 128, 182); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,4,8,.72)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
const PCOL = ['#5ef2d0', '#ffd166', '#ff7aa8', '#7cc8ff', '#b28bff', '#9be86a', '#ff9f5c', '#f2f6ff', '#fff07a'];
const pSpr = PCOL.map(c => { const s = document.createElement('canvas'); s.width = s.height = 48; const g = s.getContext('2d'), gr = g.createRadialGradient(24, 24, 0, 24, 24, 24); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.18, c); gr.addColorStop(.42, c + '88'); gr.addColorStop(1, c + '00'); g.fillStyle = gr; g.fillRect(0, 0, 48, 48); return s; });
// particles (pooled)
const PART = Array.from({ length: 700 }, () => ({ on: false })); let pi = 0;
function burst(x, y, n, col, sp, size, life) { for (let k = 0; k < n; k++) { const p = PART[pi = (pi + 1) % PART.length], a = Math.random() * TAU, s = sp * (.3 + Math.random() * .9); p.on = true; p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.life = p.max = life * (.6 + Math.random() * .6); p.s = size * (.5 + Math.random()); p.c = col; } }
const _pp = {};
function sparkle(x, y, c) { if (Math.abs(x - G.cam.x) > G.W / (G.cam.z * G.base) || Math.abs(y - G.cam.y) > G.H / (G.cam.z * G.base)) return; burst(x, y, 3, PCOL[c] || '#fff', 90, 3.5, .35); }
const FLOAT = [];
function floatText(txt, col) { const own = G._lastF ? G._lastF.cells.filter(c => c.own) : []; if (!own.length) return; const c = own.reduce((a, b) => (b.m > a.m ? b : a)); FLOAT.push({ x: c.x, y: c.y - c.r * .6, t: 0, txt, col, s: clamp(c.r * .35, 18, 90) }); if (FLOAT.length > 8) FLOAT.shift(); }
const motes = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), z: .3 + Math.random() * .7, r: .5 + Math.random() * 1.8 }));
// soft membranes
const MEM = new Map();
function membrane(id, r, q) {
  let m = MEM.get(id); const n = clamp(Math.round(r / (q ? 2.6 : 5)), 14, q ? 72 : 36);
  if (!m || m.n !== n) { const old = m; m = { n, d: new Float32Array(n).fill(old ? 1 : .6), v: new Float32Array(n), seen: 0, ph: Math.random() * TAU }; MEM.set(id, m); }
  return m;
}

function frameData() {
  // build one list of everything to draw this frame, from the simulation (host/solo) or the latest views (client)
  const F = { cells: [], ej: [], vir: [], owner: null, pg: null, seed: 0, bloom: null };
  if (G.sim) {
    const S = G.sim, a = clamp(G.acc / DT, 0, 1);
    for (const c of S.cells) if (!c.dead) F.cells.push({ id: c.id, o: c.o, x: lerp(c.px, c.x, a), y: lerp(c.py, c.y, a), m: c.m, r: c.r, own: G.me && c.o === G.me.i, eatT: c.eatT });
    for (const e of S.ej) if (!e.dead) F.ej.push({ id: e.id, x: e.x, y: e.y, r: e.r, sk: e.sk });
    for (const v of S.vir) F.vir.push({ id: v.id, x: v.x, y: v.y, r: v.r });
    F.owner = i => { const o = S.owners[i]; return o ? { name: o.name, skin: o.skin, team: o.team } : { name: '', skin: 0, team: -1 }; };
    F.mi = S.modeInfo();
    F.pelletOn = S.pelletOn; F.px = S.px; F.py = S.py; F.pc = S.pc; F.bloom = S.bloom ? { x: S.bloom.x, y: S.bloom.y, left: S.bloom.end - S.t } : null;
    F.lb = S.lb.map(([i, m]) => [i, m]); F.me = G.me ? G.me.i : -1;
  } else if (G.cl && G.cl.gotFirst) {
    const C = G.cl, rt = performance.now() - C.off - 140; let A = null, B = null;
    for (let k = C.snaps.length - 1; k >= 0; k--) if (C.snaps[k].t <= rt) { A = C.snaps[k]; B = C.snaps[k + 1] || A; break; }
    if (!A) A = B = C.snaps[0];
    const a = B === A ? 0 : clamp((rt - A.t) / (B.t - A.t), 0, 1.2), last = C.snaps[C.snaps.length - 1];
    for (const [id, cb] of B.cells) {
      const ca = A.cells.get(id) || cb; let x = lerp(ca.x, cb.x, a), y = lerp(ca.y, cb.y, a);
      const own = cb.o === C.me, pr = own && C.pred.get(id);
      if (pr) { x = pr.x; y = pr.y; }
      F.cells.push({ id, o: cb.o, x, y, m: lerp(ca.m, cb.m, a), r: rOf(lerp(ca.m, cb.m, a)), own });
    }
    // own cells the latest view knows about but the interpolated one doesn't yet (fresh splits)
    for (const [id, c] of last.cells) if (c.o === C.me && !B.cells.has(id)) { const pr = C.pred.get(id); F.cells.push({ id, o: c.o, x: pr ? pr.x : c.x, y: pr ? pr.y : c.y, m: c.m, r: rOf(c.m), own: true }); }
    for (const [id, eb] of B.ej) { const ea = A.ej.get(id) || eb; F.ej.push({ id, x: lerp(ea.x, eb.x, a), y: lerp(ea.y, eb.y, a), r: rOf(EJ_M), sk: eb.sk }); }
    for (const [id, vb] of B.vir) { const va = A.vir.get(id) || vb; F.vir.push({ id, x: lerp(va.x, vb.x, a), y: lerp(va.y, vb.y, a), r: rOf(vb.m) }); }
    F.owner = i => { const s = C.roster[i]; if (!s) return { name: '', skin: 0, team: -1 }; const p = s.split('~'); return { name: p[0], skin: +p[1] || 0, team: p[3] === undefined ? -1 : +p[3] }; };
    F.mi = C.mi ? (C.mi.mode === 'royale' ? Object.assign({}, C.mi, { left: Math.max(0, C.mi.left - (performance.now() - C.mi.at) / 1000) }) : C.mi) : { mode: 'ffa' };
    const nowT = performance.now();
    for (const f of F.cells) if (f.own && C.half.has(f.id)) { const h = C.half.get(f.id); if (nowT < h.until) { f.m = Math.min(f.m, h.m); f.r = rOf(f.m); } else C.half.delete(f.id); }
    for (const g of C.ghosts) F.cells.push({ id: g.id, o: C.me, x: g.x, y: g.y, m: g.m, r: rOf(g.m), own: true });
    F.client = C; F.bloom = C.bloom ? { x: C.bloom.x, y: C.bloom.y, left: C.bloom.left - (performance.now() - C.bloom.at) / 1000 } : null; F.lb = C.lb; F.me = C.me;
  }
  return F;
}

// client prediction of the player's own cells
function predict(dt) {
  const C = G.cl; if (!C || !C.snaps.length) return;
  const last = C.snaps[C.snaps.length - 1], prev = C.snaps[C.snaps.length - 2], tgt = aimTarget(), age = (performance.now() - C.lastRecv) / 1000 + .09;
  const seen = new Set();
  for (const [id, c] of last.cells) {
    if (c.o !== C.me) continue; seen.add(id);
    let p = C.pred.get(id); const pc = prev && prev.cells.get(id), vx = pc ? (c.x - pc.x) / Math.max(.05, (last.t - prev.t) / 1000) : 0, vy = pc ? (c.y - pc.y) / Math.max(.05, (last.t - prev.t) / 1000) : 0;
    const ex = c.x + vx * Math.min(age, .35), ey = c.y + vy * Math.min(age, .35);
    if (!p) { p = { x: ex, y: ey }; C.pred.set(id, p); }
    const r = rOf(c.m), dx = tgt.x - p.x, dy = tgt.y - p.y, d = Math.hypot(dx, dy) || 1, sp = spdOf(c.m) * Math.min(1, d / (r * .5 + 30));
    p.x += dx / d * sp * dt; p.y += dy / d * sp * dt;
    const err = Math.hypot(c.x - p.x, c.y - p.y), lim = Math.max(80, r * .7) + Math.hypot(vx, vy) * .3;
    if (err > lim) { const k = 1 - Math.exp(-dt * 6); p.x += (ex - p.x) * k; p.y += (ey - p.y) * k; }
    if (err > 600) { p.x = ex; p.y = ey; }
  }
  for (const id of [...C.pred.keys()]) if (!seen.has(id)) C.pred.delete(id);
  const nowT = performance.now(), ids = [...seen];
  for (const id of ids) if (!C.mergeAt.has(id)) { const m = last.cells.get(id).m, t = nowT + (10 + m * .02) * 1000; C.mergeAt.set(id, t); if (ids.length > 1) for (const j of ids) C.mergeAt.set(j, Math.max(C.mergeAt.get(j) || 0, nowT + (10 + last.cells.get(j).m * .02) * 1000)); }
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = C.pred.get(ids[i]), b = C.pred.get(ids[j]), ra = rOf(last.cells.get(ids[i]).m), rb = rOf(last.cells.get(ids[j]).m);
    if (nowT > C.mergeAt.get(ids[i]) && nowT > C.mergeAt.get(ids[j])) continue;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01, ov = ra + rb - d; if (ov <= 0) continue;
    const f = Math.min(1, ov / (ra + rb)) * .5 * ov * Math.min(1, dt * 40); a.x -= dx / d * f; a.y -= dy / d * f; b.x += dx / d * f; b.y += dy / d * f;
  }
  if (C.mergeAt.size > 200) for (const k of [...C.mergeAt.keys()]) if (!seen.has(k)) C.mergeAt.delete(k);
  for (let k = C.ghosts.length - 1; k >= 0; k--) {
    const g = C.ghosts[k], dx = tgt.x - g.x, dy = tgt.y - g.y, d = Math.hypot(dx, dy) || 1, sp = spdOf(g.m) * Math.min(1, d / (rOf(g.m) * .5 + 30)), kk = Math.exp(-dt * 3.4);
    g.x += dx / d * sp * dt + g.vx * dt; g.y += dy / d * sp * dt + g.vy * dt; g.vx *= kk; g.vy *= kk;
    let adopt = null, bd = 1e9; for (const id of seen) if (!C.known.has(id)) { const p = C.pred.get(id), dd = Math.hypot(p.x - g.x, p.y - g.y); if (dd < bd) { bd = dd; adopt = id; } }
    if (adopt !== null && bd < 600) { const p = C.pred.get(adopt); p.x = g.x; p.y = g.y; C.known.add(adopt); MEM.set(adopt, MEM.get(g.id)); C.ghosts.splice(k, 1); continue; }
    if (nowT - g.born > 700) C.ghosts.splice(k, 1);
  }
  for (const id of seen) C.known.add(id); if (C.known.size > 400) C.known = new Set(seen);
}

function draw(F, dt) {
  const W = G.W, H = G.H, dpr = G.dpr, q = save.set.q;
  // camera
  let tz = .9;
  const own = F.cells.filter(c => c.own);
  if (own.length) {
    let x = 0, y = 0, m = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const c of own) { x += c.x * c.m; y += c.y * c.m; m += c.m; x0 = Math.min(x0, c.x - c.r); x1 = Math.max(x1, c.x + c.r); y0 = Math.min(y0, c.y - c.r); y1 = Math.max(y1, c.y + c.r); }
    G.camT = { x: x / m, y: y / m }; const size = 10 * Math.sqrt(m); tz = Math.min(1.15, Math.pow(70 / size, .32)); const span = Math.max((x1 - x0) / (W * .7), (y1 - y0) / (H * .7)) / G.base; if (span * tz > 1) tz = 1 / span; G.lastTotal = m;
  } else if (G.mode === 'attract' && G.sim) {
    G.attractT -= dt; const S = G.sim; let o = S.owners[G.attractFollow];
    if (!o || o.dead || o.gone || G.attractT <= 0) { const al = S.owners.filter(x => !x.gone && !x.dead).sort((a, b) => b.total - a.total); o = al[(Math.random() * Math.min(4, al.length)) | 0]; if (o) G.attractFollow = o.i; G.attractT = 14; }
    if (o && !o.dead) { G.camT = { x: o.cx, y: o.cy }; tz = Math.pow(Math.min(1, 70 / (10 * Math.sqrt(o.total || 10))), .32) * .8; }
  } else tz = G.cam.z;
  if (!G.camT) G.camT = { x: WORLD / 2, y: WORLD / 2 };
  const kc = 1 - Math.exp(-dt * (G.mode === 'attract' ? 1.5 : 7)); G.cam.x += (G.camT.x - G.cam.x) * kc; G.cam.y += (G.camT.y - G.cam.y) * kc; G.cam.z += (tz - G.cam.z) * (1 - Math.exp(-dt * 2.2));
  const s = G.cam.z * G.base;
  let sx = 0, sy = 0; if (G.shake > 0) { sx = (Math.random() - .5) * G.shake; sy = (Math.random() - .5) * G.shake; G.shake = Math.max(0, G.shake - dt * 40); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bg = ctx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#06121b'); bg.addColorStop(1, '#030a10'); ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  // drifting motes (screen-space parallax)
  ctx.fillStyle = 'rgba(120,220,210,.16)';
  for (const m of motes) { const x = ((m.x * W - G.cam.x * s * m.z * .15) % W + W) % W, y = ((m.y * H - G.cam.y * s * m.z * .15) % H + H) % H; ctx.beginPath(); ctx.arc(x, y, m.r * m.z, 0, TAU); ctx.fill(); }
  ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (W / 2 - G.cam.x * s + sx), dpr * (H / 2 - G.cam.y * s + sy));
  const vx0 = G.cam.x - W / 2 / s - 60, vx1 = G.cam.x + W / 2 / s + 60, vy0 = G.cam.y - H / 2 / s - 60, vy1 = G.cam.y + H / 2 / s + 60;
  // dish floor + hemocytometer grid
  ctx.fillStyle = '#0a1a24'; ctx.fillRect(0, 0, WORLD, WORLD);
  const grd = ctx.createRadialGradient(WORLD / 2, WORLD / 2, 400, WORLD / 2, WORLD / 2, WORLD * .75); grd.addColorStop(0, 'rgba(40,110,120,.20)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = grd; ctx.fillRect(0, 0, WORLD, WORLD);
  const step = s < .35 ? 300 : 60; ctx.lineWidth = 1 / s; ctx.strokeStyle = 'rgba(94,230,200,.07)'; ctx.beginPath();
  for (let x = Math.max(0, Math.floor(vx0 / step) * step); x <= Math.min(WORLD, vx1); x += step) { ctx.moveTo(x, Math.max(0, vy0)); ctx.lineTo(x, Math.min(WORLD, vy1)); }
  for (let y = Math.max(0, Math.floor(vy0 / step) * step); y <= Math.min(WORLD, vy1); y += step) { ctx.moveTo(Math.max(0, vx0), y); ctx.lineTo(Math.min(WORLD, vx1), y); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(94,230,200,.16)'; ctx.lineWidth = 2 / s; ctx.beginPath();
  for (let x = Math.max(0, Math.floor(vx0 / 300) * 300); x <= Math.min(WORLD, vx1); x += 300) { ctx.moveTo(x, Math.max(0, vy0)); ctx.lineTo(x, Math.min(WORLD, vy1)); }
  for (let y = Math.max(0, Math.floor(vy0 / 300) * 300); y <= Math.min(WORLD, vy1); y += 300) { ctx.moveTo(Math.max(0, vx0), y); ctx.lineTo(Math.min(WORLD, vx1), y); }
  ctx.stroke();
  // rim of the dish
  ctx.lineWidth = 26; ctx.strokeStyle = 'rgba(94,230,200,.07)'; ctx.strokeRect(-13, -13, WORLD + 26, WORLD + 26); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(140,255,230,.45)'; ctx.strokeRect(-3, -3, WORLD + 6, WORLD + 6);
  // battle royale ring: everything outside it hurts
  if (F.mi && F.mi.mode === 'royale') {
    const m = F.mi; ctx.save(); ctx.beginPath(); ctx.rect(-2000, -2000, WORLD + 4000, WORLD + 4000); ctx.arc(m.cx, m.cy, m.r, 0, TAU, true); ctx.fillStyle = 'rgba(255,40,70,.14)'; ctx.fill();
    ctx.beginPath(); ctx.arc(m.cx, m.cy, m.r, 0, TAU); ctx.lineWidth = Math.max(26, 12 / s); ctx.strokeStyle = 'rgba(255,70,100,.18)'; ctx.stroke(); ctx.lineWidth = Math.max(7, 3 / s); ctx.strokeStyle = `rgba(255,110,130,${.75 + Math.sin(G.t * 5) * .2})`; ctx.stroke();
    if (m.closing === 1) { ctx.setLineDash([40, 40]); ctx.lineWidth = Math.max(4, 2 / s); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.beginPath(); ctx.arc(m.cx, m.cy, Math.max(R1, ringR(205 - Math.max(0, m.left) + 20)), 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
  }
  // bloom glow
  if (F.bloom) { const pulse = .7 + Math.sin(G.t * 3) * .15, g = ctx.createRadialGradient(F.bloom.x, F.bloom.y, 0, F.bloom.x, F.bloom.y, 720); g.addColorStop(0, `rgba(255,240,122,${.16 * pulse})`); g.addColorStop(1, 'rgba(255,240,122,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(F.bloom.x, F.bloom.y, 720, 0, TAU); ctx.fill(); }
  // pellets
  const pt = {};
  const pr = 9, wob = G.t * 2;
  if (G.sim) { for (let i = 0; i < NS; i++) { if (!F.pelletOn(i)) continue; const x = F.px[i], y = F.py[i]; if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue; const rr = (i < NP ? pr : 14) * (1 + Math.sin(wob + i) * .08) * 1.9; ctx.drawImage(pSpr[F.pc[i]], x - rr, y - rr, rr * 2, rr * 2); } }
  else if (F.client && F.client.have) { const C = F.client, bl = C.bloom; for (let i = 0; i < NS; i++) { pelletPos(C.seed, i, C.pg[i], bl, pt); if (!pt.on) continue; const x = pt.x, y = pt.y; if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue; const rr = (i < NP ? pr : 14) * (1 + Math.sin(wob + i) * .08) * 1.9; ctx.drawImage(pSpr[pt.c], x - rr, y - rr, rr * 2, rr * 2); } }
  // ejected mass
  for (const e of F.ej) { if (e.x < vx0 - e.r || e.x > vx1 + e.r || e.y < vy0 - e.r || e.y > vy1 + e.r) continue; const sk = SKINS[e.sk % SKINS.length]; const g = ctx.createRadialGradient(e.x - e.r * .3, e.y - e.r * .3, e.r * .1, e.x, e.y, e.r); g.addColorStop(0, sk[1]); g.addColorStop(1, sk[2]); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * .9, 0, TAU); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.stroke(); }
  // cells + viruses, smallest first so small cells hide under viruses
  const list = F.cells.filter(c => c.x + c.r > vx0 && c.x - c.r < vx1 && c.y + c.r > vy0 && c.y - c.r < vy1).map(c => ({ k: 0, c, r: c.r }));
  for (const v of F.vir) if (v.x + v.r > vx0 && v.x - v.r < vx1 && v.y + v.r > vy0 && v.y - v.r < vy1) list.push({ k: 1, c: v, r: v.r });
  list.sort((a, b) => a.r - b.r);
  const near = list.filter(l => l.k === 0).map(l => l.c);
  for (const l of list) { if (l.k) drawVirus(l.c, s); else drawCell(l.c, F, near, dt, s, q); }
  // vanished cells -> burst (eaten or merged)
  const nowIds = new Map(); for (const c of F.cells) nowIds.set(c.id, c);
  for (const [id, c] of G.prevIds) if (id > 0 && !nowIds.has(id) && c.x > vx0 && c.x < vx1 && c.y > vy0 && c.y < vy1) { const sk = SKINS[F.owner(c.o).skin % SKINS.length]; burst(c.x, c.y, clamp(Math.round(c.r / 4), 6, 40), sk[1], 160 + c.r * 2, clamp(c.r * .16, 3, 30), .8); }
  G.prevIds = nowIds;
  for (const [id, m] of MEM) if (!nowIds.has(id)) { m.seen += dt; if (m.seen > 1) MEM.delete(id); }
  // particles
  for (const p of PART) { if (!p.on) continue; p.life -= dt; if (p.life <= 0) { p.on = false; continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; const a = p.life / p.max; ctx.globalAlpha = a; ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (.4 + a * .6), 0, TAU); ctx.fill(); }
  for (let k = FLOAT.length - 1; k >= 0; k--) { const f = FLOAT[k]; f.t += dt; if (f.t > 1.1) { FLOAT.splice(k, 1); continue; } const a = 1 - f.t / 1.1, e = 1 - Math.pow(1 - Math.min(1, f.t * 3), 3); ctx.globalAlpha = a; ctx.font = `800 ${f.s * (.8 + e * .3)}px Sora, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = f.s * .12; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(f.txt, f.x, f.y - f.t * f.s * 2); ctx.fillStyle = f.col; ctx.fillText(f.txt, f.x, f.y - f.t * f.s * 2); }
  ctx.globalAlpha = 1;
  // screen-space: vignette + flash
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.drawImage(vign, 0, 0, W, H);
  if (G.flash > 0) { ctx.fillStyle = `rgba(200,255,240,${G.flash * .35})`; ctx.fillRect(0, 0, W, H); G.flash = Math.max(0, G.flash - dt * 1.8); }
  if (G.warn > 0) { const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .7); g.addColorStop(0, 'rgba(255,40,60,0)'); g.addColorStop(1, `rgba(255,40,60,${G.warn * .28})`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  return own;
}
function drawVirus(v, s) {
  const n = 34, rot = G.t * .15 + v.id, sp = v.r * .075;
  ctx.beginPath(); for (let k = 0; k <= n * 2; k++) { const a = k / (n * 2) * TAU + rot, r = v.r + (k % 2 ? -sp : sp); ctx.lineTo(v.x + Math.cos(a) * r, v.y + Math.sin(a) * r); } ctx.closePath();
  const g = ctx.createRadialGradient(v.x - v.r * .3, v.y - v.r * .35, v.r * .1, v.x, v.y, v.r * 1.05); g.addColorStop(0, '#7dffa0'); g.addColorStop(.55, '#33c763'); g.addColorStop(1, '#16733a'); ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = Math.max(2 / s, v.r * .05); ctx.strokeStyle = '#0f5a2c'; ctx.stroke();
  ctx.fillStyle = 'rgba(10,70,35,.35)'; for (let k = 0; k < 7; k++) { const a = k * 2.4 + v.id, d = v.r * (.2 + (k % 3) * .18); ctx.beginPath(); ctx.arc(v.x + Math.cos(a) * d, v.y + Math.sin(a) * d, v.r * .09, 0, TAU); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.ellipse(v.x - v.r * .35, v.y - v.r * .42, v.r * .28, v.r * .14, -.6, 0, TAU); ctx.fill();
}
function drawCell(c, F, near, dt, s, q) {
  const own = F.owner(c.o), si = own.skin % SKINS.length, sk = SKINS[si], m = membrane(c.id, c.r * s * 3, q), n = m.n, r = c.r; m.seen = 0;
  // membrane: points spring back to the circle but are pushed in by neighbours and the dish wall
  const t = G.t, pts = [];
  for (let k = 0; k < n; k++) {
    const a = k / n * TAU, ca = Math.cos(a), sa = Math.sin(a); let tgt = 1 + Math.sin(t * 2.2 + k * .9 + m.ph) * .012 + Math.sin(t * 1.3 + k * 2.1) * .008;
    const px = c.x + ca * r, py = c.y + sa * r;
    for (const o of near) { if (o === c) continue; const dx = px - o.x, dy = py - o.y, d2 = dx * dx + dy * dy; if (d2 < o.r * o.r && o.r < r * 3.5) { const d = Math.sqrt(d2), push = (o.r - d) / r; tgt = Math.min(tgt, 1 - push * .55); } }
    if (px < 0) tgt = Math.min(tgt, 1 - (-px) / r); if (px > WORLD) tgt = Math.min(tgt, 1 - (px - WORLD) / r); if (py < 0) tgt = Math.min(tgt, 1 - (-py) / r); if (py > WORLD) tgt = Math.min(tgt, 1 - (py - WORLD) / r);
    tgt = Math.max(tgt, .72); m.v[k] += (tgt - m.d[k]) * .26; m.v[k] *= .72; m.d[k] += m.v[k];
  }
  for (let k = 0; k < n; k++) { const a = k / n * TAU, d = (m.d[k] * 2 + m.d[(k + 1) % n] + m.d[(k + n - 1) % n]) / 4; pts.push(c.x + Math.cos(a) * r * d, c.y + Math.sin(a) * r * d); }
  const path = () => { ctx.beginPath(); ctx.moveTo((pts[0] + pts[2 * n - 2]) / 2, (pts[1] + pts[2 * n - 1]) / 2); for (let k = 0; k < n; k++) { const x = pts[2 * k], y = pts[2 * k + 1], nx = pts[(2 * k + 2) % (2 * n)], ny = pts[(2 * k + 3) % (2 * n)]; ctx.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2); } ctx.closePath(); };
  // soft glow under the player's own cells
  if (c.own && q) { const g = ctx.createRadialGradient(c.x, c.y, r * .8, c.x, c.y, r * 1.35); g.addColorStop(0, sk[1] + '33'); g.addColorStop(1, sk[1] + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, r * 1.35, 0, TAU); ctx.fill(); }
  path();
  const g = ctx.createRadialGradient(c.x - r * .35, c.y - r * .4, r * .05, c.x, c.y, r * 1.02); g.addColorStop(0, sk[1]); g.addColorStop(.75, sk[2]); g.addColorStop(1, shade(sk[2], -.35)); ctx.fillStyle = g; ctx.fill();
  if (q && r * s > 9) {
    ctx.save(); path(); ctx.clip();
    const rot = c.id * .7 + G.t * .05; ctx.translate(c.x, c.y); ctx.rotate(rot); ctx.drawImage(skinArt(si), -r, -r, r * 2, r * 2); ctx.rotate(-rot); ctx.translate(-c.x, -c.y);
    // organelles drifting inside
    if (r * s > 22) { ctx.fillStyle = 'rgba(255,255,255,.08)'; for (let k = 0; k < 4; k++) { const a = c.id * 1.7 + k * 1.6 + G.t * (.12 + k * .03), d = r * (.25 + .12 * k); ctx.beginPath(); ctx.ellipse(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d, r * (.11 - k * .015), r * (.07 - k * .01), a, 0, TAU); ctx.fill(); } ctx.fillStyle = shade(sk[2], -.25) + '66'; ctx.beginPath(); ctx.arc(c.x + Math.cos(c.id + G.t * .1) * r * .12, c.y + Math.sin(c.id * 1.3 + G.t * .1) * r * .12, r * .2, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  path(); ctx.lineWidth = clamp(r * .07, 2.5, 26); ctx.strokeStyle = own.team >= 0 ? TEAMC[own.team] : shade(sk[2], -.45); ctx.stroke();
  ctx.lineWidth = clamp(r * .025, 1, 8); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.ellipse(c.x - r * .34, c.y - r * .42, r * .3, r * .15, -.6, 0, TAU); ctx.fill();
  // just ate something: quick bright rim
  if (c.eatT && G.sim && G.sim.t - c.eatT < .25) { ctx.lineWidth = clamp(r * .05, 2, 18); ctx.strokeStyle = `rgba(255,255,255,${(.25 - (G.sim.t - c.eatT)) * 2})`; path(); ctx.stroke(); }
  // name + mass
  const fs = r * .34;
  if (fs * s > 4.5 && own.name) {
    ctx.font = `700 ${fs}px Sora, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = fs * .14; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.strokeText(own.name, c.x, c.y); ctx.fillStyle = own.team >= 0 ? shade(TEAMC[own.team], .55) : '#fff'; ctx.fillText(own.name, c.x, c.y);
    if (save.set.mass && (c.own || r > 60)) { const f2 = fs * .55; ctx.font = `600 ${f2}px Sora, system-ui, sans-serif`; ctx.lineWidth = f2 * .14; ctx.strokeText(Math.round(c.m), c.x, c.y + fs * .78); ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fillText(Math.round(c.m), c.x, c.y + fs * .78); }
  }
}
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } return '#' + ((1 << 24) | (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b)).toString(16).slice(1); }

// ---------------- HUD ----------------
const mm = $('mini'), mx = mm.getContext('2d');
let hudT = 0, lastLb = '';
function hud(F, own, dt) {
  hudT -= dt; if (hudT > 0) return; hudT = .1;
  const you = curYou(); G.you = you;
  if (you && G.state !== 'menu') {
    $('mass').textContent = (you.alive ? you.mass : 0).toLocaleString(); $('rank').textContent = you.alive && you.rank ? '#' + you.rank + ' of ' + you.alive_n : '';
    if (you.alive && you.rank && you.rank < (G.lastRank || 99) && you.rank <= 3 && G.state === 'play') { toast(you.rank === 1 ? 'You’re #1 in the arena!' : 'Top ' + you.rank + '!', 2, 'good'); AU.tone && AU.c && AU.tone(784, .3, 'triangle', .1, 1046); }
    if (you.alive) G.lastRank = you.rank;
    if (G.state === 'play' && you.alive) missionTick(you, false);
    if (G.daily && !G.daily.done) { const left = dailyLeft(), el = $('dTimer'); el.classList.remove('hide'); el.textContent = Math.floor(left / 60) + ':' + String(Math.floor(left % 60)).padStart(2, '0'); el.classList.toggle('low', left < 20);
      if (left <= 0 && G.state === 'play') { G.alive = false; G.state = 'dead'; G.paused = true; AU.level(); G.flash = .3; finishLife(you, '__time'); } }
    else $('dTimer').classList.add('hide');
    AU.energy = clamp(Math.log10(Math.max(10, you.mass)) - 1.2, 0, 1) * .8 + (G.warn > .3 ? .2 : 0);
  }
  // leaderboard
  const s = (F.lb || []).map(([i, m], k) => { const o = F.owner(i); return `<li class="${i === F.me ? 'me' : ''}"><span>${k + 1}</span><b${o.team >= 0 ? ` style="color:${TEAMC[o.team]}"` : ''}>${esc(o.name || 'cell')}</b><em>${m.toLocaleString()}</em></li>`; }).join('');
  modeHud(F, you);
  if (s !== lastLb) { $('lbL').innerHTML = s; lastLb = s; }
  // minimap
  const W = mm.width, k = W / WORLD; mx.clearRect(0, 0, W, W); mx.fillStyle = 'rgba(8,24,32,.7)'; mx.fillRect(0, 0, W, W); mx.strokeStyle = 'rgba(94,230,200,.18)'; mx.lineWidth = 1; for (let i = 1; i < 4; i++) { mx.beginPath(); mx.moveTo(i * W / 4, 0); mx.lineTo(i * W / 4, W); mx.moveTo(0, i * W / 4); mx.lineTo(W, i * W / 4); mx.stroke(); }
  if (F.bloom) { mx.fillStyle = `rgba(255,240,122,${.5 + Math.sin(G.t * 6) * .3})`; mx.beginPath(); mx.arc(F.bloom.x * k, F.bloom.y * k, 7, 0, TAU); mx.fill(); }
  if (F.mi && F.mi.mode === 'royale') { mx.strokeStyle = 'rgba(255,110,130,.9)'; mx.lineWidth = 1.5; mx.beginPath(); mx.arc(F.mi.cx * k, F.mi.cy * k, F.mi.r * k, 0, TAU); mx.stroke(); }
  mx.strokeStyle = 'rgba(255,255,255,.4)'; const s2 = G.cam.z * G.base; mx.strokeRect((G.cam.x - G.W / 2 / s2) * k, (G.cam.y - G.H / 2 / s2) * k, G.W / s2 * k, G.H / s2 * k);
  for (const c of own) { mx.fillStyle = '#fff'; mx.beginPath(); mx.arc(c.x * k, c.y * k, Math.max(2.5, c.r * k), 0, TAU); mx.fill(); }
}
let lastMb = '';
function modeHud(F, you) {
  const mi = F.mi || { mode: 'ffa' }, el = $('modeBar'); let h = '';
  if (G.state === 'menu' || G.mode === 'attract') h = '';
  else if (mi.mode === 'teams') { const tot = mi.tm.reduce((a, b) => a + b, 0) || 1, my = F.owner(F.me).team; h = mi.tm.map((m, t) => `<div class="tm${t === my ? ' mine' : ''}"><span style="background:${TEAMC[t]}"></span><b>${TEAMN[t]}</b><em>${Math.round(m / tot * 100)}%</em><i style="width:${m / tot * 100}%;background:${TEAMC[t]}"></i></div>`).join(''); }
  else if (mi.mode === 'royale') {
    const t = Math.ceil(mi.left), mm = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
    if (mi.ph === 2) h = `<div class="rb win"><b>${mi.winner ? esc(mi.winner) + ' wins the round!' : 'Round over'}</b><em>Next round in ${t}s</em></div>`;
    else h = `<div class="rb"><b>${mi.alive} alive</b><em>${mi.closing === 0 ? 'Ring starts closing in ' + mm : mi.closing === 1 ? 'Ring closing · ' + mm : 'Final ring · ' + mm}</em>${you && !you.alive ? `<small>${mi.join ? 'Joining now…' : 'You’ll join the next round'}</small>` : ''}</div>`;
  }
  if (h !== lastMb) { el.innerHTML = h; lastMb = h; el.classList.toggle('hide', !h); }
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let toastQ = [];
function toast(msg, sec, kind) { const el = document.createElement('div'); el.className = 'toast ' + (kind || ''); el.textContent = msg; $('toasts').appendChild(el); setTimeout(() => el.classList.add('out'), (sec || 2.5) * 1000); setTimeout(() => el.remove(), (sec || 2.5) * 1000 + 500); while ($('toasts').children.length > 4) $('toasts').firstChild.remove(); }
function feedAdd(line) { const [a, b] = line.split('~'); const el = document.createElement('div'); el.innerHTML = `<b>${esc(a)}</b> ate <b>${esc(b)}</b>`; $('feed').prepend(el); while ($('feed').children.length > 4) $('feed').lastChild.remove(); setTimeout(() => el.classList.add('out'), 6000); setTimeout(() => el.remove(), 6600); }

// =====================================================================================
//  MAIN LOOP
// =====================================================================================
let simHidden = 0;
function update(sdt, realDt) {
  // input -> world
  const tgt = aimTarget();
  if (G.sim) {
    if (G.me) { G.me.inp.tx = tgt.x; G.me.inp.ty = tgt.y; G.me.inp.ej = G.ejHeld && G.state === 'play' && !G.paused ? 1 : 0; }
    if (!(G.mode === 'solo' && G.paused)) { G.acc += sdt; let n = 0; while (G.acc >= DT && n < 8) { G.sim.step(DT); G.acc -= DT; n++; } if (n === 8) G.acc = 0; }
    if (G.me) { const ev = G.me.ev.splice(0); handleEvents(ev); }
    if (G.sim.feed.length && G.sim.feed[G.sim.feed.length - 1].t !== G.feedSeen) { const nf = G.sim.feed.filter(f => f.t > (G.feedSeen || 0)); G.feedSeen = G.sim.feed[G.sim.feed.length - 1].t; if (G.mode !== 'attract') nf.forEach(f => feedAdd(f.s)); }
    const fx = G.sim.fx; for (let k = 0; k < fx.length; k += 3) sparkle(fx[k], fx[k + 1], fx[k + 2]); fx.length = 0;
    if (G.mode === 'host') hostSend(realDt);
    if (G.mode === 'attract' && G.sim) G.sim.owners.forEach(o => o.ev.length = 0);
    else if (G.sim) for (const o of G.sim.owners) if (o.bot) o.ev.length = 0;
  } else if (G.cl) {
    predict(realDt);
    const C = G.cl;
    if (C.events.length) handleEvents(C.events.splice(0));
    if (C.feed.length) C.feed.splice(0).forEach(feedAdd);
    if (C.needPf && !C.pfBusy) { C.pfBusy = true; NET.getPellets().then(s => { C.applyPf(s); C.pfBusy = false; }); }
    // send input ~15/s
    G.inT -= realDt;
    if (G.inT <= 0 && NET.on) {
      G.inT = 1 / 20; const s = G.cam.z * G.base, hw = Math.round(G.W / 2 / s + 120), hh = Math.round(G.H / 2 / s + 120);
      const pos = [...C.pred.entries()].map(([id, p]) => id + ':' + Math.round(p.x) + ':' + Math.round(p.y)).join(';');
      const str = [Math.round(tgt.x), Math.round(tgt.y), G.split, G.ejHeld && G.state === 'play' && !G.paused ? 1 : 0, G.rs, hw, hh, pos].join(',');
      if (str !== G.lastIn) { G.lastIn = str; NET.input(str); }
    }
    if (G.state === 'play' && C.you && C.you.alive) G.awaitSpawn = 0;
    if (G.state === 'dead' && C.you && C.you.alive && C.mi.mode === 'royale') handleEvents(['N']);
    if (C.changed.length < 60) for (const i of C.changed) { pelletPos(C.seed, i, (C.pg[i] + GEN - 1) % GEN, C.bloom, _pp); if (_pp.on) sparkle(_pp.x, _pp.y, _pp.c); }
    C.changed.length = 0;
  }
  // danger warning: something big and hungry is close
  G.warn = Math.max(0, G.warn - realDt * 2);
  const you = G.you; if (you && you.alive && G.state === 'play') { const F = lastNear(); if (F) { G.warn = Math.min(1, G.warn + realDt * 4); AU.danger(); } }
  if (you) { if (you.pel < (G.lastPel || 0)) G.lastPel = 0; if (you.pel > (G.lastPel || 0) && G.state === 'play') { if (G.t - (G.pelT || 0) > .7) G.pelCombo = 0; G.pelT = G.t; AU.pellet(G.pelCombo++); } G.lastPel = you.pel; }
}
function lastNear() {
  // is a cell that could eat one of mine within striking distance?
  const F = G._lastF; if (!F) return false;
  const own = F.cells.filter(c => c.own); if (!own.length) return false; const mn = own.reduce((a, c) => Math.min(a, c.m), 1e9);
  const myT = F.owner(F.me).team;
  for (const c of F.cells) { if (c.own || c.m < mn * 1.3 || (myT >= 0 && F.owner(c.o).team === myT)) continue; for (const o of own) { const d = Math.hypot(c.x - o.x, c.y - o.y) - c.r - o.r; if (d < 90 + (c.m > o.m * 2.6 ? 280 : 0)) return true; } }
  return false;
}
function hostSend(dt) {
  const S = G.sim; S.sendT += dt; S.pfT += dt;
  if (S.rosterDirty) { S.rosterDirty = false; NET.setRoster(S.roster()); }
  if (S.pfT > 3) { S.pfT = 0; NET.putPellets(S.pfString()); }
  if (S.sendT < SEND) return; S.sendT = 0;
  const pd = S.pd.splice(0).map(i => b36(i) + '.' + b36(S.pg[i])).join(';'); S.q = (S.q || 0) + 1;
  const out = {};
  for (const o of S.owners) if (!o.gone && !o.bot && o.uid !== NET.me) out[o.uid] = S.viewFor(o, pd, S.q);
  if (Object.keys(out).length) NET.sendViews(out);
}
// keep the arena running if the host switches tabs (timers in hidden tabs are throttled, a worker's aren't)
try {
  const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),40)'], { type: 'text/javascript' })));
  wk.onmessage = () => { if (document.hidden && G.mode === 'host' && G.sim) { const now = performance.now(), dt = Math.min(.25, (now - (simHidden || now)) / 1000); simHidden = now; G.sim.acc = 0; let a = dt; while (a >= DT) { G.sim.step(DT); a -= DT; } if (G.me) G.me.ev.length = 0; hostSend(dt); } else simHidden = performance.now(); };
} catch (e) { }




// =====================================================================================
//  MENUS
// =====================================================================================
function openOv(id) { closeOverlays(); $(id).classList.remove('hide'); AU.click(); }
function closeOverlays() { for (const id of ['howOv', 'setOv', 'skinOv', 'joinOv', 'recOv']) $(id).classList.add('hide'); }
function showBusy(t) { $('busyT').textContent = t; $('busy').classList.remove('hide'); }
function hideBusy() { $('busy').classList.add('hide'); }
function refreshTitle() {
  { const b = $('bTour'); if (b && window.GBTour) { const m = GBTour.myBest('mitosis'); b.innerHTML = '<b>🏆 Weekly tournament</b><small>One arena all week, best run counts · ' + (m ? 'your best ' + m.toLocaleString() + ' · ' : '') + 'ends in ' + GBTour.left() + '</small>'; } }
  { const d = save.daily, done = d.day === TODAY, b = $('bDaily'); if (b) b.innerHTML = '<b>Daily Arena #' + TODAY + (done ? ' · ' + (d.score || 0).toLocaleString() + ' mass' : '') + '</b><small>Same map and bots for everyone · 3 minutes, one life' + (d.streak ? ' · 🔥 ' + d.streak + '-day streak' : '') + '</small>'; }
  $('nm').value = save.name || ''; const L = levelOf(save.xp), cur = save.xp - lvlNeed(L), need = lvlNeed(L + 1) - lvlNeed(L);
  $('lvl').textContent = 'Level ' + L; $('lvlBar').style.width = Math.round(cur / need * 100) + '%'; $('lvlXp').textContent = cur + ' / ' + need + ' XP';
  drawSkinPrev($('skinPrev'), save.skin); $('skinName').textContent = SKINS[save.skin][0];
  renderMissions($('tMis'));
  document.querySelectorAll('#modes button').forEach(b => b.classList.toggle('sel', b.dataset.m === (save.mode || 'ffa'))); $('modeD').textContent = MODES[save.mode || 'ffa'][1];
  loadHof();
}
let hofT = 0, hof = [];
function loadHof(force) {
  if (!force && performance.now() - hofT < 30000 && hofT) return renderHof(); hofT = performance.now();
  NET.hofGet().then(v => { hof = Object.values(v || {}).filter(e => e && e.n && e.m > 0).map(e => ({ n: clean(e.n), m: Math.min(MAXT, Math.round(e.m)), md: e.md })).sort((a, b) => b.m - a.m).slice(0, 25); renderHof(); }).catch(() => { });
}
function renderHof() {
  const row = (e, i) => `<li><span>${i + 1}</span><b>${esc(e.n)}</b><small>${esc(e.md === 'solo' ? 'solo' : (MODES[e.md] || MODES.ffa)[0])}</small><em>${e.m.toLocaleString()}</em></li>`;
  $('hofL').innerHTML = hof.length ? hof.slice(0, 6).map(row).join('') : '<li class="none">No records yet. Be the first!</li>';
  $('hofAll').innerHTML = hof.length ? hof.map(row).join('') : '<li class="none">No records yet.</li>';
}
function drawSkinPrev(c, i) {
  const g = c.getContext('2d'), S = c.width, r = S * .4, sk = SKINS[i]; g.clearRect(0, 0, S, S);
  const gr = g.createRadialGradient(S / 2 - r * .35, S / 2 - r * .4, r * .05, S / 2, S / 2, r); gr.addColorStop(0, sk[1]); gr.addColorStop(.75, sk[2]); gr.addColorStop(1, shade(sk[2], -.35));
  g.save(); g.beginPath(); g.arc(S / 2, S / 2, r, 0, TAU); g.fillStyle = gr; g.fill(); g.clip(); g.drawImage(skinArt(i), S / 2 - r, S / 2 - r, r * 2, r * 2); g.restore();
  g.beginPath(); g.arc(S / 2, S / 2, r, 0, TAU); g.lineWidth = S * .04; g.strokeStyle = shade(sk[2], -.45); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.ellipse(S / 2 - r * .34, S / 2 - r * .42, r * .3, r * .15, -.6, 0, TAU); g.fill();
}
function buildSkins() {
  const L = levelOf(save.xp);
  $('skinGrid').innerHTML = SKINS.map((s, i) => `<button class="sk${i === save.skin ? ' sel' : ''}${L >= skinLevel(i) ? '' : ' lock'}" data-i="${i}"><canvas width="96" height="96"></canvas><span>${s[0]}</span>${L >= skinLevel(i) ? '' : `<em>Level ${skinLevel(i)}</em>`}</button>`).join('');
  $('skinGrid').querySelectorAll('.sk').forEach(b => { drawSkinPrev(b.querySelector('canvas'), +b.dataset.i); b.onclick = () => { const i = +b.dataset.i; if (levelOf(save.xp) < skinLevel(i)) { AU.click(); return; } save.skin = i; store(); AU.click(); buildSkins(); refreshTitle(); if (NET.on) NET.setSkin(playerName(), i); if (G.me) { G.me.skin = i; if (G.sim) G.sim.rosterDirty = true; } }; });
}
function buildSettings() {
  const s = save.set;
  $('sVol').value = s.vol; $('sMus').value = s.mus; $('sSfx').value = s.sfx; $('sMute').checked = !!s.mute; $('sShake').checked = !!s.shake; $('sQ').checked = !!s.q; $('sMass').checked = !!s.mass;
}
['sVol', 'sMus', 'sSfx'].forEach((id, k) => $(id).addEventListener('input', e => { save.set[['vol', 'mus', 'sfx'][k]] = +e.target.value; AU.apply(); store(); }));
[['sMute', 'mute'], ['sShake', 'shake'], ['sQ', 'q'], ['sMass', 'mass']].forEach(([id, k]) => $(id).addEventListener('change', e => { save.set[k] = e.target.checked ? 1 : 0; AU.apply(); store(); if (k === 'q') resize(); }));
function buildRecords() {
  const r = save.rec, mm = Math.floor(r.life / 60), ss = r.life % 60;
  $('recL').innerHTML = [['Biggest mass', r.mass.toLocaleString()], ['Most cells eaten in one life', r.cells], ['Longest life', mm + ':' + String(ss).padStart(2, '0')], ['Times finishing #1', r.top], ['Battle Royale wins', r.wins || 0], ['Arenas played', r.games], ['Total XP', save.xp.toLocaleString()]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
}
const on = (id, f) => $(id).addEventListener('click', e => { AU.init(); f(e); });
on('bPlay', () => goOnline('quick'));
document.querySelectorAll('#modes button').forEach(b => b.addEventListener('click', () => { AU.init(); AU.click(); save.mode = b.dataset.m; store(); refreshTitle(); }));
on('bPriv', () => goOnline('private'));
on('bJoin', () => { $('jErr').textContent = ''; openOv('joinOv'); setTimeout(() => $('jCode').focus(), 50); });
on('jGo', () => { const c = $('jCode').value.trim().toUpperCase(); if (c.length !== 4) { $('jErr').textContent = 'Codes are 4 letters.'; return; } closeOverlays(); goOnline('join', c); });
$('jCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('jGo').click(); });
on('bDaily', () => { save.name = clean($('nm').value); store(); startDaily(); });
if ($('bTour')) on('bTour', () => { save.name = clean($('nm').value); store(); startTour(); });
on('bSolo', () => { save.name = clean($('nm').value); store(); startSolo(); });
on('bHow', () => openOv('howOv'));
on('bSet', () => { buildSettings(); openOv('setOv'); });
on('bSkins', () => { buildSkins(); openOv('skinOv'); });
on('skinPrevB', () => { buildSkins(); openOv('skinOv'); });
on('bRec', () => { buildRecords(); loadHof(true); openOv('recOv'); });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { AU.click(); closeOverlays(); }));
on('dAgain', () => respawn());
on('dMenu', () => toMenu());
on('pResume', () => togglePause());
on('pSet', () => { buildSettings(); openOv('setOv'); });
on('pMenu', () => { $('pause').classList.add('hide'); G.paused = false; G.state = 'play'; toMenu(); });
on('roomCopy', () => { const l = NET.invite(); try { navigator.clipboard.writeText(l); toast('Invite link copied. Send it to your friends.', 2.5); } catch (e) { toast('Code: ' + NET.code, 3); } });
on('bPauseT', () => { if (G.state === 'play' || G.state === 'pause') togglePause(); });
$('nm').addEventListener('change', () => { save.name = clean($('nm').value); store(); });
$('nm').addEventListener('keydown', e => { if (e.key === 'Enter') $('bPlay').click(); });

// patch frameData so the danger check can see what's on screen
const _frame = frameData;
function frameData2() { const F = _frame(); G._lastF = F; return F; }

// boot
resize(); refreshTitle(); startAttract();
if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
const qRoom = (location.search.match(/[?&]room=([A-Za-z]{4})/) || [])[1];
if (qRoom) { $('jCode').value = qRoom.toUpperCase(); setTimeout(() => { $('jErr').textContent = 'A friend invited you. Pick a name, then join.'; openOv('joinOv'); }, 300); }
// main loop uses the patched frame function
(function loop() {
  let lastT = performance.now();
  function f(now) {
    const dt = Math.min(.1, (now - lastT) / 1000); lastT = now; G.t += dt;
    let sdt = dt; if (G.hit > 0) { G.hit -= dt; if (G.mode === 'solo') sdt = dt * .15; }
    try { update(sdt, dt); const F = frameData2(); const own = draw(F, dt); hud(F, own, dt); } catch (e) { console.error(e); }
    requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
})();
})();
try{if(/[?&](daily|tour)/.test(location.search)){const b=document.getElementById(/tour/.test(location.search)?'bTour':'bDaily');if(b){b.classList.add('pulse');b.scrollIntoView({block:'center'})}}}catch(e){}

