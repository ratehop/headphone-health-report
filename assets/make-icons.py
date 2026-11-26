#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
耳机佩戴报告 · 应用图标生成器
------------------------------------------------------------------
设计：
  · 底：暖橙色「渐变网格」——四团橙光在低分辨率上画好后整体做高斯模糊再放大，
    所以过渡非常晕散、没有任何色带和硬边（不是线性渐变，是一团散开的光）。
  · 上：一枚纯白的矢量耳机（头梁 + 两只耳罩），线条干净、带内阴影。
  · 形：macOS 风格 superellipse（squircle，连续曲率），不是纯黑底。

输出：
  icon.png              1024×1024  squircle（透明角）
  icon-192.png           192×192   squircle
  icon-maskable-512.png  512×512   满幅方图（系统自己裁形状）
  apple-touch-icon.png   180×180   满幅方图（iOS 自己裁圆角）

用法： python3 make-icons.py
"""
import math
import os
from PIL import Image, ImageDraw, ImageFilter, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- 橙光团
# (x%, y%, 半径%, 颜色, 强度)  —— 同一橙色系里拉开明度，避免叠成脏褐色
BLOBS = [
    (18.0, 14.0, 78.0, (0xFF, 0xD2, 0x8E), 1.00),
    (88.0, 20.0, 74.0, (0xFF, 0x9E, 0x32), 1.00),
    (66.0, 96.0, 82.0, (0xFF, 0x76, 0x18), 1.00),
    (8.0, 88.0, 70.0, (0xFF, 0x66, 0x12), 0.92),
    (50.0, 46.0, 60.0, (0xFF, 0xB2, 0x44), 0.70),
]
BASE = (0x50, 0x1C, 0x05)          # 底色：暖棕橙（不用近黑，避免整体发闷）
GLOSS = (0xFF, 0xFF, 0xFF)         # 左上高光
EDGE = (0xBC, 0x48, 0x07)          # 四角暗边
GLYPH = (0xFF, 0xFF, 0xFF)         # 耳机：纯白
SHADOW = (0x9A, 0x3B, 0x00)        # 耳机内阴影（暖橙，不是黑）


# ---------------------------------------------------------------- 工具
def bez(p0, p1, p2, p3, n=120):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ))
    return out


def path(segments):
    pts = []
    for seg in segments:
        s = bez(*seg)
        if pts:
            s = s[1:]
        pts.extend(s)
    return pts


def superellipse(a, n=5.0, steps=720):
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        ct, st = math.cos(t), math.sin(t)
        pts.append((a * math.copysign(abs(ct) ** (2.0 / n), ct),
                    a * math.copysign(abs(st) ** (2.0 / n), st)))
    return pts


def rrect(cx, cy, w, h, rad, deg, per=12):
    """圆角矩形轮廓（可旋转）"""
    hw, hh = w / 2 - rad, h / 2 - rad
    corners = [((hw, -hh), -90), ((hw, hh), 0), ((-hw, hh), 90), ((-hw, -hh), 180)]
    pts = []
    for (ox, oy), a0 in corners:
        for i in range(per + 1):
            a = math.radians(a0 + 90 * i / per)
            pts.append((ox + rad * math.cos(a), oy + rad * math.sin(a)))
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]


def stroke(draw, pts, width, fill=255):
    """把折线画成有宽度的笔画（矩形段 + 圆形接头/端点）"""
    r = width / 2.0
    for i in range(len(pts) - 1):
        x0, y0 = pts[i]
        x1, y1 = pts[i + 1]
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / L * r, dx / L * r
        draw.polygon([(x0 + nx, y0 + ny), (x1 + nx, y1 + ny),
                      (x1 - nx, y1 - ny), (x0 - nx, y0 - ny)], fill=fill)
    for p in pts:
        draw.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=fill)


# ---------------------------------------------------------------- 耳机
def headphone_parts():
    """返回 (头梁路径, 左耳罩多边形, 右耳罩多边形)，坐标空间 0..1000"""
    band = path([
        ((205, 615), (205, 336), (330, 240), (500, 240)),
        ((500, 240), (670, 240), (795, 336), (795, 615)),
    ])
    cup_l = rrect(203, 660, 178, 270, 80, -8)
    cup_r = rrect(797, 660, 178, 270, 80, 8)
    return band, cup_l, cup_r


def headphone_mask(size, scale, ox, oy):
    m = Image.new('L', (size, size), 0)
    d = ImageDraw.Draw(m)
    band, cup_l, cup_r = headphone_parts()

    def T(pts):
        return [(ox + p[0] * scale, oy + p[1] * scale) for p in pts]

    stroke(d, T(band), 86 * scale)
    d.polygon(T(cup_l), fill=255)
    d.polygon(T(cup_r), fill=255)
    return m


# ---------------------------------------------------------------- 背景
def background(size, squircle=True):
    """橙色渐变网格：低分辨率画光团 → 高斯模糊 → 放大（非常晕散）"""
    N = 160
    small = Image.new('RGB', (N, N), BASE)
    px = small.load()
    for y in range(N):
        for x in range(N):
            u, v = x / (N - 1), y / (N - 1)
            # 加权混色：先求出各光团颜色的加权平均，再按「覆盖强度」和底色融合。
            # 这样出来的颜色是干净饱和的橙，不会因为叠加而糊成褐色。
            sr = sg = sb = st = 0.0
            for bx, by, br, col, inten in BLOBS:
                dx, dy = (u - bx / 100.0) / (br / 100.0), (v - by / 100.0) / (br / 100.0)
                d2 = math.sqrt(dx * dx + dy * dy)
                if d2 >= 1.0:
                    continue
                w = (1.0 - d2) ** 2.0 * inten
                sr += col[0] * w
                sg += col[1] * w
                sb += col[2] * w
                st += w
            if st > 0:
                mix = min(1.0, st * 0.95)
                r = BASE[0] * (1 - mix) + (sr / st) * mix
                g = BASE[1] * (1 - mix) + (sg / st) * mix
                b = BASE[2] * (1 - mix) + (sb / st) * mix
                px[x, y] = (int(min(255, r)), int(min(255, g)), int(min(255, b)))
            else:
                px[x, y] = BASE

    # 高斯模糊（小图上做，模糊半径相对更大）→ 再放大，得到极软的过渡
    small = small.filter(ImageFilter.GaussianBlur(N * 0.062))
    img = small.resize((size, size), Image.BICUBIC).convert('RGBA')

    # 左上柔光（macOS 的那点「反光」）
    gl = Image.new('L', (N, N), 0)
    gp = gl.load()
    for y in range(N):
        for x in range(N):
            dx, dy = (x / N - 0.26) / 0.62, (y / N - 0.16) / 0.62
            v = max(0.0, 1.0 - math.sqrt(dx * dx + dy * dy))
            gp[x, y] = int(46 * (v ** 2.6))
    gl = gl.filter(ImageFilter.GaussianBlur(N * 0.06)).resize((size, size), Image.BICUBIC)
    img = Image.composite(Image.new('RGBA', (size, size), GLOSS + (255,)), img, gl)

    # 四角压暗，让中心更「聚焦」
    vg = Image.new('L', (N, N), 0)
    vp = vg.load()
    for y in range(N):
        for x in range(N):
            dx, dy = x / N - 0.5, y / N - 0.5
            v = max(0.0, math.sqrt(dx * dx + dy * dy) / 0.72 - 0.28)
            vp[x, y] = int(135 * min(1.0, v) ** 1.5)
    vg = vg.filter(ImageFilter.GaussianBlur(N * 0.05)).resize((size, size), Image.BICUBIC)
    img = Image.composite(Image.new('RGBA', (size, size), EDGE + (255,)), img, vg)

    # 最后再拉一点饱和度，保证是「橙」而不是「棕」
    from PIL import ImageEnhance
    rgb = img.convert('RGB')
    rgb = ImageEnhance.Color(rgb).enhance(1.22)
    img = rgb.convert('RGBA')

    if squircle:
        a = size / 2.0
        m = Image.new('L', (size, size), 0)
        ImageDraw.Draw(m).polygon([(a + x, a + y) for x, y in superellipse(a, 5.0)], fill=255)
        img.putalpha(m)
    else:
        img.putalpha(255)
    return img


# ---------------------------------------------------------------- 组装
def build(size, squircle=True, glyph_ratio=0.70):
    W = size * 2
    base = background(W, squircle=squircle)

    band, cup_l, cup_r = headphone_parts()
    allp = band + cup_l + cup_r
    minx = min(p[0] for p in allp)
    maxx = max(p[0] for p in allp)
    miny = min(p[1] for p in allp)
    maxy = max(p[1] for p in allp)
    bw, bh = maxx - minx, maxy - miny
    scale = (W * glyph_ratio) / max(bw, bh)
    ox = (W - bw * scale) / 2 - minx * scale
    oy = (W - bh * scale) / 2 - miny * scale

    gm = headphone_mask(W, scale, ox, oy)

    # 内阴影：耳机下方一层模糊暖橙，做出厚度
    sh = Image.new('RGBA', (W, W), SHADOW + (0,))
    sh.putalpha(gm.filter(ImageFilter.GaussianBlur(W * 0.009)).point(lambda v: int(v * 0.62)))
    sh = ImageChops.offset(sh, 0, int(W * 0.010))

    out = Image.alpha_composite(base, sh)

    # 耳机本体：白色，带极轻的顶部高光
    gg = Image.new('RGBA', (W, W), GLYPH + (255,))
    gp = gg.load()
    for y in range(0, W, 4):
        t = y / (W - 1)
        c = tuple(int(255 - 18 * (t ** 2.2)) for _ in range(3))
        for x in range(W):
            gp[x, y] = c + (255,)
    gg.putalpha(gm)
    out = Image.alpha_composite(out, gg)
    return out.resize((size, size), Image.LANCZOS)


def main():
    jobs = [
        ('icon.png', 1024, True, 0.70),
        ('icon-192.png', 192, True, 0.70),
        ('icon-maskable-512.png', 512, False, 0.58),
        ('apple-touch-icon.png', 180, False, 0.64),
    ]
    for name, size, sq, ratio in jobs:
        img = build(size, squircle=sq, glyph_ratio=ratio)
        img.save(os.path.join(HERE, name))
        print('生成', name, img.size, 'squircle' if sq else 'full-bleed')


if __name__ == '__main__':
    main()
