import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import nodemailer from "nodemailer";

const INTERNAL_KEY = process.env.SEND_EMAIL_SECRET;

const transporter = nodemailer.createTransport({
  host: "smtp.worksmobile.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(request: NextRequest) {
  // 내부 호출만 허용
  if (!INTERNAL_KEY) {
    console.error("[send-email] SEND_EMAIL_SECRET 환경변수 미설정");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }
  const key = request.headers.get("x-server-key") || "";
  if (
    key.length !== INTERNAL_KEY.length ||
    !timingSafeEqual(Buffer.from(key), Buffer.from(INTERNAL_KEY))
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { to, subject, html } = await request.json();
    if (!to || !subject || !html) {
      return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
    }

    const fromName = process.env.SMTP_FROM_NAME || "폴라애드";
    const fromEmail = process.env.SMTP_USER || "mkt@polarad.co.kr";

    await transporter.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("이메일 발송 실패:", error);
    return NextResponse.json({ error: "이메일 발송 실패" }, { status: 500 });
  }
}
