// src/components/ChartLauncher.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Mount this once (e.g., in App.jsx or Trade.jsx).
 * From anywhere (even inside a portal) do:
 *   window.dispatchEvent(new CustomEvent("open-chart", { detail: { symbol: "TCS" } }));
 * It will navigate to /chart/TCS.
 */
export default function ChartLauncher() {
  const navigate = useNavigate();

  useEffect(() => {
    const onOpen = (e) => {
      const s = (e?.detail?.symbol || "").toString().toUpperCase().trim();
      if (!s) return;
      navigate(`/chart/${encodeURIComponent(s)}`);
    };
    window.addEventListener("open-chart", onOpen);
    return () => window.removeEventListener("open-chart", onOpen);
  }, [navigate]);

  return null;
}
