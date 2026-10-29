// House of Young mock API data: the prototype's `D` object (reference/prototype.html L542-573)
// converted to the API's JSON shapes (backend/api/serializers.py, lib/types.ts).

const D = {
  valencia: {
    label: "Valencia", tz: "Europe/Madrid", wa: "+34 600 000 000", prov: "Fourvenues",
    events: [
      { t: "Afrobeats Night", d: "Sat 18 Oct", time: "23:00", v: "La3 Club", p: 15, sold: 72, seed: 3, kind: "Club", bpm: 104, style: "afro", lu: ["DJ Tolu", "Kemi Adé (live)", "Sade Rivera"], cap: "The night that started it all. Every word sung back." },
      { t: "Amapiano Sunset", d: "Sun 02 Nov", time: "18:00", v: "Marina Beach Club", p: 12, sold: 41, seed: 1, kind: "Day", bpm: 112, style: "piano", lu: ["Sade Rivera", "DJ Tolu b2b guests"], cap: "Log drums, salt air, an early finish on the marina." },
      { t: "Open Mic", d: "Sat 15 Nov", time: "20:00", v: "Espai Rambleta", p: 0, sold: 18, seed: 5, kind: "Live", bpm: 92, style: "afro", lu: ["Kemi Adé", "MC Nene (host)", "New voices"], cap: "One mic, new voices from the roster and the city. Free." },
      { t: "Detty December", d: "Sat 06 Dec", time: "23:30", v: "Mya Club", p: 18, sold: 9, seed: 2, kind: "Club", bpm: 110, style: "piano", lu: ["DJ Tolu", "Lagos Collective", "Special guest"], cap: "The send-off before everyone flies home for Christmas." }],
    past: [{ t: "Independence Party", d: "Sat 04 Oct", v: "La3 Club", seed: 4 }, { t: "Summer Beach Bash", d: "Sat 23 Aug", v: "Malvarrosa", seed: 0 }],
    talent: [
      { n: "Kemi Adé", g: "Vocalist", cat: "Live", bio: "Lagos-born, Valencia-based singer. Headlined four HOY nights in 2026 and supported touring acts at Marina Beach Club.", work: "Afrobeats Night headline · Marina Beach Club residency · Benicàssim fringe", seed: 21 },
      { n: "DJ Tolu", g: "DJ · Afrobeats, Amapiano", cat: "DJs", bio: "Resident DJ for HOY Valencia. Two-hour sets from classic Afrobeats into Amapiano and Afro house.", work: "HOY resident since 2025 · Amapiano Sunset · corporate bookings", seed: 33 },
      { n: "Lagos Collective", g: "Dance crew", cat: "Live", bio: "Six-piece crew performing Afro-fusion choreography for stage shows, launches and music videos.", work: "Brand launch, Valencia · music videos · festival stages", seed: 45 },
      { n: "MC Nene", g: "Host · EN/ES", cat: "Hosts", bio: "Bilingual host for events, award nights and brand activations.", work: "HOY event host · corporate award nights", seed: 57 },
      { n: "Sade Rivera", g: "DJ · Afro house", cat: "DJs", bio: "Late-slot specialist. Deep Afro house and Amapiano for the last two hours.", work: "Club residencies, Valencia · festival sets", seed: 69 }],
    albums: ["All", "Afrobeats Night", "Summer Beach Bash", "Independence Party"],
    products: [{ n: "Heavyweight Tee", p: 30, mat: "240 gsm cotton", fit: "Boxy", s: ["S", "M", "L", "XL"], cap: "Black on black. The gold mark on the chest and nothing else.", seed: 6 }, { n: "Gold Mark Cap", p: 25, mat: "Washed cotton", fit: "One size", s: ["OS"], cap: "Six panel, low profile, embroidered mark.", seed: 7 }, { n: "City Hoodie · VLC", p: 55, mat: "400 gsm fleece", fit: "Relaxed", s: ["S", "M", "L", "XL"], cap: "City edition. VLC on the sleeve, coordinates on the back.", seed: 8 }],
  },
  lagos: {
    label: "Lagos", tz: "Africa/Lagos", wa: "+234 800 000 0000", prov: "Tix.africa",
    events: [
      { t: "HOY Live Lagos", d: "Sat 25 Oct", time: "20:00", v: "Landmark Beach, Oniru", p: 10000, sold: 64, seed: 2, kind: "Live", bpm: 102, style: "afro", lu: ["Zara Obi (band)", "DJ Kayz", "Tobi K (host)"], cap: "Live sets on the sand. Doors at sunset." },
      { t: "Rooftop Sessions 3", d: "Sat 08 Nov", time: "19:00", v: "The Backyard, VI", p: 7500, sold: 47, seed: 4, kind: "Live", bpm: 96, style: "afro", lu: ["Ebun & The Band", "Ife Sounds"], cap: "Third edition. Highlife, a rooftop and the Island skyline." },
      { t: "Industry Mixer", d: "Fri 21 Nov", time: "18:00", v: "Alliance Française, Ikoyi", p: 0, sold: 80, seed: 0, kind: "Talk", bpm: 100, style: "afro", lu: ["Tobi K (host)", "Promoters, venues, press"], cap: "Invite-only. Free with registration." },
      { t: "Detty December", d: "Sat 13 Dec", time: "21:00", v: "Muri Okunola Park", p: 15000, sold: 100, seed: 3, kind: "Club", bpm: 113, style: "piano", lu: ["DJ Kayz", "Zara Obi", "Surprise guests"], cap: "Sold out. The waitlist is open." }],
    past: [{ t: "Rooftop Sessions 2", d: "Sat 13 Sep", v: "The Backyard", seed: 5 }, { t: "Freedom Day Concert", d: "Wed 01 Oct", v: "Landmark Beach", seed: 1 }],
    talent: [
      { n: "Zara Obi", g: "Singer-songwriter", cat: "Live", bio: "Lagos singer with two EPs and a growing live following. Plays with a four-piece band or acoustic.", work: "Rooftop Sessions headline · Lagos Fringe 2026 · radio sessions", seed: 24 },
      { n: "DJ Kayz", g: "DJ · Afrobeats, Amapiano", cat: "DJs", bio: "Mainland-raised, Island-booked. Open-format sets at the city's biggest rooftop nights.", work: "HOY Live Lagos resident · club residencies, VI · festivals", seed: 36 },
      { n: "Ebun & The Band", g: "Highlife, Afro-jazz", cat: "Live", bio: "Seven-piece band for weddings, galas and concerts. Highlife classics to current Afrobeats.", work: "Corporate galas · wedding circuit · concert support", seed: 48 },
      { n: "Tobi K", g: "Comedy · host", cat: "Hosts", bio: "Stand-up and event host. Sharp, clean sets for brand events and award nights.", work: "Industry Mixer host · brand activations", seed: 60 },
      { n: "Ife Sounds", g: "DJ · Afro house", cat: "DJs", bio: "Sunset and afters specialist across the Island.", work: "Landmark Beach · private villas", seed: 72 }],
    albums: ["All", "HOY Live Lagos", "Rooftop Sessions", "Freedom Day"],
    products: [{ n: "Heavyweight Tee", p: 25000, mat: "240 gsm cotton", fit: "Boxy", s: ["S", "M", "L", "XL"], cap: "Black on black. The gold mark on the chest and nothing else.", seed: 6 }, { n: "Gold Mark Cap", p: 18000, mat: "Washed cotton", fit: "One size", s: ["OS"], cap: "Six panel, low profile, embroidered mark.", seed: 7 }, { n: "City Hoodie · LOS", p: 45000, mat: "400 gsm fleece", fit: "Relaxed", s: ["S", "M", "L", "XL"], cap: "City edition. LOS on the sleeve, coordinates on the back.", seed: 8 }],
  },
};

