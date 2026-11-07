/* GRIDIRON — first-person physics football.
   Units are yards. The offense drives toward +z. Field x runs sideline to sideline (+x is the quarterback's left).
   Built on three.js r128 (global THREE). */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a);
const V3 = (x, y, z) => new THREE.Vector3(x || 0, y || 0, z || 0);
const GRAV = 10.7, FIELD_W = 53.33, HALF_W = 26.67, HASH = 3.08;

// ---------------- save + settings ----------------
const DEF = {
  set: { vol: .8, mus: .5, sfx: .9, crowd: .8, mute: 0, shake: 1, q: 1, sens: 1, inv: 0, guide: 1, routes: 1, marks: 1, diff: 1, qlen: 4 },
  rec: { drill: 0, titles: 0, games: 0, wins: 0, longTD: 0, passYds: 0, rushYds: 0 }, season: null, tut: 0
};
let save = JSON.parse(JSON.stringify(DEF));
try { const v = JSON.parse(localStorage.getItem('gf-save') || 'null'); if (v) save = Object.assign(save, v, { set: Object.assign({}, DEF.set, v.set), rec: Object.assign({}, DEF.rec, v.rec) }); } catch (e) { }
const store = () => { try { localStorage.setItem('gf-save', JSON.stringify(save)); } catch (e) { } };

// ---------------- renderer + scene ----------------
const cv = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1220, 120, 330);
const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 900); camera.rotation.order = 'YXZ'; scene.add(camera);
const MAXANISO = renderer.capabilities.getMaxAnisotropy();
function applyQuality() {
  const q = save.set.q;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q ? 2 : 1) * (q ? 1 : .8));
  renderer.shadowMap.enabled = !!q; sun.castShadow = !!q;
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
  if (crowdMesh) crowdMesh.count = q ? crowdMesh.userData.full : Math.floor(crowdMesh.userData.full * .45);
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = w / h < 1 ? 82 : 74; camera.updateProjectionMatrix(); }

// sky: deep night gradient with stars
{
  const g = new THREE.SphereGeometry(600, 32, 16), c = document.createElement('canvas'); c.width = 64; c.height = 512; const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#02040a'); gr.addColorStop(.42, '#0a1426'); gr.addColorStop(.5, '#1a2740'); gr.addColorStop(.56, '#0c1220'); gr.addColorStop(1, '#05070c'); x.fillStyle = gr; x.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
  scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide, fog: false, depthWrite: false })));
  const sg = new THREE.BufferGeometry(), sp = []; for (let i = 0; i < 900; i++) { const a = Math.random() * TAU, e = Math.random() * .9 + .12, r = 560; sp.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 1.3, sizeAttenuation: false, fog: false, transparent: true, opacity: .7 })));
}
// lights: stadium floods
const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x24361c, .62); scene.add(hemi);
scene.add(new THREE.AmbientLight(0x404858, .35));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.05); sun.position.set(30, 70, -20);
sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 10; sc.far = 160; sun.shadow.bias = -.0006; sun.shadow.normalBias = .02;
scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight(0xc8d8ff, .4); fill.position.set(-40, 50, 30); scene.add(fill);

// ---------------- the field ----------------
let TEAM_ENDZONE = ['HOME', 'AWAY'];
const fieldCanvas = document.createElement('canvas'), PX = 22, FW = 61.33, FL = 128; // 4 yd border around the playing field
fieldCanvas.width = Math.round(FW * PX); fieldCanvas.height = Math.round(FL * PX);
const fieldTex = new THREE.CanvasTexture(fieldCanvas); fieldTex.encoding = THREE.sRGBEncoding; fieldTex.anisotropy = MAXANISO;
function paintField(homeName, homeCol, awayName, awayCol) {
  const x = fieldCanvas.getContext('2d'), W = fieldCanvas.width, H = fieldCanvas.height;
  const X = fx => (fx + FW / 2) * PX, Z = fz => (fz + FL / 2) * PX; // world x/z -> canvas
  x.fillStyle = '#245a24'; x.fillRect(0, 0, W, H);
  for (let k = -12; k < 12; k++) { x.fillStyle = k % 2 ? '#2b6a29' : '#276224'; x.fillRect(X(-HALF_W), Z(k * 5), FIELD_W * PX, 5 * PX); }
  // grass grain
  const img = x.getImageData(0, 0, W, H), d = img.data; for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - .5) * 18; d[i] += n * .6; d[i + 1] += n; d[i + 2] += n * .5; } x.putImageData(img, 0, 0);
  // end zones
  const ez = (z0, name, col) => { x.fillStyle = col; x.globalAlpha = .82; x.fillRect(X(-HALF_W), Z(z0), FIELD_W * PX, 10 * PX); x.globalAlpha = 1; x.save(); x.translate(X(0), Z(z0 + 5)); if (z0 > 0) x.rotate(Math.PI); x.font = `900 ${6.2 * PX}px "Barlow Condensed", Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = 'rgba(255,255,255,.92)'; x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = PX * .25; x.strokeText(name, 0, 0); x.fillText(name, 0, 0); x.restore(); };
  ez(-60, homeName, homeCol); ez(50, awayName, awayCol);
  x.fillStyle = '#f4f6f2'; x.strokeStyle = '#f4f6f2';
  // boundary
  x.lineWidth = PX * .55; x.strokeRect(X(-HALF_W) - PX * .3, Z(-60) - PX * .3, FIELD_W * PX + PX * .6, 120 * PX + PX * .6);
  for (let z = -50; z <= 50; z += 5) x.fillRect(X(-HALF_W), Z(z) - PX * .06, FIELD_W * PX, PX * (z % 50 === 0 ? .2 : .12));
  for (let z = -49; z < 50; z++) { if (z % 5 === 0) continue; for (const hx of [-HALF_W + .3, HALF_W - 1, -HASH - .35, HASH - .35]) x.fillRect(X(hx), Z(z) - PX * .05, PX * .7, PX * .1); }
  // numbers
  x.font = `700 ${2.2 * PX}px "Barlow Condensed", Impact, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let z = -40; z <= 40; z += 10) { const n = 50 - Math.abs(z); for (const side of [-1, 1]) { x.save(); x.translate(X(side * (HALF_W - 9)), Z(z)); x.rotate(side * Math.PI / 2); x.fillStyle = 'rgba(244,246,242,.95)'; x.fillText(String(n).split('').join(' '), 0, 0); x.restore(); } }
  // midfield logo ring
  x.globalAlpha = .55; x.lineWidth = PX * .3; x.beginPath(); x.arc(X(0), Z(0), 5 * PX, 0, TAU); x.stroke(); x.globalAlpha = 1;
  fieldTex.needsUpdate = true;
}
const field = new THREE.Mesh(new THREE.PlaneGeometry(FW, FL), new THREE.MeshStandardMaterial({ map: fieldTex, roughness: .95, metalness: 0 }));
field.rotation.x = -Math.PI / 2; field.receiveShadow = true; scene.add(field);
// turf around the field + track
{ const m = new THREE.Mesh(new THREE.PlaneGeometry(130, 210), new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.y = -.02; m.receiveShadow = true; scene.add(m); }
// line of scrimmage (blue) + first down (yellow)
const lineMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .85, depthWrite: false });
const losLine = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, .28), lineMat(0x2f7bff)); losLine.rotation.x = -Math.PI / 2; losLine.position.y = .02; scene.add(losLine);
const fdLine = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, .28), lineMat(0xffd400)); fdLine.rotation.x = -Math.PI / 2; fdLine.position.y = .021; scene.add(fdLine);
// goalposts
const postMat = new THREE.MeshStandardMaterial({ color: 0xffd21a, roughness: .45, metalness: .25 });
for (const s of [-1, 1]) {
  const g = new THREE.Group(), z = s * 60.3;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(.18, .2, 3.33, 10), postMat); base.position.set(0, 1.66, z + s * 1.3); g.add(base);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 1.4, 8), postMat); arm.rotation.x = Math.PI / 2; arm.position.set(0, 3.33, z + s * .65); g.add(arm);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, HASH * 2, 8), postMat); bar.rotation.z = Math.PI / 2; bar.position.set(0, 3.33, z); g.add(bar);
  for (const px of [-HASH, HASH]) { const u = new THREE.Mesh(new THREE.CylinderGeometry(.08, .08, 10, 8), postMat); u.position.set(px, 3.33 + 5, z); g.add(u); }
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, 2, 10), new THREE.MeshStandardMaterial({ color: 0x1b3a7a })); pad.position.set(0, 1, z + s * 1.3); g.add(pad);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); scene.add(g);
}
// pylons
for (const sx of [-1, 1]) for (const sz of [-60, -50, 50, 60]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.13, .5, .13), new THREE.MeshStandardMaterial({ color: 0xff6a10, emissive: 0x401000 })); p.position.set(sx * (HALF_W + .1), .25, sz); scene.add(p); }

// ---------------- stadium bowl + crowd ----------------
const concrete = new THREE.MeshStandardMaterial({ color: 0x2c313c, roughness: .9 }), seatDark = new THREE.MeshStandardMaterial({ color: 0x161b27, roughness: .8 });
let crowdMesh = null; const crowdBase = [];
{
  const rows = 26, step = .9, rise = .62; let n = 0; const mats = []; const dummy = new THREE.Object3D();
  const sections = [];
  // sidelines: x = ±(HALF_W + 12) outwards; ends: z = ±(66) outwards
  for (const s of [-1, 1]) sections.push({ axis: 'x', s, from: -62, to: 62, start: HALF_W + 13 });
  for (const s of [-1, 1]) sections.push({ axis: 'z', s, from: -38, to: 38, start: 70 });
  for (const sec of sections) {
    // stepped concrete
    for (let r = 0; r < rows; r += 2) {
      const len = sec.to - sec.from, b = new THREE.Mesh(new THREE.BoxGeometry(sec.axis === 'x' ? step * 2 : len, (r + 2) * rise, sec.axis === 'x' ? len : step * 2), r % 4 ? seatDark : concrete);
      const off = sec.start + r * step + step;
      if (sec.axis === 'x') b.position.set(sec.s * off, (r + 2) * rise / 2 - .5, 0); else b.position.set(0, (r + 2) * rise / 2 - .5, sec.s * off);
      b.receiveShadow = false; scene.add(b);
    }
    // facade + LED ribbon at the top
    const top = sec.start + rows * step + 1, len = sec.to - sec.from;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sec.axis === 'x' ? 1 : len + 6, 10, sec.axis === 'x' ? len + 6 : 1), concrete);
    if (sec.axis === 'x') wall.position.set(sec.s * top, rows * rise + 4, 0); else wall.position.set(0, rows * rise + 4, sec.s * top); scene.add(wall);
    sec.top = top;
  }
  // crowd: one instanced mesh of seated fans
  const total = sections.reduce((a, s) => a + Math.floor((s.to - s.from) / .62) * rows, 0);
  const geo = new THREE.BoxGeometry(.42, .78, .36); geo.translate(0, .39, 0);
  crowdMesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), total);
  const col = new THREE.Color(), pal = [0xd8d8d8, 0x2a2a30, 0x8a2a2a, 0x2a4a8a, 0xc8b070, 0x3a6a3a, 0x6a4a3a, 0xe0e0e0, 0x1a1a1a, 0x7a7a90];
  for (const sec of sections) {
    for (let r = 0; r < rows; r++) for (let t = sec.from; t < sec.to; t += .62) {
      if (Math.random() < .06) continue;
      const off = sec.start + r * step + step * .5, y = (r + 1) * rise - .5;
      if (sec.axis === 'x') { dummy.position.set(sec.s * off, y, t + rnd(-.08, .08)); dummy.rotation.y = sec.s > 0 ? -Math.PI / 2 : Math.PI / 2; }
      else { dummy.position.set(t + rnd(-.08, .08), y, sec.s * off); dummy.rotation.y = sec.s > 0 ? Math.PI : 0; }
      dummy.scale.set(rnd(.85, 1.15), rnd(.9, 1.15), 1); dummy.updateMatrix(); crowdMesh.setMatrixAt(n, dummy.matrix);
      col.setHex(pal[(Math.random() * pal.length) | 0]); col.multiplyScalar(rnd(.6, 1.1)); col.convertSRGBToLinear(); crowdMesh.setColorAt(n, col);
      crowdBase.push([dummy.position.x, dummy.position.y, dummy.position.z, dummy.rotation.y, dummy.scale.x, dummy.scale.y, Math.random() * TAU]);
      n++;
    }
  }
  crowdMesh.count = n; crowdMesh.userData.full = n; crowdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(crowdMesh);
  // light towers
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.18, 'rgba(255,250,220,.7)'); gr.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (HALF_W + 42), z = sz * 72, pole = new THREE.Mesh(new THREE.CylinderGeometry(.6, .9, 44, 8), concrete); pole.position.set(x, 22, z); scene.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 5, .6), new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xfff6dd, emissiveIntensity: 1.4 })); panel.position.set(x, 46, z); panel.lookAt(0, 0, 0); scene.add(panel);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff2d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.position.set(x, 46, z); sp.scale.set(38, 38, 1); scene.add(sp);
  }
  // sideline: benches + LED boards
  const board = document.createElement('canvas'); board.width = 1024; board.height = 64; const bx = board.getContext('2d');
  const boardTex = new THREE.CanvasTexture(board); boardTex.encoding = THREE.sRGBEncoding; boardTex.wrapS = THREE.RepeatWrapping; boardTex.repeat.set(4, 1);
  G_board = { c: board, x: bx, t: boardTex };
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.3, 1.1, 120), new THREE.MeshBasicMaterial({ map: boardTex })); b.position.set(s * (HALF_W + 12.6), .55, 0); scene.add(b);
    for (const z of [-14, 14]) { const bench = new THREE.Mesh(new THREE.BoxGeometry(1, .5, 18), new THREE.MeshStandardMaterial({ color: 0x2b2f3a })); bench.position.set(s * (HALF_W + 8), .25, z); scene.add(bench); }
  }
}
var G_board;
function paintBoard(text, c1, c2) { const { x, c, t } = G_board; x.fillStyle = c2; x.fillRect(0, 0, c.width, c.height); x.fillStyle = c1; x.font = '700 44px "Barlow Condensed", Impact, sans-serif'; x.textBaseline = 'middle'; for (let i = 0; i < 4; i++) x.fillText(text, 20 + i * 256, 34); t.needsUpdate = true; }
let waveT = -9, crowdHype = 0;
function animateCrowd(t, dt) {
  // fans bob a little; on big plays the whole bowl jumps
  if (!crowdMesh || !save.set.q) return;
  const d = new THREE.Object3D(), N = crowdMesh.count, hype = crowdHype, wave = t - waveT < 4;
  const start = (Math.floor(t * 60) % 4) * Math.ceil(N / 4), end = hype > .05 || wave ? N : Math.min(N, start + Math.ceil(N / 4));
  for (let i = hype > .05 || wave ? 0 : start; i < end; i++) {
    const b = crowdBase[i]; let y = b[1] + Math.max(0, Math.sin(t * 3 + b[6])) * .05;
    if (hype > .05) y += Math.max(0, Math.sin(t * 9 + b[6])) * .35 * hype;
    if (wave) { const ph = (Math.atan2(b[2], b[0]) + Math.PI) / TAU, w = ((t - waveT) / 4 - ph); if (w > 0 && w < .08) y += .45; }
    d.position.set(b[0], y, b[2]); d.rotation.y = b[3]; d.scale.set(b[4], b[5], 1); d.updateMatrix(); crowdMesh.setMatrixAt(i, d.matrix);
  }
  crowdMesh.instanceMatrix.needsUpdate = true;
}

// ---------------- players ----------------
const TEAMS = [
  { city: 'Harbor City', name: 'Gulls', abbr: 'HAR', c1: '#1d4e9e', c2: '#f2f2f2', helm: '#1d4e9e', pants: '#d9d9d9', r: 62 },
  { city: 'Ironbridge', name: 'Foundry', abbr: 'IRB', c1: '#30343c', c2: '#ff7a1a', helm: '#2a2d33', pants: '#ff7a1a', r: 64 },
  { city: 'Lakeport', name: 'Mariners', abbr: 'LKP', c1: '#0e7c7b', c2: '#ffffff', helm: '#e8e8e8', pants: '#0e7c7b', r: 67 },
  { city: 'Red Mesa', name: 'Coyotes', abbr: 'RMS', c1: '#9e2a2b', c2: '#e8c07a', helm: '#9e2a2b', pants: '#e8c07a', r: 70 },
  { city: 'Northgate', name: 'Wolves', abbr: 'NGT', c1: '#4a5a6a', c2: '#c8d2dc', helm: '#c8d2dc', pants: '#4a5a6a', r: 72 },
  { city: 'Granite Falls', name: 'Grizzlies', abbr: 'GRF', c1: '#5a3a1a', c2: '#f0c040', helm: '#5a3a1a', pants: '#f0e6d0', r: 75 },
  { city: 'Delta', name: 'Storm', abbr: 'DLT', c1: '#5b2a86', c2: '#ffd23f', helm: '#5b2a86', pants: '#ffd23f', r: 77 },
  { city: 'Capital City', name: 'Monarchs', abbr: 'CAP', c1: '#7a1f3d', c2: '#d4af37', helm: '#d4af37', pants: '#7a1f3d', r: 80 },
  { city: 'Pine Valley', name: 'Timberjacks', abbr: 'PVT', c1: '#1f5a32', c2: '#e9e2c8', helm: '#1f5a32', pants: '#e9e2c8', r: 82 },
  { city: 'Coastline', name: 'Pelicans', abbr: 'CST', c1: '#e06a2a', c2: '#103a5a', helm: '#103a5a', pants: '#f2f2f2', r: 85 },
  { city: 'Summit', name: 'Bighorns', abbr: 'SUM', c1: '#14213d', c2: '#9fb7d8', helm: '#9fb7d8', pants: '#14213d', r: 88 },
  { city: 'Bay Harbor', name: 'Sharks', abbr: 'BHS', c1: '#0b4f6c', c2: '#c0c7cf', helm: '#c0c7cf', pants: '#0b4f6c', r: 91 }
];
const GEO = {
  torso: new THREE.CylinderGeometry(.3, .25, .62, 12), pads: new THREE.SphereGeometry(.4, 14, 10), head: new THREE.SphereGeometry(.165, 16, 12),
  upper: new THREE.CylinderGeometry(.075, .065, .3, 8), lower: new THREE.CylinderGeometry(.062, .052, .28, 8), hand: new THREE.SphereGeometry(.065, 8, 6),
  thigh: new THREE.CylinderGeometry(.105, .085, .46, 8), shin: new THREE.CylinderGeometry(.08, .062, .46, 8), cleat: new THREE.BoxGeometry(.12, .07, .28),
  bar: new THREE.BoxGeometry(.24, .018, .018), barV: new THREE.BoxGeometry(.018, .14, .018), neck: new THREE.CylinderGeometry(.07, .08, .12, 8),
  num: new THREE.PlaneGeometry(.34, .34), hips: new THREE.CylinderGeometry(.24, .22, .22, 10), stripe: new THREE.BoxGeometry(.05, .02, .34), shadow: new THREE.CircleGeometry(.5, 16)
};
GEO.upper.translate(0, -.15, 0); GEO.lower.translate(0, -.14, 0); GEO.thigh.translate(0, -.23, 0); GEO.shin.translate(0, -.23, 0); GEO.cleat.translate(0, -.03, .05);
const SKIN = [0x8d5524, 0xc68642, 0xe0ac69, 0xf1c27d, 0x5c3a21, 0x3d2817];
const matCache = {};
function mat(hex, rough, metal) { const k = hex + '|' + rough + '|' + metal; return matCache[k] || (matCache[k] = linMat(new THREE.MeshStandardMaterial({ color: hex, roughness: rough === undefined ? .7 : rough, metalness: metal || 0 }))); }
// colours are picked in sRGB; the renderer works in linear light
function linMat(m) { if (m.userData.lin) return m; m.userData.lin = 1; if (m.color && !m.map) m.color.convertSRGBToLinear(); if (m.emissive) m.emissive.convertSRGBToLinear(); return m; }
const numCache = {};
function numMat(n, team) {
  const k = team.abbr + n; if (numCache[k]) return numCache[k];
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = team.c1; x.fillRect(0, 0, 128, 128);
  x.font = '800 104px "Barlow Condensed", Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = 8; x.strokeStyle = team.c1 === team.c2 ? '#000' : shadeHex(team.c2, -.4); x.strokeText(n, 64, 70); x.fillStyle = team.c2; x.fillText(n, 64, 70);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return (numCache[k] = new THREE.MeshStandardMaterial({ map: t, roughness: .75 }));
}
function shadeHex(h, f) { const n = parseInt(h.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; } return '#' + ((1 << 24) | (r << 16 & 0xff0000) | ((g | 0) << 8) | (b | 0)).toString(16).slice(1); }
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .32, depthWrite: false });
function buildPlayer(team, num, big) {
  const jersey = mat(team.c1, .75), pants = mat(team.pants, .7), helm = mat(team.helm, .25, .35), skin = mat(SKIN[(Math.random() * SKIN.length) | 0], .8), sock = mat(team.c1, .8), cleat = mat(0x111111, .5), mask = mat(0x9aa0a8, .4, .6), white = mat(team.c2, .7);
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const sx = big ? 1.18 : 1; body.scale.set(sx, 1, sx);
  const hips = new THREE.Group(); hips.position.y = 1.0; body.add(hips);
  const h = new THREE.Mesh(GEO.hips, pants); hips.add(h);
  const torso = new THREE.Group(); torso.position.y = .1; hips.add(torso);
  const t = new THREE.Mesh(GEO.torso, jersey); t.position.y = .32; torso.add(t);
  const pads = new THREE.Mesh(GEO.pads, jersey); pads.scale.set(1.12, .45, .7); pads.position.y = .6; torso.add(pads);
  const nf = new THREE.Mesh(GEO.num, numMat(num, team)); nf.position.set(0, .36, .26); torso.add(nf);
  const nb = new THREE.Mesh(GEO.num, numMat(num, team)); nb.position.set(0, .4, -.25); nb.rotation.y = Math.PI; torso.add(nb);
  const neck = new THREE.Mesh(GEO.neck, skin); neck.position.y = .74; torso.add(neck);
  const head = new THREE.Group(); head.position.y = .9; torso.add(head);
  const hm = new THREE.Mesh(GEO.head, helm); hm.scale.set(1, 1.04, 1.16); head.add(hm);
  const st = new THREE.Mesh(GEO.stripe, white); st.position.set(0, .17, -.01); head.add(st);
  for (const y of [-.05, -.1]) { const b = new THREE.Mesh(GEO.bar, mask); b.position.set(0, y, .19); head.add(b); }
  const bv = new THREE.Mesh(GEO.barV, mask); bv.position.set(0, -.07, .2); head.add(bv);
  const limb = (side) => {
    const sh = new THREE.Group(); sh.position.set(side * .36, .56, 0); torso.add(sh);
    const up = new THREE.Mesh(GEO.upper, jersey); sh.add(up);
    const el = new THREE.Group(); el.position.y = -.3; sh.add(el);
    const lo = new THREE.Mesh(GEO.lower, skin); el.add(lo); const hd = new THREE.Mesh(GEO.hand, mat(0x1a1a1a, .6)); hd.position.y = -.3; el.add(hd);
    const hip = new THREE.Group(); hip.position.set(side * .13, -.02, 0); hips.add(hip);
    const th = new THREE.Mesh(GEO.thigh, pants); hip.add(th); const kn = new THREE.Group(); kn.position.y = -.46; hip.add(kn);
    const sn = new THREE.Mesh(GEO.shin, sock); kn.add(sn); const ft = new THREE.Mesh(GEO.cleat, cleat); ft.position.y = -.46; kn.add(ft);
    return { sh, el, hip, kn };
  };
  const L = limb(1), R = limb(-1);
  const shadow = new THREE.Mesh(GEO.shadow, shadowMat); shadow.rotation.x = -Math.PI / 2; shadow.position.y = .015; root.add(shadow);
  root.traverse(o => { if (o.isMesh && o !== shadow) { o.castShadow = true; } });
  scene.add(root);
  return { root, body, hips, torso, head, L, R, shadow };
}
// procedural animation: run cycle, stances, blocking, throwing, diving, lying down
function animatePlayer(p, dt, t) {
  const m = p.m, sp = Math.hypot(p.vel.x, p.vel.z);
  p.ph += dt * (2.2 + sp * 1.25);
  const run = clamp(sp / 7.5, 0, 1), s = Math.sin(p.ph), c = Math.cos(p.ph);
  let lean = run * .28, hipY = 1.0 - run * .05 + Math.abs(c) * .05 * run, armF = 0, armUpR = 0, armUpL = 0, crouch = 0;
  let legL = s * .95 * run, legR = -s * .95 * run, kneeL = Math.max(0, -c) * 1.3 * run + .12, kneeR = Math.max(0, c) * 1.3 * run + .12, shL = -s * .8 * run, shR = s * .8 * run, elL = -.9 * run - .25, elR = -.9 * run - .25;
  if (p.pose === 'stance') { crouch = 1; }
  if (p.pose === 'block' || p.blockT > 0) { lean = .45; shL = shR = -1.35; elL = elR = -.35; hipY -= .12; }
  if (p.pose === 'throw') { shR = -2.6 + p.throwT * 3.4; elR = -1.2 + p.throwT * 1.0; lean = .1; }
  if (p.pose === 'carry') { shR = -.5; elR = -1.8; }
  if (p.pose === 'catch') { shL = shR = -2.7; elL = elR = -.2; }
  if (p.pose === 'celebrate') { shL = shR = -3; elL = elR = 0; hipY += Math.max(0, Math.sin(t * 9)) * .25; legL = legR = 0; kneeL = kneeR = .1; }
  if (p.stun > 0) { lean = -.25 + Math.sin(t * 12) * .1; }
  if (crouch) { hipY = .62; lean = .95; legL = legR = -.9; kneeL = kneeR = 1.7; shL = p.role === 'OL' || p.role === 'DL' ? -1.4 : -.6; shR = -1.4; elL = elR = -.2; }
  m.hips.position.y = lerp(m.hips.position.y, hipY, Math.min(1, dt * 14));
  m.torso.rotation.x = lerp(m.torso.rotation.x, lean, Math.min(1, dt * 10));
  m.L.hip.rotation.x = -legL; m.R.hip.rotation.x = -legR; m.L.kn.rotation.x = kneeL; m.R.kn.rotation.x = kneeR;
  m.L.sh.rotation.x = shL; m.R.sh.rotation.x = shR; m.L.el.rotation.x = elL; m.R.el.rotation.x = elR;
  m.L.sh.rotation.z = .12; m.R.sh.rotation.z = -.12;
  // falling / diving: tip the whole body over
  const fall = p.fall || 0; m.body.rotation.x = fall * (p.fallDir || 1) * Math.PI / 2 * .96; m.body.position.y = fall * .22;
  m.root.position.set(p.pos.x, p.pos.y || 0, p.pos.z); m.root.rotation.y = p.face;
  m.shadow.scale.setScalar(1 + fall * .8);
}

