/**
 * Brand Reports — D1 기반 CRUD (2026-04-27 마이그레이션)
 *
 * 파일명은 호환성을 위해 그대로 유지 (`airtable.ts`).
 * 함수 시그니처도 기존과 동일하지만 내부는 Cloudflare D1 (Worker proxy).
 * D1 row → AirtableRecord-like 객체로 변환해 normalizeRecord 호환 유지.
 */

import { d1All, d1First, d1Run, newId, nowIso } from "@/lib/d1-client";

// ---------------------------------------------------------------------------
// Field name constants — SINGLE SOURCE OF TRUTH (camelCase 호환 유지)
// ---------------------------------------------------------------------------
export const FIELDS = {
  businessName: "businessName",
  industry: "industry",
  contactName: "contactName",
  contactPhone: "contactPhone",
  contactEmail: "contactEmail",
  inquiryId: "inquiryId",
  inquirySource: "inquirySource",
  naverSearchData: "naverSearchData",
  googleSearchData: "googleSearchData",
  aiSearchData: "aiSearchData",
  naverScore: "naverScore",
  googleScore: "googleScore",
  overallScore: "overallScore",
  reportContent: "reportContent",
  reportHTML: "reportHTML",
  summary: "summary",
  status: "status",
  sentAt: "sentAt",
  pdfUrl: "pdfUrl",
  inquiryDate: "inquiryDate",
  emailOpenedAt: "emailOpenedAt",
} as const;

// ---------------------------------------------------------------------------
// Types (외부 인터페이스 동일)
// ---------------------------------------------------------------------------
export interface BrandReport {
  id: string;
  businessName: string;
  industry: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  inquiryId: string;
  inquirySource: string;
  naverSearchData: Record<string, unknown> | null;
  googleSearchData: Record<string, unknown> | null;
  aiSearchData: Record<string, unknown> | null;
  naverScore: number | null;
  googleScore: number | null;
  overallScore: number | null;
  reportContent: string;
  reportHTML: string;
  summary: string;
  status: string;
  sentAt: string | null;
  pdfUrl: string | null;
  inquiryDate: string | null;
  analysisType: string | null;
  emailOpenedAt: string | null;
  createdAt: string;
}

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

interface ListOptions {
  maxRecords?: number;
  sortField?: string;
  sortDirection?: "asc" | "desc";
  filterByFormula?: string;
}

// ---------------------------------------------------------------------------
// camelCase ↔ snake_case 매핑
// ---------------------------------------------------------------------------
const CAMEL_TO_SNAKE: Record<string, string> = {
  businessName: "business_name",
  industry: "industry",
  contactName: "contact_name",
  contactPhone: "contact_phone",
  contactEmail: "contact_email",
  inquiryId: "inquiry_id",
  inquirySource: "inquiry_source",
  naverSearchData: "naver_search_data",
  googleSearchData: "google_search_data",
  aiSearchData: "ai_search_data",
  naverScore: "naver_score",
  googleScore: "google_score",
  overallScore: "overall_score",
  reportContent: "report_content",
  reportHTML: "report_html",
  summary: "summary",
  status: "status",
  sentAt: "sent_at",
  pdfUrl: "pdf_url",
  inquiryDate: "inquiry_date",
  emailOpenedAt: "email_opened_at",
  analysisType: "analysis_type",
};

const JSON_FIELDS = new Set([
  "naverSearchData",
  "googleSearchData",
  "aiSearchData",
]);

// 모든 SELECT 컬럼
const ALL_COLUMNS = `
  id, business_name, industry, contact_name, contact_phone, contact_email,
  inquiry_id, inquiry_source, naver_search_data, google_search_data, ai_search_data,
  naver_score, google_score, overall_score, report_content, report_html, summary,
  status, sent_at, pdf_url, inquiry_date, analysis_type, email_opened_at, created_at
`;

interface BrandReportRow {
  id: string;
  business_name: string;
  industry: string;
  contact_name: string;
  contact_phone: string;
  contact_email: string;
  inquiry_id: string;
  inquiry_source: string;
  naver_search_data: string;
  google_search_data: string;
  ai_search_data: string;
  naver_score: number | null;
  google_score: number | null;
  overall_score: number | null;
  report_content: string;
  report_html: string;
  summary: string;
  status: string;
  sent_at: string | null;
  pdf_url: string | null;
  inquiry_date: string | null;
  analysis_type: string | null;
  email_opened_at: string | null;
  created_at: string;
}

/** D1 row → AirtableRecord-like (normalizeRecord 호환) */
function rowToAirtableRecord(row: BrandReportRow): AirtableRecord {
  return {
    id: row.id,
    createdTime: row.created_at,
    fields: {
      businessName: row.business_name,
      industry: row.industry,
      contactName: row.contact_name,
      contactPhone: row.contact_phone,
      contactEmail: row.contact_email,
      inquiryId: row.inquiry_id,
      inquirySource: row.inquiry_source,
      naverSearchData: row.naver_search_data,
      googleSearchData: row.google_search_data,
      aiSearchData: row.ai_search_data,
      naverScore: row.naver_score,
      googleScore: row.google_score,
      overallScore: row.overall_score,
      reportContent: row.report_content,
      reportHTML: row.report_html,
      summary: row.summary,
      status: row.status,
      sentAt: row.sent_at,
      pdfUrl: row.pdf_url,
      inquiryDate: row.inquiry_date,
      analysisType: row.analysis_type,
      emailOpenedAt: row.email_opened_at,
    },
  };
}

