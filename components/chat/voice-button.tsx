"use client";

import { useState, useRef, useCallback } from "react";

type VoiceState = "idle" | "recording" | "processing";

interface Props {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export function VoiceButton({ onTranscription, disabled }: Props) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const debounceRef = useRef(false);

  const startRecording = useCallback(async () => {
    if (debounceRef.current) return;
    debounceRef.current = true;
    setTimeout(() => { debounceRef.current = false; }, 500);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Prefer opus-coded webm, fall back to plain webm for browsers without codec support
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size === 0) { setState("idle"); return; }

        setState("processing");
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          const res = await fetch("/api/voice/asr", { method: "POST", body: formData });
          const data = await res.json();
          if (data.text) {
            onTranscription(data.text);
          } else {
            setError("没听清，可以再说一遍吗？");
            setTimeout(() => setError(null), 3000);
          }
        } catch {
          setError("语音识别暂不可用");
          setTimeout(() => setError(null), 3000);
        } finally {
          setState("idle");
        }
      };

      recorder.start();
      setState("recording");
      setError(null);
    } catch (err) {
      const msg = err instanceof DOMException && err.name === "NotAllowedError"
        ? "请允许麦克风权限以使用语音功能"
        : "麦克风不可用";
      setError(msg);
      debounceRef.current = false;
    }
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const isMediaSupported = typeof window !== "undefined" && navigator.mediaDevices?.getUserMedia;

  if (!isMediaSupported) return null; // 不渲染按钮

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        disabled={disabled || state === "processing"}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        className={`w-10 h-10 rounded-btn flex items-center justify-center transition-all duration-200 shrink-0
          ${state === "recording"
            ? "bg-red-500 text-white scale-110 shadow-lg"
            : "bg-surface border border-border text-ink-tertiary hover:text-primary hover:border-primary"
          }
          ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
        `}
        title={state === "recording" ? "松开发送" : "按住说话"}
      >
        {state === "processing" ? (
          <Spinner />
        ) : (
          <MicIcon active={state === "recording"} />
        )}
      </button>
      {error && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-ink text-white text-body-xs px-3 py-1.5 rounded-btn shadow-lg">
          {error}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
