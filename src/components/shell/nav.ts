import { FileSignature, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";
import type { Category } from "@/lib/types";
import { CATEGORIES, CATEGORY } from "../domain";

export type NavItem = { label: string; icon: LucideIcon; href: string; category?: Category };

// Las categorías son secciones del Panel: enlazan a su ancla (/#turistico…).
export const NAV: NavItem[] = [
  { label: "Panel", icon: LayoutDashboard, href: "/" },
  ...CATEGORIES.map((c) => ({ label: CATEGORY[c].nav, icon: CATEGORY[c].icon, href: `/#${c}`, category: c })),
  { label: "Contratos", icon: FileSignature, href: "/contratos" },
  { label: "Ajustes", icon: Settings, href: "/ajustes" },
];
