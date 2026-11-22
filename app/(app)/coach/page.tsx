import { redirect } from "next/navigation";
import { requireLearner } from "@/lib/auth";
import { loadProfile } from "@/lib/data";
import { CoachSession } from "@/components/coach-session";
import { WORDS } from "@/lib/words";

export default async function CoachPage() {
  const member = await requireLearner();
  const { onboardedAt } = await loadProfile(member.supabase);
  // The session plan is built from the first-day sort.
  if (!onboardedAt && !member.preview) redirect("/sort");
  // The screen only needs what a word card shows.
  const cards = Object.fromEntries(
    WORDS.map((w) => [w.id, { word: w.word, pos: w.pos, definition: w.definition, example: w.example, hook: w.hook, senses: w.senses }]),
  );
  return <CoachSession cards={cards} preview={member.preview} />;
}
