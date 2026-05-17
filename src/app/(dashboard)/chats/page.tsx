"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Copy,
  Download,
  FileUp,
  Link2,
  Loader2,
  Mail,
  MessageCircle,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CHAT_TOPICS,
  formatRequestDisplayTitle,
  isClosedChatRequest,
  MAX_CHAT_FILE_SIZE,
  requestStatusLabel,
  type ChatMessage,
  type ChatRequest,
  type ChatRequestStatus,
  type ChatRoom,
  type ChatTopic,
} from "@/lib/chat-shared";

interface Client {
  id: string;
  company: string;
  contactName: string;
  email: string;
  phone: string;
  industry: string;
}

type InviteChoice = "none" | "email" | "sms";
type RequestItemDraft = { content: string; status: "todo" | "done" };

interface RequestDraft {
  title: string;
  summary: string;
  status: ChatRequestStatus;
  items: RequestItemDraft[];
}

const emptyCreateForm = {
  clientId: "",
  company: "",
  clientName: "",
  email: "",
  phone: "",
  industry: "",
  invite: "none" as InviteChoice,
};

const emptyEditRoomForm = {
  company: "",
  clientName: "",
  email: "",
  phone: "",
  industry: "",
  slug: "",
};

const requestStatuses: ChatRequestStatus[] = [
  "draft",
  "accepted",
  "in_progress",
  "done",
  "cancelled",
];

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)}KB`;
  return `${bytes}B`;
}

function roomTitle(room: ChatRoom) {
  return room.company || room.clientName || room.clientEmail || room.slug;
}

function statusVariant(status: ChatRequestStatus): "default" | "secondary" | "outline" {
  if (status === "done") return "default";
  if (status === "draft") return "secondary";
  if (status === "cancelled") return "outline";
  return "secondary";
}

function emptyRequestDraft(): RequestDraft {
  return {
    title: "",
    summary: "",
    status: "draft" as ChatRequestStatus,
    items: [{ content: "", status: "todo" }],
  };
}

export default function ChatsPage() {
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedRoomIdRef = useRef("");
  const selectedRequestIdRef = useRef("");
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [editRoomForm, setEditRoomForm] = useState(emptyEditRoomForm);
  const [editingRoom, setEditingRoom] = useState(false);
  const [manualTopic, setManualTopic] = useState<ChatTopic>("홈페이지");
  const [manualBody, setManualBody] = useState("");
  const [requestDraft, setRequestDraft] = useState(emptyRequestDraft);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingRequest, setSavingRequest] = useState(false);
  const [savingRoom, setSavingRoom] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId) || null;
  const selectedClient =
    selectedRoom && selectedRoom.clientId
      ? clients.find((client) => client.id === selectedRoom.clientId) || null
      : null;
  const selectedRequest =
    requests.find((item) => item.id === selectedRequestId) || null;
  const closed = selectedRequest ? isClosedChatRequest(selectedRequest.status) : false;
  const filteredRooms = rooms.filter((room) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return [room.company, room.clientName, room.clientEmail, room.slug]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const fetchRooms = useCallback(async (preferredRoomId?: string) => {
    setError("");
    try {
      const res = await fetch("/api/chat/rooms", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const nextRooms = (data.rooms || []) as ChatRoom[];
      setRooms(nextRooms);
      const preferred =
        preferredRoomId ||
        searchParams.get("room") ||
        selectedRoomIdRef.current ||
        nextRooms[0]?.id ||
        "";
      setSelectedRoomId(
        preferred && nextRooms.some((room) => room.id === preferred)
          ? preferred
          : nextRooms[0]?.id || "",
      );
    } catch {
      setError("채팅방 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  const fetchClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setClients(data.clients || []);
    } catch {
      /* optional */
    }
  }, []);

  const fetchRequests = useCallback(
    async (roomId: string, preferredRequestId?: string) => {
      if (!roomId) return;
      setRequestsLoading(true);
      try {
        const res = await fetch(`/api/chat/rooms/${roomId}/requests`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "요청건 조회 실패");
        const nextRequests = (data.requests || []) as ChatRequest[];
        setRequests(nextRequests);
        const preferred =
          preferredRequestId ||
          searchParams.get("request") ||
          selectedRequestIdRef.current ||
          nextRequests.find((item) => !isClosedChatRequest(item.status))?.id ||
          nextRequests[0]?.id ||
          "";
        setSelectedRequestId(
          preferred && nextRequests.some((item) => item.id === preferred)
            ? preferred
            : nextRequests[0]?.id || "",
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "요청건 조회 실패");
      } finally {
        setRequestsLoading(false);
      }
    },
    [searchParams],
  );

  const fetchRequestDetail = useCallback(async (requestId: string) => {
    if (!requestId) return;
    setMessagesLoading(true);
    try {
      const res = await fetch(`/api/chat/requests/${requestId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청건 조회 실패");
      const nextRequest = data.request as ChatRequest;
      setRequestDraft({
        title: nextRequest.title || "",
        summary: nextRequest.summary || "",
        status: nextRequest.status,
        items: nextRequest.items.length
          ? nextRequest.items.map((item) => ({
              content: item.content,
              status: item.status,
            }))
          : [{ content: "", status: "todo" }],
      });
      setMessages(data.messages || []);
      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청건 조회 실패");
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  const fetchMessagesOnly = useCallback(async (requestId: string) => {
    if (!requestId) return;
    try {
      const res = await fetch(`/api/chat/requests/${requestId}/messages`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "메시지 조회 실패");
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "메시지 조회 실패");
    }
  }, []);

  useEffect(() => {
    fetchRooms();
    fetchClients();
    const timer = window.setInterval(() => fetchRooms(), 10000);
    return () => window.clearInterval(timer);
  }, [fetchClients, fetchRooms]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
    setEditingRoom(false);
  }, [selectedRoomId]);

  useEffect(() => {
    selectedRequestIdRef.current = selectedRequestId;
  }, [selectedRequestId]);

  useEffect(() => {
    if (!selectedRoom) {
      setEditRoomForm(emptyEditRoomForm);
      return;
    }
    if (editingRoom) return;
    setEditRoomForm({
      company: selectedRoom.company || "",
      clientName: selectedRoom.clientName || "",
      email: selectedRoom.clientEmail || "",
      phone: selectedClient?.phone || "",
      industry: selectedClient?.industry || "",
      slug: selectedRoom.slug || "",
    });
  }, [editingRoom, selectedClient, selectedRoom]);

  useEffect(() => {
    if (!selectedRoomId) {
      setRequests([]);
      setSelectedRequestId("");
      return;
    }
    fetchRequests(selectedRoomId);
    const timer = window.setInterval(() => fetchRequests(selectedRoomId), 8000);
    return () => window.clearInterval(timer);
  }, [fetchRequests, selectedRoomId]);

  useEffect(() => {
    if (!selectedRequestId) {
      setMessages([]);
      setRequestDraft(emptyRequestDraft());
      return;
    }
    fetchRequestDetail(selectedRequestId);
    const timer = window.setInterval(
      () => fetchMessagesOnly(selectedRequestId),
      5000,
    );
    return () => window.clearInterval(timer);
  }, [fetchMessagesOnly, fetchRequestDetail, selectedRequestId]);

  async function sendInvite(room: ChatRoom, channel: InviteChoice, phone?: string) {
    if (channel === "none") return;
    const res = await fetch(`/api/chat/rooms/${room.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, phone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "초대 발송 실패");
    setNotice(channel === "email" ? "이메일 초대를 발송했습니다." : "문자 초대를 발송했습니다.");
  }

  async function handleCreateRoom(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "채팅방 생성 실패");
      if (createForm.invite !== "none") {
        await sendInvite(data.room, createForm.invite, createForm.phone);
      }
      setCreateForm(emptyCreateForm);
      await fetchRooms(data.room.id);
      setSelectedRoomId(data.room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "채팅방 생성 실패");
    }
  }

  function handleClientSelect(clientId: string) {
    const client = clients.find((item) => item.id === clientId);
    if (!client) {
      setCreateForm((prev) => ({ ...prev, clientId }));
      return;
    }
    setCreateForm({
      clientId,
      company: client.company || "",
      clientName: client.contactName || "",
      email: client.email || "",
      phone: client.phone || "",
      industry: client.industry || "",
      invite: createForm.invite,
    });
  }

  function updateEditRoomField(
    field: keyof typeof emptyEditRoomForm,
    value: string,
  ) {
    setEditingRoom(true);
    setEditRoomForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoom) return;
    setSavingRoom(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoom.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editRoomForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "거래처 수정 실패");
      setNotice("거래처 정보를 저장했습니다. 링크를 변경했다면 고객에게 다시 초대해주세요.");
      setEditingRoom(false);
      await fetchClients();
      await fetchRooms(data.room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "거래처 수정 실패");
    } finally {
      setSavingRoom(false);
    }
  }

  async function handleArchiveRoom() {
    if (!selectedRoom) return;
    const confirmed = window.confirm(
      "이 채팅방을 삭제하면 목록에서 숨김 처리되고 고객 링크가 닫힙니다. 기존 대화 데이터는 복구를 위해 보존됩니다.",
    );
    if (!confirmed) return;
    setSavingRoom(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoom.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "거래처 삭제 실패");
      setNotice("채팅방을 삭제했습니다. 고객 링크는 더 이상 열리지 않습니다.");
      setSelectedRoomId("");
      setSelectedRequestId("");
      setRequests([]);
      setMessages([]);
      await fetchRooms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "거래처 삭제 실패");
    } finally {
      setSavingRoom(false);
    }
  }

  async function handleCreateManualRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRoom) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/chat/rooms/${selectedRoom.id}/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: manualTopic, body: manualBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청건 생성 실패");
      setManualBody("");
      await fetchRequests(selectedRoom.id, data.request.id);
      await fetchRequestDetail(data.request.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청건 생성 실패");
    } finally {
      setSending(false);
    }
  }

  async function saveRequest(nextStatus?: ChatRequestStatus) {
    if (!selectedRequest) return;
    setSavingRequest(true);
    setError("");
    setNotice("");
    try {
      const status = nextStatus || requestDraft.status;
      const res = await fetch(`/api/chat/requests/${selectedRequest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: requestDraft.title,
          summary: requestDraft.summary,
          status,
          items: requestDraft.items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청건 저장 실패");
      setNotice(
        status === "done"
          ? "요청건을 완료 처리했고 채팅을 종료했습니다."
          : "요청건을 저장했습니다.",
      );
      if (selectedRoom) await fetchRequests(selectedRoom.id, data.request.id);
      await fetchRequestDetail(data.request.id);
      await fetchRooms(selectedRoomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청건 저장 실패");
    } finally {
      setSavingRequest(false);
    }
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest || sending || closed) return;
    if (!newMessage.trim() && !selectedFile) {
      setError("메시지 또는 파일을 입력해주세요.");
      return;
    }
    if (selectedFile && selectedFile.size > MAX_CHAT_FILE_SIZE) {
      setError("파일 크기는 10MB 이하만 가능합니다.");
      return;
    }

    setSending(true);
    setError("");
    try {
      let res: Response;
      if (selectedFile) {
        const formData = new FormData();
        formData.set("body", newMessage.trim());
        formData.set("file", selectedFile);
        res = await fetch(`/api/chat/requests/${selectedRequest.id}/attachments`, {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch(`/api/chat/requests/${selectedRequest.id}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: newMessage.trim() }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "메시지 전송 실패");
      setNewMessage("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (selectedRoom) await fetchRequests(selectedRoom.id, selectedRequest.id);
      await fetchRequestDetail(selectedRequest.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "메시지 전송 실패");
    } finally {
      setSending(false);
    }
  }

  function handleMessageKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  }

  async function handleDownload(message: ChatMessage) {
    if (!message.attachment || message.attachment.deletedAt) return;
    const res = await fetch(
      `/api/chat/attachments/${message.attachment.id}/download`,
    );
    if (!res.ok) {
      setError("첨부파일 다운로드에 실패했습니다.");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = message.attachment.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    await fetchRequestDetail(message.requestId || selectedRequestId);
  }

  async function copyLink() {
    if (!selectedRoom) return;
    await navigator.clipboard.writeText(selectedRoom.chatUrl);
    setNotice("고객 링크를 복사했습니다.");
  }

  function updateItem(
    index: number,
    patch: { content?: string; status?: "todo" | "done" },
  ) {
    setRequestDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            거래처별 요청건 상담과 텔레그램 답장을 한 곳에서 처리합니다.
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            폴라애드 고객채팅
          </h1>
        </div>
        <Button variant="outline" onClick={() => fetchRooms(selectedRoomId)}>
          <RefreshCw className="h-4 w-4" />
          새로고침
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      <div className="grid gap-4 2xl:grid-cols-[310px_340px_minmax(0,1fr)_300px]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4" />
              거래처 {rooms.length}개
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="회사, 담당자, 이메일 검색"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[760px] space-y-2 overflow-y-auto p-3 pt-0">
            {filteredRooms.map((room) => (
              <button
                key={room.id}
                type="button"
                onClick={() => setSelectedRoomId(room.id)}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  selectedRoomId === room.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:bg-muted/60"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {roomTitle(room)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {room.clientEmail || room.slug}
                    </div>
                  </div>
                  {room.unreadAdminCount > 0 && (
                    <Badge className="rounded-full">{room.unreadAdminCount}</Badge>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  <Badge variant="secondary">요청 {room.requestCount || 0}</Badge>
                  <Badge variant="outline">진행 {room.openRequestCount || 0}</Badge>
                  <Badge variant="outline">미접수 {room.draftRequestCount || 0}</Badge>
                </div>
                <div className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                  {room.lastMessage?.body || "아직 메시지가 없습니다."}
                </div>
              </button>
            ))}
            {filteredRooms.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                채팅방이 없습니다.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">요청건 목록</CardTitle>
            {selectedRoom && (
              <div className="text-xs text-muted-foreground">
                {roomTitle(selectedRoom)} · {selectedRoom.slug}
              </div>
            )}
          </CardHeader>
          <CardContent className="max-h-[760px] space-y-3 overflow-y-auto p-3 pt-0">
            {requestsLoading && requests.length === 0 ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              requests.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedRequestId(item.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selectedRequestId === item.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background hover:bg-muted/60"
                  } ${isClosedChatRequest(item.status) ? "opacity-75" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="line-clamp-2 text-sm font-semibold">
                      {formatRequestDisplayTitle(item)}
                    </div>
                    <Badge variant={statusVariant(item.status)}>
                      {requestStatusLabel(item.status)}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {item.topic || "주제 미지정"} · 최근{" "}
                    {formatDateTime(item.lastMessageAt || item.createdAt)}
                  </div>
                  {item.unreadAdminCount > 0 && (
                    <Badge className="mt-2 rounded-full">
                      새 메시지 {item.unreadAdminCount}
                    </Badge>
                  )}
                </button>
              ))
            )}
            {selectedRoom && requests.length === 0 && !requestsLoading && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                요청건이 없습니다.
              </div>
            )}

            {selectedRoom && (
              <form
                onSubmit={handleCreateManualRequest}
                className="rounded-xl border bg-muted/40 p-3"
              >
                <div className="mb-2 text-sm font-semibold">관리자 요청건 추가</div>
                <select
                  value={manualTopic}
                  onChange={(e) => setManualTopic(e.target.value as ChatTopic)}
                  className="mb-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CHAT_TOPICS.map((topic) => (
                    <option key={topic} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
                <Textarea
                  value={manualBody}
                  onChange={(e) => setManualBody(e.target.value)}
                  placeholder="필요 시 관리자 메모/첫 메시지"
                  className="min-h-20"
                />
                <Button type="submit" className="mt-2 w-full" disabled={sending}>
                  <Plus className="h-4 w-4" />
                  요청건 생성
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-[760px] overflow-hidden">
          {selectedRoom && selectedRequest ? (
            <div className="flex h-full min-h-[760px] flex-col">
              <div className="border-b p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">
                        {formatRequestDisplayTitle(selectedRequest)}
                      </h2>
                      <Badge variant={statusVariant(selectedRequest.status)}>
                        {requestStatusLabel(selectedRequest.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {selectedRoom.clientName || "담당자 미입력"} ·{" "}
                      {selectedRoom.clientEmail || "이메일 미입력"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={copyLink}>
                      <Copy className="h-4 w-4" />
                      링크 복사
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={selectedRoom.chatUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Link2 className="h-4 w-4" />
                        고객 링크
                      </a>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 border-b bg-background p-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>요청건 제목</Label>
                    <Input
                      value={requestDraft.title}
                      onChange={(e) =>
                        setRequestDraft((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      placeholder="예: 홈페이지 리뉴얼 견적"
                    />
                    <p className="text-xs text-muted-foreground">
                      목록에는 요청일시가 자동으로 앞에 붙습니다.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>채팅 내 요청사항 요약</Label>
                    <Textarea
                      value={requestDraft.summary}
                      onChange={(e) =>
                        setRequestDraft((prev) => ({
                          ...prev,
                          summary: e.target.value,
                        }))
                      }
                      placeholder="관리자가 대화 내용을 보고 핵심 요청을 요약합니다."
                      className="min-h-20"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>요청사항 체크리스트</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setRequestDraft((prev) => ({
                            ...prev,
                            items: [
                              ...prev.items,
                              { content: "", status: "todo" },
                            ],
                          }))
                        }
                      >
                        <Plus className="h-4 w-4" />
                        추가
                      </Button>
                    </div>
                    {requestDraft.items.map((item, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant={item.status === "done" ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            updateItem(index, {
                              status: item.status === "done" ? "todo" : "done",
                            })
                          }
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Input
                          value={item.content}
                          onChange={(e) =>
                            updateItem(index, { content: e.target.value })
                          }
                          placeholder={`요청사항 ${index + 1}`}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setRequestDraft((prev) => ({
                              ...prev,
                              items:
                                prev.items.length <= 1
                                  ? [{ content: "", status: "todo" }]
                                  : prev.items.filter((_, i) => i !== index),
                            }))
                          }
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
                  <div className="space-y-1.5">
                    <Label>상태</Label>
                    <select
                      value={requestDraft.status}
                      onChange={(e) =>
                        setRequestDraft((prev) => ({
                          ...prev,
                          status: e.target.value as ChatRequestStatus,
                        }))
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {requestStatuses.map((status) => (
                        <option key={status} value={status}>
                          {requestStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button
                    type="button"
                    className="w-full"
                    onClick={() => saveRequest()}
                    disabled={savingRequest}
                  >
                    {savingRequest && <Loader2 className="h-4 w-4 animate-spin" />}
                    요청건 저장
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => saveRequest("accepted")}
                    disabled={savingRequest || selectedRequest.status !== "draft"}
                  >
                    접수 처리
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    onClick={() => saveRequest("done")}
                    disabled={savingRequest || closed}
                  >
                    완료 후 채팅 종료
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-4">
                {messagesLoading && messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  messages.map((message) => {
                    const isAdmin = message.senderType === "admin";
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-2xl border px-4 py-3 shadow-sm ${
                            isAdmin
                              ? "border-primary/20 bg-primary text-primary-foreground"
                              : "border-border bg-background"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2 text-[11px] opacity-80">
                            <span>{isAdmin ? "폴라애드" : "고객"}</span>
                            <span>· {formatDateTime(message.createdAt)}</span>
                          </div>
                          {message.body && (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {message.body}
                            </p>
                          )}
                          {message.attachment && (
                            <div
                              className={`mt-2 rounded-lg border p-2 text-xs ${
                                isAdmin
                                  ? "border-white/20 bg-white/10"
                                  : "border-border bg-muted/60"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate font-medium">
                                    {message.attachment.filename}
                                  </div>
                                  <div className="opacity-75">
                                    {formatSize(message.attachment.sizeBytes)}
                                    {message.attachment.deletedAt
                                      ? " · 삭제됨"
                                      : ""}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isAdmin ? "secondary" : "outline"}
                                  disabled={Boolean(
                                    message.attachment.deletedAt,
                                  )}
                                  onClick={() => handleDownload(message)}
                                >
                                  <Download className="h-4 w-4" />
                                  다운로드
                                </Button>
                              </div>
                            </div>
                          )}
                          <div className="mt-2 text-right text-[11px] opacity-75">
                            {isAdmin
                              ? message.readByClientAt
                                ? `고객 수신확인 · ${formatDateTime(message.readByClientAt)}`
                                : "고객 미확인"
                              : message.readByAdminAt
                                ? `관리자 수신확인 · ${formatDateTime(message.readByAdminAt)}`
                                : "관리자 미확인"}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form
                onSubmit={handleSendMessage}
                className="space-y-3 border-t bg-background p-4"
              >
                {closed && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    완료된 요청건입니다. 해당 채팅은 종료되어 추가 메시지를 보낼 수
                    없습니다.
                  </div>
                )}
                {selectedFile && (
                  <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
                    <span className="truncate">
                      {selectedFile.name} · {formatSize(selectedFile.size)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      제거
                    </Button>
                  </div>
                )}
                <Textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleMessageKeyDown}
                  placeholder={
                    closed ? "종료된 요청건입니다." : "관리자 답장을 입력하세요."
                  }
                  className="min-h-24"
                  disabled={closed}
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      disabled={closed}
                      onChange={(e) =>
                        setSelectedFile(e.target.files?.[0] || null)
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={closed}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Paperclip className="h-4 w-4" />
                      파일 첨부
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Enter 전송 · Shift+Enter 줄바꿈
                    </p>
                  </div>
                  <Button type="submit" disabled={sending || closed}>
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    전송
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex min-h-[760px] items-center justify-center p-8 text-center text-muted-foreground">
              거래처와 요청건을 선택하세요.
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4" />새 채팅방
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleCreateRoom}>
                <div className="space-y-1.5">
                  <Label htmlFor="clientId">기존 거래처</Label>
                  <select
                    id="clientId"
                    value={createForm.clientId}
                    onChange={(e) => handleClientSelect(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">직접 입력</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.company || client.contactName || client.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company">회사명</Label>
                  <Input
                    id="company"
                    value={createForm.company}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        company: e.target.value,
                      }))
                    }
                    placeholder="거래처 회사명"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientName">담당자</Label>
                  <Input
                    id="clientName"
                    value={createForm.clientName}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        clientName: e.target.value,
                      }))
                    }
                    placeholder="담당자명"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">이메일</Label>
                  <Input
                    id="email"
                    type="email"
                    value={createForm.email}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="client@example.com"
                    required={!createForm.clientId}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">연락처</Label>
                  <Input
                    id="phone"
                    value={createForm.phone}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="010-0000-0000"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite">초대 발송</Label>
                  <select
                    id="invite"
                    value={createForm.invite}
                    onChange={(e) =>
                      setCreateForm((prev) => ({
                        ...prev,
                        invite: e.target.value as InviteChoice,
                      }))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="none">발송 안함</option>
                    <option value="email">이메일 초대</option>
                    <option value="sms">문자 초대</option>
                  </select>
                </div>
                <Button type="submit" className="w-full">
                  <FileUp className="h-4 w-4" />
                  링크 생성
                </Button>
              </form>
            </CardContent>
          </Card>

          {selectedRoom && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Pencil className="h-4 w-4" />
                  거래처 정보 수정
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={handleSaveRoom}>
                  <div className="space-y-1.5">
                    <Label htmlFor="editCompany">회사명</Label>
                    <Input
                      id="editCompany"
                      value={editRoomForm.company}
                      onChange={(e) =>
                        updateEditRoomField("company", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editClientName">담당자</Label>
                    <Input
                      id="editClientName"
                      value={editRoomForm.clientName}
                      onChange={(e) =>
                        updateEditRoomField("clientName", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editEmail">인증 이메일</Label>
                    <Input
                      id="editEmail"
                      type="email"
                      value={editRoomForm.email}
                      onChange={(e) =>
                        updateEditRoomField("email", e.target.value)
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      고객 OTP 인증은 이 이메일과 정확히 일치해야 발송됩니다.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editPhone">연락처</Label>
                    <Input
                      id="editPhone"
                      value={editRoomForm.phone}
                      onChange={(e) =>
                        updateEditRoomField("phone", e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="editSlug">채팅방 슬러그</Label>
                    <Input
                      id="editSlug"
                      value={editRoomForm.slug}
                      onChange={(e) =>
                        updateEditRoomField("slug", e.target.value)
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground break-all">
                      {`https://chat.polarad.co.kr/${editRoomForm.slug || selectedRoom.slug}`}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="submit" disabled={savingRoom}>
                      {savingRoom && <Loader2 className="h-4 w-4 animate-spin" />}
                      저장
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={savingRoom}
                      onClick={() => setEditingRoom(false)}
                    >
                      되돌리기
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    disabled={savingRoom}
                    onClick={handleArchiveRoom}
                  >
                    <Trash2 className="h-4 w-4" />
                    채팅방 삭제
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    삭제는 데이터 완전 삭제가 아니라 숨김/링크 차단 처리입니다.
                  </p>
                </form>
              </CardContent>
            </Card>
          )}

          {selectedRoom && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">고객 초대</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg bg-muted p-3 text-sm break-all">
                  {selectedRoom.chatUrl}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      sendInvite(selectedRoom, "email").catch((err) =>
                        setError(
                          err instanceof Error ? err.message : "초대 발송 실패",
                        ),
                      )
                    }
                  >
                    <Mail className="h-4 w-4" />
                    메일
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      sendInvite(selectedRoom, "sms").catch((err) =>
                        setError(
                          err instanceof Error ? err.message : "초대 발송 실패",
                        ),
                      )
                    }
                  >
                    <Smartphone className="h-4 w-4" />
                    문자
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  초대 링크 접속 후 고객은 등록 이메일 인증번호로 입장합니다.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
