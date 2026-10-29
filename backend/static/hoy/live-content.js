/* Same-origin read adapter: event art and curated gallery come from Studio.
   All editable text is inserted with textContent; media URLs allow HTTP(S) only. */
(async function () {
  const root = document.documentElement;
  document.body.classList.add("live-loading");
  const node = (tag, text, className) => {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  };
  const url = (value) => {
    if (!value) return "";
    try { const parsed = new URL(value, location.origin); return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : ""; }
    catch { return ""; }
  };
  const escape = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const get = async (path) => {
    const response = await fetch(path, {headers: {Accept: "application/json"}, cache: "no-store"});
    if (!response.ok) throw new Error(`Content request failed (${response.status})`);
    return response.json();
  };
  const list = async (path) => {
    let page = await get(path), items = Array.isArray(page) ? page : page.results;
    while (page.next) {
      const next = new URL(page.next, location.origin);
      if (next.origin !== location.origin) throw new Error("Unexpected content origin");
      page = await get(next.pathname + next.search); items = items.concat(page.results);
    }
    return items;
  };
  const image = (src, alt, className, fit = "contain") => {
    const img = node("img", undefined, className);
    img.src = url(src); img.alt = alt || ""; img.loading = "lazy";
    img.style.objectFit = fit === "cover" ? "cover" : "contain";
    return img;
  };
  const price = e => e.price_from === null ? "To be announced" : Number(e.price_from) === 0 ? "Free" : e.currency_symbol + Number(e.price_from).toLocaleString("en-GB");
  const live = {};
  let selectedAlbum = "all", renderedCity = "";
  try {
    const cities = await get("/api/v1/cities/");
    await Promise.all(cities.filter(c => D[c.slug]).map(async c => {
      const [events, past, albums, featured] = await Promise.all([
        list(`/api/v1/events/?city=${encodeURIComponent(c.slug)}`),
        list(`/api/v1/events/?city=${encodeURIComponent(c.slug)}&when=past`),
        list(`/api/v1/gallery/?city=${encodeURIComponent(c.slug)}`),
        list(`/api/v1/events/?city=${encodeURIComponent(c.slug)}&featured=1`)
      ]);
      const details = await Promise.all(albums.map(a => get(`/api/v1/gallery/${encodeURIComponent(a.slug)}/`)));
      live[c.slug] = {city: c, events, past, featured, albums: details};
    }));
    if (!Object.keys(live).length) throw new Error("No configured preview cities");
    if (!live[city]) city = Object.keys(live)[0];
    const adapt = e => ({
      t: escape(e.title), d: escape(e.local.date), time: escape(e.local.time), v: escape(e.venue.name),
      p: e.price_from === null ? 0 : Number(e.price_from), sold: e.sold_percent ?? 0,
      seed: 0, kind: escape(e.kind), bpm: e.bpm || 104,
      style: e.music_style === "amapiano" ? "piano" : "afro",
      lu: e.lineup.map(t => escape(t.name)), cap: escape(e.caption), raw: e
    });
    for (const [key, data] of Object.entries(live)) {
      const c = D[key];
      c.events = (data.featured.length ? data.featured : data.events).map(adapt);
      c.past = data.past.map(adapt);
      // Keep the turntable engine's empty-city timing safe, but hide its sample hero.
      if (!c.events.length) c.events = [{t:"No upcoming events",d:"",time:"",v:"",p:0,sold:0,seed:0,kind:"",bpm:104,style:"afro",lu:[],cap:"",raw:null}];
    }
    const eventCard = e => {
      const card = node("button", undefined, "live-event-card");
      card.type = "button"; card.dataset.eventSlug = e.slug;
      card.setAttribute("aria-label", `View ${e.title}`);
      if (e.poster) card.append(image(e.poster, e.poster_alt || `${e.title} event artwork`, "event-image", e.poster_fit));
      else card.append(node("span", "No artwork", "event-image"));
      const copy = node("span", undefined, "event-copy");
      copy.append(node("strong", e.title), node("small", `${e.local.date} · ${e.local.time} · ${e.venue.name}`));
      card.append(copy, node("span", e.sold_out ? "Sold out" : price(e), "event-price"));
      card.addEventListener("click", () => detail(e));
      return card;
    };
    const eventList = (id, events) => {
      const host = document.getElementById(id); host.replaceChildren();
      if (!events.length) host.append(node("p", "No events announced yet.", "live-empty"));
      events.forEach(e => host.append(eventCard(e)));
    };
    const galleryStrip = (id, albums, limit) => {
      const host = document.getElementById(id); host.replaceChildren();
      let count = 0;
      for (const a of albums) for (const item of a.items) {
        if (limit && count >= limit) continue;
        const frame = node("figure", undefined, "frame"); frame.dataset.mediaId = item.id;
        const ph = node("div", undefined, "ph"); ph.style.setProperty("--ar", "4/5");
        if (item.image) ph.append(image(item.image, item.alt || item.caption || a.title, "live-gallery-img"));
        if (item.kind === "video" && url(item.video_url)) {
          const link = node("a", "Watch video", "btn sm"); link.href = url(item.video_url); link.target = "_blank"; link.rel = "noopener noreferrer";
          ph.append(link);
        }
        const cap = node("figcaption", item.caption || a.title, "meta");
        frame.append(ph, cap); host.append(frame); count++;
      }
      if (!count) host.append(node("p", "No gallery images published yet.", "live-empty"));
    };
    const gallery = () => {
      const data = live[city]; if (!data) return;
      const chips = document.getElementById("albums"); chips.replaceChildren();
      for (const a of [{slug:"all",title:"All"}, ...data.albums]) {
        const button = node("button", a.title, selectedAlbum === a.slug ? "on" : ""); button.type = "button";
        button.addEventListener("click", () => {selectedAlbum = a.slug; gallery();}); chips.append(button);
      }
      galleryStrip("strip", data.albums.filter(a => selectedAlbum === "all" || a.slug === selectedAlbum));
      galleryStrip("home-strip", data.albums, 8);
    };
    const detail = e => {
      const card = document.getElementById("card"); card.replaceChildren();
      const art = node("div", undefined, "hero-img");
      if (e.poster) art.append(image(e.poster, e.poster_alt || `${e.title} event artwork`, "live-detail-art", e.poster_fit));
      else art.append(node("p", "Artwork has not been added yet.", "live-empty"));
      const close = node("button", "✕", "x"); close.type = "button"; close.setAttribute("aria-label", "Close event details"); close.addEventListener("click", closeSheet); art.append(close);
      const body = node("div", undefined, "live-detail-body");
      body.append(node("h2", e.title), node("p", `${e.local.date} · ${e.local.time} · ${e.venue.name}`), node("p", e.description || e.caption));
      if (url(e.ticket_url)) {
        const ticket = node("a", e.is_cancelled ? "Event cancelled" : e.sold_out ? "Sold out" : `Tickets · ${price(e)}`, "btn ink");
        if (!e.is_cancelled && !e.sold_out) {ticket.href = url(e.ticket_url); ticket.target = "_blank"; ticket.rel = "noopener noreferrer";}
        body.append(ticket);
      }
      const related = live[city].albums.filter(a => a.event === e.slug);
      if (related.length) {const link = node("button", "See event gallery", "btn");link.addEventListener("click", () => {selectedAlbum=related[0].slug;go("gallery");gallery();});body.append(link);}
      card.append(art, body); openSheet();
    };
    const originalSetRecord = setRecord;
    setRecord = function () {
      originalSetRecord();
      const e = D[city].events[cur].raw;
      document.getElementById("hero").hidden = !e;
      document.querySelector(".hero-foot").hidden = !e;
      if (!e) return;
      document.getElementById("h-title").textContent = e.title;
      document.getElementById("l-t").textContent = e.title;
      document.getElementById("h-cap").textContent = e.caption;
      const kv = document.getElementById("h-kv"); kv.replaceChildren();
      for (const [label, value] of [["Date",e.local.date],["Doors",e.local.time],["Venue",e.venue.name],["Line-up",e.lineup.map(t=>t.name).join(", ")]]) {
        const line=node("div");line.append(node("span",label),node("span",value));kv.append(line);
      }
      document.querySelectorAll(".live-record-art").forEach(el=>el.remove());
      if (e.poster) document.getElementById("rot").append(image(e.poster,e.poster_alt||`${e.title} event artwork`,"live-record-art"+(e.poster_fit==="cover"?" cover":""),e.poster_fit));
      const buy = document.getElementById("h-buy"); buy.textContent = e.is_cancelled ? "Event cancelled" : e.sold_out ? "Sold out" : e.is_free ? "Event details" : e.price_from === null ? "Tickets to be announced" : "Buy tickets";
      const active = url(e.ticket_url) && !e.sold_out && !e.is_cancelled;
      if (active) buy.href=url(e.ticket_url); else buy.removeAttribute("href");
      buy.hidden = !active;
      // Detach demo animation targets so delayed callbacks cannot overwrite live values.
      const priceNode=node("div",price(e),"price");priceNode.id="h-price";
      document.getElementById("h-price").replaceWith(priceNode);
      const soldNode=node("span",e.sold_percent===null?"":`${e.sold_percent}% sold`);soldNode.id="h-sold";
      document.getElementById("h-sold").replaceWith(soldNode);
      document.querySelector(".meter").hidden=e.sold_percent===null;
      document.getElementById("label").disabled=!e.bpm;
      document.getElementById("l-n").textContent=e.bpm?`${e.bpm} BPM`:"Sound not configured";
      if (!e.bpm && A.on) stop();
    };
    openEvent = key => {const e=(key.startsWith("p")?D[city].past:D[city].events)[Number(key.slice(1))]?.raw;if(e)detail(e);};
    renderEvents = () => {
      const data=live[city];if(!data)return;
      eventList("all-idx",data.events.filter(e=>kind==="All"||e.kind===kind));
    };
    const originalRender = render;
    render = function () {
      if (!live[city]) return;
      if (renderedCity !== city) {selectedAlbum="all";renderedCity=city;}
      originalRender();
      const data=live[city];
      document.querySelectorAll("[data-city]").forEach(button=>{button.hidden=!live[button.dataset.city];});
      eventList("home-idx",data.events);eventList("past-idx",data.past);renderEvents();gallery();
      document.getElementById("ev-prov").textContent="";
      const filters=document.getElementById("ev-filter");filters.replaceChildren();
      for(const value of ["All",...new Set(data.events.map(e=>e.kind))]) {
        const button=node("button",value==="All"?value:value.charAt(0).toUpperCase()+value.slice(1),kind===value?"on":"");
        button.addEventListener("click",()=>{kind=value;render();});filters.append(button);
      }
    };
    // Demo-only contact/booking UI must not pretend to deliver a message.
    document.addEventListener("submit",event=>{
      if (!["cform","bform"].includes(event.target.id)) return;
      event.preventDefault();event.stopImmediatePropagation();
      let note=event.target.querySelector("[role=status]");if(!note){note=node("p");note.setAttribute("role","status");event.target.append(note);}
      note.textContent="Preview only. This message has not been sent.";
    },true);
    const banner=document.querySelector(".proto");banner.querySelector("b").textContent="Connected preview";
    banner.querySelector("span").textContent="Events and gallery reflect Studio. Other sections are sample content.";
    cur=0;render();root.dataset.liveContent="ready";
  } catch (error) {
    const message=node("div","Content could not be loaded. Please reload the preview.","live-failure");message.setAttribute("role","alert");
    document.querySelector("main").replaceChildren(message);root.dataset.liveContent="error";console.error(error);
  } finally {document.body.classList.remove("live-loading");}
})();
