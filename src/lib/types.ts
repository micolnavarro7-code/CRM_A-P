// Tipos que reflejan 1:1 las tablas de supabase/migrations/0001_schema.sql.
// Fechas como "AAAA-MM-DD"; `month` siempre es el día 1 del mes.

export type ID = string;

export type ContactType = "propietario" | "huesped" | "inquilino" | "proveedor";
export type Contact = {
  id: ID;
  type: ContactType;
  name: string;
  email: string | null;
  phone: string | null;
  nif: string | null;
  iban: string | null;
  category: string | null;
  notes: string | null;
};

/** Línea de negocio: el Panel agrupa las propiedades por ella. */
export type Category = "turistico" | "habitaciones" | "venta";
export type PropertyStatus = "disponible" | "alquilada" | "reservado" | "arras" | "vendida" | "remodelacion";
export type BusinessModel = "gestion" | "subarriendo" | "propia";
export type Tag = { label: string; color: string };

export type Property = {
  id: ID;
  category: Category;
  code: string | null;
  name: string;
  address: string | null;
  city: string | null;
  type: string;
  status: PropertyStatus;
  price: number | null; // € /mes (alquiler) o precio de venta
  bedrooms: number | null;
  bathrooms: number | null;
  built_m2: number | null;
  useful_m2: number | null;
  owner_id: ID | null;
  business_model: BusinessModel;
  agency_pct: number;
  cleaning_by_owner: boolean;
  default_cleaning: number;
  photo_url: string | null;
  tags: Tag[];
  updated_at: string;
};

/** Habitación de un piso de la categoría «habitaciones». */
export type RoomStatus = "alquilada" | "reservada" | "libre";
export type Room = {
  id: ID;
  property_id: ID;
  name: string;
  status: RoomStatus;
  rent: number; // € /mes
  size_m2: number | null;
  private_bath: boolean;
  tenant_name: string | null;
  // Contrato del inquilino actual: renta, inicio y fin son los de la habitación.
  contract_done: boolean;
  start_date: string | null;
  end_date: string | null; // fin de contrato
  notes: string | null;
};

export type Channel = "booking" | "airbnb" | "propia";
export type Booking = {
  id: ID;
  property_id: ID;
  guest_id: ID | null;
  guest_name: string | null;
  channel: Channel;
  booking_ref: string | null;
  check_in: string;
  check_out: string;
  month: string;
  price: number;
  payout: number;
  platform_fee: number;
  cleaning: number;
  vat: number;
  net_profit: number;
  invoiced: boolean;
  notes: string | null;
};

export type MonthlyCost = {
  id: ID;
  property_id: ID;
  month: string;
  rent: number;
  electricity: number;
  water: number;
  internet: number;
};

export type TxKind = "ingreso" | "gasto";
export type TxStatus = "conciliado" | "pendiente";
export type Transaction = {
  id: ID;
  property_id: ID | null;
  contact_id: ID | null;
  kind: TxKind;
  category: string;
  concept: string;
  amount: number;
  date: string;
  status: TxStatus;
  source: "manual" | "mantenimiento" | "banco";
};

export type Commission = {
  id: ID;
  property_id: ID | null;
  agent: string;
  concept: string;
  amount: number;
  date: string;
  paid: boolean;
};

export type Deposit = {
  id: ID;
  property_id: ID | null;
  contact_id: ID | null;
  amount: number;
  received_date: string;
  returned_date: string | null;
  returned_amount: number | null;
  deposited_at: string | null;
  notes: string | null;
};

export type InvoiceStatus = "borrador" | "emitida" | "cobrada";
export type Invoice = {
  id: ID;
  number: string;
  property_id: ID | null;
  owner_id: ID | null;
  month: string;
  issue_date: string;
  base: number;
  vat: number;
  total: number;
  status: InvoiceStatus;
};

export type Remittance = {
  id: ID;
  reference: string;
  date: string;
  kind: TxKind;
  concept: string;
  total: number;
  items: number;
  status: "pendiente" | "enviada" | "liquidada";
};

export type TicketStatus = "abierta" | "en_curso" | "resuelta";
export type Ticket = {
  id: ID;
  property_id: ID;
  provider_id: ID | null;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: "baja" | "media" | "alta";
  cost: number | null;
  opened_at: string;
  closed_at: string | null;
  transaction_id: ID | null;
};

export type Document = {
  id: ID;
  property_id: ID | null;
  contact_id: ID | null;
  name: string;
  category: string;
  storage_path: string | null;
  mime: string | null;
  size: number | null;
  uploaded_at: string;
};

/** Nombre de tabla en BD → tipo de fila. */
export type Tables = {
  contacts: Contact;
  properties: Property;
  rooms: Room;
  bookings: Booking;
  monthly_costs: MonthlyCost;
  transactions: Transaction;
  commissions: Commission;
  deposits: Deposit;
  invoices: Invoice;
  remittances: Remittance;
  maintenance_tickets: Ticket;
  documents: Document;
};
export type TableName = keyof Tables;
export type DB = { [K in TableName]: Tables[K][] };

export const TABLES: TableName[] = [
  "contacts",
  "properties",
  "rooms",
  "bookings",
  "monthly_costs",
  "transactions",
  "commissions",
  "deposits",
  "invoices",
  "remittances",
  "maintenance_tickets",
  "documents",
];
