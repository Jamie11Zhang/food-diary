/* ===== Food Diary — logic ===== */
(function () {
  "use strict";

  var STORAGE_KEY = "ourFoodDiaryRecords";

  // ---- state ----
  var records = loadRecords();
  var currentRating = 0;        // overall rating
  var currentPhoto = null;      // base64 data URL or null
  var editingId = null;         // id being edited, or null
  var currentLocation = null;   // { label, lat, lng } or null

  // map state
  var map = null, marker = null;

  // ---- element refs ----
  var openAddBtn = document.getElementById("open-add");
  var overlay = document.getElementById("modal-overlay");
  var closeModalBtn = document.getElementById("close-modal");
  var cancelEditBtn = document.getElementById("cancel-edit");
  var modalTitle = document.getElementById("modal-title");

  var form = document.getElementById("record-form");
  var starsEl = document.getElementById("stars");
  var photoInput = document.getElementById("photo");
  var photoPreview = document.getElementById("photo-preview");
  var previewImg = document.getElementById("preview-img");
  var removePhotoBtn = document.getElementById("remove-photo");
  var submitBtn = document.getElementById("submit-btn");

  var dishesList = document.getElementById("dishes-list");
  var addDishBtn = document.getElementById("add-dish");
  var dishTemplate = document.getElementById("dish-template");

  var locSearchInput = document.getElementById("location-search");
  var locSearchBtn = document.getElementById("loc-search-btn");
  var locResults = document.getElementById("loc-results");
  var locChosen = document.getElementById("loc-chosen");

  var recordsEl = document.getElementById("records");
  var emptyState = document.getElementById("empty-state");
  var countLine = document.getElementById("count-line");
  var searchInput = document.getElementById("search");
  var filterType = document.getElementById("filter-type");
  var sortBy = document.getElementById("sort-by");
  var dateInput = document.getElementById("date");

  // ============================================================
  // MODAL
  // ============================================================
  openAddBtn.addEventListener("click", function () { openModal(); });
  closeModalBtn.addEventListener("click", closeModal);
  cancelEditBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !overlay.classList.contains("hidden")) closeModal();
  });

  function openModal() {
    overlay.classList.remove("hidden");
    document.body.classList.add("modal-open");
    // map needs to recalculate size after being shown
    setTimeout(initOrResizeMap, 60);
  }
  function closeModal() {
    overlay.classList.add("hidden");
    document.body.classList.remove("modal-open");
    resetForm();
  }

  // ============================================================
  // OVERALL STAR RATING
  // ============================================================
  var starEls = starsEl.querySelectorAll(".star");
  starEls.forEach(function (star) {
    star.addEventListener("mouseenter", function () {
      paintStars(starEls, parseInt(star.getAttribute("data-value"), 10));
    });
    star.addEventListener("click", function () {
      currentRating = parseInt(star.getAttribute("data-value"), 10);
      paintStars(starEls, currentRating);
    });
  });
  starsEl.addEventListener("mouseleave", function () { paintStars(starEls, currentRating); });

  function paintStars(nodeList, n) {
    nodeList.forEach(function (star) {
      var v = parseInt(star.getAttribute("data-value"), 10);
      star.classList.toggle("filled", v <= n);
    });
  }

  // ============================================================
  // DISHES (repeatable rows with name + rating + comment)
  // ============================================================
  addDishBtn.addEventListener("click", function () { addDishRow(); });

  function addDishRow(data) {
    data = data || {};
    var frag = dishTemplate.content.cloneNode(true);
    var row = frag.querySelector(".dish-row");
    var nameEl = row.querySelector(".dish-name");
    var commentEl = row.querySelector(".dish-comment");
    var dstars = row.querySelectorAll(".dstar");
    var rowRating = data.rating || 0;

    nameEl.value = data.name || "";
    commentEl.value = data.comment || "";
    paintStars(dstars, rowRating);
    // store rating on the row element itself
    row._rating = rowRating;

    dstars.forEach(function (st) {
      st.addEventListener("mouseenter", function () {
        paintStars(dstars, parseInt(st.getAttribute("data-value"), 10));
      });
      st.addEventListener("click", function () {
        row._rating = parseInt(st.getAttribute("data-value"), 10);
        paintStars(dstars, row._rating);
      });
    });
    row.querySelector(".dish-stars").addEventListener("mouseleave", function () {
      paintStars(dstars, row._rating);
    });
    row.querySelector(".dish-remove").addEventListener("click", function () {
      row.remove();
    });

    dishesList.appendChild(row);
  }

  function collectDishes() {
    var out = [];
    dishesList.querySelectorAll(".dish-row").forEach(function (row) {
      var name = row.querySelector(".dish-name").value.trim();
      var comment = row.querySelector(".dish-comment").value.trim();
      var rating = row._rating || 0;
      if (name || comment || rating) {
        out.push({ name: name, comment: comment, rating: rating });
      }
    });
    return out;
  }

  // ============================================================
  // PHOTO
  // ============================================================
  photoInput.addEventListener("change", function () {
    var file = photoInput.files[0];
    if (!file) return;
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
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        try { cb(canvas.toDataURL("image/jpeg", 0.85)); }
        catch (err) { cb(e.target.result); }
      };
      img.onerror = function () { cb(e.target.result); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ============================================================
  // MAP + LOCATION SEARCH (Leaflet + Nominatim, free/no key)
  // ============================================================
  function initOrResizeMap() {
    if (typeof L === "undefined") return; // Leaflet not loaded
    if (!map) {
      map = L.map("map").setView([20, 0], 2);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors"
      }).addTo(map);
      map.on("click", function (e) {
        setLocationPin(e.latlng.lat, e.latlng.lng, null);
        reverseGeocode(e.latlng.lat, e.latlng.lng);
      });
    }
    map.invalidateSize();
    if (currentLocation) {
      setLocationPin(currentLocation.lat, currentLocation.lng, currentLocation.label, true);
      map.setView([currentLocation.lat, currentLocation.lng], 15);
    }
  }

  function setLocationPin(lat, lng, label, keepLabel) {
    if (!map) return;
    if (marker) { marker.setLatLng([lat, lng]); }
    else { marker = L.marker([lat, lng]).addTo(map); }
    currentLocation = {
      lat: lat, lng: lng,
      label: (label != null ? label : (currentLocation && keepLabel ? currentLocation.label : ""))
    };
    showChosen();
  }

  function showChosen() {
    if (currentLocation && (currentLocation.label || currentLocation.lat)) {
      locChosen.textContent = "📍 " + (currentLocation.label || (currentLocation.lat.toFixed(4) + ", " + currentLocation.lng.toFixed(4)));
    } else {
      locChosen.textContent = "";
    }
  }

  locSearchBtn.addEventListener("click", doLocationSearch);
  locSearchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); doLocationSearch(); }
  });

  function doLocationSearch() {
    var q = locSearchInput.value.trim();
    if (!q) return;
    locResults.innerHTML = '<div>Searching…</div>';
    locResults.classList.remove("hidden");
    fetch("https://nominatim.openstreetmap.org/search?format=json&limit=6&q=" + encodeURIComponent(q), {
      headers: { "Accept": "application/json" }
    })
      .then(function (r) { return r.json(); })
      .then(function (results) {
        locResults.innerHTML = "";
        if (!results || !results.length) {
          locResults.innerHTML = '<div>No places found — try a different search.</div>';
          return;
        }
        results.forEach(function (res) {
          var div = document.createElement("div");
          div.textContent = res.display_name;
          div.addEventListener("click", function () {
            var lat = parseFloat(res.lat), lng = parseFloat(res.lon);
            setLocationPin(lat, lng, res.display_name);
            if (map) map.setView([lat, lng], 15);
            locResults.classList.add("hidden");
            locResults.innerHTML = "";
          });
          locResults.appendChild(div);
        });
      })
      .catch(function () {
        locResults.innerHTML = '<div>Couldn\'t reach the map search (check your connection).</div>';
      });
  }

  function reverseGeocode(lat, lng) {
    fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lng)
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.display_name) {
          currentLocation.label = res.display_name;
          showChosen();
        }
      })
      .catch(function () {});
  }

  // ============================================================
  // SUBMIT
  // ============================================================
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var data = {
      id: editingId || String(Date.now()),
      place: document.getElementById("place").value.trim(),
      type: document.getElementById("type").value,
      date: document.getElementById("date").value,
      location: currentLocation,
      price: document.getElementById("price").value.trim(),
      dishes: collectDishes(),
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
    closeModal();
    renderGallery();
    celebrate();
  });

  function resetForm() {
    form.reset();
    currentRating = 0;
    currentPhoto = null;
    editingId = null;
    currentLocation = null;
    paintStars(starEls, 0);
    photoPreview.classList.add("hidden");
    dishesList.innerHTML = "";
    addDishRow(); // start with one empty dish
    locResults.classList.add("hidden");
    locResults.innerHTML = "";
    locChosen.textContent = "";
    if (marker && map) { map.removeLayer(marker); marker = null; }
    if (map) map.setView([20, 0], 2);
    dateInput.value = new Date().toISOString().slice(0, 10);
    submitBtn.textContent = "💗 Save this memory";
    modalTitle.textContent = "Where did we go? 🍴";
  }

  // ============================================================
  // GALLERY
  // ============================================================
  [searchInput, filterType, sortBy].forEach(function (el) {
    el.addEventListener("input", renderGallery);
  });

  function renderGallery() {
    var term = searchInput.value.trim().toLowerCase();
    var typeFilter = filterType.value;
    var list = records.filter(function (r) {
      if (typeFilter && r.type !== typeFilter) return false;
      if (!term) return true;
      var dishText = (r.dishes || []).map(function (d) { return d.name + " " + d.comment; }).join(" ");
      var locText = r.location ? r.location.label : "";
      var hay = [r.place, dishText, r.comments, r.type, r.price, locText].join(" ").toLowerCase();
      return hay.indexOf(term) !== -1;
    });

    list.sort(function (a, b) {
      if (sortBy.value === "oldest") return a.createdAt - b.createdAt;
      if (sortBy.value === "rating") return (b.rating || 0) - (a.rating || 0);
      return b.createdAt - a.createdAt;
    });

    recordsEl.innerHTML = "";
    if (records.length === 0) {
      emptyState.classList.remove("hidden");
      countLine.textContent = "";
      return;
    }
    emptyState.classList.add("hidden");
    countLine.textContent = list.length
      ? list.length + (list.length === 1 ? " memory ♡" : " memories ♡")
      : "No matches — try a different search 🔍";

    list.forEach(function (r) { recordsEl.appendChild(buildCard(r)); });
  }

  function buildCard(r) {
    var card = document.createElement("div");
    card.className = "record-card";

    var media = r.photo
      ? '<img class="card-photo" src="' + r.photo + '" alt="' + esc(r.place) + '" />'
      : '<div class="card-no-photo">' + typeEmoji(r.type) + "</div>";

    var stars = starString(r.rating);

    var loc = "";
    if (r.location && (r.location.label || r.location.lat)) {
      var mapsUrl = "https://www.openstreetmap.org/?mlat=" + r.location.lat + "&mlon=" + r.location.lng + "#map=16/" + r.location.lat + "/" + r.location.lng;
      loc = '<p class="card-loc">📍 <a href="' + mapsUrl + '" target="_blank" rel="noopener">' +
            esc(shortLoc(r.location.label) || (r.location.lat.toFixed(3) + ", " + r.location.lng.toFixed(3))) + "</a></p>";
    }

    var dishesHtml = "";
    if (r.dishes && r.dishes.length) {
      dishesHtml = '<ul class="card-dishes">';
      r.dishes.forEach(function (d) {
        dishesHtml += "<li>" +
          '<span class="d-name">🍴 ' + esc(d.name || "dish") + "</span> " +
          (d.rating ? '<span class="d-stars">' + starString(d.rating) + "</span>" : "") +
          (d.comment ? ' <span class="d-comment">— ' + esc(d.comment) + "</span>" : "") +
          "</li>";
      });
      dishesHtml += "</ul>";
    }

    var rows = "";
    if (r.price)    rows += '<p class="card-row"><b>💰 Price:</b> ' + esc(r.price) + "</p>";
    if (r.comments) rows += '<p class="card-row"><b>💌 Notes:</b> ' + esc(r.comments) + "</p>";

    card.innerHTML =
      media +
      '<div class="card-body">' +
        '<h3 class="card-title">' + esc(r.place) + "</h3>" +
        '<p class="card-meta">' + esc(r.type) + (r.date ? " · " + formatDate(r.date) : "") + "</p>" +
        '<div class="card-stars">' + stars + "</div>" +
        loc +
        dishesHtml +
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
    openModal();
    editingId = id;
    modalTitle.textContent = "Edit this memory ✏️";
    document.getElementById("place").value = r.place || "";
    document.getElementById("type").value = r.type || "🍽️ Restaurant";
    document.getElementById("date").value = r.date || "";
    document.getElementById("price").value = r.price || "";
    document.getElementById("comments").value = r.comments || "";
    currentRating = r.rating || 0;
    paintStars(starEls, currentRating);

    // dishes
    dishesList.innerHTML = "";
    if (r.dishes && r.dishes.length) {
      r.dishes.forEach(function (d) { addDishRow(d); });
    } else {
      addDishRow();
    }

    // location
    currentLocation = r.location || null;
    showChosen();
    setTimeout(function () {
      initOrResizeMap();
      if (currentLocation && map) {
        setLocationPin(currentLocation.lat, currentLocation.lng, currentLocation.label, true);
        map.setView([currentLocation.lat, currentLocation.lng], 15);
      }
    }, 80);

    // photo
    currentPhoto = r.photo || null;
    if (currentPhoto) { previewImg.src = currentPhoto; photoPreview.classList.remove("hidden"); }
    else { photoPreview.classList.add("hidden"); }

    submitBtn.textContent = "💾 Update memory";
  }

  function deleteRecord(id) {
    var r = findRecord(id);
    if (!r) return;
    if (!confirm('Delete the memory of "' + r.place + '"? This can\'t be undone.')) return;
    records = records.filter(function (x) { return x.id !== id; });
    saveRecords();
    renderGallery();
  }

  // ============================================================
  // STORAGE
  // ============================================================
  function loadRecords() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveRecords() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(records)); }
    catch (e) { alert("Couldn't save — browser storage may be full (photos take space). Try removing a photo."); }
  }

  // ============================================================
  // HELPERS
  // ============================================================
  function findRecord(id) {
    return records.filter(function (r) { return r.id === id; })[0];
  }
  function esc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    }).replace(/\n/g, "<br>");
  }
  function starString(n) {
    n = n || 0;
    var s = "";
    for (var i = 1; i <= 5; i++) s += i <= n ? "★" : "☆";
    return s;
  }
  function shortLoc(label) {
    if (!label) return "";
    var parts = label.split(",");
    return parts.slice(0, 3).join(", ").trim();
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
  paintStars(starEls, 0);
  addDishRow(); // one empty dish ready in the form
  renderGallery();
})();
