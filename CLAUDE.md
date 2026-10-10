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

## Stack
React + TS (web) · React Native/Expo (mobile staff) · .NET 8 Web API + SignalR + Hangfire · MSSQL · three.js via react-three-fiber · Docker + Jenkins

## กฎทีม
- สต็อกเปลี่ยนผ่าน `StockTxn` เท่านั้น; scan idempotent ด้วย `clientTxnId`
- UI ภาษาไทยเป็นค่าเริ่มต้น; ชื่อโค้ด/DB เป็นอังกฤษ
- สีสถานะตามที่กำหนดใน `docs/02-screens.md`

## Role agents (`.claude/agents/`)
| Agent | ใช้เมื่อ |
|---|---|
| `wh-manager` | ตรวจ process, กติกา, exception, สิทธิ์อนุมัติ |
| `wh-staff` | ตรวจหน้าจอ mobile และขั้นตอนหน้างาน |
| `director` | จัดลำดับ scope, KPI, ความคุ้มค่า |
| `senior-dev` | architecture, data model, โค้ด, test |
| `senior-uxui` | ออกแบบ/รีวิวหน้าจอ, 2D/3D, design system |

ทุก feature: ออกแบบโดย `senior-uxui` + `senior-dev` → รีวิวโดย `wh-manager` + `wh-staff` → `director` ตัดสินถ้าขัดกันเรื่อง scope
