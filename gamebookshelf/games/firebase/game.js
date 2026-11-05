'use strict';
(function () {
// =====================================================================
//  FIREBASE — military tower defense
// =====================================================================
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;
const angLerp = (a, b, t) => { let d = b - a; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return a + d * t; };
const isTouch = (window.matchMedia && matchMedia('(pointer:coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
if (isTouch) document.body.classList.add('touch');
let errShown = false;
window.addEventListener('error', e => { if (errShown) return; errShown = true; const b = $('err'); b.textContent = 'Something went wrong: ' + (e.message || 'unknown error') + '. Reload the page to keep playing.'; b.className = ''; });
const store = {
  get(k, d) { try { const v = localStorage.getItem('firebase.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('firebase.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
};
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- data
const MW = 24, MH = 14;
const MAPS = [
  { id: 'valley', name: 'Valley Road', theme: 'green', diff: 1, seed: 11, desc: 'One road snakes through farmland to the gate. Learn the ropes here.',
    lanes: [[[-1, 2.5], [5.5, 2.5], [5.5, 10.5], [11.5, 10.5], [11.5, 3.5], [17.5, 3.5], [17.5, 10.5], [20, 10.5]]], base: [20, 9, 4, 4] },
  { id: 'desert', name: 'Desert Pass', theme: 'desert', diff: 1.04, seed: 23, desc: 'Two convoy routes meet at a crossroads before the base.',
    lanes: [[[-1, 2.5], [6.5, 2.5], [6.5, 6.5], [13.5, 6.5], [13.5, 9.5], [20, 9.5]], [[-1, 11.5], [9.5, 11.5], [9.5, 6.5], [13.5, 6.5], [13.5, 9.5], [20, 9.5]]], base: [20, 8, 4, 4] },
  { id: 'river', name: 'River Crossing', theme: 'river', diff: 1.08, seed: 37, desc: 'A long switchback road and a single bridge. Helicopters cut straight across the water.',
    lanes: [[[-1, 6.5], [3.5, 6.5], [3.5, 1.5], [8.5, 1.5], [8.5, 12.5], [15.5, 12.5], [15.5, 2.5], [19.5, 2.5], [19.5, 7.5], [20, 7.5]]], base: [20, 6, 4, 4], river: [12, 14] },
  { id: 'mountain', name: 'Mountain Outpost', theme: 'snow', diff: 1.1, seed: 41, desc: 'Two passes through the rocks, converging right at your walls.',
    lanes: [[[-1, 1.5], [7.5, 1.5], [7.5, 5.5], [14.5, 5.5], [14.5, 7.5], [20, 7.5]], [[-1, 12.5], [5.5, 12.5], [5.5, 9.5], [14.5, 9.5], [14.5, 7.5], [20, 7.5]]], base: [20, 6, 4, 4] }
];
const THEMES = {
  green: { ground: '#56713b', g2: '#6a8646', g3: '#45602f', road: '#8b7556', verge: '#6d5c40', tree: ['#2f4a26', '#3d5c30', '#24391d'], rock: '#7d7a70' },
  desert: { ground: '#c3a06a', g2: '#d4b37c', g3: '#a98757', road: '#9e8158', verge: '#8c7048', tree: ['#7b7443', '#8d8650', '#5f5a33'], rock: '#9c8466' },
  river: { ground: '#4f6c3a', g2: '#62804a', g3: '#3e5a2c', road: '#857055', verge: '#68573e', tree: ['#2b4524', '#38572e', '#203419'], rock: '#76736a' },
  snow: { ground: '#dfe4e7', g2: '#eef1f3', g3: '#c4ccd2', road: '#8d8a83', verge: '#a9aaa6', tree: ['#2f4436', '#3a5242', '#24362b'], rock: '#7f858b' }
};
const TOWERS = {
  mg: { name: 'MG Nest', short: 'MG', cost: [100, 90, 160], dmg: [8, 12, 18], rate: [6, 7, 8.5], range: [2.6, 2.9, 3.25], dtype: 'bullet', air: true, ground: true,
    desc: ['Machine gun nest', 'Twin machine guns', 'Heavy .50 cal'] },
  at: { name: 'AT Gun', short: 'AT', cost: [200, 180, 300], dmg: [110, 185, 310], rate: [.6, .66, .78], range: [3.2, 3.55, 4], dtype: 'at', air: false, ground: true,
    desc: ['Anti-tank gun', 'Long-barrel AT gun', 'Guided missile launcher'] },
  mortar: { name: 'Mortar Pit', short: 'Mortar', cost: [240, 200, 340], dmg: [52, 82, 128], rate: [.45, .52, .6], range: [5, 5.6, 6.3], minR: 1.3, splash: [.95, 1.05, 1.2], dtype: 'he', air: false, ground: true,
    desc: ['81 mm mortar', 'Twin mortar pit', '120 mm heavy mortar'] },
  aa: { name: 'Flak Gun', short: 'Flak', cost: [170, 150, 260], dmg: [28, 44, 68], rate: [2.8, 3.4, 4.2], range: [3.8, 4.2, 4.7], splash: [.5, .55, .65], dtype: 'flak', air: true, ground: false,
    desc: ['Twin 20 mm flak', 'Quad 20 mm flak', 'Radar-guided 35 mm'] },
  sniper: { name: 'Sniper Post', short: 'Sniper', cost: [220, 190, 320], dmg: [80, 130, 215], rate: [.6, .7, .85], range: [4.6, 5.1, 5.7], dtype: 'sniper', air: true, ground: true, crit: .2,
    desc: ['Marksman', 'Sniper team', 'Anti-materiel rifle'] },
  flame: { name: 'Flame Bunker', short: 'Flame', cost: [180], dmg: [7], rate: [8], range: [1.9], dtype: 'fire', air: false, ground: true,
    desc: ['Flamethrower bunker', 'Twin flame bunker', 'Heavy flame projector'] },
  radar: { name: 'Radar Post', short: 'Radar', cost: [150], dmg: [0], rate: [0], range: [2.7], dtype: 'none', air: false, ground: false, support: true,
    desc: ['Field radar', 'Fire-control radar', 'Battle radar'] }
};
const T_ORDER = ['mg', 'at', 'mortar', 'aa', 'sniper', 'flame', 'radar'];
// three separate upgrade paths, bought independently (4 tiers each)
const PATHS = [['dmg', 'Firepower', 'Z'], ['rate', 'Rate of fire', 'X'], ['range', 'Range', 'C']];
const PATH_NAMES = { mg: ['Heavier rounds', 'Faster cycling', 'Better optics'], at: ['Bigger shells', 'Quicker loader', 'Longer barrel'], mortar: ['Heavier shells', 'Crew drills', 'Extra charges'],
  aa: ['Proximity fuzes', 'Faster feed', 'Radar ranging'], sniper: ['Bigger caliber', 'Bolt drills', 'Better scope'], flame: ['Hotter fuel', 'Bigger tanks', 'Longer nozzle'], radar: ['Targeting data', 'Fire control', 'Wider coverage'] };
const PATH_COST = [.35, .5, .7, .95], PMAX = 4, MERGE_AT = 6, TR = .42;
const UPM = { dmg: .3, rate: .2, range: .1 };
const ELITE = { mg: 'Gatling Emplacement', at: 'Tank Destroyer', mortar: 'Rocket Battery', aa: 'SAM Site', sniper: 'Recon Team', flame: 'Inferno Bunker', radar: 'Command Center' };
// one active ability per defense
const ABIL = {
  mg: { n: 'Suppressing fire', d: 'Double fire rate for 6 s. Hits pin infantry and light vehicles, slowing them down.', cd: 28, dur: 6 },
  at: { n: 'Sabot rounds', d: 'The next 3 shots deal triple damage.', cd: 22 },
  mortar: { n: 'Fire for effect', d: 'Six rapid shells on the densest group in range.', cd: 30 },
  aa: { n: 'Box barrage', d: 'Double fire rate and wider bursts for 6 s.', cd: 28, dur: 6 },
  sniper: { n: 'Mark target', d: 'A guaranteed critical on the toughest enemy in range. It then takes +30% damage from everything for 8 s.', cd: 24 },
  flame: { n: 'Napalm', d: 'Sets the road in range on fire for 6 s.', cd: 30 },
  radar: { n: 'Rally', d: 'Defenses in coverage fire 50% faster for 8 s.', cd: 35, dur: 8 }
};
const MULT = {
  bullet: { soft: 1, light: .6, medium: .3, heavy: .08, air: .55 },
  at: { soft: .45, light: 1.3, medium: 1.5, heavy: 1.6, air: 0 },
  he: { soft: 1.25, light: 1, medium: .8, heavy: .55, air: 0 },
  flak: { soft: 0, light: 0, medium: 0, heavy: 0, air: 1.5 },
  sniper: { soft: 2, light: .5, medium: .25, heavy: .08, air: .45 },
  fire: { soft: 1.5, light: 1.1, medium: .45, heavy: .15, air: 0 },
  none: { soft: 0, light: 0, medium: 0, heavy: 0, air: 0 },
  arty: { soft: 1.2, light: 1.1, medium: 1, heavy: .8, air: 0 },
  gun: { soft: 1, light: 1, medium: 1, heavy: .9, air: .6 }
};
const ENEMIES = {
  rifle: { name: 'Rifleman', hp: 70, sp: 1.02, armor: 'soft', cash: 6, leak: 1, size: .13 },
  medic: { name: 'Medic', hp: 85, sp: .98, armor: 'soft', cash: 10, leak: 1, size: .13 },
  bike: { name: 'Scout bike', hp: 95, sp: 2.1, armor: 'light', cash: 8, leak: 1, size: .2 },
  jeep: { name: 'Technical', hp: 270, sp: 1.55, armor: 'light', cash: 15, leak: 2, size: .3 },
  apc: { name: 'APC', hp: 760, sp: 1.02, armor: 'medium', cash: 30, leak: 3, size: .38 },
  tank: { name: 'Tank', hp: 1750, sp: .68, armor: 'heavy', cash: 55, leak: 5, size: .42 },
  mbt: { name: 'Heavy tank', hp: 7000, sp: .45, armor: 'heavy', cash: 300, leak: 12, size: .52, boss: true },
  heli: { name: 'Helicopter', hp: 480, sp: 1.25, armor: 'air', cash: 35, leak: 2, size: .45, air: true },
  drone: { name: 'Drone', hp: 55, sp: 2.3, armor: 'air', cash: 4, leak: 1, size: .15, air: true }
};
// [type, count, gap seconds, delay seconds]
const WAVES = [
  [['rifle', 6, 1.1]],
  [['rifle', 8, .9], ['bike', 2, 1.3, 7]],
  [['rifle', 10, .8], ['jeep', 1, 0, 8]],
  [['bike', 5, .8], ['rifle', 8, .7, 4], ['jeep', 2, 2, 9]],
  [['rifle', 12, .6], ['medic', 2, 3, 2], ['jeep', 3, 2, 8]],
  [['apc', 1, 0], ['rifle', 10, .6, 3], ['bike', 6, .6, 10]],
  [['jeep', 5, 1.4], ['rifle', 14, .5, 2], ['medic', 3, 2.5, 4]],
  [['heli', 1, 0], ['rifle', 12, .5, 2], ['apc', 2, 4, 6]],
  [['bike', 10, .45], ['jeep', 5, 1.2, 5], ['heli', 2, 4, 9]],
  [['tank', 1, 0], ['apc', 2, 3, 4], ['rifle', 16, .45, 1]],
  [['drone', 8, .35], ['rifle', 16, .45, 3], ['medic', 3, 3, 5]],
  [['tank', 2, 5], ['jeep', 6, 1, 2], ['heli', 2, 5, 8]],
  [['apc', 4, 2.5], ['rifle', 20, .4, 1], ['bike', 10, .4, 10]],
  [['heli', 3, 2.6], ['drone', 10, .35, 5], ['jeep', 6, 1, 9]],
  [['mbt', 1, 0], ['rifle', 20, .4, 2], ['apc', 2, 4, 6]],
  [['tank', 3, 3.5], ['medic', 4, 2, 2], ['rifle', 22, .35, 3]],
  [['drone', 16, .25], ['heli', 4, 2, 5], ['bike', 12, .35, 8]],
  [['apc', 6, 2], ['jeep', 8, .9, 4], ['tank', 2, 5, 10]],
  [['rifle', 30, .3], ['medic', 6, 1.5, 2], ['heli', 5, 2, 9]],
  [['mbt', 2, 10], ['tank', 3, 4, 3], ['drone', 14, .3, 8]],
  [['tank', 5, 2.8], ['apc', 5, 2.5, 2], ['heli', 5, 2, 10]],
  [['bike', 16, .3], ['jeep', 10, .7, 4], ['drone', 20, .22, 8], ['rifle', 24, .3, 12]],
  [['heli', 8, 1.6], ['tank', 4, 3, 4], ['medic', 6, 1.5, 6], ['rifle', 30, .28, 7]],
  [['apc', 8, 1.8], ['tank', 6, 2.5, 6], ['drone', 24, .2, 12]],
  [['mbt', 2, 10], ['tank', 5, 2.8, 4], ['heli', 7, 1.7, 10], ['rifle', 36, .26, 2]]
];
const PERKS = [
  { id: 'supply', name: 'Forward supply', desc: '+60 starting supply per rank', cost: [1, 1, 2] },
  { id: 'gunnery', name: 'Gunnery school', desc: '+8% machine gun and sniper damage per rank', cost: [1, 2, 3] },
  { id: 'ap', name: 'Armor-piercing rounds', desc: '+8% AT gun and mortar damage per rank', cost: [1, 2, 3] },
  { id: 'flak', name: 'Air defense', desc: '+10% flak damage and range per rank', cost: [1, 2] },
  { id: 'arty', name: 'Fire support', desc: 'Call-ins recharge 15% faster per rank', cost: [1, 2] },
  { id: 'eng', name: 'Combat engineers', desc: 'Defenses cost 8% less per rank', cost: [2, 3] },
  { id: 'fort', name: 'Fortifications', desc: '+4 base integrity per rank', cost: [1, 2] },
  { id: 'salvage', name: 'Salvage teams', desc: 'Selling refunds 80% instead of 60%', cost: [2] },
  { id: 'intel', name: 'Field intelligence', desc: '+15% supply from kills per rank', cost: [2, 3] }
];
const CALLS = {
  arty: { name: 'Artillery', key: 'Q', cd: 40, unlock: 2, desc: 'Seven shells on a target area' },
  gun: { name: 'Gun run', key: 'E', cd: 65, unlock: 5, desc: 'A jet strafes along the road' }
};

// ---------------------------------------------------------------- save
const DEF_SET = { master: .8, music: .5, sfx: .85, mute: false, shake: true, low: false, auto: false, autoAb: false, ranges: true };
const SET = Object.assign({}, DEF_SET, store.get('settings', {}));
const DEF_SAVE = { maps: {}, perks: {}, tut: 0, sel: 'valley', mode: 'regular' };
const SAVE = Object.assign({}, DEF_SAVE, store.get('save', {}));
MAPS.forEach(m => { SAVE.maps[m.id] = Object.assign({ reg: 0, vet: 0, endless: 0 }, SAVE.maps[m.id] || {}); });
const persist = () => store.set('save', SAVE), persistSet = () => store.set('settings', SET);
const perk = id => SAVE.perks[id] || 0;
const starsEarned = () => MAPS.reduce((s, m) => s + SAVE.maps[m.id].reg + SAVE.maps[m.id].vet, 0);
const starsSpent = () => PERKS.reduce((s, p) => { let n = 0; for (let i = 0; i < perk(p.id); i++) n += p.cost[i]; return s + n; }, 0);
const mapOpen = i => i === 0 || SAVE.maps[MAPS[i - 1].id].reg > 0;

// =====================================================================
//  AUDIO
// =====================================================================
const AU = { ctx: null, duck: 1, demo: false, last: {} };
function audioInit() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  let c; try { c = new AC(); } catch (e) { return; }
  AU.ctx = c;
  const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 6; comp.attack.value = .003; comp.release.value = .25;
  AU.master = c.createGain(); comp.connect(AU.master); AU.master.connect(c.destination);
  AU.sfx = c.createGain(); AU.sfx.connect(comp); AU.mus = c.createGain(); AU.mus.connect(comp);
  AU.verb = c.createConvolver(); AU.verb.buffer = impulse(c, 2.6, 2.4); const vo = c.createGain(); vo.gain.value = .3; AU.verb.connect(vo); vo.connect(comp);
  AU.sv = c.createGain(); AU.sv.gain.value = .3; AU.sv.connect(AU.verb); AU.mv = c.createGain(); AU.mv.gain.value = .4; AU.mv.connect(AU.verb);
  const len = c.sampleRate * 2, nb = c.createBuffer(1, len, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; AU.noise = nb;
  // helicopter rotor & engine rumble loops
  const mk = (f, q, type) => { const s = c.createBufferSource(); s.buffer = nb; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(AU.sfx); s.start(); return g; };
  AU.rotor = mk(420, 1.2, 'bandpass');
  AU.rotLfo = c.createOscillator(); AU.rotLfo.frequency.value = 11; const lg = c.createGain(); lg.gain.value = 0; AU.rotLfo.connect(lg); lg.connect(AU.rotor.gain); AU.rotLfoG = lg; AU.rotLfo.start();
  AU.rumble = mk(90, .7, 'lowpass');
  applyAudio(); Music.start();
}
function impulse(c, dur, decay) { const len = Math.floor(c.sampleRate * dur), b = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
function applyAudio() { if (!AU.ctx) return; const t = AU.ctx.currentTime; AU.master.gain.setTargetAtTime(SET.mute ? 0 : SET.master, t, .03); AU.sfx.gain.setTargetAtTime(SET.sfx * (AU.demo ? .3 : 1), t, .1); AU.mus.gain.setTargetAtTime(SET.music * .8 * AU.duck, t, .3); }
function envG(g, t, a, peak, dec) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + dec); }
function route(n, pan, verb, bus) { const c = AU.ctx; let o = n; if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); n.connect(p); o = p; } o.connect(bus || AU.sfx); if (verb) o.connect(bus === AU.mus ? AU.mv : AU.sv); }
function tone(type, f, t, a, peak, dec, f2, bus, verb = true, pan = 0) { const c = AU.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + a + dec); o.connect(g); envG(g, t, a, peak, dec); route(g, pan, verb, bus); o.start(t); o.stop(t + a + dec + .05); }
function noiseB(t, dur, type, f, q, peak, a, bus, verb = true, pan = 0) { const c = AU.ctx, s = c.createBufferSource(); s.buffer = AU.noise; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); s.connect(fl); fl.connect(g); envG(g, t, a, peak, dur); route(g, pan, verb, bus); s.start(t, Math.random() * 1.4); s.stop(t + a + dur + .05); }
// rate limit per sound so dense fights stay clean
function lim(key, gap) { if (!AU.ctx) return false; const t = AU.ctx.currentTime; if (AU.last[key] && t - AU.last[key] < gap) return false; AU.last[key] = t; return true; }
const panOf = x => clamp((x / MW) * 2 - 1, -1, 1) * .7;
const SFX = {
  mg(x) { if (!lim('mg', .045)) return; const t = AU.ctx.currentTime + .003; noiseB(t, .05, 'bandpass', rand(1200, 1700), .8, .22, .001, AU.sfx, true, panOf(x)); tone('square', 120, t, .001, .05, .03, 70, AU.sfx, false, panOf(x)); },
  at(x) { if (!lim('at', .08)) return; const t = AU.ctx.currentTime + .003; tone('sine', 140, t, .002, .5, .25, 45, AU.sfx, true, panOf(x)); noiseB(t, .18, 'lowpass', 1800, .6, .45, .001, AU.sfx, true, panOf(x)); noiseB(t, .03, 'highpass', 4000, .5, .2, .001, AU.sfx, false, panOf(x)); },
  missile(x) { if (!lim('ms', .1)) return; const t = AU.ctx.currentTime + .003; noiseB(t, .5, 'bandpass', 900, .7, .25, .02, AU.sfx, true, panOf(x)); tone('sawtooth', 300, t, .02, .04, .4, 900, AU.sfx, false, panOf(x)); },
  mortar(x) { if (!lim('mo', .1)) return; const t = AU.ctx.currentTime + .003; tone('sine', 90, t, .002, .45, .18, 50, AU.sfx, true, panOf(x)); noiseB(t, .08, 'lowpass', 900, .8, .3, .001, AU.sfx, false, panOf(x)); },
  whistle(x, dur) { if (!lim('wh', .25)) return; const t = AU.ctx.currentTime + .003; tone('sine', 1800, t, .05, .035, dur, 500, AU.sfx, false, panOf(x)); },
  flak(x) { if (!lim('fk', .07)) return; const t = AU.ctx.currentTime + .003; tone('sine', 220, t, .002, .25, .08, 110, AU.sfx, false, panOf(x)); noiseB(t, .06, 'bandpass', 800, 1, .25, .001, AU.sfx, true, panOf(x)); },
  burst(x) { if (!lim('bu', .06)) return; const t = AU.ctx.currentTime + .003; noiseB(t, .12, 'lowpass', 2200, .6, .18, .002, AU.sfx, true, panOf(x)); },
  sniper(x) { if (!lim('sn', .1)) return; const t = AU.ctx.currentTime + .003; noiseB(t, .04, 'highpass', 2500, .5, .5, .001, AU.sfx, true, panOf(x)); tone('triangle', 900, t, .001, .1, .06, 300, AU.sfx, true, panOf(x)); noiseB(t + .02, .5, 'bandpass', 600, .6, .08, .05, AU.sfx, true, panOf(x)); },
  boom(x, big) { if (!lim('bo' + (big ? 1 : 0), big ? .08 : .05)) return; const t = AU.ctx.currentTime + .003, v = big ? 1 : .55; tone('sine', big ? 70 : 100, t, .003, .7 * v, big ? .7 : .35, 32, AU.sfx, true, panOf(x)); noiseB(t, big ? .9 : .45, 'lowpass', big ? 1200 : 1800, .5, .6 * v, .003, AU.sfx, true, panOf(x)); noiseB(t, .12, 'bandpass', 3000, .7, .2 * v, .001, AU.sfx, false, panOf(x)); },
  hit(x) { if (!lim('hi', .05)) return; const t = AU.ctx.currentTime + .003; noiseB(t, .03, 'bandpass', 2600, 2, .06, .001, AU.sfx, false, panOf(x)); },
  clank(x) { if (!lim('cl', .07)) return; const t = AU.ctx.currentTime + .003; tone('square', rand(700, 1100), t, .001, .04, .05, 0, AU.sfx, false, panOf(x)); },
  build() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .003; noiseB(t, .12, 'lowpass', 500, .7, .5, .004); noiseB(t + .1, .1, 'lowpass', 600, .7, .4, .004); tone('triangle', 330, t + .16, .004, .08, .15); tone('triangle', 494, t + .22, .004, .08, .2); },
  upgrade() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .003; for (let i = 0; i < 4; i++) noiseB(t + i * .06, .03, 'bandpass', 2400 + i * 300, 3, .15, .001); tone('triangle', 523, t + .26, .004, .1, .2); tone('triangle', 784, t + .32, .004, .1, .35); },
  sell() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .003; tone('triangle', 784, t, .003, .1, .12); tone('triangle', 587, t + .08, .003, .1, .2); },
  ui() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .003; tone('square', 1200, t, .001, .03, .03, 0, AU.sfx, false); },
  deny() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .003; tone('square', 180, t, .003, .06, .12, 0, AU.sfx, false); },
  radio() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .003; noiseB(t, .12, 'bandpass', 2000, 2, .08, .005); tone('square', 1400, t + .1, .002, .04, .06, 0, AU.sfx, false); tone('square', 1400, t + .2, .002, .04, .06, 0, AU.sfx, false); },
  horn() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .01; [0, .5].forEach(o => { tone('sawtooth', 220, t + o, .05, .06, .35, 0, AU.sfx, true); tone('sawtooth', 277, t + o, .05, .05, .35, 0, AU.sfx, true); }); },
  alarm() { if (!lim('al', .5)) return; const t = AU.ctx.currentTime + .003; tone('square', 660, t, .005, .07, .12, 0, AU.sfx, false); tone('square', 520, t + .15, .005, .07, .12, 0, AU.sfx, false); },
  coin() { if (!lim('co', .06)) return; const t = AU.ctx.currentTime + .003; tone('triangle', 1760, t, .002, .025, .06, 0, AU.sfx, false); },
  jet() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .01; noiseB(t, 2.2, 'bandpass', 1400, .6, .5, .8); tone('sawtooth', 900, t, .5, .04, 1.6, 300); },
  brrt(x) { if (!AU.ctx) return; const t = AU.ctx.currentTime + .003; for (let i = 0; i < 14; i++) noiseB(t + i * .025, .03, 'lowpass', 900, .7, .35, .001, AU.sfx, false, panOf(x)); },
  win() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .05; [294, 370, 440, 587].forEach((f, i) => { tone('sawtooth', f, t + i * .14, .02, .07, .9); tone('triangle', f * 2, t + i * .14, .02, .05, .9); }); },
  lose() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .05; [294, 277, 262, 220].forEach((f, i) => tone('sawtooth', f, t + i * .22, .02, .07, .6)); },
  flame(x) { if (!lim('fl', .09)) return; const t = AU.ctx.currentTime + .003; noiseB(t, .14, 'lowpass', 650, .6, .2, .01, AU.sfx, false, panOf(x)); noiseB(t, .08, 'bandpass', 2300, .8, .04, .005, AU.sfx, false, panOf(x)); },
  ability() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .003; noiseB(t, .1, 'bandpass', 1800, 2, .08, .004); tone('triangle', 520, t + .04, .004, .1, .12, 1040, AU.sfx, true); tone('triangle', 780, t + .12, .004, .08, .2, 0, AU.sfx, true); },
  merge() { if (!AU.ctx) return; const t = AU.ctx.currentTime + .003; tone('sine', 90, t, .004, .5, .6, 45, AU.sfx, true); noiseB(t, .5, 'lowpass', 900, .6, .35, .01); [392, 494, 587, 784].forEach((f, i) => tone('triangle', f, t + .15 + i * .07, .004, .09, .35, 0, AU.sfx, true)); },
  loops(heli, armor) { if (!AU.ctx) return; const t = AU.ctx.currentTime; AU.rotor.gain.setTargetAtTime(0, t, .3); AU.rotLfoG.gain.setTargetAtTime(Math.min(.09, heli * .035), t, .3); AU.rumble.gain.setTargetAtTime(Math.min(.12, armor * .025), t, .4); }
};
// ---------------------------------------------------------------- music (calm while you build, drums when a wave rolls)
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const Music = {
  on: false, step: 0, next: 0, bpm: 96, timer: 0, intense: 0, target: 0,
  chords: [[38, 0], [34, 1], [41, 1], [36, 1]], // Dm Bb F C
  start() { if (this.on || !AU.ctx) return; this.on = true; this.next = AU.ctx.currentTime + .2; this.timer = setInterval(() => this.tick(), 40); },
  tick() { const c = AU.ctx; if (!c || c.state !== 'running') return; const s16 = 60 / this.bpm / 4; while (this.next < c.currentTime + .2) { this.intense = lerp(this.intense, this.target, .02); this.play(this.step, this.next, s16); this.next += s16; this.step = (this.step + 1) % 64; } },
  play(s, t, s16) {
    const B = AU.mus, bar = s >> 4, e = s & 15, [root, maj] = this.chords[bar], I = this.intense;
    const third = maj ? 4 : 3;
    if (e === 0) { // pad
      [root + 12, root + 12 + third, root + 19, root + 24].forEach((n, k) => {
        const o = AU.ctx.createOscillator(), o2 = AU.ctx.createOscillator(), g = AU.ctx.createGain(), lp = AU.ctx.createBiquadFilter();
        o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = mtof(n); o2.frequency.value = mtof(n) * 1.004;
        lp.type = 'lowpass'; lp.frequency.value = 700 + I * 500; o.connect(lp); o2.connect(lp); lp.connect(g);
        g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.022, t + .8); g.gain.linearRampToValueAtTime(.016, t + s16 * 14); g.gain.linearRampToValueAtTime(.0001, t + s16 * 16.5);
        route(g, (k - 1.5) * .3, true, B); o.start(t); o2.start(t); o.stop(t + s16 * 17); o2.stop(t + s16 * 17);
      });
    }
    // low pulse
    if (e % 4 === 0) tone('sine', mtof(root - 12), t, .01, .12, s16 * 3, 0, B, false);
    if (e % 2 === 0) noiseB(t, .03, 'highpass', 8000, .7, .015 + I * .02, .001, B, false, .3);
    if (I < .15) return;
    // string ostinato
    const pat = [0, 0, 12, 0, 7, 0, 12, 10, 0, 0, 12, 0, 7, 3, 5, 7];
    { const n = root + pat[e] + (pat[e] === 3 && maj ? 1 : 0); const o = AU.ctx.createOscillator(), g = AU.ctx.createGain(), lp = AU.ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(n + 12); lp.type = 'lowpass'; lp.frequency.value = 1300; lp.Q.value = 2; o.connect(lp); lp.connect(g); envG(g, t, .005, .05 * I, s16 * .9); route(g, -.2, true, B); o.start(t); o.stop(t + s16 * 1.2); }
    // taiko / toms
    if (e === 0 || e === 6 || e === 10 || (e === 14 && bar === 3)) { tone('sine', 72, t, .003, .5 * I, .35, 38, B, true); noiseB(t, .06, 'lowpass', 400, .7, .2 * I, .001, B, false); }
    if (e === 4 || e === 12) { noiseB(t, .14, 'bandpass', 1800, .9, .17 * I, .002, B, true); tone('triangle', 200, t, .002, .08 * I, .07, 150, B, false); }
    if (bar === 3 && e >= 12) noiseB(t, .05, 'bandpass', 1800, .9, .06 * I * (e - 11), .001, B, false);
    if (e === 0 && bar % 2 === 0) { [root + 12, root + 19].forEach(n => { const o = AU.ctx.createOscillator(), g = AU.ctx.createGain(), lp = AU.ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(n); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(2200, t + .08); lp.frequency.exponentialRampToValueAtTime(500, t + .6); o.connect(lp); lp.connect(g); envG(g, t, .04, .05 * I, .7); route(g, 0, true, B); o.start(t); o.stop(t + .9); }); }
  }
};

