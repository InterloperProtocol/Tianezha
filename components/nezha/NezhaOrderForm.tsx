"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function NezhaOrderForm({ marketId }: { marketId: string }) {
  const router = useRouter();
  const [side, setSide] = useState<"long" | "short">("long");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [quantity, setQuantity] = useState("10");
  const [leverage, setLeverage] = useState("2");
  const [limitPrice, setLimitPrice] = useState("");
  const [reduceOnly, setReduceOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/nezha", {
        body: JSON.stringify({
          leverage: Number(leverage),
          limitPrice: orderType === "limit" ? Number(limitPrice) : null,
          marketId,
          orderType,
          quantity: Number(quantity),
          reduceOnly,
          side,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Unable to place Nezha order.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <form className="trade-form" onSubmit={handleSubmit}>
      <div className="field-grid">
        <label className="field">
          <span>Side</span>
          <select onChange={(event) => setSide(event.target.value as "long" | "short")} value={side}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        <label className="field">
          <span>Type</span>
          <select onChange={(event) => setOrderType(event.target.value as "market" | "limit")} value={orderType}>
            <option value="market">Market</option>
            <option value="limit">Limit</option>
          </select>
        </label>
        <label className="field">
          <span>Quantity</span>
          <input min="0.0001" onChange={(event) => setQuantity(event.target.value)} step="0.0001" type="number" value={quantity} />
        </label>
        <label className="field">
          <span>Leverage</span>
          <input max="5" min="1" onChange={(event) => setLeverage(event.target.value)} type="number" value={leverage} />
        </label>
      </div>
      {orderType === "limit" ? (
        <label className="field">
          <span>Limit price</span>
          <input onChange={(event) => setLimitPrice(event.target.value)} step="0.0001" type="number" value={limitPrice} />
        </label>
      ) : null}
      <label className="field checkbox-field">
        <span>Reduce only</span>
        <input checked={reduceOnly} onChange={(event) => setReduceOnly(event.target.checked)} type="checkbox" />
      </label>
      <div className="trade-form-actions">
        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? "Placing..." : "Place Nezha order"}
        </button>
        {error ? <p className="error-banner">{error}</p> : null}
      </div>
    </form>
  );
}
