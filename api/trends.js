const SOURCE_URL =
  "https://ads.tiktok.com/creative/creativeCenter/trends/hashtag?deviceType=pc&locale=en&period=7&region=FR";

function compactNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return null;
  const n = Number(value);
  if (n >= 1e9) return (n / 1e9).toFixed(n >= 1e10 ? 0 : 1).replace(".0","") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".0","") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(".0","") + "K";
  return String(Math.round(n));
}

function cleanTag(value) {
  if (typeof value !== "string") return null;
  let s = value.trim().replace(/^#/, "");
  if (!s || s.length < 2 || s.length > 80) return null;
  if (!/^[\p{L}\p{N}_]+$/u.test(s)) return null;
  return s;
}

function firstNumber(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && !Number.isNaN(Number(obj[key]))) {
      return Number(obj[key]);
    }
  }
  return null;
}

function collectFromObject(root, bag) {
  const seen = new WeakSet();

  function walk(node) {
    if (!node || typeof node !== "object") return;
    if (seen.has(node)) return;
    seen.add(node);

    if (!Array.isArray(node)) {
      const rawName =
        node.hashtagName ??
        node.hashtag_name ??
        node.hashtag ??
        node.tagName ??
        node.tag_name ??
        (typeof node.name === "string" && node.name.startsWith("#") ? node.name : null);

      const hashtag = cleanTag(rawName);

      if (hashtag) {
        const rank = firstNumber(node, ["rank","rankNumber","ranking","rank_num"]);
        const posts = firstNumber(node, [
          "posts","postCount","post_count","publishCnt","publish_cnt",
          "videoCount","video_count","publishCount"
        ]);
        const views = firstNumber(node, [
          "views","viewCount","view_count","playCount","play_count","vv"
        ]);

        bag.push({ hashtag, rank, posts, views });
      }
    }

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else {
      for (const value of Object.values(node)) walk(value);
    }
  }

  walk(root);
}

function collectFromScripts(html, bag) {
  const scripts = html.match(/<script[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of scripts) {
    const body = block.replace(/^<script[^>]*>/i,"").replace(/<\/script>$/i,"").trim();
    if (!body) continue;

    if (body.startsWith("{") || body.startsWith("[")) {
      try {
        collectFromObject(JSON.parse(body), bag);
      } catch {}
    }

    const patterns = [
      /"hashtagName"\s*:\s*"([^"]+)"/g,
      /"hashtag_name"\s*:\s*"([^"]+)"/g,
      /"hashtag"\s*:\s*"([^"]+)"/g
    ];

    for (const re of patterns) {
      let m;
      while ((m = re.exec(body))) {
        const hashtag = cleanTag(m[1]);
        if (hashtag) bag.push({ hashtag, rank:null, posts:null, views:null });
      }
    }
  }
}

function collectVisibleHashtags(html, bag) {
  const re = /#([\p{L}\p{N}_]{2,80})/gu;
  let m;
  while ((m = re.exec(html))) {
    const hashtag = cleanTag(m[1]);
    if (hashtag) bag.push({ hashtag, rank:null, posts:null, views:null });
  }
}

function dedupe(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = String(row.hashtag || "").toLowerCase();
    if (!key) continue;

    if (!map.has(key)) {
      map.set(key, { ...row });
    } else {
      const old = map.get(key);
      if (old.rank == null && row.rank != null) old.rank = row.rank;
      if (old.posts == null && row.posts != null) old.posts = row.posts;
      if (old.views == null && row.views != null) old.views = row.views;
    }
  }

  let out = [...map.values()]
    .filter(x => !["tiktok","foryou","fyp"].includes(x.hashtag.toLowerCase()));

  const ranked = out.filter(x => Number.isFinite(x.rank) && x.rank > 0)
    .sort((a,b)=>a.rank-b.rank);

  if (ranked.length >= 3) out = ranked;
  else out = out.slice(0,30).map((x,i)=>({...x,rank:x.rank || i+1}));

  return out.slice(0,30).map(x=>({
    ...x,
    posts_text: compactNumber(x.posts),
    views_text: compactNumber(x.views)
  }));
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error:"Method not allowed" });
  }

  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language":"fr-FR,fr;q=0.9,en;q=0.8"
      },
      redirect:"follow"
    });

    if (!response.ok) {
      throw new Error("Creative Center HTTP " + response.status);
    }

    const html = await response.text();
    const bag = [];

    collectFromScripts(html, bag);
    collectVisibleHashtags(html, bag);

    const trends = dedupe(bag);

    return res.status(200).json({
      available: trends.length >= 3,
      region:"FR",
      period_days:7,
      source:"TikTok Creative Center public",
      source_url:SOURCE_URL,
      fetched_at:new Date().toISOString(),
      trends
    });
  } catch (e) {
    return res.status(200).json({
      available:false,
      region:"FR",
      period_days:7,
      source:"TikTok Creative Center public",
      source_url:SOURCE_URL,
      fetched_at:new Date().toISOString(),
      trends:[],
      warning:String(e.message || e)
    });
  }
};