// =====================================================================
//  MAP
// =====================================================================
function lanePath(pts) {
  const segs = []; let L = 0;
  for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], l = Math.hypot(bx - ax, by - ay); segs.push({ ax, ay, bx, by, l, s0: L, dx: (bx - ax) / l, dy: (by - ay) / l }); L += l; }
  return { pts, segs, L };
}
function posAt(P, s, out) {
  s = clamp(s, 0, P.L);
  let lo = 0, hi = P.segs.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P.segs[m].s0 <= s) lo = m; else hi = m - 1; }
  const g = P.segs[lo], u = s - g.s0;
  out.x = g.ax + g.dx * u; out.y = g.ay + g.dy * u; out.dx = g.dx; out.dy = g.dy;
  return out;
}
const tmpP = { x: 0, y: 0, dx: 0, dy: 0 };
function segDist(px, py, ax, ay, bx, by) { const ex = bx - ax, ey = by - ay; let t = ((px - ax) * ex + (py - ay) * ey) / (ex * ex + ey * ey); t = clamp(t, 0, 1); return Math.hypot(px - ax - ex * t, py - ay - ey * t); }
function buildMap(M) {
  const map = { M, th: THEMES[M.theme], lanes: M.lanes.map(lanePath), grid: new Uint8Array(MW * MH), decor: [], air: [] };
  const [bx, by, bw, bh] = M.base;
  map.baseC = [bx + bw / 2, by + bh / 2];
  map.lanes.forEach(P => { const s = P.pts[0]; const st = [clamp(s[0], -.6, MW + .6), clamp(s[1], -.6, MH + .6)]; const side = st[1] < MH / 2 ? -1 : 1; map.air.push(lanePath([st, [st[0] + (map.baseC[0] - st[0]) * .35, clamp(st[1] + (map.baseC[1] - st[1]) * .2 + side * 2.2, .8, MH - .8)], [st[0] + (map.baseC[0] - st[0]) * .72, clamp(map.baseC[1] - side * 2.4, .8, MH - .8)], [map.baseC[0] - .6, map.baseC[1]]])); });
  const r = rng(M.seed);
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const cx = x + .5, cy = y + .5; let road = false, near = false;
    for (const P of map.lanes) for (const g of P.segs) { const d = segDist(cx, cy, g.ax, g.ay, g.bx, g.by); if (d < .6) road = true; else if (d < 1.6) near = true; }
    let v = 0;
    if (x >= bx && x < bx + bw && y >= by && y < by + bh) v = 4;
    else if (M.river && x >= M.river[0] && x < M.river[1]) v = road ? 5 : 3;
    else if (road) v = 1;
    else { const p = M.theme === 'snow' ? (near ? .05 : .2) : (near ? .03 : .11); if (r() < p) { v = 2; map.decor.push({ x: cx + rand(-.1, .1), y: cy + rand(-.1, .1), kind: M.theme === 'snow' || r() < .45 ? 'rock' : 'tree', s: .32 + r() * .14, r: r() }); } }
    map.grid[y * MW + x] = v;
  }
  // path samples for the bot and for coverage hints
  map.samples = []; map.lanes.forEach((P, li) => { for (let s = 0; s < P.L; s += .5) { posAt(P, s, tmpP); if (tmpP.x >= 0 && tmpP.x <= MW && tmpP.y >= 0 && tmpP.y <= MH) map.samples.push([tmpP.x, tmpP.y, s / P.L]); } });
  map.airSamples = []; map.air.forEach(P => { for (let s = 0; s < P.L; s += .5) { posAt(P, s, tmpP); map.airSamples.push([tmpP.x, tmpP.y, s / P.L]); } });
  return map;
}
const tileAt = (map, x, y) => (x < 0 || y < 0 || x >= MW || y >= MH) ? 9 : map.grid[y * MW + x];

// ---------- ground art (rendered once per operation)
function buildGround(map, T) {
  const c = document.createElement('canvas'); c.width = MW * T; c.height = MH * T; const t = c.getContext('2d');
  const th = map.th, M = map.M, r = rng(M.seed * 7 + 1);
  t.scale(T, T);
  t.fillStyle = th.ground; t.fillRect(0, 0, MW, MH);
  for (let i = 0; i < 70; i++) { const x = r() * MW, y = r() * MH, rr = .8 + r() * 2.6, g = t.createRadialGradient(x, y, 0, x, y, rr); const col = r() < .6 ? th.g2 : th.g3; g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); t.globalAlpha = .3; t.fillStyle = g; t.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  t.globalAlpha = 1;
  const nn = SET.low ? 4000 : 11000;
  for (let i = 0; i < nn; i++) { const x = r() * MW, y = r() * MH; t.fillStyle = r() < .5 ? 'rgba(0,0,0,.08)' : 'rgba(255,255,240,.07)'; t.fillRect(x, y, .03 + r() * .07, .03 + r() * .05); }
  if (M.theme !== 'snow' && M.theme !== 'desert') { t.strokeStyle = 'rgba(30,50,20,.25)'; t.lineWidth = .02; t.beginPath(); for (let i = 0; i < 2600; i++) { const x = r() * MW, y = r() * MH; t.moveTo(x, y); t.lineTo(x + rand(-.05, .05), y - .08 - r() * .08); } t.stroke(); }
  if (M.theme === 'desert') { t.strokeStyle = 'rgba(120,90,50,.18)'; t.lineWidth = .04; for (let i = 0; i < 40; i++) { const y = r() * MH, x = r() * MW; t.beginPath(); t.moveTo(x, y); t.bezierCurveTo(x + 1, y - .3, x + 2, y + .3, x + 3, y); t.stroke(); } }
  // river
  if (M.river) {
    const [a, b] = M.river;
    const g = t.createLinearGradient(a, 0, b, 0); g.addColorStop(0, '#2c4a55'); g.addColorStop(.5, '#3d6777'); g.addColorStop(1, '#2c4a55');
    t.fillStyle = '#5b5139'; t.fillRect(a - .12, 0, b - a + .24, MH);
    t.fillStyle = g; t.beginPath(); t.moveTo(a + .1, 0); for (let y = 0; y <= MH; y += .5) t.lineTo(a + .05 + Math.sin(y * 1.3) * .08, y); for (let y = MH; y >= 0; y -= .5) t.lineTo(b - .05 + Math.sin(y * 1.1 + 2) * .08, y); t.fill();
    t.strokeStyle = 'rgba(255,255,255,.18)'; t.lineWidth = .03; for (let i = 0; i < 40; i++) { const x = a + .3 + r() * (b - a - .6), y = r() * MH; t.beginPath(); t.moveTo(x, y); t.lineTo(x + .02, y + .4); t.stroke(); }
  }
  // roads
  t.lineJoin = 'round'; t.lineCap = 'round';
  const stroke = (w, col, a) => { t.globalAlpha = a; t.strokeStyle = col; t.lineWidth = w; for (const P of map.lanes) { t.beginPath(); P.pts.forEach((p, i) => i ? t.lineTo(p[0], p[1]) : t.moveTo(p[0], p[1])); t.stroke(); } t.globalAlpha = 1; };
  stroke(1.34, th.verge, .45); stroke(1.02, th.road, 1);
  t.save(); t.beginPath(); for (const P of map.lanes) { for (const g of P.segs) { const x0 = Math.min(g.ax, g.bx) - .51, y0 = Math.min(g.ay, g.by) - .51; t.rect(x0, y0, Math.abs(g.bx - g.ax) + 1.02, Math.abs(g.by - g.ay) + 1.02); } } t.clip();
  for (let i = 0; i < 4000; i++) { const x = r() * MW, y = r() * MH; t.fillStyle = r() < .5 ? 'rgba(0,0,0,.12)' : 'rgba(255,240,210,.1)'; t.fillRect(x, y, .04, .04); }
  t.restore();
  // tyre tracks
  t.strokeStyle = 'rgba(40,30,20,.22)'; t.lineWidth = .07;
  for (const P of map.lanes) for (const off of [-.2, .2]) { t.beginPath(); P.segs.forEach((g, i) => { const nx = -g.dy * off, ny = g.dx * off; if (!i) t.moveTo(g.ax + nx, g.ay + ny); t.lineTo(g.bx + nx, g.by + ny); }); t.stroke(); }
  // bridge
  if (M.river) {
    for (let y = 0; y < MH; y++) for (let x = M.river[0]; x < M.river[1]; x++) if (tileAt(map, x, y) === 5) {
      t.fillStyle = '#6d5236'; t.fillRect(x - .1, y + .02, 1.2, .96);
      for (let k = 0; k < 9; k++) { t.fillStyle = k % 2 ? '#7d6040' : '#735839'; t.fillRect(x - .1 + k * .133, y + .04, .12, .92); }
      t.fillStyle = '#3e2e1d'; t.fillRect(x - .1, y, 1.2, .06); t.fillRect(x - .1, y + .94, 1.2, .06);
    }
  }
  // cosmetic scatter
  for (let i = 0; i < 90; i++) {
    const x = r() * MW, y = r() * MH, tx = Math.floor(x), ty = Math.floor(y), v = tileAt(map, tx, ty); if (v !== 0) continue;
    if (M.theme === 'snow') { t.fillStyle = 'rgba(90,100,110,.5)'; t.beginPath(); t.ellipse(x, y, .08, .05, r() * 3, 0, TAU); t.fill(); }
    else if (M.theme === 'desert') { t.strokeStyle = '#6f6638'; t.lineWidth = .025; t.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; t.moveTo(x, y); t.lineTo(x + Math.cos(a) * .14, y + Math.sin(a) * .14); } t.stroke(); }
    else { t.fillStyle = th.tree[1]; t.beginPath(); t.arc(x, y, .09 + r() * .06, 0, TAU); t.fill(); t.fillStyle = 'rgba(255,255,255,.08)'; t.beginPath(); t.arc(x - .03, y - .03, .05, 0, TAU); t.fill(); }
  }
  // blocking decor
  for (const d of map.decor) {
    t.fillStyle = 'rgba(0,0,0,.28)'; t.beginPath(); t.ellipse(d.x + .1, d.y + .12, d.s, d.s * .85, 0, 0, TAU); t.fill();
    if (d.kind === 'tree') {
      if (M.theme === 'desert') { t.fillStyle = th.tree[0]; for (let k = 0; k < 5; k++) { t.beginPath(); t.arc(d.x + Math.cos(k * 1.3) * d.s * .4, d.y + Math.sin(k * 1.3) * d.s * .4, d.s * .45, 0, TAU); t.fill(); } }
      else for (let k = 0; k < 3; k++) { t.fillStyle = th.tree[k === 2 ? 1 : k === 1 ? 0 : 2]; t.beginPath(); t.arc(d.x - k * .04, d.y - k * .05, d.s * (1 - k * .25), 0, TAU); t.fill(); }
    } else {
      const n = 6 + Math.floor(d.r * 3); t.fillStyle = th.rock; t.beginPath();
      for (let k = 0; k < n; k++) { const a = k / n * TAU, rr = d.s * (.75 + .3 * Math.sin(k * 2.7 + d.r * 9)); k ? t.lineTo(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr * .85) : t.moveTo(d.x + Math.cos(a) * rr, d.y + Math.sin(a) * rr * .85); }
      t.closePath(); t.fill(); t.fillStyle = 'rgba(255,255,255,.18)'; t.beginPath(); t.ellipse(d.x - d.s * .25, d.y - d.s * .25, d.s * .35, d.s * .22, -.5, 0, TAU); t.fill();
      if (M.theme === 'snow') { t.fillStyle = 'rgba(245,248,250,.85)'; t.beginPath(); t.ellipse(d.x - d.s * .1, d.y - d.s * .2, d.s * .5, d.s * .3, -.3, 0, TAU); t.fill(); }
    }
  }
  // the firebase
  const [bx, by, bw, bh] = M.base;
  t.fillStyle = M.theme === 'snow' ? '#b7bcbf' : '#8b7f62'; t.fillRect(bx + .15, by + .15, bw - .3, bh - .3);
  for (let i = 0; i < 1200; i++) { t.fillStyle = r() < .5 ? 'rgba(0,0,0,.1)' : 'rgba(255,255,255,.06)'; t.fillRect(bx + .15 + r() * (bw - .3), by + .15 + r() * (bh - .3), .04, .04); }
  const hesco = (x, y) => { t.fillStyle = '#a89870'; t.fillRect(x, y, .3, .3); t.strokeStyle = '#5f5640'; t.lineWidth = .025; t.strokeRect(x + .015, y + .015, .27, .27); t.beginPath(); t.moveTo(x + .15, y + .02); t.lineTo(x + .15, y + .28); t.stroke(); };
  for (let x = bx; x < bx + bw - .01; x += .3) { hesco(x, by); hesco(x, by + bh - .3); }
  for (let y = by + .3; y < by + bh - .31; y += .3) { if (Math.abs(y + .15 - (by + bh / 2)) < .5) continue; hesco(bx, y); }
  const tent = (x, y, w, h) => { t.fillStyle = 'rgba(0,0,0,.3)'; t.fillRect(x + .08, y + .1, w, h); t.fillStyle = '#56603e'; t.fillRect(x, y, w, h); t.fillStyle = '#6b7650'; t.fillRect(x, y, w, h / 2); t.strokeStyle = '#3a4129'; t.lineWidth = .03; t.beginPath(); t.moveTo(x, y + h / 2); t.lineTo(x + w, y + h / 2); t.stroke(); };
  tent(bx + .6, by + .55, 1.3, .7); tent(bx + .6, by + bh - 1.3, 1.3, .7);
  t.fillStyle = '#555a52'; t.beginPath(); t.arc(bx + bw - 1.1, by + bh / 2, .62, 0, TAU); t.fill();
  t.strokeStyle = '#e8e4d0'; t.lineWidth = .06; t.beginPath(); t.arc(bx + bw - 1.1, by + bh / 2, .5, 0, TAU); t.stroke();
  t.fillStyle = '#e8e4d0'; const hx = bx + bw - 1.1, hy = by + bh / 2; t.fillRect(hx - .2, hy - .22, .07, .44); t.fillRect(hx + .13, hy - .22, .07, .44); t.fillRect(hx - .2, hy - .035, .4, .07);
  for (let k = 0; k < 4; k++) { t.fillStyle = '#6e6448'; t.fillRect(bx + 2.1, by + 1.6 + k * .22, .45, .18); }
  return c;
}

