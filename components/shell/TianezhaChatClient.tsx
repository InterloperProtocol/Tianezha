"use client";

import { useState, useTransition } from "react";

type Message = {
  content: string;
  role: "assistant" | "user";
};

type TianezhaChatClientProps = {
  initialMessage: string;
};

export function TianezhaChatClient({ initialMessage }: TianezhaChatClientProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      content: initialMessage,
      role: "assistant",
    },
  ]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextMessage = value.trim();
    if (!nextMessage) {
      return;
    }

    setError(null);
    setMessages((current) => [...current, { content: nextMessage, role: "user" }]);
    setValue("");

    startTransition(async () => {
      const response = await fetch("/api/tianezha/chat", {
        body: JSON.stringify({ message: nextMessage }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string; reply?: string };
      if (!response.ok || !payload.reply) {
        setError(payload.error || "Unable to answer right now.");
        return;
      }

      setMessages((current) => [...current, { content: payload.reply!, role: "assistant" }]);
    });
  }

  return (
    <section className="panel chat-shell-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Tianezha chat</p>
          <h2>Ask the shell what the simulation sees</h2>
        </div>
      </div>
      <div className="chat-shell-feed">
        {messages.map((message, index) => (
          <article
            key={`${message.role}-${index}`}
            className={message.role === "assistant" ? "chat-bubble assistant" : "chat-bubble user"}
          >
            <span>{message.role}</span>
            <p>{message.content}</p>
          </article>
        ))}
      </div>
      <form className="chat-shell-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Message</span>
          <textarea
            onChange={(event) => setValue(event.target.value)}
            placeholder="What is live right now?"
            value={value}
          />
        </label>
        <div className="chat-shell-actions">
          <button className="button button-primary" disabled={isPending} type="submit">
            {isPending ? "Thinking..." : "Send"}
          </button>
          {error ? <p className="error-banner">{error}</p> : null}
        </div>
      </form>
    </section>
  );
}
