"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type UTCTimestamp,
  ColorType,
  CrosshairMode,
} from "lightweight-charts";
import type { Candle } from "@/lib/indicators";
import { sma } from "@/lib/indicators";

type Props = {
  candles: Candle[];
  up: boolean;
};

export function PriceChart({ candles, up }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const ma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ma50Ref = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const chart = createChart(hostRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#4a6358",
        fontFamily: "var(--font-mono), ui-monospace, monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(36, 74, 62, 0.08)" },
        horzLines: { color: "rgba(36, 74, 62, 0.08)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#c23b2a",
      downColor: "#1f7a4c",
      borderUpColor: "#c23b2a",
      borderDownColor: "#1f7a4c",
      wickUpColor: "#c23b2a",
      wickDownColor: "#1f7a4c",
    });

    const ma20 = chart.addSeries(LineSeries, {
      color: "#9a7b3c",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const ma50 = chart.addSeries(LineSeries, {
      color: "#2a6b5a",
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    ma20Ref.current = ma20;
    ma50Ref.current = ma50;

    const ro = new ResizeObserver(() => {
      if (!hostRef.current) return;
      chart.applyOptions({
        width: hostRef.current.clientWidth,
        height: hostRef.current.clientHeight,
      });
    });
    ro.observe(hostRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !ma20Ref.current || !ma50Ref.current) return;

    const data: CandlestickData[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    candleSeriesRef.current.setData(data);

    const closes = candles.map((c) => c.close);
    const ma20Values = sma(closes, 20);
    const ma50Values = sma(closes, 50);

    const toLine = (values: (number | null)[]): LineData[] => {
      const out: LineData[] = [];
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v == null) continue;
        out.push({ time: candles[i].time as UTCTimestamp, value: v });
      }
      return out;
    };

    ma20Ref.current.setData(toLine(ma20Values));
    ma50Ref.current.setData(toLine(ma50Values));

    candleSeriesRef.current.applyOptions({
      upColor: "#c23b2a",
      downColor: "#1f7a4c",
      borderUpColor: "#c23b2a",
      borderDownColor: "#1f7a4c",
      wickUpColor: "#c23b2a",
      wickDownColor: "#1f7a4c",
    });

    chartRef.current?.timeScale().fitContent();
  }, [candles, up]);

  return (
    <div className="chart-shell">
      <div ref={hostRef} className="chart-canvas" />
      <div className="chart-legend">
        <span className="legend-ma20">MA20</span>
        <span className="legend-ma50">MA50</span>
      </div>
    </div>
  );
}
