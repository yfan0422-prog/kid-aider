"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n/context";
import type { Work } from "@/lib/utils/types";

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

async function compressImage(file: File): Promise<Blob> {
  const MAX_DIM = 1280;
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function WorkUploadDialog({ file, childId, onClose, onCreated }: {
  file: File | null;
  childId: string;
  onClose: () => void;
  onCreated: (work: Work) => void;
}) {
  const { t } = useLocale();
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle("");
    setError("");
    setSaving(false);
  }, [file]);

  const isVideo = !!file && file.type.startsWith("video/");
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function handleSave() {
    if (!file || saving) return;
    setSaving(true);
    setError("");
    try {
      const payload = file.type.startsWith("image/") ? await compressImage(file) : file;
      const fd = new FormData();
      fd.append("file", payload, file.name);
      if (title.trim()) fd.append("title", title.trim());
      const res = await fetch(`/api/works?child_id=${encodeURIComponent(childId)}`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(t((body as { error?: string }).error || "error.works.file_missing"));
        return;
      }
      const data = await res.json();
      onCreated(data.work as Work);
      onClose();
    } catch {
      setError(t("error.network"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("showcase.works.add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {file && previewUrl && (
            isVideo
              ? <video src={previewUrl} controls className="w-full rounded-lg" />
              : <img src={previewUrl} alt="" className="w-full rounded-lg" />
          )}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("showcase.works.title")}
            disabled={saving}
            className="w-full rounded-btn border-2 border-border px-4 py-3 focus:border-primary focus:outline-none"
          />
          {saving && (
            <p className="text-body-sm text-ink-tertiary">
              {isVideo ? t("showcase.works.uploading") : t("showcase.works.ai_generating")}
            </p>
          )}
          {error && <p className="text-body-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <button className="rounded-btn border border-border px-4 py-2 text-ink-tertiary">
              {t("showcase.works.cancel")}
            </button>
          </DialogClose>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-btn bg-primary px-4 py-2 font-semibold text-white disabled:opacity-40"
          >
            {t("showcase.works.save")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
