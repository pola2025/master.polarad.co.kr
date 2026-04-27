import { NextRequest, NextResponse } from "next/server";
import { d1All, d1First, d1Run, newId, nowIso } from "@/lib/d1-client";

// Revenue 변경 시 해당 inquiry(lead/meta_lead)의 contract_amount 동기화
async function syncInquiryAmount(inquiryId: string) {
  if (!inquiryId) return;
  try {
    // 해당 inquiryId의 모든 Revenue 합산
    const sum = await d1First<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) AS total FROM revenue WHERE inquiry_id = ?",
      [inquiryId],
    );
    const totalAmount = sum?.total ?? 0;

    // inquiry 테이블 결정 (Meta vs Lead)
    const isMeta = inquiryId.startsWith("meta_");
    const realId = isMeta ? inquiryId.replace("meta_", "") : inquiryId;
    const table = isMeta ? "meta_lead" : "lead";

    await d1Run(
      `UPDATE ${table} SET contract_amount = ?, updated_at = ? WHERE id = ?`,
      [totalAmount, nowIso(), realId],
    );
  } catch (e) {
    console.error("syncInquiryAmount 실패:", e);
  }
}

interface RevenueRow {
  id: string;
  client_name: string;
  type: string;
  amount: number;
  product_name: string;
  inquiry_id: string;
  client_id: string;
  date: string;
  memo: string;
  created_at: string;
}

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
  try {
    const rows = await d1All<RevenueRow>(
      `SELECT id, client_name, type, amount, product_name, inquiry_id, client_id, date, memo, created_at
       FROM revenue
       ORDER BY date DESC, created_at DESC
       LIMIT 500`,
    );

    const records: RevenueRecord[] = rows.map((r) => ({
      id: r.id,
      clientName: r.client_name || "",
      type: r.type || "",
      amount: r.amount || 0,
      productName: r.product_name || "",
      inquiryId: r.inquiry_id || "",
      clientId: r.client_id || "",
      date: r.date || "",
      memo: r.memo || "",
      createdAt: r.created_at,
    }));

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
      stats: { total: records.length, totalRevenue, byType },
    });
  } catch (error) {
    console.error("Revenue 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = newId();
    const now = nowIso();

    await d1Run(
      `INSERT INTO revenue
        (id, inquiry_id, client_id, client_name, type, product_name, amount, date, memo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        String(body.inquiryId || ""),
        String(body.clientId || ""),
        String(body.clientName || ""),
        String(body.type || ""),
        String(body.productName || ""),
        Number(body.amount) || 0,
        String(body.date || ""),
        String(body.memo || ""),
        now,
        now,
      ],
    );

    if (body.inquiryId) {
      await syncInquiryAmount(String(body.inquiryId));
    }

    return NextResponse.json({ id });
  } catch (error) {
    console.error("Revenue 생성 오류:", error);
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
      clientName: "client_name",
      type: "type",
      amount: "amount",
      productName: "product_name",
      memo: "memo",
      date: "date",
      inquiryId: "inquiry_id",
      clientId: "client_id",
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
      `UPDATE revenue SET ${sets.join(", ")} WHERE id = ?`,
      params,
    );
    if (!result.meta?.changes) {
      return NextResponse.json({ error: "수정 실패" }, { status: 500 });
    }

    // 수정된 레코드의 inquiry_id 조회 → 동기화
    const updated = await d1First<{ inquiry_id: string }>(
      "SELECT inquiry_id FROM revenue WHERE id = ?",
      [id],
    );
    if (updated?.inquiry_id) {
      await syncInquiryAmount(updated.inquiry_id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Revenue 수정 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "ID 필요" }, { status: 400 });
    }

    // 삭제 전 inquiry_id 조회
    const target = await d1First<{ inquiry_id: string }>(
      "SELECT inquiry_id FROM revenue WHERE id = ?",
      [id],
    );

    const result = await d1Run("DELETE FROM revenue WHERE id = ?", [id]);
    if (!result.meta?.changes) {
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }

    if (target?.inquiry_id) {
      await syncInquiryAmount(target.inquiry_id);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Revenue 삭제 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
