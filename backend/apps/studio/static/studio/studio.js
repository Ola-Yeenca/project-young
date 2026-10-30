// HOY Studio: small progressive enhancements. Every page works without this file.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Theme: system by default, remembered per browser when toggled.
  const root = document.documentElement;
  try { const t = localStorage.getItem("hoy-theme"); if (t) root.dataset.theme = t; } catch (e) {}
  $$("[data-theme-toggle]").forEach((b) => b.addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    try { localStorage.setItem("hoy-theme", root.dataset.theme); } catch (e) {}
  }));

  // ⌘K / Ctrl-K / "/" focuses search.
  addEventListener("keydown", (e) => {
    const s = $("#global-search");
    if (!s) return;
    if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))) {
      e.preventDefault(); s.focus(); s.select();
    }
  });

  // Toasts dismiss themselves.
  $$(".toast").forEach((t, i) => {
    const kill = () => { t.style.transition = "opacity .3s, transform .3s"; t.style.opacity = 0; t.style.transform = "translateY(8px)"; setTimeout(() => t.remove(), 300); };
    t.querySelector("button")?.addEventListener("click", kill);
    if (!t.classList.contains("error")) setTimeout(kill, 4200 + i * 400);
  });

  // Live clocks in the sidebar.
  const tick = () => $$("[data-clock]").forEach((el) => {
    el.textContent = new Intl.DateTimeFormat("en-GB", { timeZone: el.dataset.clock, hour: "2-digit", minute: "2-digit" }).format(new Date());
  });
  tick(); setInterval(tick, 20000);

  // Chart tooltips.
  $$(".chart-wrap").forEach((wrap) => {
    const tip = $(".tip", wrap);
    $$("[data-tip]", wrap).forEach((g) => {
      g.addEventListener("pointerenter", () => { tip.textContent = g.dataset.tip; tip.classList.add("on"); });
      g.addEventListener("pointermove", (e) => { const r = wrap.getBoundingClientRect(); tip.style.left = e.clientX - r.left + "px"; tip.style.top = e.clientY - r.top + "px"; });
      g.addEventListener("pointerleave", () => tip.classList.remove("on"));
    });
  });

  // Two-step destructive buttons: first click arms, second confirms.
  $$("[data-confirm]").forEach((b) => b.addEventListener("click", (e) => {
    if (b.dataset.armed === "1") return;
    e.preventDefault(); b.dataset.armed = "1"; const old = b.innerHTML; b.textContent = b.dataset.confirm;
    setTimeout(() => { b.dataset.armed = ""; b.innerHTML = old; }, 3500);
  }));

  // Auto-submit (selects, toggles).
  $$("[data-autosubmit]").forEach((el) => el.addEventListener("change", () => el.form.requestSubmit()));

  // Drop zones with previews.
  $$(".file-drop").forEach((z) => {
    const input = $("input[type=file]", z), out = $(".file-preview", z), label = $("b", z);
    ["dragenter", "dragover"].forEach((ev) => z.addEventListener(ev, (e) => { e.preventDefault(); z.classList.add("over"); }));
    ["dragleave", "drop"].forEach((ev) => z.addEventListener(ev, () => z.classList.remove("over")));
    z.addEventListener("drop", (e) => { e.preventDefault(); input.files = e.dataTransfer.files; input.dispatchEvent(new Event("change")); });
    input.addEventListener("change", () => {
      if (!out) return; out.innerHTML = "";
      [...input.files].slice(0, 24).forEach((f) => { const img = new Image(); img.src = URL.createObjectURL(f); out.appendChild(img); });
      if (label) label.textContent = input.files.length ? `${input.files.length} file${input.files.length > 1 ? "s" : ""} ready` : label.dataset.default;
    });
  });

  // Single image fields: live preview into [data-preview-for].
  $$("input[type=file][data-preview]").forEach((input) => input.addEventListener("change", () => {
    const f = input.files[0]; if (!f) return; const url = URL.createObjectURL(f);
    $$(input.dataset.preview).forEach((img) => { img.src = url; img.hidden = false; });
    const clear = document.getElementById(input.name + "-clear"); if (clear) clear.checked = false;
  }));

  // Slug follows the name/title until edited by hand.
  $$("[data-slug-from]").forEach((slug) => {
    const src = $(slug.dataset.slugFrom); if (!src) return;
    let touched = !!slug.value; slug.addEventListener("input", () => (touched = true));
    src.addEventListener("input", () => { if (!touched) slug.value = src.value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); });
  });

  // Event editor: venue list follows the city; preview card and checklist update live.
  const ef = $("#event-form");
  if (ef) {
    // Match the public purchaseUrl rules; URL shape is not provider verification.
    const usableTicketUrl = (value) => {
      try {
        const u = new URL(value), host = u.hostname.toLowerCase().replace(/\.$/, "");
        const publicHost = host.includes(".") && !/^[\d.]+$/.test(host) && host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
        const reserved = /(^|\.)(localhost|localdomain|local|internal|lan|test|invalid|example)$/.test(host) || /(^|\.)example\.(com|org|net|test)$/.test(host);
        return u.protocol === "https:" && !u.username && !u.password && publicHost && !reserved;
      } catch { return false; }
    };
    const venues = JSON.parse($("#venues-data").textContent), cities = JSON.parse($("#cities-data").textContent);
    const city = $("#id_city"), venue = $("#id_venue");
    const syncVenues = () => {
      const keep = venue.value; venue.innerHTML = '<option value="">Choose a venue</option>';
      venues.filter((v) => String(v.city) === city.value).forEach((v) => { const o = new Option(v.name, v.id); if (String(v.id) === keep) o.selected = true; venue.add(o); });
    };
    document.addEventListener("studio-choice-created", ({detail}) => {
      if (detail.kind === "venue") venues.push(detail);
      if (detail.kind === "city") cities[detail.id] = detail;
    });
    city.addEventListener("change", syncVenues); syncVenues();
    const fmt = (v) => { if (!v) return "Date to be set"; const d = new Date(v); return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" }) + " · " + v.slice(11, 16); };
    const val = (id) => ($("#" + id) || {}).value || "";
    const update = () => {
      const c = cities[city.value] || {};
      $("#pv-title").textContent = val("id_title") || "Event title";
      $("#pv-when").textContent = fmt(val("id_starts_at")) + (venue.selectedOptions[0] && venue.value ? " · " + venue.selectedOptions[0].text : "");
      const p = val("id_price_from");
      $("#pv-price").textContent = p === "" ? "TBA" : Number(p) === 0 ? "Free" : (c.symbol || "") + Number(p).toLocaleString("en-GB");
      $("#pv-provider").textContent = val("id_ticket_provider") || c.provider || "Ticket partner";
      $("#pv-tz").textContent = c.tz ? `Times are ${c.name} local (${c.tz})` : "Pick a city to set the time zone";
      $("#pv-status").textContent = { draft: "Draft", published: "Published", cancelled: "Cancelled" }[val("id_status")] || "Draft";
      $("#pv-img").alt = val("id_poster_alt");
      $("#pv-img").style.objectFit = val("id_poster_fit") || "contain";
      const clearPoster = $("#poster-clear");
      if (clearPoster) {
        if (clearPoster.checked) $("#pv-img").hidden = true;
        else {
          if (!$("#pv-img").src && $("#pv-img").dataset.currentSrc) $("#pv-img").src = $("#pv-img").dataset.currentSrc;
          $("#pv-img").hidden = false;
        }
      }
      const checks = {
        "ck-title": !!val("id_title"), "ck-when": !!val("id_starts_at") && !!venue.value,
        "ck-poster": !!$("#pv-img").getAttribute("src") && !(clearPoster && clearPoster.checked), "ck-tickets": usableTicketUrl(val("id_ticket_url")) || (p !== "" && Number(p) === 0) || $("#id_sold_out").checked,
        "ck-lineup": $$("input[name=lineup]:checked").length > 0 || !!val("id_lineup_extra"), "ck-caption": !!val("id_caption"),
      };
      Object.entries(checks).forEach(([id, ok]) => $("#" + id).classList.toggle("ok", ok));
    };
    ef.addEventListener("input", update); ef.addEventListener("change", update); update();
  }
})();
// Off-canvas sidebar for tablets and phones.
(function () {
  const open = () => document.body.classList.add("nav-open"), close = () => document.body.classList.remove("nav-open");
  document.querySelectorAll("[data-nav-open]").forEach((b) => b.addEventListener("click", (e) => { e.preventDefault(); open(); }));
  document.querySelectorAll("[data-nav-close], .scrim").forEach((b) => b.addEventListener("click", close));
  addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
})();

