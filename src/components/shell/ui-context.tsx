"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type UI = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  userEmail: string | null;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
};

const Ctx = createContext<UI | null>(null);

function usePersisted<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hidratar preferencia del navegador tras montar
      if (raw !== null) setV(JSON.parse(raw));
    } catch {}
  }, [key]);
  const set = (x: T) => {
    setV(x);
    try {
      localStorage.setItem(key, JSON.stringify(x));
    } catch {}
  };
  return [v, set] as const;
}

export function UIProvider({ userEmail, children }: { userEmail: string | null; children: ReactNode }) {
  const [collapsed, setCollapsed] = usePersisted("ap-ui-collapsed", false);
  const [searchOpen, setSearchOpen] = useState(false);
  const value = useMemo(
    () => ({ collapsed, setCollapsed, userEmail, searchOpen, setSearchOpen }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [collapsed, userEmail, searchOpen],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUI fuera de UIProvider");
  return v;
}
