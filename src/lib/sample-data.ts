import type { Candle } from "./indicators";
import type { ChartPayload } from "./types";

function synth(
  symbol: string,
  name: string,
  start: number,
  seed: number,
  days = 120,
): ChartPayload {
  const candles: Candle[] = [];
  let price = start;
  let t = Math.floor(Date.now() / 1000) - days * 86400;
  for (let i = 0; i < days; i++) {
    const drift = Math.sin((i + seed) / 9) * 0.012 + Math.cos((i + seed) / 17) * 0.006;
    const noise = ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1) * 0.01 - 0.005;
    const open = price;
    const close = Math.max(0.01, open * (1 + drift + noise));
    const high = Math.max(open, close) * (1 + Math.abs(noise));
    const low = Math.min(open, close) * (1 - Math.abs(noise));
    candles.push({
      time: t,
      open: +open.toFixed(3),
      high: +high.toFixed(3),
      low: +low.toFixed(3),
      close: +close.toFixed(3),
      volume: Math.floor(1_000_000 + Math.abs(Math.sin(i + seed)) * 8_000_000),
    });
    price = close;
    t += 86400;
  }
  const last = candles[candles.length - 1].close;
  const prev = candles[candles.length - 2].close;
  return {
    quote: {
      symbol,
      name,
      price: last,
      change: last - prev,
      changePercent: ((last - prev) / prev) * 100,
      currency: "CNY",
      exchange: symbol.endsWith(".OF") ? "场外基金" : symbol.endsWith(".SH") ? "沪市" : "深市",
    },
    candles,
    source: "sample",
  };
}

export const SAMPLE_CHARTS: Record<string, ChartPayload> = {
  "600519.SH": synth("600519.SH", "贵州茅台", 1480, 1),
  "300750.SZ": synth("300750.SZ", "宁德时代", 220, 2),
  "000001.SZ": synth("000001.SZ", "平安银行", 12, 3),
  "601318.SH": synth("601318.SH", "中国平安", 55, 4),
  "510300.SH": synth("510300.SH", "沪深300ETF", 4.2, 5),
  "159915.SZ": synth("159915.SZ", "创业板ETF", 2.1, 6),
  "110022.OF": synth("110022.OF", "易方达消费行业股票", 2.9, 7),
  "161725.OF": synth("161725.OF", "招商中证白酒指数", 0.8, 8),
};
