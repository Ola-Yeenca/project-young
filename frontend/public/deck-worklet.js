/* global sampleRate, currentTime, AudioWorkletProcessor, registerProcessor */

// The HOY deck: one piece of music under a needle, read at the platter's speed (1 = 33⅓ rpm).
// The motor turns the record; a hand on it takes over and the needle follows the hand, backwards
// too. Loaded by lib/audio.ts. Messages in: buf, seek, motor, hand, move. Out: at, end, idle.

const LAG = 0.04; // the hand's path plays this far behind, so uneven pointer events still glide
const MORE = 0.06; // how much further behind it may fall when events keep coming late
const GAP = 0.08; // a longer wait between pointer events is the hand pausing, not events coming late
// The record follows the hand's path critically damped: as fast as it can without overshooting.
const KP = 1 / (0.008 * sampleRate);
const KS = 1 - Math.exp(-1 / (0.002 * sampleRate));
const SPIN = 1 / (0.3 * sampleRate); // motor torque: standstill to 1.0× in 300 ms
const BRAKE = 1 / (0.6 * sampleRate); // brake: 1.0× to standstill in 600 ms
const FADE = 1 / (0.012 * sampleRate); // new music fades in over 12 ms, the old out over 12 ms
const REPORT = 4096; // frames between position reports
const N = 64; // points kept of the hand's path

function cubic(a, b, c, d, f) {
  return b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
}

