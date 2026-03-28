import { bootstrapCommunityFromMintAddresses } from "@/packages/core/src/community";
import { createComputeMarketState } from "@/packages/core/src/computeMarket";
import { createComputePriceMarketState } from "@/packages/core/src/computePriceMarkets";
import { createPeerRegistryState } from "@/packages/core/src/peer";
import { createRewardLedgerState } from "@/packages/core/src/rewards";
import {
  createSavegameBundle,
  parseSavegameBundle,
  restoreSavegameBundle,
  stringifySavegameBundle,
} from "@/packages/core/src/savegame";
import { createSubagentRegistryState } from "@/packages/core/src/subagents";
import { createVendorMarketState } from "@/packages/core/src/vendorMarket";

describe("savegame", () => {
  it("round-trips mesh commerce state", () => {
    const bundle = createSavegameBundle({
      community: bootstrapCommunityFromMintAddresses(["mint:one", "mint:two"]),
      computeMarket: createComputeMarketState({
        assignments: [],
        bids: [],
        completions: [],
        offers: [],
        requests: [],
      }),
      computePriceMarkets: createComputePriceMarketState(),
      peers: createPeerRegistryState(),
      rewards: createRewardLedgerState(),
      subagents: createSubagentRegistryState(),
      vendorMarket: createVendorMarketState(),
    });

    const restored = restoreSavegameBundle(
      parseSavegameBundle(stringifySavegameBundle(bundle)),
    );

    expect(restored.community.bootstrapMintAddresses).toEqual(["mint:one", "mint:two"]);
    expect(restored.computeMarket.id).toBe("tianezha-compute-market");
    expect(restored.vendorMarket.id).toBe("tianezha-vendor-market");
  });
});
