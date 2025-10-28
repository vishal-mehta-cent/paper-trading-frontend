import React, { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ClipboardList, User, Briefcase, Clock } from "lucide-react";
import ScriptDetailsModal from "../components/ScriptDetailsModal";
import BackButton from "../components/BackButton";
import { moneyINR } from "../utils/format";

const API =
  import.meta.env.VITE_BACKEND_BASE_URL ||
  "https://paper-trading-backend.onrender.com";

export default function Trade({ username }) {
  const [tab, setTab] = useState("mylist");
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);   // JS array
  const [searching, setSearching] = useState(false);    // loading flag
  const [allScripts, setAllScripts] = useState([]);     // cached scripts
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

  const intervalRef = useRef(null);
  const nav = useNavigate();
  const sellPreviewGuardRef = useRef({});
  const who = username || localStorage.getItem("username") || "";

  useEffect(() => {
    fetchWatchlist();
    fetchFunds();
    preloadScripts();
  }, [username]);

  // preload instrument list
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

  // quotes refresher
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!watchlist.length) return;

    const fetchQuotes = () => {
      fetch(`${API}/quotes?symbols=${watchlist.join(",")}`)
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

  // improved search logic — layered & case-insensitive
  const debouncedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!debouncedQuery) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    // local instant matches (optional)
    const localMatches = Array.isArray(allScripts)
      ? allScripts
          .filter((s) => {
            const q = debouncedQuery.toLowerCase();
            return (
              (s.symbol || "").toLowerCase().includes(q) ||
              (s.name || "").toLowerCase().includes(q)
            );
          })
          .slice(0, 10)
      : [];
    setSuggestions(localMatches);

    // backend query (uppercase + no spaces)
    const qUpper = debouncedQuery.toUpperCase().replace(/\s+/g, "");

    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`${API}/search?q=${encodeURIComponent(qUpper)}`)
        .then((r) => r.json())
        .then((data) => {
          if (!Array.isArray(data)) {
            setSuggestions([]);
            return;
          }

          // keep equities + derivatives
          const allowedExchanges = ["NSE", "NFO", "BSE"];
          const clean = data.filter((s) =>
            allowedExchanges.includes((s.exchange || "").toUpperCase())
          );

          // small stable sort
          clean.sort((a, b) => (a.symbol || "").localeCompare(b.symbol || ""));

          // IMPORTANT: don't apply another substring filter here.
          setSuggestions(clean);
        })
        .catch(() => {
          // leave suggestions as-is on error
        })
        .finally(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [debouncedQuery, allScripts]);

  function handleSearch(e) {
    setQuery(e.target.value);
  }

  function goDetail(sym) {
    fetch(`${API}/quotes?symbols=${sym}`)
      .then((r) => r.json())
      .then((arr) => {
        const latestQuote = arr.length > 0 ? arr[0] : {};
        setSelectedSymbol(sym);
        setSelectedQuote(latestQuote);
        setQuery("");
        setSuggestions([]);
      })
      .catch(() => {
        setSelectedSymbol(sym);
        setSelectedQuote(quotes[sym] || {});
        setQuery("");
        setSuggestions([]);
      });
  }

  function handleAddToWatchlist() {
    fetch(`${API}/watchlist/${who}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: selectedSymbol }),
    }).then(() => {
      fetchWatchlist();
      setSelectedSymbol(null);
    });
  }

  function handleBuy() {
    nav(`/buy/${selectedSymbol}`);
    setSelectedSymbol(null);
  }

  // SELL preview flow
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

  // escape special chars before building the highlight regex
  function escapeRegex(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function highlightMatch(text, q) {
    if (!q) return text;
    const safe = escapeRegex(q);
    const regex = new RegExp(`(${safe})`, "ig");
    return String(text).split(regex).map((part, i) =>
      regex.test(part) ? (
        <span key={i} className="font-bold text-blue-600">
          {part}
        </span>
      ) : (
        part
      )
    );
  }

  const showDropdown = query.trim().length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-gray-700">
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

            {/* Show dropdown while typing, not only when there are results */}
            {showDropdown && (
              <ul className="bg-white rounded-lg shadow mt-2 max-h-60 overflow-auto z-50 relative">
                {searching && (
                  <li className="px-4 py-2 text-sm text-gray-500">Searching…</li>
                )}

                {!searching && suggestions.length === 0 && (
                  <li className="px-4 py-2 text-sm text-gray-500">
                    No matches. Keep typing…
                  </li>
                )}

                {!searching &&
                  suggestions.map((s, i) => (
                    <li
                      key={`${s.symbol}-${s.exchange}-${i}`}
                      onMouseDown={(e) => e.preventDefault()} // prevent input blur pre-click
                      onClick={() => goDetail(s.symbol)}
                      className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                    >
                      <div className="font-semibold">
                        {highlightMatch(s.symbol, query)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {highlightMatch(s.name, query)}
                      </div>
                      <div className="text-xs text-gray-400">
                        {(s.exchange || "NSE")} | {s.segment} | {s.instrument_type}
                      </div>
                    </li>
                  ))}
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
        onClose={() => setSelectedSymbol(null)}
        onAdd={handleAddToWatchlist}
        onBuy={handleBuy}
        onSell={handleSell}
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
                  setSelectedSymbol(null);
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
