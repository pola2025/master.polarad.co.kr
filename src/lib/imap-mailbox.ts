import tls from "tls";

const DEFAULT_IMAP_HOST = "imap.worksmobile.com";
const DEFAULT_IMAP_PORT = 993;

export interface MailSummary {
  id: string;
  uid: number;
  from: string;
  subject: string;
  date: string;
  messageId: string;
  seen: boolean;
  size: number;
}

export interface MailDetail extends MailSummary {
  to: string;
  contentType: string;
  bodyText: string;
  bodyHtml: string;
}

export function getImapStatus() {
  const user = process.env.IMAP_USER || process.env.SMTP_USER || "";
  const pass = process.env.IMAP_PASS || process.env.SMTP_PASS || "";

  return {
    host: process.env.IMAP_HOST || DEFAULT_IMAP_HOST,
    port: Number(process.env.IMAP_PORT || DEFAULT_IMAP_PORT),
    user,
    ready: Boolean(user && pass),
  };
}

function getConfig() {
  const user = process.env.IMAP_USER || process.env.SMTP_USER;
  const pass = process.env.IMAP_PASS || process.env.SMTP_PASS;
  if (!user || !pass) {
    throw new Error("IMAP 환경변수 누락: IMAP_USER/IMAP_PASS");
  }

  return {
    host: process.env.IMAP_HOST || DEFAULT_IMAP_HOST,
    port: Number(process.env.IMAP_PORT || DEFAULT_IMAP_PORT),
    user,
    pass,
  };
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function decodeMimeWords(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g,
    (_match, charset: string, encoding: string, text: string) => {
      try {
        const normalizedCharset = charset.toLowerCase();
        const bytes =
          encoding.toUpperCase() === "B"
            ? Buffer.from(text, "base64")
            : Buffer.from(
                text
                  .replace(/_/g, " ")
                  .replace(/=([0-9A-F]{2})/gi, (_hex, code) =>
                    String.fromCharCode(parseInt(code, 16)),
                  ),
                "binary",
              );

        if (normalizedCharset.includes("utf-8")) {
          return bytes.toString("utf8");
        }
        return bytes.toString("latin1");
      } catch {
        return text;
      }
    },
  );
}

function decodeQuotedPrintable(value: string): Buffer {
  const binary = value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/gi, (_match, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
  return Buffer.from(binary, "binary");
}

function decodeBody(value: string, encoding: string, charset: string): string {
  const normalizedEncoding = encoding.toLowerCase();
  const normalizedCharset = charset.toLowerCase();
  let buffer: Buffer;

  if (normalizedEncoding === "base64") {
    buffer = Buffer.from(value.replace(/\s/g, ""), "base64");
  } else if (normalizedEncoding === "quoted-printable") {
    buffer = decodeQuotedPrintable(value);
  } else {
    buffer = Buffer.from(value, "utf8");
  }

  if (normalizedCharset.includes("utf-8")) {
    return buffer.toString("utf8");
  }
  return buffer.toString("latin1");
}

function splitHeadersAndBody(raw: string) {
  const normalized = raw.replace(/\r\n/g, "\n");
  const index = normalized.indexOf("\n\n");
  if (index === -1) {
    return { headers: normalized, body: "" };
  }
  return {
    headers: normalized.slice(0, index),
    body: normalized.slice(index + 2),
  };
}

function parseHeaders(raw: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const unfolded = raw.replace(/\r?\n[ \t]+/g, " ");

  for (const line of unfolded.split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = decodeMimeWords(line.slice(index + 1).trim());
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  }

  return headers;
}

function headerValue(headers: Record<string, string>, key: string): string {
  return headers[key.toLowerCase()] || "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getHeaderParam(value: string, param: string): string {
  const pattern = new RegExp(`${param}="?([^";]+)"?`, "i");
  return value.match(pattern)?.[1] || "";
}

function parseMimeBody(raw: string): {
  contentType: string;
  bodyText: string;
  bodyHtml: string;
} {
  const { headers: headerRaw, body } = splitHeadersAndBody(raw);
  const headers = parseHeaders(headerRaw);
  const contentType = headerValue(headers, "content-type") || "text/plain";
  const encoding = headerValue(headers, "content-transfer-encoding");
  const charset = getHeaderParam(contentType, "charset") || "utf-8";

  if (/multipart\//i.test(contentType)) {
    const boundary = getHeaderParam(contentType, "boundary");
    if (!boundary) {
      return { contentType, bodyText: stripHtml(body), bodyHtml: "" };
    }

    const parts = body
      .split(`--${boundary}`)
      .map((part) => part.trim())
      .filter((part) => part && part !== "--");
    const parsed = parts.map(parseMimeBody);
    const htmlPart = parsed.find((part) => part.bodyHtml);
    const textPart = parsed.find((part) => part.bodyText);

    return {
      contentType,
      bodyText: textPart?.bodyText || stripHtml(htmlPart?.bodyHtml || ""),
      bodyHtml: htmlPart?.bodyHtml || "",
    };
  }

  const decoded = decodeBody(body, encoding, charset).trim();
  if (/text\/html/i.test(contentType)) {
    return {
      contentType,
      bodyText: stripHtml(decoded),
      bodyHtml: decoded,
    };
  }

  return {
    contentType,
    bodyText: decoded,
    bodyHtml: "",
  };
}

function getLiteral(response: string): string {
  const match = response.match(/\{(\d+)\}\r?\n([\s\S]*)\r?\n\)?\r?\n?[A-Z0-9]+ (?:OK|NO|BAD)/);
  if (match) return match[2].replace(/\r?\n\)\r?$/m, "");

  const literalStart = response.indexOf("}\r\n");
  if (literalStart === -1) return "";
  const afterLiteral = response.slice(literalStart + 3);
  return afterLiteral.replace(/\r?\n\)\r?\n[A-Z0-9]+ [\s\S]*$/m, "");
}

