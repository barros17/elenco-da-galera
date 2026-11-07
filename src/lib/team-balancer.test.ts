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

  it("can draw exactly two teams and keep the remaining confirmed players as reserves", () => {
    const players = Array.from({ length: 21 }, (_, index) =>
      makePlayer(`p${index}`, index % 7 === 0 ? "GOL" : "MEI", 70 + (index % 20)),
    );

    const result = generateTeams(players, 7, { seed: 12, teamCount: 2 });

    expect(result.teams).toHaveLength(2);
    expect(result.teams.every((team) => team.players.length === 7)).toBe(true);
    expect(result.reserves).toHaveLength(7);
  });

  it("does not create partial teams when an explicit two-team draw lacks enough players", () => {
    const players = Array.from({ length: 13 }, (_, index) => makePlayer(`p${index}`, "MEI", 70));

    const result = generateTeams(players, 7, { seed: 12, teamCount: 2 });

    expect(result.teams).toHaveLength(0);
    expect(result.reserves).toHaveLength(13);
  });

  it("supports 3x3 draws without goalkeepers", () => {
    const players = Array.from({ length: 12 }, (_, index) =>
      makePlayer(`p${index}`, index % 3 === 0 ? "GOL" : index % 2 === 0 ? "ZAG" : "ATA", 70),
    );

    const result = generateTeams(players, 3, { seed: 7, hasGoalkeeper: false, teamCount: 2 });

    expect(result.teams).toHaveLength(2);
    expect(result.teams.every((team) => team.players.length === 3)).toBe(true);
  });

  it("supports 4x4 draws without goalkeepers and keeps goalkeepers as field players", () => {
    const players = Array.from({ length: 16 }, (_, index) =>
      makePlayer(`p${index}`, index % 4 === 0 ? "GOL" : "MEI", 71 + index),
    );

    const result = generateTeams(players, 4, { seed: 11, hasGoalkeeper: false, teamCount: 2 });

    expect(result.teams).toHaveLength(2);
    expect(result.teams.every((team) => team.players.length === 4)).toBe(true);
    expect(result.teams.flatMap((team) => team.players).length).toBe(8);
  });

  it("supports 6x6 custom teams with goalkeepers", () => {
    const players = Array.from({ length: 12 }, (_, index) =>
      makePlayer(`p${index}`, index % 6 === 0 ? "GOL" : "MEI", 72 + index),
    );

    const result = generateTeams(players, 6, { seed: 13, teamCount: 2 });

    expect(result.teams).toHaveLength(2);
    expect(result.teams.every((team) => team.players.length === 6)).toBe(true);
    expect(
      result.teams.every(
        (team) => team.players.filter((player) => player.position === "GOL").length <= 1,
      ),
    ).toBe(true);
  });

  it("does not create teams when a custom draw is below the minimum threshold", () => {
    const players = Array.from({ length: 5 }, (_, index) => makePlayer(`p${index}`, "MEI", 70));

    const result = generateTeams(players, 6, { seed: 5, hasGoalkeeper: false, teamCount: 2 });

    expect(result.teams).toHaveLength(0);
    expect(result.reserves).toHaveLength(5);
  });
});
