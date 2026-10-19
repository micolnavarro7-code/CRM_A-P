// Lógica de negocio. Mismas fórmulas que la vista v_resumen_mensual del esquema SQL.

import { MESES, monthISO, nights, r2, yearOf } from "./format";
import type { Booking, DB, MonthlyCost, Property, TxKind, TxStatus } from "./types";

export const IVA = 0.21;

export type FilaResumen = {
  mes: number; // 0 = enero
  reservas: number;
  total: number;
  comision: number;
  limpieza: number;
  beneficio: number;
  // Gestión
  parteAgencia: number; // = FACT C/I
  factSI: number;
  pagoPropietario: number;
  // Subarriendo
  alquiler: number;
  luz: number;
  agua: number;
  internet: number;
  balance: number;
  pct: number | null; // balance / beneficio; null si beneficio = 0
};

/** Beneficio neto por defecto de una reserva. */
export const beneficioReserva = (b: Pick<Booking, "payout" | "cleaning">) => r2(b.payout - b.cleaning);

/** Resumen de 12 meses para una propiedad y año. */
export function resumenAnual(p: Property, bookings: Booking[], costs: MonthlyCost[], year: number): FilaResumen[] {
  const bs = bookings.filter((b) => b.property_id === p.id && yearOf(b.month) === year);
  const cs = costs.filter((c) => c.property_id === p.id && yearOf(c.month) === year);
  return MESES.map((_, mes) => {
    const key = monthISO(year, mes);
    const delMes = bs.filter((b) => b.month === key);
    const c = cs.find((x) => x.month === key);
    const sum = (k: "price" | "platform_fee" | "cleaning" | "net_profit") => r2(delMes.reduce((a, b) => a + b[k], 0));
    const total = sum("price");
    const comision = sum("platform_fee");
    const limpieza = sum("cleaning");
    const beneficio = sum("net_profit");
    const parteAgencia = p.business_model === "gestion" ? r2(beneficio * p.agency_pct) : 0;
    const alquiler = c?.rent ?? 0;
    const luz = c?.electricity ?? 0;
    const agua = c?.water ?? 0;
    const internet = c?.internet ?? 0;
    const balance = r2(beneficio - alquiler - luz - agua - internet);
    return {
      mes,
      reservas: delMes.length,
      total,
      comision,
      limpieza,
      beneficio,
      parteAgencia,
      factSI: r2(parteAgencia / (1 + IVA)),
      pagoPropietario: p.business_model === "gestion" ? r2(beneficio - parteAgencia + (p.cleaning_by_owner ? limpieza : 0)) : alquiler,
      alquiler,
      luz,
      agua,
      internet,
      balance,
      pct: beneficio ? balance / beneficio : null,
    };
  });
}

type NumKeys = { [K in keyof FilaResumen]: FilaResumen[K] extends number ? K : never }[keyof FilaResumen];

/** Fila TOTAL: suma real de los 12 meses; el % se recalcula sobre los totales. */
export function totalAnual(rows: FilaResumen[]): Omit<FilaResumen, "mes"> {
  const s = (k: NumKeys) => r2(rows.reduce((a, r) => a + (r[k] as number), 0));
  const beneficio = s("beneficio");
  const balance = s("balance");
  return {
    reservas: s("reservas"),
    total: s("total"),
    comision: s("comision"),
    limpieza: s("limpieza"),
    beneficio,
    parteAgencia: s("parteAgencia"),
    factSI: s("factSI"),
    pagoPropietario: s("pagoPropietario"),
    alquiler: s("alquiler"),
    luz: s("luz"),
    agua: s("agua"),
    internet: s("internet"),
    balance,
    pct: beneficio ? balance / beneficio : null,
  };
}

/** Margen que se queda la agencia en un mes, según el modelo. */
export const margenAgencia = (p: Property, f: FilaResumen) =>
  p.business_model === "gestion" ? f.parteAgencia : f.balance;

/** Noches ocupadas dentro de [from, to) — recorta estancias que cruzan el rango. */
export function nochesOcupadas(bookings: Booking[], from: string, to: string) {
  return bookings.reduce((a, b) => {
    const s = b.check_in > from ? b.check_in : from;
    const e = b.check_out < to ? b.check_out : to;
    return a + Math.max(0, nights(s, e));
  }, 0);
}

