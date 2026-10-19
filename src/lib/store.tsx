"use client";

// Almacén de datos de la app. Carga todas las tablas al inicio (el volumen de
// una gestora cabe de sobra en memoria) y expone CRUD genérico por tabla.
//   · Con Supabase configurado → lee/escribe en Postgres.
//   · Sin credenciales         → modo local: datos de ejemplo en localStorage.

import type { SupabaseClient } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { buildSeed, ejemplosHabitaciones } from "./seed";
import { supabase } from "./supabase";
import { TABLES, type DB, type Property, type TableName, type Tables } from "./types";

const LS_KEY = "ap-crm-db-v1";

const empty = (): DB => Object.fromEntries(TABLES.map((t) => [t, []])) as unknown as DB;

function loadLocal(): DB {
  return readLocal() ?? buildSeed();
}

/** Datos guardados en este navegador (modo local), ya migrados al formato actual; null si no hay. */
export function readLocal(): DB | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const db: DB = { ...empty(), ...saved };
      // Datos guardados antes de la simplificación (portafolios, operación alquiler/venta).
      delete (db as Partial<Record<string, unknown>>).portfolios;
      db.properties = db.properties.map(migrarPropiedad);
      // Datos anteriores a las habitaciones: se añaden una vez los pisos de ejemplo.
      if (!("rooms" in saved)) {
        const ej = ejemplosHabitaciones();
        const ids = new Set(db.properties.map((p) => p.id));
        db.properties.push(...ej.properties.filter((p) => !ids.has(p.id)));
        db.rooms = ej.rooms.filter((r) => !ids.has(r.property_id));
        saveLocal(db);
      }
      // Habitaciones anteriores a los contratos: las de ejemplo toman su valor, el resto queda pendiente.
      if (db.rooms.some((r) => r.contract_done === undefined)) {
        const ej = new Map(ejemplosHabitaciones().rooms.map((r) => [`${r.property_id}|${r.name}`, r.contract_done]));
        db.rooms = db.rooms.map((r) => (r.contract_done === undefined ? { ...r, contract_done: ej.get(`${r.property_id}|${r.name}`) ?? false } : r));
        saveLocal(db);
      }
      return db;
    }
  } catch {}
  return null;
}

/** Pasa una propiedad del formato antiguo (operation + 7 estados) al de categorías. */
function migrarPropiedad(old: Property & { operation?: string; portfolio_id?: string | null }): Property {
  const p = { ...old };
  const operation = p.operation;
  delete p.operation;
  delete p.portfolio_id;
  const status = (p.status as string) === "disponible_alquiler" || (p.status as string) === "disponible_venta" ? "disponible" : p.status;
  const category = p.category ?? (operation === "venta" ? "venta" : p.type === "Habitación" ? "habitaciones" : "turistico");
  const type = p.type === "Piso turístico" || p.type === "Habitación" ? "Piso" : p.type;
  // En habitaciones la ocupación va por habitación: el piso solo está disponible o en remodelación.
  return { ...p, category, status: category === "habitaciones" && status === "alquilada" ? "disponible" : status, type };
}
function saveLocal(db: DB) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch {}
}

type Store = {
  db: DB;
  ready: boolean;
  mode: "local" | "supabase";
  error: string | null;
  insert: <T extends TableName>(table: T, rows: Tables[T] | Tables[T][]) => Promise<void>;
  update: <T extends TableName>(table: T, id: string, patch: Partial<Tables[T]>) => Promise<void>;
  remove: <T extends TableName>(table: T, id: string) => Promise<void>;
  /** Solo modo local: vuelve a los datos de ejemplo. */
  resetLocal: () => void;
  /** Sube los datos de ejemplo a Supabase (tablas vacías). */
  seedRemote: () => Promise<void>;
  /** Sube a Supabase los datos guardados en este navegador en modo local (tablas vacías). */
  uploadLocal: () => Promise<void>;
};

// Supabase devuelve como mucho 1000 filas por consulta: se piden por páginas.
const PAGE = 1000;
// Tablas con created_at: se cargan en orden de alta, como en modo local.
const CON_ALTA = new Set<TableName>(["contacts", "properties", "rooms", "bookings", "transactions"]);

async function fetchAll(sb: SupabaseClient, t: TableName) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = sb.from(t).select("*");
    if (CON_ALTA.has(t)) q = q.order("created_at");
    const { data, error } = await q.order("id").range(from, from + PAGE - 1);
    if (error) throw new Error(`${t}: ${error.message}`);
    // numeric llega como string desde PostgREST
    rows.push(...data.map(numerify));
    if (data.length < PAGE) return rows;
  }
}

