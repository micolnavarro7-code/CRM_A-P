"use client";

import Papa from "papaparse";
import { Download, FileUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { downloadCSV, normKey } from "@/lib/export";
import { Button, Modal } from "../ui";

/** Valor de un campo de la fila (por cualquiera de sus alias), sin espacios; undefined si está vacío. */
export type Pick = (field: string) => string | undefined;

/** Qué se importa y cómo: cada importador (reservas, propiedades…) define el suyo. */
export type ImportSpec<T extends object> = {
  title: string;
  /** Singular y plural para los textos: ["reserva", "reservas"]. */
  noun: [string, string];
  /** Cabecera de la plantilla. */
  columns: string[];
  /** Alias aceptados por campo, ya normalizados con normKey. */
  alias: Record<string, string[]>;
  help: ReactNode;
  template: { name: string; rows: (string | number)[][] };
  /** Un resultado por fila: el registro o el mensaje de error. Recibe todas las filas para detectar repetidas. */
  parse: (rows: Pick[]) => (T | string)[];
  preview: { label: string; cell: (x: T) => ReactNode; right?: boolean }[];
  key: (x: T) => string;
  save: (items: T[]) => Promise<void>;
};

type Parsed<T> = { row: number; item?: T; error?: string };

/** Excel en español guarda los CSV en Windows-1252: si el archivo no es UTF-8 válido, se lee así. */
export function decodeCsv(buf: ArrayBuffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1252").decode(buf);
  }
}

/** Filas del CSV (con cabecera; separador , o ; detectado solo). null si no se reconoce ninguna columna. */
export function readRows(text: string, alias: Record<string, string[]>): Pick[] | null {
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => normKey(h) });
  const known = new Set(Object.values(alias).flat());
  if (!res.meta.fields?.some((f) => known.has(f))) return null;
  return res.data.map(
    (r): Pick =>
      (field) => {
        for (const a of alias[field]) {
          const v = typeof r[a] === "string" ? r[a].trim() : "";
          if (v) return v;
        }
        return undefined;
      },
  );
}

export function CsvImporter<T extends object>({ spec, onClose }: { spec: ImportSpec<T>; onClose: () => void }) {
  const [parsed, setParsed] = useState<Parsed<T>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [one, many] = spec.noun;

  async function handle(file: File) {
    setFileName(file.name);
    setDone(null);
    setErr(null);
    setParsed(null);
    const rows = readRows(decodeCsv(await file.arrayBuffer()), spec.alias);
    if (!rows) return setErr("No se reconoce ninguna columna. La primera fila debe tener los nombres de columna: descarga la plantilla para verlos.");
    // +1 por la cabecera y +1 porque las filas de la hoja empiezan en 1.
    setParsed(spec.parse(rows).map((x, i) => (typeof x === "string" ? { row: i + 2, error: x } : { row: i + 2, item: x })));
  }

  const ok = parsed?.filter((p) => p.item) ?? [];
  const bad = parsed?.filter((p) => p.error) ?? [];
  const n = (k: number) => `${k} ${k === 1 ? one : many}`;

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={spec.title}
      footer={
        done != null ? (
          <Button onClick={onClose}>Cerrar</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button
              disabled={!ok.length || saving}
              onClick={async () => {
                setSaving(true);
                setErr(null);
                try {
                  await spec.save(ok.map((p) => p.item!));
                  setDone(ok.length);
                } catch (e) {
                  setErr(`No se pudo importar: ${(e as Error).message}`);
                }
                setSaving(false);
              }}
            >
              {saving ? "Importando…" : `Importar ${n(ok.length)}`}
            </Button>
          </>
        )
      }
    >
      {done != null ? (
        <p className="py-8 text-center text-sm">✅ Se han importado <b>{n(done)}</b>.</p>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            Columnas: <span className="text-ink">{spec.columns.join(", ")}</span>. {spec.help}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="bg-cta inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-medium text-white">
              <FileUp size={16} /> {fileName ? "Elegir otro archivo" : "Elegir archivo CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handle(e.target.files[0]);
                  e.target.value = ""; // permite volver a elegir el mismo archivo tras corregirlo
                }}
              />
            </label>
            <Button variant="secondary" icon={<Download size={16} />} onClick={() => downloadCSV(spec.template.name, spec.columns, spec.template.rows)}>
              Descargar plantilla
            </Button>
          </div>

          {err && <p className="mt-4 rounded-xl bg-gasto/10 px-3 py-2 text-sm text-[#b54848]" role="alert">{err}</p>}

          {parsed && (
            <div className="mt-5">
              <p className="mb-2 text-sm">
                <b>{fileName}</b>: <span className="text-ingreso">{ok.length} válidas</span>
                {bad.length > 0 && <span className="text-gasto"> · {bad.length} con errores (no se importarán)</span>}
              </p>
              {bad.length > 0 && (
                <ul className="mb-3 max-h-28 overflow-y-auto rounded-xl bg-gasto/10 p-3 text-xs text-[#b54848]">
                  {bad.map((b) => <li key={b.row}>Fila {b.row}: {b.error}</li>)}
                </ul>
              )}
              {ok.length > 0 && (
                <div className="scroll-thin max-h-64 overflow-auto rounded-xl border border-line">
                  <table className="num w-full min-w-[640px] text-xs">
                    <thead className="sticky top-0 bg-page text-left text-muted">
                      <tr>{spec.preview.map((c) => <th key={c.label} className={`px-3 py-2 font-medium ${c.right ? "text-right" : ""}`}>{c.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {ok.slice(0, 50).map(({ item }) => (
                        <tr key={spec.key(item!)} className="border-t border-line">
                          {spec.preview.map((c) => <td key={c.label} className={`px-3 py-1.5 ${c.right ? "text-right" : ""}`}>{c.cell(item!)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {ok.length > 50 && <p className="mt-2 text-xs text-muted">Se muestran las 50 primeras.</p>}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
