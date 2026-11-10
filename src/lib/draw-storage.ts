import type { DrawResult } from "@/lib/team-balancer";
import type { Player } from "@/lib/players";

export type PersistedDraw<TLayout> = {
  signature: string;
  result: DrawResult;
  names: string[];
  layout: TLayout;
};

export function shouldPersistDraw<TLayout>(
  draw: PersistedDraw<TLayout> | null,
  signature: string,
): draw is PersistedDraw<TLayout> {
  return draw !== null && draw.signature === signature;
}

export function confirmedSignature(players: Pick<Player, "id">[]): string {
  return players
    .map((player) => player.id)
    .sort()
    .join(",");
}

export function drawStorageKey(eventId: string): string {
  return `draw:v1:${eventId}`;
}

export function saveDraw<TLayout>(
  eventId: string,
  draw: PersistedDraw<TLayout>,
  storage: Storage | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(drawStorageKey(eventId), JSON.stringify(draw));
  } catch {
    /* best-effort */
  }
}

export function loadDraw<TLayout>(
  eventId: string,
  signature: string,
  storage: Storage | undefined = globalThis.localStorage,
): PersistedDraw<TLayout> | null {
  try {
    const raw = storage?.getItem(drawStorageKey(eventId));
    if (!raw) return null;
    const draw = JSON.parse(raw) as PersistedDraw<TLayout>;
    return shouldPersistDraw(draw, signature) ? draw : null;
  } catch {
    return null;
  }
}

export function clearDraws(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    for (let index = storage?.length ?? 0; index > 0; index -= 1) {
      const key = storage?.key(index - 1);
      if (key?.startsWith("draw:v1:")) storage?.removeItem(key);
    }
  } catch {
    /* best-effort */
  }
}
