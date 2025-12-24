"use client"

import { Bar, BarChart, XAxis, YAxis } from "recharts"
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
} from "@/components/ui/chart"

interface DeviceChartProps {
  data?: Array<{
    device: string
    visitors: number
  }>
}

// 빈 기본 데이터 (API 연동 전까지 빈 상태)
const defaultData: Array<{ device: string; visitors: number }> = []

const chartConfig = {
  visitors: {
    label: "방문자",
  },
  mobile: {
    label: "모바일",
    color: "#1e40af",
  },
  desktop: {
    label: "데스크톱",
    color: "#2563eb",
  },
  tablet: {
    label: "태블릿",
    color: "#60a5fa",
  },
} satisfies ChartConfig

export function DeviceChart({ data = defaultData }: DeviceChartProps) {
  // 데이터에 fill 색상 추가
  const chartData = data.map((item) => ({
    ...item,
    fill: `var(--color-${item.device})`,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>기기별 분포</CardTitle>
        <CardDescription>디바이스 유형별 방문자</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <BarChart
            accessibilityLayer
            data={chartData}
            layout="vertical"
            margin={{
              left: 20,
            }}
          >
            <YAxis
              dataKey="device"
              type="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) =>
                chartConfig[value as keyof typeof chartConfig]?.label || value
              }
            />
            <XAxis dataKey="visitors" type="number" hide />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Bar dataKey="visitors" layout="vertical" radius={5} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
