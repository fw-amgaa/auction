import "server-only";

/**
 * Outbound email. Sends through AWS SES when SES_FROM_EMAIL is configured;
 * otherwise (and on any SES failure) it falls back to logging the message —
 * including any action link — to the server console so flows are testable
 * locally without a provider.
 *
 * Note: SES in "sandbox" mode only delivers to verified addresses. If real
 * mail isn't arriving, check the SES console (sandbox / verified sender).
 */
export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const FROM = process.env.SES_FROM_EMAIL ?? "";
const REGION = process.env.SES_REGION ?? process.env.AWS_REGION ?? process.env.S3_REGION;

/** Absolute base URL for links in emails. */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export async function sendEmail(mail: Mail): Promise<void> {
  if (FROM) {
    try {
      const { SESv2Client, SendEmailCommand } = await import("@aws-sdk/client-sesv2");
      const client = new SESv2Client(REGION ? { region: REGION } : {});
      await client.send(
        new SendEmailCommand({
          FromEmailAddress: FROM,
          Destination: { ToAddresses: [mail.to] },
          Content: {
            Simple: {
              Subject: { Data: mail.subject, Charset: "UTF-8" },
              Body: {
                Html: { Data: mail.html, Charset: "UTF-8" },
                Text: { Data: mail.text, Charset: "UTF-8" },
              },
            },
          },
        }),
      );
      return;
    } catch (err) {
      console.error("[email] SES send failed — falling back to console log:", err);
    }
  }

  // Dev fallback: surface the message (and its link) in the server logs.
  console.log(
    `\n📧 [email:dev] no SES delivery — message follows\n   to:      ${mail.to}\n   subject: ${mail.subject}\n   ----\n${mail.text}\n   ----\n`,
  );
}
