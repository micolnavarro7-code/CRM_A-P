"use client";

import { ArrowLeft, CalendarCheck, CalendarClock, CalendarPlus, DoorOpen, Download, Euro, MapPin, Pencil, Percent, Ruler, Trash2, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type ReactNode } from "react";
import { BookingForm } from "@/components/bookings/BookingForm";
import { BookingsTable } from "@/components/bookings/BookingsTable";
import { CSV_COLUMNS } from "@/components/bookings/CsvImport";
import { CATEGORY, CHANNEL, MODEL, STATUS, StatusBadge } from "@/components/domain";
import { eurM2 } from "@/components/properties/PropertyCard";
import { MonthlyCostsEditor } from "@/components/properties/MonthlyCostsEditor";
import { PropertyForm } from "@/components/properties/PropertyForm";
import { ResumenAnual } from "@/components/properties/ResumenAnual";
import { TagEditor } from "@/components/properties/TagEditor";
import { RoomsGrid } from "@/components/rooms/RoomsGrid";
import { Button, Card, Empty, Kpi, Loading, PageBanner, Tabs, YearNav } from "@/components/ui";
import { margenAgencia, ocupacion, resumenAnual, totalAnual } from "@/lib/calc";
import { downloadCSV } from "@/lib/export";
import { datef, eur0f, eurf, MESES, month0Of, numf, pctf, r2, todayISO, yearOf } from "@/lib/format";
import { AVISO_DIAS, diasFinContrato, habitacionesDe, resumenHabitaciones } from "@/lib/stats";
import { useData } from "@/lib/store";
import type { Property } from "@/lib/types";

type Tab = "habitaciones" | "resumen" | "reservas" | "gastos" | "datos";

const TABS: Tab[] = ["habitaciones", "resumen", "reservas", "gastos", "datos"];

// La ficha va por query (?id=…&tab=…) para que la web se pueda exportar como estática.
export default function FichaPage() {
  return (
    <Suspense fallback={<Loading />}>
      <FichaDesdeUrl />
    </Suspense>
  );
}

function FichaDesdeUrl() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const t = sp.get("tab") as Tab | null;
  const tab = t && TABS.includes(t) ? t : null;
  // key: al cambiar de propiedad o pestaña por URL, la ficha se reinicia.
  return <FichaPropiedad key={id + (tab ?? "")} id={id} tabInicial={tab} />;
}

function FichaPropiedad({ id, tabInicial }: { id: string; tabInicial: Tab | null }) {
  const { db } = useData();
  const p = db.properties.find((x) => x.id === id);
  const [edit, setEdit] = useState(false);

  if (!p)
    return (
      <Card>
        <Empty title="Propiedad no encontrada">
          <Link href="/" className="text-blue-brand hover:underline">Volver al Panel</Link>
        </Empty>
      </Card>
    );

  const owner = db.contacts.find((c) => c.id === p.owner_id);
  const venta = p.category === "venta";

  return (
    <>
      <Link href={`/#${p.category}`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} /> {CATEGORY[p.category].label}
      </Link>
      {venta ? (
        <FichaVenta p={p} ownerName={owner?.name} onEdit={() => setEdit(true)} />
      ) : (
        <FichaAlquiler p={p} ownerName={owner?.name} tabInicial={tabInicial} onEdit={() => setEdit(true)} />
      )}
      {edit && <PropertyForm open initial={p} onClose={() => setEdit(false)} />}
    </>
  );
}

function Banner({ p, ownerName, onEdit, children }: { p: Property; ownerName?: string; onEdit: () => void; children?: ReactNode }) {
  return (
    <PageBanner
      title={p.name}
      sub={
        <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><MapPin size={14} />{p.address || p.city || "Sin dirección"}</span>
          {p.category !== "venta" && <span>{MODEL[p.business_model]}{p.business_model === "gestion" && ` · ${Math.round(p.agency_pct * 100)} %`}</span>}
          {ownerName && <span>Propietario: {ownerName}</span>}
        </span>
      }
    >
      <Button variant="onDark" icon={<Pencil size={16} />} onClick={onEdit}>Editar</Button>
      {children}
    </PageBanner>
  );
}

function FichaVenta({ p, ownerName, onEdit }: { p: Property; ownerName?: string; onEdit: () => void }) {
  const m2 = eurM2(p);
  return (
    <>
      <Banner p={p} ownerName={ownerName} onEdit={onEdit} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge status={p.status} />
        <TagEditor property={p} />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Precio de venta" value={p.price != null ? eur0f(p.price) : "—"} icon={<Euro size={16} />} tone="ingreso">{STATUS[p.status].label}</Kpi>
        <Kpi label="Precio por m²" value={m2 != null ? eur0f(m2) : "—"} icon={<Ruler size={16} />}>{p.built_m2 != null ? `${numf(p.built_m2)} m² construidos` : "Faltan los m²"}</Kpi>
        <Kpi label="Actualizada" value={datef(p.updated_at)} icon={<CalendarCheck size={16} />} />
      </div>
      <Card className="mt-5" title="Datos">
        <Datos p={p} ownerName={ownerName} />
      </Card>
    </>
  );
}

