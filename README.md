# FG Dock — WMS งาน FG ส่งออก

ระบบคลังสินค้าสำหรับงาน FG ส่งออก ติดตามของเป็น**รายกล่อง (carton serial)** ตาม Packing Plan ของ vendor มีฟีเจอร์ดังนี้
- นำเข้า Packing Plan จาก PDF / Excel / CSV และตรวจยอดควบคุมให้
- จองกล่องตาม serial ที่ระบุในแผน
- คำนวณการจัดเรียงในตู้แบบ 3D
- หยิบและโหลดตู้แบบเรียลไทม์
- ทำงานต่อได้แม้ Wi-Fi หลุด

| ส่วน | เทคโนโลยี | โฟลเดอร์ |
|---|---|---|
| Web (ผู้จัดการ / ผู้บริหาร) + **PWA** ของ staff (`/m`) | Next.js 16 · TypeScript · Tailwind v4 · three.js (react-three-fiber) | `apps/web` |
| แอป **Native** สำหรับเครื่อง handheld (Zebra / Honeywell) | Expo (React Native) · expo-router · expo-camera | `apps/mobile` |
| Backend | Supabase (Postgres + Auth + Realtime + RLS + RPC) | `supabase/` |
| โค้ดกลาง (types, คำนวณตู้, อ่าน Packing Plan, ข้อมูลตัวอย่าง) | TypeScript | `packages/shared` |

## เริ่มเร็ว (โหมดทดลอง ไม่ต้องมีฐานข้อมูล)

```bash
npm install
npm run dev            # http://localhost:3000  · staff PWA: http://localhost:3000/m
```

ถ้าไม่ได้ตั้งค่า Supabase ระบบจะใช้ข้อมูลตัวอย่างในเบราว์เซอร์
- มีตู้ 5 ตู้ และกล่องประมาณ 11,000 กล่อง
- ตู้ C1 จะโหลดเองทุก 5 วินาที เพื่อให้เห็นการอัปเดตแบบเรียลไทม์

## ต่อ Supabase จริง

1. สร้าง project บน supabase.com หรือรันในเครื่องด้วย `supabase start` (ต้องมี Docker)
2. รัน migration และ seed

   ```bash
   supabase db push                          # migrations ใน supabase/migrations
   psql "$DATABASE_URL" -f supabase/seed.sql # ข้อมูลตัวอย่าง (ไม่บังคับ)
   ```

3. ตั้งค่า env ของ web ใน `apps/web/.env.local` และของ mobile ใน `apps/mobile/.env`

   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

4. สร้างผู้ใช้ผ่าน Supabase Auth ผู้ใช้ใหม่จะได้สิทธิ์ `staff`
   - ถ้าต้องการให้เป็นผู้จัดการ ให้ตั้ง role ด้วย `update profiles set role = 'manager' where id = '...';`

## กติกาหลักของข้อมูล

- **สต็อกเปลี่ยนได้ทางเดียวคือ** RPC `scan_carton(...)` ซึ่งเขียน ledger ลง `stock_txns`
- ทุกการสแกนมี `client_txn_id` ทำให้อุปกรณ์ส่งซ้ำได้ปลอดภัยตอนเน็ตหลุด
- `import_packing_plan(jsonb)` จะทำสิ่งเหล่านี้
  - map รหัสโรงงานของ vendor ไปเป็นคลังสาขา
  - สร้างหรือผูก Shipment
  - จองกล่องตามช่วง serial
  - เก็บเป็น version ใหม่ถ้านำเข้าแผนเดิมซ้ำ
- Realtime ส่ง event จากตาราง `containers`, `cartons`, `stock_txns`, `agent_actions` และ `decisions`

## ตรวจสอบ

```bash
npm test                                  # unit test โค้ดกลาง (parser, คำนวณตู้, load plan)
npm run typecheck                         # shared + web
npm run build                             # production build ของ web
node scripts/sql-test.mjs <dir-ที่ติดตั้ง embedded-postgres>   # ทดสอบ migration + seed + RPC บน Postgres จริง
npx tsx scripts/gen-seed.ts               # สร้าง supabase/seed.sql ใหม่จากข้อมูลตัวอย่าง
```

## PWA กับ Native: ใช้อะไรเมื่อไหร่

| | PWA (`/m`) | Native (`apps/mobile`) |
|---|---|---|
| ติดตั้ง | เปิดเว็บแล้วกด "เพิ่มลงหน้าจอหลัก" | ติดตั้งไฟล์ APK (EAS build) |
| เครื่องสแกนแบบ keyboard-wedge | ได้ | ได้ (มีช่องรับที่โฟกัสตลอด) |
| กล้อง | BarcodeDetector หรือ ZXing | expo-camera |
| ออฟไลน์ | Service worker + คิวใน IndexedDB | คิวใน AsyncStorage |
| เหมาะกับ | มือถือทั่วไป, เริ่มใช้งานเร็ว ไม่ต้องติดตั้ง | เครื่อง Zebra / Honeywell ที่ใช้ทั้งกะ, ต้องการความเสถียรสูง |

ดูรายละเอียดเพิ่มเติมได้ที่ [`docs/`](docs/) และ [`apps/mobile/README.md`](apps/mobile/README.md)
