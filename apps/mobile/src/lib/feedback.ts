import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Vibrate on scan result. Silently ignored where haptics are not available (web, some handhelds). */
export function scanFeedback(kind: 'success' | 'warn' | 'error'): void {
  if (Platform.OS === 'web') return;
  const type =
    kind === 'success'
      ? Haptics.NotificationFeedbackType.Success
      : kind === 'warn'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error;
  Haptics.notificationAsync(type).catch(() => undefined);
}
