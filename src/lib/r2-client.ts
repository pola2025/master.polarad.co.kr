const D1_PROXY_URL = process.env.D1_PROXY_URL;
const D1_PROXY_TOKEN = process.env.D1_PROXY_TOKEN;

interface ProxyJson<T> {
  ok: boolean;
  result?: T;
  error?: string;
}

export interface R2Download {
  data: ArrayBuffer;
  contentType: string;
  contentLength: number;
  etag: string;
}

function assertR2ProxyConfig(): void {
  if (!D1_PROXY_URL || !D1_PROXY_TOKEN) {
    throw new Error("R2 proxy 환경변수 누락: D1_PROXY_URL, D1_PROXY_TOKEN");
  }
}

async function callR2Json<T>(path: string, body: unknown): Promise<T> {
  assertR2ProxyConfig();
  const res = await fetch(`${D1_PROXY_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${D1_PROXY_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = (await res.json()) as ProxyJson<T>;
  if (!res.ok || !data.ok) {
    throw new Error(`R2 proxy 오류 (HTTP ${res.status}): ${data.error ?? "unknown"}`);
  }
  return data.result as T;
}

export async function putChatFileToR2(input: {
  key: string;
  bytes: ArrayBuffer;
  contentType: string;
  metadata?: Record<string, string>;
}): Promise<void> {
  const base64 = Buffer.from(input.bytes).toString("base64");
  await callR2Json<{ key: string; size: number }>("/r2/put", {
    key: input.key,
    contentType: input.contentType,
    base64,
    metadata: input.metadata,
  });
}

export async function getChatFileFromR2(key: string): Promise<R2Download> {
  assertR2ProxyConfig();
  const res = await fetch(`${D1_PROXY_URL}/r2/get`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${D1_PROXY_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ key }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 proxy 다운로드 오류 (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const data = await res.arrayBuffer();
  return {
    data,
    contentType: res.headers.get("content-type") || "application/octet-stream",
    contentLength: Number(res.headers.get("content-length") || data.byteLength),
    etag: res.headers.get("etag") || "",
  };
}

export async function deleteChatFileFromR2(key: string): Promise<void> {
  await callR2Json<{ key: string }>("/r2/delete", { key });
}
