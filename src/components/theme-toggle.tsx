"use client";

import { useEffect, useState } from "react";

// Preview-only toggle so the dark and light directions can be compared.
// Persists choice to localStorage and flips data-theme on <html>.
export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("slugger-theme") as "dark" | "light") || "dark";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("slugger-theme", next);
  }

  return (
    <button
      onClick={toggle}
      className="fixed bottom-5 right-5 z-[100] clip-slant bg-brand text-on-brand display text-xs px-4 py-3 shadow-lg hover:bg-brand-dark transition-colors"
      aria-label="Toggle dark / light theme"
    >
      {theme === "dark" ? "◐ View Light" : "◑ View Dark"}
    </button>
  );
}
