import type { WhatsAppProvider } from "@prisma/client";
import { sendUltraMsg } from "./adapters/ultramsg.js";
import { sendAtozSender } from "./adapters/atozsender.js";
import { sendEvolution } from "./adapters/evolution.js";
import type { IntegrationConfig, SendMessageInput, SendResult } from "./types.js";

export async function dispatchWhatsAppMessage(
  config: IntegrationConfig,
  input: SendMessageInput
): Promise<SendResult> {
  switch (config.provider) {
    case "ULTRAMSG":
      return sendUltraMsg(config, input);
    case "ATOZSENDER":
      return sendAtozSender(config, input);
    case "EVOLUTION":
      return sendEvolution(config, input);
    default: {
      const p: never = config.provider;
      return { success: false, error: `Unknown provider: ${p}` };
    }
  }
}

export function integrationFromDb(row: {
  provider: WhatsAppProvider;
  instanceId: string;
  accessToken: string;
  baseUrl: string | null;
}): IntegrationConfig {
  return {
    provider: row.provider,
    instanceId: row.instanceId,
    accessToken: row.accessToken,
    baseUrl: row.baseUrl,
  };
}