// =====================================================================
//  GAME STATE
// =====================================================================
const G = {
  demo: true, map: null, mi: 0, mode: 'regular', phase: 'idle', wave: 0, lives: 20, cash: 0, speed: 1, paused: false,
  enemies: [], towers: [], spawnQ: [], waveT: 0, interT: 0, calls: { arty: 0, gun: 0 }, place: null, sel: null, aim: null,
  shake: 0, kills: 0, leaked: 0, spent: 0, earnedWave: 0, eid: 0, t: 0, ground: null, decal: null, maxWave: 25, over: false
};
// enemies are tougher than before because defenses can now be packed tighter, buffed by radar, merged and use abilities
let HPK = 1.4;
const hpScale = n => (1 + .088 * (n - 1) + Math.max(0, n - 25) * .16 + Math.pow(Math.max(0, n - 25), 2) * .004) * G.map.M.diff * (G.mode === 'veteran' ? 1.42 : 1) * HPK;
const tCost = (type, lvl) => Math.round(TOWERS[type].cost[lvl] * (1 - .08 * perk('eng')) / 5) * 5;
const upOf = (tw, k) => (tw.up && tw.up[k]) || 0;
const sumUp = tw => upOf(tw, 'dmg') + upOf(tw, 'rate') + upOf(tw, 'range');
const visLvl = tw => tw.merged ? 2 : sumUp(tw) >= 8 ? 2 : sumUp(tw) >= 4 ? 1 : 0;
function towerStat(tw, k) {
  const D = TOWERS[tw.type], rk = tw.rank || 0, u = upOf(tw, k), el = !!tw.merged;
  if (k === 'dmg') { let m = (1 + UPM.dmg * u) * (1 + .1 * rk) * (el ? 1.9 : 1) * (tw.bD || 1); if (tw.type === 'mg' || tw.type === 'sniper' || tw.type === 'flame') m *= 1 + .08 * perk('gunnery'); if (tw.type === 'at' || tw.type === 'mortar') m *= 1 + .08 * perk('ap'); if (tw.type === 'aa') m *= 1 + .1 * perk('flak'); return D.dmg[0] * m; }
  if (k === 'rate') { let r = D.rate[0] * (1 + UPM.rate * u) * (1 + .05 * rk) * (el ? 1.25 : 1) * (tw.bR || 1); if (tw.abT > 0 && (tw.type === 'mg' || tw.type === 'aa')) r *= 2; return r; }
  if (k === 'range') return D.range[0] * (1 + UPM.range * u) * (el ? 1.15 : 1) * (tw.type === 'aa' ? 1 + .1 * perk('flak') : 1);
  return 0;
}
const upCost = (tw, k) => Math.round(TOWERS[tw.type].cost[0] * PATH_COST[Math.min(PMAX - 1, upOf(tw, k))] * (1 - .08 * perk('eng')) / 5) * 5;
const radarD = r => .12 + .06 * upOf(r, 'dmg') + (r.merged ? .1 : 0);
const radarR = r => .08 + .05 * upOf(r, 'rate') + (r.merged ? .08 : 0);
const abilCd = tw => ABIL[tw.type].cd * (tw.merged ? .7 : 1);
// free placement: anywhere that is not road, base, river, trees, rocks or another defense
function placeErr(x, y, ignore) {
  const M = G.map.M;
  if (x < .45 || y < .45 || x > MW - .45 || y > MH - .45) return 'Too close to the edge';
  const [bx, by, bw, bh] = M.base; if (x > bx - .4 && x < bx + bw + .4 && y > by - .4 && y < by + bh + .4) return "That's the base";
  if (M.river && x > M.river[0] - .35 && x < M.river[1] + .35) return "Can't build in the river";
  for (const P of G.map.lanes) for (const g of P.segs) if (segDist(x, y, g.ax, g.ay, g.bx, g.by) < .92) return "Can't build on the road";
  for (const d of G.map.decor) if (Math.hypot(d.x - x, d.y - y) < d.s + .3) return 'Trees or rocks in the way';
  for (const t of G.towers) if (t !== ignore && Math.hypot(t.x - x, t.y - y) < TR * 2) return 'Too close to another defense';
  return '';
}
function towerAt(x, y) { let best = null, bd = TR + .1; for (const t of G.towers) { const d = Math.hypot(t.x - x, t.y - y); if (d < bd) { bd = d; best = t; } } return best; }
function startOp(mi, mode, demo) {
  G.demo = !!demo; G.mi = mi; G.mode = mode; const M = MAPS[mi];
  G.map = buildMap(M);
  G.enemies = []; G.towers = []; G.spawnQ = []; HAZ.length = 0; G.merge = null; PROJ.forEach(p => { p.on = false; }); PARTS.forEach(p => { p.on = false; }); TXT.forEach(p => { p.on = false; }); FX.length = 0; WRECKS.length = 0;
  G.wave = 0; G.phase = 'build'; G.lives = 20 + 4 * perk('fort'); G.maxLives = G.lives;
  G.cash = (mode === 'veteran' ? 400 : 450) + 60 * perk('supply');
  G.opId = (G.opId || 0) + 1; G.gctx = null; SFX.loops(0, 0);
  G.calls = { arty: 0, gun: 0 }; G.place = null; G.sel = null; G.aim = null; G.speed = demo ? 1 : 1; G.paused = false; G.over = false;
  G.kills = 0; G.leaked = 0; G.maxWave = mode === 'endless' ? 999 : 25; G.t = 0; G.interT = 0;
  layout(); G.ground = null;
  AU.demo = G.demo; AU.duck = 1; applyAudio(); Music.target = 0;
  if (!demo) { hud(true); buildBar(); hudUpdate(); selUpdate(); wavePreview(); }
  BOT.i = 0; BOT.t = 0;
}
function sendWave() {
  if (G.phase === 'wave' && G.spawnQ.length) return;
  if (G.wave >= G.maxWave) return;
  if (G.phase === 'inter' && G.interT > 0 && !G.demo) { const bonus = Math.round(G.interT * 4); if (bonus > 0) { G.cash += bonus; toast('Called early: +' + bonus + ' supply', 'good'); } }
  G.wave++; G.phase = 'wave'; G.waveT = 0; G.earnedWave = 0;
  const def = waveDef(G.wave), lanes = G.map.lanes.length;
  def.forEach(([type, count, gap, delay = 0], gi) => {
    for (let k = 0; k < count; k++) G.spawnQ.push({ at: delay + k * gap, type, lane: lanes > 1 ? (type === 'mbt' ? k % lanes : (gi + k) % lanes) : 0, sq: k });
  });
  G.spawnQ.sort((a, b) => a.at - b.at);
  Music.target = 1;
  if (!G.demo) { SFX.horn(); banner('Wave ' + G.wave + (G.mode === 'endless' ? '' : ' of ' + G.maxWave), waveLabel(def)); hudUpdate(); wavePreview(); coachStep('wave'); }
}
function waveDef(n) {
  if (n <= 25) return WAVES[n - 1];
  const base = WAVES[10 + ((n - 26) % 15)], k = 1 + Math.floor((n - 26) / 15) * .35 + .2;
  return base.map(([t, c, g, d]) => [t, Math.ceil(c * k), g / Math.min(1.6, k), d]);
}
function waveLabel(def) { const has = t => def.some(d => d[0] === t); if (has('mbt')) return 'Heavy armor inbound'; if (has('heli') && has('tank')) return 'Combined assault'; if (has('heli') || has('drone')) return 'Air contacts'; if (has('tank') || has('apc')) return 'Armored column'; if (has('jeep') || has('bike')) return 'Fast movers'; return 'Infantry'; }
function spawn(q) {
  const D = ENEMIES[q.type], hp = D.hp * hpScale(G.wave);
  const e = { id: ++G.eid, type: q.type, D, lane: q.lane, s: 0, off: D.air ? rand(-.5, .5) : q.type === 'rifle' || q.type === 'medic' ? ((q.sq % 3) - 1) * .22 + rand(-.05, .05) : rand(-.06, .06),
    hp, max: hp, sp: D.sp * rand(.95, 1.05), x: -1, y: 0, ang: 0, air: !!D.air, t: Math.random() * 10, healT: 1, turret: 0, hitT: 0, dead: false, fall: 0 };
  const P = e.air ? G.map.air[q.lane] : G.map.lanes[q.lane];
  posAt(P, 0, tmpP); e.x = tmpP.x; e.y = tmpP.y; e.ang = Math.atan2(tmpP.dy, tmpP.dx);
  G.enemies.push(e);
}
function damage(e, amount, dtype, src) {
  if (e.dead) return 0;
  const m = MULT[dtype][e.D.armor]; if (!m) return 0;
  const d = amount * m * (e.markT > 0 ? 1.3 : 1); e.hp -= d; e.hitT = .12;
  if (src && src.towerRef) src.towerRef.dealt = (src.towerRef.dealt || 0) + d;
  if (e.hp <= 0) kill(e, src);
  return d;
}
function kill(e, src) {
  e.dead = true;
  const cash = Math.round(e.D.cash * .74 * (1 + .15 * perk('intel')) * (G.mode === 'veteran' ? .9 : 1));
  G.cash += cash; G.kills++; G.earnedWave += cash;
  if (src && src.towerRef) { const tw = src.towerRef; tw.kills++; const r0 = tw.rank; tw.rank = tw.kills >= 60 ? 3 : tw.kills >= 25 ? 2 : tw.kills >= 8 ? 1 : 0; if (tw.rank > r0 && !G.demo) { floatText(tw.x, tw.y - .5, 'PROMOTED', '#f2b33a'); SFX.upgrade(); } }
  if (!G.demo) floatText(e.x, e.y - .2, '+' + cash, '#f2d27a'), SFX.coin();
  const big = e.type === 'tank' || e.type === 'mbt' || e.type === 'apc' || e.type === 'heli';
  if (e.D.armor === 'soft') { CORPSES.push({ x: e.x, y: e.y, ang: e.ang, t: 0, medic: e.type === 'medic' }); puff(e.x, e.y, 4, 'rgba(120,110,90,.6)'); }
  else if (e.air && e.type === 'heli') { e.dead = false; e.falling = 1.2; e.hp = 0; SFX.boom(e.x, false); explode(e.x, e.y, .5, false); return; }
  else { explode(e.x, e.y, big ? (e.type === 'mbt' ? 1.4 : 1) : .6, big); if (!e.air) wreck(e); if (!G.demo && (e.type === 'tank' || e.type === 'mbt')) G.hitStop = e.type === 'mbt' ? .12 : .045; }
  if (e.type === 'apc') { for (let k = 0; k < 3; k++) { const q = { type: 'rifle', lane: e.lane, sq: k }; spawn(q); const n = G.enemies[G.enemies.length - 1]; n.s = e.s - k * .2; } }
  if (e.type === 'mbt' && !G.demo) toast('Heavy tank destroyed', 'good');
}
function leak(e) {
  e.dead = true; if (G.over) return;
  G.lives = Math.max(0, G.lives - e.D.leak); G.leaked += e.D.leak;
  if (!G.demo) { SFX.alarm(); $('flash').classList.add('on'); setTimeout(() => $('flash').classList.remove('on'), 60); const s = document.querySelector('.stat'); s.classList.remove('hit'); void s.offsetWidth; s.classList.add('hit'); hudUpdate(); }
  if (G.lives <= 0 && !G.over) { G.lives = 0; if (G.demo) { startOp(G.mi, 'regular', true); return; } endOp(false); }
}
function build(type, x, y) {
  const c = tCost(type, 0);
  if (G.cash < c || placeErr(x, y)) return false;
  G.cash -= c;
  const tw = { type, x, y, lvl: 0, up: { dmg: 0, rate: 0, range: 0 }, merged: false, abCd: ABIL[type].cd * .4, abT: 0, sabot: 0, ang: -Math.PI / 2, cd: rand(0, .3), kills: 0, rank: 0, mode: TOWERS[type].mode || (type === 'sniper' ? 'strong' : 'first'), spent: c, flash: 0, recoil: 0, barrel: 0, built: 0 };
  G.towers.push(tw);
  if (!G.demo) { SFX.build(); puff(tw.x, tw.y, 8, 'rgba(160,140,100,.6)'); hudUpdate(); coachStep('built'); }
  return tw;
}
function upgrade(tw, k = 'dmg') {
  if (!tw || upOf(tw, k) >= PMAX) return false; const c = upCost(tw, k); if (G.cash < c) return false;
  G.cash -= c; tw.spent += c; tw.up[k]++; const l0 = tw.lvl; tw.lvl = visLvl(tw); if (tw.lvl > l0) tw.built = 0;
  if (!G.demo) { SFX.upgrade(); puff(tw.x, tw.y, 10, 'rgba(200,190,140,.6)'); floatText(tw.x, tw.y - .5, PATH_NAMES[tw.type][PATHS.findIndex(p => p[0] === k)], '#c9d98a'); if (sumUp(tw) === MERGE_AT && !tw.merged) toast(TOWERS[tw.type].name + ' can now merge with another at tier ' + MERGE_AT, 'good'); hudUpdate(); selUpdate(); }
  return true;
}
const canMerge = (a, b) => !!(a && b && a !== b && a.type === b.type && !a.merged && !b.merged && sumUp(a) >= MERGE_AT && sumUp(b) >= MERGE_AT);
function mergeTowers(a, b) {
  if (!canMerge(a, b)) return false;
  for (const k of ['dmg', 'rate', 'range']) a.up[k] = Math.max(a.up[k], b.up[k]);
  a.merged = true; a.lvl = 2; a.spent += b.spent; a.kills += b.kills; a.rank = Math.max(a.rank, b.rank); a.built = 0; a.abCd = 0;
  FX.push({ kind: 'beam', x0: b.x, y0: b.y, x1: a.x, y1: a.y, t: 0, T: .45 });
  G.towers.splice(G.towers.indexOf(b), 1); if (G.sel === b) G.sel = a;
  if (!G.demo) { SFX.merge(); G.hitStop = .06; G.shake = Math.max(G.shake, 3); floatText(a.x, a.y - .6, 'ELITE', '#f2c84a'); toast(ELITE[a.type] + ' formed', 'good'); }
  for (let i = 0; i < 26; i++) part(a.x, a.y, rand(-2.5, 2.5), rand(-2.5, 2.5), rand(.3, .7), .04, i % 2 ? '#f2c84a' : '#fff2b0', 'spark');
  FX.push({ kind: 'ring', x: a.x, y: a.y, r: 1.6, t: 0, T: .5 }); puff(a.x, a.y, 14, 'rgba(220,200,140,.6)');
  G.merge = null; if (!G.demo) { hudUpdate(); selUpdate(); }
  return true;
}
function denseSpot(tw, R) { let best = null; const minR = TOWERS[tw.type].minR || 0; for (const e of G.enemies) { if (e.dead || e.air || e.falling) continue; const d = Math.hypot(e.x - tw.x, e.y - tw.y); if (d > R || d < minR) continue; let n = 0; for (const o of G.enemies) if (!o.dead && !o.air && Math.hypot(o.x - e.x, o.y - e.y) < 1.2) n += 1 + (o.D.armor === 'heavy' ? 2 : 0); if (!best || n > best.n) best = { e, n }; } return best && best.e; }
function useAbility(tw, auto) {
  if (!tw || tw.abCd > 0 || G.over) return false;
  const A = ABIL[tw.type], D = TOWERS[tw.type], R = towerStat(tw, 'range'), boost = tw.merged ? 1.3 : 1, src = { towerRef: tw };
  const anyIn = () => G.enemies.some(e => !e.dead && !e.falling && Math.hypot(e.x - tw.x, e.y - tw.y) <= R + .3 && (e.air ? D.air || tw.type === 'radar' : D.ground || tw.type === 'radar'));
  const fail = m => { if (!auto && !G.demo) { toast(m, 'bad'); SFX.deny(); } return false; };
  if (tw.type === 'mg' || tw.type === 'aa') { if (auto && !anyIn()) return false; tw.abT = A.dur * boost; }
  else if (tw.type === 'radar') { if (auto && !(G.phase === 'wave' && G.enemies.some(e => !e.dead))) return false; tw.abT = A.dur * boost; }
  else if (tw.type === 'at') { if (auto && !anyIn()) return false; tw.sabot = tw.merged ? 4 : 3; }
  else if (tw.type === 'mortar') {
    const tg = denseSpot(tw, R); if (!tg) return fail('No ground target in range');
    const n = tw.merged ? 9 : 6, dmg = towerStat(tw, 'dmg');
    for (let k = 0; k < n; k++) { const [ax, ay] = predict(tg, 1.25 + k * .22); proj({ kind: 'mortar', x: tw.x, y: tw.y, x0: tw.x, y0: tw.y, tx: ax + rand(-.45, .45), ty: ay + rand(-.45, .45), t: -k * .22, T: 1.25, dmg, splash: 1.05, src, sc: 1.1 }); }
    for (let k = 0; k < 3; k++) setTimeout(() => { if (!G.over) { SFX.mortar(tw.x); puff(tw.x, tw.y, 3, 'rgba(200,200,190,.6)'); } }, k * 400 / G.speed);
  }
  else if (tw.type === 'sniper') {
    const tg = pickTarget(Object.assign({}, tw, { mode: 'strong' }), D, R); if (!tg) return fail('No target in range');
    tw.ang = Math.atan2(tg.y - tw.y, tg.x - tw.x); tw.flash = .1; tw.recoil = 1;
    tracer(tw.x, tw.y, tg.x, tg.y, '#ffe9a8', .2); tg.markT = 8;
    damage(tg, towerStat(tw, 'dmg') * 4.4 * boost, 'sniper', src); spark(tg.x, tg.y, 8); SFX.sniper(tw.x);
    if (!G.demo) floatText(tg.x, tg.y - .45, 'MARKED', '#ffffff');
  }
  else if (tw.type === 'flame') {
    const pts = G.map.samples.filter(p => Math.hypot(p[0] - tw.x, p[1] - tw.y) <= R + .5).sort((a, b) => Math.hypot(a[0] - tw.x, a[1] - tw.y) - Math.hypot(b[0] - tw.x, b[1] - tw.y)).slice(0, tw.merged ? 14 : 10);
    if (!pts.length) return fail('No road in range');
    if (auto && !anyIn()) return false;
    const dps = towerStat(tw, 'dmg') * 5;
    for (const p of pts) HAZ.push({ x: p[0], y: p[1], t: 6 * boost, T: 6 * boost, dps, src });
    SFX.flame(tw.x); SFX.boom(tw.x, false);
  }
  tw.abCd = abilCd(tw);
  FX.push({ kind: 'ring', x: tw.x, y: tw.y, r: .9, t: 0, T: .4, col: '242,179,58' });
  if (!G.demo) { SFX.ability(); floatText(tw.x, tw.y - .6, A.n.toUpperCase(), '#f2b33a'); selUpdate(); }
  return true;
}
const HAZ = [];
function sell(tw) {
  const v = Math.round(tw.spent * (perk('salvage') ? .8 : .6));
  G.cash += v; G.towers.splice(G.towers.indexOf(tw), 1); if (G.sel === tw) G.sel = null;
  SFX.sell(); floatText(tw.x, tw.y, '+' + v, '#f2d27a'); puff(tw.x, tw.y, 8, 'rgba(160,140,100,.6)'); hudUpdate(); selUpdate();
}
function endOp(win) {
  if (G.demo) { startOp(G.mi, 'regular', true); return; }
  const tok = G.opId; SFX.loops(0, 0);
  G.over = true; G.phase = 'over'; Music.target = 0;
  const S = SAVE.maps[G.map.M.id];
  let stars = 0;
  if (win) {
    stars = G.lives >= G.maxLives * .9 ? 3 : G.lives >= G.maxLives * .5 ? 2 : 1;
    if (G.mode === 'regular') S.reg = Math.max(S.reg, stars); else if (G.mode === 'veteran') S.vet = Math.max(S.vet, stars);
  }
  if (G.mode === 'endless') S.endless = Math.max(S.endless, G.wave - (win ? 0 : 1));
  persist();
  setTimeout(() => {
    if (G.opId !== tok || G.demo) return;
    hud(false);
    $('eTitle').textContent = win ? 'Operation complete' : G.mode === 'endless' ? 'Base overrun' : 'Base overrun';
    $('eSub').textContent = G.map.M.name + ' · ' + ({ regular: 'Regular', veteran: 'Veteran', endless: 'Endless' })[G.mode];
    $('eStars').innerHTML = G.mode === 'endless' ? '' : [0, 1, 2].map(i => i < stars ? '<b>★</b>' : '★').join('');
    $('eKV').innerHTML = [['Waves held', (win ? G.wave : G.wave - 1) + (G.mode === 'endless' ? '' : ' / ' + G.maxWave)], ['Enemies destroyed', G.kills], ['Base integrity', G.lives + ' / ' + G.maxLives], ['Stars for Command', starsEarned() - starsSpent() + ' to spend']]
      .concat(G.mode === 'endless' ? [['Best endless wave', S.endless]] : []).map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    const alt = $('eAlt'); alt.classList.add('hide');
    if (win && G.mode === 'regular' && G.mi + 1 < MAPS.length) { alt.textContent = 'Next: ' + MAPS[G.mi + 1].name; alt.classList.remove('hide'); alt.onclick = () => { SFX.ui(); launch(G.mi + 1, 'regular'); }; }
    $('eAgain').textContent = win ? 'Play again' : 'Retry';
    win ? SFX.win() : SFX.lose();
    show('end');
  }, win ? 1200 : 900);
  if (!win) { for (let k = 0; k < 8; k++) setTimeout(() => { const [x, y] = G.map.baseC; explode(x + rand(-1.5, 1.5), y + rand(-1.5, 1.5), 1.2, true); }, k * 110); }
}

