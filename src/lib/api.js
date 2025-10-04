// src/lib/api.js

// Safely read the env at build time; no fragile ==/?: around the token.
const RAW =
  (typeof import.meta !== "undefined" && import.meta.env)
    ? import.meta.env.VITE_BACKEND_BASE_URL
    : undefined;

// Canonical value
export const API_BASE_URL =
  (typeof RAW === "string" && RAW.trim() !== "")
    ? RAW.trim()
    : "http://127.0.0.1:8000";

// Backward compatibility for existing imports:
export const API_BASE = API_BASE_URL;

// Optional tiny fetch helper used across the app
export async function api(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  return res;
}

/**
 * frontend/src/lib/api.js
 * Auto-detect baseURL for API calls
 */

const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

const hasImportMeta =
  typeof import.meta !== "undefined" &&
  import.meta &&
  typeof import.meta.env !== "undefined";

// 1. If `.env` has VITE_API_BASE_URL → always prefer it
const ENV_BASE =
  hasImportMeta && import.meta.env?.VITE_API_BASE_URL
    ? String(import.meta.env.VITE_API_BASE_URL).trim()
    : "";

// 2. Fallbacks
const DEFAULTS = {
  localDev: "http://localhost:8000",   // when running frontend locally
  emulator: "http://10.0.2.2:8000",    // Android Studio emulator
  genymotion: "http://10.0.3.2:8000",  // Genymotion emulator
  production: "https://neurocrest.in", // deployed backend
};

// 3. Detect best base URL
function inferBase() {
  if (ENV_BASE) return ENV_BASE;

  if (isBrowser) {
    const host = window.location.hostname;

    // Local dev on browser
    if (host === "localhost" || host === "127.0.0.1") return DEFAULTS.localDev;

    // Android Emulator check
    if (host.startsWith("10.0.2.")) return DEFAULTS.emulator;

    // Genymotion check
    if (host.startsWith("10.0.3.")) return DEFAULTS.genymotion;

    // Default → production API
    return DEFAULTS.production;
  }

  // Server-side rendering or fallback
  return DEFAULTS.production;
}

const BASE_URL = inferBase();

async function apiFetch(path, options = {}) {
  const url = `${BASE_URL}${path}`;
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

export { BASE_URL, apiFetch };
