"use client";

import { Bar, BarChart, XAxis, YAxis, Pie, PieChart, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { CheckCircle2, XCircle, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Type Definitions ───

interface NaverSearchData {
  totalCounts: {
    web: number;
    blog: number;
    cafe: number;
    news: number;
    local: number;
  };
  score: number;
  scoreBreakdown: {
    officialWebsite: number;
    blogMentions: number;
    localRegistration: number;
    newsCoverage: number;
    cafeMentions: number;
    brandContent: number;
  };
}

interface GoogleSearchData {
  isIndexed: boolean;
  topRankPosition: number | null;
  hasGoogleBusiness: boolean;
  hasReviews: boolean;
  hasImageResults: boolean;
  reviewCount: number;
  avgRating: number;
  score: number;
  scoreBreakdown: {
    indexed: number;
    topRank: number;
    googleBusiness: number;
    reviews: number;
    imagePresence: number;
  };
}

interface AIModelData {
  model: string;
  knows: boolean;
  accurate: boolean;
  response: string;
  details: {
    nameCorrect: boolean;
    industryCorrect: boolean;
    locationMentioned: boolean;
    descriptionAccurate: boolean;
  };
  error?: string;
}

interface AISearchData {
  models: AIModelData[];
  score: number;
  summary: string;
}

// ─── Helpers ───

function scoreColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.7) return "#22c55e";
  if (pct >= 0.4) return "#eab308";
  return "#ef4444";
}

function StatusIcon({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-5 w-5 text-green-500" />
  ) : (
    <XCircle className="h-5 w-5 text-red-400" />
  );
}

// ─── 0. Action Items (핵심 조치 사항) ───

