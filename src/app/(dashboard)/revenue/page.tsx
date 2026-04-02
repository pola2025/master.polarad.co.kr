"use client";

import { useState, useEffect } from "react";
import {
  Banknote,
  Loader2,
  RefreshCw,
  Trash2,
  TrendingUp,
  Globe,
  Megaphone,
  Package,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

interface RevenueRecord {
  id: string;
  clientName: string;
  type: string;
  amount: number;
  productName: string;
  inquiryId: string;
  clientId: string;
  date: string;
  memo: string;
  createdAt: string;
}

interface RevenueStats {
  total: number;
  totalRevenue: number;
  byType: Record<string, number>;
}

const TYPE_CONFIG: Record<string, { color: string; icon: typeof Megaphone }> = {
  마케팅계약: { color: "bg-blue-100 text-blue-700", icon: Megaphone },
  홈페이지: { color: "bg-green-100 text-green-700", icon: Globe },
  추가상품: { color: "bg-amber-100 text-amber-700", icon: Package },
};

export default function RevenuePage() {
  const [records, setRecords] = useState<RevenueRecord[]>([]);
  const [stats, setStats] = useState<RevenueStats>({
    total: 0,
    totalRevenue: 0,
    byType: {},
  });
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState({
    clientName: "",
    type: "",
    amount: "",
    productName: "",
  });
  const [saving, setSaving] = useState(false);

  const fetchRevenue = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/revenue");
      const data = await res.json();
      setRecords(data.records || []);
      setStats(data.stats || { total: 0, totalRevenue: 0, byType: {} });
    } catch (error) {
      console.error("Failed to fetch revenue:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRevenue();
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch("/api/revenue", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        const deleted = records.find((r) => r.id === id);
        if (deleted) {
          setStats((prev) => ({
            ...prev,
            total: prev.total - 1,
            totalRevenue: prev.totalRevenue - deleted.amount,
            byType: {
              ...prev.byType,
              [deleted.type]: (prev.byType[deleted.type] || 0) - deleted.amount,
            },
          }));
        }
      }
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setDeleting(null);
    }
  };

  const startEditing = (record: RevenueRecord) => {
    setEditingId(record.id);
    setEditFields({
      clientName: record.clientName,
      type: record.type,
      amount: record.amount ? record.amount.toLocaleString() : "",
      productName: record.productName,
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    const newAmount = parseInt(editFields.amount.replace(/,/g, ""), 10) || 0;
    try {
      const res = await fetch("/api/revenue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          clientName: editFields.clientName,
          type: editFields.type,
          amount: newAmount,
          productName: editFields.productName,
        }),
      });
      if (res.ok) {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  clientName: editFields.clientName,
                  type: editFields.type,
                  amount: newAmount,
                  productName: editFields.productName,
                }
              : r,
          ),
        );
        // stats 재계산
        const updated = records.map((r) =>
          r.id === id ? { ...r, amount: newAmount, type: editFields.type } : r,
        );
        const totalRevenue = updated.reduce((s, r) => s + r.amount, 0);
        const byType = updated.reduce(
          (acc, r) => {
            const t = r.type || "기타";
            acc[t] = (acc[t] || 0) + r.amount;
            return acc;
          },
          {} as Record<string, number>,
        );
        setStats((prev) => ({
          ...prev,
          totalRevenue,
          byType,
        }));
        setEditingId(null);
      }
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  const filtered =
    filterType === "all"
      ? records
      : records.filter((r) => r.type === filterType);

  // 월별 그룹핑
  const monthlyGroups = filtered.reduce(
    (acc, r) => {
      const month = r.date ? r.date.substring(0, 7) : "날짜없음";
      if (!acc[month]) acc[month] = [];
      acc[month].push(r);
      return acc;
    },
    {} as Record<string, RevenueRecord[]>,
  );

  const sortedMonths = Object.keys(monthlyGroups).sort((a, b) =>
    b.localeCompare(a),
  );

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
          <h1 className="text-2xl font-bold tracking-tight">매출 관리</h1>
          <p className="text-sm text-muted-foreground">
            거래처별 매출 내역을 관리합니다
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchRevenue}>
          <RefreshCw className="mr-2 h-4 w-4" />
          새로고침
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 매출</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {stats.totalRevenue > 0
                ? `${(stats.totalRevenue / 10000).toLocaleString()}만`
                : "0원"}
            </div>
            <p className="text-xs text-muted-foreground">{stats.total}건</p>
          </CardContent>
        </Card>
        {["마케팅계약", "홈페이지", "추가상품"].map((type) => {
          const config = TYPE_CONFIG[type];
          const amount = stats.byType[type] || 0;
          const count = records.filter((r) => r.type === type).length;
          const Icon = config?.icon || Package;
          return (
            <Card key={type}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{type}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {amount > 0
                    ? `${(amount / 10000).toLocaleString()}만`
                    : "0원"}
                </div>
                <p className="text-xs text-muted-foreground">{count}건</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 유형 필터 */}
      <div className="flex gap-2">
        {[
          { value: "all", label: "전체" },
          { value: "마케팅계약", label: "마케팅계약" },
          { value: "홈페이지", label: "홈페이지" },
          { value: "추가상품", label: "추가상품" },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterType === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
            onClick={() => setFilterType(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 매출 리스트 */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Banknote className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">등록된 매출이 없습니다</p>
            <p className="text-xs text-muted-foreground mt-1">
              문의관리에서 계약완료 또는 추가상품을 등록하면 자동으로 추가됩니다
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedMonths.map((month) => {
            const items = monthlyGroups[month];
            const monthTotal = items.reduce((sum, r) => sum + r.amount, 0);
            return (
              <div key={month} className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-muted-foreground">
                    {month === "날짜없음"
                      ? "날짜없음"
                      : `${month.split("-")[0]}년 ${parseInt(month.split("-")[1])}월`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {items.length}건
                  </span>
                  <span className="text-xs font-medium text-amber-600">
                    {(monthTotal / 10000).toLocaleString()}만원
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="space-y-2">
                  {items.map((record) => {
                    const config = TYPE_CONFIG[record.type];
                    const isEditing = editingId === record.id;

                    if (isEditing) {
                      return (
                        <div
                          key={record.id}
                          className="rounded-lg border p-4 bg-card space-y-3 ring-1 ring-blue-300"
                        >
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] text-muted-foreground mb-1 block">
                                거래처명
                              </label>
                              <input
                                type="text"
                                value={editFields.clientName}
                                onChange={(e) =>
                                  setEditFields((p) => ({
                                    ...p,
                                    clientName: e.target.value,
                                  }))
                                }
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground mb-1 block">
                                유형
                              </label>
                              <select
                                value={editFields.type}
                                onChange={(e) =>
                                  setEditFields((p) => ({
                                    ...p,
                                    type: e.target.value,
                                  }))
                                }
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              >
                                <option value="마케팅계약">마케팅계약</option>
                                <option value="홈페이지">홈페이지</option>
                                <option value="추가상품">추가상품</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground mb-1 block">
                                금액 (원)
                              </label>
                              <input
                                type="text"
                                value={editFields.amount}
                                onChange={(e) => {
                                  const v = e.target.value.replace(
                                    /[^\d]/g,
                                    "",
                                  );
                                  setEditFields((p) => ({
                                    ...p,
                                    amount: v
                                      ? parseInt(v, 10).toLocaleString()
                                      : "",
                                  }));
                                }}
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground mb-1 block">
                                상품명
                              </label>
                              <input
                                type="text"
                                value={editFields.productName}
                                onChange={(e) =>
                                  setEditFields((p) => ({
                                    ...p,
                                    productName: e.target.value,
                                  }))
                                }
                                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleSaveEdit(record.id)}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="mr-1 h-3 w-3" />
                              )}
                              저장
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={cancelEditing}
                            >
                              <X className="mr-1 h-3 w-3" />
                              취소
                            </Button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={record.id}
                        className="flex items-center gap-4 rounded-lg border p-4 bg-card hover:shadow-sm transition-shadow"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                              {record.clientName || "-"}
                            </span>
                            <Badge
                              className={`text-[10px] shrink-0 ${config?.color || "bg-gray-100 text-gray-700"}`}
                            >
                              {record.type || "기타"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{record.date || "-"}</span>
                            {record.productName && (
                              <span className="truncate">
                                {record.productName}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">
                            {record.amount > 0
                              ? `${(record.amount / 10000).toLocaleString()}만원`
                              : "0원"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 shrink-0"
                          onClick={() => startEditing(record)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 shrink-0"
                              disabled={deleting === record.id}
                            >
                              {deleting === record.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>매출 삭제</AlertDialogTitle>
                              <AlertDialogDescription>
                                {record.clientName} —{" "}
                                {(record.amount / 10000).toLocaleString()}만원 (
                                {record.type}) 매출을 삭제하시겠습니까?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-red-600 hover:bg-red-700"
                                onClick={() => handleDelete(record.id)}
                              >
                                삭제
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
