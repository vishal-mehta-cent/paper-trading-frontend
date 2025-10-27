import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { Eye, EyeOff } from "lucide-react";

export default function LoginRegister({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const backendBaseUrl =
    import.meta.env.VITE_BACKEND_BASE_URL || "http://127.0.0.1:8000";
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setMessageType("");

    if (!username || !password) {
      setMessage("❌ Please enter username and password.");
      setMessageType("error");
      return;
    }

    if (!isLogin && password !== confirm) {
      setMessage("❌ Password and Confirm Password do not match.");
      setMessageType("error");
      return;
    }

    setIsLoading(true);
    const endpoint = isLogin ? "login" : "register";

    try {
      const res = await fetch(`${backendBaseUrl}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (data.success) {
        if (isLogin) {
          onLoginSuccess(username);
        } else {
          setMessage("✅ " + data.message);
          setMessageType("success");
          // Optional: switch to login after successful registration
          // setIsLogin(true);
          // setPassword(""); setConfirm("");
        }
      } else {
        setMessage("❌ " + (data.message || "Something went wrong"));
        setMessageType("error");
      }
    } catch (err) {
      setMessage("❌ Cannot connect to server.");
      setMessageType("error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    const token = credentialResponse.credential;

    try {
      const res = await fetch(`${backendBaseUrl}/auth/google-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (data.success) {
        onLoginSuccess(data.username);
      } else {
        setMessage("❌ " + (data.message || "Google login failed"));
        setMessageType("error");
      }
    } catch (err) {
      setMessage("❌ Google login failed");
      setMessageType("error");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center">
      {/* BRAND HEADER: logo (bigger) + NEUROCREST on one line, tagline under NEUROCREST */}
      <header className="pt-8">
        <div className="flex items-center gap-3">
          <img
            src="/public/logo1.png"
            alt="NeuroCrest"
            className="h-20 w-20 sm:h-24 sm:w-24 md:h-28 md:w-28 select-none"
            draggable="false"
            onError={(e) => {
              const tried = e.currentTarget.getAttribute("data-tried") || "";
              if (!tried) {
                e.currentTarget.setAttribute("data-tried", "brandpng");
                e.currentTarget.src = "/logo1.png";
              } else if (tried === "brandpng") {
                e.currentTarget.setAttribute("data-tried", "rootpng");
                e.currentTarget.src = "/brand/logo.svg";
              } else {
                e.currentTarget.style.display = "none";
              }
            }}
          />
          <div className="flex flex-col">
            <h1 className="text-5xl font-extrabold bg-gradient-to-r from-[#00c6ff] via-[#ff7b00] to-[#ff2d55] bg-clip-text text-transparent">
              NEUROCREST
            </h1>
            <span className="mt-1 text-sm sm:text-base text-gray-600">
              Your All-in-One AI Trading Mentor
            </span>
          </div>
        </div>
      </header>

      {/* AUTH CARD */}
      <main className="w-full flex justify-center px-4">
        <div className="bg-white p-6 rounded-xl shadow-lg w-96 space-y-4 mt-4">
          <h2 className="text-2xl font-bold text-center">
            {isLogin ? "Login" : "Register"}
          </h2>

          <div className="flex justify-center space-x-4">
            <button
              onClick={() => {
                setIsLogin(true);
                setMessage("");
                setMessageType("");
              }}
              className={`px-4 py-1 rounded ${
                isLogin ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setMessage("");
                setMessageType("");
              }}
              className={`px-4 py-1 rounded ${
                !isLogin ? "bg-blue-600 text-white" : "bg-gray-200"
              }`}
            >
              Register
            </button>
          </div>

          {message && (
            <div
              className={`text-sm text-center ${
                messageType === "success" ? "text-green-600" : "text-red-500"
              }`}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Username */}
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete={isLogin ? "username" : "new-username"}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />

            {/* Password with show/hide */}
            <div className="relative">
              <input
                type={showPwd ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? "current-password" : "new-password"}
                className="w-full border border-gray-300 rounded px-3 py-2 pr-10"
              />
              <button
                type="button"
                aria-label={showPwd ? "Hide password" : "Show password"}
                onClick={() => setShowPwd((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                tabIndex={-1}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Confirm Password (Register only) */}
            {!isLogin && (
              <div className="relative">
                <input
                  type={showPwd2 ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded px-3 py-2 pr-10"
                />
                <button
                  type="button"
                  aria-label={showPwd2 ? "Hide confirm password" : "Show confirm password"}
                  onClick={() => setShowPwd2((s) => !s)}
                  className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showPwd2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            )}

            {isLogin && (
              <p className="text-xs text-right text-blue-600 cursor-pointer hover:underline">
                Forgot Password?
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 flex justify-center"
            >
              {isLoading ? (
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
              ) : isLogin ? "Login" : "Register"}
            </button>
          </form>

          {googleClientId && (
            <div className="pt-4 text-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => console.log("Google login error")}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
