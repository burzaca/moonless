// MOONLESS — procedural sound effects. Pure WebAudio synthesis, no assets.
// Safe to import in Node: the AudioContext is created lazily on first use and
// every entry point is guarded, so missing WebAudio simply makes SFX a no-op.

import { mulberry32 } from './rng.js';

const MASTER_VOL = 0.5;
const AMBIENT_VOL = 0.035;

let ctx = null;          // AudioContext, created lazily
let ctxFailed = false;   // creation attempted and failed -> stay silent
let master = null;       // master GainNode
let noiseBuf = null;     // 2s of white noise, cached
let enabled = true;
let ambient = null;      // { nodes, gain } while the drone is running
let ambientWanted = false;
const lastPlayed = Object.create(null);

// Deterministic jitter source (audio never touches gameplay RNG).
const jitterRng = mulberry32(0x5f3759df);
const jitter = (amt) => 1 + (jitterRng() * 2 - 1) * amt;

function getCtx() {
  if (ctx || ctxFailed) return ctx;
  try {
    const AC = typeof globalThis !== 'undefined'
      ? (globalThis.AudioContext || globalThis.webkitAudioContext)
      : undefined;
    if (typeof AC !== 'function') { ctxFailed = true; return null; }
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? MASTER_VOL : 0;
    // Gentle compression keeps stacked hits from clipping.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    master.connect(comp);
    comp.connect(ctx.destination);
  } catch (e) {
    ctx = null;
    master = null;
    ctxFailed = true;
  }
  return ctx;
}

function ready() {
  const c = getCtx();
  if (!c) return null;
  try { if (c.state === 'suspended' && c.resume) c.resume().catch(() => {}); } catch (e) { /* ignore */ }
  return c;
}

function getNoise(c) {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(c.sampleRate * 2);
  noiseBuf = c.createBuffer(1, len, c.sampleRate);
  const data = noiseBuf.getChannelData(0);
  const r = mulberry32(1337);
  for (let i = 0; i < len; i++) data[i] = r() * 2 - 1;
  return noiseBuf;
}

// Attack/decay envelope on a GainNode. Exponential ramps can't hit 0.
function envelope(g, t, peak, attack, decay, hold = 0) {
  const p = g.gain;
  p.cancelScheduledValues(t);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + attack);
  if (hold > 0) p.setValueAtTime(peak, t + attack + hold);
  p.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
  return t + attack + hold + decay;
}

/**
 * Oscillator voice.
 * o: { type, freq, to, dur, vol, attack, delay, detune, filter:{type,freq,q,to}, dest }
 */
function tone(c, o) {
  const t = c.currentTime + (o.delay || 0);
  const attack = o.attack ?? 0.005;
  const dur = o.dur ?? 0.15;
  const osc = c.createOscillator();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + attack + dur);
  if (o.detune) osc.detune.setValueAtTime(o.detune, t);
  const g = c.createGain();
  let head = osc;
  if (o.filter) {
    const f = c.createBiquadFilter();
    f.type = o.filter.type || 'lowpass';
    f.frequency.setValueAtTime(o.filter.freq, t);
    if (o.filter.to) f.frequency.exponentialRampToValueAtTime(Math.max(1, o.filter.to), t + attack + dur);
    f.Q.value = o.filter.q ?? 1;
    osc.connect(f);
    head = f;
  }
  head.connect(g);
  g.connect(o.dest || master);
  const end = envelope(g, t, o.vol ?? 0.3, attack, dur, o.hold || 0);
  osc.start(t);
  osc.stop(end + 0.05);
  return osc;
}

/**
 * Filtered noise burst.
 * o: { dur, vol, attack, delay, type, freq, to, q, rate, dest }
 */
function noise(c, o) {
  const t = c.currentTime + (o.delay || 0);
  const attack = o.attack ?? 0.003;
  const dur = o.dur ?? 0.1;
  const src = c.createBufferSource();
  src.buffer = getNoise(c);
  src.loop = true;
  if (o.rate) src.playbackRate.value = o.rate;
  const f = c.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + attack + dur);
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  src.connect(f);
  f.connect(g);
  g.connect(o.dest || master);
  const end = envelope(g, t, o.vol ?? 0.3, attack, dur, o.hold || 0);
  // Random offset into the buffer so repeated bursts don't sound identical.
  src.start(t, jitterRng() * 1.5);
  src.stop(end + 0.05);
  return src;
}

