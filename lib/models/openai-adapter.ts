import OpenAI from "openai";
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

export function createOpenAIAdapter(profile: ModelProfile) {
  const apiKey = decryptApiKey(profile.api_key);
  const client = new OpenAI({ baseURL: profile.base_url, apiKey });

  return {
    async *streamChat(opts: StreamChatOpts): AsyncIterable<string> {
      const stream = await client.chat.completions.create({
        model: profile.model,
        messages: opts.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: opts.temperature ?? profile.params.temperature,
        max_tokens: opts.max_tokens ?? profile.params.max_tokens,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield delta;
      }
    },

    async chat(opts: StreamChatOpts): Promise<string> {
      const response = await client.chat.completions.create({
        model: profile.model,
        messages: opts.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        temperature: opts.temperature ?? profile.params.temperature,
        max_tokens: opts.max_tokens ?? profile.params.max_tokens,
        stream: false,
      });
      return response.choices[0]?.message?.content || "";
    },
  };
}

export type OpenAIAdapter = ReturnType<typeof createOpenAIAdapter>;
