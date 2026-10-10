# 06 — รูปแบบ Packing Plan จริง (จากตัวอย่าง) และผลต่อดีไซน์

> ที่มา: ตัวอย่าง Packing Plan 1 หน้า (รายงาน SSRS, A4 แนวนอน) ที่ผู้ใช้ส่งมา 10 ต.ค. 2569
> ห้าม commit ไฟล์ตัวอย่างจริงของลูกค้าเข้า repo — ใช้ข้อมูลจำลองที่โครงสร้างเหมือนกันแทน

## 1. โครงสร้างเอกสาร

### Header
| Field บนเอกสาร | ตัวอย่าง (โครงสร้าง) | Map ไป | หมายเหตุ |
|---|---|---|---|
| Plan Ref Number | `<PO>-<POLine>` | `PackingPlan.planRef` | 1 แผน = 1 PO line |
| SHIPMENT (วันที่) | dd/MM/yyyy | `PackingPlan.shipmentDate` | |
| SHIPMENT (รหัสต่อท้าย) | เช่น `HIT HT70` | `PackingPlan.vendorFactoryCode` | ✅ **รหัสโรงงานในระบบ vendor** — ไม่ตรงกับชื่อที่ใช้ภายใน ต้องมีตาราง mapping `VendorFactoryMap` (vendor + code → Factory/คลังสาขาของเรา) |
| กล่องขวาบน บรรทัด 1 | เช่น `NO CAB` | `PackingPlan.shipToCode` | ❓ ต้องยืนยัน |
| กล่องขวาบน บรรทัด 2 | เมือง, รัฐ, ประเทศ | `PackingPlan.destination` | |
| DESCRIPTION / SHELL | เช่น `MENS 630` | `PackingPlan.productDesc`, `shell` | |

### PO Summary (1 แถวต่อ PO line + Totals)
PO Number, PO Line, Item Qty, Pkg Count (จำนวนกล่อง), Net Net, Net, Gross, Unit (KG), Vol, Unit (CBM)
→ ใช้เป็น **ยอดควบคุม (control totals)** ตอน import: ผลรวมจาก Packing Detail ต้องตรงกับ Summary

### Packing Detail (1 แถวต่อช่วงกล่อง)
| Column | Map ไป `PpCartonRange` | หมายเหตุ |
|---|---|---|
| Range | `rangeNo` | ลำดับแถว |
| From / To | `cartonFrom`, `cartonTo` | เลขกล่องในแผน (1..n) |
| Serial From / Serial To | `serialFrom`, `serialTo` | **เลข serial กล่อง = ตัวตนของกล่อง** ใช้สแกน |
| Line # | `lineNo` | |
| Buyer Item# | `style` | |
| PO # / Main Line# | `poNo`, `poLine` | |
| Color Name | `color` | |
| Size | `size` | 1 แถว = 1 size (solid pack) |
| Short Description | `styleColor` | style-color code |
| Shipment Method | `shipMethod` | ✅ `VL` = ส่งทางเรือ (vessel) — เก็บเป็น enum: SEA / AIR / … |
| Item Qty | `itemQty` | ชิ้นรวมของช่วงนี้ |
| Qty per Pkg / Inner pack | `qtyPerCarton`, `innerPack` | |
| Inner Pkg Count | `innerPkgCount` | |
| Pkg Count | `cartonCount` | = To − From + 1 |
| R | `r` | ❓ ว่างในตัวอย่าง |
| Pack Code | `cartonCode` | รหัสขนาดกล่องมาตรฐาน (เช่น A1, A6, A7) |
| Net Net / Net / Gross / Unit | `netNetKg`, `netKg`, `grossKg` | **ต่อกล่อง** (ต้องยืนยัน: ต่อกล่องหรือต่อช่วง) |
| L / W / H / Unit | `lengthCm`, `widthCm`, `heightCm` | ขนาดกล่องจริง (ทศนิยม 3 ตำแหน่ง) |

## 2. สิ่งที่เปลี่ยนจากดีไซน์เดิม

