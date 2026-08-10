"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useChild } from "@/components/ui/child-provider";
import { useRouter } from "next/navigation";

export function ChildSwitcher() {
  const { childId, setChildId, childAccounts } = useChild();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const currentChild = childAccounts.find((c) => c.id === childId);

  // 点击外部关闭
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!currentChild || childAccounts.length <= 1) return null;

  const handleSwitch = (id: string) => {
    setChildId(id);
    setOpen(false);
    router.push(`/?child_id=${id}`);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-body-sm text-ink-secondary hover:text-primary transition-colors px-2 py-1 rounded-btn hover:bg-surface-raised"
      >
        <span>{currentChild.avatar_emoji}</span>
        <span className="font-medium">{currentChild.display_name}</span>
        <span className="text-caption">▾</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-card shadow-lg min-w-[160px] z-50 py-1">
          {childAccounts.map((child) => (
            <button
              key={child.id}
              onClick={() => handleSwitch(child.id)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-body-sm hover:bg-surface-raised transition-colors ${
                child.id === childId
                  ? "bg-surface-raised text-primary font-semibold"
                  : "text-ink-secondary"
              }`}
            >
              <span>{child.avatar_emoji}</span>
              <span>{child.display_name}</span>
              {child.id === childId && <span className="ml-auto text-xs">✓</span>}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <Link
              href="/settings"
              className="block px-3 py-2 text-caption text-ink-tertiary hover:text-primary hover:bg-surface-raised transition-colors"
            >
              ＋ 管理账号
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
