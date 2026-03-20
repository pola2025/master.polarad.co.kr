import { NextResponse } from "next/server";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = process.env.BRAND_REPORT_BASE_ID;
const TABLE_ID = process.env.BRAND_REPORT_TABLE_ID;

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

export async function GET() {
  if (!AIRTABLE_API_TOKEN || !BASE_ID || !TABLE_ID) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set("sort[0][field]", "createdTime");
    url.searchParams.set("sort[0][direction]", "desc");
    url.searchParams.set("maxRecords", "100");

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Airtable 조회 실패:", err);
      return NextResponse.json(
        { error: "리포트 목록 조회에 실패했습니다." },
        { status: 500 },
      );
    }

    const data = await res.json();
    const records: BrandReportRecord[] = data.records || [];
    const reports = records.map(normalizeRecord);

    return NextResponse.json({ reports });
  } catch (error) {
    console.error("브랜드 리포트 목록 조회 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
