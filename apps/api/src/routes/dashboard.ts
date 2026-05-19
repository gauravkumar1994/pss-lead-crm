import type { FastifyInstance } from "fastify";
import { Role, ActivityType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { getUser } from "../lib/auth.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook("onRequest", app.authenticate);

  app.get("/topbar", async (req) => {
    const user = getUser(req);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const callDayWhere = { createdAt: { gte: startOfDay, lte: endOfDay } };
    const myCallWhere =
      user.role === Role.USER ? { ...callDayWhere, userId: user.id } : callDayWhere;

    const [myCallsToday, myWhatsAppToday] = await Promise.all([
      prisma.callLog.count({ where: myCallWhere }),
      prisma.activity.count({
        where: {
          userId: user.id,
          type: ActivityType.WHATSAPP,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
    ]);

    return { myCallsToday, myWhatsAppToday };
  });

  app.get("/stats", async (req) => {
    const user = getUser(req);
    const leadWhere =
      user.role === Role.USER ? { assignedUserId: user.id, status: "active" } : { status: "active" };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const callDayWhere = { createdAt: { gte: startOfDay, lte: endOfDay } };
    const myCallWhere =
      user.role === Role.USER ? { ...callDayWhere, userId: user.id } : callDayWhere;

    const [
      totalLeads,
      convertedLeads,
      byStage,
      byType,
      todayFollowups,
      overdueFollowups,
      recentLeads,
      recentCampaigns,
      myCallsToday,
      teamCallStats,
      myWhatsAppToday,
      bulkCampaignsActive,
    ] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({ where: { ...leadWhere, stage: "CONVERTED" } }),
      prisma.lead.groupBy({ by: ["stage"], where: leadWhere, _count: true }),
      prisma.lead.groupBy({ by: ["leadType"], where: leadWhere, _count: true }),
      prisma.lead.count({
        where: { ...leadWhere, nextFollowup: { gte: startOfDay, lte: endOfDay } },
      }),
      prisma.lead.count({
        where: { ...leadWhere, nextFollowup: { lt: startOfDay, not: null } },
      }),
      prisma.lead.findMany({
        where: leadWhere,
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true,
          leadCode: true,
          name: true,
          mobile: true,
          stage: true,
          leadType: true,
          city: true,
          nextFollowup: true,
          whatsappCount: true,
          assignedUser: { select: { fullName: true } },
        },
      }),
      prisma.campaign.findMany({
        where: user.role === Role.USER ? { sentById: user.id } : {},
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          totalLeads: true,
          successCount: true,
          failedCount: true,
          createdAt: true,
        },
      }),
      prisma.callLog.count({ where: myCallWhere }),
      user.role === Role.USER
        ? []
        : prisma.callLog.groupBy({
            by: ["userId"],
            where: callDayWhere,
            _count: { _all: true },
          }),
      prisma.activity.count({
        where: {
          userId: user.id,
          type: ActivityType.WHATSAPP,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.campaign.count({
        where: {
          status: { in: ["SENDING", "PREPARED"] },
          ...(user.role === Role.USER ? { sentById: user.id } : {}),
        },
      }),
    ]);

    let teamCalls: { userId: string; userName: string; count: number }[] = [];
    if (user.role !== Role.USER && teamCallStats.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: teamCallStats.map((t) => t.userId) } },
        select: { id: true, fullName: true },
      });
      const nameMap = Object.fromEntries(users.map((u) => [u.id, u.fullName]));
      teamCalls = teamCallStats.map((t) => ({
        userId: t.userId,
        userName: nameMap[t.userId] ?? t.userId,
        count: t._count._all,
      }));
    }

    return {
      totalLeads,
      convertedLeads,
      activeLeads: totalLeads - convertedLeads,
      byStage: byStage.map((s) => ({ stage: s.stage, count: s._count })),
      byType: byType.map((t) => ({ leadType: t.leadType, count: t._count })),
      todayFollowups,
      overdueFollowups,
      recentLeads,
      recentCampaigns,
      myCallsToday,
      teamCalls,
      myWhatsAppToday,
      bulkCampaignsActive,
    };
  });
}
