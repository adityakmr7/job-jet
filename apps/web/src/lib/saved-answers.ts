import { randomUUID } from "node:crypto";
import { ANSWER_LIMITS, type CustomAnswer } from "@job-jet/shared";

function key(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Merges answers saved from the extension ("Save this answer") into the
 * user's custom answers: same question (ignoring case/punctuation) ->
 * the answer is replaced; otherwise appended. Returns null when the result
 * would exceed the per-profile limit.
 */
export function mergeCustomAnswers(
  existing: CustomAnswer[],
  incoming: { question: string; answer: string }[],
  newId: () => string = randomUUID
): CustomAnswer[] | null {
  const merged = existing.map((a) => ({ ...a }));
  for (const item of incoming) {
    const hit = merged.find((a) => key(a.question) === key(item.question));
    if (hit) hit.answer = item.answer;
    else merged.push({ id: newId(), question: item.question, answer: item.answer });
  }
  return merged.length > ANSWER_LIMITS.customAnswers ? null : merged;
}
