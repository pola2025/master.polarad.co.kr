"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Search,
  Loader2,
  RefreshCw,
  ChevronRight,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BrandReport {
  id: string;
  businessName: string;
  industry: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  naverScore: number | null;
  googleScore: number | null;
  overallScore: number | null;
  status: string;
  summary: string;
  inquiryDate: string | null;
  createdAt: string;
  sentAt: string | null;
}

const STATUS_TABS = [
  { value: "all", label: "전체" },
  { value: "pending", label: "분석대기" },
  { value: "analyzing", label: "분석중" },
  { value: "draft", label: "검토대기" },
  { value: "sent", label: "발송완료" },
  { value: "failed", label: "분석실패" },
  { value: "discarded", label: "폐기" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "분석대기",
  analyzing: "분석중",
  draft: "검토대기",
  reviewed: "검토완료",
  sent: "발송완료",
  discarded: "폐기",
};

function getStatusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-0">
          분석대기
        </Badge>
      );
    case "analyzing":
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">
          분석중
        </Badge>
      );
    case "draft":
      return (
        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-0">
          검토대기
        </Badge>
      );
    case "reviewed":
      return (
        <Badge variant="outline" className="border-green-300 text-green-700">
          검토완료
        </Badge>
      );
    case "sent":
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">
          발송완료
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">
          분석실패
        </Badge>
      );
    case "discarded":
      return <Badge variant="secondary">폐기</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getScoreColor(score: number | null) {
  if (score === null) return "bg-muted";
  if (score <= 30) return "bg-red-500";
  if (score <= 60) return "bg-yellow-500";
  return "bg-green-500";
}

function getScoreTextColor(score: number | null) {
  if (score === null) return "text-muted-foreground";
  if (score <= 30) return "text-red-600";
  if (score <= 60) return "text-yellow-600";
  return "text-green-600";
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-[60px]">
        <div
          className={`h-full rounded-full ${getScoreColor(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span
        className={`text-sm font-semibold tabular-nums ${getScoreTextColor(score)}`}
      >
        {score}
      </span>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function BrandReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<BrandReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function fetchReports() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/brand-reports");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `서버 오류 (${res.status})`);
      }
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? `브랜드 리포트 데이터를 불러오지 못했습니다: ${err.message}`
          : "브랜드 리포트 데이터를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = reports.filter((report) => {
    if (statusFilter !== "all" && report.status !== statusFilter) return false;
    const q = searchQuery.toLowerCase();
    return (
      report.businessName.toLowerCase().includes(q) ||
      report.industry.toLowerCase().includes(q) ||
      report.contactName.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: reports.length,
    pending: reports.filter((r) => r.status === "pending").length,
    draft: reports.filter((r) => r.status === "draft").length,
    sent: reports.filter((r) => r.status === "sent").length,
    failed: reports.filter((r) => r.status === "failed").length,
    discarded: reports.filter((r) => r.status === "discarded").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            브랜드 분석 리포트
          </h1>
          <p className="text-muted-foreground">
            업체별 네이버·구글 브랜드 현황을 분석하고 리포트를 발송합니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchReports}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">분석 대기</CardTitle>
            <FileText className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {stats.pending}
            </div>
            <p className="text-xs text-muted-foreground">분석 시작 필요</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">검토 대기</CardTitle>
            <FileText className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {stats.draft}
            </div>
            <p className="text-xs text-muted-foreground">발송 전 검토 필요</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">발송 완료</CardTitle>
            <BarChart3 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.sent}
            </div>
            <p className="text-xs text-muted-foreground">고객에게 발송됨</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">분석 실패</CardTitle>
            <BarChart3 className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.failed}
            </div>
            <p className="text-xs text-muted-foreground">재분석 필요</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">폐기</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">
              {stats.discarded}
            </div>
            <p className="text-xs text-muted-foreground">폐기된 리포트</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 목록 */}
      <div className="space-y-4">
        <div className="flex gap-2 items-center">
          <div className="flex gap-1">
            {STATUS_TABS.map((tab) => (
              <Button
                key={tab.value}
                variant={statusFilter === tab.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="업체명, 업종, 담당자 검색..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">
                  {searchQuery || statusFilter !== "all"
                    ? "검색 결과가 없습니다"
                    : "브랜드 리포트가 없습니다"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  문의 관리에서 브랜드 분석 생성 버튼으로 리포트를 생성하세요.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>업체명</TableHead>
                    <TableHead>업종</TableHead>
                    <TableHead className="min-w-[140px]">종합점수</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>접수일</TableHead>
                    <TableHead className="w-[30px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow
                      key={report.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/brand-reports/${report.id}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{report.businessName}</div>
                        {report.contactName && (
                          <div className="text-xs text-muted-foreground">
                            {report.contactName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {report.industry || "-"}
                      </TableCell>
                      <TableCell>
                        <ScoreBar score={report.overallScore} />
                      </TableCell>
                      <TableCell>{getStatusBadge(report.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(report.inquiryDate || report.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
