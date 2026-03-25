import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const INQUIRIES_BASE_ID = "appSGHxitRzYPE43H";
const TABLE_NAME = "Lead";

// Meta 광고 리드 Airtable
const META_BASE_ID = "appyUK6euzEJ5yrGX";
const META_TABLE_ID = "tblxTgGtVkLpniFbb";

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: {
    no?: number;
    이름?: string;
    회사명?: string;
    이메일?: string;
    연락처?: string;
    문의내용?: string;
    메모?: string;
    상태?: string;
    "개인정보 수집 및 이용동의"?: boolean;
  };
}

interface MetaLeadRecord {
  id: string;
  createdTime: string;
  fields: {
    Name?: string;
    phone?: string;
    company?: string;
    industry?: string;
    Adname?: string;
    memo?: string;
    Status?: string;
    smsStatus?: string;
    smsSentAt?: string;
    smsError?: string;
    smsReply?: boolean;
  };
}

// Meta Airtable Status ↔ 한글 상태 매핑
const META_STATUS_TO_KR: Record<string, string> = {
  Todo: "신규",
  "In progress": "상담중",
  Done: "계약완료",
  Hold: "보류",
};

const KR_STATUS_TO_META: Record<string, string> = {
  신규: "Todo",
  상담중: "In progress",
  계약완료: "Done",
  보류: "Hold",
};

function formatMetaPhone(phone: string): string {
  // +821012345678 → 010-1234-5678
  if (phone.startsWith("+82")) {
    const local = "0" + phone.slice(3);
    if (local.length === 11) {
      return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
    }
    return local;
  }
  return phone;
}

