import { NextRequest, NextResponse } from "next/server";
import { analyzeBrand } from "@/lib/brand-search";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

// Website inquiries (Lead table)
const INQUIRIES_BASE_ID = "appSGHxitRzYPE43H";
const LEAD_TABLE_NAME = "Lead";

// Brand reports table (same base)
const BRAND_REPORT_TABLE_ID = "tbl5UXUD58DZir4cG";

const MAX_PER_RUN = 3;

export const maxDuration = 60;

interface LeadRecord {
  id: string;
  createdTime: string;
  fields: {
    이름?: string;
    회사명?: string;
    이메일?: string;
    연락처?: string;
    문의내용?: string;
  };
}

interface BrandReportRecord {
  id: string;
  fields: {
    inquiryId?: string;
  };
}

function parseIndustryFromMessage(message: string): string {
  // Wizard format: "[위저드] 업종: X / 현황: Y / 예산: Z / 고민: W → 추천패키지"
  const match = message.match(/\[위저드\].*?업종:\s*([^/→\n]+)/);
  if (match) {
    return match[1].trim();
  }
  return "";
}

function airtableHeaders() {
  return {
    Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

async function fetchLeadRecords(): Promise<LeadRecord[]> {
  const url = new URL(
    `https://api.airtable.com/v0/${INQUIRIES_BASE_ID}/${encodeURIComponent(LEAD_TABLE_NAME)}`,
  );
  url.searchParams.set("sort[0][field]", "no");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.set("maxRecords", "100");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Lead 조회 실패: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  return (data.records ?? []) as LeadRecord[];
}

async function fetchExistingReportInquiryIds(): Promise<Set<string>> {
  const url = new URL(
    `https://api.airtable.com/v0/${INQUIRIES_BASE_ID}/${BRAND_REPORT_TABLE_ID}`,
  );
  url.searchParams.set("fields[]", "inquiryId");
  url.searchParams.set("maxRecords", "1000");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`BrandReport 조회 실패: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const records: BrandReportRecord[] = data.records ?? [];
  const ids = new Set<string>();
  for (const record of records) {
    const inquiryId = record.fields.inquiryId;
    if (inquiryId) {
      ids.add(inquiryId);
    }
  }
  return ids;
}

async function createBrandReport(params: {
  businessName: string;
  industry: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  inquiryId: string;
}): Promise<string> {
  const {
    businessName,
    industry,
    contactName,
    contactPhone,
    contactEmail,
    inquiryId,
  } = params;

  // Step 1: Create initial record with status "analyzing"
  const createRes = await fetch(
    `https://api.airtable.com/v0/${INQUIRIES_BASE_ID}/${BRAND_REPORT_TABLE_ID}`,
    {
      method: "POST",
      headers: airtableHeaders(),
      body: JSON.stringify({
        fields: {
          businessName,
          industry,
          contactName,
          contactPhone,
          contactEmail,
          inquiryId,
          inquirySource: "website",
          status: "analyzing",
        },
      }),
    },
  );

  if (!createRes.ok) {
    const err = await createRes.json();
    throw new Error(`레코드 생성 실패: ${JSON.stringify(err)}`);
  }

  const created = await createRes.json();
  const recordId: string = created.id;

  // Step 2: Run brand analysis
  let updateFields: Record<string, string | number>;
  try {
    const result = await analyzeBrand({ businessName, industry });
    updateFields = {
      status: "draft",
      reportContent: result.reportContent ?? "",
      summary: result.summary ?? "",
      naverScore: result.naverScore ?? 0,
      googleScore: result.googleScore ?? 0,
      totalScore: result.overallScore ?? 0,
      naverData: JSON.stringify(result.naverResult ?? {}),
      googleData: JSON.stringify(result.googleResult ?? {}),
      analysisErrors: JSON.stringify(result.errors ?? {}),
      analyzedAt: result.analyzedAt ?? new Date().toISOString(),
    };
  } catch (analysisError) {
    console.error(
      `[AutoBrandAnalyze] 분석 실패 (${businessName}):`,
      analysisError,
    );
    updateFields = {
      status: "draft",
      summary: `분석 중 오류가 발생했습니다: ${analysisError instanceof Error ? analysisError.message : "알 수 없는 오류"}`,
      reportContent: "",
      naverScore: 0,
      googleScore: 0,
      totalScore: 0,
      naverData: "{}",
      googleData: "{}",
      analysisErrors: JSON.stringify({ report: "분석 실패" }),
      analyzedAt: new Date().toISOString(),
    };
  }

  // Step 3: Update record with results
  const updateRes = await fetch(
    `https://api.airtable.com/v0/${INQUIRIES_BASE_ID}/${BRAND_REPORT_TABLE_ID}/${recordId}`,
    {
      method: "PATCH",
      headers: airtableHeaders(),
      body: JSON.stringify({ fields: updateFields }),
    },
  );

  if (!updateRes.ok) {
    const err = await updateRes.json();
    throw new Error(`레코드 업데이트 실패: ${JSON.stringify(err)}`);
  }

  return recordId;
}

export async function GET(request: NextRequest) {
  // Verify CRON_SECRET from Authorization header
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json(
      { error: "AIRTABLE_API_TOKEN이 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    // 1. Fetch website leads and existing brand reports in parallel
    const [leads, existingIds] = await Promise.all([
      fetchLeadRecords(),
      fetchExistingReportInquiryIds(),
    ]);

    // 2. Filter: only website inquiries with a non-empty 회사명 and no existing report
    const pending = leads.filter((record) => {
      const company = record.fields["회사명"]?.trim();
      if (!company) return false;
      return !existingIds.has(record.id);
    });

    console.log(
      `[AutoBrandAnalyze] 총 ${leads.length}개 리드, 처리 대상 ${pending.length}개, 최대 ${MAX_PER_RUN}개 처리`,
    );

    // 3. Process up to MAX_PER_RUN inquiries
    const toProcess = pending.slice(0, MAX_PER_RUN);
    let processed = 0;

    for (const record of toProcess) {
      const businessName = record.fields["회사명"]!.trim();
      const message = record.fields["문의내용"] ?? "";
      const industry = parseIndustryFromMessage(message);

      try {
        const reportId = await createBrandReport({
          businessName,
          industry,
          contactName: record.fields["이름"] ?? "",
          contactPhone: record.fields["연락처"] ?? "",
          contactEmail: record.fields["이메일"] ?? "",
          inquiryId: record.id,
        });
        console.log(
          `[AutoBrandAnalyze] 완료: ${businessName} (inquiryId=${record.id}, reportId=${reportId})`,
        );
        processed++;
      } catch (err) {
        console.error(
          `[AutoBrandAnalyze] ${businessName} 처리 실패:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    const skipped = pending.length - toProcess.length;

    return NextResponse.json({ processed, skipped });
  } catch (error) {
    console.error("[AutoBrandAnalyze] 오류:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
