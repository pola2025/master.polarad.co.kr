import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { getContract, approveContract } from "@/lib/contracts";
import { sendContractConfirmedEmail } from "@/lib/contract-email";
import { getChatFileFromR2 } from "@/lib/r2-client";

export const runtime = "nodejs";
export const maxDuration = 30;

function clientIp(req: NextRequest): string {
  const h = req.headers;
  return (h.get("x-vercel-forwarded-for") || h.get("x-real-ip") || "")
    .split(",")[0]
    .trim();
}

const EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/**
 * POST /api/contracts/[id]/approve — 완료체크 = 계약확정(SUBMITTED → APPROVED).
 * 확정 시 광고주에게 확정 안내메일 + 최종본(날인 업로드본) 자동 발송.
 */
export async function POST(
  req: NextRequest,
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
    if (contract.status !== "SUBMITTED") {
      return NextResponse.json(
        { error: `확정할 수 없는 상태(${contract.status})` },
        { status: 409 },
      );
    }

    const ok = await approveContract(id, "admin", clientIp(req));
    if (!ok) {
      return NextResponse.json(
        { error: "확정 처리 실패(경합)" },
        { status: 409 },
      );
    }

    // 확정 안내메일 + 최종본 자동 발송 (실패해도 확정은 유지)
    let emailSent = false;
    let emailError = "";
    try {
      let finalDoc:
        | { filename: string; content: Buffer; contentType: string }
        | undefined;
      if (contract.uploaded_contract_key) {
        const dl = await getChatFileFromR2(contract.uploaded_contract_key);
        const ext = EXT[dl.contentType] || "pdf";
        finalDoc = {
          filename: `계약서_${contract.contract_number}.${ext}`,
          content: Buffer.from(dl.data),
          contentType: dl.contentType,
        };
      }
      await sendContractConfirmedEmail(
        { ...contract, status: "APPROVED" },
        finalDoc,
      );
      emailSent = true;
    } catch (e) {
      emailError = e instanceof Error ? e.message : String(e);
      console.error("[master/contracts] 확정메일 실패:", emailError);
    }

    return NextResponse.json({ ok: true, emailSent, emailError });
  } catch (err) {
    console.error("[master/contracts] approve 실패:", err);
    return NextResponse.json({ error: "확정 실패" }, { status: 500 });
  }
}
