import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = "appSGHxitRzYPE43H";
const TABLE_ID = "tblmk9oQZQty3rrOx";

const FIELD = {
  month: "fld0vAkbSSJnXv4xc",
  metaAmount: "fldRbfo5ibHeLYPUz",
  googleAmount: "fldAfCZ2QKhSVWcBW",
  memo: "fld1qzA3UtWKmCJJX",
} as const;

export async function GET(request: NextRequest) {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
  }

  try {
    const month = request.nextUrl.searchParams.get("month");
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`);
    url.searchParams.set("returnFieldsByFieldId", "true");
    url.searchParams.set("maxRecords", "100");
    if (month) {
      url.searchParams.set("filterByFormula", `{${FIELD.month}}="${month}"`);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) {
      return NextResponse.json({ error: "조회 실패" }, { status: 500 });
    }

    const data = await res.json();
    const records = (data.records || []).map(
      (r: {
        id: string;
        fields: Record<string, string | number | undefined>;
      }) => ({
        id: r.id,
        month: String(r.fields[FIELD.month] ?? ""),
        metaAmount: (r.fields[FIELD.metaAmount] as number) ?? 0,
        googleAmount: (r.fields[FIELD.googleAmount] as number) ?? 0,
        memo: String(r.fields[FIELD.memo] ?? ""),
      }),
    );

    return NextResponse.json({ records });
  } catch {
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
    if (body.month) fields["month"] = body.month;
    if (body.metaAmount !== undefined) fields["metaAmount"] = body.metaAmount;
    if (body.googleAmount !== undefined)
      fields["googleAmount"] = body.googleAmount;
    if (body.memo) fields["memo"] = body.memo;

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
      console.error("AdSpend 생성 실패:", err);
      return NextResponse.json({ error: "생성 실패" }, { status: 500 });
    }

    const result = await res.json();
    return NextResponse.json({ id: result.id });
  } catch {
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
    if (updates.metaAmount !== undefined)
      fields["metaAmount"] = updates.metaAmount;
    if (updates.googleAmount !== undefined)
      fields["googleAmount"] = updates.googleAmount;
    if (updates.memo !== undefined) fields["memo"] = updates.memo;

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
      return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