class Deck extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ch = null;
    this.len = 0;
    this.loop = true;
    this.pos = 0; // the needle, in frames
    this.v = 0; // frames per frame, signed
    this.motor = false;
    this.hand = false;
    // The hand's path since it touched the record: context times and how far it has moved (frames).
    this.ht = new Float64Array(N);
    this.hp = new Float64Array(N);
    this.h0 = 0;
    this.h1 = 0;
    this.off = 0; // the hand's clock (performance seconds) to context time
    this.more = 0;
    this.moved = 0;
    this.walked = 0; // how far the record has turned since the hand touched it
    this.next = null; // music waiting for the fade
    this.g = 1;
    this.tone = 1; // one-pole low-pass coefficient; 1 is open
    this.l = 0;
    this.r = 0;
    this.xl = 0; // DC blocker, so a record held still is silent
    this.yl = 0;
    this.xr = 0;
    this.yr = 0;
    this.ended = false;
    this.idle = true;
    this.quiet = 0;
    this.frames = 0;
    this.port.onmessage = (e) => this.msg(e.data);
  }

  msg(m) {
    if (m.k === "buf" && m.keep) {
      // The same music, longer: swap under the needle without a fade.
      const to = this.next && this.next.ch ? this.next : null;
      if (to) to.ch = m.ch;
      else if (this.ch) {
        this.ch = m.ch;
        this.len = m.ch[0].length;
        this.pos %= this.len;
      }
    } else if (m.k === "buf" || m.k === "seek") {
      this.next = m;
      if (!this.ch || this.ended || this.idle) {
        this.swap();
        this.g = 0;
      }
    } else if (m.k === "motor") {
      this.motor = m.on;
      if (m.on) this.idle = false;
    } else if (m.k === "hand") {
      this.hand = m.on;
      if (!m.on) return;
      this.idle = false;
      this.off = currentTime + LAG - m.t;
      this.more = 0;
      this.ht[0] = currentTime + LAG;
      this.hp[0] = this.moved = this.walked = 0;
      this.h0 = 0;
      this.h1 = 1;
    } else if (m.k === "move" && this.hand) {
      const last = this.ht[(this.h1 - 1) % N];
      let t = m.t + this.off;
      if (currentTime > last) {
        // The path ran dry: the hand paused, or its events came late. After a pause it moved during
        // this event's frame; after late events, play the hand further behind from now on.
        if (t - last <= GAP) {
          const add = Math.min(currentTime - last, MORE - this.more);
          this.more += add;
          this.off += add;
          t += add;
        }
        this.point(Math.max(currentTime, t - GAP), this.moved);
      }
      if (t < currentTime) {
        this.off += currentTime - t;
        t = currentTime;
      }
      this.point(Math.max(t, this.ht[(this.h1 - 1) % N]), (this.moved += m.d));
    }
  }

  point(t, p) {
    if (this.h1 - this.h0 === N) this.h0++;
    this.ht[this.h1 % N] = t;
    this.hp[this.h1 % N] = p;
    this.h1++;
  }

  swap() {
    const m = this.next;
    this.next = null;
    if (m.ch) {
      this.ch = m.ch;
      this.len = m.ch[0].length;
      this.loop = m.loop;
    }
    this.pos = m.p || 0;
    this.ended = false;
  }

  /** Where the hand's path is at context time t (linear between pointer events). */
  path(t) {
    const ht = this.ht,
      hp = this.hp;
    while (this.h1 - this.h0 > 1 && ht[(this.h0 + 1) % N] <= t) this.h0++;
    const a = this.h0 % N;
    if (this.h1 - this.h0 === 1 || t <= ht[a]) return hp[a];
    const b = (this.h0 + 1) % N;
    return hp[a] + ((hp[b] - hp[a]) * (t - ht[a])) / (ht[b] - ht[a]);
  }

  at(x, k) {
    const n = this.len;
    return this.loop ? x[((k % n) + n) % n] : k >= 0 && k < n ? x[k] : 0;
  }

  read(x, i, f) {
    if (i >= 1 && i + 2 < this.len) return cubic(x[i - 1], x[i], x[i + 1], x[i + 2], f);
    return cubic(this.at(x, i - 1), this.at(x, i), this.at(x, i + 1), this.at(x, i + 2), f);
  }

  process(_, outputs) {
    const L = outputs[0][0],
      R = outputs[0][1] || L,
      n = L.length;
    let tg = 0,
      slope = 0;
    if (this.hand) {
      tg = this.path(currentTime);
      slope = (this.path(currentTime + n / sampleRate) - tg) / n;
    }
    // A hand on the record darkens it as it slows; let go and it opens up again.
    const fc = this.hand ? 2500 + 15500 * Math.min(1, Math.abs(this.v)) : 0;
    this.tone += ((fc ? 1 - Math.exp((-2 * Math.PI * fc) / sampleRate) : 1) - this.tone) * 0.25;
    const tone = this.tone;
    for (let i = 0; i < n; i++) {
      if (this.hand) {
        this.v += (slope + (tg + slope * i - this.walked) * KP - this.v) * KS;
        this.walked += this.v;
      } else if (this.motor) this.v = this.v < 1 ? Math.min(1, this.v + SPIN) : Math.max(1, this.v - SPIN);
      else if (this.v) this.v = this.v > 0 ? Math.max(0, this.v - BRAKE) : Math.min(0, this.v + BRAKE);
      if (this.next) {
        this.g -= FADE;
        if (this.g <= 0) {
          this.g = 0;
          this.swap();
        }
      } else if (this.g < 1) this.g = Math.min(1, this.g + FADE);

      let x = 0,
        y = 0;
      if (this.ch) {
        const ip = Math.floor(this.pos),
          f = this.pos - ip,
          c = this.ch;
        x = this.read(c[0], ip, f);
        y = c[1] ? this.read(c[1], ip, f) : x;
        this.pos += this.v;
        if (this.pos >= this.len) {
          if (this.loop) this.pos -= this.len;
          else {
            this.pos = this.len;
            if (!this.hand && !this.ended && this.v > 0) {
              this.ended = true;
              this.port.postMessage({ k: "end" });
            }
          }
        } else if (this.pos < 0) this.pos = this.loop ? this.pos + this.len : 0;
      }
      if (this.hand) {
        // Stylus friction: a faint hiss and the odd crackle, only while the record is handled.
        const s = Math.min(1, Math.abs(this.v)),
          h = (Math.random() - 0.5) * 0.004 * s + (Math.random() < s * 1e-4 ? (Math.random() - 0.5) * 0.05 : 0);
        x += h;
        y += h;
      }
      this.l += (x - this.l) * tone;
      this.r += (y - this.r) * tone;
      const ol = this.l * this.g,
        or = this.r * this.g;
      this.yl = ol - this.xl + 0.999 * this.yl;
      this.xl = ol;
      this.yr = or - this.xr + 0.999 * this.yr;
      this.xr = or;
      L[i] = this.yl;
      if (R !== L) R[i] = this.yr;
    }

    if (!this.motor && !this.hand && !this.v && !this.next) {
      if (!this.idle && (this.quiet += n) > 0.1 * sampleRate) {
        this.idle = true;
        this.port.postMessage({ k: "idle" });
      }
    } else this.quiet = 0;
    if (!this.idle && (this.frames += n) >= REPORT) {
      this.frames = 0;
      this.port.postMessage({ k: "at", p: this.pos / sampleRate, v: this.v, t: currentTime, len: this.len / sampleRate });
    }
    return true;
  }
}

registerProcessor("deck", Deck);