// ---------------- football ----------------
const ballTex = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#6b3416'; x.fillRect(0, 0, 256, 128); for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '40,18,6' : '140,80,40'},${Math.random() * .35})`; x.fillRect(Math.random() * 256, Math.random() * 128, 2, 2); } x.fillStyle = '#f2efe6'; x.fillRect(118, 0, 20, 128); x.fillRect(20, 0, 6, 128); x.fillRect(230, 0, 6, 128); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; })();
function buildBall() {
  const g = new THREE.Group(), m = new THREE.Mesh(new THREE.SphereGeometry(.1, 20, 14), new THREE.MeshStandardMaterial({ map: ballTex, roughness: .55 }));
  m.scale.set(1, 1, 1.75); m.castShadow = true; g.add(m);
  for (let i = -3; i <= 3; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(.03, .012, .012), mat(0xf4f1e8, .6)); l.position.set(0, .1, i * .022); g.add(l); }
  const lr = new THREE.Mesh(new THREE.BoxGeometry(.008, .01, .16), mat(0xf4f1e8, .6)); lr.position.set(0, .1, 0); g.add(lr);
  return g;
}
const ball = { mesh: buildBall(), pos: V3(0, 1, 0), vel: V3(), state: 'held', holder: null, spin: 0, thrower: null, flightT: 0, tried: new Set(), deflected: false, landing: null };
scene.add(ball.mesh);
const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(.14, 12), shadowMat); ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
// first-person hands + ball
const vm = new THREE.Group(); camera.add(vm);
const vmBall = buildBall(); vmBall.scale.setScalar(.5); vm.add(vmBall);
const vmHandR = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), mat(0x15161a, .6)), vmHandL = vmHandR.clone();
const vmArmR = new THREE.Mesh(new THREE.CylinderGeometry(.03, .036, .3, 10), mat(0x1d4e9e, .7)), vmArmL = vmArmR.clone();
vmArmR.material = vmArmR.material.clone(); vmArmL.material = vmArmR.material;
vm.add(vmHandR, vmHandL, vmArmR, vmArmL);
// landing marker for throws + receiver markers
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .8, depthWrite: false });
const landRing = new THREE.Mesh(new THREE.RingGeometry(.55, .75, 32), ringMat); landRing.rotation.x = -Math.PI / 2; landRing.visible = false; scene.add(landRing);
const markTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(8, 10); x.lineTo(56, 10); x.lineTo(32, 50); x.closePath(); x.fill(); return new THREE.CanvasTexture(c); })();
function makeMarker() { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: markTex, color: 0x4dd2ff, depthTest: false, transparent: true })); s.scale.set(.55, .55, 1); s.renderOrder = 10; s.visible = false; scene.add(s); return s; }
// the throw arc: a dashed line along the ball's predicted flight while you power up
const ARC_N = 34, arcGeo = new THREE.BufferGeometry(); arcGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_N * 3), 3));
const dotTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.5, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const arcMat = new THREE.PointsMaterial({ color: 0xffffff, size: 9, sizeAttenuation: false, map: dotTex, transparent: true, opacity: .9, depthWrite: false, depthTest: false });
const arcLine = new THREE.Points(arcGeo, arcMat); arcLine.frustumCulled = false; arcLine.visible = false; arcLine.renderOrder = 5; scene.add(arcLine);
function setArc(p0, v0, catchY) {
  const a = arcGeo.attributes.position.array, p = p0.clone(), v = v0.clone(); let tEnd = 0;
  { const q = p0.clone(), w = v0.clone(), dt = 1 / 60; for (let i = 0; i < 600; i++) { w.y -= GRAV * dt; q.addScaledVector(w, dt); tEnd += dt; if (w.y < 0 && q.y <= catchY) break; } }
  const dt = tEnd / (ARC_N - 1);
  for (let i = 0; i < ARC_N; i++) { if (i === 0) { v.y -= GRAV * dt * 2; p.addScaledVector(v, dt * 2); } a[i * 3] = p.x; a[i * 3 + 1] = p.y; a[i * 3 + 2] = p.z; v.y -= GRAV * dt; p.addScaledVector(v, dt); }
  arcGeo.attributes.position.needsUpdate = true; arcLine.visible = true;
}
// route lines shown before the snap
const routeLines = [];
function clearRouteLines() { for (const l of routeLines) { scene.remove(l); l.geometry.dispose(); } routeLines.length = 0; }
function drawRoute(points, color) {
  const g = new THREE.BufferGeometry().setFromPoints(points.map(p => V3(p.x, .05, p.z)));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false })); scene.add(l); routeLines.push(l);
}
// confetti / turf kick particles (pooled)
const PCOUNT = 500, pGeo = new THREE.BufferGeometry(), pPos = new Float32Array(PCOUNT * 3), pCol = new Float32Array(PCOUNT * 3), PV = [];
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: .16, vertexColors: true, transparent: true, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
for (let i = 0; i < PCOUNT; i++) { PV.push({ life: 0, vx: 0, vy: 0, vz: 0 }); pPos[i * 3 + 1] = -99; }
let pIdx = 0;
function burst(x, y, z, n, col, spd, up, life) { const c = new THREE.Color(col); for (let k = 0; k < n; k++) { const i = pIdx = (pIdx + 1) % PCOUNT, v = PV[i]; pPos[i * 3] = x; pPos[i * 3 + 1] = y; pPos[i * 3 + 2] = z; const a = Math.random() * TAU, s = spd * Math.random(); v.vx = Math.cos(a) * s; v.vz = Math.sin(a) * s; v.vy = up * (.4 + Math.random()); v.life = life * (.5 + Math.random() * .5); pCol[i * 3] = c.r; pCol[i * 3 + 1] = c.g; pCol[i * 3 + 2] = c.b; } }
function updateParticles(dt) { for (let i = 0; i < PCOUNT; i++) { const v = PV[i]; if (v.life <= 0) continue; v.life -= dt; if (v.life <= 0) { pPos[i * 3 + 1] = -99; continue; } v.vy -= 6 * dt; pPos[i * 3] += v.vx * dt; pPos[i * 3 + 1] = Math.max(.02, pPos[i * 3 + 1] + v.vy * dt); pPos[i * 3 + 2] += v.vz * dt; v.vx *= .98; v.vz *= .98; } pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; }

scene.traverse(o => { if (o.material && !Array.isArray(o.material)) linMat(o.material); });

// =====================================================================================
//  FOOTBALL SIMULATION
// =====================================================================================
const SPD = { QB: 7.3, RB: 8.7, WR: 9.15, TE: 8.0, OL: 6.0, DL: 6.9, LB: 7.9, CB: 8.85, S: 8.6 };
const DIFF = [ // rookie, pro, all-pro
  { name: 'Rookie', spd: .94, lag: .3, tackle: .74, ints: .55, hold: 1.25, rush: .9, catchC: .7, sim: -10 },
  { name: 'Pro', spd: 1.0, lag: .18, tackle: .86, ints: 1, hold: 1, rush: 1, catchC: 1, sim: 0 },
  { name: 'All-Pro', spd: 1.04, lag: .12, tackle: .92, ints: 1.35, hold: .82, rush: 1.12, catchC: 1.25, sim: 8 }
];
// routes: [inside, downfield] steps from the player's start. Positive "inside" is toward the ball.
const R = {
  go: [[0, 45]], slant: [[0, 3], [6, 9], [11, 18]], out: [[0, 6], [-5, 6.5], [-12, 6.8]], qout: [[0, 4], [-6, 4.4], [-12, 4.6]], dig: [[0, 11], [12, 11.5], [24, 12]],
  curl: [[0, 12], [1.5, 10.5]], post: [[0, 12], [8, 23], [14, 42]], corner: [[0, 12], [-8, 22], [-12, 30]], flat: [[-1, 1.5], [-8, 3], [-15, 4]],
  drag: [[0, 2], [14, 5], [32, 6]], drag2: [[0, 2.5], [14, 6.5], [32, 7.5]], seam: [[0, 45]], wheel: [[-5, 1], [-9, 6], [-9, 40]], check: [[-3, 2], [-4, 5]],
  hitch: [[0, 5.5], [.5, 4.6]], screen: [[-3.5, -1.2], [-7, -1.6]], tecurl: [[0, 8], [1.5, 6.8]]
};
const SETTLE = new Set(['curl', 'check', 'hitch', 'screen', 'tecurl']);
const PLAYS = [
  { id: 'slants', name: 'Slants', type: 'pass', form: 'gun', d: 'Quick inside breaks. Get it out fast.', r: { X: 'slant', Z: 'slant', SL: 'qout', TE: 'flat', RB: null } },
  { id: 'verts', name: 'Four Verticals', type: 'pass', form: 'gun', d: 'Everyone runs deep. Find the open one.', r: { X: 'go', Z: 'go', SL: 'seam', TE: 'seam', RB: 'check' } },
  { id: 'mesh', name: 'Mesh', type: 'pass', form: 'gun', d: 'Crossing routes that rub defenders off.', r: { X: 'drag', Z: 'drag2', SL: 'corner', TE: 'dig', RB: 'flat' } },
  { id: 'curlflat', name: 'Curl Flat', type: 'pass', form: 'gun', d: 'Receivers sit down in holes. Safe yards.', r: { X: 'curl', Z: 'curl', SL: 'flat', TE: 'tecurl', RB: 'flat' } },
  { id: 'postcorner', name: 'Post Corner', type: 'pass', form: 'gun', d: 'Max protection, two deep shots.', r: { X: 'post', Z: 'corner', SL: 'dig', TE: null, RB: null } },
  { id: 'screen', name: 'HB Screen', type: 'screen', form: 'gun', d: 'Let the rush come, dump it to the back.', r: { X: 'go', Z: 'go', SL: 'hitch', TE: null, RB: 'screen' } },
  { id: 'dive', name: 'HB Dive', type: 'run', form: 'pistol', d: 'You’re the running back. Hit the hole up the middle.', r: {} },
  { id: 'toss', name: 'HB Toss', type: 'run', form: 'pistol', d: 'You’re the running back. Take the pitch and race the edge.', toss: 1, r: {} }
];
const DCALLS = [
  { id: 'man', name: 'Cover 1 Man', you: 'Free safety', d: 'Everyone else plays man. You roam deep and take away the big play.' },
  { id: 'zone', name: 'Cover 2 Zone', you: 'Middle linebacker', d: 'Two deep safeties. You patrol the middle of the field.' },
  { id: 'blitz', name: 'LB Blitz', you: 'Blitzing linebacker', d: 'You rush the quarterback. Get there before he throws.' },
  { id: 'spy', name: 'QB Spy', you: 'Spy linebacker', d: 'Shadow the quarterback. Stop scrambles and runs.' }
];
const PLAYERS = []; let OFF = [], DEFN = [];
let teamOff = TEAMS[0], teamDef = TEAMS[1];
const OFF_SLOTS = [['QB', 'QB', 7], ['RB', 'RB', 28], ['X', 'WR', 11], ['Z', 'WR', 84], ['SL', 'WR', 17], ['TE', 'TE', 87], ['OL0', 'OL', 71], ['OL1', 'OL', 65], ['OL2', 'OL', 55], ['OL3', 'OL', 62], ['OL4', 'OL', 77]];
const DEF_SLOTS = [['DL0', 'DL', 91], ['DL1', 'DL', 97], ['DL2', 'DL', 93], ['DL3', 'DL', 99], ['LB0', 'LB', 54], ['LB1', 'LB', 52], ['LB2', 'LB', 58], ['CB0', 'CB', 24], ['CB1', 'CB', 21], ['S0', 'S', 32], ['S1', 'S', 38]];
function mkP(side, slot, role, num, team) {
  return { side, slot, role, num, team, m: buildPlayer(team, num, role === 'OL' || role === 'DL'), pos: V3(), vel: V3(), face: 0, ph: Math.random() * 6, pose: '', fall: 0, fallDir: 1, stun: 0, blockT: 0, throwT: 0,
    maxSpd: SPD[role], route: null, ri: 0, settle: false, cover: null, job: '', drop: null, eng: null, engBy: [], shedAt: 0, seen: V3(), react: 0, tried: false, down: false, jukeT: 0, armT: 0, missT: 0, mark: null };
}
function buildRosters(off, def) {
  for (const p of PLAYERS) scene.remove(p.m.root); PLAYERS.length = 0;
  teamOff = off; teamDef = def;
  OFF = OFF_SLOTS.map(([s, r, n]) => mkP(0, s, r, n, off)); DEFN = DEF_SLOTS.map(([s, r, n]) => mkP(1, s, r, n, def));
  PLAYERS.push(...OFF, ...DEFN);
  for (const p of OFF) if (['X', 'Z', 'SL', 'TE', 'RB'].includes(p.slot)) p.mark = p.mark || makeMarker();
  vmArmR.material.color.set(off.c1).convertSRGBToLinear();
}
const by = s => PLAYERS.find(p => p.slot === s);

// ---------------- play state ----------------
const PS = { play: null, los: 0, x0: 0, t: 0, phase: 'presnap', carrier: null, ctrl: null, snapT: 0, result: null, maxZ: 0, defCall: '', qbStart: 0, throwAt: 0, airT: 0, tgt: null, handT: 0, events: [], deadT: 0, crossed: false, yac0: 0, passer: null, tackler: null, fallT: 0 };
let D = DIFF[1], RATE = { arm: 0, rec: 0, line: 0, back: 0, def: 0 };

function setupPlay(play, los, x0, opts) {
  opts = opts || {}; PS.dctrl = null;
  PS.play = play; PS.los = los; PS.x0 = x0; PS.t = 0; PS.phase = 'presnap'; PS.carrier = null; PS.result = null; PS.events.length = 0; PS.deadT = 0; PS.crossed = false; PS.tgt = null; PS.passer = null; PS.tackler = null; PS.fallT = 0;
  ball.state = 'held'; ball.tried.clear(); ball.deflected = false; landRing.visible = false;
  const gun = play.form === 'gun', inside = x => (x > x0 ? -1 : 1);
  const place = (p, x, z, face) => { p.pos.set(x, 0, z); p.vel.set(0, 0, 0); p.face = face === undefined ? 0 : face; p.fall = 0; p.stun = 0; p.down = false; p.eng = null; p.engBy = []; p.pose = ''; p.route = null; p.ri = 0; p.settle = false; p.cover = null; p.job = ''; p.drop = null; p.react = 0; p.tried = false; p.jukeT = 0; p.armT = 0; p.missT = 0; p.blockT = 0; p.tackleCD = 0; p.free = 0; p.human = false; p.diveT = 0; p.diveCD = 0; p.swatT = 0; p.winded = false; p.stam = 1; p.getUp = undefined; p.bt = null; p.btT = 0; p.throwT = 0; p.seen.copy(p.pos); p.m.root.visible = true; };
  const off = Object.fromEntries(OFF.map(p => [p.slot, p])), def = Object.fromEntries(DEFN.map(p => [p.slot, p]));
  const mul = 1 + RATE.rec * .012;
  for (const p of OFF) { p.maxSpd = SPD[p.role] * (p.role === 'WR' || p.role === 'TE' ? mul : p.role === 'RB' ? 1 + RATE.back * .015 : 1); }
  for (const p of DEFN) p.maxSpd = SPD[p.role] * D.spd;
  // offense
  [-2.5, -1.25, 0, 1.25, 2.5].forEach((dx, i) => { place(off['OL' + i], x0 - dx, los - .55); off['OL' + i].pose = 'stance'; });
  place(off.QB, x0, los - (gun ? 5 : 4)); place(off.RB, gun ? x0 - 1.4 : x0, los - (gun ? 5 : 7));
  const lx = clamp(x0 + 19, -HALF_W + 2, HALF_W - 2), rx = clamp(x0 - 19, -HALF_W + 2, HALF_W - 2);
  place(off.X, lx, los - .5); place(off.Z, rx, los - .5); place(off.SL, x0 - 9, los - 1.2); place(off.TE, x0 - 4, los - .55);
  for (const s of ['X', 'Z', 'SL']) off[s].pose = 'stance'; off.TE.pose = 'stance';
  // routes into world points
  for (const s of ['X', 'Z', 'SL', 'TE', 'RB']) {
    const p = off[s], key = play.r[s]; if (!key) continue; const ins = inside(p.pos.x) || 1;
    p.route = R[key].map(([dx, dz]) => V3(clamp(p.pos.x + dx * ins, -HALF_W + .5, HALF_W - .5), 0, p.pos.z + dz)); p.settle = SETTLE.has(key); p.rkey = key;
  }
  // defense: 4-3 with man coverage, a deep safety and a varied fifth job
  [-3.2, -1.1, 1.1, 3.2].forEach((dx, i) => { place(def['DL' + i], x0 + dx, los + .9, Math.PI); def['DL' + i].pose = 'stance'; def['DL' + i].job = 'rush'; });
  place(def.LB0, x0 + 4.5, los + 4.6, Math.PI); place(def.LB1, x0, los + 5, Math.PI); place(def.LB2, x0 - 4.5, los + 4.6, Math.PI);
  const press = opts.press !== undefined ? !!opts.press : Math.random() < .35;
  place(def.CB0, off.X.pos.x + (inside(off.X.pos.x) * .8), los + (press ? 1.4 : 6.5), Math.PI); place(def.CB1, off.Z.pos.x + (inside(off.Z.pos.x) * .8), los + (press ? 1.4 : 6.5), Math.PI);
  place(def.S0, x0 - 8, los + 9, Math.PI); place(def.S1, x0 + 8, los + 14, Math.PI);
  def.CB0.cover = off.X; def.CB0.job = 'man'; def.CB0.cush = press ? 1 : 5.5;
  def.CB1.cover = off.Z; def.CB1.job = 'man'; def.CB1.cush = press ? 1 : 5.5;
  def.S0.cover = off.SL; def.S0.job = 'man'; def.S0.cush = 3;
  def.LB2.cover = off.TE; def.LB2.job = 'man'; def.LB2.cush = 1.5;
  def.S1.job = 'deep';
  const r = Math.random(); PS.defCall = opts.defCall || (r < .28 * D.rush ? 'blitz' : r < .55 ? 'spy' : 'zone'); PS.press = press;
  def.LB1.job = 'man'; def.LB1.cover = off.RB; def.LB1.cush = 2;
  def.LB0.job = PS.defCall === 'blitz' ? 'rush' : PS.defCall === 'spy' ? 'spy' : 'zone'; def.LB0.drop = V3(x0 + 3, 0, los + 8);
  // a human defender takes one spot depending on the call
  if (opts.dcall) {
    const dc = opts.dcall;
    if (dc === 'man') { PS.dctrl = def.S1; def.LB0.job = 'zone'; }
    else if (dc === 'zone') { PS.dctrl = def.LB1; def.LB0.job = 'man'; def.LB0.cover = off.RB; def.LB0.cush = 2; def.S0.job = 'deep'; def.S0.cover = null; place(def.S0, x0 - 9, los + 13, Math.PI); }
    else if (dc === 'blitz') { PS.dctrl = def.LB0; def.LB0.job = 'rush'; }
    else { PS.dctrl = def.LB0; def.LB0.job = 'spy'; }
    PS.dctrl.cover = null; PS.dctrl.stam = 1; if (PS.dctrl.job !== 'rush') PS.dctrl.job = 'human'; PS.dctrl.human = true;
  }
  // blocking assignments: each rusher gets the nearest lineman; spare blockers help
  const rushers = DEFN.filter(d => d.job === 'rush'), ol = OFF.filter(p => p.role === 'OL');
  for (const o of ol) o.blk = null;
  for (const d of rushers) { let best = null, bd = 1e9; for (const o of ol) { if (o.blk) continue; const dd = Math.abs(o.pos.x - d.pos.x); if (dd < bd) { bd = dd; best = o; } } if (best) best.blk = d; }
  for (const o of ol) if (!o.blk) { let best = null, bd = 1e9; for (const d of rushers) { const dd = Math.abs(o.pos.x - d.pos.x); if (dd < bd) { bd = dd; best = d; } } o.blk = best; }
  if (!play.r.TE && play.type !== 'run') off.TE.blk = rushers.find(d => d.slot === 'LB0') || rushers[rushers.length - 1];
  if (!play.r.RB && play.type !== 'run') off.RB.blk = rushers.find(d => d.slot === 'LB0') || null;
  if (play.type === 'run' || play.type === 'screen') { off.TE.blk = def.LB2; }
  if (play.type === 'run') { const seen = new Set(); for (const o of ol) { if (seen.has(o.blk)) o.blk = def.LB1; else seen.add(o.blk); } } // spare lineman climbs to the middle linebacker
  // who you control
  PS.ctrl = play.type === 'run' ? off.RB : off.QB; PS.ctrl.stam = 1; PS.holeX = play.toss ? x0 - 9 : x0 - .3;
  ball.holder = off.OL2; ball.state = 'held';
  for (const p of PLAYERS) animatePlayer(p, .016, 0);
  // field lines
  losLine.position.z = los; fdLine.position.z = Math.min(50, G.fdZ); fdLine.visible = G.fdZ < 50 && !G.drill2pt;
  clearRouteLines();
  if (save.set.routes && play.type !== 'run') for (const s of ['X', 'Z', 'SL', 'TE', 'RB']) { const p = off[s]; if (!p.route) continue; drawRoute([p.pos.clone(), ...p.route], s === 'RB' ? 0x9be7ff : s === 'TE' ? 0xffd166 : 0x7dffb0); }
  if (play.type === 'run') drawRoute([off.RB.pos.clone(), V3(play.toss ? x0 - 9 : x0 - .6, 0, los + (play.toss ? 1 : 4))], 0x7dffb0);
}

