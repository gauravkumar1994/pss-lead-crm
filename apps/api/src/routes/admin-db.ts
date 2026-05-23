import type { FastifyInstance } from "fastify";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";

/* -----------------------------------------------------------
 * Admin Database Panel — read-only DB viewer.
 *
 * For each table:
 *   - "displayColumns" = the friendly, joined columns shown in UI
 *     (no raw IDs / FK columns by default — admin sees names instead)
 *   - "showAllColumns=true" query param returns every column for
 *     deep debugging (still read-only)
 *   - CSV export endpoint streams the full table (capped at 50k rows
 *     per export to keep Render free tier safe)
 *
 * Sensitive fields (password hash, access token) are always masked.
 * --------------------------------------------------------- */

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

type DisplayColumn = { key: string; label: string };

type TableMeta = {
  key: TableKey;
  label: string;
  description: string;
  searchFields: string[];
  displayColumns: DisplayColumn[];
};

const TABLES: TableMeta[] = [
  {
    key: "users",
    label: "Users",
    description: "Admin + sales team",
    searchFields: ["fullName", "username", "userCode"],
    displayColumns: [
      { key: "userCode", label: "Code" },
      { key: "fullName", label: "Name" },
      { key: "username", label: "Username" },
      { key: "role", label: "Role" },
      { key: "department", label: "Department" },
      { key: "email", label: "Email" },
      { key: "mobile", label: "Mobile" },
      { key: "status", label: "Status" },
      { key: "lastLoginAt", label: "Last login" },
      { key: "createdAt", label: "Created" },
    ],
  },
  {
    key: "leads",
    label: "Leads",
    description: "All leads with assigned user",
    searchFields: ["name", "mobile", "leadCode", "city"],
    displayColumns: [
      { key: "name", label: "Name" },
      { key: "mobile", label: "Mobile" },
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "leadSource", label: "Source" },
      { key: "leadType", label: "Type" },
      { key: "stage", label: "Stage" },
      { key: "assignedUserName", label: "Assigned to" },
      { key: "whatsappCount", label: "WA sent" },
      { key: "status", label: "Status" },
      { key: "createdAt", label: "Created" },
    ],
  },
  {
    key: "activities",
    label: "Activity log",
    description: "Remarks / WhatsApp / system events with user + lead names",
    searchFields: ["content", "remarkType"],
    displayColumns: [
      { key: "createdAt", label: "When" },
      { key: "type", label: "Type" },
      { key: "remarkType", label: "Sub-type" },
      { key: "userName", label: "By user" },
      { key: "leadName", label: "Lead" },
      { key: "leadMobile", label: "Lead mobile" },
      { key: "content", label: "Content" },
      { key: "nextAction", label: "Next action" },
      { key: "nextDate", label: "Next date" },
    ],
  },
  {
    key: "callLogs",
    label: "Call logs",
    description: "Phone calls with user + lead names",
    searchFields: ["outcome", "notes"],
    displayColumns: [
      { key: "createdAt", label: "When" },
      { key: "userName", label: "By user" },
      { key: "leadName", label: "Lead" },
      { key: "leadMobile", label: "Lead mobile" },
      { key: "outcome", label: "Outcome" },
      { key: "notes", label: "Notes" },
      { key: "durationSec", label: "Duration (sec)" },
    ],
  },
  {
    key: "messageTemplates",
    label: "WhatsApp templates",
    description: "Saved message templates",
    searchFields: ["name", "body", "category"],
    displayColumns: [
      { key: "name", label: "Name" },
      { key: "category", label: "Category" },
      { key: "body", label: "Body" },
      { key: "createdAt", label: "Created" },
    ],
  },
  {
    key: "userWhatsAppIntegrations",
    label: "WhatsApp integrations",
    description: "Per-user API credentials (token masked)",
    searchFields: ["instanceId", "phone"],
    displayColumns: [
      { key: "userName", label: "User" },
      { key: "provider", label: "Provider" },
      { key: "instanceId", label: "Instance ID" },
      { key: "phone", label: "Phone" },
      { key: "dailyLimit", label: "Daily limit" },
      { key: "sentToday", label: "Sent today" },
      { key: "status", label: "Status" },
      { key: "accessToken", label: "Token (masked)" },
      { key: "lastUsedAt", label: "Last used" },
    ],
  },
  {
    key: "campaigns",
    label: "Campaigns",
    description: "Bulk legacy campaigns",
    searchFields: ["name", "campaignCode"],
    displayColumns: [
      { key: "campaignCode", label: "Code" },
      { key: "name", label: "Name" },
      { key: "status", label: "Status" },
      { key: "userName", label: "Created by" },
      { key: "createdAt", label: "Created" },
    ],
  },
  {
    key: "campaignRecipients",
    label: "Campaign recipients",
    description: "Per-lead delivery rows",
    searchFields: ["mobile"],
    displayColumns: [
      { key: "mobile", label: "Mobile" },
      { key: "leadName", label: "Lead" },
      { key: "status", label: "Status" },
      { key: "sentAt", label: "Sent at" },
      { key: "error", label: "Error" },
    ],
  },
  {
    key: "userBulkProfiles",
    label: "Bulk automation profiles",
    description: "Per-user bulk rules + enable flag",
    searchFields: [],
    displayColumns: [
      { key: "userName", label: "User" },
      { key: "enabled", label: "Enabled" },
      { key: "dailyTarget", label: "Daily target" },
      { key: "sentToday", label: "Sent today" },
      { key: "gapMinutes", label: "Gap (min)" },
      { key: "startHour", label: "Start hr" },
      { key: "endHour", label: "End hr" },
      { key: "lastSentAt", label: "Last sent" },
    ],
  },
  {
    key: "bulkBatches",
    label: "Bulk batches",
    description: "Uploaded bulk send jobs",
    searchFields: ["batchCode", "name", "source"],
    displayColumns: [
      { key: "batchCode", label: "Code" },
      { key: "userName", label: "User" },
      { key: "name", label: "Name" },
      { key: "status", label: "Status" },
      { key: "total", label: "Total" },
      { key: "sent", label: "Sent" },
      { key: "failed", label: "Failed" },
      { key: "createdAt", label: "Created" },
    ],
  },
  {
    key: "bulkRecipients",
    label: "Bulk recipients",
    description: "Individual mobile rows per batch",
    searchFields: ["mobile", "name"],
    displayColumns: [
      { key: "mobile", label: "Mobile" },
      { key: "name", label: "Name" },
      { key: "city", label: "City" },
      { key: "status", label: "Status" },
      { key: "sentAt", label: "Sent at" },
      { key: "error", label: "Error" },
    ],
  },
];

