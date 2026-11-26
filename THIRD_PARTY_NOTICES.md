# 第三方库许可声明

本项目在 `assets/` 下内联了以下第三方库，其版权与许可归各自作者所有：

| 库 | 版本 | 许可 | 来源 |
| --- | --- | --- | --- |
| JSZip | 3.10.1 | MIT / GPLv3 双许可（本项目采用 MIT） | https://github.com/Stuk/jszip |
| pako（JSZip 依赖） | 2.1.0 | MIT | https://github.com/nodeca/pako |

JSZip 仅作为 **原生 `DecompressionStream` 不可用时的兜底解包路径**；主流浏览器走的是
`DecompressionStream('deflate-raw')` 原生流式解压，不依赖该库。

> v3.x 曾内联 three.js（3D 粒子球可视化）与 Framework7（CSS），**v4 起两者均已移除**，
> 不再分发，因此不再列入本声明。

设备产品图片（AirPods / AirPods Pro / AirPods Max 等）版权归 Apple Inc. 所有，
仅用于个人健康数据的可视化展示，本项目不主张其所有权。