const CITIES = {
  valencia: { name: "Valencia", slug: "valencia", country: "Spain", currency: "EUR", currency_symbol: "€", timezone: "Europe/Madrid", ticket_provider: "Fourvenues", whatsapp_number: "+34 600 000 000", instagram_url: "" },
  lagos: { name: "Lagos", slug: "lagos", country: "Nigeria", currency: "NGN", currency_symbol: "₦", timezone: "Africa/Lagos", ticket_provider: "Tix.africa", whatsapp_number: "+234 800 000 0000", instagram_url: "" },
};

const FAQS = [
  ["How do I buy tickets?", "Every event has a Buy tickets button. It opens our ticket partner for that city, where you pay and get a QR ticket by email."],
  ["How do I book an artist?", "Open the artist and send an enquiry with date, location and audience. We reply within one working day with availability and a quote."],
  ["Can we collaborate on an event?", "Yes. Pick Collaboration below and tell us the venue, date and what you bring."],
  ["Do you work outside Valencia and Lagos?", "We travel for the right booking. Send the location and we will confirm."],
  ["Press and media", "Pick Press below and we send the press kit."],
].map(([question, answer]) => ({ category: "general", question, answer }));

const ABOUT = "House of Young started as a collective putting on nights for the African diaspora in Valencia. It grew into an entertainment company with a second home in Lagos. We produce events, represent and book artists, and keep a record of every room we fill.";

const ARS = ["4/5", "3/2", "4/5", "1/1", "4/5", "3/2", "4/5", "4/5"];
const FRAMES = 9;
const MONTHS = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const GROUPS = { DJs: "dj", Live: "vocalist", Hosts: "host" };
const STYLES = { piano: "amapiano", afro: "afrobeats" };

export const kebab = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ISO timestamp with the zone's real UTC offset for that local date/time (2026).
function isoLocal(tz, y, mo, d, hh, mm) {
  const utcGuess = Date.UTC(y, mo - 1, d, hh, mm);
  const part = new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date(utcGuess)).find((p) => p.type === "timeZoneName").value;
  const off = part === "GMT" ? "+00:00" : part.replace("GMT", "");
  const pad = (n) => String(n).padStart(2, "0");
  return `${y}-${pad(mo)}-${pad(d)}T${pad(hh)}:${pad(mm)}:00${off}`;
}

