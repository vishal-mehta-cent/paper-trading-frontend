// frontend/src/pages/Feedback.jsx
import React, { useState } from "react";
import BackButton from "../components/BackButton";

export default function Feedback() {
  const [tab, setTab] = useState("feedback");

  // Feedback form state
  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");

  // Contact form state
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");

  // ---------------------- FEEDBACK FORM ----------------------
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!feedbackName.trim() || !feedbackMessage.trim()) {
      alert("⚠️ Please fill in both Name and Feedback fields");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: feedbackName,
          message: feedbackMessage,
        }),
      });

      if (res.ok) {
        alert("✅ Feedback submitted successfully");
        setFeedbackName("");
        setFeedbackMessage("");
      } else {
        console.error("❌ Feedback Error:", await res.text());
        alert("❌ Failed to submit feedback");
      }
    } catch (err) {
      console.error("❌ Feedback Error:", err);
      alert("❌ Failed to submit feedback. Please try again later.");
    }
  };

  // ---------------------- CONTACT FORM ----------------------
  const handleContactSubmit = async (e) => {
    e.preventDefault();

    if (
      !contactName.trim() ||
      !contactEmail.trim() ||
      !contactPhone.trim() ||
      !contactSubject.trim() ||
      !contactMessage.trim()
    ) {
      alert("⚠️ Please fill in all contact fields");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/feedback/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          phone: String(contactPhone), // ✅ ensure phone is string
          subject: contactSubject,
          message: contactMessage,
        }),
      });

      if (res.ok) {
        alert("✅ Contact message sent successfully");
        setContactName("");
        setContactEmail("");
        setContactPhone("");
        setContactSubject("");
        setContactMessage("");
      } else {
        const err = await res.text();
        console.error("❌ Contact error:", err);
        alert("❌ Failed to send contact message");
      }
    } catch (err) {
      console.error("❌ Error submitting contact form:", err);
      alert("❌ Failed to send contact message");
    }
  };

  // ---------------------- RENDER ----------------------
  return (
    <div className="min-h-screen bg-white p-6">
      <BackButton to="/menu" />
      <h2 className="text-2xl font-bold text-center text-blue-700 mb-6">
        📬 Feedback & Contact
      </h2>

      {/* Tabs */}
      <div className="flex justify-center mb-6 space-x-4">
        <button
          onClick={() => setTab("feedback")}
          className={`px-4 py-2 rounded ${
            tab === "feedback"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Feedback
        </button>
        <button
          onClick={() => setTab("contact")}
          className={`px-4 py-2 rounded ${
            tab === "contact"
              ? "bg-blue-600 text-white"
              : "bg-gray-200 text-gray-700"
          }`}
        >
          Contact
        </button>
      </div>

      {/* Feedback Form */}
      {tab === "feedback" && (
        <form
          onSubmit={handleFeedbackSubmit}
          className="max-w-md mx-auto bg-blue-50 p-4 rounded shadow space-y-4"
        >
          <input
            type="text"
            value={feedbackName}
            onChange={(e) => setFeedbackName(e.target.value)}
            placeholder="Your Name"
            className="w-full px-4 py-2 border rounded"
            required
          />
          <textarea
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            placeholder="Your Feedback"
            rows="5"
            className="w-full px-4 py-2 border rounded"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Submit Feedback
          </button>
        </form>
      )}

      {/* Contact Form */}
      {tab === "contact" && (
        <form
          onSubmit={handleContactSubmit}
          className="max-w-md mx-auto bg-blue-50 p-4 rounded shadow space-y-4"
        >
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Your Name"
            className="w-full px-4 py-2 border rounded"
            required
          />
          <input
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Phone Number"
            className="w-full px-4 py-2 border rounded"
            required
          />
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="Your Email"
            className="w-full px-4 py-2 border rounded"
            required
          />
          <input
            type="text"
            value={contactSubject}
            onChange={(e) => setContactSubject(e.target.value)}
            placeholder="Subject"
            className="w-full px-4 py-2 border rounded"
            required
          />
          <textarea
            value={contactMessage}
            onChange={(e) => setContactMessage(e.target.value)}
            placeholder="Message"
            rows="5"
            className="w-full px-4 py-2 border rounded"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            Send Message
          </button>
        </form>
      )}
    </div>
  );
}
