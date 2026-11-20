'use strict';

// ---------- Languages ----------
// code: ISO code used by the translators, ocr: Tesseract traineddata name, mm: MyMemory code
const LANGS = [
  { code: 'en', name: 'English', ocr: 'eng', mm: 'en' },
  { code: 'es', name: 'Spanish', ocr: 'spa', mm: 'es' },
  { code: 'fr', name: 'French', ocr: 'fra', mm: 'fr' },
  { code: 'de', name: 'German', ocr: 'deu', mm: 'de' },
  { code: 'it', name: 'Italian', ocr: 'ita', mm: 'it' },
  { code: 'pt', name: 'Portuguese', ocr: 'por', mm: 'pt' },
  { code: 'nl', name: 'Dutch', ocr: 'nld', mm: 'nl' },
  { code: 'sv', name: 'Swedish', ocr: 'swe', mm: 'sv' },
  { code: 'pl', name: 'Polish', ocr: 'pol', mm: 'pl' },
  { code: 'tr', name: 'Turkish', ocr: 'tur', mm: 'tr' },
  { code: 'ru', name: 'Russian', ocr: 'rus', mm: 'ru' },
  { code: 'uk', name: 'Ukrainian', ocr: 'ukr', mm: 'uk' },
  { code: 'ar', name: 'Arabic', ocr: 'ara', mm: 'ar' },
  { code: 'hi', name: 'Hindi', ocr: 'hin', mm: 'hi' },
  { code: 'vi', name: 'Vietnamese', ocr: 'vie', mm: 'vi' },
  { code: 'id', name: 'Indonesian', ocr: 'ind', mm: 'id' },
  { code: 'ja', name: 'Japanese', ocr: 'jpn', mm: 'ja' },
  { code: 'ko', name: 'Korean', ocr: 'kor', mm: 'ko' },
  { code: 'zh', name: 'Chinese', ocr: 'chi_sim', mm: 'zh-CN' },
];
const LANG = Object.fromEntries(LANGS.map(l => [l.code, l]));
const MAX_TARGETS = 4;

// ---------- Settings ----------
const DEFAULTS = {
  source: 'en', targets: ['es'], engine: 'auto', interval: 3,
  opacity: 1, minConf: 55, overlay: true,
};
const store = {
  load() {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('screenTranslator') || '{}') }; }
    catch { return { ...DEFAULTS }; }
  },
  save() {
    try { localStorage.setItem('screenTranslator', JSON.stringify(cfg)); } catch { /* storage unavailable */ }
  },
};
const cfg = store.load();
cfg.targets = cfg.targets.filter(t => LANG[t]).slice(0, MAX_TARGETS);
if (!cfg.targets.length) cfg.targets = ['es'];
if (!LANG[cfg.source]) cfg.source = 'en';

// ---------- DOM ----------
const $ = id => document.getElementById(id);
const view = $('view'), vctx = view.getContext('2d');
const video = document.createElement('video');
video.muted = true; video.playsInline = true;

const frame = document.createElement('canvas');            // last captured frame, full resolution
const fctx = frame.getContext('2d', { willReadFrequently: true });
const ocrCanvas = document.createElement('canvas');
const octx = ocrCanvas.getContext('2d', { willReadFrequently: true });
const sigCanvas = document.createElement('canvas');
sigCanvas.width = 64; sigCanvas.height = 36;
const sctx = sigCanvas.getContext('2d', { willReadFrequently: true });

// ---------- State ----------
let stream = null;
let worker = null, workerLang = null, workerLoading = null;
let busy = false, autoTimer = 0, lastSig = null;
let lines = [];             // { text, conf, box:{x,y,w,h}, tr:{code: {text, err}} }
let region = null;          // {x,y,w,h} in frame pixels
let drag = null;
let showOriginal = false;
let hoverIdx = -1;
let floatDoc = null, floatWin = null;
const cache = new Map();
const deviceTranslators = new Map();

// ---------- UI setup ----------
function buildLangUI() {
  const sel = $('selSource');
  sel.innerHTML = LANGS.map(l => `<option value="${l.code}">${l.name}</option>`).join('');
  sel.value = cfg.source;
  sel.onchange = () => { cfg.source = sel.value; store.save(); lastSig = null; updateEngineTag(); };
  renderTargets();
}

