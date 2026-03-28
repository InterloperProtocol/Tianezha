import type { PaymentAdapter, SettlementReceipt } from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

export const solanaMemoPaymentAdapter: PaymentAdapter = {
  confirm: async (receipt) => ({
    ...receipt,
    confirmedAt: receipt.confirmedAt || nowIso(),
    status: "settled",
  }),
  createSettlement: async (intent) => ({
    adapter: "solana_memo",
    amount: intent.amount,
    confirmedAt: null,
    correlationId: intent.correlationId,
    currency: intent.currency,
    id: `solana-memo:${intent.id}`,
    note: intent.memo || `Memo match required for ${intent.correlationId}.`,
    status: "pending",
    txRef: null,
  }),
  enabled: true,
  kind: "solana_memo",
  label: "Solana memo watcher",
  optional: false,
  quote: (intent) => ({
    ...intent,
    adapter: "solana_memo",
    memo: intent.memo || intent.correlationId,
    mode: "watcher",
    status: "draft",
  }),
  reconcile: async (receipt: SettlementReceipt) => ({
    ...receipt,
    confirmedAt: receipt.confirmedAt || nowIso(),
    status: receipt.status === "failed" ? "failed" : "confirmed",
  }),
  serializeReceipt: (receipt) => JSON.stringify(receipt),
};
