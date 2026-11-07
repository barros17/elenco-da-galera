import { supabase } from "@/integrations/supabase/client";
import { decodePlayerPhotoDataUrl, isPlayerPhotoStoragePath } from "@/lib/player-photo-utils";

const STORAGE_BUCKET = "player-photos";
const PAGE_SIZE = 500;
const REMOVE_BATCH_SIZE = 100;

export async function uploadPlayerPhoto(
  dataUrl: string,
  sectionId: string,
  playerId: string,
): Promise<string> {
  const { blob, extension } = decodePlayerPhotoDataUrl(dataUrl);
  const path = `${sectionId}/${playerId}.${extension}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
    cacheControl: "60",
    contentType: blob.type,
    upsert: true,
  });
  if (error) throw error;
  return path;
}

export async function removeStoredPlayerPhotos(photoUrls: Array<string | null>): Promise<void> {
  const paths = [...new Set(photoUrls.filter(isPlayerPhotoStoragePath))];
  for (let index = 0; index < paths.length; index += REMOVE_BATCH_SIZE) {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove(paths.slice(index, index + REMOVE_BATCH_SIZE));
    if (error) throw error;
  }
}

export async function removeSectionPlayerPhotos(sectionId: string, userId?: string): Promise<void> {
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from("section_players")
      .select("photo_url")
      .eq("section_id", sectionId)
      .like("photo_url", `${sectionId}/%`);
    if (userId) query = query.eq("user_id", userId);

    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;

    await removeStoredPlayerPhotos((data ?? []).map((row) => row.photo_url));
    if (!data || data.length < PAGE_SIZE) return;
  }
}

export { isPlayerPhotoStoragePath } from "@/lib/player-photo-utils";
