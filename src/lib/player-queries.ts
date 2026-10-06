import { supabase } from "@/integrations/supabase/client";
import { getSessionId } from "./session";
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
    name: row["name"] as string,
    photo_url: (row["photo_url"] as string | null) ?? null,
    position: row["position"] as Position,
    skills: (row["skills"] ?? {}) as Skills,
    weak_foot: clampWeakFoot((row["weak_foot"] as number | undefined) ?? 0),
    overall: row["overall"] as number,
    created_at: row["created_at"] as string,
  };
}

export async function listPlayers(): Promise<Player[]> {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("session_id", getSessionId())
    .order("overall", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalize);
}

export async function createPlayer(input: PlayerInput): Promise<Player> {
  const { data, error } = await supabase
    .from("players")
    .insert({
      session_id: getSessionId(),
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

export async function updatePlayer(id: string, input: PlayerInput): Promise<Player> {
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
    .select("*")
    .single();
  if (error) throw error;
  return normalize(data);
}

export async function deletePlayer(id: string): Promise<void> {
  const { error } = await supabase.from("players").delete().eq("id", id);
  if (error) throw error;
}

