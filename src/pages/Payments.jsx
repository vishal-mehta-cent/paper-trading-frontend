import React, { useCallback, useMemo, useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import BackButton from "../components/BackButton";

// ✅ Auto-detect correct backend
const API =
  import.meta.env.VITE_BACKEND_BASE_URL?.trim() ||
  "https://api.neurocrest.in";

// ------------------ helpers ------------------
const postJSON = async (url, body) => {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  return { ok: res.ok, status: res.status, data };
};

const Section = ({ title, children }) => (
  <div className="bg-white rounded-xl shadow p-4 space-y-3">
    <h3 className="text-lg font-semibold">{title}</h3>
    {children}
  </div>
);

// ------------------ Stripe inner form ------------------
function StripeCheckoutForm({ onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const pay = useCallback(async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setMsg("");
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });
    if (error) {
      const m = error.message || " ❌ Payment failed.";
      setMsg(m);
      onError?.(m, error);
    } else if (paymentIntent) {
      if (paymentIntent.status === "succeeded") {
        setMsg("✅ Payment successful.");
        onSuccess?.(paymentIntent);
      } else if (paymentIntent.status === "processing") {
        setMsg("⏳ Processing…");
      } else {
        setMsg(`ℹ️ ${paymentIntent.status}`);
      }
    }
    setSubmitting(false);
  }, [elements, onError, onSuccess, stripe]);

  return (
    <div className="space-y-3">
      <PaymentElement />
      {msg && (
        <div className="text-sm bg-gray-100 text-gray-700 rounded px-3 py-2">
          {msg}
        </div>
      )}
      <button
        type="button"
        onClick={pay}
        disabled={!stripe || !elements || submitting}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting ? "Processing…" : "Pay"}
      </button>
    </div>
  );
}

// ================== MAIN PAGE ==================
export default function Payments() {
  const [tab, setTab] = useState("upi");

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amountInr, setAmountInr] = useState(1);

  const [upiQR, setUpiQR] = useState(null);
  const [loadingUpi, setLoadingUpi] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  // ---------- Generate UPI QR ----------
  const genUpiQr = async () => {
    setLoadingUpi(true);
    try {
      const tr = `upi_${Date.now()}`;
      const { ok, data } = await postJSON(`${API}/payments/upi/qr`, {
        pa: "9426817879.etb@icici",
        pn: "VISHAL H MEHTA",
        amount_inr: Number(amountInr),
        tr,
        tn: "NeuroCrest Payment",
      });
      if (!ok) throw new Error(data?.detail || "Failed to create UPI QR");
      setUpiQR(data);
    } catch (e) {
      alert(e?.message || "Could not generate UPI QR");
    } finally {
      setLoadingUpi(false);
    }
  };

  // ---------- Auto “Payment Received” popup ----------
  useEffect(() => {
    if (upiQR) {
      const timer = setTimeout(() => {
        alert("✅ Payment Received Successfully!");
        setPaymentDone(true);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [upiQR]);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <BackButton to="/profile" />
        <h1 className="text-2xl font-bold">Payments</h1>

        <Section title="Customer Details (optional but recommended)">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              className="border rounded px-3 py-2"
              placeholder="Name / Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="border rounded px-3 py-2"
              placeholder="Phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </Section>

        <div className="flex gap-2">
          <button
            onClick={() => setTab("upi")}
            className={`px-4 py-2 rounded ${
              tab === "upi" ? "bg-blue-600 text-white" : "bg-white"
            }`}
          >
            UPI QR (Direct)
          </button>
        </div>

        {tab === "upi" && (
          <Section title="UPI QR (Manual Scan)">
            <div className="flex gap-3 items-end">
              <input
                type="number"
                min="1"
                className="border rounded px-3 py-2 w-full"
                value={amountInr}
                onChange={(e) => setAmountInr(e.target.value)}
              />
              <button
                onClick={genUpiQr}
                disabled={loadingUpi}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60"
              >
                {loadingUpi ? "Generating…" : "Generate QR"}
              </button>
            </div>

            {upiQR && !paymentDone && (
              <div className="flex flex-col items-center mt-3 space-y-2">
                <img
                  src={`data:image/png;base64,${upiQR.qr_b64}`}
                  alt="UPI QR"
                  className="w-48 h-48 border rounded"
                />
                <a href={upiQR.upi_uri} className="text-blue-600 underline">
                  Open in UPI App
                </a>
                <p className="text-sm text-gray-500 text-center">
                  Scan this QR to pay ₹{amountInr}. Please wait for
                  confirmation…
                </p>
              </div>
            )}

            {paymentDone && (
              <div className="flex flex-col items-center mt-3 space-y-2 text-green-600">
                <p className="text-xl font-semibold">
                  ✅ Payment Received Successfully!
                </p>
                <p className="text-gray-600">Thank you for your payment.</p>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
