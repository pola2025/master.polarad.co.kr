"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Search,
  Mail,
  Phone,
  Building,
  ChevronRight,
  Loader2,
  RefreshCw,
  Trash2,
  StickyNote,
  Globe,
  Megaphone,
  MessageCircle,
  CheckCircle2,
  XCircle,
  Reply,
  Send,
  Pencil,
  X,
  Check,
  BarChart3,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Inquiry {
  id: string;
  source: "website" | "meta";
  no: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  memo: string;
  status: string;
  adName: string;
  industry: string;
  smsStatus: string;
  smsSentAt: string;
  smsError: string;
  smsReply: boolean;
  createdAt: string;
}

interface InquiryStats {
  total: number;
  thisMonth: number;
  website: number;
  meta: number;
  smsReplyCount: number;
}

const STATUS_OPTIONS = [
  { value: "", label: "미분류" },
  { value: "신규", label: "신규" },
  { value: "상담중", label: "상담중" },
  { value: "계약완료", label: "계약완료" },
  { value: "보류", label: "보류" },
];

const STATUS_COLORS: Record<string, string> = {
  "": "secondary",
  신규: "default",
  상담중: "outline",
  계약완료: "default",
  보류: "secondary",
};

interface WizardData {
  업종: string;
  현황: string;
  예산: string;
  고민: string;
  추천: string;
}

function parseWizardMessage(message: string): WizardData | null {
  if (!message.startsWith("[위저드]")) return null;
  try {
    const body = message.replace("[위저드] ", "");
    const [fieldsPart, recommendation] = body.split(" → ");
    const fields = fieldsPart.split(" / ");
    const data: Record<string, string> = {};
    for (const field of fields) {
      const [key, value] = field.split(": ");
      if (key && value) data[key.trim()] = value.trim();
    }
    return {
      업종: data["업종"] || "-",
      현황: data["현황"] || "-",
      예산: data["예산"] || "-",
      고민: data["고민"] || "-",
      추천: recommendation?.trim() || "-",
    };
  } catch {
    return null;
  }
}

interface MemoEntry {
  id: string;
  text: string;
  at: string; // ISO datetime
}

function parseMemos(raw: string): MemoEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // 기존 plain text 메모 → 단일 엔트리로 변환
    if (raw.trim()) {
      return [{ id: "legacy", text: raw.trim(), at: new Date().toISOString() }];
    }
  }
  return [];
}

function serializeMemos(entries: MemoEntry[]): string {
  return JSON.stringify(entries);
}

