import { describe, expect, it } from "vitest";
import {
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
  hasOnlyShortMapLink,
  isAllowedGoogleMapsLink,
} from "./event-location";

describe("event-location", () => {
  it.each([
    "https://google.com/maps",
    "https://www.google.com/maps/search/?api=1&query=quadra",
    "https://maps.google.com/?q=quadra",
    "https://maps.app.goo.gl/abc123",
    "https://goo.gl/maps/abc123",
  ])("aceita link permitido: %s", (link) => expect(isAllowedGoogleMapsLink(link)).toBe(true));

  it.each([
    "javascript:alert(1)",
    "http://google.com/maps",
    "https://google.com.evil.com/maps",
    "https://evil.com/maps",
    "https://user@google.com/maps",
    "https://goo.gl/other/abc",
  ])("rejeita link perigoso: %s", (link) => expect(isAllowedGoogleMapsLink(link)).toBe(false));

  const location = { location_address: "Rua A, 10 - São Paulo" };

  it("monta busca, direções e embed com endereço escapado", () => {
    expect(googleMapsSearchUrl(location)).toContain(encodeURIComponent(location.location_address));
    expect(googleMapsDirectionsUrl(location)).toContain(
      encodeURIComponent(location.location_address),
    );
    expect(googleMapsEmbedUrl(location)).toBe(
      `https://www.google.com/maps?q=${encodeURIComponent(location.location_address)}&output=embed`,
    );
  });

  it("prioriza coordenadas e chave oficial no embed", () => {
    const withCoordinates = { location_lat: -23.55, location_lng: -46.63 };
    expect(googleMapsEmbedUrl(withCoordinates, "key test")).toBe(
      "https://www.google.com/maps/embed/v1/place?key=key%20test&q=-23.55%2C-46.63",
    );
  });

  it("não resolve link curto sem dados para mapa", () => {
    const shortLink = { location_link: "https://maps.app.goo.gl/abc" };
    expect(hasOnlyShortMapLink(shortLink)).toBe(true);
    expect(googleMapsEmbedUrl(shortLink)).toBeNull();
    expect(googleMapsDirectionsUrl(shortLink)).toBeNull();
  });
});
