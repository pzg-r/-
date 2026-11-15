import type { Candle } from "./indicators";
import { NAME_ALIASES, normalizeSymbol, type RangeKey, RANGES } from "./symbols";
import { SAMPLE_CHARTS } from "./sample-data";
import type { ChartPayload, Quote, SearchHit } from "./types";

export type { ChartPayload, Quote, SearchHit };

const UA =
  "Mozilla/5.0 (compatible; Tidegauge/1.0; +https://cursor.com; stock-analysis)";

async function yahooGet(url: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
    },
    next: { revalidate: 60 },
  });
}

function localSearch(query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  const fromAlias = NAME_ALIASES.filter((row) =>
    row.keywords.some((k) => k.toLowerCase().includes(needle) || needle.includes(k.toLowerCase())),
  ).map((row) => ({
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    type: "Equity",
  }));

  const upper = query.trim().toUpperCase();
  const fromSample = Object.values(SAMPLE_CHARTS)
    .filter(
      (s) =>
        s.quote.symbol.includes(upper) ||
        s.quote.name.toLowerCase().includes(needle),
    )
    .map((s) => ({
      symbol: s.quote.symbol,
      name: s.quote.name,
      exchange: s.quote.exchange,
      type: "Equity",
    }));

  const seen = new Set<string>();
  const merged: SearchHit[] = [];
  for (const hit of [...fromAlias, ...fromSample]) {
    if (seen.has(hit.symbol)) continue;
    seen.add(hit.symbol);
    merged.push(hit);
  }
  return merged.slice(0, 8);
}

export async function searchSymbols(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q || q.length > 40) return [];

  const local = localSearch(q);
  const hasNonAscii = /[^\x00-\x7F]/.test(q);
  if (hasNonAscii) return local.length ? local : [];

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
    const res = await yahooGet(url);
    if (!res.ok) throw new Error(`search ${res.status}`);
    const data = await res.json();
    if (data?.finance?.error) throw new Error("search rejected");
    const quotes = (data.quotes ?? []) as Array<Record<string, unknown>>;
    const remote = quotes
      .filter((row) => typeof row.symbol === "string" && normalizeSymbol(String(row.symbol)))
      .map((row) => ({
        symbol: String(row.symbol).toUpperCase(),
        name: String(row.shortname || row.longname || row.symbol),
        exchange: String(row.exchDisp || row.exchange || ""),
        type: String(row.typeDisp || row.quoteType || ""),
      }))
      .slice(0, 8);
    return remote.length ? remote : local;
  } catch {
    return local;
  }
}

export async function fetchChart(
  rawSymbol: string,
  range: RangeKey = "3mo",
): Promise<ChartPayload> {
  const symbol = normalizeSymbol(rawSymbol);
  if (!symbol) throw new Error("Invalid symbol");

  const rangeMeta = RANGES.find((r) => r.key === range) ?? RANGES[3];

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${rangeMeta.key}&interval=${rangeMeta.interval}&includePrePost=false`;
    const res = await yahooGet(url);
    if (!res.ok) throw new Error(`chart ${res.status}`);
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error("empty chart");

    const meta = result.meta ?? {};
    const timestamps: number[] = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    const opens: Array<number | null> = quote.open ?? [];
    const highs: Array<number | null> = quote.high ?? [];
    const lows: Array<number | null> = quote.low ?? [];
    const closes: Array<number | null> = quote.close ?? [];
    const volumes: Array<number | null> = quote.volume ?? [];

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const open = opens[i];
      const high = highs[i];
      const low = lows[i];
      const close = closes[i];
      if (open == null || high == null || low == null || close == null) continue;
      candles.push({
        time: timestamps[i],
        open,
        high,
        low,
        close,
        volume: volumes[i] ?? 0,
      });
    }

    if (candles.length < 2) throw new Error("too few candles");

    const price = Number(meta.regularMarketPrice ?? candles[candles.length - 1].close);
    let changePercent: number;
    let change: number;

    if (meta.regularMarketChangePercent != null) {
      changePercent = Number(meta.regularMarketChangePercent);
      if (meta.regularMarketChange != null) {
        change = Number(meta.regularMarketChange);
      } else {
        const prevFromPct = changePercent === -100 ? 0 : price / (1 + changePercent / 100);
        change = price - prevFromPct;
      }
    } else {
      const prevClose = Number(
        meta.previousClose ?? candles[candles.length - 2]?.close ?? price,
      );
      change = price - prevClose;
      changePercent = prevClose ? (change / prevClose) * 100 : 0;
    }

    return {
      quote: {
        symbol: String(meta.symbol ?? symbol),
        name: String(meta.longName || meta.shortName || symbol),
        price,
        change,
        changePercent,
        currency: String(meta.currency ?? "USD"),
        exchange: String(meta.fullExchangeName || meta.exchangeName || ""),
        marketState: meta.marketState,
      },
      candles,
      source: "live",
    };
  } catch {
    const sample = SAMPLE_CHARTS[symbol] ?? SAMPLE_CHARTS.AAPL;
    return {
      ...sample,
      quote: { ...sample.quote, symbol: sample.quote.symbol },
      source: "sample",
    };
  }
}
