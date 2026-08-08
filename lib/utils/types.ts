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

export type ProjectStatus = "active" | "paused" | "completed";
export type TrackType = "software" | "diy";
export type ItemStatus = "pending" | "active" | "done";
export type ReflectionType = "daily" | "milestone" | "final";

export interface Project {
  id: string;
  session_id: string;
  title: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Track {
  id: string;
  project_id: string;
  name: string;
  type: TrackType;
  sort_order: number;
  status: ItemStatus;
  created_at: string;
}

export interface Milestone {
  id: string;
  track_id: string;
  title: string;
  description: string;
  sort_order: number;
  status: ItemStatus;
  completed_at: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  milestone_id: string;
  title: string;
  what_to_do: string;
  how_hint: string;
  difficulty: number; // 1-3
  status: ItemStatus;
  completed_at: string | null;
  created_at: string;
}

export interface CheckIn {
  id: string;
  project_id: string;
  date: string; // YYYY-MM-DD
  summary: string;
  created_at: string;
}

export interface Reflection {
  id: string;
  project_id: string;
  type: ReflectionType;
  trigger_ref: string | null;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  created_at: string;
}

export interface ProjectLog {
  id: string;
  project_id: string;
  action: string; // task_done | check_in | reflection | milestone_complete | track_complete
  detail: string;
  created_at: string;
}
