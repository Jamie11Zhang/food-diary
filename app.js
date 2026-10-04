/* ===== Our Little Food Diary — logic ===== */
(function () {
  "use strict";

  var STORAGE_KEY = "ourFoodDiaryRecords";

  // ---- state ----
  var records = loadRecords();
  var currentRating = 0;
  var currentPhoto = null; // base64 data URL or null
  var editingId = null;    // id of record being edited, or null

  // ---- element refs ----
  var form = document.getElementById("record-form");
  var starsEl = document.getElementById("stars");
  var photoInput = document.getElementById("photo");
  var photoPreview = document.getElementById("photo-preview");
  var previewImg = document.getElementById("preview-img");
  var removePhotoBtn = document.getElementById("remove-photo");
  var submitBtn = document.getElementById("submit-btn");
  var cancelEditBtn = document.getElementById("cancel-edit");
  var recordsEl = document.getElementById("records");
  var emptyState = document.getElementById("empty-state");
  var countLine = document.getElementById("count-line");
  var searchInput = document.getElementById("search");
  var filterType = document.getElementById("filter-type");
  var sortBy = document.getElementById("sort-by");
  var dateInput = document.getElementById("date");

  // default the date field to today
  dateInput.value = new Date().toISOString().slice(0, 10);

  // ---- tab switching ----
  var tabBtns = document.querySelectorAll(".tab-btn");
  var panels = document.querySelectorAll(".tab-panel");
  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = btn.getAttribute("data-tab");
      tabBtns.forEach(function (b) { b.classList.remove("active"); });
      panels.forEach(function (p) { p.classList.remove("active"); });
      btn.classList.add("active");
      document.getElementById(target).classList.add("active");
      if (target === "gallery") renderGallery();
    });
  });

  function goToTab(name) {
    tabBtns.forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === name);
    });
    panels.forEach(function (p) {
      p.classList.toggle("active", p.id === name);
    });
  }

  // ---- star rating ----
  var starEls = starsEl.querySelectorAll(".star");
  starEls.forEach(function (star) {
    star.addEventListener("mouseenter", function () {
      paintStars(parseInt(star.getAttribute("data-value"), 10));
    });
    star.addEventListener("click", function () {
      currentRating = parseInt(star.getAttribute("data-value"), 10);
      paintStars(currentRating);
    });
  });
  starsEl.addEventListener("mouseleave", function () { paintStars(currentRating); });

  function paintStars(n) {
    starEls.forEach(function (star) {
      var v = parseInt(star.getAttribute("data-value"), 10);
      star.classList.toggle("filled", v <= n);
    });
  }

  // ---- photo upload + preview ----
  photoInput.addEventListener("change", function () {
    var file = photoInput.files[0];
    if (!file) return;
    // keep storage small-ish: downscale big images
    resizeImage(file, 1000, function (dataUrl) {
      currentPhoto = dataUrl;
      previewImg.src = dataUrl;
      photoPreview.classList.remove("hidden");
    });
  });
  removePhotoBtn.addEventListener("click", function () {
    currentPhoto = null;
    photoInput.value = "";
    photoPreview.classList.add("hidden");
  });

  function resizeImage(file, maxDim, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var w = Math.round(img.width * scale);
        var h = Math.round(img.height * scale);
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        try {
          cb(canvas.toDataURL("image/jpeg", 0.85));
        } catch (err) {
          cb(e.target.result); // fallback to original
        }
      };
      img.onerror = function () { cb(e.target.result); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ---- submit form ----
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = {
      id: editingId || String(Date.now()),
      place: document.getElementById("place").value.trim(),
      type: document.getElementById("type").value,
      date: document.getElementById("date").value,
      price: document.getElementById("price").value.trim(),
      dishes: document.getElementById("dishes").value.trim(),
      taste: document.getElementById("taste").value.trim(),
      comments: document.getElementById("comments").value.trim(),
      rating: currentRating,
      photo: currentPhoto,
      createdAt: editingId ? findRecord(editingId).createdAt : Date.now()
    };

    if (editingId) {
      records = records.map(function (r) { return r.id === editingId ? data : r; });
    } else {
      records.push(data);
    }
    saveRecords();
    resetForm();
    goToTab("gallery");
    renderGallery();
    celebrate();
  });

  cancelEditBtn.addEventListener("click", resetForm);

  function resetForm() {
    form.reset();
    currentRating = 0;
    currentPhoto = null;
    editingId = null;
    paintStars(0);
    photoPreview.classList.add("hidden");
    dateInput.value = new Date().toISOString().slice(0, 10);
    submitBtn.textContent = "💗 Save this memory";
    cancelEditBtn.classList.add("hidden");
  }

  // ---- gallery rendering ----
  [searchInput, filterType, sortBy].forEach(function (el) {
    el.addEventListener("input", renderGallery);
  });

  function renderGallery() {
    var term = searchInput.value.trim().toLowerCase();
    var typeFilter = filterType.value;
    var list = records.filter(function (r) {
      if (typeFilter && r.type !== typeFilter) return false;
      if (!term) return true;
      var hay = [r.place, r.dishes, r.taste, r.comments, r.type, r.price].join(" ").toLowerCase();
      return hay.indexOf(term) !== -1;
    });

    list.sort(function (a, b) {
      if (sortBy.value === "oldest") return a.createdAt - b.createdAt;
      if (sortBy.value === "rating") return (b.rating || 0) - (a.rating || 0);
      return b.createdAt - a.createdAt; // newest
    });

    recordsEl.innerHTML = "";
    if (records.length === 0) {
      emptyState.classList.remove("hidden");
      countLine.textContent = "";
      return;
    }
    emptyState.classList.add("hidden");

    if (list.length === 0) {
      countLine.textContent = "No matches — try a different search 🔍";
    } else {
      countLine.textContent = list.length + (list.length === 1 ? " sweet memory ♡" : " sweet memories ♡");
    }

    list.forEach(function (r) {
      recordsEl.appendChild(buildCard(r));
    });
  }

  function buildCard(r) {
    var card = document.createElement("div");
    card.className = "record-card";

    var media = r.photo
      ? '<img src="' + r.photo + '" alt="' + esc(r.place) + '" />'
      : '<div class="card-no-photo">' + typeEmoji(r.type) + "</div>";

    var stars = "";
    for (var i = 1; i <= 5; i++) stars += i <= r.rating ? "★" : "☆";

    var rows = "";
    if (r.price)    rows += '<p class="card-row"><b>💰 Price:</b> ' + esc(r.price) + "</p>";
    if (r.dishes)   rows += '<p class="card-row"><b>🍴 Dishes:</b> ' + esc(r.dishes) + "</p>";
    if (r.taste)    rows += '<p class="card-row"><b>😋 Taste:</b> ' + esc(r.taste) + "</p>";
    if (r.comments) rows += '<p class="card-row"><b>💌 Notes:</b> ' + esc(r.comments) + "</p>";

    card.innerHTML =
      media +
      '<div class="card-body">' +
        '<h3 class="card-title">' + esc(r.place) + "</h3>" +
        '<p class="card-meta">' + esc(r.type) + (r.date ? " · " + formatDate(r.date) : "") + "</p>" +
        '<div class="card-stars">' + stars + "</div>" +
        rows +
        '<div class="card-actions">' +
          '<button class="edit-btn">✏️ edit</button>' +
          '<button class="delete-btn">🗑️ delete</button>' +
        "</div>" +
      "</div>";

    card.querySelector(".edit-btn").addEventListener("click", function () { startEdit(r.id); });
    card.querySelector(".delete-btn").addEventListener("click", function () { deleteRecord(r.id); });
    return card;
  }

  function startEdit(id) {
    var r = findRecord(id);
    if (!r) return;
    editingId = id;
    document.getElementById("place").value = r.place || "";
    document.getElementById("type").value = r.type || "🍽️ Restaurant";
    document.getElementById("date").value = r.date || "";
    document.getElementById("price").value = r.price || "";
    document.getElementById("dishes").value = r.dishes || "";
    document.getElementById("taste").value = r.taste || "";
    document.getElementById("comments").value = r.comments || "";
    currentRating = r.rating || 0;
    paintStars(currentRating);
    currentPhoto = r.photo || null;
    if (currentPhoto) {
      previewImg.src = currentPhoto;
      photoPreview.classList.remove("hidden");
    } else {
      photoPreview.classList.add("hidden");
    }
    submitBtn.textContent = "💾 Update memory";
    cancelEditBtn.classList.remove("hidden");
    goToTab("add");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteRecord(id) {
    var r = findRecord(id);
    if (!r) return;
    if (!confirm('Delete the memory of "' + r.place + '"? This can\'t be undone.')) return;
    records = records.filter(function (x) { return x.id !== id; });
    saveRecords();
    renderGallery();
  }

  // ---- storage ----
  function loadRecords() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }
  function saveRecords() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      alert("Couldn't save — your browser storage may be full (photos take space). Try removing a photo.");
    }
  }

  // ---- helpers ----
  function findRecord(id) {
    return records.filter(function (r) { return r.id === id; })[0];
  }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    }).replace(/\n/g, "<br>");
  }
  function formatDate(d) {
    var parts = d.split("-");
    if (parts.length !== 3) return d;
    var dt = new Date(parts[0], parts[1] - 1, parts[2]);
    return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function typeEmoji(type) {
    var m = (type || "").match(/\p{Emoji}/u);
    return m ? m[0] : "🍽️";
  }

  // ---- little confetti-ish heart celebration ----
  function celebrate() {
    var hearts = ["💗", "💕", "🥰", "✨", "🍰"];
    for (var i = 0; i < 10; i++) {
      (function (i) {
        setTimeout(function () {
          var h = document.createElement("div");
          h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
          h.style.position = "fixed";
          h.style.left = (10 + Math.random() * 80) + "vw";
          h.style.top = "40vh";
          h.style.fontSize = (1.5 + Math.random() * 1.5) + "rem";
          h.style.zIndex = 9999;
          h.style.pointerEvents = "none";
          h.style.transition = "transform 1.2s ease-out, opacity 1.2s ease-out";
          document.body.appendChild(h);
          requestAnimationFrame(function () {
            h.style.transform = "translateY(-180px) rotate(" + (Math.random() * 60 - 30) + "deg)";
            h.style.opacity = "0";
          });
          setTimeout(function () { h.remove(); }, 1300);
        }, i * 60);
      })(i);
    }
  }

  // ---- initial paint ----
  paintStars(0);
  renderGallery();
})();
