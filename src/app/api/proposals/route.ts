import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const PROPOSALS_BASE_ID = "appSGHxitRzYPE43H";
const TABLE_NAME = "Proposals";

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, string | number | boolean | undefined>;
}

// GET: 제안서 목록 조회
export async function GET() {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json(
      { error: "AIRTABLE_API_TOKEN이 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const headers = { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` };
    const url = `https://api.airtable.com/v0/${PROPOSALS_BASE_ID}/${encodeURIComponent(TABLE_NAME)}?sort%5B0%5D%5Bfield%5D=date&sort%5B0%5D%5Bdirection%5D=desc`;

    const res = await fetch(url, { headers, cache: "no-store" });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Airtable 요청 실패" },
        { status: res.status },
      );
    }

    const proposals = (data.records || []).map((r: AirtableRecord) => ({
      id: r.id,
      slug: r.fields.slug || "",
      title: r.fields.title || "",
      subtitle: r.fields.subtitle || "",
      clientName: r.fields.clientName || "",
      amount: r.fields.amount || "",
      products: r.fields.products || "",
      date: r.fields.date || "",
      status: r.fields.status || "공개",
      views: r.fields.views || 0,
      themeColor: r.fields.themeColor || "#1e3a5f",
      password: r.fields.password || "",
      createdTime: r.createdTime,
    }));

    return NextResponse.json({
      proposals,
      stats: {
        total: proposals.length,
        public: proposals.filter((p: { status: string }) => p.status === "공개")
          .length,
        private: proposals.filter(
          (p: { status: string }) => p.status === "비공개",
        ).length,
        totalViews: proposals.reduce(
          (sum: number, p: { views: number }) => sum + p.views,
          0,
        ),
      },
    });
  } catch (error) {
    console.error("Proposals GET error:", error);
    return NextResponse.json(
      { error: "제안서 목록 조회 실패" },
      { status: 500 },
    );
  }
}

// PATCH: 상태 토글 (공개/비공개)
export async function PATCH(request: NextRequest) {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json(
      { error: "AIRTABLE_API_TOKEN이 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const { recordId, status, amount, products } = body;

    if (!recordId) {
      return NextResponse.json(
        { error: "recordId가 필요합니다." },
        { status: 400 },
      );
    }

    const fields: Record<string, string> = {};
    if (status !== undefined) fields.status = status;
    if (amount !== undefined) fields.amount = amount;
    if (products !== undefined) fields.products = products;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { error: "변경할 필드가 없습니다." },
        { status: 400 },
      );
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${PROPOSALS_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${recordId}`,
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
      const data = await res.json();
      return NextResponse.json(
        { error: data.error?.message || "상태 변경 실패" },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Proposals PATCH error:", error);
    return NextResponse.json({ error: "상태 변경 실패" }, { status: 500 });
  }
}

// DELETE: 제안서 삭제 (Airtable 레코드)
export async function DELETE(request: NextRequest) {
  if (!AIRTABLE_API_TOKEN) {
    return NextResponse.json(
      { error: "AIRTABLE_API_TOKEN이 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  try {
    const { recordId } = await request.json();

    if (!recordId) {
      return NextResponse.json(
        { error: "recordId가 필요합니다." },
        { status: 400 },
      );
    }

    const res = await fetch(
      `https://api.airtable.com/v0/${PROPOSALS_BASE_ID}/${encodeURIComponent(TABLE_NAME)}/${recordId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
      },
    );

    if (!res.ok) {
      const data = await res.json();
      return NextResponse.json(
        { error: data.error?.message || "삭제 실패" },
        { status: res.status },
      );
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Proposals DELETE error:", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
