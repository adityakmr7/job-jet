import type { Profile } from "@job-jet/shared";

/** Small profile-shape helpers shared by the heuristic autofill tier and
 *  the known-site adapters — split out so neither has to import the other
 *  (autofill-map.ts composes adapters + heuristic; adapters need these same
 *  helpers, and importing them from autofill-map.ts would be circular). */

export function firstAndLastName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export function findLink(profile: Profile, ...keywords: string[]): string | undefined {
  const link = profile.links.find((l) =>
    keywords.some((kw) => l.label.toLowerCase().includes(kw) || l.url.toLowerCase().includes(kw))
  );
  return link?.url;
}

export function yesNo(value: boolean | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value ? "Yes" : "No";
}
