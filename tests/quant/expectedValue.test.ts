import { describe, expect, it } from "vitest";
import { calculateExpectedValue } from "@/lib/quant/expectedValue";

describe("expected value", () => {
  it("uses win rate only as part of expected value", () => {
    const result = calculateExpectedValue([0.03, 0.02, -0.01, -0.02], 0.001, 0.001);
    expect(result.winRate).toBe(0.5);
    expect(result.payoffRatio).toBeCloseTo(1.666666, 5);
    expect(result.expectedValue).toBeGreaterThan(0);
  });
});
