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

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function detectMediaType(url: string): "image" | "video" {
  return /\.(mp4|mov|avi|mpeg|m4v|3gp)(\?|$)/i.test(url) ? "video" : "image";
}

async function sendOne(
  config: IntegrationConfig,
  to: string,
  message: string,
  mediaUrl: string | null
): Promise<SendResult> {
  const phone = normalizePhone(to);
  const root = base(config);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: config.accessToken,
  };

  if (mediaUrl) {
    const endpoint = `${root}/message/sendMedia/${config.instanceId}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        number: phone,
        mediatype: detectMediaType(mediaUrl),
        media: mediaUrl,
        caption: message,
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
    body: JSON.stringify({ number: phone, text: message }),
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

export async function sendEvolution(
  config: IntegrationConfig,
  input: SendMessageInput
): Promise<SendResult> {
  const list =
    input.mediaUrls && input.mediaUrls.length > 0
      ? input.mediaUrls
      : input.mediaUrl
      ? [input.mediaUrl]
      : [];

  if (list.length === 0) {
    return sendOne(config, input.to, input.message, null);
  }
  if (list.length === 1) {
    return sendOne(config, input.to, input.message, list[0]);
  }

  let okCount = 0;
  let lastErr = "";
  let lastMsgId = "";
  for (let i = 0; i < list.length; i++) {
    const r = await sendOne(
      config,
      input.to,
      i === 0 ? input.message : "",
      list[i]
    );
    if (r.success) {
      okCount++;
      if (r.messageId) lastMsgId = r.messageId;
    } else if (r.error) {
      lastErr = r.error;
    }
    if (i < list.length - 1) await sleep(1000);
  }

  return {
    success: okCount === list.length,
    mediaCount: okCount,
    messageId: lastMsgId,
    error:
      okCount === list.length
        ? undefined
        : `Sent ${okCount}/${list.length} media. Last error: ${lastErr || "unknown"}`,
  };
}
