/* ===================== DATA: HOTSPOTS, SEVERITY ===================== */

const HOTSPOTS = [
  { name: 'Mumbai',        lat: 19.076,  lon: 72.8777,  keywords: ['mumbai', 'maharashtra'] },
  { name: 'Porbandar',     lat: 21.6417, lon: 69.6293,  keywords: ['porbandar', 'gujarat'] },
  { name: 'Panaji',        lat: 15.4909, lon: 73.8278,  keywords: ['panaji', 'goa'] },
  { name: 'Kochi',         lat: 9.9312,  lon: 76.2673,  keywords: ['kochi', 'kerala', 'keralam'] },
  { name: 'Chennai',       lat: 13.0827, lon: 80.2707,  keywords: ['chennai', 'tamil nadu'] },
  { name: 'Visakhapatnam', lat: 17.6868, lon: 83.2185,  keywords: ['visakhapatnam', 'vizag', 'andhra pradesh'] },
  { name: 'Puri',          lat: 19.8135, lon: 85.8312,  keywords: ['puri', 'odisha'] },
  { name: 'Port Blair',    lat: 11.6234, lon: 92.7265,  keywords: ['port blair', 'andaman'] },
];

const MAJOR_TERMS = ['tsunami', 'cyclone', 'severe cyclonic storm'];
const MINOR_TERMS = ['high wave', 'high waves', 'storm surge', 'coastal flooding', 'swell surge', 'rip current'];

function severityForText(text) {
  const lower = (text || '').toLowerCase();
  if (MAJOR_TERMS.some((t) => lower.includes(t))) return 'major';
  if (MINOR_TERMS.some((t) => lower.includes(t))) return 'minor';
  return 'minor';
}

function fmtCoords(lat, lon) {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
}

// Populated once the live signal feed loads (see loadSignalFeed below);
// the map hover tooltip and marker colors both read from this.
let latestNewsItems = [];

function matchesForSpot(spot) {
  const lower = (s) => (s || '').toLowerCase();
  return latestNewsItems.filter((item) => spot.keywords.some((k) => lower(item.title).includes(k)));
}

function severityForSpot(spot) {
  const matches = matchesForSpot(spot);
  if (matches.length === 0) return 'quiet';
  if (matches.some((m) => severityForText(m.title) === 'major')) return 'major';
  return 'minor';
}

function findRelevantHeadline(spot) {
  const matches = matchesForSpot(spot);
  return matches.length > 0 ? matches[0] : null;
}

const SEVERITY_LABEL = { major: 'MAJOR', minor: 'WARNING', quiet: 'MONITORING' };

function renderTooltip(spot) {
  const tooltip = document.getElementById('globe-tooltip');
  if (!tooltip) return;
  const match = findRelevantHeadline(spot);
  const severity = severityForSpot(spot);
  const coords = fmtCoords(spot.lat, spot.lon);

  tooltip.innerHTML = `
    <span class="tooltip-city">${spot.name}</span>
    <span class="tooltip-coords">${coords}</span>
    <span class="tooltip-severity ${severity}">${SEVERITY_LABEL[severity]}</span>
    ${
      match
        ? `<span class="tooltip-headline">${match.title}</span><span class="tooltip-meta">${match.source || ''}</span>`
        : `<span class="tooltip-headline tooltip-quiet">No active hazard chatter right now — monitoring.</span>`
    }`;
}

/* ===================== LIVE SATELLITE MAP (Leaflet) ===================== */
/*
 * A real satellite-imagery map, locked to India's coastline, instead of a
 * custom WebGL globe. Leaflet only re-renders on user interaction (pan/zoom)
 * rather than running a continuous animation loop, so it stays smooth even
 * on modest hardware — and markers/labels are proper geo-positioned map
 * elements, so nothing "floats" independent of the terrain.
 */

let markerRefs = []; // { leafletMarker, spot }

