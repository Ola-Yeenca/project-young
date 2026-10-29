// Turns an uploaded product photo into garment textures for the 3D rack (components/shop).
// Photos on a plain or transparent background are cut out so the garment keeps its own
// outline; anything else (lifestyle shots, busy backgrounds) is printed onto a T-shirt
// silhouette so it still reads as clothing on a hanger.

import { field, loadImage } from "./art";
import { mediaSrc } from "./api";

export type GarmentArt = {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  /** width / height of both canvases */
  aspect: number;
  /** Coarse alpha mask (MASK×MASK, row 0 at the top) so clicks pass through transparent corners. */
  mask: Uint8Array;
};

export const MASK = 32;

// The tee outline in a 1 × TEE_H box, clockwise from the left of the collar.
const TEE_H = 1.08;
const TEE: [number, number][] = [
  [0.37, 0.02], [0.5, 0.1], [0.63, 0.02], [0.85, 0.08], [1, 0.31], [0.85, 0.4], [0.8, 0.34],
  [0.81, 1.06], [0.19, 1.06], [0.2, 0.34], [0.15, 0.4], [0, 0.31], [0.15, 0.08],
];

function teePath(g: CanvasRenderingContext2D, w: number, h: number) {
  g.beginPath();
  TEE.forEach(([x, y], i) => {
    const px = x * w,
      py = (y / TEE_H) * h;
    if (i === 1) g.quadraticCurveTo(0.5 * w, (0.12 / TEE_H) * h, px, py);
    else if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  });
  g.closePath();
}

const canvas = (w: number, h: number) => {
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w));
  cv.height = Math.max(1, Math.round(h));
  return cv;
};
const ctx = (cv: HTMLCanvasElement) => cv.getContext("2d", { willReadFrequently: true })!;

function fit(img: CanvasImageSource & { width: number; height: number }, max: number) {
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const cv = canvas(img.width * s, img.height * s);
  ctx(cv).drawImage(img, 0, 0, cv.width, cv.height);
  return cv;
}

function pixels(cv: HTMLCanvasElement): ImageData | null {
  try {
    return ctx(cv).getImageData(0, 0, cv.width, cv.height); // throws for a tainted (cross-origin) canvas
  } catch {
    return null;
  }
}

/**
 * Removes a plain background by flood-filling from the edges. Returns false when the edges
 * aren't one colour (a photo), so the caller can use the tee silhouette instead.
 */
function cutOut(id: ImageData): boolean {
  const { width: w, height: h, data: d } = id;
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);

  const clear = border.filter((i) => d[i * 4 + 3] < 16).length;
  if (clear / border.length > 0.5) return true; // already a cut-out PNG

  let r = 0,
    g = 0,
    b = 0;
  for (const i of border) {
    r += d[i * 4];
    g += d[i * 4 + 1];
    b += d[i * 4 + 2];
  }
  r /= border.length;
  g /= border.length;
  b /= border.length;
  const TOL = 34;
  const near = (i: number) => Math.abs(d[i * 4] - r) < TOL && Math.abs(d[i * 4 + 1] - g) < TOL && Math.abs(d[i * 4 + 2] - b) < TOL;
  if (border.filter(near).length / border.length < 0.85) return false;

  const seen = new Uint8Array(w * h);
  const stack = border.filter(near);
  let removed = 0;
  while (stack.length) {
    const i = stack.pop()!;
    if (seen[i] || !near(i)) continue;
    seen[i] = 1;
    removed++;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  const share = removed / (w * h);
  if (share < 0.05 || share > 0.95) return false;
  for (let i = 0; i < seen.length; i++) if (seen[i]) d[i * 4 + 3] = 0;
  return true;
}

/** Crops to the opaque pixels, with a little margin. */
function crop(src: HTMLCanvasElement, id: ImageData) {
  const { width: w, height: h, data: d } = id;
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 127) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) return src;
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02);
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const out = canvas(x1 - x0 + 1, y1 - y0 + 1);
  ctx(out).drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/** The image printed onto a tee silhouette, with a hint of collar and side shading. */
