// HOY Radio. Plays the tracks uploaded in Studio for the record's genre, shuffled per visit,
// and falls back to a groove synthesised live with WebAudio (ported from the prototype's A,
// PAT, schedule()) that varies per visit and evolves every 8 bars. A module singleton so the
// hero and the now-playing pill share one engine across routes.

import { mediaSrc } from "./api";
import type { EventItem, Track } from "./types";

/** Seeded PRNG (mulberry32), so one visit's seed always gives the same set. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(xs: T[], r: () => number) {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

type Beat = { t: number; k: 0 | 1; bar: boolean; r?: 1 };
export type Style = "afrobeats" | "amapiano" | "afrohouse" | "techno" | "house" | "reggaeton";

export const GENRE: Record<Style, { label: string; bpm: number }> = {
  afrobeats: { label: "Afrobeats", bpm: 104 },
  amapiano: { label: "Amapiano", bpm: 112 },
  afrohouse: { label: "Afrohouse", bpm: 122 },
  techno: { label: "Techno", bpm: 130 },
  house: { label: "House", bpm: 124 },
  reggaeton: { label: "Reggaeton", bpm: 94 },
};

/** Each city's sound. A city without one gets the Lagos palette. */
const PALETTE: Record<string, Style[]> = {
  lagos: ["afrohouse", "afrobeats", "amapiano"],
  valencia: ["techno", "house", "reggaeton"],
};

/** The groove an event's own music style asks for, if the engine has one. */
function pinOf(musicStyle: string): Style | null {
  const s = musicStyle.toLowerCase();
  if (s.includes("amapiano")) return "amapiano";
  if (/afro-?house/.test(s)) return "afrohouse";
  if (/afrobeats|afropop|afro-fusion/.test(s)) return "afrobeats";
  if (s.includes("reggaeton")) return "reggaeton";
  if (s.includes("techno") || /^(deep-)?tech$/.test(s)) return "techno";
  if (s.includes("house")) return "house";
  return null;
}

/** `key` transposes the melodic parts in semitones; `seed` drives the groove's variations. */
export type Groove = { style: Style; bpm: number; label: string; key: number; seed: number };

const KEYS = [-3, -2, -1, 0, 1, 2];

/**
 * One groove per record, from the event's city palette. An event whose own style is in the
 * palette keeps it (and its BPM); the rest take the palette's least-used style, so a city's
 * records cover its whole sound. A non-zero `visit` reshuffles that order and gives each
 * groove its own key, tempo nudge and variations; 0 (the server render) is the plain set.
 */
export function grooves(events: Pick<EventItem, "music_style" | "bpm" | "city">[], visit = 0): Groove[] {
  const r = rng(visit);
  const pal = (e: (typeof events)[number]) => {
    const p = PALETTE[e.city.slug] ?? PALETTE.lagos,
      k = visit % p.length;
    return [...p.slice(k), ...p.slice(0, k)];
  };
  const pinned = events.map((e) => {
    const p = pinOf(e.music_style);
    return p && pal(e).includes(p) ? p : null;
  });
  const used = new Map<Style, number>();
  pinned.forEach((p) => p && used.set(p, (used.get(p) ?? 0) + 1));
  return events.map((e, i) => {
    const seed = visit ? Math.floor(r() * 2 ** 32) : i + 1,
      key = visit ? KEYS[Math.floor(r() * KEYS.length)] : 0,
      nudge = visit ? Math.floor(r() * 5) - 2 : 0;
    const p = pinned[i];
    if (p) return { style: p, bpm: e.bpm || GENRE[p].bpm + nudge, label: GENRE[p].label, key, seed };
    const s = pal(e).reduce((a, b) => ((used.get(b) ?? 0) < (used.get(a) ?? 0) ? b : a));
    used.set(s, (used.get(s) ?? 0) + 1);
    return { style: s, bpm: GENRE[s].bpm + nudge, label: GENRE[s].label, key, seed };
  });
}

