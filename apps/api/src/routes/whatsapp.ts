import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { WhatsAppProvider, ActivityType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import {
  WHATSAPP_PROVIDER_REGISTRY,
  getProviderMeta,
} from "../whatsapp/provider-registry.js";
import {
  dispatchWhatsAppMessage,
  integrationFromDb,
} from "../whatsapp/dispatcher.js";

const saveIntegrationSchema = z.object({
  provider: z.nativeEnum(WhatsAppProvider),
  instanceId: z.string().min(1),
  accessToken: z.string().optional(),
  baseUrl: z.string().url().optional().nullable(),
  phone: z.string().optional(),
  dailyLimit: z.number().int().positive().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const sendSchema = z.object({
  leadId: z.string(),
  message: z.string().min(1),
  mediaUrl: z.string().url().optional().nullable(),
});

function integrationSummary(row: {
  provider: WhatsAppProvider;
  instanceId: string;
  baseUrl: string | null;
  phone: string | null;
  dailyLimit: number;
  sentToday: number;
  status: string;
  lastUsedAt: Date | null;
  accessToken: string;
}) {
  const meta = getProviderMeta(row.provider);
  return {
    provider: row.provider,
    providerLabel: meta?.label ?? row.provider,
    instanceId: row.instanceId,
    baseUrl: row.baseUrl,
    phone: row.phone,
    dailyLimit: row.dailyLimit,
    sentToday: row.sentToday,
    status: row.status,
    lastUsedAt: row.lastUsedAt,
    hasToken: Boolean(row.accessToken),
    configured: true,
  };
}

function myAssignmentView(row: {
  provider: WhatsAppProvider;
  dailyLimit: number;
  sentToday: number;
  status: string;
  lastUsedAt: Date | null;
} | null) {
  if (!row) {
    return {
      configured: false,
      provider: null,
      providerLabel: null,
      dailyLimit: 0,
      sentToday: 0,
      status: "not_configured",
      lastUsedAt: null,
      message:
        "WhatsApp API abhi assign nahi hua. Admin se contact karein.",
    };
  }
  const meta = getProviderMeta(row.provider);
  return {
    configured: true,
    provider: row.provider,
    providerLabel: meta?.label ?? row.provider,
    providerDescription: meta?.description ?? "",
    dailyLimit: row.dailyLimit,
    sentToday: row.sentToday,
    status: row.status,
    lastUsedAt: row.lastUsedAt,
    message: null,
  };
}

export async function whatsappRoutes(app: FastifyInstance) {
  app.get("/providers", async () => ({
    providers: WHATSAPP_PROVIDER_REGISTRY,
  }));

  app.addHook("onRequest", app.authenticate);

  /** Read-only: assigned API (SalesNayak style — user cannot change) */
  app.get("/my-assignment", async (req) => {
    const user = getUser(req);
    const row = await prisma.userWhatsAppIntegration.findUnique({
      where: { userId: user.id },
    });
    return { assignment: myAssignmentView(row) };
  });

  /** @deprecated Use GET /my-assignment — kept for compatibility, no secrets for non-admin */
  app.get("/integration", async (req) => {
    const user = getUser(req);
    const row = await prisma.userWhatsAppIntegration.findUnique({
      where: { userId: user.id },
    });
    if (!row) return { integration: null };
    if (user.role !== Role.ADMIN) {
      return { integration: myAssignmentView(row) };
    }
    return { integration: integrationSummary(row) };
  });

  /** Only ADMIN may save own integration via legacy route */
  app.put("/integration", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const body = saveIntegrationSchema.parse(req.body);

    if (body.provider === "EVOLUTION" && !body.baseUrl) {
      return reply.status(400).send({ error: "baseUrl required for Evolution API" });
    }

    const existing = await prisma.userWhatsAppIntegration.findUnique({
      where: { userId: user.id },
    });
    const token = body.accessToken?.trim() || existing?.accessToken;
    if (!token) {
      return reply.status(400).send({ error: "Access token is required" });
    }

    const row = await prisma.userWhatsAppIntegration.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        provider: body.provider,
        instanceId: body.instanceId,
        accessToken: token,
        baseUrl: body.baseUrl ?? null,
        phone: body.phone,
        dailyLimit: body.dailyLimit ?? 1000,
        status: body.status ?? "active",
      },
      update: {
        provider: body.provider,
        instanceId: body.instanceId,
        accessToken: token,
        baseUrl: body.baseUrl ?? null,
        phone: body.phone,
        dailyLimit: body.dailyLimit ?? 1000,
        status: body.status ?? "active",
      },
    });

    return { integration: integrationSummary(row) };
  });

  /** Admin: all users including admin — full WhatsApp settings list */
  app.get("/admin/integrations", async (req) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);

    const users = await prisma.user.findMany({
      orderBy: [{ status: "asc" }, { fullName: "asc" }],
      select: {
        id: true,
        userCode: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        whatsappIntegration: true,
      },
    });

    return {
      items: users.map((u) => ({
        userId: u.id,
        userCode: u.userCode,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        userStatus: u.status,
        integration: u.whatsappIntegration
          ? integrationSummary(u.whatsappIntegration)
          : null,
      })),
      providers: WHATSAPP_PROVIDER_REGISTRY,
    };
  });

  /** Admin: edit form for one user */
  app.get("/admin/integrations/:userId", async (req, reply) => {
    const admin = getUser(req);
    requireRoles(admin, [Role.ADMIN]);
    const { userId } = req.params as { userId: string };

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        userCode: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        whatsappIntegration: true,
      },
    });
    if (!target) return reply.status(404).send({ error: "User not found" });

    return {
      user: {
        id: target.id,
        userCode: target.userCode,
        username: target.username,
        fullName: target.fullName,
        role: target.role,
        status: target.status,
      },
      integration: target.whatsappIntegration
        ? integrationSummary(target.whatsappIntegration)
        : null,
      providers: WHATSAPP_PROVIDER_REGISTRY,
    };
  });

  /** Admin: assign provider + credentials for any user */
  app.put("/admin/integrations/:userId", async (req, reply) => {
    const admin = getUser(req);
    requireRoles(admin, [Role.ADMIN]);
    const { userId } = req.params as { userId: string };
    const body = saveIntegrationSchema.parse(req.body);

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return reply.status(404).send({ error: "User not found" });

    if (body.provider === "EVOLUTION" && !body.baseUrl) {
      return reply.status(400).send({ error: "baseUrl required for Evolution API" });
    }

    const existing = await prisma.userWhatsAppIntegration.findUnique({
      where: { userId },
    });
    const token = body.accessToken?.trim() || existing?.accessToken;
    if (!token) {
      return reply.status(400).send({ error: "Access token is required" });
    }

    const row = await prisma.userWhatsAppIntegration.upsert({
      where: { userId },
      create: {
        userId,
        provider: body.provider,
        instanceId: body.instanceId,
        accessToken: token,
        baseUrl: body.baseUrl ?? null,
        phone: body.phone,
        dailyLimit: body.dailyLimit ?? 1000,
        status: body.status ?? "active",
      },
      update: {
        provider: body.provider,
        instanceId: body.instanceId,
        accessToken: token,
        baseUrl: body.baseUrl ?? null,
        phone: body.phone,
        dailyLimit: body.dailyLimit ?? 1000,
        status: body.status ?? "active",
      },
    });

    return { integration: integrationSummary(row) };
  });

  app.post("/admin/integrations/:userId/test", async (req, reply) => {
    const admin = getUser(req);
    requireRoles(admin, [Role.ADMIN]);
    const { userId } = req.params as { userId: string };
    const { to, message } = z
      .object({ to: z.string(), message: z.string().default("PSS CRM test message") })
      .parse(req.body);

    const row = await prisma.userWhatsAppIntegration.findUnique({
      where: { userId },
    });
    if (!row) {
      return reply.status(400).send({ error: "WhatsApp not configured for this user" });
    }

    const result = await dispatchWhatsAppMessage(integrationFromDb(row), {
      to,
      message,
    });
    return result;
  });

  app.post("/test", async (req, reply) => {
    const user = getUser(req);
    const { to, message } = z
      .object({ to: z.string(), message: z.string().default("PSS CRM test message") })
      .parse(req.body);

    const row = await prisma.userWhatsAppIntegration.findUnique({
      where: { userId: user.id },
    });
    if (!row) {
      return reply
        .status(400)
        .send({ error: "WhatsApp API assign nahi hua. Admin se contact karein." });
    }

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
    if (!integration) {
      return reply
        .status(400)
        .send({ error: "WhatsApp API assign nahi hua. Admin se contact karein." });
    }
    if (integration.status !== "active") {
      return reply.status(400).send({ error: "WhatsApp API is inactive. Contact admin." });
    }

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
