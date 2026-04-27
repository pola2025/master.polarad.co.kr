import { NextRequest, NextResponse } from "next/server";
import { d1All, d1Run } from "@/lib/d1-client";

// Airtable 영문 Status ↔ 한글 상태 매핑 (호환성)
const EN_STATUS_TO_KR: Record<string, string> = {
  Todo: "신규",
  "In progress": "상담중",
  Done: "계약완료",
  Hold: "보류",
};

const KR_STATUS_TO_EN: Record<string, string> = {
  신규: "Todo",
  상담중: "In progress",
  계약완료: "Done",
  보류: "Hold",
};

function formatMetaPhone(phone: string): string {
  if (phone.startsWith("+82")) {
    const local = "0" + phone.slice(3);
    if (local.length === 11) {
      return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
    }
    return local;
  }
  return phone;
}

interface LeadRow {
  id: string;
  no: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  memo: string;
  status: string;
  contract_amount: number;
  created_at: string;
}

interface MetaLeadRow {
  id: string;
  name: string;
  phone: string;
  company: string;
  industry: string;
  ad_name: string;
  status: string;
  memo: string;
  sms_status: string;
  sms_sent_at: string;
  sms_error: string;
  sms_reply: number;
  contract_amount: number;
  created_at: string;
}

interface BrandReportRow {
  inquiry_id: string;
  email_opened_at: string | null;
  report_status: string;
  sent_at: string | null;
}

interface RevenueRow {
  amount: number;
  date: string;
}

