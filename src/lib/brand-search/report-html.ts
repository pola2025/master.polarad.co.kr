/**
 * Brand Report HTML Template Generator
 * v9 디자인 기반 — 분석 데이터를 동적으로 바인딩하여 완성된 HTML 리포트 생성
 */

import type { NaverSearchResult } from "./naver";
import type { GoogleSearchResult } from "./google";
import type { AISearchResult } from "./ai-search";
import { getGrade } from "./report-generator";

export interface ReportHTMLInput {
  businessName: string;
  industry: string;
  location?: string;
  reportDate: string;
  reportNo: string;

  naverResult: NaverSearchResult | null;
  googleResult: GoogleSearchResult | null;
  aiResult: AISearchResult | null;

  naverScore: number | null;
  googleScore: number | null;
  overallScore: number;

  // Gemini가 생성한 개선 포인트 (마크다운에서 파싱)
  improvements?: { title: string; description: string; impact: string }[];
  // Gemini가 생성한 요약
  summary?: string;
}

// ─── Helpers ───

function scoreColor(score: number, max: number): "good" | "warn" | "bad" {
  const pct = score / max;
  if (pct >= 0.7) return "good";
  if (pct >= 0.4) return "warn";
  return "bad";
}

function statusLabel(color: "good" | "warn" | "bad"): string {
  if (color === "good") return "양호";
  if (color === "warn") return "주의";
  return "위험";
}

