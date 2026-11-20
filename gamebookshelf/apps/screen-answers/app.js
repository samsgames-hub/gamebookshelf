// Screen Answers: capture a screen, send the picture to Claude, show answers to the questions on it.
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk';

const $ = id => document.getElementById(id);
const view = $('view');
const vctx = view.getContext('2d');
const video = document.createElement('video');
video.muted = true; video.playsInline = true;
const frame = document.createElement('canvas');        // latest full frame
const fctx = frame.getContext('2d', { willReadFrequently: true });

// ---------- Settings ----------
const DEFAULTS = { engine: 'pro', key: '', model: 'claude-opus-5-5', effort: 'medium', style: 'explain', interval: 5 };
let cfg = { ...DEFAULTS };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('screenAnswers.cfg') || '{}')); } catch { /* storage blocked */ }
function save() { try { localStorage.setItem('screenAnswers.cfg', JSON.stringify(cfg)); } catch { /* storage blocked */ } }

const STYLE_TEXT = {
  short: 'Give only the answer to each question: the option letter and text for multiple choice, or a short answer otherwise. No explanations.',
  explain: 'Give the answer to each question, then one or two sentences on why.',
  steps: 'Give the answer to each question, then show the working step by step so the reader can learn how to solve it.',
};
const SYSTEM = `You help people with questions that appear on their screen. You receive a screenshot (and sometimes a typed question).
Find every question, quiz item, problem or prompt that is visible and answer each one correctly.
Format:
- For each question, start a line with "### " followed by a very short restatement of the question (a few words; include its number if it has one).
- Then put the answer in **bold** on the next line.
- If there are answer options, name the correct option letter/number and its text.
- Keep it tight. Use plain Markdown only: headings with ###, bold, bullet lists, inline code.
If no question is visible, say so in one sentence and briefly describe what is on the screen.
If something is cut off or too blurry to read, say what you can't read instead of guessing.`;

// ---------- State ----------
let stream = null;
let region = null;          // {x,y,w,h} in frame pixels
let drag = null;
let liveTimer = 0;
let lastSig = null, pendingSig = null;
let current = null;         // running request {stream, card}
let history = [];           // conversation turns for follow-ups (last screenshot + answers)
let answers = [];           // {question, text}
const LOCAL_COPY = location.hostname === 'localhost' && location.port === '8787';
const HELPER = LOCAL_COPY ? '' : 'http://localhost:8787';
let helperOk = false;       // local helper reachable and Claude Code installed
let helperMsg = '';
let proContext = '';        // last answer, for follow-ups in Pro plan mode

async function checkHelper() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(HELPER + '/health', { signal: ctrl.signal });
    clearTimeout(t);
    const data = await res.json();
    helperOk = !!(data.ok && data.claude);
    helperMsg = helperOk ? 'Helper is running. Answers use your Claude plan.' : 'Helper is running, but Claude Code is not installed yet (see step 1).';
  } catch {
    helperOk = false;
    helperMsg = LOCAL_COPY ? 'Helper is not running. Start it again from your Desktop.' : 'Cannot reach the helper. If it is running, open http://localhost:8787 instead.';
  }
  updateKeyNote();
  return helperOk;
}
function ready() { return cfg.engine === 'pro' ? helperOk : !!cfg.key; }

