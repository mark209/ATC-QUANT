import { describe, expect, it } from "vitest";
import { formatPercent, formatRatio } from "@/components/dashboard/format";

describe("dashboard formatting", () => {
  it("formats decimal allocation fractions as percentages", () => {
    expect(formatPercent(0.0023, 2)).toBe("0.23%");
    expect(formatPercent(0.01, 2)).toBe("1.00%");
    expect(formatPercent(0, 2)).toBe("0.00%");
  });

  it("does not display clipped guardrail ratios as meaningful scores", () => {
    expect(formatRatio(-10, { meaningfulAbsLimit: 10 })).toBe("Not meaningful");
    expect(formatRatio(10, { meaningfulAbsLimit: 10 })).toBe("Not meaningful");
    expect(formatRatio(0.42, { meaningfulAbsLimit: 10 })).toBe("0.42");
  });
});
