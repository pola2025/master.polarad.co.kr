import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = "appSGHxitRzYPE43H";
const TABLE_ID = "tblU7SxW9gPYZe3go";

interface ClientRecord {
  id: string;
  createdTime: string;
  fields: {
    업체명?: string;
    담당자명?: string;
    연락처?: string;
    이메일?: string;
    업종?: string;
    홈페이지?: string;
    주소?: string;
    사업자번호?: string;
    계약금액?: number;
    계약시작일?: string;
    계약종료일?: string;
    계약상태?: string;
    메모?: string;
    inquiryId?: string;
  };
}

export async function GET() {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const headers = { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` };
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set("maxRecords", "200");

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) {
      console.error("Clients 조회 실패:", await res.text());
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    const data = await res.json();
    const records: ClientRecord[] = data.records || [];

    const clients = records.map((r) => ({
      id: r.id,
      company: r.fields["업체명"] ?? "",
      contactName: r.fields["담당자명"] ?? "",
      phone: r.fields["연락처"] ?? "",
      email: r.fields["이메일"] ?? "",
      industry: r.fields["업종"] ?? "",
      website: r.fields["홈페이지"] ?? "",
      address: r.fields["주소"] ?? "",
      businessNumber: r.fields["사업자번호"] ?? "",
      contractAmount: r.fields["계약금액"] ?? 0,
      contractStart: r.fields["계약시작일"] ?? "",
      contractEnd: r.fields["계약종료일"] ?? "",
      status: r.fields["계약상태"] ?? "대기",
      memo: r.fields["메모"] ?? "",
      inquiryId: r.fields["inquiryId"] ?? "",
      createdAt: r.createdTime,
    }));

    // 정렬: 진행중 우선, 그 다음 대기, 나머지
    const statusOrder: Record<string, number> = {
      진행중: 0,
      대기: 1,
      만료: 2,
      해지: 3,
    };
    clients.sort(
      (a, b) =>
        (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const now = new Date();
    const oneMonthLater = new Date(now);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const stats = {
      total: clients.length,
      active: clients.filter((c) => c.status === "진행중").length,
      waiting: clients.filter((c) => c.status === "대기").length,
      expiringSoon: clients.filter((c) => {
        if (c.status !== "진행중" || !c.contractEnd) return false;
        const end = new Date(c.contractEnd);
        return end <= oneMonthLater && end >= now;
      }).length,
      totalRevenue: clients.reduce(
        (sum, c) => sum + (c.contractAmount || 0),
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

    if (body.company) fields["업체명"] = body.company;
    if (body.contactName) fields["담당자명"] = body.contactName;
    if (body.phone) fields["연락처"] = body.phone;
    if (body.email) fields["이메일"] = body.email;
    if (body.industry) fields["업종"] = body.industry;
    if (body.contractAmount) fields["계약금액"] = body.contractAmount;
    if (body.inquiryId) fields["inquiryId"] = body.inquiryId;
    fields["계약상태"] = "대기";

    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fields }),
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

    const fieldMap: Record<string, string> = {
      company: "업체명",
      contactName: "담당자명",
      phone: "연락처",
      email: "이메일",
      industry: "업종",
      website: "홈페이지",
      address: "주소",
      businessNumber: "사업자번호",
      contractAmount: "계약금액",
      contractStart: "계약시작일",
      contractEnd: "계약종료일",
      status: "계약상태",
      memo: "메모",
    };

    const fields: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(updates)) {
      const airtableField = fieldMap[key];
      if (airtableField && value !== undefined) {
        fields[airtableField] = value as string | number;
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
        body: JSON.stringify({ fields }),
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