// ---------- UI helpers ----------
function status(text) {
  $('status').hidden = !text;
  $('statusText').textContent = text || '';
}
function updateKeyNote() {
  const n = $('keyNote');
  const s = $('helperState');
  if (s) { s.textContent = helperMsg || 'Checking for the helper…'; s.className = 'state ' + (helperOk ? 'ok' : 'bad'); }
  if (ready()) { n.textContent = ''; return; }
  n.innerHTML = cfg.engine === 'pro'
    ? 'First, start the helper so Claude can use your Pro plan. <button type="button" class="primary">Set up</button>'
    : 'First, add your Anthropic API key. <button type="button" class="primary">Add key</button>';
  n.querySelector('button').onclick = openSettings;
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}
function md(src) {
  const out = [];
  let list = null, code = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const raw of escapeHtml(src).split('\n')) {
    if (raw.startsWith('```')) {
      if (code !== null) { out.push(`<pre><code>${code}</code></pre>`); code = null; } else { closeList(); code = ''; }
      continue;
    }
    if (code !== null) { code += raw + '\n'; continue; }
    const line = raw.trimEnd();
    let m;
    if ((m = line.match(/^#{1,6}\s+(.*)/))) { closeList(); out.push(`<h4>${inline(m[1])}</h4>`); }
    else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push(`<li>${inline(m[1])}</li>`); }
    else if (!line.trim()) closeList();
    else { closeList(); out.push(`<p>${inline(line)}</p>`); }
  }
  if (code !== null) out.push(`<pre><code>${code}</code></pre>`);
  closeList();
  return out.join('');
}
function renderEmptyPanel() {
  if (!$('answers').querySelector('.card')) $('answers').innerHTML = '<div class="hintbox">Answers show up here.</div>';
  $('count').textContent = answers.length ? `(${answers.length})` : '';
  $('btnCopy').disabled = !answers.length;
  $('btnClear').disabled = !$('answers').querySelector('.card');
}
function addCard({ question, thumb }) {
  const box = $('answers');
  const hint = box.querySelector('.hintbox'); if (hint) hint.remove();
  const card = document.createElement('div');
  card.className = 'card live';
  const t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  card.innerHTML = `<div class="meta"><span>${t}</span></div>${question ? `<div class="q">${escapeHtml(question)}</div>` : ''}<div class="body cursor"></div>`;
  if (thumb) { const img = new Image(); img.src = thumb; img.alt = 'Screenshot that was sent'; card.querySelector('.meta').appendChild(img); }
  box.prepend(card);
  box.scrollTop = 0;
  return card;
}

// ---------- Capture ----------
async function share() {
  if (stream) return stopShare();
  if (!navigator.mediaDevices?.getDisplayMedia) return status('Screen sharing is not supported in this browser') || setTimeout(() => status(''), 3000);
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
  } catch (e) {
    stream = null;
    if (e.name !== 'NotAllowedError') { status('Could not start screen sharing'); setTimeout(() => status(''), 3000); }
    return;
  }
  stream.getVideoTracks()[0].addEventListener('ended', stopShare);
  video.srcObject = stream;
  await video.play();
  await new Promise(res => (video.videoWidth ? res() : video.addEventListener('loadedmetadata', res, { once: true })));
  $('btnShare').textContent = 'Stop sharing';
  $('btnShare').classList.remove('primary');
  region = null; lastSig = null;
  showStage();
  loop();
  if ($('chkLive').checked) startLive();
}
function stopShare() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
  video.srcObject = null;
  stopLive();
  $('btnShare').textContent = 'Share screen';
  $('btnShare').classList.add('primary');
  if (!frame.width) hideStage();
}
function showStage() { $('empty').hidden = true; view.classList.add('on'); $('btnAsk').disabled = false; }
function hideStage() { $('empty').hidden = false; view.classList.remove('on'); $('btnAsk').disabled = true; }

function grabFrame() {
  if (!stream || !video.videoWidth) return;
  if (frame.width !== video.videoWidth || frame.height !== video.videoHeight) { frame.width = video.videoWidth; frame.height = video.videoHeight; }
  fctx.drawImage(video, 0, 0);
}
function loop() {
  if (!stream) return;
  grabFrame();
  draw();
  setTimeout(() => requestAnimationFrame(loop), 120); // ~8 fps preview is plenty
}
function draw() {
  if (!frame.width) return;
  const dpr = window.devicePixelRatio || 1;
  const stage = $('stage').getBoundingClientRect();
  const s = Math.min(stage.width / frame.width, stage.height / frame.height, 1);
  const cssW = Math.round(frame.width * s), cssH = Math.round(frame.height * s);
  if (view.width !== Math.round(cssW * dpr)) { view.width = Math.round(cssW * dpr); view.height = Math.round(cssH * dpr); }
  view.style.width = cssW + 'px'; view.style.height = cssH + 'px';
  vctx.drawImage(frame, 0, 0, view.width, view.height);
  const r = drag ? normRect(drag) : region;
  if (r && r.w > 2 && r.h > 2) {
    const k = view.width / frame.width;
    vctx.save();
    vctx.fillStyle = 'rgba(0,0,0,.5)';
    vctx.beginPath();
    vctx.rect(0, 0, view.width, view.height);
    vctx.rect(r.x * k, r.y * k, r.w * k, r.h * k);
    vctx.fill('evenodd');
    vctx.strokeStyle = '#d97757'; vctx.lineWidth = 2 * dpr; vctx.setLineDash([8 * dpr, 5 * dpr]);
    vctx.strokeRect(r.x * k, r.y * k, r.w * k, r.h * k);
    vctx.restore();
  }
}
window.addEventListener('resize', draw);