function getMeta(key: TableKey): TableMeta {
  return TABLES.find((t) => t.key === key)!;
}

function buildSearch(searchFields: string[], search?: string): Record<string, unknown> | undefined {
  if (!search || !searchFields.length) return undefined;
  return {
    OR: searchFields.map((f) => ({ [f]: { contains: search, mode: "insensitive" } })),
  };
}

/** Flatten joined relations + mask sensitive fields into one display-friendly row. */
function flattenRow(key: TableKey, raw: Record<string, unknown>): Record<string, unknown> {
  const row = { ...raw } as Record<string, unknown>;

  // Mask sensitive fields
  if (key === "users") {
    delete row.passwordHash;
  }
  if (key === "userWhatsAppIntegrations") {
    const tok = String(row.accessToken ?? "");
    row.accessToken = tok ? `${tok.slice(0, 4)}…${tok.slice(-3)}` : "—";
  }

  // Flatten joined "user" relation -> userName
  if (row.user && typeof row.user === "object") {
    const u = row.user as { fullName?: string };
    row.userName = u.fullName ?? "—";
    delete row.user;
  }

  // Campaign model uses sentBy (not user)
  if (row.sentBy && typeof row.sentBy === "object") {
    const u = row.sentBy as { fullName?: string };
    row.userName = u.fullName ?? "—";
    delete row.sentBy;
  }

  // Flatten "assignedUser" (leads.assignedUserId)
  if (row.assignedUser && typeof row.assignedUser === "object") {
    const u = row.assignedUser as { fullName?: string };
    row.assignedUserName = u.fullName ?? "—";
    delete row.assignedUser;
  } else if (key === "leads" && !row.assignedUserName) {
    row.assignedUserName = "Unassigned";
  }

  // Flatten "lead" relation
  if (row.lead && typeof row.lead === "object") {
    const l = row.lead as { name?: string; mobile?: string };
    row.leadName = l.name ?? "—";
    row.leadMobile = l.mobile ?? "—";
    delete row.lead;
  }

  // Flatten "batch" relation (bulkRecipients)
  if (row.batch && typeof row.batch === "object") {
    const b = row.batch as { name?: string; batchCode?: string };
    row.batchName = b.name ?? "—";
    row.batchCode = b.batchCode ?? "—";
    delete row.batch;
  }

  return row;
}

/** When ?showAllColumns=true is set, we include every column (raw IDs + FKs).
 *  Otherwise we return only the curated displayColumns in their preferred order. */
function projectRow(
  meta: TableMeta,
  flat: Record<string, unknown>,
  showAll: boolean
): Record<string, unknown> {
  if (showAll) return flat;
  const out: Record<string, unknown> = {};
  for (const col of meta.displayColumns) {
    out[col.key] = flat[col.key] ?? null;
  }
  return out;
}