/** Ocupación (0..1) de una propiedad en [from, to). */
export function ocupacion(propertyId: string, bookings: Booking[], from: string, to: string) {
  const total = nights(from, to);
  if (total <= 0) return 0;
  return nochesOcupadas(bookings.filter((b) => b.property_id === propertyId), from, to) / total;
}


// ---------------------------------------------------------------------
// Libro de movimientos (P&L) desde el punto de vista de la agencia.
//   Ingresos: precio de cada reserva + ingresos manuales.
//   Gastos:   comisión plataforma, limpieza (si no la cobra el propietario),
//             liquidación al propietario (gestión), alquiler y suministros
//             (subarriendo), gastos manuales y de mantenimiento.
//   Resultado = parte agencia (gestión) o balance (subarriendo) − gastos propios.
// ---------------------------------------------------------------------
export type Movimiento = {
  id: string;
  date: string;
  property_id: string | null;
  kind: TxKind;
  category: string;
  concept: string;
  amount: number;
  status: TxStatus;
  origen: "reserva" | "resumen" | "manual" | "mantenimiento" | "banco";
  contact_id: string | null;
};

export function movimientos(db: DB, year: number): Movimiento[] {
  const out: Movimiento[] = [];
  const props = new Map(db.properties.map((p) => [p.id, p]));

  for (const b of db.bookings) {
    if (yearOf(b.month) !== year) continue;
    const p = props.get(b.property_id);
    if (!p) continue;
    const status: TxStatus = b.invoiced ? "conciliado" : "pendiente";
    const base = { property_id: b.property_id, status, contact_id: b.guest_id, date: b.check_in };
    const canal = b.channel === "propia" ? "Propia" : b.channel === "booking" ? "Booking" : "Airbnb";
    out.push({ ...base, id: `${b.id}:i`, kind: "ingreso", category: "Reservas", concept: `Reserva ${canal} ${b.booking_ref ?? ""}`.trim(), amount: b.price, origen: "reserva" });
    if (b.platform_fee) out.push({ ...base, id: `${b.id}:c`, kind: "gasto", category: "Comisión plataforma", concept: `Comisión ${canal}`, amount: b.platform_fee, origen: "reserva" });
    if (b.cleaning && !(p.business_model === "gestion" && p.cleaning_by_owner))
      out.push({ ...base, id: `${b.id}:l`, kind: "gasto", category: "Limpieza", concept: "Limpieza salida", amount: b.cleaning, origen: "reserva" });
  }

  for (const p of db.properties) {
    const rows = resumenAnual(p, db.bookings, db.monthly_costs, year);
    for (const f of rows) {
      const date = monthISO(year, f.mes);
      const base = { property_id: p.id, status: "conciliado" as TxStatus, contact_id: p.owner_id, origen: "resumen" as const, kind: "gasto" as TxKind, date };
      if (p.business_model === "gestion" && f.pagoPropietario)
        out.push({ ...base, id: `${p.id}:${date}:prop`, category: "Liquidación propietario", concept: `Liquidación ${MESES[f.mes].toLowerCase()}`, amount: f.pagoPropietario });
      if (p.business_model === "subarriendo") {
        const g: [string, number][] = [["Alquiler", f.alquiler], ["Luz", f.luz], ["Agua", f.agua], ["Internet", f.internet]];
        for (const [cat, v] of g)
          if (v) out.push({ ...base, id: `${p.id}:${date}:${cat}`, category: cat, concept: `${cat} ${MESES[f.mes].toLowerCase()}`, amount: v });
      }
    }
  }

  for (const t of db.transactions) {
    if (yearOf(t.date) !== year) continue;
    out.push({ id: t.id, date: t.date, property_id: t.property_id, kind: t.kind, category: t.category, concept: t.concept, amount: t.amount, status: t.status, origen: t.source, contact_id: t.contact_id });
  }

  return out.sort((a, b) => b.date.localeCompare(a.date));
}

/** Suma de movimientos por tipo. */
export function sumaMov(ms: Movimiento[], kind: TxKind) {
  return r2(ms.filter((m) => m.kind === kind).reduce((a, m) => a + m.amount, 0));
}

