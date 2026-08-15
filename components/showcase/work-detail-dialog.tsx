"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n/context";
import type { Work } from "@/lib/utils/types";

export function WorkDetailDialog({ work, childId, onClose, onUpdated, onDeleted }: {
  work: Work | null;
  childId: string;
  onClose: () => void;
  onUpdated: (work: Work) => void;
  onDeleted: (id: string) => void;
}) {
  const { t } = useLocale();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (work) {
      setTitle(work.title);
      setDescription(work.description);
      setEditing(false);
    }
  }, [work]);

  async function handleSave() {
    if (!work || saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/works/${work.id}?child_id=${encodeURIComponent(childId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      onUpdated(data.work as Work);
      setEditing(false);
    } catch {
      /* 忽略，保持编辑态 */
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!work || deleting) return;
    if (!confirm(t("showcase.works.delete_confirm"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/works/${work.id}?child_id=${encodeURIComponent(childId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      onDeleted(work.id);
      onClose();
    } catch {
      /* 忽略 */
    } finally {
      setDeleting(false);
    }
  }

  if (!work) return null;
  const src = `/api/works/${work.id}/file?child_id=${encodeURIComponent(childId)}`;
  const label = work.title
    || t(work.type === "video" ? "showcase.works.type.video" : "showcase.works.type.photo");

  return (
    <Dialog open={!!work} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("showcase.works.view")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {work.type === "video"
            ? <video src={src} controls className="w-full rounded-lg" />
            : <img src={src} alt={work.title} className="w-full rounded-lg" />}
          {work.ai_encouragement && (
            <div className="rounded-lg bg-primary/10 p-3 text-primary">💬 {work.ai_encouragement}</div>
          )}
          {editing ? (
            <div className="space-y-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("showcase.works.title")}
                className="w-full rounded-btn border-2 border-border px-4 py-3 focus:border-primary focus:outline-none"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("showcase.works.description")}
                rows={3}
                className="w-full rounded-btn border-2 border-border px-4 py-3 focus:border-primary focus:outline-none"
              />
            </div>
          ) : (
            <div className="space-y-1">
              <h3 className="text-body-lg font-bold text-ink">{label}</h3>
              {work.description && <p className="text-body-sm text-ink-tertiary">{work.description}</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="rounded-btn border border-border px-4 py-2 text-ink-tertiary">
                {t("showcase.works.cancel")}
              </button>
              <button onClick={handleSave} disabled={saving} className="rounded-btn bg-primary px-4 py-2 font-semibold text-white disabled:opacity-40">
                {t("showcase.works.save")}
              </button>
            </>
          ) : (
            <>
              <button onClick={handleDelete} disabled={deleting} className="rounded-btn border border-red-300 px-4 py-2 text-red-500 disabled:opacity-40">
                {t("showcase.works.delete")}
              </button>
              <button onClick={() => setEditing(true)} className="rounded-btn border border-border px-4 py-2 text-ink-tertiary">
                {t("showcase.works.edit")}
              </button>
              <DialogClose asChild>
                <button className="rounded-btn bg-primary px-4 py-2 font-semibold text-white">{t("common.close")}</button>
              </DialogClose>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
