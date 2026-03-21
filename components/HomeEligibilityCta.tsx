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
    router.push(`/${query}#wallet-access`);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Quick start</p>
          <h2>Check a wallet in seconds</h2>
        </div>
      </div>
      <p className="panel-lead">
        Paste a Solana wallet to jump straight to the homepage access checker
        with the address already filled in.
      </p>

      <div className="route-badges">
        <StatusBadge tone="warning">Fast lookup</StatusBadge>
        <StatusBadge tone="neutral">No wallet connect required</StatusBadge>
        <StatusBadge tone="accent">Prefilled link</StatusBadge>
      </div>

      <label className="field">
        <span>Wallet address</span>
        <input
          value={wallet}
          onChange={(event) => setWallet(event.target.value)}
          placeholder="Paste a Solana wallet"
        />
      </label>
      <p className="inline-note">You can review the result and send access from the homepage section.</p>

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
