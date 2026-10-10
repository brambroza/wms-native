import { Redirect, Stack } from 'expo-router';
import { QueueBadge } from '../../src/components/QueueBadge';
import { Loading } from '../../src/components/ui';
import { useSession } from '../../src/lib/session';
import { colors } from '../../src/theme';

export default function AppLayout() {
  const { ready, session } = useSession();
  if (!ready) return <Loading />;
  if (!session) return <Redirect href="/login" />;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontSize: 20, fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.ground },
        headerRight: () => <QueueBadge />,
      }}
    >
      <Stack.Screen name="home" options={{ title: 'งานของฉัน' }} />
      <Stack.Screen name="pick/index" options={{ title: 'หยิบ · เลือกตู้' }} />
      <Stack.Screen name="pick/[id]" options={{ title: 'หยิบกล่อง' }} />
      <Stack.Screen name="load/index" options={{ title: 'โหลดตู้ · เลือกตู้' }} />
      <Stack.Screen name="load/[id]" options={{ title: 'โหลดตู้' }} />
      <Stack.Screen name="receive" options={{ title: 'รับเข้า' }} />
      <Stack.Screen name="putaway" options={{ title: 'วางของ' }} />
      <Stack.Screen name="queue" options={{ title: 'คิวรอส่ง' }} />
    </Stack>
  );
}
