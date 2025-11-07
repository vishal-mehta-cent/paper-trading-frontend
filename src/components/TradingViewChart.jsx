// src/components/TradingViewChart.jsx
import React, { useEffect, useRef } from "react";
import * as LW from "lightweight-charts";

/**
 * Minimal, dependency-free candlestick chart.
 * Props:
 *  - symbol (unused here, but keep for parity)
 *  - candles: [{ time, open, high, low, close }]
 *  - dark: boolean
 */
export default function TradingViewChart({ symbol, candles = [], dark = false }) {
  const wrapRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    if (chartRef.current) {
      try { chartRef.current.remove(); } catch {}
      chartRef.current = null;
      seriesRef.current = null;
    }

    const chart = LW.createChart(el, {
      width: el.clientWidth || 800,
      height: 420,
      layout: {
        background: { type: "Solid", color: dark ? "#0e1117" : "#ffffff" },
        textColor: dark ? "#d1d4dc" : "#222222",
      },
      grid: {
        vertLines: { color: dark ? "#1f2530" : "rgba(42,46,57,0.1)" },
        horzLines: { color: dark ? "#1f2530" : "rgba(42,46,57,0.1)" },
      },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      rightPriceScale: { borderVisible: false },
    });

    // Prefer candlesticks. If missing (old build), fall back to area.
    const canCandle = typeof chart.addCandlestickSeries === "function";
    const series = canCandle
      ? chart.addCandlestickSeries({
          upColor: "#16a34a",
          downColor: "#dc2626",
          borderUpColor: "#16a34a",
          borderDownColor: "#dc2626",
          wickUpColor: "#16a34a",
          wickDownColor: "#dc2626",
        })
      : chart.addAreaSeries({ lineWidth: 2, priceLineVisible: true });

    chartRef.current = chart;
    seriesRef.current = series;

    const onResize = () => {
      if (!wrapRef.current || !chartRef.current) return;
      chartRef.current.applyOptions({ width: wrapRef.current.clientWidth || 800 });
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    return () => {
      ro.disconnect();
      try { chart.remove(); } catch {}
    };
  }, [dark, symbol]);

  useEffect(() => {
    if (!seriesRef.current) return;
    const data = Array.isArray(candles) ? candles : [];
    if (typeof seriesRef.current.setData === "function") {
      // If we’re on candlesticks, set OHLC. If area fallback, pass {time,value}
      const isCandle =
        seriesRef.current.priceScale && // not perfect, but good enough check
        typeof candles?.[0]?.open === "number";

      if (isCandle) {
        seriesRef.current.setData(
          data.map((c) => ({
            time: c.time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        );
      } else {
        seriesRef.current.setData(
          data.map((c) => ({ time: c.time, value: c.close ?? c.price ?? 0 }))
        );
      }
    }
  }, [candles]);

  return <div ref={wrapRef} style={{ width: "100%", height: 420 }} />;
}
