// Class Notes: transcribe the class with the browser's speech recognition, then have Claude turn it into notes.
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk';

const $ = id => document.getElementById(id);

// ---------- Settings ----------
const DEFAULTS = { lang: 'en-US', engine: 'pro', key: '', model: 'claude-sonnet-5-5', style: 'outline', interval: 3 };
const cfg = { ...DEFAULTS };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('classNotes.cfg') || '{}')); } catch { /* storage blocked */ }
function saveCfg() { try { localStorage.setItem('classNotes.cfg', JSON.stringify(cfg)); } catch { /* storage blocked */ } }

// Shared with Screen Answers: if the API key was already entered there, reuse it.
if (!cfg.key) { try { const sa = JSON.parse(localStorage.getItem('screenAnswers.cfg') || '{}'); if (sa.key) { cfg.key = sa.key; if (sa.engine) cfg.engine = sa.engine; } } catch { /* ignore */ } }

const STYLE_TEXT = {
  outline: `Write an outline: a "# " title line, then "## " headings for each topic in the order taught, with bullet points (indent sub-points by two spaces). Put key terms in **bold** with a short definition.`,
  cornell: `Write Cornell notes: a "# " title line, then a "## Notes" section as a Markdown table with two columns, "Cue / question" and "Notes" (one row per idea, cue column holds a short question a student could quiz themselves with). End with a "## Summary" section of 3–5 sentences.`,
  brief: `Write short notes: a "# " title line, a "## Summary" of 3–5 sentences, then "## Key points" with at most 10 bullets.`,
};
const SYSTEM = `You are a careful student taking notes during a class. You receive a live speech-to-text transcript of the teacher (it may contain recognition mistakes, filler words, side conversations and repeated phrases) plus notes the student typed and moments the student marked as important.
Turn it into clear, well-organized study notes.
Rules:
- Fix obvious speech-recognition errors from context (e.g. "my toe sis" -> "mitosis"), but never invent facts the teacher did not say. If something is unclear, leave it out or mark it "(unclear)".
- Skip small talk, discipline, and logistics that are not about the subject, EXCEPT always keep homework, due dates, test or quiz dates, and anything the teacher says will be on a test.
- Lines marked [★ IMPORTANT] were flagged by the student: make sure what was being said around that time is in the notes, marked with ★.
- Include examples, formulas and definitions the teacher gave.
- After the main notes, add these sections only if they apply: "## ★ Important / likely on the test", "## Homework & dates", "## Questions to ask" (things that were confusing or left unanswered).
- Use only Markdown: #, ##, ### headings, "- " bullets (indent with two spaces), numbered lists, **bold**, *italic*, \`code\`, and simple | tables.
- Output only the notes, with no preamble.`;

// ---------- Class storage ----------
let classes = [];
try { classes = JSON.parse(localStorage.getItem('classNotes.classes') || '[]'); } catch { classes = []; }
if (!Array.isArray(classes)) classes = [];
let cls = null;
function newClass() {
  const c = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: '', created: Date.now(), updated: Date.now(), segs: [], notes: '', notedWords: 0 };
  classes.unshift(c);
  return c;
}
let saveTimer = 0;
function saveClasses(now = false) {
  clearTimeout(saveTimer);
  const doSave = () => {
    // Drop empty classes other than the one that's open.
    classes = classes.filter(c => c === cls || c.segs.length || c.notes || c.title);
    try { localStorage.setItem('classNotes.classes', JSON.stringify(classes)); }
    catch { toast('Could not save. Browser storage may be full: delete an old class.'); }
  };
  if (now) doSave(); else saveTimer = setTimeout(doSave, 600);
}
function words(c = cls) { return c.segs.reduce((n, s) => n + (s.kind === 'mark' ? 0 : s.text.split(/\s+/).filter(Boolean).length), 0); }

