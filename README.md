# Sagar Setu — SIH25039 showcase site

Website for **SIH25039: Integrated Platform for Crowdsourced Ocean Hazard
Reporting and Social Media Analytics** (INCOIS / Ministry of Earth Sciences).

---

## 1. What changed in this version (performance rebuild)

The earlier version used a custom Three.js 3D globe, which caused two real
problems: it lagged on modest hardware (a continuous WebGL render loop
competing for the GPU every frame), and the place-name labels floated
disconnected from the globe when rotated (a known limitation of layering
DOM labels over WebGL without depth-based hiding).

Both are now fixed by switching to **Leaflet** — a mature, lightweight
mapping library — with **real satellite imagery** instead of a custom 3D
scene:

- **No more lag**: Leaflet only redraws when you actually pan or zoom. There
  is no per-frame animation loop running in the background.
- **No more floating labels**: place names now come from a real map labels
  layer, correctly positioned on the actual map — not custom 3D objects.
- **Locked to India's coast**: panning is clamped to a bounding box around
  India (`maxBounds`), and zoom is limited to a sensible range
  (`minZoom`/`maxZoom`), so the view can't wander off to unrelated parts of
  the world.
- **Real zoom, real imagery**: scroll or pinch to zoom in, and you're looking
  at genuine satellite photography (Esri World Imagery — free, no API key),
  not a stylized texture.

If you ever want the 3D spinning-globe look back for a different reason,
that's a bigger, separate rebuild — ask and it can be discussed, but the
map approach here is the one built to actually be smooth and reliable.

---

## 2. What's in this folder

```
ocean-hazard-platform/
├── index.html          the whole page
├── styles.css           all styling (warm color palette)
├── script.js             satellite map + live feed + search + alerts logic
├── api/
│   ├── news.js            serverless fn: Google News RSS (real, live)
│   ├── reddit.js           serverless fn: Reddit public search (real, live)
│   └── subscribe.js        serverless fn: alert signup capture (see note)
├── package.json
├── vercel.json
└── README.md              (this file)
```

No build step — plain HTML/CSS/JS, nothing to `npm install` before previewing.

---

## 3. What's fully real right now

- **Satellite map of India's coast** — real Esri satellite imagery with a
  real place-name/water-body labels layer on top, like an ordinary map app.
  Panning locked to India, zoom locked to a sensible coastal-detail range.
- **Live severity-colored markers** — 8 coastal hotspots, colored by
  matching live headlines against each: **red = major** (tsunami/cyclone),
  **orange = warning/minor** (high waves/storm surge/flooding), **teal =
  quiet/monitoring**. Updates every feed refresh from real data.
- **Hover / tap tooltips** — shows coordinates, severity, and the most
  relevant live headline for that hotspot.
- **Live signal feed** — merges **Google News RSS** and **Reddit's public
  search** (r/india, r/Kerala, r/mumbai, r/chennai, r/IndiaSpeaks), every 5
  minutes. Each item shows the matched hotspot's coordinates.
- **Region search** — nav search bar queries both sources live for a place
  you type in. (Searches what's currently published about that region, not
  a historical reports archive — there's no reports database yet; see the
  "Ops dashboard" tech-stack section for what that would need.)
- **Auto-triggered major-hazard banner** — appears automatically when any
  hotspot's live severity becomes "major."
- **Clickable logo/name** — top-left brand mark now scrolls back to the top.

## 4. What's wired but needs one more step to be fully live

- **Alert signup form** (`/api/subscribe`) — works end-to-end (validates,
  hits the API, shows success/error) but the function currently just logs
  the signup instead of storing it, since Vercel functions have no database
  of their own. To make it real:
  1. Add a database — free tier of Supabase, Firebase, or a Google Sheet via
     an Apps Script webhook — write to it where the `TODO` is in
     `api/subscribe.js`.
  2. Add a dispatch trigger — Twilio (SMS, paid) or SendGrid/Resend (email,
     free tier) called whenever a "major" item is detected.
  It's completely fine to tell judges "signup capture is live; SMS/email
  dispatch is the next integration."

---

## 5. Preview it on your own computer first

You can't just double-click `index.html` — the live feed needs the `/api`
functions to run on a server.

1. Install [Node.js](https://nodejs.org) (v18+) if you don't have it.
2. Install the free Vercel CLI: `npm install -g vercel`
3. From inside this folder, run: `vercel dev`
4. Open the local address it prints (e.g. `http://localhost:3000`).

---

## 6. Deploy it live

### Vercel (recommended)

1. Free account at [vercel.com](https://vercel.com) (sign in with GitHub).
2. Push this folder to a GitHub repo.
3. Vercel → **Add New Project → Import** your repo → **Deploy**. No settings
   to change — Vercel auto-detects the `api/` folder.
4. You get a live URL in ~30 seconds.

### Uploading via GitHub's web UI (no local Git needed)

If you're dragging files into GitHub's browser uploader rather than using
`git push`, **nested folders sometimes get dropped**. After uploading, check
your repo has an `api` folder with all three files inside (`news.js`,
`reddit.js`, `subscribe.js`). If any are missing: **Add file → Create new
file**, type the full path (e.g. `api/reddit.js`) so GitHub creates the
folder, paste in the content, commit.

### The most convenient way to make further changes

For small tweaks going forward, the fastest loop is:

1. Tell me what you want changed.
2. I hand you the specific file(s) that changed (not the whole zip, unless
   it's a big rework) — usually just `script.js`, `styles.css`, or
   `index.html`.
3. On GitHub: open that file → pencil (edit) icon → select all → paste the
   new content → **Commit changes**.
4. Vercel auto-redeploys within ~30–60 seconds of any commit. No re-import,
   no settings to touch — just refresh your live URL after a minute.

You only need to re-download the full zip when a change touches many files
at once (like this one did).

---

## 7. Customizing content

- **Team names:** `index.html`, `<section class="team">` near the bottom.
- **Hero text:** `index.html`, `<section class="hero">` near the top.
- **News search terms:** `api/news.js`, the `BASE_HAZARD_TERMS` constant.
- **Reddit subreddits/terms:** `api/reddit.js`, `SUBREDDITS` and `buildQuery`.
- **Hotspot markers & coordinates:** `script.js`, the `HOTSPOTS` array near
  the top — each entry is `{ name, lat, lon, keywords }`.
- **Map bounds/zoom limits:** `script.js`, inside `initMap()` —
  `INDIA_BOUNDS`, `minZoom`, `maxZoom`.
- **Severity keywords:** `script.js`, `MAJOR_TERMS` / `MINOR_TERMS`.
- **Colors:** `styles.css`, the `:root` block at the top.

---

## 8. What this site is (and isn't)

This is the **showcase/presentation site** for your submission, with several
genuinely live data integrations (Google News, Reddit, severity
classification, region search, real satellite mapping) proving the "signal
analytics" concept works for real. It is **not** the actual citizen-
reporting mobile app or the full INCOIS ops dashboard described in the
problem statement, and alert dispatch (SMS/email/push) needs a paid or
free-tier provider connected as described above. If you want to start on
the actual reporting-app or dashboard next, or wire up real alert dispatch,
just ask.
