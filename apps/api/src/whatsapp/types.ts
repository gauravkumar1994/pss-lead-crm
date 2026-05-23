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
  /** Single media URL (backward-compat, used by Quick Send + legacy bulk). */
  mediaUrl?: string | null;
  /** Multiple media URLs (Smart Bulk Automation can send N photos per recipient).
   *  When set and non-empty, adapter must loop and send each one separately —
   *  caption on the FIRST item only, ~1s delay between sends.
   *  If both `mediaUrl` and `mediaUrls` are set, `mediaUrls` wins. */
  mediaUrls?: string[];
};

export type SendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  raw?: unknown;
  /** When multiple media sent, how many of them succeeded */
  mediaCount?: number;
};
