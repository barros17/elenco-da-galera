import type { Player, Position } from "./players";
import type { GameModality } from "./events";

export type FormationSlot = {
  id: string;
  label: string;
  positions: Position[];
  x: number;
  y: number;
};

export type FormationCounts = {
  hasGoalkeeper: boolean;
  defenders: number;
  midfielders: number;
  attackers: number;
};

export type FormationDefinition = FormationCounts & {
  playersPerTeam: number;
};

export function buildFormation({
  hasGoalkeeper,
  defenders,
  midfielders,
  attackers,
}: FormationCounts): FormationSlot[] {
  const rows: Array<{
    id: string;
    label: string;
    positions: Position[];
    count: number;
    y: number;
  }> = [
    {
      id: "gk",
      label: "Goleiro",
      positions: ["GOL"] as Position[],
      count: hasGoalkeeper ? 1 : 0,
      y: 90,
    },
    {
      id: "def",
      label: "Zagueiro",
      positions: ["ZAG", "LAT"] as Position[],
      count: defenders,
      y: 72,
    },
    {
      id: "mid",
      label: "Meia",
      positions: ["MEI", "VOL"] as Position[],
      count: midfielders,
      y: 52,
    },
    { id: "atk", label: "Atacante", positions: ["ATA"] as Position[], count: attackers, y: 29 },
  ].filter((row) => row.count > 0);
  const slots: FormationSlot[] = [];
  for (const row of rows) {
    for (let index = 0; index < row.count; index++) {
      const label =
        row.id === "def"
          ? row.count >= 3 && (index === 0 || index === row.count - 1)
            ? "Lateral"
            : "Zagueiro"
          : row.id === "mid"
            ? row.count >= 3 && index === Math.floor((row.count - 1) / 2)
              ? "Volante"
              : "Meia"
            : row.label;

      const effectiveCount = row.count === 1 ? 1 : row.count;
      const x = 10 + ((index + 0.5) * 80) / effectiveCount;
      slots.push({
        id: `${row.id}-${index + 1}`,
        label,
        positions: row.positions,
        x,
        y: row.y,
      });
    }
  }

  return slots;
}

export const MODALITY_FORMATIONS: Record<
  Exclude<GameModality, "custom">,
  { label: string; format: string; teamSize: number; slots: FormationSlot[] }
> = {
  futsal: {
    label: "Futsal",
    format: "1–2–1",
    teamSize: 5,
    slots: [
      { id: "gk", label: "Goleiro", positions: ["GOL"], x: 50, y: 89 },
      { id: "fixo", label: "Fixo", positions: ["ZAG", "LAT"], x: 50, y: 69 },
      { id: "ala-esq", label: "Ala", positions: ["MEI", "VOL", "LAT"], x: 25, y: 49 },
      { id: "ala-dir", label: "Ala", positions: ["MEI", "VOL", "LAT"], x: 75, y: 49 },
      { id: "pivo", label: "Pivô", positions: ["ATA"], x: 50, y: 27 },
    ],
  },
  fut7: {
    label: "Fut7",
    format: "1–2–3–1",
    teamSize: 7,
    slots: [
      { id: "gk", label: "Goleiro", positions: ["GOL"], x: 50, y: 89 },
      { id: "def-esq", label: "Lateral", positions: ["LAT", "ZAG"], x: 30, y: 71 },
      { id: "def-dir", label: "Zagueiro", positions: ["ZAG", "LAT"], x: 70, y: 71 },
      { id: "mei-esq", label: "Meia", positions: ["MEI", "VOL"], x: 20, y: 51 },
      { id: "vol", label: "Volante", positions: ["VOL", "MEI"], x: 50, y: 57 },
      { id: "mei-dir", label: "Meia", positions: ["MEI", "VOL"], x: 80, y: 51 },
      { id: "ata", label: "Atacante", positions: ["ATA"], x: 50, y: 29 },
    ],
  },
  campo11: {
    label: "Futebol de campo",
    format: "4–3–3",
    teamSize: 11,
    slots: [
      { id: "gk", label: "Goleiro", positions: ["GOL"], x: 50, y: 91 },
      { id: "def-esq", label: "Lateral", positions: ["LAT", "ZAG"], x: 17, y: 75 },
      { id: "zag-esq", label: "Zagueiro", positions: ["ZAG", "LAT"], x: 39, y: 78 },
      { id: "zag-dir", label: "Zagueiro", positions: ["ZAG", "LAT"], x: 61, y: 78 },
      { id: "def-dir", label: "Lateral", positions: ["LAT", "ZAG"], x: 83, y: 75 },
      { id: "vol", label: "Volante", positions: ["VOL", "MEI"], x: 25, y: 55 },
      { id: "mei", label: "Meia", positions: ["MEI", "VOL"], x: 50, y: 58 },
      { id: "mei-av", label: "Meia", positions: ["MEI", "VOL"], x: 75, y: 55 },
      { id: "ata-esq", label: "Atacante", positions: ["ATA"], x: 23, y: 31 },
      { id: "ata-centro", label: "Atacante", positions: ["ATA", "MEI"], x: 50, y: 27 },
      { id: "ata-dir", label: "Atacante", positions: ["ATA"], x: 77, y: 31 },
    ],
  },
};

