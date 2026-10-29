// Screenshot parity: the prototype vs the build, same fixture content, side by side.
// Usage (from frontend/):
//   node scripts/screens.mjs                 all pages × viewports × schemes
//   node scripts/screens.mjs home events     only these pages
//   PROTO=http://127.0.0.1:8018/ BUILD=http://localhost:3001 API=http://127.0.0.1:8019/api/v1 node scripts/screens.mjs
// Writes reference/screens/{page}-{w}x{h}-{scheme}-{proto,build,side}.png and prints a pixel diff
// score per pair (share of pixels that differ noticeably, plus the two page heights).
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, "reference", "screens");
const PROTO = process.env.PROTO ?? "http://127.0.0.1:8018/";
const BUILD = (process.env.BUILD ?? "http://localhost:3001").replace(/\/$/, "");
const API = (process.env.API ?? "http://127.0.0.1:8019/api/v1").replace(/\/$/, "");
const TIME = "2026-10-06T19:00:00Z";
const VIEWPORTS = [
  [390, 844],
  [768, 1024],
  [1280, 800],
  [1440, 900],
];
const SCHEMES = ["light", "dark"];
const PAGES = ["home", "events", "talent", "gallery", "shop", "contact"];
const only = process.argv.slice(2);
const pages = only.length ? PAGES.filter((p) => only.includes(p)) : PAGES;
const CONCURRENCY = Number(process.env.JOBS) || 4;

// The prototype scrolls inside .app; let the document scroll instead so a full-page shot works.
const PROTO_LAYOUT = `.proto,.ops{display:none!important}.stage{display:block!important}
html,body{height:auto!important}.app{overflow:visible!important;max-height:none!important}`;

