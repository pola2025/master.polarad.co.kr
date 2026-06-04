import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { getContract, markSent, logContract } from "@/lib/contracts";
import { sendContractLinkEmail } from "@/lib/contract-email";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/contracts/[id]/send — 광고주에게 서명 링크 메일 발송(관리자 트리거).
 * 상태 DRAFT/SENT → SENT. 재발송 허용.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const contract = await getContract(id);
    if (!contract) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!contract.party_a_email) {
      return NextResponse.json(
        { error: "광고주 이메일이 등록되어 있지 않습니다" },
        { status: 400 },
      );
    }
    if (!["DRAFT", "SENT"].includes(contract.status)) {
      return NextResponse.json(
        { error: `발송할 수 없는 상태(${contract.status})` },
        { status: 409 },
      );
    }

    const messageId = await sendContractLinkEmail(contract);
    await markSent(id);
    await logContract({
      contractId: id,
      fromStatus: contract.status,
      toStatus: "SENT",
      actor: "admin",
      note: `서명 링크 발송 → ${contract.party_a_email} (${messageId})`,
    });

    return NextResponse.json({ ok: true, messageId });
  } catch (err) {
    console.error("[master/contracts] send 실패:", err);
    return NextResponse.json({ error: "발송 실패" }, { status: 500 });
  }
}
