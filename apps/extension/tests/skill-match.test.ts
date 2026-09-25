import { describe, expect, it } from "vitest";
import { matchSkills } from "../src/lib/skill-match";

const skills = (...names: string[]) => names.map((name) => ({ name }));

describe("matchSkills", () => {
  it("matches whole tokens case-insensitively", () => {
    const r = matchSkills(skills("React", "TypeScript", "Go", "Java"), "We use react and typescript. Good JavaScript skills.");
    expect(r.matched).toEqual(["React", "TypeScript"]);
    expect(r.missing).toEqual(["Go", "Java"]);
    expect(r.score).toBe(50);
  });

  it("handles punctuation in skill names", () => {
    const r = matchSkills(skills("C++", "C", "Node.js", "CI/CD", "C#"), "Experience with C++, Node.js and CI/CD pipelines.");
    expect(r.matched).toEqual(["C++", "Node.js", "CI/CD"]);
    expect(r.missing).toEqual(["C", "C#"]);
  });

  it("dedupes and ignores blank skills", () => {
    const r = matchSkills(skills("React", "react", " ", ""), "React");
    expect(r).toEqual({ matched: ["React"], missing: [], score: 100 });
  });

  it("returns a zero score with no skills", () => {
    expect(matchSkills([], "anything").score).toBe(0);
  });
});
