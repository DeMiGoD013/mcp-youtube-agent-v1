const axios = require('axios');

const BASE_URL = 'https://www.googleapis.com/youtube/v3';

function ensureApiKey() {
  if (!process.env.YT_API_KEY) {
    throw new Error('YT_API_KEY is not set in environment variables');
  }
}

/**
 * Search YouTube videos by query.
 * Returns an array of simplified video objects.
 */
async function searchVideos(query, maxResults = 5) {
  ensureApiKey();

  const response = await axios.get(`${BASE_URL}/search`, {
    params: {
      key: process.env.YT_API_KEY,
      q: query,
      part: 'snippet',
      maxResults,
      type: 'video'
    }
  });

  const items = response.data.items || [];

  return items.map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail:
      (item.snippet.thumbnails &&
        (item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.medium?.url ||
          item.snippet.thumbnails.default?.url)) ||
      null,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt
  }));
}

module.exports = {
  searchVideos
};
