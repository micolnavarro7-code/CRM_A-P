import { margenAgencia, ocupacion, resumenAnual, totalAnual } from "./calc";
import { nights, r2, todayISO } from "./format";
import type { DB, Property, Room } from "./types";

/** Habitaciones de un piso, en orden natural (Habitación 2 antes que Habitación 10). */
export const habitacionesDe = (db: DB, propertyId: string) =>
  db.rooms.filter((r) => r.property_id === propertyId).sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }));

/** Ocupación y renta de un conjunto de habitaciones. */
export function resumenHabitaciones(rooms: Room[]) {
  const alquiladas = rooms.filter((r) => r.status === "alquilada");
  const libres = rooms.filter((r) => r.status === "libre");
  return {
    total: rooms.length,
    alquiladas: alquiladas.length,
    reservadas: rooms.filter((r) => r.status === "reservada").length,
    libres: libres.length,
    /** Lo que se cobra ahora cada mes. */
    renta: r2(alquiladas.reduce((a, r) => a + r.rent, 0)),
    /** Renta de las habitaciones libres. */
    porAlquilar: r2(libres.reduce((a, r) => a + r.rent, 0)),
    /** Lo que se cobraría con todas alquiladas. */
    potencial: r2(rooms.reduce((a, r) => a + r.rent, 0)),
  };
}
export type ResumenHabitaciones = ReturnType<typeof resumenHabitaciones>;

/** Avisar cuando a un contrato le quedan estos días o menos. */
export const AVISO_DIAS = 45;

/** Días hasta el fin de contrato de una habitación ocupada (negativo si ya venció); null si no aplica. */
export function diasFinContrato(r: Room, today = todayISO()) {
  if (r.status === "libre" || !r.end_date) return null;
  return nights(today, r.end_date);
}

// ---------------------------------------------------------------------
// Contratos: uno por habitación alquilada o reservada.
// ---------------------------------------------------------------------
export type Contrato = { room: Room; property: Property; dias: number | null };

/** Contratos ordenados por urgencia: pendientes, vencidos, por vencer y el resto por fecha de fin. */
export function contratos(db: DB, today = todayISO()): Contrato[] {
  const props = new Map(db.properties.map((p) => [p.id, p]));
  const prioridad = (c: Contrato) => (!c.room.contract_done ? 0 : c.dias != null && c.dias < 0 ? 1 : c.dias != null && c.dias <= AVISO_DIAS ? 2 : 3);
  return db.rooms
    .filter((r) => r.status !== "libre" && props.has(r.property_id))
    .map((room) => ({ room, property: props.get(room.property_id)!, dias: diasFinContrato(room, today) }))
    .sort((a, b) => prioridad(a) - prioridad(b) || (a.room.end_date ?? "9999").localeCompare(b.room.end_date ?? "9999"));
}

export function resumenContratos(cs: Contrato[]) {
  return {
    total: cs.length,
    hechos: cs.filter((c) => c.room.contract_done).length,
    pendientes: cs.filter((c) => !c.room.contract_done).length,
    porVencer: cs.filter((c) => c.dias != null && c.dias >= 0 && c.dias <= AVISO_DIAS).length,
    vencidos: cs.filter((c) => c.dias != null && c.dias < 0).length,
    renta: r2(cs.reduce((a, c) => a + c.room.rent, 0)),
  };
}

/** Cifras de una propiedad para tarjetas y tablas (año en curso, hasta hoy). */
export function statsPropiedad(p: Property, db: DB, today = todayISO()) {
  const year = Number(today.slice(0, 4));
  const rows = resumenAnual(p, db.bookings, db.monthly_costs, year);
  const tot = totalAnual(rows);
  const activos = rows.filter((r) => r.total > 0).length;
  const inicio = `${year}-01-01`;
  const hace90 = new Date(Date.parse(today) - 90 * 86_400_000).toISOString().slice(0, 10);
  const manana = new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10);
  const ocupAnio = ocupacion(p.id, db.bookings, inicio, manana);
  const ocup90 = ocupacion(p.id, db.bookings, hace90, manana);
  return {
    year,
    ingresos: tot.total,
    comisionAgencia: p.business_model === "gestion" ? tot.parteAgencia : 0,
    margen: rows.reduce((a, r) => a + margenAgencia(p, r), 0),
    mediaMensual: activos ? tot.total / activos : null,
    ocupacion: ocupAnio,
    /** Tendencia: últimos 90 días frente a la media del año. */
    tendencia: ocup90 - ocupAnio,
    reservas: tot.reservas,
    habitaciones: resumenHabitaciones(habitacionesDe(db, p.id)),
  };
}
export type StatsPropiedad = ReturnType<typeof statsPropiedad>;
export type ResumenContratos = ReturnType<typeof resumenContratos>;
