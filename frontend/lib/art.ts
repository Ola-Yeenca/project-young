// Canvas art ported from the prototype: field() is the stand-in image used only when a real
// image is missing; record() draws the vinyl, with the event poster as its base art.

export const PAL = [
  ["#7d1a1f", "#e0954f", "#f2dcb9"],
  ["#14231f", "#c9a043", "#3f6b5a"],
  ["#26375f", "#d9c3a0", "#9b3a2c"],
  ["#3a2a4a", "#d08a3e", "#f2e2c6"],
  ["#1d1b18", "#b98a3a", "#e9dcc0"],
  ["#6f2638", "#eaa36c", "#2a1a17"],
  ["#20304a", "#e6b85c", "#c4583a"],
  ["#40261a", "#d6a66b", "#f1e6d2"],
  ["#123a33", "#e5c37a", "#f0e8d8"],
];

export function rng(s: number) {
  let x = (s + 1) * 9301 + 49297;
  return () => (x = (x * 9301 + 49297) % 233280) / 233280;
}

function grainPx(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, a: number) {
  let id: ImageData;
  try {
    id = g.getImageData(0, 0, w, h); // throws if a cross-origin poster tainted the canvas
  } catch {
    return;
  }
  const d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * a;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  g.putImageData(id, 0, 0);
}

export function field(cv: HTMLCanvasElement, seed: number, w: number, h: number) {
  cv.width = w;
  cv.height = h;
  const g = cv.getContext("2d", { willReadFrequently: true })!,
    r = rng(seed),
    p = PAL[seed % PAL.length];
  g.fillStyle = p[0];
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) {
    const x = r() * w,
      y = r() * h,
      rad = (0.3 + r() * 0.7) * Math.max(w, h),
      c = p[1 + (i % 2)],
      gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, c);
    gr.addColorStop(1, c + "00");
    g.globalAlpha = 0.45 + r() * 0.45;
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  }
  g.globalAlpha = 1;
  grainPx(g, w, h, r, 12);
}

/** Draws an image to cover a w×h box (object-fit: cover). */
function cover(g: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height),
    iw = img.width * s,
    ih = img.height * s;
  g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}

export function record(cv: HTMLCanvasElement, seed: number, poster?: HTMLImageElement | null) {
  const S = 900,
    g = cv.getContext("2d", { willReadFrequently: true })!,
    r = rng(seed + 100),
    p = PAL[seed % PAL.length];
  cv.width = cv.height = S;
  const c = S / 2;
  g.save();
  g.beginPath();
  g.arc(c, c, c, 0, 7);
  g.clip();
  if (poster && poster.naturalWidth) {
    cover(g, poster, S, S);
  } else {
    g.fillStyle = p[0];
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 7; i++) {
      const x = r() * S,
        y = r() * S,
        rad = (0.35 + r() * 0.6) * S,
        col = p[1 + (i % 2)],
        gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, col);
      gr.addColorStop(1, col + "00");
      g.globalAlpha = 0.5 + r() * 0.4;
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
    }
    g.globalAlpha = 1;
  }
  for (let rad = c * 0.36; rad < c * 0.97; rad += 2.2 + r() * 2.2) {
    g.beginPath();
    g.arc(c, c, rad, 0, 7);
    g.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
    g.lineWidth = 0.8;
    g.stroke();
  }
  [c * 0.52, c * 0.71, c * 0.86].forEach((rad) => {
    g.beginPath();
    g.arc(c, c, rad, 0, 7);
    g.strokeStyle = "rgba(255,255,255,.14)";
    g.lineWidth = 1.2;
    g.stroke();
  });
  // a light streak so the rotation reads
  const lg = g.createLinearGradient(c, 0, c + 40, S);
  lg.addColorStop(0, "rgba(255,255,255,0)");
  lg.addColorStop(0.5, "rgba(255,255,255,.10)");
  lg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = lg;
  g.beginPath();
  g.moveTo(c, c);
  g.arc(c, c, c, -1.75, -1.45);
  g.closePath();
  g.fill();
  g.beginPath();
  g.arc(c, c, c - 2, 0, 7);
  g.strokeStyle = "rgba(0,0,0,.35)";
  g.lineWidth = 4;
  g.stroke();
  grainPx(g, S, S, r, 10);
  g.restore();
}

/** Loads an image for canvas use; resolves null on failure so callers fall back to field art. */
export function loadImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  const one = (cors: boolean) =>
    new Promise<HTMLImageElement | null>((res) => {
      const img = new Image();
      if (cors) img.crossOrigin = "anonymous";
      img.decoding = "async";
      img.onload = () => res(img);
      img.onerror = () => res(null);
      img.src = src!;
    });
  // CORS first so the grain pass can read pixels; without CORS headers, load it plain (no grain).
  return src ? one(true).then((img) => img ?? one(false)) : Promise.resolve(null);
}

/** The 140×140 grain texture, set once as --noise. */
export function installNoise() {
  const c = document.createElement("canvas");
  c.width = c.height = 140;
  const g = c.getContext("2d", { willReadFrequently: true })!,
    id = g.createImageData(140, 140);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = Math.random() * 255;
    id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
    id.data[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  document.documentElement.style.setProperty("--noise", `url(${c.toDataURL()})`);
}
