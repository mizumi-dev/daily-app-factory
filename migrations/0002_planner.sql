-- 企画ステージの参加AIを記録する（DeepSeek + 1社のペア運用）
ALTER TABLE apps ADD COLUMN planner TEXT;
ALTER TABLE apps ADD COLUMN adopted_planner TEXT;
