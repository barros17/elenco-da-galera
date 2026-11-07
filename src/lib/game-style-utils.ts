import { buildFormation, type FormationSlot } from "./team-formations";
import type { GameStyle } from "./game-style-queries";

export function styleFormation(
  style: Pick<GameStyle, "has_goalkeeper" | "defenders" | "midfielders" | "attackers">,
): FormationSlot[] {
  return buildFormation({
    hasGoalkeeper: style.has_goalkeeper,
    defenders: style.defenders,
    midfielders: style.midfielders,
    attackers: style.attackers,
  });
}

export function styleTotal(
  style: Pick<GameStyle, "has_goalkeeper" | "defenders" | "midfielders" | "attackers">,
): number {
  return (style.has_goalkeeper ? 1 : 0) + style.defenders + style.midfielders + style.attackers;
}

export function minimumConfirmedPlayers(playersPerTeam: number): number {
  return playersPerTeam * 2;
}

export function missingConfirmedPlayers(playersPerTeam: number, confirmed: number): number {
  return Math.max(0, minimumConfirmedPlayers(playersPerTeam) - confirmed);
}
