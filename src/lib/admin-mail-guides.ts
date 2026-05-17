export const DEFAULT_MAIL_SMS_MESSAGE =
  "[폴라애드] 메일 전송드렸습니다. 확인 바랍니다.";

export type AdminMailGuideId = "meta-ad-billing" | "admin-simple-guide";
export type AdminMailCategoryId =
  | "website"
  | "print-design"
  | "marketing"
  | "etc";

export interface AdminMailCategory {
  id: AdminMailCategoryId;
  label: string;
}

export interface AdminMailGuide {
  id: AdminMailGuideId;
  title: string;
  description: string;
  defaultSubject: string;
  defaultCategoryId: AdminMailCategoryId;
  html: string;
}

export const ADMIN_MAIL_CATEGORIES: AdminMailCategory[] = [
  { id: "website", label: "홈페이지 제작" },
  { id: "print-design", label: "인쇄물 디자인" },
  { id: "marketing", label: "마케팅" },
  { id: "etc", label: "기타" },
];

const colors = {
  page: "#F3F5F8",
  card: "#FFFFFF",
  ink: "#1F2937",
  muted: "#4B5565",
  line: "#D9E0EA",
  blue: "#175CD3",
  blueDark: "#123B78",
  blueSoft: "#EEF4FF",
  amberSoft: "#FFF7E6",
  amberLine: "#F2C94C",
  redSoft: "#FFF1F2",
  redLine: "#FECACA",
  redInk: "#991B1B",
};

const fontStack =
  "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif";

