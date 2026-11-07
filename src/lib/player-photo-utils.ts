const PHOTO_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpe?g|webp)$/;

export function isPlayerPhotoStoragePath(value: string | null): value is string {
  return value !== null && PHOTO_PATH_PATTERN.test(value);
}

export function getPlayerPhotoExtension(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  throw new Error("A foto precisa ser PNG, JPEG ou WebP.");
}

export function decodePlayerPhotoDataUrl(dataUrl: string): { blob: Blob; extension: string } {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new Error("A foto enviada não está em um formato válido.");

  const mimeType = match[1];
  const encoded = match[2];
  if (!mimeType || !encoded) throw new Error("A foto enviada não está em um formato válido.");

  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes.buffer], { type: mimeType });
  if (blob.size > 512 * 1024) {
    throw new Error("A foto precisa ter no máximo 512 KB. Escolha uma imagem menor.");
  }
  return { blob, extension: getPlayerPhotoExtension(mimeType) };
}
