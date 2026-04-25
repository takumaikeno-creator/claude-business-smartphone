#!/usr/bin/env bash
# Supabase マイグレーション実行スクリプト
# 使い方: bash scripts/db-migrate.sh [--local]

set -euo pipefail

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$ROOT_DIR/packages/db/migrations/001_initial_schema.sql"
LOCAL="${1:-}"

if [ "$LOCAL" = "--local" ]; then
  # ── ローカル Supabase (supabase start が必要) ──
  info "ローカル Supabase にマイグレーションを実行します"

  if ! command -v supabase &>/dev/null; then
    echo "supabase CLI をインストールしてください:"
    echo "  npm install -g supabase"
    echo "  または: brew install supabase/tap/supabase"
    exit 1
  fi

  cd "$ROOT_DIR"
  supabase db reset --local 2>/dev/null || true
  supabase db push --local
  success "ローカルマイグレーション完了"

else
  # ── リモート Supabase ──
  info "リモート Supabase にマイグレーションを実行します"

  if ! command -v supabase &>/dev/null; then
    warn "supabase CLI が未インストールのため、手動実行モードに切り替えます"
    echo ""
    echo "以下の方法でマイグレーションを実行してください:"
    echo ""
    echo "【方法 A: Supabase Dashboard SQL Editor (推奨・最速)】"
    echo "  1. https://supabase.com/dashboard を開く"
    echo "  2. プロジェクトを選択 → SQL Editor"
    echo "  3. 下記のファイルの内容を全コピーして実行:"
    echo "     $MIGRATION"
    echo ""
    echo "【方法 B: supabase CLI】"
    echo "  npm install -g supabase"
    echo "  supabase login"
    echo "  supabase link --project-ref YOUR_PROJECT_REF"
    echo "  supabase db push"
    echo ""
    # SQLを表示（コピペしやすいように）
    echo "─── SQL内容（コピー用）───"
    cat "$MIGRATION"
    echo "────────────────────────────"
    exit 0
  fi

  if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
    echo "SUPABASE_PROJECT_REF 環境変数を設定してください:"
    echo "  export SUPABASE_PROJECT_REF=your_project_ref"
    echo "  bash scripts/db-migrate.sh"
    exit 1
  fi

  cd "$ROOT_DIR"
  supabase link --project-ref "$SUPABASE_PROJECT_REF"
  supabase db push
  success "リモートマイグレーション完了"
fi
