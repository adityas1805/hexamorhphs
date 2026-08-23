// /api/reddit.js
// Vercel serverless function (Node runtime).
// Pulls public Reddit search results for coastal-hazard discussion — no
// API key or OAuth needed, since Reddit's .json search endpoint is public.
// Supports the same optional ?region=<place> param as /api/news.js.
//
// Note: Reddit sometimes rate-limits anonymous requests from shared cloud
// IPs (you may occasionally see empty results). The frontend handles that
// gracefully — the Google News source keeps working either way.

const SUBREDDITS = ['india', 'IndiaSpeaks', 'Kerala', 'mumbai', 'chennai'];

function buildQuery(region) {
  const base = 'tsunami OR cyclone OR "high waves" OR "storm surge" OR flooding';
  return region && region.trim() ? `${base} ${region.trim()}` : `${base} coastal India`;
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

  const url =
    `https://www.reddit.com/r/${SUBREDDITS.join('+')}/search.json?` +
    new URLSearchParams({
      q: buildQuery(region),
      sort: 'new',
      restrict_sr: 'true',
      limit: '15',
    }).toString();

  try {
    const upstream = await fetch(url, {
      headers: { 'User-Agent': 'web:sagar-setu-sih25039:v1.0 (by /u/sagar_setu_team)' },
    });

    if (!upstream.ok) {
      // Rate-limited or blocked — fail soft with an empty list, not an error page.
      res.status(200).json({ items: [], note: `Reddit responded ${upstream.status}` });
      return;
    }

    const data = await upstream.json();
    const posts = (data && data.data && data.data.children) || [];

    const items = posts
      .map((p) => p.data)
      .filter((p) => p && p.title)
      .map((p) => ({
        title: p.title,
        link: `https://reddit.com${p.permalink}`,
        pubDate: new Date(p.created_utc * 1000).toISOString(),
        source: `Reddit · r/${p.subreddit}`,
      }));

    res.status(200).json({ updated: new Date().toISOString(), items });
  } catch (err) {
    res.status(200).json({ items: [], note: err.message || 'Reddit fetch failed' });
  }
};
