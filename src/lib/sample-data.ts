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
    const close = Math.max(1, open * (1 + drift + noise));
    const high = Math.max(open, close) * (1 + Math.abs(noise));
    const low = Math.min(open, close) * (1 - Math.abs(noise));
    candles.push({
      time: t,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(8_000_000 + Math.abs(Math.sin(i + seed)) * 12_000_000),
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
      currency: symbol.includes(".SS") || symbol.includes(".HK") ? (symbol.includes(".HK") ? "HKD" : "CNY") : "USD",
      exchange: "Sample",
    },
    candles,
    source: "sample",
  };
}

export const SAMPLE_CHARTS: Record<string, ChartPayload> = {
  AAPL: synth("AAPL", "Apple Inc.", 220, 1),
  NVDA: synth("NVDA", "NVIDIA Corporation", 120, 2),
  TSLA: synth("TSLA", "Tesla, Inc.", 240, 3),
  MSFT: synth("MSFT", "Microsoft Corporation", 410, 4),
  "0700.HK": synth("0700.HK", "Tencent Holdings", 380, 5),
  BABA: synth("BABA", "Alibaba Group", 90, 6),
  "600519.SS": synth("600519.SS", "贵州茅台", 1480, 7),
  SPY: synth("SPY", "SPDR S&P 500 ETF", 560, 8),
};
