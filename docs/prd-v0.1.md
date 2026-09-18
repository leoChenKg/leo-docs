# Leo Learn · 本地静态学习文档站 PRD

> 版本：v0.6 · 多文档空间版
> 日期：2026-09-18
> 状态：首版实现中

## 1. 产品定位

Leo Learn 是一个**只供本人在本地使用的静态学习文档站**。

不提供网页编辑器，也不提供个人工作台。所有内容直接修改项目中的 Markdown/MDX 文件、媒体文件和 Demo 组件代码；启动网站后，程序自动扫描目录并展示最新内容。

```text
修改项目文件 → 启动/刷新本地网站 → 自动解析并展示
```

产品体验参考 MUI Material UI 文档站：顶部导航、左侧文档目录、中央阅读区、右侧文章目录、代码示例和组件 Demo。

### 1.1 不做什么

首版不做：

- 登录、账号、权限、数据库、后台管理。
- 页面内新增、编辑、删除和发布。
- 个人工作台、草稿审批、回收站、云端同步。
- 评论、点赞、多人协作和社交功能。
- 复杂学习统计、打卡、积分、掌握度评分。
- SEO、RSS、公开发布流程和生产环境运营功能。

是否显示一篇文档，直接通过文件是否存在、目录位置和可选的 `draft` 字段决定。

## 2. 文档空间模型

“文档空间”是网站的一级内容单元。每个空间拥有自己的名称、简介、目录树、文档、媒体资源和可选 Demo；空间之间互相独立，但可以使用全站共享组件。

创建一个空间不需要页面操作，只需要在仓库中新增一个目录和配置文件。

```text
leo-docs/
├── spaces/
│   ├── frontend/
│   │   ├── space.yml             # 空间配置
│   │   ├── _index.md             # 空间首页
│   │   ├── basics/               # 任意子目录
│   │   │   ├── _index.md         # 子目录首页（可选）
│   │   │   ├── html.md
│   │   │   └── css-grid.mdx
│   │   ├── projects/             # 另一个自定义目录
│   │   ├── assets/               # 当前空间的图片、视频、音频、数据
│   │   └── components/           # 当前空间专属 Demo（可选）
│   └── mathematics/
│       ├── space.yml
│       ├── _index.md
│       ├── algebra/
│       └── assets/
├── components/                   # 全站共享的 Demo、图表和内容组件
├── src/                          # MUI 主题、文档壳层和解析器
├── site.config.ts                # 网站级配置和空间显示顺序
└── package.json
```

空间的最小配置：

```yaml
slug: frontend
title: 前端工程
description: HTML、CSS、JavaScript 和界面工程实践。
icon: code
order: 1
```

空间规则：

- `spaces/*/space.yml` 自动定义一个文档空间；不需要注册数据库或修改路由代码。
- 空间内允许任意层级的子目录，不强制使用 `notes / journal / topics` 这类固定分类。
- `_index.md` 是空间或目录的介绍页；没有时自动生成该目录的文档列表。
- 目录排序优先使用文件 Front Matter 的 `order`，其次使用目录名中的数字前缀，再按名称排序。
- 空间资源放在该空间的 `assets/`，引用路径相对于当前文档；全站公共资源才放在 `public/`。
- 空间专属 Demo 放在 `spaces/<slug>/components/`；多个空间共用的组件放在根目录 `components/`。
- 删除或移动空间目录会同步移除或移动对应页面；不会产生独立的“空间管理后台”。
- 原来的单一 `docs/` 内容可以迁移为 `spaces/learning/`，作为默认学习空间。

## 3. 文档格式

支持 `.md` 和 `.mdx`。普通内容使用 Markdown，需要交互组件时使用 MDX。

### 3.1 文档 Front Matter

```md
---
title: 从一个例子理解 JavaScript 闭包
description: 从作用域、引用和变量生命周期理解闭包。
type: note
tags: [JavaScript, 作用域]
date: 2026-09-18
order: 10
draft: false
---

正文从这里开始。
```

字段只保留必要信息：

| 字段 | 说明 |
| --- | --- |
| `title` | 页面标题；缺省时取首个 H1 或文件名 |
| `description` | 列表摘要；缺省时从正文截取 |
| `type` | 可选的 `note`、`journal`、`reference` 等展示类型；缺省为 `doc` |
| `tags` | 可选标签数组 |
| `date` | 学习日期或文章日期 |
| `order` | 同目录下的手动排序值 |
| `draft` | 可选；为 `true` 时不出现在导航和搜索中 |
| `slug` | 可选；缺省由空间内文件路径生成 |

