import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import {
  ADMIN_MAIL_CATEGORIES,
  ADMIN_MAIL_GUIDES,
  DEFAULT_MAIL_SMS_MESSAGE,
  renderAdminMailGuideHtml,
} from "@/lib/admin-mail-guides";
import { getMailerStatus } from "@/lib/mailer";
import { getSensStatus } from "@/lib/ncp-sens";

export const runtime = "nodejs";

export async function GET() {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const previewSentAt = new Date();

  return NextResponse.json({
    defaultSmsMessage: DEFAULT_MAIL_SMS_MESSAGE,
    categories: ADMIN_MAIL_CATEGORIES,
    mailer: getMailerStatus(),
    sms: getSensStatus(),
    templates: ADMIN_MAIL_GUIDES.map((guide) => ({
      id: guide.id,
      title: guide.title,
      description: guide.description,
      defaultSubject: guide.defaultSubject,
      defaultCategoryId: guide.defaultCategoryId,
      html: guide.html,
      htmlByCategory: Object.fromEntries(
        ADMIN_MAIL_CATEGORIES.map((category) => [
          category.id,
          renderAdminMailGuideHtml(guide.id, category.id, previewSentAt),
        ]),
      ),
    })),
  });
}
