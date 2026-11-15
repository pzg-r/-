import type { Candle } from "./indicators";
import {
  NAME_ALIASES,
  parseSymbol,
  type RangeKey,
  RANGES,
  type AssetKind,
} from "./symbols";
import { SAMPLE_CHARTS } from "./sample-data";
import type { ChartPayload, SearchHit } from "./types";

export type { ChartPayload, SearchHit };

const UA =
  "Mozilla/5.0 (compatible; Tidegauge/1.0; +https://cursor.com; a-share-funds)";

async function emGet(url: string, referer: string): Promise<Response> {
  return fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "application/json,text/plain,*/*",
      Referer: referer,
    },
    next: { revalidate: 60 },
  });
}

function kindLabel(kind: AssetKind): string {
  if (kind === "fund") return "场外基金";
  if (kind === "etf") return "ETF";
  return "A股";
}

function localSearch(query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  const upper = query.trim().toUpperCase();

  const fromAlias = NAME_ALIASES.filter((row) =>
    row.keywords.some(
      (k) => k.toLowerCase().includes(needle) || needle.includes(k.toLowerCase()),
    ),
  ).map((row) => ({
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    type: kindLabel(row.kind),
  }));

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
      type: s.quote.symbol.endsWith(".OF")
        ? "场外基金"
        : s.quote.symbol.match(/^(51|52|56|58|15|16|18)/)
          ? "ETF"
          : "A股",
    }));

  // Direct 6-digit / typed symbol
  const parsed = parseSymbol(query);
  const direct: SearchHit[] = parsed
    ? [
        {
          symbol: parsed.symbol,
          name: parsed.code,
          exchange: kindLabel(parsed.kind),
          type: kindLabel(parsed.kind),
        },
      ]
    : [];

  const seen = new Set<string>();
  const merged: SearchHit[] = [];
  for (const hit of [...fromAlias, ...direct, ...fromSample]) {
    if (seen.has(hit.symbol)) continue;
    seen.add(hit.symbol);
    merged.push(hit);
  }
  return merged.slice(0, 8);
}

async function searchListed(query: string): Promise<SearchHit[]> {
  const url = `https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(query)}&type=14&token=D43BF458C8F90027E889AEB228278508&count=8`;
  const res = await emGet(url, "https://www.eastmoney.com/");
  if (!res.ok) throw new Error(`listed search ${res.status}`);
  const data = await res.json();
  const rows = (data?.QuotationCodeTable?.Data ?? []) as Array<Record<string, unknown>>;

  return rows
    .map((row) => {
      const code = String(row.Code ?? "");
      const mkt = String(row.MktNum ?? row.MarketType ?? "");
      const classify = String(row.Classify ?? "");
      const typeName = String(row.SecurityTypeName ?? "");
      if (!/^\d{6}$/.test(code)) return null;

      // Only A-share / 场内基金
      const isFundLike =
        classify === "Fund" || typeName.includes("基金") || /^(51|52|56|58|15|16|18)/.test(code);
      const isAStock =
        classify === "AStock" ||
        typeName.includes("沪A") ||
        typeName.includes("深A") ||
        typeName.includes("京A");

      if (!isFundLike && !isAStock) return null;

      const suf = mkt === "1" || typeName.includes("沪") ? "SH" : "SZ";
      const kind: AssetKind = isFundLike ? "etf" : "stock";
      return {
        symbol: `${code}.${suf}`,
        name: String(row.Name ?? code),
        exchange: typeName || (suf === "SH" ? "沪市" : "深市"),
        type: kindLabel(kind),
      } satisfies SearchHit;
    })
    .filter((x): x is SearchHit => x != null)
    .slice(0, 8);
}

