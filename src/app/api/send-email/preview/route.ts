import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import {
  normalizeAdminMailCategoryId,
  renderAdminCustomMailHtml,
} from "@/lib/admin-mail-guides";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const subject = typeof body.subject === "string" ? body.subject : "";
  const bodyText = typeof body.bodyText === "string" ? body.bodyText : "";
  const categoryId = normalizeAdminMailCategoryId(body.categoryId, "website");

  return NextResponse.json({
    html: renderAdminCustomMailHtml({
      subject,
      bodyText,
      categoryId,
      sentAt: new Date(),
    }),
  });
}
