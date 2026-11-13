'use strict';
(function () {
// =====================================================================
//  STORMFALL — top-down battle royale
// =====================================================================

// ---------- utils ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const d2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
const angDiff = (a, b) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rng = Math.random;
const rand = (a, b) => a + (b - a) * rng();
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(rng() * arr.length)];
const fr = (a, b) => a + (b - a) * Math.random();
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const $ = id => document.getElementById(id);

// ---------- storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('stormfall_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('stormfall_' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
const settings = Object.assign({ master: 0.8, music: 0.5, sfx: 0.9, mute: false, shake: true, quality: 'high', fps: false, difficulty: 1 }, store.get('settings', {}));
const profile = Object.assign({ xp: 0, wins: 0, games: 0, kills: 0, bestPlace: 0, mostKills: 0, skin: 0, damage: 0, top5: 0 }, store.get('profile', {}));
const saveSettings = () => store.set('settings', settings);
const saveProfile = () => store.set('profile', profile);
const XP_PER_LEVEL = 1000;
const levelOf = xp => 1 + Math.floor(xp / XP_PER_LEVEL);

// ---------- data ----------
const RAR = [
  { n: 'Common', c: '#9aa0a6', d: '#4b5056' }, { n: 'Uncommon', c: '#4caf50', d: '#1f5a24' },
  { n: 'Rare', c: '#3d8bfd', d: '#123f86' }, { n: 'Epic', c: '#a855f7', d: '#4c1d95' },
  { n: 'Legendary', c: '#f59e0b', d: '#8a4b04' }];
const DMGMUL = [1, 1.07, 1.14, 1.22, 1.3];
const RELMUL = [1, 0.95, 0.9, 0.85, 0.78];
const WEAPONS = {
  pistol: { name: 'Pistol', ammo: 'light', dmg: 23, rate: 6, mag: 16, reload: 1.3, spread: 0.04, bloomAdd: 0.025, bloomMax: 0.08, speed: 1900, range: 900, pellets: 1, muzzle: 22, shake: 1.2, kick: 2, w: 24, score: 1 },
  smg: { name: 'SMG', ammo: 'light', dmg: 15, rate: 12, mag: 30, reload: 2.0, spread: 0.07, bloomAdd: 0.01, bloomMax: 0.09, speed: 1900, range: 760, pellets: 1, muzzle: 30, shake: 1, kick: 1.5, w: 20, score: 2.2 },
  ar: { name: 'Assault Rifle', ammo: 'medium', dmg: 30, rate: 5.5, mag: 30, reload: 2.2, spread: 0.028, bloomAdd: 0.014, bloomMax: 0.09, speed: 2300, range: 1300, pellets: 1, muzzle: 42, shake: 1.8, kick: 2.5, w: 24, score: 3 },
  shotgun: { name: 'Pump Shotgun', ammo: 'shells', dmg: 11, rate: 1.05, mag: 5, reload: 0.55, perShell: true, spread: 0.17, bloomAdd: 0, bloomMax: 0, speed: 1700, range: 470, pellets: 9, muzzle: 40, shake: 5, kick: 7, w: 17, score: 2.8 },
  sniper: { name: 'Bolt Sniper', ammo: 'heavy', dmg: 105, rate: 0.62, mag: 1, reload: 2.5, spread: 0.003, bloomAdd: 0, bloomMax: 0, speed: 3800, range: 2600, pellets: 1, muzzle: 52, shake: 6, kick: 9, scope: true, w: 7, score: 2.6 },
};
const WIDS = Object.keys(WEAPONS);
const HEALS = {
  bandage: { name: 'Bandages', time: 3, hp: 15, cap: 75, max: 15, pick: 5 },
  medkit: { name: 'Med Kit', time: 7, hp: 100, cap: 100, max: 3, pick: 1 },
  shieldS: { name: 'Small Shield', time: 2, sh: 25, cap: 50, max: 6, pick: 3 },
  shieldB: { name: 'Shield Potion', time: 4, sh: 50, cap: 100, max: 3, pick: 1 },
};
const FRAG_MAX = 6;
const AMMO = {
  light: { name: 'Light Ammo', c: '#d9c47a', pick: 36, max: 360 },
  medium: { name: 'Medium Ammo', c: '#7fb3d5', pick: 30, max: 360 },
  shells: { name: 'Shells', c: '#e07a5f', pick: 10, max: 60 },
  heavy: { name: 'Heavy Ammo', c: '#c48b9f', pick: 6, max: 40 },
};
const SKINS = [
  { name: 'Ranger', lvl: 1, shirt: '#56653d', sleeve: '#4a5734', pack: '#3b3a2c', helmet: '#4f5c38', tone: '#c99a74' },
  { name: 'Desert', lvl: 1, shirt: '#b39a6b', sleeve: '#9f875a', pack: '#6e5a3c', helmet: '#a48b5f', tone: '#8d5f43' },
  { name: 'Arctic', lvl: 2, shirt: '#d9dfe4', sleeve: '#bcc5cc', pack: '#7d8891', helmet: '#e8edf0', tone: '#e0b393' },
  { name: 'Night Ops', lvl: 3, shirt: '#2a2f38', sleeve: '#22262d', pack: '#16191e', helmet: '#1d2128', tone: '#a87556' },
  { name: 'Urban', lvl: 5, shirt: '#6c7279', sleeve: '#585d63', pack: '#383b40', helmet: '#4a4f55', tone: '#d1a183' },
  { name: 'Crimson', lvl: 7, shirt: '#7c2a2a', sleeve: '#652222', pack: '#2f1d1d', helmet: '#3a2020', tone: '#c08a6a' },
  { name: 'Jungle', lvl: 9, shirt: '#2f5a3a', sleeve: '#26492f', pack: '#4a3b22', helmet: '#35603f', tone: '#6f4a35' },
  { name: 'Gold Elite', lvl: 12, shirt: '#2b2b2b', sleeve: '#222', pack: '#111', helmet: '#c89b2c', tone: '#d7a77f' },
];
const BOT_NAMES = ['Vexx', 'KiloRaven', 'Mako_7', 'Blitz', 'Nyx', 'Havoc21', 'ShadeRunner', 'Juno', 'Crux', 'Talon', 'Echo_9', 'Rook', 'Valkyr', 'Drift', 'Sable', 'Onyx', 'Wraith', 'Brick', 'Kestrel', 'Ghost_12', 'Riot', 'Nova', 'Fang', 'Ash', 'Viper', 'Stryker', 'Hex', 'Quill', 'Bolt', 'Moth', 'Raze', 'Cinder', 'Tundra', 'Lynx', 'Pike', 'Orca', 'Dusk'];
const POI_NAMES = ['Harbor Mills', 'Pine Hollow', 'Ashford', 'Redstone Quarry', 'Kestrel Point', 'Fallow Ridge', 'Old Depot', 'Larkspur', 'Coldwater', 'Millbrook', 'Grayfield'];
const DIFF = [
  { name: 'Recruit', sight: 640, react: 0.7, turn: 5, err: 0.34, minErr: 0.12, pause: [0.5, 1.1], dmgVsPlayer: 0.55, heal: 0.6 },
  { name: 'Veteran', sight: 800, react: 0.42, turn: 8, err: 0.25, minErr: 0.07, pause: [0.3, 0.75], dmgVsPlayer: 0.68, heal: 0.8 },
  { name: 'Elite', sight: 950, react: 0.28, turn: 12, err: 0.18, minErr: 0.05, pause: [0.2, 0.5], dmgVsPlayer: 0.85, heal: 1 },
];
const PHASES = [
  { wait: 72, shrink: 45, nr: 1500, dps: 1 }, { wait: 45, shrink: 35, nr: 900, dps: 2 },
  { wait: 40, shrink: 30, nr: 520, dps: 4 }, { wait: 30, shrink: 25, nr: 280, dps: 7 },
  { wait: 25, shrink: 20, nr: 130, dps: 10 }, { wait: 20, shrink: 25, nr: 0, dps: 14 }];
const WORLD = 4800;
const STEP = 1 / 60;
const NPLAYERS = 30;

// ---------- canvas ----------
const cv = $('game'), ctx = cv.getContext('2d');
const fogCv = document.createElement('canvas'), fogCtx = fogCv.getContext('2d');
let W = 0, H = 0, DPR = 1, FOGS = 0.5;
function resize() {
  DPR = settings.quality === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  fogCv.width = Math.max(1, Math.round(W * FOGS)); fogCv.height = Math.max(1, Math.round(H * FOGS));
}
window.addEventListener('resize', resize);
resize();

// =====================================================================
//  AUDIO (all synthesized)
// =====================================================================
const GUNSND = {
  pistol: { dur: 0.13, cut: 5200, nv: 0.55, f0: 190, f1: 60, td: 0.1, tv: 0.5 },
  smg: { dur: 0.09, cut: 4600, nv: 0.42, f0: 170, f1: 70, td: 0.07, tv: 0.35 },
  ar: { dur: 0.18, cut: 6200, nv: 0.62, f0: 140, f1: 45, td: 0.14, tv: 0.6 },
  shotgun: { dur: 0.38, cut: 3600, nv: 0.85, f0: 110, f1: 32, td: 0.3, tv: 0.95 },
  sniper: { dur: 0.7, cut: 7500, nv: 0.95, f0: 95, f1: 28, td: 0.45, tv: 1 },
};
const AU = {
  ctx: null, ready: false, loops: {},
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -14; this.comp.ratio.value = 4;
    this.master.connect(this.comp); this.comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.connect(this.master);
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
    this.ready = true; this.applyVol(); this.startLoops(); Music.start();
  },
  applyVol() {
    if (!this.ready) return;
    this.master.gain.value = settings.mute ? 0 : settings.master;
    this.sfx.gain.value = settings.sfx; this.mus.gain.value = settings.music * 0.5;
  },
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); },
  nsrc(t, dur) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.start(t, Math.random() * 1.4, dur + 0.05); return s; },
  out(vol, pan) {
    const c = this.ctx, g = c.createGain(); g.gain.value = vol;
    if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); g.connect(p); p.connect(this.sfx); } else g.connect(this.sfx);
    return g;
  },
  tone(f, dur, type = 'sine', vol = 0.3, delay = 0, slide = 0, pan = 0) {
    if (!this.ready) return; const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    const g = c.createGain(); this.env(g, t, 0.005, vol, dur); o.connect(g); g.connect(this.out(1, pan)); o.start(t); o.stop(t + dur + 0.05);
  },
  noiseHit(dur, cut, vol, delay = 0, pan = 0, type = 'lowpass', q = 0.7) {
    if (!this.ready) return; const c = this.ctx, t = c.currentTime + delay;
    const n = this.nsrc(t, dur), f = c.createBiquadFilter(); f.type = type; f.frequency.value = cut; f.Q.value = q;
    const g = c.createGain(); this.env(g, t, 0.003, vol, dur); n.connect(f); f.connect(g); g.connect(this.out(1, pan));
  },
  gun(type, vol = 1, pan = 0, far = 0) {
    if (!this.ready || vol < 0.02) return; const c = this.ctx, t = c.currentTime, P = GUNSND[type] || GUNSND.ar;
    const o = this.out(vol, pan);
    const n = this.nsrc(t, P.dur), lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(P.cut * (1 - far * 0.75), t); lp.frequency.exponentialRampToValueAtTime(260, t + P.dur);
    const g = c.createGain(); this.env(g, t, 0.002, P.nv, P.dur); n.connect(lp); lp.connect(g); g.connect(o);
    const os = c.createOscillator(); os.type = 'sine'; os.frequency.setValueAtTime(P.f0, t); os.frequency.exponentialRampToValueAtTime(P.f1, t + P.td);
    const g2 = c.createGain(); this.env(g2, t, 0.002, P.tv * (1 - far * 0.5), P.td); os.connect(g2); g2.connect(o); os.start(t); os.stop(t + P.td + 0.05);
    if (far > 0.35) { // distant echo
      const n2 = this.nsrc(t + 0.12, P.dur * 1.6), lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 900;
      const g3 = c.createGain(); this.env(g3, t + 0.12, 0.02, P.nv * 0.25, P.dur * 1.6); n2.connect(lp2); lp2.connect(g3); g3.connect(o);
    }
  },
  sfxAt(name, x, y) { const s = spatial(x, y); if (s.vol > 0.02) this.play(name, s.vol, s.pan); },
  play(name, vol = 1, pan = 0) {
    if (!this.ready) return;
    switch (name) {
      case 'click': this.tone(880, 0.05, 'square', 0.08 * vol); this.tone(1320, 0.05, 'square', 0.05 * vol, 0.03); break;
      case 'hover': this.tone(660, 0.03, 'sine', 0.05 * vol); break;
      case 'pickup': this.tone(520, 0.07, 'triangle', 0.22 * vol, 0, 0, pan); this.tone(780, 0.09, 'triangle', 0.2 * vol, 0.05, 0, pan); this.noiseHit(0.06, 3000, 0.08 * vol, 0, pan); break;
      case 'ammo': this.noiseHit(0.05, 2500, 0.18 * vol, 0, pan, 'bandpass', 2); this.noiseHit(0.05, 3200, 0.14 * vol, 0.05, pan, 'bandpass', 2); break;
      case 'chest': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.13 * vol, i * 0.06, 0, pan)); this.noiseHit(0.3, 6000, 0.1 * vol, 0, pan, 'highpass'); break;
      case 'hit': this.tone(1750, 0.06, 'triangle', 0.22 * vol); this.tone(2600, 0.04, 'sine', 0.1 * vol, 0.01); break;
      case 'hitShield': this.tone(2400, 0.07, 'sine', 0.2 * vol); this.tone(3300, 0.05, 'sine', 0.1 * vol, 0.015); break;
      case 'shieldBreak': this.noiseHit(0.35, 5000, 0.4 * vol, 0, pan, 'highpass'); this.tone(1800, 0.3, 'sawtooth', 0.08 * vol, 0, 400, pan); break;
      case 'hurt': this.tone(140, 0.15, 'sine', 0.35 * vol, 0, 70); this.noiseHit(0.08, 900, 0.25 * vol); break;
      case 'kill': this.tone(880, 0.1, 'square', 0.12 * vol); this.tone(1320, 0.16, 'square', 0.12 * vol, 0.08); this.tone(196, 0.3, 'sine', 0.3 * vol, 0, 98); break;
      case 'elim': this.tone(110, 0.6, 'sawtooth', 0.12 * vol, 0, 55); this.noiseHit(0.5, 600, 0.2 * vol); break;
      case 'step': this.noiseHit(0.05, 700 + Math.random() * 300, 0.06 * vol, 0, pan, 'bandpass', 1.5); break;
      case 'stepIn': this.noiseHit(0.05, 1500 + Math.random() * 300, 0.07 * vol, 0, pan, 'bandpass', 2.5); break;
      case 'bush': this.noiseHit(0.18, 3500, 0.1 * vol, 0, pan, 'highpass'); break;
      case 'magOut': this.noiseHit(0.04, 2200, 0.25 * vol, 0, pan, 'bandpass', 3); this.tone(300, 0.04, 'square', 0.05 * vol, 0.02, 0, pan); break;
      case 'magIn': this.noiseHit(0.05, 1800, 0.3 * vol, 0, pan, 'bandpass', 3); this.tone(420, 0.03, 'square', 0.07 * vol, 0.04, 0, pan); this.noiseHit(0.04, 3000, 0.2 * vol, 0.15, pan, 'bandpass', 4); break;
      case 'shell': this.noiseHit(0.06, 1500, 0.25 * vol, 0, pan, 'bandpass', 2); this.tone(600, 0.03, 'square', 0.04 * vol, 0.03, 0, pan); break;
      case 'pump': this.noiseHit(0.06, 1300, 0.3 * vol, 0, pan, 'bandpass', 2.5); this.noiseHit(0.06, 2000, 0.3 * vol, 0.11, pan, 'bandpass', 2.5); break;
      case 'bolt': this.noiseHit(0.05, 2400, 0.25 * vol, 0, pan, 'bandpass', 3); this.noiseHit(0.05, 1600, 0.25 * vol, 0.16, pan, 'bandpass', 3); break;
      case 'empty': this.tone(1200, 0.025, 'square', 0.1 * vol); break;
      case 'impact': this.noiseHit(0.05, 2600, 0.12 * vol, 0, pan, 'bandpass', 1.2); break;
      case 'ricochet': this.tone(2400 + Math.random() * 1200, 0.12, 'sine', 0.05 * vol, 0, 900, pan); break;
      case 'wood': this.noiseHit(0.07, 900, 0.16 * vol, 0, pan, 'bandpass', 1.5); break;
      case 'melee': this.noiseHit(0.12, 1200, 0.2 * vol, 0, pan, 'bandpass', 0.8); break;
      case 'thud': this.tone(120, 0.12, 'sine', 0.35 * vol, 0, 60, pan); this.noiseHit(0.08, 700, 0.2 * vol, 0, pan); break;
      case 'explode': {
        const c = this.ctx, t = c.currentTime, o = this.out(vol, pan);
        const n = this.nsrc(t, 1.3), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3000, t); lp.frequency.exponentialRampToValueAtTime(120, t + 1.2);
        const g = c.createGain(); this.env(g, t, 0.005, 1, 1.2); n.connect(lp); lp.connect(g); g.connect(o);
        const os = c.createOscillator(); os.frequency.setValueAtTime(80, t); os.frequency.exponentialRampToValueAtTime(25, t + 0.7);
        const g2 = c.createGain(); this.env(g2, t, 0.005, 1, 0.7); os.connect(g2); g2.connect(o); os.start(t); os.stop(t + 0.8);
        break;
      }
      case 'pin': this.tone(2200, 0.05, 'square', 0.08 * vol, 0, 0, pan); this.noiseHit(0.1, 1500, 0.12 * vol, 0.05, pan); break;
      case 'bounce': this.tone(500, 0.04, 'square', 0.06 * vol, 0, 300, pan); break;
      case 'healStart': this.noiseHit(0.25, 2500, 0.12 * vol, 0, pan, 'bandpass', 1); break;
      case 'heal': this.tone(523, 0.15, 'sine', 0.18 * vol); this.tone(784, 0.25, 'sine', 0.16 * vol, 0.1); break;
      case 'shieldUp': this.tone(600, 0.3, 'sine', 0.15 * vol, 0, 1200); this.tone(900, 0.3, 'triangle', 0.08 * vol, 0.1, 1800); break;
      case 'jump': this.noiseHit(0.5, 1800, 0.25 * vol, 0, 0, 'bandpass', 0.6); break;
      case 'land': this.tone(90, 0.2, 'sine', 0.4 * vol, 0, 45); this.noiseHit(0.25, 800, 0.3 * vol); break;
      case 'glider': this.noiseHit(0.3, 2500, 0.18 * vol, 0, 0, 'bandpass', 1); this.tone(300, 0.2, 'triangle', 0.06 * vol, 0, 500); break;
      case 'warn': [0, 0.35].forEach(d => { this.tone(440, 0.3, 'sawtooth', 0.08 * vol, d, 330); }); break;
      case 'banner': this.tone(392, 0.2, 'triangle', 0.12 * vol); this.tone(587, 0.3, 'triangle', 0.12 * vol, 0.12); break;
      case 'supply': [330, 392, 494].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.12 * vol, i * 0.15)); break;
      case 'victory': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, i === 6 ? 1.2 : 0.22, 'triangle', 0.18, i * 0.14)); break;
      case 'defeat': [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.45, 'sawtooth', 0.08, i * 0.22)); break;
      case 'swap': this.noiseHit(0.06, 1800, 0.12 * vol, 0, pan, 'bandpass', 2); break;
    }
  },
  startLoops() {
    const c = this.ctx;
    const mk = (type, freq, q, srcType) => {
      let src;
      if (srcType === 'noise') { src = c.createBufferSource(); src.buffer = this.noise; src.loop = true; }
      else { src = c.createOscillator(); src.type = srcType; src.frequency.value = freq; }
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = srcType === 'noise' ? freq : 600; f.Q.value = q;
      const g = c.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(this.sfx); src.start();
      return { src, f, g };
    };
    this.loops.storm = mk('bandpass', 260, 0.8, 'noise');
    this.loops.wind = mk('bandpass', 900, 0.6, 'noise');
    this.loops.engine = mk('lowpass', 55, 1, 'sawtooth');
    this.loops.engine.f.frequency.value = 240;
    this.loops.hum = mk('lowpass', 220, 1, 'triangle');
    this.loops.hum.f.frequency.value = 900;
  },
  setLoop(name, v, freq) {
    if (!this.ready) return; const L = this.loops[name]; if (!L) return;
    L.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.12);
    if (freq) { if (L.src.frequency) L.src.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.2); else L.f.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.2); }
  }
};
function spatial(x, y) {
  const d = Math.sqrt(d2(x, y, cam.x, cam.y));
  const v = clamp(1 - d / 1900, 0, 1);
  return { vol: v * v, pan: clamp((x - cam.x) / 900, -1, 1), far: clamp(d / 1500, 0, 1) };
}

// ---------- music: procedural ----------
const Music = {
  step: 0, next: 0, timer: null, mode: 'menu', intensity: 0,
  start() { if (this.timer || !AU.ctx) return; this.next = AU.ctx.currentTime + 0.15; this.timer = setInterval(() => this.tick(), 30); },
  tick() {
    const c = AU.ctx; if (!c) return; const spb = 60 / 96 / 4;
    while (this.next < c.currentTime + 0.15) { this.play(this.step, this.next); this.next += spb; this.step = (this.step + 1) % 128; }
  },
  freq: m => 440 * Math.pow(2, (m - 69) / 12),
  voice(f, t, dur, type, vol, cut) {
    const c = AU.ctx, o = c.createOscillator(); o.type = type; o.frequency.value = f;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cut;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.4, dur * 0.3)); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(AU.mus); o.start(t); o.stop(t + dur + 0.05);
  },
  drum(kind, t, vol) {
    const c = AU.ctx;
    if (kind === 'k') { const o = c.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15); const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(AU.mus); o.start(t); o.stop(t + 0.25); }
    else { const n = c.createBufferSource(); n.buffer = AU.noise; const f = c.createBiquadFilter(); f.type = kind === 'h' ? 'highpass' : 'bandpass'; f.frequency.value = kind === 'h' ? 7000 : 1800; const g = c.createGain(); const d = kind === 'h' ? 0.04 : 0.14; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + d); n.connect(f); f.connect(g); g.connect(AU.mus); n.start(t, Math.random(), d + 0.02); }
  },
  play(s, t) {
    const prog = [[45, 48, 52, 57], [41, 45, 48, 53], [48, 52, 55, 60], [43, 47, 50, 55]];
    const ch = prog[Math.floor(s / 32) % 4]; const b = s % 32, I = this.intensity;
    if (this.mode === 'off') return;
    if (b === 0) for (let i = 1; i < 4; i++) this.voice(this.freq(ch[i] + 12), t, 4.6, 'sawtooth', 0.035, 900 + I * 300);
    if (this.mode === 'menu') {
      if (s % 4 === 0 && Math.random() < 0.55) this.voice(this.freq(ch[(s / 4) % 4 | 0] + 24), t, 0.5, 'triangle', 0.05, 2500);
      if (s % 16 === 0) this.voice(this.freq(ch[0] - 12), t, 1.2, 'sine', 0.12, 400);
      return;
    }
    if (I >= 1) {
      if (s % 4 === 0) this.voice(this.freq(ch[0] - 12), t, 0.3, 'sawtooth', 0.06, 300 + I * 100);
      if (s % 8 === 0) this.drum('k', t, 0.35);
      if (s % 4 === 2) this.drum('h', t, 0.05);
    }
    if (I >= 2) {
      if (s % 16 === 8) this.drum('s', t, 0.18);
      if (s % 2 === 0) this.voice(this.freq(ch[(s / 2) % 4 | 0] + 24), t, 0.14, 'square', 0.02, 2200);
      if (s % 4 === 2) this.drum('k', t, 0.15);
    }
  }
};

// =====================================================================
//  WORLD GENERATION
// =====================================================================
let seed = 1;
function hash2(x, y) { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf); return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v); }
function fbm(x, y) { return vnoise(x, y) * 0.6 + vnoise(x * 2.1 + 17, y * 2.1 + 3) * 0.3 + vnoise(x * 4.3 + 7, y * 4.3 + 11) * 0.1; }
function groundRGB(x, y) {
  const n = fbm(x / 650, y / 650), m = vnoise(x / 1400 + 40, y / 1400 + 40);
  let r = lerp(66, 104, n), g = lerp(92, 128, n), b = lerp(44, 62, n);
  const dry = clamp((m - 0.55) * 3, 0, 1);
  r = lerp(r, 138, dry * 0.6); g = lerp(g, 128, dry * 0.5); b = lerp(b, 76, dry * 0.5);
  return [r | 0, g | 0, b | 0];
}

const world = { walls: [], circles: [], bushes: [], buildings: [], pois: [], roads: [], dirt: [], pads: [], items: [], chests: [], decals: [] };
const CELL = 240, GN = Math.ceil(WORLD / CELL);
let grid = null, stampW = 1, stampC = 1;
function buildGrid() {
  grid = { w: [], c: [] };
  for (let i = 0; i < GN * GN; i++) { grid.w.push([]); grid.c.push([]); }
  const put = (arr, x0, y0, x1, y1, idx) => {
    const a = clamp(Math.floor(x0 / CELL), 0, GN - 1), b = clamp(Math.floor(x1 / CELL), 0, GN - 1);
    const c = clamp(Math.floor(y0 / CELL), 0, GN - 1), d = clamp(Math.floor(y1 / CELL), 0, GN - 1);
    for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) arr[y * GN + x].push(idx);
  };
  world.walls.forEach((w, i) => put(grid.w, w.x, w.y, w.x + w.w, w.y + w.h, i));
  world.circles.forEach((o, i) => put(grid.c, o.x - o.r, o.y - o.r, o.x + o.r, o.y + o.r, i));
}
const _qw = [], _qc = [];
function queryWalls(x0, y0, x1, y1, out = _qw) {
  stampW++; out.length = 0;
  const a = clamp(Math.floor(Math.min(x0, x1) / CELL), 0, GN - 1), b = clamp(Math.floor(Math.max(x0, x1) / CELL), 0, GN - 1);
  const c = clamp(Math.floor(Math.min(y0, y1) / CELL), 0, GN - 1), d = clamp(Math.floor(Math.max(y0, y1) / CELL), 0, GN - 1);
  for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) { const L = grid.w[y * GN + x]; for (let i = 0; i < L.length; i++) { const w = world.walls[L[i]]; if (w.s !== stampW) { w.s = stampW; out.push(w); } } }
  return out;
}
function queryCircles(x0, y0, x1, y1, out = _qc) {
  stampC++; out.length = 0;
  const a = clamp(Math.floor(Math.min(x0, x1) / CELL), 0, GN - 1), b = clamp(Math.floor(Math.max(x0, x1) / CELL), 0, GN - 1);
  const c = clamp(Math.floor(Math.min(y0, y1) / CELL), 0, GN - 1), d = clamp(Math.floor(Math.max(y0, y1) / CELL), 0, GN - 1);
  for (let y = c; y <= d; y++) for (let x = a; x <= b; x++) { const L = grid.c[y * GN + x]; for (let i = 0; i < L.length; i++) { const o = world.circles[L[i]]; if (o.s !== stampC) { o.s = stampC; out.push(o); } } }
  return out;
}

function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1); return Math.sqrt(d2(px, py, ax + dx * t, ay + dy * t)); }
function roadDist(x, y) { let m = 1e9; for (const r of world.roads) for (let i = 0; i < r.length - 1; i++) m = Math.min(m, segDist(x, y, r[i][0], r[i][1], r[i + 1][0], r[i + 1][1])); return m; }
function inAnyBuilding(x, y, pad) { for (const b of world.buildings) if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b; return null; }
function buildingAt(x, y) { for (const b of world.buildings) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return b; return null; }

const ROOFS = ['#3c4148', '#6e3a2e', '#3f5547', '#58483a', '#4a4f5c', '#7a6a55'];
function makeBuilding(x, y, w, h) {
  const T = 14, D = 60;
  const b = { x, y, w, h, walls: [], doors: [], roofA: 1, roof: pick(ROOFS), floor: rng() < 0.6 ? 'wood' : 'tile', ridgeH: w >= h, id: world.buildings.length };
  const vert = rng() < 0.5; const sides = new Set(vert ? ['top', 'bottom'] : ['left', 'right']);
  if (rng() < 0.35) sides.add(vert ? pick(['left', 'right']) : pick(['top', 'bottom']));
  const add = (wx, wy, ww, wh) => { if (ww > 1 && wh > 1) { const wl = { x: wx, y: wy, w: ww, h: wh, kind: 'wall', b }; b.walls.push(wl); world.walls.push(wl); } };
  for (const s of ['top', 'bottom', 'left', 'right']) {
    const horiz = s === 'top' || s === 'bottom', len = horiz ? w : h;
    if (sides.has(s)) {
      const c = (horiz ? x : y) + len / 2 + rand(-1, 1) * Math.max(0, len / 2 - 70);
      if (horiz) { const yy = s === 'top' ? y : y + h - T; add(x, yy, c - D / 2 - x, T); add(c + D / 2, yy, x + w - (c + D / 2), T); b.doors.push(s === 'top' ? { ox: c, oy: y - 36, ix: c, iy: y + T + 32 } : { ox: c, oy: y + h + 36, ix: c, iy: y + h - T - 32 }); }
      else { const xx = s === 'left' ? x : x + w - T; add(xx, y, T, c - D / 2 - y); add(xx, c + D / 2, T, y + h - (c + D / 2)); b.doors.push(s === 'left' ? { ox: x - 36, oy: c, ix: x + T + 32, iy: c } : { ox: x + w + 36, oy: c, ix: x + w - T - 32, iy: c }); }
    } else {
      if (horiz) add(x, s === 'top' ? y : y + h - T, w, T); else add(s === 'left' ? x : x + w - T, y, T, h);
    }
  }
  // interior divider with a gap
  if (w >= 250 && rng() < 0.75) {
    const ix = x + w * rand(0.42, 0.58), gy = y + h * rand(0.3, 0.7);
    add(ix, y + T, 10, gy - 34 - (y + T)); add(ix, gy + 34, 10, y + h - T - (gy + 34));
  } else if (h >= 250 && rng() < 0.75) {
    const iy = y + h * rand(0.42, 0.58), gx = x + w * rand(0.3, 0.7);
    add(x + T, iy, gx - 34 - (x + T), 10); add(gx + 34, iy, x + w - T - (gx + 34), 10);
  }
  // furniture (low cover)
  const nf = randi(1, 3);
  for (let i = 0; i < nf; i++) {
    const fw = rng() < 0.5 ? 60 : 28, fh = fw === 60 ? 28 : 60;
    const fx = rand(x + T + 10, x + w - T - 10 - fw), fy = rand(y + T + 10, y + h - T - 10 - fh);
    let ok = true;
    for (const d of b.doors) if (d2(fx + fw / 2, fy + fh / 2, d.ix, d.iy) < 85 * 85) ok = false;
    for (const wl of b.walls) if (fx < wl.x + wl.w + 34 && fx + fw > wl.x - 34 && fy < wl.y + wl.h + 34 && fy + fh > wl.y - 34 && wl.w < w - 2 && wl.h < h - 2 && (wl.w === 10 || wl.h === 10)) ok = false;
    if (ok) { const f = { x: fx, y: fy, w: fw, h: fh, kind: 'furn', low: true, b, col: pick(['#6b4a2f', '#5a4632', '#4b4f55']) }; world.walls.push(f); }
  }
  world.buildings.push(b);
  return b;
}

