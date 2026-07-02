import "server-only";

/**
 * Outbound email. Sends through Resend (https://resend.com) when
 * RESEND_API_KEY and EMAIL_FROM are configured; otherwise (and on any send
 * failure) it falls back to logging the message — including any action link —
 * to the server console so flows are testable locally without a provider.
 *
 * Note: the EMAIL_FROM domain must be verified in the Resend dashboard
 * (DNS records for anav.mn), or the API rejects the send.
 */
export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM = process.env.EMAIL_FROM ?? "";

/** Absolute base URL for links in emails. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export async function sendEmail(mail: Mail): Promise<void> {
  if (API_KEY && FROM) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM,
          to: [mail.to],
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        }),
      });
      if (!res.ok) {
        throw new Error(`Resend API ${res.status}: ${await res.text()}`);
      }
      return;
    } catch (err) {
      // Loud, structured log so a prod misconfig (unverified domain, bad key)
      // is diagnosable from the container logs rather than silently swallowed.
      // FROM is config, not a secret.
      console.error(
        `[email] Resend send FAILED — to=${mail.to} from=${FROM} subject="${mail.subject}":`,
        err,
      );
    }
  }

  // Dev fallback: surface the message (and its link) in the server logs.
  console.log(
    `\n📧 [email:dev] no email delivery configured — message follows\n   to:      ${mail.to}\n   subject: ${mail.subject}\n   ----\n${mail.text}\n   ----\n`,
  );
}
