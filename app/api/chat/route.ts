import { NextRequest } from "next/server";
import { createSession, getSession, updateSession } from "@/lib/db/sessions";
import { createMessage, getRecentMessages } from "@/lib/db/messages";
import { upsertRequirementNode, getRequirementNodes } from "@/lib/db/requirements";
import { routeModel } from "@/lib/models/router";
import { classifyIntent } from "@/lib/engine/intent";
import { createFunnelState, evaluateLayerCompletion, getLayerLabel } from "@/lib/engine/funnel-machine";
import { buildChatPrompt } from "@/lib/engine/prompt-builder";
import { recordEvent } from "@/lib/engine/evidence-collector";
import { getUsageConfig } from "@/lib/db/usage-config";
import { getTodayUsageSec, recordUsageTime } from "@/lib/db/usage-log";
import { checkTextFilter } from "@/lib/db/filtered-words";
import { classifyEmotion, classifyEmotionByRules } from "@/lib/voice/emotion-classifier";
import { createEmotionLog } from "@/lib/db/emotion-log";
import { getOrCreateChildProfile, updateChildProfile, createProfileUpdate } from "@/lib/db/child-profile";
import { buildProfileContext } from "@/lib/engine/profile-builder";
import type { AgeGroup, FunnelLayer } from "@/lib/utils/types";

/**
 * Build an SSE response carrying a single "blocked" guide message.
 * The chat client only renders SSE `text` events, so a soft block (quiet
 * hours / daily limit) is delivered as a normal guide reply instead of a
 * JSON body the client does not know how to render.
 */
