import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { sendHtmlMail } from "@/lib/mailer";
import { requireAuth } from "@/lib/auth-check";
import {
  DEFAULT_MAIL_SMS_MESSAGE,
  getAdminMailGuide,
  normalizeAdminMailCategoryId,
  renderAdminCustomMailHtml,
  renderAdminMailGuideHtml,
} from "@/lib/admin-mail-guides";
import { sendLMS } from "@/lib/ncp-sens";

export const runtime = "nodejs";

const INTERNAL_KEY = process.env.SEND_EMAIL_SECRET;
const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_TOTAL_BYTES = 15 * 1024 * 1024;

function hasValidInternalKey(request: NextRequest): boolean {
  if (!INTERNAL_KEY) return false;

  const key = request.headers.get("x-server-key") || "";
  return (
    key.length === INTERNAL_KEY.length &&
    timingSafeEqual(Buffer.from(key), Buffer.from(INTERNAL_KEY))
  );
}

function parseRecipients(value: unknown): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

class AttachmentValidationError extends Error {}

function boolValue(value: unknown): boolean {
  return value === true || value === "true" || value === "1" || value === "on";
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isUploadedFile(value: FormDataEntryValue): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function safeFilename(value: string): string {
  return (value || "attachment").replace(/[\\/\r\n]/g, "_");
}

async function parseAttachments(entries: FormDataEntryValue[]) {
  const files = entries.filter(isUploadedFile).filter((file) => file.size > 0);
  if (files.length > MAX_ATTACHMENT_COUNT) {
    throw new AttachmentValidationError(
      `첨부파일은 최대 ${MAX_ATTACHMENT_COUNT}개까지 가능합니다.`,
    );
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_ATTACHMENT_TOTAL_BYTES) {
    throw new AttachmentValidationError("첨부파일 총 용량은 15MB까지 가능합니다.");
  }

  return Promise.all(
    files.map(async (file) => ({
      filename: safeFilename(file.name),
      content: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || undefined,
    })),
  );
}

async function parseBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    return {
      templateId: form.get("templateId"),
      categoryId: form.get("categoryId"),
      to: form.get("to"),
      subject: form.get("subject"),
      bodyText: form.get("bodyText"),
      html: form.get("html"),
      sendSms: boolValue(form.get("sendSms")),
      smsPhone: form.get("smsPhone"),
      smsMessage: form.get("smsMessage"),
      attachments: await parseAttachments(form.getAll("attachments")),
    };
  }

  const body = await request.json();
  return {
    ...body,
    sendSms: boolValue(body.sendSms),
    attachments: [],
  };
}

export async function POST(request: NextRequest) {
  const authenticated = hasValidInternalKey(request) || (await requireAuth());
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await parseBody(request);
    const guide =
      typeof body.templateId === "string"
        ? getAdminMailGuide(body.templateId)
        : undefined;
    const recipients = parseRecipients(body.to);
    const subject =
      typeof body.subject === "string" && body.subject.trim()
        ? body.subject.trim()
        : guide?.defaultSubject || "";
    const bodyText = stringValue(body.bodyText).trim();
    const categoryId = normalizeAdminMailCategoryId(
      body.categoryId,
      guide?.defaultCategoryId || "website",
    );
    const html =
      typeof body.html === "string" && body.html.trim()
        ? body.html
        : bodyText
          ? renderAdminCustomMailHtml({
              subject,
              bodyText,
              categoryId,
              sentAt: new Date(),
            })
        : guide
          ? renderAdminMailGuideHtml(guide.id, categoryId, new Date())
          : "";

    const invalidRecipients = recipients.filter((email) => !isEmail(email));
    if (recipients.length === 0 || invalidRecipients.length > 0) {
      return NextResponse.json(
        { error: "유효한 수신자 이메일을 입력해주세요." },
        { status: 400 },
      );
    }

    if (!subject || !html) {
      return NextResponse.json({ error: "필수 필드 누락" }, { status: 400 });
    }

    const wantsSms = body.sendSms === true;
    const smsPhone =
      stringValue(body.smsPhone).trim();
    const smsMessage =
      typeof body.smsMessage === "string" && body.smsMessage.trim()
        ? body.smsMessage.trim()
        : DEFAULT_MAIL_SMS_MESSAGE;

    if (wantsSms && !smsPhone) {
      return NextResponse.json(
        { error: "문자 발송 전화번호를 입력해주세요." },
        { status: 400 },
      );
    }

    await sendHtmlMail({
      to: recipients.join(", "),
      subject,
      html,
      attachments: body.attachments,
    });

    let sms:
      | { requested: false }
      | { requested: true; success: boolean; requestId?: string; error?: string } = {
      requested: false,
    };

    if (wantsSms) {
      const smsResult = await sendLMS(
        smsPhone,
        smsMessage.slice(0, 1000),
        "폴라애드 메일 안내",
      );
      sms = {
        requested: true,
        success: smsResult.success,
        requestId: smsResult.requestId,
        error: smsResult.error,
      };
    }

    return NextResponse.json({
      ok: true,
      sms,
      attachments: { count: body.attachments.length },
    });
  } catch (error) {
    if (error instanceof AttachmentValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("이메일 발송 실패:", error);
    return NextResponse.json({ error: "이메일 발송 실패" }, { status: 500 });
  }
}
