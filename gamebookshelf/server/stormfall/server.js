'use strict';
// =====================================================================
//  STORMFALL dedicated game server
//  - zero dependencies: run with `node server.js` (Node 18+)
//  - runs the matchmaking queue and every match authoritatively
//  - each match runs the real game.js simulation headless in its own sandbox
//  - also serves index.html / style.css / game.js, so the game is playable at /
//  Env: PORT (default 8080), REGION (label shown to players), MAX_MATCHES (default 20)
// =====================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const { performance } = require('perf_hooks');

const PORT = +process.env.PORT || 8080;
const REGION = String(process.env.REGION || 'Server').slice(0, 14);
const MAX_MATCHES = +process.env.MAX_MATCHES || 8;
const MAX_HUMANS = 12;           // real players per match (rest are bots)
const QUEUE_WAIT = 20000;        // ms the first player waits for others
const QUEUE_EXTEND = 6000;       // a new arrival guarantees at least this long
const FULL_START = 4000;         // a full queue starts this quickly
const MATCH_MAX_MS = 15 * 60 * 1000;
const TICK = 1 / 30;               // server simulation rate (30 Hz)
// game files: GAME_DIR, else this folder, else the website copy in games/stormfall
const DIR = [process.env.GAME_DIR, __dirname, path.join(__dirname, '..', '..', 'games', 'stormfall')]
  .find(d => d && fs.existsSync(path.join(d, 'game.js')));

// ---------- static files ----------
const FILES = { '/': 'index.html', '/index.html': 'index.html', '/style.css': 'style.css', '/game.js': 'game.js' };
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8' };
const server = http.createServer((req, res) => {
  const url = (req.url || '/').split('?')[0];
  if (url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }); res.end(JSON.stringify({ ok: true, region: REGION, online: clients.size, matches: matches.size, queue: queue.size })); return; }
  if (url === '/debug' && process.env.SF_DEBUG === '1' && req.method === 'POST') { // test hook, off unless SF_DEBUG=1
    let body = ''; req.on('data', d => { body += d; }); req.on('end', () => {
      const M = [...matches.values()].pop(); let out;
      try { out = M ? new Function('SF', body)(M.SF) : 'no match'; } catch (e) { out = 'ERR ' + e.message; }
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out === undefined ? null : out));
    }); return;
  }
  const f = FILES[url];
  if (!f) { res.writeHead(404); res.end('Not found'); return; }
  fs.readFile(path.join(DIR, f), (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)], 'Cache-Control': 'no-cache' }); res.end(data);
  });
});

// ---------- minimal WebSocket (RFC 6455) ----------
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const clients = new Set();
class Client {
  constructor(sock) {
    this.sock = sock; this.buf = Buffer.alloc(0); this.frags = []; this.id = crypto.randomBytes(6).toString('hex');
    this.name = 'Player'; this.skin = 0; this.match = null; this.alive = true; this.closed = false; this.msgCount = 0;
    sock.setNoDelay(true);
    sock.on('data', d => this.onData(d));
    sock.on('close', () => this.onClose());
    sock.on('error', () => this.onClose());
    clients.add(this);
  }
  onData(d) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, d]) : d;
    if (this.buf.length > 1 << 21) return this.close();
    for (;;) {
      const b = this.buf; if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = b.readUInt32BE(2) * 4294967296 + b.readUInt32BE(6); off = 10; }
      if (!masked || len > 1 << 20) return this.close(); // clients must mask; cap message size
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4), payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);
      if (op === 8) return this.close();
      if (op === 9) { this.frame(10, payload); continue; }
      if (op === 10) { this.alive = true; continue; }
      if (op === 0 || op === 1 || op === 2) {
        this.frags.push(payload);
        if (fin) { const msg = Buffer.concat(this.frags).toString('utf8'); this.frags = []; onMessage(this, msg); }
      }
    }
  }
  frame(op, payload) {
    if (this.closed || this.sock.destroyed) return;
    const len = payload.length; let head;
    if (len < 126) head = Buffer.from([0x80 | op, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeUInt32BE(Math.floor(len / 4294967296), 2); head.writeUInt32BE(len >>> 0, 6); }
    this.sock.write(Buffer.concat([head, payload]));
    if (this.sock.writableLength > 4 * 1024 * 1024) this.close(); // hopelessly slow connection
  }
  send(obj) { this.sendRaw(typeof obj === 'string' ? obj : JSON.stringify(obj)); }
  sendRaw(str) { this.frame(1, Buffer.from(str, 'utf8')); }
  close() { if (this.closed) return; try { this.frame(8, Buffer.alloc(0)); } catch (e) { /* gone */ } this.sock.destroy(); this.onClose(); }
  onClose() {
    if (this.closed) return; this.closed = true; clients.delete(this);
    if (queue.delete(this)) queueChanged(true);
    if (this.match) this.match.removePeer(this);
  }
}
server.on('upgrade', (req, sock) => {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') { sock.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  new Client(sock);
});
setInterval(() => { // keep-alive + drop dead connections
  for (const c of clients) { if (!c.alive) { c.close(); continue; } c.alive = false; c.frame(9, Buffer.alloc(0)); }
}, 25000);
setInterval(() => { for (const c of clients) c.msgCount = 0; }, 1000);

