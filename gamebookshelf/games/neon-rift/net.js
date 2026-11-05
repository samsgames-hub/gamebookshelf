/* NEON RIFT online co-op rooms.
   Rooms live in Firebase Realtime Database (Google servers on the normal HTTPS port, so it works on school networks).
   The room creator is the host: it runs the enemies and the waves and streams them to everyone else.
   Layout under nr/<CODE>/:
     m          room info {h: host id, t: created, st: 'lobby' | 'play', n: player cap}
     p/<id>     players {n: name, j: join time}
     s/<id>     each player's live state (position, aim, weapon, health)
     h          host snapshot of the world (enemies, wave, boss)
     e          host events, batched (kills, waves, enemy shots, room changes)
     c          player events for the host, batched (hits, ready)
   ?net=local swaps Firebase for a BroadcastChannel between tabs of one browser (used for offline testing). */
(function () {
  const CFG = {
    apiKey: 'AIzaSyAorALlmWcgCLaS9cIR_9BEUPKXcmKECoY', authDomain: 'gamebookshelf-9984c.firebaseapp.com', projectId: 'gamebookshelf-9984c',
    databaseURL: 'https://gamebookshelf-9984c-default-rtdb.firebaseio.com', appId: '1:373968261700:web:c41f30d9f3ef1f50dde211'
  };
  const MAXP = 4, LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const rid = n => { let s = ''; const a = new Uint8Array(n); crypto.getRandomValues(a); for (let i = 0; i < n; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[a[i] % 36]; return s; };
  const local = /[?&]net=local/.test(location.search);

  // ---------------- backend: Firebase RTDB or a local BroadcastChannel stand-in ----------------
  function rtdb() {
    const app = firebase.apps.find(a => a.name === 'nr') || firebase.initializeApp(CFG, 'nr'), db = app.database();
    const R = p => db.ref(p);
    return {
      put: (p, v) => R(p).set(v === undefined ? null : v),
      update: (p, v) => R(p).update(v),
      push: (p, v) => R(p).push(v).key,
      remove: p => R(p).remove(),
      get: p => R(p).once('value').then(s => s.val()),
      watch(p, cb) { const r = R(p), f = s => cb(s.val()); r.on('value', f); return () => r.off('value', f); },
      added(p, cb) { const start = R(p).push().key, q = R(p).orderByKey().startAt(start), f = s => cb(s.key, s.val()); q.on('child_added', f); return () => q.off('child_added', f); },
      removeKey: (p, k) => R(p + '/' + k).remove(),
      onDc: p => R(p).onDisconnect().remove(),
      cancelDc: p => R(p).onDisconnect().cancel(),
      connected(cb) { const r = db.ref('.info/connected'), f = s => cb(!!s.val()); r.on('value', f); }
    };
  }
  function bc() {
    const ch = new BroadcastChannel('nr-local'), tree = {}, W = [], A = [], dc = new Set();
    const get = p => p.split('/').reduce((o, k) => o == null ? undefined : o[k], tree);
    const set = (p, v) => { const ks = p.split('/'); let o = tree; for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; } if (v == null) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v)); };
    const fire = (p, isNew) => { for (const w of W) if (p === w.p || p.startsWith(w.p + '/') || w.p.startsWith(p + '/')) w.cb(get(w.p) === undefined ? null : JSON.parse(JSON.stringify(get(w.p)))); if (isNew) for (const a of A) { const par = p.slice(0, p.lastIndexOf('/')); if (par === a.p) a.cb(p.slice(par.length + 1), get(p)); } };
    const apply = (m) => { if (m.op === 'put') { set(m.p, m.v); fire(m.p, false); } else if (m.op === 'push') { set(m.p, m.v); fire(m.p, true); } else if (m.op === 'upd') { for (const k in m.v) set(m.p + '/' + k, m.v[k]); fire(m.p, false); } else if (m.op === 'tree') { Object.assign(tree, m.t); for (const w of W) { const v = get(w.p); w.cb(v === undefined ? null : JSON.parse(JSON.stringify(v))); } } else if (m.op === 'hello') ch.postMessage({ op: 'tree', t: tree }); };
    ch.onmessage = e => apply(e.data);
    ch.postMessage({ op: 'hello' });
    addEventListener('pagehide', () => { for (const p of dc) ch.postMessage({ op: 'put', p, v: null }); });
    let seq = 0;
    const send = m => { apply(m); ch.postMessage(m); };
    return {
      put: (p, v) => (send({ op: 'put', p, v: v === undefined ? null : v }), Promise.resolve()),
      update: (p, v) => (send({ op: 'upd', p, v }), Promise.resolve()),
      push: (p, v) => { const k = Date.now().toString(36).padStart(9, '0') + (seq++).toString(36).padStart(4, '0') + rid(3); send({ op: 'push', p: p + '/' + k, v }); return k; },
      remove: p => (send({ op: 'put', p, v: null }), Promise.resolve()),
      get: p => new Promise(r => setTimeout(() => { const v = get(p); r(v === undefined ? null : JSON.parse(JSON.stringify(v))); }, 150)),
      watch(p, cb) { const w = { p, cb }; W.push(w); const v = get(p); setTimeout(() => cb(v === undefined ? null : v), 0); return () => W.splice(W.indexOf(w), 1); },
      added(p, cb) { const a = { p, cb }; A.push(a); return () => A.splice(A.indexOf(a), 1); },
      removeKey: (p, k) => (send({ op: 'put', p: p + '/' + k, v: null }), Promise.resolve()),
      onDc: p => { dc.add(p); return Promise.resolve(); },
      cancelDc: p => { dc.delete(p); return Promise.resolve(); },
      connected(cb) { cb(true); }
    };
  }

  // ---------------- room logic ----------------
  let B = null, unsub = [], evQ = [], cevQ = [], flushT = 0, myEvKeys = [], online = true;
  const N = {
    on: false, code: '', me: '', host: '', isHost: false, name: '', players: {}, states: {}, started: false, err: '',
    handlers: {},
    listen(t, f) { (this.handlers[t] = this.handlers[t] || []).push(f); },
    emit(t, ...a) { (this.handlers[t] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); },
    uid() { if (this._uid) return this._uid; let v; try { v = localStorage.getItem('nr-uid'); } catch (e) { } if (!v || local) { v = 'p' + rid(10); try { if (!local) localStorage.setItem('nr-uid', v); } catch (e) { } } this._uid = v; return v; },
    async init() {
      if (B) return true;
      try {
        if (local) B = bc();
        else {
          if (!window.firebase || !firebase.database) throw new Error('sdk');
          B = rtdb();
          await Promise.race([B.get('nr/PING'), new Promise((_, j) => setTimeout(() => j(new Error('timeout')), 8000))]);
          B.connected(c => { if (online !== c) { online = c; N.emit('conn', c); } });
        }
        return true;
      } catch (e) { B = null; this.err = 'The online room server can’t be reached right now.'; return false; }
    },
    path(s) { return 'nr/' + this.code + (s ? '/' + s : ''); },
    async create(name, pub) {
      if (!await this.init()) return false;
      this.me = this.uid(); this.name = name;
      let code = '';
      for (let i = 0; i < 8; i++) { code = Array.from({ length: 4 }, () => LETTERS[Math.random() * LETTERS.length | 0]).join(''); const m = await B.get('nr/' + code + '/m'); if (!m || Date.now() - (m.t || 0) > 6 * 3600e3) break; }
      this.code = code; this.host = this.me; this.isHost = true;
      await B.remove(this.path());
      await B.put(this.path('m'), { h: this.me, t: Date.now(), st: 'lobby', n: MAXP });
      await B.onDc(this.path());
      this.pub = !!pub;
      if (this.pub) { await B.put('nr/LIST/' + code, { h: name, n: 1, st: 'lobby', t: Date.now() }); await B.onDc('nr/LIST/' + code); clearInterval(this.hb); this.hb = setInterval(() => { if (this.on && this.isHost && this.pub) B.update('nr/LIST/' + this.code, { t: Date.now() }); }, 30000); }
      await this._enter();
      return true;
    },
    async join(code, name) {
      if (!await this.init()) return false;
      code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (code.length !== 4) { this.err = 'Enter the 4-letter code.'; return false; }
      const m = await B.get('nr/' + code + '/m');
      if (!m) { this.err = 'No room with that code.'; return false; }
      if (m.ban && m.ban[this.uid()]) { this.err = 'The host removed you from that room.'; return false; }
      const ps = await B.get('nr/' + code + '/p') || {};
      if (Object.keys(ps).length >= (m.n || MAXP)) { this.err = 'That room is full (' + MAXP + ' players).'; return false; }
      this.me = this.uid(); this.name = name; this.code = code; this.host = m.h; this.isHost = false;
      await B.onDc(this.path('p/' + this.me)); await B.onDc(this.path('s/' + this.me));
      await this._enter();
      if (m.st === 'play') this.emit('late', await B.get(this.path('h')), m);
      return true;
    },
    async _enter() {
      this.on = true; this.started = false; this.run = undefined; this.players = {}; this.states = {};
      await B.put(this.path('p/' + this.me), { n: this.name, j: Date.now() });
      this.seenSelf = false;
      unsub.push(B.watch(this.path('p'), v => { this.players = v || {}; if (this.players[this.me]) this.seenSelf = true; else if (this.seenSelf && !this.isHost && this.on) { this.emit('closed', 'The host removed you from the room.'); this.leave(true); return; } if (this.isHost && this.pub) B.update('nr/LIST/' + this.code, { n: Object.keys(this.players).length, t: Date.now() }); this.emit('players', this.players); }));
      unsub.push(B.watch(this.path('m'), v => { if (!v) { if (this.on) { this.emit('closed', this.isHost ? '' : 'The host left the room.'); this.leave(true); } return; } this.meta = v; if (v.st === 'play' && v.run !== this.run) { this.run = v.run; this.started = true; this.emit('started', v); } }));
      unsub.push(B.watch(this.path('s'), v => { this.states = v || {}; this.emit('states', this.states); }));
      if (this.isHost) unsub.push(B.added(this.path('c'), (k, v) => { B.removeKey(this.path('c'), k); (v.b || []).forEach(m => this.emit('cev', m, v.f)); }));
      else {
        unsub.push(B.added(this.path('e'), (k, v) => { (v.b || []).forEach(m => this.emit('ev', m)); }));
        unsub.push(B.watch(this.path('h'), v => { if (v) this.emit('snap', v); }));
      }
    },
    start(info) { if (!this.isHost) return; this.runN = (this.runN || 0) + 1; this.run = this.runN; B.update(this.path('m'), Object.assign({ st: 'play', run: this.runN }, info || {})); if (this.pub) B.update('nr/LIST/' + this.code, { st: 'play', t: Date.now() }); },
    listWatch(cb) { if (!B) return () => { }; return B.watch('nr/LIST', v => cb(v || {})); },
    setMeta(info) { if (this.isHost) B.update(this.path('m'), info); },
    // batched sends; flush() runs from the game loop
    ev(m) { if (this.on && this.isHost) evQ.push(m); },
    cev(m) { if (this.on && !this.isHost) cevQ.push(m); },
    state(s) { if (this.on) B.put(this.path('s/' + this.me), s); },
    snap(h) { if (this.on && this.isHost) B.put(this.path('h'), h); },
    flush(now) {
      if (!this.on) return;
      if (evQ.length) { const k = B.push(this.path('e'), { b: evQ }); evQ = []; myEvKeys.push([k, now]); }
      if (cevQ.length) { B.push(this.path('c'), { b: cevQ, f: this.me }); cevQ = []; }
      // host trims old events so the room doesn't grow
      while (myEvKeys.length && now - myEvKeys[0][1] > 20000) B.removeKey(this.path('e'), myEvKeys.shift()[0]);
    },
    kick(id) { if (!this.isHost || id === this.me) return; B.update(this.path('m/ban'), { [id]: 1 }); B.remove(this.path('p/' + id)); B.remove(this.path('s/' + id)); },
    async lbGet() { if (!await this.init()) return null; try { const v = await B.get('nr/TOPS') || {}; return Object.entries(v).map(([id, e]) => Object.assign({ id }, e)).filter(e => e && e.w > 0).sort((a, b) => b.w - a.w || (b.s || 0) - (a.s || 0)).slice(0, 10); } catch (e) { return null; } },
    async lbSubmit(name, w, s) { if (!await this.init()) return false; try { const p = 'nr/TOPS/' + this.uid(), cur = await B.get(p); if (cur && (cur.w > w || (cur.w === w && (cur.s || 0) >= s))) { if (cur.n !== name) await B.update(p, { n: name }); return 'kept'; } await B.put(p, { n: name, w, s, t: Date.now() }); return 'new'; } catch (e) { return false; } },
    count() { return Object.keys(this.players).length || 1; },
    leave(fromClose) {
      const was = this.on; this.on = false; this.started = false; unsub.forEach(f => { try { f(); } catch (e) { } }); unsub = []; evQ = []; cevQ = []; myEvKeys = [];
      if (B && was && this.isHost && this.pub) { B.remove('nr/LIST/' + this.code); B.cancelDc('nr/LIST/' + this.code); } clearInterval(this.hb); this.pub = false; this.runN = 0;
      if (B && was && !fromClose) { if (this.isHost) { B.remove(this.path()); B.cancelDc(this.path()); } else { B.remove(this.path('p/' + this.me)); B.remove(this.path('s/' + this.me)); } }
      this.code = ''; this.players = {}; this.states = {};
    },
    invite() { return location.origin + location.pathname + '?room=' + this.code + (local ? '&net=local' : ''); }
  };
  window.NRNet = N;
})();
