import { redirect } from "next/navigation";
import { requireLearner } from "@/lib/auth";
import { loadProfile, loadStates, loadUsage } from "@/lib/data";
import { today } from "@/lib/dates";
import { outlook } from "@/lib/exam";
import { buildLesson } from "@/lib/lesson";
import { lessonPlan } from "@/lib/plan";
import { getWord, WORDS } from "@/lib/words";
import { Lesson } from "@/components/lesson";

export default async function LessonPage() {
  const member = await requireLearner();
  const db = member.supabase;
  const [{ onboardedAt }, states, usage] = await Promise.all([loadProfile(db), loadStates(db), loadUsage(db)]);
  // The lesson is built from the first-day sort.
  if (!onboardedAt && !member.preview) redirect("/sort");
  const day = today();
  // A new mix on every visit.
  // eslint-disable-next-line react-hooks/purity
  const seed = Date.now() % 2_147_483_647;
  const words = lessonPlan(WORDS, states, day, outlook(day).daysAway).map((id) => getWord(id)!);
  const exercises = buildLesson({ words, all: WORDS, states, usage, seed });
  return <Lesson key={seed} exercises={exercises} words={Object.fromEntries(words.map((w) => [w.id, w.word]))} preview={member.preview} />;
}
