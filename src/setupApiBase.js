// src/setupApiBase.js
// Global fetch shim: redirects any hard-coded localhost calls to API_BASE.

// src/setupApiBase.js
// Global fetch shim: redirects any hard-coded localhost calls to API_BASE.

import { API_BASE } from "../src/lib/api.js";

(function setupFetchShim() {
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;
  const origFetch = window.fetch.bind(window);

  const HOSTS = [
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://10.0.2.2:8000"
  ];

  function rewrite(url) {
    try {
      // Relative URLs: leave them as-is (they'll hit the same origin)
      if (url.startsWith("/") && !url.startsWith("//")) {
        return `${API_BASE}${url}`;
      }
      for (const h of HOSTS) {
        if (url.startsWith(h)) {
          const rest = url.slice(h.length);
          return `${API_BASE}${rest.startsWith("/") ? "" : "/"}${rest}`;
        }
      }
      return url;
    } catch (e) {
      return url;
    }
  }

  window.fetch = (input, init) => {
    try {
      if (typeof input === "string") {
        return origFetch(rewrite(input), init);
      } else if (input && typeof input.url === "string") {
        const req = new Request(rewrite(input.url), input);
        return origFetch(req, init);
      }
    } catch (e) {
      // fall through
    }
    return origFetch(input, init);
  };
})();
