// 신의경영연구소 2건 1페이지 + 서명란 스크린샷 (시각 검증)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { buildContractHtml } from "../src/lib/contracts/contract-html.mjs";

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(path.resolve(HERE, ".."), "docs", "contracts");

const COMMON = {
  partyAName: "주식회사 신의경영연구소",
  partyABizName: "주식회사 신의경영연구소",
  partyACeo: "장국진",
  partyABizNo: "253-86-03508",
  partyACorpNo: "110111-9057913",
  partyAAddr: "서울특별시 마포구 와우산로 105, 5층-제이7호(서교동)",
  monthlyFee: 220000,
  specialTerms: [
    "본 계약은 주식회사 신의경영연구소의 2건(자수성가 사옥연구소·정부지원사업 마케팅) 동시 계약 진행을 조건으로 하며, 이를 조건으로 구글(Google) 추가 매체 운영비 월 110,000원(VAT 포함)을 계약 기간 동안 면제한다.",
  ],
};
const LIST = [
  { ...COMMON, projectName: "자수성가 사옥연구소", periodMonths: 6, tag: "jasu" },
  { ...COMMON, projectName: "정부지원사업 마케팅", periodMonths: 4, tag: "gov" },
];

const { chromium } = require(
  "C:/Users/flame/AppData/Roaming/npm/node_modules/playwright",
);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 820, height: 1160 } });
fs.mkdirSync(OUT, { recursive: true });
for (const c of LIST) {
  await page.setContent(buildContractHtml(c), { waitUntil: "networkidle" });
  const mains = await page.$$("main.a4");
  await mains[0].screenshot({ path: path.join(OUT, `prev-${c.tag}-p1.png`) });
  if (mains[1])
    await mains[1].screenshot({ path: path.join(OUT, `prev-${c.tag}-p2.png`) });
  await mains[mains.length - 1].screenshot({
    path: path.join(OUT, `prev-${c.tag}-sign.png`),
  });
}
await browser.close();
console.log("OK");
