import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { StaffContainer } from '../lib/types';
import { useAuthed } from '../lib/session';

/** Containers list, reloaded every time the screen gains focus. */
export function useContainers() {
  const { api } = useAuthed();
  const [items, setItems] = useState<StaffContainer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setItems(await api.listContainers());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return { items, error, refreshing, reload: load };
}
