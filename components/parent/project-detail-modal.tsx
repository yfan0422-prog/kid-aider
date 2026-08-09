"use client";

import { useEffect, useState } from "react";

interface DetailData {
  project: { id: string; title: string; status: string; created_at: string };
  messages: Array<{ role: string; content: string; created_at: string }>;
  structure: Array<{
    id: string; name: string; type: string;
    milestones: Array<{
      id: string; title: string; status: string;
      tasks: Array<{ id: string; title: string; status: string; difficulty: number }>;
    }>;
  }>;
}

interface Props {
  projectId: string;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  child: "👦 孩子",
  guide: "🤖 引导",
  system: "⚙️ 系统",
};

export function ProjectDetailModal({ projectId, onClose }: Props) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/parent/projects/${projectId}`)
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-card w-full max-w-2xl max-h-[85vh] overflow-y-auto m-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !data ? (
          <p className="text-ink-tertiary text-center py-8">加载失败</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-body-lg font-bold">{data.project.title}</h2>
              <button onClick={onClose} className="text-ink-tertiary hover:text-ink text-xl">×</button>
            </div>

            {/* Project structure */}
            <section>
              <h3 className="text-body font-bold mb-2">📋 项目结构</h3>
              {data.structure.map(track => (
                <div key={track.id} className="mb-3">
                  <p className="text-body-sm font-semibold text-ink mb-1">
                    {track.type === "software" ? "💻" : "🔧"} {track.name}
                  </p>
                  {track.milestones.map(m => (
                    <div key={m.id} className="ml-4 mb-1">
                      <p className="text-body-sm text-ink-tertiary mb-0.5">
                        {m.status === "done" ? "✅" : "○"} {m.title}
                      </p>
                      {m.tasks.map(t => (
                        <p key={t.id} className="ml-4 text-body-sm text-ink-tertiary">
                          {t.status === "done" ? "✓" : "·"} {t.title} (难度 {t.difficulty})
                        </p>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </section>

            {/* Conversation */}
            <section>
              <h3 className="text-body font-bold mb-2">💬 对话记录</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {data.messages.slice(-30).map((m, i) => (
                  <div key={i} className="text-body-sm">
                    <span className="text-ink-tertiary">{ROLE_LABELS[m.role] || m.role}: </span>
                    <span className="text-ink">{m.content.slice(0, 200)}{m.content.length > 200 ? "…" : ""}</span>
                  </div>
                ))}
                {data.messages.length === 0 && (
                  <p className="text-ink-tertiary text-body-sm">暂无对话</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
