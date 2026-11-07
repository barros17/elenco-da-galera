const ALLOWED_HOSTS = new Set([
  "google.com",
  "www.google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "goo.gl",
]);

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
    if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(host) || url.username || url.password) {
      return false;
    }
    return host !== "goo.gl" || url.pathname === "/maps" || url.pathname.startsWith("/maps/");
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
