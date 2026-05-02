"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Search,
  Mail,
  Phone,
  Building,
  Loader2,
  RefreshCw,
  Trash2,
  StickyNote,
  Globe,
  Megaphone,
  CheckCircle2,
  XCircle,
  Reply,
  Send,
  Pencil,
  X,
  Check,
  BarChart3,
  Clock,
  Eye,
  Banknote,
  Handshake,
  FileSignature,
  Package,
  Ban,
  ShieldAlert,
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
  source: "website" | "meta" | "google_ads";
  no: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  memo: string;
  status: string;
  contractAmount: number;
  adName: string;
  industry: string;
  smsStatus: string;
  smsSentAt: string;
  smsError: string;
  smsReply: boolean;
  createdAt: string;
  reportStatus: string;
  reportEmailOpenedAt: string;
  reportSentAt: string;
}

interface InquiryStats {
  total: number;
  thisMonth: number;
  website: number;
  meta: number;
  googleAds: number;
  smsReplyCount: number;
  contractCount: number;
  totalRevenue: number;
}

interface MonthlyStats {
  month: string;
  inquiries: number;
  website: number;
  meta: number;
  googleAds: number;
  contractCount: number;
  totalRevenue: number;
}

interface AdSpendRecord {
  id: string;
  month: string;
  metaAmount: number;
  googleAmount: number;
  memo: string;
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

function formatRelativeTime(iso: string) {
  const now = new Date();
  const d = new Date(iso);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return "어제";
  if (diffDay < 30) return `${diffDay}일 전`;
  return formatDate(iso);
}

const AVATAR_COLORS = [
  "bg-indigo-500",
  "bg-cyan-600",
  "bg-fuchsia-500",
  "bg-emerald-600",
  "bg-red-500",
  "bg-orange-600",
  "bg-violet-500",
  "bg-teal-500",
];
function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getStripeColor(status: string) {
  if (status === "" || status === "신규") return "bg-red-500";
  if (status === "상담중") return "bg-yellow-400";
  return "bg-transparent";
}

function isNewInquiry(status: string) {
  return status === "" || status === "신규";
}

export default function InquiriesPage() {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [stats, setStats] = useState<InquiryStats>({
    total: 0,
    thisMonth: 0,
    website: 0,
    meta: 0,
    googleAds: 0,
    smsReplyCount: 0,
    contractCount: 0,
    totalRevenue: 0,
  });
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [cumulativeAdSpend, setCumulativeAdSpend] = useState<{
    meta: number;
    google: number;
  } | null>(null);
  const [adSpend, setAdSpend] = useState<AdSpendRecord | null>(null);
  const [adSpendDialogOpen, setAdSpendDialogOpen] = useState(false);
  const [adSpendMetaInput, setAdSpendMetaInput] = useState("");
  const [adSpendGoogleInput, setAdSpendGoogleInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "website" | "meta" | "google_ads"
  >("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState(0);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memoInput, setMemoInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [blacklistedPhones, setBlacklistedPhones] = useState<Set<string>>(
    new Set(),
  );

  // 카드 블랙리스트 매칭용 전화번호 정규화 (lib/blacklist.ts와 동일 로직)
  function normalizePhoneClient(raw: string): string {
    if (!raw) return "";
    let cleaned = String(raw).replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+82")) cleaned = "0" + cleaned.slice(3);
    if (cleaned.startsWith("82") && cleaned.length === 12)
      cleaned = "0" + cleaned.slice(2);
    return cleaned.replace(/\D/g, "");
  }

  async function fetchBlacklistedPhones() {
    try {
      const res = await fetch("/api/inquiries/blacklist", {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const set = new Set<string>();
      for (const e of data.entries || []) {
        const n = normalizePhoneClient(e.phone);
        if (n) set.add(n);
      }
      setBlacklistedPhones(set);
    } catch {
      /* ignore */
    }
  }

  async function fetchInquiries() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/inquiries?month=${selectedMonth}`);
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      setInquiries(data.inquiries || []);
      setStats(data.stats || { total: 0, thisMonth: 0 });
      if (data.monthlyStats) setMonthlyStats(data.monthlyStats);
      // 블랙리스트 set도 같이 갱신
      fetchBlacklistedPhones();
    } catch {
      setError("문의 데이터를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllAdSpend() {
    try {
      const res = await fetch("/api/ad-spend");
      if (!res.ok) return;
      const data = await res.json();
      const records: AdSpendRecord[] = data.records || [];
      const totals = records.reduce(
        (acc, r) => ({
          meta: acc.meta + (r.metaAmount || 0),
          google: acc.google + (r.googleAmount || 0),
        }),
        { meta: 0, google: 0 },
      );
      setCumulativeAdSpend(totals);
    } catch {
      /* ignore */
    }
  }

  async function fetchAdSpend(month: string) {
    try {
      const res = await fetch(`/api/ad-spend?month=${month}`);
      if (!res.ok) return;
      const data = await res.json();
      setAdSpend(data.records?.[0] || null);
    } catch {
      /* ignore */
    }
  }

  async function saveAdSpend() {
    const meta = parseInt(adSpendMetaInput.replace(/,/g, ""), 10) || 0;
    const google = parseInt(adSpendGoogleInput.replace(/,/g, ""), 10) || 0;
    try {
      if (adSpend) {
        await fetch("/api/ad-spend", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: adSpend.id,
            metaAmount: meta,
            googleAmount: google,
          }),
        });
      } else {
        await fetch("/api/ad-spend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            month: selectedMonth,
            metaAmount: meta,
            googleAmount: google,
          }),
        });
      }
      setAdSpendDialogOpen(false);
      fetchAdSpend(selectedMonth);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    fetchInquiries();
    fetchAdSpend(selectedMonth);
    fetchAllAdSpend();
  }, [selectedMonth]);

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

  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [contractAmountInput, setContractAmountInput] = useState("");
  const [contractExtraInput, setContractExtraInput] = useState("");
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);

  async function handleStatusChange(rawStatus: string) {
    if (!selectedInquiry) return;
    const status = rawStatus === "__empty" ? "" : rawStatus;
    if (status === "계약완료") {
      setPendingStatusId(selectedInquiry.id);
      setContractAmountInput("");
      setContractExtraInput("");
      setContractDialogOpen(true);
      return;
    }
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

  async function handleContractConfirm() {
    if (!pendingStatusId) return;
    const baseAmount = parseInt(contractAmountInput.replace(/,/g, ""), 10) || 0;
    const extraAmount = parseInt(contractExtraInput.replace(/,/g, ""), 10) || 0;
    const amount = baseAmount + extraAmount;
    try {
      const res = await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pendingStatusId,
          status: "계약완료",
          contractAmount: amount,
        }),
      });
      if (!res.ok) throw new Error();
      setInquiries((prev) =>
        prev.map((i) =>
          i.id === pendingStatusId
            ? { ...i, status: "계약완료", contractAmount: amount }
            : i,
        ),
      );
      setSelectedInquiry((prev) =>
        prev ? { ...prev, status: "계약완료", contractAmount: amount } : prev,
      );

      const inq = inquiries.find((i) => i.id === pendingStatusId);

      // 거래처관리에 자동 등록 (멱등 — 동일 inquiry_id 있으면 skip)
      // 1회성 계약이므로 contract_amount=0 (월정액 아님). 매출은 revenue 테이블로 추적.
      if (inq) {
        const wizard = parseWizardMessage(inq.message);
        await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company: inq.company || "",
            contactName: inq.name || "",
            phone: inq.phone || "",
            email: inq.email || "",
            industry: wizard?.업종 || inq.industry || "",
            contractAmount: 0,
            inquiryId: pendingStatusId,
          }),
        }).catch(() => {});
      }

      // Revenue 테이블에 매출 기록
      if (amount > 0 && inq) {
        await fetch("/api/revenue", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientName: inq.company || inq.name || "",
            type: inq.source === "meta" ? "메타광고" : "홈페이지",
            amount,
            productName:
              extraAmount > 0
                ? inq.source === "meta"
                  ? "메타광고 + 추가비용"
                  : "홈페이지 + 추가비용"
                : inq.source === "meta"
                  ? "메타광고"
                  : "홈페이지",
            inquiryId: pendingStatusId,
            date: new Date().toISOString().split("T")[0],
          }),
        }).catch(() => {});
      }

      setContractDialogOpen(false);
      setPendingStatusId(null);
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

  async function handleDeleteById(id: string) {
    try {
      const res = await fetch("/api/inquiries", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error();
      setInquiries((prev) => prev.filter((i) => i.id !== id));
      setStats((prev) => ({ ...prev, total: prev.total - 1 }));
      if (selectedInquiry?.id === id) setSelectedInquiry(null);
    } catch {
      setError("삭제에 실패했습니다.");
    }
  }

  // 마케팅계약 다이얼로그
  const [marketingDialogOpen, setMarketingDialogOpen] = useState(false);
  const [marketingAmountInput, setMarketingAmountInput] = useState("");
  const [marketingContractInquiry, setMarketingContractInquiry] =
    useState<Inquiry | null>(null);

  async function handleMarketingContract() {
    if (!marketingContractInquiry) return;
    const monthlyAmount =
      parseInt(marketingAmountInput.replace(/,/g, ""), 10) || 0;
    const revenueAmount = monthlyAmount * 6; // 6개월분 일시 결제
    try {
      // 1. Clients 테이블에 거래처 생성 (월 계약금액)
      const wizard = parseWizardMessage(marketingContractInquiry.message);
      await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: marketingContractInquiry.company,
          contactName: marketingContractInquiry.name,
          phone: marketingContractInquiry.phone,
          email: marketingContractInquiry.email,
          industry: wizard?.업종 || "",
          contractAmount: monthlyAmount,
          inquiryId: marketingContractInquiry.id,
        }),
      });
      // 2. 접수 상태를 계약완료로 + 매출(6개월분) 저장
      await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: marketingContractInquiry.id,
          status: "계약완료",
          contractAmount: revenueAmount,
        }),
      });
      setInquiries((prev) =>
        prev.map((i) =>
          i.id === marketingContractInquiry.id
            ? { ...i, status: "계약완료", contractAmount: revenueAmount }
            : i,
        ),
      );
      if (selectedInquiry?.id === marketingContractInquiry.id) {
        setSelectedInquiry((prev) =>
          prev
            ? { ...prev, status: "계약완료", contractAmount: revenueAmount }
            : prev,
        );
      }
      // 3. Revenue 테이블에 매출 기록
      await fetch("/api/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName:
            marketingContractInquiry.company || marketingContractInquiry.name,
          type: "마케팅계약",
          amount: revenueAmount,
          productName: `마케팅 월정액 ${(monthlyAmount / 10000).toLocaleString()}만×6개월`,
          inquiryId: marketingContractInquiry.id,
          date: new Date().toISOString().split("T")[0],
        }),
      });

      setMarketingDialogOpen(false);
      setMarketingContractInquiry(null);
    } catch {
      setError("마케팅계약 생성에 실패했습니다.");
    }
  }

  // 추가상품 다이얼로그
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productNameInput, setProductNameInput] = useState("");
  const [productAmountInput, setProductAmountInput] = useState("");
  const [productInquiry, setProductInquiry] = useState<Inquiry | null>(null);

  async function handleProductContract() {
    if (!productInquiry) return;
    const amount = parseInt(productAmountInput.replace(/,/g, ""), 10) || 0;
    if (!amount || !productNameInput.trim()) return;
    try {
      // 1. Revenue 테이블에 매출 기록 (거래처는 별도 생성하지 않음 - 단발성)
      await fetch("/api/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: productInquiry.company || productInquiry.name,
          type: "추가상품",
          amount,
          productName: productNameInput.trim(),
          inquiryId: productInquiry.id,
          date: new Date().toISOString().split("T")[0],
        }),
      });

      // 3. 접수 상태를 계약완료로 + 금액 합산
      const newAmount = (productInquiry.contractAmount || 0) + amount;
      await fetch("/api/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productInquiry.id,
          status: "계약완료",
          contractAmount: newAmount,
        }),
      });

      setInquiries((prev) =>
        prev.map((i) =>
          i.id === productInquiry.id
            ? { ...i, status: "계약완료", contractAmount: newAmount }
            : i,
        ),
      );
      if (selectedInquiry?.id === productInquiry.id) {
        setSelectedInquiry((prev) =>
          prev
            ? { ...prev, status: "계약완료", contractAmount: newAmount }
            : prev,
        );
      }
      setProductDialogOpen(false);
      setProductInquiry(null);
    } catch {
      setError("추가상품 등록에 실패했습니다.");
    }
  }

  // ── 블랙리스트 ─────────────────────────────────────
  interface BlacklistEntry {
    id: string;
    phone: string;
    name: string;
    reason: string;
    source: string;
    createdAt: string;
  }
  const [blacklistDialogOpen, setBlacklistDialogOpen] = useState(false);
  const [blacklistEntries, setBlacklistEntries] = useState<BlacklistEntry[]>(
    [],
  );
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [addBlacklistDialog, setAddBlacklistDialog] = useState<{
    open: boolean;
    inquiry: Inquiry | null;
    reason: string;
  }>({ open: false, inquiry: null, reason: "" });

  async function loadBlacklist() {
    setBlacklistLoading(true);
    try {
      const res = await fetch("/api/inquiries/blacklist", {
        cache: "no-store",
      });
      const data = await res.json();
      setBlacklistEntries(data.entries || []);
    } catch {
      setError("블랙리스트 조회에 실패했습니다.");
    } finally {
      setBlacklistLoading(false);
    }
  }

  async function handleAddBlacklist() {
    const inquiry = addBlacklistDialog.inquiry;
    if (!inquiry || !inquiry.phone) return;
    try {
      const res = await fetch("/api/inquiries/blacklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: inquiry.phone,
          name: inquiry.name,
          reason: addBlacklistDialog.reason,
          source: inquiry.source === "meta" ? "Meta" : "홈페이지",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "블랙리스트 등록 실패");
        return;
      }
      // 카드 즉시 어둡게 표시되도록 set에 추가
      const normalized = normalizePhoneClient(inquiry.phone);
      if (normalized) {
        setBlacklistedPhones((prev) => {
          const next = new Set(prev);
          next.add(normalized);
          return next;
        });
      }
      setAddBlacklistDialog({ open: false, inquiry: null, reason: "" });
    } catch {
      setError("블랙리스트 등록 중 오류가 발생했습니다.");
    }
  }

  async function handleRemoveBlacklist(id: string) {
    try {
      const res = await fetch("/api/inquiries/blacklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        setError("블랙리스트 해제 실패");
        return;
      }
      // 카드 시각도 즉시 복구 — 해당 entry의 phone을 set에서 제거
      const removed = blacklistEntries.find((e) => e.id === id);
      if (removed) {
        const normalized = normalizePhoneClient(removed.phone);
        if (normalized) {
          setBlacklistedPhones((prev) => {
            const next = new Set(prev);
            next.delete(normalized);
            return next;
          });
        }
      }
      setBlacklistEntries((prev) => prev.filter((e) => e.id !== id));
    } catch {
      setError("블랙리스트 해제 중 오류가 발생했습니다.");
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
    if (statusFilter !== "all") {
      if (statusFilter === "" && inquiry.status !== "") return false;
      if (statusFilter !== "" && inquiry.status !== statusFilter) return false;
    }
    // 기간 필터
    if (datePreset > 0) {
      const cutoff = new Date();
      if (datePreset === 1) {
        cutoff.setHours(0, 0, 0, 0);
      } else {
        cutoff.setDate(cutoff.getDate() - datePreset);
        cutoff.setHours(0, 0, 0, 0);
      }
      if (new Date(inquiry.createdAt) < cutoff) return false;
    }
    if (
      customDateStart &&
      new Date(inquiry.createdAt) < new Date(customDateStart)
    )
      return false;
    if (customDateEnd) {
      const end = new Date(customDateEnd);
      end.setHours(23, 59, 59, 999);
      if (new Date(inquiry.createdAt) > end) return false;
    }
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">리드 관리</h1>
          <p className="text-sm text-muted-foreground">
            홈페이지 접수 및 Meta 광고 리드를 통합 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBlacklistDialogOpen(true);
              loadBlacklist();
            }}
          >
            <ShieldAlert className="h-4 w-4 mr-2" />
            블랙리스트
          </Button>
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
      </div>

      {/* 1행: 접수 통계 (소스별 필터) */}
      <div className="grid gap-2 grid-cols-3 md:grid-cols-6">
        {[
          {
            label: "전체",
            value: stats.total,
            color: "",
            filterKey: "all" as const,
          },
          {
            label: "이번 달",
            value: stats.thisMonth,
            color: "text-blue-600",
            filterKey: "all" as const,
          },
          {
            label: "홈페이지",
            value: stats.website,
            color: "text-orange-500",
            filterKey: "website" as const,
          },
          {
            label: "Meta",
            value: stats.meta,
            color: "text-blue-500",
            filterKey: "meta" as const,
          },
          {
            label: "구글",
            value: stats.googleAds,
            color: "text-green-500",
            filterKey: "google_ads" as const,
          },
          {
            label: "회신",
            value: stats.smsReplyCount,
            color: "text-[#0668E1]",
            filterKey: "all" as const,
          },
        ].map((s) => {
          const active =
            sourceFilter === s.filterKey &&
            s.filterKey !== "all" &&
            statusFilter === "all";
          return (
            <div
              key={s.label}
              className={`rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm ${active ? "ring-1 ring-blue-500 bg-blue-50 dark:bg-blue-950/20" : "bg-card"}`}
              onClick={() => {
                if (s.filterKey !== "all" || s.label === "전체") {
                  setSourceFilter(
                    s.filterKey as "all" | "website" | "meta" | "google_ads",
                  );
                  setStatusFilter("all");
                }
              }}
            >
              <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* 2행: 성과 통계 (월별) */}
      {(() => {
        const ms = monthlyStats;
        const totalAdSpend =
          (adSpend?.metaAmount || 0) + (adSpend?.googleAmount || 0);

        const contractRate =
          ms && ms.inquiries > 0
            ? ((ms.contractCount / ms.inquiries) * 100).toFixed(1)
            : "0";
        const roas =
          totalAdSpend > 0 && ms
            ? (ms.totalRevenue / totalAdSpend).toFixed(2)
            : "-";

        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                성과 통계
              </h3>
              <select
                className="text-sm border rounded px-2 py-0.5 bg-background"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(2026, 2 + i); // 3월부터
                  if (d > new Date()) return null;
                  const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                  return (
                    <option key={v} value={v}>
                      {d.getMonth() + 1}월
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
              {/* 광고비 */}
              <div
                className="rounded-lg border p-3 cursor-pointer hover:shadow-sm bg-card transition-all"
                onClick={() => {
                  setAdSpendMetaInput(
                    adSpend?.metaAmount ? String(adSpend.metaAmount) : "",
                  );
                  setAdSpendGoogleInput(
                    adSpend?.googleAmount ? String(adSpend.googleAmount) : "",
                  );
                  setAdSpendDialogOpen(true);
                }}
              >
                <p className="text-xs text-muted-foreground mb-0.5">광고비</p>
                <p className="text-xl font-bold text-rose-600">
                  {totalAdSpend > 0
                    ? `${(totalAdSpend / 10000).toLocaleString()}만`
                    : "미입력"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {totalAdSpend > 0
                    ? `M${((adSpend?.metaAmount || 0) / 10000).toFixed(0)} / G${((adSpend?.googleAmount || 0) / 10000).toFixed(0)}`
                    : "클릭하여 입력"}
                </p>
              </div>
              {/* 접수 */}
              <div className="rounded-lg border p-3 bg-card">
                <p className="text-xs text-muted-foreground mb-0.5">접수</p>
                <p className="text-xl font-bold">{ms?.inquiries ?? 0}건</p>
                <p className="text-[10px] text-muted-foreground">
                  홈{ms?.website ?? 0} / M{ms?.meta ?? 0} / G
                  {ms?.googleAds ?? 0}
                </p>
              </div>
              {/* 계약 */}
              <div className="rounded-lg border p-3 bg-card">
                <p className="text-xs text-muted-foreground mb-0.5">계약</p>
                <p className="text-xl font-bold text-emerald-600">
                  {ms?.contractCount ?? 0}건
                </p>
                <p className="text-[10px] text-muted-foreground">
                  계약률 {contractRate}%
                </p>
              </div>
              {/* 매출 */}
              <div className="rounded-lg border p-3 bg-card">
                <p className="text-xs text-muted-foreground mb-0.5">매출</p>
                <p className="text-xl font-bold text-amber-600">
                  {ms && ms.totalRevenue > 0
                    ? `${(ms.totalRevenue / 10000).toLocaleString()}만`
                    : "0원"}
                </p>
                <p className="text-[10px] text-muted-foreground">ROAS {roas}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 3행: 누적 통계 */}
      {(() => {
        const cumAdSpend =
          (cumulativeAdSpend?.meta || 0) + (cumulativeAdSpend?.google || 0);
        const cumContractRate =
          stats.total > 0
            ? ((stats.contractCount / stats.total) * 100).toFixed(1)
            : "0";
        const cumRoas =
          cumAdSpend > 0 ? (stats.totalRevenue / cumAdSpend).toFixed(2) : "-";

        return (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              누적 성과
            </h3>
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-0.5">
                  누적 광고비
                </p>
                <p className="text-xl font-bold text-rose-600">
                  {cumAdSpend > 0
                    ? `${(cumAdSpend / 10000).toLocaleString()}만`
                    : "0원"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  M{((cumulativeAdSpend?.meta || 0) / 10000).toFixed(0)} / G
                  {((cumulativeAdSpend?.google || 0) / 10000).toFixed(0)}
                </p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-0.5">
                  누적 접수
                </p>
                <p className="text-xl font-bold">{stats.total}건</p>
                <p className="text-[10px] text-muted-foreground">
                  홈{stats.website} / M{stats.meta} / G{stats.googleAds}
                </p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-0.5">
                  누적 계약
                </p>
                <p className="text-xl font-bold text-emerald-600">
                  {stats.contractCount}건
                </p>
                <p className="text-[10px] text-muted-foreground">
                  계약률 {cumContractRate}%
                </p>
              </div>
              <div className="rounded-lg border p-3 bg-muted/30">
                <p className="text-xs text-muted-foreground mb-0.5">
                  누적 매출
                </p>
                <p className="text-xl font-bold text-amber-600">
                  {stats.totalRevenue > 0
                    ? `${(stats.totalRevenue / 10000).toLocaleString()}만`
                    : "0원"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  ROAS {cumRoas}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 필터 + 검색 */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            {/* 소스 필터 */}
            {/* 소스 필터 */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
              {[
                { value: "all" as const, label: "전체" },
                { value: "website" as const, label: "홈페이지", icon: Globe },
                { value: "meta" as const, label: "Meta", icon: Megaphone },
                {
                  value: "google_ads" as const,
                  label: "구글광고",
                  icon: Search,
                },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    sourceFilter === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => setSourceFilter(tab.value)}
                >
                  {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                  {tab.label}
                </button>
              ))}
            </div>
            {/* 상태 필터 */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 shrink-0">
              {[
                { value: "all", label: "상태 전체" },
                { value: "", label: "미분류" },
                { value: "신규", label: "신규" },
                { value: "상담중", label: "상담중" },
                { value: "계약완료", label: "계약완료" },
                { value: "보류", label: "보류" },
              ].map((tab) => (
                <button
                  key={`status-${tab.value}-${tab.label}`}
                  type="button"
                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    statusFilter === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setStatusFilter(tab.value)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {/* 기간 필터 */}
              {[
                { label: "전체", days: 0 },
                { label: "오늘", days: 1 },
                { label: "7일", days: 7 },
                { label: "30일", days: 30 },
                { label: "60일", days: 60 },
                { label: "90일", days: 90 },
              ].map((p) => (
                <button
                  key={p.days}
                  type="button"
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    datePreset === p.days && !customDateStart
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => {
                    setDatePreset(p.days);
                    setCustomDateStart("");
                    setCustomDateEnd("");
                  }}
                >
                  {p.label}
                </button>
              ))}
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={customDateStart}
                  onChange={(e) => {
                    setCustomDateStart(e.target.value);
                    setDatePreset(0);
                  }}
                  className="h-7 px-1.5 text-xs border rounded-md w-[110px]"
                />
                <span className="text-xs text-muted-foreground">~</span>
                <input
                  type="date"
                  value={customDateEnd}
                  onChange={(e) => {
                    setCustomDateEnd(e.target.value);
                    setDatePreset(0);
                  }}
                  className="h-7 px-1.5 text-xs border rounded-md w-[110px]"
                />
              </div>
            </div>
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="이름, 회사, 연락처 검색..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 카드 그리드 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredInquiries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">
            {searchQuery || statusFilter !== "all"
              ? "검색 결과가 없습니다"
              : "문의가 없습니다"}
          </h3>
          <p className="text-sm text-muted-foreground">
            새로운 문의가 들어오면 여기에 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(() => {
            // 날짜별 그룹핑
            const grouped: { date: string; items: typeof filteredInquiries }[] =
              [];
            let currentDate = "";
            for (const inquiry of filteredInquiries) {
              const d = new Date(inquiry.createdAt);
              const dateStr = `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}`;
              if (dateStr !== currentDate) {
                currentDate = dateStr;
                grouped.push({ date: dateStr, items: [] });
              }
              grouped[grouped.length - 1].items.push(inquiry);
            }
            return grouped.map((group) => (
              <div key={group.date}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-sm font-semibold text-muted-foreground whitespace-nowrap">
                    {group.date} ({group.items.length}건)
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                  {group.items.map((inquiry) => {
                    const wizard = parseWizardMessage(inquiry.message);
                    const memoCount = parseMemos(inquiry.memo).length;
                    const isNew = isNewInquiry(inquiry.status);
                    const isBlocked =
                      !!inquiry.phone &&
                      blacklistedPhones.has(
                        normalizePhoneClient(inquiry.phone),
                      );
                    // 활성 조건: 홈페이지/구글=항상, Meta=문자회신 체크된 것만
                    const isActive =
                      !isBlocked &&
                      inquiry.status !== "계약완료" &&
                      inquiry.status !== "보류" &&
                      (inquiry.source !== "meta" || inquiry.smsReply);
                    const isContract = inquiry.status === "계약완료";
                    const isHold = inquiry.status === "보류";
                    return (
                      <Card
                        key={inquiry.id}
                        className={`cursor-pointer overflow-hidden transition-all hover:shadow-md group relative ${
                          isBlocked
                            ? "ring-1 ring-red-700 bg-zinc-900/10 border-l-4 border-l-red-700"
                            : isActive
                              ? inquiry.source === "meta"
                                ? "ring-1 ring-[#0668E1] bg-blue-50/60 dark:bg-blue-950/20 border-l-2 border-l-[#0668E1]"
                                : inquiry.source === "google_ads"
                                  ? "ring-1 ring-green-400 bg-green-50/60 dark:bg-green-950/20 border-l-2 border-l-green-500"
                                  : "ring-1 ring-orange-400 bg-orange-50/60 dark:bg-orange-950/20 border-l-2 border-l-orange-500"
                              : ""
                        }`}
                        onClick={() => setSelectedInquiry(inquiry)}
                      >
                        {/* 블랙리스트: 검정 오버레이 (가장 진하게) — 다른 오버레이 우선 */}
                        {isBlocked ? (
                          <div className="absolute inset-0 bg-black/80 pointer-events-none z-10 rounded-[inherit]" />
                        ) : isContract ? (
                          /* 계약완료: 초록 오버레이 */
                          <div className="absolute inset-0 bg-emerald-900/40 pointer-events-none z-10 rounded-[inherit]" />
                        ) : (
                          !isActive && (
                            /* 보류/Meta미회신: 검정 오버레이 */
                            <div className="absolute inset-0 bg-black/50 pointer-events-none z-10 rounded-[inherit]" />
                          )
                        )}
                        {/* 블랙리스트 뱃지 (오버레이 위에 표시) */}
                        {isBlocked && (
                          <div className="absolute top-2 right-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white bg-red-700 shadow-md">
                            <Ban className="h-3 w-3" />
                            블랙리스트
                          </div>
                        )}
                        {/* 우선순위 스트라이프 */}
                        <div
                          className={`h-[3px] w-full ${isBlocked ? "bg-red-700" : getStripeColor(inquiry.status)}`}
                        />

                        <CardContent className="p-4">
                          {/* 상단: 아바타 + 이름 + 뱃지 */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className="relative shrink-0">
                              <Avatar className="h-10 w-10">
                                <AvatarFallback
                                  className={`${getAvatarColor(inquiry.name)} text-white text-sm font-semibold`}
                                >
                                  {inquiry.name.slice(0, 1)}
                                </AvatarFallback>
                              </Avatar>
                              {isNew && (
                                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-background" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm truncate">
                                  {inquiry.name}
                                </p>
                                {inquiry.source === "meta" ? (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white shrink-0"
                                    style={{ background: "#0668E1" }}
                                  >
                                    Meta
                                  </span>
                                ) : inquiry.source === "google_ads" ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white shrink-0 bg-green-600">
                                    구글
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold text-white shrink-0 bg-orange-500">
                                    홈페이지
                                  </span>
                                )}
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 cursor-pointer relative z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMarketingContractInquiry(inquiry);
                                    setMarketingAmountInput("");
                                    setMarketingDialogOpen(true);
                                  }}
                                >
                                  <FileSignature className="h-2.5 w-2.5" />
                                  마케팅계약
                                </span>
                                <span
                                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 cursor-pointer relative z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-amber-100 text-amber-700 hover:bg-amber-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProductInquiry(inquiry);
                                    setProductNameInput("");
                                    setProductAmountInput("");
                                    setProductDialogOpen(true);
                                  }}
                                >
                                  <Package className="h-2.5 w-2.5" />
                                  추가상품
                                </span>
                              </div>
                              {inquiry.company && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {inquiry.company}
                                </p>
                              )}
                              {inquiry.phone && (
                                <a
                                  href={`tel:${inquiry.phone}`}
                                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Phone className="h-3 w-3" />
                                  {inquiry.phone}
                                </a>
                              )}
                            </div>
                            <div className="shrink-0">
                              {inquiry.status ? (
                                <Badge
                                  variant={
                                    (STATUS_COLORS[inquiry.status] as
                                      | "default"
                                      | "secondary"
                                      | "outline") || "secondary"
                                  }
                                  className={`text-xs ${
                                    inquiry.status === "계약완료"
                                      ? "bg-green-100 text-green-700 hover:bg-green-100"
                                      : inquiry.status === "상담중"
                                        ? "border-blue-300 text-blue-700"
                                        : ""
                                  }`}
                                >
                                  {inquiry.status}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className="text-xs text-muted-foreground"
                                >
                                  미분류
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* 본문: 메시지 미리보기 */}
                          <div className="mb-3">
                            {wizard ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] shrink-0"
                                  >
                                    진단
                                  </Badge>
                                  <span className="text-sm text-muted-foreground truncate">
                                    {wizard.업종}
                                  </span>
                                </div>
                                {wizard.고민 !== "-" && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">
                                    고민: {wizard.고민}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {inquiry.message}
                              </p>
                            )}
                          </div>

                          {/* 메모 미리보기 */}
                          {memoCount > 0 && (
                            <div className="mb-3 px-2.5 py-2 rounded-md bg-muted/50 space-y-1">
                              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                                <StickyNote className="h-3 w-3" />
                                메모 ({memoCount})
                              </div>
                              {parseMemos(inquiry.memo)
                                .slice(-2)
                                .map((entry) => (
                                  <p
                                    key={entry.id}
                                    className="text-xs text-muted-foreground line-clamp-1"
                                  >
                                    {entry.text}
                                  </p>
                                ))}
                            </div>
                          )}

                          {/* 수신확인 배지 */}
                          {inquiry.reportEmailOpenedAt && (
                            <div className="mb-3 flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-green-500/10 border border-green-500/20">
                              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                              <span className="text-green-600 dark:text-green-400 text-xs font-medium">
                                리포트 열람
                              </span>
                              <span className="text-muted-foreground text-xs ml-auto">
                                {new Date(
                                  inquiry.reportEmailOpenedAt,
                                ).toLocaleDateString("ko-KR", {
                                  month: "numeric",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          )}
                          {inquiry.reportStatus === "sent" &&
                            !inquiry.reportEmailOpenedAt && (
                              <div className="mb-3 flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted/50">
                                <span className="w-2 h-2 rounded-full bg-muted-foreground/30 shrink-0" />
                                <span className="text-muted-foreground text-xs">
                                  리포트 발송 (미열람)
                                </span>
                              </div>
                            )}

                          {/* 하단: 시간 + 메모 + SMS + 액션 */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatRelativeTime(inquiry.createdAt)}
                              </span>
                              {memoCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <StickyNote className="h-3 w-3" />
                                  {memoCount}
                                </span>
                              )}
                              {inquiry.source === "meta" &&
                                inquiry.smsStatus === "발송완료" && (
                                  <span className="flex items-center gap-1 text-emerald-600">
                                    <CheckCircle2 className="h-3 w-3" />
                                    SMS
                                  </span>
                                )}
                              {inquiry.source === "meta" &&
                                inquiry.smsReply && (
                                  <span className="flex items-center gap-1 text-[#0668E1]">
                                    <Reply className="h-3 w-3" />
                                    회신
                                  </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1 relative z-20">
                              {inquiry.phone && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="이 번호를 블랙리스트에 등록"
                                  className="h-7 px-2 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAddBlacklistDialog({
                                      open: true,
                                      inquiry,
                                      reason: "",
                                    });
                                  }}
                                >
                                  <Ban className="h-3.5 w-3.5 mr-1" />
                                  <span className="text-xs">블랙리스트</span>
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
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
                                      문의를 삭제하시겠습니까?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      이 작업은 되돌릴 수 없습니다.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() =>
                                        handleDeleteById(inquiry.id)
                                      }
                                    >
                                      삭제
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
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
              </div>
            ));
          })()}
        </div>
      )}

      {/* 상세 모달 */}
      <Dialog
        open={!!selectedInquiry}
        onOpenChange={(open) => !open && setSelectedInquiry(null)}
      >
        <DialogContent
          className="max-w-lg max-h-[85vh] overflow-y-auto overflow-x-hidden grid-cols-[minmax(0,1fr)]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          {selectedInquiry && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback>
                        {selectedInquiry.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <DialogTitle className="text-lg truncate">
                        {selectedInquiry.name}
                      </DialogTitle>
                      {selectedInquiry.company && (
                        <p className="text-sm text-muted-foreground truncate">
                          {selectedInquiry.company}
                        </p>
                      )}
                    </div>
                  </div>
                  {selectedInquiry.phone &&
                    (blacklistedPhones.has(
                      normalizePhoneClient(selectedInquiry.phone),
                    ) ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        className="shrink-0 mr-8 border-red-700 text-red-700 bg-red-50"
                      >
                        <Ban className="h-3.5 w-3.5 mr-1.5" />
                        블랙리스트 등록됨
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 mr-8 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                        onClick={() =>
                          setAddBlacklistDialog({
                            open: true,
                            inquiry: selectedInquiry,
                            reason: "",
                          })
                        }
                      >
                        <Ban className="h-3.5 w-3.5 mr-1.5" />
                        블랙리스트 등록
                      </Button>
                    ))}
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
                  ) : selectedInquiry.source === "google_ads" ? (
                    <Badge
                      variant="outline"
                      className="text-xs border-green-600 text-green-700"
                    >
                      <Search className="h-3 w-3 mr-1" />
                      구글 접수
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-xs border-orange-300 text-orange-600"
                    >
                      <Globe className="h-3 w-3 mr-1" />
                      홈페이지
                    </Badge>
                  )}
                  {selectedInquiry.adName && (
                    <span className="text-xs text-muted-foreground break-all">
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
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a
                        href={`mailto:${selectedInquiry.email}`}
                        className="text-blue-600 hover:underline break-all min-w-0"
                      >
                        {selectedInquiry.email}
                      </a>
                    </div>
                  )}
                  {selectedInquiry.phone && (
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <a
                        href={`tel:${selectedInquiry.phone}`}
                        className="hover:underline break-all"
                      >
                        {selectedInquiry.phone}
                      </a>
                    </div>
                  )}
                  {selectedInquiry.company && (
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="break-words min-w-0">
                        {selectedInquiry.company}
                      </span>
                    </div>
                  )}
                  {selectedInquiry.industry && (
                    <div className="flex items-center gap-2 text-sm min-w-0">
                      <Megaphone className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="break-words min-w-0">
                        업종: {selectedInquiry.industry}
                      </span>
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
                    value={selectedInquiry.status || "__empty"}
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
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {selectedInquiry.message}
                        </p>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
                          <span className="text-muted-foreground">업종</span>
                          <span className="font-medium break-words">
                            {wizard.업종}
                          </span>
                          <span className="text-muted-foreground">현황</span>
                          <span className="font-medium break-words">
                            {wizard.현황}
                          </span>
                          <span className="text-muted-foreground">예산</span>
                          <span className="font-medium break-words">
                            {wizard.예산}
                          </span>
                          <span className="text-muted-foreground">고민</span>
                          <span className="font-medium break-words">
                            {wizard.고민}
                          </span>
                        </div>
                        <div className="mt-2 px-3 py-2 rounded-md bg-primary/5 border">
                          <span className="text-xs text-muted-foreground">
                            AI 추천
                          </span>
                          <p className="text-sm font-semibold text-primary break-words">
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
                                <p className="text-sm leading-snug break-words">
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

                <Button
                  variant="outline"
                  className="w-full text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  onClick={() => {
                    setMarketingContractInquiry(selectedInquiry);
                    setMarketingAmountInput("");
                    setMarketingDialogOpen(true);
                  }}
                >
                  <Banknote className="mr-2 h-4 w-4" />
                  마케팅계약 생성
                </Button>

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
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive hover:border-destructive"
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
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* 계약금액 입력 다이얼로그 */}
      <AlertDialog
        open={contractDialogOpen}
        onOpenChange={setContractDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계약 완료 처리</AlertDialogTitle>
            <AlertDialogDescription>
              거래처관리에 자동 등록되고, 입력한 금액은 매출로 집계됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">
                계약 금액 (원)
              </label>
              <input
                type="text"
                value={contractAmountInput}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "");
                  setContractAmountInput(
                    v ? parseInt(v, 10).toLocaleString() : "",
                  );
                }}
                placeholder="예: 1,000,000"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
              {contractAmountInput && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(
                    parseInt(contractAmountInput.replace(/,/g, ""), 10) / 10000
                  ).toLocaleString()}
                  만원
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                추가 비용 (원){" "}
                <span className="text-muted-foreground font-normal">
                  — 홈페이지 등
                </span>
              </label>
              <input
                type="text"
                value={contractExtraInput}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "");
                  setContractExtraInput(
                    v ? parseInt(v, 10).toLocaleString() : "",
                  );
                }}
                placeholder="추가 결제 금액 (선택)"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {contractExtraInput && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(
                    parseInt(contractExtraInput.replace(/,/g, ""), 10) / 10000
                  ).toLocaleString()}
                  만원
                </p>
              )}
            </div>
            {(contractAmountInput || contractExtraInput) && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 p-2.5 border border-amber-200 dark:border-amber-800">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                  매출 합계:{" "}
                  {(
                    ((parseInt(contractAmountInput.replace(/,/g, ""), 10) ||
                      0) +
                      (parseInt(contractExtraInput.replace(/,/g, ""), 10) ||
                        0)) /
                    10000
                  ).toLocaleString()}
                  만원
                </p>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatusId(null)}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleContractConfirm}>
              계약 완료
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 마케팅계약 다이얼로그 */}
      <AlertDialog
        open={marketingDialogOpen}
        onOpenChange={setMarketingDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>마케팅 계약 생성</AlertDialogTitle>
            <AlertDialogDescription>
              {marketingContractInquiry?.company} — 월정액 금액을 입력하세요
              (VAT포함). 거래처관리에 등록됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">
              월 계약 금액 (원)
            </label>
            <input
              type="text"
              value={marketingAmountInput}
              onChange={(e) => {
                const v = e.target.value.replace(/[^\d]/g, "");
                setMarketingAmountInput(
                  v ? parseInt(v, 10).toLocaleString() : "",
                );
              }}
              placeholder="예: 1,000,000"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              autoFocus
            />
            {marketingAmountInput && (
              <div className="mt-1 space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  {(
                    parseInt(marketingAmountInput.replace(/,/g, ""), 10) / 10000
                  ).toLocaleString()}
                  만원/월
                </p>
                <p className="text-xs font-medium text-amber-600">
                  매출 반영: ×6개월 ={" "}
                  {(
                    (parseInt(marketingAmountInput.replace(/,/g, ""), 10) * 6) /
                    10000
                  ).toLocaleString()}
                  만원
                </p>
              </div>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setMarketingContractInquiry(null)}
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleMarketingContract}
            >
              마케팅계약 생성
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 추가상품 다이얼로그 */}
      <AlertDialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>추가상품 등록</AlertDialogTitle>
            <AlertDialogDescription>
              {productInquiry?.company || productInquiry?.name} — 상품명과
              금액을 입력하세요. 거래처와 매출에 반영됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">상품명</label>
              <input
                type="text"
                value={productNameInput}
                onChange={(e) => setProductNameInput(e.target.value)}
                placeholder="예: 홈페이지 제작, 로고 디자인"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">
                금액 (원)
              </label>
              <input
                type="text"
                value={productAmountInput}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "");
                  setProductAmountInput(
                    v ? parseInt(v, 10).toLocaleString() : "",
                  );
                }}
                placeholder="예: 1,000,000"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {productAmountInput && (
                <p className="text-xs text-muted-foreground mt-1">
                  {(
                    parseInt(productAmountInput.replace(/,/g, ""), 10) / 10000
                  ).toLocaleString()}
                  만원
                </p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setProductInquiry(null)}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleProductContract}
              disabled={!productNameInput.trim() || !productAmountInput}
            >
              추가상품 등록
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 광고비 입력 다이얼로그 */}
      <AlertDialog open={adSpendDialogOpen} onOpenChange={setAdSpendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectedMonth.split("-")[1]}월 광고비 입력
            </AlertDialogTitle>
            <AlertDialogDescription>
              Meta 광고와 구글 광고비를 각각 입력하세요 (VAT포함).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Meta 광고비 (원)
              </label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="0"
                value={adSpendMetaInput}
                onChange={(e) =>
                  setAdSpendMetaInput(
                    e.target.value
                      .replace(/[^0-9]/g, "")
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                  )
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                구글 광고비 (원)
              </label>
              <input
                type="text"
                className="w-full border rounded-md px-3 py-2 text-sm"
                placeholder="0"
                value={adSpendGoogleInput}
                onChange={(e) =>
                  setAdSpendGoogleInput(
                    e.target.value
                      .replace(/[^0-9]/g, "")
                      .replace(/\B(?=(\d{3})+(?!\d))/g, ","),
                  )
                }
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={saveAdSpend}>저장</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 블랙리스트 등록 다이얼로그 */}
      <AlertDialog
        open={addBlacklistDialog.open}
        onOpenChange={(open) =>
          setAddBlacklistDialog((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-amber-600" />
              블랙리스트 등록
            </AlertDialogTitle>
            <AlertDialogDescription>
              {addBlacklistDialog.inquiry?.name || "-"} ·{" "}
              {addBlacklistDialog.inquiry?.phone || ""}
              <br />
              <span className="text-xs">
                등록 후 이 번호로 접수되는 모든 건은 메일·SMS 발송이 차단되고,
                내부에는 텔레그램 알림만 전송됩니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="text-sm font-medium mb-1 block">
              사유 (선택)
            </label>
            <Textarea
              placeholder="예: 반복 스팸, 욕설, 동종업체 등"
              value={addBlacklistDialog.reason}
              onChange={(e) =>
                setAddBlacklistDialog((prev) => ({
                  ...prev,
                  reason: e.target.value,
                }))
              }
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleAddBlacklist}
            >
              등록
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 블랙리스트 관리 모달 */}
      <Dialog open={blacklistDialogOpen} onOpenChange={setBlacklistDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              블랙리스트 관리
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            {blacklistLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : blacklistEntries.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                등록된 블랙리스트가 없습니다.
              </div>
            ) : (
              <div className="space-y-2">
                {blacklistEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 p-3 border rounded-md bg-muted/30"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {entry.name || "-"}
                        </span>
                        <code className="text-xs text-muted-foreground">
                          {entry.phone}
                        </code>
                        {entry.source && (
                          <Badge variant="outline" className="text-[10px]">
                            {entry.source}
                          </Badge>
                        )}
                      </div>
                      {entry.reason && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {entry.reason}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(entry.createdAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveBlacklist(entry.id)}
                    >
                      해제
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
