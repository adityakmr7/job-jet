"use client";

import { useState } from "react";
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
    <div className="max-w-2xl flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase opacity-60">Basics</h2>
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Full name"
          value={profile.fullName}
          onChange={(e) => update("fullName", e.target.value)}
        />
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Email"
          value={profile.email}
          onChange={(e) => update("email", e.target.value)}
        />
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Phone"
          value={profile.phone ?? ""}
          onChange={(e) => update("phone", e.target.value)}
        />
        <input
          className="border rounded-lg px-3 py-2"
          placeholder="Location"
          value={profile.location ?? ""}
          onChange={(e) => update("location", e.target.value)}
        />
        <textarea
          className="border rounded-lg px-3 py-2"
          placeholder="Summary"
          rows={3}
          value={profile.summary ?? ""}
          onChange={(e) => update("summary", e.target.value)}
        />
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase opacity-60">Links</h2>
          <button type="button" onClick={addLink} className="text-sm text-violet-700 font-medium">
            + Add link
          </button>
        </div>
        {profile.links.map((link, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="border rounded-lg px-3 py-2 flex-1"
              placeholder="Label (e.g. LinkedIn)"
              value={link.label}
              onChange={(e) => updateLink(i, { label: e.target.value })}
            />
            <input
              className="border rounded-lg px-3 py-2 flex-[2]"
              placeholder="https://..."
              value={link.url}
              onChange={(e) => updateLink(i, { url: e.target.value })}
            />
            <button type="button" onClick={() => removeLink(i)} className="text-sm opacity-50">
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase opacity-60">Work authorization</h2>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.workAuthorization?.authorizedToWork ?? false}
            onChange={(e) =>
              update("workAuthorization", { ...profile.workAuthorization, authorizedToWork: e.target.checked })
            }
          />
          Authorized to work in my country of application
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={profile.workAuthorization?.requiresSponsorship ?? false}
            onChange={(e) =>
              update("workAuthorization", { ...profile.workAuthorization, requiresSponsorship: e.target.checked })
            }
          />
          Will require visa sponsorship
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase opacity-60">Experience</h2>
          <button type="button" onClick={addExperience} className="text-sm text-violet-700 font-medium">
            + Add role
          </button>
        </div>
        {profile.experience.map((exp, i) => (
          <div key={exp.id} className="border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                className="border rounded-lg px-3 py-2 flex-1"
                placeholder="Company"
                value={exp.company}
                onChange={(e) => updateExperience(i, { company: e.target.value })}
              />
              <input
                className="border rounded-lg px-3 py-2 flex-1"
                placeholder="Title"
                value={exp.title}
                onChange={(e) => updateExperience(i, { title: e.target.value })}
              />
            </div>
            <div className="flex gap-2 items-center">
              <input
                className="border rounded-lg px-3 py-2 flex-1"
                placeholder="Start (YYYY-MM)"
                value={exp.startDate ?? ""}
                onChange={(e) => updateExperience(i, { startDate: e.target.value })}
              />
              <input
                className="border rounded-lg px-3 py-2 flex-1"
                placeholder="End (YYYY-MM)"
                disabled={exp.current}
                value={exp.endDate ?? ""}
                onChange={(e) => updateExperience(i, { endDate: e.target.value })}
              />
              <label className="flex items-center gap-1 text-sm whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={exp.current}
                  onChange={(e) => updateExperience(i, { current: e.target.checked })}
                />
                Current
              </label>
            </div>
            <div className="flex flex-col gap-1">
              {exp.bullets.map((bullet, bi) => (
                <div key={bi} className="flex gap-2">
                  <input
                    className="border rounded-lg px-3 py-2 flex-1 text-sm"
                    placeholder="Achievement / responsibility"
                    value={bullet}
                    onChange={(e) => updateExperienceBullet(i, bi, e.target.value)}
                  />
                  <button type="button" onClick={() => removeExperienceBullet(i, bi)} className="text-xs opacity-50">
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addExperienceBullet(i)} className="text-xs text-violet-700 text-left">
                + Add bullet
              </button>
            </div>
            <button type="button" onClick={() => removeExperience(i)} className="text-xs opacity-50 self-end">
              Remove role
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase opacity-60">Education</h2>
          <button type="button" onClick={addEducation} className="text-sm text-violet-700 font-medium">
            + Add school
          </button>
        </div>
        {profile.education.map((edu, i) => (
          <div key={edu.id} className="border rounded-lg p-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                className="border rounded-lg px-3 py-2 flex-1"
                placeholder="School"
                value={edu.school}
                onChange={(e) => updateEducation(i, { school: e.target.value })}
              />
              <input
                className="border rounded-lg px-3 py-2 flex-1"
                placeholder="Degree"
                value={edu.degree ?? ""}
                onChange={(e) => updateEducation(i, { degree: e.target.value })}
              />
            </div>
            <input
              className="border rounded-lg px-3 py-2"
              placeholder="Field of study"
              value={edu.fieldOfStudy ?? ""}
              onChange={(e) => updateEducation(i, { fieldOfStudy: e.target.value })}
            />
            <button type="button" onClick={() => removeEducation(i)} className="text-xs opacity-50 self-end">
              Remove
            </button>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase opacity-60">Skills</h2>
          <button type="button" onClick={addSkill} className="text-sm text-violet-700 font-medium">
            + Add skill
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.skills.map((skill, i) => (
            <div key={i} className="flex items-center gap-1 border rounded-full pl-3 pr-1 py-1">
              <input
                className="text-sm outline-none w-28"
                placeholder="Skill"
                value={skill.name}
                onChange={(e) => updateSkill(i, { name: e.target.value })}
              />
              <button type="button" onClick={() => removeSkill(i)} className="text-xs opacity-50 px-1">
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 sticky bottom-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-violet-700 text-white px-6 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
        {status && <span className="text-sm opacity-70">{status}</span>}
      </div>
    </div>
  );
}
