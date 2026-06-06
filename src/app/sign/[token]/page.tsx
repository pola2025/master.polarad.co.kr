import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import { getContractByToken, markOpened } from "@/lib/contracts";
import { renderContractHtml } from "@/lib/contract-render";
import { POLARAD_PAYMENT } from "@/lib/contract-payment";
import { gateValid, gateCookieName, maskEmail } from "@/lib/sign-gate";
import SignClient from "./SignClient";
import CodeGate from "./CodeGate";
import PaymentGuide from "./PaymentGuide";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 검색엔진 인덱싱 차단(토큰 URL 노출 방지)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

function StatusCard({
  title,
  desc,
  tone = "blue",
}: {
  title: string;
  desc?: string;
  tone?: "blue" | "red" | "green";
}) {
  const c =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : tone === "green"
        ? "border-green-200 bg-green-50 text-green-800"
        : "border-blue-200 bg-blue-50 text-blue-800";
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className={`max-w-md w-full rounded-xl border p-8 text-center ${c}`}>
        <h1 className="text-lg font-bold">{title}</h1>
        {desc && <p className="mt-2 text-sm">{desc}</p>}
      </div>
    </div>
  );
}

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const contract = await getContractByToken(token);

  if (!contract) {
    return (
      <StatusCard
        title="유효하지 않은 계약 링크입니다"
        desc="링크를 다시 확인해 주세요. 문의: mkt@polarad.co.kr"
        tone="red"
      />
    );
  }

  // 이메일 인증번호 게이트 — 통과 전엔 계약서 내용 비공개
  if (contract.access_code && contract.party_a_email) {
    const cookieStore = await cookies();
    const verified = gateValid(
      token,
      cookieStore.get(gateCookieName(token))?.value,
    );
    if (!verified) {
      return (
        <CodeGate token={token} emailHint={maskEmail(contract.party_a_email)} />
      );
    }
  }

  // 수신확인 기록(최초 1회)
  try {
    const h = await headers();
    const ip =
      (h.get("x-vercel-forwarded-for") || h.get("x-real-ip") || "")
        .split(",")[0]
        .trim() || "";
    await markOpened(token, ip);
  } catch {
    /* 열람 기록 실패는 무시 */
  }

  if (contract.status === "SUBMITTED") {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
            <h1 className="text-lg font-bold text-green-800">
              계약서가 제출되었습니다
            </h1>
            <p className="mt-2 text-sm text-green-700">
              계약번호 {contract.contract_number}
              <br />
              폴라애드 최종 확인 후 계약확정 안내를 드립니다.
            </p>
            <p className="mt-3 text-sm font-medium text-green-800">
              아직 결제 전이시라면 아래 안내에 따라 계약 금액을 결제해 주세요.
            </p>
          </div>

          <PaymentGuide
            monthlyFee={contract.monthly_fee}
            periodMonths={contract.period_months}
            totalFee={contract.total_fee}
            payment={POLARAD_PAYMENT}
          />

          <p className="text-center text-xs text-gray-400 pb-8">
            폴라애드 (POLARAD) · mkt@polarad.co.kr
          </p>
        </div>
      </div>
    );
  }
  if (contract.status === "APPROVED") {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
            <h1 className="text-lg font-bold text-green-800">
              계약이 확정되었습니다
            </h1>
            <p className="mt-2 text-sm text-green-700">
              계약번호 {contract.contract_number}
              <br />
              최종 계약서가 이메일로 발송되었습니다.
            </p>
            <p className="mt-3 text-sm font-medium text-green-800">
              아직 결제 전이시라면 아래 안내에 따라 계약 금액을 결제해 주세요.
            </p>
          </div>

          <PaymentGuide
            monthlyFee={contract.monthly_fee}
            periodMonths={contract.period_months}
            totalFee={contract.total_fee}
            payment={POLARAD_PAYMENT}
          />

          <p className="text-center text-xs text-gray-400 pb-8">
            폴라애드 (POLARAD) · mkt@polarad.co.kr
          </p>
        </div>
      </div>
    );
  }
  if (contract.status === "REJECTED" || contract.status === "CANCELLED") {
    return (
      <StatusCard
        title="진행이 중단된 계약입니다"
        desc="담당자에게 문의해 주세요. mkt@polarad.co.kr"
        tone="red"
      />
    );
  }

  const contractHtml = renderContractHtml(contract);

  return (
    <SignClient
      token={token}
      contractNumber={contract.contract_number}
      partyName={contract.party_a_name}
      projectName={contract.project_name}
      monthlyFee={contract.monthly_fee}
      periodMonths={contract.period_months}
      totalFee={contract.total_fee}
      contractHtml={contractHtml}
      payment={POLARAD_PAYMENT}
    />
  );
}
