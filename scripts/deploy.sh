#!/usr/bin/env bash
# SumaGig デプロイスクリプト
# 使い方:
#   bash scripts/deploy.sh api      # バックエンドのみ
#   bash scripts/deploy.sh lp       # LP のみ
#   bash scripts/deploy.sh all      # 全て

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; RED='\033[0;31m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"

deploy_api() {
  info "バックエンドAPI (Cloudflare Workers) をデプロイ中..."
  command -v wrangler &>/dev/null || error "wrangler が未インストール: npm install -g wrangler"

  cd "$ROOT_DIR/packages/api"

  # 本番 Secrets を設定（初回のみ）
  if [ "${SETUP_SECRETS:-}" = "1" ]; then
    warn "Secrets を設定します（Wrangler の対話入力が必要）"
    for secret in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY ANTHROPIC_API_KEY \
                  STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET; do
      echo "Setting: $secret"
      wrangler secret put "$secret"
    done
  fi

  npm run deploy
  success "バックエンドAPI デプロイ完了"
  cd "$ROOT_DIR"
}

deploy_lp() {
  info "LP (Vercel) をデプロイ中..."
  command -v vercel &>/dev/null || error "vercel CLI が未インストール: npm install -g vercel"

  cd "$ROOT_DIR"
  vercel deploy --prod
  success "LP デプロイ完了"
}

case "$TARGET" in
  api)  deploy_api ;;
  lp)   deploy_lp ;;
  all)
    # 環境変数チェック
    bash "$ROOT_DIR/scripts/validate-env.sh" || {
      warn "環境変数が未設定のものがあります。続行しますか？ (y/N)"
      read -r ans
      [[ "$ans" =~ ^[Yy]$ ]] || exit 1
    }
    deploy_api
    deploy_lp
    ;;
  *)
    echo "使い方: bash scripts/deploy.sh [api|lp|all]"
    exit 1
    ;;
esac

echo ""
success "デプロイ完了！"
echo ""
echo "次のステップ:"
echo "  - モバイルアプリ: cd apps/mobile && eas build --platform all"
echo "  - Stripe Webhook URL を更新: https://YOUR_API.workers.dev/api/v1/payments/webhook"