// Minimum seconds between repeats, to keep rapid-fire events from smearing.
const THROTTLE = { step: 0.07, burn: 0.05, hit: 0.03, kindling: 0.04, ui_click: 0.02 };

const SOUNDS = {
  // Soft footfall: short low thump plus a dry scuff.
  step(c) {
    noise(c, { type: 'lowpass', freq: 500 * jitter(0.2), dur: 0.06, vol: 0.12 });
    tone(c, { type: 'sine', freq: 90 * jitter(0.1), to: 50, dur: 0.05, vol: 0.08 });
  },

  // Bright two-note chime with a sparkling overtone.
  pickup(c) {
    const base = 880 * jitter(0.02);
    tone(c, { type: 'triangle', freq: base, dur: 0.18, vol: 0.18 });
    tone(c, { type: 'triangle', freq: base * 1.5, dur: 0.3, vol: 0.16, delay: 0.07 });
    tone(c, { type: 'sine', freq: base * 3, dur: 0.25, vol: 0.05, delay: 0.07 });
  },

  // Fire crackle: highpassed noise body with a scatter of tiny pops.
  burn(c) {
    noise(c, { type: 'bandpass', freq: 2200 * jitter(0.3), q: 0.8, dur: 0.12, vol: 0.12 });
    for (let i = 0; i < 4; i++) {
      noise(c, {
        type: 'highpass', freq: 3000 + jitterRng() * 3000, q: 2,
        dur: 0.015, vol: 0.08 + jitterRng() * 0.08, delay: jitterRng() * 0.12,
      });
    }
  },

  // Dealing damage: punchy noise smack over a falling square blip.
  hit(c) {
    noise(c, { type: 'bandpass', freq: 1400 * jitter(0.15), q: 1.2, dur: 0.07, vol: 0.22 });
    tone(c, { type: 'square', freq: 260 * jitter(0.08), to: 110, dur: 0.08, vol: 0.08,
      filter: { type: 'lowpass', freq: 1800 } });
  },

  // Taking damage: dissonant downward sawtooth pair, muffled.
  hurt(c) {
    tone(c, { type: 'sawtooth', freq: 220, to: 90, dur: 0.25, vol: 0.18,
      filter: { type: 'lowpass', freq: 1200, to: 300 } });
    tone(c, { type: 'sawtooth', freq: 233, to: 85, dur: 0.25, vol: 0.12,
      filter: { type: 'lowpass', freq: 1200, to: 300 } });
    noise(c, { type: 'lowpass', freq: 700, dur: 0.12, vol: 0.12 });
  },

  // Lantern flash: rising whoosh into a bright shimmering burst.
  flash(c) {
    noise(c, { type: 'bandpass', freq: 600, to: 6000, q: 1.5, attack: 0.08, dur: 0.35, vol: 0.2 });
    tone(c, { type: 'sine', freq: 1200, to: 2400, dur: 0.3, vol: 0.1, attack: 0.04 });
    tone(c, { type: 'triangle', freq: 1800, dur: 0.4, vol: 0.06, delay: 0.08, detune: 12 });
  },

  // Beacon placed: heavy metal-on-stone thunk, then fire catching.
  beacon_place(c) {
    tone(c, { type: 'sine', freq: 140, to: 60, dur: 0.3, vol: 0.3 });
    tone(c, { type: 'triangle', freq: 523, dur: 0.6, vol: 0.06, delay: 0.02 });
    noise(c, { type: 'lowpass', freq: 400, dur: 0.12, vol: 0.2 });
    noise(c, { type: 'bandpass', freq: 1200, to: 3000, q: 0.7, attack: 0.15, dur: 0.5, vol: 0.1, delay: 0.1 });
  },

  // Menu tick.
  ui_click(c) {
    tone(c, { type: 'square', freq: 1500, dur: 0.025, vol: 0.06,
      filter: { type: 'lowpass', freq: 4000 } });
  },

  // Panel open: soft upward two-tone.
  ui_open(c) {
    tone(c, { type: 'triangle', freq: 440, to: 660, dur: 0.12, vol: 0.1 });
    tone(c, { type: 'sine', freq: 880, dur: 0.15, vol: 0.05, delay: 0.06 });
  },

  // NPC awakens: slow arpeggiated minor-to-major bloom with a breathy pad.
  npc_awaken(c) {
    const notes = [261.6, 311.1, 392.0, 523.3, 659.3];
    notes.forEach((f, i) => {
      tone(c, { type: 'triangle', freq: f, dur: 0.9, vol: 0.09, attack: 0.03, delay: i * 0.12 });
    });
    noise(c, { type: 'bandpass', freq: 900, q: 3, attack: 0.4, dur: 0.9, vol: 0.05 });
  },

  // Kindling gained: tiny high sparkle tick.
  kindling(c) {
    tone(c, { type: 'sine', freq: 2093 * jitter(0.05), dur: 0.08, vol: 0.08 });
    tone(c, { type: 'sine', freq: 3136 * jitter(0.05), dur: 0.1, vol: 0.05, delay: 0.03 });
    noise(c, { type: 'highpass', freq: 6000, dur: 0.02, vol: 0.04 });
  },

  // King roar: low detuned sawtooth growl with tremolo and a rumbling noise bed.
  boss_roar(c) {
    const t = c.currentTime;
    const bus = c.createGain();
    bus.gain.value = 1;
    // Tremolo for the growl texture.
    const lfo = c.createOscillator();
    const lfoAmt = c.createGain();
    lfo.frequency.value = 18;
    lfoAmt.gain.value = 0.45;
    lfo.connect(lfoAmt);
    lfoAmt.connect(bus.gain);
    bus.connect(master);
    lfo.start(t);
    lfo.stop(t + 1.8);
    const filt = { type: 'lowpass', freq: 900, to: 200, q: 4 };
    for (const det of [-25, 0, 19]) {
      tone(c, { type: 'sawtooth', freq: 62, to: 38, detune: det, attack: 0.15, hold: 0.4,
        dur: 1.1, vol: 0.18, filter: filt, dest: bus });
    }
    tone(c, { type: 'square', freq: 31, to: 22, attack: 0.2, hold: 0.3, dur: 1.0, vol: 0.1,
      filter: { type: 'lowpass', freq: 200 }, dest: bus });
    noise(c, { type: 'lowpass', freq: 300, to: 120, attack: 0.1, hold: 0.4, dur: 1.0, vol: 0.25, dest: bus });
  },

  // Tide warning: slow ominous swell, low and wide, rising then receding.
  tide_warn(c) {
    for (const [f, det] of [[73.4, -8], [110, 6], [146.8, 0]]) {
      tone(c, { type: 'sawtooth', freq: f, detune: det, attack: 1.4, hold: 0.4, dur: 1.6,
        vol: 0.09, filter: { type: 'lowpass', freq: 200, to: 900, q: 2 } });
    }
    noise(c, { type: 'bandpass', freq: 250, to: 700, q: 0.8, attack: 1.6, dur: 1.4, vol: 0.12 });
  },

  // Death: lantern gutters out — descending tones and a final breath of noise.
  death(c) {
    tone(c, { type: 'triangle', freq: 392, to: 98, dur: 1.4, vol: 0.18, attack: 0.02 });
    tone(c, { type: 'sine', freq: 311.1, to: 73, dur: 1.6, vol: 0.14, delay: 0.15 });
    tone(c, { type: 'sawtooth', freq: 196, to: 49, dur: 1.8, vol: 0.06, delay: 0.3,
      filter: { type: 'lowpass', freq: 800, to: 120 } });
    noise(c, { type: 'lowpass', freq: 1500, to: 200, attack: 0.05, dur: 1.2, vol: 0.12, delay: 0.5 });
  },

  // Upgrade bought: warm ascending major triad with a bell top.
  upgrade(c) {
    [523.3, 659.3, 784.0, 1046.5].forEach((f, i) => {
      tone(c, { type: 'triangle', freq: f, dur: 0.45, vol: 0.12, delay: i * 0.08 });
    });
    tone(c, { type: 'sine', freq: 2093, dur: 0.8, vol: 0.05, delay: 0.32 });
  },

  // Rendering tallow in the cauldron: bubbling blips over a low simmer.
  render_tallow(c) {
    noise(c, { type: 'lowpass', freq: 350, attack: 0.1, hold: 0.3, dur: 0.4, vol: 0.12 });
    for (let i = 0; i < 6; i++) {
      const f = 180 + jitterRng() * 260;
      tone(c, { type: 'sine', freq: f, to: f * 1.8, dur: 0.06, vol: 0.1, delay: 0.05 + i * 0.11 + jitterRng() * 0.04 });
    }
  },
};

