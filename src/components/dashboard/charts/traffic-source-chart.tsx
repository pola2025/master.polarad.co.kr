"use client"

import { Pie, PieChart, Cell } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"

interface TrafficSourceChartProps {
  data?: Array<{
    source: string
    visitors: number
  }>
}

// 빈 기본 데이터 (API 연동 전까지 빈 상태)
const defaultData: Array<{ source: string; visitors: number }> = []

const chartConfig = {
  visitors: {
    label: "방문자",
  },
  direct: {
    label: "직접 유입",
    color: "#1e40af",
  },
  organic: {
    label: "검색 유입",
    color: "#2563eb",
  },
  referral: {
    label: "외부 링크",
    color: "#3b82f6",
  },
  social: {
    label: "소셜 미디어",
    color: "#60a5fa",
  },
  paid: {
    label: "유료 광고",
    color: "#93c5fd",
  },
  email: {
    label: "이메일",
    color: "#bfdbfe",
  },
} satisfies ChartConfig

export function TrafficSourceChart({ data = defaultData }: TrafficSourceChartProps) {
  // 데이터에 fill 색상 추가
  const chartData = data.map((item) => ({
    ...item,
    fill: `var(--color-${item.source})`,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>유입 경로</CardTitle>
        <CardDescription>채널별 방문자 분포</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="visitors"
              nameKey="source"
              innerRadius={60}
              strokeWidth={5}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <ChartLegend
              content={<ChartLegendContent nameKey="source" />}
              className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
            />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
