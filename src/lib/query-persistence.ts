import { persistQueryClient } from "@tanstack/query-persist-client-core";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const QUERY_CACHE_VERSION = "cache-v1";
export const PERSISTED_QUERY_ROOTS = new Set([
  "section",
  "players",
  "section-events",
  "event-attendance",
  "section-members",
  "game-styles",
  "scheduled-events-by-style",
]);

export function shouldPersistQuery(queryKey: QueryKey): boolean {
  return typeof queryKey[0] === "string" && PERSISTED_QUERY_ROOTS.has(queryKey[0]);
}

export function queryStorageKey(userId: string): string {
  return `elenco-da-galera:query-cache:${userId}`;
}

export function clearPersistedQueryCache(userId: string | null | undefined): void {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.removeItem(queryStorageKey(userId));
  } catch {
    // Quota and privacy-mode failures are intentionally silent.
  }
}

export function persistQueriesForUser(queryClient: QueryClient, userId: string) {
  if (typeof window === "undefined") return () => undefined;
  try {
    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      key: queryStorageKey(userId),
      throttleTime: 1000,
    });
    const [unsubscribe, restored] = persistQueryClient({
      queryClient,
      persister,
      maxAge: 24 * 60 * 60 * 1000,
      buster: QUERY_CACHE_VERSION,
      dehydrateOptions: { shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey) },
    });
    void restored.catch(() => undefined);
    return unsubscribe;
  } catch {
    return () => undefined;
  }
}