// ---------- UI helpers ----------
let toastTimer = 0;
function toast(msg) {
  $('toast').textContent = msg; $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2600);
}
function escapeHtml(s) { return s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function inline(s) {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/★/g, '<span class="star">★</span>');
}
// Small Markdown renderer: headings, nested lists, tables, paragraphs.
function md(src) {
  const out = [];
  const stack = []; // open lists: {tag, indent}
  let table = null;
  const closeLists = (toIndent = -1) => {
    while (stack.length && stack[stack.length - 1].indent > toIndent) out.push(`</li></${stack.pop().tag}>`);
  };
  const closeTable = () => {
    if (!table) return;
    const [head, ...rows] = table.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r));
    const cells = r => r.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => inline(c.trim()));
    out.push('<table><thead><tr>' + cells(head).map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + cells(r).map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody></table>');
    table = null;
  };
  for (const raw of escapeHtml(src).split('\n')) {
    const line = raw.replace(/\t/g, '  ').trimEnd();
    let m;
    if (/^\s*\|.*\|\s*$/.test(line)) { closeLists(); (table ||= []).push(line); continue; }
    closeTable();
    if ((m = line.match(/^(#{1,6})\s+(.*)/))) {
      closeLists();
      const lvl = Math.min(3, m[1].length);
      out.push(`<h${lvl}>${inline(m[2])}</h${lvl}>`);
    } else if ((m = line.match(/^(\s*)(?:[-*•]|(\d+)[.)])\s+(.*)/))) {
      const indent = m[1].length, tag = m[2] ? 'ol' : 'ul';
      const top = stack[stack.length - 1];
      if (!top || indent > top.indent) { out.push(`<${tag}><li>`); stack.push({ tag, indent }); }
      else {
        closeLists(indent);
        const t = stack[stack.length - 1];
        if (t && t.indent === indent && t.tag === tag) out.push('</li><li>');
        else { if (t && t.indent === indent) out.push(`</li></${stack.pop().tag}>`); out.push(`<${tag}><li>`); stack.push({ tag, indent }); }
      }
      out.push(inline(m[3]));
    } else if (!line.trim()) {
      closeLists();
    } else {
      closeLists();
      out.push(`<p>${inline(line.trim())}</p>`);
    }
  }
  closeTable(); closeLists();
  return out.join('');
}
const clock = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const dateStr = t => new Date(t).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

// ---------- Rendering ----------
const tx = $('transcript');
let interimEl = null;
function segEl(s) {
  const d = document.createElement('div');
  d.className = 'seg' + (s.kind === 'mine' ? ' mine' : s.kind === 'mark' ? ' mark' : '');
  d.innerHTML = `<time>${clock(s.at)}</time><p></p>`;
  d.querySelector('p').textContent = s.kind === 'mark' ? (s.text || 'Marked as important') : s.text;
  return d;
}
function nearBottom() { return tx.scrollHeight - tx.scrollTop - tx.clientHeight < 80; }
function appendSeg(s) {
  const stick = nearBottom();
  $('empty').hidden = true;
  const prev = cls.segs[cls.segs.length - 2];
  if (prev && s.at - prev.at > 20 * 60000) { const g = document.createElement('div'); g.className = 'gap'; g.textContent = dateStr(s.at); tx.insertBefore(g, interimEl); }
  tx.insertBefore(segEl(s), interimEl);
  if (stick) tx.scrollTop = tx.scrollHeight;
  updateCounts();
}
function renderTranscript() {
  tx.querySelectorAll('.seg, .gap').forEach(n => n.remove());
  interimEl = null;
  $('empty').hidden = cls.segs.length > 0;
  let last = 0;
  const frag = document.createDocumentFragment();
  for (const s of cls.segs) {
    if (last && s.at - last > 20 * 60000) { const g = document.createElement('div'); g.className = 'gap'; g.textContent = dateStr(s.at); frag.appendChild(g); }
    frag.appendChild(segEl(s)); last = s.at;
  }
  tx.appendChild(frag);
  tx.scrollTop = tx.scrollHeight;
  updateCounts();
}
function showInterim(text) {
  if (!text) { interimEl?.remove(); interimEl = null; return; }
  const stick = nearBottom();
  if (!interimEl) {
    interimEl = document.createElement('div'); interimEl.className = 'seg interim';
    interimEl.innerHTML = `<time>${clock(Date.now())}</time><p></p>`;
    tx.appendChild(interimEl);
    $('empty').hidden = true;
  }
  interimEl.querySelector('p').textContent = text;
  if (stick) tx.scrollTop = tx.scrollHeight;
}
function updateCounts() {
  const w = words();
  $('wordCount').textContent = w ? `· ${w.toLocaleString()} words` : '';
  $('btnNotes').disabled = notesBusy || !cls.segs.some(s => s.kind !== 'mark');
  $('btnMark').disabled = !listening;
}
function renderNotes(fresh = false) {
  const n = $('notes');
  if (!cls.notes) {
    n.innerHTML = '<div class="hintbox">Your notes will show up here a few minutes into the class.</div>';
  } else {
    n.innerHTML = `<div class="meta">${escapeHtml(dateStr(cls.updated))}${cls.notesAt ? ' · updated ' + clock(cls.notesAt) : ''}</div>` + md(cls.notes);
  }
  if (notesError) n.insertAdjacentHTML('afterbegin', `<div class="error">${md(notesError)}</div>`);
  if (fresh) { n.classList.remove('fresh'); void n.offsetWidth; n.classList.add('fresh'); }
  $('btnCopy').disabled = $('btnDownload').disabled = !cls.notes && !cls.segs.length;
}
function setNotesState(text, spin = false) {
  $('notesState').innerHTML = text ? (spin ? '<span class="spinner"></span>' : '') + escapeHtml(text) : '';
}
function openClass(c) {
  if (listening) stopListening();
  cls = c;
  $('inTitle').value = cls.title;
  notesError = '';
  renderTranscript();
  renderNotes();
  setNotesState(cls.notes && words() > cls.notedWords ? 'new words since last update' : '');
  try { localStorage.setItem('classNotes.current', cls.id); } catch { /* ignore */ }
}

// ---------- Speech recognition ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false, restartTimer = 0, lastError = '';
let wakeLock = null;
if (!SR) $('supportNote').textContent = 'This browser cannot turn speech into text. Open this page in Chrome or Edge on a computer or Android, or Safari on iPhone/Mac. You can still type notes below.';

function buildRec() {
  const r = new SR();
  r.lang = cfg.lang;
  r.continuous = true;
  r.interimResults = true;
  r.maxAlternatives = 1;
  r.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const text = res[0].transcript.trim();
      if (res.isFinal) {
        if (text) addSeg({ at: Date.now(), text: text[0].toUpperCase() + text.slice(1), kind: 'speech' });
      } else interim += res[0].transcript;
    }
    showInterim(interim.trim());
  };
  r.onerror = e => {
    lastError = e.error;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      stopListening();
      toast('Microphone access was blocked. Allow it in the address bar, then try again.');
    } else if (e.error === 'audio-capture') {
      stopListening();
      toast('No microphone was found.');
    } else if (e.error === 'network') {
      toast('Speech service unreachable. Retrying…');
    } else if (e.error === 'language-not-supported') {
      stopListening();
      toast('That language is not supported here. Pick another in Settings.');
    }
  };
  // Browsers stop recognition after silence or about a minute: restart while we're still listening.
  r.onend = () => {
    showInterim('');
    if (!listening) return;
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => { if (listening) { try { r.start(); } catch { /* already started */ } } }, lastError === 'network' ? 2000 : 150);
    lastError = '';
  };
  return r;
}

