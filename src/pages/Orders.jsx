// frontend/src/pages/Orders.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ClipboardList, Search, Briefcase, User, X, Clock } from "lucide-react";
import BackButton from "../components/BackButton";
import { toast } from "react-toastify";

const API = import.meta.env.VITE_BACKEND_BASE_URL || "https://paper-trading-backend.onrender.com";

// ---------- Safe helpers ----------
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const money = (v) => {
  const n = toNum(v);
  return n === null
    ? "—"
    : `₹${n.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
};
const intval = (v) => {
  const n = toNum(v);
  return n === null ? "—" : n;
};
const toNumOrNull = (v) =>
  v === null || v === undefined || v === ""
    ? null
    : Number.isFinite(Number(v))
      ? Number(v)
      : null;

// Robust datetime utils (local timezone)
const pickDateTime = (o) =>
  o?.datetime || o?.updated_at || o?.created_at || o?.time || o?.date || null;

const parseDate = (s) => {
  if (!s || typeof s !== "string") return null;
  const safe = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(safe);
  return isNaN(d.getTime()) ? null : d;
};
const fmtTime = (d) =>
  d
    ? d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    : "—";
const fmtDate = (d) =>
  d
    ? d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    : "—";

const Chip = ({ label, value, tone = "gray" }) => {
  const toneClass =
    tone === "red"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "green"
        ? "bg-green-50 text-green-700 border-green-200"
        : "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <span className={`inline-flex items-center text-xs px-2 py-1 rounded-full border ${toneClass}`}>
      <span className="opacity-70 mr-1">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
};

const SegmentBadge = ({ segment }) => {
  const seg = (segment || "").toLowerCase();
  const isIntra = seg === "intraday";
  return (
    <span
      className={`inline-flex items-center px-2 py-[2px] rounded-full text-[11px] border ${isIntra
        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
        : "bg-amber-50 text-amber-700 border-amber-200"
        }`}
      title="Segment"
    >
      {isIntra ? "intraday" : "delivery"}
    </span>
  );
};

export default function Orders({ username }) {
  const location = useLocation();
  const [tab, setTab] = useState(location.state?.tab || "open");

  const [openOrders, setOpenOrders] = useState([]);
  const [positions, setPositions] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showActions, setShowActions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const intervalRef = useRef(null);
  const navigate = useNavigate();

  // polling refs
  const dataPollRef = useRef(null);
  const prevOpenRef = useRef([]);
  const prevPosRef = useRef([]);

  const isOrdersTab = tab === "open";
  const getSymbol = (o) => (o?.script || o?.symbol || "").toString().toUpperCase();
  const who = username || localStorage.getItem("username");

  // Stop spinner early if username is missing
  useEffect(() => {
    if (!who) {
      setLoading(false);
      setErrorMsg("Username missing. Please sign in again.");
    }
  }, [who]);

  // ---------- Data loaders ----------
  const normalize = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.map((o) => ({
      ...o,
      id: o.id ?? o.order_id,
      type: o.type || o.order_type,
      script: o.script || o.symbol, // keep both, prefer script
      // entry / trigger / live
      price: toNum(o?.price) ?? null,                 // entry/avg for positions
      trigger_price: toNum(o?.trigger_price),         // open orders
      live_price: toNum(o?.live_price),
      // P&L fields from backend (if any)
      abs_per_share: toNum(o?.abs_per_share) ?? toNum(o?.abs),
      abs_pct: toNum(o?.abs_pct),
      script_pnl: toNum(o?.script_pnl) ?? toNum(o?.pnl_value),
      // misc numeric
      pnl: toNum(o?.pnl),
      stoploss: toNumOrNull(o?.stoploss),
      target: toNumOrNull(o?.target),
      status: o.status,
      status_msg: o.status_msg,
      qty: Number(o.qty) || 0,
      total: Number(o.total) || 0,
      inactive: Boolean(o.inactive),
      segment: o.segment,
      short_first: Boolean(o.short_first || o.is_short || o.isShort),
      // timestamps
      datetime: o.datetime,
      updated_at: o.updated_at,
      created_at: o.created_at,
      time: o.time,
      date: o.date,
    }));
  };

  const loadData = useCallback(async () => {
    if (!who) {
      setOpenOrders([]);
      setPositions([]);
      setErrorMsg("Username missing. Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const ctrl1 = new AbortController();
    const ctrl2 = new AbortController();
    const timer = setTimeout(() => {
      try { ctrl1.abort(); } catch { }
      try { ctrl2.abort(); } catch { }
    }, 10000); // 10s timeout

    try {
      const [openRes, posRes] = await Promise.all([
        fetch(`${API}/orders/${who}`, { signal: ctrl1.signal }),
        fetch(`${API}/orders/positions/${who}`, { signal: ctrl2.signal }),
      ]);

      if (!openRes.ok || !posRes.ok) {
        const t1 = await openRes.text().catch(() => "");
        const t2 = await posRes.text().catch(() => "");
        throw new Error(
          `Failed to load orders (open ${openRes.status}, pos ${posRes.status}). ${t1 || t2 || ""}`.trim()
        );
      }

      const [openData, posData] = await Promise.all([openRes.json(), posRes.json()]);
      setOpenOrders(normalize(openData));
      setPositions(normalize(posData));
      setErrorMsg("");
    } catch (e) {
      // ⛑️ On any error or timeout: stop the spinner (no red message),
      // the page shows empty state and polling below will refill when API returns.
      setErrorMsg("");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [who]);

  // initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // refresh when a route asks us to
  useEffect(() => {
    if (location.state?.refresh) {
      loadData();
    }
  }, [location.state, loadData]);

  // 🔁 ALSO refresh **whenever the user clicks a tab** (your ask)
  useEffect(() => {
    loadData();
  }, [tab, loadData]);

  // lightweight polling of orders/positions
  useEffect(() => {
    if (!who) return;
    const silentRefresh = async () => {
      try {
        const [openRes, posRes] = await Promise.all([
          fetch(`${API}/orders/${who}`),
          fetch(`${API}/orders/positions/${who}`),
        ]);
        if (!openRes.ok || !posRes.ok) return;
        const [openData, posData] = await Promise.all([openRes.json(), posRes.json()]);
        setOpenOrders(normalize(openData));
        setPositions(normalize(posData));
        setLoading(false); // ensure we leave spinner once any data arrives
      } catch {
        /* ignore */
      }
    };
    dataPollRef.current = setInterval(silentRefresh, 3000);
    return () => {
      if (dataPollRef.current) clearInterval(dataPollRef.current);
      dataPollRef.current = null;
    };
  }, [who, loadData]);

  // Live quotes polling
  useEffect(() => {
    const allSymbols = Array.from(
      new Set(
        [...openOrders, ...positions]
          .map((o) => (o.script || o.symbol || "").toUpperCase())
          .filter(Boolean)
      )
    );
    if (!allSymbols.length) return;

    const fetchQuotes = () => {
      fetch(`${API}/quotes?symbols=${allSymbols.join(",")}`)
        .then((r) => r.json())
        .then((arr) => {
          const map = {};
          (arr || []).forEach((q) => {
            const sym = (q?.symbol || "").toUpperCase();
            if (!sym) return;
            map[sym] = {
              price: toNum(q?.price),
              change: toNum(q?.change),
              pct_change: toNum(q?.pct_change),
              open: toNum(q?.open),
            };
          });
          setQuotes(map);
        })
        .catch(() => { });
    };

    fetchQuotes();
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchQuotes, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [openOrders, positions]);

  const ordersToShow = isOrdersTab ? openOrders : positions;

  // ---------- Total P&L (active positions only) ----------
  const totalPnl = positions.reduce((sum, o) => {
    if (o.inactive) return sum; // ignore closed/inactive rows

    const backendTotal = toNum(o.script_pnl) ?? toNum(o.pnl_value);
    if (backendTotal !== null) return sum + backendTotal;

    const script = o.script || o.symbol;
    const q = (script && quotes[(script || "").toUpperCase()]) || {};
    const entry = toNum(o.price) ?? 0;
    const live = toNum(q.price) ?? toNum(o.live_price) ?? entry;
    const qty = toNum(o.qty) ?? 0;
    const isBuy = (o.type || o.order_type) === "BUY";
    const perShare = entry && live ? (isBuy ? (live - entry) : (entry - live)) : 0;
    const pnl = perShare * qty;
    return sum + (Number.isFinite(pnl) ? pnl : 0);
  }, 0);

  // auto-switch to Positions when orders trigger
  useEffect(() => {
    const countBySymbol = (list) =>
      (list || []).reduce((acc, o) => {
        const s = (o.script || o.symbol || "").toUpperCase();
        if (!s) return acc;
        acc[s] = (acc[s] || 0) + 1;
        return acc;
      }, {});

    const prevOpen = prevOpenRef.current || [];
    const prevPos = prevPosRef.current || [];

    const prevOpenCount = countBySymbol(prevOpen);
    const currOpenCount = countBySymbol(openOrders);
    const prevPosCount = countBySymbol(prevPos);
    const currPosCount = countBySymbol(positions);

    const movedSymbols = Object.keys(prevOpenCount).filter((sym) => {
      const openDecreased = (currOpenCount[sym] || 0) < (prevOpenCount[sym] || 0);
      const posIncreased = (currPosCount[sym] || 0) > (prevPosCount[sym] || 0);
      return openDecreased && posIncreased;
    });

    if (movedSymbols.length && tab === "open") {
      setTab("positions");
      toast.info("Order triggered → moved to Positions");
    }

    prevOpenRef.current = openOrders;
    prevPosRef.current = positions;
  }, [openOrders, positions, tab]);

  // ---------- Action handlers ----------
  const handleCancel = async (orderId) => {
    try {
      const res = await fetch(`${API}/orders/cancel/${orderId}`, { method: "POST" });
      if (res.ok) {
        toast.success("Order cancelled ✅");
        loadData();
        setShowActions(false);
      } else {
        toast.error("Cancel failed ❌");
      }
    } catch {
      toast.error("Cancel error");
    }
  };

  const handleModify = (order) => {
    navigate(`/buy/${order.script}`, {
      state: {
        modifyId: order.id,
        qty: order.qty,
        price: order.price,
        exchange: order.exchange,
        segment: order.segment,
        stoploss: order.stoploss,
        target: order.target,
        orderMode: order.price ? "LIMIT" : "MARKET",
        fromModify: true,
      },
    });
    setShowActions(false);
  };

  const handleExit = (pos) => {
    if (!pos) return;
    if ((pos.type || pos.order_type) === "BUY") {
      navigate(`/sell/${pos.symbol || pos.script}`, {
        state: {
          fromExit: true,
          symbol: pos.symbol || pos.script,
          qty: pos.qty,
          price: pos.price,
          exchange: pos.exchange || "NSE",
          segment: pos.segment || "intraday",
          stoploss: pos.stoploss,
          target: pos.target,
          orderMode: "MARKET",
        },
      });
    } else {
      navigate(`/buy/${pos.symbol || pos.script}`, {
        state: {
          fromExit: true,
          symbol: pos.symbol || pos.script,
          qty: pos.qty,
          price: pos.price,
          exchange: pos.exchange || "NSE",
          segment: pos.segment || "intraday",
          stoploss: pos.stoploss,
          target: pos.target,
          orderMode: "MARKET",
        },
      });
    }
    setShowActions(false);
  };

  const handleAdd = (pos) => {
    if (!pos) return;
    navigate(`/buy/${pos.symbol || pos.script}`, {
      state: {
        fromAdd: true,
        symbol: pos.symbol || pos.script,
        qty: pos.qty,
        price: pos.price,
        exchange: pos.exchange || "NSE",
        segment: pos.segment || "intraday",
        orderMode: "MARKET",
        stoploss: pos.stoploss,
        target: pos.target,
      },
    });
  };

  const handleClose = async () => {
    if (!selectedOrder) return;
    const symbol = getSymbol(selectedOrder);
    setBusy(true);
    try {
      const payload = {
        username,
        script,
        order_type,
        qty: Number(qty),
        price: price ? Number(price) : 0,
        stoploss: stoploss ? Number(stoploss) : 0,
        target: target ? Number(target) : 0,
        segment,
        is_short,
      };

      const res = await fetch(`${API}/orders/place`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to close position");
      toast.success(data.message || `Closed ${symbol} ✅`);
      setShowActions(false);
      await loadData();
    } catch (err) {
      toast.error(err.message || "Close failed ❌");
    } finally {
      setBusy(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="relative min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      <BackButton to="/menu" />
      <div className="p-4">
        <h2 className="text-2xl font-bold text-center text-gray-700 dark:text-white mb-10">
          Orders
        </h2>

        <div className="sticky flex justify-center mb-4 space-x-6">
          {["open", "positions"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-1 text-sm font-medium ${tab === t ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 dark:text-gray-300"
                }`}
            >
              {t === "open" ? "Open Trades" : "Positions"}
            </button>
          ))}
        </div>

        {tab !== "open" && (
          <div className="mb-4 text-center">
            <div className="inline-block px-4 py-2 bg-white dark:bg-gray-800 rounded-xl shadow text-xl font-semibold">
              Total P&L:{" "}
              <span className={totalPnl >= 0 ? "text-green-600" : "text-red-500"}>
                {money(totalPnl)}
              </span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400">Loading...</div>
        ) : errorMsg ? (
          <div className="text-center text-red-500 dark:text-red-400">{errorMsg}</div>
        ) : ordersToShow.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-10">
            No {isOrdersTab ? "open trades" : "positions"}.
          </div>
        ) : (
          <div className="space-y-3">
            {ordersToShow.map((o, i) => {
              const script = (o.script || o.symbol || "N/A").toUpperCase();
              const q = quotes[script] || {};
              const live = toNum(q.price) ?? toNum(o.live_price) ?? toNum(o.price) ?? 0;

              // timestamp (time + date)
              const dtRaw = pickDateTime(o);
              const dt = parseDate(dtRaw);

              const side = (o.type || o.order_type) || "";
              const isBuy = side === "BUY";
              const isSell = !isBuy;

              // Entry price (order price for Open tab, executed/avg for Positions tab)
              const entryPrice = isOrdersTab
                ? toNum(o.trigger_price) ?? toNum(o.price) ?? 0
                : toNum(o.price) ?? 0;

              // ===== Right-side figures (corrected) =====
              const qty = toNum(o.qty) ?? 0;

              // BUY  : live - entry
              // SELL : entry - live
              const perShare =
                entryPrice && live ? (isBuy ? (live - entryPrice) : (entryPrice - live)) : 0;

              const pct = entryPrice ? (perShare / entryPrice) * 100 : 0;

              const total = perShare * qty;

              const pnlUp = total >= 0;
              const pnlColor = pnlUp ? "text-green-600" : "text-red-600";
              const arrow = pnlUp ? "↗" : "↘";

              const sl = toNum(o.stoploss);
              const tgt = toNum(o.target);



              //const disabledRow = ((isSell && !o.short_first) || o.status === "Closed");
              const disabledRow = !!o.inactive;

              return (
                <div
                  key={o.id ?? `${script}-${dtRaw ?? ""}-${i}`}
                  className={`p-4 rounded-xl shadow ${disabledRow
                    ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                    : "bg-white dark:bg-gray-800 hover:shadow-md cursor-pointer"
                    }`}
                  onClick={() => {
                    if (disabledRow) return;
                    setSelectedOrder(o);
                    setShowActions(true);
                  }}
                >
                  {/* top line: side + qty + time+date */}
                  <div className="flex justify-between text-sm">
                    <span className={`${isBuy ? "text-green-600" : "text-red-600"} font-semibold`}>
                      {isBuy ? "BUY" : "SELL"} • {intval(o.qty)}/{intval(o.total)} Qty
                      {(!isBuy && o.short_first) ? " • SELL FIRST" : ""}
                    </span>

                    <span className="text-right text-gray-500 dark:text-gray-300 leading-4">
                      <div>{fmtTime(dt)}</div>
                      <div className="text-[11px]">{fmtDate(dt)}</div>
                    </span>
                  </div>

                  {/* symbol / segment + live  ———  right-side P&L block */}
                  <div className="mt-1 flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xl font-bold text-gray-800 dark:text-white">{script}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <SegmentBadge segment={o.segment} />
                        <span className="text-xs text-gray-600">
                          Live: <span className="font-semibold text-gray-800">{money(live)}</span>
                        </span>
                        <span className="text-[11px] text-gray-500 border rounded px-1">
                          {o.exchange || "NSE"}
                        </span>
                      </div>
                    </div>

                    {/* RIGHT SIDE (TOTAL + per-share + %) */}
                    <div className="text-right pr-1">
                      <div className={`text-2xl font-extrabold ${pnlColor}`}>
                        {arrow} {money(total)}
                      </div>
                      <div className={`${pnlColor} text-xs mt-0.5`}>
                        {(perShare >= 0 ? "+" : "") + perShare.toFixed(4)} (
                        {(pct >= 0 ? "+" : "") + pct.toFixed(2)}%)
                      </div>
                    </div>
                  </div>

                  {/* entry/SL/Target */}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Chip label={isOrdersTab ? "Order Price" : "Entry Price"} value={money(entryPrice)} />
                    {sl != null && <Chip label="SL" value={money(sl)} tone="red" />}
                    {tgt != null && <Chip label="Target" value={money(tgt)} tone="green" />}
                  </div>

                  {/* footer line */}
                  <div className="flex justify-between text-xs mt-2">
                    <span className="text-gray-500 dark:text-gray-400">
                      NSE | Total Investment={money((entryPrice || 0) * (toNum(o.qty) ?? 0))}
                    </span>
                    {o.status_msg && (
                      <span className="text-[11px] text-gray-500">{o.status_msg}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Popup Action Modal */}
      {showActions && selectedOrder && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-80 shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
                {getSymbol(selectedOrder)}
              </h3>
              <X
                size={20}
                className="cursor-pointer text-gray-500 hover:text-red-500"
                onClick={() => setShowActions(false)}
              />
            </div>

            {/* Live Data (just LTP) */}
            <div className="text-center mb-4">
              {(() => {
                const sym = getSymbol(selectedOrder);
                const q = (sym && quotes[sym]) || {};
                const live = toNum(q.price) ?? toNum(selectedOrder.price) ?? 0;
                return <div className="text-2xl font-bold">{money(live)}</div>;
              })()}
            </div>

            {isOrdersTab ? (
              // Open Trades modal actions
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleModify(selectedOrder)}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg"
                >
                  Modify
                </button>
                <button
                  disabled={busy}
                  onClick={handleClose}
                  className={`${busy ? "opacity-60" : ""} bg-gray-700 hover:bg-gray-800 text-white py-2 rounded-lg`}
                  title="Cancel all open orders for this script and remove today's executed rows, refunding today’s BUY amounts"
                >
                  Cancel
                </button>
              </div>
            ) : (
              // Positions modal actions
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={() => handleAdd(selectedOrder)}
                  className="bg-blue-600 text-white px-3 py-1 rounded"
                >
                  Add
                </button>
                <button
                  onClick={() => handleExit(selectedOrder)}
                  className="bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg"
                >
                  Exit
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Icons */}
      <div className="absolute right-5 top-20 flex items-center space-x-4 z-50">
        <div className="flex flex-col items-center cursor-pointer" onClick={() => navigate("/portfolio")}>
          <Briefcase size={22} className="text-gray-600 dark:text-white hover:text-blue-600" />
          <span className="text-xs text-gray-500 dark:text-white">Portfolio</span>
        </div>
        <div className="flex flex-col items-center cursor-pointer" onClick={() => navigate("/history")}>
          <Clock size={22} className="text-gray-600 hover:text-blue-600" />
          <span className="text-xs text-gray-500">History</span>
        </div>
        <div className="flex flex-col items-center cursor-pointer" onClick={() => navigate("/profile")}>
          <User size={22} className="text-gray-600 dark:text-white hover:text-blue-600" />
          <span className="text-xs text-gray-500 dark:text-white">Profile</span>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 p-2 flex justify-around z-40 border-t border-gray-700">
        <button onClick={() => navigate("/trade")} className="flex flex-col items-center text-gray-400">
          <Search size={22} />
          <span className="text-xs">Watchlist</span>
        </button>
        <button className="flex flex-col items-center text-blue-400">
          <ClipboardList size={22} />
          <span className="text-xs">Orders</span>
        </button>
      </div>
    </div>
  );
}
