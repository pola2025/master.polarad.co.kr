/**
 * Shared Airtable utility for brand reports.
 * Single source of truth for field names, CRUD helpers, and types.
 */

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BASE_ID = process.env.BRAND_REPORT_BASE_ID;
const TABLE_ID = process.env.BRAND_REPORT_TABLE_ID;

// ---------------------------------------------------------------------------
// Field name constants — SINGLE SOURCE OF TRUTH
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
// Types
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
// Internal helpers
// ---------------------------------------------------------------------------
function getHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
}

function tableUrl(recordId?: string): string {
  const base = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`;
  return recordId ? `${base}/${recordId}` : base;
}

function assertConfig(): void {
  if (!AIRTABLE_API_TOKEN || !BASE_ID || !TABLE_ID) {
    throw new Error("Airtable 환경변수가 설정되지 않았습니다.");
  }
}

// ---------------------------------------------------------------------------
// CRUD helpers
// ---------------------------------------------------------------------------

/** Create a new record. Returns the Airtable record id. */
export async function createRecord(
  fields: Record<string, unknown>,
): Promise<string> {
  assertConfig();

  const res = await fetch(tableUrl(), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ typecast: true, fields }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("[airtable] createRecord 실패:", err);
    throw new Error("Airtable 레코드 생성에 실패했습니다.");
  }

  const data = await res.json();
  return data.id as string;
}

/** Update an existing record. Throws on failure. */
export async function updateRecord(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  assertConfig();

  const res = await fetch(tableUrl(id), {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ typecast: true, fields }),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("[airtable] updateRecord 실패:", err);
    throw new Error("Airtable 레코드 업데이트에 실패했습니다.");
  }
}

/** Fetch a single record. Throws on not-found or other errors. */
export async function getRecord(id: string): Promise<AirtableRecord> {
  assertConfig();

  const res = await fetch(tableUrl(id), {
    headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
    cache: "no-store",
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new NotFoundError("리포트를 찾을 수 없습니다.");
    }
    const err = await res.json();
    console.error("[airtable] getRecord 실패:", err);
    throw new Error("Airtable 레코드 조회에 실패했습니다.");
  }

  return res.json();
}

/** List records with optional sort/filter. Auto-paginates through all pages. */
export async function listRecords(
  options: ListOptions = {},
): Promise<AirtableRecord[]> {
  assertConfig();

  const {
    maxRecords = 100,
    sortField = "createdTime",
    sortDirection = "desc",
    filterByFormula,
  } = options;

  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(tableUrl());
    url.searchParams.set("pageSize", "100");
    if (sortField && sortField !== "createdTime") {
      url.searchParams.set("sort[0][field]", sortField);
      url.searchParams.set("sort[0][direction]", sortDirection);
    }
    if (filterByFormula) {
      url.searchParams.set("filterByFormula", filterByFormula);
    }
    if (offset) {
      url.searchParams.set("offset", offset);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("[airtable] listRecords 실패:", err);
      throw new Error("Airtable 레코드 목록 조회에 실패했습니다.");
    }

    const data = await res.json();
    allRecords.push(...((data.records ?? []) as AirtableRecord[]));
    offset = data.offset as string | undefined;
    if (allRecords.length >= maxRecords) break;
  } while (offset);

  return allRecords.slice(0, maxRecords);
}

/**
 * Soft delete: sets status to "discarded".
 * Does NOT call Airtable DELETE — preserves audit trail.
 */
export async function deleteRecord(id: string): Promise<void> {
  await updateRecord(id, { [FIELDS.status]: "discarded" });
}

/** Normalize a raw Airtable record into a BrandReport. */
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