function onTee(img: CanvasImageSource & { width: number; height: number }, max: number) {
  const w = Math.round(max / TEE_H),
    h = max;
  const cv = canvas(w, h),
    g = ctx(cv);
  teePath(g, w, h);
  g.save();
  g.clip();
  const s = Math.max(w / img.width, h / img.height);
  g.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
  const shade = g.createLinearGradient(0, 0, w, 0);
  shade.addColorStop(0, "rgba(0,0,0,.28)");
  shade.addColorStop(0.22, "rgba(0,0,0,0)");
  shade.addColorStop(0.78, "rgba(0,0,0,0)");
  shade.addColorStop(1, "rgba(0,0,0,.28)");
  g.fillStyle = shade;
  g.fillRect(0, 0, w, h);
  g.restore();
  g.beginPath();
  g.moveTo(0.37 * w, (0.02 / TEE_H) * h);
  g.quadraticCurveTo(0.5 * w, (0.12 / TEE_H) * h, 0.63 * w, (0.02 / TEE_H) * h);
  g.strokeStyle = "rgba(0,0,0,.35)";
  g.lineWidth = Math.max(2, w * 0.012);
  g.stroke();
  return cv;
}

/** Garment outline from the front, filled with the fabric's average colour (a plain back). */
function plainBack(front: HTMLCanvasElement) {
  const id = pixels(front)!;
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i < id.data.length; i += 16)
    if (id.data[i + 3] > 127) {
      r += id.data[i];
      g += id.data[i + 1];
      b += id.data[i + 2];
      n++;
    }
  n = Math.max(n, 1);
  const cv = canvas(front.width, front.height),
    c = ctx(cv);
  c.drawImage(front, 0, 0);
  c.globalCompositeOperation = "source-in";
  c.fillStyle = `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
  c.fillRect(0, 0, cv.width, cv.height);
  c.globalCompositeOperation = "source-atop";
  const fold = c.createLinearGradient(0, 0, cv.width, 0);
  fold.addColorStop(0, "rgba(0,0,0,.22)");
  fold.addColorStop(0.5, "rgba(255,255,255,.05)");
  fold.addColorStop(1, "rgba(0,0,0,.22)");
  c.fillStyle = fold;
  c.fillRect(0, 0, cv.width, cv.height);
  return cv;
}

/** A back photo, mirrored (it is seen from behind) and fitted into the front's box. */
function photoBack(img: HTMLCanvasElement, front: HTMLCanvasElement) {
  const cv = canvas(front.width, front.height),
    c = ctx(cv);
  const s = Math.min(cv.width / img.width, cv.height / img.height);
  c.translate(cv.width, 0);
  c.scale(-1, 1);
  c.drawImage(img, (cv.width - img.width * s) / 2, 0, img.width * s, img.height * s);
  return cv;
}

async function prepare(src: string | null, max: number): Promise<HTMLCanvasElement | null> {
  const img = await loadImage(mediaSrc(src));
  if (!img || !img.naturalWidth) return null;
  const small = fit(img, max);
  const id = pixels(small);
  if (!id) return null; // cross-origin without CORS: WebGL can't upload it either
  if (!cutOut(id)) return onTee(small, max);
  ctx(small).putImageData(id, 0, 0);
  return crop(small, id);
}

function maskOf(cv: HTMLCanvasElement) {
  const m = canvas(MASK, MASK),
    g = ctx(m);
  g.drawImage(cv, 0, 0, MASK, MASK);
  const d = g.getImageData(0, 0, MASK, MASK).data;
  const out = new Uint8Array(MASK * MASK);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] > 100 ? 1 : 0;
  return out;
}

/**
 * Builds the textures for one product. `max` caps the longest side in pixels. Never rejects:
 * a missing or unreadable image becomes the site's seeded field art on a tee.
 */
export async function garmentArt(front: string | null, back: string | null, seed: number, max: number): Promise<GarmentArt> {
  let f = await prepare(front, max).catch(() => null);
  if (!f) {
    const art = canvas(1, 1);
    field(art, seed, 360, 360);
    f = onTee(art, max);
  }
  const b = back ? await prepare(back, max).catch(() => null) : null;
  return { front: f, back: b ? photoBack(b, f) : plainBack(f), aspect: f.width / f.height, mask: maskOf(f) };
}
