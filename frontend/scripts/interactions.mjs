// Interaction checks for the verification pass. Usage:
//   node scripts/interactions.mjs [baseUrl=http://localhost:3003] [formsBaseUrl]
// formsBaseUrl (optional) is a build wired to a real local API; both forms are submitted there.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.argv[2] || "http://localhost:3003";
const FORMS = process.argv[3];
const out = [];
const note = (ok, name, detail) => out.push(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const errors = [];
async function page(w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
  p.on("pageerror", (e) => errors.push(e.message));
  // Record what the page tells the deck about the hand, so "hold to stop" can be checked.
  await p.addInitScript(() => {
    window.__hand = [];
    const W = window.AudioWorkletNode;
    if (!W) return;
    window.AudioWorkletNode = class extends W {
      constructor(...a) {
        super(...a);
        const post = this.port.postMessage.bind(this.port);
        this.port.postMessage = (m, t) => {
          if (m.k === "hand") window.__hand.push(m.on);
          return post(m, t);
        };
      }
    };
  });
  return p;
}

// ---- desktop: hero, side discs, auto-advance, marquee, peek, strip, wipe, sheets ----
{
  const p = await page(1440, 900);
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await wait(1500);
  const n = () => p.locator(".pager .n").first().textContent();
  await p.click(".label");
  await wait(600);
  const playing = await p.locator(".platter.playing").count();
  const kick = await p.locator(".kick .mono").textContent();
  note(playing === 1 && /HOY Radio/.test(kick), "Play", `platter.playing=${playing}, kicker "${kick}"`);
  const d = await p.locator(".disc").boundingBox();
  const cx = d.x + d.width / 2, cy = d.y + d.height / 2;
  await p.mouse.move(cx + d.width * 0.35, cy);
  await p.mouse.down();
  const grab = await p.locator(".disc.grab").count();
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    await p.mouse.move(cx + Math.cos(a) * d.width * 0.35, cy + Math.sin(a) * d.width * 0.35);
    await wait(16);
  }
  await wait(300);
  await p.mouse.up();
  await wait(200);
  const hand = await p.evaluate(() => window.__hand);
  note(grab === 1, "Scratch", `.disc.grab while held=${grab}; dragged a half turn`);
  note(hand[0] === true && hand.at(-1) === false, "Hold to stop", `hand on the record ${JSON.stringify(hand)}`);
  await p.click(".label");
  await wait(400);
  note((await p.locator(".platter.playing").count()) === 0, "Stop", "platter.playing cleared");
  const before = await n();
  await p.locator(".side-disc.r").click();
  await wait(400);
  const afterR = await n();
  note(before !== afterR, "Side disc", `${before} → ${afterR} (right disc), visible at 1440`);
  await p.mouse.move(5, 5);
  const t0 = await n();
  await wait(9800);
  const t1 = await n();
  note(t0 !== t1, "Auto-advance", `${t0} → ${t1} after 9.8s idle`);

  const x = () => p.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector(".mq .tr")).transform).m41);
  const a0 = await x(); await wait(500); const a1 = await x();
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, 120); await wait(30); }
  const b0 = await x(); await wait(200); const b1 = await x();
  for (let i = 0; i < 6; i++) { await p.mouse.wheel(0, -120); await wait(30); }
  await wait(50);
  const c0 = await x(); await wait(200); const c1 = await x();
  note(b1 - b0 < a1 - a0 && c1 - c0 > 0, "Marquee", `idle ${((a1 - a0) * 2).toFixed(0)}px/s, scrolling down ${((b1 - b0) * 5).toFixed(0)}px/s, after scrolling up ${((c1 - c0) * 5).toFixed(0)}px/s (direction flips)`);

  await p.locator("#home-idx .row").first().scrollIntoViewIfNeeded();
  await wait(900);
  const r = await p.locator("#home-idx .row").first().boundingBox();
  await p.mouse.move(r.x + 200, r.y + r.height / 2);
  await p.mouse.move(r.x + 260, r.y + r.height / 2, { steps: 5 });
  await wait(400);
  const peekOn = await p.locator("#home-idx .peek.on").count();
  const pt0 = await p.locator("#home-idx .peek").evaluate((e) => e.style.transform);
  await p.mouse.move(r.x + 600, r.y + r.height / 2, { steps: 8 });
  await wait(300);
  const pt1 = await p.locator("#home-idx .peek").evaluate((e) => e.style.transform);
  note(peekOn === 1 && pt0 !== pt1, "Index peek", `peek.on=${peekOn}; follows cursor (${pt0.slice(0, 40)}… → ${pt1.slice(0, 40)}…)`);

  await p.locator("#home-strip").scrollIntoViewIfNeeded();
  await p.mouse.move(5, 5);
  const s0 = await p.locator("#home-strip").evaluate((e) => e.scrollLeft);
  await wait(2000);
  const s1 = await p.locator("#home-strip").evaluate((e) => e.scrollLeft);
  note(s1 > s0, "Strip drift", `scrollLeft ${s0.toFixed(1)} → ${s1.toFixed(1)} in 2s (~${((s1 - s0) / 2).toFixed(0)}px/s; prototype constant .025px/ms = 25px/s)`);

  await p.locator("#home-idx .row").first().click();
  await wait(700);
  const open = await p.locator(".sheet.open").count();
  const url1 = new URL(p.url()).pathname;
  await p.keyboard.press("Escape");
  await wait(600);
  const url2 = new URL(p.url()).pathname;
  note(open === 1 && url1.startsWith("/events/") && (await p.locator(".sheet.open").count()) === 0 && url2 === "/", "Event sheet", `opens over Home at ${url1}, Escape closes back to ${url2}`);
  await p.goto(BASE + "/talent/dj-tolu", { waitUntil: "networkidle" });
  await wait(800);
  const direct = await p.locator(".sheet.open h2").textContent();
  await p.locator(".sheet .dim").click({ position: { x: 20, y: 20 } });
  await wait(600);
  note(direct === "DJ Tolu" && new URL(p.url()).pathname === "/talent", "Talent sheet (direct link)", `opens "${direct}", dim click closes to ${new URL(p.url()).pathname}`);

  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await wait(800);
  const title0 = await p.locator(".notes h1").textContent();
  await p.locator(".city button", { hasText: "Lagos" }).click();
  await wait(450);
  const wipeOn = await p.locator(".wipe.on").count();
  const wipeText = await p.locator(".wipe b").textContent();
  await wait(2400);
  const wipeGone = await p.locator(".wipe.on").count();
  const title1 = await p.locator(".notes h1").textContent();
  note(wipeOn === 1 && wipeText === "Lagos" && wipeGone === 0 && title0 !== title1, "City switch", `gallery shuffle shows "${wipeText}", exits; record "${title0}" → "${title1}"`);
  await p.close();
}

