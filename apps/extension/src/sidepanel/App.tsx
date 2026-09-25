import { useEffect, useRef, useState } from "react";
import { useAuth, useUser, UserButton } from "@clerk/chrome-extension";
import type { DetectedField, Profile } from "@job-jet/shared";
import type { ExtensionMessage } from "../lib/messages";
import { fetchProfile, tailorResume, downloadResume, upsertApplication, mapFieldsWithLLM } from "../lib/api";
import { runAutofillMapping, matches, NEVER_FILL } from "../lib/autofill-map";
import { fillFieldsInMainWorld } from "../lib/main-world-fill";

const SYNC_HOST = import.meta.env.VITE_CLERK_SYNC_HOST;
const AUTO_CONTINUE_POLL_MS = 1500;

async function getActiveTab(): Promise<{ id?: number; hostname?: string; url?: string }> {
  // lastFocusedWindow, not currentWindow: this runs from the side panel's
  // own extension page context, and currentWindow's resolution from a
  // side panel (as opposed to a normal tab) isn't reliably the browser
  // window it's docked to on every Chrome version — lastFocusedWindow is
  // the more robust choice recommended for popup/side-panel contexts.
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
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
  // frameId: 0 = the top-level document only. Without this, Chrome
  // broadcasts to EVERY frame the content script is injected into
  // (manifest has all_frames: true) — including third-party iframes like
  // reCAPTCHA or a Maps/Places embed, which real ATS forms often carry.
  // Those iframes have their own content-script instance too, and if
  // THEIRS responds first (a tiny iframe document parses and responds
  // faster than the real page), chrome.tabs.sendMessage's promise
  // resolves with the iframe's empty result instead of the real page's —
  // found live, against a real Greenhouse posting with a reCAPTCHA +
  // Places-autocomplete iframe, as the actual cause of "0 fields
  // detected" despite the real form clearly having fields.
  return chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
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
  const isSignedInRef = useRef(isSignedIn);
  useEffect(() => {
    isSignedInRef.current = isSignedIn;
  }, [isSignedIn]);

  /** Re-reads "this page"'s fields + job description from whatever tab is
   *  currently focused. The side panel is a single global page (Chrome's
   *  sidePanel API doesn't give each tab its own instance unless you opt
   *  into per-tab options, which this project doesn't) — it stays mounted
   *  as the user switches tabs, so without an explicit refresh on tab
   *  change, the panel keeps showing whatever tab was active when it was
   *  first opened. Called on sign-in, on every tab switch, and whenever
   *  the active tab navigates to a different site. */
  async function refreshPageData() {
    if (!isSignedInRef.current) return;
    const fetchFields = sendToContentScript<{ type: string; payload: { fields: DetectedField[] } }>({
      type: "REQUEST_FORM_FIELDS",
    })
      .then((res) => {
        setFields(res.payload.fields);
      })
      .catch((err) => {
        // Was previously silent — surfaced now because a swallowed error
        // here looks IDENTICAL in the UI to a genuine "no fields on this
        // page" (both just show 0), which cost real debugging time working
        // out that a failure, not an empty result, was behind a "0 fields"
        // report. console.error is the best available signal today since
        // the side panel's own devtools console isn't reachable from
        // outside it — open the panel, right-click it, Inspect, to see this.
        console.error("[job-jet] REQUEST_FORM_FIELDS failed:", err);
        setFields([]);
      });

    const fetchJd = sendToContentScript<{ type: string; payload: { text: string; title?: string } }>({
      type: "EXTRACT_JOB_DESCRIPTION",
    })
      .then((res) => {
        setJobDescription(res.payload.text);
        setJobTitle(res.payload.title);
      })
      .catch((err) => {
        console.error("[job-jet] EXTRACT_JOB_DESCRIPTION failed:", err);
        setJobDescription("");
        setJobTitle(undefined);
      });

    await Promise.all([fetchFields, fetchJd]);
  }

  useEffect(() => {
    if (!isSignedIn) return;
    refreshPageData();
    getActiveTab().then(({ hostname }) => {
      lastHostnameRef.current = hostname;
    });
  }, [isSignedIn]);

  // Re-sync "this page" whenever the user switches to a different tab —
  // otherwise the summary above (and what Autofill would report before
  // it re-scans on click) stays stuck on whichever tab was active when
  // the panel first opened. See refreshPageData's doc comment.
  useEffect(() => {
    function handleActivated() {
      refreshPageData();
    }
    chrome.tabs.onActivated.addListener(handleActivated);
    return () => chrome.tabs.onActivated.removeListener(handleActivated);
  }, []);

  // Two independent things keyed off the SAME tab-update event, on
  // purpose kept in one listener since they share the changeInfo/tab
  // params:
  //
  // 1. Auto-continue safety net: disarm as soon as the active tab's URL
  //    changes to a genuinely different HOSTNAME (fires early, at
  //    navigation start, so a mid-fill auto-continue stops promptly
  //    rather than fighting a page the user's already left). Hostname
  //    only, not the full URL — a wizard step advancing via
  //    pushState/hash change (our own test fixture does this, and so do
  //    plenty of real ATS wizards) must NOT be treated as "navigated
  //    away".
  //
  // 2. Re-sync "this page"'s fields/JD whenever the active tab finishes
  //    loading ANY page — deliberately NOT gated on the hostname having
  //    changed. Found the hard way: closing one job-posting tab and
  //    opening a fresh one on the SAME ATS domain (e.g. two different
  //    Greenhouse postings) is a different physical tab/content-script
  //    instance even though the hostname string is identical to
  //    whatever was last recorded — a hostname-equality check skips the
  //    refresh for that case even though the old cached fields/JD are
  //    from an entirely different, now-gone page. `status === "complete"`
  //    is the actual right signal for "a real navigation just finished
  //    on the active tab", independent of whether the hostname matches
  //    the previous one.
  useEffect(() => {
    function handleTabUpdate(_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
      if (!tab.active) return;

      if (changeInfo.url) {
        let hostname: string | undefined;
        try {
          hostname = new URL(changeInfo.url).hostname;
        } catch {
          hostname = undefined;
        }
        if (hostname) {
          if (lastHostnameRef.current && hostname !== lastHostnameRef.current) {
            setAutoContinue(false);
            profileRef.current = null;
            knownSelectorsRef.current = new Set();
          }
          lastHostnameRef.current = hostname;
        }
      }

      if (changeInfo.status === "complete") {
        refreshPageData();
      }
    }
    chrome.tabs.onUpdated.addListener(handleTabUpdate);
    return () => chrome.tabs.onUpdated.removeListener(handleTabUpdate);
  }, []);

  /** Maps + fills `fieldsToFill` and reports the result. Shared by the
   *  manual click and the auto-continue poll below.
   *
   *  Tiers 1+2 (heuristic + known-site adapter, both client-side and
   *  instant) run first via runAutofillMapping. Whatever's left over —
   *  fields neither recognized by wording nor by a per-site adapter, that
   *  aren't file inputs (never scriptable), and aren't voluntary EEO
   *  self-identification fields — goes to tier 3: a backend call that
   *  asks an LLM to match them against a closed set of known profile
   *  attributes, backed by a crowdsourced per-domain cache (see apps/web's
   *  /api/autofill/map) so the same field wording on the same ATS only
   *  ever costs one real model call across ALL users.
   *
   *  The NEVER_FILL exclusion is applied here too, not just inside tier
   *  1's own mapProfileToFields — safe by construction, not by accident:
   *  today tier 3's allow-list happens not to include any EEO category,
   *  so it would return null for these anyway, but that's a property of
   *  the allow-list's current contents, not an explicit guarantee. This
   *  makes the exclusion hold regardless of what the allow-list contains
   *  later, and saves a wasted round of tokens asking about fields
   *  tier 1 already decided are never appropriate to guess-fill. */
  async function fillFields(fieldsToFill: DetectedField[], profile: Profile, hostname: string, auto: boolean) {
    const mapped = runAutofillMapping(fieldsToFill, profile, hostname);

    const claimed = new Set(mapped.map((m) => m.selector));
    const unresolved = fieldsToFill.filter(
      (f) => !claimed.has(f.selector) && f.type !== "file" && !matches(f, NEVER_FILL)
    );
    const llmMapped = unresolved.length > 0 ? await mapFieldsWithLLM(getToken, hostname, unresolved) : [];

    const allMapped = [...mapped, ...llmMapped];
    if (allMapped.length === 0) {
      if (!auto) setStatus("Didn't recognize any fields we could fill on this page.");
      return;
    }
    const values = Object.fromEntries(allMapped.map((m) => [m.selector, m.value]));
    const { id: tabId } = await getActiveTab();
    if (tabId == null) throw new Error("No active tab");
    // Main-world injection, not a content-script message — see
    // main-world-fill.ts for why: on a real React-controlled form,
    // isolated-world event dispatch silently doesn't stick.
    const result = await fillFieldsInMainWorld(tabId, values);
    const smartMatchNote = llmMapped.length > 0 ? ` (${llmMapped.length} via smart match)` : "";
    const prefix = auto
      ? `Auto-filled ${result.filled} more field${result.filled === 1 ? "" : "s"} on this step${smartMatchNote}`
      : `Filled ${result.filled} of ${result.total} fields${smartMatchNote}`;
    setStatus(
      `${prefix} — some fields (file uploads, demographic questions, open-ended questions) ` +
        `need your input. Double-check before submitting.`
    );
  }

  async function handleAutofill() {
    setStatus("Filling…");
    try {
      // Profile fetch (network) and field scan (local messaging) don't
      // depend on each other — run them together rather than back to
      // back. The scan is fast enough that this effectively hides its
      // latency entirely behind the profile fetch instead of adding its
      // own sequential chunk on top.
      const [profile, res, { hostname, url }] = await Promise.all([
        fetchProfile(getToken),
        sendToContentScript<{ payload: { fields: DetectedField[] } }>({ type: "REQUEST_FORM_FIELDS" }),
        getActiveTab(),
      ]);
      if (!profile) {
        setStatus("No saved profile yet — add one in the Job Jet dashboard first.");
        return;
      }
      profileRef.current = profile;

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
    // Deliberately keyed on autoContinue only: fillFields is recreated every
    // render, and restarting the poll on each render would reset its timer.
    // Everything it reads that changes over time is accessed via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setStatus(`Downloading "${resume.fileName}"…`);
      await downloadResume(getToken, resume.id, resume.fileName);
      setStatus(
        `Downloaded "${resume.fileName}" — attach it manually on this page ` +
          `(browsers don't allow extensions to auto-fill file inputs).`
      );

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
