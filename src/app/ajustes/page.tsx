"use client";

import { CloudUpload, Database, HardDrive, MonitorUp, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button, Card, PageBanner } from "@/components/ui";
import { readLocal, useData } from "@/lib/store";

export default function Ajustes() {
  const { mode, db, resetLocal, seedRemote, uploadLocal } = useData();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  // Datos que quedaron en este navegador de cuando el CRM funcionaba en modo local.
  const [local] = useState(() => (mode === "supabase" ? readLocal() : null));
  const vacio = db.properties.length === 0 && db.bookings.length === 0;
  const subir = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      setMsg(ok);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    }
    setBusy(false);
  };

  return (
    <>
      <PageBanner title="Ajustes" sub="Origen de los datos y datos de ejemplo" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Origen de datos">
          <div className="flex items-start gap-3">
            <span className="bg-brand grid size-10 shrink-0 place-items-center rounded-xl text-white">
              {mode === "local" ? <HardDrive size={18} /> : <Database size={18} />}
            </span>
            <div className="text-sm">
              <p className="font-semibold">{mode === "local" ? "Modo local (navegador)" : "Supabase"}</p>
              <p className="mt-1 text-ink-2">
                {mode === "local"
                  ? "Los datos se guardan solo en este navegador. Para compartirlos con el equipo, conecta Supabase: crea un proyecto, ejecuta supabase/migrations/0001_schema.sql y rellena .env.local (ver .env.local.example)."
                  : "Conectado a la base de datos compartida. Todos los usuarios ven los mismos datos."}
              </p>
              <p className="num mt-3 text-xs text-muted">
                {db.properties.length} propiedades · {db.rooms.length} habitaciones · {db.bookings.length} reservas · {db.monthly_costs.length} meses de gastos fijos
              </p>
            </div>
          </div>
        </Card>

        <Card title="Datos de ejemplo">
          <p className="text-sm text-ink-2">
            Laxe, Cuéllar y Dénia con reservas generadas a partir de los totales reales de 2026 (enero–agosto), de modo que los resúmenes anuales cuadran con las hojas de Excel. Además, dos pisos por habitaciones de ejemplo (Malasaña y Ruzafa).
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {mode === "local" ? (
              confirm ? (
                <>
                  <span className="text-sm">Se perderán los cambios hechos en este navegador.</span>
                  <Button variant="danger" size="sm" onClick={() => { resetLocal(); setConfirm(false); setMsg("Datos de ejemplo restaurados."); }}>Restaurar</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Cancelar</Button>
                </>
              ) : (
                <Button variant="secondary" icon={<RotateCcw size={16} />} onClick={() => setConfirm(true)}>Restaurar datos de ejemplo</Button>
              )
            ) : (
              <Button
                variant="secondary"
                icon={<CloudUpload size={16} />}
                disabled={!vacio || busy}
                title={vacio ? undefined : "Solo disponible con la base de datos vacía"}
                onClick={() => subir(seedRemote, "Datos de ejemplo cargados en Supabase.")}
              >
                Cargar datos de ejemplo en Supabase
              </Button>
            )}
          </div>
        </Card>

        {local && (
          <Card title="Datos guardados en este navegador">
            <p className="text-sm text-ink-2">
              Este navegador conserva los datos de cuando el CRM funcionaba en modo local. Súbelos a Supabase para seguir con ellos y que todo el equipo los vea.
            </p>
            <p className="num mt-3 text-xs text-muted">
              {local.properties.length} propiedades · {local.rooms.length} habitaciones · {local.bookings.length} reservas · {local.monthly_costs.length} meses de gastos fijos
            </p>
            <div className="mt-4">
              <Button
                variant="secondary"
                icon={<MonitorUp size={16} />}
                disabled={!vacio || busy}
                title={vacio ? undefined : "Solo disponible con la base de datos vacía"}
                onClick={() => subir(uploadLocal, "Datos de este navegador subidos a Supabase.")}
              >
                {busy ? "Subiendo…" : "Subir a Supabase"}
              </Button>
            </div>
          </Card>
        )}
      </div>
      {msg && <p className={`mt-4 text-sm ${msg.startsWith("Error") ? "text-[#b54848]" : "text-ingreso"}`}>{msg}</p>}
    </>
  );
}
