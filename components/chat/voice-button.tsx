"use client";

import { useState, useRef, useCallback } from "react";
import { useLocale } from "@/lib/i18n/context";

type SlideMode = "none" | "text" | "cancel";
export type VoiceAction = "send" | "fill";

interface Props {
  onResult: (text: string, action: VoiceAction) => void;
  disabled?: boolean;
}

// 上滑判定阈值（px）：超过 TEXT_THRESHOLD 转文字，超过 CANCEL_THRESHOLD 取消。
// 阈值调高，避免孩子按住时手指轻微抖动就被误判为取消。
const TEXT_THRESHOLD = 80;
const CANCEL_THRESHOLD = 160;

export function VoiceButton({ onResult, disabled }: Props) {
  const { t } = useLocale();
  const [recording, setRecording] = useState(false);
  const [slideMode, setSlideMode] = useState<SlideMode>("none");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startYRef = useRef(0);
  const pointerIdRef = useRef<number | null>(null);
  const pressedRef = useRef(false);
  const actionRef = useRef<VoiceAction | "cancel">("send");

  const resolveMode = useCallback((dy: number): SlideMode => {
    if (dy >= CANCEL_THRESHOLD) return "cancel";
    if (dy >= TEXT_THRESHOLD) return "text";
    return "none";
  }, []);

  const resolveAction = useCallback((mode: SlideMode): VoiceAction | "cancel" => {
    if (mode === "cancel") return "cancel";
    if (mode === "text") return "fill";
    return "send";
  }, []);

  const transcribe = useCallback(
    async (blob: Blob, action: VoiceAction) => {
      setProcessing(true);
      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");
        const res = await fetch("/api/voice/asr", { method: "POST", body: formData });
        const data = await res.json();
        if (data.text) {
          onResult(String(data.text).trim(), action);
        } else {
          setError(t("chat.voice.error.unclear"));
          setTimeout(() => setError(null), 3000);
        }
      } catch {
        setError(t("chat.voice.error.unavailable"));
        setTimeout(() => setError(null), 3000);
      } finally {
        setProcessing(false);
      }
    },
    [onResult, t]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 授权期间用户已松手 → 视为取消，停止轨道
      if (!pressedRef.current) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        setSlideMode("none");

        // 取消或空录音 → 丢弃
        const action = actionRef.current;
        if (action === "cancel" || blob.size === 0) return;
        transcribe(blob, action);
      };

      // 二次确认仍处于按压中，避免 recorder.start() 与松手竞态
      if (!pressedRef.current) {
        stream.getTracks().forEach((tr) => tr.stop());
        return;
      }
      recorder.start();
      setRecording(true);
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? t("chat.voice.error.permission")
          : t("chat.voice.error.mic");
      setError(msg);
      pressedRef.current = false;
    }
  }, [transcribe, t]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || processing || !e.isPrimary) return;
      e.preventDefault();
      pressedRef.current = true;
      pointerIdRef.current = e.pointerId;
      startYRef.current = e.clientY;
      actionRef.current = "send";
      setSlideMode("none");
      // 捕获指针：松手前移动/抬起事件持续派发给按钮，即使手指已滑出
      e.currentTarget.setPointerCapture(e.pointerId);
      startRecording();
    },
    [disabled, processing, startRecording]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!pressedRef.current || pointerIdRef.current !== e.pointerId) return;
      const dy = startYRef.current - e.clientY;
      const mode = resolveMode(dy);
      setSlideMode(mode);
      actionRef.current = resolveAction(mode);
    },
    [resolveMode, resolveAction]
  );

  // 结束录音：根据 actionRef（最后一次指针移动或抬起时已更新）决定去向
  const finalizeRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    } else if (recorder && recorder.state === "inactive") {
      // 授权未完成即松手：停止轨道，startRecording 内部会自行中止
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      recorderRef.current = null;
      setRecording(false);
      setSlideMode("none");
    }
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      pressedRef.current = false;
      pointerIdRef.current = null;

      const dy = startYRef.current - e.clientY;
      const mode = resolveMode(dy);
      setSlideMode(mode);
      actionRef.current = resolveAction(mode);
      finalizeRecording();
    },
    [resolveMode, resolveAction, finalizeRecording]
  );

  const handlePointerCancel = useCallback(() => {
    // 浏览器/系统打断（如轻微移动被判定为滚动、iOS 长按呼出菜单等）：
    // 按最后已知手势结束，而不是一律取消 —— 避免“稍微偏移就自动取消”。
    if (pointerIdRef.current === null) return;
    pressedRef.current = false;
    pointerIdRef.current = null;
    finalizeRecording();
  }, [finalizeRecording]);

  const isMediaSupported =
    typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  if (!isMediaSupported) return null;

  return (
    <>
      <button
        type="button"
        disabled={disabled || processing}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{ touchAction: "none", WebkitTouchCallout: "none" }}
        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 select-none
          ${recording
            ? "bg-red-500 text-white scale-110 shadow-lg"
            : "bg-surface border border-border text-ink-tertiary hover:text-primary hover:border-primary"
          }
          ${disabled || processing ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        `}
        title={t("chat.voice.hint.hold")}
      >
        {processing ? <Spinner /> : <MicIcon active={recording} />}
      </button>

      {recording && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink/70 backdrop-blur-sm pointer-events-none select-none">
          <div className="flex flex-col items-center gap-7 px-8 text-center">
            <div className="relative flex items-center justify-center">
              <span className="absolute inline-flex h-28 w-28 rounded-full bg-red-400 opacity-40 animate-ping" />
              <div
                className={`relative w-28 h-28 rounded-full flex items-center justify-center text-white shadow-xl transition-colors duration-150 ${
                  slideMode === "cancel"
                    ? "bg-ink-tertiary"
                    : slideMode === "text"
                    ? "bg-primary"
                    : "bg-red-500"
                }`}
              >
                <MicIcon active={slideMode === "none"} size={44} />
              </div>
            </div>

            <div className="text-white text-xl font-bold">
              {slideMode === "cancel"
                ? t("chat.voice.hint.releaseCancel")
                : slideMode === "text"
                ? t("chat.voice.hint.releaseText")
                : t("chat.voice.hint.release")}
            </div>

            <div className="flex flex-col items-center gap-1.5 text-sm text-white/80">
              <span className={slideMode === "cancel" ? "font-bold text-white" : "opacity-50"}>
                {t("chat.voice.hint.slideCancel")}
              </span>
              <span className={slideMode === "text" ? "font-bold text-white" : "opacity-50"}>
                {t("chat.voice.hint.slideText")}
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-ink text-white text-body-xs px-3 py-1.5 rounded-btn shadow-lg z-50">
          {error}
        </div>
      )}
    </>
  );
}

function Spinner() {
  return (
    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

function MicIcon({ active, size = 22 }: { active: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
      {active && (
        <>
          <line x1="8" x2="16" y1="23" y2="23" />
          <line x1="8" x2="16" y1="25" y2="25" opacity="0.6" />
        </>
      )}
    </svg>
  );
}
