/* Game Bookshelf weekly tournaments (shared by Skyline, Slingshot, Mitosis and the /tournament/ page).
   One course per game per week (same seed for everyone). Play as often as you like; your best score counts.
   Weeks start Monday 00:00 UTC. Scores live in Firebase Realtime Database under nr/<CODE>/s/<player id>,
   where CODE = 'O' + game letter + two letters for the week. Room codes never contain an O, so these can't clash with rooms.
   Prizes for a finished week are paid into 'gbs-bank' (collected by each game when it opens).
   ?net=local keeps everything in this browser (for offline testing). */
(function () {
  'use strict';
  const CFG = { apiKey: 'AIzaSyAorALlmWcgCLaS9cIR_9BEUPKXcmKECoY', authDomain: 'gamebookshelf-9984c.firebaseapp.com', projectId: 'gamebookshelf-9984c', databaseURL: 'https://gamebookshelf-9984c-default-rtdb.firebaseio.com', appId: '1:373968261700:web:c41f30d9f3ef1f50dde211' };
  const EPOCH = Date.UTC(2026, 10, 9), WEEK_MS = 7 * 864e5, KEEP = 200;
  const GAMES = {
    skyline: { k: 'S', n: 'Skyline', unit: 'floors', url: '/games/skyline/index.html?tour=1', img: '/assets/skyline-tile.webp' },
    slingshot: { k: 'L', n: 'Slingshot', unit: 'planets', url: '/games/slingshot/index.html?tour=1', img: '/assets/slingshot-tile.webp' },
    mitosis: { k: 'M', n: 'Mitosis', unit: 'mass', url: '/games/mitosis/index.html?tour=1', img: '/assets/mitosis-tile.jpg' }
  };
  /* prize for a final rank (1-based); everyone who entered gets something */
  function prize(rank, entrants) {
    if (!rank) return null;
    if (rank === 1) return { t: 'Champion', coins: 400, stars: 100, gold: 8, keys: 3 };
    if (rank <= 3) return { t: 'Podium', coins: 250, stars: 60, gold: 5, keys: 2 };
    if (rank <= 10) return { t: 'Top 10', coins: 120, stars: 30, gold: 3, keys: 1 };
    if (rank <= Math.max(10, Math.ceil(entrants * .25))) return { t: 'Top 25%', coins: 70, stars: 18, gold: 2, keys: 0 };
    return { t: 'Took part', coins: 40, stars: 10, gold: 1, keys: 0 };
  }
  const week = (t) => Math.floor(((t || Date.now()) - EPOCH) / WEEK_MS) + 1;
  const weekEnd = (w) => EPOCH + w * WEEK_MS;
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const code = (g, w) => 'O' + GAMES[g].k + L[Math.floor(w / L.length) % L.length] + L[w % L.length];
  const local = /[?&]net=local/.test(location.search);
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  function uid() { let u = read('gbs-uid', ''); if (!u) { const a = new Uint8Array(10); crypto.getRandomValues(a); u = Array.from(a, x => 'abcdefghijklmnopqrstuvwxyz0123456789'[x % 36]).join(''); write('gbs-uid', u); } return u; }
  function name() { let n = read('gbs-name', ''); if (!n) { n = 'Player ' + uid().slice(0, 4).toUpperCase(); } return n; }
  function setName(n) { n = String(n || '').replace(/[^\w .'\-]/g, '').trim().slice(0, 16); if (n) write('gbs-name', n); return name(); }

  /* ---- database: Firebase (loaded on demand) or a local stand-in ---- */
  let dbp = null;
  function load(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function db() {
    if (dbp) return dbp;
    dbp = (async () => {
      if (local) return {
        get: async p => read('tourdb:' + p, null), put: async (p, v) => { const parts = p.split('/'), key = parts.pop(), par = parts.join('/'), o = read('tourdb:' + par, {}) || {}; if (v === null) delete o[key]; else o[key] = v; write('tourdb:' + par, o); }
      };
      if (!window.firebase || !firebase.database) {
        await load('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
        await load('https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js');
      }
      const app = firebase.apps.find(a => a.name === 'tour') || firebase.initializeApp(CFG, 'tour'), d = app.database();
      return { get: async p => (await d.ref(p).get()).val(), put: async (p, v) => d.ref(p).set(v) };
    })().catch(e => { dbp = null; throw e; });
    return dbp;
  }
  const timeout = (p, ms) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

  async function board(g, w) {
    w = w || week(); const D = await timeout(db(), 12000), all = await timeout(D.get('nr/' + code(g, w) + '/s'), 12000) || {};
    return Object.entries(all).map(([id, v]) => ({ id, n: String(v.n || 'Player').slice(0, 16), s: +v.s || 0, t: +v.t || 0 })).sort((a, b) => b.s - a.s || a.t - b.t);
  }
  /* save this week's best score; returns {best, rank, of, improved} */
  async function submit(g, score) {
    score = Math.max(0, Math.round(+score || 0)); const w = week(), me = uid(), mine = read('gbs-tour', {});
    const key = g + w; mine.best = mine.best || {}; const prev = mine.best[key] || 0, improved = score > prev;
    if (improved) { mine.best[key] = score; write('gbs-tour', mine); }
    try {
      const list = await board(g, w), cur = list.find(e => e.id === me);
      if (!cur || score > cur.s || cur.n !== name()) {
        const s = Math.max(score, cur ? cur.s : 0);
        await timeout((await db()).put('nr/' + code(g, w) + '/s/' + me, { n: name(), s, t: Date.now() }), 12000);
        const i = list.findIndex(e => e.id === me); if (i >= 0) list.splice(i, 1); list.push({ id: me, n: name(), s, t: Date.now() }); list.sort((a, b) => b.s - a.s || a.t - b.t);
        if (list.length > KEEP) for (const e of list.slice(KEEP)) if (e.id !== me) (await db()).put('nr/' + code(g, w) + '/s/' + e.id, null);
      }
      const rank = list.findIndex(e => e.id === me) + 1;
      return { best: Math.max(score, prev, cur ? cur.s : 0), rank, of: list.length, improved, online: true };
    } catch (e) { return { best: Math.max(score, prev), rank: 0, of: 0, improved, online: false }; }
  }
  /* pay prizes for finished weeks you entered (once each) */
  async function claimPrizes() {
    const mine = read('gbs-tour', {}), paid = mine.paid || {}, w = week(), out = [];
    for (const g of Object.keys(GAMES)) for (let pw = Math.max(1, w - 3); pw < w; pw++) {
      const key = g + pw; if (paid[key] || !(mine.best && mine.best[key])) continue;
      try {
        const list = await board(g, pw), rank = list.findIndex(e => e.id === uid()) + 1, p = prize(rank || list.length + 1, list.length);
        paid[key] = { rank, of: list.length, p };
        if (p) { const b = read('gbs-bank', {}); const add = (gg, k, n) => { if (!n) return; b[gg] = b[gg] || {}; b[gg][k] = (b[gg][k] || 0) + n; b[gg].from = 'Weekly tournament'; };
          add('skyline', 'coins', p.coins); add('slingshot', 'stars', p.stars); add('gwf', 'gold', p.gold); add('gwf', 'keys', p.keys); write('gbs-bank', b); }
        out.push({ g, w: pw, rank, of: list.length, p });
      } catch (e) { }
    }
    mine.paid = paid; write('gbs-tour', mine); return out;
  }
  function myBest(g, w) { const m = read('gbs-tour', {}); return (m.best && m.best[g + (w || week())]) || 0; }
  /* a seeded random-number generator for this week's course */
  function seed(g) { let h = 2166136261; const t = 'tour-' + g + '-' + week(); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(g) { let a = seed(g); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function left() { const ms = weekEnd(week()) - Date.now(), d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60; return d > 0 ? d + 'd ' + h + 'h' : h + 'h ' + m + 'm'; }
  window.GBTour = { GAMES, week, weekEnd, code, uid, name, setName, board, submit, claimPrizes, myBest, seed, rng, prize, left, local };
})();
