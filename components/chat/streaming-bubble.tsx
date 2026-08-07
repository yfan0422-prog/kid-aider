"use client";

interface Props {
  content: string;
}

export function StreamingBubble({ content }: Props) {
  return (
    <div className="flex gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-white text-sm font-bold shrink-0 mt-1 animate-pulse">
        K
      </div>
      <div className="bubble-guide bg-bubble-guide border border-border rounded-tl-sm rounded-tr-bubble rounded-br-bubble rounded-bl-bubble px-5 py-4 text-body-lg shadow-sm max-w-[80%]">
        <p className="whitespace-pre-wrap">
          {content}
          <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom rounded-sm" />
        </p>
      </div>
    </div>
  );
}
