"use client";

import { AudioPlayer } from "./audio-player";

interface BadgeNotification {
  name: string;
  icon: string;
}

interface Props {
  content: string;
  strategyId?: string | null;
  messageId?: string;
  badgeNotifications?: BadgeNotification[];
}

export function BubbleGuide({ content, strategyId, messageId, badgeNotifications }: Props) {
  return (
    <div className="flex gap-3 mb-4">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center text-white text-sm font-bold shrink-0 mt-1">
        K
      </div>
      {/* Bubble */}
      <div className="bubble-guide bg-bubble-guide border border-border rounded-tl-sm rounded-tr-bubble rounded-br-bubble rounded-bl-bubble px-5 py-4 text-body-lg shadow-sm max-w-[80%]">
        <p className="whitespace-pre-wrap">{content}</p>
        <AudioPlayer messageId={messageId || ""} text={content} />
        {strategyId && (
          <span className="inline-block mt-2 text-xs text-ink-tertiary bg-surface-raised px-2 py-0.5 rounded-full">
            {strategyId}
          </span>
        )}
        {badgeNotifications && badgeNotifications.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border space-y-1">
            <p className="text-body-sm font-bold text-accent-yellow">🎉 新徽章解锁！</p>
            {badgeNotifications.map((b, i) => (
              <div key={i} className="flex items-center gap-2 text-body-sm">
                <span className="text-xl">{b.icon}</span>
                <span className="text-ink-secondary">{b.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
