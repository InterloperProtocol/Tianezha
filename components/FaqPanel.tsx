import Link from "next/link";

const faqItems = [
  {
    question: "What does HeartBeat show?",
    answer:
      "HeartBeat is the public legibility layer for Tianshi: live runtime health, reserve posture, recent updates, and the serious operating surface behind the network.",
  },
  {
    question: "Can I control anything from here?",
    answer:
      "No. This page is read-only. It exists so the runtime can earn trust in public without exposing private controls.",
  },
  {
    question: "Is the network intentionally moderated?",
    answer:
      "Yes. There is already an admin moderation layer behind the scenes to reduce spam and misuse and keep the public surfaces readable.",
  },
];

export function FaqPanel() {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">FAQ</p>
          <h2>Quick answers</h2>
        </div>
      </div>
      <p className="panel-lead">Simple answers for this page.</p>

      <div className="faq-list">
        {faqItems.map((item) => (
          <article key={item.question} className="faq-item">
            <strong>{item.question}</strong>
            <p>{item.answer}</p>
          </article>
        ))}
      </div>

      <div className="home-inline-actions">
        <Link className="button button-ghost small" href="/docs/support/tianezha-faq">
          Read the full FAQ
        </Link>
      </div>
    </section>
  );
}
