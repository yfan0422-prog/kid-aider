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

export type CompetencyDimension =
  | "clarification"
  | "decomposition"
  | "execution"
  | "reflection"
  | "creativity"
  | "persistence";

export type ScoreType = "rule" | "ai";

export type BadgeTier = "silver" | "gold";

export type BadgeCategory = "competency" | "achievement";

export interface CompetencySnapshot {
  id: string;
  week_start: string; // YYYY-MM-DD Monday
  dimension: CompetencyDimension;
  score: number; // 0-100
  score_type: ScoreType;
  evidence: string; // JSON array of {source_table, source_id, quote, weight}
  created_at: string;
}

export interface EvidenceEvent {
  id: string;
  dimension: CompetencyDimension;
  event_type: string;
  source_table: string;
  source_id: string;
  payload: string; // JSON object
  created_at: string;
}

export interface Badge {
  id: string;
  name: string;
  label: string;
  tier: BadgeTier;
  dimension: CompetencyDimension | null;
  category: BadgeCategory;
  description: string;
  icon: string;
  earned_at: string | null;
  created_at: string;
}

export interface UsageConfig {
  id: number; // always 1
  daily_limit_min: number | null;
  quiet_start: string | null; // HH:mm
  quiet_end: string | null;
  filter_enabled: number; // 0/1
  restrictions_paused: number; // 0/1
  updated_at: string;
}

export interface UsageLog {
  id: string;
  date: string; // YYYY-MM-DD
  total_sec: number;
}

export interface FilteredWord {
  id: number;
  word: string;
}

export interface VoiceSession {
  id: string;
  session_id: string | null;
  audio_path: string;
  transcript: string | null;
  asr_model: string;
  asr_time_ms: number | null;
  created_at: string;
}

export interface EmotionLog {
  id: string;
  session_id: string | null;
  source: "voice" | "text" | "fused";
  emotion: string;
  confidence: number | null;
  voice_features: string | null; // JSON: {pitch, duration, volume} | null
  text_snippet: string | null;
  model_used: string; // 'rule' | 'llm' | 'rule+llm'
  created_at: string;
}

export interface ChildProfile {
  id: string;
  ability_creativity: number;   // 0.0-1.0
  ability_logical: number;
  ability_focus: number;
  ability_expression: number;
  ability_curiosity: number;
  ability_updated_at: string | null;
  interest_tags: string;        // JSON array: ["绘画","恐龙"]
  interest_updated_at: string | null;
  emotion_baseline: string;     // JSON: {"excited":0.3,"calm":0.4,...}
  emotion_updated_at: string | null;
  preferred_time_range: string | null;
  avg_session_minutes: number | null;
  engagement_trend: string;     // "rising" | "stable" | "declining"
  total_sessions: number;
  last_session_at: string | null;
  deep_analysis_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  id: string;
  trigger: "session_start" | "session_end" | "deep_analysis";
  changes: string;   // JSON: 记录哪些字段发生了变化
  snapshot: string | null;  // JSON: 变更后的画像快照
  created_at: string;
}
