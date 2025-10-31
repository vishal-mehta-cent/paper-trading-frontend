// frontend/src/pages/Payments.jsx
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

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [amountInr, setAmountInr] = useState(199);

  const [upiApp, setUpiApp] = useState("");
  const [upiQR, setUpiQR] = useState(null);
  const [loadingUpi, setLoadingUpi] = useState(false);

  // ------ International Stripe ------
  const [intlCurrency, setIntlCurrency] = useState("USD");
  const [intlAmountMinor, setIntlAmountMinor] = useState(1999);
  const [clientSecret, setClientSecret] = useState(null);
  const [publishableKey, setPublishableKey] = useState(null);
  const [loadingStripeInit, setLoadingStripeInit] = useState(false);
  const [stripeInitError, setStripeInitError] = useState("");

  const initStripe = async (currency = "usd") => {
    setLoadingStripeInit(true);
    setStripeInitError("");
    try {
      const receipt = `${currency}_${Date.now()}`;
      const { ok, data } = await postJSON(`${API}/payments/stripe/intent`, {
        amount_minor: Number(intlAmountMinor),
        currency,
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
    return { clientSecret, appearance: { theme: "stripe" } };
  }, [clientSecret]);

  // ---------- Generate UPI QR ----------
  const genUpiQr = async () => {
    setLoadingUpi(true);
    try {
      const tr = `upi_${Date.now()}`;
      const { ok, data } = await postJSON(`${API}/payments/upi/qr`, {
        pa: "9426817879.etb@icici",
        pn: "NeuroCrest",
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

  // ---------- Hybrid UPI Function ----------
  const openUPI = async (app) => {
    setUpiApp(app);
    const uri = `upi://pay?pa=yourmerchant@icici&pn=NeuroCrest&am=${amountInr}&tn=Payment%20via%20${app}`;
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

    if (isMobile) {
      // ✅ Directly open UPI app on mobile
      window.location.href = uri;
    } else {
      // 💻 Desktop fallback
      try {
        const { ok, data } = await postJSON(`${API}/payments/upi/qr`, {
          pa: "9426817879.etb@icici",
          pn: "NeuroCrest",
          amount_inr: Number(amountInr),
          tr: `upi_${Date.now()}`,
          tn: `UPI Payment via ${app}`,
        });

        if (ok) {
          setUpiQR(data);
          setTab("upi"); // Switch to UPI QR tab automatically
          alert(
            `Desktop browsers can’t open ${app} directly.\nA QR has been generated below.\nScan it with ${app} or any UPI app.`
          );
        } else {
          // 2️⃣ Fallback – copy UPI link
          await navigator.clipboard.writeText(uri);
          alert("QR unavailable. UPI link copied to clipboard — paste in your UPI app.");
        }
      } catch (err) {
        await navigator.clipboard.writeText(uri);
        alert("Copied UPI payment link to clipboard.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 px-4 py-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <BackButton to="/profile" />
        <h1 className="text-2xl font-bold">Payments</h1>

        {/* Customer Info */}
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
            India (UPI)
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

        {/* INDIA: UPI */}
        {tab === "india" && (
          <Section title="Pay via UPI Apps">
            <label className="text-sm text-gray-600">Amount (₹)</label>
            <input
              type="number"
              min="1"
              className="border rounded px-3 py-2 w-full mb-3"
              value={amountInr}
              onChange={(e) => setAmountInr(e.target.value)}
            />
            <div className="flex flex-wrap gap-3">
              {["Google Pay", "PhonePe", "Paytm"].map((app) => (
                <button
                  key={app}
                  onClick={() => openUPI(app)}
                  className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                >
                  {app}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* UPI QR (Direct) */}
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
            {upiQR && (
              <div className="flex flex-col items-center mt-3 space-y-2">
                <img
                  src={`data:image/png;base64,${upiQR.qr_b64}`}
                  alt="UPI QR"
                  className="w-48 h-48 border rounded"
                />
                <a href={upiQR.upi_uri} className="text-blue-600 underline">
                  Open in UPI App
                </a>
              </div>
            )}
          </Section>
        )}

        {/* International (Stripe) */}
        {tab === "intl" && (
          <Section title="International Payments (Stripe)">
            <label className="text-sm text-gray-600">Amount (minor units)</label>
            <input
              type="number"
              min="1"
              className="border rounded px-3 py-2 w-full mb-3"
              value={intlAmountMinor}
              onChange={(e) => setIntlAmountMinor(e.target.value)}
            />
            <button
              onClick={() => initStripe("usd")}
              disabled={loadingStripeInit}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
            >
              {loadingStripeInit ? "Preparing…" : "Initialize Stripe Payment"}
            </button>

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
                  You’ll be charged {(Number(intlAmountMinor) / 100).toFixed(2)} USD.
                </p>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
