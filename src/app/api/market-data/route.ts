import { NextResponse } from "next/server";
import type { AssetType, RiskProfile } from "@/types/asset";
import { getLiveMarketAnalysis } from "@/lib/data/marketDataAdapter";

const assetTypes = new Set<AssetType>(["crypto", "stock", "etf", "index"]);
const riskProfiles = new Set<RiskProfile>(["conservative", "balanced", "aggressive"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol")?.trim() || "BTCUSDT";
  const assetType = (searchParams.get("assetType") || "crypto") as AssetType;
  const riskProfile = (searchParams.get("riskProfile") || "balanced") as RiskProfile;

  if (!assetTypes.has(assetType)) {
    return NextResponse.json({ error: "Unsupported asset type." }, { status: 400 });
  }
  if (!riskProfiles.has(riskProfile)) {
    return NextResponse.json({ error: "Unsupported risk profile." }, { status: 400 });
  }

  try {
    const response = await getLiveMarketAnalysis({ symbol, assetType, riskProfile });
    return NextResponse.json({ ...response, live: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      {
        live: false,
        error: error instanceof Error ? error.message : "Live provider request failed.",
        sourcePolicy: "No mock market data is substituted when a live provider fails."
      },
      { status: 502 }
    );
  }
}
