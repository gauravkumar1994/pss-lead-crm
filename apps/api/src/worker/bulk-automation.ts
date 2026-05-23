import { BulkBatchStatus, BulkSendStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  dispatchWhatsAppMessage,
  integrationFromDb,
} from "../whatsapp/dispatcher.js";

/* -----------------------------------------------------------
 * PSS Smart Bulk Automation worker (DB-only, BEAST rules).
 *
 * Per tick (default 60s), for every user whose UserBulkProfile.enabled = true:
 *   1) Daily reset (sentToday = 0 at midnight)
 *   2) Time window gate (startHour <= now < endHour)
 *   3) Daily target gate (sentToday < dailyTarget)
 *   4) Gap gate (now - lastSentAt >= gapMinutes [default 18])
 *   5) WhatsApp integration must exist + status=active
 *   6) Pick oldest PENDING recipient in an ACTIVE batch
 *   7) Compose: personalized text + (optional) one media file uploaded
 *      by the user via browse (stored locally, served by /media route)
 *   8) Send via user's assigned API (UltraMsg / AtozSender / Evolution)
 *   9) Update recipient + batch + profile + integration counters
 *
 * No Cloudinary. No Google Sheets runtime. No matching logic.
 * Media is whatever the user attached at batch creation time (a single
 * locally-uploaded image/video URL stored on `BulkBatch.mediaUrl`).
 * ----------------------------------------------------------- */

const TICK_MS = Number(process.env.BULK_TICK_MS ?? 60_000);

let timer: NodeJS.Timeout | null = null;
let running = false;

function sameDay(a?: Date | null, b?: Date | null) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

async function processOneUser(userId: string) {
  const profile = await prisma.userBulkProfile.findUnique({ where: { userId } });
  if (!profile || !profile.enabled) return;

  // Daily reset
  const now = new Date();
  if (!sameDay(profile.lastSentDate, now)) {
    await prisma.userBulkProfile.update({
      where: { userId },
      data: { sentToday: 0, lastSentDate: now },
    });
    profile.sentToday = 0;
    profile.lastSentDate = now;
  }

  // Time window gate (admin-controlled per user)
  const hour = now.getHours();
  if (hour < profile.startHour || hour >= profile.endHour) return;

  // Daily target gate
  if (profile.sentToday >= profile.dailyTarget) return;

  // 18-min gap gate (BEAST default)
  if (profile.lastSentAt) {
    const diffMs = now.getTime() - profile.lastSentAt.getTime();
    if (diffMs < profile.gapMinutes * 60_000) return;
  }

  // Provider integration must exist + active
  const integration = await prisma.userWhatsAppIntegration.findUnique({
    where: { userId },
  });
  if (!integration || integration.status !== "active") return;

  // Provider's own daily limit (per-user-API cap)
  if (integration.sentToday >= integration.dailyLimit) return;

  // Pick oldest PENDING recipient from ACTIVE batches owned by this user
  const recipient = await prisma.bulkRecipient.findFirst({
    where: {
      status: BulkSendStatus.PENDING,
      batch: { userId, status: BulkBatchStatus.ACTIVE },
    },
    orderBy: { id: "asc" },
    include: { batch: true },
  });
  if (!recipient) return;

  const message = recipient.personalized ?? recipient.batch.message ?? "";
  const mediaUrl = recipient.batch.mediaUrl ?? null;

  // Dispatch
  let result;
  try {
    result = await dispatchWhatsAppMessage(integrationFromDb(integration), {
      to: recipient.mobile,
      message,
      mediaUrl,
    });
  } catch (e) {
    result = {
      success: false,
      error: e instanceof Error ? e.message : "Send threw",
    };
  }

  if (result.success) {
    await prisma.$transaction([
      prisma.bulkRecipient.update({
        where: { id: recipient.id },
        data: {
          status: BulkSendStatus.SENT,
          sentAt: now,
          messageId: result.messageId,
        },
      }),
      prisma.bulkBatch.update({
        where: { id: recipient.batchId },
        data: { sent: { increment: 1 } },
      }),
      prisma.userBulkProfile.update({
        where: { userId },
        data: {
          sentToday: { increment: 1 },
          lastSentAt: now,
          lastSentDate: now,
        },
      }),
      prisma.userWhatsAppIntegration.update({
        where: { userId },
        data: { sentToday: { increment: 1 }, lastUsedAt: now },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.bulkRecipient.update({
        where: { id: recipient.id },
        data: {
          status: BulkSendStatus.FAILED,
          error: (result.error ?? "Send failed").slice(0, 500),
          retries: { increment: 1 },
        },
      }),
      prisma.bulkBatch.update({
        where: { id: recipient.batchId },
        data: { failed: { increment: 1 } },
      }),
    ]);
  }

  // Mark batch complete if all recipients done
  const pending = await prisma.bulkRecipient.count({
    where: { batchId: recipient.batchId, status: BulkSendStatus.PENDING },
  });
  if (pending === 0) {
    await prisma.bulkBatch.update({
      where: { id: recipient.batchId },
      data: { status: BulkBatchStatus.COMPLETED, completedAt: new Date() },
    });
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    const profiles = await prisma.userBulkProfile.findMany({
      where: { enabled: true },
      select: { userId: true },
    });
    // Each user's 18-min gap is independent — process all in parallel
    await Promise.all(
      profiles.map((p) =>
        processOneUser(p.userId).catch((e) => {
          console.error("[bulk-automation] user", p.userId, e);
        })
      )
    );
  } catch (e) {
    console.error("[bulk-automation] tick error", e);
  } finally {
    running = false;
  }
}

export function startBulkAutomationWorker() {
  if (timer) return;
  console.log(`[bulk-automation] starting — tick every ${TICK_MS}ms`);
  timer = setInterval(() => {
    void tick();
  }, TICK_MS);
  setTimeout(() => void tick(), 5_000);
}

export function stopBulkAutomationWorker() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
