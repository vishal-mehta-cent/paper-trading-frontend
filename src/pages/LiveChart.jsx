// src/pages/LiveChart.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TradingViewChart from "../components/TradingViewChart";

const HTTP = import.meta.env.VITE_BACKEND_HTTP_BASE_URL || "http://127.0.0.1:8000";
const WSB  = import.meta.env.VITE_BACKEND_WS_BASE_URL   || "ws://127.0.0.1:8000";

const DEFAULTS = [{ label: "RELIANCE" }, { label: "TCS" }, { label: "INFY" }];
const FRAMES = ["1m", "5m", "15m", "1h", "1d"];

export default function LiveChart() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [timeframe, setTimeframe] = useState("1m");
  const [candles, setCandles] = useState([]);
  const wsRef = useRef(null);

  const selected = useMemo(
    () => DEFAULTS.find((s) => s.label === symbol) || { label: symbol },
    [symbol]
  );

  const connectWS = useCallback(() => {
    if (!("WebSocket" in window)) return;

    try {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
        wsRef.current = null;
      }
      const url = `${WSB}/marketdata/ws/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`;
      const sock = new WebSocket(url);
      wsRef.current = sock;

      sock.onopen = () => setCandles([]);
      sock.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "bootstrap" && Array.isArray(msg.candles)) {
            setCandles(msg.candles);
          } else if (msg.type === "candle" && msg.data) {
            setCandles((prev) => {
              if (!prev.length) return [msg.data];
              const last = prev[prev.length - 1];
              if (last.time === msg.data.time)
                return [...prev.slice(0, -1), msg.data];
              return [...prev, msg.data];
            });
          }
        } catch {}
      };
      sock.onerror = () => {};
      sock.onclose = () => {};
    } catch {
      // ignore (WS optional)
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    connectWS();
    return () => {
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [connectWS]);

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="border rounded px-2 py-1"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
        >
          {DEFAULTS.map((s) => (
            <option key={s.label} value={s.label}>
              {s.label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          {FRAMES.map((f) => (
            <button
              key={f}
              onClick={() => setTimeframe(f)}
              className={`px-2 py-1 rounded border ${
                timeframe === f ? "bg-blue-600 text-white" : ""
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <TradingViewChart symbol={selected.label} candles={candles} />
    </div>
  );
}
