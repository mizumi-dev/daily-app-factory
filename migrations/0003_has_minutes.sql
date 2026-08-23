-- 企画会議の議事録を公開しているアプリのフラグ
ALTER TABLE apps ADD COLUMN has_minutes INTEGER NOT NULL DEFAULT 0;
