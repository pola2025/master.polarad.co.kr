import { NextRequest, NextResponse } from "next/server";
import { d1All, d1Run, nowIso } from "@/lib/d1-client";

interface ProposalRow {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  client_name: string;
  amount: number;
  products: string;
  date: string;
  status: string;
  views: number;
  theme_color: string;
  password: string;
  created_at: string;
}

export async function GET() {
  try {
    const rows = await d1All<ProposalRow>(
      `SELECT id, slug, title, subtitle, client_name, amount, products, date,
              status, views, theme_color, password, created_at
       FROM proposals
       ORDER BY date DESC, created_at DESC`,
    );

    const proposals = rows.map((r) => ({
      id: r.id,
      slug: r.slug || "",
      title: r.title || "",
      subtitle: r.subtitle || "",
      clientName: r.client_name || "",
      amount: r.amount || 0,
      products: r.products || "",
      date: r.date || "",
      status: r.status || "공개",
      views: r.views || 0,
      themeColor: r.theme_color || "#1e3a5f",
      hasPassword: !!r.password,
      createdTime: r.created_at,
    }));

    return NextResponse.json({
      proposals,
      stats: {
        total: proposals.length,
        public: proposals.filter((p) => p.status === "공개").length,
        private: proposals.filter((p) => p.status === "비공개").length,
        totalViews: proposals.reduce((sum, p) => sum + p.views, 0),
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

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { recordId, status, amount, products } = body;

    if (!recordId) {
      return NextResponse.json(
        { error: "recordId가 필요합니다." },
        { status: 400 },
      );
    }

    const sets: string[] = [];
    const params: (string | number)[] = [];

    if (status !== undefined) {
      sets.push("status = ?");
      params.push(String(status));
    }
    if (amount !== undefined) {
      sets.push("amount = ?");
      params.push(Number(amount) || 0);
    }
    if (products !== undefined) {
      sets.push("products = ?");
      params.push(String(products));
    }

    if (sets.length === 0) {
      return NextResponse.json(
        { error: "변경할 필드가 없습니다." },
        { status: 400 },
      );
    }

    sets.push("updated_at = ?");
    params.push(nowIso());
    params.push(recordId);

    const result = await d1Run(
      `UPDATE proposals SET ${sets.join(", ")} WHERE id = ?`,
      params,
    );
    if (!result.meta?.changes) {
      return NextResponse.json({ error: "상태 변경 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Proposals PATCH error:", error);
    return NextResponse.json({ error: "상태 변경 실패" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { recordId } = await request.json();
    if (!recordId) {
      return NextResponse.json(
        { error: "recordId가 필요합니다." },
        { status: 400 },
      );
    }

    const result = await d1Run("DELETE FROM proposals WHERE id = ?", [
      recordId,
    ]);
    if (!result.meta?.changes) {
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("Proposals DELETE error:", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
