/* IRONOATH — Trial by Combat. Plain JS, no dependencies, all art and audio generated in code. */
(() => {
'use strict';

/* Optional painted backdrops. Leave disabled to use the built-in arenas.
   To use your own art (e.g. generated in Higgsfield), put four 16:9 images in an "assets" folder
   next to index.html, with the ground starting about 80% of the way down, and set enabled:true. */
const EXTERNAL_ART = { enabled: false, arenas: ['assets/arena1.jpg', 'assets/arena2.jpg', 'assets/arena3.jpg', 'assets/arena4.jpg'] };

/* ================= Utilities ================= */
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = a => a[(Math.random() * a.length) | 0];
const easeOut = t => 1 - (1 - t) * (1 - t);
const easeIO = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function rng32(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shade(hex, m) { const n = parseInt(hex.slice(1), 16); return `rgb(${clamp(((n >> 16) & 255) * m, 0, 255) | 0},${clamp(((n >> 8) & 255) * m, 0, 255) | 0},${clamp((n & 255) * m, 0, 255) | 0})`; }
const rgb = (a, m = 1, add = 0) => `rgb(${clamp(a[0] * m + add, 0, 255) | 0},${clamp(a[1] * m + add, 0, 255) | 0},${clamp(a[2] * m + add, 0, 255) | 0})`;
const roman = n => { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };

/* ================= Save ================= */
const SAVE_KEY = 'ironoath_save_v1';
const save = { bestDuel: 0, bestRenown: 0, wins: 0, crowns: 0, runs: 0, settings: { master: .8, music: .55, sfx: .9, mute: false, shake: true, low: false } };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); if (s) { Object.assign(save, s, { settings: Object.assign(save.settings, s.settings || {}) }); } } catch (e) { /* storage unavailable */ }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

/* ================= Audio ================= */
const AU = { ctx: null, master: null, mus: null, sfx: null, noise: null };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  try {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const c = AU.ctx = new C();
    AU.master = c.createGain(); AU.master.connect(c.destination);
    AU.mus = c.createGain(); AU.mus.connect(AU.master);
    AU.sfx = c.createGain(); AU.sfx.connect(AU.master);
    const len = c.sampleRate * 1.2 | 0, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = buf;
    // drone bed
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
    const dg = AU.drone = c.createGain(); dg.gain.value = .0; lp.connect(dg); dg.connect(AU.mus);
    for (const f of [73.42, 110, 146.6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = rand(-6, 6); o.connect(lp); o.start(); }
    applyVolumes();
    dg.gain.linearRampToValueAtTime(.085, c.currentTime + 3);
  } catch (e) { AU.ctx = null; }
}
function applyVolumes() {
  if (!AU.ctx) return; const s = save.settings;
  AU.master.gain.value = s.mute ? 0 : s.master; AU.mus.gain.value = s.music * .8; AU.sfx.gain.value = s.sfx;
}
function tone(type, f0, f1, dur, vol, delay = 0, dest) {
  const c = AU.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + .006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || AU.sfx); o.start(t); o.stop(t + dur + .03);
}
function noise(dur, vol, type, f0, f1, q = 1, delay = 0, dest) {
  const c = AU.ctx, t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = AU.noise; s.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(.02, dur * .3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest || AU.sfx); s.start(t, Math.random()); s.stop(t + dur + .03);
}
const ok = () => AU.ctx && !G.demo;
const SFX = {
  swing(h) { if (!ok()) return; noise(h ? .26 : .16, h ? .32 : .22, 'bandpass', h ? 380 : 700, h ? 1500 : 2200, 1.4); },
  clang(p = 1, v = .2) { if (!ok()) return; const b = rand(520, 640) * p; for (const [r, a, d] of [[1, 1, .28], [2.76, .6, .22], [5.4, .4, .16], [8.93, .25, .1]]) tone('square', b * r, b * r * .995, d, v * a * .5); noise(.07, v * 1.4, 'highpass', 3000, 5000, .7); },
  parry() { if (!ok()) return; const b = rand(1180, 1320); for (const [r, a, d] of [[1, 1, .9], [2.41, .6, .7], [3.9, .4, .45], [6.2, .25, .3]]) tone('sine', b * r, b * r * .99, d, .2 * a); noise(.06, .35, 'highpass', 4000, 6000, .7); },
  hit(h) { if (!ok()) return; tone('sine', h ? 150 : 180, 45, h ? .26 : .16, h ? .75 : .5); noise(h ? .2 : .12, h ? .55 : .4, 'lowpass', h ? 1400 : 1800, 200, .8); SFX.clang(h ? .55 : .8, .09); },
  cue() { if (!ok()) return; tone('sine', 1900, 1900, .06, .13); },
  step() { if (!ok()) return; noise(.07, .1, 'lowpass', 420, 140, .8); },
  dodge() { if (!ok()) return; noise(.22, .22, 'bandpass', 300, 900, .9); },
  guardbreak() { if (!ok()) return; SFX.clang(.5, .3); tone('sine', 120, 40, .3, .6); },
  death() { if (!ok()) return; tone('sine', 110, 32, .6, .8); noise(.5, .5, 'lowpass', 900, 90, .7); for (let i = 0; i < 4; i++) setTimeout(() => SFX.clang(rand(.5, .9), .08), 260 + i * 110 + rand(60)); },
  click() { if (!AU.ctx) return; tone('triangle', 520, 330, .07, .25); noise(.03, .12, 'bandpass', 1800, 1200, 2); },
  coin() { if (!AU.ctx) return; tone('sine', 1320, 1320, .12, .22); tone('sine', 1760, 1760, .22, .2, .07); },
  deny() { if (!AU.ctx) return; tone('square', 140, 110, .12, .14); },
  grunt() { if (!ok()) return; noise(.2, .2, 'bandpass', 260, 180, 4); tone('sawtooth', 120, 85, .2, .08); },
  charge() { if (!ok()) return; tone('sawtooth', 110, 440, .65, .12); noise(.65, .2, 'bandpass', 300, 2400, 3); },
  thunder() { if (!AU.ctx) return; noise(2.2, .5, 'lowpass', 260, 50, .6, .15); noise(.3, .3, 'lowpass', 1200, 200, .6); },
  cheer() { if (!ok()) return; noise(1.9, .16, 'bandpass', 900, 1300, .6); noise(1.6, .1, 'bandpass', 1900, 2300, .8, .1); },
  fanfare() { if (!AU.ctx) return; [[293.7, 0], [440, .16], [587.3, .32], [587.3, .5]].forEach(([f, d], i) => { tone('sawtooth', f, f, i === 3 ? .7 : .2, .11, d); tone('square', f * 1.5, f * 1.5, i === 3 ? .7 : .2, .04, d); }); },
  dirge() { if (!AU.ctx) return; [[220, 0], [196, .35], [174.6, .7], [146.8, 1.05]].forEach(([f, d], i) => tone('triangle', f, f, i === 3 ? 1.4 : .5, .16, d)); },
};
/* generated music: D dorian lute over drone, frame drum in battle */
const MUS = { mode: 'menu', next: 0, step: 0 };
const SC = [0, 2, 3, 5, 7, 9, 10];
const dfreq = (deg, oct = 0) => 146.83 * Math.pow(2, (SC[((deg % 7) + 7) % 7] + 12 * Math.floor(deg / 7)) / 12 + oct);
const PHR = [[4, null, 4, 5, 4, 2, null, 0], [2, null, 4, 2, 1, 0, null, -1], [7, null, 6, 4, 5, 4, 2, null], [0, 1, 2, null, 4, 2, 1, 0], [4, 5, 7, null, 8, 7, 5, 4], [2, 4, 2, 1, 0, null, 0, null]];
const SEQ = [0, 1, 0, 3, 2, 1, 4, 5], ROOT = [0, 0, -1, 0, 2, -1, -3, 0];
function pluck(f, t, v, dur = .42) {
  const c = AU.ctx, g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + .004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  for (const [ty, m, d] of [['triangle', 1, 0], ['sawtooth', 1, 5], ['sine', 2, 0]]) { const o = c.createOscillator(); o.type = ty; o.frequency.value = f * m; o.detune.value = d; o.connect(lp); o.start(t); o.stop(t + dur + .03); }
  lp.connect(g); g.connect(AU.mus);
}
function musicTick() {
  if (!AU.ctx || AU.ctx.state !== 'running') return;
  const t = AU.ctx.currentTime, battle = MUS.mode === 'battle';
  if (MUS.next < t) MUS.next = t + .06;
  while (MUS.next < t + .3) {
    const s = MUS.step % 64, bar = (s / 8) | 0, i = s % 8, at = MUS.next, deg = PHR[SEQ[bar]][i], root = ROOT[bar];
    if (deg !== null && (battle || i % 2 === 0 || bar % 2 === 1)) pluck(dfreq(deg, battle ? 1 : 0), at, battle ? .12 : .1, battle ? .3 : .6);
    if (i === 0) pluck(dfreq(root, -1), at, .17, .8);
    if (i === 4) pluck(dfreq(root + 4, -1), at, .11, .6);
    if (battle) {
      if (i === 0 || i === 3 || i === 6) { tone('sine', i === 0 ? 95 : 120, 48, .2, i === 0 ? .5 : .3, at - t, AU.mus); noise(.09, i === 0 ? .2 : .12, 'lowpass', 700, 200, .8, at - t, AU.mus); }
      if (i % 2 === 1) noise(.035, .05, 'highpass', 5000, 5000, .8, at - t, AU.mus);
    }
    MUS.next += 60 / (battle ? 124 : 80) / 2; MUS.step++;
  }
}

/* ================= View & layers ================= */
const cv = $('game'), cx = cv.getContext('2d');
const V = { W: 0, H: 0, s: 1, gy: 0, vw: 0, camMax: 0, layerHalf: 0, portrait: false };
const FLOOR = 34, BOUND = 540;
let LY = {};
function resize() {
  const w = Math.max(200, innerWidth), h = Math.max(200, innerHeight);
  let dpr = Math.min(window.devicePixelRatio || 1, save.settings.low ? 1 : 2);
  if (w * dpr > 2400) dpr = 2400 / w;
  cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
  V.W = cv.width; V.H = cv.height; V.portrait = h > w * 1.05;
  V.s = Math.min(V.W / (V.portrait ? 600 : 900), V.H / 560);
  V.vw = V.W / V.s;
  V.gy = V.portrait ? V.H * .56 : V.H - 122 * V.s;
  V.layerHalf = Math.max(760, V.vw / 2 + 30);
  V.camMax = V.layerHalf - V.vw / 2 - 10;
  LY = {};
}
function makeLayer(halfW, fn) {
  const c = document.createElement('canvas'); c.width = Math.ceil(halfW * 2 * V.s); c.height = V.H;
  const g = c.getContext('2d'); g.setTransform(V.s, 0, 0, V.s, c.width / 2, V.gy);
  fn(g, halfW, -V.gy / V.s, (V.H - V.gy) / V.s);
  if (!save.settings.low) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'overlay'; g.globalAlpha = .2; g.fillStyle = g.createPattern(grainTile(), 'repeat'); g.fillRect(0, 0, c.width, c.height); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  return c;
}
let GT = null;
function grainTile() { if (GT) return GT; GT = document.createElement('canvas'); GT.width = GT.height = 256; const g = GT.getContext('2d'), d = g.createImageData(256, 256), r = rng32(5); for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - .5) * 110 + (r() < .02 ? (r() - .5) * 120 : 0); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); return GT; }
const extImg = [];
if (EXTERNAL_ART.enabled) EXTERNAL_ART.arenas.forEach((src, i) => { const im = new Image(); im.onload = () => { extImg[i] = im; LY = {}; }; im.onerror = () => { }; im.src = src; });
function ensureLayers() {
  if (LY.id === G.arena) return;
  const A = ARENAS[G.arena], im = extImg[G.arena];
  if (im) {
    LY.far = makeLayer(V.vw / 2 + 4, (g, hw, top, bot) => { g.fillStyle = '#000'; g.fillRect(-hw, top, hw * 2, bot - top); });
    LY.near = makeLayer(V.layerHalf, (g, hw, top, bot) => {
      const fy = FLOOR - 14, k = Math.max(hw * 2 / im.width, (fy - top) / (im.height * .8), (bot - fy) / (im.height * .2));
      g.drawImage(im, -im.width * k / 2, fy - im.height * .8 * k, im.width * k, im.height * k);
    });
  } else {
    LY.far = makeLayer(V.vw / 2 + V.camMax * .3 + 20, A.far);
    LY.near = makeLayer(V.layerHalf, A.near);
  }
  LY.id = G.arena;
}

/* ---------- procedural scenery helpers ---------- */
function grad(g, y0, y1, stops) { const gr = g.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c)); return gr; }
function glow(g, x, y, r, c0, c1 = 'rgba(0,0,0,0)') { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c0); gr.addColorStop(1, c1); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
function ridge(g, hw, y, amp, step, r, color, bottom) { g.fillStyle = color; g.beginPath(); g.moveTo(-hw - 5, bottom); let v = r(); for (let x = -hw - 5; x <= hw + step; x += step) { v = v * .55 + r() * .45; g.lineTo(x, y - amp * v); } g.lineTo(hw + 5, bottom); g.fill(); }
function pines(g, hw, y, h, r, color, gap, bottom) {
  g.fillStyle = color;
  for (let x = -hw; x < hw; x += gap * (.5 + r())) {
    const hh = h * (.55 + r() * .7), w = hh * .3;
    g.beginPath();
    for (let i = 0; i < 4; i++) { const yy = y - hh + i * hh * .2, ww = w * (.35 + i * .22); g.moveTo(x, yy); g.lineTo(x - ww, yy + hh * .36); g.lineTo(x + ww, yy + hh * .36); }
    g.fill(); g.fillRect(x - 1.5, y - hh * .25, 3, hh * .25);
  }
  g.fillRect(-hw - 5, y - 1, hw * 2 + 10, bottom - y + 1);
}
function stone(g, x0, y0, x1, y1, base, r, bw = 48, bh = 23) {
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  g.fillStyle = rgb(base, .5); g.fillRect(x0, y0, x1 - x0, y1 - y0);
  let row = 0;
  for (let y = y0; y < y1; y += bh, row++) {
    let x = x0 - (row % 2) * bw / 2 - r() * 10;
    while (x < x1) {
      const w = bw * (.65 + r() * .8), v = (r() - .5) * 26;
      g.fillStyle = rgb(base, 1, v); g.fillRect(x + 1, y + 1, w - 2, bh - 2);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 1, y + 1, w - 2, 2);
      g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x + 1, y + bh - 4, w - 2, 3);
      if (r() < .3) { g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x + w * r() * .6, y + 3 + r() * (bh - 9), 4 + r() * 12, 2); }
      x += w;
    }
  }
  for (let i = 0, n = (x1 - x0) * (y1 - y0) / 14000; i < n; i++) { const m = r(); glow(g, x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 30 + r() * 90, m < .6 ? 'rgba(0,0,0,.2)' : m < .85 ? 'rgba(70,90,50,.16)' : 'rgba(255,240,210,.08)'); }
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = .8; for (let i = 0, n = (x1 - x0) * (y1 - y0) / 9000; i < n; i++) { let x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0); g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - .5) * 14; y += 4 + r() * 9; g.lineTo(x, y); } g.stroke(); }
  g.fillStyle = grad(g, y0, y1, ['rgba(0,0,0,0)', 'rgba(0,0,0,.42)']); g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.restore();
}
function crenels(g, x0, x1, y, base, r, w = 40, h = 30, gap = 30) {
  for (let x = x0; x < x1; x += w + gap) { stone(g, x, y - h, Math.min(x + w, x1), y + 1, base, r, 30, 15); }
}
function slabFloor(g, hw, y0, y1, base, r, kind) {
  g.fillStyle = grad(g, y0, y1, [rgb(base, 1.05), rgb(base, .55)]); g.fillRect(-hw, y0, hw * 2, y1 - y0);
  if (kind === 'planks') {
    let y = y0, hgt = 9;
    while (y < y1) { g.fillStyle = `rgba(0,0,0,${.28})`; g.fillRect(-hw, y, hw * 2, 1.6); for (let x = -hw + r() * 200; x < hw; x += 160 + r() * 220) { g.fillRect(x, y, 1.6, hgt); } for (let i = 0; i < hw / 6; i++) { g.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,220,170'},${.05 + r() * .06})`; g.fillRect(-hw + r() * hw * 2, y + 2 + r() * (hgt - 4), 20 + r() * 90, 1); } y += hgt; hgt *= 1.35; }
  } else if (kind === 'dirt') {
    for (let i = 0; i < hw * 3; i++) { const y = y0 + Math.pow(r(), 1.3) * (y1 - y0), k = .4 + (y - y0) / (y1 - y0); g.fillStyle = r() < .5 ? `rgba(0,0,0,${.1 + r() * .14})` : `rgba(255,235,190,${.05 + r() * .08})`; g.beginPath(); g.ellipse(-hw + r() * hw * 2, y, (2 + r() * 9) * k, (1 + r() * 2) * k, 0, 0, 7); g.fill(); }
    g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 3; for (const yy of [y0 + 24, y0 + 52]) { g.beginPath(); for (let x = -hw; x <= hw; x += 40) g.lineTo(x, yy + Math.sin(x * .013) * 4 + r() * 2); g.stroke(); }
  } else {
    let y = y0, hgt = 8, row = 0;
    while (y < y1) {
      const cw = hgt * (kind === 'slabs' ? 5.2 : 2.6);
      for (let x = -hw - (row % 2) * cw / 2 - r() * 6; x < hw; x += cw) {
        const v = (r() - .5) * 24; g.fillStyle = rgb(base, .95 - (y - y0) / (y1 - y0) * .35, v);
        if (kind === 'slabs') g.fillRect(x + 1, y + 1, cw - 2, hgt - 1.6); else { g.beginPath(); g.ellipse(x + cw / 2, y + hgt / 2, cw / 2 - .6, hgt / 2 - .4, 0, 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.1; g.stroke(); g.fillStyle = 'rgba(255,255,255,.07)'; g.beginPath(); g.ellipse(x + cw * .42, y + hgt * .36, cw * .26, hgt * .2, 0, 0, 7); g.fill(); }
        g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x + cw * .2, y + 1.2, cw * .5, 1);
      }
      y += hgt; hgt *= 1.3; row++;
    }
  }
  g.fillStyle = grad(g, y0, y0 + 26, ['rgba(0,0,0,.5)', 'rgba(0,0,0,0)']); g.fillRect(-hw, y0, hw * 2, 26);
}
function bannerCloth(g, x, y, w, h, c1, c2) {
  g.fillStyle = '#2b2118'; g.fillRect(x - w / 2 - 6, y - 4, w + 12, 5);
  g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.lineTo(x, y + h - w * .45); g.lineTo(x - w / 2, y + h); g.closePath();
  g.fillStyle = c1; g.fill(); g.save(); g.clip();
  g.fillStyle = c2; g.fillRect(x - w / 2, y + h * .3, w, h * .16);
  g.fillStyle = 'rgba(0,0,0,.2)'; for (let i = 0; i < 4; i++) g.fillRect(x - w / 2 + i * w / 4, y, w / 9, h);
  g.fillStyle = 'rgba(255,255,255,.1)'; for (let i = 0; i < 4; i++) g.fillRect(x - w / 2 + i * w / 4 + w / 8, y, w / 14, h);
  g.restore();
  g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(x, y + h * .2, w * .14, 0, 7); g.fill();
}
function sconce(g, x, y) { g.fillStyle = '#17120d'; g.fillRect(x - 3, y, 6, 34); g.fillRect(x - 10, y - 4, 20, 7); g.fillRect(x - 2, y + 30, 14, 4); g.fillStyle = '#3a2c1d'; g.fillRect(x - 7, y - 9, 14, 6); }
function brazier(g, x, y) { g.strokeStyle = '#15120f'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 16, y + 70); g.lineTo(x, y + 12); g.lineTo(x + 16, y + 70); g.moveTo(x, y + 12); g.lineTo(x, y + 70); g.stroke(); g.fillStyle = '#1a1612'; g.beginPath(); g.moveTo(x - 20, y - 2); g.lineTo(x + 20, y - 2); g.lineTo(x + 13, y + 14); g.lineTo(x - 13, y + 14); g.closePath(); g.fill(); g.fillStyle = '#5a2a12'; g.fillRect(x - 17, y - 5, 34, 4); }
function barrel(g, x, y, r) { const w = 34, h = 46; g.fillStyle = '#4a321d'; g.beginPath(); g.moveTo(x - w / 2 + 4, y - h); g.lineTo(x + w / 2 - 4, y - h); g.quadraticCurveTo(x + w / 2 + 5, y - h / 2, x + w / 2 - 4, y); g.lineTo(x - w / 2 + 4, y); g.quadraticCurveTo(x - w / 2 - 5, y - h / 2, x - w / 2 + 4, y - h); g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; for (let i = -2; i < 3; i++) g.fillRect(x + i * 6.5 - .7, y - h, 1.4, h); g.fillStyle = '#25211d'; g.fillRect(x - w / 2 - 1, y - h + 7, w + 2, 4); g.fillRect(x - w / 2 - 1, y - 11, w + 2, 4); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x - w / 2 + 4, y - h, 5, h); }
function cloudBand(g, hw, y, n, r, col, sx = 180, sy = 22) { for (let i = 0; i < n; i++) { const x = -hw + r() * hw * 2, yy = y + (r() - .5) * 90, w = sx * (.5 + r()); const gr = g.createRadialGradient(x, yy, 0, x, yy, w); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(x, yy); g.scale(1, sy / sx); g.translate(-x, -yy); g.fillStyle = gr; g.fillRect(x - w, yy - w, w * 2, w * 2); g.restore(); } }

