// vite.config.js
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // ✅ Load environment variables based on the current mode (dev or prod)
  const env = loadEnv(mode, process.cwd(), "");

  // ✅ Read the backend URL from .env (fallback if not found)
  const backendBase = env.VITE_BACKEND_BASE_URL || "https://api.neurocrest.in";

  console.log(`🌍 Using backend: ${backendBase}`);

  return {
    plugins: [react()],
    base: "/",
    build: {
      outDir: "dist",
      sourcemap: false,
    },

    // ✅ Local dev proxy (optional but useful)
    // When you run `npm run dev`, this makes requests like `/payments/...`
    // automatically redirect to your backend.
    server: {
      proxy: {
        "/payments": {
          target: backendBase,
          changeOrigin: true,
          secure: false,
        },
        "/watchlist": {
          target: backendBase,
          changeOrigin: true,
          secure: false,
        },
        "/funds": {
          target: backendBase,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // ✅ Expose environment variables to your frontend
    define: {
      "import.meta.env.VITE_BACKEND_BASE_URL": JSON.stringify(backendBase),
    },
  };
});
