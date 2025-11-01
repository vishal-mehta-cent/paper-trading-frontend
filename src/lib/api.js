// -----------------------------------------------
// src/lib/api.js
// Universal API Base Configuration for NeuroCrest
// -----------------------------------------------

const RAW =
  (typeof import.meta !== "undefined" && import.meta.env)
    ? import.meta.env.VITE_BACKEND_BASE_URL
    : undefined;

const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

// ✅ Only one backend should be used — your live Render one
const DEFAULTS = {
  localDev: "http://127.0.0.1:8000",         // Local FastAPI
  emulator: "http://10.0.2.2:8000",          // Android Emulator
  genymotion: "http://10.0.3.2:8000",        // Genymotion
  production: "https://api.neurocrest.in",   // ✅ YOUR LIVE BACKEND
};

function inferBase() {
  if (RAW && typeof RAW === "string" && RAW.trim() !== "") {
    return RAW.trim();
  }

  if (isBrowser) {
    const host = window.location.hostname;

    if (host === "localhost" || host === "127.0.0.1") {
      return DEFAULTS.localDev;
    }
    if (host.startsWith("10.0.2.")) return DEFAULTS.emulator;
    if (host.startsWith("10.0.3.")) return DEFAULTS.genymotion;

    // Everything else → production
    return DEFAULTS.production;
  }

  return DEFAULTS.production;
}

export const API_BASE_URL = inferBase();
export const API_BASE = API_BASE_URL;

export async function api(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  return res;
}

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
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

if (isBrowser) {
  console.log("🌐 NeuroCrest API Base URL →", API_BASE_URL);
}
