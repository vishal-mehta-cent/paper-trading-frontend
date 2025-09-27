// src/pages/Payments.jsx
import React, { useCallback, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import BackButton from "../components/BackButton";

const API = import.meta.env.VITE_BACKEND_BASE_URL || "http://127.0.0.1:8000";

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
  const [tab, setTab] = useState("india"); // "india" | "upi" | "intl"

  // Shared fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // ------ India: Razorpay ------
  const [amountInr, setAmountInr] = useState(199);
  const [loadingRzp, setLoadingRzp] = useState(false);

  const startRazorpay = async () => {
    setLoadingRzp(true);
    try {
      const receipt = `order_${Date.now()}`;
      const { ok, data } = await postJSON(`${API}/payments/razorpay/order`, {
        amount_inr: Number(amountInr),
        receipt,
        customer_name: username || "",
        customer_email: email || "",
        customer_phone: phone || "",
      });
      if (!ok) throw new Error(data?.detail || "Failed to create order");
      const opts = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "NeuroCrest",
        description: `Order ${receipt}`,
        order_id: data.order_id,
        prefill: data.prefill || {},
        method: { upi: true, netbanking: true, card: true, wallet: true },
        upi: { flow: "intent" },
        handler: function () {
          alert("Payment processing. Confirmation will appear shortly.");
        },
        modal: { ondismiss: () => {} },
      };
      if (!window.Razorpay) {
        alert(
          "Razorpay SDK not found. Add <script src='https://checkout.razorpay.com/v1/checkout.js'></script> in index.html"
        );
        return;
      }
      const rzp = new window.Razorpay(opts);
      rzp.open();
    } catch (e) {
      alert(e?.message || "Could not start Razorpay");
    } finally {
      setLoadingRzp(false);
    }
  };

  // ------ UPI QR (raw UPI) ------
  const [upiVpa, setUpiVpa] = useState("yourmerchant@icici"); // your receiving VPA
  const [upiName, setUpiName] = useState("NeuroCrest");
  const [upiAmount, setUpiAmount] = useState(199);
  const [upiQR, setUpiQR] = useState(null);
  const [loadingUpi, setLoadingUpi] = useState(false);

  const genUpiQr = async () => {
    setLoadingUpi(true);
    try {
      const tr = `upi_${Date.now()}`;
      const { ok, data } = await postJSON(`${API}/payments/upi/qr`, {
        pa: upiVpa,
        pn: upiName,
        amount_inr: Number(upiAmount),
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

  // ------ International: Stripe ------
  const [intlCurrency, setIntlCurrency] = useState("USD");
  const [intlAmountMinor, setIntlAmountMinor] = useState(1999); // $19.99 -> 1999
  const [clientSecret, setClientSecret] = useState(null);
  const [publishableKey, setPublishableKey] = useState(null);
  const [loadingStripeInit, setLoadingStripeInit] = useState(false);
  const [stripeInitError, setStripeInitError] = useState("");

  const initStripe = async () => {
    setLoadingStripeInit(true);
    setStripeInitError("");
    try {
      const receipt = `intl_${Date.now()}`;
      const { ok, data } = await postJSON(`${API}/payments/stripe/intent`, {
        amount_minor: Number(intlAmountMinor),
        currency: intlCurrency,
        receipt,
        customer_email: email || undefined,
      });
      if (!ok) throw new Error(data?.detail || "Stripe init failed");
      setClientSecret(data.clientSecret);
      setPublishableKey(data.publishableKey);
    } catch (e) {
      setStripeInitError(e?.message || "Failed to initialize Stripe");
    } finally {
      setLoadingStripeInit(false);
    }
  };

  const stripePromise = useMemo(() => {
    if (!publishableKey) return null;
    return loadStripe(publishableKey);
  }, [publishableKey]);

  const elementsOptions = useMemo(() => {
    if (!clientSecret) return null;
    return {
      clientSecret,
      appearance: { theme: "stripe" },
    };
  }, [clientSecret]);

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Back to Profile */}
        <BackButton to="/profile" />

        <h1 className="text-2xl font-bold">Payments</h1>

        {/* User info for prefill */}
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

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab("india")}
            className={`px-4 py-2 rounded ${
              tab === "india" ? "bg-blue-600 text-white" : "bg-white"
            }`}
          >
            India (Razorpay)
          </button>
          <button
            onClick={() => setTab("upi")}
            className={`px-4 py-2 rounded ${
              tab === "upi" ? "bg-blue-600 text-white" : "bg-white"
            }`}
          >
            UPI QR (Direct)
          </button>
          <button
            onClick={() => setTab("intl")}
            className={`px-4 py-2 rounded ${
              tab === "intl" ? "bg-blue-600 text-white" : "bg-white"
            }`}
          >
            International (Stripe)
          </button>
        </div>

        {/* INDIA: Razorpay */}
        {tab === "india" && (
          <Section
            title={
              <span>
                Pay in INR{" "}
                <button
                  type="button"
                  onClick={startRazorpay}
                  className="underline text-blue-600 hover:text-blue-700 cursor-pointer"
                  title="Click to pay with Razorpay"
                >
                  (UPI / NetBanking / Card / Wallet)
                </button>
              </span>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-sm text-gray-600">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  className="border rounded px-3 py-2 w-full"
                  value={amountInr}
                  onChange={(e) => setAmountInr(e.target.value)}
                />
              </div>
              <div className="md:col-span-3">
                <button
                  onClick={startRazorpay}
                  disabled={loadingRzp}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
                >
                  {loadingRzp ? "Starting…" : `Pay ₹${Number(amountInr || 0)}`}
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">Requires Razorpay SDK in index.html.</p>
          </Section>
        )}

        {/* UPI QR */}
        {tab === "upi" && (
          <Section title="UPI QR (No gateway — manual reconciliation)">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="text-sm text-gray-600">Your VPA</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={upiVpa}
                  onChange={(e) => setUpiVpa(e.target.value)}
                  placeholder="yourmerchant@icici"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Payee Name</label>
                <input
                  className="border rounded px-3 py-2 w-full"
                  value={upiName}
                  onChange={(e) => setUpiName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  className="border rounded px-3 py-2 w-full"
                  value={upiAmount}
                  onChange={(e) => setUpiAmount(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={genUpiQr}
                  disabled={loadingUpi}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
                >
                  {loadingUpi ? "Generating…" : "Generate QR"}
                </button>
              </div>
            </div>

            {upiQR && (
              <div className="flex flex-col items-center pt-3 space-y-2">
                <img
                  src={`data:image/png;base64,${upiQR.qr_b64}`}
                  alt="UPI QR"
                  className="w-48 h-48 border rounded"
                />
                <a href={upiQR.upi_uri} className="text-blue-600 underline">
                  Open in UPI App
                </a>
                <p className="text-xs text-gray-500">
                  Note: This direct UPI flow won’t auto-confirm on server. Prefer Razorpay for automated confirmations via webhooks.
                </p>
              </div>
            )}
          </Section>
        )}

        {/* INTERNATIONAL: Stripe */}
        {tab === "intl" && (
          <Section title="International (Cards / Apple Pay / Google Pay via Stripe)">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="text-sm text-gray-600">Currency</label>
                <select
                  className="border rounded px-3 py-2 w-full"
                  value={intlCurrency}
                  onChange={(e) => setIntlCurrency(e.target.value)}
                >
                  <option>USD</option>
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>AUD</option>
                  <option>CAD</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-600">
                  Amount (minor units) — e.g., USD 19.99 → 1999
                </label>
                <input
                  type="number"
                  min="50"
                  className="border rounded px-3 py-2 w-full"
                  value={intlAmountMinor}
                  onChange={(e) => setIntlAmountMinor(e.target.value)}
                />
              </div>
              <div>
                <button
                  onClick={initStripe}
                  disabled={loadingStripeInit}
                  className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
                >
                  {loadingStripeInit ? "Preparing…" : "Initialize"}
                </button>
              </div>
            </div>

            {stripeInitError && (
              <div className="text-sm text-red-600 bg-red-50 rounded px-3 py-2 mt-2">
                {stripeInitError}
              </div>
            )}

            {publishableKey && clientSecret && (
              <div className="mt-3">
                <Elements stripe={stripePromise} options={elementsOptions}>
                  <StripeCheckoutForm
                    onSuccess={() => alert("✅ Payment successful")}
                    onError={(m) => alert(m)}
                  />
                </Elements>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  You’ll be charged {(Number(intlAmountMinor) / 100).toFixed(2)} {intlCurrency}.
                </p>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
