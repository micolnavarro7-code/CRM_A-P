"use client";

import { eurf, todayISO, uid } from "@/lib/format";
import { normKey, parseBool, parseNum } from "@/lib/export";
import { useData } from "@/lib/store";
import type { BusinessModel, Category, Contact, DB, Property, PropertyStatus } from "@/lib/types";
import { CATEGORY, MODEL, PROPERTY_TYPES, STATUS, StatusBadge } from "../domain";
import { CsvImporter, type ImportSpec, type Pick } from "../import/CsvImporter";

const COLUMNS = [
  "Nombre", "Código", "Categoría", "Tipo", "Estado", "Dirección", "Ciudad", "Precio", "Dormitorios", "Baños",
  "m² construidos", "m² útiles", "Propietario", "Modelo", "% agencia", "Limpieza (€)", "Limpieza del propietario",
];

// Alias aceptados por columna (ya normalizados: «m² útiles» → «m_utiles»).
export const ALIAS: Record<string, string[]> = {
  nombre: ["nombre", "propiedad", "piso", "inmueble"],
  codigo: ["codigo", "cod", "referencia", "ref"],
  categoria: ["categoria", "linea", "linea_de_negocio"],
  tipo: ["tipo", "tipologia"],
  estado: ["estado"],
  direccion: ["direccion", "domicilio"],
  ciudad: ["ciudad", "localidad", "poblacion", "municipio"],
  precio: ["precio", "precio_mes", "renta", "precio_de_venta"],
  dormitorios: ["dormitorios", "habitaciones", "hab"],
  banos: ["banos", "bano", "aseos"],
  construidos: ["m_construidos", "m2_construidos", "metros_construidos", "superficie_construida", "construidos"],
  utiles: ["m_utiles", "m2_utiles", "metros_utiles", "superficie_util", "utiles"],
  propietario: ["propietario", "propietaria", "dueno"],
  modelo: ["modelo", "modelo_de_negocio", "negocio"],
  agencia: ["agencia", "porcentaje_agencia", "agencia_pct", "comision_agencia"],
  limpieza: ["limpieza", "limpieza_eur", "limpieza_por_defecto"],
  limpiezaProp: ["limpieza_del_propietario", "limpieza_propietario", "limpieza_la_hace_el_propietario"],
};

function parseCategory(v: string | undefined): Category | null {
  const s = normKey(v ?? "");
  if (!s || s.includes("turist")) return "turistico";
  if (s.includes("habitac")) return "habitaciones";
  if (s.includes("venta")) return "venta";
  return null;
}

function parseStatus(v: string | undefined): PropertyStatus | null {
  const s = normKey(v ?? "");
  if (!s || s.startsWith("disponible") || s === "libre") return "disponible";
  if (s.startsWith("alquilad")) return "alquilada";
  if (s.startsWith("reservad")) return "reservado";
  if (s.includes("arras")) return "arras";
  if (s.startsWith("vendid")) return "vendida";
  if (s.includes("remodelacion") || s.includes("obras") || s.includes("reforma")) return "remodelacion";
  return null;
}

function parseModel(v: string | undefined): BusinessModel | null {
  const s = normKey(v ?? "");
  if (!s || s.startsWith("gestion")) return "gestion";
  if (s.startsWith("subarr")) return "subarriendo";
  if (s.startsWith("propi")) return "propia";
  return null;
}

/** «25», «25 %» o «0,25» → 0.25 */
function parsePct(v: string | undefined) {
  const n = parseNum(v?.replace("%", ""));
  if (n == null) return null;
  return n > 1 ? n / 100 : n;
}

const int = (v: string | undefined) => {
  const n = parseNum(v);
  return n == null ? null : Math.round(n);
};

type Row = { p: Property; owner: string | null; newOwner: Contact | null };