export function build(base) {
  const img = (seed, w, h) => `${base}/media/art/${seed}-${w}x${h}.png`;
  const out = { cities: Object.values(CITIES), events: [], past: [], talent: [], talentDetail: [], albums: [], albumsDetail: [], products: [], faqs: FAQS, site: { tagline: "", about: ABOUT, instagram_url: "", tiktok_url: "", youtube_url: "", show_powered_by: true } };

  for (const [key, c] of Object.entries(D)) {
    const city = CITIES[key];
    const ref = { name: city.name, slug: key };
    const talentSlug = new Map(c.talent.map((t) => [t.n, kebab(t.n)]));
    const venue = (name) => ({ name, slug: kebab(name), address: "", map_url: "" });

    const event = (e, past) => {
      const [, dd, mon] = e.d.split(" ");
      const time = past ? "20:00" : e.time;
      const [hh, mm] = time.split(":").map(Number);
      return {
        title: e.t, slug: `${kebab(e.t)}-${key}`, city: ref, venue: venue(e.v),
        kind: past ? "club" : e.kind.toLowerCase(),
        starts_at: isoLocal(c.tz, 2026, MONTHS[mon], +dd, hh, mm), ends_at: null,
        local: { date: e.d, time, timezone: c.tz },
        poster: img(e.seed, 600, 750), poster_alt: e.t, poster_fit: "cover",
        caption: past ? "" : e.cap, description: past ? "" : e.cap,
        lineup: past ? [] : e.lu.map((name) => ({ name, slug: talentSlug.get(name) ?? null })),
        music_style: past ? "afrobeats" : STYLES[e.style], bpm: past ? null : e.bpm,
        ticket_url: "https://example.com/" + city.ticket_provider, ticket_provider: city.ticket_provider,
        price_from: past ? null : String(e.p), currency: city.currency, currency_symbol: city.currency_symbol,
        is_free: !past && e.p === 0, sold_out: !past && e.sold >= 100, sold_percent: past ? 0 : e.sold, // prototype past rows carry no sold figure
        age_restriction: "18+", is_featured: true, is_cancelled: false,
      };
    };
    out.events.push(...c.events.map((e) => event(e, false)));
    out.past.push(...c.past.map((e) => event(e, true)));

    for (const t of c.talent) {
      const list = {
        name: t.n, slug: kebab(t.n), city: ref, category: GROUPS[t.cat], group: t.cat, genre: t.g,
        photo: img(t.seed, 600, 750), booking_available: true, is_featured: true,
      };
      out.talent.push(list);
      out.talentDetail.push({
        ...list, bio: t.bio, previous_work: t.work.split(" · "), travels: true,
        links: ["Spotify", "Apple Music", "YouTube", "Instagram", "TikTok"].map((label) => ({ label, url: "https://example.com/" })),
        media: [], upcoming_events: [],
      });
    }

    // Albums: the prototype's strip() frames for the "All" chip, distributed over the 3 real albums.
    const real = c.albums.slice(1);
    const items = real.map(() => []);
    for (let i = 0; i < FRAMES; i++) {
      const ar = ARS[i % ARS.length], w = ar === "3/2" ? 820 : 560, h = 480;
      const seed = 10 + i * 7 + "All".length + c.label.length;
      const video = i % 4 === 2;
      const n = String(i + 1).padStart(2, "0");
      items[i % 3].push({
        id: +(key === "valencia" ? 100 : 200) + i, kind: video ? "video" : "photo", image: img(seed, w, h),
        video_url: video ? "https://example.com/" : "", caption: `${video ? "Film" : "Frame"} ${n}`,
        alt: `${real[i % 3]} ${video ? "film" : "frame"} ${n}`, order: i,
      });
    }
    real.forEach((title, k) => {
      const album = { title, slug: `${kebab(title)}-${key}`, city: ref, event: null, date: null, cover: items[k][0]?.image ?? null, item_count: items[k].length };
      out.albums.push(album);
      out.albumsDetail.push({ ...album, items: items[k] });
    });

    for (const p of c.products) {
      const url = img(p.seed, 700, 700);
      out.products.push({
        name: p.n, slug: `${kebab(p.n)}-${key}`, description: p.cap, material: p.mat, fit: p.fit,
        image: url, images: [{ url, alt: p.n }], variants: p.s.map((label) => ({ label, in_stock: true })),
        prices: [{ city: key, amount: String(p.p), currency: city.currency, currency_symbol: city.currency_symbol, checkout_url: "https://example.com/checkout" }],
      });
    }
  }
  return out;
}

// Every {seed, w, h} the data references, derived from the built URLs so the two never drift.
export function artList() {
  const set = new Set(JSON.stringify(build("http://x")).match(/media\/art\/\d+-\d+x\d+\.png/g));
  return [...set].map((f) => {
    const [, seed, w, h] = f.match(/art\/(\d+)-(\d+)x(\d+)\.png/);
    return { seed: +seed, w: +w, h: +h, file: f.replace("media/art/", "") };
  });
}