function buildAmbient(c) {
  const t = c.currentTime;
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(AMBIENT_VOL, t + 4);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  filter.Q.value = 3;
  filter.connect(gain);
  gain.connect(master);

  const nodes = [];
  // Detuned low drone: root, fifth, and a sub — slowly beating against each other.
  for (const [f, type, det] of [[55, 'sawtooth', -7], [55, 'sawtooth', 6], [82.4, 'triangle', 3], [27.5, 'sine', 0]]) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = det;
    o.connect(filter);
    o.start(t);
    nodes.push(o);
  }
  // Very slow filter sweep so the drone breathes.
  const lfo = c.createOscillator();
  const lfoAmt = c.createGain();
  lfo.frequency.value = 0.05;
  lfoAmt.gain.value = 160;
  lfo.connect(lfoAmt);
  lfoAmt.connect(filter.frequency);
  lfo.start(t);
  nodes.push(lfo);
  // Faint wind: looped noise through a narrow band.
  const wind = c.createBufferSource();
  wind.buffer = getNoise(c);
  wind.loop = true;
  const wf = c.createBiquadFilter();
  wf.type = 'bandpass';
  wf.frequency.value = 500;
  wf.Q.value = 6;
  const wg = c.createGain();
  wg.gain.value = 0.35;
  wind.connect(wf);
  wf.connect(wg);
  wg.connect(gain);
  wind.start(t);
  nodes.push(wind);

  return { nodes, gain };
}

