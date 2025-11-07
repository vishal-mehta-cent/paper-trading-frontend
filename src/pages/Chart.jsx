// src/pages/Chart.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createChart, CrosshairMode } from "lightweight-charts";
import {
  Pencil, Info, Move3D, Minus, ArrowRight,
  GripVertical, Crosshair, LineChart,
  PencilRuler, AlignHorizontalJustifyStart, AlignHorizontalSpaceAround,
  AlignVerticalJustifyStart
} from "lucide-react";

const RayIcon = ArrowRight;

const API =
  (import.meta.env.VITE_BACKEND_BASE_URL || "http://127.0.0.1:8000")
    .trim()
    .replace(/\/+$/, "");

const HEADER_H = 56;
const TF_MIN = { "1m": 1, "5m": 5, "15m": 15, "1h": 60, "1d": 1440 };

/* ----------------------- math helpers ----------------------- */
const SMA = (arr, p) => {
  const out = Array(arr.length).fill(undefined);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i] ?? 0;
    if (i >= p) sum -= arr[i - p] ?? 0;
    if (i >= p - 1) out[i] = sum / p;
  }
  return out;
};
const EMA = (arr, p) => {
  const out = Array(arr.length).fill(undefined);
  const k = 2 / (p + 1);
  let prev;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v == null) continue;
    prev = prev == null ? v : (v - prev) * k + prev;
    out[i] = prev;
  }
  return out;
};

/* ----------------------- indicator builders ----------------------- */
const typical = (c) => (c.high + c.low + c.close) / 3;

function ATR(candles, period = 14) {
  const TR = [];
  for (let i = 0; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const highLow = cur.high - cur.low;
    const highClose = prev ? Math.abs(cur.high - prev.close) : 0;
    const lowClose = prev ? Math.abs(cur.low - prev.close) : 0;
    TR.push(Math.max(highLow, highClose, lowClose));
  }
  const out = Array(candles.length).fill(undefined);
  const alpha = 1 / period;
  let prev;
  for (let i = 0; i < TR.length; i++) {
    prev = prev == null ? TR[i] : prev + alpha * (TR[i] - prev);
    out[i] = prev;
  }
  return out;
}

function Supertrend(candles, period = 10, multiplier = 3) {
  const atr = ATR(candles, period);
  const basicU = candles.map((c, i) =>
    atr[i] != null ? (c.high + c.low) / 2 + multiplier * atr[i] : undefined
  );
  const basicL = candles.map((c, i) =>
    atr[i] != null ? (c.high + c.low) / 2 - multiplier * atr[i] : undefined
  );

  const finalU = Array(candles.length).fill(undefined);
  const finalL = Array(candles.length).fill(undefined);
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      finalU[i] = basicU[i];
      finalL[i] = basicL[i];
    } else {
      finalU[i] =
        basicU[i] < finalU[i - 1] || candles[i - 1].close > finalU[i - 1]
          ? basicU[i]
          : finalU[i - 1];
      finalL[i] =
        basicL[i] > finalL[i - 1] || candles[i - 1].close < finalL[i - 1]
          ? basicL[i]
          : finalL[i - 1];
    }
  }

  const trend = Array(candles.length).fill(undefined);
  let upTrend = true;
  for (let i = 0; i < candles.length; i++) {
    const close = candles[i].close;
    if (i === 0) {
      trend[i] = finalL[i];
      upTrend = true;
    } else {
      const prevUp = upTrend;
      const test = prevUp ? finalL[i] : finalU[i];
      const nextUp = close > test ? true : close < test ? false : prevUp;
      upTrend = nextUp;
      trend[i] = upTrend ? finalL[i] : finalU[i];
    }
  }
  return { trend, up: finalL, down: finalU };
}

function RSI(closes, period = 14) {
  const out = Array(closes.length).fill(undefined);
  let gain = 0, loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1];
    if (i <= period) {
      if (ch > 0) gain += ch; else loss -= Math.min(ch, 0);
      if (i === period) {
        const rs = loss === 0 ? 100 : gain / loss;
        out[i] = 100 - 100 / (1 + rs);
      }
    } else {
      gain = (gain * (period - 1) + Math.max(ch, 0)) / period;
      loss = (loss * (period - 1) + Math.max(-ch, 0)) / period;
      const rs = loss === 0 ? 100 : gain / loss;
      out[i] = 100 - 100 / (1 + rs);
    }
  }
  return out;
}

function StochRSI(closes, rsiPeriod = 14, stochPeriod = 14, dPeriod = 3) {
  const rsi = RSI(closes, rsiPeriod);
  const k = Array(closes.length).fill(undefined);
  for (let i = 0; i < closes.length; i++) {
    const s = Math.max(0, i - stochPeriod + 1);
    const win = rsi.slice(s, i + 1).filter(v => v != null);
    if (win.length < stochPeriod) continue;
    const min = Math.min(...win);
    const max = Math.max(...win);
    k[i] = max === min ? 50 : ((rsi[i] - min) / (max - min)) * 100;
  }
  const d = SMA(k, dPeriod);
  return { k, d };
}

function CCI(candles, period = 20) {
  const tp = candles.map(typical);
  const sma = SMA(tp, period);
  const out = Array(candles.length).fill(undefined);
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    const s = i - period + 1;
    const win = tp.slice(s, i + 1);
    const meanDev =
      win.reduce((acc, v) => acc + Math.abs(v - (sma[i] ?? 0)), 0) / period;
    out[i] = meanDev === 0 ? 0 : (tp[i] - (sma[i] ?? 0)) / (0.015 * meanDev);
  }
  return out;
}

