'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DemoApi } from './demo';
import { SupabaseApi } from './supabase';
import type { WmsApi } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

interface Ctx {
  api: WmsApi;
  supabase: SupabaseClient | null;
  session: Session | null;
  /** true once we know whether a session exists */
  ready: boolean;
  signOut: () => Promise<void>;
}

const ApiContext = createContext<Ctx | null>(null);

let demoSingleton: DemoApi | null = null;

export function ApiProvider({ children }: { children: React.ReactNode }) {
  const sbRef = useRef<SupabaseClient | null>(null);
  if (supabaseConfigured && !sbRef.current) sbRef.current = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
  const supabase = sbRef.current;

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!supabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [supabase]);

  const api = useMemo<WmsApi>(() => {
    if (supabase) return new SupabaseApi(supabase);
    demoSingleton ??= new DemoApi();
    return demoSingleton;
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, [supabase]);

  return <ApiContext.Provider value={{ api, supabase, session, ready, signOut }}>{children}</ApiContext.Provider>;
}

export function useWms() {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useWms must be used inside <ApiProvider>');
  return ctx;
}

/**
 * Load data through the API and reload whenever realtime says the container (or anything, when id is null) changed.
 */
export function useLive<T>(load: (api: WmsApi) => Promise<T>, deps: unknown[], containerId: string | null | undefined = undefined) {
  const { api, ready, session } = useWms();
  /** undefined = still loading (null is a valid "not found" answer) */
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  const allowed = ready && (api.mode === 'demo' || session !== null);

  useEffect(() => {
    if (!allowed) return;
    let alive = true;
    loadRef
      .current(api)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e: Error) => alive && setError(e.message));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, allowed, tick, ...deps]);

  useEffect(() => {
    if (!allowed || containerId === undefined) return;
    return api.subscribe(containerId, () => setTick((t) => t + 1));
  }, [api, allowed, containerId]);

  return { data, error, reload: () => setTick((t) => t + 1) };
}
