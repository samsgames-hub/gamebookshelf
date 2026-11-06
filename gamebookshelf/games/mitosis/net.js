/* MITOSIS online arenas.
   Rooms live in Firebase Realtime Database (Google servers on the normal HTTPS port, so they work on school networks).
   One player's browser is the host: it runs the arena (cells, bots, pellets, viruses) and streams each player only what they can see.
   If the host leaves, the next player in the room takes over and everyone carries on with their mass.
   Layout under nr/<CODE>/  (CODE is 4 letters with no I or O, shared with Neon Rift rooms, told apart by m.g):
     m          room info {g:'mx', h: host id, t: created, n: player cap, pub, seed}
     p/<id>     players {n: name, s: skin, j: join time}
     i/<id>     each player's input, a short string, written ~15 times a second
     v/<id>     what the host sends each player, a short string, ~8 times a second
     r          roster: owner number -> name, skin, player id
     pf         every pellet's generation, so a joining player can draw the pellet field
   nr/BLOB/<CODE> lists public arenas for quick play (BLOB has an O, so no room can ever get that code).
   ?net=local swaps Firebase for a BroadcastChannel between tabs of one browser (used for offline testing). */
(function () {
  const CFG = {
    apiKey: 'AIzaSyAorALlmWcgCLaS9cIR_9BEUPKXcmKECoY', authDomain: 'gamebookshelf-9984c.firebaseapp.com', projectId: 'gamebookshelf-9984c',
    databaseURL: 'https://gamebookshelf-9984c-default-rtdb.firebaseio.com', appId: '1:373968261700:web:c41f30d9f3ef1f50dde211'
  };
  const CAP = 10, LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ', LIST = 'nr/BLOB';
  const rid = n => { let s = ''; const a = new Uint8Array(n); crypto.getRandomValues(a); for (let i = 0; i < n; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[a[i] % 36]; return s; };
  const local = /[?&]net=local/.test(location.search);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  function rtdb() {
    const app = firebase.apps.find(a => a.name === 'mx') || firebase.initializeApp(CFG, 'mx'), db = app.database();
    const R = p => db.ref(p);
    return {
      put: (p, v) => R(p).set(v === undefined ? null : v),
      update: (p, v) => R(p).update(v),
      remove: p => R(p).remove(),
      get: p => R(p).once('value').then(s => s.val()),
      watch(p, cb) { const r = R(p), f = s => cb(s.val()); r.on('value', f); return () => r.off('value', f); },
      onDc: p => R(p).onDisconnect().remove(),
      cancelDc: p => R(p).onDisconnect().cancel(),
      claim: (p, v) => R(p).transaction(c => (c ? undefined : v)).then(r => r.committed),
      connected(cb) { const r = db.ref('.info/connected'), f = s => cb(!!s.val()); r.on('value', f); },
      offset(cb) { db.ref('.info/serverTimeOffset').on('value', s => cb(s.val() || 0)); }
    };
  }
  function bc() {
    const ch = new BroadcastChannel('mx-local'), tree = {}, W = [], dc = new Set();
    const get = p => p.split('/').reduce((o, k) => o == null ? undefined : o[k], tree);
    const clone = v => v === undefined ? null : JSON.parse(JSON.stringify(v));
    const set = (p, v) => { const ks = p.split('/'); let o = tree; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; } if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = clone(v); };
    const fire = ps => { for (const w of W) if (ps.some(p => p === w.p || p.startsWith(w.p + '/') || w.p.startsWith(p + '/'))) w.cb(clone(get(w.p))); };
    const apply = m => {
      if (m.op === 'put') { set(m.p, m.v); fire([m.p]); }
      else if (m.op === 'upd') { const ps = []; for (const k in m.v) { set(m.p + '/' + k, m.v[k]); ps.push(m.p + '/' + k); } fire(ps); }
      else if (m.op === 'tree') { for (const k in m.t) tree[k] = m.t[k]; for (const w of W) w.cb(clone(get(w.p))); }
      else if (m.op === 'hello') ch.postMessage({ op: 'tree', t: tree });
    };
    ch.onmessage = e => apply(e.data);
    ch.postMessage({ op: 'hello' });
    addEventListener('pagehide', () => { for (const p of dc) ch.postMessage({ op: 'put', p, v: null }); });
    const send = m => { apply(m); ch.postMessage(m); };
    return {
      put: (p, v) => (send({ op: 'put', p, v: v === undefined ? null : v }), Promise.resolve()),
      update: (p, v) => (send({ op: 'upd', p, v }), Promise.resolve()),
      remove: p => (send({ op: 'put', p, v: null }), Promise.resolve()),
      get: p => new Promise(r => setTimeout(() => r(clone(get(p))), 60)),
      watch(p, cb) { const w = { p, cb }; W.push(w); setTimeout(() => cb(clone(get(p))), 0); return () => { const i = W.indexOf(w); if (i >= 0) W.splice(i, 1); }; },
      onDc: p => { dc.add(p); return Promise.resolve(); },
      cancelDc: p => { dc.delete(p); return Promise.resolve(); },
      claim: (p, v) => new Promise(r => setTimeout(() => { if (get(p)) return r(false); send({ op: 'put', p, v }); r(true); }, 30 + Math.random() * 60)),
      connected(cb) { cb(true); },
      offset(cb) { cb(0); },
      _drop() { for (const p of dc) ch.postMessage({ op: 'put', p, v: null }); } // test hook: act like this tab lost its connection
    };
  }

  let B = null, unsub = [], online = true;
  const N = {
    on: false, code: '', me: '', host: '', isHost: false, pub: false, name: '', skin: 0, players: {}, err: '', local, leaving: false,
    handlers: {}, cap: CAP, offset: 0,
    listen(t, f) { (this.handlers[t] = this.handlers[t] || []).push(f); },
    emit(t, ...a) { (this.handlers[t] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); },
    uid() { if (this._uid) return this._uid; let v; try { v = localStorage.getItem('mx-uid'); } catch (e) { } if (!v || local) { v = 'p' + rid(10); try { if (!local) localStorage.setItem('mx-uid', v); } catch (e) { } } this._uid = v; return v; },
    async init() {
      if (B) return true;
      try {
        if (local) B = bc();
        else {
          if (!window.firebase || !firebase.database) throw new Error('sdk');
          B = rtdb();
          await Promise.race([B.get('nr/PING'), new Promise((_, j) => setTimeout(() => j(new Error('timeout')), 8000))]);
          B.connected(c => { if (online !== c) { online = c; N.emit('conn', c); } });
          B.offset(o => { N.offset = o; });
        }
        return true;
      } catch (e) { B = null; this.err = 'The online arena server can’t be reached right now.'; return false; }
    },
    now() { return Date.now() + this.offset; },
    path(s) { return 'nr/' + this.code + (s ? '/' + s : ''); },
    // Join a public arena with space, or open a new one if none are free.
    async quick(name, skin, carry) {
      if (!await this.init()) return false;
      try {
        const list = await B.get(LIST) || {}, t = this.now();
        const rooms = Object.entries(list).filter(([c, r]) => r && t - (r.t || 0) < 75000 && (r.n || 0) < (r.cap || CAP) && c !== this._avoid)
          .sort((a, b) => (b[1].n || 0) - (a[1].n || 0));
        for (const [code] of rooms) if (await this.join(code, name, skin, carry, true)) return true;
      } catch (e) { }
      this.err = '';
      return this.create(name, skin, true, carry);
    },
    async create(name, skin, pub, carry, code) {
      if (!await this.init()) return false;
      this.me = this.uid(); this.name = name; this.skin = skin;
      if (!code) for (let i = 0; i < 10; i++) {
        code = Array.from({ length: 4 }, () => LETTERS[Math.random() * LETTERS.length | 0]).join('');
        const m = await B.get('nr/' + code + '/m'); if (!m || this.now() - (m.t || 0) > 6 * 3600e3) break;
      }
      const meta = { g: 'mx', h: this.me, t: this.now(), n: CAP, pub: !!pub, seed: (Math.random() * 2147483647) | 0 };
      this.code = code;
      if (!await B.claim(this.path('m'), meta)) return false; // someone else got there first
      this.host = this.me; this.isHost = true; this.pub = !!pub; this.meta = meta;
      await B.onDc(this.path());
      if (this.pub) { await B.put(LIST + '/' + code, { h: name, n: 1, cap: CAP, t: this.now() }); await B.onDc(LIST + '/' + code); }
      clearInterval(this.hb); this.hb = setInterval(() => { if (this.on && this.isHost && this.pub) B.update(LIST + '/' + this.code, { t: this.now(), n: Object.keys(this.players).length || 1 }); }, 20000);
      await this._enter(carry);
      return true;
    },
    async join(code, name, skin, carry, quiet) {
      if (!await this.init()) return false;
      code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (code.length !== 4) { this.err = 'Enter the 4-letter code.'; return false; }
      const m = await B.get('nr/' + code + '/m');
      if (!m || m.g !== 'mx') { if (!quiet) this.err = 'No arena with that code.'; return false; }
      const ps = await B.get('nr/' + code + '/p') || {};
      if (Object.keys(ps).length >= (m.n || CAP)) { if (!quiet) this.err = 'That arena is full (' + CAP + ' players).'; return false; }
      this.me = this.uid(); this.name = name; this.skin = skin; this.code = code; this.host = m.h; this.isHost = false; this.pub = !!m.pub; this.meta = m;
      await B.onDc(this.path('p/' + this.me)); await B.onDc(this.path('i/' + this.me)); await B.onDc(this.path('v/' + this.me));
      await this._enter(carry);
      return true;
    },
    async _enter(carry) {
      this.on = true; this.leaving = false; this.players = {};
      await B.put(this.path('p/' + this.me), { n: this.name, s: this.skin, j: this.now(), c: carry || 0 });
      unsub.push(B.watch(this.path('p'), v => { const old = this.players; this.players = v || {}; if (this.players[this.me]) this.lastPlayers = this.players; this.emit('players', this.players, old); if (this.isHost && this.pub) B.update(LIST + '/' + this.code, { n: Object.keys(this.players).length, t: this.now() }); }));
      unsub.push(B.watch(this.path('m'), v => { if (!this.on) return; if (!v) { if (!this.isHost) this._hostLost(); return; } this.meta = v; if (v.h !== this.me && this.isHost) { this.isHost = false; this.host = v.h; } }));
      if (this.isHost) unsub.push(B.watch(this.path('i'), v => this.emit('inputs', v || {})));
      else {
        unsub.push(B.watch(this.path('v/' + this.me), v => { if (v) this.emit('view', v); }));
        unsub.push(B.watch(this.path('r'), v => this.emit('roster', v || {})));
      }
      this.emit('entered', this.isHost);
    },
    // The host is gone. The longest-standing player takes over the arena; everyone else rejoins it.
    async _hostLost() {
      if (this.migrating) return; this.migrating = true;
      const code = this.code, old = this.host, ps = Object.entries(this.lastPlayers || {}).filter(([id]) => id !== old).sort((a, b) => (a[1].j || 0) - (b[1].j || 0));
      this._stop();
      this.emit('migrating');
      const carry = this.carry ? this.carry() : 0;
      const next = ps.length ? ps[0][0] : this.me;
      let ok = false;
      if (next === this.me) ok = await this.create(this.name, this.skin, this.pub, carry, code);
      for (let t = 0; !ok && t < 16; t++) { await wait(500); ok = await this.join(code, this.name, this.skin, carry, true); if (!ok && t === 7) ok = await this.create(this.name, this.skin, this.pub, carry, code); }
      if (!ok) { this._avoid = code; ok = await this.quick(this.name, this.skin, carry); }
      this.migrating = false;
      this.emit('migrated', ok, this.isHost);
    },
    _stop() { this.on = false; unsub.forEach(f => { try { f(); } catch (e) { } }); unsub = []; },
    // host
    setRoster(r) { if (this.on && this.isHost) B.put(this.path('r'), r); },
    putPellets(s) { if (this.on && this.isHost) B.put(this.path('pf'), s); },
    sendViews(map) { if (this.on && this.isHost) { const u = {}; for (const k in map) u['v/' + k] = map[k]; B.update(this.path(), u); } },
    kickGhost(id) { if (this.isHost) { B.remove(this.path('p/' + id)); B.remove(this.path('i/' + id)); B.remove(this.path('v/' + id)); } },
    // client
    input(s) { if (this.on && !this.isHost) B.put(this.path('i/' + this.me), s); },
    getPellets() { return this.on ? B.get(this.path('pf')) : Promise.resolve(null); },
    setSkin(name, skin) { this.name = name; this.skin = skin; if (this.on) B.update(this.path('p/' + this.me), { n: name, s: skin }); },
    count() { return Object.keys(this.players).length || 1; },
    leave() {
      const was = this.on; this._stop(); clearInterval(this.hb);
      if (B && was) {
        if (this.isHost) { if (this.pub) { B.remove(LIST + '/' + this.code); B.cancelDc(LIST + '/' + this.code); } B.remove(this.path()); B.cancelDc(this.path()); }
        else { B.remove(this.path('p/' + this.me)); B.remove(this.path('i/' + this.me)); B.remove(this.path('v/' + this.me)); }
      }
      this.code = ''; this.players = {}; this.isHost = false; this.pub = false;
    },
    invite() { return location.origin + location.pathname + '?room=' + this.code + (local ? '&net=local' : ''); },
    _test() { return B; }
  };
  window.MXNet = N;
})();
