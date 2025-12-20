"use client"

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
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

interface VisitorChartProps {
  data?: Array<{
    date: string
    visitors: number
    pageviews: number
  }>
}

const defaultData = [
  { date: "12/14", visitors: 186, pageviews: 312 },
  { date: "12/15", visitors: 305, pageviews: 521 },
  { date: "12/16", visitors: 237, pageviews: 408 },
  { date: "12/17", visitors: 173, pageviews: 289 },
  { date: "12/18", visitors: 209, pageviews: 367 },
  { date: "12/19", visitors: 264, pageviews: 445 },
  { date: "12/20", visitors: 198, pageviews: 334 },
]

const chartConfig = {
  visitors: {
    label: "방문자",
    color: "#2563eb",
  },
  pageviews: {
    label: "페이지뷰",
    color: "#60a5fa",
  },
} satisfies ChartConfig

export function VisitorChart({ data = defaultData }: VisitorChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>방문 추이</CardTitle>
        <CardDescription>최근 7일간 방문자 및 페이지뷰</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart
            accessibilityLayer
            data={data}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={40}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="pageviews"
              type="natural"
              fill="var(--color-pageviews)"
              fillOpacity={0.4}
              stroke="var(--color-pageviews)"
              stackId="a"
            />
            <Area
              dataKey="visitors"
              type="natural"
              fill="var(--color-visitors)"
              fillOpacity={0.4}
              stroke="var(--color-visitors)"
              stackId="b"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
