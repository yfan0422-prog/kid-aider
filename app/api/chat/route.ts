import { NextRequest } from "next/server";
import { createSession, getSession, updateSession } from "@/lib/db/sessions";
import { createMessage, getRecentMessages } from "@/lib/db/messages";
import { upsertRequirementNode, getRequirementNodes } from "@/lib/db/requirements";
import { routeModel } from "@/lib/models/router";
import { classifyIntent } from "@/lib/engine/intent";
import { createFunnelState, evaluateLayerCompletion, getLayerLabel } from "@/lib/engine/funnel-machine";
import { buildChatPrompt } from "@/lib/engine/prompt-builder";
import type { AgeGroup, FunnelLayer } from "@/lib/utils/types";

export async function POST(req: NextRequest) {
  const { message, sessionId, ageGroup } = await req.json() as {
    message: string;
    sessionId?: string;
    ageGroup?: AgeGroup;
  };

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
  if (intent === "project" && session.funnel_step === 0) {
    // Start funnel
    updateSession(session.id, { status: "funneling", funnel_step: 1 });
    funnelState = createFunnelState();
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
      JSON.stringify({ error: "没有配置模型。请先在设置中添加模型档案。" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Build prompt
  const recentMessages = getRecentMessages(session.id, 20);
  let promptMessages = buildChatPrompt({
    ageGroup: ag,
    funnelStep: session.funnel_step,
    funnelState,
    recentMessages,
    currentInput: message,
  });

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

      try {
        for await (const chunk of routed.adapter.streamChat({
          messages: promptMessages,
        })) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }

        // Process funnel advancement if in funnel
        if (funnelState && funnelState.currentLayer > 0) {
          const transition = evaluateLayerCompletion(funnelState, fullResponse);

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
          }

          if (transition.action === "stay") {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ funnel_layer: transition.currentLayer, rephrase: true })}\n\n`));
          }
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
      }

      // Save guide message
      createMessage({
        session_id: session.id,
        role: "guide",
        content: fullResponse,
        strategy_id: funnelState ? `funnel-layer-${funnelState.currentLayer}` : "open-dialogue",
      });

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
