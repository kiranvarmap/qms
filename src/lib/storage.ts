import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import path from "path";
import { logger } from "@/lib/logger";

// ── Supabase Client (service-role for server-side storage ops) ────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET = "uploads";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function publicUrl(filePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

// ── Ensure bucket exists ──────────────────────────────────────────────
let bucketReady = false;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 20 * 1024 * 1024, // 20 MB
  });
  // Bucket already exists is fine
  if (error && !error.message.includes("already exists")) {
    logger.error("Failed to create storage bucket", { error: error.message });
    throw error;
  }
  bucketReady = true;
}

// ── Upload ────────────────────────────────────────────────────────────
export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

/**
 * Upload a buffer to Supabase Storage and return the public URL + key.
 */
export async function uploadToS3(
  file: Buffer | Uint8Array,
  originalName: string,
  contentType: string,
  folder = "uploads"
): Promise<UploadResult> {
  await ensureBucket();

  const ext = path.extname(originalName).toLowerCase();
  const key = `${folder}/${randomUUID()}${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, {
      contentType,
      upsert: false,
    });

  if (error) {
    logger.error("Supabase Storage upload failed", { error: error.message, key });
    throw new Error(`Upload failed: ${error.message}`);
  }

  const url = publicUrl(key);
  logger.info("File uploaded to Supabase Storage", { key, size: file.byteLength, contentType });

  return { key, url, size: file.byteLength, contentType };
}

// ── Delete ────────────────────────────────────────────────────────────
export async function deleteFromStorage(key: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([key]);
  if (error) {
    logger.error("Supabase Storage delete failed", { error: error.message, key });
    throw error;
  }
  logger.info("File deleted from Supabase Storage", { key });
}

// ── Check existence ──────────────────────────────────────────────────
export async function objectExists(filePath: string): Promise<boolean> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(path.dirname(filePath), {
      search: path.basename(filePath),
      limit: 1,
    });
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/**
 * Extract the storage key from a stored URL or return the raw value if it's already a key.
 */
export function urlToKey(urlOrKey: string): string {
  if (urlOrKey.startsWith("http")) {
    try {
      const { pathname } = new URL(urlOrKey);
      // Supabase public URLs: /storage/v1/object/public/uploads/<key>
      const marker = `/object/public/${BUCKET}/`;
      const idx = pathname.indexOf(marker);
      if (idx !== -1) {
        return pathname.slice(idx + marker.length);
      }
      return pathname.replace(/^\//, "");
    } catch {
      return urlOrKey;
    }
  }
  return urlOrKey;
}
