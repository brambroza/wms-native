import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Text } from '../../../src/components/AppText';
import { ScanBanner } from '../../../src/components/ScanBanner';
import { ScannerInput } from '../../../src/components/ScannerInput';
import { Loading, ProgressBar } from '../../../src/components/ui';
import { useContainerCartons } from '../../../src/hooks/useContainerCartons';
import { useScan } from '../../../src/hooks/useScan';
import type { StaffCarton } from '../../../src/lib/types';
import { colors } from '../../../src/theme';

const DONE = new Set(['PICKED', 'STAGED', 'LOADED', 'SHIPPED']);
/** Cartons picked in this session lose their location, so remember where they were. */
type Row = StaffCarton & { fromLocation: string };

export default function PickScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { container, cartons, error, markLocal } = useContainerCartons(id);
  const { banner, submit, show } = useScan();
  const [origin] = useState(() => new Map<string, string>());

  const sections = useMemo(() => {
    if (!cartons) return [];
    const rows: Row[] = cartons.map((c) => {
      if (c.locationCode && !origin.has(c.serial)) origin.set(c.serial, c.locationCode);
      return { ...c, fromLocation: c.locationCode ?? origin.get(c.serial) ?? '—' };
    });
    const groups = new Map<string, Row[]>();
    rows.forEach((r) => groups.set(r.fromLocation, [...(groups.get(r.fromLocation) ?? []), r]));
    return [...groups.entries()]
      .sort(([a], [b]) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)))
      .map(([loc, data]) => ({
        title: loc,
        left: data.filter((d) => !DONE.has(d.status)).length,
        data: data.sort((a, b) => Number(DONE.has(a.status)) - Number(DONE.has(b.status)) || a.serial.localeCompare(b.serial)),
      }));
  }, [cartons, origin]);

  if (!cartons) return error ? <Text style={styles.error}>{error}</Text> : <Loading />;

  const total = cartons.length;
  const done = cartons.filter((c) => DONE.has(c.status)).length;
  const current = sections.find((s) => s.left > 0 && s.title !== '—');

  const onScan = async (code: string) => {
    const hit = cartons.find((c) => c.serial === code);
    if (hit && DONE.has(hit.status)) {
      show({ kind: 'warn', title: 'หยิบไปแล้ว', detail: `${code} · ${hit.status}` });
      return;
    }
    const out = await submit('PICK', code, { containerId: id });
    if (out.status === 'queued' || out.result.ok) markLocal(code, 'PICKED');
  };

  return (
    <View style={styles.flex}>
      <Stack.Screen options={{ title: container ? `หยิบ · ${container.code}` : 'หยิบกล่อง' }} />
      <ScanBanner state={banner} />
      <View style={styles.head}>
        <Text style={styles.caption}>ไปที่ตำแหน่ง</Text>
        <Text style={styles.location} adjustsFontSizeToFit numberOfLines={1}>
          {current ? current.title : done === total ? 'ครบแล้ว ✓' : 'ไม่ระบุตำแหน่ง'}
        </Text>
        {current ? <Text style={styles.caption}>หยิบ {current.left} กล่องที่ตำแหน่งนี้</Text> : null}
        <View style={styles.progress}>
          <View style={styles.flex}>
            <ProgressBar value={done} max={total} color={colors.success} />
          </View>
          <Text style={styles.count}>
            {done}/{total}
          </Text>
        </View>
        <ScannerInput onScan={onScan} placeholder="สแกน / พิมพ์ serial กล่อง" />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.serial}
        stickySectionHeadersEnabled
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHead}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionMeta}>{section.left ? `เหลือ ${section.left}` : 'ครบ'}</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const ok = DONE.has(item.status);
          return (
            <View style={[styles.row, ok && styles.rowDone]}>
              <View style={[styles.check, ok && styles.checkOn]}>{ok ? <Text style={styles.checkMark}>✓</Text> : null}</View>
              <Text style={[styles.serial, ok && styles.textDone]}>{item.serial}</Text>
              <Text style={styles.cell}>{item.size}</Text>
              <Text style={styles.cell}>{item.cartonCode}</Text>
              {item.status === 'HOLD' ? <Text style={styles.hold}>Hold</Text> : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.border, padding: 16, gap: 8 },
  caption: { fontSize: 15, color: colors.muted },
  location: { fontSize: 44, fontWeight: '800', color: colors.text, letterSpacing: 1, fontVariant: ['tabular-nums'] },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  count: { fontSize: 16, fontWeight: '700', color: colors.secondary, fontVariant: ['tabular-nums'] },
  list: { paddingBottom: 40 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.ground, paddingHorizontal: 16, paddingVertical: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.secondary },
  sectionMeta: { fontSize: 15, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, backgroundColor: colors.card, borderBottomWidth: 1, borderColor: colors.divider },
  rowDone: { backgroundColor: colors.successSoft },
  check: { width: 28, height: 28, borderRadius: 8, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  checkMark: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  serial: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  textDone: { color: colors.success },
  cell: { width: 48, fontSize: 16, color: colors.secondary, textAlign: 'center' },
  hold: { color: colors.danger, fontWeight: '700' },
  error: { margin: 16, color: colors.danger },
});
