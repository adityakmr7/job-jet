import { createGoogle } from "@ai-sdk/google";

/**
 * Single seam for which LLM provider backs the app. Dev uses a free Gemini
 * API key; swapping to Vercel AI Gateway (or straight to Anthropic/OpenAI)
 * later is a change to this file only — nothing that calls `getModel()`
 * needs to know.
 */
export function getModel() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey and add it via `vercel env add`."
    );
  }
  const google = createGoogle({ apiKey });
  return google("gemini-flash-latest");
}