// ---------------- steering ----------------
function steer(p, tx, tz, spd, dt, arrive) {
  const dx = tx - p.pos.x, dz = tz - p.pos.z, d = Math.hypot(dx, dz);
  let vx = 0, vz = 0; if (d > .05) { const s = arrive && d < 1.5 ? spd * d / 1.5 : spd; vx = dx / d * s; vz = dz / d * s; }
  accelTo(p, vx, vz, dt);
}
function accelTo(p, vx, vz, dt) {
  const acc = (p.role === 'OL' || p.role === 'DL' ? 9 : 13) * dt, dvx = vx - p.vel.x, dvz = vz - p.vel.z, l = Math.hypot(dvx, dvz);
  if (l > acc) { p.vel.x += dvx / l * acc; p.vel.z += dvz / l * acc; } else { p.vel.x = vx; p.vel.z = vz; }
}
function faceTo(p, yaw, dt) { let d = yaw - p.face; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; p.face += d * Math.min(1, dt * 10); }

// ---------------- snap ----------------
function snap() {
  PS.phase = 'snap'; PS.snapT = 0; clearRouteLines();
  for (const p of PLAYERS) p.pose = '';
  const qb = by('QB'); ball.state = 'snap'; ball.holder = null; ball.from = by('OL2').pos.clone().add(V3(0, .4, 0)); ball.to = qb; ball.flightT = 0;
  AU.hut(); AU.crowdTo(.32);
}
// ---------------- passing ----------------
function predictLanding(p0, v0, catchY) {
  const p = p0.clone(), v = v0.clone(), dt = 1 / 60; let t = 0;
  for (let i = 0; i < 600; i++) { v.y -= GRAV * dt; p.addScaledVector(v, dt); t += dt; if (v.y < 0 && p.y <= catchY) break; }
  return { p, t };
}
function throwVel(power, yaw, pitch, qb) {
  const spd = 11 + power * (17 + RATE.arm * .8);
  let err = .012 + (1 - RATE.arm / 12) * .006;
  const near = DEFN.some(d => !d.eng && Math.hypot(d.pos.x - qb.pos.x, d.pos.z - qb.pos.z) < 2.6); if (near) err += .045 * (1 - RATE.arm * .05);
  err += Math.hypot(qb.vel.x, qb.vel.z) / 7 * .02 + power * .008;
  const y = yaw + (Math.random() - .5) * err * 2, pt = pitch + .07 + (Math.random() - .5) * err * 2;
  return V3(Math.sin(y) * Math.cos(pt) * spd, Math.sin(pt) * spd, Math.cos(y) * Math.cos(pt) * spd);
}
function throwBall(power, yaw, pitch) {
  const qb = PS.ctrl; if (!qb || ball.holder !== qb || PS.phase !== 'live' || qb.pos.z > PS.los + .2) return false;
  const v = throwVel(power, yaw, pitch, qb), fwd = V3(Math.sin(yaw), 0, Math.cos(yaw)), right = V3(-Math.cos(yaw), 0, Math.sin(yaw));
  ball.pos.copy(qb.pos).add(V3(0, 1.95, 0)).addScaledVector(right, .28).addScaledVector(fwd, .35);
  ball.vel.copy(v); ball.state = 'air'; ball.holder = null; ball.thrower = qb; ball.flightT = 0; ball.tried.clear(); ball.deflected = false;
  PS.phase = 'air'; PS.passer = qb; G.stats.att++; qb.pose = 'throw'; qb.throwT = 1;
  const L = predictLanding(ball.pos, ball.vel, 1.5); ball.landing = L;
  // the receiver who can get there goes for it; defenders read it a beat later
  let best = null, bs = 1e9;
  for (const p of OFF) { if (!['WR', 'TE', 'RB'].includes(p.role) || p.down) continue; const d = Math.hypot(p.pos.x - L.p.x, p.pos.z - L.p.z), need = d / p.maxSpd; if (need < L.t * 1.6 + .5 && d < bs) { bs = d; best = p; } }
  PS.tgt = best; for (const d of DEFN) d.react = D.lag + rnd(.08, .3);
  AU.throw(power); return true;
}
function tryCatch(p, dt) {
  if (ball.tried.has(p) || p.down || p.stun > 0 || p.fall > 0) return;
  const hx = p.pos.x, hy = 1.45, hz = p.pos.z, dx = ball.pos.x - hx, dy = ball.pos.y - hy, dz = ball.pos.z - hz, reach = p.side === 0 ? (p === PS.tgt ? 1.35 : 1.15) : p.swatT > PS.t ? 1.45 : .9;
  if (dx * dx + dz * dz > reach * reach || dy < -1.3 || dy > (p.role === 'DL' ? .55 : p.side === 1 ? .95 : 1.25)) return;
  if (p === ball.thrower && ball.flightT < .5) return;
  // right at the release only a rusher with his hands up can get a finger on it
  if (p.side === 1 && ball.flightT < .3) { ball.tried.add(p); if (Math.random() < .07) { deflect(.3); PS.events.push('PBU'); AU.thud(.5); } return; }
  ball.tried.add(p);
  const cont = PLAYERS.filter(q => q.side !== p.side && !q.down && Math.hypot(q.pos.x - hx, q.pos.z - hz) < 1.4).length;
  const spd = ball.vel.length();
  if (p.side === 0) {
    let pc = .87 + RATE.rec * .01 - cont * .3 * D.catchC - (spd > 25 ? .12 : 0) - (ball.deflected ? .25 : 0) - (p.role === 'OL' ? .6 : 0);
    if (Math.random() < pc) return catchBall(p);
    deflect(.45); AU.thud(.4);
  } else {
    const facing = Math.cos(p.face - Math.atan2(-ball.vel.x, -ball.vel.z)), pi = (.08 + Math.max(0, facing) * .13) * D.ints * (ball.deflected ? 1.3 : 1) * (p.swatT > PS.t ? 2.2 : 1);
    if (Math.random() < pi) return catchBall(p);
    if (Math.random() < (p.swatT > PS.t ? .85 : .5)) { deflect(.5); PS.events.push('PBU'); AU.thud(.6); }
  }
}
function deflect(k) { ball.vel.multiplyScalar(k); ball.vel.x += rnd(-3, 3); ball.vel.y = Math.abs(ball.vel.y) * .4 + rnd(1, 3.5); ball.vel.z += rnd(-2, 2); ball.deflected = true; }
function catchBall(p) {
  ball.state = 'held'; ball.holder = p; PS.carrier = p; landRing.visible = false; p.pose = 'carry';
  if (p.side === 0) {
    G.stats.comp++; PS.yac0 = p.pos.z; PS.catchZ = p.pos.z; PS.phase = 'run'; PS.events.push('CATCH'); AU.catchBall(); AU.crowdSwell(.5);
    if (PS.ctrl !== p) { G.switchCtrl(p); }
  } else {
    PS.phase = 'run'; PS.events.push('INT'); AU.catchBall(); AU.boo(); PS.ctrl = null; G.cine = true; G.banner('INTERCEPTED', 'bad');
  }
  for (const d of PLAYERS) d.react = .2 + Math.random() * .25;
  return true;
}

// ---------------- moves: juke + stiff arm ----------------
function juke(dir) { const p = PS.ctrl; if (!p || PS.carrier !== p || p.jukeT > -1.2) return; p.jukeT = .38; p.jukeDir = dir; AU.juke(); for (const d of DEFN) { const dd = Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z); if (dd < 2.3) d.missT = .35; } } // a juke only fools defenders who are right on you
function stiffArm() { const p = PS.ctrl; if (!p || PS.carrier !== p || p.armT > -1.6) return; p.armT = .55; AU.grunt(); }