function renderTargets() {
  const box = $('targets');
  box.innerHTML = '';
  for (const l of LANGS) {
    const idx = cfg.targets.indexOf(l.code);
    const b = document.createElement('button');
    b.className = 'chip' + (idx >= 0 ? ' on' : '');
    b.innerHTML = (idx >= 0 ? `<span class="n">${idx + 1}</span>` : '') + l.name;
    b.title = idx === 0 ? 'Shown on the picture' : idx > 0 ? 'Shown in the list' : 'Add as a target language';
    b.onclick = () => toggleTarget(l.code);
    box.appendChild(b);
  }
}

function toggleTarget(code) {
  const i = cfg.targets.indexOf(code);
  if (i >= 0) {
    if (cfg.targets.length === 1) return flashTag('Keep at least one target language', true);
    cfg.targets.splice(i, 1);
  } else {
    if (cfg.targets.length >= MAX_TARGETS) cfg.targets.pop();
    cfg.targets.push(code);
  }
  store.save();
  renderTargets();
  updateEngineTag();
  if (lines.length) translateLines().then(render);
}

function setupSettings() {
  const dlg = $('dlgSettings');
  const bind = (id, key, out, fmt) => {
    const el = $(id);
    el.value = cfg[key];
    const show = () => { if (out) $(out).textContent = fmt(cfg[key]); };
    show();
    el.oninput = () => { cfg[key] = parseFloat(el.value); show(); store.save(); render(); };
  };
  bind('rngInterval', 'interval', 'outInterval', v => `${v}s`);
  bind('rngOpacity', 'opacity', 'outOpacity', v => `${Math.round(v * 100)}%`);
  bind('rngConf', 'minConf', 'outConf', v => `${v}%`);
  const eng = $('selEngine');
  eng.value = cfg.engine;
  eng.onchange = () => { cfg.engine = eng.value; store.save(); updateEngineTag(); if (lines.length) translateLines().then(render); };
  const ov = $('chkOverlay');
  ov.checked = cfg.overlay;
  ov.onchange = () => { cfg.overlay = ov.checked; store.save(); render(); };
  $('btnSettings').onclick = () => dlg.showModal();
}

// ---------- Engine ----------
const hasDevice = () => 'Translator' in self;

async function updateEngineTag() {
  const tag = $('engineTag');
  let label, cls = '';
  if (cfg.engine === 'online') { label = 'Online · MyMemory'; }
  else if (!hasDevice()) {
    label = cfg.engine === 'device' ? 'On-device not supported in this browser' : 'Online · MyMemory';
    cls = cfg.engine === 'device' ? 'err' : '';
  } else {
    try {
      const states = await Promise.all(cfg.targets.filter(t => t !== cfg.source)
        .map(t => deviceAvail({ sourceLanguage: cfg.source, targetLanguage: t })));
      const allOk = states.every(s => s !== 'unavailable');
      if (allOk) { label = 'On-device · private'; cls = 'ok'; }
      else { label = cfg.engine === 'device' ? 'Some pairs not available on-device' : 'On-device + online fallback'; cls = cfg.engine === 'device' ? 'err' : ''; }
    } catch { label = 'Online · MyMemory'; }
  }
  tag.textContent = label;
  tag.className = 'tag ' + cls;
}

let tagTimer = 0;
function flashTag(msg, err) {
  const tag = $('engineTag');
  tag.textContent = msg;
  tag.className = 'tag ' + (err ? 'err' : 'ok');
  clearTimeout(tagTimer);
  tagTimer = setTimeout(updateEngineTag, 2500);
}

function withTimeout(p, ms, msg) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), ms))]);
}

const deviceAvail = pair => withTimeout(
  self.Translator.availability(pair), 4000, 'On-device translator did not respond');

