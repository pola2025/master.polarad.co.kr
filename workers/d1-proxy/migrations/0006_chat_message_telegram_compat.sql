-- Polarad D1 Migration 0006: compatibility column for legacy chat message lookups
-- 운영 D1에는 telegram_message_id 컬럼이 이미 존재합니다.
-- Wrangler 마이그레이션 재실행 시 duplicate column 오류를 막기 위해 no-op으로 기록합니다.
SELECT 1;
