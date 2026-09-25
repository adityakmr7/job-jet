"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/feedback";
import type { Profile, ResumeContent } from "@job-jet/shared";
import { ProfileEditor } from "./ProfileEditor";
import { ResumeUpload } from "./ResumeUpload";

type ProfileForm = Omit<Profile, "id" | "userId" | "updatedAt">;

type ResumeSummary = {
  id: string;
  fileName: string;
  createdAt: string;
  kind: "uploaded_original" | "ai_tailored";
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
    <div className="flex flex-col gap-6">
      <ResumeUpload
        initialResumes={initialResumes}
        onParsed={(content) => {
          setProfileSeed(content);
          setSeedKey((k) => k + 1);
          setPrefillNotice(true);
        }}
      />

      {prefillNotice && (
        <Alert tone="info">Your profile below was prefilled from that resume. Review it, then hit Save profile.</Alert>
      )}

      <ProfileEditor
        key={seedKey}
        initialProfile={profileSeed}
        defaultEmail={defaultEmail}
        defaultName={defaultName}
        startDirty={prefillNotice}
      />
    </div>
  );
}