export function createInitialLineup(
  players: Player[],
  formation: GameModality | FormationCounts,
): Array<Player | null> {
  const remaining = [...players];
  const slots =
    typeof formation === "string"
      ? formation === "custom"
        ? []
        : MODALITY_FORMATIONS[formation].slots
      : buildFormation(formation);
  return slots.map((slot, slotIndex) => {
    let preferredIndex = remaining.findIndex((player) => slot.positions.includes(player.position));
    if (preferredIndex < 0 && remaining.length > 0) {
      const futureSlots = slots.slice(slotIndex + 1);
      const futureFitCount = (player: Player) =>
        futureSlots.filter((futureSlot) => futureSlot.positions.includes(player.position)).length;
      preferredIndex = remaining.reduce(
        (bestIndex, player, index) =>
          futureFitCount(player) < futureFitCount(remaining[bestIndex]!) ? index : bestIndex,
        0,
      );
    }
    const [player] = remaining.splice(preferredIndex >= 0 ? preferredIndex : 0, 1);
    return player ?? null;
  });
}

export function movePlayerToSlot(
  teams: Array<Array<Player | null>>,
  reserves: Player[],
  source:
    | { type: "field"; teamIndex: number; slotIndex: number }
    | { type: "reserve"; reserveIndex: number },
  target: { teamIndex: number; slotIndex: number },
): { teams: Array<Array<Player | null>>; reserves: Player[] } {
  const nextTeams = teams.map((team) => [...team]);
  const nextReserves = [...reserves];
  const targetPlayer = nextTeams[target.teamIndex]?.[target.slotIndex];
  if (!nextTeams[target.teamIndex]) return { teams, reserves };

  if (source.type === "field") {
    const sourceTeam = nextTeams[source.teamIndex];
    const player = sourceTeam?.[source.slotIndex];
    if (!player) return { teams, reserves };
    if (source.teamIndex === target.teamIndex && source.slotIndex === target.slotIndex) {
      return { teams, reserves };
    }

    sourceTeam[source.slotIndex] = targetPlayer ?? null;
    nextTeams[target.teamIndex]![target.slotIndex] = player;
  } else {
    const [player] = nextReserves.splice(source.reserveIndex, 1);
    if (!player) return { teams, reserves };
    if (targetPlayer) nextReserves.push(targetPlayer);
    nextTeams[target.teamIndex]![target.slotIndex] = player;
  }

  return { teams: nextTeams, reserves: nextReserves };
}

export function movePlayerToReserves(
  teams: Array<Array<Player | null>>,
  reserves: Player[],
  source: { teamIndex: number; slotIndex: number },
): { teams: Array<Array<Player | null>>; reserves: Player[] } {
  const nextTeams = teams.map((team) => [...team]);
  const player = nextTeams[source.teamIndex]?.[source.slotIndex];
  if (!player) return { teams, reserves };

  nextTeams[source.teamIndex]![source.slotIndex] = null;
  return { teams: nextTeams, reserves: [...reserves, player] };
}