export async function adminDbRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  // List all tables + counts
  app.get("/tables", async (req) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const counts = await Promise.all(TABLES.map((m) => getCount(m.key)));
    return {
      tables: TABLES.map((m, i) => ({
        key: m.key,
        label: m.label,
        description: m.description,
        searchFields: m.searchFields,
        displayColumns: m.displayColumns,
        count: counts[i],
      })),
    };
  });

  // Browse one table (paged + searched)
  app.get("/tables/:key", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const { key } = req.params as { key: TableKey };
    const {
      search = "",
      page = "1",
      limit = "50",
      showAllColumns = "false",
    } = req.query as Record<string, string>;

    if (!ALLOWED_TABLES.includes(key)) {
      return reply.status(404).send({ error: "Unknown table" });
    }

    const meta = getMeta(key);
    const where = buildSearch(meta.searchFields, search) ?? {};
    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Number(page) - 1) * take;
    const showAll = showAllColumns === "true" || showAllColumns === "1";

    const [rawItems, total] = await runQuery(key, where, take, skip);
    const flat = rawItems.map((r) => flattenRow(key, r as Record<string, unknown>));
    const items = flat.map((r) => projectRow(meta, r, showAll));

    const columns = items.length > 0 ? Object.keys(items[0]) : meta.displayColumns.map((c) => c.key);

    return {
      key,
      label: meta.label,
      columns,
      displayColumns: meta.displayColumns,
      items,
      total,
      page: Number(page),
      limit: take,
      showAll,
    };
  });

  // CSV export (full table, capped at 50k rows)
  app.get("/tables/:key/export", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);
    const { key } = req.params as { key: TableKey };
    const { search = "", showAllColumns = "false" } = req.query as Record<string, string>;

    if (!ALLOWED_TABLES.includes(key)) {
      return reply.status(404).send({ error: "Unknown table" });
    }

    const meta = getMeta(key);
    const where = buildSearch(meta.searchFields, search) ?? {};
    const MAX = 50_000;
    const showAll = showAllColumns === "true" || showAllColumns === "1";

    const [rawItems] = await runQuery(key, where, MAX, 0);
    const flat = rawItems.map((r) => flattenRow(key, r as Record<string, unknown>));
    const rows = flat.map((r) => projectRow(meta, r, showAll));

    // Build header + columns
    const cols = rows.length > 0 ? Object.keys(rows[0]) : meta.displayColumns.map((c) => c.key);
    const headerLabels = showAll
      ? cols
      : cols.map((c) => meta.displayColumns.find((d) => d.key === c)?.label ?? c);

    const csv = buildCsv(headerLabels, rows.map((r) => cols.map((c) => csvCell(r[c]))));

    const filename = `${key}-${new Date().toISOString().slice(0, 10)}.csv`;
    return reply
      .header("Content-Type", "text/csv; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${filename}"`)
      .send(csv);
  });
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function buildCsv(header: string[], rows: string[][]): string {
  const escape = (s: string) => {
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [header.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  return lines.join("\r\n");
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

const userJoinSelect = { id: true, fullName: true } as const;
const leadJoinSelect = { id: true, name: true, mobile: true } as const;
const batchJoinSelect = { id: true, name: true, batchCode: true } as const;

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
      const items = await prisma.lead.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: { assignedUser: { select: userJoinSelect } },
      });
      const total = await prisma.lead.count({ where });
      return [items, total];
    }
    case "activities": {
      const items = await prisma.activity.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: userJoinSelect },
          lead: { select: leadJoinSelect },
        },
      });
      const total = await prisma.activity.count({ where });
      return [items, total];
    }
    case "callLogs": {
      const items = await prisma.callLog.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: userJoinSelect },
          lead: { select: leadJoinSelect },
        },
      });
      const total = await prisma.callLog.count({ where });
      return [items, total];
    }
    case "messageTemplates": {
      const items = await prisma.messageTemplate.findMany({ where, take, skip, orderBy: { createdAt: "desc" } });
      const total = await prisma.messageTemplate.count({ where });
      return [items, total];
    }
    case "userWhatsAppIntegrations": {
      const items = await prisma.userWhatsAppIntegration.findMany({
        where,
        take,
        skip,
        orderBy: { updatedAt: "desc" },
        include: { user: { select: userJoinSelect } },
      });
      const total = await prisma.userWhatsAppIntegration.count({ where });
      return [items, total];
    }
    case "campaigns": {
      const items = await prisma.campaign.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: { sentBy: { select: userJoinSelect } },
      });
      const total = await prisma.campaign.count({ where });
      return [items, total];
    }
    case "campaignRecipients": {
      const items = await prisma.campaignRecipient.findMany({
        where,
        take,
        skip,
        include: { lead: { select: leadJoinSelect } },
      });
      const total = await prisma.campaignRecipient.count({ where });
      return [items, total];
    }
    case "userBulkProfiles": {
      const items = await prisma.userBulkProfile.findMany({
        where,
        take,
        skip,
        orderBy: { updatedAt: "desc" },
        include: { user: { select: userJoinSelect } },
      });
      const total = await prisma.userBulkProfile.count({ where });
      return [items, total];
    }
    case "bulkBatches": {
      const items = await prisma.bulkBatch.findMany({
        where,
        take,
        skip,
        orderBy: { createdAt: "desc" },
        include: { user: { select: userJoinSelect } },
      });
      const total = await prisma.bulkBatch.count({ where });
      return [items, total];
    }
    case "bulkRecipients": {
      const items = await prisma.bulkRecipient.findMany({
        where,
        take,
        skip,
        include: { batch: { select: batchJoinSelect } },
      });
      const total = await prisma.bulkRecipient.count({ where });
      return [items, total];
    }
  }
}
