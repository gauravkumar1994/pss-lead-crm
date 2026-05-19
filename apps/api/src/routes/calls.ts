import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ActivityType, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser } from "../lib/auth.js";

const callLogSchema = z.object({
  leadId: z.string(),
  outcome: z.string().min(1),
  notes: z.string().min(1),
  durationSec: z.number().int().optional(),
});

export async function callRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.post("/", async (req, reply) => {
    const user = getUser(req);
    const body = callLogSchema.parse(req.body);
    const lead = await prisma.lead.findUnique({ where: { id: body.leadId } });
    if (!lead) return reply.status(404).send({ error: "Lead not found" });
    if (user.role === Role.USER && lead.assignedUserId !== user.id) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const [call] = await prisma.$transaction([
      prisma.callLog.create({
        data: {
          leadId: body.leadId,
          userId: user.id,
          outcome: body.outcome,
          notes: body.notes,
          durationSec: body.durationSec,
        },
      }),
      prisma.activity.create({
        data: {
          leadId: body.leadId,
          userId: user.id,
          type: ActivityType.CALL,
          remarkType: body.outcome,
          content: body.notes,
        },
      }),
    ]);

    return call;
  });

  app.get("/report", async (req) => {
    const user = getUser(req);
    const { from, to, userId } = req.query as {
      from?: string;
      to?: string;
      userId?: string;
    };

    const fromDate = from ? new Date(from) : new Date(Date.now() - 7 * 86400000);
    const toDate = to ? new Date(to) : new Date();

    const where: { createdAt: { gte: Date; lte: Date }; userId?: string } = {
      createdAt: { gte: fromDate, lte: toDate },
    };

    if (user.role === Role.USER) {
      where.userId = user.id;
    } else if (userId) {
      where.userId = userId;
    }

    const logs = await prisma.callLog.groupBy({
      by: ["userId", "outcome"],
      where,
      _count: { _all: true },
    });

    const users = await prisma.user.findMany({
      where: { id: { in: [...new Set(logs.map((l) => l.userId))] } },
      select: { id: true, fullName: true },
    });
    const nameMap = Object.fromEntries(users.map((u) => [u.id, u.fullName]));

    return {
      from: fromDate,
      to: toDate,
      breakdown: logs.map((l) => ({
        userId: l.userId,
        userName: nameMap[l.userId] ?? l.userId,
        outcome: l.outcome,
        count: l._count._all,
      })),
    };
  });
}
