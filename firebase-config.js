/* ============================================================
   Cross-device sync (optional) — Firebase Firestore
   ============================================================

   The app works offline with no setup (saves in your browser).
   To make your phone & laptop show the SAME memories, do this once:

   1. Go to  https://console.firebase.google.com  and sign in.
   2. Click "Add project" -> give it any name (e.g. "food-diary") ->
      you can turn OFF Google Analytics -> Create project.
   3. In the left menu: Build -> Firestore Database -> "Create database"
      -> choose "Start in test mode" -> pick a location -> Enable.
   4. Still in the left menu, click the gear ⚙️ -> Project settings.
      Scroll to "Your apps", click the  </>  (Web) icon, give it a
      nickname, click "Register app". It shows a `firebaseConfig = {...}`.
   5. Copy the values from that snippet into FIREBASE_CONFIG below.
   6. Save this file, commit & push. Open the site on both devices —
      they'll now sync automatically. ☁️

   NOTE: "test mode" leaves the database open for 30 days. That's fine
   to start. When you're ready to lock it down just to the two of you,
   tell Kiro and we'll add a tiny password/sign-in step.
   ============================================================ */

var FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// ---- Do not edit below this line ----
(function () {
  "use strict";

  // If config not filled in, do nothing -> app uses localStorage only.
  if (!FIREBASE_CONFIG.projectId) {
    console.info("[Food Diary] No Firebase config yet — running in local (single-device) mode.");
    return;
  }

  var COLLECTION = "records";
  var db = null;
  var handlers = {};

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
  }

  window.FoodDiaryCloud = {
    init: function (h) {
      handlers = h || {};
      var base = "https://www.gstatic.com/firebasejs/10.12.2/";
      // load the compat SDKs (simple global `firebase` API)
      loadScript(base + "firebase-app-compat.js")
        .then(function () { return loadScript(base + "firebase-firestore-compat.js"); })
        .then(function () {
          firebase.initializeApp(FIREBASE_CONFIG);
          db = firebase.firestore();

          // live listener — any change on any device updates everyone
          db.collection(COLLECTION).onSnapshot(function (snap) {
            var recs = [];
            snap.forEach(function (doc) { recs.push(doc.data()); });
            if (handlers.onRecords) handlers.onRecords(recs);
          }, function (err) {
            if (handlers.onError) handlers.onError(err.message);
          });

          if (handlers.onReady) handlers.onReady();
        })
        .catch(function (err) {
          if (handlers.onError) handlers.onError(err.message);
        });
    },

    save: function (record) {
      if (!db) return;
      db.collection(COLLECTION).doc(String(record.id)).set(record)
        .catch(function (err) { if (handlers.onError) handlers.onError(err.message); });
    },

    remove: function (id) {
      if (!db) return;
      db.collection(COLLECTION).doc(String(id)).delete()
        .catch(function (err) { if (handlers.onError) handlers.onError(err.message); });
    }
  };
})();
