/**
 * 폴라애드 SEO/AEO/GEO 감사 스크립트
 *
 * 실행:
 *   cd F:/master_polarad
 *   npx tsx --env-file=.env.local --env-file=.env.vercel-check scripts/seo-audit-polarad.ts
 *
 * 산출물:
 *   F:/polarad_frontend/docs/seo-audit-YYYY-MM-DD.html
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import {
  getSearchQueries,
  getPagePerformance,
  getCumulativeSearchQueries,
} from "@/lib/search-console";
import {
  getDailyMetrics,
  getTrafficSources,
  getTopPages,
  getDeviceCategories,
  getRegionData,
  getConversionGoalsData,
  getYesterdayOverview,
} from "@/lib/google-analytics";
import { analyzeBrand, getGrade } from "@/lib/brand-search";

// ─── 설정 ──────────────────────────────────────
const BUSINESS_NAME = "폴라애드";
const INDUSTRY = "광고대행사";
const OUTPUT_PATH = `F:/polarad_frontend/docs/seo-audit-${new Date().toISOString().slice(0, 10)}.html`;

// ─── 실행 ──────────────────────────────────────
type AuditResult = {
  date: string;
  gsc: {
    last7?: Awaited<ReturnType<typeof getSearchQueries>>;
    last28?: Awaited<ReturnType<typeof getSearchQueries>>;
    cumulative?: Awaited<ReturnType<typeof getCumulativeSearchQueries>>;
    pages28?: Awaited<ReturnType<typeof getPagePerformance>>;
    error?: string;
  };
  ga4: {
    daily?: Awaited<ReturnType<typeof getDailyMetrics>>;
    sources?: Awaited<ReturnType<typeof getTrafficSources>>;
    pages?: Awaited<ReturnType<typeof getTopPages>>;
    devices?: Awaited<ReturnType<typeof getDeviceCategories>>;
    regions?: Awaited<ReturnType<typeof getRegionData>>;
    conversions?: Awaited<ReturnType<typeof getConversionGoalsData>>;
    yesterday?: Awaited<ReturnType<typeof getYesterdayOverview>>;
    error?: string;
  };
  aeo: {
    brand?: Awaited<ReturnType<typeof analyzeBrand>>;
    error?: string;
  };
};

async function run(): Promise<AuditResult> {
  const result: AuditResult = {
    date: new Date().toISOString(),
    gsc: {},
    ga4: {},
    aeo: {},
  };

  // GSC: 병렬 호출
  console.log("[1/3] Google Search Console 조회 중...");
  const gscPromises = await Promise.allSettled([
    getSearchQueries(7).then((d) => ({
      ...d,
      queries: d.queries.slice(0, 30),
    })),
    (async () => {
      const d = await getSearchQueries(28);
      return { ...d, queries: d.queries.slice(0, 50) };
    })(),
    getCumulativeSearchQueries(50),
    getPagePerformance(28),
  ]);
  if (gscPromises[0].status === "fulfilled")
    result.gsc.last7 = gscPromises[0].value;
  if (gscPromises[1].status === "fulfilled")
    result.gsc.last28 = gscPromises[1].value;
  if (gscPromises[2].status === "fulfilled")
    result.gsc.cumulative = gscPromises[2].value;
  if (gscPromises[3].status === "fulfilled")
    result.gsc.pages28 = gscPromises[3].value;
  const gscFailed = gscPromises.filter((p) => p.status === "rejected");
  if (gscFailed.length > 0) {
    result.gsc.error =
      (gscFailed[0] as PromiseRejectedResult).reason?.message ||
      "GSC 호출 실패";
    console.warn("  ⚠ GSC 일부 실패:", result.gsc.error);
  } else {
    console.log("  ✓ GSC 조회 완료");
  }

  // GA4: 병렬 호출
  console.log("[2/3] Google Analytics 4 조회 중...");
  const ga4Promises = await Promise.allSettled([
    getDailyMetrics(28),
    getTrafficSources(),
    getTopPages(),
    getDeviceCategories(),
    getRegionData(28),
    getConversionGoalsData(),
    getYesterdayOverview(),
  ]);
  if (ga4Promises[0].status === "fulfilled")
    result.ga4.daily = ga4Promises[0].value;
  if (ga4Promises[1].status === "fulfilled")
    result.ga4.sources = ga4Promises[1].value;
  if (ga4Promises[2].status === "fulfilled")
    result.ga4.pages = ga4Promises[2].value;
  if (ga4Promises[3].status === "fulfilled")
    result.ga4.devices = ga4Promises[3].value;
  if (ga4Promises[4].status === "fulfilled")
    result.ga4.regions = ga4Promises[4].value;
  if (ga4Promises[5].status === "fulfilled")
    result.ga4.conversions = ga4Promises[5].value;
  if (ga4Promises[6].status === "fulfilled")
    result.ga4.yesterday = ga4Promises[6].value;
  const ga4Failed = ga4Promises.filter((p) => p.status === "rejected");
  if (ga4Failed.length > 0) {
    result.ga4.error =
      (ga4Failed[0] as PromiseRejectedResult).reason?.message ||
      "GA4 호출 실패";
    console.warn("  ⚠ GA4 일부 실패:", result.ga4.error);
  } else {
    console.log("  ✓ GA4 조회 완료");
  }

  // AEO 브랜드 분석
  console.log("[3/3] 브랜드 검색 + AI 인지도 분석 중...");
  try {
    result.aeo.brand = await analyzeBrand({
      businessName: BUSINESS_NAME,
      industry: INDUSTRY,
      analysisType: "auto",
    });
    console.log("  ✓ 브랜드 분석 완료");
  } catch (e) {
    result.aeo.error = e instanceof Error ? e.message : String(e);
    console.warn("  ⚠ 브랜드 분석 실패:", result.aeo.error);
  }

  return result;
}

// ─── HTML 렌더링 ──────────────────────────────────────
const fmtNum = (n: number) =>
  new Intl.NumberFormat("ko-KR").format(Math.round(n));
const fmtPct = (n: number) => `${n.toFixed(2)}%`;
const fmtPos = (n: number) => n.toFixed(1);
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function renderQueryTable(
  queries: Array<{
    query: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>,
  title: string,
) {
  if (queries.length === 0)
    return `<p class="text-slate-500">${title} — 데이터 없음</p>`;
  return `
    <h3 class="text-lg font-bold mt-6 mb-2">${esc(title)}</h3>
    <div class="overflow-x-auto">
    <table class="min-w-full text-sm">
      <thead class="bg-slate-100">
        <tr>
          <th class="px-3 py-2 text-left">#</th>
          <th class="px-3 py-2 text-left">검색어</th>
          <th class="px-3 py-2 text-right">클릭</th>
          <th class="px-3 py-2 text-right">노출</th>
          <th class="px-3 py-2 text-right">CTR</th>
          <th class="px-3 py-2 text-right">평균순위</th>
        </tr>
      </thead>
      <tbody>
        ${queries
          .map(
            (q, i) => `
          <tr class="border-b border-slate-200 hover:bg-slate-50">
            <td class="px-3 py-2 text-slate-400">${i + 1}</td>
            <td class="px-3 py-2 font-mono">${esc(q.query)}</td>
            <td class="px-3 py-2 text-right font-semibold">${fmtNum(q.clicks)}</td>
            <td class="px-3 py-2 text-right">${fmtNum(q.impressions)}</td>
            <td class="px-3 py-2 text-right ${q.ctr < 2 ? "text-red-600" : q.ctr > 5 ? "text-green-600" : ""}">${fmtPct(q.ctr)}</td>
            <td class="px-3 py-2 text-right ${q.position > 10 ? "text-amber-600" : ""}">${fmtPos(q.position)}</td>
          </tr>`,
          )
          .join("")}
      </tbody>
    </table>
    </div>`;
}

function renderPageTable(
  pages: Array<{
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>,
) {
  if (pages.length === 0) return "<p class='text-slate-500'>데이터 없음</p>";
  return `
    <div class="overflow-x-auto">
    <table class="min-w-full text-sm">
      <thead class="bg-slate-100">
        <tr>
          <th class="px-3 py-2 text-left">#</th>
          <th class="px-3 py-2 text-left">페이지</th>
          <th class="px-3 py-2 text-right">클릭</th>
          <th class="px-3 py-2 text-right">노출</th>
          <th class="px-3 py-2 text-right">CTR</th>
          <th class="px-3 py-2 text-right">평균순위</th>
        </tr>
      </thead>
      <tbody>
        ${pages
          .map((p, i) => {
            const path = p.page.replace("https://polarad.co.kr", "") || "/";
            return `
          <tr class="border-b border-slate-200 hover:bg-slate-50">
            <td class="px-3 py-2 text-slate-400">${i + 1}</td>
            <td class="px-3 py-2 font-mono text-xs">${esc(path)}</td>
            <td class="px-3 py-2 text-right font-semibold">${fmtNum(p.clicks)}</td>
            <td class="px-3 py-2 text-right">${fmtNum(p.impressions)}</td>
            <td class="px-3 py-2 text-right ${p.ctr < 2 ? "text-red-600" : p.ctr > 5 ? "text-green-600" : ""}">${fmtPct(p.ctr)}</td>
            <td class="px-3 py-2 text-right ${p.position > 10 ? "text-amber-600" : ""}">${fmtPos(p.position)}</td>
          </tr>`;
          })
          .join("")}
      </tbody>
    </table>
    </div>`;
}

function renderGscSection(gsc: AuditResult["gsc"]) {
  if (gsc.error && !gsc.last7 && !gsc.last28) {
    return `<div class="bg-red-50 border border-red-200 p-4 rounded">❌ Search Console 연결 실패: ${esc(gsc.error)}</div>`;
  }

  const last7 = gsc.last7;
  const last28 = gsc.last28;

  const summary = last28
    ? `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="bg-white p-4 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500">총 클릭 (28일)</div>
        <div class="text-2xl font-bold">${fmtNum(last28.totalClicks)}</div>
      </div>
      <div class="bg-white p-4 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500">총 노출 (28일)</div>
        <div class="text-2xl font-bold">${fmtNum(last28.totalImpressions)}</div>
      </div>
      <div class="bg-white p-4 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500">평균 CTR</div>
        <div class="text-2xl font-bold">${fmtPct(last28.avgCtr)}</div>
      </div>
      <div class="bg-white p-4 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500">평균 순위</div>
        <div class="text-2xl font-bold">${fmtPos(last28.avgPosition)}</div>
      </div>
    </div>`
    : "";

  // 개선 타겟 분석
  const highImpLowCtr = last28
    ? last28.queries
        .filter((q) => q.impressions >= 50 && q.ctr < 2)
        .slice(0, 10)
    : [];
  const rank11to20 = last28
    ? last28.queries
        .filter((q) => q.position >= 11 && q.position <= 20)
        .slice(0, 10)
    : [];

  return `
    ${summary}
    ${last7 ? renderQueryTable(last7.queries, `최근 7일 검색어 Top ${last7.queries.length}`) : ""}
    ${last28 ? renderQueryTable(last28.queries, `최근 28일 검색어 Top ${last28.queries.length}`) : ""}
    ${gsc.cumulative ? renderQueryTable(gsc.cumulative.queries, `누적 16개월 검색어 Top ${gsc.cumulative.queries.length}`) : ""}
    ${gsc.pages28 ? `<h3 class="text-lg font-bold mt-6 mb-2">페이지별 성과 (28일)</h3>${renderPageTable(gsc.pages28)}` : ""}

    ${
      highImpLowCtr.length > 0
        ? `
      <h3 class="text-lg font-bold mt-8 mb-2 text-amber-700">🎯 CTR 개선 타겟 (노출 많은데 CTR 낮음)</h3>
      <p class="text-sm text-slate-600 mb-2">이 쿼리들은 title/description를 다시 써서 클릭을 끌어올릴 여지가 큼. 노출 50+ & CTR 2% 미만.</p>
      ${renderQueryTable(highImpLowCtr, `개선 대상 ${highImpLowCtr.length}개`)}`
        : ""
    }

    ${
      rank11to20.length > 0
        ? `
      <h3 class="text-lg font-bold mt-8 mb-2 text-blue-700">🎯 순위 승격 타겟 (11~20위)</h3>
      <p class="text-sm text-slate-600 mb-2">1페이지(10위 안) 진입 시 클릭률 급증. 내부 링크 강화 + 본문 보강 대상.</p>
      ${renderQueryTable(rank11to20, `승격 대상 ${rank11to20.length}개`)}`
        : ""
    }
  `;
}

function renderGa4Section(ga4: AuditResult["ga4"]) {
  if (ga4.error && !ga4.sources && !ga4.daily) {
    return `<div class="bg-red-50 border border-red-200 p-4 rounded">❌ GA4 연결 실패: ${esc(ga4.error)}</div>`;
  }

  const yesterday = ga4.yesterday;
  const sources = ga4.sources || [];
  const pages = ga4.pages || [];
  const devices = ga4.devices || [];
  const regions = (ga4.regions || []).slice(0, 8);
  const conversions = ga4.conversions || [];
  const totalSourceVisitors = sources.reduce((s, x) => s + x.visitors, 0) || 1;

  const cards = yesterday
    ? `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="bg-white p-4 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500">어제 사용자</div>
        <div class="text-2xl font-bold">${fmtNum(yesterday.totalUsers)}</div>
      </div>
      <div class="bg-white p-4 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500">신규 사용자</div>
        <div class="text-2xl font-bold">${fmtNum(yesterday.newUsers)}</div>
      </div>
      <div class="bg-white p-4 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500">페이지뷰</div>
        <div class="text-2xl font-bold">${fmtNum(yesterday.pageViews)}</div>
      </div>
      <div class="bg-white p-4 rounded-lg border border-slate-200">
        <div class="text-xs text-slate-500">이탈률</div>
        <div class="text-2xl font-bold">${fmtPct(yesterday.bounceRate)}</div>
      </div>
    </div>`
    : "";

  const sourceTable =
    sources.length > 0
      ? `
    <h3 class="text-lg font-bold mt-4 mb-2">채널별 유입 (최근 7일)</h3>
    <div class="overflow-x-auto">
    <table class="min-w-full text-sm">
      <thead class="bg-slate-100"><tr>
        <th class="px-3 py-2 text-left">채널</th>
        <th class="px-3 py-2 text-right">사용자</th>
        <th class="px-3 py-2 text-right">비중</th>
      </tr></thead>
      <tbody>
        ${sources
          .map(
            (s) => `<tr class="border-b border-slate-200">
          <td class="px-3 py-2 font-mono">${esc(s.source)}</td>
          <td class="px-3 py-2 text-right">${fmtNum(s.visitors)}</td>
          <td class="px-3 py-2 text-right">${fmtPct((s.visitors / totalSourceVisitors) * 100)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
    </div>`
      : "";

  const pagesTable =
    pages.length > 0
      ? `
    <h3 class="text-lg font-bold mt-6 mb-2">인기 페이지 Top ${pages.length} (최근 7일)</h3>
    <div class="overflow-x-auto">
    <table class="min-w-full text-sm">
      <thead class="bg-slate-100"><tr>
        <th class="px-3 py-2 text-left">경로</th>
        <th class="px-3 py-2 text-left">제목</th>
        <th class="px-3 py-2 text-right">조회</th>
        <th class="px-3 py-2 text-right">평균체류</th>
      </tr></thead>
      <tbody>
        ${pages
          .map(
            (p) => `<tr class="border-b border-slate-200">
          <td class="px-3 py-2 font-mono text-xs">${esc(p.path)}</td>
          <td class="px-3 py-2 text-xs">${esc(p.title)}</td>
          <td class="px-3 py-2 text-right font-semibold">${fmtNum(p.views)}</td>
          <td class="px-3 py-2 text-right">${esc(p.avgTime)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
    </div>`
      : "";

  const deviceTable =
    devices.length > 0
      ? `
    <h3 class="text-lg font-bold mt-6 mb-2">기기별 분포 (7일)</h3>
    <ul class="space-y-1">
      ${devices.map((d) => `<li class="flex justify-between"><span class="font-mono">${esc(d.device)}</span><span class="font-semibold">${fmtNum(d.visitors)}</span></li>`).join("")}
    </ul>`
      : "";

  const regionTable =
    regions.length > 0
      ? `
    <h3 class="text-lg font-bold mt-6 mb-2">지역별 Top 8 (28일)</h3>
    <ul class="space-y-1">
      ${regions.map((r) => `<li class="flex justify-between"><span>${esc(r.region)}</span><span class="font-semibold">${fmtNum(r.visitors)} (${fmtPct(r.percentage)})</span></li>`).join("")}
    </ul>`
      : "";

  const conversionTable =
    conversions.length > 0
      ? `
    <h3 class="text-lg font-bold mt-6 mb-2">전환 목표 성과 (28일)</h3>
    <div class="overflow-x-auto">
    <table class="min-w-full text-sm">
      <thead class="bg-slate-100"><tr>
        <th class="px-3 py-2 text-left">목표</th>
        <th class="px-3 py-2 text-right">전환수</th>
        <th class="px-3 py-2 text-right">CVR</th>
        <th class="px-3 py-2 text-right">가치(원)</th>
      </tr></thead>
      <tbody>
        ${conversions
          .map(
            (c) => `<tr class="border-b border-slate-200">
          <td class="px-3 py-2">${esc(c.goal_label)}</td>
          <td class="px-3 py-2 text-right font-semibold">${fmtNum(c.conversions)}</td>
          <td class="px-3 py-2 text-right">${fmtPct(c.cvr)}</td>
          <td class="px-3 py-2 text-right">${fmtNum(c.conversion_value)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>
    </div>`
      : "";

  return `${cards}${sourceTable}${pagesTable}${deviceTable}${regionTable}${conversionTable}`;
}

function renderAeoSection(aeo: AuditResult["aeo"]) {
  if (aeo.error && !aeo.brand) {
    return `<div class="bg-red-50 border border-red-200 p-4 rounded">❌ 브랜드 분석 실패: ${esc(aeo.error)}</div>`;
  }
  if (!aeo.brand) return "<p class='text-slate-500'>데이터 없음</p>";
  const b = aeo.brand;

  const score = b.overallScore ?? 0;
  const { grade, label: gradeLabel } = getGrade(score);
  const naver = b.naverResult;
  const google = b.googleResult;
  const ai = b.aiResult;

  return `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div class="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
        <div class="text-xs text-indigo-600">종합 점수 (${esc(grade)})</div>
        <div class="text-2xl font-bold text-indigo-800">${fmtPos(score)}</div>
        <div class="text-xs text-indigo-600 mt-1">${esc(gradeLabel)}</div>
      </div>
      <div class="bg-green-50 p-4 rounded-lg border border-green-200">
        <div class="text-xs text-green-700">네이버 (${b.naverScore ?? "N/A"})</div>
        <div class="text-2xl font-bold text-green-800">${naver ? fmtPos(naver.score) : "N/A"}</div>
      </div>
      <div class="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <div class="text-xs text-blue-700">구글 (${b.googleScore ?? "N/A"})</div>
        <div class="text-2xl font-bold text-blue-800">${google ? fmtPos(google.score) : "N/A"}</div>
      </div>
      <div class="bg-purple-50 p-4 rounded-lg border border-purple-200">
        <div class="text-xs text-purple-700">AI 인지도</div>
        <div class="text-2xl font-bold text-purple-800">${ai ? fmtPos(ai.score) : "N/A"}</div>
      </div>
    </div>

    ${
      naver
        ? `
      <h3 class="text-lg font-bold mt-4 mb-2">네이버 지표</h3>
      <ul class="text-sm space-y-1">
        <li>• 공식 웹: <strong>${fmtNum(naver.totalCounts.web)}</strong>건</li>
        <li>• 블로그: <strong>${fmtNum(naver.totalCounts.blog)}</strong>건</li>
        <li>• 카페: <strong>${fmtNum(naver.totalCounts.cafe)}</strong>건</li>
        <li>• 뉴스: <strong>${fmtNum(naver.totalCounts.news)}</strong>건</li>
        <li>• 로컬: <strong>${fmtNum(naver.totalCounts.local)}</strong>건</li>
      </ul>
      <div class="mt-2 text-xs text-slate-600">점수 세부: 공식사이트 ${naver.scoreBreakdown.officialWebsite} · 블로그 ${naver.scoreBreakdown.blogMentions} · 로컬등록 ${naver.scoreBreakdown.localRegistration} · 뉴스 ${naver.scoreBreakdown.newsCoverage} · 카페 ${naver.scoreBreakdown.cafeMentions} · 브랜드콘텐츠 ${naver.scoreBreakdown.brandContent}</div>
    `
        : ""
    }

    ${
      google
        ? `
      <h3 class="text-lg font-bold mt-4 mb-2">구글 지표</h3>
      <ul class="text-sm space-y-1">
        <li>• 색인 여부: <strong>${google.isIndexed ? "✅ 색인됨" : "❌ 미색인"}</strong></li>
        <li>• 상위 순위: ${google.topRankPosition ? `${google.topRankPosition}위` : "없음"}</li>
        <li>• Google Business: ${google.hasGoogleBusiness ? "✅" : "❌"}</li>
        <li>• 리뷰: ${fmtNum(google.reviewCount)}건 (${google.avgRating ? google.avgRating.toFixed(1) : "N/A"}점)</li>
        <li>• 이미지 검색: ${google.hasImageResults ? "✅" : "❌"}</li>
      </ul>
    `
        : ""
    }

    ${
      ai
        ? `
      <h3 class="text-lg font-bold mt-6 mb-2">🤖 AI 답변 엔진 인지도 (AEO)</h3>
      <p class="text-sm text-slate-600 mb-2">${esc(ai.summary)}</p>
      <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-100"><tr>
          <th class="px-3 py-2 text-left">모델</th>
          <th class="px-3 py-2 text-center">인지</th>
          <th class="px-3 py-2 text-center">정확도</th>
          <th class="px-3 py-2 text-center">업종 매칭</th>
          <th class="px-3 py-2 text-center">위치 언급</th>
        </tr></thead>
        <tbody>
          ${ai.models
            .map(
              (m) => `<tr class="border-b border-slate-200">
            <td class="px-3 py-2 font-mono">${esc(m.model)}</td>
            <td class="px-3 py-2 text-center">${m.knows ? "✅" : "❌"}</td>
            <td class="px-3 py-2 text-center">${m.accurate ? "✅" : "❌"}</td>
            <td class="px-3 py-2 text-center">${m.details.industryCorrect ? "✅" : "❌"}</td>
            <td class="px-3 py-2 text-center">${m.details.locationMentioned ? "✅" : "❌"}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>
      </div>
      <details class="mt-2 text-xs text-slate-600">
        <summary class="cursor-pointer">AI 원본 응답 보기</summary>
        ${ai.models.map((m) => `<div class="mt-2 p-2 bg-slate-50 rounded"><strong>${esc(m.model)}</strong><pre class="whitespace-pre-wrap font-mono text-xs mt-1">${esc(m.response.slice(0, 800))}</pre></div>`).join("")}
      </details>
    `
        : ""
    }
  `;
}

function renderHTML(r: AuditResult): string {
  const generatedAt = new Date(r.date).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>폴라애드 SEO/AEO/GEO 감사 리포트 — ${generatedAt.slice(0, 10)}</title>
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:system-ui,-apple-system,sans-serif}</style>
</head>
<body class="bg-slate-50 text-slate-900">
<div class="max-w-6xl mx-auto px-6 py-10">
  <header class="mb-8">
    <h1 class="text-3xl font-bold">폴라애드 SEO / AEO / GEO 감사 리포트</h1>
    <p class="text-slate-600 mt-1">생성일: ${esc(generatedAt)} · 도메인: <a href="https://polarad.co.kr" class="underline">polarad.co.kr</a></p>
  </header>

  <nav class="mb-6 bg-white p-4 rounded-lg border border-slate-200">
    <strong>목차</strong>
    <ul class="mt-1 text-sm">
      <li>① <a href="#gsc" class="underline">Google Search Console</a> — 실제 검색 유입</li>
      <li>② <a href="#ga4" class="underline">Google Analytics 4</a> — 사용자 행동</li>
      <li>③ <a href="#aeo" class="underline">AEO/브랜드 검색</a> — 네이버·구글·AI 인지도</li>
      <li>④ <a href="#actions" class="underline">개선 제안</a></li>
    </ul>
  </nav>

  <section id="gsc" class="mb-10 bg-white p-6 rounded-lg border border-slate-200">
    <h2 class="text-2xl font-bold mb-4">① Google Search Console</h2>
    ${renderGscSection(r.gsc)}
  </section>

  <section id="ga4" class="mb-10 bg-white p-6 rounded-lg border border-slate-200">
    <h2 class="text-2xl font-bold mb-4">② Google Analytics 4</h2>
    ${renderGa4Section(r.ga4)}
  </section>

  <section id="aeo" class="mb-10 bg-white p-6 rounded-lg border border-slate-200">
    <h2 class="text-2xl font-bold mb-4">③ AEO — 브랜드 · AI 인지도</h2>
    ${renderAeoSection(r.aeo)}
  </section>

  <section id="actions" class="mb-10 bg-white p-6 rounded-lg border border-slate-200">
    <h2 class="text-2xl font-bold mb-4">④ 개선 제안 (액션 우선순위)</h2>
    <ol class="space-y-3 list-decimal list-inside">
      <li><strong>CTR 개선 타겟</strong> — 위 ① 섹션의 <em>CTR 개선 타겟</em> 쿼리별로 해당 페이지의 <code>metadata.title</code> / <code>description</code> 재작성.</li>
      <li><strong>순위 승격 타겟</strong> — 11~20위 쿼리에 대해 본문 보강 + 내부 링크 3~5개 추가. 관련 마케팅소식 글 크로스 링크.</li>
      <li><strong>LocalBusinessSchema 글로벌 삽입</strong> — 현재 컴포넌트만 있고 <code>layout.tsx</code>에 미사용. 주소/좌표/영업시간/전화 포함해 GEO(지역검색) 기반 삽입.</li>
      <li><strong>FAQSchema 전면 배치</strong> — AEO(AI 답변)의 가장 강력한 구조. 서비스/가격/환불 FAQ를 홈·service·onlinemkt에 반복 삽입.</li>
      <li><strong>Author/Person Schema</strong> — marketing-news 글별 저자 구조화. E-E-A-T 신뢰도 상승 + AI가 "누가 썼나" 답 가능.</li>
      <li><strong>speakable schema</strong> — 음성 검색 AEO용. 홈페이지 핵심 질문 한두 줄에 <code>schema:speakable</code> 추가.</li>
      <li><strong>네이버 블로그/카페 활동 강화</strong> — 위 ③ 섹션의 네이버 블로그/카페 건수가 낮으면 컨텐츠 시딩 필요.</li>
      <li><strong>AI 인지도가 낮은 모델</strong> — llms.txt 추가 정보 반영 + 주요 기술 문서 공개로 크롤 대상 늘리기.</li>
    </ol>
  </section>

  <footer class="mt-10 pt-6 border-t border-slate-200 text-xs text-slate-500">
    생성 스크립트: <code>F:/master_polarad/scripts/seo-audit-polarad.ts</code>
    · 라이브러리: <code>@/lib/search-console</code>, <code>@/lib/google-analytics</code>, <code>@/lib/brand-search</code>
  </footer>
</div>
</body>
</html>`;
}

// ─── 실행 ──────────────────────────────────────
(async () => {
  console.log("폴라애드 SEO/AEO/GEO 감사 시작...\n");
  const start = Date.now();
  const r = await run();
  const html = renderHTML(r);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, html, "utf8");
  console.log(`\n✓ 완료 (${((Date.now() - start) / 1000).toFixed(1)}s)`);
  console.log(`  리포트: ${OUTPUT_PATH.replace(/\//g, "\\")}`);
})().catch((e) => {
  console.error("치명적 오류:", e);
  process.exit(1);
});
