"use client";

import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "goonclaw-public-chat";
const FALLBACK_LIMIT = 20;

function formatResetTime(value: string | null) {
  if (!value) {
    return "Rolling 24-hour window";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Rolling 24-hour window";
  }

  return parsed.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function PublicChatPanel({
  eyebrow = "Quick chat",
  title = "Ask the lightweight chatbot",
  description = "General chat only. This panel does not touch devices, queues, admin tools, or the private pump agent.",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
} = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingMessages, setRemainingMessages] =
    useState<number>(FALLBACK_LIMIT);
  const [resetAt, setResetAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as ChatMessage[];
      if (!Array.isArray(parsed)) {
        return;
      }

      setMessages(
        parsed.filter(
          (message) =>
            (message.role === "user" || message.role === "assistant") &&
            typeof message.content === "string",
        ),
      );
    } catch {
      // Ignore broken local state and start fresh.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
  }, [messages]);

  const helperCopy = useMemo(() => {
    if (remainingMessages <= 0) {
      return `You've hit the daily cap. Fresh messages open again around ${formatResetTime(resetAt)}.`;
    }

    return `${remainingMessages} message${remainingMessages === 1 ? "" : "s"} left in the current 24-hour window.`;
  }, [remainingMessages, resetAt]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || loading) {
      return;
    }

    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/public-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages,
        }),
      });
      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
        remainingMessages?: number;
        resetAt?: string;
      };

      if (!response.ok || !payload.reply) {
        if (typeof payload.remainingMessages === "number") {
          setRemainingMessages(payload.remainingMessages);
        }
        if (payload.resetAt) {
          setResetAt(payload.resetAt);
        }
        throw new Error(payload.error || "The chat could not answer right now.");
      }
      const reply = payload.reply;

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: reply,
        },
      ]);
      setRemainingMessages(
        typeof payload.remainingMessages === "number"
          ? payload.remainingMessages
          : remainingMessages,
      );
      setResetAt(payload.resetAt ?? null);
    } catch (sendError) {
      setMessages(nextMessages.slice(0, -1));
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The chat could not answer right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  function resetConversation() {
    setMessages([]);
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  return (
    <section className="panel chat-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <div className="source-pill">
          <span className="status-dot" />
          Vertex AI Gemini
        </div>
      </div>

      <p className="hero-summary compact">{description}</p>

      <div className="route-badges">
        <StatusBadge tone="accent">Vertex AI Gemini</StatusBadge>
        <StatusBadge tone="accent">20 messages / 24h</StatusBadge>
        <StatusBadge tone="neutral">No admin access</StatusBadge>
        <StatusBadge tone="success">General-purpose only</StatusBadge>
      </div>

      <div className="chat-meta">
        <span>{helperCopy}</span>
        <button
          className="button button-ghost small"
          onClick={resetConversation}
          type="button"
        >
          Clear chat
        </button>
      </div>

      <div className="chat-log">
        {messages.length ? (
          messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              className={
                message.role === "assistant"
                  ? "chat-bubble assistant"
                  : "chat-bubble user"
              }
            >
              <span>{message.role === "assistant" ? "Chatbot" : "You"}</span>
              <p>{message.content}</p>
            </article>
          ))
        ) : (
          <div className="embed-placeholder compact">
            <strong>Start with anything simple.</strong>
            <p>Try ideas, explainers, copy help, or quick research questions.</p>
          </div>
        )}

        {loading ? (
          <article className="chat-bubble assistant">
            <span>Chatbot</span>
            <p>Thinking through a reply.</p>
          </article>
        ) : null}
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="chat-composer">
        <label className="field">
          <span>Message</span>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Ask a general question"
            rows={4}
          />
        </label>
        <div className="button-row">
          <button
            className="button button-primary"
            disabled={loading || !input.trim() || remainingMessages <= 0}
            onClick={() => void sendMessage()}
            type="button"
          >
            {loading ? "Sending..." : "Send message"}
          </button>
        </div>
      </div>
    </section>
  );
}
