// Exportación a CSV (separador ";" y coma decimal, lo que espera Excel en español)
// y a Excel .xlsx real.

export type Cell = string | number | null;

function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const csvCell = (v: Cell) => {
  if (v == null) return "";
  const s = typeof v === "number" ? String(v).replace(".", ",") : v;
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function downloadCSV(name: string, header: string[], rows: Cell[][]) {
  const text = [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  download(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }), name.endsWith(".csv") ? name : `${name}.csv`);
}

/**
 * Excel con estilo de la hoja actual: cabecera oscura, celdas en rosa y fila
 * TOTAL en negrita. `totalRow` = índice (en `rows`) de la fila de totales.
 */
export async function downloadXLSX(name: string, sheet: string, header: string[], rows: Cell[][], opts: { totalRow?: number; pctCols?: number[] } = {}) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const data = [
    header.map((h) => ({ value: h, fontWeight: "bold" as const, color: "#FFFFFF", backgroundColor: "#4A4F5C", align: "center" as const })),
    ...rows.map((r, i) =>
      r.map((v, j) => {
        const total = i === opts.totalRow;
        const first = j === 0;
        const style = {
          backgroundColor: total ? "#F6D3DA" : first ? "#FFFFFF" : "#FDECEF",
          fontWeight: total || first ? ("bold" as const) : undefined,
          borderColor: "#F6D3DA",
          borderStyle: "thin" as const,
        };
        if (typeof v === "number")
          return { ...style, value: v, type: Number, format: opts.pctCols?.includes(j) ? "0.00%" : '#,##0.00 "€"' };
        return { ...style, value: v ?? "", type: String };
      }),
    ),
  ];
  const blob = await writeXlsxFile(data, { sheet: sheet.slice(0, 31), columns: header.map((_, j) => ({ width: j === 0 ? 14 : 13 })) }).toBlob();
  download(blob, name.endsWith(".xlsx") ? name : `${name}.xlsx`);
}

// ---------------------------------------------------------------------
// Lectura de CSV
// ---------------------------------------------------------------------

/** "Nº Reserva" → "n_reserva" */
export const normKey = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/º|ª/g, "").trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** Acepta "1.234,56", "1234,56", "1234.56", "1,234.56", "285.000", "€ 12" … */
export function parseNum(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let s = String(raw).replace(/[€\s]/g, "");
  if (!s || s === "-" || s === "—") return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
  // Sin coma y con grupos de 3 cifras tras cada punto («285.000», «1.250.000»): puntos de miles.
  else if (lastComma < 0 && /^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  return isFinite(n) ? n : null;
}

/** Acepta DD/MM/AAAA, D/M/AA, AAAA-MM-DD → "AAAA-MM-DD" o null. */
export function parseDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return null;
}

export function parseBool(raw: string | undefined | null) {
  return /^(si|sí|s|x|true|1|yes|y|facturado)$/i.test(String(raw ?? "").trim());
}