// =====================================================================
//  COMBAT
// =====================================================================
const PROJ = []; for (let i = 0; i < 160; i++) PROJ.push({ on: false });
function proj(o) { for (const p of PROJ) if (!p.on) { Object.assign(p, o); p.on = true; return p; } return null; }
function predict(e, t) {
  const P = e.air ? G.map.air[e.lane] : G.map.lanes[e.lane];
  posAt(P, e.s + e.sp * (e.slow || 1) * t, tmpP);
  return [tmpP.x + -tmpP.dy * e.off, tmpP.y + tmpP.dx * e.off];
}
function pickTarget(tw, D, range) {
  let best = null, bv = -1e9;
  const minR = D.minR || 0;
  for (const e of G.enemies) {
    if (e.dead || e.falling) continue;
    if (e.air ? !D.air : !D.ground) continue;
    if (e.x < -.2 || e.x > MW + .2 || e.y < -.2 || e.y > MH + .2) continue;
    const d = Math.hypot(e.x - tw.x, e.y - tw.y);
    if (d > range + e.D.size * .5 || d < minR) continue;
    const v = tw.mode === 'last' ? -e.prog : tw.mode === 'strong' ? e.hp + e.prog * .01 : tw.mode === 'close' ? -d : e.prog;
    if (v > bv) { bv = v; best = e; }
  }
  return best;
}
function fireTower(tw, dt) {
  const D = TOWERS[tw.type];
  tw.flash = Math.max(0, tw.flash - dt); tw.recoil = Math.max(0, tw.recoil - dt * 4); tw.built = Math.min(1, tw.built + dt * 3);
  if (D.support) { tw.ang += dt * (tw.abT > 0 ? 4 : 1.3); return; }
  tw.cd -= dt;
  const range = towerStat(tw, 'range');
  const tgt = pickTarget(tw, D, range);
  if (!tgt) { tw.tgt = null; return; }
  tw.tgt = tgt;
  let aimX = tgt.x, aimY = tgt.y;
  if (tw.type === 'mortar') { [aimX, aimY] = predict(tgt, 1.25); }
  else if (tw.type === 'aa' || tw.type === 'at') { const tt = Math.hypot(tgt.x - tw.x, tgt.y - tw.y) / (tw.type === 'aa' ? 11 : 13); [aimX, aimY] = predict(tgt, tt); }
  const want = Math.atan2(aimY - tw.y, aimX - tw.x);
  tw.ang = angLerp(tw.ang, want, clamp(dt * (tw.type === 'mortar' ? 5 : 12), 0, 1));
  if (tw.cd > 0) return;
  let diff = want - tw.ang; while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU;
  if (Math.abs(diff) > .35 && tw.type !== 'mortar') return;
  tw.cd = 1 / towerStat(tw, 'rate');
  const dmg = towerStat(tw, 'dmg'), mx = tw.x + Math.cos(tw.ang) * .38, my = tw.y + Math.sin(tw.ang) * .38;
  tw.flash = .06; tw.recoil = 1;
  const src = { towerRef: tw };
  if (tw.type === 'mg') {
    const miss = tgt.D.sp > 2 && Math.random() < .15;
    const ex = tgt.x + rand(-.08, .08), ey = tgt.y + rand(-.08, .08);
    tracer(mx, my, ex, ey, tw.lvl === 2 ? '#ffd37a' : '#ffe39a', .07);
    if (!miss) { if (tw.abT > 0 && (tgt.D.armor === 'soft' || tgt.D.armor === 'light')) { tgt.slowT = .7; tgt.slowV = tw.merged ? .5 : .6; } damage(tgt, dmg, 'bullet', src); if (tgt.D.armor === 'soft') puff(ex, ey, 1, 'rgba(140,120,90,.5)'); else { spark(ex, ey, 2); if (tgt.D.armor !== 'air' && Math.random() < .3) SFX.clank(ex); } }
    else puff(ex + rand(-.2, .2), ey + rand(-.2, .2), 1, 'rgba(140,120,90,.5)');
    if (tw.lvl >= 1) tw.barrel = 1 - tw.barrel;
    SFX.mg(tw.x);
  } else if (tw.type === 'at') {
    let dm = dmg; if (tw.sabot > 0) { tw.sabot--; dm *= 3; muzzle(mx, my, tw.ang, .8); }
    if (tw.lvl === 2) { proj({ kind: 'missile', x: mx, y: my, tgt, dmg: dm, sp: 7, ang: tw.ang, life: 3, src, smokeT: 0, ap: dm > dmg }); SFX.missile(tw.x); }
    else { proj({ kind: 'shell', x: mx, y: my, tgt, dmg: dm, sp: 14, ang: tw.ang, life: 1.2, src, ap: dm > dmg }); SFX.at(tw.x); muzzle(mx, my, tw.ang, .5); }
  } else if (tw.type === 'mortar') {
    const T = 1.25, sc = tw.lvl === 2 ? 1.25 : 1;
    proj({ kind: 'mortar', x: tw.x, y: tw.y, x0: tw.x, y0: tw.y, tx: aimX + rand(-.15, .15), ty: aimY + rand(-.15, .15), t: 0, T, dmg, splash: TOWERS.mortar.splash[tw.lvl], src, sc });
    if (tw.lvl === 1 || tw.merged) proj({ kind: 'mortar', x: tw.x, y: tw.y, x0: tw.x, y0: tw.y, tx: aimX + rand(-.4, .4), ty: aimY + rand(-.4, .4), t: -.18, T, dmg: dmg * .6, splash: .8, src, sc });
    SFX.mortar(tw.x); puff(tw.x, tw.y, 3, 'rgba(200,200,190,.6)');
    setTimeout(() => SFX.whistle(aimX, .6), (T - .7) * 1000 / G.speed);
  } else if (tw.type === 'aa') {
    const n = tw.lvl === 2 ? 2 : 1;
    for (let k = 0; k < n; k++) proj({ kind: 'flak', x: mx, y: my, tx: aimX + rand(-.2, .2), ty: aimY + rand(-.2, .2), sp: 11, ang: tw.ang, dmg, splash: TOWERS.aa.splash[tw.lvl] * (tw.abT > 0 ? 1.6 : 1) * (tw.merged ? 1.2 : 1), src, life: 1 });
    tw.barrel = (tw.barrel + 1) % 4; SFX.flak(tw.x); muzzle(mx, my, tw.ang, .3);
  } else if (tw.type === 'sniper') {
    const crit = Math.random() < D.crit;
    tracer(mx, my, tgt.x, tgt.y, '#ffffff', .12);
    const d = damage(tgt, dmg * (crit ? 2.2 : 1), 'sniper', src);
    if (crit && !G.demo && d > 0) floatText(tgt.x, tgt.y - .45, 'CRIT', '#ffffff');
    spark(tgt.x, tgt.y, 3); SFX.sniper(tw.x);
  } else if (tw.type === 'flame') {
    for (const e of G.enemies) {
      if (e.dead || e.air || e.falling) continue;
      const ex = e.x - tw.x, ey = e.y - tw.y, d = Math.hypot(ex, ey); if (d > range + e.D.size * .5) continue;
      let df = Math.atan2(ey, ex) - tw.ang; while (df > Math.PI) df -= TAU; while (df < -Math.PI) df += TAU;
      if (e === tgt || Math.abs(df) < .34) { damage(e, dmg, 'fire', src); e.burnT = 2; e.burnD = dmg * .5 * (tw.merged ? 1.5 : 1); e.burnSrc = src; }
    }
    const reach = Math.min(range, Math.hypot(tgt.x - tw.x, tgt.y - tw.y) + .3), n = SET.low ? 2 : 4;
    for (let i = 0; i < n; i++) { const a = tw.ang + rand(-.22, .22), sp = reach / .3 * rand(.75, 1.05); part(mx, my, Math.cos(a) * sp, Math.sin(a) * sp, rand(.22, .32), rand(.06, .12), i % 2 ? '#ff8a2a' : '#ffc04a', 'fire'); }
    if (Math.random() < .3) part(tgt.x, tgt.y, rand(-.2, .2), rand(-.4, -.1), rand(.5, .9), rand(.08, .13), 'rgba(60,55,50,.3)', 'smoke', 1.4);
    SFX.flame(tw.x);
  }
}
function splashAt(x, y, r, dmg, dtype, src, air) {
  for (const e of G.enemies) {
    if (e.dead || e.falling || (!!e.air !== !!air)) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d <= r + e.D.size * .5) damage(e, dmg * (d < r * .4 ? 1 : .65), dtype, src);
  }
}
function updateProj(dt) {
  for (const p of PROJ) {
    if (!p.on) continue;
    if (p.kind === 'shell' || p.kind === 'missile') {
      const t = p.tgt; p.life -= dt;
      if (t && !t.dead) { const a = Math.atan2(t.y - p.y, t.x - p.x); p.ang = p.kind === 'missile' ? angLerp(p.ang, a, clamp(dt * 6, 0, 1)) : a; }
      p.x += Math.cos(p.ang) * p.sp * dt; p.y += Math.sin(p.ang) * p.sp * dt;
      if (p.kind === 'missile') { p.sp = Math.min(12, p.sp + dt * 10); p.smokeT -= dt; if (p.smokeT <= 0) { p.smokeT = .03; part(p.x, p.y, rand(-.1, .1), rand(-.1, .1), .7, .07, 'rgba(210,210,200,.5)', 'smoke'); } }
      if (t && !t.dead && Math.hypot(t.x - p.x, t.y - p.y) < t.D.size * .6 + .1) {
        damage(t, p.dmg, 'at', p.src); explode(p.x, p.y, (p.kind === 'missile' ? .5 : .35) * (p.ap ? 1.5 : 1), !!p.ap); p.on = false;
      } else if (p.life <= 0 || (t && t.dead && p.kind === 'shell')) { if (p.kind === 'missile' && t && t.dead) { const nt = pickTarget(p.src.towerRef, TOWERS.at, 6); if (nt) { p.tgt = nt; continue; } } explode(p.x, p.y, .25, false); p.on = false; }
    } else if (p.kind === 'mortar') {
      p.t += dt; if (p.t < 0) continue;
      const u = p.t / p.T; p.x = lerp(p.x0, p.tx, u); p.y = lerp(p.y0, p.ty, u); p.h = Math.sin(u * Math.PI);
      if (u >= 1) { splashAt(p.tx, p.ty, p.splash * p.sc, p.dmg, 'he', p.src, false); explode(p.tx, p.ty, .5 * p.sc + .1, false); crater(p.tx, p.ty, .3 * p.sc); p.on = false; }
    } else if (p.kind === 'flak') {
      const d = Math.hypot(p.tx - p.x, p.ty - p.y), st = p.sp * dt;
      if (d <= st) { splashAt(p.tx, p.ty, p.splash, p.dmg, 'flak', p.src, true); flakBurst(p.tx, p.ty); p.on = false; }
      else { p.x += (p.tx - p.x) / d * st; p.y += (p.ty - p.y) / d * st; }
    } else if (p.kind === 'arty') {
      p.t += dt; if (p.t >= p.T) { splashAt(p.x, p.y, .85, 115, 'arty', null, false); explode(p.x, p.y, .8, true); crater(p.x, p.y, .45); p.on = false; }
    } else if (p.kind === 'gunhit') {
      p.t += dt; if (p.t >= 0) { for (const e of G.enemies) { if (e.dead || e.falling) continue; if (Math.hypot(e.x - p.x, e.y - p.y) < .7) damage(e, 95, 'gun', null); } explode(p.x, p.y, .35, false); crater(p.x, p.y, .18); p.on = false; }
    }
  }
}
function callArty(x, y) {
  if (G.calls.arty > 0 || G.wave < CALLS.arty.unlock) return false;
  G.calls.arty = CALLS.arty.cd * (1 - .15 * perk('arty'));
  for (let k = 0; k < 7; k++) { const a = rand(0, TAU), r = Math.sqrt(Math.random()) * 1.5; proj({ kind: 'arty', x: x + Math.cos(a) * r, y: y + Math.sin(a) * r, t: -k * .3, T: 1.4 }); }
  for (const p of PROJ) if (p.on && p.kind === 'arty' && p.t < 0) { p.T = 1.4 - p.t; p.t = 0; }
  FX.push({ kind: 'mark', x, y, r: 1.5, t: 0, T: 3.6 });
  if (!G.demo) { SFX.radio(); setTimeout(() => SFX.whistle(x, 1.1), 400); toast('Artillery inbound', 'good'); }
  return true;
}
function callGun(x, y) {
  if (G.calls.gun > 0 || G.wave < CALLS.gun.unlock) return false;
  // run along the nearest stretch of road
  let best = null, bd = 1e9;
  for (const P of G.map.lanes) for (const g of P.segs) { const d = segDist(x, y, g.ax, g.ay, g.bx, g.by); if (d < bd) { bd = d; best = g; } }
  if (!best || bd > 2.5) { if (!G.demo) { toast('Pick a spot near the road', 'bad'); SFX.deny(); } return false; }
  G.calls.gun = CALLS.gun.cd * (1 - .15 * perk('arty'));
  const dx = best.dx, dy = best.dy;
  let t0 = ((x - best.ax) * dx + (y - best.ay) * dy);
  const px = best.ax + dx * t0, py = best.ay + dy * t0;
  for (let k = 0; k < 18; k++) { const u = -3.5 + k * .42; proj({ kind: 'gunhit', x: px + dx * u + rand(-.2, .2), y: py + dy * u + rand(-.2, .2), t: -.9 - k * .05 }); }
  FX.push({ kind: 'jet', x0: px - dx * 14, y0: py - dy * 14, x1: px + dx * 14, y1: py + dy * 14, t: 0, T: 2 });
  if (!G.demo) { SFX.jet(); setTimeout(() => SFX.brrt(px), 850); toast('Gun run', 'good'); }
  return true;
}

