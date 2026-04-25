-- SumaGig Initial Schema
-- Run against: Supabase PostgreSQL
-- Migration: 001

-- ── プロフィール ──
CREATE TABLE IF NOT EXISTS profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  role          TEXT CHECK (role IN ('worker','client','both')) DEFAULT 'both',
  bio           TEXT,
  skills        TEXT[] DEFAULT '{}',
  rating        NUMERIC(3,2) DEFAULT 0,
  review_count  INT DEFAULT 0,
  is_premium    BOOLEAN DEFAULT false,
  premium_until TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 案件 ──
CREATE TABLE IF NOT EXISTS jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT CHECK (category IN ('content','design','research','translation','ai')) NOT NULL,
  budget_min  INT NOT NULL CHECK (budget_min > 0),
  budget_max  INT NOT NULL CHECK (budget_max >= budget_min),
  deadline    TIMESTAMPTZ,
  status      TEXT CHECK (status IN ('open','in_progress','completed','cancelled')) DEFAULT 'open',
  is_featured BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── 応募 ──
CREATE TABLE IF NOT EXISTS applications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id         UUID REFERENCES jobs(id) ON DELETE CASCADE NOT NULL,
  worker_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  message        TEXT NOT NULL,
  proposed_price INT NOT NULL CHECK (proposed_price > 0),
  status         TEXT CHECK (status IN ('pending','accepted','rejected','withdrawn')) DEFAULT 'pending',
  created_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, worker_id)
);

-- ── 契約 ──
CREATE TABLE IF NOT EXISTS contracts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                   UUID REFERENCES jobs(id) NOT NULL,
  worker_id                UUID REFERENCES profiles(id) NOT NULL,
  client_id                UUID REFERENCES profiles(id) NOT NULL,
  amount                   INT NOT NULL CHECK (amount > 0),
  platform_fee             INT NOT NULL,
  status                   TEXT CHECK (status IN ('active','delivered','completed','disputed')) DEFAULT 'active',
  stripe_payment_intent_id TEXT,
  delivered_at             TIMESTAMPTZ,
  completed_at             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT now()
);

-- ── チャットメッセージ ──
CREATE TABLE IF NOT EXISTS messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE NOT NULL,
  sender_id   UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content     TEXT,
  file_url    TEXT,
  file_type   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  CHECK (content IS NOT NULL OR file_url IS NOT NULL)
);

-- ── 評価 ──
CREATE TABLE IF NOT EXISTS reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) UNIQUE NOT NULL,
  reviewer_id UUID REFERENCES profiles(id) NOT NULL,
  reviewee_id UUID REFERENCES profiles(id) NOT NULL,
  rating      INT CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── インデックス ──
CREATE INDEX IF NOT EXISTS jobs_status_idx ON jobs(status);
CREATE INDEX IF NOT EXISTS jobs_category_idx ON jobs(category);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS jobs_is_featured_idx ON jobs(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS applications_job_id_idx ON applications(job_id);
CREATE INDEX IF NOT EXISTS applications_worker_id_idx ON applications(worker_id);
CREATE INDEX IF NOT EXISTS contracts_worker_id_idx ON contracts(worker_id);
CREATE INDEX IF NOT EXISTS contracts_client_id_idx ON contracts(client_id);
CREATE INDEX IF NOT EXISTS messages_contract_id_created_idx ON messages(contract_id, created_at);

-- ── RLS ──
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- プロフィール: 全員が読める、自分だけ書ける
CREATE POLICY "profiles_select_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);

-- 案件: 全員が読める、クライアントだけ書ける
CREATE POLICY "jobs_select_open" ON jobs FOR SELECT USING (status = 'open' OR client_id = auth.uid());
CREATE POLICY "jobs_insert_own" ON jobs FOR INSERT WITH CHECK (auth.uid() = client_id);
CREATE POLICY "jobs_update_own" ON jobs FOR UPDATE USING (auth.uid() = client_id);

-- 応募: 本人とクライアントだけ読める
CREATE POLICY "applications_select" ON applications FOR SELECT
  USING (worker_id = auth.uid() OR job_id IN (SELECT id FROM jobs WHERE client_id = auth.uid()));
CREATE POLICY "applications_insert_worker" ON applications FOR INSERT WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "applications_update_client" ON applications FOR UPDATE
  USING (job_id IN (SELECT id FROM jobs WHERE client_id = auth.uid()));

-- 契約: 当事者だけ
CREATE POLICY "contracts_parties" ON contracts FOR ALL
  USING (worker_id = auth.uid() OR client_id = auth.uid());

-- メッセージ: 契約当事者だけ
CREATE POLICY "messages_parties" ON messages FOR ALL
  USING (contract_id IN (
    SELECT id FROM contracts WHERE worker_id = auth.uid() OR client_id = auth.uid()
  ));

-- 評価: 全員が読める
CREATE POLICY "reviews_select_all" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_insert_party" ON reviews FOR INSERT
  WITH CHECK (reviewer_id = auth.uid());

-- ── 評価更新トリガー ──
CREATE OR REPLACE FUNCTION update_profile_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE profiles
  SET
    rating = (SELECT AVG(rating) FROM reviews WHERE reviewee_id = NEW.reviewee_id),
    review_count = (SELECT COUNT(*) FROM reviews WHERE reviewee_id = NEW.reviewee_id)
  WHERE id = NEW.reviewee_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER after_review_insert
  AFTER INSERT ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_profile_rating();

-- ── プロフィール自動生成トリガー ──
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
