import { createClient } from "@supabase/supabase-js";
import { decodePlayerPhotoDataUrl } from "../src/lib/player-photo-utils";
import type { Database } from "../src/integrations/supabase/types";

const BATCH_SIZE = 10;
const dryRun = process.argv.includes("--dry-run");
const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para executar a migração.");
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  let migrated = 0;
  let lastPlayerId = "00000000-0000-0000-0000-000000000000";
  for (;;) {
    const { data, error } = await supabase
      .from("section_players")
      .select("id, section_id, photo_url")
      .like("photo_url", "data:image/%")
      .gt("id", lastPlayerId)
      .order("id", { ascending: true })
      .range(0, BATCH_SIZE - 1);
    if (error) throw error;
    if (!data?.length) break;
    const lastPlayer = data.at(-1);
    if (!lastPlayer) break;
    lastPlayerId = lastPlayer.id;

    for (const player of data) {
      if (!player.photo_url?.startsWith("data:image/")) continue;
      const { blob, extension } = decodePlayerPhotoDataUrl(player.photo_url);
      const path = `${player.section_id}/${player.id}.${extension}`;
      if (dryRun) {
        console.info(`[simulação] Migraria a foto da carta ${player.id} para ${path}.`);
        migrated += 1;
        continue;
      }

      const { error: uploadError } = await supabase.storage
        .from("player-photos")
        .upload(path, blob, { cacheControl: "60", contentType: blob.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: updated, error: updateError } = await supabase
        .from("section_players")
        .update({ photo_url: path })
        .eq("id", player.id)
        .eq("section_id", player.section_id)
        .like("photo_url", "data:image/%")
        .select("id");
      if (updateError || !updated?.length) {
        const { error: cleanupError } = await supabase.storage.from("player-photos").remove([path]);
        if (cleanupError) {
          console.error(`Não foi possível limpar o objeto ${path}:`, cleanupError);
        }
        if (updateError) throw updateError;
        console.warn(`A carta ${player.id} mudou durante a migração; o objeto foi removido.`);
        continue;
      }

      migrated += 1;
      console.info(`Foto migrada para ${path}.`);
    }
  }

  console.info(
    `${dryRun ? "Simulação concluída" : "Migração concluída"}: ${migrated} foto(s) ${
      dryRun ? "seriam migradas" : "migradas"
    }.`,
  );
}

main().catch((error: unknown) => {
  console.error("A migração de fotos falhou:", error);
  process.exitCode = 1;
});
