// -----------------------------------------------
// src/lib/api.js
// Universal API Base Configuration for NeuroCrest
// -----------------------------------------------

// ✅ Step 1: Safe environment variable read (Vite)
const RAW =
  (typeof import.meta !== "undefined" && import.meta.env)
    ? import.meta.env.VITE_BACKEND_BASE_URL
    : undefined;

// ✅ Step 2: Detect browser environment
const isBrowser =
  typeof window !== "undefined" && typeof document !== "undefined";

// ✅ Step 3: Define all base URLs for each environment
const DEFAULTS = {
  localDev: "http://127.0.0.1:8000",         // Local FastAPI
  emulator: "http://10.0.2.2:8000",          // Android Emulator
  genymotion: "http://10.0.3.2:8000",        // Genymotion
  production: "https://api.neurocrest.in",   // ✅ Render backend (live)
};

// ✅ Step 4: Compute the actual base URL dynamically
function inferBase() {
  // 1️⃣ .env overrides everything
  if (RAW && typeof RAW === "string" && RAW.trim() !== "") {
    return RAW.trim();
  }

  // 2️⃣ Browser-based inference
  if (isBrowser) {
    const host = window.location.hostname;

    // Localhost or 127.0.0.1
    if (host === "localhost" || host === "127.0.0.1") {
      return DEFAULTS.localDev;
    }

    // Android Emulator
    if (host.startsWith("10.0.2.")) return DEFAULTS.emulator;

    // Genymotion Emulator
    if (host.startsWith("10.0.3.")) return DEFAULTS.genymotion;

    // Everything else (production domain)
    return DEFAULTS.production;
  }

  // 3️⃣ Non-browser environments (SSR, Node)
  return DEFAULTS.production;
}

// ✅ Step 5: Assign final BASE_URL
export const API_BASE_URL = inferBase();
export const API_BASE = API_BASE_URL; // Backward compatibility

// ✅ Step 6: Basic fetch helper
export async function api(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  return res;
}

// ✅ Step 7: JSON fetch helper (throws detailed error if fails)
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

// ✅ Step 8: Debug log (helps verify in browser console)
if (isBrowser) {
  console.log("🌐 NeuroCrest API Base URL →", API_BASE_URL);
}
