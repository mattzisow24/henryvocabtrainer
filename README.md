# Henry's SAT Vocab

A typed SAT vocabulary trainer for one learner, with a dashboard and a daily email for his parents.

## What it does

- **Sort (day one).** One pass through the 100 words, rating each "know it", "shaky" or "no idea". "Know it" is only a claim: those words go to the drills to be confirmed. The rest go to the coach, most frequently reported first.
- **Coach sessions (typed).** About ten minutes a day in a chat. The coach tests words that are due and teaches new ones, mostly through fresh sentences with a blank, "why not this other word" follow-ups, secondary meanings, and look-alike contrasts. It grades each word, which sets when the word comes back.
- **Words in Context drills.** The digital SAT's format: a short passage, four choices. Practice mode explains each answer; timed mode runs at test pace (about 71 seconds a question). 200 questions, two per word.
- **Word list.** Each word has a plain definition, an example, a memory hook, near-synonyms, what it gets confused with, and any second sense the SAT uses.
- **Points, levels and milestones.** Worked out from existing practice records (`lib/rewards.ts`); nothing extra is stored.
- **View as the learner.** Parents can open the learner's screens from the dashboard. The preview is read-only.
- **Daily email.** Each evening every parent on the member list gets a summary of the day, led by a short note written by Claude (`lib/digest.ts`, scheduled in `vercel.json`).
- **Dashboard.** Streak, minutes, where every word stands, drill accuracy and pace, words that keep slipping, the coach's notes, and session transcripts.

## Setup

1. **Supabase.** Create a new project (separate from any other trainer). In the SQL editor, run `supabase/migrations/001_init.sql`, then run the `insert into members` statement at the bottom of that file with the family's real emails (one `learner`, one or more `parent`).
2. **Sign-in email.** In Supabase, Authentication > Email Templates > Magic Link, add `{{ .Token }}` to the body so the email shows a 6-digit code. Under Authentication > URL Configuration, set the site URL to the deployed address.
3. **Keys.** Copy `.env.example` to `.env.local` and fill it in.
4. **Run.** `npm install`, then `npm run dev`.
5. **Deploy.** Import the repo into a new Vercel project and add the same environment variables.
6. **Phone.** Open the site in Safari, then Share > Add to Home Screen.

## Commands

- `npm run dev`: start the dev server
- `npm run build`: production build
- `npm run lint`: ESLint
- `npm test`: unit tests (scheduling, session planning, dates, rewards, email)
- `npm run check:content`: validate the word list and question bank

## How it fits together

- `content/words.json`, `content/questions.json`: the word list and the question bank. `content/source/tutor-list.tsv` is the tutor's ranked list the 100 words were chosen from.
- `lib/srs.ts`: spaced repetition. Words move through boxes 0 to 5 on short intervals (1, 1, 2, 3, 5 days); box 4 is mastered. A word can go from unknown to mastered in four days.
- `lib/plan.ts`: picks the words for each session and drill, and paces new words so the whole list is met before the cutoff (three days before the test).
- `lib/coach/`: the coach's instructions (`prompt.ts`), what it can do (`tools.ts`), and the turn loop (`run.ts`).
- `supabase/migrations/`: schema and row-level security. Members can read everything; only the learner writes practice data; only parents manage the member list.

## Privacy

Everything the learner types to the coach is stored so his parents can read the sessions, and he is told so on his screens. Session text is sent to Anthropic to run the coach. There is no audio.
