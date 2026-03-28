import { renderHtml } from "@/tests/regression/helpers/render";

vi.mock("@/components/shell/TianezhaScaffold", () => import("@/tests/regression/helpers/mock-scaffold"));

import NezhaPage from "@/app/nezha/page";
import TianziPage from "@/app/tianzi/page";
import TianshiPage from "@/app/tianshi/page";
import { getMeshCommerceSummary, resetMeshCommerceState } from "@/lib/server/mesh-commerce";

describe("mesh commerce surfaces", () => {
  beforeEach(() => {
    resetMeshCommerceState();
  });

  it("renders compute price discovery on Tianzi and Nezha without Conway", async () => {
    const summary = getMeshCommerceSummary();
    const tianziHtml = renderHtml(await TianziPage());
    const nezhaHtml = renderHtml(await NezhaPage());

    expect(summary.vendors.conwayRequired).toBe(false);
    expect(tianziHtml).toContain("Compute forecast bands");
    expect(nezhaHtml).toContain("Compute perps");
  });

  it("keeps Tianshi status viewable with no wallet connect baseline", async () => {
    const tianshiHtml = renderHtml(await TianshiPage());
    const summary = getMeshCommerceSummary();

    expect(summary.state.community.walletConnectRequired).toBe(false);
    expect(tianshiHtml).toContain("The brain, world interpreter, and heartbeat publisher for Tianezha.");
  });
});
