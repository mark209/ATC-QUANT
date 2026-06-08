import { describe, expect, it } from "vitest";
import { calculatePositionSizing, fractionalKelly } from "@/lib/quant/positionSizing";

describe("position sizing", () => {
  it("never recommends negative Kelly sizing", () => {
    expect(fractionalKelly(0.3, 1, "stock")).toBe(0);
  });

  it("uses the lowest allocation constraint", () => {
    const result = calculatePositionSizing({
      assetType: "crypto",
      symbol: "BTCUSDT",
      realizedVolatility: 0.8,
      currentDrawdown: -0.1,
      winRate: 0.55,
      payoffRatio: 1.5,
      riskProfile: "balanced"
    });

    expect(result.finalAllocation).toBeLessThanOrEqual(result.assetClassMaxAllocation);
    expect(result.riskMode).toBe("Caution");
  });
});
