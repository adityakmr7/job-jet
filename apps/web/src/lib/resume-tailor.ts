import { generateObject } from "ai";
import { z } from "zod";
import type { ResumeContent } from "@job-jet/shared";
import { getModel } from "./ai";

/**
 * Tailors a resume to a specific job description — but "by construction"
 * safe against the model inventing facts, not just prompted to be careful.
 * The model is only ever asked to (a) rewrite the summary, (b) reword
 * *existing* bullets per role (same role, same count in, same count out —
 * it can't add a bullet's worth of fabricated achievement), and
 * (c) reorder/select from the user's *existing* skill names. It is never
 * given the ability to touch name, contact info, links, employers, titles,
 * dates, or education — those are copied through from the source profile
 * untouched, in code, not by asking nicely in the prompt.
 *
 * This matters more here than in resume-parse.ts: parsing is extractive
 * (the model can only get it wrong), tailoring is generative (the model
 * could make something up that reads perfectly plausibly on a resume a
 * human then submits under their own name).
 */

const TailorResultSchema = z.object({
  summary: z.string(),
  // One entry per role, same order as the input experience array.
  experienceBullets: z.array(z.array(z.string())),
  // Reordered/selected subset of the user's own skill names — validated
  // against the real list below, not trusted as-is.
  skillOrder: z.array(z.string()),
});

export async function tailorResume(profile: ResumeContent, jobDescription: string): Promise<ResumeContent> {
  const experienceForPrompt = profile.experience.map((e, i) => ({
    index: i,
    company: e.company,
    title: e.title,
    bullets: e.bullets,
  }));
  const skillNames = profile.skills.map((s) => s.name);

  const { object } = await generateObject({
    model: getModel(),
    schema: TailorResultSchema,
    system:
      "You tailor resume content to a specific job description. You are " +
      "REWORDING existing, true content to emphasize what's relevant — " +
      "never inventing employers, skills, technologies, metrics, or " +
      "achievements that aren't already present in the source. " +
      "For each role's bullets: return the SAME NUMBER of bullets as given, " +
      "rewritten to better highlight relevance to the job description " +
      "(sharper phrasing, relevant keywords the underlying achievement " +
      "already supports) — never adding a new claim. " +
      "For skills: return the user's own skill names only, reordered so " +
      "the most job-relevant come first; you may omit clearly irrelevant " +
      "ones but never invent a skill that isn't in the given list. " +
      "Write a 2-3 sentence summary tailored to this role, grounded only " +
      "in the experience/skills given.",
    prompt:
      `Job description:\n${jobDescription}\n\n` +
      `Candidate's current summary:\n${profile.summary ?? "(none)"}\n\n` +
      `Candidate's experience (rewrite bullets per role, same order, same count):\n` +
      JSON.stringify(experienceForPrompt, null, 2) +
      `\n\nCandidate's skills (reorder/select from this list only):\n` +
      JSON.stringify(skillNames),
  });

  // Merge back onto the untouched source — this is what actually enforces
  // the "can't fabricate facts" guarantee, not the prompt.
  const experience = profile.experience.map((e, i) => {
    const rewritten = object.experienceBullets[i];
    const sameLength = Array.isArray(rewritten) && rewritten.length === e.bullets.length;
    return { ...e, bullets: sameLength ? rewritten : e.bullets };
  });

  const knownSkillNames = new Set(skillNames.map((n) => n.toLowerCase()));
  const mentioned = new Set<string>();
  // Keep only the user's own skills, once each (the model may repeat one
  // with different casing).
  const orderedKnown = object.skillOrder.filter((name) => {
    const key = name.toLowerCase();
    if (!knownSkillNames.has(key) || mentioned.has(key)) return false;
    mentioned.add(key);
    return true;
  });
  // Anything the model dropped still gets appended — reordering/trimming
  // for relevance is fine, silently losing a skill the user listed isn't.
  const remaining = profile.skills.filter((s) => !mentioned.has(s.name.toLowerCase()));
  const skills = [
    ...orderedKnown.map((name) => profile.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())!),
    ...remaining,
  ];

  return {
    ...profile,
    summary: object.summary,
    experience,
    skills,
  };
}
