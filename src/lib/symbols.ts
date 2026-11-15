/** Only allow ticker-like strings — never free-form URLs (SSRF guard). */
export const SYMBOL_RE = /^[A-Za-z0-9][A-Za-z0-9.^_-]{0,14}$/;

export type AssetKind = "stock" | "etf" | "fund";

export type NormalizedSymbol = {
  /** Display / API symbol, e.g. 600519.SH or 110022.OF */
  symbol: string;
  code: string;
  kind: AssetKind;
  /** East Money secid for stocks/ETFs, e.g. 1.600519 */
  secid?: string;
};

export function normalizeSymbol(raw: string): string | null {
  const parsed = parseSymbol(raw);
  return parsed?.symbol ?? null;
}

/** Map 6-digit A-share / ETF codes to East Money market id. */
export function marketOfAShare(code: string): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  if (/^(60|68|90|51|52|56|58)/.test(code)) return 1; // SH
  if (/^(00|30|20|15|16|18)/.test(code)) return 0; // SZ
  if (/^(4|8)/.test(code)) return 0; // BJ often 0.xxxxxx on East Money
  return null;
}

export function detectKind(code: string): AssetKind {
  if (/^(51|52|56|58|15|16|18)\d{4}$/.test(code)) return "etf";
  return "stock";
}

export function parseSymbol(raw: string): NormalizedSymbol | null {
  const input = raw.trim().toUpperCase();
  if (!input || input.length > 15) return null;

  // 场外基金：110022.OF / OF110022
  const fundMatch = input.match(/^(?:OF)?(\d{6})\.OF$/) || input.match(/^OF(\d{6})$/);
  if (fundMatch) {
    return { symbol: `${fundMatch[1]}.OF`, code: fundMatch[1], kind: "fund" };
  }

  // 场内：600519.SH / 000001.SZ / 600519.SS
  const listed = input.match(/^(\d{6})\.(SH|SZ|SS|BJ)$/);
  if (listed) {
    const code = listed[1];
    const suf = listed[2] === "SS" ? "SH" : listed[2];
    const market = suf === "SH" ? 1 : 0;
    return {
      symbol: `${code}.${suf}`,
      code,
      kind: detectKind(code),
      secid: `${market}.${code}`,
    };
  }

  // 裸 6 位：按 A 股/ETF 规则；无法识别则当基金
  if (/^\d{6}$/.test(input)) {
    const market = marketOfAShare(input);
    if (market != null) {
      const suf = market === 1 ? "SH" : "SZ";
      return {
        symbol: `${input}.${suf}`,
        code: input,
        kind: detectKind(input),
        secid: `${market}.${input}`,
      };
    }
    return { symbol: `${input}.OF`, code: input, kind: "fund" };
  }

  if (!SYMBOL_RE.test(input)) return null;
  return null;
}

export const QUICK_PICKS = [
  { symbol: "600519.SH", name: "贵州茅台" },
  { symbol: "300750.SZ", name: "宁德时代" },
  { symbol: "000001.SZ", name: "平安银行" },
  { symbol: "601318.SH", name: "中国平安" },
  { symbol: "510300.SH", name: "沪深300ETF" },
  { symbol: "159915.SZ", name: "创业板ETF" },
  { symbol: "110022.OF", name: "易方达消费" },
  { symbol: "161725.OF", name: "招商白酒" },
] as const;

/** Local aliases for Chinese search (A-shares + funds only). */
export const NAME_ALIASES: {
  keywords: string[];
  symbol: string;
  name: string;
  exchange: string;
  kind: AssetKind;
}[] = [
  { keywords: ["茅台", "贵州茅台"], symbol: "600519.SH", name: "贵州茅台", exchange: "沪A", kind: "stock" },
  { keywords: ["宁德", "宁德时代"], symbol: "300750.SZ", name: "宁德时代", exchange: "深A", kind: "stock" },
  { keywords: ["平安银行"], symbol: "000001.SZ", name: "平安银行", exchange: "深A", kind: "stock" },
  { keywords: ["中国平安", "平安"], symbol: "601318.SH", name: "中国平安", exchange: "沪A", kind: "stock" },
  { keywords: ["五粮液"], symbol: "000858.SZ", name: "五粮液", exchange: "深A", kind: "stock" },
  { keywords: ["招商银行", "招行"], symbol: "600036.SH", name: "招商银行", exchange: "沪A", kind: "stock" },
  { keywords: ["比亚迪"], symbol: "002594.SZ", name: "比亚迪", exchange: "深A", kind: "stock" },
  { keywords: ["沪深300", "300etf", "沪深300etf"], symbol: "510300.SH", name: "沪深300ETF", exchange: "沪市基金", kind: "etf" },
  { keywords: ["创业板", "创业板etf"], symbol: "159915.SZ", name: "创业板ETF", exchange: "深市基金", kind: "etf" },
  { keywords: ["中证500", "500etf"], symbol: "510500.SH", name: "中证500ETF", exchange: "沪市基金", kind: "etf" },
  { keywords: ["易方达消费", "消费基金"], symbol: "110022.OF", name: "易方达消费行业股票", exchange: "场外基金", kind: "fund" },
  { keywords: ["招商白酒", "白酒基金"], symbol: "161725.OF", name: "招商中证白酒指数", exchange: "场外基金", kind: "fund" },
  { keywords: ["兴全合润"], symbol: "163406.OF", name: "兴全合润混合", exchange: "场外基金", kind: "fund" },
];

export type RangeKey = "1d" | "5d" | "1mo" | "3mo" | "6mo" | "1y";

export const RANGES: { key: RangeKey; label: string; klt: number; limit: number }[] = [
  { key: "1d", label: "日", klt: 5, limit: 48 },
  { key: "5d", label: "周", klt: 15, limit: 80 },
  { key: "1mo", label: "月", klt: 101, limit: 25 },
  { key: "3mo", label: "季", klt: 101, limit: 70 },
  { key: "6mo", label: "半年", klt: 101, limit: 140 },
  { key: "1y", label: "年", klt: 101, limit: 260 },
];