function FichaAlquiler({ p, ownerName, tabInicial, onEdit }: { p: Property; ownerName?: string; tabInicial: Tab | null; onEdit: () => void }) {
  const { db } = useData();
  const porHabitaciones = p.category === "habitaciones";
  const [tabElegida, setTab] = useState<Tab>(tabInicial ?? (porHabitaciones ? "habitaciones" : "resumen"));
  const [year, setYear] = useState(Number(todayISO().slice(0, 4)));
  const [nueva, setNueva] = useState(false);

  const rows = resumenAnual(p, db.bookings, db.monthly_costs, year);
  const tot = totalAnual(rows);
  const margen = r2(rows.reduce((a, r) => a + margenAgencia(p, r), 0));
  const hoy = todayISO();
  // Año en curso: hasta hoy incluido; años cerrados: año completo.
  const fin = year === yearOf(hoy) ? new Date(Date.parse(hoy) + 86_400_000).toISOString().slice(0, 10) : `${year + 1}-01-01`;
  const ocup = ocupacion(p.id, db.bookings, `${year}-01-01`, fin);
  const reservas = db.bookings.filter((b) => b.property_id === p.id && yearOf(b.month) === year).sort((a, b) => b.check_in.localeCompare(a.check_in));
  const rooms = habitacionesDe(db, p.id);
  const hab = resumenHabitaciones(rooms);
  const porRenovar = rooms.filter((r) => (diasFinContrato(r, hoy) ?? Infinity) <= AVISO_DIAS).length;
  const tabs: { value: Tab; label: string }[] = [
    ...(porHabitaciones ? [{ value: "habitaciones" as Tab, label: `Habitaciones (${rooms.length})` }] : []),
    { value: "resumen", label: "Resumen anual" },
    { value: "reservas", label: `Reservas (${reservas.length})` },
    ...(p.business_model === "subarriendo" ? [{ value: "gastos" as Tab, label: "Gastos fijos" }] : []),
    { value: "datos", label: "Datos" },
  ];
  // Una pestaña pedida por URL que esta propiedad no tiene → la primera.
  const tab = tabs.some((t) => t.value === tabElegida) ? tabElegida : tabs[0].value;

  function exportarReservas() {
    downloadCSV(
      `reservas-${p.name}-${year}`,
      CSV_COLUMNS,
      reservas.map((b) => [p.name, MESES[month0Of(b.month)], datef(b.check_in), datef(b.check_out), CHANNEL[b.channel].label, b.booking_ref, b.guest_name, b.price, b.payout, b.platform_fee, b.cleaning, b.vat, b.net_profit, b.invoiced ? "Sí" : "No"]),
    );
  }

  return (
    <>
      <Banner p={p} ownerName={ownerName} onEdit={onEdit}>
        <Button icon={<CalendarPlus size={16} />} onClick={() => setNueva(true)}>Nueva reserva</Button>
      </Banner>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={p.status} />
          <TagEditor property={p} />
        </div>
        {tab !== "habitaciones" && <YearNav year={year} onChange={setYear} />}
      </div>

      {porHabitaciones ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Ocupación" value={pctf(hab.total ? hab.alquiladas / hab.total : null)} icon={<Percent size={16} />} tone="ocupacion">
            {hab.alquiladas} de {hab.total} habitaciones alquiladas
          </Kpi>
          <Kpi label="Renta mensual" value={eur0f(hab.renta)} icon={<Euro size={16} />} tone="ingreso">De {eur0f(hab.potencial)} con todas alquiladas</Kpi>
          <Kpi label="Libres" value={hab.libres} icon={<DoorOpen size={16} />} tone={hab.libres ? "ingreso" : "ink"}>
            {hab.libres ? `${eur0f(hab.porAlquilar)} /mes por alquilar` : "Todo ocupado"}{hab.reservadas ? ` · ${hab.reservadas} ${hab.reservadas === 1 ? "reservada" : "reservadas"}` : ""}
          </Kpi>
          <Kpi label="Contratos por renovar" value={porRenovar} icon={<CalendarClock size={16} />} tone={porRenovar ? "gasto" : "ink"}>
            Terminan en {AVISO_DIAS} días o ya vencidos
          </Kpi>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Ingresos (precio)" value={eurf(tot.total)} icon={<Euro size={16} />} tone="ingreso">{tot.reservas} {tot.reservas === 1 ? "reserva" : "reservas"} en {year}</Kpi>
          <Kpi label="Beneficio reservas" value={eurf(tot.beneficio)} icon={<TrendingUp size={16} />} tone="beneficio">Tras comisión y limpieza</Kpi>
          <Kpi label={p.business_model === "gestion" ? "Parte agencia (C/I)" : "Balance agencia"} value={eurf(margen)} icon={<Euro size={16} />} tone={margen < 0 ? "gasto" : "ingreso"}>
            {p.business_model === "gestion" ? `Pago a propietario: ${eurf(tot.pagoPropietario)}` : `Sobre beneficio: ${pctf(tot.pct)}`}
          </Kpi>
          <Kpi label="Ocupación" value={pctf(ocup)} icon={<Percent size={16} />} tone="ocupacion">{year === yearOf(hoy) ? `Del 1 ene al ${datef(hoy)}` : `Año ${year}`}</Kpi>
        </div>
      )}

      <Card className="mt-5">
        <Tabs value={tab} onChange={setTab} items={tabs} />
        {tab === "habitaciones" && <RoomsGrid p={p} />}
        {tab === "resumen" && <ResumenAnual p={p} year={year} />}
        {tab === "reservas" && (
          <>
            {reservas.length > 0 && (
              <div className="-mt-1 mb-3 flex justify-end">
                <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={exportarReservas}>Exportar reservas</Button>
              </div>
            )}
            <div className="-mx-4 md:-mx-5"><BookingsTable bookings={reservas} showProperty={false} /></div>
          </>
        )}
        {tab === "gastos" && (
          <>
            <p className="mb-3 text-sm text-ink-2">Alquiler pagado al propietario y suministros de {year}. Se guardan al salir de cada casilla y se reflejan en el Resumen anual.</p>
            <MonthlyCostsEditor p={p} year={year} />
          </>
        )}
        {tab === "datos" && <Datos p={p} ownerName={ownerName} />}
      </Card>

      {nueva && <BookingForm propertyId={p.id} onClose={() => setNueva(false)} />}
    </>
  );
}

