import { hostMatches } from "./detect";

/**
 * Embedded application forms — found live on careers.airbnb.com: the whole
 * form is a job-boards.greenhouse.io/embed/job_app iframe, so a top-frame-
 * only extension saw 0 fields. The fix is deliberately narrow (see the
 * manifest's content_scripts comment): the content script is injected into
 * every frame but stays inert unless the frame itself is a known ATS host,
 * and the side panel only ever talks to frame 0 plus those ATS frames,
 * each addressed by explicit frameId (never a broadcast).
 */

/** Hosts that are on the known-ATS list but aren't application forms when
 *  embedded (LinkedIn's own internal iframes mounted the button 3×). */
const NEVER_EMBEDDED_ATS = ["linkedin.com"];

export function isEmbeddableAtsHost(hostname: string): boolean {
  if (NEVER_EMBEDDED_ATS.some((h) => hostname === h || hostname.endsWith(`.${h}`))) return false;
  return hostMatches(hostname);
}

export function isAtsFrameUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return (u.protocol === "https:" || u.protocol === "http:") && isEmbeddableAtsHost(u.hostname);
  } catch {
    return false;
  }
}

/** Whether the content script should do anything in this frame. */
export function shouldActivateInFrame(isTopFrame: boolean, hostname: string): boolean {
  return isTopFrame || isEmbeddableAtsHost(hostname);
}

/** Frames the side panel should query: the top document always, plus any
 *  subframe whose own URL is a known ATS. */
export function selectTargetFrames(frames: { frameId: number; url?: string }[]): number[] {
  const ids = new Set<number>([0]);
  for (const f of frames) {
    if (f.frameId !== 0 && isAtsFrameUrl(f.url)) ids.add(f.frameId);
  }
  return Array.from(ids);
}

/** Splits selector->value mappings by the frame each field lives in. */
export function groupByFrame<T extends { selector: string }>(
  mapped: T[],
  frameOf: Map<string, number>
): Map<number, T[]> {
  const groups = new Map<number, T[]>();
  for (const m of mapped) {
    const frameId = frameOf.get(m.selector) ?? 0;
    const list = groups.get(frameId) ?? [];
    list.push(m);
    groups.set(frameId, list);
  }
  return groups;
}
