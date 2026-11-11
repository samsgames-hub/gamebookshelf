/* Game Bookshelf trophies: one collection across every game on the site.
   Each trophy is checked against the games' own saved progress (this browser's storage), so nothing extra is tracked.
   New trophies pop up wherever you are on the site and pay a reward into 'gbs-bank' (collected by each game when it opens).
   Points: bronze 10, silver 25, gold 50. Your level comes from your points. */
(function () {
  'use strict';
  const R = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const W = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const has = k => { try { return localStorage.getItem(k) !== null; } catch (e) { return false; } };
  const n = v => (Number.isFinite(+v) ? +v : 0);
  /* everything the checks need, read fresh each time */
  function snap() {
    const fb = R('firebase.save') || {}, maps = fb.maps || {}, rl = R('ridgeline.save') || {}, cp = R('cornerpocket.save') || {}, mx = R('mx-save') || {}, nr = R('neonrift2') || R('neonrift') || {};
    const sk = R('skyline2') || {}, sl = R('slingshot2') || {}, tb = R('tumbler1') || {}, daily = R('gbs-daily') || {}, tour = R('gbs-tour') || {};
    const fbStars = Object.values(maps).reduce((s, m) => s + n(m.reg) + n(m.vet), 0), fb3 = Object.values(maps).some(m => n(m.reg) >= 3);
    const days = Object.keys(daily).filter(k => /^\d+$/.test(k)).map(Number).sort((a, b) => a - b);
    const sweeps = days.filter(d => Object.keys(daily[d]).length >= 4).length;
    let run = 0, best = 0, prev = -9; for (const d of days) { run = d === prev + 1 ? run + 1 : 1; prev = d; best = Math.max(best, run); }
    const paid = Object.values(tour.paid || {}), entered = Object.keys(tour.best || {}).length;
    const played = {
      quietbelow: has('quietbelow_v1'), skyline: has('skyline2') || has('skyline1'), slingshot: has('slingshot2') || has('slingshot1'), mitosis: has('mx-save'),
      neonrift: has('neonrift2') || has('neonrift'), firebase: has('firebase.save'), ridgeline: has('ridgeline.save'), cornerpocket: has('cornerpocket.save'), gwf: has('gwf-name') || has('gwf-keys')
    };
    return {
      played: Object.values(played).filter(Boolean).length, tb, sk, sl, mx, nr, fbStars, fb3, rl, cp, sweeps, dailyRun: best, entered,
      wins: paid.filter(p => p && p.rank === 1).length, podiums: paid.filter(p => p && p.rank >= 1 && p.rank <= 3).length,
      groups: (R('gbs-groups') || []).length, keys: n(R('gwf-keys')), rlBest: Math.max(0, ...Object.values(rl.best || {}).map(n))
    };
  }
  /* [id, game, name, how, tier, progress(s) -> [have, need]] */
  const T = [
    ['explorer', 'Game Bookshelf', 'Explorer', 'Play 5 different games', 'b', s => [s.played, 5]],
    ['completist', 'Game Bookshelf', 'Completionist', 'Play all 9 games', 's', s => [s.played, 9]],
    ['sk25', 'Skyline', 'Office Block', 'Build a 25-floor tower', 'b', s => [n(s.sk.best), 25]],
    ['sk60', 'Skyline', 'Skyscraper', 'Build a 60-floor tower', 's', s => [n(s.sk.best), 60]],
    ['sk100', 'Skyline', 'Supertall', 'Build a 100-floor tower', 'g', s => [n(s.sk.best), 100]],
    ['skcross', 'Skyline', 'Weathered It', 'Reach floor 20 in Crosswind', 's', s => [n(s.sk.crossBest), 20]],
    ['skstyle', 'Skyline', 'Architect', 'Own 4 building styles', 's', s => [(s.sk.owned || []).length, 4]],
    ['sl20', 'Slingshot', 'Escape Velocity', 'Reach planet 20', 'b', s => [n(s.sl.best), 20]],
    ['sl45', 'Slingshot', 'Event Horizon', 'Reach planet 45 (the black holes)', 's', s => [n(s.sl.best), 45]],
    ['sl90', 'Slingshot', 'The Edge', 'Reach planet 90', 'g', s => [n(s.sl.best), 90]],
    ['slfleet', 'Slingshot', 'Fleet', 'Own 3 probes', 's', s => [(s.sl.skins || []).length, 3]],
    ['mx1k', 'Mitosis', 'Growing Up', 'Reach 1,000 mass', 'b', s => [n(s.mx.rec && s.mx.rec.mass), 1000]],
    ['mx10k', 'Mitosis', 'Apex', 'Reach 10,000 mass', 'g', s => [n(s.mx.rec && s.mx.rec.mass), 10000]],
    ['mx50', 'Mitosis', 'Petri Veteran', 'Play 50 Mitosis games', 's', s => [n(s.mx.rec && s.mx.rec.games), 50]],
    ['nr10', 'Neon Rift', 'Rift Runner', 'Reach wave 10', 'b', s => [n(s.nr.bestWave), 10]],
    ['nr25', 'Neon Rift', 'Riftbreaker', 'Reach wave 25', 'g', s => [n(s.nr.bestWave), 25]],
    ['nrboss', 'Neon Rift', 'Boss Hunter', 'Defeat 5 bosses', 's', s => [n(s.nr.bossKills), 5]],
    ['fb10', 'Firebase', 'Holding the Line', 'Earn 10 stars', 'b', s => [s.fbStars, 10]],
    ['fb3', 'Firebase', 'Flawless Defence', 'Earn 3 stars on a map', 's', s => [s.fb3 ? 1 : 0, 1]],
    ['fb30', 'Firebase', 'Base Commander', 'Earn 30 stars', 'g', s => [s.fbStars, 30]],
    ['rl1k', 'Ridgeline', 'Off the Beaten Path', 'Drive 1,000 m in one run', 'b', s => [s.rlBest, 1000]],
    ['rl50k', 'Ridgeline', 'Long Haul', 'Drive 50 km in total', 's', s => [Math.floor(n(s.rl.total)), 50000]],
    ['rlgarage', 'Ridgeline', 'Full Garage', 'Own all 4 vehicles', 'g', s => [(s.rl.owned || []).length, 4]],
    ['cp10', 'Corner Pocket', 'Hustler', 'Win 10 matches', 'b', s => [n(s.cp.stats && s.cp.stats.won), 10]],
    ['cpgold', 'Corner Pocket', 'Speed Demon', 'Get a gold medal in Speed Pool', 's', s => [n(s.cp.speedMedals) >= 3 ? 1 : 0, 1]],
    ['cpcareer', 'Corner Pocket', 'Pool Shark', 'Beat 5 career opponents', 'g', s => [(s.cp.beaten || []).length, 5]],
    ['gwfkey', 'Gamble With Friends', 'Key Holder', 'Hold a vault key', 'b', s => [s.keys, 1]]
  ];
  const TIER = { b: { n: 'Bronze', pts: 10, coins: 30, stars: 8, gold: 0, keys: 0 }, s: { n: 'Silver', pts: 25, coins: 80, stars: 20, gold: 1, keys: 0 }, g: { n: 'Gold', pts: 50, coins: 200, stars: 50, gold: 3, keys: 1 } };
  const level = pts => { let l = 1, need = 30, left = pts; while (left >= need) { left -= need; l++; need = Math.round(need * 1.25); } return { l, into: left, need }; };
  function state() {
    const s = snap(), got = (R('gbs-trophies') || {}).got || {};
    const list = T.map(([id, game, name, how, tier, p]) => { let pr = [0, 1]; try { pr = p(s); } catch (e) { } const have = Math.min(pr[0], pr[1]); return { id, game, name, how, tier, have, need: pr[1], done: pr[0] >= pr[1], at: got[id] || 0 }; });
    const pts = list.filter(t => t.at).reduce((a, t) => a + TIER[t.tier].pts, 0);
    return { list, pts, lv: level(pts) };
  }
  /* award anything newly earned: store it, pay the reward, show a pop-up */
  function check(quiet) {
    const st = R('gbs-trophies') || { got: {} }; st.got = st.got || {};
    const first = !st.init, s = state(), fresh = s.list.filter(t => t.done && !st.got[t.id]);
    if (!fresh.length) { if (first) { st.init = 1; W('gbs-trophies', st); } return []; }
    const bank = R('gbs-bank') || {}, add = (g, k, v) => { if (!v) return; bank[g] = bank[g] || {}; bank[g][k] = (bank[g][k] || 0) + v; bank[g].from = 'Trophies'; };
    fresh.forEach(t => { st.got[t.id] = Date.now(); const r = TIER[t.tier]; add('skyline', 'coins', r.coins); add('slingshot', 'stars', r.stars); add('gwf', 'gold', r.gold); add('gwf', 'keys', r.keys); });
    st.init = 1; W('gbs-trophies', st); W('gbs-bank', bank);
    if (!quiet) { const show = fresh.length > 3 ? fresh.slice(0, 2) : fresh; show.forEach((t, i) => setTimeout(() => popup(t), 400 + i * 2600)); if (fresh.length > 3) setTimeout(() => popup({ more: fresh.length - 2, tier: 'g' }), 400 + 2 * 2600); }
    return fresh;
  }
  /* pop-up card, styled inline so it works on any page */
  function popup(t) {
    const inGame = location.pathname.indexOf('/games/') >= 0, r = TIER[t.tier], col = { b: '#d79a62', s: '#cfd8e3', g: '#ffd166' }[t.tier], el = document.createElement(inGame ? 'div' : 'a');
    if (!inGame) el.href = '/trophies/'; el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483000;display:flex;gap:12px;align-items:center;max-width:340px;padding:12px 16px 12px 12px;border-radius:14px;background:rgba(14,18,26,.96);border:1px solid ' + col + ';box-shadow:0 12px 40px rgba(0,0,0,.5);color:#eef2f8;' + (inGame ? 'pointer-events:none;' : '') + 'font:500 14px/1.35 system-ui,-apple-system,"Segoe UI",sans-serif;text-decoration:none;transform:translateY(140%);transition:transform .45s cubic-bezier(.3,1.4,.5,1)';
    if (t.more) t = { name: '+' + t.more + ' more trophies', game: 'See them all in the Trophy Room', more: t.more, tier: 'g' };
    el.innerHTML = '<span style="flex:none;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:24px;background:radial-gradient(circle at 35% 30%,#fff8,' + col + ' 45%,#0006)">🏆</span><span><b style="display:block;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:' + col + '">' + (t.more ? '' : r.n) + (t.more ? 'And' : ' trophy unlocked') + '</b><b style="display:block;font-size:16px">' + t.name + '</b><span style="color:#a9b4c6">' + t.game + (t.more ? '' : ' · +' + r.pts + ' points · +' + r.coins + ' coins, +' + r.stars + ' stars' + (r.gold ? ', +' + r.gold + ' gold' : '') + (r.keys ? ', +1 key' : '')) + '</span></span>';
    document.body.appendChild(el); requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transform = 'none'; }));
    try { const A = new (window.AudioContext || window.webkitAudioContext)(), now = A.currentTime;[0, 4, 7, 12].forEach((s, i) => { const o = A.createOscillator(), g = A.createGain(); o.type = 'triangle'; o.frequency.value = 659 * Math.pow(2, s / 12); g.gain.setValueAtTime(.0001, now + i * .08); g.gain.exponentialRampToValueAtTime(.07, now + i * .08 + .01); g.gain.exponentialRampToValueAtTime(.0001, now + i * .08 + .4); o.connect(g); g.connect(A.destination); o.start(now + i * .08); o.stop(now + i * .08 + .45); }); setTimeout(() => A.close(), 1500); } catch (e) { }
    setTimeout(() => { el.style.transform = 'translateY(140%)'; setTimeout(() => el.remove(), 600); }, 5200);
  }
  window.GBTrophies = { state, check, TIER, level, list: T };
  /* check now and every few seconds while a page is open (games save as you play) */
  const go = () => { if (!document.hidden) check(false); };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', () => setTimeout(go, 1500)); else setTimeout(go, 1500);
  setInterval(go, 6000); addEventListener('focus', go);
})();
