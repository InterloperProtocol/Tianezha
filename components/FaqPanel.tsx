const faqItems = [
  {
    question: "Are Agents made on Pump fun?",
    answer:
      "No. The agents are developed off-platform by third parties using tools such as Claude Code and OpenClaw. Pump.fun only exposes the tokenized-agent setting that lets supported revenue trigger buybacks and burns.",
  },
  {
    question: "How does the Agent generate revenue?",
    answer:
      "That is defined by the developer and the agent itself. Revenue can come from SaaS, product sales, trading, paid control flows, or any other supported onchain/offchain business logic.",
  },
  {
    question: "How do buybacks and burns work?",
    answer:
      "Buybacks are executed by a centralized buyback authority and instantly burned by the smart contract. To reduce frontrunning, the cadence is probabilistic per token. Only SOL and USDC revenue is eligible, and each payment carries an invoice ID the agent can verify before crediting the flow.",
  },
];

export function FaqPanel() {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Reference notes</p>
          <h2>Operator context and policy answers</h2>
        </div>
      </div>
      <p className="panel-lead">
        This side panel keeps the explanatory context close to the diagnostics
        so policy, platform boundaries, and buyback mechanics do not clutter the
        operator and public routes.
      </p>

      <div className="faq-list">
        {faqItems.map((item) => (
          <article key={item.question} className="faq-item">
            <strong>{item.question}</strong>
            <p>{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
