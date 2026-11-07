import { describe, expect, it } from "vitest";
import { eventActions, shouldShowEvent } from "./event-management";

describe("controles de jogos", () => {
  it("não mostra controles para membro comum", () =>
    expect(eventActions(false, "scheduled")).toEqual([]));
  it("mostra edição e cancelamento para admin em jogo agendado", () => {
    expect(eventActions(true, "scheduled")).toEqual(["edit", "cancel", "delete"]);
  });
  it("troca edição por reativação em jogo cancelado", () => {
    expect(eventActions(true, "canceled")).toEqual(["reactivate", "delete"]);
  });
  it("filtra cancelados para membros, mas não para admins", () => {
    expect(shouldShowEvent("canceled", false)).toBe(false);
    expect(shouldShowEvent("canceled", true)).toBe(true);
    expect(shouldShowEvent("scheduled", false)).toBe(true);
  });
});
