import { supabase } from "@/integrations/supabase/client";
import { calcOverall, clampWeakFoot, type Player, type Position, type Skills } from "./players";

export type PlayerInput = {
  name: string;
  photo_url: string | null;
  position: Position;
  skills: Skills;
  weak_foot: number;
};

function normalize(row: Record<string, unknown>): Player {
  return {
    id: row["id"] as string,
    section_id: (row["section_id"] as string | null) ?? null,
    user_id: row["user_id"] as string,
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
    .from("players")
    .select("*")
    .eq("section_id", sectionId)
    .order("overall", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function createPlayer(input: PlayerInput, sectionId: string): Promise<Player> {
  const { data, error } = await supabase
    .from("players")
    .insert({
      user_id: await requireUserId(),
      section_id: sectionId,
      name: input.name.trim(),
      photo_url: input.photo_url,
      position: input.position,
      skills: input.skills,
      weak_foot: clampWeakFoot(input.weak_foot),
      overall: calcOverall(input.position, input.skills),
    })
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function updatePlayer(
  id: string,
  input: PlayerInput,
  sectionId: string,
): Promise<Player> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("players")
    .update({
      name: input.name.trim(),
      photo_url: input.photo_url,
      position: input.position,
      skills: input.skills,
      weak_foot: clampWeakFoot(input.weak_foot),
      overall: calcOverall(input.position, input.skills),
    })
    .eq("id", id)
    .eq("section_id", sectionId)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deletePlayer(id: string, sectionId: string): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("players")
    .delete()
    .eq("id", id)
    .eq("section_id", sectionId)
    .eq("user_id", userId);
  if (error) throw error;
}
