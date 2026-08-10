"use client";

import { useLocale } from "@/lib/i18n/context";
import type { CheckIn } from "@/lib/utils/types";

interface Props {
  checkIns: CheckIn[];
}

export function CalendarHeatmap({ checkIns }: Props) {
  const { t } = useLocale();
  const dates = new Set(checkIns.map(c => c.date));

  // Generate last 4 weeks grid
  const weeks: Array<Array<{ date: string; day: number; checked: boolean }>> = [];
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 27); // 4 weeks back

  let currentWeek: Array<{ date: string; day: number; checked: boolean }> = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    currentWeek.push({ date: dateStr, day: d.getDay(), checked: dates.has(dateStr) });
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const dayLabels = [
    t("project.calendar.day.sun"),
    t("project.calendar.day.mon"),
    t("project.calendar.day.tue"),
    t("project.calendar.day.wed"),
    t("project.calendar.day.thu"),
    t("project.calendar.day.fri"),
    t("project.calendar.day.sat"),
  ];

  return (
    <div className="flex gap-1">
      {/* Day labels */}
      <div className="flex flex-col gap-1 mr-1">
        {dayLabels.map((l, i) => (
          <span key={i} className="text-[10px] text-ink-tertiary leading-4 w-5 text-right">{l}</span>
        ))}
      </div>
      {/* Grid */}
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((cell, ci) => (
            <div
              key={ci}
              title={`${cell.date}${cell.checked ? " ✓" : ""}`}
              className={`w-4 h-4 rounded-sm ${
                cell.checked ? "bg-primary" : "bg-surface-raised"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
