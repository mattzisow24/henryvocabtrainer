import { requireLearner } from "@/lib/auth";
import { loadStates } from "@/lib/data";
import { WORDS } from "@/lib/words";
import { Sort } from "@/components/sort";

export default async function SortPage() {
  const member = await requireLearner();
  const states = await loadStates(member.supabase);
  // Only words with no history: a second pass never re-rates practiced words.
  const words = WORDS.filter((w) => !states.has(w.id)).map((w) => ({ id: w.id, word: w.word, pos: w.pos, definition: w.definition }));
  return <Sort words={words} preview={member.preview} />;
}
