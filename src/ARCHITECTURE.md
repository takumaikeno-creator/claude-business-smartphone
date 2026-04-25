# SumaGig 技術アーキテクチャ仕様書

**対象**: エンジニア採用後の初日から動けるレベルの設計書  
**バージョン**: v0.1  
**PM**: Claude

---

## 技術スタック決定

| レイヤー | 採用技術 | 選定理由 |
|--------|---------|---------|
| モバイルアプリ | **Expo (React Native)** | iOS/Android/Web 同時対応、OTA更新、RN エコシステム |
| 状態管理 | **Zustand** | 軽量・シンプル・TypeScript親和性高い |
| バックエンド | **Hono on Cloudflare Workers** | エッジ実行・低レイテンシ・無料枠大 |
| DB | **Supabase (PostgreSQL)** | RLS・リアルタイム購読・Auth内蔵 |
| ファイルストレージ | **Supabase Storage** | DB と同じ権限管理で一元化 |
| 認証 | **Supabase Auth** (LINE/Google OAuth) | 日本向けLINE必須 |
| 決済 | **Stripe** + **PayPay API** | カード + 国内QRコード決済カバー |
| AI | **Claude API (claude-sonnet-4-6)** | 高品質な日本語・プロンプトキャッシュでコスト最適化 |
| プッシュ通知 | **Expo Push Notifications** | iOSとAndroidを統一API で管理 |
| CI/CD | **GitHub Actions** + **EAS Build** | 自動テスト・OTAデプロイ |

---

## ディレクトリ構成（モノレポ）

```
sumagig/
├── apps/
│   ├── mobile/          # Expo アプリ (React Native)
│   │   ├── app/         # Expo Router (ファイルベースルーティング)
│   │   │   ├── (auth)/  # 認証前スクリーン
│   │   │   ├── (tabs)/  # メインタブ画面
│   │   │   └── _layout.tsx
│   │   ├── components/
│   │   ├── stores/      # Zustand ストア
│   │   ├── hooks/
│   │   └── lib/         # API クライアント・ユーティリティ
│   └── web/             # LP (現在の index.html)
├── packages/
│   ├── api/             # Hono バックエンド (Cloudflare Workers)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   └── index.ts
│   │   └── wrangler.toml
│   ├── db/              # DB スキーマ・マイグレーション
│   │   └── migrations/
│   └── shared/          # 型定義・バリデーション (Zod)
└── .github/workflows/
```

---

## データベーススキーマ

```sql
-- ユーザー（Supabase Auth と連携）
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id),
  username    TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url  TEXT,
  role        TEXT CHECK (role IN ('worker', 'client', 'both')) DEFAULT 'both',
  bio         TEXT,
  skills      TEXT[],
  rating      NUMERIC(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,
  is_premium  BOOLEAN DEFAULT false,
  premium_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 案件
CREATE TABLE jobs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID REFERENCES profiles(id) NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  category    TEXT CHECK (category IN ('content','design','research','translation','ai')) NOT NULL,
  budget_min  INT NOT NULL,  -- 円
  budget_max  INT NOT NULL,
  deadline    TIMESTAMPTZ,
  status      TEXT CHECK (status IN ('open','in_progress','completed','cancelled')) DEFAULT 'open',
  is_featured BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 応募
CREATE TABLE applications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID REFERENCES jobs(id) NOT NULL,
  worker_id   UUID REFERENCES profiles(id) NOT NULL,
  message     TEXT NOT NULL,
  proposed_price INT NOT NULL,
  status      TEXT CHECK (status IN ('pending','accepted','rejected','withdrawn')) DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_id, worker_id)
);

-- 契約（応募承認後に生成）
CREATE TABLE contracts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID REFERENCES jobs(id) NOT NULL,
  worker_id   UUID REFERENCES profiles(id) NOT NULL,
  client_id   UUID REFERENCES profiles(id) NOT NULL,
  amount      INT NOT NULL,  -- エスクロー金額（円）
  platform_fee INT NOT NULL, -- 15%
  status      TEXT CHECK (status IN ('active','delivered','completed','disputed')) DEFAULT 'active',
  stripe_payment_intent_id TEXT,
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- チャットメッセージ
CREATE TABLE messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) NOT NULL,
  sender_id   UUID REFERENCES profiles(id) NOT NULL,
  content     TEXT,
  file_url    TEXT,
  file_type   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 評価
CREATE TABLE reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) UNIQUE NOT NULL,
  reviewer_id UUID REFERENCES profiles(id) NOT NULL,
  reviewee_id UUID REFERENCES profiles(id) NOT NULL,
  rating      INT CHECK (rating BETWEEN 1 AND 5) NOT NULL,
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS ポリシー（主要なもの）
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_own_update" ON profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_contract_parties" ON messages FOR ALL
  USING (
    contract_id IN (
      SELECT id FROM contracts
      WHERE worker_id = auth.uid() OR client_id = auth.uid()
    )
  );
```

