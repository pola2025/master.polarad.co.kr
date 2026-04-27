import { NextRequest, NextResponse } from "next/server";
import { d1All, d1Run, newId, nowIso } from "@/lib/d1-client";

// 영문 ↔ 한글 status 매핑
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

interface ClientRow {
  id: string;
  company: string;
  contact_name: string;
  phone: string;
  email: string;
  industry: string;
  website: string;
  address: string;
  business_number: string;
  contract_amount: number;
  contract_start: string;
  contract_end: string;
  status: string;
  memo: string;
  inquiry_id: string;
  created_at: string;
}

export async function GET() {
  try {
    const rows = await d1All<ClientRow>(
      `SELECT id, company, contact_name, phone, email, industry, website, address,
              business_number, contract_amount, contract_start, contract_end, status, memo,
              inquiry_id, created_at
       FROM clients LIMIT 200`,
    );

    const clients = rows.map((r) => ({
      id: r.id,
      company: r.company || "",
      contactName: r.contact_name || "",
      phone: r.phone || "",
      email: r.email || "",
      industry: r.industry || "",
      website: r.website || "",
      address: r.address || "",
      businessNumber: r.business_number || "",
      contractAmount: r.contract_amount || 0,
      contractStart: r.contract_start || "",
      contractEnd: r.contract_end || "",
      status: (EN_CLIENT_STATUS_TO_KR[r.status] ?? r.status) || "대기",
      memo: r.memo || "",
      inquiryId: r.inquiry_id || "",
      createdAt: r.created_at,
    }));

    // 정렬: 진행중 우선
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
  try {
    const body = await request.json();
    const id = newId();
    const now = nowIso();

    await d1Run(
      `INSERT INTO clients
        (id, company, contact_name, phone, email, industry, contract_amount, inquiry_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        String(body.company || ""),
        String(body.contactName || ""),
        String(body.phone || ""),
        String(body.email || ""),
        String(body.industry || ""),
        Number(body.contractAmount) || 0,
        String(body.inquiryId || ""),
        "Waiting",
        now,
        now,
      ],
    );

    return NextResponse.json({ id });
  } catch (error) {
    console.error("Client 생성 오류:", error);
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
      company: "company",
      contactName: "contact_name",
      phone: "phone",
      email: "email",
      industry: "industry",
      website: "website",
      address: "address",
      businessNumber: "business_number",
      contractAmount: "contract_amount",
      contractStart: "contract_start",
      contractEnd: "contract_end",
      memo: "memo",
      inquiryId: "inquiry_id",
    };

    const sets: string[] = [];
    const params: (string | number)[] = [];
    for (const [key, value] of Object.entries(updates)) {
      if (key === "status" && typeof value === "string") {
        sets.push("status = ?");
        params.push(KR_CLIENT_STATUS_TO_EN[value] ?? value);
      } else {
        const col = fieldMap[key];
        if (col && value !== undefined) {
          sets.push(`${col} = ?`);
          params.push(value as string | number);
        }
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: "수정할 필드 없음" }, { status: 400 });
    }

    sets.push("updated_at = ?");
    params.push(nowIso());
    params.push(id);

    const result = await d1Run(
      `UPDATE clients SET ${sets.join(", ")} WHERE id = ?`,
      params,
    );
    if (!result.meta?.changes) {
      return NextResponse.json({ error: "업데이트 실패" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Client 업데이트 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "ID 필요" }, { status: 400 });
    }

    const result = await d1Run("DELETE FROM clients WHERE id = ?", [id]);
    if (!result.meta?.changes) {
      return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Client 삭제 오류:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
