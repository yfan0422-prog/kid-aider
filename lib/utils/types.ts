export type AgeGroup = "6-9" | "10-12" | "13-15";
export type SessionStatus = "active" | "funneling" | "composing" | "completed";
export type MessageRole = "child" | "guide" | "system";
export type FunnelLayer = 1 | 2 | 3 | 4 | 5;
export type SolutionPackStatus = "draft" | "confirmed" | "exported";
export type ModelProvider = "openai" | "anthropic" | "custom";
export type ModelRole = "dialogue" | "solution_composing" | "quality_evaluation" | "safety_review";

export interface Session {
  id: string;
  title: string;
  age_group: AgeGroup;
  status: SessionStatus;
  funnel_step: number;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: MessageRole;
  content: string;
  strategy_id: string | null;
  created_at: string;
}

export interface RequirementNode {
  id: string;
  session_id: string;
  layer: FunnelLayer;
  label: string;
  content: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SolutionPack {
  id: string;
  session_id: string;
  version: number;
  title: string;
  content: string; // YAML string
  status: SolutionPackStatus;
  created_at: string;
  updated_at: string;
}

export interface ModelProfile {
  id: string;
  name: string;
  provider: ModelProvider;
  base_url: string;
  api_key: string; // encrypted at rest
  model: string;
  assigned_roles: ModelRole[];
  params: { temperature: number; max_tokens: number };
  is_default: boolean;
  created_at: string;
  updated_at: string;
}
