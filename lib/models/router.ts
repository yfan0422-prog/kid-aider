import type { ModelRole } from "@/lib/utils/types";
import { getDefaultProfile, getModelProfile } from "@/lib/db/model-profiles";
import { createOpenAIAdapter, type OpenAIAdapter } from "./openai-adapter";
import { createAnthropicAdapter, type AnthropicAdapter } from "./anthropic-adapter";

export type Adapter = OpenAIAdapter | AnthropicAdapter;

export interface RoutedModel {
  adapter: Adapter;
  profile: { id: string; name: string; provider: string; model: string };
}

export function routeModel(role?: ModelRole): RoutedModel | null {
  const profile = getDefaultProfile(role);
  if (!profile) return null;

  const adapter =
    profile.provider === "anthropic"
      ? createAnthropicAdapter(profile)
      : createOpenAIAdapter(profile);

  return {
    adapter,
    profile: { id: profile.id, name: profile.name, provider: profile.provider, model: profile.model },
  };
}

export function routeModelById(profileId: string): RoutedModel | null {
  const profile = getModelProfile(profileId);
  if (!profile) return null;

  const adapter =
    profile.provider === "anthropic"
      ? createAnthropicAdapter(profile)
      : createOpenAIAdapter(profile);

  return {
    adapter,
    profile: { id: profile.id, name: profile.name, provider: profile.provider, model: profile.model },
  };
}
