/**
 * 계약서 HTML 빌더 — v1.0 표준양식(contract-template.html) 토큰 치환.
 *
 * 단일 소스: Next API(.ts에서 import) + 검증 스크립트(node .mjs) 공용.
 * 계약 본문은 폴라애드가 검토 완료한 v1.0 HTML을 그대로 사용하고,
 * 당사자정보·금액·기간·서명·도장만 주입한다.
 *
 * 도장(을)은 polarad-seal.png를 base64 data URL로 임베드 — __dirname/CDN 의존 제거.
 * 고객 서명(갑)은 data:image/png base64 또는 (인) 폴백.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

// 자산 경로 해석 — 로컬 스크립트(HERE) + Vercel 번들(cwd, outputFileTracingIncludes) 모두 대응.
function resolveAsset(name) {
  const candidates = [
    path.join(HERE, name),
    path.join(process.cwd(), "src/lib/contracts", name),
    path.join(process.cwd(), "src", "lib", "contracts", name),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return candidates[0];
}

const TEMPLATE_PATH = resolveAsset("contract-template.html");
const SEAL_PATH = resolveAsset("polarad-seal.png");

/** HTML 이스케이프 (5종) — 사용자 입력 삽입 전 필수. */
export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function won(n) {
  return Number(n).toLocaleString("ko-KR") + "원";
}

let _sealDataUrl = null;
function getSealDataUrl() {
  if (_sealDataUrl !== null) return _sealDataUrl;
  // 도장 로드 실패는 조용히 넘기지 않는다 — 빈 도장 계약서 방지.
  const buf = fs.readFileSync(SEAL_PATH);
  _sealDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
  return _sealDataUrl;
}

/**
 * @typedef {Object} ContractData
 * @property {string} partyAName        갑 상호(법인/사업자명) — 본문 표시용
 * @property {string} partyABizName     갑 상호 (표/서명란)
 * @property {string} partyACeo         갑 대표자
 * @property {string} partyABizNo       갑 사업자등록번호
 * @property {string} partyAAddr        갑 소재지
 * @property {string} partyAPhone       갑 연락처
 * @property {string} partyAEmail       갑 이메일(+통신판매업 등)
 * @property {number} monthlyFee        월 대행료 (VAT 포함, 원)
 * @property {number} periodMonths      계약 기간(개월)
 * @property {string} [planLabel]       플랜명 (기본 "스탠다드 플랜")
 * @property {string} [clientSignature] 고객 서명 data:image/png;base64,...
 * @property {string} [signDate]        계약일자 표시 (기본 빈칸)
 */

/**
 * 계약서 HTML 문자열 생성.
 * @param {ContractData} data
 * @returns {string}
 */