function addSeg(s) {
  // Join very short fragments onto the previous line so the transcript reads in sentences.
  const prev = cls.segs[cls.segs.length - 1];
  if (s.kind === 'speech' && prev && prev.kind === 'speech' && s.at - prev.at < 8000 && prev.text.length < 220 && !/[.?!]$/.test(prev.text) && s.text.split(' ').length < 6) {
    prev.text += ' ' + s.text[0].toLowerCase() + s.text.slice(1);
    const last = tx.querySelectorAll('.seg:not(.interim)');
    last[last.length - 1].querySelector('p').textContent = prev.text;
  } else {
    cls.segs.push(s);
    appendSeg(s);
  }
  cls.updated = Date.now();
  if (s.kind !== 'mark' && cls.notes) setNotesState('new words since last update');
  saveClasses();
  updateCounts();
}

async function startListening() {
  if (!SR) { toast('Speech-to-text needs Chrome, Edge or Safari.'); return; }
  rec = buildRec();
  try { rec.start(); } catch { /* already running */ }
  listening = true;
  $('btnListen').classList.add('on');
  $('listenText').textContent = 'Pause';
  startMeter();
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
  if (!cls.segs.length) cls.created = Date.now();
  lastNotesTime = Date.now();
  updateCounts();
  if (!ready()) toast('Listening. Set up Claude in Settings to get notes.');
}
function stopListening() {
  listening = false;
  clearTimeout(restartTimer);
  if (rec) { rec.onend = null; try { rec.stop(); } catch { /* not running */ } rec = null; }
  showInterim('');
  $('btnListen').classList.remove('on');
  $('listenText').textContent = cls?.segs.length ? 'Resume listening' : 'Start listening';
  stopMeter();
  try { wakeLock?.release(); } catch { /* ignore */ }
  wakeLock = null;
  updateCounts();
  saveClasses(true);
  // Catch up the notes with whatever was said since the last update.
  if (cls && ready() && words() - cls.notedWords >= 15) makeNotes();
}
document.addEventListener('visibilitychange', async () => {
  if (listening && document.visibilityState === 'visible' && !wakeLock) { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* ignore */ } }
});

