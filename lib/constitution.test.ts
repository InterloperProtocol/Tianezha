import { describe, expect, it } from "vitest";

import {
  CONSTITUTION,
  PUBLIC_CONSTITUTION_STATE,
  allocateTradingProfitAboveReserve,
  assertConstitutionInvariant,
  getTreasuryPosture,
  lamportsToSolString,
  maxBuybackSpendThisEpoch,
  routeBillboardRevenue,
  routeCreatorFees,
  solToLamports,
} from "@/lib/constitution";

describe("constitution helpers", () => {
  it("converts SOL to lamports and back", () => {
    const lamports = solToLamports("0.69420");

    expect(lamports).toBe(694_200_000n);
    expect(lamportsToSolString(lamports)).toBe("0.6942");
  });

  it("validates the frozen constitution", () => {
    expect(() => assertConstitutionInvariant(CONSTITUTION)).not.toThrow();
  });

  it("publishes parent-child constitutional state", () => {
    expect(
      (PUBLIC_CONSTITUTION_STATE.parentChild as { sovereignParentBrainId?: string })
        ?.sovereignParentBrainId,
    ).toBe("tianshi");
  });

  it("routes creator fees into buyback, trading wallet, and remainder", () => {
    const plan = routeCreatorFees(1_000_000_000n);

    expect(plan.buybackBurnLamports).toBe(400_000_000n);
    expect(plan.tradingWalletLamports).toBe(110_000_000n);
    expect(plan.toAgentLamports).toBe(510_000_000n);
    expect(plan.remainderNonAgentLamports).toBe(490_000_000n);
  });

  it("routes billboard revenue 50/50", () => {
    const plan = routeBillboardRevenue(10_000_000n);

    expect(plan.buybackBurnLamports).toBe(5_000_000n);
    expect(plan.tradingWalletLamports).toBe(5_000_000n);
  });

  it("allocates realized profit only above reserve", () => {
    const plan = allocateTradingProfitAboveReserve({
      realizedProfitLamports: 100_000_000n,
      currentTreasuryLamports: 900_000_000n,
      governanceMode: "buybackBurn",
    });

    expect(plan.distributableLamports).toBe(100_000_000n);
    expect(plan.governanceBranchLamports).toBe(50_000_000n);
    expect(plan.founderLamports).toBe(10_000_000n);
    expect(plan.retainedLamports).toBe(40_000_000n);
    expect(plan.governanceMode).toBe("buybackBurn");
  });

  it("caps buyback spending to 10% of treasury above reserve", () => {
    const maxSpend = maxBuybackSpendThisEpoch({
      currentTreasuryLamports: 1_000_000_000n,
    });

    expect(maxSpend).toBe(30_580_000n);
  });

  it("derives public-safe treasury posture from live lamports", () => {
    const posture = getTreasuryPosture({
      currentTreasuryLamports: 900_000_000n,
    });

    expect(posture.reserveHealthy).toBe(true);
    expect(posture.availableAboveReserveLamports).toBe("205800000");
  });
});
