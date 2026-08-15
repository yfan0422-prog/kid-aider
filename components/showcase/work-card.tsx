"use client";

import { useLocale } from "@/lib/i18n/context";
import type { Work } from "@/lib/utils/types";

export function WorkCard({ work, childId, onClick }: {
  work: Work;
  childId: string;
  onClick: () => void;
}) {
  const { t } = useLocale();
  const src = `/api/works/${work.id}/file?child_id=${encodeURIComponent(childId)}`;
  const label = work.title
    || t(work.type === "video" ? "showcase.works.type.video" : "showcase.works.type.photo");

  return (
    <button
      onClick={onClick}
      className="group text-left bg-surface border border-border rounded-card p-2 hover:shadow-sm transition-all"
    >
      {work.type === "video" ? (
        <video src={src} preload="metadata" muted className="w-full aspect-square object-cover rounded-lg" />
      ) : (
        <img src={src} alt={work.title} className="w-full aspect-square object-cover rounded-lg" />
      )}
      <div className="px-2 py-2">
        <p className="text-body-sm font-semibold text-ink truncate">{label}</p>
      </div>
    </button>
  );
}
