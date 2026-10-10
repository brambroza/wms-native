// Validates supabase/migrations + seed.sql against a throwaway Postgres (no Docker needed).
// Usage: node scripts/sql-test.mjs <dir-with-embedded-postgres-installed>
// Stubs the parts of Supabase the schema relies on (auth.users, auth.uid(), roles, realtime publication).
import { readFileSync, readdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';

const req = createRequire(join(process.argv[2], 'package.json'));
const EmbeddedPostgres = req('embedded-postgres').default;
const pg = req('pg');

const root = new URL('..', import.meta.url).pathname;
const dataDir = mkdtempSync(join(tmpdir(), 'wmspg-'));
const db = new EmbeddedPostgres({ databaseDir: dataDir, user: 'postgres', password: 'pw', port: 54399, persistent: false });

const assert = (cond, msg) => {
  if (!cond) throw new Error('ASSERT: ' + msg);
  console.log('  ✓', msg);
};

await db.initialise();
await db.start();
const c = new pg.Client({ host: 'localhost', port: 54399, user: 'postgres', password: 'pw', database: 'postgres' });
await c.connect();
try {
  await c.query(`
    create role authenticated; create role anon;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create publication supabase_realtime;
  `);
  for (const f of readdirSync(join(root, 'supabase/migrations')).sort()) {
    await c.query(readFileSync(join(root, 'supabase/migrations', f), 'utf8'));
    console.log('migration ok:', f);
  }
  await c.query(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'));
  console.log('seed ok');

  const mgr = '11111111-1111-1111-1111-111111111111';
  await c.query(`insert into auth.users (id, email) values ($1, 'mgr@example.com')`, [mgr]);
  const prof = await c.query('select role from public.profiles where id = $1', [mgr]);
  assert(prof.rows[0]?.role === 'staff', 'signup trigger creates a staff profile');
  await c.query(`update public.profiles set role = 'manager' where id = $1`, [mgr]);
  await c.query(`select set_config('request.jwt.claim.sub', $1, false)`, [mgr]);

  const staged = await c.query(`select serial from public.cartons where container_id = 'ct-1' and status = 'STAGED' order by load_seq limit 1`);
  const serial = staged.rows[0].serial;
  const before = (await c.query(`select loaded_cartons from public.containers where id = 'ct-1'`)).rows[0].loaded_cartons;
  const scan = (txn, action, s, ct = null, loc = null) =>
    c.query('select public.scan_carton($1,$2,$3,$4,$5,$6) as r', [txn, action, s, ct, loc, 'test-device']).then((x) => x.rows[0].r);

  const r1 = await scan('t-1', 'LOAD', serial, 'ct-1');
  assert(r1.ok && !r1.duplicate, 'LOAD scan succeeds');
  assert(r1.loadedCartons === before + 1, `container count goes ${before} -> ${before + 1}`);
  const r2 = await scan('t-1', 'LOAD', serial, 'ct-1');
  assert(r2.duplicate === true && r2.loadedCartons === before + 1, 'same clientTxnId is idempotent');
  const other = (await c.query(`select serial from public.cartons where container_id = 'ct-2' and status = 'STAGED' limit 1`)).rows[0].serial;
  const r3 = await scan('t-2', 'LOAD', other, 'ct-1');
  assert(!r3.ok && r3.code === 'WRONG_CONTAINER', 'carton of another container is rejected');
  const r4 = await scan('t-3', 'LOAD', '999999999', 'ct-1');
  assert(!r4.ok && r4.code === 'NOT_FOUND', 'unknown serial is rejected');
  const r5 = await scan('t-4', 'PUTAWAY', other, null, 'c-a03-2');
  assert(r5.ok, 'PUTAWAY to a location (case-insensitive code)');
  const txns = (await c.query('select count(*)::int n from public.stock_txns')).rows[0].n;
  assert(txns === 4, 'ledger has one row per distinct transaction');

  // import a plan whose serials exist in stock
  await c.query(`insert into public.cartons (serial, length_cm, width_cm, height_cm, gross_kg, warehouse_id, status) select lpad(g::text, 7, '0'), 39.7, 30.5, 17.8, 2.3, 'wh-a', 'AVAILABLE' from generate_series(7000001, 7000007) g`);
  const plan = {
    header: { planRef: '4500000999-10', poNo: '4500000999', poLine: '10', shipmentDate: '2026-10-20', vendorFactoryCode: 'FAC-A01', shipToCode: 'X', destination: 'MEMPHIS, TN,USA', description: 'MENS 630' },
    source: 'PDF', vendorSystem: 'MERCURY', shipMethod: 'SEA', totals: { cartons: 5 },
    ranges: [
      { rangeNo: '0001', cartonFrom: 1, cartonTo: 2, serialFrom: '7000001', serialTo: '7000002', cartonCount: 2, poNo: '4500000999', poLine: '00010', size: 'M', cartonCode: 'A6', grossKg: 2.28, lengthCm: 39.7, widthCm: 30.5, heightCm: 17.8, itemQty: 20, qtyPerCarton: 10 },
      { rangeNo: '0002', cartonFrom: 3, cartonTo: 5, serialFrom: '7000004', serialTo: '7000006', cartonCount: 3, poNo: '4500000999', poLine: '00010', size: 'L', cartonCode: 'A1', grossKg: 3.89, lengthCm: 59.7, widthCm: 39.7, heightCm: 20.3, itemQty: 48, qtyPerCarton: 16 },
    ],
  };
  const imp = (await c.query('select public.import_packing_plan($1) as r', [plan])).rows[0].r;
  assert(imp.matchedCartons === 5 && imp.missingCartons === 0, 'import reserves exactly the 5 serials in the plan');
  assert(imp.factoryWarehouseId === 'wh-a', 'vendor factory code is mapped to branch A');
  const reserved = (await c.query(`select count(*)::int n from public.cartons where plan_id = $1 and status = 'RESERVED'`, [imp.planId])).rows[0].n;
  assert(reserved === 5, 'reserved cartons are linked to the plan');
  const imp2 = (await c.query('select public.import_packing_plan($1) as r', [plan])).rows[0].r;
  assert(imp2.version === 2, 're-import creates version 2');

  const close = (await c.query(`select public.close_container('ct-2', 'SEAL1') as r`)).rows[0].r;
  assert(close.ok === false, 'cannot close a container that is not fully loaded');

  await c.query(`select set_config('request.jwt.claim.sub', '', false)`);
  let denied = false;
  try { await scan('t-9', 'LOAD', serial, 'ct-1'); } catch { denied = true; }
  assert(denied, 'anonymous scans are refused');
  console.log('\nALL SQL CHECKS PASSED');
} finally {
  await c.end();
  await db.stop();
}
