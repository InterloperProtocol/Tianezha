"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { StatusBadge } from "@/components/ui/StatusBadge";

export function HomeEligibilityCta() {
  const router = useRouter();
  const [wallet, setWallet] = useState("");

  function openEligibility() {
    const query = wallet.trim()
      ? `?wallet=${encodeURIComponent(wallet.trim())}`
      : "";
    router.push(`/eligibility${query}`);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Manual claim lane</p>
          <h2>Start with wallet verification</h2>
        </div>
      </div>
      <p className="panel-lead">
        Paste a Solana wallet to jump directly into the focused eligibility
        flow. The next screen keeps validation, result state, and the manual
        receive action in one place.
      </p>

      <div className="route-badges">
        <StatusBadge tone="warning">Manual review</StatusBadge>
        <StatusBadge tone="neutral">No wallet connect required</StatusBadge>
        <StatusBadge tone="accent">Prefilled deep link</StatusBadge>
      </div>

      <label className="field">
        <span>Wallet address</span>
        <input
          value={wallet}
          onChange={(event) => setWallet(event.target.value)}
          placeholder="Paste a Solana wallet"
        />
      </label>
      <p className="inline-note">Paste once. Review on the dedicated eligibility surface.</p>

      <div className="button-row">
        <button
          className="button button-primary"
          disabled={!wallet.trim()}
          onClick={openEligibility}
        >
          Check eligibility
        </button>
      </div>
    </section>
  );
}
