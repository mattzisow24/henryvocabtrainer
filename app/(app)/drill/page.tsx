import Link from "next/link";
import { requireLearner } from "@/lib/auth";
import { SECONDS_PER_QUESTION } from "@/lib/config";
import { loadStates } from "@/lib/data";
import { today } from "@/lib/dates";
import { drillPlan, shuffled } from "@/lib/plan";
import { getWord, questionsFor, stemOf, WORDS } from "@/lib/words";
import { Drill, type DrillItem } from "@/components/drill";

const OPTIONS = [
  { timed: false, n: 10, title: "Practice", detail: "10 questions. The reasoning is shown after each answer." },
  { timed: true, n: 12, title: "Timed", detail: "12 questions at test pace, about 71 seconds each. Answers at the end." },
] as const;

export default async function DrillPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const member = await requireLearner();
  const params = await searchParams;

  if (!params.n) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold text-navy">Words in Context</h1>
          <p className="text-ink-2">
            The SAT&apos;s own format: a short passage, four choices, one that is both logical and precise. Words that are due come up first, and
            anything you miss goes back to your coach.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <Link key={o.title} href={`/drill?timed=${o.timed ? 1 : 0}&n=${o.n}`} className="card block p-4">
              <p className="font-semibold text-navy">{o.title}</p>
              <p className="text-sm text-ink-2">{o.detail}</p>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const timed = params.timed === "1";
  const count = Math.min(27, Math.max(5, Number(params.n) || 10));
  const states = await loadStates(member.supabase);
  // A new mix on every visit.
  // eslint-disable-next-line react-hooks/purity
  const seed = Date.now() % 2_147_483_647;

  const items: DrillItem[] = drillPlan(WORDS, states, today(), count, seed).flatMap((id, i) => {
    const w = getWord(id)!;
    const options = questionsFor(id);
    if (options.length === 0) return [];
    const q = options[(seed + i) % options.length];
    const choices = shuffled(q.choices, seed + i);
    return [
      {
        id: q.id,
        stem: stemOf(q),
        passage: q.passage,
        choices,
        answer: choices.indexOf(q.answer),
        why: q.why,
        word: w.word,
        meaning: `${w.word} (${w.pos}): ${w.definition}`,
      },
    ];
  });
  // Mixed order, so the round does not run from strongest words to weakest.
  const mixed = shuffled(items, seed + 7);

  return <Drill key={seed} timed={timed} items={mixed} secondsAllowed={mixed.length * SECONDS_PER_QUESTION} preview={member.preview} />;
}
