import type { FastifyInstance } from "fastify";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser } from "../lib/auth.js";

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

const leadSelect = {
  id: true,
  leadCode: true,
  name: true,
  mobile: true,
  city: true,
  stage: true,
  leadType: true,
  nextFollowup: true,
  lastFollowup: true,
  followupNotes: true,
  assignedUser: { select: { fullName: true } },
} as const;

export async function followupRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/", async (req) => {
    const user = getUser(req);
    const { start, end } = dayBounds();
    const base =
      user.role === Role.USER
        ? { status: "active", assignedUserId: user.id }
        : { status: "active" };

    const [overdue, today, upcoming, noDate] = await Promise.all([
      prisma.lead.findMany({
        where: { ...base, nextFollowup: { lt: start, not: null } },
        orderBy: { nextFollowup: "asc" },
        take: 100,
        select: leadSelect,
      }),
      prisma.lead.findMany({
        where: { ...base, nextFollowup: { gte: start, lte: end } },
        orderBy: { nextFollowup: "asc" },
        take: 100,
        select: leadSelect,
      }),
      prisma.lead.findMany({
        where: { ...base, nextFollowup: { gt: end } },
        orderBy: { nextFollowup: "asc" },
        take: 50,
        select: leadSelect,
      }),
      prisma.lead.findMany({
        where: { ...base, nextFollowup: null },
        orderBy: { updatedAt: "desc" },
        take: 30,
        select: leadSelect,
      }),
    ]);

    return {
      overdue: { count: overdue.length, items: overdue },
      today: { count: today.length, items: today },
      upcoming: { count: upcoming.length, items: upcoming },
      noFollowupDate: { count: noDate.length, items: noDate },
    };
  });
}
