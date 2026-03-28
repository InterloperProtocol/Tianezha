import type { PaymentAdapter, SettlementReceipt } from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

const xmrWatcherConfigured = Boolean(process.env.TIANEZHA_XMR_WATCHER_PROVIDER_URL);

export const xmrWatcherPaymentAdapter: PaymentAdapter = {
  confirm: async (receipt) => ({
    ...receipt,
    confirmedAt: receipt.confirmedAt || nowIso(),
    status: xmrWatcherConfigured ? "settled" : "failed",
  }),
  createSettlement: async (intent) => ({
    adapter: "xmr_watcher",
    amount: intent.amount,
    confirmedAt: null,
    correlationId: intent.correlationId,
    currency: intent.currency,
    id: `xmr:${intent.id}`,
    note: xmrWatcherConfigured
      ? "XMR watcher settlement created."
      : "XMR watcher provider not configured.",
    status: xmrWatcherConfigured ? "pending" : "failed",
    txRef: null,
  }),
  enabled: xmrWatcherConfigured,
  kind: "xmr_watcher",
  label: "XMR watcher",
  optional: true,
  quote: (intent) => ({
    ...intent,
    adapter: "xmr_watcher",
    mode: "watcher",
    status: "draft",
  }),
  reconcile: async (receipt: SettlementReceipt) => ({
    ...receipt,
    confirmedAt: xmrWatcherConfigured ? nowIso() : null,
    status: xmrWatcherConfigured ? "confirmed" : "failed",
  }),
  serializeReceipt: (receipt) => JSON.stringify(receipt),
};
