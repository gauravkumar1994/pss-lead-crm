import { runCampaignBulk } from "./campaign-runner.js";

let queueModule: typeof import("./queue-redis.js") | null = null;

async function getRedisQueue() {
  if (process.env.USE_REDIS !== "true") return null;
  try {
    if (!queueModule) queueModule = await import("./queue-redis.js");
    return queueModule;
  } catch {
    console.warn("Redis queue unavailable — using in-process campaign runner");
    return null;
  }
}

/** Queue campaign via Redis if available, else run in background without Docker. */
export async function enqueueCampaign(campaignId: string, userId: string) {
  const redis = await getRedisQueue();
  if (redis) {
    await redis.campaignQueue.add(
      "bulk-send",
      { campaignId, userId },
      { jobId: `campaign-${campaignId}` }
    );
    return;
  }

  void runCampaignBulk(campaignId, userId).catch((err) => {
    console.error("Campaign run failed:", err);
  });
}

export function startCampaignWorker() {
  if (process.env.USE_REDIS !== "true") {
    console.log("Local mode: Redis worker skipped (SQLite + in-process campaigns)");
    return null;
  }
  void getRedisQueue().then((m) => m?.startCampaignWorker());
  return null;
}
