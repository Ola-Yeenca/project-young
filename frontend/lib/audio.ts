// The groove, synthesised live with WebAudio. Ported from the prototype (A, PAT, schedule()).
// A module singleton so the hero and the now-playing pill share one engine across routes.

type Beat = { t: number; k: 0 | 1; bar: boolean; r?: 1 };
type Style = "afro" | "piano";

export const A = {
  ctx: null as AudioContext | null,
  on: false,
  next: 0,
  step: 0,
  bpm: 104,
  style: "afro" as Style,
  timer: 0 as ReturnType<typeof setInterval> | 0,
  master: null as GainNode | null,
  lp: null as BiquadFilterNode | null,
  noise: null as AudioBuffer | null,
  curve: null as Float32Array<ArrayBuffer> | null,
  beats: [] as Beat[],
};

const listeners = new Set<(on: boolean) => void>();
export const subscribe = (fn: (on: boolean) => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
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
function hat(t: number, v: number) {
  const c = A.ctx!,
    s = c.createBufferSource(),
    f = c.createBiquadFilter(),
    g = c.createGain();
  s.buffer = A.noise;
  f.type = "highpass";
  f.frequency.value = 7500;
  env(t, g, 0.002, 0.045, v);
  s.connect(f);
  f.connect(g);
  g.connect(A.lp!);
  s.start(t);
  s.stop(t + 0.08);
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
  o.frequency.value = 840;
  o2.frequency.value = 1260;
  env(t, g, 0.002, 0.09, 0.05);
  o.connect(g);
  o2.connect(g);
  g.connect(A.lp!);
  o.start(t);
  o2.start(t);
  o.stop(t + 0.12);
  o2.stop(t + 0.12);
}

type Pat = { k: number[]; c: number[]; h: number[]; hs: number[]; cg: [number, number][]; ld: [number, number][]; bl: number[] };
export const PAT: Record<Style, Pat> = {
  afro: { k: [0, 7, 10], c: [4, 12], h: [2, 6, 10, 14], hs: [0, 1, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15], cg: [[3, 220], [5, 165], [11, 220], [13, 165], [14, 196]], ld: [], bl: [0, 3, 6, 10, 12] },
  piano: { k: [0, 4, 8, 12], c: [4, 12], h: [2, 6, 10, 14], hs: [1, 3, 5, 7, 9, 11, 13, 15], cg: [], ld: [[3, 55], [6, 49], [10, 55], [11, 62], [14, 46]], bl: [] },
};

function schedule() {
  const ctx = A.ctx!,
    spb = 60 / A.bpm / 4;
  while (A.next < ctx.currentTime + 0.12) {
    const s = A.step % 16,
      t = A.next,
      P = PAT[A.style];
    if (P.k.includes(s)) {
      kick(t);
      A.beats.push({ t, k: 1, bar: s === 0 });
    } else if (s % 4 === 0) A.beats.push({ t, k: 0, bar: s === 0 });
    if (P.c.includes(s)) clap(t);
    if (P.h.includes(s)) hat(t, 0.22);
    if (P.hs.includes(s)) hat(t, 0.07);
    P.cg.forEach(([st, f]) => {
      if (st === s) conga(t, f);
    });
    P.ld.forEach(([st, f]) => {
      if (st === s) logdrum(t, f);
    });
    if (P.bl.includes(s)) bell(t);
    A.next += spb * (s % 2 ? 0.92 : 1.08);
    A.step++;
  }
}

/** Starts the groove. Must be called from a user gesture (browsers block audio otherwise). */
export function play(bpm: number, style: Style) {
  audioInit();
  if (!A.ctx) return;
  A.ctx.resume();
  A.bpm = bpm;
  A.style = style;
  A.on = true;
  A.next = A.ctx.currentTime + 0.08;
  A.step = 0;
  A.beats = [];
  A.master!.gain.cancelScheduledValues(A.ctx.currentTime);
  A.master!.gain.setTargetAtTime(0.55, A.ctx.currentTime, 0.05);
  clearInterval(A.timer);
  A.timer = setInterval(schedule, 25);
  schedule();
  emit();
}

export function stop() {
  if (!A.ctx) return;
  A.on = false;
  clearInterval(A.timer);
  A.master!.gain.setTargetAtTime(0.0001, A.ctx.currentTime, 0.08);
  emit();
}

export function retune(bpm: number, style: Style) {
  if (!A.on) return;
  A.bpm = bpm;
  A.style = style;
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
  let n = 0;
  for (const b of A.beats) {
    if (b.bar && !b.r && b.t <= A.ctx.currentTime) {
      b.r = 1;
      n++;
    }
  }
  return n;
}
