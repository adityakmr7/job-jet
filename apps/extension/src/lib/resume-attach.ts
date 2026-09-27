import type { DetectedField } from "@job-jet/shared";
import { matches } from "./autofill-map";

/**
 * Which file input gets the stored resume on Autofill. Browsers do let a
 * page script set an <input type=file>'s files from a DataTransfer (that's
 * how drag-and-drop works), so the side panel downloads the user's resume
 * and main-world-fill.ts attaches it — but only to the form's own resume
 * field, one per frame, and never over a file the user already picked.
 */

const RESUME_FIELD = /resume|\bcv\b|curriculum/i;

/** The form's own resume/CV file input — never a cover-letter input, and
 *  never an ATS's "autofill from resume" importer (found live on Ashby:
 *  attaching there makes Ashby parse the file and re-render the whole form,
 *  wiping every value just filled). */
export function isResumeInput(f: DetectedField): boolean {
  return (
    f.type === "file" &&
    matches(f, RESUME_FIELD) &&
    !matches(f, /cover|autofill|auto-fill|import|parse|transcript|portfolio/i)
  );
}

/** At most one resume input per frame: the first one — and only in a frame
 *  whose form is actually on screen. File inputs survive the visibility
 *  filter (they're always visually hidden), so a frame that yields file
 *  inputs but no other field is a collapsed form (found live: Airbnb's
 *  Greenhouse embed sits in a 0x0 iframe until the "Application" tab is
 *  opened). */
export function resumeInputsByFrame(fields: DetectedField[]): DetectedField[] {
  const framesWithForm = new Set(fields.filter((f) => f.type !== "file").map((f) => f.frameId ?? 0));
  const seen = new Set<number>();
  return fields.filter((f) => {
    if (!isResumeInput(f)) return false;
    const frame = f.frameId ?? 0;
    if (!framesWithForm.has(frame)) return false;
    if (seen.has(frame)) return false;
    seen.add(frame);
    return true;
  });
}
