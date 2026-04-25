#!/usr/bin/env bash
# SumaGig セットアップスクリプト
# 使い方: bash scripts/setup.sh

set -euo pipefail

# ── カラー出力 ──
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
step()    { echo -e "\n${BLUE}━━━ $* ━━━${NC}"; }

echo -e "${BLUE}"
echo "  ██████  ██    ██ ███    ███  █████  ██████  ██  ██████ "
echo " ██       ██    ██ ████  ████ ██   ██ ██   ██ ██ ██      "
echo "  █████   ██    ██ ██ ████ ██ ███████ ██   ██ ██ ██  ███ "
echo "      ██  ██    ██ ██  ██  ██ ██   ██ ██   ██ ██ ██   ██ "
echo " ██████    ██████  ██      ██ ██   ██ ██████  ██  ██████ "
echo -e "${NC}"
echo "  SumaGig セットアップスクリプト v0.1"
echo "  ─────────────────────────────────────"

# ── Step 1: 必要ツールの確認 ──
step "Step 1: 必要ツールの確認"

check_command() {
  if command -v "$1" &>/dev/null; then
    success "$1 ($(command -v "$1"))"
  else
    error "$1 が見つかりません。インストールしてください: $2"
  fi
}

check_command node    "https://nodejs.org/"
check_command npm     "https://nodejs.org/"
check_command git     "https://git-scm.com/"

# Node バージョン確認 (>=20)
NODE_VERSION=$(node -e "process.exit(parseInt(process.version.slice(1)) < 20 ? 1 : 0)" 2>&1 || echo "old")
if [ "$NODE_VERSION" = "old" ]; then
  error "Node.js v20以上が必要です。現在: $(node -v)"
fi
success "Node.js $(node -v)"

# オプションツール（なくても進める）
for tool in supabase wrangler eas-cli vercel; do
  if command -v "$tool" &>/dev/null; then
    success "$tool"
  else
    warn "$tool は未インストール（後で必要になります）"
  fi
done

# ── Step 2: 依存関係インストール ──
step "Step 2: 依存関係インストール"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

info "ルート依存関係..."
npm install --silent
success "ルート依存関係 インストール完了"

info "モバイルアプリ依存関係..."
cd "$ROOT_DIR/apps/mobile" && npm install --silent
success "apps/mobile インストール完了"

info "バックエンドAPI依存関係..."
cd "$ROOT_DIR/packages/api" && npm install --silent
success "packages/api インストール完了"

cd "$ROOT_DIR"

# ── Step 3: 環境変数ファイルの作成 ──
step "Step 3: 環境変数ファイルの作成"

# モバイル .env
MOBILE_ENV="$ROOT_DIR/apps/mobile/.env"
if [ ! -f "$MOBILE_ENV" ]; then
  cp "$ROOT_DIR/apps/mobile/.env.example" "$MOBILE_ENV"
  success ".env を作成しました: $MOBILE_ENV"
  warn "⚠️  $MOBILE_ENV を開いて値を設定してください"
else
  info ".env は既に存在します: $MOBILE_ENV"
fi

# API .dev.vars (Wrangler ローカル開発用)
API_ENV="$ROOT_DIR/packages/api/.dev.vars"
if [ ! -f "$API_ENV" ]; then
  cat > "$API_ENV" <<'DEVVARS'
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAY_API_KEY=
PAYPAY_API_SECRET=
PAYPAY_MERCHANT_ID=
DEVVARS
  success ".dev.vars を作成しました: $API_ENV"
  warn "⚠️  $API_ENV を開いて値を設定してください"
else
  info ".dev.vars は既に存在します: $API_ENV"
fi

# ── Step 4: 環境変数バリデーション ──
step "Step 4: 環境変数チェック"
bash "$ROOT_DIR/scripts/validate-env.sh" || true

# ── Step 5: TypeScript チェック ──
step "Step 5: TypeScript 型チェック"

info "バックエンドAPI..."
cd "$ROOT_DIR/packages/api"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  warn "型エラーあり（環境変数未設定の場合は想定内）"
else
  success "packages/api 型チェック OK"
fi

info "モバイルアプリ..."
cd "$ROOT_DIR/apps/mobile"
if npx tsc --noEmit 2>&1 | grep -q "error TS"; then
  warn "型エラーあり（.env 未設定の場合は想定内）"
else
  success "apps/mobile 型チェック OK"
fi

cd "$ROOT_DIR"

# ── Step 6: 次のステップ案内 ──
step "Step 6: 次のステップ"

echo ""
echo -e "${GREEN}セットアップ完了！次の作業:${NC}"
echo ""
echo -e "${YELLOW}【必須】API キーの設定${NC}"
echo "  1. Supabase:     https://supabase.com/dashboard"
echo "     → 新規プロジェクト作成 → Settings > API > URL & anon key をコピー"
echo ""
echo "  2. Stripe:       https://dashboard.stripe.com/"
echo "     → Developers > API keys > Secret key をコピー"
echo "     → Webhooks > Add endpoint: https://YOUR_API.workers.dev/api/v1/payments/webhook"
echo "     → 監視イベント: customer.subscription.* を追加"
echo ""
echo "  3. Anthropic:    https://console.anthropic.com/"
echo "     → API Keys > Create Key をコピー"
echo ""
echo "  4. Google OAuth: https://console.cloud.google.com/"
echo "     → OAuth 2.0 クライアントID 作成"
echo "     → Supabase Dashboard > Authentication > Providers > Google に設定"
echo ""
echo -e "${YELLOW}【DB マイグレーション実行】${NC}"
echo "  supabase link --project-ref YOUR_PROJECT_REF"
echo "  supabase db push"
echo "  # または Supabase Dashboard > SQL Editor に"
echo "  # packages/db/migrations/001_initial_schema.sql を貼り付けて実行"
echo ""
echo -e "${YELLOW}【デプロイ】${NC}"
echo "  # バックエンド (Cloudflare Workers)"
echo "  cd packages/api && npm run deploy"
echo ""
echo "  # LP (Vercel)"
echo "  vercel deploy --prod"
echo ""
echo "  # モバイルアプリ (EAS Build)"
echo "  cd apps/mobile && eas build --platform all"
echo ""
echo -e "${GREEN}詳細は SETUP.md を参照してください。${NC}"
echo ""