// =====================================================================
//  UPDATE
// =====================================================================
const CORPSES = [], WRECKS = [];
function step(dt) {
  G.t += dt;
  for (const k in G.calls) if (G.calls[k] > 0) G.calls[k] = Math.max(0, G.calls[k] - dt);
  // spawning
  if (G.phase === 'wave') {
    G.waveT += dt;
    while (G.spawnQ.length && G.spawnQ[0].at <= G.waveT) spawn(G.spawnQ.shift());
    if (!G.spawnQ.length && !G.enemies.some(e => !e.dead)) {
      const bonus = 30 + 5 * G.wave;
      G.cash += bonus;
      if (G.wave >= G.maxWave) { endOp(true); return; }
      G.phase = 'inter'; G.interT = 15; Music.target = .25; refreshGround();
      if (!G.demo) { SFX.radio(); toast('Wave ' + G.wave + ' held · +' + bonus + ' supply', 'good'); hudUpdate(); wavePreview(); coachStep('cleared'); }
    }
  } else if (G.phase === 'inter') {
    G.interT -= dt;
    if (G.interT <= 0 && (SET.auto || G.demo)) sendWave();
    else if (G.interT <= 0) G.interT = 0;
  }
  // enemies
  let heli = 0, armor = 0;
  const list = G.enemies;
  for (const e of list) {
    if (G.enemies !== list) return;
    if (e.dead) continue;
    e.t += dt; e.hitT = Math.max(0, e.hitT - dt);
    if (e.falling) { e.falling -= dt; e.ang += dt * 7; e.s += e.sp * dt * .5; if (e.falling <= 0) { e.dead = true; explode(e.x, e.y, 1, true); crater(e.x, e.y, .5); wreck(e); } else { const P = G.map.air[e.lane]; posAt(P, e.s, tmpP); e.x = tmpP.x; e.y = tmpP.y; } continue; }
    if (e.type === 'heli') heli++; if (e.type === 'tank' || e.type === 'mbt' || e.type === 'apc') armor++;
    const P = e.air ? G.map.air[e.lane] : G.map.lanes[e.lane];
    if (e.markT > 0) e.markT -= dt;
    if (e.burnT > 0) { e.burnT -= dt; damage(e, e.burnD * dt, 'fire', e.burnSrc); if (e.dead) continue; if (Math.random() < dt * 6) part(e.x + rand(-.08, .08), e.y + rand(-.08, .08), 0, rand(-.4, -.15), rand(.25, .4), rand(.05, .08), '#ff9a3a', 'fire'); }
    if (e.slowT > 0) { e.slowT -= dt; e.slow = e.slowV || .6; } else e.slow = 1;
    e.s += e.sp * dt * e.slow;
    e.prog = e.s / P.L;
    if (e.s >= P.L) { leak(e); continue; }
    posAt(P, e.s, tmpP);
    const wob = e.air ? Math.sin(e.t * 1.3 + e.id) * .35 : 0;
    const nx = -tmpP.dy, ny = tmpP.dx;
    e.x = tmpP.x + nx * (e.off + wob); e.y = tmpP.y + ny * (e.off + wob);
    e.ang = angLerp(e.ang, Math.atan2(tmpP.dy, tmpP.dx), clamp(dt * (e.air ? 2 : e.D.armor === 'soft' ? 12 : 4), 0, 1));
    if (e.type === 'medic') { e.healT -= dt; if (e.healT <= 0) { e.healT = .5; for (const o of G.enemies) if (!o.dead && o !== e && o.D.armor === 'soft' && o.hp < o.max && Math.hypot(o.x - e.x, o.y - e.y) < 1.3) { o.hp = Math.min(o.max, o.hp + 9 * hpScale(G.wave)); if (Math.random() < .3) part(o.x, o.y - .1, 0, -.4, .6, .05, 'rgba(140,240,150,.9)', 'spark'); } } }
    if (e.type === 'tank' || e.type === 'mbt') { let nt = null, nd = 3.5; for (const tw of G.towers) { const d = Math.hypot(tw.x - e.x, tw.y - e.y); if (d < nd) { nd = d; nt = tw; } } e.turret = angLerp(e.turret, nt ? Math.atan2(nt.y - e.y, nt.x - e.x) : e.ang, clamp(dt * 2, 0, 1)); if (Math.random() < dt * 1.5 && !SET.low) part(e.x - Math.cos(e.ang) * .4, e.y - Math.sin(e.ang) * .4, rand(-.2, .2), rand(-.2, .2), .7, .08, 'rgba(90,90,90,.25)', 'smoke'); }
  }
  if (!G.demo) SFX.loops(heli, armor);
  G.enemies = G.enemies.filter(e => !e.dead || e.falling);
  // radar coverage
  for (const t of G.towers) { t.bD = 1; t.bR = 1; }
  for (const r of G.towers) { if (r.type !== 'radar') continue; const R = towerStat(r, 'range'), bd = 1 + radarD(r), br = (1 + radarR(r)) * (r.abT > 0 ? 1.5 : 1);
    for (const t of G.towers) { if (t.type === 'radar' || Math.hypot(t.x - r.x, t.y - r.y) > R) continue; t.bD = Math.max(t.bD, bd); t.bR = Math.max(t.bR, br); } }
  // towers
  const autoAb = G.demo || SET.autoAb;
  for (const tw of G.towers) {
    if (tw.abCd > 0) tw.abCd = Math.max(0, tw.abCd - dt); if (tw.abT > 0) tw.abT = Math.max(0, tw.abT - dt);
    fireTower(tw, dt);
    if (autoAb && tw.abCd <= 0 && G.phase === 'wave') { tw.autoT = (tw.autoT || 0) - dt; if (tw.autoT <= 0) { tw.autoT = .5; useAbility(tw, true); } }
  }
  // napalm on the road
  for (let i = HAZ.length - 1; i >= 0; i--) { const h = HAZ[i]; h.t -= dt; if (h.t <= 0) { HAZ.splice(i, 1); continue; }
    for (const e of G.enemies) if (!e.dead && !e.air && !e.falling && Math.hypot(e.x - h.x, e.y - h.y) < .62) { damage(e, h.dps * dt, 'fire', h.src); e.burnT = Math.max(e.burnT || 0, 1); e.burnD = e.burnD || h.dps * .1; e.burnSrc = e.burnSrc || h.src; }
    if (Math.random() < dt * (SET.low ? 3 : 7)) part(h.x + rand(-.35, .35), h.y + rand(-.35, .35), rand(-.1, .1), rand(-.5, -.15), rand(.3, .55), rand(.07, .13), Math.random() < .5 ? '#ff8a2a' : '#ffc04a', 'fire'); }
  updateProj(dt);
  updateParts(dt);
  for (const c of CORPSES) c.t += dt; while (CORPSES.length && CORPSES[0].t > 2.2) CORPSES.shift();
  for (let i = FX.length - 1; i >= 0; i--) { FX[i].t += dt; if (FX[i].t > FX[i].T) FX.splice(i, 1); }
  for (const w of WRECKS) w.fire = Math.max(0, w.fire - dt);
  if (G.demo) botStep(dt);
}

// =====================================================================
//  BOT (title screen demo, also used for balance testing)
// =====================================================================
const BOT = { t: 0, i: 0, order: ['mg', 'mg', 'at', 'mortar', 'flame', 'at', 'aa', 'sniper', 'radar', 'at', 'mortar', 'aa', 'mg', 'flame', 'at', 'sniper', 'mortar', 'radar', 'aa', 'at', 'mortar'] };
function coverage(type, x, y) {
  const D = TOWERS[type], R = D.range[0] * (type === 'aa' ? 1 + .1 * perk('flak') : 1); let s = 0;
  if (D.support) { for (const t of G.towers) if (!TOWERS[t.type].support && Math.hypot(t.x - x, t.y - y) <= R) s += 2 + sumUp(t) * .4 + (t.merged ? 3 : 0); return s; }
  const S = type === 'aa' ? G.map.airSamples : G.map.samples;
  for (const p of S) { const d = Math.hypot(p[0] - x, p[1] - y); if (d <= R && d >= (D.minR || 0)) s += .6 + p[2]; }
  if (type === 'sniper' || type === 'mg') for (const p of G.map.airSamples) { const d = Math.hypot(p[0] - x, p[1] - y); if (d <= R) s += .15; }
  return s;
}
function bestTile(type) {
  let best = null, bv = 0;
  for (let y = .5; y < MH; y += .5) for (let x = .5; x < MW; x += .5) {
    if (placeErr(x, y)) continue;
    let v = coverage(type, x, y);
    for (const t of G.towers) if (t.type === type && Math.hypot(t.x - x, t.y - y) < 2) v *= .75;
    if (v > bv) { bv = v; best = [x, y]; }
  }
  return best;
}
function botStep(dt) {
  BOT.t -= dt; if (BOT.t > 0) return; BOT.t = .6;
  if (G.phase === 'build' && G.towers.length >= 2) sendWave();
  if (G.phase === 'inter' && G.interT < 13) sendWave();
  let want = BOT.order[BOT.i % BOT.order.length];
  // read the next wave like a player would: get flak up before air arrives
  const nx = waveDef(Math.min(G.maxWave, G.wave + 1)), airNext = nx.some(d => ENEMIES[d[0]].air), nAA = G.towers.filter(t => t.type === 'aa').length;
  let forced = false;
  if (airNext && nAA < 2 + Math.floor(G.wave / 7)) { want = 'aa'; forced = true; }
  else if (want === 'aa' && G.wave < 6) { BOT.i++; return; }
  const c = tCost(want, 0);
  // merge any two same-type defenses that qualify
  for (const a of G.towers) { const b = G.towers.find(o => canMerge(a, o)); if (b) { mergeTowers(a.kills >= b.kills ? a : b, a.kills >= b.kills ? b : a); return; } }
  const upgradeable = G.towers.filter(t => sumUp(t) < PMAX * 3).sort((a, b) => b.kills - a.kills + (b.type === 'radar' ? 8 : 0) - (a.type === 'radar' ? 8 : 0));
  if (!forced && G.towers.length >= 8 && upgradeable.length && Math.random() < .7) { const u = upgradeable[0]; const k = ['dmg', 'rate', 'dmg', 'range', 'rate', 'dmg', 'rate', 'range', 'dmg', 'rate', 'range', 'range'].find(k => upOf(u, k) < PMAX && upOf(u, k) <= Math.min(upOf(u, 'dmg'), upOf(u, 'rate'), upOf(u, 'range')) + (k === 'dmg' ? 2 : k === 'rate' ? 1 : 0)) || ['dmg', 'rate', 'range'].find(k => upOf(u, k) < PMAX); if (k && G.cash >= upCost(u, k)) upgrade(u, k); return; }
  if (G.cash >= c) { const t = bestTile(want); if (t) { build(want, t[0], t[1]); if (!forced) BOT.i++; } else BOT.i++; }
  // fire support at the thickest cluster
  if (G.calls.arty <= 0 && G.wave >= CALLS.arty.unlock) { const c2 = cluster(); if (c2 && c2.n >= 5) callArty(c2.x, c2.y); }
  if (G.calls.gun <= 0 && G.wave >= CALLS.gun.unlock) { const big = G.enemies.find(e => !e.dead && !e.air && (e.type === 'mbt' || e.type === 'tank') && e.prog > .3); if (big) callGun(big.x, big.y); }
}
function cluster() {
  let best = null;
  for (const e of G.enemies) { if (e.dead || e.air) continue; let n = 0; for (const o of G.enemies) if (!o.dead && !o.air && Math.hypot(o.x - e.x, o.y - e.y) < 1.4) n++; if (!best || n > best.n) best = { x: e.x, y: e.y, n }; }
  return best;
}