// Microphone level meter (just for feedback that it can hear).
let meterCtx = null, meterStream = null, meterRaf = 0;
async function startMeter() {
  try {
    meterStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    meterCtx = new (window.AudioContext || window.webkitAudioContext)();
    const an = meterCtx.createAnalyser(); an.fftSize = 256;
    meterCtx.createMediaStreamSource(meterStream).connect(an);
    const data = new Uint8Array(an.fftSize);
    const bars = [...$('meter').children];
    $('meter').classList.add('on');
    let lvl = 0;
    const tick = () => {
      an.getByteTimeDomainData(data);
      let sum = 0; for (const v of data) sum += (v - 128) ** 2;
      lvl = Math.max(Math.sqrt(sum / data.length) / 40, lvl * 0.85);
      bars.forEach((b, i) => { b.style.height = Math.max(4, Math.min(18, 4 + lvl * 18 * (1 - Math.abs(i - 2) * 0.22))) + 'px'; });
      meterRaf = requestAnimationFrame(tick);
    };
    tick();
  } catch { /* meter is optional */ }
}
function stopMeter() {
  cancelAnimationFrame(meterRaf);
  meterStream?.getTracks().forEach(t => t.stop()); meterStream = null;
  meterCtx?.close().catch(() => {}); meterCtx = null;
  $('meter').classList.remove('on');
  [...$('meter').children].forEach(b => { b.style.height = ''; });
}

// ---------- Claude ----------
const LOCAL_COPY = location.hostname === 'localhost' && location.port === '8787';
const HELPER = LOCAL_COPY ? '' : 'http://localhost:8787';
let helperOk = false, helperMsg = '';
async function checkHelper() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(HELPER + '/health', { signal: ctrl.signal });
    clearTimeout(t);
    const data = await res.json();
    helperOk = !!(data.ok && data.claude);
    helperMsg = helperOk ? 'Helper is running. Notes use your Claude plan.' : 'Helper is running, but Claude Code is not installed yet (see step 1).';
  } catch {
    helperOk = false;
    helperMsg = 'Cannot reach the helper. Start it (steps below), or use an API key.';
  }
  updateKeyNote();
  return helperOk;
}
function ready() { return cfg.engine === 'pro' ? helperOk : !!cfg.key; }
function updateKeyNote() {
  const s = $('helperState');
  s.textContent = helperMsg || 'Checking for the helper…'; s.className = 'state ' + (helperOk ? 'ok' : 'bad');
  const n = $('keyNote');
  if (ready()) { n.textContent = ''; return; }
  n.innerHTML = 'The transcript works on its own. To get notes, connect Claude. <button type="button" class="primary">Set up</button>';
  n.querySelector('button').onclick = openSettings;
}

