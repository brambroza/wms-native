# 04 — Development Plan

สมมติทีม: 1 Senior Dev (full-stack) + 1 Dev + 1 UX/UI (part-time) + Claude Code agents, sprint ละ 2 สัปดาห์

## Phase 0 — Discovery (สัปดาห์ 1–2)  ⚠️ ห้ามข้าม

- [ ] ขอตัวอย่าง Packing Plan จริงจาก Mercury + vendor อื่น (ไฟล์ export / หน้าจอ) อย่างน้อยรายละ 3 ชุด
- [ ] เดินคลังกลาง 1 รอบ: วัดผัง zone/rack/ช่อง, ประตู dock, staging → วาดเป็น layout ใน `db/seed`
- [ ] รวบรวม master: SKU FG + ขนาด/น้ำหนักกล่อง + กล่องต่อพาเลท + ซ้อนได้กี่ชั้น
- [ ] ยืนยัน: mode 2 โหลดที่กลางเสมอ หรือรถแวะ 2 จุด? / โหลดเป็นพาเลทหรือกล่องเปล่า? / อุปกรณ์ handheld รุ่นไหน
- [ ] สต็อกปัจจุบันอยู่ระบบไหน (ERP?) ต้อง sync อะไรบ้าง
- ผลลัพธ์: Process ยืนยันโดย Manager WH, รายการ field ของ Packing Plan, layout คลัง

## Phase 1 — รับเข้า + เก็บ + มองเห็นสต็อก (สัปดาห์ 3–6)

- Monorepo, auth + roles, CI/CD (Jenkins + Docker)
- Master data: warehouse, location (มีพิกัด), item, container type
- LPN + พิมพ์ label QR
- M2 รับจากไลน์ผลิต, W9/M3 โอนสาขา → กลาง + ASN
- M4 Putaway แนะนำตำแหน่ง (rule-based scoring v1)
- W2 Onhand: ตาราง + 2D map
- **Demo**: รับรถจากสาขาจริง 1 คัน แล้วเห็นของบน 2D map ถูกตำแหน่ง

## Phase 2 — Packing Plan + คำนวณตู้ + หยิบ (สัปดาห์ 7–10)

- W4 สร้างจาก ATP, W5 Import (Mercury template ก่อน)
- `container-fit` v1 (พาเลท) + W6 แสดงผล 3D
- W7 อนุมัติ + version/diff, Export ไฟล์ส่ง vendor
- Allocation + M5 Pick + staging lane, mode 1 ก่อน แล้ว mode 2/3
- **Demo**: แผนจริง 1 ตู้ — คำนวณเต็มตู้ ตรงกับที่โหลดจริง ±5%

## Phase 3 — โหลดเรียลไทม์ + Dashboard (สัปดาห์ 11–14)

- M6 โหลดตู้ + รูป checkpoint + seal, GI, Loading Report PDF
- W8 Loading Monitor (SignalR), W1 Dashboard Director
- 3D onhand view
- Offline sync บน mobile
- **Go-live pilot**: ลูกค้า 1 ราย, สาขา 1 แห่ง, 2 สัปดาห์ เดินคู่กับวิธีเดิม

## Phase 4 — ต่อยอด (หลัง go-live)

- container-fit v2 (กล่องเปล่า / hybrid), แนะนำ "เติมอะไรให้เต็มตู้"
- Vendor API / RPA submit อัตโนมัติ
- Cycle count, ABC re-slotting, KPI reports
- เชื่อม ERP (sales order → packing plan, GI → invoice)

## Definition of Done (ทุก story)
Test (unit + API), ใช้งานบน handheld จริงได้, ข้อความไทย, audit log, ผ่าน review ของ agent ที่เกี่ยวข้อง (ดู `.claude/agents/`)
