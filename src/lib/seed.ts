// Datos de ejemplo. Las reservas se generan repartiendo los totales mensuales
// reales de los Excel 2026, de modo que el "Resumen anual" de cada propiedad
// reproduce esas cifras. Nombres de huéspedes y nº de reserva son ficticios.

import { monthISO, r2, uid } from "./format";
import type { Booking, Channel, Contact, DB, MonthlyCost, Property, Room } from "./types";

// PRNG determinista para que la semilla sea siempre igual.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Reparte `total` en partes según pesos, cuadrando el redondeo en la última. */
function split(total: number, weights: number[]) {
  const w = weights.reduce((a, b) => a + b, 0);
  if (!w) return weights.map(() => 0);
  const parts = weights.map((x) => r2((total * x) / w));
  parts[parts.length - 1] = r2(total - parts.slice(0, -1).reduce((a, b) => a + b, 0));
  return parts;
}

const ID = {
  laxe: "00000000-0000-4000-8000-0000000000a1",
  cuellar: "00000000-0000-4000-8000-0000000000a2",
  denia: "00000000-0000-4000-8000-0000000000a3",
  fuencisla: "00000000-0000-4000-8000-0000000000b1",
  propLaxe: "00000000-0000-4000-8000-0000000000b2",
  arrendDenia: "00000000-0000-4000-8000-0000000000b3",
};

const HUESPEDES = [
  "Laura Gómez", "Marc Dubois", "Sofía Martín", "Jan Kowalski", "Lucía Fernández", "Tom Becker",
  "Ana Ruiz", "Pablo Iglesias Rey", "Emma Rossi", "Diego Torres", "Claire Martin", "Hugo Sanz",
  "Nerea López", "Oliver Smith", "Irene Castro", "Mateo Díaz", "Julia Weber", "Álvaro Moreno",
];

const contacto = (id: string, type: Contact["type"], name: string, extra: Partial<Contact> = {}): Contact => ({
  id, type, name, email: null, phone: null, nif: null, iban: null, category: null, notes: null, ...extra,
});

const propiedad = (p: Partial<Property> & Pick<Property, "id" | "name" | "code" | "city" | "business_model">): Property => ({
  category: "turistico",
  address: null,
  type: "Piso",
  status: "disponible",
  price: null,
  bedrooms: null,
  bathrooms: null,
  built_m2: null,
  useful_m2: null,
  owner_id: null,
  agency_pct: 0,
  cleaning_by_owner: false,
  default_cleaning: 60,
  photo_url: null,
  tags: [],
  updated_at: "2026-09-01",
  ...p,
});

