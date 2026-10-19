"use client";

import { useState } from "react";
import { eurf, uid } from "@/lib/format";
import { useData } from "@/lib/store";
import type { Room, RoomStatus } from "@/lib/types";
import { ROOM_STATUS, ROOM_STATUSES } from "../domain";
import { Button, Checkbox, cx, Field, Input, Modal } from "../ui";

const numOrNull = (v: string) => (v === "" ? null : Number(v));

/**
 * Alta y edición de una habitación. `status` fuerza el estado inicial
 * (p. ej. «Alquilar» sobre una habitación libre).
 */
export function RoomForm({ propertyId, initial, status, defaultName, onClose }: { propertyId: string; initial?: Room; status?: RoomStatus; defaultName?: string; onClose: () => void }) {
  const { insert, update } = useData();
  const [r, setR] = useState<Room>(() => ({
    ...(initial ?? {
      id: uid(), property_id: propertyId, name: defaultName ?? "", status: "libre", rent: 0, size_m2: null,
      private_bath: false, tenant_name: null, contract_done: false, start_date: null, end_date: null, notes: null,
    }),
    ...(status ? { status } : {}),
  }));
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Room>(k: K, v: Room[K]) => setR((x) => ({ ...x, [k]: v }));
  const ocupada = r.status !== "libre";

  async function save() {
    if (!r.name.trim()) return setErr("Ponle un nombre a la habitación.");
    if (r.status === "alquilada" && !r.tenant_name?.trim()) return setErr("Escribe el nombre del inquilino.");
    if (ocupada && r.start_date && r.end_date && r.end_date < r.start_date) return setErr("El fin de contrato no puede ser anterior a la entrada.");
    setSaving(true);
    setErr(null);
    try {
      // Al dejarla libre se borran los datos del inquilino y de su contrato.
      const row: Room = ocupada
        ? { ...r, name: r.name.trim(), tenant_name: r.tenant_name?.trim() || null, notes: r.notes?.trim() || null }
        : { ...r, name: r.name.trim(), tenant_name: null, contract_done: false, start_date: null, end_date: null, notes: r.notes?.trim() || null };
      if (initial) await update("rooms", r.id, row);
      else await insert("rooms", row);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? `Editar ${initial.name}` : "Agregar habitación"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre *" className="sm:col-span-2"><Input value={r.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Habitación 1 · exterior" /></Field>

        <div className="sm:col-span-2">
          <span className="text-[13px] font-medium text-ink-2">Estado</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Estado">
            {ROOM_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={r.status === s}
                onClick={() => set("status", s)}
                className={cx(
                  "flex h-10 items-center justify-center gap-2 rounded-xl border text-sm font-medium transition",
                  r.status === s ? "border-blue-brand bg-blue-brand/5 text-ink ring-2 ring-blue-brand/15" : "border-line text-ink-2 hover:border-blue-brand/40",
                )}
              >
                <span className="size-2.5 rounded-full" style={{ background: ROOM_STATUS[s].color }} />
                {ROOM_STATUS[s].label}
              </button>
            ))}
          </div>
        </div>

        <Field label="Renta (€ /mes)"><Input type="number" step="0.01" min="0" value={r.rent || ""} onChange={(e) => set("rent", Number(e.target.value || 0))} /></Field>
        <Field label="Tamaño (m²)"><Input type="number" step="0.5" min="0" value={r.size_m2 ?? ""} onChange={(e) => set("size_m2", numOrNull(e.target.value))} /></Field>
        <div className="sm:col-span-2">
          <Checkbox label="Baño privado" checked={r.private_bath} onChange={(v) => set("private_bath", v)} />
        </div>

        {ocupada && (
          <div className="grid gap-4 rounded-2xl border border-line bg-page/50 p-4 sm:col-span-2 sm:grid-cols-2">
            <p className="text-sm font-semibold sm:col-span-2">Inquilino y contrato</p>
            <Field label={r.status === "alquilada" ? "Inquilino *" : "Inquilino"} className="sm:col-span-2">
              <Input value={r.tenant_name ?? ""} onChange={(e) => set("tenant_name", e.target.value)} />
            </Field>
            <Field label="Inicio del contrato"><Input type="date" value={r.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} /></Field>
            <Field label="Fin del contrato"><Input type="date" value={r.end_date ?? ""} onChange={(e) => set("end_date", e.target.value || null)} /></Field>
            <div className="sm:col-span-2">
              <Checkbox label="Contrato hecho" checked={r.contract_done} onChange={(v) => set("contract_done", v)} />
              <p className="mt-1 text-xs text-muted">La renta del contrato es la de la habitación ({r.rent ? `${eurf(r.rent)} /mes` : "sin indicar"}).</p>
            </div>
          </div>
        )}

        <Field label="Notas" className="sm:col-span-2"><Input value={r.notes ?? ""} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
      {err && <p className="mt-4 rounded-xl bg-gasto/10 px-3 py-2 text-sm text-[#b54848]">{err}</p>}
    </Modal>
  );
}
