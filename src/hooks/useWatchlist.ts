"use client";

import { useEffect, useState } from "react";

const KEY = "tidegauge-watchlist";

export function useWatchlist() {
  const [list, setList] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setList(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }, [list]);

  function toggle(symbol: string) {
    setList((prev) =>
      prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [symbol, ...prev].slice(0, 12),
    );
  }

  return { list, toggle, has: (s: string) => list.includes(s) };
}
