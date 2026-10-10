import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/AppText';
import type { ScanAction } from '@wms/shared';
import { ScanBanner } from '../components/ScanBanner';
import { ScannerInput } from '../components/ScannerInput';
import { Button, Card } from '../components/ui';
import { useScan } from '../hooks/useScan';
import { colors } from '../theme';

/** Location codes look like C-A04-2, STG-A, DOCK-1, A-R01; carton serials are digits. */
export function looksLikeLocation(code: string): boolean {
  return /[A-Z]/i.test(code) && code.includes('-');
}

interface Recent {
  serial: string;
  location: string;
  ok: boolean | null; // null = queued offline
  message: string;
}

/**
 * Receive / Putaway: scan the carton, then scan the location.
 * Scanning a location first is fine too — it sticks for the following cartons
 * (useful when putting a whole pallet-load into one bay).
 */
export function TwoStepScan({ action, intro }: { action: Extract<ScanAction, 'RECEIVE' | 'PUTAWAY'>; intro: string }) {
  const { banner, submit, show } = useScan();
  const [serial, setSerial] = useState<string | null>(null);
  const [stickyLoc, setStickyLoc] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);

  const send = async (s: string, loc: string) => {
    const out = await submit(action, s, { locationCode: loc });
    setRecent((r) =>
      [{ serial: s, location: loc, ok: out.status === 'queued' ? null : out.result.ok, message: out.status === 'queued' ? 'รอส่ง' : out.result.message }, ...r].slice(0, 12),
    );
    setSerial(null);
  };

  const onScan = async (raw: string) => {
    const code = raw.toUpperCase();
    if (looksLikeLocation(code)) {
      if (serial) {
        await send(serial, code);
      } else {
        setStickyLoc(code);
        show({ kind: 'info', title: `ตำแหน่ง ${code}`, detail: 'สแกนกล่องต่อได้เลย — จะวางที่ตำแหน่งนี้' });
      }
      return;
    }
    if (stickyLoc) {
      await send(code, stickyLoc);
      return;
    }
    setSerial(code);
    show({ kind: 'info', title: `กล่อง ${code}`, detail: 'สแกนตำแหน่งต่อ' });
  };

  const step = serial ? 2 : 1;

  return (
    <View style={styles.flex}>
      <ScanBanner state={banner} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{intro}</Text>
        <View style={styles.steps}>
          <Card style={[styles.step, step === 1 && styles.stepActive]}>
            <Text style={styles.stepNo}>1 · กล่อง</Text>
            <Text style={styles.stepValue} numberOfLines={1} adjustsFontSizeToFit>
              {serial ?? '—'}
            </Text>
          </Card>
          <Card style={[styles.step, step === 2 && styles.stepActive]}>
            <Text style={styles.stepNo}>2 · ตำแหน่ง</Text>
            <Text style={styles.stepValue} numberOfLines={1} adjustsFontSizeToFit>
              {stickyLoc ?? '—'}
            </Text>
          </Card>
        </View>
        <Text style={styles.prompt}>{serial ? 'สแกนตำแหน่ง' : stickyLoc ? `สแกนกล่อง → วางที่ ${stickyLoc}` : 'สแกนกล่อง หรือ สแกนตำแหน่งก่อน'}</Text>
        <ScannerInput onScan={onScan} placeholder={serial ? 'รหัสตำแหน่ง เช่น C-A04-2' : 'serial กล่อง หรือ รหัสตำแหน่ง'} />
        {serial || stickyLoc ? (
          <Button
            label={stickyLoc && !serial ? `เลิกใช้ตำแหน่ง ${stickyLoc}` : 'ยกเลิกกล่องนี้'}
            variant="secondary"
            onPress={() => {
              if (serial) setSerial(null);
              else setStickyLoc(null);
            }}
          />
        ) : null}

        {recent.length ? <Text style={styles.section}>ล่าสุด</Text> : null}
        {recent.map((r, i) => (
          <View key={`${r.serial}-${i}`} style={styles.recent}>
            <Text style={[styles.dot, { color: r.ok === null ? colors.warn : r.ok ? colors.success : colors.danger }]}>●</Text>
            <Text style={styles.recentSerial}>{r.serial}</Text>
            <Text style={styles.recentLoc}>{r.location}</Text>
            <Text style={styles.recentMsg} numberOfLines={1}>
              {r.message}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  intro: { fontSize: 15, color: colors.muted },
  steps: { flexDirection: 'row', gap: 10 },
  step: { flex: 1, gap: 4 },
  stepActive: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  stepNo: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  stepValue: { fontSize: 36, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  prompt: { fontSize: 20, fontWeight: '700', color: colors.secondary },
  section: { fontSize: 16, fontWeight: '700', color: colors.secondary, marginTop: 8 },
  recent: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, minHeight: 52 },
  dot: { fontSize: 14 },
  recentSerial: { fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  recentLoc: { fontSize: 15, color: colors.link, fontWeight: '600' },
  recentMsg: { flex: 1, fontSize: 14, color: colors.muted, textAlign: 'right' },
});
