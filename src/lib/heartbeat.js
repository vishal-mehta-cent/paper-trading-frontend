// src/lib/heartbeat.js
const BASE = import.meta?.env?.VITE_BACKEND_BASE_URL?.trim().replace(/\/+$/, "")
  || "https://paper-trading-backend-sqllite.onrender.com";

export function startHeartbeat() {
  // Ping every 45s while the tab is open
  setInterval(() => {
    fetch(`${BASE}/healthz`, { method: "GET", cache: "no-store" })
      .catch(() => {}); // silent
  }, 45000);
}
