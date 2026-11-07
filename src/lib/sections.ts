import { supabase } from "@/integrations/supabase/client";
import { removeSectionPlayerPhotos } from "@/lib/photo-storage";

export type Section = {
  section_id: string;
  name: string;
  invite_code: string;
  is_admin: boolean;
  member_count: number;
};

export type SectionMember = {
  user_id: string;
  joined_at: string;
  is_admin: boolean;
  player_name: string | null;
};

export async function getMySection(): Promise<Section | null> {
  const { data, error } = await supabase.rpc("get_my_section");
  if (error) throw error;
  return data[0] ?? null;
}

export async function getSectionMembers(sectionId: string): Promise<SectionMember[]> {
  const { data, error } = await supabase.rpc("get_section_members", {
    p_section_id: sectionId,
  });
  if (error) throw error;
  return data;
}

export async function createSection(name: string): Promise<void> {
  const { error } = await supabase.rpc("create_section", { p_name: name.trim() });
  if (error) throw error;
}

export async function joinSection(inviteCode: string): Promise<void> {
  const { error } = await supabase.rpc("join_section", {
    p_invite_code: inviteCode.trim().toUpperCase(),
  });
  if (error) throw error;
}

export async function leaveSection(sectionId: string): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Faça login para sair da seção.");
  await removeSectionPlayerPhotos(sectionId, userId);

  const { error } = await supabase.rpc("leave_section", { p_section_id: sectionId });
  if (error) throw error;
}

export async function removeSectionMember(sectionId: string, userId: string): Promise<void> {
  await removeSectionPlayerPhotos(sectionId, userId);
  const { error } = await supabase.rpc("remove_section_member", {
    p_section_id: sectionId,
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function deleteSection(sectionId: string): Promise<void> {
  await removeSectionPlayerPhotos(sectionId);
  const { error } = await supabase.rpc("delete_section", { p_section_id: sectionId });
  if (error) throw error;
}
