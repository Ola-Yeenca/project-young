// HOY Radio. Plays the tracks uploaded in Studio for the record's genre (any track on air in the
// city when its genre has none), shuffled per visit, and falls back to a groove synthesised with
// WebAudio (ported from the prototype's A, PAT, schedule()) that varies per visit and evolves
// every 8 bars. Both play through the deck (public/deck-worklet.js), which reads the music at
// the platter's speed, so a hand on the record scratches it. A module singleton so the hero and
// the now-playing pill share one engine across routes.

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

/** What a record plays: a rotation of tracks (`key` names it), or none for its synth groove. */
type Pool = { key: string; list: Track[] };

export const A = {
  ctx: null as AudioContext | null,
  on: false,
  bpm: 104,
  style: "afrobeats" as Style,
  /** Frequency ratio for the groove's key. */
  kf: 1,
  seed: 1,
  /** The uploaded track on air, or null while the synth plays. */
  track: null as Track | null,
  tracks: [] as Track[],
  /** Files that failed to load this visit. */
  bad: new Set<string>(),
  city: "",
  visit: 0,
  order: {} as Record<string, { list: Track[]; at: number; round: number }>,
  /** The rotation on air, and the music under the needle (a track's URL or the pool key). */
  pool: "",
  src: "",
  /** Bumped by every tune(), so a load that finishes late knows it was overtaken. */
  load: 0,
  deck: null as AudioWorkletNode | null,
  held: false,
  /** The deck's last report: seconds into the music, speed, context time, length in seconds. */
  at: { p: 0, v: 0, t: 0, len: 0 },
  bar: -1,
  an: null as AnalyserNode | null,
  bins: null as Uint8Array<ArrayBuffer> | null,
  lvl: 0,
};

