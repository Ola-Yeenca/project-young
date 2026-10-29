// The 3D clothing rack: a chrome rail with one hanger per product. Each garment is a small
// Verlet cloth pinned along its hanger, so a passing cursor or finger, a turn or a slide along
// the rail ripples the fabric. Loaded only through RackScene (dynamic import), so three.js
// stays out of every other page's bundle.

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MASK, type GarmentArt } from "@/lib/garment";

export type RackState = { selected: number | null; flipped: boolean };
export type RackHandlers = {
  /** A tap or click on a garment (its index) or on empty space (null). */
  onPick: (i: number | null) => void;
  onHover: (i: number | null) => void;
  /** WebGL went away (context lost); the caller should fall back to the grid. */
  onLost: () => void;
};

const COLS = 13,
  ROWS = 16,
  ITER = 6,
  STEP = 1 / 120,
  DAMP = 0.985;
const SPACING = 0.5,
  GAP = 0.6,
  RAIL_Y = 1.0,
  REST_YAW = 1.05,
  HOVER_YAW = 0.55,
  VIEW_H = 2.15,
  LOOK_Y = 0.3,
  FOV = 32;
const HANGER_Y = -0.17;

/** Height of the cloth's top edge at x (the hanger's shoulder slope). */
const topY = (x: number, w: number) => HANGER_Y - 0.035 - 0.09 * ((2 * x) / w) ** 2;

class Cloth {
  readonly pos = new Float32Array(COLS * ROWS * 3);
  readonly prev = new Float32Array(COLS * ROWS * 3);
  readonly acc = new Float32Array(COLS * ROWS * 3);
  readonly inv = new Float32Array(COLS * ROWS);
  readonly cons: Uint16Array;
  readonly rest: Float32Array;
  readonly stiff: Float32Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    const dy = h / (ROWS - 1);
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        const k = j * COLS + i,
          x = (i / (COLS - 1) - 0.5) * w;
        this.pos[k * 3] = x;
        this.pos[k * 3 + 1] = topY(x, w) - j * dy;
        // hanger supports the shoulders; the sleeves past it hang free
        this.inv[k] = j === 0 && Math.abs(x) <= 0.4 * w ? 0 : 1;
      }
    this.prev.set(this.pos);
    const c: number[] = [],
      s: number[] = [];
    const link = (a: number, b: number, k: number) => {
      c.push(a, b);
      s.push(k);
    };
    for (let j = 0; j < ROWS; j++)
      for (let i = 0; i < COLS; i++) {
        const k = j * COLS + i;
        if (i < COLS - 1) link(k, k + 1, 1);
        if (j < ROWS - 1) link(k, k + COLS, 1);
        if (i < COLS - 1 && j < ROWS - 1) {
          link(k, k + COLS + 1, 0.7);
          link(k + 1, k + COLS, 0.7);
        }
        if (i < COLS - 2) link(k, k + 2, 0.3);
        if (j < ROWS - 2) link(k, k + 2 * COLS, 0.3);
      }
    this.cons = new Uint16Array(c);
    this.stiff = new Float32Array(s);
    this.rest = new Float32Array(s.length);
    for (let n = 0; n < s.length; n++) this.rest[n] = Math.sqrt(this.dist2(this.cons[n * 2], this.cons[n * 2 + 1]));
  }

  private dist2(a: number, b: number) {
    const p = this.pos;
    const dx = p[b * 3] - p[a * 3],
      dy = p[b * 3 + 1] - p[a * 3 + 1],
      dz = p[b * 3 + 2] - p[a * 3 + 2];
    return dx * dx + dy * dy + dz * dz;
  }

  step(dt: number) {
    const { pos: p, prev: q, acc: a, inv } = this;
    const dt2 = dt * dt;
    for (let k = 0; k < inv.length; k++) {
      if (!inv[k]) continue;
      for (let d = 0; d < 3; d++) {
        const n = k * 3 + d,
          v = (p[n] - q[n]) * DAMP;
        q[n] = p[n];
        p[n] += v + a[n] * dt2;
      }
    }
    const { cons, rest, stiff } = this;
    for (let it = 0; it < ITER; it++)
      for (let n = 0; n < rest.length; n++) {
        const A = cons[n * 2],
          B = cons[n * 2 + 1],
          wa = inv[A],
          wb = inv[B],
          wsum = wa + wb;
        if (!wsum) continue;
        const dx = p[B * 3] - p[A * 3],
          dy = p[B * 3 + 1] - p[A * 3 + 1],
          dz = p[B * 3 + 2] - p[A * 3 + 2];
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
        const f = ((len - rest[n]) / len / wsum) * stiff[n];
        p[A * 3] += dx * f * wa;
        p[A * 3 + 1] += dy * f * wa;
        p[A * 3 + 2] += dz * f * wa;
        p[B * 3] -= dx * f * wb;
        p[B * 3 + 1] -= dy * f * wb;
        p[B * 3 + 2] -= dz * f * wb;
      }
  }
}

