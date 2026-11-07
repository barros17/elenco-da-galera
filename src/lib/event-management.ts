import type { FootballEvent } from "./events";

export type EventAction = "edit" | "cancel" | "reactivate" | "delete";

export function eventActions(isAdmin: boolean, status: FootballEvent["status"]): EventAction[] {
  if (!isAdmin) return [];
  return status === "canceled" ? ["reactivate", "delete"] : ["edit", "cancel", "delete"];
}

export function canRespondOrDraw(event: FootballEvent | null): boolean {
  return event?.status === "scheduled";
}

export function shouldShowEvent(status: FootballEvent["status"], isAdmin: boolean): boolean {
  return isAdmin || status === "scheduled";
}
