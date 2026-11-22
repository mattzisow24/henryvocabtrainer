import "server-only";

// Sends email through whichever service is configured:
//   - Gmail: GMAIL_USER + GMAIL_APP_PASSWORD (an app password, not the account password)
//   - Resend: RESEND_API_KEY + EMAIL_FROM (an address on a domain verified in Resend)

import nodemailer from "nodemailer";

export type Email = { to: string[]; subject: string; text: string; html: string };

const gmail = () => (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } : null);
const resend = () => (process.env.RESEND_API_KEY && process.env.EMAIL_FROM ? { key: process.env.RESEND_API_KEY, from: process.env.EMAIL_FROM } : null);

export function emailConfigured(): boolean {
  return !!(gmail() || resend());
}

export async function sendEmail(email: Email): Promise<void> {
  const g = gmail();
  if (g) {
    const transport = nodemailer.createTransport({ service: "gmail", auth: { user: g.user, pass: g.pass.replace(/\s/g, "") } });
    await transport.sendMail({ from: `SAT Vocab <${g.user}>`, to: email.to, subject: email.subject, text: email.text, html: email.html });
    return;
  }
  const r = resend();
  if (r) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${r.key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: r.from, to: email.to, subject: email.subject, text: email.text, html: email.html }),
    });
    if (!res.ok) throw new Error(`Resend rejected the email: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return;
  }
  throw new Error("No email service is configured");
}