type Garment = {
  cloth: Cloth;
  geo: THREE.BufferGeometry;
  slide: THREE.Group;
  swing: THREE.Group;
  turn: THREE.Group;
  front: THREE.Mesh;
  back: THREE.Mesh;
  mask: Uint8Array;
  base: number;
  phase: number;
  x: number;
  vx: number;
  ax: number;
  z: number;
  vz: number;
  az: number;
  yaw: number;
  vyaw: number;
  ayaw: number;
  tilt: number;
  vtilt: number;
  /** last pointer hit on the cloth plane, local coords, for the drag direction */
  lastHit: THREE.Vector2 | null;
};

function clothGeometry(cloth: Cloth) {
  const geo = new THREE.BufferGeometry();
  const uv = new Float32Array(COLS * ROWS * 2);
  for (let j = 0; j < ROWS; j++)
    for (let i = 0; i < COLS; i++) {
      const k = j * COLS + i;
      uv[k * 2] = i / (COLS - 1);
      uv[k * 2 + 1] = 1 - j / (ROWS - 1);
    }
  const idx: number[] = [];
  for (let j = 0; j < ROWS - 1; j++)
    for (let i = 0; i < COLS - 1; i++) {
      const a = j * COLS + i,
        b = a + COLS,
        c = a + 1,
        d = b + 1;
      idx.push(a, b, c, c, b, d);
    }
  geo.setIndex(idx);
  geo.setAttribute("position", new THREE.BufferAttribute(cloth.pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  // The cloth moves every frame; a generous fixed sphere keeps raycasts from missing it.
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.7, 0), 1.6);
  return geo;
}

function texture(cv: HTMLCanvasElement, renderer: THREE.WebGLRenderer) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}

