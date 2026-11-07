import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isPlayerPhotoStoragePath } from "@/lib/player-photo-utils";

const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60;
const SIGNED_URL_STALE_TIME_MS = 45 * 60 * 1000;

type Props = {
  photoUrl: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  ariaHidden?: boolean;
};

async function createSignedPlayerPhotoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("player-photos")
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS);
  if (error) {
    console.error("Não foi possível gerar uma URL temporária para a foto do jogador:", error);
    throw error;
  }
  return data.signedUrl;
}

export function PlayerPhoto({ photoUrl, alt, className, fallback = null, ariaHidden }: Props) {
  const sourcePhotoUrl = photoUrl || null;
  const storedPath = isPlayerPhotoStoragePath(sourcePhotoUrl) ? sourcePhotoUrl : null;
  const signedUrlQuery = useQuery({
    queryKey: ["player-photo-signed-url", storedPath],
    queryFn: () => {
      if (!storedPath) throw new Error("O caminho da foto não é válido.");
      return createSignedPlayerPhotoUrl(storedPath);
    },
    enabled: storedPath !== null,
    staleTime: SIGNED_URL_STALE_TIME_MS,
    gcTime: SIGNED_URL_STALE_TIME_MS,
    retry: false,
  });
  const src = storedPath ? signedUrlQuery.data : sourcePhotoUrl;
  const [imageFailed, setImageFailed] = useState(false);
  const [lastFailedSource, setLastFailedSource] = useState<string | null>(null);

  useEffect(() => {
    setImageFailed(false);
    setLastFailedSource(null);
  }, [src]);

  if (!src || imageFailed) return fallback;

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={ariaHidden}
      className={className}
      onError={() => {
        if (storedPath && !signedUrlQuery.isError && lastFailedSource !== src) {
          setLastFailedSource(src);
          void signedUrlQuery.refetch();
          return;
        }
        setImageFailed(true);
      }}
    />
  );
}
