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
  const SYNC = /^(skyline|slingshot|mx-save|neonrift|nr-name|firebase\.|ridgeline\.|cornerpocket\.|gwf-|gbs-(bank|name|trophies)|ironoath_|quietbelow_|stormfall_)/;
  const GAMES = [[/^skyline/, 'Skyline'], [/^slingshot/, 'Slingshot'], [/^mx-/, 'Mitosis'], [/^(neonrift|nr-)/, 'Neon Rift'], [/^firebase\./, 'Firebase'], [/^ridgeline\./, 'Ridgeline'], [/^cornerpocket\./, 'Corner Pocket'], [/^gwf-/, 'Gamble With Friends'], [/^gbs-/, 'Trophies'], [/^ironoath_/, 'Ironoath'], [/^quietbelow_/, 'The Quiet Below'], [/^stormfall_/, 'Stormfall']];
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
  let meta = J(lget(MK), null) || {}; meta.t = meta.t || {}; meta.h = meta.h || {};
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
    keys.forEach(k => { const v = lget(k); if (v != null) data['saves/' + enc(k)] = { v, t: meta.t[k] || Date.now() }; });
    data.name = acct.n; data.at = { '.sv': 'timestamp' };
    keys.forEach(k => dirty.delete(k));
    try { status.busy = true; await API.patch('users/' + acct.u, data, await token(), keepalive); meta.at = status.at = Date.now(); meta.u = acct.u; saveMeta(); setStatus(''); }
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
      if (lv === o.v) { meta.t[k] = Math.max(meta.t[k] || 0, o.t || 0); meta.h[k] = hash(lv); dirty.delete(k); continue; }
      if (lv == null) { lset(k, o.v); meta.t[k] = o.t || 0; meta.h[k] = hash(o.v); applied++; continue; }
      if (linking) { conflicts.push(k); continue; }
      if ((o.t || 0) > (meta.t[k] || 0)) { lset(k, o.v); meta.t[k] = o.t; meta.h[k] = hash(o.v); dirty.delete(k); applied++; }
      else dirty.add(k);
    }
    if (conflicts.length) {
      const choice = opts.choice || await ask(conflicts, Object.keys(cloud));
      for (const k of conflicts) {
        if (choice === 'cloud') { lset(k, cloud[k].v); meta.t[k] = cloud[k].t || Date.now(); meta.h[k] = hash(cloud[k].v); dirty.delete(k); applied++; }
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
  async function signUp(name, pw) {
    name = checkName(name); if (String(pw).length < 6) throw fail('WEAK_PASSWORD');
    const t = await API.signUp(name.toLowerCase() + MAIL, pw);
    begin(t, name); meta.u = null;
    if (!lget('gbs-name')) lset('gbs-name', JSON.stringify(name));
    await pull({ choice: 'local' }); emit(); return api.info();
  }
  async function signIn(name, pw) {
    name = String(name || '').trim(); if (!name || !pw) throw fail('INVALID_LOGIN_CREDENTIALS');
    const t = await API.signIn(name.toLowerCase() + MAIL, pw);
    begin(t, name);
    try { const d = await API.get('users/' + t.u + '/name', t.id); if (d) { acct.n = d; writeCookie(acct); } } catch (e) { }
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
    await API.remove(id);
    meta.u = null; saveMeta(); acct = null; clearCookie(); sset('gbs-idt', null); emit();
  }
  async function syncNow() { scan(); const n = await pull(); await push(); return n; }

  const api = {
    info: () => ({ signedIn: !!acct, name: acct ? acct.n : '', at: status.at, busy: status.busy, err: status.err, msg: status.msg, pending: dirty.size, games: [...new Set(localKeys().map(gameOf))].filter(g => g !== 'Other') }),
    signUp, signIn, signOut: () => signOut(false), changePassword, deleteAccount, syncNow, onChange: f => listeners.push(f), gameOf, _test: { pull, push, scan, meta: () => meta, dirty: () => [...dirty] }
  };
  window.GBAccount = api;

  /* ---------- nav link ("Sign in" / your name) on pages that have one ---------- */
  function nav() { document.querySelectorAll('[data-acct-nav]').forEach(a => { a.textContent = acct ? acct.n : 'Sign in'; a.title = acct ? 'Your account (progress synced)' : 'Sign in to keep your progress on every device'; }); }
  listeners.push(nav);

  /* ---------- start ---------- */
  function start() {
    nav();
    if (sget('gbs-sync-note')) { sset('gbs-sync-note', null); setTimeout(() => toast('Progress loaded from your account'), 300); }
    if (!acct) { scan(); return; }
    pull().then(() => scan()).catch(() => scan());
    setInterval(scan, 10000);
    addEventListener('pagehide', () => { scan(); if (dirty.size) push(true); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') { scan(); if (dirty.size) push(true); }
      else if (!inGame && Date.now() - (status.at || 0) > 20000) pull();
    });
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', start); else start();
})();