async function deviceTranslate(text, src, tgt) {
  const key = src + '>' + tgt;
  let tp = deviceTranslators.get(key);
  if (!tp) {
    tp = (async () => {
      const avail = await deviceAvail({ sourceLanguage: src, targetLanguage: tgt });
      if (avail === 'unavailable') throw new Error(`${LANG[src].name} → ${LANG[tgt].name} is not available on-device`);
      return withTimeout(self.Translator.create({
        sourceLanguage: src, targetLanguage: tgt,
        monitor(m) {
          m.addEventListener('downloadprogress', e => setStatus(`Downloading ${LANG[tgt].name} language pack…`, e.loaded));
        },
      }), avail === 'available' ? 10000 : 180000, 'On-device language pack did not load');
    })();
    deviceTranslators.set(key, tp);
    // Remember a failure for a minute so every line doesn't wait on the same timeout.
    tp.catch(() => setTimeout(() => deviceTranslators.delete(key), 60000));
  }
  const t = await tp;
  return withTimeout(t.translate(text), 10000, 'On-device translation timed out');
}

let onlineDown = { until: 0, msg: '' };
async function onlineTranslate(text, src, tgt) {
  if (Date.now() < onlineDown.until) throw new Error(onlineDown.msg);
  try { return await onlineFetch(text, src, tgt); }
  catch (e) {
    // Network-level failure: fail the rest of this batch fast instead of waiting on each line.
    if (/timed out|Offline|limit/.test(e.message)) onlineDown = { until: Date.now() + 20000, msg: e.message };
    throw e;
  }
}

async function onlineFetch(text, src, tgt) {
  const url = 'https://api.mymemory.translated.net/get?q=' + encodeURIComponent(text.slice(0, 480)) +
    '&langpair=' + LANG[src].mm + '|' + LANG[tgt].mm;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 10000);
  let r;
  try { r = await fetch(url, { signal: ctl.signal }); }
  catch (e) { throw new Error(e.name === 'AbortError' ? 'Online translator timed out' : 'Offline or blocked'); }
  finally { clearTimeout(timer); }
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  const out = j && j.responseData && j.responseData.translatedText;
  if (!out || j.responseStatus === 429 || /MYMEMORY WARNING|QUOTA/i.test(out)) throw new Error('Daily online limit reached');
  if (j.responseStatus && j.responseStatus !== 200) throw new Error(String(out).slice(0, 80));
  const ta = document.createElement('textarea');
  ta.innerHTML = out;               // decode HTML entities
  return ta.value;
}

async function translate(text, src, tgt) {
  if (src === tgt) return text;
  const key = `${cfg.engine}|${src}|${tgt}|${text}`;
  if (cache.has(key)) return cache.get(key);
  let p;
  if (cfg.engine === 'online' || !hasDevice()) {
    if (cfg.engine === 'device') throw new Error('On-device translation needs Chrome 138+');
    p = onlineTranslate(text, src, tgt);
  } else {
    p = deviceTranslate(text, src, tgt).catch(e => {
      if (cfg.engine === 'device') throw e;
      return onlineTranslate(text, src, tgt);
    });
  }
  cache.set(key, p);
  p.catch(() => cache.delete(key));
  if (cache.size > 3000) cache.delete(cache.keys().next().value);
  return p;
}

async function translateLines() {
  const src = cfg.source;
  const jobs = [];
  for (const ln of lines) {
    for (const tgt of cfg.targets) {
      if (ln.tr[tgt] && !ln.tr[tgt].err) continue;
      jobs.push({ ln, tgt });
    }
  }
  let done = 0;
  const run = async () => {
    while (jobs.length) {
      const { ln, tgt } = jobs.shift();
      try { ln.tr[tgt] = { text: await translate(ln.text, src, tgt) }; }
      catch (e) { ln.tr[tgt] = { err: e.message || 'failed' }; }
      done++;
      if (done % 4 === 0) { render(); }
    }
  };
  const total = jobs.length;
  if (total) setStatus('Translating…', 0);
  const progressTick = setInterval(() => total && setStatus('Translating…', done / total), 150);
  await Promise.all(Array.from({ length: 4 }, run));
  clearInterval(progressTick);
  const results = lines.flatMap(l => cfg.targets.map(t => l.tr[t])).filter(Boolean);
  if (results.length && results.every(r => r.err)) flashTag('Translation failed: ' + results[0].err, true);
}

