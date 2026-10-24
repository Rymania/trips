/** Optimal-string-alignment distance: Levenshtein plus adjacent transpositions. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [
    i,
    ...new Array<number>(b.length).fill(0),
  ]);
  for (let j = 0; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = v;
    }
  }
  return d[a.length]![b.length]!;
}

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** True when every query token matches some haystack token exactly, by prefix, or within a typo budget. */
export function fuzzyMatches(query: string, haystack: string): boolean {
  const q = tokenize(query);
  if (q.length === 0) return true;
  const h = tokenize(haystack);
  return q.every((qt) =>
    h.some((ht) => {
      if (ht.startsWith(qt) || ht.includes(qt)) return true;
      const budget = qt.length >= 8 ? 2 : qt.length >= 4 ? 1 : 0;
      return budget > 0 && editDistance(qt, ht) <= budget;
    }),
  );
}
