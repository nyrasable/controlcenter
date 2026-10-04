const { read } = require("../lib/session");
const { fresh } = require("../lib/tiktok");

module.exports = async (req, res) => {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    let session = read(req);
    if (!session) return res.status(401).json({ error: "Not authenticated" });

    session = await fresh(session, res);

    const fields = [
      "id","create_time","cover_image_url","share_url","video_description",
      "title","duration","like_count","comment_count","share_count","view_count"
    ].join(",");

    const videos = [];
    let cursor;
    let hasMore = true;

    while (hasMore && videos.length < 50) {
      const body = { max_count: 20 };
      if (cursor) body.cursor = cursor;

      const response = await fetch(
        "https://open.tiktokapis.com/v2/video/list/?fields=" + encodeURIComponent(fields),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        }
      );

      const data = await response.json();
      if (!response.ok || (data.error?.code && data.error.code !== "ok")) {
        throw new Error(data.error?.message || "TikTok video.list error");
      }

      const page = data.data?.videos || [];
      videos.push(...page);
      cursor = data.data?.cursor;
      hasMore = Boolean(data.data?.has_more && cursor);
      if (!page.length) break;
    }

    res.status(200).json({
      videos: videos.slice(0, 50),
      count: Math.min(videos.length, 50),
      cursor,
      has_more: hasMore
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
