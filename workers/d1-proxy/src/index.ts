/**
 * Polarad D1 Proxy Worker
 *
 * Next.js (Vercel) ↔ Cloudflare D1 사이의 RPC-스타일 게이트웨이.
 *
 * 엔드포인트:
 *   POST /query  — 단일 SQL 실행 ({sql, params, mode})
 *   POST /batch  — 트랜잭셔널 batch ({queries: [{sql, params}]})
 *   GET  /health — 헬스체크
 *
 * 보안:
 *   1. Authorization: Bearer ${INTERNAL_TOKEN} (timing-safe 비교)
 *   2. Content-Type: application/json 검증 (415)
 *   3. JSON 파싱 try-catch (400)
 *   4. SQL은 prepared statements + params binding (SQL injection 방지는 호출자 책임,
 *      raw SQL 인터폴레이션 금지)
 *   5. 5xx 에러 시 텔레그램 알림 ([master/d1] + IP + error.message.slice(0,200))
 */

export interface Env {
  DB: D1Database;
  INTERNAL_TOKEN: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

type QueryMode = "all" | "first" | "run";

interface QueryBody {
  sql: string;
  params?: unknown[];
  mode?: QueryMode;
}

interface BatchBody {
  queries: { sql: string; params?: unknown[] }[];
}

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

function json(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init?.headers ?? {}) },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function notifyTelegram(env: Env, message: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML",
        }),
      },
    );
  } catch {
    /* swallow — alerting failure must not break the request */
  }
}

function authorize(request: Request, env: Env): boolean {
  const header = request.headers.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice("Bearer ".length).trim();
  if (!token || !env.INTERNAL_TOKEN) return false;
  return timingSafeEqual(token, env.INTERNAL_TOKEN);
}

async function handleQuery(
  request: Request,
  env: Env,
  ip: string,
): Promise<Response> {
  let body: QueryBody;
  try {
    body = (await request.json()) as QueryBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { sql, params = [], mode = "all" } = body;
  if (typeof sql !== "string" || !sql.trim()) {
    return json({ ok: false, error: "sql required" }, { status: 400 });
  }

  try {
    const stmt = env.DB.prepare(sql).bind(...(params as unknown[]));
    let result: unknown;
    if (mode === "first") result = await stmt.first();
    else if (mode === "run") result = await stmt.run();
    else result = await stmt.all();
    return json({ ok: true, result });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown D1 error";
    await notifyTelegram(
      env,
      `[master/d1] query 실패\nIP: ${ip}\nSQL: ${sql.slice(0, 120)}\nError: ${errorMessage.slice(0, 200)}`,
    );
    return json(
      { ok: false, error: errorMessage.slice(0, 300) },
      { status: 500 },
    );
  }
}

async function handleBatch(
  request: Request,
  env: Env,
  ip: string,
): Promise<Response> {
  let body: BatchBody;
  try {
    body = (await request.json()) as BatchBody;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.queries) || body.queries.length === 0) {
    return json(
      { ok: false, error: "queries required (non-empty array)" },
      { status: 400 },
    );
  }
  if (body.queries.length > 100) {
    return json({ ok: false, error: "batch size > 100" }, { status: 400 });
  }

  try {
    const stmts = body.queries.map((q) =>
      env.DB.prepare(q.sql).bind(...((q.params ?? []) as unknown[])),
    );
    const results = await env.DB.batch(stmts);
    return json({ ok: true, results });
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : "Unknown D1 error";
    await notifyTelegram(
      env,
      `[master/d1] batch 실패\nIP: ${ip}\nSize: ${body.queries.length}\nError: ${errorMessage.slice(0, 200)}`,
    );
    return json(
      { ok: false, error: errorMessage.slice(0, 300) },
      { status: 500 },
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const ip = getClientIp(request);

    // Health check (no auth)
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, ts: new Date().toISOString() });
    }

    // 인증
    if (!authorize(request, env)) {
      return json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    // POST 전용
    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, { status: 405 });
    }

    // Content-Type 검증
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json(
        { ok: false, error: "Content-Type must be application/json" },
        { status: 415 },
      );
    }

    if (url.pathname === "/query") return handleQuery(request, env, ip);
    if (url.pathname === "/batch") return handleBatch(request, env, ip);

    return json({ ok: false, error: "Not found" }, { status: 404 });
  },
};