export function createRack(host: HTMLElement, arts: GarmentArt[], handlers: RackHandlers) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  const coarse = matchMedia("(pointer: coarse)").matches;
  const maxRatio = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.75);
  let ratio = maxRatio;
  renderer.setPixelRatio(ratio);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.className = "rack-canvas";
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(-2, 3, 4);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
  const dist = VIEW_H / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));

  const disposables: { dispose(): void }[] = [env, pmrem];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  // ---------- the rack ----------
  const n = arts.length;
  const half = ((n - 1) / 2) * SPACING;
  const railHalf = half + GAP + 0.75;
  const chrome = keep(new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: 0.12 }));
  const wood = keep(new THREE.MeshStandardMaterial({ color: 0xb48a5a, metalness: 0, roughness: 0.5, envMapIntensity: 0.6 }));

  const rail = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.022, 0.022, railHalf * 2, 24)), chrome);
  rail.rotation.z = Math.PI / 2;
  rail.position.y = RAIL_Y;
  scene.add(rail);
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.026, 0.026, 3, 20)), chrome);
    post.position.set(s * railHalf, RAIL_Y - 1.5, 0);
    scene.add(post);
    const cap = new THREE.Mesh(keep(new THREE.SphereGeometry(0.034, 20, 12)), chrome);
    cap.position.set(s * railHalf, RAIL_Y, 0);
    scene.add(cap);
  }

  const hookGeo = keep(new THREE.TorusGeometry(0.04, 0.006, 8, 24, Math.PI * 1.35));
  const stemGeo = keep(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8));

  // ---------- garments ----------
  const garments: Garment[] = arts.map((art, i) => {
    let w = 0.95,
      h = w / art.aspect;
    if (h > 1.45) {
      h = 1.45;
      w = h * art.aspect;
    }
    h = Math.max(h, 0.55);
    const cloth = new Cloth(w, h);
    const geo = keep(clothGeometry(cloth));
    const mat = (cv: HTMLCanvasElement, side: THREE.Side) =>
      keep(
        new THREE.MeshStandardMaterial({ map: keep(texture(cv, renderer)), side, alphaTest: 0.5, roughness: 0.92, metalness: 0, envMapIntensity: 0.35 }),
      );
    const front = new THREE.Mesh(geo, mat(art.front, THREE.FrontSide));
    const back = new THREE.Mesh(geo, mat(art.back, THREE.BackSide));
    front.userData.i = back.userData.i = i;

    const slide = new THREE.Group();
    const swing = new THREE.Group();
    const turn = new THREE.Group();
    const hook = new THREE.Mesh(hookGeo, chrome);
    hook.rotation.set(0, Math.PI / 2, -Math.PI * 0.33);
    hook.position.y = 0.012;
    const stem = new THREE.Mesh(stemGeo, chrome);
    stem.position.y = -0.09;
    const span = 0.42 * w;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-span, topY(-span, w) + 0.016, 0),
      new THREE.Vector3(0, HANGER_Y, 0),
      new THREE.Vector3(span, topY(span, w) + 0.016, 0),
    ]);
    const bar = new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 24, 0.014, 8, false)), wood);
    turn.add(bar, front, back);
    swing.add(hook, stem, turn);
    slide.add(swing);
    slide.position.y = RAIL_Y;
    scene.add(slide);

    const base = i * SPACING - half;
    const g: Garment = {
      cloth,
      geo,
      slide,
      swing,
      turn,
      front,
      back,
      mask: art.mask,
      base,
      phase: i * 1.7,
      x: base,
      vx: 0,
      ax: 0,
      z: 0,
      vz: 0,
      az: 0,
      yaw: REST_YAW,
      vyaw: 0,
      ayaw: 0,
      tilt: 0,
      vtilt: 0,
      lastHit: null,
    };
    // let the sleeves drop before the first frame
    for (let s = 0; s < 90; s++) {
      gravityOnly(g);
      cloth.step(STEP);
    }
    return g;
  });

  function gravityOnly(g: Garment) {
    const a = g.cloth.acc;
    for (let k = 0; k < a.length; k += 3) {
      a[k] = 0;
      a[k + 1] = -9.8;
      a[k + 2] = 0;
    }
  }

  // ---------- state and input ----------
  let state: RackState = { selected: null, flipped: false };
  let hover: number | null = null;
  let camX = 0,
    camV = 0,
    camTarget = 0;
  let width = 1,
    height = 1;
  const ndc = new THREE.Vector2(9, 9);
  const prevNdc = new THREE.Vector2(9, 9);
  let pointerIn = false,
    pointerSpeed = 0,
    pointerMoved = false,
    isMouse = !coarse;
  let down: { x: number; y: number; t: number; cam: number; drag: boolean; id: number } | null = null;
  const ray = new THREE.Raycaster();
  const pickables = garments.flatMap((g) => [g.front, g.back]);

  const visibleW = () => VIEW_H * camera.aspect;
  const camRange = () => Math.max(0, railHalf - 0.45 - visibleW() / 2);

  function hit(): number | null {
    ray.setFromCamera(ndc, camera);
    for (const h of ray.intersectObjects(pickables, false)) {
      const g = garments[h.object.userData.i as number];
      if (!h.uv) continue;
      const mx = Math.min(MASK - 1, Math.floor(h.uv.x * MASK)),
        my = Math.min(MASK - 1, Math.floor((1 - h.uv.y) * MASK));
      if (g.mask[my * MASK + mx]) return h.object.userData.i as number;
    }
    return null;
  }

  function setPointer(e: PointerEvent) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  const onMove = (e: PointerEvent) => {
    isMouse = e.pointerType === "mouse";
    setPointer(e);
    pointerIn = true;
    pointerMoved = true;
    if (down && down.id === e.pointerId) {
      const dx = e.clientX - down.x;
      if (!down.drag && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - down.y)) {
        down.drag = true;
        // browsing the rail again puts the picked garment back
        if (state.selected !== null) {
          down.cam = camX;
          handlers.onPick(null);
        }
      }
      if (down.drag) {
        const perPx = visibleW() / width;
        camTarget = THREE.MathUtils.clamp(down.cam - dx * perPx, -camRange(), camRange());
      }
    }
  };
  const onDown = (e: PointerEvent) => {
    isMouse = e.pointerType === "mouse";
    setPointer(e);
    prevNdc.copy(ndc);
    pointerIn = true;
    down = { x: e.clientX, y: e.clientY, t: performance.now(), cam: camTarget, drag: false, id: e.pointerId };
  };
  const onUp = (e: PointerEvent) => {
    if (!down || down.id !== e.pointerId) return;
    const tap = !down.drag && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 10 && performance.now() - down.t < 700;
    down = null;
    if (tap) {
      setPointer(e);
      handlers.onPick(hit());
    }
    if (!isMouse) pointerIn = false;
  };
  const onCancel = () => {
    down = null;
    if (!isMouse) pointerIn = false;
  };
  const onLeave = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    pointerIn = false;
    if (hover !== null) handlers.onHover((hover = null));
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    handlers.onLost();
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("webglcontextlost", onLost);

  function resize() {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    camTarget = THREE.MathUtils.clamp(camTarget, -camRange(), camRange());
  }
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  // ---------- simulation ----------
  const inv = new THREE.Matrix4();
  const o = new THREE.Vector3(),
    d = new THREE.Vector3(),
    gLocal = new THREE.Vector3(),
    q = new THREE.Quaternion();
  let time = 0;

  function targets(g: Garment, i: number) {
    const sel = state.selected;
    const xT = g.base + (sel === null || sel === i ? 0 : i < sel ? -GAP : GAP);
    const yawT = sel === i ? (state.flipped ? Math.PI : 0) : hover === i ? HOVER_YAW : REST_YAW;
    const zT = sel === i ? 0.32 : hover === i ? 0.06 : 0;
    return { xT, yawT, zT };
  }

  function spring(g: Garment, i: number, dt: number) {
    const { xT, yawT, zT } = targets(g, i);
    const ax = 70 * (xT - g.x) - 12 * g.vx;
    const az = 70 * (zT - g.z) - 13 * g.vz;
    const ay = 45 * (yawT - g.yaw) - 9 * g.vyaw;
    g.vx += ax * dt;
    g.x += g.vx * dt;
    g.vz += az * dt;
    g.z += g.vz * dt;
    g.vyaw += ay * dt;
    g.yaw += g.vyaw * dt;
    g.ax = ax;
    g.az = az;
    g.ayaw = THREE.MathUtils.clamp(ay, -60, 60);
    // the hanger swings on the rail when it slides
    const at = -16 * g.tilt - 3.6 * g.vtilt + ax * 0.45;
    g.vtilt += at * dt;
    g.tilt += g.vtilt * dt;
    g.slide.position.x = g.x;
    g.swing.rotation.z = g.tilt;
    g.turn.position.z = g.z;
    g.turn.rotation.y = g.yaw;
  }

  function forces(g: Garment, push: boolean) {
    const c = g.cloth,
      a = c.acc,
      p = c.pos;
    // gravity minus the hanger's own acceleration, seen from the garment
    g.turn.getWorldQuaternion(q).invert();
    gLocal.set(-g.ax, -9.8, -g.az).applyQuaternion(q);
    const al = g.ayaw * 0.6,
      w2 = g.vyaw * g.vyaw;
    const breeze = 0.18 * Math.sin(time * 1.1 + g.phase);
    let hx = 0,
      hy = 0,
      dirZ = 0,
      vx = 0,
      vy = 0,
      strength = 0;
    if (push) {
      inv.copy(g.turn.matrixWorld).invert();
      o.copy(ray.ray.origin).applyMatrix4(inv);
      d.copy(ray.ray.direction).transformDirection(inv);
      if (Math.abs(d.z) > 0.12) {
        const t = -o.z / d.z;
        hx = o.x + d.x * t;
        hy = o.y + d.y * t;
        dirZ = Math.sign(d.z);
        if (g.lastHit) {
          vx = (hx - g.lastHit.x) * 60;
          vy = (hy - g.lastHit.y) * 60;
        }
        g.lastHit = (g.lastHit ?? new THREE.Vector2()).set(hx, hy);
        strength = Math.min(pointerSpeed, 3.5);
      } else g.lastHit = null;
    } else g.lastHit = null;
    const R = 0.34;
    for (let k = 0; k < c.inv.length; k++) {
      const x = p[k * 3],
        y = p[k * 3 + 1],
        z = p[k * 3 + 2];
      let fx = gLocal.x - al * z + w2 * x * 0.3,
        fy = gLocal.y,
        fz = gLocal.z + al * x + w2 * z * 0.3 + breeze * (0.4 - y);
      if (strength > 0) {
        const dd = Math.hypot(x - hx, y - hy);
        if (dd < R) {
          const fall = (1 - dd / R) ** 2;
          fz += dirZ * strength * 26 * fall;
          fx += THREE.MathUtils.clamp(vx, -6, 6) * 5 * fall;
          fy += THREE.MathUtils.clamp(vy, -6, 6) * 3 * fall;
        }
      }
      a[k * 3] = fx;
      a[k * 3 + 1] = fy;
      a[k * 3 + 2] = fz;
    }
  }

  let raf = 0,
    last = 0,
    acc = 0,
    running = false,
    visible = true;
  // Adaptive resolution: slow devices trade sharpness for a smooth sway.
  let spent = 0,
    counted = 0,
    calm = 0;

  function adapt(raw: number) {
    spent += raw;
    if (++counted < 45 && (spent < 0.75 || counted < 6)) return;
    const avg = spent / counted;
    spent = counted = 0;
    let next = ratio;
    if (avg > 1 / 40 && ratio > 0.5) next = Math.max(0.5, ratio * 0.8);
    else if (avg < 1 / 57 && ratio < maxRatio && ++calm >= 3) next = Math.min(maxRatio, ratio * 1.15);
    if (next !== ratio) {
      calm = 0;
      ratio = next;
      renderer.setPixelRatio(ratio);
      renderer.setSize(width, height, false);
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const raw = (now - (last || now)) / 1000;
    const dt = Math.min(raw, 1 / 20);
    if (last) adapt(raw);
    last = now;
    time += dt;

    // camera: follow the cursor across a long rail, or the picked garment, or a drag
    const range = camRange();
    if (state.selected !== null && !down?.drag) camTarget = THREE.MathUtils.clamp(garments[state.selected].base, -range, range);
    else if (isMouse && pointerIn && !down && range > 0) camTarget = ndc.x * range;
    camV += (90 * (camTarget - camX) - 18 * camV) * dt;
    camX += camV * dt;
    camera.position.set(camX + ndc.x * 0.05 * (pointerIn ? 1 : 0), LOOK_Y + 0.18, dist);
    camera.lookAt(camX, LOOK_Y, 0);
    camera.updateMatrixWorld();

    const dn = ndc.distanceTo(prevNdc);
    pointerSpeed = pointerMoved ? Math.min(dn / Math.max(dt, 1e-3), 8) : 0;
    prevNdc.copy(ndc);
    ray.setFromCamera(ndc, camera);
    if (isMouse && pointerIn && pointerMoved && !down) {
      const h = hit();
      if (h !== hover) handlers.onHover((hover = h));
      canvas.style.cursor = h === null ? "" : "pointer";
    }
    const push = pointerIn && pointerMoved && dn > 0.0005;
    pointerMoved = false;

    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 4) {
      garments.forEach((g, i) => spring(g, i, STEP));
      scene.updateMatrixWorld();
      garments.forEach((g) => {
        forces(g, push && steps === 0);
        g.cloth.step(STEP);
      });
      acc -= STEP;
      steps++;
    }
    if (steps === 4) acc = 0;
    for (const g of garments) {
      (g.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      g.geo.computeVertexNormals();
    }
    renderer.render(scene, camera);
  }

  function sync() {
    const should = visible && !document.hidden;
    if (should && !running) {
      running = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(raf);
    }
  }
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    sync();
  });
  io.observe(host);
  document.addEventListener("visibilitychange", sync);
  sync();

  return {
    set(next: RackState) {
      state = next;
    },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", sync);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("webglcontextlost", onLost);
      disposables.forEach((x) => x.dispose());
      renderer.dispose();
      // browsers cap live WebGL contexts; free this one now rather than at GC (city switches remount)
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

export type Rack = ReturnType<typeof createRack>;
