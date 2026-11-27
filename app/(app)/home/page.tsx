import Link from "next/link";
import { requireLearner } from "@/lib/auth";
import { LEARNER_NAME, NEW_WORD_CUTOFF_DAYS } from "@/lib/config";
import { loadDrills, loadProfile, loadReviews, loadSessions, loadStates } from "@/lib/data";
import { addDays, today } from "@/lib/dates";
import { learnerLine } from "@/lib/exam";
import { missedOn, summarize } from "@/lib/progress";
import { computeRewards } from "@/lib/rewards";
import { WORDS } from "@/lib/words";
import { Badge } from "@/components/badge";
import { Celebrate } from "@/components/celebrate";
import { GoalRing } from "@/components/goal-ring";
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

  // Words waiting for the coach: due and still weak (missed or shaky).
  const forCoach = [...states.values()].filter((st) => st.box === 1 && st.due <= day).length;
  const main = !onboardedAt
    ? { href: "/sort", title: "Start here: sort the list", detail: `Rate all ${p.total} words once, about eight minutes, so lessons start with the ones that need work.` }
    : {
        href: "/lesson",
        title: r.today.drill ? "Another lesson" : "Today's lesson",
        detail: `About 8 minutes, mostly taps. ${p.due} due for review${reviewOnly ? "; no new words this close to the test" : p.notStarted ? `, ${p.notStarted} not started` : ""}.`,
      };
  const coach = inProgress
    ? { title: "Resume coach session", detail: "Your session from earlier is still open." }
    : forCoach > 0
      ? { title: "Coach", detail: `${forCoach} missed or shaky word${forCoach === 1 ? "" : "s"} waiting. This is where you explain why, in your own words.` }
      : { title: "Coach", detail: "Nothing is waiting from your lessons. A session here pushes on words that are due." };
  const allDone = r.today.coach && r.today.drill;
  const missedToday = missedOn(WORDS, reviews, day);

  return (
    <div className="stagger space-y-4">
      <Celebrate
        earned={earned.map(({ id, name, mark, how }) => ({ id, name, mark, how }))}
        level={r.level}
        storageKey={member.preview ? "rewards-seen-preview" : "rewards-seen"}
      />

      <section className="rounded-2xl bg-brand p-5 text-white">
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
            <div className="bar h-full rounded-full bg-white transition-all" style={{ width: `${Math.max(2, (r.next?.fraction ?? 1) * 100)}%` }} />
          </div>
        </div>
      </section>

      <Link href={main.href} className="block rounded-2xl bg-accent p-5 text-white transition-transform active:scale-[0.99]">
        <p className="font-display text-xl font-semibold">{main.title}</p>
        <p className="text-white/85">{main.detail}</p>
      </Link>

      {onboardedAt && (
        <Link href="/coach" className="card block p-4 transition-transform active:scale-[0.99]">
          <p className="font-semibold text-navy">{coach.title}</p>
          <p className="text-sm text-ink-2">{coach.detail}</p>
        </Link>
      )}

      {onboardedAt && (
        <section className="card flex items-center gap-4 p-4">
          <GoalRing done={Number(r.today.coach) + Number(r.today.drill)} total={2} />
          <div className="min-w-0 flex-1 space-y-2">
            <h2 className="text-lg font-semibold leading-tight text-navy">{allDone ? "Today: done" : "Today, 20 minutes"}</h2>
            <ul className="space-y-1.5">
              {[
                { done: r.today.drill, label: "One lesson", href: "/lesson" },
                { done: r.today.coach, label: "One coach session", href: "/coach" },
              ].map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
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
          </div>
        </section>
      )}

      {missedToday.length > 0 && (
        <section className="card space-y-3 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold text-navy">Missed today</h2>
            <span className="text-sm tabular-nums text-ink-2">{missedToday.length}</span>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {missedToday.map((w) => (
              <li key={w.id} className="rounded-full bg-bad-soft px-2.5 py-0.5 text-sm font-medium text-bad">
                {w.word}
              </li>
            ))}
          </ul>
          <Link href="/cards?deck=missed" className="btn w-full">
            Go over these now
          </Link>
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

      <Link href="/cards" className="card block p-4 transition-transform active:scale-[0.98]">
        <p className="font-semibold text-navy">Flashcards</p>
        <p className="text-sm text-ink-2">Flip through the words you are learning. Good for spare minutes; it does not replace the session.</p>
      </Link>

      <section className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-navy">The {p.total} words</h2>
          <Link href="/words" className="text-sm font-medium text-link underline">
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
