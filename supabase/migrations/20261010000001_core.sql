-- WMS FG Export — core schema
-- Unit of handling = carton (serial). Stock only changes through scan_carton() which writes stock_txns.

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ people & places

create table public.warehouses (
  id text primary key,
  code text not null unique,
  name text not null,
  type text not null check (type in ('CENTRAL', 'BRANCH'))
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'staff' check (role in ('director', 'manager', 'staff')),
  warehouse_id text references public.warehouses (id),
  created_at timestamptz not null default now()
);

create table public.locations (
  id text primary key,
  warehouse_id text not null references public.warehouses (id),
  code text not null unique,
  kind text not null check (kind in ('RACK', 'FLOOR', 'STAGING', 'DOCK')),
  x numeric not null default 0,
  y numeric not null default 0,
  z numeric not null default 0,
  capacity_cartons int not null default 0
);

create table public.vendor_factory_map (
  vendor_system text not null,
  vendor_factory_code text not null,
  warehouse_id text not null references public.warehouses (id),
  primary key (vendor_system, vendor_factory_code)
);

create table public.carton_codes (
  code text primary key,
  length_cm numeric not null,
  width_cm numeric not null,
  height_cm numeric not null,
  max_stack int
);

-- ------------------------------------------------------------------ shipments, plans, containers

create table public.shipments (
  id text primary key default ('sh-' || substr(gen_random_uuid()::text, 1, 8)),
  shipment_date date not null,
  destination text,
  ship_to_code text,
  ship_method text not null default 'SEA' check (ship_method in ('SEA', 'AIR', 'TRUCK'))
);

create table public.containers (
  id text primary key default ('ct-' || substr(gen_random_uuid()::text, 1, 8)),
  code text not null,
  shipment_id text not null references public.shipments (id),
  type text not null check (type in ('20GP', '40GP', '40HC', '45HC')),
  container_no text,
  seal_no text,
  truck_plate text,
  driver_name text,
  dock text,
  loading_warehouse_id text not null references public.warehouses (id),
  status text not null default 'PLANNED' check (status in ('PLANNED', 'PICKING', 'READY', 'LOADING', 'CLOSED')),
  planned_cartons int not null default 0,
  loaded_cartons int not null default 0,
  fill_volume_pct numeric not null default 0,
  loaded_kg numeric not null default 0,
  eta_done text,
  closed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.packing_plans (
  id text primary key default ('pp-' || substr(gen_random_uuid()::text, 1, 8)),
  plan_ref text not null,
  po_no text not null,
  po_line text not null,
  description text,
  vendor_system text not null default 'MERCURY',
  vendor_factory_code text,
  factory_warehouse_id text references public.warehouses (id),
  shipment_id text references public.shipments (id),
  source text not null default 'MANUAL' check (source in ('PDF', 'EXCEL', 'CSV', 'MERCURY', 'MANUAL')),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'VALIDATED', 'PENDING_APPROVAL', 'APPROVED', 'SUBMITTED', 'RELEASED', 'LOADING', 'CLOSED')),
  version int not null default 1,
  totals jsonb not null default '{}'::jsonb,
  issue text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (plan_ref, version)
);

create table public.plan_carton_ranges (
  id bigint generated always as identity primary key,
  plan_id text not null references public.packing_plans (id) on delete cascade,
  range_no text not null,
  carton_from int not null,
  carton_to int not null,
  serial_from text not null,
  serial_to text not null,
  line_no text,
  style text,
  po_no text,
  po_line text,
  color text,
  size text,
  style_color text,
  ship_method text,
  item_qty int,
  qty_per_carton int,
  inner_pkg_count int,
  carton_count int not null,
  carton_code text,
  net_net_kg numeric,
  net_kg numeric,
  gross_kg numeric,
  length_cm numeric,
  width_cm numeric,
  height_cm numeric
);

create table public.cartons (
  id text primary key default ('cn-' || substr(gen_random_uuid()::text, 1, 12)),
  serial text not null unique,
  style text,
  color text,
  size text,
  qty int,
  carton_code text,
  length_cm numeric not null,
  width_cm numeric not null,
  height_cm numeric not null,
  gross_kg numeric not null default 0,
  net_kg numeric not null default 0,
  po_no text,
  po_line text,
  plan_id text references public.packing_plans (id),
  container_id text references public.containers (id),
  status text not null default 'AVAILABLE' check (status in ('IN_TRANSIT', 'AVAILABLE', 'RESERVED', 'PICKED', 'STAGED', 'LOADED', 'SHIPPED', 'HOLD')),
  warehouse_id text not null references public.warehouses (id),
  location_id text references public.locations (id),
  load_seq int,
  load_label text,
  updated_at timestamptz not null default now()
);
create index cartons_container_idx on public.cartons (container_id, load_seq);
create index cartons_plan_idx on public.cartons (plan_id);
create index cartons_location_idx on public.cartons (location_id);

-- Append-only ledger. client_txn_id makes every device scan idempotent (offline retry safe).
create table public.stock_txns (
  id bigint generated always as identity primary key,
  client_txn_id text not null unique,
  action text not null check (action in ('RECEIVE', 'PUTAWAY', 'PICK', 'STAGE', 'LOAD', 'UNLOAD')),
  carton_id text references public.cartons (id),
  serial text not null,
  from_location_id text,
  to_location_id text,
  container_id text,
  device_id text,
  user_id uuid default auth.uid(),
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index stock_txns_container_idx on public.stock_txns (container_id, created_at desc);

-- ------------------------------------------------------------------ AI agents

create table public.agent_actions (
  id text primary key default ('aa-' || substr(gen_random_uuid()::text, 1, 8)),
  agent text not null check (agent in ('Sync', 'Planner', 'Transfer', 'Slotting', 'Vision')),
  text text not null,
  result text,
  status text not null default 'DONE' check (status in ('DONE', 'NEEDS_DECISION', 'UNDONE')),
  confidence numeric,
  created_at timestamptz not null default now()
);

create table public.decisions (
  id text primary key default ('dc-' || substr(gen_random_uuid()::text, 1, 8)),
  kind text not null,
  title text not null,
  recommendation text not null,
  confidence numeric not null,
  primary_action text not null,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id),
  resolution text
);
