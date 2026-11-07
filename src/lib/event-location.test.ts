import { describe, expect, it } from "vitest";
import {
  googleMapsDirectionsUrl,
  googleMapsEmbedUrl,
  googleMapsSearchUrl,
  hasOnlyShortMapLink,
  isGenericGoogleMapsLink,
  isAllowedGoogleMapsLink,
} from "./event-location";

describe("event-location", () => {
  it.each([
    "https://www.google.com.br/maps/?hl=pt-BR",
    "https://www.google.com.br/maps/place/Quadra",
    "https://google.com/maps?q=-23.55,-46.63",
    "https://maps.google.com.br/?q=quadra",
    "https://maps.app.goo.gl/abc123",
    "https://goo.gl/maps/abc123",
    "https://www.google.pt/maps/place/Lisboa",
  ])("aceita link permitido: %s", (link) => expect(isAllowedGoogleMapsLink(link)).toBe(true));

  it.each([
    "javascript:alert(1)",
    "http://google.com/maps",
    "https://google.com.evil.com/maps",
    "https://evilgoogle.com.br/maps",
    "https://www.google.com.br@evil.com/maps",
    "https://www.google.com.br:8080/maps",
    "https://www.google.com.br/search?q=x",
    "https://goo.gl/abc",
    "data:text/html,x",
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

  it("identifica link genérico sem rejeitá-lo", () => {
    expect(isGenericGoogleMapsLink("https://www.google.com.br/maps/?hl=pt-BR")).toBe(true);
    expect(isGenericGoogleMapsLink("https://www.google.com.br/maps/place/Quadra")).toBe(false);
    expect(isGenericGoogleMapsLink("https://google.com/maps?q=quadra")).toBe(false);
  });
});