function ADX(candles, period = 14) {
  const len = candles.length;
  const plusDM = Array(len).fill(0);
  const minusDM = Array(len).fill(0);
  const TR = Array(len).fill(0);

  for (let i = 1; i < len; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;
    plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;

    const highLow = candles[i].high - candles[i].low;
    const highClose = Math.abs(candles[i].high - candles[i - 1].close);
    const lowClose = Math.abs(candles[i].low - candles[i - 1].close);
    TR[i] = Math.max(highLow, highClose, lowClose);
  }

  const smooth = (arr, p) => {
    const out = Array(len).fill(undefined);
    let prev;
    for (let i = 0; i < len; i++) {
      const v = arr[i];
      if (i === 0) { out[i] = undefined; continue; }
      if (i < p) { out[i] = undefined; continue; }
      if (i === p) {
        let sum = 0;
        for (let j = 1; j <= p; j++) sum += arr[j];
        prev = sum;
        out[i] = prev;
      } else {
        prev = prev - prev / p + v;
        out[i] = prev;
      }
    }
    return out;
  };

  const TRs = smooth(TR, period);
  const plusDMs = smooth(plusDM, period);
  const minusDMs = smooth(minusDM, period);

  const plusDI = Array(len).fill(undefined);
  const minusDI = Array(len).fill(undefined);
  for (let i = 0; i < len; i++) {
    if (!TRs[i]) continue;
    plusDI[i] = 100 * (plusDMs[i] / TRs[i]);
    minusDI[i] = 100 * (minusDMs[i] / TRs[i]);
  }

  const DX = Array(len).fill(undefined);
  for (let i = 0; i < len; i++) {
    if (plusDI[i] == null || minusDI[i] == null) continue;
    DX[i] = (100 * Math.abs(plusDI[i] - minusDI[i])) / (plusDI[i] + minusDI[i]);
  }
  const adx = EMA(DX.filter(v => v != null), period);
  const fullADX = Array(len).fill(undefined);
  let k = 0;
  for (let i = 0; i < len; i++) {
    if (DX[i] != null) fullADX[i] = adx[k++];
  }
  return { plusDI, minusDI, adx: fullADX };
}

function Bollinger(closes, period = 20, mult = 2) {
  const ma = SMA(closes, period);
  const upper = Array(closes.length).fill(undefined);
  const lower = Array(closes.length).fill(undefined);
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1 || ma[i] == null) continue;
    const s = i - period + 1;
    const win = closes.slice(s, i + 1);
    const mean = ma[i];
    const variance = win.reduce((a, v) => a + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  const pctB = closes.map((c, i) =>
    upper[i] != null && lower[i] != null ? ((c - lower[i]) / (upper[i] - lower[i])) : undefined
  );
  const width = upper.map((u, i) =>
    u != null && lower[i] != null && ma[i] != null ? (u - lower[i]) / (ma[i] || 1) : undefined
  );
  return { ma, upper, lower, pctB, width };
}

function Aroon(candles, period = 25) {
  const up = Array(candles.length).fill(undefined);
  const down = Array(candles.length).fill(undefined);
  const osc = Array(candles.length).fill(undefined);
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) continue;
    const s = i - period + 1;
    let maxH = -Infinity, maxIdx = s;
    let minL = Infinity, minIdx = s;
    for (let j = s; j <= i; j++) {
      if (candles[j].high >= maxH) { maxH = candles[j].high; maxIdx = j; }
      if (candles[j].low <= minL) { minL = candles[j].low; minIdx = j; }
    }
    up[i] = ((period - (i - maxIdx)) / period) * 100;
    down[i] = ((period - (i - minIdx)) / period) * 100;
    osc[i] = (up[i] ?? 0) - (down[i] ?? 0);
  }
  return { up, down, osc };
}

function BOP(candles) {
  return candles.map(c =>
    c.high !== c.low ? (c.close - c.open) / (c.high - c.low) : 0
  );
}

function ADLine(candles) {
  let cum = 0;
  const out = [];
  for (const c of candles) {
    const vol = c.volume ?? 1;
    const mfm =
      c.high === c.low ? 0 : ((c.close - c.low) - (c.high - c.close)) / (c.high - c.low);
    cum += mfm * vol;
    out.push(cum);
  }
  return out;
}

function AO_AC(candles) {
  const med = candles.map(c => (c.high + c.low) / 2);
  const sma5 = SMA(med, 5);
  const sma34 = SMA(med, 34);
  const ao = med.map((_, i) =>
    sma5[i] != null && sma34[i] != null ? sma5[i] - sma34[i] : undefined
  );
  const aoSMA5 = SMA(ao, 5);
  const ac = ao.map((v, i) =>
    v != null && aoSMA5[i] != null ? v - aoSMA5[i] : undefined
  );
  return { ao, ac };
}

function highLow52w(candles, bars = 252) {
  const hi = Array(candles.length).fill(undefined);
  const lo = Array(candles.length).fill(undefined);
  for (let i = 0; i < candles.length; i++) {
    const s = Math.max(0, i - bars + 1);
    let H = -Infinity, L = Infinity;
    for (let j = s; j <= i; j++) {
      if (candles[j].high > H) H = candles[j].high;
      if (candles[j].low < L) L = candles[j].low;
    }
    hi[i] = H; lo[i] = L;
  }
  return { hi, lo };
}

function AvgPrice(candles, period = 14) {
  const base = candles.map(c => (c.high + c.low + c.close) / 3);
  return EMA(base, period);
}

