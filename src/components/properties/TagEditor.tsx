"use client";

import { Plus, X } from "lucide-react";
import { useState } from "react";
import { todayISO } from "@/lib/format";
import { useData } from "@/lib/store";
import type { Property } from "@/lib/types";
import { TAG_COLORS } from "../domain";
import { cx } from "../ui";

/** Etiquetas de color editables en línea. Detiene la propagación para usarse dentro de enlaces. */
export function TagEditor({ property, className }: { property: Property; className?: string }) {
  const { update } = useData();
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);

  const save = (tags: Property["tags"]) => update("properties", property.id, { tags, updated_at: todayISO() });
  const stop = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className={cx("flex flex-wrap items-center gap-1.5", className)} onClick={stop}>
      {property.tags.map((t, i) => (
        <span key={t.label + i} className="group inline-flex items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2 text-[11px] font-medium" style={{ background: `${t.color}1f`, color: t.color }}>
          {t.label}
          <button
            type="button"
            onClick={(e) => {
              stop(e);
              save(property.tags.filter((_, j) => j !== i));
            }}
            className="rounded-full opacity-50 hover:opacity-100"
            aria-label={`Quitar etiqueta ${t.label}`}
          >
            <X size={11} />
          </button>
        </span>
      ))}
      {adding ? (
        <form
          className="inline-flex items-center gap-1 rounded-full border border-line bg-card py-0.5 pr-1 pl-2"
          onSubmit={(e) => {
            stop(e);
            if (label.trim()) save([...property.tags, { label: label.trim(), color }]);
            setLabel("");
            setAdding(false);
          }}
        >
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
            placeholder="Etiqueta"
            className="w-20 bg-transparent text-[11px] outline-none"
          />
          {TAG_COLORS.slice(0, 5).map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={cx("size-3.5 rounded-full", color === c && "ring-2 ring-offset-1")} style={{ background: c, ["--tw-ring-color" as string]: c }} aria-label="Color" />
          ))}
          <button type="submit" className="ml-0.5 rounded-full bg-blue-brand px-1.5 text-[11px] font-medium text-white">
            OK
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            stop(e);
            setAdding(true);
          }}
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] font-medium text-muted hover:border-blue-brand hover:text-blue-brand"
        >
          <Plus size={11} /> Etiqueta
        </button>
      )}
    </div>
  );
}
