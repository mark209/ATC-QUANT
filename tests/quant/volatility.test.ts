import { describe, expect, it } from "vitest";
import { annualizedVolatility, ewmaVolatility } from "@/lib/quant/volatility";

describe("volatility", () => {
  it("annualizes daily log-return volatility", () => {
    const result = annualizedVolatility([0.01, -0.01, 0.02, -0.02], 252);
    expect(result).toBeGreaterThan(0.2);
  });

  it("calculates EWMA volatility", () => {
    const result = ewmaVolatility([0.01, -0.01, 0.02, -0.02], 0.94, 252);
    expect(result).toBeGreaterThan(0);
  });
});
