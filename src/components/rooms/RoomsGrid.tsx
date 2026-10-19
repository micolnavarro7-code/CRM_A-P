"use client";

import { Bath, CalendarRange, DoorOpen, KeyRound, Maximize, Pencil, Plus, Trash2, User } from "lucide-react";
import { useState } from "react";
import { datef, eur0f, numf, todayISO } from "@/lib/format";
import { AVISO_DIAS, diasFinContrato, habitacionesDe } from "@/lib/stats";
import { useData } from "@/lib/store";
import type { Property, Room, RoomStatus } from "@/lib/types";
import { RoomBadge } from "../domain";
import { Button, cx, Empty } from "../ui";
import { ContractToggle } from "./Contracts";
import { RoomForm } from "./RoomForm";
import { RoomStrip } from "./RoomStrip";

/** Pestaña «Habitaciones» de la ficha: una tarjeta por habitación. */
export function RoomsGrid({ p }: { p: Property }) {
  const { db, remove } = useData();
  const rooms = habitacionesDe(db, p.id);
  const [form, setForm] = useState<{ room?: Room; status?: RoomStatus } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const hoy = todayISO();

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1"><RoomStrip rooms={rooms} /></div>
        <Button size="sm" icon={<Plus size={14} />} onClick={() => setForm({})}>Agregar habitación</Button>
      </div>

      {rooms.length === 0 ? (
        <Empty icon={<DoorOpen size={32} />} title="Este piso aún no tiene habitaciones">
          Agrega cada habitación con su renta para ver cuáles están alquiladas y cuáles libres.
        </Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((r) => {
            const libre = r.status === "libre";
            const dias = diasFinContrato(r, hoy);
            return (
              <article key={r.id} className={cx("flex flex-col rounded-2xl border p-4", libre ? "border-dashed border-[#86efac] bg-[#f0fdf4]/60" : "border-line bg-card")}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold">{r.name}</h3>
                  <RoomBadge status={r.status} />
                </div>
                <p className="num mt-2 text-xl font-bold">
                  {eur0f(r.rent)}
                  <span className="text-sm font-normal text-muted"> /mes</span>
                </p>
                <p className="num mt-1 flex flex-wrap gap-x-3 text-[12px] text-ink-2">
                  {r.size_m2 != null && <span className="inline-flex items-center gap-1"><Maximize size={13} className="text-muted" />{numf(r.size_m2)} m²</span>}
                  {r.private_bath && <span className="inline-flex items-center gap-1"><Bath size={13} className="text-muted" />Baño privado</span>}
                </p>

                <div className="mt-3 flex-1 border-t border-line pt-3 text-sm">
                  {libre ? (
                    <p className="text-[#15803D]">Disponible para alquilar</p>
                  ) : (
                    <>
                      <p className="flex items-center gap-1.5 font-medium"><User size={14} className="text-muted" />{r.tenant_name || "Sin nombre"}</p>
                      {(r.start_date || r.end_date) && (
                        <p className="num mt-1 flex items-center gap-1.5 text-[12px] text-ink-2">
                          <CalendarRange size={13} className="text-muted" />
                          {datef(r.start_date)} → {datef(r.end_date)}
                        </p>
                      )}
                      <ContractToggle room={r} className="mt-2" />
                    </>
                  )}
                  {dias != null && dias <= AVISO_DIAS && (
                    <p className={cx("mt-2 rounded-lg px-2 py-1 text-[12px] font-medium", dias < 0 ? "bg-gasto/10 text-[#b54848]" : "bg-[#FEF3C7] text-[#B45309]")}>
                      {dias < 0 ? `Contrato vencido el ${datef(r.end_date)}` : dias === 0 ? "El contrato termina hoy" : `El contrato termina en ${dias} días`}
                    </p>
                  )}
                  {r.notes && <p className="mt-2 text-[12px] text-muted">{r.notes}</p>}
                </div>

                <div className="mt-3 flex items-center gap-1">
                  {confirm === r.id ? (
                    <>
                      <span className="mr-auto text-xs text-ink-2">¿Eliminar habitación?</span>
                      <Button variant="danger" size="sm" onClick={() => remove("rooms", r.id)}>Eliminar</Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirm(null)}>No</Button>
                    </>
                  ) : (
                    <>
                      {libre && <Button variant="secondary" size="sm" icon={<KeyRound size={14} />} onClick={() => setForm({ room: r, status: "alquilada" })}>Alquilar</Button>}
                      <Button variant="ghost" size="sm" icon={<Pencil size={14} />} onClick={() => setForm({ room: r })}>Editar</Button>
                      <button type="button" onClick={() => setConfirm(r.id)} className="ml-auto rounded-lg p-1.5 text-muted hover:bg-page hover:text-gasto" aria-label={`Eliminar ${r.name}`}>
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {form && (
        <RoomForm
          key={form.room?.id ?? "nueva"}
          propertyId={p.id}
          initial={form.room}
          status={form.status}
          defaultName={`Habitación ${rooms.length + 1}`}
          onClose={() => setForm(null)}
        />
      )}
    </>
  );
}
