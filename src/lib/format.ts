const eur = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const eur0 = new Intl.NumberFormat("es-ES", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
  maximumFractionDigits: 0,
});
const pct = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 });
const num = new Intl.NumberFormat("es-ES", { useGrouping: "always", maximumFractionDigits: 2 });

/** 1.234,56 € · null → "—" */
export const eurf = (n: number | null | undefined) => (n == null ? "—" : eur.format(n));
/** 1.235 € */
export const eur0f = (n: number | null | undefined) => (n == null ? "—" : eur0.format(n));
export const pctf = (n: number | null | undefined) => (n == null || !isFinite(n) ? "—" : pct.format(n));
export const numf = (n: number | null | undefined) => (n == null ? "—" : num.format(n));

/** "2026-03-07" → "07/03/2026" */
export function datef(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const r2 = (n: number) => Math.round(n * 100) / 100;

/** Fecha local de hoy en ISO "AAAA-MM-DD". */
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Día 1 del mes de una fecha ISO. */
export const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;
export const monthISO = (year: number, m0: number) => `${year}-${String(m0 + 1).padStart(2, "0")}-01`;
export const yearOf = (iso: string) => Number(iso.slice(0, 4));
export const month0Of = (iso: string) => Number(iso.slice(5, 7)) - 1;

/** Noches entre dos fechas ISO. */
export function nights(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}

/** UUID v4. `crypto.randomUUID` solo existe en contextos seguros (https/localhost);
 *  al abrir la app por IP local desde el móvil hace falta la alternativa. */
export function uid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
