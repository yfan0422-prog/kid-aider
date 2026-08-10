"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/context";
import type { FilteredWord } from "@/lib/utils/types";

export function FilteredWordsManager() {
  const { t } = useLocale();
  const [words, setWords] = useState<FilteredWord[]>([]);
  const [newWord, setNewWord] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchWords = () => {
    fetch("/api/parent/filtered-words")
      .then(r => r.json())
      .then(d => setWords(d.words))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWords(); }, []);

  const addWord = async () => {
    if (!newWord.trim()) return;
    await fetch("/api/parent/filtered-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: newWord.trim() }),
    });
    setNewWord("");
    fetchWords();
  };

  const removeWord = async (id: number) => {
    await fetch("/api/parent/filtered-words", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchWords();
  };

  if (loading) {
    return <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />;
  }

  return (
    <div>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={newWord}
          onChange={e => setNewWord(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addWord()}
          placeholder={t("parent.filter.placeholder")}
          className="flex-1 border border-border rounded-btn px-3 py-1.5 text-body-sm"
        />
        <button
          onClick={addWord}
          className="bg-primary text-white rounded-btn px-4 py-1.5 text-body-sm font-semibold"
        >
          {t("parent.filter.add")}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {words.map(w => (
          <span
            key={w.id}
            className="inline-flex items-center gap-1 bg-surface-raised border border-border rounded-btn px-2.5 py-1 text-body-sm"
          >
            {w.word}
            <button
              onClick={() => removeWord(w.id)}
              className="text-ink-tertiary hover:text-red-500 transition-colors ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
