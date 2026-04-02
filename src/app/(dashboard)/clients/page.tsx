"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  Search,
  Phone,
  Mail,
  Globe,
  Loader2,
  RefreshCw,
  Trash2,
  Clock,
  Eye,
  Banknote,
  Play,
  Pencil,
  Check,
  X,
  CalendarDays,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";

interface Client {
  id: string;
  company: string;
  contactName: string;
  phone: string;
  email: string;
  industry: string;
  website: string;
  address: string;
  businessNumber: string;
  contractAmount: number;
  contractStart: string;
  contractEnd: string;
  status: string;
  memo: string;
  inquiryId: string;
  createdAt: string;
}

interface ClientStats {
  total: number;
  active: number;
  waiting: number;
  expiringSoon: number;
  totalRevenue: number;
}

const STATUS_OPTIONS = [
  { value: "대기", label: "대기" },
  { value: "진행중", label: "진행중" },
  { value: "만료", label: "만료" },
  { value: "해지", label: "해지" },
];

const STATUS_COLORS: Record<string, string> = {
  대기: "bg-yellow-100 text-yellow-800",
  진행중: "bg-green-100 text-green-800",
  만료: "bg-gray-100 text-gray-600",
  해지: "bg-red-100 text-red-700",
};

const DATE_PRESETS = [
  { label: "전체", days: 0 },
  { label: "오늘", days: 1 },
  { label: "7일", days: 7 },
  { label: "30일", days: 30 },
  { label: "60일", days: 60 },
  { label: "90일", days: 90 },
];

function formatDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function daysRemaining(endDate: string) {
  if (!endDate) return null;
  const diff = Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );
  return diff;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [stats, setStats] = useState<ClientStats>({
    total: 0,
    active: 0,
    waiting: 0,
    expiringSoon: 0,
    totalRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState(0);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Client>>({});
  const [saving, setSaving] = useState(false);
  const [clientRevenue, setClientRevenue] = useState<
    {
      id: string;
      type: string;
      amount: number;
      productName: string;
      date: string;
    }[]
  >([]);
  const [revenueLoading, setRevenueLoading] = useState(false);

  async function fetchClientRevenue(clientName: string) {
    setRevenueLoading(true);
    setClientRevenue([]);
    try {
      const res = await fetch("/api/revenue");
      if (!res.ok) return;
      const data = await res.json();
      const matched = (data.records || []).filter(
        (r: { clientName: string }) => r.clientName === clientName,
      );
      setClientRevenue(matched);
    } catch {
      /* ignore */
    } finally {
      setRevenueLoading(false);
    }
  }

  async function fetchClients() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setClients(data.clients || []);
      setStats(
        data.stats || {
          total: 0,
          active: 0,
          waiting: 0,
          expiringSoon: 0,
          totalRevenue: 0,
        },
      );
    } catch {
      setError("거래처 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchClients();
  }, []);

  async function handleStartMarketing(client: Client) {
    const today = new Date().toISOString().split("T")[0];
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 6);
    const end = endDate.toISOString().split("T")[0];

    try {
      const res = await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: client.id,
          status: "진행중",
          contractStart: today,
          contractEnd: end,
        }),
      });
      if (!res.ok) throw new Error();
      setClients((prev) =>
        prev.map((c) =>
          c.id === client.id
            ? { ...c, status: "진행중", contractStart: today, contractEnd: end }
            : c,
        ),
      );
      if (selectedClient?.id === client.id) {
        setSelectedClient((prev) =>
          prev
            ? {
                ...prev,
                status: "진행중",
                contractStart: today,
                contractEnd: end,
              }
            : prev,
        );
      }
    } catch {
      setError("마케팅 시작 처리에 실패했습니다.");
    }
  }

  async function handleSaveEdit() {
    if (!selectedClient) return;
    setSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedClient.id, ...editData }),
      });
      if (!res.ok) throw new Error();
      const updated = { ...selectedClient, ...editData };
      setClients((prev) =>
        prev.map((c) => (c.id === selectedClient.id ? updated : c)),
      );
      setSelectedClient(updated);
      setEditing(false);
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch("/api/clients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setClients((prev) => prev.filter((c) => c.id !== id));
      if (selectedClient?.id === id) setSelectedClient(null);
    } catch {
      setError("삭제에 실패했습니다.");
    }
  }

  // 필터링
  const filteredClients = clients.filter((client) => {
    if (statusFilter !== "all" && client.status !== statusFilter) return false;

    // 기간 필터
    if (datePreset > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - datePreset);
      cutoff.setHours(0, 0, 0, 0);
      const created = new Date(client.createdAt);
      if (created < cutoff) return false;
    }
    if (customDateStart) {
      if (new Date(client.createdAt) < new Date(customDateStart)) return false;
    }
    if (customDateEnd) {
      const end = new Date(customDateEnd);
      end.setHours(23, 59, 59, 999);
      if (new Date(client.createdAt) > end) return false;
    }

    const q = searchQuery.toLowerCase();
    return (
      client.company.toLowerCase().includes(q) ||
      client.contactName.toLowerCase().includes(q) ||
      client.phone.includes(q) ||
      client.industry.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">거래처 관리</h1>
          <p className="text-sm text-muted-foreground">
            마케팅 계약 거래처를 관리합니다.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchClients}
          disabled={loading}
          className="self-end sm:self-auto"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {[
          { label: "전체", value: stats.total, icon: Building2, color: "" },
          {
            label: "진행중",
            value: stats.active,
            icon: Play,
            color: "text-green-600",
          },
          {
            label: "대기",
            value: stats.waiting,
            icon: Clock,
            color: "text-yellow-600",
          },
          {
            label: "만료예정",
            value: stats.expiringSoon,
            icon: AlertTriangle,
            color: "text-red-500",
          },
          {
            label: "매출",
            value:
              stats.totalRevenue > 0
                ? `${(stats.totalRevenue / 10000).toLocaleString()}만`
                : "0",
            icon: Banknote,
            color: "text-emerald-600",
          },
        ].map((stat, idx, arr) => (
          <Card
            key={stat.label}
            className={idx === arr.length - 1 ? "col-span-2 md:col-span-1" : ""}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.label}
              </CardTitle>
              <stat.icon
                className={`h-4 w-4 ${stat.color || "text-muted-foreground"}`}
              />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 필터 */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* 상태 필터 */}
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[{ value: "all", label: "전체" }, ...STATUS_OPTIONS].map((opt) => (
              <Button
                key={opt.value}
                variant={statusFilter === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 기간 필터 */}
          <div className="flex gap-1">
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.days}
                variant={
                  datePreset === preset.days && !customDateStart
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => {
                  setDatePreset(preset.days);
                  setCustomDateStart("");
                  setCustomDateEnd("");
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={customDateStart}
              onChange={(e) => {
                setCustomDateStart(e.target.value);
                setDatePreset(0);
              }}
              className="h-8 px-2 text-xs border rounded-md"
            />
            <span className="text-xs text-muted-foreground">~</span>
            <input
              type="date"
              value={customDateEnd}
              onChange={(e) => {
                setCustomDateEnd(e.target.value);
                setDatePreset(0);
              }}
              className="h-8 px-2 text-xs border rounded-md"
            />
          </div>
        </div>

        {/* 검색 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="업체명, 담당자, 연락처 검색..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* 카드 그리드 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">거래처가 없습니다</h3>
          <p className="text-sm text-muted-foreground">
            접수관리에서 마케팅계약을 생성하면 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => {
            const days = daysRemaining(client.contractEnd);
            const isExpiringSoon = days !== null && days >= 0 && days <= 30;
            const isExpired = days !== null && days < 0;
            return (
              <Card
                key={client.id}
                className={`cursor-pointer overflow-hidden transition-all hover:shadow-md group relative ${
                  client.status === "진행중"
                    ? "ring-1 ring-green-400 border-l-2 border-l-green-500"
                    : client.status === "대기"
                      ? "ring-1 ring-yellow-400 border-l-2 border-l-yellow-500"
                      : ""
                }`}
                onClick={() => {
                  setSelectedClient(client);
                  setEditing(false);
                  setEditData({});
                  fetchClientRevenue(client.company);
                }}
              >
                {(client.status === "만료" || client.status === "해지") && (
                  <div className="absolute inset-0 bg-black/40 pointer-events-none z-10 rounded-[inherit]" />
                )}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {client.company}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {client.contactName} ·{" "}
                        {client.industry || "업종 미입력"}
                      </p>
                    </div>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${STATUS_COLORS[client.status] || "bg-gray-100 text-gray-600"}`}
                    >
                      {client.status}
                    </span>
                  </div>

                  {client.contractAmount > 0 && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-emerald-700 mb-2">
                      <Banknote className="h-3.5 w-3.5" />
                      {(client.contractAmount / 10000).toLocaleString()}만원/월
                    </div>
                  )}

                  {client.contractStart && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                      <CalendarDays className="h-3 w-3" />
                      {formatDate(client.contractStart)} ~{" "}
                      {formatDate(client.contractEnd)}
                      {isExpiringSoon && (
                        <Badge
                          variant="destructive"
                          className="text-[9px] ml-1 px-1 py-0"
                        >
                          {days}일 남음
                        </Badge>
                      )}
                      {isExpired && (
                        <Badge
                          variant="secondary"
                          className="text-[9px] ml-1 px-1 py-0"
                        >
                          만료됨
                        </Badge>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {client.phone}
                    </span>
                    <div className="flex items-center gap-1">
                      {client.status === "대기" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-green-600 opacity-0 group-hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartMarketing(client);
                          }}
                        >
                          <Play className="h-3.5 w-3.5 mr-1" />
                          시작
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent
                          onClick={(e) => e.stopPropagation()}
                        >
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              거래처를 삭제하시겠습니까?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              이 작업은 되돌릴 수 없습니다.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>취소</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(client.id)}
                            >
                              삭제
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 opacity-0 group-hover:opacity-100"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        상세
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 상세 다이얼로그 */}
      <Dialog
        open={!!selectedClient}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedClient(null);
            setEditing(false);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg">
                    {selectedClient.company}
                  </DialogTitle>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[selectedClient.status] || ""}`}
                    >
                      {selectedClient.status}
                    </span>
                    {!editing && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditing(true);
                          setEditData({
                            company: selectedClient.company,
                            contactName: selectedClient.contactName,
                            phone: selectedClient.phone,
                            email: selectedClient.email,
                            industry: selectedClient.industry,
                            website: selectedClient.website,
                            address: selectedClient.address,
                            businessNumber: selectedClient.businessNumber,
                            memo: selectedClient.memo,
                          });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        편집
                      </Button>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* 상태 변경 */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    상태
                  </label>
                  <Select
                    value={selectedClient.status}
                    onValueChange={async (status) => {
                      try {
                        await fetch("/api/clients", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            id: selectedClient.id,
                            status,
                          }),
                        });
                        setClients((prev) =>
                          prev.map((c) =>
                            c.id === selectedClient.id ? { ...c, status } : c,
                          ),
                        );
                        setSelectedClient((prev) =>
                          prev ? { ...prev, status } : prev,
                        );
                      } catch {
                        setError("상태 변경 실패");
                      }
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 마케팅시작 버튼 */}
                {selectedClient.status === "대기" && (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleStartMarketing(selectedClient)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    마케팅 시작 (오늘부터 6개월)
                  </Button>
                )}

                <Separator />

                {/* 계약 정보 */}
                {selectedClient.contractAmount > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote className="h-4 w-4 text-emerald-600" />
                      <span className="font-semibold text-emerald-700">
                        {(
                          selectedClient.contractAmount / 10000
                        ).toLocaleString()}
                        만원/월 (VAT포함)
                      </span>
                    </div>
                    {selectedClient.contractStart && (
                      <p className="text-xs text-muted-foreground">
                        {formatDate(selectedClient.contractStart)} ~{" "}
                        {formatDate(selectedClient.contractEnd)}
                        {(() => {
                          const d = daysRemaining(selectedClient.contractEnd);
                          if (d !== null && d >= 0) return ` (${d}일 남음)`;
                          if (d !== null && d < 0) return " (만료됨)";
                          return "";
                        })()}
                      </p>
                    )}
                  </div>
                )}

                {/* 매출 내역 (Revenue) */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold">매출 내역</span>
                    {clientRevenue.length > 0 && (
                      <span className="text-xs font-medium text-amber-600">
                        총{" "}
                        {(
                          clientRevenue.reduce(
                            (s, r) => s + (r.amount || 0),
                            0,
                          ) / 10000
                        ).toLocaleString()}
                        만원
                      </span>
                    )}
                  </div>
                  {revenueLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      로딩 중...
                    </div>
                  ) : clientRevenue.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic py-1">
                      등록된 매출 없음
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {clientRevenue.map((rev) => (
                        <div
                          key={rev.id}
                          className="flex items-center gap-2 rounded border px-3 py-2 text-sm"
                        >
                          <span
                            className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              rev.type === "마케팅계약"
                                ? "bg-blue-100 text-blue-700"
                                : rev.type === "홈페이지"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {rev.type}
                          </span>
                          <span className="flex-1 truncate text-xs">
                            {rev.productName || "-"}
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {rev.date || ""}
                          </span>
                          <span className="font-bold text-xs shrink-0">
                            {(rev.amount / 10000).toLocaleString()}만
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* 기본 정보 */}
                {editing ? (
                  <div className="space-y-3">
                    {[
                      { key: "company", label: "업체명" },
                      { key: "contactName", label: "담당자명" },
                      { key: "phone", label: "연락처" },
                      { key: "email", label: "이메일" },
                      { key: "industry", label: "업종" },
                      { key: "website", label: "홈페이지" },
                      { key: "address", label: "주소" },
                      { key: "businessNumber", label: "사업자번호" },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="text-xs text-muted-foreground mb-1 block">
                          {field.label}
                        </label>
                        <Input
                          value={
                            (editData as Record<string, string>)[field.key] ||
                            ""
                          }
                          onChange={(e) =>
                            setEditData({
                              ...editData,
                              [field.key]: e.target.value,
                            })
                          }
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        메모
                      </label>
                      <Textarea
                        value={editData.memo || ""}
                        onChange={(e) =>
                          setEditData({ ...editData, memo: e.target.value })
                        }
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        {saving ? "저장 중..." : "저장"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setEditing(false)}
                      >
                        <X className="h-4 w-4 mr-1" />
                        취소
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {[
                      {
                        label: "담당자",
                        value: selectedClient.contactName,
                        icon: null,
                      },
                      {
                        label: "연락처",
                        value: selectedClient.phone,
                        icon: Phone,
                      },
                      {
                        label: "이메일",
                        value: selectedClient.email,
                        icon: Mail,
                      },
                      {
                        label: "업종",
                        value: selectedClient.industry,
                        icon: null,
                      },
                      {
                        label: "홈페이지",
                        value: selectedClient.website,
                        icon: Globe,
                      },
                      {
                        label: "주소",
                        value: selectedClient.address,
                        icon: null,
                      },
                      {
                        label: "사업자번호",
                        value: selectedClient.businessNumber,
                        icon: null,
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-20 shrink-0 text-xs">
                          {item.label}
                        </span>
                        <span
                          className={item.value ? "" : "text-muted-foreground"}
                        >
                          {item.value || "-"}
                        </span>
                      </div>
                    ))}
                    {selectedClient.memo && (
                      <>
                        <Separator />
                        <div>
                          <span className="text-xs text-muted-foreground block mb-1">
                            메모
                          </span>
                          <p className="text-sm whitespace-pre-wrap">
                            {selectedClient.memo}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
