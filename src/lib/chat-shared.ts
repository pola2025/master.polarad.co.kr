export const CHAT_TOPICS = ["인쇄디자인", "홈페이지", "마케팅"] as const;
export const MAX_CHAT_FILE_SIZE = 10 * 1024 * 1024;

export type ChatTopic = (typeof CHAT_TOPICS)[number];
export type ChatSenderType = "client" | "admin";
export type ChatRequestStatus =
  | "draft"
  | "accepted"
  | "in_progress"
  | "done"
  | "cancelled";

export interface ChatAttachment {
  id: string;
  requestId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: ChatSenderType;
  downloadedAt: string | null;
  deletedAt: string | null;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  requestId: string;
  senderType: ChatSenderType;
  topic: string;
  body: string;
  readByClientAt: string | null;
  readByAdminAt: string | null;
  createdAt: string;
  attachment: ChatAttachment | null;
}

export interface ChatRoom {
  id: string;
  clientId: string;
  slug: string;
  chatUrl: string;
  clientEmail: string;
  clientName: string;
  company: string;
  status: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage?: {
    body: string;
    senderType: ChatSenderType;
    createdAt: string;
  };
  unreadAdminCount: number;
  requestCount?: number;
  openRequestCount?: number;
  draftRequestCount?: number;
}

export interface ChatRequestItem {
  id: string;
  requestId: string;
  content: string;
  status: "todo" | "done";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatRequest {
  id: string;
  roomId: string;
  clientId: string;
  topic: string;
  title: string;
  summary: string;
  status: ChatRequestStatus;
  acceptedAt: string | null;
  completedAt: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: ChatRequestItem[];
  unreadAdminCount: number;
}

export function isChatTopic(value: unknown): value is ChatTopic {
  return typeof value === "string" && CHAT_TOPICS.includes(value as ChatTopic);
}

export function isChatRequestStatus(value: unknown): value is ChatRequestStatus {
  return (
    value === "draft" ||
    value === "accepted" ||
    value === "in_progress" ||
    value === "done" ||
    value === "cancelled"
  );
}

export function isClosedChatRequest(status: ChatRequestStatus): boolean {
  return status === "done" || status === "cancelled";
}

export function requestStatusLabel(status: ChatRequestStatus): string {
  if (status === "draft") return "미접수";
  if (status === "accepted") return "접수";
  if (status === "in_progress") return "진행중";
  if (status === "done") return "완료";
  return "취소";
}

export function formatRequestDatePrefix(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16).replace("T", " ");
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return parts.replace("T", " ");
}

export function formatRequestDisplayTitle(request: Pick<ChatRequest, "createdAt" | "title" | "topic">): string {
  const title = request.title.trim() || request.topic || "요청건";
  return `${formatRequestDatePrefix(request.createdAt)} · ${title}`;
}
