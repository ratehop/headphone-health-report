#!/bin/bash
# =====================================================================
# 同步到 GitHub 上传包
#
# 目的：v4 目录是「开发源」，GitHub 上传包是「发布快照」。
#       两者唯一的差别是 PWA manifest：
#         - WorkBuddy 部署  → start_url 必须带 sharecode（网关鉴权，主屏图标启动不带 cookie）
#         - GitHub Pages    → 不需要 sharecode，start_url 就是 "./"
#       其余文件逐字节相同。
#
# 用法：  ./sync-github.sh            # 输出到 ../headphone-health-report
#         ./sync-github.sh <目录>      # 输出到指定目录
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"

SRC="$PWD"
DST="${1:-$SRC/../headphone-health-report}"

echo "源目录  : $SRC"
echo "目标目录: $DST"

rm -rf "$DST"
mkdir -p "$DST/assets"

# --- 站点文件 -------------------------------------------------------
cp "$SRC/index.html" "$SRC/style.css" "$SRC/app.js" "$DST/"
cp -R "$SRC/assets/." "$DST/assets/"

# --- 构建脚本 / 文档（保留，方便复现图标与 manifest）----------------
cp "$SRC/build-manifest.sh" "$DST/build-manifest.sh"
cp "$SRC/sync-github.sh" "$DST/sync-github.sh"
cp "$SRC/README.md" "$DST/README.md"
cp "$SRC/README-v4.md" "$DST/README-v4.md"

# --- GitHub Pages 元文件 --------------------------------------------
cp "$SRC/LICENSE" "$DST/LICENSE"
cp "$SRC/THIRD_PARTY_NOTICES.md" "$DST/THIRD_PARTY_NOTICES.md"
: > "$DST/.nojekyll"     # 禁用 Jekyll 处理，保证 assets/ 原样发布

# --- manifest：GitHub 版本不带 sharecode -----------------------------
cat > "$DST/manifest.webmanifest" <<'EOF'
{
  "name": "耳机佩戴报告",
  "short_name": "佩戴报告",
  "description": "把 Apple Health 的耳机音频暴露数据变成一份本地生成的佩戴报告。",
  "start_url": "./",
  "scope": "./",
  "id": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#2c1806",
  "theme_color": "#3a1c07",
  "icons": [
    { "src": "./assets/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "./assets/icon.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "./assets/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
EOF

# index.html 里的 manifest 引用同步去掉 sharecode 查询串
python3 - "$DST/index.html" <<'PY'
import sys, re, io
p = sys.argv[1]
s = io.open(p, encoding='utf-8').read()
s2 = re.sub(r'<link rel="manifest" href="[^"]*">',
            '<link rel="manifest" href="./manifest.webmanifest">', s)
if s2 != s:
    io.open(p, 'w', encoding='utf-8').write(s2)
    print('  index.html: manifest 引用已去掉 sharecode')
PY

echo
echo "✅ GitHub 上传包已生成："
ls -la "$DST"
