export function parseMemberEmails(input: unknown): string[] {
  let lines: string[];
  if (Array.isArray(input)) {
    lines = input.filter((v): v is string => typeof v === "string");
  } else if (typeof input === "string") {
    lines = input.split(/[\n,]/);
  } else {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}
