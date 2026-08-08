"use client";

import { TaskCard } from "./task-card";

interface TrackData {
  id: string;
  name: string;
  type: string;
  milestones: Array<{
    id: string;
    title: string;
    status: string;
    tasks: Array<{
      id: string;
      title: string;
      what_to_do: string;
      how_hint: string;
      difficulty: number;
      status: string;
    }>;
  }>;
}

interface Props {
  track: TrackData;
  onTaskToggle: (taskId: string) => void;
}

export function TrackColumn({ track, onTaskToggle }: Props) {
  const totalTasks = track.milestones.flatMap(m => m.tasks).length;
  const doneTasks = track.milestones.flatMap(m => m.tasks).filter(t => t.status === "done").length;
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const trackIcon = track.type === "software" ? "🖥" : "🔧";

  return (
    <div className="bg-surface border border-border rounded-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-body">
            {trackIcon} {track.name}
          </h3>
          <span className="text-body-sm text-ink-tertiary">{doneTasks}/{totalTasks}</span>
        </div>
        {/* Progress bar */}
        <div className="w-full h-1.5 bg-surface-raised rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Milestones */}
      <div className="p-4 space-y-4">
        {track.milestones.map(m => (
          <div key={m.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                m.status === "done"
                  ? "bg-accent-green/10 text-accent-green"
                  : "bg-surface-raised text-ink-tertiary"
              }`}>
                {m.status === "done" ? "✅" : "○"} {m.title}
              </span>
            </div>
            <div className="space-y-2 pl-2">
              {m.tasks.map(t => (
                <TaskCard
                  key={t.id}
                  taskId={t.id}
                  title={t.title}
                  whatToDo={t.what_to_do}
                  howHint={t.how_hint}
                  difficulty={t.difficulty}
                  status={t.status}
                  onToggle={onTaskToggle}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
