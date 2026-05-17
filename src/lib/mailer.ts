import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "smtp.worksmobile.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || "mkt@polarad.co.kr";
const SMTP_PASS = process.env.SMTP_PASS;

export interface SendHtmlMailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType?: string;
  }[];
}

export function getMailerStatus() {
  return {
    host: SMTP_HOST,
    port: SMTP_PORT,
    fromEmail: SMTP_USER,
    ready: Boolean(SMTP_PASS),
  };
}

function assertMailerConfig(): void {
  if (!SMTP_PASS) {
    throw new Error("SMTP 환경변수 누락: SMTP_PASS");
  }
}

export async function sendHtmlMail(input: SendHtmlMailInput): Promise<void> {
  assertMailerConfig();

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const fromName = process.env.SMTP_FROM_NAME || "폴라애드";

  await transporter.sendMail({
    from: `${fromName} <${SMTP_USER}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
    attachments: input.attachments,
  });
}
