/**
 * D1 Client — Cloudflare D1 Proxy Worker 호출 래퍼
 *
 * 환경변수:
 *   D1_PROXY_URL    — Worker 배포 URL (예: https://polarad-d1-proxy.<account>.workers.dev)
 *   D1_PROXY_TOKEN  — Worker INTERNAL_TOKEN과 동일값
 *
 * 사용법:
 *   const rows = await d1All<Lead>("SELECT * FROM lead WHERE status = ?", ["Done"]);
 *   const row  = await d1First<Lead>("SELECT * FROM lead WHERE id = ?", [id]);
 *   const meta = await d1Run("UPDATE lead SET memo = ? WHERE id = ?", [memo, id]);
 *   await d1Batch([
 *     { sql: "INSERT INTO ...", params: [...] },
 *     { sql: "UPDATE ...",       params: [...] },
 *   ]);
 *
 * 모든 함수는 prepared statements + 파라미터 바인딩 사용. SQL 인터폴레이션 금지.
 */

const D1_PROXY_URL = process.env.D1_PROXY_URL;
const D1_PROXY_TOKEN = process.env.D1_PROXY_TOKEN;

export type D1Param = string | number | boolean | null;

export interface D1RunMeta {
  changes: number;
  last_row_id: number;
  duration: number;
  rows_read: number;
  rows_written: number;
}

interface ProxyResponse<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

interface BatchResponse<T> {
  ok: boolean;
  results?: T[];
  error?: string;
}

function assertConfig(): void {
  if (!D1_PROXY_URL || !D1_PROXY_TOKEN) {
    throw new Error("D1 proxy 환경변수 누락: D1_PROXY_URL, D1_PROXY_TOKEN");
  }
}

const RETRY_DELAYS_MS = [100, 300];

function isTransientError(message: string, status: number): boolean {
  if (status >= 500) return true;
  const lower = message.toLowerCase();
  return (
    lower.includes("network connection lost") ||
    lower.includes("fetch failed") ||
    lower.includes("connection reset") ||
    lower.includes("connection closed") ||
    lower.includes("timeout") ||
    lower.includes("econnreset")
  );
}

async function callProxy<T>(
  path: "/query" | "/batch",
  body: unknown,
): Promise<T> {
  assertConfig();
  const payload = JSON.stringify(body);

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${D1_PROXY_URL}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${D1_PROXY_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: payload,
        cache: "no-store",
      });
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("D1 proxy fetch 실패");
      if (
        attempt < RETRY_DELAYS_MS.length &&
        isTransientError(lastError.message, 0)
      ) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw lastError;
    }

    let data: ProxyResponse<T> | BatchResponse<T>;
    try {
      data = await res.json();
    } catch {
      lastError = new Error(`D1 proxy 응답 파싱 실패: HTTP ${res.status}`);
      if (
        attempt < RETRY_DELAYS_MS.length &&
        isTransientError("", res.status)
      ) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw lastError;
    }

    if (!res.ok || !data.ok) {
      const errMsg = data.error ?? "unknown";
      lastError = new Error(`D1 proxy 오류 (HTTP ${res.status}): ${errMsg}`);
      if (
        attempt < RETRY_DELAYS_MS.length &&
        isTransientError(errMsg, res.status)
      ) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      throw lastError;
    }

    return data as T;
  }

  throw lastError ?? new Error("D1 proxy 호출 실패");
}

/** SELECT — 모든 행을 배열로 반환. */
export async function d1All<T = Record<string, unknown>>(
  sql: string,
  params: D1Param[] = [],
): Promise<T[]> {
  const data = await callProxy<ProxyResponse<{ results: T[] }>>("/query", {
    sql,
    params,
    mode: "all",
  });
  return data.result?.results ?? [];
}

/** SELECT — 첫 행 하나만. 없으면 null. */
export async function d1First<T = Record<string, unknown>>(
  sql: string,
  params: D1Param[] = [],
): Promise<T | null> {
  const data = await callProxy<ProxyResponse<T | null>>("/query", {
    sql,
    params,
    mode: "first",
  });
  return data.result ?? null;
}

/** INSERT/UPDATE/DELETE — 변경 메타정보 반환. */
export async function d1Run(
  sql: string,
  params: D1Param[] = [],
): Promise<{ success: boolean; meta: D1RunMeta }> {
  const data = await callProxy<
    ProxyResponse<{ success: boolean; meta: D1RunMeta }>
  >("/query", { sql, params, mode: "run" });
  return (
    data.result ?? {
      success: false,
      meta: {
        changes: 0,
        last_row_id: 0,
        duration: 0,
        rows_read: 0,
        rows_written: 0,
      },
    }
  );
}

/** 트랜잭셔널 batch — 모두 성공하거나 모두 롤백. */
export async function d1Batch(
  queries: { sql: string; params?: D1Param[] }[],
): Promise<{ success: boolean; meta: D1RunMeta }[]> {
  const data = await callProxy<
    BatchResponse<{ success: boolean; meta: D1RunMeta }>
  >("/batch", { queries });
  return data.results ?? [];
}

// ─────────────────────────────────────────────────────────────
// UUID 생성 (신규 레코드 PK용)
// Airtable rec ID 형식 호환 위해 'rec' + 14자 alphanumeric.
// crypto.randomUUID() 대신 짧은 ID 사용 (URL 친화적)
// ─────────────────────────────────────────────────────────────
const ID_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

export function newId(prefix = "rec"): string {
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let out = prefix;
  for (const b of bytes) out += ID_ALPHABET[b % ID_ALPHABET.length];
  return out;
}

// ─────────────────────────────────────────────────────────────
// 헬퍼: ISO datetime
// ─────────────────────────────────────────────────────────────
export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}