const listeners = new Set<(on: boolean) => void>();
export const subscribe = (fn: (on: boolean) => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
/** Called with A.on whenever playback starts, stops or the track on air changes. */
const emit = () => listeners.forEach((fn) => fn(A.on));

/* ---- the synth's voices. They play into `rc`, the OfflineAudioContext rendering a loop. ---- */

let rc!: BaseAudioContext;
let noise!: AudioBuffer;
let curve!: Float32Array<ArrayBuffer>;
const out = () => rc.destination;

export function env(t: number, g: GainNode, a: number, dcy: number, peak: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dcy);
}
function kick(t: number) {
  const o = rc.createOscillator(),
    g = rc.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
  env(t, g, 0.003, 0.32, 1);
  o.connect(g);
  g.connect(out());
  o.start(t);
  o.stop(t + 0.4);
}
function hat(t: number, v: number, dcy = 0.045) {
  const s = rc.createBufferSource(),
    f = rc.createBiquadFilter(),
    g = rc.createGain();
  s.buffer = noise;
  f.type = "highpass";
  f.frequency.value = 7500;
  env(t, g, 0.002, dcy, v);
  s.connect(f);
  f.connect(g);
  g.connect(out());
  s.start(t);
  s.stop(t + dcy + 0.04);
}
function bass(t: number, f0: number, dcy: number) {
  const o = rc.createOscillator(),
    f = rc.createBiquadFilter(),
    g = rc.createGain();
  o.type = "sawtooth";
  o.frequency.value = f0;
  f.type = "lowpass";
  f.Q.value = 5;
  f.frequency.setValueAtTime(900, t);
  f.frequency.exponentialRampToValueAtTime(160, t + dcy);
  env(t, g, 0.004, dcy, 0.3);
  o.connect(f);
  f.connect(g);
  g.connect(out());
  o.start(t);
  o.stop(t + dcy + 0.05);
}
/** A minor-chord organ stab, the house signature. */
function stab(t: number) {
  const f = rc.createBiquadFilter(),
    g = rc.createGain();
  f.type = "lowpass";
  f.frequency.value = 1800;
  env(t, g, 0.003, 0.2, 0.07);
  f.connect(g);
  g.connect(out());
  [220, 261.63, 329.63].forEach((hz) => {
    const o = rc.createOscillator();
    o.type = "square";
    o.frequency.value = hz * A.kf;
    o.connect(f);
    o.start(t);
    o.stop(t + 0.26);
  });
}
function clap(t: number) {
  [0, 0.011, 0.022].forEach((o, i) => {
    const s = rc.createBufferSource(),
      f = rc.createBiquadFilter(),
      g = rc.createGain();
    s.buffer = noise;
    f.type = "bandpass";
    f.frequency.value = 1500;
    f.Q.value = 0.9;
    env(t + o, g, 0.002, i === 2 ? 0.16 : 0.02, 0.55);
    s.connect(f);
    f.connect(g);
    g.connect(out());
    s.start(t + o);
    s.stop(t + o + 0.2);
  });
}
function logdrum(t: number, f0: number) {
  const o = rc.createOscillator(),
    ws = rc.createWaveShaper(),
    g = rc.createGain();
  ws.curve = curve;
  o.type = "sine";
  o.frequency.setValueAtTime(f0 * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(f0, t + 0.06);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.82, t + 0.4);
  env(t, g, 0.004, 0.42, 0.5);
  o.connect(ws);
  ws.connect(g);
  g.connect(out());
  o.start(t);
  o.stop(t + 0.5);
}
function conga(t: number, f: number) {
  const o = rc.createOscillator(),
    g = rc.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(f * 1.5, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
  env(t, g, 0.002, 0.16, 0.38);
  o.connect(g);
  g.connect(out());
  o.start(t);
  o.stop(t + 0.22);
}
function bell(t: number) {
  const o = rc.createOscillator(),
    o2 = rc.createOscillator(),
    g = rc.createGain();
  o.type = "square";
  o2.type = "square";
  o.frequency.value = 840 * A.kf;
  o2.frequency.value = 1260 * A.kf;
  env(t, g, 0.002, 0.09, 0.05);
  o.connect(g);
  o2.connect(g);
  g.connect(out());
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

/** Seconds of ring-out rendered past a bar's end. */
const TAIL = 0.6;

/**
 * Every fourth section opens on two bars without kick and bass; every section's last bar fills.
 * The rest of a section's bars are the same bar.
 */
const kindOf = (bar: number) => (Math.floor(bar / 8) % 4 === 3 && bar % 8 < 2 ? "drop" : bar % 8 === 7 ? "fill" : "bar");

/** One bar of the groove on air (A.style, bpm, key, seed) and its ring-out, mono. */
function renderBar(sec: number, kind: string) {
  const sr = A.ctx!.sampleRate,
    P = PAT[A.style],
    spb = 60 / A.bpm / 4,
    oc = new OfflineAudioContext(1, Math.ceil((16 * spb + TAIL) * sr), sr),
    extra = section(sec),
    drop = kind === "drop";
  rc = oc;
  let t = 0;
  for (let s = 0; s < 16; s++) {
    const fill = kind === "fill" && s >= 12;
    if (P.k.includes(s) && !drop) kick(t);
    if (P.c.includes(s) || (fill && s % 2)) clap(t);
    if (P.h.includes(s)) hat(t, 0.22);
    if (P.hs.includes(s) || fill) hat(t, 0.07);
    if (P.oh?.includes(s)) hat(t, 0.15, 0.2);
    P.cg?.forEach(([st, f]) => st === s && conga(t, f * A.kf));
    P.ld?.forEach(([st, f]) => st === s && logdrum(t, f * A.kf));
    if (!drop) P.bs?.forEach(([st, f]) => st === s && bass(t, f * A.kf, P.bd ?? 0.15));
    if (P.bl?.includes(s)) bell(t);
    if (P.st?.includes(s)) stab(t);
    if (!fill) extra.forEach(([st, v]) => st === s && v(t));
    t += spb * (s % 2 ? 1 - P.sw : 1 + P.sw);
  }
  return oc.startRendering().then((b) => b.getChannelData(0));
}

/**
 * The groove on air as a seamless loop of `bars` bars, mono. Each distinct bar is rendered once
 * (an offline render costs every node for its whole length) and laid in place, ring-outs
 * overlapping the next bar and the last one's wrapping onto the start. `made` keeps rendered bars.
 */
async function render(bars: number, made: Map<string, Promise<Float32Array>>) {
  const barLen = (240 / A.bpm) * A.ctx!.sampleRate,
    n = Math.round(bars * barLen),
    loop = new Float32Array(n);
  const parts = [...Array(bars).keys()].map((b) => {
    const sec = Math.floor(b / 8),
      kind = kindOf(b),
      key = `${sec}:${kind}`;
    let p = made.get(key);
    if (!p) made.set(key, (p = renderBar(sec, kind)));
    return p;
  });
  (await Promise.all(parts)).forEach((d, b) => {
    const at = Math.round(b * barLen);
    for (let i = 0; i < d.length; i++) loop[(at + i) % n] += d[i];
  });
  return loop;
}

/* ---- the deck ---- */

/** Messages for the deck while its worklet loads; null once it can't (no AudioWorklet here). */
let queued: [object, Transferable[]][] | null = [];
function post(m: object, transfer: Transferable[] = []) {
  if (A.deck) A.deck.port.postMessage(m, transfer);
  else queued?.push([m, transfer]);
}

function heard(m: { k: "at"; p: number; v: number; t: number; len: number } | { k: "end" | "idle" }) {
  if (m.k === "at") A.at = m;
  else if (m.k === "end") {
    if (A.track) tune(A.style, true);
  } else if (!A.on) A.ctx?.suspend();
}

function audioInit() {
  if (A.ctx) return;
  const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return;
  // iOS: this is music, so it plays with the silent switch on.
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  const ctx = (A.ctx = new C());
  const master = ctx.createGain(),
    comp = ctx.createDynamicsCompressor();
  master.gain.value = 0.55;
  master.connect(comp);
  comp.connect(ctx.destination);
  A.an = ctx.createAnalyser();
  A.an.fftSize = 512;
  A.bins = new Uint8Array(A.an.frequencyBinCount);
  const len = ctx.sampleRate * 0.5;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  curve = new Float32Array(256);
  for (let i = 0; i < 256; i++) curve[i] = Math.tanh((i / 128 - 1) * 3);
  const failed = () => void (queued = null);
  if (!ctx.audioWorklet) failed();
  else
    ctx.audioWorklet.addModule("/deck-worklet.js").then(() => {
      const deck = (A.deck = new AudioWorkletNode(ctx, "deck", { numberOfInputs: 0, outputChannelCount: [2] }));
      deck.connect(master);
      deck.connect(A.an!);
      deck.port.onmessage = (e) => heard(e.data);
      queued?.forEach(([m, transfer]) => deck.port.postMessage(m, transfer));
      queued = null;
    }, failed);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) ctx.suspend();
    else if (A.on) ctx.resume();
  });
}

