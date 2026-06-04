/**
 * D1 마이그레이션 적용 — 기존 d1-proxy(/query)로 DDL 실행.
 * CF 인증/ wrangler 불필요 (D1_PROXY_URL + D1_PROXY_TOKEN 사용).
 *
 * 사용: node scripts/apply-d1-migration.mjs workers/d1-proxy/migrations/0017_contracts.sql
 *       (인자 없으면 0017 기본)
 *
 * 모든 문장은 CREATE ... IF NOT EXISTS 라 멱등(재실행 안전).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

function loadEnv() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env))
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

function splitStatements(sql) {
  // 문자열 리터럴 안의 ';'는 없다고 가정(이 마이그엔 없음). 단순 분할.
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => {
      // 주석/공백만 있는 청크 제거
      const code = s
        .split("\n")
        .filter((l) => !l.trim().startsWith("--"))
        .join("\n")
        .trim();
      return code.length > 0;
    });
}

async function runStmt(url, token, sql) {
  const res = await fetch(`${url}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql, params: [], mode: "run" }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(
      `HTTP ${res.status}: ${data.error || JSON.stringify(data).slice(0, 200)}`,
    );
  }
  return data;
}

async function main() {
  loadEnv();
  const url = process.env.D1_PROXY_URL;
  const token = process.env.D1_PROXY_TOKEN;
  if (!url || !token) throw new Error("D1_PROXY_URL / D1_PROXY_TOKEN 누락");

  const file =
    process.argv[2] || "workers/d1-proxy/migrations/0017_contracts.sql";
  const sql = fs.readFileSync(path.join(ROOT, file), "utf-8");
  const stmts = splitStatements(sql);
  console.log(`적용: ${file} (${stmts.length}개 문장)`);

  let i = 0;
  for (const stmt of stmts) {
    i++;
    const label = stmt.split("\n").find((l) => l.trim() && !l.trim().startsWith("--"))?.trim().slice(0, 60) || stmt.slice(0, 60);
    try {
      await runStmt(url, token, stmt);
      console.log(`  [${i}/${stmts.length}] OK  ${label}`);
    } catch (e) {
      console.error(`  [${i}/${stmts.length}] FAIL ${label}\n     ${e.message}`);
      process.exit(1);
    }
  }
  console.log("✅ 마이그레이션 적용 완료");
}

main().catch((e) => {
  console.error("❌", e?.message || e);
  process.exit(1);
});
