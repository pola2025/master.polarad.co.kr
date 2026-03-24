"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Send,
  Trash2,
  RefreshCw,
  Eye,
  Save,
  ChevronDown,
  ChevronUp,
  Mail,
  Phone,
  Building,
  Tag,
  Play,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ChannelStatusGrid,
  NaverBreakdownChart,
  GoogleBreakdownChart,
  PlatformBalance,
  AISearchCards,
} from "@/components/brand-reports/search-data-viz";

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
  reportContent: string;
  naverSearchData: Record<string, unknown> | null;
  googleSearchData: Record<string, unknown> | null;
  aiSearchData: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string | null;
  sentAt: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "분석대기",
  analyzing: "분석중",
  draft: "검토대기",
  reviewed: "검토완료",
  sent: "발송완료",
  discarded: "폐기",
  failed: "분석실패",
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
    case "discarded":
      return <Badge variant="secondary">폐기</Badge>;
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0">
          분석실패
        </Badge>
      );
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

function ScoreCard({ title, score }: { title: string; score: number | null }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {score === null ? (
          <div className="text-2xl font-bold text-muted-foreground">-</div>
        ) : (
          <>
            <div className={`text-3xl font-bold ${getScoreTextColor(score)}`}>
              {score}
              <span className="text-base font-normal text-muted-foreground ml-1">
                / 100
              </span>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${getScoreColor(score)}`}
                style={{ width: `${score}%` }}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function SimpleMarkdown({ content }: { content: string }) {
  const sections = content.split(/^(## .+)$/m).filter(Boolean);
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      {sections.map((section, i) => {
        if (section.startsWith("## ")) {
          return (
            <h2 key={i} className="text-base font-semibold mt-4 first:mt-0">
              {section.replace("## ", "")}
            </h2>
          );
        }
        const escaped = section
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        const rendered = escaped
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\n/g, "<br />");
        return (
          <p
            key={i}
            dangerouslySetInnerHTML={{ __html: rendered }}
            className="text-muted-foreground"
          />
        );
      })}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BrandReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [report, setReport] = useState<BrandReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editMode, setEditMode] = useState<"edit" | "preview" | "hidden">(
    "hidden",
  );
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [startingAnalysis, setStartingAnalysis] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);

  async function fetchReport() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/brand-reports/${id}`);
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      setReport(data.report);
      setContent(data.report.reportContent || "");
      setIsDirty(false);
    } catch {
      setError("리포트를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReport();
  }, [id]);

  useEffect(() => {
    if (report?.status !== "analyzing") return;
    const interval = setInterval(() => fetchReport(), 5000);
    return () => clearInterval(interval);
  }, [report?.status]);

  async function handleSave() {
    if (!report) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/brand-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportContent: content }),
      });
      if (!res.ok) throw new Error();
      await fetchReport();
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!report) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/brand-reports/${id}/send`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      setShowSendDialog(false);
      await fetchReport();
    } catch {
      setError("발송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  }

  async function handleDiscard() {
    setDiscarding(true);
    setError("");
    try {
      const res = await fetch(`/api/brand-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "discarded" }),
      });
      if (!res.ok) throw new Error();
      router.push("/brand-reports");
    } catch {
      setError("폐기에 실패했습니다.");
      setDiscarding(false);
    }
  }

  async function handleStartAnalysis() {
    setStartingAnalysis(true);
    setError("");
    try {
      const res = await fetch(`/api/brand-reports/${id}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      await fetchReport();
    } catch {
      setError("분석 시작에 실패했습니다.");
    } finally {
      setStartingAnalysis(false);
    }
  }

  async function handleRegenerate() {
    setRegenerating(true);
    setError("");
    try {
      const res = await fetch(`/api/brand-reports/${id}/regenerate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
      await fetchReport();
    } catch {
      setError("재분석에 실패했습니다.");
    } finally {
      setRegenerating(false);
    }
  }

  const canSend =
    report &&
    (report.status === "draft" || report.status === "reviewed") &&
    !!report.contactEmail;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          돌아가기
        </Button>
        <Alert variant="destructive">
          <AlertDescription>
            {error || "리포트를 찾을 수 없습니다."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/brand-reports")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            목록
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{report.businessName}</h1>
            {getStatusBadge(report.status)}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDirty && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              저장
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            재분석
          </Button>

          {canSend && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  window.open(`/api/brand-reports/${id}/preview`, "_blank")
                }
              >
                <Eye className="h-4 w-4 mr-2" />
                미리보기
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowSendDialog(true)}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                발송
              </Button>
            </>
          )}

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={discarding || report.status === "discarded"}
              >
                {discarding ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                폐기
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>리포트를 폐기하시겠습니까?</AlertDialogTitle>
                <AlertDialogDescription>
                  {report.businessName}의 브랜드 분석 리포트가 영구적으로
                  삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>취소</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDiscard}
                  disabled={discarding}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {discarding ? "폐기 중..." : "폐기"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 분석 대기 배너 */}
      {report.status === "pending" && (
        <Alert className="border-orange-200 bg-orange-50">
          <Play className="h-4 w-4 text-orange-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-orange-800">
              분석 대기 중입니다. 분석을 시작하면 네이버·구글 검색 데이터를
              수집하고 리포트를 생성합니다.
            </span>
            <Button
              size="sm"
              className="ml-4 shrink-0 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleStartAnalysis}
              disabled={startingAnalysis}
            >
              {startingAnalysis ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              분석 시작
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 분석 실패 배너 */}
      {report.status === "failed" && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-red-800">
              분석에 실패했습니다. 재분석을 실행하거나 업체명·업종 정보를
              확인하세요.
              {report.summary && (
                <span className="block mt-1 text-xs text-red-600">
                  {report.summary}
                </span>
              )}
            </span>
            <Button
              size="sm"
              className="ml-4 shrink-0 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              {regenerating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              재분석
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 발송 확인 다이얼로그 */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>리포트 발송 확인</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              아래 이메일로 리포트(HTML 첨부)를 발송합니다.
            </p>
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{report.contactEmail}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              발송 전 미리보기를 확인하셨나요?{" "}
              <a
                href={`/api/brand-reports/${id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                새 탭에서 미리보기 열기
              </a>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowSendDialog(false)}
              >
                취소
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                발송
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 정보 카드 3열 */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* 업체 정보 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              업체 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Building className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-medium">{report.businessName}</span>
            </div>
            {report.industry && (
              <div className="flex items-center gap-2 text-sm">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{report.industry}</span>
              </div>
            )}
            {report.contactName && (
              <div className="flex items-center gap-2 text-sm">
                <span className="h-4 w-4 text-muted-foreground shrink-0 text-center text-xs">
                  이름
                </span>
                <span>{report.contactName}</span>
              </div>
            )}
            {report.contactPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`tel:${report.contactPhone}`}
                  className="hover:underline"
                >
                  {report.contactPhone}
                </a>
              </div>
            )}
            {report.contactEmail && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${report.contactEmail}`}
                  className="text-blue-600 hover:underline truncate"
                >
                  {report.contactEmail}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <ScoreCard title="네이버 점수" score={report.naverScore} />
        <ScoreCard title="구글 점수" score={report.googleScore} />
      </div>

      {/* 종합 점수 */}
      <Card>
        <CardContent className="py-6 flex flex-col items-center gap-3">
          <p className="text-sm font-medium text-muted-foreground">종합 점수</p>
          {report.overallScore === null ? (
            <div className="text-4xl font-bold text-muted-foreground">-</div>
          ) : (
            <>
              <div
                className={`text-5xl font-bold ${getScoreTextColor(report.overallScore)}`}
              >
                {report.overallScore}
              </div>
              <div className="w-full max-w-xs h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getScoreColor(report.overallScore)}`}
                  style={{ width: `${report.overallScore}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">/ 100점</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 구조화 시각화 리포트 */}
      {(report.naverSearchData ||
        report.googleSearchData ||
        report.aiSearchData) && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
            본 데이터는 상호명 기반으로 공개된 검색 결과를 수집·분석한 것으로,
            수집 시점이나 검색 환경에 따라 실제와 다를 수 있습니다.
          </p>

          {report.naverSearchData && (
            <ChannelStatusGrid data={report.naverSearchData} />
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {report.naverSearchData && (
              <NaverBreakdownChart data={report.naverSearchData} />
            )}
            {report.googleSearchData && (
              <GoogleBreakdownChart data={report.googleSearchData} />
            )}
          </div>

          {report.naverSearchData && report.googleSearchData && (
            <PlatformBalance
              naverData={report.naverSearchData}
              googleData={report.googleSearchData}
              overallScore={report.overallScore}
            />
          )}

          {report.aiSearchData && <AISearchCards data={report.aiSearchData} />}
        </div>
      )}

      {/* 리포트 원문 (접기/펼치기) */}
      <Card>
        <button
          type="button"
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          onClick={() =>
            setEditMode(editMode === "hidden" ? "preview" : "hidden")
          }
        >
          <span>리포트 원문</span>
          {editMode === "hidden" ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {editMode !== "hidden" && (
          <CardContent className="pt-0">
            <div className="flex justify-end gap-1 mb-3">
              <Button
                variant={editMode === "preview" ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode("preview")}
              >
                보기
              </Button>
              <Button
                variant={editMode === "edit" ? "default" : "outline"}
                size="sm"
                onClick={() => setEditMode("edit")}
              >
                편집
              </Button>
            </div>
            {editMode === "edit" ? (
              <div className="space-y-3">
                <textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setIsDirty(true);
                  }}
                  className="w-full min-h-[400px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="마크다운 형식으로 리포트 내용을 작성하세요..."
                />
                {isDirty && (
                  <div className="flex justify-end">
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      저장
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="min-h-[100px]">
                {content ? (
                  <SimpleMarkdown content={content} />
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    리포트 내용이 없습니다.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* 타임라인 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            타임라인
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground min-w-[48px]">생성</span>
              <span>{formatDate(report.createdAt)}</span>
            </div>
            {report.updatedAt && (
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground min-w-[48px]">수정</span>
                <span>{formatDate(report.updatedAt)}</span>
              </div>
            )}
            {report.sentAt && (
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground min-w-[48px]">발송</span>
                <span className="text-green-600 font-medium">
                  {formatDate(report.sentAt)}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