// ---------------- one simulation step ----------------
function moveCtrl(p, inp, dt) {
  p.diveT = Math.max(0, (p.diveT || 0) - dt);
  if (p.down || p.fall > 0) return;
  if (p.diveT > 0) { if (p.diveT <= dt * 1.5) { p.fall = .01; p.fallDir = 1; } return; } // mid-dive: momentum only
  const yaw = inp.yaw !== undefined ? inp.yaw : G.yaw, fwd = [Math.sin(yaw), Math.cos(yaw)], right = [-Math.cos(yaw), Math.sin(yaw)];
  let mx = inp.x, mz = inp.z; const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  if (p.stam === undefined) p.stam = 1;
  if (p.stam <= .01) p.winded = true; if (p.stam > .35) p.winded = false; // out of breath until you recover a bit
  const sprint = inp.sprint && !p.winded && (mz > .2 || ml > .5), base = p.role === 'QB' && PS.phase !== 'run' ? 5.6 : p.maxSpd * .8;
  let spd = (sprint ? p.maxSpd * (p === PS.carrier || p.side === 1 ? 1 : .95) : base) * (p.stun > 0 ? .5 : 1);
  if (p.engBy && p.engBy.length) { // a human being blocked fights through it, a bit quicker than the computer
    spd *= .3; if (PS.t > p.shedAt - .6 * (p.shedAt - PS.t > 0 ? 1 : 0) && PS.t > p.shedAt * .7) { for (const b of p.engBy) { b.eng = null; b.stun = .6; } p.engBy = []; p.eng = null; p.free = PS.t + 1.6; }
  }
  if (sprint) p.stam = Math.max(0, p.stam - dt / (p.side === 0 ? 3.8 + RATE.back * .25 : 4.5)); else p.stam = Math.min(1, p.stam + dt / 5);
  let vx = (fwd[0] * mz + right[0] * mx) * spd, vz = (fwd[1] * mz + right[1] * mx) * spd;
  if (p.jukeT > 0) { const k = p.jukeT / .38; vx += right[0] * p.jukeDir * 9 * k; vz += right[1] * p.jukeDir * 9 * k; }
  if (PS.phase === 'presnap') { p.vel.set(0, 0, 0); faceTo(p, yaw, dt); return; }
  accelTo(p, vx, vz, dt * (p.jukeT > 0 ? 2.2 : 1.15));
  faceTo(p, yaw, dt);
  // a remote player moves on their own screen and tells us where they are; follow them (within reason)
  if (inp.rp && PS.t - (inp.rpT || -9) < .5) { const ex = inp.rp.x - p.pos.x, ez = inp.rp.z - p.pos.z, ed = Math.hypot(ex, ez); if (ed < 4) { const f = 1 - Math.exp(-dt * 12); p.pos.x += ex * f; p.pos.z += ez * f; } }
}
function dive(p) { if (!p || p.down || p.fall > 0 || p.diveT > 0 || PS.t < (p.diveCD || 0) || PS.phase === 'presnap') return; p.diveT = .32; p.diveCD = PS.t + 1.8; const f = [Math.sin(p.face), Math.cos(p.face)]; p.vel.set(f[0] * 10.5, 0, f[1] * 10.5); AU.grunt(); }
function swat(p) { if (!p || p.down) return; p.swatT = PS.t + .5; p.pose = 'catch'; setTimeout(() => { if (p.pose === 'catch') p.pose = ''; }, 450); }
function stepSim(dt, inp, dinp) {
  PS.t += dt; const los = PS.los, qb = by('QB'), rb = by('RB');
  for (const p of PLAYERS) { p.stun = Math.max(0, p.stun - dt); p.react -= dt; p.jukeT -= dt; p.armT -= dt; p.missT -= dt; p.throwT = Math.max(0, p.throwT - dt * 3); if (p.throwT <= 0 && p.pose === 'throw') p.pose = ''; }
  // ----- ball
  if (ball.state === 'snap') {
    ball.flightT += dt; const k = Math.min(1, ball.flightT / .32), to = ball.to.pos.clone().add(V3(0, 1.2, 0));
    ball.pos.lerpVectors(ball.from, to, k); ball.pos.y += Math.sin(k * Math.PI) * .4;
    if (k >= 1) { ball.state = 'held'; ball.holder = ball.to; PS.phase = 'live'; if (ball.to === qb) qb.pose = 'carry'; }
  } else if (ball.state === 'pitch') {
    ball.flightT += dt; ball.vel.y -= GRAV * dt; ball.pos.addScaledVector(ball.vel, dt);
    if (Math.hypot(ball.pos.x - rb.pos.x, ball.pos.z - rb.pos.z) < 1.3 && ball.pos.y < 2.4) { ball.state = 'held'; ball.holder = rb; PS.carrier = rb; PS.phase = 'run'; rb.pose = 'carry'; AU.catchBall(); }
    else if (ball.pos.y < .12) { ball.state = 'held'; ball.holder = rb; PS.carrier = rb; PS.phase = 'run'; }
  } else if (ball.state === 'air' || ball.state === 'loose') {
    ball.flightT += dt; ball.vel.y -= GRAV * dt; ball.pos.addScaledVector(ball.vel, dt); ball.spin += dt * 28;
    if (ball.flightT > .1) { const cand = PLAYERS.slice().sort((a, b) => (a.pos.distanceTo(ball.pos) - (a.side === 0 ? .5 : 0)) - (b.pos.distanceTo(ball.pos) - (b.side === 0 ? .5 : 0))); for (const p of cand.slice(0, 6)) { if (ball.state !== 'air' && ball.state !== 'loose') break; tryCatch(p, dt); } }
    if ((ball.state === 'air' || ball.state === 'loose') && (ball.pos.y < .12 || Math.abs(ball.pos.x) > HALF_W + 4 || Math.abs(ball.pos.z) > 64)) { ball.pos.y = .12; return endPlay({ type: 'inc' }); }
  }
  if (ball.state === 'held' && ball.holder) {
    const h = ball.holder, f = V3(Math.sin(h.face), 0, Math.cos(h.face)), r = V3(-Math.cos(h.face), 0, Math.sin(h.face));
    ball.pos.copy(h.pos).addScaledVector(f, .22).addScaledVector(r, .2); ball.pos.y = h.down || h.fall > .5 ? .25 : 1.22;
  }
  // ----- handoff / toss on run plays
  if (PS.play.type === 'run' && PS.phase === 'live' && ball.holder === qb) {
    if (PS.play.toss) { if (PS.t > .55) { const lead = rb.pos.clone().addScaledVector(rb.vel, .45); ball.state = 'pitch'; ball.holder = null; ball.flightT = 0; ball.pos.copy(qb.pos).add(V3(0, 1.2, 0)); const dx = lead.x - ball.pos.x, dz = lead.z - ball.pos.z, T = .42; ball.vel.set(dx / T, (0 - 1.2 + .5 * GRAV * T * T) / T + .3, dz / T); AU.throw(.2); } }
    else if (qb.pos.distanceTo(rb.pos) < 1.25 || PS.t > 1.5) { ball.holder = rb; PS.carrier = rb; PS.phase = 'run'; rb.pose = 'carry'; qb.pose = ''; AU.thud(.25); }
  }
  // ----- the players humans control
  const ctrl = PS.ctrl, dctrl = PS.dctrl;
  if (ctrl && inp) moveCtrl(ctrl, inp, dt);
  if (dctrl && dinp) moveCtrl(dctrl, dinp, dt);
  if (ctrl === qb && ball.holder === qb && qb.pos.z > los + .3 && PS.phase === 'live') { PS.phase = 'run'; PS.carrier = qb; PS.events.push('SCRAMBLE'); for (const d of DEFN) d.react = .15; }
  // ----- AI
  const carrier = PS.carrier, running = PS.phase === 'run', air = PS.phase === 'air';
  for (const p of PLAYERS) {
    if (p === ctrl || p === dctrl || p.down || p.fall > 0) continue;
    if (PS.phase === 'presnap' || PS.phase === 'dead') { p.vel.multiplyScalar(.85); continue; }
    if (p.stun > 0) { p.vel.multiplyScalar(Math.pow(.15, dt)); continue; }
    if (p.eng) { engagedMove(p, dt); continue; }
    if (p.side === 0) offenseAI(p, dt, qb, rb, carrier, running, air);
    else defenseAI(p, dt, qb, rb, carrier, running, air);
  }
  // integrate
  for (const p of PLAYERS) {
    if (p.down) { p.vel.set(0, 0, 0); p.fall = Math.min(1, p.fall + dt * 3.2); continue; }
    if (p.fall > 0) { p.fall = Math.min(1, p.fall + dt * 3.2); p.vel.multiplyScalar(Math.pow(.05, dt)); if (p.fall >= 1 && p !== carrier) { p.down = true; p.getUp = 1.2; } }
    p.pos.x += p.vel.x * dt; p.pos.z += p.vel.z * dt;
    if (p !== ctrl && p !== dctrl && Math.hypot(p.vel.x, p.vel.z) > .5) faceTo(p, Math.atan2(p.vel.x, p.vel.z), dt);
    if (p.getUp !== undefined && p.down && p !== carrier && PS.phase !== 'dead') { p.getUp -= dt; if (p.getUp <= 0) { p.down = false; p.fall = 0; p.getUp = undefined; p.stun = .3; } }
  }
  // separation between bodies (blocks hold their own spacing)
  for (let i = 0; i < PLAYERS.length; i++) for (let j = i + 1; j < PLAYERS.length; j++) {
    const a = PLAYERS[i], b = PLAYERS[j]; if (a.down || b.down || a.eng === b || b.eng === a) continue;
    const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d2 = dx * dx + dz * dz, min = .78; if (d2 > min * min || d2 < 1e-6) continue;
    const d = Math.sqrt(d2), o = (min - d) * .5, nx = dx / d, nz = dz / d; a.pos.x -= nx * o; a.pos.z -= nz * o; b.pos.x += nx * o; b.pos.z += nz * o;
  }
  // tackles (a quarterback holding the ball in the pocket can be sacked too)
  { const carrier = PS.carrier || (PS.phase === 'live' && ball.state === 'held' && ball.holder && ball.holder.side === 0 ? ball.holder : null);
  if (carrier && !carrier.down && carrier.fall <= 0 && (PS.phase === 'run' || PS.phase === 'live')) {
    const foes = carrier.side === 0 ? DEFN : OFF;
    for (const d of foes) {
      if (d.down || (d.fall > 0 && !(d.diveT > 0)) || d.stun > 0 || d.eng || d.tackleCD > PS.t) continue;
      const dx = carrier.pos.x - d.pos.x, dz = carrier.pos.z - d.pos.z, dist = Math.hypot(dx, dz); if (dist > (d.diveT > 0 ? 1.9 : 1.3)) continue; // diving reach
      d.tackleCD = PS.t + .6;
      let p = carrier.side === 0 ? (d.human ? (d.diveT > 0 ? .9 : .8) : D.tackle) : .8;
      const cs = Math.hypot(carrier.vel.x, carrier.vel.z); p -= cs > 8 ? .08 : 0;
      if (carrier === ctrl) {
        if (d.missT > 0) p -= .4 + RATE.back * .015; else if (carrier.jukeT > 0) p -= .15;
        if (carrier.armT > 0) { const f = Math.cos(Math.atan2(-dx, -dz) - carrier.face); if (f > .1) { p -= .5; d.stun = .9; d.vel.set(-dx / dist * 4, 0, -dz / dist * 4); AU.thud(.7); bumpCam(.15); continue; } }
      }
      if (carrier.role === 'RB' || carrier.side === 1) p -= .05;
      if (Math.random() < p) { tackle(carrier, d); break; }
      d.stun = .85; d.fall = .01; d.fallDir = 1; d.vel.multiplyScalar(.3); carrier.vel.multiplyScalar(.7); AU.thud(.5); PS.events.push('MISS');
      if (carrier === ctrl) { bumpCam(.25); G.hitStop(.06); }
    }
  } }
  // dead-ball checks
  if (carrier && PS.phase === 'run') {
    if (Math.abs(carrier.pos.x) > HALF_W) return endPlay({ type: 'oob', z: carrier.pos.z });
    if (carrier.side === 0 && carrier.pos.z >= 50) return endPlay({ type: 'td' });
    if (carrier.side === 1 && carrier.pos.z <= -50) return endPlay({ type: 'pick6' });
  }
  if (PS.phase === 'live' && ball.holder === qb && qb.pos.z <= los + .3) {
    if (Math.abs(qb.pos.x) > HALF_W) return endPlay({ type: 'oob', z: qb.pos.z });
  }
  if (PS.t > 30) return endPlay({ type: carrier ? 'down' : 'inc', z: carrier ? carrier.pos.z : los });
  if (PS.phase === 'tackled') { PS.fallT += dt; if (PS.fallT > .55) return endPlay({ type: 'down', z: PS.downZ }); }
}
function tackle(carrier, d) {
  PS.phase = 'tackled'; PS.tackler = d; PS.fallT = 0;
  const v = carrier.vel.clone(); carrier.fall = .01; carrier.fallDir = 1; d.fall = .01; d.fallDir = 1;
  d.face = Math.atan2(carrier.pos.x - d.pos.x, carrier.pos.z - d.pos.z);
  // forward progress: momentum carries the pile a little
  const fp = clamp(v.z * .12, -.6, 1.1); PS.downZ = carrier.pos.z + fp;
  carrier.vel.set(v.x * .3, 0, v.z * .3 + (d.side === 1 ? -.5 : .5)); d.vel.set((carrier.pos.x - d.pos.x) * 2, 0, (carrier.pos.z - d.pos.z) * 2);
  const hard = Math.hypot(v.x, v.z) + Math.hypot(d.vel.x, d.vel.z);
  AU.tackle(clamp(hard / 14, .3, 1)); AU.crowdSwell(.3);
  if (carrier === PS.ctrl) { G.camFall = { t: 0, roll: (Math.random() < .5 ? -1 : 1) * rnd(.4, .9), from: d.pos.clone() }; bumpCam(.6); G.hitStop(.12); }
  const sackish = carrier.role === 'QB' && carrier.pos.z < PS.los && ball.holder === carrier && !PS.crossed;
  if (sackish) PS.events.push('SACK');
  burst(carrier.pos.x, .1, carrier.pos.z, 26, 0x5a8a3a, 4, 3, .8);
}
function engagedMove(p, dt) {
  const other = p.eng; if (!other || other.down) { p.eng = null; return; }
  if (p.side === 1) {
    // defender pushing through a block
    const goal = PS.carrier && PS.phase === 'run' ? PS.carrier.pos : by('QB').pos, dx = goal.x - p.pos.x, dz = goal.z - p.pos.z, d = Math.hypot(dx, dz) || 1;
    const blockers = p.engBy.length;
    if (PS.play.type === 'run') { // run blocking: linemen drive their man back and away from the hole
      const side = Math.sign(p.pos.x - PS.holeX) || 1; accelTo(p, side * 1.5 * blockers, .7 * blockers - .3, dt);
    } else { const push = .6 * D.rush / blockers; accelTo(p, dx / d * push, dz / d * push, dt); }
    if (PS.t > p.shedAt) { for (const b of p.engBy) { b.eng = null; b.stun = .6; b.blockT = 0; } p.engBy = []; p.eng = null; p.free = PS.t + 1.6; p.vel.x += dx / d * 2; p.vel.z += dz / d * 2; }
  } else {
    // blocker sticks to the front of the defender
    const goal = PS.carrier && PS.phase === 'run' ? PS.carrier.pos : by('QB').pos, dx = goal.x - other.pos.x, dz = goal.z - other.pos.z, d = Math.hypot(dx, dz) || 1;
    let tx = other.pos.x + dx / d * .92, tz = other.pos.z + dz / d * .92;
    if (PS.play.type === 'run') { const side = Math.sign(other.pos.x - PS.holeX) || 1; tx = other.pos.x - side * .7; tz = other.pos.z - .6; } p.vel.set((tx - p.pos.x) / Math.max(dt, .016) * .5, 0, (tz - p.pos.z) / Math.max(dt, .016) * .5);
    p.face = Math.atan2(other.pos.x - p.pos.x, other.pos.z - p.pos.z); p.blockT = .2;
    if (!other.engBy.includes(p)) p.eng = null;
  }
}
function tryEngage(b, d) {
  if (!d || d.down || d.fall > 0 || b.stun > 0) return false;
  const dist = Math.hypot(d.pos.x - b.pos.x, d.pos.z - b.pos.z); if (dist > 1.05 || d.engBy.length >= 2 || d.missT > 0 || PS.t < (d.free || 0)) return false;
  if (!d.engBy.length) { const run = PS.play.type === 'run' || PS.phase === 'run', wr = b.role === 'WR' || b.role === 'RB' || b.role === 'TE', open = PS.phase === 'run' && PS.play.type !== 'run'; d.shedAt = PS.t + (open ? rnd(.35, .9) : wr ? rnd(.45, 1.1) : run ? rnd(1.1, 2.4) : rnd(2.8, 4.8)) * (1 + RATE.line * .06) * D.hold; }
  else d.shedAt += 1.3;
  d.engBy.push(b); d.eng = b; b.eng = d; AU.pads(.35); return true;
}
function offenseAI(p, dt, qb, rb, carrier, running, air) {
  const los = PS.los, run = PS.play.type === 'run';
  // after the catch or once someone is running: block for the carrier
  if (running && carrier && carrier.side === 0 && p !== carrier) { blockFor(p, carrier, dt); return; }
  if (running && carrier && carrier.side === 1) { pursue(p, carrier, dt, p.maxSpd * .97); return; }
  if (p.role === 'QB') {
    if (run) { const tgt = PS.play.toss ? V3(qb.pos.x + 1.5, 0, los - 4.5) : V3(rb.pos.x, 0, rb.pos.z + .8); if (ball.holder === qb) steer(p, tgt.x, tgt.z, 4, dt, true); else steer(p, PS.x0 + 3, los - 6, 3, dt, true); }
    else steer(p, p.pos.x, p.pos.z, 0, dt);
    return;
  }
  if (p.role === 'OL' || (p.blk && p.role !== 'WR' && !p.route)) {
    if (PS.play.type === 'screen' && PS.t > 1.4 && p.role === 'OL') { const rbp = rb.pos; steer(p, rbp.x - 3 + (p.num % 3) * 3, rbp.z + 5, 5.5, dt, true); return; }
    const d = p.blk; if (!d || d.down) { steer(p, p.pos.x, p.pos.z + (run ? .5 : -.2), 2, dt, true); return; }
    if (tryEngage(p, d)) return;
    const goal = run ? (ball.holder || rb).pos : qb.pos, dx = goal.x - d.pos.x, dz = goal.z - d.pos.z, l = Math.hypot(dx, dz) || 1; // stay between your man and the ball
    steer(p, d.pos.x + dx / l * .9, d.pos.z + dz / l * .9, p.maxSpd, dt); p.blockT = .2; return;
  }
  if (run) {
    // receivers stalk-block whoever is nearest their side
    const d = DEFN.filter(x => !x.down).sort((a, b) => a.pos.distanceToSquared(p.pos) - b.pos.distanceToSquared(p.pos))[0];
    if (PS.t > .5 && d && !tryEngage(p, d)) steer(p, d.pos.x, d.pos.z - .8, p.maxSpd * .8, dt); else if (PS.t <= .5) steer(p, p.pos.x, p.pos.z + 2, 4, dt);
    return;
  }
  if (air && PS.tgt === p && ball.landing) { const L = ball.landing.p; steer(p, L.x, L.z, p.maxSpd, dt, true); if (Math.hypot(L.x - p.pos.x, L.z - p.pos.z) < 2.5) p.pose = 'catch'; return; }
  // running the route
  if (p.route && p.ri < p.route.length) {
    const w = p.route[p.ri]; steer(p, w.x, w.z, p.maxSpd * (p.ri === 0 && PS.t < .25 ? .7 : 1), dt);
    if (Math.hypot(w.x - p.pos.x, w.z - p.pos.z) < .9) p.ri++;
  } else if (p.route) {
    if (p.settle) { steer(p, p.pos.x, p.pos.z, 0, dt); p.face = Math.atan2(qb.pos.x - p.pos.x, qb.pos.z - p.pos.z); }
    else { const a = p.route[p.route.length - 1], b = p.route[p.route.length - 2] || p.pos; const dx = a.x - b.x, dz = a.z - b.z, l = Math.hypot(dx, dz) || 1; steer(p, clamp(p.pos.x + dx / l * 5, -HALF_W + 1, HALF_W - 1), p.pos.z + dz / l * 5, p.maxSpd * .75, dt); }
  } else if (p.blk) { if (!tryEngage(p, p.blk)) steer(p, p.blk.pos.x, p.blk.pos.z - .9, p.maxSpd, dt); }
  else steer(p, p.pos.x, p.pos.z, 0, dt);
}
function blockFor(p, carrier, dt) {
  // pick the most dangerous unblocked defender near the carrier
  if (p.stun > 0) return;
  if (!p.bt || p.bt.down || p.bt.engBy.length >= 2 || PS.t > (p.btT || 0)) {
    let best = null, bs = 1e9;
    for (const d of DEFN) { if (d.down || d.engBy.length) continue; const dc = Math.hypot(d.pos.x - carrier.pos.x, d.pos.z - carrier.pos.z), dp = Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z); if (dc > 14 || d.pos.z < carrier.pos.z - 4) continue; const s = dc + dp * 1.2; if (s < bs) { bs = s; best = d; } }
    p.bt = best; p.btT = PS.t + .6;
  }
  const d = p.bt; if (!d) { steer(p, carrier.pos.x + (p.pos.x - carrier.pos.x) * .5, carrier.pos.z + 6, p.maxSpd * .7, dt); return; }
  if (tryEngage(p, d)) return;
  const dx = carrier.pos.x - d.pos.x, dz = carrier.pos.z - d.pos.z, l = Math.hypot(dx, dz) || 1;
  steer(p, d.pos.x + dx / l * .9, d.pos.z + dz / l * .9, p.maxSpd, dt);
}
function pursue(p, c, dt, spd) {
  // aim for the point where we can meet the runner (true intercept), not where he is now
  if (p.side === 1 && PS.phase === 'run') spd *= 1.05;
  const dx = c.pos.x - p.pos.x, dz = c.pos.z - p.pos.z, dist = Math.hypot(dx, dz), vx = c.vel.x, vz = c.vel.z;
  const a = vx * vx + vz * vz - spd * spd, b = 2 * (dx * vx + dz * vz), cc = dx * dx + dz * dz; let lead = dist / spd;
  if (Math.abs(a) > 1e-3) { const disc = b * b - 4 * a * cc; if (disc >= 0) { const r1 = (-b - Math.sqrt(disc)) / (2 * a), r2 = (-b + Math.sqrt(disc)) / (2 * a), t = Math.min(r1 > 0 ? r1 : 1e9, r2 > 0 ? r2 : 1e9); if (t < 1e8) lead = t; } }
  lead = clamp(lead, 0, 2.2);
  let tx = c.pos.x + vx * lead, tz = c.pos.z + vz * lead;
  if (p.side === 1 && c.side === 0) tz = Math.max(tz, c.pos.z - .5); // take an angle in front of the runner
  steer(p, tx, tz, spd, dt); if (dist < 3.2 && p.pose !== 'block') p.pose = '';
}
function defenseAI(p, dt, qb, rb, carrier, running, air) {
  const los = PS.los, play = PS.play, spd = p.maxSpd;
  if (running && carrier) { if (carrier.side === 1 && carrier === p) { // interception return: run for the other end zone
      let ax = 0; for (const o of OFF) { const dx = p.pos.x - o.pos.x, dz = p.pos.z - o.pos.z, d = Math.hypot(dx, dz); if (d < 6 && dz > -3) ax += dx / d * (6 - d); }
      steer(p, clamp(p.pos.x + ax * 2, -HALF_W + 2, HALF_W - 2), p.pos.z - 8, spd, dt); return; }
    if (carrier.side === 1) { blockForDef(p, carrier, dt); return; }
    if (p.react > 0) { coverMove(p, dt, qb, rb); return; }
    pursue(p, carrier, dt, spd); return;
  }
  // run read: second level reacts after a beat
  if (play.type === 'run' && PS.t > .3 + D.lag && p.job !== 'rush') { pursue(p, ball.holder || rb, dt, spd * .97); return; }
  if (air && p.react <= 0 && ball.landing) {
    const L = ball.landing.p, d = Math.hypot(L.x - p.pos.x, L.z - p.pos.z), tLeft = ball.landing.t - ball.flightT;
    if (d / spd < tLeft + .2 || d < 2.5) { steer(p, L.x, L.z, spd, dt); if (d < 2.2) p.pose = 'catch'; return; }
  }
  if (p.job === 'rush') {
    if (p.missT > 0) return;
    const tgt = ball.holder && ball.holder.side === 0 ? ball.holder : qb;
    // rushers who are free: angle at the passer, using the blocker list to avoid walking into a block they've shed
    pursue(p, tgt, dt, spd * (PS.t < .3 ? .6 : .85)); return; // rushers close a bit slower so you have time to read
  }
  coverMove(p, dt, qb, rb);
}
function coverMove(p, dt, qb, rb) {
  if (p.job === 'human') { steer(p, p.pos.x, p.pos.z, 0, dt); return; }
  const los = PS.los, spd = p.maxSpd, k = 1 - Math.exp(-dt / Math.max(.05, D.lag));
  if (p.job === 'man' && p.cover) {
    const r = p.cover; p.seen.x += (r.pos.x - p.seen.x) * k; p.seen.z += (r.pos.z - p.seen.z) * k;
    const depth = r.pos.z - los, cush = Math.max(.7, (p.cush || 3) - depth / 5), inside = r.pos.x > PS.x0 ? -.6 : .6;
    // if the receiver blocks or stays home, keep an eye on the QB instead
    if (r.blk && !r.route) { steer(p, qb.pos.x, los + 5, spd * .7, dt, true); return; }
    const gap = Math.hypot(r.pos.x - p.pos.x, r.pos.z - p.pos.z); // beaten defenders put on a recovery burst
    steer(p, p.seen.x + inside + r.vel.x * .3, p.seen.z + cush + r.vel.z * .3, spd * (gap > 2.5 ? 1.06 : 1), dt); return;
  }
  if (p.job === 'deep') {
    let deep = null; for (const o of OFF) if (o.route && (!deep || o.pos.z > deep.pos.z)) deep = o;
    const tz = Math.max(los + 13, (deep ? deep.pos.z : los) + 5), tx = (deep ? deep.pos.x * .55 + PS.x0 * .45 : PS.x0);
    steer(p, tx, tz, spd * .85, dt, true); return;
  }
  if (p.job === 'spy') { if (qb.pos.z > los - .5 || PS.phase === 'run') { pursue(p, qb, dt, spd); return; } steer(p, qb.pos.x, los + 4.5, spd * .8, dt, true); return; }
  if (p.job === 'zone') {
    const dp = p.drop || V3(PS.x0, 0, los + 8); let near = null, nd = 7;
    for (const o of OFF) { if (!o.route) continue; const d = Math.hypot(o.pos.x - dp.x, o.pos.z - dp.z); if (d < nd) { nd = d; near = o; } }
    if (near) steer(p, lerp(dp.x, near.pos.x, .6), lerp(dp.z, near.pos.z, .6), spd, dt, true); else steer(p, dp.x, dp.z, spd, dt, true); return;
  }
  steer(p, p.pos.x, p.pos.z, 0, dt);
}
function blockForDef(p, carrier, dt) {
  let best = null, bs = 1e9; for (const o of OFF) { if (o.down) continue; const d = Math.hypot(o.pos.x - carrier.pos.x, o.pos.z - carrier.pos.z); if (d < bs) { bs = d; best = o; } }
  if (best && bs < 12) { if (Math.hypot(best.pos.x - p.pos.x, best.pos.z - p.pos.z) < 1) { best.stun = Math.max(best.stun, .25); } steer(p, best.pos.x, best.pos.z, p.maxSpd * .9, dt); }
  else steer(p, carrier.pos.x, carrier.pos.z - 4, p.maxSpd * .8, dt);
}
function endPlay(r) {
  if (PS.phase === 'dead') return; PS.phase = 'dead'; PS.result = r; PS.deadT = 0; landRing.visible = false;
  if (r.type === 'inc') { AU.whistle(); AU.thud(.3); }
  else if (r.type === 'td' || r.type === 'pick6') { AU.whistle(.6); }
  else AU.whistle();
  for (const p of PLAYERS) if (p.eng) { p.eng = null; } for (const p of PLAYERS) p.engBy = [];
  G.onPlayEnd(r);
}

// =====================================================================================
//  AUDIO (all generated in code)
// =====================================================================================
const AU = {
  c: null, m: null, fx: null, mu: null, cr: null, crowdLvl: .2, swell: 0,
  init() {
    if (this.c) { if (this.c.state === 'suspended') this.c.resume(); return; }
    try { this.c = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    const c = this.c; this.m = c.createGain(); this.m.connect(c.destination);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5; comp.connect(this.m);
    this.fx = c.createGain(); this.fx.connect(comp); this.mu = c.createGain(); this.mu.connect(comp); this.cr = c.createGain(); this.cr.connect(comp);
    const len = c.sampleRate * 2; this.noise = c.createBuffer(1, len, c.sampleRate); const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // stadium crowd bed: two filtered noise layers with slow movement
    this.crowdG = c.createGain(); this.crowdG.gain.value = .0; this.crowdG.connect(this.cr);
    for (const [f, q, g] of [[520, .7, 1], [1250, 1.1, .55], [2600, 1.4, .18]]) { const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true; s.playbackRate.value = .5 + Math.random() * .1; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; const gg = c.createGain(); gg.gain.value = g; s.connect(bp); bp.connect(gg); gg.connect(this.crowdG); s.start(); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = .13 + Math.random() * .2; lg.gain.value = f * .25; lfo.connect(lg); lg.connect(bp.frequency); lfo.start(); }
    this.apply(); setInterval(() => this.tick(), 50);
  },
  apply() { if (!this.c) return; const s = save.set; this.m.gain.value = s.mute ? 0 : s.vol; this.fx.gain.value = s.sfx; this.mu.gain.value = s.mus * .55; this.cr.gain.value = s.crowd; },
  tick() { if (!this.c) return; this.swell *= .93; crowdHype = Math.max(0, this.swell - .15); const v = Math.min(1.1, this.crowdLvl + this.swell); this.crowdG.gain.setTargetAtTime(v * .55, this.c.currentTime, .25); this.musicTick(); },
  crowdTo(v) { this.crowdLvl = v; }, crowdSwell(v) { this.swell = Math.min(1.2, this.swell + v); },
  env(g, t, a, peak, d) { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0008, t + a + d); },
  tone(f, d, type, v, f2, at, dest) { if (!this.c) return; const c = this.c, t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d); this.env(g, t, .005, v, d); o.connect(g); g.connect(dest || this.fx); o.start(t); o.stop(t + d + .1); },
  hiss(d, f1, f2, v, q, at, type, dest) { if (!this.c) return; const c = this.c, t = c.currentTime + (at || 0), s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noise; s.playbackRate.value = .8 + Math.random() * .4; fl.type = type || 'bandpass'; fl.Q.value = q || 1; fl.frequency.setValueAtTime(f1, t); fl.frequency.exponentialRampToValueAtTime(f2, t + d); this.env(g, t, .004, v, d); s.connect(fl); fl.connect(g); g.connect(dest || this.fx); s.start(t, Math.random()); s.stop(t + d + .1); },
  whistle(len) { if (!this.c) return; len = len || .42; const c = this.c, t = c.currentTime; for (const f of [2750, 3080]) { const o = c.createOscillator(), g = c.createGain(), l = c.createOscillator(), lg = c.createGain(); o.frequency.value = f; l.frequency.value = 34; lg.gain.value = .5; l.connect(lg); lg.connect(g.gain); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.06, t + .02); g.gain.setValueAtTime(.06, t + len); g.gain.linearRampToValueAtTime(0, t + len + .05); o.connect(g); g.connect(this.fx); o.start(t); l.start(t); o.stop(t + len + .1); l.stop(t + len + .1); } },
  hut() { if (!this.c) return; for (const at of [0, .32]) { this.hiss(.16, 900, 500, .3, 2.5, at); this.tone(150, .16, 'sawtooth', .07, 110, at); } },
  throw(p) { this.hiss(.35, 600, 2400, .16 + p * .2, 1.4); this.tone(140, .1, 'sine', .15, 90); },
  catchBall() { this.hiss(.07, 1800, 900, .35, 1.6); this.tone(130, .12, 'sine', .3, 80); },
  thud(v) { this.tone(95, .18, 'sine', .45 * v, 50); this.hiss(.12, 700, 200, .25 * v, 1.2); },
  pads(v) { this.hiss(.06, 3200, 1800, .22 * v, 3); this.tone(220, .07, 'triangle', .12 * v, 160); },
  tackle(v) { this.tone(70, .45, 'sine', .7 * v, 38); this.hiss(.3, 900, 120, .45 * v, .8); this.pads(1); this.hiss(.5, 400, 300, .12, .6, .05, 'lowpass', this.cr); },
  juke() { this.hiss(.12, 3800, 2200, .2, 2.4); },
  grunt() { this.hiss(.18, 420, 260, .3, 3); this.tone(120, .16, 'sawtooth', .06, 95); },
  step() { this.hiss(.05, 1400, 600, .05, 1.5); },
  kick() { this.tone(110, .25, 'sine', .7, 50); this.hiss(.1, 1600, 400, .4, 1); },
  boo() { this.swell = 0; for (let i = 0; i < 3; i++) this.hiss(1.4, 340, 260, .22, 2, i * .1, 'bandpass', this.cr); },
  horn() { if (!this.c) return; for (const f of [233, 294, 349, 466]) this.tone(f, 1.6, 'sawtooth', .05, 0, 0); for (const f of [233, 294, 349, 466]) this.tone(f * 1.003, 1.6, 'sawtooth', .04, 0, .02); },
  click() { this.tone(820, .04, 'square', .03, 600); },
  good() { [523, 659, 784].forEach((f, i) => this.tone(f, .5, 'triangle', .12, 0, i * .08)); },
  bad() { this.tone(220, .5, 'triangle', .12, 140); },
  // menu drumline + brass stabs
  mT: 0, step16: 0, musicOn: false,
  musicTick() {
    if (!this.musicOn || !this.c) return; const c = this.c, BEAT = 60 / 104 / 4;
    if (this.mT < c.currentTime) this.mT = c.currentTime + .05;
    while (this.mT < c.currentTime + .25) {
      const st = this.step16 % 32, t = this.mT - c.currentTime;
      if ([0, 6, 8, 16, 22, 24, 27].includes(st)) this.tone(58, .25, 'sine', .45, 40, t, this.mu);
      if ([4, 12, 20, 28].includes(st) || (st > 28 && Math.random() < .7)) this.hiss(.12, 2400, 1800, .18, .9, t, 'bandpass', this.mu);
      if (st % 2 === 1) this.hiss(.03, 7000, 6000, .05, 1, t, 'highpass', this.mu);
      if (st === 0 || st === 16) { const root = [155.6, 174.6, 130.8, 116.5][(this.step16 / 32 | 0) % 4]; for (const k of [1, 1.26, 1.5]) { this.tone(root * k, .35, 'sawtooth', .035, 0, t, this.mu); this.tone(root * k * 2, .25, 'square', .012, 0, t, this.mu); } }
      this.mT += BEAT; this.step16++;
    }
  }
};