function Datos({ p, ownerName }: { p: Property; ownerName?: string }) {
  const router = useRouter();
  const { db, remove } = useData();
  const [confirmDel, setConfirmDel] = useState(false);
  const venta = p.category === "venta";
  const porHabitaciones = p.category === "habitaciones";
  const filas: [string, string][] = [
    ["Categoría", CATEGORY[p.category].label],
    ["Código", p.code ?? "—"],
    ["Tipo", p.type],
    ["Dirección", p.address ?? "—"],
    ["Ciudad", p.city ?? "—"],
    porHabitaciones
      ? ["Renta mensual (habitaciones alquiladas)", eurf(resumenHabitaciones(habitacionesDe(db, p.id)).renta)]
      : [venta ? "Precio de venta" : "Precio /mes", p.price != null ? eurf(p.price) : "—"],
    ["Habitaciones", numf(p.bedrooms)],
    ["Baños", numf(p.bathrooms)],
    ["m² construidos / útiles", `${numf(p.built_m2)} / ${numf(p.useful_m2)}`],
    ["Propietario", ownerName ?? "—"],
    ...(venta
      ? []
      : ([
          ["Modelo", MODEL[p.business_model]],
          ["% agencia", p.business_model === "gestion" ? pctf(p.agency_pct) : "—"],
          ["Limpieza por defecto", eurf(p.default_cleaning)],
          ["Limpieza al propietario", p.business_model === "gestion" ? (p.cleaning_by_owner ? "Sí" : "No") : "—"],
        ] as [string, string][])),
    ["Actualizada", datef(p.updated_at)],
  ];

  return (
    <div>
      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {filas.map(([k, v]) => (
          <div key={k} className="border-b border-line pb-2">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="num mt-0.5 font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {confirmDel ? (
          <>
            <span className="text-sm text-ink-2">{venta ? "Se borrará la propiedad." : porHabitaciones ? "Se borrarán también sus habitaciones, reservas y gastos fijos." : "Se borrarán también sus reservas y gastos fijos."} ¿Seguro?</span>
            <Button variant="danger" size="sm" onClick={async () => { await remove("properties", p.id); router.push(`/#${p.category}`); }}>Sí, eliminar</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDel(false)}>Cancelar</Button>
          </>
        ) : (
          <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setConfirmDel(true)}>Eliminar propiedad</Button>
        )}
      </div>
    </div>
  );
}
