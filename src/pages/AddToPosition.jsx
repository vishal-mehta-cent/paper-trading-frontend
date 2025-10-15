// frontend/src/pages/AddToPosition.jsx
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import BackButton from "../components/BackButton";

const API =
    import.meta.env.VITE_BACKEND_BASE_URL ||
    "https://paper-trading-backend.onrender.com";

export default function AddToPosition() {
    const { symbol } = useParams();
    const nav = useNavigate();
    const location = useLocation();
    const prefill = location.state || {};

    // Mode flags
    const isModify = Boolean(prefill.modifyId || prefill.fromModify);
    const isAdd = Boolean(prefill.fromAdd);

    // Prefill inputs
    const [qty, setQty] = useState(prefill.qty || "");
    const [price, setPrice] = useState(prefill.price || "");
    const [exchange, setExchange] = useState(prefill.exchange || "NSE");
    const [segment, setSegment] = useState(prefill.segment || "intraday");
    const [stoploss, setStoploss] = useState(prefill.stoploss || "");
    const [target, setTarget] = useState(prefill.target || "");
    const [orderMode, setOrderMode] = useState(prefill.orderMode || "MARKET");

    const [errorMsg, setErrorMsg] = useState("");
    const [successModal, setSuccessModal] = useState(false);
    const [successText, setSuccessText] = useState("");
    const [livePrice, setLivePrice] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    const username = localStorage.getItem("username");
    const userEditedPrice = useRef(false);

    // -------- Check market time (UTC based) --------
    useEffect(() => {
        const nowUTC = new Date();
        const hours = nowUTC.getUTCHours();
        const minutes = nowUTC.getUTCMinutes();

        // Indian Market 09:15–15:30 IST = 03:45–10:00 UTC
        const MARKET_OPEN_UTC = { h: 3, m: 45 };
        const MARKET_CLOSE_UTC = { h: 10, m: 0 };

        const nowMinutes = hours * 60 + minutes;
        const openMinutes = MARKET_OPEN_UTC.h * 60 + MARKET_OPEN_UTC.m;
        const closeMinutes = MARKET_CLOSE_UTC.h * 60 + MARKET_CLOSE_UTC.m;

        const isMarketOpen = nowMinutes >= openMinutes && nowMinutes <= closeMinutes;

        if (!isMarketOpen && !isModify && !isAdd) {
            const confirmProceed = window.confirm(
                "⚠️ Market (UTC 03:45–10:00) is closed. Do you still want to place a BUY order?"
            );
            if (!confirmProceed) {
                nav(`/script/${symbol}`);
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
    }, [symbol, orderMode, price]);

    // ✅ MAIN FUNCTION: Add / Modify Position
    const handleModifyPosition = async () => {
        try {
            if (submitting) return;
            setSubmitting(true);

            const qtyNum = Number(qty);
            if (!qtyNum || qtyNum <= 0) throw new Error("Enter valid quantity");

            const payload = {
                username,
                script: symbol.toUpperCase(),
                new_qty: qtyNum,
                stoploss: stoploss ? Number(stoploss) : null,
                target: target ? Number(target) : null,
                price_type: orderMode,
                limit_price: orderMode === "LIMIT" ? Number(price) : null,
            };

            console.log("➡️ Sending payload:", payload);

            // ✅ FIX: Use correct backend path (/orders/positions/modify)
            const res = await fetch(`${API}/orders/positions/modify`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            console.log("⬅️ Response:", data);

            if (!res.ok)
                throw new Error(data.detail || data.message || "Error modifying position");

            toast.success("✅ Position modified successfully!");
            setSuccessText("Position updated successfully ✅");
            setSuccessModal(true);

            setTimeout(() => {
                setSuccessModal(false);
                nav("/orders", { state: { refresh: true, tab: "positions" } });
            }, 1200);
        } catch (err) {
            console.error("Modify error:", err);
            toast.error(err.message || "Something went wrong");
            setErrorMsg(err.message || "Server error");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 md:max-w-xl md:mx-auto flex flex-col justify-between">
            <BackButton to="/orders" />
            <div className="space-y-5">
                <h2 className="text-2xl font-bold text-center text-green-600">
                    {`ADD TO ${symbol}`}
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
                        className={`w-1/2 py-2 rounded-l-lg ${segment === "intraday"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200"
                            }`}
                    >
                        Intraday
                    </button>
                    <button
                        onClick={() => setSegment("delivery")}
                        className={`w-1/2 py-2 rounded-r-lg ${segment === "delivery"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200"
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
                type="button" // ✅ prevent accidental form submission
                onClick={handleModifyPosition}
                disabled={submitting}
                className={`mt-6 w-full py-3 text-white text-lg font-semibold rounded-lg ${submitting
                    ? "bg-green-400 cursor-not-allowed"
                    : "bg-green-600 hover:bg-green-700"
                    }`}
            >
                {submitting ? "Processing…" : "Add to Position"}
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
