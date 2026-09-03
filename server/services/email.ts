/**
 * Outbound email.
 *
 * Resend is the transport, reached over its HTTP API so there is no SDK to keep
 * in step. Everything funnels through `sendEmail` so swapping providers later
 * touches one file.
 *
 * Without RESEND_API_KEY nothing is sent and the message is logged instead.
 * That keeps development and CI working, and means a misconfigured deploy fails
 * visibly in the logs rather than throwing on every signup.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Adds List-Unsubscribe headers so mail clients show a native option. */
  unsubscribeUrl?: string;
}

export interface SendResult {
  sent: boolean;
  /** Why it was not sent, when it was not. */
  reason?: string;
}

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fromAddress(): string {
  return process.env.NEWSLETTER_FROM ?? "Des Moines Insider <hello@desmoinesinsider.com>";
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      `[email] RESEND_API_KEY not set; skipping send to ${message.to} ("${message.subject}")`,
    );
    return { sent: false, reason: "not_configured" };
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const body: Record<string, unknown> = {
    from: fromAddress(),
    to: [message.to],
    subject: message.subject,
    html: message.html,
    text: message.text,
  };

  if (message.unsubscribeUrl) {
    // RFC 8058: mail clients surface a native unsubscribe control from these.
    body.headers = {
      "List-Unsubscribe": `<${message.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[email] Resend rejected send to ${message.to}: ${detail}`);
      return { sent: false, reason: `http_${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error(`[email] Failed to send to ${message.to}:`, error);
    return { sent: false, reason: "request_failed" };
  }
}
