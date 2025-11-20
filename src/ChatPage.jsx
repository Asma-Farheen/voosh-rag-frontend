// frontend/src/ChatPage.jsx
// frontend/src/ChatPage.jsx
import { useEffect, useState, useRef } from "react";
import "./ChatPage.scss";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

export default function ChatPage() {
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);

  // Create / load session (6-digit numeric) + fetch history
  useEffect(() => {
    let stored = localStorage.getItem("sessionId");
    if (!stored) {
      stored = Math.floor(100000 + Math.random() * 900000).toString();
      localStorage.setItem("sessionId", stored);
    }
    setSessionId(stored);
    fetchHistory(stored);
  }, []);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function fetchHistory(id) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/session/${id}/history`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.history || []);
    } catch (err) {
      console.error("Failed to fetch history", err);
    }
  }

  // Send message + typing effect for bot
  async function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    setError("");
    setLoading(true);

    // Store current messages in case we need to restore
    const previousMessages = messages;

    // Add user message to UI instantly
    const userMsg = { role: "user", content: input };
    const optimistic = [...messages, userMsg];
    setMessages(optimistic);

    try {
      const res = await fetch(`${BACKEND_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, userMessage: input }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Chat error:", res.status, text);

        // Roll back optimistic UI
        setMessages(previousMessages);

        if (res.status === 503) {
          setError(
            "Gemini API is overloaded. Please try again in a few seconds."
          );
        } else {
          setError("Something went wrong. Please try again.");
        }

        setLoading(false);
        return;
      }

      // ---- PROCESS RESPONSE ----
      const data = await res.json();
      const fullHistory = data.history || optimistic;

      // Extract the last bot message
      const lastBot = fullHistory[fullHistory.length - 1];

      if (!lastBot || lastBot.role !== "assistant") {
        setMessages(fullHistory);
        setLoading(false);
        return;
      }

      const fullText = lastBot.content;

      // Start typing animation
      const typedBot = { role: "assistant", content: "" };
      setMessages([...optimistic, typedBot]);

      let index = 0;

      function typeNextChar() {
        if (index < fullText.length) {
          typedBot.content += fullText[index];
          index++;

          // Update messages state with current typing progress
          setMessages([...optimistic, { ...typedBot }]);

          setTimeout(typeNextChar, 5); // speed: smaller = faster typing
        } else {
          // Done typing → final message
          setMessages(fullHistory);
        }
      }

      typeNextChar();

      setInput("");
    } catch (err) {
      console.error(err);
      setMessages(previousMessages);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Reset session: clear old session + create new sessionId
  async function handleResetSession() {
    try {
      // 1) Tell backend to clear old session
      if (sessionId) {
        await fetch(`${BACKEND_URL}/api/session/${sessionId}/clear`, {
          method: "POST",
        });
      }
    } catch (err) {
      console.error("Failed to clear previous session", err);
    }

    // 2) Create a brand new 6-digit session ID
    const newId = Math.floor(100000 + Math.random() * 900000).toString();

    // 3) Save it in localStorage and state
    localStorage.setItem("sessionId", newId);
    setSessionId(newId);

    // 4) Clear UI state
    setMessages([]);
    setError("");
  }

  return (
    <div className="app-root">
      <div className="chat-shell">
        {/* HEADER (fixed area) */}
        <header className="chat-header">
          <div className="chat-header-text">
            <h1 className="chat-title">Voosh News Chatbot</h1>
            <p className="chat-subtitle">
              Ask anything about the ingested news articles.
            </p>
            <div className="chat-session-id">
              Session ID: <span>{sessionId}</span>
            </div>
          </div>
          <button className="reset-button" onClick={handleResetSession}>
            Reset session
          </button>
        </header>

        {/* CHAT AREA (only this scrolls) */}
        <main className="chat-main">
          {messages.length === 0 && !loading && (
            <div className="chat-empty-state">
              Try asking{" "}
              <span className="chat-empty-highlight">
                "Give me a summary of recent news"
              </span>
              .
            </div>
          )}

          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={idx}
                className={`message-row ${
                  isUser ? "message-row--user" : "message-row--bot"
                }`}
              >
                <div
                  className={`message-bubble ${
                    isUser ? "message-bubble--user" : "message-bubble--bot"
                  }`}
                >
                  <div className="message-label">
                    {isUser ? "You" : "Bot"}
                  </div>
                  <div className="message-content">{msg.content}</div>
                </div>
              </div>
            );
          })}

          {loading && <div className="chat-loading">Bot is thinking…</div>}

          <div ref={messagesEndRef} />
        </main>

        {/* ERROR */}
        {error && <div className="chat-error">{error}</div>}

        {/* INPUT BAR (fixed area) */}
        <form className="chat-input-bar" onSubmit={handleSend}>
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question about the news..."
          />
          <button
            type="submit"
            className="send-button"
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
