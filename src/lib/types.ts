import type { Candle } from "./indicators";

export type Quote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  exchange: string;
  marketState?: string;
};

export type ChartPayload = {
  quote: Quote;
  candles: Candle[];
  source: "live" | "sample";
};

export type SearchHit = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
};
