import React, { useState } from "react";
import "./Recommendations.css";

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
            <div className="signal-card">Card 1</div>
            <div className="signal-card">Card 2</div>
            <div className="signal-card">Card 3</div>
            <div className="signal-card">Card 4</div>
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
