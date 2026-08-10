"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import type { ModelProfile, ModelProvider, ModelRole } from "@/lib/utils/types";

interface Props {
  onSave: (data: {
    name: string; provider: ModelProvider; base_url: string;
    api_key: string; model: string; assigned_roles: ModelRole[];
    params: { temperature: number; max_tokens: number };
  }) => void;
  onCancel: () => void;
  initial?: {
    name?: string; provider?: string; base_url?: string;
    model?: string; assigned_roles?: ModelRole[];
  };
  /** When set, the form is in edit mode — onSave is the update handler */
  editingProfile?: ModelProfile | null;
}

export function ModelProfileForm({ onSave, onCancel, initial, editingProfile }: Props) {
  const { t } = useLocale();
  const isEditing = !!editingProfile;
  const [name, setName] = useState(editingProfile?.name || initial?.name || "");
  const [provider, setProvider] = useState<ModelProvider>(
    (editingProfile?.provider as ModelProvider) || (initial?.provider as ModelProvider) || "openai"
  );
  const [baseUrl, setBaseUrl] = useState(editingProfile?.base_url || initial?.base_url || "");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(editingProfile?.model || initial?.model || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name, provider, base_url: baseUrl, api_key: apiKey, model,
      assigned_roles: ["dialogue"],
      params: { temperature: 0.7, max_tokens: 2048 },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">{t("settings.model.name")}</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder={t("settings.model.name.placeholder")} required />
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">{t("settings.model.provider")}</label>
        <select value={provider} onChange={e => setProvider(e.target.value as ModelProvider)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors">
          <option value="openai">{t("settings.model.provider.openai")}</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">{t("settings.model.url")}</label>
        <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder="https://api.openai.com/v1" required />
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">{t("settings.model.key")}</label>
        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder={isEditing ? t("settings.model.key.edit.placeholder") : "sk-……"}
          required={!isEditing} />
        <p className="text-caption text-ink-tertiary mt-1">
          {isEditing ? t("settings.model.key.edit.hint") : t("settings.model.key.hint")}
        </p>
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">{t("settings.model.model")}</label>
        <input type="text" value={model} onChange={e => setModel(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder="gpt-4o / deepseek-chat / claude-sonnet-5" required />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit"
          className="flex-1 bg-primary text-white border-none rounded-btn px-5 py-3 font-semibold text-body hover:bg-primary-dark transition-colors">
          {isEditing ? t("settings.model.update") : t("settings.model.save")}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 bg-surface text-ink-secondary border-2 border-border rounded-btn px-5 py-3 font-semibold text-body hover:bg-surface-raised transition-colors">
          {t("common.cancel")}
        </button>
      </div>
    </form>
  );
}
