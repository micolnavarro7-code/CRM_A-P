"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { beneficioReserva } from "@/lib/calc";
import { eurf, monthOf, nights, r2, todayISO, uid } from "@/lib/format";
import { useData } from "@/lib/store";
import type { Booking, Channel } from "@/lib/types";
import { CHANNEL } from "../domain";
import { Button, Checkbox, Field, Input, Modal, Select } from "../ui";

function blank(propertyId: string, cleaning: number): Booking {
  const t = todayISO();
  return {
    id: uid(), property_id: propertyId, guest_id: null, guest_name: "", channel: "booking", booking_ref: "",
    check_in: t, check_out: t, month: monthOf(t), price: 0, payout: 0, platform_fee: 0, cleaning, vat: 0,
    net_profit: 0, invoiced: false, notes: null,
  };
}

export function BookingForm({ onClose, initial, propertyId }: { onClose: () => void; initial?: Booking; propertyId?: string }) {
  const { db, insert, update } = useData();
  // Las propiedades en venta no tienen reservas.
  const alquileres = db.properties.filter((p) => p.category !== "venta" || p.id === initial?.property_id);
  const first = alquileres.find((p) => p.id === propertyId) ?? alquileres[0];
  const [b, setB] = useState<Booking>(() => initial ?? blank(first?.id ?? "", first?.default_cleaning ?? 0));
  // Si el usuario escribe a mano ingreso o beneficio, dejamos de recalcularlos.
  const [payoutManual, setPayoutManual] = useState(!!initial && r2(initial.price - initial.platform_fee) !== initial.payout);
  const [netManual, setNetManual] = useState(!!initial && beneficioReserva(initial) !== initial.net_profit);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function patch(p: Partial<Booking>, opts: { payoutManual?: boolean; netManual?: boolean } = {}) {
    const pm = opts.payoutManual ?? payoutManual;
    const nm = opts.netManual ?? netManual;
    setB((x) => {
      const n = { ...x, ...p };
      if (p.check_in && (!x.month || x.month === monthOf(x.check_in))) n.month = monthOf(p.check_in);
      if (!pm) n.payout = r2(n.price - n.platform_fee);
      if (!nm) n.net_profit = beneficioReserva(n);
      return n;
    });
  }
  const num = (v: string) => (v === "" ? 0 : Number(v));

  async function save() {
    if (!b.property_id) return setErr("Elige una propiedad.");
    if (b.check_out < b.check_in) return setErr("La salida no puede ser anterior a la entrada.");
    setSaving(true);
    setErr(null);
    try {
      const row = { ...b, booking_ref: b.booking_ref?.trim() || null, guest_name: b.guest_name?.trim() || null };
      if (initial) await update("bookings", b.id, row);
      else await insert("bookings", row);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const noches = nights(b.check_in, b.check_out);

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={initial ? "Editar reserva" : "Nueva reserva"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar reserva"}</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Propiedad" className="sm:col-span-2">
          <Select
            value={b.property_id}
            onChange={(e) => {
              const p = alquileres.find((x) => x.id === e.target.value);
              patch({ property_id: e.target.value, ...(initial ? {} : { cleaning: p?.default_cleaning ?? b.cleaning }) });
            }}
          >
            {alquileres.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field label="Canal">
          <Select value={b.channel} onChange={(e) => patch({ channel: e.target.value as Channel, ...(e.target.value === "propia" ? { platform_fee: 0 } : {}) })}>
            {(Object.keys(CHANNEL) as Channel[]).map((c) => <option key={c} value={c}>{CHANNEL[c].label}</option>)}
          </Select>
        </Field>
        <Field label="Entrada"><Input type="date" value={b.check_in} onChange={(e) => patch({ check_in: e.target.value })} /></Field>
        <Field label="Salida" hint={noches >= 0 ? `${noches} noche${noches === 1 ? "" : "s"}` : undefined}>
          <Input type="date" value={b.check_out} onChange={(e) => patch({ check_out: e.target.value })} />
        </Field>
        <Field label="Mes contable" hint="Por defecto, el mes de entrada">
          <Input type="month" value={b.month.slice(0, 7)} onChange={(e) => e.target.value && patch({ month: `${e.target.value}-01` })} />
        </Field>
        <Field label="Nº de reserva" hint={b.channel === "propia" ? "Opcional en reservas propias" : undefined}>
          <Input value={b.booking_ref ?? ""} onChange={(e) => patch({ booking_ref: e.target.value })} />
        </Field>
        <Field label="Huésped" className="sm:col-span-2"><Input value={b.guest_name ?? ""} onChange={(e) => patch({ guest_name: e.target.value })} /></Field>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-page/50 p-4">
        <p className="mb-3 text-sm font-semibold">Importes</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Precio (paga el huésped)"><Input type="number" step="0.01" value={b.price || ""} onChange={(e) => patch({ price: num(e.target.value) })} /></Field>
          <Field label="Comisión plataforma"><Input type="number" step="0.01" value={b.platform_fee || ""} onChange={(e) => patch({ platform_fee: num(e.target.value) })} /></Field>
          <Field label="Ingreso (liquida la plataforma)" hint={payoutManual ? "Editado a mano" : "= precio − comisión"}>
            <div className="flex gap-1">
              <Input type="number" step="0.01" value={b.payout || ""} onChange={(e) => { setPayoutManual(true); patch({ payout: num(e.target.value) }, { payoutManual: true }); }} />
              {payoutManual && <Recalc onClick={() => { setPayoutManual(false); patch({}, { payoutManual: false }); }} />}
            </div>
          </Field>
          <Field label="Limpieza"><Input type="number" step="0.01" value={b.cleaning || ""} onChange={(e) => patch({ cleaning: num(e.target.value) })} /></Field>
          <Field label="IVA (si aplica)"><Input type="number" step="0.01" value={b.vat || ""} onChange={(e) => patch({ vat: num(e.target.value) })} /></Field>
          <Field label="Beneficio neto" hint={netManual ? "Editado a mano" : "= ingreso − limpieza"}>
            <div className="flex gap-1">
              <Input type="number" step="0.01" value={b.net_profit || ""} className="font-semibold text-beneficio" onChange={(e) => { setNetManual(true); patch({ net_profit: num(e.target.value) }, { netManual: true }); }} />
              {netManual && <Recalc onClick={() => { setNetManual(false); patch({}, { netManual: false }); }} />}
            </div>
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <Checkbox label="Facturado" checked={b.invoiced} onChange={(v) => patch({ invoiced: v })} />
          <p className="text-sm text-ink-2">
            Beneficio: <span className="num font-bold text-beneficio">{eurf(b.net_profit)}</span>
          </p>
        </div>
      </div>
      {err && <p className="mt-4 rounded-xl bg-gasto/10 px-3 py-2 text-sm text-[#b54848]">{err}</p>}
    </Modal>
  );
}

function Recalc({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title="Volver a calcular automáticamente" className="grid size-10 shrink-0 place-items-center rounded-xl border border-line text-muted hover:text-blue-brand">
      <RotateCcw size={15} />
    </button>
  );
}
