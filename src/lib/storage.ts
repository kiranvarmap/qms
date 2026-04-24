import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import path from "path";
import { logger } from "@/lib/logger";

// ── Client ────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET  = process.env.AWS_S3_BUCKET!;
const CDN_URL = process.env.AWS_S3_CDN_URL?.replace(/\/$/, ""); // optional CloudFront URL

function publicUrl(key: string): string {
  return CDN_URL
    ? `${CDN_URL}/${key}`
    : `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

// ── Upload ────────────────────────────────────────────────────────────
export interface UploadResult {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

/**
 * Upload a buffer to S3 and return the public URL + key.
 * Uses multipart upload via @aws-sdk/lib-storage for reliability on large files.
 */
export async function uploadToS3(
  file: Buffer | Uint8Array,
  originalName: string,
  contentType: string,
  folder = "uploads"
): Promise<UploadResult> {
  const ext = path.extname(originalName).toLowerCase();
  const key = `${folder}/${randomUUID()}${ext}`;

  const upload = new Upload({
    client: s3,
    params: {
      Bucket:               BUCKET,
      Key:                  key,
      Body:                 file,
      ContentType:          contentType,
      ServerSideEncryption: "AES256",
      // Objects are private by default — use presigned URLs or CloudFront for access
    },
  });

  await upload.done();

  logger.info("File uploaded to S3", { key, size: file.byteLength, contentType });

  return { key, url: publicUrl(key), size: file.byteLength, contentType };
}

// ── Delete ────────────────────────────────────────────────────────────
export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  logger.info("File deleted from S3", { key });
}

// ── Presigned URL (for private objects) ───────────────────────────────
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn }
  );
}

// ── Head (check existence) ────────────────────────────────────────────
export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract the S3 key from a stored URL or return the raw value if it's already a key.
 * Handles both CDN URLs and direct S3 URLs.
 */
export function urlToKey(urlOrKey: string): string {
  if (urlOrKey.startsWith("http")) {
    try {
      const { pathname } = new URL(urlOrKey);
      // Remove leading slash
      return pathname.replace(/^\//, "");
    } catch {
      return urlOrKey;
    }
  }
  return urlOrKey;
}
