/**
 * Downscales a photo in the browser before it's sent to a Server Action —
 * phone camera photos can be 4000px+ across and several MB, well past the
 * framework's default request-body limit, and a 1600px JPEG reads just as
 * well for OCR purposes as the original.
 */
export async function fileToResizedDataUrl(
  file: File,
  maxDim = 1600,
  quality = 0.82
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't process images.");
    ctx.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close();
  }
}
