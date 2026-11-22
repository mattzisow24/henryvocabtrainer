// App-wide settings. No secrets here.

/** The SAT sitting the pacing aims at, YYYY-MM-DD. */
export const TEST_DATE: string = (process.env.NEXT_PUBLIC_TEST_DATE ?? "2026-12-05").trim();

/** All "today" and streak math uses the family's time zone, not the server's. */
export const TIME_ZONE = "America/New_York";

/** The learner's first name, used by the coach and the UI. */
export const LEARNER_NAME = process.env.NEXT_PUBLIC_LEARNER_NAME ?? "Henry";

/** Words per coach session. A typed session covers a little over one word a minute. */
export const SESSION_REVIEW_CAP = 8;
/** The fewest and most new words a session introduces; see dailyPlan. */
export const SESSION_NEW_MIN = 4;
export const SESSION_NEW_MAX = 10;
/**
 * No new words once the test is this many days away or fewer. A word needs
 * a few spaced recalls to stick, so the last days are review only.
 */
export const NEW_WORD_CUTOFF_DAYS = 3;

/** Digital SAT Reading and Writing pace: 27 questions in 32 minutes per module. */
export const SECONDS_PER_QUESTION = 71;