| ดีไซน์เดิม | ตามตัวอย่างจริง | ผลกระทบ |
|---|---|---|
| หน่วยหลัก = พาเลท (LPN) | **หน่วยหลัก = กล่อง (carton serial)** | รับ/วาง/หยิบ/โหลด ติดตามระดับกล่อง; พาเลทเป็นแค่ "ภาชนะชั่วคราว" ในคลัง (ถ้ามี) |
| Allocation เลือกของเอง (FIFO) | **แผนกำหนดกล่องเฉพาะเจาะจงแล้ว** (serial range) | ไม่ต้องเลือกของ — ต้อง "หาว่ากล่อง serial นี้อยู่ไหน" แทน |
| SKU เดียว | Style + Color + Size | Item master = style-color-size; กล่อง 1 ใบ = 1 size (solid) |
| คำนวณตู้แบบพาเลทก่อน | **โหลดเป็นกล่องเปล่า** (น่าจะ) | Container-fit ระดับกล่องต้องอยู่ใน MVP; ใช้ Pack Code จัดกลุ่มขนาดกล่องมาตรฐาน → layer-building ทำได้ดี |
| แผน 1 ใบ = 1 ตู้ | **แผน 1 ใบ = 1 PO line** (อาจแค่ 5 กล่อง) | ตู้ 1 ตู้ = หลายแผน → ต้องมี **Shipment/Container grouping** เหนือ Packing Plan (รวมตามวัน shipment + ปลายทาง + ship method; แผนจากหลายโรงงานรวมตู้เดียวได้ = source mode ผสม) |
| Putaway ตาม SKU | **Putaway ตาม PO/แผน/shipment** | วางกล่องที่อยู่แผนเดียวกันไว้ด้วยกัน หยิบครั้งเดียวได้ทั้งแผน |

## 3. Data model ที่ปรับ

```
Shipment (ใหม่)        shipmentDate, destination, shipToCode, shipMethod (SEA/AIR), status
VendorFactoryMap (ใหม่) vendorSystem, vendorFactoryCode → factoryId / warehouseId (คลังสาขา)
 └─ Container          type, containerNo, sealNo, loadingWarehouseId, fill%
 └─ PackingPlan        planRef (PO-line), poNo, poLine, productDesc, controlTotals, vendorSystem, version
     └─ PpCartonRange  rangeNo, cartonFrom/To, serialFrom/To, style, color, size, qtyPerCarton, cartonCode, kg, L/W/H
Carton (แทน HandlingUnit เป็นหน่วยหลัก)
                       serial (unique), style, color, size, qty, cartonCode, L/W/H, grossKg,
                       poNo, poLine, planRef?, status, locationId, palletId? (nullable)
Pallet (optional)      id, locationId — กล่องหลายใบบนพาเลทเดียว สแกนพาเลทครั้งเดียวย้ายทั้งชุด
CartonCode (master)    code (A1, A6, A7…), L/W/H มาตรฐาน, maxStack
```

`StockTxn` ยังเป็น ledger เดิม แต่อ้างอิง `cartonId` (และ `palletId` เมื่อย้ายทั้งพาเลท)

## 4. กติกา Import

0. แปลง `vendorFactoryCode` → โรงงาน/คลังสาขาของเราผ่าน `VendorFactoryMap` (ไม่พบ = หยุดและให้ผู้ใช้ map ก่อน) — ใช้เป็นค่าเริ่มต้นว่ากล่องน่าจะอยู่คลังสาขาไหน

1. อ่าน header → หา `PackingPlan` ด้วย `planRef`; ถ้ามีแล้ว = **version ใหม่** แสดง diff
2. ทุกแถว Detail: `cartonCount == To − From + 1 == SerialTo − SerialFrom + 1` (ถ้า serial ต่อเนื่อง)
3. ผลรวม Item Qty / Pkg Count / Gross จาก Detail ต้องตรง PO Summary
4. ปริมาตรคำนวณจาก L×W×H เทียบกับ Vol บนเอกสาร — ยอมคลาดเคลื่อนเล็กน้อยจากการปัดเศษ แต่แจ้งเตือนถ้าต่างเกินเกณฑ์ที่ตั้ง
5. Serial ทุกใบต้อง **มีอยู่ในคลัง** และ **ยังไม่ถูกจองให้แผนอื่น** → ไม่ครบแสดงรายการกล่องที่หาไม่เจอ / อยู่คลังสาขาไหน
6. แหล่งข้อมูลที่รับ: (1) Excel/CSV export จาก vendor portal — แนะนำ, (2) PDF รูปแบบนี้ (parse ตาม layout) — สำรอง

## 5. คำถามที่ต้องยืนยัน

1. ~~รหัสหลังวันที่ shipment~~ ✅ รหัสโรงงาน (vendor) · กล่อง `NO CAB` หมายถึงอะไร ❓
2. ตอนโหลด เป็นกล่องเปล่าเรียงในตู้ทั้งหมด หรือมีพาเลทด้วย
3. กล่องมี barcode serial ติดอยู่แล้วตอนออกจากไลน์ผลิตใช่ไหม (รูปแบบ barcode อะไร)
4. Packing Plan มาก่อนหรือหลังผลิต — serial ถูกกำหนดในแผนก่อนแพ็ค หรือแพ็คก่อนแล้วค่อยออกแผน
5. vendor portal export Excel/CSV ได้ไหม หรือได้แค่ PDF
6. ตู้ 1 ตู้ปกติรวมกี่ PO line / กี่ shipment code
7. ~~Shipment Method `VL`~~ ✅ ส่งทางเรือ · คอลัมน์ `R` หมายถึงอะไร ❓
