import React, { useState } from 'react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

function App() {
  const [messages, setMessages] = useState([
    {
      from: 'agent',
      text: 'Hi! I am your YouTube MCP agent. Ask me for video recommendations or learning paths on any topic.'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const newMessages = [
      ...messages,
      { from: 'user', text: trimmed }
    ];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: trimmed })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Server error');
      }

      const data = await response.json();

      const agentMsg = {
        from: 'agent',
        text: data.reply,
        videos: data.videos || []
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          from: 'agent',
          text: `Oops, something went wrong: ${err.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>MCP YouTube Agent</h1>
        <p>Ask for YouTube video recommendations powered by MCP tools.</p>
      </header>

      <main className="chat-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <MessageBubble key={index} message={msg} />
          ))}
        </div>

        <div className="input-bar">
          <textarea
            rows={2}
            placeholder="Ask: 'Recommend a learning path for Kubernetes'..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button onClick={handleSend} disabled={loading}>
            {loading ? 'Thinking...' : 'Send'}
          </button>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.from === 'user';

  return (
    <div className={`message-row ${isUser ? 'user' : 'agent'}`}>
      <div className="message-bubble">
        <div className="message-from">
          {isUser ? 'You' : 'Agent'}
        </div>
        <div className="message-text">
          {message.text}
        </div>

        {message.videos && message.videos.length > 0 && (
          <VideoList videos={message.videos} />
        )}
      </div>
    </div>
  );
}

function VideoList({ videos }) {

  // OPEN YOUTUBE VIDEO
  const handleOpen = (videoId) => {
    window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
  };

  // FULL BACKEND WATCH LATER FEATURE
  const handleWatchLater = async (videoId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/youtube/watchlater`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId })
      });

      const data = await response.json();
      if (data.success) {
        alert("📌 Added to Watch Later!");
      } else {
        alert("Failed: " + data.error);
      }

    } catch (err) {
      console.error("Watch later error:", err);
      alert("Could not add to Watch Later");
    }
  };

  // LIKE → redirect to YouTube to like manually or via backend if enabled
  const handleLike = async (videoId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/youtube/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId })
      });

      const data = await response.json();

      if (data.success) {
        alert("❤️ Video Liked!");
      } else {
        alert("Failed: " + data.error);
      }

    } catch (err) {
      console.error("Like error:", err);
      alert("Could not like video");
    }
  };

  return (
    <div className="video-list">
      <h4>Recommended Videos</h4>

      <div className="video-grid">
        {videos.map((video) => (
          <div className="video-card" key={video.videoId}>

            {/* Thumbnail - Clickable */}
            <a
              href={`https://www.youtube.com/watch?v=${video.videoId}`}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={video.thumbnail}
                alt={video.title}
                className="thumbnail"
              />
            </a>

            {/* Buttons Below Thumbnail */}
            <div className="video-buttons">

              <button
                className="like-btn"
                onClick={() => handleLike(video.videoId)}
              >
                ❤️ Like
              </button>

              <button
                className="watchlater-btn"
                onClick={() => handleWatchLater(video.videoId)}
              >
                📌 Watch Later
              </button>

            </div>

            <div className="video-info">
              <a
                href={`https://www.youtube.com/watch?v=${video.videoId}`}
                target="_blank"
                rel="noreferrer"
                className="video-title"
              >
                {video.title}
              </a>

              <div className="video-channel">{video.channelTitle}</div>

              <div className="video-date">
                {new Date(video.publishedAt).toLocaleDateString()}
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