/* ---------------- transforms for extra chart types ---------------- */
function toHeikinAshi(ohlc) {
  const out = [];
  let prevOpen, prevClose;
  for (let i = 0; i < ohlc.length; i++) {
    const c = ohlc[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? (c.open + c.close) / 2 : (prevOpen + prevClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);
    out.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose, volume: c.volume });
    prevOpen = haOpen; prevClose = haClose;
  }
  return out;
}
function toHLCBars(ohlc) {
  const mid = (h, l) => (h + l) / 2;
  return ohlc.map(c => ({ time: c.time, open: mid(c.high, c.low), high: c.high, low: c.low, close: mid(c.high, c.low), volume: c.volume }));
}

/* ----------------------- Indicators list ----------------------- */
const INDICATORS = [
  { key: "hi52",       label: "52 Week High/Low", where: "main" },
  { key: "avgprice",   label: "Average Price",    where: "main" },
  { key: "bbands",     label: "Bollinger Bands",  where: "main" },
  { key: "bb_pctb",    label: "Bollinger %B",     where: "osc"  },
  { key: "bb_width",   label: "Bollinger Width",  where: "osc"  },
  { key: "adx",        label: "ADX (+DI/−DI)",    where: "osc"  },
  { key: "aroon",      label: "Aroon (Up/Down/OSC)", where: "osc" },
  { key: "adline",     label: "Accumulation/Distribution", where: "osc" },
  { key: "bop",        label: "Balance of Power", where: "osc"  },
  { key: "cci",        label: "CCI",              where: "osc"  },
  { key: "rsi_stoch",  label: "Stoch RSI",        where: "osc"  },
  { key: "ao",         label: "Awesome Oscillator", where: "osc" },
  { key: "ac",         label: "Accelerator Oscillator", where: "osc" },
  { key: "supertrend", label: "Supertrend",       where: "main" },
];

/* ----------------------- Drawing tools config ----------------------- */
const DRAW_TOOLS = [
  {
    group: "Lines",
    items: [
      { key: "trend",       label: "Trend Line",        icon: PencilRuler, hotkey: "Alt+T" },
      { key: "ray",         label: "Ray",               icon: RayIcon },
      { key: "info",        label: "Info Line",         icon: Info },
      { key: "extended",    label: "Extended Line",     icon: Move3D },
      { key: "hline",       label: "Horizontal Line",   icon: AlignHorizontalJustifyStart, hotkey: "Alt+H" },
      { key: "hray",        label: "Horizontal Ray",    icon: AlignHorizontalSpaceAround,  hotkey: "Alt+J" },
      { key: "vline",       label: "Vertical Line",     icon: AlignVerticalJustifyStart,   hotkey: "Alt+V" },
      { key: "cross",       label: "Cross Line",        icon: Crosshair,                   hotkey: "Alt+C" },
    ],
  },
];

