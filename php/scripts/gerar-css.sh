#!/usr/bin/env bash
# Ferramenta de desenvolvimento: regenera o CSS estático das telas PHP (rodar após mudar classes).
set -e
cd "$(dirname "$0")/../.."
npx tailwindcss -c php/tailwind.config.js -i php/assets-src/app.css -o php/public/assets/app.css --minify
npx postcss php/public/assets/app.css --use autoprefixer -o php/public/assets/app.css --no-map 2>/dev/null || true