const TILE = 512;
const tileCache = new Map();
let ovCv = null;
function genWorld(s) {
  seed = s; rng = mulberry32(s);
  for (const k in world) world[k] = [];
  tileCache.clear(); itemSeq = 0;
  // POIs
  const names = POI_NAMES.slice().sort(() => rng() - 0.5);
  let tries = 0;
  while (world.pois.length < 8 && tries++ < 2000) {
    const x = rand(550, WORLD - 550), y = rand(550, WORLD - 550);
    if (world.pois.every(p => d2(x, y, p.x, p.y) > 1050 * 1050)) world.pois.push({ x, y, name: names[world.pois.length], r: rand(330, 420) });
  }
  // roads
  const conn = new Set();
  for (const p of world.pois) {
    const others = world.pois.filter(o => o !== p).sort((a, b) => d2(p.x, p.y, a.x, a.y) - d2(p.x, p.y, b.x, b.y));
    for (let k = 0; k < 2 && k < others.length; k++) {
      const o = others[k], key = [world.pois.indexOf(p), world.pois.indexOf(o)].sort().join('-');
      if (conn.has(key)) continue; conn.add(key);
      const pts = [[p.x, p.y]], n = 6;
      const nx = -(o.y - p.y), ny = o.x - p.x, nl = Math.hypot(nx, ny) || 1;
      const bend = rand(-0.18, 0.18);
      for (let i = 1; i < n; i++) { const t = i / n, off = Math.sin(t * Math.PI) * bend * nl + rand(-30, 30); pts.push([lerp(p.x, o.x, t) + nx / nl * off, lerp(p.y, o.y, t) + ny / nl * off]); }
      pts.push([o.x, o.y]); world.roads.push(pts);
    }
  }
  // ground decor
  for (const p of world.pois) world.pads.push({ x: p.x, y: p.y, r: p.r * 0.9, pts: Array.from({ length: 14 }, (_, i) => [i / 14 * TAU, rand(0.82, 1.12)]) });
  for (let i = 0; i < 70; i++) world.dirt.push({ x: rand(0, WORLD), y: rand(0, WORLD), r: rand(60, 220) });
  // buildings in POIs
  for (const p of world.pois) {
    const n = randi(4, 7); let t2 = 0, made = 0;
    while (made < n && t2++ < 200) {
      const w = randi(9, 16) * 20, h = randi(8, 14) * 20;
      const a = rand(0, TAU), r = rand(60, p.r - 40), x = Math.round(p.x + Math.cos(a) * r - w / 2), y = Math.round(p.y + Math.sin(a) * r - h / 2);
      if (inAnyBuilding(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 70)) continue;
      let clash = false; for (const b of world.buildings) if (x < b.x + b.w + 70 && x + w > b.x - 70 && y < b.y + b.h + 70 && y + h > b.y - 70) clash = true;
      if (clash) continue;
      if (roadDist(x + w / 2, y + h / 2) < Math.hypot(w, h) / 2 + 30) continue;
      makeBuilding(x, y, w, h); made++;
    }
  }
  // lone houses
  for (let i = 0, t3 = 0; i < 16 && t3 < 600; t3++) {
    const w = randi(8, 12) * 20, h = randi(7, 11) * 20, x = Math.round(rand(200, WORLD - 200 - w)), y = Math.round(rand(200, WORLD - 200 - h));
    let clash = false; for (const b of world.buildings) if (x < b.x + b.w + 200 && x + w > b.x - 200 && y < b.y + b.h + 200 && y + h > b.y - 200) clash = true;
    if (clash || roadDist(x + w / 2, y + h / 2) < Math.hypot(w, h) / 2 + 30) continue;
    makeBuilding(x, y, w, h); i++;
  }
  const blocked = (x, y, r) => {
    if (x < 40 || y < 40 || x > WORLD - 40 || y > WORLD - 40) return true;
    if (inAnyBuilding(x, y, r + 20)) return true;
    for (const w of world.walls) if (x + r > w.x - 6 && x - r < w.x + w.w + 6 && y + r > w.y - 6 && y - r < w.y + w.h + 6) return true;
    return false;
  };
  // cars + crates near roads/towns
  const CARS = ['#8b2f2a', '#2f4e7a', '#c9c3b6', '#3d3f42', '#5d6b3a', '#a08349'];
  for (let i = 0, t4 = 0; i < 26 && t4 < 400; t4++) {
    const r = pick(world.roads), k = randi(0, r.length - 2), t = rng();
    const ax = lerp(r[k][0], r[k + 1][0], t), ay = lerp(r[k][1], r[k + 1][1], t);
    const horiz = Math.abs(r[k + 1][0] - r[k][0]) > Math.abs(r[k + 1][1] - r[k][1]);
    const side = rng() < 0.5 ? -1 : 1;
    const cw = horiz ? 92 : 46, ch = horiz ? 46 : 92;
    const cx = ax + (horiz ? 0 : side * 44), cy = ay + (horiz ? side * 44 : 0);
    if (blocked(cx, cy, 60)) continue;
    world.walls.push({ x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch, kind: 'car', low: true, col: pick(CARS), horiz, flip: rng() < 0.5 }); i++;
  }
  for (const p of world.pois) for (let i = 0; i < 5; i++) {
    const a = rand(0, TAU), r = rand(80, p.r), x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
    if (blocked(x, y, 40)) continue;
    const n = randi(1, 3); for (let j = 0; j < n; j++) world.walls.push({ x: x + j * 42 - 20, y: y - 20 + (j === 2 ? 42 : 0), w: 40, h: 40, kind: 'crate', low: true });
  }
  // trees, rocks, bushes
  let placed = 0, t5 = 0;
  while (placed < 620 && t5++ < 9000) {
    const x = rand(30, WORLD - 30), y = rand(30, WORLD - 30), forest = fbm(x / 900 + 90, y / 900 + 90);
    if (rng() > forest * forest * 1.6) continue;
    if (blocked(x, y, 30) || roadDist(x, y) < 50) continue;
    if (world.pois.some(p => d2(x, y, p.x, p.y) < (p.r * 0.75) ** 2)) continue;
    const tr = { x, y, r: rand(11, 15), kind: 'tree', canopy: rand(42, 70), hue: rand(0, 1), rot: rand(0, TAU) };
    if (queryless(tr)) { world.circles.push(tr); placed++; }
  }
  for (let i = 0, t6 = 0; i < 110 && t6 < 3000; t6++) {
    const x = rand(30, WORLD - 30), y = rand(30, WORLD - 30), r = rand(22, 44);
    if (blocked(x, y, r) || roadDist(x, y) < r + 30) continue;
    const rk = { x, y, r, kind: 'rock', pts: Array.from({ length: 9 }, (_, k) => [k / 9 * TAU, rand(0.8, 1.15)]), shade: rand(0.85, 1.1) };
    if (queryless(rk)) { world.circles.push(rk); i++; }
  }
  for (let i = 0, t7 = 0; i < 300 && t7 < 4000; t7++) {
    const x = rand(30, WORLD - 30), y = rand(30, WORLD - 30);
    if (blocked(x, y, 30) || roadDist(x, y) < 40) continue;
    world.bushes.push({ x, y, r: rand(26, 38), blobs: Array.from({ length: 6 }, () => [rand(-0.5, 0.5), rand(-0.5, 0.5), rand(0.45, 0.7)]), shake: 0 }); i++;
  }
  buildGrid();
  // loot
  for (const b of world.buildings) {
    const T = 14, inner = () => [rand(b.x + T + 26, b.x + b.w - T - 26), rand(b.y + T + 26, b.y + b.h - T - 26)];
    if (rng() < 0.7) { const [x, y] = freeInterior(inner); world.chests.push({ x, y, open: false, t: 0 }); }
    const n = randi(2, 3); for (let i = 0; i < n; i++) { const [x, y] = freeInterior(inner); spawnLoot(x, y, 'floor'); }
  }
  for (const p of world.pois) for (let i = 0; i < 5; i++) { const a = rand(0, TAU), r = rand(0, p.r); const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r; if (!collidesAt(x, y, 18)) spawnLoot(x, y, 'floor'); }
  for (let i = 0, t8 = 0; i < 110 && t8 < 2000; t8++) { const x = rand(100, WORLD - 100), y = rand(100, WORLD - 100); if (collidesAt(x, y, 20) || inAnyBuilding(x, y, 10)) continue; spawnLoot(x, y, 'floor'); i++; }
  for (let i = 0, t9 = 0; i < 16 && t9 < 600; t9++) { const x = rand(150, WORLD - 150), y = rand(150, WORLD - 150); if (collidesAt(x, y, 26) || inAnyBuilding(x, y, 30)) continue; world.chests.push({ x, y, open: false, t: 0 }); i++; }
  buildOverview();
}
function queryless(o) { for (const c of world.circles) if (d2(o.x, o.y, c.x, c.y) < (o.r + c.r + (o.kind === 'tree' && c.kind === 'tree' ? 34 : 18)) ** 2) return false; return true; }
function freeInterior(inner) { for (let i = 0; i < 30; i++) { const p = inner(); if (!collidesAt(p[0], p[1], 20)) return p; } return inner(); }
function collidesAt(x, y, r) {
  for (const w of queryWalls(x - r, y - r, x + r, y + r)) { const cx = clamp(x, w.x, w.x + w.w), cy = clamp(y, w.y, w.y + w.h); if (d2(x, y, cx, cy) < r * r) return true; }
  for (const c of queryCircles(x - r, y - r, x + r, y + r)) if (d2(x, y, c.x, c.y) < (r + c.r) ** 2) return true;
  return false;
}

// ---------- loot ----------
function rollRarity(src) {
  const t = src === 'supply' ? [0, 0, 0, 55, 45] : src === 'chest' ? [22, 34, 27, 13, 4] : [42, 31, 18, 7, 2];
  let r = rng() * 100; for (let i = 0; i < 5; i++) { r -= t[i]; if (r < 0) return i; } return 0;
}
function rollWeapon(src) {
  const tot = WIDS.reduce((s, k) => s + WEAPONS[k].w, 0); let r = rng() * tot;
  for (const k of WIDS) { r -= WEAPONS[k].w; if (r < 0) return k; } return 'ar';
}
function mkWeapon(wid, rar) { return { kind: 'weapon', wid, rar, mag: WEAPONS[wid].mag }; }
let itemSeq = 0;
function dropItem(it, x, y, spill) {
  const o = { id: ++itemSeq, x, y, it, vx: 0, vy: 0, t: Math.random() * 10, claim: 0, claimT: 0 };
  if (spill) { const a = Math.random() * TAU, s = fr(60, 220); o.vx = Math.cos(a) * s; o.vy = Math.sin(a) * s; }
  world.items.push(o);
  netEv(['ia', o.id, Math.round(o.x), Math.round(o.y), o.it, Math.round(o.vx), Math.round(o.vy)]);
  return o;
}
function spawnLoot(x, y, src, spill) {
  const o = (it, dx = 0, dy = 0) => dropItem(it, x + dx, y + dy, spill);
  const r = rng();
  if (src === 'floor') {
    if (r < 0.52) { const wid = rollWeapon(); o(mkWeapon(wid, rollRarity(src))); o({ kind: 'ammo', type: WEAPONS[wid].ammo, amount: AMMO[WEAPONS[wid].ammo].pick }, 26, 10); }
    else if (r < 0.78) { const h = pick(['bandage', 'bandage', 'shieldS', 'shieldS', 'medkit', 'shieldB']); o({ kind: 'heal', hid: h, count: HEALS[h].pick }); }
    else if (r < 0.92) { const t = pick(['light', 'medium', 'shells', 'heavy', 'medium', 'light']); o({ kind: 'ammo', type: t, amount: AMMO[t].pick }); }
    else o({ kind: 'frag', count: 2 });
  } else {
    const wid = src === 'supply' ? pick(['ar', 'ar', 'sniper', 'shotgun', 'smg']) : rollWeapon();
    o(mkWeapon(wid, rollRarity(src)), 0, 0);
    o({ kind: 'ammo', type: WEAPONS[wid].ammo, amount: AMMO[WEAPONS[wid].ammo].pick * 2 }, 24, 16);
    const h = src === 'supply' ? 'shieldB' : pick(['bandage', 'shieldS', 'shieldS', 'medkit', 'shieldB']);
    o({ kind: 'heal', hid: h, count: HEALS[h].pick * (src === 'supply' ? 2 : 1) }, -24, 16);
    if (rng() < 0.35 || src === 'supply') o({ kind: 'frag', count: 2 }, 0, -26);
    if (src === 'supply') o({ kind: 'ammo', type: 'heavy', amount: 8 }, 30, -20);
  }
}
function itemName(it) {
  if (it.kind === 'weapon') return RAR[it.rar].n + ' ' + WEAPONS[it.wid].name;
  if (it.kind === 'heal') return HEALS[it.hid].name + (it.count > 1 ? ' ×' + it.count : '');
  if (it.kind === 'frag') return 'Frag Grenade' + (it.count > 1 ? ' ×' + it.count : '');
  if (it.kind === 'ammo') return AMMO[it.type].name + ' ×' + it.amount;
  return '';
}
const itemColor = it => it.kind === 'weapon' ? RAR[it.rar].c : it.kind === 'heal' ? (it.hid.startsWith('shield') ? '#4cc3ff' : '#9ee37d') : it.kind === 'frag' ? '#c7b37a' : AMMO[it.type].c;

