# 状态栏 Icon Font 黑块问题 设计文档

> **Commit**: `fe32a07`（修复）/ 前置引入 `b3be77f`
>
> **作者**: ayanamist
>
> **日期**: 2026-08-07
>
> 本文档由 commit hash 反推，未关联到 MR。

---

## 一、背景与目标

### 1.1 现状问题

| 盲区/痛点 | 影响 |
|------|------|
| `b3be77f` 把内置 `asset:*` SVG 转成 `contributes.icons` 用的 woff 后，**Codex** 状态栏按钮显示为实心黑色方块 | 默认状态栏前 3 个 preset（claude / **codex** / gemini）里，Codex 图标不可辨认 |
| 首次生成的 woff **没有可提交的生成脚本**，无法复现或审计字形来源 | 后续改 SVG 只能盲改二进制字体，易再次引入同类回归 |
| VS Code `StatusBarItem.text` 只支持 Theme Icon（`$(name)`），不能直接塞 SVG URI | 状态栏必须走 icon font；TreeView / 终端 tab 仍可走双色 SVG |

根因不是 `package.json` 的码位配错，而是**字体生成器把 SVG 里只用于裁剪的几何体也当成了可见轮廓**：

- `media/icons/codex-dark.svg` 的 `<defs>` 里有两个 `<clipPath><rect …>`（约 720×720 与 484×480）
- 旧生成器把这两个 rect 转成了 glyf 填充轮廓
- 其中覆盖整个 em 方框的那条轮廓在状态栏以前景色实心绘制 → 黑块
- 同理，`opencode-dark.svg` 用 `<mask>` + 满画布路径表达两层颜色；单色字体下也会变成高覆盖率实心块（默认不进状态栏，影响较小）

### 1.2 改造目标

- 状态栏上 Codex（及其他内置 preset）图标显示为正确剪影，而不是实心方块
- 任何人改完 `*-dark.svg` 后，可用一条命令**可复现地**重生 woff 并提交
- 构建输出能提示「字形墨迹覆盖率异常」，方便目测 clipPath / mask 泄漏

---

## 二、改造范围

### 2.1 涉及模块与文件

**核心改动**（提交 `fe32a07`，作者 ayanamist，+605 / -5）：

| 文件路径 | 变更类型 | 说明 |
|---------|---------|------|
| `scripts/build-icon-font.mjs` | **新增** | 从 `*-dark.svg` 生成 woff：跳过非绘制节点、统一 em、打印 ink coverage |
| `media/icons/commands-statusbar-icons.woff` | **修改** | 用新脚本重生；Codex 由满墨迹变为绳结剪影 |
| `package.json` | **修改** | 版本 → `0.0.13`；新增 `build:icon-font`；加入 svg2ttf 等 devDependencies |
| `package-lock.json` | **修改** | 锁定上述构建依赖 |
| `CHANGELOG.md` | **修改** | 记录 0.0.13 修复与构建脚本 |
| `README.md` | **修改** | 说明如何重生字体及 ink coverage 含义 |

### 2.2 次要改动

已查验 `fe32a07` 前后 5 个 commit。直接相关的前置改动：

| Commit | 说明 |
|--------|------|
| `b3be77f` feat: show preset icons in status bar | 首次引入 `contributes.icons` + woff + `resolveStatusBarIcon`；**带入了坏字体** |

其余相邻 commit（`97f0700` ci、`7d2ad7d` docs）与本问题无关。

---

## 三、整体架构与数据流

```
  media/icons/<name>-dark.svg     (TreeView / 终端 tab 仍直接用 light+dark SVG)
            │
            │  npm run build:icon-font
            ▼
  ┌─────────────────────────────────────┐
  │  scripts/build-icon-font.mjs        │
  │  ⚡ 跳过 defs/clipPath/mask/...     │
  │  ⚡ fill=none 不入轮廓              │
  │  ⚡ evenodd 与 nonzero 采样比对     │
  │  ⚡ 居中缩放 + Y 轴翻转 → em 方框  │
  │  ⚡ 打印每字形 ink coverage         │
  └──────────────────┬──────────────────┘
                     │
                     ▼
  media/icons/commands-statusbar-icons.woff
                     │
                     │  contributes.icons (package.json)
                     ▼
  Theme Icon: $(commands-codex) 等
                     │
                     │  resolveStatusBarIcon() → StatusBarItem.text
                     ▼
               状态栏按钮图标
```

