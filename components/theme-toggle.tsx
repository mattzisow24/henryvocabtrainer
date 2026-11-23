"use client";

// Auto / Light / Dark. The choice lives in this browser's storage and is
// applied as data-theme on <html>; "auto" removes it and follows the device.

import { useSyncExternalStore } from "react";

type Theme = "auto" | "light" | "dark";
const OPTIONS: { value: Theme; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
const CHANGED = "theme-changed";

function read(): Theme {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : "auto";
  } catch {
    return "auto";
  }
}

function subscribe(notify: () => void) {
  window.addEventListener(CHANGED, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(CHANGED, notify);
    window.removeEventListener("storage", notify);
  };
}

function choose(theme: Theme) {
  try {
    if (theme === "auto") localStorage.removeItem("theme");
    else localStorage.setItem("theme", theme);
  } catch {
    // Storage is unavailable: the choice still applies until the page reloads.
  }
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  window.dispatchEvent(new Event(CHANGED));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "auto" as Theme);
  return (
    <div role="radiogroup" aria-label="Appearance" className="inline-flex rounded-xl border border-line bg-surface p-0.5 text-sm">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={theme === o.value}
          onClick={() => choose(o.value)}
          className={`h-8 rounded-[0.6rem] px-3 font-semibold ${theme === o.value ? "bg-accent text-white" : "text-ink-2"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