/** Puts music under the needle. `keep` is the same music, longer: it keeps its place. */
function send(ch: Float32Array<ArrayBuffer>[], loop: boolean, keep = false) {
  if (!keep) A.bar = -1;
  post({ k: "buf", ch, loop, keep }, ch.map((c) => c.buffer));
}

/** What a record plays here: its genre's tracks, else any track on air in the city, else its synth groove. */
function poolOf(style: Style): Pool {
  const here = A.tracks.filter((t) => (!t.city || t.city === A.city) && !A.bad.has(t.url)),
    own = here.filter((t) => t.genre === style);
  if (own.length) return { key: `${A.city}:${style}`, list: own };
  if (here.length) return { key: `${A.city}:*`, list: here };
  return { key: `synth:${style}:${A.bpm}:${A.kf}:${A.seed}`, list: [] };
}

/** The pool's next track, in this visit's shuffled order. */
function nextTrack({ key, list }: Pool) {
  let o = A.order[key];
  if (!o) o = A.order[key] = { list: shuffle(list, rng(A.visit + list.length)), at: 0, round: 0 };
  if (!o.list.length) return null;
  if (o.at >= o.list.length) {
    o.round++;
    o.list = shuffle(o.list, rng(A.visit + o.round * 104729));
    o.at = 0;
  }
  return o.list[o.at++];
}