const COMPANY_PROFILE = {
  name: "폴라애드",
  nameEn: "POLARAD",
  descriptionLines: ["매출향상에 도움이 되는", "온라인마케팅 대행사"],
  website: "https://polarad.co.kr",
  websiteLabel: "polarad.co.kr",
  email: "mkt@polarad.co.kr",
  phone: "010-9897-9834",
  photoPath: "/images/mail/polarad-profile.png",
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function pill(label: string): string {
  return `
    <span style="display:inline-block;margin:0 0 12px;padding:5px 9px;border-radius:999px;background:${colors.blueSoft};color:${colors.blueDark};font-size:12px;font-weight:700;line-height:1.2;">
      ${esc(label)}
    </span>
  `;
}

function getCategory(id: string | undefined): AdminMailCategory {
  return (
    ADMIN_MAIL_CATEGORIES.find((category) => category.id === id) ||
    ADMIN_MAIL_CATEGORIES[0]
  );
}

function categoryBadge(categoryId: string | undefined): string {
  const category = getCategory(categoryId);
  return `
    <span style="display:inline-block;margin:0;padding:6px 10px;border-radius:999px;background:${colors.blueSoft};border:1px solid #C7D7FE;color:${colors.blueDark};font-size:12px;font-weight:700;line-height:1.2;">
      ${esc(category.label)}
    </span>
  `;
}

function formatMailDateTime(value: Date): string {
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

function sentAtBadge(sentAt: Date): string {
  return `
    <span style="display:inline-block;margin:0;padding:6px 10px;border-radius:999px;background:#F8FAFC;border:1px solid ${colors.line};color:${colors.muted};font-size:12px;font-weight:500;line-height:1.2;">
      ${esc(`발송일시 ${formatMailDateTime(sentAt)}`)}
    </span>
  `;
}

function getProfilePhotoUrl(): string {
  if (process.env.MAIL_PROFILE_IMAGE_URL) {
    return process.env.MAIL_PROFILE_IMAGE_URL;
  }

  const baseUrl =
    process.env.MAIL_ASSET_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.MASTER_URL ||
    "https://master.polarad.co.kr";

  return `${baseUrl.replace(/\/$/, "")}${COMPANY_PROFILE.photoPath}`;
}

function responsiveStyles(): string {
  return `
  <style>
    @media only screen and (max-width: 560px) {
      .mail-outer-pad {
        padding: 16px 10px 26px !important;
      }
      .mail-container {
        width: 100% !important;
        max-width: 100% !important;
      }
      .mail-header-cell {
        padding: 20px 18px 22px !important;
      }
      .mail-card-cell {
        padding: 18px 16px !important;
      }
      .mail-header-label,
      .mail-header-from {
        display: block !important;
        width: 100% !important;
        text-align: left !important;
        padding: 0 0 8px !important;
      }
      .mail-header-from {
        padding-bottom: 0 !important;
      }
      .mail-badge-gap {
        display: block !important;
        width: 0 !important;
        height: 6px !important;
        line-height: 6px !important;
      }
      .profile-card-cell {
        padding: 12px 14px !important;
      }
      .profile-contact-cell {
        padding: 0 0 12px !important;
        border-bottom: 1px solid #E5EAF2 !important;
      }
      .profile-photo-cell {
        width: 56px !important;
        padding: 12px 12px 0 0 !important;
        vertical-align: top !important;
      }
      .profile-main-cell {
        padding: 12px 0 0 !important;
        vertical-align: top !important;
      }
      .profile-contact-table {
        width: 100% !important;
      }
      .profile-contact-label {
        width: 44px !important;
      }
      .profile-contact-value {
        word-break: break-word !important;
      }
    }
  </style>`;
}

function companyProfileFooter(): string {
  const profilePhotoUrl = getProfilePhotoUrl();
  const profileDescriptionHtml = COMPANY_PROFILE.descriptionLines
    .map((line) => esc(line))
    .join("<br>");

  return `
    <tr>
      <td style="padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:#FFFFFF;border:1px solid ${colors.line};border-left:4px solid ${colors.blue};border-radius:8px;">
          <tr>
            <td class="profile-card-cell" style="padding:14px 18px;font-family:${fontStack};color:${colors.ink};font-size:14px;line-height:1.5;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                <tr>
                  <td class="profile-contact-cell" colspan="2" style="padding:0 0 12px;border-bottom:1px solid #E5EAF2;color:${colors.muted};font-size:12px;line-height:1.45;">
                    <table class="profile-contact-table" role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td class="profile-contact-label" width="48" style="padding:0 0 4px;color:#7A8496;font-size:11px;font-weight:700;line-height:1.4;">WEB</td>
                        <td class="profile-contact-value" style="padding:0 0 4px;font-size:12px;line-height:1.4;"><a href="${COMPANY_PROFILE.website}" target="_blank" rel="noopener" style="color:${colors.blue};text-decoration:none;">${esc(COMPANY_PROFILE.websiteLabel)}</a></td>
                      </tr>
                      <tr>
                        <td class="profile-contact-label" width="48" style="padding:0 0 4px;color:#7A8496;font-size:11px;font-weight:700;line-height:1.4;">MAIL</td>
                        <td class="profile-contact-value" style="padding:0 0 4px;font-size:12px;line-height:1.4;"><span data-copy-value="${esc(COMPANY_PROFILE.email)}" data-copy-label="메일주소" style="display:inline-block;color:${colors.blue};text-decoration:none;cursor:pointer;user-select:all;">${esc(COMPANY_PROFILE.email)}</span></td>
                      </tr>
                      <tr>
                        <td class="profile-contact-label" width="48" style="padding:0;color:#7A8496;font-size:11px;font-weight:700;line-height:1.4;">TEL</td>
                        <td class="profile-contact-value" style="padding:0;font-size:12px;line-height:1.4;"><span data-copy-value="${esc(COMPANY_PROFILE.phone)}" data-copy-label="전화번호" style="display:inline-block;color:${colors.blue};text-decoration:none;cursor:pointer;user-select:all;">${esc(COMPANY_PROFILE.phone)}</span></td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td class="profile-photo-cell" valign="top" width="62" style="padding:12px 14px 0 0;vertical-align:top;">
                    <img src="${esc(profilePhotoUrl)}" width="56" alt="폴라애드 프로필 사진" style="display:block;width:56px;height:auto;border:1px solid ${colors.line};border-radius:6px;vertical-align:top;">
                  </td>
                  <td class="profile-main-cell" valign="top" style="padding:12px 0 0;vertical-align:top;">
                    <strong style="display:block;color:${colors.ink};font-size:17px;line-height:1.3;font-weight:700;">${esc(COMPANY_PROFILE.name)} <span style="color:${colors.blueDark};font-weight:700;">${esc(COMPANY_PROFILE.nameEn)}</span></strong>
                    <span style="display:block;margin-top:4px;color:${colors.muted};font-size:13px;line-height:1.4;font-weight:400;">${profileDescriptionHtml}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function card(content: string, extraStyle = ""): string {
  return `
    <tr>
      <td style="padding:0 0 14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:${colors.card};border:1px solid ${colors.line};border-radius:8px;${extraStyle}">
          <tr>
            <td class="mail-card-cell" style="padding:20px 22px 20px;font-family:${fontStack};color:${colors.ink};font-size:15px;line-height:1.68;font-weight:400;">
              ${content}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function h2(text: string): string {
  return `<h2 style="margin:0 0 10px;color:${colors.ink};font-size:20px;line-height:1.38;font-weight:700;letter-spacing:0;">${esc(text)}</h2>`;
}

function h3(text: string): string {
  return `<h3 style="margin:0 0 8px;color:${colors.ink};font-size:17px;line-height:1.38;font-weight:700;letter-spacing:0;">${esc(text)}</h3>`;
}

function paragraph(text: string, style = ""): string {
  return `<p style="margin:0 0 12px;color:${colors.muted};font-size:15px;line-height:1.68;font-weight:400;${style}">${esc(text)}</p>`;
}

function paragraphWithBreaks(text: string, style = ""): string {
  const html = text
    .split(/\r?\n/)
    .map((line) => esc(line))
    .join("<br>");

  return `<p style="margin:0 0 12px;color:${colors.muted};font-size:15px;line-height:1.68;font-weight:400;${style}">${html}</p>`;
}

function list(items: string[]): string {
  return `
    <ol style="margin:8px 0 0;padding-left:22px;color:${colors.muted};font-size:15px;line-height:1.68;font-weight:400;">
      ${items.map((item) => `<li style="margin:6px 0;">${esc(item)}</li>`).join("")}
    </ol>
  `;
}

function note(text: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin-top:14px;background:${colors.amberSoft};border:1px solid ${colors.amberLine};border-radius:8px;">
      <tr>
        <td style="padding:12px 14px;color:#6F5200;font-size:14px;line-height:1.62;font-weight:600;">
          ${esc(text)}
        </td>
      </tr>
    </table>
  `;
}

function metric(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:10px 0;border-top:1px solid #E5EAF2;">
        <span style="display:block;color:${colors.muted};font-size:12px;font-weight:700;">${esc(label)}</span>
        <span style="display:block;margin-top:3px;color:${colors.blueDark};font-size:20px;line-height:1.25;font-weight:700;">${esc(value)}</span>
      </td>
    </tr>
  `;
}

function shell(input: {
  title: string;
  eyebrow: string;
  lead: string;
  body: string;
  preheader: string;
  categoryId: AdminMailCategoryId;
  sentAt: Date;
}): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
${responsiveStyles()}
  <title>${esc(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${colors.page};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    ${esc(input.preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${colors.page};">
    <tr>
      <td class="mail-outer-pad" align="center" style="padding:24px 12px 34px;">
        <table class="mail-container" role="presentation" width="680" cellpadding="0" cellspacing="0" style="width:100%;max-width:680px;border-collapse:separate;border-spacing:0;">
          <tr>
            <td style="padding:0 0 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;background:${colors.card};border:1px solid ${colors.line};border-top:6px solid ${colors.blue};border-radius:10px;">
                <tr>
                  <td class="mail-header-cell" style="padding:24px 28px 24px;font-family:${fontStack};">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td class="mail-header-label" style="padding:0 0 16px;color:${colors.blueDark};font-size:11px;font-weight:700;line-height:1.3;">POLARAD GUIDE</td>
                        <td class="mail-header-from" align="right" style="padding:0 0 16px;color:#7A8496;font-size:11px;font-weight:400;line-height:1.3;">mkt@polarad.co.kr</td>
                      </tr>
                      <tr>
                        <td colspan="2" style="padding:0 0 14px;">
                          ${categoryBadge(input.categoryId)}
                          <span class="mail-badge-gap" style="display:inline-block;width:6px;line-height:1;font-size:0;">&nbsp;</span>
                          ${sentAtBadge(input.sentAt)}
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0 0 10px;color:${colors.blue};font-size:11px;font-weight:700;letter-spacing:.04em;line-height:1.3;">${esc(input.eyebrow)}</p>
                    <h1 style="margin:0;color:${colors.ink};font-size:24px;line-height:1.36;font-weight:700;letter-spacing:0;">${esc(input.title)}</h1>
                    <p style="margin:12px 0 0;color:${colors.muted};font-size:15px;line-height:1.68;font-weight:400;">${esc(input.lead)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${input.body}
          ${companyProfileFooter()}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildMetaAdBillingHtml(
  categoryId: AdminMailCategoryId,
  sentAt = new Date(),
): string {
  return shell({
  title: "Meta 광고 초기 결제 안내",
  eyebrow: "META AD BILLING GUIDE",
  lead: "카드 확인 소액, 실제 광고비 청구, 일예산 변동을 구분해서 보시면 결제 내역을 쉽게 확인할 수 있습니다.",
  preheader: "Meta 광고 초기 결제와 일예산 변동 기준을 안내드립니다.",
  categoryId,
  sentAt,
  body: [
    card(`
      ${pill("핵심 요약")}
      ${h2("처음 보이는 소액은 실제 광고비와 다를 수 있습니다")}
      ${paragraph("카드 등록 직후 보이는 소액은 결제 수단 확인을 위한 임시 승인일 수 있습니다. 실제 광고비는 Meta 광고가 노출되며 누적된 금액이 결제 기준액에 도달할 때 청구됩니다.")}
      ${note("실제 광고비는 Meta Ads Manager의 Billing & payments, Payment activity에서 영수증과 함께 확인합니다.")}
    `),
    card(`
      ${pill("결제 흐름")}
      ${h2("왜 한 달에 여러 번 결제처럼 보이나요?")}
      ${list([
        "카드 등록 시 결제 수단 확인을 위한 임시 승인이 보일 수 있습니다.",
        "광고가 시작되면 실제 사용 금액이 조금씩 누적됩니다.",
        "누적 금액이 결제 기준액에 닿으면 Meta가 자동으로 결제합니다.",
        "초기 결제 기준액이 낮으면 같은 달에도 여러 번 결제가 보일 수 있습니다.",
      ])}
    `),
    card(`
      ${pill("일예산")}
      ${h2("일예산은 하루 고정 상한이 아닙니다")}
      ${paragraph("Meta의 일예산은 매일 같은 금액을 강제로 쓰는 방식이 아닙니다. 광고 기회가 많은 날은 더 쓰고 다른 날에 줄이며 주간 기준으로 조정될 수 있습니다.")}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px;">
        ${metric("설정 일예산 예시", "10만원")}
        ${metric("하루 최대 예시", "17.5만원")}
        ${metric("7일 총액 기준", "70만원")}
      </table>
    `),
    card(`
      ${pill("고객 안내 문구")}
      ${h2("한 문단으로 설명하면")}
      ${paragraph(
        "Meta 광고비는 처음 카드 확인을 위한 임시 승인과 실제 광고비 청구가 따로 보일 수 있습니다. 실제 광고비는 광고가 노출되며 쌓인 금액이 결제 기준액에 도달할 때마다 자동 청구됩니다. 또한 일예산은 하루 고정 금액이 아니라 7일 평균 목표라서, 광고 반응이 좋은 날은 더 쓰고 반응이 적은 날은 덜 쓰며 주간 총액을 맞추는 방식입니다.",
        `color:${colors.ink};font-size:15px;font-weight:500;`,
      )}
    `),
  ].join(""),
  });
}

function buildAdminSimpleGuideHtml(
  categoryId: AdminMailCategoryId,
  sentAt = new Date(),
): string {
  return shell({
  title: "운영 관리자 기본 안내",
  eyebrow: "ADMIN BASIC GUIDE",
  lead: "텔레그램 앱 설치, 알림방 입장, 스팸 차단 설정, 관리자 로그인 방법을 한 번에 확인하는 기본 가이드입니다.",
  preheader: "운영 담당자를 위한 관리자 접속과 텔레그램 기본 설정 안내입니다.",
  categoryId,
  sentAt,
  body: [
    card(`
      ${pill("1. 앱 설치")}
      ${h2("텔레그램 앱 다운로드")}
      ${list([
        "아이폰은 App Store, 안드로이드는 Play Store를 엽니다.",
        "검색창에 Telegram Messenger를 입력합니다.",
        "설치 후 휴대폰 번호 인증을 완료합니다.",
      ])}
      <p style="margin:14px 0 0;"><a href="https://telegram.org/apps" target="_blank" rel="noopener" style="display:inline-block;padding:11px 15px;border-radius:8px;background:${colors.blue};color:#FFFFFF;font-size:14px;font-weight:700;text-decoration:none;">텔레그램 공식 다운로드</a></p>
    `),
    card(`
      ${pill("2. 채팅방 입장")}
      ${h2("텔레그램 알림방 들어가기")}
      ${list([
        "담당자가 전달한 텔레그램 초대 링크를 누릅니다.",
        "텔레그램 앱이 열리면 Join 또는 참가를 누릅니다.",
        "상담 접수 알림을 놓치지 않도록 해당 방의 알림을 켜 둡니다.",
      ])}
    `),
    card(`
      ${pill("3. 스팸 차단")}
      ${h2("텔레그램 기본 스팸 차단 설정")}
      ${list([
        "텔레그램 앱에서 설정을 엽니다.",
        "개인 정보 및 보안 메뉴로 들어갑니다.",
        "전화번호 공개 범위는 없음, 번호로 찾기는 내 연락처로 설정합니다.",
        "그룹 및 채널 초대 권한은 내 연락처로 설정합니다.",
      ])}
      ${note("휴대폰 기종이나 텔레그램 버전에 따라 메뉴 위치는 조금 다를 수 있습니다. 메뉴 이름을 기준으로 찾으면 됩니다.")}
    `),
    card(`
      ${pill("4. 관리자 접속")}
      ${h2("사용자 아이디와 비밀번호로 로그인")}
      ${list([
        "담당자가 전달한 관리자 주소를 브라우저에서 엽니다.",
        "로그인 화면에서 사용자 아이디와 비밀번호를 입력합니다.",
        "로그인 후 접수 목록, 고객 정보, 처리 상태를 확인합니다.",
        "공용 PC에서는 업무가 끝난 뒤 반드시 로그아웃합니다.",
      ])}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;margin-top:14px;background:${colors.redSoft};border:1px solid ${colors.redLine};border-radius:8px;">
        <tr>
          <td style="padding:13px 15px;color:${colors.redInk};font-size:14px;line-height:1.65;font-weight:700;">
            관리자 주소, 사용자 아이디, 비밀번호는 필요한 담당자에게만 전달합니다.
          </td>
        </tr>
      </table>
    `),
    card(`
      ${pill("5. 접수 처리")}
      ${h2("접수 확인 기본 순서")}
      ${list([
        "텔레그램 알림을 확인합니다.",
        "관리자에 로그인해서 새 접수 내용을 엽니다.",
        "고객에게 연락하고 상태를 상담중 또는 완료로 변경합니다.",
        "나중에 다시 볼 수 있도록 필요한 메모를 남깁니다.",
      ])}
    `),
  ].join(""),
  });
}

export function renderAdminCustomMailHtml(input: {
  subject: string;
  bodyText: string;
  categoryId: AdminMailCategoryId;
  sentAt?: Date;
}): string {
  const normalizedBody = input.bodyText.trim();
  const paragraphs = normalizedBody
    ? normalizedBody.split(/\n\s*\n/g).map((block) => block.trim()).filter(Boolean)
    : ["작성한 메일 본문이 이 영역에 표시됩니다."];
  const lead = paragraphs[0] || "요청하신 내용을 안내드립니다.";
  const title = input.subject.trim() || "폴라애드 안내 메일";

  return shell({
    title,
    eyebrow: "POLARAD NOTICE",
    lead,
    preheader: lead,
    categoryId: input.categoryId,
    sentAt: input.sentAt || new Date(),
    body: card(`
      ${pill("안내 내용")}
      ${h2("안내드립니다")}
      ${paragraphs.map((block) => paragraphWithBreaks(block)).join("")}
    `),
  });
}

const GUIDE_HTML_BUILDERS: Record<
  AdminMailGuideId,
  (categoryId: AdminMailCategoryId, sentAt?: Date) => string
> = {
  "meta-ad-billing": buildMetaAdBillingHtml,
  "admin-simple-guide": buildAdminSimpleGuideHtml,
};

export const ADMIN_MAIL_GUIDES: AdminMailGuide[] = [
  {
    id: "meta-ad-billing",
    title: "Meta 초기 결제 안내 메일",
    description:
      "Meta 광고 시작 후 카드 소액 승인, 자동 청구, 일예산 변동을 설명합니다.",
    defaultSubject: "[폴라애드] Meta 광고 초기 결제 안내",
    defaultCategoryId: "marketing",
    html: buildMetaAdBillingHtml("marketing"),
  },
  {
    id: "admin-simple-guide",
    title: "운영 관리자 기본 안내 메일",
    description:
      "브랜드 고유 정보를 제거한 텔레그램 앱, 스팸 차단, 채팅방 입장, 관리자 ID/PW 접속 안내입니다.",
    defaultSubject: "[폴라애드] 운영 관리자 기본 안내",
    defaultCategoryId: "etc",
    html: buildAdminSimpleGuideHtml("etc"),
  },
];

export function getAdminMailGuide(id: string): AdminMailGuide | undefined {
  return ADMIN_MAIL_GUIDES.find((guide) => guide.id === id);
}

export function normalizeAdminMailCategoryId(
  value: unknown,
  fallback: AdminMailCategoryId = "website",
): AdminMailCategoryId {
  if (
    typeof value === "string" &&
    ADMIN_MAIL_CATEGORIES.some((category) => category.id === value)
  ) {
    return value as AdminMailCategoryId;
  }
  return fallback;
}

export function renderAdminMailGuideHtml(
  guideId: AdminMailGuideId,
  categoryId: AdminMailCategoryId,
  sentAt = new Date(),
): string {
  return GUIDE_HTML_BUILDERS[guideId](categoryId, sentAt);
}
