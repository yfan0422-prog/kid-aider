import Anthropic from "@anthropic-ai/sdk";
import type { ModelProfile } from "@/lib/utils/types";
import { decryptApiKey } from "@/lib/utils/crypto";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface StreamChatOpts {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
}

export function createAnthropicAdapter(profile: ModelProfile) {
  const apiKey = decryptApiKey(profile.api_key);
  const client = new Anthropic({ baseURL: profile.base_url, apiKey });

  return {
    async *streamChat(opts: StreamChatOpts): AsyncIterable<string> {
      // Separate system message from conversation
      const systemMsg = opts.messages.find(m => m.role === "system");
      const conversation = opts.messages.filter(m => m.role !== "system");

      const stream = client.messages.stream({
        model: profile.model,
        system: systemMsg?.content,
        messages: conversation.map(m => ({
          role: m.role === "assistant" ? "assistant" as const : "user" as const,
          content: m.content,
        })),
        temperature: opts.temperature ?? profile.params.temperature,
        max_tokens: opts.max_tokens ?? profile.params.max_tokens,
      });

      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    },

    async chat(opts: StreamChatOpts): Promise<string> {
      const systemMsg = opts.messages.find(m => m.role === "system");
      const conversation = opts.messages.filter(m => m.role !== "system");

      const response = await client.messages.create({
        model: profile.model,
        system: systemMsg?.content,
        messages: conversation.map(m => ({
          role: m.role === "assistant" ? "assistant" as const : "user" as const,
          content: m.content,
        })),
        temperature: opts.temperature ?? profile.params.temperature,
        max_tokens: opts.max_tokens ?? profile.params.max_tokens,
      });
      const block = response.content.find(b => b.type === "text");
      return block?.text || "";
    },
  };
}

export type AnthropicAdapter = ReturnType<typeof createAnthropicAdapter>;