let client = null, clientKey = '';
function getClient() {
  if (!client || clientKey !== cfg.key) { client = new Anthropic({ apiKey: cfg.key, dangerouslyAllowBrowser: true }); clientKey = cfg.key; }
  return client;
}

function transcriptText(segs) {
  return segs.map(s => s.kind === 'mark' ? `[${clock(s.at)}] [★ IMPORTANT] ${s.text || '(student marked this moment)'}`
    : s.kind === 'mine' ? `[${clock(s.at)}] [Student's own note] ${s.text}`
    : `[${clock(s.at)}] ${s.text}`).join('\n');
}
function buildPrompt() {
  const full = transcriptText(cls.segs);
  const head = `Class: ${cls.title || '(untitled)'}\nDate: ${dateStr(cls.created)}\n\nFormat: ${STYLE_TEXT[cfg.style] || STYLE_TEXT.outline}\n\n`;
  const LIMIT = 90000;
  if (full.length <= LIMIT || !cls.notes) {
    return head + (cls.notes ? `Your notes so far (keep their structure where it still fits; rewrite them to cover the whole transcript):\n${cls.notes}\n\n` : '') +
      `Transcript so far:\n${full.slice(-LIMIT)}\n\nWrite the complete, updated notes.`;
  }
  // Long class: send the notes so far plus only what's new.
  const since = cls.segs.findIndex(s => s.at > (cls.notesAt || 0));
  const fresh = transcriptText(cls.segs.slice(since < 0 ? cls.segs.length : since)).slice(-LIMIT);
  return head + `Your notes so far:\n${cls.notes}\n\nNew transcript since those notes:\n${fresh}\n\nWrite the complete, updated notes: keep everything already in them and add the new material.`;
}

