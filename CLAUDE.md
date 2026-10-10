# CLAUDE.md — wms-native

ระบบ WMS สำหรับงาน **FG ส่งออก**: รับ FG จากคลังสาขา → คลังกลาง, แนะนำวางของ, onhand 2D/3D, Packing Plan (สร้าง/import/อนุมัติ/ส่ง vendor เช่น Mercury), คำนวณเต็มตู้ 3D, แนะนำการหยิบ, โหลดตู้เรียลไทม์

## เอกสารหลัก (อ่านก่อนเริ่มงาน)
- `docs/01-business-flow.md` — flow ธุรกิจ, 3 source mode, state ของ Packing Plan, exceptions
- `docs/02-screens.md` — รายการหน้าจอ + หลัก UX
- `docs/03-architecture.md` — stack, monorepo, data model, API, container-fit
- `docs/04-plan.md` — phase/sprint
- `docs/05-recommendations.md`
- `docs/07-ux-v2-autopilot.md` — แนวคิด AI Autopilot (agents, การตัดสินใจ, log)
- `docs/08-ux-v3-clean-saas.md` — **หน้าตา UI ปัจจุบัน (v3 Clean SaaS) + design tokens**
- `docs/06-packing-plan-format.md` — **รูปแบบ Packing Plan จริง: หน่วยหลักคือกล่อง (carton serial) ไม่ใช่พาเลท — มีผลเหนือ 01/03 เมื่อขัดกัน**

## Stack (ปัจจุบัน)
Next.js 16 + TypeScript + Tailwind v4 (`apps/web`, รวม staff PWA ที่ `/m`) · Expo/React Native (`apps/mobile`, handheld) · Supabase (Postgres, Auth, Realtime, RLS, RPC ใน `supabase/migrations`) · three.js ผ่าน react-three-fiber · โค้ดกลาง `packages/shared`
> Next.js 16 มี breaking changes — อ่าน `apps/web/AGENTS.md` และ `node_modules/next/dist/docs/` ก่อนแก้โค้ด web (cacheComponents: URL hooks ต้องอยู่ใน `<Suspense>`, ใช้ `proxy.ts` แทน middleware)
> stack เดิม (.NET + MSSQL) ใน `docs/03-architecture.md` ถูกแทนที่แล้ว ส่วน data model / กติกายังใช้ได้

## กฎทีม
- สต็อกเปลี่ยนผ่าน RPC `scan_carton` (ledger `stock_txns`) เท่านั้น; scan idempotent ด้วย `client_txn_id`
- ทุกหน้าจออ่าน/เขียนผ่าน interface `WmsApi` (`apps/web/src/lib/api`) ซึ่งมี 2 แบบ: Supabase และ Demo — แก้กติกาใน SQL ต้องแก้ DemoApi ให้ตรงกัน (และ `apps/mobile/src/lib/demoApi.ts`)
- ก่อน commit: `npm test`, `npm run typecheck`, `npm run build`, `npx eslint src` (ใน apps/web), `npx tsc --noEmit` (ใน apps/mobile)
- UI ภาษาไทยเป็นค่าเริ่มต้น; ชื่อโค้ด/DB เป็นอังกฤษ
- สี/ฟอนต์ตาม tokens ใน `docs/08-ux-v3-clean-saas.md` (ประกาศไว้ใน `apps/web/src/app/globals.css`)

## Role agents (`.claude/agents/`)
| Agent | ใช้เมื่อ |
|---|---|
| `wh-manager` | ตรวจ process, กติกา, exception, สิทธิ์อนุมัติ |
| `wh-staff` | ตรวจหน้าจอ mobile และขั้นตอนหน้างาน |
| `director` | จัดลำดับ scope, KPI, ความคุ้มค่า |
| `senior-dev` | architecture, data model, โค้ด, test |
| `senior-uxui` | ออกแบบ/รีวิวหน้าจอ, 2D/3D, design system |

ทุก feature: ออกแบบโดย `senior-uxui` + `senior-dev` → รีวิวโดย `wh-manager` + `wh-staff` → `director` ตัดสินถ้าขัดกันเรื่อง scope
