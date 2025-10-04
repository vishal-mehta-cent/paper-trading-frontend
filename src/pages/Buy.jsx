// frontend/src/pages/Buy.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import BackButton from "../components/BackButton";

const API = import.meta.env.VITE_BACKEND_BASE_URL || "https://paper-trading-backend.onrender.com"; // backend API base

export default function Buy() {
  const { symbol } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const prefill = location.state || {};

  // Mode flags
  const isModify = Boolean(prefill.modifyId || prefill.fromModify);
  const isAdd = Boolean(prefill.fromAdd);

  // Prefill inputs if passed
  const [qty, setQty] = useState(prefill.qty || "");
  const [price, setPrice] = useState(prefill.price || "");
  const [exchange, setExchange] = useState(prefill.exchange || "NSE");
  const [segment, setSegment] = useState(prefill.segment || "intraday");
  const [stoploss, setStoploss] = useState(prefill.stoploss || "");
  const [target, setTarget] = useState(prefill.target || "");

  const [errorMsg, setErrorMsg] = useState("");
  const [successModal, setSuccessModal] = useState(false);
  const [successText, setSuccessText] = useState("");
  const [livePrice, setLivePrice] = useState(null);

  const [orderMode, setOrderMode] = useState(prefill.orderMode || "MARKET");
  const [submitting, setSubmitting] = useState(false);

  const username = localStorage.getItem("username");
  const userEditedPrice = useRef(false);

  // -------- Check market time on mount --------
  useEffect(() => {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setHours(10, 0, 0, 0); // 3:45 PM

    if (now > cutoff && !isModify && !isAdd) {
      const confirmProceed = window.confirm(
        "⚠️ Market is closed. Do you still want to place a BUY order?"
      );
      if (!confirmProceed) {
        nav(`/script/${symbol}`); // back to script detail page
      }
    }
  }, [nav, symbol, isModify, isAdd]);

  // -------- Live price polling --------
  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;

    const fetchLive = async () => {
      try {
        const res = await fetch(`${API}/quotes?symbols=${symbol}`);
        const data = await res.json();
        if (!cancelled && data && data[0]) {
          const live = Number(data[0].price);
          if (Number.isFinite(live)) {
            setLivePrice(live);

            if (orderMode === "LIMIT" && !price && !userEditedPrice.current) {
              setPrice(live.toFixed(2));
            }
          }
        }
      } catch { }
    };

    fetchLive();
    const id = setInterval(fetchLive, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, orderMode]);

  // -------- Submit --------
  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    setErrorMsg("");
    setSuccessText("");

    try {
      if (!username) throw new Error("❌ Please login again.");
      if (!symbol) throw new Error("❌ Invalid symbol.");

      const qtyNum = Number(qty);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
        throw new Error("❌ Please enter a valid quantity (> 0).");
      }

      const payload = {
        username,
        script: symbol.toUpperCase(),
        order_type: "BUY",
        qty: qtyNum,
        exchange,
        segment,
        price: orderMode === "LIMIT" ? Number(price) : null,
        stoploss: stoploss !== "" ? Number(stoploss) : null,
        target: target !== "" ? Number(target) : null,
      };

      if (orderMode === "LIMIT") {
        const px = Number(price);
        if (!Number.isFinite(px) || px <= 0) {
          throw new Error("❌ Please enter a valid limit price.");
        }
        payload.price = px;
      }

      let res, data;

      if (isAdd) {
        res = await fetch(`${API}/orders/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else if (isModify) {
        res = await fetch(`${API}/orders/${prefill.modifyId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API}/orders`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Order failed");

      // ✅ Success message mapping you asked for:
      if (isAdd) {
        setSuccessText("Added to Position ✅");
      } else if (isModify) {
        setSuccessText("Modify Successful ✅");
      } else if (orderMode === "LIMIT") {
        // LIMIT: show "Order Successful"
        setSuccessText("Order Successful ✅");
      } else {
        // MARKET: show "Buy Successful"
        setSuccessText("Buy Successful ✅");
      }

      setSuccessModal(true);

      setTimeout(() => {
        setSuccessModal(false);
        // Keep your existing redirection logic:
        if (data && data.triggered) {
          nav("/orders", { state: { refresh: true, tab: "positions" } });
        } else {
          nav("/orders", { state: { refresh: true, tab: "open" } });
        }
      }, 1500);
    } catch (e) {
      setErrorMsg(e.message || "Server error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:max-w-xl md:mx-auto flex flex-col justify-between">
      <BackButton to="/orders" />
      <div className="space-y-5">
        <h2 className="text-2xl font-bold text-center text-green-600">
          {isAdd
            ? `ADD TO ${symbol}`
            : isModify
              ? "MODIFY ORDER"
              : `BUY ${symbol}`}
        </h2>

        {errorMsg && (
          <div className="text-red-700 bg-red-100 p-3 rounded text-center">
            {errorMsg}
          </div>
        )}

        <div className="text-sm text-center text-gray-700 mb-2">
          Live Price:{" "}
          <span className="font-semibold text-green-600">
            {livePrice != null ? `₹${livePrice}` : "--"}
          </span>
        </div>

        <div className="flex justify-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="ordermode"
              value="MARKET"
              checked={orderMode === "MARKET"}
              onChange={() => setOrderMode("MARKET")}
            />
            <span>Market</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="ordermode"
              value="LIMIT"
              checked={orderMode === "LIMIT"}
              onChange={() => setOrderMode("LIMIT")}
            />
            <span>Limit</span>
          </label>
        </div>

        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          placeholder="Quantity"
          className="w-full px-4 py-3 border rounded-lg"
        />

        <input
          type="number"
          value={orderMode === "LIMIT" ? price : ""}
          onChange={(e) => {
            setPrice(e.target.value);
            userEditedPrice.current = true;
          }}
          placeholder={
            orderMode === "LIMIT"
              ? "Enter Limit Price"
              : "Disabled for Market orders"
          }
          className={`w-full px-4 py-3 border rounded-lg ${orderMode === "MARKET" ? "bg-gray-100 cursor-not-allowed" : ""
            }`}
          disabled={orderMode === "MARKET"}
        />

        <div className="flex justify-between">
          <button
            onClick={() => setSegment("intraday")}
            className={`w-1/2 py-2 rounded-l-lg ${segment === "intraday" ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
          >
            Intraday
          </button>
          <button
            onClick={() => setSegment("delivery")}
            className={`w-1/2 py-2 rounded-r-lg ${segment === "delivery" ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
          >
            Delivery
          </button>
        </div>

        <div className="flex justify-between">
          <button
            onClick={() => setExchange("NSE")}
            className={`w-1/2 py-2 rounded-l-lg ${exchange === "NSE" ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
          >
            NSE
          </button>
          <button
            onClick={() => setExchange("BSE")}
            className={`w-1/2 py-2 rounded-r-lg ${exchange === "BSE" ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
          >
            BSE
          </button>
        </div>

        <input
          type="number"
          value={stoploss}
          onChange={(e) => setStoploss(e.target.value)}
          placeholder="Stoploss (optional)"
          className="w-full px-4 py-3 border rounded-lg"
        />
        <input
          type="number"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Target (optional)"
          className="w-full px-4 py-3 border rounded-lg"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className={`mt-6 w-full py-3 text-white text-lg font-semibold rounded-lg ${submitting
            ? "bg-green-400 cursor-not-allowed"
            : "bg-green-600 hover:bg-green-700"
          }`}
      >
        {submitting
          ? "Processing…"
          : isAdd
            ? "Add to Position"
            : isModify
              ? "Save Changes"
              : "BUY"}
      </button>

      {successModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl text-center shadow-lg">
            <div className="mb-3">
              <div className="animate-bounce text-green-600 text-6xl">✅</div>
            </div>
            <p className="text-lg font-semibold text-green-700">
              {successText || "Order saved"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

