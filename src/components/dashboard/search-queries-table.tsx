import { Search, TrendingUp, Eye, MousePointer } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface SearchQuery {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface SearchQueriesTableProps {
  data?: SearchQuery[]
  totalClicks?: number
  totalImpressions?: number
  avgCtr?: number
  avgPosition?: number
}

const defaultData: SearchQuery[] = [
  { query: "온라인 마케팅", clicks: 45, impressions: 890, ctr: 5.1, position: 8.2 },
  { query: "법인 영업", clicks: 38, impressions: 720, ctr: 5.3, position: 6.5 },
  { query: "DB 마케팅", clicks: 32, impressions: 580, ctr: 5.5, position: 7.8 },
  { query: "리드 제너레이션", clicks: 28, impressions: 450, ctr: 6.2, position: 5.3 },
  { query: "메타 광고 대행", clicks: 25, impressions: 410, ctr: 6.1, position: 9.1 },
]

function getPositionBadgeColor(position: number): string {
  if (position <= 3) return "bg-green-100 text-green-700 border-green-200"
  if (position <= 10) return "bg-blue-100 text-blue-700 border-blue-200"
  if (position <= 20) return "bg-yellow-100 text-yellow-700 border-yellow-200"
  return "bg-gray-100 text-gray-700 border-gray-200"
}

export function SearchQueriesTable({
  data = defaultData,
  totalClicks = 245,
  totalImpressions = 4500,
  avgCtr = 5.4,
  avgPosition = 10.9,
}: SearchQueriesTableProps) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              유입 검색어
            </CardTitle>
            <CardDescription>Google Search Console 기준 최근 7일</CardDescription>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <MousePointer className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">클릭</span>
              <span className="font-semibold">{totalClicks.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">노출</span>
              <span className="font-semibold">{totalImpressions.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">평균순위</span>
              <span className="font-semibold">{avgPosition.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>검색어</TableHead>
              <TableHead className="text-right">클릭</TableHead>
              <TableHead className="text-right">노출</TableHead>
              <TableHead className="text-right">CTR</TableHead>
              <TableHead className="text-right">순위</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 10).map((item, index) => (
              <TableRow key={item.query}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs w-4">
                      {index + 1}
                    </span>
                    <span className="font-medium">{item.query}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {item.clicks.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.impressions.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {item.ctr.toFixed(1)}%
                </TableCell>
                <TableCell className="text-right">
                  <Badge
                    variant="outline"
                    className={getPositionBadgeColor(item.position)}
                  >
                    {item.position.toFixed(1)}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
