import { prisma } from "../lib/prisma.js";
import {
  dispatchWhatsAppMessage,
  integrationFromDb,
} from "../whatsapp/dispatcher.js";
import { CampaignStatus, DeliveryStatus, ActivityType } from "@prisma/client";

const DELAY_MS = 3000;

/** Runs bulk campaign without Redis/Docker (local file database mode). */
export async function runCampaignBulk(campaignId: string, userId: string) {
  const integration = await prisma.userWhatsAppIntegration.findUnique({
    where: { userId },
  });
  if (!integration) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: CampaignStatus.FAILED },
    });
    return;
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { recipients: { where: { status: DeliveryStatus.PENDING } } },
  });
  if (!campaign) return;

  let success = 0;
  let failed = 0;
  const config = integrationFromDb(integration);

  for (const recipient of campaign.recipients) {
    const result = await dispatchWhatsAppMessage(config, {
      to: recipient.mobile,
      message: recipient.personalized ?? campaign.message,
      mediaUrl: campaign.mediaUrl,
    });

    if (result.success) {
      success++;
      await prisma.$transaction([
        prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: DeliveryStatus.SENT,
            sentAt: new Date(),
            provider: integration.provider,
          },
        }),
        prisma.lead.update({
          where: { id: recipient.leadId },
          data: {
            whatsappCount: { increment: 1 },
            lastWhatsappAt: new Date(),
          },
        }),
        prisma.activity.create({
          data: {
            leadId: recipient.leadId,
            userId,
            type: ActivityType.WHATSAPP,
            content: `[Campaign ${campaign.campaignCode}] ${(recipient.personalized ?? campaign.message).slice(0, 200)}`,
          },
        }),
      ]);
    } else {
      failed++;
      await prisma.campaignRecipient.update({
        where: { id: recipient.id },
        data: {
          status: DeliveryStatus.FAILED,
          error: result.error ?? "Unknown error",
          provider: integration.provider,
        },
      });
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  const finalStatus =
    failed === 0
      ? CampaignStatus.COMPLETED
      : success === 0
        ? CampaignStatus.FAILED
        : CampaignStatus.PARTIAL;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: finalStatus,
      successCount: { increment: success },
      failedCount: { increment: failed },
    },
  });

  await prisma.userWhatsAppIntegration.update({
    where: { userId },
    data: { sentToday: { increment: success }, lastUsedAt: new Date() },
  });
}
