"use client";

import { useEffect, useId, useState } from "react";
import {
  Plus,
  X,
  CircleCheck,
  CircleAlert,
  UserRound,
  Link2,
  BadgeCheck,
  Briefcase,
  GraduationCap,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/feedback";
import type { Education, Link, Profile, Skill, WorkExperience } from "@job-jet/shared";

type ProfileForm = Omit<Profile, "id" | "userId" | "updatedAt">;

/**
 * What autofill and resume tailoring actually draw on — surfaced as a
 * live checklist so gaps are visible while editing, not just something the
 * user has to notice by scanning empty inputs. `required` fields block
 * Save (enforced server-side too, by the profile schema); everything else
 * is optional but flagged since a form asking for it will otherwise go
 * unfilled.
 */
function computeCompleteness(profile: ProfileForm) {
  const checks: { label: string; required: boolean; ok: boolean }[] = [
    { label: "Full name", required: true, ok: !!profile.fullName.trim() },
    { label: "Email", required: true, ok: !!profile.email.trim() },
    { label: "Phone number", required: false, ok: !!profile.phone?.trim() },
    { label: "Location", required: false, ok: !!profile.location?.trim() },
    { label: "A link (LinkedIn, portfolio, etc.)", required: false, ok: profile.links.length > 0 },
    {
      label: "Work authorization answered",
      required: false,
      ok: profile.workAuthorization?.authorizedToWork !== undefined,
    },
    { label: "At least one work experience", required: false, ok: profile.experience.length > 0 },
    { label: "At least one school", required: false, ok: profile.education.length > 0 },
    { label: "At least one skill", required: false, ok: profile.skills.length > 0 },
  ];
  const missing = checks.filter((c) => !c.ok);
  return { missing, total: checks.length, filled: checks.length - missing.length };
}

function emptyProfile(seed: { fullName?: string; email?: string }): ProfileForm {
  return {
    fullName: seed.fullName ?? "",
    email: seed.email ?? "",
    phone: "",
    location: "",
    links: [],
    summary: "",
    education: [],
    experience: [],
    skills: [],
    workAuthorization: { authorizedToWork: undefined, requiresSponsorship: undefined },
    additionalQuestions: {},
  };
}

function newId() {
  return crypto.randomUUID();
}

const addButton =
  "inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-sm font-semibold text-accent hover:bg-accent-soft transition-colors";
const removeButton =
  "inline-flex items-center gap-1 rounded-full px-2.5 h-7 text-xs font-medium text-muted hover:text-danger hover:bg-danger-soft transition-colors";
const iconButton =
  "shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full text-muted hover:text-danger hover:bg-danger-soft transition-colors";
const subCard = "rounded-[var(--radius-lg)] border border-border bg-surface-sunken/60 p-4 flex flex-col gap-3";

export function ProfileEditor({
  initialProfile,
  defaultEmail,
  defaultName,
  startDirty = false,
}: {
  initialProfile: ProfileForm | null;
  defaultEmail: string;
  defaultName: string;
  /** True when the initial values haven't been saved yet (e.g. prefilled from a resume). */
  startDirty?: boolean;
}) {
  const [profile, setProfile] = useState<ProfileForm>(
    initialProfile ?? emptyProfile({ fullName: defaultName, email: defaultEmail })
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [dirty, setDirty] = useState(startDirty || initialProfile === null);
  const uid = useId();
  const fid = (name: string) => `${uid}-${name}`;

  // Toasts dismiss themselves.
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), status.tone === "error" ? 6000 : 3000);
    return () => clearTimeout(t);
  }, [status]);

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Save failed (${res.status})`);
      }
      setStatus({ tone: "success", text: "Profile saved" });
      setDirty(false);
    } catch (err) {
      setStatus({ tone: "error", text: err instanceof Error ? err.message : "Save failed." });
    } finally {
      setSaving(false);
    }
  }

  // --- links ---
  function addLink() {
    update("links", [...profile.links, { label: "", url: "" }]);
  }
  function updateLink(i: number, patch: Partial<Link>) {
    update(
      "links",
      profile.links.map((l, idx) => (idx === i ? { ...l, ...patch } : l))
    );
  }
  function removeLink(i: number) {
    update("links", profile.links.filter((_, idx) => idx !== i));
  }

  // --- education ---
  function addEducation() {
    update("education", [
      ...profile.education,
      { id: newId(), school: "", degree: "", fieldOfStudy: "", startDate: "", endDate: "" },
    ]);
  }
  function updateEducation(i: number, patch: Partial<Education>) {
    update(
      "education",
      profile.education.map((e, idx) => (idx === i ? { ...e, ...patch } : e))
    );
  }
  function removeEducation(i: number) {
    update("education", profile.education.filter((_, idx) => idx !== i));
  }

  // --- experience ---
  function addExperience() {
    update("experience", [
      ...profile.experience,
      { id: newId(), company: "", title: "", startDate: "", current: false, bullets: [] },
    ]);
  }
  function updateExperience(i: number, patch: Partial<WorkExperience>) {
    update(
      "experience",
      profile.experience.map((e, idx) => (idx === i ? { ...e, ...patch } : e))
    );
  }
  function removeExperience(i: number) {
    update("experience", profile.experience.filter((_, idx) => idx !== i));
  }
  function updateExperienceBullet(expIdx: number, bulletIdx: number, value: string) {
    updateExperience(expIdx, {
      bullets: profile.experience[expIdx].bullets.map((b, idx) => (idx === bulletIdx ? value : b)),
    });
  }
  function addExperienceBullet(expIdx: number) {
    updateExperience(expIdx, { bullets: [...profile.experience[expIdx].bullets, ""] });
  }
  function removeExperienceBullet(expIdx: number, bulletIdx: number) {
    updateExperience(expIdx, {
      bullets: profile.experience[expIdx].bullets.filter((_, idx) => idx !== bulletIdx),
    });
  }

  // --- skills ---
  function addSkill() {
    update("skills", [...profile.skills, { name: "", category: "" }]);
  }
  function updateSkill(i: number, patch: Partial<Skill>) {
    update(
      "skills",
      profile.skills.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    );
  }
  function removeSkill(i: number) {
    update("skills", profile.skills.filter((_, idx) => idx !== i));
  }

  const completeness = computeCompleteness(profile);

  const percent = Math.round((completeness.filled / completeness.total) * 100);

  return (
    <div className="flex flex-col gap-6 pb-28">
      <Card aria-labelledby={fid("completeness")}>
        <div className="flex items-center gap-5">
          <div
            className="relative shrink-0 w-16 h-16 rounded-full"
            style={{
              background: `conic-gradient(var(--accent) ${percent * 3.6}deg, var(--surface-hover) 0deg)`,
            }}
            role="img"
            aria-label={`Profile ${percent}% complete`}
          >
            <div className="absolute inset-[6px] rounded-full bg-surface flex items-center justify-center text-sm font-semibold">
              {percent}%
            </div>
          </div>
          <div className="min-w-0">
            <h2 id={fid("completeness")} className="text-[15px] font-semibold tracking-tight">
              {completeness.missing.length === 0 ? "Profile complete" : "Profile strength"}
            </h2>
            <p className="text-sm text-muted mt-0.5">
              {completeness.missing.length === 0
                ? "Everything autofill and resume tailoring can draw on is here."
                : `${completeness.filled} of ${completeness.total} done. The more you fill in, the more forms Job Jet can finish for you.`}
            </p>
          </div>
        </div>
        {completeness.missing.length > 0 && (
          <ul className="flex flex-wrap gap-2 mt-5" aria-label="Missing from your profile">
            {completeness.missing.map((m) => (
              <li
                key={m.label}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  m.required ? "bg-danger-soft text-danger" : "bg-surface-hover text-muted"
                }`}
              >
                <CircleAlert className="w-3 h-3" aria-hidden />
                {m.label}
                {m.required && " (required)"}
              </li>
            ))}
          </ul>
        )}
        {completeness.missing.length === 0 && (
          <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-success">
            <CircleCheck className="w-4 h-4" aria-hidden /> Ready to autofill
          </p>
        )}
      </Card>

      <Card aria-labelledby={fid("basics")}>
        <CardHeader
          id={fid("basics")}
          icon={<UserRound className="w-4 h-4" aria-hidden />}
          title="Basics"
          description="Contact details most forms ask for first."
        />
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name" htmlFor={fid("fullName")} required className="sm:col-span-2">
            <Input
              id={fid("fullName")}
              autoComplete="name"
              required
              value={profile.fullName}
              onChange={(e) => update("fullName", e.target.value)}
            />
          </Field>
          <Field label="Email" htmlFor={fid("email")} required>
            <Input
              id={fid("email")}
              type="email"
              autoComplete="email"
              required
              value={profile.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>
          <Field label="Phone" htmlFor={fid("phone")}>
            <Input
              id={fid("phone")}
              type="tel"
              autoComplete="tel"
              value={profile.phone ?? ""}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Field>
          <Field label="Location" htmlFor={fid("location")} hint="City, region — e.g. Bengaluru, India" className="sm:col-span-2">
            <Input
              id={fid("location")}
              autoComplete="address-level2"
              aria-describedby={`${fid("location")}-hint`}
              value={profile.location ?? ""}
              onChange={(e) => update("location", e.target.value)}
            />
          </Field>
          <Field label="Summary" htmlFor={fid("summary")} className="sm:col-span-2">
            <Textarea
              id={fid("summary")}
              rows={3}
              placeholder="Two or three sentences about what you do best."
              value={profile.summary ?? ""}
              onChange={(e) => update("summary", e.target.value)}
            />
          </Field>
        </div>
      </Card>

      <Card aria-labelledby={fid("links")}>
        <CardHeader
          id={fid("links")}
          icon={<Link2 className="w-4 h-4" aria-hidden />}
          title="Links"
          description="LinkedIn, GitHub, portfolio — full https:// addresses."
          action={
            <button type="button" onClick={addLink} className={addButton}>
              <Plus className="w-4 h-4" aria-hidden /> Add link
            </button>
          }
        />
        <div className="flex flex-col gap-3">
          {profile.links.map((link, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1 grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-2">
                <Input
                  aria-label={`Link ${i + 1} label`}
                  placeholder="Label (e.g. LinkedIn)"
                  value={link.label}
                  onChange={(e) => updateLink(i, { label: e.target.value })}
                />
                <Input
                  aria-label={`Link ${i + 1} URL`}
                  type="url"
                  placeholder="https://…"
                  value={link.url}
                  onChange={(e) => updateLink(i, { url: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => removeLink(i)}
                className={`${iconButton} mt-0.5`}
                aria-label={`Remove link ${link.label || i + 1}`}
              >
                <X className="w-4 h-4" aria-hidden />
              </button>
            </div>
          ))}
          {profile.links.length === 0 && <p className="text-sm text-muted">No links added yet.</p>}
        </div>
      </Card>

      <Card aria-labelledby={fid("auth")}>
        <CardHeader
          id={fid("auth")}
          icon={<BadgeCheck className="w-4 h-4" aria-hidden />}
          title="Work authorization"
          description="Answered once, reused on every form that asks."
        />
        <div className="grid sm:grid-cols-2 gap-3">
          {(
            [
              ["authorizedToWork", "Authorized to work in my country of application"],
              ["requiresSponsorship", "Will require visa sponsorship"],
            ] as const
          ).map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-3 rounded-[var(--radius-md)] border border-border px-4 py-3 text-sm cursor-pointer hover:bg-surface-hover has-[:checked]:border-accent/40 has-[:checked]:bg-accent-soft/60 transition-colors"
            >
              <input
                type="checkbox"
                className="w-4 h-4 rounded accent-[var(--accent)]"
                checked={profile.workAuthorization?.[key] ?? false}
                onChange={(e) => update("workAuthorization", { ...profile.workAuthorization, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </Card>

      <Card aria-labelledby={fid("experience")}>
        <CardHeader
          id={fid("experience")}
          icon={<Briefcase className="w-4 h-4" aria-hidden />}
          title="Experience"
          description="Most recent first. Bullets are what tailoring rewords."
          action={
            <button type="button" onClick={addExperience} className={addButton}>
              <Plus className="w-4 h-4" aria-hidden /> Add role
            </button>
          }
        />
        <div className="flex flex-col gap-4">
          {profile.experience.map((exp, i) => (
            <fieldset key={exp.id} className={subCard}>
              <legend className="sr-only">{`Role ${i + 1}${exp.company ? ` at ${exp.company}` : ""}`}</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Company" htmlFor={fid(`exp-${i}-company`)}>
                  <Input
                    id={fid(`exp-${i}-company`)}
                    value={exp.company}
                    onChange={(e) => updateExperience(i, { company: e.target.value })}
                  />
                </Field>
                <Field label="Title" htmlFor={fid(`exp-${i}-title`)}>
                  <Input
                    id={fid(`exp-${i}-title`)}
                    value={exp.title}
                    onChange={(e) => updateExperience(i, { title: e.target.value })}
                  />
                </Field>
                <Field label="Start" htmlFor={fid(`exp-${i}-start`)}>
                  <Input
                    id={fid(`exp-${i}-start`)}
                    placeholder="YYYY-MM"
                    value={exp.startDate ?? ""}
                    onChange={(e) => updateExperience(i, { startDate: e.target.value })}
                  />
                </Field>
                <Field label="End" htmlFor={fid(`exp-${i}-end`)}>
                  <div className="flex items-center gap-3">
                    <Input
                      id={fid(`exp-${i}-end`)}
                      placeholder={exp.current ? "Present" : "YYYY-MM"}
                      disabled={exp.current}
                      value={exp.endDate ?? ""}
                      onChange={(e) => updateExperience(i, { endDate: e.target.value })}
                    />
                    <label className="flex items-center gap-2 text-sm whitespace-nowrap text-muted cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded accent-[var(--accent)]"
                        checked={exp.current}
                        onChange={(e) => updateExperience(i, { current: e.target.checked })}
                      />
                      Current
                    </label>
                  </div>
                </Field>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium">Highlights</span>
                {exp.bullets.map((bullet, bi) => (
                  <div key={bi} className="flex gap-2 items-center">
                    <Input
                      aria-label={`Role ${i + 1}, highlight ${bi + 1}`}
                      placeholder="Achievement or responsibility"
                      value={bullet}
                      onChange={(e) => updateExperienceBullet(i, bi, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeExperienceBullet(i, bi)}
                      className={iconButton}
                      aria-label={`Remove highlight ${bi + 1}`}
                    >
                      <X className="w-4 h-4" aria-hidden />
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-2">
                  <button type="button" onClick={() => addExperienceBullet(i)} className={`${addButton} -ml-3`}>
                    <Plus className="w-4 h-4" aria-hidden /> Add highlight
                  </button>
                  <button type="button" onClick={() => removeExperience(i)} className={removeButton}>
                    <X className="w-3.5 h-3.5" aria-hidden /> Remove role
                  </button>
                </div>
              </div>
            </fieldset>
          ))}
          {profile.experience.length === 0 && <p className="text-sm text-muted">No roles added yet.</p>}
        </div>
      </Card>

      <Card aria-labelledby={fid("education")}>
        <CardHeader
          id={fid("education")}
          icon={<GraduationCap className="w-4 h-4" aria-hidden />}
          title="Education"
          action={
            <button type="button" onClick={addEducation} className={addButton}>
              <Plus className="w-4 h-4" aria-hidden /> Add school
            </button>
          }
        />
        <div className="flex flex-col gap-4">
          {profile.education.map((edu, i) => (
            <fieldset key={edu.id} className={subCard}>
              <legend className="sr-only">{`School ${i + 1}`}</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="School" htmlFor={fid(`edu-${i}-school`)}>
                  <Input
                    id={fid(`edu-${i}-school`)}
                    value={edu.school}
                    onChange={(e) => updateEducation(i, { school: e.target.value })}
                  />
                </Field>
                <Field label="Degree" htmlFor={fid(`edu-${i}-degree`)}>
                  <Input
                    id={fid(`edu-${i}-degree`)}
                    value={edu.degree ?? ""}
                    onChange={(e) => updateEducation(i, { degree: e.target.value })}
                  />
                </Field>
                <Field label="Field of study" htmlFor={fid(`edu-${i}-field`)} className="sm:col-span-2">
                  <Input
                    id={fid(`edu-${i}-field`)}
                    value={edu.fieldOfStudy ?? ""}
                    onChange={(e) => updateEducation(i, { fieldOfStudy: e.target.value })}
                  />
                </Field>
              </div>
              <button type="button" onClick={() => removeEducation(i)} className={`${removeButton} self-end`}>
                <X className="w-3.5 h-3.5" aria-hidden /> Remove school
              </button>
            </fieldset>
          ))}
          {profile.education.length === 0 && <p className="text-sm text-muted">No schools added yet.</p>}
        </div>
      </Card>

      <Card aria-labelledby={fid("skills")}>
        <CardHeader
          id={fid("skills")}
          icon={<Sparkles className="w-4 h-4" aria-hidden />}
          title="Skills"
          description="Tailored resumes reorder these for each role — they never add new ones."
          action={
            <button type="button" onClick={addSkill} className={addButton}>
              <Plus className="w-4 h-4" aria-hidden /> Add skill
            </button>
          }
        />
        <ul className="flex flex-wrap gap-2">
          {profile.skills.map((skill, i) => (
            <li
              key={i}
              className="flex items-center gap-1 rounded-full border border-border-strong bg-surface pl-3 pr-1 py-1 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15"
            >
              <input
                aria-label={`Skill ${i + 1}`}
                className="text-sm outline-none focus-visible:outline-none bg-transparent"
                style={{ width: `${Math.max(6, skill.name.length + 1)}ch` }}
                placeholder="Skill"
                value={skill.name}
                onChange={(e) => updateSkill(i, { name: e.target.value })}
              />
              <button
                type="button"
                onClick={() => removeSkill(i)}
                className="w-6 h-6 inline-flex items-center justify-center rounded-full text-muted hover:text-danger hover:bg-danger-soft transition-colors"
                aria-label={`Remove skill ${skill.name || i + 1}`}
              >
                <X className="w-3.5 h-3.5" aria-hidden />
              </button>
            </li>
          ))}
          {profile.skills.length === 0 && <li className="text-sm text-muted">No skills added yet.</li>}
        </ul>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 sm:-mx-8 lg:-mx-12 px-4 sm:px-8 lg:px-12 py-3 bg-background/85 backdrop-blur-md border-t border-border flex items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {dirty ? "You have unsaved changes" : "All changes saved"}
        </p>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </div>

      {status && <Toast tone={status.tone}>{status.text}</Toast>}
    </div>
  );
}
