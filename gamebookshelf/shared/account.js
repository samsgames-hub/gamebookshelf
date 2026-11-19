/* Game Bookshelf accounts: one sign-in for every gamebookshelf.com address (3.gamebookshelf.com, 4.gamebookshelf.com ...)
   and every device. Game saves live in each browser's storage, which is separate for each subdomain, so this keeps a copy
   of every game save in the player's account (Firebase) and brings it back wherever they play.
   - Sign-in is kept in a cookie for .gamebookshelf.com, so signing in once covers every subdomain in that browser.
   - Each save key is synced on its own; the newest change wins.
   - Talks to Firebase over plain HTTPS (no SDK), so pages stay light. */
(function () {
  'use strict';
  if (window.GBAccount) return;
  const KEY = 'AIzaSyAorALlmWcgCLaS9cIR_9BEUPKXcmKECoY', DB = 'https://gamebookshelf-9984c-default-rtdb.firebaseio.com', MAIL = '@players.gamebookshelf.com';
  /* which storage keys are game progress worth syncing (device ids, Firebase internals and our own bookkeeping are left out) */
  const SYNC = /^(skyline|slingshot|mx-save|neonrift|nr-name|firebase\.|ridgeline\.|cornerpocket\.|gwf-|gbs-(bank|name|trophies|adminx)|ironoath_|quietbelow_|stormfall_)/;
  const GAMES = [[/^skyline/, 'Skyline'], [/^slingshot/, 'Slingshot'], [/^mx-/, 'Mitosis'], [/^(neonrift|nr-)/, 'Neon Rift'], [/^firebase\./, 'Firebase'], [/^ridgeline\./, 'Ridgeline'], [/^cornerpocket\./, 'Corner Pocket'], [/^gwf-/, 'Gamble With Friends'], [/^gbs-/, 'Trophies'], [/^ironoath_/, 'Ironoath'], [/^quietbelow_/, 'The Quiet Below'], [/^stormfall_/, 'Stormfall']];
  /* currencies are added together when two addresses both changed them, instead of the newest copy replacing the other */
  const MERGE = { 'gbs-bank': 'deep', 'gwf-keys': 'num', skyline2: ['coins'], slingshot2: ['stars'], neonrift2: ['cores'], 'ridgeline.save': ['cash'], 'cornerpocket.save': ['money'] };
  const ADMINS = ['sam_admin'];
  /* public leaderboards: one number per game, read from that game's own save */
  const num = x => (typeof x === 'number' && isFinite(x) && x > 0 ? Math.floor(x) : 0);
  const BOARDS = [
    { id: 'neonrift', n: 'Neon Rift', what: 'Highest wave', unit: 'wave', k: 'neonrift2', f: s => num(s.bestWave) },
    { id: 'skyline', n: 'Skyline', what: 'Tallest tower', unit: 'floors', k: 'skyline2', f: s => num(s.best) },
    { id: 'slingshot', n: 'Slingshot', what: 'Furthest planet', unit: 'planet', k: 'slingshot2', f: s => num(s.best) },
    { id: 'mitosis', n: 'Mitosis', what: 'Biggest cell', unit: 'mass', k: 'mx-save', f: s => num(s.rec && s.rec.mass) },
    { id: 'stormfall', n: 'Stormfall', what: 'Most wins', unit: 'wins', k: 'stormfall_profile', f: s => num(s.wins) },
    { id: 'ironoath', n: 'Ironoath', what: 'Best renown', unit: 'renown', k: 'ironoath_save_v1', f: s => num(s.bestRenown) },
    { id: 'ridgeline', n: 'Ridgeline', what: 'Longest drive', unit: 'm', k: 'ridgeline.save', f: s => num(Math.max(0, ...Object.values(s.best || {}).map(Number).filter(isFinite))) },
    { id: 'firebase', n: 'Firebase', what: 'Best endless wave', unit: 'wave', k: 'firebase.save', f: s => num(Math.max(0, ...Object.values(s.maps || {}).map(m => +(m && m.endless) || 0))) },
    { id: 'cornerpocket', n: 'Corner Pocket', what: 'Matches won', unit: 'wins', k: 'cornerpocket.save', f: s => num(s.stats && s.stats.won) },
    { id: 'quietbelow', n: 'The Quiet Below', what: 'Holdout best', unit: 'points', k: 'quietbelow_v1', f: s => num(s.holdoutBest) },
    { id: 'trophies', n: 'Trophy points', what: 'Trophy points', unit: 'points', k: 'gbs-trophies', f: () => (window.GBTrophies ? num(GBTrophies.state().pts) : 0) }
  ];
  const gameOf = k => { for (const [r, n] of GAMES) if (r.test(k)) return n; return 'Other'; };
  const LS = window.localStorage, SS = window.sessionStorage;
  const rawSet = Storage.prototype.setItem, rawRemove = Storage.prototype.removeItem;
  const J = (s, d) => { try { return JSON.parse(s) ?? d; } catch (e) { return d; } };
  const lget = k => { try { return LS.getItem(k); } catch (e) { return null; } };
  const lset = (k, v) => { try { rawSet.call(LS, k, v); } catch (e) { } };
  const sget = k => { try { return SS.getItem(k); } catch (e) { return null; } };
  const sset = (k, v) => { try { v == null ? SS.removeItem(k) : SS.setItem(k, v); } catch (e) { } };
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + '.' + s.length; };
  const enc = k => k.replace(/[.$#\[\]\/%]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
  const dec = k => k.replace(/%([0-9A-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  const inGame = /\/games\/|\/arcade\/play/.test(location.pathname);

  /* ---------- sign-in cookie shared by every subdomain ---------- */
  const CK = 'gbs_acct';
  const cookieDomain = () => { const h = location.hostname; return /(^|\.)gamebookshelf\.com$/.test(h) ? '; domain=.gamebookshelf.com' : ''; };
  function readCookie() { const m = document.cookie.match(/(?:^|;\s*)gbs_acct=([^;]*)/); if (!m) return null; const o = J(decodeURIComponent(m[1]), null); return o && o.r && o.u ? o : null; }
  function writeCookie(o) { document.cookie = CK + '=' + encodeURIComponent(JSON.stringify(o)) + '; path=/; max-age=31536000; samesite=lax' + (location.protocol === 'https:' ? '; secure' : '') + cookieDomain(); }
  function clearCookie() { document.cookie = CK + '=; path=/; max-age=0' + cookieDomain(); document.cookie = CK + '=; path=/; max-age=0'; }

  /* ---------- Firebase over HTTPS (tests can swap this with window.GBAccountAPI) ---------- */
  const ERR = {
    EMAIL_EXISTS: 'That username is taken. Try another one.', INVALID_LOGIN_CREDENTIALS: 'Wrong username or password.', EMAIL_NOT_FOUND: 'Wrong username or password.', INVALID_PASSWORD: 'Wrong username or password.',
    WEAK_PASSWORD: 'Your password needs at least 6 characters.', TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many tries. Wait a minute and try again.', USER_DISABLED: 'This account has been turned off.',
    CONFIGURATION_NOT_FOUND: "Accounts aren't switched on yet. Try again soon.", OPERATION_NOT_ALLOWED: "Accounts aren't switched on yet. Try again soon.", CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'For safety, sign out and back in first.',
    USE_EMAIL: 'This account signs in with its email address now. Type your email instead of your username.', BADEMAIL: 'That email address doesn\u2019t look right.',
    INVALID_EMAIL: 'That email address doesn\u2019t look right.', EMAIL_EXISTS_MAIL: 'Another account already uses that email.', INVALID_NEW_EMAIL: 'That email address doesn\u2019t look right.',
    NET: "Can't reach the account server. Check your connection and try again.", DENIED: "Your account couldn't be saved. Try again in a minute."
  };
  const fail = code => { const c = String(code || '').split(' ')[0].split(':')[0]; const e = new Error(ERR[c] || 'Something went wrong (' + c + ').'); e.code = c; return e; };
  async function call(url, opt) {
    let r; try { r = await fetch(url, opt); } catch (e) { throw fail('NET'); }
    const t = await r.text(), j = J(t, null);
    if (!r.ok) throw fail(j && j.error ? (j.error.message || j.error) : r.status === 401 ? 'DENIED' : 'HTTP_' + r.status);
    return j;
  }
  const post = (path, body) => call('https://identitytoolkit.googleapis.com/v1/' + path + '?key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const API = window.GBAccountAPI || {
    signUp: (email, password) => post('accounts:signUp', { email, password, returnSecureToken: true }).then(j => ({ id: j.idToken, r: j.refreshToken, u: j.localId, exp: +j.expiresIn })),
    signIn: (email, password) => post('accounts:signInWithPassword', { email, password, returnSecureToken: true }).then(j => ({ id: j.idToken, r: j.refreshToken, u: j.localId, exp: +j.expiresIn })),
    refresh: rt => call('https://securetoken.googleapis.com/v1/token?key=' + KEY, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(rt) }).then(j => ({ id: j.id_token, r: j.refresh_token, u: j.user_id, exp: +j.expires_in })),
    password: (id, password) => post('accounts:update', { idToken: id, password, returnSecureToken: true }).then(j => ({ id: j.idToken, r: j.refreshToken, u: j.localId, exp: +j.expiresIn })),
    remove: id => post('accounts:delete', { idToken: id }),
    lookup: id => post('accounts:lookup', { idToken: id }).then(j => (j.users && j.users[0]) || {}),
    verifyEmail: (id, email) => post('accounts:sendOobCode', { requestType: 'VERIFY_AND_CHANGE_EMAIL', idToken: id, newEmail: email }),
    resetPassword: email => post('accounts:sendOobCode', { requestType: 'PASSWORD_RESET', email }),
    put: (path, data, id) => call(DB + '/' + path + '.json' + (id ? '?auth=' + encodeURIComponent(id) : ''), { method: 'PUT', body: JSON.stringify(data) }),
    pub: (path, qs) => call(DB + '/' + path + '.json' + (qs ? '?' + qs : ''), { cache: 'no-store' }),
    root: (data, id, keepalive) => call(DB + '/.json?auth=' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data), keepalive: !!keepalive }),
    get: (path, id) => call(DB + '/' + path + '.json?auth=' + encodeURIComponent(id), { cache: 'no-store' }),
    patch: (path, data, id, keepalive) => call(DB + '/' + path + '.json?auth=' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data), keepalive: !!keepalive }),
    del: (path, id) => call(DB + '/' + path + '.json?auth=' + encodeURIComponent(id), { method: 'DELETE' })
  };

  /* ---------- session ---------- */
  let acct = readCookie();             /* {r: refresh token, u: uid, n: username} */
  let tokP = null;
  async function token(force) {
    if (!acct) throw fail('SIGNED_OUT');
    const c = J(sget('gbs-idt'), null);
    if (!force && c && c.u === acct.u && c.exp > Date.now() + 60000) return c.id;
    if (!tokP) tokP = API.refresh(acct.r).then(t => { if (t.r && t.r !== acct.r) { acct.r = t.r; writeCookie(acct); } sset('gbs-idt', JSON.stringify({ id: t.id, u: acct.u, exp: Date.now() + t.exp * 1000 })); return t.id; })
      .catch(e => { if (/TOKEN|USER_NOT_FOUND|INVALID_REFRESH|USER_DISABLED|INVALID_ID/.test(e.code)) { setStatus('Your sign-in expired. Please sign in again.'); signOut(true); } throw e; })
      .finally(() => { tokP = null; });
    return tokP;
  }
  function begin(t, name) { acct = { r: t.r, u: t.u, n: name }; writeCookie(acct); sset('gbs-idt', JSON.stringify({ id: t.id, u: t.u, exp: Date.now() + t.exp * 1000 })); }

  /* ---------- sync bookkeeping (per subdomain, not synced itself) ---------- */
  const MK = 'gbs-sync';
  let meta = J(lget(MK), null) || {}; meta.t = meta.t || {}; meta.h = meta.h || {}; meta.b = meta.b || {};
  const setBase = (k, v) => { if (MERGE[k]) meta.b[k] = v; };
  /* three-way add: winner + (loser - base) for every number the spec covers */
  function merge3(k, winV, loseV, baseV) {
    try {
      const spec = MERGE[k], W = JSON.parse(winV), L = JSON.parse(loseV), B = JSON.parse(baseV), num = x => (typeof x === 'number' && isFinite(x) ? x : 0);
      if (spec === 'num') return String(Math.max(0, Math.round(num(+W) + num(+L) - num(+B))));
      if (!W || typeof W !== 'object' || !L || typeof L !== 'object') return null;
      const add = (w, l, b) => { for (const f in l) { const lv = l[f]; if (typeof lv === 'number') { if (w[f] === undefined || typeof w[f] === 'number') w[f] = Math.max(0, num(w[f]) + lv - num(b && b[f])); } else if (lv && typeof lv === 'object' && !Array.isArray(lv)) { if (!w[f] || typeof w[f] !== 'object') w[f] = {}; add(w[f], lv, b && b[f]); } } };
      if (spec === 'deep') add(W, L, B); else spec.forEach(f => { if (typeof L[f] === 'number') W[f] = Math.max(0, num(W[f]) + L[f] - num(B && B[f])); });
      return JSON.stringify(W);
    } catch (e) { return null; }
  }
  const saveMeta = () => lset(MK, JSON.stringify(meta));
  const dirty = new Set();
  let blocking = false, pushT = 0, status = { msg: '', at: meta.at || 0, busy: false, err: '' };
  const listeners = [];
  const emit = () => { listeners.forEach(f => { try { f(api.info()); } catch (e) { } }); try { dispatchEvent(new CustomEvent('gbs-account')); } catch (e) { } };
  function setStatus(msg, err) { status.msg = msg || ''; status.err = err || ''; emit(); }
  const localKeys = () => { const out = []; try { for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (k && SYNC.test(k)) out.push(k); } } catch (e) { } return out; };
  function touch(k) { const v = lget(k); if (v == null) return; const h = hash(v); if (meta.h[k] === h) return; meta.h[k] = h; meta.t[k] = Date.now(); dirty.add(k); }
  function scan() { localKeys().forEach(touch); saveMeta(); if (dirty.size) schedule(); }
  function schedule(ms) { if (!acct) return; clearTimeout(pushT); pushT = setTimeout(push, ms == null ? 2500 : ms); }

  /* watch saves as games write them */
  Storage.prototype.setItem = function (k, v) {
    if (this === LS && SYNC.test(k)) { if (blocking) return; rawSet.call(this, k, v); touch(k); saveMeta(); schedule(); return; }
    return rawSet.call(this, k, v);
  };
  Storage.prototype.removeItem = function (k) { if (this === LS && blocking && SYNC.test(k)) return; return rawRemove.call(this, k); };

  async function push(keepalive) {
    if (!acct || !dirty.size || status.busy && !keepalive) return;
    const keys = [...dirty], data = {};
    const sent = {};
    keys.forEach(k => { const v = lget(k); if (v != null) { data['saves/' + enc(k)] = { v, t: meta.t[k] || Date.now() }; sent[k] = v; } });
    data.name = acct.n; data.at = { '.sv': 'timestamp' };
    keys.forEach(k => dirty.delete(k));
    try { status.busy = true; await API.patch('users/' + acct.u, data, await token(), keepalive); meta.at = status.at = Date.now(); meta.u = acct.u; Object.keys(sent).forEach(k => setBase(k, sent[k])); saveMeta(); setStatus(''); publish(keepalive); }
    catch (e) { keys.forEach(k => dirty.add(k)); setStatus('', e.message); if (!keepalive) schedule(15000); }
    finally { status.busy = false; emit(); }
  }

  /* bring the account's saves into this browser; on first link, ask which progress to keep if both have some */
  async function pull(opts) {
    opts = opts || {};
    if (!acct) return 0;
    status.busy = true; emit();
    let data;
    try { data = await API.get('users/' + acct.u, await token()) || {}; }
    catch (e) { status.busy = false; setStatus('', e.message); return 0; }
    const cloud = {}; Object.entries(data.saves || {}).forEach(([k, o]) => { if (o && typeof o.v === 'string') cloud[dec(k)] = o; });
    const linking = meta.u !== acct.u, conflicts = [];
    let applied = 0;
    for (const [k, o] of Object.entries(cloud)) {
      if (!SYNC.test(k)) continue;
      const lv = lget(k);
      if (lv === o.v) { meta.t[k] = Math.max(meta.t[k] || 0, o.t || 0); meta.h[k] = hash(lv); setBase(k, lv); dirty.delete(k); continue; }
      if (lv == null) { lset(k, o.v); meta.t[k] = o.t || 0; meta.h[k] = hash(o.v); setBase(k, o.v); applied++; continue; }
      if (linking) { conflicts.push(k); continue; }
      const base = meta.b[k];
      if (MERGE[k] && base != null && lv !== base && o.v !== base) {
        const cloudNewer = (o.t || 0) > (meta.t[k] || 0), m = merge3(k, cloudNewer ? o.v : lv, cloudNewer ? lv : o.v, base);
        if (m != null) { if (m !== lv) { lset(k, m); applied++; } meta.h[k] = hash(m); meta.t[k] = Date.now(); dirty.add(k); continue; }
      }
      if ((o.t || 0) > (meta.t[k] || 0)) { lset(k, o.v); meta.t[k] = o.t; meta.h[k] = hash(o.v); setBase(k, o.v); dirty.delete(k); applied++; }
      else dirty.add(k);
    }
    if (conflicts.length) {
      const choice = opts.choice || await ask(conflicts, Object.keys(cloud));
      for (const k of conflicts) {
        if (choice === 'cloud') { lset(k, cloud[k].v); meta.t[k] = cloud[k].t || Date.now(); meta.h[k] = hash(cloud[k].v); setBase(k, cloud[k].v); dirty.delete(k); applied++; }
        else { const v = lget(k); meta.t[k] = Date.now(); meta.h[k] = hash(v); dirty.add(k); }
      }
    }
    /* anything only this browser has goes up to the account */
    localKeys().forEach(k => { if (!cloud[k]) { const v = lget(k); meta.h[k] = hash(v); meta.t[k] = meta.t[k] || Date.now(); dirty.add(k); } });
    meta.u = acct.u; meta.at = status.at = Date.now(); saveMeta();
    status.busy = false; setStatus('');
    if (data.name && !lget('gbs-name')) lset('gbs-name', JSON.stringify(data.name));
    if (dirty.size) await push();
    if (applied) afterApply();
    return applied;
  }
  /* a game already read its old save, so reload it with the account's progress (and stop the old copy saving over it on the way out) */
  function afterApply() {
    if (!inGame) { emit(); return; }
    const last = +sget('gbs-sync-rl') || 0;
    if (Date.now() - last < 20000) return;
    sset('gbs-sync-rl', String(Date.now())); sset('gbs-sync-note', '1');
    blocking = true; location.reload();
  }

  /* ---------- small UI pieces that work on any page ---------- */
  const FONT = 'font:500 15px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif';
  function toast(text) {
    const el = document.createElement('div'); el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;top:16px;z-index:2147483001;transform:translate(-50%,-160%);transition:transform .4s cubic-bezier(.3,1.4,.5,1);pointer-events:none;padding:10px 16px;border-radius:12px;background:rgba(14,18,26,.96);border:1px solid #2fd67b;color:#eef2f8;box-shadow:0 10px 30px rgba(0,0,0,.45);' + FONT;
    el.textContent = text; document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = 'translate(-50%,0)'; }));
    setTimeout(() => { el.style.transform = 'translate(-50%,-160%)'; setTimeout(() => el.remove(), 500); }, 3200);
  }
  function ask(conflicts, cloudKeys) {
    return new Promise(res => {
      const list = ks => [...new Set(ks.map(gameOf))].join(', ');
      const host = location.hostname.replace(/^www\./, '');
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483002;display:grid;place-items:center;padding:16px;background:rgba(4,7,12,.72);backdrop-filter:blur(6px);' + FONT;
      wrap.innerHTML = '<div role="dialog" aria-modal="true" aria-labelledby="gbsAskH" style="max-width:440px;width:100%;padding:22px;border-radius:18px;background:#121923;border:1px solid #263142;color:#e8eef6;box-shadow:0 20px 60px rgba(0,0,0,.6)">'
        + '<h2 id="gbsAskH" style="margin:0 0 8px;font:700 24px/1.15 system-ui,sans-serif">Which progress do you want to keep?</h2>'
        + '<p style="margin:0 0 6px;color:#a9b4c6">Your account <b style="color:#e8eef6">' + esc(acct.n) + '</b> and this browser on <b style="color:#e8eef6">' + esc(host) + '</b> both have saves for: <b style="color:#ffd166">' + esc(list(conflicts)) + '</b>.</p>'
        + '<p style="margin:0 0 16px;color:#a9b4c6">Everything else is combined either way.</p>'
        + '<div style="display:grid;gap:8px"><button data-c="cloud" style="cursor:pointer;padding:12px;border-radius:10px;border:0;background:#2fd67b;color:#06110b;font:700 16px system-ui,sans-serif">Keep my account’s progress</button>'
        + '<button data-c="local" style="cursor:pointer;padding:12px;border-radius:10px;border:1px solid #263142;background:#1a2330;color:#e8eef6;font:600 16px system-ui,sans-serif">Keep this browser’s progress</button></div></div>';
      wrap.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; wrap.remove(); res(b.dataset.c); });
      (document.body || document.documentElement).appendChild(wrap);
      setTimeout(() => { const b = wrap.querySelector('button'); if (b) b.focus(); }, 50);
    });
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- account actions (used by /account/) ---------- */
  const NAME = /^[A-Za-z0-9_]{3,16}$/;
  const checkName = n => { n = String(n || '').trim(); if (!NAME.test(n)) throw fail('BADNAME'); return n; };
  ERR.BADNAME = 'Usernames are 3 to 16 letters, numbers or underscores.';
  ERR.SIGNED_OUT = 'You are signed out.';
  /* usernames: the sign-in address keeps them unique, and 'unames/<name>' keeps them unique even after an account switches to a real email */
  async function claimName(name, t, m) {
    const low = name.toLowerCase();
    try { await API.put('unames/' + low, { u: t.u, m: m ? 1 : 0 }, t.id); return true; }
    catch (e) {
      if (e.code !== 'DENIED') return true;               /* network trouble: don't block the player */
      let cur = null; try { cur = await API.pub('unames/' + low); } catch (x) { return true; } /* registry not readable yet: rules not added */
      return !cur || cur.u === t.u;
    }
  }
  async function signUp(name, pw) {
    name = checkName(name); if (String(pw).length < 6) throw fail('WEAK_PASSWORD');
    let taken = null; try { taken = await API.pub('unames/' + name.toLowerCase()); } catch (e) { }
    if (taken) throw fail('EMAIL_EXISTS');
    const t = await API.signUp(name.toLowerCase() + MAIL, pw);
    if (!await claimName(name, t, 0)) { try { await API.remove(t.id); } catch (e) { } throw fail('EMAIL_EXISTS'); }
    begin(t, name); meta.u = null;
    if (!lget('gbs-name')) lset('gbs-name', JSON.stringify(name));
    await pull({ choice: 'local' }); emit(); return api.info();
  }
  async function signIn(name, pw) {
    name = String(name || '').trim(); if (!name || !pw) throw fail('INVALID_LOGIN_CREDENTIALS');
    const byMail = name.includes('@');
    let t;
    try { t = await API.signIn(byMail ? name : name.toLowerCase() + MAIL, pw); }
    catch (e) {
      if (!byMail && /INVALID_LOGIN|EMAIL_NOT_FOUND|INVALID_PASSWORD/.test(e.code)) { let r = null; try { r = await API.pub('unames/' + name.toLowerCase()); } catch (x) { } if (r && r.m) throw fail('USE_EMAIL'); }
      throw e;
    }
    begin(t, byMail ? name.split('@')[0] : name);
    let real = byMail ? '' : name;
    try { const d = await API.get('users/' + t.u + '/name', t.id); if (d) { real = d; acct.n = d; writeCookie(acct); } } catch (e) { }
    if (real) { try { const cur = await API.pub('unames/' + real.toLowerCase()); if (!cur) await claimName(real, t, byMail); } catch (e) { } }
    await pull(); emit(); return api.info();
  }
  async function signOut(silent) {
    if (acct && dirty.size && !silent) await push();
    acct = null; clearCookie(); sset('gbs-idt', null); clearTimeout(pushT); emit();
  }
  async function changePassword(pw) { if (String(pw).length < 6) throw fail('WEAK_PASSWORD'); const t = await API.password(await token(), pw); begin(t, acct.n); emit(); }
  async function deleteAccount() {
    const id = await token();
    await API.del('users/' + acct.u, id);
    try { await API.del('unames/' + acct.n.toLowerCase(), id); } catch (e) { }
    await API.remove(id);
    meta.u = null; saveMeta(); acct = null; clearCookie(); sset('gbs-idt', null); emit();
  }
  async function getEmail() { const u = await API.lookup(await token()); return u.email && !u.email.endsWith(MAIL) ? u.email : ''; }
  async function setEmail(email) {
    email = String(email || '').trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail('BADEMAIL');
    const id = await token();
    try { await API.verifyEmail(id, email); } catch (e) { if (e.code === 'EMAIL_EXISTS') throw fail('EMAIL_EXISTS_MAIL'); throw e; }
    try { await API.put('unames/' + acct.n.toLowerCase(), { u: acct.u, m: 1 }, id); } catch (e) { }
  }
  async function forgotPassword(email) { email = String(email || '').trim(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw fail('BADEMAIL'); await API.resetPassword(email); }
  async function syncNow() { scan(); const n = await pull(); await push(); return n; }

  const api = {
    info: () => ({ signedIn: !!acct, name: acct ? acct.n : '', at: status.at, busy: status.busy, err: status.err, msg: status.msg, pending: dirty.size, games: [...new Set(localKeys().map(gameOf))].filter(g => g !== 'Other') }),
    signUp, signIn, signOut: () => signOut(false), changePassword, deleteAccount, syncNow, getEmail, setEmail, forgotPassword,
    BOARDS: BOARDS.map(({ id, n, what, unit }) => ({ id, n, what, unit })), board, profileOf, friends, addFriend, removeFriend, isFriend, removeEntry, uid: () => (acct ? acct.u : ''), publish: () => publish(false, true),
    isAdmin: () => !!acct && ADMINS.includes(acct.n.toLowerCase()), admin: () => openAdmin(), onChange: f => listeners.push(f), gameOf, _test: { pull, push, scan, meta: () => meta, dirty: () => [...dirty] }
  };
  window.GBAccount = api;

  /* ---------- public profile, leaderboards, friends ---------- */
  let pubCache = J(sget('gbs-pub'), {}) || {}, pubT = 0;
  const gameHere = () => { const g = AG.find(x => location.pathname.indexOf(x.p) === 0); return g && g.n !== 'Trophies' ? g.n : ''; };
  function profileData() {
    const tr = J(lget('gbs-trophies'), {}) || {}, st = window.GBTrophies ? GBTrophies.state() : null, best = {};
    const x = J(lget('gbs-adminx'), []) || [];
    BOARDS.forEach(b => { if (b.id === 'trophies') return; const v = J(lget(b.k), null); const s = v && typeof v === 'object' ? b.f(v) : 0; if (s && !x.includes(b.id) && pubCache['lb/' + b.id + '/' + acct.u] !== 'ban') best[b.id] = s; });
    const got = st ? st.list.filter(t => t.at) : [];
    const title = (got.find(t => t.id === tr.title) || {}).name || (got.length ? 'Trophy Hunter' : 'Newcomer');
    return { n: acct.n, lv: st ? st.lv.l : 1, pts: st ? st.pts : 0, tro: got.length, of: st ? st.list.length : 0, title, show: (tr.show || []).filter(id => got.some(t => t.id === id)).slice(0, 3), best, adm: api.isAdmin() ? 1 : 0 };
  }
  async function publish(keepalive, force) {
    if (!acct) return;
    if (!force && !keepalive && Date.now() - pubT < 8000) return; pubT = Date.now();
    const data = {}, x = J(lget('gbs-adminx'), []) || [], prof = profileData(), playing = gameHere();
    BOARDS.forEach(b => {
      const v = b.id === 'trophies' ? null : J(lget(b.k), null), sc = x.includes(b.id) ? 0 : b.id === 'trophies' ? b.f() : v && typeof v === 'object' ? b.f(v) : 0, key = 'lb/' + b.id + '/' + acct.u;
      if (x.includes(b.id) && pubCache[key] !== 'x') { data[key] = null; pubCache[key] = 'x'; return; }
      if (sc && pubCache[key] !== sc + '|' + acct.n) { data[key] = { n: acct.n, s: sc, t: { '.sv': 'timestamp' } }; pubCache[key] = sc + '|' + acct.n; }
    });
    const ph = hash(JSON.stringify(prof)), pk = 'profiles/' + acct.u;
    if (pubCache[pk] !== ph || playing && Date.now() - (pubCache.seen || 0) > 120000 || force) {
      data[pk] = Object.assign(prof, { game: playing || pubCache.game || '', at: { '.sv': 'timestamp' } }); pubCache[pk] = ph; pubCache.seen = Date.now(); if (playing) pubCache.game = playing;
    }
    if (!Object.keys(data).length) return;
    let id; try { id = await token(); } catch (e) { Object.keys(data).forEach(k => delete pubCache[k]); return; }
    /* each write goes on its own, so a player banned from one board still updates everything else */
    await Promise.all(Object.entries(data).map(async ([k, v]) => {
      try { await API.root({ [k]: v }, id, keepalive); }
      catch (e) { if (e.code === 'DENIED' && k.indexOf('lb/') === 0) pubCache[k] = 'ban'; else delete pubCache[k]; }
    }));
    sset('gbs-pub', JSON.stringify(pubCache));
  }
  async function profileOf(name) {
    const r = await API.pub('unames/' + String(name || '').toLowerCase()); if (!r || !r.u) return null;
    const p = await API.pub('profiles/' + r.u); return p ? Object.assign(p, { uid: r.u }) : { n: name, uid: r.u, empty: 1 };
  }
  async function board(id, n) {
    const b = BOARDS.find(x => x.id === id); if (!b) return [];
    let d; try { d = await API.pub('lb/' + id, 'orderBy=%22s%22&limitToLast=' + (n || 100)); } catch (e) { d = await API.pub('lb/' + id); }
    return Object.entries(d || {}).map(([u, o]) => ({ u, n: o.n, s: +o.s || 0, t: o.t || 0 })).filter(o => o.s > 0).sort((a, b) => b.s - a.s || a.t - b.t);
  }
  async function friends() {
    if (!acct) return [];
    const ids = Object.keys(await API.get('friends/' + acct.u, await token()) || {});
    const out = await Promise.all(ids.map(async u => { try { const p = await API.pub('profiles/' + u); return Object.assign({ n: '?' }, p || {}, { uid: u }); } catch (e) { return { uid: u, n: '?' }; } }));
    return out.sort((a, b) => (b.at || 0) - (a.at || 0));
  }
  async function addFriend(name) {
    if (!acct) throw fail('SIGNED_OUT');
    const r = await API.pub('unames/' + String(name || '').trim().toLowerCase()); if (!r || !r.u) throw fail('NOUSER');
    if (r.u === acct.u) throw fail('SELF');
    await API.put('friends/' + acct.u + '/' + r.u, true, await token()); return r.u;
  }
  async function removeFriend(uid) { await API.del('friends/' + acct.u + '/' + uid, await token()); }
  async function isFriend(uid) { if (!acct) return false; try { return !!await API.get('friends/' + acct.u + '/' + uid, await token()); } catch (e) { return false; } }
  /* admin: take a score down and keep that player off this board */
  async function removeEntry(id, uid) { if (!api.isAdmin()) throw fail('DENIED'); const t = await token(); await API.put('lbban/' + id + '/' + uid, true, t); await API.del('lb/' + id + '/' + uid, t); }
  ERR.NOUSER = 'No player has that username.'; ERR.SELF = 'That’s you!';

  /* ---------- admin tools (only for admin accounts) ---------- */
  const AG = [
    { n: 'Skyline', p: '/games/skyline/', k: 'skyline2', a: [['Max coins', s => { s.coins = 999999; }], ['Unlock every style and Crosswind', s => { s.owned = ['brick', 'glass', 'concrete', 'deco', 'neon', 'gold']; s.best = Math.max(+s.best || 0, 25); }]] },
    { n: 'Slingshot', p: '/games/slingshot/', k: 'slingshot2', a: [['Max stars', s => { s.stars = 999999; }], ['Unlock every probe and max upgrades', s => { s.skins = ['probe', 'comet', 'viper', 'aurora', 'royal', 'phantom']; s.up = { thrust: 3, magnet: 3, tractor: 3, shield: 2 }; }]] },
    { n: 'Mitosis', p: '/games/mitosis/', k: 'mx-save', a: [['Max level (every skin)', s => { s.xp = Math.max(+s.xp || 0, 200000); }]] },
    { n: 'Neon Rift', p: '/games/neon-rift/', k: 'neonrift2', a: [['Max cores', s => { s.cores = 999999; }], ['Max every upgrade', s => { s.up = Object.assign(s.up || {}, { hp: 10, dmg: 10, spd: 10, xp: 10, sh: 10, dash: 3 }); }]] },
    { n: 'Firebase', p: '/games/firebase/', k: 'firebase.save', a: [['Open every map (3 stars each)', s => { s.maps = s.maps || {}; ['valley', 'desert', 'river', 'mountain'].forEach(id => { const m = s.maps[id] = s.maps[id] || {}; m.reg = 3; m.vet = 3; }); }], ['Max every perk', s => { s.perks = { supply: 3, gunnery: 3, ap: 3, flak: 2, arty: 2, eng: 2, fort: 2, salvage: 1, intel: 2 }; }]] },
    { n: 'Ridgeline', p: '/games/ridgeline/', k: 'ridgeline.save', a: [['Max cash', s => { s.cash = 9999999; }], ['Unlock every vehicle, upgrade and region', s => { const V = ['scout', 'buggy', 'crawler', 'expedition']; s.owned = V.slice(); s.up = s.up || {}; V.forEach(v => { s.up[v] = { eng: 10, sus: 10, tire: 10, tank: 10 }; }); s.best = s.best || {}; ['highland', 'canyon', 'glacier', 'quarry'].forEach(r => { s.best[r] = Math.max(+s.best[r] || 0, 2500); }); }]] },
    { n: 'Corner Pocket', p: '/games/corner-pocket/', k: 'cornerpocket.save', a: [['Max money', s => { s.money = 999999; }], ['Unlock every cue, cloth and opponent', s => { s.cues = ['house', 'maple', 'birds', 'carbon', 'gold']; s.cloths = ['emerald', 'blue', 'wine', 'slate', 'camel']; s.ladder = Math.max(+s.ladder || 0, 7); }]] },
    { n: 'Gamble With Friends', p: '/games/gamble-with-friends/', k: 'gwf-keys', raw: 1, a: [['+1,000 gold (paid into your next room)', () => { const b = J(lget('gbs-bank'), {}) || {}; b.gwf = b.gwf || {}; b.gwf.gold = (+b.gwf.gold || 0) + 1000; b.gwf.from = 'Admin'; LS.setItem('gbs-bank', JSON.stringify(b)); }], ['+50 vault keys', () => { LS.setItem('gwf-keys', String((+lget('gwf-keys') || 0) + 50)); }]] },
    { n: 'Ironoath', p: '/games/ironoath/', k: 'ironoath_save_v1', a: [['Unlock every weapon', s => { s.bestDuel = Math.max(+s.bestDuel || 0, 15); }]] },
    { n: 'The Quiet Below', p: '/games/the-quiet-below/', k: 'quietbelow_v1', a: [['Unlock Holdout mode', s => { s.cleared = Math.max(+s.cleared || 0, 8); s.v = Math.max(+s.v || 0, 2); s.codex = s.codex || []; s.endings = s.endings || []; }]] },
    { n: 'Stormfall', p: '/games/stormfall/', k: 'stormfall_profile', a: [['Max level (every skin)', s => { s.xp = Math.max(+s.xp || 0, 60000); }]] },
    { n: 'Trophies', p: '/trophies/', k: 'gbs-trophies', a: [] }
  ];
  const here = () => AG.find(g => location.pathname.indexOf(g.p) === 0);
  const keysFor = g => { const r = (GAMES.find(x => x[1] === (g.n === 'Trophies' ? 'Trophies' : g.n)) || [])[0]; return r ? localKeys().filter(k => r.test(k)) : [g.k]; };
  async function applied(g, note) {
    scan(); saveMeta();
    const onPage = here() === g;
    if (onPage) blocking = true;                 /* stop the open game saving its old copy over the change */
    try { await push(); } catch (e) { }
    if (onPage) { sset('gbs-sync-note', null); sset('gbs-admin-note', note); location.reload(); }
    else toast(note);
  }
  function markEdited(g) {
    const b = { Skyline: 'skyline', Slingshot: 'slingshot', Mitosis: 'mitosis', 'Neon Rift': 'neonrift', Firebase: 'firebase', Ridgeline: 'ridgeline', 'Corner Pocket': 'cornerpocket', Ironoath: 'ironoath', 'The Quiet Below': 'quietbelow', Stormfall: 'stormfall', Trophies: 'trophies' }[g.n];
    if (!b) return; const x = J(lget('gbs-adminx'), []) || []; if (!x.includes(b)) { x.push(b); LS.setItem('gbs-adminx', JSON.stringify(x)); }
    pubCache = {};
  }
  function runAct(g, i) {
    markEdited(g);
    const [label, f] = g.a[i];
    if (g.raw) f(); else { const s = J(lget(g.k), {}) || {}; f(s); LS.setItem(g.k, JSON.stringify(s)); }
    applied(g, g.n + ': ' + label.toLowerCase().replace(/ \(.*/, '') + ' ✓');
  }
  function openAdmin() {
    if (!api.isAdmin() || document.getElementById('gbsAdmin')) return;
    const cur = here(), list = cur ? [cur].concat(AG.filter(g => g !== cur)) : AG.slice();
    const W = document.createElement('div'); W.id = 'gbsAdmin';
    W.style.cssText = 'position:fixed;inset:0;z-index:2147483003;display:grid;place-items:center;padding:14px;background:rgba(4,7,12,.75);backdrop-filter:blur(6px);' + FONT;
    const btn = 'cursor:pointer;padding:8px 12px;border-radius:9px;border:1px solid #263142;background:#1a2330;color:#e8eef6;font:600 14px system-ui,sans-serif';
    W.innerHTML = '<div role="dialog" aria-modal="true" aria-label="Admin tools" style="width:min(640px,100%);max-height:88vh;display:flex;flex-direction:column;border-radius:18px;background:#121923;border:1px solid #ffd16666;color:#e8eef6;box-shadow:0 20px 60px rgba(0,0,0,.6)">'
      + '<div style="display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #263142"><b style="font:700 22px system-ui,sans-serif">Admin tools</b><span style="padding:3px 8px;border-radius:999px;background:#ffd166;color:#1d1503;font:700 11px system-ui;letter-spacing:.08em">ADMIN</span><span style="flex:1"></span><button data-x style="' + btn + '">Close</button></div>'
      + '<div id="gbsAdmL" style="overflow:auto;padding:12px 18px 18px;display:grid;gap:10px">' + list.map(g => '<section style="padding:12px;border-radius:12px;background:#0d131c;border:1px solid ' + (g === cur ? '#2fd67b88' : '#263142') + '"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><b style="font-size:16px">' + esc(g.n) + '</b>' + (g === cur ? '<span style="font-size:12px;color:#2fd67b">this game</span>' : '') + '</div><div style="display:flex;flex-wrap:wrap;gap:6px">'
        + g.a.map((a, i) => '<button data-g="' + AG.indexOf(g) + '" data-i="' + i + '" style="' + btn + '">' + esc(a[0]) + '</button>').join('') + '<button data-e="' + AG.indexOf(g) + '" style="' + btn + ';color:#ffd166">Edit save</button></div><div data-ed="' + AG.indexOf(g) + '"></div></section>').join('')
      + '<p style="margin:4px 0 0;color:#8e9bb0;font-size:13px">Changes save to your account straight away. If the game is open, it reloads with them. Shortcut: Ctrl+Shift+A.</p></div></div>';
    const close = () => { W.remove(); removeEventListener('keydown', esck, true); };
    const esck = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    addEventListener('keydown', esck, true);
    W.addEventListener('keydown', e => e.stopPropagation()); W.addEventListener('keyup', e => e.stopPropagation());
    W.addEventListener('click', e => {
      if (e.target === W || e.target.closest('[data-x]')) return close();
      const a = e.target.closest('[data-g]'); if (a) { runAct(AG[+a.dataset.g], +a.dataset.i); a.textContent = '✓ ' + a.textContent.replace(/^✓ /, ''); return; }
      const ed = e.target.closest('[data-e]'); if (ed) {
        const g = AG[+ed.dataset.e], box = W.querySelector('[data-ed="' + ed.dataset.e + '"]');
        if (box.firstChild) { box.innerHTML = ''; return; }
        const obj = {}; keysFor(g).forEach(k => { const v = lget(k); const p = J(v, undefined); obj[k] = p === undefined ? v : p; });
        box.innerHTML = '<textarea spellcheck="false" style="margin-top:10px;width:100%;min-height:200px;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid #263142;background:#06090e;color:#cfe;font:13px/1.45 ui-monospace,Consolas,monospace"></textarea><div style="display:flex;gap:6px;align-items:center;margin-top:6px"><button data-sv="' + ed.dataset.e + '" style="' + btn + ';background:#2fd67b;color:#06110b;border-color:#2fd67b">Save changes</button><span data-em style="color:#ff6b6b;font-size:13px"></span></div>';
        box.querySelector('textarea').value = Object.keys(obj).length ? JSON.stringify(obj, null, 2) : '{\n  "' + g.k + '": {}\n}';
        return;
      }
      const sv = e.target.closest('[data-sv]'); if (sv) {
        const g = AG[+sv.dataset.sv], box = sv.closest('[data-ed]'), em = box.querySelector('[data-em]');
        let o; try { o = JSON.parse(box.querySelector('textarea').value); if (!o || typeof o !== 'object' || Array.isArray(o)) throw 0; } catch (x) { em.textContent = 'That isn’t valid JSON. Check for a missing comma or quote.'; return; }
        const bad = Object.keys(o).filter(k => !SYNC.test(k)); if (bad.length) { em.textContent = 'Unknown save: ' + bad.join(', '); return; }
        markEdited(g); Object.entries(o).forEach(([k, v]) => LS.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)));
        applied(g, g.n + ' save updated ✓');
      }
    });
    document.body.appendChild(W);
  }
  addEventListener('keydown', e => { if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a') && api.isAdmin()) { e.preventDefault(); e.stopPropagation(); openAdmin(); } }, true);

  /* who's signed in, shown briefly when a game opens (tap it to open admin tools if you're an admin) */
  function gamePill() {
    const adm = api.isAdmin(), el = document.createElement(adm ? 'button' : 'div');
    el.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483000;display:flex;align-items:center;gap:7px;padding:7px 12px;border-radius:999px;background:rgba(14,18,26,.9);border:1px solid ' + (adm ? '#ffd16699' : '#263142') + ';color:#e8eef6;opacity:0;transition:opacity .4s;' + (adm ? 'cursor:pointer;' : 'pointer-events:none;') + 'font:600 13px system-ui,-apple-system,"Segoe UI",sans-serif';
    el.innerHTML = '<i style="width:8px;height:8px;border-radius:50%;background:#2fd67b"></i>' + esc(acct.n) + (adm ? ' <b style="padding:1px 6px;border-radius:999px;background:#ffd166;color:#1d1503;font-size:10px;letter-spacing:.06em">ADMIN</b>' : '<span style="color:#8e9bb0;font-weight:500">· synced</span>');
    if (adm) { el.title = 'Admin tools (Ctrl+Shift+A)'; el.onclick = openAdmin; }
    document.body.appendChild(el); requestAnimationFrame(() => { el.style.opacity = '1'; });
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 500); }, adm ? 7000 : 4000);
  }

  /* ---------- nav link ("Sign in" / your name) on pages that have one ---------- */
  function nav() { document.querySelectorAll('[data-acct-nav]').forEach(a => { a.textContent = acct ? acct.n : 'Sign in'; a.title = acct ? 'Your account (progress synced)' : 'Sign in to keep your progress on every device'; }); }
  listeners.push(nav);

  /* ---------- start ---------- */
  function start() {
    nav();
    if (sget('gbs-sync-note')) { sset('gbs-sync-note', null); setTimeout(() => toast('Progress loaded from your account'), 300); }
    const an = sget('gbs-admin-note'); if (an) { sset('gbs-admin-note', null); setTimeout(() => toast(an), 300); }
    if (!acct) { scan(); return; }
    if (inGame) setTimeout(gamePill, 900);
    pull().then(() => { scan(); publish(false, true); }).catch(() => scan());
    if (inGame) setInterval(() => { if (!document.hidden) publish(); }, 120000);
    setInterval(scan, 10000);
    addEventListener('pagehide', () => { scan(); if (dirty.size) push(true); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { scan(); if (dirty.size) push(true); }
      else if (!inGame && Date.now() - (status.at || 0) > 20000) pull();
    });
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start();
})();
