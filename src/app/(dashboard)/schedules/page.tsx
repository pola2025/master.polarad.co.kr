"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Schedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  company: string;
  contactName: string;
  phone: string;
  memo: string;
  status: "scheduled" | "in_progress" | "completed" | "cancelled";
  reminderMinutes: number;
  reminderEnabled: boolean;
  reminderSentAt: string;
  reminder24hSentAt?: string;
  reminder1hSentAt?: string;
  reminder30mSentAt?: string;
  googleEventId: string;
  googleEventLink: string;
  source: string;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleStats {
  total: number;
  today: number;
  upcoming: number;
  completed: number;
}

const STATUS_LABEL: Record<Schedule["status"], string> = {
  scheduled: "예정",
  in_progress: "진행중",
  completed: "완료",
  cancelled: "취소",
};

const STATUS_CLASS: Record<Schedule["status"], string> = {
  scheduled: "bg-emerald-100 text-emerald-700 border-emerald-200",
  in_progress: "bg-amber-100 text-amber-700 border-amber-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-slate-100 text-slate-600 border-slate-200",
};

const EMPTY_FORM = {
  date: "",
  startTime: "10:00",
  endTime: "11:00",
  company: "",
  contactName: "",
  phone: "",
  memo: "",
  status: "scheduled" as Schedule["status"],
  reminderMinutes: 30,
  reminderEnabled: true,
  syncGoogle: true,
};

type ScheduleForm = typeof EMPTY_FORM;

