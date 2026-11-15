import { NextRequest, NextResponse } from "next/server";
import { fetchChart } from "@/lib/market";
import { normalizeSymbol, type RangeKey, RANGES } from "@/lib/symbols";

export async function GET(req: NextRequest) {
  const symbol = normalizeSymbol(req.nextUrl.searchParams.get("symbol") ?? "");
  if (!symbol) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }

  const rangeParam = (req.nextUrl.searchParams.get("range") ?? "3mo") as RangeKey;
  const range = RANGES.some((r) => r.key === rangeParam) ? rangeParam : "3mo";

  try {
    const data = await fetchChart(symbol, range);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to load chart" }, { status: 502 });
  }
}
