"use client";

import { useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Grid3x3, Users, Eye } from "lucide-react";
import type { DailyVisitorData } from "@/types/analytics";

interface VisitorHeatmapProps {
  daily: DailyVisitorData[];
  loading?: boolean;
}

type MetricType = "visitors" | "pageviews";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function getColor(value: number, max: number, metric: MetricType): string {
  if (value === 0) return "bg-gray-100 dark:bg-gray-800";
  const ratio = value / max;
  if (metric === "visitors") {
    if (ratio > 0.75) return "bg-blue-600 text-white";
    if (ratio > 0.5) return "bg-blue-400 text-white";
    if (ratio > 0.25) return "bg-blue-300";
    return "bg-blue-100";
  }
  if (ratio > 0.75) return "bg-emerald-600 text-white";
  if (ratio > 0.5) return "bg-emerald-400 text-white";
  if (ratio > 0.25) return "bg-emerald-300";
  return "bg-emerald-100";
}

export function VisitorHeatmap({ daily, loading }: VisitorHeatmapProps) {
  const [metric, setMetric] = useState<MetricType>("visitors");

  // 데이터를 날짜별 맵으로 변환
  const dataMap = useMemo(() => {
    const map = new Map<string, DailyVisitorData>();
    daily.forEach((d) => map.set(d.date, d));
    return map;
  }, [daily]);

  // 히트맵 그리드 생성 (최근 12주)
  const { weeks, maxValue, monthLabels } = useMemo(() => {
    if (daily.length === 0) return { weeks: [], maxValue: 0, monthLabels: [] };

    // 최근 날짜부터 12주(84일) 전까지
    const sortedDates = [...daily].sort((a, b) => b.date.localeCompare(a.date));
    const endDate = new Date(sortedDates[0].date);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 83); // 12주 = 84일

    // 시작일을 일요일로 맞춤
    const dayOfWeek = startDate.getDay();
    startDate.setDate(startDate.getDate() - dayOfWeek);

    const weeksArr: Array<
      Array<{ date: string; value: number; dayOfWeek: number }>
    > = [];
    let currentWeek: Array<{ date: string; value: number; dayOfWeek: number }> =
      [];
    let mv = 0;
    const mLabels: Array<{ weekIndex: number; label: string }> = [];
    let lastMonth = "";

    const current = new Date(startDate);
    let weekIdx = 0;

    while (current <= endDate) {
      const dateStr = current.toISOString().split("T")[0];
      const data = dataMap.get(dateStr);
      const value = data
        ? metric === "visitors"
          ? data.visitors
          : data.pageviews
        : 0;
      if (value > mv) mv = value;

      const monthKey = dateStr.substring(0, 7);
      if (monthKey !== lastMonth) {
        const [, m] = monthKey.split("-");
        mLabels.push({ weekIndex: weekIdx, label: `${parseInt(m)}월` });
        lastMonth = monthKey;
      }

      currentWeek.push({ date: dateStr, value, dayOfWeek: current.getDay() });

      if (current.getDay() === 6) {
        weeksArr.push(currentWeek);
        currentWeek = [];
        weekIdx++;
      }

      current.setDate(current.getDate() + 1);
    }

    if (currentWeek.length > 0) {
      weeksArr.push(currentWeek);
    }

    return { weeks: weeksArr, maxValue: mv, monthLabels: mLabels };
  }, [daily, dataMap, metric]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3x3 className="h-5 w-5" />
            방문 히트맵
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (daily.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3x3 className="h-5 w-5" />
            방문 히트맵
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            데이터가 없습니다.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Grid3x3 className="h-5 w-5" />
            방문 히트맵
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={metric === "visitors" ? "default" : "secondary"}
              size="sm"
              onClick={() => setMetric("visitors")}
              className="text-xs px-2"
            >
              <Users className="h-3 w-3 mr-1" />
              방문자
            </Button>
            <Button
              variant={metric === "pageviews" ? "default" : "secondary"}
              size="sm"
              onClick={() => setMetric("pageviews")}
              className="text-xs px-2"
            >
              <Eye className="h-3 w-3 mr-1" />
              페이지뷰
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {/* 월 레이블 */}
          <div className="flex mb-1 ml-8">
            {monthLabels.map((ml, i) => (
              <div
                key={i}
                className="text-xs text-muted-foreground"
                style={{
                  position: "relative",
                  left: `${ml.weekIndex * 18}px`,
                  marginRight:
                    i < monthLabels.length - 1
                      ? `${((monthLabels[i + 1]?.weekIndex || 0) - ml.weekIndex) * 18 - 30}px`
                      : 0,
                }}
              >
                {ml.label}
              </div>
            ))}
          </div>

          <div className="flex gap-0.5">
            {/* 요일 레이블 */}
            <div className="flex flex-col gap-0.5 mr-1">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="h-[16px] text-[10px] text-muted-foreground flex items-center justify-end pr-1"
                  style={{ width: "24px" }}
                >
                  {i % 2 === 1 ? label : ""}
                </div>
              ))}
            </div>

            {/* 히트맵 그리드 */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {Array.from({ length: 7 }, (_, di) => {
                  const cell = week.find((c) => c.dayOfWeek === di);
                  if (!cell) {
                    return <div key={di} className="w-[16px] h-[16px]" />;
                  }
                  const colorClass = getColor(cell.value, maxValue, metric);
                  const dateFormatted = cell.date.slice(5).replace("-", "/");
                  return (
                    <div
                      key={di}
                      className={`w-[16px] h-[16px] rounded-[3px] ${colorClass} cursor-default transition-transform hover:scale-125`}
                      title={`${dateFormatted}: ${metric === "visitors" ? "방문자" : "페이지뷰"} ${cell.value.toLocaleString()}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* 범례 */}
          <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
            <span>적음</span>
            <div className="flex gap-0.5">
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const mockValue = ratio === 0 ? 0 : Math.ceil(maxValue * ratio);
                return (
                  <div
                    key={ratio}
                    className={`w-[14px] h-[14px] rounded-[2px] ${getColor(mockValue, maxValue, metric)}`}
                  />
                );
              })}
            </div>
            <span>많음</span>
            <span className="ml-2 text-muted-foreground">
              최대: {maxValue.toLocaleString()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
