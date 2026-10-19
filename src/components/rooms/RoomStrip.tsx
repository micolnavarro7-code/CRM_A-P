import { resumenHabitaciones } from "@/lib/stats";
import type { Room } from "@/lib/types";
import { ROOM_STATUS, ROOM_STATUSES } from "../domain";

/** Una barra por habitación, coloreada por estado, y el recuento debajo. */
export function RoomStrip({ rooms }: { rooms: Room[] }) {
  if (!rooms.length) return <p className="text-[12px] text-muted">Sin habitaciones registradas</p>;
  const s = resumenHabitaciones(rooms);
  const n = { alquilada: s.alquiladas, reservada: s.reservadas, libre: s.libres };
  return (
    <div>
      <div className="flex gap-1">
        {rooms.map((r) => (
          <span key={r.id} title={`${r.name}: ${ROOM_STATUS[r.status].label}`} className="h-2 flex-1 rounded-full" style={{ background: ROOM_STATUS[r.status].color }} />
        ))}
      </div>
      <p className="num mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-ink-2">
        {ROOM_STATUSES.filter((k) => n[k]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="size-2 rounded-full" style={{ background: ROOM_STATUS[k].color }} />
            {n[k]} {n[k] === 1 ? ROOM_STATUS[k].label.toLowerCase() : ROOM_STATUS[k].plural}
          </span>
        ))}
      </p>
    </div>
  );
}
