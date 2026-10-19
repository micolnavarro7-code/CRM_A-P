"use client";

import type { Session } from "@supabase/supabase-js";
import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { DataProvider, useData } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { cx, Loading } from "../ui";
import { Login } from "./Login";
import { Sidebar } from "./Sidebar";
import { SearchInput, SearchResults } from "./Search";
import { Topbar } from "./Topbar";
import { UIProvider, useUI } from "./ui-context";

export function AppShell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(!!supabase);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (checking) return <Loading />;
  if (supabase && !session) return <Login />;

  return (
    <DataProvider>
      <UIProvider userEmail={session?.user.email ?? null}>
        <Frame>{children}</Frame>
      </UIProvider>
    </DataProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { collapsed, searchOpen, setSearchOpen } = useUI();
  const { ready, error } = useData();
  const [drawer, setDrawer] = useState(false);
  const path = usePathname();

  // Cerrar el cajón móvil al cambiar de ruta.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDrawer(false), [path]);

  return (
    <div className="flex min-h-screen">
      <div className={cx("sticky top-0 hidden h-screen shrink-0 border-r border-line lg:block", collapsed ? "w-[76px]" : "w-[248px]")}>
        <Sidebar />
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-[#1f2430]/45" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 shadow-2xl">
            <Sidebar onNavigate={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setDrawer(true)} />
        <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
          <div className="mx-auto max-w-[1400px]">
            {error && <p className="mb-4 rounded-xl bg-gasto/10 px-4 py-3 text-sm text-[#b54848]">Error al cargar datos de Supabase: {error}</p>}
            {ready ? children : <Loading />}
          </div>
        </main>
      </div>

      {searchOpen && <SearchPalette onClose={() => setSearchOpen(false)} />}
    </div>
  );
}

function SearchPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#1f2430]/45 px-3 pt-[12vh]" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-card shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} autoFocus placeholder="Buscar propiedad, huésped o nº de reserva…" />
          <button type="button" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-page" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <SearchResults q={q} onPick={onClose} />
      </div>
    </div>
  );
}
