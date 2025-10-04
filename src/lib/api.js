// src/lib/api.js
const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

const hasImportMeta =
  typeof import.meta !== "undefined" &&
  import.meta &&
  typeof import.meta.env !== "undefined";

// Prefer .env
const ENV_BASE =
  hasImportMeta && import.meta.env?.VITE_BACKEND_BASE_URL
    ? String(import.meta.env.VITE_BACKEND_BASE_URL).trim()
    : "";

// Fallbacks
const DEFAULTS = {
  localDev: "http://localhost:8000",
  emulator: "http://10.0.2.2:8000",
  genymotion: "http://10.0.3.2:8000",
  production: "https://paper-trading-backend-sqllite.onrender.com", // ← change if needed
};

function inferBase() {
  if (ENV_BASE) return ENV_BASE;
  if (isBrowser) {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") return DEFAULTS.localDev;
    if (host.startsWith("10.0.2.")) return DEFAULTS.emulator;
    if (host.startsWith("10.0.3.")) return DEFAULTS.genymotion;
    return DEFAULTS.production;
  }
  return DEFAULTS.production;
}

export const API_BASE = inferBase();

export async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}
