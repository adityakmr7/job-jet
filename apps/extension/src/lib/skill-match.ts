/**
 * Which of the user's own profile skills a job description mentions — a
 * quick, local "how well do I fit" signal for the side panel. Pure string
 * matching on the user's existing skill names (nothing is sent anywhere,
 * no model call): case-insensitive, whole-token matches only, so "Go"
 * doesn't match "good" and "Java" doesn't match "JavaScript", while names
 * with punctuation ("C++", "Node.js", "CI/CD") still work.
 */
export interface SkillMatch {
  matched: string[];
  missing: string[];
  /** 0–100, share of the user's skills the job mentions. */
  score: number;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function matchSkills(skills: { name: string }[], jobDescription: string): SkillMatch {
  const seen = new Set<string>();
  const names = skills
    .map((s) => s.name.trim())
    .filter((n) => {
      const key = n.toLowerCase();
      if (!n || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const matched: string[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(name)}(?![A-Za-z0-9+#])`, "i");
    (re.test(jobDescription) ? matched : missing).push(name);
  }
  const score = names.length ? Math.round((matched.length / names.length) * 100) : 0;
  return { matched, missing, score };
}
