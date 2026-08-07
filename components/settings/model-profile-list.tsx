"use client";

import { useState, useEffect } from "react";
import { ModelProfileForm } from "./model-profile-form";
import { ConnectivityTest } from "./connectivity-test";
import type { ModelProfile, ModelProvider, ModelRole } from "@/lib/utils/types";

export function ModelProfileList() {
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [showForm, setShowForm] = useState(false);

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
    await fetch(`/api/config/models?id=${id}`, { method: "DELETE" });
    fetchProfiles();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">模型档案</h2>
        <button onClick={() => setShowForm(true)}
          className="bg-primary text-white border-none rounded-btn px-4 py-2.5 font-semibold text-sm hover:bg-primary-dark transition-colors">
          + 添加档案
        </button>
      </div>

      {showForm && (
        <div className="bg-surface border border-border rounded-card p-6 shadow-sm">
          <ModelProfileForm onSave={handleSave} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {profiles.length === 0 && !showForm && (
        <div className="text-center py-12 text-ink-tertiary">
          <p className="text-body-lg">还没有模型档案</p>
          <p className="text-body-sm mt-2">添加一个模型来开始使用 Kid-Aider</p>
        </div>
      )}

      {profiles.map((p) => (
        <div key={p.id} className="bg-surface border border-border rounded-card p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-body">{p.name}</h3>
              <p className="text-body-sm text-ink-tertiary">{p.provider} · {p.model}</p>
            </div>
            <div className="flex gap-2">
              {p.is_default && (
                <span className="text-xs bg-brand-soft text-[#B26A00] rounded-full px-2.5 py-1 font-semibold">默认</span>
              )}
              <button onClick={() => handleDelete(p.id)}
                className="text-ink-tertiary hover:text-[#FF6B6B] text-sm transition-colors">
                删除
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-body-sm text-ink-tertiary mb-3">
            <span>API Key: {p.api_key}</span>
          </div>
          <ConnectivityTest profileId={p.id} />
        </div>
      ))}
    </div>
  );
}
