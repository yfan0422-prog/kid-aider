import OpenAI from "openai";
import type { ModelProfile } from "@/lib/utils/types";
import { decryptApiKey } from "@/lib/utils/crypto";

export type ChatContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: ChatContent;
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
        ...(opts.temperature !== undefined && { temperature: opts.temperature }),
        ...(opts.max_tokens !== undefined && { max_tokens: opts.max_tokens }),
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
        ...(opts.temperature !== undefined && { temperature: opts.temperature }),
        ...(opts.max_tokens !== undefined && { max_tokens: opts.max_tokens }),
        stream: false,
      });
      return response.choices[0]?.message?.content || "";
    },

    async speech(text: string, voice: string, speed: number): Promise<Buffer> {
      const response = await client.audio.speech.create(
        {
          model: "tts-1",
          voice,
          input: text,
          speed,
          response_format: "mp3",
        },
        { signal: AbortSignal.timeout(5000) }
      );
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },
  };
}

export type OpenAIAdapter = ReturnType<typeof createOpenAIAdapter>;