function iconForSeverity(severity) {
  return window.L.divIcon({
    className: '',
    html: `<span class="hazard-marker ${severity}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

function updateMarkerSeverityColors() {
  markerRefs.forEach(({ leafletMarker, spot }) => {
    const severity = severityForSpot(spot);
    leafletMarker.setIcon(iconForSeverity(severity));
  });
}

function initMap() {
  const container = document.getElementById('hazard-map');
  if (!container || !window.L) return;

  const L = window.L;

  // Coastal-India focused bounding box — panning is clamped to this area.
  const INDIA_BOUNDS = L.latLngBounds([6, 66], [24, 95]);

  const map = L.map(container, {
    center: [15, 80],
    zoom: 5,
    minZoom: 4,
    maxZoom: 9,
    maxBounds: INDIA_BOUNDS.pad(0.3),
    maxBoundsViscosity: 1.0,
    zoomControl: true,
    attributionControl: true,
    scrollWheelZoom: true,
  });

  // Real satellite imagery — free public Esri World Imagery tiles.
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 9,
      attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
    }
  ).addTo(map);

  // Labels overlay — real place / water-body names, like an ordinary map.
  L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 9, opacity: 0.9 }
  ).addTo(map);

  map.fitBounds(INDIA_BOUNDS);

  const tooltip = document.getElementById('globe-tooltip');

  markerRefs = HOTSPOTS.map((spot) => {
    const marker = L.marker([spot.lat, spot.lon], { icon: iconForSeverity('quiet') }).addTo(map);

    marker.on('mouseover', (e) => {
      if (tooltip) {
        tooltip.hidden = false;
        renderTooltip(spot);
      }
    });
    marker.on('mousemove', (e) => {
      if (tooltip && e.originalEvent) {
        tooltip.style.left = `${e.originalEvent.clientX + 16}px`;
        tooltip.style.top = `${e.originalEvent.clientY + 16}px`;
      }
    });
    marker.on('mouseout', () => {
      if (tooltip) tooltip.hidden = true;
    });
    // touch devices: tap toggles the tooltip near the marker
    marker.on('click', (e) => {
      if (!tooltip) return;
      const wasHidden = tooltip.hidden;
      tooltip.hidden = !wasHidden ? true : false;
      if (wasHidden) {
        renderTooltip(spot);
        const point = map.latLngToContainerPoint(e.latlng);
        const rect = container.getBoundingClientRect();
        tooltip.style.left = `${rect.left + point.x + 16}px`;
        tooltip.style.top = `${rect.top + point.y + 16}px`;
        tooltip.hidden = false;
      }
    });

    return { leafletMarker: marker, spot };
  });

  // Leaflet sometimes mis-measures its container if it was hidden/animated
  // during layout (common in flex/grid heroes) — fix that once things settle.
  setTimeout(() => map.invalidateSize(), 250);
  window.addEventListener('resize', () => map.invalidateSize());
}

initMap();

/* ===================== LIVE CLOCK ===================== */

function tickClock() {
  const el = document.getElementById('signal-clock');
  if (!el) return;
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hh = String(ist.getHours()).padStart(2, '0');
  const mm = String(ist.getMinutes()).padStart(2, '0');
  const ss = String(ist.getSeconds()).padStart(2, '0');
  el.textContent = `${hh}:${mm}:${ss} IST`;
}
setInterval(tickClock, 1000);
tickClock();

/* ===================== LIVE SIGNAL FEED (Google News + Reddit) ===================== */

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes
let isSearchMode = false;

function timeAgo(dateStr) {
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then)) return '';
  const diffMin = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

async function fetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return { items: [] };
    return await res.json();
  } catch (_) {
    return { items: [] };
  }
}

async function fetchCombined(region) {
  const qs = region ? `?region=${encodeURIComponent(region)}` : '';
  const [newsRes, redditRes] = await Promise.all([
    fetchJson(`/api/news${qs}`),
    fetchJson(`/api/reddit${qs}`),
  ]);
  const items = [...(newsRes.items || []), ...(redditRes.items || [])].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );
  return items;
}

function renderFeedItems(items) {
  const feedEl = document.getElementById('signal-feed');
  if (!feedEl) return;

  if (items.length === 0) {
    feedEl.innerHTML = `<div class="signal-empty">No coastal hazard chatter found. Feed is quiet.</div>`;
    return;
  }

  feedEl.innerHTML = items
    .slice(0, 30)
    .map((item) => {
      const spot = HOTSPOTS.find((h) => h.keywords.some((k) => item.title.toLowerCase().includes(k)));
      const severity = severityForText(item.title);
      const coordsLine = spot
        ? `${spot.name} · ${fmtCoords(spot.lat, spot.lon)}`
        : 'Region not matched to a hotspot';
      const dotColor = spot ? severity : 'quiet';
      return `
        <a class="signal-item" href="${item.link}" target="_blank" rel="noopener noreferrer">
          <span class="signal-time">${timeAgo(item.pubDate)}</span>
          <span class="signal-body">
            <span class="signal-headline"><span class="dot legend-dot ${dotColor}" style="margin-right:6px;"></span>${item.title}</span>
            <span class="signal-coords">${coordsLine}</span>
          </span>
          <span class="signal-source">${item.source || ''}</span>
        </a>`;
    })
    .join('');
}

function updateAlertBanner() {
  const banner = document.getElementById('alert-banner');
  const msg = document.getElementById('alert-banner-message');
  if (!banner || !msg) return;

  const majorSpot = HOTSPOTS.find((spot) => severityForSpot(spot) === 'major');
  if (majorSpot && !banner.dataset.dismissed) {
    const headline = findRelevantHeadline(majorSpot);
    msg.textContent = `${majorSpot.name} (${fmtCoords(majorSpot.lat, majorSpot.lon)}) — ${
      headline ? headline.title : 'active major hazard signal detected'
    }`;
    banner.hidden = false;
  } else if (!majorSpot) {
    banner.hidden = true;
    banner.dataset.dismissed = '';
  }
}

async function loadSignalFeed() {
  const feedEl = document.getElementById('signal-feed');
  if (!feedEl || isSearchMode) return;
  try {
    const items = await fetchCombined(null);
    latestNewsItems = items;
    renderFeedItems(items);
    updateMarkerSeverityColors();
    updateAlertBanner();
  } catch (err) {
    feedEl.innerHTML = `<div class="signal-empty">Live feed unavailable right now (${err.message}). This panel reads from /api/news + /api/reddit once deployed — see README.</div>`;
  }
}

async function performSearch(region) {
  const feedEl = document.getElementById('signal-feed');
  const statusEl = document.getElementById('signal-status');
  const clearBtn = document.getElementById('signal-clear');
  if (!feedEl) return;

  isSearchMode = true;
  feedEl.innerHTML = `<div class="signal-loading">Searching "${region}"…</div>`;
  if (statusEl) {
    statusEl.classList.add('is-search');
    statusEl.innerHTML = `<span class="dot dot-live"></span> SEARCH — "${region}"`;
  }
  if (clearBtn) clearBtn.hidden = false;

  const items = await fetchCombined(region);
  renderFeedItems(items);
}

function exitSearchMode() {
  const statusEl = document.getElementById('signal-status');
  const clearBtn = document.getElementById('signal-clear');
  isSearchMode = false;
  if (statusEl) {
    statusEl.classList.remove('is-search');
    statusEl.innerHTML = `<span class="dot dot-live"></span> LIVE — INCOIS SIGNAL TELEX`;
  }
  if (clearBtn) clearBtn.hidden = true;
  loadSignalFeed();
}

loadSignalFeed();
setInterval(loadSignalFeed, REFRESH_MS);

/* ===================== SEARCH BAR UI ===================== */

const searchToggle = document.getElementById('search-toggle');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const searchSubmit = document.getElementById('search-submit');
const searchClose = document.getElementById('search-close');
const signalClear = document.getElementById('signal-clear');

function openSearchBar() {
  searchBar.classList.add('open');
  searchToggle.setAttribute('aria-expanded', 'true');
  setTimeout(() => searchInput.focus(), 200);
}
function closeSearchBar() {
  searchBar.classList.remove('open');
  searchToggle.setAttribute('aria-expanded', 'false');
}

if (searchToggle) {
  searchToggle.addEventListener('click', () => {
    searchBar.classList.contains('open') ? closeSearchBar() : openSearchBar();
  });
}
if (searchClose) searchClose.addEventListener('click', closeSearchBar);
if (searchSubmit) {
  searchSubmit.addEventListener('click', () => {
    const term = (searchInput.value || '').trim();
    if (!term) return;
    performSearch(term);
    closeSearchBar();
    document.getElementById('signal').scrollIntoView({ behavior: 'smooth' });
  });
}
if (searchInput) {
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchSubmit.click();
    if (e.key === 'Escape') closeSearchBar();
  });
}
if (signalClear) signalClear.addEventListener('click', exitSearchMode);

/* ===================== ALERT BANNER DISMISS ===================== */

const alertBannerClose = document.getElementById('alert-banner-close');
if (alertBannerClose) {
  alertBannerClose.addEventListener('click', () => {
    const banner = document.getElementById('alert-banner');
    banner.hidden = true;
    banner.dataset.dismissed = 'true';
  });
}

/* ===================== ALERT SIGNUP FORM ===================== */

const alertForm = document.getElementById('alert-form');
if (alertForm) {
  alertForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const contact = document.getElementById('alert-contact').value.trim();
    const region = document.getElementById('alert-region').value.trim();
    const statusEl = document.getElementById('alert-form-status');
    statusEl.textContent = 'Sending…';

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, region }),
      });
      const data = await res.json();
      statusEl.textContent = data.ok
        ? `✓ Signed up${region ? ` for ${region}` : ''}. ${data.message || ''}`
        : `✗ ${data.error || 'Something went wrong'}`;
      if (data.ok) alertForm.reset();
    } catch (err) {
      statusEl.textContent = '✗ Could not reach the signup endpoint.';
    }
  });
}