// Region select
function toFrame(e) {
  const r = view.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(frame.width, (e.clientX - r.left) / r.width * frame.width)),
    y: Math.max(0, Math.min(frame.height, (e.clientY - r.top) / r.height * frame.height)),
  };
}
function normRect(d) { return { x: Math.min(d.x0, d.x1), y: Math.min(d.y0, d.y1), w: Math.abs(d.x1 - d.x0), h: Math.abs(d.y1 - d.y0) }; }
view.addEventListener('pointerdown', e => { const p = toFrame(e); drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; view.setPointerCapture(e.pointerId); });
view.addEventListener('pointermove', e => { if (!drag) return; const p = toFrame(e); drag.x1 = p.x; drag.y1 = p.y; draw(); });
view.addEventListener('pointerup', () => {
  if (!drag) return;
  const r = normRect(drag); drag = null;
  if (r.w > 20 && r.h > 20) { region = r; lastSig = null; draw(); ask(); }
  else { draw(); }
});

// Snapshot of the frame (or the selected area) as a JPEG for Claude
function snapshot() {
  const r = region || { x: 0, y: 0, w: frame.width, h: frame.height };
  const MAX = 1568;
  const k = Math.min(1, MAX / Math.max(r.w, r.h));
  const c = document.createElement('canvas');
  c.width = Math.round(r.w * k); c.height = Math.round(r.h * k);
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(frame, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.85);
  const t = document.createElement('canvas');
  t.width = 128; t.height = Math.max(1, Math.round(128 * c.height / c.width));
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  return { b64: url.split(',')[1], thumb: t.toDataURL('image/jpeg', 0.7) };
}

// Small greyscale signature to tell when the screen has changed
function signature() {
  const r = region || { x: 0, y: 0, w: frame.width, h: frame.height };
  const c = signature.c || (signature.c = Object.assign(document.createElement('canvas'), { width: 48, height: 27 }));
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(frame, r.x, r.y, r.w, r.h, 0, 0, 48, 27);
  const d = x.getImageData(0, 0, 48, 27).data;
  const g = new Uint8Array(48 * 27);
  for (let i = 0; i < g.length; i++) g[i] = (d[i * 4] * 3 + d[i * 4 + 1] * 6 + d[i * 4 + 2]) / 10;
  return g;
}
function diff(a, b) { if (!a || !b) return 255; let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; }

// ---------- Live mode ----------
function startLive() {
  stopLive();
  const tick = () => {
    liveTimer = setTimeout(tick, cfg.interval * 1000);
    if (!stream || current || !frame.width) return;
    const sig = signature();
    if (diff(sig, lastSig) < 2.5) { pendingSig = null; return; }       // nothing new
    if (!pendingSig || diff(sig, pendingSig) > 1.5) { pendingSig = sig; return; } // still changing: wait until it settles
    pendingSig = null;
    ask({ live: true });
  };
  liveTimer = setTimeout(tick, 300);
}
function stopLive() { clearTimeout(liveTimer); liveTimer = 0; pendingSig = null; }

// ---------- Claude ----------
let client = null, clientKey = '';
function getClient() {
  if (!client || clientKey !== cfg.key) {
    client = new Anthropic({ apiKey: cfg.key, dangerouslyAllowBrowser: true });
    clientKey = cfg.key;
  }
  return client;
}

async function ask({ question = '', live = false, followUp = false } = {}) {
  if (cfg.engine === 'api' && !cfg.key) { openSettings(); $('inKey').focus(); return; }
  if (cfg.engine === 'pro' && !helperOk) {
    await checkHelper();
    if (!helperOk) { if (live) stopLiveToggle(); openSettings(); return; }
  }
  const hasPicture = frame.width > 0;
  if (!hasPicture && !question) return;
  if (current) { current.cancelled = true; current.abort(); }

  let shot = null;
  if (hasPicture && !followUp) {
    grabFrame();
    shot = snapshot();
    lastSig = signature();
  }
  const styleLine = STYLE_TEXT[cfg.style] || STYLE_TEXT.explain;
  const promptText = question
    ? `${question}\n\n(${styleLine})`
    : `Answer the questions on this screen. ${styleLine}`;

  const card = addCard({ question, thumb: shot?.thumb });
  const body = card.querySelector('.body');
  status(live ? 'Screen changed, asking Claude…' : (cfg.engine === 'pro' ? 'Asking Claude on your plan…' : 'Asking Claude…'));

  if (cfg.engine === 'pro') return askPro({ question, shot, followUp, promptText, card, body });
  return askApi({ question, shot, followUp, promptText, card, body });
}