// Totales mensuales reales 2026 (enero..agosto).
// Gestión: [total, comisión, limpieza]
const CUELLAR: [number, number, number][] = [
  [2182.23, 302.86, 299.25], [1561.72, 156.77, 267.4], [1822.6, 286.35, 165.55], [2029.06, 323.22, 248.33],
  [2500.81, 396.72, 332.95], [1242.67, 188.01, 208.33], [1917.17, 214.7, 263.33], [3352.59, 536.72, 286.39],
];
const LAXE: [number, number, number][] = [
  [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
  [1323.15, 215.67, 229.65], [15562.2, 114.3, 541.67],
];
// Subarriendo: [total, beneficio]
const DENIA: [number, number][] = [
  [2224.6, 1059.75], [1926.38, 837.25], [2752.4, 1603.54], [1907.9, 823.47],
  [3256.19, 2008.71], [4396.78, 2080.4], [6378.66, 3859.06], [7920.1, 5305.54],
];
// Dénia: [alquiler, luz, agua, internet] enero..diciembre
const DENIA_COSTES: [number, number, number, number][] = [
  [450, 121.33, 47.19, 0], [450, 201.13, 0, 0], [450, 68.92, 53.89, 8.57], [900, 159.41, 0, 10],
  [675, 77.04, 52.77, 10], [1275, 144.43, 0, 10], [3200, 214.35, 61.57, 10], [3200, 271.11, 0, 10],
  [1275, 0, 0, 10], [450, 0, 0, 10], [450, 0, 0, 10], [450, 0, 0, 10],
];

const DIAS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

// ---------------------------------------------------------------------
// Alquiler por habitaciones: dos pisos de ejemplo (etiqueta «Ejemplo»),
// con habitaciones alquiladas, reservadas y libres.
// ---------------------------------------------------------------------
const EJEMPLO = { label: "Ejemplo", color: "#64748B" };
const HAB = { malasana: "00000000-0000-4000-8000-0000000000c1", ruzafa: "00000000-0000-4000-8000-0000000000c2" };

type H = [name: string, rent: number, m2: number, bano: boolean, status: Room["status"], tenant?: string, desde?: string, hasta?: string, contrato?: boolean, notes?: string];
const habitacion = (property_id: string, [name, rent, size_m2, private_bath, status, tenant, desde, hasta, contrato, notes]: H): Room => ({
  id: uid(), property_id, name, status, rent, size_m2, private_bath, contract_done: !!contrato,
  tenant_name: tenant ?? null, start_date: desde ?? null, end_date: hasta ?? null, notes: notes ?? null,
});

export function ejemplosHabitaciones(): { properties: Property[]; rooms: Room[] } {
  return {
    properties: [
      propiedad({
        id: HAB.malasana, category: "habitaciones", code: "MAD-H1", name: "Piso Malasaña", city: "Madrid", address: "Malasaña, Madrid",
        business_model: "subarriendo", bedrooms: 5, bathrooms: 2, built_m2: 120, tags: [EJEMPLO],
      }),
      propiedad({
        id: HAB.ruzafa, category: "habitaciones", code: "VAL-H1", name: "Piso Ruzafa", city: "Valencia", address: "Ruzafa, Valencia",
        business_model: "gestion", agency_pct: 0.2, bedrooms: 4, bathrooms: 2, built_m2: 95, tags: [EJEMPLO],
      }),
    ],
    rooms: [
      ...([
        ["Habitación 1 · exterior", 520, 14, true, "alquilada", "Lucía Fernández", "2026-02-01", "2027-01-31", true],
        ["Habitación 2", 450, 11, false, "alquilada", "Marc Dubois", "2026-09-01", "2027-06-30", false, "Entró en septiembre: falta firmar el contrato."],
        ["Habitación 3", 430, 10, false, "alquilada", "Sofía Martín", "2025-10-01", "2026-11-15", true],
        ["Habitación 4", 400, 9, false, "libre", undefined, undefined, undefined, false, "Recién pintada. Lista para entrar."],
        ["Habitación 5", 380, 8, false, "reservada", "Jan Kowalski", "2026-11-01", "2027-07-31", false, "Señal de 200 € pagada."],
      ] as H[]).map((h) => habitacion(HAB.malasana, h)),
      ...([
        ["Habitación 1", 420, 12, false, "alquilada", "Emma Rossi", "2026-01-15", "2026-12-31", true],
        ["Habitación 2", 390, 10, false, "alquilada", "Diego Torres", "2026-03-01", "2027-02-28", true],
        ["Habitación 3", 360, 9, false, "libre"],
        ["Habitación 4 · con balcón", 450, 13, true, "alquilada", "Julia Weber", "2026-09-01", "2027-06-30", true],
      ] as H[]).map((h) => habitacion(HAB.ruzafa, h)),
    ],
  };
}

function reservasDelMes(
  rand: () => number,
  propertyId: string,
  year: number,
  m: number,
  total: number,
  comision: number,
  limpieza: number,
  seq: { n: number },
): Booking[] {
  if (!total) return [];
  const n = Math.min(6, Math.max(2, Math.round(total / 900)));
  const channels: Channel[] = Array.from({ length: n }, (_, i) => (i % 3 === 0 ? "booking" : i % 3 === 1 ? "airbnb" : "propia"));
  // Si la comisión es muy baja respecto al total, casi todo son reservas propias.
  if (comision < total * 0.03) channels.forEach((_, i) => (channels[i] = i === 0 ? "booking" : "propia"));
  const pesos = channels.map(() => 0.6 + rand());
  const precios = split(total, pesos);
  const comisiones = split(comision, channels.map((c, i) => (c === "propia" ? 0 : precios[i])));
  const limpiezas = split(limpieza, channels.map(() => 1));

  // Estancias consecutivas dentro del mes, proporcionales al precio.
  const dias = DIAS[m];
  const libres = dias - n; // un día de hueco entre estancias
  const noches = split(Math.max(n, Math.min(libres, Math.round(libres * (0.55 + rand() * 0.4)))), pesos).map((x) => Math.max(1, Math.round(x)));
  let dia = 1;
  return channels.map((channel, i) => {
    const inicio = Math.min(dia, dias - 1);
    const fin = Math.min(inicio + noches[i], dias);
    dia = fin + 1;
    const pad = (d: number) => String(d).padStart(2, "0");
    const checkIn = `${year}-${pad(m + 1)}-${pad(inicio)}`;
    const checkOut = fin >= dias ? monthISO(m === 11 ? year + 1 : year, (m + 1) % 12) : `${year}-${pad(m + 1)}-${pad(fin)}`;
    const payout = r2(precios[i] - comisiones[i]);
    seq.n++;
    return {
      id: uid(),
      property_id: propertyId,
      guest_id: null,
      guest_name: HUESPEDES[Math.floor(rand() * HUESPEDES.length)],
      channel,
      booking_ref: channel === "propia" ? null : channel === "booking" ? String(4_100_000_000 + seq.n * 7919) : `HM${(seq.n * 104729).toString(36).toUpperCase().padStart(8, "X")}`,
      check_in: checkIn,
      check_out: checkOut,
      month: monthISO(year, m),
      price: precios[i],
      payout,
      platform_fee: comisiones[i],
      cleaning: limpiezas[i],
      vat: 0,
      net_profit: r2(payout - limpiezas[i]),
      invoiced: m < 7, // agosto aún sin facturar
      notes: null,
    };
  });
}

export function buildSeed(): DB {
  const rand = rng(2026);
  const seq = { n: 0 };
  const year = 2026;
  const bookings: Booking[] = [];

  CUELLAR.forEach(([t, c, l], m) => bookings.push(...reservasDelMes(rand, ID.cuellar, year, m, t, c, l, seq)));
  LAXE.forEach(([t, c, l], m) => bookings.push(...reservasDelMes(rand, ID.laxe, year, m, t, c, l, seq)));
  DENIA.forEach(([t, ben], m) => {
    // El Excel de Dénia solo trae total y beneficio: repartimos la diferencia
    // entre limpieza (~60 € por salida) y comisión de plataforma.
    const n = Math.min(6, Math.max(2, Math.round(t / 900)));
    const dif = r2(t - ben);
    const limpieza = Math.min(r2(n * 60), r2(dif * 0.4));
    bookings.push(...reservasDelMes(rand, ID.denia, year, m, t, r2(dif - limpieza), limpieza, seq));
  });

  const monthly_costs: MonthlyCost[] = DENIA_COSTES.map(([rent, electricity, water, internet], m) => ({
    id: uid(),
    property_id: ID.denia,
    month: monthISO(year, m),
    rent, electricity, water, internet,
  }));
  const hab = ejemplosHabitaciones();

  return {
    contacts: [
      contacto(ID.fuencisla, "propietario", "María Fuencisla", { notes: "Propietaria de Cuéllar. Reparto 50 %; la limpieza se le abona a ella." }),
      contacto(ID.propLaxe, "propietario", "Propietario de Laxe", { notes: "Completar datos." }),
      contacto(ID.arrendDenia, "propietario", "Arrendador de Dénia", { notes: "Subarriendo: le pagamos un alquiler mensual variable." }),
    ],
    properties: [
      propiedad({
        id: ID.laxe, code: "LAX-01", name: "Laxe", city: "Laxe, A Coruña", address: "Laxe, A Coruña",
        business_model: "gestion", agency_pct: 0.25, cleaning_by_owner: false, owner_id: ID.propLaxe,
        tags: [{ label: "Costa", color: "#0EA5E9" }, { label: "Temporada verano", color: "#F59E0B" }],
      }),
      propiedad({
        id: ID.cuellar, code: "CUE-01", name: "Cuéllar", city: "Cuéllar, Segovia", address: "Cuéllar, Segovia",
        business_model: "gestion", agency_pct: 0.5, cleaning_by_owner: true, owner_id: ID.fuencisla,
        tags: [{ label: "Todo el año", color: "#16A34A" }],
      }),
      propiedad({
        id: ID.denia, code: "DEN-01", name: "Dénia", city: "Dénia, Alicante", address: "Dénia, Alicante",
        business_model: "subarriendo", owner_id: ID.arrendDenia,
        tags: [{ label: "Costa", color: "#0EA5E9" }, { label: "Subarriendo", color: "#8B5CF6" }],
      }),
      ...hab.properties,
    ],
    rooms: hab.rooms,
    bookings,
    monthly_costs,
    transactions: [],
    commissions: [],
    deposits: [],
    invoices: [],
    remittances: [],
    maintenance_tickets: [],
    documents: [],
  };
}
