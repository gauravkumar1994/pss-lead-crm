import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LeadStage, LeadType, ActivityType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser, requireRoles } from "../lib/auth.js";

const leadFilterSchema = z.object({
  search: z.string().optional(),
  stage: z.nativeEnum(LeadStage).optional(),
  leadType: z.nativeEnum(LeadType).optional(),
  assignedUserId: z.string().optional(),
  city: z.string().optional(),
  status: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().default(1),
  limit: z.coerce.number().max(200).default(50),
});

const createLeadSchema = z.object({
  name: z.string().min(1),
  mobile: z.string().min(10),
  altMobile: z.string().optional(),
  email: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  leadSource: z.string().optional(),
  leadType: z.nativeEnum(LeadType).optional(),
  stage: z.nativeEnum(LeadStage).optional(),
  product: z.string().optional(),
  assignedUserId: z.string().optional(),
  nextFollowup: z.string().datetime().optional(),
  followupNotes: z.string().optional(),
  tags: z.string().optional(),
});

const remarkSchema = z.object({
  remarkType: z.string().optional(),
  content: z.string().min(1),
  nextAction: z.string().optional(),
  nextDate: z.string().datetime().optional(),
});

function nextLeadCode(): string {
  return `L${Date.now().toString(36).toUpperCase()}`;
}

