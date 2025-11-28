const BACKEND_URL = "http://localhost:3001";

// Send chat request to backend
async function sendMessage() {
  const input = document.getElementById("userInput").value;
  if (!input.trim()) return;

  const replyBox = document.getElementById("replyBox");
  replyBox.classList.remove("hidden");
  replyBox.innerHTML = `
    <div class="bg-gray-100 p-3 rounded-lg text-gray-700">
      ⏳ Thinking...
    </div>
  `;

  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: input })
  });

  const data = await res.json();

  replyBox.innerHTML = `
    <div class="bg-blue-50 p-4 rounded-lg border border-blue-300 shadow">
      ${data.reply?.replace(/\n/g, "<br>") || "No response"}
    </div>
  `;

  renderVideos(data.videos || []);
}

// Render video cards
function renderVideos(videos) {
  const container = document.getElementById("videosContainer");
  container.innerHTML = "";

  if (!videos.length) {
    container.innerHTML = `<p class="text-gray-500">No videos found.</p>`;
    return;
  }

  videos.forEach((v) => {
    const card = document.createElement("div");
    card.className = "card bg-white rounded-lg shadow overflow-hidden";

    card.innerHTML = `
      <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank">
        <img src="${v.thumbnail}" class="w-full h-40 object-cover hover:opacity-90 transition" />
      </a>

      <div class="p-4">
        <h3 class="font-bold text-lg">${v.title}</h3>
        <p class="text-sm text-gray-600">${v.channel}</p>
        <p class="text-xs text-gray-500 mt-1 line-clamp-2">${v.description}</p>

        <div class="flex gap-2 mt-3">
          <button onclick="likeVideo('${v.id}')"
            class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">
            ❤️ Like
          </button>

          <button onclick="saveLater('${v.id}')"
            class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
            📌 Save
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(card);
  });
}

// Like video
async function likeVideo(videoId) {
  const res = await fetch(`${BACKEND_URL}/api/youtube/like`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId })
  });

  const data = await res.json();
  alert(data.message || "❤️ Video liked!");
}

// Save video to Watch Later
async function saveLater(videoId) {
  const res = await fetch(`${BACKEND_URL}/api/youtube/watchlater`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId })
  });

  const data = await res.json();
  alert(data.message || "📌 Added to Watch Later!");
}
