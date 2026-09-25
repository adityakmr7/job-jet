import { optionalEnv, type EnvSource } from "./env";

/**
 * Pluggable transactional email (verification links, password resets).
 *
 * - ResendEmailSender: used when RESEND_API_KEY is set (EMAIL_FROM sets the
 *   sender, e.g. "Job Jet <no-reply@yourdomain.com>" on a domain verified in
 *   Resend). Talks to Resend's REST API directly — no SDK dependency.
 * - ConsoleEmailSender: the fallback. In development it prints the message
 *   (including the link) to the server console so you can click through
 *   locally. In production it NEVER logs the body — a reset/verification
 *   link in logs is a credential — it only warns that no provider is set.
 *
 * Swap in another provider by implementing EmailSender and returning it
 * from getEmailSender().
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailSender implements EmailSender {
  readonly name = "console";
  constructor(
    private readonly isProduction: boolean,
    private readonly log: (...args: unknown[]) => void = console.info
  ) {}

  async send(message: EmailMessage): Promise<void> {
    if (this.isProduction) {
      console.warn(
        `[email] No email provider configured (set RESEND_API_KEY); dropped "${message.subject}" to ${redactEmail(message.to)}.`
      );
      return;
    }
    this.log(`\n[email:dev] To: ${message.to}\n[email:dev] Subject: ${message.subject}\n${message.text}\n`);
  }
}

export class ResendEmailSender implements EmailSender {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async send(message: EmailMessage): Promise<void> {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend rejected the email (${res.status}): ${detail.slice(0, 200)}`);
    }
  }
}

export function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

export const DEFAULT_EMAIL_FROM = "Job Jet <onboarding@resend.dev>";

export function createEmailSender(env: EnvSource = process.env): EmailSender {
  const apiKey = optionalEnv("RESEND_API_KEY", env);
  if (apiKey) return new ResendEmailSender(apiKey, optionalEnv("EMAIL_FROM", env) ?? DEFAULT_EMAIL_FROM);
  return new ConsoleEmailSender(env.NODE_ENV === "production");
}

let _sender: EmailSender | null = null;
export function getEmailSender(): EmailSender {
  if (!_sender) _sender = createEmailSender();
  return _sender;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal branded email with a single call-to-action link. */
export function actionEmail({
  to,
  subject,
  heading,
  body,
  actionLabel,
  url,
}: {
  to: string;
  subject: string;
  heading: string;
  body: string;
  actionLabel: string;
  url: string;
}): EmailMessage {
  const text = `${heading}\n\n${body}\n\n${actionLabel}: ${url}\n\nIf you didn't request this, you can ignore this email.\n— Job Jet`;
  const html = `<!doctype html><html><body style="margin:0;background:#f5f6fa;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0e1330">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;padding:32px">
<tr><td style="font-size:18px;font-weight:700;color:#3346e0">Job Jet</td></tr>
<tr><td style="padding-top:20px;font-size:20px;font-weight:600">${escapeHtml(heading)}</td></tr>
<tr><td style="padding-top:12px;font-size:14px;line-height:1.6;color:#555c78">${escapeHtml(body)}</td></tr>
<tr><td style="padding-top:24px"><a href="${escapeHtml(url)}" style="display:inline-block;background:#3346e0;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:999px">${escapeHtml(actionLabel)}</a></td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#555c78">If you didn't request this, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`;
  return { to, subject, text, html };
}
