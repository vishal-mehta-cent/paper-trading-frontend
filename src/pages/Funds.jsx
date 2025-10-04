// frontend/src/pages/Funds.jsx
import React, { useEffect, useState } from "react";
import BackButton from "../components/BackButton";

const API = "http://localhost:8000";

// helpers
const formatINR = (v, decimals = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

// Strip commas safely
const uncomma = (s) => (s || "").toString().replace(/,/g, "");

export default function Funds({ username }) {
  const [total, setTotal] = useState(0);
  const [available, setAvailable] = useState(0);
  const [amountInput, setAmountInput] = useState(""); // text so we can allow commas & decimals
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    if (!username) return;
    reload();
  }, [username]);

  const reload = () => {
    setLoading(true);
    setErr("");
    setOk("");
    fetch(`/funds/available/${username}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch funds");
        return r.json();
      })
      .then((d) => {
        setTotal(Number(d.total_funds || 0));
        setAvailable(Number(d.available_funds || 0));
      })
      .catch((e) => setErr(e.message || "Server error"))
      .finally(() => setLoading(false));
  };

  // Allow only digits and one dot (up to 2 decimals)
  const handleAmountChange = (e) => {
    const raw = e.target.value;
    // Permit commas while typing (we'll strip), and allow up to 2 decimals
    const cleaned = uncomma(raw);
    if (/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === "") {
      setAmountInput(raw);
    }
  };

  // On blur, format with commas (keep up to 2 decimals)
  const handleAmountBlur = () => {
    const cleaned = uncomma(amountInput);
    if (cleaned === "") return;
    const n = Number(cleaned);
    if (Number.isFinite(n)) {
      setAmountInput(n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 }));
    }
  };

  // On focus, remove commas so user can edit easily
  const handleAmountFocus = () => {
    setAmountInput(uncomma(amountInput));
  };

  const addFunds = async () => {
    setErr("");
    setOk("");
    const n = Number(uncomma(amountInput));
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    try {
      const res = await fetch(`${API}/funds/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, amount: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Add funds failed");
      setOk("Funds added successfully.");
      setAmountInput("");
      reload();
    } catch (e) {
      setErr(e.message || "Server error");
    }
  };

  const withdrawFunds = async () => {
    setErr("");
    setOk("");
    const n = Number(uncomma(amountInput));
    if (!Number.isFinite(n) || n <= 0) {
      setErr("Enter a valid amount.");
      return;
    }
    try {
      const res = await fetch(`${API}/funds/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, amount: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || "Withdraw failed");
      setOk("Funds withdrawn successfully.");
      setAmountInput("");
      reload();
    } catch (e) {
      setErr(e.message || "Server error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:max-w-xl md:mx-auto">
      <BackButton to="/profile" />
      <h2 className="text-2xl font-bold text-center mb-4">Funds</h2>

      {loading ? (
        <div className="text-center text-gray-500">Loading…</div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow p-4 mb-4 grid grid-cols-2 gap-3">
            <div className="text-center">
              <div className="text-xs text-gray-500">Total Funds</div>
              <div className="text-xl font-semibold">
                ₹{formatINR(total, 0)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">Available Funds</div>
              <div className="text-xl font-semibold">
                ₹{formatINR(available, 0)}
              </div>
            </div>
          </div>

          {err && (
            <div className="bg-red-100 text-red-700 p-3 rounded mb-3 text-center">
              {err}
            </div>
          )}
          {ok && (
            <div className="bg-green-100 text-green-700 p-3 rounded mb-3 text-center">
              {ok}
            </div>
          )}

          <div className="bg-white rounded-xl shadow p-4">
            <label className="block text-sm text-gray-600 mb-1">
              Amount (₹)
            </label>
            <input
              type="text"
              inputMode="decimal"
              placeholder="e.g. 1,000.50"
              value={amountInput}
              onChange={handleAmountChange}
              onBlur={handleAmountBlur}
              onFocus={handleAmountFocus}
              className="w-full px-4 py-3 border rounded-lg"
            />

            <div className="flex justify-center w-full">
              <button
                onClick={addFunds}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Add Funds
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}