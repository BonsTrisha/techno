// ============================================================
// music.js: looping chiptune background music with 3 songs.
//   main  = cheerful adventure (menus, map, normal battles)
//   boss  = tense, suspenseful (Final Boss battle)
//   store = relaxed shop jingle (the store)
// Made with Web Audio, so there are no sound files to download.
// The 🔊 button in the top bar turns music AND sound effects on/off.
// Browsers only allow sound after a tap / click / key press, so the
// music starts the first time the player does one of those.
// ============================================================
(function () {
  'use strict';

  var VOLUME = 0.5;    // overall music loudness, 0 to 1 (sound effects are separate)

  /* ---------- helpers for writing songs ----------
     Notes are MIDI numbers (60 = middle C). A melody is a list of
     [note, length] where length is in eighth notes and 0 = rest.
     Every bar must add up to 8, and a song is 8 bars = 64 steps. */
  function parse(melody) {
    var map = {}, s = 0;
    melody.forEach(function (n) { if (n[0]) map[s] = n; s += n[1]; });
    return map;
  }

  /* ---------- SONG 1: MAIN (cheerful) ---------- */
  var MAIN_CHORDS = [
    { r: 48, t: [60, 64, 67] }, { r: 48, t: [60, 64, 67] },   // C
    { r: 43, t: [67, 71, 74] }, { r: 43, t: [67, 71, 74] },   // G
    { r: 45, t: [69, 72, 76] }, { r: 45, t: [69, 72, 76] },   // Am
    { r: 41, t: [65, 69, 72] }, { r: 43, t: [67, 71, 74] }    // F, G
  ];
  var MAIN_LEAD = parse([
    [76,1],[79,1],[76,1],[72,1],[74,2],[0,2],
    [76,1],[79,1],[84,2],[79,2],[76,2],
    [74,1],[79,1],[74,1],[71,1],[67,2],[0,2],
    [71,1],[74,1],[79,2],[74,2],[71,2],
    [72,1],[76,1],[81,2],[76,2],[72,2],
    [76,1],[72,1],[69,1],[72,1],[76,4],
    [77,1],[81,1],[77,1],[72,1],[74,2],[77,2],
    [74,1],[71,1],[67,1],[71,1],[74,2],[79,2]
  ]);
  var ARP = [0, 1, 2, 1, 0, 1, 2, 1];

  /* ---------- SONG 2: BOSS (suspense, A minor) ---------- */
  var BOSS_CHORDS = [
    { r: 45 }, { r: 45 },      // Am
    { r: 41 }, { r: 41 },      // F
    { r: 38 }, { r: 40 },      // Dm, E
    { r: 45 }, { r: 40 }       // Am, E
  ];
  var BOSS_LEAD = parse([
    [69,1],[0,1],[69,1],[70,1],[69,1],[0,1],[68,2],
    [69,1],[0,1],[69,1],[72,1],[71,1],[0,1],[69,2],
    [65,1],[0,1],[65,1],[66,1],[65,1],[0,1],[64,2],
    [65,1],[0,1],[65,1],[69,1],[68,1],[0,1],[65,2],
    [62,1],[0,1],[62,1],[63,1],[62,1],[0,1],[61,2],
    [64,1],[0,1],[64,1],[68,1],[71,1],[0,1],[76,2],
    [69,2],[72,2],[76,2],[75,2],
    [76,1],[75,1],[76,1],[75,1],[76,1],[75,1],[76,2]
  ]);

  /* ---------- SONG 3: STORE (relaxed, G major) ---------- */
  var STORE_CHORDS = [
    { r: 55, t: [67, 71, 74] }, { r: 52, t: [64, 67, 71] },   // G, Em
    { r: 48, t: [60, 64, 67] }, { r: 50, t: [62, 66, 69] },   // C, D
    { r: 55, t: [67, 71, 74] }, { r: 52, t: [64, 67, 71] },   // G, Em
    { r: 48, t: [60, 64, 67] }, { r: 50, t: [62, 66, 69] }    // C, D
  ];
  var STORE_LEAD = parse([
    [79,1],[83,1],[86,2],[83,1],[79,1],[81,2],
    [83,2],[79,1],[76,1],[79,2],[0,2],
    [84,1],[79,1],[76,1],[79,1],[84,2],[88,2],
    [86,2],[81,1],[78,1],[81,2],[0,2],
    [79,1],[83,1],[86,2],[91,2],[86,2],
    [83,1],[79,1],[76,2],[79,1],[83,1],[79,2],
    [84,2],[79,2],[76,2],[72,2],
    [74,2],[78,2],[81,2],[0,2]
  ]);

  /* ---------- the instruments ---------- */
  var ctx = null, master = null, bus = null, noiseBuf = null;

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  function tone(type, m, t, dur, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = hz(m);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function kick(t, vol) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.17);
  }
  function hat(t, vol) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf;
    f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t); s.stop(t + 0.06);
  }

  /* ---------- how each song is played, one eighth note at a time ---------- */
  var TRACKS = {
    main: {
      bpm: 128, volume: 1, duck: 0.55,           // duck = how much quieter during battles
      play: function (s, t, step) {
        var chord = MAIN_CHORDS[Math.floor(s / 8)], pos = s % 8;
        tone('triangle', pos === 4 ? chord.r + 7 : (pos % 2 ? chord.r + 12 : chord.r), t, step * 0.9, 0.2);
        tone('square', chord.t[ARP[pos]], t, step * 0.8, 0.03);
        if (MAIN_LEAD[s]) tone('square', MAIN_LEAD[s][0], t, step * MAIN_LEAD[s][1] * 0.92, 0.07);
        if (pos === 0 || pos === 4) kick(t, 0.16);
        if (pos % 2 === 1) hat(t, 0.035);
      }
    },
    boss: {
      bpm: 112, volume: 1.05, duck: 0.85,
      play: function (s, t, step) {
        var bar = Math.floor(s / 8), pos = s % 8, r = BOSS_CHORDS[bar].r;
        // creeping bass; a half-step slip at the end of some bars adds tension
        var bass = (pos === 7 && bar % 2 === 0) ? r + 1 : (pos === 2 || pos === 6 ? r + 12 : r);
        tone('sawtooth', bass, t, step * 0.8, 0.075);
        // low drone that swells every bar
        if (pos === 0) tone('triangle', r + 12, t, step * 7.5, 0.09);
        // sharp, short melody
        if (BOSS_LEAD[s]) tone('square', BOSS_LEAD[s][0], t, step * BOSS_LEAD[s][1] * 0.6, 0.06);
        // heartbeat: lub-dub
        if (pos === 0) kick(t, 0.22);
        if (pos === 3) kick(t, 0.14);
        // nervous ticking
        hat(t, pos % 2 ? 0.02 : 0.012);
        // alarm stab on the last bar
        if (bar === 7 && (pos === 0 || pos === 4)) tone('sawtooth', 64, t, step * 1.5, 0.05);
      }
    },
    store: {
      bpm: 108, volume: 0.85, duck: 1,
      play: function (s, t, step) {
        var chord = STORE_CHORDS[Math.floor(s / 8)], pos = s % 8;
        // gentle walking bass
        if (pos % 2 === 0) tone('triangle', pos === 2 || pos === 6 ? chord.r + 7 : chord.r, t, step * 1.6, 0.17);
        // little off-beat chord taps
        if (pos === 2 || pos === 6) chord.t.forEach(function (m) { tone('triangle', m, t, step * 0.9, 0.028); });
        // bell-like tune
        if (STORE_LEAD[s]) {
          tone('triangle', STORE_LEAD[s][0], t, step * STORE_LEAD[s][1] * 1.4, 0.11);
          tone('sine', STORE_LEAD[s][0] + 12, t, step * 0.8, 0.025);
        }
        if (pos === 0 || pos === 4) kick(t, 0.09);
        if (pos === 2 || pos === 6) hat(t, 0.02);
      }
    }
  };
  var STEPS = 64;

  /* ---------- player state ---------- */
  var timer = null, nextTime = 0, step = 0;
  var playing = false, started = false, quiet = false;
  var current = 'main';

  function stepLen() { return 60 / TRACKS[current].bpm / 2; }
  function level() { var T = TRACKS[current]; return VOLUME * T.volume * (quiet ? T.duck : 1); }

  function setup() {
    if (ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.2), ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // every song plays through its own volume "bus" so songs can cross-fade
  function newBus() {
    var g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    g.gain.setTargetAtTime(1, ctx.currentTime, 0.12);
    return g;
  }
  function retireBus(b) {
    if (!b) return;
    b.gain.cancelScheduledValues(ctx.currentTime);
    b.gain.setTargetAtTime(0, ctx.currentTime, 0.07);
    setTimeout(function () { try { b.disconnect(); } catch (e) {} }, 1500);
  }

  function pump() {
    if (!playing) return;
    var T = TRACKS[current], len = stepLen();
    while (nextTime < ctx.currentTime + 0.3) {
      T.play(step, nextTime, len);
      nextTime += len;
      step = (step + 1) % STEPS;
    }
    timer = setTimeout(pump, 100);
  }

  function start() {
    if (!setup()) return;
    if (ctx.state !== 'running') { try { ctx.resume(); } catch (e) {} }
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(level(), ctx.currentTime, 0.4);   // fade in
    if (playing) return;
    playing = true;
    bus = newBus();
    step = 0;
    nextTime = ctx.currentTime + 0.05;
    pump();
  }

  function stop() {
    if (!ctx) return;
    playing = false;
    clearTimeout(timer);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.08);        // quick fade out
    retireBus(bus); bus = null;
  }

  function setTrack(name) {
    if (name === current) return;
    current = name;
    if (!ctx || !playing) return;      // it will start from the top when music starts
    retireBus(bus);
    bus = newBus();
    step = 0;
    nextTime = ctx.currentTime + 0.1;
  }

  /* ---------- which song should be playing right now? ---------- */
  function visible(id) {
    var e = document.getElementById(id);
    return !!e && !e.classList.contains('hidden');
  }
  function wantedTrack() {
    if (visible('store-screen')) return 'store';
    if (visible('quiz-screen')) {
      var enemy = document.getElementById('enemy-sprite');
      if (enemy && enemy.classList.contains('boss')) return 'boss';
    }
    return 'main';
  }
  function watch() {
    quiet = visible('quiz-screen');
    setTrack(wantedTrack());
    if (ctx && playing) master.gain.setTargetAtTime(level(), ctx.currentTime, 0.3);
  }

  function soundOn() {
    return typeof bank === 'undefined' || !bank.settings || bank.settings.sound !== false;
  }
  function sync() {
    if (!started) return;
    if (soundOn()) start(); else stop();
  }

  // Browsers only allow sound after a tap / click / key press. Some (Safari,
  // phones) only count certain events, so we listen to all of them and keep
  // trying until the audio is really running.
  var GESTURES = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
  function dropGestures() {
    GESTURES.forEach(function (ev) { document.removeEventListener(ev, unlock, true); });
  }
  function unlock() {
    started = true;
    if (!soundOn()) return;
    watch();
    start();
    if (ctx && ctx.state === 'running') { dropGestures(); return; }
    if (ctx) ctx.resume().then(function () { if (ctx.state === 'running') dropGestures(); }, function () {});
  }
  GESTURES.forEach(function (ev) { document.addEventListener(ev, unlock, true); });

  function init() {
    var btn = document.getElementById('sound-button');
    if (btn) btn.addEventListener('click', function () { started = true; sync(); });
    setInterval(watch, 300);           // checks which screen is open
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  // save battery: pause when the tab is hidden
  document.addEventListener('visibilitychange', function () {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else if (playing) ctx.resume().catch(function () {});
  });

  window.RealmMusic = {
    start: function () { started = true; sync(); },
    stop: stop,
    play: function (name) { if (TRACKS[name]) setTrack(name); },   // for testing: RealmMusic.play('boss')
    status: function () { return { audio: ctx ? ctx.state : 'not created yet', playing: playing, soundOn: soundOn(), song: current }; }
  };
})();
