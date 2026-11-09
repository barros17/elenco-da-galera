export const DRAFT_TTL = 12 * 60 * 60 * 1000;

type DraftEnvelope<T> = { savedAt: number; value: T };

export function draftKey(userId: string, sectionId: string, context: string): string {
  return `draft:v1:${userId}:${sectionId}:${context}`;
}

const sessionStore = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

export function saveDraft<T>(
  key: string,
  value: T,
  storage: Storage | undefined = sessionStore(),
): void {
  try {
    storage?.setItem(
      key,
      JSON.stringify({ savedAt: Date.now(), value } satisfies DraftEnvelope<T>),
    );
  } catch {
    // Drafts are best-effort.
  }
}

export function loadDraft<T>(
  key: string,
  now = Date.now(),
  storage: Storage | undefined = sessionStore(),
): T | null {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as DraftEnvelope<T>;
    if (!envelope.savedAt || now - envelope.savedAt > DRAFT_TTL) {
      storage?.removeItem(key);
      return null;
    }
    return envelope.value;
  } catch {
    return null;
  }
}

export function clearDraft(key: string, storage: Storage | undefined = sessionStore()): void {
  try {
    storage?.removeItem(key);
  } catch {
    // Best-effort cleanup.
  }
}

export function clearUserDrafts(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(`draft:v1:${userId}:`)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Best-effort cleanup.
  }
}
