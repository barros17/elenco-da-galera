import { describe, expect, it } from "vitest";
import { generateTeams } from "./team-balancer";
import type { Player } from "./players";

function makePlayer(id: string, position: Player["position"], overall: number): Player {
  return {
    id,
    section_id: "section-1",
    user_id: id,
    name: `Jogador ${id}`,
    photo_url: null,
    position,
    skills: {},
    weak_foot: 3,
    overall,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("team balancer", () => {
  it("gera times determinísticos com seed e sem jogadores repetidos", () => {
    const players = [
      makePlayer("p1", "GOL", 80),
      makePlayer("p2", "GOL", 78),
      makePlayer("p3", "ZAG", 76),
      makePlayer("p4", "LAT", 74),
      makePlayer("p5", "VOL", 72),
      makePlayer("p6", "MEI", 71),
      makePlayer("p7", "ATA", 79),
      makePlayer("p8", "ATA", 75),
      makePlayer("p9", "ZAG", 73),
      makePlayer("p10", "MEI", 70),
    ];

    const one = generateTeams(players, 5, { seed: 42 });
    const two = generateTeams(players, 5, { seed: 42 });

    expect(one.teams.map((team) => team.players.map((p) => p.id).sort())).toEqual(
      two.teams.map((team) => team.players.map((p) => p.id).sort()),
    );
    const allIds = one.teams.flatMap((team) => team.players.map((p) => p.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("respeita no máximo um goleiro por time quando há goleiros suficientes", () => {
    const players = [
      makePlayer("g1", "GOL", 82),
      makePlayer("g2", "GOL", 80),
      makePlayer("g3", "GOL", 78),
      makePlayer("g4", "GOL", 76),
      makePlayer("g5", "ZAG", 70),
      makePlayer("g6", "LAT", 69),
      makePlayer("g7", "MEI", 68),
      makePlayer("g8", "ATA", 67),
      makePlayer("g9", "ZAG", 66),
      makePlayer("g10", "VOL", 65),
      makePlayer("g11", "ATA", 64),
      makePlayer("g12", "MEI", 63),
    ];

    const result = generateTeams(players, 6, { seed: 7 });
    for (const team of result.teams) {
      const goalkeepers = team.players.filter((p) => p.position === "GOL");
      expect(goalkeepers.length).toBeLessThanOrEqual(1);
    }
  });
});
