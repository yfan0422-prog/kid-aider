"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/i18n/context";
import { ModelProfileForm } from "./model-profile-form";
import { ConnectivityTest } from "./connectivity-test";
import type { ModelProfile, ModelProvider, ModelRole } from "@/lib/utils/types";

export function ModelProfileList() {
  const { t } = useLocale();
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fetchProfiles = async () => {
    const res = await fetch("/api/config/models");
    const data = await res.json();
    setProfiles(data.profiles || []);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const handleSave = async (formData: {
    name: string; provider: ModelProvider; base_url: string;
    api_key: string; model: string; assigned_roles: ModelRole[];
    params: { temperature: number; max_tokens: number };
  }) => {
    await fetch("/api/config/models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    setShowForm(false);
    fetchProfiles();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("settings.model.confirmDelete"))) return;
    await fetch(`/api/config/models?id=${id}`, { method: "DELETE" });
    fetchProfiles();
  };

  const handleUpdate = async (id: string, formData: {
    name: string; provider: ModelProvider; base_url: string;
    api_key: string; model: string; assigned_roles: ModelRole[];
    params: { temperature: number; max_tokens: number };
  }) => {
    const body: Record<string, unknown> = { ...formData };
    // Don't send empty api_key on update (leave unchanged)
    if (!body.api_key) delete body.api_key;
    await fetch(`/api/config/models?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditingId(null);
    fetchProfiles();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    const res = await fetch(`/api/config/models?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(t(data.error || "error.unknown"));
      return;
    }
    fetchProfiles();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t("settings.model.title")}</h2>
        <button onClick={() => setShowForm(true)}
          className="bg-primary text-white border-none rounded-btn px-4 py-2.5 font-semibold text-sm hover:bg-primary-dark transition-colors">
          + {t("settings.model.add")}
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-card p-6 shadow-sm">
          <ModelProfileForm onSave={handleSave} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {editingId && (() => {
        const profile = profiles.find(p => p.id === editingId);
        if (!profile) return null;
        return (
          <div className="bg-surface border-2 border-primary rounded-card p-6 shadow-sm">
            <h3 className="text-body-lg font-semibold mb-4">{t("settings.model.edit")}</h3>
            <ModelProfileForm
              editingProfile={profile}
              onSave={(data) => handleUpdate(editingId, data)}
              onCancel={() => setEditingId(null)}
            />
          </div>
        );
      })()}

      {profiles.length === 0 && !showForm && !editingId && (
        <div className="text-center py-12 text-ink-tertiary">
          <p className="text-body-lg">{t("settings.model.empty")}</p>
          <p className="text-body-sm mt-2">{t("settings.model.empty.hint")}</p>
        </div>
      )}

      {profiles.map((p) => (
        <div key={p.id} className={`bg-surface border border-border rounded-card p-5 shadow-sm transition-opacity ${p.enabled ? "" : "opacity-60"}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-body">{p.name}</h3>
              <p className="text-body-sm text-ink-tertiary">{p.provider} · {p.model}</p>
            </div>
            <div className="flex items-center gap-2">
              {p.is_default && (
                <span className="text-xs bg-brand-soft text-[#B26A00] rounded-full px-2.5 py-1 font-semibold">{t("settings.model.default")}</span>
              )}
              {!p.enabled && (
                <span className="text-xs bg-[#FEE2E2] text-[#991B1B] rounded-full px-2.5 py-1 font-semibold">{t("settings.model.disabled")}</span>
              )}
              <button onClick={() => { setShowForm(false); setEditingId(p.id); }}
                className="text-ink-tertiary hover:text-primary text-sm transition-colors">
                {t("settings.model.edit")}
              </button>
              <button onClick={() => handleDelete(p.id)}
                className="text-ink-tertiary hover:text-[#FF6B6B] text-sm transition-colors">
                {t("settings.model.delete")}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-body-sm text-ink-tertiary mb-3">
            <span>{t("settings.model.key")}: {p.api_key}</span>
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-body-sm text-ink-secondary">{t("settings.model.enabled")}</span>
            <button
              onClick={() => handleToggle(p.id, p.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                p.enabled ? "bg-primary" : "bg-[#D1D5DB]"
              }`}
              role="switch"
              aria-checked={p.enabled}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  p.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
          <ConnectivityTest profileId={p.id} />
        </div>
      ))}
    </div>
  );
}
