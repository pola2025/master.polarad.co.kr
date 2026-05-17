import {
  d1All,
  d1Batch,
  d1First,
  d1Run,
  newId,
  nowIso,
  type D1Param,
} from "@/lib/d1-client";
import {
  CHAT_TOPICS,
  isChatRequestStatus,
  isChatTopic,
  isClosedChatRequest,
  MAX_CHAT_FILE_SIZE,
  type ChatAttachment,
  type ChatMessage,
  type ChatRequest,
  type ChatRequestItem,
  type ChatRequestStatus,
  type ChatRoom,
  type ChatSenderType,
  type ChatTopic,
} from "@/lib/chat-shared";
import redis from "@/lib/redis";

export {
  CHAT_TOPICS,
  isChatRequestStatus,
  isChatTopic,
  isClosedChatRequest,
  MAX_CHAT_FILE_SIZE,
  type ChatAttachment,
  type ChatMessage,
  type ChatRequest,
  type ChatRequestItem,
  type ChatRequestStatus,
  type ChatRoom,
  type ChatSenderType,
  type ChatTopic,
};

interface ClientRow {
  id: string;
  company: string;
  contact_name: string;
  phone: string;
  email: string;
  industry: string;
}

interface ChatRoomRow {
  id: string;
  client_id: string;
  slug: string;
  client_email: string;
  client_name: string;
  company: string;
  status: string;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  last_body?: string;
  last_sender_type?: ChatSenderType;
  last_created_at?: string;
  unread_admin_count?: number;
  request_count?: number;
  open_request_count?: number;
  draft_request_count?: number;
}

interface ChatRequestRow {
  id: string;
  room_id: string;
  client_id: string;
  topic: string;
  title: string;
  summary: string;
  status: ChatRequestStatus;
  accepted_at: string | null;
  completed_at: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
  unread_admin_count?: number;
}

interface ChatRequestItemRow {
  id: string;
  request_id: string;
  content: string;
  status: "todo" | "done";
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ChatMessageRow {
  id: string;
  room_id: string;
  request_id: string;
  sender_type: ChatSenderType;
  topic: string;
  body: string;
  attachment_id: string;
  read_by_client_at: string | null;
  read_by_admin_at: string | null;
  created_at: string;
  file_id: string | null;
  file_request_id: string | null;
  file_filename: string | null;
  file_content_type: string | null;
  file_size_bytes: number | null;
  file_uploaded_by: ChatSenderType | null;
  file_downloaded_at: string | null;
  file_deleted_at: string | null;
}

interface TelegramChatLinkRow {
  telegram_chat_id: string;
  telegram_message_id: number;
  room_id: string;
  request_id: string;
  chat_message_id: string;
}

interface TelegramSendResult {
  messageId: number;
  chatId: string;
}

const CHAT_TELEGRAM_TARGET_KEY = "chat:telegram:target_chat_id";

export function getChatBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CHAT_BASE_URL ||
    process.env.CHAT_BASE_URL ||
    "https://chat.polarad.co.kr"
  ).replace(/\/$/, "");
}

export function getChatUrl(slug: string): string {
  return `${getChatBaseUrl()}/${slug}`;
}

export function slugBaseFromCustomer(input: {
  email?: string;
  company?: string;
  clientName?: string;
}): string {
  const emailLocalPart = input.email?.split("@")[0] || "";
  return slugifyChatSlug(
    emailLocalPart || input.company || input.clientName || "client",
  );
}

export function slugifyChatSlug(value: string): string {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/[-.]{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 48);
  return slug || "client";
}

export function sanitizeChatFilename(value: string): string {
  const trimmed = value.trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 120);
  return trimmed || "attachment";
}

