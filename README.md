# Food Diary 🍰

A cute, warm little website for recording the restaurants, cafés, dessert shops, and more that we visit together. 💕

## Features
- **Gallery-first** — your records are the main page. Tap the **＋** button in the top-right to add a new memory in a pop-up.
- **📍 Location with a map** — type a postcode / area / place and search, or click directly on the map to drop a pin. Powered by free OpenStreetMap + Leaflet (no API key needed).
- **🍴 Per-dish entries** — add as many dishes as you like, each with its own name, comment, and 5-star rating.
- **Overall rating, photo, price, date, type**, and a notes box for memories.
- **Search, filter by type, and sort** (newest / oldest / highest rated). Edit or delete any entry.
- **Fully responsive** — looks and works great on phones.
- **Warm hand-written style** — baby-blue → buttery-cream background, handwritten fonts, floating food doodles, and a little heart celebration when you save. ✨

## Cross-device sync (phone ↔ laptop)
By default the app saves **locally in your browser**, so a memory added on your phone won't show on your laptop. To make both devices show the **same** memories, set up free Firebase sync — full step-by-step instructions are at the top of **`firebase-config.js`**. In short: create a free Firebase project, enable Firestore, copy the config keys into that file, then commit & push. A badge in the header shows **📱 this device only** until it's connected, then **☁️ synced**.

Until you set that up, everything still works — it just stays on each device.

## Fields recorded
Place name, type, **cuisine** (e.g. Thai, Italian — optional), date, location (with map), **price** (currency + amount + number of people), overall rating, **multiple photos**, per-dish entries (name + comment + rating), and notes.

## Running it
It's a plain static site — just open `index.html` in a browser, or visit the GitHub Pages link.

```
index.html   — page structure + add/edit modal
styles.css   — the warm, cute, responsive theme
app.js       — modal, map, dishes, rating & storage logic
```

Made with ♡