async function searchFunds(query: string): Promise<SearchHit[]> {
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(query)}`;
  const res = await emGet(url, "https://fund.eastmoney.com/");
  if (!res.ok) throw new Error(`fund search ${res.status}`);
  const data = await res.json();
  const rows = (data?.Datas ?? []) as Array<Record<string, unknown>>;

  return rows
    .filter((row) => String(row.CATEGORYDESC ?? "") === "基金" || row.FundBaseInfo)
    .map((row) => {
      const code = String(row.CODE ?? row._id ?? "");
      const name = String(
        (row.FundBaseInfo as Record<string, unknown> | undefined)?.SHORTNAME ??
          row.NAME ??
          code,
      );
      if (!/^\d{6}$/.test(code)) return null;
      return {
        symbol: `${code}.OF`,
        name,
        exchange: "场外基金",
        type: "场外基金",
      } satisfies SearchHit;
    })
    .filter((x): x is SearchHit => x != null)
    .slice(0, 8);
}

export async function searchSymbols(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q || q.length > 40) return [];

  const local = localSearch(q);

  try {
    const [listed, funds] = await Promise.all([
      searchListed(q).catch(() => [] as SearchHit[]),
      searchFunds(q).catch(() => [] as SearchHit[]),
    ]);

    const seen = new Set<string>();
    const merged: SearchHit[] = [];
    for (const hit of [...local, ...listed, ...funds]) {
      if (seen.has(hit.symbol)) continue;
      seen.add(hit.symbol);
      merged.push(hit);
    }
    return merged.slice(0, 10);
  } catch {
    return local;
  }
}

function parseKlineRow(row: string): Candle | null {
  // date,open,close,high,low,volume,amount,amplitude...
  const parts = row.split(",");
  if (parts.length < 6) return null;
  const date = parts[0];
  const open = Number(parts[1]);
  const close = Number(parts[2]);
  const high = Number(parts[3]);
  const low = Number(parts[4]);
  const volume = Number(parts[5]);
  if (![open, close, high, low].every(Number.isFinite)) return null;

  let time: number;
  if (date.includes(" ")) {
    // "2026-11-14 10:30"
    time = Math.floor(new Date(date.replace(/-/g, "/") + ":00+08:00").getTime() / 1000);
  } else {
    time = Math.floor(new Date(date.replace(/-/g, "/") + " 15:00:00+08:00").getTime() / 1000);
  }
  if (!Number.isFinite(time)) return null;

  return { time, open, high, low, close, volume: Number.isFinite(volume) ? volume : 0 };
}

async function fetchListedChart(
  parsed: NonNullable<ReturnType<typeof parseSymbol>>,
  range: RangeKey,
): Promise<ChartPayload> {
  if (!parsed.secid) throw new Error("missing secid");
  const rangeMeta = RANGES.find((r) => r.key === range) ?? RANGES[3];
  const url = `https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${encodeURIComponent(parsed.secid)}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58&klt=${rangeMeta.klt}&fqt=1&end=20500101&lmt=${rangeMeta.limit}`;
  const res = await emGet(url, "https://quote.eastmoney.com/");
  if (!res.ok) throw new Error(`kline ${res.status}`);
  const data = await res.json();
  const block = data?.data;
  if (!block?.klines?.length) throw new Error("empty kline");

  const candles = (block.klines as string[])
    .map(parseKlineRow)
    .filter((c): c is Candle => c != null);

  if (candles.length < 2) throw new Error("too few candles");

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const change = last.close - prev.close;
  const changePercent = prev.close ? (change / prev.close) * 100 : 0;

  return {
    quote: {
      symbol: parsed.symbol,
      name: String(block.name || parsed.code),
      price: last.close,
      change,
      changePercent,
      currency: "CNY",
      exchange: parsed.kind === "etf" ? "场内基金" : parsed.symbol.endsWith(".SH") ? "沪市" : "深市",
    },
    candles,
    source: "live",
  };
}

async function fetchFundNavPages(code: string, needed: number) {
  const pageSize = 20; // East Money caps each page around 20 rows
  const pages = Math.min(Math.ceil(needed / pageSize), 8);
  const rows: Array<Record<string, string>> = [];
  for (let page = 1; page <= pages; page++) {
    const url = `https://api.fund.eastmoney.com/f10/lsjz?fundCode=${encodeURIComponent(code)}&pageIndex=${page}&pageSize=${pageSize}`;
    const res = await emGet(url, "https://fund.eastmoney.com/");
    if (!res.ok) throw new Error(`fund ${res.status}`);
    const data = await res.json();
    const list = (data?.Data?.LSJZList ?? []) as Array<Record<string, string>>;
    if (!list.length) break;
    rows.push(...list);
    if (list.length < pageSize || rows.length >= needed) break;
  }
  return rows.slice(0, needed);
}

