import React from "react";

export default function SignalCard({
  script,
  confidence,
  alertType,
  alertText,
  description,
  sup,
  st,
  t,
  res,
  signalPrice,
  currentPrice,
  timeVal,
  dateVal,
  userActions,

  // NEW: from parent (Active/Closed)
  isClosed = false,
}) {
  // ----------------- TIME FORMAT -----------------
  const formatTime = (t) => {
    if (!t) return "--:--";
    let parts = t.trim().split(":");
    if (parts.length < 2) return "--:--";

    let hour = parseInt(parts[0], 10);
    let minute = parts[1];
    if (isNaN(hour) || isNaN(parseInt(minute))) return "--:--";

    const ampm = hour >= 12 ? "PM" : "AM";
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return `${hour.toString().padStart(2, "0")}:${minute.padStart(
      2,
      "0"
    )} ${ampm}`;
  };

  const formattedTime = formatTime(timeVal);

  // ----------------- CLOSED SIGNAL LOGIC -----------------

  let closedPrice = currentPrice;

  if (isClosed) {
    // freeze live price to closing price
    closedPrice = t || res || signalPrice || currentPrice;
  }

  // Use "display price"
  const displayPrice = isClosed ? closedPrice : currentPrice;

  // ----------------- RAW VALUES -----------------
  const rawVals = [sup, st, signalPrice, t, res, displayPrice]
    .map(Number)
    .filter((v) => !isNaN(v) && v !== 0);

  let minRaw = Math.min(...rawVals);
  let maxRaw = Math.max(...rawVals);
  const diffRaw = maxRaw - minRaw;

  // ----------------- C2 SCALING (≥15 units) -----------------
  let scaleMin, scaleMax;

  if (diffRaw < 15) {
    const center = (minRaw + maxRaw) / 2;
    scaleMin = center - 7.5;
    scaleMax = center + 7.5;
  } else {
    const pad = diffRaw * 0.15;
    scaleMin = minRaw - pad;
    scaleMax = maxRaw + pad;
  }

  // ----------------- SIGNAL PRICE FIX -----------------
  if (
    signalPrice !== undefined &&
    st !== undefined &&
    signalPrice !== null &&
    st !== null &&
    !isNaN(signalPrice) &&
    !isNaN(st) &&
    signalPrice <= st
  ) {
    const adjust = Math.max(Math.abs(st * 0.01), 0.5);
    signalPrice = st + adjust;
  }

  // Convert price → % position
  const getPos = (val) =>
    ((val - scaleMin) / (scaleMax - scaleMin)) * 100;

  const isProfit = displayPrice > signalPrice;
  const color = isProfit ? "#00C853" : "#E53935";

  // ----------------- MARKERS -----------------
  const markers = [
    { key: "SUP", value: Number(sup) },
    { key: "ST", value: Number(st) },
    { key: "SIGNAL", value: Number(signalPrice) },
    { key: "LIVE", value: Number(displayPrice) },
    { key: "T", value: Number(t) },
    { key: "RES", value: Number(res) },
  ].filter((m) => !isNaN(m.value));

  let positions = markers.map((m) => ({
    key: m.key,
    pos: getPos(m.value),
  }));

  positions.sort((a, b) => a.pos - b.pos);

  const MIN_GAP = 12;
  const SAFE_OFFSET = 4;

  // PASS 1 — spacing
  for (let i = 1; i < positions.length; i++) {
    if (positions[i].pos - positions[i - 1].pos < MIN_GAP) {
      positions[i].pos = positions[i - 1].pos + MIN_GAP;
    }
  }

  // Right clamp
  let overflowRight = positions[positions.length - 1].pos - (100 - SAFE_OFFSET);
  if (overflowRight > 0) {
    for (let i = 0; i < positions.length; i++) {
      positions[i].pos -= overflowRight;
    }
  }

  // Left clamp
  let overflowLeft = SAFE_OFFSET - positions[0].pos;
  if (overflowLeft > 0) {
    for (let i = 0; i < positions.length; i++) {
      positions[i].pos += overflowLeft;
    }
  }

  // PASS 2 spacing
  for (let i = 1; i < positions.length; i++) {
    if (positions[i].pos - positions[i - 1].pos < MIN_GAP) {
      positions[i].pos = positions[i - 1].pos + MIN_GAP;
    }
  }

  // CLAMP 1
  positions = positions.map((p) => ({
    key: p.key,
    pos: Math.max(SAFE_OFFSET, Math.min(100 - SAFE_OFFSET, p.pos)),
  }));

  // Hard clamp spacing again
  for (let i = 1; i < positions.length; i++) {
    if (positions[i].pos - positions[i - 1].pos < MIN_GAP) {
      positions[i].pos = positions[i - 1].pos + MIN_GAP;

      if (positions[i].pos > 100 - SAFE_OFFSET) {
        const shift = positions[i].pos - (100 - SAFE_OFFSET);
        for (let j = 0; j < positions.length; j++) {
          positions[j].pos -= shift;
        }
      }
    }
  }

  // CLAMP 2
  positions = positions.map((p) => ({
    key: p.key,
    pos: Math.max(SAFE_OFFSET, Math.min(100 - SAFE_OFFSET, p.pos)),
  }));

  // Convert to dictionary
  let finalPos = {};
  positions.forEach((p) => {
    finalPos[p.key] = p.pos;
  });

  // Clamp TEXT inside line
  const clampText = (pos) => {
    const leftLimit = SAFE_OFFSET + 2;
    const rightLimit = 100 - SAFE_OFFSET - 2;
    return Math.max(leftLimit, Math.min(rightLimit, pos));
  };

  ["SUP", "ST", "T", "RES", "SIGNAL", "LIVE"].forEach((k) => {
    if (finalPos[k] !== undefined) finalPos[k] = clampText(finalPos[k]);
  });

  // ----------------- Fill Bar -----------------
  const fillLeft = Math.min(finalPos["SIGNAL"], finalPos["LIVE"]);
  const fillWidth = Math.abs(finalPos["SIGNAL"] - finalPos["LIVE"]);

  // ----------------- RENDER -----------------
  return (
    <div
      className="signal-card-advanced clean-line-layout"
      style={{
        opacity: isClosed ? 0.55 : 1, // GRAY OUT
        filter: isClosed ? "grayscale(70%)" : "none",
      }}
    >
      {/* Header */}
      <div
        className="signal-header"
        style={{
          display: "grid",
          gridTemplateColumns: "auto auto 1fr auto",
          alignItems: "center",
          width: "100%",
        }}
      >
        <span className="signal-time">{formattedTime}</span>

        <span
          className="alert-badge"
          style={{
            backgroundColor:
              alertType?.toLowerCase() === "buy"
                ? "#00C853"
                : alertType?.toLowerCase() === "sell"
                  ? "#E53935"
                  : "#9E9E9E",
            color: "white",
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: "600",
            marginLeft: "6px",
          }}
        >
          {isClosed ? "CLOSED" : alertType?.toUpperCase() || "--"}
        </span>

        <span
          className="signal-script"
          style={{
            textAlign: "center",
            fontWeight: "700",
            color: "#2962ff",
            fontSize: "15px",
            width: "100%",
          }}
        >
          {script || "N/A"}
        </span>

        <span className="signal-confidence">
          {confidence !== null ? `${confidence}%` : "--"}
        </span>
      </div>

      {/* Price line */}
      <div className="indicator-container">
        <div className="indicator-line"></div>

        {/* NO FILL BAR for CLOSED */}
        {!isClosed && (
          <div
            className="indicator-fill"
            style={{
              left: `${fillLeft}%`,
              width: `${fillWidth}%`,
              backgroundColor: color,
            }}
          ></div>
        )}

        {/* SUP */}
        <div className="marker" style={{ left: `${finalPos["SUP"]}%` }}>
          <div className="shape square"></div>
          <div className="label-top">SUP</div>
          <div className="label-bottom">{sup?.toFixed(2) || "--"}</div>
        </div>

        {/* ST */}
        <div className="marker" style={{ left: `${finalPos["ST"]}%` }}>
          <div className="shape line"></div>
          <div className="label-top">ST</div>
          <div className="label-bottom">{st?.toFixed(2) || "--"}</div>
        </div>

        {/* Signal Price */}
        <div className="marker" style={{ left: `${finalPos["SIGNAL"]}%` }}>
          <div className="shape circle"></div>
          <div className="price-bubble">{signalPrice?.toFixed(2) || "--"}</div>
        </div>

        {/* LIVE — Hide on CLOSED */}
        {!isClosed && (
          <div className="marker" style={{ left: `${finalPos["LIVE"]}%` }}>
            <div className="shape triangle"></div>
            <div className="price-bubble price-bubble-live">
              {displayPrice?.toFixed(2) || "--"}
            </div>
          </div>
        )}

        {/* T */}
        <div className="marker" style={{ left: `${finalPos["T"]}%` }}>
          <div className="shape line"></div>
          <div className="label-top">T</div>
          <div className="label-bottom">{t?.toFixed(2) || "--"}</div>
        </div>

        {/* RES */}
        <div className="marker" style={{ left: `${finalPos["RES"]}%` }}>
          <div className="shape square"></div>
          <div className="label-top">RES</div>
          <div className="label-bottom">{res?.toFixed(2) || "--"}</div>
        </div>
      </div>

      {/* Description */}
      <div
        style={{
          background: "#FFF8C4",
          border: "2px solid #F4D03F",
          borderRadius: "8px",
          padding: "10px 12px",
          marginTop: "10px",
          fontSize: "13px",
          lineHeight: "1.4",
        }}
      >
        <div style={{ marginBottom: "6px" }}>
          <strong>Alert:</strong> {alertText || "--"}
        </div>

        <div>
          <strong>Description:</strong> {userActions || "--"}
        </div>
      </div>
    </div>
  );
}
