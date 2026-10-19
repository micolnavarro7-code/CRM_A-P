"use client";

import { FileSpreadsheet, FileText } from "lucide-react";
import { type FilaResumen, resumenAnual, totalAnual } from "@/lib/calc";
import { type Cell, downloadCSV, downloadXLSX } from "@/lib/export";
import { eurf, MESES, pctf } from "@/lib/format";
import { useData } from "@/lib/store";
import type { Property } from "@/lib/types";
import { Button, cx } from "../ui";

type Col = { h: string; k: keyof FilaResumen; pct?: boolean; strong?: "beneficio" | "balance" };

export function columnasResumen(p: Property): Col[] {
  if (p.business_model === "subarriendo")
    return [
      { h: "Total", k: "total" },
      { h: "Beneficio", k: "beneficio" },
      { h: "Alquiler", k: "alquiler" },
      { h: "Luz", k: "luz" },
      { h: "Agua", k: "agua" },
      { h: "Internet", k: "internet" },
      { h: "Balance", k: "balance", strong: "balance" },
      { h: "%", k: "pct", pct: true },
    ];
  return [
    { h: "Total", k: "total" },
    { h: "Comisión", k: "comision" },
    { h: "Limpieza", k: "limpieza" },
    { h: "Beneficio", k: "beneficio", strong: "beneficio" },
    { h: `${Math.round(p.agency_pct * 100)} % agencia`, k: "parteAgencia" },
    { h: "Pago a prop.", k: "pagoPropietario" },
    { h: "Fact S/I", k: "factSI" },
    { h: "Fact C/I", k: "parteAgencia" },
  ];
}

export function ResumenAnual({ p, year }: { p: Property; year: number }) {
  const { db } = useData();
  const rows = resumenAnual(p, db.bookings, db.monthly_costs, year);
  const total = { ...totalAnual(rows), mes: -1 };
  const cols = columnasResumen(p);
  const titulo = `${p.name} ${year}: ${p.business_model === "subarriendo" ? "Resumen mensual" : "Ingresos confirmados"}`;

  const cellText = (f: FilaResumen, c: Col) => {
    const v = f[c.k] as number | null;
    if (c.pct) return pctf(v);
    return v ? eurf(v) : "—";
  };
  const exportRows = (): Cell[][] => [
    ...rows.map((f) => [MESES[f.mes], ...cols.map((c) => f[c.k] as number | null)]),
    ["TOTAL", ...cols.map((c) => total[c.k] as number | null)],
  ];
  const header = ["Mes", ...cols.map((c) => c.h)];
  const file = `${p.name}-${year}-resumen`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{titulo}</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" icon={<FileText size={14} />} onClick={() => downloadCSV(file, header, exportRows())}>CSV</Button>
          <Button size="sm" variant="secondary" icon={<FileSpreadsheet size={14} />} onClick={() => downloadXLSX(file, titulo, header, exportRows(), { totalRow: 12, pctCols: cols.flatMap((c, i) => (c.pct ? [i + 1] : [])) })}>Excel</Button>
        </div>
      </div>
      <div className="scroll-thin overflow-x-auto rounded-xl border border-rosa-line">
        <table className="num w-full min-w-[820px] border-collapse text-[13px]">
          <thead>
            <tr className="bg-slate-brand text-white">
              <th className="sticky left-0 z-10 bg-slate-brand px-3 py-2.5 text-left font-semibold">Mes</th>
              {cols.map((c) => <th key={c.h} className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{c.h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.mes} className="border-t border-rosa-line">
                <td className="sticky left-0 z-10 bg-card px-3 py-2 font-semibold">{MESES[f.mes]}</td>
                {cols.map((c) => {
                  const v = f[c.k] as number | null;
                  return (
                    <td
                      key={c.h}
                      className={cx(
                        "bg-rosa px-3 py-2 text-right whitespace-nowrap",
                        !v && "text-muted",
                        c.strong === "beneficio" && !!v && "font-semibold text-beneficio",
                        c.strong === "balance" && v != null && v !== 0 && (v < 0 ? "font-semibold text-[#c24d4d]" : "font-semibold text-ingreso"),
                        c.pct && v != null && v < 0 && "text-[#c24d4d]",
                      )}
                    >
                      {cellText(f, c)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-brand font-bold">
              <td className="sticky left-0 z-10 bg-rosa-line px-3 py-2.5">TOTAL</td>
              {cols.map((c) => {
                const v = total[c.k] as number | null;
                return (
                  <td key={c.h} className={cx("bg-rosa-line px-3 py-2.5 text-right whitespace-nowrap", c.strong === "balance" && v != null && v < 0 && "text-[#c24d4d]")}>
                    {cellText(total, c)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        {p.business_model === "subarriendo"
          ? "Balance = Beneficio − Alquiler − Luz − Agua − Internet · % = Balance ÷ Beneficio (— si no hay beneficio). Los gastos fijos se editan en la pestaña «Gastos fijos»."
          : `Beneficio = Σ beneficio neto de las reservas · Fact C/I = ${Math.round(p.agency_pct * 100)} % del beneficio · Fact S/I = C/I ÷ 1,21 · Pago a propietario = beneficio − parte agencia${p.cleaning_by_owner ? " + limpieza (la hace el propietario)" : ""}.`}
      </p>
    </div>
  );
}
