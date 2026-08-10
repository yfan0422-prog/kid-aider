"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { UserAccount } from "@/lib/utils/types";

interface ChildContextValue {
  childId: string | null;
  setChildId: (id: string) => void;
  childAccounts: UserAccount[];
  refreshAccounts: () => Promise<void>;
  loading: boolean;
}

const ChildContext = createContext<ChildContextValue | null>(null);

export function useChild(): ChildContextValue {
  const ctx = useContext(ChildContext);
  if (!ctx) throw new Error("useChild() must be used inside <ChildProvider>");
  return ctx;
}

const STORAGE_KEY = "kid-aider-child-id";

export function ChildProvider({ children }: { children: ReactNode }) {
  const [childId, setChildIdState] = useState<string | null>(null);
  const [childAccounts, setChildAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/user/accounts");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setChildAccounts(data.accounts || []);
    } catch {
      // Silently retain previous accounts; UI shows existing state
    }
  }, []);

  // 恢复上次选择
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    refreshAccounts().then(() => {
      setLoading(false);
      if (stored) {
        setChildIdState(stored);
      }
    });
  }, [refreshAccounts]);

  const setChildId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setChildIdState(id);
  }, []);

  return (
    <ChildContext.Provider value={{ childId, setChildId, childAccounts, refreshAccounts, loading }}>
      {children}
    </ChildContext.Provider>
  );
}
