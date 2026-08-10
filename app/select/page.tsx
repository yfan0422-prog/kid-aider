"use client";

import { useChild } from "@/components/ui/child-provider";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/context";

/**
 * 孩子选择页 — 展示所有孩子档案，点击进入主界面。
 */
export default function SelectPage() {
  const { childAccounts, setChildId } = useChild();
  const { t } = useLocale();
  const router = useRouter();

  const handleSelect = (id: string) => {
    setChildId(id);
    router.push(`/?child_id=${id}`);
  };

  const handleCreate = () => {
    router.push("/settings");
  };

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold text-ink mb-2">🌟 Kid-Aider</h1>
      <p className="text-ink-tertiary mb-8">{t("select.title")}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-md w-full">
        {childAccounts.map((child) => (
          <button
            key={child.id}
            onClick={() => handleSelect(child.id)}
            className="flex flex-col items-center gap-2 p-4 bg-surface rounded-2xl border border-border hover:border-primary hover:shadow-card transition-all active:scale-95"
          >
            <span className="text-4xl">{child.avatar_emoji}</span>
            <span className="text-body-sm font-semibold text-ink">{child.display_name}</span>
            <span className="text-caption text-ink-tertiary">{child.age_group}</span>
          </button>
        ))}

        <button
          onClick={handleCreate}
          className="flex flex-col items-center gap-2 p-4 bg-surface-raised rounded-2xl border-2 border-dashed border-border hover:border-primary transition-all active:scale-95"
        >
          <span className="text-4xl opacity-40">＋</span>
          <span className="text-caption text-ink-tertiary">{t("select.add")}</span>
        </button>
      </div>
    </div>
  );
}
