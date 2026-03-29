import { NextResponse } from "next/server";

import {
  CONSTITUTION,
  PUBLIC_BRAIN_STATE,
  PUBLIC_CONSTITUTION_STATE,
  PUBLIC_ECONOMIC_STATE,
  getTreasuryPosture,
  solToLamports,
} from "@/lib/constitution";
import { getAutonomousStatusWithLiveReserve } from "@/lib/server/autonomous-agent";
import type { AutonomousToolingStatus } from "@/lib/types";

function sanitizePublicTooling(tooling?: Partial<AutonomousToolingStatus>) {
  const availableActions = (tooling?.availableActions ?? []).filter(
    (action) =>
      !action.startsWith("dexter.") &&
      !action.startsWith("godmode.") &&
      !action.startsWith("agfund.") &&
      !action.startsWith("fourmeme.") &&
      !action.startsWith("polymarket."),
  );
  const blockedActionNames = (tooling?.blockedActionNames ?? []).filter(
    (action) =>
      !action.startsWith("dexter.") &&
      !action.startsWith("godmode.") &&
      !action.startsWith("agfund.") &&
      !action.startsWith("fourmeme.") &&
      !action.startsWith("polymarket."),
  );
  const vendoredSkillNames = (tooling?.vendoredSkillNames ?? []).filter(
    (name) =>
      name !== "dexter-agent" &&
      name !== "godmode-agent" &&
      name !== "polymarket-agent",
  );
  const skillHub =
    tooling?.skillHub ?? {
      available: false,
      entryCount: 0,
      name: "Tianshi Skill Hub",
      optionalAdapterCount: 0,
      optionalAdapterNames: [],
      outOfScopeCount: 0,
      outOfScopeNames: [],
      referenceCount: 0,
      referenceNames: [],
      summary:
        "Canonical repo registry for vendorable adapters, optional sidecars, and reference-only research material.",
      vendorableAdapterCount: 0,
      vendorableAdapterNames: [],
      version: null,
    };

  return {
    agfundActionNames: [],
    agfundApiReady: false,
    agfundEnabled: tooling?.agfundEnabled ?? false,
    agfundMarketplaceUrl: tooling?.agfundMarketplaceUrl ?? null,
    agentWalletAddress: tooling?.agentWalletAddress ?? null,
    availableActions,
    blockedActionNames,
    codexSkillNames: tooling?.codexSkillNames ?? [],
    configuredMcpServerNames: tooling?.configuredMcpServerNames ?? [],
    bnbChainMcpConfigured: tooling?.bnbChainMcpConfigured ?? false,
    conwayApiKeyConfigured: tooling?.conwayApiKeyConfigured ?? false,
    conwayCodexMcpConfigured: tooling?.conwayCodexMcpConfigured ?? false,
    context7McpConfigured: tooling?.context7McpConfigured ?? false,
    excelMcpConfigured: tooling?.excelMcpConfigured ?? false,
    gmgnConfigured: tooling?.gmgnConfigured ?? false,
    gmgnActionNames: tooling?.gmgnActionNames ?? [],
    gmgnApiHost: tooling?.gmgnApiHost ?? null,
    gmgnCriticalAuthReady: tooling?.gmgnCriticalAuthReady ?? false,
    gmgnQueryChains: tooling?.gmgnQueryChains ?? [],
    gmgnSigningReady: tooling?.gmgnSigningReady ?? false,
    gmgnStandardAuthReady: tooling?.gmgnStandardAuthReady ?? false,
    gmgnToolFamilies: tooling?.gmgnToolFamilies ?? [],
    gmgnTradingWallet: tooling?.gmgnTradingWallet ?? null,
    hyperliquidActionNames: tooling?.hyperliquidActionNames ?? [],
    hyperliquidApiUrl: tooling?.hyperliquidApiUrl ?? null,
    hyperliquidApiWallet: tooling?.hyperliquidApiWallet ?? null,
    hyperliquidApiWalletApproved: tooling?.hyperliquidApiWalletApproved ?? false,
    hyperliquidDefaultDex: tooling?.hyperliquidDefaultDex ?? null,
    hyperliquidEnabled: tooling?.hyperliquidEnabled ?? false,
    hyperliquidInfoReady: tooling?.hyperliquidInfoReady ?? false,
    hyperliquidLivePerpsEnabled: tooling?.hyperliquidLivePerpsEnabled ?? false,
    hyperliquidMasterWallet: tooling?.hyperliquidMasterWallet ?? null,
    hyperliquidWsUrl: tooling?.hyperliquidWsUrl ?? null,
    fourMemeActionNames: [],
    fourMemeAgenticUrl: tooling?.fourMemeAgenticUrl ?? null,
    fourMemeEnabled: tooling?.fourMemeEnabled ?? false,
    loadedActionCount: availableActions.length,
    loadedSkillCount: vendoredSkillNames.length,
    solanaAgentKitConfigured: tooling?.solanaAgentKitConfigured ?? false,
    solanaMcpConfigured: tooling?.solanaMcpConfigured ?? false,
    solanaDeveloperMcpConfigured:
      tooling?.solanaDeveloperMcpConfigured ?? false,
    sendaifunSolanaMcpConfigured:
      tooling?.sendaifunSolanaMcpConfigured ?? false,
    tavilyApiKeyConfigured: tooling?.tavilyApiKeyConfigured ?? false,
    tavilyMcpConfigured: tooling?.tavilyMcpConfigured ?? false,
    taskMasterMcpConfigured: tooling?.taskMasterMcpConfigured ?? false,
    telegramBroadcastEnabled: tooling?.telegramBroadcastEnabled ?? false,
    telegramChatConfigured: tooling?.telegramChatConfigured ?? false,
    wechatBroadcastEnabled: tooling?.wechatBroadcastEnabled ?? false,
    wechatWebhookConfigured: tooling?.wechatWebhookConfigured ?? false,
    skillHub,
    vendoredSkillNames,
    vertexOnly: tooling?.vertexOnly ?? false,
  };
}

