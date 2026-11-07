import { describe, expect, it } from "vitest";
import {
  decodePlayerPhotoDataUrl,
  getPlayerPhotoExtension,
  isPlayerPhotoStoragePath,
} from "./player-photo-utils";

describe("player photo storage helpers", () => {
  it("recognizes only player photo object paths", () => {
    expect(
      isPlayerPhotoStoragePath(
        "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.png",
      ),
    ).toBe(true);
    expect(isPlayerPhotoStoragePath("data:image/png;base64,aGVsbG8=")).toBe(false);
    expect(isPlayerPhotoStoragePath(null)).toBe(false);
  });

  it("maps supported image types to storage extensions", () => {
    expect(getPlayerPhotoExtension("image/png")).toBe("png");
    expect(getPlayerPhotoExtension("image/jpeg")).toBe("jpg");
    expect(getPlayerPhotoExtension("image/webp")).toBe("webp");
    expect(() => getPlayerPhotoExtension("image/gif")).toThrow("PNG, JPEG ou WebP");
  });

  it("decodes a supported data URL and enforces the bucket limit", () => {
    const { blob, extension } = decodePlayerPhotoDataUrl("data:image/png;base64,aGVsbG8=");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBe(5);
    expect(extension).toBe("png");

    const overLimitDataUrl = `data:image/png;base64,${"A".repeat(699052)}`;
    expect(() => decodePlayerPhotoDataUrl(overLimitDataUrl)).toThrow("no máximo 512 KB");
    expect(() => decodePlayerPhotoDataUrl("data:image/svg+xml;base64,PHN2Zz4=")).toThrow(
      "formato válido",
    );
  });
});