export function formatContentDisposition(filename: string): string {
  const asciiFallback = sanitizeChatFilename(filename).replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function makeChatFileKey(input: {
  roomId: string;
  attachmentId: string;
  filename: string;
}): string {
  return `chat/${input.roomId}/${input.attachmentId}/${sanitizeChatFilename(input.filename)}`;
}

export function normalizeRoom(row: ChatRoomRow): ChatRoom {
  return {
    id: row.id,
    clientId: row.client_id || "",
    slug: row.slug,
    chatUrl: getChatUrl(row.slug),
    clientEmail: row.client_email || "",
    clientName: row.client_name || "",
    company: row.company || "",
    status: row.status || "open",
    lastMessageAt: row.last_message_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessage: row.last_created_at
      ? {
          body: row.last_body || "",
          senderType: row.last_sender_type || "client",
          createdAt: row.last_created_at,
        }
      : undefined,
    unreadAdminCount: Number(row.unread_admin_count || 0),
    requestCount: Number(row.request_count || 0),
    openRequestCount: Number(row.open_request_count || 0),
    draftRequestCount: Number(row.draft_request_count || 0),
  };
}

export function normalizeRequest(
  row: ChatRequestRow,
  items: ChatRequestItem[] = [],
): ChatRequest {
  return {
    id: row.id,
    roomId: row.room_id,
    clientId: row.client_id || "",
    topic: row.topic || "",
    title: row.title || "",
    summary: row.summary || "",
    status: isChatRequestStatus(row.status) ? row.status : "draft",
    acceptedAt: row.accepted_at || null,
    completedAt: row.completed_at || null,
    lastMessageAt: row.last_message_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
    unreadAdminCount: Number(row.unread_admin_count || 0),
  };
}

export function normalizeRequestItem(row: ChatRequestItemRow): ChatRequestItem {
  return {
    id: row.id,
    requestId: row.request_id,
    content: row.content || "",
    status: row.status === "done" ? "done" : "todo",
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    roomId: row.room_id,
    requestId: row.request_id || "",
    senderType: row.sender_type,
    topic: row.topic || "",
    body: row.body || "",
    readByClientAt: row.read_by_client_at || null,
    readByAdminAt: row.read_by_admin_at || null,
    createdAt: row.created_at,
    attachment: row.file_id
      ? {
          id: row.file_id,
          requestId: row.file_request_id || row.request_id || "",
          filename: row.file_filename || "attachment",
          contentType: row.file_content_type || "application/octet-stream",
          sizeBytes: Number(row.file_size_bytes || 0),
          uploadedBy: row.file_uploaded_by || "client",
          downloadedAt: row.file_downloaded_at || null,
          deletedAt: row.file_deleted_at || null,
        }
      : null,
  };
}

async function getItemsForRequests(
  requestIds: string[],
): Promise<Map<string, ChatRequestItem[]>> {
  const itemsByRequest = new Map<string, ChatRequestItem[]>();
  if (requestIds.length === 0) return itemsByRequest;

  const placeholders = requestIds.map(() => "?").join(", ");
  const rows = await d1All<ChatRequestItemRow>(
    `SELECT id, request_id, content, status, sort_order, created_at, updated_at
       FROM chat_request_items
      WHERE request_id IN (${placeholders})
      ORDER BY request_id ASC, sort_order ASC, created_at ASC`,
    requestIds,
  );

  for (const row of rows) {
    const item = normalizeRequestItem(row);
    const next = itemsByRequest.get(item.requestId) || [];
    next.push(item);
    itemsByRequest.set(item.requestId, next);
  }
  return itemsByRequest;
}

export async function getChatRooms(): Promise<ChatRoom[]> {
  const rows = await d1All<ChatRoomRow>(
    `SELECT r.id, r.client_id, r.slug, r.client_email, r.client_name, r.company,
            r.status, r.last_message_at, r.created_at, r.updated_at,
            lm.body AS last_body, lm.sender_type AS last_sender_type,
            lm.created_at AS last_created_at,
            COALESCE(unread.count, 0) AS unread_admin_count,
            COALESCE(req_stats.request_count, 0) AS request_count,
            COALESCE(req_stats.open_request_count, 0) AS open_request_count,
            COALESCE(req_stats.draft_request_count, 0) AS draft_request_count
       FROM chat_rooms r
       LEFT JOIN chat_messages lm
         ON lm.id = (
           SELECT id FROM chat_messages
            WHERE room_id = r.id
            ORDER BY created_at DESC
            LIMIT 1
         )
       LEFT JOIN (
         SELECT room_id, COUNT(*) AS count
           FROM chat_messages
          WHERE sender_type = 'client'
            AND read_by_admin_at IS NULL
          GROUP BY room_id
       ) unread ON unread.room_id = r.id
       LEFT JOIN (
         SELECT room_id,
                SUM(CASE WHEN status != 'draft' THEN 1 ELSE 0 END) AS request_count,
                SUM(CASE WHEN status IN ('accepted', 'in_progress') THEN 1 ELSE 0 END) AS open_request_count,
                SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS draft_request_count
           FROM chat_requests
          GROUP BY room_id
       ) req_stats ON req_stats.room_id = r.id
      WHERE r.status != 'archived'
      ORDER BY COALESCE(r.last_message_at, r.created_at) DESC
      LIMIT 300`,
  );
  return rows.map(normalizeRoom);
}

export async function getRoomById(id: string): Promise<ChatRoom | null> {
  const row = await d1First<ChatRoomRow>(
    `SELECT id, client_id, slug, client_email, client_name, company,
            status, last_message_at, created_at, updated_at
       FROM chat_rooms WHERE id = ? LIMIT 1`,
    [id],
  );
  return row ? normalizeRoom(row) : null;
}

export async function getRoomBySlug(slug: string): Promise<ChatRoom | null> {
  const row = await d1First<ChatRoomRow>(
    `SELECT id, client_id, slug, client_email, client_name, company,
            status, last_message_at, created_at, updated_at
       FROM chat_rooms WHERE slug = ? LIMIT 1`,
    [slug],
  );
  return row ? normalizeRoom(row) : null;
}

async function assertSlugAvailable(slug: string, roomId: string): Promise<void> {
  const existing = await d1First<{ id: string }>(
    "SELECT id FROM chat_rooms WHERE slug = ? AND id != ? LIMIT 1",
    [slug, roomId],
  );
  if (existing) throw new Error("이미 사용 중인 채팅방 슬러그입니다.");
}

function normalizeClientEmail(value: string): string {
  return value.trim().toLowerCase();
}

function assertValidClientEmail(value: string): void {
  if (!value) throw new Error("이메일이 필요합니다.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("이메일 형식이 올바르지 않습니다.");
  }
}

export async function updateChatRoomClient(input: {
  roomId: string;
  company?: string;
  clientName?: string;
  email?: string;
  phone?: string;
  industry?: string;
  slug?: string;
}): Promise<ChatRoom> {
  const room = await getRoomById(input.roomId);
  if (!room) throw new Error("채팅방을 찾을 수 없습니다.");
  if (room.status === "archived") {
    throw new Error("삭제된 채팅방은 수정할 수 없습니다.");
  }

  const email = normalizeClientEmail(input.email || "");
  assertValidClientEmail(email);
  const company = (input.company || "").trim();
  const clientName = (input.clientName || "").trim();
  const phone = (input.phone || "").trim();
  const industry = (input.industry || "").trim();
  const nextSlug = slugifyChatSlug(
    input.slug ||
      slugBaseFromCustomer({
        email,
        company,
        clientName,
      }),
  );
  await assertSlugAvailable(nextSlug, room.id);

  const now = nowIso();
  const queries: { sql: string; params?: D1Param[] }[] = [
    {
      sql: `UPDATE chat_rooms
               SET slug = ?, client_email = ?, client_name = ?, company = ?,
                   updated_at = ?
             WHERE id = ?`,
      params: [nextSlug, email, clientName, company, now, room.id],
    },
  ];

  if (room.clientId) {
    queries.push({
      sql: `UPDATE clients
               SET company = ?, contact_name = ?, phone = ?, email = ?,
                   industry = ?, updated_at = ?
             WHERE id = ?`,
      params: [company, clientName, phone, email, industry, now, room.clientId],
    });
  }

  await d1Batch(queries);
  const updated = await getRoomById(room.id);
  if (!updated) throw new Error("채팅방 수정 실패");
  return updated;
}

export async function archiveChatRoom(roomId: string): Promise<void> {
  const room = await getRoomById(roomId);
  if (!room) throw new Error("채팅방을 찾을 수 없습니다.");
  if (room.status === "archived") return;

  const now = nowIso();
  await d1Batch([
    {
      sql: `UPDATE chat_rooms
               SET status = 'archived', updated_at = ?
             WHERE id = ?`,
      params: [now, room.id],
    },
    {
      sql: `UPDATE chat_requests
               SET status = 'cancelled',
                   completed_at = COALESCE(completed_at, ?),
                   updated_at = ?
             WHERE room_id = ?
               AND status IN ('draft', 'accepted', 'in_progress')`,
      params: [now, now, room.id],
    },
  ]);
}

export async function getRequestsForRoom(roomId: string): Promise<ChatRequest[]> {
  const rows = await d1All<ChatRequestRow>(
    `SELECT q.id, q.room_id, q.client_id, q.topic, q.title, q.summary,
            q.status, q.accepted_at, q.completed_at, q.last_message_at,
            q.created_at, q.updated_at,
            COALESCE(unread.count, 0) AS unread_admin_count
       FROM chat_requests q
       LEFT JOIN (
         SELECT request_id, COUNT(*) AS count
           FROM chat_messages
          WHERE request_id != ''
            AND sender_type = 'client'
            AND read_by_admin_at IS NULL
          GROUP BY request_id
       ) unread ON unread.request_id = q.id
      WHERE q.room_id = ?
      ORDER BY COALESCE(q.last_message_at, q.created_at) DESC`,
    [roomId],
  );

  const itemsByRequest = await getItemsForRequests(rows.map((row) => row.id));
  return rows.map((row) => normalizeRequest(row, itemsByRequest.get(row.id) || []));
}

export async function getRequestById(id: string): Promise<ChatRequest | null> {
  const row = await d1First<ChatRequestRow>(
    `SELECT q.id, q.room_id, q.client_id, q.topic, q.title, q.summary,
            q.status, q.accepted_at, q.completed_at, q.last_message_at,
            q.created_at, q.updated_at,
            COALESCE(unread.count, 0) AS unread_admin_count
       FROM chat_requests q
       LEFT JOIN (
         SELECT request_id, COUNT(*) AS count
           FROM chat_messages
          WHERE request_id = ?
            AND sender_type = 'client'
            AND read_by_admin_at IS NULL
       ) unread ON unread.request_id = q.id
      WHERE q.id = ?
      LIMIT 1`,
    [id, id],
  );
  if (!row) return null;
  const itemsByRequest = await getItemsForRequests([id]);
  return normalizeRequest(row, itemsByRequest.get(id) || []);
}

function messageSelectSql(whereClause: string): string {
  return `SELECT m.id, m.room_id, m.request_id, m.sender_type, m.topic, m.body,
                 m.attachment_id, m.read_by_client_at, m.read_by_admin_at,
                 m.created_at, a.id AS file_id, a.request_id AS file_request_id,
                 a.filename AS file_filename, a.content_type AS file_content_type,
                 a.size_bytes AS file_size_bytes, a.uploaded_by AS file_uploaded_by,
                 a.downloaded_at AS file_downloaded_at,
                 a.deleted_at AS file_deleted_at
            FROM chat_messages m
            LEFT JOIN chat_attachments a ON a.id = m.attachment_id
           ${whereClause}
           ORDER BY m.created_at ASC`;
}

export async function getMessagesForRoom(roomId: string): Promise<ChatMessage[]> {
  const rows = await d1All<ChatMessageRow>(
    messageSelectSql("WHERE m.room_id = ?"),
    [roomId],
  );
  return rows.map(normalizeMessage);
}

export async function getMessagesForRequest(
  requestId: string,
): Promise<ChatMessage[]> {
  const rows = await d1All<ChatMessageRow>(
    messageSelectSql("WHERE m.request_id = ?"),
    [requestId],
  );
  return rows.map(normalizeMessage);
}

export async function markRoomRead(
  roomId: string,
  reader: ChatSenderType,
): Promise<void> {
  const now = nowIso();
  if (reader === "admin") {
    await d1Run(
      `UPDATE chat_messages
          SET read_by_admin_at = ?
        WHERE room_id = ?
          AND sender_type = 'client'
          AND read_by_admin_at IS NULL`,
      [now, roomId],
    );
    return;
  }

  await d1Run(
    `UPDATE chat_messages
        SET read_by_client_at = ?
      WHERE room_id = ?
        AND sender_type = 'admin'
        AND read_by_client_at IS NULL`,
    [now, roomId],
  );
}

export async function markRequestRead(
  requestId: string,
  reader: ChatSenderType,
): Promise<void> {
  const now = nowIso();
  if (reader === "admin") {
    await d1Run(
      `UPDATE chat_messages
          SET read_by_admin_at = ?
        WHERE request_id = ?
          AND sender_type = 'client'
          AND read_by_admin_at IS NULL`,
      [now, requestId],
    );
    return;
  }

  await d1Run(
    `UPDATE chat_messages
        SET read_by_client_at = ?
      WHERE request_id = ?
        AND sender_type = 'admin'
        AND read_by_client_at IS NULL`,
    [now, requestId],
  );
}

async function assertRequestWritable(requestId: string): Promise<ChatRequest> {
  const request = await getRequestById(requestId);
  if (!request) throw new Error("요청건을 찾을 수 없습니다.");
  const room = await getRoomById(request.roomId);
  if (!room || room.status !== "open") {
    throw new Error("닫힌 채팅방입니다.");
  }
  if (isClosedChatRequest(request.status)) {
    throw new Error("완료 또는 취소된 요청건은 채팅이 종료되었습니다.");
  }
  return request;
}

function requestTouchQuery(requestId?: string, now?: string) {
  if (!requestId) return null;
  return {
    sql: `UPDATE chat_requests
             SET last_message_at = ?, updated_at = ?
           WHERE id = ?`,
    params: [now || nowIso(), now || nowIso(), requestId] as D1Param[],
  };
}

export async function createTextMessage(input: {
  roomId: string;
  senderType: ChatSenderType;
  body: string;
  topic?: string;
  requestId?: string;
}): Promise<ChatMessage> {
  if (input.requestId) await assertRequestWritable(input.requestId);

  const id = newId("msg");
  const now = nowIso();
  const queries: { sql: string; params?: D1Param[] }[] = [
    {
      sql: `INSERT INTO chat_messages
              (id, room_id, request_id, sender_type, topic, body, attachment_id,
               read_by_client_at, read_by_admin_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, '', ?, ?, ?)`,
      params: [
        id,
        input.roomId,
        input.requestId || "",
        input.senderType,
        input.topic || "",
        input.body,
        input.senderType === "client" ? now : null,
        input.senderType === "admin" ? now : null,
        now,
      ],
    },
    {
      sql: `UPDATE chat_rooms
               SET last_message_at = ?, updated_at = ?
             WHERE id = ?`,
      params: [now, now, input.roomId],
    },
  ];
  const touchRequest = requestTouchQuery(input.requestId, now);
  if (touchRequest) queries.push(touchRequest);
  await d1Batch(queries);

  const message = await d1First<ChatMessageRow>(
    messageSelectSql("WHERE m.id = ?"),
    [id],
  );
  if (!message) throw new Error("채팅 메시지 생성 실패");
  return normalizeMessage(message);
}

export async function createAttachmentMessage(input: {
  roomId: string;
  senderType: ChatSenderType;
  body: string;
  topic?: string;
  requestId?: string;
  attachmentId: string;
  r2Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<ChatMessage> {
  if (input.requestId) await assertRequestWritable(input.requestId);

  const messageId = newId("msg");
  const now = nowIso();
  const queries: { sql: string; params?: D1Param[] }[] = [
    {
      sql: `INSERT INTO chat_attachments
              (id, room_id, request_id, message_id, r2_key, filename,
               content_type, size_bytes, uploaded_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        input.attachmentId,
        input.roomId,
        input.requestId || "",
        messageId,
        input.r2Key,
        input.filename,
        input.contentType,
        input.sizeBytes,
        input.senderType,
        now,
      ],
    },
    {
      sql: `INSERT INTO chat_messages
              (id, room_id, request_id, sender_type, topic, body, attachment_id,
               read_by_client_at, read_by_admin_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        messageId,
        input.roomId,
        input.requestId || "",
        input.senderType,
        input.topic || "",
        input.body,
        input.attachmentId,
        input.senderType === "client" ? now : null,
        input.senderType === "admin" ? now : null,
        now,
      ],
    },
    {
      sql: `UPDATE chat_rooms
               SET last_message_at = ?, updated_at = ?
             WHERE id = ?`,
      params: [now, now, input.roomId],
    },
  ];
  const touchRequest = requestTouchQuery(input.requestId, now);
  if (touchRequest) queries.push(touchRequest);
  await d1Batch(queries);

  const message = await d1First<ChatMessageRow>(
    messageSelectSql("WHERE m.id = ?"),
    [messageId],
  );
  if (!message) throw new Error("첨부 메시지 생성 실패");
  return normalizeMessage(message);
}

export async function createRequestForRoom(input: {
  roomId: string;
  clientId?: string;
  topic: ChatTopic;
  title?: string;
  initialBody?: string;
  senderType?: ChatSenderType;
}): Promise<{ request: ChatRequest; message: ChatMessage | null }> {
  const room = await getRoomById(input.roomId);
  if (!room) throw new Error("채팅방을 찾을 수 없습니다.");
  if (room.status !== "open") throw new Error("닫힌 채팅방입니다.");

  const id = newId("req");
  const now = nowIso();
  await d1Run(
    `INSERT INTO chat_requests
      (id, room_id, client_id, topic, title, summary, status,
       last_message_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, '', 'draft', NULL, ?, ?)`,
    [
      id,
      input.roomId,
      input.clientId || room.clientId || "",
      input.topic,
      input.title?.trim() || "",
      now,
      now,
    ],
  );

  let message: ChatMessage | null = null;
  if (input.initialBody?.trim()) {
    message = await createTextMessage({
      roomId: input.roomId,
      requestId: id,
      senderType: input.senderType || "client",
      topic: input.topic,
      body: input.initialBody.trim(),
    });
  }

  const request = await getRequestById(id);
  if (!request) throw new Error("요청건 생성 실패");
  return { request, message };
}

export async function updateChatRequestAdmin(input: {
  requestId: string;
  title?: string;
  summary?: string;
  status?: ChatRequestStatus;
  items?: { id?: string; content: string; status?: "todo" | "done" }[];
}): Promise<ChatRequest> {
  const request = await getRequestById(input.requestId);
  if (!request) throw new Error("요청건을 찾을 수 없습니다.");

  const status = input.status || request.status;
  if (!isChatRequestStatus(status)) throw new Error("유효하지 않은 상태입니다.");

  const now = nowIso();
  const nextTitle = input.title?.trim() ?? request.title;
  const nextSummary = input.summary?.trim() ?? request.summary;
  const nextItems = input.items
    ? input.items
        .map((item) => ({
          content: item.content.trim(),
          status: item.status === "done" ? ("done" as const) : ("todo" as const),
        }))
        .filter((item) => item.content)
    : request.items.map((item) => ({
        content: item.content.trim(),
        status: item.status,
      }));

  if (isClosedChatRequest(request.status) && !isClosedChatRequest(status)) {
    throw new Error("종료된 요청건은 다시 열 수 없습니다.");
  }
  if (status !== "draft" && !nextTitle) {
    throw new Error("접수된 요청건은 관리자 지정 제목이 필요합니다.");
  }
  if (status === "done" && nextItems.some((item) => item.status !== "done")) {
    throw new Error("미완료 요청사항이 있어 완료 처리할 수 없습니다.");
  }

  const acceptedAt =
    status !== "draft" && !request.acceptedAt ? now : request.acceptedAt;
  const completedAt =
    status === "done" && !request.completedAt ? now : request.completedAt;

  const queries: { sql: string; params?: D1Param[] }[] = [
    {
      sql: `UPDATE chat_requests
               SET title = ?, summary = ?, status = ?, accepted_at = ?,
                   completed_at = ?, updated_at = ?
             WHERE id = ?`,
      params: [
        nextTitle,
        nextSummary,
        status,
        acceptedAt,
        completedAt,
        now,
        input.requestId,
      ],
    },
  ];

  if (input.items) {
    queries.push({
      sql: "DELETE FROM chat_request_items WHERE request_id = ?",
      params: [input.requestId],
    });

    nextItems.forEach((item, index) => {
      queries.push({
        sql: `INSERT INTO chat_request_items
                (id, request_id, content, status, sort_order, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        params: [
          newId("itm"),
          input.requestId,
          item.content,
          item.status,
          index,
          now,
          now,
        ],
      });
    });
  }

  await d1Batch(queries);
  const updated = await getRequestById(input.requestId);
  if (!updated) throw new Error("요청건 저장 실패");
  return updated;
}

async function buildUniqueSlug(base: string): Promise<string> {
  for (let index = 0; index < 50; index++) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const slug = `${base.slice(0, 48 - suffix.length)}${suffix}`;
    const existing = await d1First<{ id: string }>(
      "SELECT id FROM chat_rooms WHERE slug = ? LIMIT 1",
      [slug],
    );
    if (!existing) return slug;
  }
  return `${base.slice(0, 36)}-${newId("r").slice(-8).toLowerCase()}`;
}

export async function ensureRoomForClient(input: {
  clientId?: string;
  company?: string;
  clientName?: string;
  phone?: string;
  email?: string;
  industry?: string;
}): Promise<ChatRoom> {
  let client: ClientRow | null = null;

  if (input.clientId) {
    client = await d1First<ClientRow>(
      `SELECT id, company, contact_name, phone, email, industry
         FROM clients WHERE id = ? LIMIT 1`,
      [input.clientId],
    );
    if (!client) throw new Error("거래처를 찾을 수 없습니다.");
  } else if (input.email) {
    client = await d1First<ClientRow>(
      `SELECT id, company, contact_name, phone, email, industry
         FROM clients WHERE lower(email) = lower(?) LIMIT 1`,
      [input.email.trim()],
    );
  }

  if (!client) {
    if (!input.email?.trim()) throw new Error("이메일이 필요합니다.");
    const id = newId();
    const now = nowIso();
    await d1Run(
      `INSERT INTO clients
        (id, company, contact_name, phone, email, industry, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.company || "",
        input.clientName || "",
        input.phone || "",
        input.email.trim(),
        input.industry || "",
        "Waiting",
        now,
        now,
      ],
    );
    client = {
      id,
      company: input.company || "",
      contact_name: input.clientName || "",
      phone: input.phone || "",
      email: input.email.trim(),
      industry: input.industry || "",
    };
  }

  const existingRoom = await d1First<ChatRoomRow>(
    `SELECT id, client_id, slug, client_email, client_name, company,
            status, last_message_at, created_at, updated_at
       FROM chat_rooms WHERE client_id = ? LIMIT 1`,
    [client.id],
  );
  if (existingRoom) return normalizeRoom(existingRoom);

  const roomId = newId("room");
  const now = nowIso();
  const slug = await buildUniqueSlug(
    slugBaseFromCustomer({
      email: client.email || input.email,
      company: client.company || input.company,
      clientName: client.contact_name || input.clientName,
    }),
  );

  await d1Run(
    `INSERT INTO chat_rooms
      (id, client_id, slug, client_email, client_name, company, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      roomId,
      client.id,
      slug,
      client.email || input.email || "",
      client.contact_name || input.clientName || "",
      client.company || input.company || "",
      "open",
      now,
      now,
    ],
  );

  const room = await getRoomById(roomId);
  if (!room) throw new Error("채팅방 생성 실패");
  return room;
}

export async function getClientPhoneForRoom(room: ChatRoom): Promise<string> {
  if (!room.clientId) return "";
  const row = await d1First<{ phone: string }>(
    "SELECT phone FROM clients WHERE id = ? LIMIT 1",
    [room.clientId],
  );
  return row?.phone || "";
}

function getChatTelegramConfig(): { botToken: string; chatId: string } | null {
  const botToken =
    process.env.CHAT_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const chatId =
    process.env.CHAT_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

async function getSavedChatTelegramTarget(): Promise<string> {
  try {
    return (await redis.get(CHAT_TELEGRAM_TARGET_KEY)) || "";
  } catch {
    return "";
  }
}

export async function saveChatTelegramTarget(chatId: string): Promise<void> {
  if (!chatId) return;
  await redis.set(CHAT_TELEGRAM_TARGET_KEY, chatId);
}

function normalizeTelegramText(value: string, maxLength: number): string {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1)}…`;
}

export async function sendTelegramChatMessage(input: {
  chatId?: string;
  text: string;
  parseMode?: "HTML";
  replyToMessageId?: number;
}): Promise<TelegramSendResult | null> {
  const config = getChatTelegramConfig();
  if (!config) {
    console.error("[chat/telegram] 환경변수 누락: bot token 또는 chat id 없음");
    return null;
  }
  const targetChatId =
    input.chatId || (await getSavedChatTelegramTarget()) || config.chatId;

  const body: Record<string, unknown> = {
    chat_id: targetChatId,
    text: input.text,
  };
  if (input.parseMode) body.parse_mode = input.parseMode;
  if (input.replyToMessageId) {
    body.reply_parameters = { message_id: input.replyToMessageId };
  }

  const res = await fetch(
    `https://api.telegram.org/bot${config.botToken}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  const raw = await res.text();
  if (!res.ok) {
    console.error("[chat/telegram] sendMessage 실패", {
      status: res.status,
      targetChatId,
      response: raw.slice(0, 500),
    });
    return null;
  }

  let data: {
    ok?: boolean;
    result?: { message_id?: number; chat?: { id?: number | string } };
  };
  try {
    data = JSON.parse(raw);
  } catch {
    console.error("[chat/telegram] sendMessage 응답 JSON 파싱 실패", {
      targetChatId,
      response: raw.slice(0, 500),
    });
    return null;
  }
  const messageId = data.result?.message_id;
  const chatId = data.result?.chat?.id;
  if (!data.ok || typeof messageId !== "number" || chatId === undefined) {
    console.error("[chat/telegram] sendMessage 응답 형식 오류", {
      targetChatId,
      response: raw.slice(0, 500),
    });
    return null;
  }
  return { messageId, chatId: String(chatId) };
}

export async function saveTelegramChatLink(input: {
  telegramChatId: string;
  telegramMessageId: number;
  roomId: string;
  requestId: string;
  chatMessageId?: string;
}): Promise<void> {
  if (!input.requestId) return;
  await d1Run(
    `INSERT OR REPLACE INTO chat_telegram_messages
      (id, telegram_chat_id, telegram_message_id, room_id, request_id,
       chat_message_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      `tg_${input.telegramChatId}_${input.telegramMessageId}`,
      input.telegramChatId,
      input.telegramMessageId,
      input.roomId,
      input.requestId,
      input.chatMessageId || "",
      nowIso(),
    ],
  );
}

export async function getTelegramChatLink(
  telegramChatId: string,
  telegramMessageId: number,
): Promise<TelegramChatLinkRow | null> {
  return d1First<TelegramChatLinkRow>(
    `SELECT telegram_chat_id, telegram_message_id, room_id, request_id,
            chat_message_id
       FROM chat_telegram_messages
      WHERE telegram_chat_id = ?
        AND telegram_message_id = ?
      LIMIT 1`,
    [telegramChatId, telegramMessageId],
  );
}

export async function notifyTelegramForClientMessage(input: {
  room: ChatRoom;
  message: ChatMessage;
  request?: ChatRequest | null;
}): Promise<void> {
  const adminBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
  const adminLink = adminBaseUrl
    ? `${adminBaseUrl.replace(/\/$/, "")}/chats?room=${input.room.id}&request=${input.message.requestId}`
    : "";
  const attachmentText = input.message.attachment
    ? `\n첨부: ${normalizeTelegramText(input.message.attachment.filename, 180)}`
    : "";
  const roomName = normalizeTelegramText(
    input.room.company ||
      input.room.clientName ||
      input.room.clientEmail ||
      input.room.slug,
    180,
  );
  const requestTitle = normalizeTelegramText(
    input.request?.title || input.message.topic || "미접수",
    180,
  );
  const topic = normalizeTelegramText(input.message.topic || "미지정", 80);
  const messageBody = normalizeTelegramText(
    input.message.body || "(첨부파일)",
    1800,
  );

  const text = [
    "[chat] 폴라애드 고객 요청",
    `거래처: ${roomName}`,
    `요청건: ${requestTitle}`,
    `주제: ${topic}`,
    `내용: ${messageBody}${attachmentText}`,
    adminLink ? `관리자: ${adminLink}` : "",
    "",
    "이 알림에 답장하면 고객 채팅으로 전송됩니다.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const sent = await sendTelegramChatMessage({ text });
    if (!sent) {
      console.error("[chat/telegram] 고객 메시지 알림 전송 실패", {
        roomId: input.room.id,
        requestId: input.message.requestId,
        messageId: input.message.id,
      });
      return;
    }

    await saveTelegramChatLink({
      telegramChatId: sent.chatId,
      telegramMessageId: sent.messageId,
      roomId: input.room.id,
      requestId: input.message.requestId,
      chatMessageId: input.message.id,
    });
  } catch (error) {
    console.error("[chat/telegram] 고객 메시지 알림 처리 오류:", error);
    // 알림 실패는 채팅 저장을 막지 않는다.
  }
}
