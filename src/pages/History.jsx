// frontend/src/pages/History.jsx
import React, { useEffect, useState, useMemo } from "react";
import BackButton from "../components/BackButton";
import { moneyINR } from "../utils/format";
import { NotebookPen, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";
import HeaderBackRow from "../components/HeaderBackRow";

const API = import.meta.env.VITE_BACKEND_BASE_URL || "https://paper-trading-backend.onrender.com";

export default function History({ username }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");

  // NEW: date filter state
  const [startDate, setStartDate] = useState(""); // "YYYY-MM-DD"
  const [endDate, setEndDate] = useState("");     // "YYYY-MM-DD"

  // Resolve username from prop, route param, or localStorage
  const params = useParams();
  const who = useMemo(
    () => username || params.username || localStorage.getItem("username") || "",
    [username, params.username]
  );

  useEffect(() => {
    if (!who) {
      setError("Username missing");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const url = `${API}/orders/history/${encodeURIComponent(who)}`;
    console.log("Fetching:", url);

    fetch(url)
      .then(async (res) => {
        console.log("Response status:", res.status);
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(
            `HTTP ${res.status}: ${txt || "Failed to fetch history"}`
          );
        }
        return res.json();
      })
      .then((data) => {
        console.log("History payload:", data);
        setHistory(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("History fetch error:", err);
        setError(err.message || "Failed to load history");
      })
      .finally(() => setLoading(false));
  }, [who]);

  // -------- formatters (safe) --------
  const asNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const fmtMoney = (n) =>
    n !== null && n !== undefined ? moneyINR(n, { decimals: 2 }) : "—";

  const dateOnly = (dt) => {
    if (!dt || typeof dt !== "string") return "—";
    const [d] = dt.split(" ");
    return d || dt;
  };

  // NEW: helpers to pick a row date and filter by range
  const pickRowDate = (t) => {
    // Prefer SELL date, else BUY date, else fallback to time (if it contains date)
    const cands = [t.sell_date, t.buy_date, t.time];
    for (const s of cands) {
      if (typeof s === "string" && s.trim()) {
        const d = s.split(" ")[0]; // take the YYYY-MM-DD part if present
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      }
    }
    return null;
  };

  const filteredHistory = useMemo(() => {
    if (!startDate && !endDate) return history;
    return history.filter((t) => {
      const ymd = pickRowDate(t);
      if (!ymd) return false;
      if (startDate && ymd < startDate) return false;
      if (endDate && ymd > endDate) return false;
      return true;
    });
  }, [history, startDate, endDate]);

  // NEW: Download (.xls) using filtered rows
  const escapeHTML = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const buildExcelHtml = () => {
    // Columns to export
    const headers = [
      "Symbol",
      "Row Date",
      "Buy Qty",
      "Buy Date",
      "Buy Price",
      "Sell Qty",
      "Sell Avg Price",
      "Sell Date",
      "Invested",
      "Realized P&L",
    ];

    const rows =
      filteredHistory && filteredHistory.length
        ? filteredHistory.map((t) => {
          const symbolUpper = (t.symbol || "—").toUpperCase();
          const rowDate = pickRowDate(t) || "";
          const buyQty = asNum(t.buy_qty) ?? "";
          const buyPrice = asNum(t.buy_price);
          const sellQty = asNum(t.sell_qty) ?? "";
          const sellAvg = asNum(t.sell_avg_price);
          const invested = asNum(t.invested_value);
          const pnl = asNum(t.pnl);

          return [
            symbolUpper,
            rowDate,
            buyQty,
            dateOnly(t.buy_date),
            buyPrice !== null ? buyPrice.toFixed(2) : "",
            sellQty,
            sellAvg !== null ? sellAvg.toFixed(2) : "",
            dateOnly(t.sell_date),
            invested !== null ? invested.toFixed(2) : "",
            pnl !== null ? pnl.toFixed(2) : "",
          ];
        })
        : [];

    const thead =
      "<tr>" +
      headers.map((h) => `<th style="font-weight:600">${escapeHTML(h)}</th>`).join("") +
      "</tr>";

    const tbody =
      rows.length > 0
        ? rows
          .map(
            (r) =>
              "<tr>" + r.map((c) => `<td>${escapeHTML(c)}</td>`).join("") + "</tr>"
          )
          .join("")
        : ""; // header-only if no data

    return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:x="urn:schemas-microsoft-com:office:excel"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8" />
<!--[if gte mso 9]><xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>History</x:Name>
    <x:WorksheetOptions><x:Print><x:ValidPrinterInfo/></x:Print></x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml><![endif]-->
<style>
  table, td, th { border: 1px solid #ccc; border-collapse: collapse; }
  td, th { padding: 4px 6px; font-family: Arial, sans-serif; font-size: 12px; }
  th { background: #eef3ff; }
</style>
</head>
<body>
  <table>
    ${thead}
    ${tbody}
  </table>
</body>
</html>`;
  };

  const handleDownloadExcel = () => {
    const html = buildExcelHtml();
    const blob = new Blob([html], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const stamp = new Date().toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "");
    const a = document.createElement("a");
    a.href = url;
    a.download = `history_${(who || "user")}_${stamp}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const navigate = useNavigate();
  const goNotes = (s) =>
    navigate(`/notes/${encodeURIComponent((s || "").toUpperCase())}`);

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <HeaderBackRow backTo="/profile" />
      <h2 className="text-2xl font-bold text-center mb-4">History</h2>

      {/* NEW: Filter + Download bar */}
      <div className="max-w-4xl mx-auto mb-3">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="startDate" className="text-sm text-gray-700">
              Start:
            </label>
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 border rounded-md text-sm bg-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="endDate" className="text-sm text-gray-700">
              End:
            </label>
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 border rounded-md text-sm bg-white"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
              }}
              className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-sm"
            >
              Clear
            </button>
          )}
          <button
            onClick={handleDownloadExcel}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 text-sm"
            title="Download filtered history (.xls)"
          >
            <Download size={16} />
            <span>Download</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">Loading...</div>
      ) : error ? (
        <div className="text-center text-red-600 whitespace-pre-wrap">
          {error}
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center text-gray-500">No history available.</div>
      ) : (
        <div className="bg-white rounded-lg overflow-hidden shadow">
          {/* Header */}
          <div className="grid grid-cols-5 bg-blue-700 text-white font-semibold p-3">
            <div>Time</div>
            <div>Buy Qty</div>
            <div>Buy Details</div>
            <div>P&amp;L</div>
            <div>Sell Details</div>
          </div>

          {filteredHistory.map((t, idx) => {
            const buyQty = asNum(t.buy_qty) ?? 0;
            const remaining = asNum(t.remaining_qty);
            const isClosedOrPartial =
              t.is_closed || (remaining !== null ? remaining < buyQty : false);
            const rowTone = isClosedOrPartial
              ? "bg-gray-100 text-gray-600"
              : "bg-white";

            const pnlNum = asNum(t.pnl) ?? 0;
            const pnlTone =
              pnlNum > 0
                ? "text-green-600"
                : pnlNum < 0
                  ? "text-red-600"
                  : "text-gray-800";

            const sellQty = asNum(t.sell_qty) ?? 0;
            const sellAvg = asNum(t.sell_avg_price);
            const investedValue = asNum(t.invested_value);

            const symbolUpper = (t.symbol || "—").toUpperCase();

            return (
              <div
                key={`${t.symbol || "row"}-${t.time || idx}`}
                className={`grid grid-cols-5 items-center p-3 border-t ${rowTone}`}
              >
                {/* Time + Symbol + Notes icon (inline, no new column) */}
                <div className="flex flex-col">
                  <div className="inline-flex items-center gap-2">
                    <span className="font-semibold">{symbolUpper}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        goNotes(t.symbol || "");
                      }}
                      title="Notes"
                      className="p-1 rounded hover:bg-gray-100 text-gray-700"
                    >
                      <NotebookPen size={14} />
                    </button>
                  </div>
                  <span className="text-[11px] opacity-60">
                    {t.time || ""}
                  </span>
                </div>

                {/* Buy Qty */}
                <div>{buyQty || "—"}</div>

                {/* Buy Details (date + price) */}
                <div className="text-xs leading-tight">
                  {t.buy_date ? (
                    <>
                      <div>
                        Date:{" "}
                        <span className="font-medium">
                          {dateOnly(t.buy_date)}
                        </span>
                      </div>
                      <div>
                        Price:{" "}
                        <span className="font-medium">
                          {fmtMoney(t.buy_price)}
                        </span>
                      </div>
                    </>
                  ) : (
                    "—"
                  )}
                </div>

                {/* Realized P&L */}
                <div className={`font-medium ${pnlTone}`}>
                  {fmtMoney(pnlNum)}
                </div>

                {/* SELL details */}
                <div className="text-xs leading-tight">
                  {sellQty > 0 ? (
                    <>
                      <div>
                        Date:{" "}
                        <span className="font-medium">
                          {dateOnly(t.sell_date)}
                        </span>
                      </div>
                      <div>
                        Qty: <span className="font-medium">{sellQty}</span>
                      </div>
                      <div>
                        Avg:{" "}
                        <span className="font-medium">
                          {sellAvg !== null ? fmtMoney(sellAvg) : "—"}
                        </span>
                      </div>
                      <div>
                        Invested:{" "}
                        <span className="font-medium">
                          {investedValue !== null
                            ? fmtMoney(investedValue)
                            : "—"}
                        </span>
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-500">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
