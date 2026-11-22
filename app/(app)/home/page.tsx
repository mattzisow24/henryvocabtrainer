import Link from "next/link";
import { requireLearner } from "@/lib/auth";
import { LEARNER_NAME, NEW_WORD_CUTOFF_DAYS } from "@/lib/config";
import { loadDrills, loadProfile, loadReviews, loadSessions, loadStates } from "@/lib/data";
import { addDays, today } from "@/lib/dates";
import { learnerLine } from "@/lib/exam";
import { summarize } from "@/lib/progress";
import { computeRewards } from "@/lib/rewards";
import { WORDS } from "@/lib/words";
import { Badge } from "@/components/badge";
import { Celebrate } from "@/components/celebrate";
import { StageBar } from "@/components/stage-bar";

export default async function HomePage() {
  const member = await requireLearner();
  const db = member.supabase;
  const day = today();
  const [states, sessions, drills, reviews, { onboardedAt }] = await Promise.all([
    loadStates(db),
    loadSessions(db),
    loadDrills(db),
    loadReviews(db, addDays(day, -120)),
    loadProfile(db),
  ]);
  const data = { words: WORDS, states, sessions, drills, reviews, day };
  const p = summarize(data);
  const r = computeRewards(data);
  const inProgress = sessions.some((s) => s.day === day && s.status === "active");
  const earned = r.milestones.filter((t) => t.earned);
  const reviewOnly = p.exam.daysAway >= 0 && p.exam.daysAway <= NEW_WORD_CUTOFF_DAYS;

  const coach = !onboardedAt
    ? { href: "/sort", title: "Start here: sort the list", detail: `Rate all ${p.total} words once, about eight minutes, so your coach starts with the ones that need work.` }
    : inProgress
      ? { href: "/coach", title: "Resume session", detail: "Your session from earlier is still open." }
      : r.today.coach
        ? { href: "/coach", title: "Another session", detail: "Today's is done. More words are ready if you want them." }
        : {
            href: "/coach",
            title: "Today's session",
            detail: `About 10 minutes, typed. ${p.due} due for review${reviewOnly ? "; no new words this close to the test" : p.notStarted ? `, ${p.notStarted} not started` : ""}.`,
          };
  const allDone = r.today.coach && r.today.drill;

  return (
    <div className="space-y-4">
      <Celebrate
        earned={earned.map(({ id, name, mark, how }) => ({ id, name, mark, how }))}
        level={r.level}
        storageKey={member.preview ? "rewards-seen-preview" : "rewards-seen"}
      />

      <section className="rounded-2xl bg-navy p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{LEARNER_NAME}</h1>
            <p className="text-white/80">{learnerLine(p.exam)}</p>
          </div>
          <div className="flex shrink-0 gap-2 text-center">
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="font-display text-2xl font-semibold tabular-nums leading-none">{p.mastered}</p>
              <p className="text-xs text-white/80">mastered</p>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2">
              <p className="font-display text-2xl font-semibold tabular-nums leading-none">{p.streak}</p>
              <p className="text-xs text-white/80">day streak</p>
            </div>
          </div>
        </div>
        <div className="mt-4 space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span>
              Level {r.level} · <span className="tabular-nums">{r.points.toLocaleString("en-US")}</span> points
            </span>
            {r.next && (
              <span className="text-white/80">
                <span className="tabular-nums">{r.next.pointsToGo}</span> to level {r.next.level}
              </span>
            )}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.max(2, (r.next?.fraction ?? 1) * 100)}%` }} />
          </div>
        </div>
      </section>

      <Link href={coach.href} className="block rounded-2xl bg-accent p-5 text-white transition-transform active:scale-[0.99]">
        <p className="font-display text-xl font-semibold">{coach.title}</p>
        <p className="text-white/85">{coach.detail}</p>
      </Link>

      {onboardedAt && (
        <section className="card space-y-3 p-4">
          <h2 className="text-lg font-semibold text-navy">{allDone ? "Today: done" : "Today, 20 minutes"}</h2>
          <ul className="space-y-2">
            {[
              { done: r.today.coach, label: "One coach session", href: "/coach" },
              { done: r.today.drill, label: "One Words in Context drill", href: "/drill" },
            ].map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
                      item.done ? "border-good bg-good text-white" : "border-line text-transparent"
                    }`}
                  >
                    ✓
                  </span>
                  <span className={item.done ? "text-muted line-through" : ""}>{item.label}</span>
                  <span className="sr-only">{item.done ? "(done)" : "(to do)"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/drill?timed=0&n=10" className="card block p-4 transition-transform active:scale-[0.98]">
          <p className="font-semibold text-navy">Practice drill</p>
          <p className="text-sm text-ink-2">10 questions, explained</p>
        </Link>
        <Link href="/drill?timed=1&n=12" className="card block p-4 transition-transform active:scale-[0.98]">
          <p className="font-semibold text-navy">Timed drill</p>
          <p className="text-sm text-ink-2">12 questions at test pace</p>
        </Link>
      </div>

      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy">The {p.total} words</h2>
          <Link href="/words" className="text-sm font-medium text-accent underline">
            See the list
          </Link>
        </div>
        <StageBar progress={p} />
      </section>

      <Link href="/milestones" className="card block space-y-3 p-4">
        <span className="flex items-baseline justify-between">
          <span className="font-display text-lg font-semibold text-navy">Milestones</span>
          <span className="text-sm text-ink-2">
            {earned.length} of {r.milestones.length}
          </span>
        </span>
        <span className="flex gap-2 overflow-hidden">
          {/* Reached ones first, then the next few to aim for. */}
          {[...earned, ...r.milestones.filter((t) => !t.earned)].slice(0, 6).map((t) => (
            <Badge key={t.id} mark={t.mark} locked={!t.earned} className="h-11 w-11 text-xs" />
          ))}
        </span>
      </Link>

      <p className="text-center text-xs text-muted">Your parents can see your progress and read your coach sessions.</p>
    </div>
  );
}
