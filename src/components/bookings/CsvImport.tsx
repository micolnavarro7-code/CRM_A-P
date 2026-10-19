"use client";

import { datef, eurf, monthOf, r2, uid } from "@/lib/format";
import { normKey, parseBool, parseDate, parseNum } from "@/lib/export";
import { useData } from "@/lib/store";
import type { Booking, Channel, DB } from "@/lib/types";
import { ChannelChip } from "../domain";
import { CsvImporter, type ImportSpec, type Pick } from "../import/CsvImporter";

export const CSV_COLUMNS = ["Propiedad", "Mes", "Entrada", "Salida", "Canal", "Nº Reserva", "Huésped", "Precio", "Ingreso", "Comisión", "Limpieza", "IVA", "Beneficio", "Facturado"];

// Alias aceptados por columna (ya normalizados).
export const ALIAS: Record<string, string[]> = {
  propiedad: ["propiedad", "piso", "inmueble", "codigo"],
  mes: ["mes", "mes_contable"],
  entrada: ["entrada", "check_in", "llegada", "fecha_entrada"],
  salida: ["salida", "check_out", "fecha_salida"],
  canal: ["canal", "plataforma", "origen"],
  ref: ["n_reserva", "no_reserva", "num_reserva", "reserva", "referencia", "booking_ref"],
  huesped: ["huesped", "cliente", "nombre"],
  precio: ["precio", "total", "importe"],
  ingreso: ["ingreso", "payout", "liquidacion"],
  comision: ["comision", "comision_plataforma"],
  limpieza: ["limpieza"],
  iva: ["iva"],
  beneficio: ["beneficio", "beneficio_neto", "neto"],
  facturado: ["facturado"],
};

const MES_NOMBRE = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function parseMonth(v: string | undefined, year: string, fallback: string | null) {
  if (!v) return fallback;
  const s = normKey(v);
  const i = MES_NOMBRE.findIndex((m) => s.startsWith(m.slice(0, 3)));
  if (i >= 0) return `${year}-${String(i + 1).padStart(2, "0")}-01`;
  const d = parseDate(v) ?? (/^\d{4}-\d{2}$/.test(v.trim()) ? `${v.trim()}-01` : null);
  return d ? monthOf(d) : fallback;
}

export function parseBookings(rows: Pick[], db: DB): (Booking | string)[] {
  const findProperty = (v: string) => {
    const n = normKey(v);
    return db.properties.find((p) => p.category !== "venta" && (normKey(p.name) === n || (p.code && normKey(p.code) === n)));
  };

  return rows.map((pick): Booking | string => {
    const prop = findProperty(pick("propiedad") ?? "");
    if (!prop) return `Propiedad «${pick("propiedad") ?? ""}» no encontrada`;
    const inD = parseDate(pick("entrada"));
    const outD = parseDate(pick("salida"));
    if (!inD || !outD) return "Fechas de entrada/salida no válidas (usa DD/MM/AAAA)";
    const canalRaw = normKey(pick("canal") ?? "");
    const channel: Channel | null = canalRaw.startsWith("book") ? "booking" : canalRaw.startsWith("air") ? "airbnb" : canalRaw.startsWith("prop") || canalRaw.startsWith("direct") ? "propia" : null;
    if (!channel) return `Canal «${pick("canal") ?? ""}» no reconocido (Booking, Airbnb o Propia)`;
    const price = parseNum(pick("precio")) ?? 0;
    const fee = parseNum(pick("comision")) ?? 0;
    const payout = parseNum(pick("ingreso")) ?? r2(price - fee);
    const cleaning = parseNum(pick("limpieza")) ?? 0;
    const net = parseNum(pick("beneficio")) ?? r2(payout - cleaning);
    return {
      id: uid(), property_id: prop.id, guest_id: null, guest_name: pick("huesped") ?? null, channel,
      booking_ref: pick("ref") ?? null, check_in: inD, check_out: outD,
      month: parseMonth(pick("mes"), inD.slice(0, 4), monthOf(inD))!,
      price, payout, platform_fee: fee, cleaning, vat: parseNum(pick("iva")) ?? 0, net_profit: net,
      invoiced: parseBool(pick("facturado")), notes: null,
    };
  });
}

export function CsvImport({ onClose }: { onClose: () => void }) {
  const { db, insert } = useData();

  const ejemplo = db.properties.find((p) => p.category !== "venta")?.name ?? "Laxe";
  const spec: ImportSpec<Booking> = {
    title: "Importar reservas desde CSV",
    noun: ["reserva", "reservas"],
    columns: CSV_COLUMNS,
    alias: ALIAS,
    help: "La propiedad se reconoce por nombre o código. Fechas en DD/MM/AAAA e importes con coma decimal. Si faltan Ingreso o Beneficio, se calculan.",
    template: {
      name: "plantilla-reservas",
      rows: [
        [ejemplo, "Julio", "05/07/2026", "12/07/2026", "Booking", "4123456789", "Nombre huésped", 950, 807.5, 142.5, 60, 0, 747.5, "No"],
        [ejemplo, "Julio", "14/07/2026", "18/07/2026", "Propia", "", "Otro huésped", 520, 520, 0, 60, 0, 460, "Sí"],
      ],
    },
    parse: (rows) => parseBookings(rows, db),
    preview: [
      { label: "Propiedad", cell: (b) => db.properties.find((p) => p.id === b.property_id)?.name },
      { label: "Entrada", cell: (b) => datef(b.check_in) },
      { label: "Salida", cell: (b) => datef(b.check_out) },
      { label: "Canal", cell: (b) => <ChannelChip channel={b.channel} /> },
      { label: "Huésped", cell: (b) => b.guest_name },
      { label: "Precio", cell: (b) => eurf(b.price), right: true },
      { label: "Beneficio", cell: (b) => eurf(b.net_profit), right: true },
    ],
    key: (b) => b.id,
    save: (items) => insert("bookings", items),
  };

  return <CsvImporter spec={spec} onClose={onClose} />;
}
