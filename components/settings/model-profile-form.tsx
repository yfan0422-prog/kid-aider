"use client";

import { useState } from "react";
import type { ModelProvider, ModelRole } from "@/lib/utils/types";

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
}

export function ModelProfileForm({ onSave, onCancel, initial }: Props) {
  const [name, setName] = useState(initial?.name || "");
  const [provider, setProvider] = useState<ModelProvider>((initial?.provider as ModelProvider) || "openai");
  const [baseUrl, setBaseUrl] = useState(initial?.base_url || "");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial?.model || "");

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
        <label className="block text-body-sm font-semibold mb-1.5">档案名称</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder="例如：Kimi-主力" required />
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">协议</label>
        <select value={provider} onChange={e => setProvider(e.target.value as ModelProvider)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors">
          <option value="openai">OpenAI 兼容</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">Base URL</label>
        <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder="https://api.openai.com/v1" required />
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">API Key</label>
        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder="sk-……" required />
        <p className="text-caption text-ink-tertiary mt-1">Key 仅存储在本地，加密保存</p>
      </div>
      <div>
        <label className="block text-body-sm font-semibold mb-1.5">模型名</label>
        <input type="text" value={model} onChange={e => setModel(e.target.value)}
          className="w-full bg-surface border-2 border-border rounded-btn px-4 py-3 text-body focus:border-primary focus:outline-none transition-colors"
          placeholder="gpt-4o / deepseek-chat / claude-sonnet-5" required />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit"
          className="flex-1 bg-primary text-white border-none rounded-btn px-5 py-3 font-semibold text-body hover:bg-primary-dark transition-colors">
          保存
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 bg-surface text-ink-secondary border-2 border-border rounded-btn px-5 py-3 font-semibold text-body hover:bg-surface-raised transition-colors">
          取消
        </button>
      </div>
    </form>
  );
}
