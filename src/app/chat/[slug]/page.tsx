"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Loader2,
  LockKeyhole,
  Paperclip,
  Plus,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  CHAT_TOPICS,
  formatRequestDisplayTitle,
  isClosedChatRequest,
  MAX_CHAT_FILE_SIZE,
  requestStatusLabel,
  type ChatMessage,
  type ChatRequest,
  type ChatRoom,
  type ChatTopic,
} from "@/lib/chat-shared";

function formatDateTime(value: string | null) {
  if (!value) return "";
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
  return room.company || room.clientName || "폴라애드 고객 채팅";
}

function statusClass(status: ChatRequest["status"]) {
  if (status === "done") return "bg-emerald-50 text-emerald-700";
  if (status === "cancelled") return "bg-slate-100 text-slate-500";
  if (status === "draft") return "bg-amber-50 text-amber-700";
  return "bg-blue-50 text-blue-700";
}

export default function ClientChatPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedRequestIdRef = useRef("");
  const hydratedRequestIdRef = useRef("");
  const [authenticated, setAuthenticated] = useState(false);
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [requests, setRequests] = useState<ChatRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [newTopic, setNewTopic] = useState<ChatTopic | "">("");
  const [newRequestBody, setNewRequestBody] = useState("");
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedRequest =
    requests.find((item) => item.id === selectedRequestId) || null;
  const closed = selectedRequest ? isClosedChatRequest(selectedRequest.status) : false;
  const showNewRequestForm =
    newRequestOpen || !selectedRequest || requests.length === 0;

  const fetchRequest = useCallback(async (requestId: string) => {
    if (!requestId) return;
    try {
      const res = await fetch(`/api/public/chat/requests/${requestId}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청건 조회 실패");
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청건 조회 실패");
    }
  }, []);

  const fetchPortal = useCallback(
    async (preferredRequestId?: string) => {
      try {
        const requestId = preferredRequestId || selectedRequestIdRef.current;
        const query = requestId
          ? `?request=${encodeURIComponent(requestId)}`
          : "";
        const res = await fetch(`/api/public/chat/rooms/${slug}${query}`, {
          cache: "no-store",
        });
        if (res.status === 401) {
          setAuthenticated(false);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "채팅방 조회 실패");
        const nextRequests = (data.requests || []) as ChatRequest[];
        setAuthenticated(true);
        setRoom(data.room);
        setRequests(nextRequests);
        const activeRequestId =
          typeof data.activeRequestId === "string" ? data.activeRequestId : "";
        if (activeRequestId) {
          hydratedRequestIdRef.current = activeRequestId;
          selectedRequestIdRef.current = activeRequestId;
          setSelectedRequestId(activeRequestId);
          setMessages((data.messages || []) as ChatMessage[]);
        } else {
          hydratedRequestIdRef.current = "";
          selectedRequestIdRef.current = "";
          setSelectedRequestId("");
          setMessages([]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "채팅방 조회 실패");
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  useEffect(() => {
    selectedRequestIdRef.current = selectedRequestId;
  }, [selectedRequestId]);

  useEffect(() => {
    fetchPortal();
    const timer = window.setInterval(() => {
      if (selectedRequestIdRef.current || authenticated) fetchPortal();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [authenticated, fetchPortal]);

  useEffect(() => {
    if (!selectedRequestId) {
      setMessages([]);
      return;
    }
    if (hydratedRequestIdRef.current === selectedRequestId) {
      hydratedRequestIdRef.current = "";
    } else {
      fetchRequest(selectedRequestId);
    }
    const timer = window.setInterval(() => fetchRequest(selectedRequestId), 5000);
    return () => window.clearInterval(timer);
  }, [fetchRequest, selectedRequestId]);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/chat/rooms/${slug}/auth/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "인증번호 발송 실패");
      setOtpSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증번호 발송 실패");
    } finally {
      setAuthLoading(false);
    }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/chat/rooms/${slug}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "인증 실패");
      const activeRequestId =
        typeof data.activeRequestId === "string" ? data.activeRequestId : "";
      setAuthenticated(true);
      setRoom(data.room);
      setRequests(data.requests || []);
      if (activeRequestId) {
        hydratedRequestIdRef.current = activeRequestId;
        selectedRequestIdRef.current = activeRequestId;
        setSelectedRequestId(activeRequestId);
        setMessages((data.messages || []) as ChatMessage[]);
      } else {
        setSelectedRequestId(data.requests?.[0]?.id || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "인증 실패");
    } finally {
      setAuthLoading(false);
    }
  }

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopic) {
      setError("요청 주제를 선택해주세요.");
      return;
    }
    if (!newRequestBody.trim()) {
      setError("요청 내용을 입력해주세요.");
      return;
    }

    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/public/chat/rooms/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: newTopic, body: newRequestBody.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "요청건 생성 실패");
      setNewRequestBody("");
      setNewTopic("");
      setNewRequestOpen(false);
      await fetchPortal(data.request.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청건 생성 실패");
    } finally {
      setSending(false);
    }
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest || sending || closed) return;
    if (!replyBody.trim() && !selectedFile) {
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
        formData.set("body", replyBody.trim());
        formData.set("file", selectedFile);
        res = await fetch(
          `/api/public/chat/requests/${selectedRequest.id}/attachments`,
          { method: "POST", body: formData },
        );
      } else {
        res = await fetch(
          `/api/public/chat/requests/${selectedRequest.id}/messages`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ body: replyBody.trim() }),
          },
        );
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "메시지 전송 실패");
      setReplyBody("");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await fetchPortal(selectedRequest.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "메시지 전송 실패");
    } finally {
      setSending(false);
    }
  }

  function handleReplyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    e.currentTarget.form?.requestSubmit();
  }

  async function handleDownload(message: ChatMessage) {
    if (!message.attachment || message.attachment.deletedAt) return;
    const res = await fetch(
      `/api/public/chat/attachments/${message.attachment.id}/download`,
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
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb]">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_34%),linear-gradient(135deg,#f8fafc,#eef2ff)] p-4">
        <div className="mx-auto mt-12 max-w-md rounded-[2rem] border border-white/70 bg-white/95 p-7 shadow-2xl shadow-slate-200/80">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-2xl bg-slate-950 p-3 text-white">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">고객 채팅방 인증</h1>
              <p className="text-sm text-slate-500">
                등록된 이메일로 인증번호를 받아 입장합니다.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={requestOtp} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="등록된 이메일"
              className="h-12 w-full rounded-xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500"
              required
            />
            <Button type="submit" className="w-full" disabled={authLoading}>
              {authLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              인증번호 받기
            </Button>
          </form>

          {otpSent && (
            <form onSubmit={verifyOtp} className="mt-5 space-y-3">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                maxLength={6}
                placeholder="6자리 인증번호"
                className="h-12 w-full rounded-xl border border-slate-200 px-4 text-center text-lg tracking-[0.35em] outline-none focus:border-blue-500"
                required
              />
              <Button
                type="submit"
                className="w-full"
                variant="secondary"
                disabled={authLoading}
              >
                인증 후 입장
              </Button>
            </form>
          )}

          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            링크가 있어도 등록 이메일 인증 전에는 메시지, 요청건, 파일에 접근할 수
            없습니다.
          </p>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f6f8fb] p-6">
        <div className="max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold">채팅방을 찾을 수 없습니다.</h1>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_34%),linear-gradient(135deg,#f8fafc,#eef2ff)] p-3 md:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] max-w-7xl overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-2xl shadow-slate-200/70 backdrop-blur md:min-h-[calc(100vh-3rem)] lg:grid-cols-[340px_minmax(0,1fr)]">
        <aside
          className={`${
            selectedRequest ? "order-2" : "order-1"
          } border-b bg-white/80 p-4 lg:order-1 lg:border-b-0 lg:border-r lg:p-5`}
        >
          <div className="mb-5">
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-600">
              POLARAD CLIENT CHAT
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              {roomTitle(room)}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              요청건별로 대화가 분리됩니다.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              요청건 목록
            </div>
            {requests.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedRequestId(item.id)}
                className={`w-full rounded-2xl border p-3 text-left transition ${
                  selectedRequestId === item.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                } ${isClosedChatRequest(item.status) ? "opacity-75" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="line-clamp-2 text-sm font-bold text-slate-900">
                    {formatRequestDisplayTitle(item)}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${statusClass(item.status)}`}
                  >
                    {requestStatusLabel(item.status)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {item.topic || "주제 미지정"} · 최근{" "}
                  {formatDateTime(item.lastMessageAt || item.createdAt)}
                </div>
              </button>
            ))}
            {requests.length === 0 && (
              <div className="rounded-2xl border border-dashed p-5 text-center text-sm text-slate-500">
                아직 요청건이 없습니다.
              </div>
            )}
          </div>

          <div className="mt-5">
            {!showNewRequestForm ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setNewRequestOpen(true)}
              >
                <Plus className="h-4 w-4" />새 요청건 만들기
              </Button>
            ) : (
              <form
                onSubmit={createRequest}
                className="rounded-2xl border bg-slate-50 p-3"
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                    <Plus className="h-4 w-4" />새 요청건
                  </div>
                  {selectedRequest && requests.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setNewRequestOpen(false)}
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                    >
                      닫기
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {CHAT_TOPICS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setNewTopic(item)}
                      className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                        newTopic === item
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <Textarea
                  value={newRequestBody}
                  onChange={(e) => setNewRequestBody(e.target.value)}
                  placeholder="새로 요청할 내용을 입력해주세요."
                  className="mt-3 min-h-24 rounded-xl bg-white"
                />
                <Button type="submit" className="mt-3 w-full" disabled={sending}>
                  요청건 생성
                </Button>
              </form>
            )}
          </div>
        </aside>

        <section
          className={`${
            selectedRequest ? "order-1" : "order-2"
          } flex min-h-[calc(100vh-1.5rem)] flex-col lg:order-2 lg:min-h-[680px]`}
        >
          <header className="border-b bg-slate-950 px-5 py-5 text-white">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  {selectedRequest
                    ? formatRequestDisplayTitle(selectedRequest)
                    : "요청건을 선택하세요"}
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  {selectedRequest?.summary ||
                    "관리자가 접수 후 제목과 요청사항을 정리합니다."}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-blue-100">
                <ShieldCheck className="h-4 w-4" />
                파일 10MB 이하
              </div>
            </div>
          </header>

          {selectedRequest?.items.length ? (
            <div className="border-b bg-white px-5 py-3">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                정리된 요청사항
              </div>
              <ol className="mt-2 space-y-1 text-sm text-slate-700">
                {selectedRequest.items.map((item, index) => (
                  <li key={item.id}>
                    {index + 1}. {item.content}
                    {item.status === "done" ? " (완료)" : ""}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50/80 p-4 md:p-6">
            {!selectedRequest ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed bg-white text-center text-sm text-slate-500">
                왼쪽에서 요청건을 선택하거나 새 요청건을 생성하세요.
              </div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed bg-white text-center text-sm text-slate-500">
                아직 메시지가 없습니다.
              </div>
            ) : (
              messages.map((message) => {
                const isClient = message.senderType === "client";
                return (
                  <div
                    key={message.id}
                    className={`flex ${isClient ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-2xl px-4 py-3 shadow-sm ${
                        isClient
                          ? "bg-blue-600 text-white"
                          : "border bg-white text-slate-900"
                      }`}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[11px] opacity-75">
                        <span>{isClient ? "나" : "폴라애드"}</span>
                        <span>· {formatDateTime(message.createdAt)}</span>
                      </div>
                      {message.body && (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.body}
                        </p>
                      )}
                      {message.attachment && (
                        <div
                          className={`mt-2 rounded-xl border p-3 text-xs ${
                            isClient
                              ? "border-white/20 bg-white/10"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-semibold">
                                {message.attachment.filename}
                              </div>
                              <div className="opacity-75">
                                {formatSize(message.attachment.sizeBytes)}
                                {message.attachment.deletedAt ? " · 삭제됨" : ""}
                              </div>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant={isClient ? "secondary" : "outline"}
                              disabled={Boolean(message.attachment.deletedAt)}
                              onClick={() => handleDownload(message)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      <div className="mt-2 text-right text-[11px] opacity-75">
                        {isClient
                          ? message.readByAdminAt
                            ? `폴라애드 수신확인 · ${formatDateTime(message.readByAdminAt)}`
                            : "폴라애드 미확인"
                          : message.readByClientAt
                            ? `내 수신확인 · ${formatDateTime(message.readByClientAt)}`
                            : "미확인"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendReply} className="space-y-3 border-t bg-white p-4">
            {closed && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                완료된 요청건입니다. 해당 채팅은 종료되어 추가 메시지를 보낼 수 없습니다.
              </div>
            )}
            {selectedFile && (
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-sm">
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
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              onKeyDown={handleReplyKeyDown}
              placeholder={
                closed ? "완료된 요청건입니다." : "요청건에 메시지를 추가하세요."
              }
              className="min-h-24 rounded-xl bg-white"
              disabled={!selectedRequest || closed}
            />
            <div className="flex items-center justify-between gap-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                disabled={!selectedRequest || closed}
              />
              <Button
                type="button"
                variant="outline"
                disabled={!selectedRequest || closed}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
                파일 첨부
              </Button>
              <span className="text-xs text-slate-500">
                Enter 전송 · Shift+Enter 줄바꿈
              </span>
              <Button type="submit" disabled={!selectedRequest || closed || sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                전송
              </Button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
