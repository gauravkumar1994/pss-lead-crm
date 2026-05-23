import type { IntegrationConfig, SendMessageInput, SendResult } from "../types.js";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|avi|mpeg|m4v|3gp)(\?|$)/i.test(url);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/** Single send (text or one media). */
async function sendOne(
  config: IntegrationConfig,
  to: string,
  body: string,
  mediaUrl: string | null
): Promise<SendResult> {
  const base = `https://api.ultramsg.com/${config.instanceId}`;
  const phone = normalizePhone(to);

  const payload: Record<string, string> = {
    token: config.accessToken,
    to: phone,
    body,
  };

  let endpoint: string;
  if (mediaUrl) {
    if (isVideoUrl(mediaUrl)) {
      endpoint = `${base}/messages/video`;
      payload.video = mediaUrl;
    } else {
      endpoint = `${base}/messages/image`;
      payload.image = mediaUrl;
    }
    payload.caption = body;
  } else {
    endpoint = `${base}/messages/chat`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(payload),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const sent = res.ok && !data.error && data.sent !== false;

  return {
    success: Boolean(sent),
    messageId: String(data.id ?? data.message_id ?? ""),
    error: sent ? undefined : String(data.error ?? data.message ?? res.statusText),
    raw: data,
  };
}

export async function sendUltraMsg(
  config: IntegrationConfig,
  input: SendMessageInput
): Promise<SendResult> {
  // Build effective media list: prefer mediaUrls[], fallback to single mediaUrl
  const list =
    input.mediaUrls && input.mediaUrls.length > 0
      ? input.mediaUrls
      : input.mediaUrl
      ? [input.mediaUrl]
      : [];

  // No media — single text send
  if (list.length === 0) {
    return sendOne(config, input.to, input.message, null);
  }

  // One media — single image/video send (caption = message)
  if (list.length === 1) {
    return sendOne(config, input.to, input.message, list[0]);
  }

  // Multiple media — loop: caption on first, blanks after, 1s delay (BEAST pattern)
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
