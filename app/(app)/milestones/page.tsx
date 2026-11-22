import { requireLearner } from "@/lib/auth";
import { loadDrills, loadReviews, loadSessions, loadStates } from "@/lib/data";
import { addDays, today } from "@/lib/dates";
import { computeRewards, LEVELS, POINTS } from "@/lib/rewards";
import { WORDS } from "@/lib/words";
import { Badge } from "@/components/badge";

export default async function MilestonesPage() {
  const member = await requireLearner();
  const db = member.supabase;
  const day = today();
  const [states, sessions, drills, reviews] = await Promise.all([
    loadStates(db),
    loadSessions(db),
    loadDrills(db),
    loadReviews(db, addDays(day, -120)),
  ]);
  const r = computeRewards({ words: WORDS, states, sessions, drills, reviews, day });
  const sorted = [...r.milestones].sort((a, b) => Number(b.earned) - Number(a.earned));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-semibold text-navy">Milestones</h1>
        <p className="text-ink-2">
          {r.milestones.filter((t) => t.earned).length} of {r.milestones.length} reached.
        </p>
      </div>

      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy">Level {r.level}</h2>
          <p className="text-sm tabular-nums text-ink-2">{r.points.toLocaleString("en-US")} points</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-stage-new">
          <div className="bar h-full rounded-full bg-accent" style={{ width: `${Math.max(2, (r.next?.fraction ?? 1) * 100)}%` }} />
        </div>
        <p className="text-sm text-ink-2">
          {r.next ? `${r.next.pointsToGo} more for level ${r.next.level}.` : "Top level."} Levels start at{" "}
          {LEVELS.slice(1).map((n) => n.toLocaleString("en-US")).join(", ")} points.
        </p>
        <p className="text-xs text-muted">
          Points: {POINTS.knew} for a word you know cold with your coach, {POINTS.partial} for partly, {POINTS.missed} for a miss.{" "}
          {POINTS.drillCorrect} per right answer in a drill. {POINTS.sessionDone} for finishing a session. {POINTS.mastered} when a word is mastered.
        </p>
      </section>

      <section className="stagger grid gap-3 sm:grid-cols-2">
        {sorted.map((t) => (
          <div key={t.id} className="card flex items-center gap-3 p-4">
            <Badge mark={t.mark} locked={!t.earned} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className={`font-display text-lg font-semibold leading-tight ${t.earned ? "text-navy" : "text-ink-2"}`}>{t.name}</p>
              <p className="text-sm text-ink-2">{t.how}</p>
              {t.earned ? (
                <p className="text-xs font-semibold text-good">Reached</p>
              ) : t.progress ? (
                <div className="flex items-center gap-2 pt-1 text-xs text-muted">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stage-new">
                    <div className="bar h-full rounded-full bg-accent" style={{ width: `${(t.progress.have / t.progress.need) * 100}%` }} />
                  </div>
                  <span className="tabular-nums">
                    {t.progress.have} / {t.progress.need}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted">Not yet</p>
              )}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
