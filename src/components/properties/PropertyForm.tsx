"use client";

import { useState } from "react";
import { todayISO, uid } from "@/lib/format";
import { useData } from "@/lib/store";
import type { Category, Property } from "@/lib/types";
import { CATEGORIES, CATEGORY, MODEL, PROPERTY_TYPES, STATUS } from "../domain";
import { Button, Checkbox, cx, Field, Input, Modal, Select } from "../ui";

const NEW_OWNER = "__nuevo__";

function blank(category: Category): Property {
  return {
    id: uid(), category, code: "", name: "", address: "", city: "", type: "Piso",
    status: "disponible", price: null, bedrooms: null, bathrooms: null,
    built_m2: null, useful_m2: null, owner_id: null, business_model: "gestion", agency_pct: 0.25,
    cleaning_by_owner: false, default_cleaning: 0, photo_url: null, tags: [], updated_at: todayISO(),
  };
}

const numOrNull = (v: string) => (v === "" ? null : Number(v));

// En habitaciones no hay precio del piso: la renta es la suma de sus habitaciones.
const PRICE: Partial<Record<Category, { label: string; hint?: string }>> = {
  turistico: { label: "Precio (€ /mes)", hint: "Si lo dejas vacío se muestra la media mensual de reservas." },
  venta: { label: "Precio de venta (€)" },
};

export function PropertyForm({ open, onClose, initial, category = "turistico" }: { open: boolean; onClose: () => void; initial?: Property; category?: Category }) {
  const { db, insert, update } = useData();
  const [p, setP] = useState<Property>(() => initial ?? blank(category));
  const [ownerName, setOwnerName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof Property>(k: K, v: Property[K]) => setP((x) => ({ ...x, [k]: v }));
  const owners = db.contacts.filter((c) => c.type === "propietario");
  const venta = p.category === "venta";

  // Cada categoría tiene sus estados; si el actual no existe en la nueva, vuelve a «Disponible».
  const setCategory = (c: Category) =>
    setP((x) => ({ ...x, category: c, status: CATEGORY[c].statuses.includes(x.status) ? x.status : "disponible" }));

  async function save() {
    if (!p.name.trim()) return setErr("El nombre es obligatorio.");
    setSaving(true);
    setErr(null);
    try {
      let owner_id = p.owner_id;
      if (owner_id === NEW_OWNER) {
        if (!ownerName.trim()) throw new Error("Escribe el nombre del nuevo propietario.");
        owner_id = uid();
        await insert("contacts", { id: owner_id, type: "propietario", name: ownerName.trim(), email: null, phone: null, nif: null, iban: null, category: null, notes: null });
      }
      const row = { ...p, owner_id, code: p.code || null, updated_at: todayISO() };
      if (initial) await update("properties", p.id, row);
      else await insert("properties", row);
      onClose();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const ownerSelect = (
    <Field label="Propietario">
      <Select value={p.owner_id ?? ""} onChange={(e) => set("owner_id", e.target.value || null)}>
        <option value="">— Sin asignar —</option>
        {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        <option value={NEW_OWNER}>+ Nuevo propietario…</option>
      </Select>
    </Field>
  );
  const ownerNew = p.owner_id === NEW_OWNER ? (
    <Field label="Nombre del nuevo propietario"><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} /></Field>
  ) : <div className="hidden sm:block" />;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title={initial ? `Editar ${initial.name}` : "Agregar propiedad"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </>
      }
    >
      <div className="mb-5 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Categoría">
        {CATEGORIES.map((c) => {
          const Icon = CATEGORY[c].icon;
          const on = p.category === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setCategory(c)}
              className={cx(
                "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition",
                on ? "border-blue-brand bg-blue-brand/5 text-ink ring-2 ring-blue-brand/15" : "border-line text-ink-2 hover:border-blue-brand/40",
              )}
            >
              <span className={cx("grid size-8 shrink-0 place-items-center rounded-lg", CATEGORY[c].cls)}><Icon size={16} /></span>
              {CATEGORY[c].label}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre *"><Input value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Laxe" /></Field>
        <Field label="Código"><Input value={p.code ?? ""} onChange={(e) => set("code", e.target.value)} placeholder="Ej. LAX-01" /></Field>
        <Field label="Dirección" className="sm:col-span-2"><Input value={p.address ?? ""} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Ciudad"><Input value={p.city ?? ""} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Tipo">
          <Select value={p.type} onChange={(e) => set("type", e.target.value)}>
            {/* Conserva tipos antiguos que ya no están en la lista. */}
            {[...new Set([...PROPERTY_TYPES, p.type])].map((t) => <option key={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Estado">
          <Select value={p.status} onChange={(e) => set("status", e.target.value as Property["status"])}>
            {[...new Set([...CATEGORY[p.category].statuses, p.status])].map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </Select>
        </Field>
        {PRICE[p.category] ? (
          <Field label={PRICE[p.category]!.label} hint={PRICE[p.category]!.hint}>
            <Input type="number" step="0.01" min="0" value={p.price ?? ""} onChange={(e) => set("price", numOrNull(e.target.value))} />
          </Field>
        ) : (
          <p className="self-end pb-2 text-xs text-muted">La renta se calcula con las habitaciones, que se agregan desde la ficha del piso.</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Habitaciones"><Input type="number" min="0" value={p.bedrooms ?? ""} onChange={(e) => set("bedrooms", numOrNull(e.target.value))} /></Field>
          <Field label="Baños"><Input type="number" min="0" value={p.bathrooms ?? ""} onChange={(e) => set("bathrooms", numOrNull(e.target.value))} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="m² construidos"><Input type="number" min="0" value={p.built_m2 ?? ""} onChange={(e) => set("built_m2", numOrNull(e.target.value))} /></Field>
          <Field label="m² útiles"><Input type="number" min="0" value={p.useful_m2 ?? ""} onChange={(e) => set("useful_m2", numOrNull(e.target.value))} /></Field>
        </div>
        <Field label="Foto (URL)" className="sm:col-span-2"><Input value={p.photo_url ?? ""} onChange={(e) => set("photo_url", e.target.value || null)} placeholder="https://…" /></Field>

        <div className="rounded-2xl border border-line bg-page/50 p-4 sm:col-span-2">
          <p className="mb-3 text-sm font-semibold">{venta ? "Propietario" : "Propietario y modelo de negocio"}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {ownerSelect}
            {ownerNew}
            {!venta && (
              <>
                <Field label="Modelo de negocio">
                  <Select value={p.business_model} onChange={(e) => set("business_model", e.target.value as Property["business_model"])}>
                    {Object.entries(MODEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
                {p.business_model === "gestion" ? (
                  <Field label="% agencia sobre el beneficio" hint="Laxe 25 %, Cuéllar 50 %">
                    <Input type="number" min="0" max="100" step="0.5" value={Math.round(p.agency_pct * 1000) / 10} onChange={(e) => set("agency_pct", Number(e.target.value) / 100)} />
                  </Field>
                ) : <div className="hidden sm:block" />}
                <Field label="Limpieza por defecto (€)"><Input type="number" step="0.01" min="0" value={p.default_cleaning} onChange={(e) => set("default_cleaning", Number(e.target.value))} /></Field>
                {p.business_model === "gestion" && (
                  <div className="flex items-end pb-2">
                    <Checkbox label="La limpieza la hace el propietario (se le abona)" checked={p.cleaning_by_owner} onChange={(v) => set("cleaning_by_owner", v)} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      {err && <p className="mt-4 rounded-xl bg-gasto/10 px-3 py-2 text-sm text-[#b54848]">{err}</p>}
    </Modal>
  );
}