// ---------- OCR ----------
async function getWorker() {
  const want = LANG[cfg.source].ocr;
  if (worker && workerLang === want) return worker;
  if (workerLoading && workerLoading.lang === want) return workerLoading.p;
  const p = (async () => {
    if (worker) { try { await worker.terminate(); } catch { /* already gone */ } worker = null; }
    setStatus(`Loading ${LANG[cfg.source].name} text reader…`, 0);
    const w = await Tesseract.createWorker(want, 1, {
      logger: m => {
        if (m.status === 'recognizing text') setStatus('Reading text…', m.progress);
        else if (/loading|initializ/.test(m.status)) setStatus(`Loading ${LANG[cfg.source].name} text reader…`, m.progress);
      },
    });
    await w.setParameters({ preserve_interword_spaces: '1' });
    worker = w; workerLang = want;
    return w;
  })();
  workerLoading = { lang: want, p };
  try { return await p; } finally { if (workerLoading && workerLoading.p === p) workerLoading = null; }
}

function extractLines(data) {
  if (data.lines && data.lines.length) return data.lines;
  const out = [];
  for (const b of data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) out.push(l);
  return out;
}

function cropRect() {
  if (region && region.w > 8 && region.h > 8) return region;
  return { x: 0, y: 0, w: frame.width, h: frame.height };
}

