-- 0017_contracts.sql
-- 계약 전자서명 시스템 (C형: 화면 본인확인+동의 → 법인인감 날인본·인감증명서 업로드 → 관리자 승인)
--
-- 을(폴라애드, 개인사업자)은 발송본에 직인+디지털 간인 미리 적용.
-- 갑(고객 법인)은 토큰 URL에서 동의 후 [법인인감 날인 계약서 + 법인인감증명서] 업로드.
-- 상태: DRAFT → SENT → SUBMITTED → APPROVED / REJECTED (CANCELLED)

CREATE TABLE IF NOT EXISTS contracts (
  id                      TEXT    PRIMARY KEY,
  contract_number         TEXT    NOT NULL DEFAULT '',   -- 사람이 읽는 계약번호 (예: PA-2026-0001)
  token                   TEXT    NOT NULL DEFAULT '',   -- 공개 서명 링크용 추측불가 토큰
  status                  TEXT    NOT NULL DEFAULT 'DRAFT',

  -- 갑(고객) 당사자 정보
  party_a_name            TEXT    NOT NULL DEFAULT '',   -- 상호(법인명)
  party_a_ceo             TEXT    NOT NULL DEFAULT '',   -- 대표자
  party_a_bizno           TEXT    NOT NULL DEFAULT '',   -- 사업자등록번호
  party_a_corpno          TEXT    NOT NULL DEFAULT '',   -- 법인등록번호 (법인만)
  party_a_addr            TEXT    NOT NULL DEFAULT '',   -- 소재지
  party_a_phone           TEXT    NOT NULL DEFAULT '',
  party_a_email           TEXT    NOT NULL DEFAULT '',

  -- 계약 내용
  project_name            TEXT    NOT NULL DEFAULT '',   -- 대상 사업
  plan_label              TEXT    NOT NULL DEFAULT '스탠다드 플랜',
  monthly_fee             INTEGER NOT NULL DEFAULT 0,    -- 월 대행료(VAT 포함, 원)
  period_months           INTEGER NOT NULL DEFAULT 0,
  total_fee               INTEGER NOT NULL DEFAULT 0,     -- 선결제 청구금액(월×개월)
  payment_method          TEXT    NOT NULL DEFAULT '지정계좌이체 또는 온라인결제',
  special_terms           TEXT    NOT NULL DEFAULT '[]',  -- 특약사항 JSON 배열

  -- 발송본 무결성(디지털 간인)
  doc_hash                TEXT    NOT NULL DEFAULT '',   -- 발송 PDF SHA-256
  sent_pdf_key            TEXT    NOT NULL DEFAULT '',   -- R2 key (을 직인 발송본)
  sent_at                 TEXT,

  -- 수신확인 (광고주 링크 첫 열람)
  opened_at               TEXT,
  opened_ip               TEXT    NOT NULL DEFAULT '',

  -- 갑 동의/본인확인 기록
  consent_agreed          INTEGER NOT NULL DEFAULT 0,
  consent_name            TEXT    NOT NULL DEFAULT '',   -- 서명자 성명
  consent_title           TEXT    NOT NULL DEFAULT '',   -- 서명자 직위
  otp_verified            INTEGER NOT NULL DEFAULT 0,
  signed_ip               TEXT    NOT NULL DEFAULT '',   -- x-vercel-forwarded-for 우선
  signed_ua               TEXT    NOT NULL DEFAULT '',
  signed_at               TEXT,

  -- 갑 업로드 (R2 key)
  uploaded_contract_key   TEXT    NOT NULL DEFAULT '',   -- 법인인감 날인 계약서 스캔
  uploaded_seal_cert_key  TEXT    NOT NULL DEFAULT '',   -- 법인인감증명서

  -- 관리자 처리
  approved_at             TEXT,
  approved_by             TEXT    NOT NULL DEFAULT '',
  reject_reason           TEXT    NOT NULL DEFAULT '',
  final_pdf_key           TEXT    NOT NULL DEFAULT '',   -- 최종 결합본

  token_expires_at        TEXT,
  created_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at              TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_number ON contracts(contract_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_token  ON contracts(token);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_created ON contracts(created_at DESC);

-- 상태전이/행위 감사로그
CREATE TABLE IF NOT EXISTS contract_logs (
  id            TEXT    PRIMARY KEY,
  contract_id   TEXT    NOT NULL,
  from_status   TEXT    NOT NULL DEFAULT '',
  to_status     TEXT    NOT NULL DEFAULT '',
  actor         TEXT    NOT NULL DEFAULT '',  -- 'admin' | 'client' | 'system'
  note          TEXT    NOT NULL DEFAULT '',
  ip            TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_contract_logs_cid ON contract_logs(contract_id, created_at);
