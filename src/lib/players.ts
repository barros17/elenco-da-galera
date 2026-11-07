export const POSITIONS = ["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"] as const;
export type Position = (typeof POSITIONS)[number];

export const POSITION_LABELS: Record<Position, string> = {
  GOL: "Goleiro",
  ZAG: "Zagueiro",
  LAT: "Lateral",
  VOL: "Volante",
  MEI: "Meia",
  ATA: "Atacante",
};

export const FIELD_SKILLS = [
  { key: "RIT", label: "Ritmo" },
  { key: "CHU", label: "Chute" },
  { key: "PAS", label: "Passe" },
  { key: "DRI", label: "Drible" },
  { key: "DEF", label: "Defesa" },
  { key: "FIS", label: "Físico" },
] as const;

export const GK_SKILLS = [
  { key: "MER", label: "Mergulho" },
  { key: "MAN", label: "Manejo" },
  { key: "CHU", label: "Chute" },
  { key: "REF", label: "Reflexo" },
  { key: "VEL", label: "Velocidade" },
  { key: "POS", label: "Posicionamento" },
] as const;

export type Skills = Record<string, number>;

export type Player = {
  id: string;
  section_id: string | null;
  /** Participante que a carta representa; nulo = jogador adicionado pelo administrador. */
  user_id: string | null;
  name: string;
  photo_url: string | null;
  position: Position;
  skills: Skills;
  weak_foot: number;
  overall: number;
  created_at: string;
};

export function clampWeakFoot(value: number): number {
  return Math.min(5, Math.max(0, Math.round(value)));
}

export function skillSetFor(position: Position) {
  return position === "GOL" ? GK_SKILLS : FIELD_SKILLS;
}

export function defaultSkills(position: Position): Skills {
  return Object.fromEntries(skillSetFor(position).map((s) => [s.key, 70]));
}

const WEIGHTS: Record<Exclude<Position, "GOL">, Record<string, number>> = {
  ATA: { RIT: 20, CHU: 30, PAS: 10, DRI: 25, DEF: 0, FIS: 15 },
  MEI: { RIT: 10, CHU: 15, PAS: 30, DRI: 25, DEF: 5, FIS: 15 },
  VOL: { RIT: 10, CHU: 5, PAS: 25, DRI: 15, DEF: 30, FIS: 15 },
  LAT: { RIT: 25, CHU: 5, PAS: 15, DRI: 15, DEF: 25, FIS: 15 },
  ZAG: { RIT: 10, CHU: 0, PAS: 10, DRI: 5, DEF: 45, FIS: 30 },
};

/** Overall = média ponderada por posição, arredondada. Goleiro usa média simples. */
export function calcOverall(position: Position, skills: Skills): number {
  if (position === "GOL") {
    const vals = GK_SKILLS.map((s) => normalizedSkill(skills[s.key]));
    return clamp(Math.floor((vals.reduce((a, b) => a + b, 0) + 3) / 6));
  }
  const w = WEIGHTS[position];
  const total = Object.entries(w).reduce(
    (sum, [key, weight]) => sum + normalizedSkill(skills[key]) * weight,
    0,
  );
  return clamp(Math.floor((total + 50) / 100));
}

function normalizedSkill(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(99, Math.max(1, Math.round(value)))
    : 1;
}

function clamp(n: number) {
  return Math.min(99, Math.max(1, n));
}

export type Tier = "bronze" | "prata" | "ouro" | "diamante";

export function tierFor(overall: number): Tier {
  if (overall >= 85) return "diamante";
  if (overall >= 75) return "ouro";
  if (overall >= 65) return "prata";
  return "bronze";
}

export const TIER_LABELS: Record<Tier, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  diamante: "Diamante",
};

export function isDefender(p: Position) {
  return p === "ZAG" || p === "LAT";
}
export function isMid(p: Position) {
  return p === "VOL" || p === "MEI";
}
export function isAttacker(p: Position) {
  return p === "ATA";
}
