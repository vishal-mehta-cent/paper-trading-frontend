import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ClipboardList, User, Briefcase, Clock } from "lucide-react";
import ScriptDetailsModal from "../components/ScriptDetailsModal";
import BackButton from "../components/BackButton";
import { moneyINR } from "../utils/format";
import ChartLauncher from "../components/ChartLauncher";


const API =
  import.meta.env.VITE_BACKEND_BASE_URL ||
  "https://paper-trading-backend.onrender.com";

export default function Trade({ username }) {
  const [tab, setTab] = useState("mylist");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [allScripts, setAllScripts] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [quotes, setQuotes] = useState({});
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState(null);
  const [totalFunds, setTotalFunds] = useState(0);
  const [availableFunds, setAvailableFunds] = useState(0);

  const [sellChecking, setSellChecking] = useState(false);
  const [sellConfirmOpen, setSellConfirmOpen] = useState(false);
  const [sellConfirmMsg, setSellConfirmMsg] = useState("");
  const [sellPreviewData, setSellPreviewData] = useState(null);
  const [sellSymbol, setSellSymbol] = useState(null);

  const intervalRef = useRef(null);          // watchlist quotes polling
  const modalPollRef = useRef(null);         // modal live-quote polling
  const nav = useNavigate();
  const sellPreviewGuardRef = useRef({});
  const who = username || localStorage.getItem("username") || "";

  useEffect(() => {
    fetchWatchlist();
    fetchFunds();
    preloadScripts();
  }, [username]);

  function preloadScripts() {
    fetch(`${API}/search/scripts`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setAllScripts(data);
        else setAllScripts([]);
      })
      .catch(() => setAllScripts([]));
  }

  function fetchWatchlist() {
    fetch(`${API}/watchlist/${who}`)
      .then((r) => r.json())
      .then(setWatchlist)
      .catch(() => setWatchlist([]));
  }

  function fetchFunds() {
    fetch(`${API}/funds/available/${who}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch funds");
        return res.json();
      })
      .then((data) => {
        setTotalFunds(data.total_funds || 0);
        setAvailableFunds(data.available_funds || 0);
      })
      .catch(() => {
        setTotalFunds(0);
        setAvailableFunds(0);
      });
  }

  function handleRemoveFromWatchlist(symbol) {
    fetch(`${API}/watchlist/${who}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol }),
    }).then(() => fetchWatchlist());
  }

  // ===== Watchlist quotes refresher =====
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!watchlist.length) return;

    const fetchQuotes = () => {
      fetch(`${API}/quotes?symbols=${encodeURIComponent(watchlist.join(","))}`)
        .then((r) => r.json())
        .then((arr) => {
          const map = {};
          (arr || []).forEach((q) => (map[q.symbol] = q));
          setQuotes(map);
        })
        .catch(() => {});
    };

    fetchQuotes();
    intervalRef.current = setInterval(fetchQuotes, 2000);
    return () => clearInterval(intervalRef.current);
  }, [watchlist]);

  // ========== SEARCH HELPERS ==========
  const MONTHS = [
    "JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","SEPT","OCT","NOV","DEC"
  ];
  const normMonth = (m) => (m === "SEPT" ? "SEP" : m || "");

  // ⬇️ UPDATED: understands trailing CE/PE/FUT even with no month/strike (e.g., "tcsce")
  function parseOptionish(q) {
    const Qraw = String(q || "").toUpperCase().replace(/\s+/g, "");
    if (!Qraw) return { raw: "", underlying: "", year2: "", month: "", strike: "", deriv: "" };

    // detect trailing derivative token and strip it for parsing
    const derivMatch = Qraw.match(/(CE|PE|FUT)$/);
    const deriv = derivMatch ? derivMatch[1] : "";
    const Q = deriv ? Qraw.slice(0, -deriv.length) : Qraw;

    // find month token and its position
    let month = "", mIdx = -1;
    for (const m of MONTHS) {
      const idx = Q.indexOf(m);
      if (idx >= 0 && (mIdx === -1 || idx < mIdx || (idx === mIdx && m.length > month.length))) {
        month = normMonth(m); mIdx = idx;
      }
    }

    // strike: trailing digits before optional CE/PE (still fine if none)
    const tailNum = Q.match(/(\d+)(?!.*\d)/);
    const strike = tailNum ? tailNum[1] : "";

    // year2: 2 digits just before month (if present)
    let year2 = "";
    if (mIdx >= 0) {
      const beforeMonth = Q.slice(Math.max(0, mIdx - 4), mIdx);
      const y = beforeMonth.match(/(\d{2})$/);
      year2 = y ? y[1] : "";
    }

    // underlying from the letters left of month/strike (digits removed)
    let underlying = Q;
    if (mIdx >= 0) {
      if (year2) {
        const yIdx = Q.indexOf(year2, Math.max(0, mIdx - 4));
        underlying = Q.slice(0, yIdx);
      } else {
        underlying = Q.slice(0, mIdx);
      }
    } else if (tailNum) {
      underlying = Q.slice(0, tailNum.index);
    }
    // if nothing matched, just keep the letters of Q (e.g., "TCS")
    underlying = underlying.replace(/[^A-Z]/g, "");

    return { raw: Qraw, underlying, year2, month, strike, deriv };
  }

  function buildSeeds({ underlying, year2, month }) {
    const seeds = new Set();
    if (!underlying && !month) return [];
    const yy = year2 || String(new Date().getFullYear()).slice(-2);
    if (underlying && month) {
      seeds.add(`${underlying}${month}`);
      seeds.add(`${underlying}${yy}${month}`);
    } else if (underlying) {
      seeds.add(underlying);
    } else if (month) {
      seeds.add(month); seeds.add(`${yy}${month}`);
    }
    return Array.from(seeds);
  }

  const symbolField = (s) =>
    (s?.symbol || s?.tradingsymbol || "").toUpperCase().replace(/\s+/g, "");
  const allowedExchange = (s) =>
    ["NSE", "NFO", "BSE"].includes(String(s?.exchange || "").toUpperCase());

  async function backendSearchSmart(parts) {
    const { underlying, month, strike, deriv } = parts;
    const seeds = buildSeeds(parts);
    let bag = [];

    // Fetch all seeds and merge
    for (const seed of seeds) {
      try {
        const res = await fetch(`${API}/search?q=${encodeURIComponent(seed)}`);
        const data = await res.json().catch(() => []);
        if (Array.isArray(data)) bag = bag.concat(data);
      } catch {}
    }

    // Dedupe by symbol field
    const seen = new Set();
    const merged = [];
    for (const s of bag) {
      if (!allowedExchange(s)) continue;
      const sym = symbolField(s);
      if (!sym || seen.has(sym)) continue;
      seen.add(sym);
      merged.push(s);
    }

    // Filters
    let filtered = merged;
    if (month) filtered = filtered.filter((s) => symbolField(s).includes(month));
    if (underlying) filtered = filtered.filter((s) => symbolField(s).includes(underlying));
    if (strike) {
      filtered = filtered.filter((s) => {
        const sym = symbolField(s);
        const m = sym.match(/(\d+)(CE|PE)$/);
        return m ? m[1].startsWith(strike) : sym.includes(strike);
      });
    }

    // ⬇️ NEW: if user typed CE/PE/FUT, keep only those contracts
    if (deriv) {
      filtered = filtered.filter((s) => {
        const sym = symbolField(s);
        return deriv === "FUT" ? sym.endsWith("FUT") : sym.endsWith(deriv);
      });
    }

    // As a final fallback for plain text (no month/strike), do a simple contains
    if (!month && !strike && underlying && !deriv) {
      filtered = merged.filter(
        (s) =>
          symbolField(s).includes(underlying) ||
          String(s.name || "").toUpperCase().includes(underlying)
      );
    }

    filtered.sort((a, b) => symbolField(a).localeCompare(symbolField(b)));
    return filtered.slice(0, 50);
  }
  // ====================================

  const debouncedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setSuggestions([]);
      return;
    }
    const parts = parseOptionish(debouncedQuery);
    const timer = setTimeout(async () => {
      try {
        const results = await backendSearchSmart(parts);

        // Local fallback if backend gave nothing
        let finalList = results;
        if ((!finalList || finalList.length === 0) && Array.isArray(allScripts) && allScripts.length) {
          const { raw, underlying, month, strike, deriv } = parts;
          finalList = allScripts
            .filter(allowedExchange)
            .filter((s) => {
              const sym = symbolField(s);
              const nm = String(s.name || "").toUpperCase();

              // deriv-only searches like "TCSCE" or "TCSFUT"
              if (deriv) {
                if (!sym.endsWith(deriv)) return false;
              }

              if (!month && !strike && underlying) return sym.includes(underlying) || nm.includes(underlying);
              if (!month && !strike && !underlying) return sym.includes(raw) || nm.includes(raw);
              if (underlying && !(sym.includes(underlying) || nm.includes(underlying))) return false;
              if (month && !sym.includes(month)) return false;
              if (strike) {
                const m = sym.match(/(\d+)(CE|PE)$/);
                return m ? m[1].startsWith(strike) : sym.includes(strike);
              }
              return true;
            })
            .sort((a, b) => symbolField(a).localeCompare(symbolField(b)))
            .slice(0, 50);
        }
        setSuggestions(Array.isArray(finalList) ? finalList : []);
      } catch {
        setSuggestions([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [debouncedQuery, allScripts]);

  function handleSearch(e) {
    setQuery(e.target.value);
  }

  // ===== Open modal & start per-symbol live polling =====
  function goDetail(sym) {
    const s = String(sym || "").trim();
    if (!s) return;

    // Clear any previous poll
    if (modalPollRef.current) clearInterval(modalPollRef.current);

    // Show modal asap with a first fetch
    fetch(`${API}/quotes?symbols=${encodeURIComponent(s)}`)
      .then((r) => r.json())
      .then((arr) => {
        const latestQuote = Array.isArray(arr) && arr[0] ? arr[0] : {};
        setSelectedSymbol(s);
        setSelectedQuote(latestQuote);
        setQuery("");
        setSuggestions([]);
      })
      .catch(() => {
        setSelectedSymbol(s);
        setSelectedQuote(quotes[s] || {});
        setQuery("");
        setSuggestions([]);
      });

    // Start polling while modal is open
    modalPollRef.current = setInterval(() => {
      fetch(`${API}/quotes?symbols=${encodeURIComponent(s)}`)
        .then((r) => r.json())
        .then((arr) => {
          const latestQuote = Array.isArray(arr) && arr[0] ? arr[0] : null;
          if (latestQuote) setSelectedQuote(latestQuote);
        })
        .catch(() => {});
    }, 2000);
  }

  // Stop polling when modal closes
  useEffect(() => {
    if (!selectedSymbol && modalPollRef.current) {
      clearInterval(modalPollRef.current);
      modalPollRef.current = null;
    }
  }, [selectedSymbol]);

  function handleAddToWatchlist() {
    fetch(`${API}/watchlist/${who}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: selectedSymbol }),
    }).then(() => {
      fetchWatchlist();
      setSelectedSymbol(null); // closes modal -> stops polling
    });
  }

  function handleBuy() {
    nav(`/buy/${selectedSymbol}`);
    setSelectedSymbol(null); // closes modal -> stops polling
  }

  async function previewThenSell(sym, qty = 1, segment = "intraday") {
    if (!who) {
      alert("Please log in first.");
      return;
    }
    const signature = JSON.stringify({
      sym: String(sym || "").toUpperCase(),
      qty: Number(qty) || 1,
      segment,
    });
    if (sellPreviewGuardRef.current[signature]) return;
    sellPreviewGuardRef.current[signature] = true;
    setTimeout(() => delete sellPreviewGuardRef.current[signature], 1500);

    try {
      setSellChecking(true);
      const body = {
        username: who,
        script: String(sym || "").toUpperCase(),
        order_type: "SELL",
        qty: Number(qty) || 1,
        segment,
        allow_short: false,
      };
      const res = await fetch(`${API}/orders/sell/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      const needsConfirm =
        data?.needs_confirmation === true ||
        data?.code === "NEEDS_CONFIRM_SHORT" ||
        res.status === 409 ||
        Number(data?.owned_qty || 0) === 0;

      if (res.ok && !needsConfirm) {
        nav(`/sell/${sym}`, {
          state: {
            requestedQty: Number(qty) || 1,
            allow_short: false,
            preview: data,
          },
        });
        setSelectedSymbol(null);
        return;
      }

      setSellSymbol(String(sym || "").toUpperCase());
      setSellPreviewData(data);
      setSellConfirmMsg(
        data?.message ||
          `You have 0 qty of ${String(sym || "").toUpperCase()}. Do you still want to sell first?`
      );
      setSellConfirmOpen(true);
    } catch (e) {
      alert("Unable to check holdings right now. Please try again.");
    } finally {
      setSellChecking(false);
    }
  }

  function handleSell() {
    previewThenSell(selectedSymbol, 1, "intraday");
  }

  function highlightMatch(text, q) {
    const str = String(text ?? "");
    if (!q) return str;
    const regex = new RegExp(`(${q})`, "ig");
    return str.split(regex).map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="font-bold text-blue-600">
          {part}
        </span>
      ) : (
        part
      )
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-700">
      {/* Chart launcher (captures global open-chart events) */}
      <ChartLauncher />

      {/* Header */}
      <div className="sticky top-0 z-50 p-4 bg-white rounded-b-2xl shadow relative">
        <BackButton to="/menu" />
        <div className="mt-2 mb-1 w-full flex justify-center">
          <div className="w-fit max-w-[90%] inline-flex items-center gap-2 rounded bg-gray-700 text-gray-100 px-4 py-1.5 text-sm font-medium shadow whitespace-nowrap">
            <span>Total Funds: {moneyINR(totalFunds, { decimals: 0 })}</span>
            <span>|</span>
            <span>Available: {moneyINR(availableFunds, { decimals: 0 })}</span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <h1 className="text-2xl font-serif text-gray-800">Watchlist</h1>
          <div className="flex mt-2 space-x-6 text-sm">
            {["mylist", "mustwatch"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pb-1 ${
                  tab === t
                    ? "text-blue-500 border-b-2 border-blue-500"
                    : "text-gray-500"
                }`}
              >
                {t === "mylist" ? "My List" : "Must Watch"}
              </button>
            ))}
          </div>
        </div>

        {/* Right icons */}
        <div className="absolute right-5 top-20 flex items-center space-x-4">
          <div
            className="flex flex-col items-center cursor-pointer"
            onClick={() => nav("/portfolio")}
          >
            <Briefcase size={22} className="text-gray-600 hover:text-blue-600" />
            <span className="text-xs text-gray-500">Portfolio</span>
          </div>
          <div
            className="flex flex-col items-center cursor-pointer"
            onClick={() => nav("/history")}
          >
            <Clock size={22} className="text-gray-600 hover:text-blue-600" />
            <span className="text-xs text-gray-500">History</span>
          </div>
          <div
            className="flex flex-col items-center cursor-pointer"
            onClick={() => nav("/profile")}
          >
            <User size={22} className="text-gray-600 hover:text-blue-600" />
            <span className="text-xs text-gray-500">Profile</span>
          </div>
        </div>
      </div>

      {tab === "mylist" && (
        <>
          {/* Search */}
          <div className="bg-gray-600 p-4">
            <div className="relative">
              <Search size={16} className="absolute top-3 left-3 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={handleSearch}
                placeholder="Search & Add"
                className="w-full pl-10 pr-4 py-2 rounded-lg text-gray-800"
              />
            </div>
            {suggestions.length > 0 && (
              <ul className="bg-white rounded-lg shadow mt-2 max-h-60 overflow-auto">
                {suggestions.map((s, i) => {
                  const sym = s?.symbol || s?.tradingsymbol || "";
                  return (
                    <li
                      key={`${sym}-${i}`}
                      onClick={() => goDetail(sym)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      <div className="font-semibold">
                        {highlightMatch(sym, query)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {highlightMatch(s.name, query)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {(s.exchange || "NSE")} | {s.segment} | {s.instrument_type}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Watchlist Items */}
          <div className="flex-1 overflow-auto p-4 space-y-3 bg-gray-100">
            {watchlist.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">
                No scripts in your watchlist.
              </div>
            ) : (
              watchlist.map((sym) => {
                const q = quotes[sym] || {};
                const isPos = Number(q.change || 0) >= 0;
                return (
                  <div
                    key={sym}
                    className="bg-white px-4 py-3 rounded-xl hover:shadow-md flex justify-between items-start cursor-pointer"
                    onClick={() => goDetail(sym)}
                  >
                    <div>
                      <div className="text-lg font-semibold text-gray-800">
                        {sym}
                      </div>
                      <div className="text-xs text-gray-600">
                        {q.exchange || "NSE"}
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="text-right">
                        <div
                          className={`text-xl font-medium ${
                            isPos ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {q.price != null
                            ? Number(q.price).toLocaleString("en-IN")
                            : "--"}
                        </div>
                        <div className="text-xs text-gray-600">
                          {q.change != null
                            ? `${isPos ? "+" : ""}${Number(q.change).toFixed(
                                2
                              )} (${isPos ? "+" : ""}${Number(
                                q.pct_change || 0
                              ).toFixed(2)}%)`
                            : "--"}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFromWatchlist(sym);
                        }}
                        className="text-xs bg-red-100 text-red-600 rounded px-2 py-0.5 hover:bg-red-200"
                      >
                        &minus;
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Bottom Nav */}
      <div className="flex bg-gray-800 p-2 justify-around">
        <button
          onClick={() => setTab("mylist")}
          className="flex flex-col items-center text-blue-400"
        >
          <Search size={24} />
          <span className="text-xs">Watchlist</span>
        </button>
        <button
          onClick={() => nav("/orders")}
          className="flex flex-col items-center text-gray-400"
        >
          <ClipboardList size={24} />
          <span className="text-xs">Orders</span>
        </button>
      </div>

      {/* Script modal */}
      <ScriptDetailsModal
        symbol={selectedSymbol}
        quote={selectedQuote}
        onClose={() => {
          setSelectedSymbol(null); // closes modal & stops polling
          if (modalPollRef.current) {
            clearInterval(modalPollRef.current);
            modalPollRef.current = null;
          }
        }}
        onAdd={handleAddToWatchlist}
        onBuy={handleBuy}
        onSell={() => {
          const sym = selectedSymbol;
          setSelectedSymbol(null);
          if (modalPollRef.current) {
            clearInterval(modalPollRef.current);
            modalPollRef.current = null;
          }
          previewThenSell(sym, 1, "intraday");
        }}
      />

      {/* SELL confirmation modal */}
      {sellConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center max-w-sm w-full">
            <p className="mb-4 text-gray-800 font-semibold">
              {sellConfirmMsg ||
                `You have 0 qty of ${sellSymbol}. Do you still want to sell first?`}
            </p>
            <div className="flex justify-center gap-4">
              <button
                className="bg-gray-400 text-white px-4 py-2 rounded"
                onClick={() => setSellConfirmOpen(false)}
              >
                NO
              </button>
              <button
                className="bg-red-600 text-white px-4 py-2 rounded"
                onClick={() => {
                  setSellConfirmOpen(false);
                  nav(`/sell/${sellSymbol}`, {
                    state: {
                      requestedQty: 1,
                      allow_short: true,
                      preview: sellPreviewData,
                    },
                  });
                }}
              >
                YES
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
