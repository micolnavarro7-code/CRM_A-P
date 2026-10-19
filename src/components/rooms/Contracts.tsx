"use client";

import { FileCheck2, FileClock, FileSignature, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { datef, eur0f, eurf } from "@/lib/format";
import { AVISO_DIAS, type Contrato, type ResumenContratos } from "@/lib/stats";
import { useData } from "@/lib/store";
import type { Room } from "@/lib/types";
import { fichaUrl, RoomBadge } from "../domain";
import { cx, Empty, type Stat } from "../ui";
import { RoomForm } from "./RoomForm";

/** Estado del contrato de una habitación; al pulsarlo cambia entre hecho y pendiente. */
export function ContractToggle({ room, short, className }: { room: Room; short?: boolean; className?: string }) {
  const { update } = useData();
  const done = room.contract_done;
  const Icon = done ? FileCheck2 : FileClock;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        update("rooms", room.id, { contract_done: !done });
      }}
      title={done ? "Contrato hecho. Pulsa para marcarlo como pendiente." : "Contrato pendiente. Pulsa cuando esté hecho."}
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap transition hover:brightness-95",
        done ? "bg-[#DCFCE7] text-[#15803D]" : "bg-[#FEF3C7] text-[#B45309]",
        className,
      )}
    >
      <Icon size={13} />
      {short ? (done ? "Hecho" : "Pendiente") : done ? "Contrato hecho" : "Contrato pendiente"}
    </button>
  );
}

/** «en 27 días», «en 8 meses», «vencido»… */
export function Vence({ dias }: { dias: number | null }) {
  if (dias == null) return <span className="text-muted">Sin fecha de fin</span>;
  if (dias < 0) return <span className="font-medium text-[#b54848]">Vencido hace {-dias} {dias === -1 ? "día" : "días"}</span>;
  if (dias === 0) return <span className="font-medium text-[#B45309]">Hoy</span>;
  const texto = dias > 60 ? `en ${Math.round(dias / 30)} meses` : `en ${dias} ${dias === 1 ? "día" : "días"}`;
  return <span className={cx(dias <= AVISO_DIAS && "font-medium text-[#B45309]")}>{texto}</span>;
}

/** Cifras de cabecera de los contratos (Panel y página Contratos). */
export function statsContratos(r: ResumenContratos): Stat[] {
  return [
    { label: "Contratos", value: r.total, sub: `${eur0f(r.renta)} /mes de renta` },
    { label: "Hechos", value: r.hechos, tone: "text-[#15803D]", sub: r.total ? `${Math.round((r.hechos / r.total) * 100)} % del total` : undefined },
    { label: "Pendientes", value: r.pendientes, tone: r.pendientes ? "text-[#B45309]" : undefined, sub: r.pendientes ? "Falta hacerlos" : "Todos hechos" },
    {
      label: "Por vencer",
      value: r.porVencer,
      tone: r.porVencer || r.vencidos ? "text-gasto" : undefined,
      sub: r.vencidos ? `Y ${r.vencidos} ${r.vencidos === 1 ? "vencido" : "vencidos"}` : `En los próximos ${AVISO_DIAS} días`,
    },
  ];
}

/** Tabla de contratos. Con `limit` muestra solo los primeros (los más urgentes) y enlaza al resto. */
export function ContractsTable({ items, limit }: { items: Contrato[]; limit?: number }) {
  const [edit, setEdit] = useState<Room | null>(null);
  if (!items.length)
    return <Empty icon={<FileSignature size={32} />} title="No hay contratos">Al alquilar o reservar una habitación aparece aquí su contrato.</Empty>;
  const filas = limit ? items.slice(0, limit) : items;

  const th = "px-3 py-3 font-medium whitespace-nowrap";
  const td = "px-3 py-2.5 whitespace-nowrap";
  return (
    <>
      <div className="scroll-thin overflow-x-auto">
        <table className="num w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className={th}>Contrato</th>
              <th className={th}>Piso · Habitación</th>
              <th className={th}>Inquilino</th>
              <th className={cx(th, "text-right")}>Renta</th>
              <th className={th}>Inicio</th>
              <th className={th}>Fin</th>
              <th className={th}>Vence</th>
              <th className={th}><span className="sr-only">Editar</span></th>
            </tr>
          </thead>
          <tbody>
            {filas.map(({ room: r, property: p, dias }) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-page/60">
                <td className={td}><ContractToggle room={r} short /></td>
                <td className={td}>
                  <Link href={fichaUrl(p.id, "habitaciones")} className="font-medium hover:text-blue-brand">{p.name}</Link>
                  <span className="text-ink-2"> · {r.name}</span>
                  {r.status === "reservada" && <RoomBadge status="reservada" className="ml-2" />}
                </td>
                <td className={cx(td, "max-w-48 truncate")}>{r.tenant_name || "—"}</td>
                <td className={cx(td, "text-right font-semibold")}>{eur0f(r.rent)}<span className="font-normal text-muted"> /mes</span></td>
                <td className={td}>{datef(r.start_date)}</td>
                <td className={td}>{datef(r.end_date)}</td>
                <td className={td}><Vence dias={dias} /></td>
                <td className={cx(td, "text-right")}>
                  <button type="button" onClick={() => setEdit(r)} className="rounded-lg p-1.5 text-muted hover:bg-page hover:text-blue-brand" aria-label={`Editar ${p.name} · ${r.name}`}>
                    <Pencil size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {filas.length < items.length ? (
              <tr className="bg-page/70">
                <td className={td} colSpan={8}>
                  <Link href="/contratos" className="font-medium text-blue-brand hover:underline">
                    Ver los {items.length} contratos
                  </Link>
                  <span className="text-muted"> · se muestran primero los pendientes y los que vencen antes</span>
                </td>
              </tr>
            ) : (
              <tr className="bg-page/70 font-semibold">
                <td className={td} colSpan={3}>Total · {items.length} {items.length === 1 ? "contrato" : "contratos"}</td>
                <td className={cx(td, "text-right")}>{eurf(items.reduce((a, c) => a + c.room.rent, 0))}<span className="font-normal text-muted"> /mes</span></td>
                <td className={td} colSpan={4} />
              </tr>
            )}
          </tfoot>
        </table>
      </div>
      {edit && <RoomForm key={edit.id} propertyId={edit.property_id} initial={edit} onClose={() => setEdit(null)} />}
    </>
  );
}
