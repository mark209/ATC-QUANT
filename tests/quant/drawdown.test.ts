import { describe, expect, it } from "vitest";
import { calculateDrawdowns } from "@/lib/quant/drawdown";

describe("drawdown", () => {
  it("finds maximum drawdown", () => {
    const result = calculateDrawdowns([
      { date: "2026-01-01", value: 100 },
      { date: "2026-01-02", value: 120 },
      { date: "2026-01-03", value: 90 },
      { date: "2026-01-04", value: 110 }
    ]);

    expect(result.maxDrawdown).toBeCloseTo(-0.25, 8);
    expect(result.currentDrawdown).toBeCloseTo(-0.083333, 5);
  });
});
