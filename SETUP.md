# SumaGig 環境構築ガイド

**所要時間**: 約90分（アカウント作成含む）  
**難易度**: ★★☆☆☆（コマンドのコピペ中心）

---

## 前提条件

| ツール | バージョン | インストール |
|--------|-----------|------------|
| Node.js | v20以上 | https://nodejs.org/ |
| Git | 任意 | https://git-scm.com/ |
| npm | v10以上 | Node.jsに同梱 |

---

## Step 0: クイックスタート（まずここから）

```bash
# リポジトリをクローン（既にある場合はスキップ）
git clone https://github.com/takumaikeno-creator/claude-business-smartphone.git
cd claude-business-smartphone

# セットアップスクリプト実行（依存関係インストール + .env ファイル作成）
bash scripts/setup.sh
```

スクリプトが完了したら、次のステップで各サービスのAPIキーを取得して `.env` に設定します。

---

## Step 1: Supabase セットアップ（DB・認証）

### 1-1. プロジェクト作成

1. [https://supabase.com](https://supabase.com) にアクセス → **Start for free**
2. GitHubアカウントでサインアップ
3. **New Project** → プロジェクト名: `sumagig` → リージョン: `Northeast Asia (Tokyo)`
4. パスワードを設定（保存しておく）→ **Create new project**

### 1-2. APIキーのコピー

1. プロジェクトダッシュボード → **Settings** → **API**
2. 以下をコピー:

```
Project URL      → SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL
anon public key  → EXPO_PUBLIC_SUPABASE_ANON_KEY
service_role key → SUPABASE_SERVICE_ROLE_KEY（⚠️ 絶対に公開しない）
```

### 1-3. データベースのセットアップ

**方法A: ダッシュボードから実行（推奨・最速）**

1. **SQL Editor** → **New query**
2. `packages/db/migrations/001_initial_schema.sql` の内容を全コピー
3. **Run** をクリック → `Success` が表示されれば完了

**方法B: CLIから実行**

```bash
npm install -g supabase
supabase login
export SUPABASE_PROJECT_REF=your_project_ref  # Settings > General > Reference ID
bash scripts/db-migrate.sh
```

### 1-4. Google OAuth 設定

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. **Create Credentials** → **OAuth client ID** → アプリケーションの種類: **iOS** と **Android** でそれぞれ作成
3. Supabase ダッシュボード → **Authentication** → **Providers** → **Google**
4. Client ID と Secret を入力 → **Save**
5. Authorized redirect URI に Supabase の Callback URL を追加

---

## Step 2: Stripe セットアップ（決済）

### 2-1. アカウント・APIキー取得

1. [https://stripe.com/jp](https://stripe.com/jp) → アカウント作成
2. ダッシュボード → **開発者** → **APIキー**
3. **テスト用の秘密鍵** (`sk_test_...`) をコピー → `STRIPE_SECRET_KEY`
4. **公開可能キー** (`pk_test_...`) をコピー → `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### 2-2. Webhook エンドポイント設定

> ⚠️ バックエンドをデプロイした後に実施してください

1. **開発者** → **Webhooks** → **Add endpoint**
2. エンドポイントURL: `https://sumagig-api.YOUR_SUBDOMAIN.workers.dev/api/v1/payments/webhook`
3. 監視するイベントを選択:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.amount_capturable_updated`
4. **Add endpoint** → **Signing secret** (`whsec_...`) をコピー → `STRIPE_WEBHOOK_SECRET`

---

## Step 3: Anthropic APIキー取得（AI機能）

1. [https://console.anthropic.com/](https://console.anthropic.com/) → アカウント作成
2. **API Keys** → **Create Key**
3. キー名: `sumagig-production` → コピー → `ANTHROPIC_API_KEY`

> 💡 使用量の上限を設定することを推奨: **Settings** → **Limits** → Monthly spend limit を ¥5,000相当に設定

---

## Step 4: 環境変数の設定

```bash
# apps/mobile/.env を編集
nano apps/mobile/.env
```

```env
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
EXPO_PUBLIC_API_URL=https://sumagig-api.YOUR_SUBDOMAIN.workers.dev
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

```bash
# packages/api/.dev.vars を編集
nano packages/api/.dev.vars
```

```env
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

```bash
# 設定を確認
bash scripts/validate-env.sh
```

全て ✓ になればOKです。

---

## Step 5: バックエンドAPIのデプロイ（Cloudflare Workers）

### 5-1. Cloudflare アカウント作成

1. [https://cloudflare.com](https://cloudflare.com) → **Sign up** （無料プランでOK）

### 5-2. Wrangler CLI インストール・ログイン

```bash
npm install -g wrangler
wrangler login
# ブラウザが開くのでCloudflareアカウントで認証
```

### 5-3. 本番 Secrets の設定

```bash
cd packages/api

# 各Secretを対話的に入力（コピペでOK）
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put STRIPE_SECRET_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

### 5-4. デプロイ

```bash
npm run deploy
# → https://sumagig-api.YOUR_SUBDOMAIN.workers.dev にデプロイされます
```

```bash
# 動作確認
curl https://sumagig-api.YOUR_SUBDOMAIN.workers.dev/health
# → {"status":"healthy","ts":"2026-..."}
```

### 5-5. APIのURLをモバイル .env に設定

```bash
nano apps/mobile/.env
# EXPO_PUBLIC_API_URL=https://sumagig-api.YOUR_SUBDOMAIN.workers.dev
```

---

## Step 6: LP のデプロイ（Vercel）

```bash
npm install -g vercel

# ルートディレクトリから実行
vercel deploy --prod

# → https://sumagig.vercel.app のようなURLが発行されます
```

---

## Step 7: モバイルアプリのビルド・配信（EAS Build）

### 7-1. Expo アカウント・EAS CLI

```bash
npm install -g eas-cli
eas login
```

### 7-2. プロジェクトID の設定

```bash
cd apps/mobile
eas init
# → apps/mobile/app.json の extra.eas.projectId が自動設定されます
```

### 7-3. ビルド

```bash
# テスト用ビルド（内部配布）
eas build --profile preview --platform all

# 本番ビルド（App Store / Google Play 提出用）
eas build --profile production --platform all
```

### 7-4. ストア提出

```bash
# App Store Connect
eas submit --platform ios

# Google Play Console
eas submit --platform android
```

> ⏱ App Store 審査: 通常1〜3日 / Google Play 審査: 通常1〜2日

---

## Step 8: 動作確認チェックリスト

```
[ ] LP が https://sumagig.vercel.app で表示される
[ ] /health エンドポイントが 200 を返す
[ ] Supabase の profiles テーブルが存在する
[ ] Googleログインでユーザー登録できる
[ ] 案件を1件作成できる
[ ] 案件に応募できる
[ ] Stripe テスト決済が通る（カード番号: 4242 4242 4242 4242）
[ ] チャットメッセージが送れる
[ ] プッシュ通知が届く（実機のみ）
```

---

## ローカル開発

```bash
# バックエンドAPI（ローカル起動）
cd packages/api && npm run dev
# → http://localhost:8787

# モバイルアプリ（Expo Dev Client）
cd apps/mobile && npm start
# → QRコードをExpo GoアプリでスキャンしてiOS/Androidで動作確認

# LP
npx serve . -p 3000
# → http://localhost:3000
```

---

## トラブルシューティング

### Supabase への接続エラー
```
Error: Invalid API key
```
→ `.env` の SUPABASE_ANON_KEY が正しくコピーされているか確認。スペースや改行が混入していないか確認。

### Stripe Webhook の署名エラー
```
Error: Invalid signature
```
→ `.dev.vars` の STRIPE_WEBHOOK_SECRET が Webhook エンドポイントの Signing secret と一致しているか確認。

### Expo ビルドエラー
```
Error: Cannot find module 'expo-router'
```
→ `cd apps/mobile && npm install` を再実行。

### Wrangler デプロイエラー
```
Error: Missing script: deploy
```
→ `cd packages/api` してから `npm run deploy` を実行。

---

## サポート

問題が解決しない場合は、以下に詳細を添えてご連絡ください:
- エラーメッセージ全文
- 実行したコマンド
- OS（macOS / Windows / Linux）
- Node.jsバージョン（`node -v`）