const cleanName = n => String(n || '').replace(/[^\w \-]/g, '').trim().slice(0, 14) || 'Player';
function onMessage(c, str) {
  if (++c.msgCount > 120) return; // flood guard (inputs are ~30/s)
  let m; try { m = JSON.parse(str); } catch (e) { return; }
  if (!m || typeof m.t !== 'string') return;
  switch (m.t) {
    case 'ping': c.send({ t: 'pong', id: c.id, region: REGION, online: clients.size }); break;
    case 'hello':
      c.name = cleanName(m.n); c.skin = Math.max(0, Math.min(7, m.s | 0));
      if (c.match) c.match.removePeer(c);
      if (!queue.has(c)) { queue.add(c); queueChanged(false, true); }
      break;
    case 'unqueue': if (queue.delete(c)) queueChanged(true); break;
    case 'join': {
      const M = matches.get(String(m.r || '').replace(/^m-/, ''));
      if (M && M.invited.has(c.id) && !M.ended) M.addPeer(c);
      break;
    }
    case 'leave': if (c.match && m.r === c.match.room) c.match.removePeer(c); break;
    case 'm': if (c.match && m.r === c.match.room) c.match.recv(c, String(m.a), m.d); break;
  }
}

// ---------- matchmaking queue ----------
const queue = new Set();
let queueEnd = 0;
function queueChanged(left, joined) {
  const now = Date.now();
  if (!queue.size) { queueEnd = 0; broadcastQueue(); return; }
  if (!queueEnd) queueEnd = now + QUEUE_WAIT;
  else if (joined && queueEnd - now < QUEUE_EXTEND) queueEnd = now + QUEUE_EXTEND;
  if (queue.size >= MAX_HUMANS) queueEnd = Math.min(queueEnd, now + FULL_START);
  broadcastQueue();
}
function broadcastQueue() {
  const list = [...queue], names = list.map(c => c.name), e = Math.max(0, queueEnd - Date.now());
  list.forEach((c, i) => c.send({ t: 'lobby', q: list.length, names, you: i, e, online: clients.size, matches: matches.size }));
}
setInterval(() => {
  if (queue.size && queueEnd && Date.now() >= queueEnd) {
    if (matches.size >= MAX_MATCHES) { queueEnd = Date.now() + 5000; broadcastQueue(); return; }
    const players = [...queue].slice(0, MAX_HUMANS);
    for (const c of players) queue.delete(c);
    queueEnd = 0; if (queue.size) queueChanged(false, true);
    try { startMatch(players); } catch (e) { console.error('match start failed', e); for (const c of players) { queue.add(c); } queueChanged(false, true); }
  } else broadcastQueue();
}, 1000);