function parseSummaryFromFetch(response: string, uidFallback: number): MailSummary {
  const uid = Number(response.match(/\bUID (\d+)/i)?.[1] || uidFallback);
  const flags = response.match(/\bFLAGS \(([^)]*)\)/i)?.[1] || "";
  const size = Number(response.match(/\bRFC822\.SIZE (\d+)/i)?.[1] || 0);
  const headers = parseHeaders(getLiteral(response));

  return {
    id: String(uid),
    uid,
    from: headerValue(headers, "from") || "(발신자 없음)",
    subject: headerValue(headers, "subject") || "(제목 없음)",
    date: headerValue(headers, "date"),
    messageId: headerValue(headers, "message-id"),
    seen: /\\Seen/i.test(flags),
    size,
  };
}

class ImapSession {
  private socket: tls.TLSSocket | null = null;
  private buffer = "";
  private tagIndex = 1;

  constructor(private readonly config: ReturnType<typeof getConfig>) {}

  async connect() {
    this.socket = tls.connect({
      host: this.config.host,
      port: this.config.port,
      servername: this.config.host,
    });

    this.socket.setEncoding("utf8");
    this.socket.on("data", (chunk) => {
      this.buffer += chunk;
    });
    this.socket.on("error", () => {
      // Command-level waits attach their own error handler. After LOGOUT, some
      // IMAP servers close the TLS socket with ECONNRESET; do not crash the API.
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("IMAP 연결 시간 초과")), 15000);
      this.socket?.once("secureConnect", () => {
        clearTimeout(timer);
        resolve();
      });
      this.socket?.once("error", reject);
    });

    await this.waitFor(/\* OK/i);
    await this.command(`LOGIN ${quote(this.config.user)} ${quote(this.config.pass)}`);
    await this.command("SELECT INBOX");
  }

  close() {
    if (!this.socket) return;
    this.socket.write(`${this.nextTag()} LOGOUT\r\n`);
    this.socket.end();
    this.socket = null;
  }

  async list(limit: number): Promise<MailSummary[]> {
    const search = await this.command("UID SEARCH ALL");
    const uids = (search.match(/\* SEARCH ([^\r\n]*)/i)?.[1] || "")
      .trim()
      .split(/\s+/)
      .map((uid) => Number(uid))
      .filter(Boolean);

    const latest = uids.slice(-limit).reverse();
    const messages: MailSummary[] = [];
    for (const uid of latest) {
      const response = await this.command(
        `UID FETCH ${uid} (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID CONTENT-TYPE)])`,
      );
      messages.push(parseSummaryFromFetch(response, uid));
    }
    return messages;
  }

  async detail(uid: string): Promise<MailDetail> {
    const response = await this.command(
      `UID FETCH ${uid} (UID FLAGS INTERNALDATE RFC822.SIZE BODY.PEEK[])`,
    );
    const summary = parseSummaryFromFetch(response, Number(uid));
    const raw = getLiteral(response);
    const { headers: headerRaw } = splitHeadersAndBody(raw);
    const headers = parseHeaders(headerRaw);
    const body = parseMimeBody(raw);

    return {
      ...summary,
      to: headerValue(headers, "to"),
      contentType: body.contentType,
      bodyText: body.bodyText,
      bodyHtml: body.bodyHtml,
    };
  }

  private nextTag(): string {
    return `A${String(this.tagIndex++).padStart(4, "0")}`;
  }

  private async command(command: string): Promise<string> {
    if (!this.socket) throw new Error("IMAP 세션이 없습니다.");

    const tag = this.nextTag();
    this.buffer = "";
    this.socket.write(`${tag} ${command}\r\n`);
    const response = await this.waitFor(new RegExp(`${tag} (OK|NO|BAD)`, "i"));
    if (new RegExp(`${tag} (NO|BAD)`, "i").test(response)) {
      throw new Error(`IMAP 명령 실패: ${command}`);
    }
    return response;
  }

  private waitFor(pattern: RegExp): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("IMAP 응답 시간 초과"));
      }, 20000);

      const cleanup = () => {
        clearTimeout(timer);
        this.socket?.off("data", onData);
        this.socket?.off("error", onError);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onData = () => {
        if (!pattern.test(this.buffer)) return;
        const response = this.buffer;
        cleanup();
        resolve(response);
      };

      this.socket?.on("data", onData);
      this.socket?.once("error", onError);
      onData();
    });
  }
}

export async function listInboxMessages(limit = 20): Promise<MailSummary[]> {
  const session = new ImapSession(getConfig());
  try {
    await session.connect();
    return await session.list(Math.max(1, Math.min(50, limit)));
  } finally {
    session.close();
  }
}

export async function getInboxMessage(uid: string): Promise<MailDetail> {
  const session = new ImapSession(getConfig());
  try {
    await session.connect();
    return await session.detail(uid);
  } finally {
    session.close();
  }
}