// ---------- overview map ----------
function buildOverview() {
  if (window.__SF_HEADLESS) return;
  const S = 1200, k = S / WORLD; ovCv = document.createElement('canvas'); ovCv.width = ovCv.height = S;
  const g = ovCv.getContext('2d');
  const n = 160, sm = document.createElement('canvas'); sm.width = sm.height = n;
  const sg = sm.getContext('2d'), id = sg.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const c = groundRGB((x + 0.5) / n * WORLD, (y + 0.5) / n * WORLD), i = (y * n + x) * 4; id.data[i] = c[0]; id.data[i + 1] = c[1]; id.data[i + 2] = c[2]; id.data[i + 3] = 255; }
  sg.putImageData(id, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(sm, 0, 0, S, S);
  g.save(); g.scale(k, k);
  drawGroundDecor(g, 0, 0, WORLD, WORLD, true);
  for (const b of world.buildings) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(b.x + 20, b.y + 26, b.w, b.h); g.fillStyle = b.roof; g.fillRect(b.x, b.y, b.w, b.h); g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 8; g.strokeRect(b.x, b.y, b.w, b.h); }
  for (const w of world.walls) if (w.kind === 'car') { g.fillStyle = w.col; g.fillRect(w.x, w.y, w.w, w.h); }
  for (const c of world.circles) { g.fillStyle = c.kind === 'tree' ? 'rgba(28,52,26,.85)' : '#8a8a84'; g.beginPath(); g.arc(c.x, c.y, c.kind === 'tree' ? c.canopy * 0.8 : c.r, 0, TAU); g.fill(); }
  g.restore();
}
function drawGroundDecor(g, x0, y0, x1, y1, overview) {
  for (const d of world.dirt) {
    if (d.x + d.r < x0 || d.x - d.r > x1 || d.y + d.r < y0 || d.y - d.r > y1) continue;
    const gr = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); gr.addColorStop(0, 'rgba(120,98,66,.55)'); gr.addColorStop(0.6, 'rgba(120,98,66,.3)'); gr.addColorStop(1, 'rgba(120,98,66,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(d.x, d.y, d.r, 0, TAU); g.fill();
  }
  for (const p of world.pads) {
    if (p.x + p.r * 1.2 < x0 || p.x - p.r * 1.2 > x1 || p.y + p.r * 1.2 < y0 || p.y - p.r * 1.2 > y1) continue;
    g.beginPath(); p.pts.forEach(([a, m], i) => { const px = p.x + Math.cos(a) * p.r * m, py = p.y + Math.sin(a) * p.r * m; i ? g.lineTo(px, py) : g.moveTo(px, py); }); g.closePath();
    const gr = g.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r * 1.1); gr.addColorStop(0, 'rgba(128,118,98,.85)'); gr.addColorStop(0.75, 'rgba(118,106,84,.7)'); gr.addColorStop(1, 'rgba(110,98,74,0)');
    g.fillStyle = gr; g.fill();
  }
  g.lineCap = 'round'; g.lineJoin = 'round';
  const path = r => { g.beginPath(); r.forEach((pt, i) => i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])); };
  for (const r of world.roads) { path(r); g.strokeStyle = '#6b5f4b'; g.lineWidth = 64; g.stroke(); }
  for (const r of world.roads) { path(r); g.strokeStyle = '#4a4a47'; g.lineWidth = 50; g.stroke(); }
  if (!overview) for (const r of world.roads) { path(r); g.setLineDash([26, 30]); g.strokeStyle = 'rgba(214,190,120,.55)'; g.lineWidth = 3; g.stroke(); g.setLineDash([]); }
}
function getTile(tx, ty) {
  const key = tx + ',' + ty; let t = tileCache.get(key);
  if (t) { tileCache.delete(key); tileCache.set(key, t); return t; }
  const res = settings.quality === 'low' ? 0.5 : 1;
  const c = document.createElement('canvas'); c.width = c.height = TILE * res;
  const g = c.getContext('2d'); g.scale(res, res);
  const n = 18, sm = document.createElement('canvas'); sm.width = sm.height = n;
  const sg = sm.getContext('2d'), id = sg.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const col = groundRGB(tx * TILE + (x - 1) * 32, ty * TILE + (y - 1) * 32), i = (y * n + x) * 4; id.data[i] = col[0]; id.data[i + 1] = col[1]; id.data[i + 2] = col[2]; id.data[i + 3] = 255; }
  sg.putImageData(id, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(sm, -48, -48, n * 32, n * 32);
  const R = mulberry32((tx * 73856093) ^ (ty * 19349663) ^ seed);
  const blades = settings.quality === 'low' ? 500 : 1300;
  for (let i = 0; i < blades; i++) {
    const x = R() * TILE, y = R() * TILE, l = 2 + R() * 4, a = -1.2 + R() * 0.8, v = R();
    g.strokeStyle = v < 0.5 ? `rgba(30,50,20,${0.18 + R() * 0.2})` : `rgba(160,180,100,${0.08 + R() * 0.12})`;
    g.lineWidth = 1 + R(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '90,80,60' : '200,200,170'},${0.15 + R() * 0.2})`; g.beginPath(); g.arc(R() * TILE, R() * TILE, 0.8 + R() * 1.6, 0, TAU); g.fill(); }
  g.translate(-tx * TILE, -ty * TILE);
  drawGroundDecor(g, tx * TILE, ty * TILE, (tx + 1) * TILE, (ty + 1) * TILE, false);
  tileCache.set(key, c);
  const max = 50;
  while (tileCache.size > max) tileCache.delete(tileCache.keys().next().value);
  return c;
}

// =====================================================================
//  ENTITIES
// =====================================================================
let G = null;
const dbg = { god: false };
const cam = { x: WORLD / 2, y: WORLD / 2, zoom: 1, tz: 1, shake: 0, sx: 0, sy: 0, kick: 0, kx: 0, ky: 0 };

function makeAI(diff) {
  const D = DIFF[diff], v = () => fr(0.82, 1.2);
  return {
    sight: D.sight * v(), react: D.react * v(), turn: D.turn * v(), err: D.err * v(), minErr: D.minErr * v(), pause: D.pause, heal: D.heal,
    think: Math.random() * 0.3, target: null, seenT: 99, lastX: 0, lastY: 0, reactT: 0, curErr: 0, errPh: Math.random() * 10,
    wp: [], wi: 0, gx: 0, gy: 0, mode: 'roam', burst: 0, burstPause: 0, strafe: 1, strafeT: 0, stuckT: 0, px: 0, py: 0, detourT: 0, dx: 0, dy: 0,
    lootRef: null, alertX: 0, alertY: 0, alertT: 0, roamT: 0, ignore: new Set(), losOK: false, prefD: fr(200, 400), engage: fr(260, 520), botEngage: fr(70, 170), aggro: Math.random(), jumpAt: 0, landX: 0, landY: 0
  };
}
function makePlayer(id, isPlayer, name, skin, diff) {
  return {
    id, isPlayer, name, skin, x: 0, y: 0, vx: 0, vy: 0, r: 15, hp: 100, shield: 0, alive: true, state: 'bus', alt: 0,
    angle: 0, inv: [null, null, null, null, null], sel: 0, ammo: { light: 0, medium: 0, shells: 0, heavy: 0 },
    kills: 0, dmgDealt: 0, reloadT: 0, reloadMax: 0, fireCd: 0, equipT: 0, useT: 0, useMax: 0, bloom: 0, ads: false, recoil: 0,
    hitFlash: 0, walk: 0, moving: false, inBush: null, firedT: 9, stormAcc: 0, deathT: 0, place: 0, stepAcc: 0, landT: 0,
    killer: null, barT: 0, emptyT: 0, ctl: { mx: 0, my: 0, fire: false, ads: false }, pumpT: 0, meleeT: 0, swing: 0,
    ai: isPlayer ? null : makeAI(diff), survived: 0
  };
}
const curItem = p => p.inv[p.sel];
const curWeapon = p => { const it = p.inv[p.sel]; return it && it.kind === 'weapon' ? it : null; };

function baseG(demo, diff) {
  return {
    demo, diff, time: 0, netEv: [], isHost: false, isClient: false, online: false, players: [], bullets: [], grenades: [], parts: [], floats: [], feed: [], banners: [], toasts: [],
    supply: [], bodies: [], me: null, over: false, result: null, endT: 0, paused: false, timeScale: 1, hitStop: 0,
    showMap: false, hitMarker: 0, hitKill: false, dmgDirs: [], vign: 0, phaseIdx: 0, camTarget: null, camSwitchT: 0,
    bus: null, alive: NPLAYERS, nextSupply: 1, lastBannerPhase: -1, specT: 0, stormWarned: false, poiShown: null, poiT: 0
  };
}
function newMatch(demo, opts) {
  opts = opts || {};
  genWorld(opts.seed != null ? opts.seed : (Math.random() * 1e9) | 0);
  const diff = opts.net ? 1 : settings.difficulty;
  G = baseG(demo, diff);
  if (opts.net === 'host') { G.isHost = true; G.online = true; G.mid = opts.mid; }
  const humans = opts.humans || [];
  const taken = new Set(humans.map(h => h.name));
  const names = BOT_NAMES.filter(n => !taken.has(n)).sort(() => Math.random() - 0.5);
  for (let i = 0; i < NPLAYERS; i++) {
    const h = humans[i]; let p;
    if (h) {
      const isMe = h.id === NET.selfId;
      p = makePlayer(i, isMe, h.name, h.skin, diff); p.human = true;
      if (!isMe) { p.ai = null; p.remote = h.id; NET.byPeer.set(h.id, p); }
    } else {
      const isP = !demo && !opts.net && i === 0;
      p = makePlayer(i, isP, isP ? 'You' : names[i % names.length], isP ? profile.skin : (Math.random() * SKINS.length) | 0, diff);
      p.human = isP;
    }
    G.players.push(p);
  }
  if (!demo) G.me = G.players.find(p => p.isPlayer) || null;
  // storm
  G.storm = { phase: 0, state: 'wait', t: PHASES[0].wait, cx: WORLD / 2, cy: WORLD / 2, r: WORLD * 0.76, nx: 0, ny: 0, nr: PHASES[0].nr, sx: 0, sy: 0, sr: 0, dps: 1 };
  pickNextCircle();
  if (demo) {
    for (const p of G.players) {
      let x, y; do { x = fr(300, WORLD - 300); y = fr(300, WORLD - 300); } while (collidesAt(x, y, 20));
      p.x = x; p.y = y; p.state = 'ground'; p.angle = fr(0, TAU);
      const wid = pick(WIDS); p.inv[0] = mkWeapon(wid, (Math.random() * 5) | 0); p.ammo[WEAPONS[wid].ammo] = 200; p.shield = 50;
      p.inv[1] = { kind: 'heal', hid: 'bandage', count: 5 };
    }
    G.storm.t = 40; G.storm.r = WORLD * 0.6; G.storm.nr = 900;
    pickNextCircle(true);
    G.camTarget = pick(G.players);
    cam.x = G.camTarget.x; cam.y = G.camTarget.y;
    Music.mode = 'menu';
  } else {
    // bus path
    const a = Math.random() * TAU, off = fr(-650, 650), cx = WORLD / 2 - Math.sin(a) * off, cy = WORLD / 2 + Math.cos(a) * off, L = 3300;
    G.bus = { x0: cx - Math.cos(a) * L, y0: cy - Math.sin(a) * L, x1: cx + Math.cos(a) * L, y1: cy + Math.sin(a) * L, a, t: 0, dur: 28, x: 0, y: 0, done: false };
    G.bus.x = G.bus.x0; G.bus.y = G.bus.y0;
    for (const p of G.players) {
      p.x = G.bus.x; p.y = G.bus.y;
      if (p.ai) {
        // choose landing target
        let tx, ty;
        for (let k = 0; k < 25; k++) {
          if (Math.random() < 0.45) { const poi = pick(world.pois); tx = poi.x + fr(-380, 380); ty = poi.y + fr(-380, 380); } else { tx = fr(400, WORLD - 400); ty = fr(400, WORLD - 400); }
          if (G.players.every(q => !q.ai || q === p || !q.ai.landX || d2(q.ai.landX, q.ai.landY, tx, ty) > 520 * 520)) break;
        }
        const B = G.bus, dx = B.x1 - B.x0, dy = B.y1 - B.y0;
        const t = clamp(((tx - B.x0) * dx + (ty - B.y0) * dy) / (dx * dx + dy * dy), 0.05, 0.95);
        // glide range ~4000 -> ok
        p.ai.jumpAt = clamp(t - fr(0.02, 0.1), 0.03, 0.96); p.ai.landX = tx; p.ai.landY = ty;
      }
    }
    cam.x = G.bus.x; cam.y = G.bus.y; cam.zoom = baseZoom() * 0.35;
    G.showMap = true;
    Music.mode = 'game'; Music.intensity = 0;
    banner('BOARDING COMPLETE', 'Press SPACE or click to jump', '#ffb627');
  }
}
function pickNextCircle(keepPhase) {
  const S = G.storm;
  const maxOff = Math.max(0, S.r - S.nr) * 0.85;
  let nx, ny, tries = 0;
  do { const a = fr(0, TAU), r = Math.sqrt(Math.random()) * maxOff; nx = S.cx + Math.cos(a) * r; ny = S.cy + Math.sin(a) * r; tries++; }
  while ((nx - S.nr < 150 || ny - S.nr < 150 || nx + S.nr > WORLD - 150 || ny + S.nr > WORLD - 150) && tries < 40 && S.nr < 2000);
  S.nx = clamp(nx, S.nr * 0.3, WORLD - S.nr * 0.3); S.ny = clamp(ny, S.nr * 0.3, WORLD - S.nr * 0.3);
  if (S.nr === 0) { S.nx = S.cx + fr(-60, 60); S.ny = S.cy + fr(-60, 60); }
}
function baseZoom() { return Math.max(W, H) / 1500; }

// ---------- messages ----------
function banner(text, sub, color = '#fff', dur = 3.2) { if (G.demo) return; G.banners.push({ text, sub, color, t: 0, dur }); if (G.banners.length > 3) G.banners.shift(); }
function toast(text) { if (G.demo) return; G.toasts = [{ text, t: 0 }]; }
function feed(text, mine) { G.feed.unshift({ text, t: 0, mine }); if (G.feed.length > 6) G.feed.pop(); }
function floatText(x, y, text, color, size = 18) { if (G.floats.length > 60) G.floats.shift(); G.floats.push({ x: x + fr(-8, 8), y: y - 20, vy: -60, text, color, t: 0, size }); }

// ---------- particles ----------
const MAXP = () => settings.quality === 'low' ? 260 : 700;
function part(type, x, y, vx, vy, life, size, color, extra) {
  const P = G.parts; if (P.length >= MAXP()) P.shift();
  const p = { type, x, y, vx, vy, life, max: life, size, color, rot: Math.random() * TAU, vr: fr(-8, 8) };
  if (extra) Object.assign(p, extra);
  P.push(p); return p;
}
function sparks(x, y, ang, n, color = '#ffd27a') { for (let i = 0; i < n; i++) { const a = ang + fr(-0.9, 0.9), s = fr(150, 520); part('spark', x, y, Math.cos(a) * s, Math.sin(a) * s, fr(0.12, 0.3), fr(1, 2.2), color); } }
function puff(x, y, n, color, s0 = 30, s1 = 90, size = 10, life = 0.8) { for (let i = 0; i < n; i++) { const a = fr(0, TAU), s = fr(s0, s1); part('smoke', x, y, Math.cos(a) * s, Math.sin(a) * s, fr(life * 0.6, life * 1.3), fr(size * 0.6, size * 1.3), color); } }
function addShake(v) { if (settings.shake) cam.shake = Math.min(1, cam.shake + v); }

// =====================================================================
//  PHYSICS
// =====================================================================
function segAABB(x0, y0, dx, dy, w) {
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) { if (x0 < w.x || x0 > w.x + w.w) return -1; }
  else { let t1 = (w.x - x0) / dx, t2 = (w.x + w.w - x0) / dx; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  if (Math.abs(dy) < 1e-9) { if (y0 < w.y || y0 > w.y + w.h) return -1; }
  else { let t1 = (w.y - y0) / dy, t2 = (w.y + w.h - y0) / dy; if (t1 > t2) { const t = t1; t1 = t2; t2 = t; } if (t1 > tmin) tmin = t1; if (t2 < tmax) tmax = t2; if (tmin > tmax) return -1; }
  return tmin;
}
function segCircle(x0, y0, dx, dy, cx, cy, r) {
  const fx = x0 - cx, fy = y0 - cy, a = dx * dx + dy * dy, b = 2 * (fx * dx + fy * dy), c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0; const disc = b * b - 4 * a * c; if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a); return t >= 0 && t <= 1 ? t : -1;
}
const _los = [];
function losClear(x0, y0, x1, y1) {
  const L = queryWalls(x0, y0, x1, y1, _los), dx = x1 - x0, dy = y1 - y0;
  for (let i = 0; i < L.length; i++) { const w = L[i]; if (w.low) continue; const t = segAABB(x0, y0, dx, dy, w); if (t >= 0 && t < 1) return false; }
  return true;
}
function shotClear(x0, y0, x1, y1) { // for bots: no walls nor low cover in between
  const L = queryWalls(x0, y0, x1, y1, _los), dx = x1 - x0, dy = y1 - y0;
  for (let i = 0; i < L.length; i++) { const t = segAABB(x0, y0, dx, dy, L[i]); if (t >= 0 && t < 0.97) return false; }
  return true;
}
function collide(p) {
  const r = p.r;
  for (const w of queryWalls(p.x - r - 4, p.y - r - 4, p.x + r + 4, p.y + r + 4)) {
    const cx = clamp(p.x, w.x, w.x + w.w), cy = clamp(p.y, w.y, w.y + w.h); const dx = p.x - cx, dy = p.y - cy, dd = dx * dx + dy * dy;
    if (dd >= r * r) continue;
    if (dd > 1e-6) { const d = Math.sqrt(dd), push = r - d; p.x += dx / d * push; p.y += dy / d * push; }
    else { const l = p.x - w.x, rr2 = w.x + w.w - p.x, t = p.y - w.y, b = w.y + w.h - p.y, m = Math.min(l, rr2, t, b); if (m === l) p.x = w.x - r; else if (m === rr2) p.x = w.x + w.w + r; else if (m === t) p.y = w.y - r; else p.y = w.y + w.h + r; }
  }
  for (const c of queryCircles(p.x - r - 50, p.y - r - 50, p.x + r + 50, p.y + r + 50)) {
    const dx = p.x - c.x, dy = p.y - c.y, dd = dx * dx + dy * dy, R = r + c.r;
    if (dd < R * R && dd > 1e-6) { const d = Math.sqrt(dd); p.x = c.x + dx / d * R; p.y = c.y + dy / d * R; }
  }
  p.x = clamp(p.x, 20, WORLD - 20); p.y = clamp(p.y, 20, WORLD - 20);
}

// =====================================================================
//  COMBAT
// =====================================================================
function selectSlot(p, i) {
  if (i === p.sel || i < 0 || i > 4) return;
  p.sel = i; p.reloadT = 0; p.useT = 0; p.equipT = 0.22; p.bloom = 0.04;
  if (p.isPlayer) AU.play('swap');
  const w = curWeapon(p);
  if (w && w.mag <= 0 && p.ammo[WEAPONS[w.wid].ammo] > 0) p.autoReload = true;
}
function startReload(p) {
  const it = curWeapon(p); if (!it || p.reloadT > 0) return;
  const Wd = WEAPONS[it.wid]; if (it.mag >= Wd.mag || p.ammo[Wd.ammo] <= 0) return;
  p.useT = 0;
  p.reloadMax = Wd.perShell ? Wd.reload * RELMUL[it.rar] : Wd.reload * RELMUL[it.rar]; p.reloadT = p.reloadMax;
  if (!G.demo) { const s = p.isPlayer ? { vol: 1, pan: 0 } : spatial(p.x, p.y); if (s.vol > 0.05) AU.play(Wd.perShell ? 'shell' : 'magOut', s.vol * (p.isPlayer ? 1 : 0.6), s.pan); }
}
function finishReload(p) {
  const it = curWeapon(p); if (!it) return; const Wd = WEAPONS[it.wid];
  const sp = !G.demo ? (p.isPlayer ? { vol: 1, pan: 0 } : spatial(p.x, p.y)) : { vol: 0, pan: 0 };
  if (Wd.perShell) {
    if (p.ammo[Wd.ammo] > 0 && it.mag < Wd.mag) { it.mag++; p.ammo[Wd.ammo]--; }
    if (it.mag < Wd.mag && p.ammo[Wd.ammo] > 0) { p.reloadT = p.reloadMax; if (sp.vol > 0.05) AU.play('shell', sp.vol * (p.isPlayer ? 1 : 0.6), sp.pan); }
    else { p.reloadT = 0; if (sp.vol > 0.05) AU.play('pump', sp.vol * (p.isPlayer ? 1 : 0.6), sp.pan); }
  } else {
    const take = Math.min(Wd.mag - it.mag, p.ammo[Wd.ammo]); it.mag += take; p.ammo[Wd.ammo] -= take; p.reloadT = 0;
    if (sp.vol > 0.05) AU.play(Wd.scope ? 'bolt' : 'magIn', sp.vol * (p.isPlayer ? 1 : 0.6), sp.pan);
  }
}
function tryFire(p) {
  if (p.equipT > 0 || p.fireCd > 0) return;
  const it = curItem(p);
  if (!it) { melee(p); return; }
  if (it.kind === 'heal') { if (p.useT <= 0) startUse(p); return; }
  if (it.kind === 'frag') { throwFrag(p); return; }
  if (it.kind !== 'weapon') return;
  const Wd = WEAPONS[it.wid];
  if (p.reloadT > 0) { if (Wd.perShell && it.mag > 0) p.reloadT = 0; else return; }
  if (it.mag <= 0) {
    if (p.ammo[Wd.ammo] > 0) startReload(p);
    else if (p.isPlayer && p.emptyT <= 0) { AU.play('empty'); p.emptyT = 0.35; toast('No ' + AMMO[Wd.ammo].name); }
    return;
  }
  it.mag--; p.fireCd = 1 / Wd.rate; p.firedT = 0; p.recoil = 1;
  const moving = Math.hypot(p.vx, p.vy) > 60;
  let spread = (Wd.spread + p.bloom) * (p.ads ? 0.42 : 1) * (moving ? 1.35 : 1);
  if (Wd.scope && !p.ads) spread += 0.09;
  p.bloom = Math.min(Wd.bloomMax, p.bloom + Wd.bloomAdd);
  const dmg = Wd.dmg * DMGMUL[it.rar], angs = [];
  for (let i = 0; i < Wd.pellets; i++) {
    const a = p.angle + (Wd.pellets > 1 ? (i / (Wd.pellets - 1) - 0.5) * 2 * spread * 0.8 + fr(-0.03, 0.03) : fr(-1, 1) * spread);
    angs.push(Math.round(a * 1000) / 1000);
    spawnBullet(p, p.x, p.y, a, it.wid, it.rar, dmg);
  }
  netEv(['s', p.id, Math.round(p.x), Math.round(p.y), angs, it.wid, it.rar]);
  shotFx(p, it.wid);
  // alert nearby bots
  for (const o of G.players) if (o.ai && o !== p && o.alive && o.state === 'ground' && o.ai.aggro > 0.45 && o.ai.alertT < -10) { const dd = d2(o.x, o.y, p.x, p.y); if (dd < 750 * 750 && (!o.ai.target || o.ai.seenT > 2) && Math.random() < 0.15) { o.ai.alertX = p.x + fr(-160, 160); o.ai.alertY = p.y + fr(-160, 160); o.ai.alertT = 5; } }
  if (it.mag === 0 && p.ammo[Wd.ammo] > 0) p.autoReload = true;
}
function spawnBullet(p, x, y, a, wid, rar, dmg) {
  const Wd = WEAPONS[wid];
  G.bullets.push({ x, y, px: x, py: y, vx: Math.cos(a) * Wd.speed, vy: Math.sin(a) * Wd.speed, dmg, owner: p, wid, rar, trav: 0, range: Wd.range, first: Wd.muzzle + 4, alive: true, tail: [] });
}
function shotFx(p, wid, ox, oy) {
  const Wd = WEAPONS[wid], px = ox != null ? ox : p.x, py = oy != null ? oy : p.y;
  const mx = px + Math.cos(p.angle) * (Wd.muzzle + 12), my = py + Math.sin(p.angle) * (Wd.muzzle + 12);
  part('flash', mx, my, 0, 0, 0.06, Wd.pellets > 1 ? 34 : 26, '#ffd27a');
  part('mflash', mx, my, 0, 0, 0.05, Wd.pellets > 1 ? 16 : 11, '#fff3c4', { ang: p.angle });
  for (let i = 0; i < 2; i++) part('smoke', mx, my, Math.cos(p.angle) * fr(20, 60) + fr(-15, 15), Math.sin(p.angle) * fr(20, 60) + fr(-15, 15), fr(0.3, 0.6), fr(4, 8), 'rgba(200,200,200,0.25)');
  if (!Wd.perShell) { const pa = p.angle + Math.PI / 2; part('shell', px + Math.cos(p.angle) * 14, py + Math.sin(p.angle) * 14, Math.cos(pa) * fr(90, 160) + fr(-20, 20), Math.sin(pa) * fr(90, 160) + fr(-20, 20), fr(1.5, 3), 3, Wd.ammo === 'heavy' ? '#c9a13a' : '#d4af37'); }
  else p.pumpT = 0.35;
  if (!G.demo) {
    if (p.isPlayer) { AU.gun(wid, 0.9); addShake(Wd.shake * 0.045); cam.kick = Wd.kick; cam.kx = -Math.cos(p.angle); cam.ky = -Math.sin(p.angle); }
    else { const s = spatial(px, py); AU.gun(wid, s.vol * 0.75, s.pan, s.far); }
  }
}
function melee(p) {
  p.fireCd = 0.6; p.swing = 1; p.firedT = 0;
  const reach = 46;
  let hit = null;
  for (const o of G.players) {
    if (o === p || !o.alive || o.state !== 'ground') continue;
    const dd = d2(o.x, o.y, p.x, p.y); if (dd > (reach + o.r) ** 2) continue;
    if (Math.abs(angDiff(p.angle, Math.atan2(o.y - p.y, o.x - p.x))) < 0.9) { hit = o; break; }
  }
  const s = p.isPlayer ? { vol: 1, pan: 0 } : spatial(p.x, p.y);
  if (!G.demo) AU.play('melee', s.vol * 0.7, s.pan);
  if (hit) { damage(hit, 16, p, 'melee'); if (!G.demo) AU.play('thud', s.vol, s.pan); hit.vx += Math.cos(p.angle) * 220; hit.vy += Math.sin(p.angle) * 220; }
}
function startUse(p) {
  const it = curItem(p), H = HEALS[it.hid];
  if (H.hp && p.hp >= H.cap) { if (p.isPlayer && p.emptyT <= 0) { toast(p.hp >= 100 ? 'Health is full' : 'Bandages only heal to ' + H.cap); p.emptyT = 0.6; } return; }
  if (H.sh && p.shield >= H.cap) { if (p.isPlayer && p.emptyT <= 0) { toast(p.shield >= 100 ? 'Shield is full' : 'Small shields only stack to ' + H.cap); p.emptyT = 0.6; } return; }
  p.useT = H.time; p.useMax = H.time; p.reloadT = 0;
  if (p.isPlayer) AU.play('healStart');
}
function finishUse(p) {
  const it = curItem(p); if (!it || it.kind !== 'heal') return;
  const H = HEALS[it.hid];
  if (H.hp) { p.hp = Math.min(Math.max(p.hp, H.cap), p.hp + H.hp); if (H.cap === 100 && H.hp >= 100) p.hp = 100; p.hp = Math.min(p.hp, H.cap); }
  if (H.sh) p.shield = Math.min(H.cap > p.shield ? H.cap : p.shield, p.shield + H.sh);
  it.count--; if (it.count <= 0) p.inv[p.sel] = null;
  if (p.isPlayer) { AU.play(H.sh ? 'shieldUp' : 'heal'); for (let i = 0; i < 14; i++) part('glint', p.x + fr(-16, 16), p.y + fr(-16, 16), fr(-20, 20), fr(-60, -20), fr(0.5, 0.9), fr(2, 3.5), H.sh ? '#6fd3ff' : '#9ee37d'); }
}
function throwFrag(p) {
  const it = curItem(p);
  let tx, ty;
  if (p.isPlayer && !touch.on) { tx = mouse.wx; ty = mouse.wy; } else { const r = p.isPlayer ? 380 : Math.min(450, p.ai && p.ai.target ? Math.sqrt(d2(p.x, p.y, p.ai.target.x, p.ai.target.y)) : 300); tx = p.x + Math.cos(p.angle) * r; ty = p.y + Math.sin(p.angle) * r; }
  let dx = tx - p.x, dy = ty - p.y; const dl = Math.hypot(dx, dy) || 1, dist = Math.min(520, dl);
  dx /= dl; dy /= dl;
  const sp = dist * 1.55 + 20;
  G.grenades.push({ x: p.x + dx * 18, y: p.y + dy * 18, vx: dx * sp, vy: dy * sp, z: 10, vz: 260, t: 2.1, owner: p, rot: 0 });
  netEv(['gr', p.id, Math.round(p.x + dx * 18), Math.round(p.y + dy * 18), Math.round(dx * sp), Math.round(dy * sp)]);
  it.count--; if (it.count <= 0) p.inv[p.sel] = null;
  p.fireCd = 0.8; p.swing = 1;
  if (!G.demo) { const s = p.isPlayer ? { vol: 1, pan: 0 } : spatial(p.x, p.y); AU.play('pin', s.vol, s.pan); }
}
function explode(g) {
  const R = 170;
  part('flash', g.x, g.y, 0, 0, 0.18, 190, '#ffcf70');
  part('ring', g.x, g.y, 0, 0, 0.45, R, 'rgba(255,230,180,0.7)');
  for (let i = 0; i < 26; i++) { const a = fr(0, TAU), s = fr(200, 700); part('spark', g.x, g.y, Math.cos(a) * s, Math.sin(a) * s, fr(0.2, 0.5), fr(1.5, 3), '#ffb347'); }
  puff(g.x, g.y, 16, 'rgba(70,64,58,0.55)', 40, 160, 26, 1.6);
  puff(g.x, g.y, 8, 'rgba(255,150,60,0.45)', 20, 100, 18, 0.5);
  for (let i = 0; i < 10; i++) { const a = fr(0, TAU), s = fr(120, 380); part('debris', g.x, g.y, Math.cos(a) * s, Math.sin(a) * s, fr(0.6, 1.2), fr(2, 4), '#4b4033'); }
  world.decals.push({ x: g.x, y: g.y, r: 54, rot: fr(0, TAU), t: 0 }); if (world.decals.length > 40) world.decals.shift();
  if (!G.demo) { const s = spatial(g.x, g.y); AU.play('explode', Math.min(1, s.vol * 1.3), s.pan); const d = Math.sqrt(d2(g.x, g.y, cam.x, cam.y)); addShake(clamp(0.7 - d / 1400, 0, 0.7)); }
  if (G.isClient) return;
  for (const o of G.players) {
    if (!o.alive || o.state !== 'ground') continue;
    const d = Math.sqrt(d2(o.x, o.y, g.x, g.y)); if (d > R + o.r) continue;
    if (!losClear(g.x, g.y, o.x, o.y)) continue;
    const dmg = lerp(95, 22, clamp(d / R, 0, 1));
    damage(o, dmg, g.owner, 'frag');
    const a = Math.atan2(o.y - g.y, o.x - g.x); o.vx += Math.cos(a) * 380; o.vy += Math.sin(a) * 380;
  }
}
function damage(t, amount, src, wid) {
  if (!t.alive || G.over && t.isPlayer || (t.isPlayer && dbg.god)) return;
  if (src && src.ai && t.human) amount *= DIFF[G.diff].dmgVsPlayer;
  else if (src && src.ai && t.ai) amount *= 0.17; // bot-vs-bot pacing
  amount = Math.round(amount);
  let sh = 0, hp = 0;
  if (t.shield > 0) { sh = Math.min(t.shield, amount); t.shield -= sh; amount -= sh; if (t.shield <= 0 && sh > 0) shieldBreakFx(t); }
  hp = Math.min(t.hp, amount); t.hp -= hp;
  netEv(['d', t.id, sh, hp, src ? src.id : -1]);
  t.hitFlash = 1; t.barT = 3;
  if (src) { t.lastHitBy = src; t.lastHitW = wid; src.dmgDealt += sh + hp; }
  const viewer = G.me && G.me.alive ? G.me : null;
  if (src && src.isPlayer) {
    if (sh > 0) floatText(t.x, t.y, String(sh), '#6fd3ff', 20);
    if (hp > 0) floatText(t.x, t.y - (sh ? 18 : 0), String(hp), hp >= 50 ? '#ffd166' : '#ffffff', hp >= 50 ? 26 : 20);
    G.hitMarker = 1; G.hitKill = false;
    AU.play(sh > 0 && hp === 0 ? 'hitShield' : 'hit');
  }
  // fx
  const col = sh > 0 && hp === 0 ? '#79d4ff' : '#8a1f1f';
  for (let i = 0; i < (hp > 0 ? 5 : 4); i++) part(sh > 0 && hp === 0 ? 'shard' : 'blood', t.x + fr(-6, 6), t.y + fr(-6, 6), fr(-120, 120), fr(-120, 120), fr(0.25, 0.6), fr(1.5, 3), col);
  if (t.isPlayer) {
    addShake(0.12 + (sh + hp) / 300); G.vign = Math.min(1, G.vign + 0.5);
    if (src && src !== t) G.dmgDirs.push({ a: Math.atan2(src.y - t.y, src.x - t.x), t: 0 });
    if (hp > 0) AU.play('hurt'); else if (sh > 0) AU.play('hitShield', 0.6);
  }
  if (t.ai && src && src !== t && src.alive) {
    const ai = t.ai; if (!ai.target || ai.seenT > 1.5 || Math.random() < 0.4) { ai.target = src; ai.seenT = 0; ai.lastX = src.x; ai.lastY = src.y; ai.reactT = Math.min(ai.reactT, ai.react * 0.6); ai.curErr = ai.err; }
  }
  if (t.hp <= 0) eliminate(t, src, wid);
}
function shieldBreakFx(t) {
  for (let i = 0; i < 14; i++) { const a = fr(0, TAU), s = fr(80, 240); part('shard', t.x, t.y, Math.cos(a) * s, Math.sin(a) * s, fr(0.3, 0.7), fr(2, 4), '#8fe1ff'); }
  if (!G.demo) { const s = t.isPlayer ? { vol: 1, pan: 0 } : spatial(t.x, t.y); AU.play('shieldBreak', s.vol, s.pan); }
}
function wName(wid, rar) { if (wid === 'storm') return 'the storm'; if (wid === 'melee') return 'bare hands'; if (wid === 'frag') return 'a frag grenade'; return (rar != null ? RAR[rar].n + ' ' : '') + (WEAPONS[wid] ? WEAPONS[wid].name : wid); }
function eliminate(t, src, wid) {
  t.alive = false; t.deathT = 0; t.hp = 0; t.place = G.players.filter(p => p.alive).length + 1;
  t.killer = src && src !== t ? src : null;
  G.bodies.push({ x: t.x, y: t.y, angle: t.angle, skin: t.skin, t: 0, p: t });
  // spill loot
  for (const it of t.inv) if (it) dropItem(it, t.x, t.y, true);
  for (const k in t.ammo) if (t.ammo[k] > 0) dropItem({ kind: 'ammo', type: k, amount: Math.min(t.ammo[k], AMMO[k].max) }, t.x, t.y, true);
  t.inv = [null, null, null, null, null];
  puff(t.x, t.y, 10, 'rgba(180,180,190,0.4)', 20, 90, 14, 0.9);
  for (let i = 0; i < 12; i++) { const a = fr(0, TAU), s = fr(60, 200); part('glint', t.x, t.y, Math.cos(a) * s, Math.sin(a) * s, fr(0.4, 0.9), fr(2, 3.5), '#e9edf2'); }
  const killerName = t.killer ? t.killer.name : null;
  const wn = wName(wid, t.killer && wid && WEAPONS[wid] && t.lastHitW === wid ? (findRar(t.killer, wid)) : null);
  netEv(['k', t.id, t.killer ? t.killer.id : -1, wn, t.place]);
  if (killerName) { t.killer.kills++; feed(`${killerName} eliminated ${t.name} with ${wn}`, t.killer.isPlayer || t.isPlayer); }
  else feed(`${t.name} was lost to the storm`, t.isPlayer);
  G.alive = G.players.filter(p => p.alive).length;
  if (G.demo) return;
  if (t.killer && t.killer.isPlayer) {
    G.hitMarker = 1; G.hitKill = true; if (!G.online) G.hitStop = 0.07; addShake(0.25); AU.play('kill');
    banner('ELIMINATED ' + t.name.toUpperCase(), G.alive + (G.alive === 1 ? ' player left' : ' players left'), '#ffb627', 2.2);
  } else if (!t.isPlayer && G.me && G.me.alive) {
    const s = spatial(t.x, t.y); if (s.vol > 0.1) AU.play('elim', s.vol * 0.7, s.pan);
  }
  if (t.isPlayer) {
    G.over = true; G.endT = 0; G.result = { win: false, place: t.place, killer: killerName, weapon: wn };
    G.camTarget = t.killer && t.killer.alive ? t.killer : null; G.showMap = false;
    AU.play('defeat'); addShake(0.5); if (!G.online) G.timeScale = 0.35;
  }
  if (G.isHost && G.alive === 1) { const w = G.players.find(q => q.alive); if (w && w.remote) netEv(['w', w.id]); }
  if (G.me && G.me.alive && G.alive === 1) {
    G.over = true; G.endT = 0; G.result = { win: true, place: 1 }; G.timeScale = 0.4;
    AU.play('victory'); banner('VICTORY', 'Last one standing', '#ffb627', 6); Music.mode = 'menu';
  }
}
function findRar(p, wid) { const w = p.inv.find(i => i && i.kind === 'weapon' && i.wid === wid); return w ? w.rar : null; }

// ---------- pickup ----------
function canStack(p, it) {
  if (it.kind === 'heal') return p.inv.findIndex(s => s && s.kind === 'heal' && s.hid === it.hid && s.count < HEALS[it.hid].max);
  if (it.kind === 'frag') return p.inv.findIndex(s => s && s.kind === 'frag' && s.count < FRAG_MAX);
  return -1;
}
function pickup(p, wi) {
  const o = world.items[wi]; if (!o) return false; const it = o.it;
  const fx = (ok) => {
    if (!ok) return; world.items.splice(wi, 1); netEv(['id', o.id]); netEv(['pk', p.id, it.kind === 'ammo' ? 1 : 0]);
    if (p.isPlayer) { AU.play(it.kind === 'ammo' ? 'ammo' : 'pickup'); for (let i = 0; i < 6; i++) part('glint', o.x, o.y, fr(-40, 40), fr(-40, 40), 0.4, 2.5, itemColor(it)); }
  };
  if (it.kind === 'ammo') {
    const A = AMMO[it.type], take = Math.min(it.amount, A.max - p.ammo[it.type]);
    if (take <= 0) { if (p.isPlayer) toast(A.name + ' is full'); return false; }
    p.ammo[it.type] += take; it.amount -= take;
    if (it.amount <= 0) fx(true); else { netEv(['iu', o.id, it.amount]); netEv(['pk', p.id, 1]); if (p.isPlayer) AU.play('ammo'); }
    const w = curWeapon(p); if (w && w.mag === 0 && WEAPONS[w.wid].ammo === it.type) p.autoReload = true;
    return true;
  }
  if (it.kind === 'heal' || it.kind === 'frag') {
    let idx = canStack(p, it);
    while (idx >= 0 && it.count > 0) {
      const s = p.inv[idx], max = it.kind === 'heal' ? HEALS[it.hid].max : FRAG_MAX, add = Math.min(it.count, max - s.count);
      s.count += add; it.count -= add; idx = canStack(p, it);
    }
    if (it.count <= 0) { fx(true); return true; }
  }
  let empty = p.inv.indexOf(null);
  if (empty >= 0) {
    p.inv[empty] = Object.assign({}, it); fx(true);
    if (p.isPlayer && !curItem(p)) selectSlot(p, empty);
    else if (p.isPlayer && curItem(p) === null) selectSlot(p, empty);
    return true;
  }
  // swap with current slot
  const cur = curItem(p);
  if (cur) { dropItem(cur, p.x + fr(-10, 10), p.y + fr(-10, 10), false); }
  p.inv[p.sel] = Object.assign({}, it); fx(true); p.reloadT = 0; p.useT = 0; p.equipT = 0.2;
  return true;
}
function openChest(p, c) {
  if (c.open) return; c.open = true; c.t = 0; netEv(['co', world.chests.indexOf(c), p.id]);
  rng = Math.random;
  spawnLoot(c.x, c.y, 'chest', true);
  for (let i = 0; i < 18; i++) { const a = fr(0, TAU), s = fr(40, 160); part('glint', c.x, c.y, Math.cos(a) * s, Math.sin(a) * s, fr(0.5, 1), fr(2, 3.5), '#ffd76a'); }
  if (!G.demo) { const s = p.isPlayer ? { vol: 1, pan: 0 } : spatial(c.x, c.y); AU.play('chest', s.vol, s.pan); }
}
function nearestInteract(p) {
  let best = null, bd = 64 * 64;
  for (let i = 0; i < world.items.length; i++) { const o = world.items[i]; const dd = d2(o.x, o.y, p.x, p.y); if (dd < bd && o.it.kind !== 'ammo') { bd = dd; best = { type: 'item', i, o }; } }
  for (const c of world.chests) { if (c.open) continue; const dd = d2(c.x, c.y, p.x, p.y); if (dd < 76 * 76 && (!best || dd < bd)) { bd = dd; best = { type: 'chest', c }; } }
  for (const s of G.supply) { if (!s.landed || s.open) continue; const dd = d2(s.x, s.y, p.x, p.y); if (dd < 80 * 80) { best = { type: 'supply', s }; } }
  return best;
}
function interact(p) {
  const n = nearestInteract(p); if (!n) return;
  if (n.type === 'item') pickup(p, n.i);
  else if (n.type === 'chest') openChest(p, n.c);
  else if (n.type === 'supply') { n.s.open = true; rng = Math.random; spawnLoot(n.s.x, n.s.y, 'supply', true); if (p.isPlayer) AU.play('chest'); puff(n.s.x, n.s.y, 10, 'rgba(230,230,230,0.5)', 30, 100, 16, 1); }
}

// =====================================================================
//  UPDATE
// =====================================================================
function step(dt) {
  G.time += dt;
  if (G.bus && !G.bus.done) updateBus(dt);
  updateStorm(dt);
  for (const p of G.players) {
    if (!p.alive) continue;
    if (p.state === 'drop') updateDrop(p, dt);
    else if (p.state === 'ground') updateGround(p, dt);
    else if (p.state === 'bus') { p.x = G.bus.x; p.y = G.bus.y; }
  }
  // soft separation
  for (let i = 0; i < G.players.length; i++) {
    const a = G.players[i]; if (!a.alive || a.state !== 'ground') continue;
    for (let j = i + 1; j < G.players.length; j++) {
      const b = G.players[j]; if (!b.alive || b.state !== 'ground') continue;
      const dd = d2(a.x, a.y, b.x, b.y), R = a.r + b.r; if (dd < R * R && dd > 0.01) { const d = Math.sqrt(dd), push = (R - d) / 2, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d; a.x += nx * push; a.y += ny * push; b.x -= nx * push; b.y -= ny * push; }
    }
  }
  updateBullets(dt);
  updateGrenades(dt);
  updateSupply(dt);
  updateItems(dt);
  if (G.demo) {
    G.camSwitchT -= dt;
    if (!G.camTarget || !G.camTarget.alive || G.camSwitchT <= 0) { const al = G.players.filter(p => p.alive); if (al.length) { G.camTarget = pick(al); G.camSwitchT = 14; } }
    if (G.alive <= 3) newMatch(true);
  } else if (G.over) {
    G.endT += dt;
    if (G.endT > (G.result.win ? 2.6 : 1.4) * G.timeScale + 0.3 && !G.resultShown) { G.resultShown = true; showResults(); }
  }
}
function updateBus(dt) {
  const B = G.bus; B.t += dt / B.dur;
  B.x = lerp(B.x0, B.x1, B.t); B.y = lerp(B.y0, B.y1, B.t);
  for (const p of G.players) {
    if (p.state !== 'bus') continue;
    if (p.ai && B.t >= p.ai.jumpAt) jump(p);
    else if (B.t >= 0.985) jump(p);
  }
  if (B.t >= 1) B.done = true;
}
function jump(p) {
  if (p.state !== 'bus') return;
  p.state = 'drop'; p.alt = 1; p.x = G.bus.x + fr(-20, 20); p.y = G.bus.y + fr(-20, 20); p.vx = Math.cos(G.bus.a) * 200; p.vy = Math.sin(G.bus.a) * 200;
  if (p.isPlayer) { AU.play('jump'); G.showMap = false; banner('', 'Steer with WASD — head for a town', '#fff', 2.5); }
}
function updateDrop(p, dt) {
  let mx = 0, my = 0;
  if (p.isPlayer) { const c = readMove(); mx = c.x; my = c.y; }
  else if (p.remote) { if (p.net) { mx = p.net.mx; my = p.net.my; } }
  else { const dx = p.ai.landX - p.x, dy = p.ai.landY - p.y, d = Math.hypot(dx, dy); if (d > 30) { mx = dx / d; my = dy / d; } }
  const sp = 430, k = 1 - Math.exp(-3 * dt);
  p.vx = lerp(p.vx, mx * sp, k); p.vy = lerp(p.vy, my * sp, k);
  p.x = clamp(p.x + p.vx * dt, 40, WORLD - 40); p.y = clamp(p.y + p.vy * dt, 40, WORLD - 40);
  if (Math.abs(p.vx) + Math.abs(p.vy) > 10) p.angle = Math.atan2(p.vy, p.vx);
  p.alt -= dt / 11;
  if (p.alt <= 0) {
    p.alt = 0; p.state = 'ground'; p.landT = 0.4; collide(p); collide(p);
    puff(p.x, p.y, 10, 'rgba(150,130,100,0.45)', 30, 110, 12, 0.7);
    if (p.isPlayer) { AU.play('land'); addShake(0.2); G.showMap = false; Music.intensity = 1; }
    if (p.ai) { p.ai.mode = 'loot'; p.ai.think = 0; }
  }
}
function readMove() {
  let x = 0, y = 0;
  if (touch.on && touch.L.active) { x = touch.L.x; y = touch.L.y; }
  else {
    if (keys.KeyW || keys.ArrowUp) y -= 1; if (keys.KeyS || keys.ArrowDown) y += 1;
    if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1;
  }
  const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
  return { x, y };
}
function playerInput(p) {
  const m = readMove(); p.ctl.mx = m.x; p.ctl.my = m.y;
  if (touch.on) {
    if (touch.R.active && Math.hypot(touch.R.x, touch.R.y) > 0.2) p.angle = Math.atan2(touch.R.y, touch.R.x);
    else if (Math.hypot(m.x, m.y) > 0.2) p.angle = lerpAngle(p.angle, Math.atan2(m.y, m.x), 0.2);
    p.ctl.fire = touch.R.active && Math.hypot(touch.R.x, touch.R.y) > 0.55;
    p.ctl.ads = touch.ads;
  } else {
    p.angle = Math.atan2(mouse.wy - p.y, mouse.wx - p.x);
    p.ctl.fire = mouse.down && !G.showMap; p.ctl.ads = mouse.right;
  }
}
function lerpAngle(a, b, t) { return a + angDiff(a, b) * t; }
function stepFx(p, sp, dt) {
  p.walk += sp * dt; p.stepAcc += sp * dt;
  if (p.stepAcc > 62) {
    p.stepAcc = 0;
    if (!G.demo) {
      const indoor = !!buildingAt(p.x, p.y);
      if (p.isPlayer) AU.play(indoor ? 'stepIn' : 'step', 0.8);
      else { const s = spatial(p.x, p.y); if (s.vol > 0.35 && sp > 150) AU.play(indoor ? 'stepIn' : 'step', (s.vol - 0.3) * 1.2, s.pan); }
    }
  }
}
function bushCheck(p) {
  let bush = null;
  for (const b of world.bushes) { if (Math.abs(b.x - p.x) < 45 && Math.abs(b.y - p.y) < 45 && d2(b.x, b.y, p.x, p.y) < b.r * b.r) { bush = b; break; } }
  if (bush && bush !== p.inBush) { bush.shake = 1; if (!G.demo) { const s = p.isPlayer ? { vol: 1, pan: 0 } : spatial(p.x, p.y); if (s.vol > 0.2) AU.play('bush', s.vol, s.pan); } }
  if (bush && p.moving) bush.shake = Math.max(bush.shake, 0.4);
  p.inBush = bush;
}
function remoteControl(p) {
  const n = p.net, c = p.ctl;
  if (!n) { c.mx = c.my = 0; c.fire = false; c.ads = false; return; }
  c.mx = n.mx; c.my = n.my; c.fire = n.f; c.ads = n.ad; p.angle = n.a;
}
function updateGround(p, dt) {
  if (p.isPlayer) { if (!G.over && screen === 'game') playerInput(p); else { p.ctl.mx = p.ctl.my = 0; p.ctl.fire = false; p.ctl.ads = false; } }
  else if (p.remote) remoteControl(p);
  else botUpdate(p, dt);
  const it = curItem(p), wpn = it && it.kind === 'weapon' ? WEAPONS[it.wid] : null;
  p.ads = p.ctl.ads && !!wpn;
  let speed = 255;
  if (p.ads) speed *= wpn.scope ? 0.45 : 0.62;
  if (p.useT > 0) speed *= 0.5;
  if (p.landT > 0) { p.landT -= dt; speed *= 0.5; }
  if (p.remote) {
    const n = p.net;
    if (n) { p.x += (n.x - p.x) * 0.5; p.y += (n.y - p.y) * 0.5; p.vx = n.vx; p.vy = n.vy; }
  } else {
    const k = 1 - Math.exp(-14 * dt);
    p.vx = lerp(p.vx, p.ctl.mx * speed, k); p.vy = lerp(p.vy, p.ctl.my * speed, k);
    p.x += p.vx * dt; p.y += p.vy * dt;
  }
  collide(p);
  const sp = Math.hypot(p.vx, p.vy); p.moving = sp > 25;
  stepFx(p, sp, dt);
  // timers
  p.fireCd -= dt; p.equipT -= dt; p.emptyT -= dt; p.firedT += dt; p.hitFlash = Math.max(0, p.hitFlash - dt * 6);
  p.recoil = Math.max(0, p.recoil - dt * 9); p.barT -= dt; p.swing = Math.max(0, p.swing - dt * 4); p.survived += dt;
  if (p.pumpT > 0) { p.pumpT -= dt; if (p.pumpT <= 0 && !G.demo) { const s = p.isPlayer ? { vol: 1, pan: 0 } : spatial(p.x, p.y); if (s.vol > 0.05) AU.play('pump', s.vol * 0.7, s.pan); } }
  if (wpn) p.bloom = Math.max(0, p.bloom - dt * (wpn.bloomMax * 3 + 0.05)); else p.bloom = 0;
  if (p.reloadT > 0) { p.reloadT -= dt; if (p.reloadT <= 0) finishReload(p); }
  if (p.useT > 0) {
    if (!it || it.kind !== 'heal') p.useT = 0;
    else { p.useT -= dt; if (p.useT <= 0) finishUse(p); }
  }
  if (p.autoReload) { p.autoReload = false; if (p.fireCd <= 0.05) startReload(p); else p.autoReload = p.reloadT <= 0; }
  if (p.ctl.fire) tryFire(p);
  bushCheck(p);
  // storm
  const S = G.storm;
  if (d2(p.x, p.y, S.cx, S.cy) > S.r * S.r) {
    p.stormAcc += dt;
    if (p.stormAcc >= 1) { p.stormAcc -= 1; damage(p, S.dps, null, 'storm'); if (p.isPlayer) floatText(p.x, p.y - 10, '-' + S.dps, '#c79bff', 18); }
  } else p.stormAcc = Math.min(p.stormAcc, 0.6);
  // auto ammo pickup
  for (let i = world.items.length - 1; i >= 0; i--) { const o = world.items[i]; if (o.it.kind === 'ammo' && Math.abs(o.x - p.x) < 34 && Math.abs(o.y - p.y) < 34 && AMMO[o.it.type] && p.ammo[o.it.type] < AMMO[o.it.type].max && o.vx === 0) { pickup(p, i); } }
}
function updateBullets(dt) {
  const B = G.bullets;
  for (let i = B.length - 1; i >= 0; i--) {
    const b = B[i];
    let mx = b.vx * dt, my = b.vy * dt;
    if (b.first) { const l = Math.hypot(b.vx, b.vy); mx += b.vx / l * b.first; my += b.vy / l * b.first; b.first = 0; }
    const x0 = b.x, y0 = b.y;
    let hitT = 1.01, hitW = null, hitC = null, hitP = null;
    for (const w of queryWalls(x0, y0, x0 + mx, y0 + my)) { const t = segAABB(x0, y0, mx, my, w); if (t >= 0 && t < hitT) { hitT = t; hitW = w; hitC = null; } }
    for (const c of queryCircles(x0, y0, x0 + mx, y0 + my)) { const t = segCircle(x0, y0, mx, my, c.x, c.y, c.r); if (t >= 0 && t < hitT) { hitT = t; hitC = c; hitW = null; } }
    for (const p of G.players) {
      if (!p.alive || p === b.owner || p.state !== 'ground') continue;
      if (Math.abs(p.x - x0) > Math.abs(mx) + 40 || Math.abs(p.y - y0) > Math.abs(my) + 40) continue;
      const t = segCircle(x0, y0, mx, my, p.x, p.y, p.r + 2); if (t >= 0 && t < hitT) { hitT = t; hitP = p; hitW = null; hitC = null; }
    }
    b.tail.push(x0, y0); if (b.tail.length > 4) b.tail.splice(0, 2);
    if (hitT <= 1) {
      const hx = x0 + mx * hitT, hy = y0 + my * hitT; const ang = Math.atan2(my, mx);
      b.x = hx; b.y = hy;
      if (hitP) {
        const f = clamp((b.trav / b.range - 0.5) / 0.5, 0, 1);
        if (!G.isClient) damage(hitP, b.dmg * lerp(1, 0.55, f), b.owner, b.wid);
      } else {
        const near = d2(hx, hy, cam.x, cam.y) < 1100 * 1100;
        if (hitW) {
          const wood = hitW.kind === 'crate' || hitW.kind === 'furn';
          sparks(hx, hy, ang + Math.PI, wood ? 3 : 5, hitW.kind === 'car' ? '#ffe7a0' : '#ffd27a');
          puff(hx, hy, 2, wood ? 'rgba(150,110,70,0.5)' : 'rgba(170,165,155,0.45)', 10, 40, 5, 0.5);
          for (let k = 0; k < 2; k++) part('debris', hx, hy, Math.cos(ang + Math.PI + fr(-1, 1)) * fr(60, 160), Math.sin(ang + Math.PI + fr(-1, 1)) * fr(60, 160), fr(0.3, 0.6), fr(1.5, 2.5), wood ? '#7a5838' : '#77736c');
          if (near && !G.demo && Math.random() < 0.6) { const s = spatial(hx, hy); AU.play(wood ? 'wood' : hitW.kind === 'car' ? 'ricochet' : 'impact', s.vol * 0.8, s.pan); }
        } else if (hitC) {
          if (hitC.kind === 'tree') { for (let k = 0; k < 3; k++) part('leaf', hx, hy, fr(-60, 60), fr(-60, 60), fr(0.6, 1.2), fr(2, 3.5), pick(['#3f6b2f', '#4e7d36', '#2f5426'])); part('debris', hx, hy, fr(-80, 80), fr(-80, 80), 0.4, 2, '#5a3f28'); if (near && !G.demo) { const s = spatial(hx, hy); AU.play('wood', s.vol * 0.7, s.pan); } }
          else { sparks(hx, hy, ang + Math.PI, 4); puff(hx, hy, 2, 'rgba(160,160,155,0.45)', 10, 40, 5, 0.5); if (near && !G.demo && Math.random() < 0.5) { const s = spatial(hx, hy); AU.play('impact', s.vol * 0.7, s.pan); } }
        }
      }
      B.splice(i, 1); continue;
    }
    b.x += mx; b.y += my; b.trav += Math.hypot(mx, my);
    if (b.trav > b.range) B.splice(i, 1);
  }
}
function updateGrenades(dt) {
  for (let i = G.grenades.length - 1; i >= 0; i--) {
    const g = G.grenades[i];
    g.t -= dt; g.rot += dt * 10 * Math.min(1, Math.hypot(g.vx, g.vy) / 200);
    g.vz -= 900 * dt; g.z += g.vz * dt; if (g.z <= 0) { g.z = 0; if (g.vz < -80) { g.vz = -g.vz * 0.35; if (!G.demo) { const s = spatial(g.x, g.y); AU.play('bounce', s.vol, s.pan); } } else g.vz = 0; g.vx *= 0.82; g.vy *= 0.82; }
    const nx = g.x + g.vx * dt, ny = g.y + g.vy * dt;
    let bounced = false;
    for (const w of queryWalls(nx - 8, ny - 8, nx + 8, ny + 8)) {
      if (w.low && g.z > 22) continue;
      if (nx > w.x - 5 && nx < w.x + w.w + 5 && ny > w.y - 5 && ny < w.y + w.h + 5) {
        const inX = g.x > w.x - 5 && g.x < w.x + w.w + 5; if (inX) g.vy = -g.vy * 0.5; else g.vx = -g.vx * 0.5; bounced = true; break;
      }
    }
    for (const c of queryCircles(nx - 8, ny - 8, nx + 8, ny + 8)) { if (d2(nx, ny, c.x, c.y) < (c.r + 5) ** 2) { const a = Math.atan2(ny - c.y, nx - c.x), vn = g.vx * Math.cos(a) + g.vy * Math.sin(a); g.vx -= 1.5 * vn * Math.cos(a); g.vy -= 1.5 * vn * Math.sin(a); bounced = true; break; } }
    if (!bounced) { g.x = nx; g.y = ny; }
    g.x = clamp(g.x, 10, WORLD - 10); g.y = clamp(g.y, 10, WORLD - 10);
    if (g.t <= 0) { explode(g); G.grenades.splice(i, 1); }
  }
}
function updateItems(dt) {
  for (const o of world.items) {
    o.t += dt;
    if (o.vx !== 0 || o.vy !== 0) {
      o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= Math.pow(0.02, dt); o.vy *= Math.pow(0.02, dt);
      if (collidesAt(o.x, o.y, 8)) { o.x -= o.vx * dt * 1.5; o.y -= o.vy * dt * 1.5; o.vx *= -0.3; o.vy *= -0.3; }
      if (Math.abs(o.vx) + Math.abs(o.vy) < 6) { o.vx = 0; o.vy = 0; }
    }
  }
  for (const c of world.chests) if (c.open) c.t += dt;
}
function updateStorm(dt) {
  const S = G.storm;
  if (S.state === 'final') return;
  S.t -= dt;
  if (S.state === 'wait') {
    if (S.t <= 10 && !G.stormWarned && !G.demo) { G.stormWarned = true; AU.play('warn'); }
    if (S.t <= 0) {
      const ph = PHASES[S.phase];
      S.state = 'shrink'; S.t = ph.shrink; S.sx = S.cx; S.sy = S.cy; S.sr = S.r; S.dps = ph.dps;
      banner('THE STORM IS CLOSING', 'Get inside the safe zone', '#b07cff'); if (!G.demo) AU.play('banner');
      if (!G.demo) Music.intensity = Math.min(2, 1 + (S.phase >= 2 ? 1 : 0));
    }
  } else {
    const k = 1 - Math.max(0, S.t) / PHASES[S.phase].shrink, e = k * k * (3 - 2 * k) * 0.3 + k * 0.7;
    S.cx = lerp(S.sx, S.nx, e); S.cy = lerp(S.sy, S.ny, e); S.r = lerp(S.sr, S.nr, e);
    if (S.t <= 0) {
      S.phase++; G.stormWarned = false;
      if (S.phase >= PHASES.length) { S.state = 'final'; S.r = 0; S.dps = 20; return; }
      const ph = PHASES[S.phase];
      S.state = 'wait'; S.t = ph.wait; S.nr = ph.nr; pickNextCircle();
      banner('STORM EYE FORMING', 'Shrinks in ' + fmtTime(ph.wait), '#e9edf2');
      if (S.phase === 1 || S.phase === 3) spawnSupply();
    }
  }
}
function spawnSupply() {
  const S = G.storm; let x, y, t = 0;
  do { const a = fr(0, TAU), r = Math.sqrt(Math.random()) * S.nr * 0.8; x = S.nx + Math.cos(a) * r; y = S.ny + Math.sin(a) * r; t++; } while (collidesAt(x, y, 40) && t < 50);
  G.supply.push({ x: clamp(x, 100, WORLD - 100), y: clamp(y, 100, WORLD - 100), alt: 1, landed: false, open: false, sway: 0 });
  banner('SUPPLY DROP INBOUND', 'Epic & Legendary gear — check your map', '#4cc3ff'); if (!G.demo) AU.play('supply');
}
function updateSupply(dt) {
  for (const s of G.supply) {
    if (s.landed) continue; s.alt -= dt / 14; s.sway += dt;
    if (Math.random() < 0.3) part('smoke', s.x + fr(-6, 6), s.y + fr(-6, 6), fr(-10, 10), fr(-30, -10), fr(1.5, 2.5), fr(8, 14), 'rgba(80,190,255,0.35)');
    if (s.alt <= 0) { s.alt = 0; s.landed = true; puff(s.x, s.y, 14, 'rgba(150,130,100,0.5)', 40, 140, 16, 1); if (!G.demo) { const sp = spatial(s.x, s.y); AU.play('thud', sp.vol, sp.pan); } }
  }
}

// =====================================================================
//  BOT AI
// =====================================================================
function navSet(b, x, y) {
  const ai = b.ai; ai.gx = x; ai.gy = y; ai.wp.length = 0; ai.wi = 0;
  const bs = buildingAt(b.x, b.y), bg = buildingAt(x, y);
  let fx = b.x, fy = b.y;
  if (bs && bs !== bg) { const d = nearestDoor(bs, x, y); ai.wp.push(d.ix, d.iy, d.ox, d.oy); fx = d.ox; fy = d.oy; }
  if (bg && bg !== bs) { const d = nearestDoor(bg, fx, fy); ai.wp.push(d.ox, d.oy, d.ix, d.iy); }
  ai.wp.push(x, y);
}
function nearestDoor(bl, x, y) { let best = bl.doors[0], bd = 1e18; for (const d of bl.doors) { const dd = d2(d.ox, d.oy, x, y); if (dd < bd) { bd = dd; best = d; } } return best; }
function navMove(b) {
  const ai = b.ai; if (!ai.wp.length) return [0, 0];
  let tx = ai.wp[ai.wi], ty = ai.wp[ai.wi + 1];
  let d = Math.hypot(tx - b.x, ty - b.y);
  if (d < 26 && ai.wi + 2 < ai.wp.length) { ai.wi += 2; tx = ai.wp[ai.wi]; ty = ai.wp[ai.wi + 1]; d = Math.hypot(tx - b.x, ty - b.y); }
  if (d < 14) return [0, 0];
  return [(tx - b.x) / d, (ty - b.y) / d];
}
function weaponPick(b, dist) {
  let best = -1, bs = -1;
  for (let i = 0; i < 5; i++) {
    const it = b.inv[i]; if (!it || it.kind !== 'weapon') continue;
    const Wd = WEAPONS[it.wid]; if (it.mag <= 0 && b.ammo[Wd.ammo] <= 0) continue;
    let s = Wd.score + it.rar * 0.4;
    if (it.wid === 'shotgun') s += dist < 260 ? 3 : dist > 450 ? -3 : 0;
    if (it.wid === 'sniper') s += dist > 650 ? 3 : dist < 300 ? -3 : -1;
    if (it.wid === 'smg') s += dist < 350 ? 1 : -0.5;
    if (it.wid === 'ar') s += dist > 300 ? 0.8 : 0;
    if (it.mag <= 0) s -= 1.5;
    if (s > bs) { bs = s; best = i; }
  }
  return best;
}
function hasHeal(b, kind) { return b.inv.findIndex(s => s && s.kind === 'heal' && (kind === 'hp' ? !!HEALS[s.hid].hp && b.hp < HEALS[s.hid].cap : !!HEALS[s.hid].sh && b.shield < HEALS[s.hid].cap)); }
function weaponCount(b) { return b.inv.filter(s => s && s.kind === 'weapon').length; }
function wantItem(b, it) {
  if (it.kind === 'weapon') {
    if (b.inv.some(s => s && s.kind === 'weapon' && s.wid === it.wid && s.rar >= it.rar)) return false;
    if (weaponCount(b) < 2 || b.inv.includes(null)) return true;
    const worst = b.inv.reduce((m, s) => s && s.kind === 'weapon' ? Math.min(m, WEAPONS[s.wid].score + s.rar * 0.4) : m, 99);
    return WEAPONS[it.wid].score + it.rar * 0.4 > worst + 0.3;
  }
  if (it.kind === 'ammo') return b.ammo[it.type] < AMMO[it.type].max * 0.6 && b.inv.some(s => s && s.kind === 'weapon' && WEAPONS[s.wid].ammo === it.type);
  if (it.kind === 'heal' || it.kind === 'frag') return canStack(b, it) >= 0 || b.inv.includes(null);
  return false;
}
function botPickup(b, idx) {
  const o = world.items[idx], it = o.it;
  if (it.kind === 'weapon' && !b.inv.includes(null)) {
    // replace worst weapon (or a non-weapon)
    let wi = -1, ws = 99;
    for (let i = 0; i < 5; i++) { const s = b.inv[i]; const sc = !s ? -1 : s.kind === 'weapon' ? WEAPONS[s.wid].score + s.rar * 0.4 : (s.kind === 'frag' ? 0.5 : 5); if (sc < ws) { ws = sc; wi = i; } }
    b.sel = wi; b.reloadT = 0;
  }
  if (!pickup(b, idx)) b.ai.ignore.add(o);
}
function botThink(b) {
  const ai = b.ai, S = G.storm;
  // perception
  let best = null, bd = ai.sight * ai.sight;
  for (const o of G.players) {
    if (o === b || !o.alive || o.state !== 'ground') continue;
    const dd = d2(o.x, o.y, b.x, b.y); if (dd > bd) continue;
    if (o.inBush && dd > 150 * 150 && o.firedT > 1.2) continue;
    if (dd > ai.engage * ai.engage && o !== ai.target && !(o.human && o.firedT < 2)) continue;
    if (o.ai && o !== ai.target) { const be = ai.botEngage * (1 + G.storm.phase * 0.45 + (G.storm.state === 'shrink' ? 0.3 : 0)); if (dd > be * be) continue; if (dd > 90 * 90 && Math.abs(angDiff(b.angle, Math.atan2(o.y - b.y, o.x - b.x))) > 1.05) continue; }
    if (!losClear(b.x, b.y, o.x, o.y)) continue;
    best = o; bd = dd;
  }
  if (best) {
    if (ai.target !== best) { if (!ai.target || ai.seenT > 0.8 || Math.random() < 0.3) { ai.target = best; ai.reactT = ai.react; ai.curErr = ai.err; } }
    if (ai.target === best) { ai.seenT = 0; ai.lastX = best.x; ai.lastY = best.y; }
  }
  if (ai.target && (!ai.target.alive || ai.seenT > (ai.target.ai ? 1.2 : 5))) ai.target = null;
  ai.losOK = !!(ai.target && ai.seenT < 0.35 && shotClear(b.x, b.y, ai.target.x, ai.target.y));

  const inStorm = d2(b.x, b.y, S.cx, S.cy) > (S.r - 40) ** 2;
  const outNext = d2(b.x, b.y, S.nx, S.ny) > (S.nr * 0.85) ** 2;
  const stormSoon = S.state === 'shrink' || (S.state === 'wait' && S.t < 30) || S.state === 'final';
  const rotate = (inStorm || (outNext && stormSoon)) && S.nr > 0;
  const hpTot = b.hp + b.shield;

  // weapon selection
  if (ai.target) {
    const dist = Math.sqrt(d2(b.x, b.y, ai.target.x, ai.target.y));
    const wi = weaponPick(b, dist);
    if (wi >= 0 && wi !== b.sel && b.useT <= 0 && (b.reloadT <= 0 || Math.random() < 0.3)) selectSlot(b, wi);
    if (wi < 0 && b.sel >= 0 && curItem(b) && curItem(b).kind !== 'weapon') { const e = b.inv.indexOf(null); if (e >= 0) selectSlot(b, e); }
    // frag occasionally
    const fi = b.inv.findIndex(s => s && s.kind === 'frag');
    if (fi >= 0 && dist > 160 && dist < 450 && Math.random() < 0.04 && ai.seenT < 0.5 && b.fireCd <= 0) { selectSlot(b, fi); ai.throwNow = true; }
  }

  // mode
  let mode;
  const unarmedFar = ai.target && weaponCount(b) === 0 && d2(b.x, b.y, ai.target.x, ai.target.y) > 130 * 130;
  if (ai.fleeT > 0 && ai.target) mode = 'flee';
  else if (ai.target && ai.seenT < 3 && !unarmedFar) {
    mode = 'fight';
    if (hpTot < 45 && (hasHeal(b, 'hp') >= 0 || hasHeal(b, 'sh') >= 0) && Math.random() < 0.6 && d2(b.x, b.y, ai.target.x, ai.target.y) > 170 * 170) { mode = 'flee'; ai.fleeT = fr(2, 3.5); }
  }
  else if ((hpTot < 140 * ai.heal || b.hp < 60) && !inStorm && (hasHeal(b, 'hp') >= 0 || hasHeal(b, 'sh') >= 0) && (b.hp < 75 || b.shield < 100)) mode = 'heal';
  else if (rotate) mode = 'rotate';
  else mode = 'loot';
  if (mode === 'loot') {
    // validate loot target
    const lr = ai.lootRef;
    if (lr && (lr.chest ? lr.chest.open : !world.items.includes(lr.item))) ai.lootRef = null;
    if (!ai.lootRef || Math.random() < 0.05) {
      let bestL = null, bl = 900 * 900;
      if (weaponCount(b) < 3 || b.inv.includes(null) || hpTot < 150) {
        for (const o of world.items) {
          if (o.vx !== 0 || ai.ignore.has(o) || (o.claim && o.claim !== b.id && o.claimT > G.time)) continue;
          const dd = d2(o.x, o.y, b.x, b.y); if (dd >= bl) continue;
          if (!wantItem(b, o.it)) { continue; }
          bl = dd; bestL = { item: o };
        }
        for (const c of world.chests) { if (c.open) continue; const dd = d2(c.x, c.y, b.x, b.y) * 0.7; if (dd < bl) { bl = dd; bestL = { chest: c }; } }
      }
      for (const s of G.supply) if (s.landed && !s.open && d2(s.x, s.y, b.x, b.y) < 1400 * 1400) bestL = { supply: s };
      if (bestL) { ai.lootRef = bestL; const tx = bestL.item ? bestL.item.x : bestL.chest ? bestL.chest.x : bestL.supply.x, ty = bestL.item ? bestL.item.y : bestL.chest ? bestL.chest.y : bestL.supply.y; navSet(b, tx, ty); if (bestL.item) { bestL.item.claim = b.id; bestL.item.claimT = G.time + 6; } }
    }
    if (!ai.lootRef) mode = ai.alertT > 0 ? 'investigate' : 'roam';
  }
  if (mode !== ai.mode) {
    ai.mode = mode;
    if (mode === 'rotate') { const a = Math.atan2(b.y - S.ny, b.x - S.nx), r = S.nr * fr(0.2, 0.6); navSet(b, S.nx + Math.cos(a) * r, S.ny + Math.sin(a) * r); }
    if (mode === 'investigate') navSet(b, ai.alertX, ai.alertY);
    if (mode === 'roam') ai.roamT = 0;
  }
  if (mode === 'roam') {
    ai.roamT -= 0.25;
    if (ai.roamT <= 0 || !ai.wp.length) {
      ai.roamT = fr(6, 12);
      let tx, ty;
      const poi = world.pois.filter(p => d2(p.x, p.y, S.nx, S.ny) < (S.nr * 0.9) ** 2);
      if (poi.length && Math.random() < 0.2) { const p = pick(poi); tx = p.x + fr(-200, 200); ty = p.y + fr(-200, 200); }
      else { const a = fr(0, TAU), r = Math.sqrt(Math.random()) * Math.max(80, S.nr * 0.8); tx = S.nx + Math.cos(a) * r; ty = S.ny + Math.sin(a) * r; }
      navSet(b, clamp(tx, 60, WORLD - 60), clamp(ty, 60, WORLD - 60));
    }
  }
  if (mode === 'rotate' && Math.random() < 0.08) { const a = Math.atan2(b.y - S.ny, b.x - S.nx), r = S.nr * fr(0.2, 0.6); navSet(b, S.nx + Math.cos(a) * r, S.ny + Math.sin(a) * r); }
  if (mode === 'fight' && ai.seenT > 0.3) { if (!ai.wp.length || d2(ai.gx, ai.gy, ai.lastX, ai.lastY) > 60 * 60) navSet(b, ai.lastX, ai.lastY); }
  if (mode === 'heal') {
    let hi = b.hp < 75 ? hasHeal(b, 'hp') : -1; if (hi < 0) hi = hasHeal(b, 'sh'); if (hi < 0) hi = hasHeal(b, 'hp');
    if (hi >= 0 && b.sel !== hi) selectSlot(b, hi);
  }
  // stuck detection
  ai.stuckT += 0.25;
  if (ai.stuckT > 0.8) {
    const moved = Math.hypot(b.x - ai.px, b.y - ai.py);
    if (moved < 14 && (ai.mode !== 'heal') && ai.wp.length) { const a = fr(0, TAU); ai.detourT = fr(0.5, 1); ai.dx = Math.cos(a); ai.dy = Math.sin(a); }
    ai.px = b.x; ai.py = b.y; ai.stuckT = 0;
  }
}
function botUpdate(b, dt) {
  const ai = b.ai, c = b.ctl;
  ai.think -= dt; ai.seenT += dt; ai.fleeT = (ai.fleeT || 0) - dt; ai.alertT -= dt; ai.reactT -= dt; ai.strafeT -= dt; ai.burstPause -= dt;
  if (ai.think <= 0) { ai.think = fr(0.2, 0.3); botThink(b); }
  c.fire = false; c.ads = false;
  let mx = 0, my = 0;
  const T = ai.target;
  if (ai.mode === 'flee' && T) {
    const dx = b.x - T.x, dy = b.y - T.y, d = Math.hypot(dx, dy) || 1;
    if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = fr(0.4, 0.9); }
    mx = dx / d + -dy / d * ai.strafe * 0.6; my = dy / d + dx / d * ai.strafe * 0.6;
    const desired = Math.atan2(my, mx); b.angle += clamp(angDiff(b.angle, desired), -ai.turn * dt, ai.turn * dt);
    if (ai.fleeT <= 0) { ai.target = null; ai.think = 0; }
  } else if (ai.mode === 'fight' && T) {
    const dx = T.x - b.x, dy = T.y - b.y, dist = Math.hypot(dx, dy) || 1;
    const S = G.storm, inStorm = d2(b.x, b.y, S.cx, S.cy) > (S.r - 40) ** 2;
    if (ai.seenT < 0.35) {
      if (ai.strafeT <= 0) { ai.strafe = Math.random() < 0.5 ? -1 : 1; ai.strafeT = fr(0.5, 1.5); }
      const w = curWeapon(b); const pref = w && w.wid === 'shotgun' ? 120 : w && w.wid === 'sniper' ? 650 : ai.prefD;
      const rad = clamp((dist - pref) / 200, -1, 1);
      mx = dx / dist * rad + -dy / dist * ai.strafe * 0.9; my = dy / dist * rad + dx / dist * ai.strafe * 0.9;
      if (w && WEAPONS[w.wid].scope) { mx *= 0.3; my *= 0.3; }
      if (inStorm) { const m = navMove(b); if (!ai.wp.length) navSet(b, S.nx, S.ny); mx = m[0]; my = m[1]; }
      // aim
      const lead = dist / (w ? WEAPONS[w.wid].speed : 2000);
      const ax = T.x + T.vx * lead * 0.8, ay = T.y + T.vy * lead * 0.8;
      ai.curErr = Math.max(ai.minErr, ai.curErr - dt * 0.12);
      const err = Math.sin(G.time * 2.3 + ai.errPh) * ai.curErr + Math.sin(G.time * 5.1 + ai.errPh * 2) * ai.curErr * 0.4;
      const desired = Math.atan2(ay - b.y, ax - b.x) + err;
      const da = angDiff(b.angle, desired); b.angle += clamp(da, -ai.turn * dt, ai.turn * dt);
      const it = curItem(b);
      if (ai.reactT <= 0 && ai.losOK && Math.abs(da) < 0.25 && it) {
        if (it.kind === 'weapon') {
          const Wd = WEAPONS[it.wid];
          c.ads = Wd.scope || dist > 380;
          if (ai.burstPause <= 0 && dist < Wd.range * 0.95) {
            c.fire = true;
            if (Wd.rate > 3 && b.fireCd <= 0) { ai.burst++; if (ai.burst > (Wd.rate > 8 ? 7 : 4) + Math.random() * 4) { ai.burst = 0; ai.burstPause = fr(ai.pause[0], ai.pause[1]); } }
          }
        } else if (it.kind === 'frag' && ai.throwNow) { c.fire = true; ai.throwNow = false; }
        else if (it.kind !== 'heal' && dist < 60) c.fire = true;
      }
      if (!it && dist < 55) c.fire = true;
      if (!it && dist > 55) { mx = dx / dist; my = dy / dist; }
      const w2 = curWeapon(b); if (w2 && w2.mag === 0 && b.reloadT <= 0) startReload(b);
    } else {
      const m = navMove(b); mx = m[0]; my = m[1];
      const desired = Math.atan2(ai.lastY - b.y, ai.lastX - b.x); b.angle += clamp(angDiff(b.angle, desired), -ai.turn * dt, ai.turn * dt);
      const w = curWeapon(b); if (w && w.mag < WEAPONS[w.wid].mag * 0.5 && b.reloadT <= 0) startReload(b);
    }
  } else {
    if (ai.mode === 'heal') {
      const it = curItem(b);
      if (it && it.kind === 'heal') { c.fire = true; }
      else ai.think = 0;
    } else {
      const m = navMove(b); mx = m[0]; my = m[1];
      // reach loot
      const lr = ai.lootRef;
      if (lr) {
        const tx = lr.item ? lr.item.x : lr.chest ? lr.chest.x : lr.supply.x, ty = lr.item ? lr.item.y : lr.chest ? lr.chest.y : lr.supply.y;
        if (d2(tx, ty, b.x, b.y) < 46 * 46) {
          if (lr.item) { const idx = world.items.indexOf(lr.item); if (idx >= 0) botPickup(b, idx); }
          else if (lr.chest) openChest(b, lr.chest);
          else if (lr.supply && !lr.supply.open) { lr.supply.open = true; rng = Math.random; spawnLoot(lr.supply.x, lr.supply.y, 'supply', true); }
          ai.lootRef = null; ai.think = Math.min(ai.think, 0.05); ai.wp.length = 0;
          const w = curWeapon(b); if (!w) { const wi = weaponPick(b, 300); if (wi >= 0) selectSlot(b, wi); }
        }
      }
      if (mx || my) { const desired = Math.atan2(my, mx); b.angle += clamp(angDiff(b.angle, desired), -ai.turn * 0.7 * dt, ai.turn * 0.7 * dt); }
      const w = curWeapon(b); if (w && w.mag < WEAPONS[w.wid].mag && b.reloadT <= 0 && b.ammo[WEAPONS[w.wid].ammo] > 0) startReload(b);
      if (!w && b.reloadT <= 0) { const wi = weaponPick(b, 300); if (wi >= 0 && wi !== b.sel) selectSlot(b, wi); }
    }
  }
  if (ai.detourT > 0) { ai.detourT -= dt; mx = ai.dx; my = ai.dy; if (ai.detourT <= 0 && ai.wp.length) navSet(b, ai.gx, ai.gy); }
  const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
  c.mx = mx; c.my = my;
}

// =====================================================================
//  INPUT
// =====================================================================
const keys = {};
const mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, right: false };
const touch = { on: false, L: { active: false, id: -1, x: 0, y: 0, cx: 0, cy: 0 }, R: { active: false, id: -1, x: 0, y: 0, cx: 0, cy: 0 }, ads: false };
let hudSlots = [];
function inMatch() { return G && !G.demo && !G.over && !G.paused && screen === 'game'; }
window.addEventListener('keydown', e => {
  AU.init();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) { if (e.code === 'Enter') e.target.blur(); return; }
  if (keys[e.code]) return; keys[e.code] = true;
  if (screen === 'results' && (e.code === 'KeyR' || e.code === 'Enter')) { again(); return; }
  if (screen === 'game' && G && !G.demo && (e.code === 'Escape' || e.code === 'KeyP')) { togglePause(); return; }
  if (screen === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) { togglePause(); return; }
  if (['how', 'locker', 'settings'].includes(screen) && e.code === 'Escape') { backFrom(screen); return; }
  if (!inMatch()) return;
  const me = G.me; if (!me || !me.alive) return;
  if (e.code === 'KeyM') G.showMap = !G.showMap;
  if (me.state === 'bus' && (e.code === 'Space')) act('jump');
  if (me.state !== 'ground') return;
  if (e.code === 'KeyE' || e.code === 'KeyF') act('use');
  if (e.code === 'KeyR') act('reload');
  if (e.code >= 'Digit1' && e.code <= 'Digit5') act('slot', +e.code.slice(5) - 1);
  if (e.code === 'KeyQ') { const ws = me.inv.map((s, i) => s && s.kind === 'weapon' ? i : -1).filter(i => i >= 0 && i !== me.sel); if (ws.length) act('slot', ws[0]); }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouse.down = mouse.right = false; if (inMatch() && !G.online) togglePause(); });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
cv.addEventListener('mousedown', e => {
  AU.init(); mouse.x = e.clientX; mouse.y = e.clientY;
  if (e.button === 0) {
    if (inMatch() && G.me.state === 'ground') { for (let i = 0; i < hudSlots.length; i++) { const s = hudSlots[i]; if (mouse.x > s.x && mouse.x < s.x + s.w && mouse.y > s.y && mouse.y < s.y + s.h) { act('slot', i); return; } } }
    mouse.down = true;
    if (inMatch() && G.me.state === 'bus') act('jump');
  }
  if (e.button === 2) mouse.right = true;
});
window.addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.right = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { if (!inMatch() || G.me.state !== 'ground') return; const d = e.deltaY > 0 ? 1 : -1; act('slot', (G.me.sel + d + 5) % 5); }, { passive: true });

// touch
function setupTouch() {
  const tEl = $('touch');
  const stick = (el, S) => {
    const upd = (t) => { const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2; let dx = (t.clientX - cx) / (r.width / 2), dy = (t.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } S.x = dx; S.y = dy; el.firstElementChild.style.transform = `translate(${dx * r.width * 0.32}px,${dy * r.height * 0.32}px)`; };
    el.addEventListener('touchstart', e => { e.preventDefault(); AU.init(); const t = e.changedTouches[0]; S.active = true; S.id = t.identifier; upd(t); }, { passive: false });
    el.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === S.id) upd(t); }, { passive: false });
    const end = e => { for (const t of e.changedTouches) if (t.identifier === S.id) { S.active = false; S.x = S.y = 0; el.firstElementChild.style.transform = ''; } };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  };
  stick($('stickL'), touch.L); stick($('stickR'), touch.R);
  tEl.querySelectorAll('.tbtn').forEach(b => b.addEventListener('touchstart', e => {
    e.preventDefault(); AU.init(); const k = b.dataset.k;
    if (k === 'pause') { if (G && !G.demo && (screen === 'game' || screen === 'pause')) togglePause(); return; }
    if (!inMatch()) return; const me = G.me;
    if (k === 'map') G.showMap = !G.showMap;
    if (k === 'jump') act('jump');
    if (me.state !== 'ground') return;
    if (k === 'use') act('use');
    if (k === 'reload') act('reload');
    if (k === 'swap') { for (let i = 1; i <= 5; i++) { const j = (me.sel + i) % 5; if (me.inv[j]) { act('slot', j); break; } } }
    if (k === 'ads') { touch.ads = !touch.ads; b.style.background = touch.ads ? 'rgba(255,182,39,.45)' : ''; }
  }, { passive: false }));
  cv.addEventListener('touchstart', e => {
    AU.init();
    if (!touch.on) { touch.on = true; }
    if (!inMatch()) return;
    for (const t of e.changedTouches) {
      for (let i = 0; i < hudSlots.length; i++) { const s = hudSlots[i]; if (t.clientX > s.x && t.clientX < s.x + s.w && t.clientY > s.y && t.clientY < s.y + s.h) { act('slot', i); } }
    }
  }, { passive: true });
}
setupTouch();
window.addEventListener('touchstart', () => { touch.on = true; updateTouchUI(); }, { passive: true, once: true });
function updateTouchUI() {
  const show = touch.on && screen === 'game' && G && !G.demo;
  $('touch').classList.toggle('hidden', !show);
  if (show) { const bus = G.me && G.me.state === 'bus'; $('tJump').classList.toggle('hidden', !bus); }
}

// =====================================================================
//  RENDER
// =====================================================================
let fps = 60, fpsAcc = 0, fpsN = 0, lastFrame = performance.now(), accum = 0, gtime = 0;
const visCache = new Map();
function isVisibleTo(viewer, o) {
  if (!viewer) return true;
  if (o === viewer) return true;
  const dd = d2(o.x, o.y, viewer.x, viewer.y);
  if (o.inBush && dd > 150 * 150 && o.firedT > 1.2) return false;
  return losClear(viewer.x, viewer.y, o.x, o.y);
}
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now; gtime += dt;
  fpsAcc += dt; fpsN++; if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  const netOn = G && G.online;
  if (G && (!G.paused || netOn) && (screen !== 'results' || netOn)) {
    if (G.hitStop > 0) G.hitStop -= dt;
    else {
      accum += dt * G.timeScale; let n = 0;
      const stepFn = G.isClient ? clientStep : step;
      while (accum >= STEP && n < 5) { stepFn(STEP); accum -= STEP; n++; }
      if (n >= 5) accum = 0;
    }
    updateFx(dt * (G.hitStop > 0 ? 0.15 : G.timeScale), dt);
  }
  if (netOn) netTick(dt);
  if (G) render(dt);
  updateTouchUI();
}
function updateFx(dt, rdt) {
  const P = G.parts;
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i]; p.life -= dt; if (p.life <= 0) { P.splice(i, 1); continue; }
    const drag = p.type === 'smoke' ? 1.6 : p.type === 'shell' ? 4 : p.type === 'spark' ? 3 : 2.5;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= Math.exp(-drag * dt); p.vy *= Math.exp(-drag * dt); p.rot += p.vr * dt;
    if (p.type === 'smoke') p.size += dt * 14;
  }
  for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.t += rdt; f.y += f.vy * rdt; f.vy *= Math.exp(-3 * rdt); if (f.t > 0.9) G.floats.splice(i, 1); }
  for (const b of G.banners) b.t += rdt; G.banners = G.banners.filter(b => b.t < b.dur);
  for (const f of G.feed) f.t += rdt; G.feed = G.feed.filter(f => f.t < 7);
  for (const t of G.toasts) t.t += rdt; G.toasts = G.toasts.filter(t => t.t < 1.8);
  for (const d of G.dmgDirs) d.t += rdt; G.dmgDirs = G.dmgDirs.filter(d => d.t < 1.2);
  for (const b of G.bodies) b.t += dt; G.bodies = G.bodies.filter(b => b.t < 2.5);
  for (const b of world.bushes) if (b.shake > 0) b.shake = Math.max(0, b.shake - rdt * 2);
  G.hitMarker = Math.max(0, G.hitMarker - rdt * 4); G.vign = Math.max(0, G.vign - rdt * 1.5);
  cam.shake = Math.max(0, cam.shake - rdt * 2.2); cam.kick = Math.max(0, cam.kick - rdt * 40);
  for (const b of world.buildings) {
    const v = viewerEntity(); const inside = v && v.state === 'ground' && v.x > b.x && v.x < b.x + b.w && v.y > b.y && v.y < b.y + b.h;
    b.roofA = lerp(b.roofA, inside ? 0 : 1, 1 - Math.exp(-10 * rdt));
  }
}
function viewerEntity() { if (!G) return null; if (G.demo) return G.camTarget; if (G.me && G.me.alive) return G.me; return G.camTarget && G.camTarget.alive ? G.camTarget : G.me; }

function updateCamera(dt) {
  const v = viewerEntity(); const bz = baseZoom();
  let tx = cam.x, ty = cam.y, tz = bz;
  if (G.demo) { if (v) { tx = v.x; ty = v.y; } tz = bz * 0.85; }
  else if (G.me && G.me.state === 'bus' && G.me.alive) { tx = G.bus.x; ty = G.bus.y; tz = bz * 0.34; }
  else if (v) {
    tx = v.x; ty = v.y;
    if (v.state === 'drop') tz = bz * (0.38 + 0.62 * (1 - v.alt));
    else if (v === G.me && v.alive) {
      const w = curWeapon(v); const scope = v.ads && w && WEAPONS[w.wid].scope;
      tz = scope ? bz * 0.58 : v.ads ? bz * 0.9 : bz;
      if (!touch.on) { const lx = (mouse.x - W / 2), ly = (mouse.y - H / 2); const la = scope ? 0.5 : 0.22; tx += lx / cam.zoom * la; ty += ly / cam.zoom * la; }
      else { tx += Math.cos(v.angle) * 120; ty += Math.sin(v.angle) * 120; }
    }
  }
  const k = 1 - Math.exp(-(G.demo ? 2 : 9) * dt);
  cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k);
  cam.zoom = lerp(cam.zoom, tz, 1 - Math.exp(-4 * dt));
  const s = cam.shake * cam.shake * 26;
  cam.sx = (Math.random() * 2 - 1) * s + cam.kx * cam.kick; cam.sy = (Math.random() * 2 - 1) * s + cam.ky * cam.kick;
  mouse.wx = cam.x + (mouse.x - W / 2) / cam.zoom; mouse.wy = cam.y + (mouse.y - H / 2) / cam.zoom;
}

function render(dt) {
  updateCamera(dt);
  const z = cam.zoom, viewer = viewerEntity();
  const fogOn = !G.demo && G.me && G.me.alive && G.me.state === 'ground';
  const vw = W / z, vh = H / z, x0 = cam.x - vw / 2 - 80, y0 = cam.y - vh / 2 - 80, x1 = cam.x + vw / 2 + 80, y1 = cam.y + vh / 2 + 80;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#2d3a22'; ctx.fillRect(0, 0, cv.width, cv.height);
  const ox = W / 2 - cam.x * z + cam.sx, oy = H / 2 - cam.y * z + cam.sy;
  ctx.setTransform(DPR * z, 0, 0, DPR * z, DPR * ox, DPR * oy);

  // ---- ground ----
  if (z < 0.6) { ctx.imageSmoothingEnabled = true; ctx.drawImage(ovCv, 0, 0, WORLD, WORLD); }
  else {
    const ta = Math.floor(Math.max(0, x0) / TILE), tb = Math.floor(Math.min(WORLD - 1, x1) / TILE), tc = Math.floor(Math.max(0, y0) / TILE), td = Math.floor(Math.min(WORLD - 1, y1) / TILE);
    let made = 0; const k = 1200 / WORLD;
    for (let ty = tc; ty <= td; ty++) for (let tx = ta; tx <= tb; tx++) {
      const key = tx + ',' + ty;
      if (!tileCache.has(key) && made >= 3) { ctx.drawImage(ovCv, tx * TILE * k, ty * TILE * k, TILE * k, TILE * k, tx * TILE, ty * TILE, TILE + 1, TILE + 1); continue; }
      if (!tileCache.has(key)) made++;
      ctx.drawImage(getTile(tx, ty), tx * TILE, ty * TILE, TILE + 1, TILE + 1);
    }
  }
  // out of bounds water
  ctx.fillStyle = '#1d3a4a';
  ctx.fillRect(-3000, -3000, WORLD + 6000, 3000); ctx.fillRect(-3000, WORLD, WORLD + 6000, 3000); ctx.fillRect(-3000, 0, 3000, WORLD); ctx.fillRect(WORLD, 0, 3000, WORLD);
  // decals
  for (const d of world.decals) { if (d.x < x0 || d.x > x1 || d.y < y0 || d.y > y1) continue; const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); g.addColorStop(0, 'rgba(20,16,12,.75)'); g.addColorStop(1, 'rgba(20,16,12,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, TAU); ctx.fill(); }
  const inView = (x, y, r) => x + r > x0 && x - r < x1 && y + r > y0 && y - r < y1;
  // ---- shadows (static) ----
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (const b of world.buildings) if (inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) { ctx.globalAlpha = 0.3 + 0.7 * b.roofA; ctx.fillRect(b.x + 16, b.y + 22, b.w, b.h); }
  ctx.globalAlpha = 1;
  for (const c of world.circles) { if (!inView(c.x, c.y, 90)) continue; if (c.kind === 'tree') { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(c.x + 22, c.y + 28, c.canopy * 0.95, c.canopy * 0.85, 0, 0, TAU); ctx.fill(); } else { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(c.x + 7, c.y + 9, c.r * 1.05, c.r * 0.95, 0, 0, TAU); ctx.fill(); } }
  for (const w of world.walls) if (w.kind === 'car' && inView(w.x + w.w / 2, w.y + w.h / 2, 80)) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, w.x + 7, w.y + 9, w.w, w.h, 12); ctx.fill(); }
  // ---- floors ----
  for (const b of world.buildings) if (inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) drawFloor(b);
  // ---- items & chests ----
  for (const c of world.chests) if (inView(c.x, c.y, 40)) drawChest(c);
  for (const o of world.items) if (inView(o.x, o.y, 30)) drawGroundItem(o);
  for (const s of G.supply) if (s.landed && inView(s.x, s.y, 50)) drawSupplyCrate(s.x, s.y, s.open);
  // ---- bodies ----
  for (const b of G.bodies) { if (!inView(b.x, b.y, 40)) continue; ctx.globalAlpha = clamp(1 - b.t / 2.5, 0, 1) * 0.9; drawSoldier(ctx, b.p, b.x, b.y, b.angle, b.skin, { dead: true, t: b.t }); ctx.globalAlpha = 1; }
  // ---- entities ----
  const fogViewer = fogOn ? G.me : null;
  for (const p of G.players) {
    if (!p.alive || p.state !== 'ground' || !inView(p.x, p.y, 60)) { p.vis = false; continue; }
    p.vis = isVisibleTo(fogViewer, p);
    if (!p.vis) continue;
    drawSoldier(ctx, p, p.x, p.y, p.angle, p.skin, null);
  }
  // grenades
  for (const g of G.grenades) { if (!inView(g.x, g.y, 30)) continue; ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(g.x + 3, g.y + 4, 6, 5, 0, 0, TAU); ctx.fill(); ctx.save(); ctx.translate(g.x, g.y - g.z * 0.4); ctx.rotate(g.rot); drawFrag(ctx, 0, 0, 1); ctx.restore(); if (g.t < 0.6 && (gtime * 20 | 0) % 2) { ctx.fillStyle = 'rgba(255,60,40,0.8)'; ctx.beginPath(); ctx.arc(g.x, g.y - g.z * 0.4, 3, 0, TAU); ctx.fill(); } }
  // bullets
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (const b of G.bullets) {
    if (!inView(b.x, b.y, 80)) continue;
    const tx = b.tail.length ? b.tail[0] : b.x - b.vx * 0.02, ty = b.tail.length ? b.tail[1] : b.y - b.vy * 0.02;
    const g = ctx.createLinearGradient(tx, ty, b.x, b.y); g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(1, b.wid === 'sniper' ? 'rgba(255,240,210,0.95)' : 'rgba(255,220,150,0.85)');
    ctx.strokeStyle = g; ctx.lineWidth = b.wid === 'sniper' ? 3 : 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over';
  // ---- vision shadows ----
  if (fogOn) drawFog(G.me, x0, y0, x1, y1, ox, oy);
  // ---- walls ----
  for (const w of world.walls) if (inView(w.x + w.w / 2, w.y + w.h / 2, Math.max(w.w, w.h))) drawWall(w);
  // rocks
  for (const c of world.circles) if (c.kind === 'rock' && inView(c.x, c.y, c.r)) drawRock(c);
  // trunks
  for (const c of world.circles) if (c.kind === 'tree' && inView(c.x, c.y, 20)) { ctx.fillStyle = '#4a3523'; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, TAU); ctx.fill(); }
  // roofs
  for (const b of world.buildings) if (b.roofA > 0.02 && inView(b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) drawRoof(b);
  // bushes & canopies
  const me = viewer;
  for (const b of world.bushes) if (inView(b.x, b.y, b.r)) drawBush(b, me && me.inBush === b);
  for (const c of world.circles) if (c.kind === 'tree' && inView(c.x, c.y, c.canopy)) { const under = me && me.state === 'ground' && d2(me.x, me.y, c.x, c.y) < (c.canopy * 0.9) ** 2; drawCanopy(c, under ? 0.35 : 0.96); }
  // particles
  drawParticles(inView);
  // drop players / supply in the air / bus
  for (const s of G.supply) if (!s.landed && inView(s.x, s.y, 200)) drawSupplyAir(s);
  for (const p of G.players) if (p.alive && p.state === 'drop' && inView(p.x, p.y, 200)) drawDropper(p);
  if (G.bus && !G.bus.done) drawPlane(G.bus);
  // enemy bars & names
  for (const p of G.players) {
    if (!p.alive || p.isPlayer || p.state !== 'ground' || !p.vis || p.barT <= 0 || G.demo) continue;
    const a = clamp(p.barT, 0, 1); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(p.x - 22, p.y - 34, 44, 8);
    ctx.fillStyle = '#4cc3ff'; ctx.fillRect(p.x - 21, p.y - 33, 42 * p.shield / 100, 3);
    ctx.fillStyle = '#7ddc6a'; ctx.fillRect(p.x - 21, p.y - 30, 42 * p.hp / 100, 3);
    ctx.globalAlpha = 1;
  }
  // storm
  drawStorm(x0, y0, x1, y1);
  // floating texts (world)
  for (const f of G.floats) {
    const a = clamp(1.2 - f.t * 1.4, 0, 1); ctx.globalAlpha = a;
    const s = f.size / z * Math.min(1, z * 1.1) * (1 + Math.max(0, 0.15 - f.t) * 3);
    ctx.font = `700 ${s}px Rajdhani, Bahnschrift, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = 3 / z; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  // interaction prompt
  if (!G.demo && G.me && G.me.alive && G.me.state === 'ground' && !G.over) drawPrompt(G.me);

  // ---- screen space ----
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawScreenFx();
  if (!G.demo) drawHUD();
  if (settings.fps) { ctx.font = '600 13px Rajdhani, sans-serif'; ctx.fillStyle = '#9f9'; ctx.textAlign = 'left'; ctx.fillText(fps.toFixed(0) + ' FPS', 8, H - 8); }
  updateAudioLoops();
}

