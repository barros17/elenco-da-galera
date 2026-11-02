import { supabase } from "@/integrations/supabase/client";
import { calcOverall, clampWeakFoot, type Player, type Position, type Skills } from "./players";

export type PlayerInput = {
  name: string;
  photo_url: string | null;
  position: Position;
  skills: Skills;
  weak_foot: number;
};

// Os jogadores da seção ficam em `section_players`. A tabela `players` (jogador individual
// de cada pessoa) nunca é alterada a partir da seção.
const TABLE = "section_players";

function normalize(row: Record<string, unknown>): Player {
  return {
    id: row["id"] as string,
    section_id: (row["section_id"] as string | null) ?? null,
    user_id: (row["user_id"] as string | null) ?? null,
    name: row["name"] as string,
    photo_url: (row["photo_url"] as string | null) ?? null,
    position: row["position"] as Position,
    skills: (row["skills"] ?? {}) as Skills,
    weak_foot: clampWeakFoot((row["weak_foot"] as number | undefined) ?? 0),
    overall: row["overall"] as number,
    created_at: row["created_at"] as string,
  };
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error("Faça login para acessar os jogadores.");
  return userId;
}

export async function listPlayers(sectionId: string): Promise<Player[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("section_id", sectionId)
    .order("overall", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

/**
 * Cria um jogador na seção.
 * - `linkToSelf: true` (padrão): é a carta do próprio usuário (uma por participante).
 * - `linkToSelf: false`: jogador extra, só o administrador pode criar (quantos quiser).
 */
function sanitizePlayerPayload(position: Position, skills: Skills, weakFoot: number) {
  const safeSkills: Skills = { ...skills };
  const keys =
    position === "GOL"
      ? ["MER", "MAN", "CHU", "REF", "VEL", "POS"]
      : ["RIT", "CHU", "PAS", "DRI", "DEF", "FIS"];

  for (const key of keys) {
    const rawValue = Number(safeSkills[key] ?? 1);
    safeSkills[key] = Number.isFinite(rawValue) ? clamp(rawValue, 1, 99) : 1;
  }

  return {
    skills: safeSkills,
    weak_foot: clampWeakFoot(weakFoot),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export async function createPlayer(
  input: PlayerInput,
  sectionId: string,
  options: { linkToSelf?: boolean } = {},
): Promise<Player> {
  const userId = await requireUserId();
  const { linkToSelf = true } = options;
  const payload = sanitizePlayerPayload(input.position, input.skills, input.weak_foot);

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      section_id: sectionId,
      user_id: linkToSelf ? userId : null,
      created_by: userId,
      name: input.name.trim(),
      photo_url: input.photo_url,
      position: input.position,
      skills: payload.skills,
      weak_foot: payload.weak_foot,
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

/** Quem pode editar é decidido pelo banco: o dono da carta ou o administrador da seção. */
export async function updatePlayer(
  id: string,
  input: PlayerInput,
  sectionId: string,
): Promise<Player> {
  const payload = sanitizePlayerPayload(input.position, input.skills, input.weak_foot);

  const { data, error } = await supabase
    .from(TABLE)
    .update({
      name: input.name.trim(),
      photo_url: input.photo_url,
      position: input.position,
      skills: payload.skills,
      weak_foot: payload.weak_foot,
    })
    .eq("id", id)
    .eq("section_id", sectionId)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deletePlayer(id: string, sectionId: string): Promise<void> {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("section_id", sectionId)
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0)
    throw new Error("Você não tem permissão para excluir este jogador.");
}
