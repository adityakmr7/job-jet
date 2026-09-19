import { useEffect, useRef, useState } from "react";
import { useAuth, useUser, UserButton } from "@clerk/chrome-extension";
import type { DetectedField, Profile } from "@job-jet/shared";
import type { ExtensionMessage } from "../lib/messages";
import { fetchProfile, tailorResume, openResumeInNewTab, upsertApplication } from "../lib/api";
import { runAutofillMapping } from "../lib/autofill-map";

const SYNC_HOST = import.meta.env.VITE_CLERK_SYNC_HOST;
const AUTO_CONTINUE_POLL_MS = 1500;

async function getActiveTab(): Promise<{ id?: number; hostname?: string; url?: string }> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let hostname: string | undefined;
  try {
    hostname = tab?.url ? new URL(tab.url).hostname : undefined;
  } catch {
    hostname = undefined;
  }
  return { id: tab?.id, hostname, url: tab?.url };
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
  const [jobTitle, setJobTitle] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  // Armed after the first manual Autofill click — from then on, new fields
  // that appear (a multi-step wizard's next step) get filled automatically,
  // no repeat click needed. See the polling effect below for why this is
  // poll-based rather than event-driven.
  const [autoContinue, setAutoContinue] = useState(false);

  const profileRef = useRef<Profile | null>(null);
  const knownSelectorsRef = useRef<Set<string>>(new Set());
  const fillingRef = useRef(false);
  const lastHostnameRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!isSignedIn) return;
    sendToContentScript<{ type: string; payload: { fields: DetectedField[] } }>({
      type: "REQUEST_FORM_FIELDS",
    })
      .then((res) => setFields(res.payload.fields))
      .catch(() => setStatus("Couldn't read the form on this page."));

    sendToContentScript<{ type: string; payload: { text: string; title?: string } }>({
      type: "EXTRACT_JOB_DESCRIPTION",
    })
      .then((res) => {
        setJobDescription(res.payload.text);
        setJobTitle(res.payload.title);
      })
      .catch(() => {});

    getActiveTab().then(({ hostname }) => {
      lastHostnameRef.current = hostname;
    });
  }, [isSignedIn]);

  // Safety net for auto-continue: if the active tab navigates to a
  // genuinely different site, stop trying to fill it. Compares hostname
  // only (not the full URL) — a wizard step advancing via pushState/hash
  // change (our own test fixture does this, and so do plenty of real ATS
  // wizards) must NOT be treated as "navigated away", only an actual
  // change of site should disarm.
  useEffect(() => {
    function handleTabUpdate(_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
      if (!changeInfo.url || !tab.active) return;
      let hostname: string | undefined;
      try {
        hostname = new URL(changeInfo.url).hostname;
      } catch {
        return;
      }
      if (lastHostnameRef.current && hostname !== lastHostnameRef.current) {
        setAutoContinue(false);
        profileRef.current = null;
        knownSelectorsRef.current = new Set();
      }
      lastHostnameRef.current = hostname;
    }
    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    return () => chrome.tabs.onUpdated.removeListener(handleTabUpdate);
  }, []);

  /** Maps + fills `fieldsToFill` and reports the result. Shared by the
   *  manual click and the auto-continue poll below. */
  async function fillFields(fieldsToFill: DetectedField[], profile: Profile, hostname: string, auto: boolean) {
    const mapped = runAutofillMapping(fieldsToFill, profile, hostname);
    if (mapped.length === 0) {
      if (!auto) setStatus("Didn't recognize any fields we could fill on this page.");
      return;
    }
    const values = Object.fromEntries(mapped.map((m) => [m.selector, m.value]));
    const result = await sendToContentScript<{ filled: number; total: number }>({
      type: "AUTOFILL_REQUEST",
      payload: { values },
    });
    const prefix = auto
      ? `Auto-filled ${result.filled} more field${result.filled === 1 ? "" : "s"} on this step`
      : `Filled ${result.filled} of ${result.total} fields`;
    setStatus(
      `${prefix} — some fields (file uploads, demographic questions, open-ended questions) ` +
        `need your input. Double-check before submitting.`
    );
  }

  async function handleAutofill() {
    setStatus("Filling…");
    try {
      const profile = await fetchProfile(getToken);
      if (!profile) {
        setStatus("No saved profile yet — add one in the Job Jet dashboard first.");
        return;
      }
      profileRef.current = profile;

      // Fresh scan rather than the fields loaded on panel-open: on a
      // multi-step form the fields on screen may have changed since then.
      const [res, { hostname, url }] = await Promise.all([
        sendToContentScript<{ payload: { fields: DetectedField[] } }>({ type: "REQUEST_FORM_FIELDS" }),
        getActiveTab(),
      ]);
      const currentFields = res.payload.fields;
      setFields(currentFields);
      knownSelectorsRef.current = new Set(currentFields.map((f) => f.selector));

      await fillFields(currentFields, profile, hostname ?? "", false);
      setAutoContinue(true);

      // Best-effort tracker entry — autofilling is a clear enough signal
      // of intent to apply that it's worth tracking automatically, without
      // requiring a separate "start tracking" action from the user.
      if (url) upsertApplication(getToken, { url, jobTitle, jobDescription, status: "draft" });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Autofill failed on this page.");
    }
  }

  // Auto-continue: while armed, poll for fields that weren't on the page
  // last time we looked (a new wizard step) and fill just those. Poll-based
  // rather than a MutationObserver-driven message from the content script
  // because the actual fetch-profile-and-map step needs the Clerk session,
  // which only exists in this side panel's React context — the content
  // script can detect new fields but can't act on them by itself. Needs
  // the panel to stay open; there's no background-auth path yet.
  useEffect(() => {
    if (!autoContinue) return;
    const interval = setInterval(async () => {
      if (fillingRef.current || !profileRef.current) return;
      fillingRef.current = true;
      try {
        const [res, { hostname }] = await Promise.all([
          sendToContentScript<{ payload: { fields: DetectedField[] } }>({ type: "REQUEST_FORM_FIELDS" }),
          getActiveTab(),
        ]);
        const currentFields = res.payload.fields;
        setFields(currentFields);
        const newFields = currentFields.filter((f) => !knownSelectorsRef.current.has(f.selector));
        knownSelectorsRef.current = new Set(currentFields.map((f) => f.selector));
        if (newFields.length > 0) {
          await fillFields(newFields, profileRef.current, hostname ?? "", true);
        }
      } catch {
        // Page navigated away, content script not there this tick, etc. —
        // skip silently rather than surface a scary error for something
        // that resolves itself next tick (or via the tab-update safety net).
      } finally {
        fillingRef.current = false;
      }
    }, AUTO_CONTINUE_POLL_MS);
    return () => clearInterval(interval);
  }, [autoContinue]);

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

      const { url } = await getActiveTab();
      if (url) upsertApplication(getToken, { url, jobTitle, jobDescription, resumeId: resume.id, status: "draft" });
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
        {autoContinue && (
          <p className="hint" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>🟢 Watching for new steps — new fields fill automatically.</span>
            <button
              type="button"
              onClick={() => setAutoContinue(false)}
              style={{ background: "none", border: "none", color: "inherit", textDecoration: "underline", cursor: "pointer", padding: 0 }}
            >
              Stop
            </button>
          </p>
        )}
        {status && <p className="hint">{status}</p>}
      </div>

      <div className="section">
        <h2>Job description detected</h2>
        <p className="hint">{jobDescription ? `${jobDescription.slice(0, 240)}…` : "None found on this page."}</p>
      </div>
    </div>
  );
}