function drawFog(me, x0, y0, x1, y1, ox, oy) {
  const g = fogCtx, z = cam.zoom;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fogCv.width, fogCv.height);
  g.setTransform(FOGS * z, 0, 0, FOGS * z, FOGS * ox, FOGS * oy);
  g.fillStyle = '#000';
  const px = me.x, py = me.y, FAR = 4000;
  g.beginPath();
  for (const w of queryWalls(x0, y0, x1, y1)) {
    if (w.low) continue;
    const cs = [[w.x, w.y], [w.x + w.w, w.y], [w.x + w.w, w.y + w.h], [w.x, w.y + w.h]];
    if (px > w.x && px < w.x + w.w && py > w.y && py < w.y + w.h) continue;
    const base = Math.atan2(w.y + w.h / 2 - py, w.x + w.w / 2 - px);
    let mn = 9, mx = -9, cmn = null, cmx = null;
    for (const c of cs) { const a = angDiff(base, Math.atan2(c[1] - py, c[0] - px)); if (a < mn) { mn = a; cmn = c; } if (a > mx) { mx = a; cmx = c; } }
    const a1 = base + mn, a2 = base + mx;
    g.moveTo(cmn[0], cmn[1]); g.lineTo(cmn[0] + Math.cos(a1) * FAR, cmn[1] + Math.sin(a1) * FAR);
    g.lineTo(px + Math.cos(base) * FAR * 1.5, py + Math.sin(base) * FAR * 1.5);
    g.lineTo(cmx[0] + Math.cos(a2) * FAR, cmx[1] + Math.sin(a2) * FAR); g.lineTo(cmx[0], cmx[1]); g.closePath();
  }
  g.fill('nonzero');
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.55; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(fogCv, 0, 0, cv.width, cv.height); ctx.restore();
}