// =====================================================================
//  RENDERING
// =====================================================================
const cv = $('cv'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, TS = 40, OX = 0, OY = 0, ROT = 0, topH = 54, botH = 100;
function layout() {
  DPR = Math.min(window.devicePixelRatio || 1, SET.low ? 1 : 2);
  VW = innerWidth; VH = innerHeight; cv.width = Math.round(VW * DPR); cv.height = Math.round(VH * DPR);
  const inMenu = document.body.classList.contains('inmenu');
  topH = inMenu ? 0 : VH < 520 ? 44 : 54; botH = inMenu ? 0 : VH < 520 ? 70 : VW < 900 ? 92 : 104;
  ROT = VH > VW * 1.15 ? 1 : 0;
  const aw = VW, ah = VH - topH - botH;
  if (ROT) { TS = Math.min(aw / MH, ah / MW); OX = (VW - MH * TS) / 2; OY = topH + (ah - MW * TS) / 2; }
  else { TS = Math.min(aw / MW, ah / MH); OX = (VW - MW * TS) / 2; OY = topH + (ah - MH * TS) / 2; }
  if (inMenu) { TS = Math.max(VW / MW, VH / MH); OX = (VW - MW * TS) / 2; OY = (VH - MH * TS) / 2; ROT = 0; }
  G.ground = null;
}
window.addEventListener('resize', layout);
function setW() {
  const s = TS * DPR, sx = SET.shake && G.shake > 0 ? rand(-1, 1) * G.shake : 0, sy = SET.shake && G.shake > 0 ? rand(-1, 1) * G.shake : 0;
  if (ROT) ctx.setTransform(0, s, -s, 0, (OX + MH * TS + sx) * DPR, (OY + sy) * DPR);
  else ctx.setTransform(s, 0, 0, s, (OX + sx) * DPR, (OY + sy) * DPR);
}
const w2s = (x, y) => ROT ? [OX + (MH - y) * TS, OY + x * TS] : [OX + x * TS, OY + y * TS];
const s2w = (sx, sy) => ROT ? [(sy - OY) / TS, MH - (sx - OX) / TS] : [(sx - OX) / TS, (sy - OY) / TS];
function ensureGround() {
  if (G.ground) return;
  const T = Math.min(SET.low ? 64 : 96, Math.round(TS * DPR));
  G.groundBase = buildGround(G.map, T);
  G.ground = document.createElement('canvas'); G.ground.width = G.groundBase.width; G.ground.height = G.groundBase.height;
  G.gctx = G.ground.getContext('2d'); G.gctx.drawImage(G.groundBase, 0, 0); G.gT = T;
  for (const w of WRECKS) drawWreckDecal(w);
}
function crater(x, y, r) {
  if (!G.gctx) return; const t = G.gctx, T = G.gT;
  t.save(); t.setTransform(T, 0, 0, T, 0, 0);
  const g = t.createRadialGradient(x, y, 0, x, y, r * 1.6); g.addColorStop(0, 'rgba(25,20,15,.34)'); g.addColorStop(.55, 'rgba(40,32,22,.18)'); g.addColorStop(1, 'rgba(40,32,22,0)');
  t.fillStyle = g; t.beginPath(); t.arc(x, y, r * 1.6, 0, TAU); t.fill(); t.restore();
}
function wreck(e) { const w = { x: e.x, y: e.y, ang: e.ang, type: e.type, fire: 2.5 }; WRECKS.push(w); if (WRECKS.length > 14) WRECKS.shift(); drawWreckDecal(w); }
// after each wave the field is cleared down to the most recent wrecks so the road stays readable
function refreshGround() { if (!G.gctx) return; G.gctx.setTransform(1, 0, 0, 1, 0, 0); G.gctx.drawImage(G.groundBase, 0, 0); for (const w of WRECKS.slice(-8)) drawWreckDecal(w); }
function drawWreckDecal(w) {
  if (!G.gctx) return; const t = G.gctx, T = G.gT;
  t.save(); t.setTransform(T, 0, 0, T, 0, 0); t.translate(w.x, w.y); t.rotate(w.ang);
  const L = w.type === 'mbt' ? .95 : w.type === 'tank' ? .75 : w.type === 'apc' ? .7 : w.type === 'heli' ? .8 : .5, Wd = L * .55;
  t.globalAlpha = .7; t.fillStyle = 'rgba(15,12,10,.35)'; t.beginPath(); t.ellipse(0, 0, L * .8, Wd * .9, 0, 0, TAU); t.fill();
  t.fillStyle = '#2a2622'; t.fillRect(-L / 2, -Wd / 2, L, Wd); t.fillStyle = '#3a342d'; t.fillRect(-L / 2 + .05, -Wd / 2 + .05, L * .6, Wd - .1);
  if (w.type === 'tank' || w.type === 'mbt') { t.fillStyle = '#1f1c19'; t.beginPath(); t.arc(-.05, .05, Wd * .38, 0, TAU); t.fill(); t.strokeStyle = '#1f1c19'; t.lineWidth = .07; t.beginPath(); t.moveTo(0, 0); t.lineTo(L * .6, -.15); t.stroke(); }
  t.restore();
}
// ---------- particles & fx
const PARTS = []; for (let i = 0; i < 420; i++) PARTS.push({ on: false });
function part(x, y, vx, vy, life, size, col, kind, grow = 1) {
  if (SET.low && (kind === 'smoke' || kind === 'dust') && Math.random() < .55) return;
  for (const p of PARTS) if (!p.on) { p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.size = size; p.col = col; p.kind = kind; p.grow = grow; return; }
}
function updateParts(dt) { for (const p of PARTS) { if (!p.on) continue; p.life -= dt; if (p.life <= 0) { p.on = false; continue; } p.x += p.vx * dt; p.y += p.vy * dt; const f = Math.exp(-(p.kind === 'debris' ? 2 : 1.5) * dt); p.vx *= f; p.vy *= f; } }
function puff(x, y, n, col) { for (let i = 0; i < n; i++) part(x + rand(-.08, .08), y + rand(-.08, .08), rand(-.5, .5), rand(-.5, .5), rand(.4, .8), rand(.05, .1), col, 'dust'); }
function spark(x, y, n) { for (let i = 0; i < n; i++) part(x, y, rand(-2.5, 2.5), rand(-2.5, 2.5), rand(.1, .25), .03, '#ffd27a', 'spark'); }
function muzzle(x, y, a, s) { FX.push({ kind: 'muzzle', x, y, a, s, t: 0, T: .07 }); }
function tracer(x0, y0, x1, y1, col, T) { FX.push({ kind: 'tracer', x0, y0, x1, y1, col, t: 0, T }); }
function flakBurst(x, y) { part(x, y, 0, 0, .7, .16, 'rgba(60,60,60,.75)', 'smoke', 2.2); FX.push({ kind: 'flash', x, y, r: .25, t: 0, T: .08 }); SFX.burst(x); }
function explode(x, y, s, big) {
  FX.push({ kind: 'flash', x, y, r: s * .9, t: 0, T: .12 }); FX.push({ kind: 'ring', x, y, r: s * 1.4, t: 0, T: .35 });
  const n = Math.round((SET.low ? 6 : 14) * s);
  for (let i = 0; i < n; i++) part(x, y, rand(-2, 2) * s, rand(-2, 2) * s, rand(.25, .5), rand(.08, .16) * s, i % 2 ? '#ffb347' : '#ff7a2a', 'fire');
  for (let i = 0; i < n * .7; i++) part(x + rand(-.1, .1), y + rand(-.1, .1), rand(-.6, .6), rand(-.6, .6), rand(.8, 1.5), rand(.1, .18) * s, i % 3 ? 'rgba(95,90,82,.32)' : 'rgba(130,122,110,.3)', 'smoke', 1.5);
  for (let i = 0; i < n * .6; i++) part(x, y, rand(-3, 3) * s, rand(-3, 3) * s, rand(.3, .6), .04, '#2a2622', 'debris');
  if (big) G.shake = Math.max(G.shake, 4 * s); SFX.boom(x, big);
}
const FX = [];
const TXT = []; for (let i = 0; i < 40; i++) TXT.push({ on: false });
function floatText(x, y, s, col) { for (const p of TXT) if (!p.on) { p.on = true; p.x = x; p.y = y; p.s = s; p.col = col; p.t = 0; return; } }

// ---------- drawing primitives
function sandbags(t, r, n, col) {
  for (let i = 0; i < n; i++) { const a = i / n * TAU; t.save(); t.rotate(a); t.translate(r, 0); t.fillStyle = col; t.beginPath(); t.roundRect ? t.roundRect(-.07, -.11, .14, .22, .05) : t.rect(-.07, -.11, .14, .22); t.fill(); t.strokeStyle = 'rgba(0,0,0,.35)'; t.lineWidth = .015; t.stroke(); t.restore(); }
}
function drawTower(t, tw, alpha = 1) {
  const L = tw.lvl, k = (.7 + .3 * (tw.built === undefined ? 1 : ease(tw.built))) * (tw.merged ? 1.08 : 1);
  t.save(); t.translate(tw.x, tw.y); t.globalAlpha = alpha; t.scale(k, k);
  t.fillStyle = 'rgba(0,0,0,.3)'; t.beginPath(); t.arc(.05, .07, .44, 0, TAU); t.fill();
  if (tw.merged) { t.fillStyle = 'rgba(242,200,74,.16)'; t.beginPath(); t.arc(0, 0, .5, 0, TAU); t.fill(); t.strokeStyle = '#d8b04a'; t.lineWidth = .045; t.beginPath(); t.arc(0, 0, .46, 0, TAU); t.stroke(); }
  if (tw.type === 'flame') {
    t.fillStyle = '#4d4a44'; t.beginPath(); t.roundRect ? t.roundRect(-.37, -.37, .74, .74, .14) : t.rect(-.37, -.37, .74, .74); t.fill();
    t.fillStyle = '#5f5b53'; t.beginPath(); t.roundRect ? t.roundRect(-.3, -.3, .6, .6, .1) : t.rect(-.3, -.3, .6, .6); t.fill();
    t.fillStyle = 'rgba(255,255,255,.07)'; t.fillRect(-.3, -.3, .6, .1); t.strokeStyle = 'rgba(0,0,0,.35)'; t.lineWidth = .02; t.strokeRect(-.3, -.3, .6, .6);
  } else if (tw.type === 'sniper') {
    t.fillStyle = '#5b4630'; t.fillRect(-.36, -.36, .72, .72); t.strokeStyle = '#3d2f20'; t.lineWidth = .03;
    for (let i = 0; i < 5; i++) { t.beginPath(); t.moveTo(-.36, -.36 + i * .18); t.lineTo(.36, -.36 + i * .18); t.stroke(); }
    t.fillStyle = 'rgba(70,90,50,.8)'; for (let i = 0; i < 7; i++) { t.beginPath(); t.arc(-.25 + (i % 3) * .25, -.25 + Math.floor(i / 3) * .25, .12, 0, TAU); t.fill(); }
  } else {
    t.fillStyle = tw.type === 'mortar' ? '#3b3528' : '#4a4334'; t.beginPath(); t.arc(0, 0, .36, 0, TAU); t.fill();
    sandbags(t, .34, L === 2 ? 13 : 11, L === 2 ? '#c2b081' : '#b3a275');
    if (L >= 1) sandbags(t, .2, 0, '#b3a275');
  }
  t.rotate(tw.ang);
  const rc = -tw.recoil * .05;
  if (tw.type === 'mg') {
    t.fillStyle = '#2b2b28';
    if (L === 0) t.fillRect(rc, -.025, .38, .05);
    else { t.fillRect(rc, -.07, .38, .045); t.fillRect(rc, .025, .38, .045); }
    if (L === 2) { t.fillStyle = '#5a5a4e'; t.fillRect(.02, -.15, .06, .3); t.fillStyle = '#2b2b28'; t.fillRect(rc, -.035, .46, .07); }
    t.fillStyle = '#4b5634'; t.beginPath(); t.arc(-.08, 0, .11, 0, TAU); t.fill(); t.fillStyle = '#5f6b42'; t.beginPath(); t.arc(-.1, -.02, .06, 0, TAU); t.fill();
  } else if (tw.type === 'at') {
    if (L === 2) {
      t.fillStyle = '#4e5638'; t.fillRect(-.12, -.14, .36, .28); t.fillStyle = '#2d3122'; t.fillRect(.1 + rc, -.1, .22, .08); t.fillRect(.1 + rc, .02, .22, .08);
      t.fillStyle = '#c94c2f'; t.fillRect(.3 + rc, -.09, .03, .06); t.fillRect(.3 + rc, .03, .03, .06);
    } else {
      t.fillStyle = '#2c2f26'; t.fillRect(-.12, -.24, .08, .14); t.fillRect(-.12, .1, .08, .14);
      t.fillStyle = '#5a6142'; t.beginPath(); t.moveTo(.05, -.2); t.lineTo(.12, -.18); t.lineTo(.12, .18); t.lineTo(.05, .2); t.fill();
      t.fillStyle = '#33372b'; t.fillRect(.05 + rc, -.035, L === 1 ? .5 : .42, .07); t.fillRect(-.22, -.05, .3, .1);
      t.fillStyle = '#222'; t.fillRect((L === 1 ? .52 : .44) + rc, -.05, .05, .1);
    }
  } else if (tw.type === 'mortar') {
    const n = L === 1 ? 2 : 1, R = L === 2 ? .12 : .09;
    for (let i = 0; i < n; i++) { const oy = n === 2 ? (i ? .1 : -.1) : 0; t.fillStyle = '#26281f'; t.beginPath(); t.arc(.06, oy, R, 0, TAU); t.fill(); t.fillStyle = '#4a4f3a'; t.beginPath(); t.arc(.06, oy, R * .7, 0, TAU); t.fill(); t.fillStyle = '#111'; t.beginPath(); t.arc(.06 + R * .2, oy, R * .4, 0, TAU); t.fill(); }
    t.fillStyle = '#6b5b3a'; t.fillRect(-.26, -.2, .14, .1); t.fillRect(-.26, .1, .14, .1);
  } else if (tw.type === 'aa') {
    t.fillStyle = '#4c5537'; t.beginPath(); t.arc(0, 0, .17, 0, TAU); t.fill();
    const n = L === 0 ? 2 : 4;
    t.fillStyle = '#2b2d26';
    for (let i = 0; i < n; i++) { const oy = (i - (n - 1) / 2) * .07, rr = (tw.barrel === i ? rc * 2 : 0); t.fillRect(.05 + rr, oy - .018, .42, .036); }
    if (L === 2) { t.fillStyle = '#9aa08a'; t.beginPath(); t.ellipse(-.14, 0, .05, .12, 0, 0, TAU); t.fill(); }
  } else if (tw.type === 'sniper') {
    t.fillStyle = '#3d4a2c'; t.beginPath(); t.ellipse(-.06, 0, .16, .11, 0, 0, TAU); t.fill();
    t.fillStyle = '#1c1c1a'; t.fillRect(rc, -.015, L === 2 ? .55 : .46, .03); t.fillStyle = '#333'; t.fillRect(.08, -.03, .1, .06);
  } else if (tw.type === 'flame') {
    t.fillStyle = '#7a3b26'; t.beginPath(); t.arc(-.13, -.09, .08, 0, TAU); t.fill(); t.beginPath(); t.arc(-.13, .09, .08, 0, TAU); t.fill();
    t.fillStyle = 'rgba(255,255,255,.15)'; t.beginPath(); t.arc(-.15, -.11, .03, 0, TAU); t.fill(); t.beginPath(); t.arc(-.15, .07, .03, 0, TAU); t.fill();
    t.fillStyle = '#2a2a26'; const n = L >= 1 ? 2 : 1; for (let i = 0; i < n; i++) { const oy = n === 2 ? (i ? .05 : -.05) : 0; t.fillRect(-.04 + rc, oy - .028, L === 2 ? .44 : .38, .056); }
    const fl = .5 + .5 * Math.sin(G.t * 31 + tw.x * 7); t.globalCompositeOperation = 'lighter'; t.fillStyle = `rgba(255,${150 + fl * 60},60,.85)`; t.beginPath(); t.arc(L === 2 ? .42 : .36, 0, .035 + fl * .015, 0, TAU); t.fill(); t.globalCompositeOperation = 'source-over';
  } else if (tw.type === 'radar') {
    t.fillStyle = '#3c4331'; t.fillRect(-.04, -.04, .08, .08);
    t.fillStyle = '#c9cdbf'; t.beginPath(); t.ellipse(.04, 0, .07, L === 2 ? .3 : .25, 0, 0, TAU); t.fill();
    t.fillStyle = '#9da291'; t.beginPath(); t.ellipse(.07, 0, .04, L === 2 ? .24 : .2, 0, 0, TAU); t.fill();
    t.strokeStyle = '#2b2d26'; t.lineWidth = .025; t.beginPath(); t.moveTo(.04, 0); t.lineTo(.2, 0); t.stroke();
    if (L >= 1) { t.fillStyle = '#e0533f'; t.beginPath(); t.arc(-.08, 0, .025, 0, TAU); t.fill(); }
  }
  if (tw.flash > 0 && tw.type !== 'mortar' && tw.type !== 'flame' && tw.type !== 'radar') { t.globalCompositeOperation = 'lighter'; const len = tw.type === 'mg' ? (L === 2 ? .47 : .39) : tw.type === 'at' ? .57 : tw.type === 'sniper' ? .56 : .48; const g = t.createRadialGradient(len, 0, 0, len, 0, .14); g.addColorStop(0, 'rgba(255,240,180,.95)'); g.addColorStop(1, 'rgba(255,150,40,0)'); t.fillStyle = g; t.beginPath(); t.arc(len, 0, .14, 0, TAU); t.fill(); t.globalCompositeOperation = 'source-over'; }
  t.restore();
  if (tw.merged) { t.save(); t.translate(tw.x - .3, tw.y - .32); t.fillStyle = '#f2c84a'; t.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU - Math.PI / 2, rr = i % 2 ? .04 : .095; t.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } t.closePath(); t.fill(); t.restore(); }
  // rank chevrons
  if (tw.rank) { t.save(); t.translate(tw.x + .3, tw.y - .3); t.strokeStyle = '#f2b33a'; t.lineWidth = .04; for (let i = 0; i < tw.rank; i++) { t.beginPath(); t.moveTo(-.07, .04 + i * .07); t.lineTo(0, i * .07); t.lineTo(.07, .04 + i * .07); t.stroke(); } t.restore(); }
  t.globalAlpha = 1;
}
const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
const ENEMY_COL = { body: '#565b52', dark: '#3a3e38', sand: '#9a8c66', armor: '#5d634f' };
function drawEnemy(t, e) {
  const D = e.D, s = D.size;
  t.save(); t.translate(e.x, e.y);
  if (e.air) { t.save(); t.translate(.35, .45); t.rotate(e.ang); t.fillStyle = 'rgba(0,0,0,.25)'; t.beginPath(); t.ellipse(0, 0, s * 1.1, s * .5, 0, 0, TAU); t.fill(); t.restore(); }
  else { t.fillStyle = 'rgba(0,0,0,.28)'; t.beginPath(); t.ellipse(.04, .05, s * 1.2, s * .9, e.ang, 0, TAU); t.fill(); }
  t.rotate(e.ang);
  const hit = e.hitT > 0;
  if (e.type === 'rifle' || e.type === 'medic') {
    const step = Math.sin(e.t * 9) * .04;
    t.fillStyle = '#2a2b27'; t.fillRect(-.02 + step, .03, .09, .035); t.fillRect(-.02 - step, -.065, .09, .035);
    t.fillStyle = hit ? '#d8d0c0' : e.type === 'medic' ? '#6a6d60' : ENEMY_COL.body; t.beginPath(); t.ellipse(0, 0, .07, .11, 0, 0, TAU); t.fill();
    if (e.type === 'medic') { t.fillStyle = '#c9c7bc'; t.fillRect(-.09, -.05, .06, .1); }
    t.strokeStyle = '#111'; t.lineWidth = .025; t.beginPath(); t.moveTo(.02, .06); t.lineTo(.17, .05); t.stroke();
    t.fillStyle = e.type === 'medic' ? '#e9e6da' : '#454a3e'; t.beginPath(); t.arc(.01, 0, .055, 0, TAU); t.fill();
  } else if (e.type === 'bike') {
    t.fillStyle = '#1b1b1b'; t.fillRect(-.2, -.025, .4, .05);
    t.fillStyle = hit ? '#ddd' : '#6e6a5c'; t.fillRect(-.12, -.05, .24, .1);
    t.fillStyle = ENEMY_COL.body; t.beginPath(); t.ellipse(-.03, 0, .07, .09, 0, 0, TAU); t.fill();
    t.fillStyle = '#2f302b'; t.beginPath(); t.arc(-.02, 0, .05, 0, TAU); t.fill();
  } else if (e.type === 'jeep') {
    t.fillStyle = '#151515'; for (const [x, y] of [[-.18, -.15], [.15, -.15], [-.18, .15], [.15, .15]]) t.fillRect(x - .06, y - .03, .12, .06);
    t.fillStyle = hit ? '#e2dccb' : ENEMY_COL.sand; t.beginPath(); t.roundRect ? t.roundRect(-.28, -.14, .56, .28, .05) : t.rect(-.28, -.14, .56, .28); t.fill();
    t.fillStyle = 'rgba(0,0,0,.25)'; t.fillRect(-.28, -.14, .22, .28);
    t.fillStyle = '#26313a'; t.fillRect(.04, -.11, .08, .22);
    t.fillStyle = '#2a2a27'; t.save(); t.translate(-.14, 0); t.rotate(Math.sin(e.t * .7) * .6); t.fillRect(0, -.02, .22, .04); t.beginPath(); t.arc(0, 0, .05, 0, TAU); t.fill(); t.restore();
  } else if (e.type === 'apc') {
    t.fillStyle = '#1a1a18'; for (let i = 0; i < 4; i++) { t.fillRect(-.27 + i * .17, -.21, .1, .05); t.fillRect(-.27 + i * .17, .16, .1, .05); }
    t.fillStyle = hit ? '#e2dccb' : ENEMY_COL.armor; t.beginPath(); t.moveTo(-.34, -.18); t.lineTo(.24, -.18); t.lineTo(.36, -.08); t.lineTo(.36, .08); t.lineTo(.24, .18); t.lineTo(-.34, .18); t.closePath(); t.fill();
    t.fillStyle = 'rgba(255,255,255,.08)'; t.fillRect(-.3, -.15, .5, .08);
    t.fillStyle = ENEMY_COL.dark; t.beginPath(); t.arc(-.02, 0, .1, 0, TAU); t.fill(); t.fillRect(0, -.02, .24, .04);
  } else if (e.type === 'tank' || e.type === 'mbt') {
    const k = e.type === 'mbt' ? 1.25 : 1;
    t.scale(k, k);
    t.fillStyle = '#1d1d1b'; t.fillRect(-.38, -.25, .76, .11); t.fillRect(-.38, .14, .76, .11);
    t.fillStyle = '#3a3a35'; const off = (e.t * e.sp * 2) % .1;
    for (let x = -.38 + off; x < .38; x += .1) { t.fillRect(x, -.25, .04, .11); t.fillRect(x, .14, .04, .11); }
    t.fillStyle = hit ? '#e2dccb' : e.type === 'mbt' ? '#4b4f3e' : '#676b55'; t.fillRect(-.36, -.16, .72, .32);
    t.fillStyle = 'rgba(0,0,0,.2)'; t.fillRect(-.36, .05, .72, .11);
    if (e.type === 'mbt') { t.fillStyle = '#3c3f31'; for (let i = 0; i < 5; i++) { t.fillRect(-.3 + i * .13, -.17, .1, .05); t.fillRect(-.3 + i * .13, .12, .1, .05); } }
    t.rotate(e.turret - e.ang);
    t.fillStyle = hit ? '#d0cab8' : e.type === 'mbt' ? '#3f4334' : '#585c48'; t.beginPath(); t.roundRect ? t.roundRect(-.16, -.13, .3, .26, .06) : t.rect(-.16, -.13, .3, .26); t.fill();
    t.fillStyle = '#2b2d24'; t.fillRect(.12, -.025, .42, .05); t.fillRect(.5, -.035, .06, .07);
    t.fillStyle = 'rgba(255,255,255,.1)'; t.beginPath(); t.arc(-.05, -.05, .05, 0, TAU); t.fill();
  } else if (e.type === 'heli') {
    t.fillStyle = hit ? '#dcd6c6' : '#4f5648'; t.beginPath(); t.ellipse(.05, 0, .26, .12, 0, 0, TAU); t.fill();
    t.fillRect(-.45, -.03, .45, .06); t.fillRect(-.48, -.1, .06, .2);
    t.fillStyle = '#24313a'; t.beginPath(); t.ellipse(.2, 0, .08, .07, 0, 0, TAU); t.fill();
    t.fillStyle = '#2a2d26'; t.fillRect(-.05, -.17, .14, .04); t.fillRect(-.05, .13, .14, .04);
    t.rotate(e.t * 30); t.strokeStyle = 'rgba(30,30,30,.55)'; t.lineWidth = .025; t.beginPath(); t.moveTo(-.45, 0); t.lineTo(.45, 0); t.moveTo(0, -.45); t.lineTo(0, .45); t.stroke();
    t.fillStyle = 'rgba(40,40,40,.12)'; t.beginPath(); t.arc(0, 0, .45, 0, TAU); t.fill();
  } else if (e.type === 'drone') {
    t.strokeStyle = '#2a2a2a'; t.lineWidth = .025; t.beginPath(); t.moveTo(-.1, -.1); t.lineTo(.1, .1); t.moveTo(.1, -.1); t.lineTo(-.1, .1); t.stroke();
    t.fillStyle = hit ? '#eee' : '#3c3f3a'; t.fillRect(-.04, -.04, .08, .08);
    t.fillStyle = 'rgba(60,60,60,.35)'; for (const [x, y] of [[-.1, -.1], [.1, .1], [.1, -.1], [-.1, .1]]) { t.beginPath(); t.arc(x, y, .06, 0, TAU); t.fill(); }
    t.fillStyle = '#e0533f'; t.fillRect(.03, -.01, .02, .02);
  }
  t.restore();
  // health bar
  if (e.hp < e.max && !e.falling) {
    const w = Math.max(.3, s * 1.6), y = e.y - s - .12;
    t.fillStyle = 'rgba(0,0,0,.6)'; t.fillRect(e.x - w / 2 - .01, y - .01, w + .02, .07);
    const f = clamp(e.hp / e.max, 0, 1); t.fillStyle = f > .5 ? '#8fd16a' : f > .25 ? '#f2b33a' : '#e0533f'; t.fillRect(e.x - w / 2, y, w * f, .05);
  }
}
function drawBaseFlag(t) {
  const [bx, by] = G.map.M.base, x = bx + 2.7, y = by + .5, tm = G.t;
  t.fillStyle = '#ccc'; t.fillRect(x - .02, y - .02, .04, .04);
  t.fillStyle = '#5f6b42'; t.beginPath(); t.moveTo(x, y);
  for (let k = 0; k <= 5; k++) t.lineTo(x + k * .1, y - .02 + Math.sin(tm * 5 - k) * .03);
  for (let k = 5; k >= 0; k--) t.lineTo(x + k * .1, y + .2 + Math.sin(tm * 5 - k) * .03);
  t.fill();
}
function render(dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#0e100c'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!G.map) return;
  ensureGround();
  setW();
  ctx.drawImage(G.ground, 0, 0, MW, MH);
  drawBaseFlag(ctx);
  // burning wrecks
  for (const w of WRECKS) if (w.fire > 0 && Math.random() < .14) part(w.x + rand(-.1, .1), w.y + rand(-.1, .1), rand(-.1, .1), rand(-.25, -.05), rand(.6, 1.1), rand(.07, .12), Math.random() < .35 ? 'rgba(255,140,40,.55)' : 'rgba(70,66,60,.3)', 'smoke', 1.4);
  // fallen infantry
  for (const c of CORPSES) { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.ang + 1.3); ctx.globalAlpha = clamp(1 - (c.t - 1.4) / .8, 0, 1) * .8; ctx.fillStyle = c.medic ? '#6a6d60' : '#4a4e46'; ctx.fillRect(-.12, -.05, .24, .1); ctx.fillStyle = '#3a3e36'; ctx.beginPath(); ctx.arc(.13, 0, .05, 0, TAU); ctx.fill(); ctx.restore(); }
  ctx.globalAlpha = 1;
  // napalm
  for (const h of HAZ) { const a = clamp(h.t / .6, 0, 1) * clamp((h.T - h.t) / .25, 0, 1); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(h.x, h.y, 0, h.x, h.y, .7); g.addColorStop(0, `rgba(255,140,40,${.55 * a})`); g.addColorStop(1, 'rgba(255,60,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, .7, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
  // no-build areas while placing (no grid: build anywhere that isn't shaded)
  const placing = G.place && !G.demo;
  if (placing) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, MW, MH); ctx.clip(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(224,83,63,.16)'; ctx.lineWidth = 1.84;
    for (const P of G.map.lanes) { ctx.beginPath(); P.pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke(); }
    ctx.fillStyle = 'rgba(224,83,63,.14)'; const [bx, by, bw, bh] = G.map.M.base; ctx.fillRect(bx - .4, by - .4, bw + .8, bh + .8);
    if (G.map.M.river) ctx.fillRect(G.map.M.river[0] - .35, 0, G.map.M.river[1] - G.map.M.river[0] + .7, MH);
    for (const d of G.map.decor) { ctx.beginPath(); ctx.arc(d.x, d.y, d.s + .3, 0, TAU); ctx.fill(); }
    for (const t of G.towers) { if (SET.ranges && !TOWERS[t.type].support) { ctx.strokeStyle = 'rgba(169,184,102,.18)'; ctx.lineWidth = .03; ctx.beginPath(); ctx.arc(t.x, t.y, towerStat(t, 'range'), 0, TAU); ctx.stroke(); } ctx.fillStyle = 'rgba(224,83,63,.12)'; ctx.beginPath(); ctx.arc(t.x, t.y, TR * 2, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // ground enemies
  for (const e of G.enemies) if (!e.air) drawEnemy(ctx, e);
  // towers
  for (const tw of G.towers) drawTower(ctx, tw);
  // ability state markers, radar links, merge partners
  if (!G.demo) for (const tw of G.towers) {
    if (tw.abT > 0 || tw.sabot > 0) { ctx.strokeStyle = `rgba(242,179,58,${.45 + .35 * Math.sin(G.t * 10)})`; ctx.lineWidth = .05; ctx.beginPath(); ctx.arc(tw.x, tw.y, .5, 0, TAU); ctx.stroke(); }
    else if (tw.abCd <= 0) { const p = .6 + .4 * Math.sin(G.t * 5 + tw.x); ctx.fillStyle = `rgba(242,179,58,${p})`; ctx.beginPath(); ctx.moveTo(tw.x + .3, tw.y + .22); ctx.lineTo(tw.x + .37, tw.y + .3); ctx.lineTo(tw.x + .3, tw.y + .38); ctx.lineTo(tw.x + .23, tw.y + .3); ctx.closePath(); ctx.fill(); }
    if (tw.bR > 1 && tw.type !== 'radar') { ctx.strokeStyle = 'rgba(120,200,255,.7)'; ctx.lineWidth = .025; ctx.beginPath(); ctx.arc(tw.x - .3, tw.y + .3, .05, -1.2, 1.2); ctx.stroke(); ctx.beginPath(); ctx.arc(tw.x - .3, tw.y + .3, .09, -1.2, 1.2); ctx.stroke(); }
  }
  if (G.merge && !G.demo) for (const tw of G.towers) if (canMerge(G.merge, tw)) { ctx.strokeStyle = `rgba(242,200,74,${.5 + .4 * Math.sin(G.t * 8)})`; ctx.lineWidth = .07; ctx.setLineDash([.15, .1]); ctx.beginPath(); ctx.arc(tw.x, tw.y, .55, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  // selected / hover range
  const hovT = G.hoverW && !placing ? towerAt(G.hoverW[0], G.hoverW[1]) : null;
  const showR = G.sel || hovT;
  if (showR && !G.demo) rangeCircle(showR.x, showR.y, towerStat(showR, 'range'), TOWERS[showR.type].minR, TOWERS[showR.type].support ? 'rgba(120,200,255,' : 'rgba(169,184,102,');
  // projectiles
  for (const p of PROJ) {
    if (!p.on) continue;
    if (p.kind === 'shell') { ctx.strokeStyle = '#ffe3a0'; ctx.lineWidth = .05; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - Math.cos(p.ang) * .25, p.y - Math.sin(p.ang) * .25); ctx.stroke(); }
    else if (p.kind === 'missile') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.fillStyle = '#d8d4c4'; ctx.fillRect(-.08, -.02, .16, .04); ctx.fillStyle = 'rgba(255,180,60,.9)'; ctx.beginPath(); ctx.arc(-.1, 0, .04, 0, TAU); ctx.fill(); ctx.restore(); }
    else if (p.kind === 'mortar' && p.t >= 0) { const h = p.h || 0; ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(p.x, p.y, .05, 0, TAU); ctx.fill(); ctx.fillStyle = '#2a2a24'; ctx.beginPath(); ctx.arc(p.x - h * .4, p.y - h * .9, .05 + h * .05, 0, TAU); ctx.fill(); }
    else if (p.kind === 'flak') { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(p.x, p.y, .03, 0, TAU); ctx.fill(); }
    else if (p.kind === 'arty' && p.t > p.T - .35) { const u = (p.T - p.t) / .35; ctx.strokeStyle = 'rgba(255,230,180,.8)'; ctx.lineWidth = .04; ctx.beginPath(); ctx.moveTo(p.x - u * 1.2, p.y - u * 2.4); ctx.lineTo(p.x - u * 1.2 + .15, p.y - u * 2.4 + .3); ctx.stroke(); }
  }
  // particles
  for (const p of PARTS) {
    if (!p.on) continue; const a = p.life / p.max;
    if (p.kind === 'fire') { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = a; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1.3 - a * .3), 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    else if (p.kind === 'spark') { ctx.globalAlpha = a; ctx.strokeStyle = p.col; ctx.lineWidth = .025; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .03, p.y - p.vy * .03); ctx.stroke(); }
    else if (p.kind === 'debris') { ctx.globalAlpha = Math.min(1, a * 2); ctx.fillStyle = p.col; ctx.fillRect(p.x - .02, p.y - .02, .04, .04); }
    else { ctx.globalAlpha = a * .9; ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * p.grow), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // air units above everything on the ground
  for (const e of G.enemies) if (e.air) { if (e.falling) { ctx.save(); ctx.globalAlpha = clamp(e.falling, .3, 1); drawEnemy(ctx, e); ctx.restore(); if (Math.random() < .25) part(e.x, e.y, 0, 0, .7, .12, 'rgba(60,60,60,.45)', 'smoke', 1.3); } else drawEnemy(ctx, e); }
  // fx
  for (const f of FX) {
    const u = f.t / f.T;
    if (f.kind === 'tracer') { ctx.strokeStyle = f.col; ctx.globalAlpha = 1 - u; ctx.lineWidth = .035; const a = clamp(u * 1.6, 0, 1), b = clamp(u * 1.6 + .35, 0, 1); ctx.beginPath(); ctx.moveTo(lerp(f.x0, f.x1, a), lerp(f.y0, f.y1, a)); ctx.lineTo(lerp(f.x0, f.x1, b), lerp(f.y0, f.y1, b)); ctx.stroke(); }
    else if (f.kind === 'flash') { ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r); g.addColorStop(0, `rgba(255,240,200,${1 - u})`); g.addColorStop(1, 'rgba(255,140,40,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
    else if (f.kind === 'beam') { ctx.strokeStyle = `rgba(242,200,74,${1 - u})`; ctx.lineWidth = .12 * (1 - u) + .02; ctx.beginPath(); ctx.moveTo(lerp(f.x0, f.x1, u * .8), lerp(f.y0, f.y1, u * .8)); ctx.lineTo(f.x1, f.y1); ctx.stroke(); }
    else if (f.kind === 'ring' && f.col) { ctx.strokeStyle = `rgba(${f.col},${.8 * (1 - u)})`; ctx.lineWidth = .06 * (1 - u) + .01; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * ease(u), 0, TAU); ctx.stroke(); }
    else if (f.kind === 'ring') { ctx.strokeStyle = `rgba(255,240,220,${.5 * (1 - u)})`; ctx.lineWidth = .05 * (1 - u); ctx.beginPath(); ctx.arc(f.x, f.y, f.r * ease(u), 0, TAU); ctx.stroke(); }
    else if (f.kind === 'muzzle') { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.a); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,150,${1 - u})`; ctx.beginPath(); ctx.moveTo(0, -.06 * f.s); ctx.lineTo(.3 * f.s, 0); ctx.lineTo(0, .06 * f.s); ctx.fill(); ctx.restore(); ctx.globalCompositeOperation = 'source-over'; }
    else if (f.kind === 'mark') { ctx.strokeStyle = `rgba(224,83,63,${.7 * (1 - u)})`; ctx.lineWidth = .04; ctx.setLineDash([.15, .1]); ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
    else if (f.kind === 'jet') { const x = lerp(f.x0, f.x1, u), y = lerp(f.y0, f.y1, u), a = Math.atan2(f.y1 - f.y0, f.x1 - f.x0); ctx.save(); ctx.translate(x + .6, y + .8); ctx.rotate(a); ctx.fillStyle = 'rgba(0,0,0,.25)'; jetShape(ctx, .9); ctx.restore(); ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = '#6f7670'; jetShape(ctx, .9); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  // placement ghost & call-in reticle
  if (placing && G.hoverW) {
    const [hx, hy] = G.hoverW, ok = !placeErr(hx, hy) && G.cash >= tCost(G.place, 0);
    const fake = { type: G.place, lvl: 0, x: hx, y: hy, ang: -Math.PI / 2, rank: 0, flash: 0, recoil: 0, built: 1 };
    rangeCircle(fake.x, fake.y, TOWERS[G.place].range[0] * (G.place === 'aa' ? 1 + .1 * perk('flak') : 1), TOWERS[G.place].minR, TOWERS[G.place].support ? 'rgba(120,200,255,' : ok ? 'rgba(169,184,102,' : 'rgba(224,83,63,');
    drawTower(ctx, fake, .7);
    ctx.strokeStyle = ok ? 'rgba(200,230,140,.9)' : 'rgba(224,83,63,.9)'; ctx.lineWidth = .05; ctx.beginPath(); ctx.arc(hx, hy, TR + .03, 0, TAU); ctx.stroke();
  }
  if (G.aim && G.hoverW && !G.demo) {
    const [x, y] = G.hoverW;
    ctx.strokeStyle = 'rgba(224,83,63,.9)'; ctx.lineWidth = .05; ctx.setLineDash([.2, .12]);
    if (G.aim === 'arty') { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, TAU); ctx.stroke(); }
    else { let best = null, bd = 1e9; for (const P of G.map.lanes) for (const g of P.segs) { const d = segDist(x, y, g.ax, g.ay, g.bx, g.by); if (d < bd) { bd = d; best = g; } } if (best && bd < 2.5) { const t0 = (x - best.ax) * best.dx + (y - best.ay) * best.dy, px = best.ax + best.dx * t0, py = best.ay + best.dy * t0; ctx.beginPath(); ctx.moveTo(px - best.dx * 3.6, py - best.dy * 3.6); ctx.lineTo(px + best.dx * 3.6, py + best.dy * 3.6); ctx.lineWidth = .5; ctx.strokeStyle = 'rgba(224,83,63,.35)'; ctx.stroke(); } }
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x - .25, y); ctx.lineTo(x + .25, y); ctx.moveTo(x, y - .25); ctx.lineTo(x, y + .25); ctx.lineWidth = .04; ctx.strokeStyle = 'rgba(224,83,63,.9)'; ctx.stroke();
  }
  // floating text
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.textAlign = 'center'; ctx.font = '700 13px "Chakra Petch", Inter, sans-serif';
  for (const p of TXT) { if (!p.on) continue; p.t += dt; if (p.t > 1) { p.on = false; continue; } const [sx, sy] = w2s(p.x, p.y); ctx.globalAlpha = 1 - p.t; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillText(p.s, sx + 1, sy - p.t * 22 + 1); ctx.fillStyle = p.col; ctx.fillText(p.s, sx, sy - p.t * 22); }
  ctx.globalAlpha = 1;
  // vignette
  if (!vig || vig.w !== cv.width) { const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height; const t = c.getContext('2d'); const g = t.createRadialGradient(c.width / 2, c.height / 2, c.height * .4, c.width / 2, c.height / 2, c.width * .7); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.4)'); t.fillStyle = g; t.fillRect(0, 0, c.width, c.height); vig = { w: cv.width, c }; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(vig.c, 0, 0);
}
let vig = null;
function jetShape(t, s) { t.beginPath(); t.moveTo(.5 * s, 0); t.lineTo(.1 * s, -.08 * s); t.lineTo(-.05 * s, -.5 * s); t.lineTo(-.18 * s, -.5 * s); t.lineTo(-.15 * s, -.08 * s); t.lineTo(-.4 * s, -.06 * s); t.lineTo(-.5 * s, -.22 * s); t.lineTo(-.56 * s, -.22 * s); t.lineTo(-.5 * s, 0); t.lineTo(-.56 * s, .22 * s); t.lineTo(-.5 * s, .22 * s); t.lineTo(-.4 * s, .06 * s); t.lineTo(-.15 * s, .08 * s); t.lineTo(-.18 * s, .5 * s); t.lineTo(-.05 * s, .5 * s); t.lineTo(.1 * s, .08 * s); t.closePath(); t.fill(); }
function rangeCircle(x, y, r, minR, col) {
  ctx.fillStyle = col + '.08)'; ctx.strokeStyle = col + '.7)'; ctx.lineWidth = .04;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.stroke();
  if (minR) { ctx.setLineDash([.12, .1]); ctx.beginPath(); ctx.arc(x, y, minR, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
}

// =====================================================================
//  HUD & INPUT
// =====================================================================
function hud(on) { $('hud').classList.toggle('hide', !on); if (!on) { $('coach').classList.add('hide'); } }
function iconCanvas(cvs, type, lvl = 0, merged = false) {
  const t = cvs.getContext('2d'), w = cvs.width; t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, w, w);
  t.setTransform(w * .9, 0, 0, w * .9, w * .05, w * .05);
  drawTower(t, { type, lvl, merged, x: .5, y: .5, ang: -Math.PI / 4, rank: 0, flash: 0, recoil: 0, built: 1 });
}
function enemyIcon(cvs, type) {
  const t = cvs.getContext('2d'), w = cvs.width; t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, w, w);
  const s = ENEMIES[type].size, k = w / (s * 2.3 + .14); t.setTransform(k, 0, 0, k, w / 2, w / 2);
  drawEnemy(t, { type, D: ENEMIES[type], x: 0, y: 0, ang: -Math.PI / 4, turret: -Math.PI / 4, t: .3, hp: 1, max: 1, hitT: 0, sp: 1, air: false });
}
function buildBar() {
  const bar = $('bar'); bar.innerHTML = '';
  T_ORDER.forEach((k, i) => {
    const b = document.createElement('button'); b.className = 'tcard'; b.dataset.t = k;
    b.innerHTML = `<span class="hk">${i + 1}</span><canvas width="96" height="96"></canvas><b>${tCost(k, 0)}</b><small>${TOWERS[k].short}</small>`;
    iconCanvas(b.querySelector('canvas'), k);
    b.onclick = () => { audioInit(); pickPlace(k); };
    bar.appendChild(b);
  });
  const sep = document.createElement('div'); sep.className = 'sep'; bar.appendChild(sep);
  for (const k of ['arty', 'gun']) {
    const C = CALLS[k], b = document.createElement('button'); b.className = 'tcard call'; b.dataset.c = k;
    b.innerHTML = `<span class="hk">${C.key}</span><canvas width="96" height="96"></canvas><b style="color:var(--text)">${C.name}</b><small>${C.key} key</small><i class="cd"></i>`;
    const t = b.querySelector('canvas').getContext('2d'); t.setTransform(96, 0, 0, 96, 48, 48);
    if (k === 'arty') { t.strokeStyle = '#e0533f'; t.lineWidth = .05; t.beginPath(); t.arc(0, 0, .3, 0, TAU); t.stroke(); t.beginPath(); t.moveTo(-.4, 0); t.lineTo(.4, 0); t.moveTo(0, -.4); t.lineTo(0, .4); t.stroke(); t.fillStyle = '#ffb347'; t.beginPath(); t.arc(.1, -.08, .08, 0, TAU); t.fill(); }
    else { t.rotate(-Math.PI / 4); t.fillStyle = '#9aa29a'; jetShape(t, .8); }
    b.onclick = () => { audioInit(); pickAim(k); };
    bar.appendChild(b);
  }
}
let hudLast = '';
function hudUpdate() {
  if (G.demo) return;
  $('hLives').textContent = G.lives; $('hCash').textContent = Math.floor(G.cash);
  $('hWave').textContent = G.wave + (G.mode === 'endless' ? '' : '/' + G.maxWave);
  const nb = $('bNext');
  if (G.phase === 'build') { nb.textContent = 'Start wave'; nb.disabled = false; nb.classList.toggle('pulse', G.towers.length > 0); }
  else if (G.phase === 'inter') { nb.textContent = 'Next wave ' + Math.ceil(G.interT) + 's (+' + Math.round(G.interT * 4) + ')'; nb.disabled = false; nb.classList.remove('pulse'); }
  else if (G.phase === 'wave') { nb.textContent = G.spawnQ.length ? 'Wave ' + G.wave + ' incoming' : 'Clearing…'; nb.disabled = true; nb.classList.remove('pulse'); }
  else { nb.disabled = true; }
  if (G.wave >= G.maxWave && G.phase !== 'build') nb.disabled = true;
  document.querySelectorAll('.tcard[data-t]').forEach(b => { b.classList.toggle('on', G.place === b.dataset.t); b.classList.toggle('poor', G.cash < tCost(b.dataset.t, 0)); });
  document.querySelectorAll('.tcard[data-c]').forEach(b => {
    const k = b.dataset.c, C = CALLS[k], locked = G.wave < C.unlock, cd = G.calls[k], max = C.cd * (1 - .15 * perk('arty'));
    b.classList.toggle('lockd', locked); b.classList.toggle('on', G.aim === k);
    b.querySelector('.cd').style.transform = `scaleY(${locked ? 1 : clamp(cd / max, 0, 1)})`;
    b.querySelector('small').textContent = locked ? 'wave ' + C.unlock : cd > 0 ? Math.ceil(cd) + 's' : 'ready';
  });
}
function selUpdate() {
  const tw = G.sel, el = $('sel');
  if (!tw || G.demo || !G.towers.includes(tw)) { el.classList.add('hide'); G.sel = null; return; }
  el.classList.remove('hide');
  const D = TOWERS[tw.type], A = ABIL[tw.type];
  $('sName').textContent = tw.merged ? ELITE[tw.type] : D.name;
  $('sRank').textContent = (tw.merged ? 'Elite · ' : 'Tier ' + sumUp(tw) + ' · ') + (tw.rank ? ['', 'Veteran', 'Elite crew', 'Legendary'][tw.rank] + ' · ' : '') + tw.kills + ' kills';
  iconCanvas($('selIcon'), tw.type, tw.lvl, tw.merged);
  const vs = Object.entries(MULT[D.dtype]).filter(([, m]) => m >= 1).map(([a]) => a).join(', ');
  $('sStats').innerHTML = D.support
    ? `<tr><td>Damage boost</td><td>+${Math.round(radarD(tw) * 100)}%</td></tr><tr><td>Fire rate boost</td><td>+${Math.round(radarR(tw) * 100)}%</td></tr><tr><td>Coverage</td><td>${towerStat(tw, 'range').toFixed(1)}</td></tr>`
    : `<tr><td>Damage</td><td>${Math.round(towerStat(tw, 'dmg'))}</td></tr><tr><td>Shots / s</td><td>${towerStat(tw, 'rate').toFixed(2)}</td></tr><tr><td>Range</td><td>${towerStat(tw, 'range').toFixed(1)}</td></tr><tr><td>Best against</td><td>${vs}</td></tr>`;
  $('sPaths').innerHTML = PATHS.map(([k, lab, key], i) => `<div class="prow" data-k="${k}"><div class="pn"><b>${PATH_NAMES[tw.type][i]}</b><small>${lab}${isTouch ? '' : ' · ' + key}</small><span class="pips">${[0, 1, 2, 3].map(n => `<i class="${n < upOf(tw, k) ? 'on' : ''}"></i>`).join('')}</span></div><button class="pbuy"></button></div>`).join('');
  $('sPaths').querySelectorAll('.prow').forEach(r => { r.querySelector('button').onclick = () => { audioInit(); if (!upgrade(tw, r.dataset.k)) SFX.deny(); }; });
  $('sAbN').textContent = A.n + (isTouch ? '' : ' (A)'); $('sAbD').textContent = A.d + (tw.merged ? ' Elite: stronger, faster cooldown.' : '');
  $('sAbil').onclick = () => { audioInit(); useAbility(tw, false); };
  const tgtUI = !D.support; $('sTarget').classList.toggle('hide', !tgtUI); $('sTgtL').classList.toggle('hide', !tgtUI);
  document.querySelectorAll('#sTarget button').forEach(b => { b.classList.toggle('on', b.dataset.v === tw.mode); b.onclick = () => { tw.mode = b.dataset.v; SFX.ui(); selUpdate(); }; });
  $('sMerge').onclick = () => { audioInit(); if (!G.towers.some(o => canMerge(tw, o))) { SFX.deny(); return; } G.merge = G.merge === tw ? null : tw; G.place = null; G.aim = null; SFX.ui(); if (G.merge) toast('Pick the other ' + D.name + ' to merge with', 'good'); selTick(); hudUpdate(); };
  $('sSell').textContent = 'Sell ' + Math.round(tw.spent * (perk('salvage') ? .8 : .6));
  selTick();
}
function selTick() {
  const tw = G.sel; if (!tw || $('sel').classList.contains('hide')) return;
  $('sPaths').querySelectorAll('.prow').forEach(r => { const k = r.dataset.k, b = r.querySelector('button'), mx = upOf(tw, k) >= PMAX, c = mx ? 0 : upCost(tw, k); b.textContent = mx ? 'MAX' : c; b.disabled = mx || G.cash < c; b.classList.toggle('max', mx); });
  const cd = tw.abCd, ab = $('sAbil'), act = tw.abT > 0 || tw.sabot > 0;
  ab.disabled = cd > 0; ab.classList.toggle('ready', cd <= 0); $('sAbCd').style.transform = `scaleX(${clamp(cd / abilCd(tw), 0, 1)})`;
  $('sAbS').textContent = act ? (tw.sabot > 0 ? tw.sabot + ' rounds loaded' : 'Active ' + Math.ceil(tw.abT) + 's') : cd > 0 ? Math.ceil(cd) + 's' : 'Ready';
  const mb = $('sMerge'), partner = G.towers.some(o => canMerge(tw, o));
  mb.disabled = tw.merged || !partner; mb.classList.toggle('on', G.merge === tw);
  mb.textContent = tw.merged ? '★ Elite' : sumUp(tw) < MERGE_AT ? 'Merge at tier ' + MERGE_AT : !partner ? 'Merge: no partner' : G.merge === tw ? 'Pick partner…' : 'Merge' + (isTouch ? '' : ' (G)');
  mb.title = tw.merged ? 'Already an elite defense' : 'Two ' + TOWERS[tw.type].name + 's at tier ' + MERGE_AT + '+ combine into one ' + ELITE[tw.type];
}
$('sSell').onclick = () => { if (G.sel) sell(G.sel); };
$('sClose').onclick = () => { G.sel = null; G.merge = null; selUpdate(); };
function wavePreview() {
  const el = $('wavePrev'); el.innerHTML = '';
  if (G.demo || G.wave >= G.maxWave) return;
  const def = waveDef(G.wave + 1), cnt = {};
  def.forEach(([t, c]) => { cnt[t] = (cnt[t] || 0) + c; });
  el.innerHTML = '<span style="margin-right:4px">Next:</span>';
  for (const t in cnt) { const c = document.createElement('canvas'); c.width = c.height = 60; enemyIcon(c, t); c.title = ENEMIES[t].name; el.appendChild(c); const b = document.createElement('b'); b.textContent = '×' + cnt[t]; el.appendChild(b); }
}
function pickPlace(k) {
  if (G.demo) return;
  G.aim = null; G.sel = null; G.merge = null; selUpdate();
  if (G.place === k) G.place = null; else { G.place = k; SFX.ui(); }
  hudUpdate(); coachStep('pick');
}
function pickAim(k) {
  if (G.demo) return;
  const C = CALLS[k];
  if (G.wave < C.unlock) { toast(C.name + ' unlocks at wave ' + C.unlock, 'bad'); SFX.deny(); return; }
  if (G.calls[k] > 0) { toast(C.name + ' ready in ' + Math.ceil(G.calls[k]) + 's', 'bad'); SFX.deny(); return; }
  G.place = null; G.sel = null; selUpdate();
  G.aim = G.aim === k ? null : k; SFX.ui(); hudUpdate();
}
const inGame = () => !document.body.classList.contains('inmenu') && !G.demo && !G.over;
function pointerW(e) { return s2w(e.clientX, e.clientY); }
cv.addEventListener('pointermove', e => { if (!inGame()) return; G.hoverW = pointerW(e); });
cv.addEventListener('pointerleave', () => { G.hoverW = null; });
cv.addEventListener('pointerdown', e => {
  audioInit();
  if (!inGame() || G.paused) return;
  const [wx, wy] = pointerW(e); G.hoverW = [wx, wy];
  if (e.button === 2) { G.place = null; G.aim = null; G.merge = null; hudUpdate(); selTick(); return; }
  if (G.merge) { const tw = towerAt(wx, wy); if (tw && canMerge(G.merge, tw)) mergeTowers(G.merge, tw); else { if (tw !== G.merge) { SFX.deny(); toast('Merge cancelled', 'bad'); } G.merge = null; selTick(); } return; }
  if (G.aim) { const ok = G.aim === 'arty' ? callArty(wx, wy) : callGun(wx, wy); if (ok) { G.aim = null; coachStep('call'); } hudUpdate(); return; }
  if (G.place) {
    const err = placeErr(wx, wy), onT = towerAt(wx, wy);
    if (!err) {
      if (G.cash < tCost(G.place, 0)) { toast('Not enough supply', 'bad'); SFX.deny(); }
      else { build(G.place, wx, wy); if (!e.shiftKey || G.cash < tCost(G.place, 0)) G.place = null; }
    } else if (onT && Math.hypot(onT.x - wx, onT.y - wy) < TR * .8) { G.place = null; G.sel = onT; }
    else { SFX.deny(); toast(err, 'bad'); }
    hudUpdate(); selUpdate(); return;
  }
  const tw = towerAt(wx, wy);
  G.sel = tw || null; if (tw) SFX.ui(); selUpdate();
});
cv.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'range') return;
  audioInit();
  const k = e.code;
  if (k === 'Escape' || k === 'KeyP') { if (inGame()) { if (k === 'Escape' && (G.place || G.aim || G.sel || G.merge)) { G.place = null; G.aim = null; G.sel = null; G.merge = null; hudUpdate(); selUpdate(); } else togglePause(); } else if (k === 'Escape') goBack(); return; }
  if (k === 'KeyM') { SET.mute = !SET.mute; persistSet(); applyAudio(); syncSettings(); return; }
  if (!inGame() || G.paused) return;
  const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7'].indexOf(k); if (n >= 0) pickPlace(T_ORDER[n]);
  if (G.sel) { const pk = { KeyZ: 'dmg', KeyX: 'rate', KeyC: 'range' }[k]; if (pk) { if (!upgrade(G.sel, pk)) SFX.deny(); } if (k === 'KeyA') useAbility(G.sel, false); if (k === 'KeyG') $('sMerge').click(); }
  if (k === 'KeyQ') pickAim('arty'); if (k === 'KeyE') pickAim('gun');
  if (k === 'Space') { e.preventDefault(); if (G.phase === 'build' || G.phase === 'inter') sendWave(); }
  if (k === 'KeyF') cycleSpeed();
  if ((k === 'Delete' || k === 'Backspace') && G.sel) sell(G.sel);
});
function cycleSpeed() { G.speed = G.speed >= 4 ? 1 : G.speed + 1; $('bSpeed').innerHTML = G.speed + '&times;'; SFX.ui(); }
$('bSpeed').onclick = () => { audioInit(); cycleSpeed(); };
$('bNext').onclick = () => { audioInit(); if (G.phase === 'build' || G.phase === 'inter') sendWave(); };
$('bPause').onclick = () => { audioInit(); if (inGame()) togglePause(); };
window.addEventListener('blur', () => { if (inGame() && !G.paused) togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (inGame() && !G.paused) togglePause(); if (AU.ctx && AU.ctx.state === 'running') AU.ctx.suspend(); } else if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume(); });
function toast(msg, cls) {
  if (G.demo) return;
  const box = $('toast'), d = document.createElement('div'); d.textContent = msg; if (cls) d.className = cls;
  box.appendChild(d); while (box.children.length > 3) box.removeChild(box.firstChild);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 360); }, 2000);
}
let banTO = 0;
function banner(t, s) { $('banT').textContent = t; $('banS').textContent = s || ''; const b = $('banner'); b.classList.remove('hide'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; clearTimeout(banTO); banTO = setTimeout(() => b.classList.add('hide'), 2000); }
// ---------- tutorial
const COACH = [
  ['start', isTouch ? 'Tap the <b>MG Nest</b> below, then tap any open spot beside the road' : 'Pick the <b>MG Nest</b> (key <b>1</b>) and click any open spot beside the road'],
  ['built', 'Good. Build one more, then press <b>Start wave</b>' + (isTouch ? '' : ' (<b>Space</b>)')],
  ['wave', 'Infantry inbound. Machine guns cut them down fast.'],
  ['cleared', 'Wave held. ' + (isTouch ? 'Tap' : 'Click') + ' a defense to buy <b>upgrades</b> or fire its <b>ability</b>, or add an <b>AT Gun</b> for the vehicles coming next'],
  ['art', '<b>Artillery</b> is ready. ' + (isTouch ? 'Tap it' : 'Press <b>Q</b>') + ' and pick a spot on the road']
];
let coachIdx = 0;
function coachStep(ev) {
  if (G.demo || SAVE.tut >= 1) return;
  const c = $('coach');
  if (ev === 'begin') coachIdx = 0;
  else if (ev === 'built' && coachIdx === 0) coachIdx = 1;
  else if (ev === 'wave' && coachIdx <= 1) coachIdx = 2;
  else if (ev === 'cleared' && coachIdx === 2) coachIdx = 3;
  else if (ev === 'cleared' && coachIdx === 3 && G.wave >= CALLS.arty.unlock) coachIdx = 4;
  else if (ev === 'call' && coachIdx === 4) { c.classList.add('hide'); SAVE.tut = 1; persist(); return; }
  else if (ev === 'pick' || ev === 'built') { }
  if (G.wave >= 4 && coachIdx < 4) { c.classList.add('hide'); SAVE.tut = 1; persist(); return; }
  c.innerHTML = COACH[coachIdx][1]; c.classList.remove('hide');
  if (coachIdx === 2) setTimeout(() => { if (coachIdx === 2) c.classList.add('hide'); }, 5000);
}

// =====================================================================
//  MENUS
// =====================================================================
const PANELS = ['menu', 'maps', 'cmd', 'settings', 'help', 'pause', 'end'];
let nav = [];
function show(id, push = true) {
  PANELS.forEach(p => $(p).classList.toggle('hide', p !== id));
  if (push && nav[nav.length - 1] !== id) nav.push(id);
  if (id === 'menu') { nav = ['menu']; refreshMenu(); }
  if (id === 'maps') buildMaps(); if (id === 'cmd') buildPerks(); if (id === 'settings') syncSettings();
}
function hideAll() { PANELS.forEach(p => $(p).classList.add('hide')); }
function goBack() { if (nav.length <= 1) return; nav.pop(); SFX.ui(); show(nav[nav.length - 1], false); }
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', goBack));
function refreshMenu() {
  const free = starsEarned() - starsSpent();
  $('cmdStars').textContent = free > 0 ? '★ ' + free : '';
  const m = MAPS.find(x => x.id === SAVE.sel) || MAPS[0];
  $('mFoot').innerHTML = `<b>★ ${starsEarned()}</b> of 24 stars · next: ${m.name} (${SAVE.mode})`;
}
function toMenu() {
  G.paused = false; hud(false); document.body.classList.add('inmenu'); $('banner').classList.add('hide'); $('coach').classList.add('hide');
  startOp(0, 'regular', true); show('menu');
}
function launch(mi, mode) {
  hideAll(); nav = []; document.body.classList.remove('inmenu');
  SAVE.sel = MAPS[mi].id; SAVE.mode = mode; persist();
  startOp(mi, mode, false);
  banner(MAPS[mi].name, ({ regular: 'Regular', veteran: 'Veteran: tougher enemies, less supply', endless: 'Endless: hold as long as you can' })[mode]);
  coachIdx = 0; if (SAVE.tut < 1 && mi === 0) setTimeout(() => coachStep('begin'), 800);
}
$('bPlay').onclick = () => {
  SFX.ui();
  let mi = MAPS.findIndex(m => m.id === SAVE.sel); if (mi < 0 || !mapOpen(mi)) mi = 0;
  let mode = SAVE.mode; if (mode !== 'regular' && !SAVE.maps[MAPS[mi].id].reg) mode = 'regular';
  launch(mi, mode);
};
$('bMaps').onclick = () => { SFX.ui(); show('maps'); };
$('bCmd').onclick = () => { SFX.ui(); show('cmd'); };
$('bSet').onclick = () => { SFX.ui(); show('settings'); };
$('bHelp').onclick = () => { SFX.ui(); show('help'); };
$('eMenu').onclick = () => { SFX.ui(); toMenu(); };
$('eAgain').onclick = () => { SFX.ui(); launch(G.mi, G.mode); };
const THUMBS = {};
function mapThumb(cvs, mi) {
  const g = THUMBS[mi] || (THUMBS[mi] = buildGround(buildMap(MAPS[mi]), 18));
  cvs.width = g.width; cvs.height = g.height; cvs.getContext('2d').drawImage(g, 0, 0);
}
function buildMaps() {
  const el = $('mapList'); el.innerHTML = '';
  MAPS.forEach((m, i) => {
    const S = SAVE.maps[m.id], open = mapOpen(i), d = document.createElement('div');
    d.className = 'card' + (open ? '' : ' locked');
    const st = n => '★★★'.split('').map((s, k) => k < n ? s : '☆').join('');
    d.innerHTML = `<canvas></canvas>${open ? '' : `<div class="lock">Clear ${MAPS[i - 1].name} to unlock</div>`}<div class="ci"><h4>${m.name}</h4><p>${m.desc}</p>
      <div class="modes"><button data-m="regular" ${open ? '' : 'disabled'}>Regular<small>${st(S.reg)}</small></button><button data-m="veteran" ${open && S.reg ? '' : 'disabled'}>Veteran<small>${st(S.vet)}</small></button><button data-m="endless" ${open && S.reg ? '' : 'disabled'}>Endless<small style="letter-spacing:0">${S.endless ? 'best wave ' + S.endless : '—'}</small></button></div></div>`;
    mapThumb(d.querySelector('canvas'), i);
    d.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { SFX.ui(); launch(i, b.dataset.m); });
    el.appendChild(d);
  });
}
function buildPerks() {
  const free = starsEarned() - starsSpent();
  $('cmdLeft').textContent = '★ ' + Math.max(0, free) + ' to spend';
  const el = $('perkList'); el.innerHTML = '';
  PERKS.forEach(p => {
    const lv = perk(p.id), max = p.cost.length, c = lv < max ? p.cost[lv] : 0, d = document.createElement('div'); d.className = 'perk';
    d.innerHTML = `<b>${p.name}</b><p>${p.desc}</p><div class="pips">${p.cost.map((_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div><button ${lv >= max || free < c ? 'disabled' : ''}>${lv >= max ? 'Maxed' : 'Promote · ★ ' + c}</button>`;
    d.querySelector('button').onclick = () => { if (lv >= max || free < c) return; SAVE.perks[p.id] = lv + 1; persist(); SFX.upgrade(); buildPerks(); refreshMenu(); };
    el.appendChild(d);
  });
}
$('cmdReset').onclick = () => { SAVE.perks = {}; persist(); SFX.sell(); buildPerks(); refreshMenu(); };
function syncSettings() { $('sMaster').value = SET.master; $('sMusic').value = SET.music; $('sSfx').value = SET.sfx; $('sMute').checked = SET.mute; $('sShake').checked = SET.shake; $('sLow').checked = SET.low; $('sAuto').checked = SET.auto; $('sAutoAb').checked = SET.autoAb; $('sRanges').checked = SET.ranges; syncFS(); }
[['sMaster', 'master'], ['sMusic', 'music'], ['sSfx', 'sfx']].forEach(([id, k]) => $(id).addEventListener('input', e => { SET[k] = +e.target.value; persistSet(); applyAudio(); }));
$('sMute').onchange = e => { SET.mute = e.target.checked; persistSet(); applyAudio(); };
$('sShake').onchange = e => { SET.shake = e.target.checked; persistSet(); };
$('sLow').onchange = e => { SET.low = e.target.checked; persistSet(); layout(); };
$('sAuto').onchange = e => { SET.auto = e.target.checked; persistSet(); };
$('sAutoAb').onchange = e => { SET.autoAb = e.target.checked; persistSet(); };
$('sRanges').onchange = e => { SET.ranges = e.target.checked; persistSet(); };
// ---------- fullscreen
const FSE = document.documentElement, fsOK = !!(FSE.requestFullscreen || FSE.webkitRequestFullscreen);
const isFS = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function toggleFS() { audioInit(); try { if (isFS()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); else { const r = (FSE.requestFullscreen || FSE.webkitRequestFullscreen).call(FSE, { navigationUI: 'hide' }); if (r && r.catch) r.catch(() => toast('Fullscreen was blocked by the browser', 'bad')); } } catch (e) { toast('Fullscreen isn\u2019t available here', 'bad'); } }
function syncFS() { const on = isFS(); document.querySelectorAll('.fsbtn').forEach(b => { b.classList.toggle('hide', !fsOK); b.classList.toggle('on', on); if (b.dataset.lbl) b.textContent = on ? 'Exit fullscreen' : 'Fullscreen'; }); }
document.addEventListener('fullscreenchange', () => { layout(); syncFS(); }); document.addEventListener('webkitfullscreenchange', () => { layout(); syncFS(); });
document.querySelectorAll('.fsbtn').forEach(b => b.addEventListener('click', () => { SFX.ui(); toggleFS(); }));
let resetArm = 0;
$('sReset').onclick = () => {
  if (Date.now() - resetArm > 3000) { resetArm = Date.now(); $('sReset').textContent = 'Click again to erase stars and doctrine'; return; }
  SAVE.perks = {}; SAVE.tut = 0; MAPS.forEach(m => { SAVE.maps[m.id] = { reg: 0, vet: 0, endless: 0 }; }); SAVE.sel = 'valley'; SAVE.mode = 'regular'; persist();
  $('sReset').textContent = 'Progress reset'; refreshMenu();
};
function togglePause() {
  G.paused = !G.paused;
  if (G.paused) { $('pauseInfo').textContent = G.map.M.name + ' · wave ' + G.wave + ' · integrity ' + G.lives; show('pause'); AU.duck = .35; SFX.loops(0, 0); }
  else { hideAll(); nav = []; AU.duck = 1; }
  applyAudio();
}
$('pResume').onclick = () => { SFX.ui(); togglePause(); };
$('pRestart').onclick = () => { SFX.ui(); G.paused = false; AU.duck = 1; applyAudio(); launch(G.mi, G.mode); };
$('pSet').onclick = () => { SFX.ui(); show('settings'); };
$('pHelp').onclick = () => { SFX.ui(); show('help'); };
$('pQuit').onclick = () => { SFX.ui(); toMenu(); };

// =====================================================================
//  LOOP
// =====================================================================
let last = performance.now(), acc = 0, hudT = 0;
const SDT = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now; if (dt > .1) dt = .1; if (dt < 0) dt = 0;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 25);
  if (G.hitStop > 0) { G.hitStop -= dt; }
  else if (G.map && !G.paused && G.phase !== 'over') {
    acc += dt * G.speed; let n = 0;
    while (acc >= SDT && n < 8) { step(SDT); acc -= SDT; n++; }
    if (n >= 8) acc = 0;
  } else if (G.phase === 'over') { updateParts(dt); for (let i = FX.length - 1; i >= 0; i--) { FX[i].t += dt; if (FX[i].t > FX[i].T) FX.splice(i, 1); } }
  hudT -= dt; if (hudT <= 0 && inGame()) { hudT = .2; hudUpdate(); if (G.sel) selTick(); }
  render(dt);
}
window.__fb = { setHPK: v => { HPK = v; }, G, SAVE, SET, step, placeErr, towerAt, useAbility, mergeTowers, canMerge, upCost, sumUp, towerStat, HAZ, ABIL, toggleFS, layout, w2s, pickPlace, selUpdate, startOp, sendWave, build, upgrade, callArty, callGun, botStep, bestTile, launch, toMenu, MAPS, TOWERS, tCost, SFX, Music, AU, perk };
layout();
syncFS();
toMenu();
requestAnimationFrame(frame);
})();
