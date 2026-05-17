-- Polarad D1 Migration 0002: content 테이블 확장
-- pipeline.py + marketing-news 호환을 위한 컬럼 추가 (2026-04-27)

-- featured: 폴라애드 홈페이지 마케팅뉴스 페이지에서 추천 글 표시
ALTER TABLE content ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;

-- author: 작성자 표시 (기본 "폴라애드")
ALTER TABLE content ADD COLUMN author TEXT NOT NULL DEFAULT '폴라애드';

-- Instagram 발행 추적 (단순 boolean에서 풀 메타데이터로)
ALTER TABLE content ADD COLUMN instagram_post_id TEXT;
ALTER TABLE content ADD COLUMN instagram_permalink TEXT;
ALTER TABLE content ADD COLUMN instagram_caption TEXT;

-- Threads/Twitter 발행 추적 (확장 가능)
ALTER TABLE content ADD COLUMN threads_post_id TEXT;

CREATE INDEX IF NOT EXISTS idx_content_featured ON content(featured);
CREATE INDEX IF NOT EXISTS idx_content_category ON content(category);