// =====================================================================================
//  GAME FLOW
// =====================================================================================
const G = {
  state: 'menu', mode: '', yaw: 0, pitch: -.08, stamina: 1, cine: false, camFall: null, shake: 0, hs: 0, off: 0, S: null, power: 0, charging: false, t: 0, fdZ: 10, drill2pt: false,
  my: TEAMS[0], opp: TEAMS[1], sc: [0, 0], q: 1, clock: 240, los: -25, x0: 0, down: 1, togo: 10, ot: 0, half2: false, otNeed: null, lastFrom: null, blend: 0, tutShown: {},
  switchCtrl(p) { this.lastFrom = camera.position.clone(); this.blend = 1; PS.ctrl = p; this.cine = false; tip('carry', 'You have the ball! <b>Shift</b> sprints, <b>Space</b> jukes (with A or D), <b>E</b> or right-click stiff-arms.'); },
  banner(t, kind, sub) { const el = $('banner'); el.className = 'show ' + (kind || ''); el.innerHTML = `<b>${t}</b>${sub ? `<span>${sub}</span>` : ''}`; clearTimeout(this.bt); this.bt = setTimeout(() => el.className = '', 1900); },
  hitStop(s) { this.hs = Math.max(this.hs, s); },
  onPlayEnd(r) { resolvePlay(r); }
};
Object.defineProperty(G, 'stats', { get() { return this.S ? this.S[this.off || 0] : null; } });
window.__GF = { G, PS, PLAYERS, ball, get save() { return save; }, AU, by, stepSim, throwBall, juke, stiffArm, setupPlay, snap, PLAYS, TEAMS };
function bumpCam(v) { if (save.set.shake) G.shake = Math.max(G.shake, v); }
function yardText(z) { const y = Math.round(z + 50); return y === 50 ? '50' : y < 50 ? 'OWN ' + y : 'OPP ' + (100 - y); }
function clockText(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
const ORD = ['', '1st', '2nd', '3rd', '4th'];

function newGame(mode, oppIdx, st) {
  G.mode = mode; const se = save.season; G.off = 0;
  G.my = mode === 'season' ? TEAMS[se.team] : mode === 'mp' ? TEAMS[MP.T[0]] : TEAMS[save.myTeam || 0];
  G.opp = TEAMS[oppIdx];
  RATE = mode === 'season' ? Object.assign({}, se.rate) : { arm: 3, rec: 3, line: 3, back: 3, def: 3 };
  D = DIFF[mode === 'mp' ? 1 : save.set.diff];
  if (mode === 'mp') { G.off = G.firstOff = st && st.first ? 1 : 0; mpRebuild(); } else buildRosters(G.my, G.opp);
  paintField(G.my.name.toUpperCase(), G.my.c1, G.opp.name.toUpperCase(), G.opp.c1); paintBoard(`${G.my.city.toUpperCase()} ${G.my.name.toUpperCase()}   ·   GRIDIRON   ·   ${G.opp.city.toUpperCase()} ${G.opp.name.toUpperCase()}   ·`, G.my.c2, G.my.c1);
  G.sc = [0, 0]; G.q = 1; G.ot = 0; G.half2 = false; G.otNeed = null;
  G.clock = mode === 'drill' ? 120 : save.set.qlen * 60;
  const mk = () => ({ comp: 0, att: 0, pass: 0, rush: 0, td: 0, int: 0, sack: 0, long: 0, fg: 0 }); G.S = [mk(), mk()];
  $('bugMy').textContent = G.my.abbr; $('bugOpp').textContent = mode === 'drill' ? 'DRILL' : G.opp.abbr; $('bugMy').style.background = G.my.c1; $('bugOpp').style.background = mode === 'drill' ? '#333a46' : G.opp.c1;
  showScreen(null); $('hud').classList.remove('hide'); AU.musicOn = false; AU.crowdTo(.3);
  G.state = 'intro'; G.introT = 0;
  if (mode === 'mp') { G.banner(`${G.my.abbr} vs ${G.opp.abbr}`, '', `${TEAMS[MP.T[G.off]].name} get the ball first`); if (MP.host) setTimeout(() => startDrive(25), 2000); return; }
  G.banner(mode === 'drill' ? 'TWO-MINUTE DRILL' : `${G.my.abbr} vs ${G.opp.abbr}`, '', mode === 'drill' ? 'Score as much as you can before the clock runs out' : 'Kickoff. You start at your own 25');
  setTimeout(() => startDrive(25), 1800);
}
function startDrive(ownYard) {
  G.los = ownYard - 50; G.x0 = 0; G.down = 1; G.togo = 10; G.fdZ = Math.min(50, G.los + 10); G.drive0 = G.los;
  openPlaycall();
}
function openPlaycall() {
  if (G.state === 'over') return;
  if (G.mode === 'mp') return mpPlaycall();
  G.state = 'playcall'; updBug(); document.exitPointerLock && document.exitPointerLock();
  // stage the field behind the playcall card so the player can see where they are
  setupPlay(PLAYS[0], G.los, G.x0); camLook(); for (const p of PLAYERS) p.m.root.visible = true; clearRouteLines();
  const fourth = G.down === 4, fgDist = Math.round(50 - G.los + 17), canFG = fgDist <= 62;
  $('pcSit').innerHTML = `<b>${ORD[G.down]} &amp; ${G.fdZ >= 50 ? 'Goal' : G.togo}</b> · ${yardText(G.los)}${G.mode === 'drill' ? '' : ' · Q' + Math.min(G.q, 4) + (G.ot ? ' OT' : '')} · ${G.ot ? 'Overtime' : clockText(G.clock)}`;
  $('pcList').innerHTML = PLAYS.map((p, i) => `<button class="pc" data-i="${i}"><canvas width="160" height="96"></canvas><b>${p.name}</b><span>${p.d}</span><em>${i + 1}</em></button>`).join('') +
    (G.down >= 3 || G.mode === 'drill' ? `<div class="special">${canFG ? `<button class="sp" data-s="fg">Field goal <small>${fgDist} yds</small></button>` : ''}${fourth && G.mode !== 'drill' ? `<button class="sp" data-s="punt">Punt</button>` : ''}</div>` : '');
  $('pcList').querySelectorAll('.pc').forEach(b => { drawPlayArt(b.querySelector('canvas'), PLAYS[+b.dataset.i]); b.onclick = () => choosePlay(PLAYS[+b.dataset.i]); });
  $('pcList').querySelectorAll('.sp').forEach(b => b.onclick = () => { AU.click(); if (b.dataset.s === 'fg') startFG(); else doPunt(); });
  showScreen('playcall');
  tip('call', 'Pick a play. On a pass play you’re the quarterback. On HB plays you’re the running back.');
}
function drawPlayArt(c, p) {
  const x = c.getContext('2d'), W = c.width, H = c.height; x.clearRect(0, 0, W, H); x.fillStyle = 'rgba(30,90,40,.55)'; x.fillRect(0, 0, W, H);
  const sx = v => W / 2 - v * 3.2, sz = v => H - 22 - v * 3.4; x.strokeStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(0, sz(0)); x.lineTo(W, sz(0)); x.stroke();
  const pos = { X: [19, -.5], Z: [-19, -.5], SL: [-9, -1.2], TE: [-4, -.5], RB: p.form === 'gun' ? [-1.4, -5] : [0, -7], QB: [0, p.form === 'gun' ? -5 : -4] };
  x.fillStyle = '#fff'; for (const dx of [-2.5, -1.25, 0, 1.25, 2.5]) { x.fillRect(sx(dx) - 2, sz(-.5) - 2, 4, 4); }
  x.lineWidth = 2.2; x.lineJoin = 'round';
  for (const [s, [px, pz]] of Object.entries(pos)) {
    x.fillStyle = s === 'QB' ? '#ffd166' : '#fff'; x.beginPath(); x.arc(sx(px), sz(pz), 3, 0, TAU); x.fill();
    const key = p.r[s]; if (!key) continue; const ins = px > 0 ? -1 : 1; x.strokeStyle = s === 'RB' ? '#9be7ff' : '#7dffb0'; x.beginPath(); x.moveTo(sx(px), sz(pz)); for (const [dx, dz] of R[key]) x.lineTo(sx(px + dx * ins), sz(Math.min(pz + dz, 20))); x.stroke();
  }
  if (p.type === 'run') { x.strokeStyle = '#ffd166'; x.beginPath(); x.moveTo(sx(0), sz(-7)); if (p.toss) { x.lineTo(sx(-8), sz(-4)); x.lineTo(sx(-11), sz(6)); } else { x.lineTo(sx(-.6), sz(4)); x.lineTo(sx(-.6), sz(12)); } x.stroke(); }
}
function choosePlay(play, opts) {
  AU.click(); showScreen(null); G.play = play;
  const off = localIsOff();
  setupPlay(play, G.los, G.x0, opts); if (!off || (MP.on && !localIsOff())) clearRouteLines();
  G.yaw = off ? 0 : Math.PI; G.pitch = off ? (play.type === 'run' ? -.06 : -.1) : -.12; G.state = 'presnap'; G.power = 0; G.charging = false; G.cine = false; G.camFall = null; G.stamina = 1; G.blend = 0;
  const dc = opts && opts.dcall && DCALLS.find(d => d.id === opts.dcall);
  $('prompt').innerHTML = !off ? `You’re the <b>${dc ? dc.you.toLowerCase() : 'defender'}</b>. Run into the ball carrier to tackle · <b>Space</b> dives · <b>click</b> to swat a pass`
    : isTouch() ? 'Tap <b>SNAP</b> to start the play' : 'Click to grab the mouse, then press <b>SPACE</b> to snap';
  lockPointer();
  tip('snap', play.type === 'run' ? 'Run play: after the snap the ball is handed to you. Follow your blockers through the hole.' : 'Glowing lines show each receiver’s route. Press <b>Space</b> to snap.');
}
function doSnap() { if (G.state !== 'presnap') return; G.state = 'live'; $('prompt').innerHTML = ''; snap(); if (PS.play.type !== 'run') tip('throw', 'Hold <b>left click</b> to power up a throw and release to throw where you’re looking. The ring shows where it will land.'); }
function resolvePlay(r) {
  G.state = 'dead'; G.power = 0; G.charging = false; $('prompt').innerHTML = '';
  const c = PS.carrier, playTime = Math.min(PS.t, 12), ev = PS.events;
  let next = 'down', msg = '', kind = '', sub = '';
  if (ev.includes('SACK')) G.stats.sack++;
  if (r.type === 'inc') { msg = ev.includes('PBU') ? 'BROKEN UP' : 'INCOMPLETE'; kind = 'bad'; G.down++; }
  else if (r.type === 'pick6') { G.stats.int++; G.sc[1 - G.off] += 7; msg = 'PICK SIX'; kind = 'bad'; sub = 'Returned for a touchdown'; next = 'opp-scored'; AU.boo(); }
  else {
    let z = r.type === 'td' ? 50 : clamp(r.z, -55, 50);
    if (c && c.side === 1) { // interception, tackled during the return
      G.stats.int++; msg = 'INTERCEPTED'; kind = 'bad'; next = 'turnover'; G.turnZ = z;
    } else {
      const gain = z - G.los, passPlay = PS.passer && c && c !== PS.passer;
      if (passPlay) G.stats.pass += Math.round(gain); else G.stats.rush += Math.round(gain);
      if (r.type === 'td') {
        G.stats.td++; G.sc[G.off] += 7; msg = 'TOUCHDOWN!'; kind = 'good'; sub = `${Math.round(gain)}-yard ${passPlay ? 'pass' : 'run'}`; next = 'scored';
        save.rec.longTD = Math.max(save.rec.longTD, Math.round(gain)); AU.horn(); AU.crowdSwell(1.2); waveT = G.t; celebrate(c);
      } else if (z <= -50) { G.sc[1 - G.off] += 2; msg = 'SAFETY'; kind = 'bad'; next = 'safety'; }
      else {
        G.los = z; G.x0 = clamp(c ? c.pos.x : G.x0, -HASH, HASH);
        if (ev.includes('SACK')) { msg = 'SACKED'; kind = 'bad'; sub = `Loss of ${Math.abs(Math.round(gain))}`; }
        if (z >= G.fdZ) { G.down = 1; G.fdZ = Math.min(50, z + 10); G.togo = Math.round(G.fdZ - z); if (!msg) { msg = 'FIRST DOWN'; kind = 'good'; sub = `Gain of ${Math.round(gain)}`; AU.crowdSwell(.5); AU.good(); } }
        else { G.down++; G.togo = Math.max(1, Math.round(G.fdZ - z)); if (!msg) { msg = gain >= 0 ? `GAIN OF ${Math.round(gain)}` : `LOSS OF ${Math.abs(Math.round(gain))}`; sub = r.type === 'oob' ? 'Out of bounds' : ''; } }
        if (gain >= 20 && msg === 'FIRST DOWN') { msg = 'BIG PLAY!'; sub = `${Math.round(gain)} yards`; AU.crowdSwell(.8); }
      }
    }
  }
  if (r.type === 'inc' && G.down <= 4) G.togo = Math.max(1, Math.round(G.fdZ - G.los));
  if (next === 'down' && G.down > 4) { next = 'downs'; msg = 'TURNOVER ON DOWNS'; kind = 'bad'; }
  // clock
  const stops = r.type === 'inc' || r.type === 'oob' || next !== 'down' || G.ot;
  let run = playTime;
  if (!stops && !G.ot) run += G.mode === 'drill' ? 5 : ((G.q === 2 || G.q === 4) && G.clock < 60 * QS() ? 3 : 7) * QS();
  if (!G.ot) G.clock -= run;
  G.banner(msg, kind, sub); if (kind === 'bad' && next !== 'down') AU.bad();
  G.after = next; G.deadT = 0;
  updBug();
}
function celebrate(c) { if (!c) return; if (MP.on && MP.host) mpEvent('celebrate', []); burst(c.pos.x, 1, c.pos.z, 180, teamOff.c1, 9, 9, 2.4); burst(c.pos.x, 1, c.pos.z, 120, teamOff.c2, 9, 9, 2.4); for (const p of OFF) if (p.pos.distanceTo(c.pos) < 18) p.pose = 'celebrate'; }
function afterPlay() {
  // decide what happens after the whistle (called ~2s later)
  const n = G.after; G.after = null; FG.phase = '';
  if (G.mode === 'mp') return mpAfter(n);
  if (G.mode === 'drill') {
    if (G.clock <= 0) return endGame();
    if (n === 'down') return openPlaycall();
    return startDrive(25);
  }
  if (G.ot) return otAfterMyDrive(n);
  if (n === 'down') return G.clock <= 0 ? endQuarter(openPlaycall) : openPlaycall();
  // my drive is over: the other team gets the ball (after a pick six they kick off to me instead)
  let oppStart = 25;
  if (n === 'turnover' || n === 'downs') oppStart = clamp(Math.round(50 - (n === 'turnover' ? G.turnZ : G.los)), 1, 99);
  const next = n === 'opp-scored' ? () => startDrive(25) : () => oppTurn(oppStart);
  if (G.clock <= 0) return endQuarter(next);
  next();
}
function endQuarter(next) {
  const wasQ = G.q; G.q++; G.clock = save.set.qlen * 60;
  if (wasQ === 2 && G.mode === 'mp') { G.banner('HALFTIME', '', `${TEAMS[MP.T[0]].abbr} ${G.sc[0]} – ${G.sc[1]} ${TEAMS[MP.T[1]].abbr}`); setTimeout(() => { G.off = G.firstOff; mpPossess(25); }, 2200); return; }
  if (wasQ >= 4 && G.mode === 'mp') { G.clock = 0; if (G.sc[0] !== G.sc[1]) return endGame(); G.ot = 1; G.banner('OVERTIME', '', 'Next score wins'); setTimeout(() => { G.off = Math.random() < .5 ? 1 : 0; mpPossess(25); }, 2200); return; }
  if (wasQ === 2) { G.banner('HALFTIME', '', `${G.my.abbr} ${G.sc[0]} – ${G.sc[1]} ${G.opp.abbr} · ${G.opp.abbr} receives`); setTimeout(() => oppTurn(25), 2200); return; }
  if (wasQ >= 4) { G.clock = 0; if (G.sc[0] === G.sc[1]) return startOT(); return endGame(); }
  G.banner('END OF Q' + wasQ, '', ''); setTimeout(next, 1600);
}
const QS = () => save.set.qlen / 4; // everything on the game clock scales with quarter length
// opponent drives are simulated, then shown as a summary card
function simDrive(startYard, clockLeft) {
  const oppR = G.opp.r + D.sim, myDef = 56 + RATE.def * 4.2, edge = (oppR - myDef) / 100, field = (startYard - 25) / 100;
  const pTD = clamp(.25 + edge * .9 + field * .7, .05, .66), pFG = clamp(.19 + edge * .2 + field * .25, .07, .34), pTO = clamp(.12 - edge * .3, .04, .26);
  const r = Math.random(); let res = r < pTD ? 'TD' : r < pTD + pFG ? 'FG' : r < pTD + pFG + pTO ? 'TO' : 'PUNT';
  const T = { TD: [55, 115], FG: [45, 100], PUNT: [25, 70], TO: [15, 60] }[res]; let time = rnd(T[0], T[1]) * QS();
  const plays = Math.max(3, Math.round(time / QS() / 12 + rnd(-1, 2))); let yards = res === 'TD' ? 100 - startYard : res === 'FG' ? Math.round(rnd(.5, .8) * (100 - startYard)) : Math.round(rnd(5, 35));
  if (G.ot) time = 0;
  else if (time > clockLeft) { time = clockLeft; if (res !== 'TO' && Math.random() < .65) res = clockLeft > 15 * QS() && Math.random() < .5 ? 'FG' : 'HALF'; }
  return { res, time, plays, yards, start: startYard };
}
function oppTurn(startYard, halftime) {
  G.state = 'opp'; document.exitPointerLock && document.exitPointerLock();
  const halfEnds = G.q === 2 || G.q >= 4, s = simDrive(startYard, halfEnds ? G.clock : 1e9);
  if (s.res === 'TD') G.sc[1] += 7; if (s.res === 'FG') G.sc[1] += 3;
  G.clock -= s.time; G.lastSim = s;
  if (G.clock <= 0 && !halfEnds && !G.ot) { G.q++; G.clock += save.set.qlen * 60; } // their drive rolled into the next quarter
  const label = { TD: 'TOUCHDOWN', FG: 'FIELD GOAL', PUNT: 'PUNT', TO: 'TURNOVER!', HALF: 'CLOCK RAN OUT' }[s.res];
  const good = s.res === 'TO' || s.res === 'PUNT' || s.res === 'HALF';
  $('oppT').textContent = `${G.opp.city} ${G.opp.name} drive`; $('oppR').textContent = label; $('oppR').className = good ? 'good' : 'bad';
  $('oppD').textContent = s.res === 'HALF' ? `${s.plays} plays, ${s.yards} yards before time ran out.` : `${s.plays} plays · ${s.yards} yards · ${clockText(s.time)}${s.res === 'TO' ? ' · Your defense takes it away!' : s.res === 'PUNT' ? ' · Your defense holds.' : ''}`;
  $('oppS').innerHTML = `<span style="background:${G.my.c1}">${G.my.abbr} ${G.sc[0]}</span><span style="background:${G.opp.c1}">${G.opp.abbr} ${G.sc[1]}</span>`;
  showScreen('oppOv'); if (good) { AU.crowdSwell(.6); AU.good(); } else AU.bad();
  updBug();
  G.oppNext = () => {
    if (G.ot) return otAfterOppDrive(s);
    let my = 25; if (s.res === 'PUNT') my = Math.round(rnd(12, 32)); if (s.res === 'TO') my = clamp(Math.round(100 - (s.start + s.yards)), 15, 60);
    const next = () => { showScreen(null); startDrive(my); };
    if (G.clock <= 0) { G.clock = 0; showScreen(null); return endQuarter(next); }
    next();
  };
}
// overtime: they get one possession, then you answer
function startOT() { G.ot = 1; G.banner('OVERTIME', '', 'Each team gets a possession from the 25'); setTimeout(() => oppTurn(75), 1900); }
function otAfterOppDrive(s) { G.otNeed = s.res === 'TD' ? 7 : s.res === 'FG' ? 3 : 0; G.otBase = G.sc[0]; showScreen(null); startDrive(75); }
function otAfterMyDrive(n) {
  if (n === 'down') return openPlaycall();
  const got = G.sc[0] - G.otBase;
  if (G.sc[0] !== G.sc[1] && (got > G.otNeed || got < G.otNeed || G.otNeed === 0)) return endGame();
  G.ot++; G.banner('STILL TIED', '', 'Another round of overtime'); setTimeout(() => oppTurn(75), 1900);
}
// ---------------- kicking ----------------
function doPunt() {
  showScreen(null); const losY = G.los + 50, dist = Math.round(rnd(36, 49)); let land = losY + dist, tb = false; if (land >= 100) { land = 80; tb = true; }
  AU.kick(); G.banner('PUNT', '', tb ? 'Touchback' : `${dist} yards`); G.after = null; G.state = 'dead';
  setTimeout(() => { const next = G.mode === 'mp' ? () => mpPossess(Math.round(100 - land)) : () => oppTurn(Math.round(100 - land)); if (G.clock <= 0) return endQuarter(next); next(); }, 1500);
}
const FG = { phase: '', p: 0, wind: 0, t: 0 };
function startFG() {
  showScreen(null); G.state = 'fg'; FG.phase = 'aim'; FG.p = 0; FG.t = 0; FG.wind = rnd(-4, 4) * (Math.random() < .3 ? 0 : 1);
  for (const p of PLAYERS) p.m.root.visible = false;
  const h = by('OL2'); h.m.root.visible = true; h.pos.set(G.x0 + .3, 0, G.los - 7); h.face = 0; h.pose = 'stance'; h.fall = 0; animatePlayer(h, .016, 0);
  for (const p of DEFN.slice(0, 6)) { p.m.root.visible = true; p.pos.set(G.x0 + (p.num % 7 - 3) * 1.2, 0, G.los + 1); p.face = Math.PI; p.pose = 'stance'; p.fall = 0; animatePlayer(p, .016, 0); }
  ball.state = 'kick'; ball.pos.set(G.x0, .18, G.los - 7); ball.vel.set(0, 0, 0); G.yaw = 0; G.pitch = .08;
  const dist = Math.round(50 - G.los + 17);
  if (!localIsOff()) { $('prompt').innerHTML = `Your opponent is trying a ${dist}-yard field goal…`; return; }
  $('prompt').innerHTML = `${dist}-yard attempt · wind <b>${FG.wind === 0 ? 'calm' : Math.abs(FG.wind * 4).toFixed(0) + ' mph ' + (FG.wind > 0 ? '←' : '→')}</b> · Aim with the mouse, hold <b>left click</b> and release at full power`;
  lockPointer();
}
function fgUpdate(dt) {
  if (FG.phase === 'aim') { if (G.charging) { FG.t += dt; FG.p = Math.abs(Math.sin(FG.t * 1.9)); } return; }
  if (FG.phase === 'flight') {
    ball.vel.y -= GRAV * dt; ball.vel.x += FG.wind * dt * .35; ball.pos.addScaledVector(ball.vel, dt); ball.spin += dt * 14;
    if (!FG.done && ball.pos.z >= 60.3) { FG.done = true; const good = Math.abs(ball.pos.x) < HASH && ball.pos.y > 3.33; fgResult(good); }
    if (!FG.done && (ball.pos.y < .1 || ball.vel.z <= 0)) { FG.done = true; fgResult(false); }
  }
}
function kickFG(pw, yw, pt) {
  if (FG.phase !== 'aim') return; FG.phase = 'flight'; FG.done = false; G.charging = false; $('prompt').innerHTML = '';
  const p = pw === undefined ? FG.p : pw, ay = yw === undefined ? G.yaw : yw, ap = pt === undefined ? G.pitch : pt;
  const spd = 17 + p * 17, pitch = clamp(ap + .55, .35, 1.05), yaw = ay + (p > .93 ? rnd(-.07, .07) : rnd(-.012, .012));
  ball.vel.set(Math.sin(yaw) * Math.cos(pitch) * spd, Math.sin(pitch) * spd, Math.cos(yaw) * Math.cos(pitch) * spd); AU.kick(); bumpCam(.15);
}
function fgResult(good) {
  setTimeout(() => {
    if (good) { G.sc[G.off] += 3; G.stats.fg++; G.banner('IT’S GOOD!', 'good', '3 points'); AU.crowdSwell(.9); AU.good(); }
    else { G.banner('NO GOOD', 'bad', ''); AU.boo(); }
    updBug(); G.clock -= G.ot ? 0 : 5; G.state = 'dead';
    G.after = good ? 'scored' : 'turnover'; G.turnZ = G.los - 7; G.deadT = 0;
  }, 300);
}
// ---------------- end of game ----------------
function endGame() {
  if (G.mode === 'mp') return mpEnd(false);
  G.state = 'over'; document.exitPointerLock && document.exitPointerLock(); $('hud').classList.add('hide');
  const st = G.stats, won = G.sc[0] > G.sc[1], drill = G.mode === 'drill';
  save.rec.games++; if (won) save.rec.wins++; save.rec.passYds = Math.max(save.rec.passYds, st.pass); save.rec.rushYds = Math.max(save.rec.rushYds, st.rush);
  let extra = '';
  if (drill) { const best = save.rec.drill; if (G.sc[0] > best) { save.rec.drill = G.sc[0]; extra = '<p class="nb">NEW BEST!</p>'; } $('goT').textContent = `${G.sc[0]} points`; $('goS').textContent = `Two-minute drill · best ${Math.max(best, G.sc[0])}`; }
  else { $('goT').textContent = won ? 'VICTORY' : G.sc[0] === G.sc[1] ? 'TIE' : 'DEFEAT'; $('goS').textContent = `${G.my.abbr} ${G.sc[0]} – ${G.sc[1]} ${G.opp.abbr}${G.ot ? ' (OT)' : ''}`; }
  $('goT').className = drill || won ? 'good' : 'bad';
  if (G.mode === 'season') {
    const se = save.season, pts = 3 + (won ? 3 : 0) + Math.min(4, st.td); se.pts += pts; se.results.push({ opp: se.sched[se.week], my: G.sc[0], them: G.sc[1], w: won }); se.week++;
    const wins = se.results.filter(r => r.w).length;
    if (se.week === 8 && wins < 5) { se.done = true; extra += `<p class="nb bad">${wins}-${8 - wins}: missed the playoffs. Start a new season to try again.</p>`; }
    else if (se.week >= 9 && !won) { se.done = true; extra += '<p class="nb bad">Eliminated in the playoffs.</p>'; }
    else if (se.week === 10 && won) { se.done = true; se.champ = true; save.rec.titles++; extra += '<p class="nb">CHAMPIONS!</p>'; AU.horn(); waveT = G.t; }
    else if (se.week === 8) extra += '<p class="nb">Playoffs! Win two more for the title.</p>';
    extra += `<p class="cp">+${pts} coaching points for upgrades</p>`;
  }
  $('goStats').innerHTML = [['Passing', `${st.comp}/${st.att}, ${st.pass} yds`], ['Rushing', `${st.rush} yds`], ['Touchdowns', st.td], ['Interceptions', st.int], ['Sacks taken', st.sack], ['Field goals', st.fg]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('') + extra;
  $('goNext').textContent = G.mode === 'season' ? 'SEASON' : drill ? 'TRY AGAIN' : 'PLAY AGAIN';
  save.tut = 1; store(); showScreen('overOv'); AU.musicOn = true; AU.crowdTo(.2);
  if (won || drill) { AU.crowdSwell(1); AU.good(); }
}

// =====================================================================================
//  SEASON HUB
// =====================================================================================
function newSeason(teamIdx) {
  const opps = TEAMS.map((t, i) => i).filter(i => i !== teamIdx).sort((a, b) => TEAMS[a].r - TEAMS[b].r);
  const reg = opps.slice(0, 8), po = opps.slice(-2); reg.sort((a, b) => TEAMS[a].r - TEAMS[b].r + rnd(-6, 6));
  save.season = { team: teamIdx, week: 0, sched: [...reg, po[0], po[1]], results: [], pts: 4, rate: { arm: 0, rec: 0, line: 0, back: 0, def: 0 }, done: false, champ: false }; store();
}
const UPG = [['arm', 'QB arm', 'Throw harder and more accurately under pressure'], ['rec', 'Receivers', 'Faster routes and surer hands'], ['line', 'Offensive line', 'Blocks hold longer'], ['back', 'Running backs', 'Faster backs, better jukes, more stamina'], ['def', 'Defense', 'Opponents score less on their drives']];
function showSeason() {
  const se = save.season; if (!se) return showScreen('teamOv'), buildTeamPick();
  const me = TEAMS[se.team], wins = se.results.filter(r => r.w).length, losses = se.results.length - wins;
  $('seTeam').innerHTML = `<i style="background:${me.c1};border-color:${me.c2}"></i><div><b>${me.city} ${me.name}</b><span>${wins}-${losses}${se.champ ? ' · CHAMPIONS 🏆' : se.done ? ' · season over' : ''}</span></div>`;
  $('seSched').innerHTML = se.sched.map((o, i) => { const t = TEAMS[o], r = se.results[i]; const lab = i === 8 ? 'Semifinal' : i === 9 ? 'Championship' : 'Week ' + (i + 1); return `<li class="${i === se.week && !se.done ? 'next' : ''}"><span>${lab}</span><b><i style="background:${t.c1}"></i>${t.city} ${t.name}</b><em>${r ? (r.w ? 'W ' : 'L ') + r.my + '–' + r.them : i === se.week && !se.done ? 'NEXT' : 'OVR ' + t.r}</em></li>`; }).join('');
  $('seUp').innerHTML = `<p class="pts"><b>${se.pts}</b> coaching points</p>` + UPG.map(([k, n, d]) => { const lv = se.rate[k], cost = lv + 1; return `<div class="up"><div><b>${n}</b><span>${d}</span><div class="pips">${Array.from({ length: 8 }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div><button data-k="${k}" ${lv >= 8 || se.pts < cost ? 'disabled' : ''}>${lv >= 8 ? 'MAX' : '+ ' + cost + ' pt' + (cost > 1 ? 's' : '')}</button></div>`; }).join('');
  $('seUp').querySelectorAll('button').forEach(b => b.onclick = () => { const k = b.dataset.k, cost = se.rate[k] + 1; if (se.pts < cost) return; se.pts -= cost; se.rate[k]++; store(); AU.good(); showSeason(); });
  $('sePlay').textContent = se.done ? 'NEW SEASON' : 'PLAY ' + (se.week === 8 ? 'SEMIFINAL' : se.week === 9 ? 'CHAMPIONSHIP' : 'WEEK ' + (se.week + 1));
  showScreen('seasonOv');
}
function buildTeamPick() {
  $('teamGrid').innerHTML = TEAMS.map((t, i) => `<button class="tp" data-i="${i}" style="--c1:${t.c1};--c2:${t.c2}"><i></i><b>${t.city}</b><span>${t.name}</span></button>`).join('');
  $('teamGrid').querySelectorAll('.tp').forEach(b => b.onclick = () => { AU.click(); newSeason(+b.dataset.i); showSeason(); });
}

// =====================================================================================
//  INPUT
// =====================================================================================
const keys = {}; let mouseDown = false;
const isTouch = () => document.body.classList.contains('touch');
function lockPointer() { if (isTouch()) return; try { cv.requestPointerLock && cv.requestPointerLock(); } catch (e) { } }
const locked = () => document.pointerLockElement === cv;
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return; AU.init(); keys[e.code] = true;
  if (e.code === 'Escape' || e.code === 'KeyP') { if (inPlay()) pause(); else if (G.state === 'paused') resume(); else closeOv(); return; }
  if (G.state === 'playcall' && /^Digit[1-8]$/.test(e.code) && !$('playcall').classList.contains('hide') && !$('pcList').classList.contains('hide')) { const n = +e.code.slice(5) - 1; if (G.mode === 'mp') { if (localIsOff() ? n < PLAYS.length : n < DCALLS.length) mpChoose(n); } else choosePlay(PLAYS[n]); return; }
  if (e.code === 'Space') { e.preventDefault(); if (G.state === 'presnap' && localIsOff()) act('snap'); else if (G.state === 'live' && !localIsOff()) act('dive'); else if (G.state === 'live' && PS.ctrl && PS.carrier === PS.ctrl) act('juke', [keys.KeyA || keys.ArrowLeft ? -1 : keys.KeyD || keys.ArrowRight ? 1 : (G.jk = -(G.jk || 1))]); }
  if (e.code === 'KeyE' && G.state === 'live' && localIsOff()) act('arm');
  if ((e.code === 'Enter' || e.code === 'Space') && !$('oppOv').classList.contains('hide')) { e.preventDefault(); G.oppNext && G.oppNext(); }
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; mouseDown = false; G.charging = false; });
cv.addEventListener('mousedown', e => {
  AU.init();
  if (!locked() && inPlay()) { lockPointer(); return; }
  if (e.button === 2) { if (G.state === 'live' && localIsOff()) act('arm'); return; }
  if (e.button !== 0) return; mouseDown = true;
  if (G.state === 'presnap') { if (localIsOff()) act('snap'); mouseDown = false; return; }
  if (G.state === 'live' && !localIsOff()) { act('swat'); return; }
  if (G.state === 'live' && canThrow()) { G.charging = true; G.power = 0; }
  if (G.state === 'fg' && FG.phase === 'aim' && localIsOff()) { G.charging = true; FG.t = 0; }
});
addEventListener('mouseup', e => { if (e.button !== 0) return; mouseDown = false; releaseThrow(); });
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('mousemove', e => { if (!locked()) return; look(e.movementX, e.movementY); });
document.addEventListener('pointerlockchange', () => { if (!locked() && inPlay() && !isTouch() && !G.noPauseOnUnlock) pause(); G.noPauseOnUnlock = false; });
function look(dx, dy) { if (Math.abs(dx) > 300 || Math.abs(dy) > 300) return; const s = .0021 * save.set.sens; G.yaw -= dx * s; G.pitch -= dy * s * (save.set.inv ? -1 : 1); G.pitch = clamp(G.pitch, -1.2, 1.15); }
function canThrow() { const qb = PS.ctrl; return localIsOff() && qb && ball.holder === qb && qb.role === 'QB' && PS.phase === 'live' && qb.pos.z <= PS.los + .2; }
function releaseThrow() {
  if (!G.charging) return; G.charging = false;
  if (G.state === 'live' && canThrow()) { act('throw', [Math.max(.12, G.power), G.yaw, G.pitch]); G.power = 0; landRing.visible = false; arcLine.visible = false; }
  else if (G.state === 'fg' && localIsOff()) { const pw = FG.p; if (MP.on && !MP.host) { FG.phase = 'flight'; FG.done = true; act('kick', [pw, G.yaw, G.pitch]); } else kickFG(pw, G.yaw, G.pitch); }
}
const inPlay = () => ['presnap', 'live', 'dead', 'fg'].includes(G.state);
// touch controls: left stick moves, right side looks, buttons act
const TS = { id: null, x: 0, y: 0, dx: 0, dy: 0, look: null, lx: 0, ly: 0 };
cv.addEventListener('touchstart', e => { AU.init(); for (const t of e.changedTouches) { if (t.clientX < innerWidth * .45 && TS.id === null) { TS.id = t.identifier; TS.x = t.clientX; TS.y = t.clientY; TS.dx = TS.dy = 0; $('stick').style.cssText = `display:block;left:${t.clientX - 60}px;top:${t.clientY - 60}px`; } else if (TS.look === null) { TS.look = t.identifier; TS.lx = t.clientX; TS.ly = t.clientY; } } e.preventDefault(); }, { passive: false });
cv.addEventListener('touchmove', e => { for (const t of e.changedTouches) { if (t.identifier === TS.id) { TS.dx = clamp((t.clientX - TS.x) / 50, -1, 1); TS.dy = clamp((t.clientY - TS.y) / 50, -1, 1); $('knob').style.transform = `translate(${TS.dx * 34}px,${TS.dy * 34}px)`; } if (t.identifier === TS.look) { look((t.clientX - TS.lx) * 2.2, (t.clientY - TS.ly) * 2.2); TS.lx = t.clientX; TS.ly = t.clientY; } } e.preventDefault(); }, { passive: false });
cv.addEventListener('touchend', e => { for (const t of e.changedTouches) { if (t.identifier === TS.id) { TS.id = null; TS.dx = TS.dy = 0; $('stick').style.display = 'none'; $('knob').style.transform = ''; } if (t.identifier === TS.look) TS.look = null; } }, { passive: false });
const tbtn = (id, down, up) => { const el = $(id); el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); AU.init(); el.classList.add('on'); down(); }, { passive: false }); el.addEventListener('touchend', e => { e.preventDefault(); el.classList.remove('on'); up && up(); }, { passive: false }); };
tbtn('tAct', () => { if (G.state === 'presnap' && localIsOff()) act('snap'); else if (G.state === 'live' && !localIsOff()) act('swat'); else if (G.state === 'live' && canThrow()) { G.charging = true; G.power = 0; } else if (G.state === 'fg' && FG.phase === 'aim' && localIsOff()) { G.charging = true; FG.t = 0; } }, () => releaseThrow());
tbtn('tSprint', () => { keys.ShiftLeft = true; }, () => { keys.ShiftLeft = false; });
tbtn('tJuke', () => { if (G.state === 'live') { if (!localIsOff()) act('dive'); else act('juke', [TS.dx < -.2 ? -1 : TS.dx > .2 ? 1 : (G.jk = -(G.jk || 1))]); } });
tbtn('tArm', () => { if (G.state === 'live' && localIsOff()) act('arm'); });
tbtn('tPause', () => { if (inPlay()) pause(); });
function readInput() {
  let x = 0, z = 0; if (keys.KeyW || keys.ArrowUp) z += 1; if (keys.KeyS || keys.ArrowDown) z -= 1; if (keys.KeyA || keys.ArrowLeft) x -= 1; if (keys.KeyD || keys.ArrowRight) x += 1;
  if (TS.id !== null) { x += TS.dx; z -= TS.dy; }
  return { x, z, sprint: !!(keys.ShiftLeft || keys.ShiftRight) || (TS.id !== null && Math.hypot(TS.dx, TS.dy) > .95) };
}
function pause() { if (MP.on && MP.started) { G.charging = false; showScreen('pauseOv'); return; } if (G.state === 'paused') return; G.prevState = G.state; G.state = 'paused'; G.charging = false; showScreen('pauseOv'); }
function resume() { if (MP.on && MP.started) { showScreen(null); if (G.state === 'playcall') { if (MP.myCall === MP.callSeq) { showScreen('playcall'); } else mpShowCall(); } else lockPointer(); return; } if (G.state !== 'paused') return; G.state = G.prevState; showScreen(null); if (G.state === 'playcall') showScreen('playcall'); else lockPointer(); }

