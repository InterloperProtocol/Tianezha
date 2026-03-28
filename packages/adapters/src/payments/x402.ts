import { getDexterX402Status } from "@/lib/server/dexter-x402";
import type { PaymentAdapter, SettlementIntent, SettlementReceipt } from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

function toReceipt(
  intent: SettlementIntent,
  status: SettlementReceipt["status"],
  note: string,
): SettlementReceipt {
  return {
    adapter: "x402",
    amount: intent.amount,
    confirmedAt: status === "confirmed" || status === "settled" ? nowIso() : null,
    correlationId: intent.correlationId,
    currency: intent.currency,
    id: `x402:${intent.id}`,
    note,
    status,
    txRef: null,
  };
}

export const x402PaymentAdapter: PaymentAdapter = {
  confirm: async (receipt) => ({
    ...receipt,
    confirmedAt: receipt.confirmedAt || nowIso(),
    status: "settled",
  }),
  createSettlement: async (intent) =>
    toReceipt(
      intent,
      getDexterX402Status().installed ? "pending" : "failed",
      getDexterX402Status().installed
        ? "x402 settlement intent opened."
        : "x402 package is not installed.",
    ),
  enabled: getDexterX402Status().installed,
  kind: "x402",
  label: "x402",
  optional: true,
  quote: (intent) => ({
    ...intent,
    adapter: "x402",
    mode: "x402",
    status: "draft",
  }),
  reconcile: async (receipt) => ({
    ...receipt,
    confirmedAt: receipt.confirmedAt || nowIso(),
    status: receipt.status === "failed" ? "failed" : "confirmed",
  }),
  serializeReceipt: (receipt) => JSON.stringify(receipt),
};
