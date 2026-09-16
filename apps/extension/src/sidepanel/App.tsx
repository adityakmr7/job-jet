import { useEffect, useState } from "react";
import { useUser, UserButton } from "@clerk/chrome-extension";
import type { DetectedField } from "@job-jet/shared";
import type { ExtensionMessage } from "../lib/messages";

const SYNC_HOST = import.meta.env.VITE_CLERK_SYNC_HOST;

async function getActiveTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.id;
}

async function sendToContentScript<T = unknown>(message: ExtensionMessage): Promise<T> {
  const tabId = await getActiveTabId();
  if (tabId == null) throw new Error("No active tab");
  return chrome.tabs.sendMessage(tabId, message);
}

function openSignIn() {
  chrome.tabs.create({ url: `${SYNC_HOST}/sign-in` });
}

export function App() {
  const { isLoaded, isSignedIn } = useUser();
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

  if (!isLoaded) {
    return (
      <div className="section">
        <p className="hint">Loading…</p>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="section">
        <h1>Job Jet</h1>
        <p>Sign in to autofill applications and generate tailored resumes.</p>
        <button className="primary" onClick={openSignIn}>
          Sign in
        </button>
        <p className="hint">Opens job-jet in a new tab — come back here once you're signed in.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="section" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ margin: 0 }}>Job Jet</h1>
        <UserButton />
      </div>

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
