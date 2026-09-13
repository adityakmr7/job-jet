"use client";

import { useState } from "react";
import type { Profile, ResumeContent } from "@job-jet/shared";
import { ProfileEditor } from "./ProfileEditor";
import { ResumeUpload } from "./ResumeUpload";

type ProfileForm = Omit<Profile, "id" | "userId" | "updatedAt">;

type ResumeSummary = {
  id: string;
  fileName: string;
  createdAt: string;
  content: ResumeContent;
};

export function DashboardClient({
  initialProfile,
  initialResumes,
  defaultEmail,
  defaultName,
}: {
  initialProfile: ProfileForm | null;
  initialResumes: ResumeSummary[];
  defaultEmail: string;
  defaultName: string;
}) {
  const [profileSeed, setProfileSeed] = useState(initialProfile);
  // Bump to force ProfileEditor to remount with a fresh initial value —
  // simpler and safer than converting it to a fully controlled component.
  const [seedKey, setSeedKey] = useState(0);
  const [prefillNotice, setPrefillNotice] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <ResumeUpload
        initialResumes={initialResumes}
        onParsed={(content) => {
          setProfileSeed(content);
          setSeedKey((k) => k + 1);
          setPrefillNotice(true);
        }}
      />

      {prefillNotice && (
        <p className="text-sm bg-violet-50 text-violet-800 rounded-lg px-3 py-2 max-w-2xl">
          Your profile below was prefilled from that resume — review it and hit Save profile.
        </p>
      )}

      <ProfileEditor
        key={seedKey}
        initialProfile={profileSeed}
        defaultEmail={defaultEmail}
        defaultName={defaultName}
      />
    </div>
  );
}
