"use client";

import type { TopicCatalog } from "@/lib/utils/types";
import { useRouter } from "next/navigation";

export function TopicCard({ topic }: { topic: TopicCatalog }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/explore?topic=${topic.id}`)}
      className="bg-surface border border-border rounded-card p-4 text-left hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="text-3xl mb-2">{topic.cover_image || "📚"}</div>
      <h3 className="text-body font-bold text-ink mb-1">{topic.title}</h3>
      <p className="text-body-sm text-ink-tertiary line-clamp-2">{topic.summary}</p>
    </button>
  );
}
