import { describe, expect, it } from "vitest";
import { buildFormation } from "./team-formations";
import { missingConfirmedPlayers, minimumConfirmedPlayers, styleTotal } from "./game-style-utils";

describe("estilos de jogo", () => {
  it("usa o snapshot para selecionar os slots", () => {
    expect(
      buildFormation({ hasGoalkeeper: false, defenders: 1, midfielders: 2, attackers: 1 }),
    ).toHaveLength(4);
  });
  it("calcula o mínimo de confirmados", () => expect(minimumConfirmedPlayers(4)).toBe(8));
  it("calcula a mensagem de faltantes", () => expect(missingConfirmedPlayers(4, 5)).toBe(3));
  it("calcula o total incluindo goleiro", () =>
    expect(styleTotal({ has_goalkeeper: true, defenders: 1, midfielders: 2, attackers: 1 })).toBe(
      5,
    ));
});