---

## 四、Icon Font / 码位定义详解

### 4.1 码位一览

脚本 `ICONS` 数组与 `package.json` → `contributes.icons` **必须保持同步**：

| glyph-name | code point | Theme Icon id | 源 SVG | 修复后 ink coverage |
|---|---|---|---|---|
| opencode | `U+F101` | `commands-opencode` | `opencode-dark.svg` | ~72%（两色磁贴，见附录） |
| gemini | `U+F102` | `commands-gemini` | `gemini-dark.svg` | ~20% |
| cursor | `U+F103` | `commands-cursor` | `cursor-dark.svg` | ~47% |
| copilot | `U+F104` | `commands-copilot` | `copilot-dark.svg` | ~43% |
| codex | `U+F105` | `commands-codex` | `codex-dark.svg` | ~17%（修复前 ~100%） |
| claude | `U+F106` | `commands-claude` | `claude-dark.svg` | ~34% |
| amp | `U+F107` | `commands-amp` | `amp-dark.svg` | ~35% |

### 4.2 字体度量

| 项 | 值 | 说明 |
|---|---|---|
| `units-per-em` | 1000 | 比例对齐 codicon（300/300/0） |
| ascent / descent | 1000 / 0 | 与 codicon 同型，状态栏基线对齐 |
| `horiz-adv-x` | 1000（统一） | 旧字体各字形 advance 混杂（425/306/263/240…） |

### 4.3 运行时映射

`src/extension.ts` 中：

```
asset:codex  →  STATUS_BAR_ASSET_ICONS["codex"]  →  "$(commands-codex)"
```

未注册的 `asset:` / 任意 `file:` URI 回退为 `$(terminal)`（StatusBarItem 限制）。

---

## 五、实现细节

### 5.1 `scripts/build-icon-font.mjs`

关键行为：

| 步骤 | 行为 |
|------|------|
| 解析 SVG | `fast-xml-parser` preserveOrder，保留父子结构 |
| 跳过非绘制 | `NON_PAINTED_TAGS`：`clipPath` / `defs` / `mask` / `style` / 渐变 / `filter` 等 |
| 形状收集 | `path` / `rect` / `circle` / `ellipse` / `polygon` / `polyline`；`fill=none|transparent` 丢弃 |
| evenodd | `assertEvenOddSurvives`：128×128 采样比对 even-odd vs non-zero；不一致则 **抛错中止**（TrueType 只有 non-zero） |
| 坐标变换 | viewBox 等比居中进 em 方框，矩阵 `[s,0,0,-s,tx,ty]` 翻转 Y |
| 输出 | `svg2ttf`（`ts: 0` 固定时间戳）→ `ttf2woff` → 写 woff；两次构建 md5 一致 |

伪代码：

```
for each ICONS entry:
  tree = parse(name-dark.svg)
  paths = collectPaths(skip NON_PAINTED; respect fill inheritance)
  path = transform(paths → em square, flip Y)
  coverage = inkCoverage(path)   // 仅日志，不 fail
emit SVG Font → TTF → WOFF
```

### 5.2 扩展侧（本 commit 未改，由 `b3be77f` 引入）

- `contributes.icons`：`fontPath` + `fontCharacter`（如 Codex = `\\F105`）
- `resolveStatusBarIcon`：把 `asset:name` 映射为 `$(commands-name)`

### 5.3 排障手法（复现根因时用过）

```
fontTools.TTFont(woff)
  → getBestCmap / glyf bbox / PointInsidePen 栅格化
  → Codex 修复前：整幅 em 全填；修复后：绳结剪影
```

---

## 六、次要改动

前置 `b3be77f` 引入的链路本 commit **保持不变**，只换字体二进制与生成方式：

- `package.json` `contributes.icons` 七个码位
- `STATUS_BAR_ASSET_ICONS` + `resolveStatusBarIcon`
- TreeView 仍用 `{ light, dark }` SVG URI

---

## 七、调用链路

