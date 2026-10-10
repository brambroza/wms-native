import { StyleSheet, Text, View } from 'react-native';
import { useQueueSnapshot } from '../lib/session';
import { colors } from '../theme';

/** "รอส่ง N" + online state, shown in every header. */
export function QueueBadge() {
  const q = useQueueSnapshot();
  const offline = !q.online;
  const tone = q.pending > 0 ? { bg: colors.warnSoft, fg: colors.warn } : offline ? { bg: colors.dangerSoft, fg: colors.danger } : { bg: colors.successSoft, fg: colors.success };
  const label = q.pending > 0 ? `รอส่ง ${q.pending}` : offline ? 'ออฟไลน์' : 'ออนไลน์';
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]} accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: offline ? colors.danger : colors.success }]} />
      <Text style={[styles.text, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 14, fontWeight: '700' },
});
