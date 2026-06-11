import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { randomUUID } from "crypto";
import path from "path";
import { logger } from "@/lib/logger";

// ── Azure Blob Storage (server-side object storage) ───────────────────
// Configured via AZURE_STORAGE_CONNECTION_STRING (account-level connection
// string). Container defaults to "uploads". The client is built lazily on
// first use so the module can be imported during `next build` without secrets.
const CONTAINER = process.env.AZURE_STORAGE_CONTAINER || "uploads";

let _container: ContainerClient | null = null;
async function container(): Promise<ContainerClient> {
  if (_container) return _container;
  const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!conn) {
    throw new Error(
      "Azure Blob storage is not configured. Set AZURE_STORAGE_CONNECTION_STRING."
    );
  }
  const service = BlobServiceClient.fromConnectionString(conn);
  const client = service.getContainerClient(CONTAINER);
  // Ensure the container exists with public blob read (parity with prior setup).
  await client.createIfNotExists({ access: "blob" });
  _container = client;
  return _container;
}

// ── Upload ────────────────────────────────────────────────────────────
export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

/**
 * Upload a buffer to Azure Blob Storage and return the public URL + key.
 * Signature preserved from the previous (Supabase/S3) implementation so
 * callers are unchanged. `key` is the blob name (folder/uuid.ext).
 */
export async function uploadToS3(
  file: Buffer | Uint8Array,
  originalName: string,
  contentType: string,
  folder = "uploads"
): Promise<UploadResult> {
  const c = await container();

  const ext = path.extname(originalName).toLowerCase();
  const key = `${folder}/${randomUUID()}${ext}`;

  const block = c.getBlockBlobClient(key);
  const body = Buffer.isBuffer(file) ? file : Buffer.from(file);
  await block.uploadData(body, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  logger.info("File uploaded to Azure Blob Storage", {
    key,
    size: body.byteLength,
    contentType,
  });

  return { key, url: block.url, size: body.byteLength, contentType };
}

// ── Delete ────────────────────────────────────────────────────────────
export async function deleteFromStorage(key: string): Promise<void> {
  const c = await container();
  await c.getBlockBlobClient(key).deleteIfExists();
  logger.info("File deleted from Azure Blob Storage", { key });
}

// ── Check existence ──────────────────────────────────────────────────
export async function objectExists(filePath: string): Promise<boolean> {
  try {
    const c = await container();
    return await c.getBlockBlobClient(filePath).exists();
  } catch {
    return false;
  }
}

/**
 * Extract the storage key from a stored URL, or return the raw value if it's
 * already a key. Handles Azure Blob URLs:
 *   https://<account>.blob.core.windows.net/<container>/<key>
 */
export function urlToKey(urlOrKey: string): string {
  if (urlOrKey.startsWith("http")) {
    try {
      const { pathname } = new URL(urlOrKey);
      const marker = `/${CONTAINER}/`;
      const idx = pathname.indexOf(marker);
      if (idx !== -1) return pathname.slice(idx + marker.length);
      return pathname.replace(/^\//, "");
    } catch {
      return urlOrKey;
    }
  }
  return urlOrKey;
}
