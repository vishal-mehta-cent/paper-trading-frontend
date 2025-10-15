// src/App.jsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { createPortal } from "react-dom";
import { AnimatePresence } from "framer-motion";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Pages
import LoginRegister from "./pages/LoginRegister";
import Menu from "./pages/Menu";
import Trade from "./pages/Trade";
import ScriptDetail from "./pages/ScriptDetail";
import Portfolio from "./pages/Portfolio";
import Orders from "./pages/Orders";
import Recommendation from "./pages/Recommendation";
import Insight from "./pages/Insight";
import IpoTracker from "./pages/IpoTracker";
import Feedback from "./pages/Feedback";
import Profile from "./pages/Profile";
import Buy from "./pages/Buy";
import Sell from "./pages/Sell";
import TradeSuccess from "./pages/TradeSuccess";
import ChartPage from "./pages/Chart";
import SetAlert from "./pages/SetAlert";
import Notes from "./pages/Notes";
import Settings from "./pages/Settings";
import PasswordChange from "./pages/PasswordChange";
import EmailChange from "./pages/EmailChange";
import Funds from "./pages/Funds";
import History from "./pages/History";
import ModifyOrderPage from "./pages/ModifyOrderPage";
import ProfileDetail from "./pages/ProfileDetail";
import Payments from "./pages/Payments.jsx";
import AddToPosition from "./pages/AddToPosition";

/** Fixed logo shown on every non-auth page (rendered to body via portal) */
function RouteAwareTopRightLogo() {
  const { pathname } = useLocation();
  const hide =
    pathname === "/" ||
    pathname === "/loginregister" ||
    pathname.startsWith("/auth");

  if (hide) return null;

  // Render on top of everything to avoid being hidden by page headers
  return createPortal(
    <div className="fixed top-1 right-3 z-[99999] pointer-events-none">
      <a href="/menu" aria-label="Home" className="pointer-events-auto">
        <img
          src="/logo1.png" // ensure this file is in /public
          alt="App Logo"
          className="h-10 w-auto md:h-12 drop-shadow-lg select-none"
          draggable={false}
        />
      </a>
    </div>,
    document.body
  );
}

/** Auth screen with centered branding above the login/register UI */
function AuthScreen({ onLoginSuccess }) {
  return (
    <div className="flex-1 flex items-start justify-center px-4 pb-8">
      <div className="w-full max-w-md">
        <LoginRegister onLoginSuccess={onLoginSuccess} />
      </div>
    </div>
  );
}

export default function App() {
  const [username, setUsername] = useState(() =>
    localStorage.getItem("username")
  );

  useEffect(() => {
    if (username) localStorage.setItem("username", username);
    else localStorage.removeItem("username");
  }, [username]);

  const handleLoginSuccess = (user) => {
    setUsername(user);
    window.location.href = "/menu";
  };

  const handleLogout = () => setUsername(null);

  return (
    <BrowserRouter>
      {/* Top-right logo for all non-auth routes */}
      <RouteAwareTopRightLogo />

      {/* Toasts */}
      <ToastContainer position="top-center" autoClose={2000} />

      <AnimatedRoutes
        username={username}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
    </BrowserRouter>
  );
}

function AnimatedRoutes({ username, onLoginSuccess, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    function onOpenDetails(e) {
      const symbol = e?.detail?.symbol;
      if (!symbol) return;
      navigate(`/trade/${encodeURIComponent(symbol)}`);
    }
    window.addEventListener("open-script-details", onOpenDetails);
    return () =>
      window.removeEventListener("open-script-details", onOpenDetails);
  }, [navigate]);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>
        {/* Auth route: branding + login/register */}
        <Route
          path="/"
          element={
            username ? (
              <Navigate to="/menu" replace />
            ) : (
              <AuthScreen onLoginSuccess={onLoginSuccess} />
            )
          }
        />

        <Route
          path="/menu"
          element={
            username ? <Menu logout={onLogout} /> : <Navigate to="/" replace />
          }
        />

        <Route
          path="/trade"
          element={
            username ? <Trade username={username} /> : <Navigate to="/" replace />
          }
        />
        <Route
          path="/trade/:symbol"
          element={
            username ? (
              <ScriptDetail username={username} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route
          path="/orders"
          element={
            username ? <Orders username={username} /> : <Navigate to="/" replace />
          }
        />
        <Route
          path="/buy/:symbol"
          element={username ? <Buy /> : <Navigate to="/" replace />}
        />
        <Route
          path="/sell/:symbol"
          element={username ? <Sell /> : <Navigate to="/" replace />}
        />
        <Route
          path="/trade-success"
          element={username ? <TradeSuccess /> : <Navigate to="/" replace />}
        />

        <Route
          path="/chart/:symbol"
          element={username ? <ChartPage /> : <Navigate to="/" replace />}
        />
        <Route
          path="/alert/:symbol"
          element={username ? <SetAlert /> : <Navigate to="/" replace />}
        />
        <Route
          path="/notes/:symbol"
          element={username ? <Notes /> : <Navigate to="/" replace />}
        />

        <Route
          path="/portfolio"
          element={
            username ? (
              <Portfolio username={username} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/recommendations"
          element={username ? <Recommendation /> : <Navigate to="/" replace />} />
        <Route
          path="/insight"
          element={username ? <Insight /> : <Navigate to="/" replace />}
        />
        <Route
          path="/ipo-tracker"
          element={username ? <IpoTracker /> : <Navigate to="/" replace />}
        />

        <Route
          path="/feedback"
          element={<Feedback username={localStorage.getItem("username")} />}
        />

        <Route
          path="/profile"
          element={
            username ? (
              <Profile username={username} logout={onLogout} />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />
        <Route
          path="/profile/funds"
          element={<Funds username={localStorage.getItem("username")} />}
        />
        <Route
          path="/payments"
          element={username ? <Payments /> : <Navigate to="/" replace />}
        />

        <Route
          path="/history"
          element={
            username ? <History username={username} /> : <Navigate to="/" replace />
          }
        />
        {/* NEW: allow visiting /history/:username too (keeps existing behavior intact) */}
        <Route
          path="/history/:username"
          element={
            username ? <History username={username} /> : <Navigate to="/" replace />
          }
        />

        <Route
          path="/settings"
          element={username ? <Settings /> : <Navigate to="/" replace />}
        />
        <Route
          path="/settings/change-password"
          element={username ? <PasswordChange /> : <Navigate to="/" replace />}
        />
        <Route
          path="/profile/details"
          element={<ProfileDetail />}
        />

        <Route
          path="/settings/change-email"
          element={username ? <EmailChange /> : <Navigate to="/" replace />}
        />


        {/* Keep specific route before wildcard */}
        <Route path="/modify/:id" element={<ModifyOrderPage />} />
        <Route path="/add/:symbol" element={<AddToPosition />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}
