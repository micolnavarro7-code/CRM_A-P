import { DoorOpen, Luggage, Tag, type LucideIcon } from "lucide-react";
import type { BusinessModel, Category, Channel, PropertyStatus, RoomStatus } from "@/lib/types";
import { Badge } from "./ui";

export const STATUS: Record<PropertyStatus, { label: string; cls: string }> = {
  disponible: { label: "Disponible", cls: "bg-[#DCFCE7] text-[#15803D]" },
  alquilada: { label: "Alquilada", cls: "bg-[#DBEAFE] text-[#1D4ED8]" },
  reservado: { label: "Reservada", cls: "bg-[#EDE9FE] text-[#6D28D9]" },
  arras: { label: "En arras", cls: "bg-[#FEF3C7] text-[#B45309]" },
  vendida: { label: "Vendida", cls: "bg-[#E5E7EB] text-[#374151]" },
  remodelacion: { label: "En remodelación", cls: "bg-[#FFEDD5] text-[#C2410C]" },
};

export function StatusBadge({ status, className }: { status: PropertyStatus; className?: string }) {
  const s = STATUS[status];
  return <Badge className={`${s.cls} ${className ?? ""}`}>{s.label}</Badge>;
}

/** Las tres líneas de negocio, en el orden en que salen en el Panel. */
export const CATEGORIES: Category[] = ["turistico", "habitaciones", "venta"];

export const CATEGORY: Record<Category, { label: string; nav: string; sub: string; icon: LucideIcon; cls: string; statuses: PropertyStatus[] }> = {
  turistico: {
    label: "Alquiler turístico",
    nav: "Alquiler turístico",
    sub: "Booking, Airbnb y reservas propias",
    icon: Luggage,
    cls: "bg-[#DBEAFE] text-[#1D4ED8]",
    statuses: ["disponible", "alquilada", "remodelacion"],
  },
  habitaciones: {
    label: "Alquiler por habitaciones",
    nav: "Habitaciones",
    sub: "Pisos y sus habitaciones: alquiladas, reservadas y libres",
    icon: DoorOpen,
    cls: "bg-[#EDE9FE] text-[#6D28D9]",
    // La ocupación se lleva por habitación (ROOM_STATUS).
    statuses: ["disponible", "remodelacion"],
  },
  venta: {
    label: "Venta",
    nav: "Venta",
    sub: "Propiedades en venta y vendidas",
    icon: Tag,
    cls: "bg-[#FFEDD5] text-[#C2410C]",
    statuses: ["disponible", "reservado", "arras", "vendida", "remodelacion"],
  },
};

export const ROOM_STATUSES: RoomStatus[] = ["alquilada", "reservada", "libre"];

export const ROOM_STATUS: Record<RoomStatus, { label: string; plural: string; cls: string; color: string }> = {
  alquilada: { label: "Alquilada", plural: "alquiladas", cls: "bg-[#DBEAFE] text-[#1D4ED8]", color: "#3B82F6" },
  reservada: { label: "Reservada", plural: "reservadas", cls: "bg-[#FEF3C7] text-[#B45309]", color: "#F59E0B" },
  libre: { label: "Libre", plural: "libres", cls: "bg-[#DCFCE7] text-[#15803D]", color: "#D1D5DB" },
};

export function RoomBadge({ status, className }: { status: RoomStatus; className?: string }) {
  const s = ROOM_STATUS[status];
  return <Badge className={`${s.cls} ${className ?? ""}`}>{s.label}</Badge>;
}

export const CHANNEL: Record<Channel, { label: string; cls: string; color: string }> = {
  booking: { label: "Booking", cls: "bg-[#1D4ED8] text-white", color: "#1D4ED8" },
  airbnb: { label: "Airbnb", cls: "bg-[#BAE6FD] text-[#075985]", color: "#38BDF8" },
  propia: { label: "Propia", cls: "bg-[#E5E7EB] text-[#374151]", color: "#9CA3AF" },
};

export function ChannelChip({ channel }: { channel: Channel }) {
  const c = CHANNEL[channel];
  return <Badge className={c.cls}>{c.label}</Badge>;
}

export const MODEL: Record<BusinessModel, string> = {
  gestion: "Gestión con reparto",
  subarriendo: "Subarriendo",
  propia: "Propia",
};

export const PROPERTY_TYPES = ["Piso", "Casa", "Ático", "Estudio", "Local", "Oficina"];

export const TAG_COLORS = ["#0EA5E9", "#16A34A", "#F59E0B", "#8B5CF6", "#EC4899", "#EF4444", "#64748B"];

/** URL de la ficha de una propiedad (con query en vez de ruta dinámica, para poder exportar la web estática). */
export const fichaUrl = (id: string, tab?: string) => `/propiedades/ficha?id=${id}${tab ? `&tab=${tab}` : ""}`;
