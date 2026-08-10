"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import type { ReflectionType } from "@/lib/utils/types";

interface Question {
  id: string;
  text: string;
  hint: string;
}

interface Props {
  projectId: string;
  type: ReflectionType;
  triggerRef?: string;
  onDone: () => void;
  onClose: () => void;
}

export function ReflectionDialog({ projectId, type, triggerRef, onDone, onClose }: Props) {
  const { t } = useLocale();
  const [step, setStep] = useState(0); // 0=loading questions, 1-4=q1-q4, 5=done
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contextNote, setContextNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load questions on mount
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects/${projectId}/reflect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, trigger_ref: triggerRef || null }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setQuestions(d.questions || []);
        setContextNote(d.context_note || "");
        setStep(1);
      })
      .catch(() => {
        if (!cancelled) setStep(1);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, type, triggerRef]);

  const handleNext = (qId: string, answer: string) => {
    const nextAnswers = { ...answers, [qId]: answer };
    setAnswers(nextAnswers);
    if (step < questions.length) {
      setStep(step + 1);
    } else {
      handleSubmit(nextAnswers);
    }
  };

  const handleSubmit = async (finalAnswers: Record<string, string>) => {
    setSubmitting(true);
    try {
      await fetch(`/api/projects/${projectId}/reflect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          trigger_ref: triggerRef || null,
          q1: finalAnswers.q1 || "",
          q2: finalAnswers.q2 || "",
          q3: finalAnswers.q3 || "",
          q4: finalAnswers.q4 || "",
        }),
      });
    } finally {
      setSubmitting(false);
    }
    setStep(5);
  };

  const handleSkip = () => {
    if (step < questions.length) {
      setStep(step + 1);
    } else {
      handleSubmit(answers);
    }
  };

  if (step === 0) {
    return (
      <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
        <div className="bg-white rounded-card p-6 shadow-lg max-w-md w-full mx-4 text-center relative">
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="absolute top-3 right-3 text-ink-tertiary hover:text-ink transition-colors text-xl leading-none"
          >
            ✕
          </button>
          <div className="w-8 h-8 border-[3px] border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-body text-ink-tertiary">{t("project.reflection.loading")}</p>
        </div>
      </div>
    );
  }

  // Questions failed to load — give an escape hatch instead of silently vanishing.
  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
        <div className="bg-white rounded-card p-6 shadow-lg max-w-md w-full mx-4 text-center">
          <div className="text-4xl mb-3">🤔</div>
          <h3 className="text-body-lg font-bold mb-2">{t("project.reflection.load_failed")}</h3>
          <p className="text-body-sm text-ink-tertiary mb-4">{t("common.try_later")}</p>
          <button
            onClick={onClose}
            className="bg-primary text-white border-none rounded-btn px-6 py-2.5 font-semibold"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    );
  }

  if (step > questions.length) {
    return (
      <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
        <div className="bg-white rounded-card p-6 shadow-lg max-w-md w-full mx-4 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h3 className="text-body-lg font-bold mb-2">{t("project.reflection.complete")}</h3>
          <p className="text-body-sm text-ink-tertiary mb-4">{t("project.reflection.saved")}</p>
          <button
            onClick={onDone}
            className="bg-primary text-white border-none rounded-btn px-6 py-2.5 font-semibold"
          >
            {t("common.got_it")}
          </button>
        </div>
      </div>
    );
  }

  const q = questions[step - 1];
  if (!q) return null;

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-card p-6 shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-body-sm text-ink-tertiary whitespace-nowrap">
            {step}/{questions.length}
          </span>
          <div className="flex-1 h-1 bg-surface-raised rounded-full">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(step / questions.length) * 100}%` }}
            />
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="text-ink-tertiary hover:text-ink transition-colors text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {contextNote && step === 1 && (
          <p className="text-body-sm text-ink-tertiary mb-4">{contextNote}</p>
        )}

        <h3 className="text-body-lg font-bold mb-3">{q.text}</h3>
        {q.hint && <p className="text-body-sm text-ink-tertiary mb-4">💡 {q.hint}</p>}

        <textarea
          key={q.id}
          ref={textareaRef}
          className="w-full bg-surface-raised border border-border rounded-btn px-4 py-3 text-body resize-none min-h-[80px] focus:border-primary focus:outline-none"
          placeholder={t("project.reflection.answer.placeholder")}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleNext(q.id, textareaRef.current?.value || "");
            }
          }}
        />

        <div className="flex gap-3 mt-4 justify-between">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-body-sm text-ink-tertiary hover:text-ink transition-colors"
          >
            {t("common.skip")}
          </button>
          <button
            onClick={() => handleNext(q.id, textareaRef.current?.value || "")}
            disabled={submitting}
            className="bg-primary text-white border-none rounded-btn px-5 py-2 font-semibold text-body-sm disabled:opacity-40"
          >
            {step === questions.length
              ? (submitting ? t("common.saving") : t("common.done"))
              : t("project.reflection.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
