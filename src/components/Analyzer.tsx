"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { PriceChart } from "./PriceChart";
import { analyze } from "@/lib/indicators";
import type { ChartPayload, SearchHit } from "@/lib/types";
import { QUICK_PICKS, RANGES, type RangeKey } from "@/lib/symbols";
import { formatPct, formatPrice, formatSigned } from "@/lib/format";
import { useWatchlist } from "@/hooks/useWatchlist";

export function Analyzer() {
  const [symbol, setSymbol] = useState("600519.SH");
  const [range, setRange] = useState<RangeKey>("3mo");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [data, setData] = useState<ChartPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const watchlist = useWatchlist();

  const load = useCallback(async (sym: string, r: RangeKey) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/chart?symbol=${encodeURIComponent(sym)}&range=${r}`,
      );
      if (!res.ok) throw new Error("load failed");
      const json = (await res.json()) as ChartPayload;
      startTransition(() => {
        setData(json);
        setSymbol(json.quote.symbol);
      });
    } catch {
      setError("行情暂时不可用，请稍后再试");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(symbol, range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  useEffect(() => {
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const json = await res.json();
        setHits(json.results ?? []);
      } catch {
        setHits([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const analysis = useMemo(
    () => (data ? analyze(data.candles) : null),
    [data],
  );

  const up = (data?.quote.changePercent ?? 0) >= 0;

  function selectSymbol(next: string) {
    setQuery("");
    setHits([]);
    setSymbol(next);
    void load(next, range);
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-atmosphere" aria-hidden />
        <div className="hero-content">
          <p className="brand">潮尺</p>
          <h1 className="tagline">把行情量一量</h1>
          <p className="lede">专注 A 股与基金：搜代码、看走势、读短线技术面。</p>

          <div className="search-block">
            <label className="sr-only" htmlFor="symbol-search">
              搜索 A 股或基金
            </label>
            <input
              id="symbol-search"
              className="search-input"
              placeholder="输入代码或名称，如 茅台 / 510300 / 易方达"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
            />
            {hits.length > 0 && (
              <ul className="search-hits" role="listbox">
                {hits.map((hit) => (
                  <li key={hit.symbol}>
                    <button type="button" onClick={() => selectSymbol(hit.symbol)}>
                      <span className="hit-sym">{hit.symbol}</span>
                      <span className="hit-name">{hit.name}</span>
                      <span className="hit-ex">{hit.type || hit.exchange}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="quick-row" aria-label="热门标的">
            {QUICK_PICKS.map((p) => (
              <button
                key={p.symbol}
                type="button"
                className={`quick-chip ${symbol === p.symbol ? "active" : ""}`}
                onClick={() => selectSymbol(p.symbol)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="panel">
        {error && <p className="banner error">{error}</p>}
        {data?.source === "sample" && (
          <p className="banner sample">当前为示例数据（实时行情暂不可用）</p>
        )}

        <section className="quote-head" aria-live="polite">
          <div>
            <p className="sym">{data?.quote.symbol ?? symbol}</p>
            <p className="name">{data?.quote.name ?? "加载中…"}</p>
          </div>
          <div className={`price-block ${up ? "up" : "down"}`}>
            <p className={`price ${loading || pending ? "dim" : ""}`}>
              {data
                ? formatPrice(data.quote.price, data.quote.currency)
                : "—"}
            </p>
            <p className="delta">
              {data
                ? `${formatSigned(data.quote.change)} · ${formatPct(data.quote.changePercent)}`
                : ""}
            </p>
          </div>
          <button
            type="button"
            className={`watch-btn ${watchlist.has(symbol) ? "on" : ""}`}
            onClick={() => watchlist.toggle(symbol)}
            aria-pressed={watchlist.has(symbol)}
          >
            {watchlist.has(symbol) ? "已自选" : "加自选"}
          </button>
        </section>

        <div className="range-row" role="tablist" aria-label="时间范围">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              className={range === r.key ? "active" : ""}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>

        <section className="chart-section">
          {data ? (
            <PriceChart candles={data.candles} up={up} />
          ) : (
            <div className="chart-shell skeleton" />
          )}
        </section>

        {analysis && (
          <section className={`analysis bias-${analysis.bias}`}>
            <div className="analysis-top">
              <h2>技术面 · {analysis.title}</h2>
              <p>{analysis.summary}</p>
            </div>
            <ul>
              {analysis.points.map((pt) => (
                <li key={pt}>{pt}</li>
              ))}
            </ul>
            <p className="disclaimer">
              仅供参考，不构成投资建议。覆盖沪深京 A 股、场内 ETF 与场外基金净值；红涨绿跌。
            </p>
          </section>
        )}

        {watchlist.list.length > 0 && (
          <section className="watchlist">
            <h2>自选</h2>
            <div className="watch-row">
              {watchlist.list.map((s) => (
                <button key={s} type="button" onClick={() => selectSymbol(s)}>
                  {s}
                </button>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="site-foot">
        <span>潮尺 Tidegauge</span>
        <span>A 股 · 基金 · 公开行情</span>
      </footer>
    </div>
  );
}