export const A = {
  ctx: null as AudioContext | null,
  on: false,
  next: 0,
  step: 0,
  bpm: 104,
  style: "afrobeats" as Style,
  /** Frequency ratio for the groove's key. */
  kf: 1,
  seed: 1,
  /** This section's added hits: [step, voice]. Re-rolled every 8 bars. */
  extra: [] as [number, (t: number) => void][],
  timer: 0 as ReturnType<typeof setInterval> | 0,
  master: null as GainNode | null,
  lp: null as BiquadFilterNode | null,
  noise: null as AudioBuffer | null,
  curve: null as Float32Array<ArrayBuffer> | null,
  beats: [] as Beat[],
  /** The uploaded track on air, or null while the synth plays. */
  track: null as Track | null,
  tracks: [] as Track[],
  city: "",
  visit: 0,
  order: {} as Record<string, { list: Track[]; at: number; round: number }>,
  el: null as HTMLAudioElement | null,
  an: null as AnalyserNode | null,
  bins: null as Uint8Array<ArrayBuffer> | null,
  lvl: 0,
  bars: 0,
};

const listeners = new Set<(on: boolean) => void>();
export const subscribe = (fn: (on: boolean) => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
/** Called with A.on whenever playback starts, stops or the track on air changes. */
const emit = () => listeners.forEach((fn) => fn(A.on));

function audioInit() {
  if (A.ctx) return;
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return;
  const ctx = (A.ctx = new C());
  A.master = ctx.createGain();
  A.master.gain.value = 0.55;
  A.lp = ctx.createBiquadFilter();
  A.lp.type = "lowpass";
  A.lp.frequency.value = 18000;
  A.lp.Q.value = 0.7;
  const comp = ctx.createDynamicsCompressor();
  A.lp.connect(A.master);
  A.master.connect(comp);
  comp.connect(ctx.destination);
  const len = ctx.sampleRate * 0.5,
    b = ctx.createBuffer(1, len, ctx.sampleRate),
    d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  A.noise = b;
  const k = new Float32Array(256);
  for (let i = 0; i < 256; i++) k[i] = Math.tanh((i / 128 - 1) * 3);
  A.curve = k;
}

export function env(t: number, g: GainNode, a: number, dcy: number, peak: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
}
function kick(t: number) {
  const c = A.ctx!,
    o = c.createOscillator(),
    g = c.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  env(t, g, 0.003, 0.32, 1);
  o.connect(g);
  g.connect(A.lp!);
  o.start(t);
  o.stop(t + 0.4);
}
function hat(t: number, v: number, dcy = 0.045) {
  const c = A.ctx!,
    s = c.createBufferSource(),
    f = c.createBiquadFilter(),
    g = c.createGain();
  s.buffer = A.noise;
  f.type = "highpass";
  f.frequency.value = 7500;
  env(t, g, 0.002, dcy, v);
  s.connect(f);
  f.connect(g);
  g.connect(A.lp!);
  s.start(t);
  s.stop(t + dcy + 0.04);
}
function bass(t: number, f0: number, dcy: number) {
  const c = A.ctx!,
    o = c.createOscillator(),
    f = c.createBiquadFilter(),
    g = c.createGain();
  o.type = "sawtooth";
  o.frequency.value = f0;
  f.type = "lowpass";
  f.Q.value = 5;
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(160, t + dcy);
  env(t, g, 0.004, dcy, 0.3);
  o.connect(f);
  f.connect(g);
  g.connect(A.lp!);
  o.start(t);
  o.stop(t + dcy + 0.05);
}
/** A minor-chord organ stab, the house signature. */
function stab(t: number) {
  const c = A.ctx!,
    f = c.createBiquadFilter(),
    g = c.createGain();
  f.type = "lowpass";
  f.frequency.value = 1800;
  env(t, g, 0.003, 0.2, 0.07);
  f.connect(g);
  g.connect(A.lp!);
  [220, 261.63, 329.63].forEach((hz) => {
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = hz * A.kf;
    o.connect(f);
    o.start(t);
    o.stop(t + 0.26);
  });
}
function clap(t: number) {
  [0, 0.011, 0.022].forEach((o, i) => {
    const c = A.ctx!,
      s = c.createBufferSource(),
      f = c.createBiquadFilter(),
      g = c.createGain();
    s.buffer = A.noise;
    f.type = "bandpass";
    f.frequency.value = 1500;
    f.Q.value = 0.9;
    env(t + o, g, 0.002, i === 2 ? 0.16 : 0.02, 0.55);
    s.connect(f);
    f.connect(g);
    g.connect(A.lp!);
    s.start(t + o);
    s.stop(t + o + 0.2);
  });
}
function logdrum(t: number, f0: number) {
  const c = A.ctx!,
    o = c.createOscillator(),
    ws = c.createWaveShaper(),
    g = c.createGain();
  ws.curve = A.curve;
  o.type = "sine";
  o.frequency.setValueAtTime(f0 * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(f0, t + 0.06);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.82, t + 0.4);
  env(t, g, 0.004, 0.42, 0.5);
  o.connect(ws);
  ws.connect(g);
  g.connect(A.lp!);
  o.start(t);
  o.stop(t + 0.5);
}
function conga(t: number, f: number) {
  const c = A.ctx!,
    o = c.createOscillator(),
    g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f * 1.5, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  env(t, g, 0.002, 0.16, 0.38);
  o.connect(g);
  g.connect(A.lp!);
  o.start(t);
  o.stop(t + 0.22);
}
function bell(t: number) {
  const c = A.ctx!,
    o = c.createOscillator(),
    o2 = c.createOscillator(),
    g = c.createGain();
  o.type = "square";
  o2.type = "square";
  o.frequency.value = 840 * A.kf;
  o2.frequency.value = 1260 * A.kf;
  env(t, g, 0.002, 0.09, 0.05);
  o.connect(g);
  o2.connect(g);
  g.connect(A.lp!);
  o.start(t);
  o2.start(t);
  o.stop(t + 0.12);
  o2.stop(t + 0.12);
}

/**
 * One bar of 16ths. k kick, c clap/snare, h hat, hs soft hat, oh open hat, cg conga, ld log
 * drum, bl bell, bs bass [step, Hz], bd bass decay, st chord stab, sw swing (0 is straight).
 */
type Pat = {
  k: number[];
  c: number[];
  h: number[];
  hs: number[];
  oh?: number[];
  cg?: [number, number][];
  ld?: [number, number][];
  bl?: number[];
  bs?: [number, number][];
  bd?: number;
  st?: number[];
  sw: number;
};
const ALL = [...Array(16).keys()];
export const PAT: Record<Style, Pat> = {
  afrobeats: { k: [0, 7, 10], c: [4, 12], h: [2, 6, 10, 14], hs: [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15], cg: [[3, 220], [5, 165], [11, 220], [13, 165], [14, 196]], bl: [0, 3, 6, 10, 12], sw: 0.08 },
  amapiano: { k: [0, 4, 8, 12], c: [4, 12], h: [2, 6, 10, 14], hs: [1, 3, 5, 7, 9, 11, 13, 15], ld: [[3, 55], [6, 49], [10, 55], [11, 62], [14, 46]], sw: 0.08 },
  afrohouse: { k: [0, 4, 8, 12], c: [4, 12], h: [], hs: [1, 3, 5, 7, 9, 11, 13, 15], oh: [2, 6, 10, 14], cg: [[3, 196], [6, 247], [7, 196], [11, 165], [14, 247]], bl: [0, 6, 10], bs: [[3, 55], [11, 49]], bd: 0.22, sw: 0.05 },
  techno: { k: [0, 4, 8, 12], c: [4, 12], h: [], hs: ALL, oh: [2, 6, 10, 14], bs: ALL.filter((s) => s % 4).map((s) => [s, 55] as [number, number]), bd: 0.09, sw: 0 },
  house: { k: [0, 4, 8, 12], c: [4, 12], h: [], hs: [1, 3, 5, 7, 9, 11, 13, 15], oh: [2, 6, 10, 14], bs: [[2, 55], [6, 55], [10, 65.41], [14, 49]], bd: 0.16, st: [3, 10], sw: 0.03 },
  reggaeton: { k: [0, 4, 8, 12], c: [3, 6, 11, 14], h: [0, 2, 4, 6, 8, 10, 12, 14], hs: [], bs: [[0, 49], [8, 49]], bd: 0.36, sw: 0 },
};

/** Hits the style's own voice can add on top of its bar, for a section's variation. */
const VOICE: Record<Style, (r: () => number) => (t: number) => void> = {
  afrobeats: (r) => {
    const f = [165, 196, 220, 247][Math.floor(r() * 4)];
    return (t) => conga(t, f * A.kf);
  },
  amapiano: (r) => {
    const f = [46, 49, 55, 62][Math.floor(r() * 4)];
    return (t) => logdrum(t, f * A.kf);
  },
  afrohouse: (r) => (r() < 0.5 ? (t) => bell(t) : (t) => conga(t, 196 * A.kf)),
  techno: (r) => (r() < 0.5 ? (t) => hat(t, 0.13, 0.12) : (t) => bass(t, 82.41 * A.kf, 0.07)),
  house: (r) => (r() < 0.6 ? (t) => stab(t) : (t) => hat(t, 0.15, 0.2)),
  reggaeton: (r) => (r() < 0.5 ? (t) => conga(t, 220 * A.kf) : (t) => hat(t, 0.1)),
};

/** Section n's extra hits: two or three of the style's voice on steps the bar leaves free. */
function section(n: number) {
  const r = rng(A.seed + n * 7919),
    P = PAT[A.style],
    busy = new Set([...P.k, ...P.c]);
  const free = ALL.filter((s) => !busy.has(s));
  return shuffle(free, r)
    .slice(0, 2 + Math.floor(r() * 2))
    .map((s) => [s, VOICE[A.style](r)] as [number, (t: number) => void]);
}

function schedule() {
  const ctx = A.ctx!,
    spb = 60 / A.bpm / 4;
  while (A.next < ctx.currentTime + 0.12) {
    const s = A.step % 16,
      bar = Math.floor(A.step / 16),
      sec = Math.floor(bar / 8),
      t = A.next,
      P = PAT[A.style];
    if (s === 0 && bar % 8 === 0) A.extra = section(sec);
    // Every fourth section opens on two bars without kick and bass; every section's last bar fills.
    const drop = sec % 4 === 3 && bar % 8 < 2,
      fill = bar % 8 === 7 && s >= 12;
    if (P.k.includes(s) && !drop) {
      kick(t);
      A.beats.push({ t, k: 1, bar: s === 0 });
    } else if (s % 4 === 0) A.beats.push({ t, k: 0, bar: s === 0 });
    if (P.c.includes(s) || (fill && s % 2)) clap(t);
    if (P.h.includes(s)) hat(t, 0.22);
    if (P.hs.includes(s) || fill) hat(t, 0.07);
    if (P.oh?.includes(s)) hat(t, 0.15, 0.2);
    P.cg?.forEach(([st, f]) => {
      if (st === s) conga(t, f * A.kf);
    });
    P.ld?.forEach(([st, f]) => {
      if (st === s) logdrum(t, f * A.kf);
    });
    if (!drop)
      P.bs?.forEach(([st, f]) => {
        if (st === s) bass(t, f * A.kf, P.bd ?? 0.15);
      });
    if (P.bl?.includes(s)) bell(t);
    if (P.st?.includes(s)) stab(t);
    if (!fill) A.extra.forEach(([st, v]) => st === s && v(t));
    A.next += spb * (s % 2 ? 1 - P.sw : 1 + P.sw);
    A.step++;
  }
}

/** The next uploaded track for a genre in this city, in this visit's shuffled order. */
function nextTrack(style: Style) {
  const key = `${A.city}:${style}`;
  let o = A.order[key];
  if (!o) {
    const list = A.tracks.filter((t) => t.genre === style && (!t.city || t.city === A.city));
    o = A.order[key] = { list: shuffle(list, rng(A.visit + list.length)), at: 0, round: 0 };
  }
  if (!o.list.length) return null;
  if (o.at >= o.list.length) {
    o.round++;
    o.list = shuffle(o.list, rng(A.visit + o.round * 104729));
    o.at = 0;
  }
  return o.list[o.at++];
}

function startSynth() {
  const ctx = A.ctx!;
  A.next = ctx.currentTime + 0.08;
  A.step = 0;
  A.beats = [];
  clearInterval(A.timer);
  A.timer = setInterval(schedule, 25);
  schedule();
}

function startTrack(t: Track) {
  const ctx = A.ctx!;
  if (!A.el) {
    const el = (A.el = new Audio());
    el.crossOrigin = "anonymous";
    el.preload = "auto";
    const src = ctx.createMediaElementSource(el);
    A.an = ctx.createAnalyser();
    A.an.fftSize = 512;
    A.bins = new Uint8Array(A.an.frequencyBinCount);
    src.connect(A.lp!);
    src.connect(A.an);
    el.addEventListener("ended", () => A.on && A.track && tune(A.style));
    el.addEventListener("error", () => {
      if (!A.on || !A.track) return;
      // An unplayable file drops out of this visit's rotation.
      const bad = A.track;
      Object.values(A.order).forEach((o) => (o.list = o.list.filter((x) => x !== bad)));
      tune(A.style);
    });
  }
  clearInterval(A.timer);
  A.track = t;
  A.bars = 0;
  A.el.src = mediaSrc(t.url) ?? t.url;
  A.el.play().catch(() => {});
}

/** Puts a genre on air: its next uploaded track if it has one, otherwise the synth. */
function tune(style: Style) {
  A.style = style;
  const t = nextTrack(style);
  if (t) startTrack(t);
  else {
    A.el?.pause();
    A.track = null;
    startSynth();
  }
  emit();
}

function set(g: Groove, city: string) {
  A.bpm = g.bpm;
  A.kf = 2 ** (g.key / 12);
  A.seed = g.seed;
  if (city !== A.city) A.order = {};
  A.city = city;
}

/**
 * Starts HOY Radio on a record's groove. Must be called from a user gesture (browsers block
 * audio otherwise). `visit` seeds the track order, so each visit hears a new running order.
 */
export function play(g: Groove, city: string, tracks: Track[], visit: number) {
  audioInit();
  if (!A.ctx) return;
  A.ctx.resume();
  if (tracks !== A.tracks || visit !== A.visit) A.order = {};
  A.tracks = tracks;
  A.visit = visit;
  set(g, city);
  A.on = true;
  A.master!.gain.cancelScheduledValues(A.ctx.currentTime);
  A.master!.gain.setTargetAtTime(0.55, A.ctx.currentTime, 0.05);
  tune(g.style);
}

export function stop() {
  if (!A.ctx) return;
  A.on = false;
  clearInterval(A.timer);
  A.master!.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.08);
  const el = A.el;
  if (el) setTimeout(() => !A.on && el.pause(), 300);
  emit();
}

