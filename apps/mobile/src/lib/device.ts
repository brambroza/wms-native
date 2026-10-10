import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const KEY = 'fgdock.deviceId';
let cached: string | null = null;

/** Stable per-install device id, sent with every scan (p_device_id). */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  let id: string | null = null;
  try {
    id = await AsyncStorage.getItem(KEY);
  } catch {
    id = null;
  }
  if (!id) {
    id = `HH-${randomUUID().slice(0, 8).toUpperCase()}`;
    try {
      await AsyncStorage.setItem(KEY, id);
    } catch {
      // storage unavailable: keep the in-memory id for this session
    }
  }
  cached = id;
  return id;
}