// =====================================================================================
//  CAMERA + HUD
// =====================================================================================
function camLook() {
  const c = PS.ctrl || by('QB'); camera.position.set(c.pos.x, 1.82, c.pos.z - .1); camera.rotation.set(-.12, Math.PI, 0);
  if (G.state === 'playcall') { camera.position.set(G.x0 + 9, 7, G.los - 14); camera.lookAt(G.x0, 0, G.los + 6); }
}
const tmpV = V3();
function updateCamera(dt) {
  if (G.state === 'fg' || (G.state === 'dead' && FG.phase === 'flight' && !G.after)) {
    const kp = V3(G.x0, 1.75, G.los - 9.2);
    if (FG.phase === 'flight') { tmpV.set(ball.pos.x, Math.max(1.75, ball.pos.y * .4 + 1), ball.pos.z - 10); camera.position.lerp(tmpV, 1 - Math.exp(-dt * 2)); camera.lookAt(ball.pos); }
    else { camera.position.copy(kp); camera.rotation.set(G.pitch, G.yaw + Math.PI, 0); }
    vm.visible = false; return;
  }
  if (G.hidP && !['presnap', 'live', 'dead'].includes(G.state)) { G.hidP.m.root.visible = true; G.hidP = null; }
  if (G.state === 'playcall' || G.state === 'opp' || G.state === 'intro' || G.state === 'menu' || G.state === 'over') { // slow broadcast orbit
    const t = G.t * .05, cx = G.x0, cz = G.los;
    if (G.state === 'menu' || G.state === 'over') { camera.position.set(Math.sin(t) * 38, 14 + Math.sin(t * .7) * 3, cz + Math.cos(t) * 30); camera.lookAt(0, 2, cz + 4); }
    else { camera.position.lerp(tmpV.set(cx + 10 + Math.sin(t) * 3, 6.5, cz - 13), 1 - Math.exp(-dt * 2)); camera.lookAt(cx, 1, cz + 7); }
    vm.visible = false; return;
  }
  const c = viewP();
  // never draw the body you're looking out of
  if (G.hidP !== c) { if (G.hidP) G.hidP.m.root.visible = true; G.hidP = c && !G.cine ? c : null; if (G.hidP) G.hidP.m.root.visible = false; }
  if (G.hidP) G.hidP.m.root.visible = false; // a new play makes everyone visible again
  if (!c || G.cine) { // follow the ball carrier (interceptions)
    const t = PS.carrier || ball; const p = t.pos || t; tmpV.set(p.x + 4, 6, p.z + (PS.carrier && PS.carrier.side === 1 ? 10 : -10)); camera.position.lerp(tmpV, 1 - Math.exp(-dt * 3)); camera.lookAt(p.x, 1, p.z); vm.visible = false; return;
  }
  const sp = Math.hypot(c.vel.x, c.vel.z), bob = Math.sin(c.ph * 2) * .045 * clamp(sp / 7, 0, 1);
  if (sp > 2 && Math.sin(c.ph * 2) < -.95 && !G.stepLock) { AU.step(); G.stepLock = true; } if (Math.sin(c.ph * 2) > 0) G.stepLock = false;
  let y = 1.82 + bob, roll = 0, pitchOff = 0;
  if (G.camFall) { G.camFall.t = Math.min(1, G.camFall.t + dt * 2.4); const k = 1 - Math.pow(1 - G.camFall.t, 3); y = lerp(1.82, .45, k); roll = G.camFall.roll * k; pitchOff = -.35 * k; }
  tmpV.set(c.pos.x, y, c.pos.z).addScaledVector(V3(Math.sin(G.yaw), 0, Math.cos(G.yaw)), .12);
  if (G.blend > 0) { G.blend = Math.max(0, G.blend - dt * 4); camera.position.lerpVectors(tmpV, G.lastFrom, G.blend * G.blend); } else camera.position.copy(tmpV);
  let sx = 0, sy = 0; if (G.shake > 0) { sx = (Math.random() - .5) * G.shake * .3; sy = (Math.random() - .5) * G.shake * .3; G.shake = Math.max(0, G.shake - dt * 2.5); }
  camera.rotation.set(G.pitch + pitchOff + sy * .3, G.yaw + Math.PI + sx * .3, roll);
  // first-person hands
  const holding = ball.holder === c && ball.state === 'held';
  vm.visible = holding || (c.role === 'QB' && c.throwT > 0);
  const run = clamp(sp / 8, 0, 1), sw = Math.sin(c.ph) * .03 * run;
  if (c.role === 'QB' && PS.phase !== 'run' && PS.phase !== 'tackled') {
    const ch = G.charging ? clamp(G.power, 0, 1) : 0, th = c.throwT;
    vmBall.visible = holding; vmBall.position.set(.22 + ch * .1 + sw, -.25 + ch * .08 - th * .2, -.52 + ch * .06 - th * .3); vmBall.rotation.set(.3 + ch * .6, .5, -.3);
    vmHandR.position.set(vmBall.position.x + .03, vmBall.position.y - .07, vmBall.position.z + .04); vmHandL.position.set(-.06 - ch * .1, -.27 + sw, -.46 + ch * .15);
  } else {
    vmBall.visible = holding; vmBall.position.set(.26 + sw, -.42 + Math.abs(sw), -.42); vmBall.rotation.set(.1, .2, -.9);
    vmHandR.position.set(.3 + sw, -.47, -.36); vmHandL.position.set(-.2 - sw, -.45 + Math.abs(sw) * .5, -.4);
  }
  vmArmR.position.set(vmHandR.position.x + .05, vmHandR.position.y - .1, vmHandR.position.z + .14); vmArmR.rotation.set(1.1, 0, .2);
  vmArmL.position.set(vmHandL.position.x - .05, vmHandL.position.y - .1, vmHandL.position.z + .14); vmArmL.rotation.set(1.1, 0, -.2);
}
function updBug() {
  if (G.mode === 'mp') { const A = TEAMS[MP.T[0]], B = TEAMS[MP.T[1]]; $('bugMy').textContent = (G.off === 0 ? '▸ ' : '') + A.abbr; $('bugOpp').textContent = (G.off === 1 ? '▸ ' : '') + B.abbr; $('bugMy').style.background = A.c1; $('bugOpp').style.background = B.c1; }
  $('bugMyS').textContent = G.sc[0]; $('bugOppS').textContent = G.mode === 'drill' ? '' : G.sc[1];
  $('bugQ').textContent = G.mode === 'drill' ? 'DRILL' : G.ot ? 'OT' : 'Q' + Math.min(4, G.q);
  $('bugClock').textContent = G.ot ? '—' : clockText(G.clock + (G.state === 'live' ? -PS.t * (G.mode === 'drill' ? 1 : 1) : 0));
  $('bugDn').textContent = `${ORD[Math.min(4, G.down)] || '4th'} & ${G.fdZ >= 50 ? 'Goal' : G.togo}`; $('bugBall').textContent = yardText(G.los);
}
let hudT = 0;
function hud(dt) {
  hudT -= dt; if (hudT <= 0) { hudT = .1; if (G.state === 'live' || G.state === 'presnap') updBug(); }
  // throw meter + landing ring
  const meter = $('meter');
  if ((G.state === 'live' && G.charging) || (G.state === 'fg' && FG.phase === 'aim')) {
    const v = G.state === 'fg' ? FG.p : G.power; meter.classList.remove('hide'); meter.style.setProperty('--p', v.toFixed(3)); meter.classList.toggle('hot', G.state === 'fg' && v > .93);
  } else meter.classList.add('hide');
  if (G.state === 'live' && G.charging && save.set.guide && canThrow()) {
    const qb = PS.ctrl, fwd = V3(Math.sin(G.yaw), 0, Math.cos(G.yaw)), right = V3(-Math.cos(G.yaw), 0, Math.sin(G.yaw)), spd = 11 + Math.max(.12, G.power) * (17 + RATE.arm * .8), pt = G.pitch + .07;
    const p0 = qb.pos.clone().add(V3(0, 1.95, 0)).addScaledVector(right, .28).addScaledVector(fwd, .35), v0 = V3(Math.sin(G.yaw) * Math.cos(pt) * spd, Math.sin(pt) * spd, Math.cos(G.yaw) * Math.cos(pt) * spd);
    const L = predictLanding(p0, v0, 1.5); landRing.visible = true; landRing.position.set(L.p.x, .04, L.p.z); landRing.scale.setScalar(1 + L.t * .25);
    const out = Math.abs(L.p.x) > HALF_W || L.p.z > 60; ringMat.color.set(out ? 0xff5a5a : 0xffffff); arcMat.color.set(out ? 0xff5a5a : 0xffffff); setArc(p0, v0, 1.5);
  } else { arcLine.visible = false; if (ball.state !== 'air') landRing.visible = false; }
  // receiver markers
  const showM = save.set.marks && localIsOff() && (G.state === 'live' && PS.phase === 'live' && ball.holder && ball.holder.role === 'QB' && PS.play.type !== 'run');
  for (const p of OFF) { if (!p.mark) continue; p.mark.visible = showM && !!p.route; if (!p.mark.visible) continue; let sep = 99; for (const d of DEFN) { const dd = Math.hypot(d.pos.x - p.pos.x, d.pos.z - p.pos.z); if (dd < sep) sep = dd; } p.mark.position.set(p.pos.x, 2.75, p.pos.z); p.mark.material.color.set(sep > 3 ? 0x5cff8a : sep > 1.6 ? 0xffd34d : 0xff5a6a); }
  // stamina
  const vp = viewP(), defending = MP.on && !localIsOff() && G.state === 'live' && vp;
  const carrying = G.state === 'live' && PS.ctrl && PS.carrier === PS.ctrl && localIsOff(); if (vp) G.stamina = vp.stam === undefined ? 1 : vp.stam;
  $('stam').classList.toggle('hide', !(carrying || defending)); $('stamI').style.width = (G.stamina * 100).toFixed(0) + '%';
  $('moves').classList.toggle('hide', !(carrying || defending) || isTouch());
  $('mvJ').innerHTML = defending ? '<kbd>Space</kbd> Dive tackle' : '<kbd>Space</kbd> Juke'; $('mvS').innerHTML = defending ? '<kbd>Click</kbd> Swat the ball' : '<kbd>E</kbd> Stiff arm';
  if (defending) { $('mvJ').classList.toggle('cd', PS.t < (vp.diveCD || 0)); $('mvS').classList.remove('cd'); }
  if (carrying) { const c = PS.ctrl; $('mvJ').classList.toggle('cd', c.jukeT > -1.0); $('mvS').classList.toggle('cd', c.armT > -1.6); }
  $('xh').classList.toggle('hide', !(G.state === 'live' || G.state === 'presnap' || G.state === 'fg'));
  $('tbtns').classList.toggle('hide', !isTouch() || !inPlay());
  $('tAct').textContent = !localIsOff() && G.state === 'live' ? 'SWAT' : G.state === 'presnap' ? (localIsOff() ? 'SNAP' : '…') : G.state === 'fg' ? 'KICK' : 'THROW'; $('tJuke').textContent = !localIsOff() ? 'DIVE' : 'JUKE';
}

