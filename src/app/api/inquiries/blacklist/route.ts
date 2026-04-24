import { NextRequest, NextResponse } from "next/server";
import {
  listBlacklist,
  addToBlacklist,
  removeFromBlacklist,
  normalizePhone,
} from "@/lib/blacklist";

export async function GET() {
  try {
    const entries = await listBlacklist();
    return NextResponse.json({ entries });
  } catch (error) {
    console.error("[blacklist] GET 오류:", error);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      console.error(`[blacklist] POST JSON 파싱 실패 (IP: ${ip})`);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { phone, name, reason, source } = body as {
      phone?: string;
      name?: string;
      reason?: string;
      source?: "홈페이지" | "Meta" | "수동";
    };
    if (!phone) {
      return NextResponse.json(
        { error: "phone이 필요합니다." },
        { status: 400 },
      );
    }
    if (!normalizePhone(phone)) {
      return NextResponse.json(
        { error: "전화번호 형식 오류" },
        { status: 400 },
      );
    }
    const result = await addToBlacklist({
      phone,
      name,
      reason,
      source: source ?? "수동",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, id: result.id });
  } catch (error) {
    console.error("[blacklist] POST 오류:", error);
    return NextResponse.json({ error: "등록 실패" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      console.error(`[blacklist] DELETE JSON 파싱 실패 (IP: ${ip})`);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const { id } = body as { id?: string };
    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }
    const result = await removeFromBlacklist(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[blacklist] DELETE 오류:", error);
    return NextResponse.json({ error: "삭제 실패" }, { status: 500 });
  }
}