function signature(r) {
  sctx.drawImage(frame, r.x, r.y, r.w, r.h, 0, 0, 64, 36);
  const d = sctx.getImageData(0, 0, 64, 36).data;
  const g = new Uint8Array(64 * 36);
  for (let i = 0; i < g.length; i++) g[i] = (d[i * 4] * 3 + d[i * 4 + 1] * 6 + d[i * 4 + 2]) / 10;
  return g;
}
function sigDiff(a, b) {
  if (!a || !b || a.length !== b.length) return 999;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

function grabFrame() {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return false;
  if (frame.width !== w || frame.height !== h) {
    frame.width = w; frame.height = h;
    view.width = w; view.height = h;
    region = null;
  }
  fctx.drawImage(video, 0, 0, w, h);
  return true;
}

async function scan(fromAuto) {
  if (busy || !stream) return;
  busy = true;
  try {
    if (!grabFrame()) return;
    const r = cropRect();
    const sig = signature(r);
    if (fromAuto && sigDiff(sig, lastSig) < 1.5) { render(); return; }
    lastSig = sig;

    // Upscale small areas so OCR can read small UI text, cap huge frames.
    let s = r.h < 500 ? 2 : 1;
    if (r.w * s > 3200) s = 3200 / r.w;
    ocrCanvas.width = Math.round(r.w * s);
    ocrCanvas.height = Math.round(r.h * s);
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(frame, r.x, r.y, r.w, r.h, 0, 0, ocrCanvas.width, ocrCanvas.height);

    const w = await getWorker();
    setStatus('Reading text…', 0);
    const { data } = await w.recognize(ocrCanvas);
    const prev = new Map(lines.map(l => [l.text, l.tr]));
    lines = extractLines(data)
      .map(l => ({
        text: l.text.replace(/\s+/g, ' ').trim(),
        conf: l.confidence,
        box: {
          x: r.x + l.bbox.x0 / s, y: r.y + l.bbox.y0 / s,
          w: (l.bbox.x1 - l.bbox.x0) / s, h: (l.bbox.y1 - l.bbox.y0) / s,
        },
      }))
      .filter(l => l.conf >= cfg.minConf && l.text.length >= 2 && /\p{L}{2}/u.test(l.text) && l.box.h > 4)
      .map(l => ({ ...l, tr: prev.get(l.text) || {} }));

    render();
    await translateLines();
    render();
  } catch (e) {
    console.warn(e);
    flashTag(e.message || 'Something went wrong', true);
  } finally {
    busy = false;
    setStatus(null);
  }
}

// ---------- Rendering ----------
function sampleBg(b) {
  const x = Math.max(0, Math.floor(b.x - 2)), y = Math.max(0, Math.floor(b.y - 2));
  const w = Math.min(frame.width - x, Math.ceil(b.w + 4)), h = Math.min(frame.height - y, Math.ceil(b.h + 4));
  if (w <= 0 || h <= 0) return [32, 32, 32];
  const top = fctx.getImageData(x, y, w, 1).data;
  const bot = fctx.getImageData(x, y + h - 1, w, 1).data;
  let r = 0, g = 0, bl = 0, n = 0;
  for (const d of [top, bot]) for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; bl += d[i + 2]; n++; }
  return [r / n, g / n, bl / n];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function render() {
  if (!frame.width) return;
  vctx.drawImage(frame, 0, 0);
  const primary = cfg.targets[0];

  if (cfg.overlay && !showOriginal) {
    vctx.globalAlpha = cfg.opacity;
    lines.forEach((ln, i) => {
      const t = ln.tr[primary];
      if (!t || !t.text) return;
      const b = ln.box;
      const [r, g, bl] = sampleBg(b);
      const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
      // The OCR box is ink height, so estimate the real font size from which strokes the original line has.
      const asc = /[A-Z0-9bdfhklt'"?!\/()\[\]{}|]|[^\x00-\x7F]/.test(ln.text) ? 0.72 : 0.52;
      const desc = /[gjpqy,;()\[\]{}|]/.test(ln.text) ? 0.22 : 0;
      let size = Math.max(9, (b.h / (asc + desc)) * 0.92);
      vctx.font = `600 ${size}px "Segoe UI", system-ui, sans-serif`;
      let tw = vctx.measureText(t.text).width;
      const minSize = Math.max(9, size * 0.6);
      if (tw > b.w && size > minSize) {
        size = Math.max(minSize, size * b.w / tw);
        vctx.font = `600 ${size}px "Segoe UI", system-ui, sans-serif`;
        tw = vctx.measureText(t.text).width;
      }
      const bw = Math.max(b.w, tw) + 6;
      vctx.fillStyle = `rgb(${r | 0},${g | 0},${bl | 0})`;
      const bh = Math.max(b.h + 4, size * 1.2), cy = b.y + b.h / 2;
      roundRect(vctx, b.x - 3, cy - bh / 2, bw, bh, Math.min(6, bh / 5));
      vctx.fill();
      if (i === hoverIdx) {
        vctx.strokeStyle = '#5b8cff'; vctx.lineWidth = 2; vctx.stroke();
      }
      vctx.fillStyle = lum > 140 ? '#111' : '#fff';
      vctx.textBaseline = 'middle';
      vctx.fillText(t.text, b.x, b.y + b.h / 2 + 1);
    });
    vctx.globalAlpha = 1;
  }

  const rr = drag ? normRect(drag) : region;
  if (rr && rr.w > 2 && rr.h > 2) {
    vctx.save();
    vctx.fillStyle = 'rgba(0,0,0,0.45)';
    vctx.beginPath();
    vctx.rect(0, 0, frame.width, frame.height);
    vctx.rect(rr.x, rr.y, rr.w, rr.h);
    vctx.fill('evenodd');
    const lw = Math.max(2, frame.width / 800);
    vctx.lineWidth = lw;
    vctx.setLineDash([lw * 5, lw * 3]);
    vctx.strokeStyle = '#5b8cff';
    vctx.strokeRect(rr.x, rr.y, rr.w, rr.h);
    vctx.restore();
  }
  renderList(document);
  if (floatDoc) renderList(floatDoc);
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function renderList(doc) {
  const ul = doc.getElementById('lines');
  if (!ul) return;
  const cnt = doc.getElementById('lineCount');
  if (cnt) cnt.textContent = lines.length ? `(${lines.length})` : '';
  const copy = doc.getElementById('btnCopy');
  if (copy) copy.disabled = !lines.length;
  if (!lines.length) {
    ul.innerHTML = `<li class="empty-note">${stream ? 'No text found yet. Press Space or turn on Live.' : 'Share your screen to begin.'}</li>`;
    return;
  }
  const html = lines.map((ln, i) => {
    const trs = cfg.targets.map(t => {
      const v = ln.tr[t];
      if (!v) return `<div class="tr"><b>${t}</b><span>…</span></div>`;
      if (v.err) return `<div class="tr err"><b>${t}</b><span>${esc(v.err)}</span></div>`;
      return `<div class="tr"><b>${t}</b><span>${esc(v.text)}</span></div>`;
    }).join('');
    return `<li data-i="${i}" class="${i === hoverIdx ? 'hl' : ''}"><div class="orig">${esc(ln.text)}</div>${trs}</li>`;
  }).join('');
  if (ul._html !== html) { ul.innerHTML = html; ul._html = html; }
}

let statusTimer = 0;
function setStatus(text, p) {
  const el = $('status');
  clearTimeout(statusTimer);
  if (text == null) { statusTimer = setTimeout(() => { el.hidden = true; }, 120); return; }
  el.hidden = false;
  $('statusText').textContent = text;
  $('progressBar').style.width = `${Math.round((p || 0) * 100)}%`;
}

// ---------- Capture ----------
async function share() {
  if (stream) return stop();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    return flashTag('Screen sharing is not supported in this browser', true);
  }
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
  } catch (e) {
    stream = null;
    if (e.name !== 'NotAllowedError') flashTag('Could not start screen sharing', true);
    return;
  }
  stream.getVideoTracks()[0].addEventListener('ended', stop);
  video.srcObject = stream;
  await video.play();
  await new Promise(res => (video.videoWidth ? res() : video.addEventListener('loadedmetadata', res, { once: true })));
  $('empty').hidden = true;
  view.classList.add('on');
  $('btnShare').textContent = 'Stop sharing';
  $('btnShare').classList.remove('primary');
  $('btnScan').disabled = false;
  $('btnFloat').disabled = false;
  lastSig = null;
  getWorker().catch(() => {});      // warm up OCR while the user looks around
  grabFrame(); render();
  scan(false);
  if ($('chkAuto').checked) startAuto();
}

function stop() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  stopAuto();
  video.srcObject = null;
  $('btnShare').textContent = 'Share screen';
  $('btnShare').classList.add('primary');
  $('btnScan').disabled = true;
  $('empty').hidden = false;
  view.classList.remove('on');
  lines = []; region = null;
  renderList(document);
  if (floatDoc) renderList(floatDoc);
}

