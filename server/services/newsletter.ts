import { randomBytes } from "crypto";
import { format } from "date-fns";
import { storage } from "../storage.js";
import { sendEmail, type EmailMessage } from "./email.js";
import { getWeekendRange, weekendDayFor } from "@shared/weekend.js";
import type { Event, NewsletterSubscription } from "@shared/schema.js";

/**
 * The weekly issue: the This Weekend page, in an inbox.
 *
 * Built from the same weekend window the site uses, so the email and the page
 * never disagree about what "this weekend" means.
 */

/** Unguessable token, used for both confirming and unsubscribing. */
export function createToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Public base URL for links in emails.
 *
 * Links must be absolute and must point at the real site, so this comes from
 * configuration rather than from a request header, which an attacker could set.
 */
export function siteUrl(): string {
  return (process.env.PUBLIC_URL ?? "http://localhost:5000").replace(/\/+$/, "");
}

export function confirmUrl(token: string): string {
  return `${siteUrl()}/api/newsletter/confirm?token=${encodeURIComponent(token)}`;
}

export function unsubscribeUrl(token: string): string {
  return `${siteUrl()}/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Minimal HTML escaping for values interpolated into the email body. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BASE_STYLES = `
  body { margin:0; padding:0; background:#f5f5f4; }
  .wrap { max-width:600px; margin:0 auto; padding:24px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; color:#1c1917; }
  .card { background:#ffffff; border-radius:12px; padding:24px; }
  h1 { font-size:24px; margin:0 0 4px; }
  h2 { font-size:17px; margin:28px 0 12px; color:#0f172a; }
  .muted { color:#78716c; font-size:14px; margin:0 0 20px; }
  .event { border-top:1px solid #e7e5e4; padding:14px 0; }
  .event a { color:#1d4ed8; text-decoration:none; font-weight:600; font-size:16px; }
  .meta { color:#57534e; font-size:14px; margin:4px 0 0; }
  .tag { display:inline-block; background:#f5f5f4; color:#44403c; border-radius:999px; padding:2px 8px; font-size:12px; margin-right:4px; }
  .footer { color:#78716c; font-size:12px; text-align:center; padding:20px 8px 0; }
  .footer a { color:#78716c; }
`;

function eventHtml(event: Event): string {
  const when = format(new Date(event.date), "h:mm a");
  const flags: string[] = [];
  if (event.isFree) flags.push("Free");
  if (event.isKidFriendly) flags.push("Kid-friendly");
  if (event.isIndoor) flags.push("Indoor");

  const href = event.slug ? `${siteUrl()}/events/${event.slug}` : siteUrl();

  return `
    <div class="event">
      <a href="${escapeHtml(href)}">${escapeHtml(event.title)}</a>
      <p class="meta">${escapeHtml(when)} &middot; ${escapeHtml(event.venue || event.location)}</p>
      ${flags.length ? `<p class="meta">${flags.map((f) => `<span class="tag">${f}</span>`).join("")}</p>` : ""}
    </div>`;
}

function eventText(event: Event): string {
  const when = format(new Date(event.date), "h:mm a");
  const href = event.slug ? `${siteUrl()}/events/${event.slug}` : siteUrl();
  return `- ${event.title} (${when}, ${event.venue || event.location})\n  ${href}`;
}

export interface WeeklyIssue {
  subject: string;
  html: string;
  text: string;
  eventCount: number;
}

/**
 * Render the current issue.
 *
 * Returns null when there is nothing on. Sending an empty newsletter trains
 * people to ignore it, so we would rather skip a week.
 */
export async function buildWeeklyIssue(): Promise<WeeklyIssue | null> {
  const weekend = getWeekendRange();
  const events = await storage.getEventsBetween(weekend.start, weekend.end);

  if (events.length === 0) return null;

  const days = weekend.days.map((day) => ({
    ...day,
    events: events.filter(
      (event) => weekendDayFor(new Date(event.date), weekend)?.date === day.date,
    ),
  }));

  const dateLabel = `${format(weekend.days[0].start, "MMMM d")}-${format(weekend.days[2].start, "d")}`;
  const subject = `This weekend in Des Moines: ${dateLabel}`;

  const sections = days
    .filter((day) => day.events.length > 0)
    .map(
      (day) => `
        <h2>${day.label}, ${format(day.start, "MMMM d")}</h2>
        ${day.events.map(eventHtml).join("")}`,
    )
    .join("");

  const html = `
    <html><head><meta charset="utf-8"><style>${BASE_STYLES}</style></head>
    <body><div class="wrap"><div class="card">
      <h1>This weekend in Des Moines</h1>
      <p class="muted">${escapeHtml(dateLabel)} &middot; ${events.length} ${events.length === 1 ? "event" : "events"}</p>
      ${sections}
      <p style="margin-top:28px;">
        <a href="${siteUrl()}/this-weekend" style="color:#1d4ed8;font-weight:600;">See everything on the site &rarr;</a>
      </p>
    </div>
    <div class="footer">
      <p>Des Moines Insider &middot; written for people who live here</p>
      <p><a href="{{UNSUBSCRIBE_URL}}">Unsubscribe</a></p>
    </div></div></body></html>`;

  const textSections = days
    .filter((day) => day.events.length > 0)
    .map(
      (day) =>
        `${day.label}, ${format(day.start, "MMMM d")}\n${day.events.map(eventText).join("\n")}`,
    )
    .join("\n\n");

  const text = `This weekend in Des Moines (${dateLabel})\n\n${textSections}\n\nSee everything: ${siteUrl()}/this-weekend\n\nUnsubscribe: {{UNSUBSCRIBE_URL}}`;

  return { subject, html, text, eventCount: events.length };
}

/** Swap the per-recipient unsubscribe link into a rendered issue. */
function personalize(issue: WeeklyIssue, token: string): EmailMessage & { to: string } {
  const url = unsubscribeUrl(token);
  return {
    to: "",
    subject: issue.subject,
    html: issue.html.replaceAll("{{UNSUBSCRIBE_URL}}", escapeHtml(url)),
    text: issue.text.replaceAll("{{UNSUBSCRIBE_URL}}", url),
    unsubscribeUrl: url,
  };
}

export async function sendConfirmationEmail(
  subscription: NewsletterSubscription,
): Promise<void> {
  if (!subscription.confirmToken) return;

  const link = confirmUrl(subscription.confirmToken);
  const html = `
    <html><head><meta charset="utf-8"><style>${BASE_STYLES}</style></head>
    <body><div class="wrap"><div class="card">
      <h1>Confirm your subscription</h1>
      <p class="muted">One click and you are on the Thursday list.</p>
      <p><a href="${escapeHtml(link)}" style="color:#1d4ed8;font-weight:600;">Confirm my email &rarr;</a></p>
      <p class="meta">If you did not sign up for Des Moines Insider, ignore this and nothing happens.</p>
    </div></div></body></html>`;

  await sendEmail({
    to: subscription.email,
    subject: "Confirm your Des Moines Insider subscription",
    html,
    text: `Confirm your Des Moines Insider subscription: ${link}\n\nIf you did not sign up, ignore this email.`,
  });
}

export interface SendReport {
  attempted: number;
  sent: number;
  skipped: string | null;
}

/** Send the current issue to every confirmed subscriber. */
export async function sendWeeklyIssue(): Promise<SendReport> {
  const issue = await buildWeeklyIssue();
  if (!issue) {
    return { attempted: 0, sent: 0, skipped: "no events this weekend" };
  }

  const subscribers = await storage.getConfirmedSubscribers();
  let sent = 0;

  for (const subscriber of subscribers) {
    if (!subscriber.confirmToken) continue;
    const message = personalize(issue, subscriber.confirmToken);
    const result = await sendEmail({ ...message, to: subscriber.email });
    if (result.sent) sent += 1;
  }

  return { attempted: subscribers.length, sent, skipped: null };
}

/** Send the current issue to one address, for checking before a real send. */
export async function sendTestIssue(to: string): Promise<SendReport> {
  const issue = await buildWeeklyIssue();
  if (!issue) {
    return { attempted: 0, sent: 0, skipped: "no events this weekend" };
  }

  const message = personalize(issue, "test-token-not-a-real-subscription");
  const result = await sendEmail({ ...message, to });
  return { attempted: 1, sent: result.sent ? 1 : 0, skipped: null };
}
