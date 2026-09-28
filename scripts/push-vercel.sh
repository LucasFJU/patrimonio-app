#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-https://github.com/LucasFJU/patrimonio-app.git}"

if [ ! -d ".git" ]; then
  git init -b main
fi

if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REPO_URL"
else
  git remote add origin "$REPO_URL"
fi

git add -A
if ! git diff --cached --quiet; then
  git commit -m "feat: versao final unificada do casal com exportacao de resumo em PDF e layout mobile otimizado"
fi

echo "Repositório configurado para: $(git remote get-url origin)"
echo "Enviando branch main para o GitHub (conectado à Vercel)..."
git push -u origin main