// ---------- drawing primitives ----------
function drawFloor(b) {
  ctx.fillStyle = b.floor === 'wood' ? '#6e5137' : '#8c877c'; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = b.floor === 'wood' ? 'rgba(40,26,14,0.35)' : 'rgba(60,58,52,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath();
  if (b.floor === 'wood') { for (let y = b.y + 12; y < b.y + b.h; y += 12) { ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); } for (let y = b.y, r = 0; y < b.y + b.h; y += 12, r++) for (let x = b.x + ((r * 37) % 70); x < b.x + b.w; x += 70) { ctx.moveTo(x, y); ctx.lineTo(x, y + 12); } }
  else { for (let x = b.x + 30; x < b.x + b.w; x += 30) { ctx.moveTo(x, b.y); ctx.lineTo(x, b.y + b.h); } for (let y = b.y + 30; y < b.y + b.h; y += 30) { ctx.moveTo(b.x, y); ctx.lineTo(b.x + b.w, y); } }
  ctx.stroke();
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h); g.addColorStop(0, 'rgba(255,240,210,0.07)'); g.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
  // rug
  ctx.fillStyle = 'rgba(110,40,36,0.35)'; ctx.fillRect(b.x + b.w * 0.3, b.y + b.h * 0.35, b.w * 0.25, b.h * 0.22);
}
function drawWall(w) {
  if (w.kind === 'wall') {
    ctx.fillStyle = '#3b3934'; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#5a564e'; ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, w.h - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, 2);
  } else if (w.kind === 'crate') {
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = '#8a643c'; ctx.fillRect(w.x + 3, w.y + 3, w.w - 6, w.h - 6);
    ctx.strokeStyle = '#5a3d22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w.x + 4, w.y + 4); ctx.lineTo(w.x + w.w - 4, w.y + w.h - 4); ctx.moveTo(w.x + w.w - 4, w.y + 4); ctx.lineTo(w.x + 4, w.y + w.h - 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(w.x + 1, w.y + 1, w.w - 2, w.h - 2);
  } else if (w.kind === 'furn') {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(w.x + 4, w.y + 5, w.w, w.h);
    ctx.fillStyle = w.col; ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(w.x + 2, w.y + 2, w.w - 4, w.h / 2 - 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(w.x + 0.5, w.y + 0.5, w.w - 1, w.h - 1);
  } else if (w.kind === 'car') drawCar(w);
}
function drawCar(w) {
  ctx.save(); ctx.translate(w.x + w.w / 2, w.y + w.h / 2); if (!w.horiz) ctx.rotate(Math.PI / 2); if (w.flip) ctx.rotate(Math.PI);
  const L = 92, Wd = 46;
  ctx.fillStyle = '#151515'; for (const sx of [-28, 26]) for (const sy of [-1, 1]) { rr(ctx, sx - 8, sy * (Wd / 2) - 4, 16, 8, 2); ctx.fill(); }
  const g = ctx.createLinearGradient(0, -Wd / 2, 0, Wd / 2); g.addColorStop(0, shade(w.col, 1.25)); g.addColorStop(0.5, w.col); g.addColorStop(1, shade(w.col, 0.7));
  ctx.fillStyle = g; rr(ctx, -L / 2, -Wd / 2 + 2, L, Wd - 4, 12); ctx.fill();
  ctx.fillStyle = 'rgba(25,35,45,0.9)'; rr(ctx, 6, -Wd / 2 + 7, 16, Wd - 14, 4); ctx.fill(); rr(ctx, -30, -Wd / 2 + 8, 11, Wd - 16, 3); ctx.fill();
  ctx.fillStyle = shade(w.col, 1.1); rr(ctx, -19, -Wd / 2 + 7, 25, Wd - 14, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(8, -Wd / 2 + 9, 5, Wd - 18);
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(L / 2 - 4, -Wd / 2 + 5, 3, 7); ctx.fillRect(L / 2 - 4, Wd / 2 - 12, 3, 7);
  ctx.fillStyle = '#a0302a'; ctx.fillRect(-L / 2 + 1, -Wd / 2 + 5, 3, 7); ctx.fillRect(-L / 2 + 1, Wd / 2 - 12, 3, 7);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; rr(ctx, -L / 2, -Wd / 2 + 2, L, Wd - 4, 12); ctx.stroke();
  ctx.restore();
}
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const r = clamp(((n >> 16) & 255) * f, 0, 255) | 0, g = clamp(((n >> 8) & 255) * f, 0, 255) | 0, b = clamp((n & 255) * f, 0, 255) | 0; return `rgb(${r},${g},${b})`; }
function drawRoof(b) {
  ctx.globalAlpha = b.roofA;
  const base = b.roof;
  if (b.ridgeH) {
    const g1 = ctx.createLinearGradient(0, b.y, 0, b.y + b.h / 2); g1.addColorStop(0, shade(base, 1.25)); g1.addColorStop(1, shade(base, 1.05));
    ctx.fillStyle = g1; ctx.fillRect(b.x - 6, b.y - 6, b.w + 12, b.h / 2 + 6);
    const g2 = ctx.createLinearGradient(0, b.y + b.h / 2, 0, b.y + b.h); g2.addColorStop(0, shade(base, 0.75)); g2.addColorStop(1, shade(base, 0.6));
    ctx.fillStyle = g2; ctx.fillRect(b.x - 6, b.y + b.h / 2, b.w + 12, b.h / 2 + 6);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); for (let y = b.y + 8; y < b.y + b.h; y += 14) { ctx.moveTo(b.x - 6, y); ctx.lineTo(b.x + b.w + 6, y); } ctx.stroke();
    ctx.fillStyle = shade(base, 0.5); ctx.fillRect(b.x - 6, b.y + b.h / 2 - 3, b.w + 12, 6);
  } else {
    const g1 = ctx.createLinearGradient(b.x, 0, b.x + b.w / 2, 0); g1.addColorStop(0, shade(base, 1.25)); g1.addColorStop(1, shade(base, 1.05));
    ctx.fillStyle = g1; ctx.fillRect(b.x - 6, b.y - 6, b.w / 2 + 6, b.h + 12);
    const g2 = ctx.createLinearGradient(b.x + b.w / 2, 0, b.x + b.w, 0); g2.addColorStop(0, shade(base, 0.75)); g2.addColorStop(1, shade(base, 0.6));
    ctx.fillStyle = g2; ctx.fillRect(b.x + b.w / 2, b.y - 6, b.w / 2 + 6, b.h + 12);
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = b.x + 8; x < b.x + b.w; x += 14) { ctx.moveTo(x, b.y - 6); ctx.lineTo(x, b.y + b.h + 6); } ctx.stroke();
    ctx.fillStyle = shade(base, 0.5); ctx.fillRect(b.x + b.w / 2 - 3, b.y - 6, 6, b.h + 12);
  }
  // chimney
  ctx.fillStyle = '#5b4a40'; ctx.fillRect(b.x + b.w * 0.72, b.y + b.h * 0.2, 18, 18); ctx.fillStyle = '#2b2522'; ctx.fillRect(b.x + b.w * 0.72 + 4, b.y + b.h * 0.2 + 4, 10, 10);
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 2; ctx.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
  ctx.globalAlpha = 1;
}
function drawRock(c) {
  ctx.beginPath(); c.pts.forEach(([a, m], i) => { const x = c.x + Math.cos(a) * c.r * m, y = c.y + Math.sin(a) * c.r * m; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
  const g = ctx.createRadialGradient(c.x - c.r * 0.35, c.y - c.r * 0.4, c.r * 0.1, c.x, c.y, c.r * 1.1);
  const s = c.shade; g.addColorStop(0, `rgb(${168 * s | 0},${166 * s | 0},${158 * s | 0})`); g.addColorStop(1, `rgb(${92 * s | 0},${90 * s | 0},${86 * s | 0})`);
  ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(30,30,28,0.6)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(40,40,36,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c.x - c.r * 0.3, c.y - c.r * 0.1); ctx.lineTo(c.x + c.r * 0.1, c.y + c.r * 0.2); ctx.lineTo(c.x + c.r * 0.4, c.y + c.r * 0.1); ctx.stroke();
}
function drawBush(b, mine) {
  const sh = Math.sin(gtime * 30) * b.shake * 3;
  ctx.globalAlpha = mine ? 0.55 : 0.97;
  for (const [ox, oy, rs] of b.blobs) {
    const x = b.x + ox * b.r + sh, y = b.y + oy * b.r, r = b.r * rs;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, '#5e8a3e'); g.addColorStop(1, '#2c4a22');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawCanopy(c, alpha) {
  ctx.globalAlpha = alpha;
  const h = c.hue, base = [lerp(46, 70, h), lerp(78, 96, h), lerp(36, 40, h)];
  const g = ctx.createRadialGradient(c.x - c.canopy * 0.35, c.y - c.canopy * 0.4, c.canopy * 0.1, c.x, c.y, c.canopy);
  g.addColorStop(0, `rgb(${base[0] + 40 | 0},${base[1] + 44 | 0},${base[2] + 16 | 0})`); g.addColorStop(0.7, `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`); g.addColorStop(1, `rgb(${base[0] * 0.6 | 0},${base[1] * 0.65 | 0},${base[2] * 0.6 | 0})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) { const a = c.rot + i / 9 * TAU, r = c.canopy * (0.78 + 0.12 * Math.sin(i * 2.3 + c.rot)); ctx.moveTo(c.x + Math.cos(a) * r + c.canopy * 0.32, c.y + Math.sin(a) * r); ctx.arc(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, c.canopy * 0.32, 0, TAU); }
  ctx.arc(c.x, c.y, c.canopy * 0.8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,220,0.07)'; ctx.beginPath(); ctx.arc(c.x - c.canopy * 0.25, c.y - c.canopy * 0.3, c.canopy * 0.38, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
}
function drawChest(c) {
  ctx.save(); ctx.translate(c.x, c.y);
  if (!c.open) {
    const pulse = 0.5 + 0.5 * Math.sin(gtime * 3 + c.x);
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 46); g.addColorStop(0, `rgba(255,205,90,${0.35 + pulse * 0.2})`); g.addColorStop(1, 'rgba(255,205,90,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 46, 0, TAU); ctx.fill();
    if (Math.random() < 0.04 && G) part('glint', c.x + fr(-16, 16), c.y + fr(-12, 12), 0, -18, 0.8, 2, '#ffe9a0');
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-15, -9, 34, 24);
  ctx.fillStyle = c.open ? '#5b3f1e' : '#7a5222'; ctx.fillRect(-17, -11, 34, 22);
  ctx.fillStyle = c.open ? '#2b1d0e' : '#c79a3c'; ctx.fillRect(-17, -11, 34, c.open ? 22 : 9);
  if (c.open) { ctx.fillStyle = '#7a5222'; ctx.fillRect(-17, -19, 34, 8); }
  ctx.fillStyle = '#e6c26a'; ctx.fillRect(-17, -2, 34, 3); ctx.fillRect(-3, -4, 6, 7);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(-17, -11, 34, 22);
  ctx.restore();
}
function drawSupplyCrate(x, y, open) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(-20, -16, 46, 40);
  ctx.fillStyle = open ? '#2a4e66' : '#3a6f92'; ctx.fillRect(-23, -20, 46, 40);
  ctx.fillStyle = '#4cc3ff'; ctx.fillRect(-23, -3, 46, 6); ctx.fillRect(-3, -20, 6, 40);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2; ctx.strokeRect(-23, -20, 46, 40);
  if (!open) { const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 70); g.addColorStop(0, 'rgba(76,195,255,0.25)'); g.addColorStop(1, 'rgba(76,195,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 70, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function drawSupplyAir(s) {
  const sc = 1 + s.alt * 1.4, sx = Math.sin(s.sway * 1.5) * 10 * s.alt;
  ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - s.alt * 0.6)})`; ctx.beginPath(); ctx.ellipse(s.x + 10, s.y + 12, 24, 20, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(s.x + sx + s.alt * 60, s.y - s.alt * 120); ctx.scale(sc, sc);
  ctx.strokeStyle = 'rgba(230,230,230,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-18, -14); ctx.lineTo(-30, -60); ctx.moveTo(18, -14); ctx.lineTo(30, -60); ctx.moveTo(0, -14); ctx.lineTo(0, -66); ctx.stroke();
  const g = ctx.createRadialGradient(0, -64, 4, 0, -64, 46); g.addColorStop(0, '#e9eef2'); g.addColorStop(1, '#8aa2b2');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -64, 44, 26, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.translate(s.x + sx + s.alt * 60, s.y - s.alt * 120); ctx.scale(sc * 0.7, sc * 0.7); ctx.translate(-s.x, -s.y); drawSupplyCrate(s.x, s.y, false); ctx.restore();
}
function drawGroundItem(o) {
  const it = o.it, bob = Math.sin(o.t * 3) * 1.5, col = itemColor(it);
  const g = ctx.createRadialGradient(o.x, o.y, 2, o.x, o.y, 26); g.addColorStop(0, col + '66'); g.addColorStop(1, col + '00');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o.x, o.y, 26, 0, TAU); ctx.fill();
  if (it.kind === 'weapon' && it.rar >= 3) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(o.t * 4); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o.x, o.y, 18 + Math.sin(o.t * 4) * 2, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
  ctx.save(); ctx.translate(o.x, o.y + bob);
  drawItemIcon(ctx, it, 0, 0, 0.9, true);
  ctx.restore();
}
function drawItemIcon(g, it, x, y, s, world_) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (it.kind === 'weapon') { const m = WEAPONS[it.wid].muzzle; g.rotate(world_ ? -0.5 : -0.2); const f = world_ ? 1 : Math.min(1, 46 / (m + 18)); g.scale(f, f); drawGun(g, it.wid, it.rar, -(m - 16) / 2, 0, 1); }
  else if (it.kind === 'ammo') {
    const c = AMMO[it.type].c; g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-8, -5, 18, 14);
    g.fillStyle = '#3d4a2f'; g.fillRect(-10, -7, 20, 14); g.fillStyle = c; g.fillRect(-10, -7, 20, 4);
    g.fillStyle = c; for (let i = 0; i < 3; i++) { g.fillRect(-6 + i * 5, -1, 3, 6); }
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.strokeRect(-10, -7, 20, 14);
  } else if (it.kind === 'heal') {
    const h = it.hid;
    if (h === 'bandage') { g.fillStyle = '#e8e2d0'; g.beginPath(); g.ellipse(0, 0, 9, 7, 0, 0, TAU); g.fill(); g.strokeStyle = '#b7ae98'; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, 0, 4, 3, 0, 0, TAU); g.stroke(); g.fillStyle = '#d8d0bb'; g.fillRect(6, -2, 9, 4); }
    else if (h === 'medkit') { g.fillStyle = '#e9ecef'; rr(g, -11, -8, 22, 16, 3); g.fill(); g.fillStyle = '#2e9e57'; g.fillRect(-2.5, -6, 5, 12); g.fillRect(-6, -2.5, 12, 5); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; rr(g, -11, -8, 22, 16, 3); g.stroke(); }
    else { const big = h === 'shieldB'; const r = big ? 9 : 6.5; const gr = g.createRadialGradient(-2, -2, 1, 0, 0, r); gr.addColorStop(0, '#d2f3ff'); gr.addColorStop(1, '#1f8fd6'); g.fillStyle = gr; g.beginPath(); g.arc(0, 2, r, 0, TAU); g.fill(); g.fillStyle = '#9fb3c0'; g.fillRect(-2.5, 2 - r - 5, 5, 6); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.beginPath(); g.arc(0, 2, r, 0, TAU); g.stroke(); }
  } else if (it.kind === 'frag') drawFrag(g, 0, 0, 1.4);
  g.restore();
}
function drawFrag(g, x, y, s) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#4c5a36'; g.beginPath(); g.ellipse(0, 0, 6, 5, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, 0); g.lineTo(6, 0); g.moveTo(0, -5); g.lineTo(0, 5); g.stroke(); g.fillStyle = '#9a9a92'; g.fillRect(4, -2, 4, 4); g.restore(); }
function drawGun(g, wid, rar, x, y, s) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const M = '#26282b', M2 = '#3a3d42', WOOD = '#6b4426', acc = RAR[rar] ? RAR[rar].c : '#999';
  const R = (c, a, b, w, h) => { g.fillStyle = c; g.fillRect(a, b, w, h); };
  if (wid === 'pistol') { R(M, -2, -3, 18, 6); R(M2, 0, -3, 16, 2.5); R(M, -2, 2, 5, 6); R(acc, 6, -1, 4, 2); }
  else if (wid === 'smg') { R(M, -12, -2, 6, 4); R(M, -6, -3.5, 22, 7); R(M2, -6, -3.5, 22, 2.5); R(M, 16, -1.5, 10, 3); R(M, 3, 3.5, 4, 9); R(acc, 6, -1, 6, 2); }
  else if (wid === 'ar') { R(M, -16, -3, 11, 6); R(M, -5, -3.5, 24, 7); R(M2, -5, -3.5, 24, 2.5); R('#2f3236', 19, -3, 12, 6); R(M, 31, -1.2, 9, 2.4); R(M, 6, 3.5, 5, 9); R('#15171a', 0, -6, 12, 3); R(acc, -2, -0.5, 6, 2); }
  else if (wid === 'shotgun') { R(WOOD, -16, -3, 13, 6); R(M, -3, -3, 13, 6); R(M2, 10, -2.4, 28, 2.6); R(M, 10, 0.4, 26, 2.2); R(WOOD, 14, 1.5, 11, 4); R(acc, 0, -1, 5, 2); }
  else if (wid === 'sniper') { R('#3f3a2e', -18, -3.5, 15, 7); R(M, -3, -3, 18, 6); R(M2, 15, -1.5, 34, 3); R('#101214', 0, -7, 20, 4); R('#4cc3ff', 19, -6.5, 1.5, 3); R(M, 7, 3, 2, 5); R(acc, -10, -1, 5, 2); }
  g.restore();
}
function drawSoldier(g, p, x, y, ang, skinI, o) {
  const S = SKINS[skinI] || SKINS[0];
  g.save(); g.translate(x, y);
  const dead = o && o.dead;
  if (!dead) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(5, 7, 19, 16, 0, 0, TAU); g.fill(); }
  g.rotate(ang);
  if (dead) { g.scale(1 + o.t * 0.04, 1 + o.t * 0.04); }
  const walk = p && p.moving && !dead ? Math.sin(p.walk * 0.085) : 0;
  // feet
  g.fillStyle = '#1e1c19';
  g.beginPath(); g.ellipse(walk * 8, -7, 6.5, 4.2, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(-walk * 8, 7, 6.5, 4.2, 0, 0, TAU); g.fill();
  // backpack
  g.fillStyle = S.pack; rr(g, -19, -9, 9, 18, 3); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
  // torso
  const tg = g.createRadialGradient(-2, -5, 2, 0, 0, 17); tg.addColorStop(0, shade(S.shirt, 1.25)); tg.addColorStop(1, shade(S.shirt, 0.75));
  g.fillStyle = tg; g.beginPath(); g.ellipse(-1, 0, 10.5, 15.5, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 1.5; g.stroke();
  // vest strap
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -12); g.lineTo(5, 10); g.stroke();
  // arms & item
  const it = p && !dead ? p.inv[p.sel] : null, rec = p ? p.recoil * 4 : 0;
  g.lineCap = 'round';
  if (it && it.kind === 'weapon') {
    const Wd = WEAPONS[it.wid]; const L = Wd.muzzle; const gx = 8 - rec, gy = 4;
    const reload = p.reloadT > 0;
    g.lineWidth = 6; g.strokeStyle = S.sleeve;
    g.beginPath(); g.moveTo(-1, 12); g.lineTo(gx + 2, gy + 2); g.stroke();
    const fhx = reload ? gx + 6 : gx + L * 0.5, fhy = reload ? gy + 9 : gy;
    g.beginPath(); g.moveTo(-1, -12); g.lineTo(fhx, fhy - 1); g.stroke();
    drawGun(g, it.wid, it.rar, gx, gy, 1);
    g.fillStyle = S.tone; g.beginPath(); g.arc(gx + 2, gy + 2, 3, 0, TAU); g.fill(); g.beginPath(); g.arc(fhx, fhy, 3, 0, TAU); g.fill();
    if (reload && Wd.mag > 1 && !Wd.perShell) { g.fillStyle = '#222'; g.fillRect(gx + 6, gy + 7 + Math.sin(p.reloadT * 10) * 2, 4, 8); }
  } else {
    const sw = p ? p.swing : 0;
    g.lineWidth = 6; g.strokeStyle = S.sleeve;
    g.beginPath(); g.moveTo(-1, 12); g.lineTo(10 + sw * 12, 9 - sw * 6); g.stroke();
    g.beginPath(); g.moveTo(-1, -12); g.lineTo(10, -9); g.stroke();
    g.fillStyle = S.tone; g.beginPath(); g.arc(10 + sw * 12, 9 - sw * 6, 3.4, 0, TAU); g.fill(); g.beginPath(); g.arc(10, -9, 3.4, 0, TAU); g.fill();
    if (it && it.kind !== 'weapon') { drawItemIcon(g, it, 15, 2, 0.6); }
  }
  // head / helmet
  const hg = g.createRadialGradient(-1, -3, 1, 1, 0, 10); hg.addColorStop(0, shade(S.helmet, 1.35)); hg.addColorStop(1, shade(S.helmet, 0.7));
  g.fillStyle = S.tone; g.beginPath(); g.arc(2.5, 0, 7, 0, TAU); g.fill();
  g.fillStyle = hg; g.beginPath(); g.arc(0, 0, 8.6, Math.PI * 0.35, Math.PI * 1.65); g.closePath(); g.fill();
  g.beginPath(); g.arc(0, 0, 8.6, 0, TAU); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1.4; g.stroke();
  g.fillStyle = 'rgba(20,25,30,0.8)'; g.fillRect(6, -4, 2.5, 8);
  // hit flash
  if (p && p.hitFlash > 0 && !dead) { g.globalAlpha = p.hitFlash * 0.7; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-1, 0, 12, 16, 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
  g.restore();
  // heal ring
  if (p && p.useT > 0 && !dead) { g.strokeStyle = 'rgba(158,227,125,0.9)'; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, 24, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - p.useT / p.useMax)); g.stroke(); }
}
function drawDropper(p) {
  const sc = 1 + p.alt * 0.9;
  ctx.fillStyle = `rgba(0,0,0,${0.25 * (1 - p.alt * 0.5)})`; ctx.beginPath(); ctx.ellipse(p.x + 20 + p.alt * 120, p.y + 24 + p.alt * 140, 16 * sc, 13 * sc, 0, 0, TAU); ctx.fill();
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc, sc);
  ctx.rotate(p.angle);
  // glider wing
  ctx.fillStyle = p.isPlayer ? '#ffb627' : '#c9cdd2'; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, -34); ctx.lineTo(-4, 0); ctx.lineTo(-10, 34); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-10, 34); ctx.lineTo(-4, 0); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(p.x, p.y); ctx.scale(sc * 0.8, sc * 0.8); ctx.translate(-p.x, -p.y);
  drawSoldier(ctx, p, p.x, p.y, p.angle, p.skin, null);
  ctx.restore();
  if (p.isPlayer) { ctx.fillStyle = '#ffb627'; ctx.font = `700 ${16 / cam.zoom}px Rajdhani,sans-serif`; ctx.textAlign = 'center'; ctx.fillText('YOU', p.x, p.y - 44 * sc); }
}
function drawPlane(B) {
  const z = 2.4;
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.save(); ctx.translate(B.x + 260, B.y + 320); ctx.rotate(B.a); ctx.scale(z, z); planeShape(true); ctx.restore();
  ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.a); ctx.scale(z, z); planeShape(false); ctx.restore();
}
function planeShape(shadow) {
  const c = (a, b) => shadow ? 'rgba(0,0,0,0.18)' : a;
  ctx.fillStyle = c('#5b6168'); ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-30, -95); ctx.lineTo(-14, -95); ctx.lineTo(14, -6); ctx.lineTo(14, 6); ctx.lineTo(-14, 95); ctx.lineTo(-30, 95); ctx.lineTo(-10, 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c('#5b6168'); ctx.beginPath(); ctx.moveTo(-58, 0); ctx.lineTo(-74, -30); ctx.lineTo(-66, -30); ctx.lineTo(-54, 0); ctx.lineTo(-66, 30); ctx.lineTo(-74, 30); ctx.closePath(); ctx.fill();
  const g = shadow ? null : ctx.createLinearGradient(0, -12, 0, 12);
  if (g) { g.addColorStop(0, '#8a9198'); g.addColorStop(0.5, '#6c737a'); g.addColorStop(1, '#4d5359'); }
  ctx.fillStyle = g || 'rgba(0,0,0,0.18)'; rr(ctx, -70, -11, 120, 22, 11); ctx.fill();
  if (!shadow) {
    ctx.fillStyle = '#20262c'; rr(ctx, 38, -6, 9, 12, 4); ctx.fill();
    ctx.fillStyle = '#ffb627'; ctx.fillRect(-30, -2, 40, 4);
    for (const s of [-1, 1]) for (const e of [40, 70]) { ctx.fillStyle = '#3c4146'; rr(ctx, -6, s * e - 5, 22, 10, 4); ctx.fill(); ctx.strokeStyle = `rgba(220,220,220,${0.3 + 0.2 * Math.sin(gtime * 60)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(17, s * e - 13); ctx.lineTo(17, s * e + 13); ctx.stroke(); }
  }
}
function drawParticles(inView) {
  const P = G.parts;
  for (const p of P) {
    if (!inView(p.x, p.y, p.size + 20)) continue;
    const a = clamp(p.life / p.max, 0, 1);
    switch (p.type) {
      case 'spark': ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = p.color; ctx.globalAlpha = a; ctx.lineWidth = p.size; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke(); ctx.globalCompositeOperation = 'source-over'; break;
      case 'smoke': ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); break;
      case 'flash': { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size); g.addColorStop(0, 'rgba(255,230,160,0.9)'); g.addColorStop(1, 'rgba(255,160,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; break; }
      case 'mflash': ctx.globalAlpha = a; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(p.size * 0.4, -p.size * 0.45); ctx.lineTo(p.size * 1.6, 0); ctx.lineTo(p.size * 0.4, p.size * 0.45); ctx.closePath(); ctx.fill(); ctx.restore(); break;
      case 'shell': ctx.globalAlpha = Math.min(1, a * 3); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-2.5, -1, 5, 2); ctx.restore(); break;
      case 'ring': ctx.globalAlpha = a; ctx.strokeStyle = p.color; ctx.lineWidth = 4 * a; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - a * a), 0, TAU); ctx.stroke(); break;
      case 'glint': ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.size, -0.6, p.size * 2, 1.2); ctx.fillRect(-0.6, -p.size, 1.2, p.size * 2); ctx.restore(); ctx.globalCompositeOperation = 'source-over'; break;
      case 'leaf': ctx.globalAlpha = a; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU); ctx.fill(); ctx.restore(); break;
      default: ctx.globalAlpha = a; ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}
let stormPat = null;
function stormPattern() {
  if (stormPat) return stormPat;
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  for (let i = 0; i < 40; i++) { const x = Math.random() * 256, y = Math.random() * 256, r = 20 + Math.random() * 60; for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r); gr.addColorStop(0, `rgba(${150 + Math.random() * 60 | 0},90,255,0.16)`); gr.addColorStop(1, 'rgba(120,60,220,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, r, 0, TAU); g.fill(); } }
  stormPat = ctx.createPattern(c, 'repeat'); return stormPat;
}
function drawStorm(x0, y0, x1, y1) {
  const S = G.storm;
  ctx.save(); ctx.beginPath(); ctx.rect(x0 - 200, y0 - 200, x1 - x0 + 400, y1 - y0 + 400); ctx.arc(S.cx, S.cy, Math.max(0.1, S.r), 0, TAU, true);
  ctx.fillStyle = 'rgba(92,36,170,0.42)'; ctx.fill('evenodd');
  const pat = stormPattern();
  if (pat && pat.setTransform && typeof DOMMatrix !== 'undefined') { pat.setTransform(new DOMMatrix().translate(gtime * 30, gtime * 12).scale(3)); ctx.fillStyle = pat; ctx.fill('evenodd'); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(190,140,255,0.85)'; ctx.lineWidth = 6 / Math.max(0.4, cam.zoom); ctx.beginPath(); ctx.arc(S.cx, S.cy, Math.max(0.1, S.r), 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(190,140,255,0.25)'; ctx.lineWidth = 24; ctx.stroke();
}
function drawPrompt(me) {
  const n = nearestInteract(me); if (!n) return;
  let x, y, text, col, sub;
  if (n.type === 'item') { x = n.o.x; y = n.o.y; text = itemName(n.o.it); col = itemColor(n.o.it); const it = n.o.it; if (it.kind === 'weapon') { const Wd = WEAPONS[it.wid]; sub = `${Math.round(Wd.dmg * DMGMUL[it.rar])}${Wd.pellets > 1 ? '×' + Wd.pellets : ''} DMG · ${Wd.mag} MAG · ${AMMO[Wd.ammo].name}`; } }
  else if (n.type === 'chest') { x = n.c.x; y = n.c.y; text = 'Search Chest'; col = '#ffd76a'; }
  else { x = n.s.x; y = n.s.y; text = 'Open Supply Drop'; col = '#4cc3ff'; }
  const z = cam.zoom;
  ctx.save(); ctx.translate(x, y - 34); ctx.scale(1 / z, 1 / z);
  ctx.font = '700 16px Rajdhani, Bahnschrift, sans-serif'; const tw = Math.max(ctx.measureText(text).width, sub ? 150 : 0) + 56;
  ctx.fillStyle = 'rgba(10,14,20,0.85)'; rr(ctx, -tw / 2, sub ? -40 : -26, tw, sub ? 44 : 30, 4); ctx.fill();
  ctx.fillStyle = col; ctx.fillRect(-tw / 2, sub ? -40 : -26, 4, sub ? 44 : 30);
  ctx.fillStyle = '#fff'; ctx.fillRect(-tw / 2 + 10, sub ? -34 : -20, 20, 18); ctx.fillStyle = '#111'; ctx.textAlign = 'center'; ctx.font = '700 14px Rajdhani, sans-serif'; ctx.fillText(touch.on ? '◉' : 'E', -tw / 2 + 20, sub ? -20 : -6);
  ctx.textAlign = 'left'; ctx.fillStyle = col; ctx.font = '700 16px Rajdhani, Bahnschrift, sans-serif'; ctx.fillText(text, -tw / 2 + 38, sub ? -20 : -6);
  if (sub) { ctx.fillStyle = '#aab4bf'; ctx.font = '600 12px Rajdhani, sans-serif'; ctx.fillText(sub, -tw / 2 + 38, -4); }
  ctx.restore();
}

// ---------- screen fx / HUD ----------
function drawScreenFx() {
  const me = G.me;
  // vignette
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // warm grade
  ctx.fillStyle = 'rgba(255,170,90,0.035)'; ctx.fillRect(0, 0, W, H);
  if (!me || G.demo) return;
  const S = G.storm;
  if (me.alive && me.state === 'ground' && d2(me.x, me.y, S.cx, S.cy) > S.r * S.r) { ctx.fillStyle = `rgba(120,50,220,${0.18 + 0.06 * Math.sin(gtime * 4)})`; ctx.fillRect(0, 0, W, H); }
  const low = me.alive ? clamp((40 - me.hp) / 40, 0, 1) * (0.6 + 0.4 * Math.sin(gtime * 5)) : 0;
  const v = Math.max(G.vign * 0.8, low * 0.7);
  if (v > 0.01) { const r = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7); r.addColorStop(0, 'rgba(160,0,0,0)'); r.addColorStop(1, `rgba(170,10,10,${v * 0.6})`); ctx.fillStyle = r; ctx.fillRect(0, 0, W, H); }
  // damage direction
  for (const d of G.dmgDirs) {
    const a = clamp(1 - d.t / 1.2, 0, 1);
    ctx.strokeStyle = `rgba(255,60,50,${a * 0.85})`; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.min(W, H) * 0.16, d.a - 0.32, d.a + 0.32); ctx.stroke();
  }
}
function hs() { return clamp(Math.min(W, H) / 820, 0.68, 1.25); }
function drawBar(x, y, w, h, frac, col, col2, label) {
  ctx.fillStyle = 'rgba(8,11,16,0.7)'; ctx.fillRect(x, y, w, h);
  const g = ctx.createLinearGradient(x, y, x, y + h); g.addColorStop(0, col); g.addColorStop(1, col2);
  ctx.fillStyle = g; ctx.fillRect(x + 2, y + 2, (w - 4) * clamp(frac, 0, 1), h - 4);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  for (let i = 1; i < 4; i++) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x + w * i / 4, y + 2, 1, h - 4); }
  if (label != null) { ctx.fillStyle = '#fff'; ctx.font = `700 ${h - 1}px Rajdhani, Bahnschrift, sans-serif`; ctx.textAlign = 'left'; ctx.fillText(label, x + w + 8, y + h - 2); }
}
function drawHUD() {
  const me = G.me, s = hs(), S = G.storm;
  ctx.textBaseline = 'alphabetic';
  // ---- minimap ----
  const M = 170 * s, mx = W - M - 16, my = 16, span = 1700;
  const focus = me && me.alive ? me : viewerEntity() || { x: cam.x, y: cam.y };
  ctx.save(); ctx.beginPath(); ctx.rect(mx, my, M, M); ctx.clip();
  ctx.fillStyle = '#1d3a4a'; ctx.fillRect(mx, my, M, M);
  const k = 1200 / WORLD, sx = (focus.x - span / 2) * k, sy = (focus.y - span / 2) * k;
  ctx.drawImage(ovCv, sx, sy, span * k, span * k, mx, my, M, M);
  const toM = (wx, wy) => [mx + (wx - focus.x + span / 2) / span * M, my + (wy - focus.y + span / 2) / span * M];
  // storm
  let [cx, cy] = toM(S.cx, S.cy); const cr = S.r / span * M;
  ctx.beginPath(); ctx.rect(mx, my, M, M); ctx.arc(cx, cy, Math.max(0.1, cr), 0, TAU, true); ctx.fillStyle = 'rgba(110,40,210,0.45)'; ctx.fill('evenodd');
  ctx.strokeStyle = '#c69bff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, Math.max(0.1, cr), 0, TAU); ctx.stroke();
  if (S.state !== 'final') { const [nx, ny] = toM(S.nx, S.ny); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(nx, ny, Math.max(0.1, S.nr / span * M), 0, TAU); ctx.stroke(); }
  for (const sp of G.supply) if (!sp.open) { const [a, b] = toM(sp.x, sp.y); ctx.fillStyle = '#4cc3ff'; ctx.fillRect(a - 4, b - 4, 8, 8); ctx.strokeStyle = '#000'; ctx.strokeRect(a - 4, b - 4, 8, 8); }
  if (G.bus && !G.bus.done) { const [a, b] = toM(G.bus.x0, G.bus.y0), [c, d] = toM(G.bus.x1, G.bus.y1); ctx.strokeStyle = 'rgba(255,182,39,0.7)'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); ctx.setLineDash([]); }
  // player arrow
  const pa = me && me.alive ? me : focus;
  const [px, py] = toM(pa.x, pa.y);
  ctx.save(); ctx.translate(px, py); ctx.rotate(pa.angle || 0); ctx.fillStyle = '#ffb627'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-5, -5); ctx.lineTo(-2, 0); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.strokeRect(mx, my, M, M);
  // POI name of current location
  // ---- storm info under minimap ----
  let y = my + M + 22 * s;
  ctx.textAlign = 'right'; ctx.font = `700 ${16 * s}px Rajdhani, Bahnschrift, sans-serif`;
  let stormTxt;
  if (S.state === 'wait') stormTxt = 'STORM SHRINKS IN ' + fmtTime(S.t);
  else if (S.state === 'shrink') stormTxt = 'STORM CLOSING · ' + fmtTime(S.t);
  else stormTxt = 'FINAL STORM';
  ctx.fillStyle = S.state === 'wait' ? '#e9edf2' : '#c69bff'; ctx.fillText(stormTxt, W - 16, y);
  if (me && me.alive && me.state === 'ground') {
    const dIn = Math.sqrt(d2(me.x, me.y, S.nx, S.ny)) - S.nr;
    if (dIn > 0 && S.state !== 'final') { ctx.fillStyle = '#aab4bf'; ctx.font = `600 ${13 * s}px Rajdhani, sans-serif`; ctx.fillText(Math.round(dIn / 10) + 'm to safe zone', W - 16, y + 17 * s); }
  }
  y += 40 * s;
  // alive & kills
  ctx.font = `700 ${22 * s}px Rajdhani, Bahnschrift, sans-serif`;
  const aliveT = String(G.alive), killT = String(me ? me.kills : 0);
  ctx.fillStyle = '#fff'; ctx.fillText(aliveT, W - 16 - 90 * s, y); ctx.fillText(killT, W - 16, y);
  ctx.font = `600 ${11 * s}px Rajdhani, sans-serif`; ctx.fillStyle = '#94a0ad'; ctx.fillText('ALIVE', W - 16 - 90 * s, y + 13 * s); ctx.fillText('ELIMS', W - 16, y + 13 * s);
  // kill feed
  y += 36 * s;
  ctx.font = `600 ${14 * s}px Rajdhani, Bahnschrift, sans-serif`;
  for (const f of G.feed) { const a = clamp(7 - f.t, 0, 1); ctx.globalAlpha = a; const tw = ctx.measureText(f.text).width; ctx.fillStyle = f.mine ? 'rgba(255,182,39,0.25)' : 'rgba(8,11,16,0.55)'; ctx.fillRect(W - 16 - tw - 12, y - 14 * s, tw + 12, 19 * s); ctx.fillStyle = f.mine ? '#ffd27a' : '#e9edf2'; ctx.fillText(f.text, W - 22, y); y += 22 * s; }
  ctx.globalAlpha = 1;
  if (!me) return;
  // POI entry
  if (me.alive && me.state === 'ground') {
    const poi = world.pois.find(p => d2(me.x, me.y, p.x, p.y) < p.r * p.r);
    if (poi && poi !== G.poiShown) { G.poiShown = poi; G.poiT = 0; }
    if (!poi && G.poiShown && d2(me.x, me.y, G.poiShown.x, G.poiShown.y) > (G.poiShown.r * 1.4) ** 2) G.poiShown = null;
  }
  // ---- health/shield ----
  if (me.alive) {
    const bw = 250 * s, bx = 18 * s, by = touch.on ? 16 * s : H - 70 * s;
    drawBar(bx, by, bw, 14 * s, me.shield / 100, '#7fd8ff', '#2a8fd0', String(Math.ceil(me.shield)));
    drawBar(bx, by + 20 * s, bw, 18 * s, me.hp / 100, '#9ee37d', '#3f9a3a', String(Math.ceil(me.hp)));
    // ammo reserves
    if (!touch.on) {
      ctx.font = `600 ${12 * s}px Rajdhani, sans-serif`; ctx.textAlign = 'left'; let ax = bx;
      for (const k2 of ['light', 'medium', 'shells', 'heavy']) { ctx.fillStyle = AMMO[k2].c; ctx.fillRect(ax, by - 16 * s, 8 * s, 8 * s); ctx.fillStyle = '#cbd3dc'; ctx.fillText(String(me.ammo[k2]), ax + 11 * s, by - 8 * s); ax += 56 * s; }
    }
  }
  // ---- hotbar ----
  hudSlots = [];
  if (me.alive && me.state === 'ground') {
    const SZ = 56 * s, gap = 6 * s, tot = SZ * 5 + gap * 4, hx = W / 2 - tot / 2, hy = H - SZ - (touch.on ? 20 : 18) * s;
    for (let i = 0; i < 5; i++) {
      const it = me.inv[i], sel = i === me.sel, x = hx + i * (SZ + gap), yy = hy - (sel ? 8 * s : 0);
      hudSlots.push({ x, y: yy, w: SZ, h: SZ });
      const rc = it ? (it.kind === 'weapon' ? RAR[it.rar] : null) : null;
      const g = ctx.createLinearGradient(x, yy, x, yy + SZ);
      if (rc) { g.addColorStop(0, rc.c + 'cc'); g.addColorStop(1, rc.d + 'ee'); } else { g.addColorStop(0, 'rgba(40,46,56,0.75)'); g.addColorStop(1, 'rgba(14,18,24,0.8)'); }
      ctx.fillStyle = g; ctx.fillRect(x, yy, SZ, SZ);
      ctx.strokeStyle = sel ? '#fff' : 'rgba(255,255,255,0.18)'; ctx.lineWidth = sel ? 2.5 : 1; ctx.strokeRect(x + 0.5, yy + 0.5, SZ - 1, SZ - 1);
      if (it) {
        drawItemIcon(ctx, it, x + SZ / 2, yy + SZ / 2 - 3 * s, it.kind === 'weapon' ? s * 0.95 : s * 1.5, false);
        ctx.font = `700 ${13 * s}px Rajdhani, sans-serif`; ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
        if (it.kind === 'weapon') ctx.fillText(String(it.mag), x + SZ - 4 * s, yy + SZ - 4 * s);
        else ctx.fillText('×' + it.count, x + SZ - 4 * s, yy + SZ - 4 * s);
      }
      ctx.font = `600 ${11 * s}px Rajdhani, sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillText(String(i + 1), x + 4 * s, yy + 12 * s);
    }
    // current item info
    const it = curItem(me);
    ctx.textAlign = 'center';
    if (it) {
      ctx.font = `700 ${15 * s}px Rajdhani, Bahnschrift, sans-serif`; ctx.fillStyle = itemColor(it);
      ctx.fillText(it.kind === 'weapon' ? itemName(it).toUpperCase() : itemName(it).toUpperCase(), W / 2, hy - 18 * s);
      if (it.kind === 'weapon') {
        const Wd = WEAPONS[it.wid];
        ctx.font = `700 ${30 * s}px Rajdhani, Bahnschrift, sans-serif`; ctx.textAlign = 'left'; ctx.fillStyle = it.mag === 0 ? '#ff6b5b' : '#fff';
        const ax2 = hx + tot + 16 * s; ctx.fillText(String(it.mag), ax2, hy + SZ - 18 * s);
        const w1 = ctx.measureText(String(it.mag)).width; ctx.font = `600 ${17 * s}px Rajdhani, sans-serif`; ctx.fillStyle = '#94a0ad'; ctx.fillText('/ ' + me.ammo[Wd.ammo], ax2 + w1 + 6 * s, hy + SZ - 18 * s);
      }
    } else { ctx.font = `700 ${14 * s}px Rajdhani, sans-serif`; ctx.fillStyle = '#94a0ad'; ctx.fillText('UNARMED · CLICK TO STRIKE', W / 2, hy - 18 * s); }
    // heal bar
    if (me.useT > 0) {
      const w = 220 * s, x = W / 2 - w / 2, yy = H / 2 + 70 * s;
      ctx.fillStyle = 'rgba(8,11,16,0.75)'; ctx.fillRect(x, yy, w, 10 * s); ctx.fillStyle = '#9ee37d'; ctx.fillRect(x + 2, yy + 2, (w - 4) * (1 - me.useT / me.useMax), 6 * s);
      ctx.font = `700 ${14 * s}px Rajdhani, sans-serif`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('USING ' + HEALS[it.hid].name.toUpperCase() + ' · ' + me.useT.toFixed(1) + 's', W / 2, yy - 6 * s);
    }
  }
  // ---- crosshair ----
  if (me.alive && me.state === 'ground' && !G.showMap) {
    const cx2 = touch.on ? W / 2 + Math.cos(me.angle) * 0 : mouse.x, cy2 = touch.on ? H / 2 : mouse.y;
    if (!touch.on) {
      const w = curWeapon(me), Wd = w ? WEAPONS[w.wid] : null;
      let sp = Wd ? (Wd.spread + me.bloom) * (me.ads ? 0.42 : 1) * (me.moving ? 1.35 : 1) + (Wd.scope && !me.ads ? 0.09 : 0) : 0.05;
      const dist = Math.max(60, Math.hypot(mouse.wx - me.x, mouse.wy - me.y));
      const gap = clamp(Math.tan(sp) * dist * cam.zoom, 4, 80);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4;
      const lines = () => { ctx.beginPath(); ctx.moveTo(cx2 - gap - 8, cy2); ctx.lineTo(cx2 - gap, cy2); ctx.moveTo(cx2 + gap, cy2); ctx.lineTo(cx2 + gap + 8, cy2); ctx.moveTo(cx2, cy2 - gap - 8); ctx.lineTo(cx2, cy2 - gap); ctx.moveTo(cx2, cy2 + gap); ctx.lineTo(cx2, cy2 + gap + 8); ctx.stroke(); };
      lines(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; lines();
      ctx.fillStyle = '#fff'; ctx.fillRect(cx2 - 1, cy2 - 1, 2, 2);
      if (me.reloadT > 0) { ctx.strokeStyle = '#ffb627'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx2, cy2, gap + 16, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - me.reloadT / me.reloadMax)); ctx.stroke(); }
    } else if (me.reloadT > 0) { ctx.strokeStyle = '#ffb627'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(W / 2, H / 2, 30, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - me.reloadT / me.reloadMax)); ctx.stroke(); }
    if (G.hitMarker > 0) {
      const a = G.hitMarker, r1 = 7 + (1 - a) * 4, r2 = r1 + 7; const hx2 = touch.on ? W / 2 : cx2, hy2 = touch.on ? H / 2 : cy2;
      ctx.strokeStyle = G.hitKill ? `rgba(255,70,60,${a})` : `rgba(255,255,255,${a})`; ctx.lineWidth = G.hitKill ? 3 : 2.2; ctx.beginPath();
      for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { ctx.moveTo(hx2 + dx * r1, hy2 + dy * r1); ctx.lineTo(hx2 + dx * r2, hy2 + dy * r2); } ctx.stroke();
    }
  }
  // ---- banners ----
  let by2 = H * 0.2;
  for (const b of G.banners) {
    const a = clamp(Math.min(b.t * 5, (b.dur - b.t) * 2), 0, 1), sl = (1 - clamp(b.t * 5, 0, 1)) * 30;
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    if (b.text) { ctx.font = `700 ${34 * s}px Rajdhani, Bahnschrift, sans-serif`; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(b.text, W / 2 + 2, by2 + 2 - sl); ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, by2 - sl); }
    if (b.sub) { ctx.font = `600 ${17 * s}px Rajdhani, sans-serif`; ctx.fillStyle = '#e9edf2'; ctx.fillText(b.sub, W / 2, by2 + 24 * s - sl); }
    by2 += 62 * s;
  }
  ctx.globalAlpha = 1;
  // POI name
  if (G.poiShown && G.poiT < 3.2) { G.poiT += 1 / 60; const a = clamp(Math.min(G.poiT * 3, (3.2 - G.poiT) * 2), 0, 1); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.font = `700 ${26 * s}px Rajdhani, Bahnschrift, sans-serif`; ctx.fillStyle = '#fff'; ctx.fillText(G.poiShown.name.toUpperCase(), W / 2, H * 0.12); ctx.font = `600 ${13 * s}px Rajdhani, sans-serif`; ctx.fillStyle = '#ffb627'; ctx.fillText('— ENTERING —', W / 2, H * 0.12 - 28 * s); ctx.globalAlpha = 1; }
  // toasts
  for (const t of G.toasts) { const a = clamp((1.8 - t.t) * 3, 0, 1); ctx.globalAlpha = a; ctx.font = `700 ${16 * s}px Rajdhani, sans-serif`; ctx.textAlign = 'center'; const tw = ctx.measureText(t.text).width + 24; ctx.fillStyle = 'rgba(8,11,16,0.75)'; ctx.fillRect(W / 2 - tw / 2, H * 0.68 - 18 * s, tw, 26 * s); ctx.fillStyle = '#ffd27a'; ctx.fillText(t.text, W / 2, H * 0.68); }
  ctx.globalAlpha = 1;
  // bus hint / drop altitude
  if (me.alive && me.state === 'bus' && !G.showMap) { ctx.textAlign = 'center'; ctx.font = `700 ${22 * s}px Rajdhani, Bahnschrift, sans-serif`; ctx.fillStyle = '#ffb627'; ctx.fillText(touch.on ? 'TAP JUMP TO DROP' : 'PRESS SPACE OR CLICK TO JUMP', W / 2, H - 60 * s); ctx.font = `600 ${14 * s}px Rajdhani, sans-serif`; ctx.fillStyle = '#cbd3dc'; ctx.fillText('M — toggle map   ·   auto-jump at end of route', W / 2, H - 38 * s); }
  if (me.alive && me.state === 'drop') { const h2 = 160 * s, x = W - 40 * s, yy = H / 2 - h2 / 2; ctx.fillStyle = 'rgba(8,11,16,0.6)'; ctx.fillRect(x, yy, 8 * s, h2); ctx.fillStyle = '#ffb627'; ctx.fillRect(x, yy + h2 * (1 - me.alt) - 3, 8 * s, 6); ctx.font = `700 ${14 * s}px Rajdhani, sans-serif`; ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.fillText(Math.round(me.alt * 400) + 'm', x - 6, yy + h2 * (1 - me.alt) + 4); }
  // big map
  if (G.showMap) drawBigMap();
  // spectating
  if (!me.alive && G.camTarget && G.camTarget.alive) { ctx.textAlign = 'center'; ctx.font = `600 ${15 * s}px Rajdhani, sans-serif`; ctx.fillStyle = '#cbd3dc'; ctx.fillText('SPECTATING ' + G.camTarget.name.toUpperCase(), W / 2, H - 30 * s); }
}
function drawBigMap() {
  const S = G.storm, me = G.me, sz = Math.min(W, H) * 0.86, x = W / 2 - sz / 2, y = H / 2 - sz / 2, k = sz / WORLD;
  ctx.fillStyle = 'rgba(5,8,12,0.7)'; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, sz, sz); ctx.clip();
  ctx.drawImage(ovCv, x, y, sz, sz);
  // grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 1; i < 8; i++) { ctx.moveTo(x + sz * i / 8, y); ctx.lineTo(x + sz * i / 8, y + sz); ctx.moveTo(x, y + sz * i / 8); ctx.lineTo(x + sz, y + sz * i / 8); } ctx.stroke();
  ctx.beginPath(); ctx.rect(x, y, sz, sz); ctx.arc(x + S.cx * k, y + S.cy * k, Math.max(0.1, S.r * k), 0, TAU, true); ctx.fillStyle = 'rgba(110,40,210,0.45)'; ctx.fill('evenodd');
  ctx.strokeStyle = '#c69bff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + S.cx * k, y + S.cy * k, Math.max(0.1, S.r * k), 0, TAU); ctx.stroke();
  if (S.state !== 'final') { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x + S.nx * k, y + S.ny * k, Math.max(0.1, S.nr * k), 0, TAU); ctx.stroke(); }
  ctx.textAlign = 'center'; ctx.font = `700 ${Math.max(11, sz / 52)}px Rajdhani, Bahnschrift, sans-serif`;
  for (const p of world.pois) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(p.name.toUpperCase(), x + p.x * k + 1, y + p.y * k + 1); ctx.fillStyle = '#fff'; ctx.fillText(p.name.toUpperCase(), x + p.x * k, y + p.y * k); }
  if (G.bus && !G.bus.done) {
    const B = G.bus; ctx.strokeStyle = 'rgba(255,182,39,0.8)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(x + B.x0 * k, y + B.y0 * k); ctx.lineTo(x + B.x1 * k, y + B.y1 * k); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(x + B.x * k, y + B.y * k); ctx.rotate(B.a); ctx.fillStyle = '#ffb627'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  for (const sp of G.supply) if (!sp.open) { ctx.fillStyle = '#4cc3ff'; ctx.fillRect(x + sp.x * k - 6, y + sp.y * k - 6, 12, 12); }
  if (me && me.alive && me.state !== 'bus') { ctx.save(); ctx.translate(x + me.x * k, y + me.y * k); ctx.rotate(me.angle); ctx.fillStyle = '#ffb627'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -7); ctx.lineTo(-3, 0); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, sz, sz);
  ctx.font = '600 14px Rajdhani, sans-serif'; ctx.fillStyle = '#cbd3dc'; ctx.textAlign = 'center';
  ctx.fillText((G.me.state === 'bus' ? (touch.on ? 'TAP JUMP TO DROP · ' : 'SPACE / CLICK TO JUMP · ') : '') + 'WHITE CIRCLE = NEXT SAFE ZONE · M TO CLOSE', W / 2, y + sz + 22);
}
function updateAudioLoops() {
  if (!AU.ready) return;
  const me = G && !G.demo ? G.me : null;
  if (!me || screen !== 'game' || G.paused) { for (const k in AU.loops) AU.setLoop(k, 0); return; }
  const S = G.storm;
  // storm
  let sv = 0; if (me.alive) { const d = Math.sqrt(d2(cam.x, cam.y, S.cx, S.cy)) - S.r; sv = d > 0 ? 0.35 : clamp(1 + d / 500, 0, 1) * 0.18; }
  AU.setLoop('storm', sv);
  AU.setLoop('wind', me.alive && me.state === 'drop' ? 0.25 + 0.2 * me.alt : 0);
  AU.setLoop('engine', G.bus && !G.bus.done ? (me.state === 'bus' ? 0.18 : clamp(1 - Math.sqrt(d2(cam.x, cam.y, G.bus.x, G.bus.y)) / 2500, 0, 1) * 0.12) : 0);
  let hv = 0; if (me.alive && me.state === 'ground') for (const c of world.chests) if (!c.open) { const d = Math.sqrt(d2(me.x, me.y, c.x, c.y)); if (d < 320) hv = Math.max(hv, (1 - d / 320) * 0.12); }
  AU.setLoop('hum', hv, 200 + 20 * Math.sin(gtime * 6));
}

