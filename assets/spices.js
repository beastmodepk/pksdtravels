/* PK-SD Travels — all the behaviour. Content comes ONLY from data/places.json.
   Photos are never in this repo: they live in Cloudflare R2. A photo path in
   places.json is either an absolute URL (used as-is) or a path appended to
   photoBaseUrl (the bucket's public base URL). */
(function () {
  "use strict";

  var state = { data: { photoBaseUrl: "", trips: [], hikes: [] }, view: "home" };

  function resolvePhoto(path) {
    if (!path) return "";
    if (/^(https?:)?\/\//i.test(path) || path.indexOf("data:") === 0) return path;
    var base = state.data.photoBaseUrl || "";
    if (!base) return path;
    return base.replace(/\/?$/, "/") + path.replace(/^\//, "");
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso + "T12:00:00");
    if (isNaN(d.getTime())) return esc(iso);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  function dateRange(t) {
    if (t.start && t.end) return fmtDate(t.start) + " – " + fmtDate(t.end);
    if (t.start) return fmtDate(t.start);
    return "";
  }

  /* ---------- views ---------- */
  function show(view) {
    state.view = view;
    ["home", "trip", "hikes", "hike", "about"].forEach(function (v) {
      var el = document.getElementById("view-" + v);
      if (el) el.hidden = v !== view;
    });
    document.getElementById("navHome").classList.toggle("is-active", view === "home");
    document.getElementById("navAbout").classList.toggle("is-active", view === "about");
    window.scrollTo({ top: 0 });
  }

  /* ---------- a circle of circles ----------
     Trips sit evenly on a ring around the Hikes hub, each circle glued to
     its neighbours: adjacent centres are GLUE*d apart (< d, so the circles
     overlap a touch), which sets the ring radius R = (GLUE*d)/(2*sin(pi/n)).
     Ring circles also overlap the hub a touch, so the whole composition
     reads as one stuck-together circle of circles.
     SCALING RULE: a ring holds only as many circles as fit at the readable
     base size — when trips overflow ring 1 they go on a SECOND, outer
     concentric ring (radius += 0.86*d, circles just as big), never on a
     shrunken inner ring. The finished composition is scaled down only as a
     last resort to fit a narrow screen. */
  var GLUE = 0.92;

  function baseDiameter() { return window.innerWidth < 560 ? 138 : 190; }

  function availWidth() { return Math.min(window.innerWidth - 28, 1060); }

  // Lay `count` circles of diameter d on concentric rings around a hub of
  // diameter hubD. Returns { size, hubD, items: [{x, y, d}] } in unscaled px,
  // centred on (size/2, size/2). centreSingle: a lone circle sits in the
  // middle (Hikes view) instead of orbiting the hub (home view).
  function circleOfCircles(count, d, hubD, stageW, centreSingle) {
    var items = [];
    if (!count) return { size: hubD, hubD: hubD, items: items };
    if (count === 1 && centreSingle) {
      items.push({ x: 0, y: 0, d: d });
      return { size: Math.max(d, hubD), hubD: hubD, items: items };
    }
    var hubTouchR = (hubD + d) / 2 * 0.9; // ring circles overlap the hub a touch
    var maxR = Math.max(hubTouchR, stageW / 2 - d / 2);
    // Ring-1 capacity: the largest n whose glued radius still fits the stage.
    var cap = Math.floor(Math.PI / Math.asin(Math.min(1, (GLUE * d / 2) / maxR)));
    cap = Math.max(3, cap);
    var placed = 0, ring = 0, prevR = 0;
    while (placed < count) {
      var remaining = count - placed;
      var n, R;
      if (ring === 0) {
        n = Math.min(remaining, cap);
        R = n === 1 ? hubTouchR
          : Math.max((GLUE * d) / (2 * Math.sin(Math.PI / n)), hubTouchR);
      } else {
        R = prevR + d * 0.86; // outer ring, glued onto the ring inside it
        // Outer-ring capacity: neighbours stay glued (chord >= 0.8*d).
        var capOut = Math.floor(Math.PI / Math.asin(Math.min(1, (0.8 * d / 2) / R)));
        n = Math.min(remaining, Math.max(3, capOut));
      }
      var step = (Math.PI * 2) / n;
      var start = -Math.PI / 2 + ring * (step / 2); // outer rings offset half a step
      for (var k = 0; k < n; k++) {
        var a = start + k * step;
        items.push({ x: Math.cos(a) * R, y: Math.sin(a) * R, d: d });
      }
      placed += n; prevR = R; ring++;
    }
    var extent = hubD / 2;
    items.forEach(function (it) {
      extent = Math.max(extent, Math.sqrt(it.x * it.x + it.y * it.y) + it.d / 2);
    });
    return { size: 2 * extent, hubD: hubD, items: items };
  }

  // Position a circle button inside a ring stage from a layout item.
  function placeCircle(stage, btn, layout, item, scale) {
    var s = Math.round(item.d * scale);
    btn.style.width = btn.style.height = s + "px";
    btn.style.left = ((layout.size / 2 + item.x) * scale) + "px";
    btn.style.top = ((layout.size / 2 + item.y) * scale) + "px";
    stage.appendChild(btn);
  }

  function sizeStage(stage, layout, scale) {
    stage.style.width = Math.round(layout.size * scale) + "px";
    stage.style.height = Math.round(layout.size * scale) + "px";
  }

  function tripCircle(t) {
    var btn = document.createElement("button");
    btn.className = "circle";
    btn.setAttribute("aria-label", t.name);
    var cover = resolvePhoto(t.cover);
    var stamp = t.kind === "wishlist"
      ? '<span class="stamp stamp-wishlist">WISHLIST</span>'
      : '<span class="stamp stamp-been">BEEN</span>';
    btn.innerHTML =
      (cover
        ? '<img src="' + esc(cover) + '" alt="' + esc(t.name) + '" loading="lazy">'
        : '<span class="circle-fallback">🧭</span>') +
      stamp +
      '<span class="circle-name">' + esc(t.name) + "</span>";
    btn.addEventListener("click", function () { openTrip(t.slug); });
    return btn;
  }

  function hikesCircle() {
    var hikes = state.data.hikes || [];
    var btn = document.createElement("button");
    btn.className = "circle circle-hikes";
    btn.setAttribute("aria-label", "Hikes — all day-trip hikes");
    var first = hikes.length ? resolvePhoto(hikes[0].cover) : "";
    btn.innerHTML =
      (first
        ? '<img src="' + esc(first) + '" alt="Hikes" loading="lazy">'
        : '<span class="hikes-emoji">🥾</span>') +
      '<span class="hikes-badge">HIKES · ' + hikes.length + "</span>" +
      '<span class="circle-name">Hikes</span>';
    btn.addEventListener("click", openHikes);
    return btn;
  }

  function renderHome() {
    var stage = document.getElementById("cluster");
    stage.innerHTML = "";
    var trips = state.data.trips || [];
    var d = baseDiameter();
    var hubD = Math.round(d * 0.94);
    var stageW = Math.min(availWidth(), 700);
    var layout = circleOfCircles(trips.length, d, hubD, stageW, false);
    var scale = Math.min(1, stageW / layout.size);
    sizeStage(stage, layout, scale);

    // The Hikes hub first, at the centre — the ring is laid over its edge.
    var hub = hikesCircle();
    var hubPx = Math.round(layout.hubD * scale);
    hub.style.width = hub.style.height = hubPx + "px";
    hub.style.left = hub.style.top = (layout.size / 2 * scale) + "px";
    stage.appendChild(hub);

    trips.forEach(function (t, i) {
      placeCircle(stage, tripCircle(t), layout, layout.items[i], scale);
    });

    document.getElementById("emptyNote").hidden = trips.length > 0;

    var bd = document.getElementById("backdropImg");
    var newest = trips.length ? resolvePhoto(trips[trips.length - 1].cover) : "";
    if (newest) { bd.src = newest; bd.hidden = false; } else { bd.hidden = true; bd.removeAttribute("src"); }
  }

  /* ---------- trip detail ---------- */
  function galleryHtml(photos) {
    if (!photos || !photos.length) return "";
    return '<div class="gallery">' + photos.map(function (p) {
      return '<img src="' + esc(resolvePhoto(p)) + '" alt="" loading="lazy">';
    }).join("") + "</div>";
  }

  function albumBtn(url) {
    if (!url) return "";
    return '<p><a class="glass-btn" href="' + esc(url) + '" target="_blank" rel="noopener">📸 Open the Google Photos album</a></p>';
  }

  function openTrip(slug) {
    var t = (state.data.trips || []).filter(function (x) { return x.slug === slug; })[0];
    if (!t) return;
    var cover = resolvePhoto(t.cover);
    var journal = (t.journal || []).map(function (j) {
      return '<div class="journal-entry">' +
        (j.date ? '<div class="j-date">' + fmtDate(j.date) + "</div>" : "") +
        (j.title ? '<div class="j-title">' + esc(j.title) + "</div>" : "") +
        "<p>" + esc(j.text || "") + "</p></div>";
    }).join("");
    document.getElementById("view-trip").innerHTML =
      '<div class="detail-head"><button class="glass-btn" data-back>← All circles</button></div>' +
      '<div class="glass sheet">' +
      "<h1>" + esc(t.name) + "</h1>" +
      '<p class="meta-line">' + esc([t.where, dateRange(t)].filter(Boolean).join(" · ")) + "</p>" +
      (cover ? '<img class="cover-photo" src="' + esc(cover) + '" alt="' + esc(t.name) + '">' : "") +
      albumBtn(t.albumUrl) +
      (journal ? "<h2>Journal</h2>" + journal : "") +
      ((t.photos && t.photos.length) ? "<h2>Pictures</h2>" + galleryHtml(t.photos) : "") +
      "</div>";
    bindBack();
    show("trip");
  }

  /* ---------- hikes: a circle of hike circles (never a list) ---------- */
  function hikeCircle(h) {
    var btn = document.createElement("button");
    btn.className = "circle";
    btn.setAttribute("aria-label", h.name);
    var cover = resolvePhoto(h.cover);
    btn.innerHTML =
      (cover
        ? '<img src="' + esc(cover) + '" alt="' + esc(h.name) + '" loading="lazy">'
        : '<span class="circle-fallback">🥾</span>') +
      '<span class="circle-name">' + esc(h.name) + "</span>";
    btn.addEventListener("click", function () { openHike(h.slug); });
    return btn;
  }

  function openHikes() {
    var hikes = state.data.hikes || [];
    var section = document.getElementById("view-hikes");
    section.innerHTML =
      '<div class="detail-head"><button class="glass-btn" data-back>← All circles</button></div>' +
      '<div class="glass empty-note hikes-head"><h1>🥾 Hikes</h1>' +
      '<p>Day trips — every hike its own circle, in a circle of circles.</p></div>' +
      '<div class="ring-stage" id="hikeCluster"></div>' +
      (hikes.length ? "" :
        '<div class="glass empty-note"><p>No hikes yet — the first hike will appear here as its own circle.</p></div>');
    var stage = document.getElementById("hikeCluster");
    if (hikes.length) {
      var d = baseDiameter();
      var labelD = Math.round(d * 0.55); // small glass HIKES disc at the centre
      var stageW = Math.min(availWidth(), 700);
      var layout = circleOfCircles(hikes.length, d, labelD, stageW, true);
      var scale = Math.min(1, stageW / layout.size);
      sizeStage(stage, layout, scale);
      if (hikes.length > 1) {
        var label = document.createElement("div");
        label.className = "ring-centre-label";
        var labelPx = Math.round(layout.hubD * scale);
        label.style.width = label.style.height = labelPx + "px";
        label.style.left = label.style.top = (layout.size / 2 * scale) + "px";
        label.textContent = "🥾 HIKES";
        stage.appendChild(label);
      }
      hikes.forEach(function (h, i) {
        placeCircle(stage, hikeCircle(h), layout, layout.items[i], scale);
      });
    }
    bindBack();
    show("hikes");
  }

  /* ---------- one hike's detail ---------- */
  function openHike(slug) {
    var h = (state.data.hikes || []).filter(function (x) { return x.slug === slug; })[0];
    if (!h) return;
    var cover = resolvePhoto(h.cover);
    document.getElementById("view-hike").innerHTML =
      '<div class="detail-head"><button class="glass-btn" data-back-hikes>← All hikes</button>' +
      '<button class="glass-btn" data-back>← All circles</button></div>' +
      '<div class="glass sheet">' +
      "<h1>" + esc(h.name) + "</h1>" +
      '<p class="meta-line">' + esc([h.where, fmtDate(h.date)].filter(Boolean).join(" · ")) + "</p>" +
      (cover ? '<img class="cover-photo" src="' + esc(cover) + '" alt="' + esc(h.name) + '">' : "") +
      albumBtn(h.albumUrl) +
      (h.notes ? "<h2>Notes</h2><p>" + esc(h.notes) + "</p>" : "") +
      ((h.photos && h.photos.length) ? "<h2>Pictures</h2>" + galleryHtml(h.photos) : "") +
      "</div>";
    document.querySelectorAll("[data-back-hikes]").forEach(function (b) {
      b.addEventListener("click", openHikes);
    });
    bindBack();
    show("hike");
  }

  function bindBack() {
    document.querySelectorAll("[data-back]").forEach(function (b) {
      b.addEventListener("click", function () { show("home"); });
    });
  }

  /* ---------- boot ---------- */
  document.querySelectorAll("[data-nav]").forEach(function (b) {
    b.addEventListener("click", function () { show(b.getAttribute("data-nav")); });
  });

  fetch("data/places.json", { cache: "no-cache" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.data = data || state.data;
      renderHome();
      show("home");
    })
    .catch(function () {
      renderHome();
      show("home");
    });

  window.addEventListener("resize", function () {
    if (state.view === "home") renderHome();
    else if (state.view === "hikes") openHikes();
  });
})();
