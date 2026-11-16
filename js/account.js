
(function () {
  'use strict';

  var USERS_KEY = 'ror_users_v1';
  var SESSION_KEY = 'ror_session_v1';

  //items and price
  var ITEMS = [
    { id: 'no_ads',        icon: '🚫', name: 'NO ADS',            desc: 'Remove all ads from the game, for 1 day.',               price: 500,  once: true },
    { id: 'unlock_boss',   icon: '👑', name: 'UNLOCK FINAL BOSS', desc: 'Skip the level requirement and face the Fog King now.',  price: 1500, once: true },
    { id: 'exp_small',     icon: '⭐', name: 'EXP BOOST S',       desc: 'Instantly gain 500 XP.',                                 price: 200,  xp: 500 },
    { id: 'exp_medium',    icon: '🌟', name: 'EXP BOOST M',       desc: 'Instantly gain 2,000 XP.',                               price: 700,  xp: 2000 },
    { id: 'exp_large',     icon: '💫', name: 'EXP BOOST L',       desc: 'Instantly gain 5,000 XP.',                               price: 1500, xp: 5000 }
  ];

//buy coins
  var PACKS = [
    { id: 'pack_20',   php: 20,   coins: 100,  bonus: '' },
    { id: 'pack_50',   php: 50,   coins: 275,  bonus: '+10% BONUS' },
    { id: 'pack_100',  php: 100,  coins: 600,  bonus: '+20% BONUS' },
    { id: 'pack_200',  php: 200,  coins: 1300, bonus: '+30% BONUS', best: false },
    { id: 'pack_500',  php: 500,  coins: 3500, bonus: '+40% BONUS', best: true },
    { id: 'pack_1000', php: 1000, coins: 7500, bonus: '+50% BONUS' }
  ];

 //none yet just testing
  var PAYMENT_MODE = 'test';


  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }
  function users() { return load(USERS_KEY, {}); }
  function session() { try { return localStorage.getItem(SESSION_KEY); } catch (e) { return null; } }
  function currentUser() { var k = session(); var u = k && users()[k]; return u ? u : null; }

  //hashing
  function toHex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function randomSalt() {
    var a = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.floor(Math.random() * 256); });
    return toHex(a);
  }
  function hashPassword(password, salt) {
    if (window.crypto && crypto.subtle) {
      var enc = new TextEncoder();
      return crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
        .then(function (key) {
          return crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
        })
        .then(toHex);
    }
    // very old browsers: weak fallback so the game still works
    var h = 5381, s = salt + password;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return Promise.resolve('weak' + (h >>> 0).toString(16));
  }


  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg) {
    var t = $('toast');
    if (!t) { alert(msg); return; }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function fmt(n) { return Number(n).toLocaleString(); }
  function bridge() { return window.RealmBridge || null; }

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(function (s) { s.classList.add('hidden'); });
    var el = $(id); if (el) el.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  var listeners = [];
  var API = {
    current: function () { var u = currentUser(); return u ? { name: u.name } : null; },
    owns: function (id) { var u = currentUser(); return !!(u && u.owned && u.owned[id]); },
    onChange: function (fn) { listeners.push(fn); },
    openStore: function () { openStore(); },
    openAccount: function () { openAccount(); }
  };
  window.RealmAccount = API;
  function changed() {
    document.body.classList.toggle('no-ads', API.owns('no_ads'));
    refreshHeader();
    listeners.forEach(function (fn) { try { fn(API.current()); } catch (e) {} });
    document.dispatchEvent(new CustomEvent('realm:account'));
  }


  function build() {
    var shell = document.querySelector('.app-shell');
    var footer = shell.querySelector('footer');

    var auth = document.createElement('section');
    auth.id = 'auth-screen'; auth.className = 'screen hidden';
    footer.parentNode.insertBefore(auth, footer);

    var store = document.createElement('section');
    store.id = 'store-screen'; store.className = 'screen hidden';
    footer.parentNode.insertBefore(store, footer);

    // header account button
    var stats = document.querySelector('.top-stats');
    var acc = document.createElement('button');
    acc.id = 'account-button'; acc.type = 'button'; acc.className = 'stat account-chip';
    acc.addEventListener('click', openAccount);
    stats.insertBefore(acc, $('sound-button'));

    // store button on the home screen
    var row = document.querySelector('#home-screen .button-row');
    if (row) {
      var sb = document.createElement('button');
      sb.id = 'store-button'; sb.className = 'btn btn-secondary'; sb.textContent = '🛒 STORE';
      sb.addEventListener('click', openStore);
      row.appendChild(sb);
    }
    refreshHeader();
  }

  function refreshHeader() {
    var b = $('account-button'); if (!b) return;
    var u = currentUser();
    b.textContent = u ? '👤 ' + u.name : '👤 LOG IN';
    b.title = u ? 'Your account' : 'Log in or create an account';
  }

  var mode = 'login';

  function openAccount() {
    var u = currentUser();
    if (u) renderProfile(u); else renderAuth();
    showScreen('auth-screen');
  }

  function renderAuth() {
    var el = $('auth-screen');
    el.innerHTML =
      '<div class="section-heading"><p class="eyebrow">WELCOME, ADVENTURER</p>' +
      '<h2>' + (mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT') + '</h2>' +
      '<p>' + (mode === 'login' ? 'Welcome back! Log in to use your store purchases.' : 'Make an account to buy upgrades in the store.') + '</p></div>' +
      '<div class="panel auth-box">' +
        '<div class="auth-tabs" role="tablist">' +
          '<button type="button" role="tab" class="auth-tab' + (mode === 'login' ? ' active' : '') + '" data-mode="login">LOG IN</button>' +
          '<button type="button" role="tab" class="auth-tab' + (mode === 'signup' ? ' active' : '') + '" data-mode="signup">CREATE ACCOUNT</button>' +
        '</div>' +
        '<form id="auth-form" autocomplete="on" novalidate>' +
          '<label class="auth-label" for="auth-user">USERNAME</label>' +
          '<input id="auth-user" class="answer-input" type="text" autocomplete="username" maxlength="16" autocapitalize="off" spellcheck="false">' +
          '<label class="auth-label" for="auth-pass">PASSWORD</label>' +
          '<input id="auth-pass" class="answer-input" type="password" autocomplete="' + (mode === 'login' ? 'current-password' : 'new-password') + '">' +
          (mode === 'signup'
            ? '<label class="auth-label" for="auth-pass2">CONFIRM PASSWORD</label><input id="auth-pass2" class="answer-input" type="password" autocomplete="new-password">'
            : '') +
          '<div id="auth-error" class="form-errors hidden" role="alert"></div>' +
          '<button id="auth-submit" class="btn btn-primary" type="submit">' + (mode === 'login' ? '▶ LOG IN' : '✦ CREATE ACCOUNT') + '</button>' +
        '</form>' +
        '<p class="microcopy auth-note">Your account is saved on this device only.</p>' +
      '</div>' +
      '<div class="button-row"><button id="auth-guest" class="btn btn-secondary">← CONTINUE AS GUEST</button></div>';

    el.querySelectorAll('.auth-tab').forEach(function (t) {
      t.addEventListener('click', function () { mode = t.getAttribute('data-mode'); renderAuth(); $('auth-user').focus(); });
    });
    $('auth-guest').addEventListener('click', function () { showScreen('home-screen'); });
    $('auth-form').addEventListener('submit', function (e) { e.preventDefault(); submitAuth(); });
  }

  function authError(msg) {
    var e = $('auth-error'); if (!e) return;
    e.textContent = msg; e.classList.toggle('hidden', !msg);
  }

  function submitAuth() {
    var name = $('auth-user').value.trim();
    var pass = $('auth-pass').value;
    var key = name.toLowerCase();
    var btn = $('auth-submit');
    authError('');

    if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return authError('Username must be 3-16 letters, numbers or underscores.');
    if (pass.length < 6) return authError('Password must be at least 6 characters.');

    var all = users();
    btn.disabled = true;

    if (mode === 'signup') {
      if (pass !== $('auth-pass2').value) { btn.disabled = false; return authError('The passwords do not match.'); }
      if (all[key]) { btn.disabled = false; return authError('That username is taken. Try another one.'); }
      var salt = randomSalt();
      hashPassword(pass, salt).then(function (hash) {
        all[key] = { name: name, salt: salt, hash: hash, created: Date.now(), owned: {} };
        if (!save(USERS_KEY, all)) { btn.disabled = false; return authError('Could not save. Is browser storage blocked?'); }
        try { localStorage.setItem(SESSION_KEY, key); } catch (e) {}
        toast('Account created. Welcome, ' + name + '!');
        changed(); showScreen('home-screen');
      });
    } else {
      var u = all[key];
      if (!u) { btn.disabled = false; return authError('Wrong username or password.'); }
      hashPassword(pass, u.salt).then(function (hash) {
        if (hash !== u.hash) { btn.disabled = false; return authError('Wrong username or password.'); }
        try { localStorage.setItem(SESSION_KEY, key); } catch (e) {}
        toast('Welcome back, ' + u.name + '!');
        changed(); showScreen('home-screen');
      });
    }
  }

  function renderProfile(u) {
    var owned = ITEMS.filter(function (i) { return i.once && u.owned && u.owned[i.id]; });
    var el = $('auth-screen');
    el.innerHTML =
      '<div class="section-heading"><p class="eyebrow">YOUR ACCOUNT</p><h2>' + esc(u.name.toUpperCase()) + '</h2>' +
      '<p>Member since ' + new Date(u.created).toLocaleDateString() + '</p></div>' +
      '<div class="panel auth-box"><h3>Your upgrades</h3>' +
        (owned.length
          ? '<ul class="owned-list">' + owned.map(function (i) { return '<li>' + i.icon + ' ' + i.name + '</li>'; }).join('') + '</ul>'
          : '<p>No upgrades yet. Visit the store to get some.</p>') +
      '</div>' +
      '<div class="button-row">' +
        '<button id="prof-store" class="btn btn-primary">🛒 STORE</button>' +
        '<button id="prof-back" class="btn btn-secondary">← MAIN MENU</button>' +
        '<button id="prof-out" class="btn btn-small btn-danger">LOG OUT</button>' +
      '</div>';
    $('prof-store').addEventListener('click', openStore);
    $('prof-back').addEventListener('click', function () { showScreen('home-screen'); });
    $('prof-out').addEventListener('click', function () {
      try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
      mode = 'login'; changed(); toast('Logged out.'); showScreen('home-screen');
    });
  }

  function openStore() { renderStore(); showScreen('store-screen'); }

  function renderStore() {
    var u = currentUser();
    var b = bridge();
    var coins = b && b.getCoins ? b.getCoins() : 0;
    var el = $('store-screen');

    el.innerHTML =
      '<div class="section-heading"><p class="eyebrow">THE TRAVELING MERCHANT</p><h2>STORE</h2>' +
      '<p>Spend your coins on upgrades.</p></div>' +
      '<div class="panel store-bar"><span>🪙 <b id="store-coins">' + fmt(coins) + '</b> coins</span>' +
        (u ? '<span>👤 ' + esc(u.name) + '</span>'
           : '<button id="store-login" class="btn btn-small btn-primary">LOG IN TO BUY</button>') +
      '</div>' +
      '<h3 class="store-heading">🪙 BUY COINS' + (PAYMENT_MODE === 'test' ? ' <span class="test-badge">TEST MODE · FREE</span>' : '') + '</h3>' +
      '<div class="store-grid pack-grid">' +
      PACKS.map(function (k) {
        return '<article class="store-card pack' + (k.best ? ' best' : '') + '">' +
          (k.best ? '<span class="pack-flag">BEST VALUE</span>' : '') +
          '<span class="store-icon">🪙</span><h3>' + fmt(k.coins) + ' COINS</h3>' +
          '<p>' + (k.bonus || '&nbsp;') + '</p>' +
          '<button class="btn btn-primary btn-small buy-coins" data-id="' + k.id + '">₱' + fmt(k.php) + '</button></article>';
      }).join('') +
      '</div>' +
      '<h3 class="store-heading">🛒 UPGRADES</h3>' +
      '<div class="store-grid">' +
      ITEMS.map(function (i) {
        var owned = i.once && u && u.owned && u.owned[i.id];
        return '<article class="store-card' + (owned ? ' owned' : '') + '">' +
          '<span class="store-icon">' + i.icon + '</span><h3>' + i.name + '</h3><p>' + i.desc + '</p>' +
          '<button class="btn ' + (owned ? 'btn-secondary' : 'btn-primary') + ' btn-small buy" data-id="' + i.id + '"' + (owned ? ' disabled' : '') + '>' +
          (owned ? '✓ OWNED' : '🪙 ' + fmt(i.price)) + '</button></article>';
      }).join('') +
      '</div>' +
      '<div class="button-row"><button id="store-back" class="btn btn-secondary">← MAIN MENU</button></div>';

    $('store-back').addEventListener('click', function () { showScreen('home-screen'); });
    if ($('store-login')) $('store-login').addEventListener('click', function () { mode = 'login'; openAccount(); });
    el.querySelectorAll('.buy').forEach(function (btn) {
      btn.addEventListener('click', function () { buy(btn.getAttribute('data-id')); });
    });
    el.querySelectorAll('.buy-coins').forEach(function (btn) {
      btn.addEventListener('click', function () { buyCoins(btn.getAttribute('data-id')); });
    });
  }

  function buyCoins(id) {
    var pack = PACKS.filter(function (k) { return k.id === id; })[0];
    var all = users(), key = session(), u = key && all[key];
    var b = bridge();

    if (!u) { toast('Log in or create an account first.'); mode = 'login'; return openAccount(); }
    if (!b || !b.addCoins) return toast('The store is not connected to the game yet.');
    if (PAYMENT_MODE === 'off') return toast('Coin packs are coming soon.');

    startCheckout(pack, u).then(function (paid) {
      if (!paid) return;
      b.addCoins(pack.coins);
      u.purchases = u.purchases || [];
      u.purchases.push({ pack: pack.id, php: pack.php, coins: pack.coins, at: Date.now(), mode: PAYMENT_MODE });
      all[key] = u; save(USERS_KEY, all);
      toast('+' + fmt(pack.coins) + ' coins added!');
      renderStore();
    });
  }

  /* Resolves true ONLY when the money has really been received.
     Replace the 'test' branch with your payment provider's checkout
     (for example PayMongo or Xendit for GCash/Maya/cards) once you have a server. */
  function startCheckout(pack, user) {
    if (PAYMENT_MODE === 'test') {
      return Promise.resolve(window.confirm('TEST MODE: no real payment.\nGive yourself ' + fmt(pack.coins) + ' coins for free?'));
    }
    return Promise.resolve(false);
  }

  function buy(id) {
    var item = ITEMS.filter(function (i) { return i.id === id; })[0];
    var all = users(), key = session(), u = key && all[key];
    var b = bridge();

    if (!u) { toast('Log in or create an account first.'); mode = 'login'; return openAccount(); }
    if (!b || !b.getCoins || !b.addCoins) return toast('The store is not connected to the game yet.');
    if (item.once && u.owned && u.owned[id]) return toast('You already own this.');
    if (b.getCoins() < item.price) return toast('Not enough coins. You need ' + fmt(item.price - b.getCoins()) + ' more.');
    if (item.xp && !b.addXP) return toast('EXP is not connected to the game yet.');
    if (!window.confirm('Buy ' + item.name + ' for ' + fmt(item.price) + ' coins?')) return;

    b.addCoins(-item.price);
    if (item.xp) b.addXP(item.xp);
    if (item.once) { u.owned = u.owned || {}; u.owned[id] = Date.now(); all[key] = u; save(USERS_KEY, all); }

    toast(item.xp ? '+' + fmt(item.xp) + ' XP!' : item.name + ' unlocked!');
    changed(); renderStore();
  }

  /* ---------- start ---------- */
  function init() { build(); changed(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
