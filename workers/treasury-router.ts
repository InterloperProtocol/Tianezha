import {
  CONSTITUTION,
  allocateTradingProfitAboveReserve,
  assertConstitutionInvariant,
  lamportsToJson,
  routeBillboardRevenue as constitutionRouteBillboardRevenue,
  routeCreatorFees as constitutionRouteCreatorFees,
} from "@/lib/constitution";
import type {
  ConstitutionConfig,
  Lamports,
  ReadonlyDeep,
} from "@/lib/types/constitution";
import { createChildBrainProposal } from "@/workers/child-brain-gateway";
import { assertParentBrainExecutionAuthority } from "@/workers/security-guards";

type RoutingPlanKind =
  | "creator_fees"
  | "billboard_revenue"
  | "trading_profit_above_reserve";

type RoutingPlanEnvelope<TPlan> = {
  readonly auditEventType:
    | "CREATOR_FEES_ROUTED"
    | "BILLBOARD_REVENUE_ROUTED"
    | "TRADING_PROFIT_ALLOCATED";
  readonly plan: TPlan;
};

export function planCreatorFeeRouting(args: {
  totalCreatorFeesLamports: Lamports;
  actingBrainId?: string;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = args.cfg ?? CONSTITUTION;
  assertConstitutionInvariant(cfg);
  assertParentBrainExecutionAuthority({
    actingBrainId:
      args.actingBrainId ?? cfg.parentChildPolicy.sovereignParentBrainId,
    cfg,
  });

  return {
    auditEventType: "CREATOR_FEES_ROUTED" as const,
    plan: constitutionRouteCreatorFees(args.totalCreatorFeesLamports, cfg),
  };
}

export function planBillboardRevenueRouting(args: {
  totalBillboardRevenueLamports?: Lamports;
  actingBrainId?: string;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = args.cfg ?? CONSTITUTION;
  assertConstitutionInvariant(cfg);
  assertParentBrainExecutionAuthority({
    actingBrainId:
      args.actingBrainId ?? cfg.parentChildPolicy.sovereignParentBrainId,
    cfg,
  });

  return {
    auditEventType: "BILLBOARD_REVENUE_ROUTED" as const,
    plan: constitutionRouteBillboardRevenue(
      args.totalBillboardRevenueLamports ??
        cfg.treasuryPolicy.billboard.priceLamports,
      cfg,
    ),
  };
}

export function planTradingProfitAllocation(args: {
  realizedProfitLamports: Lamports;
  currentTreasuryLamports: Lamports;
  governanceMode?: "liquidity" | "buybackBurn";
  actingBrainId?: string;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  const cfg = args.cfg ?? CONSTITUTION;
  assertConstitutionInvariant(cfg);
  assertParentBrainExecutionAuthority({
    actingBrainId:
      args.actingBrainId ?? cfg.parentChildPolicy.sovereignParentBrainId,
    cfg,
  });

  return {
    auditEventType: "TRADING_PROFIT_ALLOCATED" as const,
    plan: allocateTradingProfitAboveReserve({
      realizedProfitLamports: args.realizedProfitLamports,
      currentTreasuryLamports: args.currentTreasuryLamports,
      governanceMode: args.governanceMode,
      cfg,
    }),
  };
}

export function planChildBrainTradeRequest(args: {
  brainId: string;
  rationale: string;
  requestedLamports?: Lamports;
  metadata?: Readonly<Record<string, unknown>>;
}) {
  return createChildBrainProposal({
    brainId: args.brainId,
    action: "request_trade",
    rationale: args.rationale,
    requestedLamports: args.requestedLamports,
    metadata: args.metadata,
  });
}

export function routeCreatorFeesPlan(args: {
  totalCreatorFeesLamports: Lamports;
  actingBrainId?: string;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  return planCreatorFeeRouting(args);
}

export function routeBillboardRevenuePlan(args: {
  totalBillboardRevenueLamports?: Lamports;
  actingBrainId?: string;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  return planBillboardRevenueRouting(args);
}

export function routeTradingProfitAboveReserve(args: {
  realizedProfitLamports: Lamports;
  currentTreasuryLamports: Lamports;
  governanceMode?: "liquidity" | "buybackBurn";
  actingBrainId?: string;
  cfg?: ReadonlyDeep<ConstitutionConfig>;
}) {
  return planTradingProfitAllocation(args);
}

export const routeCreatorFeesForParent = routeCreatorFeesPlan;
export const routeBillboardRevenueForParent = routeBillboardRevenuePlan;

export function validateRoutingPlan<TPlan>(
  envelope: RoutingPlanEnvelope<TPlan>,
): RoutingPlanEnvelope<TPlan> {
  if (!envelope.plan) {
    throw new Error("Routing plan envelope must include a plan.");
  }

  return envelope;
}

export function formatRoutingPlanForAudit(args: {
  kind: RoutingPlanKind;
  envelope: RoutingPlanEnvelope<
    | ReturnType<typeof constitutionRouteCreatorFees>
    | ReturnType<typeof constitutionRouteBillboardRevenue>
    | ReturnType<typeof allocateTradingProfitAboveReserve>
  >;
}) {
  const plan = args.envelope.plan;

  if (args.kind === "creator_fees") {
    const creatorPlan = plan as ReturnType<typeof constitutionRouteCreatorFees>;
    return {
      type: "ROUTING_PLAN_CREATED" as const,
      metadata: {
        kind: args.kind,
        totalCreatorFeesLamports: lamportsToJson(creatorPlan.totalCreatorFeesLamports),
        toAgentLamports: lamportsToJson(creatorPlan.toAgentLamports),
        buybackBurnLamports: lamportsToJson(creatorPlan.buybackBurnLamports),
        tradingWalletLamports: lamportsToJson(creatorPlan.tradingWalletLamports),
        remainderNonAgentLamports: lamportsToJson(
          creatorPlan.remainderNonAgentLamports,
        ),
      },
    };
  }

  if (args.kind === "billboard_revenue") {
    const billboardPlan =
      plan as ReturnType<typeof constitutionRouteBillboardRevenue>;
    return {
      type: "ROUTING_PLAN_CREATED" as const,
      metadata: {
        kind: args.kind,
        totalBillboardRevenueLamports: lamportsToJson(
          billboardPlan.totalBillboardRevenueLamports,
        ),
        buybackBurnLamports: lamportsToJson(billboardPlan.buybackBurnLamports),
        tradingWalletLamports: lamportsToJson(billboardPlan.tradingWalletLamports),
      },
    };
  }

  const profitPlan = plan as ReturnType<typeof allocateTradingProfitAboveReserve>;
  return {
    type: "ROUTING_PLAN_CREATED" as const,
    metadata: {
      kind: args.kind,
      realizedProfitLamports: lamportsToJson(profitPlan.realizedProfitLamports),
      distributableLamports: lamportsToJson(profitPlan.distributableLamports),
      governanceBranchLamports: lamportsToJson(profitPlan.governanceBranchLamports),
      founderLamports: lamportsToJson(profitPlan.founderLamports),
      retainedLamports: lamportsToJson(profitPlan.retainedLamports),
      governanceMode: profitPlan.governanceMode,
    },
  };
}

export const routeCreatorFees = routeCreatorFeesPlan;
export const routeBillboardRevenue = routeBillboardRevenuePlan;