/** `again`: the track on air has ended, so the same file starts over rather than carrying on. */
async function loadTrack(t: Track, id: number, again: boolean) {
  if (t.url === A.src) {
    if (again) post({ k: "seek", p: 0 });
    return;
  }
  try {
    const res = await fetch(mediaSrc(t.url) ?? t.url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`${res.status}`);
    const buf = await A.ctx!.decodeAudioData(await res.arrayBuffer());
    if (id !== A.load) return;
    A.src = t.url;
    A.track = t;
    send([...Array(Math.min(2, buf.numberOfChannels)).keys()].map((i) => buf.getChannelData(i).slice()), false);
    emit();
  } catch {
    if (id !== A.load) return;
    // An unplayable file drops out of this visit's rotation.
    A.bad.add(t.url);
    Object.values(A.order).forEach((o) => (o.list = o.list.filter((x) => x !== t)));
    tune(A.style);
  }
}

async function loadSynth(id: number) {
  // Four bars first, so it starts at once; then the full 32-bar cycle, which opens on the same bars.
  const made = new Map<string, Promise<Float32Array>>(),
    intro = await render(4, made);
  if (id !== A.load) return;
  A.src = A.pool;
  A.track = null;
  send([intro], true);
  emit();
  const full = await render(32, made);
  if (id === A.load) send([full], true, true);
}

/** Puts a genre on air: its rotation's next track if it has one, otherwise the synth. */
function tune(style: Style, again = false) {
  A.style = style;
  const p = poolOf(style),
    t = p.list.length ? nextTrack(p) : null,
    id = ++A.load;
  A.pool = p.key;
  if (t) loadTrack(t, id, again);
  else loadSynth(id).catch(() => {});
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
 * The motor spins the platter up; music still under the needle carries on where it stopped.
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
  post({ k: "motor", on: true });
  if (A.src && poolOf(g.style).key === A.pool) A.style = g.style;
  else tune(g.style);
  emit();
}

/** The brake: the record slows to a stop, then the deck sleeps. */
export function stop() {
  if (!A.ctx) return;
  A.on = false;
  post({ k: "motor", on: false });
  if (!A.deck) A.ctx.suspend();
  emit();
}

/** A record change while on air. A new rotation (genre, city or groove) changes the music. */
export function retune(g: Groove, city: string) {
  if (!A.on) return;
  set(g, city);
  if (poolOf(g.style).key === A.pool) A.style = g.style;
  else tune(g.style);
}

/** A hand on the record: held still, it stops the music; let go and the motor spins it back up. */
export function hold(held: boolean) {
  if (held === A.held || !A.deck || (held && !A.on)) return;
  A.held = held;
  post({ k: "hand", on: held, t: performance.now() / 1000 });
}

/** The hand turned the record d degrees; the needle follows it (33⅓ rpm is 200° a second). */
export function scratch(d: number) {
  if (A.held && A.ctx) post({ k: "move", d: (d * A.ctx.sampleRate) / 200, t: performance.now() / 1000 });
}

/** Beat envelope 0..1 for the visuals. Idle: a soft pulse at the record's tempo. */
export function beatEnv(now: number, idleBpm: number) {
  if (A.on && A.an && A.bins) {
    // Low-end energy above its running average, so kicks pulse the visuals (scratches too).
    A.an.getByteFrequencyData(A.bins);
    let v = 0;
    for (let i = 1; i < 7; i++) v += A.bins[i];
    v /= 6;
    A.lvl += (v - A.lvl) * 0.06;
    return Math.max(0, Math.min(1, (v - A.lvl) / 28));
  }
  const ph = ((now / 1000) * idleBpm) / 60 % 1;
  return 0.35 * Math.exp(-ph * 5);
}

/** 1 when the needle has crossed into another bar since the last call, for the ripple. */
export function dueBars() {
  const { ctx, at } = A;
  if (!(A.on && ctx && at.len)) return 0;
  const p = at.p + at.v * (ctx.currentTime - at.t),
    bar = Math.floor(((((p % at.len) + at.len) % at.len) * A.bpm) / 240);
  if (bar === A.bar) return 0;
  A.bar = bar;
  return 1;
}
