"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Eye,
  EyeOff,
  Trash2,
  Loader2,
  RefreshCw,
  ExternalLink,
  Calendar,
  Banknote,
  Package,
  BarChart3,
  Globe,
  Lock,
  Link2,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface Proposal {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  clientName: string;
  amount: string;
  products: string;
  date: string;
  status: string;
  views: number;
  themeColor: string;
  password: string;
  createdTime: string;
}

interface ProposalStats {
  total: number;
  public: number;
  private: number;
  totalViews: number;
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [stats, setStats] = useState<ProposalStats>({
    total: 0,
    public: 0,
    private: 0,
    totalViews: 0,
  });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editProducts, setEditProducts] = useState("");

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/proposals");
      const data = await res.json();
      setProposals(data.proposals || []);
      setStats(
        data.stats || { total: 0, public: 0, private: 0, totalViews: 0 },
      );
    } catch (error) {
      console.error("Failed to fetch proposals:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleToggleStatus = async (proposal: Proposal) => {
    const newStatus = proposal.status === "공개" ? "비공개" : "공개";
    setActionLoading(proposal.id);
    try {
      const res = await fetch("/api/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: proposal.id, status: newStatus }),
      });
      if (res.ok) {
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposal.id ? { ...p, status: newStatus } : p,
          ),
        );
        setStats((prev) => ({
          ...prev,
          public: prev.public + (newStatus === "공개" ? 1 : -1),
          private: prev.private + (newStatus === "비공개" ? 1 : -1),
        }));
      }
    } catch (error) {
      console.error("Toggle status failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (proposal: Proposal) => {
    setActionLoading(proposal.id);
    try {
      const res = await fetch("/api/proposals", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: proposal.id }),
      });
      if (res.ok) {
        setProposals((prev) => prev.filter((p) => p.id !== proposal.id));
        setStats((prev) => ({
          ...prev,
          total: prev.total - 1,
          public: prev.public - (proposal.status === "공개" ? 1 : 0),
          private: prev.private - (proposal.status === "비공개" ? 1 : 0),
          totalViews: prev.totalViews - proposal.views,
        }));
      }
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const startEditing = (proposal: Proposal) => {
    setEditingId(proposal.id);
    setEditAmount(proposal.amount);
    setEditProducts(proposal.products);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditAmount("");
    setEditProducts("");
  };

  const handleSaveEdit = async (proposal: Proposal) => {
    setActionLoading(proposal.id);
    try {
      const res = await fetch("/api/proposals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: proposal.id,
          amount: editAmount,
          products: editProducts,
        }),
      });
      if (res.ok) {
        setProposals((prev) =>
          prev.map((p) =>
            p.id === proposal.id
              ? { ...p, amount: editAmount, products: editProducts }
              : p,
          ),
        );
        setEditingId(null);
      }
    } catch (error) {
      console.error("Save edit failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const PROPOSAL_BASE_URL = "https://polarad.co.kr/proposal";

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">제안 관리</h1>
          <p className="text-sm text-muted-foreground">
            고객 제안서 현황을 관리합니다
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchProposals}>
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 제안서</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">공개</CardTitle>
            <Globe className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.public}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">비공개</CardTitle>
            <Lock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.private}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 조회수</CardTitle>
            <BarChart3 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.totalViews.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 제안서 카드 목록 */}
      {proposals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">등록된 제안서가 없습니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {proposals.map((proposal) => (
            <Card
              key={proposal.id}
              className={`relative overflow-hidden transition-all hover:shadow-md ${
                proposal.status === "비공개" ? "opacity-60" : ""
              }`}
            >
              {/* 테마 컬러 상단 바 */}
              <div
                className="h-2 w-full"
                style={{ backgroundColor: proposal.themeColor }}
              />

              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base leading-tight line-clamp-2">
                      {proposal.title}
                    </CardTitle>
                    {proposal.subtitle && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {proposal.subtitle}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      proposal.status === "공개" ? "default" : "secondary"
                    }
                    className={
                      proposal.status === "공개"
                        ? "bg-green-100 text-green-700 hover:bg-green-100 shrink-0"
                        : "bg-red-100 text-red-700 hover:bg-red-100 shrink-0"
                    }
                  >
                    {proposal.status === "공개" ? (
                      <Globe className="mr-1 h-3 w-3" />
                    ) : (
                      <Lock className="mr-1 h-3 w-3" />
                    )}
                    {proposal.status}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* 클라이언트명 */}
                <div className="text-sm font-medium text-foreground">
                  {proposal.clientName}
                </div>

                {/* URL */}
                <div className="flex items-center gap-1.5 text-xs text-blue-600">
                  <Link2 className="h-3.5 w-3.5 shrink-0" />
                  <a
                    href={`${PROPOSAL_BASE_URL}/${proposal.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:underline"
                  >
                    polarad.co.kr/proposal/{proposal.slug}
                  </a>
                </div>

                {/* 메타 정보 */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{proposal.date || "-"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    <span>{proposal.views.toLocaleString()}회 조회</span>
                  </div>
                </div>

                {/* 제안금액 & 상품 - 편집 모드 */}
                {editingId === proposal.id ? (
                  <div className="space-y-2 pt-2 border-t">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        제안 금액
                      </label>
                      <Input
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder="예: 176만원"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        제안 상품 (줄바꿈으로 구분)
                      </label>
                      <Textarea
                        value={editProducts}
                        onChange={(e) => setEditProducts(e.target.value)}
                        placeholder="홈페이지 제작&#10;마케팅 전략"
                        className="text-sm min-h-[80px]"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="flex-1 text-xs h-7"
                        onClick={() => handleSaveEdit(proposal)}
                        disabled={actionLoading === proposal.id}
                      >
                        {actionLoading === proposal.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="mr-1 h-3 w-3" />
                        )}
                        저장
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-7"
                        onClick={cancelEditing}
                      >
                        <X className="mr-1 h-3 w-3" />
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Package className="h-3.5 w-3.5" />
                        <span>제안 내용</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => startEditing(proposal)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                    {proposal.amount && (
                      <div className="flex items-center gap-1.5 text-xs mb-1.5">
                        <Banknote className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {proposal.amount}
                        </span>
                      </div>
                    )}
                    {proposal.products && (
                      <div className="flex flex-wrap gap-1">
                        {proposal.products.split("\n").map((product, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-[11px] font-normal"
                          >
                            {product}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {!proposal.amount && !proposal.products && (
                      <p className="text-xs text-muted-foreground italic">
                        미입력
                      </p>
                    )}
                  </div>
                )}

                {/* 액션 버튼 */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    asChild
                  >
                    <a
                      href={`${PROPOSAL_BASE_URL}/${proposal.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      열기
                    </a>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => handleToggleStatus(proposal)}
                    disabled={actionLoading === proposal.id}
                  >
                    {actionLoading === proposal.id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : proposal.status === "공개" ? (
                      <EyeOff className="mr-1 h-3.5 w-3.5" />
                    ) : (
                      <Eye className="mr-1 h-3.5 w-3.5" />
                    )}
                    {proposal.status === "공개" ? "비공개" : "공개"}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={actionLoading === proposal.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>제안서 삭제</AlertDialogTitle>
                        <AlertDialogDescription>
                          &ldquo;{proposal.title}&rdquo; 제안서를
                          삭제하시겠습니까?
                          <br />
                          Airtable 레코드가 삭제되며, polasales의 정적 파일도
                          별도로 삭제해야 합니다.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(proposal)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          삭제
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