// ---------------- tutorial tips (first game only) ----------------
function tip(id, html) { if (save.tut || G.tutShown[id]) return; G.tutShown[id] = 1; const el = $('tip'); el.innerHTML = html; el.classList.add('show'); clearTimeout(G.tipT); G.tipT = setTimeout(() => el.classList.remove('show'), 6500); }

// =====================================================================================
//  SCREENS
// =====================================================================================
const SCREENS = ['mpOv', 'title', 'playcall', 'oppOv', 'overOv', 'pauseOv', 'setOv', 'howOv', 'recOv', 'seasonOv', 'teamOv'];
function showScreen(id) { for (const s of SCREENS) $(s).classList.toggle('hide', s !== id); if (id && locked()) { G.noPauseOnUnlock = true; document.exitPointerLock(); } }
function closeOv() { const open = SCREENS.find(s => !$(s).classList.contains('hide')); if (['setOv', 'howOv', 'recOv'].includes(open)) { if (G.state === 'paused') showScreen('pauseOv'); else if (G.state === 'menu') showScreen('title'); } }
function toTitle() { G.state = 'menu'; $('hud').classList.add('hide'); showScreen('title'); AU.musicOn = true; AU.crowdTo(.18); $('tDrill').textContent = save.rec.drill ? 'Best: ' + save.rec.drill + ' pts' : 'Score fast before time runs out'; const se = save.season; $('tSeason').textContent = se && !se.done ? `Week ${se.week + 1} · ${se.results.filter(r => r.w).length}-${se.results.filter(r => !r.w).length}` : 'Pick a team. Chase the title'; if (!PLAYERS.length) { buildRosters(TEAMS[0], TEAMS[3]); paintField('GULLS', TEAMS[0].c1, 'COYOTES', TEAMS[3].c1); paintBoard('GRIDIRON  ·  FIRST-PERSON FOOTBALL  ·', '#ffffff', '#14213d'); setupPlay(PLAYS[0], -10, 0); clearRouteLines(); } }
function buildSettings() { const s = save.set; for (const k of ['vol', 'mus', 'sfx', 'crowd', 'sens']) $('s_' + k).value = s[k]; for (const k of ['mute', 'shake', 'q', 'inv', 'guide', 'routes', 'marks']) $('s_' + k).checked = !!s[k]; $('s_diff').value = s.diff; $('s_qlen').value = s.qlen; }
['vol', 'mus', 'sfx', 'crowd', 'sens'].forEach(k => $('s_' + k).addEventListener('input', e => { save.set[k] = +e.target.value; AU.apply(); store(); }));
['mute', 'shake', 'q', 'inv', 'guide', 'routes', 'marks'].forEach(k => $('s_' + k).addEventListener('change', e => { save.set[k] = e.target.checked ? 1 : 0; AU.apply(); store(); if (k === 'q') applyQuality(); }));
['diff', 'qlen'].forEach(k => $('s_' + k).addEventListener('change', e => { save.set[k] = +e.target.value; store(); D = DIFF[save.set.diff]; }));
function buildRecords() { const r = save.rec; $('recL').innerHTML = [['Two-minute drill best', r.drill + ' pts'], ['Championships', r.titles], ['Games won', `${r.wins} of ${r.games}`], ['Longest touchdown', r.longTD + ' yds'], ['Most passing yards (game)', r.passYds], ['Most rushing yards (game)', r.rushYds]].map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join(''); }
const on = (id, f) => $(id).addEventListener('click', e => { AU.init(); AU.click(); f(e); });
on('bSeason', () => showSeason());
on('bMP', () => mpOpen()); on('mpCreate', () => mpCreate()); on('mpJoinB', () => mpJoin()); on('mpStart', () => mpHostStart()); on('mpBack', () => { if (MP.on) mpLeave(); toTitle(); });
$('mpCode').addEventListener('keydown', e => { if (e.key === 'Enter') mpJoin(); });
on('bQuick', () => { save.myTeam = 0; const o = 1 + ((Math.random() * (TEAMS.length - 1)) | 0); newGame('quick', o); });
on('bDrill', () => newGame('drill', 7));
on('bHow', () => showScreen('howOv')); on('bSet', () => { buildSettings(); showScreen('setOv'); }); on('bRec', () => { buildRecords(); showScreen('recOv'); });
document.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => { AU.click(); closeOv(); }));
on('sePlay', () => { const se = save.season; if (se.done) { save.season = null; store(); return showSeason(); } newGame('season', se.sched[se.week]); });
on('seBack', () => toTitle()); on('teamBack', () => toTitle());
on('oppGo', () => G.oppNext && G.oppNext());
on('goNext', () => { if ($('goNext').dataset.mp) { delete $('goNext').dataset.mp; mpLeave(); return toTitle(); } if (G.mode === 'season') showSeason(); else if (G.mode === 'drill') newGame('drill', 7); else on && newGame('quick', 1 + ((Math.random() * (TEAMS.length - 1)) | 0)); });
on('goMenu', () => { if (MP.on) mpLeave(); toTitle(); });
on('pResume', () => resume()); on('pSet', () => { buildSettings(); showScreen('setOv'); }); on('pQuit', () => { if (MP.on) mpLeave(); G.state = 'menu'; toTitle(); });

// =====================================================================================
//  MAIN LOOP
// =====================================================================================
const NORENDER = /[?&]norender/.test(location.search); // test hook
let last = performance.now(), acc = 0; const STEP = 1 / 60;
function frame(now) {
  const rdt = Math.min(.1, (now - last) / 1000); last = now; G.t += rdt;
  try { update(rdt); if (!NORENDER) renderer.render(scene, camera); } catch (e) { console.error(e); }
  requestAnimationFrame(frame);
}
function update(rdt) {
  let dt = rdt; if (G.hs > 0) { G.hs -= rdt; dt = rdt * .12; }
  if (MP.on && MP.started && !MP.host) { mpGuestFrame(rdt); if (G.charging) G.power = Math.min(1, G.power + rdt / .95); if (G.state === 'fg' && FG.phase === 'aim') fgUpdate(rdt); guestCommon(rdt); return; }
  if (G.state === 'live' || G.state === 'presnap' || G.state === 'dead') {
    const inp = G.state === 'live' ? readInput() : { x: 0, z: 0 };
    if (G.charging) G.power = Math.min(1, G.power + dt / .95);
    acc += dt; let n = 0;
    const linp = Object.assign(inp, { yaw: G.yaw }), rin = MP.on && MP.host ? (MP.rin || { x: 0, z: 0 }) : null, offIn = !MP.on ? linp : localIsOff() ? linp : rin, defIn = !MP.on ? null : localIsOff() ? rin : linp;
    while (acc >= STEP && n < 6) { if (G.state === 'live' && PS.phase !== 'dead') stepSim(STEP, offIn, defIn); else if (G.state === 'dead') { for (const p of PLAYERS) { p.vel.multiplyScalar(.9); p.pos.x += p.vel.x * STEP; p.pos.z += p.vel.z * STEP; if (p.fall > 0 && p.fall < 1) p.fall = Math.min(1, p.fall + STEP * 3); } if ((ball.state === 'air' || ball.state === 'loose') && FG.phase !== 'flight') { ball.vel.y -= GRAV * STEP; ball.pos.addScaledVector(ball.vel, STEP); if (ball.pos.y < .12) { ball.pos.y = .12; ball.vel.multiplyScalar(.4); ball.vel.y = Math.abs(ball.vel.y) * .3; } } } acc -= STEP; n++; }
    if (G.state === 'dead') { G.deadT += rdt; if (G.deadT > 2.1 && G.after) afterPlay(); }
  }
  if (G.state === 'fg' || (G.state === 'dead' && FG.phase === 'flight')) fgUpdate(dt);
  if (MP.on && MP.host && MP.started) mpHostTick(rdt);
  guestCommon(dt);
}
function guestCommon(dt) {
  for (const p of PLAYERS) if (p.m.root.visible) animatePlayer(p, dt, G.t);
  // ball mesh
  ball.mesh.visible = !(ball.holder === viewP() && ball.state === 'held' && G.state !== 'playcall' && !G.cine && viewP() && G.state !== 'menu' && G.state !== 'opp') || G.state === 'fg';
  ball.mesh.position.copy(ball.pos);
  if (ball.state === 'air' || ball.state === 'pitch' || ball.state === 'loose' || (ball.state === 'kick' && FG.phase === 'flight')) { const v = ball.vel; ball.mesh.lookAt(ball.pos.x + v.x, ball.pos.y + v.y, ball.pos.z + v.z); ball.mesh.rotateZ(ball.spin); }
  else if (ball.state === 'kick') ball.mesh.rotation.set(-1.2, 0, 0);
  else if (ball.holder) ball.mesh.rotation.set(0, ball.holder.face, 0);
  ballShadow.position.set(ball.pos.x, .02, ball.pos.z); ballShadow.scale.setScalar(clamp(1.4 - ball.pos.y * .08, .3, 1.4));
  // keep the shadow camera on the action
  const focus = PS.carrier ? PS.carrier.pos : ball.pos; sun.position.set(focus.x + 30, 70, focus.z - 20); sun.target.position.set(focus.x, 0, focus.z);
  if (!G.freezeCam) updateCamera(dt); updateParticles(dt); animateCrowd(G.t, dt); hud(dt);
  if (G_board) G_board.t.offset.x = (G.t * .02) % 1;
}
Object.assign(window.__GF, { MP: () => MP, mpChoose: v => mpChoose(v), act: (k, a) => act(k, a), viewP: () => viewP(), setCam: (x, y, z, lx, ly, lz) => { camera.position.set(x, y, z); camera.lookAt(lx, ly, lz); }, update, doSnap, choosePlay, openPlaycall, startFG, kickFG, FG, newGame, afterPlay, readInput, keys, render: () => renderer.render(scene, camera), showSeason, toTitle });

// =====================================================================================
//  ONLINE HEAD-TO-HEAD (Firebase Realtime Database, same project as the other games)
//  The host's browser runs the game. The guest sends its moves and buttons, gets the field ~15 times a second,
//  and moves its own player on its own screen so it never feels laggy.
//  Rooms live at nr/<CODE> (4 letters, no I/O) with m.g = 'gf' so other games ignore them.
// =====================================================================================
const MP = { on: false, host: false, side: 0, code: '', me: '', T: [0, 1], names: ['', ''], calls: {}, callSeq: 0, setupSeq: 0, evSeq: 0, ev: [], snapSeq: 0, rin: null, ract: 0, myCall: -1, acts: [], actSeq: 0, sendT: 0, inT: 0, snaps: [], off: null, gotSetup: -1, lastFlowOff: -1, peerSeen: 0, started: false, local: /[?&]net=local/.test(location.search) };
const FB_CFG = { apiKey: 'AIzaSyAorALlmWcgCLaS9cIR_9BEUPKXcmKECoY', authDomain: 'gamebookshelf-9984c.firebaseapp.com', projectId: 'gamebookshelf-9984c', databaseURL: 'https://gamebookshelf-9984c-default-rtdb.firebaseio.com', appId: '1:373968261700:web:c41f30d9f3ef1f50dde211' };
let DB = null; const unsubs = [];
function dbRtdb() {
  const app = firebase.apps.find(a => a.name === 'gf') || firebase.initializeApp(FB_CFG, 'gf'), db = app.database(), R = p => db.ref(p);
  return { put: (p, v) => R(p).set(v === undefined ? null : v), update: (p, v) => R(p).update(v), remove: p => R(p).remove(), get: p => R(p).once('value').then(s => s.val()),
    watch(p, cb) { const r = R(p), f = s => cb(s.val()); r.on('value', f); return () => r.off('value', f); }, onDc: p => R(p).onDisconnect().remove(), cancelDc: p => R(p).onDisconnect().cancel() };
}
function dbLocal() { // stand-in for testing: tabs of one browser talk over a BroadcastChannel
  const ch = new BroadcastChannel('gf-local'), tree = {}, W = [], dc = new Set();
  const get = p => p.split('/').reduce((o, k) => o == null ? undefined : o[k], tree), clone = v => v === undefined ? null : JSON.parse(JSON.stringify(v));
  const set = (p, v) => { const ks = p.split('/'); let o = tree; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; } if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = clone(v); };
  const fire = ps => { for (const w of W) if (ps.some(p => p === w.p || p.startsWith(w.p + '/') || w.p.startsWith(p + '/'))) w.cb(clone(get(w.p))); };
  const apply = m => { if (m.op === 'put') { set(m.p, m.v); fire([m.p]); } else if (m.op === 'upd') { const ps = []; for (const k in m.v) { set(m.p + '/' + k, m.v[k]); ps.push(m.p + '/' + k); } fire(ps); } else if (m.op === 'tree') { for (const k in m.t) tree[k] = m.t[k]; for (const w of W) w.cb(clone(get(w.p))); } else if (m.op === 'hello') ch.postMessage({ op: 'tree', t: tree }); };
  ch.onmessage = e => apply(e.data); ch.postMessage({ op: 'hello' }); addEventListener('pagehide', () => { for (const p of dc) ch.postMessage({ op: 'put', p, v: null }); });
  const send = m => { apply(m); ch.postMessage(m); };
  return { put: (p, v) => (send({ op: 'put', p, v: v === undefined ? null : v }), Promise.resolve()), update: (p, v) => (send({ op: 'upd', p, v }), Promise.resolve()), remove: p => (send({ op: 'put', p, v: null }), Promise.resolve()), get: p => new Promise(r => setTimeout(() => r(clone(get(p))), 50)),
    watch(p, cb) { const w = { p, cb }; W.push(w); setTimeout(() => cb(clone(get(p))), 0); return () => { const i = W.indexOf(w); if (i >= 0) W.splice(i, 1); }; }, onDc: p => { dc.add(p); return Promise.resolve(); }, cancelDc: p => { dc.delete(p); return Promise.resolve(); }, _drop() { for (const p of dc) ch.postMessage({ op: 'put', p, v: null }); } };
}
async function dbInit() {
  if (DB) return true;
  try {
    if (MP.local) DB = dbLocal();
    else { if (!window.firebase || !firebase.database) throw 0; DB = dbRtdb(); await Promise.race([DB.get('nr/PING'), new Promise((_, j) => setTimeout(() => j(0), 8000))]); }
    return true;
  } catch (e) { DB = null; return false; }
}
const mpPath = s => 'nr/' + MP.code + (s ? '/' + s : '');
function mpUid() { if (MP.me) return MP.me; let v = null; try { v = MP.local ? null : localStorage.getItem('gf-uid'); } catch (e) { } if (!v) { v = 'g' + Math.random().toString(36).slice(2, 12); try { if (!MP.local) localStorage.setItem('gf-uid', v); } catch (e) { } } return (MP.me = v); }

