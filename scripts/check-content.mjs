// Checks the word list and question bank for structural mistakes. Run: npm run check:content
import { readFileSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(new URL(`../content/${p}`, import.meta.url), "utf8"));
const words = read("words.json");
const questions = read("questions.json");
const problems = [];
const ids = new Set();
const KEYS = ["id", "word", "pos", "definition", "example", "hook", "synonyms", "confusedWith", "senses", "priority", "tier", "reports", "testDates", "listGloss", "listCheck", "listNote"];
const stem = (w) => String(w).toLowerCase().slice(0, Math.max(4, String(w).length - 3));

for (const w of words) {
  const at = `word "${w.id}"`;
  for (const k of KEYS) if (w[k] === undefined) problems.push(`${at}: missing ${k}`);
  if (ids.has(w.id)) problems.push(`${at}: duplicate id`);
  ids.add(w.id);
  if (w.id !== String(w.word).toLowerCase()) problems.push(`${at}: id does not match word`);
  if (!["none", "ok", "imprecise", "wrong"].includes(w.listCheck)) problems.push(`${at}: bad listCheck`);
  if ((w.listCheck === "none") !== (w.listGloss === "")) problems.push(`${at}: listCheck and listGloss disagree`);
  if (["imprecise", "wrong"].includes(w.listCheck) && !w.listNote) problems.push(`${at}: flagged gloss needs a note`);
  if (![1, 2, 3].includes(w.tier)) problems.push(`${at}: bad tier`);
  if (!w.definition || !w.hook) problems.push(`${at}: needs a definition and a hook`);
  if (!Array.isArray(w.synonyms) || w.synonyms.length < 2) problems.push(`${at}: needs 2+ near-synonyms`);
  if (!String(w.example).toLowerCase().includes(stem(w.word))) problems.push(`${at}: example does not use the word`);
  for (const s of w.senses ?? []) if (!s.meaning || !s.example) problems.push(`${at}: a sense needs a meaning and an example`);
}
if (new Set(words.map((w) => w.priority)).size !== words.length) problems.push("priorities are not unique");

const perWord = new Map();
const qids = new Set();
for (const q of questions) {
  const at = `question "${q.id}"`;
  if (qids.has(q.id)) problems.push(`${at}: duplicate id`);
  qids.add(q.id);
  if (!ids.has(q.word)) problems.push(`${at}: unknown word "${q.word}"`);
  perWord.set(q.word, (perWord.get(q.word) ?? 0) + 1);
  if (!Array.isArray(q.choices) || q.choices.length !== 4 || new Set(q.choices).size !== 4) problems.push(`${at}: needs 4 distinct choices`);
  if (!q.choices?.includes(q.answer)) problems.push(`${at}: answer is not among the choices`);
  if (!q.why) problems.push(`${at}: needs an explanation`);
  const blanks = (q.passage.match(/_{6}/g) ?? []).length;
  const marks = (q.passage.match(/\[\[.+?\]\]/g) ?? []).length;
  if (q.type === "blank") {
    if (blanks !== 1 || marks !== 0) problems.push(`${at}: a blank question needs exactly one ______`);
    if (!String(q.answer).toLowerCase().startsWith(stem(q.word))) problems.push(`${at}: the answer should be a form of "${q.word}"`);
    if (q.passage.toLowerCase().includes(stem(q.word))) problems.push(`${at}: the passage gives the word away`);
  } else if (q.type === "meaning") {
    if (marks !== 1 || blanks !== 0) problems.push(`${at}: a meaning question needs exactly one [[marked]] word`);
    if (!/\[\[(.+?)\]\]/.exec(q.passage)?.[1].toLowerCase().startsWith(stem(q.word))) problems.push(`${at}: the marked word should be a form of "${q.word}"`);
  } else problems.push(`${at}: bad type`);
}
for (const id of ids) if ((perWord.get(id) ?? 0) < 2) problems.push(`word "${id}": needs 2+ questions`);

const tally = (k) => Object.entries(words.reduce((m, w) => ((m[w[k]] = (m[w[k]] ?? 0) + 1), m), {})).map(([a, b]) => `${a} ${b}`).join(", ");
console.log(`${words.length} words, ${questions.length} questions`);
console.log(`tiers: ${tally("tier")}`);
console.log(`tutor glosses: ${tally("listCheck")}`);
console.log(`words with a second sense: ${words.filter((w) => w.senses.length).length}`);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("content ok");