function comma(n: number): string {
  return n.toLocaleString("ko-KR");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

// ─── SVG Icons ───

const ICONS = {
  logo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M3 9h18"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>`,
  donut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.21 15.89A10 10 0 118 2.83"/><path d="M22 12A10 10 0 0012 2v10z"/></svg>`,
  doc: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  bar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>`,
  trend: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  ai: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a7 7 0 017 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 01-2 2h-4a2 2 0 01-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 017-7z"/><line x1="9" y1="21" x2="15" y2="21"/></svg>`,
};

// ─── Template sections ───

function renderHeader(d: ReportHTMLInput): string {
  return `<header class="hdr">
  <div class="hdr-row">
    <div class="hdr-mark">${ICONS.logo}<span>POLARAD</span></div>
    <div class="hdr-meta">${d.reportNo}</div>
  </div>
  <h1>${d.businessName}<span class="sub">${d.industry}${d.location ? ` · ${d.location}` : ""} · 브랜드 검색 평가 리포트 · ${d.reportDate}</span></h1>
</header>`;
}

function renderHero(d: ReportHTMLInput): string {
  const { grade } = getGrade(d.overallScore);
  const pct = d.overallScore / 100;
  const dashoffset = Math.round(553 * (1 - pct));
  const gradeColor = d.overallScore >= 70 ? "var(--c)" : "var(--red)";

  // Build tags
  const tags: { label: string; type: "on" | "warn" }[] = [];
  if (d.googleResult?.topRankPosition === 1)
    tags.push({ label: "구글 검색 1위", type: "on" });
  if (d.naverResult && d.naverResult.localResults.length > 0)
    tags.push({ label: "플레이스 등록", type: "on" });
  if (d.naverResult && d.naverResult.scoreBreakdown.officialWebsite === 0)
    tags.push({ label: "홈페이지 미등록", type: "warn" });
  if (d.naverResult && d.naverResult.scoreBreakdown.brandContent === 0)
    tags.push({ label: "브랜드 콘텐츠 없음", type: "warn" });

  const tagsHtml = tags
    .map((t) => `<span class="tag tag-${t.type}">${t.label}</span>`)
    .join("\n");

  return `<div class="hero">
  <div class="gauge">
    <svg viewBox="0 0 200 200">
      <circle class="gauge-bg" cx="100" cy="100" r="88"/>
      <circle class="gauge-arc" cx="100" cy="100" r="88" style="stroke:${gradeColor}" stroke-dasharray="553" stroke-dashoffset="${dashoffset}"/>
    </svg>
    <div class="gauge-inner">
      <div class="gauge-grade" style="color:${gradeColor}">${grade}</div>
      <div class="gauge-score mono">${d.overallScore} / 100</div>
      <div class="gauge-label">Overall Score</div>
    </div>
  </div>
  <div class="hero-body">
    <p class="excerpt">${d.summary || `${d.businessName}의 브랜드 검색 종합 점수는 ${d.overallScore}점입니다.`}</p>
    <div class="tags">${tagsHtml}</div>
  </div>
</div>`;
}

function renderPlatformScores(d: ReportHTMLInput): string {
  const ns = d.naverScore ?? 0;
  const gs = d.googleScore ?? 0;
  const nClass = ns >= 60 ? "ok" : "warn";
  const gClass = gs >= 60 ? "ok" : "warn";

  return `<div class="plat">
  <div class="plat-box plat-${nClass === "ok" ? "ok" : "warn"}">
    <div class="plat-label">Naver</div>
    <div class="plat-num plat-num-${nClass} mono">${ns} <small>/ 100</small></div>
    <div class="plat-bar"><div class="plat-fill plat-fill-${nClass}" style="width:${ns}%"></div></div>
  </div>
  <div class="plat-box plat-${gClass === "ok" ? "ok" : "warn"}">
    <div class="plat-label">Google</div>
    <div class="plat-num plat-num-${gClass} mono">${gs} <small>/ 100</small></div>
    <div class="plat-bar"><div class="plat-fill plat-fill-${gClass}" style="width:${gs}%"></div></div>
  </div>
</div>`;
}

function renderHighlightAndAlert(d: ReportHTMLInput): string {
  let html = "";

  // Positive highlights
  const positives: string[] = [];
  if (d.googleResult?.topRankPosition === 1)
    positives.push("<strong>구글 검색 1위</strong> 달성(25/25점)");
  if (d.naverResult && d.naverResult.localResults.length > 0)
    positives.push("네이버 <strong>플레이스 등록 완료</strong>");
  if (d.naverResult && d.naverResult.totalCounts.cafe > 1000)
    positives.push(
      `카페 언급 <strong>${comma(d.naverResult.totalCounts.cafe)}건</strong>`,
    );
  if (
    d.googleResult &&
    d.googleResult.avgRating >= 4.5 &&
    d.googleResult.reviewCount > 0
  )
    positives.push(`구글 리뷰 <strong>${d.googleResult.avgRating}점</strong>`);

  if (positives.length > 0) {
    html += `<div class="highlight">
  ${ICONS.check}
  <div class="highlight-body">
    <div class="highlight-title">확보된 강점</div>
    <p>${positives.join(", ")}. 이 강점을 기반으로 미비한 채널을 보강하면 빠른 점수 상승이 가능합니다.</p>
  </div>
</div>\n`;
  }

  // Negative alerts
  const negatives: string[] = [];
  if (d.naverResult && d.naverResult.scoreBreakdown.officialWebsite === 0)
    negatives.push("네이버 공식 홈페이지 미등록");
  if (d.naverResult && d.naverResult.scoreBreakdown.brandContent === 0)
    negatives.push("브랜드 콘텐츠 없음");
  if (d.naverResult && d.naverResult.scoreBreakdown.newsCoverage <= 3)
    negatives.push("뉴스 보도 부족");

  if (negatives.length > 0) {
    html += `<div class="alert">
  ${ICONS.warn}
  <div class="alert-body">
    <div class="alert-title">주요 미비 항목 ${negatives.length}건</div>
    <p>${negatives.join(", ")}으로 확인됨. 잠재 고객 유입 기회를 놓치고 있습니다.</p>
  </div>
</div>\n`;
  }

  return html;
}

function renderDonut(d: ReportHTMLInput): string {
  const ns = d.naverScore ?? 0;
  const gs = d.googleScore ?? 0;
  const total = ns + gs || 1;
  const gPct = gs / total;
  const circ = 2 * Math.PI * 70; // ~440
  const gDash = Math.round(circ * gPct);
  const nDash = Math.round(circ * (1 - gPct));
  const diff = gs - ns;

  return `<div class="sec">
  <div class="sec-head">${ICONS.donut}<span class="sec-title">플랫폼 균형 진단</span></div>
  <div class="donut-row">
    <div class="donut-wrap">
      <svg viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="70" fill="none" stroke="var(--rule)" stroke-width="28"/>
        <circle cx="100" cy="100" r="70" fill="none" stroke="var(--c)" stroke-width="28" stroke-dasharray="${gDash} ${nDash}" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="70" fill="none" stroke="var(--red)" stroke-width="28" stroke-dasharray="${nDash} ${gDash}" stroke-dashoffset="-${gDash}" stroke-linecap="round"/>
      </svg>
      <div class="donut-center">
        <div class="donut-big mono">${d.overallScore}</div>
        <div class="donut-small">종합</div>
      </div>
    </div>
    <div class="donut-legend">
      <div class="leg-item"><div class="leg-dot" style="background:var(--red)"></div><div class="leg-label">네이버</div><div class="leg-score" style="color:var(--red)">${ns} <span class="leg-max">/ 100</span></div></div>
      <div class="leg-item"><div class="leg-dot" style="background:var(--c)"></div><div class="leg-label">구글</div><div class="leg-score" style="color:var(--c)">${gs} <span class="leg-max">/ 100</span></div></div>
      <div class="leg-item"><div class="leg-dot" style="background:var(--ink4)"></div><div class="leg-label">플랫폼 점수 차이</div><div class="leg-score" style="color:${diff > 0 ? "var(--c)" : "var(--red)"}">${diff > 0 ? "+" : ""}${diff}p</div></div>
    </div>
  </div>
</div>`;
}

function renderChannelStatus(d: ReportHTMLInput): string {
  const nr = d.naverResult;
  const hasPlace = nr ? nr.localResults.length > 0 : false;
  const hasOfficialSite = nr ? nr.scoreBreakdown.officialWebsite > 0 : false;
  // Blog/Cafe ownership cannot be determined from search data alone
  // We mark based on whether brand content exists
  const hasBrandContent = nr ? nr.scoreBreakdown.brandContent > 0 : false;

  function card(name: string, has: boolean): string {
    const cls = has ? "ch-card-yes" : "ch-card-no";
    const icon = has ? ICONS.check : ICONS.x;
    const status = has ? "확인됨" : "미보유";
    return `<div class="ch-card ${cls}"><div class="ch-icon">${icon}</div><div class="ch-name">${name}</div><div class="ch-status">${status}</div></div>`;
  }

  return `<div class="sec">
  <div class="sec-head">${ICONS.home}<span class="sec-title">네이버 자체 채널 보유 현황</span></div>
  <div class="ch-grid">
    ${card("공식 홈페이지", hasOfficialSite)}
    ${card("플레이스", hasPlace)}
    ${card("자체 블로그", hasBrandContent)}
    ${card("브랜드 콘텐츠", hasBrandContent)}
  </div>
</div>`;
}

function renderNaverBreakdown(d: ReportHTMLInput): string {
  if (!d.naverResult) return "";
  const nr = d.naverResult;
  const sb = nr.scoreBreakdown;

  const items = [
    {
      label: "공식 웹사이트",
      score: sb.officialWebsite,
      max: 20,
      detail: sb.officialWebsite > 0 ? "등록 확인" : "서치어드바이저 미등록",
    },
    {
      label: "블로그",
      score: sb.blogMentions,
      max: 20,
      detail: `${comma(nr.totalCounts.blog)}건`,
    },
    {
      label: "플레이스",
      score: sb.localRegistration,
      max: 20,
      detail: nr.localResults.length > 0 ? "등록 완료" : "미등록",
    },
    {
      label: "카페",
      score: sb.cafeMentions,
      max: 10,
      detail: `${comma(nr.totalCounts.cafe)}건 언급`,
    },
    {
      label: "뉴스",
      score: sb.newsCoverage,
      max: 15,
      detail: `${nr.totalCounts.news}건`,
    },
    {
      label: "브랜드 콘텐츠",
      score: sb.brandContent,
      max: 15,
      detail: sb.brandContent > 0 ? `${sb.brandContent}점` : "콘텐츠 없음",
    },
  ];

  const cards = items
    .map((it) => {
      const color = scoreColor(it.score, it.max);
      return `<div class="score-card sc-${color}">
  <div class="sc-label">${it.label}</div>
  <div class="sc-num">${it.score} <span class="sc-max">/ ${it.max}</span></div>
  <div class="sc-detail">${it.detail}</div>
  <div class="sc-badge">${statusLabel(color)}</div>
</div>`;
    })
    .join("\n");

  return `<div class="sec">
  <div class="sec-head">${ICONS.search}<span class="sec-title">네이버 세부 진단</span><span class="sec-sub">${d.naverScore ?? 0} / 100</span></div>
  <div class="score-grid">${cards}</div>
</div>`;
}

function renderBlogFindings(d: ReportHTMLInput): string {
  if (!d.naverResult || d.naverResult.blogResults.length === 0) return "";
  const blogs = d.naverResult.blogResults.slice(0, 5);

  const items = blogs
    .map((b, i) => {
      const title = stripHtml(b.title);
      return `<div class="item">
  <div class="num">${i + 1}</div>
  <div class="body">
    <div class="ttl">${title}</div>
    <div class="src">${stripHtml(b.description).substring(0, 60)}</div>
  </div>
</div>`;
    })
    .join("\n");

  return `<div class="sec">
  <div class="sec-head">${ICONS.doc}<span class="sec-title">블로그 검색 상위 5개</span><span class="sec-sub">'${d.businessName}' 키워드</span></div>
  <div class="finds">${items}</div>
</div>`;
}

function renderGoogleBreakdown(d: ReportHTMLInput): string {
  if (!d.googleResult) return "";
  const gr = d.googleResult;
  const sb = gr.scoreBreakdown;

  const rows = [
    {
      name: "인덱싱",
      score: sb.indexed,
      max: 30,
      fill: gr.isIndexed ? 100 : 0,
      label: gr.isIndexed ? "확인됨" : "미확인",
      cls: gr.isIndexed ? "hi" : "lo",
    },
    {
      name: "검색 순위",
      score: sb.topRank,
      max: 25,
      fill: (sb.topRank / 25) * 100,
      label: gr.topRankPosition ? `#${gr.topRankPosition}` : "10위 밖",
      cls: sb.topRank >= 20 ? "hi" : sb.topRank >= 10 ? "mid" : "lo",
    },
    {
      name: "비즈니스 프로필",
      score: sb.googleBusiness,
      max: 20,
      fill: (sb.googleBusiness / 20) * 100,
      label: gr.hasGoogleBusiness
        ? `${Math.round(gr.businessCompleteness * 100)}% 완성`
        : "미등록",
      cls:
        sb.googleBusiness >= 14 ? "hi" : sb.googleBusiness >= 8 ? "mid" : "lo",
    },
    {
      name: "리뷰",
      score: sb.reviews,
      max: 15,
      fill: (sb.reviews / 15) * 100,
      label: gr.hasReviews ? `${gr.reviewCount}건 / ${gr.avgRating}점` : "없음",
      cls: sb.reviews >= 10 ? "hi" : sb.reviews >= 5 ? "mid" : "lo",
    },
    {
      name: "이미지",
      score: sb.imagePresence,
      max: 10,
      fill: gr.hasImageResults ? 100 : 0,
      label: gr.hasImageResults ? "노출됨" : "미노출",
      cls: gr.hasImageResults ? "hi" : "lo",
    },
  ];

  const rowsHtml = rows
    .map(
      (r) => `<div class="hbar-row">
  <div class="hbar-name">${r.name}</div>
  <div class="hbar-track"><div class="hbar-fill ${r.cls}" style="width:${Math.max(r.fill, 8)}%">${r.label}</div></div>
  <div class="hbar-val mono">${r.score}/${r.max}</div>
</div>`,
    )
    .join("\n");

  return `<div class="sec">
  <div class="sec-head">${ICONS.globe}<span class="sec-title">구글 세부 진단</span><span class="sec-sub">${d.googleScore ?? 0} / 100</span></div>
  <div class="hbar">${rowsHtml}</div>
</div>`;
}

function renderImprovements(d: ReportHTMLInput): string {
  const items = d.improvements ?? [];
  if (items.length === 0) return "";

  const html = items
    .map(
      (it, i) => `<div class="act">
  <div class="act-n">${i + 1}</div>
  <div class="act-body">
    <div class="act-t">${it.title}</div>
    <div class="act-d">${it.description}</div>
    <div class="act-impact">${it.impact}</div>
  </div>
</div>`,
    )
    .join("\n");

  return `<div class="sec">
  <div class="sec-head">${ICONS.bar}<span class="sec-title">개선 포인트</span></div>
  <div class="actions">${html}</div>
</div>`;
}

function renderProjection(d: ReportHTMLInput): string {
  const now = d.overallScore;
  const mid = Math.min(100, now + 20);
  const goal = Math.min(100, now + 38);
  const { grade: gNow } = getGrade(now);
  const { grade: gMid } = getGrade(mid);
  const { grade: gGoal } = getGrade(goal);

  return `<div class="sec">
  <div class="sec-head">${ICONS.trend}<span class="sec-title">예상 점수 변화</span></div>
  <div class="proj">
    <div class="proj-step proj-now"><div class="proj-label">현재</div><div class="proj-val mono">${now}</div><div class="proj-grade">${gNow}등급</div></div>
    <div class="proj-arrow">${ICONS.arrow}</div>
    <div class="proj-step proj-mid"><div class="proj-label">1차 개선</div><div class="proj-val mono">${mid}</div><div class="proj-grade">${gMid}등급</div></div>
    <div class="proj-arrow">${ICONS.arrow}</div>
    <div class="proj-step proj-goal"><div class="proj-label">전체 개선</div><div class="proj-val mono">${goal}</div><div class="proj-grade">${gGoal}등급</div></div>
  </div>
</div>`;
}

function renderAIResults(d: ReportHTMLInput): string {
  if (!d.aiResult || d.aiResult.models.length === 0) return "";

  const cards = d.aiResult.models
    .map((m) => {
      const color = m.error
        ? "warn"
        : m.knows && m.accurate
          ? "good"
          : m.knows
            ? "warn"
            : "bad";
      const status = m.error
        ? "체크 실패"
        : m.knows
          ? m.accurate
            ? "인지됨 / 정확"
            : "인지됨 / 부정확"
          : "미인지";
      const desc = m.error ? m.error : m.response.substring(0, 150);
      return `<div class="score-card sc-${color}">
  <div class="sc-label">${m.model}</div>
  <div class="sc-num" style="font-size:28px">${status}</div>
  <div class="sc-detail" style="margin-top:10px;text-align:left;line-height:1.6">${desc}${desc.length >= 150 ? "..." : ""}</div>
  <div class="sc-badge">${m.knows ? (m.accurate ? "양호" : "주의") : "AI 인지도 부족"}</div>
</div>`;
    })
    .join("\n");

  const cols =
    d.aiResult.models.length === 1
      ? "1fr"
      : d.aiResult.models.length === 2
        ? "1fr 1fr"
        : "repeat(3,1fr)";

  return `<div class="sec">
  <div class="sec-head">${ICONS.ai}<span class="sec-title">AI 검색 출력 결과</span><span class="sec-sub">${d.aiResult.models.map((m) => m.model).join(" / ")}</span></div>
  <div class="score-grid" style="grid-template-columns:${cols}">${cards}</div>
</div>`;
}

// ─── CSS (v9 styles) ───

function getCSS(): string {
  return `@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css");
:root{--c:#1d4ed8;--c80:rgba(29,78,216,.8);--c60:rgba(29,78,216,.6);--c40:rgba(29,78,216,.4);--c25:rgba(29,78,216,.25);--c15:rgba(29,78,216,.15);--c08:rgba(29,78,216,.08);--c04:rgba(29,78,216,.04);--red:#dc2626;--red80:rgba(220,38,38,.8);--red25:rgba(220,38,38,.25);--red15:rgba(220,38,38,.15);--red08:rgba(220,38,38,.08);--red04:rgba(220,38,38,.04);--amber:#d97706;--amber15:rgba(217,119,6,.15);--amber08:rgba(217,119,6,.08);--green:#059669;--green15:rgba(5,150,105,.15);--green08:rgba(5,150,105,.08);--ink:#0f1419;--ink2:#3d4550;--ink3:#6e7681;--ink4:#adb5bd;--bg:#fafbfc;--white:#fff;--rule:#e5e7eb}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:"Pretendard Variable","Pretendard",system-ui,sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased;font-feature-settings:"tnum"}
.rpt{max-width:900px;margin:0 auto;padding:64px 0 56px}
.mono{font-variant-numeric:tabular-nums}
.divider{border:none;border-top:1px solid var(--rule);margin:48px 48px}
.hdr{padding:0 48px;margin-bottom:56px}
.hdr-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:40px}
.hdr-mark{display:flex;align-items:center;gap:10px}
.hdr-mark svg{width:24px;height:24px;color:var(--c)}
.hdr-mark span{font-size:14px;font-weight:800;letter-spacing:3px;color:var(--c)}
.hdr-meta{font-size:14px;color:var(--ink4);font-weight:500}
.hdr h1{font-size:52px;font-weight:900;letter-spacing:-2px;line-height:1.1}
.hdr .sub{display:block;font-size:18px;font-weight:500;color:var(--ink3);margin-top:12px}
.hero{display:flex;gap:56px;align-items:center;padding:56px 48px;background:var(--white);border:1px solid var(--rule);border-radius:20px;margin:0 48px 40px}
.gauge{position:relative;width:240px;height:240px;flex-shrink:0}
.gauge svg{width:100%;height:100%}
.gauge-bg{fill:none;stroke:var(--rule);stroke-width:10}
.gauge-arc{fill:none;stroke-width:10;stroke-linecap:round;transform-origin:50% 50%;transform:rotate(-90deg)}
.gauge-inner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.gauge-grade{font-size:96px;font-weight:900;line-height:1;letter-spacing:-4px}
.gauge-score{font-size:24px;font-weight:700;color:var(--ink3);margin-top:8px}
.gauge-label{font-size:12px;font-weight:700;color:var(--ink4);margin-top:4px;letter-spacing:1.5px;text-transform:uppercase}
.hero-body{flex:1}
.hero-body .excerpt{font-size:20px;font-weight:500;line-height:1.8;color:var(--ink2);margin-bottom:24px}
.hero-body .excerpt strong{color:var(--ink);font-weight:700}
.hero-body .excerpt .warn{color:var(--red);font-weight:700}
.tags{display:flex;gap:10px;flex-wrap:wrap}
.tag{font-size:14px;font-weight:600;padding:8px 16px;border-radius:8px;border:1px solid var(--rule);color:var(--ink3)}
.tag-on{border-color:var(--c25);color:var(--c);background:var(--c04)}
.tag-warn{border-color:var(--red25);color:var(--red);background:var(--red04)}
.plat{display:flex;gap:24px;padding:0 48px;margin-bottom:40px}
.plat-box{flex:1;background:var(--white);border:1px solid var(--rule);border-radius:16px;padding:32px;position:relative;overflow:hidden}
.plat-box::after{content:"";position:absolute;top:0;left:0;right:0;height:4px}
.plat-warn::after{background:var(--red)}.plat-ok::after{background:var(--c)}
.plat-label{font-size:14px;font-weight:700;color:var(--ink4);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px}
.plat-num{font-size:64px;font-weight:900;line-height:1;letter-spacing:-3px}
.plat-num-warn{color:var(--red)}.plat-num-ok{color:var(--c)}
.plat-num small{font-size:20px;font-weight:500;color:var(--ink4)}
.plat-bar{height:8px;background:var(--rule);border-radius:4px;margin-top:20px}
.plat-fill{height:100%;border-radius:4px}
.plat-fill-warn{background:var(--red)}.plat-fill-ok{background:var(--c)}
.highlight{margin:0 48px 20px;padding:24px 28px;background:var(--green08);border:1px solid var(--green15);border-left:5px solid var(--green);border-radius:12px;display:flex;gap:16px;align-items:flex-start}
.highlight svg{width:28px;height:28px;color:var(--green);flex-shrink:0;margin-top:2px}
.highlight-body{flex:1}
.highlight-title{font-size:20px;font-weight:800;color:var(--green);margin-bottom:6px}
.highlight p{font-size:16px;color:var(--ink2);line-height:1.7}
.highlight strong{font-weight:700;color:var(--ink)}
.alert{margin:0 48px 48px;padding:24px 28px;background:var(--red04);border:1px solid var(--red25);border-left:5px solid var(--red);border-radius:12px;display:flex;gap:16px;align-items:flex-start}
.alert svg{width:28px;height:28px;color:var(--red);flex-shrink:0;margin-top:2px}
.alert-body{flex:1}
.alert-title{font-size:20px;font-weight:800;color:var(--red);margin-bottom:6px}
.alert p{font-size:16px;color:var(--ink2);line-height:1.7}
.alert strong{font-weight:700;color:var(--ink)}
.sec{margin:0 48px 36px}
.sec-head{display:flex;align-items:center;gap:12px;margin-bottom:24px;padding-bottom:14px;border-bottom:3px solid var(--ink)}
.sec-head svg{width:24px;height:24px;color:var(--c)}
.sec-title{font-size:22px;font-weight:800;color:var(--ink);letter-spacing:-.5px}
.sec-sub{font-size:15px;font-weight:600;color:var(--ink4);margin-left:auto}
.score-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:32px}
.score-card{padding:24px 20px;border-radius:14px;text-align:center}
.sc-bad{background:var(--red04);border:1.5px solid var(--red15)}
.sc-warn{background:var(--amber08);border:1.5px solid var(--amber15)}
.sc-good{background:var(--green08);border:1.5px solid var(--green15)}
.sc-label{font-size:14px;font-weight:700;color:var(--ink3);margin-bottom:8px}
.sc-num{font-size:40px;font-weight:900;line-height:1;letter-spacing:-1px}
.sc-bad .sc-num{color:var(--red)}.sc-warn .sc-num{color:var(--amber)}.sc-good .sc-num{color:var(--green)}
.sc-max{font-size:16px;font-weight:500;color:var(--ink4)}
.sc-detail{font-size:13px;color:var(--ink3);margin-top:8px;font-weight:500}
.sc-badge{display:inline-block;font-size:12px;font-weight:700;padding:4px 10px;border-radius:5px;margin-top:10px}
.sc-bad .sc-badge{background:var(--red15);color:var(--red)}
.sc-warn .sc-badge{background:var(--amber15);color:var(--amber)}
.sc-good .sc-badge{background:var(--green15);color:var(--green)}
.ch-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px}
.ch-card{padding:24px 16px;border-radius:14px;text-align:center;border:1.5px solid var(--rule);background:var(--white)}
.ch-card-yes{border-color:var(--green15);background:var(--green08)}
.ch-card-no{border-color:var(--red15);background:var(--red04)}
.ch-icon{width:40px;height:40px;margin:0 auto 10px;border-radius:10px;display:flex;align-items:center;justify-content:center}
.ch-card-yes .ch-icon{background:var(--green15)}.ch-card-no .ch-icon{background:var(--red15)}
.ch-icon svg{width:20px;height:20px}
.ch-card-yes .ch-icon svg{color:var(--green)}.ch-card-no .ch-icon svg{color:var(--red)}
.ch-name{font-size:14px;font-weight:700;color:var(--ink2);margin-bottom:6px}
.ch-status{font-size:16px;font-weight:800}
.ch-card-yes .ch-status{color:var(--green)}.ch-card-no .ch-status{color:var(--red)}
.hbar{margin-bottom:12px}
.hbar-row{display:flex;align-items:center;gap:16px;padding:14px 0}
.hbar-row+.hbar-row{border-top:1px solid var(--rule)}
.hbar-name{width:120px;font-size:16px;font-weight:600;color:var(--ink2)}
.hbar-track{flex:1;height:32px;background:var(--bg);border:1px solid var(--rule);border-radius:8px;overflow:hidden}
.hbar-fill{height:100%;border-radius:8px;display:flex;align-items:center;padding:0 12px;font-size:13px;font-weight:700;color:var(--white);min-width:fit-content}
.hbar-fill.hi{background:var(--c)}.hbar-fill.mid{background:var(--amber)}.hbar-fill.lo{background:var(--red);min-width:60px}
.hbar-val{width:60px;text-align:right;font-size:18px;font-weight:800;color:var(--ink)}
.donut-row{display:flex;gap:40px;align-items:center;padding:36px 40px;background:var(--white);border:1px solid var(--rule);border-radius:16px;margin-bottom:36px}
.donut-wrap{position:relative;width:180px;height:180px;flex-shrink:0}
.donut-wrap svg{width:100%;height:100%;transform:rotate(-90deg)}
.donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.donut-big{font-size:44px;font-weight:900;color:var(--ink);line-height:1}
.donut-small{font-size:14px;font-weight:600;color:var(--ink4);margin-top:4px}
.donut-legend{flex:1}
.leg-item{display:flex;align-items:center;gap:16px;padding:16px 0}
.leg-item+.leg-item{border-top:1px solid var(--rule)}
.leg-dot{width:16px;height:16px;border-radius:5px;flex-shrink:0}
.leg-label{font-size:17px;font-weight:600;color:var(--ink2);flex:1}
.leg-score{font-size:24px;font-weight:900}
.leg-max{font-size:15px;font-weight:500;color:var(--ink4)}
.finds .item{display:flex;gap:16px;padding:16px 20px;border:1.5px solid var(--rule);border-radius:12px;margin-bottom:10px;align-items:center}
.finds .item-warn{border-color:var(--red25);background:var(--red04)}
.finds .num{width:36px;height:36px;background:var(--c08);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:var(--c);flex-shrink:0}
.finds .body{flex:1;min-width:0}
.finds .ttl{font-size:17px;font-weight:600;color:var(--ink)}
.finds .src{font-size:14px;color:var(--ink4);margin-top:3px}
.actions .act{display:flex;gap:20px;padding:24px 28px;border-left:4px solid var(--c);background:var(--c04);border-radius:0 14px 14px 0;margin-bottom:12px}
.actions .act-n{width:36px;height:36px;background:var(--c);color:var(--white);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:900;flex-shrink:0}
.actions .act-body{flex:1}
.actions .act-t{font-size:18px;font-weight:700;color:var(--ink)}
.actions .act-d{font-size:15px;color:var(--ink3);line-height:1.6;margin-top:4px}
.actions .act-impact{display:inline-block;font-size:14px;font-weight:700;color:var(--c);background:var(--c08);padding:5px 14px;border-radius:6px;margin-top:10px}
.proj{display:flex;align-items:center;padding:16px 0}
.proj-step{flex:1;text-align:center;padding:28px 16px;border-radius:16px}
.proj-now{background:var(--red04);border:1.5px solid var(--red15)}
.proj-mid{background:var(--amber08);border:1.5px solid var(--amber15)}
.proj-goal{background:var(--green08);border:1.5px solid var(--green15)}
.proj-label{font-size:13px;font-weight:700;color:var(--ink4);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
.proj-val{font-size:56px;font-weight:900;line-height:1;letter-spacing:-2px}
.proj-now .proj-val{color:var(--red)}.proj-mid .proj-val{color:var(--amber)}.proj-goal .proj-val{color:var(--green)}
.proj-grade{font-size:16px;font-weight:600;margin-top:6px}
.proj-now .proj-grade{color:var(--red80)}.proj-mid .proj-grade{color:var(--amber)}.proj-goal .proj-grade{color:var(--green)}
.proj-arrow{width:56px;text-align:center}
.proj-arrow svg{width:24px;height:24px;color:var(--ink4)}
.foot{text-align:center;margin:56px 48px 0;padding-top:32px;border-top:1px solid var(--rule)}
.foot-brand{font-size:14px;font-weight:900;letter-spacing:3px;color:var(--c)}
.foot-info{font-size:14px;color:var(--ink4);margin-top:8px}
@media print{body{background:#fff}.rpt{padding:20px 0}}`;
}

// ─── Main export ───

export function generateReportHTML(data: ReportHTMLInput): string {
  const sections = [
    renderHeader(data),
    renderHero(data),
    renderPlatformScores(data),
    renderHighlightAndAlert(data),
    renderDonut(data),
    `<hr class="divider"/>`,
    renderChannelStatus(data),
    renderNaverBreakdown(data),
    renderBlogFindings(data),
    `<hr class="divider"/>`,
    renderGoogleBreakdown(data),
    `<hr class="divider"/>`,
    renderImprovements(data),
    `<hr class="divider"/>`,
    renderProjection(data),
    renderAIResults(data).length > 0
      ? `<hr class="divider"/>${renderAIResults(data)}`
      : "",
    // Disclaimer
    `<div style="margin:36px 48px 0;padding:16px 24px;background:var(--bg);border:1px solid var(--rule);border-radius:10px;text-align:center"><p style="font-size:13px;color:var(--ink4);line-height:1.6">※ 본 분석은 상호명만으로 자동 분석되어 실제와 다를 수 있습니다. 참고용으로 활용해주세요.</p></div>`,
    // Footer
    `<footer class="foot"><div class="foot-brand">POLARAD</div><div class="foot-info">Brand Presence Diagnostic · polarad.co.kr · 010-9897-9834</div></footer>`,
  ].filter(Boolean);

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${data.businessName} — Brand Presence Diagnostic</title>
<style>${getCSS()}</style>
</head>
<body>
<div class="rpt">
${sections.join("\n")}
</div>
</body>
</html>`;
}
