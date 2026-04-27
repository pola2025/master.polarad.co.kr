import { NextResponse } from "next/server";
import {
  listRecords as listReports,
  FIELDS as REPORT_FIELDS,
  createRecord,
} from "@/lib/brand-reports/airtable";
import { d1All } from "@/lib/d1-client";

interface LeadRow {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  message: string;
  created_at: string;
}

/**
 * 홈페이지 접수 중 브랜드분석이 없는 건을 자동으로 pending 등록
 * 분석은 관리자가 수동으로 실행
 * Vercel Cron: 5분마다 실행
 */
export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    console.error("[cron] CRON_SECRET 환경변수 미설정");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. 홈페이지 리드 중 회사명 있는 건 (D1)
    const inquiries = await d1All<LeadRow>(
      `SELECT id, name, company, phone, email, message, created_at
       FROM lead
       WHERE company IS NOT NULL AND company != ''
       ORDER BY no DESC
       LIMIT 100`,
    );

    if (inquiries.length === 0) {
      return NextResponse.json({ message: "접수 건 없음", created: 0 });
    }

    // 2. 기존 브랜드분석에서 inquiry_id 목록 조회
    const existingReports = await listReports({ maxRecords: 500 });
    const existingInquiryIds = new Set(
      existingReports
        .map((r) => r.fields[REPORT_FIELDS.inquiryId] as string)
        .filter(Boolean),
    );

    // 3. 분석 없는 건 필터
    const newInquiries = inquiries.filter((r) => !existingInquiryIds.has(r.id));

    if (newInquiries.length === 0) {
      return NextResponse.json({ message: "신규 등록 대상 없음", created: 0 });
    }

    // 4. pending 상태로 등록 (분석은 관리자 수동)
    const toProcess = newInquiries.slice(0, 10);
    const results = [];

    for (const lead of toProcess) {
      const businessName = lead.company || "";
      const contactName = lead.name || "";
      const contactPhone = lead.phone || "";
      const contactEmail = lead.email || "";
      const message = lead.message || "";

      let industry = "";
      if (message.includes("위저드") || message.includes("업종:")) {
        const match = message.match(/업종:\s*([^/\n]+)/);
        if (match) industry = match[1].trim();
      }

      try {
        const reportId = await createRecord({
          [REPORT_FIELDS.businessName]: businessName,
          [REPORT_FIELDS.industry]: industry,
          [REPORT_FIELDS.contactName]: contactName,
          [REPORT_FIELDS.contactPhone]: contactPhone,
          [REPORT_FIELDS.contactEmail]: contactEmail,
          [REPORT_FIELDS.inquiryId]: lead.id,
          [REPORT_FIELDS.inquirySource]: "website",
          [REPORT_FIELDS.inquiryDate]: lead.created_at,
          [REPORT_FIELDS.status]: "pending",
        });

        results.push({ businessName, reportId, status: "ok" });
        console.log(
          `[auto-brand-report] 대기 등록: ${businessName} → ${reportId}`,
        );
      } catch (e) {
        console.error(`[auto-brand-report] 등록 실패: ${businessName}`, e);
        results.push({
          businessName,
          status: "error",
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    }

    return NextResponse.json({
      message: `${results.length}건 등록`,
      created: results.filter((r) => r.status === "ok").length,
      pending: newInquiries.length - toProcess.length,
      results,
    });
  } catch (error) {
    console.error("[auto-brand-report] 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
