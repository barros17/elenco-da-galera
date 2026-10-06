/**
 * Módulo do algoritmo de times.
 * Ajuste os pesos/iterações aqui para mudar o comportamento do sorteio.
 */
import { isAttacker, isDefender, isMid, type Player } from "./players";

export const TEAM_NAMES = [
  "Flamengo",
  "Corinthians",
  "Palmeiras",
  "São Paulo",
  "Santos",
  "Grêmio",
  "Internacional",
  "Cruzeiro",
  "Atlético Mineiro",
  "Vasco da Gama",
  "Botafogo",
  "Fluminense",
  "Bahia",
  "Sport",
  "Fortaleza",
  "Athletico Paranaense",
] as const;

/** Cores de camisa (somente cores, sem escudos). */
export const TEAM_COLORS: Record<string, { from: string; to: string; ink: string }> = {
  Flamengo: { from: "oklch(0.55 0.21 25)", to: "oklch(0.25 0.03 20)", ink: "oklch(0.98 0.01 90)" },
  Corinthians: { from: "oklch(0.3 0.01 250)", to: "oklch(0.18 0.01 250)", ink: "oklch(0.98 0.01 90)" },
  Palmeiras: { from: "oklch(0.52 0.15 150)", to: "oklch(0.28 0.08 155)", ink: "oklch(0.98 0.01 90)" },
  "São Paulo": { from: "oklch(0.9 0.01 250)", to: "oklch(0.6 0.18 25)", ink: "oklch(0.2 0.02 250)" },
  Santos: { from: "oklch(0.92 0.01 250)", to: "oklch(0.72 0.02 250)", ink: "oklch(0.2 0.02 250)" },
  Grêmio: { from: "oklch(0.5 0.16 250)", to: "oklch(0.3 0.1 250)", ink: "oklch(0.98 0.01 90)" },
  Internacional: { from: "oklch(0.5 0.2 22)", to: "oklch(0.28 0.1 20)", ink: "oklch(0.98 0.01 90)" },
  Cruzeiro: { from: "oklch(0.45 0.17 260)", to: "oklch(0.26 0.09 260)", ink: "oklch(0.98 0.01 90)" },
  "Atlético Mineiro": { from: "oklch(0.35 0.02 250)", to: "oklch(0.2 0.01 250)", ink: "oklch(0.98 0.01 90)" },
  "Vasco da Gama": { from: "oklch(0.3 0.015 250)", to: "oklch(0.75 0.02 250)", ink: "oklch(0.98 0.01 90)" },
  Botafogo: { from: "oklch(0.28 0.01 250)", to: "oklch(0.8 0.01 250)", ink: "oklch(0.98 0.01 90)" },
  Fluminense: { from: "oklch(0.45 0.13 160)", to: "oklch(0.45 0.17 15)", ink: "oklch(0.98 0.01 90)" },
  Bahia: { from: "oklch(0.55 0.16 245)", to: "oklch(0.58 0.19 25)", ink: "oklch(0.98 0.01 90)" },
  Sport: { from: "oklch(0.52 0.2 25)", to: "oklch(0.45 0.14 150)", ink: "oklch(0.98 0.01 90)" },
  Fortaleza: { from: "oklch(0.5 0.17 250)", to: "oklch(0.55 0.19 25)", ink: "oklch(0.98 0.01 90)" },
  "Athletico Paranaense": { from: "oklch(0.5 0.19 25)", to: "oklch(0.3 0.02 250)", ink: "oklch(0.98 0.01 90)" },
};

export const DEFAULT_COLOR = { from: "oklch(0.4 0.05 155)", to: "oklch(0.24 0.03 155)", ink: "oklch(0.98 0.01 90)" };

export type Team = {
  name: string;
  players: Player[];
};

