import React, { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(LineElement, CategoryScale, LinearScale, PointElement, Tooltip, Legend, Filler);

export default function SignalCard({ script, confidence, alertType, description, livePriceFeed }) {
  const [prices, setPrices] = useState([]);

  // simulate live price updates
  useEffect(() => {
    if (!livePriceFeed) return;
    const interval = setInterval(() => {
      setPrices((prev) => {
        const last = prev[prev.length - 1] || 100;
        const next = +(last + (Math.random() - 0.5) * 2).toFixed(2);
        return [...prev.slice(-30), next];
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [livePriceFeed]);

  const isProfit = prices.length > 1 && prices[prices.length - 1] >= prices[0];
  const borderColor = isProfit ? "#00C853" : "#E53935";

  const data = {
    labels: prices.map((_, i) => i),
    datasets: [
      {
        data: prices,
        borderColor,
        backgroundColor: "rgba(41, 98, 255, 0.05)",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options = {
    plugins: { legend: { display: false } },
    scales: {
      x: { display: false },
      y: { display: false },
    },
    maintainAspectRatio: false,
  };

  const currentTime = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="signal-card-advanced">
      {/* ---- Header ---- */}
      <div className="signal-header">
        <span className="signal-time">{currentTime}</span>
        <span className="signal-script">{script}</span>
        <span className="signal-confidence">{confidence}%</span>
      </div>

      {/* ---- Chart Section ---- */}
      <div className="chart-wrapper">
        <Line data={data} options={options} />
        {/* ✅ Removed overlay text */}
      </div>

      {/* ---- Footer ---- */}
      <div className="signal-footer">
        <div className="alert-info">
          <strong>Alert Type:</strong> {alertType}
        </div>
        <div className="alert-desc">
          <strong>Description:</strong> {description}
        </div>
      </div>
    </div>
  );
}
