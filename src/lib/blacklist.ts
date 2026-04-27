// 블랙리스트 조회/관리 유틸 (D1 기반, 2026-04-27 마이그레이션)
// 시그니처는 기존 Airtable 시절과 동일.

import { d1All, d1First, d1Run, newId, nowIso } from "@/lib/d1-client";

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

// ── 메모리 캐시 (5분 TTL) — 폼 제출 hot path ───────────────────
let cache: { data: Set<string>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export function invalidateBlacklistCache(): void {
  cache = null;
}

async function fetchBlacklistSet(): Promise<Set<string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;
  try {
    const rows = await d1All<{ phone: string }>("SELECT phone FROM blacklist");
    const set = new Set<string>();
    for (const r of rows) {
      const p = normalizePhone(r.phone);
      if (p) set.add(p);
    }
    cache = { data: set, expiresAt: Date.now() + CACHE_TTL_MS };
    return set;
  } catch (error) {
    console.error("[blacklist] 조회 실패:", error);
    return new Set();
  }
}

export async function isBlacklisted(phone: string): Promise<boolean> {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  const set = await fetchBlacklistSet();
  return set.has(normalized);
}

export async function listBlacklist(): Promise<BlacklistEntry[]> {
  try {
    const rows = await d1All<{
      id: string;
      phone: string;
      name: string;
      reason: string;
      source: string;
      created_at: string;
    }>(
      "SELECT id, phone, name, reason, source, created_at FROM blacklist ORDER BY created_at DESC",
    );
    return rows.map((r) => ({
      id: r.id,
      phone: r.phone,
      name: r.name,
      reason: r.reason,
      source: r.source,
      createdAt: r.created_at,
    }));
  } catch (error) {
    console.error("[blacklist] list 실패:", error);
    return [];
  }
}

export async function addToBlacklist(input: {
  phone: string;
  name?: string;
  reason?: string;
  source?: "홈페이지" | "Meta" | "수동";
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const normalized = normalizePhone(input.phone);
  if (!normalized) return { ok: false, error: "전화번호 형식 오류" };

  // 중복 방지
  const existing = await d1First<{ id: string }>(
    "SELECT id FROM blacklist WHERE phone = ?",
    [normalized],
  );
  if (existing) return { ok: false, error: "이미 등록된 번호입니다" };

  const id = newId();
  try {
    await d1Run(
      "INSERT INTO blacklist (id, phone, name, reason, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [
        id,
        normalized,
        input.name ?? "",
        input.reason ?? "",
        input.source ?? "수동",
        nowIso(),
      ],
    );
    invalidateBlacklistCache();
    return { ok: true, id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 300) : "DB 오류",
    };
  }
}

export async function removeFromBlacklist(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const result = await d1Run("DELETE FROM blacklist WHERE id = ?", [id]);
    if (!result.meta?.changes) {
      return { ok: false, error: "해당 항목을 찾을 수 없습니다" };
    }
    invalidateBlacklistCache();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 300) : "DB 오류",
    };
  }
}