空间和目录由文件路径决定，不要求维护数据库 ID、公开快照、版本号或发布状态。空间目录和文件路径就是内容来源；文件名默认就是空间内 URL slug。

### 3.2 文件更新规则

- 新增文件后，开发服务自动发现并刷新。
- 修改文件后，当前页面自动刷新或提示重新加载。
- 删除文件后，对应页面、导航和搜索结果移除。
- 文件名改变时，默认 URL 随之改变；需要稳定链接时再显式填写 `slug`。
- Front Matter 写错时，页面显示空间、文件路径和错误位置，开发服务不能静默跳过。

## 4. 页面结构与空间切换

```text
首页/空间选择                /
├── 空间首页                 /spaces/:spaceSlug/
│   ├── 任意目录             /spaces/:spaceSlug/:directory/
│   └── 任意文档             /spaces/:spaceSlug/:path
└── 本地搜索                 /search?space=:spaceSlug&q=关键词
```

### 4.1 网站首页

网站首页不是个人工作台，而是文档空间目录：展示所有空间的名称、简介、图标、文档数量和最近更新。点击空间后进入该空间自己的文档树。

### 4.2 空间首页

空间首页读取该空间的 `space.yml` 和 `_index.md`，展示空间介绍、目录树、最近更新文档和空间内可用的实验室 Demo。

### 4.3 空间内目录和文档

- 左侧导航只展示当前空间的目录树，空间切换后整棵树替换。
- 每个子目录可以有自己的 `_index.md` 作为目录说明页。
- 文档详情页的面包屑显示「空间 / 目录 / 文档」。
- 上一篇/下一篇只在当前空间、当前目录范围内计算。
- 右侧 `On this page` 根据当前文档标题自动生成。

### 4.4 搜索

默认搜索当前空间，也可以切换为全站搜索。索引内容来自所有空间中的 `.md/.mdx` 文件，结果显示空间、目录、标题和匹配片段。

## 5. MUI Docs 风格与实现参考

直接借鉴 MUI 文档站的布局、密度、颜色和组件行为：

- 顶部 App Bar：品牌、空间切换器、搜索、主题切换、源码入口。
- 左侧导航：按目录分组，支持嵌套和当前项高亮。
- 中间正文：约 760px 阅读宽度，Roboto/系统无衬线字体。
- 右侧 `On this page`：根据标题自动生成并吸附定位。
- 主色使用 Material Blue，辅助色使用 Material Purple，表面使用白色和灰色层级。
- 代码区使用带语言标签和复制按钮的容器。
- Demo 使用带边框的预览容器，底部提供说明、重置和源码入口。
- 支持 light / dark / system 三种主题。
- 使用 MUI npm 组件和主题 token，不整仓复制 MUI Docs 的 Next.js 内部代码。

可复用的 MUI 文档实现参考：

