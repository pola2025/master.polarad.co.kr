/**
 * 계약서 HTML 렌더 — 서버(Next)에서 D1 Contract → HTML.
 * 빌더(contract-html.mjs)를 감싸 관리자 점검/공개 서명페이지에서 공용 사용.
 */

import { buildContractHtml } from "@/lib/contracts/contract-html.mjs";
import { toBuilderData, type Contract } from "@/lib/contracts";

export interface RenderOptions {
  /** 계약일자 표시(없으면 빈칸). */
  signDate?: string;
}

/** Contract(D1) → 계약서 HTML 전체 문서(A4). */
export function renderContractHtml(
  c: Contract,
  opts: RenderOptions = {},
): string {
  const data = { ...toBuilderData(c), signDate: opts.signDate };
  return buildContractHtml(data);
}