/** Airtable-style fields → D1 컬럼/값 쌍 */
function fieldsToColumns(fields: Record<string, unknown>): {
  cols: string[];
  values: (string | number | null)[];
} {
  const cols: string[] = [];
  const values: (string | number | null)[] = [];
  for (const [key, value] of Object.entries(fields)) {
    const col = CAMEL_TO_SNAKE[key];
    if (!col) continue; // 알 수 없는 필드 무시
    cols.push(col);
    if (JSON_FIELDS.has(key)) {
      if (value == null) values.push("");
      else if (typeof value === "string") values.push(value);
      else values.push(JSON.stringify(value));
    } else if (value === undefined || value === null) {
      values.push(null);
    } else if (typeof value === "boolean") {
      values.push(value ? 1 : 0);
    } else if (typeof value === "object") {
      values.push(JSON.stringify(value));
    } else {
      values.push(value as string | number);
    }
  }
  return { cols, values };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Create a new record. Returns the new id (rec...). */
export async function createRecord(
  fields: Record<string, unknown>,
): Promise<string> {
  const id = newId();
  const now = nowIso();
  const { cols, values } = fieldsToColumns(fields);

  cols.push("created_at", "updated_at");
  values.push(now, now);
  const placeholders = cols.map(() => "?").join(", ");

  await d1Run(
    `INSERT INTO brand_reports (id, ${cols.join(", ")}) VALUES (?, ${placeholders})`,
    [id, ...values],
  );
  return id;
}

/** Update an existing record. Throws on failure. */
export async function updateRecord(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const { cols, values } = fieldsToColumns(fields);
  if (cols.length === 0) return;

  const sets = cols.map((c) => `${c} = ?`);
  sets.push("updated_at = ?");
  values.push(nowIso());

  const result = await d1Run(
    `UPDATE brand_reports SET ${sets.join(", ")} WHERE id = ?`,
    [...values, id],
  );
  if (!result.meta?.changes) {
    throw new Error("brand_report 업데이트 실패 (no rows changed)");
  }
}

/** Fetch a single record. Throws NotFoundError if missing. */
export async function getRecord(id: string): Promise<AirtableRecord> {
  const row = await d1First<BrandReportRow>(
    `SELECT ${ALL_COLUMNS} FROM brand_reports WHERE id = ?`,
    [id],
  );
  if (!row) throw new NotFoundError("리포트를 찾을 수 없습니다.");
  return rowToAirtableRecord(row);
}

/** List records. options.filterByFormula은 무시 (D1 마이그 후 미사용). */
export async function listRecords(
  options: ListOptions = {},
): Promise<AirtableRecord[]> {
  const { maxRecords = 100, sortField, sortDirection = "desc" } = options;
  const sortCol =
    sortField && CAMEL_TO_SNAKE[sortField]
      ? CAMEL_TO_SNAKE[sortField]
      : "created_at";
  const dir = sortDirection === "asc" ? "ASC" : "DESC";

  const rows = await d1All<BrandReportRow>(
    `SELECT ${ALL_COLUMNS} FROM brand_reports ORDER BY ${sortCol} ${dir} LIMIT ?`,
    [Math.max(1, Math.min(maxRecords, 1000))],
  );
  return rows.map(rowToAirtableRecord);
}

/** Hard delete. */
export async function deleteRecord(id: string): Promise<void> {
  const result = await d1Run("DELETE FROM brand_reports WHERE id = ?", [id]);
  if (!result.meta?.changes) {
    throw new NotFoundError("리포트를 찾을 수 없습니다.");
  }
}

/** Normalize a raw record into a BrandReport. (시그니처 동일) */
export function normalizeRecord(record: AirtableRecord): BrandReport {
  const f = record.fields;

  function parseJson(value: unknown): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    if (typeof value === "object") return value as Record<string, unknown>;
    return null;
  }

  function toNum(value: unknown): number | null {
    if (value === undefined || value === null) return null;
    const n = Number(value);
    return isNaN(n) ? null : n;
  }

  return {
    id: record.id,
    createdAt: record.createdTime,
    businessName: (f[FIELDS.businessName] as string) ?? "",
    industry: (f[FIELDS.industry] as string) ?? "",
    contactName: (f[FIELDS.contactName] as string) ?? "",
    contactPhone: (f[FIELDS.contactPhone] as string) ?? "",
    contactEmail: (f[FIELDS.contactEmail] as string) ?? "",
    inquiryId: (f[FIELDS.inquiryId] as string) ?? "",
    inquirySource: (f[FIELDS.inquirySource] as string) ?? "",
    naverSearchData: parseJson(f[FIELDS.naverSearchData]),
    googleSearchData: parseJson(f[FIELDS.googleSearchData]),
    aiSearchData: parseJson(f[FIELDS.aiSearchData]),
    naverScore: toNum(f[FIELDS.naverScore]),
    googleScore: toNum(f[FIELDS.googleScore]),
    overallScore: toNum(f[FIELDS.overallScore]),
    reportContent: (f[FIELDS.reportContent] as string) ?? "",
    reportHTML: (f[FIELDS.reportHTML] as string) ?? "",
    summary: (f[FIELDS.summary] as string) ?? "",
    status: (f[FIELDS.status] as string) ?? "",
    sentAt: (f[FIELDS.sentAt] as string) ?? null,
    pdfUrl: (f[FIELDS.pdfUrl] as string) ?? null,
    inquiryDate: (f[FIELDS.inquiryDate] as string) ?? null,
    analysisType: (f["analysisType"] as string) ?? null,
    emailOpenedAt: (f[FIELDS.emailOpenedAt] as string) ?? null,
  };
}

// ---------------------------------------------------------------------------
// Sentinel error type
// ---------------------------------------------------------------------------
export class NotFoundError extends Error {
  readonly isNotFound = true;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
