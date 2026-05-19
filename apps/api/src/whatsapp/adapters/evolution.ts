import type { IntegrationConfig, SendMessageInput, SendResult } from "../types.js";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function base(config: IntegrationConfig): string {
  const url = (config.baseUrl ?? "").replace(/\/$/, "");
  if (!url) throw new Error("Evolution base URL is required");
  return url;
}

export async function sendEvolution(
  config: IntegrationConfig,
  input: SendMessageInput
): Promise<SendResult> {
  const phone = normalizePhone(input.to);
  const root = base(config);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: config.accessToken,
  };

  if (input.mediaUrl) {
    const endpoint = `${root}/message/sendMedia/${config.instanceId}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: phone,
        mediatype: "image",
        media: input.mediaUrl,
        caption: input.message,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const sent = res.ok && !data.error;
    return {
      success: Boolean(sent),
      messageId: String((data.key as { id?: string })?.id ?? data.messageId ?? ""),
      error: sent ? undefined : String(data.error ?? data.message ?? res.statusText),
      raw: data,
    };
  }

  const endpoint = `${root}/message/sendText/${config.instanceId}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ number: phone, text: input.message }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const sent = res.ok && !data.error;

  return {
    success: Boolean(sent),
    messageId: String((data.key as { id?: string })?.id ?? data.messageId ?? ""),
    error: sent ? undefined : String(data.error ?? data.message ?? res.statusText),
    raw: data,
  };
}
