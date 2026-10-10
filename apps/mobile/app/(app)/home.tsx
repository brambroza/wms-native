import { useRouter, type Href } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ContainerCard } from '../../src/components/ContainerCard';
import { Button } from '../../src/components/ui';
import { useContainers } from '../../src/hooks/useContainers';
import { useQueueSnapshot, useSession } from '../../src/lib/session';
import { colors, radius } from '../../src/theme';

const TASKS: { label: string; hint: string; href: Href; bg: string; fg: string }[] = [
  { label: 'หยิบ', hint: 'Pick ตามตู้', href: '/pick', bg: colors.primary, fg: '#FFFFFF' },
  { label: 'โหลดตู้', hint: 'Load ขึ้นตู้', href: '/load', bg: colors.text, fg: '#FFFFFF' },
  { label: 'รับเข้า', hint: 'Receive จากสาขา', href: '/receive', bg: colors.card, fg: colors.link },
  { label: 'วางของ', hint: 'Putaway เข้าชั้น', href: '/putaway', bg: colors.card, fg: colors.link },
];

export default function Home() {
  const router = useRouter();
  const { session, deviceId, signOut } = useSession();
  const q = useQueueSnapshot();
  const { items, error, refreshing, reload } = useContainers();
  const open = (items ?? []).filter((c) => c.status !== 'CLOSED');

  return (
    <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} />}>
      {session?.mode === 'demo' ? (
        <View style={styles.demo}>
          <Text style={styles.demoText}>โหมดทดลอง · ข้อมูลตัวอย่าง ไม่ส่งเข้าเซิร์ฟเวอร์</Text>
        </View>
      ) : null}

      <View style={styles.grid}>
        {TASKS.map((t) => (
          <Pressable
            key={t.label}
            accessibilityRole="button"
            onPress={() => router.push(t.href)}
            style={({ pressed }) => [styles.tile, { backgroundColor: t.bg, borderColor: t.bg === colors.card ? colors.border : t.bg }, pressed && { opacity: 0.85 }]}
          >
            <Text style={[styles.tileLabel, { color: t.fg }]}>{t.label}</Text>
            <Text style={[styles.tileHint, { color: t.fg, opacity: 0.8 }]}>{t.hint}</Text>
          </Pressable>
        ))}
      </View>

      {q.pending > 0 || q.rejected.length > 0 ? (
        <Pressable onPress={() => router.push('/queue')} style={styles.queueCard}>
          <Text style={styles.queueText}>
            รอส่ง {q.pending} รายการ{q.rejected.length ? ` · ถูกปฏิเสธ ${q.rejected.length}` : ''} — แตะเพื่อดู
          </Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>ตู้ที่เปิดอยู่</Text>
      {error ? <Text style={styles.error}>โหลดรายการตู้ไม่ได้: {error}</Text> : null}
      {items === null && !error ? <Text style={styles.muted}>กำลังโหลด…</Text> : null}
      {open.map((c) => (
        <ContainerCard key={c.id} c={c} onPress={() => router.push({ pathname: c.status === 'PLANNED' || c.status === 'PICKING' ? '/pick/[id]' : '/load/[id]', params: { id: c.id } })} />
      ))}
      {items && open.length === 0 ? <Text style={styles.muted}>ไม่มีตู้ที่ต้องทำ</Text> : null}

      <View style={styles.footer}>
        <Text style={styles.muted}>
          {session?.userLabel} · เครื่อง {deviceId}
        </Text>
        <Button label="ออกจากระบบ" variant="secondary" onPress={signOut} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 12 },
  demo: { backgroundColor: colors.aiSoft, borderRadius: 10, padding: 10 },
  demoText: { color: colors.ai, fontWeight: '600', fontSize: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '47%', flexGrow: 1, minHeight: 112, borderRadius: radius, borderWidth: 1, padding: 16, justifyContent: 'flex-end' },
  tileLabel: { fontSize: 28, fontWeight: '800' },
  tileHint: { fontSize: 14, marginTop: 2 },
  queueCard: { backgroundColor: colors.warnSoft, borderRadius: 12, padding: 14, minHeight: 56, justifyContent: 'center' },
  queueText: { color: colors.warn, fontSize: 16, fontWeight: '700' },
  section: { fontSize: 17, fontWeight: '700', color: colors.secondary, marginTop: 8 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: 10 },
  muted: { color: colors.muted, fontSize: 14 },
  footer: { marginTop: 16, gap: 10 },
});
