// src/components/TradingChart.jsx
import React, { useEffect, useRef } from "react";
import { createChart } from "lightweight-charts";

/**
 * Candlestick wrapper for lightweight-charts.
 * props:
 *  - candles: [{ time, open, high, low, close }]
 *  - onReady?: ({ chart, series }) => void
 *  - dark?: boolean
 */
export default function TradingChart({ candles = [], onReady, dark = true }) {
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const roRef = useRef(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    // init
    const chart = createChart(el, {
      width: el.clientWidth || 900,
      height: el.clientHeight || 480,
      layout: {
        background: { color: dark ? "#0e1117" : "#ffffff" },
        textColor: dark ? "#d1d4dc" : "#333333",
      },
      grid: {
        vertLines: { color: dark ? "#2a2e39" : "#e6e6e6" },
        horzLines: { color: dark ? "#2a2e39" : "#e6e6e6" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, secondsVisible: false },
      crosshair: { mode: 1 },
    });

    const series = chart.addCandlestickSeries({
      upColor: "#16a34a",
      downColor: "#dc2626",
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
      borderUpColor: "#16a34a",
      borderDownColor: "#dc2626",
    });

    chartRef.current = chart;
    seriesRef.current = series;

    // resize observer
    const ro = new ResizeObserver(() => {
      if (!chartRef.current || !rootRef.current) return;
      chartRef.current.applyOptions({
        width: rootRef.current.clientWidth || 900,
        height: rootRef.current.clientHeight || 480,
      });
    });
    ro.observe(el);
    roRef.current = ro;

    // notify parent
    onReady?.({ chart, series });

    return () => {
      try { roRef.current?.disconnect(); } catch {}
      try { chartRef.current?.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [dark, onReady]);

  useEffect(() => {
    if (!seriesRef.current) return;
    if (!Array.isArray(candles) || candles.length === 0) {
      seriesRef.current.setData([]);
      return;
    }
    // expects { time: unixSec, o/h/l/c }
    const data = candles.map((c) => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    seriesRef.current.setData(data);
  }, [candles]);

  // Give the chart a real height so it’s always visible
  return <div ref={rootRef} style={{ width: "100%", height: 520 }} />;
}
