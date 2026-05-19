import type { WhatsAppProvider } from "@prisma/client";

export type IntegrationConfig = {
  provider: WhatsAppProvider;
  instanceId: string;
  accessToken: string;
  baseUrl?: string | null;
};

export type SendMessageInput = {
  to: string;
  message: string;
  mediaUrl?: string | null;
};

export type SendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
};
