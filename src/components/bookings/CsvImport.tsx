"use client";

import Papa from "papaparse";
import { Download, FileUp } from "lucide-react";
import { useState } from "react";
import { datef, eurf, monthOf, r2, uid } from "@/lib/format";
import { downloadCSV, normKey, parseBool, parseDate, parseNum } from "@/lib/export";
import { useData } from "@/lib/store";
import type { Booking, Channel } from "@/lib/types";
import { ChannelChip } from "../domain";
import { Button, Modal } from "../ui";

export const CSV_COLUMNS = ["Propiedad", "Mes", "Entrada", "Salida", "Canal", "Nº Reserva", "Huésped", "Precio", "Ingreso", "Comisión", "Limpieza", "IVA", "Beneficio", "Facturado"];

// Alias aceptados por columna (ya normalizados).
const ALIAS: Record<string, string[]> = {
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

type Parsed = { row: number; booking?: Booking; error?: string };

export function CsvImport({ onClose }: { onClose: () => void }) {
  const { db, insert } = useData();
  const [parsed, setParsed] = useState<Parsed[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const findProperty = (v: string) => {
    const n = normKey(v);
    return db.properties.find((p) => p.category !== "venta" && (normKey(p.name) === n || (p.code && normKey(p.code) === n)));
  };

  function parseMonth(v: string | undefined, year: string, fallback: string | null) {
    if (!v) return fallback;
    const s = normKey(v);
    const i = MES_NOMBRE.findIndex((m) => s.startsWith(m.slice(0, 3)));
    if (i >= 0) return `${year}-${String(i + 1).padStart(2, "0")}-01`;
    const d = parseDate(v) ?? (/^\d{4}-\d{2}$/.test(v.trim()) ? `${v.trim()}-01` : null);
    return d ? monthOf(d) : fallback;
  }

  function handle(file: File) {
    setFileName(file.name);
    setDone(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => normKey(h),
      complete: (res) => {
        const pick = (r: Record<string, string>, k: string) => {
          for (const a of ALIAS[k]) if (r[a] !== undefined && r[a] !== "") return r[a];
          return undefined;
        };
        setParsed(
          res.data.map((r, i): Parsed => {
            const row = i + 2; // +1 cabecera, +1 base 1
            const prop = findProperty(pick(r, "propiedad") ?? "");
            if (!prop) return { row, error: `Propiedad «${pick(r, "propiedad") ?? ""}» no encontrada` };
            const inD = parseDate(pick(r, "entrada"));
            const outD = parseDate(pick(r, "salida"));
            if (!inD || !outD) return { row, error: "Fechas de entrada/salida no válidas (usa DD/MM/AAAA)" };
            const canalRaw = normKey(pick(r, "canal") ?? "");
            const channel: Channel | null = canalRaw.startsWith("book") ? "booking" : canalRaw.startsWith("air") ? "airbnb" : canalRaw.startsWith("prop") || canalRaw.startsWith("direct") ? "propia" : null;
            if (!channel) return { row, error: `Canal «${pick(r, "canal") ?? ""}» no reconocido (Booking, Airbnb o Propia)` };
            const price = parseNum(pick(r, "precio")) ?? 0;
            const fee = parseNum(pick(r, "comision")) ?? 0;
            const payout = parseNum(pick(r, "ingreso")) ?? r2(price - fee);
            const cleaning = parseNum(pick(r, "limpieza")) ?? 0;
            const net = parseNum(pick(r, "beneficio")) ?? r2(payout - cleaning);
            return {
              row,
              booking: {
                id: uid(), property_id: prop.id, guest_id: null, guest_name: pick(r, "huesped") ?? null, channel,
                booking_ref: pick(r, "ref") ?? null, check_in: inD, check_out: outD,
                month: parseMonth(pick(r, "mes"), inD.slice(0, 4), monthOf(inD))!,
                price, payout, platform_fee: fee, cleaning, vat: parseNum(pick(r, "iva")) ?? 0, net_profit: net,
                invoiced: parseBool(pick(r, "facturado")), notes: null,
              },
            };
          }),
        );
      },
    });
  }

  const ok = parsed?.filter((p) => p.booking) ?? [];
  const bad = parsed?.filter((p) => p.error) ?? [];

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title="Importar reservas desde CSV"
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
                await insert("bookings", ok.map((p) => p.booking!));
                setSaving(false);
                setDone(ok.length);
              }}
            >
              {saving ? "Importando…" : `Importar ${ok.length} reserva${ok.length === 1 ? "" : "s"}`}
            </Button>
          </>
        )
      }
    >
      {done != null ? (
        <p className="py-8 text-center text-sm">✅ Se han importado <b>{done}</b> reservas.</p>
      ) : (
        <>
          <p className="text-sm text-ink-2">
            Columnas: <span className="text-ink">{CSV_COLUMNS.join(", ")}</span>. La propiedad se reconoce por nombre o código. Fechas en DD/MM/AAAA e importes con coma decimal. Si faltan Ingreso o Beneficio, se calculan.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <label className="bg-cta inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-sm font-medium text-white">
              <FileUp size={16} /> {fileName ? "Elegir otro archivo" : "Elegir archivo CSV"}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
            </label>
            <Button
              variant="secondary"
              icon={<Download size={16} />}
              onClick={() =>
                downloadCSV("plantilla-reservas", CSV_COLUMNS, [
                  [db.properties[0]?.name ?? "Laxe", "Julio", "05/07/2026", "12/07/2026", "Booking", "4123456789", "Nombre huésped", 950, 807.5, 142.5, 60, 0, 747.5, "No"],
                  [db.properties[0]?.name ?? "Laxe", "Julio", "14/07/2026", "18/07/2026", "Propia", "", "Otro huésped", 520, 520, 0, 60, 0, 460, "Sí"],
                ])
              }
            >
              Descargar plantilla
            </Button>
          </div>

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
              <div className="scroll-thin max-h-64 overflow-auto rounded-xl border border-line">
                <table className="num w-full min-w-[640px] text-xs">
                  <thead className="sticky top-0 bg-page text-left text-muted">
                    <tr>{["Propiedad", "Entrada", "Salida", "Canal", "Huésped", "Precio", "Beneficio"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {ok.slice(0, 50).map(({ booking: b }) => (
                      <tr key={b!.id} className="border-t border-line">
                        <td className="px-3 py-1.5">{db.properties.find((p) => p.id === b!.property_id)?.name}</td>
                        <td className="px-3 py-1.5">{datef(b!.check_in)}</td>
                        <td className="px-3 py-1.5">{datef(b!.check_out)}</td>
                        <td className="px-3 py-1.5"><ChannelChip channel={b!.channel} /></td>
                        <td className="px-3 py-1.5">{b!.guest_name}</td>
                        <td className="px-3 py-1.5 text-right">{eurf(b!.price)}</td>
                        <td className="px-3 py-1.5 text-right">{eurf(b!.net_profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
