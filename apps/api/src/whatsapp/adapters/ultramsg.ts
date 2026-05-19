import type { IntegrationConfig, SendMessageInput, SendResult } from "../types.js";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function sendUltraMsg(
  config: IntegrationConfig,
  input: SendMessageInput
): Promise<SendResult> {
  const phone = normalizePhone(input.to);
  const base = `https://api.ultramsg.com/${config.instanceId}`;

  const body: Record<string, string> = {
    token: config.accessToken,
    to: phone,
    body: input.message,
  };

  const endpoint = input.mediaUrl
    ? `${base}/messages/image`
    : `${base}/messages/chat`;

  if (input.mediaUrl) {
    body.image = input.mediaUrl;
    body.caption = input.message;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const sent = res.ok && !data.error;

  return {
    success: Boolean(sent),
    messageId: String(data.id ?? data.message_id ?? ""),
    error: sent ? undefined : String(data.error ?? data.message ?? res.statusText),
    raw: data,
  };
}
