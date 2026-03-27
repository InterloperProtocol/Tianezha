"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type GovernanceWorld = {
  chain: "solana" | "bnb";
  displayName: string;
  id: string;
  requiredTokenAmount: string;
  tokenAddress: string;
  verificationTarget: string;
};

type GovernanceIntent = {
  chain: "solana" | "bnb";
  choice: "support" | "oppose";
  id: string;
  requiredTokenAmount: string;
  status: "pending" | "verified";
  verificationMemo?: string | null;
  verificationTarget: string;
  verificationTransactionId?: string | null;
  verificationTokenAddress: string;
  worldId: string;
};

type OwnerChallenge = {
  chain: "solana" | "bnb";
  memo: string;
  recommendedWallet: string;
  verificationTarget: string;
  verificationTransactionHint: string;
} | null;

function getChainInstruction(
  chain: "solana" | "bnb",
  target: string,
  requiredTokenAmount: string,
) {
  if (chain === "solana") {
    return `Send ${requiredTokenAmount} $CAMIUP on Solana to ${target}, then paste the confirmed signature.`;
  }

  return `Send ${requiredTokenAmount} $CAMIUP on BNB Chain to ${target}, then paste the confirmed tx hash.`;
}

export function GenDelvePanelClient({
  intents,
  ownerChallenge,
  verificationTargets,
  worlds,
}: {
  intents: GovernanceIntent[];
  ownerChallenge: OwnerChallenge;
  verificationTargets: { bnb: string; solana: string };
  worlds: GovernanceWorld[];
}) {
  const router = useRouter();
  const [worldId, setWorldId] = useState(worlds[0]?.id || "");
  const [choice, setChoice] = useState<"support" | "oppose">("support");
  const [holderTransactionId, setHolderTransactionId] = useState("");
  const [voteTransactionId, setVoteTransactionId] = useState("");
  const [challengeTransactionId, setChallengeTransactionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function send(
    action:
      | "createVote"
      | "verifyVote"
      | "createChallenge"
      | "verifyChallenge"
      | "verifyHolder",
    extras?: Record<string, unknown>,
  ) {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/gendelve", {
        body: JSON.stringify({
          action,
          ...extras,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Unable to complete GenDelve action.");
        return;
      }

      router.refresh();
    });
  }

  const pendingIntent =
    intents.find((intent) => intent.status === "pending") || null;
  const selectedWorld = worlds.find((world) => world.id === worldId) || null;
  const pendingWorld =
    worlds.find((world) => world.id === (pendingIntent?.worldId || worldId)) || null;
  const pendingVoteTarget =
    pendingWorld?.chain === "bnb"
      ? verificationTargets.bnb
      : verificationTargets.solana;

  return (
    <div className="governance-action-stack">
      <form
        className="trade-form"
        onSubmit={(event) => {
          event.preventDefault();
          void send("createVote", { choice, worldId });
        }}
      >
        <div className="field-grid">
          <label className="field">
            <span>World</span>
            <select
              onChange={(event) => setWorldId(event.target.value)}
              value={worldId}
            >
              {worlds.map((world) => (
                <option key={world.id} value={world.id}>
                  {world.displayName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Vote</span>
            <select
              onChange={(event) =>
                setChoice(event.target.value as "support" | "oppose")
              }
              value={choice}
            >
              <option value="support">Support</option>
              <option value="oppose">Oppose</option>
            </select>
          </label>
        </div>
        <div className="trade-form-actions">
          <button
            className="button button-primary"
            disabled={isPending || !worldId}
            type="submit"
          >
            {isPending ? "Submitting..." : "Create vote intent"}
          </button>
        </div>
      </form>

      <div className="mini-list">
        <article className="mini-item-card">
          <div>
            <span>Holder tick</span>
            <strong>
              {selectedWorld
                ? `${selectedWorld.displayName} / ${selectedWorld.chain}`
                : "Select a world"}
            </strong>
          </div>
          <p className="route-summary compact">
            {selectedWorld
              ? getChainInstruction(
                  selectedWorld.chain,
                  selectedWorld.verificationTarget,
                  selectedWorld.requiredTokenAmount,
                )
              : "Select a $CAMIUP world first."}
          </p>
          {selectedWorld ? (
            <p className="route-summary compact">
              Token contract: {selectedWorld.tokenAddress || "Not configured"}.
            </p>
          ) : null}
          <label className="field">
            <span>Receipt id</span>
            <input
              onChange={(event) => setHolderTransactionId(event.target.value)}
              placeholder={
                selectedWorld?.chain === "bnb"
                  ? "Paste the confirmed BNB tx hash"
                  : "Paste the confirmed Solana signature"
              }
              value={holderTransactionId}
            />
          </label>
          <div className="trade-form-actions">
            <button
              className="button button-primary"
              disabled={isPending || !holderTransactionId.trim() || !selectedWorld}
              onClick={() =>
                void send("verifyHolder", {
                  transactionId: holderTransactionId,
                  worldId,
                })
              }
              type="button"
            >
              Verify holder tick
            </button>
          </div>
        </article>

        {pendingIntent ? (
          <article className="mini-item-card">
            <div>
              <span>Pending vote intent</span>
              <strong>
                {pendingWorld?.displayName || pendingIntent.worldId} /{" "}
                {pendingIntent.choice}
              </strong>
            </div>
            <p className="route-summary compact">
              {getChainInstruction(
                pendingIntent.chain,
                pendingVoteTarget,
                pendingIntent.requiredTokenAmount,
              )}
            </p>
            <p className="route-summary compact">
              Token contract: {pendingIntent.verificationTokenAddress}.
            </p>
            <label className="field">
              <span>Receipt id</span>
              <input
                onChange={(event) => setVoteTransactionId(event.target.value)}
                placeholder={
                  pendingIntent.chain === "solana"
                    ? "Paste the confirmed Solana signature"
                    : "Paste the confirmed BNB tx hash"
                }
                value={voteTransactionId}
              />
            </label>
            <div className="trade-form-actions">
              <button
                className="button button-secondary"
                disabled={isPending || !voteTransactionId.trim()}
                onClick={() =>
                  void send("verifyVote", {
                    intentId: pendingIntent.id,
                    transactionId: voteTransactionId,
                  })
                }
                type="button"
              >
                Verify latest vote
              </button>
            </div>
          </article>
        ) : (
          <article className="mini-item-card">
            <div>
              <span>No pending vote</span>
              <strong>Waiting for the next governance intent</strong>
            </div>
            <p className="route-summary compact">
              Create a vote intent first. GenDelve checks for a real chain receipt before it
              unlocks anything.
            </p>
          </article>
        )}

        <article className="mini-item-card">
          <div>
            <span>Owner challenge</span>
            <strong>
              {ownerChallenge
                ? `${ownerChallenge.chain} / ${ownerChallenge.recommendedWallet}`
                : "Unavailable for this profile"}
            </strong>
          </div>
          <p className="route-summary compact">
            {ownerChallenge
              ? ownerChallenge.verificationTransactionHint
              : "Owner challenges currently support Solana wallets and direct 0x EVM/BNB wallets."}
          </p>
          {ownerChallenge ? (
            <>
              <label className="field">
                <span>Challenge memo</span>
                <input readOnly value={ownerChallenge.memo} />
              </label>
              <label className="field">
                <span>Receipt id</span>
                <input
                  onChange={(event) =>
                    setChallengeTransactionId(event.target.value)
                  }
                  placeholder={
                    ownerChallenge.chain === "solana"
                      ? "Paste the confirmed Solana signature"
                      : "Paste the confirmed BNB tx hash"
                  }
                  value={challengeTransactionId}
                />
              </label>
              <div className="trade-form-actions">
                <button
                  className="button button-primary"
                  disabled={isPending || !challengeTransactionId.trim()}
                  onClick={() =>
                    void send("verifyChallenge", {
                      transactionId: challengeTransactionId,
                    })
                  }
                  type="button"
                >
                  Verify challenge
                </button>
              </div>
            </>
          ) : null}
        </article>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}
    </div>
  );
}
