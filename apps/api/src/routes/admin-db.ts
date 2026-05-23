import type { FastifyInstance } from "fastify";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";

/* -----------------------------------------------------------
 * Admin Database Panel — read-only DB viewer
 * Inspired by phpMyAdmin / Adminer but scoped to safe tables.
 * Admin can browse + search every table to verify data.
 * NO writes here (writes go through dedicated routes).
 * ----------------------------------------------------------- */

const ALLOWED_TABLES = [
  "users",
  "leads",
  "activities",
  "callLogs",
  "messageTemplates",
  "userWhatsAppIntegrations",
  "campaigns",
  "campaignRecipients",
  "userBulkProfiles",
  "bulkBatches",
  "bulkRecipients",
] as const;

type TableKey = (typeof ALLOWED_TABLES)[number];

function tableMeta(): {
  key: TableKey;
  label: string;
  description: string;
  searchFields: string[];
}[] {
  return [
    { key: "users", label: "Users", description: "Admin + sales team", searchFields: ["fullName", "username", "userCode"] },
    { key: "leads", label: "Leads", description: "All leads", searchFields: ["name", "mobile", "leadCode", "city"] },
    { key: "activities", label: "Activity log", description: "Every remark / WA / system event", searchFields: ["content", "remarkType"] },
    { key: "callLogs", label: "Call logs", description: "All phone calls + notes", searchFields: ["outcome", "notes"] },
    { key: "messageTemplates", label: "WhatsApp templates", description: "Saved message templates", searchFields: ["name", "body", "category"] },
    { key: "userWhatsAppIntegrations", label: "WhatsApp integrations", description: "Per-user API credentials (token masked)", searchFields: ["instanceId", "phone"] },
    { key: "campaigns", label: "Campaigns", description: "Bulk legacy campaigns", searchFields: ["name", "campaignCode"] },
    { key: "campaignRecipients", label: "Campaign recipients", description: "Per-lead delivery rows", searchFields: ["mobile"] },
    { key: "userBulkProfiles", label: "Bulk automation profiles", description: "Per-user bulk rules + enable flag", searchFields: [] },
    { key: "bulkBatches", label: "Bulk batches", description: "Uploaded bulk send jobs", searchFields: ["batchCode", "name", "source"] },
    { key: "bulkRecipients", label: "Bulk recipients", description: "Individual mobile rows per batch", searchFields: ["mobile", "name"] },
  ];
}

/** Build OR-search where clause from searchFields */
function buildSearch(searchFields: string[], search?: string): Record<string, unknown> | undefined {
  if (!search || !searchFields.length) return undefined;
  return {
    OR: searchFields.map((f) => ({ [f]: { contains: search, mode: "insensitive" } })),
  };
}

function maskRow(table: TableKey, row: Record<string, unknown>): Record<string, unknown> {
  // Mask sensitive fields
  if (table === "users") {
    const { passwordHash, ...rest } = row;
    void passwordHash;
    return rest;
  }
  if (table === "userWhatsAppIntegrations") {
    const tok = String(row.accessToken ?? "");
    return {
      ...row,
      accessToken: tok ? `${tok.slice(0, 4)}…${tok.slice(-3)}` : "—",
    };
  }
  return row;
}

export async function adminDbRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/tables", async (req) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const meta = tableMeta();
    const counts = await Promise.all(
      meta.map(async (m) => ({
        key: m.key,
        count: await getCount(m.key),
      }))
    );
    return {
      tables: meta.map((m) => ({
        ...m,
        count: counts.find((c) => c.key === m.key)?.count ?? 0,
      })),
    };
  });

  app.get("/tables/:key", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const { key } = req.params as { key: TableKey };
    const { search = "", page = "1", limit = "50" } = req.query as Record<string, string>;

    if (!ALLOWED_TABLES.includes(key)) {
      return reply.status(404).send({ error: "Unknown table" });
    }

    const meta = tableMeta().find((m) => m.key === key)!;
    const where = buildSearch(meta.searchFields, search) ?? {};
    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Number(page) - 1) * take;

    const [rawItems, total] = await runQuery(key, where, take, skip);
    const items = rawItems.map((r) => maskRow(key, r as Record<string, unknown>));
    const columns = items.length > 0 ? Object.keys(items[0]) : [];

    return { key, label: meta.label, columns, items, total, page: Number(page), limit: take };
  });
}

async function getCount(key: TableKey): Promise<number> {
  switch (key) {
    case "users":
      return prisma.user.count();
    case "leads":
      return prisma.lead.count();
    case "activities":
      return prisma.activity.count();
    case "callLogs":
      return prisma.callLog.count();
    case "messageTemplates":
      return prisma.messageTemplate.count();
    case "userWhatsAppIntegrations":
      return prisma.userWhatsAppIntegration.count();
    case "campaigns":
      return prisma.campaign.count();
    case "campaignRecipients":
      return prisma.campaignRecipient.count();
    case "userBulkProfiles":
      return prisma.userBulkProfile.count();
    case "bulkBatches":
      return prisma.bulkBatch.count();
    case "bulkRecipients":
      return prisma.bulkRecipient.count();
  }
}

async function runQuery(
  key: TableKey,
  where: Record<string, unknown>,
  take: number,
  skip: number
): Promise<[unknown[], number]> {
  switch (key) {
    case "users": {
      const items = await prisma.user.findMany({ where, take, skip, orderBy: { createdAt: "desc" } });
      const total = await prisma.user.count({ where });
      return [items, total];
    }
    case "leads": {
      const items = await prisma.lead.findMany({ where, take, skip, orderBy: { createdAt: "desc" } });
      const total = await prisma.lead.count({ where });
      return [items, total];
    }
    case "activities": {
      const items = await prisma.activity.findMany({ where, take, skip, orderBy: { createdAt: "desc" } });
      const total = await prisma.activity.count({ where });
      return [items, total];
    }
    case "callLogs": {
      const items = await prisma.callLog.findMany({ where, take, skip, orderBy: { createdAt: "desc" } });
      const total = await prisma.callLog.count({ where });
      return [items, total];
    }
    case "messageTemplates": {
      const items = await prisma.messageTemplate.findMany({ where, take, skip, orderBy: { createdAt: "desc" } });
      const total = await prisma.messageTemplate.count({ where });
      return [items, total];
    }
    case "userWhatsAppIntegrations": {
      const items = await prisma.userWhatsAppIntegration.findMany({ where, take, skip, orderBy: { updatedAt: "desc" } });
      const total = await prisma.userWhatsAppIntegration.count({ where });
      return [items, total];
    }
    case "campaigns": {
      const items = await prisma.campaign.findMany({ where, take, skip, orderBy: { createdAt: "desc" } });
      const total = await prisma.campaign.count({ where });
      return [items, total];
    }
    case "campaignRecipients": {
      const items = await prisma.campaignRecipient.findMany({ where, take, skip });
      const total = await prisma.campaignRecipient.count({ where });
      return [items, total];
    }
    case "userBulkProfiles": {
      const items = await prisma.userBulkProfile.findMany({ where, take, skip, orderBy: { updatedAt: "desc" } });
      const total = await prisma.userBulkProfile.count({ where });
      return [items, total];
    }
    case "bulkBatches": {
      const items = await prisma.bulkBatch.findMany({ where, take, skip, orderBy: { createdAt: "desc" } });
      const total = await prisma.bulkBatch.count({ where });
      return [items, total];
    }
    case "bulkRecipients": {
      const items = await prisma.bulkRecipient.findMany({ where, take, skip });
      const total = await prisma.bulkRecipient.count({ where });
      return [items, total];
    }
  }
}
