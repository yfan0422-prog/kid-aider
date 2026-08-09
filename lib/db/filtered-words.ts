import { getDb } from "./index";
import type { FilteredWord } from "@/lib/utils/types";

export function getFilteredWords(): FilteredWord[] {
  const db = getDb();
  return db.prepare("SELECT * FROM filtered_words ORDER BY id ASC").all() as FilteredWord[];
}

export function addFilteredWord(word: string): FilteredWord {
  const db = getDb();
  const trimmed = word.trim();
  if (!trimmed) throw new Error("敏感词不能为空");
  db.prepare("INSERT INTO filtered_words (word) VALUES (?)").run(trimmed);
  const row = db.prepare("SELECT * FROM filtered_words WHERE word = ?").get(trimmed);
  return row as FilteredWord;
}

export function removeFilteredWord(id: number): void {
  const db = getDb();
  db.prepare("DELETE FROM filtered_words WHERE id = ?").run(id);
}

/** Check if text contains any filtered word. Returns the first match. */
export function checkTextFilter(text: string): { blocked: boolean; matched: string | null } {
  const words = getFilteredWords();
  const lower = text.toLowerCase();
  for (const w of words) {
    if (lower.includes(w.word.toLowerCase())) {
      return { blocked: true, matched: w.word };
    }
  }
  return { blocked: false, matched: null };
}
