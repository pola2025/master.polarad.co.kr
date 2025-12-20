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

const defaultData = [
  { path: "/", title: "홈", views: 1234, avgTime: "2:34" },
  { path: "/service", title: "서비스 소개", views: 856, avgTime: "3:12" },
  { path: "/marketing-news", title: "마케팅 뉴스", views: 623, avgTime: "4:21" },
  { path: "/contact", title: "문의하기", views: 412, avgTime: "1:45" },
  { path: "/portfolio", title: "포트폴리오", views: 287, avgTime: "2:58" },
]

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
