import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import path from "node:path";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import { getUser } from "../lib/auth.js";
import { getPublicApiBase, saveImageBuffer, uploadsDirectory } from "../lib/local-media.js";

export async function serveMediaFile(req: FastifyRequest, reply: FastifyReply) {
  const { filename } = req.params as { filename: string };
  if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return reply.status(400).send({ error: "Invalid filename" });
  }

  const filePath = path.join(uploadsDirectory(), filename);
  try {
    await access(filePath);
  } catch {
    return reply.status(404).send({ error: "File not found" });
  }

  const ext = path.extname(filename).toLowerCase();
  const MIME_BY_EXT: Record<string, string> = {
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".3gp": "video/3gpp",
    ".avi": "video/x-msvideo",
    ".mpeg": "video/mpeg",
  };
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";

  return reply.type(mime).send(createReadStream(filePath));
}

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/quicktime",
  "video/3gpp",
  "video/x-msvideo",
  "video/mpeg",
]);

export async function mediaRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/config", async () => {
    const publicBase = getPublicApiBase();
    const isLocalhost = /localhost|127\.0\.0\.1/i.test(publicBase);
    return {
      enabled: true,
      publicBase,
      maxMb: Number(process.env.MEDIA_MAX_BYTES ?? 10 * 1024 * 1024) / 1024 / 1024,
      whatsappPhotoNote: isLocalhost
        ? "Set PUBLIC_API_URL in apps/api/.env to your PC LAN IP or domain so WhatsApp API can load photos (e.g. http://192.168.1.5:4000)."
        : "Photos upload on this server and send via your WhatsApp API.",
    };
  });

  app.post("/upload", async (req, reply) => {
    getUser(req);
    const file = await req.file();
    if (!file) return reply.status(400).send({ error: "Choose a photo first" });

    if (!ALLOWED_MIME.has(file.mimetype)) {
      return reply.status(400).send({
        error: "Only photo (JPG/PNG/WEBP/GIF) or video (MP4/MOV/AVI/3GP/MPEG) allowed",
      });
    }

    try {
      const buffer = await file.toBuffer();
      const saved = await saveImageBuffer(buffer, file.mimetype, file.filename);
      return {
        url: saved.url,
        filename: saved.filename,
        publicBase: getPublicApiBase(),
      };
    } catch (e) {
      return reply.status(400).send({
        error: e instanceof Error ? e.message : "Upload failed",
      });
    }
  });
}
