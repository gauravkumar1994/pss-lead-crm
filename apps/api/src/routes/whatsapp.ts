import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { WhatsAppProvider, ActivityType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser } from "../lib/auth.js";
import { WHATSAPP_PROVIDER_REGISTRY } from "../whatsapp/provider-registry.js";
import {
  dispatchWhatsAppMessage,
  integrationFromDb,
} from "../whatsapp/dispatcher.js";

const saveIntegrationSchema = z.object({
  provider: z.nativeEnum(WhatsAppProvider),
  instanceId: z.string().min(1),
  accessToken: z.string().min(1),
  baseUrl: z.string().url().optional().nullable(),
  phone: z.string().optional(),
  dailyLimit: z.number().int().positive().optional(),
});

const sendSchema = z.object({
  leadId: z.string(),
  message: z.string().min(1),
  mediaUrl: z.string().url().optional().nullable(),
});

export async function whatsappRoutes(app: FastifyInstance) {
  app.get("/providers", async () => ({
    providers: WHATSAPP_PROVIDER_REGISTRY,
  }));

  app.addHook("onRequest", app.authenticate);

  app.get("/integration", async (req) => {
    const user = getUser(req);
    const row = await prisma.userWhatsAppIntegration.findUnique({
      where: { userId: user.id },
    });
    if (!row) return { integration: null };
    return {
      integration: {
        provider: row.provider,
        instanceId: row.instanceId,
        baseUrl: row.baseUrl,
        phone: row.phone,
        dailyLimit: row.dailyLimit,
        status: row.status,
        hasToken: Boolean(row.accessToken),
      },
    };
  });

  app.put("/integration", async (req, reply) => {
    const user = getUser(req);
    const body = saveIntegrationSchema.parse(req.body);

    if (body.provider === "EVOLUTION" && !body.baseUrl) {
      return reply.status(400).send({ error: "baseUrl required for Evolution API" });
    }

    const row = await prisma.userWhatsAppIntegration.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        provider: body.provider,
        instanceId: body.instanceId,
        accessToken: body.accessToken,
        baseUrl: body.baseUrl ?? null,
        phone: body.phone,
        dailyLimit: body.dailyLimit ?? 1000,
      },
      update: {
        provider: body.provider,
        instanceId: body.instanceId,
        accessToken: body.accessToken,
        baseUrl: body.baseUrl ?? null,
        phone: body.phone,
        dailyLimit: body.dailyLimit ?? 1000,
      },
    });

    return {
      integration: {
        provider: row.provider,
        instanceId: row.instanceId,
        status: row.status,
      },
    };
  });

  app.post("/test", async (req, reply) => {
    const user = getUser(req);
    const { to, message } = z
      .object({ to: z.string(), message: z.string().default("PSS CRM test message") })
      .parse(req.body);

    const row = await prisma.userWhatsAppIntegration.findUnique({
      where: { userId: user.id },
    });
    if (!row) return reply.status(400).send({ error: "Configure WhatsApp integration first" });

    const result = await dispatchWhatsAppMessage(integrationFromDb(row), {
      to,
      message,
    });
    return result;
  });

  app.post("/send", async (req, reply) => {
    const user = getUser(req);
    const body = sendSchema.parse(req.body);

    const [lead, integration] = await Promise.all([
      prisma.lead.findUnique({ where: { id: body.leadId } }),
      prisma.userWhatsAppIntegration.findUnique({ where: { userId: user.id } }),
    ]);

    if (!lead) return reply.status(404).send({ error: "Lead not found" });
    if (!integration) return reply.status(400).send({ error: "WhatsApp not configured" });

    const result = await dispatchWhatsAppMessage(integrationFromDb(integration), {
      to: lead.mobile,
      message: body.message,
      mediaUrl: body.mediaUrl,
    });

    if (result.success) {
      await prisma.$transaction([
        prisma.lead.update({
          where: { id: lead.id },
          data: {
            whatsappCount: { increment: 1 },
            lastWhatsappAt: new Date(),
          },
        }),
        prisma.activity.create({
          data: {
            leadId: lead.id,
            userId: user.id,
            type: ActivityType.WHATSAPP,
            remarkType: body.mediaUrl ? "Image" : "Text",
            content: body.mediaUrl
              ? `[Photo] ${body.message.slice(0, 450)}`
              : body.message.slice(0, 500),
          },
        }),
        prisma.userWhatsAppIntegration.update({
          where: { userId: user.id },
          data: { sentToday: { increment: 1 }, lastUsedAt: new Date() },
        }),
      ]);
    }

    return result;
  });

  app.get("/recent", async (req) => {
    const user = getUser(req);
    const items = await prisma.activity.findMany({
      where: { userId: user.id, type: ActivityType.WHATSAPP },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            mobile: true,
            city: true,
            leadCode: true,
            whatsappCount: true,
          },
        },
      },
    });
    return { items };
  });
}
