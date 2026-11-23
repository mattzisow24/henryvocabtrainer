"use client";

// The tab bar at the bottom of every screen. During a focused activity (the
// sort, a drill round, a flashcard round) it is replaced by a single exit
// link at the top, so a stray tap cannot throw away the round.

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Icon = "home" | "coach" | "drill" | "cards" | "words" | "dashboard";
export type NavItem = { href: string; label: string; icon: Icon };

const PATHS: Record<Icon, string[]> = {
  home: ["M3 11l9-8 9 8", "M5 10v10h5v-6h4v6h5V10"],
  coach: ["M4 5h16v11H9l-5 4z", "M8 9h8", "M8 12h5"],
  drill: ["M5 4h14v16H5z", "M9 9h6", "M9 13h6", "M9 17h3"],
  cards: ["M7 7h13v13H7z", "M4 17V4h13"],
  words: ["M5 4h10a4 4 0 014 4v12H9a4 4 0 01-4-4z", "M9 9h6", "M9 13h4"],
  dashboard: ["M4 20V10", "M10 20V4", "M16 20v-7", "M21 20H3"],
};

function Glyph({ icon }: { icon: Icon }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[icon].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

export function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const params = useSearchParams();
  const focused = path === "/sort" || (path === "/drill" && params.has("n")) || (path === "/cards" && params.has("deck"));

  if (focused) {
    return (
      <div className="fixed inset-x-0 top-0 z-30 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-11 max-w-3xl items-center px-4">
          <Link href={path === "/sort" ? "/home" : path} className="-ml-2 flex h-9 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-ink-2" aria-label="Exit">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Exit
          </Link>
        </div>
      </div>
    );
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Main">
      <ul className="mx-auto flex max-w-3xl">
        {items.map((item) => {
          const active = path === item.href || path.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold active:scale-95 ${active ? "text-accent" : "text-muted"}`}
              >
                <Glyph icon={item.icon} />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
