"use client";

import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

const cx = (...c: (string | false | 0 | null | undefined)[]) => c.filter(Boolean).join(" ");
export { cx };

// ---------------------------------------------------------------------
// Cabecera de sección: banner con degradado pizarra → azul
// ---------------------------------------------------------------------
export function PageBanner({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <header className="bg-brand mb-5 flex flex-col gap-4 rounded-[var(--radius-card)] px-5 py-6 text-white shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between md:px-7 md:py-7">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-white/80">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; variant?: "primary" | "secondary" | "ghost" | "onDark" | "danger"; size?: "sm" | "md" };

export function Button({ icon, variant = "primary", size = "md", className, children, ...rest }: BtnProps) {
  const v = {
    primary: "bg-cta text-white shadow-sm hover:brightness-105",
    secondary: "border border-blue-brand/30 bg-blue-brand/10 text-blue-brand hover:bg-blue-brand/15",
    onDark: "border border-white/35 bg-blue-brand/25 text-white backdrop-blur hover:bg-blue-brand/40",
    ghost: "text-ink-2 hover:bg-page",
    danger: "border border-gasto/40 bg-gasto/10 text-[#b54848] hover:bg-gasto/20",
  }[variant];
  const s = size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm";
  return (
    <button
      type="button"
      className={cx("inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50", v, s, className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------
// Tarjetas
// ---------------------------------------------------------------------
export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={cx("rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-card)] md:p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Kpi({
  label,
  value,
  icon,
  tone = "ink",
  children,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "ink" | "ingreso" | "gasto" | "beneficio" | "ocupacion";
  children?: ReactNode;
}) {
  const color = { ink: "text-ink", ingreso: "text-ingreso", gasto: "text-gasto", beneficio: "text-beneficio", ocupacion: "text-ocupacion" }[tone];
  const bg = { ink: "bg-page text-ink-2", ingreso: "bg-ingreso/10 text-ingreso", gasto: "bg-gasto/10 text-gasto", beneficio: "bg-beneficio/10 text-beneficio", ocupacion: "bg-ocupacion/10 text-ocupacion" }[tone];
  return (
    <div className="rounded-[var(--radius-card)] bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-ink-2">{label}</p>
        {icon && <span className={cx("grid size-8 place-items-center rounded-lg", bg)}>{icon}</span>}
      </div>
      <p className={cx("num mt-2 text-[26px] leading-tight font-bold tracking-tight", color)}>{value}</p>
      {children && <div className="mt-1.5 text-xs text-muted">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------
// Chips y badges
// ---------------------------------------------------------------------
export function FilterChip({ active, count, children, onClick }: { active: boolean; count?: number; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition",
        active ? "bg-brand border-transparent text-white" : "border-line bg-card text-ink-2 hover:border-blue-brand/40",
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cx("num rounded-full px-1.5 text-[11px]", active ? "bg-white/25" : "bg-page text-muted")}>{count}</span>
      )}
    </button>
  );
}

export function Badge({ children, className, style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap", className)} style={style}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------
export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string }[] }) {
  return (
    <div className="scroll-thin mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-line">
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          onClick={() => onChange(i.value)}
          className={cx(
            "-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition",
            value === i.value ? "border-blue-brand text-blue-brand" : "border-transparent text-ink-2 hover:text-ink",
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------
const inputCls =
  "h-10 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink outline-none transition placeholder:text-muted focus:border-blue-brand focus:ring-2 focus:ring-blue-brand/15";

export function Field({ label, children, className, hint }: { label: string; children: ReactNode; className?: string; hint?: string }) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}
export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputCls, "num", props.className)} />;
}
export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputCls, "pr-8", props.className)} />;
}
export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[#3b82f6]" />
      {label}
    </label>
  );
}

// ---------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------
export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#1f2430]/45 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx("flex max-h-[92vh] w-full flex-col rounded-t-[var(--radius-card)] bg-card shadow-2xl sm:rounded-[var(--radius-card)]", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-page hover:text-ink" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="py-20 text-center text-sm text-muted">Cargando…</div>;
}

// ---------------------------------------------------------------------
// Selector "< Año: 2026 >"
// ---------------------------------------------------------------------
export function YearNav({ year, onChange, label = "Año" }: { year: number; onChange: (y: number) => void; label?: string }) {
  const btn = "grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-page hover:text-ink";
  return (
    <div className="inline-flex items-center gap-1 rounded-xl border border-line bg-card p-0.5 text-sm">
      <button type="button" className={btn} onClick={() => onChange(year - 1)} aria-label="Año anterior">‹</button>
      <span className="num px-2 font-semibold">{label}: {year}</span>
      <button type="button" className={btn} onClick={() => onChange(year + 1)} aria-label="Año siguiente">›</button>
    </div>
  );
}

// ---------------------------------------------------------------------
// Cabecera de sección y franja de cifras (Panel, Contratos)
// ---------------------------------------------------------------------
export type Stat = { label: string; value: ReactNode; sub?: ReactNode; tone?: string };

export function StatStrip({ items }: { items: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] bg-line shadow-[var(--shadow-card)] lg:grid-cols-4">
      {items.map((s) => (
        <div key={s.label} className="bg-card px-4 py-3">
          <p className="text-xs text-muted">{s.label}</p>
          <p className={cx("num mt-0.5 text-xl font-bold tracking-tight", s.tone ?? "text-ink")}>{s.value}</p>
          {s.sub && <p className="mt-0.5 truncate text-[11px] text-muted">{s.sub}</p>}
        </div>
      ))}
    </div>
  );
}

export function SectionHeader({ icon, iconCls, title, count, sub, action }: { icon: ReactNode; iconCls: string; title: string; count?: number; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", iconCls)}>{icon}</span>
      <div className="min-w-0 flex-1">
        <h2 className="flex items-baseline gap-2 text-lg font-bold">
          {title}
          {count !== undefined && <span className="num text-sm font-medium text-muted">{count}</span>}
        </h2>
        {sub && <p className="truncate text-[13px] text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
