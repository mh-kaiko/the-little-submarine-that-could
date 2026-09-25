// Synthesised audio: an original 3/4 "underwater waltz" loop + chiptune sound effects.
// Everything is generated with WebAudio, no audio files needed.
const Sound = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let muted = false, musicOn = false, schedTimer = null, nextNoteTime = 0, step = 0;

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // ---------------- music ----------------
  // 3/4 time, 6 eighth-note steps per bar. Chord roots per bar (MIDI), melody per eighth step (MIDI or 0 for rest).
  const BPM = 150;
  const CHORDS = [ // [root, third, fifth] per bar, 16 bars
    [48,52,55],[48,52,55],[53,57,60],[53,57,60],[55,59,62],[55,59,62],[48,52,55],[48,52,55],
    [45,48,52],[45,48,52],[53,57,60],[53,57,60],[55,59,62],[55,59,62],[48,52,55],[48,52,55],
  ];
  const MELODY = [
    72,0,76,0,79,0,   76,0,79,0,84,0,   81,0,79,0,77,0,   76,0,77,0,79,0,
    79,0,77,0,74,0,   71,0,74,0,79,0,   76,0,74,0,72,0,   72,0,0,0,0,0,
    69,0,72,0,76,0,   72,0,76,0,81,0,   77,0,76,0,74,0,   72,0,74,0,77,0,
    79,0,77,0,74,0,   71,0,74,0,79,0,   72,0,0,0,76,0,   72,0,0,0,0,0,
  ];
  const stepDur = () => 60 / BPM / 2; // eighth note

  function tone(freq, t, dur, type, gain, dest) {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
    return o;
  }

  function scheduleStep(s, t) {
    const bar = Math.floor(s / 6) % CHORDS.length;
    const inBar = s % 6;
    const chord = CHORDS[bar];
    const d = stepDur();
    // oom-pah-pah bass: root on beat 1, chord stabs on beats 2 and 3
    if (inBar === 0) tone(midi(chord[0] - 12), t, d * 1.6, 'triangle', 0.5, musicGain);
    else if (inBar === 2 || inBar === 4) {
      chord.forEach(n => tone(midi(n), t, d * 0.9, 'square', 0.06, musicGain));
    }
    // bubbly hi-hat tick
    const noise = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    noise.buffer = buf; const ng = ctx.createGain(); ng.gain.value = inBar === 0 ? 0.12 : 0.05;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    noise.connect(hp); hp.connect(ng); ng.connect(musicGain); noise.start(t);
    // lead
    const m = MELODY[s % MELODY.length];
    if (m) {
      const o = tone(midi(m), t, d * 1.8, 'triangle', 0.35, musicGain);
      // gentle vibrato for the underwater wobble
      const lfo = ctx.createOscillator(); const lg = ctx.createGain();
      lfo.frequency.value = 5.5; lg.gain.value = 4; lfo.connect(lg); lg.connect(o.frequency);
      lfo.start(t); lfo.stop(t + d * 2);
    }
  }

  function scheduler() {
    while (nextNoteTime < ctx.currentTime + 0.2) {
      scheduleStep(step, nextNoteTime);
      nextNoteTime += stepDur();
      step++;
    }
  }

  function startMusic() {
    init(); resume();
    if (musicOn) return;
    musicOn = true; step = 0; nextNoteTime = ctx.currentTime + 0.05;
    schedTimer = setInterval(scheduler, 50);
  }
  function stopMusic() {
    musicOn = false;
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  }
  function setTempoDepth(frac) {
    // deeper = darker: pull the music volume down slightly and low-pass it
    if (!musicGain) return;
    musicGain.gain.value = 0.32 - 0.1 * frac;
  }

  // ---------------- sfx ----------------
  function noiseBurst(t, dur, gain, freq) {
    const src = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
    src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t);
  }
  const sfx = {
    shoot() { const t = ctx.currentTime; const o = tone(880, t, 0.08, 'square', 0.12); o.frequency.exponentialRampToValueAtTime(300, t + 0.08); },
    vortex() { const t = ctx.currentTime; const o = tone(200, t, 0.25, 'sawtooth', 0.15); o.frequency.exponentialRampToValueAtTime(900, t + 0.25); },
    hit() { noiseBurst(ctx.currentTime, 0.06, 0.25, 3000); },
    explode() { const t = ctx.currentTime; noiseBurst(t, 0.35, 0.5, 1200); const o = tone(120, t, 0.3, 'sine', 0.4); o.frequency.exponentialRampToValueAtTime(40, t + 0.3); },
    bigExplode() { const t = ctx.currentTime; for (let i = 0; i < 4; i++) noiseBurst(t + i * 0.12, 0.4, 0.5, 900); const o = tone(90, t, 0.8, 'sine', 0.5); o.frequency.exponentialRampToValueAtTime(30, t + 0.8); },
    hurt() { const t = ctx.currentTime; const o = tone(220, t, 0.25, 'sawtooth', 0.25); o.frequency.exponentialRampToValueAtTime(80, t + 0.25); },
    pickup() { const t = ctx.currentTime; [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.06, 0.12, 'square', 0.12)); },
    powerup() { const t = ctx.currentTime; [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, t + i * 0.05, 0.18, 'triangle', 0.2)); },
    special() { const t = ctx.currentTime; const o = tone(150, t, 0.6, 'sawtooth', 0.3); o.frequency.exponentialRampToValueAtTime(1200, t + 0.5); noiseBurst(t + 0.1, 0.4, 0.3, 2500); },
    denied() { const t = ctx.currentTime; tone(160, t, 0.1, 'square', 0.15); tone(120, t + 0.11, 0.15, 'square', 0.15); },
    select() { const t = ctx.currentTime; tone(660, t, 0.06, 'square', 0.12); },
    gameover() { const t = ctx.currentTime; [523, 494, 466, 440, 415, 392, 370, 349].forEach((f, i) => tone(f, t + i * 0.16, 0.3, 'triangle', 0.3)); },
    win() { const t = ctx.currentTime; [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, t + i * 0.12, 0.3, 'square', 0.15)); },
  };
  function play(name) { if (!ctx || muted) return; resume(); try { sfx[name](); } catch (e) { /* ignore */ } }

  function toggleMute() { init(); muted = !muted; master.gain.value = muted ? 0 : 0.6; return muted; }

  return { init, resume, startMusic, stopMusic, setTempoDepth, play, toggleMute, isMuted: () => muted };
})();
