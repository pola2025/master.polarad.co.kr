import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { getContract } from "@/lib/contracts";
import { renderContractHtml } from "@/lib/contract-render";

export const runtime = "nodejs";

/** GET /api/contracts/[id]/html — 관리자 점검용 계약서 HTML(수신확인 미기록) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAuth())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id } = await params;
  const contract = await getContract(id);
  if (!contract) return new NextResponse("Not found", { status: 404 });

  const html = renderContractHtml(contract);
  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