// City form: fill currency and time zone from the country, live preview, local clock.
(function () {
  const form = document.getElementById("city-form");
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const presets = JSON.parse($("country-presets").textContent);
  const country = $("id_country"), currency = $("id_currency"), tz = $("id_timezone"), provider = $("id_ticket_provider"), name = $("id_name");
  const touched = new Set();
  [currency, tz, provider].forEach((el) => el.addEventListener("input", () => touched.add(el.id)));
  country.addEventListener("input", () => {
    const p = presets[country.value.trim()];
    if (!p) return;
    if (!touched.has(currency.id) || !currency.value) currency.value = p.currency;
    if (!touched.has(tz.id) || !tz.value) tz.value = p.timezone;
    if (p.provider && !provider.value) provider.value = p.provider;
    $("preset-note").hidden = false;
    paint();
  });
  const clock = () => {
    try { $("pv-time").textContent = new Intl.DateTimeFormat("en-GB", { timeZone: tz.value, hour: "2-digit", minute: "2-digit" }).format(new Date()) + " now"; }
    catch (e) { $("pv-time").textContent = "--:--"; }
  };
  const paint = () => {
    $("pv-name").textContent = name.value || "City name";
    $("pv-country").firstChild.textContent = (country.value || "Country") + " · ";
    $("pv-currency").textContent = currency.value || "—";
    $("pv-tz").textContent = tz.value || "Pick a time zone";
    const sp = $("slug-pv"); if (sp) sp.textContent = $("id_slug").value || "…";
    clock();
  };
  form.addEventListener("input", paint); form.addEventListener("change", paint); paint(); setInterval(clock, 20000);
})();

