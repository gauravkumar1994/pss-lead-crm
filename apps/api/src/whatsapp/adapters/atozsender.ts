import type { IntegrationConfig, SendMessageInput, SendResult } from "../types.js";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

export async function sendAtozSender(
  config: IntegrationConfig,
  input: SendMessageInput
): Promise<SendResult> {
  const phone = normalizePhone(input.to);

  if (input.mediaUrl && isPdfUrl(input.mediaUrl)) {
    return {
      success: false,
      error: "AtozSender does not support PDF media. Use an image URL.",
    };
  }

  const payload: Record<string, string> = {
    number: phone,
    type: input.mediaUrl ? "media" : "text",
    message: input.message,
    instance_id: config.instanceId,
    access_token: config.accessToken,
  };

  if (input.mediaUrl) {
    payload.media_url = input.mediaUrl;
    payload.caption = input.message;
  }

  const res = await fetch("https://send.atozsender.com/api/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const status = String(data.status ?? data.success ?? "").toLowerCase();
  const sent =
    res.ok &&
    (status === "success" || status === "true" || data.success === true);

  if (sent && data.message?.toString().toLowerCase().includes("queued")) {
    return { success: true, messageId: "queued", raw: data };
  }

  return {
    success: Boolean(sent),
    messageId: String(data.id ?? ""),
    error: sent ? undefined : String(data.message ?? data.error ?? "Send failed"),
    raw: data,
  };
}