/* ---------------- Chart type menu (TV-like) ---------------- */
const CHART_GROUPS = [
  {
    title: "Bars / Candles",
    items: [
      { key: "bars",      label: "Bars",              type: "bar",          supported: true },
      { key: "candles",   label: "Candles",           type: "candlestick",  supported: true },
      { key: "hollow",    label: "Hollow candles",    type: "hollow",       supported: true },
      { key: "vcandles",  label: "Volume candles",    type: "vcandles",     supported: false },
      { key: "hlc",       label: "HLC bars",          type: "hlc",          supported: true },
    ],
  },
  {
    title: "Lines",
    items: [
      { key: "line",      label: "Line",              type: "line",         supported: true },
      { key: "linemk",    label: "Line with markers", type: "linemk",       supported: true },
      { key: "step",      label: "Step line",         type: "step",         supported: true },
    ],
  },
  {
    title: "Areas / Columns / HL",
    items: [
      { key: "area",      label: "Area",              type: "area",         supported: true },
      { key: "baseline",  label: "Baseline",          type: "baseline",     supported: true },
      { key: "columns",   label: "Columns",           type: "hist",         supported: true },
      { key: "highlow",   label: "High-low",          type: "highlow",      supported: true },
    ],
  },
  {
    title: "Price-transforms",
    items: [
      { key: "heikin",    label: "Heikin Ashi",       type: "heikin",       supported: true },
      { key: "renko",     label: "Renko",             type: "renko",        supported: false },
      { key: "linebreak", label: "Line break",        type: "linebreak",    supported: false },
      { key: "kagi",      label: "Kagi",              type: "kagi",         supported: false },
      { key: "pnf",       label: "Point & figure",    type: "pnf",          supported: false },
    ],
  },
];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export default function ChartPage() {
  const { symbol: rawSym } = useParams();
  const symbol = useMemo(() => (rawSym || "").toUpperCase(), [rawSym]);
  const navigate = useNavigate();

  const [tf, setTf] = useState("1m");
  const [lastPrice, setLastPrice] = useState(null);
  const [status, setStatus] = useState("loading");

  const [openIndModal, setOpenIndModal] = useState(false);
  const [active, setActive] = useState(() =>
    Object.fromEntries(INDICATORS.map(i => [i.key, false]))
  );

  const mainRef = useRef(null);
  const overlayRef = useRef(null);
  const oscRef = useRef(null);
  const mainChart = useRef(null);
  const oscChart = useRef(null);
  const priceSeries = useRef(null);
  const volSeries = useRef(null);

  // ▶ INDICATORS — series managers
  const indSeriesMain = useRef({});   // ✨ ADDED
  const indSeriesOsc  = useRef({});   // ✨ ADDED

  const tfSec = useMemo(() => TF_MIN[tf] * 60, [tf]);

  /* ---------- chart type state & anchored dropdown ---------- */
  const [chartType, setChartType] = useState({ type: "candlestick" });
  const [ctOpen, setCtOpen] = useState(false);
  const ctWrapRef = useRef(null);
  const ctMenuRef = useRef(null);
  const [ctPos, setCtPos] = useState({ top: 0, left: 0 });

  const updateCtPos = useCallback(() => {
    if (!ctWrapRef.current) return;
    const rect = ctWrapRef.current.getBoundingClientRect();
    const gap = 6;
    const menuW = 260;
    const vw = window.innerWidth;
    let left = rect.left;
    if (left + menuW + 8 > vw) left = Math.max(8, vw - menuW - 8);
    setCtPos({ top: rect.bottom + gap, left });
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!ctOpen) return;
      if (!ctWrapRef.current) return;
      const within =
        ctWrapRef.current.contains(e.target) ||
        (ctMenuRef.current && ctMenuRef.current.contains(e.target));
      if (!within) setCtOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [ctOpen]);

  useEffect(() => {
    if (!ctOpen) return;
    const recalc = () => updateCtPos();
    window.addEventListener("resize", recalc);
    window.addEventListener("scroll", recalc, true);
    updateCtPos();
    return () => {
      window.removeEventListener("resize", recalc);
      window.removeEventListener("scroll", recalc, true);
    };
  }, [ctOpen, updateCtPos]);

  /* ---------------- Draw state ---------------- */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTool, setActiveTool] = useState(null);
  const [redrawTick, setRedrawTick] = useState(0);

  // each drawing: {tool, points:[{time,price, px?:{x,y}}], done}
  const drawingsRef = useRef([]);
  const draggingRef = useRef(false); // ✨ ADDED

  /* ---------------- Fetch candles ---------------- */
  const [candles, setCandles] = useState([]);

  const mapDataForType = (t, rows) => {
    if (!rows || !rows.length) return [];
    if (t === "heikin") return toHeikinAshi(rows);
    if (t === "hlc" || t === "highlow") return toHLCBars(rows);
    return rows;
  };

  /* ---------------- Build charts ---------------- */
  useEffect(() => {
    if (mainChart.current) { try { mainChart.current.remove(); } catch {} mainChart.current = null; }
    if (oscChart.current)  { try { oscChart.current.remove();  } catch {} oscChart.current  = null; }

    const main = createChart(mainRef.current, {
      width: mainRef.current.clientWidth,
      height: Math.max(320, Math.floor((window.innerHeight - HEADER_H) * 0.68)),
      layout: { textColor: "#222", background: { type: "Solid", color: "#ffffff" } },
      grid: { vertLines: { color: "rgba(42,46,57,0.1)" }, horzLines: { color: "rgba(42,46,57,0.1)" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
    });

    let series;
    const t = chartType.type;
    if (t === "candlestick" || t === "heikin" || t === "hollow") {
      const opts =
        t === "hollow"
          ? {
              upColor: "rgba(0,0,0,0)",
              downColor: "#dc2626",
              borderUpColor: "#16a34a",
              borderDownColor: "#dc2626",
              wickUpColor: "#16a34a",
              wickDownColor: "#dc2626",
            }
          : {
              upColor: "#16a34a", downColor: "#dc2626",
              borderUpColor: "#16a34a", borderDownColor: "#dc2626",
              wickUpColor: "#16a34a", wickDownColor: "#dc2626",
            };
      series = main.addCandlestickSeries(opts);
    } else if (t === "bar" || t === "hlc" || t === "highlow") {
      series = main.addBarSeries({});
    } else if (t === "line" || t === "linemk" || t === "step") {
      series = main.addLineSeries({ lineWidth: 2, lineType: t === "step" ? 1 : 0 });
    } else if (t === "area") {
      series = main.addAreaSeries({});
    } else if (t === "baseline") {
      series = main.addBaselineSeries({});
    } else {
      series = main.addHistogramSeries({ base: 0 });
    }

    const vol = main.addHistogramSeries({
      priceScaleId: "",
      priceFormat: { type: "volume" },
      color: "rgba(31, 119, 180, 0.5)",
      lineWidth: 1,
      priceLineVisible: false,
      overlay: true,
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    mainChart.current = main;
    priceSeries.current = series;
    volSeries.current = vol;

    if (Array.isArray(candles) && candles.length) {
      const dataToUse = mapDataForType(t, candles);
      if (t === "hist" || t === "line" || t === "linemk" || t === "step" || t === "area" || t === "baseline") {
        series.setData(dataToUse.map(d => ({ time: d.time, value: d.close })));
      } else {
        series.setData(dataToUse.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));
      }
      vol.setData(dataToUse.map(d => ({ time: d.time, value: d.volume ?? 0 })));
    }

    const osc = createChart(oscRef.current, {
      width: oscRef.current.clientWidth,
      height: Math.max(200, Math.floor((window.innerHeight - HEADER_H) * 0.32) - 8),
      layout: { textColor: "#222", background: { type: "Solid", color: "#ffffff" } },
      grid: { vertLines: { color: "rgba(42,46,57,0.1)" }, horzLines: { color: "rgba(42,46,57,0.1)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });
    oscChart.current = osc;

    const sync = () => {
      const lr = main.timeScale().getVisibleLogicalRange();
      if (!lr || lr.from == null || lr.to == null) return;
      try { osc.timeScale().setVisibleLogicalRange(lr); } catch {}
    };
    main.timeScale().subscribeVisibleLogicalRangeChange(sync);

    const handleResize = () => {
      if (!mainChart.current || !oscChart.current) return;
      mainChart.current.applyOptions({
        width: mainRef.current.clientWidth,
        height: Math.max(320, Math.floor((window.innerHeight - HEADER_H) * 0.68)),
      });
      oscChart.current.applyOptions({
        width: oscRef.current.clientWidth,
        height: Math.max(200, Math.floor((window.innerHeight - HEADER_H) * 0.32) - 8),
      });
      setRedrawTick(t => t + 1);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [symbol, tf, chartType, candles]);

  /* ---------------- Fetch candles ---------------- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      setCandles([]);
      try {
        const url = `${API}/market/ohlc?symbol=${encodeURIComponent(symbol)}&interval=${tf}&limit=500`;
        const r = await fetch(url);
        if (!r.ok) throw new Error("fetch failed");
        const data = await r.json();
        if (cancelled) return;

        const setAll = (rows) => {
          setCandles(rows);
          const t = chartType.type;
          const dataToUse = mapDataForType(t, rows);
          if (t === "hist" || t === "line" || t === "linemk" || t === "step" || t === "area" || t === "baseline") {
            priceSeries.current?.setData(dataToUse.map(d => ({ time: d.time, value: d.close })));
          } else {
            priceSeries.current?.setData(dataToUse.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));
          }
          volSeries.current?.setData(dataToUse.map(d => ({ time: d.time, value: d.volume ?? 0 })));
          setLastPrice(rows[rows.length - 1]?.close ?? null);
          setStatus("live");
        };

        if (Array.isArray(data) && data.length) {
          setAll(data);
        } else {
          const now = Math.floor(Date.now() / 1000);
          const seed = [];
          let base = 100;
          for (let i = 60; i > 0; i--) {
            const t = now - i * tfSec;
            seed.push({ time: t, open: base, high: base, low: base, close: base, volume: 0 });
          }
          setAll(seed);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [API, symbol, tf, tfSec, chartType]);

  /* ---------------- Overlay drawing helpers ---------------- */
  const pickTool = (key) => {
    setActiveTool(key);
    setDrawerOpen(false);
  };

  const toChartPoint = useCallback((evt) => {
    if (!mainChart.current || !priceSeries.current || !overlayRef.current) return null;
    const rect = overlayRef.current.getBoundingClientRect();
    const x = clamp(evt.clientX - rect.left, 0, rect.width);
    const y = clamp(evt.clientY - rect.top,  0, rect.height);

    const time = mainChart.current.timeScale().coordinateToTime(x);
    const price = priceSeries.current.coordinateToPrice(y); // use series mapping

    return { time: time ?? null, price: price ?? null, px: { x, y } };
  }, []);

  const pushPoint = (pt) => {
    const d = drawingsRef.current[drawingsRef.current.length - 1];
    if (!d || d.tool !== activeTool || d.done) {
      drawingsRef.current.push({ tool: activeTool, points: [pt], done: false });
    } else {
      d.points.push(pt);
      if (["hline", "hray", "vline", "cross"].includes(activeTool)) d.done = true;
      if (["trend", "ray", "info", "extended"].includes(activeTool) && d.points.length >= 2) d.done = true;
    }
    setRedrawTick(t => t + 1);
  };

  const onPointerDown = (e) => {
    if (!activeTool) return;
    const p = toChartPoint(e);
    if (!p) return;
    pushPoint(p);
    draggingRef.current = true;
  };

  const onPointerMove = (e) => {
    if (!activeTool) return;
    const d = drawingsRef.current[drawingsRef.current.length - 1];
    if (!d || d.tool !== activeTool || d.done) return;
    const p = toChartPoint(e);
    if (!p) return;
    if (d.points.length === 1 || draggingRef.current) {
      d.points[1] = p; // live preview
      setRedrawTick(t => t + 1);
    }
  };

  const onPointerUp = () => {
    if (!activeTool) return;
    const d = drawingsRef.current[drawingsRef.current.length - 1];
    if (d && d.tool === activeTool && !d.done && d.points.length >= 2) {
      d.done = true;
      setRedrawTick(t => t + 1);
    }
    draggingRef.current = false;
  };

  const clearLast = () => { drawingsRef.current.pop(); setRedrawTick(t => t + 1); };
  const clearAll  = () => { drawingsRef.current = [];   setRedrawTick(t => t + 1); };

  /* ---------------- Left toolbar ---------------- */
  const LeftRail = () => (
    <div className="fixed left-2 top-[72px] z-[9993] select-none">
      <div className="bg-white/95 border rounded-xl shadow-lg p-1 flex flex-col gap-1">
        <button
          className={`w-9 h-9 grid place-items-center rounded-md hover:bg-gray-100 ${drawerOpen ? "bg-gray-100" : ""}`}
          title="Draw Tools"
          onClick={() => setDrawerOpen(o => !o)}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button className="w-9 h-9 grid place-items-center rounded-md hover:bg-gray-100" title="Undo last" onClick={clearLast}>
          <Minus className="w-4 h-4" />
        </button>
        <button className="w-9 h-9 grid place-items-center rounded-md hover:bg-gray-100" title="Clear drawings" onClick={clearAll}>
          <GripVertical className="w-4 h-4 rotate-90" />
        </button>
      </div>

      {drawerOpen && (
        <div className="absolute left-11 top-0 bg-white/95 border rounded-xl shadow-xl p-2 w-[260px]">
          <div className="mb-2">
            <div className="px-2 pb-1 text-[11px] uppercase tracking-wide text-gray-500">Lines</div>
            {DRAW_TOOLS[0].items.map((it) => {
              const Icon = it.icon || LineChart;
              const activeCls = activeTool === it.key ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50";
              return (
                <button
                  key={it.key}
                  onClick={() => pickTool(it.key)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm border rounded-md ${activeCls}`}
                  title={it.label}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{it.label}</span>
                  {it.hotkey && <span className="text-[10px] text-gray-500">{it.hotkey}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  /* --------------- Chart Type dropdown --------------- */
  const ChartTypeDropdown = () => {
    const currentLabel = (() => {
      for (const g of CHART_GROUPS) for (const it of g.items) if (it.supported && it.type === chartType.type) return it.label;
      return "Candles";
    })();
    const pickType = (it) => { if (!it.supported) return; setChartType({ type: it.type }); setCtOpen(false); };
    return (
      <div ref={ctWrapRef} className="relative">
        <button onClick={() => { setCtOpen(o => !o); setTimeout(updateCtPos, 0); }} className="text-xs px-2 py-1 rounded border whitespace-nowrap flex items-center gap-2">
          <LineChart className="w-4 h-4" /> {currentLabel} <span className="ml-1">▾</span>
        </button>
        {ctOpen && (
          <div ref={ctMenuRef} style={{ position: "fixed", top: ctPos.top, left: ctPos.left }} className="z-[10000] w-64 bg-white border rounded-lg shadow-lg p-1">
            {CHART_GROUPS.map((grp, gi) => (
              <div key={gi} className="py-1">
                <div className="px-2 py-1 text-[11px] uppercase tracking-wide text-gray-500">{grp.title}</div>
                {grp.items.map((it) => {
                  const disabled = !it.supported;
                  const active = !disabled && it.type === chartType.type;
                  return (
                    <button key={it.key} disabled={disabled} onClick={() => pickType(it)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm ${disabled ? "opacity-40 cursor-not-allowed" : active ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"}`}>
                      <LineChart className="w-4 h-4" />
                      <span className="flex-1 text-left">{it.label}</span>
                    </button>
                  );
                })}
                {gi < CHART_GROUPS.length - 1 && <div className="my-1 border-t" />}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ---------------- Overlay SVG (draws the lines) ---------------- */
  const OverlaySVG = () => {
    const chart = mainChart.current;
    const series = priceSeries.current;
    if (!overlayRef.current) return null;

    const w = overlayRef.current.clientWidth || 0;
    const h = overlayRef.current.clientHeight || 0;

    const timeToX = (t) => (chart && t != null) ? chart.timeScale().timeToCoordinate(t) : null;
    const priceToY = (p) => (series && p != null) ? series.priceToCoordinate(p) : null;

    const addLine = (x1, y1, x2, y2, dash=false) => (
      <line x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={dash ? "#64748b" : "#0ea5e9"} strokeWidth={2} strokeDasharray={dash ? "6 4" : "0"} />
    );

    const items = [];
    const ensureXY = (pt) => {
      const x = timeToX(pt.time);
      const y = priceToY(pt.price);
      if (x == null || y == null) return pt.px ? { x: pt.px.x, y: pt.px.y } : null;
      return { x, y };
    };

    for (const dr of drawingsRef.current) {
      const P = dr.points.map(ensureXY).filter(Boolean);
      if (!P.length) continue;

      if (dr.tool === "trend" && P.length >= 2) items.push(addLine(P[0].x, P[0].y, P[1].x, P[1].y));
      if (dr.tool === "ray" && P.length >= 2) {
        const a = P[0], b = P[1];
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) < 1e-6) items.push(addLine(a.x, 0, a.x, h));
        else {
          const m = dy / dx;
          const y0 = a.y - m * (a.x - 0);
          const yW = a.y + m * (w - a.x);
          items.push(addLine(0, y0, w, yW));
        }
      }
      if (dr.tool === "extended" && P.length >= 2) {
        const a = P[0], b = P[1];
        const dx = b.x - a.x, dy = b.y - a.y;
        if (Math.abs(dx) < 1e-6) items.push(addLine(a.x, 0, a.x, h, true));
        else {
          const m = dy / dx;
          const y0 = a.y - m * (a.x - 0);
          const yW = a.y + m * (w - a.x);
          items.push(addLine(0, y0, w, yW, true));
        }
      }
      if (dr.tool === "hline") { const y = P[0].y; items.push(addLine(0, y, w, y)); }
      if (dr.tool === "hray" && P.length >= 2) {
        const y = P[0].y; const x2 = P[1].x >= P[0].x ? w : 0; items.push(addLine(P[0].x, y, x2, y));
      }
      if (dr.tool === "vline") { const x = P[0].x; items.push(addLine(x, 0, x, h)); }
      if (dr.tool === "cross") { const x = P[0].x, y = P[0].y; items.push(addLine(0, y, w, y, true)); items.push(addLine(x, 0, x, h, true)); }

      if (!dr.done && P.length === 1 && activeTool) {
        items.push(<circle cx={P[0].x} cy={P[0].y} r={3} fill="#0ea5e9" />);
      }
    }

    return <svg width={w} height={h} style={{ display: "block" }}>{items.map((el, i) => React.cloneElement(el, { key: i }))}</svg>;
  };

  /* ▶ INDICATORS: create/update series when toggled or data changes */
  const removeAllIndicatorSeries = useCallback(() => {             // ✨ ADDED
    const rm = (obj) => {
      Object.values(obj).forEach((arr) => {
        if (Array.isArray(arr)) arr.forEach(s => { try { s && s.priceScaleId && s; } catch {} });
        if (arr && arr.remove) { try { arr.remove(); } catch {} }
        if (Array.isArray(arr)) arr.forEach(s => { try { s.remove(); } catch {} });
      });
    };
    // remove safely
    Object.values(indSeriesMain.current).flat().forEach(s => { try { s.remove(); } catch {} });
    Object.values(indSeriesOsc.current).flat().forEach(s => { try { s.remove(); } catch {} });
    indSeriesMain.current = {};
    indSeriesOsc.current = {};
  }, []);

  const updateIndicators = useCallback(() => {                      // ✨ ADDED
    if (!mainChart.current || !oscChart.current || !candles.length) return;

    // clean before re-adding
    Object.values(indSeriesMain.current).flat().forEach(s => { try { s.remove(); } catch {} });
    Object.values(indSeriesOsc.current).flat().forEach(s => { try { s.remove(); } catch {} });
    indSeriesMain.current = {};
    indSeriesOsc.current = {};

    const main = mainChart.current;
    const osc  = oscChart.current;

    const closes = candles.map(c => c.close);
    const times  = candles.map(c => c.time);

    // helper creators
    const addMainLine = (color="#0ea5e9", width=1) =>
      main.addLineSeries({ color, lineWidth: width, priceLineVisible:false, crosshairMarkerVisible:false });

    const addOscLine = (color="#0ea5e9", width=1) =>
      osc.addLineSeries({ color, lineWidth: width, priceLineVisible:false, crosshairMarkerVisible:false });

    const addOscHist = (color="#64748b") =>
      osc.addHistogramSeries({ color, priceLineVisible:false, base:0 });

    // ---- Overlays ----
    if (active.hi52) {
      const { hi, lo } = highLow52w(candles, 252);
      const sHi = addMainLine("#f59e0b", 1);
      const sLo = addMainLine("#10b981", 1);
      sHi.setData(times.map((t,i)=> hi[i]==null? null : { time:t, value:hi[i] }).filter(Boolean));
      sLo.setData(times.map((t,i)=> lo[i]==null? null : { time:t, value:lo[i] }).filter(Boolean));
      indSeriesMain.current.hi52 = [sHi, sLo];
    }

    if (active.avgprice) {
      const avg = AvgPrice(candles, 14);
      const s = addMainLine("#3b82f6", 2);
      s.setData(times.map((t,i)=> avg[i]==null? null : { time:t, value:avg[i] }).filter(Boolean));
      indSeriesMain.current.avgprice = [s];
    }

    if (active.bbands || active.bb_pctb || active.bb_width) {
      const { ma, upper, lower, pctB, width } = Bollinger(closes, 20, 2);

      if (active.bbands) {
        const sU = addMainLine("#0ea5e9", 1);
        const sM = addMainLine("#6366f1", 1);
        const sL = addMainLine("#0ea5e9", 1);
        sU.setData(times.map((t,i)=> upper[i]==null? null : { time:t, value:upper[i] }).filter(Boolean));
        sM.setData(times.map((t,i)=> ma[i]==null? null : { time:t, value:ma[i] }).filter(Boolean));
        sL.setData(times.map((t,i)=> lower[i]==null? null : { time:t, value:lower[i] }).filter(Boolean));
        indSeriesMain.current.bbands = [sU,sM,sL];
      }
      if (active.bb_pctb) {
        const s = addOscLine("#10b981", 2);
        s.setData(times.map((t,i)=> pctB[i]==null? null : { time:t, value:pctB[i]*100 }).filter(Boolean));
        indSeriesOsc.current.bb_pctb = [s];
      }
      if (active.bb_width) {
        const s = addOscLine("#f59e0b", 2);
        s.setData(times.map((t,i)=> width[i]==null? null : { time:t, value:width[i] }).filter(Boolean));
        indSeriesOsc.current.bb_width = [s];
      }
    }

    if (active.supertrend) {
      const { trend } = Supertrend(candles, 10, 3);
      const s = addMainLine("#22c55e", 2);
      s.setData(times.map((t,i)=> trend[i]==null? null : { time:t, value:trend[i] }).filter(Boolean));
      indSeriesMain.current.supertrend = [s];
    }

    // ---- Oscillators ----
    if (active.adx) {
      const { plusDI, minusDI, adx } = ADX(candles, 14);
      const s1 = addOscLine("#22c55e", 1); // +DI
      const s2 = addOscLine("#ef4444", 1); // -DI
      const s3 = addOscLine("#3b82f6", 2); // ADX
      s1.setData(times.map((t,i)=> plusDI[i]==null? null : { time:t, value:plusDI[i] }).filter(Boolean));
      s2.setData(times.map((t,i)=> minusDI[i]==null? null : { time:t, value:minusDI[i] }).filter(Boolean));
      s3.setData(times.map((t,i)=> adx[i]==null? null : { time:t, value:adx[i] }).filter(Boolean));
      indSeriesOsc.current.adx = [s1,s2,s3];
    }

    if (active.aroon) {
      const { up, down, osc:arOsc } = Aroon(candles, 25);
      const s1 = addOscLine("#22c55e", 1);
      const s2 = addOscLine("#ef4444", 1);
      const s3 = addOscLine("#6366f1", 2);
      s1.setData(times.map((t,i)=> up[i]==null? null : { time:t, value:up[i] }).filter(Boolean));
      s2.setData(times.map((t,i)=> down[i]==null? null : { time:t, value:down[i] }).filter(Boolean));
      s3.setData(times.map((t,i)=> arOsc[i]==null? null : { time:t, value:arOsc[i] }).filter(Boolean));
      indSeriesOsc.current.aroon = [s1,s2,s3];
    }

    if (active.adline) {
      const ad = ADLine(candles);
      const s = addOscLine("#0ea5e9", 2);
      s.setData(times.map((t,i)=> ({ time:t, value:ad[i] })));
      indSeriesOsc.current.adline = [s];
    }

    if (active.bop) {
      const bop = BOP(candles);
      const s = addOscHist("#64748b");
      s.setData(times.map((t,i)=> ({ time:t, value:bop[i] ?? 0 })));
      indSeriesOsc.current.bop = [s];
    }

    if (active.cci) {
      const cci = CCI(candles, 20);
      const s = addOscLine("#f59e0b", 2);
      s.setData(times.map((t,i)=> cci[i]==null? null : { time:t, value:cci[i] }).filter(Boolean));
      indSeriesOsc.current.cci = [s];
    }

    if (active.rsi_stoch) {
      const { k, d } = StochRSI(closes, 14, 14, 3);
      const s1 = addOscLine("#22c55e", 2);
      const s2 = addOscLine("#3b82f6", 1);
      s1.setData(times.map((t,i)=> k[i]==null? null : { time:t, value:k[i] }).filter(Boolean));
      s2.setData(times.map((t,i)=> d[i]==null? null : { time:t, value:d[i] }).filter(Boolean));
      indSeriesOsc.current.rsi_stoch = [s1,s2];
    }

    if (active.ao || active.ac) {
      const { ao, ac } = AO_AC(candles);
      if (active.ao) {
        const s = addOscHist("#06b6d4");
        s.setData(times.map((t,i)=> ao[i]==null? null : { time:t, value:ao[i] }).filter(Boolean));
        indSeriesOsc.current.ao = [s];
      }
      if (active.ac) {
        const s = addOscHist("#a78bfa");
        s.setData(times.map((t,i)=> ac[i]==null? null : { time:t, value:ac[i] }).filter(Boolean));
        indSeriesOsc.current.ac = [s];
      }
    }
  }, [candles, active]);

  useEffect(() => { updateIndicators(); }, [updateIndicators, chartType, redrawTick]); // ✨ ADDED
  useEffect(() => () => removeAllIndicatorSeries(), [removeAllIndicatorSeries]);      // ✨ ADDED

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-[9990] flex items-center justify-between px-3 py-2 h-14 bg-white border-b pr-28 md:pr-36" style={{ backdropFilter: "saturate(120%) blur(4px)" }}>
        <button onClick={() => navigate(-1)} className="text-sm px-3 py-1 rounded border hover:bg-gray-100">← Back</button>
        <div className="font-semibold text-center truncate mx-2">{symbol} • {tf.toUpperCase()}{lastPrice ? ` • ₹${Number(lastPrice).toLocaleString("en-IN")}` : ""}</div>
        <div className="flex items-center gap-2 overflow-x-auto max-w-[45vw] sm:max-w-[40vw] md:max-w-[35vw]">
          {["1m", "5m", "15m", "1h", "1d"].map((k) => (
            <button key={k} onClick={() => setTf(k)} className={`text-xs px-2 py-1 rounded border whitespace-nowrap ${tf === k ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-100"}`}>{k}</button>
          ))}
          <ChartTypeDropdown />
          <button onClick={() => setOpenIndModal(true)} className="text-xs px-2 py-1 rounded border hover:bg-gray-100 whitespace-nowrap">Indicators</button>
        </div>
        <div className="w-12 md:w-20 shrink-0" />
      </div>

      <div style={{ height: HEADER_H }} />

      {/* Left toolbar */}
      <LeftRail />

      {/* Main chart + overlay */}
      <div style={{ position: "relative" }}>
        <div ref={mainRef} style={{ width: "100%" }} />
        <div
          ref={overlayRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ position: "absolute", inset: 0, zIndex: 10, pointerEvents: "auto", cursor: activeTool ? "crosshair" : "default" }}
        >
          <OverlaySVG key={redrawTick} />
        </div>
      </div>

      {/* Osc pane */}
      <div className="mt-2 border-t">
        <div ref={oscRef} style={{ width: "100%" }} />
      </div>

      {/* status */}
      <div className="fixed top-16 right-3 text-xs text-gray-500 pointer-events-none z-[9991]">
        {status === "loading" && "Loading…"}
        {status === "error" && <span className="text-red-600">Error loading data</span>}
      </div>

      {/* Indicators modal */}
      {openIndModal && (
        <div className="fixed inset-0 bg-black/40 z-[9992] flex items-start justify-center pt-16">
          <div className="bg-white rounded-xl shadow-xl w-[92vw] max-w-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold">Indicators</div>
              <button onClick={() => setOpenIndModal(false)} className="text-gray-500">✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[60vh] overflow-auto">
              {INDICATORS.map((ind) => (
                <label key={ind.key} className="flex items-center gap-2 border rounded p-2">
                  <input
                    type="checkbox"
                    checked={!!active[ind.key]}
                    onChange={(e) => setActive((prev) => ({ ...prev, [ind.key]: e.target.checked }))}
                  />
                  <span className="text-sm">{ind.label}</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {ind.where === "main" ? "Overlay" : "Osc"}
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-3 text-right">
              <button onClick={() => setOpenIndModal(false)} className="text-sm px-3 py-1 rounded border hover:bg-gray-100">Done</button>
            </div>
            <p className="mt-3 text-xs text-gray-500">Note: A/D requires volume. If your backend doesn’t send volume, we assume 1.</p>
          </div>
        </div>
      )}
    </div>
  );
}