export async function GET() {
  try {
    const status = await getAutonomousStatusWithLiveReserve();
    const publicStatus = {
      ...status,
      tooling: sanitizePublicTooling(status.tooling),
    };
    const liveReserveLamports = solToLamports(status.treasury.reserveSol.toString());
    const treasuryPosture = getTreasuryPosture({
      currentTreasuryLamports: liveReserveLamports,
    });

    return NextResponse.json({
      ...publicStatus,
      reserveFloor: PUBLIC_ECONOMIC_STATE.reserve,
      billboardPrice: PUBLIC_ECONOMIC_STATE.billboard,
      creatorFeePolicy: PUBLIC_ECONOMIC_STATE.creatorFees,
      tradingProfitPolicy: PUBLIC_ECONOMIC_STATE.tradingProfitAboveReserve,
      governanceMode: CONSTITUTION.governancePolicy.profitBranch.defaultMode,
      circuitBreakerState:
        status.circuitBreakerState || status.control?.circuitBreakerState,
      parentBrain: PUBLIC_BRAIN_STATE.parentBrain,
      childBrainCount: PUBLIC_BRAIN_STATE.childBrainCount,
      childBrainIds: PUBLIC_BRAIN_STATE.childBrainIds,
      socialCapitalMode: {
        goal: CONSTITUTION.socialCapitalPolicy.goal,
        channels: CONSTITUTION.socialCapitalPolicy.channels,
        publishIsTreasuryGrowth:
          CONSTITUTION.socialCapitalPolicy.publishIsTreasuryGrowth,
      },
      financialCapitalMode: {
        reserveHealthy: treasuryPosture.reserveHealthy,
        availableAboveReserveLamports:
          treasuryPosture.availableAboveReserveLamports,
        creatorFeesRouteToParent: true,
        governanceZone: "profit_above_reserve",
      },
      constitution: PUBLIC_CONSTITUTION_STATE,
      economics: PUBLIC_ECONOMIC_STATE,
      brains: PUBLIC_BRAIN_STATE,
      treasuryPosture,
      heartBeat: {
        constitutionRoute: "/api/constitution",
        brainsRoute: "/api/brains",
        route: "/api/agent/status",
        surfaceName: "Tianshi",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't load autonomous agent status.",
      },
      { status: 500 },
    );
  }
}