export async function GET() {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json(
      { error: "AIRTABLE_API_TOKEN이 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const headers = { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` };

    // 세 Airtable을 병렬로 조회 (홈페이지 + Meta + 브랜드분석)
    const brandReportBaseId = process.env.BRAND_REPORT_BASE_ID;
    const brandReportTableId = process.env.BRAND_REPORT_TABLE_ID;

    const [websiteRes, metaRes, brandReportRes] = await Promise.all([
      // 홈페이지 접수 리드
      fetch(
        (() => {
          const url = new URL(
            `https://api.airtable.com/v0/${INQUIRIES_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
          );
          url.searchParams.set("sort[0][field]", "no");
          url.searchParams.set("sort[0][direction]", "desc");
          url.searchParams.set("maxRecords", "100");
          return url.toString();
        })(),
        { headers, cache: "no-store" },
      ),
      // Meta 광고 리드 (createdTime 기본 정렬, sort 필드 없음)
      fetch(
        (() => {
          const url = new URL(
            `https://api.airtable.com/v0/${META_BASE_ID}/${META_TABLE_ID}`,
          );
          url.searchParams.set("maxRecords", "100");
          return url.toString();
        })(),
        { headers, cache: "no-store" },
      ),
      // 브랜드분석 리포트 (inquiryId + emailOpenedAt + status)
      brandReportBaseId && brandReportTableId
        ? fetch(
            (() => {
              const url = new URL(
                `https://api.airtable.com/v0/${brandReportBaseId}/${brandReportTableId}`,
              );
              url.searchParams.set("maxRecords", "500");
              url.searchParams.set("fields[]", "inquiryId");
              url.searchParams.append("fields[]", "emailOpenedAt");
              url.searchParams.append("fields[]", "status");
              url.searchParams.append("fields[]", "sentAt");
              return url.toString();
            })(),
            { headers, cache: "no-store" },
          )
        : Promise.resolve(null),
    ]);

    // 홈페이지 리드 처리
    const websiteInquiries = [];
    if (websiteRes.ok) {
      const data = await websiteRes.json();
      const records: AirtableRecord[] = data.records || [];
      for (const record of records) {
        websiteInquiries.push({
          id: record.id,
          source: "website" as const,
          no: record.fields.no ?? 0,
          name: record.fields["이름"] ?? "-",
          company: record.fields["회사명"] ?? "",
          email: record.fields["이메일"] ?? "",
          phone: record.fields["연락처"] ?? "",
          message: record.fields["문의내용"] ?? "",
          memo: record.fields["메모"] ?? "",
          status: record.fields["상태"] ?? "",
          adName: "",
          industry: "",
          smsStatus: "",
          smsSentAt: "",
          smsReply: false,
          createdAt: record.createdTime,
        });
      }
    } else {
      console.error("홈페이지 리드 조회 실패:", await websiteRes.text());
    }

    // Meta 광고 리드 처리
    const metaInquiries = [];
    if (metaRes.ok) {
      const data = await metaRes.json();
      const records: MetaLeadRecord[] = data.records || [];
      for (const record of records) {
        metaInquiries.push({
          id: `meta_${record.id}`,
          source: "meta" as const,
          no: 0,
          name: record.fields.Name ?? "-",
          company: record.fields.company ?? "",
          email: "",
          phone: record.fields.phone
            ? formatMetaPhone(record.fields.phone)
            : "",
          message: record.fields.industry
            ? `[Meta 광고] 업종: ${record.fields.industry}`
            : "[Meta 광고]",
          memo: record.fields.memo ?? "",
          status:
            META_STATUS_TO_KR[record.fields.Status ?? ""] ??
            record.fields.Status ??
            "",
          adName: record.fields.Adname ?? "",
          industry: record.fields.industry ?? "",
          smsStatus: record.fields.smsStatus ?? "",
          smsSentAt: record.fields.smsSentAt ?? "",
          smsError: record.fields.smsError ?? "",
          smsReply: record.fields.smsReply ?? false,
          createdAt: record.createdTime,
        });
      }
    } else {
      console.error("Meta 리드 조회 실패:", await metaRes.text());
    }

    // 브랜드분석 리포트 매핑 (inquiryId → { emailOpenedAt, reportStatus, sentAt })
    const reportMap = new Map<
      string,
      { emailOpenedAt: string; reportStatus: string; sentAt: string }
    >();
    if (brandReportRes && brandReportRes.ok) {
      const data = await brandReportRes.json();
      for (const r of data.records || []) {
        const f = r.fields as Record<string, string>;
        if (f.inquiryId) {
          reportMap.set(f.inquiryId, {
            emailOpenedAt: f.emailOpenedAt || "",
            reportStatus: f.status || "",
            sentAt: f.sentAt || "",
          });
        }
      }
    }

    // 날짜 기준 통합 정렬 (최신순) + 브랜드분석 조인
    const inquiries = [...websiteInquiries, ...metaInquiries]
      .map((inquiry) => {
        const realId = inquiry.id.startsWith("meta_")
          ? inquiry.id.replace("meta_", "")
          : inquiry.id;
        const report = reportMap.get(realId);
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

    const stats = {
      total: inquiries.length,
      thisMonth: inquiries.filter((i) => new Date(i.createdAt) >= thisMonth)
        .length,
      website: websiteInquiries.length,
      meta: metaInquiries.length,
      smsReplyCount: metaInquiries.filter((i) => i.smsReply).length,
    };

    return NextResponse.json({ inquiries, stats });
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
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const { id, memo, status, smsReply } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다." }, { status: 400 });
    }

    // Meta 리드인지 확인
    const isMeta = id.startsWith("meta_");
    const realId = isMeta ? id.replace("meta_", "") : id;
    const baseId = isMeta ? META_BASE_ID : INQUIRIES_BASE_ID;
    const tableId = isMeta ? META_TABLE_ID : encodeURIComponent(TABLE_NAME);

    const fields: Record<string, string | boolean> = {};
    if (isMeta) {
      if (memo !== undefined) fields["memo"] = memo;
      if (status !== undefined)
        fields["Status"] = KR_STATUS_TO_META[status] ?? status;
      if (smsReply !== undefined) fields["smsReply"] = smsReply;
    } else {
      if (memo !== undefined) fields["메모"] = memo;
      if (status !== undefined) fields["상태"] = status;
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}/${realId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
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
    console.error("문의 업데이트 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

// 문의 삭제
export async function DELETE(request: NextRequest) {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다." }, { status: 400 });
    }

    const isMeta = id.startsWith("meta_");
    const realId = isMeta ? id.replace("meta_", "") : id;
    const baseId = isMeta ? META_BASE_ID : INQUIRIES_BASE_ID;
    const tableId = isMeta ? META_TABLE_ID : encodeURIComponent(TABLE_NAME);

    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/${tableId}/${realId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
        },
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
    console.error("문의 삭제 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