function finishCard(card, body) {
  body.classList.remove('cursor');
  card.classList.remove('live');
  if (current?.card === card) { current = null; status(''); }
  renderEmptyPanel();
}

// Pro/Max plan: the local helper runs Claude Code on this computer.
async function askPro({ question, shot, followUp, promptText, card, body }) {
  const ctrl = new AbortController();
  const job = { card, cancelled: false, abort: () => ctrl.abort() };
  current = job;
  try {
    const res = await fetch(HELPER + '/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: cfg.model,
        system: SYSTEM,
        image: shot?.b64 || null,
        text: promptText,
        context: followUp && proContext ? proContext : null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.text) throw new Error(data.error || `The helper answered with status ${res.status}.`);
    body.innerHTML = md(data.text);
    answers.unshift({ question, text: data.text });
    proContext = data.text.slice(0, 6000);
  } catch (err) {
    if (job.cancelled) { card.remove(); return; }
    card.classList.add('err');
    if (err instanceof TypeError) {
      helperOk = false; updateKeyNote();
      body.innerHTML = md('**The helper is not running.** Start it on this computer, or switch to an API key in Settings.');
      stopLiveToggle();
    } else {
      body.innerHTML = md(`**Claude Code could not answer:** ${err.message}`);
    }
  } finally {
    finishCard(card, body);
  }
}

