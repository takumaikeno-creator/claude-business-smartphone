#!/usr/bin/env bash
# 環境変数バリデーター
# 使い方: bash scripts/validate-env.sh

set -uo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; ERRORS=$((ERRORS+1)); }
warn() { echo -e "  ${YELLOW}~${NC} $1 (任意)"; }

ERRORS=0
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo ""
echo "環境変数チェック"
echo "─────────────────────────────"

# ── モバイル .env ──
echo ""
echo "apps/mobile/.env"
MOBILE_ENV="$ROOT_DIR/apps/mobile/.env"

if [ -f "$MOBILE_ENV" ]; then
  # shellcheck disable=SC1090
  source "$MOBILE_ENV" 2>/dev/null || true

  [[ "${EXPO_PUBLIC_SUPABASE_URL:-}" == https://*.supabase.co* ]] \
    && ok "EXPO_PUBLIC_SUPABASE_URL" \
    || fail "EXPO_PUBLIC_SUPABASE_URL が未設定 (例: https://xxxx.supabase.co)"

  [[ "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" == eyJ* ]] \
    && ok "EXPO_PUBLIC_SUPABASE_ANON_KEY" \
    || fail "EXPO_PUBLIC_SUPABASE_ANON_KEY が未設定"

  [[ "${EXPO_PUBLIC_API_URL:-}" == https://* ]] \
    && ok "EXPO_PUBLIC_API_URL" \
    || warn "EXPO_PUBLIC_API_URL が未設定 (デプロイ後に設定)"

  [[ "${EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}" == pk_* ]] \
    && ok "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY" \
    || fail "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY が未設定"
else
  echo -e "  ${RED}✗${NC} .env ファイルが存在しません: $MOBILE_ENV"
  echo "     → bash scripts/setup.sh を実行してください"
  ERRORS=$((ERRORS+1))
fi

# ── API .dev.vars ──
echo ""
echo "packages/api/.dev.vars"
API_ENV="$ROOT_DIR/packages/api/.dev.vars"

if [ -f "$API_ENV" ]; then
  # shellcheck disable=SC1090
  source "$API_ENV" 2>/dev/null || true

  [[ "${SUPABASE_URL:-}" == https://*.supabase.co* ]] \
    && ok "SUPABASE_URL" \
    || fail "SUPABASE_URL が未設定"

  [[ "${SUPABASE_SERVICE_ROLE_KEY:-}" == eyJ* ]] \
    && ok "SUPABASE_SERVICE_ROLE_KEY" \
    || fail "SUPABASE_SERVICE_ROLE_KEY が未設定"

  [[ "${ANTHROPIC_API_KEY:-}" == sk-ant-* ]] \
    && ok "ANTHROPIC_API_KEY" \
    || fail "ANTHROPIC_API_KEY が未設定"

  [[ "${STRIPE_SECRET_KEY:-}" == sk_* ]] \
    && ok "STRIPE_SECRET_KEY" \
    || fail "STRIPE_SECRET_KEY が未設定"

  [[ "${STRIPE_WEBHOOK_SECRET:-}" == whsec_* ]] \
    && ok "STRIPE_WEBHOOK_SECRET" \
    || warn "STRIPE_WEBHOOK_SECRET が未設定 (Webhook 設定後に追加)"
else
  echo -e "  ${RED}✗${NC} .dev.vars が存在しません: $API_ENV"
  echo "     → bash scripts/setup.sh を実行してください"
  ERRORS=$((ERRORS+1))
fi

# ── 結果 ──
echo ""
echo "─────────────────────────────"
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}✓ すべての必須環境変数が設定済みです${NC}"
  exit 0
else
  echo -e "${RED}✗ $ERRORS 個の必須環境変数が未設定です${NC}"
  echo "  SETUP.md を参照して設定してください"
  exit 1
fi
