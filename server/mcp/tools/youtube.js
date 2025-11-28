const axios = require("axios");
require("dotenv").config();

async function youtubeSearch({ query, maxResults = 6 }) {
  const url = "https://www.googleapis.com/youtube/v3/search";

  const response = await axios.get(url, {
    params: {
      key: process.env.YT_API_KEY,
      q: query,
      type: "video",
      part: "snippet",
      maxResults,
    },
  });

  return response.data.items.map((item) => ({
    id: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnail: item.snippet.thumbnails.medium.url,
    channel: item.snippet.channelTitle
  }));
}

module.exports = { youtubeSearch };
