"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Education, Link, Profile, Skill, WorkExperience } from "@job-jet/shared";

type ProfileForm = Omit<Profile, "id" | "userId" | "updatedAt">;

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

const input =
  "w-full rounded-lg border border-border bg-background px-3.5 py-2.5 text-sm transition-colors " +
  "placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent " +
  "disabled:opacity-50 disabled:cursor-not-allowed";
const card = "rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-card)]";
const sectionLabel = "text-xs font-semibold uppercase tracking-wide text-muted";
const addButton =
  "inline-flex items-center gap-1 text-sm font-medium text-accent hover:text-accent-hover transition-colors";
const removeButton = "inline-flex items-center gap-1 text-xs text-muted hover:text-red-500 transition-colors";

export function ProfileEditor({
  initialProfile,
  defaultEmail,
  defaultName,
}: {
  initialProfile: ProfileForm | null;
  defaultEmail: string;
  defaultName: string;
}) {
  const [profile, setProfile] = useState<ProfileForm>(
    initialProfile ?? emptyProfile({ fullName: defaultName, email: defaultEmail })
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setStatus("");
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
      setStatus("Saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed.");
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

  return (
    <div className="flex flex-col gap-6 pb-24">
      <section className={card}>
        <h2 className={`${sectionLabel} mb-4`}>Basics</h2>
        <div className="flex flex-col gap-3">
          <input
            className={input}
            placeholder="Full name"
            value={profile.fullName}
            onChange={(e) => update("fullName", e.target.value)}
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              className={input}
              placeholder="Email"
              value={profile.email}
              onChange={(e) => update("email", e.target.value)}
            />
            <input
              className={input}
              placeholder="Phone"
              value={profile.phone ?? ""}
              onChange={(e) => update("phone", e.target.value)}
            />
          </div>
          <input
            className={input}
            placeholder="Location"
            value={profile.location ?? ""}
            onChange={(e) => update("location", e.target.value)}
          />
          <textarea
            className={input}
            placeholder="Summary"
            rows={3}
            value={profile.summary ?? ""}
            onChange={(e) => update("summary", e.target.value)}
          />
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionLabel}>Links</h2>
          <button type="button" onClick={addLink} className={addButton}>
            <Plus className="w-3.5 h-3.5" /> Add link
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {profile.links.map((link, i) => (
            <div key={i} className="flex gap-2">
              <input
                className={`${input} flex-1`}
                placeholder="Label (e.g. LinkedIn)"
                value={link.label}
                onChange={(e) => updateLink(i, { label: e.target.value })}
              />
              <input
                className={`${input} flex-[2]`}
                placeholder="https://..."
                value={link.url}
                onChange={(e) => updateLink(i, { url: e.target.value })}
              />
              <button type="button" onClick={() => removeLink(i)} className="text-muted hover:text-red-500 px-1 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          {profile.links.length === 0 && <p className="text-sm text-muted">No links added yet.</p>}
        </div>
      </section>

      <section className={card}>
        <h2 className={`${sectionLabel} mb-4`}>Work authorization</h2>
        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-border accent-accent"
              checked={profile.workAuthorization?.authorizedToWork ?? false}
              onChange={(e) =>
                update("workAuthorization", { ...profile.workAuthorization, authorizedToWork: e.target.checked })
              }
            />
            Authorized to work in my country of application
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-border accent-accent"
              checked={profile.workAuthorization?.requiresSponsorship ?? false}
              onChange={(e) =>
                update("workAuthorization", { ...profile.workAuthorization, requiresSponsorship: e.target.checked })
              }
            />
            Will require visa sponsorship
          </label>
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionLabel}>Experience</h2>
          <button type="button" onClick={addExperience} className={addButton}>
            <Plus className="w-3.5 h-3.5" /> Add role
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {profile.experience.map((exp, i) => (
            <div key={exp.id} className="rounded-xl border border-border bg-background p-4 flex flex-col gap-2.5">
              <div className="flex gap-2">
                <input
                  className={`${input} flex-1`}
                  placeholder="Company"
                  value={exp.company}
                  onChange={(e) => updateExperience(i, { company: e.target.value })}
                />
                <input
                  className={`${input} flex-1`}
                  placeholder="Title"
                  value={exp.title}
                  onChange={(e) => updateExperience(i, { title: e.target.value })}
                />
              </div>
              <div className="flex gap-2 items-center">
                <input
                  className={`${input} flex-1`}
                  placeholder="Start (YYYY-MM)"
                  value={exp.startDate ?? ""}
                  onChange={(e) => updateExperience(i, { startDate: e.target.value })}
                />
                <input
                  className={`${input} flex-1`}
                  placeholder="End (YYYY-MM)"
                  disabled={exp.current}
                  value={exp.endDate ?? ""}
                  onChange={(e) => updateExperience(i, { endDate: e.target.value })}
                />
                <label className="flex items-center gap-1.5 text-sm whitespace-nowrap text-muted">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-border accent-accent"
                    checked={exp.current}
                    onChange={(e) => updateExperience(i, { current: e.target.checked })}
                  />
                  Current
                </label>
              </div>
              <div className="flex flex-col gap-1.5 mt-1">
                {exp.bullets.map((bullet, bi) => (
                  <div key={bi} className="flex gap-2">
                    <input
                      className={`${input} flex-1 text-sm`}
                      placeholder="Achievement / responsibility"
                      value={bullet}
                      onChange={(e) => updateExperienceBullet(i, bi, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeExperienceBullet(i, bi)}
                      className="text-muted hover:text-red-500 px-1 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => addExperienceBullet(i)} className={`${addButton} text-xs`}>
                  <Plus className="w-3 h-3" /> Add bullet
                </button>
              </div>
              <button type="button" onClick={() => removeExperience(i)} className={`${removeButton} self-end mt-1`}>
                <X className="w-3 h-3" /> Remove role
              </button>
            </div>
          ))}
          {profile.experience.length === 0 && <p className="text-sm text-muted">No roles added yet.</p>}
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionLabel}>Education</h2>
          <button type="button" onClick={addEducation} className={addButton}>
            <Plus className="w-3.5 h-3.5" /> Add school
          </button>
        </div>
        <div className="flex flex-col gap-4">
          {profile.education.map((edu, i) => (
            <div key={edu.id} className="rounded-xl border border-border bg-background p-4 flex flex-col gap-2.5">
              <div className="flex gap-2">
                <input
                  className={`${input} flex-1`}
                  placeholder="School"
                  value={edu.school}
                  onChange={(e) => updateEducation(i, { school: e.target.value })}
                />
                <input
                  className={`${input} flex-1`}
                  placeholder="Degree"
                  value={edu.degree ?? ""}
                  onChange={(e) => updateEducation(i, { degree: e.target.value })}
                />
              </div>
              <input
                className={input}
                placeholder="Field of study"
                value={edu.fieldOfStudy ?? ""}
                onChange={(e) => updateEducation(i, { fieldOfStudy: e.target.value })}
              />
              <button type="button" onClick={() => removeEducation(i)} className={`${removeButton} self-end`}>
                <X className="w-3 h-3" /> Remove
              </button>
            </div>
          ))}
          {profile.education.length === 0 && <p className="text-sm text-muted">No schools added yet.</p>}
        </div>
      </section>

      <section className={card}>
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionLabel}>Skills</h2>
          <button type="button" onClick={addSkill} className={addButton}>
            <Plus className="w-3.5 h-3.5" /> Add skill
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.skills.map((skill, i) => (
            <div
              key={i}
              className="flex items-center gap-1 rounded-full border border-border bg-background pl-3 pr-1.5 py-1"
            >
              <input
                className="text-sm outline-none w-28 bg-transparent"
                placeholder="Skill"
                value={skill.name}
                onChange={(e) => updateSkill(i, { name: e.target.value })}
              />
              <button type="button" onClick={() => removeSkill(i)} className="text-muted hover:text-red-500 p-0.5 transition-colors">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {profile.skills.length === 0 && <p className="text-sm text-muted">No skills added yet.</p>}
        </div>
      </section>

      <div className="sticky bottom-0 -mx-6 sm:-mx-10 px-6 sm:px-10 py-4 bg-background/85 backdrop-blur-md border-t border-border flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-accent text-accent-foreground px-6 py-2.5 text-sm font-semibold shadow-[var(--shadow-card)] hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none transition-colors"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        {status && <span className="text-sm text-muted">{status}</span>}
      </div>
    </div>
  );
}
