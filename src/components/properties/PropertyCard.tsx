"use client";

import { Bath, BedDouble, MapPin, Maximize, Ruler, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { eur0f, eurf, numf, pctf } from "@/lib/format";
import { habitacionesDe, type StatsPropiedad } from "@/lib/stats";
import { useData } from "@/lib/store";
import type { Property } from "@/lib/types";
import { CATEGORY, fichaUrl, StatusBadge } from "../domain";
import { RoomStrip } from "../rooms/RoomStrip";
import { Badge, cx } from "../ui";
import { TagEditor } from "./TagEditor";

export function PriceLabel({ p, s }: { p: Property; s: StatsPropiedad }) {
  const alquiler = p.category !== "venta";
  // Por habitaciones: lo que se cobra ahora por las habitaciones alquiladas.
  if (p.category === "habitaciones" && s.habitaciones.total) return <>{eur0f(s.habitaciones.renta)}<span className="font-normal opacity-70"> /mes</span></>;
  if (p.price != null) return <>{eur0f(p.price)}{alquiler && <span className="font-normal opacity-70"> /mes</span>}</>;
  if (alquiler && s.mediaMensual != null) return <>{eur0f(s.mediaMensual)}<span className="font-normal opacity-70"> /mes · media</span></>;
  return <span className="font-normal opacity-70">Sin precio</span>;
}

export function OccupancyBadge({ s }: { s: StatsPropiedad }) {
  const up = s.tendencia >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <Badge className="bg-ocupacion/10 text-ocupacion">
      <span title={`Ocupación ${s.year} hasta hoy. Flecha: últimos 90 días ${up ? "por encima" : "por debajo"} de la media.`} className="inline-flex items-center gap-1">
        {pctf(s.ocupacion)} <Icon size={12} />
      </span>
    </Badge>
  );
}

/** Precio por m² construido (venta). */
export const eurM2 = (p: Property) => (p.price != null && p.built_m2 ? p.price / p.built_m2 : null);

export function PropertyCard({ p, s }: { p: Property; s: StatsPropiedad }) {
  const { db } = useData();
  const Icon = CATEGORY[p.category].icon;
  const m2 = eurM2(p);
  const hab = p.category === "habitaciones" ? s.habitaciones : null;
  return (
    <Link href={fichaUrl(p.id)} className="group flex flex-col overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-36 bg-gradient-to-br from-[#e8edf5] to-[#dbe6f7]">
        {p.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- URLs externas arbitrarias
          <img src={p.photo_url} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <Icon size={48} strokeWidth={1.3} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-brand/50" />
        )}
        {hab && hab.total > 0 && p.status !== "remodelacion" ? (
          <Badge className={cx("absolute top-3 left-3 shadow-sm", hab.libres ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#DBEAFE] text-[#1D4ED8]")}>
            {hab.alquiladas}/{hab.total} alquiladas
          </Badge>
        ) : (
          <StatusBadge status={p.status} className="absolute top-3 left-3 shadow-sm" />
        )}
        <span className="num absolute top-3 right-3 rounded-full bg-card/95 px-2.5 py-1 text-xs font-bold shadow-sm">
          <PriceLabel p={p} s={s} />
        </span>
        <span className="absolute bottom-3 left-3 rounded-md bg-[#1f2430]/70 px-2 py-0.5 text-[11px] font-medium text-white">{p.type}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-base font-bold">{p.name}</h3>
          {p.category === "turistico" && <OccupancyBadge s={s} />}
        </div>
        <p className="flex items-center gap-1.5 truncate text-[13px] text-ink-2">
          <MapPin size={14} className="shrink-0 text-muted" />
          {p.address || p.city || "Sin dirección"}
        </p>
        <TagEditor property={p} />
        {hab ? (
          <div className="mt-auto border-t border-line pt-3">
            <RoomStrip rooms={habitacionesDe(db, p.id)} />
          </div>
        ) : (
          <div className="num mt-auto grid grid-cols-4 gap-1 border-t border-line pt-3 text-[12px] text-ink-2">
            <Spec icon={BedDouble} v={numf(p.bedrooms)} t="Habitaciones" />
            <Spec icon={Bath} v={numf(p.bathrooms)} t="Baños" />
            <Spec icon={Maximize} v={p.built_m2 != null ? `${numf(p.built_m2)} m²` : "—"} t="m² construidos" />
            <Spec icon={Ruler} v={p.useful_m2 != null ? `${numf(p.useful_m2)} m²` : "—"} t="m² útiles" />
          </div>
        )}
        <p className="num text-[12px] text-muted">
          {p.category === "venta" ? (
            m2 != null ? <>{eur0f(m2)} /m² construido</> : "Sin precio por m²"
          ) : hab ? (
            hab.total === 0 ? "Agrega sus habitaciones desde la ficha" : hab.libres ? <><span className="font-semibold text-[#15803D]">{eur0f(hab.porAlquilar)} /mes</span> por alquilar</> : "Todas las habitaciones ocupadas"
          ) : (
            <>Ingresos {s.year}: <span className="font-semibold text-ingreso">{eurf(s.ingresos)}</span> · {s.reservas} {s.reservas === 1 ? "reserva" : "reservas"}</>
          )}
        </p>
      </div>
    </Link>
  );
}

function Spec({ icon: Icon, v, t }: { icon: LucideIcon; v: string; t: string }) {
  return (
    <span className="flex items-center gap-1 truncate" title={t}>
      <Icon size={14} className="shrink-0 text-muted" />
      {v}
    </span>
  );
}
