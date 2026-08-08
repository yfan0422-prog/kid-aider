"use client";

import { useEffect, useState } from "react";

interface Props {
  projectId: string;
  ageGroup?: string;
}

export function ProjectHero({ projectId, ageGroup }: Props) {
  const [resumeText, setResumeText] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/resume?ageGroup=${ageGroup || "10-12"}`)
      .then(r => r.json())
      .then(d => setResumeText(d.resume_text || ""))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [projectId, ageGroup]);

  if (loading) return null;

  return (
    <div className="bg-bubble-guide border border-border rounded-card px-5 py-4 mb-6">
      <div className="flex gap-3">
        <span className="text-lg">💬</span>
        <p className="text-body whitespace-pre-wrap">{resumeText}</p>
      </div>
    </div>
  );
}
