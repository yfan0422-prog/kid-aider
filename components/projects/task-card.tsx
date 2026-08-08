"use client";

interface Props {
  taskId: string;
  title: string;
  whatToDo: string;
  howHint: string;
  difficulty: number;
  status: string;
  onToggle: (taskId: string) => void;
}

export function TaskCard({ taskId, title, whatToDo, howHint, difficulty, status, onToggle }: Props) {
  const isDone = status === "done";
  const diffColor =
    difficulty === 1 ? "bg-accent-green/10 text-accent-green" :
    difficulty === 2 ? "bg-brand-soft text-[#B26A00]" :
    "bg-[#FF6B6B]/10 text-[#FF6B6B]";

  return (
    <div className={`flex items-start gap-3 p-3 rounded-btn border transition-all ${
      isDone ? "border-accent-green/30 bg-accent-green/5" : "border-border bg-white hover:shadow-sm"
    }`}>
      <button
        onClick={() => onToggle(taskId)}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
          isDone
            ? "bg-accent-green border-accent-green text-white"
            : "border-ink-tertiary/30 hover:border-primary"
        }`}
      >
        {isDone && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`font-medium text-body-sm ${isDone ? "line-through text-ink-tertiary" : "text-ink"}`}>
            {title}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${diffColor}`}>
            {"⭐".repeat(difficulty)}
          </span>
        </div>
        <p className="text-body-sm text-ink-tertiary">{whatToDo}</p>
        {howHint && !isDone && (
          <p className="text-caption text-primary mt-1">💡 {howHint}</p>
        )}
      </div>
    </div>
  );
}