export async function leadRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req) => {
    const user = getUser(req);
    const q = leadFilterSchema.parse(req.query);
    const where: Record<string, unknown> = { status: q.status ?? "active" };

    if (user.role === Role.USER) {
      where.assignedUserId = user.id;
    } else if (q.assignedUserId) {
      where.assignedUserId = q.assignedUserId;
    }

    if (q.stage) where.stage = q.stage;
    if (q.leadType) where.leadType = q.leadType;
    if (q.city) where.city = { contains: q.city };

    if (q.fromDate || q.toDate) {
      where.createdAt = {};
      if (q.fromDate) (where.createdAt as Record<string, Date>).gte = new Date(q.fromDate);
      if (q.toDate) (where.createdAt as Record<string, Date>).lte = new Date(q.toDate);
    }

    if (q.search) {
      where.OR = [
        { name: { contains: q.search } },
        { mobile: { contains: q.search } },
        { email: { contains: q.search } },
        { leadCode: { contains: q.search } },
      ];
    }

    const skip = (q.page - 1) * q.limit;
    const [items, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: q.limit,
        orderBy: { updatedAt: "desc" },
        include: {
          assignedUser: { select: { id: true, fullName: true, userCode: true } },
        },
      }),
      prisma.lead.count({ where }),
    ]);

    return { items, total, page: q.page, limit: q.limit };
  });

  app.get("/pipeline", async (req) => {
    const user = getUser(req);
    const base =
      user.role === Role.USER
        ? { status: "active", assignedUserId: user.id }
        : { status: "active" };
    const stages = Object.values(LeadStage);
    const counts = await Promise.all(
      stages.map(async (stage) => ({
        stage,
        count: await prisma.lead.count({ where: { ...base, stage } }),
      }))
    );
    return { stages: counts };
  });

  app.get("/pipeline/board", async (req) => {
    const user = getUser(req);
    const base =
      user.role === Role.USER
        ? { status: "active", assignedUserId: user.id }
        : { status: "active" };

    const leads = await prisma.lead.findMany({
      where: base,
      select: {
        id: true,
        leadCode: true,
        name: true,
        mobile: true,
        stage: true,
        leadType: true,
        city: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
    });

    const stages = Object.values(LeadStage);
    const byStage: Record<string, typeof leads> = {};
    const countMap: Record<string, number> = {};

    for (const stage of stages) {
      byStage[stage] = [];
      countMap[stage] = 0;
    }

    for (const lead of leads) {
      countMap[lead.stage] = (countMap[lead.stage] ?? 0) + 1;
      const bucket = byStage[lead.stage];
      if (bucket && bucket.length < 20) bucket.push(lead);
    }

    return {
      stages: stages.map((stage) => ({ stage, count: countMap[stage] ?? 0 })),
      byStage,
    };
  });

  app.post("/import", async (req) => {
    const user = getUser(req);
    const body = z
      .object({
        rows: z.array(
          z.object({
            name: z.string().min(1),
            mobile: z.string().min(10),
            email: z.string().optional(),
            city: z.string().optional(),
            leadSource: z.string().optional(),
            leadType: z.nativeEnum(LeadType).optional(),
            stage: z.nativeEnum(LeadStage).optional(),
            tags: z.string().optional(),
            assignedUserId: z.string().optional(),
          })
        ),
      })
      .parse(req.body);

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of body.rows.slice(0, 500)) {
      const mobile = row.mobile.replace(/\D/g, "").slice(-10);
      if (mobile.length < 10) {
        skipped++;
        errors.push(`${row.name}: invalid mobile`);
        continue;
      }
      const dup = await prisma.lead.findFirst({
        where: { mobile, status: "active" },
      });
      if (dup) {
        skipped++;
        continue;
      }
      await prisma.lead.create({
        data: {
          leadCode: nextLeadCode(),
          name: row.name.trim(),
          mobile,
          email: row.email,
          city: row.city,
          leadSource: row.leadSource,
          leadType: row.leadType ?? LeadType.COLD,
          stage: row.stage ?? LeadStage.NEW,
          tags: row.tags,
          assignedUserId:
            user.role === Role.USER
              ? user.id
              : row.assignedUserId ?? user.id,
          createdBy: user.id,
        },
      });
      created++;
    }

    return { created, skipped, errors: errors.slice(0, 20) };
  });

  app.get("/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = getUser(req);
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        assignedUser: { select: { id: true, fullName: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { user: { select: { fullName: true } } },
        },
        calls: {
          orderBy: { createdAt: "desc" },
          take: 50,
          include: { user: { select: { fullName: true } } },
        },
      },
    });
    if (!lead) return reply.status(404).send({ error: "Lead not found" });
    if (user.role === Role.USER && lead.assignedUserId !== user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }
    return lead;
  });

  app.post("/", async (req) => {
    const user = getUser(req);
    const body = createLeadSchema.parse(req.body);
    const lead = await prisma.lead.create({
      data: {
        leadCode: nextLeadCode(),
        name: body.name,
        mobile: body.mobile.replace(/\D/g, "").slice(-10),
        altMobile: body.altMobile,
        email: body.email,
        city: body.city,
        state: body.state,
        leadSource: body.leadSource,
        leadType: body.leadType ?? LeadType.COLD,
        stage: body.stage ?? LeadStage.NEW,
        product: body.product,
        assignedUserId: body.assignedUserId ?? user.id,
        nextFollowup: body.nextFollowup ? new Date(body.nextFollowup) : undefined,
        followupNotes: body.followupNotes,
        tags: body.tags,
        createdBy: user.id,
      },
    });
    await prisma.activity.create({
      data: {
        leadId: lead.id,
        userId: user.id,
        type: ActivityType.SYSTEM,
        content: `Lead created by ${user.fullName}`,
      },
    });
    return lead;
  });

  app.patch("/:id", async (req, reply) => {
    const user = getUser(req);
    const { id } = req.params as { id: string };
    const body = createLeadSchema.partial().parse(req.body);
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    if (user.role === Role.USER && existing.assignedUserId !== user.id) {
      return reply.status(403).send({ error: "You can only edit your own assigned leads" });
    }

    // Sales users cannot reassign leads via PATCH (use /assign for admin/manager)
    if (user.role === Role.USER && body.assignedUserId && body.assignedUserId !== user.id) {
      return reply.status(403).send({ error: "Only admin can reassign leads" });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        ...body,
        nextFollowup: body.nextFollowup ? new Date(body.nextFollowup) : undefined,
        mobile: body.mobile ? body.mobile.replace(/\D/g, "").slice(-10) : undefined,
      },
    });
    return lead;
  });

  app.post("/:id/remarks", async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = getUser(req);
    const body = remarkSchema.parse(req.body);
    const lead = await prisma.lead.findUnique({ where: { id } });
    if (!lead) return reply.status(404).send({ error: "Not found" });
    if (user.role === Role.USER && lead.assignedUserId !== user.id) {
      return reply.status(403).send({ error: "You can only add remarks on your own assigned leads" });
    }

    const activity = await prisma.activity.create({
      data: {
        leadId: id,
        userId: user.id,
        type: ActivityType.REMARK,
        remarkType: body.remarkType,
        content: body.content,
        nextAction: body.nextAction,
        nextDate: body.nextDate ? new Date(body.nextDate) : undefined,
      },
    });

    await prisma.lead.update({
      where: { id },
      data: {
        lastFollowup: new Date(),
        nextFollowup: body.nextDate ? new Date(body.nextDate) : lead.nextFollowup,
        followupNotes: body.content,
      },
    });

    return activity;
  });

  app.post("/:id/assign", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN, Role.MANAGER]);
    const { id } = req.params as { id: string };
    const { assignedUserId } = z.object({ assignedUserId: z.string() }).parse(req.body);

    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    const assignee = await prisma.user.findUnique({
      where: { id: assignedUserId },
      select: { fullName: true },
    });
    if (!assignee) return reply.status(400).send({ error: "User not found" });

    const previous = existing.assignedUserId
      ? await prisma.user.findUnique({
          where: { id: existing.assignedUserId },
          select: { fullName: true },
        })
      : null;

    const updated = await prisma.lead.update({
      where: { id },
      data: {
        previousUserId: existing.assignedUserId,
        assignedUserId,
      },
      include: {
        assignedUser: { select: { id: true, fullName: true } },
      },
    });

    await prisma.activity.create({
      data: {
        leadId: id,
        userId: user.id,
        type: ActivityType.ASSIGNMENT,
        content: previous
          ? `Reassigned from ${previous.fullName} to ${assignee.fullName}`
          : `Assigned to ${assignee.fullName}`,
      },
    });

    return updated;
  });

  app.delete("/:id", async (req, reply) => {
    const user = getUser(req);
    requireRoles(user, [Role.ADMIN, Role.MANAGER]);
    const { id } = req.params as { id: string };
    const existing = await prisma.lead.findUnique({ where: { id } });
    if (!existing) return reply.status(404).send({ error: "Not found" });
    await prisma.lead.update({ where: { id }, data: { status: "inactive" } });
    return { ok: true };
  });
}
