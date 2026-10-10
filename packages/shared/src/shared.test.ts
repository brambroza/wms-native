import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildLoadPlan, demoData, expandSerials, fitContainer, parsePackingPlanText, parsePlanRows, validatePlan } from './index';

// Synthetic text in the vendor's SSRS layout (fictitious values).
const SAMPLE_TEXT = `   Packing Plan

                             Plan Ref Number            4500000999-10                                       SHIPMENT          29/03/2023           FAC X70

PO SUMMARY
                                                                                                             NO CAB
       PO Number           PO Line     Item Qty        Pkg Count          Net Net             Net                 Gross         Unit             Vol              Unit

       4500000999            10            43.00          5.00             0.00               8.32                10.93          KG              0.114            CBM
                                                                                                                            MEMPHIS, TN,USA

PACKING DETAIL
0001            1        1 7000001 7000001     0001   ST9001     4500000999 00010        BLACK/GREY                     M      ST9001-010              VL                    10       10                       1.00       A6                1.800    2.280 KG      39.70 30.50   17.80 CM
0002            2        2 7000002 7000002     0002   ST9001     4500000999 00010        BLACK/GREY                     L      ST9001-010              VL                    16       16                       1.00       A1                3.040    3.890 KG      59.70 39.70   20.30 CM
0003            3        3 7000004 7000004     0003   ST9001     4500000999 00010        BLACK/GREY                     XL     ST9001-010              VL                    10       10                       1.00       A6                2.000    2.480 KG      39.70 30.50   17.80 CM
0004            4        4 7000005 7000005     0004   ST9001     4500000999 00010        BLACK/GREY                     2XL    ST9001-010              VL                     6        6                       1.00       A7                1.260    1.660 KG      39.70 30.50   10.20 CM
0005            5        5 7000007 7000007     0005   ST9001     4500000999 00010        BLACK/GREY                     3XL    ST9001-010              VL                     1        1                       1.00       A7                0.220    0.620 KG      39.70 30.50   10.20 CM

DESCRIPTION :                           MENS 630
`;

test('parses the SSRS packing plan text', () => {
  const p = parsePackingPlanText(SAMPLE_TEXT);
  assert.ok(p);
  assert.equal(p.header.planRef, '4500000999-10');
  assert.equal(p.header.shipmentDate, '2023-03-29');
  assert.equal(p.header.vendorFactoryCode, 'FAC X70');
  assert.equal(p.header.destination, 'MEMPHIS, TN,USA');
  assert.equal(p.header.shipToCode, 'NO CAB');
  assert.equal(p.header.description, 'MENS 630');
  assert.equal(p.ranges.length, 5);
  assert.equal(p.ranges[1].size, 'L');
  assert.equal(p.ranges[1].cartonCode, 'A1');
  assert.equal(p.ranges[1].grossKg, 3.89);
  assert.equal(p.ranges[4].heightCm, 10.2);
  assert.deepEqual(p.summary, { itemQty: 43, cartons: 5, netNetKg: 0, netKg: 8.32, grossKg: 10.93, cbm: 0.114 });
});

test('validates control totals and flags the small CBM difference as a warning', () => {
  const p = parsePackingPlanText(SAMPLE_TEXT)!;
  const v = validatePlan(p);
  const byKey = Object.fromEntries(v.checks.map((c) => [c.key, c.level]));
  assert.equal(byKey.itemQty, 'ok');
  assert.equal(byKey.cartons, 'ok');
  assert.equal(byKey.grossKg, 'ok');
  assert.equal(byKey.cbm, 'warn');
  assert.equal(v.shipMethod, 'SEA');
  assert.equal(v.level, 'warn');
});

test('parses tabular rows with vendor column names', () => {
  const rows = [
    { Range: '0001', From: 1, To: 3, 'Serial From': '100', 'Serial To': '102', 'PO #': '4500000001', 'Main Line#': '00010', Size: 'M', 'Pkg Count': 3, 'Pack Code': 'A6', Gross: 2.2, L: 40, W: 30, H: 18, 'Item Qty': 30 },
    { Range: '0002', From: 4, To: 4, 'Serial From': '103', 'Serial To': '103', 'PO #': '4500000001', 'Main Line#': '00010', Size: 'L', 'Pkg Count': 1, 'Pack Code': 'A1', Gross: 3.9, L: 60, W: 40, H: 20, 'Item Qty': 16 },
  ];
  const plans = parsePlanRows(rows);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].header.planRef, '4500000001-10');
  assert.equal(plans[0].ranges[0].cartonCount, 3);
  assert.deepEqual(expandSerials(plans[0].ranges[0]), ['100', '101', '102']);
});

test('fits cartons into a container and reports overflow', () => {
  const r = fitContainer([{ key: 'A6', group: 'P1', lengthCm: 39.7, widthCm: 30.5, heightCm: 17.8, grossKg: 2.3, count: 100 }], '20GP');
  assert.equal(r.placedCartons, 100);
  assert.equal(r.overflow.length, 0);
  assert.ok(r.volumeUsedPct > 0 && r.volumeUsedPct < 100);
  const big = fitContainer([{ key: 'A1', group: 'P1', lengthCm: 59.7, widthCm: 39.7, heightCm: 20.3, grossKg: 3.9, count: 5000 }], '20GP');
  assert.ok(big.overflow[0].count > 0);
  // nothing pokes out of the box
  for (const p of big.placements) {
    assert.ok(p.x + p.l <= 590 + 1e-6 && p.y + p.w <= 235 + 1e-6 && p.z + p.h <= 239 + 1e-6);
  }
});

test('builds a load plan for demo container C1', () => {
  const d = demoData();
  const cartons = d.cartons.filter((c) => c.containerId === 'ct-1');
  const plan = buildLoadPlan(cartons, '40HC');
  assert.equal(plan.steps.length + plan.unplaced.length, cartons.length);
  assert.equal(new Set(plan.steps.map((s) => s.serial)).size, plan.steps.length);
  assert.match(plan.steps[0].label, /^แถว 1/);
});