// ---- mobile: now-playing pill above the tabs ----
{
  const p = await page(390, 844);
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await wait(1200);
  await p.click(".label");
  await wait(900);
  const np = await p.locator(".np").boundingBox();
  const tabs = await p.locator(".tabs").boundingBox();
  const vis = await p.locator(".np.on").count();
  note(vis === 1 && np.y + np.height <= tabs.y, "Now-playing pill (390×844)", `pill bottom ${Math.round(np.y + np.height)} ≤ tabs top ${Math.round(tabs.y)} (gap ${Math.round(tabs.y - np.y - np.height)}px)`);
  await p.locator(".np button").click();
  await wait(700);
  note((await p.locator(".np.on").count()) === 0, "Pill stop", "■ stops the groove and hides the pill");
  await p.close();
}

// ---- forms against a real local API ----
if (FORMS) {
  const p = await page(1280, 800);
  await p.goto(FORMS + "/contact", { waitUntil: "networkidle" });
  await p.locator("#reasons button", { hasText: "Press" }).click();
  await p.fill('#cform [name="name"]', "Verification run");
  await p.fill('#cform [name="email"]', "verify@example.com");
  await p.fill('#cform [name="message"]', "Press kit please\nFrom the verification script.");
  await p.check('#cform [name="privacy_accepted"]');
  await p.click('#cform [type="submit"]');
  await p.waitForSelector("#cbox .sent", { timeout: 15000 }).catch(() => {});
  const c = await p.locator("#cbox .sent .mono").textContent().catch(() => "none");
  note(/HOY-/.test(c), "Contact form", `local API returned "${c}"`);
  const slug = await (await fetch(FORMS + "/api/v1/talent/?city=valencia")).json().then((d) => d.results[0].slug);
  await p.goto(FORMS + "/talent/" + slug, { waitUntil: "networkidle" });
  await wait(800);
  const f = "#bform";
  await p.fill(`${f} [name="client_name"]`, "Verification run");
  await p.fill(`${f} [name="email"]`, "verify@example.com");
  const day = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  await p.fill(`${f} [name="event_date"]`, day);
  await p.fill(`${f} [name="event_location"]`, "Valencia, test venue");
  await p.check(`${f} [name="privacy_accepted"]`);
  await p.click(`${f} [type="submit"]`);
  await p.waitForSelector("#bbox .sent", { timeout: 15000 }).catch(() => {});
  const bk = await p.locator("#bbox .sent .mono").textContent().catch(() => "none");
  note(/HOY-/.test(bk), "Booking form", `local API returned "${bk}" for ${slug}`);
  await p.close();
}

note(errors.length === 0, "Console", errors.length ? errors.join(" | ") : "no errors");
await b.close();
console.log(out.join("\n"));
