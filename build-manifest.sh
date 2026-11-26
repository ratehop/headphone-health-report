#!/bin/bash
# =====================================================================
# 生成 PWA manifest（根目录）+ 同步 index.html 里的 manifest 引用
#
# 为什么需要这个脚本：
#   1) manifest 必须放在「站点根目录」。放在 assets/ 下时，
#      start_url 的 "./" 会相对 manifest 自身解析成 /assets/，
#      iOS「添加到主屏幕」启动后打开的是目录列表页（进不去应用）。
#   2) start_url 必须带 sharecode。分享网关要求 ?sharecode=XXX
#      或同域 cookie，否则返回 403「链接不完整」。
#      iOS 主屏图标启动不会带 cookie，所以 sharecode 必须写进 start_url。
#
# 用法：  SHARE_CODE=WRWALA5PVK ./build-manifest.sh
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"

CODE="${SHARE_CODE:-WRWALA5PVK}"

cat > manifest.webmanifest <<EOF
{
  "name": "耳机佩戴报告",
  "short_name": "佩戴报告",
  "description": "把 Apple Health 的耳机音频暴露数据变成一份本地生成的佩戴报告。",
  "start_url": "./?sharecode=${CODE}",
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

# index.html 的 manifest 引用也要带 sharecode，
# 否则浏览器抓 manifest 时（此时可能还没拿到 cookie）会被网关 403 拦掉，
# 退化成无 manifest 的网页快捷方式（没图标、没独立窗口）。
#
# 注意：只有 manifest 需要在这里补 sharecode。
# style.css / app.js / 图标这些，靠「首次带 sharecode 访问 → 网关下发 cookie → 后续请求自动带 cookie」放行，
# 保持引用干净，GitHub Pages 版本才能直接用。
python3 - "$CODE" <<'PY'
import sys, re, io
code = sys.argv[1]
p = 'index.html'
s = io.open(p, encoding='utf-8').read()
new_ref = '<link rel="manifest" href="./manifest.webmanifest?sharecode=%s">' % code
s2 = re.sub(r'<link rel="manifest" href="[^"]*">', new_ref, s)
if s2 == s:
    print('index.html: manifest 引用已是目标值或未找到')
else:
    io.open(p, 'w', encoding='utf-8').write(s2)
    print('index.html: manifest 引用已更新 ->', new_ref)
PY

echo "manifest.webmanifest 已生成 (sharecode=${CODE})"
