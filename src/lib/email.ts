import { Resend } from "resend";

// Sends the run report via Resend. Returns false (warns) if RESEND_API_KEY is unset.
export async function sendReportEmail(args: {
  to: string;
  subject: string;
  text: string;
  filename: string;
  xlsx: Buffer;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.error("  Email skipped: RESEND_API_KEY not set.");
    return false;
  }
  const from = process.env.RESEND_FROM ?? "Market Intel <onboarding@resend.dev>";
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to: args.to,
    subject: args.subject,
    text: args.text,
    attachments: [{ filename: args.filename, content: args.xlsx }],
  });
  if (error) throw error;
  return true;
}
