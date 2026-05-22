import { NextResponse } from "next/server";
import { fetchOnchainMarkets } from "@/lib/chain";

// Chain reads run server-side: the browser is blocked from hitting the Arc
// RPC directly (origin policy), the Next server is not. This route returns
// the live on-chain markets so the page can show crowd price + bet flow.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await fetchOnchainMarkets();
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({
      rows: [],
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
