import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "../components/BackButton";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";

const API = import.meta.env.VITE_BACKEND_BASE_URL || "http://127.0.0.1:8000";

// ---------- small helpers ----------
async function postJSON(url, body) {
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
}

// ---------- Stripe inner form (kept as-is; not used on this page) ----------
function StripeCheckoutForm({ onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");

  const handlePay = useCallback(async () => {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setMsg("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      const text = error.message || "Payment failed. Please try again.";
      setMsg(text);
      onError?.(text, error);
    } else if (paymentIntent) {
      if (paymentIntent.status === "succeeded") {
        setMsg("✅ Payment successful.");
        onSuccess?.(paymentIntent);
      } else if (paymentIntent.status === "processing") {
        setMsg("⏳ Payment processing. You’ll be notified once complete.");
      } else {
        setMsg(`ℹ️ Status: ${paymentIntent.status}`);
      }
    }
    setSubmitting(false);
  }, [elements, onError, onSuccess, stripe]);

  return (
    <div className="space-y-3">
      <PaymentElement />
      {msg && (
        <div className="text-sm text-gray-700 bg-gray-100 rounded px-3 py-2">
          {msg}
        </div>
      )}
      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || !elements || submitting}
        className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting ? "Processing…" : "Pay"}
      </button>
    </div>
  );
}

export default function Profile({ username, logout }) {
  const nav = useNavigate();

  // existing state (kept)
  const [funds, setFunds] = useState(0);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const userEmail = `${username.toLowerCase().replace(/ /g, "")}@gmail.com`;

  // NEW earlier: toggle for the Payment panel (kept but unused now)
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);

  // fetch funds (unchanged; just not displayed)
  useEffect(() => {
    fetch(`${API}/funds/available/${username}`)
      .then((res) => res.json())
      .then((data) => setFunds(data.total_funds || 0))
      .catch(() => setFunds(0));
  }, [username]);

  // ===== Payment state/handlers (kept exactly as your code) =====
  // INR / Razorpay
  const [amountInr, setAmountInr] = useState(199);
  const [loadingRzp, setLoadingRzp] = useState(false);

  // Direct UPI QR
  const [upiVpa, setUpiVpa] = useState("yourmerchant@icici");
  const [upiName, setUpiName] = useState("NeuroCrest");
  const [upiAmount, setUpiAmount] = useState(199);
  const [upiQR, setUpiQR] = useState(null);
  const [loadingUpi, setLoadingUpi] = useState(false);

  // Stripe / Intl
  const [intlCurrency, setIntlCurrency] = useState("USD");
  const [intlAmountMinor, setIntlAmountMinor] = useState(1999); // $19.99 -> 1999
  const [clientSecret, setClientSecret] = useState(null);
  const [publishableKey, setPublishableKey] = useState(null);
  const [loadingStripeInit, setLoadingStripeInit] = useState(false);
  const [stripeInitError, setStripeInitError] = useState("");

  const stripePromise = useMemo(
    () => (publishableKey ? loadStripe(publishableKey) : null),
    [publishableKey]
  );

  // Actions (kept)
  const startRazorpay = async () => {
    setLoadingRzp(true);
    try {
      const receipt = `order_${Date.now()}`;
      const { ok, data } = await postJSON(`${API}/payments/razorpay/order`, {
        amount_inr: Number(amountInr),
        receipt,
        customer_name: username,
        customer_email: userEmail,
        customer_phone: "",
      });
      if (!ok) throw new Error(data?.detail || "Failed to create order");

      if (!window.Razorpay) {
        alert(
          "Razorpay SDK not found. Add <script src='https://checkout.razorpay.com/v1/checkout.js'></script> in index.html"
        );
        return;
      }

      const rzp = new window.Razorpay({
        key: data.key_id,
        amount: data.amount,
        currency: data.currency,
        name: "NeuroCrest",
        description: `Add Funds • ${receipt}`,
        order_id: data.order_id,
        prefill: data.prefill || {},
        method: { upi: true, netbanking: true, card: true, wallet: true },
        upi: { flow: "intent" },
        handler: function () {
          alert("Payment processing. Confirmation will appear shortly.");
        },
        modal: { ondismiss: () => {} },
      });
      rzp.open();
    } catch (e) {
      alert(e?.message || "Could not start Razorpay");
    } finally {
      setLoadingRzp(false);
    }
  };

  const genUpiQr = async () => {
    setLoadingUpi(true);
    try {
      const tr = `upi_${Date.now()}`;
      const { ok, data } = await postJSON(`${API}/payments/upi/qr`, {
        pa: upiVpa,
        pn: upiName,
        amount_inr: Number(upiAmount),
        tr,
        tn: "NeuroCrest Add Funds",
      });
      if (!ok) throw new Error(data?.detail || "Failed to create UPI QR");
      setUpiQR(data);
    } catch (e) {
      alert(e?.message || "Could not generate UPI QR");
    } finally {
      setLoadingUpi(false);
    }
  };

  const initStripe = async () => {
    setLoadingStripeInit(true);
    setStripeInitError("");
    try {
      const receipt = `intl_${Date.now()}`;
      const { ok, data } = await postJSON(`${API}/payments/stripe/intent`, {
        amount_minor: Number(intlAmountMinor),
        currency: intlCurrency,
        receipt,
        customer_email: userEmail,
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

  return (
    <div className="min-h-screen bg-white p-4">
      <BackButton to="/menu" />
      <h2 className="text-xl font-bold text-center text-blue-600 mb-6">ACCOUNT</h2>

      {/* Avatar and Info (email first, then name; funds hidden) */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-20 h-20 rounded-full bg-gray-300" />
        <h3 className="font-semibold">{username}</h3>
        {/* Available Funds removed */}
      </div>

      {/* Buttons */}
      <div className="space-y-3">
        <button
          onClick={() => nav("/profile/details")}
          className="w-full border rounded p-2 text-left"
        >
          👤 Profile
        </button>

        <button
          onClick={() => nav("/profile/funds")}
          className="w-full border rounded p-2 text-left"
        >
          💰 Funds
        </button>

        {/* ✅ Payment now NAVIGATES to /payments (fixed click + cleaned JSX) */}
        <button
          onClick={() => nav("/payments")}
          className="w-full border rounded p-2 text-left"
        >
          💳 Payment
        </button>

        <button
          onClick={() => nav("/settings")}
          className="w-full border rounded p-2 text-left"
        >
          ⚙️ Settings
        </button>

        <button
          onClick={() => nav("/history")}
          className="w-full border rounded p-2 text-left"
        >
          🧾 History
        </button>

        <button
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full border rounded p-2 text-left text-red-600"
        >
          🚪 Logout
        </button>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center max-w-xs w-full">
            <p className="text-lg font-semibold mb-4">Do you want to logout?</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="px-4 py-2 rounded bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                No
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
