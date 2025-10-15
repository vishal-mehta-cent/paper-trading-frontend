import { useState, useEffect, useRef, useCallback } from "react";

const API =
  import.meta.env.VITE_BACKEND_BASE_URL?.replace(/\/+$/, "") ||
  "https://paper-trading-backend.onrender.com";

export default function useOpenTrades(username, {
  refreshMs = 5000,   // background refresh every 5s
  staleMs = 20000     // 20s cache lifetime
} = {}) {
  const [data, setData] = useState(() => {
    // ✅ Load cached data instantly on mount
    try {
      const raw = sessionStorage.getItem(`open_trades_${username}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [isRefreshing, setRefreshing] = useState(false);
  const abortRef = useRef(null);

  const fetchNow = useCallback(async () => {
    if (!username) return;
    if (abortRef.current) abortRef.current.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;
    setRefreshing(true);

    try {
      const res = await fetch(`${API}/orders/${encodeURIComponent(username)}/open`, {
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (Array.isArray(json)) {
        // ✅ Replace only after data arrives (no empty flicker)
        setData(json);
        sessionStorage.setItem(`open_trades_${username}`, JSON.stringify(json));
      }
    } catch (err) {
      console.warn("OpenTrades refresh failed:", err.message);
    } finally {
      if (abortRef.current === ctl) abortRef.current = null;
      setRefreshing(false);
    }
  }, [username]);

  // Initial fetch only if cache stale
  useEffect(() => {
    const key = `open_trades_time_${username}`;
    const lastTs = Number(sessionStorage.getItem(key) || 0);
    const now = Date.now();
    if (now - lastTs > staleMs) fetchNow();
  }, [username]);

  // Background refresh loop
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) fetchNow();
    }, refreshMs);

    const onVisible = () =>
      document.visibilityState === "visible" && fetchNow();
    const onOnline = () => fetchNow();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchNow, refreshMs]);

  // Store timestamp each time data changes
  useEffect(() => {
    sessionStorage.setItem(`open_trades_time_${username}`, Date.now().toString());
  }, [username, data]);

  return { data, isRefreshing, refresh: fetchNow };
}
