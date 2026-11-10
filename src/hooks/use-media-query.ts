import { useCallback, useSyncExternalStore } from "react";

/**
 * Retorna true enquanto a media query estiver ativa.
 * SSR-safe: default false até o efeito executar no cliente.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (typeof window === "undefined") return () => undefined;
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    [query],
  );
  const getSnapshot = useCallback(
    () => (typeof window === "undefined" ? false : window.matchMedia(query).matches),
    [query],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
