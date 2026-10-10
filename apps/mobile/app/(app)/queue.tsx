import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '../../src/components/ui';
import { useAuthed, useQueueSnapshot } from '../../src/lib/session';
import { colors } from '../../src/theme';

const ACTION_TH: Record<string, string> = { RECEIVE: 'รับเข้า', PUTAWAY: 'วางของ', PICK: 'หยิบ', STAGE: 'Staging', LOAD: 'โหลด', UNLOAD: 'ถอดออก' };

export default function QueueScreen() {
  const { queue } = useAuthed();
  const q = useQueueSnapshot();
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Card style={styles.gap}>
        <Text style={styles.big}>รอส่ง {q.pending}</Text>
        <Text style={styles.muted}>{q.online ? (q.syncing ? 'กำลังส่ง…' : 'ออนไลน์ · ส่งอัตโนมัติทุก 15 วินาที') : 'ออฟไลน์ · จะส่งเมื่อมีสัญญาณ'}</Text>
        <Button label="ส่งตอนนี้" onPress={() => void queue.flush()} disabled={!q.online || q.pending === 0} busy={q.syncing} />
      </Card>

      <Text style={styles.section}>ถูกปฏิเสธจากเซิร์ฟเวอร์ ({q.rejected.length})</Text>
      {q.rejected.map((r) => (
        <View key={r.scan.clientTxnId} style={styles.row}>
          <Text style={styles.rowTitle}>
            {ACTION_TH[r.scan.action] ?? r.scan.action} · {r.scan.serial}
            {r.scan.locationCode ? ` → ${r.scan.locationCode}` : ''}
          </Text>
          <Text style={styles.rowErr}>{r.result.message}</Text>
          <Text style={styles.muted}>{new Date(r.scan.scannedAt).toLocaleString('th-TH')}</Text>
        </View>
      ))}
      {q.rejected.length ? <Button label="ล้างรายการที่ถูกปฏิเสธ" variant="secondary" onPress={() => queue.clearRejected()} /> : <Text style={styles.muted}>ไม่มี</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 12 },
  gap: { gap: 8 },
  big: { fontSize: 32, fontWeight: '800', color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  section: { fontSize: 17, fontWeight: '700', color: colors.secondary, marginTop: 8 },
  row: { backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 12, gap: 4 },
  rowTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  rowErr: { fontSize: 15, color: colors.danger },
});
