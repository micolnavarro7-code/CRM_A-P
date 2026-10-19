"use client";

import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { contratos, resumenContratos } from "@/lib/stats";
import { useData } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { cx } from "../ui";
import { NAV } from "./nav";
import { useUI } from "./ui-context";

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="bg-brand grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white">A&amp;P</span>
      {!collapsed && (
        <span className="leading-tight">
          <span className="block text-[15px] font-bold">A&amp;P Real Estate</span>
          <span className="block text-[11px] text-muted">CRM de gestión</span>
        </span>
      )}
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { collapsed, setCollapsed, userEmail } = useUI();
  const { db, mode } = useData();
  const c = collapsed && !onNavigate; // en el cajón móvil nunca va plegada
  // La ficha de una propiedad cuelga del Panel.
  const isActive = (href: string) =>
    href === "/" ? path === "/" || path.startsWith("/propiedades") : path === href || path.startsWith(href + "/");
  const pendientes = resumenContratos(contratos(db)).pendientes;

  return (
    <aside className={cx("flex h-full flex-col bg-card", c ? "w-[76px]" : "w-[248px]")}>
      <div className={cx("flex items-center justify-between px-4 pt-5 pb-5", c && "flex-col gap-3 px-2")}>
        <Logo collapsed={c} />
        {!onNavigate && (
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-page hover:text-ink"
            aria-label={collapsed ? "Desplegar menú" : "Plegar menú"}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        )}
      </div>

      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-3">
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = !item.category && isActive(item.href);
            const n = item.category ? db.properties.filter((p) => p.category === item.category).length : null;
            return (
              <li key={item.href} className={cx(item.href === "/ajustes" && "mt-3 border-t border-line pt-3")}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  title={c ? item.label : undefined}
                  className={cx(
                    "flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                    c && "justify-center px-0",
                    active ? "bg-brand text-white shadow-sm" : "text-ink-2 hover:bg-page hover:text-ink",
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  {!c && <span className="flex-1 truncate">{item.label}</span>}
                  {!c && n !== null && <span className="num rounded-full bg-page px-1.5 text-[11px] text-muted">{n}</span>}
                  {!c && item.href === "/contratos" && pendientes > 0 && (
                    <span className="num rounded-full bg-[#FEF3C7] px-1.5 text-[11px] font-semibold text-[#B45309]" title="Contratos pendientes">{pendientes}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {(!c || supabase) && (
        <div className="border-t border-line p-3">
          {!c && <p className="truncate px-3 py-1 text-xs text-muted">{userEmail ?? (mode === "local" ? "Modo local · datos en este navegador" : "")}</p>}
          {supabase && (
            <button
              type="button"
              onClick={() => supabase?.auth.signOut()}
              title="Cerrar sesión"
              className={cx("flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-2 transition hover:bg-page hover:text-gasto", c && "justify-center px-0")}
            >
              <LogOut size={18} />
              {!c && "Cerrar sesión"}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
