// Airtable Blacklist 테이블 자동 생성
// 사용법: node scripts/create-blacklist-table.mjs
import { readFileSync } from "fs";

const envFile = readFileSync("./.env.local", "utf8");
const TOKEN = envFile.match(/AIRTABLE_API_TOKEN="?([^"\n]+)"?/)?.[1];
const BASE_ID = "appSGHxitRzYPE43H";

if (!TOKEN) {
  console.error("AIRTABLE_API_TOKEN 누락");
  process.exit(1);
}

const tableSchema = {
  name: "Blacklist",
  description: "차단된 전화번호 목록 — 홈페이지/Meta 접수 시 메일·SMS 발송 차단, 텔레그램만 알림",
  fields: [
    { name: "phone", type: "singleLineText", description: "정규화된 전화번호 (010xxxxxxxx)" },
    { name: "name", type: "singleLineText", description: "고객명 (참고용)" },
    { name: "reason", type: "multilineText", description: "차단 사유" },
    {
      name: "source",
      type: "singleSelect",
      options: {
        choices: [
          { name: "홈페이지", color: "blueLight2" },
          { name: "Meta", color: "purpleLight2" },
          { name: "수동", color: "grayLight2" },
        ],
      },
    },
  ],
};

const res = await fetch(
  `https://api.airtable.com/v0/meta/bases/${BASE_ID}/tables`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tableSchema),
  }
);

const data = await res.json();
if (res.ok) {
  console.log("✅ Blacklist 테이블 생성 완료");
  console.log("Table ID:", data.id);
  console.log("Fields:");
  for (const f of data.fields) {
    console.log(`  - ${f.name} (${f.id}): ${f.type}`);
  }
} else {
  console.error("❌ 생성 실패:", JSON.stringify(data, null, 2));
  process.exit(1);
}
