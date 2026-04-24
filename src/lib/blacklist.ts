// 블랙리스트 조회/관리 유틸
// 전화번호 정규화 + Airtable Blacklist 테이블 조회 (메모리 캐시 5분)

const AIRTABLE_API_TOKEN = process.env.AIRTABLE_API_TOKEN;
const BLACKLIST_BASE_ID = "appSGHxitRzYPE43H";
const BLACKLIST_TABLE_ID = "tblOl9VRiiHDMxdUd";

export const BLACKLIST_FIELD = {
  phone: "fldXZHeiHMDnqA5WC",
  name: "fldmwVNLLiHS3DyIT",
  reason: "fldZ9DODQ8azKop3A",
  source: "fldWUTcNOzZz9ydiL",
} as const;

export interface BlacklistEntry {
  id: string;
  phone: string;
  name: string;
  reason: string;
  source: string;
  createdAt: string;
}

/**
 * 전화번호 정규화 — 비교용 키
 * 010-1234-5678, 01012345678, +821012345678 → 01012345678
 */
export function normalizePhone(raw: string): string {
  if (!raw) return "";
  let cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+82")) cleaned = "0" + cleaned.slice(3);
  if (cleaned.startsWith("82") && cleaned.length === 12)
    cleaned = "0" + cleaned.slice(2);
  return cleaned.replace(/\D/g, "");
}

// ── 메모리 캐시 (5분 TTL) ─────────────────────
let cache: { data: Set<string>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateBlacklistCache(): void {
  cache = null;
}

async function fetchBlacklistSet(): Promise<Set<string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  if (!AIRTABLE_API_TOKEN) return new Set();

  const phones = new Set<string>();
  let offset: string | undefined;
  do {
    const url = new URL(
      `https://api.airtable.com/v0/${BLACKLIST_BASE_ID}/${BLACKLIST_TABLE_ID}`,
    );
    url.searchParams.set("returnFieldsByFieldId", "true");
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[blacklist] 조회 실패:", await res.text());
      break;
    }
    const data = await res.json();
    for (const r of data.records || []) {
      const phone = String(r.fields?.[BLACKLIST_FIELD.phone] ?? "");
      if (phone) phones.add(normalizePhone(phone));
    }
    offset = data.offset;
  } while (offset);

  cache = { data: phones, expiresAt: Date.now() + CACHE_TTL_MS };
  return phones;
}

export async function isBlacklisted(phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const set = await fetchBlacklistSet();
  return set.has(normalized);
}

export async function listBlacklist(): Promise<BlacklistEntry[]> {
  if (!AIRTABLE_API_TOKEN) return [];
  const entries: BlacklistEntry[] = [];
  let offset: string | undefined;
  do {
    const url = new URL(
      `https://api.airtable.com/v0/${BLACKLIST_BASE_ID}/${BLACKLIST_TABLE_ID}`,
    );
    url.searchParams.set("returnFieldsByFieldId", "true");
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) break;
    const data = await res.json();
    for (const r of data.records || []) {
      const f = r.fields ?? {};
      entries.push({
        id: r.id,
        phone: String(f[BLACKLIST_FIELD.phone] ?? ""),
        name: String(f[BLACKLIST_FIELD.name] ?? ""),
        reason: String(f[BLACKLIST_FIELD.reason] ?? ""),
        source: String(f[BLACKLIST_FIELD.source] ?? ""),
        createdAt: r.createdTime,
      });
    }
    offset = data.offset;
  } while (offset);
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries;
}

export async function addToBlacklist(input: {
  phone: string;
  name?: string;
  reason?: string;
  source?: "홈페이지" | "Meta" | "수동";
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  if (!AIRTABLE_API_TOKEN) return { ok: false, error: "Airtable 토큰 누락" };
  const normalized = normalizePhone(input.phone);
  if (!normalized) return { ok: false, error: "전화번호 형식 오류" };

  // 중복 방지
  const set = await fetchBlacklistSet();
  if (set.has(normalized))
    return { ok: false, error: "이미 등록된 번호입니다" };

  const res = await fetch(
    `https://api.airtable.com/v0/${BLACKLIST_BASE_ID}/${BLACKLIST_TABLE_ID}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          phone: normalized,
          name: input.name ?? "",
          reason: input.reason ?? "",
          source: input.source ?? "수동",
        },
        typecast: true,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 300) };
  }
  const data = await res.json();
  invalidateBlacklistCache();
  return { ok: true, id: data.id };
}

export async function removeFromBlacklist(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!AIRTABLE_API_TOKEN) return { ok: false, error: "Airtable 토큰 누락" };
  const res = await fetch(
    `https://api.airtable.com/v0/${BLACKLIST_BASE_ID}/${BLACKLIST_TABLE_ID}/${id}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${AIRTABLE_API_TOKEN}` },
    },
  );
  if (!res.ok) {
    const err = await res.text();
    return { ok: false, error: err.slice(0, 300) };
  }
  invalidateBlacklistCache();
  return { ok: true };
}