function startAuto() {
  stopAuto();
  const tick = async () => {
    if (!stream) return;
    await scan(true);
    autoTimer = setTimeout(tick, cfg.interval * 1000);
  };
  autoTimer = setTimeout(tick, 200);
}
function stopAuto() { clearTimeout(autoTimer); autoTimer = 0; }

// ---------- Region select ----------
function toFrame(e) {
  const r = view.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(frame.width, (e.clientX - r.left) / r.width * frame.width)),
    y: Math.max(0, Math.min(frame.height, (e.clientY - r.top) / r.height * frame.height)),
  };
}
function normRect(d) {
  return { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) };
}
view.addEventListener('pointerdown', e => {
  if (!stream) return;
  const p = toFrame(e);
  drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  view.setPointerCapture(e.pointerId);
});
view.addEventListener('pointermove', e => {
  const p = toFrame(e);
  if (drag) { drag.x1 = p.x; drag.y1 = p.y; render(); return; }
  const i = lines.findIndex(l => p.x >= l.box.x && p.x <= l.box.x + l.box.w && p.y >= l.box.y && p.y <= l.box.y + l.box.h);
  if (i !== hoverIdx) {
    hoverIdx = i; render();
    const li = document.querySelector(`#lines li[data-i="${i}"]`);
    if (li) li.scrollIntoView({ block: 'nearest' });
  }
});
view.addEventListener('pointerup', () => {
  if (!drag) return;
  const r = normRect(drag);
  drag = null;
  const minSide = frame.width / 60;
  if (r.w > minSide && r.h > minSide / 2) {
    region = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) };
    lastSig = null;
    scan(false);
  } else {
    render();
  }
});

// ---------- Float window ----------
async function openFloat() {
  if (floatWin && !floatWin.closed) { floatWin.focus && floatWin.focus(); return; }
  try {
    if ('documentPictureInPicture' in self) {
      floatWin = await documentPictureInPicture.requestWindow({ width: 380, height: 520 });
    } else {
      floatWin = window.open('', 'screen-translator-float', 'width=380,height=520');
    }
  } catch { floatWin = null; }
  if (!floatWin) return flashTag('Pop-up was blocked', true);
  floatDoc = floatWin.document;
  floatDoc.title = 'Translations';
  const link = floatDoc.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('style.css', location.href).href;
  floatDoc.head.appendChild(link);
  floatDoc.body.className = 'float';
  floatDoc.body.innerHTML = `<aside class="panel" style="width:auto;height:100vh;border:0">
    <div class="panel-head"><span>Translations <small id="lineCount"></small></span>
    <button id="btnCopy" class="ghost">Copy all</button></div>
    <ul id="lines" class="lines"></ul></aside>`;
  floatDoc.getElementById('btnCopy').onclick = copyAll;
  floatWin.addEventListener('pagehide', () => { floatDoc = null; floatWin = null; });
  renderList(floatDoc);
}

