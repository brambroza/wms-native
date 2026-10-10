import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, touch } from '../theme';

/**
 * One scan entry point, three sources — all feed `onScan(code)`:
 *  1. Hardware scanner in keyboard-wedge mode (Zebra DataWedge / Honeywell): a hidden,
 *     always-focused TextInput with the soft keyboard suppressed; a scan ends with Enter.
 *  2. Camera (expo-camera CameraView) — toggled by a button.
 *  3. Manual entry field — fallback when a label is damaged.
 */
export function ScannerInput({
  onScan,
  placeholder = 'พิมพ์ serial / รหัสตำแหน่ง',
  paused = false,
}: {
  onScan: (code: string) => void;
  placeholder?: string;
  /** stop capturing (e.g. while a dialog with its own input is open) */
  paused?: boolean;
}) {
  const screenFocused = useIsFocused();
  const active = screenFocused && !paused;
  const wedgeRef = useRef<TextInput>(null);
  const [wedgeText, setWedgeText] = useState('');
  const [manual, setManual] = useState('');
  const [manualFocused, setManualFocused] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const emit = useCallback(
    (raw: string, source: 'wedge' | 'camera' | 'manual') => {
      const code = raw.replace(/[\r\n\t]/g, '').trim();
      if (!code) return;
      const now = Date.now();
      // camera fires many frames per barcode; ignore repeats for 2 s
      if (source === 'camera' && code === last.current.code && now - last.current.at < 2000) return;
      last.current = { code, at: now };
      onScan(code);
    },
    [onScan],
  );

  // keep the wedge input focused while this screen is active
  useEffect(() => {
    if (!active || manualFocused) return;
    const focus = () => {
      if (wedgeRef.current && !wedgeRef.current.isFocused()) wedgeRef.current.focus();
    };
    focus();
    const t = setInterval(focus, 600);
    return () => clearInterval(t);
  }, [active, manualFocused]);

  const onWedgeChange = (text: string) => {
    // some scanners send the suffix as a newline character inside the text
    if (/[\r\n]/.test(text)) {
      text
        .split(/[\r\n]+/)
        .filter(Boolean)
        .forEach((part) => emit(part, 'wedge'));
      setWedgeText('');
    } else {
      setWedgeText(text);
    }
  };

  const toggleCamera = async () => {
    if (cameraOn) {
      setCameraOn(false);
      return;
    }
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    setCameraOn(true);
  };

  const submitManual = () => {
    emit(manual, 'manual');
    setManual('');
  };

  const onBarcode = (r: BarcodeScanningResult) => emit(r.data, 'camera');

  return (
    <View style={styles.wrap}>
      {/* 1. hardware keyboard-wedge capture */}
      <TextInput
        ref={wedgeRef}
        value={wedgeText}
        onChangeText={onWedgeChange}
        onSubmitEditing={() => {
          emit(wedgeText, 'wedge');
          setWedgeText('');
        }}
        showSoftInputOnFocus={false}
        autoFocus={active}
        autoCapitalize="characters"
        autoCorrect={false}
        submitBehavior="submit"
        caretHidden
        editable={active}
        importantForAutofill="no"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.hidden}
      />

      {cameraOn && active ? (
        <View style={styles.cameraBox}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            active={cameraOn && active}
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'ean13', 'code39'] }}
            onBarcodeScanned={onBarcode}
          />
          <View pointerEvents="none" style={styles.aim} />
        </View>
      ) : null}

      <View style={styles.row}>
        {/* 3. manual entry */}
        <TextInput
          value={manual}
          onChangeText={setManual}
          onFocus={() => setManualFocused(true)}
          onBlur={() => setManualFocused(false)}
          onSubmitEditing={submitManual}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          style={styles.manual}
        />
        <Pressable accessibilityRole="button" onPress={submitManual} style={({ pressed }) => [styles.okBtn, pressed && styles.pressed]}>
          <Text style={styles.okText}>ตกลง</Text>
        </Pressable>
        {/* 2. camera toggle */}
        {Platform.OS !== 'web' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={cameraOn ? 'ปิดกล้อง' : 'สแกนด้วยกล้อง'}
            onPress={toggleCamera}
            style={({ pressed }) => [styles.camBtn, cameraOn && styles.camBtnOn, pressed && styles.pressed]}
          >
            <Text style={[styles.camText, cameraOn && styles.camTextOn]}>{cameraOn ? 'ปิดกล้อง' : 'กล้อง'}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.hint}>{active && !manualFocused ? '● พร้อมรับจากเครื่องสแกน' : '○ เครื่องสแกนหยุดชั่วคราว'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0, left: -10, top: -10 },
  row: { flexDirection: 'row', gap: 8 },
  manual: {
    flex: 1,
    minHeight: touch,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 18,
    color: colors.text,
  },
  okBtn: { minHeight: touch, minWidth: 72, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  okText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  camBtn: { minHeight: touch, minWidth: 80, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  camBtnOn: { backgroundColor: colors.text, borderColor: colors.text },
  camText: { color: colors.link, fontSize: 16, fontWeight: '700' },
  camTextOn: { color: '#FFFFFF' },
  pressed: { opacity: 0.85 },
  cameraBox: { height: 220, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  aim: { position: 'absolute', left: '12%', right: '12%', top: '38%', height: '24%', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 8 },
  hint: { fontSize: 13, color: colors.muted },
});