let notesBusy = false, notesError = '', notesJob = null, lastNotesTime = Date.now();
async function makeNotes() {
  if (notesBusy || !cls.segs.length) return;
  if (cfg.engine === 'pro' && !helperOk) await checkHelper();
  if (!ready()) { openSettings(); return; }
  const target = cls;
  const wordsAt = words(target);
  const segsAt = target.segs.length;
  notesBusy = true; notesError = ''; lastNotesTime = Date.now();
  updateCounts();
  setNotesState('writing notes…', true);
  const prompt = buildPrompt();
  try {
    let text = '';
    if (cfg.engine === 'pro') text = await notesPro(prompt);
    else text = await notesApi(prompt, partial => { if (cls === target) { $('notes').innerHTML = md(partial); } });
    if (!text.trim()) throw new Error('No notes came back.');
    target.notes = text.trim();
    target.notedWords = wordsAt;
    target.notesAt = target.segs[segsAt - 1]?.at || Date.now();
    target.updated = Date.now();
    saveClasses(true);
    if (cls === target) { renderNotes(true); setNotesState(words() > wordsAt ? 'new words since last update' : 'up to date'); }
  } catch (err) {
    if (err?.name === 'AbortError' || err instanceof Anthropic.APIUserAbortError) { setNotesState(''); return; }
    notesError = errorText(err);
    if (cls === target) { renderNotes(); setNotesState('could not update'); }
  } finally {
    notesBusy = false; notesJob = null;
    updateCounts();
  }
}
async function notesPro(prompt) {
  const ctrl = new AbortController();
  notesJob = () => ctrl.abort();
  let res;
  try {
    res = await fetch(HELPER + '/ask', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctrl.signal,
      body: JSON.stringify({ model: cfg.model, system: SYSTEM, image: null, text: prompt, context: null }),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    helperOk = false; updateKeyNote();
    throw new Error('HELPER_DOWN');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.text) throw new Error(data.error || `The helper answered with status ${res.status}.`);
  return data.text;
}
async function notesApi(prompt, onText) {
  const params = {
    model: cfg.model, max_tokens: 8000, system: SYSTEM,
    output_config: { effort: 'low' },
    messages: [{ role: 'user', content: prompt }],
  };
  if (cfg.model !== 'claude-haiku-5-5') { params.betas = ['server-side-fallback-2026-07-01']; params.fallbacks = 'default'; }
  const s = getClient().beta.messages.stream(params);
  notesJob = () => s.abort();
  let text = '';
  s.on('text', d => { text += d; onText(text); });
  const final = await s.finalMessage();
  if (final.stop_reason === 'refusal') throw new Error('Claude declined to write notes for this transcript.');
  return text;
}
function errorText(err) {
  if (err?.message === 'HELPER_DOWN') return '**The helper is not running.** Start it on this computer, or switch to an API key in Settings. Your transcript is safe.';
  if (err instanceof Anthropic.AuthenticationError) return '**Your API key was not accepted.** Check it in Settings.';
  if (err instanceof Anthropic.PermissionDeniedError) return '**This key cannot use that model.** Try another model in Settings.';
  if (err instanceof Anthropic.RateLimitError) return '**Too many requests right now.** The notes will try again on the next update.';
  if (err instanceof Anthropic.APIConnectionError) return '**Could not reach Claude.** Check your internet connection. Your transcript is safe.';
  if (err instanceof Anthropic.APIError) return `**Claude had a problem (${err.status ?? 'error'}).** It will try again on the next update.`;
  return `**Notes could not be updated:** ${err?.message || err}`;
}

// Auto-update the notes while listening.
setInterval(() => {
  if (!listening || notesBusy || !ready()) return;
  const newWords = words() - cls.notedWords;
  if (Date.now() - lastNotesTime >= cfg.interval * 60000 && newWords >= 40) makeNotes();
}, 10000);

// ---------- Export ----------
function exportText(withTranscript) {
  const title = cls.title || 'Class notes';
  let s = cls.notes ? cls.notes : `# ${title}\n\n_No notes yet._`;
  if (!/^#\s/.test(s)) s = `# ${title}\n\n${s}`;
  s = s.replace(/^(# .*)$/m, `$1\n\n*${dateStr(cls.created)}*`);
  if (withTranscript && cls.segs.length) s += `\n\n---\n\n## Transcript\n\n` + cls.segs.map(x => `**${clock(x.at)}** ${x.kind === 'mark' ? '★ ' : x.kind === 'mine' ? '(my note) ' : ''}${x.text}`).join('\n\n');
  return s;
}
$('btnCopy').onclick = async () => {
  try { await navigator.clipboard.writeText(exportText(false)); toast('Notes copied'); } catch { toast('Could not copy'); }
};
$('btnDownload').onclick = () => {
  const blob = new Blob([exportText(true)], { type: 'text/markdown' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const d = new Date(cls.created);
  a.download = `${(cls.title || 'class-notes').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'class-notes'}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.md`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Downloaded notes and transcript');
};

// ---------- Classes dialog ----------
function renderClassList() {
  const list = $('classList');
  list.innerHTML = '';
  const shown = classes.filter(c => c.segs.length || c.notes || c.title || c === cls);
  if (!shown.length) { list.innerHTML = '<div class="none">No saved classes yet.</div>'; return; }
  for (const c of shown) {
    const row = document.createElement('div');
    row.className = 'cls' + (c === cls ? ' cur' : '');
    row.innerHTML = `<div><b></b><small></small></div><button type="button" title="Delete this class">Delete</button>`;
    row.querySelector('b').textContent = c.title || 'Untitled class';
    row.querySelector('small').textContent = `${dateStr(c.created)} · ${words(c).toLocaleString()} words${c.notes ? ' · notes' : ''}`;
    row.onclick = () => { if (c !== cls) openClass(c); $('dlgClasses').close(); };
    row.querySelector('button').onclick = e => {
      e.stopPropagation();
      if (!confirm(`Delete "${c.title || 'Untitled class'}"? Its transcript and notes cannot be recovered.`)) return;
      classes = classes.filter(x => x !== c);
      if (c === cls) openClass(classes[0] || newClass());
      saveClasses(true);
      renderClassList();
    };
    list.appendChild(row);
  }
}
function openClasses() { renderClassList(); if (!$('dlgClasses').open) $('dlgClasses').showModal(); }
$('btnNew').onclick = () => {
  const blank = classes.find(c => !c.segs.length && !c.notes);
  openClass(blank || newClass());
  saveClasses(true);
  $('dlgClasses').close();
  $('inTitle').focus();
};

// ---------- Settings dialog ----------
let helperPoll = 0;
function showEngine() { const pro = $('selEngine').value === 'pro'; $('proBox').hidden = !pro; $('apiBox').hidden = pro; }
function openSettings() {
  $('selLang').value = cfg.lang;
  $('selEngine').value = cfg.engine; showEngine();
  checkHelper();
  clearInterval(helperPoll);
  helperPoll = setInterval(() => { if ($('selEngine').value === 'pro') checkHelper(); }, 2500);
  $('inKey').value = cfg.key;
  $('selModel').value = cfg.model;
  $('selStyle').value = cfg.style;
  $('rngInterval').value = cfg.interval;
  $('outInterval').textContent = cfg.interval + ' min';
  if (!$('dlgSettings').open) $('dlgSettings').showModal();
}
$('rngInterval').addEventListener('input', e => { $('outInterval').textContent = e.target.value + ' min'; });
$('selEngine').addEventListener('change', showEngine);
$('btnCopyCmd').onclick = async () => {
  try { await navigator.clipboard.writeText($('helperCmd').textContent); $('btnCopyCmd').textContent = 'Copied'; }
  catch { $('btnCopyCmd').textContent = 'Select and copy it'; }
  setTimeout(() => { $('btnCopyCmd').textContent = 'Copy'; }, 1500);
};
$('dlgSettings').addEventListener('close', () => {
  clearInterval(helperPoll);
  const langChanged = cfg.lang !== $('selLang').value;
  const styleChanged = cfg.style !== $('selStyle').value;
  cfg.lang = $('selLang').value;
  cfg.engine = $('selEngine').value;
  cfg.key = $('inKey').value.trim();
  cfg.model = $('selModel').value;
  cfg.style = $('selStyle').value;
  cfg.interval = +$('rngInterval').value;
  saveCfg();
  updateKeyNote();
  if (langChanged && listening) { stopListening(); startListening(); }
  if (styleChanged && cls.notes && ready()) { cls.notes = ''; cls.notedWords = 0; makeNotes(); }
});

// ---------- Buttons & keys ----------
$('btnListen').onclick = () => (listening ? stopListening() : startListening());
$('btnMark').onclick = () => {
  if (!listening) return;
  addSeg({ at: Date.now(), text: '', kind: 'mark' });
  toast('★ Marked as important');
};
$('btnNotes').onclick = () => makeNotes();
$('btnClasses').onclick = openClasses;
$('btnSettings').onclick = openSettings;
$('inTitle').addEventListener('input', e => { cls.title = e.target.value.trim(); cls.updated = Date.now(); saveClasses(); });
$('inTitle').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('addForm').addEventListener('submit', e => {
  e.preventDefault();
  const t = $('addInput').value.trim();
  if (!t) return;
  $('addInput').value = '';
  addSeg({ at: Date.now(), text: t, kind: 'mine' });
});
window.addEventListener('keydown', e => {
  if (e.target.closest('input, select, textarea, dialog') || e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.toLowerCase();
  if (e.key === ' ') { e.preventDefault(); $('btnListen').click(); }
  else if (k === 'm') $('btnMark').click();
  else if (k === 'n' && !$('btnNotes').disabled) makeNotes();
  else if (k === 'c') openClasses();
  else if (k === 's') openSettings();
});
window.addEventListener('beforeunload', e => { saveClasses(true); if (listening) { e.preventDefault(); e.returnValue = ''; } });

// ---------- Start ----------
let curId = null;
try { curId = localStorage.getItem('classNotes.current'); } catch { /* ignore */ }
openClass(classes.find(c => c.id === curId) || classes[0] || newClass());
updateKeyNote();
if (cfg.engine === 'pro') checkHelper();
