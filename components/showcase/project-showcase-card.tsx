"use client";

interface ShowcaseCardProps {
  project: {
    id: string;
    title: string;
    days: number;
    tasksDone: number;
    badges: Array<{ icon: string; label: string }>;
    isFeatured: boolean;
  };
  onToggleFeatured: (id: string) => void;
}

export function ProjectShowcaseCard({ project, onToggleFeatured }: ShowcaseCardProps) {
  return (
    <div
      className={`relative bg-surface border rounded-card p-5 transition-all ${
        project.isFeatured
          ? "border-primary ring-1 ring-primary/30 shadow-md"
          : "border-border hover:shadow-sm"
      }`}
    >
      {project.isFeatured && (
        <span className="absolute top-2 right-2 text-yellow-500 text-sm">★ 精选</span>
      )}

      <h3 className="text-body font-bold text-ink mb-3">{project.title}</h3>

      <div className="flex items-center gap-4 text-body-sm text-ink-tertiary mb-3">
        <span>📅 {project.days} 天</span>
        <span>✅ {project.tasksDone} 任务</span>
      </div>

      {project.badges.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {project.badges.map((b, i) => (
            <span key={i} title={b.label} className="text-lg">
              {b.icon}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={() => onToggleFeatured(project.id)}
        className={`text-body-xs border rounded-btn px-3 py-1 transition-colors ${
          project.isFeatured
            ? "border-primary text-primary bg-primary/5"
            : "border-border text-ink-tertiary hover:text-ink"
        }`}
      >
        {project.isFeatured ? "取消精选" : "置为精选"}
      </button>
    </div>
  );
}
