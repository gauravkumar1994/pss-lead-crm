import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as XLSX from "xlsx";
import { BulkBatchStatus, BulkSendStatus, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";

/* -----------------------------------------------------------
 * PSS Smart Bulk Automation
 * - Admin assigns each user's WhatsApp API (separate /whatsapp routes)
 * - Admin enables Bulk Permission per user + configures rules
 *   (18-min gap, daily target, time window — when user's bulk runs)
 * - User uploads Excel (xlsx/csv) of numbers OR pastes them, types
 *   the message, optionally browses & attaches ONE photo/video.
 *   After hitting "Create batch", the cloud worker (Render API)
 *   keeps sending in background — user can close their browser.
 * - Background worker sends per rules via user's assigned WhatsApp API.
 *
 * No Cloudinary, no Google Sheets runtime, no Drive auto-fetch,
 * no country/stage/leadType matching.
 * ----------------------------------------------------------- */

const profileSchema = z.object({
  enabled: z.boolean().optional(),
  dailyTarget: z.number().int().min(1).max(5000).optional(),
  gapMinutes: z.number().int().min(0).max(720).optional(),
  startHour: z.number().int().min(0).max(23).optional(),
  endHour: z.number().int().min(0).max(23).optional(),
  notes: z.string().optional().nullable(),
});

const importSchema = z.object({
  name: z.string().min(1),
  message: z.string().min(1),
  mediaUrl: z.string().url().optional().nullable(),
  source: z.string().optional().nullable(),
  startNow: z.boolean().optional(),
  rows: z
    .array(
      z.object({
        mobile: z.string().min(8),
        name: z.string().optional(),
        city: z.string().optional(),
        custom1: z.string().optional(),
        custom2: z.string().optional(),
      })
    )
    .min(1)
    .max(5000),
});

function batchCode() {
  return `B${Date.now().toString(36).toUpperCase()}`;
}

/** Accepts "9876543210" (10 digit), "919876543210" (12 digit with cc),
 *  "+919876543210", or mixed-format strings with separators. */
function cleanPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return `91${digits}`;
  // 12-digit assumed already 91+10; longer numbers (e.g. 14 digit international) kept as-is
  return digits;
}

/** Header lookup helpers — pick the column that matches any synonym. */
const HEADER_SYNONYMS: Record<string, string[]> = {
  mobile: ["mobile", "phone", "number", "whatsapp", "contact", "mob", "no"],
  name: ["name", "full name", "fullname", "customer", "person"],
  city: ["city", "location", "town", "place"],
  custom1: ["custom1", "custom 1", "company", "tag", "note1"],
  custom2: ["custom2", "custom 2", "category", "note2"],
};

function findColumn(headers: string[], key: keyof typeof HEADER_SYNONYMS): number {
  const synonyms = HEADER_SYNONYMS[key];
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] ?? "").trim().toLowerCase();
    if (!h) continue;
    if (synonyms.includes(h)) return i;
  }
  return -1;
}

type ParsedRow = {
  mobile: string;
  name?: string;
  city?: string;
  custom1?: string;
  custom2?: string;
};

/** Parse Excel/CSV buffer into rows. Tolerant about column names and order.
 *  If headers are present, columns are matched by synonyms; otherwise the
 *  first column = name, second = mobile (BEAST convention). */
function parseSpreadsheet(buf: Buffer): ParsedRow[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const ws = wb.Sheets[firstSheet];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    blankrows: false,
    defval: "",
  });
  if (rows.length === 0) return [];

  // Determine if first row is a header (alphabetic content) or pure data
  const first = rows[0].map((c) => String(c ?? "").trim());
  const looksLikeHeader =
    first.some((c) => /^[a-zA-Z][a-zA-Z\s]+$/.test(c)) &&
    first.every((c) => !/^\+?\d{10,}$/.test(c.replace(/\D/g, "")));

  let mobileIdx = -1;
  let nameIdx = -1;
  let cityIdx = -1;
  let custom1Idx = -1;
  let custom2Idx = -1;
  let dataStart = 0;

  if (looksLikeHeader) {
    mobileIdx = findColumn(first, "mobile");
    nameIdx = findColumn(first, "name");
    cityIdx = findColumn(first, "city");
    custom1Idx = findColumn(first, "custom1");
    custom2Idx = findColumn(first, "custom2");
    dataStart = 1;
  }

  // Fallback if no header / no mobile column detected:
  // BEAST convention -> col A = name, col B = mobile
  if (mobileIdx === -1) {
    nameIdx = 0;
    mobileIdx = 1;
  }

  const out: ParsedRow[] = [];
  for (let r = dataStart; r < rows.length; r++) {
    const row = rows[r];
    const rawMobile = String(row[mobileIdx] ?? "").trim();
    if (!rawMobile) continue;
    out.push({
      mobile: rawMobile,
      name: nameIdx >= 0 ? String(row[nameIdx] ?? "").trim() || undefined : undefined,
      city: cityIdx >= 0 ? String(row[cityIdx] ?? "").trim() || undefined : undefined,
      custom1:
        custom1Idx >= 0 ? String(row[custom1Idx] ?? "").trim() || undefined : undefined,
      custom2:
        custom2Idx >= 0 ? String(row[custom2Idx] ?? "").trim() || undefined : undefined,
    });
  }
  return out;
}

