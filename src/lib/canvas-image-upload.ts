// Uploads a pasted/dropped image to Supabase Storage and returns its public URL.
// Embedding images as data: URIs in the project row makes every save multi-MB
// (and the dashboard listing detoast them), so callers should only fall back to
// a data URI when this returns null.

const BUCKET = 'canvas-uploads';
const MAX_WIDTH = 1600;

export interface UploadedCanvasImage {
  url: string;
  width: number;
  height: number;
  bytes: number;
}

function loadImage(file: Blob): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = document.createElement('img');
    img.onload = () => resolve({ img, revoke: () => URL.revokeObjectURL(objectUrl) });
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('image decode failed'));
    };
    img.src = objectUrl;
  });
}

/** Returns null on any failure (including the free-tier size cap) so the caller can fall back. */
export async function uploadCanvasImage(
  file: Blob,
  baseName: string,
  uploadMaxBytes: number | null | undefined,
): Promise<UploadedCanvasImage | null> {
  try {
    // Animated formats must go up unchanged: canvas re-encoding keeps only frame one.
    const isAnimated = file.type === 'image/gif' || file.type === 'image/webp';
    const { img, revoke } = await loadImage(file);
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;
    let blob: Blob = file;
    let ext = file.type === 'image/gif' ? 'gif' : 'webp';
    let contentType = file.type;

    if (!isAnimated) {
      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      const encoded = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/webp', 0.8),
      );
      if (!encoded) {
        revoke();
        return null;
      }
      blob = encoded;
      ext = 'webp';
      contentType = 'image/webp';
    }
    revoke();

    if (uploadMaxBytes != null && blob.size > uploadMaxBytes) return null;

    const supabase = (await import('../../supabase/client')).createClient();
    const safeName = baseName.replace(/\.[^/.]+$/, '').replace(/[^\w-]+/g, '_') || 'pasted';
    const path = `canvas-images/${Date.now()}-${safeName}.${ext}`;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .upload(path, blob, { contentType, cacheControl: '3600' });
    if (error || !data) return null;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
    return { url: urlData.publicUrl, width: Math.round(width), height: Math.round(height), bytes: blob.size };
  } catch {
    return null;
  }
}
