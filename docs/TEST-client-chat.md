# 거래처별 요청건 채팅 테스트 명세

## 데이터/마이그레이션

- `0003_client_chat.sql` 적용 후 `chat_rooms`, `chat_messages`, `chat_attachments`가 존재해야 한다.
- `0004_chat_requests_and_auth.sql` 적용 후 `chat_requests`, `chat_request_items`, `request_id` 컬럼과 인덱스가 존재해야 한다.
- 동일 이메일 local-part로 방을 2개 만들면 두 번째 slug는 suffix가 붙어야 한다.
- 기존 거래처 선택 또는 직접 입력으로 채팅방 생성이 가능해야 한다.

## 관리자 API

- 인증 쿠키가 없으면 `/api/chat/*` 요청은 401을 반환해야 한다.
- `GET /api/chat/rooms`는 방 목록, 마지막 메시지, 미확인 수, 요청건수, 진행건수, 미접수건수를 반환해야 한다.
- `POST /api/chat/rooms`는 기존 client 또는 새 고객 정보로 방을 생성해야 한다.
- `POST /api/chat/rooms/{id}/invite`는 `email` 또는 `sms` 초대를 발송해야 한다.
- `GET /api/chat/rooms/{id}/requests`는 거래처의 요청건 목록을 반환해야 한다.
- `PATCH /api/chat/requests/{id}`는 제목, 요약, 상태, 요청사항 체크리스트를 저장해야 한다.
- 접수/진행/완료 상태로 변경하려면 관리자 지정 제목이 있어야 한다.
- 완료 상태로 변경하려면 체크리스트의 미완료 요청사항이 없어야 한다.
- 완료/취소된 요청건은 다시 진행 상태로 되돌릴 수 없어야 한다.
- `GET /api/chat/requests/{id}`는 메시지를 반환하고 고객 메시지의 `read_by_admin_at`을 채워야 한다.
- `POST /api/chat/requests/{id}/messages`는 관리자 메시지를 생성해야 한다.
- 요청건 상태가 `done` 또는 `cancelled`이면 메시지/첨부 API는 추가 입력을 거부해야 한다.
- 기존 방 단위 메시지/첨부 API는 `requestId` 없이는 쓰기를 거부해야 한다.
- 관리자 파일 업로드는 10MB 초과 시 400을 반환해야 한다.
- 관리자 파일 다운로드는 응답 후 R2 객체 삭제와 `deleted_at`, `downloaded_at` 갱신을 수행해야 한다.

## 고객 인증/API

- 없는 slug는 404를 반환해야 한다.
- OTP 인증 전 `GET /api/public/chat/rooms/{slug}`는 401을 반환해야 한다.
- 등록 이메일과 다른 이메일로 OTP를 요청해도 방 데이터는 노출되지 않아야 한다.
- 올바른 OTP 검증 후 httpOnly 세션 쿠키가 발급되어야 한다.
- 고객 요청 생성은 `인쇄디자인`, `홈페이지`, `마케팅` 외 topic이면 400을 반환해야 한다.
- 고객이 요청건을 열면 관리자 메시지의 `read_by_client_at`이 채워져야 한다.
- 고객 파일 업로드는 10MB 초과 시 400을 반환해야 한다.
- 고객 다운로드는 R2 객체를 삭제하지 않아야 한다.
- 완료/취소 요청건에는 고객도 메시지나 파일을 추가할 수 없어야 한다.

## UI

- `/chats`는 거래처 목록, 요청건 목록, 요청건 상세 편집, 메시지 전송, 파일 첨부, 고객 초대를 제공해야 한다.
- 관리자 요청건 목록 제목은 `YYYY-MM-DD HH:mm · 제목` 형식이어야 한다.
- 요청건 상태 배지는 미접수/접수/진행중/완료/취소로 보여야 한다.
- 완료된 요청건은 입력창과 파일첨부 버튼이 비활성화되어야 한다.
- `/chat/{slug}`는 인증 전 이메일/OTP 폼만 보여야 하며 방 정보와 메시지를 노출하지 않아야 한다.
- 인증 후 고객 화면은 요청건 목록, 새 요청건 생성, 요청건별 메시지, 수신확인, 파일첨부를 제공해야 한다.
- `chat.polarad.co.kr/{slug}`는 `/chat/{slug}`와 동일 화면으로 rewrite되어야 한다.

## 검증 명령

- `npx tsc --noEmit`
- `npm run lint`
- `npx next build --webpack`
- `npm --prefix workers/d1-proxy run typecheck`
- `npm --prefix workers/d1-proxy run deploy -- --dry-run`
