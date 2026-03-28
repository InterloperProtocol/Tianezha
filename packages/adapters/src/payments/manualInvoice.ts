import type { PaymentAdapter, SettlementIntent, SettlementReceipt } from "@/packages/core/src/protocol";

function nowIso() {
  return new Date().toISOString();
}

function toReceipt(intent: SettlementIntent, status: SettlementReceipt["status"], note: string) {
  return {
    adapter: "manual_invoice",
    amount: intent.amount,
    confirmedAt: status === "confirmed" || status === "settled" ? nowIso() : null,
    correlationId: intent.correlationId,
    currency: intent.currency,
    id: `invoice:${intent.id}`,
    note,
    status,
    txRef: null,
  } satisfies SettlementReceipt;
}

export const manualInvoicePaymentAdapter: PaymentAdapter = {
  confirm: async (receipt) => ({
    ...receipt,
    confirmedAt: receipt.confirmedAt || nowIso(),
    status: "settled",
  }),
  createSettlement: async (intent) =>
    toReceipt(intent, "pending", "Manual invoice issued for settlement."),
  enabled: true,
  kind: "manual_invoice",
  label: "Manual invoice",
  optional: false,
  quote: (intent) => ({
    ...intent,
    adapter: "manual_invoice",
    invoiceId: intent.invoiceId || `invoice-${intent.correlationId}`,
    mode: "invoice",
    status: "draft",
  }),
  reconcile: async (receipt) => ({
    ...receipt,
    status: receipt.status === "settled" ? "settled" : "confirmed",
  }),
  serializeReceipt: (receipt) => JSON.stringify(receipt),
};
