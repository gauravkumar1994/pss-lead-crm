import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { runCampaignBulk } from "./campaign-runner.js";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = new Redis(redisUrl, { maxRetriesPerRequest: null });

export const campaignQueue = new Queue("campaigns", { connection });

export function startCampaignWorker() {
  const worker = new Worker(
    "campaigns",
    async (job) => {
      const { campaignId, userId } = job.data as {
        campaignId: string;
        userId: string;
      };
      await runCampaignBulk(campaignId, userId);
    },
    { connection, concurrency: 1 }
  );

  worker.on("failed", (job, err) => {
    console.error("Campaign job failed", job?.id, err);
  });

  return worker;
}
