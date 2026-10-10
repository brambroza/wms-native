import { useRouter } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../components/AppText';
import type { ContainerStatus } from '@wms/shared';
import { ContainerCard } from '../components/ContainerCard';
import { useContainers } from '../hooks/useContainers';
import { colors } from '../theme';

/** Shared "choose a container" list for pick / load. */
export function ContainerPicker({ target, statuses, empty }: { target: '/pick/[id]' | '/load/[id]'; statuses: ContainerStatus[]; empty: string }) {
  const router = useRouter();
  const { items, error, refreshing, reload } = useContainers();
  const list = (items ?? []).filter((c) => statuses.includes(c.status));
  return (
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {list.map((c) => (
        <ContainerCard key={c.id} c={c} onPress={() => router.push({ pathname: target, params: { id: c.id } })} />
      ))}
      {items && list.length === 0 ? <Text style={styles.muted}>{empty}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 12 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: 10 },
  muted: { color: colors.muted, fontSize: 15 },
});
