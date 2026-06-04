import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-check";
import {
  createContract,
  listContracts,
  type ContractStatus,
  type CreateContractInput,
} from "@/lib/contracts";

export const runtime = "nodejs";

const VALID_STATUS: ContractStatus[] = [
  "DRAFT",
  "SENT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
];

/** GET /api/contracts?status=SENT — 관리자 계약 목록 */
export async function GET(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const statusParam = req.nextUrl.searchParams.get("status") || "";
    const status = VALID_STATUS.includes(statusParam as ContractStatus)
      ? (statusParam as ContractStatus)
      : undefined;
    const contracts = await listContracts(status);
    return NextResponse.json({ contracts });
  } catch (err) {
    console.error("[master/contracts] list 실패:", err);
    return NextResponse.json({ error: "목록 조회 실패" }, { status: 500 });
  }
}

function isNonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** POST /api/contracts — 계약 생성(DRAFT) */
export async function POST(req: NextRequest) {
  if (!(await requireAuth())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (req.headers.get("content-type")?.includes("application/json") !== true) {
    return NextResponse.json({ error: "Content-Type 오류" }, { status: 415 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  // 필수 검증
  if (!isNonEmpty(body.partyAName))
    return NextResponse.json({ error: "상호(법인명)는 필수" }, { status: 400 });
  if (!isNonEmpty(body.partyACeo))
    return NextResponse.json({ error: "대표자는 필수" }, { status: 400 });
  if (!isNonEmpty(body.partyABizno))
    return NextResponse.json(
      { error: "사업자등록번호는 필수" },
      { status: 400 },
    );
  if (!isNonEmpty(body.partyAAddr))
    return NextResponse.json({ error: "소재지는 필수" }, { status: 400 });

  const monthlyFee = Number(body.monthlyFee);
  const periodMonths = Number(body.periodMonths);
  if (!Number.isFinite(monthlyFee) || monthlyFee <= 0)
    return NextResponse.json(
      { error: "월 금액이 올바르지 않음" },
      { status: 400 },
    );
  if (
    !Number.isInteger(periodMonths) ||
    periodMonths <= 0 ||
    periodMonths > 120
  )
    return NextResponse.json(
      { error: "계약 개월이 올바르지 않음" },
      { status: 400 },
    );

  const specialTerms = Array.isArray(body.specialTerms)
    ? body.specialTerms
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];

  const input: CreateContractInput = {
    partyAName: String(body.partyAName).trim().slice(0, 200),
    partyACeo: String(body.partyACeo).trim().slice(0, 100),
    partyABizno: String(body.partyABizno).trim().slice(0, 40),
    partyACorpno: isNonEmpty(body.partyACorpno)
      ? String(body.partyACorpno).trim().slice(0, 40)
      : "",
    partyAAddr: String(body.partyAAddr).trim().slice(0, 300),
    partyAPhone: isNonEmpty(body.partyAPhone)
      ? String(body.partyAPhone).trim().slice(0, 40)
      : "",
    partyAEmail: isNonEmpty(body.partyAEmail)
      ? String(body.partyAEmail).trim().slice(0, 120)
      : "",
    projectName: isNonEmpty(body.projectName)
      ? String(body.projectName).trim().slice(0, 200)
      : "",
    planLabel: isNonEmpty(body.planLabel)
      ? String(body.planLabel).trim().slice(0, 60)
      : "스탠다드 플랜",
    paymentMethod: isNonEmpty(body.paymentMethod)
      ? String(body.paymentMethod).trim().slice(0, 120)
      : "지정계좌이체 또는 온라인결제",
    specialTerms,
    monthlyFee,
    periodMonths,
  };

  try {
    const contract = await createContract(input);
    return NextResponse.json({ contract }, { status: 201 });
  } catch (err) {
    console.error("[master/contracts] create 실패:", err);
    return NextResponse.json({ error: "계약 생성 실패" }, { status: 500 });
  }
}
