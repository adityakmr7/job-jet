import { useEffect, useState } from "react";
import type { DetectedField } from "@job-jet/shared";
import type { ExtensionMessage } from "../lib/messages";

// TODO(auth): replace with @clerk/chrome-extension session state once the
// backend/auth phase lands. This stub is what unblocks UI work in parallel.
function useAuth() {
  return { isSignedIn: false, signIn: () => window.open("https://job-jet.app/sign-in", "_blank") };
}

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function sendToContentScript<T = unknown>(message: ExtensionMessage): Promise<T> {
  const tabId = await getActiveTabId();
  if (tabId == null) throw new Error("No active tab");
  return chrome.tabs.sendMessage(tabId, message);
}

export function App() {
  const { isSignedIn, signIn } = useAuth();
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    if (!isSignedIn) return;
    sendToContentScript<{ type: string; payload: { fields: DetectedField[] } }>({
      type: "REQUEST_FORM_FIELDS",
    })
      .then((res) => setFields(res.payload.fields))
      .catch(() => setStatus("Couldn't read the form on this page."));

    sendToContentScript<{ type: string; payload: { text: string } }>({
      type: "EXTRACT_JOB_DESCRIPTION",
    })
      .then((res) => setJobDescription(res.payload.text))
      .catch(() => {});
  }, [isSignedIn]);

  async function handleAutofill() {
    setStatus("Filling…");
    try {
      // TODO(backend): replace with a real call to POST /api/autofill/map
      // (profile + fields[] -> { selector: value }), using layered
      // known-site-adapter -> heuristic -> LLM-fallback matching server-side.
      await sendToContentScript({ type: "AUTOFILL_REQUEST", payload: { values: {} } });
      setStatus("Filled what we could — please double-check before submitting.");
    } catch {
      setStatus("Autofill failed on this page.");
    }
  }

  async function handleGenerateResume() {
    setStatus("Generating tailored resume…");
    // TODO(backend): POST /api/resume/generate { jobDescription } -> returns
    // a Blob URL for the tailored PDF; then offer download + attempt to
    // attach it to any file input via the AUTOFILL_REQUEST file-injection path.
    setStatus("Resume generation isn't wired up yet — backend phase next.");
  }

  if (!isSignedIn) {
    return (
      <div className="section">
        <h1>Job Jet</h1>
        <p>Sign in to autofill applications and generate tailored resumes.</p>
        <button className="primary" onClick={signIn}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>Job Jet</h1>

      <div className="section">
        <h2>This page</h2>
        <p>{fields.length} form field{fields.length === 1 ? "" : "s"} detected.</p>
        <button className="primary" onClick={handleAutofill}>
          Autofill with my profile
        </button>
        <button className="secondary" onClick={handleGenerateResume}>
          Generate tailored resume for this job
        </button>
        {status && <p className="hint">{status}</p>}
      </div>

      <div className="section">
        <h2>Job description detected</h2>
        <p className="hint">{jobDescription ? `${jobDescription.slice(0, 240)}…` : "None found on this page."}</p>
      </div>
    </div>
  );
}