// ---------------- lobby ----------------
function mpName() { return (($('mpName').value || '').replace(/[^\w .'-]/g, '').trim().slice(0, 14)) || 'Player'; }
function mpTeam() { return save.mpTeam === undefined ? 0 : save.mpTeam; }
function mpOpen() { showScreen('mpOv'); $('mpName').value = save.mpName || ''; $('mpErr').textContent = ''; mpShowLobby(false); buildMpTeams(); }
function buildMpTeams() {
  $('mpTeams').innerHTML = TEAMS.map((t, i) => `<button class="tp sm${i === mpTeam() ? ' sel' : ''}" data-i="${i}" style="--c1:${t.c1};--c2:${t.c2}"><i></i><b>${t.name}</b></button>`).join('');
  $('mpTeams').querySelectorAll('.tp').forEach(b => b.onclick = () => { AU.click(); save.mpTeam = +b.dataset.i; store(); buildMpTeams(); if (MP.on) DB.update(mpPath('p/' + MP.me), { t: save.mpTeam }); });
}
function mpShowLobby(on) { $('mpStart').classList.toggle('hide', !on); $('mpLobby').classList.toggle('hide', !on); $('mpConnect').classList.toggle('hide', on); }
async function mpCreate() {
  save.mpName = mpName(); store(); $('mpErr').textContent = 'Connecting…';
  if (!await dbInit()) { $('mpErr').textContent = 'Can’t reach the game server right now.'; return; }
  MP.me = mpUid(); const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for (let i = 0; i < 8; i++) { MP.code = Array.from({ length: 4 }, () => L[(Math.random() * L.length) | 0]).join(''); const m = await DB.get(mpPath('m')); if (!m) break; }
  MP.host = true; MP.side = 0; MP.on = true;
  await DB.put(mpPath('m'), { g: 'gf', h: MP.me, t: Date.now() }); await DB.onDc(mpPath());
  await DB.put(mpPath('p/' + MP.me), { n: save.mpName, t: mpTeam(), s: 0, j: Date.now() });
  mpWatchLobby(); $('mpErr').textContent = ''; mpShowLobby(true);
}
async function mpJoin() {
  save.mpName = mpName(); store(); const code = ($('mpCode').value || '').toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 4) { $('mpErr').textContent = 'Codes are 4 letters.'; return; }
  $('mpErr').textContent = 'Connecting…'; if (!await dbInit()) { $('mpErr').textContent = 'Can’t reach the game server right now.'; return; }
  const m = await DB.get('nr/' + code + '/m'); if (!m || m.g !== 'gf') { $('mpErr').textContent = 'No game with that code.'; return; }
  const ps = await DB.get('nr/' + code + '/p') || {}; MP.me = mpUid();
  if (Object.keys(ps).filter(k => k !== MP.me).length >= 2) { $('mpErr').textContent = 'That game already has two players.'; return; }
  MP.code = code; MP.host = false; MP.side = 1; MP.on = true;
  for (const s of ['p/', 'i/']) await DB.onDc(mpPath(s + MP.me));
  await DB.put(mpPath('p/' + MP.me), { n: save.mpName, t: mpTeam(), s: 1, j: Date.now() });
  mpWatchLobby(); $('mpErr').textContent = ''; mpShowLobby(true);
}
function mpWatchLobby() {
  unsubs.push(DB.watch(mpPath('p'), v => { MP.players = v || {}; mpLobbyRender(); mpPeerCheck(); }));
  unsubs.push(DB.watch(mpPath('m'), v => { if (!v) { if (MP.on && !MP.leaving) mpLost('The host left the game.'); return; } MP.meta = v; if (!MP.host && v.st && !MP.started) mpStartGame(v.st); }));
  if (MP.host) unsubs.push(DB.watch(mpPath('i'), v => { if (!v) return; for (const [id, s] of Object.entries(v)) if (id !== MP.me && typeof s === 'string') mpHostInput(s); }));
  else unsubs.push(DB.watch(mpPath('s'), v => { if (typeof v === 'string') mpGuestSnap(v); }));
}
function mpLobbyRender() {
  const ps = Object.values(MP.players || {}).sort((a, b) => a.s - b.s);
  $('mpCodeBig').textContent = MP.code;
  $('mpList').innerHTML = ps.map(p => { const t = TEAMS[p.t] || TEAMS[0]; return `<li><i style="background:${t.c1};border-color:${t.c2}"></i><b>${escH(p.n)}</b><span>${t.city} ${t.name}${p.s === 0 ? ' · host' : ''}</span></li>`; }).join('') + (ps.length < 2 ? '<li class="wait">Waiting for your friend to join with the code…</li>' : '');
  const same = ps.length === 2 && ps[0].t === ps[1].t;
  $('mpNote').textContent = ps.length < 2 ? 'Send your friend the code above.' : same ? 'You both picked the same team. One of you pick another.' : MP.host ? 'Ready when you are.' : 'Waiting for the host to start…';
  $('mpStart').disabled = !MP.host || ps.length < 2 || same; $('mpStart').classList.toggle('hide', !MP.host);
  $('mpQ').disabled = !MP.host;
}
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function mpPeerCheck() {
  if (!MP.started) return; const peer = Object.keys(MP.players || {}).find(k => k !== MP.me);
  if (!peer && G.state !== 'over') { if (MP.host) { G.banner('OPPONENT LEFT', 'bad', 'You win by forfeit'); setTimeout(() => mpEnd(true), 1500); } }
}
function mpLost(msg) { G.banner('GAME OVER', 'bad', msg); setTimeout(() => { mpLeave(); toTitle(); }, 2200); }
function mpLeave() {
  MP.leaving = true; unsubs.forEach(f => { try { f(); } catch (e) { } }); unsubs.length = 0;
  if (DB && MP.on) { if (MP.host) { DB.remove(mpPath()); DB.cancelDc(mpPath()); } else { DB.remove(mpPath('p/' + MP.me)); DB.remove(mpPath('i/' + MP.me)); } }
  Object.assign(MP, { on: false, host: false, started: false, code: '', calls: {}, snaps: [], gotSetup: -1, myCall: -1, ract: 0, acts: [], actSeq: 0, rin: null, leaving: false, off: null, lastFlowOff: -1 });
  G.mode = '';
}
function mpStartGame(st) {
  MP.started = true; const ps = Object.values(MP.players || {}).sort((a, b) => a.s - b.s);
  MP.T = [ps[0] ? ps[0].t : 0, ps[1] ? ps[1].t : 1]; MP.names = [ps[0] ? ps[0].n : 'Host', ps[1] ? ps[1].n : 'Guest'];
  save.set.qlen = st.q || save.set.qlen;
  newGame('mp', MP.T[1], st);
}
function mpHostStart() {
  if (!MP.host) return; const st = { t: Date.now(), q: +$('mpQ').value || 4, first: MP.forceFirst !== undefined ? MP.forceFirst : Math.random() < .5 ? 0 : 1 };
  DB.update(mpPath('m'), { st }); mpStartGame(st);
}

// ---------------- shared helpers ----------------
const STATES = ['menu', 'playcall', 'presnap', 'live', 'dead', 'fg', 'over', 'intro', 'opp'], PHASES = ['presnap', 'snap', 'live', 'air', 'run', 'tackled', 'dead'], BSTATES = ['held', 'snap', 'air', 'loose', 'pitch', 'kick'], POSES = ['', 'stance', 'block', 'throw', 'carry', 'catch', 'celebrate'];
const b36 = n => Math.round(n).toString(36), p36 = s => parseInt(s, 36) || 0;
const localIsOff = () => !MP.on || G.off === MP.side;
function viewP() { return MP.on && !localIsOff() ? PS.dctrl : PS.ctrl; }
// every button press goes through here: done right away on the host (or in single player), sent to the host by the guest
function act(k, a) {
  a = a || [];
  if (MP.on && !MP.host) { MP.actSeq++; MP.acts.push([MP.actSeq, k, ...a]); if (MP.acts.length > 8) MP.acts.shift(); mpSendInput(true); if (k === 'juke' && PS.ctrl) { PS.ctrl.jukeT = .38; PS.ctrl.jukeDir = a[0]; AU.juke(); } if (k === 'dive' && PS.dctrl) dive(PS.dctrl); if (k === 'swat' && PS.dctrl) swat(PS.dctrl); return; }
  doAct(k, a, true);
}
function doAct(k, a, local) {
  const offHuman = local ? localIsOff() : !localIsOff();
  if (k === 'snap' && offHuman && G.state === 'presnap') doSnap();
  else if (k === 'throw' && offHuman && G.state === 'live') { if (throwBall(+a[0], +a[1], +a[2])) G.power = 0; }
  else if (k === 'juke' && offHuman && G.state === 'live') juke(+a[0]);
  else if (k === 'arm' && offHuman && G.state === 'live') stiffArm();
  else if (k === 'dive' && !offHuman && G.state === 'live') dive(PS.dctrl);
  else if (k === 'swat' && !offHuman && G.state === 'live') swat(PS.dctrl);
  else if (k === 'kick' && offHuman && G.state === 'fg') kickFG(+a[0], +a[1], +a[2]);
  else if (k === 'call' && G.state === 'playcall') mpPick(offHuman ? 'off' : 'def', a[0]);
}

// ---------------- host: play calling, possessions, end of game ----------------
function mpPlaycall() {
  G.state = 'playcall'; MP.calls = {}; MP.callSeq++; MP.callT = G.t; updBug();
  setupPlay(PLAYS[0], G.los, G.x0); clearRouteLines();
  mpShowCall();
}
function mpShowCall() {
  // build the right menu for this player: plays on offense, defensive calls on defense
  const off = localIsOff(), fgDist = Math.round(50 - G.los + 17), canFG = fgDist <= 62;
  $('pcSit').innerHTML = `<b>${ORD[Math.min(4, G.down)]} &amp; ${G.fdZ >= 50 ? 'Goal' : G.togo}</b> · ${yardText(G.los)} · ${G.ot ? 'Overtime' : 'Q' + Math.min(G.q, 4) + ' ' + clockText(G.clock)} · <span class="side">${off ? 'YOUR BALL' : 'YOU’RE ON DEFENSE'}</span>`;
  if (off) {
    $('pcList').innerHTML = PLAYS.map((p, i) => `<button class="pc" data-i="${i}"><canvas width="160" height="96"></canvas><b>${p.name}</b><span>${p.d}</span><em>${i + 1}</em></button>`).join('') +
      (G.down >= 3 ? `<div class="special">${canFG ? `<button class="sp" data-s="fg">Field goal <small>${fgDist} yds</small></button>` : ''}${G.down === 4 && !G.ot ? `<button class="sp" data-s="punt">Punt</button>` : ''}</div>` : '');
    $('pcList').querySelectorAll('.pc').forEach(b => { drawPlayArt(b.querySelector('canvas'), PLAYS[+b.dataset.i]); b.onclick = () => mpChoose(+b.dataset.i); });
    $('pcList').querySelectorAll('.sp').forEach(b => b.onclick = () => mpChoose(b.dataset.s));
  } else {
    $('pcList').innerHTML = DCALLS.map((c, i) => `<button class="pc def" data-i="${i}"><canvas width="160" height="96"></canvas><b>${c.name}</b><span>You: <b>${c.you}</b>. ${c.d}</span><em>${i + 1}</em></button>`).join('');
    $('pcList').querySelectorAll('.pc').forEach(b => { drawDefArt(b.querySelector('canvas'), DCALLS[+b.dataset.i]); b.onclick = () => mpChoose(+b.dataset.i); });
  }
  $('pcWait').classList.add('hide'); $('pcList').classList.remove('hide');
  showScreen('playcall');
}
function mpChoose(v) { AU.click(); $('pcList').classList.add('hide'); $('pcWait').classList.remove('hide'); $('pcWait').textContent = 'Waiting for your opponent to call their play…'; MP.myCall = MP.callSeq; act('call', [v]); }
function mpPick(role, v) {
  if (MP.calls[role] !== undefined) return; MP.calls[role] = v;
  const o = MP.calls.off; if (o !== undefined && (MP.calls.def !== undefined || o === 'fg' || o === 'punt')) mpBegin();
}
function mpBegin() {
  const o = MP.calls.off; showScreen(null); MP.setupSeq++;
  if (o === 'fg') { MP.setup = { seq: MP.setupSeq, k: 'fg' }; return startFG(); }
  if (o === 'punt') { MP.setup = { seq: MP.setupSeq, k: 'punt' }; return doPunt(); }
  const pi = clamp(+o || 0, 0, PLAYS.length - 1), di = clamp(+MP.calls.def || 0, 0, DCALLS.length - 1);
  choosePlay(PLAYS[pi], { dcall: DCALLS[di].id });
  MP.setup = { seq: MP.setupSeq, k: 'play', p: pi, d: di, press: PS.press ? 1 : 0, dc: ['blitz', 'spy', 'zone'].indexOf(PS.defCall) };
}
function mpPossess(ownYard) { // the other team gets the ball
  G.off = 1 - G.off; mpRebuild(); startDrive(ownYard);
}
function mpRebuild() { const o = TEAMS[MP.T[G.off]], d = TEAMS[MP.T[1 - G.off]]; buildRosters(o, d); paintField(o.name.toUpperCase(), o.c1, d.name.toUpperCase(), d.c1); MP.lastFlowOff = G.off; }
function mpAfter(n) {
  if (G.ot && (n === 'scored' || n === 'opp-scored' || n === 'safety')) return endGame();
  if (n === 'down') return G.clock <= 0 ? endQuarter(openPlaycall) : openPlaycall();
  let start = 25;
  if (n === 'turnover' || n === 'downs') start = clamp(Math.round(50 - (n === 'turnover' ? G.turnZ : G.los)), 1, 99);
  // after a pick six the team that scored kicks off, so the ball goes back to the team that threw it
  const next = n === 'opp-scored' ? () => startDrive(25) : () => mpPossess(start);
  if (G.clock <= 0) return endQuarter(next);
  next();
}
function mpEnd(forfeit) {
  G.state = 'over'; document.exitPointerLock && document.exitPointerLock(); $('hud').classList.add('hide');
  const me = MP.side, won = forfeit ? true : G.sc[me] > G.sc[1 - me], tie = !forfeit && G.sc[0] === G.sc[1];
  $('goT').textContent = forfeit ? 'YOU WIN' : tie ? 'TIE' : won ? 'VICTORY' : 'DEFEAT'; $('goT').className = won || tie ? 'good' : 'bad';
  $('goS').textContent = `${TEAMS[MP.T[0]].abbr} ${G.sc[0]} – ${G.sc[1]} ${TEAMS[MP.T[1]].abbr}${forfeit ? ' · opponent left' : ''}`;
  const st = G.S[me];
  $('goStats').innerHTML = [['Your passing', `${st.comp}/${st.att}, ${st.pass} yds`], ['Your rushing', `${st.rush} yds`], ['Touchdowns', st.td], ['Interceptions thrown', st.int], ['Sacks taken', st.sack], ['Opponent', MP.names[1 - me]]].map(([a, b]) => `<div><span>${a}</span><b>${escH(b)}</b></div>`).join('');
  $('goNext').textContent = 'MENU'; $('goNext').dataset.mp = '1';
  showScreen('overOv'); AU.musicOn = true; AU.crowdTo(.2); if (won) { AU.crowdSwell(1); AU.good(); }
  save.rec.games++; if (won) save.rec.wins++; store();
}

// ---------------- host: what the guest tells us ----------------
function mpHostInput(s) {
  const [mv, acts] = s.split('|'), a = mv.split(',');
  MP.rin = { x: +a[0] || 0, z: +a[1] || 0, sprint: a[2] === '1', yaw: +a[3] || 0, pitch: +a[4] || 0, rp: a[5] !== '' && a[5] !== undefined && a[5] !== 'x' ? { x: +a[5], z: +a[6] } : null, rpT: PS.t };
  if (acts) for (const e of acts.split(';')) { const q = e.split('~'), seq = +q[0]; if (seq > MP.ract) { MP.ract = seq; doAct(q[1], q.slice(2), false); } }
}
// ---------------- host: send the field ----------------
function mpEvent(k, args) { MP.evSeq++; MP.ev.push(MP.evSeq + '~' + k + '~' + args.map(x => typeof x === 'number' ? +x.toFixed(3) : String(x).replace(/[~;|^]/g, ' ')).join('^')); if (MP.ev.length > 14) MP.ev.shift(); }
function mpSnap() {
  const fl = [G.off, G.down, G.togo, G.los * 10, G.fdZ * 10, G.x0 * 100, Math.max(0, G.clock) * 10, G.q, G.sc[0], G.sc[1], G.ot ? 1 : 0, MP.callSeq].map(b36).join('.');
  const idx = p => p ? PLAYERS.indexOf(p) + 1 : 0;
  const ps = [PHASES.indexOf(PS.phase), idx(PS.carrier), idx(PS.ctrl), idx(PS.dctrl), idx(ball.holder), BSTATES.indexOf(ball.state)].map(b36).join('.');
  const pl = PLAYERS.map(p => [p.pos.x * 100, p.pos.z * 100, p.face * 100, Math.max(0, POSES.indexOf(p.pose)), p.fall * 100, (p.down ? 1 : 0) | (p.stun > 0 ? 2 : 0) | (p.m.root.visible ? 0 : 4)].map(b36).join('.')).join(';');
  const bl = [ball.pos.x * 100, ball.pos.y * 100, ball.pos.z * 100, ball.vel.x * 10, ball.vel.y * 10, ball.vel.z * 10, ball.spin * 10].map(b36).join('.');
  const su = MP.setup ? [MP.setup.seq, MP.setup.k === 'fg' ? 1 : MP.setup.k === 'punt' ? 2 : 0, MP.setup.p || 0, MP.setup.d || 0, MP.setup.press || 0, MP.setup.dc || 0].map(b36).join('.') : '';
  const fg = [['', 'aim', 'flight'].indexOf(FG.phase), FG.wind * 100, FG.p * 100].map(b36).join('.');
  const lr = landRing.visible ? [landRing.position.x * 10, landRing.position.z * 10].map(b36).join('.') : '';
  return [++MP.snapSeq, b36(performance.now()), STATES.indexOf(G.state), fl, ps, pl, bl, MP.ev.join(';'), su, fg, lr].join('|');
}
function mpHostTick(dt) {
  MP.sendT += dt; if (MP.sendT < 1 / 15) return; MP.sendT = 0;
  DB.put(mpPath('s'), mpSnap());
}
// keep hosting when the tab is in the background (timers there are throttled, a worker's aren't)
try { const wk = new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),50)'], { type: 'text/javascript' }))); let lastW = performance.now();
  wk.onmessage = () => { const now = performance.now(), dt = Math.min(.25, (now - lastW) / 1000); lastW = now; if (document.hidden && MP.on && MP.host && MP.started) { update(dt); } }; } catch (e) { }

// ---------------- guest ----------------
function mpSendInput(force) {
  if (!MP.on || MP.host || !DB) return; const p = viewP();
  const rp = p && !p.down && p.fall <= 0 && (G.state === 'live') ? [p.pos.x.toFixed(2), p.pos.z.toFixed(2)] : ['x', 'x'];
  const i = readInput(), s = [i.x.toFixed(2), i.z.toFixed(2), i.sprint ? 1 : 0, G.yaw.toFixed(3), G.pitch.toFixed(3), ...rp].join(',') + '|' + MP.acts.map(a => a.join('~')).join(';');
  if (!force && s === MP.lastIn) return; MP.lastIn = s; DB.put(mpPath('i/' + MP.me), s);
}
function mpGuestSnap(str) {
  const f = str.split('|'); if (f.length < 10) return;
  const seq = +f[0]; if (seq <= (MP.lastSeq || 0) && MP.lastSeq - seq < 1000) return; MP.lastSeq = seq;
  const now = performance.now(), ht = p36(f[1]); const sample = now - ht; MP.off = MP.off === null || sample < MP.off ? sample : MP.off + (sample - MP.off) * .03;
  const fl = f[3].split('.').map(p36);
  const newOff = fl[0]; G.down = fl[1]; G.togo = fl[2]; G.los = fl[3] / 10; G.fdZ = fl[4] / 10; G.x0 = fl[5] / 100; G.clock = fl[6] / 10; G.q = fl[7]; G.sc = [fl[8], fl[9]]; G.ot = fl[10]; const callSeq = fl[11];
  if (newOff !== G.off || MP.lastFlowOff === -1) { G.off = newOff; mpRebuild(); MP.gotSetup = -1; }
  // a new play was set up: place everyone the same way the host did
  const su = f[8] ? f[8].split('.').map(p36) : null;
  if (su && su[0] !== MP.gotSetup) {
    MP.gotSetup = su[0];
    if (su[1] === 0) { const play = PLAYS[su[2]]; choosePlay(play, { dcall: DCALLS[su[3]].id, press: !!su[4], defCall: ['blitz', 'spy', 'zone'][su[5]] || 'zone' }); }
    else if (su[1] === 1) { startFG(); }
  }
  const st = STATES[+f[2]] || 'dead';
  if (st === 'playcall' && G.state !== 'playcall') { G.state = 'playcall'; setupPlay(PLAYS[0], G.los, G.x0); clearRouteLines(); }
  if (st === 'playcall' && MP.myCall !== callSeq) { MP.callSeq = callSeq; if ($('playcall').classList.contains('hide') || MP.shownCall !== callSeq) { MP.shownCall = callSeq; mpShowCall(); } }
  if (st !== 'playcall' && !$('playcall').classList.contains('hide')) showScreen(null);
  if (st === 'over' && G.state !== 'over') { G.state = 'over'; mpEnd(false); }
  else if (st !== 'playcall' && st !== 'over') { if (st === 'fg' && G.state !== 'fg') startFG(); G.state = st; }
  // play state
  const ps = f[4].split('.').map(p36), at = i => i ? PLAYERS[i - 1] : null;
  PS.phase = PHASES[ps[0]] || PS.phase; PS.carrier = at(ps[1]); PS.ctrl = at(ps[2]); PS.dctrl = at(ps[3]); ball.holder = at(ps[4]); ball.state = BSTATES[ps[5]] || 'held';
  const P = f[5].split(';').map(s => s.split('.').map(p36));
  const b = f[6].split('.').map(p36);
  MP.snaps.push({ t: ht, P, b }); if (MP.snaps.length > 20) MP.snaps.shift();
  for (let i = 0; i < PLAYERS.length && i < P.length; i++) { const p = PLAYERS[i], q = P[i]; p.pose = POSES[q[3]] || ''; p.down = !!(q[5] & 1); p.stun = q[5] & 2 ? .1 : 0; p.m.root.visible = !(q[5] & 4); p.fallNet = q[4] / 100; }
  ball.vel.set(b[3] / 10, b[4] / 10, b[5] / 10); ball.spin = b[6] / 10;
  const fg = f[9].split('.').map(p36); if (G.state === 'fg') { if (!(localIsOff() && FG.phase === 'aim' && fg[0] === 1)) FG.phase = ['', 'aim', 'flight'][fg[0]] || ''; FG.wind = fg[1] / 100; }
  if (f[10]) { const l = f[10].split('.').map(p36); landRing.visible = !localIsOff(); landRing.position.set(l[0] / 10, .04, l[1] / 10); } else if (!G.charging) landRing.visible = false;
  // events: banners and sounds the host played
  if (f[7]) for (const e of f[7].split(';')) { const q = e.split('~'), s = +q[0]; if (s <= (MP.evSeen || 0)) continue; MP.evSeen = s; const args = (q[2] || '').split('^').map(x => (x !== '' && !isNaN(+x) ? +x : x)); if (q[1] === 'banner') G.banner(...args); else if (q[1] === 'celebrate') celebrate(PS.carrier); else if (AU[q[1]] && AU._orig && AU._orig[q[1]]) AU._orig[q[1]].apply(AU, args); }
  updBug();
}
function mpGuestFrame(dt) {
  // draw everyone ~90ms in the past between two snapshots, except your own player who moves right away
  const S = MP.snaps; if (S.length < 1) return;
  const rt = performance.now() - MP.off - 90; let A = S[S.length - 1], B = A;
  for (let k = S.length - 1; k > 0; k--) if (S[k - 1].t <= rt) { A = S[k - 1]; B = S[k]; break; }
  const k = B === A ? 1 : clamp((rt - A.t) / Math.max(1, B.t - A.t), 0, 1.15), mine = viewP();
  for (let i = 0; i < PLAYERS.length; i++) {
    const p = PLAYERS[i], a = A.P[i], b = B.P[i]; if (!a || !b) continue;
    const x = lerp(a[0], b[0], k) / 100, z = lerp(a[1], b[1], k) / 100;
    let da = b[2] / 100 - a[2] / 100; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    p.fall = lerp(a[4], b[4], k) / 100;
    if (p === mine && G.state === 'live' && !p.down && p.fall <= 0) {
      // your own player: move locally, only snap back if the host strongly disagrees
      const err = Math.hypot(b[0] / 100 - p.pos.x, b[1] / 100 - p.pos.z); if (err > 3.2) { p.pos.x = b[0] / 100; p.pos.z = b[1] / 100; }
      continue;
    }
    const vx = (b[0] - a[0]) / 100 / Math.max(.03, (B.t - A.t) / 1000), vz = (b[1] - a[1]) / 100 / Math.max(.03, (B.t - A.t) / 1000);
    p.pos.x = x; p.pos.z = z; p.vel.set(B === A ? 0 : vx, 0, B === A ? 0 : vz); p.face = a[2] / 100 + da * k;
  }
  const a = A.b, b = B.b; ball.pos.set(lerp(a[0], b[0], k) / 100, lerp(a[1], b[1], k) / 100, lerp(a[2], b[2], k) / 100);
  if (ball.state === 'held' && ball.holder) { const h = ball.holder, f = V3(Math.sin(h.face), 0, Math.cos(h.face)), r = V3(-Math.cos(h.face), 0, Math.sin(h.face)); ball.pos.copy(h.pos).addScaledVector(f, .22).addScaledVector(r, .2); ball.pos.y = h.down || h.fall > .5 ? .25 : 1.22; }
  // your own player moves on your screen
  if (mine && (G.state === 'live' || G.state === 'presnap') && !mine.down && mine.fall <= 0) { PS.t += dt; moveCtrl(mine, Object.assign(readInput(), { yaw: G.yaw }), dt); mine.pos.x += mine.vel.x * dt; mine.pos.z += mine.vel.z * dt; }
  if (mine && mine.fall > 0 && !G.camFall && G.state !== 'playcall') { G.camFall = { t: 0, roll: (Math.random() < .5 ? -1 : 1) * .6 }; bumpCam(.6); }
  MP.inT -= dt; if (MP.inT <= 0) { MP.inT = 1 / 20; mpSendInput(false); }
}
// wrap sounds + banners on the host so the guest hears and sees them too
(function () {
  AU._orig = {};
  for (const k of ['whistle', 'hut', 'throw', 'catchBall', 'thud', 'pads', 'tackle', 'juke', 'grunt', 'kick', 'boo', 'horn', 'good', 'bad', 'crowdSwell']) { const f = AU[k]; AU._orig[k] = f; AU[k] = function (...a) { if (MP.on && MP.host && MP.started) mpEvent(k, a); return f.apply(AU, a); }; }
  const bn = G.banner; G.banner = function (t, kind, sub) { if (MP.on && MP.host && MP.started) mpEvent('banner', [t, kind || '', sub || '']); return bn.call(G, t, kind, sub); };
})();
function drawDefArt(c, d) {
  const x = c.getContext('2d'), W = c.width, H = c.height; x.clearRect(0, 0, W, H); x.fillStyle = 'rgba(90,30,30,.5)'; x.fillRect(0, 0, W, H);
  const sx = v => W / 2 - v * 3.2, sz = v => H - 18 - v * 3.4; x.strokeStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.moveTo(0, sz(0)); x.lineTo(W, sz(0)); x.stroke();
  const spots = { DL: [[-3.2, 1], [-1.1, 1], [1.1, 1], [3.2, 1]], LB0: [4.5, 4.6], LB1: [0, 5], LB2: [-4.5, 4.6], CB0: [19, 6.5], CB1: [-19, 6.5], S0: [-8, 9], S1: [8, 14] };
  const you = { man: 'S1', zone: 'LB1', blitz: 'LB0', spy: 'LB0' }[d.id];
  x.fillStyle = '#fff'; for (const [a, b] of spots.DL) { x.beginPath(); x.arc(sx(a), sz(b), 3, 0, TAU); x.fill(); }
  for (const k of ['LB0', 'LB1', 'LB2', 'CB0', 'CB1', 'S0', 'S1']) { const [a, b] = d.id === 'zone' && k === 'S0' ? [-9, 13] : spots[k]; x.fillStyle = k === you ? '#ffd166' : '#fff'; x.beginPath(); x.arc(sx(a), sz(b), k === you ? 5 : 3, 0, TAU); x.fill(); }
  x.strokeStyle = '#ffd166'; x.lineWidth = 2.2; const [ya, yb] = spots[you]; x.beginPath(); x.moveTo(sx(ya), sz(yb));
  if (d.id === 'blitz') x.lineTo(sx(0), sz(-4)); else if (d.id === 'spy') x.lineTo(sx(0), sz(2.5)); else if (d.id === 'zone') { x.arc(sx(0), sz(8), 14, 0, TAU); } else x.lineTo(sx(0), sz(20));
  x.stroke();
}

// boot
resize(); applyQuality(); addEventListener('resize', resize);
if (matchMedia('(pointer:coarse)').matches) document.body.classList.add('touch');
toTitle();
if (document.fonts) document.fonts.ready.then(() => { if (G.state === 'menu') { paintField('GULLS', TEAMS[0].c1, 'COYOTES', TEAMS[3].c1); } numCacheReset(); });
function numCacheReset() { }
requestAnimationFrame(frame);
})();
