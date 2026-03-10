import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const INQUIRIES_BASE_ID = "appSGHxitRzYPE43H";
const TABLE_NAME = "Lead";

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

export async function GET() {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json(
      { error: "AIRTABLE_API_TOKEN이 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const url = new URL(
      `https://api.airtable.com/v0/${INQUIRIES_BASE_ID}/${encodeURIComponent(TABLE_NAME)}`,
    );
    url.searchParams.set("sort[0][field]", "no");
    url.searchParams.set("sort[0][direction]", "desc");
    url.searchParams.set("maxRecords", "100");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
      },
      next: { revalidate: 60 }, // 1분 캐시
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Airtable 조회 실패:", err);
      return NextResponse.json(
        { error: "문의 데이터를 불러오지 못했습니다." },
        { status: 500 },
      );
    }

    const data = await res.json();
    const records: AirtableRecord[] = data.records || [];

    const inquiries = records.map((record) => ({
      id: record.id,
      no: record.fields.no ?? 0,
      name: record.fields["이름"] ?? "-",
      company: record.fields["회사명"] ?? "",
      email: record.fields["이메일"] ?? "",
      phone: record.fields["연락처"] ?? "",
      message: record.fields["문의내용"] ?? "",
      memo: record.fields["메모"] ?? "",
      status: record.fields["상태"] ?? "",
      createdAt: record.createdTime,
    }));

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const stats = {
      total: inquiries.length,
      thisMonth: inquiries.filter((i) => new Date(i.createdAt) >= thisMonth)
        .length,
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
    const { id, memo, status } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다." }, { status: 400 });
    }

    const fields: Record<string, string> = {};
    if (memo !== undefined) fields["메모"] = memo;
    if (status !== undefined) fields["상태"] = status;

    const res = await fetch(
      `https://api.airtable.com/v0/${INQUIRIES_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${id}`,
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

    const res = await fetch(
      `https://api.airtable.com/v0/${INQUIRIES_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${id}`,
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