// =====================================================================
//  UI / SCREENS
// =====================================================================
let screen = 'title';
const screens = ['title', 'how', 'locker', 'settings', 'pause', 'results', 'lobby'];
let backStack = [];
function show(name) {
  screen = name;
  for (const s of screens) $(s).classList.toggle('hidden', s !== name);
  cv.style.cursor = name === 'game' ? 'none' : 'default';
  if (name === 'title') renderStats();
  updateTouchUI();
}
function go(name) { backStack.push(screen); show(name); }
function backFrom() { const prev = backStack.pop() || 'title'; show(prev); }
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { AU.play('click'); backFrom(); }));
document.querySelectorAll('.btn, .seg button').forEach(b => b.addEventListener('mouseenter', () => AU.play('hover')));
function startGame() {
  AU.init(); AU.play('click'); leaveNet();
  backStack = []; newMatch(false); accum = 0; show('game');
}
function togglePause() {
  if (!G || G.demo) return;
  if (screen === 'game') { if (G.over && !G.online) return; if (!G.online) G.paused = true; mouse.down = false; show('pause'); }
  else if (screen === 'pause') { G.paused = false; show('game'); }
}
function toMenu() { leaveNet(); backStack = []; newMatch(true); show('title'); Music.mode = 'menu'; Music.intensity = 0; }
function again() { if (G && G.online) { AU.play('click'); leaveNet(); newMatch(true); goOnline(); } else startGame(); }
$('btnPlay').addEventListener('click', startGame);
$('btnOnline').addEventListener('click', goOnline);
$('btnLeaveLobby').addEventListener('click', () => { AU.play('click'); leaveNet(); show('title'); });
const nameIn = $('nameIn');
if (!profile.name) { profile.name = 'Player' + ((Math.random() * 9000 + 1000) | 0); saveProfile(); }
nameIn.value = profile.name;
nameIn.addEventListener('change', () => { profile.name = cleanName(nameIn.value); nameIn.value = profile.name; saveProfile(); });
$('btnHow').addEventListener('click', () => { AU.init(); AU.play('click'); go('how'); });
$('btnLocker').addEventListener('click', () => { AU.init(); AU.play('click'); renderLocker(); go('locker'); });
$('btnSettings').addEventListener('click', () => { AU.init(); AU.play('click'); go('settings'); });
$('btnSettingsBack').addEventListener('click', () => { AU.play('click'); backFrom(); });
$('btnResume').addEventListener('click', () => { AU.play('click'); togglePause(); });
$('btnPSettings').addEventListener('click', () => { AU.play('click'); go('settings'); });
$('btnPHow').addEventListener('click', () => { AU.play('click'); go('how'); });
$('btnQuit').addEventListener('click', () => { AU.play('click'); if (G) G.paused = false; toMenu(); });
$('btnAgain').addEventListener('click', again);
$('btnMenu').addEventListener('click', () => { AU.play('click'); toMenu(); });
// difficulty
function renderDiff() { document.querySelectorAll('#diffSeg button').forEach(b => b.classList.toggle('on', +b.dataset.d === settings.difficulty)); }
document.querySelectorAll('#diffSeg button').forEach(b => b.addEventListener('click', () => { AU.init(); AU.play('click'); settings.difficulty = +b.dataset.d; saveSettings(); renderDiff(); }));
renderDiff();
// settings
function bindSettings() {
  const rng2 = (id, key) => { const el = $(id); el.value = settings[key]; el.addEventListener('input', () => { settings[key] = +el.value; saveSettings(); AU.applyVol(); }); };
  rng2('sMaster', 'master'); rng2('sMusic', 'music'); rng2('sSfx', 'sfx');
  const chk = (id, key, f) => { const el = $(id); el.checked = settings[key]; el.addEventListener('change', () => { settings[key] = el.checked; saveSettings(); AU.applyVol(); if (f) f(); }); };
  chk('sMute', 'mute'); chk('sShake', 'shake'); chk('sFps', 'fps');
  const q = $('sQuality'); q.value = settings.quality; q.addEventListener('change', () => { settings.quality = q.value; saveSettings(); resize(); tileCache.clear(); });
  $('sSfx').addEventListener('change', () => AU.play('hit'));
}
bindSettings();
function renderStats() {
  const lvl = levelOf(profile.xp), frac = (profile.xp % XP_PER_LEVEL) / XP_PER_LEVEL;
  $('statsPanel').innerHTML = `<div class="lvl">LEVEL <span>${lvl}</span></div><div class="xpbar"><div style="width:${(frac * 100).toFixed(1)}%"></div></div>
  <div class="stat-grid">
  <div class="stat"><b>${profile.wins}</b><i>Victories</i></div><div class="stat"><b>${profile.games}</b><i>Matches</i></div>
  <div class="stat"><b>${profile.kills}</b><i>Eliminations</i></div><div class="stat"><b>${profile.bestPlace ? '#' + profile.bestPlace : '—'}</b><i>Best place</i></div>
  <div class="stat"><b>${profile.mostKills}</b><i>Most elims</i></div><div class="stat"><b>${profile.top5}</b><i>Top 5s</i></div></div>`;
}
function renderLocker() {
  const lvl = levelOf(profile.xp); $('lockerLevel').textContent = `Level ${lvl} — earn XP from placement, eliminations and wins to unlock outfits.`;
  const grid = $('skinGrid'); grid.innerHTML = '';
  SKINS.forEach((sk, i) => {
    const locked = lvl < sk.lvl; const d = document.createElement('div'); d.className = 'skin' + (profile.skin === i ? ' on' : '') + (locked ? ' locked' : '');
    const c = document.createElement('canvas'); c.width = c.height = 220; const g = c.getContext('2d'); g.scale(2, 2); g.translate(55, 58); g.scale(2, 2);
    const dummy = { inv: [mkWeapon('ar', Math.min(4, i % 5)), null, null, null, null], sel: 0, recoil: 0, reloadT: 0, moving: false, walk: 0, hitFlash: 0, useT: 0, swing: 0 };
    drawSoldier(g, dummy, 0, 0, -Math.PI / 2 + 0.4, i, null);
    d.appendChild(c); d.insertAdjacentHTML('beforeend', `<b>${sk.name}</b><i>${locked ? 'Unlocks at level ' + sk.lvl : profile.skin === i ? 'Equipped' : 'Click to equip'}</i>`);
    if (!locked) d.addEventListener('click', () => { profile.skin = i; saveProfile(); AU.play('pickup'); renderLocker(); });
    grid.appendChild(d);
  });
}
function showResults() {
  const r = G.result, me = G.me;
  const xpPlace = (NPLAYERS + 1 - r.place) * 12, xpKills = me.kills * 60, xpWin = r.win ? 500 : 0, xpSurv = Math.round(me.survived * 0.8);
  const xp = xpPlace + xpKills + xpWin + xpSurv;
  const oldLvl = levelOf(profile.xp);
  profile.xp += xp; profile.games++; profile.kills += me.kills; if (r.win) profile.wins++;
  if (!profile.bestPlace || r.place < profile.bestPlace) profile.bestPlace = r.place;
  profile.mostKills = Math.max(profile.mostKills, me.kills); profile.damage += me.dmgDealt; if (r.place <= 5) profile.top5++;
  saveProfile();
  const newLvl = levelOf(profile.xp);
  $('resPlace').textContent = '#' + r.place; $('resPlace').className = r.win ? 'win' : '';
  $('resTitle').textContent = r.win ? 'VICTORY' : r.place <= 5 ? 'SO CLOSE' : 'ELIMINATED';
  $('resSub').textContent = r.hostLeft ? r.hostLeft : r.win ? `Last one standing out of ${NPLAYERS}${G.online ? ' online' : ' on ' + DIFF[G.diff].name}` : r.killer ? `Eliminated by ${r.killer} with ${r.weapon}` : 'Lost to the storm';
  $('btnAgain').innerHTML = G.online ? 'NEXT MATCH <small>R</small>' : 'PLAY AGAIN <small>R</small>';
  const stillIn = G.isHost ? G.players.filter(q => q.alive && q.remote).length : 0;
  $('resNote').textContent = stillIn ? `You're hosting this match — ${stillIn} other player${stillIn > 1 ? 's are' : ' is'} still alive. Leaving ends it for them.` : '';
  $('resStats').innerHTML = [['Elims', me.kills], ['Damage', Math.round(me.dmgDealt)], ['Survived', fmtTime(me.survived)], ['Place', '#' + r.place]].map(([a, b]) => `<div class="stat"><b>${b}</b><i>${a}</i></div>`).join('');
  $('resXp').textContent = `+${xp} XP`;
  $('resLevel').textContent = 'LEVEL ' + newLvl;
  $('resXpFill').style.width = '0%';
  setTimeout(() => { $('resXpFill').style.width = ((profile.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100).toFixed(1) + '%'; }, 80);
  const unlocked = SKINS.filter(sk => sk.lvl > oldLvl && sk.lvl <= newLvl).map(sk => sk.name);
  $('resUnlock').textContent = newLvl > oldLvl ? `LEVEL UP! ${unlocked.length ? 'Unlocked outfit: ' + unlocked.join(', ') : ''}` : `${xpPlace} placement · ${xpKills} elims · ${xpSurv} survival${xpWin ? ' · 500 win' : ''}`;
  show('results');
}

// =====================================================================
//  ONLINE — dedicated servers. server.js runs this same file headless and
//  is the authority for every match; browsers are clients.
// =====================================================================
const APPID = 'stormfall-br-v2';
const MAX_HUMANS = 12;
const NET = { mode: null, lib: null, selfId: null, lobby: null, room: null, api: null, acts: {}, byPeer: new Map(), connected: new Set(), hostId: null, snapT: 0, meT: 0, inT: 0, since: 0, gotWorld: false, timers: [] };
const HEAL_IDS = Object.keys(HEALS);
function cleanName(n) { return String(n || '').replace(/[^\w \-]/g, '').trim().slice(0, 14) || 'Player'; }
function netEv(e) { if (G && G.isHost) G.netEv.push(e); }
function safeSend(a, d, to) { if (!a) return; try { const r = a.send(d, to); if (r && r.catch) r.catch(() => { }); } catch (e) { /* peer gone */ } }
function netWrap(room) { // adapts both Trystero APIs (array actions / onMessage actions)
  let old = null;
  return {
    act(name) {
      const a = room.makeAction(name);
      if (Array.isArray(a)) { old = true; const [send, get] = a; return { send: (d, t) => send(d, t || null), on: fn => get((d, pid) => fn(d, pid)) }; }
      old = false;
      return { send: (d, t) => a.send(d, t ? { target: t } : undefined), on: fn => { a.onMessage = (d, meta) => fn(d, meta && typeof meta === 'object' ? meta.peerId : meta); } };
    },
    onJoin(fn) { if (old) room.onPeerJoin(fn); else room.onPeerJoin = fn; },
    onLeave(fn) { if (old) room.onPeerLeave(fn); else room.onPeerLeave = fn; },
    leave() { try { room.leave(); } catch (e) { /* already left */ } }
  };
}
// ---------- dedicated servers ----------
// Set window.STORMFALL_SERVERS in index.html to one or more wss:// URLs.
// With none set, a page served by the game server connects to its own host.
function serverList() {
  const cfg = window.STORMFALL_SERVERS;
  let list = Array.isArray(cfg) ? cfg.slice() : (typeof cfg === 'string' ? cfg.split(',') : []);
  list = list.map(u => String(u).trim()).filter(u => /^wss?:\/\/[^ ]+$/.test(u) && !/YOUR-/.test(u));
  if (!list.length && /^https?:$/.test(location.protocol)) list = [(location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host];
  return list;
}
function probeServer(url, timeout) {
  return new Promise((res, rej) => {
    let ws, done = false; const t0 = performance.now();
    try { ws = new WebSocket(url); } catch (e) { rej(e); return; }
    const to = setTimeout(() => { if (done) return; done = true; try { ws.close(); } catch (e) { /* closed */ } rej(new Error('timeout')); }, timeout);
    ws.onopen = () => ws.send(JSON.stringify({ t: 'ping' }));
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t !== 'pong' || done) return;
      done = true; clearTimeout(to); ws.onmessage = null; ws.onerror = null;
      res({ ws, url, ping: performance.now() - t0, id: String(m.id || ''), region: cleanName(m.region || 'Server'), online: m.online | 0 });
    };
    ws.onerror = () => { if (done) return; done = true; clearTimeout(to); rej(new Error('connect failed')); };
  });
}
async function connectServer() {
  if (NET.ws && NET.ws.readyState === 1) return NET.ws;
  const list = serverList(); if (!list.length) throw new Error('no servers');
  const results = await Promise.allSettled(list.map(u => probeServer(u, 75000)));
  const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value).sort((x, y) => x.ping - y.ping);
  if (!ok.length) throw new Error('unreachable');
  for (const o of ok.slice(1)) { try { o.ws.close(); } catch (e) { /* closed */ } }
  const best = ok[0];
  NET.ws = best.ws; NET.selfId = best.id; NET.region = best.region; NET.ping = Math.round(best.ping);
  NET.lib = wsLib(best.ws);
  best.ws.onclose = () => {
    if (NET.ws !== best.ws) return;
    NET.ws = null; NET.lib = null; NET.inLobby = false;
    if (NET.mode === 'client') hostGone('Lost connection to the server');
    else if (screen === 'lobby') $('lbStatus').textContent = 'Disconnected from the server.';
  };
  return best.ws;
}
function wsSend(m) { const ws = NET.ws; if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(m)); } catch (e) { /* closing */ } } }
function wsLib(ws) {
  const rooms = new Map();
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'm') { const R = rooms.get(m.r); if (R && R.h[m.a]) R.h[m.a](m.d, m.f); }
    else if (m.t === 'peer') { const R = rooms.get(m.r); if (R) (m.j ? R.j : R.l).forEach(f => f(m.id)); }
    else if (m.t === 'lobby') lobbyUI(m);
    else if (m.t === 'start' && NET.inLobby) { NET.inLobby = false; joinAsClient({ m: String(m.m) }, 'server'); }
  };
  return {
    selfId: NET.selfId,
    joinRoom(cfg, room) {
      const R = { h: {}, j: [], l: [] }; rooms.set(room, R); wsSend({ t: 'join', r: room });
      return {
        makeAction(a) { return [(d) => { wsSend({ t: 'm', r: room, a, d }); return Promise.resolve(); }, fn => { R.h[a] = fn; }]; },
        onPeerJoin(fn) { R.j.push(fn); }, onPeerLeave(fn) { R.l.push(fn); },
        leave() { if (rooms.get(room) === R) { rooms.delete(room); wsSend({ t: 'leave', r: room }); } }
      };
    }
  };
}
function netTimer(fn, ms, every) { const id = every ? setInterval(fn, ms) : setTimeout(fn, ms); NET.timers.push(id); return id; }
function leaveNet() {
  for (const id of NET.timers) { clearInterval(id); clearTimeout(id); } NET.timers = [];
  if (NET.mode === 'host' && G && G.isHost && G.players.some(q => q.alive && q.remote)) safeSend(NET.acts.gn, { r: 'host' });
  if (NET.api) NET.api.leave();
  NET.api = null; NET.room = null; NET.acts = {}; NET.mode = null; NET.byPeer.clear(); NET.connected.clear(); NET.gotWorld = false;
  leaveLobby();
}

