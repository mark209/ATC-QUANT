import { NextResponse } from "next/server";
import type { RiskProfile } from "@/types/asset";
import { scanMarketUniverse, SCAN_UNIVERSES, type ScanUniverse } from "@/lib/data/marketScanner";

const riskProfiles = new Set<RiskProfile>(["conservative", "balanced", "aggressive"]);
const universes = new Set<ScanUniverse>(Object.keys(SCAN_UNIVERSES) as ScanUniverse[]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const universe = (searchParams.get("universe") || "mixed") as ScanUniverse;
  const riskProfile = (searchParams.get("riskProfile") || "balanced") as RiskProfile;
  const limit = Number(searchParams.get("limit") || 8);

  if (!universes.has(universe)) {
    return NextResponse.json({ error: "Unsupported scan universe." }, { status: 400 });
  }
  if (!riskProfiles.has(riskProfile)) {
    return NextResponse.json({ error: "Unsupported risk profile." }, { status: 400 });
  }

  try {
    const response = await scanMarketUniverse({
      universe,
      riskProfile,
      limit: Number.isFinite(limit) ? limit : 8
    });
    return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Market scanner failed.",
        sourcePolicy: "Scanner uses live market providers only; no mock market data is substituted."
      },
      { status: 502 }
    );
  }
}
