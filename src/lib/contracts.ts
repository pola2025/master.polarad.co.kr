/**
 * 계약 전자서명 — D1 데이터 계층 (모델 C)
 *
 * 상태머신: DRAFT → SENT → SUBMITTED → APPROVED / REJECTED (CANCELLED)
 *   DRAFT     관리자가 생성(미발송)
 *   SENT      서명링크 발급/발송됨
 *   SUBMITTED 갑이 동의 + 날인본 업로드 (= 계약 체결 접수)
 *   APPROVED  관리자 최종 승인
 *   REJECTED  관리자 반려
 *
 * 폴라애드(을)는 개인사업자 → 발송본에 직인 미리 적용. 갑(법인)만 업로드 수집.
 */

import { d1All, d1First, d1Run, newId, nowIso } from "@/lib/d1-client";
import { createHash } from "crypto";

export type ContractStatus =
  | "DRAFT"
  | "SENT"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface Contract {
  id: string;
  contract_number: string;
  token: string;
  status: ContractStatus;
  party_a_name: string;
  party_a_ceo: string;
  party_a_bizno: string;
  party_a_corpno: string;
  party_a_addr: string;
  party_a_phone: string;
  party_a_email: string;
  project_name: string;
  plan_label: string;
  monthly_fee: number;
  period_months: number;
  total_fee: number;
  payment_method: string;
  special_terms: string; // JSON 배열 문자열
  doc_hash: string;
  sent_pdf_key: string;
  sent_at: string | null;
  opened_at: string | null;
  opened_ip: string;
  consent_agreed: number;
  consent_name: string;
  consent_title: string;
  otp_verified: number;
  signed_ip: string;
  signed_ua: string;
  signed_at: string | null;
  uploaded_contract_key: string;
  uploaded_seal_cert_key: string;
  approved_at: string | null;
  approved_by: string;
  reject_reason: string;
  final_pdf_key: string;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateContractInput {
  partyAName: string;
  partyACeo: string;
  partyABizno: string;
  partyACorpno?: string;
  partyAAddr: string;
  partyAPhone?: string;
  partyAEmail?: string;
  projectName?: string;
  planLabel?: string;
  paymentMethod?: string;
  specialTerms?: string[];
  monthlyFee: number;
  periodMonths: number;
}

/** 계약서 본문의 무결성 해시 — 디지털 간인/위변조 검증용. */
export function contractDocHash(
  c: Pick<
    Contract,
    | "contract_number"
    | "party_a_name"
    | "party_a_ceo"
    | "party_a_bizno"
    | "party_a_corpno"
    | "party_a_addr"
    | "project_name"
    | "monthly_fee"
    | "period_months"
    | "total_fee"
  >,
): string {
  const payload = [
    c.contract_number,
    c.party_a_name,
    c.party_a_ceo,
    c.party_a_bizno,
    c.party_a_corpno,
    c.party_a_addr,
    c.project_name,
    c.monthly_fee,
    c.period_months,
    c.total_fee,
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

function genContractNumber(): string {
  // PA-YYYY-XXXXXX (랜덤 접미사 → count 기반 race 회피)
  const year = new Date().getFullYear();
  const suffix = newId("").slice(0, 6).toUpperCase();
  return `PA-${year}-${suffix}`;
}

const SELECT = "SELECT * FROM contracts";

export async function getContract(id: string): Promise<Contract | null> {
  return d1First<Contract>(`${SELECT} WHERE id = ?`, [id]);
}

export async function getContractByToken(
  token: string,
): Promise<Contract | null> {
  if (!token) return null;
  return d1First<Contract>(`${SELECT} WHERE token = ?`, [token]);
}

export async function listContracts(
  status?: ContractStatus,
): Promise<Contract[]> {
  if (status) {
    return d1All<Contract>(
      `${SELECT} WHERE status = ? ORDER BY created_at DESC`,
      [status],
    );
  }
  return d1All<Contract>(`${SELECT} ORDER BY created_at DESC`);
}

export async function createContract(
  input: CreateContractInput,
): Promise<Contract> {
  const id = newId("ctr");
  // 토큰: 추측불가(28자) — 공개 서명 링크용
  const token = (newId("sgn") + newId("")).slice(0, 32);
  const total = input.monthlyFee * input.periodMonths;
  const number = genContractNumber();
  const now = nowIso();

  await d1Run(
    `INSERT INTO contracts
      (id, contract_number, token, status,
       party_a_name, party_a_ceo, party_a_bizno, party_a_corpno, party_a_addr, party_a_phone, party_a_email,
       project_name, plan_label, payment_method, special_terms, monthly_fee, period_months, total_fee,
       created_at, updated_at)
     VALUES (?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?)`,
    [
      id,
      number,
      token,
      "DRAFT",
      input.partyAName,
      input.partyACeo,
      input.partyABizno,
      input.partyACorpno || "",
      input.partyAAddr,
      input.partyAPhone || "",
      input.partyAEmail || "",
      input.projectName || "",
      input.planLabel || "스탠다드 플랜",
      input.paymentMethod || "지정계좌이체 또는 온라인결제",
      JSON.stringify(input.specialTerms || []),
      input.monthlyFee,
      input.periodMonths,
      total,
      now,
      now,
    ],
  );

  const created = await getContract(id);
  if (!created) throw new Error("계약 생성 실패");
  // 무결성 해시 기록
  const hash = contractDocHash(created);
  await d1Run(
    `UPDATE contracts SET doc_hash = ?, updated_at = ? WHERE id = ?`,
    [hash, nowIso(), id],
  );
  return { ...created, doc_hash: hash };
}

export async function logContract(entry: {
  contractId: string;
  fromStatus?: string;
  toStatus?: string;
  actor: "admin" | "client" | "system";
  note?: string;
  ip?: string;
}): Promise<void> {
  await d1Run(
    `INSERT INTO contract_logs (id, contract_id, from_status, to_status, actor, note, ip)
     VALUES (?,?,?,?,?,?,?)`,
    [
      newId("clg"),
      entry.contractId,
      entry.fromStatus || "",
      entry.toStatus || "",
      entry.actor,
      entry.note || "",
      entry.ip || "",
    ],
  );
}

/** 발송 처리(DRAFT/SENT → SENT). 멱등. */
export async function markSent(id: string): Promise<void> {
  await d1Run(
    `UPDATE contracts SET status = 'SENT', sent_at = COALESCE(sent_at, ?), updated_at = ?
     WHERE id = ? AND status IN ('DRAFT','SENT')`,
    [nowIso(), nowIso(), id],
  );
}

/** 수신확인 — 광고주가 서명링크를 처음 열람한 시점 기록(멱등: 최초 1회만). */
export async function markOpened(token: string, ip: string): Promise<void> {
  await d1Run(
    `UPDATE contracts SET opened_at = ?, opened_ip = ?, updated_at = ?
     WHERE token = ? AND opened_at IS NULL`,
    [nowIso(), ip, nowIso(), token],
  );
}

/**
 * 갑 동의 + 날인본 업로드 제출 (SENT → SUBMITTED).
 * update 조건에 status를 포함해 중복/경합 방지(감사 권고 반영).
 */
export async function submitSignedUpload(input: {
  token: string;
  consentName: string;
  consentTitle?: string;
  uploadedContractKey: string;
  uploadedSealCertKey?: string;
  ip: string;
  ua: string;
}): Promise<{ ok: boolean; reason?: string }> {
  const c = await getContractByToken(input.token);
  if (!c) return { ok: false, reason: "not_found" };
  if (c.status === "SUBMITTED" || c.status === "APPROVED") {
    return { ok: false, reason: "already_submitted" };
  }
  if (c.status !== "SENT" && c.status !== "DRAFT") {
    return { ok: false, reason: "invalid_state" };
  }
  const res = await d1Run(
    `UPDATE contracts SET
       status = 'SUBMITTED',
       consent_agreed = 1,
       consent_name = ?,
       consent_title = ?,
       uploaded_contract_key = ?,
       uploaded_seal_cert_key = ?,
       signed_ip = ?,
       signed_ua = ?,
       signed_at = ?,
       updated_at = ?
     WHERE token = ? AND status IN ('SENT','DRAFT')`,
    [
      input.consentName,
      input.consentTitle || "",
      input.uploadedContractKey,
      input.uploadedSealCertKey || "",
      input.ip,
      input.ua,
      nowIso(),
      nowIso(),
      input.token,
    ],
  );
  if (!res.meta.changes) return { ok: false, reason: "race" };
  await logContract({
    contractId: c.id,
    fromStatus: c.status,
    toStatus: "SUBMITTED",
    actor: "client",
    note: `동의+날인본 업로드 (${input.consentName})`,
    ip: input.ip,
  });
  return { ok: true };
}

/** 관리자 승인 (SUBMITTED → APPROVED). */
export async function approveContract(
  id: string,
  approvedBy: string,
  ip = "",
): Promise<boolean> {
  const res = await d1Run(
    `UPDATE contracts SET status = 'APPROVED', approved_at = ?, approved_by = ?, updated_at = ?
     WHERE id = ? AND status = 'SUBMITTED'`,
    [nowIso(), approvedBy, nowIso(), id],
  );
  if (res.meta.changes) {
    await logContract({
      contractId: id,
      fromStatus: "SUBMITTED",
      toStatus: "APPROVED",
      actor: "admin",
      note: approvedBy,
      ip,
    });
    return true;
  }
  return false;
}

/** 관리자 반려 (SUBMITTED → REJECTED). */
export async function rejectContract(
  id: string,
  reason: string,
  ip = "",
): Promise<boolean> {
  const res = await d1Run(
    `UPDATE contracts SET status = 'REJECTED', reject_reason = ?, updated_at = ?
     WHERE id = ? AND status = 'SUBMITTED'`,
    [reason.slice(0, 1000), nowIso(), id],
  );
  if (res.meta.changes) {
    await logContract({
      contractId: id,
      fromStatus: "SUBMITTED",
      toStatus: "REJECTED",
      actor: "admin",
      note: reason.slice(0, 200),
      ip,
    });
    return true;
  }
  return false;
}

/** Contract(D1 행) → contract-html.mjs 빌더 입력으로 변환. */
export function toBuilderData(c: Contract) {
  return {
    partyAName: c.party_a_name,
    partyABizName: c.party_a_name,
    partyACeo: c.party_a_ceo,
    partyABizNo: c.party_a_bizno,
    partyACorpNo: c.party_a_corpno,
    partyAAddr: c.party_a_addr,
    partyAPhone: c.party_a_phone,
    partyAEmail: c.party_a_email,
    monthlyFee: c.monthly_fee,
    periodMonths: c.period_months,
    planLabel: c.plan_label,
    projectName: c.project_name,
    paymentMethod: c.payment_method,
    specialTerms: parseSpecialTerms(c.special_terms),
  };
}

/** special_terms(JSON 문자열) → string[]. 파싱 실패 시 빈 배열. */
export function parseSpecialTerms(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
