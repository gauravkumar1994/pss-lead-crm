import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

const UPLOAD_DIR = path.resolve(
  process.env.MEDIA_UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads")
);

const ALLOWED_MIME = new Set([
  // images
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  // videos (Smart Bulk Automation — user browses & attaches video too)
  "video/mp4",
  "video/quicktime",
  "video/3gpp",
  "video/x-msvideo",
  "video/mpeg",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/3gpp": ".3gp",
  "video/x-msvideo": ".avi",
  "video/mpeg": ".mpeg",
};

export function getPublicApiBase(): string {
  const base = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.API_PORT ?? 4000}`;
  return base.replace(/\/$/, "");
}

export function publicMediaUrl(filename: string): string {
  return `${getPublicApiBase()}/media/files/${filename}`;
}

export async function saveImageBuffer(
  buffer: Buffer,
  mimeType: string,
  originalName?: string
): Promise<{ filename: string; url: string; mimeType: string }> {
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new Error("Only JPG, PNG, WEBP, GIF photos or MP4, MOV, AVI, 3GP, MPEG videos allowed.");
  }

  const maxBytes = Number(process.env.MEDIA_MAX_BYTES ?? 10 * 1024 * 1024);
  if (buffer.length > maxBytes) {
    throw new Error(`File too large. Max ${Math.round(maxBytes / 1024 / 1024)}MB.`);
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext =
    EXT_BY_MIME[mimeType] ??
    (originalName?.match(/\.[a-z0-9]+$/i)?.[0]?.toLowerCase() || ".jpg");
  const filename = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  await writeFile(filePath, buffer);

  return {
    filename,
    url: publicMediaUrl(filename),
    mimeType,
  };
}

export function uploadsDirectory(): string {
  return UPLOAD_DIR;
}
