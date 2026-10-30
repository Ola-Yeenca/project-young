// Mock of the House of Young API for screenshot comparison with the prototype. Node built-ins only.
// Usage: node scripts/mock-api.mjs   (PORT=8019 by default)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "./fixture/data.mjs";

const PORT = Number(process.env.PORT) || 8019;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ART_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixture", "art");
const data = build(BASE_URL);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};
const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(body));
};
const notFound = (res) => send(res, 404, { detail: "Not found." });
const page = (results) => ({ count: results.length, next: null, previous: null, results });
const truthy = (v) => ["1", "true", "yes", "on"].includes(String(v ?? "").toLowerCase());

// ---------- list endpoints ----------

const byCity = (rows, q, pick = (r) => r.city?.slug) => (q.get("city") ? rows.filter((r) => pick(r) === q.get("city")) : rows);

function events(q) {
  const when = q.get("when") || "upcoming";
  const rows = when === "past" ? [...data.past].sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    : when === "all" ? [...data.events, ...data.past]
    : data.events;
  let out = byCity(rows, q);
  if (truthy(q.get("featured"))) out = out.filter((e) => e.is_featured);
  if (q.get("kind")) out = out.filter((e) => e.kind === q.get("kind"));
  return out.sort((a, b) => (when === "past" ? b.starts_at.localeCompare(a.starts_at) : a.starts_at.localeCompare(b.starts_at)));
}

function talent(q) {
  let out = byCity(data.talent, q);
  if (truthy(q.get("featured"))) out = out.filter((t) => t.is_featured);
  if (q.get("category")) out = out.filter((t) => t.category === q.get("category"));
  if (q.get("group")) out = out.filter((t) => t.group.toLowerCase() === q.get("group").toLowerCase());
  return out;
}

function gallery(q) {
  let out = byCity(data.albums, q);
  if (q.get("event")) out = out.filter((a) => a.event === q.get("event"));
  return out;
}

const products = (q) => (q.get("city") ? data.products.filter((p) => p.prices.some((x) => x.city === q.get("city"))) : data.products);

const detail = (rows) => (slug) => rows.find((r) => r.slug === slug);
const detailEvent = detail([...data.events, ...data.past]);
const detailTalent = detail(data.talentDetail);
const detailAlbum = detail(data.albumsDetail);
const detailProduct = detail(data.products);

// ---------- enquiries (mirrors EnquiryCreateMixin / Booking / Contact serializers) ----------

const REQ = "This field is required.", BLANK = "This field may not be blank.";
const EVENT_TYPES = ["concert", "club", "private", "corporate", "wedding", "festival", "other"];
const AUDIENCES = ["lt100", "100-300", "300-1000", "gt1000"];
const CATEGORIES = ["general", "talent", "collaboration", "business", "press", "other"];
const CITY_SLUGS = data.cities.map((c) => c.slug);
const TALENT_SLUGS = data.talent.map((t) => t.slug);
const counters = { CT: 0, BK: 0 };

function text(body, field, { max, required = false, blank = !required } = {}) {
  const v = body[field];
  if (v === undefined) return required ? [REQ] : null;
  if (v === null) return required ? ["This field may not be null."] : ["This field may not be null."];
  const s = String(v).trim();
  if (!s) return blank ? null : [BLANK];
  if (max && s.length > max) return [`Ensure this field has no more than ${max} characters.`];
  return null;
}
const choice = (body, field, options, required) => {
  const v = body[field];
  if (v === undefined || v === "") return required ? [v === "" ? '"" is not a valid choice.' : REQ] : null;
  return options.includes(v) ? null : [`"${v}" is not a valid choice.`];
};
const slugRef = (body, field, options) => {
  const v = body[field];
  if (v === undefined || v === null || v === "") return null;
  return options.includes(v) ? null : [`Object with slug=${v} does not exist.`];
};
function email(body) {
  const v = body.email;
  if (v === undefined || v === "") return null;
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v)) ? null : ["Enter a valid email address."];
}
function privacy(body) {
  const v = body.privacy_accepted;
  if (v === undefined) return [REQ];
  const t = [true, "true", "True", "1", 1, "on"].includes(v), f = [false, "false", "False", "0", 0, "off"].includes(v);
  if (!t && !f) return ["Must be a valid boolean."];
  return t ? null : ["Please accept the privacy policy so we can store your details."];
}
function eventDate(body) {
  const v = body.event_date;
  if (v === undefined || v === "") return [v === "" ? "Date has wrong format. Use one of these formats instead: YYYY-MM-DD." : REQ];
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v));
  const d = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  if (!d || d.getUTCMonth() !== +m[2] - 1) return ["Date has wrong format. Use one of these formats instead: YYYY-MM-DD."];
  return d < new Date(new Date().toISOString().slice(0, 10)) ? ["The event date is in the past."] : null;
}

