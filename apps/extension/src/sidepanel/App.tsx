import { useEffect, useState } from "react";
import { useAuth, useUser, UserButton } from "@clerk/chrome-extension";
import type { DetectedField } from "@job-jet/shared";
import type { ExtensionMessage } from "../lib/messages";
import { fetchProfile, tailorResume, openResumeInNewTab } from "../lib/api";
import { runAutofillMapping } from "../lib/autofill-map";

const SYNC_HOST = import.meta.env.VITE_CLERK_SYNC_HOST;

async function getActiveTab(): Promise<{ id?: number; hostname?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let hostname: string | undefined;
  try {
    hostname = tab?.url ? new URL(tab.url).hostname : undefined;
  } catch {
    hostname = undefined;
  }
  return { id: tab?.id, hostname };
}

async function sendToContentScript<T = unknown>(message: ExtensionMessage): Promise<T> {
  const { id: tabId } = await getActiveTab();
  if (tabId == null) throw new Error("No active tab");
  return chrome.tabs.sendMessage(tabId, message);
}

function openSignIn() {
  chrome.tabs.create({ url: `${SYNC_HOST}/sign-in` });
}

export function App() {
  const { isLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [status, setStatus] = useState<string>("");
  const [generating, setGenerating] = useState(false);

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
      const profile = await fetchProfile(getToken);
      if (!profile) {
        setStatus("No saved profile yet — add one in the Job Jet dashboard first.");
        return;
      }

      // Fresh scan rather than the fields loaded on panel-open: on a
      // multi-step form the fields on screen may have changed since then.
      const [res, { hostname }] = await Promise.all([
        sendToContentScript<{ payload: { fields: DetectedField[] } }>({ type: "REQUEST_FORM_FIELDS" }),
        getActiveTab(),
      ]);
      const currentFields = res.payload.fields;
      setFields(currentFields);

      const mapped = runAutofillMapping(currentFields, profile, hostname ?? "");
      if (mapped.length === 0) {
        setStatus("Didn't recognize any fields we could fill on this page.");
        return;
      }

      const values = Object.fromEntries(mapped.map((m) => [m.selector, m.value]));
      const result = await sendToContentScript<{ filled: number; total: number }>({
        type: "AUTOFILL_REQUEST",
        payload: { values },
      });
      setStatus(
        `Filled ${result.filled} of ${result.total} fields — some fields (file uploads, ` +
          `demographic questions, open-ended questions) need your input. Double-check before submitting.`
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Autofill failed on this page.");
    }
  }

  async function handleGenerateResume() {
    if (!jobDescription) {
      setStatus("Couldn't find a job description on this page to tailor a resume to.");
      return;
    }
    setGenerating(true);
    setStatus("Generating tailored resume — this can take a few seconds…");
    try {
      const resume = await tailorResume(getToken, jobDescription);
      setStatus(`Opening "${resume.fileName}" in a new tab…`);
      await openResumeInNewTab(getToken, resume.id);
      setStatus(`Opened "${resume.fileName}" in a new tab. Attach it manually — browsers don't allow extensions to auto-fill file inputs.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't generate a tailored resume.");
    } finally {
      setGenerating(false);
    }
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
        <button className="secondary" onClick={handleGenerateResume} disabled={generating || !jobDescription}>
          {generating ? "Generating…" : "Generate tailored resume for this job"}
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
