import type { PaymentAdapter, SettlementReceipt } from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

const btcWatcherConfigured = Boolean(process.env.TIANEZHA_BTC_WATCHER_PROVIDER_URL);

export const btcWatcherPaymentAdapter: PaymentAdapter = {
  confirm: async (receipt) => ({
    ...receipt,
    confirmedAt: receipt.confirmedAt || nowIso(),
    status: btcWatcherConfigured ? "settled" : "failed",
  }),
  createSettlement: async (intent) => ({
    adapter: "btc_watcher",
    amount: intent.amount,
    confirmedAt: null,
    correlationId: intent.correlationId,
    currency: intent.currency,
    id: `btc:${intent.id}`,
    note: btcWatcherConfigured
      ? "BTC watcher settlement created."
      : "BTC watcher provider not configured.",
    status: btcWatcherConfigured ? "pending" : "failed",
    txRef: null,
  }),
  enabled: btcWatcherConfigured,
  kind: "btc_watcher",
  label: "BTC watcher",
  optional: true,
  quote: (intent) => ({
    ...intent,
    adapter: "btc_watcher",
    mode: "watcher",
    status: "draft",
  }),
  reconcile: async (receipt: SettlementReceipt) => ({
    ...receipt,
    confirmedAt: btcWatcherConfigured ? nowIso() : null,
    status: btcWatcherConfigured ? "confirmed" : "failed",
  }),
  serializeReceipt: (receipt) => JSON.stringify(receipt),
};
