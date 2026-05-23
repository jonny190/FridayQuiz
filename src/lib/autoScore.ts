// Normalise an answer so trivial differences (case, leading/trailing
// whitespace, runs of spaces) don't mark a correct answer as wrong.
function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function answersMatch(
  submitted: string | null | undefined,
  correct: string | null | undefined
): boolean {
  if (!submitted || !correct) return false;
  return normalise(submitted) === normalise(correct);
}

export function autoScore(
  submitted: string | null | undefined,
  correct: string,
  fullPoints: number
): number {
  return answersMatch(submitted, correct) ? fullPoints : 0;
}
