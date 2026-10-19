"use client";

import { CalendarX, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { datef, eurf, MESES_CORTOS, month0Of, nights, r2 } from "@/lib/format";
import { useData } from "@/lib/store";
import type { Booking } from "@/lib/types";
import { ChannelChip } from "../domain";
import { cx, Empty } from "../ui";
import { BookingForm } from "./BookingForm";

const SUMS = ["price", "payout", "platform_fee", "cleaning", "vat", "net_profit"] as const;

export function BookingsTable({ bookings, showProperty = true }: { bookings: Booking[]; showProperty?: boolean }) {
  const { db, update, remove } = useData();
  const [edit, setEdit] = useState<Booking | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const pname = (id: string) => db.properties.find((p) => p.id === id)?.name ?? "—";

  if (!bookings.length)
    return <Empty icon={<CalendarX size={32} />} title="Sin reservas">No hay reservas con estos filtros.</Empty>;

  const tot = Object.fromEntries(SUMS.map((k) => [k, r2(bookings.reduce((a, b) => a + b[k], 0))])) as Record<(typeof SUMS)[number], number>;
  const th = "px-3 py-3 font-medium whitespace-nowrap";
  const td = "px-3 py-2.5 whitespace-nowrap";

  return (
    <>
      <div className="scroll-thin relative overflow-x-auto">
        <table className="num w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className={th}>Mes</th>
              {showProperty && <th className={th}>Propiedad</th>}
              <th className={th}>Entrada – Salida</th>
              <th className={th}>Canal</th>
              <th className={th}>Nº reserva</th>
              <th className={th}>Huésped</th>
              <th className={cx(th, "text-right")}>Precio</th>
              <th className={cx(th, "text-right")}>Ingreso</th>
              <th className={cx(th, "text-right")}>Comisión</th>
              <th className={cx(th, "text-right")}>Limpieza</th>
              <th className={cx(th, "text-right")}>IVA</th>
              <th className={cx(th, "text-right")}>Beneficio</th>
              <th className={cx(th, "text-center")}>Facturado</th>
              <th className={th}><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-line hover:bg-page/60">
                <td className={cx(td, "capitalize text-ink-2")}>{MESES_CORTOS[month0Of(b.month)]} {b.month.slice(2, 4)}</td>
                {showProperty && <td className={cx(td, "font-medium")}>{pname(b.property_id)}</td>}
                <td className={td}>
                  {datef(b.check_in)} – {datef(b.check_out)}
                  <span className="ml-1.5 text-xs text-muted">{nights(b.check_in, b.check_out)} n</span>
                </td>
                <td className={td}><ChannelChip channel={b.channel} /></td>
                <td className={cx(td, "text-ink-2")}>{b.booking_ref || "—"}</td>
                <td className={cx(td, "max-w-40 truncate")}>{b.guest_name || "—"}</td>
                <td className={cx(td, "text-right")}>{eurf(b.price)}</td>
                <td className={cx(td, "text-right text-ingreso")}>{eurf(b.payout)}</td>
                <td className={cx(td, "text-right", b.platform_fee ? "text-gasto" : "text-muted")}>{b.platform_fee ? eurf(b.platform_fee) : "—"}</td>
                <td className={cx(td, "text-right", b.cleaning ? "text-gasto" : "text-muted")}>{b.cleaning ? eurf(b.cleaning) : "—"}</td>
                <td className={cx(td, "text-right text-ink-2")}>{b.vat ? eurf(b.vat) : "—"}</td>
                <td className={cx(td, "text-right font-semibold text-beneficio")}>{eurf(b.net_profit)}</td>
                <td className={cx(td, "text-center")}>
                  <input
                    type="checkbox"
                    checked={b.invoiced}
                    onChange={(e) => update("bookings", b.id, { invoiced: e.target.checked })}
                    className="size-4 accent-[#16a34a]"
                    aria-label="Facturado"
                  />
                </td>
                <td className={cx(td, "text-right")}>
                  {confirm === b.id ? (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <button type="button" onClick={() => remove("bookings", b.id)} className="rounded-lg bg-gasto px-2 py-1 font-medium text-white">Eliminar</button>
                      <button type="button" onClick={() => setConfirm(null)} className="rounded-lg px-2 py-1 text-ink-2 hover:bg-page">No</button>
                    </span>
                  ) : (
                    <span className="inline-flex gap-0.5">
                      <button type="button" onClick={() => setEdit(b)} className="rounded-lg p-1.5 text-muted hover:bg-page hover:text-blue-brand" aria-label="Editar"><Pencil size={15} /></button>
                      <button type="button" onClick={() => setConfirm(b.id)} className="rounded-lg p-1.5 text-muted hover:bg-page hover:text-gasto" aria-label="Eliminar"><Trash2 size={15} /></button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-page/70 font-semibold">
              <td className={td} colSpan={showProperty ? 6 : 5}>Total · {bookings.length} reservas</td>
              <td className={cx(td, "text-right")}>{eurf(tot.price)}</td>
              <td className={cx(td, "text-right text-ingreso")}>{eurf(tot.payout)}</td>
              <td className={cx(td, "text-right text-gasto")}>{eurf(tot.platform_fee)}</td>
              <td className={cx(td, "text-right text-gasto")}>{eurf(tot.cleaning)}</td>
              <td className={cx(td, "text-right")}>{eurf(tot.vat)}</td>
              <td className={cx(td, "text-right text-beneficio")}>{eurf(tot.net_profit)}</td>
              <td className={td} colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
      {edit && <BookingForm key={edit.id} initial={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