/** A record change while on air. A new genre (or city) changes the music; the same keeps the track. */
export function retune(g: Groove, city: string) {
  if (!A.on) return;
  const same = g.style === A.style && city === A.city;
  set(g, city);
  if (!(same && A.track)) tune(g.style);
}

/** Hold to muffle: low-pass down while the record is held, back up on release. */
export function muffle(held: boolean) {
  if (A.on && A.lp && A.ctx) A.lp.frequency.setTargetAtTime(held ? 420 : 18000, A.ctx.currentTime, held ? 0.04 : 0.12);
}

/** Scratch noise burst while dragging, scaled by the angle moved this event. */
export function scratch(d: number) {
  if (!(A.on && A.ctx && A.noise && A.master) || Math.abs(d) <= 1.5) return;
  const c = A.ctx,
    s = c.createBufferSource(),
    f = c.createBiquadFilter(),
    g = c.createGain();
  s.buffer = A.noise;
  s.playbackRate.value = Math.min(4, 0.4 + Math.abs(d) / 6);
  f.type = "bandpass";
  f.frequency.value = 600 + Math.min(2600, Math.abs(d) * 90);
  f.Q.value = 4;
  env(c.currentTime, g, 0.003, 0.06, 0.35);
  s.connect(f);
  f.connect(g);
  g.connect(A.master);
  s.start();
  s.stop(c.currentTime + 0.09);
}

