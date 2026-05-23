import type { IntegrationConfig, SendMessageInput, SendResult } from "../types.js";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|$)/i.test(url);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Single send (text or one media). */
async function sendOne(
  config: IntegrationConfig,
  to: string,
  message: string,
  mediaUrl: string | null
): Promise<SendResult> {
  const phone = normalizePhone(to);

  if (mediaUrl && isPdfUrl(mediaUrl)) {
    return {
      success: false,
      error: "AtozSender does not support PDF media. Use an image/video URL.",
    };
  }

  const payload: Record<string, string> = {
    number: phone,
    type: mediaUrl ? "media" : "text",
    message,
    instance_id: config.instanceId,
    access_token: config.accessToken,
  };
  if (mediaUrl) {
    payload.media_url = mediaUrl;
    payload.caption = message;
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

export async function sendAtozSender(
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
