import type { PaymentAdapter, SettlementReceipt } from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

const conwayConfigured = Boolean(process.env.CONWAY_API_KEY);

export const conwayPaymentAdapter: PaymentAdapter = {
  confirm: async (receipt) => ({
    ...receipt,
    confirmedAt: receipt.confirmedAt || nowIso(),
    status: conwayConfigured ? "settled" : "failed",
  }),
  createSettlement: async (intent) => ({
    adapter: "conway",
    amount: intent.amount,
    confirmedAt: null,
    correlationId: intent.correlationId,
    currency: intent.currency,
    id: `conway:${intent.id}`,
    note: conwayConfigured
      ? "Conway settlement intent opened as an optional adapter."
      : "Conway is optional and not configured.",
    status: conwayConfigured ? "pending" : "failed",
    txRef: null,
  }),
  enabled: conwayConfigured,
  kind: "conway",
  label: "Conway",
  optional: true,
  quote: (intent) => ({
    ...intent,
    adapter: "conway",
    mode: "watcher",
    status: "draft",
  }),
  reconcile: async (receipt: SettlementReceipt) => ({
    ...receipt,
    confirmedAt: conwayConfigured ? nowIso() : null,
    status: conwayConfigured ? "confirmed" : "failed",
  }),
  serializeReceipt: (receipt) => JSON.stringify(receipt),
};
