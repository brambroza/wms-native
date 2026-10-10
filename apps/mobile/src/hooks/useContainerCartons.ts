import { useCallback, useEffect, useState } from 'react';
import type { CartonStatus } from '@wms/shared';
import type { StaffCarton, StaffContainer } from '../lib/types';
import { useAuthed } from '../lib/session';

/** Container + its cartons, kept live through realtime changes on the container row. */
export function useContainerCartons(containerId: string) {
  const { api } = useAuthed();
  const [container, setContainer] = useState<StaffContainer | null>(null);
  const [cartons, setCartons] = useState<StaffCarton[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [c, list] = await Promise.all([api.getContainer(containerId), api.listContainerCartons(containerId)]);
      setContainer(c);
      setCartons(list);
      setError(null);
    } catch (e) {
      // keep showing the last known list while offline
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, containerId]);

  useEffect(() => {
    void reload();
    return api.subscribeContainer(containerId, () => void reload());
  }, [api, containerId, reload]);

  /** Optimistic local update after a scan was accepted or queued offline. */
  const markLocal = useCallback((serial: string, status: CartonStatus) => {
    setCartons((prev) => prev?.map((c) => (c.serial === serial ? { ...c, status, locationCode: status === 'PICKED' || status === 'LOADED' ? null : c.locationCode } : c)) ?? prev);
  }, []);

  return { container, cartons, error, reload, markLocal };
}