// ---------- lobby (server-run queue) ----------
async function goOnline() {
  AU.init(); AU.play('click');
  profile.name = cleanName($('nameIn').value); $('nameIn').value = profile.name; saveProfile();
  leaveNet();
  show('lobby');
  $('lbStatus').textContent = 'Finding the best server…'; $('lbCount').textContent = ''; $('lbList').textContent = '';
  const wake = setTimeout(() => { if (screen === 'lobby' && !NET.inLobby) $('lbStatus').textContent = 'Waking up the game server (can take up to a minute)…'; }, 4000);
  try { await connectServer(); } catch (e) { clearTimeout(wake); $('lbStatus').textContent = serverList().length ? "Can't reach the game servers right now. Try again in a minute, or play Practice." : 'No game server is set up for this page yet. Play Practice for now.'; return; }
  clearTimeout(wake);
  if (screen !== 'lobby') return;
  joinLobby();
}
function joinLobby() { NET.inLobby = true; wsSend({ t: 'hello', n: profile.name, s: profile.skin }); $('lbStatus').textContent = 'Joining the queue…'; $('lbCount').textContent = (NET.region || 'Server') + ' · ' + NET.ping + ' ms'; }
function leaveLobby() { if (NET.inLobby) { NET.inLobby = false; wsSend({ t: 'unqueue' }); } }
function lobbyUI(m) {
  if (screen !== 'lobby' || !NET.inLobby) return;
  const names = Array.isArray(m.names) ? m.names : [], secs = Math.max(0, Math.ceil((+m.e || 0) / 1000)), q = m.q | 0;
  $('lbStatus').textContent = (+m.e > 0 ? `Match starts in ${secs}s` : 'Starting…') + (q === 1 ? ' — bots fill empty slots' : '');
  $('lbCount').textContent = `${q} in queue · ${m.online | 0} online · ${m.matches | 0} live match${(m.matches | 0) === 1 ? '' : 'es'} · ${NET.region || 'Server'} ${NET.ping} ms`;
  const ul = $('lbList'); ul.textContent = '';
  names.slice(0, 16).forEach((n, i) => { const li = document.createElement('li'); li.textContent = cleanName(n) + (m.you === i ? '  (you)' : ''); if (i >= MAX_HUMANS) li.className = 'next'; ul.appendChild(li); });
}

