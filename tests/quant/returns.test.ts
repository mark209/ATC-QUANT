import { describe, expect, it } from "vitest";
import { calculateLogReturns, calculateSimpleReturns, compoundReturn } from "@/lib/quant/returns";

describe("returns", () => {
  it("calculates simple returns", () => {
    expect(calculateSimpleReturns([100, 110, 99])).toEqual([0.1, -0.1]);
  });

  it("compounds an equity curve from periodic strategy returns", () => {
    const initialEquity = 100;
    const finalEquity = initialEquity * (1 + compoundReturn([0.1, -0.1]));

    expect(finalEquity).toBeCloseTo(99, 8);
  });

  it("calculates log returns", () => {
    const result = calculateLogReturns([100, 110]);
    expect(result[0]).toBeCloseTo(Math.log(1.1), 8);
  });
});
