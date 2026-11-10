import { describe, expect, it } from "vitest";
import { shouldPersistDraw, type PersistedDraw } from "./draw-storage";
import type { Player } from "./players";

const player = { id: "p1" } as Player;
const draw: PersistedDraw<null> = {
  signature: "p1",
  result: {
    teams: [
      { name: "A", players: [player] },
      { name: "B", players: [] },
    ],
    reserves: [],
    balance: 100,
    warnings: [],
  },
  names: ["A", "B"],
  layout: null,
};

describe("shouldPersistDraw", () => {
  it("só aceita o sorteio cuja assinatura corresponde aos confirmados atuais", () => {
    expect(shouldPersistDraw(draw, "p1")).toBe(true);
    expect(shouldPersistDraw(draw, "p1,p2")).toBe(false);
    expect(shouldPersistDraw(null, "p1")).toBe(false);
  });
});
