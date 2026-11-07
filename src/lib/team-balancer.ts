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
  Corinthians: {
    from: "oklch(0.3 0.01 250)",
    to: "oklch(0.18 0.01 250)",
    ink: "oklch(0.98 0.01 90)",
  },
  Palmeiras: {
    from: "oklch(0.52 0.15 150)",
    to: "oklch(0.28 0.08 155)",
    ink: "oklch(0.98 0.01 90)",
  },
  "São Paulo": {
    from: "oklch(0.9 0.01 250)",
    to: "oklch(0.6 0.18 25)",
    ink: "oklch(0.2 0.02 250)",
  },
  Santos: { from: "oklch(0.92 0.01 250)", to: "oklch(0.72 0.02 250)", ink: "oklch(0.2 0.02 250)" },
  Grêmio: { from: "oklch(0.5 0.16 250)", to: "oklch(0.3 0.1 250)", ink: "oklch(0.98 0.01 90)" },
  Internacional: {
    from: "oklch(0.5 0.2 22)",
    to: "oklch(0.28 0.1 20)",
    ink: "oklch(0.98 0.01 90)",
  },
  Cruzeiro: {
    from: "oklch(0.45 0.17 260)",
    to: "oklch(0.26 0.09 260)",
    ink: "oklch(0.98 0.01 90)",
  },
  "Atlético Mineiro": {
    from: "oklch(0.35 0.02 250)",
    to: "oklch(0.2 0.01 250)",
    ink: "oklch(0.98 0.01 90)",
  },
  "Vasco da Gama": {
    from: "oklch(0.3 0.015 250)",
    to: "oklch(0.75 0.02 250)",
    ink: "oklch(0.98 0.01 90)",
  },
  Botafogo: { from: "oklch(0.28 0.01 250)", to: "oklch(0.8 0.01 250)", ink: "oklch(0.98 0.01 90)" },
  Fluminense: {
    from: "oklch(0.45 0.13 160)",
    to: "oklch(0.45 0.17 15)",
    ink: "oklch(0.98 0.01 90)",
  },
  Bahia: { from: "oklch(0.55 0.16 245)", to: "oklch(0.58 0.19 25)", ink: "oklch(0.98 0.01 90)" },
  Sport: { from: "oklch(0.52 0.2 25)", to: "oklch(0.45 0.14 150)", ink: "oklch(0.98 0.01 90)" },
  Fortaleza: { from: "oklch(0.5 0.17 250)", to: "oklch(0.55 0.19 25)", ink: "oklch(0.98 0.01 90)" },
  "Athletico Paranaense": {
    from: "oklch(0.5 0.19 25)",
    to: "oklch(0.3 0.02 250)",
    ink: "oklch(0.98 0.01 90)",
  },
};

export const DEFAULT_COLOR = {
  from: "oklch(0.4 0.05 155)",
  to: "oklch(0.24 0.03 155)",
  ink: "oklch(0.98 0.01 90)",
};

export type Team = {
  name: string;
  players: Player[];
};

export type GenerateTeamsOptions = {
  seed?: number | string;
  rng?: () => number;
  teamCount?: number;
};

export type DrawResult = {
  teams: Team[];
  reserves: Player[];
  balance: number;
  warnings: string[];
};

