// Checks a typed word against the accepted spellings. No imports, so the
// browser can use it without pulling in the word list.

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const keep = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = keep;
    }
  }
  return row[b.length];
}

/**
 * True when what was typed is one of the accepted spellings, allowing a single
 * slip of the keyboard on a word of six letters or more: the exercise tests
 * recall, not typing.
 */
export function typedIsOneOf(accepted: string[], typed: string): boolean {
  const said = typed.trim().toLowerCase();
  if (!said) return false;
  return accepted.some((x) => {
    const want = x.toLowerCase();
    return said === want || (want.length >= 6 && editDistance(said, want) <= 1);
  });
}
