-- Functions (business rules live here), RLS and realtime.

-- ------------------------------------------------------------------ helpers

create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'staff');
$$;

create or replace function public.is_manager()
returns boolean language sql stable as $$
  select public.current_role_name() in ('manager', 'director');
$$;

-- new auth user -> profile row (role defaults to staff; promote in the dashboard)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.refresh_container_counts(p_container_id text)
returns void language sql security definer set search_path = public as $$
  update public.containers k set
    planned_cartons = s.planned,
    loaded_cartons = s.loaded,
    loaded_kg = s.loaded_kg,
    updated_at = now()
  from (
    select count(*) as planned,
           count(*) filter (where status in ('LOADED', 'SHIPPED')) as loaded,
           coalesce(sum(gross_kg) filter (where status in ('LOADED', 'SHIPPED')), 0) as loaded_kg
    from public.cartons where container_id = p_container_id
  ) s
  where k.id = p_container_id;
$$;

-- ------------------------------------------------------------------ scanning (the only way stock moves)

create or replace function public.scan_carton(
  p_client_txn_id text,
  p_action text,
  p_serial text,
  p_container_id text default null,
  p_location_code text default null,
  p_device_id text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb;
  c public.cartons%rowtype;
  v_loc public.locations%rowtype;
  v_ct public.containers%rowtype;
  v_err text;
  v_code text;
  v_msg text;
  v_from text;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- idempotency: the same device transaction always returns the first result
  select result into v_prev from public.stock_txns where client_txn_id = p_client_txn_id;
  if found then
    return v_prev || jsonb_build_object('duplicate', true);
  end if;

  select * into c from public.cartons where serial = trim(p_serial) for update;
  if not found then
    v_code := 'NOT_FOUND';
    v_err := 'ไม่พบกล่อง serial ' || p_serial || ' ในระบบ';
  end if;

  if v_err is null and p_location_code is not null then
    select * into v_loc from public.locations where code = upper(trim(p_location_code));
    if not found then
      v_code := 'LOCATION_NOT_FOUND';
      v_err := 'ไม่พบตำแหน่ง ' || p_location_code;
    end if;
  end if;

  if v_err is null then
    v_from := c.location_id;
    case p_action
      when 'RECEIVE' then
        if c.status not in ('IN_TRANSIT', 'AVAILABLE', 'RESERVED') then
          v_code := 'BAD_STATUS'; v_err := 'กล่องนี้สถานะ ' || c.status || ' รับเข้าไม่ได้';
        else
          update public.cartons set
            status = case when plan_id is null then 'AVAILABLE' else 'RESERVED' end,
            warehouse_id = coalesce(v_loc.warehouse_id, warehouse_id),
            location_id = v_loc.id,
            updated_at = now()
          where id = c.id;
          v_msg := 'รับเข้าแล้ว';
        end if;

      when 'PUTAWAY' then
        if v_loc.id is null then
          v_code := 'LOCATION_REQUIRED'; v_err := 'ต้องสแกนตำแหน่งที่วาง';
        elsif c.status in ('LOADED', 'SHIPPED') then
          v_code := 'BAD_STATUS'; v_err := 'กล่องนี้ขึ้นตู้แล้ว';
        else
          update public.cartons set location_id = v_loc.id, warehouse_id = v_loc.warehouse_id, updated_at = now() where id = c.id;
          v_msg := 'วางที่ ' || v_loc.code;
        end if;

      when 'PICK' then
        if p_container_id is not null and c.container_id is distinct from p_container_id then
          v_code := 'WRONG_CONTAINER'; v_err := 'กล่องนี้ไม่อยู่ในงานหยิบของตู้นี้';
        elsif c.status not in ('AVAILABLE', 'RESERVED', 'PICKED') then
          v_code := 'BAD_STATUS'; v_err := 'กล่องนี้สถานะ ' || c.status || ' หยิบไม่ได้';
        else
          update public.cartons set status = 'PICKED', location_id = null, updated_at = now() where id = c.id;
          v_msg := 'หยิบแล้ว';
        end if;

      when 'STAGE' then
        if v_loc.id is null then
          v_code := 'LOCATION_REQUIRED'; v_err := 'ต้องสแกนช่อง Staging';
        else
          update public.cartons set status = 'STAGED', location_id = v_loc.id, updated_at = now() where id = c.id;
          v_msg := 'วางที่ ' || v_loc.code;
        end if;

      when 'LOAD' then
        select * into v_ct from public.containers where id = p_container_id;
        if not found then
          v_code := 'CONTAINER_REQUIRED'; v_err := 'ไม่พบตู้';
        elsif v_ct.status = 'CLOSED' then
          v_code := 'CONTAINER_CLOSED'; v_err := 'ตู้นี้ปิดแล้ว';
        elsif c.container_id is distinct from p_container_id then
          v_code := 'WRONG_CONTAINER'; v_err := 'กล่องนี้ไม่อยู่ในแผนตู้ ' || v_ct.code;
        elsif c.status = 'LOADED' then
          v_msg := 'กล่องนี้ขึ้นตู้แล้ว';
        elsif c.status = 'HOLD' then
          v_code := 'ON_HOLD'; v_err := 'กล่องนี้ถูก Hold';
        else
          update public.cartons set status = 'LOADED', location_id = null, updated_at = now() where id = c.id;
          update public.containers set status = 'LOADING' where id = v_ct.id and status <> 'LOADING';
          perform public.refresh_container_counts(v_ct.id);
          v_msg := 'ขึ้นตู้ ' || v_ct.code;
        end if;

      when 'UNLOAD' then
        if c.status <> 'LOADED' then
          v_code := 'BAD_STATUS'; v_err := 'กล่องนี้ยังไม่ได้ขึ้นตู้';
        else
          update public.cartons set status = 'STAGED', updated_at = now() where id = c.id;
          perform public.refresh_container_counts(c.container_id);
          v_msg := 'ถอดออกจากตู้แล้ว';
        end if;

      else
        v_code := 'BAD_ACTION'; v_err := 'action ไม่ถูกต้อง';
    end case;
  end if;

  if v_err is not null then
    v_result := jsonb_build_object('ok', false, 'duplicate', false, 'code', v_code, 'message', v_err);
  else
    select * into c from public.cartons where id = c.id;
    v_result := jsonb_build_object(
      'ok', true, 'duplicate', false, 'message', v_msg,
      'carton', jsonb_build_object('serial', c.serial, 'style', c.style, 'size', c.size, 'cartonCode', c.carton_code, 'poNo', c.po_no, 'status', c.status)
    );
    if c.container_id is not null then
      select * into v_ct from public.containers where id = c.container_id;
      v_result := v_result || jsonb_build_object('loadedCartons', v_ct.loaded_cartons, 'plannedCartons', v_ct.planned_cartons);
    end if;
  end if;

  insert into public.stock_txns (client_txn_id, action, carton_id, serial, from_location_id, to_location_id, container_id, device_id, result)
  values (p_client_txn_id, p_action, c.id, p_serial, v_from, v_loc.id, coalesce(p_container_id, c.container_id), p_device_id, v_result);

  return v_result;
end;
$$;

-- ------------------------------------------------------------------ packing plan import

-- p_plan: { header:{planRef,poNo,poLine,shipmentDate,vendorFactoryCode,shipToCode,destination,description},
--           source, vendorSystem, totals:{...}, ranges:[PlanCartonRange...] }
create or replace function public.import_packing_plan(p_plan jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h jsonb := p_plan -> 'header';
  v_vendor text := coalesce(p_plan ->> 'vendorSystem', 'MERCURY');
  v_wh text;
  v_version int;
  v_id text;
  v_shipment text;
  v_matched int;
  v_expected int;
begin
  if not public.is_manager() then
    raise exception 'manager role required';
  end if;

  select warehouse_id into v_wh from public.vendor_factory_map
  where vendor_system = v_vendor and vendor_factory_code = h ->> 'vendorFactoryCode';

  if h ->> 'shipmentDate' is not null then
    select id into v_shipment from public.shipments
    where shipment_date = (h ->> 'shipmentDate')::date and coalesce(destination, '') = coalesce(h ->> 'destination', '')
    limit 1;
    if v_shipment is null then
      insert into public.shipments (shipment_date, destination, ship_to_code, ship_method)
      values ((h ->> 'shipmentDate')::date, h ->> 'destination', h ->> 'shipToCode', coalesce(p_plan ->> 'shipMethod', 'SEA'))
      returning id into v_shipment;
    end if;
  end if;

  select coalesce(max(version), 0) + 1 into v_version from public.packing_plans where plan_ref = h ->> 'planRef';

  insert into public.packing_plans (plan_ref, po_no, po_line, description, vendor_system, vendor_factory_code, factory_warehouse_id, shipment_id, source, status, version, totals, issue, created_by)
  values (
    h ->> 'planRef', h ->> 'poNo', h ->> 'poLine', h ->> 'description', v_vendor, h ->> 'vendorFactoryCode', v_wh, v_shipment,
    coalesce(p_plan ->> 'source', 'MANUAL'),
    case when v_wh is null and h ->> 'vendorFactoryCode' is not null then 'DRAFT' else 'VALIDATED' end,
    v_version, coalesce(p_plan -> 'totals', '{}'::jsonb),
    case when v_wh is null and h ->> 'vendorFactoryCode' is not null then 'ยังไม่ map รหัสโรงงาน' end,
    auth.uid()
  ) returning id into v_id;

  insert into public.plan_carton_ranges (plan_id, range_no, carton_from, carton_to, serial_from, serial_to, line_no, style, po_no, po_line, color, size, style_color, ship_method, item_qty, qty_per_carton, inner_pkg_count, carton_count, carton_code, net_net_kg, net_kg, gross_kg, length_cm, width_cm, height_cm)
  select v_id, r."rangeNo", r."cartonFrom", r."cartonTo", r."serialFrom", r."serialTo", r."lineNo", r."style", r."poNo", r."poLine", r."color", r."size", r."styleColor", r."shipMethod", r."itemQty", r."qtyPerCarton", r."innerPkgCount", r."cartonCount", r."cartonCode", r."netNetKg", r."netKg", r."grossKg", r."lengthCm", r."widthCm", r."heightCm"
  from jsonb_to_recordset(p_plan -> 'ranges') as r(
    "rangeNo" text, "cartonFrom" int, "cartonTo" int, "serialFrom" text, "serialTo" text, "lineNo" text, "style" text, "poNo" text, "poLine" text,
    "color" text, "size" text, "styleColor" text, "shipMethod" text, "itemQty" int, "qtyPerCarton" int, "innerPkgCount" int, "cartonCount" int,
    "cartonCode" text, "netNetKg" numeric, "netKg" numeric, "grossKg" numeric, "lengthCm" numeric, "widthCm" numeric, "heightCm" numeric
  );

  -- reserve the exact cartons named by serial range (serials are numeric strings)
  with serials as (
    select lpad(gs::text, length(r.serial_from), '0') as serial
    from public.plan_carton_ranges r,
         generate_series(r.serial_from::bigint, r.serial_to::bigint) gs
    where r.plan_id = v_id and r.serial_from ~ '^\d+$' and r.serial_to ~ '^\d+$'
  )
  update public.cartons c set
    plan_id = v_id,
    status = case when c.status = 'AVAILABLE' then 'RESERVED' else c.status end,
    updated_at = now()
  from serials s where c.serial = s.serial;
  get diagnostics v_matched = row_count;

  select coalesce(sum(carton_count), 0) into v_expected from public.plan_carton_ranges where plan_id = v_id;

  return jsonb_build_object(
    'planId', v_id, 'version', v_version, 'shipmentId', v_shipment, 'factoryWarehouseId', v_wh,
    'expectedCartons', v_expected, 'matchedCartons', v_matched, 'missingCartons', v_expected - v_matched
  );
end;
$$;

create or replace function public.assign_plan_to_container(p_plan_id text, p_container_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text[];
begin
  if not public.is_manager() then raise exception 'manager role required'; end if;
  select array_agg(distinct container_id) into v_old from public.cartons where plan_id = p_plan_id and container_id is not null;
  update public.cartons set container_id = p_container_id, updated_at = now() where plan_id = p_plan_id;
  update public.packing_plans set shipment_id = (select shipment_id from public.containers where id = p_container_id) where id = p_plan_id;
  perform public.refresh_container_counts(p_container_id);
  if v_old is not null then perform public.refresh_container_counts(x) from unnest(v_old) x where x <> p_container_id; end if;
end;
$$;

-- p_steps: [{serial, seq, label}] produced by @wms/shared buildLoadPlan()
create or replace function public.set_load_sequence(p_container_id text, p_steps jsonb, p_fill_volume_pct numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'manager role required'; end if;
  update public.cartons c set load_seq = s.seq, load_label = s.label
  from jsonb_to_recordset(p_steps) as s(serial text, seq int, label text)
  where c.serial = s.serial and c.container_id = p_container_id;
  update public.containers set fill_volume_pct = p_fill_volume_pct, updated_at = now() where id = p_container_id;
end;
$$;

create or replace function public.close_container(p_container_id text, p_seal_no text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_left int;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select count(*) into v_left from public.cartons where container_id = p_container_id and status not in ('LOADED', 'SHIPPED');
  if v_left > 0 then
    return jsonb_build_object('ok', false, 'message', 'ยังไม่ได้โหลดอีก ' || v_left || ' กล่อง');
  end if;
  update public.cartons set status = 'SHIPPED', updated_at = now() where container_id = p_container_id;
  update public.containers set status = 'CLOSED', seal_no = p_seal_no, closed_at = now(), updated_at = now() where id = p_container_id;
  update public.packing_plans p set status = 'CLOSED'
  where exists (select 1 from public.cartons c where c.plan_id = p.id and c.container_id = p_container_id)
    and not exists (select 1 from public.cartons c where c.plan_id = p.id and c.status <> 'SHIPPED');
  return jsonb_build_object('ok', true, 'message', 'ปิดตู้แล้ว');
end;
$$;

create or replace function public.resolve_decision(p_id text, p_resolution text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_manager() then raise exception 'manager role required'; end if;
  update public.decisions set resolved_at = now(), resolved_by = auth.uid(), resolution = p_resolution where id = p_id;
  insert into public.agent_actions (agent, text, result, status) values ('Planner', 'ผู้จัดการตัดสินใจ: ' || p_resolution, 'ดำเนินการ', 'DONE');
end;
$$;

-- ------------------------------------------------------------------ RLS

do $$
declare t text;
begin
  foreach t in array array['warehouses','profiles','locations','vendor_factory_map','carton_codes','shipments','containers','packing_plans','plan_carton_ranges','cartons','stock_txns','agent_actions','decisions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "read for signed-in users" on public.%I for select to authenticated using (true)', t);
  end loop;
  -- managers edit planning data directly; cartons & ledger only change through functions above
  foreach t in array array['warehouses','locations','vendor_factory_map','carton_codes','shipments','containers','packing_plans','plan_carton_ranges','decisions'] loop
    execute format('create policy "managers write" on public.%I for all to authenticated using (public.is_manager()) with check (public.is_manager())', t);
  end loop;
end $$;

create policy "edit own profile name" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

grant execute on function public.scan_carton(text, text, text, text, text, text) to authenticated;
grant execute on function public.import_packing_plan(jsonb) to authenticated;
grant execute on function public.assign_plan_to_container(text, text) to authenticated;
grant execute on function public.set_load_sequence(text, jsonb, numeric) to authenticated;
grant execute on function public.close_container(text, text) to authenticated;
grant execute on function public.resolve_decision(text, text) to authenticated;

-- ------------------------------------------------------------------ realtime

alter publication supabase_realtime add table public.containers, public.cartons, public.stock_txns, public.agent_actions, public.decisions;
