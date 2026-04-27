#!/usr/bin/env node
/**
 * Airtable → D1 데이터 마이그레이션 스크립트
 *
 * 사용법:
 *   node scripts/migrate-airtable-to-d1.mjs <target> [--dry-run] [--limit N]
 *
 * target:
 *   all              모든 테이블
 *   business         lead, meta_lead, revenue, clients, proposals, ad_spend, blacklist, brand_reports
 *   analytics        daily_analytics, traffic_sources, top_pages, devices, countries,
 *                    hourly_traffic, bot_visits, bot_daily_stats, google_ads_daily, cache_metadata
 *   content          content
 *   <table-name>     특정 테이블 한 개 (예: lead, blacklist 등)
 *
 * 환경변수 (.env.local에서 자동 로드):
 *   AIRTABLE_API_TOKEN
 *   BRAND_REPORT_BASE_ID, BRAND_REPORT_TABLE_ID
 *   D1_PROXY_URL, D1_PROXY_TOKEN
 *
 * 안전장치:
 *   * --dry-run: D1에 쓰지 않고 변환된 row 샘플만 출력
 *   * 각 테이블 마이그레이션 전 D1 카운트 확인 (이미 데이터 있으면 경고)
 *   * upsert (INSERT OR REPLACE)로 멱등성 보장
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

const AT_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BRAND_BASE = process.env.BRAND_REPORT_BASE_ID || "appSGHxitRzYPE43H";
const BRAND_TABLE = process.env.BRAND_REPORT_TABLE_ID || "tbl5UXUD58DZir4cG";
const D1_URL = process.env.D1_PROXY_URL;
const D1_TOKEN = process.env.D1_PROXY_TOKEN;

const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith("--")) || "all";
const dryRun = argv.includes("--dry-run");
const limitArg = argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

if (!AT_TOKEN) {
  console.error("✗ AIRTABLE_API_TOKEN 누락");
  process.exit(1);
}
if (!dryRun && (!D1_URL || !D1_TOKEN)) {
  console.error("✗ D1_PROXY_URL / D1_PROXY_TOKEN 누락 (--dry-run 으로 시험만 가능)");
  process.exit(1);
}

// ── Airtable 페이지네이션 fetch ─────────────────────────────
async function fetchAllRecords(baseId, tableId, opts = {}) {
  const all = [];
  let offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${baseId}/${tableId}`);
    url.searchParams.set("pageSize", "100");
    if (opts.returnFieldsByFieldId) {
      url.searchParams.set("returnFieldsByFieldId", "true");
    }
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AT_TOKEN}` },
    });
    if (!res.ok) {
      throw new Error(
        `Airtable ${baseId}/${tableId} 조회 실패: ${res.status} ${await res.text()}`,
      );
    }
    const data = await res.json();
    all.push(...(data.records || []));
    if (all.length >= LIMIT) break;
    offset = data.offset;
    if (offset) await new Promise((r) => setTimeout(r, 220)); // 5 req/s
  } while (offset);
  return all.slice(0, LIMIT);
}

// ── D1 batch insert ─────────────────────────────────────────
async function d1Batch(queries) {
  if (dryRun) {
    console.log(
      `   [dry-run] D1 batch 스킵 (${queries.length}개 쿼리). 첫 SQL: ${queries[0]?.sql.slice(0, 100)}...`,
    );
    return;
  }
  // 100개씩 분할
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
      throw new Error(
        `D1 batch 실패 (HTTP ${res.status}): ${data.error ?? "unknown"}`,
      );
    }
  }
}

async function d1Count(table) {
  if (dryRun) return -1;
  const res = await fetch(`${D1_URL}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${D1_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sql: `SELECT COUNT(*) as cnt FROM ${table}`,
      mode: "first",
    }),
  });
  const data = await res.json();
  return data?.result?.cnt ?? 0;
}

// ── 헬퍼 ────────────────────────────────────────────────────
const str = (v) => (v == null ? "" : String(v));
const num = (v) => (v == null || v === "" ? 0 : Number(v) || 0);
const numOrNull = (v) => (v == null || v === "" ? null : Number(v));
const bool = (v) => (v ? 1 : 0);
const json = (v) =>
  v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);

function buildInsert(table, row) {
  const cols = Object.keys(row);
  const placeholders = cols.map(() => "?").join(", ");
  return {
    sql: `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    params: cols.map((c) => row[c]),
  };
}

// ─────────────────────────────────────────────────────────────
// 1. lead — 홈페이지 리드
// ─────────────────────────────────────────────────────────────
async function migrateLead() {
  console.log("\n── 1/19  lead (홈페이지 리드)");
  const FIELD = {
    no: "fld7CbcVauaT7IDx9",
    name: "fldUN2yE6ZQ7Va0k3",
    company: "fldeCS89KPgXt5WA1",
    email: "fldPKhfjjbymNWwTK",
    phone: "fldB52uB94H0jDEwb",
    message: "fld18al2hhL8tpIVB",
    privacy: "fldqQsavvM1NXrXQ2",
    memo: "fldkndO9W3b5Zz7Q5",
    status: "fldizxBavcuneSV7D",
    contractAmount: "fldTGFqEK8dS6WnOs",
  };
  const records = await fetchAllRecords("appSGHxitRzYPE43H", "Lead", {
    returnFieldsByFieldId: true,
  });
  console.log(`   Airtable: ${records.length}건`);
  const rows = records.map((r, idx) => ({
    id: r.id,
    no: num(r.fields[FIELD.no]) || idx + 1,
    name: str(r.fields[FIELD.name]),
    company: str(r.fields[FIELD.company]),
    email: str(r.fields[FIELD.email]),
    phone: str(r.fields[FIELD.phone]),
    message: str(r.fields[FIELD.message]),
    privacy: bool(r.fields[FIELD.privacy]),
    memo: str(r.fields[FIELD.memo]),
    status: str(r.fields[FIELD.status]) || "Todo",
    contract_amount: num(r.fields[FIELD.contractAmount]),
    created_at: r.createdTime,
    updated_at: r.createdTime,
  }));
  await d1Batch(rows.map((row) => buildInsert("lead", row)));
  console.log(`   ✓ lead → D1 ${rows.length}건`);
}

// ─────────────────────────────────────────────────────────────
// 2. meta_lead — Meta 광고 리드
// ─────────────────────────────────────────────────────────────
async function migrateMetaLead() {
  console.log("\n── 2/19  meta_lead (Meta 광고 리드)");
  const records = await fetchAllRecords(
    "appyUK6euzEJ5yrGX",
    "tblxTgGtVkLpniFbb",
  );
  console.log(`   Airtable: ${records.length}건`);
  const rows = records.map((r) => ({
    id: r.id,
    name: str(r.fields.Name),
    phone: str(r.fields.phone),
    company: str(r.fields.company),
    industry: str(r.fields.industry),
    ad_name: str(r.fields.Adname),
    status: str(r.fields.Status) || "Todo",
    memo: str(r.fields.memo),
    sms_status: str(r.fields.smsStatus),
    sms_sent_at: str(r.fields.smsSentAt),
    sms_error: str(r.fields.smsError),
    sms_reply: bool(r.fields.smsReply),
    contract_amount: num(r.fields.contractAmount),
    created_at: r.createdTime,
    updated_at: r.createdTime,
  }));
  await d1Batch(rows.map((row) => buildInsert("meta_lead", row)));
  console.log(`   ✓ meta_lead → D1 ${rows.length}건`);
}

// ─────────────────────────────────────────────────────────────
// 3. revenue
// ─────────────────────────────────────────────────────────────
async function migrateRevenue() {
  console.log("\n── 3/19  revenue (매출)");
  // 필드 ID: amount=fldTKcF6XkcbHwpXH, date=fldZqGnvLCbBDKNSp, inquiryId=fldDJA4liQLbkiKHF
  const FIELD_ID = {
    amount: "fldTKcF6XkcbHwpXH",
    date: "fldZqGnvLCbBDKNSp",
    inquiryId: "fldDJA4liQLbkiKHF",
  };
  const records = await fetchAllRecords(
    "appSGHxitRzYPE43H",
    "tblah736yhUWmW40E",
    { returnFieldsByFieldId: true },
  );
  console.log(`   Airtable: ${records.length}건`);
  const rows = records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      inquiry_id: str(f[FIELD_ID.inquiryId]),
      client_id: "", // Airtable 측에 별도 필드 없음 → 빈값으로 마이그
      client_name: "", // 동일
      type: "",
      product_name: "",
      amount: num(f[FIELD_ID.amount]),
      date: str(f[FIELD_ID.date]),
      memo: "",
      created_at: r.createdTime,
      updated_at: r.createdTime,
    };
  });
  await d1Batch(rows.map((row) => buildInsert("revenue", row)));
  console.log(`   ✓ revenue → D1 ${rows.length}건`);
  console.log(
    "   ⚠ client_name/type/product_name 등은 필드명 확인 후 추가 매핑 필요 (1차 마이그는 amount/date만)",
  );
}

// ─────────────────────────────────────────────────────────────
// 4. clients — 거래처 (필드명 추후 검증 필요)
// ─────────────────────────────────────────────────────────────
async function migrateClients() {
  console.log("\n── 4/19  clients (거래처)");
  const records = await fetchAllRecords(
    "appSGHxitRzYPE43H",
    "tblU7SxW9gPYZe3go",
  );
  console.log(`   Airtable: ${records.length}건`);
  const rows = records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      company: str(f.company || f.Company || f["회사명"]),
      contact_name: str(f.contactName || f["담당자"]),
      phone: str(f.phone || f["연락처"]),
      email: str(f.email || f["이메일"]),
      industry: str(f.industry || f["업종"]),
      website: str(f.website),
      address: str(f.address || f["주소"]),
      business_number: str(f.businessNumber || f["사업자번호"]),
      contract_amount: num(f.contractAmount),
      contract_start: str(f.contractStart),
      contract_end: str(f.contractEnd),
      status: str(f.status) || "Active",
      memo: str(f.memo),
      inquiry_id: str(f.inquiryId),
      created_at: r.createdTime,
      updated_at: r.createdTime,
    };
  });
  await d1Batch(rows.map((row) => buildInsert("clients", row)));
  console.log(`   ✓ clients → D1 ${rows.length}건`);
}

// ─────────────────────────────────────────────────────────────
// 5. proposals
// ─────────────────────────────────────────────────────────────
async function migrateProposals() {
  console.log("\n── 5/19  proposals (제안서)");
  const records = await fetchAllRecords("appSGHxitRzYPE43H", "Proposals");
  console.log(`   Airtable: ${records.length}건`);
  const rows = records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      slug: str(f.slug) || r.id,
      title: str(f.title),
      subtitle: str(f.subtitle),
      client_name: str(f.clientName || f["고객사"]),
      amount: num(f.amount),
      products: json(f.products),
      date: str(f.date),
      status: str(f.status) || "public",
      views: num(f.views),
      theme_color: str(f.themeColor),
      password: str(f.password),
      created_at: r.createdTime,
      updated_at: r.createdTime,
    };
  });
  await d1Batch(rows.map((row) => buildInsert("proposals", row)));
  console.log(`   ✓ proposals → D1 ${rows.length}건`);
}

// ─────────────────────────────────────────────────────────────
// 6. ad_spend
// ─────────────────────────────────────────────────────────────
async function migrateAdSpend() {
  console.log("\n── 6/19  ad_spend (월별 광고비)");
  const FIELD_ID = {
    metaAmount: "fldRbfo5ibHeLYPUz",
    googleAmount: "fldAfCZ2QKhSVWcBW",
  };
  const records = await fetchAllRecords(
    "appSGHxitRzYPE43H",
    "tblmk9oQZQty3rrOx",
    { returnFieldsByFieldId: true },
  );
  console.log(`   Airtable: ${records.length}건`);
  const rows = records.map((r) => {
    const f = r.fields;
    // month 필드 ID 모름 → 일반 fetch 후 아래에서 처리. 일단 createdTime 기반 fallback.
    const monthRaw =
      Object.values(f).find(
        (v) => typeof v === "string" && /^\d{4}-\d{2}/.test(v),
      ) || r.createdTime.slice(0, 7);
    return {
      id: r.id,
      month: String(monthRaw).slice(0, 7),
      meta_amount: num(f[FIELD_ID.metaAmount]),
      google_amount: num(f[FIELD_ID.googleAmount]),
      memo: "",
      created_at: r.createdTime,
      updated_at: r.createdTime,
    };
  });
  await d1Batch(rows.map((row) => buildInsert("ad_spend", row)));
  console.log(`   ✓ ad_spend → D1 ${rows.length}건`);
}

// ─────────────────────────────────────────────────────────────
// 7. blacklist
// ─────────────────────────────────────────────────────────────
async function migrateBlacklist() {
  console.log("\n── 7/19  blacklist");
  const FIELD = {
    phone: "fldXZHeiHMDnqA5WC",
    name: "fldmwVNLLiHS3DyIT",
    reason: "fldZ9DODQ8azKop3A",
    source: "fldWUTcNOzZz9ydiL",
  };
  const records = await fetchAllRecords(
    "appSGHxitRzYPE43H",
    "tblOl9VRiiHDMxdUd",
    { returnFieldsByFieldId: true },
  );
  console.log(`   Airtable: ${records.length}건`);
  const rows = records.map((r) => ({
    id: r.id,
    phone: str(r.fields[FIELD.phone]).replace(/\D/g, ""),
    name: str(r.fields[FIELD.name]),
    reason: str(r.fields[FIELD.reason]),
    source: str(r.fields[FIELD.source]) || "수동",
    created_at: r.createdTime,
  }));
  await d1Batch(rows.map((row) => buildInsert("blacklist", row)));
  console.log(`   ✓ blacklist → D1 ${rows.length}건`);
}

// ─────────────────────────────────────────────────────────────
// 8. brand_reports
// ─────────────────────────────────────────────────────────────
async function migrateBrandReports() {
  console.log("\n── 8/19  brand_reports");
  const records = await fetchAllRecords(BRAND_BASE, BRAND_TABLE);
  console.log(`   Airtable: ${records.length}건`);
  const rows = records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      business_name: str(f.businessName),
      industry: str(f.industry),
      contact_name: str(f.contactName),
      contact_phone: str(f.contactPhone),
      contact_email: str(f.contactEmail),
      inquiry_id: str(f.inquiryId),
      inquiry_source: str(f.inquirySource),
      naver_search_data: json(f.naverSearchData),
      google_search_data: json(f.googleSearchData),
      ai_search_data: json(f.aiSearchData),
      naver_score: numOrNull(f.naverScore),
      google_score: numOrNull(f.googleScore),
      overall_score: numOrNull(f.overallScore),
      report_content: str(f.reportContent),
      report_html: str(f.reportHTML),
      summary: str(f.summary),
      status: str(f.status) || "pending",
      sent_at: f.sentAt || null,
      pdf_url: f.pdfUrl || null,
      inquiry_date: f.inquiryDate || null,
      analysis_type: f.analysisType || null,
      email_opened_at: f.emailOpenedAt || null,
      created_at: r.createdTime,
      updated_at: r.createdTime,
    };
  });
  await d1Batch(rows.map((row) => buildInsert("brand_reports", row)));
  console.log(`   ✓ brand_reports → D1 ${rows.length}건`);
}

// ─────────────────────────────────────────────────────────────
// 9. content (뉴스레터)
// ─────────────────────────────────────────────────────────────
async function migrateContent() {
  console.log("\n── 9/19  content (뉴스레터)");
  const records = await fetchAllRecords("appbqw2GAixv7vSBV", "뉴스레터");
  console.log(`   Airtable: ${records.length}건`);
  const rows = records.map((r) => {
    const f = r.fields;
    return {
      id: r.id,
      date: str(f.date),
      title: str(f.title),
      category: str(f.category),
      content: str(f.content),
      tags: json(f.tags),
      seo_keywords: str(f.seoKeywords),
      published_at: f.publishedAt || null,
      status: str(f.status) || "draft",
      slug: str(f.slug) || r.id,
      description: str(f.description),
      thumbnail_url: str(f.thumbnailUrl),
      views: num(f.views),
      instagram_posted: bool(f.instagram_posted),
      created_at: r.createdTime,
      updated_at: r.createdTime,
    };
  });
  await d1Batch(rows.map((row) => buildInsert("content", row)));
  console.log(`   ✓ content → D1 ${rows.length}건`);
}

// ─────────────────────────────────────────────────────────────
// 10-19. 분석 캐시 (단순 패턴 — 필드명 그대로)
// ─────────────────────────────────────────────────────────────
const ANALYTICS_BASE = "appZGz8IyauViqyCl";

async function migrateDailyAnalytics() {
  console.log("\n── 10/19 daily_analytics");
  const records = await fetchAllRecords(ANALYTICS_BASE, "daily_analytics");
  const rows = records.map((r) => ({
    date: str(r.fields.date),
    visitors: num(r.fields.visitors),
    pageviews: num(r.fields.pageviews),
    sessions: num(r.fields.sessions),
    new_users: num(r.fields.newUsers),
    bounce_rate: num(r.fields.bounceRate),
    avg_duration: num(r.fields.avgDuration),
    collected_at:
      r.fields.collected_at || r.createdTime || new Date().toISOString(),
  }));
  await d1Batch(rows.map((row) => buildInsert("daily_analytics", row)));
  console.log(`   ✓ daily_analytics → D1 ${rows.length}건`);
}

async function migrateTrafficSources() {
  console.log("\n── 11/19 traffic_sources");
  const records = await fetchAllRecords(ANALYTICS_BASE, "traffic_sources");
  const rows = records.map((r) => ({
    date: str(r.fields.date),
    channel: str(r.fields.channel),
    visitors: num(r.fields.visitors),
    sessions: num(r.fields.sessions),
    percentage: num(r.fields.percentage),
    bounce_rate: num(r.fields.bounceRate),
    avg_duration: num(r.fields.avgDuration),
  }));
  await d1Batch(rows.map((row) => buildInsert("traffic_sources", row)));
  console.log(`   ✓ traffic_sources → D1 ${rows.length}건`);
}

async function migrateTopPages() {
  console.log("\n── 12/19 top_pages");
  const records = await fetchAllRecords(ANALYTICS_BASE, "top_pages");
  const rows = records.map((r) => ({
    date: str(r.fields.date),
    path: str(r.fields.path),
    title: str(r.fields.title),
    views: num(r.fields.views),
    unique_views: num(r.fields.uniqueViews),
    avg_time: str(r.fields.avgTime) || "0:00",
    bounce_rate: num(r.fields.bounceRate),
  }));
  await d1Batch(rows.map((row) => buildInsert("top_pages", row)));
  console.log(`   ✓ top_pages → D1 ${rows.length}건`);
}

async function migrateDevices() {
  console.log("\n── 13/19 devices");
  const records = await fetchAllRecords(ANALYTICS_BASE, "devices");
  const rows = records.map((r) => ({
    date: str(r.fields.date),
    device: str(r.fields.device),
    visitors: num(r.fields.visitors),
    percentage: num(r.fields.percentage),
  }));
  await d1Batch(rows.map((row) => buildInsert("devices", row)));
  console.log(`   ✓ devices → D1 ${rows.length}건`);
}

async function migrateCountries() {
  console.log("\n── 14/19 countries");
  const records = await fetchAllRecords(ANALYTICS_BASE, "countries");
  const rows = records.map((r) => ({
    date: str(r.fields.date),
    country: str(r.fields.country),
    visitors: num(r.fields.visitors),
    percentage: num(r.fields.percentage),
  }));
  await d1Batch(rows.map((row) => buildInsert("countries", row)));
  console.log(`   ✓ countries → D1 ${rows.length}건`);
}

async function migrateHourlyTraffic() {
  console.log("\n── 15/19 hourly_traffic");
  const records = await fetchAllRecords(ANALYTICS_BASE, "hourly_traffic");
  const rows = records.map((r) => ({
    date: str(r.fields.date),
    hour: str(r.fields.hour),
    visitors: num(r.fields.visitors),
  }));
  await d1Batch(rows.map((row) => buildInsert("hourly_traffic", row)));
  console.log(`   ✓ hourly_traffic → D1 ${rows.length}건`);
}

async function migrateBotVisits() {
  console.log("\n── 16/19 bot_visits");
  const records = await fetchAllRecords(ANALYTICS_BASE, "bot_visits");
  const rows = records.map((r) => ({
    timestamp: str(r.fields.timestamp),
    date: str(r.fields.date),
    bot_name: str(r.fields.botName),
    category: str(r.fields.category),
    path: str(r.fields.path),
    ip: str(r.fields.ip),
  }));
  // bot_visits는 PK가 autoincrement → INSERT (REPLACE 안 씀)
  const queries = rows.map((row) => {
    const cols = Object.keys(row);
    return {
      sql: `INSERT INTO bot_visits (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      params: cols.map((c) => row[c]),
    };
  });
  await d1Batch(queries);
  console.log(`   ✓ bot_visits → D1 ${rows.length}건`);
}

async function migrateBotDailyStats() {
  console.log("\n── 17/19 bot_daily_stats");
  const records = await fetchAllRecords(ANALYTICS_BASE, "bot_daily_stats");
  const rows = records.map((r) => ({
    date: str(r.fields.date),
    total_visits: num(r.fields.total_visits),
    bot_visits: num(r.fields.bot_visits),
    human_visits: num(r.fields.human_visits),
    bot_percentage: num(r.fields.bot_percentage),
    categories: str(r.fields.categories) || "{}",
    top_bots: str(r.fields.top_bots) || "{}",
  }));
  await d1Batch(rows.map((row) => buildInsert("bot_daily_stats", row)));
  console.log(`   ✓ bot_daily_stats → D1 ${rows.length}건`);
}

async function migrateGoogleAdsDaily() {
  console.log("\n── 18/19 google_ads_daily");
  const records = await fetchAllRecords(ANALYTICS_BASE, "google_ads_daily");
  const rows = records.map((r) => {
    const f = r.fields;
    return {
      date: str(f.date),
      visitors: num(f.visitors),
      sessions: num(f.sessions),
      pageviews: num(f.pageviews),
      conversions: num(f.conversions),
      bounce_rate: num(f.bounceRate),
      avg_duration: num(f.avgDuration),
      cvr: num(f.cvr),
      total_visitors: num(f.total_visitors),
      total_sessions: num(f.total_sessions),
      total_conversions: num(f.total_conversions),
      visitor_contribution: num(f.visitor_contribution),
      session_contribution: num(f.session_contribution),
      conversion_contribution: num(f.conversion_contribution),
      ads_cost: numOrNull(f.ads_cost),
      ads_clicks: numOrNull(f.ads_clicks),
      ads_impressions: numOrNull(f.ads_impressions),
      cpc: numOrNull(f.cpc),
      cpa: numOrNull(f.cpa),
      campaigns_json: str(f.campaigns_json) || "[]",
      collected_at: f.collected_at || r.createdTime,
    };
  });
  await d1Batch(rows.map((row) => buildInsert("google_ads_daily", row)));
  console.log(`   ✓ google_ads_daily → D1 ${rows.length}건`);
}

async function migrateCacheMetadata() {
  console.log("\n── 19/19 cache_metadata");
  const records = await fetchAllRecords(ANALYTICS_BASE, "cache_metadata");
  const rows = records.map((r) => ({
    cache_key: str(r.fields.cache_key),
    last_updated: str(r.fields.last_updated),
    status: str(r.fields.status) || "pending",
    record_count: num(r.fields.record_count),
    error_message: str(r.fields.error_message),
  }));
  await d1Batch(rows.map((row) => buildInsert("cache_metadata", row)));
  console.log(`   ✓ cache_metadata → D1 ${rows.length}건`);
}

// ─────────────────────────────────────────────────────────────
// Orchestration
// ─────────────────────────────────────────────────────────────
const TABLES = {
  lead: migrateLead,
  meta_lead: migrateMetaLead,
  revenue: migrateRevenue,
  clients: migrateClients,
  proposals: migrateProposals,
  ad_spend: migrateAdSpend,
  blacklist: migrateBlacklist,
  brand_reports: migrateBrandReports,
  content: migrateContent,
  daily_analytics: migrateDailyAnalytics,
  traffic_sources: migrateTrafficSources,
  top_pages: migrateTopPages,
  devices: migrateDevices,
  countries: migrateCountries,
  hourly_traffic: migrateHourlyTraffic,
  bot_visits: migrateBotVisits,
  bot_daily_stats: migrateBotDailyStats,
  google_ads_daily: migrateGoogleAdsDaily,
  cache_metadata: migrateCacheMetadata,
};

const GROUPS = {
  business: [
    "lead",
    "meta_lead",
    "revenue",
    "clients",
    "proposals",
    "ad_spend",
    "blacklist",
    "brand_reports",
  ],
  content: ["content"],
  analytics: [
    "daily_analytics",
    "traffic_sources",
    "top_pages",
    "devices",
    "countries",
    "hourly_traffic",
    "bot_visits",
    "bot_daily_stats",
    "google_ads_daily",
    "cache_metadata",
  ],
  all: Object.keys(TABLES),
};

async function main() {
  const startedAt = Date.now();
  const list = GROUPS[target] ?? (TABLES[target] ? [target] : null);
  if (!list) {
    console.error(`✗ 알 수 없는 target: ${target}`);
    console.error(`   사용 가능: ${[...Object.keys(GROUPS), ...Object.keys(TABLES)].join(", ")}`);
    process.exit(1);
  }

  console.log("┌─────────────────────────────────────────────");
  console.log(`│ Airtable → D1 마이그레이션`);
  console.log(`│ 대상: ${target} (${list.length}개 테이블)`);
  console.log(`│ Mode: ${dryRun ? "DRY-RUN (D1 쓰기 안 함)" : "LIVE"}`);
  console.log(`│ Limit per table: ${LIMIT === Infinity ? "전체" : LIMIT}`);
  console.log("└─────────────────────────────────────────────");

  for (const tbl of list) {
    try {
      // 안전장치: 기존 데이터 카운트
      if (!dryRun) {
        const existing = await d1Count(tbl).catch(() => 0);
        if (existing > 0) {
          console.log(
            `\n⚠ ${tbl}: D1에 이미 ${existing}건 존재 — INSERT OR REPLACE로 진행`,
          );
        }
      }
      await TABLES[tbl]();
    } catch (err) {
      console.error(`\n✗ ${tbl} 실패:`, err.message);
      process.exit(1);
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n✓ 완료 (${elapsed}s)`);
}

main();
