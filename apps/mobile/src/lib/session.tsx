import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createApi, type ApiMode, type WmsApi } from './api';
import { resetDemo } from './demoApi';
import { getDeviceId } from './device';
import { ScanQueue, type QueueSnapshot } from './scanQueue';
import { supabase } from './supabase';

interface Session {
  mode: ApiMode;
  userLabel: string;
  api: WmsApi;
  queue: ScanQueue;
}

interface SessionContextValue {
  ready: boolean;
  deviceId: string;
  session: Session | null;
  signIn(email: string, password: string): Promise<string | null>;
  startDemo(): Promise<void>;
  signOut(): Promise<void>;
}

const Ctx = createContext<SessionContextValue | null>(null);
const MODE_KEY = 'fgdock.mode';

function open(mode: ApiMode, userLabel: string, deviceId: string): Session {
  const api = createApi(mode);
  // separate queues so demo scans never reach the real server
  const queue = new ScanQueue(api, deviceId, `fgdock.queue.${mode}`);
  queue.start();
  return { mode, userLabel, api, queue };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = await getDeviceId();
      let restored: Session | null = null;
      let savedMode: string | null = null;
      try {
        savedMode = await AsyncStorage.getItem(MODE_KEY);
      } catch {
        savedMode = null;
      }
      if (savedMode === 'demo') {
        restored = open('demo', 'ผู้ใช้ทดลอง', id);
      } else if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session) restored = open('supabase', data.session.user.email ?? 'staff', id);
      }
      if (!alive) {
        restored?.queue.stop();
        return;
      }
      setDeviceId(id);
      setSession(restored);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!supabase) return 'ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์ (EXPO_PUBLIC_SUPABASE_URL)';
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) return error.message === 'Invalid login credentials' ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : error.message;
      await AsyncStorage.setItem(MODE_KEY, 'supabase').catch(() => undefined);
      setSession(open('supabase', data.user?.email ?? email, deviceId));
      return null;
    },
    [deviceId],
  );

  const startDemo = useCallback(async () => {
    await AsyncStorage.setItem(MODE_KEY, 'demo').catch(() => undefined);
    setSession(open('demo', 'ผู้ใช้ทดลอง', deviceId));
  }, [deviceId]);

  const signOut = useCallback(async () => {
    session?.queue.stop();
    if (session?.mode === 'supabase' && supabase) await supabase.auth.signOut();
    if (session?.mode === 'demo') resetDemo();
    await AsyncStorage.removeItem(MODE_KEY).catch(() => undefined);
    setSession(null);
  }, [session]);

  const value = useMemo(() => ({ ready, deviceId, session, signIn, startDemo, signOut }), [ready, deviceId, session, signIn, startDemo, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}

/** Session for screens inside the signed-in (app) group. */
export function useAuthed(): Session {
  const { session } = useSession();
  if (!session) throw new Error('not signed in');
  return session;
}

export function useQueueSnapshot(): QueueSnapshot {
  const { queue } = useAuthed();
  const [snap, setSnap] = useState<QueueSnapshot>(() => queue.snapshot());
  useEffect(() => queue.subscribe(setSnap), [queue]);
  return snap;
}
