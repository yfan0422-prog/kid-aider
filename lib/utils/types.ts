export type AgeGroup = "6-9" | "10-12" | "13-15";
export type InteractionMode = "knowledge" | "writing" | "creative";
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
  child_id?: string;
  mode: InteractionMode;
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
  enabled: boolean;
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
  source: ProjectSource;          // ← 新增
  source_topic_id: string | null;  // ← 新增
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
  challenge_json: string | null;  // ← 新增
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
  child_id: string;  // P9：所属子账号
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

// ─── P7 内容生态 ───────────────────────────────────────────────

export type TopicLanguage = "zh-CN" | "zh-HK" | "en";
export type TopicCategory =
  | "自然科学" | "技术编程" | "视觉艺术" | "音乐表演"
  | "历史长廊" | "国学经典" | "诗词歌赋" | "中医智慧"
  | "中文精进" | "英文探索" | "数学思维" | "综合能力";
export type TopicSource = "seed" | "auto_suggested" | "manual";
export type SuggestionStatus = "pending" | "approved" | "rejected";

export interface TopicCatalog {
  id: string;
  title: string;
  summary: string;
  cover_image: string | null;
  category: TopicCategory;
  age_group: AgeGroup | "all";
  language: TopicLanguage;
  interest_tag: string | null;
  source: TopicSource;
  sort_order: number;
  is_active: number; // 0|1
  created_at: string;
  updated_at: string;
}

export interface TopicContent {
  id: string;
  topic_id: string;
  age_group: string;
  language: TopicLanguage;
  version: number;
  intro_text: string;
  challenges: string; // JSON: Challenge[]
  project_prompt: string | null;
  image_prompts: string | null; // JSON: {section, prompt}[]
  generation_rule_version: string;
  is_active: number; // 0|1
  generated_at: string;
  created_at: string;
}

export interface Challenge {
  title: string;
  description: string;
  hint: string | null;
  difficulty: number; // 1-3
  materials: string[];
  estimated_minutes: number;
}

export interface ContentGenerationRequest {
  topicId: string;
  ageGroup: AgeGroup | "all";
  language: TopicLanguage;
  forceRefresh: boolean;
}

export interface GeneratedContent {
  intro: string;
  challenges: Challenge[];
  project_prompt: string;
  image_prompts: { section: string; prompt: string }[];
}

export interface TopicSuggestion {
  id: string;
  interest_tag: string;
  candidate_title: string;
  viability_score: number;
  viability_reason: string | null;
  status: SuggestionStatus;
  reviewed_at: string | null;
  created_at: string;
}

// ─── P8a 习惯养成 ───────────────────────────────────────────────

export type ActionType = "login" | "explore_topic" | "complete_challenge" | "task_done" | "check_in" | "reflection" | "create_project";

export type ProjectSource = "funnel" | "topic";

export interface StartProjectRequest {
  project_name: string;
  goto: "project" | "chat";
  language?: string;
}

export interface StartProjectResponse {
  project: Project;
  session?: { id: string };
}

export type BadgeRarity = "common" | "rare" | "epic" | "legendary";
export type BadgeCategory8 = "explore" | "project" | "streak" | "special";
export type RankTier = "bronze" | "silver" | "gold" | "diamond" | "legendary";

export interface UnlockRule {
  type: "action_count" | "streak_days" | "total_points" | "projects_count" | "reflections_count";
  threshold: number;
  subject?: string;
}

export interface UserAccount {
  id: string;
  display_name: string;
  avatar_emoji: string;
  age_group: string;
  language: string;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  created_at: string;
  updated_at: string;
}

export interface DailyActivity {
  id: string;
  user_id: string;
  action_type: ActionType;
  action_target: string | null;
  points: number;
  note: string | null;
  created_at: string;
}

export interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: BadgeCategory8;
  rarity: BadgeRarity;
  points_value: number;
  unlock_rule: string; // JSON: UnlockRule
  sort_order: number;
  created_at: string;
}

export interface BadgeUnlock {
  id: string;
  user_id: string;
  badge_id: string;
  unlocked_at: string;
}

// ─── P10 作品存档 ───────────────────────────────────────────────

export type WorkType = "photo" | "video";

export interface Work {
  id: string;
  child_id: string;
  type: WorkType;
  file_path: string;   // 相对 DATA_DIR 的路径，如 media/works/<child_id>/<uuid>.jpg
  mime_type: string;
  title: string;
  description: string;
  ai_encouragement: string;
  size_bytes: number;
  created_at: string;
}
