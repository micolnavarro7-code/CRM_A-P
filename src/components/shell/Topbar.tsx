"use client";

import { Bell, Building2, CalendarPlus, ChevronDown, FileUp, Menu, Search, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MESES, monthOf, todayISO } from "@/lib/format";
import { AVISO_DIAS, diasFinContrato } from "@/lib/stats";
import { useData } from "@/lib/store";
import type { Room } from "@/lib/types";
import { BookingForm } from "../bookings/BookingForm";
import { CsvImport } from "../bookings/CsvImport";
import { fichaUrl } from "../domain";
import { PropertyForm } from "../properties/PropertyForm";
import { cx } from "../ui";
import { SearchInput, SearchResults } from "./Search";
import { useUI } from "./ui-context";

/** Desplegable simple que se cierra al hacer clic fuera. */
function Dropdown({ trigger, children, align = "right", width = "w-72" }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: "left" | "right"; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div className={cx("absolute top-full z-40 mt-2 overflow-hidden rounded-2xl border border-line bg-card shadow-xl", width, align === "right" ? "right-0" : "left-0")}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const iconBtn = "relative grid size-10 place-items-center rounded-xl text-ink-2 transition hover:bg-page hover:text-ink";

type Accion = "reserva" | "importar" | "propiedad";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { db } = useData();
  const { setSearchOpen } = useUI();
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const [accion, setAccion] = useState<Accion | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!focus) return;
    const h = (e: MouseEvent) => !boxRef.current?.contains(e.target as Node) && setFocus(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [focus]);

  // Avisos: contratos de habitación pendientes o que vencen, y meses ya cerrados con reservas sin facturar.
  const avisos = useMemo(() => {
    const hoy = todayISO();
    const pname = (id: string) => db.properties.find((p) => p.id === id)?.name ?? "";
    const contratos = db.rooms
      .map((r) => ({ r, dias: diasFinContrato(r, hoy) }))
      .filter((x): x is { r: Room; dias: number } => x.dias != null && x.dias <= AVISO_DIAS)
      .sort((a, b) => a.dias - b.dias)
      .map(({ r, dias }) => ({
        key: r.id,
        href: fichaUrl(r.property_id, "habitaciones"),
        texto: <><span className="font-medium">{pname(r.property_id)} · {r.name}</span>: {dias < 0 ? "contrato vencido" : dias === 0 ? "el contrato termina hoy" : `el contrato termina en ${dias} días`}</>,
      }));
    const sinContrato = db.rooms
      .filter((r) => r.status === "alquilada" && !r.contract_done)
      .map((r) => ({
        key: `${r.id}:contrato`,
        href: fichaUrl(r.property_id, "habitaciones"),
        texto: <><span className="font-medium">{pname(r.property_id)} · {r.name}</span>: alquilada y con el contrato pendiente</>,
      }));
    const actual = monthOf(hoy);
    const grupos = new Map<string, { pid: string; month: string; n: number }>();
    for (const b of db.bookings) {
      if (b.invoiced || b.month >= actual) continue;
      const k = `${b.property_id}|${b.month}`;
      const g = grupos.get(k) ?? { pid: b.property_id, month: b.month, n: 0 };
      g.n++;
      grupos.set(k, g);
    }
    const facturas = [...grupos.values()]
      .sort((a, b) => b.month.localeCompare(a.month))
      .map((a) => ({
        key: a.pid + a.month,
        href: fichaUrl(a.pid, "reservas"),
        texto: <><span className="font-medium">{pname(a.pid)}</span>: {a.n} reserva{a.n > 1 ? "s" : ""} de {MESES[Number(a.month.slice(5, 7)) - 1].toLowerCase()} sin facturar</>,
      }));
    return [...sinContrato, ...contratos, ...facturas];
  }, [db.bookings, db.rooms, db.properties]);

  const acciones: { v: Accion; label: string; icon: typeof Zap }[] = [
    { v: "reserva", label: "Nueva reserva", icon: CalendarPlus },
    { v: "importar", label: "Importar reservas (CSV)", icon: FileUp },
    { v: "propiedad", label: "Agregar propiedad", icon: Building2 },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-line bg-card/95 px-3 backdrop-blur md:gap-3 md:px-6">
        <button type="button" onClick={onMenu} className={cx(iconBtn, "lg:hidden")} aria-label="Abrir menú">
          <Menu size={20} />
        </button>

        <Dropdown
          align="left"
          width="w-64"
          trigger={(open, toggle) => (
            <button type="button" onClick={toggle} className="bg-cta inline-flex h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-medium text-white shadow-sm hover:brightness-105 md:px-4" aria-expanded={open}>
              <Zap size={16} />
              <span className="hidden sm:inline">Acciones rápidas</span>
              <ChevronDown size={14} className="hidden sm:block" />
            </button>
          )}
        >
          {(close) => (
            <ul className="p-1.5">
              {acciones.map((a) => (
                <li key={a.v}>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      setAccion(a.v);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-page"
                  >
                    <a.icon size={16} className="text-orange-b" />
                    {a.label}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Dropdown>

        <div ref={boxRef} className="relative hidden max-w-md flex-1 md:block">
          <SearchInput value={q} onChange={setQ} onFocus={() => setFocus(true)} />
          {focus && q && (
            <div className="absolute top-full right-0 left-0 z-40 mt-2 rounded-2xl border border-line bg-card shadow-xl">
              <SearchResults q={q} onPick={() => { setFocus(false); setQ(""); }} />
            </div>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => setSearchOpen(true)} className={cx(iconBtn, "md:hidden")} aria-label="Buscar">
            <Search size={20} />
          </button>

          <Dropdown
            trigger={(_, toggle) => (
              <button type="button" onClick={toggle} className={iconBtn} aria-label={`Avisos (${avisos.length})`}>
                <Bell size={20} />
                {avisos.length > 0 && (
                  <span className="num absolute top-1.5 right-1.5 grid min-w-[18px] place-items-center rounded-full bg-orange-b px-1 text-[10px] leading-[18px] font-bold text-white">
                    {avisos.length}
                  </span>
                )}
              </button>
            )}
          >
            {(close) => (
              <div>
                <p className="border-b border-line px-4 py-3 text-sm font-semibold">Avisos</p>
                {avisos.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted">Todo al día.</p>
                ) : (
                  <ul className="scroll-thin max-h-80 overflow-y-auto p-1.5">
                    {avisos.map((a) => (
                      <li key={a.key}>
                        <Link href={a.href} onClick={close} className="block rounded-lg px-3 py-2 text-sm hover:bg-page">
                          {a.texto}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Dropdown>
        </div>
      </header>

      {/* Fuera del header: su backdrop-blur haría de contenedor de los modales fijos. */}
      {accion === "reserva" && <BookingForm onClose={() => setAccion(null)} />}
      {accion === "importar" && <CsvImport onClose={() => setAccion(null)} />}
      {accion === "propiedad" && <PropertyForm open onClose={() => setAccion(null)} />}
    </>
  );
}