export function ActionItems({
  naverData,
  googleData,
}: {
  naverData: Record<string, unknown> | null;
  googleData: Record<string, unknown> | null;
}) {
  const naver = naverData as unknown as NaverSearchData | null;
  const google = googleData as unknown as GoogleSearchData | null;

  const actions: { action: string; reason: string }[] = [];

  if (naver?.scoreBreakdown) {
    if (naver.scoreBreakdown.officialWebsite === 0) {
      actions.push({
        action: "공식 홈페이지 개설 및 네이버 서치어드바이저 등록",
        reason: "네이버 검색에 공식 사이트 미노출",
      });
    }
    if (naver.scoreBreakdown.brandContent === 0) {
      actions.push({
        action: "공식 블로그 개설 및 정기 포스팅",
        reason: "브랜드 자체 콘텐츠 부재",
      });
    }
    if (naver.scoreBreakdown.blogMentions < 15) {
      actions.push({
        action: "지역명 키워드 블로그 포스팅 (예: OO동+업종)",
        reason: "지역 검색 노출 부족",
      });
    }
    if (naver.scoreBreakdown.localRegistration === 0) {
      actions.push({
        action: "네이버 플레이스 등록",
        reason: "지도 검색 미노출",
      });
    }
  }

  if (google) {
    if (!google.hasGoogleBusiness) {
      actions.push({
        action: "구글 비즈니스 프로필 등록",
        reason: "구글 지도 미등록, 리뷰 수집 불가",
      });
    }
    if (google.topRankPosition === null || google.topRankPosition > 5) {
      actions.push({
        action: "구글 SEO 최적화 (사이트맵, 메타태그)",
        reason: "구글 검색 상위 노출 미비",
      });
    }
  }

  if (actions.length === 0) return null;

  return (
    <Card className="border-orange-200 bg-orange-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-orange-800">
          핵심 조치 사항
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {actions.slice(0, 5).map((item, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="text-xs font-bold text-orange-600 bg-orange-100 rounded px-1.5 py-0.5 shrink-0">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {item.action}
                </p>
                <p className="text-xs text-gray-500">{item.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 1. Channel Status (보유/미비 분리) ───

export function ChannelStatusGrid({
  data,
}: {
  data: Record<string, unknown> | null;
}) {
  if (!data) return null;
  const d = data as unknown as NaverSearchData;
  if (!d.scoreBreakdown) return null;

  const channels = [
    { label: "공식 홈페이지", ok: d.scoreBreakdown.officialWebsite > 0 },
    { label: "플레이스 등록", ok: d.scoreBreakdown.localRegistration > 0 },
    { label: "블로그 노출", ok: d.scoreBreakdown.blogMentions > 0 },
    { label: "브랜드 콘텐츠", ok: d.scoreBreakdown.brandContent > 0 },
  ];

  const good = channels.filter((c) => c.ok);
  const bad = channels.filter((c) => !c.ok);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">채널 보유 현황</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {good.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 w-8 shrink-0">
              보유
            </span>
            <div className="flex flex-wrap gap-1.5">
              {good.map((ch) => (
                <span
                  key={ch.label}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-green-50 text-green-700 border border-green-200"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {ch.label}
                </span>
              ))}
            </div>
          </div>
        )}
        {bad.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 w-8 shrink-0">
              미비
            </span>
            <div className="flex flex-wrap gap-1.5">
              {bad.map((ch) => (
                <span
                  key={ch.label}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded bg-red-50 text-red-600 border border-red-200"
                >
                  <XCircle className="h-3 w-3" />
                  {ch.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── 2. Naver Breakdown Chart ───

const naverCategories = [
  { key: "officialWebsite", label: "공식 웹사이트", max: 20 },
  { key: "blogMentions", label: "블로그 언급", max: 20 },
  { key: "localRegistration", label: "플레이스", max: 20 },
  { key: "newsCoverage", label: "뉴스 보도", max: 15 },
  { key: "cafeMentions", label: "카페 언급", max: 10 },
  { key: "brandContent", label: "브랜드 콘텐츠", max: 15 },
] as const;

const naverChartConfig = {
  score: { label: "점수" },
} satisfies ChartConfig;

export function NaverBreakdownChart({
  data,
}: {
  data: Record<string, unknown> | null;
}) {
  if (!data) return null;
  const d = data as unknown as NaverSearchData;
  if (!d.scoreBreakdown) return null;

  const chartData = naverCategories.map((cat) => ({
    category: cat.label,
    score: d.scoreBreakdown[cat.key],
    max: cat.max,
    fill: scoreColor(d.scoreBreakdown[cat.key], cat.max),
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          네이버 세부 진단
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            {d.score}/100점
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={naverChartConfig} className="h-[240px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: 10, right: 40 }}
          >
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              tickMargin={8}
              axisLine={false}
              width={90}
              tick={{ fontSize: 12 }}
            />
            <XAxis type="number" hide domain={[0, 20]} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) =>
                    `${value}/${item.payload.max}점`
                  }
                />
              }
            />
            <Bar dataKey="score" radius={4} barSize={16} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// ─── 3. Google Breakdown Chart ───

const googleCategories = [
  { key: "indexed", label: "인덱싱", max: 25 },
  { key: "topRank", label: "검색 순위", max: 25 },
  { key: "googleBusiness", label: "비즈니스 프로필", max: 25 },
  { key: "reviews", label: "리뷰", max: 15 },
  { key: "imagePresence", label: "이미지 검색", max: 10 },
] as const;

const googleChartConfig = {
  score: { label: "점수" },
} satisfies ChartConfig;

export function GoogleBreakdownChart({
  data,
}: {
  data: Record<string, unknown> | null;
}) {
  if (!data) return null;
  const d = data as unknown as GoogleSearchData;
  if (!d.scoreBreakdown) return null;

  const chartData = googleCategories.map((cat) => ({
    category: cat.label,
    score: d.scoreBreakdown[cat.key],
    max: cat.max,
    fill: scoreColor(d.scoreBreakdown[cat.key], cat.max),
  }));

  const statusItems = [
    { label: "인덱싱", ok: d.isIndexed },
    { label: "비즈니스", ok: d.hasGoogleBusiness },
    { label: "리뷰", ok: d.hasReviews },
    { label: "이미지", ok: d.hasImageResults },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          구글 세부 진단
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            {d.score}/100점
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <ChartContainer config={googleChartConfig} className="h-[210px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{ left: 10, right: 40 }}
          >
            <YAxis
              dataKey="category"
              type="category"
              tickLine={false}
              tickMargin={8}
              axisLine={false}
              width={100}
              tick={{ fontSize: 12 }}
            />
            <XAxis type="number" hide domain={[0, 25]} />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) =>
                    `${value}/${item.payload.max}점`
                  }
                />
              }
            />
            <Bar dataKey="score" radius={4} barSize={16} />
          </BarChart>
        </ChartContainer>

        <div className="flex flex-wrap gap-2">
          {statusItems.map((item) => (
            <Badge
              key={item.label}
              variant="outline"
              className={
                item.ok
                  ? "border-green-300 text-green-700"
                  : "border-red-300 text-red-500"
              }
            >
              <StatusIcon ok={item.ok} />
              <span className="ml-1 text-xs">{item.label}</span>
            </Badge>
          ))}
          {d.topRankPosition !== null && (
            <Badge variant="outline" className="border-blue-300 text-blue-700">
              <span className="text-xs">순위 {d.topRankPosition}위</span>
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 4. Platform Balance (Donut) ───

const platformChartConfig = {
  score: { label: "점수" },
  naver: { label: "네이버", color: "#22c55e" },
  google: { label: "구글", color: "#3b82f6" },
} satisfies ChartConfig;

export function PlatformBalance({
  naverData,
  googleData,
  overallScore,
}: {
  naverData: Record<string, unknown> | null;
  googleData: Record<string, unknown> | null;
  overallScore: number | null;
}) {
  if (!naverData || !googleData) return null;
  const naver = naverData as unknown as NaverSearchData;
  const google = googleData as unknown as GoogleSearchData;
  if (naver.score == null || google.score == null) return null;

  const chartData = [
    { platform: "naver", score: naver.score, fill: "var(--color-naver)" },
    { platform: "google", score: google.score, fill: "var(--color-google)" },
  ];

  const diff = Math.abs(naver.score - google.score);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">플랫폼 균형</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          <ChartContainer
            config={platformChartConfig}
            className="h-[160px] w-[160px] shrink-0"
          >
            <PieChart>
              <Pie
                data={chartData}
                dataKey="score"
                nameKey="platform"
                innerRadius={45}
                outerRadius={70}
                strokeWidth={3}
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
            </PieChart>
          </ChartContainer>

          <div className="space-y-2 text-sm">
            {overallScore !== null && (
              <div className="text-2xl font-bold">{overallScore}점</div>
            )}
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              <span>네이버 {naver.score}점</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              <span>구글 {google.score}점</span>
            </div>
            <div className="text-xs text-muted-foreground">
              플랫폼 격차 {diff}점
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── 5. AI Search Cards ───

export function AISearchCards({
  data,
}: {
  data: Record<string, unknown> | null;
}) {
  if (!data) return null;
  const d = data as unknown as AISearchData;
  if (!d.models || d.models.length === 0) return null;

  const detailLabels: Record<string, string> = {
    nameCorrect: "상호명",
    industryCorrect: "업종",
    locationMentioned: "위치",
    descriptionAccurate: "설명",
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Globe className="h-4 w-4" />
          외부 플랫폼 인지도
          <span className="ml-1 text-xs text-muted-foreground font-normal">
            {d.score}/100점
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {d.summary && (
          <p className="text-xs text-muted-foreground mb-3">{d.summary}</p>
        )}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {d.models.map((m) => (
            <div key={m.model} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{m.model}</span>
                {m.error ? (
                  <Badge variant="outline" className="text-xs border-gray-300">
                    오류
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className={
                      m.knows
                        ? "text-xs border-green-300 text-green-700"
                        : "text-xs border-red-300 text-red-500"
                    }
                  >
                    {m.knows ? "인지됨" : "미인지"}
                  </Badge>
                )}
              </div>
              {!m.error && m.details && (
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(detailLabels).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-1 text-xs">
                      <StatusIcon
                        ok={m.details[key as keyof typeof m.details]}
                      />
                      <span className="text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              )}
              {m.response && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {m.response.substring(0, 100)}
                  {m.response.length > 100 ? "..." : ""}
                </p>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
