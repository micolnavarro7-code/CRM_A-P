"use client";

// Panel (portada): las propiedades agrupadas en sus tres líneas de negocio.

import { ArrowRight, FileBarChart, FileSignature, Plus } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { CATEGORIES, CATEGORY, MODEL, STATUS } from "@/components/domain";
import { PropertyCard } from "@/components/properties/PropertyCard";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { ContractsTable, statsContratos } from "@/components/rooms/Contracts";
import { Button, Card, PageBanner, SectionHeader, StatStrip, type Stat } from "@/components/ui";
import { downloadCSV } from "@/lib/export";
import { datef, eur0f, eurf, pctf, r2, todayISO, yearOf } from "@/lib/format";
import { contratos, resumenContratos, resumenHabitaciones, statsPropiedad, type StatsPropiedad } from "@/lib/stats";
import { useData } from "@/lib/store";
import type { Category, DB, Property } from "@/lib/types";

export default function Panel() {
  const { db } = useData();
  const [form, setForm] = useState<Category | null>(null);
  const stats = useMemo(() => new Map(db.properties.map((p) => [p.id, statsPropiedad(p, db)])), [db]);

  // Al entrar con /#venta desde fuera, el navegador busca el ancla antes de que haya datos.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);

  function exportar() {
    const year = yearOf(todayISO());
    downloadCSV(
      `propiedades-${todayISO()}`,
      ["Categoría", "Código", "Nombre", "Dirección", "Ciudad", "Tipo", "Estado", "Precio", "Modelo", "% agencia", "Propietario", `Ingresos ${year}`, "Ocupación"],
      db.properties.map((p) => {
        const s = stats.get(p.id)!;
        const venta = p.category === "venta";
        return [
          CATEGORY[p.category].label, p.code, p.name, p.address, p.city, p.type, STATUS[p.status].label, p.price,
          venta ? null : MODEL[p.business_model],
          !venta && p.business_model === "gestion" ? p.agency_pct : null,
          db.contacts.find((c) => c.id === p.owner_id)?.name ?? null,
          venta ? null : s.ingresos,
          p.category === "turistico" ? r2(s.ocupacion) : null,
        ];
      }),
    );
  }

  return (
    <>
      <PageBanner title="Panel" sub={`${db.properties.length} propiedades en cartera`}>
        <Button variant="onDark" icon={<FileBarChart size={16} />} onClick={exportar}>Exportar</Button>
        <Button icon={<Plus size={16} />} onClick={() => setForm("turistico")}>Agregar propiedad</Button>
      </PageBanner>

      <div className="flex flex-col gap-10">
        {CATEGORIES.map((c) => {
          const order = CATEGORY[c].statuses;
          const props = db.properties.filter((p) => p.category === c).sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
          return (
            <Fragment key={c}>
              <Seccion cat={c} props={props} stats={stats} resumen={resumen(c, props, stats, db)} onAdd={() => setForm(c)} />
              {/* Los contratos son de las habitaciones: van justo después. */}
              {c === "habitaciones" && <SeccionContratos />}
            </Fragment>
          );
        })}
      </div>

      {form && <PropertyForm open category={form} onClose={() => setForm(null)} />}
    </>
  );
}

function Seccion({ cat, props, stats, resumen, onAdd }: { cat: Category; props: Property[]; stats: Map<string, StatsPropiedad>; resumen: Stat[]; onAdd: () => void }) {
  const c = CATEGORY[cat];
  const Icon = c.icon;
  return (
    // scroll-mt: que el título no quede bajo la barra superior al saltar al ancla
    <section id={cat} className="scroll-mt-20">
      <SectionHeader
        icon={<Icon size={20} />}
        iconCls={c.cls}
        title={c.label}
        count={props.length}
        sub={c.sub}
        action={<Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={onAdd}>Agregar</Button>}
      />

      {props.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full flex-col items-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line px-4 py-10 text-center text-sm text-muted transition hover:border-blue-brand/40 hover:text-ink-2"
        >
          <Icon size={28} strokeWidth={1.5} />
          <span>Aún no hay propiedades de {c.label.toLowerCase()}.</span>
          <span className="font-medium text-blue-brand">Agregar la primera</span>
        </button>
      ) : (
        <>
          <StatStrip items={resumen} />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {props.map((p) => <PropertyCard key={p.id} p={p} s={stats.get(p.id)!} />)}
          </div>
        </>
      )}
    </section>
  );
}