function teardownAmbient() {
  if (!ambient || !ctx) { ambient = null; return; }
  const { nodes, gain } = ambient;
  ambient = null;
  try {
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    for (const n of nodes) { try { n.stop(t + 1.6); } catch (e) { /* already stopped */ } }
  } catch (e) { /* ignore */ }
}

export const SFX = {
  play(name) {
    if (!enabled || typeof name !== 'string') return;
    const fn = Object.prototype.hasOwnProperty.call(SOUNDS, name) ? SOUNDS[name] : null;
    if (!fn) return;
    try {
      const c = ready();
      if (!c || !master) return;
      const gap = THROTTLE[name];
      if (gap) {
        const prev = lastPlayed[name];
        if (prev !== undefined && c.currentTime - prev < gap) return;
        lastPlayed[name] = c.currentTime;
      }
      fn(c);
    } catch (e) { /* never let audio break the game */ }
  },

  setEnabled(on) {
    enabled = !!on;
    try {
      if (ctx && master) {
        const t = ctx.currentTime;
        master.gain.cancelScheduledValues(t);
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(enabled ? MASTER_VOL : 0, t + 0.1);
      }
      if (enabled && ambientWanted && !ambient) SFX.startAmbient();
      if (!enabled && ambient) teardownAmbient();
    } catch (e) { /* ignore */ }
  },

  isEnabled() {
    return enabled;
  },

  startAmbient() {
    ambientWanted = true;
    if (!enabled || ambient) return;
    try {
      const c = ready();
      if (!c || !master) return;
      ambient = buildAmbient(c);
    } catch (e) { ambient = null; }
  },

  stopAmbient() {
    ambientWanted = false;
    try { teardownAmbient(); } catch (e) { ambient = null; }
  },
};

export default SFX;
