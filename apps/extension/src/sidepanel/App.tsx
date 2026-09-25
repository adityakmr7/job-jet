import { useEffect, useRef, useState } from "react";
import type { DetectedField, Profile } from "@job-jet/shared";
import type { ExtensionMessage } from "../lib/messages";
import { fetchProfile, tailorResume, downloadResume, upsertApplication, mapFieldsWithLLM } from "../lib/api";
import { runAutofillMapping, matches, NEVER_FILL } from "../lib/autofill-map";
import { fillFieldsInMainWorld } from "../lib/main-world-fill";
import { matchSkills } from "../lib/skill-match";
import logoUrl from "../assets/logo-mark-small.svg";
import { API_BASE_URL } from "../lib/config";
import { useAuth } from "./useAuth";
import { AccountMenu } from "./AccountMenu";

const SYNC_HOST = API_BASE_URL;
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

export function App() {
  const { state: auth, getToken, connect, signOut } = useAuth();
  const isLoaded = auth.status !== "loading";
  const isSignedIn = auth.status === "signed-in";
  const [connecting, setConnecting] = useState(false);
  const [fields, setFields] = useState<DetectedField[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [jobTitle, setJobTitle] = useState<string | undefined>(undefined);
  const [status, setStatusState] = useState<Status | null>(null);
  const [filling, setFilling] = useState(false);
  const [lastFill, setLastFill] = useState<{ filled: number; total: number } | null>(null);
  const [skills, setSkills] = useState<{ name: string }[] | null>(null);
  const [pageHost, setPageHost] = useState<string | undefined>(undefined);
  const [jdExpanded, setJdExpanded] = useState(false);
  const setStatus = (text: string, tone: StatusTone = "info") => setStatusState({ text, tone });
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
    getActiveTab()
      .then(({ hostname }) => setPageHost(hostname))
      .catch(() => setPageHost(undefined));
    setLastFill(null);
    setJdExpanded(false);
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
    // Skills power the local "skill match" card; best-effort, the panel
    // works without them.
    fetchProfile(getToken)
      .then((profile) => setSkills(profile?.skills ?? []))
      .catch(() => setSkills(null));
    getActiveTab().then(({ hostname }) => {
      lastHostnameRef.current = hostname;
    });
    // Runs once per sign-in: getToken's identity isn't stable across
    // renders, and refreshPageData reads everything it needs via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (!auto) setStatus("Didn't recognize any fields we could fill on this page.", "warning");
      return;
    }
    const values = Object.fromEntries(allMapped.map((m) => [m.selector, m.value]));
    const { id: tabId } = await getActiveTab();
    if (tabId == null) throw new Error("No active tab");
    // Main-world injection, not a content-script message — see
    // main-world-fill.ts for why: on a real React-controlled form,
    // isolated-world event dispatch silently doesn't stick.
    const result = await fillFieldsInMainWorld(tabId, values);
    setLastFill((prev) => (auto && prev ? { filled: prev.filled + result.filled, total: prev.total + result.total } : result));
    const smartMatchNote = llmMapped.length > 0 ? ` (${llmMapped.length} via smart match)` : "";
    const prefix = auto
      ? `Auto-filled ${result.filled} more field${result.filled === 1 ? "" : "s"} on this step${smartMatchNote}`
      : `Filled ${result.filled} of ${result.total} fields${smartMatchNote}`;
    setStatus(
      `${prefix}. File uploads, demographic and open-ended questions still need you — review before submitting.`,
      "success"
    );
  }

  async function handleAutofill() {
    setStatus("Filling this form…", "loading");
    setFilling(true);
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
        setStatus("No saved profile yet — add one in the Job Jet dashboard first.", "warning");
        return;
      }
      profileRef.current = profile;
      setSkills(profile.skills ?? []);

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
      setStatus(err instanceof Error ? err.message : "Autofill failed on this page.", "error");
    } finally {
      setFilling(false);
    }
  }

  // Auto-continue: while armed, poll for fields that weren't on the page
  // last time we looked (a new wizard step) and fill just those. Poll-based
  // rather than a MutationObserver-driven message from the content script
  // because the actual fetch-profile-and-map step needs the auth token,
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
      setStatus("Couldn't find a job description on this page to tailor a resume to.", "warning");
      return;
    }
    setGenerating(true);
    setStatus("Tailoring your resume to this job — this can take a few seconds…", "loading");
    try {
      const resume = await tailorResume(getToken, jobDescription);
      setStatus(`Downloading "${resume.fileName}"…`, "loading");
      await downloadResume(getToken, resume.id, resume.fileName);
      setStatus(
        `Saved "${resume.fileName}" to Downloads. Attach it in the form's resume field ` +
          `(browsers don't let extensions fill file inputs).`,
        "success"
      );

      const { url } = await getActiveTab();
      if (url) upsertApplication(getToken, { url, jobTitle, jobDescription, resumeId: resume.id, status: "draft" });
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Couldn't generate a tailored resume.", "error");
    } finally {
      setGenerating(false);
    }
  }

  if (!isLoaded) {
    return (
      <div className="panel" aria-busy="true">
        <header className="topbar">
          <Brand />
        </header>
        <div className="card">
          <div className="skeleton" style={{ width: "40%" }} />
          <div className="skeleton" style={{ width: "70%", height: 28, marginTop: 12 }} />
          <div className="skeleton" style={{ height: 42, marginTop: 16 }} />
          <div className="skeleton" style={{ height: 42, marginTop: 8 }} />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (!isSignedIn) {
    const expired = auth.status === "signed-out" && auth.reason === "expired";
    const handleConnect = async () => {
      setConnecting(true);
      try {
        await connect();
      } finally {
        setTimeout(() => setConnecting(false), 1500);
      }
    };
    return (
      <div className="panel">
        <header className="topbar">
          <Brand />
        </header>
        <section className="card hero">
          <h1>{expired ? "Welcome back." : "Apply in minutes, not evenings."}</h1>
          <p className="muted">
            {expired
              ? "Your session ended (you signed out elsewhere or it expired). Reconnect to keep filling applications."
              : "Connect your Job Jet account to fill applications from your profile and tailor your resume to each job."}
          </p>
          {!expired && (
            <ul className="checklist">
              <li>Autofill forms on any careers site</li>
              <li>Tailored resume PDFs in seconds</li>
              <li>Every application tracked for you</li>
            </ul>
          )}
          <button className="btn btn-primary" onClick={handleConnect} disabled={connecting}>
            {connecting ? <Spinner /> : null}
            {expired ? "Reconnect to Job Jet" : "Connect to Job Jet"}
          </button>
          <p className="hint">
            Opens Job Jet in a new tab. Sign in (or{" "}
            <a href={`${SYNC_HOST}/sign-up`} target="_blank" rel="noopener noreferrer">
              create a free account
            </a>
            ), then click <strong>Connect extension</strong>.
          </p>
        </section>
      </div>
    );
  }

  const match = skills && skills.length > 0 && jobDescription ? matchSkills(skills, jobDescription) : null;
  const busy = filling || generating;

  return (
    <div className="panel">
      <header className="topbar">
        <Brand />
        <AccountMenu user={auth.user} dashboardUrl={`${SYNC_HOST}/dashboard`} onSignOut={signOut} />
      </header>

      <section className="card" aria-labelledby="page-heading">
        <div className="card-head">
          <h2 id="page-heading" className="eyebrow">
            This page
          </h2>
          {pageHost && (
            <span className="chip" title={pageHost}>
              {pageHost}
            </span>
          )}
        </div>
        {jobTitle && <p className="job-title">{jobTitle}</p>}
        <div className="stat-row">
          <div className="stat">
            <span className="stat-value">{fields.length}</span>
            <span className="stat-label">field{fields.length === 1 ? "" : "s"} detected</span>
          </div>
          {lastFill && (
            <div className="stat">
              <span className="stat-value accent">{lastFill.filled}</span>
              <span className="stat-label">filled</span>
            </div>
          )}
        </div>
        {lastFill && lastFill.total > 0 && (
          <div
            className="progress"
            role="progressbar"
            aria-label="Fields filled"
            aria-valuemin={0}
            aria-valuemax={lastFill.total}
            aria-valuenow={lastFill.filled}
          >
            <div style={{ width: `${Math.min(100, (lastFill.filled / lastFill.total) * 100)}%` }} />
          </div>
        )}

        <div className="actions">
          <button className="btn btn-primary" onClick={handleAutofill} disabled={busy}>
            {filling ? <Spinner /> : <BoltIcon />}
            {filling ? "Filling…" : lastFill ? "Autofill again" : "Autofill this application"}
          </button>
          <button className="btn btn-secondary" onClick={handleGenerateResume} disabled={busy || !jobDescription}>
            {generating ? <Spinner /> : <SparkIcon />}
            {generating ? "Tailoring…" : "Tailor my resume to this job"}
          </button>
        </div>

        {autoContinue && (
          <div className="watching" role="status">
            <span className="pulse" aria-hidden="true" />
            <span>Watching for the next step — new fields fill automatically.</span>
            <button type="button" className="link-btn" onClick={() => setAutoContinue(false)}>
              Stop
            </button>
          </div>
        )}

        {status && (
          <div className={`alert alert-${status.tone}`} role={status.tone === "error" ? "alert" : "status"}>
            {status.tone === "loading" && <Spinner />}
            <span>{status.text}</span>
          </div>
        )}
      </section>

      {match && (
        <section className="card" aria-labelledby="match-heading">
          <div className="card-head">
            <h2 id="match-heading" className="eyebrow">
              Skill match
            </h2>
            <span className={`score ${match.score >= 50 ? "good" : match.score >= 25 ? "ok" : "low"}`}>{match.score}%</span>
          </div>
          <p className="muted small">
            {match.matched.length} of {match.matched.length + match.missing.length} skills from your profile appear in
            this job post.
          </p>
          {match.matched.length > 0 && (
            <ul className="chips" aria-label="Skills this job mentions">
              {match.matched.slice(0, 12).map((s) => (
                <li key={s} className="chip chip-success">
                  {s}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="jd-heading">
        <div className="card-head">
          <h2 id="jd-heading" className="eyebrow">
            Job description
          </h2>
          {jobDescription && <span className="chip chip-accent">Detected</span>}
        </div>
        {jobDescription ? (
          <>
            <p className={`jd ${jdExpanded ? "expanded" : ""}`}>{jobDescription.slice(0, jdExpanded ? 4000 : 280)}{!jdExpanded && jobDescription.length > 280 ? "…" : ""}</p>
            {jobDescription.length > 280 && (
              <button type="button" className="link-btn" onClick={() => setJdExpanded((v) => !v)} aria-expanded={jdExpanded}>
                {jdExpanded ? "Show less" : "Show more"}
              </button>
            )}
          </>
        ) : (
          <p className="muted small">None found on this page. Open the job post itself to tailor a resume.</p>
        )}
      </section>

      <footer className="panel-footer">
        <a href={`${SYNC_HOST}/dashboard`} target="_blank" rel="noopener noreferrer">
          Profile
        </a>
        <span aria-hidden="true">·</span>
        <a href={`${SYNC_HOST}/dashboard/applications`} target="_blank" rel="noopener noreferrer">
          Applications
        </a>
      </footer>
    </div>
  );
}

type StatusTone = "info" | "success" | "warning" | "error" | "loading";
type Status = { text: string; tone: StatusTone };

function Brand() {
  return (
    <span className="brand">
      <img src={logoUrl} alt="" width={24} height={24} />
      <span>
        Job<span className="brand-accent">Jet</span>
      </span>
    </span>
  );
}

function Spinner() {
  return <span className="spinner" aria-hidden="true" />;
}

function BoltIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
    </svg>
  );
}