function copyAll() {
  const txt = lines.map(l => [l.text, ...cfg.targets.map(t => `  [${t}] ${(l.tr[t] && l.tr[t].text) || ''}`)].join('\n')).join('\n\n');
  navigator.clipboard.writeText(txt).then(() => flashTag('Copied to clipboard'), () => flashTag('Copy failed', true));
}

// ---------- Wire up ----------
$('btnShare').onclick = share;
$('btnScan').onclick = () => { lastSig = null; scan(false); };
$('btnFloat').onclick = openFloat;
$('btnCopy').onclick = copyAll;
$('chkAuto').onchange = e => { if (e.target.checked) { if (stream) startAuto(); } else stopAuto(); };
$('lines').addEventListener('mouseover', e => {
  const li = e.target.closest('li[data-i]');
  const i = li ? +li.dataset.i : -1;
  if (i !== hoverIdx) { hoverIdx = i; render(); }
});

window.addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea,dialog')) return;
  if (e.repeat && e.key.toLowerCase() !== 'o') return;
  switch (e.key.toLowerCase()) {
    case ' ': e.preventDefault(); if (stream) { lastSig = null; scan(false); } break;
    case 'a': { const c = $('chkAuto'); c.checked = !c.checked; c.onchange({ target: c }); flashTag(c.checked ? 'Live on' : 'Live off'); break; }
    case 'o': if (!showOriginal) { showOriginal = true; render(); } break;
    case 'escape': if (region) { region = null; lastSig = null; render(); if (stream) scan(false); } break;
    case 'f': if (stream) openFloat(); break;
  }
});
window.addEventListener('keyup', e => {
  if (e.key.toLowerCase() === 'o' && showOriginal) { showOriginal = false; render(); }
});

// ---------- Install (download as an app) ----------
let installPrompt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true;

function installHowTo() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|Android/i.test(ua)) return 'Screen Translator needs to share a screen, which phones and tablets don’t allow. Open this page on a computer to install it.';
  if (/Edg\//.test(ua)) return 'In Edge: open the ⋯ menu, choose Apps, then “Install this site as an app”.';
  if (/Firefox\//.test(ua)) return 'Firefox can’t install web apps. Open this page in Chrome or Edge to install it (the app also works best there).';
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'In Safari on a Mac: choose File → Add to Dock.';
  return 'In Chrome: click the install icon at the right of the address bar, or open the ⋮ menu → Cast, save and share → Install page as app.';
}

function updateInstallUI() {
  const installed = isStandalone();
  document.body.classList.toggle('standalone', installed);
  $('btnInstall').hidden = installed;
  $('instReady').hidden = !installPrompt;
  $('instManual').hidden = !!installPrompt;
  $('instHow').textContent = installHowTo();
}

function openInstall() {
  $('instDone').hidden = true;
  updateInstallUI();
  $('dlgInstall').showModal();
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
  updateInstallUI();
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  updateInstallUI();
  $('instReady').hidden = true;
  $('instManual').hidden = true;
  $('instDone').hidden = false;
  flashTag('Installed. Look for Screen Translator on your desktop.');
});
$('btnInstall').onclick = openInstall;
$('btnInstallNow').onclick = async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  const { outcome } = await installPrompt.userChoice;
  installPrompt = null;
  if (outcome !== 'accepted') updateInstallUI();
};
matchMedia('(display-mode: standalone)').addEventListener('change', updateInstallUI);

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}

buildLangUI();
setupSettings();
updateInstallUI();
if (location.hash === '#install' && !isStandalone()) openInstall();
updateEngineTag();
renderList(document);
