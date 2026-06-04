/**
 * 계약 관련 메일 — Gmail OAuth(mkt9834) 경유.
 *  - sendContractLinkEmail: 광고주에게 서명 링크 전달(관리자 트리거)
 *  - sendContractConfirmedEmail: 계약확정 안내 + 최종본 PDF 첨부(확정 시 자동)
 */

import { sendGmail } from "@/lib/gmail-send";
import { escapeHtml } from "@/lib/html-escape";
import type { Contract } from "@/lib/contracts";

const BASE = process.env.MASTER_URL || "https://master.polarad.co.kr";
const won = (n: number) => new Intl.NumberFormat("ko-KR").format(n) + "원";

function shell(title: string, bodyInner: string): string {
  return `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"></head>
<body style="margin:0;background:#f3f4f6;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:28px 16px;">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#0066CC;padding:24px 32px;">
        <div style="font-size:12px;color:#BFDBFE;letter-spacing:2px;">POLARAD</div>
        <div style="font-size:18px;font-weight:700;color:#fff;margin-top:4px;">${escapeHtml(title)}</div>
      </td></tr>
      <tr><td style="padding:28px 32px;color:#111827;font-size:14px;line-height:1.7;">${bodyInner}</td></tr>
      <tr><td style="background:#f3f4f6;padding:18px 32px;font-size:11px;color:#6B7280;">
        폴라애드 (POLARAD) · mkt@polarad.co.kr · polarad.co.kr
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

export async function sendContractLinkEmail(c: Contract): Promise<string> {
  if (!c.party_a_email) throw new Error("광고주 이메일이 없습니다");
  const url = `${BASE}/sign/${c.token}`;
  const inner = `
    <p>안녕하세요, <b>${escapeHtml(c.party_a_name)}</b> 담당자님.</p>
    <p>폴라애드 온라인마케팅 대행 <b>전자계약서</b>를 보내드립니다. 아래 버튼에서 계약서 내용을 확인하시고, 동의 및 법인인감 날인본 업로드로 계약을 진행해 주세요.</p>
    <p style="margin:16px 0;padding:12px 16px;background:#F0F7FF;border-left:4px solid #0066CC;border-radius:4px;">
      계약번호 <b>${escapeHtml(c.contract_number)}</b><br>
      ${c.project_name ? `대상 사업: ${escapeHtml(c.project_name)}<br>` : ""}
      금액: <b>${won(c.total_fee)}</b> (월 ${won(c.monthly_fee)} × ${c.period_months}개월 · 선결제 · VAT 포함)
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:8px 0;"><tr><td style="border-radius:8px;background:#0066CC;">
      <a href="${url}" style="display:inline-block;padding:13px 26px;color:#fff;font-weight:700;text-decoration:none;border-radius:8px;">계약서 확인 및 서명하기 &rarr;</a>
    </td></tr></table>
    <p style="font-size:12px;color:#6B7280;">버튼이 열리지 않으면: ${url}</p>`;
  return sendGmail({
    to: c.party_a_email,
    subject: `[폴라애드] 온라인마케팅 대행 계약서 (${c.contract_number})`,
    html: shell("전자계약서 서명 요청", inner),
  });
}

export async function sendContractConfirmedEmail(
  c: Contract,
  finalDoc?: { filename: string; content: Buffer; contentType: string },
): Promise<string> {
  if (!c.party_a_email) throw new Error("광고주 이메일이 없습니다");
  const inner = `
    <p>안녕하세요, <b>${escapeHtml(c.party_a_name)}</b> 담당자님.</p>
    <p>요청하신 계약이 <b>최종 확정</b>되었습니다. 함께 진행하게 되어 감사합니다.</p>
    <p style="margin:16px 0;padding:12px 16px;background:#ECFDF5;border-left:4px solid #10B981;border-radius:4px;">
      계약번호 <b>${escapeHtml(c.contract_number)}</b><br>
      ${c.project_name ? `대상 사업: ${escapeHtml(c.project_name)}<br>` : ""}
      금액: <b>${won(c.total_fee)}</b> (선결제 · VAT 포함)
    </p>
    ${finalDoc ? "<p>최종 계약서(날인본)를 첨부합니다.</p>" : ""}
    <p style="font-size:13px;color:#374151;">결제 및 진행 일정은 담당자가 별도 안내드립니다.</p>`;
  return sendGmail({
    to: c.party_a_email,
    subject: `[폴라애드] 계약확정 안내 (${c.contract_number})`,
    html: shell("계약이 확정되었습니다", inner),
    attachments: finalDoc ? [finalDoc] : undefined,
  });
}
