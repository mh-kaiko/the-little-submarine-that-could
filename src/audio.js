// Synthesised audio: original chiptune level + boss loops and chiptune sound effects.
// Everything is generated with WebAudio, no audio files needed.
const Sound = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let muted = false, musicOn = false, buffers = null, current = null;

  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.32; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.5; sfxGain.connect(master);
    buffers = { level: renderTrack(TRACKS.level), boss: renderTrack(TRACKS.boss) };
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  // ---------------- music ----------------
  // Two original loops in a dark castle-fight mood: 'level' for normal play, 'boss'
  // while a boss is on screen. Each is rendered once into a looping AudioBuffer.
  // chords: one per bar, root + quality (m/M). lead: one string per bar, note/beats.
  // bass: semitone offsets per eighth. arp: indices into (root, 3rd, 5th, octave).
  // drums: 16th-note grids; fill replaces the snare on every 8th bar.
  const TRACKS = {
    level: {
      bpm: 144,
      chords: 'Cm Cm AbM BbM Cm Cm DbM GM Fm Fm Cm Cm AbM BbM DbM GM',
      lead: [
        'C5/1 C5/.5 Eb5/.5 G5/1 F5/.5 Eb5/.5',
        'D5/.5 Eb5/.5 D5/.5 C5/.5 B4/1 G4/1',
        'Ab4/1 C5/.5 Eb5/.5 Ab5/1.5 G5/.5',
        'F5/1 D5/1 Bb4/1 D5/1',
        'C5/.5 G4/.5 C5/.5 Eb5/.5 G5/1 C6/1',
        'B5/.5 C6/.5 G5/1 Eb5/1 C5/1',
        'Db5/1 F5/1 Ab5/1 Db6/1',
        'B5/1.5 Ab5/.5 G5/1 F5/.5 D5/.5',
        'F5/1.5 Ab5/.5 C6/1 Ab5/1',
        'G5/.5 F5/.5 Eb5/.5 F5/.5 C5/2',
        'Eb5/1 G5/1 C6/.5 Bb5/.5 G5/1',
        'Eb5/1 D5/.5 C5/.5 D5/2',
        'C5/.5 Eb5/.5 Ab5/1 G5/.5 Ab5/.5 C6/1',
        'D6/1.5 C6/.5 Bb5/1 F5/1',
        'F5/.5 Ab5/.5 Db6/1 C6/.5 Db6/.5 F6/1',
        'D6/1 B5/1 G5/1 B4/1',
      ],
      bass: [0, 0, 12, 0, 0, 12, 0, 7],
      arpStep: 0.5,
      arp: [0, 1, 2, 1],
      kick: 'x.....x.x.......',
      snare: '....x.......x...',
      hat: 'x.x.x.x.x.x.x.x.',
      fill: '....x...x.x.xxxx',
    },
    boss: {
      bpm: 176,
      chords: 'Cm Cm GbM GbM Cm Cm AbM GM Cm DbM Cm DbM AbM GbM FM GM',
      lead: [
        'C5/.5 C5/.5 C5/.5 Eb5/.5 D5/.5 C5/.5 B4/1',
        'C5/.5 G5/.5 F#5/.5 G5/.5 Eb5/1 C5/1',
        'Gb5/1 Bb5/.5 Db6/.5 C6/.5 Bb5/.5 Gb5/1',
        'F5/.5 Gb5/.5 F5/.5 Eb5/.5 Db5/1 Bb4/1',
        'C6/.5 B5/.5 C6/.5 G5/.5 Eb5/.5 G5/.5 C5/1',
        'Eb5/.5 F5/.5 F#5/.5 G5/.5 Bb5/.5 B5/.5 C6/1',
        'C6/1 Ab5/1 Eb5/1 C5/1',
        'D5/.5 F5/.5 Ab5/.5 B5/.5 D6/1 B5/1',
        'G5/1.5 Eb5/.5 C5/1 G4/1',
        'Ab5/1.5 F5/.5 Db5/1 Ab4/1',
        'G5/.5 Ab5/.5 G5/.5 F5/.5 Eb5/.5 D5/.5 C5/1',
        'Db5/.5 F5/.5 Ab5/.5 Db6/.5 C6/1 Ab5/1',
        'Eb6/1 C6/.5 Ab5/.5 Eb6/1 C6/1',
        'Db6/1 Bb5/.5 Gb5/.5 Db6/1 Bb5/1',
        'C6/.5 A5/.5 F5/.5 A5/.5 C6/.5 Eb6/.5 D6/1',
        'B5/.5 D6/.5 F6/.5 Ab6/.5 G6/2',
      ],
      bass: [0, 12, 0, 12, 0, 12, 0, 12],
      arpStep: 0.25,
      arp: [0, 1, 2, 3, 2, 1],
      kick: 'x...x...x...x.x.',
      snare: '....x.......x...',
      hat: 'xxxxxxxxxxxxxxxx',
      fill: '....x...xxxxxxxx',
    },
  };
  const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
  const TRIADS = { m: [0, 3, 7], M: [0, 4, 7] };
  const RATE = 22050;
  const FADE = 0.6;
  const noteNum = (name) => 12 * (Number(name.slice(-1)) + 1) + NOTE[name.slice(0, -1)];
  const pulse = (duty) => (ph) => (ph % 1 < duty ? 1 : -1);

  function renderTrack(spec) {
    const beat = 60 / spec.bpm, chords = spec.chords.split(' ');
    const buf = new Float32Array(Math.round(chords.length * 4 * beat * RATE));
    // tails past the end wrap to the start, so the loop point is seamless
    const add = (i, v) => { buf[i % buf.length] += v; };
    function note(t0, dur, freq, gain, shape, gate, vibrato) {
      const i0 = Math.round(t0 * RATE), n = Math.floor(dur * gate * RATE);
      const attack = 0.003 * RATE, release = 0.012 * RATE, vibDelay = 0.15 * RATE;
      let ph = 0;
      for (let k = 0; k < n; k++) {
        add(i0 + k, gain * Math.min(1, k / attack, (n - k) / release) * shape(ph));
        const wobble = vibrato && k > vibDelay ? 0.006 * Math.sin(2 * Math.PI * 6 * k / RATE) : 0;
        ph += freq * (1 + wobble) / RATE;
      }
    }
    function kick(t0, gain) {
      const i0 = Math.round(t0 * RATE);
      let ph = 0;
      for (let k = 0; k < 0.14 * RATE; k++) {
        const t = k / RATE;
        ph += (45 + 110 * Math.exp(-t * 30)) / RATE;
        add(i0 + k, gain * Math.exp(-t * 22) * Math.sin(2 * Math.PI * ph));
      }
    }
    function noise(t0, gain, secs, decay, highpass, bodyHz) {
      const i0 = Math.round(t0 * RATE);
      let prev = 0;
      for (let k = 0; k < secs * RATE; k++) {
        const t = k / RATE, x = Math.random() * 2 - 1;
        let s = highpass ? x - prev : x;
        prev = x;
        if (bodyHz) s = 0.7 * s + 0.5 * Math.sin(2 * Math.PI * bodyHz * t);
        add(i0 + k, gain * Math.exp(-t * decay) * s);
      }
    }

    const lead = pulse(0.25), bass = pulse(0.5), arp = pulse(0.125);
    const hatGain = spec.hat.split('x').length - 1 <= 8 ? 0.05 : 0.035;
    chords.forEach((chord, bar) => {
      const barT = bar * 4 * beat;
      let t = barT;
      for (const token of spec.lead[bar].split(' ')) {
        const [name, beats] = token.split('/');
        const dur = Number(beats) * beat;
        note(t, dur, midi(noteNum(name)), 0.22, lead, 0.92, dur >= beat);
        t += dur;
      }
      if (Math.abs(t - barT - 4 * beat) > 1e-9) throw new Error(`lead bar ${bar + 1} is not 4 beats`);

      const root = NOTE[chord.slice(0, -1)];
      spec.bass.forEach((off, i) => note(barT + i * beat / 2, beat / 2, midi(36 + root + off), 0.2, bass, 0.8, false));
      const [, third, fifth] = TRIADS[chord.slice(-1)];
      const tones = [60 + root, 60 + root + third, 60 + root + fifth, 72 + root];
      const step = spec.arpStep * beat;
      for (let i = 0; i < Math.round(4 / spec.arpStep); i++) {
        note(barT + i * step, step, midi(tones[spec.arp[i % spec.arp.length]]), 0.06, arp, 0.6, false);
      }

      const snare = bar % 8 === 7 ? spec.fill : spec.snare;
      for (let i = 0; i < 16; i++) {
        const at = barT + i * beat / 4;
        if (spec.kick[i] === 'x') kick(at, 0.55);
        if (snare[i] === 'x') noise(at, 0.22, 0.14, 25, false, 190);
        if (spec.hat[i] === 'x') noise(at, hatGain, 0.03, 120, true, 0);
      }
    });

    // gentle low-pass, soft clip, normalise
    const a = 1 - Math.exp(-2 * Math.PI * 7000 / RATE);
    let y = 0, peak = 0;
    for (let i = 0; i < buf.length; i++) {
      y += a * (buf[i] - y);
      buf[i] = Math.tanh(1.2 * y);
      peak = Math.max(peak, Math.abs(buf[i]));
    }
    const out = ctx.createBuffer(1, buf.length, RATE);
    const data = out.getChannelData(0), scale = 0.89 / (peak || 1);
    for (let i = 0; i < buf.length; i++) data[i] = buf[i] * scale;
    return out;
  }

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

  function fadeOut(track) {
    const t = ctx.currentTime, g = track.gain.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + FADE);
    track.src.stop(t + FADE + 0.05);
  }
  // Crossfades to the named loop; a no-op when it is already playing or music is off.
  function setTrack(name) {
    if (!musicOn || (current && current.name === name)) return;
    if (current) fadeOut(current);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = buffers[name]; src.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(1, t + FADE);
    src.connect(gain); gain.connect(musicGain); src.start(t);
    current = { name, src, gain };
  }
  function startMusic() {
    init(); resume();
    if (musicOn) return;
    musicOn = true;
    setTrack('level');
  }
  function stopMusic() {
    musicOn = false;
    if (current) { fadeOut(current); current = null; }
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

  return { init, resume, startMusic, stopMusic, setTrack, setTempoDepth, play, toggleMute, isMuted: () => muted };
})();
