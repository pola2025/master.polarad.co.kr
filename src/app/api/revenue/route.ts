import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = "appSGHxitRzYPE43H";
const TABLE_ID = "tblah736yhUWmW40E";
const META_BASE_ID = "appyUK6euzEJ5yrGX";
const META_TABLE_ID = "tblxTgGtVkLpniFbb";
const LEAD_TABLE_NAME = "Lead";

// Revenue 변경 시 해당 접수(inquiry)의 contractAmount를 동기화
async function syncInquiryAmount(inquiryId: string) {
  if (!inquiryId || !AIRTABLE_API_TOKEN) return;

  try {
    // 해당 inquiryId의 모든 Revenue 합산
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set("returnFieldsByFieldId", "true");
    url.searchParams.set("maxRecords", "100");
    url.searchParams.set("filterByFormula", `{inquiryId}="${inquiryId}"`);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    const totalAmount = (data.records || []).reduce(
      (sum: number, r: { fields: Record<string, number | undefined> }) =>
        sum + ((r.fields["fldTKcF6XkcbHwpXH"] as number) ?? 0),
      0,
    );

    // inquiry 업데이트 (Meta vs Lead 구분)
    const isMeta = inquiryId.startsWith("meta_");
    const realId = isMeta ? inquiryId.replace("meta_", "") : inquiryId;
    const baseId = isMeta ? META_BASE_ID : BASE_ID;
    const tableId = isMeta
      ? META_TABLE_ID
      : encodeURIComponent(LEAD_TABLE_NAME);

    await fetch(`https://api.airtable.com/v0/${baseId}/${tableId}/${realId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: { contractAmount: totalAmount },
        typecast: true,
      }),
    });
  } catch {
    // 동기화 실패해도 매출 수정 자체는 성공으로 처리
  }
}

const FIELD = {
  clientName: "fldREus4uqEzNiqoT",
  type: "fldyxQyXDMQJEtcWe",
  amount: "fldTKcF6XkcbHwpXH",
  productName: "fldFKjPBk6kXWAYvE",
  inquiryId: "fldDJA4liQLbkiKHF",
  clientId: "fldfk4xtKuxHxItFM",
  date: "fldZqGnvLCbBDKNSp",
  memo: "fld9GG8GxvdDSTdhe",
} as const;

interface RevenueRecord {
  id: string;
  clientName: string;
  type: string;
  amount: number;
  productName: string;
  inquiryId: string;
  clientId: string;
  date: string;
  memo: string;
  createdAt: string;
}

export async function GET() {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const headers = { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` };
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set("returnFieldsByFieldId", "true");
    url.searchParams.set("maxRecords", "500");
    url.searchParams.set("sort[0][field]", FIELD.date);
    url.searchParams.set("sort[0][direction]", "desc");

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) {
      console.error("Revenue 조회 실패:", await res.text());
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    const data = await res.json();
    const records: RevenueRecord[] = (data.records || []).map(
      (r: {
        id: string;
        createdTime: string;
        fields: Record<string, string | number | undefined>;
      }) => ({
        id: r.id,
        clientName: String(r.fields[FIELD.clientName] ?? ""),
        type: String(r.fields[FIELD.type] ?? ""),
        amount: (r.fields[FIELD.amount] as number) ?? 0,
        productName: String(r.fields[FIELD.productName] ?? ""),
        inquiryId: String(r.fields[FIELD.inquiryId] ?? ""),
        clientId: String(r.fields[FIELD.clientId] ?? ""),
        date: String(r.fields[FIELD.date] ?? ""),
        memo: String(r.fields[FIELD.memo] ?? ""),
        createdAt: r.createdTime,
      }),
    );

    // 통계
    const totalRevenue = records.reduce((sum, r) => sum + r.amount, 0);
    const byType = records.reduce(
      (acc, r) => {
        const t = r.type || "기타";
        acc[t] = (acc[t] || 0) + r.amount;
        return acc;
      },
      {} as Record<string, number>,
    );

    return NextResponse.json({
      records,
      stats: {
        total: records.length,
        totalRevenue,
        byType,
      },
    });
  } catch (error) {
    console.error("Revenue 오류:", error);
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

    if (body.clientName) fields.clientName = body.clientName;
    if (body.type) fields.type = body.type;
    if (body.amount !== undefined) fields.amount = body.amount;
    if (body.productName) fields.productName = body.productName;
    if (body.inquiryId) fields.inquiryId = body.inquiryId;
    if (body.clientId) fields.clientId = body.clientId;
    if (body.date) fields.date = body.date;
    if (body.memo) fields.memo = body.memo;

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
      console.error("Revenue 생성 실패:", err);
      return NextResponse.json({ error: "생성 실패" }, { status: 500 });
    }

    const result = await res.json();
    return NextResponse.json({ id: result.id });
  } catch (error) {
    console.error("Revenue 생성 오류:", error);
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
    if (updates.clientName !== undefined)
      fields.clientName = updates.clientName;
    if (updates.type !== undefined) fields.type = updates.type;
    if (updates.amount !== undefined) fields.amount = updates.amount;
    if (updates.productName !== undefined)
      fields.productName = updates.productName;
    if (updates.memo !== undefined) fields.memo = updates.memo;
    if (updates.date !== undefined) fields.date = updates.date;

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
      console.error("Revenue 수정 실패:", err);
      return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }

    // 수정된 레코드의 inquiryId를 가져와서 접수 금액 동기화
    const updated = await res.json();
    const inquiryId =
      updated.fields?.inquiryId || updated.fields?.[FIELD.inquiryId] || "";
    if (inquiryId) {
      await syncInquiryAmount(inquiryId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Revenue 수정 오류:", error);
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

    // 삭제 전 inquiryId 조회
    const getRes = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}/${id}?returnFieldsByFieldId=true`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` } },
    );
    const record = getRes.ok ? await getRes.json() : null;
    const inquiryId = record?.fields?.[FIELD.inquiryId] || "";

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

    // 삭제 후 접수 금액 동기화
    if (inquiryId) {
      await syncInquiryAmount(inquiryId);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Revenue 삭제 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
