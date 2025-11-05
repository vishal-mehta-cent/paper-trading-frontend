// src/components/BackButton.jsx
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ to, inline = true, className = "" }) {
  const nav = useNavigate();
  const base = "flex items-center gap-1 text-gray-700 hover:text-blue-600 text-sm";
  const pos  = inline ? "" : "absolute top-2 left-2";
  const cls  = `${base} ${pos} ${className}`.trim();

  if (to) return (
    <Link to={to} className={cls} aria-label="Back">
      <ArrowLeft size={18} /><span>Back</span>
    </Link>
  );
  return (
    <button onClick={() => nav(-1)} className={cls} aria-label="Back">
      <ArrowLeft size={18} /><span>Back</span>
    </button>
  );
}
