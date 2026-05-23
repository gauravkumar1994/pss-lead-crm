import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CampaignStatus, LeadStage, LeadType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";
import { enqueueCampaign } from "../worker/queue.js";

export const MAX_BULK_SIZE = 50;

const filterSchema = z.object({
  stage: z.nativeEnum(LeadStage).optional(),
  leadType: z.nativeEnum(LeadType).optional(),
  city: z.string().optional(),
  assignedUserId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  search: z.string().optional(),
});

const prepareSchema = z.object({
  name: z.string().min(1),
  message: z.string().min(1),
  mediaUrl: z.string().url().optional().nullable(),
  leadIds: z.array(z.string()).optional(),
  filters: filterSchema.optional(),
});

function buildLeadWhere(f: z.infer<typeof filterSchema>, userId?: string, role?: string) {
  const where: Record<string, unknown> = { status: "active" };
  if (f.stage) where.stage = f.stage;
  if (f.leadType) where.leadType = f.leadType;
  if (f.city) where.city = { contains: f.city };
  if (f.assignedUserId) where.assignedUserId = f.assignedUserId;
  if (role === "USER" && userId) where.assignedUserId = userId;
  if (f.fromDate || f.toDate) {
    where.createdAt = {};
    if (f.fromDate) (where.createdAt as Record<string, Date>).gte = new Date(f.fromDate);
    if (f.toDate) (where.createdAt as Record<string, Date>).lte = new Date(f.toDate);
  }
  if (f.search) {
    where.OR = [{ name: { contains: f.search } }, { mobile: { contains: f.search } }];
  }
  return where;
}

function campaignCode(): string {
  return `C${Date.now().toString(36).toUpperCase()}`;
}

function personalize(template: string, lead: { name: string; mobile: string; city?: string | null }) {
  return template
    .replace(/\{name\}/gi, lead.name)
    .replace(/\{mobile\}/gi, lead.mobile)
    .replace(/\{city\}/gi, lead.city ?? "");
}

export async function campaignRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req) => {
    const user = getUser(req);
    const items = await prisma.campaign.findMany({
      where: { sentById: user.role === "USER" ? user.id : undefined },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { items };
  });

  app.post("/filter-leads", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN, Role.MANAGER]);
    const f = filterSchema.parse(req.body);
    const where = buildLeadWhere(f, user.id, user.role);
    const leads = await prisma.lead.findMany({
      where,
      take: MAX_BULK_SIZE + 1,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        leadCode: true,
        name: true,
        mobile: true,
        city: true,
        stage: true,
        leadType: true,
      },
    });
    if (leads.length > MAX_BULK_SIZE) {
      return reply.status(400).send({
        error: `Max ${MAX_BULK_SIZE} leads per campaign. Narrow your filters.`,
        count: leads.length,
        max: MAX_BULK_SIZE,
      });
    }
    return { items: leads, count: leads.length, max: MAX_BULK_SIZE };
  });

  app.post("/prepare", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN, Role.MANAGER]);
    const body = prepareSchema.parse(req.body);

    let leads;
    if (body.leadIds?.length) {
      if (body.leadIds.length > MAX_BULK_SIZE) {
        return reply.status(400).send({ error: `Max ${MAX_BULK_SIZE} leads per campaign` });
      }
      leads = await prisma.lead.findMany({ where: { id: { in: body.leadIds }, status: "active" } });
    } else {
      const f = body.filters ?? {};
      const where = buildLeadWhere(f, user.id, user.role);
      leads = await prisma.lead.findMany({ where, take: MAX_BULK_SIZE + 1 });
      if (leads.length > MAX_BULK_SIZE) {
        return reply.status(400).send({
          error: `Max ${MAX_BULK_SIZE} leads. ${leads.length} matched — refine filters.`,
        });
      }
    }
    const campaign = await prisma.campaign.create({
      data: {
        campaignCode: campaignCode(),
        name: body.name,
        message: body.message,
        mediaUrl: body.mediaUrl,
        status: CampaignStatus.PREPARED,
        totalLeads: leads.length,
        sentById: user.id,
        recipients: {
          create: leads.map((l) => ({
            leadId: l.id,
            mobile: l.mobile,
            personalized: personalize(body.message, l),
            userId: user.id,
          })),
        },
      },
      include: { recipients: true },
    });

    return campaign;
  });

  app.post("/:id/execute", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN, Role.MANAGER]);
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { recipients: true },
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (campaign.sentById !== user.id && user.role !== Role.ADMIN) {
      return reply.status(403).send({ error: "Only the campaign owner or admin can execute" });
    }

    await prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.SENDING, sentAt: new Date() },
    });

    await enqueueCampaign(id, user.id);

    return { ok: true, campaignId: id, queued: campaign.recipients.length };
  });

  app.get("/:id/progress", async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        totalLeads: true,
        successCount: true,
        failedCount: true,
      },
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    const pending = await prisma.campaignRecipient.count({
      where: { campaignId: id, status: "PENDING" },
    });
    const sent = await prisma.campaignRecipient.count({
      where: { campaignId: id, status: "SENT" },
    });
    const failed = await prisma.campaignRecipient.count({
      where: { campaignId: id, status: "FAILED" },
    });
    const done = pending === 0 && campaign.status !== "PREPARED" && campaign.status !== "DRAFT";
    return {
      ...campaign,
      pending,
      sent,
      failed,
      done,
      percent:
        campaign.totalLeads > 0
          ? Math.round(((sent + failed) / campaign.totalLeads) * 100)
          : 0,
    };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        recipients: {
          take: 200,
          include: { lead: { select: { name: true, leadCode: true } } },
        },
      },
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    return campaign;
  });
}