/* ---------- arenas ---------- */
const ARENAS = [
  { name: 'The Castle Yard', sub: 'dusk', ambient: 'rgb(226,186,170)', weather: 'embers', dust: [150, 135, 120],
    lights: [{ x: -215, y: -168, r: 330, f: 1 }, { x: 215, y: -168, r: 330, f: 1 }],
    far(g, hw, top, bot) {
      const r = rng32(11);
      g.fillStyle = grad(g, top, -20, ['#15132b', '#3b2748', '#8d4440', '#e08a4a', '#f7c577']); g.fillRect(-hw, top, hw * 2, bot - top);
      glow(g, 90, -70, 380, 'rgba(255,214,140,.75)');
      cloudBand(g, hw, -330, 14, r, 'rgba(255,170,120,.22)', 240, 20); cloudBand(g, hw, -430, 10, r, 'rgba(120,80,120,.3)', 260, 26);
      ridge(g, hw, -120, 90, 46, r, '#4a2f45', bot);
      g.fillStyle = '#33223a'; // distant keep
      g.fillRect(-250, -250, 60, 200); g.fillRect(-210, -200, 150, 150); g.fillRect(-90, -290, 46, 240); for (let x = -250; x < -40; x += 16) g.fillRect(x, x < -190 ? -258 : x > -92 ? -298 : -208, 9, 9);
      g.fillStyle = '#f7c577'; g.fillRect(-72, -240, 4, 9); g.fillRect(-228, -200, 4, 8);
      ridge(g, hw, -60, 60, 30, r, '#2a1c2e', bot);
    },
    near(g, hw, top, bot) {
      const r = rng32(21), base = [112, 102, 96];
      stone(g, -hw, -252, hw, 0, base, r); crenels(g, -hw, hw, -252, base, r);
      for (const tx of [-520, 520]) { stone(g, tx - 85, -400, tx + 85, 0, [100, 92, 88], r); crenels(g, tx - 85, tx + 85, -400, [100, 92, 88], r, 30, 26, 22); g.fillStyle = '#0c0a0a'; g.fillRect(tx - 4, -320, 8, 46); g.fillRect(tx - 4, -190, 8, 46); }
      // gate
      g.fillStyle = '#3d3632'; g.beginPath(); g.moveTo(-92, 0); g.lineTo(-92, -150); g.arc(0, -150, 92, Math.PI, 0); g.lineTo(92, 0); g.fill();
      g.fillStyle = '#090807'; g.beginPath(); g.moveTo(-74, 0); g.lineTo(-74, -146); g.arc(0, -146, 74, Math.PI, 0); g.lineTo(74, 0); g.fill();
      g.save(); g.clip(); g.strokeStyle = '#2f2a26'; g.lineWidth = 5; for (let x = -70; x <= 70; x += 20) { g.beginPath(); g.moveTo(x, -230); g.lineTo(x, 0); g.stroke(); } for (let y = -210; y < 0; y += 26) { g.beginPath(); g.moveTo(-80, y); g.lineTo(80, y); g.stroke(); } g.restore();
      sconce(g, -215, -150); sconce(g, 215, -150);
      bannerCloth(g, -360, -226, 58, 150, '#7b1a16', '#c9a24a'); bannerCloth(g, 360, -226, 58, 150, '#27406b', '#c9a24a');
      slabFloor(g, hw, 0, bot, [118, 108, 100], r, 'cobble');
      barrel(g, -640, 22, r); barrel(g, -604, 30, r); barrel(g, 650, 26, r);
      g.fillStyle = '#3a2a1a'; g.fillRect(585, -70, 5, 92); g.fillRect(540, -70, 5, 92); g.fillRect(534, -58, 62, 5); g.strokeStyle = '#a7aeb8'; g.lineWidth = 3; for (const x of [552, 566, 580]) { g.beginPath(); g.moveTo(x, 18); g.lineTo(x - 4, -96); g.stroke(); }
    } },
  { name: "The King's Road", sub: 'dawn mist', ambient: 'rgb(206,214,222)', weather: 'leaves', fog: true, dust: [140, 120, 90], lights: [],
    far(g, hw, top, bot) {
      const r = rng32(31);
      g.fillStyle = grad(g, top, 0, ['#4d5c78', '#8e9aa6', '#d9c7a4', '#f4e6c2']); g.fillRect(-hw, top, hw * 2, bot - top);
      glow(g, -140, -150, 330, 'rgba(255,244,210,.9)'); g.fillStyle = '#fff6dc'; g.beginPath(); g.arc(-140, -150, 26, 0, 7); g.fill();
      cloudBand(g, hw, -360, 10, r, 'rgba(255,255,255,.2)', 260, 18);
      pines(g, hw, -90, 150, r, '#8b9a9c', 26, bot); g.fillStyle = 'rgba(232,226,208,.45)'; g.fillRect(-hw, -150, hw * 2, bot + 150);
      pines(g, hw, -50, 200, r, '#5d7070', 34, bot); g.fillStyle = 'rgba(226,222,206,.35)'; g.fillRect(-hw, -100, hw * 2, bot + 100);
      pines(g, hw, -14, 250, r, '#34474a', 44, bot);
    },
    near(g, hw, top, bot) {
      const r = rng32(41);
      const trunk = (x, w, lean) => { g.fillStyle = '#1f1a16'; g.beginPath(); g.moveTo(x - w / 2 - 10, 6); g.lineTo(x - w / 2 + lean, top); g.lineTo(x + w / 2 + lean, top); g.lineTo(x + w / 2 + 12, 6); g.fill(); g.strokeStyle = 'rgba(255,240,210,.07)'; g.lineWidth = 2; for (let i = 0; i < 9; i++) { const xx = x - w / 2 + r() * w; g.beginPath(); g.moveTo(xx, 0); g.lineTo(xx + lean * .8 + (r() - .5) * 8, top); g.stroke(); } g.fillStyle = 'rgba(70,90,50,.5)'; g.fillRect(x - w / 2 - 8, -30, w * .4, 34); };
      // drystone wall
      for (let x = -hw; x < hw; x += 210) { if (r() < .22) continue; stone(g, x, -46 - r() * 10, x + 200, 4, [104, 100, 92], r, 30, 13); }
      trunk(-560, 70, 26); trunk(-380, 40, -12); trunk(430, 54, 16); trunk(640, 84, -22);
      // wayside cross
      g.fillStyle = '#6f6c64'; g.fillRect(118, -150, 22, 152); g.fillRect(92, -118, 74, 20); g.fillStyle = '#56544d'; g.fillRect(104, -6, 50, 12); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(118, -150, 5, 150); g.fillRect(92, -118, 74, 4); g.fillStyle = 'rgba(70,100,50,.55)'; g.fillRect(118, -40, 22, 40); g.fillRect(92, -104, 30, 6);
      // foliage canopy
      for (let i = 0; i < 60; i++) { const x = -hw + r() * hw * 2, y = top + r() * 120; g.fillStyle = `rgba(${28 + r() * 20 | 0},${46 + r() * 26 | 0},${30 + r() * 12 | 0},.85)`; g.beginPath(); g.ellipse(x, y, 40 + r() * 70, 18 + r() * 26, r(), 0, 7); g.fill(); }
      slabFloor(g, hw, 0, bot, [128, 108, 78], r, 'dirt');
      for (let i = 0; i < 120; i++) { const x = -hw + r() * hw * 2, y = r() < .5 ? 2 + r() * 10 : bot - 8 - r() * 30, h = 7 + r() * 13; g.strokeStyle = `rgba(${62 + r() * 30 | 0},${92 + r() * 40 | 0},${48},.9)`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - .5) * 6, y - h * .6, x + (r() - .5) * 10, y - h); g.stroke(); }
    } },
  { name: 'The Great Hall', sub: 'by firelight', ambient: 'rgb(186,146,126)', weather: 'embers', dust: [120, 100, 80],
    lights: [{ x: 0, y: -52, r: 430, f: 2.4 }, { x: -470, y: -108, r: 150, f: .45 }, { x: 470, y: -108, r: 150, f: .45 }],
    far(g, hw, top, bot) {
      const r = rng32(51);
      stone(g, -hw, top, hw, bot, [66, 58, 54], r, 60, 28);
      for (let x = -hw + 60; x < hw; x += 230) {
        g.fillStyle = '#16233c'; g.beginPath(); g.moveTo(x - 34, -120); g.lineTo(x - 34, -330); g.arc(x, -330, 34, Math.PI, 0); g.lineTo(x + 34, -120); g.fill();
        g.fillStyle = grad(g, -370, -120, ['#31456b', '#16233c']); g.fill(); g.strokeStyle = '#0d0b0a'; g.lineWidth = 4; g.stroke(); g.beginPath(); g.moveTo(x, -364); g.lineTo(x, -120); g.moveTo(x - 34, -240); g.lineTo(x + 34, -240); g.stroke();
        g.fillStyle = 'rgba(150,180,230,.07)'; g.beginPath(); g.moveTo(x - 34, -340); g.lineTo(x + 34, -340); g.lineTo(x + 170, 60); g.lineTo(x + 40, 60); g.fill();
      }
    },
    near(g, hw, top, bot) {
      const r = rng32(61);
      // hearth
      stone(g, -150, -210, 150, 0, [92, 82, 76], r, 40, 20); g.fillStyle = '#5c5048'; g.fillRect(-166, -222, 332, 16);
      g.fillStyle = '#070505'; g.beginPath(); g.moveTo(-96, 0); g.lineTo(-96, -90); g.arc(0, -90, 96, Math.PI, 0); g.lineTo(96, 0); g.fill();
      g.fillStyle = '#231710'; g.fillRect(-56, -16, 112, 9); g.save(); g.translate(0, -18); g.rotate(-.2); g.fillRect(-48, -5, 96, 9); g.restore();
      // pillars
      for (const x of [-320, 320, -690, 690]) { stone(g, x - 30, top, x + 30, 0, [84, 76, 72], r, 30, 26); g.fillStyle = '#4d443f'; g.fillRect(x - 40, -14, 80, 14); g.fillRect(x - 38, top + 90, 76, 12); g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x - 30, top, 9, -top); }
      bannerCloth(g, -200, -400, 64, 190, '#7b1a16', '#c9a24a'); bannerCloth(g, 200, -400, 64, 190, '#27406b', '#c9a24a');
      bannerCloth(g, -560, -400, 64, 190, '#1f4a30', '#c9a24a'); bannerCloth(g, 560, -400, 64, 190, '#5a2a66', '#c9a24a');
      // tables with candles
      for (const x of [-470, 470]) { g.fillStyle = '#3a2717'; g.fillRect(x - 86, -58, 172, 9); g.fillRect(x - 74, -50, 8, 52); g.fillRect(x + 66, -50, 8, 52); g.fillStyle = '#d9cfb8'; g.fillRect(x - 3, -90, 6, 32); g.fillStyle = '#8a8f96'; g.fillRect(x - 46, -70, 14, 12); g.fillRect(x + 30, -68, 20, 10); }
      slabFloor(g, hw, 0, bot, [110, 76, 50], r, 'planks');
    } },
  { name: 'The Battlements', sub: 'storm', ambient: 'rgb(158,172,206)', weather: 'rain', storm: true, dust: [110, 115, 125],
    lights: [{ x: -250, y: -52, r: 300, f: 1.5 }, { x: 250, y: -52, r: 300, f: 1.5 }],
    far(g, hw, top, bot) {
      const r = rng32(71);
      g.fillStyle = grad(g, top, 0, ['#05070f', '#101829', '#243247', '#37475c']); g.fillRect(-hw, top, hw * 2, bot - top);
      glow(g, 170, -360, 230, 'rgba(190,210,240,.5)'); g.fillStyle = '#dfe8f4'; g.beginPath(); g.arc(170, -360, 30, 0, 7); g.fill(); g.fillStyle = 'rgba(160,175,200,.5)'; g.beginPath(); g.arc(160, -368, 7, 0, 7); g.arc(182, -350, 5, 0, 7); g.fill();
      cloudBand(g, hw, -340, 16, r, 'rgba(16,22,36,.75)', 280, 34); cloudBand(g, hw, -450, 12, r, 'rgba(10,14,24,.8)', 300, 40);
      ridge(g, hw, -150, 150, 60, r, '#1a2334', bot); ridge(g, hw, -110, 80, 36, r, '#121925', bot);
      g.fillStyle = '#0c111a'; g.fillRect(-hw, -96, hw * 2, bot + 96);
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,${170 + r() * 50 | 0},90,${.4 + r() * .5})`; g.fillRect(-hw + r() * hw * 2, -94 + r() * 46, 2, 2); }
    },
    near(g, hw, top, bot) {
      const r = rng32(81), base = [100, 106, 118];
      stone(g, -hw, -66, hw, 0, base, r, 44, 22); crenels(g, -hw, hw, -66, base, r, 52, 40, 44);
      stone(g, 500, top, 720, 0, [88, 94, 106], r); g.fillStyle = '#07080b'; g.beginPath(); g.moveTo(570, 0); g.lineTo(570, -110); g.arc(610, -110, 40, Math.PI, 0); g.lineTo(650, 0); g.fill();
      g.fillStyle = '#f0b25a'; g.fillRect(602, -260, 16, 34); glow(g, 610, -243, 60, 'rgba(255,180,90,.4)'); g.fillStyle = '#0a0a0a'; g.fillRect(609, -260, 2, 34);
      g.fillStyle = '#17130f'; g.fillRect(-604, -330, 6, 330); g.fillStyle = '#7b1a16'; g.beginPath(); g.moveTo(-598, -326); g.lineTo(-510, -310); g.lineTo(-560, -296); g.lineTo(-506, -274); g.lineTo(-598, -270); g.fill();
      slabFloor(g, hw, 0, bot, [98, 104, 116], r, 'slabs');
      brazier(g, -250, -38); brazier(g, 250, -38);
      for (const x of [-250, 250]) { const gr = g.createLinearGradient(0, 30, 0, bot); gr.addColorStop(0, 'rgba(255,170,80,.22)'); gr.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = gr; g.fillRect(x - 26, 30, 52, bot - 30); }
      g.fillStyle = 'rgba(190,210,240,.05)'; for (let i = 0; i < 26; i++) g.fillRect(-hw + r() * hw * 2, 8 + r() * (bot - 12), 40 + r() * 120, 1.5);
    } },
];
function drawFlame(g, x, y, size, t, seed) {
  for (let i = 0; i < 3; i++) {
    const k = 1 - i * .28, w = 9 * size * k, h = (24 + Math.sin(t * (9 + i * 3) + seed + i) * 5 + Math.sin(t * 23 + seed * 2) * 2.5) * size * k, sw = Math.sin(t * 7 + seed + i * 1.7) * 3 * size;
    g.fillStyle = ['rgba(214,74,20,.9)', 'rgba(255,160,40,.95)', 'rgba(255,238,170,.95)'][i];
    g.beginPath(); g.moveTo(x - w, y); g.quadraticCurveTo(x - w * 1.1, y - h * .5, x + sw, y - h); g.quadraticCurveTo(x + w * 1.1, y - h * .5, x + w, y); g.quadraticCurveTo(x, y + 5 * size, x - w, y); g.fill();
  }
}

/* ================= Combat data ================= */
const WEAPONS = {
  longsword: { name: 'Longsword', kind: 'sword', len: 92, grip: 26, two: true, reach: 124, spd: 1, dmg: 1, blockCost: 1, chip: .12, desc: 'Balanced reach and speed. The knight\'s weapon.', stats: ['Reach II', 'Speed III', 'Might II'], unlock: 0 },
  mace: { name: 'Mace & Shield', kind: 'mace', len: 58, grip: 12, two: false, shield: true, reach: 104, spd: .97, dmg: 1.06, blockCost: .5, chip: 0, desc: 'Short reach, iron defence. Blocking costs half the stamina and takes no chip damage.', stats: ['Reach I', 'Speed III', 'Guard IV'], unlock: 3, how: 'Win duel III' },
  poleaxe: { name: 'Poleaxe', kind: 'halberd', len: 122, grip: 52, two: true, reach: 160, spd: .82, dmg: 1.22, blockCost: 1.1, chip: .12, desc: 'Outranges everything on the field. Slow, brutal swings.', stats: ['Reach IV', 'Speed II', 'Might III'], unlock: 5, how: 'Fell the first Champion' },
  greatsword: { name: 'Greatsword', kind: 'gsword', len: 114, grip: 32, two: true, reach: 142, spd: .76, dmg: 1.45, blockCost: 1.2, chip: .15, armor: true, desc: 'Slowest and deadliest. Your heavy blows cannot be interrupted.', stats: ['Reach III', 'Speed I', 'Might IV'], unlock: 10, how: 'Fell the second Champion' },
  axe: { kind: 'axe', len: 56, grip: 12, two: false, reach: 100, spd: 1.1, dmg: .9, blockCost: 1.2, chip: .2 },
  sword: { kind: 'sword1', len: 76, grip: 12, two: false, shield: true, reach: 112, spd: 1, dmg: .95, blockCost: .55, chip: 0 },
  maul: { kind: 'maul', len: 96, grip: 40, two: true, reach: 132, spd: .72, dmg: 1.5, blockCost: 1.3, chip: .2, armor: true },
};
const ATK = {
  l1: { wind: .17, act: .08, rec: .24, dmg: 9, st: 10, lunge: 26, stun: .26, kb: 60, w: 'l1w', s: 'l1s', next: 'l2' },
  l2: { wind: .15, act: .08, rec: .26, dmg: 9, st: 10, lunge: 26, stun: .26, kb: 60, w: 'l2w', s: 'l2s', next: 'l3' },
  l3: { wind: .2, act: .09, rec: .38, dmg: 14, st: 12, lunge: 46, stun: .36, kb: 130, w: 'l3w', s: 'l3s' },
  hv: { wind: .48, act: .1, rec: .46, dmg: 24, st: 22, lunge: 38, stun: .5, kb: 170, heavy: true, w: 'hw', s: 'hs' },
  kick: { wind: .16, act: .08, rec: .32, dmg: 4, st: 12, lunge: 16, stun: .24, kb: 110, w: 'kw', s: 'ks', kick: true, reach: 108 },
  rush: { wind: .52, act: .14, rec: .62, dmg: 20, st: 14, lunge: 250, stun: .5, kb: 200, heavy: true, w: 'l3w', s: 'l3s' },
  sweep: { wind: .8, act: .12, rec: .26, dmg: 24, st: 0, lunge: 50, stun: .5, kb: 160, heavy: true, unblockable: true, w: 'l2w', s: 'l2s', next: 'sweep2', auto: true, reachAdd: 26 },
  sweep2: { wind: .5, act: .12, rec: .62, dmg: 28, st: 0, lunge: 60, stun: .6, kb: 220, heavy: true, unblockable: true, w: 'hw', s: 'ss', reachAdd: 26 },
  chain1: { wind: .42, act: .1, rec: .3, dmg: 21, st: 0, lunge: 44, stun: .45, kb: 150, heavy: true, w: 'hw', s: 'hs', next: 'chain2', auto: true },
  chain2: { wind: .36, act: .1, rec: .3, dmg: 21, st: 0, lunge: 44, stun: .45, kb: 150, heavy: true, w: 'l2w', s: 'l2s', next: 'sp', auto: true },
  sp: { wind: .74, act: .12, rec: .56, dmg: 44, st: 0, lunge: 66, stun: .7, kb: 260, heavy: true, unblockable: true, w: 'sw', s: 'ss' },
};
const PK = ['lean', 'hx', 'hy', 'head', 'sh', 'el', 'wp', 'bsh', 'bel', 'ff', 'bf', 'fy'];
const mk = o => Object.assign({ lean: .1, hx: 0, hy: 0, head: 0, sh: .75, el: 1.25, wp: 2.75, bsh: .95, bel: .95, ff: 26, bf: -24, fy: 0 }, o);
const POSE = {
  idle: mk({}),
  block: mk({ lean: -.03, hx: -4, hy: 4, head: .05, sh: 1.2, el: 1.5, wp: 3.02, bsh: 1.5, bel: .4, ff: 24, bf: -30 }),
  l1w: mk({ lean: -.05, hx: -5, hy: 2, sh: 2.3, el: 1.0, wp: 3.95, bsh: .6, bel: 1.1, ff: 22, bf: -26 }),
  l1s: mk({ lean: .34, hx: 16, hy: 7, head: .1, sh: 1.25, el: .25, wp: 1.15, bsh: .2, bel: 1.0, ff: 46, bf: -26 }),
  l2w: mk({ lean: .12, hx: 2, hy: 6, sh: -.45, el: .6, wp: -.7, bsh: .7, bel: 1.0, ff: 30, bf: -24 }),
  l2s: mk({ lean: .22, hx: 14, hy: 3, head: -.05, sh: 1.75, el: .3, wp: 2.35, bsh: .1, bel: 1.0, ff: 44, bf: -26 }),
  l3w: mk({ lean: .0, hx: -8, hy: 8, sh: -.55, el: 1.95, wp: 1.5, bsh: 1.0, bel: .8, ff: 20, bf: -30 }),
  l3s: mk({ lean: .42, hx: 30, hy: 13, head: .12, sh: 1.5, el: .06, wp: 1.56, bsh: -.3, bel: .7, ff: 62, bf: -30 }),
  hw: mk({ lean: -.22, hx: -11, hy: 7, head: -.05, sh: 2.9, el: .9, wp: 4.45, bsh: .7, bel: 1.2, ff: 20, bf: -32 }),
  hs: mk({ lean: .52, hx: 27, hy: 14, head: .15, sh: .95, el: .15, wp: .72, bsh: 0, bel: .9, ff: 56, bf: -30 }),
  sw: mk({ lean: -.12, hx: -6, hy: -2, head: -.1, sh: 3.05, el: .25, wp: 3.4, bsh: .8, bel: 1.2, ff: 22, bf: -30 }),
  ss: mk({ lean: .62, hx: 34, hy: 18, head: .2, sh: .85, el: .1, wp: .55, bsh: -.1, bel: .9, ff: 64, bf: -30 }),
  kw: mk({ lean: -.12, hx: -8, hy: 2, sh: .9, el: 1.5, wp: 2.9, ff: 14, bf: -22, fy: 26 }),
  ks: mk({ lean: -.38, hx: 2, hy: 4, head: .15, sh: .5, el: 1.4, wp: 2.6, bsh: .3, bel: 1.0, ff: 78, bf: -20, fy: 50 }),
  hit: mk({ lean: -.36, hx: -9, hy: 5, head: -.38, sh: .3, el: .7, wp: 1.9, bsh: -.3, bel: .5, ff: 16, bf: -36 }),
  stagger: mk({ lean: -.2, hx: -7, hy: 10, head: .32, sh: .15, el: .45, wp: .95, bsh: -.1, bel: .4, ff: 18, bf: -32 }),
  dodge: mk({ lean: -.3, hx: -6, hy: 16, sh: .6, el: 1.35, wp: 2.35, bsh: .5, bel: 1.2, ff: 30, bf: -38 }),
  win: mk({ lean: 0, head: -.18, sh: 2.95, el: .12, wp: 3.14, bsh: .2, bel: .5 }),
  dead: mk({ lean: -.1, sh: .5, el: .3, wp: 1.35, bsh: .2, bel: .3, head: -.3, ff: 22, bf: -18 }),
};
const ARM = {
  plate: { b: '#8f98a6', d: '#23262d', l: '#dfe6ef', j: '#6d7582' },
  mail: { b: '#666c76', d: '#1e2126', l: '#a9b0bb', j: '#50555e' },
  leather: { b: '#6e4a2e', d: '#22150c', l: '#a3764c', j: '#553823' },
  black: { b: '#3b3e48', d: '#0b0c10', l: '#8a92a2', j: '#2a2c33' },
};
const FLASHC = { b: '#ffffff', d: '#d8d8d8', l: '#ffffff' };
const FOES = {
  brigand: { title: 'Brigand', weapon: 'axe', armor: 'leather', helm: 'hood', hp: .8, dmg: .85, scale: .97, spd: 1.08, ai: { aggr: .9, block: .12, parry: 0, dodge: .22, heavy: .2, combo: 3, cd: [.55, 1.2] } },
  manatarms: { title: 'Man-at-Arms', weapon: 'sword', armor: 'mail', helm: 'kettle', tabard: true, hp: 1, dmg: .9, scale: 1, spd: .95, ai: { aggr: .45, block: .62, parry: .04, dodge: .04, heavy: .25, combo: 2, cd: [.85, 1.7] } },
  halberdier: { title: 'Halberdier', weapon: 'poleaxe', armor: 'mail', helm: 'kettle', tabard: true, hp: .9, dmg: .95, scale: 1, spd: .92, ai: { aggr: .5, block: .25, parry: .04, dodge: .28, heavy: .45, combo: 1, keep: true, cd: [.9, 1.8] } },
  knight: { title: 'Knight', weapon: 'longsword', armor: 'plate', helm: 'bascinet', tabard: true, hp: 1.1, dmg: 1, scale: 1.02, spd: 1, ai: { aggr: .6, block: .42, parry: .16, dodge: .12, heavy: .35, combo: 3, feint: .2, cd: [.65, 1.4] } },
  reaver: { title: 'Reaver', weapon: 'maul', armor: 'leather', helm: 'barbute', hp: 1.25, dmg: 1.05, scale: 1.08, spd: .9, ai: { aggr: .85, block: .08, parry: 0, dodge: .08, heavy: .7, combo: 1, cd: [.8, 1.5] } },
  champion: { title: 'Champion', weapon: 'longsword', armor: 'black', helm: 'great', tabard: true, plume: true, boss: true, hp: 1.4, dmg: 1.1, scale: 1.1, spd: 1, ai: { aggr: .7, block: .45, parry: .24, dodge: .2, heavy: .4, combo: 3, special: true, feint: .28, cd: [.55, 1.15] } },
};
const TRAITS = [
  { n: 'Ironclad', d: 'far tougher than he looks', f: c => { c.maxHp *= 1.35; } },
  { n: 'Swift', d: 'strikes faster', f: c => { c.atkSpd *= 1.15; } },
  { n: 'Relentless', d: 'never tires', f: c => { c.regenMul = 2; c.cdMul *= .72; } },
  { n: 'Duelist', d: 'a master of the parry', f: c => { c.aip.parry += .24; } },
  { n: 'Brutal', d: 'hits harder', f: c => { c.dmgMul *= 1.25; } },
  { n: 'Wary', d: 'slips away from blows', f: c => { c.aip.dodge += .3; } },
];
const NAMES = ['Hob', 'Wat', 'Ansel', 'Garrick', 'Osric', 'Tibalt', 'Bertram', 'Godwin', 'Lambert', 'Rolf', 'Edric', 'Hamon', 'Piers', 'Drogo', 'Emeric', 'Wulfric', 'Oswin', 'Milo', 'Arnulf', 'Reynard'];
const EPI = { brigand: ['the Cutpurse', 'of the Low Road', 'One-Ear', 'the Rat'], manatarms: ['of the Watch', 'the Steady', 'Gatekeeper', 'the Wall'], halberdier: ['of the Marsh', 'Long-Reach', 'the Heron', 'of the Pike'], knight: ['the Unbroken', 'of Ashford', 'the Younger', 'Lionheart'], reaver: ['the Butcher', 'Ox-Hand', 'the Red', 'Skullsplitter'] };
const BOSSES = [{ n: 'Ser Maldred', e: 'the Gate-Warden', w: 'longsword', c: '#5a2a66', rush: true, move: 'Gate Rush — he lunges from afar' }, { n: 'Lord Harrow', e: 'the Red Marshal', w: 'poleaxe', c: '#8f1f18', spKey: 'sweep', move: 'Reaping Sweep — two unblockable cuts' }, { n: 'The Black Constable', e: 'Undefeated', w: 'greatsword', c: '#22262e', spKey: 'chain1', enrage: true, move: "Executioner's Chain — three blows, the last unblockable" }];
const CLOTHS = ['#7b1a16', '#1f4a30', '#8a6a1a', '#5a2a66', '#3a3a3a', '#8a4a1c', '#1c5a5a'];

function makeFoe(n) {
  let type, boss = null;
  if (n % 5 === 0) { type = 'champion'; boss = BOSSES[Math.min(n / 5 - 1, 99) % 3]; }
  else if (n <= 4) type = ['brigand', 'manatarms', 'halberdier', 'knight'][n - 1];
  else type = pick(['brigand', 'manatarms', 'halberdier', 'knight', 'knight', 'reaver', 'reaver']);
  const F = FOES[type], k = Math.min(1.4, .62 + .05 * n);
  const c = {
    type, title: F.title, weapon: boss ? boss.w : F.weapon, armor: F.armor, helm: F.helm, plume: !!F.plume, tabard: !!F.tabard, boss: !!F.boss, scale: F.scale,
    name: boss ? boss.n + ', ' + boss.e : pick(NAMES) + ' ' + pick(EPI[type]), cloth: boss ? boss.c : pick(CLOTHS),
    maxHp: (74 + 13 * n) * F.hp, dmgMul: (.58 + .055 * n) * F.dmg, taken: 1, maxStam: 90 + Math.min(40, n * 3), atkSpd: 1, moveSpd: F.spd,
    windSlow: Math.max(1.12, 1.45 - .04 * n), regenMul: 1, cdMul: Math.max(.6, 1.2 - .04 * n), trait: null,
    aip: { aggr: F.ai.aggr, block: F.ai.block * k, parry: F.ai.parry * k, dodge: F.ai.dodge * k, heavy: F.ai.heavy, combo: F.ai.combo, keep: !!F.ai.keep, special: !!F.ai.special, cd: F.ai.cd, feint: (F.ai.feint || 0) * Math.min(1.2, k), rush: !!(boss && boss.rush), spKey: boss ? boss.spKey : null, enrage: !!(boss && boss.enrage) },
    move: boss ? boss.move : null, resMul: boss ? 1.5 : 1,
  };
  if (n > 15 && boss) { c.maxHp *= 1 + (n - 15) * .03; }
  if ((n >= 6 && !boss && Math.random() < .6) || (boss && n >= 10)) { const t = pick(TRAITS); c.trait = t; t.f(c); }
  return c;
}
const UPS = [
  { id: 'whet', name: 'Whetstone', desc: '+15% damage with every blow.', cost: 45, max: 6, c: ['#6b7280', '#2c313a'], g: 'W' },
  { id: 'plate', name: 'Tempered Plate', desc: 'Take 10% less damage.', cost: 45, max: 6, c: ['#5d6b82', '#232a36'], g: 'T' },
  { id: 'wind', name: 'Second Wind', desc: '+25 maximum stamina and faster recovery.', cost: 35, max: 4, c: ['#4f8a3c', '#1f3a17'], g: 'S' },
  { id: 'heart', name: 'Ox Heart', desc: '+20 maximum health, and mend 20 now.', cost: 40, max: 6, c: ['#a32a22', '#4a100c'], g: 'O' },
  { id: 'surgeon', name: 'Barber-Surgeon', desc: 'Mend 45% of your health at once.', cost: 35, max: 99, c: ['#b7a98a', '#5a4f3a'], g: 'B', once: true },
  { id: 'rip', name: 'Riposte Drill', desc: 'Ripostes after a parry deal +50% more.', cost: 40, max: 4, c: ['#c9a24a', '#5c4513'], g: 'R' },
  { id: 'quick', name: 'Quick Hands', desc: 'All attacks are 8% faster.', cost: 50, max: 4, c: ['#2d6f7a', '#123238'], g: 'Q' },
  { id: 'heavyh', name: 'Executioner', desc: 'Heavy blows and Oath Strikes deal +25%.', cost: 45, max: 4, c: ['#5a2a66', '#27112d'], g: 'E' },
  { id: 'foot', name: 'Footwork', desc: 'Dodging costs 35% less stamina.', cost: 30, max: 3, c: ['#8a6a1a', '#3d2e0a'], g: 'F' },
  { id: 'bulwark', name: 'Bulwark', desc: 'Blocking costs 30% less stamina.', cost: 35, max: 3, c: ['#42506b', '#1a2130'], g: 'U' },
  { id: 'fervor', name: 'Battle Fervour', desc: 'Mend 12% of your health on every kill.', cost: 45, max: 3, c: ['#8f3a1c', '#3d170a'], g: 'V' },
  { id: 'oath', name: 'Oathkeeper', desc: 'Resolve builds 40% faster.', cost: 40, max: 3, c: ['#b08d2e', '#4d3c10'], g: 'K' },
  { id: 'eye', name: 'Keen Eye', desc: 'A wider window in which to parry.', cost: 40, max: 3, c: ['#3f6a52', '#172a20'], g: 'Y' },
  { id: 'purse', name: 'Heavy Purse', desc: 'Earn 30% more crowns from each duel.', cost: 35, max: 3, c: ['#9a7a22', '#40320c'], g: 'P' },
];
const upLv = (run, id) => run.ups[id] || 0;
function makePlayerCfg(run) {
  const u = id => upLv(run, id);
  return {
    isPlayer: true, name: 'You', weapon: run.weapon, armor: 'plate', helm: 'bascinet', tabard: true, plume: false, cloth: '#27406b', scale: 1.02,
    maxHp: 100 + 20 * u('heart'), hp: run.hp, dmgMul: 1 + .15 * u('whet'), taken: Math.pow(.9, u('plate')), maxStam: 100 + 25 * u('wind'), regenMul: 1 + .12 * u('wind'),
    atkSpd: 1 + .08 * u('quick'), moveSpd: 1, windSlow: 1, heavyMul: 1 + .25 * u('heavyh'), ripMul: 1 + .5 * u('rip'), dodgeCost: 22 * Math.pow(.65, u('foot')),
    blockMul: Math.pow(.7, u('bulwark')), resMul: 1 + .4 * u('oath'), parryWin: .34 + .05 * u('eye'),
  };
}

/* ================= Fighter ================= */
const HIP = 92, TORSO = 56, UL = 50, LL = 50, UA = 32, FA = 30;
let ATKID = 0;
class Fighter {
  constructor(c) {
    Object.assign(this, { x: 0, kbv: 0, facing: 1, state: 'idle', t: 0, dur: 0, walk: 0, walkAmp: 0, moveDir: 0, atk: null, atkPhase: 0, atkId: 0, hitDone: false, blockT: 0, parryOK: true, lastBlockEnd: -9, ripT: 0, stamDelay: 0, flash: 0, fall: 0, resolve: 0, trail: [], glow: 0, glint: 0, parries: 0, hurtTotal: 0, dv: 0, seed: rand(9),
      dmgMul: 1, taken: 1, atkSpd: 1, moveSpd: 1, windSlow: 1, heavyMul: 1, ripMul: 1, dodgeCost: 22, blockMul: 1, resMul: 1, parryWin: .14, regenMul: 1, cdMul: 1, scale: 1, tipX: 0, tipY: 0, hbX: 0, hbY: 0 }, c);
    this.w = WEAPONS[this.weapon]; this.hp = c.hp != null ? c.hp : this.maxHp; this.ghost = this.hp; this.stam = this.maxStam;
    this.pose = Object.assign({}, POSE.idle); this.tp = Object.assign({}, POSE.idle);
    const a = ARM[this.armor];
    this.col = { f: { b: a.b, d: a.d, l: a.l }, k: { b: shade(a.b, .6), d: a.d, l: shade(a.l, .55) }, j: a.j, cloth: this.cloth, clothD: shade(this.cloth, .6), clothL: shade(this.cloth, 1.35) };
    this.emb = this.isPlayer ? 2 : ((this.seed * 7) | 0) % 4; this.spr = buildSprites(this);
    this.ai = this.aip ? { cd: rand(.5, 1.1), seen: 0, plan: null, blockHold: 0, retreat: 0, comboLeft: 0, rushCd: 2.5, feintAt: 0, forceLight: false, enraged: false } : null;
  }
  get alive() { return this.state !== 'dead'; }
  canAct() { return this.state === 'idle'; }
  set(st, dur = 0) { if (this.state === 'block' && st !== 'block') this.lastBlockEnd = G.time; this.state = st; this.t = 0; this.dur = dur; }
  spend(n) { this.stam = Math.max(0, this.stam - n); this.stamDelay = this.stam <= 0 ? 1.1 : .6; }
  gainRes(n) { this.resolve = Math.min(100, this.resolve + n * this.resMul); }
  startAttack(key) {
    const d = ATK[key]; if (key !== 'sp' && this.stam < d.st * .6) return false;
    if (key === 'sp' || key === 'sweep' || key === 'chain1') this.resolve = 0;
    this.spend(d.st);
    const sp = this.w.spd * this.atkSpd;
    this.atk = { key, wind: d.wind / sp * this.windSlow, act: d.act, rec: d.rec / sp, dmg: d.dmg * this.w.dmg * this.dmgMul * (d.heavy ? this.heavyMul : 1), lunge: d.lunge, stun: d.stun, kb: d.kb, heavy: !!d.heavy, unblockable: !!d.unblockable, w: d.w, s: d.s, next: d.next, kick: !!d.kick, auto: !!d.auto, reach: d.reach || this.w.reach + (d.reachAdd || 0) };
    this.set('attack'); this.atkPhase = 0; this.hitDone = false; this.cued = false; this.atkId = ++ATKID;
    if (d.heavy) { this.glint = 1; if (!this.isPlayer) SFX.grunt(); }
    if (key === 'sp') SFX.charge();
    return true;
  }
  startBlock() { this.parryOK = G.time - this.lastBlockEnd > .18; this.set('block'); this.blockT = 0; }
  dodge(dir) {
    if (this.stam < this.dodgeCost * .6) return false;
    this.spend(this.dodgeCost); this.set('dodge', .4); this.dv = dir * 540; SFX.dodge(); dust(this.x, 5); return true;
  }
  update(dt, o) {
    this.t += dt;
    if (this.flash > 0) this.flash -= dt; if (this.glint > 0) this.glint -= dt * 2.2; if (this.ripT > 0) this.ripT -= dt;
    if (this.ghost > this.hp) this.ghost = Math.max(this.hp, this.ghost - dt * 28);
    if (Math.abs(this.kbv) > 1) { this.x += this.kbv * dt; this.kbv *= Math.exp(-9 * dt); }
    const wantGlow = this.state === 'attack' && this.atk.unblockable && this.atkPhase < 2 ? 1 : 0; this.glow += (wantGlow - this.glow) * Math.min(1, dt * 10);
    let moving = 0;
    switch (this.state) {
      case 'idle': {
        if (o && o.alive) this.facing = o.x >= this.x ? 1 : -1;
        if (this.moveDir) { const sp = (this.moveDir > 0 ? 215 : 172) * this.moveSpd; this.x += this.moveDir * this.facing * sp * dt; moving = 1; const pw = this.walk; this.walk += this.moveDir * dt * 9.6; if (Math.floor(pw / Math.PI) !== Math.floor(this.walk / Math.PI)) { SFX.step(); if (Math.random() < .5) dust(this.x - this.facing * 20, 1); } }
        break;
      }
      case 'attack': {
        const a = this.atk;
        if (this.atkPhase === 0 && !this.cued && !this.isPlayer && !G.demo && !a.unblockable && !a.kick && o && a.wind - this.t <= o.parryWin - .03) { this.cued = true; ring(this.tipX, this.tipY, 34, '#ffd24a'); ring(this.hbX, this.hbY, 22, '#ffd24a'); SFX.cue(); }
        if (this.atkPhase === 0) { if (this.t > a.wind * .7) this.x += this.facing * a.lunge / (a.wind * .3 + a.act) * dt * this.lungeOK(o); if (this.t >= a.wind) { this.atkPhase = 1; this.t = 0; SFX.swing(a.heavy); } }
        else if (this.atkPhase === 1) { this.x += this.facing * a.lunge / (a.wind * .3 + a.act) * dt * this.lungeOK(o); if (!this.hitDone && o && Math.abs(o.x - this.x) <= a.reach * this.scale + 4) { this.hitDone = true; resolveHit(this, o, a); } if (this.t >= a.act) { this.atkPhase = 2; this.t = 0; } }
        else if (this.t >= a.rec) this.set('idle');
        break;
      }
      case 'block': this.blockT += dt; if (o && o.alive) this.facing = o.x >= this.x ? 1 : -1; break;
      case 'hit': case 'stagger': if (this.t >= this.dur) this.set('idle'); break;
      case 'dodge': this.x += this.dv * this.facing * dt; this.dv *= Math.exp(-7.5 * dt); if (this.t >= this.dur) this.set('idle'); break;
      case 'dead': this.fall += dt; break;
      default: break;
    }
    this.walkAmp += (moving - this.walkAmp) * Math.min(1, dt * 10);
    if (this.state !== 'dead') { if (this.stamDelay > 0) this.stamDelay -= dt; else if (this.state !== 'attack' && this.state !== 'dodge') this.stam = Math.min(this.maxStam, this.stam + 30 * this.regenMul * (this.state === 'block' ? .3 : 1) * dt); }
    this.x = clamp(this.x, -BOUND, BOUND);
    this.updatePose(dt);
  }
  lungeOK(o) { return o && Math.abs(o.x - this.x) < 90 ? 0 : 1; }
  get invuln() { return this.state === 'dodge' && this.t < .26; }
  updatePose(dt) {
    const T = this.tp; let rate = 16, src;
    switch (this.state) {
      case 'attack': {
        const a = this.atk, W = POSE[a.w], S = POSE[a.s], I = POSE.idle; rate = 70;
        if (this.atkPhase === 0) mixPose(I, W, easeOut(Math.min(1, this.t / a.wind * 1.25)), T);
        else if (this.atkPhase === 1) mixPose(W, S, Math.min(1, this.t / a.act * 1.15), T);
        else { const p = this.t / a.rec; if (p < .4) mixPose(S, S, 0, T); else mixPose(S, I, easeIO((p - .4) / .6), T); }
        src = T; break;
      }
      case 'block': src = POSE.block; rate = 30; break;
      case 'hit': src = POSE.hit; rate = 30; break;
      case 'stagger': src = POSE.stagger; rate = 14; break;
      case 'dodge': src = POSE.dodge; rate = 26; break;
      case 'dead': src = POSE.dead; rate = 8; break;
      case 'win': src = POSE.win; rate = 6; break;
      default: src = POSE.idle;
    }
    const k = Math.min(1, dt * rate), P = this.pose;
    for (const key of PK) P[key] += (src[key] - P[key]) * k;
  }
}
function mixPose(a, b, t, out) { for (const k of PK) out[k] = a[k] + (b[k] - a[k]) * t; return out; }

function resolveHit(att, def, a) {
  if (!def.alive) return;
  const mx = def.x + (att.x - def.x) * .3, my = FLOOR - 105;
  if (def.invuln) { addText(def.x, FLOOR - 200, 'DODGED', '#cfd6df', 20); def.gainRes(10); return; }
  let dmg = a.dmg;
  if (a.kick) {
    const armoredK = def.state === 'attack' && def.atkPhase < 2 && def.atk.heavy && def.w.armor;
    SFX.hit(false); G.hitstop = .06; shake(.3); ring(mx, FLOOR - 70, 34, '#ffe9d0'); dust(def.x, 3);
    if (def.state === 'block') { def.stam = Math.max(0, def.stam - 25); def.stamDelay = 1; def.set('stagger', .95); def.kbv = att.facing * 200; addText(def.x, FLOOR - 205, 'GUARD BROKEN', '#ff8a70', 24); SFX.guardbreak(); att.gainRes(10); return; }
    hurt(def, dmg * def.taken, att); if (def.alive && !armoredK) { def.set('hit', a.stun); def.kbv = att.facing * a.kb * 2.4; }
    return;
  }
  if (def.state === 'block') {
    if (a.unblockable) {
      dmg *= .6 * def.taken; hurt(def, dmg, att); if (def.alive) { def.set('stagger', .8); def.kbv = att.facing * 220; }
      addText(def.x, FLOOR - 205, 'GUARD CRUSHED', '#ff8a70', 24); sparks(mx, my, 22, att.facing); SFX.guardbreak(); G.hitstop = .13; shake(.9); return;
    }
    if (def.parryOK && def.blockT <= def.parryWin) {
      att.set('stagger', a.heavy ? 1.05 : .85); att.kbv = -att.facing * 120; def.ripT = 1.7; def.gainRes(26); def.parries++; def.stam = Math.min(def.maxStam, def.stam + 12);
      addText(def.x, FLOOR - 205, 'PARRY', '#fff2c0', 28); sparks(mx, my, 26, att.facing, true); ring(mx, my, 70, '#fff2c0'); SFX.parry(); G.hitstop = .12; shake(.5); if (!G.demo) G.flash = .5;
      if (def.isPlayer) G.stat.parries++;
      return;
    }
    const chip = dmg * def.w.chip * def.taken, drain = dmg / att.dmgMul * (a.heavy ? 1.7 : .95) * def.w.blockCost * def.blockMul * (att.w.crush || 1);
    def.stam -= drain; def.stamDelay = .7; sparks(mx, my, a.heavy ? 14 : 8, att.facing); SFX.clang(a.heavy ? .75 : 1, .22);
    if (chip > 0) hurt(def, chip, att, true);
    if (!def.alive) return;
    if (def.stam <= 0) { def.stam = 0; def.stamDelay = 1.2; def.set('stagger', .95); def.kbv = att.facing * 160; addText(def.x, FLOOR - 205, 'GUARD BROKEN', '#ff8a70', 24); SFX.guardbreak(); G.hitstop = .1; shake(.7); }
    else { def.kbv = att.facing * (a.heavy ? 210 : 90); G.hitstop = .045; shake(a.heavy ? .35 : .15); att.gainRes(3); def.gainRes(5); }
    return;
  }
  let rip = false;
  if (att.ripT > 0) { dmg *= 1.5 * att.ripMul; att.ripT = 0; rip = true; }
  if (def.state === 'stagger') dmg *= 1.15;
  dmg *= def.taken;
  const armored = def.state === 'attack' && def.atkPhase < 2 && def.atk.heavy && def.w.armor;
  hurt(def, dmg, att);
  att.gainRes(dmg * .7); def.gainRes(dmg * .35);
  blood(mx, my, a.heavy ? 16 : 9, att.facing); sparks(mx, my, a.heavy ? 8 : 4, att.facing); ring(mx, my, a.heavy ? 62 : 38, '#ffe9d0');
  SFX.hit(a.heavy); G.hitstop = a.heavy ? .13 : .07; shake(a.heavy ? .8 : .35);
  if (rip) addText(def.x, FLOOR - 205, 'RIPOSTE', '#ffd98a', 26);
  if (def.alive) { if (!armored) { def.set('hit', a.stun); def.kbv = att.facing * a.kb * 2.2; } else def.kbv = att.facing * 40; }
}
function hurt(def, dmg, att, chip) {
  def.hp -= dmg; def.flash = .07; def.hurtTotal += dmg;
  if (def.isPlayer && !G.demo) { G.hurt = Math.min(1, .45 + dmg / 40); G.stat.taken += dmg; }
  if (def.hp <= 0) {
    def.hp = 0; def.set('dead'); def.fall = 0; def.kbv = att.facing * 260; def.facing = -att.facing;
    G.slow = 1.1; G.hitstop = .2; shake(1.2); SFX.death(); blood(def.x, FLOOR - 110, 26, att.facing);
    if (att.alive) setTimeout(() => { if (att.alive && att.state !== 'win') att.set('win'); }, 900);
  }
}

/* ================= AI ================= */
function aiUpdate(f, o, dt) {
  const ai = f.ai, p = f.aip;
  if (!f.alive) return;
  if (!o.alive) { f.moveDir = 0; if (f.state === 'block') f.set('idle'); return; }
  const d = Math.abs(o.x - f.x), reach = f.w.reach * f.scale;
  if (o.state === 'attack' && o.atkPhase === 0 && ai.seen !== o.atkId) {
    ai.seen = o.atkId;
    if (d < o.w.reach * o.scale + o.atk.lunge + 26) {
      const r = Math.random(), ti = o.atk.wind - o.t;
      if (o.atk.kick) { if (r < p.dodge + .1) ai.plan = { type: 'dodge', at: Math.max(0, ti - .1) }; }
      else if (o.atk.unblockable) { if (r < Math.min(.85, p.dodge + .4)) ai.plan = { type: 'dodge', at: Math.max(0, ti - .15) }; }
      else if (r < p.parry) ai.plan = { type: 'block', at: Math.max(0, ti - .09), hold: .3 };
      else if (r < p.parry + p.block) ai.plan = { type: 'block', at: Math.min(ti * .6, rand(.1, .2)), hold: ti + .35 };
      else if (r < p.parry + p.block + p.dodge) ai.plan = { type: 'dodge', at: Math.max(0, ti - .17) };
    }
  }
  if (ai.plan) { ai.plan.at -= dt; if (ai.plan.at <= 0) { if (f.canAct()) { if (ai.plan.type === 'block') { f.startBlock(); ai.blockHold = ai.plan.hold; } else f.dodge(-1); } ai.plan = null; } }
  if (f.state === 'block') { ai.blockHold -= dt; f.moveDir = 0; if (ai.blockHold <= 0 && !(o.state === 'attack' && o.atkPhase < 2 && d < o.w.reach + 70)) f.set('idle'); return; }
  if (f.state !== 'attack') ai.feintAt = 0;
  if (p.enrage && !ai.enraged && f.hp < f.maxHp * .4) { ai.enraged = true; f.rage = 1; f.atkSpd *= 1.2; f.cdMul *= .65; addText(f.x, FLOOR - 225, 'ENRAGED', '#ff5a3c', 26); SFX.grunt(); shake(.5); }
  if (f.state === 'attack' && f.atkPhase === 0 && ai.feintAt && f.t >= ai.feintAt) { ai.feintAt = 0; f.set('idle'); ai.cd = 0; ai.forceLight = true; addText(f.x, FLOOR - 205, 'FEINT', '#cfd6df', 20); }
  if (f.state === 'attack' && f.atkPhase === 2 && f.atk.next && (f.atk.auto || ai.comboLeft > 0) && f.t > f.atk.rec * .4) { if (!f.atk.auto) ai.comboLeft--; f.startAttack(f.atk.next); return; }
  if (!f.canAct()) return;
  ai.cd -= dt; ai.rushCd -= dt;
  if (f.stam < 20 && ai.retreat <= 0) ai.retreat = rand(.7, 1.2);
  if (ai.retreat > 0) { ai.retreat -= dt; f.moveDir = d < reach + 80 && Math.abs(f.x) < BOUND - 30 ? -1 : 0; return; }
  const want = Math.max(90, p.keep ? reach - 6 : reach - 22);
  f.moveDir = d > want + 6 ? 1 : (p.keep && d < want - 46 && Math.abs(f.x) < BOUND - 40) ? -1 : 0;
  if (d <= reach + 12) {
    const open = o.state === 'stagger' || o.state === 'hit' || (o.state === 'attack' && o.atkPhase === 2);
    if (open && Math.random() < p.aggr * dt * 9) { ai.cd = rand(p.cd[0], p.cd[1]) * f.cdMul; ai.comboLeft = (Math.random() * p.combo) | 0; f.startAttack(o.state === 'stagger' && o.dur - o.t > .5 && Math.random() < .6 ? 'hv' : 'l1'); return; }
    if (ai.cd <= 0) {
      ai.cd = rand(p.cd[0], p.cd[1]) * f.cdMul;
      const turtle = o.state === 'block' ? .3 : 0;
      if (p.special && f.resolve >= 100) f.startAttack(p.spKey || 'sp');
      else if (ai.forceLight) { ai.forceLight = false; ai.comboLeft = 1; f.startAttack('l1'); }
      else if (o.state === 'block' && o.blockT > .55 && Math.random() < .4) f.startAttack('kick');
      else if (Math.random() < p.heavy + turtle) { if (f.startAttack('hv') && Math.random() < p.feint) ai.feintAt = f.atk.wind * .55; }
      else { ai.comboLeft = (Math.random() * p.combo) | 0; f.startAttack('l1'); }
    }
  } else if (p.rush && d > reach + 70 && d < reach + 320 && ai.rushCd <= 0 && ai.cd <= .3) { ai.rushCd = rand(5, 8); ai.cd = rand(p.cd[0], p.cd[1]) * f.cdMul; f.startAttack('rush'); }
  else if (ai.cd <= -1.6 && Math.random() < dt * 1.2 && p.dodge > .15) { f.dodge(1); ai.cd = .15; }
}

/* ================= Effects ================= */
const PARTS = []; const PMAX = 320; let pIdx = 0;
for (let i = 0; i < PMAX; i++) PARTS.push({ life: 0 });
function part(x, y, vx, vy, life, size, color, type, g = 900) { const p = PARTS[pIdx]; pIdx = (pIdx + 1) % PMAX; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.size = size; p.color = color; p.type = type; p.g = g; }
function sparks(x, y, n, dir, bright) { if (save.settings.low) n = Math.ceil(n / 2); for (let i = 0; i < n; i++) { const a = rand(-1.2, 1.2), s = rand(160, 620); part(x, y, Math.cos(a) * s * -dir * (Math.random() < .3 ? -1 : 1), Math.sin(a) * s - 120, rand(.15, .45), rand(1.5, 3), bright ? '#fff6c8' : '#ffc45a', 's', 1300); } }
function blood(x, y, n, dir) { if (save.settings.low) n = Math.ceil(n / 2); for (let i = 0; i < n; i++) part(x + rand(-6, 6), y + rand(-18, 18), dir * rand(40, 380) + rand(-60, 60), rand(-330, 40), rand(.35, .8), rand(1.6, 3.6), Math.random() < .5 ? '#7a0f0b' : '#a31a12', 'b', 1500); }
function ring(x, y, size, color) { part(x, y, 0, 0, .22, size, color, 'r', 0); }
function dust(x, n) { const c = ARENAS[G.arena].dust; for (let i = 0; i < n; i++) part(x + rand(-14, 14), FLOOR + rand(-2, 4), rand(-50, 50), rand(-50, -10), rand(.4, .9), rand(7, 15), `rgba(${c[0]},${c[1]},${c[2]},`, 'd', -30); }
const TEXTS = [];
function addText(x, y, s, color, size) { if (G.demo) return; TEXTS.push({ x, y, s, color, size, life: 1.1 }); if (TEXTS.length > 8) TEXTS.shift(); }
function shake(v) { if (!G.demo) G.shake = Math.max(G.shake, v); }
const AMB = [];
function initAmb() { AMB.length = 0; const w = ARENAS[G.arena].weather, low = save.settings.low; const n = w === 'rain' ? (low ? 50 : 120) : (low ? 12 : 30); for (let i = 0; i < n; i++) AMB.push({ u: Math.random(), v: Math.random(), s: rand(.5, 1), p: rand(6.28) }); }

/* ================= Rendering fighters ================= */
function joint(g, x, y, r, fill, dark) { g.fillStyle = fill; g.strokeStyle = dark; g.lineWidth = 1.6; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); }
function ik(ax, ay, tx, ty, l1, l2, bend) {
  let dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy); const mxd = l1 + l2 - .01; if (d > mxd) { dx *= mxd / d; dy *= mxd / d; d = mxd; } if (d < 1) d = 1;
  const a = Math.atan2(dy, dx), ca = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), ang = a + bend * Math.acos(ca);
  return [ax + Math.cos(ang) * l1, ay + Math.sin(ang) * l1, ax + dx, ay + dy];
}
function drawWeapon(g, w, x, y, ang, fl) {
  g.save(); g.translate(x, y); g.rotate(Math.PI / 2 - ang);
  const k = w.kind, L = w.len, st = fl ? '#fff' : '#c9d0d9', stD = fl ? '#e4e4e4' : '#78808c', dk = '#14161a', wood = fl ? '#fff' : '#5b4028', gold = fl ? '#fff' : '#b9953f';
  g.lineJoin = 'round'; g.lineCap = 'round';
  if (k === 'sword' || k === 'sword1' || k === 'gsword') {
    const gr = w.grip, bw = k === 'gsword' ? 5.6 : k === 'sword' ? 4.4 : 4, gx = 8;
    g.strokeStyle = dk; g.lineWidth = 6.6; g.beginPath(); g.moveTo(-gr, 0); g.lineTo(gx, 0); g.stroke(); g.strokeStyle = '#4a2f1c'; g.lineWidth = 4; g.stroke();
    g.fillStyle = gold; g.strokeStyle = dk; g.lineWidth = 1.4; g.beginPath(); g.arc(-gr - 2, 0, 4.2, 0, 7); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(gx, -bw); g.lineTo(L - 13, -bw * .72); g.lineTo(L, 0); g.lineTo(L - 13, bw * .72); g.lineTo(gx, bw); g.closePath(); g.fillStyle = stD; g.fill(); g.strokeStyle = dk; g.lineWidth = 1.5; g.stroke();
    g.beginPath(); g.moveTo(gx, -bw + .8); g.lineTo(L - 13, -bw * .72 + .8); g.lineTo(L - 1.5, 0); g.lineTo(gx, 0); g.closePath(); g.fillStyle = st; g.fill();
    g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = .9; g.beginPath(); g.moveTo(gx + 6, -bw * .5); g.lineTo(L * .72, -bw * .42); g.stroke();
    g.fillStyle = gold; g.strokeStyle = dk; g.lineWidth = 1.4; g.beginPath(); g.rect(gx - 2.4, k === 'gsword' ? -15 : -11.5, 4.8, k === 'gsword' ? 30 : 23); g.fill(); g.stroke();
  } else {
    g.strokeStyle = dk; g.lineWidth = 6.4; g.beginPath(); g.moveTo(-w.grip, 0); g.lineTo(L - 8, 0); g.stroke(); g.strokeStyle = wood; g.lineWidth = 3.8; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w.grip, -1); g.lineTo(L - 10, -1); g.stroke();
    g.fillStyle = stD; g.strokeStyle = dk; g.lineWidth = 1.5;
    if (k === 'axe') { g.beginPath(); g.moveTo(L - 22, 2); g.quadraticCurveTo(L - 26, 16, L - 30, 22); g.quadraticCurveTo(L - 10, 26, L + 6, 18); g.quadraticCurveTo(L - 2, 10, L - 4, 2); g.closePath(); g.fill(); g.stroke(); g.fillStyle = st; g.beginPath(); g.moveTo(L - 28, 20); g.quadraticCurveTo(L - 10, 25, L + 4, 18); g.quadraticCurveTo(L - 10, 19, L - 26, 15); g.fill(); }
    else if (k === 'mace') { g.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283, r = i % 2 ? 7 : 12.5; g.lineTo(L - 6 + Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke(); g.fillStyle = st; g.beginPath(); g.arc(L - 8, -2.5, 4.5, 0, 7); g.fill(); }
    else if (k === 'halberd') { g.beginPath(); g.moveTo(L - 10, -3); g.lineTo(L + 12, 0); g.lineTo(L - 10, 3); g.closePath(); g.fill(); g.stroke(); g.beginPath(); g.moveTo(L - 38, 2); g.quadraticCurveTo(L - 42, 18, L - 46, 27); g.quadraticCurveTo(L - 26, 31, L - 8, 24); g.quadraticCurveTo(L - 16, 12, L - 14, 2); g.closePath(); g.fill(); g.stroke(); g.fillStyle = st; g.beginPath(); g.moveTo(L - 44, 25); g.quadraticCurveTo(L - 26, 30, L - 10, 24); g.quadraticCurveTo(L - 26, 24, L - 42, 20); g.fill(); g.fillStyle = stD; g.beginPath(); g.moveTo(L - 34, -2); g.lineTo(L - 26, -15); g.lineTo(L - 20, -2); g.closePath(); g.fill(); g.stroke(); }
    else if (k === 'maul') { g.beginPath(); g.rect(L - 24, -17, 24, 34); g.fill(); g.stroke(); g.fillStyle = st; g.fillRect(L - 23, -16, 22, 6); g.fillStyle = dk; g.fillRect(L - 24, -5, 24, 2.5); g.fillRect(L - 24, 5, 24, 2.5); }
  }
  g.restore();
}
function drawHelm(g, f, c, fl, noPlume) {
  const h = f.helm, dk = c.d, skin = fl ? '#fff' : '#c79a78';
  g.lineJoin = 'round'; g.lineWidth = 1.8; g.strokeStyle = dk;
  if (f.plume && !noPlume) { g.fillStyle = fl ? '#fff' : f.col.cloth; g.beginPath(); g.moveTo(-2, -17); g.bezierCurveTo(-6, -40, -30, -42, -40, -22 + Math.sin(G.time * 3 + f.seed) * 3); g.bezierCurveTo(-28, -30, -14, -26, 4, -17); g.closePath(); g.fill(); g.stroke(); }
  if (h === 'great') {
    g.fillStyle = c.b; g.beginPath(); g.moveTo(-13, 14); g.lineTo(-14, -12); g.quadraticCurveTo(-13, -18, -6, -18); g.lineTo(8, -18); g.quadraticCurveTo(14, -18, 15, -11); g.lineTo(15, 14); g.quadraticCurveTo(1, 18, -13, 14); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c.l; g.globalAlpha = .45; g.fillRect(-11, -16, 6, 28); g.globalAlpha = 1;
    g.fillStyle = '#060607'; g.fillRect(1, -5, 14.5, 3.2);
    g.fillStyle = fl ? '#fff' : '#b9953f'; g.fillRect(6.5, -18, 3, 34); g.fillRect(-13, -6.6, 28, 1.6);
    g.fillStyle = '#060607'; for (let i = 0; i < 3; i++) { g.fillRect(11, 3 + i * 3.6, 1.6, 1.6); g.fillRect(3, 3 + i * 3.6, 1.6, 1.6); }
  } else if (h === 'bascinet') {
    g.fillStyle = shade('#50555e', fl ? 3 : 1); g.beginPath(); g.moveTo(-14, 6); g.lineTo(12, 8); g.lineTo(10, 20); g.lineTo(-13, 19); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c.b; g.beginPath(); g.moveTo(-14, 10); g.lineTo(-14, -4); g.quadraticCurveTo(-12, -21, 2, -20); g.quadraticCurveTo(9, -18, 10, -9); g.lineTo(23, 2); g.lineTo(9, 12); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c.l; g.globalAlpha = .45; g.beginPath(); g.ellipse(-6, -8, 4, 9, .2, 0, 7); g.fill(); g.globalAlpha = 1;
    g.strokeStyle = '#060607'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(8, -5); g.lineTo(18, -.5); g.stroke(); g.strokeStyle = dk; g.lineWidth = 1.2; g.beginPath(); g.moveTo(9, -9); g.lineTo(8, 12); g.stroke();
    g.fillStyle = '#060607'; for (let i = 0; i < 3; i++) g.fillRect(12 + i * 3, 4 - i * 1.2, 1.4, 1.4);
  } else if (h === 'kettle') {
    g.fillStyle = shade('#50555e', fl ? 3 : 1); g.beginPath(); g.moveTo(-13, -4); g.lineTo(-14, 18); g.lineTo(9, 19); g.lineTo(11, 6); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = skin; g.beginPath(); g.moveTo(2, -5); g.lineTo(12, -4); g.lineTo(14, 4); g.lineTo(11, 6); g.lineTo(10, 13); g.lineTo(2, 12); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1a1412'; g.fillRect(8, -1.5, 3.4, 2);
    g.fillStyle = c.b; g.beginPath(); g.moveTo(-13, -5); g.quadraticCurveTo(-10, -21, 2, -20); g.quadraticCurveTo(12, -19, 14, -5); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(1, -5, 22, 4.2, .05, 0, 7); g.fill(); g.stroke(); g.fillStyle = c.l; g.globalAlpha = .45; g.fillRect(-14, -7, 22, 1.6); g.globalAlpha = 1;
  } else if (h === 'hood') {
    g.fillStyle = fl ? '#fff' : f.col.clothD; g.beginPath(); g.moveTo(-10, 17); g.quadraticCurveTo(-22, 4, -24, -12); g.quadraticCurveTo(-8, -24, 6, -18); g.quadraticCurveTo(15, -12, 14, 0); g.lineTo(10, 16); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#120d0a'; g.beginPath(); g.moveTo(4, -12); g.quadraticCurveTo(14, -8, 13, 2); g.lineTo(9, 12); g.lineTo(2, 10); g.closePath(); g.fill();
    g.fillStyle = skin; g.beginPath(); g.moveTo(7, -1); g.lineTo(14, 3); g.lineTo(10, 12); g.lineTo(5, 10); g.closePath(); g.fill(); g.fillStyle = '#c9c2b4'; g.fillRect(8, -3.5, 3, 1.6);
  } else { // barbute
    g.fillStyle = c.b; g.beginPath(); g.moveTo(-13, 16); g.lineTo(-14, -6); g.quadraticCurveTo(-12, -21, 1, -20); g.quadraticCurveTo(14, -19, 15, -4); g.lineTo(14, 16); g.quadraticCurveTo(0, 19, -13, 16); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = c.l; g.globalAlpha = .4; g.beginPath(); g.ellipse(-6, -7, 4, 10, .15, 0, 7); g.fill(); g.globalAlpha = 1;
    g.fillStyle = '#070606'; g.fillRect(2, -5, 13.4, 4); g.fillRect(8.5, -5, 3.6, 21);
  }
}
/* ---------- baked part sprites: every armour piece is painted once with texture and shading ---------- */
const SR = 3;
function bake(x0, y0, x1, y1, paint, shades) {
  const c = document.createElement('canvas'); c.width = Math.ceil((x1 - x0) * SR); c.height = Math.ceil((y1 - y0) * SR);
  const g = c.getContext('2d'); g.setTransform(SR, 0, 0, SR, -x0 * SR, -y0 * SR); g.lineJoin = 'round'; g.lineCap = 'round';
  paint(g);
  g.globalCompositeOperation = 'source-atop'; for (const s of shades || []) s(g); g.globalCompositeOperation = 'source-over';
  const mkv = (op, col) => { const d = document.createElement('canvas'); d.width = c.width; d.height = c.height; const h = d.getContext('2d'); h.drawImage(c, 0, 0); h.globalCompositeOperation = op; h.fillStyle = col; h.fillRect(0, 0, d.width, d.height); return d; };
  return { n: c, k: mkv('source-atop', 'rgba(6,7,12,.46)'), f: mkv('source-in', '#ffffff'), x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
const BIG = g => g.fillRect(-300, -300, 600, 600);
const cyl = (hw, spec) => g => { const gr = g.createLinearGradient(-hw, 0, hw, 0); gr.addColorStop(0, 'rgba(0,0,0,.58)'); gr.addColorStop(.26, 'rgba(0,0,0,.14)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); gr.addColorStop(.66, `rgba(255,255,255,${spec})`); gr.addColorStop(.8, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,.5)'); g.fillStyle = gr; BIG(g); };
const vshade = (y0, y1, a0, a1) => g => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, `rgba(255,255,255,${a0})`); gr.addColorStop(.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a1})`); g.fillStyle = gr; BIG(g); };
const ball = (x, y, r, a0, a1) => g => { const gr = g.createRadialGradient(x, y, r * .08, x - r * .2, y + r * .3, r); gr.addColorStop(0, `rgba(255,255,255,${a0})`); gr.addColorStop(.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(0,0,0,${a1})`); g.fillStyle = gr; BIG(g); };
function texMail(g, x0, y0, x1, y1) { g.lineWidth = .5; let row = 0; for (let y = y0; y < y1; y += 1.9, row++) { g.strokeStyle = 'rgba(0,0,0,.5)'; g.beginPath(); for (let x = x0 + (row % 2) * 1.2; x < x1; x += 2.4) { g.moveTo(x + 1.1, y); g.arc(x, y, 1.1, 0, Math.PI); } g.stroke(); g.strokeStyle = 'rgba(255,255,255,.2)'; g.beginPath(); for (let x = x0 + (row % 2) * 1.2; x < x1; x += 2.4) { g.moveTo(x - .9, y - .5); g.lineTo(x + .1, y - .9); } g.stroke(); } }
function texScratch(g, x0, y0, x1, y1, r, n) { g.lineWidth = .4; for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), a = r() * 6.28, l = 1.5 + r() * 5; g.strokeStyle = r() < .5 ? 'rgba(255,255,255,.22)' : 'rgba(0,0,0,.22)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } }
function texFolds(g, x0, y0, x1, y1, r, n) { for (let i = 0; i < n; i++) { const x = x0 + r() * (x1 - x0); g.strokeStyle = r() < .55 ? 'rgba(0,0,0,.2)' : 'rgba(255,255,255,.12)'; g.lineWidth = .8 + r() * 1.4; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + (r() - .5) * 6, (y0 + y1) / 2, x + (r() - .5) * 5, y1); g.stroke(); } }
function texGrain(g, x0, y0, x1, y1, r, n) { for (let i = 0; i < n; i++) { g.fillStyle = r() < .5 ? 'rgba(0,0,0,.16)' : 'rgba(255,225,190,.1)'; g.fillRect(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), .5 + r() * 1.6, .4 + r() * .6); } }
function lame(g, y, hw) { g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = .9; g.beginPath(); g.moveTo(-hw - 2, y); g.quadraticCurveTo(0, y + 2.6, hw + 2, y); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.34)'; g.lineWidth = .6; g.beginPath(); g.moveTo(-hw - 2, y + 1.1); g.quadraticCurveTo(0, y + 3.7, hw + 2, y + 1.1); g.stroke(); }
function rivet(g, x, y) { g.fillStyle = 'rgba(0,0,0,.5)'; g.beginPath(); g.arc(x + .25, y + .3, .85, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(x, y, .6, 0, 7); g.fill(); }
function strap(g, y, hw, col) { g.fillStyle = col; g.fillRect(-hw - 2, y, hw * 2 + 4, 2.4); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(-hw - 2, y + 2.4, hw * 2 + 4, .7); g.fillStyle = '#b9953f'; g.fillRect(hw * .2, y - .3, 2.2, 3); }
function emblem(g, kind, x, y, s, col) {
  g.fillStyle = col; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = .7; g.beginPath();
  if (kind === 0) { g.moveTo(x, y - s); g.lineTo(x + s * .75, y); g.lineTo(x, y + s); g.lineTo(x - s * .75, y); g.closePath(); }
  else if (kind === 1) { g.moveTo(x - s, y + s * .5); g.lineTo(x, y - s * .7); g.lineTo(x + s, y + s * .5); g.lineTo(x + s, y + s); g.lineTo(x, y - s * .1); g.lineTo(x - s, y + s); g.closePath(); }
  else if (kind === 2) { g.rect(x - s * .22, y - s, s * .44, s * 2); g.rect(x - s * .8, y - s * .45, s * 1.6, s * .44); }
  else g.arc(x, y, s * .75, 0, 7);
  g.fill(); g.stroke();
}
function buildSprites(f) {
  const a = ARM[f.armor], r = rng32((f.seed * 1e6) | 0), cloth = f.col.cloth, clothD = f.col.clothD, T = TORSO, w = f.w;
  const plate = f.armor === 'plate' || f.armor === 'black', mail = f.armor === 'mail', spec = plate ? .46 : mail ? .18 : .1;
  const trim = (f.boss || f.isPlayer) ? '#c9a24a' : null, MAILC = '#5c626c', LEA = '#5e4029', LEAD = '#37241a', TROU = f.armor === 'leather' ? '#423a30' : '#4b4741';
  const fill = (g, c) => { g.fillStyle = c; BIG(g); };
  const limbS = (L, w0, w1, paint, post) => bake(-w0 / 2 - 5, -w0 / 2 - 4, w0 / 2 + 5, L + w1 / 2 + 8, g => {
    const p = new Path2D(), r0 = w0 / 2, r1 = w1 / 2; p.moveTo(-r0, 0); p.arc(0, 0, r0, Math.PI, 0); p.lineTo(r1, L); p.arc(0, L, r1, 0, Math.PI); p.closePath();
    g.save(); g.clip(p); paint(g, L, r0); g.restore(); g.strokeStyle = a.d; g.lineWidth = 1.5; g.stroke(p); if (post) post(g, L);
  }, [cyl(w0 / 2, spec)]);
  const S = {};
  S.ua = limbS(UA, 12.5, 11, (g, L, hw) => {
    if (plate) { fill(g, a.b); g.fillStyle = MAILC; g.fillRect(-9, -9, 18, 17); texMail(g, -8, -8, 8, 8); lame(g, 8, hw); lame(g, 14, hw); lame(g, L - 5, hw); texScratch(g, -6, 10, 6, L, r, 10); }
    else if (mail) { fill(g, MAILC); texMail(g, -8, -8, 8, L + 8); }
    else { fill(g, clothD); texFolds(g, -7, -8, 7, L + 6, r, 6); }
  });
  S.fa = limbS(FA, 11, 9.5, (g, L, hw) => {
    if (plate) { fill(g, a.b); lame(g, 5, hw); lame(g, L - 8, hw); texScratch(g, -5, 6, 5, L - 8, r, 9); if (trim) { g.fillStyle = trim; g.fillRect(-8, L - 6, 16, 1.6); } rivet(g, 2.5, 9); rivet(g, 2.5, L - 11); }
    else if (mail) { fill(g, MAILC); texMail(g, -8, -8, 8, L + 8); g.fillStyle = LEA; g.fillRect(-8, 9, 16, L - 13); texGrain(g, -6, 9, 6, L - 4, r, 30); strap(g, 12, hw, LEAD); strap(g, L - 9, hw, LEAD); }
    else { fill(g, LEA); texGrain(g, -6, -6, 6, L + 6, r, 40); strap(g, 6, hw, LEAD); strap(g, 15, hw, LEAD); strap(g, L - 7, hw, LEAD); }
  }, (g, L) => { g.fillStyle = plate ? a.j : '#2b211a'; g.strokeStyle = a.d; g.lineWidth = 1.4; g.beginPath(); g.arc(0, L + 1, 5.6, 0, 7); g.fill(); g.stroke(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = .7; for (let i = -1; i < 2; i++) { g.beginPath(); g.moveTo(-3.6, L + 1 + i * 2.2); g.lineTo(3.8, L + 1.6 + i * 2.2); g.stroke(); } });
  S.th = limbS(UL, 15.5, 12.5, (g, L, hw) => {
    if (plate) { fill(g, a.b); g.fillStyle = MAILC; g.fillRect(-10, -10, 20, 24); texMail(g, -9, -9, 9, 14); lame(g, 14, hw); lame(g, L - 9, hw); g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = .8; g.beginPath(); g.moveTo(2.4, 18); g.lineTo(1.8, L - 10); g.stroke(); texScratch(g, -7, 16, 7, L - 8, r, 14); rivet(g, -4.5, 18); rivet(g, -4, L - 12); }
    else { fill(g, TROU); texFolds(g, -8, -9, 8, L + 8, r, 8); if (mail) { g.fillStyle = MAILC; g.fillRect(-10, -10, 20, 26); texMail(g, -9, -9, 9, 16); } }
  });
  S.sn = limbS(LL, 12.5, 9.5, (g, L, hw) => {
    if (plate) { fill(g, a.b); lame(g, 4, hw); lame(g, L - 7, hw); g.strokeStyle = 'rgba(255,255,255,.32)'; g.lineWidth = .8; g.beginPath(); g.moveTo(2, 8); g.lineTo(1.4, L - 9); g.stroke(); texScratch(g, -5, 6, 5, L - 8, r, 12); if (trim) { g.fillStyle = trim; g.fillRect(-8, 1.4, 16, 1.4); } }
    else { fill(g, TROU); texFolds(g, -7, -8, 7, 16, r, 4); g.fillStyle = LEA; g.fillRect(-9, 12, 18, L); texGrain(g, -6, 12, 6, L + 5, r, 50); g.fillStyle = shade(LEA, 1.3); g.fillRect(-9, 12, 18, 3.4); strap(g, 24, hw, LEAD); strap(g, L - 10, hw, LEAD); }
  });
  S.ft = bake(-10, -8, 22, 10, g => { g.beginPath(); g.moveTo(-6, -5); g.lineTo(4, -5); g.quadraticCurveTo(13, -3.5, 18.5, 2.4); g.quadraticCurveTo(19.5, 6.4, 16, 6.4); g.lineTo(-6.5, 6.4); g.quadraticCurveTo(-8, 1, -6, -5); g.closePath(); g.fillStyle = plate ? a.b : LEAD; g.fill(); g.save(); g.clip(); if (plate) { for (const x of [2, 7, 12]) { g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = .8; g.beginPath(); g.moveTo(x, -6); g.quadraticCurveTo(x + 3, 0, x + 1, 7); g.stroke(); } } else texGrain(g, -6, -5, 18, 6, r, 30); g.fillStyle = '#17110c'; g.fillRect(-9, 4.6, 30, 3); g.restore(); g.strokeStyle = a.d; g.lineWidth = 1.5; g.stroke(); }, [vshade(-6, 7, plate ? .4 : .16, .45)]);
  const cop = (rad, wing) => bake(-12, -12, 12, 12, g => { g.strokeStyle = a.d; g.lineWidth = 1.4; if (wing && plate) { g.fillStyle = a.j; g.beginPath(); g.ellipse(-4.5, 0, 4.4, rad + 1.6, 0, 0, 7); g.fill(); g.stroke(); } g.fillStyle = plate || mail ? a.j : LEAD; g.beginPath(); g.arc(0, 0, rad, 0, 7); g.fill(); g.stroke(); if (plate) { g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = .7; g.beginPath(); g.arc(0, 0, rad * .55, 0, 7); g.stroke(); rivet(g, 0, 0); } }, [ball(2, -2.4, 9, plate ? .6 : .25, .5)]);
  S.kn = cop(plate ? 7 : 5.8, true); S.el = cop(plate ? 6 : 5, true);
  S.pa = bake(-15, -14, 15, 16, g => {
    g.strokeStyle = a.d; g.lineWidth = 1.4;
    if (plate) { for (const [y, rx, ry] of [[7, 9, 6], [3, 10.5, 6.6], [-1.5, 11.5, 7.6]]) { g.fillStyle = a.b; g.beginPath(); g.ellipse(0, y, rx, ry, 0, 0, 7); g.fill(); g.stroke(); } if (trim) { g.strokeStyle = trim; g.lineWidth = 1.3; g.beginPath(); g.ellipse(0, -1.5, 11.5, 7.6, 0, .25, 2.9); g.stroke(); } rivet(g, -6, 1); rivet(g, 6, 1); }
    else if (mail) { g.fillStyle = a.j; g.beginPath(); g.ellipse(0, 0, 9.5, 7, 0, 0, 7); g.fill(); g.stroke(); rivet(g, 0, 2); }
    else { g.fillStyle = LEA; g.beginPath(); g.ellipse(0, 0, 9.5, 7.4, 0, 0, 7); g.fill(); g.stroke(); g.save(); g.clip(); texGrain(g, -9, -7, 9, 7, r, 26); g.restore(); rivet(g, -4, 1); rivet(g, 0, 2.6); rivet(g, 4, 1); }
  }, [ball(3, -5, 15, plate ? .65 : .22, .5)]);
  S.to = bake(-24, -T - 10, 28, 10, g => {
    const pts = [[-14, 4], [-17, -T * .55], [-12, -T], [0, -T - 3], [13, -T], [20, -T * .6], [15, 4]];
    const p = new Path2D(); p.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]); p.closePath();
    g.save(); g.clip(p);
    if (plate) { fill(g, a.b); texScratch(g, -16, -T, 20, 4, r, 30); for (const y of [-3, -9, -15]) lame(g, y, 20); g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(12, -T + 2); g.quadraticCurveTo(21, -T * .62, 15.5, -17); g.stroke(); g.fillStyle = a.j; g.fillRect(-20, -T - 6, 44, 10); lame(g, -T + 4, 20); for (const y of [-22, -34]) { rivet(g, -12, y); } if (trim) { g.fillStyle = trim; g.fillRect(-20, -17.6, 44, 1.5); } }
    else if (mail) { fill(g, MAILC); texMail(g, -20, -T - 6, 24, 6); }
    else { fill(g, LEA); texGrain(g, -18, -T - 4, 22, 5, r, 150); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = .7; g.setLineDash([1.6, 1.6]); g.beginPath(); g.moveTo(9, -T); g.lineTo(11, 4); g.stroke(); g.setLineDash([]); g.fillStyle = LEAD; g.beginPath(); g.moveTo(-14, -T - 2); g.lineTo(-8, -T - 4); g.lineTo(19, -4); g.lineTo(15, 2); g.closePath(); g.fill(); for (let i = 0; i < 5; i++) rivet(g, -8 + i * 5.6, -T + 6 + i * 9.6); if (f.type === 'reaver') { g.fillStyle = '#8c7b62'; for (let x = -15; x < 18; x += 5) { g.beginPath(); g.arc(x, -T + 2 + (x & 1), 4.6, 0, 7); g.fill(); } g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = -15; x < 18; x += 2.5) g.fillRect(x, -T - 2, .6, 8); } }
    if (f.tabard) {
      const q = [[-9, 4], [-10, -T * .9], [11, -T * .94], [18.5, -T * .6], [13.5, 4]]; g.beginPath(); g.moveTo(q[0][0], q[0][1]); for (let i = 1; i < q.length; i++) g.lineTo(q[i][0], q[i][1]); g.closePath(); g.fillStyle = cloth; g.fill();
      g.save(); g.clip(); texFolds(g, -9, -T, 18, 5, r, 9); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(-10, -T, 6, T + 6); if (trim) { g.fillStyle = trim; g.fillRect(-12, -T * .94 - 1, 34, 2.2); } g.restore();
      emblem(g, f.emb, 6, -T * .5, 7, '#d9b65a');
    }
    g.restore(); g.strokeStyle = a.d; g.lineWidth = 1.8; g.stroke(p);
  }, [cyl(21, spec * .75), vshade(-T - 4, 6, .14, .3)]);
  S.he = bake(-46, -48, 30, 26, g => drawHelm(g, f, f.col.f, false, true), [ball(5, -11, 30, plate ? .5 : .22, .5)]);
  S.wp = bake(-w.grip - 10, -38, w.len + 18, 38, g => drawWeapon(g, w, 0, 0, Math.PI / 2, false), [vshade(-9, 9, .3, .34), g => { g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); const x = w.len * .5; g.moveTo(x, -40); g.lineTo(x + 5, -40); g.lineTo(x - 9, 40); g.lineTo(x - 14, 40); g.fill(); }]);
  if (w.shield) S.shd = bake(-20, -38, 20, 42, g => {
    const p = new Path2D(); p.moveTo(-9, -32); p.lineTo(10, -32); p.quadraticCurveTo(15, -4, 2, 36); p.quadraticCurveTo(-14, -2, -9, -32); p.closePath();
    g.save(); g.clip(p); fill(g, cloth); g.fillStyle = f.col.clothL; g.fillRect(1, -40, 30, 90); texGrain(g, -14, -34, 16, 38, r, 70); emblem(g, f.emb, 1, -8, 8, '#d9b65a'); g.restore();
    g.strokeStyle = '#9aa2ad'; g.lineWidth = 3; g.stroke(p); g.strokeStyle = a.d; g.lineWidth = 1.1; g.stroke(p); for (const [x, y] of [[-7, -29], [8, -29], [10, -8], [-9, -8], [3, 26]]) rivet(g, x, y);
  }, [ball(4, -16, 44, .4, .5)]);
  return S;
}
function sprLimb(g, sp, x1, y1, x2, y2, v) { g.save(); g.translate(x1, y1); g.rotate(Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2); g.drawImage(sp[v], sp.x, sp.y, sp.w, sp.h); g.restore(); }
function sprAt(g, sp, x, y, rot, v) { g.save(); g.translate(x, y); if (rot) g.rotate(rot); g.drawImage(sp[v], sp.x, sp.y, sp.w, sp.h); g.restore(); }
function drawFighter(g, f) {
  const P = f.pose, t = G.time, fl = f.flash > 0, sc = f.scale, w = f.w, S = f.spr, v = fl ? 'f' : 'n', vb = fl ? 'f' : 'k', dk = f.col.f.d;
  const wa = f.walkAmp, ph = f.walk;
  const idle = f.state === 'idle' || f.state === 'block' ? 1 : 0;
  const hx = P.hx, hy = -(HIP - P.hy) + Math.sin(t * 2.2 + f.seed) * .9 * idle - Math.abs(Math.cos(ph)) * 2.6 * wa;
  const ffx = P.ff + Math.sin(ph) * 18 * wa, ffy = -Math.max(0, Math.cos(ph)) * 10 * wa - P.fy, bfx = P.bf - Math.sin(ph) * 18 * wa, bfy = -Math.max(0, -Math.cos(ph)) * 10 * wa;
  const sl = Math.sin(P.lean), cl = Math.cos(P.lean);
  const nx = hx + sl * TORSO, ny = hy - cl * TORSO, sx = nx - sl * 9, sy = ny + cl * 9;
  const sh = P.sh, el = P.el, wp = P.wp + Math.sin(t * 1.7 + f.seed) * .03 * idle;
  const ex = sx + Math.sin(sh) * UA, ey = sy + Math.cos(sh) * UA, hdx = ex + Math.sin(sh + el) * FA, hdy = ey + Math.cos(sh + el) * FA;
  const wdx = Math.sin(wp), wdy = Math.cos(wp), tx = hdx + wdx * w.len, ty = hdy + wdy * w.len;
  let bex, bey, bhx, bhy;
  if (w.two) { const q = ik(sx - 4, sy + 1, hdx - wdx * w.grip * .72, hdy - wdy * w.grip * .72, UA, FA, 1); bex = q[0]; bey = q[1]; bhx = q[2]; bhy = q[3]; }
  else { bex = sx - 4 + Math.sin(P.bsh) * UA; bey = sy + Math.cos(P.bsh) * UA; bhx = bex + Math.sin(P.bsh + P.bel) * FA; bhy = bey + Math.cos(P.bsh + P.bel) * FA; }
  const fk = ik(hx + 3, hy, ffx, ffy - 4, UL, LL, -1), bk = ik(hx - 3, hy, bfx, bfy - 4, UL, LL, -1);
  g.save(); g.translate(f.x, FLOOR); g.scale(f.facing * sc, sc);
  if (f.state === 'dead') { const k = easeOut(Math.min(1, f.fall / .75)); g.translate(0, -k * 13); g.rotate(-k * 1.5); }
  f.tipX = f.x + f.facing * sc * tx; f.tipY = FLOOR + sc * ty; f.hbX = f.x + f.facing * sc * (hdx + wdx * w.len * .35); f.hbY = FLOOR + sc * (hdy + wdy * w.len * .35);
  // far-side limbs
  sprLimb(g, S.ua, sx - 4, sy + 1, bex, bey, vb); sprLimb(g, S.fa, bex, bey, bhx, bhy, vb);
  sprLimb(g, S.th, hx - 3, hy, bk[0], bk[1], vb); sprLimb(g, S.sn, bk[0], bk[1], bk[2], bk[3], vb); sprAt(g, S.kn, bk[0], bk[1], 0, vb); sprAt(g, S.ft, bk[2], bk[3], 0, vb);
  sprAt(g, S.to, hx, hy, P.lean, v);
  sprLimb(g, S.th, hx + 3, hy, fk[0], fk[1], v); sprLimb(g, S.sn, fk[0], fk[1], fk[2], fk[3], v); sprAt(g, S.kn, fk[0], fk[1], 0, v); sprAt(g, S.ft, fk[2], fk[3], 0, v);
  // skirt + belt
  const tp = (s, o) => [hx + sl * s + cl * o, hy - cl * s + sl * o];
  const sw = clamp(-f.kbv * f.facing * .02, -8, 8) - wa * 4 * Math.sin(ph), k1 = tp(2, -15), k2 = tp(2, 16);
  g.beginPath(); g.moveTo(k1[0], k1[1]); g.lineTo(k2[0], k2[1]); g.lineTo(k2[0] + 4 + sw, k2[1] + 30); g.lineTo(k1[0] - 3 + sw, k1[1] + 30); g.closePath();
  g.fillStyle = fl ? '#fff' : (f.tabard ? f.col.cloth : f.col.clothD); g.fill(); g.strokeStyle = dk; g.lineWidth = 1.8; g.lineJoin = 'round'; g.stroke();
  if (!fl) {
    g.save(); g.clip();
    const gr = g.createLinearGradient(k1[0], 0, k2[0] + 4, 0); gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(.45, 'rgba(0,0,0,.05)'); gr.addColorStop(.7, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = gr; g.fillRect(k1[0] - 16, k1[1] - 6, 60, 50);
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1.2; for (const o of [.3, .58, .8]) { const x0 = k1[0] + (k2[0] - k1[0]) * o, y0 = k1[1] + (k2[1] - k1[1]) * o; g.beginPath(); g.moveTo(x0, y0 + 3); g.quadraticCurveTo(x0 + sw * .4, y0 + 16, x0 + sw + (o - .5) * 5, y0 + 31); g.stroke(); }
    if (f.boss || f.isPlayer) { g.strokeStyle = '#c9a24a'; g.lineWidth = 2; g.beginPath(); g.moveTo(k1[0] - 3 + sw, k1[1] + 28.4); g.lineTo(k2[0] + 4 + sw, k2[1] + 28.4); g.stroke(); }
    g.restore();
  }
  g.strokeStyle = fl ? '#fff' : '#2b1c10'; g.lineWidth = 5; g.lineCap = 'butt'; g.beginPath(); g.moveTo(k1[0], k1[1]); g.lineTo(k2[0], k2[1]); g.stroke(); g.fillStyle = '#c9a24a'; g.fillRect((k1[0] + k2[0]) / 2 + 2, (k1[1] + k2[1]) / 2 - 3, 5, 6);
  // head
  g.save(); g.translate(nx + sl * 15, ny - cl * 15); g.rotate(P.lean + P.head); if (f.plume) drawPlume(g, f, fl); g.drawImage(S.he[v], S.he.x, S.he.y, S.he.w, S.he.h); g.restore();
  if (w.shield) sprAt(g, S.shd, bhx + 4, bhy - 4, P.lean * .5 + (f.state === 'block' ? 0 : .12), v);
  sprAt(g, S.wp, hdx, hdy, Math.PI / 2 - wp, v);
  sprLimb(g, S.ua, sx, sy, ex, ey, v); sprLimb(g, S.fa, ex, ey, hdx, hdy, v); sprAt(g, S.el, ex, ey, 0, v);
  if (w.two) joint(g, bhx, bhy, 5, fl ? '#fff' : '#241c17', dk);
  sprAt(g, S.pa, sx, sy - 1, P.lean, v);
  g.restore();
}
function drawPlume(g, f, fl) { g.lineJoin = 'round'; g.lineWidth = 1.6; g.strokeStyle = f.col.f.d; g.fillStyle = fl ? '#fff' : f.col.cloth; const s = Math.sin(G.time * 3 + f.seed) * 3; g.beginPath(); g.moveTo(-2, -17); g.bezierCurveTo(-6, -40, -30, -42, -40, -22 + s); g.bezierCurveTo(-28, -30, -14, -26, 4, -17); g.closePath(); g.fill(); g.stroke(); if (!fl) { g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; for (const k of [.3, .55, .8]) { g.beginPath(); g.moveTo(-2 - k * 4, -18 - k * 6); g.quadraticCurveTo(-18 * k - 6, -36 + k * 4, -38 * k - 2, -26 + s * k); g.stroke(); } } }

/* ================= Game state ================= */
const G = { mode: 'title', demo: true, paused: false, time: 0, hitstop: 0, slow: 0, shake: 0, cam: 0, arena: 0, phase: 'intro', phaseT: 0, hurt: 0, flash: 0, bolt: 0, boltT: 6, run: null, p: null, e: null, stat: { parries: 0, taken: 0 }, hintT: 0, hintI: 0 };
const inp = { left: false, right: false, block: false, buf: null, bufT: 0, blockT: -9 };
const isTouch = () => document.body.classList.contains('touch');
function press(a) { inp.buf = a; inp.bufT = G.time; }

function spawn(pc, ec) {
  G.p = new Fighter(pc); G.e = new Fighter(ec); G.p.x = -170; G.e.x = 170; G.p.facing = 1; G.e.facing = -1;
  G.cam = 0; G.hitstop = 0; G.slow = 0; G.shake = 0; TEXTS.length = 0; for (const p of PARTS) p.life = 0;
  inp.buf = null; initAmb(); G.boltT = rand(4, 9);
}
function newDemo() {
  G.demo = true; G.arena = (Math.random() * 4) | 0; const a = makeFoe(pick([4, 6, 7, 9])), b = makeFoe(pick([4, 6, 8, 9]));
  a.cloth = '#27406b'; a.maxHp = b.maxHp = 90; a.dmgMul = b.dmgMul = 1; a.windSlow = b.windSlow = 1.1;
  spawn(a, b); G.phase = 'fight'; G.phaseT = 0;
}
function startRun(weapon) {
  save.runs++; persist();
  G.run = { duel: 1, gold: 0, renown: 0, weapon, ups: {}, hp: 100, kills: 0, parries: 0, endless: false, reroll: 10, foe: makeFoe(1), startBest: save.bestDuel };
  startDuel();
}
function startDuel() {
  const run = G.run; G.demo = false; G.mode = 'duel'; G.paused = false; G.arena = (run.duel - 1) % 4;
  const pc = makePlayerCfg(run); run.hp = Math.min(run.hp, pc.maxHp); pc.hp = run.hp;
  spawn(pc, run.foe); G.phase = 'intro'; G.phaseT = 0; G.stat = { parries: 0, taken: 0 }; G.hintT = 0; G.hintI = 0;
  showScreen(null); $('hud').classList.remove('hidden'); $('pauseBtn').classList.remove('hidden'); if (isTouch()) $('touch').classList.remove('hidden');
  $('pName').textContent = 'You — ' + WEAPONS[run.weapon].name; $('eName').textContent = run.foe.name;
  $('duelNo').textContent = 'DUEL ' + roman(run.duel); $('goldVal').textContent = run.gold; $('eRsBar').style.visibility = run.foe.boss ? 'visible' : 'hidden';
  const f = run.foe; banner(f.boss ? 'Champion Duel ' + roman(run.duel) : 'Duel ' + roman(run.duel), f.name, f.title + ' · ' + ARENAS[G.arena].name + (f.trait ? ' · ' + f.trait.n + ' — ' + f.trait.d : '') + (f.move ? ' · Beware the ' + f.move : ''), f.move ? 3 : 2.1);
  MUS.mode = 'battle';
}
let banTimer = 0;
function banner(top, main, sub, dur) { $('bTop').textContent = top; $('bMain').textContent = main; $('bSub').textContent = sub || ''; const b = $('banner'); b.classList.add('hidden'); void b.offsetWidth; b.classList.remove('hidden'); clearTimeout(banTimer); banTimer = setTimeout(() => b.classList.add('hidden'), dur * 1000); }
const HINTS = [
  ['<b>A / D</b> to move · <b>J</b> to strike · tap again to chain cuts', '<b>◀ ▶</b> to move · <b>STRIKE</b> to cut · tap again to chain'],
  ['Hold <b>L</b> to block. Press it when the enemy blade <b>flashes gold</b> to parry', 'Hold <b>BLOCK</b>. Press it when the enemy blade <b>flashes gold</b> to parry'],
  ['<b>K</b> is a heavy blow — slow, but it crushes a guard', '<b>HEAVY</b> is slow, but it crushes a guard'],
  ['Watch the green bar. An exhausted fighter cannot defend', 'Watch the green bar. An exhausted fighter cannot defend'],
  ['<b>Space</b> dodges. A <b>red glow</b> cannot be blocked — dodge it', '<b>DODGE</b> slips away. A <b>red glow</b> cannot be blocked'],
  ['A foe hiding behind his guard? <b>I</b> kicks it open. Tap <b>L</b> during a heavy windup to <b>feint</b>', 'A foe hiding behind his guard? <b>KICK</b> it open. Tap <b>BLOCK</b> during a heavy windup to feint'],
  ['When the gold bar fills, press <b>Q</b> for an Oath Strike', 'When the gold bar fills, tap <b>OATH</b>'],
];
function updateHints(dt) {
  const h = $('hint'), run = G.run;
  if (G.mode !== 'duel' || G.phase !== 'fight' || run.duel > 2 || save.wins > 3) { h.classList.add('hidden'); return; }
  G.hintT -= dt;
  if (G.hintT <= 0) { G.hintT = 6.5; const i = G.hintI++ % HINTS.length; h.innerHTML = HINTS[i][isTouch() ? 1 : 0]; h.classList.remove('hidden'); }
}
function duelWon() {
  const run = G.run, p = G.p, n = run.duel, flawless = G.stat.taken < 1;
  const gold = Math.round((28 + 6 * n + (run.foe.boss ? 40 : 0) + (flawless ? 25 : 0) + G.stat.parries * 3) * (1 + .3 * upLv(run, 'purse')));
  run.gold += gold; run.renown += 100 * n + (flawless ? 150 : 0) + G.stat.parries * 20 + Math.round(p.hp); run.kills++; run.parries += G.stat.parries;
  const heal = p.maxHp * (.25 + .12 * upLv(run, 'fervor')); run.hp = Math.min(p.maxHp, p.hp + heal);
  save.wins++; if (n > save.bestDuel) save.bestDuel = n; if (run.renown > save.bestRenown) save.bestRenown = run.renown;
  run.lastGold = gold; run.flawless = flawless;
  if (n === 15 && !run.endless) { save.crowns++; persist(); showWin(); return; }
  persist(); run.duel++; run.foe = makeFoe(run.duel); run.reroll = 10; openShop(true);
}
function unlockText(run) { const u = []; for (const k of ['mace', 'poleaxe', 'greatsword']) { const w = WEAPONS[k]; if (run.startBest < w.unlock && save.bestDuel >= w.unlock) u.push(w.name); } return u.length ? 'New arms unlocked: ' + u.join(', ') : ''; }
function statsHtml(run) { return `<div><span>Duels won</span><b>${run.kills}</b></div><div><span>Renown</span><b>${run.renown}</b></div><div><span>Parries</span><b>${run.parries}</b></div><div><span>Best renown</span><b>${save.bestRenown}</b></div>`; }
function defeat() {
  const run = G.run; if (run.renown > save.bestRenown) save.bestRenown = run.renown; persist();
  G.mode = 'over'; hideHud(); MUS.mode = 'menu'; SFX.dirge();
  $('overSub').textContent = `Struck down in duel ${roman(run.duel)} by ${run.foe.name}.`;
  $('overStats').innerHTML = statsHtml(run); $('overUnlock').textContent = unlockText(run); showScreen('sOver');
}
function showWin() { const run = G.run; G.mode = 'win'; hideHud(); MUS.mode = 'menu'; SFX.fanfare(); $('winStats').innerHTML = statsHtml(run); $('winUnlock').textContent = unlockText(run); showScreen('sWin'); }
function hideHud() { for (const id of ['hud', 'pauseBtn', 'touch', 'hint', 'banner']) $(id).classList.add('hidden'); }

/* ---------- shop ---------- */
let offers = [];
const upCost = (run, u) => Math.round(u.cost * (1 + .35 * upLv(run, u.id)) / 5) * 5;
function rollOffers() { const run = G.run, pool = UPS.filter(u => upLv(run, u.id) < u.max && !(u.id === 'surgeon' && run.hp >= makePlayerCfg(run).maxHp - 1)); offers = []; while (offers.length < 3 && pool.length) offers.push({ u: pool.splice((Math.random() * pool.length) | 0, 1)[0], sold: false }); }
function openShop(fresh) {
  const run = G.run; G.mode = 'shop'; hideHud(); MUS.mode = 'menu'; if (fresh) rollOffers();
  $('shopSub').textContent = `Duel ${roman(run.duel - 1)} won — ${run.lastGold} crowns${run.flawless ? ', flawless' : ''}. Your wounds are bound.`;
  renderShop(); showScreen('sShop');
}
function renderShop() {
  const run = G.run, mh = makePlayerCfg(run).maxHp; run.hp = Math.min(run.hp, mh);
  $('shopGold').textContent = run.gold; $('shopHp').textContent = `Health ${Math.round(run.hp)} / ${mh}`;
  const box = $('shopCards'); box.innerHTML = '';
  offers.forEach(o => {
    const cost = upCost(run, o.u), lv = upLv(run, o.u.id), poor = run.gold < cost;
    const b = document.createElement('button'); b.className = 'card' + (o.sold ? ' sold' : poor ? ' poor' : ''); b.style.setProperty('--c1', o.u.c[0]); b.style.setProperty('--c2', o.u.c[1]);
    b.innerHTML = `<div class="badge">${o.u.g}</div><div class="cn">${o.u.name}</div><div class="cd">${o.u.desc}</div><div class="cl">${o.u.once ? 'Single use' : 'Rank ' + roman(lv + 1) + ' of ' + roman(o.u.max)}</div><div class="cc">${o.sold ? 'Bought' : '<span class="coin"></span>' + cost}</div>`;
    b.onclick = () => { if (o.sold) return; if (run.gold < cost) { SFX.deny(); return; } run.gold -= cost; o.sold = true; if (o.u.id === 'surgeon') run.hp = Math.min(mh, run.hp + mh * .45); else { run.ups[o.u.id] = lv + 1; if (o.u.id === 'heart') run.hp += 40; } SFX.coin(); renderShop(); };
    box.appendChild(b);
  });
  const rb = $('bReroll'); rb.textContent = `Reroll (${run.reroll})`; rb.disabled = run.gold < run.reroll;
  const f = run.foe; $('shopNext').textContent = `Next: ${f.name} — ${f.title}${f.trait ? ', ' + f.trait.n : ''}${f.boss ? ' (Champion)' : ''}`;
}

/* ---------- screens ---------- */
const SCREENS = ['sTitle', 'sArms', 'sHow', 'sSet', 'sPause', 'sShop', 'sOver', 'sWin'];
let curScreen = 'sTitle', backTo = 'sTitle';
function showScreen(id) { SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id)); curScreen = id; }
function toTitle() { G.mode = 'title'; G.paused = false; hideHud(); MUS.mode = 'menu'; newDemo(); refreshRecord(); showScreen('sTitle'); }
function refreshRecord() { $('record').textContent = save.bestDuel ? `Best: duel ${roman(save.bestDuel)} won · ${save.bestRenown} renown${save.crowns ? ' · ' + save.crowns + ' trial' + (save.crowns > 1 ? 's' : '') + ' won' : ''}` : 'No trial yet survived.'; }
function showArms() {
  const box = $('armsList'); box.innerHTML = '';
  for (const k of ['longsword', 'mace', 'poleaxe', 'greatsword']) {
    const w = WEAPONS[k], locked = save.bestDuel < w.unlock;
    const b = document.createElement('button'); b.className = 'card' + (locked ? ' locked' : '');
    b.innerHTML = `<div class="badge">${w.name[0]}</div><div class="cn">${w.name}</div><div class="cd">${w.desc}</div><div class="statrow">${w.stats.map(s => `<b>${s}</b>`).join('·')}</div><div class="cl">${locked ? 'Locked — ' + w.how : 'Ready'}</div>`;
    b.onclick = () => { if (locked) { SFX.deny(); return; } SFX.click(); startRun(k); };
    box.appendChild(b);
  }
  showScreen('sArms');
}
function setPaused(v) { if (G.mode !== 'duel') return; G.paused = v; if (v) { showScreen('sPause'); inp.left = inp.right = inp.block = false; } else showScreen(null); }
function bind(id, fn) { $(id).addEventListener('click', () => { audioInit(); SFX.click(); fn(); }); }
bind('bStart', showArms); bind('bArmsBack', () => showScreen('sTitle'));
bind('bHow', () => { backTo = 'sTitle'; showScreen('sHow'); }); bind('bHowBack', () => showScreen(backTo));
bind('bSet', () => { backTo = 'sTitle'; showScreen('sSet'); }); bind('bSetBack', () => showScreen(backTo));
bind('bResume', () => setPaused(false)); bind('bPHow', () => { backTo = 'sPause'; showScreen('sHow'); }); bind('bPSet', () => { backTo = 'sPause'; showScreen('sSet'); });
bind('bQuit', toTitle); bind('bOverTitle', toTitle); bind('bWinTitle', toTitle);
bind('bAgain', () => startRun(G.run.weapon));
bind('bEndless', () => { const run = G.run; run.endless = true; run.duel++; run.foe = makeFoe(run.duel); run.reroll = 10; openShop(true); });
bind('bNext', startDuel);
bind('bReroll', () => { const run = G.run; if (run.gold < run.reroll) return; run.gold -= run.reroll; run.reroll += 10; rollOffers(); renderShop(); });
$('pauseBtn').addEventListener('click', () => { audioInit(); setPaused(true); });
// settings
const S = save.settings;
function syncSettings() { $('vMaster').value = S.master * 100; $('vMusic').value = S.music * 100; $('vSfx').value = S.sfx * 100; $('cMute').checked = S.mute; $('cShake').checked = S.shake; $('cLow').checked = S.low; }
syncSettings();
for (const [id, key] of [['vMaster', 'master'], ['vMusic', 'music'], ['vSfx', 'sfx']]) $(id).addEventListener('input', e => { S[key] = e.target.value / 100; applyVolumes(); persist(); });
$('vSfx').addEventListener('change', () => SFX.coin());
$('cMute').addEventListener('change', e => { S.mute = e.target.checked; applyVolumes(); persist(); });
$('cShake').addEventListener('change', e => { S.shake = e.target.checked; persist(); });
$('cLow').addEventListener('change', e => { S.low = e.target.checked; persist(); resize(); initAmb(); });

/* ---------- input ---------- */
const KEY = { KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyL: 'block', KeyS: 'block', ArrowDown: 'block', KeyJ: 'light', KeyK: 'heavy', Space: 'dodge', KeyQ: 'special', KeyI: 'kick', KeyF: 'kick' };
addEventListener('keydown', e => {
  audioInit();
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.mode === 'duel') { if (!G.paused) setPaused(true); else if (curScreen === 'sPause') setPaused(false); else showScreen('sPause'); } else if (curScreen === 'sHow' || curScreen === 'sSet' || curScreen === 'sArms') showScreen(backTo === 'sPause' ? 'sTitle' : backTo); e.preventDefault(); return; }
  if (e.code === 'KeyM') { S.mute = !S.mute; applyVolumes(); syncSettings(); persist(); return; }
  if (e.code === 'KeyR' && G.mode === 'over') { startRun(G.run.weapon); return; }
  if (e.code === 'Enter' && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) { const m = { sTitle: 'bStart', sShop: 'bNext', sOver: 'bAgain', sHow: 'bHowBack', sSet: 'bSetBack', sPause: 'bResume', sWin: 'bEndless' }[curScreen]; if (m) $(m).click(); return; }
  const a = KEY[e.code]; if (!a) return;
  if (G.mode === 'duel') e.preventDefault();
  if (e.repeat) return;
  if (a === 'left' || a === 'right' || a === 'block') { inp[a] = true; if (a === 'block') inp.blockT = G.time; } else press(a);
});
addEventListener('keyup', e => { const a = KEY[e.code]; if (a === 'left' || a === 'right' || a === 'block') inp[a] = false; });
cv.addEventListener('pointerdown', e => { audioInit(); if (e.pointerType === 'touch' || G.mode !== 'duel' || G.paused) return; if (e.button === 0) press('light'); else if (e.button === 2) press('heavy'); });
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('pointerdown', audioInit, { passive: true });
addEventListener('touchstart', () => { if (!isTouch()) { document.body.classList.add('touch'); if (G.mode === 'duel') $('touch').classList.remove('hidden'); } }, { passive: true });
if (matchMedia && matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
document.querySelectorAll('.tb').forEach(b => {
  const a = b.dataset.act, hold = a === 'left' || a === 'right' || a === 'block';
  const dn = e => { e.preventDefault(); audioInit(); b.classList.add('on'); try { b.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } if (hold) { inp[a] = true; if (a === 'block') inp.blockT = G.time; } else press(a); };
  const up = e => { e.preventDefault(); b.classList.remove('on'); if (hold) inp[a] = false; };
  b.addEventListener('pointerdown', dn); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
});
addEventListener('blur', () => { inp.left = inp.right = inp.block = false; if (G.mode === 'duel' && !G.paused && G.phase === 'fight') setPaused(true); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'duel' && !G.paused) setPaused(true); });
let rzT = 0; addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(resize, 80); });

function playerControl(f) {
  if (!f.alive) return;
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0); f.moveDir = dir * f.facing;
  if (inp.buf && G.time - inp.bufT > .28) inp.buf = null;
  if (f.state === 'block' && !inp.block) f.set('idle');
  if (f.state === 'attack' && f.atkPhase === 0 && f.atk.key === 'hv' && inp.block && G.time - inp.blockT < .12 && f.t < f.atk.wind * .7) { inp.blockT = -9; f.startBlock(); addText(f.x, FLOOR - 205, 'FEINT', '#cfd6df', 20); return; }
  if (f.state === 'attack' && f.atkPhase === 2 && inp.buf === 'light' && f.atk.next && f.t > f.atk.rec * .3) { inp.buf = null; if (f.startAttack(f.atk.next)) return; }
  if (f.state === 'block' && inp.buf && inp.buf !== 'light') { /* allow dodge / heavy out of guard */ f.set('idle'); }
  if (!f.canAct()) return;
  const b = inp.buf;
  if (b) {
    inp.buf = null;
    if (b === 'dodge') { if (!f.dodge(f.moveDir > 0 ? 1 : -1)) { SFX.deny(); addText(f.x, FLOOR - 205, 'WINDED', '#9bd07f', 20); } return; }
    if (b === 'special') { if (f.resolve >= 100) { f.startAttack('sp'); return; } SFX.deny(); }
    else if (!f.startAttack(b === 'heavy' ? 'hv' : b === 'kick' ? 'kick' : 'l1')) { SFX.deny(); addText(f.x, FLOOR - 205, 'WINDED', '#9bd07f', 20); } else return;
  }
  if (inp.block) f.startBlock();
}

/* ================= Simulation ================= */
const STEP = 1 / 120; let acc = 0, last = 0;
const DBG = window.__ironoath = { speed: 1, onStep: null };
function step(dt) {
  G.time += dt; const p = G.p, e = G.e; if (!p) return; if (DBG.onStep) DBG.onStep(dt);
  G.phaseT += dt;
  if (G.phase === 'fight') { if (G.demo) aiUpdate(p, e, dt); else playerControl(p); aiUpdate(e, p, dt); }
  else { p.moveDir = e.moveDir = 0; if (p.state === 'block') p.set('idle'); }
  p.update(dt, e); e.update(dt, p);
  if (p.alive && e.alive) { const dx = e.x - p.x, ad = Math.abs(dx), MIN = 86; if (ad < MIN) { const push = (MIN - ad) / 2, s = dx >= 0 ? 1 : -1; p.x -= s * push; e.x += s * push; p.x = clamp(p.x, -BOUND, BOUND); e.x = clamp(e.x, -BOUND, BOUND); const d2 = Math.abs(e.x - p.x); if (d2 < MIN) { if (Math.abs(p.x) >= BOUND) e.x = p.x + s * MIN; else p.x = e.x - s * MIN; } } }
  for (const q of PARTS) { if (q.life <= 0) continue; q.life -= dt; if (q.type === 'r') continue; q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; if (q.type !== 'd' && q.y > FLOOR + 6) { q.y = FLOOR + 6; q.vy *= -.3; q.vx *= .5; if (q.type === 'b') { q.vx = 0; q.vy = 0; q.g = 0; q.life = q.max = 7; q.y += Math.random() * 14; } } }
  for (let i = TEXTS.length - 1; i >= 0; i--) { const t = TEXTS[i]; t.life -= dt; t.y -= dt * 36; if (t.life <= 0) TEXTS.splice(i, 1); }
  const tc = clamp((p.x + e.x) / 2, -V.camMax, V.camMax); G.cam += (tc - G.cam) * Math.min(1, dt * 5);
  if (G.phase === 'intro' && G.phaseT > 1.9) { G.phase = 'fight'; G.phaseT = 0; }
  else if (G.phase === 'fight' && (!p.alive || !e.alive)) { G.phase = 'end'; G.phaseT = 0; if (!G.demo && !e.alive) { setTimeout(() => { if (G.mode === 'duel' && G.phase === 'end') { SFX.cheer(); SFX.fanfare(); banner('Victory', G.run.foe.name + ' is beaten', '', 1.8); } }, 700); } }
  else if (G.phase === 'end' && G.phaseT > (G.demo ? 3 : 2.9)) { G.phase = 'done'; if (G.demo) newDemo(); else if (!e.alive) duelWon(); else defeat(); }
  if (ARENAS[G.arena].storm) { G.boltT -= dt; if (G.boltT <= 0) { G.boltT = rand(7, 15); G.bolt = 1; if (!G.demo || G.mode === 'title') SFX.thunder(); } }
  if (G.bolt > 0) G.bolt -= dt * 2.4;
  if (!G.demo) updateHints(dt);
}
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(.05, (ts - last) / 1000 || 0); last = ts;
  musicTick();
  const frozen = G.paused || (G.mode !== 'duel' && G.mode !== 'title');
  if (!frozen) {
    if (G.hitstop > 0) G.hitstop -= dt;
    else { let sd = dt; if (G.slow > 0) { G.slow -= dt; sd = dt * .3; } acc += sd * DBG.speed; let n = 0; const cap = 10 * DBG.speed; while (acc >= STEP && n < cap) { step(STEP); acc -= STEP; n++; } if (n === cap) acc = 0; }
    G.shake = Math.max(0, G.shake - dt * 3.4); if (G.hurt > 0) G.hurt -= dt * 1.6; if (G.flash > 0) G.flash -= dt * 4;
  }
  render(); updateHud();
}
let hudCache = {};
function setBar(id, v) { v = clamp(v, 0, 1); if (hudCache[id] !== v) { hudCache[id] = v; $(id).style.transform = `scaleX(${v.toFixed(4)})`; } }
function updateHud() {
  $('hurt').style.opacity = G.demo ? 0 : Math.max(0, G.hurt).toFixed(2); $('flash').style.opacity = Math.max(0, G.flash * .45).toFixed(2);
  if (G.mode !== 'duel' || !G.p) return; const p = G.p, e = G.e;
  setBar('pHp', p.hp / p.maxHp); setBar('pGhost', p.ghost / p.maxHp); setBar('pSt', p.stam / p.maxStam); setBar('pRs', p.resolve / 100);
  setBar('eHp', e.hp / e.maxHp); setBar('eGhost', e.ghost / e.maxHp); setBar('eSt', e.stam / e.maxStam); setBar('eRs', e.resolve / 100);
  const full = p.resolve >= 100; if (hudCache.full !== full) { hudCache.full = full; $('pRsBar').classList.toggle('full', full); document.querySelector('.tb.oath').classList.toggle('ready', full); }
}

/* ================= Render ================= */
let vig = null, vigKey = '';
function render() {
  const g = cx, A = ARENAS[G.arena], low = S.low, t = G.time; ensureLayers();
  const sk = S.shake ? G.shake : 0, shx = (Math.random() - .5) * sk * 16 * V.s, shy = (Math.random() - .5) * sk * 12 * V.s, camPx = G.cam * V.s;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.fillStyle = '#000'; g.fillRect(0, 0, V.W, V.H);
  g.drawImage(LY.far, Math.round(V.W / 2 - LY.far.width / 2 - camPx * .3 + shx * .3), Math.round(shy * .3));
  g.drawImage(LY.near, Math.round(V.W / 2 - LY.near.width / 2 - camPx + shx), Math.round(shy));
  g.setTransform(V.s, 0, 0, V.s, V.W / 2 - camPx + shx, V.gy + shy);
  const ext = !!extImg[G.arena];
  if (!ext) for (const L of A.lights) drawFlame(g, L.x, L.y, L.f, t, L.x);
  const p = G.p, e = G.e;
  if (p) {
    const order = !e.alive ? [e, p] : [p, e]; if (!p.alive) { order[0] = p; order[1] = e; }
    for (const f of order) { const k = f.state === 'dead' ? 1 + Math.min(1, f.fall / .7) * .8 : 1; g.fillStyle = 'rgba(0,0,0,.42)'; g.beginPath(); g.ellipse(f.x - (f.state === 'dead' ? f.facing * 40 * Math.min(1, f.fall / .7) : 0), FLOOR + 5, 48 * k * f.scale, 9, 0, 0, 7); g.fill(); }
    for (const f of order) { if (f.rage) { g.globalCompositeOperation = 'lighter'; glow(g, f.x, FLOOR - 100, 120, `rgba(255,40,20,${(.22 + Math.sin(t * 6) * .06).toFixed(3)})`); g.globalCompositeOperation = 'source-over'; } }
    for (const f of order) if (f.glow > .02) { g.globalCompositeOperation = 'lighter'; glow(g, f.x, FLOOR - 100, 150 * f.glow, f.isPlayer ? `rgba(255,205,90,${.5 * f.glow})` : `rgba(255,50,30,${.6 * f.glow})`); g.globalCompositeOperation = 'source-over'; }
    for (const f of order) drawFighter(g, f);
    for (const f of order) {
      const swinging = f.state === 'attack' && !f.atk.kick && (f.atkPhase === 1 || (f.atkPhase === 2 && f.t < .06));
      if (swinging) f.trail.push({ x: f.tipX, y: f.tipY, bx: f.hbX, by: f.hbY, t });
      while (f.trail.length && t - f.trail[0].t > .15) f.trail.shift();
      if (f.trail.length > 1) { const sp = f.atk && f.atk.unblockable; for (let i = 1; i < f.trail.length; i++) { const a = f.trail[i - 1], b = f.trail[i], al = 1 - (t - b.t) / .15; g.fillStyle = sp ? (f.isPlayer ? `rgba(255,215,120,${al * .6})` : `rgba(255,90,60,${al * .6})`) : `rgba(235,240,250,${al * .42})`; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(b.bx, b.by); g.lineTo(a.bx, a.by); g.closePath(); g.fill(); } }
      if (f.glint > 0 && f.state === 'attack' && f.atkPhase === 0) { const r = 26 * f.glint; g.strokeStyle = f.atk.unblockable ? (f.isPlayer ? '#ffe08a' : '#ff5a3c') : '#ffffff'; g.lineWidth = 2.5; g.globalAlpha = f.glint; g.beginPath(); g.moveTo(f.tipX - r, f.tipY); g.lineTo(f.tipX + r, f.tipY); g.moveTo(f.tipX, f.tipY - r); g.lineTo(f.tipX, f.tipY + r); g.stroke(); g.globalAlpha = 1; }
    }
  }
  for (const q of PARTS) {
    if (q.life <= 0) continue; const a = q.life / q.max;
    if (q.type === 'd') { g.fillStyle = q.color + (a * .32).toFixed(3) + ')'; g.beginPath(); g.arc(q.x, q.y, q.size * (1.6 - a * .6), 0, 7); g.fill(); }
    else if (q.type === 'r') { g.strokeStyle = q.color; g.globalAlpha = a * .8; g.lineWidth = 3 * a + .5; g.beginPath(); g.arc(q.x, q.y, q.size * (1 - a * a) + 6, 0, 7); g.stroke(); g.globalAlpha = 1; }
    else if (q.type === 's') { g.strokeStyle = q.color; g.globalAlpha = a; g.lineWidth = q.size * .8; g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x - q.vx * .02, q.y - q.vy * .02); g.stroke(); g.globalAlpha = 1; }
    else if (q.g === 0) { g.fillStyle = q.color; g.globalAlpha = Math.min(.8, a * 3); g.beginPath(); g.ellipse(q.x, q.y, q.size * 1.8, q.size * .6, 0, 0, 7); g.fill(); g.globalAlpha = 1; }
    else { g.fillStyle = q.color; g.globalAlpha = Math.min(1, a * 2.5); g.beginPath(); g.arc(q.x, q.y, q.size, 0, 7); g.fill(); g.globalAlpha = 1; }
  }
  if (TEXTS.length) { g.textAlign = 'center'; g.lineJoin = 'round'; for (const tx of TEXTS) { const a = Math.min(1, tx.life * 2.5), sc = 1 + Math.max(0, tx.life - .95) * 4; g.font = `${tx.size * sc}px "Palatino Linotype",Palatino,Georgia,serif`; g.globalAlpha = a; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(tx.s, tx.x, tx.y); g.fillStyle = tx.color; g.fillText(tx.s, tx.x, tx.y); } g.globalAlpha = 1; }
  // lighting
  const ox = V.W / 2 - camPx + shx, oy = V.gy + shy;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'multiply'; g.fillStyle = A.ambient; g.fillRect(0, 0, V.W, V.H);
  if (!ext) { g.globalCompositeOperation = 'lighter'; for (const L of A.lights) { const fl = .82 + Math.sin(t * 11 + L.x) * .08 + Math.sin(t * 27 + L.x * 2) * .05, r = L.r * V.s * (low ? .8 : 1) * (.96 + fl * .05), x = ox + L.x * V.s, y = oy + (L.y - 12) * V.s; if (x + r < 0 || x - r > V.W) continue; glow(g, x, y, r, `rgba(255,150,60,${(.3 * fl).toFixed(3)})`); glow(g, x, y, r * .28, `rgba(255,220,150,${(.34 * fl).toFixed(3)})`); } }
  g.globalCompositeOperation = 'source-over';
  // weather
  const w = A.weather;
  if (w === 'rain') { g.strokeStyle = 'rgba(190,205,230,.34)'; g.lineWidth = Math.max(1, V.s * .9); g.beginPath(); for (const a of AMB) { const v = (a.v + t * (1.5 + a.s)) % 1, u = (a.u - v * .16 + 1) % 1, x = u * V.W, y = v * V.H, l = 26 * V.s * a.s; g.moveTo(x, y); g.lineTo(x - l * .16, y + l); } g.stroke(); }
  else if (w === 'embers') { g.globalCompositeOperation = 'lighter'; for (const a of AMB) { const v = 1 - ((a.v + t * .05 * a.s) % 1), x = ((a.u + Math.sin(t * .7 + a.p) * .02 + 1) % 1) * V.W, y = v * V.H * .9; g.fillStyle = `rgba(255,${130 + a.s * 80 | 0},50,${(.5 * v).toFixed(2)})`; g.fillRect(x, y, 2.2 * V.s * a.s, 2.2 * V.s * a.s); } g.globalCompositeOperation = 'source-over'; }
  else if (w === 'leaves') { for (const a of AMB) { const v = (a.v + t * .045 * a.s) % 1, x = ((a.u + t * .02 + Math.sin(t + a.p) * .02) % 1) * V.W, y = v * V.H; g.save(); g.translate(x, y); g.rotate(t * 1.5 * a.s + a.p); g.fillStyle = a.s > .75 ? 'rgba(120,96,40,.8)' : 'rgba(70,96,46,.8)'; g.beginPath(); g.ellipse(0, 0, 5 * V.s * a.s, 2.2 * V.s * a.s, 0, 0, 7); g.fill(); g.restore(); } }
  if (A.fog && !low) { for (let i = 0; i < 4; i++) { const x = ((i * .31 + t * .012 * (1 + i * .3)) % 1.4 - .2) * V.W, y = oy + (-40 + i * 26) * V.s, r = 330 * V.s; g.save(); g.translate(x, y); g.scale(1, .22); glow(g, 0, 0, r, 'rgba(232,230,214,.26)'); g.restore(); } }
  if (!low) { const key = V.W + 'x' + V.H; if (vigKey !== key) { vigKey = key; vig = g.createRadialGradient(V.W / 2, V.H * .52, Math.min(V.W, V.H) * .38, V.W / 2, V.H * .52, Math.max(V.W, V.H) * .74); vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,.62)'); } g.fillStyle = vig; g.fillRect(0, 0, V.W, V.H); }
  if (G.bolt > 0) { g.fillStyle = `rgba(215,228,255,${(Math.max(0, G.bolt) * (.3 + .2 * Math.sin(t * 60))).toFixed(3)})`; g.fillRect(0, 0, V.W, V.H); }
}

/* ================= Boot ================= */
resize(); refreshRecord(); newDemo();
requestAnimationFrame(frame);
Object.assign(DBG, { G, inp, save });
})();
