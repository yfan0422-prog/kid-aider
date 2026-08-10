"use client";

import { useState } from "react";
import { useChild } from "@/components/ui/child-provider";

const AVATARS = ["🧒", "👧", "🦸", "🧑‍🎨", "👩‍🔬", "🧑‍💻", "🌟", "🚀"];
const AGE_GROUPS = ["6-9", "10-12", "13-15"];
const LANGUAGES = [
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-HK", label: "繁體中文" },
  { code: "en", label: "English" },
];

interface EditModalProps {
  account?: { id: string; display_name: string; avatar_emoji: string; age_group: string; language: string } | null;
  onClose: () => void;
  onSave: (data: Record<string, string>) => Promise<void>;
}

function EditModal({ account, onClose, onSave }: EditModalProps) {
  const [name, setName] = useState(account?.display_name || "");
  const [avatar, setAvatar] = useState(account?.avatar_emoji || "🧒");
  const [age, setAge] = useState(account?.age_group || "10-12");
  const [lang, setLang] = useState(account?.language || "zh-CN");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ display_name: name, avatar_emoji: avatar, age_group: age, language: lang });
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-card p-6 max-w-sm w-full mx-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-body-lg font-bold text-ink mb-4">{account ? "编辑档案" : "创建新档案"}</h3>

        {/* 名字 */}
        <label className="text-caption text-ink-tertiary mb-1 block">名字</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-surface-raised border border-border rounded-btn px-3 py-2 text-body-sm mb-4 focus:border-primary focus:outline-none"
          maxLength={20}
        />

        {/* 头像 */}
        <label className="text-caption text-ink-tertiary mb-1 block">头像</label>
        <div className="flex gap-2 flex-wrap mb-4">
          {AVATARS.map((a) => (
            <button
              key={a}
              onClick={() => setAvatar(a)}
              className={`text-2xl p-2 rounded-xl border-2 transition-all ${
                avatar === a ? "border-primary bg-bubble-child" : "border-transparent hover:border-border"
              }`}
            >
              {a}
            </button>
          ))}
        </div>

        {/* 年龄段 */}
        <label className="text-caption text-ink-tertiary mb-1 block">年龄段</label>
        <div className="flex gap-2 mb-4">
          {AGE_GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setAge(g)}
              className={`px-3 py-1.5 rounded-btn text-body-sm transition-all ${
                age === g ? "bg-primary text-white" : "bg-surface-raised text-ink-secondary hover:bg-surface"
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* 语言 */}
        <label className="text-caption text-ink-tertiary mb-1 block">语言偏好</label>
        <div className="flex gap-2 mb-6">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`px-3 py-1.5 rounded-btn text-body-sm transition-all ${
                lang === l.code ? "bg-primary text-white" : "bg-surface-raised text-ink-secondary hover:bg-surface"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 text-body-sm text-ink-tertiary hover:text-ink px-4 py-2 rounded-btn border border-border">
            取消
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="flex-1 bg-primary text-white rounded-btn px-4 py-2 text-body-sm font-semibold disabled:opacity-40">
            {saving ? "..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AccountManager() {
  const { childAccounts, refreshAccounts, childId } = useChild();
  const [editing, setEditing] = useState<typeof childAccounts[0] | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const handleEdit = async (data: Record<string, string>) => {
    if (!editing) return;
    const res = await fetch(`/api/user/accounts?id=${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "unknown");
      return;
    }
    await refreshAccounts();
  };

  const handleCreate = async (data: Record<string, string>) => {
    const res = await fetch("/api/user/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "unknown");
      return;
    }
    await refreshAccounts();
  };

  const handleDelete = async (id: string) => {
    if (childAccounts.length <= 1) {
      setError("至少需要保留一个孩子账号");
      return;
    }
    if (!confirm("确认删除该孩子及所有关联数据？此操作不可撤销。")) return;

    const res = await fetch(`/api/user/accounts?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "unknown");
      return;
    }
    await refreshAccounts();
  };

  return (
    <div className="bg-surface border border-border rounded-card p-6">
      <h2 className="text-body-lg font-bold text-ink mb-4">账号管理</h2>

      {error && (
        <div className="bg-red-50 text-red-600 text-body-sm p-3 rounded-btn mb-4">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline">✕</button>
        </div>
      )}

      <div className="space-y-3">
        {childAccounts.map((child) => (
          <div key={child.id} className="flex items-center justify-between p-3 bg-surface-raised rounded-card">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{child.avatar_emoji}</span>
              <div>
                <p className="text-body-sm font-semibold text-ink">
                  {child.display_name}
                  {child.id === childId && (
                    <span className="ml-2 text-caption text-primary">当前</span>
                  )}
                </p>
                <p className="text-caption text-ink-tertiary">
                  {child.age_group} · {child.language}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(child)}
                className="text-caption text-ink-tertiary hover:text-primary px-2 py-1 rounded-btn hover:bg-surface transition-colors"
              >
                ✏️
              </button>
              <button
                onClick={() => handleDelete(child.id)}
                className="text-caption text-ink-tertiary hover:text-red-500 px-2 py-1 rounded-btn hover:bg-surface transition-colors"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={() => setCreating(true)}
        className="mt-4 w-full border-2 border-dashed border-border rounded-card p-3 text-body-sm text-ink-tertiary hover:border-primary hover:text-primary transition-all"
      >
        ＋ 添加孩子
      </button>

      {/* 编辑弹窗 */}
      {editing && (
        <EditModal account={editing} onClose={() => setEditing(null)} onSave={handleEdit} />
      )}

      {/* 创建弹窗 */}
      {creating && (
        <EditModal account={null} onClose={() => setCreating(false)} onSave={handleCreate} />
      )}
    </div>
  );
}