// Homepage video fields (a city's, or the site default): the video over its still, behind the preview card.
(function () {
  const deck = document.getElementById("pv-deck");
  if (!deck) return;
  const video = document.getElementById("pv-deck-video"), still = document.getElementById("pv-deck-poster");
  const film = () => deck.classList.toggle("filmed", !video.hidden || !still.hidden);
  document.querySelectorAll("input[data-deck]").forEach((input) => input.addEventListener("change", () => {
    if (input.dataset.deck === "poster" && still.src) video.poster = still.src;
    film();
  }));
  document.querySelectorAll("input[data-deck-clear]").forEach((box) => box.addEventListener("change", () => {
    (box.dataset.deckClear === "video" ? video : still).hidden = box.checked;
    film();
  }));
})();

// Add catalogue choices without replacing the parent form or its file inputs.
(function () {
  const dialog = document.getElementById("choice-dialog");
  if (!dialog) return;
  const content = document.getElementById("choice-content"), error = document.getElementById("choice-error");
  let trigger, generation = 0, saving = false;
  const fail = (message) => { error.textContent = message; error.hidden = false; };
  const mount = (html) => {
    content.innerHTML = html;
    content.querySelectorAll("[data-choice-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
    const form = content.querySelector("form");
    if (!form) return;
    const country = form.querySelector('[name="quick-country"]'), presets = form.querySelector("#quick-presets");
    if (country && presets) {
      const values = JSON.parse(presets.textContent), touched = new Set();
      ["currency", "timezone"].forEach(name => form.querySelector('[name="quick-'+name+'"]').addEventListener("input", () => touched.add(name)));
      country.addEventListener("input", () => {
        const preset = values[country.value.trim()];
        if (!preset) return;
        for (const [name,key] of [["currency","currency"],["timezone","timezone"]]) {
          const field = form.querySelector('[name="quick-'+name+'"]');
          if (!touched.has(name) || !field.value) field.value = preset[key];
        }
      });
    }
    form.addEventListener("submit", async event => {
      event.preventDefault();
      if (saving) return;
      saving = true; error.hidden = true;
      const buttons = [...form.querySelectorAll("button")];buttons.forEach(button => button.disabled = true);
      try {
        const response = await fetch(form.action, {method:"POST",body:new FormData(form),credentials:"same-origin",redirect:"error",headers:{Accept:"application/json"}});
        if (response.status === 400) { const data = await response.json();mount(data.html);content.querySelector(".has-err input,.has-err select")?.focus();return; }
        if (!response.ok) throw new Error(response.status === 403 ? "You no longer have permission to add this." : "Couldn't save this. Nothing else on the page has changed.");
        const data = await response.json(), target = document.getElementById(trigger.dataset.choiceTarget);
        document.dispatchEvent(new CustomEvent("studio-choice-created", {detail:data}));
        if (data.kind === "venue") {
          const city = document.getElementById("id_city");city.value = String(data.city);city.dispatchEvent(new Event("change",{bubbles:true}));
        }
        const value = data.kind === "music-style" ? (target.tagName === "SELECT" ? data.slug : data.name) : String(data.id);
        if (target.tagName === "SELECT" && ![...target.options].some(option => option.value === value)) target.add(new Option(data.name,value));
        if (data.kind === "music-style") {
          const list = document.getElementById("music-style-options");
          if (list && ![...list.options].some(option => option.value === data.name)) list.append(new Option(data.name,data.name));
        }
        target.value = value;target.dispatchEvent(new Event("change",{bubbles:true}));target.dispatchEvent(new Event("input",{bubbles:true}));
        document.getElementById("choice-notice").textContent = data.name+" added and selected. Save the form to keep it.";
        dialog.close();target.focus();
      } catch (exception) { fail(exception.message === "Failed to fetch" ? "Couldn't confirm the save. Keep this window open and try again. Nothing else on the page has changed." : exception.message); }
      finally {saving = false;buttons.forEach(button => button.disabled = false);}
    });
    form.querySelector("input:not([type=hidden]),select")?.focus();
  };
  dialog.addEventListener("cancel", event => {if (saving) event.preventDefault();});
  dialog.addEventListener("close", () => {generation++;});
  document.querySelectorAll("[data-choice-url]").forEach(button => button.addEventListener("click", async () => {
    if (dialog.open) return;
    trigger = button;error.hidden = true;const current = ++generation;
    content.innerHTML = '<p>Loading…</p><button type="button" class="btn" data-choice-close>Cancel</button>';
    content.querySelector("button").addEventListener("click", () => dialog.close());dialog.showModal();
    const url = new URL(button.dataset.choiceUrl,location.origin);
    if (button.dataset.choiceKind === "venue") url.searchParams.set("city",document.getElementById("id_city").value);
    try {
      const response = await fetch(url,{credentials:"same-origin",redirect:"error",cache:"no-store"});
      if (!response.ok) throw new Error("Couldn't load this form. Check your access and try again.");
      const html = await response.text();if (current === generation && dialog.open) mount(html);
    } catch (exception) {if (current === generation && dialog.open) fail(exception.message);}
  }));
})();
