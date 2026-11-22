"use client";

// Shows a one-time note when the learner has reached a new milestone or level
// since this device last looked. What has been seen is remembered in the
// browser only; it is a nicety, not a record.

import { useEffect, useState } from "react";
import { Badge } from "./badge";

type Earned = { id: string; name: string; mark: string; how: string };

export function Celebrate(props: { earned: Earned[]; level: number; storageKey: string }) {
  const { earned, level, storageKey } = props;
  const [fresh, setFresh] = useState<{ milestones: Earned[]; level: number | null } | null>(null);

  useEffect(() => {
    let seen: { ids: string[]; level?: number } | null = null;
    try {
      seen = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    } catch {
      // Storage unavailable or unreadable: announce nothing rather than everything.
      return;
    }
    const milestones = earned.filter((t) => !seen?.ids.includes(t.id));
    // Announce a level only when it is higher than the last one seen here. The
    // starting level is not an achievement, and a reset must not announce a drop.
    const newLevel = level > (seen?.level ?? 1) ? level : null;
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ids: earned.map((t) => t.id), level }));
    } catch {
      return;
    }
    // Deferred so the state change happens after this render pass, not during it.
    const timer = setTimeout(() => {
      if (milestones.length > 0 || newLevel) setFresh({ milestones, level: newLevel });
    }, 0);
    return () => clearTimeout(timer);
  }, [earned, level, storageKey]);

  if (!fresh) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-navy/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-label="New milestone">
      <div className="card max-h-[85dvh] w-full max-w-sm animate-rise space-y-4 overflow-y-auto p-6">
        {fresh.level && (
          <div>
            <p className="text-sm font-semibold text-accent">Level up</p>
            <p className="font-display text-2xl font-semibold text-navy">Level {fresh.level}</p>
          </div>
        )}
        {fresh.milestones.map((t) => (
          <div key={t.id} className="flex items-center gap-3">
            <Badge mark={t.mark} className="h-14 w-14 text-base" />
            <div>
              <p className="text-sm font-semibold text-accent">Milestone</p>
              <p className="font-display text-xl font-semibold leading-tight text-navy">{t.name}</p>
              <p className="text-sm text-ink-2">{t.how}</p>
            </div>
          </div>
        ))}
        <button className="btn btn-primary w-full" autoFocus onClick={() => setFresh(null)}>
          Continue
        </button>
      </div>
    </div>
  );
}
