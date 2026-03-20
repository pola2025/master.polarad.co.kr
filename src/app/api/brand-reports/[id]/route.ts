import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = process.env.BRAND_REPORT_BASE_ID;
const TABLE_ID = process.env.BRAND_REPORT_TABLE_ID;

const airtableHeaders = () => ({
  Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
  "Content-Type": "application/json",
});

interface BrandReportRecord {
  id: string;
  createdTime: string;
  fields: {
    businessName?: string;
    industry?: string;
    contactName?: string;
    contactPhone?: string;
    contactEmail?: string;
    inquiryId?: string;
    inquirySource?: string;
    status?: string;
    reportContent?: string;
    summary?: string;
    naverScore?: number;
    googleScore?: number;
    totalScore?: number;
    naverData?: string;
    googleData?: string;
    analysisErrors?: string;
    analyzedAt?: string;
    sentAt?: string;
  };
}

function normalizeRecord(record: BrandReportRecord) {
  const f = record.fields;
  return {
    id: record.id,
    createdAt: record.createdTime,
    businessName: f.businessName ?? "",
    industry: f.industry ?? "",
    contactName: f.contactName ?? "",
    contactPhone: f.contactPhone ?? "",
    contactEmail: f.contactEmail ?? "",
    inquiryId: f.inquiryId ?? "",
    inquirySource: f.inquirySource ?? "",
    status: f.status ?? "",
    reportContent: f.reportContent ?? "",
    summary: f.summary ?? "",
    naverScore: f.naverScore ?? 0,
    googleScore: f.googleScore ?? 0,
    totalScore: f.totalScore ?? 0,
    naverData: f.naverData ? JSON.parse(f.naverData) : {},
    googleData: f.googleData ? JSON.parse(f.googleData) : {},
    analysisErrors: f.analysisErrors ? JSON.parse(f.analysisErrors) : {},
    analyzedAt: f.analyzedAt ?? "",
    sentAt: f.sentAt ?? "",
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!AIRTABLE_API_TOKEN || !BASE_ID || !TABLE_ID) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const { id } = await params;

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`,
      {
        headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json(
          { error: "리포트를 찾을 수 없습니다." },
          { status: 404 },
        );
      }
      const err = await res.json();
      console.error("Airtable 조회 실패:", err);
      return NextResponse.json(
        { error: "리포트 조회에 실패했습니다." },
        { status: 500 },
      );
    }

    const record: BrandReportRecord = await res.json();
    return NextResponse.json({ report: normalizeRecord(record) });
  } catch (error) {
    console.error("브랜드 리포트 조회 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!AIRTABLE_API_TOKEN || !BASE_ID || !TABLE_ID) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const { id } = await params;
    const { reportContent, summary, status } = await request.json();

    const fields: Record<string, string> = {};
    if (reportContent !== undefined) fields.reportContent = reportContent;
    if (summary !== undefined) fields.summary = summary;
    if (status !== undefined) fields.status = status;

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`,
      {
        method: "PATCH",
        headers: airtableHeaders(),
        body: JSON.stringify({ fields }),
      },
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("Airtable 업데이트 실패:", err);
      return NextResponse.json(
        { error: "업데이트에 실패했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("브랜드 리포트 업데이트 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!AIRTABLE_API_TOKEN || !BASE_ID || !TABLE_ID) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const { id } = await params;

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
      },
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("Airtable 삭제 실패:", err);
      return NextResponse.json(
        { error: "삭제에 실패했습니다." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("브랜드 리포트 삭제 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
