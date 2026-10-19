"use client";

import { CalendarCheck, DoorOpen, Search as SearchIcon } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { datef } from "@/lib/format";
import { useData } from "@/lib/store";
import { CATEGORY, CHANNEL, fichaUrl } from "../domain";

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Resultados de búsqueda global sobre propiedades y reservas. */
export function SearchResults({ q, onPick }: { q: string; onPick: () => void }) {
  const { db } = useData();
  const res = useMemo(() => {
    const n = norm(q.trim());
    if (n.length < 2) return null;
    const props = db.properties.filter((p) => [p.name, p.address, p.city, p.code].some((x) => norm(x).includes(n))).slice(0, 6);
    const bookings = db.bookings.filter((b) => [b.guest_name, b.booking_ref].some((x) => norm(x).includes(n))).slice(0, 6);
    const rooms = db.rooms.filter((r) => norm(r.tenant_name).includes(n)).slice(0, 6);
    return { props, bookings, rooms };
  }, [q, db]);

  if (!res) return <p className="px-4 py-6 text-center text-sm text-muted">Escribe al menos 2 letras: propiedad, huésped, inquilino o nº de reserva.</p>;
  if (!res.props.length && !res.bookings.length && !res.rooms.length) return <p className="px-4 py-6 text-center text-sm text-muted">Sin resultados para «{q}».</p>;
  const pname = (id: string) => db.properties.find((p) => p.id === id)?.name ?? "";
  const row = "flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-page";

  return (
    <div className="scroll-thin max-h-[60vh] overflow-y-auto p-2">
      {res.props.length > 0 && <Group title="Propiedades" />}
      {res.props.map((p) => {
        const Icon = CATEGORY[p.category].icon;
        return (
          <Link key={p.id} href={fichaUrl(p.id)} onClick={onPick} className={row}>
            <Icon size={16} className="text-blue-brand" />
            <span className="flex-1 truncate font-medium">{p.name}</span>
            <span className="truncate text-xs text-muted">{CATEGORY[p.category].label}</span>
          </Link>
        );
      })}
      {res.rooms.length > 0 && <Group title="Inquilinos" />}
      {res.rooms.map((r) => (
        <Link key={r.id} href={fichaUrl(r.property_id, "habitaciones")} onClick={onPick} className={row}>
          <DoorOpen size={16} className="text-ocupacion" />
          <span className="flex-1 truncate">
            <span className="font-medium">{r.tenant_name}</span> · {pname(r.property_id)}
          </span>
          <span className="shrink-0 text-xs text-muted">{r.name}</span>
        </Link>
      ))}
      {res.bookings.length > 0 && <Group title="Reservas" />}
      {res.bookings.map((b) => (
        <Link key={b.id} href={fichaUrl(b.property_id, "reservas")} onClick={onPick} className={row}>
          <CalendarCheck size={16} className="text-ingreso" />
          <span className="flex-1 truncate">
            <span className="font-medium">{b.guest_name ?? "Huésped"}</span> · {pname(b.property_id)}
          </span>
          <span className="shrink-0 text-xs text-muted">
            {CHANNEL[b.channel].label} · {datef(b.check_in)}
          </span>
        </Link>
      ))}
    </div>
  );
}

function Group({ title }: { title: string }) {
  return <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</p>;
}

export function SearchInput({ value, onChange, onFocus, autoFocus, placeholder = "Buscar propiedad o reserva…" }: { value: string; onChange: (v: string) => void; onFocus?: () => void; autoFocus?: boolean; placeholder?: string }) {
  return (
    <div className="relative w-full">
      <SearchIcon size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-page pr-3 pl-9 text-sm outline-none transition placeholder:text-muted focus:border-blue-brand focus:bg-card focus:ring-2 focus:ring-blue-brand/15"
      />
    </div>
  );
}
