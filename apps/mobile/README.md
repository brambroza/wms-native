# FG Dock Staff — แอปมือถือ/เครื่องสแกนสำหรับพนักงานคลัง

แอป Expo (React Native + expo-router) สำหรับเครื่อง handheld Android (Zebra / Honeywell) และมือถือทั่วไป
งานที่รองรับ: **หยิบ (Pick) · โหลดตู้ (Load) · รับเข้า (Receive) · วางของ (Putaway)** — หน่วยที่สแกนคือ "กล่อง" (carton serial) ตาม `docs/06-packing-plan-format.md`

> `apps/mobile` **ไม่ใช่** npm workspace ของ root — ติดตั้ง dependency ในโฟลเดอร์นี้เท่านั้น

## เริ่มต้น

```bash
cd apps/mobile
npm install
cp .env.example .env      # ใส่ค่า Supabase (ข้ามได้ถ้าจะใช้โหมดทดลองอย่างเดียว)
npx expo start            # สแกน QR ด้วยแอป Expo Go บนมือถือ/เครื่อง handheld
```

- ไม่ตั้ง `EXPO_PUBLIC_SUPABASE_URL` → หน้า Login จะมีแค่ปุ่ม **"โหมดทดลอง (ไม่ต่อเซิร์ฟเวอร์)"** ใช้ข้อมูลตัวอย่างจาก `@wms/shared` `demoData()` สแกนแล้วสถานะเปลี่ยนจริงในเครื่อง (รีเซ็ตเมื่อออกจากระบบ/ปิดแอป)
- serial ตัวอย่างสำหรับทดลอง: ดูในหน้าหยิบ/โหลด (เช่น ตู้ C1 เริ่มที่ 71000xx) · รหัสตำแหน่ง เช่น `C-A04-2`, `STG-A`, `DOCK-1`
- ตรวจ type: `npm run typecheck` · ทดลอง bundle: `npx expo export --platform android`

## ตั้งค่า env

| ตัวแปร | ความหมาย |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL ของ Supabase project |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | anon key (สิทธิ์ถูกคุมด้วย RLS + RPC `scan_carton`/`close_container`) |

ค่า `EXPO_PUBLIC_*` ถูกฝังตอน bundle — แก้แล้วต้อง restart `expo start` หรือ build ใหม่
สำหรับ EAS build ให้ตั้งใน `eas.json` → `build.preview.env` หรือใช้ `eas env:create` (แนะนำ ไม่ต้อง commit key)

## Build APK สำหรับติดตั้งบนเครื่อง handheld (sideload)

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview   # ได้ไฟล์ .apk
```

ดาวน์โหลด APK จากลิงก์ที่ EAS ให้ แล้วติดตั้งบนเครื่อง (เปิด "ติดตั้งแอปจากแหล่งที่ไม่รู้จัก") หรือ `adb install app.apk`
หมายเหตุ: ใน Expo Go ใช้ได้ครบทุกฟังก์ชันเพราะใช้เฉพาะ module ที่ Expo Go มีอยู่แล้ว (camera, haptics, crypto, async-storage, netinfo, svg)

## ตั้งค่าเครื่องสแกน (สำคัญ)

แอปรับค่าจากเครื่องสแกนแบบ **keyboard-wedge** (เครื่องสแกน "พิมพ์" บาร์โค้ดเข้าช่องที่โฟกัสอยู่) — มีช่องรับที่ซ่อนไว้และโฟกัสตลอด ไม่เด้งคีย์บอร์ด

- **Zebra (DataWedge)**: Profile ของแอป `th.co.goalong.fgdock` → เปิด *Keystroke output* → *Action key character* = **Enter** (หรือ Basic data formatting → Send ENTER key) · ปิด *Intent output*
- **Honeywell**: Settings → Scanning → Internal Scanner → Default profile → Data Processing Settings → *Wedge Method* = **Keyboard** (หรือ Standard) · *Suffix* = **Enter / `\n`**
- ทดสอบ: เปิดหน้าหยิบ/โหลด ด้านล่างช่องพิมพ์ต้องขึ้น "● พร้อมรับจากเครื่องสแกน" แล้วยิงบาร์โค้ด → แถบสีเขียว/แดงเต็มจอ + สั่น
- ถ้าแตะช่องพิมพ์เอง เครื่องสแกนจะหยุดชั่วคราว (ขึ้น ○) — แตะที่อื่นเพื่อกลับมารับจากเครื่องสแกน
- ไม่มีเครื่องสแกน: กดปุ่ม **กล้อง** (QR, Code128, EAN-13, Code39) หรือพิมพ์เองแล้วกด **ตกลง**

## ออฟไลน์

ทุกการสแกนได้ `clientTxnId` (UUID) และถูกบันทึกลงเครื่อง (AsyncStorage) **ก่อน** ส่ง จากนั้นส่งตามลำดับเมื่อมีสัญญาณ (ตรวจด้วย NetInfo + ลองใหม่ทุก 15 วินาที)
เซิร์ฟเวอร์ (`scan_carton`) idempotent ตาม `p_client_txn_id` จึงส่งซ้ำได้ปลอดภัย · มุมขวาบนแสดง **"รอส่ง N"** · รายการที่เซิร์ฟเวอร์ปฏิเสธดูได้ที่หน้า "คิวรอส่ง"
ปิดตู้ (ใส่เลขซีล) ต้องออนไลน์และไม่มีรายการรอส่ง

## โครงสร้าง

```
app/                       เส้นทาง (expo-router)
  login.tsx                อีเมล/รหัสผ่าน + โหมดทดลอง
  (app)/home.tsx           งานของฉัน: ปุ่มใหญ่ 4 งาน + รายการตู้
  (app)/pick/[id].tsx      หยิบ: ตำแหน่งตัวใหญ่ + กล่องจัดกลุ่มตามตำแหน่ง
  (app)/load/[id].tsx      โหลด: กล่องถัดไปตาม load_seq + ตำแหน่งวางในตู้ + ภาพรถ/ตู้ + ปิดตู้
  (app)/receive.tsx, putaway.tsx   สแกนกล่อง → สแกนตำแหน่ง
  (app)/queue.tsx          คิวรอส่ง / รายการถูกปฏิเสธ
src/lib/api.ts             interface WmsApi + Supabase implementation
src/lib/demoApi.ts         Demo implementation (in-memory, กติกาเดียวกับ SQL)
src/lib/scanQueue.ts       คิวออฟไลน์
src/lib/supabase.ts, device.ts, session.tsx
src/components/ScannerInput.tsx   wedge + กล้อง + พิมพ์เอง → onScan(code)
src/components/TruckFill.tsx      ภาพรถหัวลาก+ตู้ (react-native-svg)
```

โค้ดร่วม `@wms/shared` มาจาก `../../packages/shared/src` (ตั้งใน `metro.config.js` และ `tsconfig.json` paths)