// ---------- matches (headless game.js sandboxes) ----------
const GAME_SRC = fs.readFileSync(path.join(DIR, 'game.js'), 'utf8');
const GAME_SCRIPT = new vm.Script(GAME_SRC, { filename: 'game.js' });
function makeStub() {
  const fn = function () { return stub; };
  const stub = new Proxy(fn, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => 0;
      if (k === Symbol.iterator) return function* () { /* empty */ };
      if (k === 'then') return undefined;
      if (k === 'length') return 0;
      return stub;
    },
    set() { return true; }, apply() { return stub; }, construct() { return stub; }
  });
  return stub;
}
function createSim() {
  const stub = makeStub(), props = { __SF_HEADLESS: true };
  const win = new Proxy(props, { get(t, k) { return k in t ? t[k] : stub; }, set(t, k, v) { t[k] = v; return true; } });
  const quiet = { log() { }, warn() { }, error: (...a) => console.error('[sim]', ...a), info() { } };
  const ctx = {
    window: win, document: stub, localStorage: stub, navigator: stub, location: { protocol: 'server:', host: '', search: '' },
    performance, console: quiet, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => { }, WebSocket: undefined, BroadcastChannel: undefined
  };
  vm.createContext(ctx);
  GAME_SCRIPT.runInContext(ctx);
  return props.__SF;
}
const matches = new Map();
class Match {
  constructor(mid, players) {
    this.mid = mid; this.room = 'm-' + mid; this.peers = new Map(); this.handlers = {}; this.joinFns = []; this.leaveFns = [];
    this.invited = new Set(players.map(c => c.id)); this.ended = false; this.started = Date.now(); this.endAt = 0;
    this.lastObj = null; this.lastStr = '';
    const SF = this.SF = createSim();
    const self = this;
    SF.NET.selfId = 'server';
    SF.NET.lib = {
      selfId: 'server',
      joinRoom() {
        return {
          makeAction(a) { return [(d, to) => { self.out(a, d, to); return Promise.resolve(); }, fn => { self.handlers[a] = fn; }]; },
          onPeerJoin(fn) { self.joinFns.push(fn); }, onPeerLeave(fn) { self.leaveFns.push(fn); }, leave() { }
        };
      }
    };
    SF.hostMatch(mid, players.map(c => ({ id: c.id, name: c.name, skin: c.skin })), (Math.random() * 1e9) | 0);
    let last = performance.now(), acc = 0;
    this.timer = setInterval(() => {
      const now = performance.now(); const dt = Math.min(0.25, (now - last) / 1000); last = now; acc += dt;
      try {
        let n = 0; while (acc >= TICK && n < 6) { SF.step(TICK); acc -= TICK; n++; } if (n >= 6) acc = 0;
        SF.netTick(dt);
      } catch (e) { console.error('sim error in match', mid, e); this.end(); return; }
      this.checkEnd();
    }, 1000 / 30);
    matches.set(mid, this);
    for (const c of players) c.send({ t: 'start', m: mid });
    log(`match ${mid} started: ${players.map(c => c.name).join(', ')} (+${30 - players.length} bots)`);
  }
  out(a, d, to) {
    let str;
    if (d === this.lastObj && a === this.lastA) str = this.lastStr; // same snapshot to many players: serialize once
    else { str = JSON.stringify({ t: 'm', r: this.room, a, d, f: 'server' }); this.lastObj = d; this.lastA = a; this.lastStr = str; }
    if (to) { const c = this.peers.get(to); if (c) c.sendRaw(str); }
    else for (const c of this.peers.values()) c.sendRaw(str);
  }
  recv(c, a, d) { if (a !== 'rd' && a !== 'in' && a !== 'ac') return; const h = this.handlers[a]; if (h) { try { h(d, c.id); } catch (e) { /* bad input */ } } }
  addPeer(c) {
    if (c.match && c.match !== this) c.match.removePeer(c);
    queue.delete(c);
    this.peers.set(c.id, c); c.match = this;
    c.send({ t: 'peer', r: this.room, id: 'server', j: 1 });
    for (const f of this.joinFns) f(c.id);
  }
  removePeer(c) {
    if (!this.peers.delete(c.id)) return;
    if (c.match === this) c.match = null;
    this.invited.delete(c.id);
    for (const f of this.leaveFns) { try { f(c.id); } catch (e) { /* ignore */ } }
  }
  checkEnd() {
    const G = this.SF.G, now = Date.now();
    if (!G) return this.end();
    const humansIn = this.peers.size + [...this.invited].filter(id => !this.peers.has(id)).length * (now - this.started < 20000 ? 1 : 0);
    if (!humansIn) return this.end();
    if (G.alive <= 1 && !this.endAt) this.endAt = now + 15000;
    if ((this.endAt && now >= this.endAt) || now - this.started > MATCH_MAX_MS) this.end();
  }
  end() {
    if (this.ended) return; this.ended = true; clearInterval(this.timer);
    for (const c of this.peers.values()) { c.send({ t: 'm', r: this.room, a: 'gn', d: { r: 'end' }, f: 'server' }); c.match = null; }
    this.peers.clear(); matches.delete(this.mid);
    log(`match ${this.mid} ended after ${Math.round((Date.now() - this.started) / 1000)}s`);
  }
}
function startMatch(players) { new Match(crypto.randomBytes(4).toString('hex'), players); }

function log(s) { console.log(new Date().toISOString().slice(11, 19), s); }
server.listen(PORT, () => log(`STORMFALL server "${REGION}" listening on :${PORT}`));
