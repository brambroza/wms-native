import { ContainerPicker } from '../../../src/screens/ContainerPicker';

export default function LoadList() {
  return <ContainerPicker target="/load/[id]" statuses={['READY', 'LOADING', 'PICKING']} empty="ไม่มีตู้รอโหลด" />;
}