function personalize(
  text: string,
  row: { name?: string | null; city?: string | null; custom1?: string | null; custom2?: string | null; mobile: string }
) {
  return text
    .replace(/\{name\}/gi, row.name ?? "")
    .replace(/\{city\}/gi, row.city ?? "")
    .replace(/\{mobile\}/gi, row.mobile)
    .replace(/\{custom1\}/gi, row.custom1 ?? "")
    .replace(/\{custom2\}/gi, row.custom2 ?? "");
}

async function ensureProfile(userId: string) {
  return prisma.userBulkProfile.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function bulkAutomationRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  /** USER read-only: own bulk profile */
  app.get("/my-profile", async (req) => {
    const user = getUser(req);
    const profile = await ensureProfile(user.id);
    return { profile };
  });

  /** ADMIN: list all user profiles (with WA status + counts) */
  app.get("/profiles", async (req) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN]);

    const users = await prisma.user.findMany({
      where: { status: "active" },
      orderBy: [{ fullName: "asc" }],
      select: {
        id: true,
        userCode: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        bulkProfile: true,
        whatsappIntegration: {
          select: { provider: true, status: true, dailyLimit: true, sentToday: true },
        },
      },
    });

    return {
      items: users.map((u) => ({
        userId: u.id,
        userCode: u.userCode,
        username: u.username,
        fullName: u.fullName,
        role: u.role,
        profile: u.bulkProfile,
        whatsapp: u.whatsappIntegration,
      })),
    };
  });

  /** ADMIN: set / update one user's bulk profile (enable toggle + rules). */
  app.put("/profiles/:userId", async (req, reply) => {
    const admin = getUser(req);
    requireRoles(admin, [Role.ADMIN]);
    const { userId } = req.params as { userId: string };
    const body = profileSchema.parse(req.body);

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return reply.status(404).send({ error: "User not found" });

    if (body.startHour != null && body.endHour != null && body.startHour >= body.endHour) {
      return reply.status(400).send({
        error: "Start hour must be earlier than End hour",
      });
    }

    const profile = await prisma.userBulkProfile.upsert({
      where: { userId },
      update: body,
      create: { userId, ...body },
    });

    return { profile };
  });

  /** USER + ADMIN: import a mapped batch (CSV/Excel rows from UI) */
  app.post("/import", async (req, reply) => {
    const user = getUser(req);
    const body = importSchema.parse(req.body);

    // Make sure profile exists for the user (worker reads from here)
    await ensureProfile(user.id);

    // Clean phones + de-duplicate inside this upload
    const seen = new Set<string>();
    const recipients: {
      mobile: string;
      name?: string;
      city?: string;
      custom1?: string;
      custom2?: string;
      personalized: string;
    }[] = [];
    let dropped = 0;

    for (const row of body.rows) {
      const phone = cleanPhone(row.mobile);
      if (!phone) {
        dropped++;
        continue;
      }
      if (seen.has(phone)) {
        dropped++;
        continue;
      }
      seen.add(phone);
      recipients.push({
        mobile: phone,
        name: row.name,
        city: row.city,
        custom1: row.custom1,
        custom2: row.custom2,
        personalized: personalize(body.message, { ...row, mobile: phone }),
      });
    }

    if (recipients.length === 0) {
      return reply.status(400).send({ error: "No valid mobile numbers after cleaning" });
    }

    const batch = await prisma.bulkBatch.create({
      data: {
        batchCode: batchCode(),
        userId: user.id,
        name: body.name,
        message: body.message,
        mediaUrl: body.mediaUrl ?? null,
        source: body.source ?? null,
        total: recipients.length,
        status: body.startNow ? BulkBatchStatus.ACTIVE : BulkBatchStatus.PENDING,
        startedAt: body.startNow ? new Date() : null,
        recipients: { create: recipients },
      },
    });

    return { batch, droppedRows: dropped };
  });

  /** USER + ADMIN: Excel/CSV upload (multipart).
   *  Fields:  file (xlsx|csv), name, message, mediaUrl?, source?, startNow?
   *  Detects columns by header; falls back to col A=name, B=mobile. */
  app.post("/import-excel", async (req, reply) => {
    const user = getUser(req);
    await ensureProfile(user.id);

    // Collect multipart fields into memory
    let fileBuf: Buffer | null = null;
    let fileName = "";
    let name = "";
    let message = "";
    let mediaUrl = "";
    let source = "excel";
    let startNow = false;

    try {
      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          fileBuf = await part.toBuffer();
          fileName = part.filename ?? "upload.xlsx";
        } else {
          const v = String(part.value ?? "");
          switch (part.fieldname) {
            case "name":
              name = v;
              break;
            case "message":
              message = v;
              break;
            case "mediaUrl":
              mediaUrl = v;
              break;
            case "source":
              source = v;
              break;
            case "startNow":
              startNow = v === "true" || v === "1";
              break;
          }
        }
      }
    } catch (e) {
      return reply.status(400).send({
        error: e instanceof Error ? e.message : "Upload parse failed",
      });
    }

    if (!fileBuf) return reply.status(400).send({ error: "File missing" });
    if (!name.trim()) return reply.status(400).send({ error: "Batch name missing" });
    if (!message.trim()) return reply.status(400).send({ error: "Message missing" });

    // Parse spreadsheet -> rows
    let parsed: ParsedRow[];
    try {
      parsed = parseSpreadsheet(fileBuf);
    } catch (e) {
      return reply.status(400).send({
        error: e instanceof Error ? `Excel parse failed: ${e.message}` : "Excel parse failed",
      });
    }

    if (parsed.length === 0) {
      return reply.status(400).send({ error: "File mein koi row nahi mili" });
    }

    // Clean + dedupe + personalize
    const seen = new Set<string>();
    const recipients: {
      mobile: string;
      name?: string;
      city?: string;
      custom1?: string;
      custom2?: string;
      personalized: string;
    }[] = [];
    let dropped = 0;

    for (const row of parsed) {
      const phone = cleanPhone(row.mobile);
      if (!phone || seen.has(phone)) {
        dropped++;
        continue;
      }
      seen.add(phone);
      recipients.push({
        mobile: phone,
        name: row.name,
        city: row.city,
        custom1: row.custom1,
        custom2: row.custom2,
        personalized: personalize(message, { ...row, mobile: phone }),
      });
    }

    if (recipients.length === 0) {
      return reply.status(400).send({
        error: "Sab numbers invalid / duplicate. Format check karo (10 digit ya 91+10).",
      });
    }

    const batch = await prisma.bulkBatch.create({
      data: {
        batchCode: batchCode(),
        userId: user.id,
        name: name.trim(),
        message: message.trim(),
        mediaUrl: mediaUrl.trim() || null,
        source: source || fileName,
        total: recipients.length,
        status: startNow ? BulkBatchStatus.ACTIVE : BulkBatchStatus.PENDING,
        startedAt: startNow ? new Date() : null,
        recipients: { create: recipients },
      },
    });

    return { batch, droppedRows: dropped, fileName, parsedCount: parsed.length };
  });

  /** List batches — ADMIN sees all, USER sees own */
  app.get("/batches", async (req) => {
    const user = getUser(req);
    const where = user.role === Role.USER ? { userId: user.id } : {};
    const items = await prisma.bulkBatch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, fullName: true, userCode: true } },
      },
    });
    return { items };
  });

  /** Batch details — RBAC */
  app.get("/batches/:id", async (req, reply) => {
    const user = getUser(req);
    const { id } = req.params as { id: string };
    const batch = await prisma.bulkBatch.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, fullName: true } },
      },
    });
    if (!batch) return reply.status(404).send({ error: "Batch not found" });
    if (user.role === Role.USER && batch.userId !== user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const [pending, sent, failed, skipped] = await Promise.all([
      prisma.bulkRecipient.count({ where: { batchId: id, status: BulkSendStatus.PENDING } }),
      prisma.bulkRecipient.count({ where: { batchId: id, status: BulkSendStatus.SENT } }),
      prisma.bulkRecipient.count({ where: { batchId: id, status: BulkSendStatus.FAILED } }),
      prisma.bulkRecipient.count({ where: { batchId: id, status: BulkSendStatus.SKIPPED } }),
    ]);

    return {
      batch,
      stats: { pending, sent, failed, skipped },
    };
  });

  /** Batch recipients — paginated */
  app.get("/batches/:id/recipients", async (req, reply) => {
    const user = getUser(req);
    const { id } = req.params as { id: string };
    const { status, page = "1", limit = "100" } = req.query as Record<string, string>;

    const batch = await prisma.bulkBatch.findUnique({ where: { id }, select: { userId: true } });
    if (!batch) return reply.status(404).send({ error: "Batch not found" });
    if (user.role === Role.USER && batch.userId !== user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const where: { batchId: string; status?: BulkSendStatus } = { batchId: id };
    if (status && Object.values(BulkSendStatus).includes(status as BulkSendStatus)) {
      where.status = status as BulkSendStatus;
    }

    const take = Math.min(Number(limit) || 100, 500);
    const skip = (Number(page) - 1) * take;

    const [items, total] = await Promise.all([
      prisma.bulkRecipient.findMany({
        where,
        orderBy: [{ status: "asc" }, { sentAt: "desc" }],
        take,
        skip,
      }),
      prisma.bulkRecipient.count({ where }),
    ]);

    return { items, total, page: Number(page), limit: take };
  });

  /** Pause / Resume / Cancel a batch — owner or admin */
  app.post("/batches/:id/:action", async (req, reply) => {
    const user = getUser(req);
    const { id, action } = req.params as { id: string; action: "pause" | "resume" | "cancel" | "start" };
    const batch = await prisma.bulkBatch.findUnique({ where: { id } });
    if (!batch) return reply.status(404).send({ error: "Batch not found" });
    if (user.role === Role.USER && batch.userId !== user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    let nextStatus: BulkBatchStatus | null = null;
    if (action === "pause") nextStatus = BulkBatchStatus.PAUSED;
    else if (action === "resume" || action === "start") nextStatus = BulkBatchStatus.ACTIVE;
    else if (action === "cancel") nextStatus = BulkBatchStatus.CANCELLED;
    else return reply.status(400).send({ error: "Unknown action" });

    const updated = await prisma.bulkBatch.update({
      where: { id },
      data: {
        status: nextStatus,
        startedAt: nextStatus === BulkBatchStatus.ACTIVE && !batch.startedAt ? new Date() : batch.startedAt,
        completedAt: nextStatus === BulkBatchStatus.CANCELLED ? new Date() : batch.completedAt,
      },
    });
    return { batch: updated };
  });

  /** ADMIN live monitor — aggregated stats */
  app.get("/dashboard", async (req) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN, Role.MANAGER]);

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [activeBatches, totalSentToday, totalFailedToday, recipientsPending] = await Promise.all([
      prisma.bulkBatch.count({ where: { status: BulkBatchStatus.ACTIVE } }),
      prisma.bulkRecipient.count({
        where: { status: BulkSendStatus.SENT, sentAt: { gte: start } },
      }),
      prisma.bulkRecipient.count({
        where: { status: BulkSendStatus.FAILED, sentAt: { gte: start } },
      }),
      prisma.bulkRecipient.count({ where: { status: BulkSendStatus.PENDING } }),
    ]);

    const byUser = await prisma.bulkBatch.groupBy({
      by: ["userId"],
      _sum: { sent: true, failed: true, total: true },
      where: { createdAt: { gte: start } },
    });

    const users = await prisma.user.findMany({
      where: { id: { in: byUser.map((u) => u.userId) } },
      select: { id: true, fullName: true, userCode: true },
    });
    const nameMap = Object.fromEntries(users.map((u) => [u.id, u.fullName]));

    return {
      stats: { activeBatches, totalSentToday, totalFailedToday, recipientsPending },
      byUser: byUser.map((u) => ({
        userId: u.userId,
        userName: nameMap[u.userId] ?? u.userId,
        sent: u._sum.sent ?? 0,
        failed: u._sum.failed ?? 0,
        total: u._sum.total ?? 0,
      })),
    };
  });
}