function parseDateKey(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function formatDateKeyFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDaysToDateKey(date: string, days: number): string {
  const { year, month, day } = parseDateKey(date);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return formatDateKeyFromParts(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

function dayOfWeek(date: string): number {
  const { year, month, day } = parseDateKey(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function todayDateString() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatDate(date: string): string {
  if (!date) return "-";
  const { month, day } = parseDateKey(date);
  return `${month}월 ${day}일 (${WEEKDAYS[dayOfWeek(date)]})`;
}

function formatMonthTitle(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return `${year}년 ${monthIndex}월`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatReminder(schedule: Schedule): string {
  if (!schedule.reminderEnabled) return "알림 꺼짐";
  const sentCount = [schedule.reminder24hSentAt, schedule.reminder1hSentAt, schedule.reminder30mSentAt].filter(Boolean).length;
  return sentCount > 0 ? "3단계 알림 " + sentCount + "/3 발송" : "24시간 전 · 1시간 전 · 30분 전";
}

function isLocalEditable(schedule: Schedule) {
  return schedule.source !== "google_calendar" && !schedule.id.startsWith("gcal_");
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [stats, setStats] = useState<ScheduleStats>({ total: 0, today: 0, upcoming: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(todayDateString());
  const [activeMonth, setActiveMonth] = useState(todayDateString().slice(0, 7));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ScheduleForm>({ ...EMPTY_FORM, date: todayDateString() });

  async function fetchSchedules() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/schedules", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "일정을 불러오지 못했습니다.");
      setSchedules(data.schedules || []);
      setStats(data.stats || { total: 0, today: 0, upcoming: 0, completed: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "일정을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchSchedules();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schedules.filter((schedule) => {
      if (statusFilter !== "all" && schedule.status !== statusFilter) return false;
      if (!q) return true;
      return [schedule.company, schedule.contactName, schedule.phone, schedule.memo, schedule.date].some((value) =>
        value.toLowerCase().includes(q),
      );
    });
  }, [query, schedules, statusFilter]);

  const todaySchedules = useMemo(
    () => schedules.filter((schedule) => schedule.date === todayDateString() && schedule.status !== "cancelled"),
    [schedules],
  );

  const calendarCells = useMemo(() => {
    const [year, month] = activeMonth.split("-").map(Number);
    const firstDate = formatDateKeyFromParts(year, month, 1);
    const startDate = addDaysToDateKey(firstDate, -dayOfWeek(firstDate));
    const today = todayDateString();
    return Array.from({ length: 42 }, (_, index) => {
      const key = addDaysToDateKey(startDate, index);
      const { day } = parseDateKey(key);
      return {
        date: key,
        day,
        currentMonth: key.slice(0, 7) === activeMonth,
        isToday: key === today,
        isSelected: key === selectedDate,
        schedules: filtered.filter((schedule) => schedule.date === key),
      };
    });
  }, [activeMonth, filtered, selectedDate]);

  const selectedDaySchedules = useMemo(
    () => filtered.filter((schedule) => schedule.date === selectedDate),
    [filtered, selectedDate],
  );

  const monthScheduleCount = useMemo(
    () => filtered.filter((schedule) => schedule.date.slice(0, 7) === activeMonth).length,
    [activeMonth, filtered],
  );

  function resetForm(date = selectedDate || todayDateString()) {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, date });
  }

  function openCreate(date = selectedDate || todayDateString()) {
    setSelectedDate(date);
    setActiveMonth(date.slice(0, 7));
    resetForm(date);
    setFormOpen(true);
  }

  function openEdit(schedule: Schedule) {
    if (!isLocalEditable(schedule)) return;
    setEditingId(schedule.id);
    setForm({
      date: schedule.date,
      startTime: schedule.startTime,
      endTime: schedule.endTime || schedule.startTime,
      company: schedule.company,
      contactName: schedule.contactName,
      phone: schedule.phone,
      memo: schedule.memo,
      status: schedule.status,
      reminderMinutes: schedule.reminderMinutes || 30,
      reminderEnabled: schedule.reminderEnabled,
      syncGoogle: true,
    });
    setSelectedDate(schedule.date);
    setActiveMonth(schedule.date.slice(0, 7));
    setFormOpen(true);
  }

  async function saveSchedule() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/schedules", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      resetForm(form.date);
      setSelectedDate(form.date);
      setActiveMonth(form.date.slice(0, 7));
      setFormOpen(false);
      await fetchSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSchedule(id: string) {
    try {
      const res = await fetch("/api/schedules", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "삭제 실패");
      await fetchSchedules();
    } catch (err) {
      setError(err instanceof Error ? err.message : "삭제 실패");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-emerald-50 to-green-50 p-5 text-slate-900 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
              <CalendarClock className="h-3.5 w-3.5" /> Google Calendar + 로컬 일정관리
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">일정관리</h1>
            <p className="mt-1 text-sm text-slate-600">
              로컬 일정관리 UI를 관리자 대시보드 안에 통합했습니다. 캘린더에서 날짜를 고르고 우측 카드에서 해당 일정을 바로 확인합니다.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center sm:min-w-[420px]">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">전체</p><p className="text-2xl font-bold text-slate-950">{stats.total}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">오늘</p><p className="text-2xl font-bold text-emerald-700">{stats.today}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">예정</p><p className="text-2xl font-bold text-amber-600">{stats.upcoming}</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-xs text-slate-500">완료</p><p className="text-2xl font-bold text-emerald-600">{stats.completed}</p></div>
          </div>
        </div>
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) resetForm(form.date || selectedDate || todayDateString());
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              {editingId ? "일정 수정" : "일정 등록"}
            </DialogTitle>
            <DialogDescription>
              일정 저장 시 로컬 DB에 기록하고, 옵션이 켜져 있으면 Google Calendar에도 동기화합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>날짜</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div className="space-y-2"><Label>시작</Label><Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
              <div className="space-y-2"><Label>종료</Label><Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label>업체명 *</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="예: 폴라애드" /></div>
              <div className="space-y-2"><Label>담당자명</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="예: 홍길동" /></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <div className="space-y-2"><Label>연락처</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="01012345678" /></div>
              <div className="space-y-2">
                <Label>진행상태</Label>
                <Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as Schedule["status"] })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">예정</SelectItem>
                    <SelectItem value="in_progress">진행중</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                    <SelectItem value="cancelled">취소</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>진행 메모</Label>
              <Textarea rows={5} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} placeholder="상담 내용, 준비사항, 다음 액션 등을 입력" />
            </div>

            <div className="grid gap-3 rounded-2xl border bg-slate-50 p-4 text-sm">
              <div className="flex items-start gap-3">
                <Bell className="mt-0.5 h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">텔레그램 3단계 고정 알림</p>
                  <p className="text-muted-foreground">모든 일정은 24시간 전, 1시간 전, 30분 전에 각각 1회씩 알림을 보냅니다.</p>
                </div>
              </div>
              <label className="flex items-center justify-between gap-3">
                <span>Google Calendar에 동기화</span>
                <input type="checkbox" checked={form.syncGoogle} onChange={(e) => setForm({ ...form, syncGoogle: e.target.checked })} />
              </label>
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setFormOpen(false); resetForm(form.date || selectedDate); }}>
                <X className="mr-2 h-4 w-4" />취소
              </Button>
              <Button className="flex-1" onClick={saveSchedule} disabled={saving || !form.company || !form.date || !form.startTime}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {editingId ? "수정 저장" : "일정 저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input className="pl-9" placeholder="업체명, 담당자, 연락처, 메모 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full xl:w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    <SelectItem value="scheduled">예정</SelectItem>
                    <SelectItem value="in_progress">진행중</SelectItem>
                    <SelectItem value="completed">완료</SelectItem>
                    <SelectItem value="cancelled">취소</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={fetchSchedules} disabled={loading}>
                  <RefreshCw className="mr-2 h-4 w-4" /> 새로고침
                </Button>
                <Button onClick={() => openCreate(selectedDate)}>
                  <Plus className="mr-2 h-4 w-4" /> 일정 등록
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-slate-200 shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b bg-slate-50 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">캘린더 일정</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{formatMonthTitle(activeMonth)} · {monthScheduleCount}건 표시</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setActiveMonth(shiftMonth(activeMonth, -1))}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => { const today = todayDateString(); setSelectedDate(today); setActiveMonth(today.slice(0, 7)); }}>오늘</Button>
                <Button variant="outline" size="sm" onClick={() => setActiveMonth(shiftMonth(activeMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="w-full overflow-hidden">
                  <div className="grid grid-cols-7 border-b bg-white text-center text-[11px] font-semibold text-muted-foreground sm:text-xs">
                    {WEEKDAYS.map((day) => <div key={day} className="px-1 py-2 sm:px-2 sm:py-3">{day}</div>)}
                  </div>
                  <div className="grid grid-cols-7">
                    {calendarCells.map((cell) => (
                      <button
                        key={cell.date}
                        type="button"
                        onClick={() => { setSelectedDate(cell.date); setActiveMonth(cell.date.slice(0, 7)); }}
                        onDoubleClick={() => openCreate(cell.date)}
                        className={"min-h-[96px] min-w-0 border-b border-r p-1 text-left transition hover:bg-emerald-50 sm:min-h-[132px] sm:p-2 " + (cell.currentMonth ? "bg-white" : "bg-slate-50 text-slate-400") + (cell.isSelected ? " ring-2 ring-inset ring-emerald-500" : "")}
                      >
                        <div className="mb-1 flex items-center justify-between gap-1 sm:mb-2">
                          <span className={"flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-7 sm:w-7 sm:text-sm " + (cell.isToday ? "bg-emerald-600 text-white" : "")}>{cell.day}</span>
                          {cell.schedules.length > 0 && <Badge variant="secondary" className="px-1 text-[10px] sm:px-2 sm:text-xs">{cell.schedules.length}</Badge>}
                        </div>
                        <div className="space-y-1">
                          {cell.schedules.slice(0, 3).map((schedule) => (
                            <div key={schedule.id} className="min-w-0 rounded-md border bg-white/90 px-1 py-0.5 shadow-sm sm:rounded-lg sm:px-2 sm:py-1">
                              <div className="flex min-w-0 items-center gap-1 text-[10px] font-semibold text-slate-900 sm:text-[11px]"><Clock className="hidden h-3 w-3 shrink-0 sm:block" /><span className="truncate">{schedule.startTime} {schedule.company}</span></div>
                              <div className="hidden truncate text-[11px] text-muted-foreground sm:block">{schedule.contactName || schedule.memo || STATUS_LABEL[schedule.status]}</div>
                            </div>
                          ))}
                          {cell.schedules.length > 3 && <div className="truncate px-0.5 text-[10px] text-emerald-700 sm:px-1 sm:text-[11px]">+{cell.schedules.length - 3}건</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <div>
                <CardTitle className="text-base">선택한 날짜</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{formatDate(selectedDate)}</p>
              </div>
              <Button size="sm" onClick={() => openCreate(selectedDate)}><Plus className="mr-2 h-4 w-4" />추가</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 text-slate-900 shadow-sm">
                <p className="text-sm font-medium text-emerald-700">{formatDate(selectedDate)}</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{selectedDaySchedules.length}건</p>
              </div>
              {selectedDaySchedules.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-muted-foreground">선택한 날짜에 일정이 없습니다. 상단 또는 우측 추가 버튼으로 등록하세요.</p>
              ) : (
                selectedDaySchedules.map((schedule) => (
                  <article key={schedule.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white text-sm shadow-sm">
                    <div className="border-b border-slate-100 bg-gradient-to-br from-white to-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className={STATUS_CLASS[schedule.status]}>{STATUS_LABEL[schedule.status]}</Badge>
                            {schedule.source === "google_calendar" ? <Badge variant="secondary">Google Calendar</Badge> : <Badge variant="secondary">로컬 저장</Badge>}
                          </div>
                          <h3 className="truncate text-lg font-bold leading-7 tracking-[-0.01em] text-slate-950">{schedule.company}</h3>
                          <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">상담 일정</p>
                        </div>
                        <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right ring-1 ring-emerald-100">
                          <p className="text-xs font-semibold text-emerald-700">TIME</p>
                          <p className="mt-0.5 whitespace-nowrap text-base font-bold tabular-nums text-emerald-900">{schedule.startTime}~{schedule.endTime}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 p-4">
                      <dl className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <dt className="text-[11px] font-semibold text-slate-400">담당자</dt>
                          <dd className="mt-1 truncate font-semibold text-slate-800">{schedule.contactName || "미입력"}</dd>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                          <dt className="text-[11px] font-semibold text-slate-400">연락처</dt>
                          <dd className="mt-1 truncate font-semibold text-slate-800">{schedule.phone || "미입력"}</dd>
                        </div>
                      </dl>

                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                        <div className="flex items-start gap-2">
                          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <div>
                            <p className="text-xs font-semibold text-emerald-800">알림 상태</p>
                            <p className="mt-1 text-sm text-emerald-900">{formatReminder(schedule)}</p>
                          </div>
                        </div>
                      </div>

                      {schedule.memo && (
                        <div className="rounded-xl border bg-white p-3">
                          <p className="text-[11px] font-semibold text-slate-400">진행 메모</p>
                          <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{schedule.memo}</p>
                        </div>
                      )}

                      <div className="flex justify-end gap-1 border-t border-slate-100 pt-3">
                        {schedule.googleEventLink && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={schedule.googleEventLink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                        {isLocalEditable(schedule) && <Button variant="ghost" size="sm" onClick={() => openEdit(schedule)}><Pencil className="h-4 w-4" /></Button>}
                        {isLocalEditable(schedule) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-red-600"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>일정을 삭제할까요?</AlertDialogTitle>
                                <AlertDialogDescription>{schedule.company} 일정과 연결된 Google Calendar 이벤트도 함께 삭제합니다.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteSchedule(schedule.id)}>삭제</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm">오늘 일정</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {todaySchedules.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-muted-foreground">오늘 등록된 일정이 없습니다.</p>
              ) : (
                todaySchedules.map((schedule) => (
                  <button key={schedule.id} className="w-full rounded-xl border p-3 text-left text-sm hover:bg-slate-50" onClick={() => { setSelectedDate(schedule.date); setActiveMonth(schedule.date.slice(0, 7)); }}>
                    <p className="font-semibold">{schedule.startTime} {schedule.company}</p>
                    <p className="truncate text-xs text-muted-foreground">{schedule.contactName || schedule.memo || "상세 미입력"}</p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
