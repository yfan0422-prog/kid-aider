"use client";

import { useState } from "react";

interface Props {
  projectId: string;
  onDone: () => void;
  onClose: () => void;
}

export function CheckInDialog({ projectId, onDone, onClose }: Props) {
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!summary.trim()) return;
    setSubmitting(true);
    await fetch(`/api/projects/${projectId}/check-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ summary: summary.trim() }),
    });
    setSubmitting(false);
    onDone();
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-card p-6 shadow-lg max-w-md w-full mx-4">
        <h3 className="text-body-lg font-bold mb-4">📝 今日总结</h3>
        <p className="text-body-sm text-ink-tertiary mb-3">
          今天在这个项目上做了什么？
        </p>
        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          className="w-full bg-surface-raised border border-border rounded-btn px-4 py-3 text-body resize-none min-h-[100px] focus:border-primary focus:outline-none"
          placeholder="比如：写完了水泵控制代码，测试了一下可以正常开关……"
          autoFocus
        />
        <div className="flex gap-3 mt-4 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-body-sm text-ink-tertiary hover:text-ink transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!summary.trim() || submitting}
            className="bg-primary text-white border-none rounded-btn px-5 py-2 font-semibold text-body-sm disabled:opacity-40"
          >
            {submitting ? "保存中……" : "完成打卡"}
          </button>
        </div>
      </div>
    </div>
  );
}