function validate(kind, body) {
  const checks = kind === "BK"
    ? { talent: slugRef(body, "talent", TALENT_SLUGS), city: slugRef(body, "city", CITY_SLUGS),
        client_name: text(body, "client_name", { max: 120, required: true }), company: text(body, "company", { max: 120 }),
        email: email(body), phone: text(body, "phone", { max: 32 }), event_date: eventDate(body),
        event_location: text(body, "event_location", { max: 200, required: true }),
        event_type: choice(body, "event_type", EVENT_TYPES, true), expected_audience: choice(body, "expected_audience", AUDIENCES, true),
        message: text(body, "message"), privacy_accepted: privacy(body) }
    : { category: choice(body, "category", CATEGORIES, false), city: slugRef(body, "city", CITY_SLUGS),
        name: text(body, "name", { max: 120, required: true }), email: email(body), phone: text(body, "phone", { max: 32 }),
        subject: text(body, "subject", { max: 160 }), message: text(body, "message", { required: true }), privacy_accepted: privacy(body) };
  const errors = Object.fromEntries(Object.entries(checks).filter(([, v]) => v));
  if (Object.keys(errors).length) return errors;
  // Object-level validation only runs once every field is valid, as in DRF.
  if (String(body.website ?? "")) return { non_field_errors: ["We couldn't send this form."] };
  if (!String(body.email ?? "").trim() && !String(body.phone ?? "").trim()) return { email: ["Give an email address or a phone number so we can reply."] };
  return null;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  if ((req.headers["content-type"] || "").includes("application/x-www-form-urlencoded")) return Object.fromEntries(new URLSearchParams(raw));
  try { const j = JSON.parse(raw); return j && typeof j === "object" && !Array.isArray(j) ? j : null; } catch { return null; }
}

async function enquiry(req, res, kind) {
  if (req.headers["x-mock-throttle"] === "1") return send(res, 429, { detail: "Request was throttled." }, { "Retry-After": "60" });
  const body = await readBody(req);
  if (body === null) return send(res, 400, { non_field_errors: ["Invalid data. Expected a dictionary."] });
  const errors = validate(kind, body);
  if (errors) return send(res, 400, errors);
  const n = String(++counters[kind] + 260000);
  send(res, 201, { reference: `HOY-${kind}-${n.slice(0, 2)}${n.slice(2).padStart(4, "0")}`, status: "received" });
}

// ---------- routing ----------

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, BASE_URL);
    const q = url.searchParams;
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

    if (path.startsWith("/media/art/") && (req.method === "GET" || req.method === "HEAD")) {
      try {
        const buf = await readFile(join(ART_DIR, basename(path)));
        res.writeHead(200, { ...CORS, "Content-Type": "image/png", "Content-Length": buf.length, "Cache-Control": "public, max-age=3600", "Cross-Origin-Resource-Policy": "cross-origin" });
        return res.end(req.method === "HEAD" ? undefined : buf);
      } catch { return notFound(res); }
    }
    if (!path.startsWith("/api/v1")) return notFound(res);
    const route = path.slice("/api/v1".length) || "/";

    if (req.method === "POST") {
      if (route === "/enquiries/contact") return enquiry(req, res, "CT");
      if (route === "/enquiries/booking") return enquiry(req, res, "BK");
      return send(res, route.startsWith("/enquiries") ? 404 : 405, { detail: route.startsWith("/enquiries") ? "Not found." : 'Method "POST" not allowed.' });
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { detail: `Method "${req.method}" not allowed.` });

    if (route === "/health") return send(res, 200, { status: "ok" });
    if (route === "/cities") return send(res, 200, data.cities);
    if (route === "/faqs") return send(res, 200, data.faqs);
    if (route === "/site") return send(res, 200, data.site);
    if (route === "/events") return send(res, 200, page(events(q)));
    if (route === "/talent") return send(res, 200, page(talent(q)));
    if (route === "/gallery") return send(res, 200, page(gallery(q)));
    if (route === "/products") return send(res, 200, page(products(q)));

    const m = /^\/(events|talent|gallery|products)\/([^/]+)$/.exec(route);
    if (m) {
      const slug = decodeURIComponent(m[2]);
      const row = { events: detailEvent, talent: detailTalent, gallery: detailAlbum, products: detailProduct }[m[1]](slug);
      return row ? send(res, 200, row) : notFound(res);
    }
    return notFound(res);
  } catch (err) {
    console.error(err);
    send(res, 500, { detail: "Server error." });
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`HOY mock API on ${BASE_URL}/api/v1`));
