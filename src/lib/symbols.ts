/** Only allow ticker-like strings — never free-form URLs (SSRF guard). */
export const SYMBOL_RE = /^[A-Za-z0-9][A-Za-z0-9.^_-]{0,14}$/;

export function normalizeSymbol(raw: string): string | null {
  const symbol = raw.trim().toUpperCase();
  if (!SYMBOL_RE.test(symbol)) return null;
  return symbol;
}

export const QUICK_PICKS = [
  { symbol: "AAPL", name: "苹果" },
  { symbol: "NVDA", name: "英伟达" },
  { symbol: "TSLA", name: "特斯拉" },
  { symbol: "MSFT", name: "微软" },
  { symbol: "0700.HK", name: "腾讯" },
  { symbol: "BABA", name: "阿里巴巴" },
  { symbol: "600519.SS", name: "贵州茅台" },
  { symbol: "SPY", name: "标普500 ETF" },
] as const;

/** Local aliases when Yahoo search rejects non-Latin queries. */
export const NAME_ALIASES: { keywords: string[]; symbol: string; name: string; exchange: string }[] =
  [
    { keywords: ["苹果", "apple"], symbol: "AAPL", name: "Apple Inc.", exchange: "NASDAQ" },
    { keywords: ["英伟达", "nvidia"], symbol: "NVDA", name: "NVIDIA Corporation", exchange: "NASDAQ" },
    { keywords: ["特斯拉", "tesla"], symbol: "TSLA", name: "Tesla, Inc.", exchange: "NASDAQ" },
    { keywords: ["微软", "microsoft"], symbol: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ" },
    { keywords: ["腾讯", "tencent"], symbol: "0700.HK", name: "Tencent Holdings", exchange: "HKEX" },
    { keywords: ["阿里", "alibaba"], symbol: "BABA", name: "Alibaba Group", exchange: "NYSE" },
    { keywords: ["茅台", "moutai", "贵州茅台"], symbol: "600519.SS", name: "贵州茅台", exchange: "SSE" },
    { keywords: ["标普", "spy"], symbol: "SPY", name: "SPDR S&P 500 ETF", exchange: "NYSE Arca" },
    { keywords: ["比亚迪", "byd"], symbol: "1211.HK", name: "BYD Company", exchange: "HKEX" },
    { keywords: ["宁德", "宁德时代"], symbol: "300750.SZ", name: "宁德时代", exchange: "SZSE" },
  ];

export type RangeKey = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y";

export const RANGES: { key: RangeKey; label: string; interval: string }[] = [
  { key: "1d", label: "日", interval: "5m" },
  { key: "5d", label: "周", interval: "15m" },
  { key: "1mo", label: "月", interval: "1d" },
  { key: "3mo", label: "季", interval: "1d" },
  { key: "6mo", label: "半年", interval: "1d" },
  { key: "1y", label: "年", interval: "1d" },
];