/** Sube un juego de datos completo respetando las claves foráneas. Con upsert, si
 *  algo falla a medias se puede reintentar sin duplicar filas. */
async function uploadAll(sb: SupabaseClient, source: DB) {
  for (const t of TABLES) {
    const rows = source[t] as Record<string, unknown>[];
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await sb.from(t).upsert(rows.slice(i, i + 500));
      if (error) throw new Error(`${t}: ${error.message}`);
    }
  }
}

const Ctx = createContext<Store | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mode = supabase ? "supabase" : "local";

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!supabase) {
        const local = loadLocal();
        if (!cancel) {
          setDb(local);
          setReady(true);
        }
        return;
      }
      const next = empty();
      // Sin fila en team_members, RLS devuelve las tablas vacías: mejor decirlo.
      const yo = await supabase.from("team_members").select("user_id").limit(1);
      if (!yo.error && !yo.data.length) {
        setError("tu usuario no tiene acceso a los datos del CRM. Pide que te den de alta en el equipo (tabla team_members).");
      } else {
        const res = await Promise.allSettled(TABLES.map((t) => fetchAll(supabase!, t)));
        res.forEach((r, i) => {
          if (r.status === "fulfilled") (next[TABLES[i]] as unknown[]) = r.value;
          else setError((r.reason as Error).message);
        });
      }
      if (!cancel) {
        setDb(next);
        setReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const commit = useCallback(
    (fn: (d: DB) => DB) =>
      setDb((prev) => {
        const next = fn(prev);
        if (!supabase) saveLocal(next);
        return next;
      }),
    [],
  );

  const insert: Store["insert"] = useCallback(
    async (table, rows) => {
      const list = Array.isArray(rows) ? rows : [rows];
      if (supabase) {
        const { error } = await supabase.from(table).insert(list as Record<string, unknown>[]);
        if (error) throw new Error(error.message);
      }
      commit((d) => ({ ...d, [table]: [...d[table], ...list] }));
    },
    [commit],
  );

  const update: Store["update"] = useCallback(
    async (table, id, patch) => {
      if (supabase) {
        const { error } = await supabase.from(table).update(patch as Record<string, unknown>).eq("id", id);
        if (error) throw new Error(error.message);
      }
      commit((d) => ({ ...d, [table]: (d[table] as { id: string }[]).map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
    },
    [commit],
  );

  const remove: Store["remove"] = useCallback(
    async (table, id) => {
      if (supabase) {
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw new Error(error.message);
      }
      commit((d) => {
        const next = { ...d, [table]: (d[table] as { id: string }[]).filter((r) => r.id !== id) } as DB;
        // Replica el "on delete cascade" del esquema.
        if (table === "properties") {
          next.rooms = d.rooms.filter((r) => r.property_id !== id);
          next.bookings = d.bookings.filter((b) => b.property_id !== id);
          next.monthly_costs = d.monthly_costs.filter((c) => c.property_id !== id);
          next.maintenance_tickets = d.maintenance_tickets.filter((t) => t.property_id !== id);
          next.documents = d.documents.filter((x) => x.property_id !== id);
        }
        return next;
      });
    },
    [commit],
  );

  const resetLocal = useCallback(() => {
    const seed = buildSeed();
    saveLocal(seed);
    setDb(seed);
  }, []);

  const seedRemote = useCallback(async () => {
    if (!supabase) return;
    const seed = buildSeed();
    await uploadAll(supabase, seed);
    setDb(seed);
  }, []);

  const uploadLocal = useCallback(async () => {
    const local = readLocal();
    if (!supabase || !local) return;
    await uploadAll(supabase, local);
    setDb(local);
  }, []);

  const value = useMemo(
    () => ({ db, ready, mode, error, insert, update, remove, resetLocal, seedRemote, uploadLocal }) as Store,
    [db, ready, mode, error, insert, update, remove, resetLocal, seedRemote, uploadLocal],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const NUMERIC = new Set([
  "price", "payout", "platform_fee", "cleaning", "vat", "net_profit", "rent", "electricity", "water", "internet",
  "amount", "returned_amount", "base", "total", "cost", "agency_pct", "default_cleaning", "built_m2", "useful_m2", "size", "size_m2",
]);
function numerify(row: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...row };
  for (const k in out) if (NUMERIC.has(k) && typeof out[k] === "string") out[k] = Number(out[k]);
  return out;
}

export function useData() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useData fuera de DataProvider");
  return s;
}
