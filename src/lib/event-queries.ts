import { supabase } from "@/integrations/supabase/client";
import {
  normalizeAttendanceStatus,
  normalizeGameModality,
  type AttendanceStatus,
  type EventAttendance,
  type FootballEvent,
  type NewFootballEvent,
} from "./events";

export async function listSectionEvents(
  sectionId: string,
  isAdmin = false,
): Promise<FootballEvent[]> {
  const query = supabase
    .from("events")
    .select(
      "id, section_id, title, starts_at, ends_at, modality, status, game_style_id, players_per_team, has_goalkeeper, defenders, midfielders, attackers",
    )
    .eq("section_id", sectionId)
    .order("starts_at", { ascending: true });

  if (!isAdmin) query.eq("status", "scheduled");
  const { data, error } = await query;

  if (error) throw error;
  return data.map((event) => ({
    ...event,
    modality: normalizeGameModality(event.modality),
    game_style_id: event.game_style_id,
    formation: {
      players_per_team: event.players_per_team,
      has_goalkeeper: event.has_goalkeeper,
      defenders: event.defenders,
      midfielders: event.midfielders,
      attackers: event.attackers,
    },
    status: event.status,
  }));
}

export async function listEventAttendance(eventId: string): Promise<EventAttendance[]> {
  const { data, error } = await supabase
    .from("event_attendance")
    .select("id, event_id, player_id, status, waitlist_position, responded_at, responded_by")
    .eq("event_id", eventId);

  if (error) throw error;
  return data.map((row) => ({
    ...row,
    status: normalizeAttendanceStatus(row.status),
  }));
}

export async function createFootballEvent(event: NewFootballEvent): Promise<string> {
  const { data, error } = await supabase.rpc("create_section_event", {
    p_section_id: event.section_id,
    p_title: event.title.trim(),
    p_starts_at: event.starts_at,
    p_ends_at: event.ends_at,
    p_modality: event.modality,
    p_game_style_id: event.game_style_id ?? null,
  });

  if (error) throw error;
  return data;
}

export async function updateFootballEvent(event: NewFootballEvent & { id: string }): Promise<void> {
  const { error } = await supabase.rpc("update_section_event", {
    p_event_id: event.id,
    p_title: event.title.trim(),
    p_starts_at: event.starts_at,
    p_ends_at: event.ends_at,
    p_modality: event.modality,
    p_game_style_id: event.game_style_id ?? null,
  });
  if (error) throw error;
}

export async function cancelFootballEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc("cancel_section_event", { p_event_id: eventId });
  if (error) throw error;
}

export async function reactivateFootballEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc("reactivate_section_event", { p_event_id: eventId });
  if (error) throw error;
}

export async function deleteFootballEvent(eventId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_section_event", { p_event_id: eventId });
  if (error) throw error;
}

export async function updateEventAttendance(
  eventId: string,
  playerId: string,
  status: AttendanceStatus,
): Promise<void> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Faça login para confirmar sua presença.");

  const { data, error } = await supabase
    .from("event_attendance")
    .update({
      status,
      responded_at: status === "CONFIRMED" ? new Date().toISOString() : null,
      responded_by: userId,
    })
    .eq("event_id", eventId)
    .eq("player_id", playerId)
    .select("id")
    .single();

  if (error) throw error;
  if (!data) throw new Error("Não foi possível salvar a confirmação de presença.");
}
