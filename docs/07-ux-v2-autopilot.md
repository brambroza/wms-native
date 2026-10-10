# 07 — UX/UI v2: AI Autopilot

> แทนที่แนวทางหน้าจอใน `02-screens.md` สำหรับ web; หลัก "สแกน → ยืนยัน ≤ 3 แตะ" ของ handheld ยังใช้เหมือนเดิม
> Mockup: แคนวาส "WMS FG Export Mockups" หน้า **v2 · AI Autopilot**

## แนวคิด
**ระบบทำงานเอง คนดูแลข้อยกเว้น (Management by exception)**
- AI agents ทำงานประจำ: ดึงแผนจาก vendor, ตรวจยอด, จัดตู้, สร้างใบโอน, จัดตำแหน่งของ, ตรวจรูปจากกล้อง
- คนเห็นเฉพาะ "เรื่องที่ต้องตัดสินใจ" พร้อมคำแนะนำ + % ความมั่นใจ + ปุ่มอนุมัติ
- ทุกการกระทำของ AI มี log, เหตุผล และย้อนกลับได้
- ตั้งค่าได้ต่อเรื่องว่า AI ทำเองได้เลย หรือต้องรออนุมัติ

## หน้าจอ
| หน้าจอ | หน้าที่ |
|---|---|
| Command Center | สรุปวันนี้ 1 ประโยค, ช่องสั่งงานภาษาธรรมชาติ (⌘K), สถานะตู้แบบวงแหวน, log ของ Autopilot, การ์ดตัดสินใจ |
| Shipment Planner | แผนเข้า (ซิงก์ Mercury) → AI จัดหลายแผนเข้าตู้, 3D รถ + ตู้, เหตุผลการจัด, ทางเลือก A/B/C, กติกาการจัด |
| Warehouse Twin | 3D คลังสด, ชั้นข้อมูล (shipment/จอง/AI แนะนำย้าย/ปัญหา), AI slotting, รถสาขาที่กำลังมา |
| Live Loading | 3D รถหัวลาก + ตู้ที่ dock, กล่องเติมตามการสแกนจริง, กล่องถัดไปเรืองแสง, กล้อง + AI vision, ความคืบหน้าราย PO |
| Staff · หยิบกล่อง | ตำแหน่งตัวใหญ่, เส้นทางสั้น, รายการ serial ติ๊กทีละกล่อง, คำแนะนำ AI, ปุ่มเสียง |
| Staff · โหลดตู้ | รถ + ตู้ด้านข้างแสดง % , กล่องถัดไป + ช่องวางมองจากประตู, กล้อง dock ถ่ายอัตโนมัติ |

## Design tokens
| Token | ค่า |
|---|---|
| ground / surface / raised | `#0B0D10` / `#12151A` / `#181C22` |
| line | `#1C2128` |
| text / muted | `#E8EBEF` / `#8A93A0` |
| accent (AI · action) | `#D4FF3A` |
| info / reserved / ok / warn / risk | `#5AB0FF` / `#A58BFF` / `#3DD68C` / `#FFB547` / `#FF5D5D` |
| font UI / ตัวเลข | Anuphan / JetBrains Mono |

สี accent ใช้เฉพาะ "AI ทำ / สิ่งที่ต้องกดต่อ" เท่านั้น — ไม่ใช้ตกแต่ง

## Implementation notes
- 3D: react-three-fiber; รถ/ตู้/dock เป็น low-poly model เดียวใช้ร่วม Planner + Live Loading; กล่องใช้ instanced mesh
- AI agents: Planner (container-fit + กติกา), Sync (vendor), Transfer, Slotting, Vision (ตรวจรูป) — แต่ละตัวเขียน action log ลงตารางเดียว (`AgentAction`: agent, action, reason, confidence, status, undoable)
- ช่องสั่งงาน: แปลงคำสั่งเป็น action ที่มีอยู่แล้วในระบบ + ต้องยืนยันก่อนทำทุกครั้งที่เปลี่ยนสต็อกหรือแผน
- Handheld ธีมมืดต้องทดสอบในคลังจริง (แสงจ้า/สะท้อน) — เตรียมธีมสว่าง high-contrast ไว้สลับ