---

## API エンドポイント設計

### 認証
```
POST /auth/line          # LINE OAuth コールバック
POST /auth/google        # Google OAuth コールバック
POST /auth/refresh       # トークンリフレッシュ
```

### プロフィール
```
GET  /profiles/:id       # プロフィール取得
PUT  /profiles/me        # 自分のプロフィール更新
POST /profiles/me/avatar # アバター画像アップロード
```

### 案件
```
GET  /jobs               # 案件一覧（フィルタ・ページネーション）
POST /jobs               # 案件作成
GET  /jobs/:id           # 案件詳細
PUT  /jobs/:id           # 案件更新（クライアントのみ）
POST /jobs/:id/feature   # フィーチャード掲載
```

### 応募
```
POST /jobs/:id/apply     # 応募
GET  /jobs/:id/applications # 応募一覧（クライアントのみ）
PUT  /applications/:id   # 応募ステータス更新（承認/却下）
```

### 契約・決済
```
POST /contracts          # 契約作成（応募承認時に自動）
POST /contracts/:id/deliver   # 納品通知
POST /contracts/:id/complete  # 完了承認 → Stripe 送金トリガー
POST /contracts/:id/dispute   # 異議申し立て
```

### AI アシスタント（プレミアム機能）
```
POST /ai/proposal        # 応募文自動生成
POST /ai/profile         # プロフィール最適化提案
POST /ai/price-advice    # 単価交渉アドバイス
```

### 通知
```
GET  /notifications      # 通知一覧
PUT  /notifications/:id/read  # 既読
```

---

## AI アシスタント実装（Claude API）

```typescript
// packages/api/src/routes/ai.ts
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// プロンプトキャッシュ活用: システムプロンプトをキャッシュ
const SYSTEM_PROMPT = `あなたはSumaGigのAI副業アシスタントです。
ワーカーがスマートフォンで仕事を受注するのを支援します。
日本語で、簡潔かつ実践的なアドバイスを提供してください。`;

export async function generateProposal(
  jobDescription: string,
  workerProfile: WorkerProfile
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" }, // キャッシュで70%コスト削減
      },
    ],
    messages: [
      {
        role: "user",
        content: `以下の案件への応募文を200字以内で作成してください。

案件: ${jobDescription}

私のスキル: ${workerProfile.skills.join(", ")}
私の実績: ${workerProfile.bio}`,
      },
    ],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}
```

---

## 決済フロー（エスクロー）

```
1. クライアントが案件に応募を承認
   └─ POST /contracts → Stripe PaymentIntent 作成（金額 = 発注額 + 手数料15%）

2. クライアントがスマホで支払い
   └─ Stripe Elements（React Native対応）
   └─ 支払い完了 → エスクローに保管

3. ワーカーが納品
   └─ POST /contracts/:id/deliver

4. クライアントが成果物を確認・承認
   └─ POST /contracts/:id/complete
   └─ Stripe Transfer → ワーカーのConnectアカウントに送金
   └─ 手数料はSumaGigアカウントに保留

5. 自動承認（7日間未応答の場合）
   └─ Cron job（Cloudflare Workers Cron Trigger）
```

---

## 開発の進め方（エンジニアへの指示）

### Week 1 優先タスク

1. **Supabase プロジェクト作成** → 上記スキーマを全てマイグレーション
2. **Expo プロジェクト初期化** → `npx create-expo-app apps/mobile --template tabs`
3. **Supabase Auth 設定** → Google OAuth（まずこれだけ）
4. **プロフィール作成画面** → 最低限: 名前・スキルタグ選択・送信
5. **案件一覧画面** → ダミーデータで表示確認

### コーディング規約

- TypeScript strict mode 必須
- Zod でバリデーション（`shared` パッケージで型共有）
- コンポーネントは `components/ui/` に汎用部品、`components/features/` に機能別
- `any` 禁止・`console.log` は開発時のみ（`__DEV__` フラグ）
- PR は機能単位・250行以内を目安

### ブランチ戦略

```
main           ← 本番（直接プッシュ禁止）
staging        ← ステージング（毎日自動デプロイ）
feature/*      ← 機能開発
fix/*          ← バグ修正
```

---

## 環境変数一覧

```bash
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=  # バックエンドのみ

# Stripe
STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# PayPay
PAYPAY_API_KEY=
PAYPAY_API_SECRET=
PAYPAY_MERCHANT_ID=

# Anthropic
ANTHROPIC_API_KEY=

# LINE
LINE_CHANNEL_ID=
LINE_CHANNEL_SECRET=
```
