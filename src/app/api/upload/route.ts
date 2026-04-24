import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToS3 } from "@/lib/storage";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "@/lib/validations";
import { unauthorized, badRequest, serverError } from "@/lib/api";
import { logger } from "@/lib/logger";

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return unauthorized();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) return badRequest("No file provided");
    if (file.size > MAX_UPLOAD_BYTES) return badRequest("File too large. Max 10 MB");
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return badRequest("File type not allowed", { allowed: [...ALLOWED_MIME_TYPES] });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToS3(buffer, file.name, file.type, "uploads");

    logger.info("File uploaded", { userId: session.user.id, key: result.key, size: result.size });

    return NextResponse.json({
      url:  result.url,
      key:  result.key,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (err) {
    logger.error("Upload failed", { error: String(err) });
    return serverError("Upload failed. Please try again.");
  }
}
