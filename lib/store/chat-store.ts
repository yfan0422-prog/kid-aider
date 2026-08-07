import { create } from "zustand";
import type { AgeGroup, Message, RequirementNode, SolutionPack } from "@/lib/utils/types";

interface ChatState {
  // Session
  sessionId: string | null;
  ageGroup: AgeGroup;

  // Messages
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;

  // Funnel
  funnelNodes: RequirementNode[];
  funnelComplete: boolean;

  // Solution pack
  solutionPack: SolutionPack | null;
  solutionStatus: "idle" | "generating" | "ready" | "confirmed";

  // Side panel
  sidePanelOpen: boolean;

  // Actions
  setSessionId: (id: string) => void;
  setAgeGroup: (ag: AgeGroup) => void;
  addMessage: (msg: Message) => void;
  setMessages: (msgs: Message[]) => void;
  setStreaming: (v: boolean) => void;
  appendStreamContent: (text: string) => void;
  clearStreamContent: () => void;
  setFunnelNodes: (nodes: RequirementNode[]) => void;
  setFunnelComplete: (v: boolean) => void;
  setSolutionPack: (pack: SolutionPack | null) => void;
  setSolutionStatus: (s: ChatState["solutionStatus"]) => void;
  setSidePanelOpen: (v: boolean) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  ageGroup: "10-12" as AgeGroup,
  messages: [],
  isStreaming: false,
  streamingContent: "",
  funnelNodes: [],
  funnelComplete: false,
  solutionPack: null,
  solutionStatus: "idle" as const,
  sidePanelOpen: true,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),
  setAgeGroup: (ag) => set({ ageGroup: ag }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setMessages: (msgs) => set({ messages: msgs }),
  setStreaming: (v) => set({ isStreaming: v }),
  appendStreamContent: (text) => set((s) => ({ streamingContent: s.streamingContent + text })),
  clearStreamContent: () => set({ streamingContent: "" }),
  setFunnelNodes: (nodes) => set({ funnelNodes: nodes }),
  setFunnelComplete: (v) => set({ funnelComplete: v }),
  setSolutionPack: (pack) => set({ solutionPack: pack }),
  setSolutionStatus: (s) => set({ solutionStatus: s }),
  setSidePanelOpen: (v) => set({ sidePanelOpen: v }),
  reset: () => set(initialState),
}));
