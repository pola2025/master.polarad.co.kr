import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import { getContract } from "@/lib/contracts";
import { getChatFileFromR2 } from "@/lib/r2-client";

export const runtime = "nodejs";

/** GET /api/contracts/[id]/file/[kind] — 관리자 업로드본 열람 (kind: contract|cert) */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; kind: string }> },
) {
  if (!(await requireAuth())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { id, kind } = await params;
  const c = await getContract(id);
  if (!c) return new NextResponse("Not found", { status: 404 });

  const key =
    kind === "contract"
      ? c.uploaded_contract_key
      : kind === "cert"
        ? c.uploaded_seal_cert_key
        : "";
  if (!key) return new NextResponse("파일 없음", { status: 404 });

  try {
    const dl = await getChatFileFromR2(key);
    return new NextResponse(dl.data, {
      status: 200,
      headers: {
        "Content-Type": dl.contentType,
        "Content-Disposition": `inline; filename="${kind}-${c.contract_number}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[master/contracts] file 열람 실패:", err);
    return new NextResponse("파일 열람 실패", { status: 500 });
  }
}
