import { describe, expect, it } from "vitest";
import type { Player } from "./players";
import {
  buildFormation,
  createInitialLineup,
  MODALITY_FORMATIONS,
  movePlayerToReserves,
  movePlayerToSlot,
} from "./team-formations";

function makePlayer(id: string, position: Player["position"] = "ATA"): Player {
  return {
    id,
    section_id: "section-1",
    user_id: id,
    name: `Jogador ${id}`,
    photo_url: null,
    position,
    skills: {},
    weak_foot: 3,
    overall: 70,
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("team formations", () => {
  it.each([
    ["futsal", 5],
    ["fut7", 7],
    ["campo11", 11],
  ] as const)("creates %i slots for the modality", (modality, size) => {
    expect(MODALITY_FORMATIONS[modality].slots).toHaveLength(size);
    expect(MODALITY_FORMATIONS[modality].teamSize).toBe(size);
  });

  it("places goalkeepers and preferred positions into their matching slots first", () => {
    const players = [
      makePlayer("gk", "GOL"),
      makePlayer("striker", "ATA"),
      makePlayer("defender", "ZAG"),
      makePlayer("midfielder", "MEI"),
      makePlayer("fullback", "LAT"),
    ];
    const lineup = createInitialLineup(players, "futsal");

    expect(lineup[0]?.id).toBe("gk");
    expect(lineup[1]?.id).toBe("defender");
    expect(lineup[2]?.id).toBe("midfielder");
    expect(lineup[3]?.id).toBe("fullback");
    expect(lineup[4]?.id).toBe("striker");
  });

  it("swaps occupied positions and moves a player into an empty slot", () => {
    const teams = [
      [makePlayer("one"), makePlayer("two")],
      [makePlayer("three"), null],
    ];
    const swapped = movePlayerToSlot(
      teams,
      [],
      { type: "field", teamIndex: 0, slotIndex: 0 },
      { teamIndex: 1, slotIndex: 0 },
    );
    expect(swapped.teams[0]?.[0]?.id).toBe("three");
    expect(swapped.teams[1]?.[0]?.id).toBe("one");

    const moved = movePlayerToSlot(
      swapped.teams,
      [],
      { type: "field", teamIndex: 0, slotIndex: 1 },
      { teamIndex: 1, slotIndex: 1 },
    );
    expect(moved.teams[0]?.[1]).toBeNull();
    expect(moved.teams[1]?.[1]?.id).toBe("two");
  });

  it("sends a replaced player to the reserves and supports emptying a field slot", () => {
    const teams = [[makePlayer("one")]];
    const reserves = [makePlayer("reserve")];
    const filled = movePlayerToSlot(
      teams,
      reserves,
      { type: "reserve", reserveIndex: 0 },
      { teamIndex: 0, slotIndex: 0 },
    );
    expect(filled.teams[0]?.[0]?.id).toBe("reserve");
    expect(filled.reserves.map((player) => player.id)).toEqual(["one"]);

    const benched = movePlayerToReserves(filled.teams, filled.reserves, {
      teamIndex: 0,
      slotIndex: 0,
    });
    expect(benched.teams[0]?.[0]).toBeNull();
    expect(benched.reserves.map((player) => player.id)).toEqual(["one", "reserve"]);
  });

  it("builds custom formations from defensive, midfield and attack counts", () => {
    const slots = buildFormation({
      hasGoalkeeper: false,
      defenders: 2,
      midfielders: 3,
      attackers: 2,
    });

    expect(slots).toHaveLength(7);
    expect(slots.filter((slot) => slot.positions.includes("GOL")).length).toBe(0);
    expect(slots.filter((slot) => slot.positions.includes("ATA")).length).toBe(2);
    expect(slots[0]?.y).toBe(72);
    expect(slots.at(-1)?.y).toBe(29);
  });
});
