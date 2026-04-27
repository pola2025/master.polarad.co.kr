-- Polarad D1 Migration 0001: Initial schema
-- 19 tables: 8 business + 1 content + 10 analytics cache
-- Convention:
--   * id TEXT PRIMARY KEY (Airtable rec ID 보존, 신규는 UUID v4)
--   * created_at / updated_at TEXT ISO8601 (UTC)
--   * 한글 옵션 enum 금지 → TEXT로 저장하고 코드에서 매핑
--   * JSON 직렬화 필드는 TEXT
--   * boolean = INTEGER (0/1)

-- ==========================================
-- 1. lead — 홈페이지 접수 리드
-- ==========================================
CREATE TABLE IF NOT EXISTS lead (
  id              TEXT    PRIMARY KEY,
  no              INTEGER NOT NULL,                      -- autoNumber 호환
  name            TEXT    NOT NULL DEFAULT '',
  company         TEXT             DEFAULT '',
  email           TEXT             DEFAULT '',
  phone           TEXT    NOT NULL DEFAULT '',
  message         TEXT             DEFAULT '',
  privacy         INTEGER NOT NULL DEFAULT 0,            -- boolean
  memo            TEXT             DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'Todo',       -- Todo/In progress/Done/Hold
  contract_amount INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_lead_no          ON lead(no DESC);
CREATE INDEX IF NOT EXISTS idx_lead_created_at  ON lead(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_status      ON lead(status);
CREATE INDEX IF NOT EXISTS idx_lead_phone       ON lead(phone);

-- ==========================================
-- 2. meta_lead — Meta 광고 리드
-- ==========================================
CREATE TABLE IF NOT EXISTS meta_lead (
  id              TEXT    PRIMARY KEY,                   -- Meta lead_id 또는 UUID
  name            TEXT             DEFAULT '',
  phone           TEXT    NOT NULL DEFAULT '',
  company         TEXT             DEFAULT '',
  industry        TEXT             DEFAULT '',
  ad_name         TEXT             DEFAULT '',
  status          TEXT    NOT NULL DEFAULT 'Todo',
  memo            TEXT             DEFAULT '',
  sms_status      TEXT             DEFAULT '',
  sms_sent_at     TEXT             DEFAULT '',
  sms_error       TEXT             DEFAULT '',
  sms_reply       INTEGER NOT NULL DEFAULT 0,
  contract_amount INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_meta_lead_created_at ON meta_lead(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meta_lead_status     ON meta_lead(status);
CREATE INDEX IF NOT EXISTS idx_meta_lead_phone      ON meta_lead(phone);

-- ==========================================
-- 3. revenue — 매출 (Single Source of Truth)
-- ==========================================
CREATE TABLE IF NOT EXISTS revenue (
  id            TEXT    PRIMARY KEY,
  inquiry_id    TEXT             DEFAULT '',             -- lead.id 또는 meta_lead.id
  client_id     TEXT             DEFAULT '',             -- clients.id
  client_name   TEXT             DEFAULT '',
  type          TEXT             DEFAULT '',             -- 광고/제작/컨설팅 등
  product_name  TEXT             DEFAULT '',
  amount        INTEGER NOT NULL DEFAULT 0,
  date          TEXT             DEFAULT '',             -- YYYY-MM-DD
  memo          TEXT             DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_revenue_date       ON revenue(date DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_inquiry_id ON revenue(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_revenue_client_id  ON revenue(client_id);

-- ==========================================
-- 4. clients — 거래처
-- ==========================================
CREATE TABLE IF NOT EXISTS clients (
  id               TEXT    PRIMARY KEY,
  company          TEXT    NOT NULL DEFAULT '',
  contact_name     TEXT             DEFAULT '',
  phone            TEXT             DEFAULT '',
  email            TEXT             DEFAULT '',
  industry         TEXT             DEFAULT '',
  website          TEXT             DEFAULT '',
  address          TEXT             DEFAULT '',
  business_number  TEXT             DEFAULT '',
  contract_amount  INTEGER NOT NULL DEFAULT 0,
  contract_start   TEXT             DEFAULT '',          -- YYYY-MM-DD
  contract_end     TEXT             DEFAULT '',          -- YYYY-MM-DD
  status           TEXT    NOT NULL DEFAULT 'Active',    -- Waiting/Active/Expired/Cancelled
  memo             TEXT             DEFAULT '',
  inquiry_id       TEXT             DEFAULT '',          -- lead.id
  created_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_clients_status     ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_company    ON clients(company);
CREATE INDEX IF NOT EXISTS idx_clients_inquiry_id ON clients(inquiry_id);

-- ==========================================
-- 5. proposals — 제안서
-- ==========================================
CREATE TABLE IF NOT EXISTS proposals (
  id           TEXT    PRIMARY KEY,
  slug         TEXT    NOT NULL UNIQUE,
  title        TEXT    NOT NULL DEFAULT '',
  subtitle     TEXT             DEFAULT '',
  client_name  TEXT             DEFAULT '',
  amount       INTEGER NOT NULL DEFAULT 0,
  products     TEXT             DEFAULT '',              -- JSON array
  date         TEXT             DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'public',        -- public/private (영문)
  views        INTEGER NOT NULL DEFAULT 0,
  theme_color  TEXT             DEFAULT '',
  password     TEXT             DEFAULT '',
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_proposals_status     ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);

-- ==========================================
-- 6. ad_spend — 월별 광고비
-- ==========================================
CREATE TABLE IF NOT EXISTS ad_spend (
  id             TEXT    PRIMARY KEY,
  month          TEXT    NOT NULL UNIQUE,                -- YYYY-MM
  meta_amount    INTEGER NOT NULL DEFAULT 0,
  google_amount  INTEGER NOT NULL DEFAULT 0,
  memo           TEXT             DEFAULT '',
  created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_ad_spend_month ON ad_spend(month DESC);

-- ==========================================
-- 7. blacklist — 차단 전화번호
-- ==========================================
CREATE TABLE IF NOT EXISTS blacklist (
  id          TEXT    PRIMARY KEY,
  phone       TEXT    NOT NULL UNIQUE,                   -- 정규화된 (010xxxxxxxx)
  name        TEXT             DEFAULT '',
  reason      TEXT             DEFAULT '',
  source      TEXT    NOT NULL DEFAULT '수동',            -- 홈페이지/Meta/수동
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_blacklist_phone ON blacklist(phone);

-- ==========================================
-- 8. brand_reports — 브랜드 분석 리포트
-- ==========================================
CREATE TABLE IF NOT EXISTS brand_reports (
  id                  TEXT    PRIMARY KEY,
  business_name       TEXT             DEFAULT '',
  industry            TEXT             DEFAULT '',
  contact_name        TEXT             DEFAULT '',
  contact_phone       TEXT             DEFAULT '',
  contact_email       TEXT             DEFAULT '',
  inquiry_id          TEXT             DEFAULT '',
  inquiry_source      TEXT             DEFAULT '',       -- website/meta
  naver_search_data   TEXT             DEFAULT '',       -- JSON
  google_search_data  TEXT             DEFAULT '',       -- JSON
  ai_search_data      TEXT             DEFAULT '',       -- JSON
  naver_score         INTEGER,
  google_score        INTEGER,
  overall_score       INTEGER,
  report_content      TEXT             DEFAULT '',
  report_html         TEXT             DEFAULT '',
  summary             TEXT             DEFAULT '',
  status              TEXT    NOT NULL DEFAULT 'pending',-- pending/analyzing/draft/reviewed/sent/discarded/failed
  sent_at             TEXT,
  pdf_url             TEXT,
  inquiry_date        TEXT,
  analysis_type       TEXT,                              -- local/naming/auto/similar
  email_opened_at     TEXT,
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_brand_reports_inquiry_id ON brand_reports(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_brand_reports_status     ON brand_reports(status);
CREATE INDEX IF NOT EXISTS idx_brand_reports_created_at ON brand_reports(created_at DESC);

-- ==========================================
-- 9. content — 뉴스레터/블로그 콘텐츠
-- ==========================================
CREATE TABLE IF NOT EXISTS content (
  id                TEXT    PRIMARY KEY,
  date              TEXT             DEFAULT '',
  title             TEXT    NOT NULL DEFAULT '',
  category          TEXT             DEFAULT '',
  content           TEXT             DEFAULT '',
  tags              TEXT             DEFAULT '',         -- comma or JSON
  seo_keywords      TEXT             DEFAULT '',
  published_at      TEXT,
  status            TEXT    NOT NULL DEFAULT 'draft',    -- draft/published/scheduled
  slug              TEXT    NOT NULL UNIQUE,
  description       TEXT             DEFAULT '',
  thumbnail_url     TEXT             DEFAULT '',
  views             INTEGER NOT NULL DEFAULT 0,
  instagram_posted  INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_content_status       ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_published_at ON content(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_slug         ON content(slug);

-- ==========================================
-- 10. daily_analytics — GA4 일별 통계
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_analytics (
  date          TEXT    PRIMARY KEY,                     -- YYYY-MM-DD (자연키)
  visitors      INTEGER NOT NULL DEFAULT 0,
  pageviews     INTEGER NOT NULL DEFAULT 0,
  sessions      INTEGER NOT NULL DEFAULT 0,
  new_users     INTEGER NOT NULL DEFAULT 0,
  bounce_rate   REAL    NOT NULL DEFAULT 0,
  avg_duration  REAL    NOT NULL DEFAULT 0,
  collected_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ==========================================
-- 11. traffic_sources — 채널별 트래픽
-- ==========================================
CREATE TABLE IF NOT EXISTS traffic_sources (
  date          TEXT    NOT NULL,
  channel       TEXT    NOT NULL,
  visitors      INTEGER NOT NULL DEFAULT 0,
  sessions      INTEGER NOT NULL DEFAULT 0,
  percentage    REAL    NOT NULL DEFAULT 0,
  bounce_rate   REAL    NOT NULL DEFAULT 0,
  avg_duration  REAL    NOT NULL DEFAULT 0,
  PRIMARY KEY (date, channel)
);
CREATE INDEX IF NOT EXISTS idx_traffic_sources_date ON traffic_sources(date DESC);

-- ==========================================
-- 12. top_pages — 페이지별 통계
-- ==========================================
CREATE TABLE IF NOT EXISTS top_pages (
  date          TEXT    NOT NULL,
  path          TEXT    NOT NULL,
  title         TEXT             DEFAULT '',
  views         INTEGER NOT NULL DEFAULT 0,
  unique_views  INTEGER NOT NULL DEFAULT 0,
  avg_time      TEXT             DEFAULT '0:00',
  bounce_rate   REAL    NOT NULL DEFAULT 0,
  PRIMARY KEY (date, path)
);
CREATE INDEX IF NOT EXISTS idx_top_pages_date_views ON top_pages(date DESC, views DESC);

-- ==========================================
-- 13. devices — 기기별 통계
-- ==========================================
CREATE TABLE IF NOT EXISTS devices (
  date        TEXT    NOT NULL,
  device      TEXT    NOT NULL,
  visitors    INTEGER NOT NULL DEFAULT 0,
  percentage  REAL    NOT NULL DEFAULT 0,
  PRIMARY KEY (date, device)
);
CREATE INDEX IF NOT EXISTS idx_devices_date ON devices(date DESC);

-- ==========================================
-- 14. countries — 지역별 통계 (region/country)
-- ==========================================
CREATE TABLE IF NOT EXISTS countries (
  date        TEXT    NOT NULL,
  country     TEXT    NOT NULL,
  visitors    INTEGER NOT NULL DEFAULT 0,
  percentage  REAL    NOT NULL DEFAULT 0,
  PRIMARY KEY (date, country)
);
CREATE INDEX IF NOT EXISTS idx_countries_date ON countries(date DESC);

-- ==========================================
-- 15. hourly_traffic — 시간대별 통계
-- ==========================================
CREATE TABLE IF NOT EXISTS hourly_traffic (
  date      TEXT    NOT NULL,
  hour      TEXT    NOT NULL,
  visitors  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, hour)
);
CREATE INDEX IF NOT EXISTS idx_hourly_traffic_date ON hourly_traffic(date DESC);

-- ==========================================
-- 16. bot_visits — 봇 방문 로그 (write-heavy)
-- ==========================================
CREATE TABLE IF NOT EXISTS bot_visits (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp   TEXT    NOT NULL,
  date        TEXT    NOT NULL,
  bot_name    TEXT    NOT NULL,
  category    TEXT    NOT NULL DEFAULT '',
  path        TEXT             DEFAULT '',
  ip          TEXT             DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_bot_visits_date      ON bot_visits(date DESC);
CREATE INDEX IF NOT EXISTS idx_bot_visits_timestamp ON bot_visits(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bot_visits_bot_name  ON bot_visits(bot_name);

-- ==========================================
-- 17. bot_daily_stats — 봇 일별 집계
-- ==========================================
CREATE TABLE IF NOT EXISTS bot_daily_stats (
  date            TEXT    PRIMARY KEY,
  total_visits    INTEGER NOT NULL DEFAULT 0,
  bot_visits      INTEGER NOT NULL DEFAULT 0,
  human_visits    INTEGER NOT NULL DEFAULT 0,
  bot_percentage  REAL    NOT NULL DEFAULT 0,
  categories      TEXT    NOT NULL DEFAULT '{}',         -- JSON
  top_bots        TEXT    NOT NULL DEFAULT '{}'          -- JSON
);

-- ==========================================
-- 18. google_ads_daily — 구글광고 일별 통계
-- ==========================================
CREATE TABLE IF NOT EXISTS google_ads_daily (
  date                     TEXT    PRIMARY KEY,
  visitors                 INTEGER NOT NULL DEFAULT 0,
  sessions                 INTEGER NOT NULL DEFAULT 0,
  pageviews                INTEGER NOT NULL DEFAULT 0,
  conversions              INTEGER NOT NULL DEFAULT 0,
  bounce_rate              REAL    NOT NULL DEFAULT 0,
  avg_duration             REAL    NOT NULL DEFAULT 0,
  cvr                      REAL    NOT NULL DEFAULT 0,
  total_visitors           INTEGER NOT NULL DEFAULT 0,
  total_sessions           INTEGER NOT NULL DEFAULT 0,
  total_conversions        INTEGER NOT NULL DEFAULT 0,
  visitor_contribution     REAL    NOT NULL DEFAULT 0,
  session_contribution     REAL    NOT NULL DEFAULT 0,
  conversion_contribution  REAL    NOT NULL DEFAULT 0,
  ads_cost                 REAL,
  ads_clicks               INTEGER,
  ads_impressions          INTEGER,
  cpc                      REAL,
  cpa                      REAL,
  campaigns_json           TEXT    NOT NULL DEFAULT '[]',
  collected_at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

-- ==========================================
-- 19. cache_metadata — 캐시 메타데이터
-- ==========================================
CREATE TABLE IF NOT EXISTS cache_metadata (
  cache_key      TEXT    PRIMARY KEY,
  last_updated   TEXT    NOT NULL,
  status         TEXT    NOT NULL DEFAULT 'pending',     -- success/error/pending
  record_count   INTEGER NOT NULL DEFAULT 0,
  error_message  TEXT             DEFAULT ''
);
