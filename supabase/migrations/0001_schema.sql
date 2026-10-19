-- =====================================================================
-- A&P Real Estate · CRM
-- Esquema inicial (Supabase / Postgres)
--
-- Convenciones:
--   * ids uuid generados en cliente (crypto.randomUUID) o por defecto aquí.
--   * importes numeric(12,2) en euros.
--   * Los resúmenes mensuales NO se guardan: se calculan desde reservas y
--     gastos fijos (vista v_resumen_mensual). La app replica las mismas
--     fórmulas en src/lib/calc.ts.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Equipo: usuarios de Supabase Auth con acceso a los datos del CRM.
--   El registro público de Supabase puede estar abierto y la clave de la
--   app es pública, así que no basta con estar autenticado: hay que estar
--   en esta tabla. Alta de un usuario (tras crearlo en Authentication):
--     insert into team_members (user_id, email)
--     select id, email from auth.users where email = 'persona@ejemplo.com';
-- ---------------------------------------------------------------------
create table team_members (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Contactos: propietarios, huéspedes/inquilinos y proveedores
-- ---------------------------------------------------------------------
create type contact_type as enum ('propietario', 'huesped', 'inquilino', 'proveedor');

create table contacts (
  id            uuid primary key default gen_random_uuid(),
  type          contact_type not null,
  name          text not null,
  email         text,
  phone         text,
  nif           text,
  iban          text,
  category      text,          -- proveedores: limpieza, fontanería, electricidad…
  notes         text,
  created_at    timestamptz not null default now()
);
create index on contacts (type);

-- ---------------------------------------------------------------------
-- Propiedades
--   category: línea de negocio (el Panel las agrupa por ella)
--     turistico    = Booking / Airbnb / reservas propias
--     habitaciones = alquiler por habitaciones
--     venta        = compraventa
-- ---------------------------------------------------------------------
create type property_category as enum ('turistico', 'habitaciones', 'venta');
create type property_status as enum (
  'disponible', 'alquilada', 'reservado', 'arras', 'vendida', 'remodelacion'
);
create type business_model as enum ('gestion', 'subarriendo', 'propia');

create table properties (
  id                 uuid primary key default gen_random_uuid(),
  category           property_category not null default 'turistico',
  code               text unique,
  name               text not null,
  address            text,
  city               text,
  type               text not null default 'Piso',  -- Piso, Casa, Ático, Estudio, Local, Oficina
  status             property_status not null default 'disponible',
  price              numeric(12,2),            -- € /mes (alquiler) o precio de venta
  bedrooms           int,
  bathrooms          int,
  built_m2           numeric(8,2),
  useful_m2          numeric(8,2),
  owner_id           uuid references contacts(id) on delete set null,
  business_model     business_model not null default 'gestion',
  agency_pct         numeric(5,4) not null default 0,   -- 0.25 = 25 % (solo gestión)
  cleaning_by_owner  boolean not null default false,    -- la limpieza se abona al propietario
  default_cleaning   numeric(12,2) not null default 0,
  photo_url          text,
  tags               jsonb not null default '[]',        -- [{ "label": "Playa", "color": "#…" }]
  created_at         timestamptz not null default now(),
  updated_at         date not null default current_date  -- la app la pone al guardar
);
create index on properties (category);
create index on properties (owner_id);

-- ---------------------------------------------------------------------
-- Habitaciones (pisos de la categoría «habitaciones»)
--   Contrato: uno por habitación alquilada o reservada; renta, inicio y fin
--   son rent, start_date y end_date. Al dejarla libre, la app borra inquilino,
--   fechas y el estado del contrato.
-- ---------------------------------------------------------------------
create type room_status as enum ('alquilada', 'reservada', 'libre');

create table rooms (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references properties(id) on delete cascade,
  name          text not null,
  status        room_status not null default 'libre',
  rent          numeric(12,2) not null default 0,   -- € /mes
  size_m2       numeric(6,2),
  private_bath  boolean not null default false,
  tenant_name   text,
  contract_done boolean not null default false,     -- contrato del inquilino actual hecho
  start_date    date,
  end_date      date,                               -- fin de contrato
  notes         text,
  created_at    timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);
create index on rooms (property_id);

-- ---------------------------------------------------------------------
-- Reservas (Booking / Airbnb / Propia)
--   precio        = lo que paga el huésped
--   ingreso       = lo que liquida la plataforma  (≈ precio − comisión)
--   beneficio     = ingreso − limpieza            (editable)
-- ---------------------------------------------------------------------
create type booking_channel as enum ('booking', 'airbnb', 'propia');

create table bookings (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid not null references properties(id) on delete cascade,
  guest_id       uuid references contacts(id) on delete set null,
  guest_name     text,
  channel        booking_channel not null,
  booking_ref    text,                     -- vacío en reservas propias
  check_in       date not null,
  check_out      date not null,
  month          date not null,            -- mes contable (día 1); por defecto el de la entrada
  price          numeric(12,2) not null default 0,
  payout         numeric(12,2) not null default 0,
  platform_fee   numeric(12,2) not null default 0,
  cleaning       numeric(12,2) not null default 0,
  vat            numeric(12,2) not null default 0,
  net_profit     numeric(12,2) not null default 0,
  invoiced       boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now(),
  check (check_out >= check_in)
);
create index on bookings (property_id, month);
create index on bookings (guest_id);

-- ---------------------------------------------------------------------
-- Gastos fijos mensuales (subarriendo): alquiler al propietario y suministros
-- ---------------------------------------------------------------------
create table monthly_costs (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references properties(id) on delete cascade,
  month        date not null,              -- día 1 del mes
  rent         numeric(12,2) not null default 0,
  electricity  numeric(12,2) not null default 0,
  water        numeric(12,2) not null default 0,
  internet     numeric(12,2) not null default 0,
  unique (property_id, month)
);

-- ---------------------------------------------------------------------
-- Movimientos manuales de P&L (ingresos y gastos que no son reservas)
-- ---------------------------------------------------------------------
create type tx_kind as enum ('ingreso', 'gasto');
create type tx_status as enum ('conciliado', 'pendiente');

create table transactions (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references properties(id) on delete set null,
  contact_id   uuid references contacts(id) on delete set null,
  kind         tx_kind not null,
  category     text not null,
  concept      text not null,
  amount       numeric(12,2) not null,     -- siempre positivo; el signo lo da kind
  date         date not null,
  status       tx_status not null default 'pendiente',
  source       text not null default 'manual', -- manual | mantenimiento | banco
  created_at   timestamptz not null default now()
);
create index on transactions (date);
create index on transactions (property_id);
create index on transactions (contact_id);

-- ---------------------------------------------------------------------
-- Comisiones del equipo (las de agencia se calculan del resumen mensual)
-- ---------------------------------------------------------------------
create table commissions (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid references properties(id) on delete set null,
  agent        text not null,
  concept      text not null,
  amount       numeric(12,2) not null,
  date         date not null,
  paid         boolean not null default false
);
create index on commissions (property_id);

-- ---------------------------------------------------------------------
-- Fianzas
-- ---------------------------------------------------------------------
create table deposits (
  id             uuid primary key default gen_random_uuid(),
  property_id    uuid references properties(id) on delete set null,
  contact_id     uuid references contacts(id) on delete set null,
  amount         numeric(12,2) not null,
  received_date  date not null,
  returned_date  date,
  returned_amount numeric(12,2),
  deposited_at   text,                     -- organismo / cuenta donde se depositó
  notes          text
);
create index on deposits (property_id);
create index on deposits (contact_id);

-- ---------------------------------------------------------------------
-- Facturas de la agencia al propietario (gestión)
--   base (S/I) = parte agencia / 1,21 · vat = base × 0,21 · total (C/I) = parte agencia
-- ---------------------------------------------------------------------
create type invoice_status as enum ('borrador', 'emitida', 'cobrada');

create table invoices (
  id           uuid primary key default gen_random_uuid(),
  number       text not null unique,
  property_id  uuid references properties(id) on delete set null,
  owner_id     uuid references contacts(id) on delete set null,
  month        date not null,
  issue_date   date not null,
  base         numeric(12,2) not null,
  vat          numeric(12,2) not null,
  total        numeric(12,2) not null,
  status       invoice_status not null default 'emitida'
);
create index on invoices (property_id);
create index on invoices (owner_id);

-- ---------------------------------------------------------------------
-- Remesas (lotes de pagos/cobros bancarios)
-- ---------------------------------------------------------------------
create table remittances (
  id           uuid primary key default gen_random_uuid(),
  reference    text not null,
  date         date not null,
  kind         tx_kind not null,           -- ingreso = cobro, gasto = pago
  concept      text not null,
  total        numeric(12,2) not null,
  items        int not null default 0,
  status       text not null default 'pendiente' -- pendiente | enviada | liquidada
);

-- ---------------------------------------------------------------------
-- Mantenimiento: al cerrar con coste se genera un gasto en transactions
-- ---------------------------------------------------------------------
create type ticket_status as enum ('abierta', 'en_curso', 'resuelta');
create type ticket_priority as enum ('baja', 'media', 'alta');

create table maintenance_tickets (
  id              uuid primary key default gen_random_uuid(),
  property_id     uuid not null references properties(id) on delete cascade,
  provider_id     uuid references contacts(id) on delete set null,
  title           text not null,
  description     text,
  status          ticket_status not null default 'abierta',
  priority        ticket_priority not null default 'media',
  cost            numeric(12,2),
  opened_at       date not null default current_date,
  closed_at       date,
  transaction_id  uuid references transactions(id) on delete set null
);
create index on maintenance_tickets (property_id);
create index on maintenance_tickets (provider_id);
create index on maintenance_tickets (transaction_id);

-- ---------------------------------------------------------------------
-- Documentos (archivo en Storage, bucket "documentos")
-- ---------------------------------------------------------------------
create table documents (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid references properties(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete cascade,
  name          text not null,
  category      text not null default 'Otros', -- Contrato, Factura, Seguro, Otros
  storage_path  text,
  mime          text,
  size          bigint,
  uploaded_at   timestamptz not null default now()
);
create index on documents (property_id);
create index on documents (contact_id);

-- =====================================================================
-- Fórmulas: resumen mensual por propiedad
-- =====================================================================
--  Gestión con reparto
--    total        = Σ price
--    comision     = Σ platform_fee
--    limpieza     = Σ cleaning
--    beneficio    = Σ net_profit
--    parte_agencia= beneficio × agency_pct         (= FACT C/I)
--    fact_si      = parte_agencia / 1,21
--    pago_prop    = beneficio − parte_agencia + (cleaning_by_owner ? limpieza : 0)
--  Subarriendo
--    balance      = beneficio − rent − electricity − water − internet
--    pct          = balance / beneficio   (NULL si beneficio = 0)
-- security_invoker: la vista respeta el RLS de las tablas (solo el equipo la ve).
create or replace view v_resumen_mensual with (security_invoker = on) as
with meses as (
  select p.id as property_id, generate_series(
           date_trunc('year', current_date)::date,
           (date_trunc('year', current_date) + interval '11 months')::date,
           interval '1 month')::date as month
  from properties p
),
res as (
  select property_id, month,
         sum(price) total, sum(platform_fee) comision,
         sum(cleaning) limpieza, sum(net_profit) beneficio, count(*) reservas
  from bookings group by 1, 2
)
select
  m.property_id, m.month, p.business_model,
  coalesce(r.total, 0)      as total,
  coalesce(r.comision, 0)   as comision,
  coalesce(r.limpieza, 0)   as limpieza,
  coalesce(r.beneficio, 0)  as beneficio,
  coalesce(r.reservas, 0)   as reservas,
  round(coalesce(r.beneficio, 0) * p.agency_pct, 2)                       as parte_agencia,
  round(coalesce(r.beneficio, 0) * p.agency_pct / 1.21, 2)                as fact_si,
  round(coalesce(r.beneficio, 0) * (1 - p.agency_pct)
        + case when p.cleaning_by_owner then coalesce(r.limpieza, 0) else 0 end, 2) as pago_propietario,
  coalesce(c.rent, 0) as alquiler, coalesce(c.electricity, 0) as luz,
  coalesce(c.water, 0) as agua, coalesce(c.internet, 0) as internet,
  coalesce(r.beneficio, 0) - coalesce(c.rent, 0) - coalesce(c.electricity, 0)
    - coalesce(c.water, 0) - coalesce(c.internet, 0)                     as balance,
  case when coalesce(r.beneficio, 0) = 0 then null
       else (coalesce(r.beneficio, 0) - coalesce(c.rent, 0) - coalesce(c.electricity, 0)
             - coalesce(c.water, 0) - coalesce(c.internet, 0)) / r.beneficio end as pct
from meses m
join properties p on p.id = m.property_id
left join res r on r.property_id = m.property_id and r.month = m.month
left join monthly_costs c on c.property_id = m.property_id and c.month = m.month;

-- =====================================================================
-- Seguridad: una sola empresa → los miembros del equipo acceden a todo.
-- Un usuario autenticado que no esté en team_members no ve ni toca nada.
-- =====================================================================
alter table team_members enable row level security;
-- Cada usuario puede comprobar si él mismo es miembro (lo usan las políticas
-- de abajo y la app). Altas y bajas solo desde el panel de Supabase / SQL.
create policy "team_members_self" on team_members for select to authenticated
  using (user_id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['contacts','properties','rooms','bookings','monthly_costs',
    'transactions','commissions','deposits','invoices','remittances','maintenance_tickets','documents']
  loop
    execute format('alter table %I enable row level security', t);
    execute format($p$create policy "team_all_%1$s" on %1$I for all to authenticated
      using (exists (select 1 from public.team_members m where m.user_id = (select auth.uid())))
      with check (exists (select 1 from public.team_members m where m.user_id = (select auth.uid())))$p$, t);
  end loop;
end $$;

-- Bucket privado para documentos y fotos
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
on conflict do nothing;
create policy "team_documentos" on storage.objects for all to authenticated
  using (bucket_id = 'documentos'
         and exists (select 1 from public.team_members m where m.user_id = (select auth.uid())))
  with check (bucket_id = 'documentos'
         and exists (select 1 from public.team_members m where m.user_id = (select auth.uid())));
