import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type GameStyle = Tables<"game_styles">;
export type GameStyleInput = Pick<
  GameStyle,
  | "section_id"
  | "name"
  | "players_per_team"
  | "has_goalkeeper"
  | "defenders"
  | "midfielders"
  | "attackers"
>;

export async function listGameStyles(sectionId: string): Promise<GameStyle[]> {
  const { data, error } = await supabase
    .from("game_styles")
    .select("*")
    .eq("section_id", sectionId)
    .order("name");
  if (error) throw error;
  return data;
}

export function useGameStyles(sectionId: string | undefined) {
  return useQuery({
    queryKey: ["game-styles", sectionId],
    queryFn: () => listGameStyles(sectionId!),
    enabled: Boolean(sectionId),
    staleTime: 5 * 60_000,
  });
}

export function useGameStyleMutations(sectionId: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["game-styles", sectionId] });
  const create = useMutation({
    mutationFn: async (input: Omit<GameStyleInput, "section_id">) => {
      const result = await supabase.rpc("create_game_style", {
        p_section_id: sectionId,
        p_name: input.name,
        p_players_per_team: input.players_per_team,
        p_has_goalkeeper: input.has_goalkeeper,
        p_defenders: input.defenders,
        p_midfielders: input.midfielders,
        p_attackers: input.attackers,
      });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async (input: GameStyleInput & { id: string }) => {
      const result = await supabase.rpc("update_game_style", {
        p_id: input.id,
        p_section_id: sectionId,
        p_name: input.name,
        p_players_per_team: input.players_per_team,
        p_has_goalkeeper: input.has_goalkeeper,
        p_defenders: input.defenders,
        p_midfielders: input.midfielders,
        p_attackers: input.attackers,
      });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const result = await supabase.rpc("delete_game_style", { p_id: id, p_section_id: sectionId });
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: invalidate,
  });
  return { create, update, remove };
}
