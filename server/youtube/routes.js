const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const { oauth2Client } = require('./oauth');
const { setCache, getCache } = require('../cache');

/* ----------------------------------------------------
     AUTH MIDDLEWARE
---------------------------------------------------- */
function requireAuth(req, res, next) {
  if (!oauth2Client.credentials || !oauth2Client.credentials.access_token) {
    return res.status(401).json({
      success: false,
      error: "YouTube auto-login tokens not loaded. Login once using /auth/youtube."
    });
  }
  next();
}

/* ----------------------------------------------------
     HELPER: Find/Create "Watch Later (MCP)" Playlist
---------------------------------------------------- */
async function getOrCreateMCPWatchLaterPlaylist(youtube) {
  // 1️⃣ Search existing playlists
  const lists = await youtube.playlists.list({
    part: "snippet",
    mine: true,
    maxResults: 50
  });

  const found = lists.data.items?.find(
    p => p.snippet.title === "Watch Later (MCP)"
  );

  if (found) return found.id;

  // 2️⃣ Create playlist if not found
  const created = await youtube.playlists.insert({
    part: "snippet",
    requestBody: {
      snippet: {
        title: "Watch Later (MCP)",
        description: "Saved videos from MCP YouTube Agent"
      }
    }
  });

  return created.data.id;
}

/* ----------------------------------------------------
     WATCHED VIDEOS (HL)
---------------------------------------------------- */
router.get('/watched', requireAuth, async (req, res) => {
  try {
    const cacheKey = "watched-cache";
    const cached = getCache(cacheKey);
    if (cached) return res.json({ success: true, items: cached });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const result = await youtube.playlistItems.list({
      playlistId: "HL",
      part: "snippet,contentDetails",
      maxResults: 25
    });

    setCache(cacheKey, result.data.items, 30000);
    res.json({ success: true, items: result.data.items });

  } catch (err) {
    console.error("Error in /watched:", err?.response?.data || err);
    res.status(500).json({
      success: false,
      error: "Could not load watched videos",
      details: err.message
    });
  }
});

/* ----------------------------------------------------
     RECOMMENDED VIDEOS
---------------------------------------------------- */
router.get('/recommend', requireAuth, async (req, res) => {
  try {
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const result = await youtube.videos.list({
      chart: "mostPopular",
      regionCode: "IN",
      maxResults: 20,
      part: "snippet,statistics"
    });

    res.json({ success: true, items: result.data.items });

  } catch (err) {
    console.error("Error in /recommend:", err?.response?.data || err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ----------------------------------------------------
     LIKE VIDEO
---------------------------------------------------- */
router.post('/like', requireAuth, async (req, res) => {
  try {
    const { videoId } = req.body;
    if (!videoId)
      return res.status(400).json({ success: false, error: "Missing videoId" });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    await youtube.videos.rate({
      id: videoId,
      rating: "like"
    });

    return res.json({
      success: true,
      message: "❤️ Video Liked!"
    });

  } catch (err) {
    console.error("Error in /like:", err?.response?.data || err);
    res.status(500).json({
      success: false,
      error: "Failed to like video",
      details: err.message
    });
  }
});

/* ----------------------------------------------------
     FIXED: SAVE TO WATCH LATER (MCP PLAYLIST)
---------------------------------------------------- */
router.post('/watchlater', requireAuth, async (req, res) => {
  try {
    const { videoId } = req.body;
    if (!videoId)
      return res.status(400).json({ success: false, error: "Missing videoId" });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // ⭐ Get or create custom playlist
    const playlistId = await getOrCreateMCPWatchLaterPlaylist(youtube);

    // ⭐ Insert video into playlist
    const result = await youtube.playlistItems.insert({
      part: "snippet",
      requestBody: {
        snippet: {
          playlistId,
          resourceId: {
            kind: "youtube#video",
            videoId
          }
        }
      }
    });

    res.json({
      success: true,
      message: "📌 Saved to Watch Later (MCP)!",
      playlistId,
      item: result.data
    });

  } catch (err) {
    console.error("Error in /watchlater:", err?.response?.data || err);
    res.status(500).json({
      success: false,
      error: "Failed to add to Watch Later (MCP)",
      details: err.message
    });
  }
});

/* ----------------------------------------------------
     SAVE TO ANY PLAYLIST (Your existing feature)
---------------------------------------------------- */
router.post('/playlist/add', requireAuth, async (req, res) => {
  try {
    const { videoId, playlistId } = req.body;

    if (!videoId || !playlistId) {
      return res.status(400).json({
        success: false,
        error: "Missing videoId or playlistId"
      });
    }

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    const result = await youtube.playlistItems.insert({
      part: "snippet",
      requestBody: {
        snippet: {
          playlistId,
          resourceId: {
            kind: "youtube#video",
            videoId
          }
        }
      }
    });

    res.json({
      success: true,
      message: `📁 Added to Playlist (${playlistId})`,
      data: result.data
    });

  } catch (err) {
    console.error("Error in /playlist/add:", err?.response?.data || err);
    res.status(500).json({
      success: false,
      error: "Could not save to playlist",
      details: err.message
    });
  }
});

module.exports = router;
