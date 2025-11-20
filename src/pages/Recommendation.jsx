// -------------------- FULL FILE: Recommendations.jsx --------------------

import React, { useState, useEffect, useMemo, useRef, startTransition } from "react";
import "./Recommendations.css";
import SignalCard from "../components/SignalCard";
import BackButton from "../components/BackButton";

export default function Recommendations() {
  const [rows, setRows] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const [segment, setSegment] = useState("Equity");
  const [selectedScreener, setSelectedScreener] = useState("All");
  const [screenerList, setScreenerList] = useState([]);

  const [selectedAlertType, setSelectedAlertType] = useState("All");
  const [alertTypeList, setAlertTypeList] = useState([]);

  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );

  // Main button (Intraday / BTST / Short-term)
  const [activeType, setActiveType] = useState("Intraday");

  // Sub filter only for Intraday
  const [subIntraday, setSubIntraday] = useState("All");

  const [priceCloseFilter, setPriceCloseFilter] = useState("All");

  const API =
    (import.meta.env.VITE_BACKEND_BASE_URL || "http://127.0.0.1:8000")
      .toString()
      .replace(/\/+$/, "");

  // ---------------------------
  const toNum = (v) => {
    if (v === null || v === undefined) return undefined;
    const n = Number.parseFloat(typeof v === "string" ? v.replace(/[, ]/g, "") : v);
    return Number.isFinite(n) ? n : undefined;
  };

  // ---------------------------
  // Normalise date from CSV
  // ---------------------------
  const normalizeDate = (raw) => {
    if (!raw) return "";

    let s = String(raw).trim();

    // Already yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    // Remove time
    s = s.split(" ")[0];

    // MM/DD/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
      const [m, d, y] = s.split("/");
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    // MM/DD/YY
    if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(s)) {
      let [m, d, y] = s.split("/");
      y = "20" + y;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }

    return "";
  };

  // ---------------------------
  const getField = (row, candidates) => {
    if (!row) return undefined;
    const norm = (s) =>
      String(s || "").replace(/\s+/g, "").replace(/[_-]/g, "").toLowerCase();
    const map = {};
    for (const k of Object.keys(row)) map[norm(k)] = k;
    for (const c of candidates) {
      const hit = map[norm(c)];
      if (hit !== undefined) return row[hit];
    }
    return undefined;
  };

  // ---------------------------
  // Pickers
  // ---------------------------
  const pickConfidence = (r) => {
    let raw = getField(r, [
      "backtest_accuracy",
      "backtestaccuracy",
      "accuracy",
      "%accuracy",
      "confidence",
    ]);

    if (!raw) return null;
    if (typeof raw === "string") raw = raw.replace("%", "").trim();

    const num = Number(raw);
    return Number.isFinite(num) ? num : null;
  };

  const pickSignalPrice = (r) =>
    toNum(
      getField(r, [
        "signal_price",
        "close_price",
        "Signal_price",
        "Signal Price",
      ])
    );

  const pickCurrentPrice = (r) =>
    toNum(
      getField(
        r,
        segment === "F&O"
          ? ["live_fnoprice", "live_price", "LTP", "ltp"]
          : ["live_price", "LTP", "ltp"]
      )
    );

  const pickStoploss = (r) =>
    toNum(
      getField(
        r,
        ["stoploss", "Stoploss", "fno_stoploss", "FNO_stoploss"]
      )
    );

  const pickTarget = (r) =>
    toNum(
      getField(
        r,
        ["target", "Target", "fno_target", "FNO_target"]
      )
    );

  const pickSupport = (r) =>
    toNum(
      getField(
        r,
        ["support", "Support", "sup", "SUP", "pivot_support"]
      )
    );

  const pickResistance = (r) =>
    toNum(
      getField(
        r,
        ["resistance", "Resistance", "res", "RES", "pivot_resistance"]
      )
    );

  const pickAlertType = (r) =>
    getField(r, ["signal_type", "Signal_type"]) || "N/A";

  const pickDescription = (r) =>
    getField(r, ["Alert_description", "description", "Description"]) || "";

  const pickScript = (r) => {
    let s = getField(r, ["script", "Script", "symbol", "Symbol"]);
    return s ? String(s).trim() : "N/A";
  };

  const pickScreener = (r) =>
    getField(r, ["screener", "Screener", "screener_name"]) || "Unknown";

  const pickRawDate = (r) =>
    getField(r, ["raw_datetime", "Date", "date", "Date_daily", "signal_date"]);

  // ⭐ Extract TIME from raw CSV
  const pickTime = (row) => {
    const raw = pickRawDate(row);
    if (!raw) return "";

    const cleaned = raw.trim().replace(/\s+/g, " ");
    const parts = cleaned.split(" ");
    if (parts.length < 2) return "";

    let t = parts[1].trim();
    const tParts = t.split(":");

    if (tParts.length >= 2) {
      return `${tParts[0]}:${tParts[1]}`;
    }

    return t;
  };

  // Match your CSV exactly:
  const pickStrategy = (r) => {
    let raw = getField(r, ["Strategy", "strategy"]) || "";
    raw = String(raw).trim();

    if (raw === "Intraday") return "intraday";
    if (raw === "Intraday - Fast Alerts") return "intraday-fast-alerts";
    if (raw === "Shortterm") return "short-term";
    if (raw === "BTST") return "btst";

    return raw.toLowerCase();
  };

  const pickPriceCloseTo = (r) =>
    getField(r, ["price_closeto", "Price_Close_to"]) || "None";

  const pickAlertText = (r) =>
    getField(r, ["alert", "ALERT", "Alert"]) || "";

  const pickUserActions = (r) =>
    getField(r, ["user_actions"]) || "";



  // ---------------------------
  // Normalize Row
  // ---------------------------
  const normalize = (row) => {
    const script = pickScript(row);
    const screener = pickScreener(row);
    const alertType = pickAlertType(row);
    const confidence = pickConfidence(row);
    const description = pickDescription(row);
    const strategy = pickStrategy(row);
    const priceCloseTo = pickPriceCloseTo(row);

    const rawDate = pickRawDate(row);
    const dateVal = normalizeDate(rawDate);
    const timeVal = pickTime(row);
    const alertText = pickAlertText(row);
    const userActions = pickUserActions(row);




    const sup = pickSupport(row) ?? 0;
    const st = pickStoploss(row) ?? 0;
    const t = pickTarget(row) ?? 0;
    const res = pickResistance(row) ?? 0;

    const signalPrice = pickSignalPrice(row) ?? 0;
    let currentPrice = pickCurrentPrice(row) ?? signalPrice;

    let outcome = null;
    if (t > 0 && currentPrice >= t) outcome = "PROFIT";
    else if (st > 0 && currentPrice <= st) outcome = "LOSS";

    return {
      id: `${script}-${dateVal}-${timeVal}-${strategy}`,
      script,
      screener,
      alertType,
      confidence,
      description,
      strategy,
      priceCloseTo,
      sup,
      st,
      t,
      res,
      signalPrice,
      currentPrice,
      outcome,
      dateVal,
      timeVal,
      alertText,
      userActions,
    };
  };

  const mergeStable = (prev, next) => {
    const map = new Map(prev.map((r) => [r.id, r]));
    return next.map((n) => (map.has(n.id) ? map.get(n.id) : n));
  };

  // ---------------------------
  // Fetch backend (CSV)
  // ---------------------------
  const pollingRef = useRef({ first: true });
  useEffect(() => {
    let alive = true;
    const fetchOnce = async () => {
      try {
        const res = await fetch(`${API}/recommendations/data`, { cache: "no-store" });
        const json = await res.json();
        if (!alive) return;

        const normalized = (Array.isArray(json) ? json : []).map(normalize);

        const seen = new Set();
        const ordered = [];
        for (const r of normalized) {
          if (!r.script || r.script === "N/A") continue;
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          ordered.push(r);
        }

        const uniqueScreeners = ["All", ...new Set(ordered.map(r => r.screener))];
        const uniqueAlertTypes = ["All", ...new Set(ordered.map(r => r.alertType))];

        startTransition(() => {
          setScreenerList(uniqueScreeners);
          setAlertTypeList(uniqueAlertTypes);
          setRows(prev => mergeStable(prev, ordered));

          if (pollingRef.current.first) {
            setInitialLoading(false);
            pollingRef.current.first = false;
          }
        });
      } catch (err) {
        console.error("Fetch recommendations failed:", err);
        if (pollingRef.current.first) {
          setInitialLoading(false);
          pollingRef.current.first = false;
        }
      }
    };

    fetchOnce();
    const id = setInterval(fetchOnce, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [API, segment]);

  // ---------------------------
  // ⭐ LIVE PRICE POLLING (EVERY 10 SECONDS)
  // ---------------------------
  useEffect(() => {
    if (rows.length === 0) return;

    const pollLive = async () => {
      try {
        const symbols = [...new Set(rows.map((r) => r.script))];

        const res = await fetch(`${API}/recommendations/live-prices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols }),
        });

        const data = await res.json();

        // Update only currentPrice — keep everything else same
        setRows((prev) =>
          prev.map((r) => {
            const sym = r.script?.toUpperCase();
            const newPrice = data[sym];
            if (!newPrice) return r;

            let outcome = r.outcome;
            if (r.t > 0 && newPrice >= r.t) outcome = "PROFIT";
            else if (r.st > 0 && newPrice <= r.st) outcome = "LOSS";
            else outcome = null;

            return {
              ...r,
              currentPrice: newPrice,
              outcome,
            };
          })
        );
      } catch (err) {
        console.error("Live price fetch failed:", err);
      }
    };

    pollLive();
    const id = setInterval(pollLive, 10000);
    return () => clearInterval(id);
  }, [rows, API]);

  // ---------------------------
  // Filtering logic
  // ---------------------------
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const matchDate = selectedDate ? r.dateVal === selectedDate : true;

      const matchScreener =
        selectedScreener === "All" ||
        (r.screener || "").toLowerCase() === selectedScreener.toLowerCase();

      const matchAlert =
        selectedAlertType === "All" ||
        (r.alertType || "").toLowerCase() === selectedAlertType.toLowerCase();

      let matchStrategy = true;
      if (activeType === "Intraday") {
        matchStrategy =
          r.strategy === "intraday" ||
          r.strategy === "intraday-fast-alerts";
      } else if (activeType === "BTST") {
        matchStrategy = r.strategy === "btst";
      } else if (activeType === "Short-term") {
        matchStrategy = r.strategy === "short-term";
      }

      let matchSub = true;
      if (activeType === "Intraday") {
        if (subIntraday === "Intraday")
          matchSub = r.strategy === "intraday";
        else if (subIntraday === "Intraday - Fast Alerts")
          matchSub = r.strategy === "intraday-fast-alerts";
        else matchSub = true;
      }

      const matchPriceClose =
        priceCloseFilter === "All" ||
        (r.priceCloseTo || "").toLowerCase().includes(priceCloseFilter.toLowerCase());

      return matchDate && matchScreener && matchAlert && matchStrategy && matchSub && matchPriceClose;
    });
  }, [
    rows,
    selectedDate,
    selectedScreener,
    selectedAlertType,
    activeType,
    subIntraday,
    priceCloseFilter,
  ]);

  // ---------------------------
  const activeSignals = useMemo(() => {
    const allActive = filteredRows.filter((r) => !r.outcome);
    return allActive.slice(0, 10);
  }, [filteredRows]);

  const closedSignals = useMemo(
    () => filteredRows.filter((r) => r.outcome),
    [filteredRows]
  );

  // ---------------------------
  const renderSignalLayout = () => (
    <div className="intraday-section">

      {/* Subtype (only Intraday) */}
      <div className="filters-row">

        {/* DATE */}
        <div className="filter-item">
          <label>Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        {/* NEW — INTRADAY TYPE IN SAME ROW */}
        {activeType === "Intraday" && (
          <div className="filter-item">
            <label>Intraday Type:</label>
            <select value={subIntraday} onChange={(e) => setSubIntraday(e.target.value)}>
              <option>All</option>
              <option>Intraday</option>
              <option>Intraday - Fast Alerts</option>
            </select>
          </div>
        )}

        {/* SEGMENT */}
        <div className="filter-item">
          <label>Segment:</label>
          <select value={segment} onChange={(e) => setSegment(e.target.value)}>
            <option>Equity</option>
            <option>F&O</option>
          </select>
        </div>
      </div>

      {/* MAIN FILTER ROW */}
      <div className="filters-row">
        <div className="filter-item">
          <label>Alert Type:</label>
          <select
            value={selectedAlertType}
            onChange={(e) => setSelectedAlertType(e.target.value)}
          >
            {alertTypeList.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Screener:</label>
          <select
            value={selectedScreener}
            onChange={(e) => setSelectedScreener(e.target.value)}
          >
            {screenerList.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>



        <div className="filter-item">
          <label>Price Close To:</label>
          <select
            value={priceCloseFilter}
            onChange={(e) => setPriceCloseFilter(e.target.value)}
          >
            <option value="All">All</option>
            <option value="Resistance">Resistance</option>
            <option value="Support">Support</option>
            <option value="Breakout">Breakout</option>
            <option value="Bearish">Bearish</option>
            <option value="Bullish">Bullish</option>
          </select>
        </div>
      </div>

      {/* LEGEND */}
      <div className="signals-section">
        <div className="legend-row">
          <div className="legend-box">
            <h4>Legend</h4>
            <p><strong>RES</strong> = Resistance | <strong>SUP</strong> = Support</p>
            <p><strong>T</strong> = Target | <strong>ST</strong> = Stoploss</p>
            <p>▲ = Current Price | ● = Signal Price</p>
            <p>% = Confidence</p>
          </div>
        </div>

        {/* SIGNAL COLUMNS */}
        <div className="signals-columns">
          <div className="signals-column">
            <h3>Active Signals</h3>
            {initialLoading ? (
              <p>Loading data...</p>
            ) : (
              <div className="signal-grid">
                {activeSignals.length > 0 ? (
                  activeSignals.map((sig) => (
                    <SignalCard
                      key={sig.id}
                      script={sig.script}
                      confidence={sig.confidence}
                      alertType={sig.alertType}
                      description={sig.description}
                      sup={sig.sup}
                      st={sig.st}
                      signalPrice={sig.signalPrice}
                      currentPrice={sig.currentPrice}
                      t={sig.t}
                      res={sig.res}
                      timeVal={sig.timeVal}
                      livePriceFeed={true}
                      alertText={sig.alertText}
                      userActions={sig.userActions}
                    />
                  ))
                ) : (
                  <p>No active signals.</p>
                )}
              </div>
            )}
          </div>

          <div className="signals-column">
            <h3>Closed Signals</h3>
            <div className="signal-grid">
              {closedSignals.length > 0 ? (
                closedSignals.map((sig) => {
                  const isProfit = sig.outcome === "PROFIT";
                  const color = isProfit ? "#00C853" : "#E53935";
                  return (
                    <div
                      className="closed-card-wrapper"
                      style={{ borderColor: color }}
                      key={sig.id}
                    >
                      <div className="closed-badge" style={{ color }}>
                        {sig.outcome}
                      </div>
                      <SignalCard
                        script={sig.script}
                        confidence={sig.confidence}
                        alertType={sig.alertType}
                        description={sig.description}
                        sup={sig.sup}
                        st={sig.st}
                        signalPrice={sig.signalPrice}
                        currentPrice={sig.currentPrice}
                        t={sig.t}
                        res={sig.res}
                        timeVal={sig.timeVal}
                        livePriceFeed={false}
                        alertText={sig.alertText}
                        userActions={sig.userActions}
                      />
                    </div>
                  );
                })
              ) : (
                <p>No closed signals.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="recommendations-container">
      <BackButton to="/menu" />
      <h2 className="text-center text-xl font-bold text-blue-600">
        RECOMMENDATIONS
      </h2>

      <div className="recommendation-buttons">
        {["Intraday", "BTST", "Short-term"].map((type) => (
          <button
            key={type}
            className={`rec-btn ${activeType === type ? "active" : ""}`}
            onClick={() => {
              setActiveType(type);
              setSubIntraday("All");
            }}
          >
            {type}
          </button>
        ))}
      </div>

      <div className="recommendation-content">{renderSignalLayout()}</div>
    </div>
  );
}

// -------------------- END OF FILE --------------------
