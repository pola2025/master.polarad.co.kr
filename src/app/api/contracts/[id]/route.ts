import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { getContract, parseSpecialTerms } from "@/lib/contracts";

export const runtime = "nodejs";

/** GET /api/contracts/[id] — 관리자 계약 상세 */
export async function GET(
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
    return NextResponse.json({
      contract: {
        ...contract,
        special_terms_list: parseSpecialTerms(contract.special_terms),
      },
    });
  } catch (err) {
    console.error("[master/contracts] detail 실패:", err);
    return NextResponse.json({ error: "조회 실패" }, { status: 500 });
  }
}
