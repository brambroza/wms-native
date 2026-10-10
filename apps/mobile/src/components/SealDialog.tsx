import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, touch } from '../theme';
import { Button } from './ui';

export function SealDialog({ visible, containerCode, onCancel, onConfirm }: { visible: boolean; containerCode: string; onCancel: () => void; onConfirm: (seal: string) => Promise<void> }) {
  const [seal, setSeal] = useState('');
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm(seal.trim().toUpperCase());
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>ปิดตู้ {containerCode}</Text>
          <Text style={styles.label}>เลขซีล (Seal No.)</Text>
          <TextInput value={seal} onChangeText={setSeal} autoFocus autoCapitalize="characters" autoCorrect={false} placeholder="สแกนหรือพิมพ์เลขซีล" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={() => seal.trim() && confirm()} />
          <Button label="ยืนยันปิดตู้" onPress={confirm} disabled={!seal.trim()} busy={busy} />
          <Button label="ยกเลิก" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(27,36,48,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  label: { fontSize: 15, color: colors.secondary, fontWeight: '600' },
  input: { minHeight: touch, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, fontSize: 22, fontWeight: '700', color: colors.text },
});
