import { CONTAINER_STATUS } from '@wms/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StaffContainer } from '../lib/types';
import { colors, radius } from '../theme';
import { Pill, ProgressBar } from './ui';

export function ContainerCard({ c, onPress }: { c: StaffContainer; onPress?: () => void }) {
  const st = CONTAINER_STATUS[c.status];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
      <View style={styles.top}>
        <Text style={styles.code}>{c.code}</Text>
        <Text style={styles.meta}>
          {c.type}
          {c.dock ? ` · ${c.dock}` : ''}
        </Text>
        <View style={{ flex: 1 }} />
        <Pill label={st.label} tone={st.tone} />
      </View>
      <View style={styles.progressRow}>
        <View style={{ flex: 1 }}>
          <ProgressBar value={c.loadedCartons} max={c.plannedCartons} color={c.status === 'CLOSED' ? colors.success : colors.data} />
        </View>
        <Text style={styles.count}>
          {c.loadedCartons}/{c.plannedCartons}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10, minHeight: 72 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { fontSize: 22, fontWeight: '800', color: colors.text },
  meta: { fontSize: 15, color: colors.muted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count: { fontSize: 15, fontWeight: '700', color: colors.secondary, fontVariant: ['tabular-nums'], minWidth: 64, textAlign: 'right' },
});
