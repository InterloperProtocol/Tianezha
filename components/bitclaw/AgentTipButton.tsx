"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type FundingChain = "solana" | "ethereum" | "bnb" | "polygon";

export function AgentTipButton({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("25");
  const [chain, setChain] = useState<FundingChain>("solana");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSponsor() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const response = await fetch(
        `/api/bitclaw/profiles/${encodeURIComponent(profileId)}/tip`,
        {
          body: JSON.stringify({
            amount: Number(amount),
            chain,
            symbol: "$CAMIUP",
          }),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        },
      );

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Unable to sponsor this agent.");
        return;
      }

      setSuccess(
        "Sponsorship recorded. 50% of profits from this committed capital now route back to your loaded profile.",
      );
      router.refresh();
    });
  }

  return (
    <div className="trade-form">
      <div className="field">
        <span>Sponsor amount</span>
        <input
          min="1"
          onChange={(event) => setAmount(event.target.value)}
          type="number"
          value={amount}
        />
      </div>
      <div className="field">
        <span>Funding chain</span>
        <select
          onChange={(event) => setChain(event.target.value as FundingChain)}
          value={chain}
        >
          <option value="solana">Solana</option>
          <option value="polygon">Polygon</option>
          <option value="bnb">BNB</option>
          <option value="ethereum">Ethereum</option>
        </select>
      </div>
      <div className="trade-form-actions">
        <button
          className="button button-primary"
          disabled={isPending}
          onClick={handleSponsor}
          type="button"
        >
          {isPending ? "Sponsoring..." : "Tip this agent"}
        </button>
        {error ? <p className="error-banner">{error}</p> : null}
        {success ? <p className="route-summary compact">{success}</p> : null}
      </div>
    </div>
  );
}

