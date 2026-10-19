"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { eurf, MESES, monthISO, r2, uid } from "@/lib/format";
import { useData } from "@/lib/store";
import type { MonthlyCost, Property } from "@/lib/types";

const CAMPOS = [
  { k: "rent", h: "Alquiler" },
  { k: "electricity", h: "Luz" },
  { k: "water", h: "Agua" },
  { k: "internet", h: "Internet" },
] as const;
type K = (typeof CAMPOS)[number]["k"];

/** Rejilla editable de gastos fijos mensuales. Guarda al salir de cada celda. */
export function MonthlyCostsEditor({ p, year }: { p: Property; year: number }) {
  const { db, insert, update } = useData();
  const [saved, setSaved] = useState<string | null>(null);
  const costs = db.monthly_costs.filter((c) => c.property_id === p.id);

  async function save(m: number, k: K, raw: string) {
    const month = monthISO(year, m);
    const value = raw === "" ? 0 : r2(Number(raw.replace(",", ".")));
    if (!isFinite(value)) return;
    const row = costs.find((c) => c.month === month);
    if (row) {
      if (row[k] === value) return;
      await update("monthly_costs", row.id, { [k]: value } as Partial<MonthlyCost>);
    } else {
      if (!value) return;
      await insert("monthly_costs", { id: uid(), property_id: p.id, month, rent: 0, electricity: 0, water: 0, internet: 0, [k]: value });
    }
    setSaved(`${m}-${k}`);
    setTimeout(() => setSaved((s) => (s === `${m}-${k}` ? null : s)), 1200);
  }

  const totals = CAMPOS.map((c) => r2(costs.filter((x) => x.month.startsWith(String(year))).reduce((a, x) => a + x[c.k], 0)));

  return (
    <div className="scroll-thin overflow-x-auto rounded-xl border border-line">
      <table className="num w-full min-w-[560px] text-sm">
        <thead>
          <tr className="bg-slate-brand text-white">
            <th className="px-3 py-2.5 text-left font-semibold">Mes</th>
            {CAMPOS.map((c) => <th key={c.k} className="px-3 py-2.5 text-right font-semibold">{c.h}</th>)}
          </tr>
        </thead>
        <tbody>
          {MESES.map((mes, m) => {
            const row = costs.find((c) => c.month === monthISO(year, m));
            return (
              <tr key={mes} className="border-t border-line">
                <td className="px-3 py-1.5 font-medium">{mes}</td>
                {CAMPOS.map((c) => (
                  <td key={c.k} className="relative px-2 py-1">
                    <input
                      key={`${year}-${row?.[c.k] ?? 0}`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={row?.[c.k] || ""}
                      placeholder="0,00"
                      onBlur={(e) => save(m, c.k, e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="h-9 w-full rounded-lg border border-transparent bg-page/60 px-2 text-right outline-none hover:border-line focus:border-blue-brand focus:bg-card"
                      aria-label={`${c.h} ${mes}`}
                    />
                    {saved === `${m}-${c.k}` && <Check size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-ingreso" />}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line bg-page/70 font-semibold">
            <td className="px-3 py-2.5">TOTAL</td>
            {totals.map((t, i) => <td key={i} className="px-4 py-2.5 text-right">{eurf(t)}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
