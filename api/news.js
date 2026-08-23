// /api/news.js
// Vercel serverless function (Node runtime).
// Fetches Google News RSS server-side (no API key required, avoids browser CORS
// restrictions) and returns a small clean JSON array for the live signal feed.
//
// Supports an optional ?region=<place> query param (used by the site's search
// bar) which narrows the search to hazard news mentioning that place, instead
// of the general India-coast query.
//
// To swap in NewsAPI.org or GNews later (once you have a key), replace the
// fetch() call — the rest of the parsing/response shape can stay the same if
// you map their fields to { title, link, pubDate, source }.

const BASE_HAZARD_TERMS =
  '(tsunami OR cyclone OR "high waves" OR "storm surge" OR "coastal flooding" OR "ocean hazard" OR "swell surge")';

function buildQuery(region) {
  if (region && region.trim()) {
    return `${BASE_HAZARD_TERMS} AND "${region.trim()}"`;
  }
  return `${BASE_HAZARD_TERMS} AND (India OR coast OR coastal)`;
}

function buildRssUrl(region) {
  return (
    'https://news.google.com/rss/search?q=' +
    encodeURIComponent(buildQuery(region)) +
    '&hl=en-IN&gl=IN&ceid=IN:en'
  );
}

function stripCdata(str) {
  if (!str) return '';
  return str.replace('<![CDATA[', '').replace(']]>', '').trim();
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? decodeEntities(stripCdata(match[1])) : '';
}

function extractSourceAttr(block) {
  // <source url="...">Source Name</source>
  const match = block.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
  return match ? decodeEntities(stripCdata(match[1])) : '';
}

function parseRss(xml) {
  const items = [];
  const itemBlocks = xml.split('<item>').slice(1);

  for (const raw of itemBlocks) {
    const block = raw.split('</item>')[0];
    let title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    let source = extractSourceAttr(block);

    // Google News titles often look like "Headline - Source Name"
    if (source && title.endsWith(source)) {
      title = title.slice(0, title.length - source.length).replace(/[\s-]+$/, '').trim();
    }

    if (title && link) {
      items.push({ title, link, pubDate, source });
    }
  }
  return items;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
  res.setHeader('Access-Control-Allow-Origin', '*');

  let region = '';
  try {
    const { searchParams } = new URL(req.url, 'http://localhost');
    region = searchParams.get('region') || '';
  } catch (_) {
    region = '';
  }

  try {
    const upstream = await fetch(buildRssUrl(region), {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SagarSetuBot/1.0)' },
    });

    if (!upstream.ok) {
      res.status(502).json({ error: `Upstream feed returned ${upstream.status}`, items: [] });
      return;
    }

    const xml = await upstream.text();
    const items = parseRss(xml).sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    res.status(200).json({ updated: new Date().toISOString(), region: region || null, items });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch feed', items: [] });
  }
};
