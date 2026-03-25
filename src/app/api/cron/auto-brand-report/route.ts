import { NextResponse } from "next/server";
import {
  listRecords as listReports,
  FIELDS as REPORT_FIELDS,
} from "@/lib/brand-reports/airtable";
import { createRecord } from "@/lib/brand-reports/airtable";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN!;
const INQUIRIES_BASE_ID = "appSGHxitRzYPE43H";
const TABLE_NAME = "Lead";

/**
 * 홈페이지 접수 중 브랜드분석이 없는 건을 자동으로 pending 등록
 * 분석은 관리자가 수동으로 실행
 * Vercel Cron: 5분마다 실행
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. 홈페이지 접수 중 회사명이 있는 건 조회
    const inquiryUrl = new URL(
      `https://api.airtable.com/v0/${INQUIRIES_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
    );
    inquiryUrl.searchParams.set(
      "filterByFormula",
      "AND({회사명} != '', {회사명} != BLANK())",
    );
    inquiryUrl.searchParams.set("maxRecords", "100");
    inquiryUrl.searchParams.set("sort[0][field]", "no");
    inquiryUrl.searchParams.set("sort[0][direction]", "desc");

    const inquiryRes = await fetch(inquiryUrl.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
    });

    if (!inquiryRes.ok) {
      const err = await inquiryRes.text();
      console.error("[auto-brand-report] 접수 조회 실패:", err);
      return NextResponse.json({ error: "접수 조회 실패" }, { status: 500 });
    }

    const inquiryData = await inquiryRes.json();
    const inquiries = inquiryData.records || [];

    if (inquiries.length === 0) {
      return NextResponse.json({ message: "접수 건 없음", created: 0 });
    }

    // 2. 기존 브랜드분석에서 inquiryId 목록 조회
    const existingReports = await listReports({ maxRecords: 500 });
    const existingInquiryIds = new Set(
      existingReports
        .map((r) => r.fields[REPORT_FIELDS.inquiryId] as string)
        .filter(Boolean),
    );

    // 3. 분석이 없는 접수 건 필터
    const newInquiries = inquiries.filter(
      (r: { id: string }) => !existingInquiryIds.has(r.id),
    );

    if (newInquiries.length === 0) {
      return NextResponse.json({ message: "신규 등록 대상 없음", created: 0 });
    }

    // 4. pending 상태로 등록만 (분석은 관리자가 수동)
    const toProcess = newInquiries.slice(0, 10);
    const results = [];

    for (const record of toProcess) {
      const fields = record.fields as Record<string, string>;
      const businessName = fields["회사명"] || "";
      const contactName = fields["이름"] || "";
      const contactPhone = fields["연락처"] || "";
      const contactEmail = fields["이메일"] || "";
      const message = fields["문의내용"] || "";

      // 위저드 메시지에서 업종 추출
      let industry = "";
      if (message.startsWith("[위저드]")) {
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
          [REPORT_FIELDS.inquiryId]: record.id,
          [REPORT_FIELDS.inquirySource]: "website",
          [REPORT_FIELDS.inquiryDate]: record.createdTime,
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