export async function GET(request: NextRequest) {
  try {
    // 4개 테이블 병렬 조회
    const [leads, metas, reports, revenues] = await Promise.all([
      d1All<LeadRow>(
        `SELECT id, no, name, company, email, phone, message, memo, status, contract_amount, created_at
         FROM lead ORDER BY no DESC LIMIT 100`,
      ),
      d1All<MetaLeadRow>(
        `SELECT id, name, phone, company, industry, ad_name, status, memo,
                sms_status, sms_sent_at, sms_error, sms_reply, contract_amount, created_at
         FROM meta_lead ORDER BY created_at DESC`,
      ),
      d1All<BrandReportRow>(
        `SELECT inquiry_id, email_opened_at, status AS report_status, sent_at
         FROM brand_reports WHERE inquiry_id != ''`,
      ),
      d1All<RevenueRow>("SELECT amount, date FROM revenue"),
    ]);

    // 홈페이지 리드 처리
    const websiteInquiries = leads.map((l) => {
      const isGoogleAds = (l.message || "").includes("[구글광고");
      return {
        id: l.id,
        source: isGoogleAds ? ("google_ads" as const) : ("website" as const),
        no: l.no,
        name: l.name || "-",
        company: l.company || "",
        email: l.email || "",
        phone: l.phone || "",
        message: l.message || "",
        memo: l.memo || "",
        status: EN_STATUS_TO_KR[l.status] ?? l.status,
        contractAmount: l.contract_amount || 0,
        adName: "",
        industry: "",
        smsStatus: "",
        smsSentAt: "",
        smsReply: false,
        createdAt: l.created_at,
      };
    });

    // Meta 광고 리드 처리 (id에 meta_ prefix 부여 — 기존 호환)
    const metaInquiries = metas.map((m) => ({
      id: `meta_${m.id}`,
      source: "meta" as const,
      no: 0,
      name: m.name || "-",
      company: m.company || "",
      email: "",
      phone: m.phone ? formatMetaPhone(m.phone) : "",
      message: m.industry ? `[Meta 광고] 업종: ${m.industry}` : "[Meta 광고]",
      memo: m.memo || "",
      status: EN_STATUS_TO_KR[m.status] ?? m.status,
      adName: m.ad_name || "",
      industry: m.industry || "",
      smsStatus: m.sms_status || "",
      smsSentAt: m.sms_sent_at || "",
      smsError: m.sms_error || "",
      smsReply: !!m.sms_reply,
      contractAmount: m.contract_amount || 0,
      createdAt: m.created_at,
    }));

    // 브랜드 리포트 매핑
    const reportMap = new Map<
      string,
      { emailOpenedAt: string; reportStatus: string; sentAt: string }
    >();
    for (const r of reports) {
      if (r.inquiry_id) {
        reportMap.set(r.inquiry_id, {
          emailOpenedAt: r.email_opened_at || "",
          reportStatus: r.report_status || "",
          sentAt: r.sent_at || "",
        });
      }
    }

    // 통합 정렬 + 브랜드분석 조인
    const inquiries = [...websiteInquiries, ...metaInquiries]
      .map((inquiry) => {
        const realId = inquiry.id.startsWith("meta_")
          ? inquiry.id.replace("meta_", "")
          : inquiry.id;
        const report = reportMap.get(realId) || reportMap.get(inquiry.id);
        return {
          ...inquiry,
          reportStatus: report?.reportStatus || "",
          reportEmailOpenedAt: report?.emailOpenedAt || "",
          reportSentAt: report?.sentAt || "",
        };
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const googleAdsInquiries = websiteInquiries.filter(
      (i) => i.source === "google_ads",
    );
    const pureWebsiteInquiries = websiteInquiries.filter(
      (i) => i.source === "website",
    );
    const contractInquiries = inquiries.filter((i) => i.status === "계약완료");

    // Revenue 합계 (Single Source of Truth)
    const revenueTotalRevenue =
      revenues.length > 0
        ? revenues.reduce((sum, r) => sum + (r.amount || 0), 0)
        : contractInquiries.reduce(
            (sum, i) => sum + (i.contractAmount || 0),
            0,
          );

    const stats = {
      total: inquiries.length,
      thisMonth: inquiries.filter((i) => new Date(i.createdAt) >= thisMonth)
        .length,
      website: pureWebsiteInquiries.length,
      meta: metaInquiries.length,
      googleAds: googleAdsInquiries.length,
      smsReplyCount: metaInquiries.filter((i) => i.smsReply).length,
      contractCount: contractInquiries.length,
      totalRevenue: revenueTotalRevenue,
    };

    // 월별 성과 통계
    const monthParam = request.nextUrl.searchParams.get("month");
    const targetMonth =
      monthParam ||
      `${thisMonth.getFullYear()}-${String(thisMonth.getMonth() + 1).padStart(2, "0")}`;

    const monthInquiries = inquiries.filter((i) => {
      const d = new Date(i.createdAt);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return m === targetMonth;
    });
    const monthContracts = monthInquiries.filter(
      (i) => i.status === "계약완료",
    );
    const monthWebsite = monthInquiries.filter((i) => i.source === "website");
    const monthMeta = monthInquiries.filter((i) => i.source === "meta");
    const monthGoogle = monthInquiries.filter((i) => i.source === "google_ads");

    const monthRevenue =
      revenues.length > 0
        ? revenues
            .filter((r) => r.date && r.date.startsWith(targetMonth))
            .reduce((sum, r) => sum + (r.amount || 0), 0)
        : monthContracts.reduce((sum, i) => sum + (i.contractAmount || 0), 0);

    const monthlyStats = {
      month: targetMonth,
      inquiries: monthInquiries.length,
      website: monthWebsite.length,
      meta: monthMeta.length,
      googleAds: monthGoogle.length,
      contractCount: monthContracts.length,
      totalRevenue: monthRevenue,
    };

    return NextResponse.json({ inquiries, stats, monthlyStats });
  } catch (error) {
    console.error("문의 조회 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

// 메모/상태 업데이트
export async function PATCH(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      console.error(`[inquiries] PATCH JSON 파싱 실패 (IP: ${ip})`);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { id, memo, status, smsReply, contractAmount } = body as {
      id?: string;
      memo?: string;
      status?: string;
      smsReply?: boolean;
      contractAmount?: number;
    };
    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다." }, { status: 400 });
    }

    const isMeta = id.startsWith("meta_");
    const realId = isMeta ? id.replace("meta_", "") : id;
    const table = isMeta ? "meta_lead" : "lead";

    const sets: string[] = [];
    const params: (string | number)[] = [];

    if (memo !== undefined) {
      sets.push("memo = ?");
      params.push(memo);
    }
    if (status !== undefined) {
      sets.push("status = ?");
      params.push(KR_STATUS_TO_EN[status] ?? status);
    }
    if (isMeta && smsReply !== undefined) {
      sets.push("sms_reply = ?");
      params.push(smsReply ? 1 : 0);
    }
    if (contractAmount !== undefined) {
      sets.push("contract_amount = ?");
      params.push(contractAmount);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: "수정할 필드 없음" }, { status: 400 });
    }

    sets.push("updated_at = ?");
    params.push(new Date().toISOString());
    params.push(realId);

    const result = await d1Run(
      `UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`,
      params,
    );

    if (!result.meta?.changes) {
      return NextResponse.json(
        { error: "해당 ID를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("문의 업데이트 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

// 문의 삭제
export async function DELETE(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      console.error(`[inquiries] DELETE JSON 파싱 실패 (IP: ${ip})`);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { id } = body as { id?: string };
    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다." }, { status: 400 });
    }

    const isMeta = id.startsWith("meta_");
    const realId = isMeta ? id.replace("meta_", "") : id;
    const table = isMeta ? "meta_lead" : "lead";

    const result = await d1Run(`DELETE FROM ${table} WHERE id = ?`, [realId]);
    if (!result.meta?.changes) {
      return NextResponse.json(
        { error: "해당 ID를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("문의 삭제 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
