import { QuantDashboard } from "@/components/dashboard/QuantDashboard";
import { getLiveMarketAnalysis } from "@/lib/data/marketDataAdapter";

export const dynamic = "force-dynamic";

export default async function Home() {
  try {
    const initial = await getLiveMarketAnalysis({
      symbol: "BTCUSDT",
      assetType: "crypto",
      riskProfile: "balanced"
    });
    return <QuantDashboard initialData={{ ...initial, live: true }} />;
  } catch (error) {
    return (
      <QuantDashboard
        initialData={{
          live: false,
          error: error instanceof Error ? error.message : "Live provider request failed.",
          sourcePolicy: "No mock market data is substituted when a live provider fails."
        }}
      />
    );
  }
}
