import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { getContract, rejectContract } from "@/lib/contracts";

export const runtime = "nodejs";

function clientIp(req: NextRequest): string {
  const h = req.headers;
  return (h.get("x-vercel-forwarded-for") || h.get("x-real-ip") || "")
    .split(",")[0]
    .trim();
}

/** POST /api/contracts/[id]/reject — 반려(SUBMITTED → REJECTED). body: {reason} */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let reason = "";
  try {
    const body = await req.json();
    reason = String(body?.reason || "")
      .trim()
      .slice(0, 1000);
  } catch {
    /* reason 없음 허용 */
  }

  try {
    const contract = await getContract(id);
    if (!contract) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (contract.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: `반려할 수 없는 상태(${contract.status})` },
        { status: 409 },
      );
    }
    const ok = await rejectContract(id, reason, clientIp(req));
    if (!ok) {
      return NextResponse.json(
        { error: "반려 처리 실패(경합)" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[master/contracts] reject 실패:", err);
    return NextResponse.json({ error: "반려 실패" }, { status: 500 });
  }
}
