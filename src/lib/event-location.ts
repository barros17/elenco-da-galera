export const INVALID_GOOGLE_MAPS_LINK_MESSAGE =
  "Link inválido. Cole um link do Google Maps (google.com/maps, google.com.br/maps ou maps.app.goo.gl). No app do Maps, use Compartilhar e copie o link.";

const GOOGLE_HOST_PATTERN = /^(www\.|maps\.)?google\.(?:com|com\.[a-z]{2}|co\.[a-z]{2}|[a-z]{2})$/;

export type EventLocation = {
  location_name?: string | null;
  location_address?: string | null;
  location_link?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
};

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

export function isAllowedGoogleMapsLink(value: string | null | undefined): boolean {
  const link = nonEmpty(value);
  if (!link || link.length > 500) return !link;
  try {
    const url = new URL(link);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.port || url.username || url.password) {
      return false;
    }
    if (host === "maps.app.goo.gl") return true;
    if (host === "goo.gl") return url.pathname === "/maps" || url.pathname.startsWith("/maps/");
    if (!GOOGLE_HOST_PATTERN.test(host)) return false;
    return (
      host.startsWith("maps.google.") ||
      url.pathname === "/maps" ||
      url.pathname.startsWith("/maps/")
    );
  } catch {
    return false;
  }
}

export function isGenericGoogleMapsLink(value: string | null | undefined): boolean {
  const link = nonEmpty(value);
  if (!link || !isAllowedGoogleMapsLink(link)) return false;
  try {
    const url = new URL(link);
    if (
      url.hostname.toLowerCase() === "maps.app.goo.gl" ||
      url.hostname.toLowerCase() === "goo.gl"
    ) {
      return false;
    }
    if (url.pathname !== "/maps" && url.pathname !== "/maps/") return false;
    return (
      !url.searchParams.has("q") &&
      !url.searchParams.has("dir") &&
      !url.pathname.includes("/place") &&
      !/@-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

export function locationMapQuery(location: EventLocation): string | null {
  if (
    location.location_lat !== null &&
    location.location_lat !== undefined &&
    location.location_lng !== null &&
    location.location_lng !== undefined
  ) {
    return `${location.location_lat},${location.location_lng}`;
  }
  return nonEmpty(location.location_address);
}

export function googleMapsSearchUrl(location: EventLocation): string | null {
  const link = nonEmpty(location.location_link);
  if (link) return link;
  const query = locationMapQuery(location);
  return query
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
    : null;
}

export function googleMapsDirectionsUrl(location: EventLocation): string | null {
  const query = locationMapQuery(location);
  return query
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`
    : null;
}

export function googleMapsEmbedUrl(location: EventLocation, embedKey?: string): string | null {
  const query = locationMapQuery(location);
  if (!query) return null;
  const encoded = encodeURIComponent(query);
  const key = embedKey?.trim();
  return key
    ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encoded}`
    : `https://www.google.com/maps?q=${encoded}&output=embed`;
}

export function hasOnlyShortMapLink(location: EventLocation): boolean {
  const link = nonEmpty(location.location_link);
  return (
    !!link &&
    /^https:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps)(?:\/|$)/i.test(link) &&
    !locationMapQuery(location)
  );
}