// API key: call the Claude API straight from the browser.
async function askApi({ question, shot, followUp, promptText, card, body }) {
  const content = [];
  if (shot) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: shot.b64 } });
  content.push({ type: 'text', text: promptText });
  // A follow-up continues the last exchange; anything else starts fresh.
  const messages = followUp && history.length ? [...history, { role: 'user', content }] : [{ role: 'user', content }];
  let text = '';

  const params = {
    model: cfg.model,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: cfg.effort },
    messages,
  };
  if (cfg.model !== 'claude-haiku-5-5') {
    params.betas = ['server-side-fallback-2026-07-01'];
    params.fallbacks = 'default';
  }

  const s = getClient().beta.messages.stream(params);
  const job = { card, cancelled: false, abort: () => s.abort() };
  current = job;
  s.on('text', delta => {
    if (!text) status('Answering…');
    text += delta;
    body.innerHTML = md(text);
  });
  try {
    const final = await s.finalMessage();
    if (final.stop_reason === 'refusal') {
      text = text || 'Claude declined to answer this one.';
      card.classList.add('err');
    } else if (final.stop_reason === 'max_tokens') {
      text += '\n\n*(Answer was cut short.)*';
    }
    body.innerHTML = md(text || 'No answer came back.');
    answers.unshift({ question, text });
    history = [...messages, { role: 'assistant', content: final.content.filter(b => b.type === 'text') }];
  } catch (err) {
    if (job.cancelled) { card.remove(); return; }
    card.classList.add('err');
    body.innerHTML = md(errorText(err));
    if (err instanceof Anthropic.AuthenticationError) stopLiveToggle();
  } finally {
    finishCard(card, body);
  }
}
function errorText(err) {
  if (err instanceof Anthropic.AuthenticationError) return '**Your API key was not accepted.** Check it in Settings.';
  if (err instanceof Anthropic.PermissionDeniedError) return '**This key cannot use that model.** Try another model in Settings.';
  if (err instanceof Anthropic.RateLimitError) return '**Too many requests right now.** Wait a moment and try again.';
  if (err instanceof Anthropic.BadRequestError) return `**The request was rejected:** ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return '**Could not reach Claude.** Check your internet connection.';
  if (err instanceof Anthropic.APIError) return `**Claude had a problem (${err.status ?? 'error'}).** Try again in a moment.`;
  return `**Something went wrong:** ${err?.message || err}`;
}
function stopLiveToggle() { $('chkLive').checked = false; stopLive(); }

// ---------- Pasted / dropped images ----------
async function loadImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const bmp = await createImageBitmap(file);
  if (stream) stopShare();
  frame.width = bmp.width; frame.height = bmp.height;
  fctx.drawImage(bmp, 0, 0);
  bmp.close();
  region = null; lastSig = null;
  showStage(); draw();
  ask();
}
window.addEventListener('paste', e => {
  if (e.target === $('askInput') && !e.clipboardData.files.length) return;
  const f = [...e.clipboardData.files].find(f => f.type.startsWith('image/'));
  if (f) { e.preventDefault(); loadImage(f); }
});
const stage = $('stage');
stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('drop'); });
stage.addEventListener('dragleave', () => stage.classList.remove('drop'));
stage.addEventListener('drop', e => { e.preventDefault(); stage.classList.remove('drop'); loadImage(e.dataTransfer.files[0]); });

// ---------- Settings dialog ----------
let helperPoll = 0;
function showEngine() {
  const pro = $('selEngine').value === 'pro';
  $('proBox').hidden = !pro;
  $('apiBox').hidden = pro;
}
function openSettings() {
  $('selEngine').value = cfg.engine;
  showEngine();
  checkHelper();
  clearInterval(helperPoll);
  helperPoll = setInterval(() => { if ($('selEngine').value === 'pro') checkHelper(); }, 2500);
  $('inKey').value = cfg.key;
  $('selModel').value = cfg.model;
  $('selEffort').value = cfg.effort;
  $('selStyle').value = cfg.style;
  $('rngInterval').value = cfg.interval;
  $('outInterval').textContent = cfg.interval + ' s';
  if (!$('dlgSettings').open) $('dlgSettings').showModal();
}
$('rngInterval').addEventListener('input', e => { $('outInterval').textContent = e.target.value + ' s'; });
$('selEngine').addEventListener('change', showEngine);
$('btnCopyCmd').onclick = async () => {
  try { await navigator.clipboard.writeText($('helperCmd').textContent); $('btnCopyCmd').textContent = 'Copied'; }
  catch { $('btnCopyCmd').textContent = 'Select and copy it'; }
  setTimeout(() => { $('btnCopyCmd').textContent = 'Copy'; }, 1500);
};
$('dlgSettings').addEventListener('close', () => {
  clearInterval(helperPoll);
  cfg.engine = $('selEngine').value;
  cfg.key = $('inKey').value.trim();
  cfg.model = $('selModel').value;
  cfg.effort = $('selEffort').value;
  cfg.style = $('selStyle').value;
  cfg.interval = +$('rngInterval').value;
  save();
  updateKeyNote();
  if (liveTimer) startLive();
});

// ---------- Buttons & keys ----------
$('btnShare').onclick = share;
$('btnAsk').onclick = () => { lastSig = null; ask(); };
$('btnSettings').onclick = openSettings;
$('chkLive').onchange = e => {
  if (e.target.checked) { if (!ready()) { e.target.checked = false; openSettings(); return; } lastSig = null; if (stream) startLive(); }
  else stopLive();
};
$('btnCopy').onclick = async () => {
  const txt = answers.map(a => (a.question ? `Q: ${a.question}\n` : '') + a.text).join('\n\n---\n\n');
  try { await navigator.clipboard.writeText(txt); status('Copied'); } catch { status('Could not copy'); }
  setTimeout(() => { if (!current) status(''); }, 1200);
};
$('btnClear').onclick = () => { answers = []; history = []; proContext = ''; $('answers').innerHTML = ''; renderEmptyPanel(); };
$('askForm').addEventListener('submit', e => {
  e.preventDefault();
  const q = $('askInput').value.trim();
  if (!q) return;
  $('askInput').value = '';
  // With a fresh screen grab available, send the screen with the question; otherwise follow up on the last answer.
  ask({ question: q, followUp: !stream && (cfg.engine === 'pro' ? !!proContext : history.length > 0) });
});
window.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea, dialog')) return;
  if (e.key === ' ' && frame.width) { e.preventDefault(); lastSig = null; ask(); }
  else if (e.key === 'l' || e.key === 'L') { $('chkLive').click(); }
  else if (e.key === 's' || e.key === 'S') { openSettings(); }
  else if (e.key === 'Escape' && region) { region = null; draw(); }
});

updateKeyNote();
if (cfg.engine === 'pro') checkHelper();
renderEmptyPanel();
