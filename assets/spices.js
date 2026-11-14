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
    ["home", "trip", "hikes", "about"].forEach(function (v) {
      var el = document.getElementById("view-" + v);
      if (el) el.hidden = v !== view;
    });
    document.getElementById("navHome").classList.toggle("is-active", view === "home");
    document.getElementById("navAbout").classList.toggle("is-active", view === "about");
    window.scrollTo({ top: 0 });
  }

  /* ---------- home: glued circles ---------- */
  var SIZES = [228, 178, 258, 196, 214, 168, 244, 188];

  function circleSize(i) {
    var s = SIZES[i % SIZES.length];
    if (window.innerWidth < 560) s = Math.round(s * 0.62);
    return s;
  }

  function tripCircle(t, i) {
    var btn = document.createElement("button");
    var size = circleSize(i);
    btn.className = "circle";
    btn.style.width = btn.style.height = size + "px";
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
    var size = circleSize(state.data.trips.length + 1);
    btn.className = "circle circle-hikes";
    btn.style.width = btn.style.height = size + "px";
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
    var cluster = document.getElementById("cluster");
    cluster.innerHTML = "";
    var trips = state.data.trips || [];
    trips.forEach(function (t, i) { cluster.appendChild(tripCircle(t, i)); });
    cluster.appendChild(hikesCircle()); // Hikes always present, glued into the cluster

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

  /* ---------- hikes collection ---------- */
  function openHikes() {
    var hikes = state.data.hikes || [];
    var body;
    if (!hikes.length) {
      body = "<p>No hikes yet — day-trip hikes will be added here, all in this one collection.</p>";
    } else {
      body = hikes.map(function (h) {
        var cover = resolvePhoto(h.cover);
        return '<div class="hike-card">' +
          (cover ? '<img class="hike-thumb" src="' + esc(cover) + '" alt="' + esc(h.name) + '" loading="lazy">' : "") +
          '<div class="hike-body"><h3>' + esc(h.name) + "</h3>" +
          '<p class="meta-line">' + esc([h.where, fmtDate(h.date)].filter(Boolean).join(" · ")) + "</p>" +
          (h.notes ? "<p>" + esc(h.notes) + "</p>" : "") +
          ((h.photos && h.photos.length)
            ? '<div class="mini-gallery">' + h.photos.map(function (p) {
                return '<img src="' + esc(resolvePhoto(p)) + '" alt="" loading="lazy">';
              }).join("") + "</div>"
            : "") +
          albumBtn(h.albumUrl) +
          "</div></div>";
      }).join("");
    }
    document.getElementById("view-hikes").innerHTML =
      '<div class="detail-head"><button class="glass-btn" data-back>← All circles</button></div>' +
      '<div class="glass sheet"><h1>🥾 Hikes</h1>' +
      '<p class="meta-line">Day trips — every hike together in one place.</p>' + body + "</div>";
    bindBack();
    show("hikes");
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
  });
})();
