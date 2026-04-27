import { NextRequest, NextResponse } from "next/server";
import { d1All, d1Run, newId, nowIso } from "@/lib/d1-client";

interface AdSpendRow {
  id: string;
  month: string;
  meta_amount: number;
  google_amount: number;
  memo: string;
}

export async function GET(request: NextRequest) {
  try {
    const month = request.nextUrl.searchParams.get("month");
    const sql = month
      ? `SELECT id, month, meta_amount, google_amount, memo FROM ad_spend WHERE month = ? LIMIT 100`
      : `SELECT id, month, meta_amount, google_amount, memo FROM ad_spend ORDER BY month DESC LIMIT 100`;
    const rows = await d1All<AdSpendRow>(sql, month ? [month] : []);

    const records = rows.map((r) => ({
      id: r.id,
      month: r.month || "",
      metaAmount: r.meta_amount || 0,
      googleAmount: r.google_amount || 0,
      memo: r.memo || "",
    }));

    return NextResponse.json({ records });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.month) {
      return NextResponse.json({ error: "month 필요" }, { status: 400 });
    }
    const id = newId();
    const now = nowIso();

    await d1Run(
      `INSERT INTO ad_spend (id, month, meta_amount, google_amount, memo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(month) DO UPDATE SET
         meta_amount = excluded.meta_amount,
         google_amount = excluded.google_amount,
         memo = excluded.memo,
         updated_at = excluded.updated_at`,
      [
        id,
        String(body.month),
        Number(body.metaAmount) || 0,
        Number(body.googleAmount) || 0,
        String(body.memo || ""),
        now,
        now,
      ],
    );

    return NextResponse.json({ id });
  } catch (error) {
    console.error("AdSpend 생성 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: "ID 필요" }, { status: 400 });
    }

    const fieldMap: Record<string, string> = {
      metaAmount: "meta_amount",
      googleAmount: "google_amount",
      memo: "memo",
      month: "month",
    };

    const sets: string[] = [];
    const params: (string | number)[] = [];
    for (const [key, value] of Object.entries(updates)) {
      const col = fieldMap[key];
      if (col && value !== undefined) {
        sets.push(`${col} = ?`);
        params.push(value as string | number);
      }
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "수정할 필드 없음" }, { status: 400 });
    }

    sets.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);

    const result = await d1Run(
      `UPDATE ad_spend SET ${sets.join(", ")} WHERE id = ?`,
      params,
    );
    if (!result.meta?.changes) {
      return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
