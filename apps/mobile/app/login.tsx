import { Redirect } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Loading } from '../src/components/ui';
import { useSession } from '../src/lib/session';
import { supabaseConfigured } from '../src/lib/supabase';
import { colors, touch } from '../src/theme';

export default function Login() {
  const { ready, session, deviceId, signIn, startDemo } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <Loading />;
  if (session) return <Redirect href="/home" />;

  const onLogin = async () => {
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    setBusy(false);
    if (err) setError(err);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>FG</Text>
            </View>
            <Text style={styles.title}>FG Dock Staff</Text>
            <Text style={styles.sub}>หยิบ · โหลดตู้ · รับเข้า · วางของ</Text>
          </View>

          <Card style={styles.card}>
            {supabaseConfigured ? (
              <>
                <Text style={styles.label}>อีเมล</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  placeholder="name@company.co.th"
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                />
                <Text style={styles.label}>รหัสผ่าน</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  onSubmitEditing={onLogin}
                  style={styles.input}
                />
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <Button label="เข้าสู่ระบบ" onPress={onLogin} busy={busy} disabled={!email || !password} />
              </>
            ) : (
              <Text style={styles.notice}>
                ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (EXPO_PUBLIC_SUPABASE_URL) — ใช้โหมดทดลองเพื่อฝึกการสแกนด้วยข้อมูลตัวอย่าง
              </Text>
            )}
            <Button label="โหมดทดลอง (ไม่ต่อเซิร์ฟเวอร์)" variant="secondary" onPress={startDemo} />
          </Card>
          <Text style={styles.device}>เครื่อง {deviceId}</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ground },
  scroll: { padding: 20, gap: 20, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 6 },
  logo: { width: 64, height: 64, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontSize: 26, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '800', color: colors.text },
  sub: { fontSize: 16, color: colors.muted },
  card: { gap: 12 },
  label: { fontSize: 15, fontWeight: '600', color: colors.secondary },
  input: {
    minHeight: touch,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.card,
  },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 10, borderRadius: 10, fontSize: 15 },
  notice: { color: colors.warn, backgroundColor: colors.warnSoft, padding: 12, borderRadius: 10, fontSize: 15, lineHeight: 22 },
  device: { textAlign: 'center', color: colors.muted, fontSize: 13 },
});