export function buildContractHtml(data) {
  const monthly = Number(data.monthlyFee) || 0;
  const months = Number(data.periodMonths) || 0;
  const total = monthly * months;
  const planLabel = data.planLabel || "스탠다드 플랜";

  // 환불 예시 — 기간의 약 1/3 사용 시나리오로 동적 산출
  const usedMonths = Math.max(1, Math.floor(months / 3));
  const remainMonths = Math.max(0, months - usedMonths);
  const remainGross = remainMonths * monthly;
  const refund = Math.round(remainGross * 0.7);

  const sealImg = `<img src="${getSealDataUrl()}" alt="폴라애드 직인" style="width:22mm;height:22mm;object-fit:contain;" />`;

  const clientSign =
    typeof data.clientSignature === "string" &&
    data.clientSignature.startsWith("data:image/")
      ? `<img src="${data.clientSignature}" alt="갑 서명" style="height:16mm;max-width:45mm;object-fit:contain;" />`
      : `<div class="stamp">(인)</div>`;

  const projectLine = data.projectName
    ? `<p class="mt-1 font-semibold text-gray-800" style="font-size: 9.5pt">대상 사업: ${escapeHtml(data.projectName)}</p>`
    : "";

  // 법인등록번호 행 (갑이 법인일 때만). 을(폴라애드)은 개인사업자라 "—".
  const corpRow = data.partyACorpNo
    ? `<tr class="border-b border-gray-200">
                <td class="py-1.5 px-2 text-gray-500">법인등록번호</td>
                <td class="py-1.5 px-2 num">${escapeHtml(data.partyACorpNo)}</td>
                <td class="py-1.5 px-2 num">—</td>
              </tr>`
    : "";

  // 청구금액(선결제 합산) 강조 박스
  const billingBox = `<div class="mt-1 mb-2 p-2 bg-gray-50 border border-gray-300 rounded"><p class="font-bold text-gray-900">선결제 청구금액: <span class="num">${won(total)}</span> <span class="text-gray-600" style="font-weight: 400">(월 ${won(monthly)} × ${months}개월 · VAT 포함)</span></p></div>`;

  // 결제방식 (문서엔 문구만; 실제 계좌·온라인결제 링크는 서명 UI 하단 별도)
  const paymentMethod = escapeHtml(
    data.paymentMethod || "지정계좌이체 또는 온라인결제",
  );

  // 특약사항 (관리자 입력 다건). 없으면 섹션 미표시.
  const terms = Array.isArray(data.specialTerms)
    ? data.specialTerms.map((t) => String(t).trim()).filter(Boolean)
    : [];
  const specialSection = terms.length
    ? `<section class="mb-3 clause"><h2 class="font-bold text-gray-900 mb-1">제16조 (특약사항)</h2><ol class="list-decimal pl-5 space-y-0.5">${terms
        .map((t) => `<li>${escapeHtml(t)}</li>`)
        .join("")}</ol></section>`
    : "";

  const tokens = {
    PLAN_SUBTITLE: `${escapeHtml(planLabel)} · 월 ${won(monthly)}(VAT 포함) · ${months}개월`,
    PROJECT_LINE: projectLine,
    PARTY_A_CORPNO_ROW: corpRow,
    BILLING_BOX: billingBox,
    PAYMENT_METHOD: paymentMethod,
    SPECIAL_TERMS_SECTION: specialSection,
    PARTY_A_NAME: escapeHtml(data.partyAName || data.partyABizName || ""),
    PARTY_A_BIZNAME: escapeHtml(data.partyABizName || ""),
    PARTY_A_CEO: escapeHtml(data.partyACeo || ""),
    PARTY_A_BIZNO: escapeHtml(data.partyABizNo || ""),
    PARTY_A_ADDR: escapeHtml(data.partyAAddr || ""),
    PARTY_A_PHONE: escapeHtml(data.partyAPhone || ""),
    PARTY_A_EMAIL: escapeHtml(data.partyAEmail || ""),
    PERIOD_TEXT: `${months}개월`,
    MONTHLY_FEE: `월 ${won(monthly)}(VAT 포함)`,
    TOTAL_FEE: `${won(total)}(VAT 포함)`,
    PREPAY_TEXT: `${months}개월분 전액을 일시 선결제`,
    REFUND_FORMULA: `환불액 = (잔여 개월 수 × ${won(monthly)}) × 70%`,
    REFUND_EXAMPLE: `예) ${months}개월 계약 중 ${usedMonths}개월 사용 후 해지 → 잔여 ${remainMonths}개월 × ${won(monthly)} = ${won(remainGross)} × 70% = <b class="num">${won(refund)} 환불</b>`,
    SIGN_DATE: data.signDate ? escapeHtml(data.signDate) : "____년 ____월 ____일",
    PARTY_A_SIGN: clientSign,
    SEAL_IMG: sealImg,
  };

  let html = fs.readFileSync(TEMPLATE_PATH, "utf-8");
  for (const [key, val] of Object.entries(tokens)) {
    html = html.split(`{{${key}}}`).join(val);
  }

  // 치환 누락 토큰 검출 (방어)
  const leftover = html.match(/\{\{[A-Z_]+\}\}/g);
  if (leftover) {
    throw new Error(`계약서 토큰 치환 누락: ${[...new Set(leftover)].join(", ")}`);
  }
  return html;
}

export { TEMPLATE_PATH, SEAL_PATH };
