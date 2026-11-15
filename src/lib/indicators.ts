export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = Array(closes.length).fill(null);
  if (closes.length <= period) return out;

  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gain += diff;
    else loss -= diff;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const g = diff > 0 ? diff : 0;
    const l = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    if (prev === null) {
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out.push(seed);
      continue;
    }
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function macd(closes: number[]) {
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const dif: (number | null)[] = closes.map((_, i) =>
    ema12[i] != null && ema26[i] != null
      ? (ema12[i] as number) - (ema26[i] as number)
      : null,
  );

  // Build DEA from DIF by treating nulls as gaps, then EMA on contiguous valid DIF values.
  const validDif: number[] = [];
  const validIndex: number[] = [];
  for (let i = 0; i < dif.length; i++) {
    if (dif[i] != null) {
      validDif.push(dif[i] as number);
      validIndex.push(i);
    }
  }
  const deaOnValid = ema(validDif, 9);
  const dea: (number | null)[] = Array(closes.length).fill(null);
  for (let j = 0; j < validIndex.length; j++) {
    dea[validIndex[j]] = deaOnValid[j];
  }

  const hist: (number | null)[] = dif.map((v, i) =>
    v != null && dea[i] != null ? v - (dea[i] as number) : null,
  );
  return { dif, dea, hist };
}

export type Analysis = {
  bias: "bullish" | "bearish" | "neutral";
  title: string;
  summary: string;
  points: string[];
  score: number;
};

export function analyze(candles: Candle[]): Analysis | null {
  if (candles.length < 30) return null;
  const closes = candles.map((c) => c.close);
  const volumes = candles.map((c) => c.volume);
  const ma20 = sma(closes, 20);
  const ma50 = sma(closes, Math.min(50, closes.length));
  const rsi14 = rsi(closes, 14);
  const { hist } = macd(closes);

  const last = closes.length - 1;
  const price = closes[last];
  const lastMa20 = ma20[last];
  const lastMa50 = ma50[last];
  const lastRsi = rsi14[last];
  const lastHist = hist[last];
  const prevHist = hist[last - 1];

  let score = 0;
  const points: string[] = [];

  if (lastMa20 != null) {
    if (price > lastMa20) {
      score += 1;
      points.push(`现价站上 20 日均线（${lastMa20.toFixed(2)}）`);
    } else {
      score -= 1;
      points.push(`现价跌破 20 日均线（${lastMa20.toFixed(2)}）`);
    }
  }

  if (lastMa20 != null && lastMa50 != null) {
    if (lastMa20 > lastMa50) {
      score += 1;
      points.push("均线呈多头排列（MA20 > MA50）");
    } else {
      score -= 1;
      points.push("均线呈空头排列（MA20 < MA50）");
    }
  }

  if (lastRsi != null) {
    if (lastRsi >= 70) {
      score -= 1;
      points.push(`RSI ${lastRsi.toFixed(1)}，进入超买区`);
    } else if (lastRsi <= 30) {
      score += 1;
      points.push(`RSI ${lastRsi.toFixed(1)}，进入超卖区`);
    } else if (lastRsi >= 55) {
      score += 0.5;
      points.push(`RSI ${lastRsi.toFixed(1)}，动能偏强`);
    } else if (lastRsi <= 45) {
      score -= 0.5;
      points.push(`RSI ${lastRsi.toFixed(1)}，动能偏弱`);
    } else {
      points.push(`RSI ${lastRsi.toFixed(1)}，中性区间`);
    }
  }

  if (lastHist != null && prevHist != null) {
    if (lastHist > 0 && lastHist > prevHist) {
      score += 1;
      points.push("MACD 柱线扩张，动量向上");
    } else if (lastHist < 0 && lastHist < prevHist) {
      score -= 1;
      points.push("MACD 柱线扩张，动量向下");
    } else if (lastHist > 0) {
      score += 0.5;
      points.push("MACD 柱线为正");
    } else {
      score -= 0.5;
      points.push("MACD 柱线为负");
    }
  }

  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const olderVol = volumes.slice(-20, -5).reduce((a, b) => a + b, 0) / 15;
  if (olderVol > 0) {
    const ratio = recentVol / olderVol;
    if (ratio > 1.4) {
      points.push(`近 5 日成交量放大约 ${(ratio * 100 - 100).toFixed(0)}%`);
      score += price >= closes[last - 5] ? 0.5 : -0.5;
    } else if (ratio < 0.7) {
      points.push("近 5 日成交量收缩，观望情绪上升");
    }
  }

  const change20 =
    closes.length > 20 ? ((price - closes[last - 20]) / closes[last - 20]) * 100 : 0;
  points.push(`近 20 个交易日涨跌约 ${change20 >= 0 ? "+" : ""}${change20.toFixed(1)}%`);

  let bias: Analysis["bias"] = "neutral";
  let title = "震荡观望";
  let summary = "多空力量接近，建议等待更明确的方向信号。";

  if (score >= 1.5) {
    bias = "bullish";
    title = "偏多";
    summary = "短线技术面偏强，趋势与动量同向向上，仍需留意回撤与超买风险。";
  } else if (score <= -1.5) {
    bias = "bearish";
    title = "偏空";
    summary = "短线技术面偏弱，均线与动量承压，反弹需放量确认。";
  }

  return { bias, title, summary, points: points.slice(0, 5), score };
}
