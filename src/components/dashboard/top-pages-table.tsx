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

interface TopPagesTableProps {
  data?: Array<{
    path: string
    title: string
    views: number
    avgTime: string
  }>
}

// 빈 기본 데이터 (API 연동 전까지 빈 상태)
const defaultData: Array<{ path: string; title: string; views: number; avgTime: string }> = []

export function TopPagesTable({ data = defaultData }: TopPagesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>인기 페이지</CardTitle>
        <CardDescription>페이지별 조회수 Top 5</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>페이지</TableHead>
              <TableHead className="text-right">조회수</TableHead>
              <TableHead className="text-right">평균 체류</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((page) => (
              <TableRow key={page.path}>
                <TableCell>
                  <div className="font-medium">{page.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {page.path}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {page.views.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {page.avgTime}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
