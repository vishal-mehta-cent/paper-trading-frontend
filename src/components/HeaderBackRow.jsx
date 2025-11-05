import React from "react";
import BackButton from "./BackButton";

/**
 * Back row that matches Trade page placement:
 * - Back on the left (inline, NOT absolute)
 * - Optional centered content (icons, tabs, etc.)
 * - Empty right cell keeps the center perfectly centered
 */
export default function HeaderBackRow({ children, backTo = "/menu", className = "" }) {
  return (
    <div className={`mt-1 grid grid-cols-[auto_1fr_auto] items-center ${className}`}>
      <div className="pl-5 pt-1">
        {/* IMPORTANT: BackButton must support inline (not absolute). 
           If your BackButton doesn't, pass inline or switch to a simple <button> here. */}
        <BackButton to={backTo} inline />
      </div>

      <div className="justify-self-center">
        {children /* put your center icons/controls here, or leave empty */}
      </div>

      <div /> {/* right spacer keeps the middle perfectly centered */}
    </div>
  );
}
