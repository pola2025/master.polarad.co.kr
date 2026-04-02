import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = "appSGHxitRzYPE43H";
const TABLE_ID = "tblU7SxW9gPYZe3go";

// 필드 ID 매핑 (GET 조회 시 returnFieldsByFieldId 사용)
const CLIENT_FIELD = {
  company: "fld3Rrdc1UQlisuoh",
  contactName: "fldOIUV6bdhadA8Dm",
  phone: "fldLnI7WptoofefNS",
  email: "fldddejh3NEAq8qqy",
  industry: "fldZExtohzEeRyHaW",
  website: "fld0ya6eOzBdg0DB7",
  address: "fldZmKoQvroTts8HL",
  businessNumber: "fld37JErzNdWy66oB",
  contractAmount: "fldNgX0A7QGd4K35u",
  contractStart: "fld3J13lSiUNbGCQm",
  contractEnd: "fldnDqGD6456DP3an",
  memo: "fldpbqF8p720pDjuO",
  inquiryId: "fldbhUICqDITeYnVx",
  status: "fldeyJ2Fa4GdXe6Q3",
} as const;

// 상태 매핑 (Airtable 영문 ↔ 프론트엔드 한글)
const EN_CLIENT_STATUS_TO_KR: Record<string, string> = {
  Waiting: "대기",
  Active: "진행중",
  Expired: "만료",
  Cancelled: "해지",
};

const KR_CLIENT_STATUS_TO_EN: Record<string, string> = {
  대기: "Waiting",
  진행중: "Active",
  만료: "Expired",
  해지: "Cancelled",
};

export async function GET() {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const headers = { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` };
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set("returnFieldsByFieldId", "true");
    url.searchParams.set("maxRecords", "200");

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) {
      console.error("Clients 조회 실패:", await res.text());
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    const data = await res.json();
    const records = data.records || [];

    const clients = records.map(
      (r: {
        id: string;
        createdTime: string;
        fields: Record<string, string | number | undefined>;
      }) => {
        const f = r.fields;
        const rawStatus = String(f[CLIENT_FIELD.status] ?? "");
        return {
          id: r.id,
          company: String(f[CLIENT_FIELD.company] ?? ""),
          contactName: String(f[CLIENT_FIELD.contactName] ?? ""),
          phone: String(f[CLIENT_FIELD.phone] ?? ""),
          email: String(f[CLIENT_FIELD.email] ?? ""),
          industry: String(f[CLIENT_FIELD.industry] ?? ""),
          website: String(f[CLIENT_FIELD.website] ?? ""),
          address: String(f[CLIENT_FIELD.address] ?? ""),
          businessNumber: String(f[CLIENT_FIELD.businessNumber] ?? ""),
          contractAmount: (f[CLIENT_FIELD.contractAmount] as number) ?? 0,
          contractStart: String(f[CLIENT_FIELD.contractStart] ?? ""),
          contractEnd: String(f[CLIENT_FIELD.contractEnd] ?? ""),
          status: (EN_CLIENT_STATUS_TO_KR[rawStatus] ?? rawStatus) || "대기",
          memo: String(f[CLIENT_FIELD.memo] ?? ""),
          inquiryId: String(f[CLIENT_FIELD.inquiryId] ?? ""),
          createdAt: r.createdTime,
        };
      },
    );

    // 정렬: 진행중 우선, 그 다음 대기, 나머지
    const statusOrder: Record<string, number> = {
      진행중: 0,
      대기: 1,
      만료: 2,
      해지: 3,
    };
    clients.sort(
      (
        a: { status: string; createdAt: string },
        b: { status: string; createdAt: string },
      ) =>
        (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const stats = {
      total: clients.length,
      active: clients.filter((c: { status: string }) => c.status === "진행중")
        .length,
      waiting: clients.filter((c: { status: string }) => c.status === "대기")
        .length,
      expiringSoon: clients.filter(
        (c: { status: string; contractEnd: string }) => {
          if (c.status !== "진행중" || !c.contractEnd) return false;
          const end = new Date(c.contractEnd);
          return end <= oneMonthLater && end >= now;
        },
      ).length,
      totalRevenue: clients.reduce(
        (sum: number, c: { contractAmount: number }) =>
          sum + (c.contractAmount || 0),
        0,
      ),
    };

    return NextResponse.json({ clients, stats });
  } catch (error) {
    console.error("Clients 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const fields: Record<string, string | number> = {};

    if (body.company) fields["company"] = body.company;
    if (body.contactName) fields["contactName"] = body.contactName;
    if (body.phone) fields["phone"] = body.phone;
    if (body.email) fields["email"] = body.email;
    if (body.industry) fields["industry"] = body.industry;
    if (body.contractAmount) fields["contractAmount"] = body.contractAmount;
    if (body.inquiryId) fields["inquiryId"] = body.inquiryId;
    fields["status"] = "Waiting";

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields, typecast: true }),
      },
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("Client 생성 실패:", err);
      return NextResponse.json({ error: "생성 실패" }, { status: 500 });
    }

    const result = await res.json();
    return NextResponse.json({ id: result.id });
  } catch (error) {
    console.error("Client 생성 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: "ID 필요" }, { status: 400 });
    }

    const fields: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key === "status" && typeof value === "string") {
        fields["status"] = KR_CLIENT_STATUS_TO_EN[value] ?? value;
      } else if (value !== undefined) {
        fields[key] = value as string | number;
      }
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields, typecast: true }),
      },
    );

    if (!res.ok) {
      const err = await res.json();
      console.error("Client 업데이트 실패:", err);
      return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Client 업데이트 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "ID 필요" }, { status: 400 });
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Client 삭제 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
