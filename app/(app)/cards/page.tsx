import Link from "next/link";
import { requireLearner } from "@/lib/auth";
import { loadReviews, loadStates } from "@/lib/data";
import { today } from "@/lib/dates";
import { missedOn } from "@/lib/progress";
import { shuffled } from "@/lib/plan";
import { stageOf } from "@/lib/srs";
import { WORDS } from "@/lib/words";
import { Flashcards } from "@/components/flashcards";

const ROUND = 20;

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ deck?: string }> }) {
  const member = await requireLearner();
  const deck = (await searchParams).deck;
  const day = today();
  const [states, reviews] = await Promise.all([loadStates(member.supabase), loadReviews(member.supabase, day)]);
  const decks = [
    { key: "missed", title: "Missed today", detail: "Everything you got wrong today, with your coach, in a drill or on a card.", words: missedOn(WORDS, reviews, day) },
    { key: "learning", title: "Learning", detail: "Words you have met and not yet mastered.", words: WORDS.filter((w) => stageOf(states.get(w.id)) === "learning") },
    { key: "new", title: "Not started", detail: "A first look at words your coach has not taught yet, in study order.", words: WORDS.filter((w) => stageOf(states.get(w.id)) === "new") },
    { key: "mastered", title: "Mastered", detail: "A check that they are still there.", words: WORDS.filter((w) => stageOf(states.get(w.id)) === "mastered") },
    { key: "all", title: "All 100", detail: "The whole list, shuffled.", words: WORDS },
  ];
  const chosen = decks.find((d) => d.key === deck);

  if (!chosen || chosen.words.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-semibold text-navy">Flashcards</h1>
          <p className="text-ink-2">
            Up to {ROUND} cards a round. Say what the word means before you flip. You grade yourself, so &ldquo;had it&rdquo; does not move a word
            forward; a miss sends it back to your coach.
          </p>
        </div>
        <div className="stagger grid gap-3 sm:grid-cols-2">
          {decks.map((d) =>
            d.words.length > 0 ? (
              <Link key={d.key} href={`/cards?deck=${d.key}`} className="card block p-4">
                <p className="font-semibold text-navy">
                  {d.title} <span className="font-normal tabular-nums text-muted">{d.words.length}</span>
                </p>
                <p className="text-sm text-ink-2">{d.detail}</p>
              </Link>
            ) : (
              <div key={d.key} className="card p-4 opacity-50">
                <p className="font-semibold text-navy">
                  {d.title} <span className="font-normal text-muted">0</span>
                </p>
                <p className="text-sm text-ink-2">{d.detail}</p>
              </div>
            ),
          )}
        </div>
      </div>
    );
  }

  // A new mix on every visit; the "not started" deck keeps study order.
  // eslint-disable-next-line react-hooks/purity
  const seed = Date.now() % 2_147_483_647;
  const picked = (chosen.key === "new" ? chosen.words : shuffled(chosen.words, seed)).slice(0, ROUND);
  const cards = picked.map((w) => ({
    id: w.id,
    word: w.word,
    pos: w.pos,
    definition: w.definition,
    example: w.example,
    hook: w.hook,
    senses: w.senses,
    confusedWith: w.confusedWith,
  }));
  return <Flashcards key={seed} cards={cards} deck={chosen.key} preview={member.preview} />;
}
