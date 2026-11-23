# Henry's SAT Vocab

Typed SAT vocabulary trainer for one learner (Henry, 16), with a dashboard and daily email for his parents. See README.md for setup and structure. Forked from Sam's SSAT trainer; the architecture is the same, the learner and the test are not.

## Tech stack
- Next.js 16 (App Router) + TypeScript, Tailwind CSS v4
- Supabase (Postgres, Auth, RLS)
- Claude via `@anthropic-ai/sdk` (the coach and the daily email note)
- No speech services. Henry asked for text only; do not add voice back without asking.

## The learner
- Henry scores 1530 (780 Math, 750 Reading and Writing) and wants 20 to 30 more points in Reading and Writing. He is strong in STEM, motivated, and does not need encouragement or hand-holding.
- Tone on his screens and from the coach: direct, exact, adult. No hype, no exclamation marks, no baby talk, no sports metaphors.
- He is told on the home and coach screens that his parents can read his sessions. Keep that notice.

## The test
- The digital SAT tests vocabulary only through Words in Context: a short passage with a blank and four words, or a marked word and four meanings. There are no synonym or analogy items; do not add any.
- Everything trains precision in context: why this word and not its near-synonym, and secondary senses of common words. Reciting definitions is the weakest exercise and is used least.
- The test date is `TEST_DATE` in `lib/config.ts`. All wording about it lives in `lib/exam.ts`.

## Content
- Word content is JSON in `/content`, not in the database: `words.json` (100 words) and `questions.json` (at least two questions per word). Run `npm run check:content` after editing either.
- `content/source/tutor-list.tsv` is the tutor's ranked list of 646 student-reported words. The 100 were chosen from it by reports and number of test dates, dropping words Henry certainly knows and keeping common words with a tested second sense.
- Definitions must be accurate and plain, and must give the sense the SAT tests. Every other sense the SAT uses goes in `senses`.
- A question has exactly one defensible answer. Distractors come from the list where possible and must fail on logic or connotation, not on absurdity. Never put two near-synonyms in one set of choices unless the passage separates them. Passages are original; never copy College Board text.
- In a "blank" question the passage must not contain the answer word. `why` says why the answer is right and why the most tempting wrong choice is not.

## Conventions
- Mobile-first: everything must work at 375px wide. Henry also uses a laptop, so the chat and drills widen to a comfortable reading column.
- Navigation is the bottom tab bar in `components/nav.tsx`. During the sort, a drill round or a flashcard round it is replaced by a single Exit link, so a stray tap cannot discard the round.
- The coach chat is a full-screen layout sized to the visible viewport (`useVisibleBox` in `components/coach-session.tsx`), so the keyboard never hides the question. The newest coach message is always the last item; the word card and result note go above it. When the coach ends a message with a line of slash-separated choices, they are shown as tap targets.
- Server components by default; client components only for the coach chat, drills, the sort and login.
- The coach's replies are shown as plain text: no markdown.
- Colors follow Duke University's palette (navy `#012169`, royal blue `#00539B`). Use the tokens in `app/globals.css`; do not use Duke logos or wordmarks. The look is restrained: flat cards, no confetti, no illustrations. Motion is short and functional (content rises in, lists stagger, bars fill, cards flip, buttons respond); use the animation tokens and the `stagger` and `bar` classes in `app/globals.css`, and keep everything under half a second.
- American spelling everywhere.
- Rewards (points, levels, milestones) are derived from practice records in `lib/rewards.ts`, never stored. Milestone badges are text marks rendered by `components/badge.tsx`; there is no artwork. Changes need a test in `lib/rewards.test.ts`.
- Parent preview ("View as Henry") must stay read-only: every write path checks `role === "learner"`.
- Any change to scheduling (`lib/srs.ts`, `lib/plan.ts`) needs a test in `lib/srs.test.ts`. The intervals are deliberately short and new words stop `NEW_WORD_CUTOFF_DAYS` before the test; revisit both if the target moves to a later sitting.
- If the database was created from an older copy of the schema, `supabase/migrations/003_conform.sql` brings it in line; it is safe to run on any database.
- A self-rating is a claim, not evidence: the first-day sort never marks a word mastered, and a flashcard "had it" never promotes a word. A flashcard miss does send the word back to the coach. Flashcards earn no points.

## Commands
- `npm run dev`, `npm run build`, `npm run lint`, `npm test`, `npm run check:content`