function generateMemoId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function formatMemoTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function InquiriesPage() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [stats, setStats] = useState<InquiryStats>({
    total: 0,
    thisMonth: 0,
    website: 0,
    meta: 0,
    smsReplyCount: 0,
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "website" | "meta">(
    "all",
  );
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memoInput, setMemoInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  async function fetchInquiries() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/inquiries");
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      setInquiries(data.inquiries || []);
      setStats(data.stats || { total: 0, thisMonth: 0 });
    } catch {
      setError("문의 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchInquiries();
  }, []);

  // 문의 선택 시 메모 입력 초기화
  useEffect(() => {
    if (selectedInquiry) {
      setMemoInput("");
      setEditingMemoId(null);
      setEditingMemoText("");
    }
  }, [selectedInquiry]);

  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [editingMemoText, setEditingMemoText] = useState("");

  async function saveMemoToServer(newMemo: string) {
    if (!selectedInquiry) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedInquiry.id, memo: newMemo }),
      });
      if (!res.ok) throw new Error();
      setInquiries((prev) =>
        prev.map((i) =>
          i.id === selectedInquiry.id ? { ...i, memo: newMemo } : i,
        ),
      );
      setSelectedInquiry((prev) => (prev ? { ...prev, memo: newMemo } : prev));
    } catch {
      setError("메모 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddMemo() {
    if (!selectedInquiry || !memoInput.trim()) return;
    const entries = parseMemos(selectedInquiry.memo);
    entries.push({
      id: generateMemoId(),
      text: memoInput.trim(),
      at: new Date().toISOString(),
    });
    const newMemo = serializeMemos(entries);
    await saveMemoToServer(newMemo);
    setMemoInput("");
  }

  async function handleDeleteMemo(memoId: string) {
    if (!selectedInquiry) return;
    const entries = parseMemos(selectedInquiry.memo).filter(
      (e) => e.id !== memoId,
    );
    await saveMemoToServer(serializeMemos(entries));
  }

  async function handleEditMemo(memoId: string) {
    if (!selectedInquiry || !editingMemoText.trim()) return;
    const entries = parseMemos(selectedInquiry.memo).map((e) =>
      e.id === memoId ? { ...e, text: editingMemoText.trim() } : e,
    );
    await saveMemoToServer(serializeMemos(entries));
    setEditingMemoId(null);
    setEditingMemoText("");
  }

  async function handleStatusChange(status: string) {
    if (!selectedInquiry) return;
    try {
      const res = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedInquiry.id, status }),
      });
      if (!res.ok) throw new Error();
      setInquiries((prev) =>
        prev.map((i) => (i.id === selectedInquiry.id ? { ...i, status } : i)),
      );
      setSelectedInquiry((prev) => (prev ? { ...prev, status } : prev));
    } catch {
      setError("상태 변경에 실패했습니다.");
    }
  }

  async function handleToggleReply(targetId?: string) {
    const id = targetId || selectedInquiry?.id;
    if (!id) return;
    const target = inquiries.find((i) => i.id === id);
    if (!target || target.source !== "meta") return;
    const newReply = !target.smsReply;
    try {
      const res = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, smsReply: newReply }),
      });
      if (!res.ok) throw new Error();
      setInquiries((prev) =>
        prev.map((i) => (i.id === id ? { ...i, smsReply: newReply } : i)),
      );
      if (selectedInquiry?.id === id) {
        setSelectedInquiry((prev) =>
          prev ? { ...prev, smsReply: newReply } : prev,
        );
      }
    } catch {
      setError("회신 상태 변경에 실패했습니다.");
    }
  }

  async function handleDelete() {
    if (!selectedInquiry) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/inquiries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedInquiry.id }),
      });
      if (!res.ok) throw new Error();
      setInquiries((prev) => prev.filter((i) => i.id !== selectedInquiry.id));
      setStats((prev) => ({ ...prev, total: prev.total - 1 }));
      setSelectedInquiry(null);
    } catch {
      setError("삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleGenerateBrandReport() {
    if (!selectedInquiry) return;
    setGeneratingReport(true);
    try {
      const wizard = parseWizardMessage(selectedInquiry.message);
      const res = await fetch("/api/brand-reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: selectedInquiry.company,
          industry: wizard?.업종 || selectedInquiry.industry || "",
          contactName: selectedInquiry.name,
          contactPhone: selectedInquiry.phone,
          contactEmail: selectedInquiry.email,
          inquiryId: selectedInquiry.id,
          inquirySource: selectedInquiry.source,
          inquiryDate: selectedInquiry.createdAt,
        }),
      });
      const data = await res.json();
      if (data.success && data.id) {
        router.push(`/brand-reports/${data.id}`);
      } else {
        setError(data.error || "브랜드 분석 생성에 실패했습니다.");
      }
    } catch {
      setError("브랜드 분석 생성 중 오류가 발생했습니다.");
    } finally {
      setGeneratingReport(false);
    }
  }

  const filteredInquiries = inquiries.filter((inquiry) => {
    if (sourceFilter !== "all" && inquiry.source !== sourceFilter) return false;
    const q = searchQuery.toLowerCase();
    return (
      inquiry.name.toLowerCase().includes(q) ||
      inquiry.company.toLowerCase().includes(q) ||
      inquiry.email.toLowerCase().includes(q) ||
      inquiry.phone.includes(q) ||
      inquiry.message.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">리드 관리</h1>
          <p className="text-muted-foreground">
            홈페이지 접수 및 Meta 광고 리드를 통합 관리합니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchInquiries}
          disabled={loading}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 문의</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">누적 접수</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">이번 달</CardTitle>
            <MessageSquare className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.thisMonth}
            </div>
            <p className="text-xs text-muted-foreground">이번 달 접수</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">문자 회신</CardTitle>
            <Reply className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">
              {stats.smsReplyCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                / {stats.meta}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.meta > 0
                ? `회신률 ${Math.round((stats.smsReplyCount / stats.meta) * 100)}%`
                : "회신 없음"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Meta 광고</CardTitle>
            <Megaphone className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">{stats.meta}</div>
            <p className="text-xs text-muted-foreground">리드 광고</p>
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
            {[
              { value: "all" as const, label: "전체" },
              { value: "website" as const, label: "홈페이지", icon: Globe },
              { value: "meta" as const, label: "Meta 광고", icon: Megaphone },
            ].map((tab) => (
              <Button
                key={tab.value}
                variant={sourceFilter === tab.value ? "default" : "outline"}
                size="sm"
                onClick={() => setSourceFilter(tab.value)}
              >
                {tab.icon && <tab.icon className="h-3.5 w-3.5 mr-1" />}
                {tab.label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="이름, 회사, 연락처, 문의내용 검색..."
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
            ) : filteredInquiries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">
                  {searchQuery ? "검색 결과가 없습니다" : "문의가 없습니다"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  새로운 문의가 들어오면 여기에 표시됩니다.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">No</TableHead>
                    <TableHead className="w-[70px]">날짜</TableHead>
                    <TableHead className="w-[60px]">접수처</TableHead>
                    <TableHead className="w-[90px]">문의자</TableHead>
                    <TableHead className="w-[100px]">연락처</TableHead>
                    <TableHead>문의내용</TableHead>
                    <TableHead className="w-[50px]">회신</TableHead>
                    <TableHead className="w-[60px]">상태</TableHead>
                    <TableHead className="w-[36px]">SMS</TableHead>
                    <TableHead className="w-[30px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInquiries.map((inquiry) => (
                    <TableRow
                      key={inquiry.id}
                      className={`cursor-pointer ${selectedInquiry?.id === inquiry.id ? "bg-muted" : ""}`}
                      onClick={() => setSelectedInquiry(inquiry)}
                    >
                      {/* No */}
                      <TableCell className="text-muted-foreground text-sm">
                        {filteredInquiries.length -
                          filteredInquiries.indexOf(inquiry)}
                      </TableCell>
                      {/* 날짜 */}
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                        {formatDate(inquiry.createdAt)}
                      </TableCell>
                      {/* 접수처 */}
                      <TableCell>
                        {inquiry.source === "meta" ? (
                          <span
                            className="inline-flex items-center justify-center px-2.5 py-0.5 rounded text-[11px] font-semibold text-white whitespace-nowrap"
                            style={{ background: "#0668E1" }}
                          >
                            Meta
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded text-[11px] font-semibold text-white whitespace-nowrap bg-orange-500">
                            홈페이지
                          </span>
                        )}
                      </TableCell>
                      {/* 문의자 */}
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate max-w-[80px]">
                            {inquiry.name}
                          </p>
                          {inquiry.company && (
                            <p className="text-xs text-muted-foreground truncate max-w-[80px]">
                              {inquiry.company}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      {/* 연락처 */}
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {inquiry.phone}
                      </TableCell>
                      {/* 문의내용 */}
                      <TableCell>
                        {inquiry.message.startsWith("[위저드]") ? (
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="text-xs shrink-0"
                            >
                              진단
                            </Badge>
                            <span className="text-sm text-muted-foreground line-clamp-1">
                              {parseWizardMessage(inquiry.message)?.업종}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm line-clamp-1">
                            {inquiry.message}
                          </p>
                        )}
                      </TableCell>
                      {/* 회신 */}
                      <TableCell>
                        {inquiry.source === "meta" ? (
                          <button
                            type="button"
                            title={
                              inquiry.smsReply ? "고객 회신 받음" : "회신 체크"
                            }
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                              inquiry.smsReply
                                ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleReply(inquiry.id);
                            }}
                          >
                            <Reply className="h-3 w-3" />
                            {inquiry.smsReply ? "회신" : "-"}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      {/* 상태 */}
                      <TableCell>
                        {inquiry.status ? (
                          <Badge
                            variant={
                              (STATUS_COLORS[inquiry.status] as
                                | "default"
                                | "secondary"
                                | "outline") || "secondary"
                            }
                            className={
                              inquiry.status === "계약완료"
                                ? "bg-green-100 text-green-700 hover:bg-green-100"
                                : inquiry.status === "상담중"
                                  ? "border-blue-300 text-blue-700"
                                  : ""
                            }
                          >
                            {inquiry.status}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
                      </TableCell>
                      {/* SMS */}
                      <TableCell>
                        {inquiry.smsStatus === "발송완료" ? (
                          <span title="SMS 발송완료">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          </span>
                        ) : inquiry.smsStatus === "발송실패" ? (
                          <span title="SMS 발송실패">
                            <XCircle className="h-4 w-4 text-red-500" />
                          </span>
                        ) : inquiry.source === "meta" ? (
                          <span title="SMS 대기">
                            <MessageCircle className="h-4 w-4 text-muted-foreground/40" />
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            -
                          </span>
                        )}
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

      {/* 상세 모달 */}
      <Dialog
        open={!!selectedInquiry}
        onOpenChange={(open) => !open && setSelectedInquiry(null)}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedInquiry && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {selectedInquiry.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <DialogTitle className="text-lg">
                        {selectedInquiry.name}
                      </DialogTitle>
                      {selectedInquiry.company && (
                        <p className="text-sm text-muted-foreground">
                          {selectedInquiry.company}
                        </p>
                      )}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          문의를 삭제하시겠습니까?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {selectedInquiry.name}님의 문의가 영구적으로
                          삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          disabled={deleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleting ? "삭제 중..." : "삭제"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {selectedInquiry.source === "meta" ? (
                    <Badge
                      variant="outline"
                      className="text-xs border-blue-300 text-blue-600"
                    >
                      <Megaphone className="h-3 w-3 mr-1" />
                      Meta 광고
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs border-green-300 text-green-600"
                    >
                      <Globe className="h-3 w-3 mr-1" />
                      홈페이지
                    </Badge>
                  )}
                  {selectedInquiry.adName && (
                    <span className="text-xs text-muted-foreground">
                      {selectedInquiry.adName}
                    </span>
                  )}
                  {selectedInquiry.smsStatus && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        selectedInquiry.smsStatus === "발송완료"
                          ? "border-emerald-300 text-emerald-600"
                          : "border-red-300 text-red-600"
                      }`}
                    >
                      {selectedInquiry.smsStatus === "발송완료" ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      SMS {selectedInquiry.smsStatus}
                    </Badge>
                  )}
                  {selectedInquiry.smsReply && (
                    <Badge
                      variant="outline"
                      className="text-xs border-violet-300 text-violet-600"
                    >
                      <Reply className="h-3 w-3 mr-1" />
                      회신
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  {selectedInquiry.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`mailto:${selectedInquiry.email}`}
                        className="text-blue-600 hover:underline"
                      >
                        {selectedInquiry.email}
                      </a>
                    </div>
                  )}
                  {selectedInquiry.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <a
                        href={`tel:${selectedInquiry.phone}`}
                        className="hover:underline"
                      >
                        {selectedInquiry.phone}
                      </a>
                    </div>
                  )}
                  {selectedInquiry.company && (
                    <div className="flex items-center gap-2 text-sm">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      <span>{selectedInquiry.company}</span>
                    </div>
                  )}
                  {selectedInquiry.industry && (
                    <div className="flex items-center gap-2 text-sm">
                      <Megaphone className="h-4 w-4 text-muted-foreground" />
                      <span>업종: {selectedInquiry.industry}</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* 상태 */}
                <div>
                  <h4 className="font-semibold text-sm mb-2 text-muted-foreground">
                    상태
                  </h4>
                  <Select
                    value={selectedInquiry.status || ""}
                    onValueChange={handleStatusChange}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem
                          key={opt.value || "__empty"}
                          value={opt.value || "__empty"}
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold text-sm mb-2 text-muted-foreground">
                    문의 내용
                  </h4>
                  {(() => {
                    const wizard = parseWizardMessage(selectedInquiry.message);
                    if (!wizard) {
                      return (
                        <p className="text-sm whitespace-pre-wrap">
                          {selectedInquiry.message}
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
                          <span className="text-muted-foreground">업종</span>
                          <span className="font-medium">{wizard.업종}</span>
                          <span className="text-muted-foreground">현황</span>
                          <span className="font-medium">{wizard.현황}</span>
                          <span className="text-muted-foreground">예산</span>
                          <span className="font-medium">{wizard.예산}</span>
                          <span className="text-muted-foreground">고민</span>
                          <span className="font-medium">{wizard.고민}</span>
                        </div>
                        <div className="mt-2 px-3 py-2 rounded-md bg-primary/5 border">
                          <span className="text-xs text-muted-foreground">
                            AI 추천
                          </span>
                          <p className="text-sm font-semibold text-primary">
                            {wizard.추천}
                          </p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <Separator />

                {/* 메모 쓰레드 */}
                <div>
                  <div className="flex items-center gap-1 mb-2">
                    <StickyNote className="h-4 w-4 text-muted-foreground" />
                    <h4 className="font-semibold text-sm text-muted-foreground">
                      메모
                    </h4>
                    <span className="text-xs text-muted-foreground ml-1">
                      {parseMemos(selectedInquiry.memo).length > 0 &&
                        `(${parseMemos(selectedInquiry.memo).length})`}
                    </span>
                  </div>

                  {/* 메모 목록 */}
                  <div className="space-y-1.5 mb-2 max-h-[200px] overflow-y-auto">
                    {parseMemos(selectedInquiry.memo).length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">
                        아직 메모가 없습니다.
                      </p>
                    ) : (
                      parseMemos(selectedInquiry.memo).map((entry) => (
                        <div
                          key={entry.id}
                          className="group flex items-start gap-2 px-2.5 py-1.5 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                        >
                          {editingMemoId === entry.id ? (
                            <div className="flex-1 flex items-center gap-1">
                              <Input
                                value={editingMemoText}
                                onChange={(e) =>
                                  setEditingMemoText(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleEditMemo(entry.id);
                                  if (e.key === "Escape")
                                    setEditingMemoId(null);
                                }}
                                className="h-7 text-sm"
                                autoFocus
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => handleEditMemo(entry.id)}
                                disabled={saving}
                              >
                                <Check className="h-3.5 w-3.5 text-green-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                onClick={() => setEditingMemoId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-snug">
                                  {entry.text}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {formatMemoTime(entry.at)}
                                </p>
                              </div>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <button
                                  type="button"
                                  className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-background transition-colors"
                                  onClick={() => {
                                    setEditingMemoId(entry.id);
                                    setEditingMemoText(entry.text);
                                  }}
                                  title="수정"
                                >
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </button>
                                <button
                                  type="button"
                                  className="h-6 w-6 inline-flex items-center justify-center rounded hover:bg-destructive/10 transition-colors"
                                  onClick={() => handleDeleteMemo(entry.id)}
                                  title="삭제"
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* 메모 입력 */}
                  <div className="flex items-center gap-1.5">
                    <Input
                      value={memoInput}
                      onChange={(e) => setMemoInput(e.target.value)}
                      placeholder="메모 입력..."
                      className="h-8 text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.nativeEvent.isComposing)
                          handleAddMemo();
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={handleAddMemo}
                      disabled={saving || !memoInput.trim()}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                <p className="text-xs text-muted-foreground">
                  접수: {formatDate(selectedInquiry.createdAt)}
                </p>

                {selectedInquiry.source === "meta" && (
                  <button
                    type="button"
                    className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedInquiry.smsReply
                        ? "bg-violet-100 text-violet-700 hover:bg-violet-200"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 border border-dashed"
                    }`}
                    onClick={() => handleToggleReply()}
                  >
                    <Reply className="h-4 w-4" />
                    {selectedInquiry.smsReply
                      ? "고객 회신 받음"
                      : "고객 회신 체크"}
                  </button>
                )}

                {selectedInquiry.source === "website" &&
                  selectedInquiry.company && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={handleGenerateBrandReport}
                      disabled={generatingReport}
                    >
                      {generatingReport ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <BarChart3 className="h-4 w-4 mr-2" />
                      )}
                      {generatingReport
                        ? "브랜드 분석 중..."
                        : "브랜드 분석 생성"}
                    </Button>
                  )}

                <div className="flex gap-2">
                  {selectedInquiry.email && (
                    <Button className="flex-1" asChild>
                      <a href={`mailto:${selectedInquiry.email}`}>
                        <Mail className="mr-2 h-4 w-4" />
                        이메일 답변
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" asChild>
                    <a href={`tel:${selectedInquiry.phone}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
