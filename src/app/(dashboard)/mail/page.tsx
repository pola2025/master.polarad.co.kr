"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  Mail,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface MailTemplate {
  id: string;
  title: string;
  description: string;
  defaultSubject: string;
  defaultCategoryId: string;
  html: string;
  htmlByCategory?: Record<string, string>;
}

interface MailCategory {
  id: string;
  label: string;
}

interface Notice {
  type: "success" | "error" | "warning";
  message: string;
}

interface MailerStatus {
  fromEmail: string;
  host: string;
  port: number;
  ready: boolean;
}

interface SmsStatus {
  ready: boolean;
  senderConfigured: boolean;
}

interface InboxMessage {
  id: string;
  uid: number;
  from: string;
  subject: string;
  date: string;
  seen: boolean;
  size: number;
}

interface InboxDetail extends InboxMessage {
  to: string;
  bodyText: string;
  bodyHtml: string;
}

const FALLBACK_SMS_MESSAGE = "[폴라애드] 메일 전송드렸습니다. 확인 바랍니다.";
const FALLBACK_CATEGORIES: MailCategory[] = [
  { id: "website", label: "홈페이지 제작" },
  { id: "print-design", label: "인쇄물 디자인" },
  { id: "marketing", label: "마케팅" },
  { id: "etc", label: "기타" },
];
const CUSTOM_TEMPLATE_ID = "custom";
const CUSTOM_DEFAULT_SUBJECT = "[폴라애드] 안내 메일";
const MAX_ATTACHMENT_COUNT = 5;
const MAX_ATTACHMENT_TOTAL_BYTES = 15 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function AdminMailPage() {
  const [activeTab, setActiveTab] = useState<"send" | "inbox">("send");
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [categories, setCategories] =
    useState<MailCategory[]>(FALLBACK_CATEGORIES);
  const [defaultSmsMessage, setDefaultSmsMessage] =
    useState(FALLBACK_SMS_MESSAGE);
  const [templateId, setTemplateId] = useState(CUSTOM_TEMPLATE_ID);
  const [categoryId, setCategoryId] = useState(FALLBACK_CATEGORIES[2].id);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [sendSms, setSendSms] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");
  const [smsMessage, setSmsMessage] = useState(defaultSmsMessage);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [customPreviewHtml, setCustomPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [mailerStatus, setMailerStatus] = useState<MailerStatus | null>(null);
  const [smsStatus, setSmsStatus] = useState<SmsStatus | null>(null);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [selectedMail, setSelectedMail] = useState<InboxDetail | null>(null);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [mailLoading, setMailLoading] = useState(false);
  const [inboxLoaded, setInboxLoaded] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId),
    [templates, templateId],
  );
  const isCustomMode = templateId === CUSTOM_TEMPLATE_ID;
  const selectedTemplateHtml = useMemo(() => {
    if (!selectedTemplate) return "";
    return (
      selectedTemplate.htmlByCategory?.[categoryId] ||
      selectedTemplate.html ||
      ""
    );
  }, [selectedTemplate, categoryId]);
  const hasCustomBody = bodyText.trim().length > 0;
  const usesCustomPreview = isCustomMode || hasCustomBody;
  const previewHtml = usesCustomPreview ? customPreviewHtml : selectedTemplateHtml;
  const canSubmit =
    !loading &&
    !sending &&
    Boolean(templateId) &&
    (!isCustomMode || hasCustomBody);
  const attachmentTotalBytes = useMemo(
    () => attachments.reduce((sum, file) => sum + file.size, 0),
    [attachments],
  );

  useEffect(() => {
    async function loadTemplates() {
      try {
        setLoading(true);
        const res = await fetch("/api/send-email/templates", {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "메일 템플릿을 불러오지 못했습니다.");
        }

        const nextTemplates = Array.isArray(data.templates)
          ? data.templates
          : [];
        const nextCategories = Array.isArray(data.categories)
          ? data.categories
          : FALLBACK_CATEGORIES;
        setTemplates(nextTemplates);
        setCategories(nextCategories);
        setMailerStatus(data.mailer || null);
        setSmsStatus(data.sms || null);
        setDefaultSmsMessage(data.defaultSmsMessage || FALLBACK_SMS_MESSAGE);
        setSmsMessage(data.defaultSmsMessage || FALLBACK_SMS_MESSAGE);

        setTemplateId(CUSTOM_TEMPLATE_ID);
        setSubject(CUSTOM_DEFAULT_SUBJECT);
        setCategoryId(FALLBACK_CATEGORIES[2].id);
      } catch (error) {
        setNotice({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "메일 템플릿을 불러오지 못했습니다.",
        });
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, []);

  useEffect(() => {
    if (!usesCustomPreview) {
      setCustomPreviewHtml("");
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setPreviewLoading(true);
        const res = await fetch("/api/send-email/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject,
            bodyText,
            categoryId,
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "미리보기를 생성하지 못했습니다.");
        }
        setCustomPreviewHtml(data.html || "");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setCustomPreviewHtml("");
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [bodyText, categoryId, subject, usesCustomPreview]);

  const handleTemplateChange = (value: string) => {
    const nextTemplate = templates.find((template) => template.id === value);
    setTemplateId(value);
    if (value === CUSTOM_TEMPLATE_ID) {
      setSubject(CUSTOM_DEFAULT_SUBJECT);
      setCategoryId(FALLBACK_CATEGORIES[2].id);
      return;
    }
    if (nextTemplate) {
      setSubject(nextTemplate.defaultSubject);
      setCategoryId(nextTemplate.defaultCategoryId || FALLBACK_CATEGORIES[0].id);
      setBodyText("");
    }
  };

  const clearAttachments = () => {
    setAttachments([]);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = "";
    }
  };

  const handleAttachmentChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files || []);
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

    if (files.length > MAX_ATTACHMENT_COUNT) {
      clearAttachments();
      setNotice({
        type: "error",
        message: `첨부파일은 최대 ${MAX_ATTACHMENT_COUNT}개까지 가능합니다.`,
      });
      return;
    }

    if (totalBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
      clearAttachments();
      setNotice({
        type: "error",
        message: "첨부파일 총 용량은 15MB까지 가능합니다.",
      });
      return;
    }

    setAttachments(files);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice(null);

    if (isCustomMode && !hasCustomBody) {
      setNotice({
        type: "error",
        message: "기본 메일은 본문을 입력해야 발송할 수 있습니다.",
      });
      return;
    }

    if (attachments.length > MAX_ATTACHMENT_COUNT) {
      setNotice({
        type: "error",
        message: `첨부파일은 최대 ${MAX_ATTACHMENT_COUNT}개까지 가능합니다.`,
      });
      return;
    }

    if (attachmentTotalBytes > MAX_ATTACHMENT_TOTAL_BYTES) {
      setNotice({
        type: "error",
        message: "첨부파일 총 용량은 15MB까지 가능합니다.",
      });
      return;
    }

    setSending(true);

    try {
      const payload = new FormData();
      payload.append("templateId", templateId);
      payload.append("categoryId", categoryId);
      payload.append("to", to);
      payload.append("subject", subject);
      payload.append("bodyText", bodyText);
      payload.append("sendSms", String(sendSms));
      payload.append("smsPhone", smsPhone);
      payload.append("smsMessage", smsMessage);
      attachments.forEach((file) => {
        payload.append("attachments", file, file.name);
      });

      const res = await fetch("/api/send-email", {
        method: "POST",
        body: payload,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "메일 발송에 실패했습니다.");
      }

      clearAttachments();

      if (data.sms?.requested && !data.sms.success) {
        setNotice({
          type: "warning",
          message: `메일은 발송됐지만 문자 발송은 실패했습니다. ${data.sms.error || ""}`.trim(),
        });
        return;
      }

      setNotice({
        type: "success",
        message: data.sms?.requested
          ? "메일과 문자 안내를 발송했습니다."
          : "메일을 발송했습니다.",
      });
    } catch (error) {
      setNotice({
        type: "error",
        message:
          error instanceof Error ? error.message : "메일 발송에 실패했습니다.",
      });
    } finally {
      setSending(false);
    }
  };

  const loadInbox = async () => {
    setInboxLoading(true);
    setInboxError(null);
    try {
      const res = await fetch("/api/mail/inbox?limit=20", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "수신함을 불러오지 못했습니다.");
      }
      setInboxMessages(Array.isArray(data.messages) ? data.messages : []);
      setInboxLoaded(true);
    } catch (error) {
      setInboxError(
        error instanceof Error
          ? error.message
          : "수신함을 불러오지 못했습니다.",
      );
    } finally {
      setInboxLoading(false);
    }
  };

  const openMail = async (id: string) => {
    setMailLoading(true);
    setInboxError(null);
    try {
      const res = await fetch(`/api/mail/inbox/${id}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "메일을 불러오지 못했습니다.");
      }
      setSelectedMail(data.message || null);
    } catch (error) {
      setInboxError(
        error instanceof Error ? error.message : "메일을 불러오지 못했습니다.",
      );
    } finally {
      setMailLoading(false);
    }
  };

  const handleTabChange = (tab: "send" | "inbox") => {
    setActiveTab(tab);
    if (tab === "inbox" && !inboxLoaded && !inboxLoading) {
      loadInbox();
    }
  };

  const copyToClipboard = async (value: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const handlePreviewCopy = async (value: string, label: string) => {
    try {
      await copyToClipboard(value);
      setNotice({
        type: "success",
        message: `${label}를 복사했습니다.`,
      });
    } catch {
      setNotice({
        type: "error",
        message: `${label} 복사에 실패했습니다.`,
      });
    }
  };

  const wirePreviewCopyActions = () => {
    const doc = previewFrameRef.current?.contentDocument;
    if (!doc) return;

    doc
      .querySelectorAll<HTMLElement>("[data-copy-value]")
      .forEach((element) => {
        const value = element.getAttribute("data-copy-value") || "";
        const label = element.getAttribute("data-copy-label") || "내용";
        element.setAttribute("role", "button");
        element.setAttribute("tabindex", "0");
        element.setAttribute("title", `${label} 복사`);
        element.style.cursor = "pointer";
        element.onclick = (event) => {
          event.preventDefault();
          void handlePreviewCopy(value, label);
        };
        element.onkeydown = (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          void handlePreviewCopy(value, label);
        };
      });
  };

  const noticeIcon =
    notice?.type === "success" ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : (
      <AlertCircle className="h-4 w-4" />
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">메일함</h1>
          <p className="text-muted-foreground">
            mkt@polarad.co.kr 계정으로 메일 작성, 메일 발송, 네이버웍스
            수신함 확인을 한 화면에서 처리합니다.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          <Mail className="mr-1 h-3.5 w-3.5" />
          {mailerStatus?.fromEmail || "mkt@polarad.co.kr"}
        </Badge>
      </div>

      <div className="flex w-full rounded-lg border bg-muted/30 p-1 md:w-fit">
        <Button
          type="button"
          variant={activeTab === "send" ? "default" : "ghost"}
          onClick={() => handleTabChange("send")}
          className="flex-1 md:flex-none"
        >
          <Send className="mr-2 h-4 w-4" />
          메일 작성
        </Button>
        <Button
          type="button"
          variant={activeTab === "inbox" ? "default" : "ghost"}
          onClick={() => handleTabChange("inbox")}
          className="flex-1 md:flex-none"
        >
          <Inbox className="mr-2 h-4 w-4" />
          메일 수신함
        </Button>
      </div>

      {activeTab === "send" && mailerStatus && !mailerStatus.ready && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            메일 발송 환경변수 SMTP_PASS가 아직 없습니다. 발신 주소는{" "}
            {mailerStatus.fromEmail}로 잡혀 있지만 실제 발송 전 운영 환경에
            SMTP 비밀번호가 필요합니다.
          </AlertDescription>
        </Alert>
      )}

      {activeTab === "send" && sendSms && smsStatus && !smsStatus.ready && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            문자 발송용 NCP SENS 환경변수가 아직 완전하지 않습니다. 문자 동시
            발송 전 서비스 ID, 접근키, 비밀키, 발신번호 설정이 필요합니다.
          </AlertDescription>
        </Alert>
      )}

      {activeTab === "send" && notice && (
        <Alert
          className={
            notice.type === "success"
              ? "border-green-200 bg-green-50 text-green-900"
              : notice.type === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : undefined
          }
        >
          {noticeIcon}
          <AlertDescription>{notice.message}</AlertDescription>
        </Alert>
      )}

      {activeTab === "send" ? (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              메일 작성
            </CardTitle>
            <CardDescription>
              템플릿, 수신자, 문자 동시 발송 여부를 확인한 뒤 발송하세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="template">작성 방식</Label>
                <Select
                  value={templateId}
                  onValueChange={handleTemplateChange}
                  disabled={loading}
                >
                  <SelectTrigger id="template" className="w-full">
                    <SelectValue placeholder="작성 방식 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={CUSTOM_TEMPLATE_ID}>
                      기본 메일 작성
                    </SelectItem>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isCustomMode ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    템플릿 없이 제목과 본문을 작성하면 확정된 폴라애드 기본
                    메일 스타일로 발송됩니다.
                  </p>
                ) : selectedTemplate ? (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {selectedTemplate.description}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">안내 카테고리</Label>
                <Select
                  value={categoryId}
                  onValueChange={setCategoryId}
                  disabled={loading}
                >
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  선택한 카테고리와 실제 발송 시점의 날짜/시간이 메일 상단
                  뱃지로 표시됩니다.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="to">수신자 이메일</Label>
                <Input
                  id="to"
                  type="email"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  placeholder="customer@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">메일 제목</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bodyText">직접 작성 본문</Label>
                <Textarea
                  id="bodyText"
                  value={bodyText}
                  onChange={(event) => setBodyText(event.target.value)}
                  rows={8}
                  placeholder={`안녕하세요.\n\n안내드릴 내용을 입력하면 오른쪽 미리보기에 확정된 메일 디자인으로 바로 표시됩니다.`}
                />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {isCustomMode
                    ? "기본 메일 작성에서는 본문을 입력해야 발송할 수 있습니다."
                    : "비워두면 선택한 주요 가이드 템플릿으로 발송됩니다. 입력하면 기본 메일 스타일로 발송됩니다."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="attachments">첨부파일</Label>
                <Input
                  ref={attachmentInputRef}
                  id="attachments"
                  type="file"
                  multiple
                  onChange={handleAttachmentChange}
                />
                <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <p>
                    최대 {MAX_ATTACHMENT_COUNT}개, 총{" "}
                    {formatFileSize(MAX_ATTACHMENT_TOTAL_BYTES)}까지 첨부할 수
                    있습니다.
                  </p>
                  {attachments.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAttachments}
                      className="h-7 w-fit px-2 text-xs"
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      첨부 비우기
                    </Button>
                  )}
                </div>
                {attachments.length > 0 && (
                  <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                    {attachments.map((file) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="truncate">{file.name}</span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      총 {formatFileSize(attachmentTotalBytes)}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4">
                <label className="flex items-start gap-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={sendSms}
                    onChange={(event) => setSendSms(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-input"
                  />
                  <span>
                    문자 안내도 같이 발송
                    <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">
                      체크하면 메일 발송 후 입력한 전화번호로 안내 문자를
                      보냅니다.
                    </span>
                  </span>
                </label>

                {sendSms && (
                  <div className="mt-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="smsPhone">문자 받을 전화번호</Label>
                      <Input
                        id="smsPhone"
                        value={smsPhone}
                        onChange={(event) => setSmsPhone(event.target.value)}
                        placeholder="010-0000-0000"
                        required={sendSms}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smsMessage">문자 문구</Label>
                      <Textarea
                        id="smsMessage"
                        value={smsMessage}
                        onChange={(event) => setSmsMessage(event.target.value)}
                        rows={3}
                        maxLength={1000}
                      />
                      <p className="text-xs text-muted-foreground">
                        기본 문구: {defaultSmsMessage}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={!canSubmit}
                className="w-full"
              >
                {sending ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : sendSms ? (
                  <MessageSquareText className="mr-2 h-4 w-4" />
                ) : (
                  <Mail className="mr-2 h-4 w-4" />
                )}
                {sending ? "발송 중" : sendSms ? "메일 + 문자 발송" : "메일 발송"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="min-h-[720px]">
          <CardHeader>
            <CardTitle>메일 미리보기</CardTitle>
            <CardDescription>
              실제 발송 HTML을 확인합니다. 메일 앱에 따라 일부 스타일은 다르게
              보일 수 있습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex h-[620px] items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                템플릿을 불러오는 중입니다.
              </div>
            ) : previewLoading && usesCustomPreview && !previewHtml ? (
              <div className="flex h-[620px] items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                미리보기를 구성하는 중입니다.
              </div>
            ) : previewHtml ? (
              <iframe
                ref={previewFrameRef}
                title="메일 미리보기"
                srcDoc={previewHtml}
                onLoad={wirePreviewCopyActions}
                className="h-[620px] w-full rounded-lg border bg-white"
              />
            ) : (
              <div className="flex h-[620px] items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                선택된 템플릿이 없습니다.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Inbox className="h-5 w-5" />
                    메일 수신함
                  </CardTitle>
                  <CardDescription>
                    네이버웍스 최근 메일 20건을 읽음 처리 없이 조회합니다.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={loadInbox}
                  disabled={inboxLoading}
                >
                  <RefreshCw
                    className={`mr-2 h-4 w-4 ${inboxLoading ? "animate-spin" : ""}`}
                  />
                  새로고침
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {inboxError && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{inboxError}</AlertDescription>
                </Alert>
              )}

              {inboxLoading && inboxMessages.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  수신함을 불러오는 중입니다.
                </div>
              ) : inboxMessages.length === 0 ? (
                <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
                  표시할 메일이 없습니다.
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {inboxMessages.map((message) => (
                    <button
                      key={message.id}
                      type="button"
                      onClick={() => openMail(message.id)}
                      className={`block w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${
                        selectedMail?.id === message.id ? "bg-muted" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold">
                          {message.subject}
                        </p>
                        {!message.seen && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {message.from}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {message.date || "날짜 없음"}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-h-[720px]">
            <CardHeader>
              <CardTitle>메일 내용</CardTitle>
              <CardDescription>
                삭제, 이동, 읽음 처리는 하지 않고 본문만 확인합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {mailLoading ? (
                <div className="flex h-[620px] items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                  메일을 불러오는 중입니다.
                </div>
              ) : selectedMail ? (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <h2 className="text-lg font-semibold">
                      {selectedMail.subject}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      보낸 사람: {selectedMail.from}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      받는 사람: {selectedMail.to || "표시 없음"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      날짜: {selectedMail.date || "표시 없음"}
                    </p>
                  </div>
                  {selectedMail.bodyHtml ? (
                    <iframe
                      title="수신 메일 본문"
                      sandbox=""
                      srcDoc={selectedMail.bodyHtml}
                      className="h-[500px] w-full rounded-lg border bg-white"
                    />
                  ) : (
                    <pre className="h-[500px] overflow-auto whitespace-pre-wrap rounded-lg border bg-white p-4 text-sm leading-relaxed">
                      {selectedMail.bodyText || "본문이 없습니다."}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="flex h-[620px] items-center justify-center rounded-lg border bg-muted/30 text-sm text-muted-foreground">
                  왼쪽에서 메일을 선택하세요.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