// ---------- host ----------
function makeActs(api) { const A = {}; for (const k of ['sn', 'me', 'wd', 'rd', 'in', 'ac', 'gn']) A[k] = api.act(k); return A; }
function hostMatch(mid, humans, seed) {
  NET.mode = 'host'; NET.byPeer.clear(); NET.connected.clear(); NET.snapT = 0; NET.meT = 0;
  const room = NET.lib.joinRoom({ appId: APPID }, 'm-' + mid), api = netWrap(room);
  NET.room = room; NET.api = api;
  const A = NET.acts = makeActs(api);
  newMatch(false, { net: 'host', humans, seed, mid });
  A.rd.on((d, id) => {
    const p = NET.byPeer.get(id); if (!p || NET.connected.has(id)) return;
    NET.connected.add(id); safeSend(A.wd, worldPacket(p), id);
    feed(p.name + ' joined the match', false);
  });
  A.in.on((d, id) => {
    const p = NET.byPeer.get(id); if (!p || !d) return;
    for (const k of ['x', 'y', 'vx', 'vy', 'a', 'mx', 'my']) if (!Number.isFinite(d[k])) return;
    p.net = { x: clamp(d.x, 20, WORLD - 20), y: clamp(d.y, 20, WORLD - 20), vx: clamp(d.vx, -420, 420), vy: clamp(d.vy, -420, 420), a: d.a, mx: clamp(d.mx, -1, 1), my: clamp(d.my, -1, 1), f: !!d.f, ad: !!d.ad };
  });
  A.ac.on((d, id) => {
    const p = NET.byPeer.get(id); if (!p || !d || !p.alive || !G || !G.isHost) return;
    if (d.k === 'jump') { jump(p); return; }
    if (p.state !== 'ground') return;
    if (d.k === 'use') interact(p); else if (d.k === 'reload') startReload(p); else if (d.k === 'slot') selectSlot(p, clamp(d.i | 0, 0, 4));
  });
  api.onJoin(() => { });
  api.onLeave(id => { const p = NET.byPeer.get(id); if (p) dropToBot(p, ' left — AI took over'); });
  const myMid = mid;
  netTimer(() => { if (G && G.isHost && G.mid === myMid) for (const p of G.players) if (p.remote && !NET.connected.has(p.remote)) dropToBot(p, " couldn't connect — AI took over"); }, 15000);
  accum = 0; show('game');
}
function dropToBot(p, msg) {
  if (!p.remote) return;
  NET.byPeer.delete(p.remote); NET.connected.delete(p.remote);
  p.remote = null; p.net = null; p.human = false; p.ai = makeAI(G.diff);
  p.ai.landX = p.x + fr(-300, 300); p.ai.landY = p.y + fr(-300, 300); p.ai.jumpAt = G.bus ? G.bus.t + 0.03 : 0;
  if (p.alive) feed(p.name + msg, false);
}
function serWorld() {
  const bi = new Map(world.buildings.map((b, i) => [b, i]));
  return {
    seed, itemSeq, pois: world.pois, roads: world.roads, dirt: world.dirt, pads: world.pads,
    items: world.items.map(o => [o.id, Math.round(o.x), Math.round(o.y), o.it]),
    walls: world.walls.map(w => [w.x, w.y, w.w, w.h, w.kind, w.low ? 1 : 0, w.col || 0, w.horiz ? 1 : 0, w.flip ? 1 : 0, w.b ? bi.get(w.b) : -1]),
    blds: world.buildings.map(b => [b.x, b.y, b.w, b.h, b.roof, b.floor, b.ridgeH ? 1 : 0, b.doors]),
    circ: world.circles.map(c => c.kind === 'tree' ? [0, c.x, c.y, c.r, c.canopy, c.hue, c.rot] : [1, c.x, c.y, c.r, c.pts, c.shade]),
    bush: world.bushes.map(b => [b.x, b.y, b.r, b.blobs]),
    chests: world.chests.map(c => [c.x, c.y, c.open ? 1 : 0])
  };
}
function loadWorld(d) {
  seed = d.seed; for (const k in world) world[k] = []; tileCache.clear();
  world.pois = d.pois; world.roads = d.roads; world.dirt = d.dirt; world.pads = d.pads;
  world.buildings = d.blds.map((a, i) => ({ x: a[0], y: a[1], w: a[2], h: a[3], roof: a[4], floor: a[5], ridgeH: !!a[6], doors: a[7], walls: [], roofA: 1, id: i }));
  world.walls = d.walls.map(a => { const w = { x: a[0], y: a[1], w: a[2], h: a[3], kind: a[4], low: !!a[5], horiz: !!a[7], flip: !!a[8] }; if (a[6]) w.col = a[6]; if (a[9] >= 0 && world.buildings[a[9]]) { w.b = world.buildings[a[9]]; w.b.walls.push(w); } return w; });
  world.circles = d.circ.map(a => a[0] === 0 ? { kind: 'tree', x: a[1], y: a[2], r: a[3], canopy: a[4], hue: a[5], rot: a[6] } : { kind: 'rock', x: a[1], y: a[2], r: a[3], pts: a[4], shade: a[5] });
  world.bushes = d.bush.map(a => ({ x: a[0], y: a[1], r: a[2], blobs: a[3], shake: 0 }));
  world.chests = d.chests.map(a => ({ x: a[0], y: a[1], open: !!a[2], t: a[2] ? 5 : 0 }));
  world.items = d.items.map(a => ({ id: a[0], x: a[1], y: a[2], it: a[3], vx: 0, vy: 0, t: Math.random() * 10, claim: 0, claimT: 0 }));
  itemSeq = d.itemSeq; buildGrid(); buildOverview();
}
function worldPacket(p) {
  const B = G.bus;
  return {
    w: serWorld(), me: p.id, t: G.time,
    r: G.players.map(q => [q.id, q.name, q.skin, q.remote || (q.isPlayer ? NET.selfId : 0), q.alive ? 1 : 0]),
    bus: { x0: B.x0, y0: B.y0, x1: B.x1, y1: B.y1, a: B.a, dur: B.dur }
  };
}
function heldCode(it) { if (!it) return 0; if (it.kind === 'weapon') return 1 + WIDS.indexOf(it.wid) * 5 + it.rar; if (it.kind === 'heal') return 40 + HEAL_IDS.indexOf(it.hid); if (it.kind === 'frag') return 50; return 0; }
function heldItem(c) { if (!c) return null; if (c >= 50) return { kind: 'frag', count: 1 }; if (c >= 40) return { kind: 'heal', hid: HEAL_IDS[c - 40] || 'bandage', count: 1 }; const k = c - 1; return { kind: 'weapon', wid: WIDS[(k / 5) | 0] || 'ar', rar: k % 5, mag: 1 }; }
const r2 = v => Math.round(v * 100) / 100;
function netTick(dt) { if (G.isHost) hostNetTick(dt); else if (G.isClient) clientNetTick(dt); }
function hostNetTick(dt) {
  NET.snapT -= dt; if (NET.snapT > 0) return; NET.snapT = 0.05; NET.meT++;
  if (!NET.connected.size) { G.netEv.length = 0; return; }
  const S = G.storm, B = G.bus;
  const P = G.players.map(p => [p.id, Math.round(p.x), Math.round(p.y), r2(p.angle), Math.ceil(p.hp), Math.ceil(p.shield),
    p.state === 'bus' ? 0 : p.state === 'drop' ? 1 : 2, r2(p.alt),
    (p.alive ? 1 : 0) | (p.moving ? 2 : 0) | (p.inBush ? 4 : 0) | (p.ads ? 8 : 0) | (p.reloadT > 0 ? 16 : 0) | (p.useT > 0 ? 32 : 0) | (p.swing > 0.5 ? 64 : 0) | (p.firedT < 1.2 ? 128 : 0),
    heldCode(curItem(p)), Math.round(p.vx), Math.round(p.vy), p.useT > 0 ? Math.round((1 - p.useT / p.useMax) * 100) : 0]);
  const snap = {
    t: r2(G.time), al: G.alive, P, ev: G.netEv,
    s: [Math.round(S.cx), Math.round(S.cy), Math.round(S.r), Math.round(S.nx), Math.round(S.ny), Math.round(S.nr), S.state === 'wait' ? 0 : S.state === 'shrink' ? 1 : 2, r2(S.t), S.phase, S.dps],
    b: B ? [Math.round(B.x), Math.round(B.y), r2(B.t), B.done ? 1 : 0] : [0, 0, 1, 1],
    sp: G.supply.map(q => [Math.round(q.x), Math.round(q.y), r2(q.alt), q.landed ? 1 : 0, q.open ? 1 : 0])
  };
  G.netEv = [];
  for (const id of NET.connected) safeSend(NET.acts.sn, snap, id);
  if (NET.meT % 2 === 0) for (const p of G.players) if (p.remote && NET.connected.has(p.remote))
    safeSend(NET.acts.me, { inv: p.inv, sel: p.sel, am: p.ammo, rl: [r2(p.reloadT), r2(p.reloadMax)], us: [r2(p.useT), r2(p.useMax)], k: p.kills, dd: Math.round(p.dmgDealt), sv: Math.round(p.survived) }, p.remote);
}

// ---------- client ----------
function joinAsClient(d, hostId) {
  leaveLobby(); NET.mode = 'client'; NET.hostId = hostId; NET.gotWorld = false;
  $('lbStatus').textContent = 'Match found — joining…';
  const room = NET.lib.joinRoom({ appId: APPID }, 'm-' + String(d.m).slice(0, 16)), api = netWrap(room);
  NET.room = room; NET.api = api;
  const A = NET.acts = makeActs(api);
  A.wd.on((w, id) => { if (id !== hostId || NET.gotWorld || !w || !w.w) return; NET.gotWorld = true; try { clientMatch(w); } catch (e) { console.warn('bad world packet', e); leaveNet(); toMenu(); } });
  A.sn.on((sn, id) => { if (id === hostId && NET.gotWorld && G && G.isClient && sn) applySnap(sn); });
  A.me.on((m, id) => { if (id === hostId && NET.gotWorld && G && G.isClient && m) applyMe(m); });
  A.gn.on((m, id) => { if (id === hostId) hostGone('The server closed this match'); });
  api.onJoin(id => { if (id === hostId) safeSend(A.rd, { n: profile.name }, hostId); });
  api.onLeave(id => { if (id === hostId) hostGone('Lost connection to the server'); });
  netTimer(() => { if (!NET.gotWorld && NET.mode === 'client') safeSend(A.rd, { n: profile.name }, hostId); }, 2000, true);
  netTimer(() => {
    if (!NET.gotWorld && NET.mode === 'client') { leaveNet(); show('lobby'); $('lbStatus').textContent = "Couldn't join that match — finding another…"; setTimeout(() => { if (screen === 'lobby' && !NET.mode && NET.ws) joinLobby(); }, 1500); }
  }, 16000);
}
function hostGone(msg) {
  if (NET.mode !== 'client') return;
  if (G && G.isClient && G.me && !G.over && !G.resultShown) { G.over = true; G.result = { win: false, place: Math.max(1, G.alive), hostLeft: msg }; G.resultShown = true; leaveNet(); showResults(); }
  else leaveNet();
}
function clientMatch(w) {
  loadWorld(w.w);
  G = baseG(false, 1); G.isClient = true; G.online = true; G.time = w.t || 0;
  for (const r of w.r) {
    const isMe = r[3] === NET.selfId;
    const p = makePlayer(r[0], isMe, cleanName(r[1]), clamp(r[2] | 0, 0, SKINS.length - 1), 1);
    p.ai = null; p.human = !!r[3]; p.alive = !!r[4]; p.tx = null;
    G.players.push(p);
  }
  G.me = G.players.find(p => p.isPlayer) || null;
  G.alive = G.players.filter(p => p.alive).length;
  G.bus = Object.assign({ x: w.bus.x0, y: w.bus.y0, t: 0, done: false }, w.bus);
  for (const p of G.players) { p.x = G.bus.x; p.y = G.bus.y; }
  G.storm = { phase: 0, state: 'wait', t: PHASES[0].wait, cx: WORLD / 2, cy: WORLD / 2, r: WORLD * 0.76, nx: WORLD / 2, ny: WORLD / 2, nr: PHASES[0].nr, sx: 0, sy: 0, sr: 0, dps: 1 };
  cam.x = G.bus.x; cam.y = G.bus.y; cam.zoom = baseZoom() * 0.35;
  G.showMap = true; Music.mode = 'game'; Music.intensity = 0; accum = 0; NET.inT = 0;
  show('game');
  banner('MATCH FOUND', (G.players.filter(p => p.human).length) + ' real players · bots fill the rest', '#ffb627');
}
const STATES = ['bus', 'drop', 'ground'];
function applySnap(d) {
  if (!Array.isArray(d.P) || !Array.isArray(d.s)) return;
  const me = G.me;
  if (Number.isFinite(d.t)) G.time = d.t;
  if (Number.isFinite(d.al)) G.alive = d.al;
  // storm
  const S = G.storm, s = d.s, ps = S.state, pp = S.phase;
  S.cx = s[0]; S.cy = s[1]; S.r = s[2]; S.nx = s[3]; S.ny = s[4]; S.nr = s[5]; S.state = ['wait', 'shrink', 'final'][s[6]] || 'wait'; S.t = s[7]; S.phase = s[8]; S.dps = s[9];
  if (ps !== S.state || pp !== S.phase) {
    if (S.state === 'shrink') { banner('THE STORM IS CLOSING', 'Get inside the safe zone', '#b07cff'); AU.play('banner'); Music.intensity = S.phase >= 2 ? 2 : 1; }
    else if (S.state === 'wait' && S.phase > pp) banner('STORM EYE FORMING', 'Shrinks in ' + fmtTime(S.t), '#e9edf2');
  }
  if (S.state === 'wait' && S.t <= 10 && !G.stormWarned) { G.stormWarned = true; AU.play('warn'); }
  if (S.state !== 'wait') G.stormWarned = false;
  if (Array.isArray(d.b)) { G.bus.x = d.b[0]; G.bus.y = d.b[1]; G.bus.t = d.b[2]; G.bus.done = !!d.b[3]; }
  if (Array.isArray(d.sp)) d.sp.forEach((q, i) => {
    let o = G.supply[i];
    if (!o) { o = G.supply[i] = { x: q[0], y: q[1], alt: 1, landed: false, open: false, sway: 0 }; banner('SUPPLY DROP INBOUND', 'Epic & Legendary gear — check your map', '#4cc3ff'); AU.play('supply'); }
    if (!o.landed && q[3]) { puff(q[0], q[1], 14, 'rgba(150,130,100,0.5)', 40, 140, 16, 1); }
    o.x = q[0]; o.y = q[1]; o.alt = q[2]; o.landed = !!q[3]; o.open = !!q[4];
  });
  if (Array.isArray(d.ev)) for (const e of d.ev) { try { clientEvent(e); } catch (err) { /* ignore malformed event */ } }
  for (const r of d.P) {
    const p = G.players[r[0]]; if (!p || !p.alive) continue;
    const st = STATES[r[6]] || 'ground', fl = r[8];
    p.hp = r[4]; p.shield = r[5]; p.alt = r[7];
    if (p === me) {
      if (st !== 'ground') { p.state = st; p.tx = r[1]; p.ty = r[2]; p.ta = r[3]; if (st === 'bus') { p.x = r[1]; p.y = r[2]; } }
      else if (p.state !== 'ground') { p.state = 'ground'; p.x = r[1]; p.y = r[2]; p.vx = p.vy = 0; p.landT = 0.4; puff(p.x, p.y, 10, 'rgba(150,130,100,0.45)', 30, 110, 12, 0.7); AU.play('land'); addShake(0.2); G.showMap = false; Music.intensity = Math.max(Music.intensity, 1); }
      else if (d2(p.x, p.y, r[1], r[2]) > 260 * 260) { p.x = r[1]; p.y = r[2]; }
      if (fl & 64) p.swing = 1;
      continue;
    }
    if (p.tx == null || p.state !== st || d2(p.x, p.y, r[1], r[2]) > 400 * 400) { p.x = r[1]; p.y = r[2]; p.angle = r[3]; }
    p.state = st; p.tx = r[1]; p.ty = r[2]; p.ta = r[3];
    p.moving = !!(fl & 2); p.inBush = (fl & 4) ? true : null; p.ads = !!(fl & 8); p.reloadT = (fl & 16) ? 1 : 0;
    p.useMax = 1; p.useT = (fl & 32) ? Math.max(0.01, 1 - r[12] / 100) : 0;
    if (fl & 64) p.swing = 1;
    p.firedT = (fl & 128) ? Math.min(p.firedT, 0.5) : Math.max(p.firedT, 2);
    if (p.heldC !== r[9]) { p.heldC = r[9]; p.inv[0] = heldItem(r[9]); p.sel = 0; }
    p.vx = r[10]; p.vy = r[11];
  }
}
function clientEvent(e) {
  const me = G.me, P = G.players;
  switch (e[0]) {
    case 's': {
      const p = P[e[1]]; if (!p || p === me || !WEAPONS[e[5]]) return;
      const angs = e[4]; p.angle = angs[0]; p.recoil = 1; p.firedT = 0;
      for (const a of angs) spawnBullet(p, e[2], e[3], a, e[5], e[6], 0);
      shotFx(p, e[5], e[2], e[3]);
      break;
    }
    case 'gr': { const p = P[e[1]]; G.grenades.push({ x: e[2], y: e[3], vx: e[4], vy: e[5], z: 10, vz: 260, t: 2.1, owner: p, rot: 0 }); if (p && p !== me) { const s = spatial(e[2], e[3]); AU.play('pin', s.vol, s.pan); } break; }
    case 'd': {
      const t = P[e[1]], src = P[e[4]], sh = e[2], hp = e[3]; if (!t) return;
      t.hitFlash = 1; t.barT = 3;
      for (let i = 0; i < 4; i++) part(sh > 0 && hp === 0 ? 'shard' : 'blood', t.x + fr(-6, 6), t.y + fr(-6, 6), fr(-120, 120), fr(-120, 120), fr(0.25, 0.6), fr(1.5, 3), sh > 0 && hp === 0 ? '#79d4ff' : '#8a1f1f');
      if (sh > 0 && t.shield > 0 && t.shield - sh <= 0) shieldBreakFx(t);
      t.shield = Math.max(0, t.shield - sh); t.hp = Math.max(0, t.hp - hp);
      if (src && src === me) {
        if (sh > 0) floatText(t.x, t.y, String(sh), '#6fd3ff', 20);
        if (hp > 0) floatText(t.x, t.y - (sh ? 18 : 0), String(hp), hp >= 50 ? '#ffd166' : '#ffffff', hp >= 50 ? 26 : 20);
        G.hitMarker = 1; G.hitKill = false; AU.play(sh > 0 && hp === 0 ? 'hitShield' : 'hit');
      }
      if (t === me) {
        addShake(0.12 + (sh + hp) / 300); G.vign = Math.min(1, G.vign + 0.5);
        if (src && src !== me) G.dmgDirs.push({ a: Math.atan2(src.y - me.y, src.x - me.x), t: 0 });
        if (hp > 0) AU.play('hurt'); else if (sh > 0) AU.play('hitShield', 0.6);
        if (!src) floatText(me.x, me.y - 10, '-' + hp, '#c79bff', 18);
      }
      break;
    }
    case 'k': clientElim(e[1], e[2], String(e[3] || ''), e[4] | 0); break;
    case 'w': if (P[e[1]] === me && me.alive && !G.over) { G.over = true; G.endT = 0; G.result = { win: true, place: 1 }; AU.play('victory'); banner('VICTORY', 'Last one standing', '#ffb627', 6); Music.mode = 'menu'; } break;
    case 'ia': if (!world.items.some(o => o.id === e[1])) world.items.push({ id: e[1], x: e[2], y: e[3], it: e[4], vx: e[5] || 0, vy: e[6] || 0, t: Math.random() * 10, claim: 0, claimT: 0 }); break;
    case 'id': { const i = world.items.findIndex(o => o.id === e[1]); if (i >= 0) world.items.splice(i, 1); break; }
    case 'iu': { const o = world.items.find(o => o.id === e[1]); if (o && o.it) o.it.amount = e[2]; break; }
    case 'pk': if (P[e[1]] === me) AU.play(e[2] ? 'ammo' : 'pickup'); break;
    case 'co': {
      const c = world.chests[e[1]]; if (!c || c.open) return; c.open = true; c.t = 0;
      for (let i = 0; i < 18; i++) { const a = fr(0, TAU), sp = fr(40, 160); part('glint', c.x, c.y, Math.cos(a) * sp, Math.sin(a) * sp, fr(0.5, 1), fr(2, 3.5), '#ffd76a'); }
      const s = P[e[2]] === me ? { vol: 1, pan: 0 } : spatial(c.x, c.y); AU.play('chest', s.vol, s.pan);
      break;
    }
  }
}
function clientElim(vid, kid, wn, place) {
  const t = G.players[vid]; if (!t || !t.alive) return;
  const killer = kid >= 0 ? G.players[kid] : null, me = G.me;
  t.alive = false; t.place = place; t.killer = killer;
  G.bodies.push({ x: t.x, y: t.y, angle: t.angle, skin: t.skin, t: 0, p: t });
  t.inv = [null, null, null, null, null];
  puff(t.x, t.y, 10, 'rgba(180,180,190,0.4)', 20, 90, 14, 0.9);
  if (killer) feed(`${killer.name} eliminated ${t.name} with ${wn}`, killer === me || t === me);
  else feed(`${t.name} was lost to the storm`, t === me);
  if (killer === me && t !== me) { G.hitMarker = 1; G.hitKill = true; addShake(0.25); AU.play('kill'); { const n = Math.max(1, G.alive - 1); banner('ELIMINATED ' + t.name.toUpperCase(), n + (n === 1 ? ' player left' : ' players left'), '#ffb627', 2.2); } }
  else if (t !== me && me && me.alive) { const s = spatial(t.x, t.y); if (s.vol > 0.1) AU.play('elim', s.vol * 0.7, s.pan); }
  if (t === me) {
    G.over = true; G.endT = 0; G.result = { win: false, place, killer: killer ? killer.name : null, weapon: wn };
    G.camTarget = killer && killer.alive ? killer : null; G.showMap = false; AU.play('defeat'); addShake(0.5);
  }
}
function applyMe(m) {
  const me = G.me; if (!me || !Array.isArray(m.inv)) return;
  const prevR = me.reloadT, prevU = me.useT;
  me.inv = m.inv.slice(0, 5).map(it => it && typeof it === 'object' ? it : null); while (me.inv.length < 5) me.inv.push(null);
  if (m.am && typeof m.am === 'object') for (const k in AMMO) me.ammo[k] = m.am[k] | 0;
  if (!(me.selLock > 0)) me.sel = clamp(m.sel | 0, 0, 4);
  if (Array.isArray(m.rl)) { me.reloadT = +m.rl[0] || 0; me.reloadMax = +m.rl[1] || 1; }
  if (Array.isArray(m.us)) { me.useT = +m.us[0] || 0; me.useMax = +m.us[1] || 1; }
  if (prevR <= 0 && me.reloadT > 0) AU.play('magOut'); else if (prevR > 0.05 && me.reloadT <= 0) AU.play('magIn');
  if (prevU > 0.05 && me.useT <= 0) AU.play('heal');
  me.kills = m.k | 0; me.dmgDealt = m.dd | 0; me.survived = m.sv | 0;
}
function clientStep(dt) {
  G.time += dt;
  const me = G.me;
  if (me && me.alive) {
    if (me.state === 'ground') clientMove(me, dt);
    else {
      if (me.tx != null) { const k = 1 - Math.exp(-12 * dt); me.x += (me.tx - me.x) * k; me.y += (me.ty - me.y) * k; me.angle = lerpAngle(me.angle, me.ta, k); }
      const c = screen === 'game' ? readMove() : { x: 0, y: 0 }; me.ctl.mx = c.x; me.ctl.my = c.y; me.ctl.fire = false;
    }
  }
  const k = 1 - Math.exp(-16 * dt);
  for (const p of G.players) {
    if (p === me || !p.alive || p.tx == null) continue;
    const ox = p.x, oy = p.y;
    p.x += (p.tx + p.vx * 0.05 - p.x) * k; p.y += (p.ty + p.vy * 0.05 - p.y) * k; p.angle = lerpAngle(p.angle, p.ta, k);
    p.firedT += dt; p.hitFlash = Math.max(0, p.hitFlash - dt * 6); p.recoil = Math.max(0, p.recoil - dt * 9); p.barT -= dt; p.swing = Math.max(0, p.swing - dt * 4);
    if (p.state === 'ground') stepFx(p, Math.hypot(p.x - ox, p.y - oy) / dt, dt);
  }
  for (const s of G.supply) if (!s.landed) { s.sway += dt; if (Math.random() < 0.3) part('smoke', s.x + fr(-6, 6), s.y + fr(-6, 6), fr(-10, 10), fr(-30, -10), fr(1.5, 2.5), fr(8, 14), 'rgba(80,190,255,0.35)'); }
  updateBullets(dt); updateGrenades(dt); updateItems(dt);
  if (G.over) { G.endT += dt; if (G.endT > (G.result.win ? 3 : 1.8) && !G.resultShown) { G.resultShown = true; showResults(); } }
}
function clientMove(me, dt) {
  if (screen === 'game' && !G.over) playerInput(me); else { me.ctl.mx = me.ctl.my = 0; me.ctl.fire = false; me.ctl.ads = false; }
  const it = curItem(me), wpn = it && it.kind === 'weapon' ? WEAPONS[it.wid] : null;
  me.ads = me.ctl.ads && !!wpn;
  let speed = 255;
  if (me.ads) speed *= wpn.scope ? 0.45 : 0.62;
  if (me.useT > 0) speed *= 0.5;
  if (me.landT > 0) { me.landT -= dt; speed *= 0.5; }
  const k = 1 - Math.exp(-14 * dt);
  me.vx = lerp(me.vx, me.ctl.mx * speed, k); me.vy = lerp(me.vy, me.ctl.my * speed, k);
  me.x += me.vx * dt; me.y += me.vy * dt; collide(me);
  const sp = Math.hypot(me.vx, me.vy); me.moving = sp > 25; stepFx(me, sp, dt);
  me.fireCd -= dt; me.equipT -= dt; me.emptyT -= dt; me.firedT += dt; me.selLock = (me.selLock || 0) - dt;
  me.hitFlash = Math.max(0, me.hitFlash - dt * 6); me.recoil = Math.max(0, me.recoil - dt * 9); me.swing = Math.max(0, me.swing - dt * 4);
  if (me.reloadT > 0) me.reloadT = Math.max(0, me.reloadT - dt);
  if (me.useT > 0) me.useT = Math.max(0.001, me.useT - dt);
  if (wpn) me.bloom = Math.max(0, me.bloom - dt * (wpn.bloomMax * 3 + 0.05)); else me.bloom = 0;
  // predicted firing: instant local feedback, the host decides hits
  if (me.ctl.fire && wpn && me.equipT <= 0 && me.fireCd <= 0 && me.reloadT <= 0) {
    if (it.mag > 0) {
      it.mag--; me.fireCd = 1 / wpn.rate; me.firedT = 0; me.recoil = 1;
      let spread = (wpn.spread + me.bloom) * (me.ads ? 0.42 : 1) * (sp > 60 ? 1.35 : 1); if (wpn.scope && !me.ads) spread += 0.09;
      me.bloom = Math.min(wpn.bloomMax, me.bloom + wpn.bloomAdd);
      for (let i = 0; i < wpn.pellets; i++) spawnBullet(me, me.x, me.y, me.angle + (wpn.pellets > 1 ? (i / (wpn.pellets - 1) - 0.5) * 2 * spread * 0.8 : fr(-1, 1) * spread), it.wid, it.rar, 0);
      shotFx(me, it.wid);
    } else if (me.ammo[wpn.ammo] <= 0 && me.emptyT <= 0) { AU.play('empty'); me.emptyT = 0.35; toast('No ' + AMMO[wpn.ammo].name); }
  }
  bushCheck(me);
}
function clientNetTick(dt) {
  const me = G.me; if (!me || !me.alive || !NET.gotWorld) return;
  NET.inT -= dt; if (NET.inT > 0) return; NET.inT = 1 / 30;
  safeSend(NET.acts.in, { x: Math.round(me.x), y: Math.round(me.y), vx: Math.round(me.vx), vy: Math.round(me.vy), a: r2(me.angle), mx: r2(me.ctl.mx), my: r2(me.ctl.my), f: me.ctl.fire ? 1 : 0, ad: me.ctl.ads ? 1 : 0 }, NET.hostId);
}
// one entry point for player actions, local or networked
function act(k, i) {
  const me = G && G.me; if (!me || !me.alive) return;
  if (G.isClient) {
    if (k === 'slot') { if (me.state !== 'ground' || i === me.sel) return; selectSlot(me, i); me.selLock = 0.5; }
    if (k === 'jump') { if (me.state !== 'bus') return; AU.play('jump'); G.showMap = false; }
    safeSend(NET.acts.ac, { k, i }, NET.hostId);
    return;
  }
  if (k === 'jump') { jump(me); return; }
  if (me.state !== 'ground') return;
  if (k === 'use') interact(me); else if (k === 'reload') startReload(me); else if (k === 'slot') selectSlot(me, i);
}

// =====================================================================
//  BOOT
// =====================================================================
if (!window.__SF_HEADLESS) newMatch(true);
show('title');
requestAnimationFrame(frame);
document.addEventListener('visibilitychange', () => { if (document.hidden && inMatch() && !G.online) togglePause(); });
// debug/test hook
window.__SF = { get G() { return G; }, world, startGame, step, jump, toMenu, settings, mouse, keys, dbg, DIFF, NET, goOnline, hostMatch, netTick };
})();