async function fetchFundChart(
  parsed: NonNullable<ReturnType<typeof parseSymbol>>,
  range: RangeKey,
): Promise<ChartPayload> {
  const rangeMeta = RANGES.find((r) => r.key === range) ?? RANGES[3];
  // Fund NAV is daily; approximate limits by trading days.
  const list = await fetchFundNavPages(parsed.code, Math.max(rangeMeta.limit, 20));
  if (!list.length) throw new Error("empty fund nav");

  // API returns newest first
  const chronological = [...list].reverse();
  const candles: Candle[] = [];
  for (const row of chronological) {
    const nav = Number(row.DWJZ);
    if (!Number.isFinite(nav)) continue;
    const time = Math.floor(
      new Date(String(row.FSRQ).replace(/-/g, "/") + " 15:00:00+08:00").getTime() / 1000,
    );
    candles.push({
      time,
      open: nav,
      high: nav,
      low: nav,
      close: nav,
      volume: 0,
    });
  }

  if (candles.length < 2) throw new Error("too few fund points");

  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const change = last.close - prev.close;
  const changePercent =
    rowPct(list[0]?.JZZZL) ?? (prev.close ? (change / prev.close) * 100 : 0);

  const alias = NAME_ALIASES.find((a) => a.symbol === parsed.symbol);
  const searched = await searchFunds(parsed.code).catch(() => [] as SearchHit[]);
  const fundName =
    alias?.name ??
    searched.find((h) => h.symbol === parsed.symbol)?.name ??
    searched[0]?.name ??
    `基金 ${parsed.code}`;

  return {
    quote: {
      symbol: parsed.symbol,
      name: fundName,
      price: last.close,
      change,
      changePercent,
      currency: "CNY",
      exchange: "场外基金",
    },
    candles,
    source: "live",
  };
}

function rowPct(raw?: string): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function fetchChart(
  rawSymbol: string,
  range: RangeKey = "3mo",
): Promise<ChartPayload> {
  const parsed = parseSymbol(rawSymbol);
  if (!parsed) throw new Error("Invalid symbol");

  try {
    if (parsed.kind === "fund") {
      return await fetchFundChart(parsed, range);
    }
    return await fetchListedChart(parsed, range);
  } catch {
    // Ambiguous 6-digit: try the other market type once
    if (parsed.kind !== "fund" && /^\d{6}$/.test(parsed.code)) {
      try {
        return await fetchFundChart(
          { symbol: `${parsed.code}.OF`, code: parsed.code, kind: "fund" },
          range,
        );
      } catch {
        /* fall through */
      }
    }

    const sample =
      SAMPLE_CHARTS[parsed.symbol] ??
      SAMPLE_CHARTS[`${parsed.code}.SH`] ??
      SAMPLE_CHARTS[`${parsed.code}.SZ`] ??
      SAMPLE_CHARTS[`${parsed.code}.OF`] ??
      SAMPLE_CHARTS["600519.SH"];

    return {
      ...sample,
      quote: { ...sample.quote, symbol: sample.quote.symbol },
      source: "sample",
    };
  }
}

/** Enrich fund display name when possible. */
export async function resolveFundName(code: string): Promise<string | null> {
  try {
    const hits = await searchFunds(code);
    return hits.find((h) => h.symbol === `${code}.OF`)?.name ?? hits[0]?.name ?? null;
  } catch {
    return null;
  }
}
