#!/usr/bin/env node
/**
 * 계약완료(status='Done') 문의 → 거래처 일괄 백필 스크립트
 *
 * 목적:
 *   handleContractConfirm 흐름이 거래처 INSERT를 누락했던 시기에 처리된
 *   "계약완료" 문의들을 거래처관리에 일괄 등록.
 *
 * 사용법:
 *   node scripts/backfill-clients-from-inquiries.mjs           # dry-run (기본)
 *   node scripts/backfill-clients-from-inquiries.mjs --execute # 실제 INSERT
 *
 * 환경변수 (.env.local 자동 로드):
 *   D1_PROXY_URL, D1_PROXY_TOKEN
 *
 * 동작:
 *   1. lead/meta_lead에서 status='Done' 전체 조회
 *   2. clients.inquiry_id 목록 조회 (이미 등록된 건)
 *   3. 미등록 문의만 필터 → INSERT INTO clients (status='Waiting')
 *   4. inquiry_id 매핑은 inquiries API 흐름과 동일:
 *      - 홈페이지: lead.id 그대로
 *      - Meta:    'meta_' + meta_lead.id
 *   5. 업종: 홈페이지는 [위저드] 메시지에서 파싱, Meta는 industry 컬럼
 *   6. contract_amount=0 (1회성 매출은 revenue 테이블에 별도 기록되어 있음)
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = dirname(__dirname);

// ── .env.local 로드 ──────────────────────────────────────────
function loadEnv() {
  const envPath = join(projectRoot, ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnv();

const D1_URL = process.env.D1_PROXY_URL;
const D1_TOKEN = process.env.D1_PROXY_TOKEN;
const argv = process.argv.slice(2);
const execute = argv.includes("--execute");

if (!D1_URL || !D1_TOKEN) {
  console.error("✗ D1_PROXY_URL / D1_PROXY_TOKEN 누락");
  process.exit(1);
}

// ── D1 헬퍼 ──────────────────────────────────────────────────
async function d1Query(sql, params = []) {
  const res = await fetch(`${D1_URL}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${D1_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params, mode: "all" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(`D1 query 실패 (HTTP ${res.status}): ${data.error ?? "unknown"}`);
  }
  return data.result?.results ?? [];
}

async function d1First(sql, params = []) {
  const res = await fetch(`${D1_URL}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${D1_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params, mode: "first" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(`D1 first 실패 (HTTP ${res.status}): ${data.error ?? "unknown"}`);
  }
  return data.result ?? null;
}

async function d1Batch(queries) {
  if (queries.length === 0) return;
  for (let i = 0; i < queries.length; i += 50) {
    const chunk = queries.slice(i, i + 50);
    const res = await fetch(`${D1_URL}/batch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${D1_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ queries: chunk }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(`D1 batch 실패 (HTTP ${res.status}): ${data.error ?? "unknown"}`);
    }
  }
}

// ── ID 생성 (lib/d1-client.ts:newId 동일 로직) ──────────────
const ID_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function newId(prefix = "rec") {
  const bytes = crypto.randomBytes(14);
  let out = prefix;
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

// ── parseWizardMessage (page.tsx:150 동일 로직) ─────────────
function parseWizardMessage(message) {
  if (!message?.startsWith("[위저드]")) return null;
  try {
    const body = message.replace("[위저드] ", "");
    const [fieldsPart] = body.split(" → ");
    const fields = fieldsPart.split(" / ");
    const data = {};
    for (const field of fields) {
      const [key, value] = field.split(": ");
      if (key && value) data[key.trim()] = value.trim();
    }
    return data["업종"] || "";
  } catch {
    return "";
  }
}

// ── formatMetaPhone (api/inquiries/route.ts:19 동일 로직) ───
function formatMetaPhone(phone) {
  if (!phone) return "";
  if (phone.startsWith("+82")) {
    const local = "0" + phone.slice(3);
    if (local.length === 11) {
      return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`;
    }
    return local;
  }
  return phone;
}

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
  const mode = execute ? "EXECUTE" : "DRY-RUN";
  console.log(`\n🔧 거래처 백필 스크립트 [${mode}]\n`);

  // 1. 계약완료 문의 조회
  const [leads, metaLeads] = await Promise.all([
    d1Query(
      `SELECT id, name, company, email, phone, message
       FROM lead WHERE status = 'Done'`,
    ),
    d1Query(
      `SELECT id, name, company, phone, industry
       FROM meta_lead WHERE status = 'Done'`,
    ),
  ]);

  // 2. 이미 등록된 거래처의 inquiry_id 집합
  const existingClients = await d1Query(
    `SELECT inquiry_id FROM clients WHERE inquiry_id != ''`,
  );
  const registeredIds = new Set(existingClients.map((c) => c.inquiry_id));

  console.log(`📊 현황:`);
  console.log(`   • 홈페이지 계약완료: ${leads.length}건`);
  console.log(`   • Meta 계약완료:    ${metaLeads.length}건`);
  console.log(`   • 이미 등록된 거래처: ${registeredIds.size}건\n`);

  // 3. 미등록 문의만 필터링
  const missingLeads = leads.filter((l) => !registeredIds.has(l.id));
  const missingMetas = metaLeads.filter(
    (m) => !registeredIds.has(`meta_${m.id}`),
  );
  const totalMissing = missingLeads.length + missingMetas.length;

  console.log(`🎯 백필 대상:`);
  console.log(`   • 홈페이지: ${missingLeads.length}건`);
  console.log(`   • Meta:    ${missingMetas.length}건`);
  console.log(`   • 합계:    ${totalMissing}건\n`);

  if (totalMissing === 0) {
    console.log("✓ 모든 계약완료 문의가 이미 거래처에 등록되어 있습니다.");
    return;
  }

  // 4. INSERT 쿼리 빌드
  const queries = [];
  const preview = [];
  const now = nowIso();

  for (const l of missingLeads) {
    const industry = parseWizardMessage(l.message);
    const id = newId();
    preview.push({
      type: "홈페이지",
      inquiryId: l.id,
      company: l.company || "",
      name: l.name || "",
      phone: l.phone || "",
      industry: industry || "(없음)",
    });
    queries.push({
      sql: `INSERT INTO clients
              (id, company, contact_name, phone, email, industry,
               contract_amount, inquiry_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        id,
        l.company || "",
        l.name || "",
        l.phone || "",
        l.email || "",
        industry || "",
        0,
        l.id,
        "Waiting",
        now,
        now,
      ],
    });
  }

  for (const m of missingMetas) {
    const id = newId();
    preview.push({
      type: "Meta",
      inquiryId: `meta_${m.id}`,
      company: m.company || "",
      name: m.name || "",
      phone: formatMetaPhone(m.phone),
      industry: m.industry || "(없음)",
    });
    queries.push({
      sql: `INSERT INTO clients
              (id, company, contact_name, phone, email, industry,
               contract_amount, inquiry_id, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        id,
        m.company || "",
        m.name || "",
        formatMetaPhone(m.phone),
        "",
        m.industry || "",
        0,
        `meta_${m.id}`,
        "Waiting",
        now,
        now,
      ],
    });
  }

  // 5. 미리보기 출력 (최대 20건)
  console.log("📋 미리보기 (최대 20건):\n");
  console.log(
    "  " +
      ["#", "타입", "회사명", "이름", "연락처", "업종"]
        .map((h, i) =>
          h.padEnd([3, 6, 20, 10, 14, 16][i], " "),
        )
        .join(" "),
  );
  console.log("  " + "─".repeat(75));
  preview.slice(0, 20).forEach((p, i) => {
    const row = [
      String(i + 1).padEnd(3),
      p.type.padEnd(6),
      (p.company || "(빈값)").slice(0, 20).padEnd(20),
      (p.name || "-").slice(0, 10).padEnd(10),
      (p.phone || "-").slice(0, 14).padEnd(14),
      (p.industry || "-").slice(0, 16).padEnd(16),
    ].join(" ");
    console.log("  " + row);
  });
  if (preview.length > 20) {
    console.log(`  … 외 ${preview.length - 20}건\n`);
  } else {
    console.log("");
  }

  // 6. 실행
  if (!execute) {
    console.log("⚠️  DRY-RUN 모드. 실제 INSERT는 실행되지 않았습니다.");
    console.log("   실행하려면: node scripts/backfill-clients-from-inquiries.mjs --execute\n");
    return;
  }

  console.log(`⏳ ${queries.length}건 INSERT 실행 중...`);
  await d1Batch(queries);

  // 검증
  const after = await d1First(`SELECT COUNT(*) as cnt FROM clients`);
  console.log(`\n✅ 완료. 거래처 총 ${after?.cnt ?? "?"}건\n`);
}

main().catch((e) => {
  console.error("\n✗ 오류:", e.message);
  process.exit(1);
});