/** Beat envelope 0..1 for the visuals. Idle: a soft pulse at the record's tempo. */
export function beatEnv(now: number, idleBpm: number) {
  if (A.on && A.track && A.an && A.bins) {
    // A track: low-end energy above its running average, so kicks pulse the visuals.
    A.an.getByteFrequencyData(A.bins);
    let v = 0;
    for (let i = 1; i < 7; i++) v += A.bins[i];
    v /= 6;
    A.lvl += (v - A.lvl) * 0.06;
    return Math.max(0, Math.min(1, (v - A.lvl) / 28));
  }
  if (A.on && A.ctx) {
    const at = A.ctx.currentTime;
    while (A.beats.length && A.beats[0].t < at - 1) A.beats.shift();
    let e = 0;
    for (const b of A.beats) {
      const dt = at - b.t;
      if (dt >= 0 && dt < 0.6) e = Math.max(e, (b.k ? 1 : 0.45) * Math.exp(-dt * 7));
    }
    return e;
  }
  const ph = ((now / 1000) * idleBpm) / 60 % 1;
  return 0.35 * Math.exp(-ph * 5);
}

/** Bar starts that have just sounded (each reported once), for the ripple. */
export function dueBars() {
  if (!(A.on && A.ctx)) return 0;
  if (A.track && A.el) {
    const bars = Math.floor((A.el.currentTime * A.bpm) / 240),
      n = Math.max(0, bars - A.bars);
    A.bars = bars;
    return Math.min(n, 1);
  }
  let n = 0;
  for (const b of A.beats) {
    if (b.bar && !b.r && b.t <= A.ctx.currentTime) {
      b.r = 1;
      n++;
    }
  }
  return n;
}
