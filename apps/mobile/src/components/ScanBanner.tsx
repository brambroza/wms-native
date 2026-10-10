import { StyleSheet, View } from 'react-native';
import { Text } from './AppText';
import { colors } from '../theme';

export type BannerKind = 'success' | 'danger' | 'warn' | 'info';

export interface BannerState {
  kind: BannerKind;
  title: string;
  detail?: string;
}

const palette: Record<BannerKind, { bg: string; fg: string }> = {
  success: { bg: colors.success, fg: '#FFFFFF' },
  danger: { bg: colors.danger, fg: '#FFFFFF' },
  warn: { bg: colors.warnSoft, fg: colors.warn },
  info: { bg: colors.primarySoft, fg: colors.link },
};

/** Full-width result banner — readable at arm's length on a handheld. */
export function ScanBanner({ state }: { state: BannerState | null }) {
  if (!state) return null;
  const p = palette[state.kind];
  return (
    <View accessibilityLiveRegion="assertive" style={[styles.banner, { backgroundColor: p.bg }]}>
      <Text style={[styles.title, { color: p.fg }]}>{state.title}</Text>
      {state.detail ? <Text style={[styles.detail, { color: p.fg }]}>{state.detail}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingHorizontal: 16, paddingVertical: 14, minHeight: 64, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800' },
  detail: { fontSize: 15, marginTop: 2, fontWeight: '500' },
});
