"use client";

import { Download, Search } from "lucide-react";
import { useState } from "react";
import { ContractsTable, statsContratos } from "@/components/rooms/Contracts";
import { Button, Card, FilterChip, PageBanner, Select, StatStrip } from "@/components/ui";
import { downloadCSV } from "@/lib/export";
import { datef, todayISO } from "@/lib/format";
import { AVISO_DIAS, contratos, resumenContratos, type Contrato } from "@/lib/stats";
import { useData } from "@/lib/store";

type Filtro = "todos" | "pendientes" | "por_vencer" | "vencidos" | "hechos";

const FILTROS: { v: Filtro; label: string; test: (c: Contrato) => boolean }[] = [
  { v: "todos", label: "Todos", test: () => true },
  { v: "pendientes", label: "Pendientes", test: (c) => !c.room.contract_done },
  { v: "por_vencer", label: `Vencen en ${AVISO_DIAS} días`, test: (c) => c.dias != null && c.dias >= 0 && c.dias <= AVISO_DIAS },
  { v: "vencidos", label: "Vencidos", test: (c) => c.dias != null && c.dias < 0 },
  { v: "hechos", label: "Hechos", test: (c) => c.room.contract_done },
];

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Contratos() {
  const { db } = useData();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pid, setPid] = useState("");
  const [q, setQ] = useState("");

  const todos = contratos(db);
  const pisos = [...new Map(todos.map((c) => [c.property.id, c.property])).values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
  const base = todos.filter((c) => (!pid || c.property.id === pid) && (!q || norm(c.room.tenant_name).includes(norm(q.trim()))));
  const lista = base.filter(FILTROS.find((f) => f.v === filtro)!.test);

  function exportar() {
    downloadCSV(
      `contratos-${todayISO()}`,
      ["Piso", "Habitación", "Estado habitación", "Inquilino", "Renta €/mes", "Inicio", "Fin", "Contrato"],
      lista.map(({ room: r, property: p }) => [
        p.name, r.name, r.status === "alquilada" ? "Alquilada" : "Reservada", r.tenant_name, r.rent,
        r.start_date ? datef(r.start_date) : null, r.end_date ? datef(r.end_date) : null, r.contract_done ? "Hecho" : "Pendiente",
      ]),
    );
  }

  return (
    <>
      <PageBanner title="Contratos" sub="Un contrato por cada habitación alquilada o reservada">
        <Button variant="onDark" icon={<Download size={16} />} onClick={exportar} disabled={!lista.length}>Exportar</Button>
      </PageBanner>

      <StatStrip items={statsContratos(resumenContratos(base))} />

      <Card className="mt-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative sm:w-72">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar inquilino" className="h-10 w-full rounded-xl border border-line bg-page pr-3 pl-9 text-sm outline-none focus:border-blue-brand focus:bg-card" />
          </div>
          <Select value={pid} onChange={(e) => setPid(e.target.value)} className="sm:w-64" aria-label="Piso">
            <option value="">Todos los pisos</option>
            {pisos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </div>
        <div className="scroll-thin -mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {FILTROS.map((f) => (
            <FilterChip key={f.v} active={filtro === f.v} count={base.filter(f.test).length} onClick={() => setFiltro(f.v)}>
              {f.label}
            </FilterChip>
          ))}
        </div>
      </Card>

      <Card className="mt-4 !p-0">
        <ContractsTable items={lista} />
      </Card>
    </>
  );
}