export function parseProperties(rows: Pick[], db: DB): (Row | string)[] {
  const nombres = new Map(db.properties.map((p) => [normKey(p.name), "existe"]));
  const codigos = new Map(db.properties.filter((p) => p.code).map((p) => [normKey(p.code!), "existe"]));
  const owners = new Map(db.contacts.filter((c) => c.type === "propietario").map((c) => [normKey(c.name), c]));
  const nuevos = new Map<string, Contact>(); // propietarios que se crean con esta importación

  return rows.map((pick, i) => {
    const fila = `fila ${i + 2}`;
    const name = pick("nombre");
    if (!name) return "Falta el nombre";
    const code = pick("codigo") ?? null;
    const yaNombre = nombres.get(normKey(name));
    if (yaNombre) return yaNombre === "existe" ? `Ya existe una propiedad llamada «${name}»` : `Nombre repetido en el archivo (${yaNombre})`;
    const yaCodigo = code ? codigos.get(normKey(code)) : undefined;
    if (yaCodigo) return yaCodigo === "existe" ? `Ya existe una propiedad con el código «${code}»` : `Código repetido en el archivo (${yaCodigo})`;

    const category = parseCategory(pick("categoria"));
    if (!category) return `Categoría «${pick("categoria")}» no reconocida (Turístico, Habitaciones o Venta)`;
    const status = parseStatus(pick("estado"));
    const validos = CATEGORY[category].statuses;
    if (!status || !validos.includes(status)) {
      return `Estado «${pick("estado")}» no válido en ${CATEGORY[category].label} (usa: ${validos.map((s) => STATUS[s].label).join(", ")})`;
    }
    const venta = category === "venta";
    const model = venta ? "gestion" : parseModel(pick("modelo"));
    if (!model) return `Modelo «${pick("modelo")}» no reconocido (Gestión, Subarriendo o Propia)`;
    const pct = model === "gestion" && !venta ? parsePct(pick("agencia")) ?? 0.25 : 0;
    if (pct < 0 || pct > 1) return `% agencia «${pick("agencia")}» no válido (entre 0 y 100)`;

    // El propietario se busca por nombre; si no existe, se crea (una sola vez aunque se repita).
    const ownerName = pick("propietario") ?? null;
    let owner_id: string | null = null;
    let newOwner: Contact | null = null;
    if (ownerName) {
      const k = normKey(ownerName);
      const existente = owners.get(k);
      if (existente) owner_id = existente.id;
      else {
        const creado = nuevos.get(k);
        newOwner = creado ? null : { id: uid(), type: "propietario", name: ownerName, email: null, phone: null, nif: null, iban: null, category: null, notes: null };
        if (newOwner) nuevos.set(k, newOwner);
        owner_id = (creado ?? newOwner)!.id;
      }
    }

    const tipo = pick("tipo");
    nombres.set(normKey(name), fila);
    if (code) codigos.set(normKey(code), fila);
    return {
      owner: ownerName,
      newOwner,
      p: {
        id: uid(), category, code, name, address: pick("direccion") ?? null, city: pick("ciudad") ?? null,
        type: (tipo && PROPERTY_TYPES.find((t) => normKey(t) === normKey(tipo))) || tipo || "Piso",
        status,
        // En habitaciones la renta es la suma de sus habitaciones: el piso no lleva precio.
        price: category === "habitaciones" ? null : parseNum(pick("precio")),
        bedrooms: int(pick("dormitorios")), bathrooms: int(pick("banos")),
        built_m2: parseNum(pick("construidos")), useful_m2: parseNum(pick("utiles")),
        owner_id, business_model: model, agency_pct: pct,
        cleaning_by_owner: model === "gestion" && !venta && parseBool(pick("limpiezaProp")),
        default_cleaning: venta ? 0 : parseNum(pick("limpieza")) ?? 0,
        photo_url: null, tags: [], updated_at: todayISO(),
      },
    };
  });
}

export function PropertiesImport({ onClose }: { onClose: () => void }) {
  const { db, insert } = useData();

  const spec: ImportSpec<Row> = {
    title: "Importar propiedades desde CSV",
    noun: ["propiedad", "propiedades"],
    columns: COLUMNS,
    alias: ALIAS,
    help: (
      <>
        Solo el nombre es obligatorio. Categoría: Turístico, Habitaciones o Venta (si se deja vacía, Turístico). Modelo: Gestión, Subarriendo o Propia; en
        gestión, el % de agencia es 25 si no se indica. El propietario se busca por nombre y, si no existe, se crea. Las habitaciones de cada piso se importan
        después, con «Importar habitaciones».
      </>
    ),
    template: {
      name: "plantilla-propiedades",
      rows: [
        ["Apartamento Puerto", "TUR-01", "Turístico", "Piso", "Disponible", "Calle del Puerto 3", "Laxe", "", 3, 2, 95, 80, "Nombre propietario", "Gestión", 25, 60, "No"],
        ["Piso Centro", "MAD-H2", "Habitaciones", "Piso", "Disponible", "Calle Mayor 1", "Madrid", "", 4, 2, 110, 95, "", "Subarriendo", "", "", ""],
        ["Ático Playa", "VEN-01", "Venta", "Ático", "En arras", "Paseo Marítimo 5", "Dénia", 285000, 2, 2, 90, 78, "Otro propietario", "", "", "", ""],
      ],
    },
    parse: (rows) => parseProperties(rows, db),
    preview: [
      { label: "Nombre", cell: (r) => <><span className="font-medium">{r.p.name}</span>{r.p.code && <span className="text-muted"> · {r.p.code}</span>}</> },
      { label: "Categoría", cell: (r) => CATEGORY[r.p.category].nav },
      { label: "Estado", cell: (r) => <StatusBadge status={r.p.status} /> },
      { label: "Ciudad", cell: (r) => r.p.city },
      { label: "Propietario", cell: (r) => r.owner && <>{r.owner}{r.newOwner && <span className="text-muted"> (nuevo)</span>}</> },
      { label: "Modelo", cell: (r) => (r.p.category === "venta" ? "—" : r.p.business_model === "gestion" ? `Gestión · ${Math.round(r.p.agency_pct * 1000) / 10} %` : MODEL[r.p.business_model]) },
      { label: "Precio", cell: (r) => (r.p.price != null ? eurf(r.p.price) : "—"), right: true },
    ],
    key: (r) => r.p.id,
    save: async (items) => {
      const owners = items.flatMap((r) => (r.newOwner ? [r.newOwner] : []));
      if (owners.length) await insert("contacts", owners);
      await insert("properties", items.map((r) => r.p));
    },
  };

  return <CsvImporter spec={spec} onClose={onClose} />;
}
