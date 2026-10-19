"use client";

import { datef, eurf, uid } from "@/lib/format";
import { normKey, parseBool, parseDate, parseNum } from "@/lib/export";
import { useData } from "@/lib/store";
import type { DB, Room, RoomStatus } from "@/lib/types";
import { CATEGORY, RoomBadge } from "../domain";
import { CsvImporter, type ImportSpec, type Pick } from "../import/CsvImporter";

const COLUMNS = ["Piso", "Habitación", "Estado", "Renta", "m²", "Baño privado", "Inquilino", "Inicio", "Fin", "Contrato hecho", "Notas"];

// Alias aceptados por columna (ya normalizados: «m²» → «m»).
export const ALIAS: Record<string, string[]> = {
  piso: ["piso", "propiedad", "inmueble", "codigo"],
  habitacion: ["habitacion", "nombre_habitacion", "hab"],
  estado: ["estado"],
  renta: ["renta", "precio", "alquiler", "renta_mes"],
  m2: ["m", "m2", "metros", "tamano", "superficie"],
  bano: ["bano_privado", "bano", "bano_propio"],
  inquilino: ["inquilino", "inquilina", "cliente"],
  inicio: ["inicio", "inicio_contrato", "inicio_del_contrato", "fecha_inicio", "entrada", "desde"],
  fin: ["fin", "fin_contrato", "fin_del_contrato", "fecha_fin", "salida", "hasta"],
  contrato: ["contrato_hecho", "contrato", "firmado"],
  notas: ["notas", "observaciones", "comentarios"],
};

function parseStatus(v: string | undefined, tenant: string | undefined): RoomStatus | null {
  const s = normKey(v ?? "");
  // Sin estado: alquilada si tiene inquilino, libre si no.
  if (!s) return tenant ? "alquilada" : "libre";
  if (s.startsWith("alquil") || s.startsWith("ocupad")) return "alquilada";
  if (s.startsWith("reserv")) return "reservada";
  if (s.startsWith("libre") || s.startsWith("disponible") || s.startsWith("vaci")) return "libre";
  return null;
}

const hecho = (v: string | undefined) => parseBool(v) || /^(hech|firmad)/.test(normKey(v ?? ""));

/** Fecha opcional: null si está vacía, false si no se entiende. */
function fecha(v: string | undefined) {
  if (!v) return null;
  return parseDate(v) ?? false;
}

export function parseRooms(rows: Pick[], db: DB): (Room | string)[] {
  const pisos = db.properties.filter((p) => p.category === "habitaciones");
  // Habitaciones ya ocupadas por piso + nombre (las existentes y las de filas anteriores).
  const usadas = new Map(db.rooms.map((r) => [`${r.property_id}|${normKey(r.name)}`, "existe"]));

  return rows.map((pick, i) => {
    const ref = pick("piso") ?? "";
    const n = normKey(ref);
    const igual = (p: { name: string; code: string | null }) => normKey(p.name) === n || (!!p.code && normKey(p.code) === n);
    const piso = pisos.find(igual);
    if (!piso) {
      const otra = db.properties.find(igual);
      return otra
        ? `«${otra.name}» es de ${CATEGORY[otra.category].label}, no de habitaciones: cambia su categoría en la ficha`
        : `Piso «${ref}» no encontrado: impórtalo antes con «Importar propiedades» o créalo`;
    }
    const name = pick("habitacion");
    if (!name) return "Falta el nombre de la habitación";
    const clave = `${piso.id}|${normKey(name)}`;
    const ya = usadas.get(clave);
    if (ya) return ya === "existe" ? `Ya existe «${name}» en ${piso.name}` : `Habitación repetida en el archivo (${ya})`;

    const tenant = pick("inquilino");
    const status = parseStatus(pick("estado"), tenant);
    if (!status) return `Estado «${pick("estado")}» no reconocido (Alquilada, Reservada o Libre)`;
    if (status === "alquilada" && !tenant) return "Falta el inquilino (obligatorio si está alquilada)";
    const start = fecha(pick("inicio"));
    const end = fecha(pick("fin"));
    if (start === false) return `Fecha de inicio «${pick("inicio")}» no válida (usa DD/MM/AAAA)`;
    if (end === false) return `Fecha de fin «${pick("fin")}» no válida (usa DD/MM/AAAA)`;
    const ocupada = status !== "libre";
    if (ocupada && start && end && end < start) return "El fin de contrato no puede ser anterior al inicio";

    usadas.set(clave, `fila ${i + 2}`);
    // Libre: sin inquilino ni contrato, como al dejarla libre desde la ficha.
    return {
      id: uid(), property_id: piso.id, name, status,
      rent: parseNum(pick("renta")) ?? 0, size_m2: parseNum(pick("m2")), private_bath: parseBool(pick("bano")),
      tenant_name: ocupada ? tenant ?? null : null,
      contract_done: ocupada && hecho(pick("contrato")),
      start_date: ocupada ? start : null, end_date: ocupada ? end : null,
      notes: pick("notas") ?? null,
    };
  });
}

export function RoomsImport({ onClose }: { onClose: () => void }) {
  const { db, insert } = useData();

  const ejemplo = db.properties.find((p) => p.category === "habitaciones")?.name ?? "Piso Malasaña";
  const spec: ImportSpec<Room> = {
    title: "Importar habitaciones desde CSV",
    noun: ["habitación", "habitaciones"],
    columns: COLUMNS,
    alias: ALIAS,
    help: (
      <>
        El piso se reconoce por nombre o código y debe ser de la categoría Habitaciones. Estado: Alquilada, Reservada o Libre (si se deja vacío, Alquilada
        cuando hay inquilino). Cada habitación alquilada o reservada es un contrato: renta, inicio y fin son los suyos. Fechas en DD/MM/AAAA; «Contrato hecho»
        y «Baño privado» con Sí o No.
      </>
    ),
    template: {
      name: "plantilla-habitaciones",
      rows: [
        [ejemplo, "Habitación 1 · exterior", "Alquilada", 520, 14, "Sí", "Nombre inquilino", "01/02/2026", "31/01/2027", "Sí", ""],
        [ejemplo, "Habitación 2", "Reservada", 450, 11, "No", "Otro inquilino", "01/11/2026", "30/06/2027", "No", "Señal pagada"],
        [ejemplo, "Habitación 3", "Libre", 400, 9, "No", "", "", "", "", "Recién pintada"],
      ],
    },
    parse: (rows) => parseRooms(rows, db),
    preview: [
      { label: "Piso", cell: (r) => db.properties.find((p) => p.id === r.property_id)?.name },
      { label: "Habitación", cell: (r) => r.name },
      { label: "Estado", cell: (r) => <RoomBadge status={r.status} /> },
      { label: "Inquilino", cell: (r) => r.tenant_name },
      { label: "Fin", cell: (r) => (r.end_date ? datef(r.end_date) : "") },
      { label: "Contrato", cell: (r) => (r.status === "libre" ? "—" : r.contract_done ? "Hecho" : "Pendiente") },
      { label: "Renta", cell: (r) => eurf(r.rent), right: true },
    ],
    key: (r) => r.id,
    save: (items) => insert("rooms", items),
  };

  return <CsvImporter spec={spec} onClose={onClose} />;
}