// Applied to both just before capture: freeze everything that moves so frames compare.
const FREEZE = `*,*::before,*::after{animation-play-state:paused!important;transition:none!important;caret-color:transparent!important}
.grain::after{display:none!important}
.mq .tr{transform:none!important}
.rot{transform:none!important}
.ripple{display:none!important}
.pulse{opacity:.3!important;transform:none!important}
.glow{opacity:.3!important}
.disc{transform:none!important}
.eq i{height:50%!important}
.strip .ph canvas,.strip .ph img{transform:none!important}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function firstTalentSlug() {
  const r = await fetch(`${API}/talent/?city=valencia`);
  const j = await r.json();
  return j.results[0].slug;
}

async function settle(page) {
  await page.evaluate(() => document.fonts.ready);
  await sleep(2500);
  // Scroll the document to the bottom and back in steps so scroll reveals fire.
  await page.evaluate(async () => {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(200, innerHeight * 0.6);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await wait(60);
    }
    scrollTo(0, document.documentElement.scrollHeight);
    await wait(200);
    for (let y = document.documentElement.scrollHeight; y > 0; y -= step * 2) {
      scrollTo(0, y);
      await wait(30);
    }
    scrollTo(0, 0);
    await wait(1100); // reveal transitions are .9s plus small delays
  });
}

async function freeze(page) {
  await page.addStyleTag({ content: FREEZE });
  await page.evaluate(() => {
    // Finite animations jump to their end state; infinite ones stop at their first frame.
    for (const a of document.getAnimations()) {
      try {
        a.finish();
      } catch {
        a.pause();
        a.currentTime = 0;
      }
    }
    // Stop JS loops (turntable, drift, auto-advance, clocks).
    window.requestAnimationFrame = () => 0;
    // (Playwright's clock numbers its timers from 1e12.)
    const top = setTimeout(() => {}, 0);
    for (let i = Math.max(0, top - 1e5); i <= top; i++) {
      for (const f of [clearTimeout, clearInterval, cancelAnimationFrame])
        try {
          f(i);
        } catch {
          /* id belongs to another kind of timer */
        }
    }
    // SMIL (the dot travelling between the cities) back to its start.
    document.querySelectorAll("svg").forEach((s) => {
      s.pauseAnimations();
      s.setCurrentTime(0);
    });
    document.querySelectorAll(".strip").forEach((s) => (s.scrollLeft = 0));
    scrollTo(0, 0);
  });
  await sleep(150);
}

async function shoot(browser, side, name, [w, h], scheme, file, slug) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(TIME));
  if (side === "proto") {
    await page.goto(PROTO + "#" + name, { waitUntil: "load" });
    await page.addStyleTag({ content: PROTO_LAYOUT });
    await settle(page);
    if (name === "talent") {
      await page.click("#all-lineup .names button");
      await page.mouse.move(1, 1); // off the names, so the cursor peek doesn't stay up
      await sleep(1500);
    }
  } else {
    const path = name === "home" ? "/" : name === "talent" ? `/talent/${slug}` : `/${name}`;
    await page.goto(BUILD + path, { waitUntil: "networkidle" });
    await settle(page);
    if (name === "talent") await sleep(1500);
  }
  await freeze(page);
  await page.screenshot({ path: file, fullPage: true });
  await ctx.close();
}

// Side-by-side composite plus a pixel diff score, both done in a page.
async function composite(browser, a, b, out) {
  const { readFile } = await import("node:fs/promises");
  const [pa, pb] = await Promise.all([readFile(a), readFile(b)]);
  const ctx = await browser.newContext({ viewport: { width: 400, height: 400 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const html = `<!doctype html><style>body{margin:0;background:#888;font:12px monospace}
    .row{display:flex;gap:16px;padding:16px;align-items:flex-start;width:max-content}
    figure{margin:0}figcaption{color:#fff;padding:0 0 6px}img{display:block}</style>
    <div class="row"><figure><figcaption>prototype</figcaption><img id="a" src="data:image/png;base64,${pa.toString("base64")}"></figure>
    <figure><figcaption>build</figcaption><img id="b" src="data:image/png;base64,${pb.toString("base64")}"></figure></div>`;
  await page.setContent(html);
  const stats = await page.evaluate(async () => {
    const imgs = [...document.images];
    await Promise.all(imgs.map((i) => i.decode()));
    const [A, B] = imgs;
    const w = Math.min(A.naturalWidth, B.naturalWidth),
      h = Math.min(A.naturalHeight, B.naturalHeight);
    const px = (img) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      return g.getImageData(0, 0, w, h).data;
    };
    const da = px(A),
      db = px(B);
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 48) diff++;
    }
    return { protoH: A.naturalHeight, buildH: B.naturalHeight, diff: +((diff / (w * h)) * 100).toFixed(2) };
  });
  await page.screenshot({ path: out, fullPage: true });
  await ctx.close();
  return stats;
}

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });
const slug = await firstTalentSlug();
const jobs = [];
for (const name of pages) for (const vp of VIEWPORTS) for (const scheme of SCHEMES) jobs.push({ name, vp, scheme });
const results = [];
let next = 0;
async function worker() {
  while (next < jobs.length) {
    const { name, vp, scheme } = jobs[next++];
    const base = join(OUT, `${name}-${vp[0]}x${vp[1]}-${scheme}`);
    try {
      await shoot(browser, "proto", name, vp, scheme, `${base}-proto.png`, slug);
      await shoot(browser, "build", name, vp, scheme, `${base}-build.png`, slug);
      const s = await composite(browser, `${base}-proto.png`, `${base}-build.png`, `${base}-side.png`);
      results.push({ shot: `${name}-${vp[0]}x${vp[1]}-${scheme}`, ...s });
      console.log(`${name}-${vp[0]}x${vp[1]}-${scheme}`.padEnd(30), `h ${s.protoH} / ${s.buildH}`.padEnd(18), `diff ${s.diff}%`);
    } catch (e) {
      console.error(`${name}-${vp[0]}x${vp[1]}-${scheme} failed:`, e.message);
      results.push({ shot: `${name}-${vp[0]}x${vp[1]}-${scheme}`, error: e.message });
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
await browser.close();
results.sort((a, b) => a.shot.localeCompare(b.shot));
await writeFile(join(OUT, "scores.json"), JSON.stringify(results, null, 1) + "\n");
