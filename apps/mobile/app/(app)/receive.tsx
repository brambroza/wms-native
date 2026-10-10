import { TwoStepScan } from '../../src/screens/TwoStepScan';

export default function Receive() {
  return <TwoStepScan action="RECEIVE" intro="รับ FG ที่โอนมาจากคลังสาขาเข้าคลังกลาง: สแกนกล่อง แล้วสแกนตำแหน่งรับเข้า (เช่น STG-A หรือชั้นวาง)" />;
}
