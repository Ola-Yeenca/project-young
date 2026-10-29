// Renders the prototype's stand-in art (field() from reference/prototype.html L582-589) to PNGs.
// Usage: node scripts/fixture/make-art.mjs
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { artList } from "./data.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "art");

// Playwright is a frontend devDependency.
const loadPlaywright = () => createRequire(import.meta.url)("playwright");

// Copied verbatim from the prototype.
const FIELD_CODE = String.raw`
const PAL=[["#7d1a1f","#e0954f","#f2dcb9"],["#14231f","#c9a043","#3f6b5a"],["#26375f","#d9c3a0","#9b3a2c"],["#3a2a4a","#d08a3e","#f2e2c6"],["#1d1b18","#b98a3a","#e9dcc0"],["#6f2638","#eaa36c","#2a1a17"],["#20304a","#e6b85c","#c4583a"],["#40261a","#d6a66b","#f1e6d2"],["#123a33","#e5c37a","#f0e8d8"]];
function rng(s){let x=(s+1)*9301+49297;return()=>(x=(x*9301+49297)%233280)/233280;}
function grainPx(g,w,h,r,a){const id=g.getImageData(0,0,w,h),d=id.data;for(let i=0;i<d.length;i+=4){const n=(r()-.5)*a;d[i]+=n;d[i+1]+=n;d[i+2]+=n;}g.putImageData(id,0,0);}
function field(cv,seed,w,h){cv.width=w;cv.height=h;const g=cv.getContext("2d"),r=rng(seed),p=PAL[seed%PAL.length];
  g.fillStyle=p[0];g.fillRect(0,0,w,h);
  for(let i=0;i<8;i++){const x=r()*w,y=r()*h,rad=(.3+r()*.7)*Math.max(w,h),c=p[1+(i%2)],gr=g.createRadialGradient(x,y,0,x,y,rad);gr.addColorStop(0,c);gr.addColorStop(1,c+"00");g.globalAlpha=.45+r()*.45;g.fillStyle=gr;g.fillRect(0,0,w,h);}
  g.globalAlpha=1;grainPx(g,w,h,r,12);}
`;

const { chromium } = loadPlaywright();
mkdirSync(outDir, { recursive: true });
const jobs = artList();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(`<html><body><script>${FIELD_CODE}</script></body></html>`);
for (const { seed, w, h, file } of jobs) {
  const b64 = await page.evaluate(([s, ww, hh]) => { const cv = document.createElement("canvas"); field(cv, s, ww, hh); return cv.toDataURL("image/png").split(",")[1]; }, [seed, w, h]);
  writeFileSync(join(outDir, file), Buffer.from(b64, "base64"));
}
await browser.close();
console.log(`wrote ${jobs.length} images to ${outDir}`);
