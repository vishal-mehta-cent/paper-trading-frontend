import React, { useState } from "react";
import "./Recommendations.css";
import SignalCard from "../components/SignalCard"; // ✅ added for live chart component
import BackButton from "../components/BackButton";

export default function Recommendations() {
  const [activeType, setActiveType] = useState("Intraday");

  // ✅ Helper to render the filter + cards layout
  const renderSignalLayout = () => (
    <div className="intraday-section">
      <div className="filters-row">
        <div className="filter-item">
          <label>Date:</label>
          <input type="date" defaultValue={new Date().toISOString().split("T")[0]} />
        </div>

        <div className="filter-item">
          <label>Alert Type:</label>
          <select>
            <option>Breakout</option>
            <option>Reversal</option>
            <option>Momentum</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Price Filter:</label>
          <select>
            <option>Above 50 EMA</option>
            <option>Below 50 EMA</option>
            <option>At Support</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Accuracy Filter:</label>
          <select>
            <option>High Accuracy</option>
            <option>Medium</option>
            <option>All</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Segment:</label>
          <select>
            <option>Equity</option>
            <option>F&O</option>
            <option>Commodity</option>
          </select>
        </div>
      </div>

      <div className="signals-section">
        <div className="signals-column">
          <h3>Active Signals</h3>
          <p className="subtext">(Latest on top)</p>
          <div className="signal-grid">
            {/* ✅ Replaced static boxes with live chart cards */}
            <SignalCard
              script="TCS"
              confidence={87}
              alertType="Breakout"
              description="Crossing resistance near 4200"
              livePriceFeed={true}
            />
            <SignalCard
              script="RELIANCE"
              confidence={75}
              alertType="Momentum"
              description="Rising above 2400 zone"
              livePriceFeed={true}
            />
            <SignalCard
              script="INFY"
              confidence={63}
              alertType="Reversal"
              description="Support holding at 1450"
              livePriceFeed={true}
            />
            <SignalCard
              script="HDFCBANK"
              confidence={92}
              alertType="Breakout"
              description="Testing resistance at 1550"
              livePriceFeed={true}
            />
          </div>
        </div>

        <div className="signals-column">
          <h3>Closed Signals</h3>
          <p className="subtext">(Latest on top)</p>
          <div className="signal-grid">
            <div className="signal-card">Card A</div>
            <div className="signal-card">Card B</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="recommendations-container">
      <BackButton to="/menu" />
      <h2>Recommendations</h2>

      {/* --- Tabs --- */}
      <div className="recommendation-buttons">
        {["Intraday", "BTST", "Short-term"].map((type) => (
          <button
            key={type}
            className={`rec-btn ${activeType === type ? "active" : ""}`}
            onClick={() => setActiveType(type)}
          >
            {type}
          </button>
        ))}
      </div>

      {/* --- Conditional render for each tab --- */}
      <div className="recommendation-content">
        {activeType === "Intraday" && renderSignalLayout()}
        {activeType === "BTST" && renderSignalLayout()}
        {activeType === "Short-term" && renderSignalLayout()}
      </div>
    </div>
  );
}
