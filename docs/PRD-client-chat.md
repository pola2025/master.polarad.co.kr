# 거래처별 요청건 채팅 관리 PRD

## 목표

관리자가 거래처별 고객 채팅방을 발급하고, 고객은 초대 링크에서 이메일 OTP 인증 후 요청건 단위로 폴라애드에 업무 요청을 남긴다. 관리자는 요청건을 접수하면서 제목, 요약, 체크리스트를 정리하고 완료 처리하면 해당 요청건 채팅을 종료한다.

## 핵심 요구사항

- 고객 링크는 `https://chat.polarad.co.kr/{slug}`이며 기본 slug는 고객 이메일의 `@` 앞부분이다.
- 관리자는 채팅방 생성/열기 후 `이메일 초대` 또는 `문자 초대`를 선택해 고객에게 링크를 보낼 수 있다.
- 링크만으로는 입장되지 않는다. 고객은 등록된 이메일로 6자리 인증번호를 받아야 한다.
- 고객 요청 주제는 `인쇄디자인`, `홈페이지`, `마케팅` 3개로 제한한다.
- 채팅은 하나의 무한 대화방이 아니라 `요청건` 단위로 분리한다.
- 요청건 제목은 관리자가 지정한다.
- 요청건 목록 제목은 항상 `요청일시 · 관리자 지정 제목` 형식으로 표시한다.
- 관리자가 요청을 접수하면 요청건수로 카운트한다. 미접수 상담은 별도 상태로 둔다.
- 관리자는 채팅 내용을 바탕으로 `요청사항 1, 2, 3...` 체크리스트를 정리한다.
- 요청건 상태가 `완료` 또는 `취소`가 되면 해당 요청건 채팅은 종료되어 메시지/첨부를 추가할 수 없다.
- 고객/관리자 양쪽 모두 수신확인 상태를 볼 수 있어야 한다.
- 첨부파일은 10MB 이하만 허용하고 Cloudflare R2에 저장한다.
- 관리자가 첨부파일을 다운로드하면 해당 R2 객체와 DB 첨부 상태를 삭제 처리한다.
- 고객 메시지가 들어오면 Telegram 봇 환경변수로 관리자에게 알림을 보낸다.

## 범위

### 1차 구현

- D1 테이블: `chat_rooms`, `chat_requests`, `chat_request_items`, `chat_messages`, `chat_attachments`
- R2 Worker 바인딩: `CHAT_FILES`
- 고객 인증: 등록 이메일 OTP + httpOnly 세션 쿠키
- 관리자 초대: 이메일 또는 NCP SENS 문자 선택 발송
- 관리자 UI: `/chats`
- 고객 UI: `/chat/{slug}`
- `chat.polarad.co.kr/{slug}` 호스트를 `/chat/{slug}`로 rewrite

### 1차 제외

- WebSocket/실시간 push. 1차는 polling으로 구현한다.
- 첨부파일 바이러스 스캔. 2차에서 업로드 확장자 정책과 스캔 워커를 추가한다.
- 고객별 권한자 여러 명. 1차는 거래처 등록 이메일 1개 기준으로 인증한다.

## 데이터 모델

### chat_rooms

- `id`, `client_id`, `slug`
- `client_email`, `client_name`, `company`
- `status`: `open` 또는 `closed`
- `last_message_at`, `created_at`, `updated_at`

### chat_requests

- `id`, `room_id`, `client_id`
- `topic`: `인쇄디자인`, `홈페이지`, `마케팅`
- `title`: 관리자 지정 제목
- `summary`: 관리자 요약
- `status`: `draft`, `accepted`, `in_progress`, `done`, `cancelled`
- `accepted_at`, `completed_at`, `last_message_at`, `created_at`, `updated_at`

### chat_request_items

- `id`, `request_id`
- `content`
- `status`: `todo` 또는 `done`
- `sort_order`, `created_at`, `updated_at`

### chat_messages

- `id`, `room_id`, `request_id`
- `sender_type`: `client` 또는 `admin`
- `topic`, `body`, `attachment_id`
- `read_by_client_at`, `read_by_admin_at`, `created_at`

### chat_attachments

- `id`, `room_id`, `request_id`, `message_id`
- `r2_key`, `filename`, `content_type`, `size_bytes`
- `uploaded_by`, `downloaded_at`, `deleted_at`, `created_at`

## 보안/운영 기준

- 공개 채팅 API는 slug만으로 데이터를 반환하지 않는다. OTP 세션 쿠키가 없으면 401을 반환한다.
- 인증번호는 Redis에 짧은 TTL로 저장하고 재발송 쿨다운과 최대 시도 횟수를 둔다.
- 인증 세션은 httpOnly, sameSite lax 쿠키로 발급한다.
- 관리자 API는 `requireAuth()`를 통과해야 한다.
- R2 객체는 public bucket URL을 쓰지 않고 Worker 내부 API로만 접근한다.
- 관리자 다운로드는 10MB 제한 내에서 파일 본문 응답 후 R2 삭제와 DB 삭제 상태 업데이트를 수행한다.
- Telegram/NCP/SMTP 토큰은 코드에 저장하지 않고 환경변수만 사용한다.

## 성공 기준

- 관리자가 `/chats`에서 채팅방을 만들고 이메일/문자 초대를 보낼 수 있다.
- 고객이 `/chat/{slug}`에서 이메일 OTP 인증 후 요청건을 생성할 수 있다.
- 관리자가 요청건 제목, 요약, 체크리스트, 상태를 저장할 수 있다.
- 요청건 제목은 목록에서 `요청일시 · 제목`으로 보인다.
- 완료 처리된 요청건은 고객/관리자 모두 추가 메시지와 첨부가 차단된다.
- 양쪽 메시지에 수신확인이 표시된다.
- 10MB 초과 파일 업로드는 거부된다.
- 10MB 이하 파일은 R2 저장 후 메시지에 첨부된다.
- 관리자가 파일을 다운로드하면 이후 같은 첨부파일은 삭제 상태로 표시된다.