- [MarkdownDocsV2](https://github.com/mui/material-ui/blob/master/docs/src/modules/components/MarkdownDocsV2.js)：Markdown、目录、Demo 组合渲染。
- [HighlightedCodeWithTabs](https://github.com/mui/material-ui/blob/master/docs/src/modules/components/HighlightedCodeWithTabs.js)：代码标签和代码展示。
- [Alert 文档](https://github.com/mui/material-ui/blob/master/docs/data/material/components/alert/alert.md)：提示框语法和 Demo 注入方式。
- [MUI 贡献说明](https://github.com/mui/material-ui/blob/master/CONTRIBUTING.md)：Markdown 文档与 Demo 文件的组织方式。

## 6. 通用内容组件

组件都由项目代码提供，文档只负责引用。普通 Markdown 不允许写任意 HTML、脚本或未知组件。

### 6.1 提示框

沿用 MUI Alert 的视觉结构和语义，支持：

```md
:::info
补充背景信息。
:::

:::success
这个练习已经通过验证。
:::

:::warning
这个结论依赖当前假设。
:::

:::error
输入为空时示例会失败。
:::
```

`:::tip` 作为 info 的轻量别名。提示框支持标题、图标和三种展示变体：`standard`、`outlined`、`filled`。

提示框还包括：

- `Snackbar`：复制代码等操作后的短反馈。
- `Dialog`：只用于查看完整媒体或确认危险操作。
- `Progress` / `Skeleton`：只表示页面或 Demo 加载状态，不表示学习完成度。

### 6.2 文档和展示组件

首版支持：

- Breadcrumbs
- Tabs
- Accordion
- Table
- Divider
- Chip / Tag
- Tooltip
- Pagination
- CodeBlock
- Figure
- ReferenceList
- GlossaryTerm

### 6.3 学习内容组件

首版支持：

- 图片：响应式、alt、图注、点击放大。
- 视频：本地 MP4/WebM、poster、控件和字幕入口。
- 音频：本地 MP3/OGG/WAV、控件和文字稿。
- 数学公式：行内公式和块级公式，支持 TeX 源码查看。
- Mermaid：流程图、时序图、状态图、ER 图的扩展入口（首版保留 Markdown 代码回退）。
- 图表：首版提供 `:::chart bar|line` 的轻量数据块，后续可接入 Vega-Lite + CSV/JSON，覆盖更多图表类型。
- 音视频：使用 Markdown 媒体链接自动渲染本地 MP4/WebM/MP3/WAV 等播放器。
- Demo：滑块、按钮、输入框、代码示例等可交互内容。

### 6.4 Demo 写法

参考 MUI 文档的 Demo 注入方式，文章只写组件名称，组件代码单独维护：

```mdx
<Demo name="closure-counter" />
```

普通 Markdown 也可以使用 `{{"demo":"closure-counter"}}` 语法引用同一个 Demo。

```text
spaces/frontend/components/demos/closure-counter/
├── Demo.tsx
├── fallback.md
├── README.md
└── index.ts
```

每个 Demo 应包含标题、用途说明、预览区、重置按钮、查看源码入口和静态 fallback。Demo 只用于本地阅读体验，不需要上传数据或连接后端。

## 7. 本地开发命令

```text
pnpm dev       启动本地文档站，监听 spaces/、components/ 和 src/
pnpm check     检查 Front Matter、资源路径、组件名称和 Markdown 结构
pnpm build     生成本地静态产物，便于预览或备份
pnpm preview   预览 build 结果
```

推荐技术组合：Vite 或 Next.js 静态导出 + React + TypeScript + MUI + MDX。最终选择以本地启动速度、文件监听体验和 MDX 组件支持为准。

## 8. 第一版范围

### 必须支持

- 文件驱动的 Markdown/MDX 自动解析。
- MUI Docs 风格的顶部导航、左侧目录、正文和右侧目录。
- 本地搜索、空间切换、面包屑、标签和上一篇/下一篇。
- 图片、视频、音频、公式、Mermaid、Vega-Lite 静态图表。
- Info / Success / Warning / Error / Tip 提示框。
- Tabs、Accordion、Table、CodeBlock、Figure、ReferenceList。
- 至少一个可交互 Demo，并支持重置和静态 fallback。
- light / dark / system 主题和手机阅读。

### 后续再做

- 更多交互图表和 Demo。
- 外部视频/音频/iframe 嵌入。
- 在线运行 JavaScript、Python 或 WASM。
- 阅读进度、收藏、术语表、RSS、打印 PDF。
- 多语言和更复杂的实验室索引。

## 9. 验收标准

1. 在 `spaces/frontend/` 新增一个空间配置和 `_index.md`，刷新本地网站后自动出现空间入口。
2. 在空间内新增任意层级的目录和 Markdown 文件，自动生成目录树、面包屑、文档页和搜索结果。
3. 空间之间的目录、资源、文档数量和上一篇/下一篇不会互相串联。
4. 修改或删除空间配置、目录或文档后，页面和导航同步更新，不需要修改数据库或后台配置。
5. 一个文档可以正确展示图片、视频、音频、公式、代码、Mermaid 和至少一种图表。
6. `:::info`、`:::success`、`:::warning`、`:::error` 能显示正确图标、颜色、标题和正文。
7. Demo 能交互、重置、键盘操作；关闭脚本时显示 fallback 文本。
8. 360px 宽度下空间切换器、左侧目录、正文、表格、公式、代码和 Demo 不产生页面级横向滚动。
9. 非法 `space.yml`、Front Matter、失效资源或不存在的组件会显示空间、文件路径和错误信息。
10. `draft: true` 的文件不进入当前空间导航和搜索，但本地开发时可以通过配置选择是否预览。
11. 所有内容均可通过直接修改仓库文件完成，不出现网页编辑入口、登录页或个人工作台。

## 10. 本轮审核重点

1. 是否确认“文档空间”是网站的一级对象，每个空间由一个仓库目录定义？
2. 是否接受空间内使用任意目录结构，并通过 `_index.md` 定义目录说明页？
3. 是否确认在顶部提供空间切换器，左侧导航只展示当前空间？
4. 是否确认所有内容、资源和组件继续通过直接修改仓库文件完成，不增加空间管理后台？
