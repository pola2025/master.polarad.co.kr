import { NextRequest, NextResponse } from "next/server";
import { generateBrandReportPDF } from "@/lib/brand-report-pdf";
import { sendBrandReportEmail } from "@/lib/brand-report-email";
import {
  getRecord,
  updateRecord,
  normalizeRecord,
  NotFoundError,
  FIELDS,
} from "@/lib/brand-reports/airtable";
import { requireAuth } from "@/lib/auth-check";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    if (!/^rec[a-zA-Z0-9]{14}$/.test(id)) {
      return NextResponse.json({ error: "유효하지 않은 ID" }, { status: 400 });
    }

    // 1. Fetch the report record
    const raw = await getRecord(id);
    const report = normalizeRecord(raw);

    if (report.status === "sent") {
      return NextResponse.json(
        { error: "이미 발송된 리포트입니다." },
        { status: 400 },
      );
    }

    if (!report.contactEmail) {
      return NextResponse.json(
        { error: "수신자 이메일이 없습니다." },
        { status: 400 },
      );
    }

    // 2. Generate PDF buffer
    const pdfBuffer = await generateBrandReportPDF({
      businessName: report.businessName,
      industry: report.industry,
      reportContent: report.reportContent,
      summary: report.summary,
      naverScore: report.naverScore ?? 0,
      googleScore: report.googleScore ?? 0,
      overallScore: report.overallScore ?? 0,
      analyzedAt: report.sentAt ?? new Date().toISOString(),
    });

    // 3. Send email with PDF attachment — check return value
    const emailSent = await sendBrandReportEmail({
      to: report.contactEmail,
      businessName: report.businessName,
      overallScore: report.overallScore ?? 0,
      naverScore: report.naverScore ?? 0,
      googleScore: report.googleScore ?? 0,
      summary: report.summary,
      pdfBuffer,
    });

    if (!emailSent) {
      return NextResponse.json(
        { error: "이메일 발송에 실패했습니다." },
        { status: 500 },
      );
    }

    // 4. Update Airtable: status "sent", sentAt — throw on failure
    await updateRecord(id, {
      [FIELDS.status]: "sent",
      [FIELDS.sentAt]: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json(
        { error: "리포트를 찾을 수 없습니다." },
        { status: 404 },
      );
    }
    console.error("브랜드 리포트 발송 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