function blockedResponse(message: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: message, blocked: true })}\n\n`));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export async function POST(req: NextRequest) {
  const { message, sessionId, ageGroup } = await req.json() as {
    message: string;
    sessionId?: string;
    ageGroup?: AgeGroup;
  };

  // ── P4 usage check ──────────────────────────────────────────
  const usageConfig = getUsageConfig();

  if (!usageConfig.restrictions_paused) {
    // Quiet hours check
    if (usageConfig.quiet_start && usageConfig.quiet_end) {
      const now = new Date();
      const currentMin = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = usageConfig.quiet_start.split(":").map(Number);
      const [eh, em] = usageConfig.quiet_end.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      const inQuiet = startMin < endMin
        ? currentMin >= startMin && currentMin < endMin
        : currentMin >= startMin || currentMin < endMin;
      if (!sessionId && inQuiet) {
        return blockedResponse("现在是休息时间，明天再来探索吧！");
      }
    }

    // Daily limit check
    if (usageConfig.daily_limit_min) {
      const todaySec = getTodayUsageSec();
      const limitSec = usageConfig.daily_limit_min * 60;
      if (todaySec >= limitSec) {
        return blockedResponse("今天的探索时间到啦！明天再来吧 🌙");
      }
    }
  }
  // ── End P4 usage check ──────────────────────────────────────

  // Get or create session
  let session = sessionId ? getSession(sessionId) : null;
  if (!session) {
    session = createSession({ age_group: ageGroup || "10-12" });
  }

  const ag = (ageGroup || session.age_group) as AgeGroup;

  // Save child message
  createMessage({ session_id: session.id, role: "child", content: message });

  // Classify intent
  const intent = classifyIntent(message);

  // Determine if entering funnel
  let funnelState = session.funnel_step > 0 ? createFunnelState() : undefined;
  let justEnteredFunnel = false;
  if (intent === "project" && session.funnel_step === 0) {
    // Start funnel — this message is the intent signal, not a layer answer
    updateSession(session.id, { status: "funneling", funnel_step: 1 });
    funnelState = createFunnelState();
    justEnteredFunnel = true;
  } else if (session.funnel_step > 0) {
    // Restore funnel state from existing requirement nodes
    funnelState = createFunnelState();
    const nodes = getRequirementNodes(session.id);
    for (const n of nodes) {
      if (funnelState.layers[n.layer]) {
        funnelState.layers[n.layer].content = n.content;
        funnelState.layers[n.layer].complete = true;
      }
    }
    // Set current layer to first incomplete
    const incomplete = Object.entries(funnelState.layers).find(([, v]) => !v.complete);
    if (incomplete) {
      funnelState.currentLayer = parseInt(incomplete[0]) as FunnelLayer;
    } else {
      funnelState.currentLayer = 5 as FunnelLayer;
    }
  }

  // Route model
  const routed = routeModel("dialogue");
  if (!routed) {
    return new Response(
      JSON.stringify({ error: "error.model_not_configured" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build prompt
  const recentMessages = getRecentMessages(session.id, 20);

  // --- Emotion detection (non-blocking for text input) ---
  // The rule path is O(1) and synchronous — it feeds the prompt immediately so
  // the hot path never blocks on LLM latency. The full rule+LLM classification
  // runs fire-and-forget afterwards to enrich emotion_log.
  let emotionContext = "";
  const recentTexts = recentMessages
    .filter(m => m.role === "child")
    .slice(-3)
    .map(m => m.content);

  const ruleEmotion = classifyEmotionByRules({ text: message, history: recentTexts });
  const strategies: Record<string, string> = {
    excited: "孩子当前情绪: 兴奋。请保持热情回应，同时适度引导聚焦。",
    calm: "孩子当前情绪: 平静。请正常引导。",
    frustrated: "孩子当前情绪: 沮丧。请以鼓励为主，降低任务难度。",
    impatient: "孩子当前情绪: 着急。请先安抚情绪，再拆解步骤引导。",
    confused: "孩子当前情绪: 困惑。请主动解释，给出具体例子帮助理解。",
  };
  emotionContext = strategies[ruleEmotion.emotion] || "";

  setTimeout(() => {
    classifyEmotion({ text: message, history: recentTexts, sessionId: session.id })
      .then((emotionResult) => {
        createEmotionLog({
          sessionId: session.id,
          source: "text",
          emotion: emotionResult.emotion,
          confidence: emotionResult.confidence,
          textSnippet: message.slice(0, 200),
          modelUsed: emotionResult.modelUsed,
        });
      })
      .catch((err) => {
        console.warn("[chat] emotion detection failed:", err);
      });
  }, 0);

  // --- P6 profile injection ---
  let profileContext = "";
  try {
    const profile = getOrCreateChildProfile();
    profileContext = buildProfileContext(profile);
  } catch (err) {
    console.warn("[chat] profile read failed, falling back to empty context:", err);
  }
  // --- End P6 profile injection ---

  let promptMessages = buildChatPrompt({
    ageGroup: ag,
    funnelStep: session.funnel_step,
    funnelState,
    recentMessages,
    currentInput: message,
    profileContext,  // ← P6 新增
  });
  if (emotionContext) {
    // 在 system message 后插入情绪上下文
    promptMessages.splice(1, 0, {
      role: "system" as const,
      content: emotionContext,
    });
  }

  // The Anthropic adapter only reads the FIRST system message, but
  // buildChatPrompt may emit the funnel context as a SECOND system message.
  // When routed to Anthropic, merge all system messages into the primary
  // system prompt so the funnel state + strategy hint are not lost.
  if (routed.profile.provider === "anthropic") {
    const systemMsgs = promptMessages.filter(m => m.role === "system");
    if (systemMsgs.length > 1) {
      promptMessages = [
        { role: "system", content: systemMsgs.map(m => m.content).join("\n\n") },
        ...promptMessages.filter(m => m.role !== "system"),
      ];
    }
  }

  // Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";
      let streamOk = true;

      try {
        for await (const chunk of routed.adapter.streamChat({
          messages: promptMessages,
        })) {
          fullResponse += chunk;
        }

        // Process funnel advancement if in funnel
        // Skip evaluation on the entry message — it's an intent signal, not a layer answer
        if (funnelState && funnelState.currentLayer > 0 && !justEnteredFunnel) {
          const transition = evaluateLayerCompletion(funnelState, message);

          if (transition.action === "advance") {
            // Save completed layer to requirement node
            const prevLayer = (transition.currentLayer - 1) as FunnelLayer;
            if (prevLayer >= 1 && funnelState.layers[prevLayer]?.complete) {
              upsertRequirementNode({
                session_id: session.id,
                layer: prevLayer,
                label: getLayerLabel(prevLayer),
                content: funnelState.layers[prevLayer].content,
              });
            }
            updateSession(session.id, { funnel_step: transition.currentLayer });
          }

          if (transition.action === "complete") {
            // Save final layer
            const lastLayer = 5 as FunnelLayer;
            if (funnelState.layers[lastLayer]?.complete) {
              upsertRequirementNode({
                session_id: session.id,
                layer: lastLayer,
                label: getLayerLabel(lastLayer),
                content: funnelState.layers[lastLayer].content,
              });
            }
            updateSession(session.id, { status: "composing", funnel_step: 5 });
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ funnel_complete: true })}\n\n`));

            // Record clarification evidence — fires async after the SSE response is
            // flushed so it never blocks the stream. Fire-and-forget DB write.
            setTimeout(() => {
              try {
                recordEvent("clarification", "funnel_complete", "sessions", session.id, {
                  funnel_step: funnelState.currentLayer,
                });
              } catch (err) {
                console.error("[chat] failed to record funnel_complete evidence:", err);
              }
            }, 0);
          }

          if (transition.action === "stay") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ funnel_layer: transition.currentLayer, rephrase: true })}\n\n`));
          }
        }
      } catch (error) {
        streamOk = false;
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
      }

      // ── P4 content filter ───────────────────────────────────────
      // The response is fully assembled before emission so the filter can
      // actually gate what the child sees (streamed chunks cannot be retracted).
      // The filter always runs — on an error path the partial response is still
      // persisted to the messages table, so it must be filtered too.
      let finalContent = fullResponse;
      if (usageConfig.filter_enabled) {
        const filterResult = checkTextFilter(fullResponse);
        if (filterResult.blocked) {
          finalContent = "这个问题我们换一种方式回答。";
        }
      }
      // ── End P4 content filter ───────────────────────────────────

      // ── P4 80% time warning ─────────────────────────────────────
      if (streamOk && !usageConfig.restrictions_paused && usageConfig.daily_limit_min) {
        const todaySec = getTodayUsageSec();
        const limitSec = usageConfig.daily_limit_min * 60;
        if (todaySec >= limitSec * 0.8 && todaySec < limitSec) {
          const remainingMin = Math.ceil((limitSec - todaySec) / 60);
          finalContent = finalContent + `\n\n⏰ 今天还剩约 ${remainingMin} 分钟哦！`;
        }
      }
      // ── End P4 time warning ─────────────────────────────────────

      if (streamOk) {
        // Emit the fully assembled (filtered, warning-appended) response as one text event
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: finalContent })}\n\n`));
      }

      // Save guide message
      createMessage({
        session_id: session.id,
        role: "guide",
        content: finalContent,
        strategy_id: funnelState ? `funnel-layer-${funnelState.currentLayer}` : "open-dialogue",
      });

      // ── P4 record usage time (rough estimate: ~10s per exchange) ──
      // Only count successful exchanges — blocked/errored requests never reach here,
      // and an errored stream should not consume the child's daily allowance.
      if (streamOk) {
        const today = new Date().toISOString().slice(0, 10);
        recordUsageTime(today, 10);
      }
      // ── End P4 usage recording ──────────────────────────────────

      // P6 session-end lightweight update (fire-and-forget)
      const messagesThisSession = recentMessages.filter(m => m.role === "child").length;
      if (streamOk && messagesThisSession >= 3) {
        setTimeout(() => {
          try {
            const p = getOrCreateChildProfile();
            updateChildProfile(p.id, {
              total_sessions: p.total_sessions + 1,
              last_session_at: new Date().toISOString().replace("T", " ").replace(/\.\d{3}Z$/, ""),
            });
            createProfileUpdate({
              trigger: "session_end",
              changes: { total_sessions: p.total_sessions + 1 },
            });
          } catch (err) {
            console.warn("[chat] profile session-end update failed:", err);
          }
        }, 0);
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Session-Id": session.id,
    },
  });
}