```
Preset.icon = "asset:codex"
        │
        ▼
resolveStatusBarIcon()
        │  查 STATUS_BAR_ASSET_ICONS
        ▼
StatusBarItem.text = "$(commands-codex) Codex"
        │
        ▼
Workbench 按 contributes.icons 加载
commands-statusbar-icons.woff 的 U+F105
        │
        ▼
以 statusBar 前景色绘制字形轮廓
  ✅ 正确剪影 / ❌ 满墨迹 = 黑块
```

### ⚠️ 构建期护栏现状

`inkCoverage` **只打印、不失败**（`scripts/build-icon-font.mjs` 约 340–359 行）。若 clipPath 再次泄漏，本地构建仍会成功写出坏字体，只能靠人眼看覆盖率日志。

---

## 八、TODO 清单

### 🟡 P1

1. **ink coverage 异常时构建不失败，回归靠人眼**
   - 证据：`inkCoverage` 只用于 `console.log`（`scripts/build-icon-font.mjs` 340–359 行）；Codex 坏字体时覆盖率接近 100% 仍会写出 woff
   - 建议：对「非白名单」字形设阈值（例如 > 60% 则 `process.exit(1)`）；`opencode` 可单独豁免或列入 allowlist

2. **码位多处维护易漂移**
   - 证据：`ICONS`（脚本 14–22 行）与 `package.json` `contributes.icons` / `STATUS_BAR_ASSET_ICONS` 三处手写同步
   - 建议：由脚本生成 `contributes.icons` 片段，或加校验：码位集合不一致则 fail

### 🟢 P2

1. **CI 不校验已提交 woff 是否与脚本输出一致**
   - 证据：`.github/workflows/release-latest.yml` 只 `npm ci` + `vsce package`，不跑 `build:icon-font`
   - 建议：在 CI 中跑构建并 `git diff --exit-code` 比对 woff，防止只改 SVG 忘提交字体

### ℹ️ 已审但不改（附录）

1. **`opencode` ink coverage ~72%，状态栏仍近似实心块**
   - 为何不改：源 SVG 是「满画布底色 + 挖空 + 双色块」磁贴，单色 font 无法还原；默认 `showInStatusBar: false`；曾尝试 `-mono` 变体后按决策撤回
   - 何时重评：若 OpenCode 默认进状态栏，或官方提供单色剪影资产

2. **圆角 `<rect rx/ry>` 直接抛错**
   - 为何不改：当前源 SVG 无此形状；强制转 path 更清晰
   - 何时重评：有新图标用圆角矩形时再加近似路径

3. **`scripts/` 与 font 构建依赖不进 VSIX**
   - 为何不改：`package.json` `files` 只含 `dist` / `media/icons` 等；`vsce ls` 已确认
   - 何时重评：保持现状即可

---

## 九、关联配置项

| 配置 / 入口 | 作用 |
|-------------|------|
| `npm run build:icon-font` | 重生 `media/icons/commands-statusbar-icons.woff` |
| `contributes.icons.*` | 注册 Theme Icon 名、fontPath、fontCharacter |
| `commands.presets[].icon` = `asset:<name>` | 状态栏走 font；侧栏走 SVG |
| `commands.presets[].showInStatusBar` | OpenCode 等默认 false，降低双色 logo 在状态栏的暴露面 |

---

## 十、状态机 / 数据模型

N/A（无运行时状态机；产物为静态字体 + 声明式 contribution）。

---

## 十一、枚举概览

见 **4.1 码位一览**（七个内置 glyph）。

非绘制标签黑名单（`NON_PAINTED_TAGS`）：

`clipPath` / `defs` / `desc` / `filter` / `linearGradient` / `marker` / `mask` / `metadata` / `pattern` / `radialGradient` / `style` / `symbol` / `title`

---

## 十二、总结

状态栏黑块不是 Theme Icon 配置错误，而是 **SVG→font 时把 clipPath/mask
的几何体当成了填充轮廓**。`fe32a07` 用可提交的生成脚本跳过这些节点并重生
woff，修掉 Codex，同时统一字形宽度与度量。OpenCode 的高覆盖率是源素材双色
磁贴的固有限制，当前接受；后续主要风险是 **ink coverage 不阻断构建** 与
**码位三处手写同步**。
