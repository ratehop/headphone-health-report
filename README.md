# 耳机佩戴报告 v4.0.0 — finesse 重制版

纯前端、零后端、全本地的耳机音频暴露报告工具。**UI 层按 finesse-ui 技能完全重制，数据/解析层与 v3.2 完全一致**（含全部防御逻辑）。

## 本次改动

| 项 | v3.2 | v4.0 |
|---|---|---|
| 视觉语言 | iOS 干净风 | iOS 语言 + 彩色环境底 + 玻璃质感（backdrop-filter） |
| 配色 | 固定一套 | **10 套配色**，设置页可切换，深浅两态独立调校 |
| 设置页 | 无 | 新增「设置」Tab：深浅模式（浅/深/自动）+ 10 配色 + 数据说明 + 关于 |
| 设备页可视化 | Three.js 粒子球（603KB） | CSS 环境光晕 + 产品图，删除 Three.js |
| 体积 | 1.08MB 单文件 | **约 400KB**（-62%），拆分为 index.html + style.css + app.js + assets/ |
| 图表 | CSS 柱状图 | 同为真实数据驱动，最高列标注、零值真实呈现、键盘可达（role/aria） |
| 深浅模式 | 浅/深切换 | 浅/深/自动（跟随系统），逐主题逐模式过 WCAG AA |

## 保留的核心资产（与 v3.2 相同）

- `DecompressionStream` 原生流式解压主路径 + JSZip 兜底（处理 400MB XML 不爆内存）
- 流式 `parseXml`（NEEDLE 命中回溯，不用 DOMParser 整包加载）
- 全部踩坑防御：文件句柄不清 value、只重试一次、阶段日志（hp_stage）、中断提示、环境诊断
- 统计口径：5 分钟间隔估算佩戴次数、重叠区间去重、声能量加权平均音量

## 部署（GitHub Pages）

整个目录原样上传仓库根目录即可（相对路径引用，`assets/` 随行）：

```
index.html  style.css  app.js  assets/  .nojekyll
```

- 别忘了 `.nojekyll`（GitHub Pages 禁用 Jekyll 处理）
- 分享链接 `SHARE_URL` 在 `app.js` 搜索 `SHARE_URL` 一处修改
- 版本号显示在首页右上角（index.html 的 `.ver`）

## 10 套配色

海盐蓝 / 落日珊瑚 / 绯红 / 樱花粉 / 葡萄紫 / 红紫 / 薄荷绿 / 森林绿 / 落日橙 / 石墨灰。
定义位置：`style.css`（`--amb-*` 环境底色 + `--accent`）与 `app.js`（`COLORS` 数组，供设置页色卡预览）。两处同增删即可扩展。

## 开发说明

- URL 加 `?demo=1` 可生成示例报告（无 ZIP 环境验证界面用），不影响正常使用
- 主题持久化：`localStorage` 的 `hp_color` / `hp_mode`
- 图标：`assets/icon.png`（PWA manifest 在 `assets/manifest.webmanifest`）
