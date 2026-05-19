import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import { authRoutes } from "./routes/auth.js";
import { leadRoutes } from "./routes/leads.js";
import { callRoutes } from "./routes/calls.js";
import { whatsappRoutes } from "./routes/whatsapp.js";
import { campaignRoutes } from "./routes/campaigns.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { userRoutes } from "./routes/users.js";
import { followupRoutes } from "./routes/followups.js";
import { templateRoutes } from "./routes/templates.js";
import { mediaRoutes, serveMediaFile } from "./routes/media.js";
import { startCampaignWorker } from "./worker/queue.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? "dev-secret-change-me",
    sign: { expiresIn: process.env.JWT_EXPIRES_IN ?? "7d" },
  });

  await app.register(multipart, {
    limits: { fileSize: Number(process.env.MEDIA_MAX_BYTES ?? 10 * 1024 * 1024) },
  });

  app.decorate("authenticate", async (req, reply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.status(401).send({ error: "Unauthorized" });
    }
  });

  app.setErrorHandler((err, _req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    reply.status(status).send({
      error: err.message ?? "Internal error",
    });
  });

  app.get("/health", async () => ({ ok: true }));

  /** Public — WhatsApp providers download photos from here */
  app.get("/media/files/:filename", serveMediaFile);

  await app.register(authRoutes, { prefix: "/auth" });
  await app.register(leadRoutes, { prefix: "/leads" });
  await app.register(callRoutes, { prefix: "/calls" });
  await app.register(whatsappRoutes, { prefix: "/whatsapp" });
  await app.register(campaignRoutes, { prefix: "/campaigns" });
  await app.register(dashboardRoutes, { prefix: "/dashboard" });
  await app.register(userRoutes, { prefix: "/users" });
  await app.register(followupRoutes, { prefix: "/followups" });
  await app.register(templateRoutes, { prefix: "/templates" });
  await app.register(mediaRoutes, { prefix: "/media" });

  startCampaignWorker();

  return app;
}
