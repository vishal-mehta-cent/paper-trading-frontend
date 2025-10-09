// frontend/src/pages/Portfolio.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import BackButton from "../components/BackButton";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  ArrowDownRight,
  NotebookPen,
  Download,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

// ---------- API base (prod-safe) ----------
const API_BASE = (
  import.meta.env.VITE_BACKEND_BASE_URL || "http://127.0.0.1:8000"
)
  .trim()
  .replace(/\/+$/, "");

// ---------- formatting helpers ----------
const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const money = (v) => {
  const n = toNum(v);
  return n === null
    ? "₹0.00"
    : `₹${n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
};
const signed = (n, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}`;

// small pill
const Chip = ({ label, value, tone = "gray" }) => {
  const toneClass =
    tone === "red"
      ? "bg-red-50 text-red-700 border-red-200"
      : tone === "green"
      ? "bg-green-50 text-green-700 border-green-200"
      : "bg-gray-50 text-gray-700 border-gray-200";
  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-1 rounded-full border ${toneClass}`}
    >
      <span className="opacity-70 mr-1">{label}:</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
};

const SegmentBadge = ({ segment }) => {
  const seg = (segment || "delivery").toLowerCase();
  const isIntra = seg === "intraday";
  return (
    <span
      className={`inline-flex items-center px-2 py-[2px] rounded-full text-[11px] border ${
        isIntra
          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
          : "bg-amber-50 text-amber-700 border-amber-200"
      }`}
      title="Segment"
    >
      {isIntra ? "intraday" : "delivery"}
    </span>
  );
};

export default function Portfolio({ username }) {
  const [data, setData] = useState({ open: [], closed: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [quotes, setQuotes] = useState({});
  const pollRef = useRef(null);
  const navigate = useNavigate();

  const fileInputRef = useRef(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // ------- load portfolio -------
  const load = () => {
    setLoading(true);
    setError("");
    const ctrl = new AbortController();

    fetch(`${API_BASE}/portfolio/${encodeURIComponent(username)}`, {
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          let detail = "";
          try {
            const j = await res.json();
            detail = j?.detail || "";
          } catch {}
          throw new Error(
            detail || `Failed to fetch portfolio (HTTP ${res.status})`
          );
        }
        return res.json();
      })
      .then((result) => {
        setData({
          open: Array.isArray(result?.open) ? result.open : [],
          closed: Array.isArray(result?.closed) ? result.closed : [],
        });
        setError("");
      })
      .catch((err) => {
        if (
          err?.name === "AbortError" ||
          err?.message?.toLowerCase().includes("aborted")
        )
          return;
        console.error("Portfolio fetch error:", err);
        setError(err.message || "Something went wrong. Please try again.");
        setData({ open: [], closed: [] });
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  };

  useEffect(load, [username]);

  const pickDateTime = (o) =>
    o?.datetime || o?.updated_at || o?.created_at || o?.time || o?.date || null;

  const parseDate = (s) => {
    if (!s || typeof s !== "string") return null;
    const safe = s.includes("T") ? s : s.replace(" ", "T");
    const d = new Date(safe);
    return isNaN(d.getTime()) ? null : d;
  };
  const toLocalYMD = (d) => {
    if (!d) return null;
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${yr}-${mo}-${da}`;
  };

  const filteredOpen = useMemo(() => {
    if (!startDate && !endDate) return data.open;
    const start = startDate || null;
    const end = endDate || null;
    return (data.open || []).filter((p) => {
      const dtRaw = pickDateTime(p);
      const dt = parseDate(dtRaw);
      const ymd = toLocalYMD(dt);
      if (!ymd) return false;
      if (start && ymd < start) return false;
      if (end && ymd > end) return false;
      return true;
    });
  }, [data.open, startDate, endDate]);

  // ------- poll quotes -------
  useEffect(() => {
    if (!filteredOpen.length) return;
    const syms = [
      ...new Set(
        filteredOpen.map((p) => (p.symbol || p.script || "").toUpperCase())
      ),
    ].filter(Boolean);
    if (!syms.length) return;

    const fetchQuotes = () => {
      fetch(`${API_BASE}/quotes?symbols=${syms.join(",")}`)
        .then((r) => r.json())
        .then((arr) => {
          const qmap = {};
          (arr || []).forEach((q) => {
            const sym = (q?.symbol || q?.Script || "").toUpperCase();
            if (!sym) return;
            qmap[sym] = {
              price: toNum(q.price),
              change: toNum(q.change),
              pct_change: toNum(q.pct_change),
            };
          });
          setQuotes(qmap);
        })
        .catch(() => {});
    };

    fetchQuotes();
    pollRef.current = setInterval(fetchQuotes, 2000);
    return () => clearInterval(pollRef.current);
  }, [filteredOpen]);

  const handleAdd = (symbol) => navigate(`/buy/${symbol}`);
  const handleExit = (symbol) => navigate(`/sell/${symbol}`);
  const handleCloseModal = () => setSelected(null);
  const handleNoteIn = (symbol) =>
    navigate(`/notes/${encodeURIComponent((symbol || "").toUpperCase())}`);

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      alert("Please select a .xlsx file.");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    fetch(`${API_BASE}/portfolio/${username}/upload`, {
      method: "POST",
      body: formData,
    })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.detail || `Upload failed (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then((result) => {
        alert(`✅ Uploaded successfully. Rows inserted: ${result.rows}`);
        load();
      })
      .catch((err) => {
        console.error("Upload error:", err);
        alert("Upload failed: " + err.message);
      });
  };

  // ===== Multi-sheet Excel (.xlsx) download =====
  const handleDownloadExcel = () => {
    const instructionSheet = XLSX.utils.aoa_to_sheet([
      ["Instruction"],
      ["This file contains Portfolio and Instrument details."],
      ["Portfolio is your uploaded/updated holdings."],
      ["Instrument sheet is refreshed daily from Zerodha."],
    ]);

    const portfolioHeaders = [
      "Symbol",
      "Name",
      "Segment",
      "Qty",
      "Avg Price",
      "Entry Price",
      "Stoploss",
      "Target",
      "Live",
      "Investment",
      "Date",
    ];
    const portfolioRows =
      filteredOpen && filteredOpen.length
        ? filteredOpen.map((p) => {
            const symbol = (p.symbol || p.script || "").toUpperCase();
            const name = p.name || "";
            const seg = (p.segment || "delivery").toLowerCase();
            const qty = toNum(p.qty) ?? 0;
            const avg = toNum(p.avg_price) ?? 0;
            const entry = toNum(p.entry_price) ?? avg;
            const live =
              toNum(quotes[symbol]?.price) ??
              toNum(p.current_price) ??
              avg ??
              0;
            const sl = toNum(p.stoploss) ?? 0;
            const tgt = toNum(p.target) ?? 0;
            const invest = qty * (avg ?? 0);
            const dtRaw = pickDateTime(p);
            const ymd = toLocalYMD(parseDate(dtRaw)) || "";
            return [
              symbol,
              name,
              seg,
              qty,
              avg,
              entry,
              sl,
              tgt,
              live,
              invest,
              ymd,
            ];
          })
        : [];
    const portfolioSheet = XLSX.utils.aoa_to_sheet([
      portfolioHeaders,
      ...portfolioRows,
    ]);

    const instrumentSheet = XLSX.utils.aoa_to_sheet([
      ["Instrument", "Exchange", "Lot Size", "Tick Size"],
      ["RELIANCE", "NSE", 505, 0.05],
      ["TCS", "NSE", 150, 0.05],
      ["INFY", "NSE", 300, 0.05],
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, instructionSheet, "Instruction");
    XLSX.utils.book_append_sheet(workbook, portfolioSheet, "Portfolio");
    XLSX.utils.book_append_sheet(workbook, instrumentSheet, "Instrument");

    const excelBuffer = XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
    });
    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const stamp = new Date()
      .toISOString()
      .slice(0, 19)
      .replace("T", "_")
      .replace(/:/g, "");
    saveAs(blob, `portfolio_${username || "user"}_${stamp}.xlsx`);
  };

  // Totals
  const totalInvested = useMemo(
    () =>
      filteredOpen.reduce(
        (s, p) => s + (toNum(p.avg_price) ?? 0) * (toNum(p.qty) ?? 0),
        0
      ),
    [filteredOpen]
  );

  const totalCurrentValuation = useMemo(() => {
    return filteredOpen.reduce((s, p) => {
      const symbol = (p.symbol || p.script || "").toUpperCase();
      const qty = toNum(p.qty) ?? 0;
      const live =
        toNum(quotes[symbol]?.price) ??
        toNum(p.current_price) ??
        toNum(p.avg_price) ??
        0;
      return s + qty * live;
    }, 0);
  }, [filteredOpen, quotes]);

  const totalPnL = useMemo(
    () => totalCurrentValuation - totalInvested,
    [totalCurrentValuation, totalInvested]
  );
  const totalPnLPct = useMemo(() => {
    if (!totalInvested) return 0;
    return (totalPnL / totalInvested) * 100;
  }, [totalPnL, totalInvested]);

  return (
    <div className="p-4">
      <BackButton to="/menu" />
      <h2 className="text-center text-xl font-bold text-blue-600">
        Portfolio
      </h2>

      {loading && <div className="text-center text-gray-500">Loading…</div>}

      {!loading && error && (
        <div className="text-center text-red-600">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Summary */}
          <div className="text-center mt-3">
            <div className="inline-flex flex-wrap items-center gap-2">
              <span className="inline-block px-4 py-2 bg-white rounded-xl shadow text-sm font-semibold">
                Total Invested: {money(totalInvested)}
              </span>
              <span className="inline-block px-4 py-2 bg-white rounded-xl shadow text-sm font-semibold">
                Current Valuation: {money(totalCurrentValuation)}
              </span>
              <span
                className={`inline-block px-4 py-2 rounded-xl shadow text-sm font-semibold ${
                  totalPnL >= 0
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                P&L: {money(totalPnL)} ({signed(totalPnLPct, 2)}%)
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-3 mb-2 flex items-center justify-center gap-3">
            <button
              onClick={handleDownloadExcel}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              <Download size={16} />
              <span>Download</span>
            </button>

            <button
              onClick={handleUploadClick}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
            >
              <Upload size={16} />
              <span>Upload</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileSelected}
            />
          </div>

          {/* Open Holdings */}
          <h3 className="text-center text-lg font-semibold mt-3">
            Open Holdings
          </h3>

          {filteredOpen.length === 0 ? (
            <div className="text-center text-sm text-gray-500">
              No holdings in portfolio
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOpen.map((p, i) => {
                const symbol = (p.symbol || p.script || "").toUpperCase();
                const seg = (p.segment || "delivery").toLowerCase();

                const qty = toNum(p.qty) ?? 0;
                const avg = toNum(p.avg_price) ?? 0;
                const entry = toNum(p.entry_price) ?? avg;
                const sl = toNum(p.stoploss) ?? 0;
                const tgt = toNum(p.target) ?? 0;

                const invest = qty * avg;
                const q = quotes[symbol] || {};
                const live = toNum(q.price) ?? toNum(p.current_price) ?? avg;

               // Use backend-calculated values if available
                const total = toNum(p.script_pnl) ?? ((live - entry) * qty);
                const absPct = toNum(p.abs_pct) ?? (((live - entry) / entry) * 100);
                const perShare = total / (toNum(p.qty) ?? 1);


                const currentVal = (toNum(live) ?? 0) * (qty ?? 0);
                const cardPnL = currentVal - invest;

                const pnlColor =
                  total > 0
                    ? "text-green-600"
                    : total < 0
                    ? "text-red-600"
                    : "text-gray-600";

                const footerPnlColor =
                  cardPnL > 0
                    ? "text-green-600"
                    : cardPnL < 0
                    ? "text-red-600"
                    : "text-gray-600";

                return (
                  <div
                    key={`${symbol}-${i}`}
                    className="p-4 rounded-xl shadow bg-white hover:shadow-md transition cursor-pointer"
                    onClick={() =>
                      setSelected({
                        ...p,
                        symbol,
                        live,
                        pnlPerShare: perShare,
                      })
                    }
                  >
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 font-semibold">
                        BUY • {qty} Qty
                      </span>
                    </div>

                    <div className="mt-1 flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xl font-bold text-gray-800">
                          {symbol}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <SegmentBadge segment={seg} />
                          <span className="text-xs text-gray-600">
                            Live:{" "}
                            <span className="font-semibold text-gray-800">
                              {money(live)}
                            </span>
                          </span>
                          <span className="text-[11px] text-gray-500 border rounded px-1">
                            NSE
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 pr-1">
                        <div className="w-8 h-8 mt-0.5 rounded-lg bg-blue-100 flex items-center justify-center">
                          {total >= 0 ? (
                            <ArrowUpRight size={16} className="text-blue-700" />
                          ) : (
                            <ArrowDownRight
                              size={16}
                              className="text-blue-700"
                            />
                          )}
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-base font-semibold ${pnlColor}`}
                          >
                            {money(total)}
                          </div>
                          <div className={`text-xs mt-1 ${pnlColor}`}>
                            {signed(perShare, 4)} ({signed(absPct, 2)}%)
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNoteIn(symbol);
                            }}
                            className="inline-flex items-center gap-1 text-xs mt-2 px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                          >
                            <NotebookPen size={14} />
                            <span>Notes</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-2">
                      <Chip label="Entry Price" value={money(entry)} />
                      <Chip label="SL" value={money(sl)} tone="red" />
                      <Chip label="Target" value={money(tgt)} tone="green" />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs mt-2">
                      <span className="text-gray-500">
                        NSE | Total Investment={money(invest)}
                      </span>
                      <span className="text-gray-600">
                        Current Valuation={money(currentVal)}
                      </span>
                      <span className={`${footerPnlColor}`}>
                        P&L={money(cardPnL)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {selected && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-96 relative">
            <button
              onClick={handleCloseModal}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-lg font-bold"
            >
              ✕
            </button>

            <h3 className="text-lg font-bold text-blue-600 mb-1">
              {selected.symbol}
            </h3>

            <div className="text-2xl font-extrabold text-center">
              {money(selected.live)}
            </div>

            <div className="space-y-1 text-sm mt-4">
              <div>Qty: {selected.qty}</div>
              <div>Avg Price: {money(selected.avg_price)}</div>
              <div>
                Entry Price:{" "}
                {money(selected.entry_price ?? selected.avg_price)}
              </div>
              <div>Stoploss: {money(selected.stoploss ?? 0)}</div>
              <div>Target: {money(selected.target ?? 0)}</div>
              <div>Current Price: {money(selected.live)}</div>
              <div>
                P&L / Share:{" "}
                <span
                  className={`font-semibold ${
                    (selected.pnlPerShare ?? 0) >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {money(selected.pnlPerShare ?? 0)}
                </span>
              </div>
            </div>

            <div className="flex justify-around border-t pt-4 mt-4">
              <button
                onClick={() => {
                  handleAdd(selected.symbol);
                  handleCloseModal();
                }}
                className="px-4 py-2 rounded-lg bg-green-500 text-white font-semibold hover:bg-green-600"
              >
                Add
              </button>
              <button
                onClick={() => {
                  handleExit(selected.symbol);
                  handleCloseModal();
                }}
                className="px-4 py-2 rounded-lg bg-red-500 text-white font-semibold hover:bg-red-600"
              >
                Exit
              </button>
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-lg bg-gray-600 text-white font-semibold hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