export type DrawResult = {
  teams: Team[];
  reserves: Player[];
  balance: number;
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function sum(team: Player[]) {
  return team.reduce((s, p) => s + p.overall, 0);
}

function stdDev(values: number[]) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

/** Custo = desvio padrão das somas + penalidade de posições + leve aleatoriedade. */
function cost(teams: Player[][], jitter: number) {
  const base = stdDev(teams.map(sum));
  const defs = stdDev(teams.map((t) => t.filter((p) => isDefender(p.position)).length));
  const mids = stdDev(teams.map((t) => t.filter((p) => isMid(p.position)).length));
  const atks = stdDev(teams.map((t) => t.filter((p) => isAttacker(p.position)).length));
  const gks = stdDev(teams.map((t) => t.filter((p) => p.position === "GOL").length));
  return base + 2.5 * (defs + mids + atks) + 4 * gks + jitter * Math.random();
}

export function generateTeams(all: Player[], teamSize: number): DrawResult {
  const teamCount = Math.floor(all.length / teamSize);
  if (teamCount < 2) {
    return { teams: [], reserves: [...all], balance: 0 };
  }

  const keepers = shuffle(all.filter((p) => p.position === "GOL")).sort((a, b) => b.overall - a.overall);
  const others = shuffle(all.filter((p) => p.position !== "GOL")).sort((a, b) => b.overall - a.overall);

  // 1 goleiro por time, distribuídos primeiro.
  const buckets: Player[][] = Array.from({ length: teamCount }, () => []);
  keepers.slice(0, teamCount).forEach((gk, i) => buckets[i]!.push(gk));

  // Snake draft com os demais (goleiros extras entram como jogadores de linha).
  const pool = [...others, ...keepers.slice(teamCount)].sort((a, b) => b.overall - a.overall);
  let dir = 1;
  let idx = 0;
  const reserves: Player[] = [];
  for (const p of pool) {
    const openTeams = buckets.map((b, i) => i).filter((i) => buckets[i]!.length < teamSize);
    if (openTeams.length === 0) {
      reserves.push(p);
      continue;
    }
    // avança na serpentina até achar um time com vaga
    let guard = 0;
    while (buckets[idx]!.length >= teamSize && guard < teamCount * 4) {
      idx += dir;
      if (idx >= teamCount) {
        idx = teamCount - 1;
        dir = -1;
      } else if (idx < 0) {
        idx = 0;
        dir = 1;
      }
      guard++;
    }
    buckets[idx]!.push(p);
    idx += dir;
    if (idx >= teamCount) {
      idx = teamCount - 1;
      dir = -1;
    } else if (idx < 0) {
      idx = 0;
      dir = 1;
    }
  }

  // 4. Otimização por trocas (hill climbing com ~2000 iterações).
  const jitter = 0.6;
  let current = cost(buckets, 0);
  for (let it = 0; it < 2000; it++) {
    const a = Math.floor(Math.random() * teamCount);
    let b = Math.floor(Math.random() * teamCount);
    if (a === b) b = (b + 1) % teamCount;
    const ia = Math.floor(Math.random() * buckets[a]!.length);
    const ib = Math.floor(Math.random() * buckets[b]!.length);
    const pa = buckets[a]![ia]!;
    const pb = buckets[b]![ib]!;
    if (!pa || !pb) continue;

    buckets[a]![ia] = pb;
    buckets[b]![ib] = pa;
    const next = cost(buckets, it < 400 ? jitter : 0);
    if (next <= current) {
      current = next;
    } else {
      buckets[a]![ia] = pa;
      buckets[b]![ib] = pb;
    }
  }

  const names = shuffle([...TEAM_NAMES]).slice(0, teamCount);
  const teams: Team[] = buckets.map((players, i) => ({
    name: names[i] ?? `Time ${i + 1}`,
    players: [...players].sort((x, y) => y.overall - x.overall),
  }));

  return { teams, reserves, balance: balanceScore(teams) };
}

/** Equilíbrio em % pela diferença entre o melhor e o pior time. */
export function balanceScore(teams: Team[]): number {
  if (teams.length < 2) return 100;
  const avgs = teams.map((t) => sum(t.players) / Math.max(1, t.players.length));
  const best = Math.max(...avgs);
  const worst = Math.min(...avgs);
  if (best === 0) return 100;
  return Math.max(0, Math.round((1 - (best - worst) / best) * 100));
}

export function teamSum(team: Team) {
  return sum(team.players);
}

export function teamAvg(team: Team) {
  if (team.players.length === 0) return 0;
  return Math.round(sum(team.players) / team.players.length);
}