function SeccionContratos() {
  const { db } = useData();
  const cs = contratos(db);
  return (
    <section id="contratos" className="scroll-mt-20">
      <SectionHeader
        icon={<FileSignature size={20} />}
        iconCls="bg-[#DCFCE7] text-[#15803D]"
        title="Contratos"
        count={cs.length}
        sub="Uno por cada habitación alquilada o reservada"
        action={<Link href="/contratos" className="inline-flex h-8 items-center gap-1 rounded-xl px-3 text-[13px] font-medium text-blue-brand hover:bg-blue-brand/10">Ver todos <ArrowRight size={14} /></Link>}
      />
      {cs.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border-2 border-dashed border-line px-4 py-8 text-center text-sm text-muted">Al alquilar o reservar una habitación aparece aquí su contrato.</p>
      ) : (
        <>
          <StatStrip items={statsContratos(resumenContratos(cs))} />
          <Card className="mt-4 !p-0">
            <ContractsTable items={cs} limit={6} />
          </Card>
        </>
      )}
    </section>
  );
}

/** Cifras de la cabecera de cada sección (año en curso, hasta hoy). */
function resumen(cat: Category, props: Property[], stats: Map<string, StatsPropiedad>, db: DB): Stat[] {
  if (cat === "venta") {
    const valor = (ps: Property[]) => eur0f(ps.reduce((a, p) => a + (p.price ?? 0), 0));
    const enVenta = props.filter((p) => p.status === "disponible");
    const reservadas = props.filter((p) => p.status === "reservado" || p.status === "arras");
    const vendidas = props.filter((p) => p.status === "vendida");
    return [
      { label: "En venta", value: enVenta.length, sub: valor(enVenta) },
      { label: "Reservadas o en arras", value: reservadas.length, sub: valor(reservadas) },
      { label: "Vendidas", value: vendidas.length, sub: valor(vendidas) },
      { label: "Valor en cartera", value: valor(props.filter((p) => p.status !== "vendida")), tone: "text-ingreso", sub: "Sin contar las vendidas" },
    ];
  }

  const ids = new Set(props.map((p) => p.id));

  if (cat === "habitaciones") {
    const h = resumenHabitaciones(db.rooms.filter((r) => ids.has(r.property_id)));
    const ocup = pctf(h.total ? h.alquiladas / h.total : null);
    return [
      { label: "Habitaciones", value: h.total, sub: `En ${props.length} ${props.length === 1 ? "piso" : "pisos"}` },
      { label: "Alquiladas", value: h.alquiladas, tone: "text-beneficio", sub: h.reservadas ? `${ocup} · ${h.reservadas} ${h.reservadas === 1 ? "reservada" : "reservadas"}` : `${ocup} de ocupación` },
      { label: "Libres", value: h.libres, tone: h.libres ? "text-[#15803D]" : undefined, sub: h.libres ? `${eur0f(h.porAlquilar)} /mes por alquilar` : "Todo ocupado" },
      { label: "Renta mensual", value: eur0f(h.renta), tone: "text-ingreso", sub: `De ${eur0f(h.potencial)} con todas alquiladas` },
    ];
  }

  const hoy = todayISO();
  const year = yearOf(hoy);
  const st = props.map((p) => stats.get(p.id)!);
  const reservas = db.bookings.filter((b) => ids.has(b.property_id) && yearOf(b.month) === year);
  const ingresos = r2(st.reduce((a, s) => a + s.ingresos, 0));
  const margen = r2(st.reduce((a, s) => a + s.margen, 0));
  return [
    { label: `Ingresos ${year}`, value: eurf(ingresos), tone: "text-ingreso", sub: `${reservas.length} ${reservas.length === 1 ? "reserva" : "reservas"}` },
    { label: "Margen agencia", value: eurf(margen), tone: margen < 0 ? "text-gasto" : "text-beneficio", sub: "Gestión y subarriendo" },
    { label: "Ocupación media", value: pctf(st.reduce((a, s) => a + s.ocupacion, 0) / st.length), tone: "text-ocupacion", sub: `Del 1 ene al ${datef(hoy)}` },
    { label: "Sin facturar", value: reservas.filter((b) => !b.invoiced).length, sub: `Reservas de ${year}` },
  ];
}
