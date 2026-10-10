import { ContainerPicker } from '../../../src/screens/ContainerPicker';

export default function PickList() {
  return <ContainerPicker target="/pick/[id]" statuses={['PLANNED', 'PICKING', 'READY', 'LOADING']} empty="ไม่มีงานหยิบ" />;
}
