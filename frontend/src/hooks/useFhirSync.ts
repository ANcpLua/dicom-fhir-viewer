import { useCallback, useState } from "react";
import { triggerFhirSync } from "../lib/api.js";

export interface UseFhirSyncState {
  readonly syncing: boolean;
  readonly message: string | null;
  readonly sync: () => Promise<void>;
}

export function useFhirSync(onSynced?: () => void): UseFhirSyncState {
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const result = await triggerFhirSync();
      setMessage(`Synced ${result.syncedStudies} study / ${result.syncedPatients} patient(s).`);
      onSynced?.();
    } catch (err) {
      setMessage(err instanceof Error ? `Sync failed: ${err.message}` : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }, [onSynced]);

  return { syncing, message, sync };
}