function createRng(seedOrRng?: number | string | (() => number)): () => number {
  if (typeof seedOrRng === "function") return seedOrRng;

  if (typeof seedOrRng === "number") {
    let state = seedOrRng >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
  }

  if (typeof seedOrRng === "string") {
    let hash = 2166136261;
    for (let i = 0; i < seedOrRng.length; i++) {
      hash ^= seedOrRng.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return () => {
      hash = (hash + 0x6d2b79f5) >>> 0;
      const value = Math.imul(hash ^ (hash >>> 15), 1 | hash);
      return (((value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value) >>> 0) / 4294967296;
    };
  }

  return () => Math.random();
}

function shuffle<T>(arr: T[], rng: () => number = Math.random): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
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

function cost(teams: Player[][], jitter: number, rng: () => number) {
  const base = stdDev(teams.map(sum));
  const defs = stdDev(teams.map((t) => t.filter((p) => isDefender(p.position)).length));
  const mids = stdDev(teams.map((t) => t.filter((p) => isMid(p.position)).length));
  const atks = stdDev(teams.map((t) => t.filter((p) => isAttacker(p.position)).length));
  const gks = stdDev(teams.map((t) => t.filter((p) => p.position === "GOL").length));
  return base + 2.5 * (defs + mids + atks) + 4 * gks + jitter * (rng() - 0.5) * 2;
}

export function generateTeams(
  all: Player[],
  teamSize: number,
  options: GenerateTeamsOptions = {},
): DrawResult {
  const rng = createRng(options.rng ?? options.seed);
  const teamCount = options.teamCount ?? Math.max(2, Math.floor(all.length / teamSize));

  if (all.length === 0 || !Number.isInteger(teamCount) || teamCount < 2) {
    return { teams: [], reserves: [], balance: 100, warnings: [] };
  }

  if (
    all.length < teamSize ||
    (options.teamCount !== undefined && all.length < teamSize * teamCount)
  ) {
    return {
      teams: [],
      reserves: [...all],
      balance: 100,
      warnings: ["Número de jogadores insuficiente para formar times completos."],
    };
  }

  const keepers = shuffle(
    all.filter((p) => p.position === "GOL"),
    rng,
  ).sort((a, b) => b.overall - a.overall);
  const others = shuffle(
    all.filter((p) => p.position !== "GOL"),
    rng,
  ).sort((a, b) => b.overall - a.overall);
  const buckets: Player[][] = Array.from({ length: teamCount }, () => []);

  keepers.slice(0, teamCount).forEach((gk, i) => buckets[i]!.push(gk));

  const reservePool = [...others, ...keepers.slice(teamCount)].sort(
    (a, b) => b.overall - a.overall,
  );
  let dir = 1;
  let idx = 0;
  const reserves: Player[] = [];

  for (const player of reservePool) {
    const prefersGoalkeeperSlot = player.position === "GOL";
    let attempts = 0;
    while (attempts < teamCount * 4) {
      const targetIndex = prefersGoalkeeperSlot
        ? buckets.findIndex(
            (team) =>
              team.filter((member) => member.position === "GOL").length === 0 &&
              team.length < teamSize,
          )
        : idx;

      const selectedIndex = targetIndex >= 0 ? targetIndex : idx;
      if (buckets[selectedIndex]!.length < teamSize) {
        const wouldBreakGkLimit =
          player.position === "GOL" &&
          buckets[selectedIndex]!.some((member) => member.position === "GOL");
        if (!wouldBreakGkLimit) {
          buckets[selectedIndex]!.push(player);
          idx = (selectedIndex + dir + teamCount) % teamCount;
          break;
        }
      }

      idx = (idx + dir + teamCount) % teamCount;
      if (idx === 0 || idx === teamCount - 1) dir *= -1;
      attempts += 1;
    }

    if (attempts >= teamCount * 4) {
      reserves.push(player);
    }
  }

  const jitter = 0.6;
  let current = cost(buckets, 0, rng);
  for (let it = 0; it < 2000; it++) {
    const a = Math.floor(rng() * teamCount);
    let b = Math.floor(rng() * teamCount);
    if (a === b) b = (b + 1) % teamCount;
    const ia = Math.floor(rng() * buckets[a]!.length);
    const ib = Math.floor(rng() * buckets[b]!.length);
    const pa = buckets[a]![ia]!;
    const pb = buckets[b]![ib]!;
    if (!pa || !pb) continue;

    const nextA = [...buckets[a]!];
    const nextB = [...buckets[b]!];
    nextA[ia] = pb;
    nextB[ib] = pa;

    const gkCountA = nextA.filter((player) => player.position === "GOL").length;
    const gkCountB = nextB.filter((player) => player.position === "GOL").length;
    if (gkCountA > 1 || gkCountB > 1) continue;

    buckets[a]![ia] = pb;
    buckets[b]![ib] = pa;
    const next = cost(buckets, it < 400 ? jitter : 0, rng);
    if (next <= current) {
      current = next;
    } else {
      buckets[a]![ia] = pa;
      buckets[b]![ib] = pb;
    }
  }

  const warnings: string[] = [];
  const emptyGkTeams = buckets
    .map((team, index) =>
      team.filter((player) => player.position === "GOL").length === 0 ? `Time ${index + 1}` : null,
    )
    .filter(Boolean) as string[];
  if (emptyGkTeams.length > 0) warnings.push(`Sem goleiro em: ${emptyGkTeams.join(", ")}.`);
  if (reserves.length > 0) warnings.push(`${reserves.length} reserva(s) ficaram fora do sorteio.`);

  const names = shuffle([...TEAM_NAMES], rng).slice(0, teamCount);
  const teams: Team[] = buckets.map((players, i) => ({
    name: names[i] ?? `Time ${i + 1}`,
    players: [...players].sort((x, y) => y.overall - x.overall),
  }));

  return {
    teams,
    reserves: [...reserves].sort((a, b) => b.overall - a.overall),
    balance: balanceScore(teams),
    warnings,
  };
}

/** Equilíbrio em % pela diferença entre o melhor e o pior time. */
export function balanceScore(teams: Team[]): number {
  if (teams.length < 2) return 100;

  const averages = teams.map((t) => sum(t.players) / Math.max(1, t.players.length));
  const defenders = teams.map((t) => t.players.filter((p) => isDefender(p.position)).length);
  const mids = teams.map((t) => t.players.filter((p) => isMid(p.position)).length);
  const attackers = teams.map((t) => t.players.filter((p) => isAttacker(p.position)).length);
  const roleVariance = stdDev([...defenders, ...mids, ...attackers]);
  const best = Math.max(...averages);
  const worst = Math.min(...averages);
  const overallGap = best === 0 ? 0 : (best - worst) / best;
  return Math.max(0, Math.round(100 - (overallGap * 100 + roleVariance * 6)));
}

export function teamSum(team: Team) {
  return sum(team.players);
}

export function teamAvg(team: Team) {
  if (team.players.length === 0) return 0;
  return Math.round(sum(team.players) / team.players.length);
}
