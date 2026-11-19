# 🎧 耳机佩戴报告 · Headphone Health Report

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android%20%7C%20Desktop-lightgrey.svg)
![Privacy](https://img.shields.io/badge/privacy-100%25%20local-green.svg)

> 把 Apple Health（苹果健康）里的耳机音频暴露数据，变成一份好看、可交互的佩戴报告。
> **全程在本地浏览器完成解析，健康数据不上传、不联网、不留痕。**

一个单文件、零后端的网页工具：导入从「健康」App 导出的 ZIP，即可看到佩戴时长、次数、音量、首次 / 末次使用等统计，以及可旋转的 3D 粒子球可视化。支持深浅色切换、多设备识别（AirPods / AirPods Pro / AirPods Max 等），适配手机与桌面。

---

## ✨ 功能特性

| 功能 | 说明 |
| --- | --- |
| 🔒 纯本地解析 | ZIP 在浏览器内解压、分析，数据从不离开你的设备 |
| 📊 核心指标 | 使用时长、佩戴次数、平均 / 最长时长、平均音量、首次 / 末次使用 |
| 🎧 多设备识别 | 按蓝牙标识自动归组，区分 AirPods、Pro、Max 等多副耳机 |
| 🔊 能量加权音量 | 按暴露时长加权计算平均 dB(A)，而非简单算术平均 |
| 🫧 3D 粒子球 | three.js 驱动的交互式粒子可视化，随主题变色 |
| 🌗 深浅色切换 | Liquid Glass 毛玻璃风格，一键切换明暗主题 |
| 📱 响应式 | 手机竖屏横屏、平板、桌面宽屏均适配 |
| 📦 单文件 | 一个 HTML 就是全部，无需安装、无需服务器 |

---

## 🚀 在线使用（推荐）

打开项目主页（GitHub Pages）：

**<https://ratehop.github.io/headphone-health-report/>**

在 iPhone 上用 **Safari** 打开即可，点「选择文件」导入健康数据 ZIP，等待几秒到几十秒（取决于数据量），报告就出来了。

> 💡 **为什么推荐在线版？** iOS 的 Safari 不注册本地 HTML 文件的打开方式，AirDrop 传 HTML 过去往往会卡在「文件」App 里打不开。用 https 网址访问则完全没有这个问题——网址点开即用，导出 ZIP 后直接在网页里选文件就行。

---

## 📥 下载使用

如果你想把网页存到本地、离线用，或分享给别人：

| 方式 | 链接 / 操作 |
| --- | --- |
| 直接下载单文件 HTML | [index.html](https://raw.githubusercontent.com/ratehop/headphone-health-report/main/index.html)（打开后右键「另存为」，或用浏览器下载） |
| 下载整个项目 | 仓库页面点 **Code → Download ZIP** |
| 本地打开 | 双击 `index.html`，用 Chrome / Edge / Safari 打开均可 |

> ⚠️ 本地 `file://` 方式在 iOS Safari 上受限（见上文），在桌面浏览器和 Android 上正常。手机端建议优先用在线版。

---

## 📋 如何导出 Apple Health 数据

报告的数据来源是 iPhone「健康」App：

1. 打开 iPhone 上的 **「健康」App**
2. 点右上角 **头像 / 个人资料**
3. 滑到最底部，点 **「导出所有健康数据」**
4. 等待系统打包（数据量大的话可能要几分钟）
5. 把生成的压缩包（通常叫 `导出.zip`）通过 AirDrop / 微信 / 云盘传到你要打开报告的 device
6. 在报告页面点 **「选择文件」**，选中这个 ZIP

> 只需要导出的 ZIP 本身，不需要解压。工具只读取其中的 `export.xml`。

---

## 🔒 隐私与安全

- **不上传**：所有解压与统计都在浏览器内存中完成，页面没有把数据发往任何服务器的逻辑
- **不落盘**：关闭页面后数据即消失
- **零外链**：HTML 内的 JSZip、three.js、Framework7 CSS、设备图片全部内联，页面运行不请求外部资源
- **可审计**：单文件源码公开，可自行检查网络请求

如果你对隐私有更高要求，下载单文件后断网使用即可——工具不依赖网络。

---

## 🌐 浏览器兼容性

| 平台 | 在线版（https） | 本地版（file://） |
| --- | --- | --- |
| iPhone Safari | ✅ 推荐 | ❌ 系统限制，打不开 |
| iPhone Chrome / 夸克 | ✅ | ⚠️ 部分可用，因浏览器而异 |
| Android 浏览器 | ✅ | ✅ |
| macOS / Windows 桌面 | ✅ | ✅ |

---

## 🛠 技术实现

- **Zip 解析**：JSZip 3.10.1（内联），`arrayBuffer` + 缓存 + 读写锁，规避 Safari 的 I/O 报错
- **数据算法**：按 `localIdentifier` 归组设备、重叠区间去重、5 分钟间隔估算佩戴、能量加权平均音量
- **可视化**：three.js r128 `BufferGeometry` + `ShaderMaterial` 粒子球
- **UI**：Framework7 iOS 风格 CSS + 自定义 Liquid Glass 毛玻璃
- **构建**：单文件 HTML，所有依赖与图片（WebP）内联

---

## 📁 项目结构

```
headphone-health-report/
├── index.html              # 单文件应用（也是 GitHub Pages 首页）
├── README.md               # 本说明
├── LICENSE                 # MIT 许可
├── THIRD_PARTY_NOTICES.md  # 第三方库许可声明
└── .nojekyll               # 确保 GitHub Pages 正确处理静态文件
```

---

## 📄 许可

本项目代码采用 [MIT License](./LICENSE)。

项目内嵌的第三方库（JSZip、pako、three.js、Framework7）各有其许可，详见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

设备图片版权归 Apple Inc. 所有，仅用于个人数据可视化展示。

---

## 🙏 致谢

- [JSZip](https://github.com/Stuk/jszip) — 浏览器内 ZIP 解析
- [three.js](https://github.com/mrdoob/three.js) — 3D 粒子球
- [Framework7](https://github.com/framework7io/framework7) — iOS 风格 UI
- Apple Health — 原始数据来源
