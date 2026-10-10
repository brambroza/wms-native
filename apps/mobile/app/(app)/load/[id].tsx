import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScanBanner } from '../../../src/components/ScanBanner';
import { ScannerInput } from '../../../src/components/ScannerInput';
import { SealDialog } from '../../../src/components/SealDialog';
import { TruckFill } from '../../../src/components/TruckFill';
import { Button, Card, Loading, Pill, ProgressBar } from '../../../src/components/ui';
import { useContainerCartons } from '../../../src/hooks/useContainerCartons';
import { useScan } from '../../../src/hooks/useScan';
import { useAuthed, useQueueSnapshot } from '../../../src/lib/session';
import { colors } from '../../../src/theme';

const LOADED = new Set(['LOADED', 'SHIPPED']);

export default function LoadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { api } = useAuthed();
  const q = useQueueSnapshot();
  const { container, cartons, error, reload, markLocal } = useContainerCartons(id);
  const { banner, submit, show } = useScan();
  const [sealOpen, setSealOpen] = useState(false);

  const ordered = useMemo(
    () => [...(cartons ?? [])].sort((a, b) => (a.loadSeq ?? Number.MAX_SAFE_INTEGER) - (b.loadSeq ?? Number.MAX_SAFE_INTEGER) || a.serial.localeCompare(b.serial)),
    [cartons],
  );

  if (!cartons || !container) return error ? <Text style={styles.error}>{error}</Text> : <Loading />;

  const total = cartons.length;
  const loaded = cartons.filter((c) => LOADED.has(c.status)).length;
  const remaining = ordered.filter((c) => !LOADED.has(c.status));
  const next = remaining.find((c) => c.status !== 'HOLD') ?? remaining[0];
  const after = remaining.filter((c) => c !== next).slice(0, 3);
  // fill shown = planned volume fill × share of cartons already loaded
  const fillPct = total ? (container.fillVolumePct || 100) * (loaded / total) : 0;
  const closed = container.status === 'CLOSED';
  const allLoaded = total > 0 && loaded === total;

  const onScan = async (code: string) => {
    if (closed) {
      show({ kind: 'danger', title: 'ตู้นี้ปิดแล้ว', detail: code });
      return;
    }
    const hit = cartons.find((c) => c.serial === code);
    const out = await submit('LOAD', code, { containerId: id });
    if (out.status === 'queued' || out.result.ok) {
      markLocal(code, 'LOADED');
      // out-of-sequence load is allowed, but tell the loader the planned order was skipped
      if (out.status === 'done' && !out.result.duplicate && hit && next && hit.serial !== next.serial && !LOADED.has(hit.status)) {
        show({ kind: 'warn', title: `✓ ขึ้นตู้แล้ว (ข้ามลำดับ)`, detail: `แผนถัดไปคือ ${next.serial} · ${next.loadLabel ?? ''}` });
      }
    }
  };

  const onClose = async (seal: string) => {
    if (q.pending > 0) {
      show({ kind: 'warn', title: `ยังมีสแกนรอส่ง ${q.pending} รายการ`, detail: 'รอให้ส่งครบก่อนปิดตู้' });
      setSealOpen(false);
      return;
    }
    const res = await api.closeContainer(id, seal);
    setSealOpen(false);
    if (res.ok) {
      show({ kind: 'success', title: `✓ ${res.message}`, detail: `${container.code} · ซีล ${seal}` });
      await reload();
      setTimeout(() => router.back(), 1200);
    } else {
      show({ kind: 'danger', title: res.message });
    }
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: `โหลด · ${container.code}` }} />
      <ScanBanner state={banner} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.gap}>
          <View style={styles.rowBetween}>
            <Text style={styles.h2}>
              {container.code} · {container.type}
            </Text>
            <Pill label={closed ? `ปิดแล้ว · ${container.sealNo ?? ''}` : container.dock ?? 'ไม่ระบุ dock'} tone={closed ? 'success' : 'info'} />
          </View>
          <TruckFill pct={fillPct} label={container.code} />
          <View style={styles.rowBetween}>
            <Text style={styles.big}>
              {loaded}/{total}
            </Text>
            <Text style={styles.muted}>กล่อง · {Math.round(cartons.filter((c) => LOADED.has(c.status)).reduce((s, c) => s + c.grossKg, 0))} kg</Text>
          </View>
          <ProgressBar value={loaded} max={total} />
        </Card>

        {!closed && next ? (
          <Card style={[styles.gap, styles.nextCard]}>
            <Text style={styles.caption}>กล่องถัดไป #{next.loadSeq ?? '—'}</Text>
            <Text style={styles.nextSerial}>{next.serial}</Text>
            <Text style={styles.placement} adjustsFontSizeToFit numberOfLines={1}>
              {next.loadLabel ?? 'ไม่มีตำแหน่งแนะนำ'}
            </Text>
            <Text style={styles.muted}>
              {next.style} · ไซซ์ {next.size} · {next.cartonCode} · PO {next.poNo}
            </Text>
            {next.status === 'HOLD' ? <Pill label="Hold — แจ้งหัวหน้า" tone="danger" /> : null}
            {after.length ? <Text style={styles.muted}>ต่อไป: {after.map((a) => a.serial).join(' · ')}</Text> : null}
          </Card>
        ) : null}

        {!closed ? <ScannerInput onScan={onScan} paused={sealOpen} placeholder="สแกน / พิมพ์ serial กล่อง" /> : null}

        {!closed ? (
          <Button
            label={allLoaded ? 'ปิดตู้ + ใส่เลขซีล' : `ปิดตู้ (เหลือ ${total - loaded} กล่อง)`}
            variant={allLoaded ? 'primary' : 'secondary'}
            disabled={!allLoaded}
            onPress={() => setSealOpen(true)}
          />
        ) : null}
      </ScrollView>
      <SealDialog visible={sealOpen} containerCode={container.code} onCancel={() => setSealOpen(false)} onConfirm={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  gap: { gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  h2: { fontSize: 20, fontWeight: '800', color: colors.text },
  big: { fontSize: 32, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  muted: { fontSize: 15, color: colors.muted },
  caption: { fontSize: 15, color: colors.muted, fontWeight: '600' },
  nextCard: { borderColor: colors.primary, borderWidth: 2 },
  nextSerial: { fontSize: 30, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  placement: { fontSize: 36, fontWeight: '800', color: colors.primary },
  error: { margin: 16, color: colors.danger },
});
